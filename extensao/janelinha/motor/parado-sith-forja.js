'use strict';
// Tema Sith, parado há muito tempo (revezando com a meditação): A FORJA DO SABRE. Ajoelha, a
// Força acende e as 5 peças de um sabre (pomo, empunhadura, o cristal kyber, o interruptor e o
// emissor) sobem da borda e giram na frente dele. Em ciclos de 16 s, com a mão erguida: as
// peças se encaixam uma a uma (uma faísca a cada uma; o cristal some dentro da empunhadura num
// brilho vermelho), o cabo pronto sobe, a lâmina acende e balança, apaga, e ele desmonta o
// cabo de volta no giro. Na saída (algo voltou a rodar) a lâmina apaga, as peças caem na borda
// e somem, e ele levanta. No lado da luz, o mesmo em verde (as cores vêm de A.COR). Tudo função
// do tempo: a semente fica em m.estado.sithForja (pra saída).
const { sai, rng, rgba } = require('./comum');
const A = require('./sith-arte');

const { fatia } = A;
const suave = u => u * u * (3 - 2 * u);
const DEG = Math.PI / 180;
const T = { senta: 0.4, sentou: 0.6, forca0: 0.7, forca1: 1.6, sobe: 1.0, inicio: 3.4 };
const CICLO = 16;
// dentro do ciclo (s): o encaixe (uma peça a cada 'passo', 'voa' s no ar), o cabo sobe, a lâmina, o desmonte
const C = { junta: 0.4, passo: 0.75, voa: 0.55, ergue: [4.6, 5.2], acende: [5.2, 5.5], apaga: [8.4, 8.65], desce: [8.8, 9.3], solta: 9.5, soltaPasso: 0.25, soltaVoa: 0.8 };
// o giro na frente dele e a base do cabo montado (DIPs no referencial do Clawd: x pra frente, y- pra cima)
const GIRO = { x: 26, y: -14, rx: 9, ry: 3.5, vel: 0.9 };
const BASE = { x: 26, y: -5 }, ERGUE = 2.5;
// de baixo pra cima, na ordem do encaixe; dy = de onde ela fica, a partir da base do cabo
const PECAS = [
  { id: 'pomo', w: 3.6, h: 1.8, dy: 0 },
  { id: 'cristal', w: 2.0, h: 2.4, dy: 3.1 },
  { id: 'empunhadura', w: 3.4, h: 5.0, dy: 1.8 },
  { id: 'interruptor', w: 3.6, h: 1.6, dy: 6.8 },
  { id: 'emissor', w: 4.4, h: 1.8, dy: 8.4 },
];
const CABO = 10.2, LAMINA = 22;
const CRISTAL = PECAS.findIndex(p => p.id === 'cristal'), EMP = PECAS.findIndex(p => p.id === 'empunhadura');

function pecas(sem) {
  const r = rng(sem);
  return PECAS.map((p, i) => ({ ...p, i, fase: (i / PECAS.length) * Math.PI * 2 + r() * 0.5, giraFase: r() * 6 }));
}
// o instante dentro do ciclo (null antes do 1º) e o número do ciclo
function ciclo(t) {
  if (t < T.inicio) return { cc: null, k: -1 };
  const k = Math.floor((t - T.inicio) / CICLO);
  return { cc: t - T.inicio - k * CICLO, k };
}
// 0 = girando, 1 = encaixada no cabo
function junto(i, cc) {
  if (cc == null) return 0;
  const a = C.junta + i * C.passo, d = C.solta + i * C.soltaPasso;
  return suave(fatia(cc, a, a + C.voa)) * (1 - suave(fatia(cc, d, d + C.soltaVoa)));
}
const pousa = i => C.junta + i * C.passo + C.voa;  // quando a peça i encaixa
// o cabo montado: quanto subiu, a lâmina (0..1) e o balanço (graus)
function cabo(cc) {
  if (cc == null) return { ergue: 0, len: 0, balanco: 0 };
  const ergue = ERGUE * suave(fatia(cc, ...C.ergue)) * (1 - suave(fatia(cc, ...C.desce)));
  const len = sai(fatia(cc, ...C.acende)) * (1 - fatia(cc, ...C.apaga));
  return { ergue, len, balanco: len * 9 * Math.sin((cc - C.acende[0]) * 2.4) };
}
// onde está a peça (centro e ângulo) em t
function posPeca(p, t) {
  const { cc } = ciclo(t), cb = cabo(cc);
  // girando: a elipse na frente, um sobe-e-desce e girando no próprio eixo; no começo, subindo da borda
  const a = p.fase + GIRO.vel * t, s = sai(fatia(t, T.sobe + p.i * 0.2, T.sobe + p.i * 0.2 + 1.2));
  const gx = GIRO.x + Math.cos(a) * GIRO.rx, gy = GIRO.y + Math.sin(a) * GIRO.ry + Math.sin(t * 1.4 + p.i * 1.7) * 1.2;
  const x0 = GIRO.x - 8 + p.i * 4, y0 = -p.h / 2;
  const gira = { x: x0 + (gx - x0) * s, y: y0 + (gy - y0) * s, ang: s * 35 * Math.sin(t * 0.9 + p.giraFase) };
  // no cabo: em pé, empilhada; o cabo inteiro balança em volta do meio dele
  const cy = BASE.y - cb.ergue - CABO / 2, oy = CABO / 2 - p.dy - p.h / 2, b = cb.balanco * DEG;
  const cabo_ = { x: BASE.x - oy * Math.sin(b), y: cy + oy * Math.cos(b), ang: cb.balanco };
  const k = junto(p.i, cc);
  return { x: gira.x + (cabo_.x - gira.x) * k, y: gira.y + (cabo_.y - gira.y) * k, ang: gira.ang + (cabo_.ang - gira.ang) * k, k };
}
// a ponta do cabo montado (de onde sai a lâmina)
function pontaDoCabo(cc) {
  const cb = cabo(cc), b = cb.balanco * DEG, cy = BASE.y - cb.ergue - CABO / 2;
  return { x: BASE.x + (CABO / 2) * Math.sin(b), y: cy - (CABO / 2) * Math.cos(b), ...cb };
}

function desenhaPeca(g, p, x, y, ang, t, brilho = 1) {
  g.save(); g.translate(x, y); if (ang) g.rotate(ang * DEG);
  const w = p.w, h = p.h, x0 = -w / 2, y0 = -h / 2;
  const ret = (cor, a, b, c, d) => { g.fillStyle = cor; g.fillRect(a, b, c, d); };
  if (p.id === 'pomo') {
    ret('#9CA3AF', x0, y0, w, h); ret('#D1D5DB', x0, y0, w, 0.6); ret('#4B5563', x0 + 0.4, y0 + h - 0.5, w - 0.8, 0.5);
  } else if (p.id === 'empunhadura') {
    ret('#111827', x0, y0, w, h);
    for (const f of [0.18, 0.42, 0.66]) ret('#4B5563', x0, y0 + h * f, w, 0.6);
  } else if (p.id === 'interruptor') {
    ret('#374151', x0, y0, w, h); ret(A.SITH.prata, x0, y0, w, 0.4); ret(A.COR.lamina, x0 + 0.5, y0 + 0.5, 0.9, 0.8);
  } else if (p.id === 'emissor') {
    ret(A.SITH.prata, x0, y0, w, h); ret('#6B7280', x0 + w * 0.35, y0, w * 0.3, h * 0.6); ret('#F3F4F6', x0, y0, w, 0.5);
  } else {  // o cristal kyber: brilha e pulsa
    const pulsa = 0.8 + 0.2 * Math.sin(t * 5 + p.giraFase);
    if (brilho > 0) {
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(0, 0, 0, 0, 0, 5);
      gr.addColorStop(0, rgba(A.COR.lamina, 0.5 * pulsa * brilho)); gr.addColorStop(1, rgba(A.COR.lamina, 0));
      g.fillStyle = gr; g.fillRect(-5, -5, 10, 10); g.restore();
    }
    ret(A.COR.cristal, -0.6, -h / 2, 1.2, h); ret(A.COR.lamina, -1, -0.6, 2, 1.2); ret(A.COR.palida, -0.3, -0.6, 0.6, 1.2);
  }
  g.restore();
}
// a lâmina do sabre forjado (maior que a da mão: o cabo também é)
function lamina(g, x, y, ang, len, t) {
  if (len <= 0.01) return;
  const L = LAMINA * len, treme = 1 + 0.08 * Math.sin(t * 47);
  g.save(); g.translate(x, y); g.rotate(ang * DEG);
  g.save(); g.globalCompositeOperation = 'lighter';
  g.fillStyle = rgba(A.COR.lamina, 0.22 * treme); g.fillRect(-3.4, -L, 6.8, L + 0.6);
  g.fillStyle = rgba(A.COR.lamina, 0.45 * treme); g.fillRect(-2.2, -L, 4.4, L + 0.3);
  g.restore();
  g.fillStyle = A.COR.lamina; g.fillRect(-1.3, -L, 2.6, L);
  g.fillStyle = A.COR.nucleo; g.fillRect(-0.6, -L + 0.5, 1.2, L - 0.5);
  g.restore();
}
// a Força nas mãos: erguida enquanto ele monta e desmonta
function maoErguida(cc) {
  if (cc == null) return false;
  return (cc >= C.junta - 0.2 && cc < pousa(PECAS.length - 1) + 0.2) || (cc >= C.solta - 0.2 && cc < C.solta + (PECAS.length - 1) * C.soltaPasso + C.soltaVoa + 0.1);
}
function estado(t) {
  const { cc } = ciclo(t), cb = cabo(cc);
  return { cc, sentado: t >= T.sentou, aura: 0.5 * fatia(t, T.forca0, T.forca1) + 0.4 * cb.len, bracos: maoErguida(cc) ? [0, -2] : null };
}

function quadro(g, t, sem, lista) {
  const s = estado(t), { cc, k } = ciclo(t);
  A.clawdSith(g, {
    T: t, sentado: s.sentado, sabre: null, aura: s.aura, vento: 0, bracos: s.bracos,
    sy: t >= T.senta && t < T.sentou ? 1 - 0.15 * Math.sin(Math.PI * fatia(t, T.senta, T.sentou)) : 1,
  });
  // o cristal primeiro: encaixado, ele fica escondido atrás da empunhadura
  const pos = lista.map(p => posPeca(p, t));
  const cr = lista[CRISTAL];
  desenhaPeca(g, cr, pos[CRISTAL].x, pos[CRISTAL].y, pos[CRISTAL].ang, t, 1 - pos[EMP].k);
  for (const p of lista) if (p.i !== CRISTAL) desenhaPeca(g, p, pos[p.i].x, pos[p.i].y, pos[p.i].ang, t);
  if (cc == null) return;
  // a empunhadura fechando em volta do cristal: o cabo brilha da cor do lado
  const dc = cc - pousa(EMP);
  if (dc >= 0 && dc < 0.45) {
    const q = pos[CRISTAL], u = 1 - dc / 0.45;
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(q.x, q.y, 0, q.x, q.y, 9);
    gr.addColorStop(0, rgba(A.COR.clara, 0.8 * u)); gr.addColorStop(1, rgba(A.COR.lamina, 0));
    g.fillStyle = gr; g.fillRect(q.x - 9, q.y - 9, 18, 18); g.restore();
  }
  // uma faísca a cada encaixe
  for (const p of lista) A.faiscas(g, pos[p.i].x, pos[p.i].y, cc - pousa(p.i), (sem + p.i * 31 + k * 977) >>> 0, 5, ['#FFFFFF', A.COR.palida, '#FDE68A']);
  const pt = pontaDoCabo(cc);
  lamina(g, pt.x, pt.y, pt.balanco, pt.len, t);
  if (cc >= C.acende[0] && cc < C.acende[0] + 0.2) {  // o estalo de acender
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba('#FFE4E6', 0.6 * (1 - (cc - C.acende[0]) / 0.2));
    g.fillRect(pt.x - 3, pt.y - 3, 6, 6); g.restore();
  }
}

module.exports = {
  texturas: [],
  CICLO, INICIO: T.inicio,
  linhaDoTempo: [
    [0, 'em pé, sabre no cinto'], [T.senta, 'ajoelha'], [T.forca0, 'a Força acende (brilho vermelho)'],
    [T.sobe, 'as 5 peças de um sabre sobem da borda e giram na frente dele'],
    [T.inicio, `ciclo de ${CICLO} s, com a mão erguida: as peças se encaixam uma a uma (o cristal some num brilho vermelho)`],
    [T.inicio + C.ergue[0], 'o cabo pronto sobe; a lâmina acende e balança'],
    [T.inicio + C.apaga[0], 'apaga; ele desmonta o cabo de volta no giro'],
  ],
  cena(m) {
    const sem = Math.floor(m.sorteio() * 4294967296);
    m.estado.sithForja = sem;
    const lista = pecas(sem);
    return {
      nome: 'parado', dur: Infinity, espaco: { frente: 0, tras: 0 }, modos: ['parado'],
      quadro(g, t) { A.acimaDoCartao(g, () => quadro(g, t, sem, lista)); },
    };
  },
  // algo voltou a rodar: a lâmina apaga, as peças caem na borda e somem, ele levanta (1 s)
  saida: {
    dur: 1.0,
    quadro(g, u, m, tCorte) { A.acimaDoCartao(g, () => this.desenha(g, u, m, tCorte)); },
    desenha(g, u, m, tCorte) {
      const sem = m.estado.sithForja >>> 0, c = Math.max(0, tCorte || 0), lista = pecas(sem), s0 = estado(c);
      if (u >= 0.75 || c < T.senta) A.clawdSith(g, { T: m.T, sabre: null });
      else {
        const v = fatia(u, 0, 0.45), sentado = s0.sentado && u < 0.55;
        const sy = u >= 0.55 ? 1 + 0.07 * Math.sin(Math.PI * fatia(u, 0.55, 0.75)) : 1;
        A.clawdSith(g, { T: m.T, sentado, sabre: null, aura: s0.aura * (1 - v), sy });
      }
      const alfa = 1 - fatia(u, 0.4, 0.6);
      if (alfa <= 0) return;
      g.save(); g.globalAlpha *= alfa;
      const fecha = junto(EMP, ciclo(c).cc);
      for (const p of lista) {
        const q = posPeca(p, c);
        desenhaPeca(g, p, q.x, Math.min(-p.h / 2, q.y + 90 * u * u), q.ang * (1 - u), c, 1 - fecha);
      }
      const pt = pontaDoCabo(ciclo(c).cc);
      lamina(g, pt.x, pt.y, pt.balanco, pt.len * (1 - fatia(u, 0, 0.15)), m.T);
      g.restore();
    },
  },
};
