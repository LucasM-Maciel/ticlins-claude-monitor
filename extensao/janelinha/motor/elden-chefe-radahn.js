'use strict';
// Tema Elden Ring, chefe RADAHN, FLAGELO DAS ESTRELAS (contrato de elden-epico.js: { id, nome, H, W, desenha, efeito, ataques }).
// Gigante de torso largo: elmo dourado de dois chifres grossos e curvos, juba de fogo vermelha, ombros de pele cinza, armadura de ouro
// antigo ornamentada, capa rasgada e duas cimitarras de aço escuro com filete de ouro. Camadas em sprite (juba e capa balançam em fatias;
// corpo e pele são fixos) + braços e espadas desenhados por quadro, porque se mexem. Tudo é função de est.T / est.ataque.u; os sprites
// nascem uma vez (cache).
const { arte, tingida, lim, rgba, mistura, rng } = require('./comum');
const { COR, fatia, luz } = require('./elden-arte');

const W = 56, H = 48, CX = 28;
const PAL = {
  o: '#120C0A', a: '#2B2530', b: '#403849', c: '#5E546A',
  F: '#F6DA7A', G: '#E2BC52', D: '#B8922A', d: '#7A5A16', X: '#4A3508',        // ouro antigo, do brilho ao fundo
  u: '#B3A18D', v: '#85735F', w: '#574A3D', y: '#35291F',                      // pele cinza-acastanhada
  h: '#E8420F', H: '#FF9A2A', j: '#8A1A08', f: '#FFE08A', K: '#2A0C0A',
  p: '#8C2438', q: '#5E1428', r: '#3A0C20',                                      // capa: vinho frio, mais escura que a juba
};
const A0 = 0.55, A1 = 0.6;  // onde da janela do ataque (0..1) o golpe cai

const grade = () => Array.from({ length: H }, () => Array(W).fill('.'));
const hash = (a, b) => ((a * 73856093) ^ (b * 19349663)) >>> 0;
// um bloco de armadura: contorno, luz na quina de cima/esquerda e sombra embaixo/direita
function bloco(G, x0, y0, w, h, [claro, medio, escuro]) {
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const X = x0 + x, Y = y0 + y;
    if (Y < 0 || Y >= H || X < 0 || X >= W) continue;
    const borda = x === 0 || y === 0 || x === w - 1 || y === h - 1;
    G[Y][X] = borda ? 'o' : (x === 1 || y === 1) ? claro : (x >= w - 3 || y >= h - 2) ? escuro : medio;
  }
}
// pinta uma forma qualquer (dentro(x,y)) com luz de cima/esquerda: a borda de lá é clara, a de baixo/direita é escura
function pinta(G, dentro, tons) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!dentro(x, y)) continue;
    G[y][x] = (!dentro(x, y - 1) || !dentro(x - 1, y)) ? tons[0] : (!dentro(x, y + 1) || !dentro(x + 1, y)) ? tons[2] : tons[1];
  }
}
function contorna(G) {  // um pixel de contorno escuro em volta de tudo
  const marca = [];
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (G[y][x] !== '.') continue;
    if ((G[y - 1] && G[y - 1][x] !== '.') || (G[y + 1] && G[y + 1][x] !== '.') || (x > 0 && G[y][x - 1] !== '.') || (x < W - 1 && G[y][x + 1] !== '.')) marca.push([x, y]);
  }
  marca.forEach(([x, y]) => { G[y][x] = 'o'; });
}
const AR = ['c', 'b', 'a'], AU = ['G', 'D', 'd'];
const sprite = G => arte(G.map(r => r.join('')), PAL);

// chifre: faixa grossa que sai do elmo pro lado, sobe curvando pra fora e afina na ponta (lado -1 esquerda, +1 direita)
function chifre(lado) {
  const S = new Set(), esp = lado < 0 ? (x => x) : (x => 2 * CX - 1 - x);
  const P0 = [CX - 8, 9.5], P1 = [CX - 23, 9], P2 = [CX - 20, 1.2];
  for (let t = 0; t <= 1; t += 0.004) {
    const m = 1 - t, x = m * m * P0[0] + 2 * m * t * P1[0] + t * t * P2[0], y = m * m * P0[1] + 2 * m * t * P1[1] + t * t * P2[1];
    const r = 3.8 * (1 - t * 0.85) + 0.5;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const X = Math.round(x) + dx, Y = Math.round(y) + dy;
      if (Y >= 0 && (X - x) * (X - x) + (Y - y) * (Y - y) <= r * r) S.add(esp(X) + ',' + Y);
    }
  }
  return (x, y) => S.has(x + ',' + y);
}
// pele: elipse de borda esfiapada, mais clara em cima, escura embaixo, com fiapos
function pele(G, cx, cy, rx, ry) {
  const dentro = (x, y) => {
    const dx = (x - cx) / rx, dy = (y - cy) / ry;
    return dx * dx + dy * dy + (dy > 0.2 ? ((hash(x, y) % 3) - 1) * 0.2 : 0) <= 1;
  };
  const tons = 'uvwy';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!dentro(x, y)) continue;
    const q = (y - cy) / ry;
    let i = q < -0.45 ? 0 : q < 0.1 ? 1 : q < 0.6 ? 2 : 3;
    if (hash(x, y) % 5 === 0) i = Math.min(3, i + 1); else if ((x + 2 * y) % 6 === 0 && i > 0) i--;  // fiapos claros e escuros
    G[y][x] = tons[i];
  }
}

// ---------- os sprites (1 vez) ----------
let CAMADAS = null;
// as mechas da juba: [x0, y0, x1, y1, largura, fase]. Cada uma é uma fita ondulada que afina até virar ponta de labareda
const MECHAS = [
  [CX + 12, 14, CX + 25, 36, 7, 5.2], [CX + 10, 12, CX + 21, 44, 7, 3.9], [CX + 10, 12, CX + 26, 27, 6.5, 2.6],
  [CX + 13, 17, CX + 24, 42, 6.5, 2.0], [CX + 9, 11, CX + 17, 40, 6.5, 1.3], [CX + 9, 11, CX + 22, 22, 6, 0.7],
  [CX + 8, 11, CX + 15, 34, 6, 0.0],
];
function mecha(G, [x0, y0, x1, y1, w, fase]) {
  const S = new Set();
  for (let t = 0; t <= 1.0001; t += 0.008) {
    const e = Math.pow(t, 0.85), x = x0 + (x1 - x0) * e + (1.2 + 2.4 * t * t * t) * Math.sin(t * 5.5 + fase), y = y0 + (y1 - y0) * t;
    const r = (w / 2) * (1 - Math.pow(t, 2.4) * 0.92) + 0.5;
    for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) {
      const X = Math.round(x) + dx, Y = Math.round(y) + dy;
      if (X >= 0 && X < W && Y >= 0 && Y < H && (X - x) * (X - x) + (Y - y) * (Y - y) <= r * r) S.add(X + ',' + Y);
    }
  }
  const dentro = (x, y) => S.has(x + ',' + y);
  for (const k of S) {  // contorno escuro em volta (separa uma mecha da outra)
    const [x, y] = k.split(',').map(Number);
    [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([a, b]) => { const X = x + a, Y = y + b; if (!dentro(X, Y) && X >= 0 && X < W && Y >= 0 && Y < H) G[Y][X] = 'K'; });
  }
  for (const k of S) {  // 3 tons: brilho amarelo de 1 px na borda de luz, laranja no meio, vermelho-escuro na sombra
    const [x, y] = k.split(',').map(Number);
    const e = !dentro(x - 1, y), tp = !dentro(x, y - 1), d = !dentro(x + 1, y), b = !dentro(x, y + 1);
    G[y][x] = (e || (tp && !d)) ? 'f' : (d || b) ? 'j' : (!dentro(x + 2, y) || !dentro(x, y + 2)) ? 'h' : 'H';
  }
}
function camadas() {
  if (CAMADAS) return CAMADAS;
  // juba: 7 mechas saindo de baixo do elmo, caindo sobre o ombro e as costas (a camada de trás vai atrás do elmo; a da frente cobre o ombro)
  const C = grade();
  MECHAS.forEach(m => mecha(C, m));
  const CF = grade();
  for (let y = 20; y < H; y++) for (let x = CX + 17; x < W; x++) CF[y][x] = C[y][x];
  // capa: mais escura e fria que a juba; sai por trás do corpo, aparece entre as pernas e à direita, barra em tiras esfarrapadas
  const K = grade();
  const L = [2, 5, 1, 6, 3, 0, 4, 2, 5, 1, 3, 6, 2];
  const fundo = x => { const q = x - (CX - 3), k = Math.floor(q / 4), p = q % 4; return 47 - L[((k % 13) + 13) % 13] - Math.round(Math.abs(p - 1.5) * 1.4); };
  for (let x = CX - 3; x < W - 1; x++) {
    for (let y = 17; y <= fundo(x); y++) {
      const dir = Math.min(W - 2, CX + 14 + Math.round((y - 17) * 0.5 + 1.2 * Math.sin(y * 0.4)));
      if (x > dir) continue;
      const dobra = (x - CX + 700) % 7;
      let t = dobra === 0 ? 2 : dobra < 3 ? 0 : 1;
      if (y > 38 || x > dir - 2) t = Math.min(2, t + 1);
      K[y][x] = 'pqr'[t];
    }
  }
  contorna(K);
  // corpo
  const B = grade();
  bloco(B, CX - 11, 36, 8, 10, AR); bloco(B, CX + 3, 36, 8, 10, AR);     // pernas grossas
  bloco(B, CX - 11, 40, 8, 6, AU); bloco(B, CX + 3, 40, 8, 6, AU);       // grevas de ouro
  bloco(B, CX - 10, 36, 6, 4, AU); bloco(B, CX + 4, 36, 6, 4, AU);       // joelheiras
  bloco(B, CX - 14, 44, 11, 4, AR); bloco(B, CX + 3, 44, 11, 4, AR);     // botas
  bloco(B, CX - 14, 44, 4, 4, AU);                                       // biqueira dourada (a da frente)
  bloco(B, CX - 9, 29, 8, 8, AR); bloco(B, CX + 1, 29, 8, 8, AR);        // escarcelas
  bloco(B, CX - 9, 35, 8, 2, AU); bloco(B, CX + 1, 35, 8, 2, AU);
  bloco(B, CX - 6, 16, 12, 5, AR);                                       // gorjal
  bloco(B, CX - 11, 19, 22, 9, AU);                                      // peitoral de ouro
  bloco(B, CX - 11, 27, 22, 3, AR); bloco(B, CX - 3, 27, 6, 3, AU);      // cinto de couro e fivela
  bloco(B, CX - 20, 21, 9, 8, AU); bloco(B, CX + 11, 21, 9, 8, AU);      // as cavas dos ombros, por baixo da pele
  // peito: emblema redondo claro no centro + duas espirais grandes de ouro claro e rebites (contraste pra ler em zoom 2-3)
  const ex = CX - 0.5, ey = 23.5;
  for (let y = 19; y < 28; y++) for (let x = CX - 6; x <= CX + 5; x++) {
    const d = Math.hypot(x - ex, y - ey);
    if (d <= 4.5) B[y][x] = d > 3.6 ? 'o' : d > 2.3 ? 'F' : d > 1.3 ? 'D' : 'F';
  }
  for (let a = 0; a <= 1.55 * Math.PI; a += 0.05) {
    const r = 0.9 + a * 0.55;
    [[CX - 8.5, 1], [CX + 7.5, -1]].forEach(([cx, s]) => {
      const x = Math.round(cx + s * r * Math.cos(a)), y = Math.round(23.5 + r * Math.sin(a));
      if (x > CX - 11 && x < CX + 10 && y > 19 && y < 27) { if (B[y + 1][x] === 'D' || B[y + 1][x] === 'G') B[y + 1][x] = 'X'; B[y][x] = 'F'; }
    });
  }
  [[-9, 20], [8, 20], [-9, 25], [8, 25]].forEach(([o, y]) => { B[y][CX + o] = 'F'; B[y + 1][CX + o] = 'd'; });
  // chifres grossos, curvando pra fora e pra cima
  pinta(B, chifre(-1), ['F', 'G', 'D']); pinta(B, chifre(1), ['F', 'G', 'D']);
  // elmo dourado grande: cúpula, viseira em T com fenda larga, crista
  const hw = [4.5, 6.5, 7.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 8.5, 7.5, 6.5, 4.5];  // meia-largura de cada fileira (y 5..18)
  const noElmo = (x, y) => y >= 5 && y <= 18 && Math.abs(x - (CX - 0.5)) <= hw[y - 5];
  const anel = (x, y) => noElmo(x, y) && !(noElmo(x - 1, y) && noElmo(x + 1, y) && noElmo(x, y - 1) && noElmo(x, y + 1));
  pinta(B, (x, y) => noElmo(x, y) && !anel(x, y), ['F', 'G', 'D']);
  for (let y = 5; y <= 18; y++) for (let x = 0; x < W; x++) {
    if (!noElmo(x, y)) continue;
    if (anel(x, y)) B[y][x] = 'o'; else if (x >= CX + 6 && B[y][x] !== 'F') B[y][x] = x >= CX + 7 ? 'd' : 'D';
  }
  for (let x = CX - 8; x <= CX + 7; x++) if (B[9][x] === 'G' || B[9][x] === 'D') B[9][x] = 'F';   // aba da sobrancelha
  for (let y = 10; y <= 12; y++) for (let x = CX - 7; x <= CX + 6; x++) B[y][x] = 'o';           // a fenda horizontal da viseira
  for (let x = CX - 8; x <= CX + 7; x++) if (B[13][x] !== 'o') B[13][x] = 'd';
  for (let y = 13; y <= 17; y++) { B[y][CX - 1] = 'o'; B[y][CX] = 'o'; }                          // a fenda vertical: o T
  [14, 16].forEach(y => { [-5, -4, 3, 4].forEach(o => { B[y][CX + o] = 'o'; }); });               // respiros do queixo
  for (let y = 2; y <= 5; y++) {                                                                   // a crista
    const x0 = y === 2 ? CX - 1 : CX - 2, x1 = y === 2 ? CX : CX + 1;
    for (let x = x0; x <= x1; x++) B[y][x] = x === x0 ? 'F' : x === x1 ? 'D' : 'G';
  }
  for (let y = 6; y <= 9; y++) { B[y][CX - 1] = 'F'; B[y][CX] = 'G'; }
  contorna(B);
  // a pele: ombros enormes e a gola, por cima do corpo e dos braços
  const P = grade();
  pele(P, CX - 17.5, 22, 6.5, 5.5); pele(P, CX + 16.5, 22, 6.5, 5.5); pele(P, CX - 0.5, 19, 8, 1.7);
  contorna(P);
  CAMADAS = { cabelo: sprite(C), jubaF: sprite(CF), capa: sprite(K), corpo: sprite(B), pele: sprite(P) };
  return CAMADAS;
}
function poe2(G, x0, y0, w, h, c) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) G[y0 + y][x0 + x] = c; }
function poeHelmet(G, ox, oy, linhas) {
  linhas.forEach((l, y) => { for (let x = 0; x < l.length; x++) if (l[x] !== '.') G[oy + y][ox + x] = l[x]; });
}

// ---------- a pose ----------
// vetor: [espada A (a de baixo) ângulo, mão x, mão y, espada B (no ombro) ângulo, mão x, mão y, corpo x, corpo y (+ desce), inclinação, brilho]
// ângulo: 0 = pra esquerda, 90 = pra baixo, negativo = pra cima, 180 = pra direita
const REPOUSO = [80, CX - 14, 26, -115, CX + 12, 26, 0, 0, 0, 0];
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
const ERGUE = [-66, CX - 19, 21, -114, CX + 18, 21, 0, 0, -2, 1];
const METEOROS = [[0, REPOUSO], [0.04, REPOUSO], [0.24, ERGUE], [A0 + 0.22, ERGUE], [A0 + 0.5, REPOUSO], [1, REPOUSO]];
const PUXA = [168, CX - 4, 27, 192, CX + 4, 26, 3, 4, 4, 0.4];     // agacha e leva as duas espadas pra trás
const GOLPE = [14, CX - 22, 25, -16, CX - 20, 22, -11, 2, -4, 1];  // avança uma passada e cruza as espadas na frente
const CARGA = [[0, REPOUSO], [0.04, REPOUSO], [A1 - 0.3, PUXA], [A1 - 0.1, PUXA], [A1, GOLPE], [A1 + 0.1, GOLPE], [A1 + 0.4, REPOUSO], [1, REPOUSO]];
const AJOELHA = [90, CX - 13, 38, 90, CX + 12, 38, 0, 11, -4, 0];
function pose(est) {
  const a = est.ataque;
  let v = a ? sequencia(a.u, a.id ? CARGA : METEOROS) : REPOUSO;
  if (!a) { const r = Math.sin(est.T * 1.5); v = REPOUSO.slice(); v[2] += r * 0.5; v[5] += r * 0.5; v[8] = r * 0.5; }
  if (est.ajoelha > 0) v = v.map((x, i) => x + (AJOELHA[i] - x) * est.ajoelha);
  if (est.golpeado > 0) { v = v.slice(); v[6] += 1.5 * est.golpeado; v[8] += 1.5 * est.golpeado; }
  return v;
}
// as duas cimitarras: a de baixo (A) e a do ombro (B) curvam pra frente; `cur` é o lado, K o quanto a ponta foge da reta
const COMPR = 22, CURVA = 5;
const ponta = (a, hx, hy, cur) => {
  const r = a * Math.PI / 180, ux = -Math.cos(r), uy = Math.sin(r);
  return [hx + ux * COMPR - uy * cur * CURVA, hy + uy * COMPR + ux * cur * CURVA];
};

// ---------- desenho ----------
function desenha(g, J, x, y, est) {
  const pb = J.pb, K = camadas(), v = pose(est);
  const X0 = Math.round(x - (CX + 0.5) * pb), Y0 = y - H * pb;
  const dx = Math.round(v[6]), dy = Math.round(v[7]), incl = v[8];
  const tinta = est.golpeado > 0 ? (Math.floor(est.T * 30) % 2 ? '#FF2A2A' : '#FFFFFF') : null;
  const mixa = c => (tinta ? mistura(c, tinta, 0.65 * est.golpeado) : c);
  // quanto a fileira r (de 2 em 2) anda pro lado: corpo, inclinação, balanço da juba/capa e a cabeça que desce quando ajoelha
  const desloc = (r, balanco, forca) => {
    const k = 1 - r / H;
    let off = dx + incl * k * k * 1.8 + (balanco ? Math.sin(est.T * 2.6 - r * 0.22) * forca * (0.35 + r / H) : 0);
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
  fatias(K.capa, 'rad-k', true, 1.4);
  fatias(K.cabelo, 'rad-c', true, 1.2);
  fatias(K.corpo, 'rad-b', false, 0);
  // olhos acesos na fenda da viseira (por cima da tinta)
  if (est.golpeado <= 0) {
    const o = desloc(10, false, 0);
    px(CX - 5 + o, 11 + dy, 2, 2, '#FFF4B0'); px(CX + 3 + o, 11 + dy, 2, 2, '#FFF4B0');
    px(CX - 6 + o, 11 + dy, 1, 2, '#FF9A2A'); px(CX + 5 + o, 11 + dy, 1, 2, '#FF9A2A');
  }
  const traco = (a, b, larg, c) => {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.5);
    for (let i = 0; i <= n; i++) { const q = i / n; px(a[0] + (b[0] - a[0]) * q - (larg - 1) / 2, a[1] + (b[1] - a[1]) * q - (larg - 1) / 2, larg, larg, c); }
  };
  // o braço: manga escura, braçadeira de ouro grossa e manopla; sai por baixo da pele
  const braco = (ombro, mao) => {
    const cot = [(ombro[0] + mao[0]) / 2 + 1, (ombro[1] + mao[1]) / 2 + 1];
    traco(ombro, cot, 7, '#120C0A'); traco(cot, mao, 7, '#120C0A');
    traco(ombro, cot, 5, '#403849'); traco(cot, mao, 5, '#403849');
    const meio = [(cot[0] + mao[0]) / 2, (cot[1] + mao[1]) / 2];
    traco(meio, [mao[0] + (cot[0] - mao[0]) * 0.1, mao[1] + (cot[1] - mao[1]) * 0.1], 5, '#B8922A');
    traco(meio, mao, 1, '#F6DA7A');
    px(mao[0] - 2, mao[1] - 2, 5, 5, '#120C0A'); px(mao[0] - 1, mao[1] - 1, 3, 3, '#7A5A16');
  };
  const mA = [v[1] + dx, v[2] + dy], mB = [v[4] + dx, v[5] + dy];
  braco([CX - 15 + dx + incl * 0.4, 23 + dy], mA); braco([CX + 14 + dx + incl * 0.4, 23 + dy], mB);
  fatias(K.pele, 'rad-p', false, 0);
  fatias(K.jubaF, 'rad-f', true, 1.2);  // a juba que cai por cima do ombro
  // a cimitarra: contorno, aço quase preto, fio claro no lado convexo, filete e guarda de ouro, cabo e pomo
  const espada = (ang, mao, cur) => {
    const a = ang * Math.PI / 180, ux = -Math.cos(a), uy = Math.sin(a), nx = -uy, ny = ux;
    const P = (d, l = 0) => { const f = d / COMPR, o = CURVA * cur * f * f + l; return [mao[0] + ux * d + nx * o, mao[1] + uy * d + ny * o]; };
    const larg = d => (d < 3 ? 3 : d < COMPR * 0.6 ? 5 : Math.max(1.4, 5.4 * (1 - (d - COMPR * 0.6) / (COMPR * 0.45))));
    const faixa = (de, ate, f, c, lado) => {
      for (let d = de; d <= ate; d += 0.5) {
        const w = Math.max(1, Math.round(f(d))), p = P(d, lado ? lado(d) : 0);
        px(p[0] - (w - 1) / 2, p[1] - (w - 1) / 2, w, w, c);
      }
    };
    faixa(-4, COMPR + 1.5, d => larg(Math.max(d, 3)) + 2, '#0E0A08');
    faixa(-3, 2.5, () => 3, '#3A1E12');                                           // cabo
    faixa(3, COMPR, larg, '#33354A');                                              // aço escuro
    faixa(3, COMPR - 1, d => (larg(d) > 2 ? 1 : 0), '#9AA0C0', d => -cur * (larg(d) / 2 - 0.5));  // o fio, no lado convexo
    faixa(3, COMPR - 2, d => (larg(d) > 3 ? 1 : 0), '#14151E', d => cur * (larg(d) / 2 - 0.6));    // o dorso, na sombra
    faixa(4.5, COMPR * 0.86, () => 1, '#E2BC52');                                  // filete dourado no centro da lâmina
    faixa(-5, -3.5, () => 4, '#B8922A');                                           // pomo
    const g1 = P(3, 4.5), g2 = P(3, -4.5);
    traco([g1[0], g1[1]], [g2[0], g2[1]], 2, '#E2BC52');                           // a guarda
    px(g1[0] - 1, g1[1] - 1, 2, 2, '#F6DA7A'); px(g2[0] - 1, g2[1] - 1, 2, 2, '#B8922A');
    const m = P(3.5); px(m[0] - 1, m[1] - 1, 3, 3, '#F6DA7A');
  };
  espada(v[0], mA, 1); espada(v[3], mB, -1);
  g.restore();
}

// ---------- os efeitos ----------
function bolaDeFogo(g, X, Y, r, al, dirX, dirY, q) {  // cabeça de pedra em brasa e cauda de brilho
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 10; i >= 1; i--) {  // cauda: cópias menores e mais fracas, de trás pra frente
    const k = i / 10, tx = X - dirX * k * r * 5, ty = Y - dirY * k * r * 5, rr = r * (1 - k * 0.7);
    g.fillStyle = rgba(k > 0.5 ? '#C21E0A' : '#FF7A1A', al * 0.4 * (1 - k * 0.8));
    g.fillRect(Math.round(tx - rr), Math.round(ty - rr), Math.max(q, Math.round(rr * 2)), Math.max(q, Math.round(rr * 2)));
  }
  g.fillStyle = rgba('#FF8A20', al * 0.55); g.fillRect(Math.round(X - r * 1.5), Math.round(Y - r * 1.5), Math.round(r * 3), Math.round(r * 3));
  g.fillStyle = rgba('#FFE08A', al * 0.9); g.fillRect(Math.round(X - r * 0.7), Math.round(Y - r * 0.7), Math.max(q, Math.round(r * 1.4)), Math.max(q, Math.round(r * 1.4)));
  g.restore();
  g.fillStyle = rgba('#2B1A12', al); g.fillRect(Math.round(X - r * 0.9), Math.round(Y - r * 0.9), Math.max(q, Math.round(r * 1.8)), Math.max(q, Math.round(r * 1.8)));  // a rocha escura no meio
  g.fillStyle = rgba('#FFB347', al); g.fillRect(Math.round(X - r * 0.9), Math.round(Y - r * 0.9), q, q); g.fillRect(Math.round(X + r * 0.2), Math.round(Y + r * 0.1), q, q);
}
function explosao(g, X, Y, e, sem, q) {  // e 0..1
  const R = 10 + 20 * Math.sqrt(e), al = 1 - e;
  luz(g, X, Y - 6, R * 1.3, al, '#FF7A1A');
  g.save(); g.globalCompositeOperation = 'lighter';
  const r = rng(sem);
  for (let i = 0; i < 22; i++) {  // fagulhas e pedras em arco, com gravidade
    const ang = Math.PI * (0.05 + 0.9 * r()), vel = 14 + 26 * r();
    const px = X + Math.cos(ang) * vel * e * 1.6, py = Y - Math.sin(ang) * vel * e * 1.4 + 22 * e * e;
    g.fillStyle = rgba(r() < 0.5 ? '#FFB347' : '#FF5A1A', al * 0.95);
    g.fillRect(Math.round(px), Math.round(py - 3), q, q);
  }
  g.fillStyle = rgba('#FF6A1A', al * 0.45); g.fillRect(Math.round(X - R), Math.round(Y - 3), Math.round(R * 2), 3);  // a onda no chão
  g.fillStyle = rgba('#FFF0B0', al * 0.7); g.fillRect(Math.round(X - R * 0.5), Math.round(Y - 2), Math.round(R), 2);
  g.restore();
}

function efeito(g, J, est, x, y) {
  const a = est.ataque;
  if (!a || est.morte > 0) return;
  const pb = J.pb, alvo = J.aqui + 16, q = Math.max(2, Math.round(pb));
  if (a.id === 0) {
    // brilho nas pontas das espadas erguidas
    const v = pose(est), X0 = x - (CX + 0.5) * pb, Y0 = y - H * pb;
    const brilho = fatia(a.u, 0.1, 0.24) * (1 - fatia(a.u, A0 + 0.05, A0 + 0.25));
    if (brilho > 0) {
      for (const [ang, hx, hy, cur] of [[v[0], v[1], v[2], 1], [v[3], v[4], v[5], -1]]) {
        const p = ponta(ang, hx + Math.round(v[6]), hy + Math.round(v[7]), cur);
        luz(g, X0 + p[0] * pb, Y0 + p[1] * pb, 9 + 3 * Math.sin(est.T * 20), brilho, '#FF8A30');
      }
    }
    // os meteoros: caem de cima da direita pra baixo à esquerda; um cai exatamente em `acerta`, sobre o Clawd
    const topo = -(J.HJ - 28), Df = 0.3;
    [[10, 0.38], [0, A0], [28, 0.46], [-8, 0.68], [18, 0.8]].forEach(([xo, ul], k) => {
      const xl = alvo + xo, p = (a.u - (ul - Df)) / Df;
      if (p >= 0 && p < 1) {
        const s = 0.4 * p + 0.6 * p * p, X = xl + 70 * (1 - s), Y = topo * (1 - s) + y * s;
        const dxm = 70 / (-topo + 1), nrm = Math.hypot(dxm, 1);
        bolaDeFogo(g, X, Y, 5 + k % 2, Math.min(1, p * 4), dxm / nrm, 1 / nrm, q);
      } else if (p >= 1 && p < 1 + 0.25 / Df) explosao(g, xl, y, (p - 1) * Df / 0.25, 900 + k, q);
    });
    return;
  }
  // carga: o X de luz laranja que as duas espadas riscam sobre o Clawd
  const u = (a.u - A1) / 0.14;
  if (u < 0 || u > 1.8) return;
  const al = u < 1 ? u : Math.max(0, 1 - (u - 1) / 0.8), L = 24 + 6 * pb, cx = alvo, cy = y - 13;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const sinal of [1, -1]) {
    for (let i = -L; i <= L; i += 1) {
      const f = 1 - Math.abs(i) / L, px = cx + i * 0.92, py = cy + i * 0.62 * sinal - (sinal < 0 ? 0 : 0);
      const e = Math.max(q, Math.round(q * 2.2 * f));
      g.fillStyle = rgba('#FF7A1A', al * 0.55 * f); g.fillRect(Math.round(px - e), Math.round(py - e), e * 2, e * 2);
      g.fillStyle = rgba('#FFE9B0', al * 0.9 * f); g.fillRect(Math.round(px - q / 2), Math.round(py - q / 2), q, q);
    }
  }
  luz(g, cx, cy, 16, al, '#FF8A30');
  const r = rng(321);
  for (let i = 0; i < 18; i++) {  // faíscas
    const ang = r() * Math.PI * 2, d = (6 + r() * 26) * Math.min(1, u);
    g.fillStyle = rgba('#FFC060', al * 0.9); g.fillRect(Math.round(cx + Math.cos(ang) * d), Math.round(cy + Math.sin(ang) * d * 0.8), q > 2 ? 2 : 1, q > 2 ? 2 : 1);
  }
  g.restore();
}

module.exports = {
  id: 'radahn', nome: 'RADAHN, FLAGELO DAS ESTRELAS', nomeEn: 'STARSCOURGE RADAHN', H, W, desenha, efeito,
  ataques: [{ nome: 'meteoros', acerta: A0 }, { nome: 'carga', acerta: A1 }],
  // a luta (elden-epico.js), como no jogo: a chuva de meteoros (o Clawd corre e eles caem no lugar vazio), o contra-ataque; a
  // carga das cimitarras o acerta; o frasco, um golpe; os meteoros de novo, mais rápidos (rola por baixo), o golpe e o salto
  luta: {
    ataques: [[0, 2.3, 2.0, 'corre'], [1, 5.2, 2.0, 'apanha'], [0, 8.9, 1.4, 'rola']],
    cortes: [[4.45, 0.72], [8.3, 0.48], [10.35, 0.22]],
    frasco: 7.3, final: 11,
  },
};
