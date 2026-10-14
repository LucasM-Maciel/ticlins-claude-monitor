'use strict';
// Tema Akatsuki, parado há muito tempo: o ninja TREINA KUNAI. Um puf na frente dele e aparece um
// poste de madeira com um alvo pintado; ele joga uma kunai a cada 2,4 s, em três alturas, e elas
// ficam cravadas; na quarta vez, faz selos e as três viram fumaça (e recomeça). O poste treme a
// cada acerto. Na saída (algo voltou a rodar) o poste e as kunais viram fumaça.
// Tudo função do tempo (o ciclo é fixo).
const A = require('./akatsuki-arte');

const { fatia, sai } = A;
const T = { puf: 0.05, poste: 0.25, comeca: 1.0 };
const CICLO = 2.4, ALTURAS = [-15, -9, -20];  // s por jogada; onde cada kunai crava
const PX = 34, PW = 8, PH = 26;  // o poste: x da frente (onde a kunai crava), largura, altura
const VOO = [0.32, 0.55];  // a kunai sai da mão e crava

function poste(g, tre = 0) {
  const x = PX + tre;
  g.fillStyle = '#5B3416'; g.fillRect(x - 0.5, -PH - 0.5, PW + 1, PH + 0.5);
  g.fillStyle = '#8B5A2B'; g.fillRect(x, -PH, PW, PH);
  g.fillStyle = '#A06A35'; g.fillRect(x + 1, -PH, 1.5, PH);
  g.fillStyle = '#6B4423'; for (const y of [-22, -12, -5]) g.fillRect(x + 4, y, 3, 0.8);
  g.fillStyle = '#C08A4E'; g.fillRect(x, -PH, PW, 1.5);  // a ponta serrada
  // o alvo pintado
  for (const [r, cor] of [[3.8, '#F3F4F6'], [2.6, '#DC2626'], [1.2, '#F3F4F6']]) { g.fillStyle = cor; g.beginPath(); g.arc(x + PW / 2, -15, r, 0, Math.PI * 2); g.fill(); }
  // a corda em volta do pé
  g.fillStyle = '#D6B26E'; g.fillRect(x - 0.5, -3.5, PW + 1, 1); g.fillRect(x - 0.5, -2, PW + 1, 0.8);
}
// a jogada da vez: n (quantas já), u (s dentro dela)
function jogada(t) {
  if (t < T.comeca) return { n: -1, u: 0 };
  const n = Math.floor((t - T.comeca) / CICLO);
  return { n, u: t - T.comeca - n * CICLO };
}
function cena(g, t, m) {
  const { n, u } = jogada(t), rodada = n >= 0 ? n % 4 : -1, limpa = rodada === 3;
  const cravadas = n < 0 ? 0 : limpa ? 3 : rodada + (u >= VOO[1] ? 1 : 0);
  const acerto = !limpa && rodada >= 0 && u >= VOO[1] && u < VOO[1] + 0.2;
  // as kunais cravadas (antes do poste: a ponta some dentro dele)
  const some = limpa ? fatia(u, 0.9, 1.0) : 0;
  for (let i = 0; i < cravadas && some < 1; i++) A.kunai(g, PX + 2, ALTURAS[i], 0, 1);
  if (t >= T.poste) poste(g, acerto ? Math.sin(u * 90) * 0.6 : 0);
  // a voando
  if (!limpa && rodada >= 0 && u >= VOO[0] && u < VOO[1]) {
    const k = fatia(u, VOO[0], VOO[1]), y0 = -12, y1 = ALTURAS[rodada];
    A.kunai(g, 10 + (PX + 2 - 10) * k, y0 + (y1 - y0) * k - 3 * Math.sin(Math.PI * k), 0, 1);
  }
  // ele: puxa a mão pra trás e joga; na limpeza, faz selos
  const vai = rodada >= 0 && !limpa ? fatia(u, 0.05, 0.3) : 0, solta = fatia(u, 0.3, 0.38);
  A.clawdAkatsuki(g, {
    T: m.T, x: -1.5 * vai * (1 - solta) + 1 * solta * (1 - fatia(u, 0.6, 0.9)),
    selo: limpa && u >= 0.3 && u < 0.95 ? A.seloEm(u) : null,
    mao: !limpa && rodada >= 0 && u < 0.7 && function (k, dy) { A.maoNa(k, 2 + 7 * sai(solta) - 3 * vai * (1 - solta), -14 + 3 * solta + dy); },
  });
  if (limpa) A.puf(g, PX + 1, -15, fatia(u, 0.9, 1.4), 7717 + n, 0.7);
  A.puf(g, PX + PW / 2, -12, fatia(t, T.puf, T.puf + 0.5), 7711, 0.9);
}

module.exports = {
  texturas: [],
  linhaDoTempo: [
    [0, 'em pé'], [T.puf, 'puf na frente dele'], [T.poste, 'aparece o poste com o alvo'],
    [T.comeca, `joga uma kunai a cada ${CICLO} s em três alturas; na 4ª vez, selos e as três viram fumaça`],
  ],
  cena() {
    return {
      nome: 'parado', dur: Infinity, espaco: { frente: 0, tras: 0 }, modos: ['parado'],
      quadro(g, t, m) { A.acimaDoCartao(g, () => cena(g, t, m)); },
    };
  },
  // algo voltou a rodar: o poste e as kunais viram fumaça (0,6 s)
  saida: {
    dur: 0.6,
    quadro(g, u, m, tCorte) {
      A.acimaDoCartao(g, () => {
        const c = tCorte || 0;
        if (c >= T.poste && u < 0.1) poste(g);
        A.clawdAkatsuki(g, { T: m.T });
        if (c >= T.poste) A.puf(g, PX + PW / 2, -12, fatia(u, 0, 0.5), 7713, 0.9);
      });
    },
  },
};
