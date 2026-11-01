/* Utilitários de data — sempre no fuso America/Sao_Paulo. Datas são strings ISO "AAAA-MM-DD". */
(function (root) {
  const LOD = (root.LOD = root.LOD || {});
  const TZ = 'America/Sao_Paulo';
  const WD = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  let nowFn = () => new Date(); // substituível em testes

  function partes(date) {
    const f = new Intl.DateTimeFormat('en-CA', {
      timeZone: TZ, year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23', weekday: 'short'
    });
    const o = {};
    f.formatToParts(date).forEach((p) => (o[p.type] = p.value));
    return { iso: `${o.year}-${o.month}-${o.day}`, hour: +o.hour, minute: +o.minute, weekday: WD[o.weekday] };
  }
  const utc = (iso) => { const [y, m, d] = iso.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  const pad = (n) => String(n).padStart(2, '0');
  const isoDeUtc = (ms) => { const d = new Date(ms); return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`; };

  const datas = {
    TZ,
    setNow(fn) { nowFn = fn; },
    agora() { return partes(nowFn()); },
    hoje() { return partes(nowFn()).iso; },
    diaSemana(iso) { return new Date(utc(iso)).getUTCDay(); },
    addDias(iso, n) { return isoDeUtc(utc(iso) + n * 864e5); },
    diffDias(a, b) { return Math.round((utc(b) - utc(a)) / 864e5); },
    /** semanas inteiras entre a data e hoje (nunca negativo) */
    semanasDesde(iso, hojeIso) { return Math.max(0, Math.floor(datas.diffDias(iso, hojeIso || datas.hoje()) / 7)); },
    /** Sábado alvo: hoje, se for sábado; senão o próximo sábado. */
    proximoSabado(hojeIso) {
      const h = hojeIso || datas.hoje();
      return datas.addDias(h, (6 - datas.diaSemana(h) + 7) % 7);
    },
    sabadosDoMes(ano, mes /* 1-12 */) {
      const r = [];
      for (let d = 1; d <= 31; d++) {
        const dt = new Date(Date.UTC(ano, mes - 1, d));
        if (dt.getUTCMonth() !== mes - 1) break;
        if (dt.getUTCDay() === 6) r.push(`${ano}-${pad(mes)}-${pad(d)}`);
      }
      return r;
    },
    br(iso) { const [y, m, d] = iso.split('-'); return `${d}/${m}/${y}`; },
    mes(iso) { return iso.slice(0, 7); },
    nomeMes(ano, mes) {
      return ['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'][mes - 1] + ' ' + ano;
    },
    textoSemanas(n) { return n === 1 ? '1 semana' : `${n} semanas`; },
    longa(iso) {
      return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC', weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' }).format(new Date(utc(iso)));
    }
  };
  LOD.datas = datas;
  if (typeof module !== 'undefined') module.exports = datas;
})(typeof window !== 'undefined' ? window : globalThis);
