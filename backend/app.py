"""
Backend do Lembrancinha do Orador (Flask).

Faz três coisas:
  1. Serve o site (index.html, css, js) — assim o site e a API ficam no mesmo endereço.
  2. Guarda o estado (grupos, famílias, histórico, rodízio) em um arquivo JSON -> sincroniza computador e celular.
  3. Roda um agendador que, de quarta a sábado nos horários configurados, envia um push (via ntfy.sh)
     enquanto o próximo sábado não tiver família confirmada. Funciona com o site/navegador fechado.

Variáveis de ambiente:
  DATA_DIR   pasta onde guardar state.json (padrão: ./dados)
  APP_TOKEN  (opcional, recomendado) senha simples exigida no cabeçalho X-Token
  NTFY_URL   servidor ntfy (padrão: https://ntfy.sh)
"""
import json
import os
import threading
import urllib.request
from datetime import date, datetime, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

from flask import Flask, jsonify, request, send_from_directory

TZ = ZoneInfo("America/Sao_Paulo")
RAIZ = Path(__file__).resolve().parent.parent
DATA_DIR = Path(os.environ.get("DATA_DIR", Path(__file__).resolve().parent / "dados"))
ESTADO = DATA_DIR / "state.json"
ENVIADOS = DATA_DIR / "lembretes_enviados.json"
APP_TOKEN = os.environ.get("APP_TOKEN", "")
NTFY_URL = os.environ.get("NTFY_URL", "https://ntfy.sh").rstrip("/")
trava = threading.Lock()

app = Flask(__name__, static_folder=None)


# ---------------------------------------------------------------- utilidades
def ler_json(caminho, padrao):
    try:
        return json.loads(caminho.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return padrao


def gravar_json(caminho, dados):
    DATA_DIR.mkdir(parents=True, exist_ok=True)
    tmp = caminho.with_suffix(".tmp")
    tmp.write_text(json.dumps(dados, ensure_ascii=False, indent=2), encoding="utf-8")
    tmp.replace(caminho)  # troca atômica: nunca deixa o arquivo pela metade


def proximo_sabado(hoje: date) -> date:
    """Hoje, se for sábado; senão o próximo sábado (mesma regra do frontend)."""
    return hoje + timedelta(days=(5 - hoje.weekday()) % 7)


def validar(estado) -> bool:
    return (
        isinstance(estado, dict)
        and isinstance(estado.get("groups"), list) and estado["groups"]
        and isinstance(estado.get("families"), list)
        and isinstance(estado.get("deliveries"), list)
        and isinstance(estado.get("rotation"), dict)
        and isinstance(estado.get("settings"), dict)
    )


def autorizado() -> bool:
    return not APP_TOKEN or request.headers.get("X-Token", "") == APP_TOKEN


# ---------------------------------------------------------------- lembretes
def situacao_lembrete(estado, agora: datetime):
    """Mesma regra do navegador: quarta(2) a sábado(5) em Python, horas configuradas, sábado sem confirmação."""
    sab = proximo_sabado(agora.date())
    if any(d.get("saturday") == sab.isoformat() for d in estado.get("deliveries", [])):
        return None
    if sab.isoformat() in estado.get("semReuniao", []):  # sábado sem reunião: não precisa de família
        return None
    if not 2 <= agora.weekday() <= 5:
        return None
    horarios = []
    for valor in estado.get("settings", {}).get("lembreteHoras", [8, 11, 14, 17, 20]):
        try:
            if isinstance(valor, (int, float)):
                minutos = int(valor) * 60
            else:
                partes = str(valor).strip().split(":")
                h = int(partes[0]); m = int(partes[1]) if len(partes) > 1 else 0
                if len(partes) > 2 or not (0 <= h <= 23 and 0 <= m <= 59):
                    continue
                minutos = h * 60 + m
            if 0 <= minutos < 1440:
                horarios.append(minutos)
        except (ValueError, TypeError):
            continue
    passadas = sorted(set(m for m in horarios if m <= agora.hour * 60 + agora.minute))
    if not passadas:
        return None
    minuto = passadas[-1]
    hora = f"{minuto // 60:02d}:{minuto % 60:02d}"
    grupos = estado["groups"]
    grupo = grupos[estado["rotation"].get("nextGroupIndex", 0) % len(grupos)]["name"]
    return {"sabado": sab, "hora": hora, "chave": f"{sab.isoformat()}|{agora.date().isoformat()}|{hora}", "grupo": grupo}


def rotulo_grupo(nome: str) -> str:
    nome = (nome or "").strip()
    return nome if nome.lower().startswith("grupo") else f"Grupo {nome}"


def enviar_ntfy(topico: str, titulo: str, texto: str):
    req = urllib.request.Request(
        f"{NTFY_URL}/{topico}",
        data=texto.encode("utf-8"),
        headers={"Title": titulo.encode("utf-8").decode("latin-1", "ignore"), "Priority": "high", "Tags": "bell"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=10):
        pass


def verificar_lembretes(agora: datetime = None, enviar=enviar_ntfy):
    agora = agora or datetime.now(TZ)
    with trava:
        estado = ler_json(ESTADO, None)
        if not validar(estado):
            return "sem-estado"
        topico = (estado["settings"].get("ntfyTopic") or "").strip()
        if not topico:
            return "sem-topico"
        sit = situacao_lembrete(estado, agora)
        if not sit:
            return "nada-a-enviar"
        enviados = ler_json(ENVIADOS, {"ultima": ""})
        if enviados.get("ultima") == sit["chave"]:
            return "ja-enviado"
        texto = f"Ainda não há família confirmada para o sábado {sit['sabado'].strftime('%d/%m/%Y')}. Vez do {rotulo_grupo(sit['grupo'])}."
        try:
            enviar(topico, "Lembrancinha do orador", texto)
        except Exception as e:  # tenta de novo no próximo minuto
            app.logger.warning("Falha ao enviar push: %s", e)
            return "falhou"
        gravar_json(ENVIADOS, {"ultima": sit["chave"]})
        return "enviado"


# ---------------------------------------------------------------- API
@app.after_request
def cors(resp):
    resp.headers["Access-Control-Allow-Origin"] = "*"
    resp.headers["Access-Control-Allow-Headers"] = "Content-Type, X-Token"
    resp.headers["Access-Control-Allow-Methods"] = "GET, PUT, POST, OPTIONS"
    return resp


@app.route("/api/state", methods=["GET", "PUT", "OPTIONS"])
def api_state():
    if request.method == "OPTIONS":
        return "", 204
    if not autorizado():
        return jsonify(erro="token inválido"), 401
    if request.method == "GET":
        return jsonify(state=ler_json(ESTADO, None))
    novo = request.get_json(silent=True)
    if not validar(novo):
        return jsonify(erro="estado inválido"), 400
    with trava:
        atual = ler_json(ESTADO, None)
        if validar(atual) and atual.get("updatedAt", 0) > novo.get("updatedAt", 0):
            return jsonify(erro="o servidor tem uma versão mais nova", state=atual), 409
        gravar_json(ESTADO, novo)
    return jsonify(ok=True)


@app.route("/api/teste", methods=["POST", "OPTIONS"])
def api_teste():
    if request.method == "OPTIONS":
        return "", 204
    if not autorizado():
        return jsonify(erro="token inválido"), 401
    estado = ler_json(ESTADO, None)
    topico = ((estado or {}).get("settings", {}).get("ntfyTopic") or "").strip()
    if not topico:
        return jsonify(erro="Defina o tópico ntfy em Configurações e salve."), 400
    try:
        enviar_ntfy(topico, "Lembrancinha do orador", "Teste: o push do servidor está funcionando.")
    except Exception as e:
        return jsonify(erro=f"Falha ao enviar: {e}"), 502
    return jsonify(ok=True)


@app.route("/api/saude")
def saude():
    return jsonify(ok=True, agora=datetime.now(TZ).isoformat())


# ---------------------------------------------------------------- site estático
@app.route("/")
def raiz():
    return send_from_directory(RAIZ, "index.html")


@app.route("/<path:caminho>")
def estaticos(caminho):
    if caminho.split("/")[0] not in {"css", "js", "assets"}:
        return "", 404
    return send_from_directory(RAIZ, caminho)


_agendador_iniciado = False


def iniciar_agendador():
    """Thread que verifica a cada 30 s se há lembrete a enviar (idempotente: cada horário é enviado uma vez)."""
    global _agendador_iniciado
    if _agendador_iniciado:
        return
    _agendador_iniciado = True

    def laco():
        parar = threading.Event()
        while not parar.wait(30):
            try:
                verificar_lembretes()
            except Exception as e:  # nunca derruba o servidor
                app.logger.warning("Erro no agendador: %s", e)

    threading.Thread(target=laco, daemon=True, name="lembretes").start()


# Inicia junto com o servidor (python app.py ou gunicorn com 1 worker).
if os.environ.get("LOD_SEM_AGENDADOR") != "1":
    iniciar_agendador()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=int(os.environ.get("PORT", 5000)))
