/* Grupos e famílias: dados iniciais e operações de cadastro (funções puras sobre o "state"). */
(function (root) {
  const LOD = (root.LOD = root.LOD || {});

  const SEED = [
    ['Elizeu', ['Ricardo & Cleuma', 'Rodrigo & Manuella', 'Geraldina & Rosilda', 'Fátima & Arielli', 'Zé & Luzinete']],
    ['Rafael', ['Cleonice', 'Júnior gago', 'Família do Jefferson', 'Osmenia', 'Rosália', 'Suzi', 'Gustavo Linguini & Nicole', 'Wellington & Pamela']],
    ['Alvimar', ['Antônia', 'Eunice', 'Família do Zé', 'Silvio', 'Mirtes', 'Graça', 'Valdir & Maria Ramalho']],
    ['Cleiber', ['Cesar & Jack', 'Gui & Geovanna', 'Ronni & Bruna', 'Lourdes & Gisele', 'Espedita', 'Juraci & Glória', 'Loreni & Luciana', 'Rosana']],
    ['Gracy', ['Alcides & Elina', 'Família do Renato', 'Juan & Dina', 'Dilma']],
    ['William', ['Aurenita & Aline', 'Cláudio e Selma', 'Francisca', 'Hélio & Dedé', 'Luiza', 'Waldomiro & Marísa']]
  ];

  const MSG_PADRAO = 'Fala Eli, Tranquilo? Estava pensando nessa semana a [NOME DA FAMÍLIA SELECIONADA] entregar a lembrancinha do orador. O que você acha?';

  // Aceita horários antigos em horas inteiras (8) e novos no formato HH:MM.
  function minutosDoHorario(valor) {
    if (typeof valor === 'number' && Number.isInteger(valor) && valor >= 0 && valor <= 23) return valor * 60;
    const m = String(valor).trim().match(/^(\d{1,2})(?::([0-5]\d))?$/);
    if (!m) return NaN;
    const h = Number(m[1]), min = Number(m[2] || 0);
    return h <= 23 ? h * 60 + min : NaN;
  }
  function horarioTexto(valor) {
    const total = minutosDoHorario(valor);
    if (!Number.isFinite(total)) return String(valor);
    return String(Math.floor(total / 60)).padStart(2, '0') + ':' + String(total % 60).padStart(2, '0');
  }
  function novoId(prefixo) {
    return prefixo + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
  }

  function estadoInicial() {
    const groups = [], families = [];
    let n = 1;
    SEED.forEach(([nome, fams], gi) => {
      const gid = 'g-' + nome.toLowerCase();
      groups.push({ id: gid, name: nome, responsavel: '', familiaResponsavelId: null });
      fams.forEach((f) => families.push({ id: 'f-' + String(n++).padStart(3, '0'), name: f, groupId: gid, active: true }));
    });
    return {
      version: 2,
      updatedAt: 0,
      groups,
      families,
      deliveries: [],
      rotation: { nextGroupIndex: 0, baseIndex: 0, overrides: [], log: [] },
      semReuniao: [],
      settings: {
        whatsappNumber: '5511962662443',
        messageTemplate: MSG_PADRAO,
        penalidadeResponsavelSemanas: 4,
        lembreteHoras: [8, 11, 14, 17, 20],
        ntfyTopic: '',
        notificacoesNavegador: true
      }
    };
  }

  const G = {
    SEED, MSG_PADRAO, novoId, estadoInicial, minutosDoHorario, horarioTexto,
    /** Nome para exibição: "Grupo Elizeu" (não duplica o prefixo se o nome já começar com "Grupo"). */
    rotulo(nome) { nome = String(nome == null ? '' : nome).trim(); return /^grupo\b/i.test(nome) ? nome : 'Grupo ' + nome; },
    grupo(state, id) { return state.groups.find((g) => g.id === id); },
    familia(state, id) { return state.families.find((f) => f.id === id); },
    familiasAtivas(state, groupId) { return state.families.filter((f) => f.active && f.groupId === groupId); },
    ehResponsavel(state, fam) { const g = G.grupo(state, fam.groupId); return !!g && g.familiaResponsavelId === fam.id; },

    adicionarFamilia(state, nome, groupId) {
      nome = (nome || '').trim();
      if (!nome) throw new Error('Informe o nome da família.');
      if (!G.grupo(state, groupId)) throw new Error('Grupo inválido.');
      if (state.families.some((f) => f.active && f.groupId === groupId && f.name.toLowerCase() === nome.toLowerCase()))
        throw new Error('Já existe uma família com esse nome neste grupo.');
      const fam = { id: novoId('f'), name: nome, groupId, active: true };
      state.families.push(fam);
      return fam;
    },
    editarFamilia(state, id, nome) {
      nome = (nome || '').trim();
      if (!nome) throw new Error('Informe o nome da família.');
      G.familia(state, id).name = nome; // histórico mantém o nome gravado na época
    },
    moverFamilia(state, id, novoGrupoId) {
      const fam = G.familia(state, id);
      if (!G.grupo(state, novoGrupoId)) throw new Error('Grupo inválido.');
      const antigo = G.grupo(state, fam.groupId);
      if (antigo && antigo.familiaResponsavelId === id) antigo.familiaResponsavelId = null;
      fam.groupId = novoGrupoId;
    },
    /** Exclui da lista ativa; o registro e o histórico permanecem. */
    removerFamilia(state, id) {
      const fam = G.familia(state, id);
      fam.active = false;
      const g = G.grupo(state, fam.groupId);
      if (g && g.familiaResponsavelId === id) g.familiaResponsavelId = null;
    },
    reativarFamilia(state, id) { G.familia(state, id).active = true; },
    definirResponsavel(state, groupId, nome, familiaId) {
      const g = G.grupo(state, groupId);
      g.responsavel = (nome || '').trim();
      if (familiaId) {
        const f = G.familia(state, familiaId);
        if (!f || f.groupId !== groupId || !f.active) throw new Error('A família do responsável precisa ser uma família ativa do mesmo grupo.');
      }
      g.familiaResponsavelId = familiaId || null;
    },
    renomearGrupo(state, groupId, nome) {
      nome = (nome || '').trim();
      if (!nome) throw new Error('Informe o nome do grupo.');
      G.grupo(state, groupId).name = nome;
    }
  };

  LOD.grupos = G;
  if (typeof module !== 'undefined') module.exports = G;
})(typeof window !== 'undefined' ? window : globalThis);
