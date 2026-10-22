'use strict';
// Tema Elden Ring, parado há muito tempo: o TORRENT pasta ao lado e ele faz carinho. O cavalo espectral (cinza-azulado
// claro, crina e cauda de névoa dourada, olhos âmbar) é pixel art feita em código (grade 40x34, corpo + cabeça em 10
// poses, contorno escuro, 3 tons) e guardada uma vez. Ele cravou a espada no chão (a mesma da graça) pra ter a mão livre.
// Ciclo de 16 s, com as horas sorteadas por ciclo: o Torrent mordisca a grama, ergue a cabeça e olha em volta, baixa
// a cabeça pra ele, que sobe a mão e afaga a testa (o Torrent fecha os olhos), e então sacode a crina numa rajada de
// ouro. Tudo função do tempo; a semente fica em m.estado.eldenTorrent (pra saída).
const A = require('./elden-arte');
const { arte, rgba, rng } = require('./comum');
const { espadaNoChao } = require('./parado-elden-graca');

const { fatia, COR } = A;
const suave = u => u * u * (3 - 2 * u);
const lerp = (a, b, u) => a + (b - a) * u;
const T = { solta: 0.8, espeta: 1.1, cavalo0: 1.2, cavalo1: 2.6, inicio: 3.0 };
const CICLO = 16;
const ESPADA_X = -22;
// o cavalo: a grade (1 px = 1 DIP), onde ela fica (x do canto esquerdo; o chão é y = 0) e o repouso da mão
const GW = 40, GH = 34, X0 = 12, Y0 = -33, NQ = 9;
const MAO0 = { x: 12, y: -7.5 };
const PAL = {
  o: '#232B38', b: '#AEBBD0', l: '#D9E3F0', s: '#8493AB', d: '#6B7A93', h: '#2E3644',
  e: '#FFB020', E: '#FFE9A8', x: '#1B1F29', m: '#7A89A3',
};

// ---------- a grade de pixels: formas por cápsulas (raio varia ao longo do eixo) ----------
const grade = () => Array.from({ length: GH }, () => Array(GW).fill('.'));
function capsula(G, x0, y0, r0, x1, y1, r1, ch, so) {
  const dx = x1 - x0, dy = y1 - y0, L2 = dx * dx + dy * dy || 1;
  const xa = Math.floor(Math.min(x0 - r0, x1 - r1)) - 1, xb = Math.ceil(Math.max(x0 + r0, x1 + r1)) + 1;
  const ya = Math.floor(Math.min(y0 - r0, y1 - r1)) - 1, yb = Math.ceil(Math.max(y0 + r0, y1 + r1)) + 1;
  for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) {
    if (x < 1 || y < 1 || x >= GW - 1 || y >= GH - 1) continue;  // 1 px de margem: é onde sai o contorno
    const u = Math.max(0, Math.min(1, ((x + 0.5 - x0) * dx + (y + 0.5 - y0) * dy) / L2));
    const r = lerp(r0, r1, u);
    if (Math.hypot(x + 0.5 - (x0 + dx * u), y + 0.5 - (y0 + dy * u)) <= r && (!so || G[y][x] === so)) G[y][x] = ch;
  }
}
const poe = (G, x, y, ch, so) => { x = Math.round(x); y = Math.round(y); if (G[y] && G[y][x] && (!so || G[y][x] === so)) G[y][x] = ch; };
const norm = (x, y) => { const n = Math.hypot(x, y) || 1; return { x: x / n, y: y / n }; };

// a geometria da cabeça na pose q (0 = baixa, comendo; NQ = alta): poll H, focinho M, eixo d, a frente do rosto nf, a crista
const N0 = { x: 14.5, y: 13.5 };  // onde o pescoço sai dos ombros
function geo(q) {
  const f = q / NQ;
  const H = { x: lerp(8.5, 10, f), y: lerp(22, 6, f) }, M = { x: 3.3, y: lerp(29.2, 12.6, f) };
  const d = norm(M.x - H.x, M.y - H.y);
  const cand = [{ x: d.y, y: -d.x }, { x: -d.y, y: d.x }];
  const nf = cand[0].x + cand[0].y < cand[1].x + cand[1].y ? cand[0] : cand[1];  // a frente do rosto: pra esquerda e pra cima
  const dn = norm(H.x - N0.x, H.y - N0.y), cn = [{ x: dn.y, y: -dn.x }, { x: -dn.y, y: dn.x }];
  const crista = cn[0].y < cn[1].y ? cn[0] : cn[1];  // o lado de cima do pescoço, onde nasce a crina
  return { H, M, d, nf, dn, crista, testa: { x: H.x + d.x * 1.3 + nf.x * 2.9, y: H.y + d.y * 1.3 + nf.y * 2.9 }, olho: { x: H.x + d.x * 1.9 + nf.x * 0.5, y: H.y + d.y * 1.9 + nf.y * 0.5 } };
}

// ---------- o cavalo ----------
function montar(q, fechado) {
  const G = grade(), P = geo(q);
  // pernas do lado de lá (escuras), o corpo, as pernas do lado de cá, o pescoço e a cabeça
  capsula(G, 19.5, 18, 2.3, 19.5, 25, 1.5, 'd'); capsula(G, 19.5, 25, 1.5, 19.7, 31.5, 1.3, 'd');
  capsula(G, 28.5, 19, 3, 28.2, 25, 1.6, 'd'); capsula(G, 28.2, 25, 1.6, 29.2, 31.5, 1.3, 'd');
  capsula(G, 16.5, 15, 5.8, 31, 14.5, 6.4, 'b');
  capsula(G, 14.5, 16.5, 4.6, 16, 16, 5, 'b'); capsula(G, 32.5, 14, 6, 33, 15.5, 5.6, 'b');  // o peito e a garupa, arredondando a barriga
  capsula(G, 15.5, 18, 2.8, 15.5, 25, 1.6, 'b'); capsula(G, 15.5, 25, 1.6, 15.7, 31.5, 1.4, 'b');
  capsula(G, 31.5, 18, 4, 31.5, 24, 2, 'b'); capsula(G, 31.5, 24, 2, 32.6, 28, 1.4, 'b'); capsula(G, 32.6, 28, 1.4, 32.2, 31.5, 1.3, 'b');
  capsula(G, N0.x, N0.y, 4.6, P.H.x, P.H.y, 3.3, 'b');
  capsula(G, P.H.x, P.H.y, 3.4, P.M.x, P.M.y, 2.1, 'b');
  capsula(G, lerp(P.H.x, P.M.x, 0.8), lerp(P.H.y, P.M.y, 0.8), 2.0, P.M.x, P.M.y, 2.1, 'm', 'b');  // o focinho, mais escuro
  // as orelhas saem da nuca, apontando pra cima e pra trás
  const ed = norm(-P.d.x * 0.6 + 0.25, -P.d.y * 0.6 - 0.75), er = { x: P.H.x - P.nf.x * 1.2, y: P.H.y - P.nf.y * 1.2 };
  capsula(G, er.x, er.y, 1.4, er.x + ed.x * 3.4, er.y + ed.y * 3.4, 0.5, 'b');
  // sombra e luz: topo claro, barriga e queixo escuros, algumas manchas de luz nos ombros e na garupa
  const c = G.map(l => l.slice());
  for (let y = 1; y < GH - 1; y++) for (let x = 1; x < GW - 1; x++) {
    if (c[y][x] !== 'b') continue;
    if (c[y - 1][x] === '.') G[y][x] = 'l';
    else if (c[y + 1][x] === '.' || (y >= 19 && y <= 22 && x >= 12 && x <= 36)) G[y][x] = 's';
  }
  for (const [x, y] of [[19, 11], [20, 11], [21, 11], [20, 12], [28, 10], [29, 10], [30, 10], [29, 11], [13, 16], [13, 17]]) poe(G, x, y, 'l', 'b');
  for (const [x, y] of [[24, 16], [25, 16], [26, 17], [18, 17]]) poe(G, x, y, 's', 'b');
  for (const [a, b] of [[14, 17], [18, 21], [27, 30], [31, 34]]) for (let x = a; x <= b; x++) for (let y = 30; y <= 32; y++) if (G[y][x] !== '.') G[y][x] = 'h';
  // o olho âmbar (ou o risco dele fechado) e a narina
  const ex = Math.round(P.olho.x - 0.5), ey = Math.round(P.olho.y - 0.5);
  if (fechado) { poe(G, ex - 1, ey + 1, 'x'); poe(G, ex, ey + 1, 'x'); poe(G, ex + 1, ey + 1, 'x'); }
  else { poe(G, ex, ey, 'E'); poe(G, ex, ey + 1, 'e'); poe(G, ex + 1, ey + 1, 'e'); poe(G, ex + 1, ey, 'e'); poe(G, ex - 1, ey, 'e'); }
  poe(G, P.M.x + P.d.x * 0.7 + P.nf.x * 0.4, P.M.y + P.d.y * 0.7 + P.nf.y * 0.4, 'x');
  // o contorno escuro em volta de tudo
  const f = G.map(l => l.slice());
  for (let y = 0; y < GH; y++) for (let x = 0; x < GW; x++) {
    if (f[y][x] !== '.') continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => f[y + b] && f[y + b][x + a] && f[y + b][x + a] !== '.' && f[y + b][x + a] !== 'o')) G[y][x] = 'o';
  }
  return arte(G.map(l => l.join('')), PAL);
}
const SPRITES = new Map();
function cavalo(q, fechado) {
  const chave = q * 2 + (fechado ? 1 : 0);
  let s = SPRITES.get(chave);
  if (!s) { s = montar(q, fechado); SPRITES.set(chave, s); }
  return s;
}

// a crina e a cauda são névoa dourada: pontos que ondulam, mais fortes na raiz e sumindo na ponta
const DOURADOS = ['#F2D77A', '#D4AF37', '#FFF3C4', '#E8C766'];
function nevoa(g, x, y, i, a) { g.fillStyle = rgba(DOURADOS[i & 3], a); g.fillRect(Math.round(x), Math.round(y), i % 5 === 0 ? 2 : 1, i % 5 === 0 ? 2 : 1); }
function crina(g, q, t, forca, dx) {
  const P = geo(q), n = 12;
  g.save();
  for (let i = 0; i < n; i++) {
    const u = 0.04 + 0.92 * i / (n - 1), rx = lerp(N0.x, P.H.x, u), ry = lerp(N0.y, P.H.y, u), rr = lerp(4.6, 3.3, u);
    const bx = rx + P.crista.x * rr + dx, by = ry + P.crista.y * rr, comp = (6 + 2.5 * ((i * 7) % 3)) * (1 + 0.7 * forca);
    for (let s = 0; s < 7; s++) {
      const w = s / 6, onda = Math.sin(t * 2.4 + i * 0.8 - w * 3) * (0.8 + 2 * forca) * w;
      const vx = P.crista.x * 0.7 + 0.6, vy = P.crista.y * 0.7 + 0.2 + w * 0.4;
      nevoa(g, X0 + bx + vx * comp * w + onda, Y0 + by + vy * comp * w + onda * 0.4 * w, i + s, 0.8 * (1 - w * 0.7));
    }
  }
  // o topete caindo sobre a testa
  for (let s = 0; s < 4; s++) nevoa(g, X0 + P.H.x + P.nf.x * 1.8 - s * 0.4 + dx, Y0 + P.H.y - P.nf.y * 0 + s * 1.1 - 2.6 + Math.sin(t * 2.4 + s) * 0.5, s, 0.7 - s * 0.12);
  g.restore();
}
function cauda(g, t, forca) {
  const R = { x: 37, y: 11.5 };
  for (let i = 0; i < 7; i++) {
    for (let s = 0; s < 15; s++) {
      const u = s / 14, sway = Math.sin(t * 1.5 + i * 0.25 - u * 3.5) * (0.8 + u * 2.2) * (1 + 0.5 * forca) + (i - 3) * 0.35 * u;
      nevoa(g, X0 + R.x + 1.2 + u * 2.4 + sway, Y0 + R.y + i * 0.3 + u * 17, i * 3 + s, 0.85 * (1 - u * 0.8));
    }
  }
}
// a grama: tufinhos dourados no chão em volta do Torrent
const TUFOS = (() => { const r = rng(4242), v = []; for (let i = 0; i < 16; i++) v.push({ x: 0 + i * 2.5 + r() * 2, h: 1 + Math.floor(r() * 2.4), c: r() < 0.5 ? '#9AA24A' : '#B7A44A' }); return v; })();
function grama(g) {
  for (const f of TUFOS) { g.fillStyle = f.c; g.fillRect(X0 + Math.round(f.x), -f.h, 1, f.h); g.fillRect(X0 + Math.round(f.x) + 1, -f.h + 1, 1, f.h - 1); }
}

// os instantes do ciclo k (sorteados pela semente)
function ciclo(sem, k) {
  const r = rng((sem + k * 6151) >>> 0), nib = [0.7 + r() * 0.3, 1.8 + r() * 0.3, 2.8 + r() * 0.4];
  const lev0 = 4.0 + r() * 0.6, lev1 = lev0 + 1.0, olha1 = lev1 + 1.1 + r() * 0.7, baixo1 = olha1 + 1.0, afaga1 = baixo1 + 2.8 + r() * 0.8;
  const sac0 = afaga1 + 0.2, sac1 = sac0 + 1.1, volta1 = sac1 + 1.0;
  const nib2 = [volta1 + 0.3, volta1 + 1.2, volta1 + 2.1];
  return { nib: [...nib, ...nib2], lev0, lev1, olha1, baixo1, afaga1, sac0, sac1, volta1 };
}
const bump = (cc, a, d) => { const p = fatia(cc, a, a + d); return p > 0 && p < 1 ? Math.sin(Math.PI * p) : 0; };
const FAGO = 0.15;  // a altura da cabeça no afago (fração da pose)
// o estado em t
function estado(t, sem) {
  const e = { alfa: suave(fatia(t, T.cavalo0, T.cavalo1)), f: 0, fechado: false, mao: 0, golpe: 0, sac: 0, dx: 0, ciclo: false, cc: 0, q: null };
  if (t >= T.inicio) {
    const c = t - T.inicio, k = Math.floor(c / CICLO), cc = c - k * CICLO, Q = ciclo(sem, k);
    e.ciclo = true; e.cc = cc; e.Q = Q;
    let f = 0;
    for (const a of Q.nib) f += 0.13 * bump(cc, a, 0.45);
    if (cc >= Q.lev0 && cc < Q.baixo1) {
      f = cc < Q.lev1 ? suave(fatia(cc, Q.lev0, Q.lev1)) : cc < Q.olha1 ? 1 : lerp(1, FAGO, suave(fatia(cc, Q.olha1, Q.baixo1)));
    } else if (cc >= Q.baixo1 && cc < Q.sac0) f = FAGO;
    else if (cc >= Q.sac0 && cc < Q.volta1) {
      f = cc < Q.sac1 ? lerp(FAGO, 0.5, suave(fatia(cc, Q.sac0, Q.sac0 + 0.4))) : lerp(0.5, 0, suave(fatia(cc, Q.sac1, Q.volta1)));
      if (cc < Q.sac1) { e.sac = Math.sin(Math.PI * fatia(cc, Q.sac0 + 0.3, Q.sac1)); e.dx = Math.sin(cc * 34) * 1.2 * e.sac; }
    }
    e.f = f;
    e.fechado = cc >= Q.baixo1 + 0.3 && cc < Q.afaga1 - 0.4;
    e.mao = suave(fatia(cc, Q.baixo1 - 0.9, Q.baixo1 + 0.2)) * (1 - suave(fatia(cc, Q.afaga1 - 0.7, Q.afaga1)));
    e.afaga = e.mao > 0.95 ? Math.sin((cc - Q.baixo1) * 5.5) : 0;
  }
  e.q = Math.round(e.f * NQ);
  e.piscou = t > T.espeta && (t % 4.7) < 0.12;
  return e;
}

// onde a mão está: no repouso, ou na testa do cavalo (mais o vai e vem do afago, ao longo do rosto)
function mao(e) {
  if (!e.mao) return null;
  const P = geo(e.q), ax = X0 + P.testa.x, ay = Y0 + P.testa.y, s = (e.afaga || 0) * 2.2;
  return { x: lerp(MAO0.x, ax - P.d.x * s, e.mao), y: lerp(MAO0.y, ay - P.d.y * s, e.mao) };
}
function desenhaMao(g, h) {  // o braço estica do ombro até a mão (contorno escuro, pele por cima)
  const x0 = 10.5, y0 = -7.5, n = Math.max(2, Math.ceil(Math.hypot(h.x - x0, h.y - y0) / 1));
  for (const [cor, e] of [[COR.contorno, 1.1], [COR.corpo, 0]]) {
    g.fillStyle = cor;
    for (let i = 0; i <= n; i++) { const u = i / n; g.fillRect(lerp(x0, h.x, u) - 0.75 - e, lerp(y0, h.y, u) - 0.75 - e, 1.5 + 2 * e, 1.5 + 2 * e); }
  }
  g.fillStyle = COR.contorno; g.fillRect(h.x - 1.5, h.y - 1.5, 3, 3); g.fillStyle = COR.corpo; g.fillRect(h.x - 1, h.y - 1, 2, 2);
}

function pinta(g, mT, t, e, sob = {}) {
  const fade = sob.fade ?? 1, alfa = e.alfa * fade;
  g.save();
  // o brilho dourado em volta do cavalo
  A.luz(g, X0 + 20, -15, 30, 0.2 * alfa + 0.25 * (e.sac || 0) * fade, COR.ouro);
  if (alfa > 0) {
    A.brasas(g, X0 - 4, -44, 48, 44, t, 55, 14, COR.ouroClaro, 0.1);
    g.save(); g.globalAlpha *= alfa;
    g.save(); g.translate(e.dx || 0, 0);
    g.drawImage(cavalo(e.q, e.fechado), X0, Y0, GW, GH);
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha *= 0.12; g.drawImage(cavalo(e.q, e.fechado), X0, Y0, GW, GH); g.restore();  // o espectro brilha
    crina(g, e.q, t, e.sac || 0, 0);
    g.restore();
    cauda(g, t, e.sac || 0);
    grama(g);
    if (e.sac > 0.05) { g.save(); g.globalAlpha *= e.sac; A.brasas(g, X0, -46, 30, 36, t * 2.5, 313, 18, COR.graca, 0.25); g.restore(); }
    g.restore();
  }
  if (e.alfa > 0 && e.alfa < 1) A.luz(g, X0 + 20, -16, 26, Math.sin(Math.PI * e.alfa) * 0.8, COR.graca);  // a névoa onde ele surge
  g.restore();
  // a espada cravada atrás dele (a mão fica livre pro afago)
  const plantada = t < T.solta ? 0 : suave(fatia(t, T.solta, T.espeta));
  espadaNoChao(g, ESPADA_X, plantada * (sob.espada ?? 1), (1 - plantada) * 14, 0);
  const h = mao(e), mh = h && h.y !== undefined ? h : null;
  A.clawdElden(g, {
    T: mT, pernas: 'ambas', brilho: 0.18 * (e.sac || 0) * fade,
    olhos: e.piscou || (e.fechado && e.mao > 0.9) ? 'fechados' : 'abertos',
    arma: sob.arma !== undefined ? sob.arma : (t < T.solta ? { ang: 165 } : null),
    mao: mh ? k => desenhaMao(k, { x: mh.x, y: mh.y }) : null,
  });
  if (mh && e.afaga && Math.abs(e.afaga) > 0.97) {  // uma faísca de ouro onde a mão passa
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba(COR.ouroClaro, 0.8); g.fillRect(Math.round(mh.x + 2), Math.round(mh.y - 2), 1, 1); g.restore();
  }
}

module.exports = {
  texturas: [],
  linhaDoTempo: [
    [0, 'em pé, espada no ombro'], [T.solta, 'crava a espada no chão'], [T.cavalo0, 'o Torrent surge numa névoa dourada e começa a pastar'],
    [T.inicio, `ciclo de ${CICLO} s: mordisca a grama (crina e cauda de névoa ondulam)`],
    [T.inicio + 4.5, 'ergue a cabeça e olha em volta'], [T.inicio + 7.5, 'baixa a cabeça pra ele, que afaga a testa (o Torrent fecha os olhos)'],
    [T.inicio + 12, 'o Torrent sacode a crina numa rajada de ouro'], [T.inicio + 14, 'volta a pastar e o ciclo recomeça'],
  ],
  cena(m) {
    const sem = Math.floor(m.sorteio() * 4294967296);
    m.estado.eldenTorrent = sem;
    return {
      nome: 'parado', dur: Infinity, espaco: { frente: 0, tras: 0 }, modos: ['parado'],
      quadro(g, t, mm) { A.acimaDoCartao(g, () => pinta(g, mm.T, t, estado(t, sem))); },
    };
  },
  // algo voltou a rodar: o Torrent some na névoa, a mão desce e a espada volta pra mão (1 s)
  saida: {
    dur: 1.0,
    quadro(g, u, m, tCorte) {
      A.acimaDoCartao(g, () => {
        const sem = m.estado.eldenTorrent >>> 0, c = Math.max(0, tCorte || 0), e = estado(c, sem), fade = 1 - fatia(u, 0, 0.7);
        const sombra = { ...e, mao: e.mao * (1 - suave(fatia(u, 0, 0.35))), sac: (e.sac || 0) * fade };
        pinta(g, m.T, c, sombra, { fade, espada: 1 - fatia(u, 0.25, 0.55), arma: c < T.solta || u >= 0.7 ? { ang: 165 } : null });
        if (u < 0.6) A.luz(g, X0 + 20, -16, 28, Math.sin(Math.PI * fatia(u, 0, 0.6)) * 0.7 * e.alfa, COR.graca);
      });
    },
  },
};
