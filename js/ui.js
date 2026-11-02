/* Componentes de interface compartilhados: modais, diálogos, toasts e o fluxo de confirmação. */
(function (root) {
  const LOD = (root.LOD = root.LOD || {});
  const D = () => LOD.datas, S = () => LOD.selecao, G = () => LOD.grupos, ST = () => LOD.store;

  const esc = (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const pilha = [];

  function raiz() { return document.getElementById('modais'); }

  /** Abre um modal. botoes: [{texto, classe, aoClicar(fechar)}]. Retorna função fechar. */
  let ultimo = { chave: '', t: 0, fechar: null };
  function modal({ titulo, corpo, botoes, largo }) {
    // trava de segurança: o mesmo modal pedido duas vezes em menos de 0,6 s (toque duplo) abre uma só tela
    const chave = titulo + '|' + (typeof corpo === 'string' ? corpo : corpo ? corpo.innerHTML : '');
    if (ultimo.fechar && ultimo.chave === chave && Date.now() - ultimo.t < 600 && pilha.length) return ultimo.fechar;
    const ov = document.createElement('div');
    ov.className = 'overlay';
    ov.innerHTML = `<div class="modal${largo ? ' modal-largo' : ''}" role="dialog" aria-modal="true" aria-label="${esc(titulo)}">
      <div class="modal-topo"><h3>${esc(titulo)}</h3><button class="icone-btn" data-fechar aria-label="Fechar">✕</button></div>
      <div class="modal-corpo"></div><div class="modal-rodape"></div></div>`;
    const c = ov.querySelector('.modal-corpo');
    if (typeof corpo === 'string') c.innerHTML = corpo; else if (corpo) c.appendChild(corpo);
    const fechar = () => { ov.remove(); const i = pilha.indexOf(ov); if (i >= 0) pilha.splice(i, 1); };
    const rod = ov.querySelector('.modal-rodape');
    (botoes || []).forEach((b) => {
      const el = document.createElement('button');
      el.className = 'btn ' + (b.classe || 'btn-sec');
      el.textContent = b.texto;
      if (b.desabilitado) el.disabled = true;
      el.addEventListener('click', () => b.aoClicar ? b.aoClicar(fechar, ov) : fechar());
      rod.appendChild(el);
    });
    if (!botoes || !botoes.length) rod.remove();
    ov.addEventListener('click', (e) => { if (e.target === ov || e.target.hasAttribute('data-fechar')) fechar(); });
    raiz().appendChild(ov); pilha.push(ov);
    const primeiro = ov.querySelector('input,select,textarea'); if (primeiro) primeiro.focus();
    ultimo = { chave, t: Date.now(), fechar };
    return fechar;
  }
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && pilha.length) pilha[pilha.length - 1].querySelector('[data-fechar]').click(); });
  function fecharTodos() { while (pilha.length) pilha.pop().remove(); }
  function fecharModalTopo() {
    if (!pilha.length) return false;
    const topo = pilha[pilha.length - 1];
    const fechar = topo.querySelector('[data-fechar]');
    if (fechar) fechar.click(); else { topo.remove(); pilha.pop(); }
    return true;
  }

  function dialogo({ titulo, mensagem, html, voltar, ok, classeOk, aoOk }) {
    return modal({
      titulo, corpo: html || `<p class="msg">${esc(mensagem)}</p>`,
      botoes: [
        { texto: voltar || 'VOLTAR', classe: 'btn-sec' },
        { texto: ok || 'CONFIRMAR', classe: classeOk || 'btn-verde', aoClicar: (fechar) => { fechar(); aoOk && aoOk(); } }
      ]
    });
  }

  function toast(msg, tipo) {
    const t = document.createElement('div');
    t.className = 'toast ' + (tipo || '');
    t.textContent = msg;
    document.getElementById('toasts').appendChild(t);
    setTimeout(() => t.classList.add('sai'), 3200);
    setTimeout(() => t.remove(), 3700);
  }

  /** Formulário simples. campos: [{nome, rotulo, tipo:'text'|'select'|'date'|'textarea', valor, opcoes:[{valor,texto}]}] */
  function form({ titulo, campos, textoOk, aoEnviar }) {
    const corpo = document.createElement('form');
    corpo.className = 'form';
    corpo.innerHTML = campos.map((c) => {
      let input;
      if (c.tipo === 'select') input = `<select name="${c.nome}">${c.opcoes.map((o) => o.grupo ? `<optgroup label="${esc(o.grupo)}">${o.itens.map((i) => `<option value="${esc(i.valor)}"${i.valor === c.valor ? ' selected' : ''}>${esc(i.texto)}</option>`).join('')}</optgroup>` : `<option value="${esc(o.valor)}"${o.valor === c.valor ? ' selected' : ''}>${esc(o.texto)}</option>`).join('')}</select>`;
      else if (c.tipo === 'textarea') input = `<textarea name="${c.nome}" rows="4">${esc(c.valor || '')}</textarea>`;
      else input = `<input type="${c.tipo || 'text'}" name="${c.nome}" value="${esc(c.valor || '')}" ${c.placeholder ? `placeholder="${esc(c.placeholder)}"` : ''}>`;
      return `<label><span>${esc(c.rotulo)}</span>${input}${c.ajuda ? `<small>${esc(c.ajuda)}</small>` : ''}</label>`;
    }).join('');
    const enviar = (fechar) => {
      const v = {}; new FormData(corpo).forEach((val, k) => (v[k] = val));
      try { aoEnviar(v); fechar(); } catch (e) { toast(e.message, 'erro'); }
    };
    corpo.addEventListener('submit', (e) => { e.preventDefault(); corpo.closest('.overlay').querySelector('.btn-azul').click(); });
    return modal({ titulo, corpo, botoes: [{ texto: 'Cancelar', classe: 'btn-sec' }, { texto: textoOk || 'Salvar', classe: 'btn-azul', aoClicar: enviar }] });
  }

  function dataHora(iso) {
    try { return new Date(iso).toLocaleString('pt-BR', { timeZone: D().TZ, dateStyle: 'short', timeStyle: 'short' }); } catch (e) { return iso; }
  }

  function statusEntrega(d, hoje) {
    if (d.completed) return { texto: 'Entrega realizada', classe: 'tag-verde' };
    if (d.saturday > hoje) return { texto: 'Confirmada (agendada)', classe: 'tag-azul' };
    return { texto: 'Confirmada · aguardando marcar como realizada', classe: 'tag-amarelo' };
  }

  /* ---------- Bolinhas (semáforo) ---------- */
  const EMOJI = { vermelho: '🔴', amarelo: '🟡', verde: '🟢' };
  function bolinha(sem) {
    return `<span class="bolinha b-${sem.cor}" role="img" aria-label="${esc(sem.texto)}" title="${esc(sem.texto)}"></span>`;
  }

  /* ---------- Detalhes de uma família / escolha de família e sábado ----------
     opcoes.sugestao: abre como sugestão (trocar o sábado sugere de novo a família do grupo daquela semana)
     opcoes.sabado:   sábado inicial (padrão: primeiro sábado livre) */
  function abrirFamilia(familyId, opcoes) {
    opcoes = opcoes || {};
    const state = ST().state, hoje = D().hoje();
    if (!G().familia(state, familyId)) return;
    const lista = S().sabadosFuturos(state, hoje, 26);
    const livres = lista.filter((x) => !x.entrega && !x.semReuniao);
    let sab = lista.some((x) => x.iso === opcoes.sabado) ? opcoes.sabado : (livres[0] || lista[0]).iso;
    let fid = familyId, manual = false, podeConfirmar = false, botoesRod = [];
    const corpo = document.createElement('div');

    function desenhar() {
      const fam = G().familia(state, fid), grupo = G().grupo(state, fam.groupId);
      const st = S().stats(state, fam, hoje);
      const sem = S().semaforo(state, fam, sab);
      const grupoSemana = S().grupoDaSemana(state, sab);
      const info = lista.find((x) => x.iso === sab);
      podeConfirmar = fam.active && !info.entrega && !info.semReuniao;
      const ehResp = G().ehResponsavel(state, fam);
      const parts = S().entregasDa(state, fam.id);
      const optSab = lista.map((x) => {
        const rot = D().br(x.iso) + (x.iso === lista[0].iso ? ' (próximo)' : '') + (x.entrega ? ` — já tem ${x.entrega.familyName}` : x.semReuniao ? ' — sem reunião' : ` — ${G().rotulo(S().grupoDaSemana(state, x.iso).name)}`);
        return `<option value="${x.iso}"${x.iso === sab ? ' selected' : ''}>${esc(rot)}</option>`;
      }).join('');
      const optGrupo = state.groups.map((g) => {
        const n = G().familiasAtivas(state, g.id).length;
        return `<option value="${g.id}"${g.id === grupo.id ? ' selected' : ''}${n ? '' : ' disabled'}>${esc(G().rotulo(g.name))}${g.id === grupoSemana.id ? ' — grupo da semana' : ''}${n ? '' : ' (sem famílias)'}</option>`;
      }).join('');
      const optFam = G().familiasAtivas(state, grupo.id).map((f) =>
        `<option value="${f.id}"${f.id === fid ? ' selected' : ''}>${EMOJI[S().semaforo(state, f, sab).cor]} ${esc(f.name)}${G().ehResponsavel(state, f) ? ' ★' : ''}</option>`).join('');

      corpo.innerHTML = `
        <label class="outra"><span>Sábado da entrega</span><select data-sab>${optSab}</select></label>
        ${info.entrega ? `<p class="aviso">O sábado ${D().br(sab)} já tem família confirmada: ${esc(info.entrega.familyName)}. Escolha outra data.</p>` : ''}
        ${info.semReuniao ? `<p class="aviso">O sábado ${D().br(sab)} está marcado como sem reunião. Escolha outra data.</p>` : ''}
        <div class="det-nome">${esc(fam.name)} ${ehResp ? '<span class="tag tag-azul">★ Família do responsável</span>' : ''}${fam.active ? '' : '<span class="tag tag-cinza">Inativa</span>'}</div>
        <dl class="det">
          <dt>Grupo</dt><dd>${esc(G().rotulo(grupo.name))}</dd>
          <dt>Grupo da semana (${D().br(sab)})</dt><dd>${esc(G().rotulo(grupoSemana.name))}</dd>
          <dt>Última entrega</dt><dd>${st.ultima ? D().br(st.ultima) : 'Nunca participou'}</dd>
          <dt>Semanas desde a última entrega</dt><dd>${st.ultima ? D().textoSemanas(st.semanas) : 'Nunca participou'}</dd>
          <dt>Total de entregas</dt><dd>${st.total}</dd>
          <dt>Situação para ${D().br(sab)}</dt><dd class="sit">${bolinha(sem)} <span>${esc(sem.texto)}</span></dd>
        </dl>
        ${fam.active && opcoes.sugestao ? `<div class="escolha-par"><label class="outra"><span>Escolher o grupo</span><select data-grupo>${optGrupo}</select></label>
          <label class="outra"><span>Escolher a família</span><select data-outra>${optFam}</select></label></div>` : ''}
        ${grupo.id !== grupoSemana.id && fam.active ? `<p class="aviso">Esta família é do ${esc(G().rotulo(grupo.name))} e o grupo da semana é o ${esc(G().rotulo(grupoSemana.name))}. Você pode confirmá-la mesmo assim.</p>` : ''}
        ${parts.length ? `<details class="parts"><summary>Participações anteriores (${parts.length})</summary><ul>${parts.map((d) => `<li>${D().br(d.saturday)} — ${esc(G().rotulo(d.groupName))}</li>`).join('')}</ul></details>` : ''}`;
      atualizarBotoes();
    }
    function atualizarBotoes() { if (botoesRod[1]) botoesRod[1].disabled = !podeConfirmar; }

    corpo.addEventListener('change', (e) => {
      if (e.target.matches('[data-sab]')) {
        sab = e.target.value;
        if (opcoes.sugestao && !manual) { const sg = S().sugerir(state, sab, hoje); if (sg.familia) fid = sg.familia.id; }
      } else if (e.target.matches('[data-grupo]')) {
        const novo = S().sugerir(state, sab, hoje, e.target.value);   // melhor família do grupo escolhido
        fid = novo.familia ? novo.familia.id : (G().familiasAtivas(state, e.target.value)[0] || {}).id || fid;
        manual = true;
      } else if (e.target.matches('[data-outra]')) { fid = e.target.value; manual = true; }
      else return;
      desenhar();
    });

    desenhar();
    modal({
      titulo: opcoes.sugestao ? 'Sugestão de família' : 'Detalhes da família', corpo,
      botoes: [
        { texto: '💬 VERIFICAR FAMÍLIA', classe: 'btn-laranja', aoClicar: () => LOD.whatsapp.abrir(state, G().familia(state, fid).name) },
        { texto: '✔ CONFIRMAR', classe: 'btn-verde', aoClicar: () => fluxoConfirmar(fid, sab) }
      ]
    });
    botoesRod = [...corpo.closest('.overlay').querySelectorAll('.modal-rodape .btn')];
    atualizarBotoes();
  }

  /* ---------- Confirmação (alerta -> pergunta -> registro) ---------- */
  function fluxoConfirmar(familyId, sab) {
    const state = ST().state, hoje = D().hoje();
    const fam = G().familia(state, familyId);
    sab = sab || D().proximoSabado(hoje);
    const grupoSemana = S().grupoDaSemana(state, sab);
    const fora = fam.groupId !== grupoSemana.id;
    const pergunta = () => dialogo({
      titulo: 'Confirmar família',
      mensagem: `Tem certeza de que deseja confirmar ${fam.name} para a entrega do sábado ${D().br(sab)}?` +
        (fora ? ` (Família do ${G().rotulo(G().grupo(state, fam.groupId).name)}; o grupo da semana é o ${G().rotulo(grupoSemana.name)}.)` : ''),
      aoOk: () => {
        try {
          S().confirmar(state, fam.id, sab, new Date().toISOString());
          ST().salvar();
        } catch (e) { toast(e.message, 'erro'); return; }
        fecharTodos();
        sucesso(S().entregaDoSabado(state, sab));
      }
    });
    const alerta = S().alertaRecente(state, fam.id, sab, hoje);
    const sem = S().semaforo(state, fam, sab);
    if (alerta) {
      dialogo({
        titulo: 'Atenção: participação recente',
        mensagem: `Essa família já entregou a lembrancinha há ${D().textoSemanas(alerta.semanas)}. A última entrega foi em ${D().br(alerta.data)}.`,
        ok: 'CONTINUAR MESMO ASSIM', classeOk: 'btn-laranja', aoOk: pergunta
      });
    } else if (sem.cor === 'vermelho') {
      dialogo({ titulo: 'Atenção: participação próxima', mensagem: sem.texto + '.', ok: 'CONTINUAR MESMO ASSIM', classeOk: 'btn-laranja', aoOk: pergunta });
    } else pergunta();
  }

  function sucesso(d) {
    const alvo = d.saturday === D().proximoSabado(D().hoje());
    const corpo = `<p class="msg">✔ <strong>${esc(d.familyName)}</strong> (${esc(G().rotulo(d.groupName))}) confirmada para ${D().br(d.saturday)}.${alvo ? ' Os lembretes desta semana foram encerrados.' : ''}</p>
      <p class="msg-sec">Se quiser, adicione ao seu calendário (opcional):</p>`;
    modal({
      titulo: 'Confirmado!', corpo,
      botoes: [
        { texto: 'Google Calendar', classe: 'btn-sec', aoClicar: () => root.open(LOD.calendario.linkGoogle(d), '_blank', 'noopener') },
        { texto: 'Baixar .ics', classe: 'btn-sec', aoClicar: () => LOD.calendario.baixarIcs([d]) },
        { texto: 'Fechar', classe: 'btn-azul' }
      ]
    });
  }

  /* ---------- Detalhes de uma entrega registrada ---------- */
  function abrirEntrega(id) {
    const state = ST().state, hoje = D().hoje();
    const d = state.deliveries.find((x) => x.id === id);
    if (!d) return;
    const st = statusEntrega(d, hoje);
    const corpo = `<div class="det-nome">${esc(d.familyName)}</div>
      <p><span class="tag ${st.classe}">${st.texto}</span></p>
      <dl class="det">
        <dt>Grupo</dt><dd>${esc(G().rotulo(d.groupName))}</dd>
        <dt>Sábado</dt><dd>${D().longa(d.saturday)}</dd>
        <dt>Confirmada em</dt><dd>${d.retroativa ? 'Registro de histórico anterior' : dataHora(d.confirmedAt)}</dd>
      </dl>`;
    modal({
      titulo: 'Entrega', corpo,
      botoes: [
        { texto: d.completed ? 'Desmarcar realizada' : 'Marcar como realizada', classe: 'btn-verde', aoClicar: (f) => { d.completed = !d.completed; ST().salvar(); f(); } },
        { texto: 'Google Calendar', classe: 'btn-sec', aoClicar: () => root.open(LOD.calendario.linkGoogle(d), '_blank', 'noopener') },
        { texto: 'Baixar .ics', classe: 'btn-sec', aoClicar: () => LOD.calendario.baixarIcs([d]) },
        { texto: 'Desfazer confirmação', classe: 'btn-vermelho', aoClicar: (f) => {
          f();
          dialogo({ titulo: 'Desfazer confirmação', mensagem: `Remover ${d.familyName} do sábado ${D().br(d.saturday)}? O ${G().rotulo(d.groupName)} voltará a ficar pendente no rodízio.`, ok: 'REMOVER', classeOk: 'btn-vermelho',
            aoOk: () => { S().desfazer(state, d.id); ST().salvar(); toast('Confirmação desfeita.'); } });
        } }
      ]
    });
  }

  /* ---------- Registrar entrega anterior (histórico) ---------- */
  function registrarAnterior(dataInicial) {
    const state = ST().state;
    const opcoes = state.groups.map((g) => ({ grupo: G().rotulo(g.name), itens: G().familiasAtivas(state, g.id).map((f) => ({ valor: f.id, texto: f.name })) }));
    form({
      titulo: 'Registrar entrega anterior',
      campos: [
        { nome: 'data', rotulo: 'Data (sábado)', tipo: 'date', valor: dataInicial || '' },
        { nome: 'familia', rotulo: 'Família', tipo: 'select', opcoes }
      ],
      textoOk: 'Registrar',
      aoEnviar: (v) => {
        if (!v.data) throw new Error('Informe a data.');
        S().confirmar(state, v.familia, v.data, new Date().toISOString(), { retroativa: true });
        state.deliveries.find((d) => d.saturday === v.data).completed = D().hoje() >= v.data;
        ST().salvar();
        toast('Entrega registrada no histórico.');
      }
    });
  }

  LOD.ui = { esc, modal, dialogo, toast, form, fecharTodos, fecharModalTopo, bolinha, EMOJI, abrirFamilia, abrirEntrega, fluxoConfirmar, registrarAnterior, dataHora, statusEntrega };
})(typeof window !== 'undefined' ? window : globalThis);
