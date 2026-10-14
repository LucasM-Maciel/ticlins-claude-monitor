'use strict';
// Evento épico raro do lado Akatsuki (a cada 30 bugs derrubados), ~12 s: O JUUBI, a fera de dez
// caudas (dono, 13/10; o sapo que estava aqui virou evento do lado Time 7, akatsuki-sapo.js; depois:
// "gostei do design dela, mas pode ficar mais épica"). A área acima do cartão vira um céu de noite
// com a lua vermelha (abre de baixo pra cima, a partir da borda do cartão). O Clawd faz selos, dá um
// pulinho e bate a mão no cartão: riscos vermelhos correm pela borda e o chão treme. A fera sobe de
// trás dos morros levantando poeira, raios vermelhos rasgam o céu, a coroa de chifres aparece e as
// dez caudas brotam uma a uma; o olho único (o Rinne-Sharingan: anéis e nove tomoe) abre, a lua vira
// o mesmo olho, com os tomoe girando, e ela ruge. Um bug gigante entra pela direita, vê a fera e
// treme. A boca abre, o céu escurece e uma esfera escura carrega (o roxo sendo sugado, pedras subindo
// do chão, faíscas em volta) e dispara: clarão, coluna de luz, cúpula, duas ondas de choque, e do
// bug só sobra poeira. O Clawd fica de olhos acesos; o olho da fera (e o da lua) fecha, ela afunda de
// volta atrás dos morros e o palco fecha. Desenho e efeitos nossos, no pixel do tema (nomes do anime
// liberados pelo dono, 13/10: projeto sem fins lucrativos).
//
// Tudo é função de t (o sorteio da semente só mexe na fumaça e nos estilhaços). Coordenadas do
// palco: DIPs a partir do canto de cima à esquerda do cartão (X pra direita, Y- pra cima, 0 = borda
// de cima do cartão), como nos outros épicos; o quadro soma o cartão de agora.
const { lim, sai, entra, cache, arte, tela, rng, rgba } = require('./comum');
const A = require('./akatsuki-arte');

const { fatia } = A;

// ---------- ritmo (s) ----------
const T = {
  abre: [0, 0.5], vai: [0.05, 0.45], selos: [0.3, 1.4], pulo: [1.4, 1.6], bate: 1.6, riscos: [1.6, 2.1], levanta: 2.6,
  surge: [2.0, 4.0], caudas: [2.6, 3.4, 0.1],  // a cauda i cresce de [0] + i*[2] até [1] + i*[2]
  olho: [4.3, 4.6], ruge: [4.7, 5.4], comanda: [4.3, 9.0], bug: [5.0, 6.4], susto: [6.4, 6.9], medo: [6.4, 8.4],
  boca: [6.6, 6.9], carrega: [6.8, 8.2], tiro: [8.2, 8.4], explode: 8.4, luz: [8.4, 9.4], poeira: [8.7, 10.0],
  fechaBoca: [8.6, 8.9], olhosClawd: [9.0, 9.8], fechaOlho: [9.5, 9.8], recolhe: [9.7, 10.5], afunda: [9.9, 11.1],
  volta: [10.6, 11.0], fecha: [11.3, 11.7], dur: 11.9,
};

const linhaDoTempo = [
  [0, 'o céu de noite (lua vermelha) abre acima do cartão, de baixo pra cima'],
  [T.vai[0], 'se o Clawd estava na ponta direita (onde o bug vai parar), pula pra mais perto do meio'],
  [T.selos[0], 'o Clawd faz selos rápidos'],
  [T.bate, 'pulinho e bate a mão no cartão: riscos vermelhos correm pela borda, o chão treme'],
  [T.surge[0], 'o Juubi sobe de trás dos morros levantando poeira, raios vermelhos no céu; as dez caudas brotam uma a uma'],
  [T.olho[0], 'o olho único (anéis e nove tomoe) abre e a lua vira o mesmo olho; ela ruge'],
  [T.bug[0], 'um bug gigante entra pela direita, vê a fera e treme'],
  [T.carrega[0], 'a boca abre, o céu escurece e uma esfera escura carrega: o roxo sugado, pedras subindo, faíscas'],
  [T.explode, 'o disparo: clarão, coluna de luz, cúpula, duas ondas de choque; do bug só sobra poeira'],
  [T.olhosClawd[0], 'os olhos do Clawd acendem vermelhos'],
  [T.afunda[0], 'o olho fecha, as caudas recolhem e a fera afunda atrás dos morros'],
  [T.volta[0], 'se ele tinha pulado, volta pro lugar dele'],
  [T.fecha[0], 'o céu fecha de volta pra borda do cartão'],
];

// o chão tremendo: [início, fim, força, decai (true) ou sobe e desce]
const TREMORES = [
  [T.bate, T.bate + 0.4, 2, true], [T.surge[0], T.surge[1], 1.2], [T.ruge[0], T.ruge[1], 2.5],
  [T.explode, T.explode + 0.7, 3, true], [T.afunda[0], T.afunda[1], 1],
];
function tremor(t) {
  let a = 0;
  for (const [t0, t1, forca, decai] of TREMORES) {
    if (t < t0 || t >= t1) continue;
    const u = fatia(t, t0, t1);
    a = Math.max(a, forca * (decai ? 1 - u : Math.sin(Math.PI * u)));
  }
  return a;
}

// ---------- a fera (gerada pixel a pixel por elipses: nítida como o resto do tema) ----------
// De frente, só da cintura pra cima (o resto fica atrás dos morros). W x H pixels + 1 de contorno.
const W = 52, H = 40, FW = W + 2, FH = H + 2;
const COR_FERA = {
  G: '#3F3650', L: '#574B6B', D: '#2B2438', H: '#6B5F80', R: '#DC2626', r: '#7F1D1D', E: '#FECACA',
  P: '#1A0606', M: '#0B0710', T: '#E7E5E4', K: '#0E0A14', O: '#0E0A14', N: '#5F0A1E', B: '#8C819E',
};
const OLHO = [27, 22], BOCA = [27, 36];  // os meios do olho e da boca, em pixels da textura (com o contorno)
const dentro = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
const FERAS = cache(24);
// olho: 0 (fechado) a 4 (aberto); boca: 0 (fechada) a 3 (escancarada)
function fera(olho = 4, boca = 0) {
  const chave = olho + ':' + boca, pronto = FERAS.get(chave);
  if (pronto) return pronto;
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const pinta = (cor, f, so) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (f(x, y) && (!so || so.includes(g[y][x]))) g[y][x] = cor; };
  pinta('G', (x, y) => dentro(x, y, 26, 49, 30, 20));  // os ombros
  pinta('G', (x, y) => dentro(x, y, 7, 34, 8, 8));     // os calombos dos ombros
  pinta('G', (x, y) => dentro(x, y, 45, 34, 8, 8));
  pinta('G', (x, y) => dentro(x, y, 26, 24, 17, 16));  // a cabeça
  // a coroa de chifres: seis, curvando pra fora, os do meio mais altos; o lado de fora claro
  for (const [hx, hy, h, inc, curva, larg] of [
    [11.5, 17, 8, -0.8, -0.03, 2.2], [17.5, 12, 12, -0.45, -0.025, 2.8], [22.5, 9, 9, -0.12, 0, 2],
    [29.5, 9, 9, 0.12, 0, 2], [34.5, 12, 12, 0.45, 0.025, 2.8], [40.5, 17, 8, 0.8, 0.03, 2.2],
  ]) {
    const meio = y => hx + inc * (hy - y) + curva * (hy - y) ** 2;
    pinta('H', (x, y) => y <= hy && y > hy - h && Math.abs(x + 0.5 - meio(y)) <= 0.35 + larg * (y - (hy - h)) / h, '.G');
    pinta('B', (x, y) => y <= hy && y > hy - h && g[y][x] === 'H' && (inc < 0 ? x + 0.5 < meio(y) : x + 0.5 > meio(y)) && y < hy - 1);
  }
  pinta('L', (x, y) => dentro(x, y, 21, 15, 8, 4), 'G');  // a luz no alto da cabeça e nos ombros
  pinta('L', (x, y) => dentro(x, y, 6, 30, 4, 2.5), 'G');
  pinta('L', (x, y) => dentro(x, y, 46, 30, 4, 2.5), 'G');
  pinta('D', (x, y) => y >= 37, 'GL');  // a sombra embaixo
  for (const [x, y] of [[12, 22], [15, 28], [38, 21], [36, 28], [30, 13], [9, 36], [44, 36], [19, 31], [33, 31], [24, 11]]) if ('GL'.includes(g[y][x])) g[y][x] = 'D';  // as rugas
  // o olho (o Rinne-Sharingan): fechado, um risco; abrindo, a pálpebra deixa ver o vermelho com três
  // anéis (as ondas) e os nove tomoe, três em cada anel, cada um com a cauda seguindo o anel
  const ox = 26, oy = 21, RX = 10.5, RY = 8;
  if (olho <= 0) pinta('K', (x, y) => y === oy && Math.abs(x + 0.5 - ox) <= 8.5);
  else {
    const ry = RY * olho / 4, d = (x, y) => Math.hypot((x + 0.5 - ox) / RX, (y + 0.5 - oy) / RY);
    pinta('K', (x, y) => dentro(x, y, ox, oy, RX + 1.2, ry + 1.1));
    pinta('R', (x, y) => dentro(x, y, ox, oy, RX, ry));
    pinta('r', (x, y) => { const v = d(x, y); return (v > 0.58 && v < 0.68) || (v > 0.28 && v < 0.39); }, 'R');
    pinta('P', (x, y) => d(x, y) < 0.14, 'R');
    // os tomoe: nos dois anéis e perto da borda; os do anel do meio uma bolinha de 2x2 com a cauda
    // seguindo o anel, os outros um pixel e a cauda
    for (const [rr, a0, tam] of [[0.8, -Math.PI / 2, 1], [0.63, Math.PI / 6, 2], [0.335, -Math.PI / 6, 1]]) {
      for (let i = 0; i < 3; i++) {
        const a = a0 + i * 2 * Math.PI / 3, x = Math.round(ox - tam / 2 + Math.cos(a) * rr * RX), y = Math.round(oy - tam / 2 + Math.sin(a) * rr * RY);
        for (let dy = 0; dy < tam; dy++) for (let dx = 0; dx < tam; dx++) if (g[y + dy] && 'Rr'.includes(g[y + dy][x + dx])) g[y + dy][x + dx] = 'P';
        const c = a + (tam + 0.6) / (rr * RX), tx = Math.floor(ox + Math.cos(c) * rr * RX), ty = Math.floor(oy + Math.sin(c) * rr * RY);
        if (g[ty] && 'Rr'.includes(g[ty][tx])) g[ty][tx] = 'P';
      }
    }
    if (g[oy - 5][ox - 6] === 'R') g[oy - 5][ox - 6] = 'E';
    if (g[oy - 5][ox - 5] === 'R') g[oy - 5][ox - 5] = 'E';
  }
  // a boca: fechada, um risco; aberta, o escuro com a garganta vermelha no fundo e as presas (as
  // grandes descem dois pixels) em cima e embaixo
  const bx = 26, by = 35;
  if (boca <= 0) pinta('K', (x, y) => y === by && Math.abs(x + 0.5 - bx) <= 9);
  else {
    pinta('M', (x, y) => dentro(x, y, bx, by + 0.5, 11, boca + 0.6));
    pinta('N', (x, y) => dentro(x, y, bx, by + 0.5 + boca * 0.3, 6, boca * 0.45), 'M');
    for (let x = 0; x < W; x++) {
      const col = [];
      for (let y = 0; y < H; y++) if ('MN'.includes(g[y][x])) col.push(y);
      if (col.length < 2) continue;
      const a = col[0], b = col[col.length - 1];
      if (x % 3 === 0) { g[a][x] = 'T'; if (x % 6 === 0 && col.length > 3 && boca >= 2) g[a + 1][x] = 'T'; }
      if (x % 3 === 1) { g[b][x] = 'T'; if (x % 6 === 1 && col.length > 3 && boca >= 2) g[b - 1][x] = 'T'; }
    }
  }
  // o contorno: todo vazio encostado (em cruz) na fera
  const linhas = Array.from({ length: FH }, (_, y) => Array.from({ length: FW }, (_, x) => {
    const c = g[y - 1] && g[y - 1][x - 1];
    if (c && c !== '.') return c;
    const viz = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => { const v = g[y - 1 + dy] && g[y - 1 + dy][x - 1 + dx]; return v && v !== '.'; });
    return viz ? 'O' : '.';
  }).join(''));
  return FERAS.set(chave, arte(linhas, COR_FERA));
}

// ---------- o palco ----------
function montar(m) {
  const c = m.host.cartao || [98, 260, 248, 146], casa = m.pose();
  const cw = c[2], HJ = Math.round(lim(c[1] - 14, 112, 184)), X0 = casa.x - c[0];
  const k = HJ >= 150 && cw >= 230 ? 3 : 2, TW = FW * k, TH = FH * k;
  const BP = k * 2 + 1, BW = 13 * BP, BH = 8 * BP;  // o bug gigante: o do tema, 2k+1 por pixel
  const J = { cw, HJ, X0, k, TW, TH, BP, BW, BH };
  J.feraX = Math.round(lim(cw * 0.34, TW / 2 - 12, cw - BW - TW / 2 + 30));  // o meio da fera
  J.feraY = -Math.round(HJ * 0.12);  // onde a fera "pisa": atrás dos morros
  J.esconde = TH + Math.round(HJ * 0.15);  // quanto ela desce pra sumir de vez
  J.bugX = cw - 10 - BW / 2;  // onde o bug para (o meio dele); com o medo, recua mais 6
  // onde o Clawd fica: longe do bug (se ele estava lá na ponta, pula pra cá no começo e volta no fim)
  J.aqui = Math.min(X0, Math.round(J.bugX - BW / 2 - 24));
  return J;
}

// a fera em t: meio, base (y), o olho e a boca
function feraEm(J, t) {
  const desce = t < T.afunda[0] ? 1 - sai(fatia(t, T.surge[0], T.surge[1])) : entra(fatia(t, T.afunda[0], T.afunda[1]));
  const aberto = fatia(t, T.olho[0], T.olho[1]) - fatia(t, T.fechaOlho[0], T.fechaOlho[1]);
  const ruge = Math.sin(Math.PI * fatia(t, T.ruge[0], T.ruge[1])), atira = fatia(t, T.boca[0], T.boca[1]) - fatia(t, T.fechaBoca[0], T.fechaBoca[1]);
  return {
    cx: J.feraX, y: J.feraY + desce * J.esconde, k: J.k,
    olho: Math.round(lim(aberto, 0, 1) * 4), boca: Math.round(Math.max(ruge > 0 ? ruge : 0, atira) * 3),
  };
}
// um ponto da fera (em pixels da textura) no palco
const naFera = (F, [px, py]) => [F.cx + (px - FW / 2) * F.k, F.y - (FH - py) * F.k];

// as dez caudas: grossas, ondulando, em leque atrás da cabeça; em blocos do pixel da fera
function caudas(g, J, F, t) {
  const k = F.k, [, raizY] = naFera(F, [FW / 2, 26]), grade = v => Math.round(v / k) * k;
  const ordem = [0, 9, 1, 8, 2, 7, 3, 6, 4, 5];  // as de fora primeiro: as do meio ficam na frente
  for (const i of ordem) {
    const cresce = sai(fatia(t, T.caudas[0] + i * T.caudas[2], T.caudas[1] + i * T.caudas[2]));
    const recolhe = entra(fatia(t, T.recolhe[0] + Math.abs(i - 4.5) * 0.05, T.recolhe[1]));
    const c = cresce * (1 - recolhe);
    if (c <= 0.02) continue;
    const L = J.HJ * (0.62 + 0.06 * ((i * 7) % 4)) * c, n = Math.max(2, Math.ceil(L / k));
    const lado = i < 5 ? -1 : 1, a0 = Math.PI * (1.12 + 0.76 * i / 9);
    let x = F.cx + (i - 4.5) * k * 3, y = raizY;
    const pts = [];
    for (let j = 0; j <= n; j++) {
      const s = j / n, a = a0 + lado * 0.5 * s * s + 0.4 * s * Math.sin(t * 1.7 + i * 1.9 + s * 3.2);
      pts.push([x, y, k * (3.4 - 2.4 * s)]);
      x += Math.cos(a) * L / n; y += Math.sin(a) * L / n;
    }
    for (const [cor, mais] of [[COR_FERA.O, k], [COR_FERA.G, 0]]) {
      g.fillStyle = cor;
      for (const [px, py, r] of pts) { const rr = Math.max(k, grade(r)) + mais; g.fillRect(grade(px) - rr, grade(py) - rr, rr * 2, rr * 2); }
    }
    g.fillStyle = COR_FERA.L;  // a luz do lado de cima
    for (let j = 2; j < pts.length * 0.8; j += 2) { const [px, py, r] = pts[j]; g.fillRect(grade(px) - Math.max(k, grade(r)) + k, grade(py) - Math.max(k, grade(r)) + k, k, k); }
  }
}

// a esfera escura: o miolo preto, a borda roxa, o brilho em volta, os riscos girando dentro
function esfera(g, x, y, r, t) {
  if (r <= 0.5) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y, r * 0.6, x, y, r * 2.8);
  gr.addColorStop(0, rgba('#A855F7', 0.75)); gr.addColorStop(1, rgba('#A855F7', 0));
  g.fillStyle = gr; g.fillRect(x - r * 2.8, y - r * 2.8, r * 5.6, r * 5.6);
  g.restore();
  g.fillStyle = '#C084FC'; g.beginPath(); g.arc(x, y, r + 1, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#0A0510'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#6D28D9';
  for (let i = 0; i < 3; i++) { const a = t * 7 + i * 2.1; g.fillRect(x + Math.cos(a) * r * 0.55 - 1, y + Math.sin(a) * r * 0.55 - 1, 2, 2); }
}
// o roxo (e um pouco de vermelho) sendo sugado pra esfera
function sugando(g, x, y, r, t, k) {
  for (let i = 0; i < 18; i++) {
    const v = t * 1.4 + i / 18, fase = v % 1, a = i * 2.39996 + Math.floor(v) * 1.3, d = r + (1 - fase) * k * 24;
    const px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    g.fillStyle = rgba(i % 3 ? '#C084FC' : '#F87171', 0.3 + 0.7 * fase);
    g.fillRect(px - 1, py - 1, 2, 2);
    g.fillRect(px + Math.cos(a) * 2 - 0.5, py + Math.sin(a) * 2 - 0.5, 1, 1);
  }
}

const CEUS = cache(4), MORROS = cache(4);
function ceu(J) {  // o fundo do palco: noite vermelha, as estrelas, a lua (pronto no tamanho do palco)
  const chave = J.cw + 'x' + J.HJ, pronto = CEUS.get(chave);
  if (pronto) return pronto;
  const c = tela(J.cw, J.HJ), k = c.getContext('2d');
  const faixas = ['#0B0505', '#110707', '#170909', '#1D0B0B', '#240E0E'];
  faixas.forEach((cor, i) => { k.fillStyle = cor; k.fillRect(0, Math.floor(J.HJ * i / faixas.length), J.cw, Math.ceil(J.HJ / faixas.length) + 1); });
  const r = rng(J.cw * 131 + J.HJ);
  for (let i = 0; i < 30; i++) { k.fillStyle = rgba('#FECACA', 0.25 + 0.4 * r()); k.fillRect(Math.floor(r() * J.cw), Math.floor(r() * J.HJ * 0.7), 1, 1); }
  const R = Math.round(J.HJ * 0.13), lx = Math.round(J.cw * 0.8), ly = Math.round(J.HJ * 0.24);
  const gr = k.createRadialGradient(lx, ly, R * 0.8, lx, ly, R * 2.8);
  gr.addColorStop(0, rgba('#DC2626', 0.35)); gr.addColorStop(1, rgba('#DC2626', 0));
  k.fillStyle = gr; k.fillRect(lx - R * 3, ly - R * 3, R * 6, R * 6);
  k.fillStyle = '#B91C1C'; k.beginPath(); k.arc(lx, ly, R, 0, Math.PI * 2); k.fill();
  k.fillStyle = '#DC2626'; k.beginPath(); k.arc(lx - 1, ly - 1, R - 2, 0, Math.PI * 2); k.fill();
  k.fillStyle = '#991B1B';
  for (const [dx, dy, f] of [[-0.3, -0.25, 0.2], [0.25, 0.2, 0.26], [0.3, -0.35, 0.12]]) { k.beginPath(); k.arc(lx + dx * R, ly + dy * R, f * R, 0, Math.PI * 2); k.fill(); }
  return CEUS.set(chave, c);
}
function morros(J) {  // na frente da fera: os morros e a faixa de chão escuro
  const chave = J.cw + 'x' + J.HJ, pronto = MORROS.get(chave);
  if (pronto) return pronto;
  const c = tela(J.cw, J.HJ), k = c.getContext('2d');
  k.fillStyle = '#080303';
  for (const [cx, rx, ry] of [[0.15, 0.35, 0.22], [0.55, 0.3, 0.16], [0.9, 0.32, 0.26]]) { k.beginPath(); k.ellipse(J.cw * cx, J.HJ, J.cw * rx, J.HJ * ry, 0, 0, Math.PI * 2); k.fill(); }
  k.fillRect(0, J.HJ + J.feraY - 2, J.cw, -J.feraY + 2);
  return MORROS.set(chave, c);
}

// a fumaça grande: várias bolotas de puf espalhadas por uma área
function fumacao(g, cx, cy, larg, alt, u, sem, tam) {
  const r = rng(sem >>> 0);
  for (let i = 0; i < 7; i++) A.puf(g, cx + (r() - 0.5) * larg, cy + (r() - 0.5) * alt, u, (sem + i * 977) >>> 0, tam * (0.8 + 0.4 * r()), 6);
}

// o bug gigante: entra, se assusta (um "!"), treme e recua; no clarão, some
function bugEm(J, t) {
  const anda = fatia(t, T.bug[0], T.bug[1]);
  const x = J.bugX + (J.cw + J.BW / 2 + 4 - J.bugX) * (1 - sai(anda)) + 6 * sai(fatia(t, T.medo[0], T.medo[1]));
  const treme = t >= T.medo[0] && t < T.explode ? Math.round(Math.sin(t * 61)) * 0.8 : 0;
  return { x: x + treme, cy: -J.BH / 2, anda: anda > 0 && anda < 1 };
}
function desenhaBug(g, J, t) {
  if (t < T.bug[0] || t >= T.explode + 0.15) return;
  const b = bugEm(J, t), f = J.BP / 1.6;
  g.save(); g.translate(b.x, 0); g.scale(f, f);
  A.bug(g, 0, 0, {
    passo: b.anda && Math.floor(t / 0.1) % 2 ? 'q' : 'p', alfa: 1 - fatia(t, T.explode - 0.02, T.explode + 0.15),
    a: t >= T.tiro[0] ? fatia(t, T.tiro[0], T.explode) : 0,
  });
  g.restore();
  const s = fatia(t, T.susto[0], T.susto[1]);
  if (s > 0 && s < 1) {  // o "!" em cima da cabeça
    const x = Math.round(b.x - J.BW * 0.3), y = Math.round(-J.BH - 6 - 4 * sai(Math.min(1, s * 4))), p = Math.max(2, J.k);
    g.fillStyle = '#0E0A14'; g.fillRect(x - 1, y - p * 5 - 1, p + 2, p * 6 + 3);
    g.fillStyle = '#F8FAFC'; g.fillRect(x, y - p * 5, p, p * 3.5); g.fillRect(x, y, p, p);
  }
}

// os raios vermelhos rasgando o céu enquanto ela sobe e ruge: [quando, onde (fração da largura)]
const RAIOS = [[2.25, 0.14], [2.85, 0.64], [3.5, 0.3], [4.72, 0.9], [5.02, 0.06], [5.28, 0.52]];
function raios(g, J, t) {
  for (let i = 0; i < RAIOS.length; i++) {
    const [t0, fx] = RAIOS[i], u = fatia(t, t0, t0 + 0.18);
    if (u <= 0 || u >= 1) continue;
    const a = u < 0.2 ? 1 : 1 - fatia(u, 0.2, 1), r = rng(i * 7919 + 13);
    g.fillStyle = rgba('#7F1D1D', 0.3 * a); g.fillRect(0, -J.HJ, J.cw, J.HJ);  // o céu pisca
    let x = J.cw * fx, y = -J.HJ;
    const pts = [[x, y]];
    while (y < -J.HJ * 0.3) { y += 5 + r() * 9; x += (r() - 0.5) * 16; pts.push([x, y]); }
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const [cor, lw] of [['#DC2626', 3], ['#FECACA', 1]]) {
      g.strokeStyle = rgba(cor, a); g.lineWidth = lw;
      g.beginPath(); g.moveTo(pts[0][0], pts[0][1]);
      for (const [px, py] of pts) g.lineTo(px, py);
      g.stroke();
    }
    g.restore();
  }
}

// a poeira escura levantando no pé dos morros (quando ela sobe e quando afunda)
function poeiraDosMorros(g, J, u, sem) {
  if (u <= 0 || u >= 1) return;
  const r = rng(sem >>> 0), a = 1 - entra(u);
  for (let i = 0; i < 10; i++) {
    const raio = J.k * (1.5 + r() * 2) * (0.5 + sai(u)), x = J.feraX + (r() - 0.5) * J.TW * 1.3, y = J.feraY + 1 - raio * 0.3 - J.k * 4 * sai(u) * r();
    g.fillStyle = rgba('#2A1212', 0.85 * a); g.beginPath(); g.arc(x, y, raio, 0, Math.PI * 2); g.fill();
    g.fillStyle = rgba('#4A2420', 0.7 * a); g.beginPath(); g.arc(x - raio * 0.25, y - raio * 0.3, raio * 0.6, 0, Math.PI * 2); g.fill();
  }
}

// a lua vira o olho dela: o vermelho vivo, dois anéis, a pupila e os nove tomoe girando devagar
function luaOlho(g, J, t, a) {
  if (a <= 0) return;
  const R = Math.round(J.HJ * 0.13), lx = Math.round(J.cw * 0.8), ly = Math.round(J.HJ * 0.24) - J.HJ;
  g.save(); g.globalAlpha *= a;
  g.save(); g.globalCompositeOperation = 'lighter';
  const pulsa = 0.5 + 0.5 * Math.sin(t * 4);
  g.strokeStyle = rgba('#EF4444', 0.35 + 0.3 * pulsa); g.lineWidth = 2;
  g.beginPath(); g.arc(lx, ly, R + 2 + pulsa, 0, Math.PI * 2); g.stroke();
  g.restore();
  g.fillStyle = '#E11D2A'; g.beginPath(); g.arc(lx, ly, R, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#4C0A0A'; g.lineWidth = 1;
  for (const f of [0.36, 0.68]) { g.beginPath(); g.arc(lx, ly, R * f, 0, Math.PI * 2); g.stroke(); }
  g.fillStyle = '#1A0606'; g.beginPath(); g.arc(lx, ly, Math.max(1.5, R * 0.15), 0, Math.PI * 2); g.fill();
  const gira = t * 1.1, rt = Math.max(1, R * 0.085);
  for (const [f, a0] of [[0.36, -Math.PI / 6], [0.68, Math.PI / 6], [0.9, -Math.PI / 2]]) {
    for (let i = 0; i < 3; i++) {
      const ang = a0 + i * 2 * Math.PI / 3 + gira;
      g.fillStyle = '#1A0606'; g.beginPath(); g.arc(lx + Math.cos(ang) * R * f, ly + Math.sin(ang) * R * f, rt, 0, Math.PI * 2); g.fill();
      g.strokeStyle = '#1A0606'; g.lineWidth = Math.max(1, rt * 0.9);  // a cauda, seguindo o anel
      g.beginPath(); g.arc(lx, ly, R * f, ang - 0.55 / f * 0.5, ang); g.stroke();
    }
  }
  g.restore();
}

// a carga: pedras sobem do chão até a esfera e faíscas roxas estalam em volta dela
function carga(g, J, t, x, y, r) {
  const k = J.k, rr = rng(J.sem ^ 0x2c1b3c6d);
  for (let i = 0; i < 14; i++) {
    const x0 = J.cw * (0.05 + 0.9 * rr()), t0 = T.carrega[0] + rr() * 0.9, u = fatia(t, t0, t0 + 0.7 + rr() * 0.4);
    if (u <= 0 || u >= 1) continue;
    const v = entra(u), lado = k * (1 + Math.floor(rr() * 2));
    const px = Math.round(x0 + (x - x0) * v + Math.sin(t * 9 + i) * (1 - v) * 2), py = Math.round(-2 + (y + 2) * v);
    g.fillStyle = '#0E0A14'; g.fillRect(px - 1, py - 1, lado + 2, lado + 2);
    g.fillStyle = '#3F3650'; g.fillRect(px, py, lado, lado);
    g.fillStyle = '#6B5F80'; g.fillRect(px, py, lado, 1);
  }
  const q = Math.floor(t * 18), rf = rng(q * 2654435761 >>> 0);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 3; i++) {
    let a = rf() * Math.PI * 2, d = r + 1, px = x + Math.cos(a) * d, py = y + Math.sin(a) * d;
    g.strokeStyle = rgba(i ? '#C084FC' : '#F5EFFF', 0.85); g.lineWidth = 1;
    g.beginPath(); g.moveTo(px, py);
    for (let j = 0; j < 3; j++) { a += (rf() - 0.5) * 1.2; d += k * (1.5 + rf() * 2); px = x + Math.cos(a) * d; py = y + Math.sin(a) * d; g.lineTo(px, py); }
    g.stroke();
  }
  g.restore();
}

// o disparo: a esfera voa até o bug; clarão, cúpula de luz, onda de choque, estilhaços, poeira
function explosao(g, J, t) {
  const [cx, cy] = [J.bugX + 6, -J.BH / 2];
  const u = fatia(t, T.luz[0], T.luz[1]);
  if (u <= 0 || u >= 1) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  const R = J.HJ * 0.55 * sai(fatia(t, T.explode, T.explode + 0.5)), a = 1 - fatia(t, T.explode + 0.45, T.luz[1]);
  if (R > 1) {
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
    gr.addColorStop(0, rgba('#FFFFFF', 0.9 * a)); gr.addColorStop(0.35, rgba('#E9D5FF', 0.75 * a));
    gr.addColorStop(0.7, rgba('#A855F7', 0.5 * a)); gr.addColorStop(1, rgba('#7C3AED', 0));
    g.fillStyle = gr; g.fillRect(cx - R, cy - R, R * 2, R * 2);
  }
  const pu = fatia(t, T.explode, T.explode + 0.75);  // a coluna de luz, do chão até o alto do palco
  if (pu > 0 && pu < 1) {
    const w = J.k * 9 * Math.sin(Math.PI * Math.min(1, pu * 1.6)) + 2;
    g.fillStyle = rgba('#A855F7', 0.45 * (1 - pu)); g.fillRect(cx - w, -J.HJ, w * 2, J.HJ);
    g.fillStyle = rgba('#F5EFFF', 0.85 * (1 - pu)); g.fillRect(cx - w / 3, -J.HJ, w * 2 / 3, J.HJ);
  }
  for (const [atraso, cor, lw] of [[0, '#C084FC', 3], [0.18, '#F87171', 2]]) {  // as ondas de choque, rente ao chão
    const o = fatia(t, T.explode + atraso, T.explode + atraso + 0.8);
    if (o <= 0 || o >= 1) continue;
    const rx = 10 + J.cw * 0.6 * sai(o);
    g.strokeStyle = rgba(cor, 0.9 * (1 - o)); g.lineWidth = lw;
    g.beginPath(); g.ellipse(cx, -2, rx, rx * 0.16, 0, 0, Math.PI * 2); g.stroke();
  }
  g.restore();
  const d = t - T.explode, r = rng(J.sem ^ 0x5bd1e995);  // os estilhaços do bug
  if (d < 0.9) {
    for (let i = 0; i < 26; i++) {
      const ang = -Math.PI * (0.1 + 0.8 * r()), vel = 40 + r() * 70, cor = ['#65A30D', '#A3E635', '#111827', '#C084FC'][i % 4];
      const px = cx + (r() - 0.5) * J.BW * 0.6 + Math.cos(ang) * vel * d, py = Math.min(-1, cy + Math.sin(ang) * vel * d + 60 * d * d);
      g.fillStyle = rgba(cor, 1 - fatia(d, 0.5, 0.9)); g.fillRect(px, py, J.k, J.k);
    }
  }
  const f = 1 - fatia(t, T.explode, T.explode + 0.3);  // o clarão: o palco todo branco-roxo
  if (f > 0) { g.fillStyle = rgba('#F5EFFF', 0.75 * f); g.fillRect(0, -J.HJ, J.cw, J.HJ); }
}

// os riscos vermelhos correndo pela borda do cartão, a partir da mão
function riscos(g, J, t) {
  const u = fatia(t, T.riscos[0], T.riscos[1]);
  if (u <= 0 || u >= 1) return;
  const x0 = J.aqui + 8, alcance = J.cw * 0.45 * sai(u), a = 1 - fatia(u, 0.6, 1);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const lado of [-1, 1]) {
    for (let d = 2; d < alcance; d += 3) {
      const x = x0 + lado * d;
      if (x < 1 || x > J.cw - 2) continue;
      g.fillStyle = rgba('#EF4444', 0.95 * a); g.fillRect(x, -2, 3, 2);
      if (Math.floor(d / 3) % 3 === 0) { g.fillStyle = rgba('#FCA5A5', a); g.fillRect(x, -5 - (Math.floor(d / 9) % 2) * 2, 1, 3); }  // as marquinhas
    }
  }
  g.strokeStyle = rgba('#FCA5A5', 0.9 * a); g.lineWidth = 1.5;
  g.beginPath(); g.ellipse(x0, -1, 6 + 26 * sai(u), 2 + 5 * sai(u), 0, 0, Math.PI * 2); g.stroke();
  g.restore();
}

function desenhar(g, t, m, J) {
  const e = m.host.escala || 1, c = m.host.cartao;
  if (!c) return;
  const OX = c[0], OY = c[1];
  const ab = t < T.fecha[0] ? sai(fatia(t, T.abre[0], T.abre[1])) : 1 - entra(fatia(t, T.fecha[0], T.fecha[1]));
  if (ab <= 0) return;
  const topo = Math.round(-J.HJ * ab * e) / e, tr = tremor(t);
  const sx = Math.round(Math.sin(t * 93) * 2.5 * tr) / 2, sy = Math.round(Math.cos(t * 71) * 2 * tr) / 2;
  g.save();
  g.setTransform(e, 0, 0, e, OX * e, OY * e);
  g.beginPath(); g.rect(0, topo, J.cw, -topo); g.clip();
  g.drawImage(ceu(J), 0, -J.HJ, J.cw, J.HJ);
  g.translate(sx, sy);
  raios(g, J, t);
  luaOlho(g, J, t, lim(fatia(t, T.olho[0], T.olho[1] + 0.3) - fatia(t, T.fechaOlho[0], T.fechaOlho[1]), 0, 1));
  const F = feraEm(J, t);
  if (F.y - J.TH < 0) {
    caudas(g, J, F, t);
    g.drawImage(fera(F.olho, F.boca), F.cx - J.TW / 2, F.y - J.TH, J.TW, J.TH);
    if (F.olho > 0) {  // o olho brilhando
      const [ox, oy] = naFera(F, OLHO), br = (F.olho / 4) * (0.7 + 0.3 * Math.sin(t * 5)), R = J.k * 14;
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(ox, oy, 0, ox, oy, R);
      gr.addColorStop(0, rgba('#EF4444', 0.45 * br)); gr.addColorStop(1, rgba('#EF4444', 0));
      g.fillStyle = gr; g.fillRect(ox - R, oy - R, R * 2, R * 2);
      g.restore();
    }
  }
  g.drawImage(morros(J), 0, -J.HJ, J.cw, J.HJ);
  poeiraDosMorros(g, J, fatia(t, T.surge[0], T.surge[0] + 1.8), J.sem + 17);
  poeiraDosMorros(g, J, fatia(t, T.afunda[0], T.afunda[1]), J.sem + 23);
  const escuro = sai(fatia(t, T.carrega[0], T.carrega[1])) * (1 - fatia(t, T.explode, T.explode + 0.9));
  if (escuro > 0) { g.fillStyle = rgba('#05020A', 0.45 * escuro); g.fillRect(0, -J.HJ, J.cw, J.HJ); }  // o céu escurece pra carga
  // o rugido: ondas saindo da boca
  const [bx, by] = naFera(F, BOCA);
  for (let j = 0; j < 3; j++) {
    const u = fatia(t, T.ruge[0] + j * 0.15, T.ruge[0] + j * 0.15 + 0.55);
    if (u <= 0 || u >= 1) continue;
    const r = J.k * 6 + u * J.cw * 0.4;
    g.save(); g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba('#FCA5A5', 0.55 * (1 - u)); g.lineWidth = 2;
    g.beginPath(); g.ellipse(bx, by, r, r * 0.7, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
  }
  desenhaBug(g, J, t);
  // a esfera: carrega na frente da boca e voa até o bug
  const rEsf = J.k * 7 * sai(fatia(t, T.carrega[0], T.carrega[1])) * (1 + 0.06 * Math.sin(t * 23));
  if (t >= T.carrega[0] && t < T.explode) {
    const v = entra(fatia(t, T.tiro[0], T.tiro[1])), ex = bx + (J.bugX + 6 - bx) * v, ey = by + (-J.BH / 2 - by) * v;
    if (t < T.tiro[0]) { sugando(g, bx, by, rEsf, t, J.k); carga(g, J, t, bx, by, rEsf); }
    else {  // o rastro
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 1; i <= 6; i++) { const w = v - i * 0.06; if (w < 0) break; g.fillStyle = rgba('#A855F7', 0.5 - i * 0.07); g.beginPath(); g.arc(bx + (J.bugX + 6 - bx) * w, by + (-J.BH / 2 - by) * w, rEsf * (1 - i * 0.12), 0, Math.PI * 2); g.fill(); }
      g.restore();
    }
    esfera(g, ex, ey, rEsf, t);
  }
  explosao(g, J, t);
  const p = fatia(t, T.poeira[0], T.poeira[1]);
  if (p > 0 && p < 1) fumacao(g, J.bugX + 6, -J.BH * 0.2, J.BW * 0.9, J.BH * 0.3, p, J.sem, J.k * 1.05);
  riscos(g, J, t);
  g.restore();
  // a moldura do palco: vermelha, com a borda de cima clara enquanto abre e fecha
  g.save(); g.setTransform(e, 0, 0, e, OX * e, OY * e);
  g.fillStyle = '#991B1B';
  g.fillRect(0, topo, 1, -topo); g.fillRect(J.cw - 1, topo, 1, -topo);
  g.fillStyle = t < T.abre[1] || t >= T.fecha[0] ? '#FCA5A5' : '#DC2626'; g.fillRect(0, topo, J.cw, 1);
  g.restore();
}

// o Clawd: selos, pulinho e a mão no cartão; de pé segurando o selo enquanto a fera age; os olhos
// acendem no fim. Fica no lugar dele o tempo todo (o tremor sacode junto).
function clawdEm(J, t) {
  const arco = ([a, b]) => (t >= a && t < b ? -6 * Math.sin(Math.PI * fatia(t, a, b)) : 0);
  const anda = J.aqui !== J.X0, ida = fatia(t, T.vai[0], T.vai[1]), volta = fatia(t, T.volta[0], T.volta[1]);
  const x = J.X0 + (J.aqui - J.X0) * (ida - volta);
  const bateu = t >= T.bate && t < T.levanta;
  let selo = null;
  if (t >= Math.max(T.selos[0], anda ? T.vai[1] : 0) && t < T.selos[1]) selo = Math.floor(t / 0.09);
  else if (t >= T.comanda[0] && t < T.comanda[1]) selo = 3;
  const y = arco(T.pulo) + (anda ? arco(T.vai) + arco(T.volta) : 0);
  return { x, y, sy: bateu ? 0.9 : 1, selo, mao: bateu ? [8, -1.5] : null, olhos: Math.sin(Math.PI * fatia(t, T.olhosClawd[0], T.olhosClawd[1])) };
}
function desenharClawd(g, t, J, T0, m) {
  const c = clawdEm(J, t), tr = tremor(t);
  g.save();
  g.setTransform(T0.a, T0.b, T0.c, T0.d, T0.e, T0.f);
  g.translate(Math.round(Math.sin(t * 93) * 1.5 * tr) / 2, 0);
  g.translate(c.x - J.X0, 0);
  A.clawdAkatsuki(g, {
    T: m.T, x: 0, y: c.y, sy: c.sy, selo: c.selo,
    mao: c.mao && function (k, dy) { A.maoNa(k, c.mao[0], c.mao[1] + dy); },
  });
  A.olhosAcesos(g, A.COR.roupa, c.olhos);
  g.restore();
}

// a trilha (som.js)
const SS = n => `sons-akatsuki/${n}.wav`, VOLUME = 0.52;  // VOLUME: a trilha mixada dá ~-22 LUFS (medido), como os épicos dos outros temas
function sons() {
  const L = [
    [T.selos[0], SS('selos'), 0.6], [T.bate, SS('batida'), 0.9],
    [T.surge[0], SS('tremor'), 0.8, 1, T.surge[1] - T.surge[0]], [T.olho[0], SS('olho'), 0.6], [T.ruge[0], SS('rugido'), 1],
    [T.bug[0], SS('rasteja'), 0.5, 1, T.bug[1] - T.bug[0]], [T.susto[0], SS('susto'), 0.5],
    [T.carrega[0], SS('carrega'), 0.8, 1, T.carrega[1] - T.carrega[0]], [T.tiro[0], SS('disparo'), 0.8], [T.explode, SS('explosao'), 1],
    [T.afunda[0], SS('tremor'), 0.6, 0.8, T.afunda[1] - T.afunda[0]], [T.fecha[0], SS('terminou'), 0.8],
  ];
  return L.map(([t, a, g, ...r]) => [t, a, g * VOLUME, ...r]);
}

function cena(m) {
  const J = montar(m);
  J.sem = Math.floor(m.sorteio() * 4294967296);
  return {
    nome: 'epico', dur: T.dur, espaco: { frente: 0, tras: 0 }, modos: ['andando'],
    plano: J,  // pros testes
    sons: sons(),
    quadro(g, t, mundo) {
      const T0 = g.getTransform(), mm = mundo || m;
      desenhar(g, t, mm, J);
      desenharClawd(g, t, J, T0, mm);
    },
  };
}

module.exports = { linhaDoTempo, cena, T, fera, feraEm, naFera, OLHO, BOCA, clawdEm, tremor };  // do T em diante: pros testes
