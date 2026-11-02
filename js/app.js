/* Aplicação: roteamento, painel, grupos, configurações. */
(function (root) {
  const LOD = (root.LOD = root.LOD || {});
  const D = () => LOD.datas, ST = () => LOD.store, U = () => LOD.ui, S = () => LOD.selecao, G = () => LOD.grupos;
  const esc = (s) => U().esc(s);
  const ROTAS = { painel: 'Painel', historico: 'Histórico', calendario: 'Calendário', grupos: 'Grupos', config: 'Configurações' };

  function rota() { const r = (location.hash || '#/painel').replace('#/', ''); return ROTAS[r] ? r : 'painel'; }

  function render() {
    const r = rota(), cont = document.getElementById('view');
    document.querySelectorAll('[data-rota]').forEach((a) => a.classList.toggle('ativo', a.dataset.rota === r));
    cont.onclick = null;
    if (r === 'painel') painel(cont);
    else if (r === 'historico') LOD.historico.render(cont);
    else if (r === 'calendario') LOD.calendario.render(cont);
    else if (r === 'grupos') paginaGrupos(cont);
    else configuracoes(cont);
  }

  /** Abre a sugestão para um sábado (padrão: o próximo). O argumento pode ser um evento de clique (banner): é ignorado. */
  function abrirSugestao(sabado) {
    const state = ST().state, hoje = D().hoje();
    const sab = typeof sabado === 'string' ? sabado : D().proximoSabado(hoje);
    const sug = S().sugerir(state, sab, hoje);
    if (sug.confirmada) return U().abrirEntrega(sug.confirmada.id);
    if (sug.semReuniao) return U().toast('Este sábado está marcado como sem reunião.');
    if (!sug.familia) return U().toast(sug.motivo || 'Sem sugestão disponível.', 'erro');
    U().abrirFamilia(sug.familia.id, { sugestao: true, sabado: sab });
  }

  /* ---------------- Painel ---------------- */
  let sabVisto = null; // sábado exibido no painel (null = próximo sábado); as setas navegam semana a semana

  function painel(cont) {
    const state = ST().state, hoje = D().hoje(), alvo = D().proximoSabado(hoje);
    const sab = sabVisto || alvo;
    const sug = S().sugerir(state, sab, hoje);
    const confirmada = sug.confirmada, semReuniao = !!sug.semReuniao;
    const passado = sab < hoje && !confirmada && !semReuniao;
    const ultimas = [...state.deliveries].filter((d) => d.saturday <= hoje).sort((a, b) => (a.saturday < b.saturday ? 1 : -1));
    const ultima = ultimas[0];
    const destaque = S().grupoDaSemana(state, sab);
    const grupoSemana = sug.grupo;
    const livre = S().primeiroSabadoAberto(state, hoje);

    let blocoSug;
    if (confirmada) {
      blocoSug = `<button class="sugestao conf" data-acao="sugestao" data-sab="${sab}">
        <span class="sug-titulo">SUGESTÃO</span>
        <span class="sug-nome">${esc(confirmada.familyName)}</span>
        <span class="sug-linha"><span class="tag tag-verde">Confirmada</span> para ${D().br(sab)} · ${esc(G().rotulo(confirmada.groupName))}</span>
        <span class="sug-linha">Esta semana já tem família confirmada; nenhuma outra sugestão é gerada para esta data.</span></button>`;
    } else if (semReuniao) {
      blocoSug = `<div class="sugestao sem"><span class="sug-titulo">SUGESTÃO</span><span class="sug-nome">Sem reunião</span>
        <span class="sug-linha">Não haverá reunião em ${D().br(sab)}: nenhuma família precisa presentear o orador e o rodízio não avança.</span></div>`;
    } else if (passado) {
      blocoSug = `<div class="sugestao sem"><span class="sug-titulo">SEM REGISTRO</span><span class="sug-nome">—</span>
        <span class="sug-linha">Este sábado já passou e não tem entrega registrada.</span>
        <span class="sug-linha"><button class="btn btn-sec" data-acao="registrar" data-sab="${sab}">Registrar entrega</button></span></div>`;
    } else if (!sug.familia) {
      blocoSug = `<div class="sugestao"><span class="sug-titulo">SUGESTÃO</span><span class="sug-nome">—</span><span class="sug-linha">${esc(sug.motivo || '')}</span></div>`;
    } else {
      const f = sug.familia, st = sug.stats, g = sug.grupo;
      blocoSug = `<button class="sugestao" data-acao="sugestao" data-sab="${sab}">
        <span class="sug-titulo">SUGESTÃO</span>
        <span class="sug-nome">${esc(f.name)}</span>
        <span class="sug-grid">
          <span><small>Grupo</small>${esc(G().rotulo(g.name))}</span>
          <span><small>Responsável</small>${g.responsavel ? esc(g.responsavel) : 'Não cadastrado'}</span>
          <span><small>Última entrega</small>${st.ultima ? D().br(st.ultima) : 'Nunca participou'}</span>
          <span><small>Semanas desde a última</small>${st.ultima ? D().textoSemanas(st.semanas) : 'Nunca participou'}</span>
        </span>
        <span class="sug-dica">Toque para ver detalhes, verificar ou confirmar</span></button>`;
    }

    const statusTxt = confirmada ? 'Confirmada' : semReuniao ? 'Sem reunião' : passado ? 'Sem registro' : 'Pendente';
    const statusCls = confirmada ? 'tag-verde' : semReuniao || passado ? 'tag-cinza' : 'tag-amarelo';

    cont.innerHTML = `
      <section class="indicadores">
        <div class="ind"><small>${sab === alvo ? 'Próxima data de entrega' : 'Data de entrega'}</small>
          <div class="data-nav">
            <button class="seta" data-acao="sab-ant" aria-label="Semana anterior" title="Semana anterior">‹</button>
            <strong>${D().br(sab)}</strong>
            <button class="seta" data-acao="sab-prox" aria-label="Próxima semana" title="Próxima semana">›</button>
          </div>
          <span>Sábado${sab !== alvo ? ` · <button class="link" data-acao="sab-hoje">voltar ao próximo sábado</button>` : ''}</span></div>
        <div class="ind"><small>Status da semana</small><strong><span class="tag ${statusCls} grande">${statusTxt}</span></strong></div>
        <div class="ind"><small>Família confirmada</small><strong>${confirmada ? esc(confirmada.familyName) : '—'}</strong></div>
        <div class="ind"><small>Grupo da semana</small><strong>${esc(G().rotulo(grupoSemana.name))}</strong></div>
        <div class="ind"><small>Última entrega</small><strong>${ultima ? esc(ultima.familyName) : 'Nenhuma'}</strong></div>
        <div class="ind"><small>Data da última entrega</small><strong>${ultima ? D().br(ultima.saturday) : '—'}</strong></div>
      </section>
      ${blocoSug}
      ${(confirmada || semReuniao) && livre !== sab ? `<p class="prox-livre"><button class="btn btn-sec" data-acao="sugestao-livre" data-sab="${livre}">📅 Agendar o próximo sábado livre (${D().br(livre)})</button></p>` : ''}
      <nav class="acesso">
        <a href="#/historico" class="btn btn-sec">📋 Histórico de entregas</a>
        <a href="#/calendario" class="btn btn-sec">📅 Calendário</a>
        <a href="#/grupos" class="btn btn-sec">👥 Gerenciar grupos</a>
        <a href="#/config" class="btn btn-sec">⚙ Configurações</a>
      </nav>
      ${state.deliveries.length === 0 ? `<p class="dica-inicial">Dica: para a sugestão refletir quem está há mais tempo sem entregar, registre as entregas antigas em <a href="#/historico">Histórico</a> → “Registrar entrega anterior”.</p>` : ''}
      <section class="grupos-grid">
        ${state.groups.map((g) => {
          const fams = G().familiasAtivas(state, g.id);
          return `<div class="tabela-grupo${g.id === destaque.id ? ' da-vez' : ''}">
            <table><thead><tr><th>${esc(G().rotulo(g.name))}${g.id === destaque.id ? ` <span class="tag tag-vez">${sab === alvo ? 'da vez' : 'da semana'}</span>` : ''}${g.responsavel ? `<small>Resp.: ${esc(g.responsavel)}</small>` : ''}</th></tr></thead>
            <tbody>${fams.map((f) => `<tr><td><button class="cel-fam" data-familia="${f.id}"><span class="cel-nome">${esc(f.name)}${G().ehResponsavel(state, f) ? ' <span class="estrela" title="Família do responsável">★</span>' : ''}</span>${U().bolinha(S().semaforo(state, f, sab))}</button></td></tr>`).join('') || '<tr><td class="vazio">Sem famílias</td></tr>'}</tbody></table></div>`;
        }).join('')}
      </section>`;

    cont.onclick = (e) => {
      const t = e.target.closest('[data-acao],[data-familia]');
      if (!t) return;
      const a = t.dataset.acao;
      if (a === 'sugestao' || a === 'sugestao-livre') abrirSugestao(t.dataset.sab);
      else if (a === 'registrar') U().registrarAnterior(t.dataset.sab);
      else if (a === 'sab-ant') { sabVisto = D().addDias(sab, -7); render(); }
      else if (a === 'sab-prox') { sabVisto = D().addDias(sab, 7); render(); }
      else if (a === 'sab-hoje') { sabVisto = null; render(); }
      else if (t.dataset.familia) U().abrirFamilia(t.dataset.familia, { sabado: sab >= alvo ? sab : undefined });
    };
  }

  /* ---------------- Grupos ---------------- */
  function paginaGrupos(cont) {
    const state = ST().state;
    cont.innerHTML = `<div class="pagina-topo"><h2>GRUPOS E FAMÍLIAS</h2></div>
      ${state.groups.map((g) => {
        const ativas = G().familiasAtivas(state, g.id);
        const inativas = state.families.filter((f) => !f.active && f.groupId === g.id);
        const fr = g.familiaResponsavelId ? G().familia(state, g.familiaResponsavelId) : null;
        return `<div class="card grupo-card">
          <div class="grupo-topo"><h3>${esc(G().rotulo(g.name))}</h3><div>
            <button class="btn btn-sec" data-acao="renomear" data-g="${g.id}">Renomear</button>
            <button class="btn btn-azul" data-acao="resp" data-g="${g.id}">Responsável</button>
            <button class="btn btn-verde" data-acao="add" data-g="${g.id}">+ Família</button></div></div>
          <p class="resp-info"><strong>Responsável:</strong> ${g.responsavel ? esc(g.responsavel) : '<em>não cadastrado</em>'} · <strong>Família do responsável:</strong> ${fr ? esc(fr.name) : '<em>não definida</em>'}</p>
          <ul class="fam-lista">${ativas.map((f) => `<li><span>${esc(f.name)}${G().ehResponsavel(state, f) ? ' <span class="estrela">★</span>' : ''}</span>
            <span class="fam-botoes"><button class="link" data-acao="editar" data-f="${f.id}">Editar</button><button class="link" data-acao="mover" data-f="${f.id}">Mover</button><button class="link perigo" data-acao="remover" data-f="${f.id}">Excluir</button></span></li>`).join('') || '<li class="vazio">Sem famílias ativas</li>'}</ul>
          ${inativas.length ? `<details><summary>Excluídas (${inativas.length}) — histórico preservado</summary><ul class="fam-lista">${inativas.map((f) => `<li><span>${esc(f.name)}</span><button class="link" data-acao="reativar" data-f="${f.id}">Reativar</button></li>`).join('')}</ul></details>` : ''}
        </div>`;
      }).join('')}`;

    const salvar = () => { ST().salvar(); };
    cont.onclick = (e) => {
      const t = e.target.closest('[data-acao]');
      if (!t) return;
      const st = ST().state, a = t.dataset.acao, gid = t.dataset.g, fid = t.dataset.f;
      if (a === 'add') U().form({ titulo: 'Nova família — ' + G().rotulo(G().grupo(st, gid).name), campos: [{ nome: 'nome', rotulo: 'Nome da família' }], aoEnviar: (v) => { G().adicionarFamilia(st, v.nome, gid); salvar(); U().toast('Família adicionada.'); } });
      else if (a === 'editar') U().form({ titulo: 'Editar família', campos: [{ nome: 'nome', rotulo: 'Nome', valor: G().familia(st, fid).name }], aoEnviar: (v) => { G().editarFamilia(st, fid, v.nome); salvar(); } });
      else if (a === 'mover') U().form({ titulo: 'Mover para outro grupo', campos: [{ nome: 'g', rotulo: 'Novo grupo', tipo: 'select', valor: G().familia(st, fid).groupId, opcoes: st.groups.map((g) => ({ valor: g.id, texto: G().rotulo(g.name) })) }], textoOk: 'Mover', aoEnviar: (v) => { G().moverFamilia(st, fid, v.g); salvar(); U().toast('O histórico permanece com o grupo da época.'); } });
      else if (a === 'remover') U().dialogo({ titulo: 'Excluir família', mensagem: `Excluir “${G().familia(st, fid).name}” da lista ativa? O histórico de entregas será mantido.`, ok: 'EXCLUIR', classeOk: 'btn-vermelho', aoOk: () => { G().removerFamilia(st, fid); salvar(); } });
      else if (a === 'reativar') { G().reativarFamilia(st, fid); salvar(); }
      else if (a === 'renomear') U().form({ titulo: 'Renomear grupo', campos: [{ nome: 'nome', rotulo: 'Nome do grupo', valor: G().grupo(st, gid).name }], aoEnviar: (v) => { G().renomearGrupo(st, gid, v.nome); salvar(); } });
      else if (a === 'resp') {
        const g = G().grupo(st, gid);
        U().form({ titulo: 'Responsável — ' + G().rotulo(g.name),
          campos: [
            { nome: 'nome', rotulo: 'Nome do responsável', valor: g.responsavel, placeholder: 'Pode ser diferente do nome da família' },
            { nome: 'fam', rotulo: 'Família do responsável', tipo: 'select', valor: g.familiaResponsavelId || '', ajuda: 'Essa família terá prioridade menor na sugestão.', opcoes: [{ valor: '', texto: '— não definida —' }, ...G().familiasAtivas(st, gid).map((f) => ({ valor: f.id, texto: f.name }))] }
          ], aoEnviar: (v) => { G().definirResponsavel(st, gid, v.nome, v.fam); salvar(); } });
      }
    };
  }

  /* ---------------- Configurações ---------------- */
  function configuracoes(cont) {
    const state = ST().state, s = state.settings, daVez = S().grupoDaVez(state);
    const modo = ST().modo;
    const perm = LOD.notificacoes.permissao();
    const nat = !!(LOD.android && LOD.android.nativo());
    const modoTxt = modo === 'servidor' ? '🟢 Conectado ao servidor — dados sincronizados entre dispositivos e lembretes em segundo plano disponíveis.' : modo === 'servidor-sem-acesso' ? '🔴 Servidor encontrado, mas o token está incorreto.' : '🟡 Modo local — dados salvos só neste navegador; lembretes só com o site aberto.';
    cont.innerHTML = `<div class="pagina-topo"><h2>CONFIGURAÇÕES</h2></div>
      <div class="card"><h3>Armazenamento e servidor</h3><p>${modoTxt}</p>
        <div class="form linha"><label><span>Endereço do servidor (vazio = mesmo site)</span><input id="c-back" value="${esc(localStorage.getItem('lod_backend') || '')}" placeholder="https://meu-servidor.exemplo.com"></label>
        <label><span>Token (se configurado no servidor)</span><input id="c-token" type="password" value="${esc(localStorage.getItem('lod_token') || '')}"></label></div>
        <button class="btn btn-azul" data-acao="salvar-servidor">Salvar e reconectar</button></div>

      <div class="card"><h3>Rodízio</h3>
        <p>Grupo da vez: <strong>${esc(G().rotulo(daVez.name))}</strong>. O rodízio só avança quando uma família é confirmada.</p>
        <div class="form linha"><label><span>Definir grupo da vez</span><select id="c-grupo">${state.groups.map((g) => `<option value="${g.id}"${g.id === daVez.id ? ' selected' : ''}>${esc(G().rotulo(g.name))}</option>`).join('')}</select></label></div>
        <button class="btn btn-sec" data-acao="definir-grupo">Definir</button>
        <button class="btn btn-laranja" data-acao="pular">Pular grupo da vez</button>
        ${state.rotation.log.length ? `<details><summary>Ações administrativas (${state.rotation.log.length})</summary><ul class="lista-simples">${state.rotation.log.slice().reverse().map((l) => `<li>${U().dataHora(l.em)} — ${l.acao === 'pular' ? 'pulou' : 'definiu'} ${esc(G().rotulo(l.grupoNome))}</li>`).join('')}</ul></details>` : ''}</div>

      <div class="card"><h3>Prioridade da família do responsável</h3>
        <div class="form linha"><label><span>Semanas a mais de espera exigidas para ela ser sugerida</span><input id="c-pen" type="number" min="0" max="52" value="${s.penalidadeResponsavelSemanas}"></label></div>
        <p class="ajuda">Ela só é sugerida se estiver esperando pelo menos esse tanto a mais que a melhor das demais famílias do grupo (ou se for a única). Use 0 para tratá-la como as outras.</p></div>

      <div class="card"><h3>WhatsApp</h3>
        <div class="form"><label><span>Número (com DDI e DDD, só dígitos)</span><input id="c-zap" value="${esc(s.whatsappNumber)}"></label>
        <label><span>Mensagem (use [NOME DA FAMÍLIA SELECIONADA])</span><textarea id="c-msg" rows="4">${esc(s.messageTemplate)}</textarea></label></div>
        <button class="btn btn-azul" data-acao="salvar-zap">Salvar</button> <button class="btn btn-sec" data-acao="zap-padrao">Restaurar padrão</button></div>

      <div class="card"><h3>Lembretes</h3>
        <p>Quarta a sábado, nos horários abaixo, enquanto o sábado alvo não tiver família confirmada. Abrir o site ou clicar numa notificação <strong>não</strong> cancela nada.</p>
        <div class="form linha"><label><span>Horas (separadas por vírgula)</span><input id="c-horas" value="${s.lembreteHoras.join(', ')}"></label>
        <label><span>Tópico ntfy (para celular com o site fechado)</span><input id="c-ntfy" value="${esc(s.ntfyTopic)}" placeholder="ex.: lembrancinha-gustavo-x7k2"></label></div>
        ${nat ? `<input type="checkbox" id="c-notif" hidden ${s.notificacoesNavegador ? 'checked' : ''}><p id="c-nat">Verificando notificações do Android…</p>` : `<label class="check"><input type="checkbox" id="c-notif" ${s.notificacoesNavegador ? 'checked' : ''}> Notificações do navegador (precisam de permissão e do site/navegador aberto)</label>
        <p>Permissão do navegador: <strong>${perm === 'granted' ? 'concedida' : perm === 'denied' ? 'bloqueada' : perm === 'indisponivel' ? 'indisponível neste navegador' : 'ainda não pedida'}</strong></p>`}
        <button class="btn btn-azul" data-acao="salvar-lembretes">Salvar</button>
        ${nat ? `<button class="btn btn-sec" data-acao="teste-nativo">Testar notificação (5 s)</button>
        <button class="btn btn-sec" data-acao="reagendar">Reagendar agora</button>` : `<button class="btn btn-sec" data-acao="permissao">Permitir notificações</button>
        <button class="btn btn-sec" data-acao="teste-local">Testar notificação aqui</button>`}
        <button class="btn btn-sec" data-acao="teste-push"${modo === 'servidor' ? '' : ' disabled title="Requer o backend"'}>Testar push do servidor</button></div>

      <div class="card"><h3>Backup</h3>
        <p>O backup inclui grupos, responsáveis, famílias, histórico, rodízio e configurações.</p>
        <button class="btn btn-azul" data-acao="exportar">Exportar backup (JSON)</button>
        <button class="btn btn-sec" data-acao="importar">Importar backup…</button>
        <input type="file" id="c-arq" accept="application/json,.json" hidden></div>`;
    if (nat) LOD.android.resumo().then((h) => { const n = document.getElementById('c-nat'); if (n) n.innerHTML = h; }).catch(() => {});

    const $ = (id) => document.getElementById(id);
    $('c-arq').addEventListener('change', async (e) => {
      const arq = e.target.files[0]; if (!arq) return;
      const r = ST().lerBackup(await arq.text());
      if (r.erros) return U().modal({ titulo: 'Backup inválido', corpo: `<ul class="lista-simples">${r.erros.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>`, botoes: [{ texto: 'Fechar', classe: 'btn-azul' }] });
      const atual = ST().state;
      U().dialogo({ titulo: 'Substituir dados atuais?', ok: 'SUBSTITUIR', classeOk: 'btn-vermelho',
        html: `<p>Atual: <strong>${atual.deliveries.length}</strong> entregas, <strong>${atual.families.length}</strong> famílias.<br>Backup: <strong>${r.resumo.entregas}</strong> entregas, <strong>${r.resumo.familias}</strong> famílias (gerado em ${esc(r.resumo.data)}).</p><p>Uma cópia do estado atual será guardada neste navegador antes da troca. Recomendamos exportar um backup agora.</p>`,
        aoOk: () => { ST().aplicarImportacao(r.obj); U().toast('Backup importado.'); } });
    });

    cont.onclick = async (e) => {
      const t = e.target.closest('[data-acao]'); if (!t) return;
      const a = t.dataset.acao, st = ST().state;
      try {
        if (a === 'salvar-servidor') { localStorage.setItem('lod_backend', $('c-back').value.trim()); localStorage.setItem('lod_token', $('c-token').value); location.reload(); }
        else if (a === 'definir-grupo') { S().definirGrupoDaVez(st, $('c-grupo').value, new Date().toISOString()); ST().salvar(); U().toast('Grupo da vez atualizado.'); }
        else if (a === 'pular') U().dialogo({ titulo: 'Pular grupo', mensagem: `Pular o ${G().rotulo(daVez.name)} e passar a vez ao próximo? Esta ação fica registrada.`, ok: 'PULAR', classeOk: 'btn-laranja', aoOk: () => { S().pularGrupo(st, new Date().toISOString()); ST().salvar(); } });
        else if (a === 'salvar-zap') { st.settings.whatsappNumber = $('c-zap').value.replace(/\D/g, ''); st.settings.messageTemplate = $('c-msg').value.trim() || G().MSG_PADRAO; ST().salvar(); U().toast('WhatsApp salvo.'); }
        else if (a === 'zap-padrao') { st.settings.messageTemplate = G().MSG_PADRAO; st.settings.whatsappNumber = '5511962662443'; ST().salvar(); }
        else if (a === 'salvar-lembretes') {
          const horas = [...new Set($('c-horas').value.split(/[,;\s]+/).filter(Boolean).map(Number))];
          if (!horas.length || horas.some((h) => !Number.isInteger(h) || h < 0 || h > 23)) throw new Error('Informe horas entre 0 e 23, separadas por vírgula.');
          st.settings.lembreteHoras = horas.sort((x, y) => x - y); st.settings.ntfyTopic = $('c-ntfy').value.trim(); st.settings.notificacoesNavegador = $('c-notif').checked;
          const pen = Number($('c-pen').value); if (pen >= 0) st.settings.penalidadeResponsavelSemanas = pen;
          ST().salvar(); U().toast('Lembretes salvos.');
        }
        else if (a === 'teste-nativo') { await LOD.android.testar(); U().toast('Sairá uma notificação em 5 segundos. Pode sair do app para ver.'); }
        else if (a === 'reagendar') { await LOD.android.sincronizar(); const n = document.getElementById('c-nat'); if (n) n.innerHTML = await LOD.android.resumo(); U().toast('Lembretes reagendados.'); }
        else if (a === 'permissao') { const r = await LOD.notificacoes.pedirPermissao(); U().toast('Permissão: ' + r); configuracoes(cont); }
        else if (a === 'teste-local') { if (LOD.notificacoes.permissao() !== 'granted') throw new Error('Permita as notificações primeiro.'); new Notification('Lembrancinha do orador', { body: 'Teste: as notificações do navegador funcionam.' }); }
        else if (a === 'teste-push') { const r = await fetch(ST()._url('teste'), { method: 'POST', headers: ST()._headers() }); const j = await r.json().catch(() => ({})); U().toast(r.ok ? 'Push enviado.' : (j.erro || 'Falha ao enviar.'), r.ok ? '' : 'erro'); }
        else if (a === 'exportar') ST().exportar();
        else if (a === 'importar') $('c-arq').click();
        if (a === 'salvar-zap' || a === 'zap-padrao' || a === 'definir-grupo') render();
      } catch (err) { U().toast(err.message, 'erro'); }
    };
  }

  async function iniciar() {
    await ST().iniciar();
    ST().aoMudar(render);
    root.addEventListener('hashchange', render);
    document.getElementById('banner-lembrete').addEventListener('click', abrirSugestao);
    document.getElementById('modo-tag').textContent = ST().modo === 'servidor' ? 'sincronizado' : 'local';
    render();
    LOD.notificacoes.iniciar();
    if (LOD.android) LOD.android.iniciar();   // só faz algo dentro do app Android
    // atualiza o painel quando o dia vira (sábado alvo muda) sem precisar recarregar
    let diaAtual = D().hoje();
    setInterval(() => { if (D().hoje() !== diaAtual) { diaAtual = D().hoje(); sabVisto = null; render(); } }, 60000);
  }

  LOD.app = { iniciar, abrirSugestao, render };
  document.addEventListener('DOMContentLoaded', iniciar);
})(window);
