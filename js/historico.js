/* Histórico de entregas: lista, filtros, totais e participações por família. */
(function (root) {
  const LOD = (root.LOD = root.LOD || {});
  const D = () => LOD.datas, ST = () => LOD.store, U = () => LOD.ui;
  const filtro = { busca: '', grupo: '', mes: '', ano: '' };

  function semNorm(s) { return String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase(); }

  function render(cont) {
    const state = ST().state, hoje = D().hoje(), esc = U().esc;
    const todas = [...state.deliveries].sort((a, b) => (a.saturday < b.saturday ? 1 : -1));
    const anos = [...new Set(todas.map((d) => d.saturday.slice(0, 4)))].sort().reverse();
    const lista = todas.filter((d) =>
      (!filtro.busca || semNorm(d.familyName).includes(semNorm(filtro.busca))) &&
      (!filtro.grupo || d.groupId === filtro.grupo) &&
      (!filtro.mes || d.saturday.slice(5, 7) === filtro.mes) &&
      (!filtro.ano || d.saturday.slice(0, 4) === filtro.ano));

    const contagem = new Map();
    todas.forEach((d) => { const c = contagem.get(d.familyId) || { nome: d.familyName, n: 0 }; c.n++; c.nome = d.familyName; contagem.set(d.familyId, c); });
    const ranking = [...contagem.entries()].sort((a, b) => b[1].n - a[1].n || a[1].nome.localeCompare(b[1].nome, 'pt-BR'));
    const meses = ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

    cont.innerHTML = `
      <div class="pagina-topo"><h2>HISTÓRICO DE ENTREGAS</h2>
        <button class="btn btn-azul" data-acao="registrar">+ Registrar entrega anterior</button></div>
      <div class="card filtros">
        <input type="search" id="f-busca" placeholder="Pesquisar família…" value="${esc(filtro.busca)}" aria-label="Pesquisar família">
        <select id="f-grupo" aria-label="Filtrar por grupo"><option value="">Todos os grupos</option>${state.groups.map((g) => `<option value="${g.id}"${filtro.grupo === g.id ? ' selected' : ''}>${esc(LOD.grupos.rotulo(g.name))}</option>`).join('')}</select>
        <select id="f-mes" aria-label="Filtrar por mês"><option value="">Todos os meses</option>${meses.map((m, i) => { const v = String(i + 1).padStart(2, '0'); return `<option value="${v}"${filtro.mes === v ? ' selected' : ''}>${m}</option>`; }).join('')}</select>
        <select id="f-ano" aria-label="Filtrar por ano"><option value="">Todos os anos</option>${anos.map((a) => `<option${filtro.ano === a ? ' selected' : ''}>${a}</option>`).join('')}</select>
        <button class="btn btn-sec" data-acao="limpar">Limpar</button>
      </div>
      <p class="total">Total de entregas: <strong>${todas.length}</strong>${lista.length !== todas.length ? ` · mostrando ${lista.length}` : ''}</p>
      <div class="card">
        ${lista.length ? `<ul class="hist">${lista.map((d) => {
          const futura = d.saturday > hoje;
          const sem = futura ? 'agendada' : D().textoSemanas(D().semanasDesde(d.saturday, hoje));
          const st = U().statusEntrega(d, hoje);
          return `<li><button class="hist-item" data-entrega="${d.id}">
            <span class="hist-txt"><strong>${esc(d.familyName)}</strong> (${esc(LOD.grupos.rotulo(d.groupName))}) — ${D().br(d.saturday)} | (${sem})</span>
            <span class="tag ${st.classe}">${st.texto}</span></button>
            <button class="link" data-familia="${d.familyId}" data-nome="${esc(d.familyName)}" title="Ver todas as participações">participações</button></li>`;
        }).join('')}</ul>` : `<p class="vazio">${todas.length ? 'Nenhuma entrega com esses filtros.' : 'Ainda não há entregas. Confirme a primeira pelo painel ou use “Registrar entrega anterior” para trazer o histórico antigo — isso melhora a sugestão de quem está há mais tempo sem entregar.'}</p>`}
      </div>
      ${ranking.length ? `<details class="card"><summary>Entregas por família (${ranking.length})</summary>
        <table class="tab-simples"><thead><tr><th>Família</th><th>Entregas</th></tr></thead><tbody>
        ${ranking.map(([id, c]) => `<tr><td><button class="link" data-familia="${id}" data-nome="${esc(c.nome)}">${esc(c.nome)}</button></td><td>${c.n}</td></tr>`).join('')}
        </tbody></table></details>` : ''}`;

    const $ = (s) => cont.querySelector(s);
    const bind = (id, k) => $(id).addEventListener('input', (e) => { filtro[k] = e.target.value; const pos = e.target.selectionStart; render(cont); const novo = $(id); if (novo && k === 'busca') { novo.focus(); try { novo.setSelectionRange(pos, pos); } catch (x) {} } });
    bind('#f-busca', 'busca'); bind('#f-grupo', 'grupo'); bind('#f-mes', 'mes'); bind('#f-ano', 'ano');
    // onclick (e não addEventListener): cada render substitui o ouvinte em vez de acumular outro no mesmo #view
    cont.onclick = (e) => {
      const t = e.target.closest('[data-acao],[data-entrega],[data-familia]');
      if (!t) return;
      if (t.dataset.acao === 'registrar') U().registrarAnterior();
      else if (t.dataset.acao === 'limpar') { filtro.busca = filtro.grupo = filtro.mes = filtro.ano = ''; render(cont); }
      else if (t.dataset.entrega) U().abrirEntrega(t.dataset.entrega);
      else if (t.dataset.familia) participacoes(t.dataset.familia, t.dataset.nome);
    };
  }

  function participacoes(familyId, nome) {
    const state = ST().state, esc = U().esc;
    const lista = state.deliveries.filter((d) => d.familyId === familyId).sort((a, b) => (a.saturday < b.saturday ? 1 : -1));
    U().modal({
      titulo: 'Participações — ' + nome,
      corpo: lista.length ? `<p class="total">${lista.length} entrega(s)</p><ul class="lista-simples">${lista.map((d) => `<li>${D().br(d.saturday)} — ${esc(LOD.grupos.rotulo(d.groupName))}</li>`).join('')}</ul>` : '<p>Nenhuma participação registrada.</p>',
      botoes: [{ texto: 'Fechar', classe: 'btn-azul' }]
    });
  }

  LOD.historico = { render };
})(typeof window !== 'undefined' ? window : globalThis);
