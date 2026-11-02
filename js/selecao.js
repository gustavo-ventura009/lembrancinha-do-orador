/* Seleção: rodízio entre grupos, prioridade das famílias, confirmação e alertas. Lógica pura, sem DOM. */
(function (root) {
  const LOD = (root.LOD = root.LOD || {});
  const D = () => LOD.datas;
  const G = () => LOD.grupos;

  /** Semáforo: até 14 dias de distância = vermelho; até 45 dias (1,5 mês) = amarelo; mais que isso ou nunca = verde. */
  const DIAS_VERMELHO = 14, DIAS_AMARELO = 45;

  function entregasDa(state, familyId) {
    return state.deliveries.filter((d) => d.familyId === familyId).sort((a, b) => (a.saturday < b.saturday ? 1 : -1));
  }

  /** Estatísticas de uma família considerando entregas anteriores ao sábado alvo (se informado). */
  function stats(state, fam, hojeIso, antesDe) {
    const todas = entregasDa(state, fam.id);
    const consideradas = antesDe ? todas.filter((d) => d.saturday < antesDe) : todas;
    const ultima = consideradas.length ? consideradas[0].saturday : null;
    return {
      ultima,
      semanas: ultima ? D().semanasDesde(ultima, hojeIso) : null,
      total: todas.length
    };
  }

  const idxGrupo = (state, id) => state.groups.findIndex((g) => g.id === id);
  const grupoNum = (state, i) => { const n = state.groups.length; return state.groups[((i % n) + n) % n]; };
  const semReuniao = (state, iso) => (state.semReuniao || []).includes(iso);

  function entregaDoSabado(state, sabadoIso) {
    return state.deliveries.find((d) => d.saturday === sabadoIso) || null;
  }

  /** Primeiro sábado (a partir do próximo) que não tem família confirmada nem está marcado como sem reunião. */
  function primeiroSabadoAberto(state, hojeIso) {
    let s = D().proximoSabado(hojeIso || D().hoje());
    for (let i = 0; i < 520; i++) {
      if (!entregaDoSabado(state, s) && !semReuniao(state, s)) return s;
      s = D().addDias(s, 7);
    }
    return s;
  }

  /** Sábado em aberto = sem família confirmada e com reunião. */
  const aberto = (state, iso) => !entregaDoSabado(state, iso) && !semReuniao(state, iso);

  /**
   * Grupo da semana de um sábado qualquer (inclusive futuro).
   * Regra: a vez só passa para o grupo seguinte quando uma família do PRÓPRIO grupo da vez entrega.
   * Se entregar alguém de outro grupo, a vez continua com o grupo que ficou devendo (volta para ele na semana seguinte).
   * Grupo que entregou fora da vez e ainda não tinha chegado a sua vez no ciclo (ordem Elizeu -> ... -> William)
   * é pulado quando o rodízio chegar nele, para não presentear duas vezes seguidas.
   * Ajustes administrativos (definir/pular grupo) valem a partir do sábado em que foram feitos e zeram esses créditos.
   * Sábados passados sem registro e sábados sem reunião não avançam o rodízio.
   * Projeção: a cada sábado futuro em aberto antes do pedido, o grupo avança um (supondo que cada semana
   * será confirmada pelo grupo da vez, em ordem).
   */
  function grupoDaSemana(state, sabadoIso) {
    const r = state.rotation, n = state.groups.length;
    const eventos = [];
    (r.overrides || []).forEach((o) => { if (o.aPartirDe <= sabadoIso) eventos.push({ data: o.aPartirDe, ordem: 0, o }); });
    state.deliveries.forEach((d) => { if (d.saturday < sabadoIso) eventos.push({ data: d.saturday, ordem: 1, d }); });
    eventos.sort((a, b) => (a.data < b.data ? -1 : a.data > b.data ? 1 : a.ordem - b.ordem));

    const creditos = new Set(); // grupos à frente no ciclo que já entregaram fora da vez
    // próximo grupo do rodízio, pulando (e consumindo o crédito de) quem já entregou fora da vez
    const avancar = (de) => {
      let i = de;
      for (let k = 0; k < n; k++) {
        i = (i + 1) % n;
        if (creditos.has(i)) { creditos.delete(i); continue; }
        return i;
      }
      return (de + 1) % n;
    };

    let p = typeof r.baseIndex === 'number' ? r.baseIndex : (r.nextGroupIndex || 0);
    let corte = '';
    eventos.forEach((e) => {
      if (e.o) {
        const i = idxGrupo(state, e.o.groupId);
        if (i >= 0) { p = i; creditos.clear(); }
        if (e.data > corte) corte = e.data;
        return;
      }
      const d = e.d;
      let vez = idxGrupo(state, d.rotationGroupId || d.groupId); // grupo que era da vez naquela semana
      if (vez < 0) vez = p;
      const real = idxGrupo(state, d.groupId);                   // grupo da família que entregou
      if (d.retroativa) { p = (vez + 1) % n; creditos.clear(); }
      else if (real < 0 || real === vez) p = avancar(vez);
      else { p = vez; if (real > vez) creditos.add(real); }
      const prox = D().addDias(d.saturday, 7);
      if (prox > corte) corte = prox;
    });

    let inicio = primeiroSabadoAberto(state);
    if (corte > inicio) inicio = corte;
    for (let s = inicio; s < sabadoIso; s = D().addDias(s, 7)) if (aberto(state, s)) p = avancar(p);
    return grupoNum(state, p);
  }

  /** Grupo da vez = grupo do primeiro sábado em aberto. */
  function grupoDaVez(state, hojeIso) { return grupoDaSemana(state, primeiroSabadoAberto(state, hojeIso)); }

  /** Mantém rotation.nextGroupIndex (usado pelo backend nos lembretes) igual ao grupo da vez. */
  function sincronizar(state, hojeIso) { state.rotation.nextGroupIndex = idxGrupo(state, grupoDaVez(state, hojeIso).id); }

  /** Completa campos novos em dados antigos (backups e LocalStorage de versões anteriores). */
  function normalizar(state) {
    const r = state.rotation;
    if (!Array.isArray(r.log)) r.log = [];
    if (!Array.isArray(r.overrides)) r.overrides = [];
    if (!Array.isArray(state.semReuniao)) state.semReuniao = [];
    // Migra entregas antigas: registros passados preservam o grupo real; agendamentos futuros
    // recebem o grupo previsto para a semana, sem confundir com o grupo da família escolhida.
    // Reconstrói registros antigos em ordem cronológica usando o grupo previsto para a semana,
    // nunca o grupo da família escolhida. Assim uma escolha manual fora do grupo não desvia o rodízio.
    (state.deliveries || []).slice().sort((a, b) => a.saturday.localeCompare(b.saturday)).forEach((d) => {
      if (!d.rotationGroupId) {
        const previsto = grupoDaSemana(state, d.saturday) || G().grupo(state, d.groupId);
        d.rotationGroupId = previsto.id;
        d.rotationGroupName = previsto.name;
      }
    });
    if (typeof r.baseIndex !== 'number') {
      r.baseIndex = r.nextGroupIndex || 0;
      // dado antigo: preserva um "definir/pular grupo" que ainda não tinha virado entrega
      const sab = primeiroSabadoAberto(state);
      if (state.groups[r.baseIndex] && grupoDaSemana(state, sab).id !== state.groups[r.baseIndex].id)
        r.overrides.push({ aPartirDe: sab, groupId: state.groups[r.baseIndex].id, em: 'migracao' });
    }
    sincronizar(state);
    return state;
  }

  /** Lista os próximos n sábados com o estado de cada um. */
  function sabadosFuturos(state, hojeIso, n) {
    const lista = []; let s = D().proximoSabado(hojeIso);
    for (let i = 0; i < (n || 26); i++) {
      lista.push({ iso: s, entrega: entregaDoSabado(state, s), semReuniao: semReuniao(state, s) });
      s = D().addDias(s, 7);
    }
    return lista;
  }

  /**
   * Bolinha de cada família, em relação a um sábado de referência (por padrão, o próximo sábado).
   * Usa a entrega mais próxima no tempo (passada ou já agendada):
   *   vermelho = até 2 semanas (semana passada, retrasada ou já agendada perto) -> não cogitar
   *   amarelo  = de 2 semanas até 1 mês e meio (45 dias) -> evitar se possível
   *   verde    = mais de 1 mês e meio, ou nunca participou -> pode ser cogitada
   */
  function semaforo(state, fam, refIso) {
    const todas = entregasDa(state, fam.id);
    if (!todas.length) return { cor: 'verde', dias: null, texto: 'Nunca participou — pode ser cogitada' };
    let m = null;
    todas.forEach((d) => { const dist = Math.abs(D().diffDias(d.saturday, refIso)); if (!m || dist < m.dist) m = { d, dist }; });
    const depois = m.d.saturday > refIso, n = Math.round(m.dist / 7), data = D().br(m.d.saturday);
    if (m.dist <= DIAS_VERMELHO) {
      const texto = m.dist === 0 ? `Já está na entrega deste sábado (${data})` : depois ? `Entrega já agendada para ${data} — não cogitar` : `Entregou há ${D().textoSemanas(n)} (${data}) — não cogitar`;
      return { cor: 'vermelho', dias: m.dist, texto };
    }
    if (m.dist <= DIAS_AMARELO)
      return { cor: 'amarelo', dias: m.dist, texto: depois ? `Entrega agendada para ${data} (daqui a ${D().textoSemanas(n)}) — evitar se possível` : `Entregou há ${D().textoSemanas(n)} (${data}) — evitar se possível` };
    return { cor: 'verde', dias: m.dist, texto: depois ? `Próxima entrega só em ${data} — pode ser cogitada` : `Entregou há ${D().textoSemanas(n)} (${data}) — pode ser cogitada` };
  }

  /**
   * Recomenda a família do grupo da SEMANA do sábado pedido (hoje, o próximo sábado ou qualquer sábado futuro),
   * ou do grupo indicado em grupoId.
   * 1) Famílias com bolinha vermelha (entrega até 2 semanas antes/depois desse sábado) só entram se não houver outra.
   * 2) Entre as que NÃO são do responsável: a que está há mais tempo sem entregar (nunca participou vem primeiro).
   * 3) A família do responsável só é recomendada se esperou pelo menos N semanas a mais que a melhor das demais
   *    (N = settings.penalidadeResponsavelSemanas) ou se for a única disponível.
   */
  function sugerir(state, sabadoIso, hojeIso, grupoId) {
    sabadoIso = sabadoIso || D().proximoSabado(hojeIso);
    const confirmada = entregaDoSabado(state, sabadoIso);
    const grupo = (grupoId && G().grupo(state, grupoId)) || grupoDaSemana(state, sabadoIso); // grupoId: o grupo escolhido manualmente
    if (confirmada) return { sabado: sabadoIso, confirmada, grupo: G().grupo(state, confirmada.groupId) || grupo };
    if (semReuniao(state, sabadoIso)) return { sabado: sabadoIso, grupo, familia: null, semReuniao: true, motivo: 'Sábado sem reunião: não precisa de família.' };

    const todas = G().familiasAtivas(state, grupo.id);
    if (!todas.length) return { sabado: sabadoIso, grupo, familia: null, motivo: 'Este grupo não tem famílias ativas.' };
    const livres = todas.filter((f) => semaforo(state, f, sabadoIso).cor !== 'vermelho');
    const ativas = livres.length ? livres : todas;

    const ordem = new Map(state.families.map((f, i) => [f.id, i]));
    const chave = (f) => {
      const s = stats(state, f, hojeIso, sabadoIso);
      return { f, ultima: s.ultima, total: s.total };
    };
    const cmp = (a, b) => {
      if (a.ultima === b.ultima) return a.total - b.total || ordem.get(a.f.id) - ordem.get(b.f.id);
      if (a.ultima === null) return -1;
      if (b.ultima === null) return 1;
      return a.ultima < b.ultima ? -1 : 1;
    };
    const resp = ativas.filter((f) => G().ehResponsavel(state, f)).map(chave);
    const outras = ativas.filter((f) => !G().ehResponsavel(state, f)).map(chave).sort(cmp);

    let escolhida, motivo;
    if (!outras.length) { escolhida = resp[0]; motivo = 'Única família ativa do grupo.'; }
    else if (!resp.length) { escolhida = outras[0]; }
    else {
      const o = outras[0], r = resp[0];
      const pen = Number(state.settings.penalidadeResponsavelSemanas || 0);
      let usaResp = false;
      if (r.ultima === null) usaResp = o.ultima !== null;           // responsável nunca participou e todas as demais já
      else if (o.ultima === null) usaResp = false;
      else usaResp = D().diffDias(r.ultima, o.ultima) >= pen * 7;    // esperou N semanas a mais que a melhor das demais
      if (r.ultima === null && o.ultima !== null) usaResp = true;
      escolhida = usaResp ? r : o;
      if (usaResp) motivo = 'Família do responsável: esperou mais que as demais.';
    }
    const fam = escolhida.f;
    return { sabado: sabadoIso, grupo, familia: fam, motivo, stats: stats(state, fam, hojeIso), candidatas: [...outras, ...resp].sort(cmp).map((c) => c.f) };
  }

  /** Participação anterior no mesmo mês (antes do sábado alvo). Retorna {data, semanas} ou null. */
  function alertaRecente(state, familyId, sabadoIso, hojeIso) {
    const mes = D().mes(sabadoIso);
    const prev = entregasDa(state, familyId).find((d) => d.saturday < sabadoIso && D().mes(d.saturday) === mes);
    if (!prev) return null;
    return { data: prev.saturday, semanas: D().semanasDesde(prev.saturday, hojeIso) };
  }

  function recalcularRotacao(state) { sincronizar(state); }

  /**
   * Registra uma entrega confirmada. Lança erro se o sábado já tiver família, se estiver sem reunião ou se a data não for sábado.
   * Qualquer família ativa pode ser escolhida, mesmo que não seja do grupo da semana, e o sábado pode ser futuro (agendamento).
   * opcoes.retroativa: apenas marca o registro como histórico antigo.
   */
  function confirmar(state, familyId, sabadoIso, agoraIso, opcoes) {
    opcoes = opcoes || {};
    const fam = G().familia(state, familyId);
    if (!fam || !fam.active) throw new Error('Família inválida ou inativa.');
    if (D().diaSemana(sabadoIso) !== 6) throw new Error('A data precisa ser um sábado.');
    if (semReuniao(state, sabadoIso)) throw new Error('Este sábado está marcado como sem reunião.');
    if (entregaDoSabado(state, sabadoIso)) throw new Error('Já existe uma família confirmada para este sábado.');
    const grupo = G().grupo(state, fam.groupId);
    // A semana mantém o grupo previsto no rodízio, mesmo quando outra família é escolhida manualmente.
    const grupoDaRotacao = opcoes.retroativa ? grupo : grupoDaSemana(state, sabadoIso);
    const d = {
      id: G().novoId('d'),
      saturday: sabadoIso,
      familyId: fam.id,
      familyName: fam.name,
      groupId: grupo.id,
      groupName: grupo.name,
      rotationGroupId: grupoDaRotacao.id,
      rotationGroupName: grupoDaRotacao.name,
      confirmedAt: agoraIso,
      completed: false,
      retroativa: !!opcoes.retroativa
    };
    state.deliveries.push(d);
    sincronizar(state);
    return d;
  }

  function desfazer(state, deliveryId) {
    const i = state.deliveries.findIndex((d) => d.id === deliveryId);
    if (i < 0) throw new Error('Entrega não encontrada.');
    const [rem] = state.deliveries.splice(i, 1);
    sincronizar(state); // o grupo daquele sábado volta a ficar pendente automaticamente
    return rem;
  }

  /** Marca um sábado como sem reunião: não precisa de família e o rodízio não avança. */
  function marcarSemReuniao(state, sabadoIso) {
    if (D().diaSemana(sabadoIso) !== 6) throw new Error('A data precisa ser um sábado.');
    const d = entregaDoSabado(state, sabadoIso);
    if (d) throw new Error(`Este sábado já tem ${d.familyName} confirmada. Desfaça a confirmação antes de marcar como sem reunião.`);
    if (!state.semReuniao) state.semReuniao = [];
    if (!state.semReuniao.includes(sabadoIso)) state.semReuniao.push(sabadoIso);
    state.semReuniao.sort();
    sincronizar(state);
  }
  function desmarcarSemReuniao(state, sabadoIso) {
    state.semReuniao = (state.semReuniao || []).filter((x) => x !== sabadoIso);
    sincronizar(state);
  }

  /** Ação administrativa explícita: pular o grupo da vez. */
  function pularGrupo(state, agoraIso, motivo) {
    const sab = primeiroSabadoAberto(state);
    const g = grupoDaSemana(state, sab);
    const prox = grupoNum(state, idxGrupo(state, g.id) + 1);
    state.rotation.log.push({ em: agoraIso, acao: 'pular', grupoId: g.id, grupoNome: g.name, motivo: motivo || '' });
    state.rotation.overrides.push({ aPartirDe: sab, groupId: prox.id, em: agoraIso });
    sincronizar(state);
  }
  function definirGrupoDaVez(state, groupId, agoraIso) {
    const idx = idxGrupo(state, groupId);
    if (idx < 0) throw new Error('Grupo inválido.');
    state.rotation.log.push({ em: agoraIso, acao: 'definir', grupoId: groupId, grupoNome: state.groups[idx].name });
    state.rotation.overrides.push({ aPartirDe: primeiroSabadoAberto(state), groupId, em: agoraIso });
    sincronizar(state);
  }

  const S = {
    DIAS_VERMELHO, DIAS_AMARELO,
    entregasDa, stats, grupoDaVez, grupoDaSemana, primeiroSabadoAberto, sabadosFuturos, semReuniao, semaforo, normalizar, sincronizar,
    entregaDoSabado, sugerir, alertaRecente, recalcularRotacao, confirmar, desfazer, marcarSemReuniao, desmarcarSemReuniao, pularGrupo, definirGrupoDaVez
  };
  LOD.selecao = S;
  if (typeof module !== 'undefined') module.exports = S;
})(typeof window !== 'undefined' ? window : globalThis);
