# Lembrancinha do Orador

Sistema web para escolher, a cada semana, a família que entrega a lembrancinha ao orador no sábado.
Rodízio entre os 6 grupos, prioridade para quem está há mais tempo sem entregar, bolinhas de semáforo em cada família,
agendamento de sábados futuros, sábados sem reunião, confirmação sempre manual, histórico permanente, calendário, WhatsApp e lembretes.

## O que funciona e o que depende de quê

| Funcionalidade | Precisa de | Observação |
|---|---|---|
| Painel, sugestão automática, rodízio, confirmação, histórico, calendário, grupos, backup | Só abrir `index.html` (ou hospedar os arquivos) | Dados ficam no navegador (LocalStorage) |
| Botão **Verificar família** (WhatsApp) | Nada | Abre `wa.me` com a mensagem preenchida; **você** envia |
| Lembretes do navegador | Site/navegador aberto + permissão | **Não** funcionam com o navegador fechado ou o aparelho desligado |
| Lembretes com o site fechado | Backend (pasta `backend/`) hospedado + app **ntfy** no celular | Veja “Lembretes de verdade” |
| Dados iguais no computador e no celular | Backend hospedado | Sem ele, cada navegador tem seus próprios dados |
| Google Calendar | — | **Não há sincronização.** Há atalhos reais: botão “Google Calendar” (abre o evento já preenchido) e arquivo `.ics` |

### Por que não há sincronização com o Google Calendar
Sincronizar de verdade exige um projeto no Google Cloud, tela de consentimento OAuth, credenciais e um servidor para guardar
o token de acesso. Para uma pessoa usando o sistema, o benefício é pequeno e os lembretes confiáveis já vêm do ntfy.
Em vez de simular, o sistema oferece o link de evento do Google Calendar e o `.ics` (reimportar o mesmo `.ics`
atualiza o evento, porque o identificador é fixo). Se quiser a integração completa, dá para acrescentar depois.

## Como executar

### Opção A — só o site (mais simples)
1. Abra `index.html` no navegador **ou** hospede a pasta em qualquer hospedagem estática (GitHub Pages, Netlify…).
2. Pronto. Dados ficam neste navegador. Faça backup em **Configurações → Exportar backup**.

### Opção B — com backend (sincronização + lembretes com o site fechado)
```bash
cd backend
python -m venv .venv && source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
export APP_TOKEN="uma-senha-qualquer"     # recomendado; Windows: set APP_TOKEN=...
python app.py                              # abre em http://localhost:5000
```
Em produção use `gunicorn -w 1 -b 0.0.0.0:5000 app:app` (**um único worker**, para o agendador não duplicar).
O servidor precisa ficar ligado 24h (Render, Railway, Fly.io, VPS ou um Raspberry Pi em casa). O arquivo de dados fica em
`backend/dados/state.json` — em hospedagens com disco efêmero, configure um volume persistente e aponte `DATA_DIR` para ele.

O próprio servidor entrega o site: acesse o endereço dele no computador e no celular. Se você hospedar o site em outro lugar,
em **Configurações → Servidor** informe o endereço do backend e o token.

## Lembretes de verdade (site fechado)
1. Instale o app **ntfy** no celular (Android/iPhone, gratuito) e assine um tópico difícil de adivinhar, ex.: `lembrancinha-gustavo-x7k2`.
2. No sistema, **Configurações → Lembretes**: preencha o tópico, salve e clique em **Testar push do servidor**.
3. O servidor confere a cada 30 segundos. De **quarta a sábado**, às **08h, 11h, 14h, 17h e 20h** (horas editáveis, fuso `America/Sao_Paulo`),
   envia um push **enquanto o sábado alvo não tiver família confirmada**. Cada horário é enviado uma única vez.
4. Abrir o site, ver ou tocar na notificação **não cancela nada**. Só **confirmar uma família** encerra os lembretes da semana;
   na semana seguinte eles voltam na quarta às 08h.

Observação: o tópico do ntfy.sh público é um “segredo por obscuridade”; quem souber o nome pode ler os avisos. As mensagens
só dizem a data e o grupo da vez, sem nomes de famílias. Se preferir, é possível hospedar o próprio ntfy (`NTFY_URL`).

## Regras implementadas

- **Rodízio**: Elizeu → Rafael → Alvimar → Cleiber → Gracy → William → Elizeu… O **grupo da semana** de qualquer sábado (inclusive futuro)
  é o grupo seguinte ao da entrega mais recente antes daquele sábado. Sábados sem família ou sem reunião não avançam o rodízio.
  Definir ou pular o grupo da vez só em **Configurações → Rodízio** (ação administrativa, registrada); vale a partir do próximo sábado em aberto.
- **Escolha livre**: mesmo sendo a vez de um grupo, você pode confirmar **qualquer família de qualquer grupo**. Aparece apenas um aviso
  informando que ela é de outro grupo. O rodízio continua a partir do grupo da família escolhida.
- **Navegar entre semanas**: no painel, as setas ‹ › ao lado da data de entrega mudam o sábado exibido (status, grupo da semana, sugestão e bolinhas acompanham). “Voltar ao próximo sábado” retorna ao padrão.
- **Escolher o presenteador**: no modal de **Sugestão de família** há dois seletores, **grupo** (Grupo Elizeu, Grupo Rafael…) e **família** do grupo escolhido. Ao trocar o grupo, a melhor família dele é pré-selecionada. No modal **Detalhes da família** (aberto ao tocar numa família) esses dois seletores não aparecem.
- **Agendar sábados futuros**: no modal da família há o seletor **Sábado da entrega** (próximos 26 sábados). Trocar o sábado na
  *Sugestão* sugere de novo a família do grupo daquela semana. Também dá para clicar em qualquer sábado no **Calendário**.
- **Sábado sem reunião**: no Calendário, clique no sábado → **Marcar sem reunião**. O dia não precisa de família, não recebe sugestão, não
  gera lembrete (navegador nem ntfy) e não avança o rodízio. Dá para desfazer (**Voltar a ter reunião**). Se o sábado já tem família
  confirmada, desfaça a confirmação antes.
- **Bolinhas** (no fim de cada linha de família, em relação ao próximo sábado; no modal, em relação ao sábado escolhido). Usa a entrega
  mais próxima no tempo, passada ou já agendada:
  - 🔴 **vermelho**: entregou na semana passada ou retrasada (até 14 dias), ou já está agendada perto desse sábado — não cogitar;
  - 🟡 **amarelo**: entre 2 semanas e 1 mês e meio (45 dias) — corresponde às primeiras semanas do mês e às duas últimas semanas do mês anterior; evitar se possível;
  - 🟢 **verde**: mais de 1 mês e meio, ou nunca participou — pode ser cogitada.
  *Os limites são por dias (14 e 45), e não por mês do calendário, para não deixar “buracos” entre as cores.*
- **Sábado alvo**: o sábado de hoje (se hoje for sábado) ou o próximo. No domingo ele passa para o sábado seguinte.
- **Prioridade da sugestão**: dentro do grupo da semana daquele sábado, famílias com bolinha vermelha só entram se não houver outra; depois,
  quem nunca participou vem primeiro e, em seguida, quem tem a entrega mais antiga (considera todo o histórico). Empate: menos entregas, depois ordem de cadastro.
- **Família do responsável**: só é considerada depois das demais. Ela é sugerida quando esperou pelo menos **N semanas a mais**
  que a melhor das outras (padrão **N = 4**, ajustável em Configurações; 0 = igual às outras) ou quando é a única do grupo.
  *Esta regra de “quanto a mais” é uma decisão de implementação, porque o pedido não define o número.*
- **Confirmação manual**: sugerir, abrir o modal ou clicar em “Verificar família” nunca registra nada. Um sábado só aceita uma família.
- **Alerta**: ao confirmar uma família que já entregou no mesmo mês (antes do sábado escolhido) ou que está com bolinha vermelha para aquele sábado,
  aparece o aviso com VOLTAR / CONTINUAR MESMO ASSIM.
- **Histórico**: nunca perde registros. Famílias excluídas ficam “inativas” e suas entregas permanecem; entregas guardam o nome da
  família e do grupo da época. Há marcação “Entrega realizada” separada de “Confirmada”.
- **Registrar entrega anterior**: traz o histórico antigo (recomendado no primeiro uso).
- **Dados antigos**: backups e dados salvos por versões anteriores são migrados automaticamente (campos `semReuniao` e ajustes de rodízio).

## Primeiros passos recomendados
1. **Grupos** → para cada grupo, preencha o nome do responsável e escolha a família dele (não presumimos que sejam iguais).
2. **Histórico → Registrar entrega anterior**: lance as últimas entregas que você lembrar (começando pelas mais antigas ou em qualquer ordem).
3. Confira o grupo da vez em **Configurações → Rodízio** e ajuste se necessário.

## Backup e atualização
- **Backup**: Configurações → *Exportar backup (JSON)*. **Restaurar**: *Importar backup…* — o arquivo é validado, o sistema mostra o que será
  substituído e guarda uma cópia do estado atual no navegador antes da troca.
- **Atualizar o sistema**: exporte um backup, substitua os arquivos (`css/`, `js/`, `index.html`, `backend/app.py`), recarregue com Ctrl+F5.
  Os dados não ficam nos arquivos do sistema (ficam no navegador e em `backend/dados/`), então não são apagados.
- Com backend, os dados também ficam em `backend/dados/state.json`; faça cópia desse arquivo periodicamente.

## Testes
```bash
node tests/selecao.test.js                  # rodízio, prioridade, responsável, alertas, confirmação, agendamento futuro, sem reunião, bolinhas, histórico, backup
LOD_SEM_AGENDADOR=1 python tests/backend_test.py   # API e regra dos lembretes (quarta 08h, repetição, parada após confirmar, sábado sem reunião)
```

## Estrutura
```
index.html
css/style.css, responsive.css
js/datas.js        datas e fuso America/Sao_Paulo
js/grupos.js       dados iniciais (38 famílias) e cadastro
js/selecao.js      rodízio, sugestão, confirmação, alertas (lógica pura)
js/armazenamento.js LocalStorage, sincronização com o backend, backup/validação
js/whatsapp.js     link wa.me com encodeURIComponent
js/ui.js           modais, detalhes da família, fluxo de confirmação
js/historico.js    histórico, filtros, participações
js/calendario.js   calendário, .ics, link do Google Calendar
js/notificacoes.js lembretes do navegador
js/app.js          painel, grupos, configurações, rotas
backend/app.py     API + lembretes (Flask)
tests/             testes automatizados
```

## Limitações conhecidas
- Notificações do navegador não disparam com o navegador fechado (por isso existe o backend + ntfy).
- Sem backend, o LocalStorage é por navegador/aparelho; limpar os dados do site apaga tudo (use o backup).
- Há um único usuário: sem login. O backend aceita um token simples (`APP_TOKEN`), mas isso não é um sistema de contas.

## App Android (APK, Android 13+)
O app é o mesmo site embalado com Capacitor. Dentro dele, as lembranças viram **notificações nativas do Android**, que tocam
**com o app fechado**: de **quarta a sábado**, nas horas de Configurações → Lembretes (padrão 08h, 11h, 14h, 17h, 20h), para cada
sábado ainda **sem família confirmada**. Só **confirmar a família** cancela as notificações daquele sábado; abrir o app ou tocar na
notificação não cancela nada. O app agenda os próximos 6 sábados e reagenda toda vez que é aberto ou que algo muda.

Gerar o APK sem instalar nada: suba esta pasta para um repositório do GitHub → aba **Actions → Gerar APK → Run workflow** →
baixe `app-debug.apk` em *Artifacts*. Ou localmente (Node 20, JDK 17, Android SDK): `npm install && npm run android:preparar && npm run android:apk`
(o APK sai em `android/app/build/outputs/apk/debug/`).
No celular: permita instalar apps desconhecidos, instale o APK e, na primeira abertura, **permita as notificações**.
Se o Android pedir, em Configurações do app → Bateria, deixe **Sem restrições** e permita **Alarmes e lembretes**.
No app, os dados ficam só no aparelho (modo local); para sincronizar com o backend, informe o endereço em Configurações → Servidor.
