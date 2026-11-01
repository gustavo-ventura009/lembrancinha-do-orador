import sys, os, json, tempfile
os.environ["DATA_DIR"] = tempfile.mkdtemp()
os.environ.setdefault("LOD_SEM_AGENDADOR", "1")
RAIZ = os.path.abspath(os.path.join(os.path.dirname(os.path.abspath(__file__)), ".."))
sys.path.insert(0, os.path.join(RAIZ, "backend"))
import app as A
from datetime import datetime
node = json.loads(os.popen("node -e \"require('" + RAIZ + "/js/datas.js');require('" + RAIZ + "/js/grupos.js');console.log(JSON.stringify(globalThis.LOD.grupos.estadoInicial()))\"").read())
node["settings"]["ntfyTopic"] = "teste-x"
c = A.app.test_client()
assert c.put("/api/state", json=node).status_code == 200
assert c.get("/api/state").json["state"]["groups"][0]["name"] == "Elizeu"
assert c.put("/api/state", json={"x": 1}).status_code == 400
env = []
f = lambda t, ti, tx: env.append(tx)
tz = A.TZ
assert A.verificar_lembretes(datetime(2026,11,3,10,0,tzinfo=tz), f) == "nada-a-enviar"   # terça
assert A.verificar_lembretes(datetime(2026,11,4,7,59,tzinfo=tz), f) == "nada-a-enviar"   # quarta antes das 08:00
assert A.verificar_lembretes(datetime(2026,11,4,8,0,tzinfo=tz), f) == "enviado"           # quarta 08:00
assert A.verificar_lembretes(datetime(2026,11,4,8,30,tzinfo=tz), f) == "ja-enviado"
assert A.verificar_lembretes(datetime(2026,11,4,11,0,tzinfo=tz), f) == "enviado"
assert A.verificar_lembretes(datetime(2026,11,5,8,0,tzinfo=tz), f) == "enviado"           # quinta continua
node["deliveries"].append({"id":"d1","saturday":"2026-11-07","familyId":"f-001","familyName":"x","groupId":"g-elizeu","groupName":"Elizeu"})
node["updatedAt"] = 5
assert c.put("/api/state", json=node).status_code == 200
assert A.verificar_lembretes(datetime(2026,11,5,14,0,tzinfo=tz), f) == "nada-a-enviar"    # confirmada: para
assert A.verificar_lembretes(datetime(2026,11,11,8,0,tzinfo=tz), f) == "enviado"          # semana seguinte volta
node["semReuniao"] = ["2026-11-14"]; node["updatedAt"] = 6
assert c.put("/api/state", json=node).status_code == 200
assert A.verificar_lembretes(datetime(2026,11,11,11,0,tzinfo=tz), f) == "nada-a-enviar"    # sábado 14/11 sem reunião: não lembra
assert A.verificar_lembretes(datetime(2026,11,18,8,0,tzinfo=tz), f) == "enviado"          # sábado 21/11 normal: volta
assert c.get("/").status_code == 200 and c.get("/js/app.js").status_code == 200 and c.get("/backend/app.py").status_code == 404
print("backend OK;", len(env), "pushes simulados;", env[0])
