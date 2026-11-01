/* Calendário interno (sábados do ano), exportação .ics e link do Google Calendar. */
(function (root) {
  const LOD = (root.LOD = root.LOD || {});
  const D = () => LOD.datas, ST = () => LOD.store, U = () => LOD.ui, S = () => LOD.selecao;
  let visao = null; // {ano, mes}

  const compacta = (iso) => iso.replace(/-/g, '');
  const escIcs = (s) => String(s).replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');

  function baixarIcs(entregas) {
    const agora = new Date().toISOString().replace(/[-:]/g, '').replace(/\.\d+/, '');
    const ev = entregas.map((d) => [
      'BEGIN:VEVENT', `UID:${d.id}@lembrancinha-do-orador`, `DTSTAMP:${agora}`,
      `DTSTART;VALUE=DATE:${compacta(d.saturday)}`, `DTEND;VALUE=DATE:${compacta(D().addDias(d.saturday, 1))}`,
      `SUMMARY:${escIcs('Lembrancinha do orador — ' + d.familyName)}`,
      `DESCRIPTION:${escIcs(LOD.grupos.rotulo(d.groupName) + '. Família responsável pela lembrancinha do orador.')}`,
      'END:VEVENT'].join('\r\n'));
    const txt = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Lembrancinha do Orador//PT', 'CALSCALE:GREGORIAN', ...ev, 'END:VCALENDAR'].join('\r\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'text/calendar;charset=utf-8' }));
    a.download = entregas.length === 1 ? `lembrancinha-${entregas[0].saturday}.ics` : 'lembrancinha-entregas.ics';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  }

  /** Abre o formulário do Google Calendar já preenchido (não é sincronização: apenas um atalho). */
  function linkGoogle(d) {
    const p = new URLSearchParams({
      action: 'TEMPLATE',
      text: 'Lembrancinha do orador — ' + d.familyName,
      dates: `${compacta(d.saturday)}/${compacta(D().addDias(d.saturday, 1))}`,
      details: LOD.grupos.rotulo(d.groupName)
    });
    return 'https://calendar.google.com/calendar/render?' + p.toString();
  }

  /** Menu de um sábado sem família confirmada: escolher/agendar família, registrar entrega antiga ou marcar sem reunião. */
  function abrirSabado(iso) {
    const state = ST().state, hoje = D().hoje(), esc = U().esc;
    const sem = S().semReuniao(state, iso), passado = iso < hoje;
    const titulo = D().longa(iso).replace(/^./, (c) => c.toUpperCase());
    if (sem) {
      return U().modal({
        titulo, corpo: '<p class="msg">Sem reunião neste sábado: nenhuma família precisa presentear o orador e o rodízio não avança.</p>',
        botoes: [
          { texto: 'Fechar', classe: 'btn-sec' },
          { texto: 'Voltar a ter reunião', classe: 'btn-azul', aoClicar: (f) => { S().desmarcarSemReuniao(state, iso); ST().salvar(); f(); U().toast('Sábado reativado.'); } }
        ]
      });
    }
    const marcar = { texto: 'Marcar sem reunião', classe: 'btn-sec', aoClicar: (f) => {
      try { S().marcarSemReuniao(state, iso); ST().salvar(); f(); U().toast('Sábado marcado como sem reunião.'); } catch (e) { U().toast(e.message, 'erro'); }
    } };
    const corpo = passado
      ? '<p class="msg">Este sábado já passou e não tem registro.</p>'
      : `<p class="msg">Sábado livre. Grupo da semana: <strong>${esc(LOD.grupos.rotulo(S().grupoDaSemana(state, iso).name))}</strong>.</p><p class="msg-sec">Você pode agendar qualquer família, de qualquer grupo, ou marcar que não haverá reunião.</p>`;
    const acao = passado
      ? { texto: 'Registrar entrega', classe: 'btn-verde', aoClicar: (f) => { f(); U().registrarAnterior(iso); } }
      : { texto: 'Escolher família', classe: 'btn-verde', aoClicar: (f) => { f(); LOD.app.abrirSugestao(iso); } };
    U().modal({ titulo, corpo, botoes: [marcar, acao] });
  }

  function render(cont) {
    const state = ST().state, hoje = D().hoje(), alvo = D().proximoSabado(hoje), esc = U().esc;
    if (!visao) visao = { ano: +alvo.slice(0, 4), mes: +alvo.slice(5, 7) };
    const { ano, mes } = visao;
    const primeiro = `${ano}-${String(mes).padStart(2, '0')}-01`;
    const inicioGrade = D().addDias(primeiro, -D().diaSemana(primeiro));
    const sabados = D().sabadosDoMes(ano, mes);
    const celulas = [];
    for (let i = 0; i < 42; i++) {
      const dia = D().addDias(inicioGrade, i);
      if (i >= 35 && +dia.slice(5, 7) !== mes) break;
      celulas.push(dia);
    }
    const infoSab = (iso) => {
      const d = S().entregaDoSabado(state, iso);
      if (d) return { d, texto: d.familyName, sub: LOD.grupos.rotulo(d.groupName), classe: d.completed ? 'sab-feita' : 'sab-conf' };
      if (S().semReuniao(state, iso)) return { texto: 'Sem reunião', sub: '', classe: 'sab-sem', sem: true };
      if (iso < hoje) return { texto: 'Sem registro', sub: '', classe: 'sab-vazio' };
      return { texto: 'Pendente', sub: (iso === alvo ? 'Próximo · ' : '') + LOD.grupos.rotulo(S().grupoDaSemana(state, iso).name), classe: 'sab-pend' };
    };
    cont.innerHTML = `
      <div class="pagina-topo"><h2>CALENDÁRIO</h2>
        <button class="btn btn-sec" data-acao="ics">Baixar todas as entregas (.ics)</button></div>
      <div class="card">
        <div class="cal-nav"><button class="btn btn-sec" data-acao="ant" aria-label="Mês anterior">‹</button>
          <strong>${D().nomeMes(ano, mes)}</strong>
          <button class="btn btn-sec" data-acao="hoje">Hoje</button>
          <button class="btn btn-sec" data-acao="prox" aria-label="Próximo mês">›</button></div>
        <div class="cal-grade">
          ${['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'].map((n) => `<div class="cal-cab">${n}</div>`).join('')}
          ${celulas.map((iso) => {
            const doMes = +iso.slice(5, 7) === mes, n = +iso.slice(8);
            if (D().diaSemana(iso) !== 6) return `<div class="cal-dia${doMes ? '' : ' fora'}${iso === hoje ? ' hoje' : ''}">${n}</div>`;
            const s = infoSab(iso);
            return `<button class="cal-dia sabado ${s.classe}${doMes ? '' : ' fora'}${iso === alvo ? ' alvo' : ''}${iso === hoje ? ' hoje' : ''}" data-sab="${iso}">
              <span class="cal-n">${n}</span><span class="cal-fam">${esc(s.texto)}</span>${s.sub ? `<span class="cal-sub">${esc(s.sub)}</span>` : ''}</button>`;
          }).join('')}
        </div>
        <div class="legenda"><span><i class="sab-conf"></i>Confirmada</span><span><i class="sab-feita"></i>Realizada</span><span><i class="sab-pend"></i>Pendente</span><span><i class="sab-vazio"></i>Sem registro</span><span><i class="sab-sem"></i>Sem reunião</span><span><i class="alvo-ico"></i>Próximo sábado</span></div>
      </div>
      <div class="card"><h3>Sábados de ${D().nomeMes(ano, mes)}</h3>
        <ul class="lista-simples">${sabados.map((iso) => { const s = infoSab(iso); return `<li><button class="link" data-sab="${iso}">${D().br(iso)}</button> — ${s.d ? `<strong>${esc(s.d.familyName)}</strong> (${esc(LOD.grupos.rotulo(s.d.groupName))})` : `<em>${s.texto}</em>${s.sub && !s.sem && iso >= hoje ? ' · ' + esc(s.sub) : ''}`}</li>`; }).join('')}</ul>
      </div>`;

    cont.onclick = (e) => {
      const t = e.target.closest('[data-acao],[data-sab]');
      if (!t) return;
      const a = t.dataset.acao;
      if (a === 'ant' || a === 'prox') { const dt = new Date(Date.UTC(ano, mes - 1 + (a === 'ant' ? -1 : 1), 1)); visao = { ano: dt.getUTCFullYear(), mes: dt.getUTCMonth() + 1 }; render(cont); }
      else if (a === 'hoje') { visao = null; render(cont); }
      else if (a === 'ics') { if (!state.deliveries.length) return U().toast('Nenhuma entrega para exportar.'); baixarIcs(state.deliveries); }
      else if (t.dataset.sab) {
        const iso = t.dataset.sab, d = S().entregaDoSabado(state, iso);
        if (d) U().abrirEntrega(d.id);
        else abrirSabado(iso);
      }
    };
  }

  LOD.calendario = { render, baixarIcs, linkGoogle, abrirSabado };
})(typeof window !== 'undefined' ? window : globalThis);
