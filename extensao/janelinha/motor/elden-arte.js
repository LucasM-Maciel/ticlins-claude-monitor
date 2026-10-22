'use strict';
// Tema Elden Ring: os desenhos comuns. Tudo desenhado aqui, nada copiado do jogo: o Clawd veste uma das 3
// armaduras (elden-roupas.js), a Árvore Dourada, a névoa, as runas, a graça e a letra em serifa de pixel
// são nossas. No referencial do Clawd: origem entre os pés, x+ pra frente, y- pra fora do cartão.
const { DEG, lim, sai, entra, tela, cache, arte, tingida, rng, rgba, mistura } = require('./comum');
const { desenhaClawd, spriteClawd, andando: andandoBase, pulando: pulandoBase } = require('./clawd');
const ROUPAS = require('./elden-roupas');

const fatia = (t, a, b) => lim((t - a) / (b - a), 0, 1);
const P = 1.5;  // o pixel do Clawd

const COR = {
  ouro: '#D4AF37', ouroClaro: '#F2D77A', ouroEsc: '#8A6D1F', ouroFundo: '#3A2C0E', sangue: '#B91C1C', sangueClaro: '#EF4444',
  preto: '#0B0907', noite: '#120E08', aco: '#A8B0BC', corpo: '#D77757', contorno: '#3A2C0E', roupa: ROUPAS.LISTA[0],
  rotulo: '#B8A878', falta: '#7A6B45', graca: '#FDE68A', azul: '#60A5FA',
};

// ---------- o Clawd: a roupa da vez ----------
// O tema veste (vestir) antes de desenhar cada quadro; daqui pra frente tudo sai com a roupa e o contorno dela.
function vestir(roupa) {
  if (!ROUPAS.ROUPAS[roupa] || COR.roupa === roupa) return;
  COR.roupa = roupa; COR.contorno = ROUPAS.CONTORNO[roupa];
}
const ALTURA = ROUPAS.ROUPAS[ROUPAS.LISTA[0]].linhas.length;

// contorno de 1 px: a armadura escura anda por cima de qualquer fundo
function contorno(g, pernas, dy, L, olhos, cor = COR.contorno) {
  const spr = tingida(spriteClawd(COR.roupa, pernas, olhos, false, null), cor, 'eld-cont' + COR.roupa + pernas + olhos);
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.drawImage(spr, -13.5 + ox, -L * P + dy + oy, 27, L * P);
}

// ---------- a arma da roupa, na mão da frente (12; -7,5), pixel de 1 DIP ----------
// Cavaleiro: espada longa de aço com guarda de ouro. Bandido: adaga curta. Feiticeiro: cajado com a joia azul.
// ang em graus (0 = pra cima, positivo = pra frente); len 0..1 (a lâmina saindo)
const ARMAS = {
  'elden-cavaleiro': { alc: 17, larg: 2, cor: '#E5E7EB', borda: '#6B7280', guarda: 4 },
  'elden-bandido': { alc: 9, larg: 1.5, cor: '#D1D5DB', borda: '#4B5563', guarda: 3 },
  'elden-feiticeiro': { alc: 22, larg: 1.5, cor: '#7C5A2E', borda: '#3B2B16', guarda: 0 },
};
function arma(g, ang, dy = 0, len = 1, roupa = COR.roupa) {
  const A = ARMAS[roupa];
  if (!A || len <= 0) return;
  g.save(); g.translate(12, -7.5 + dy); g.rotate(ang * DEG);
  const L = A.alc * len;
  g.fillStyle = A.borda; g.fillRect(-A.larg / 2 - 0.5, -L - 0.5, A.larg + 1, L + 1.5);
  g.fillStyle = A.cor; g.fillRect(-A.larg / 2, -L, A.larg, L);
  if (A.guarda) { g.fillStyle = COR.ouro; g.fillRect(-A.guarda, -1.5, A.guarda * 2, 1.5); g.fillStyle = COR.ouroEsc; g.fillRect(-0.5, 0, 1, 3); }
  else {  // a joia do cajado
    g.fillStyle = COR.azul; g.fillRect(-1.5, -L - 3, 3, 3);
    g.fillStyle = '#DBEAFE'; g.fillRect(-0.5, -L - 2.5, 1, 1);
  }
  g.restore();
  // a mão em cima do cabo
  g.fillStyle = COR.contorno; g.fillRect(11.5, -8, 2.5, 2.5);
  g.fillStyle = COR.corpo; g.fillRect(12, -7.5, 1.5, 1.5);
}

// p: o do desenhaClawd + { arma: { ang, len } (null: sem), contorno (false: sem) }
function clawdElden(g, p = {}) {
  const pernas = p.sentado ? 'nenhuma' : (p.pernas || 'ambas'), olhos = p.olhos || 'abertos';
  desenhaClawd(g, {
    ...p, roupa: COR.roupa, ferr: null,
    atras(k, dy, L) { if (p.contorno !== false && !p.branco) contorno(k, pernas, dy, L, olhos); if (p.atras) p.atras(k, dy, L); },
    mao(k, dy) {
      if (p.arma && !p.branco) arma(k, p.arma.ang, dy, p.arma.len == null ? 1 : p.arma.len);
      if (p.mao) p.mao(k, dy);
    },
  });
}
const andando = (t, extra = {}) => ({ ...andandoBase(t), T: t, arma: { ang: 30 }, ...extra });
const pulando = (t, extra = {}) => ({ ...pulandoBase(t), T: t, arma: { ang: 150 }, ...extra });

// ---------- a letra: serifa de pixel (A–Z, acentos do português, números e pontuação) ----------
// Cada glifo: 5 colunas de largura (I tem 3, pontuação menos) e 7 linhas, mais 2 de acento em cima e 1 de cedilha embaixo
// (10 linhas no total; a linha 2 é o topo da maiúscula). O desenho da letra é o de sempre; a serifa vem do contorno e do
// brilho de ouro que o texto() põe por cima.
const G7 = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.####', '#....', '#....', '#....', '#....', '#....', '.####'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.####', '#....', '#....', '#..##', '#...#', '#...#', '.###.'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '##..#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  0: ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  1: ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  2: ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  3: ['####.', '....#', '....#', '.###.', '....#', '....#', '####.'],
  4: ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  5: ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  6: ['.###.', '#....', '#....', '####.', '#...#', '#...#', '.###.'],
  7: ['#####', '....#', '...#.', '..#..', '..#..', '..#..', '..#..'],
  8: ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  9: ['.###.', '#...#', '#...#', '.####', '....#', '....#', '.###.'],
  '!': ['#', '#', '#', '#', '#', '.', '#'],
  '.': ['.', '.', '.', '.', '.', '.', '#'],
  ',': ['.', '.', '.', '.', '.', '#', '#'],
  ':': ['.', '#', '.', '.', '.', '#', '.'],
  '-': ['...', '...', '...', '###', '...', '...', '...'],
  '%': ['#...#', '#..#.', '...#.', '..#..', '.#...', '.#..#', '#...#'],
  "'": ['#', '#', '.', '.', '.', '.', '.'],
};
const ACENTO = { agudo: ['..#', '.#.'], grave: ['#..', '.#.'], circ: ['.#.', '#.#'], til: ['.##.#', '#.##.'] };
const GLIFOS = {};
for (const [ch, l] of Object.entries(G7)) {
  const w = l[0].length;
  GLIFOS[ch] = { w, linhas: ['.'.repeat(w), '.'.repeat(w), ...l, '.'.repeat(w)] };
}
const COM_ACENTO = { Á: ['A', 'agudo'], É: ['E', 'agudo'], Í: ['I', 'agudo'], Ó: ['O', 'agudo'], Ú: ['U', 'agudo'], À: ['A', 'grave'], Â: ['A', 'circ'], Ê: ['E', 'circ'], Ô: ['O', 'circ'], Ã: ['A', 'til'], Õ: ['O', 'til'] };
for (const [ch, [base, ac]] of Object.entries(COM_ACENTO)) {
  const b = GLIFOS[base], centra = l => { const e = Math.max(0, Math.floor((b.w - l.length) / 2)); return ('.'.repeat(e) + l).padEnd(b.w, '.').slice(0, b.w); };
  const a = ACENTO[ac].map(centra);
  GLIFOS[ch] = { w: b.w, linhas: [...a, ...b.linhas.slice(2)] };
}
GLIFOS.Ç = { w: 5, linhas: ['.....', '.....', ...G7.C, '..#..'] };
const largGlifo = ch => (ch === ' ' ? 3 : GLIFOS[ch] ? GLIFOS[ch].w : 5);
const ALT_TEXTO = 7;  // pixels da maiúscula (sem acento nem cedilha)
// a largura do texto em pixels da fonte (k = o tamanho do pixel em DIPs)
function largTexto(s, k = 1) { let w = 0; for (const ch of String(s).toUpperCase()) w += largGlifo(ch) + 1; return Math.max(0, w - 1) * k; }
const IMGS = new Map();
function imagemGlifo(ch, cor) {
  const chave = ch + cor;
  let img = IMGS.get(chave);
  if (!img) { img = arte(GLIFOS[ch].linhas, { '#': cor }); IMGS.set(chave, img); }
  return img;
}
// x = começo, y = topo da maiúscula (sem o acento); k = pixel em DIPs (inteiro de preferência). Ouro com sombra preta embaixo e
// um fio de luz no alto de cada letra; alfa já vem do g.globalAlpha. opc: { cor, sombra, centro (x = o meio) }
function texto(g, s, x, y, k = 1, opc = {}) {
  const cor = opc.cor || COR.ouroClaro, sombra = opc.sombra !== false;
  const t = String(s).toUpperCase(), w = largTexto(t, k);
  let px = opc.centro ? x - w / 2 : x;
  px = Math.round(px);
  const topo = y - 2 * k;  // as 2 linhas de acento ficam acima do topo
  g.save();
  for (const ch of t) {
    if (GLIFOS[ch]) {
      const l = GLIFOS[ch];
      if (sombra) {
        g.globalAlpha *= 1;
        g.drawImage(imagemGlifo(ch, '#000000'), px + k, topo + k, l.w * k, l.linhas.length * k);
      }
      g.drawImage(imagemGlifo(ch, cor), px, topo, l.w * k, l.linhas.length * k);
    }
    px += (largGlifo(ch) + 1) * k;
  }
  g.restore();
}

// ---------- efeitos ----------
// partículas douradas subindo devagar (o "pó de graça"): n pontos pela área [x, y, w, h], função de t
function brasas(g, x, y, w, h, t, sem, n = 24, cor = COR.ouroClaro, vel = 0.12) {
  const r = rng(sem >>> 0);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const fase = r(), bx = r() * w, balanco = 2 + r() * 3, v = vel * (0.6 + r() * 0.8), tam = r() < 0.2 ? 2 : 1;
    const u = (fase + t * v) % 1, brilho = Math.sin(Math.PI * u) * (0.55 + 0.45 * Math.sin(t * 3 + i));
    g.fillStyle = rgba(cor, 0.85 * brilho);
    g.fillRect(Math.round(x + bx + Math.sin(u * 6 + i) * balanco), Math.round(y + h - u * h), tam, tam);
  }
  g.restore();
}

// a névoa dourada: faixas largas que sobem do chão, para o palco que abre. u 0..1 (o quanto), t relógio
function nevoa(g, x, y, w, h, u, t, cor = '#E8C766') {
  if (u <= 0) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 4; i++) {
    const cx = x + w * (0.1 + 0.27 * i) + Math.sin(t * 0.6 + i * 1.7) * 8, cy = y + h * (0.55 + 0.1 * Math.sin(t * 0.5 + i)), R = w * 0.28;
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, R);
    gr.addColorStop(0, rgba(cor, 0.22 * u)); gr.addColorStop(1, rgba(cor, 0));
    g.fillStyle = gr; g.fillRect(cx - R, cy - R * 0.6, R * 2, R * 1.2);
  }
  g.restore();
}

// A Árvore Dourada: tronco grosso e a copa em forma de leque de galhos finos que se abrem e brilham, desenhada por
// recursão em pixels (1 DIP); a base em (cx, base), altura ~alt. brilho 0..1; t pulsa devagar. Por cima do fundo escuro.
const ARVORES = new Map();
function arvoreImagem(w, alt, sem) {
  const chave = `${w}x${alt}:${sem}`;
  let img = ARVORES.get(chave);
  if (img) return img;
  img = tela(w, alt);
  const k = img.getContext('2d'), r = rng(sem >>> 0);
  const ponto = (x, y, cor) => { k.fillStyle = cor; k.fillRect(Math.round(x), Math.round(y), 1, 1); };
  const linha = (x0, y0, x1, y1, esp, c1, c2) => {
    const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
    for (let i = 0; i <= n; i++) {
      const u = i / n, x = x0 + (x1 - x0) * u, y = y0 + (y1 - y0) * u, e = Math.max(1, Math.round(esp));
      for (let d = 0; d < e; d++) ponto(x - (e - 1) / 2 + d, y, d === 0 ? c2 : c1);
    }
  };
  const galho = (x, y, ang, comp, esp, nivel) => {
    if (nivel > 6 || comp < 2) return;
    const x1 = x + Math.sin(ang) * comp, y1 = y - Math.cos(ang) * comp;
    linha(x, y, x1, y1, esp, nivel < 3 ? '#E8C766' : '#F2D77A', nivel < 3 ? '#A98524' : '#D4AF37');
    const n = nivel < 2 ? 2 : (r() < 0.6 ? 2 : 3);
    for (let i = 0; i < n; i++) {
      const aberto = (i - (n - 1) / 2) * (0.5 + r() * 0.3) + (r() - 0.5) * 0.25;
      galho(x1, y1, ang + aberto, comp * (0.68 + r() * 0.12), esp * 0.72, nivel + 1);
    }
  };
  const x0 = w / 2, base = alt - 1, tronco = alt * 0.3;
  linha(x0, base, x0, base - tronco, 4, '#C99A2E', '#8A6D1F');  // o tronco
  linha(x0, base - tronco, x0 - 3, base - tronco * 1.25, 3, '#C99A2E', '#8A6D1F');
  galho(x0, base - tronco, 0, alt * 0.2, 3, 0);
  galho(x0 - 3, base - tronco * 1.2, -0.7, alt * 0.17, 2, 1);
  galho(x0 + 2, base - tronco * 1.1, 0.7, alt * 0.17, 2, 1);
  ARVORES.set(chave, img);
  return img;
}
function arvore(g, cx, base, w, alt, brilho = 1, t = 0, sem = 3) {
  const img = arvoreImagem(Math.round(w), Math.round(alt), sem), pulso = 0.8 + 0.2 * Math.sin(t * 0.9);
  g.save(); g.globalAlpha *= lim(brilho, 0, 1) * pulso;
  g.drawImage(img, Math.round(cx - w / 2), Math.round(base - alt));
  g.globalCompositeOperation = 'lighter'; g.globalAlpha *= 0.45;
  g.drawImage(img, Math.round(cx - w / 2), Math.round(base - alt));
  g.restore();
}

// o clarão dourado de uma coisa que some/acende: círculo de luz em (x, y), raio r, u 0..1 de força
function luz(g, x, y, r, u, cor = COR.ouroClaro) {
  if (u <= 0) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y, 0, x, y, r);
  gr.addColorStop(0, rgba(mistura(cor, '#FFFFFF', 0.6), 0.9 * u)); gr.addColorStop(0.35, rgba(cor, 0.5 * u)); gr.addColorStop(1, rgba(cor, 0));
  g.fillStyle = gr; g.fillRect(x - r, y - r, r * 2, r * 2);
  g.restore();
}

// runas: pontinhos dourados que sobem de (x, y) e se curvam pra (ax, ay) (o contador); u 0..1 do voo; n quantas
function runas(g, x, y, ax, ay, u, sem, n = 10) {
  if (u <= 0 || u >= 1) return;
  const r = rng(sem >>> 0);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < n; i++) {
    const atraso = r() * 0.35, v = lim((u - atraso) / (1 - atraso), 0, 1);
    if (v <= 0) continue;
    const e = v * v * (3 - 2 * v), desvio = (r() - 0.5) * 24 * Math.sin(Math.PI * v);
    const px = x + (ax - x) * e + desvio, py = y + (ay - y) * e - Math.sin(Math.PI * v) * (8 + r() * 10);
    g.fillStyle = rgba(i % 3 ? COR.ouroClaro : '#FFFFFF', 0.95 * (1 - v * 0.4));
    g.fillRect(Math.round(px), Math.round(py), i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
  }
  g.restore();
}

// a graça: o pequeno sítio dourado (um facho de luz que sobe, em pixel) em (x, y) = o chão; u 0..1 (a força); t relógio
function graca(g, x, y, u, t) {
  if (u <= 0) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  const alt = 22 * u;
  for (let i = 0; i < 4; i++) {
    const w = 8 - i * 1.6;
    g.fillStyle = rgba(i < 2 ? COR.ouro : COR.graca, (0.14 + 0.05 * i) * u * (0.85 + 0.15 * Math.sin(t * 4 + i)));
    g.fillRect(x - w / 2, y - alt, w, alt);
  }
  luz(g, x, y - 2, 14, 0.6 * u);
  g.restore();
  // os pinguinhos de luz subindo
  const r = rng(Math.floor(x) + 91);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 6; i++) {
    const f = (r() + t * 0.35) % 1, bx = x + (r() - 0.5) * 7;
    g.fillStyle = rgba(COR.graca, 0.8 * Math.sin(Math.PI * f) * u);
    g.fillRect(Math.round(bx), Math.round(y - f * 26 * u), 1, 1);
  }
  g.restore();
}

// o sigilo do Anel Prístino: o anel grande, o anel de dentro em arcos, dois círculos que se cruzam e a linha vertical que
// passa por todos. Pixel art dourada, pronta por raio (cache com teto); a em 0..1; centro em (x, y).
const ANEIS = cache(24);
function anelImagem(r) {
  let img = ANEIS.get(r);
  if (img) return img;
  const S = Math.ceil(r * 2.5) + 6, c = S / 2;
  img = tela(S, S);
  const k = img.getContext('2d'), lw = r >= 14 ? 2 : 1, PI = Math.PI;
  const arco = (cx, cy, rr, a0, a1, cor, larg) => { k.strokeStyle = cor; k.lineWidth = larg; k.beginPath(); k.arc(cx, cy, rr, a0, a1); k.stroke(); };
  arco(c, c, r, 0, 2 * PI, COR.ouro, lw);
  arco(c, c, r + lw, 0, 2 * PI, COR.ouroEsc, 1);
  arco(c, c, r * 0.8, 0.12 * PI, 0.88 * PI, COR.ouroClaro, 1);
  arco(c, c, r * 0.8, 1.12 * PI, 1.88 * PI, COR.ouroClaro, 1);
  arco(c, c - r * 0.24, r * 0.5, 0, 2 * PI, COR.ouro, 1);
  arco(c, c + r * 0.24, r * 0.5, 0, 2 * PI, COR.ouro, 1);
  arco(c, c, r * 0.22, 0, 2 * PI, COR.ouroClaro, 1);
  k.strokeStyle = COR.ouroClaro; k.lineWidth = 1;
  k.beginPath(); k.moveTo(c, c - r * 1.2); k.lineTo(c, c + r * 1.2); k.stroke();
  k.fillStyle = '#FFFFFF';
  for (const d of [-1.2, 1.2]) k.fillRect(Math.round(c) - 1, Math.round(c + d * r) - 1, 2, 2);
  return ANEIS.set(r, img);
}
function anelPristino(g, x, y, r, a = 1) {
  r = Math.max(6, Math.round(r));
  if (a <= 0) return;
  const img = anelImagem(r), S = img.width, ox = Math.round(x - S / 2), oy = Math.round(y - S / 2);
  g.save();
  g.globalAlpha *= lim(a, 0, 1);
  g.drawImage(img, ox, oy);
  g.globalCompositeOperation = 'lighter'; g.globalAlpha *= 0.3;
  g.drawImage(img, ox, oy);
  g.restore();
}

// as cenas de parado: nada passa pra dentro do cartão (no referencial do Clawd)
function acimaDoCartao(g, desenha) {
  g.save(); g.beginPath(); g.rect(-80, -110, 160, 116); g.clip();
  try { desenha(); } finally { g.restore(); }
}

module.exports = {
  COR, ROUPAS, vestir, ALTURA, P, fatia, sai, entra, DEG, lim, clawdElden, arma, andando, pulando, contorno,
  GLIFOS, ALT_TEXTO, largTexto, texto, brasas, nevoa, arvore, luz, runas, graca, acimaDoCartao, anelPristino,
};
