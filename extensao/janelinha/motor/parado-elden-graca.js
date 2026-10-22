'use strict';
// Tema Elden Ring, parado há muito tempo: ele DESCANSA NA GRAÇA. Crava a espada no chão, senta ao lado da graça
// (o facho dourado e a pequena lâmina de ouro no chão) e a Árvore Dourada brilha ao longe, em silhueta. Em ciclos
// de 16 s, com a hora sorteada por ciclo: ele ergue o olhar pro brilho da árvore (ela acende), fecha os olhos e a
// graça pulsa (o facho cresce, o pó dourado sobe em rajada), e no fim dá um suspiro. A espada cravada também
// aparece no Torrent (parado-elden-torrent.js usa espadaNoChao). Tudo função do tempo; a semente fica em
// m.estado.eldenGraca (pra saída).
const A = require('./elden-arte');
const { arte, rgba, rng } = require('./comum');

const { fatia, COR } = A;
const suave = u => u * u * (3 - 2 * u);
const T = { senta: 0.5, sentou: 0.8, espeta: 0.9, graca0: 1.0, graca1: 2.4, inicio: 2.8 };
const CICLO = 16;
// onde cada coisa fica (DIPs, referencial do Clawd; chão em y = 0)
const CLAWD_X = -6, ESPADA_X = -27, GRACA_X = 20, ARVORE = { x: 46, w: 56, alt: 76 };

// a lâmina de ouro da graça, deitada no chão (16x3): guarda à esquerda, ponta branca à direita
const LAMINA = [
  '.g..yyyyyyy.....',
  'gGGyyYYYYYYYyyw.',
  '.g..yyyyyyy.....',
];
const COR_LAMINA = { g: COR.ouroEsc, G: COR.ouro, y: '#E8C766', Y: COR.ouroClaro, w: '#FFFBEB' };

// a arma de cada roupa, cravada: o quanto aparece acima do chão e o cabo
const ESPADAS = {
  'elden-cavaleiro': { lamina: 7, larg: 2, cor: '#E5E7EB', borda: '#6B7280', guarda: 4, cabo: 4 },
  'elden-bandido': { lamina: 3, larg: 1.5, cor: '#D1D5DB', borda: '#4B5563', guarda: 3, cabo: 3 },
  'elden-feiticeiro': { lamina: 15, larg: 1.5, cor: '#7C5A2E', borda: '#3B2B16', guarda: 0, cabo: 0 },
};
// a arma da roupa vestida, de ponta-cabeça no chão em x. alfa e queda: pra aparecer e sumir; brilho 0..1: o reflexo que passa
function espadaNoChao(g, x, alfa = 1, queda = 0, brilho = 0) {
  const E = ESPADAS[COR.roupa] || ESPADAS['elden-cavaleiro'];
  if (alfa <= 0) return;
  g.save(); g.translate(Math.round(x), -queda); g.globalAlpha *= alfa;
  const l = E.lamina, w = E.larg;
  g.fillStyle = COR.ouroFundo; g.fillRect(-4, -1, 8, 1.5); g.fillStyle = COR.ouroEsc; g.fillRect(-3, -1.5, 6, 1);  // o montinho de terra
  g.fillStyle = E.borda; g.fillRect(-w / 2 - 0.5, -l - 0.5, w + 1, l + 0.5);
  g.fillStyle = E.cor; g.fillRect(-w / 2, -l, w, l);
  g.fillStyle = 'rgba(255,255,255,0.45)'; g.fillRect(-w / 2, -l, 0.6, l);
  if (E.guarda) {
    g.fillStyle = COR.contorno; g.fillRect(-E.guarda - 0.5, -l - 2, E.guarda * 2 + 1, 2.5);
    g.fillStyle = COR.ouro; g.fillRect(-E.guarda, -l - 1.5, E.guarda * 2, 1.5);
    g.fillStyle = COR.ouroClaro; g.fillRect(-E.guarda, -l - 1.5, E.guarda * 2, 0.5);
    g.fillStyle = '#4A3426'; g.fillRect(-0.75, -l - 1.5 - E.cabo, 1.5, E.cabo);
    g.fillStyle = COR.contorno; g.fillRect(-1.5, -l - 3.5 - E.cabo, 3, 2); g.fillStyle = COR.ouro; g.fillRect(-1, -l - 3 - E.cabo, 2, 1.5);
  } else {  // o cajado: a joia azul no alto
    g.fillStyle = COR.contorno; g.fillRect(-2, -l - 3.5, 4, 3.5);
    g.fillStyle = COR.azul; g.fillRect(-1.5, -l - 3, 3, 3); g.fillStyle = '#DBEAFE'; g.fillRect(-0.5, -l - 2.5, 1, 1);
  }
  if (brilho > 0) { g.fillStyle = rgba('#FFFFFF', 0.9 * Math.min(1, brilho)); g.fillRect(-w / 2, -1 - (l - 1) * brilho, w, 1); }
  g.restore();
}

// os instantes do ciclo k (sorteados pela semente): quando olha pra árvore, quando fecha os olhos, o pulso
function ciclo(sem, k) {
  const r = rng((sem + k * 7919) >>> 0);
  const olha0 = 2.2 + r() * 2.4, fecha0 = 7.4 + r() * 1.2, fecha1 = fecha0 + 3 + r() * 1.5, pulso0 = fecha0 + 0.9 + r() * 1.0;
  return { olha0, olha1: olha0 + 2.0, olha: r() > 0.25, fecha0, fecha1, pulso0 };
}
// o estado da cena em t
function estado(t, sem) {
  const e = { intro: suave(fatia(t, T.graca0, T.graca1)), olha: 0, fechado: false, pulso: 0, suspiro: 0, reflexo: 0 };
  if (t >= T.inicio) {
    const c = t - T.inicio, k = Math.floor(c / CICLO), cc = c - k * CICLO, q = ciclo(sem, k);
    if (q.olha) e.olha = suave(fatia(cc, q.olha0, q.olha0 + 0.5)) * (1 - suave(fatia(cc, q.olha1 - 0.5, q.olha1)));
    e.fechado = cc >= q.fecha0 && cc < q.fecha1;
    const p = fatia(cc, q.pulso0, q.pulso0 + 2.4);
    e.pulso = p > 0 && p < 1 ? Math.pow(Math.sin(Math.PI * p), 2) : 0;
    e.suspiro = Math.sin(Math.PI * fatia(cc, 13.8, 14.6));
    e.reflexo = fatia(cc, 12.0, 12.8) * (cc < 12.9 ? 1 : 0);
  }
  e.sentado = t >= T.sentou;
  e.sy = t >= T.senta && t < T.sentou ? 1 - 0.13 * Math.sin(Math.PI * fatia(t, T.senta, T.sentou)) : 1 - 0.035 * e.suspiro;
  e.x = CLAWD_X * suave(fatia(t, T.senta, T.sentou + 0.2));
  e.piscou = t > T.sentou && (t % 4.3) < 0.12;
  e.espada = t < T.espeta ? 0 : suave(fatia(t, T.espeta, T.espeta + 0.3));
  return e;
}

// o cenário (o que não é o Clawd); fade 0..1 desfaz a cena na saída
function cenario(g, t, e, fade) {
  const pulsa = 0.88 + 0.07 * Math.sin(t * 2.1), entrada = fatia(t, 0.3, 2.0);
  g.save(); g.globalAlpha *= fade;
  // a Árvore Dourada ao longe: um brilho que respira; acende quando ele olha e quando a graça pulsa
  A.arvore(g, ARVORE.x, 2, ARVORE.w, ARVORE.alt, (0.2 + 0.4 * e.olha + 0.3 * e.pulso) * entrada, t, 3);
  A.luz(g, ARVORE.x, -ARVORE.alt * 0.72, 30, (0.1 + 0.35 * e.olha) * entrada, COR.ouro);
  // a graça: a lâmina no chão, o facho e o clarão do pulso
  g.drawImage(arte(LAMINA, COR_LAMINA), GRACA_X - 8, -3, 16, 3);
  A.graca(g, GRACA_X, -1.5, e.intro * (pulsa + 0.55 * e.pulso), t);
  A.luz(g, GRACA_X, -6, 22, e.intro * (0.12 + 0.55 * e.pulso));
  // o pó dourado sobe sempre; em rajada quando a graça pulsa
  A.brasas(g, -2, -44, 46, 44, t, 77, 14, COR.ouroClaro, 0.1);
  if (e.pulso > 0.02) { g.save(); g.globalAlpha *= e.pulso; A.brasas(g, GRACA_X - 12, -50, 24, 50, t * 2.2, 191, 20, COR.graca, 0.2); g.restore(); }
  g.restore();
}

function clawd(g, mT, e, sob) {
  A.clawdElden(g, {
    T: mT, x: sob.x, sentado: sob.sentado, sy: sob.sy, brilho: 0.3 * e.pulso * (sob.fade ?? 1),
    olhos: e.piscou || e.fechado ? 'fechados' : e.olha > 0.5 ? 'cima' : 'abertos', arma: sob.arma,
  });
}

module.exports = {
  texturas: [],
  espadaNoChao,
  linhaDoTempo: [
    [0, 'em pé, espada no ombro'], [T.senta, 'crava a espada no chão e senta'], [T.graca0, 'a graça acende ao lado dele (facho e lâmina de ouro)'],
    [T.inicio, `ciclo de ${CICLO} s: olha pro brilho da Árvore Dourada ao longe (ela acende)`],
    [T.inicio + 7.4, 'fecha os olhos; a graça pulsa e o pó dourado sobe em rajada'],
    [T.inicio + 12, 'um reflexo passa pela espada'], [T.inicio + 13.8, 'um suspiro e o ciclo recomeça'],
  ],
  cena(m) {
    const sem = Math.floor(m.sorteio() * 4294967296);
    m.estado.eldenGraca = sem;
    return {
      nome: 'parado', dur: Infinity, espaco: { frente: 0, tras: 0 }, modos: ['parado'],
      quadro(g, t, mm) {
        A.acimaDoCartao(g, () => {
          const e = estado(t, sem);
          cenario(g, t, e, 1);
          espadaNoChao(g, ESPADA_X, e.espada, (1 - e.espada) * 14, e.reflexo);
          clawd(g, mm.T, e, { x: e.x, sentado: e.sentado, sy: e.sy, arma: t < T.espeta ? { ang: 165 } : null });
        });
      },
    };
  },
  // algo voltou a rodar: o brilho se apaga, a espada volta pra mão e ele levanta (1 s)
  saida: {
    dur: 1.0,
    quadro(g, u, m, tCorte) {
      A.acimaDoCartao(g, () => {
        const sem = m.estado.eldenGraca >>> 0, c = Math.max(0, tCorte || 0), e = estado(c, sem), fade = 1 - fatia(u, 0, 0.7);
        cenario(g, c, e, fade);
        espadaNoChao(g, ESPADA_X, e.espada * (1 - fatia(u, 0.25, 0.55)), 0, 0);
        const sentado = e.sentado && u < 0.5;
        const sy = e.sentado && u >= 0.5 ? 1 + 0.07 * Math.sin(Math.PI * fatia(u, 0.5, 0.75)) : e.sentado ? 1 : e.sy;
        // quem cortou antes de cravar ainda a segura; senão a espada volta pra mão no fim
        const arma = c < T.espeta || u >= 0.7 ? { ang: 165 } : null;
        clawd(g, m.T, e, { x: e.x * (1 - fatia(u, 0.5, 1)), sentado, sy, arma, fade });
      });
    },
  },
};
