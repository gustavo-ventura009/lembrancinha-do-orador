/* Ponte com o app Android (Capacitor): agenda notificações NATIVAS, que tocam com o app fechado.
   Regras: de quarta a sábado, nas horas configuradas, para cada sábado ainda SEM família confirmada.
   Confirmar a família do sábado cancela as notificações dele. Abrir o app ou tocar na notificação não cancela nada. */
(function (root) {
  const LOD = (root.LOD = root.LOD || {});
  const D = () => LOD.datas, ST = () => LOD.store, S = () => LOD.selecao, G = () => LOD.grupos;
  const CANAL = 'lembretes-orador-v3';   // canal novo: o Android não deixa alterar um canal já criado
  const CANAIS_ANTIGOS = ['lembretes-orador', 'lembretes-orador-v2'];
  const SEMANAS = 6;        // quantos sábados à frente ficam agendados (reagenda a cada abertura do app)
  const UTC_MENOS_3 = 3;    // America/Sao_Paulo é UTC-3 o ano todo (sem horário de verão desde 2019)

  /** Lista pura e testável das notificações a agendar. Retorna [{id, quando(Date), sab, grupo}]. */
  function agenda(state, agoraMs, hojeIso) {
    const horarios = [...new Set(state.settings.lembreteHoras.map((h) => G().horarioTexto(h)))].sort((a, b) => G().minutosDoHorario(a) - G().minutosDoHorario(b));
    const out = [];
    let sab = D().proximoSabado(hojeIso), primeira = true;
    for (let i = 0; i < SEMANAS; i++, sab = D().addDias(sab, 7)) {
      if (S().entregaDoSabado(state, sab) || S().semReuniao(state, sab)) continue;
      const grupo = primeira ? S().grupoDaSemana(state, sab).name : null;   // semanas seguintes: só a data
      primeira = false;
      for (let k = 3; k >= 0; k--) {               // quarta, quinta, sexta, sábado
        const dia = D().addDias(sab, -k);
        const [y, m, d] = dia.split('-').map(Number);
        horarios.forEach((horario) => {
          const [h, min] = horario.split(':').map(Number);
          const quando = new Date(Date.UTC(y, m - 1, d, h + UTC_MENOS_3, min, 0));
          if (quando.getTime() <= agoraMs) return;
          const minutoDoDia = h * 60 + min;
          out.push({ id: (((((y % 100) * 100 + m) * 100 + d) * 1440) + minutoDoDia), quando, sab, grupo });
        });
      }
    }
    return out;
  }

  const LN = () => root.Capacitor && root.Capacitor.Plugins && root.Capacitor.Plugins.LocalNotifications;
  const nativo = () => !!(root.Capacitor && root.Capacitor.isNativePlatform && root.Capacitor.isNativePlatform() && LN());
  let ocupado = false, repetir = false;

  async function sincronizar() {
    if (!nativo()) return;
    if (ocupado) { repetir = true; return; }
    ocupado = true;
    try {
      const ln = LN();
      let perm = await ln.checkPermissions();
      if (perm.display !== 'granted') perm = await ln.requestPermissions();   // Android 13: POST_NOTIFICATIONS
      if (perm.display !== 'granted') return;
      for (const id of CANAIS_ANTIGOS) { try { await ln.deleteChannel({ id }); } catch (e) {} }
      try { await ln.createChannel({ id: CANAL, name: 'Lembretes da lembrancinha (som e vibração contínuos)', description: 'Avisos persistentes até serem dispensados manualmente', importance: 5, visibility: 1, vibration: true, lights: true }); } catch (e) {}
      const pend = await ln.getPending();
      if (pend.notifications && pend.notifications.length) await ln.cancel({ notifications: pend.notifications.map((n) => ({ id: n.id })) });
      const lista = agenda(ST().state, Date.now(), D().hoje());
      if (lista.length) await ln.schedule({
        notifications: lista.map((n) => ({
          id: n.id, channelId: CANAL, title: 'Lembrancinha do orador',
          body: `Ainda não há família confirmada para o sábado ${D().br(n.sab)}.` + (n.grupo ? ` Vez do ${G().rotulo(n.grupo)}.` : ''),
          autoCancel: false,   // tocar nela não a remove: só sai quando você arrasta para o lado
          smallIcon: 'ic_stat_lembrancinha', schedule: { at: n.quando, allowWhileIdle: true }, extra: { sab: n.sab }
        }))
      });
    } catch (e) { console.warn('Notificações nativas:', e); }
    finally { ocupado = false; if (repetir) { repetir = false; sincronizar(); } }
  }

  /** Teste: dispara uma notificação nativa em 5 segundos (sai da tela do app para ver a notificação chegar). */
  async function testar() {
    const ln = LN();
    let perm = await ln.checkPermissions();
    if (perm.display !== 'granted') perm = await ln.requestPermissions();
    if (perm.display !== 'granted') throw new Error('Notificações bloqueadas: ative em Configurações do Android → Apps → Lembrancinha do Orador → Notificações.');
    try { await ln.createChannel({ id: CANAL, name: 'Lembretes da lembrancinha (som e vibração contínuos)', description: 'Avisos persistentes até serem dispensados manualmente', importance: 5, visibility: 1, vibration: true, lights: true }); } catch (e) {}
    await ln.schedule({ notifications: [{ id: 1, channelId: CANAL, title: 'Lembrancinha do orador', body: 'Teste: as notificações do app Android funcionam.', autoCancel: false, smallIcon: 'ic_stat_lembrancinha', schedule: { at: new Date(Date.now() + 5000), allowWhileIdle: true } }] });
  }

  /** Texto de situação para a tela de Configurações. */
  async function resumo() {
    const ln = LN();
    const perm = (await ln.checkPermissions()).display;
    const lista = agenda(ST().state, Date.now(), D().hoje());
    const permTxt = perm === 'granted' ? 'permitidas' : 'BLOQUEADAS (ative nas configurações do Android)';
    const prox = lista.length ? `${lista.length} lembretes agendados; o próximo é ${LOD.ui.dataHora(lista[0].quando.toISOString())}.` : 'Nenhum lembrete pendente (todos os próximos sábados já têm família ou não têm reunião).';
    return `Notificações do Android: <strong>${permTxt}</strong>. ${prox}`;
  }

  function iniciar() {
    if (!nativo()) return;
    sincronizar();
    ST().aoMudar(sincronizar);   // confirmar/desfazer/marcar sem reunião reagenda (e cancela) na hora
    document.addEventListener('visibilitychange', () => { if (!document.hidden) sincronizar(); });
    LN().addListener('localNotificationActionPerformed', (ev) => {
      const sab = ev && ev.notification && ev.notification.extra && ev.notification.extra.sab;
      if (LOD.app && LOD.app.abrirSugestao) LOD.app.abrirSugestao(sab);   // só abre a tela; não cancela nada
    });
  }

  LOD.android = { agenda, sincronizar, iniciar, testar, resumo, nativo };
  if (typeof module !== 'undefined') module.exports = LOD.android;
})(typeof window !== 'undefined' ? window : globalThis);
