'use strict';
// Tema Elden Ring, chefe BESTA PRÍSTINA (a Elden Beast; contrato de elden-epico.js: { id, nome, H, W, desenha, efeito, ataques }).
// Serpente cósmica translúcida: corpo azul-violeta escuro com estrelas douradas dentro, pescoço longo erguido, cabeça estreita com o
// Anel Prístino (espiral dourada) atrás, véus dourados e cauda que se desfaz em fios de luz. Ela flutua e ondula. O corpo é UM sprite em
// cache (cortado em fatias de 2 linhas que ondulam e que esticam o pescoço quando ela ergue a cabeça); o anel, o brilho e as estrelas
// que piscam são desenhados por quadro, poucos. Tudo é função de est.T / est.ataque.u.
const { arte, tingida, lim, rgba, rng } = require('./comum');
const { fatia, luz } = require('./elden-arte');

const W = 56, H = 48, CX = 28;
const PAL = {
  o: '#0A0722', a: '#1B1450', b: '#2B2080', c: '#4332A8', d: '#6C58D8', e: '#9C8CF0',
  F: '#FFF3C0', G: '#F2D77A', D: '#C9A44A', X: '#7A5A16',
};
const A0 = 0.6, A1 = 0.55;  // onde da janela do ataque (0..1) o golpe cai
const ANEL = [19, 11];      // o centro do Anel Prístino, em células do sprite (atrás da cabeça)
const hash = (a, b) => ((a * 73856093) ^ (b * 19349663)) >>> 0;
const grade = () => Array.from({ length: H }, () => Array(W).fill('.'));

// ---------- a espinha: do fim da cauda à ponta do focinho ----------
const PTS = [[53, 29], [50, 35], [44, 39], [35, 39], [27, 36], [21, 30], [19, 23], [21, 16], [19, 11], [14, 8.5], [8, 10.5]];
const RAIO = [[0, 0.5], [0.1, 1.3], [0.28, 3.4], [0.42, 5.4], [0.55, 5.2], [0.68, 4], [0.8, 3.5], [0.88, 3.9], [0.94, 4.1], [1, 1.4]];
const raioEm = s => {
  for (let i = 1; i < RAIO.length; i++) if (s <= RAIO[i][0]) { const [s0, a] = RAIO[i - 1], [s1, b] = RAIO[i]; return a + (b - a) * (s - s0) / (s1 - s0); }
  return RAIO[RAIO.length - 1][1];
};
function espinha() {
  const out = [], n = PTS.length - 1;
  for (let i = 0; i < n; i++) {
    const p0 = PTS[Math.max(i - 1, 0)], p1 = PTS[i], p2 = PTS[i + 1], p3 = PTS[Math.min(i + 2, n)];
    for (let k = 0; k < 24; k++) {
      const t = k / 24, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map(j => 0.5 * (2 * p1[j] + (-p0[j] + p2[j]) * t + (2 * p0[j] - 5 * p1[j] + 4 * p2[j] - p3[j]) * t2 + (-p0[j] + 3 * p1[j] - 3 * p2[j] + p3[j]) * t3)));
    }
  }
  out.push(PTS[n]);
  return out;
}
function contorna(G) {
  const marca = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (G[y][x] !== '.') continue;
    if ((G[y - 1] && G[y - 1][x] !== '.') || (G[y + 1] && G[y + 1][x] !== '.') || (x > 0 && G[y][x - 1] !== '.') || (x < W - 1 && G[y][x + 1] !== '.')) marca.push([x, y]);
  }
  marca.forEach(([x, y]) => { G[y][x] = 'o'; });
}
// uma fita de luz (véu, barbatana, fio): bezier quadrática que afina; só pinta onde ainda é vazio
function fita(G, [p0, p1, p2], larg, pontilhada) {
  for (let t = 0; t <= 1; t += 0.01) {
    const m = 1 - t, x = m * m * p0[0] + 2 * m * t * p1[0] + t * t * p2[0], y = m * m * p0[1] + 2 * m * t * p1[1] + t * t * p2[1];
    const r = larg * (1 - t * 0.9) * 0.5 + 0.3;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const X = Math.round(x) + dx, Y = Math.round(y) + dy;
      if (X < 0 || X >= W || Y < 0 || Y >= H || G[Y][X] !== '.' || (X - x) * (X - x) + (Y - y) * (Y - y) > r * r) continue;
      if (pontilhada && hash(X, Y) % 100 < 30 + 60 * t) continue;
      G[Y][X] = (X + Y) % 5 === 0 ? 'F' : t > 0.6 ? 'D' : (X + 2 * Y) % 3 ? 'G' : 'D';
    }
  }
}

let SPR = null;
function sprite() {
  if (SPR) return SPR;
  const E = espinha(), n = E.length, G = grade();
  const DN = grade().map(r => r.map(() => 9)), NX = grade().map(r => r.map(() => 0)), NY = grade().map(r => r.map(() => 0)), SS = grade().map(r => r.map(() => 0));
  E.forEach(([cx, cy], i) => {
    const s = i / (n - 1), r = raioEm(s);
    for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      if (y < 0 || y >= H || x < 0 || x >= W) continue;
      const d = Math.hypot(x - cx, y - cy), dn = d / r;
      if (dn <= 1 && dn < DN[y][x]) { DN[y][x] = dn; NX[y][x] = d ? (x - cx) / d : 0; NY[y][x] = d ? (y - cy) / d : 0; SS[y][x] = s; }
    }
  });
  const estrelas = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const dn = DN[y][x];
    if (dn > 1) continue;
    const s = SS[y][x];
    if (s < 0.12 && hash(x, y) % 3 === 0) continue;  // a cauda esfiapa
    const l = -(0.6 * NX[y][x] + 0.8 * NY[y][x]);
    let c;
    if (dn > 0.8 && l > 0.2) c = l > 0.65 && dn > 0.9 ? 'F' : 'G';
    else if (dn > 0.66 && l > 0.25) c = 'D';
    else if (dn > 0.74) c = 'd';
    else if (dn < 0.3) c = 'b';
    else c = l > 0.45 && dn < 0.66 ? 'c' : dn < 0.5 ? 'b' : 'a';
    const neb = Math.sin(x * 0.45 + y * 0.2) + Math.sin(y * 0.6 - x * 0.3) + Math.sin((x + y) * 0.25);
    if (neb > 1.35 && dn < 0.74) c = { a: 'b', b: 'c', c: 'd' }[c] || c;
    if (dn < 0.8) {
      const h = hash(x, y) % 100;
      if (h < 15) { c = h % 7 === 0 ? 'F' : 'G'; if (h % 7 === 0 && estrelas.length < 12) estrelas.push([x, y]); } else if (h < 22) c = 'e';
    }
    G[y][x] = c;
  }
  contorna(G);
  // véus e barbatanas douradas (atrás do pescoço e das costas) e a crista da cabeça
  fita(G, [[21, 17], [33, 9], [41, 17]], 2.4); fita(G, [[20, 24], [34, 19], [43, 27]], 2.2);
  fita(G, [[44, 33], [51, 23], [55, 27]], 2.2); fita(G, [[18, 6], [26, 1], [32, 5]], 1.9);
  fita(G, [[37, 33], [44, 26], [50, 28]], 1.8);
  // a cauda que se desfaz em fios de luz
  fita(G, [[53, 29], [52, 23], [47, 18]], 1.2, true); fita(G, [[53, 29], [55, 25], [55, 19]], 1.1, true); fita(G, [[52, 33], [55, 36], [55, 41]], 1.1, true);
  SPR = { img: arte(G.map(r => r.join('')), PAL), estrelas };
  return SPR;
}

// ---------- a pose ----------
// hv: quanto paira (células); R: o quanto ergue a cabeça; lean: a cabeça pra trás (+) ou pra frente (-); brilho do anel
function pose(est) {
  const T = est.T, a = est.ataque, u = a ? a.u : 0;
  let R = 0, lean = 0, brilho = 0.85;
  if (a && a.id === 0) { R = fatia(u, 0.06, 0.3) * (1 - fatia(u, A0, A0 + 0.25)); lean = 3.5 * R; brilho = 0.85 + 0.3 * R; }
  if (a && a.id === 1) {
    const c = fatia(u, 0.05, 0.28) * (1 - fatia(u, 0.3, 0.38)), p = fatia(u, 0.3, 0.38) * (1 - fatia(u, 0.38, 0.75));
    lean = 3 * c - 3.5 * p; brilho = 0.85 + 0.3 * Math.max(c, p);
  }
  const aj = est.ajoelha || 0;
  let hv = 1.6 + 1.4 * Math.sin(T * 1.3);
  hv *= 1 - 0.8 * R;
  hv = hv * (1 - aj) - 4 * aj;
  return { T, R, lean: lean - 3 * aj, hv, aj, brilho };
}
const pesoCab = r => Math.pow(lim((26 - r) / 26, 0, 1), 1.5);
const deslocaX = (v, r) => Math.sin(v.T * 1.5 - r * 0.1) * (0.8 + 1.6 * (1 - r / H)) + v.lean * pesoCab(r);
const deslocaY = (v, r) => (r < 26 ? (-4 * v.R + 6 * v.aj) * (1 - r / 26) : 0);

// ---------- desenho ----------
function desenha(g, J, x, y, est) {
  const pb = J.pb, S = sprite(), v = pose(est);
  const X0 = x - (CX + 0.5) * pb, Y0 = y - (H + v.hv) * pb;
  const tinta = est.golpeado > 0 ? (Math.floor(est.T * 30) % 2 ? '#FFE9A0' : '#FFFFFF') : null;
  g.save();
  g.beginPath(); g.rect(x - 90 * pb, y - 90 * pb, 180 * pb, 90 * pb); g.clip();  // nada abaixo do chão
  // o Anel Prístino, atrás da cabeça: aros, espiral e pontos que giram
  const ac = [X0 + (ANEL[0] + deslocaX(v, ANEL[1])) * pb, Y0 + (ANEL[1] + deslocaY(v, ANEL[1])) * pb], R = 9.3 * pb;
  anel(g, ac[0], ac[1], R, pb, est.T, v.brilho);
  g.globalAlpha *= 0.85;
  const lista = tinta ? [S.img, tingida(S.img, tinta, 'bst')] : [S.img];
  for (let r = 0; r < H; r += 2) {
    const c0 = r + deslocaY(v, r), c1 = r + 2 + deslocaY(v, r + 2);
    const Y = Math.round(Y0 + c0 * pb), h = Math.max(pb, Math.round(Y0 + c1 * pb) - Y), X = Math.round(X0 + deslocaX(v, r) * pb);
    lista.forEach((im, i) => {
      if (i) { g.save(); g.globalAlpha *= 0.7 * est.golpeado; }
      g.drawImage(im, 0, r, W, 2, X, Y, W * pb, h);
      if (i) g.restore();
    });
  }
  g.globalAlpha /= 0.85;
  // estrelas que piscam dentro do corpo e o olho aceso
  g.save(); g.globalCompositeOperation = 'lighter';
  S.estrelas.forEach(([cx, cy], i) => {
    const k = 0.5 + 0.5 * Math.sin(est.T * 3 + i * 1.9);
    g.fillStyle = rgba('#FFF3C0', 0.25 + 0.65 * k);
    const dy = Math.round(cy / 2) * 2;
    g.fillRect(Math.round(X0 + (cx + deslocaX(v, dy)) * pb), Math.round(Y0 + (cy + deslocaY(v, dy)) * pb), pb, pb);
  });
  const ox = deslocaX(v, 8), oy = deslocaY(v, 8);
  const ex = X0 + (11.5 + ox) * pb, ey = Y0 + (7 + oy) * pb;
  g.fillStyle = rgba('#FFF3C0', 0.95); g.fillRect(Math.round(ex), Math.round(ey), pb * 2, pb);
  g.fillStyle = rgba('#F2D77A', 0.5); g.fillRect(Math.round(ex - pb), Math.round(ey - pb * 0.5), pb * 4, pb * 2);
  g.restore();
  g.restore();
}
function anel(g, cx, cy, R, pb, T, brilho) {
  g.save(); g.globalCompositeOperation = 'lighter';
  g.lineWidth = Math.max(1, pb * 0.9);
  g.strokeStyle = rgba('#C9A44A', 0.5 * brilho); g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = rgba('#F2D77A', 0.75 * brilho); g.beginPath(); g.arc(cx, cy, R * 0.74, 0, Math.PI * 2); g.stroke();
  g.strokeStyle = rgba('#FFF3C0', 0.8 * brilho); g.beginPath();  // o braço da espiral
  for (let a = 0; a <= 3 * Math.PI; a += 0.3) {
    const r = R * 0.12 + a * R * 0.07, f = a + T * 0.9;
    if (a === 0) g.moveTo(cx + Math.cos(f) * r, cy + Math.sin(f) * r); else g.lineTo(cx + Math.cos(f) * r, cy + Math.sin(f) * r);
  }
  g.stroke();
  for (let i = 0; i < 8; i++) {
    const f = T * 0.7 + i * Math.PI / 4;
    g.fillStyle = rgba('#FFF3C0', 0.8 * brilho); g.fillRect(Math.round(cx + Math.cos(f) * R) - 1, Math.round(cy + Math.sin(f) * R) - 1, Math.max(2, pb), Math.max(2, pb));
  }
  g.restore();
  luz(g, cx, cy, R * 1.3, 0.35 * brilho, '#F2D77A');
}

// ---------- os efeitos ----------
const cabeca = (J, est, x, y) => {  // onde fica a boca, na tela
  const v = pose(est), pb = J.pb, X0 = x - (CX + 0.5) * pb, Y0 = y - (H + v.hv) * pb;
  return [X0 + (8 + deslocaX(v, 10)) * pb, Y0 + (10.5 + deslocaY(v, 10)) * pb];
};
function estrela(g, X, Y, r, al, q) {  // estrela dourada em queda: núcleo em cruz e rastro
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 8; i >= 1; i--) {
    const k = i / 8;
    g.fillStyle = rgba(k > 0.5 ? '#C9A44A' : '#F2D77A', al * 0.45 * (1 - k * 0.8));
    g.fillRect(Math.round(X - q / 2 - 1.5 * k * r * 0.3), Math.round(Y - k * r * 4.5), q, q * 2);
  }
  g.fillStyle = rgba('#F2D77A', al * 0.55); g.fillRect(Math.round(X - r), Math.round(Y - r), Math.round(r * 2), Math.round(r * 2));
  g.fillStyle = rgba('#FFF3C0', al); g.fillRect(Math.round(X - r * 1.6), Math.round(Y - q / 2), Math.round(r * 3.2), q); g.fillRect(Math.round(X - q / 2), Math.round(Y - r * 1.6), q, Math.round(r * 3.2));
  g.restore();
}
function estouro(g, X, Y, e, sem, q) {  // e 0..1
  const R = 8 + 16 * Math.sqrt(e), al = 1 - e;
  luz(g, X, Y - 5, R * 1.3, al, '#F2D77A');
  g.save(); g.globalCompositeOperation = 'lighter';
  const r = rng(sem);
  for (let i = 0; i < 10; i++) {
    const ang = Math.PI * (0.05 + 0.9 * r()), vel = 10 + 20 * r();
    g.fillStyle = rgba(r() < 0.5 ? '#FFF3C0' : '#F2D77A', al * 0.95);
    g.fillRect(Math.round(X + Math.cos(ang) * vel * e * 1.5), Math.round(Y - Math.sin(ang) * vel * e * 1.3 + 16 * e * e - 3), q, q);
  }
  g.fillStyle = rgba('#F2D77A', al * 0.5); g.fillRect(Math.round(X - R), Math.round(Y - 2), Math.round(R * 2), 2);
  g.restore();
}
function aroEmPe(g, X, Y, ry, rx, al, q) {  // um aro em pé, varrendo o chão
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const [k, c, a, w] of [[1.25, '#C9A44A', 0.3, 2.4], [1, '#F2D77A', 0.7, 1.4], [0.8, '#FFF3C0', 0.9, 0.8]]) {
    g.lineWidth = Math.max(1, q * w * 0.7); g.strokeStyle = rgba(c, al * a);
    g.beginPath(); g.ellipse(X, Y, rx * k, ry * k, 0, 0, Math.PI * 2); g.stroke();
  }
  g.restore();
}

function efeito(g, J, est, x, y) {
  const a = est.ataque;
  if (!a || est.morte > 0) return;
  const pb = J.pb, alvo = J.aqui + 16, q = Math.max(2, Math.round(pb)), boca = cabeca(J, est, x, y);
  if (a.id === 0) {
    // a cabeça erguida junta luz; as estrelas caem do alto, uma exatamente em `acerta`, sobre o Clawd
    const junta = fatia(a.u, 0.08, 0.3) * (1 - fatia(a.u, 0.45, 0.65));
    if (junta > 0) luz(g, boca[0] + 4 * pb, boca[1] - 4 * pb, 14 + 2 * pb + 3 * Math.sin(est.T * 20), junta, '#F2D77A');
    const topo = -(J.HJ - 28), Df = 0.3;
    [[-14, 0.42], [14, 0.5], [0, A0], [28, 0.7], [-26, 0.78]].forEach(([xo, ul], k) => {
      const xl = alvo + xo, p = (a.u - (ul - Df)) / Df;
      if (p >= 0 && p < 1) {
        const s = 0.35 * p + 0.65 * p * p;
        estrela(g, xl + 14 * (1 - s), topo * (1 - s) + y * s, 3 + k % 2, Math.min(1, p * 4), q);
      } else if (p >= 1 && p < 1 + 0.25 / Df) estouro(g, xl, y, (p - 1) * Df / 0.25, 700 + k, q);
    });
    return;
  }
  // anel prístino: nasce na boca, desce ao chão e varre até o Clawd, onde estoura em ondas
  const nasce = fatia(a.u, 0.12, 0.3);
  if (nasce > 0 && a.u < 0.32) { aroEmPe(g, boca[0] - 2, boca[1], 3 + 6 * nasce, 2 + 2 * nasce, nasce, q); luz(g, boca[0], boca[1], 12 * nasce, nasce, '#F2D77A'); }
  const viaja = fatia(a.u, 0.3, A1);
  if (viaja > 0 && a.u < A1 + 0.28) {
    const pos = Math.min(1, viaja), e = pos * pos * (3 - 2 * pos);
    const X = boca[0] + (alvo - boca[0]) * e, Y = boca[1] + (y - 14 - boca[1]) * Math.min(1, e * 1.6);
    const rise = 1 - fatia(a.u, A1, A1 + 0.28);
    for (let i = 3; i >= 0; i--) {  // ecos do aro atrás dele
      const ee = Math.max(0, e - i * 0.1), Xe = boca[0] + (alvo - boca[0]) * ee;
      aroEmPe(g, Xe, Y, 7 + 5 * ee, 2.5 + 1.5 * ee, rise * (1 - i * 0.25), q);
    }
    g.save(); g.globalCompositeOperation = 'lighter';  // a faixa de luz no chão atrás do aro
    for (let i = 0; i < 14; i++) {
      const f = i / 14, gx = X + f * 46, al = (1 - f) * 0.5 * rise;
      g.fillStyle = rgba('#F2D77A', al); g.fillRect(Math.round(gx), Math.round(y - 2 - (i % 3)), Math.max(q, 3), 2);
    }
    g.restore();
    luz(g, X, Y, 14, 0.6 * rise, '#F2D77A');
  }
  if (a.u >= A1) {  // o estouro em ondas no Clawd
    const e = fatia(a.u, A1, A1 + 0.28);
    for (let k = 0; k < 2; k++) { const ek = lim(e * 1.3 - k * 0.3, 0, 1); if (ek > 0 && ek < 1) aroEmPe(g, alvo, y - 12, 12 + 12 * ek, 4 + 10 * ek, 1 - ek, q); }
    if (e < 1) estouro(g, alvo, y, e, 811, q);
  }
}

module.exports = {
  id: 'besta', nome: 'BESTA PRÍSTINA', nomeEn: 'ELDEN BEAST', H, W, desenha, efeito,
  ataques: [{ nome: 'estrelas prístinas', acerta: A0 }, { nome: 'anel prístino', acerta: A1 }],
  // a luta (o lendário, fase 2), como no jogo: as estrelas prístinas perseguem (o Clawd corre), o golpe; o anel prístino varre
  // o chão (o Clawd pula por cima), o golpe; as estrelas de novo o acertam; o frasco, o golpe e o salto final
  luta: {
    ataques: [[0, 2.3, 1.8, 'corre'], [1, 5.0, 1.8, 'pula'], [0, 7.2, 1.4, 'apanha']],
    cortes: [[4.4, 0.72], [6.4, 0.45], [9.6, 0.2]],
    frasco: 8.6, final: 10.2,
  },
};
