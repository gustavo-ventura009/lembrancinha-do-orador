// node tests/interface.test.js — usa um DOM falso mínimo (sem navegador)
const assert = require('assert');
require('../js/datas.js'); require('../js/grupos.js'); require('../js/selecao.js');
globalThis.LOD.store = { state: globalThis.LOD.grupos.estadoInicial() };
globalThis.LOD.ui = { esc: (s) => String(s), statusEntrega: () => ({ classe: '', texto: '' }), modal() {} };
require('../js/historico.js');
let ok = 0; const t = (n, f) => { f(); ok++; console.log('✔', n); };

t('Histórico não acumula ouvintes de clique no #view a cada renderização', () => {
  let adicionados = 0;
  const campo = { addEventListener() {}, focus() {}, setSelectionRange() {}, value: '' };
  const cont = { innerHTML: '', onclick: null, addEventListener() { adicionados++; }, querySelector: () => campo };
  for (let i = 0; i < 5; i++) globalThis.LOD.historico.render(cont);
  assert.strictEqual(adicionados, 0);            // nenhum addEventListener no #view
  assert.strictEqual(typeof cont.onclick, 'function'); // um único ouvinte, substituído a cada render
});

t('tema: escolher claro/escuro grava a preferência e muda o atributo; auto segue o sistema', () => {
  const attrs = {}; const store = {};
  globalThis.window = undefined;
  const root = globalThis;
  root.document = { documentElement: { setAttribute: (k, v) => (attrs[k] = v) }, querySelector: () => ({ setAttribute() {} }) };
  root.localStorage = { getItem: (k) => (k in store ? store[k] : null), setItem: (k, v) => (store[k] = v) };
  root.matchMedia = () => ({ matches: true, addEventListener() {} });
  delete require.cache[require.resolve('../js/tema.js')];
  const T = require('../js/tema.js');
  assert.strictEqual(T.preferencia(), 'auto'); assert.strictEqual(attrs['data-tema'], 'escuro'); // sistema escuro
  T.definir('claro'); assert.strictEqual(attrs['data-tema'], 'claro'); assert.strictEqual(store.lod_tema, 'claro');
  T.definir('escuro'); assert.strictEqual(attrs['data-tema'], 'escuro');
  T.definir('lixo'); assert.strictEqual(T.preferencia(), 'auto');
});
console.log(`\n${ok} testes passaram.`);
