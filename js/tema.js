/* Tema claro/escuro. Preferência guardada só neste aparelho: "claro", "escuro" ou "auto" (segue o celular). */
(function (root) {
  const LOD = (root.LOD = root.LOD || {});
  const KEY = 'lod_tema', VALIDOS = ['claro', 'escuro', 'auto'];
  const ler = () => { try { const v = root.localStorage.getItem(KEY); return VALIDOS.includes(v) ? v : 'auto'; } catch (e) { return 'auto'; } };
  const escuroNoSistema = () => !!(root.matchMedia && root.matchMedia('(prefers-color-scheme: dark)').matches);
  const resolver = (pref) => (pref === 'auto' ? (escuroNoSistema() ? 'escuro' : 'claro') : pref);

  function aplicar(pref) {
    const t = resolver(pref || ler());
    const doc = root.document; if (!doc) return t;
    doc.documentElement.setAttribute('data-tema', t);
    const meta = doc.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute('content', t === 'escuro' ? '#0e1421' : '#14274e');
    return t;
  }
  function definir(pref) {
    if (!VALIDOS.includes(pref)) pref = 'auto';
    try { root.localStorage.setItem(KEY, pref); } catch (e) {}
    return aplicar(pref);
  }
  if (root.matchMedia) {
    const mq = root.matchMedia('(prefers-color-scheme: dark)');
    const aoMudar = () => { if (ler() === 'auto') aplicar('auto'); };
    if (mq.addEventListener) mq.addEventListener('change', aoMudar); else if (mq.addListener) mq.addListener(aoMudar);
  }
  LOD.tema = { preferencia: ler, definir, aplicar, resolver, VALIDOS };
  aplicar();
  if (typeof module !== 'undefined') module.exports = LOD.tema;
})(typeof window !== 'undefined' ? window : globalThis);
