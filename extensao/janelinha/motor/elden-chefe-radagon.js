'use strict';
// Tema Elden Ring, chefe RADAGON DA ORDEM ÁUREA (contrato de elden-epico.js: { id, nome, H, W, desenha, efeito, ataques }).
// Armadura de ouro e bronze quase de estátua (peitoral marcado, ombreiras grandes, cinto, grevas), rosto pálido e sério, cabelo ruivo
// longo e volumoso pelas costas e o martelo de Marika (cabo longo, cabeça de ouro grande) nas duas mãos. Camadas em sprite (cabelo
// balança em fatias; corpo e ombreira são fixos) + braços e martelo desenhados por quadro, porque se mexem. est.racha (0..1, só no
// lendário): linhas de ouro vivo se espalham pelo corpo; o estouro em cacos é do motor. Os sprites nascem uma vez (cache).
const { arte, tingida, lim, rgba, mistura, rng } = require('./comum');
const { luz } = require('./elden-arte');

const W = 56, H = 48, CX = 30;
const PAL = {
  o: '#120C0A',
  F: '#F6DA7A', G: '#E2BC52', D: '#B8922A', d: '#7A5A16', X: '#4A3508',        // ouro, do brilho ao fundo
  r: '#C58A3E', q: '#92602A', n: '#5C3A16',                                      // bronze
  h: '#B3281A', H: '#E0561F', f: '#FF9448', j: '#6E1208', K: '#2A0806',        // cabelo ruivo
  s: '#F0E2CE', S: '#C2A98C', t: '#8A7058', W: '#FFE9A0',                      // pele pálida, olho
  c: '#5A2018', e: '#2E1010',                                                    // pano vinho
};
const A0 = 0.6;      // onde da janela do ataque (0..1) o golpe cai
const LEN = 18;      // da mão da frente até o centro da cabeça do martelo

const grade = () => Array.from({ length: H }, () => Array(W).fill('.'));
const hash = (a, b) => ((a * 73856093) ^ (b * 19349663)) >>> 0;
const sprite = G => arte(G.map(r => r.join('')), PAL);
const pt = (G, x, y, c) => { x = Math.round(x); y = Math.round(y); if (y >= 0 && y < H && x >= 0 && x < W) G[y][x] = c; };
function pinta(G, dentro, tons) {  // luz de cima/esquerda: borda clara em cima/esquerda, escura embaixo/direita
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!dentro(x, y)) continue;
    G[y][x] = (!dentro(x, y - 1) || !dentro(x - 1, y)) ? tons[0] : (!dentro(x, y + 1) || !dentro(x + 1, y)) ? tons[2] : tons[1];
  }
}
function contorna(G) {
  const marca = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (G[y][x] !== '.') continue;
    if ((G[y - 1] && G[y - 1][x] !== '.') || (G[y + 1] && G[y + 1][x] !== '.') || (x > 0 && G[y][x - 1] !== '.') || (x < W - 1 && G[y][x + 1] !== '.')) marca.push([x, y]);
  }
  marca.forEach(([x, y]) => { G[y][x] = 'o'; });
}
const elip = (cx, cy, rx, ry) => (x, y) => { const a = (x - cx) / rx, b = (y - cy) / ry; return a * a + b * b <= 1; };
const rect = (x0, y0, x1, y1) => (x, y) => x >= x0 && x <= x1 && y >= y0 && y <= y1;
const ou = (...f) => (x, y) => f.some(k => k(x, y));

// uma mecha: fita ondulada que afina até a ponta, em 4 tons de ruivo
function mecha(G, [x0, y0, x1, y1, w, fase]) {
  const S = new Set();
  for (let t = 0; t <= 1.0001; t += 0.008) {
    const e = Math.pow(t, 0.9), x = x0 + (x1 - x0) * e + (1.2 + 2.2 * t * t) * Math.sin(t * 5 + fase), y = y0 + (y1 - y0) * t;
    const r = (w / 2) * (1 - Math.pow(t, 2.2) * 0.9) + 0.5;
    for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
      const X = Math.round(x) + dx, Y = Math.round(y) + dy;
      if (X >= 0 && X < W && Y >= 0 && Y < H && (X - x) * (X - x) + (Y - y) * (Y - y) <= r * r) S.add(X + ',' + Y);
    }
  }
  const dentro = (x, y) => S.has(x + ',' + y);
  for (const k of S) {
    const [x, y] = k.split(',').map(Number);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { const X = x + a, Y = y + b; if (!dentro(X, Y) && X >= 0 && X < W && Y >= 0 && Y < H) G[Y][X] = 'K'; });
  }
  for (const k of S) {
    const [x, y] = k.split(',').map(Number);
    const e = !dentro(x - 1, y), tp = !dentro(x, y - 1), d = !dentro(x + 1, y), b = !dentro(x, y + 1);
    G[y][x] = (e || (tp && !d)) ? 'f' : (d || b) ? 'j' : (!dentro(x + 2, y) || !dentro(x, y + 2)) ? 'h' : 'H';
  }
}

// ---------- os sprites (1 vez) ----------
let CAMADAS = null;
const MECHAS = [
  [CX + 3, 5, CX + 17, 38, 9, 0.3], [CX + 4, 6, CX + 23, 30, 8, 1.6], [CX + 2, 8, CX + 10, 45, 8, 2.4],
  [CX + 5, 6, CX + 19, 46, 7, 3.3], [CX + 3, 7, CX + 13, 41, 7, 4.1], [CX + 6, 5, CX + 24, 22, 6, 5.0],
];
function camadas() {
  if (CAMADAS) return CAMADAS;
  const C = grade();
  MECHAS.forEach(m => mecha(C, m));
  const B = grade();
  // ombreira de trás, no alto à direita
  pinta(B, elip(CX + 9, 19.5, 4.5, 4), ['F', 'G', 'D']);
  // pernas: coxas de pano escuro (por baixo da saia), joelheiras e grevas de ouro, botas de bronze com a biqueira pra esquerda
  pinta(B, rect(CX - 9, 37, CX - 2, 46), ['G', 'D', 'd']); pinta(B, rect(CX + 2, 37, CX + 9, 46), ['D', 'd', 'd']);
  pinta(B, rect(CX - 2, 36, CX + 1, 43), ['c', 'c', 'e']);                                    // o pano entre as pernas
  pinta(B, rect(CX - 9, 38, CX - 2, 41), ['F', 'G', 'D']); pinta(B, rect(CX + 2, 38, CX + 9, 41), ['G', 'D', 'd']);  // joelheiras
  pinta(B, rect(CX - 13, 44, CX - 2, 47), ['r', 'q', 'n']); pinta(B, rect(CX + 1, 44, CX + 11, 47), ['q', 'n', 'n']);
  pinta(B, rect(CX - 13, 44, CX - 10, 47), ['F', 'G', 'D']);                                  // biqueira de ouro
  for (let x = CX - 9; x <= CX - 2; x++) pt(B, x, 43, 'd');                                      // fio do tornozelo
  // saia de placas
  pinta(B, ou(rect(CX - 10, 31, CX + 10, 33), rect(CX - 9, 34, CX + 9, 36), rect(CX - 8, 37, CX + 8, 37)), ['G', 'D', 'd']);
  [-7, -2, 3, 8].forEach(o => { for (let y = 31; y <= 36; y++) pt(B, CX + o, y, 'd'); });
  for (let x = CX - 10; x <= CX + 10; x++) { pt(B, x, 34, 'd'); }
  // peitoral: ombros largos, cintura estreita
  const hw = y => (y <= 16 ? 6 : y === 17 ? 9 : y === 18 ? 10.5 : y <= 22 ? 11 : y === 23 ? 10.5 : y <= 26 ? 9.5 : 8.5);
  pinta(B, (x, y) => y >= 16 && y <= 30 && Math.abs(x - CX) <= hw(y), ['F', 'G', 'D']);
  // o pescoço pálido sai do gorjal
  pinta(B, rect(CX - 4, 13, CX, 16), ['S', 's', 't']);
  pinta(B, rect(CX - 6, 16, CX + 6, 18), ['F', 'G', 'D']);
  // peito: dois peitorais marcados, esterno e gomos
  const pec = [elip(CX - 4.5, 22, 4.6, 3.2), elip(CX + 4.5, 22, 4.6, 3.2)];
  pec.forEach(f => {
    for (let y = 15; y < 30; y++) for (let x = 0; x < W; x++) {
      if (!f(x, y)) continue;
      if (!f(x, y + 1)) pt(B, x, y, 'd'); else if (!f(x, y - 1) && y > 19) pt(B, x, y, 'F');
    }
  });
  for (let y = 19; y <= 28; y++) pt(B, CX, y, 'D');
  [25, 27].forEach(y => { for (let x = 1; x <= 5; x++) { pt(B, CX - x, y, 'd'); pt(B, CX + x, y, 'd'); } });
  [26, 28].forEach(y => { for (let x = 2; x <= 5; x++) { pt(B, CX - x, y, 'F'); pt(B, CX + x, y, 'G'); } });
  // cinto de bronze com a fivela de ouro
  for (let x = CX - 8; x <= CX + 8; x++) { pt(B, x, 29, 'r'); pt(B, x, 30, 'q'); }
  for (let y = 28; y <= 31; y++) for (let x = CX - 4; x <= CX - 1; x++) pt(B, x, y, (x === CX - 4 || x === CX - 1 || y === 28 || y === 31) ? 'D' : 'F');
  pt(B, CX - 3, 29, 'd'); pt(B, CX - 2, 30, 'd');
  // cabeça: volume do cabelo (por trás do rosto), depois o rosto de perfil três-quartos, pálido, sério
  const cabelo = elip(CX + 0.5, 7.5, 8.5, 7.7);
  pinta(B, cabelo, ['H', 'h', 'j']);
  for (let y = 0; y < 16; y++) for (let x = 0; x < W; x++) if (cabelo(x, y) && hash(x, y) % 6 === 0) B[y][x] = y < 9 ? 'f' : 'H';
  const cabeca = elip(CX - 2.5, 9.5, 5.6, 6.4);
  for (let y = 5; y < 17; y++) for (let x = 0; x < W; x++) {
    if (!cabeca(x, y) || x > CX - 2 || y < 6 + (x > CX - 6 ? 1 : 0)) continue;
    B[y][x] = (y >= 14 || x === CX - 2) ? 'S' : 's';
  }
  [[-8, 10], [-8, 11], [-9, 10]].forEach(([o, y]) => pt(B, CX + o, y, 's'));                 // nariz
  pt(B, CX - 9, 11, 'S');
  for (let x = CX - 8; x <= CX - 5; x++) pt(B, x, 8 + (x > CX - 7 ? 0 : 1), 'K');           // sobrancelha séria, caindo pro nariz
  pt(B, CX - 7, 9, 'W'); pt(B, CX - 6, 9, 'W'); pt(B, CX - 7, 10, 'K'); pt(B, CX - 6, 10, 'S');
  for (let x = CX - 7; x <= CX - 5; x++) pt(B, x, 13, 't');                                     // boca fechada
  pt(B, CX - 4, 12, 'S'); pt(B, CX - 3, 12, 'S');                                              // maçã do rosto
  // uma mecha de cabelo caída na frente da orelha e no ombro
  for (let y = 9; y <= 17; y++) { pt(B, CX - 1, y, y > 15 ? 'j' : 'h'); pt(B, CX, y, 'H'); }
  contorna(B);
  // ombreira da frente (por cima dos braços): três placas com friso e o aro de luz
  const P = grade();
  const om = elip(CX - 6.5, 19.5, 6.4, 5.4);
  pinta(P, om, ['F', 'G', 'D']);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!om(x, y)) continue;
    const k = Math.hypot(x - (CX - 6.5), (y - 19.5) * 1.2);
    if (Math.abs(k - 3.2) < 0.6) P[y][x] = 'd';
    if (Math.abs(k - 3.2) < 0.6 && !om(x - 1, y - 1)) P[y][x] = 'D';
  }
  pt(P, CX - 8, 17, 'F'); pt(P, CX - 7, 17, 'F'); pt(P, CX - 9, 18, 'F');
  pt(P, CX - 6, 19, 'F'); pt(P, CX - 5, 20, 'F');                                              // rebite
  contorna(P);
  CAMADAS = { cabelo: sprite(C), corpo: sprite(B), ombro: sprite(P) };
  return CAMADAS;
}

// ---------- as rachaduras (só no lendário): caminhos de ouro vivo, fixos ----------
let RACHAS = null;
function rachas() {
  if (RACHAS) return RACHAS;
  const r = rng(77), L = [];
  const sementes = [[-4, 8], [-3, 13], [-5, 22], [4, 24], [-9, 19], [0, 29], [-5, 38], [5, 38], [-6, 44], [6, 44], [12, 20], [14, 32], [8, 9], [-2, 26], [-6, 33], [3, 33], [11, 40], [-3, 18]];
  sementes.forEach(([sx, sy]) => {
    const pts = [[CX + sx, sy]];
    let a = r() * Math.PI * 2;
    for (let i = 0; i < 6 + Math.floor(r() * 4); i++) {
      a += (r() - 0.5) * 1.5;
      const p = pts[pts.length - 1], d = 2 + r() * 2.2;
      pts.push([p[0] + Math.cos(a) * d, Math.max(1, Math.min(H - 1, p[1] + Math.sin(a) * d))]);
    }
    L.push(pts);
  });
  RACHAS = L;
  return L;
}

// ---------- a pose ----------
// vetor: [ângulo do martelo, mão x, mão y, corpo x, corpo y (+ desce), inclinação]; ângulo: 0 = pra esquerda, 90 = pra baixo, -90 = pra cima
const REPOUSO = [66, CX - 10, 25, 0, 0, 0];
const ERGUE = [-118, CX - 5, 18, 3, 0, 5];      // o martelo erguido atrás, a cabeça dele sobre o ombro
const BATE = [52, CX - 12, 30, -3, 2, -5];      // desce com tudo: a cabeça fica no chão à frente
const AGACHA = [75, CX - 8, 31, 1, 4, 3];
const AR = [-118, CX - 5, 18, -6, -15, 3];
const AR2 = [-118, CX - 5, 18, -12, -19, 3];
const POUSA = [52, CX - 12, 30, -14, 2, -5];
const suave = u => u * u * (3 - 2 * u);
function sequencia(u, chaves) {
  if (u <= chaves[0][0]) return chaves[0][1];
  for (let i = 1; i < chaves.length; i++) {
    if (u <= chaves[i][0]) {
      const [u0, a] = chaves[i - 1], [u1, b] = chaves[i], k = suave(lim((u - u0) / (u1 - u0), 0, 1));
      return a.map((v, j) => v + (b[j] - v) * k);
    }
  }
  return chaves[chaves.length - 1][1];
}
const MARTELADA = [[0, REPOUSO], [0.05, REPOUSO], [0.3, ERGUE], [0.5, ERGUE], [A0 - 0.02, BATE], [A0 + 0.16, BATE], [0.95, REPOUSO], [1, REPOUSO]];
const SALTO = [[0, REPOUSO], [0.05, REPOUSO], [0.2, AGACHA], [0.36, AR], [0.5, AR2], [A0 - 0.02, POUSA], [A0 + 0.16, POUSA], [0.95, REPOUSO], [1, REPOUSO]];
const AJOELHA = [80, CX - 9, 14, 0, 11, -4];
function pose(est) {
  const a = est.ataque;
  let v = a ? sequencia(a.u, a.id ? SALTO : MARTELADA) : REPOUSO;
  if (!a) { const r = Math.sin(est.T * 1.5); v = REPOUSO.slice(); v[2] += r * 0.5; v[5] = r * 0.5; }
  if (est.ajoelha > 0) v = v.map((x, i) => x + (AJOELHA[i] - x) * est.ajoelha);
  if (est.golpeado > 0) { v = v.slice(); v[3] += 1.5 * est.golpeado; v[5] += 1.5 * est.golpeado; }
  return v;
}
const eixo = ang => { const a = ang * Math.PI / 180; return [-Math.cos(a), Math.sin(a)]; };

// ---------- desenho ----------
function desenha(g, J, x, y, est) {
  const pb = J.pb, K = camadas(), v = pose(est), racha = est.racha || 0;
  const X0 = Math.round(x - (CX + 0.5) * pb), Y0 = y - H * pb;
  const dx = Math.round(v[3]), dy = Math.round(v[4]), incl = v[5];
  const tinta = est.golpeado > 0 ? (Math.floor(est.T * 30) % 2 ? '#FF2A2A' : '#FFFFFF') : null;
  const mixa = c => (tinta ? mistura(c, tinta, 0.65 * est.golpeado) : c);
  const desloc = (r, balanco, forca) => {
    const k = 1 - r / H;
    let off = dx + incl * k * k * 1.8 + (balanco ? Math.sin(est.T * 2.2 - r * 0.2) * forca * (0.3 + r / H) : 0);
    if (est.ajoelha > 0 && r < 20) off -= 3 * est.ajoelha * (1 - r / 20);
    return Math.round(off);
  };
  const fatias = (img, chave, balanco, forca) => {
    const alt = tinta ? [img, tingida(img, tinta, chave)] : [img];
    for (let r = 0; r < H; r += 2) {
      const destino = r + dy;
      if (destino >= H) break;
      const off = desloc(r, balanco, forca);
      alt.forEach((im, i) => {
        if (i) { g.save(); g.globalAlpha *= 0.65 * est.golpeado; }
        g.drawImage(im, 0, r, W, 2, X0 + off * pb, Y0 + destino * pb, W * pb, 2 * pb);
        if (i) g.restore();
      });
    }
  };
  g.save();
  g.beginPath(); g.rect(x - 90 * pb, y - 90 * pb, 180 * pb, 90 * pb); g.clip();  // nada abaixo do chão
  const px = (cx, cy, w, h, c) => { g.fillStyle = mixa(c); g.fillRect(X0 + Math.round(cx) * pb, Y0 + Math.round(cy) * pb, w * pb, h * pb); };
  // o brilho áureo suave em volta
  luz(g, x - 2 * pb, y - 26 * pb, 30 * pb, 0.2 + 0.1 * Math.sin(est.T * 2) + 0.35 * racha * racha, '#F2C94A');
  fatias(K.cabelo, 'rg-c', true, 1.3);
  fatias(K.corpo, 'rg-b', false, 0);
  // olho aceso
  if (est.golpeado <= 0) { const o = desloc(10, false, 0); px(CX - 7 + o, 9 + dy, 2, 1, '#FFF8CC'); }
  const [ux, uy] = eixo(v[0]);
  const mao = [v[1] + dx, v[2] + dy], mao2 = [mao[0] - ux * 4.5, mao[1] - uy * 4.5];
  const traco = (a, b, larg, c) => {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.5);
    for (let i = 0; i <= n; i++) { const q = i / n; px(a[0] + (b[0] - a[0]) * q - (larg - 1) / 2, a[1] + (b[1] - a[1]) * q - (larg - 1) / 2, larg, larg, c); }
  };
  // braço: manga vinho, braçadeira de ouro e manopla
  const braco = (ombro, m) => {
    const cot = [(ombro[0] + m[0]) / 2 + 0.5, (ombro[1] + m[1]) / 2 + 2];
    traco(ombro, cot, 6, '#120C0A'); traco(cot, m, 6, '#120C0A');
    traco(ombro, cot, 4, '#5A2018'); traco(cot, m, 4, '#7A3020');
    traco([(cot[0] + m[0]) / 2, (cot[1] + m[1]) / 2], m, 4, '#B8922A'); traco([(cot[0] + m[0]) / 2, (cot[1] + m[1]) / 2], m, 1, '#F6DA7A');
  };
  const ic = incl * 0.4;
  braco([CX + 5 + dx + ic, 20 + dy], mao2);
  martelo(px, v[0], mao);
  braco([CX - 6 + dx + ic, 21 + dy], mao);
  px(mao[0] - 2, mao[1] - 2, 5, 5, '#120C0A'); px(mao[0] - 1, mao[1] - 1, 3, 3, '#E2BC52'); px(mao[0] - 1, mao[1] - 1, 1, 1, '#F6DA7A');
  px(mao2[0] - 2, mao2[1] - 2, 5, 5, '#120C0A'); px(mao2[0] - 1, mao2[1] - 1, 3, 3, '#B8922A');
  fatias(K.ombro, 'rg-o', false, 0);
  // rachaduras: linhas de ouro vivo, cada vez mais, pelo corpo todo
  if (racha > 0) {
    const L = rachas(), n = L.length;
    g.globalCompositeOperation = 'lighter';
    L.forEach((pts, k) => {
      const p = lim((racha - (k / n) * 0.7) / 0.35, 0, 1);
      const m = Math.floor(p * (pts.length - 1));
      for (let i = 0; i < m; i++) {
        const a = pts[i], b = pts[i + 1], nn = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.3);
        for (let s = 0; s <= nn; s++) {
          const q = s / nn, cx = X0 + (Math.round(a[0] + (b[0] - a[0]) * q) + dx) * pb, cy = Y0 + (Math.round(a[1] + (b[1] - a[1]) * q) + dy) * pb;
          g.fillStyle = rgba('#FFB22E', 0.28 + 0.2 * racha); g.fillRect(cx - pb, cy - pb, pb * 3, pb * 3);
          g.fillStyle = rgba('#FFF4C0', 0.95); g.fillRect(cx, cy, pb, pb);
        }
      }
    });
    g.globalCompositeOperation = 'source-over';
  }
  g.restore();
}

// o martelo de Marika: cabo longo (madeira, anéis de ouro) e cabeça grande de ouro com um sol no centro
function martelo(px, ang, mao) {
  const [ux, uy] = eixo(ang), nx = -uy, ny = ux, M = new Map();
  const put = (X, Y, c, forte) => { const k = Math.round(X) * 1000 + Math.round(Y); if (forte || !M.has(k)) M.set(k, [Math.round(X), Math.round(Y), c]); };
  const cabo = (d, c, esp) => { const X = mao[0] + ux * d, Y = mao[1] + uy * d; put(X, Y, c, true); if (esp) put(X + (Math.abs(ux) > Math.abs(uy) ? 0 : 1), Y + (Math.abs(ux) > Math.abs(uy) ? 1 : 0), esp, true); };
  for (let d = -7; d <= LEN; d += 0.5) {
    const X = mao[0] + ux * d, Y = mao[1] + uy * d;
    for (let a = -1; a <= 2; a++) for (let b = -1; b <= 2; b++) put(X + a, Y + b, '#120C0A', false);
  }
  const cx = mao[0] + ux * LEN, cy = mao[1] + uy * LEN;
  for (let d = -7; d <= LEN; d += 0.5) cabo(d, d < -5.5 || (d > 6 && d < 7.5) || (d > 11 && d < 12) ? '#E2BC52' : '#8A5A2A', d < -5.5 || (d > 6 && d < 7.5) || (d > 11 && d < 12) ? '#B8922A' : '#52301A');
  for (let dd = -5; dd <= 5; dd += 0.5) for (let ll = -8; ll <= 8; ll += 0.5) {
    const X = mao[0] + ux * (LEN + dd) + nx * ll, Y = mao[1] + uy * (LEN + dd) + ny * ll;
    const borda = Math.abs(dd) >= 4.5 || Math.abs(ll) >= 7.5;
    let c;
    if (borda) c = '#120C0A';
    else if (Math.hypot(dd * 1.4, ll) < 2.2) c = Math.hypot(dd * 1.4, ll) < 1.1 ? '#F6DA7A' : '#7A5A16';  // o sol no centro
    else if (Math.abs(ll) >= 6.2 || Math.abs(dd) >= 3.8) c = '#B8922A';                                         // aros nas pontas
    else { const s = (-(X - cx) - (Y - cy)) / 10; c = s > 0.22 ? '#F6DA7A' : s > -0.2 ? '#E2BC52' : '#B8922A'; }
    put(X, Y, c, true);
  }
  for (const [X, Y, c] of M.values()) px(X, Y, 1, 1, c);
}
function pontaMartelo(v) {  // onde está o centro da cabeça do martelo, em pixels do desenho
  const [ux, uy] = eixo(v[0]);
  return [v[1] + Math.round(v[3]) + ux * LEN, v[2] + Math.round(v[4]) + uy * LEN];
}

// ---------- os efeitos ----------
const bruto = (g, X, Y, w, h, c, al) => { g.fillStyle = rgba(c, al); g.fillRect(Math.round(X), Math.round(Y), Math.max(1, Math.round(w)), Math.max(1, Math.round(h))); };
function estilhacos(g, X, y, e, q, n, alt, sem) {  // lascas de ouro que sobem do chão e caem, e 0..1
  const r = rng(sem);
  for (let i = 0; i < n; i++) {
    const ox = (r() - 0.5) * 50, h = alt * (0.4 + 0.6 * r()), ph = 0.5 + 0.5 * r();
    const f = lim(e / ph, 0, 1), al = (1 - lim((e - ph * 0.5) / (1 - ph * 0.5), 0, 1)) * (f > 0 ? 1 : 0);
    if (al <= 0) continue;
    const top = h * Math.sin(Math.PI * 0.5 * f), base = Math.max(0, top - h * 0.55);
    for (let k = base; k <= top; k += q) {
      const w = Math.max(q, Math.round((1 - (k - base) / (top - base + 1)) * 3 * q));
      bruto(g, X + ox - w / 2, y - k, w, q, k > top - q * 2 ? '#FFF4C0' : '#F2C94A', al * 0.95);
    }
  }
}
function onda(g, X, y, e, q, forca, sem) {  // a onda que corre pelo chão e o estouro dourado em X
  const al = (1 - e) * forca, R = 8 + 34 * Math.sqrt(e);
  luz(g, X, y - 6, R * 1.2, al * 0.8, '#F2C94A');
  g.save(); g.globalCompositeOperation = 'lighter';
  bruto(g, X - R, y - q * 1.5, R * 2, q * 1.5, '#F2C94A', al * 0.5);
  bruto(g, X - R * 0.6, y - q, R * 1.2, q, '#FFF4C0', al * 0.85);
  bruto(g, X - R * 1.15, y - q, q * 2, q, '#FFE9A0', al * 0.7); bruto(g, X + R * 1.15, y - q, q * 2, q, '#FFE9A0', al * 0.7);
  estilhacos(g, X, y, e, q, Math.round(14 * forca) + 4, 18 + 30 * forca, sem);
  g.restore();
}
function efeito(g, J, est, x, y) {
  const a = est.ataque;
  if (!a || est.morte > 0) return;
  const pb = J.pb, alvo = J.aqui + 16, q = Math.max(2, Math.round(pb)), v = pose(est);
  const X0 = x - (CX + 0.5) * pb, Y0 = y - H * pb, cab = pontaMartelo(v), hx = X0 + cab[0] * pb, hy = Y0 + cab[1] * pb;
  const sobe = a.id === 0 ? lim((a.u - 0.1) / 0.2, 0, 1) * (1 - lim((a.u - 0.5) / 0.1, 0, 1)) : lim((a.u - 0.25) / 0.15, 0, 1) * (1 - lim((a.u - 0.52) / 0.08, 0, 1));
  if (sobe > 0) luz(g, hx, hy, 11 * pb + 3 * Math.sin(est.T * 20), sobe * 0.9, '#FFE08A');  // o martelo acende no alto
  if (a.u < A0 - 0.02) return;
  const forca = a.id === 0 ? 1 : 0.7, e = lim((a.u - (A0 - 0.02)) / 0.3, 0, 1);
  // a pancada onde a cabeça bate (no chão, à frente dele) e a onda que corre até o Clawd
  luz(g, hx, y - 4, 16 * pb * (1 - e * 0.5), (1 - e) * forca, '#FFF0B0');
  const chega = lim((a.u - (A0 - 0.02)) / 0.06, 0, 1);  // a onda sai do martelo e chega no Clawd em u = A0
  if (chega < 1 || a.u < A0 + 0.04) {
    const wx = hx + (alvo - hx) * chega;
    g.save(); g.globalCompositeOperation = 'lighter';
    bruto(g, Math.min(hx, wx), y - q * 2, Math.abs(wx - hx), q * 2, '#F2C94A', 0.55 * forca); bruto(g, wx - q * 2, y - q * 4, q * 4, q * 4, '#FFF4C0', 0.8 * forca);
    g.restore();
  }
  if (a.u >= A0) onda(g, alvo, y, lim((a.u - A0) / 0.28, 0, 1), q, forca, a.id ? 31 : 17);
}

module.exports = {
  id: 'radagon', nome: 'RADAGON DA ORDEM ÁUREA', nomeEn: 'RADAGON OF THE GOLDEN ORDER', H, W, desenha, efeito,
  ataques: [{ nome: 'martelo áureo', acerta: 0.6 }, { nome: 'salto dourado', acerta: 0.6 }],
  // a luta (o lendário, fase 1), como no jogo: o salto dourado cai em cima do Clawd (rola por baixo), o golpe; o martelo solta
  // a onda pelo chão (o Clawd pula por cima), o golpe e o salto final. Depois ele racha e estilhaça (elden-lendario.js)
  luta: {
    ataques: [[1, 2.3, 2.0, 'rola'], [0, 5.0, 1.5, 'pula']],
    cortes: [[4.4, 0.65], [6.5, 0.3]],
    final: 7,
  },
};
