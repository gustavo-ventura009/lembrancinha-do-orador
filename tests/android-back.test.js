// node tests/android-back.test.js
const assert = require('assert');
require('../js/android.js');
const A = globalThis.LOD.android;
let backs = 0, exits = 0, fechados = 0, modais = false;
globalThis.LOD.ui = {
  temModal: () => modais,
  fecharUltimo: () => { fechados++; modais = false; }
};
globalThis.history = { back: () => { backs++; } };
globalThis.location = { hash: '#/historico' };
const app = { exitApp: () => { exits++; } };
assert.strictEqual(A.tratarVoltar(true, app), 'historico');
assert.strictEqual(backs, 1);
assert.strictEqual(exits, 0);
modais = true;
assert.strictEqual(A.tratarVoltar(true, app), 'modal');
assert.strictEqual(fechados, 1);
assert.strictEqual(backs, 1);
assert.strictEqual(A.tratarVoltar(false, app), 'painel');
assert.strictEqual(location.hash, '#/painel');
location.hash = '#/painel';
assert.strictEqual(A.tratarVoltar(false, app), 'sair');
assert.strictEqual(exits, 1);
console.log('4 verificações do botão Voltar passaram.');
