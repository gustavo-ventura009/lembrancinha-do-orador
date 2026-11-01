/* Lembretes no navegador: quarta a sábado, nos horários configurados, até haver família confirmada.
   Só funcionam com o site aberto (ou o navegador em segundo plano). Para lembretes com o site fechado, use o backend. */
(function (root) {
  const LOD = (root.LOD = root.LOD || {});
  const D = () => LOD.datas, ST = () => LOD.store, S = () => LOD.selecao;
  const KEY = 'lod_lembrete_ultimo';
  const lsGet = (k) => { try { return root.localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { root.localStorage.setItem(k, v); } catch (e) {} };

  /** Estado dos lembretes para o momento atual (função pura, testável). */
  function situacao(state, agora, hojeIso) {
    const sab = D().proximoSabado(hojeIso);
    if (S().entregaDoSabado(state, sab) || S().semReuniao(state, sab)) return { ativo: false, sab };
    if (agora.weekday < 3 || agora.weekday > 6) return { ativo: false, sab };
    const horas = [...state.settings.lembreteHoras].sort((a, b) => a - b);
    const passadas = horas.filter((h) => h <= agora.hour);
    if (!passadas.length) return { ativo: false, sab };
    const hora = passadas[passadas.length - 1];
    return { ativo: true, sab, hora, chave: `${sab}|${hojeIso}|${hora}` };
  }

  const N = {
    situacao,
    permissao() { return 'Notification' in root ? Notification.permission : 'indisponivel'; },
    async pedirPermissao() {
      if (!('Notification' in root)) return 'indisponivel';
      return Notification.requestPermission();
    },
    disparar(sit, nomeGrupo) {
      const titulo = 'Lembrancinha do orador';
      const corpo = `Ainda não há família confirmada para o sábado ${D().br(sit.sab)}. Vez do ${LOD.grupos.rotulo(nomeGrupo)}.`;
      if (ST().state.settings.notificacoesNavegador && N.permissao() === 'granted') {
        try { new Notification(titulo, { body: corpo, tag: 'lod-' + sit.chave }); } catch (e) {}
      }
    },
    verificar() {
      const state = ST().state;
      const agora = D().agora();
      const sit = situacao(state, agora, agora.iso);
      const banner = document.getElementById('banner-lembrete');
      if (!sit.ativo) { banner.hidden = true; return; }
      const g = S().grupoDaVez(state);
      banner.hidden = false;
      banner.querySelector('.banner-txt').textContent = `Falta confirmar a família do sábado ${D().br(sit.sab)} — vez do ${LOD.grupos.rotulo(g.name)}.`;
      if (lsGet(KEY) !== sit.chave) { lsSet(KEY, sit.chave); N.disparar(sit, g.name); }
    },
    iniciar() {
      N.verificar();
      setInterval(N.verificar, 30000);
      document.addEventListener('visibilitychange', () => { if (!document.hidden) N.verificar(); });
      ST().aoMudar(N.verificar);
    }
  };
  LOD.notificacoes = N;
  if (typeof module !== 'undefined') module.exports = N;
})(typeof window !== 'undefined' ? window : globalThis);
