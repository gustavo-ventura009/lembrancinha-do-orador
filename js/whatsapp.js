/* WhatsApp: apenas abre a conversa (wa.me) com a mensagem preenchida. Nada é enviado automaticamente. */
(function (root) {
  const LOD = (root.LOD = root.LOD || {});
  const W = {
    mensagem(state, nomeFamilia) {
      const modelo = state.settings.messageTemplate || LOD.grupos.MSG_PADRAO;
      return modelo.split('[NOME DA FAMÍLIA SELECIONADA]').join(nomeFamilia);
    },
    link(state, nomeFamilia) {
      const num = String(state.settings.whatsappNumber || '5511962662443').replace(/\D/g, '');
      return 'https://wa.me/' + num + '?text=' + encodeURIComponent(W.mensagem(state, nomeFamilia));
    },
    abrir(state, nomeFamilia) { root.open(W.link(state, nomeFamilia), '_blank', 'noopener'); }
  };
  LOD.whatsapp = W;
  if (typeof module !== 'undefined') module.exports = W;
})(typeof window !== 'undefined' ? window : globalThis);
