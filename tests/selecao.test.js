// Testes das regras de negócio: node tests/selecao.test.js
const assert = require('assert');
require('../js/datas.js'); require('../js/grupos.js'); require('../js/selecao.js');
const { datas: D, grupos: G, selecao: S } = globalThis.LOD;

let ok = 0;
const t = (nome, fn) => { fn(); ok++; console.log('✔', nome); };
const novo = () => G.estadoInicial();
const fixarElizeu = (s) => S.definirGrupoDaVez(s, 'g-elizeu', 'x'); // entregas inseridas "na mão" mudam o rodízio; isto devolve a vez ao Elizeu
const HOJE = '2026-11-01'; // domingo
D.setNow(() => new Date('2026-11-01T21:00:00Z'));

t('38 famílias e 6 grupos cadastrados', () => {
  const s = novo(); assert.strictEqual(s.families.length, 38); assert.strictEqual(s.groups.length, 6);
});
t('próximo sábado calculado (domingo 01/11 -> 07/11); sábado -> ele mesmo', () => {
  assert.strictEqual(D.proximoSabado('2026-11-01'), '2026-11-07');
  assert.strictEqual(D.proximoSabado('2026-11-07'), '2026-11-07');
  assert.strictEqual(D.proximoSabado('2026-11-06'), '2026-11-07');
});
t('semanas desde: 0, 1, 2', () => {
  assert.strictEqual(D.semanasDesde('2026-11-01', '2026-11-01'), 0);
  assert.strictEqual(D.semanasDesde('2026-10-24', '2026-11-01'), 1);
  assert.strictEqual(D.semanasDesde('2026-10-17', '2026-11-01'), 2);
});
t('rodízio: 7 semanas seguidas percorrem os 6 grupos e voltam ao primeiro', () => {
  const s = novo(); let sab = '2026-01-03'; const vistos = [];
  for (let i = 0; i < 7; i++) {
    const sug = S.sugerir(s, sab, sab);
    vistos.push(sug.grupo.name);
    S.confirmar(s, sug.familia.id, sab, 'x');
    sab = D.addDias(sab, 7);
  }
  assert.deepStrictEqual(vistos, ['Elizeu', 'Rafael', 'Alvimar', 'Cleiber', 'Gracy', 'William', 'Elizeu']);
  for (let i = 1; i < s.deliveries.length; i++) assert.notStrictEqual(s.deliveries[i].groupId, s.deliveries[i - 1].groupId);
});
t('semana passada sem confirmação não avança o rodízio: o grupo da vez continua o mesmo', () => {
  const s = novo();
  D.setNow(() => new Date('2026-11-08T15:00:00Z')); // domingo: o sábado 07/11 passou sem registro
  try { assert.strictEqual(S.sugerir(s, '2026-11-14', '2026-11-08').grupo.name, 'Elizeu'); }
  finally { D.setNow(() => new Date('2026-11-01T21:00:00Z')); }
});
t('semanas à frente mostram o grupo seguinte do rodízio (projeção), sem confirmar nada', () => {
  const s = novo();
  const nomes = ['2026-11-07', '2026-11-14', '2026-11-21', '2026-11-28', '2026-12-05', '2026-12-12', '2026-12-19']
    .map((d) => S.grupoDaSemana(s, d).name);
  assert.deepStrictEqual(nomes, ['Elizeu', 'Rafael', 'Alvimar', 'Cleiber', 'Gracy', 'William', 'Elizeu']);
});
t('projeção pula sábado sem reunião e respeita entrega já agendada mais à frente', () => {
  const s = novo();
  S.marcarSemReuniao(s, '2026-11-14');
  assert.strictEqual(S.grupoDaSemana(s, '2026-11-21').name, 'Rafael');   // 14/11 não avança
  const fam = G.familiasAtivas(s, 'g-alvimar')[0];
  S.confirmar(s, fam.id, '2026-11-21', 'x');                              // agendada: Alvimar em 21/11
  assert.strictEqual(S.grupoDaSemana(s, '2026-11-28').name, 'Rafael');    // Alvimar entregou na vez do Rafael: a vez volta ao Rafael
});
t('nunca participou tem prioridade; depois, a mais antiga; ordem de cadastro desempata', () => {
  const s = novo();
  const el = G.familiasAtivas(s, 'g-elizeu');
  assert.strictEqual(S.sugerir(s, '2026-11-07', HOJE).familia.id, el[0].id);
  s.deliveries.push({ id: 'a', saturday: '2026-03-07', familyId: el[0].id, familyName: el[0].name, groupId: 'g-elizeu', groupName: 'Elizeu' });
  fixarElizeu(s);
  assert.strictEqual(S.sugerir(s, '2026-11-07', HOJE).familia.id, el[1].id);
  el.slice(1).forEach((f, i) => s.deliveries.push({ id: 'b' + i, saturday: D.addDias('2026-02-07', i * 7), familyId: f.id, familyName: f.name, groupId: 'g-elizeu', groupName: 'Elizeu' }));
  // todas já participaram: a mais antiga é a de 07/02 (el[1]) — mas a de 07/03 (el[0]) é mais recente
  assert.strictEqual(S.sugerir(s, '2026-11-07', HOJE).familia.id, el[1].id);
});
t('família do responsável tem prioridade menor, mas pode ser sugerida depois de esperar mais', () => {
  const s = novo();
  const el = G.familiasAtivas(s, 'g-elizeu');
  G.definirResponsavel(s, 'g-elizeu', 'Fulano', el[0].id);
  // ninguém participou: responsável (el[0]) NÃO é a primeira
  assert.strictEqual(S.sugerir(s, '2026-11-07', HOJE).familia.id, el[1].id);
  // as outras 4 participaram em 2026-09; responsável nunca participou -> passa a ser sugerida
  el.slice(1).forEach((f, i) => s.deliveries.push({ id: 'c' + i, saturday: D.addDias('2026-09-05', i * 7), familyId: f.id, familyName: f.name, groupId: 'g-elizeu', groupName: 'Elizeu' }));
  fixarElizeu(s);
  assert.strictEqual(S.sugerir(s, '2026-11-07', HOJE).familia.id, el[0].id);
  // responsável participou há pouco (menos de 4 semanas mais antigo que a melhor das demais): outra é sugerida
  s.deliveries.push({ id: 'r', saturday: '2026-09-05', familyId: el[0].id, familyName: el[0].name, groupId: 'g-elizeu', groupName: 'Elizeu' });
  assert.strictEqual(S.sugerir(s, '2026-11-07', HOJE).familia.id, el[1].id);
  // a única família ativa do grupo é a do responsável: ainda pode ser sugerida
  el.slice(1).forEach((f) => G.removerFamilia(s, f.id));
  assert.strictEqual(S.sugerir(s, '2026-11-07', HOJE).familia.id, el[0].id);
});
t('somente uma família por sábado', () => {
  const s = novo(); const f = s.families;
  S.confirmar(s, f[0].id, '2026-11-07', 'x');
  assert.throws(() => S.confirmar(s, f[1].id, '2026-11-07', 'x', { retroativa: true }), /Já existe/);
  assert.strictEqual(S.sugerir(s, '2026-11-07', HOJE).confirmada.familyId, f[0].id);
});
t('confirmar exige sábado; família de outro grupo pode ser escolhida mesmo fora da vez', () => {
  const s = novo();
  assert.throws(() => S.confirmar(s, s.families[0].id, '2026-11-06', 'x'), /sábado/);
  const outro = G.familiasAtivas(s, 'g-rafael')[0];           // a vez é do Elizeu
  const d = S.confirmar(s, outro.id, '2026-11-07', 'x');
  assert.strictEqual(d.groupName, 'Rafael');
  assert.strictEqual(S.grupoDaVez(s).name, 'Elizeu');         // Rafael entregou na vez do Elizeu: a vez do Elizeu continua
});
t('família de outro grupo não faz o rodízio saltar semanas: preserva o grupo previsto', () => {
  const s = novo();
  S.definirGrupoDaVez(s, 'g-rafael', 'x');
  const sab = S.primeiroSabadoAberto(s, HOJE);
  const alvimar = G.familiasAtivas(s, 'g-alvimar')[0];
  const d = S.confirmar(s, alvimar.id, sab, 'x');
  assert.strictEqual(d.groupName, 'Alvimar'); // grupo real da família escolhida permanece no histórico
  assert.strictEqual(d.rotationGroupName, 'Rafael'); // grupo que era da semana
  assert.strictEqual(S.grupoDaSemana(s, D.addDias(sab, 7)).name, 'Rafael'); // Alvimar entregou na vez do Rafael: volta para o Rafael, não pula para o Cleiber
});
t('rodízio: entrega de outro grupo não consome a vez; grupo que já entregou fora da vez é pulado depois', () => {
  const s = novo();
  const fam = (g) => G.familiasAtivas(s, g)[0].id;
  // vez do Elizeu, mas entrega alguém do Rafael -> a vez do Elizeu continua
  S.confirmar(s, fam('g-rafael'), '2026-11-07', 'x');
  assert.strictEqual(S.grupoDaSemana(s, '2026-11-14').name, 'Elizeu');
  // Elizeu entrega na sua vez; o Rafael já entregou, então pula para o Alvimar
  S.confirmar(s, fam('g-elizeu'), '2026-11-14', 'x');
  assert.strictEqual(S.grupoDaSemana(s, '2026-11-21').name, 'Alvimar');
  assert.strictEqual(S.grupoDaSemana(s, '2026-11-28').name, 'Cleiber');
});
t('rodízio: grupo anterior à vez que entrega fora de hora não atrasa o grupo da vez nem é pulado no ciclo seguinte', () => {
  const s = novo();
  S.definirGrupoDaVez(s, 'g-rafael', 'x');
  S.confirmar(s, G.familiasAtivas(s, 'g-elizeu')[0].id, '2026-11-07', 'x'); // vez do Rafael, entrega Elizeu
  assert.strictEqual(S.grupoDaSemana(s, '2026-11-14').name, 'Rafael');       // volta para o Rafael
  S.confirmar(s, G.familiasAtivas(s, 'g-rafael')[1].id, '2026-11-14', 'x');
  const nomes = ['2026-11-21', '2026-11-28', '2026-12-05', '2026-12-12', '2026-12-19'].map((d) => S.grupoDaSemana(s, d).name);
  assert.deepStrictEqual(nomes, ['Alvimar', 'Cleiber', 'Gracy', 'William', 'Elizeu']); // Elizeu não é pulado no próximo ciclo
});

t('alerta de participação recente no mesmo mês', () => {
  const s = novo(); const f = s.families[0];
  S.confirmar(s, f.id, '2026-11-07', 'x');
  const a = S.alertaRecente(s, f.id, '2026-11-14', '2026-11-08');
  assert.strictEqual(a.data, '2026-11-07'); assert.strictEqual(a.semanas, 0);
  assert.strictEqual(S.alertaRecente(s, f.id, '2026-12-05', '2026-11-08'), null);
});
t('histórico preservado ao remover/transferir família', () => {
  const s = novo(); const f = s.families[0];
  S.confirmar(s, f.id, '2026-11-07', 'x');
  G.removerFamilia(s, f.id); G.moverFamilia(s, G.familiasAtivas(s, 'g-rafael')[0].id, 'g-gracy');
  assert.strictEqual(s.deliveries.length, 1); assert.strictEqual(s.deliveries[0].familyName, f.name); assert.strictEqual(s.deliveries[0].groupName, 'Elizeu');
});
t('pular grupo é ação explícita e registrada; desfazer devolve o grupo à pendência', () => {
  const s = novo();
  S.pularGrupo(s, 'x', 'teste');
  assert.strictEqual(S.grupoDaVez(s).name, 'Rafael'); assert.strictEqual(s.rotation.log.length, 1);
  const f = G.familiasAtivas(s, 'g-rafael')[0];
  const d = S.confirmar(s, f.id, '2026-11-07', 'x');
  assert.strictEqual(S.grupoDaVez(s).name, 'Alvimar');
  S.desfazer(s, d.id);
  assert.strictEqual(S.grupoDaVez(s).name, 'Rafael');
});
t('registro retroativo ajusta o rodízio pela entrega mais recente', () => {
  const s = novo();
  S.confirmar(s, G.familiasAtivas(s, 'g-gracy')[0].id, '2026-10-24', 'x', { retroativa: true });
  S.confirmar(s, G.familiasAtivas(s, 'g-alvimar')[0].id, '2026-10-10', 'x', { retroativa: true }); // mais antigo: não mexe
  assert.strictEqual(S.grupoDaVez(s).name, 'William');
});
t('agendamento futuro: escolher família para um sábado distante, com grupo da semana projetado', () => {
  const s = novo();
  assert.strictEqual(S.grupoDaSemana(s, '2026-11-07').name, 'Elizeu');
  assert.strictEqual(S.grupoDaSemana(s, '2026-11-28').name, 'Cleiber'); // projeção: 07 Elizeu, 14 Rafael, 21 Alvimar, 28 Cleiber
  const gracy = G.familiasAtivas(s, 'g-gracy')[0];
  S.confirmar(s, gracy.id, '2026-11-28', 'x');                         // agenda direto o dia 28
  assert.strictEqual(S.grupoDaSemana(s, '2026-11-07').name, 'Elizeu'); // semanas anteriores continuam com a vez do Elizeu
  assert.strictEqual(S.grupoDaSemana(s, '2026-12-05').name, 'Cleiber'); // Gracy entregou na vez do Cleiber: a vez do Cleiber continua
  assert.strictEqual(S.sugerir(s, '2026-12-05', HOJE).grupo.name, 'Cleiber');
  assert.strictEqual(S.entregaDoSabado(s, '2026-11-28').familyId, gracy.id);
  assert.strictEqual(S.grupoDaVez(s).name, 'Elizeu');                  // o próximo sábado livre (07/11) ainda é do Elizeu
});
t('sábado sem reunião: não aceita família, não avança o rodízio e é pulado como sábado em aberto', () => {
  const s = novo();
  S.marcarSemReuniao(s, '2026-11-07');
  assert.strictEqual(S.sugerir(s, '2026-11-07', HOJE).semReuniao, true);
  assert.throws(() => S.confirmar(s, s.families[0].id, '2026-11-07', 'x'), /sem reunião/);
  assert.strictEqual(S.primeiroSabadoAberto(s, HOJE), '2026-11-14');
  assert.strictEqual(S.grupoDaVez(s).name, 'Elizeu');                  // não avançou
  const f = G.familiasAtivas(s, 'g-elizeu')[0];
  S.confirmar(s, f.id, '2026-11-14', 'x');
  assert.strictEqual(S.grupoDaSemana(s, '2026-11-21').name, 'Rafael');
  assert.throws(() => S.marcarSemReuniao(s, '2026-11-14'), /Desfaça/);
  S.desmarcarSemReuniao(s, '2026-11-07');
  assert.strictEqual(S.primeiroSabadoAberto(s, HOJE), '2026-11-07');
});
t('bolinhas: vermelho até 2 semanas, amarelo até 1,5 mês, verde depois ou nunca', () => {
  const s = novo(); const f = s.families[0];
  const add = (iso) => { s.deliveries = s.deliveries.filter((d) => d.familyId !== f.id); s.deliveries.push({ id: 'z' + iso, saturday: iso, familyId: f.id, familyName: f.name, groupId: f.groupId, groupName: 'Elizeu' }); };
  const REF = '2026-11-07';
  assert.strictEqual(S.semaforo(s, f, REF).cor, 'verde');              // nunca participou
  add('2026-10-31'); assert.strictEqual(S.semaforo(s, f, REF).cor, 'vermelho'); // semana passada
  add('2026-10-24'); assert.strictEqual(S.semaforo(s, f, REF).cor, 'vermelho'); // retrasada
  add('2026-10-17'); assert.strictEqual(S.semaforo(s, f, REF).cor, 'amarelo');  // 3 semanas
  add('2026-10-03'); assert.strictEqual(S.semaforo(s, f, REF).cor, 'amarelo');  // 5 semanas (35 dias)
  add('2026-09-26'); assert.strictEqual(S.semaforo(s, f, REF).cor, 'amarelo');  // 42 dias
  add('2026-09-19'); assert.strictEqual(S.semaforo(s, f, REF).cor, 'verde');    // 49 dias > 1,5 mês
  add('2026-11-14'); assert.strictEqual(S.semaforo(s, f, REF).cor, 'vermelho'); // já agendada para a semana seguinte
});
t('sugestão evita família com entrega agendada/recente por perto e segue o grupo da semana', () => {
  const s = novo(); const el = G.familiasAtivas(s, 'g-elizeu');
  S.confirmar(s, el[0].id, '2026-11-14', 'x');                          // el[0] já agendada para 14/11
  // para 07/11, el[0] seria a primeira (nunca participou antes de 07/11), mas está a 1 semana de distância (vermelha)
  assert.strictEqual(S.sugerir(s, '2026-11-07', HOJE).familia.id, el[1].id);
  assert.strictEqual(S.sugerir(s, '2026-11-07', HOJE).grupo.name, 'Elizeu');
});
t('rodízio administrativo (definir/pular) vale até a próxima entrega e dados antigos são migrados', () => {
  const s = novo();
  S.definirGrupoDaVez(s, 'g-cleiber', 'x');
  assert.strictEqual(S.grupoDaVez(s).name, 'Cleiber');
  S.confirmar(s, G.familiasAtivas(s, 'g-cleiber')[0].id, '2026-11-07', 'x');
  assert.strictEqual(S.grupoDaVez(s).name, 'Gracy');
  const velho = JSON.parse(JSON.stringify(novo()));
  delete velho.semReuniao; delete velho.rotation.overrides; delete velho.rotation.baseIndex; velho.rotation.nextGroupIndex = 3;
  S.normalizar(velho);
  assert.strictEqual(S.grupoDaVez(velho).name, 'Cleiber');
  assert.deepStrictEqual(velho.semReuniao, []);
});
t('validação de backup rejeita dados quebrados', () => {
  const { store } = globalThis.LOD || {};
  const st = require('../js/armazenamento.js');
  assert.ok(st.validar({}).length > 0);
  assert.strictEqual(st.validar(JSON.parse(JSON.stringify(novo()))).length, 0);
  const ruim = JSON.parse(JSON.stringify(novo())); ruim.semReuniao = ['amanhã'];
  assert.ok(st.validar(ruim).length > 0);
});
console.log(`\n${ok} testes passaram.`);
