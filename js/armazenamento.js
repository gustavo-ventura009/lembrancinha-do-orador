/* Armazenamento: LocalStorage sempre; se houver backend acessível, sincroniza o estado com ele. */
(function (root) {
  const LOD = (root.LOD = root.LOD || {});
  const KEY = 'lod_state_v1';
  const KEY_PREV = 'lod_state_antes_da_importacao';
  const lsGet = (k) => { try { return root.localStorage.getItem(k); } catch (e) { return null; } };
  const lsSet = (k, v) => { try { root.localStorage.setItem(k, v); return true; } catch (e) { return false; } };

  function validar(obj) {
    const erros = [];
    if (!obj || typeof obj !== 'object') return ['Arquivo não é um backup válido.'];
    ['groups', 'families', 'deliveries'].forEach((k) => { if (!Array.isArray(obj[k])) erros.push(`Campo "${k}" ausente ou inválido.`); });
    if (!obj.rotation || typeof obj.rotation.nextGroupIndex !== 'number') erros.push('Estado do rodízio ausente.');
    if (!obj.settings || typeof obj.settings !== 'object') erros.push('Configurações ausentes.');
    if (obj.semReuniao !== undefined && (!Array.isArray(obj.semReuniao) || obj.semReuniao.some((x) => !/^\d{4}-\d{2}-\d{2}$/.test(x)))) erros.push('Lista de sábados sem reunião inválida.');
    if (erros.length) return erros;
    const gids = new Set(obj.groups.map((g) => g.id));
    if (gids.size !== obj.groups.length || !obj.groups.length) erros.push('Grupos inválidos ou duplicados.');
    const fids = new Set();
    obj.families.forEach((f) => {
      if (!f.id || !f.name || !gids.has(f.groupId)) erros.push(`Família inválida: ${f.name || f.id}.`);
      if (fids.has(f.id)) erros.push(`Família duplicada: ${f.id}.`);
      fids.add(f.id);
    });
    const sabs = new Set();
    obj.deliveries.forEach((d) => {
      if (!d.id || !/^\d{4}-\d{2}-\d{2}$/.test(d.saturday || '') || !d.familyName) erros.push(`Entrega inválida: ${d.id || '?'}.`);
      if (sabs.has(d.saturday)) erros.push(`Duas entregas no mesmo sábado: ${d.saturday}.`);
      sabs.add(d.saturday);
    });
    return erros.slice(0, 8);
  }

  const store = {
    state: null,
    modo: 'local', // 'local' ou 'servidor'
    ouvintes: [],
    validar,
    backendBase() { return (lsGet('lod_backend') || '').replace(/\/$/, ''); },
    token() { return lsGet('lod_token') || ''; },
    _headers() { const h = { 'Content-Type': 'application/json' }; if (store.token()) h['X-Token'] = store.token(); return h; },
    _url(p) { return store.backendBase() + '/api/' + p; },

    async iniciar() {
      let local = null;
      try { local = JSON.parse(lsGet(KEY)); } catch (e) {}
      if (local && validar(local).length) local = null;
      let remoto = null;
      const podeTentar = store.backendBase() || (root.location && /^https?:/.test(root.location.protocol));
      if (podeTentar) {
        try {
          const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), 2500);
          const r = await fetch(store._url('state'), { headers: store._headers(), signal: ctl.signal });
          clearTimeout(t);
          if (r.ok) { remoto = (await r.json()).state; store.modo = 'servidor'; }
          else if (r.status === 401) store.modo = 'servidor-sem-acesso';
        } catch (e) { /* sem backend: segue no modo local */ }
      }
      if (remoto && validar(remoto).length) remoto = null;
      let escolhido;
      if (remoto && local) escolhido = (local.updatedAt || 0) > (remoto.updatedAt || 0) ? local : remoto;
      else escolhido = remoto || local || LOD.grupos.estadoInicial();
      store.state = LOD.selecao.normalizar(escolhido); // completa campos de versões antigas
      lsSet(KEY, JSON.stringify(store.state));
      if (store.modo === 'servidor' && escolhido !== remoto) store._enviar();
      return store.state;
    },

    /** Chamar depois de qualquer alteração em store.state. */
    salvar() {
      store.state.updatedAt = Date.now();
      const ok = lsSet(KEY, JSON.stringify(store.state));
      if (store.modo === 'servidor') store._enviar();
      store.ouvintes.forEach((fn) => fn());
      return ok;
    },
    async _enviar() {
      try {
        const r = await fetch(store._url('state'), { method: 'PUT', headers: store._headers(), body: JSON.stringify(store.state) });
        store.ultimoEnvio = r.ok ? 'ok' : 'erro ' + r.status;
      } catch (e) { store.ultimoEnvio = 'falhou'; }
    },
    aoMudar(fn) { store.ouvintes.push(fn); },

    /** No navegador baixa o arquivo; no app Android (WebView não baixa Blob) grava no cache e abre o menu de compartilhar. */
    async exportar() {
      const nome = `lembrancinha-backup-${LOD.datas.hoje()}.json`;
      const texto = JSON.stringify(store.state, null, 2);
      const cap = root.Capacitor, plugins = (cap && cap.Plugins) || {};
      if (cap && cap.isNativePlatform && cap.isNativePlatform()) {
        if (!plugins.Filesystem || !plugins.Share) throw new Error('Exportação indisponível nesta versão do app. Instale o APK mais recente.');
        const r = await plugins.Filesystem.writeFile({ path: nome, data: texto, directory: 'CACHE', encoding: 'utf8' });
        await plugins.Share.share({ title: 'Backup da Lembrancinha do Orador', text: nome, url: r.uri, dialogTitle: 'Salvar ou enviar o backup' });
        return;
      }
      const blob = new Blob([texto], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = nome;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    },
    /** Valida e devolve resumo; a substituição só ocorre em aplicarImportacao (após confirmação). */
    lerBackup(texto) {
      let obj;
      try { obj = JSON.parse(texto); } catch (e) { return { erros: ['O arquivo não é um JSON válido.'] }; }
      const erros = validar(obj);
      if (erros.length) return { erros };
      return { obj, resumo: { familias: obj.families.length, entregas: obj.deliveries.length, grupos: obj.groups.length, data: obj.updatedAt ? new Date(obj.updatedAt).toLocaleString('pt-BR', { timeZone: LOD.datas.TZ }) : 'desconhecida' } };
    },
    aplicarImportacao(obj) {
      lsSet(KEY_PREV, JSON.stringify(store.state)); // cópia de segurança do estado atual
      store.state = LOD.selecao.normalizar(obj);
      store.salvar();
    }
  };
  LOD.store = store;
  if (typeof module !== 'undefined') module.exports = store;
})(typeof window !== 'undefined' ? window : globalThis);
