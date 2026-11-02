// node tests/android.test.js
const assert = require('assert');
require('../js/datas.js'); require('../js/grupos.js'); require('../js/selecao.js'); require('../js/android.js');
const { datas: D, grupos: G, selecao: S, android: A } = globalThis.LOD;
const agora = Date.parse('2026-11-01T21:00:00Z'); // domingo 01/11 18:00 em São Paulo
D.setNow(() => new Date(agora));
const st = G.estadoInicial();
let ok = 0; const t = (n, f) => { f(); ok++; console.log('✔', n); };

t('sábado sem família: 5 horários x 4 dias (qua-sáb), primeiro na quarta 04/11 às 08h de Brasília', () => {
  const l = A.agenda(st, agora, '2026-11-01').filter((x) => x.sab === '2026-11-07');
  assert.strictEqual(l.length, 20);
  assert.strictEqual(l[0].quando.toISOString(), '2026-11-04T11:00:00.000Z');
  assert.strictEqual(l[19].quando.toISOString(), '2026-11-07T23:00:00.000Z');
});
t('confirmar a família do sábado remove só as notificações dele', () => {
  const fam = st.families[0];
  S.confirmar(st, fam.id, '2026-11-07', new Date().toISOString());
  const l = A.agenda(st, agora, '2026-11-01');
  assert.ok(!l.some((x) => x.sab === '2026-11-07'));
  assert.ok(l.some((x) => x.sab === '2026-11-14'));
});
t('sábado sem reunião não agenda; ids únicos; nada no passado', () => {
  S.marcarSemReuniao ? S.marcarSemReuniao(st, '2026-11-14') : st.semReuniao.push('2026-11-14');
  const l = A.agenda(st, agora, '2026-11-01');
  assert.ok(!l.some((x) => x.sab === '2026-11-14'));
  assert.strictEqual(new Set(l.map((x) => x.id)).size, l.length);
  assert.ok(l.every((x) => x.quando.getTime() > agora));
});
t('nome do grupo só na primeira semana pendente', () => {
  const st2 = G.estadoInicial();
  const l = A.agenda(st2, agora, '2026-11-01');
  assert.ok(l.filter((x) => x.sab === '2026-11-07').every((x) => x.grupo));
  assert.ok(l.filter((x) => x.sab !== '2026-11-07').every((x) => x.grupo === null));
});
console.log(`\n${ok} testes passaram.`);
