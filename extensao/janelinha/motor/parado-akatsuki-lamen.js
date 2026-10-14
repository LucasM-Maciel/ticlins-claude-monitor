'use strict';
// Tema Akatsuki, parado há muito tempo: o ninja COME UM LÁMEN. Um puf na frente dele e aparece uma
// tigela fumegando na borda do cartão; ele senta do lado e come com os hashis, sem pressa: mergulha,
// levanta o macarrão até a boca, chupa, mastiga (a cada três garfadas, de olho fechado). O vapor
// sobe da tigela o tempo todo. Na saída (algo voltou a rodar) a tigela vira fumaça e ele levanta.
// Tudo função do tempo (a garfada é um ciclo fixo; o vapor, um seno).
const A = require('./akatsuki-arte');
const { arte, rgba } = require('./comum');

const { fatia, sai } = A;
const T = { puf: 0.05, tigela: 0.25, senta: 0.5, sentou: 0.7, come: 1.2 };
const GARFADA = 3.2;  // s por garfada
const X = 19.5;  // o meio da tigela

// a tigela (10x6, 1 px = P): caldo, macarrão, meio ovo e cebolinha; louça vermelha de faixa branca
const TIGELA = [
  '.cccnnccc.',
  'ccnnoyccgc',
  'wvvvvvvvvw',
  '.vvbbbbvv.',
  '..vvvvvv..',
  '...kkkk...',
];
const COR_TIGELA = { c: '#F59E0B', n: '#FDE68A', o: '#F9FAFB', y: '#FACC15', g: '#4ADE80', w: '#F3F4F6', v: '#B91C1C', b: '#F3F4F6', k: '#7F1D1D' };
const TW = 10 * A.P, TH = 6 * A.P;
const tigela = () => arte(TIGELA, COR_TIGELA);

// onde estão a mão e a ponta dos hashis, e quanto macarrão pende (px), no instante u da garfada
function garfada(u) {
  const MAO0 = [10, -6], PONTA0 = [17, -5];  // descansando, as pontas na tigela
  const lerp = (a, b, k) => [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
  if (u < 0.8) { const k = sai(fatia(u, 0, 0.8)); return { mao: lerp(MAO0, [12, -4], k), ponta: lerp(PONTA0, [18.5, -3.5], k), fio: 0 }; }
  if (u < 1.4) { const k = sai(fatia(u, 0.8, 1.4)); return { mao: lerp([12, -4], [8, -9], k), ponta: lerp([18.5, -3.5], [7, -8], k), fio: 6 * k }; }
  if (u < 1.8) return { mao: [8, -9], ponta: [7, -8], fio: 6 * (1 - fatia(u, 1.4, 1.8)) };
  const k = sai(fatia(u, 1.8, 2.4));
  return { mao: lerp([8, -9], MAO0, k), ponta: lerp([7, -8], PONTA0, k), fio: 0 };
}
function hashis(g, mao, ponta, fio) {
  g.save();
  g.strokeStyle = '#C08A4E'; g.lineWidth = 0.8;
  for (const d of [0, 1]) { g.beginPath(); g.moveTo(mao[0] + 1, mao[1] + d); g.lineTo(ponta[0], ponta[1] + d * 0.5); g.stroke(); }
  g.restore();
  if (fio > 0.3) {  // o macarrão pendurado
    g.fillStyle = COR_TIGELA.n;
    for (const dx of [-0.5, 0.5, 1.5]) g.fillRect(ponta[0] + dx, ponta[1] + 1, 0.8, fio * (dx > 1 ? 0.7 : 1));
  }
  A.maoNa(g, mao[0], mao[1]);
}
// o vapor: três fios ondulando pra cima
function vapor(g, t, alfa = 1) {
  for (let i = 0; i < 3; i++) {
    const fase = i * 2.1, x0 = X - 4 + i * 4;
    for (let k = 0; k < 6; k++) {
      const s = ((t * 0.9 + i * 0.33 + k / 6) % 1), y = -TH - 1 - s * 14;
      g.fillStyle = rgba('#E5E7EB', 0.45 * alfa * (1 - s));
      g.fillRect(x0 + Math.sin(s * 6 + fase + t) * 1.5, y, 1, 1.5);
    }
  }
}
function clawdComendo(g, t, m) {
  const sentado = t >= T.sentou, comendo = t >= T.come;
  const u = comendo ? (t - T.come) % GARFADA : 0, n = comendo ? Math.floor((t - T.come) / GARFADA) : 0;
  const mastiga = comendo && u >= 1.8 && u < 2.8;
  A.clawdAkatsuki(g, {
    T: m.T, x: -2, sentado,
    sy: t >= T.senta && t < T.sentou ? 1 - 0.12 * Math.sin(Math.PI * fatia(t, T.senta, T.sentou)) : mastiga ? 1 - 0.025 * (Math.floor(u * 8) % 2) : 1,
    olhos: mastiga && n % 3 === 2 ? 'fechados' : 'abertos',
    mao: comendo && function (k) { const p = garfada(u); hashis(k, [p.mao[0] + 2, p.mao[1]], [p.ponta[0] + 2, p.ponta[1]], p.fio); },
  });
}

module.exports = {
  texturas: [],
  linhaDoTempo: [
    [0, 'em pé'], [T.puf, 'puf na frente dele'], [T.tigela, 'a tigela de lámen aparece na borda, fumegando'],
    [T.senta, 'senta do lado'], [T.come, `come: uma garfada a cada ${GARFADA} s (mergulha, levanta, chupa, mastiga; a cada 3, de olho fechado)`],
  ],
  cena() {
    return {
      nome: 'parado', dur: Infinity, espaco: { frente: 0, tras: 0 }, modos: ['parado'],
      quadro(g, t, m) {
        A.acimaDoCartao(g, () => {
          if (t >= T.tigela) { g.drawImage(tigela(), X - TW / 2, -TH, TW, TH); vapor(g, t, fatia(t, T.tigela, T.tigela + 1)); }
          if (t < T.come) A.clawdAkatsuki(g, { T: m.T, x: t < T.senta ? 0 : -2 * fatia(t, T.senta, T.sentou), sentado: t >= T.sentou });
          else clawdComendo(g, t, m);
          A.puf(g, X, -4, fatia(t, T.puf, T.puf + 0.5), 4217, 0.7);
        });
      },
    };
  },
  // algo voltou a rodar: a tigela vira fumaça e ele levanta (0,8 s)
  saida: {
    dur: 0.8,
    quadro(g, u, m, tCorte) {
      A.acimaDoCartao(g, () => {
        const tinha = (tCorte || 0) >= T.tigela, sentado = (tCorte || 0) >= T.sentou && u < 0.4;
        if (tinha && u < 0.12) g.drawImage(tigela(), X - TW / 2, -TH, TW, TH);
        const sy = !sentado && u >= 0.4 && u < 0.65 ? 1 + 0.07 * Math.sin(Math.PI * fatia(u, 0.4, 0.65)) : 1;
        A.clawdAkatsuki(g, { T: m.T, x: sentado ? -2 : -2 * (1 - fatia(u, 0.4, 0.7)), sentado, sy });
        if (tinha) A.puf(g, X, -4, fatia(u, 0, 0.45), 4219, 0.7);
      });
    },
  },
};
