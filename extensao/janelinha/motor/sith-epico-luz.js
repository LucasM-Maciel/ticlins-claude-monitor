'use strict';
// Evento épico raro do tema Sith NO LADO DA LUZ (a cada 30 droides, como o sombrio), ~19 s: A
// DEFESA DA FLORESTA (dono, 09/10). A área acima do cartão abre (de baixo pra cima) num dia
// nublado sobre uma floresta. A navinha creme encosta no cartão, o Clawd pula nela e os dois
// sobem; cápsulas de droides caem do céu na floresta e de cada uma sobem droides que atiram
// nele: ele rebate os tiros vermelhos com o sabre verde de volta neles. Um droide gigante desce
// nos jatos, com dois de escolta, e o olho dele carrega: o Clawd apaga o sabre, ergue a mão e a
// Força arranca uma pedra do chão da floresta, traz pro lado dele e arremessa: o gigante tomba
// pra trás e cai na floresta (poeira, folhas). A escolta foge, as nuvens abrem e o sol sai;
// passarinhos voltam, ele faz a saudação com o sabre, desce, salta da navinha (que vai embora)
// e o palco fecha. Desenho nosso (nada de filme): a navinha, as cápsulas, a pedra e a floresta
// são genéricas; os droides são os do tema.
//
// Como o sombrio (sith-epico.js): tudo pré-calculado na cena(m), pela semente; o quadro só
// consulta isso (é função de t). Coordenadas do palco: DIPs a partir do canto de cima à
// esquerda do cartão (X pra direita, Y- pra cima, 0 = borda de cima do cartão).
const { lim, sai, entra, tela, cache, arte, rng, rgba, mistura } = require('./comum');
const A = require('./sith-arte');

const { fatia, explosao, GIGANTE } = A;
const P = A.P;
const LUZ = A.LADOS.luz;
const suave = u => u * u * (3 - 2 * u);

// ---------- ritmo (s) ----------
const T = {
  abre: [0, 0.5],
  gigante: [8.3, 9.2], mira: [9.2, 10.0], apaga: [9.5, 9.7], agarra: 9.75, arranca: [9.75, 10.85], recua: [11.0, 11.2], joga: [11.2, 11.5], acerta: 11.5,
  solta: [11.5, 11.8], tomba: [11.5, 12.35], cai: 12.35, reacende: [12.2, 12.5],
  foge: [12.5, 13.3], nuvens: [12.9, 14.9], sol: [13.2, 15.0], passaros: [14.0, 17.4], saudacao: [15.0, 16.3],
  fecha: [17.95, 18.45], dur: 18.8,
};
const CAPSULAS = [1.4, 2.0, 2.6], QUEDA = 0.85;  // cada cápsula começa a cair (+ até 0,15 s) e leva QUEDA até o chão
const BATE = [4.4, 5.15, 5.9, 6.7, 7.5];         // o tiro do droide chega no sabre
const VOO = 0.32, VOLTA = 0.2, DV = 2.6;         // o tiro até o sabre, rebatido até o droide; o caminho inteiro do droide
const SABRE = [16, -15];                        // onde o tiro bate no sabre (referencial do Clawd)
const MAO = [12, -9];                           // a mão erguida (a Força sai dela)
const PG = 3, GW = GIGANTE[0].length * PG, GH = GIGANTE.length * PG;

// ---------- o voo: a navinha ----------
// Chega pela esquerda e encosta (o convés 5 DIPs acima do cartão), ele pula nela, os dois sobem
// até o meio da batalha (J.Xb, J.alt) e pairam balançando; no fim descem, ele salta pro cartão e
// ela vai embora pela direita, subindo.
const VOA = { chega: [0.4, 1.0], embarca: [1.0, 1.25], sobe: [1.25, 2.1], desce: [16.4, 17.2], salta: [17.2, 17.45], vai: [17.4, 17.95] };
const CONVES = -5;
// onde estão o Clawd (os pés) e a navinha em t, no referencial do Clawd (k: 0 no cartão, 1 no alto)
function clawdEm(J, t) {
  const k = suave(fatia(t, VOA.sobe[0], VOA.sobe[1])) * (1 - suave(fatia(t, VOA.desce[0], VOA.desce[1])));
  let nx = (J.Xb - J.X0) * k + Math.sin(t * 0.8) * J.deriva * k, ny = CONVES + (-J.alt - CONVES) * k + Math.sin(t * 2.2) * 1.5 * k, rastro = 0;
  if (t < VOA.chega[1]) { const u = fatia(t, VOA.chega[0], VOA.chega[1]); nx = -(J.X0 + 50) * (1 - sai(u)); rastro = 1 - u; }
  if (t >= VOA.vai[0]) { const u = entra(fatia(t, VOA.vai[0], VOA.vai[1])); nx = (J.cw - J.X0 + 50) * u; ny = CONVES - 26 * u; rastro = fatia(t, VOA.vai[0], VOA.vai[1]); }
  const nave = { x: nx, y: ny, rastro, ve: t >= VOA.chega[0] && t < VOA.vai[1] };
  let x = 0, y = 0;
  if (t >= VOA.embarca[0] && t < VOA.embarca[1]) { const u = fatia(t, VOA.embarca[0], VOA.embarca[1]); y = CONVES * u - 6 * Math.sin(Math.PI * u); }
  else if (t >= VOA.embarca[1] && t < VOA.salta[0]) { x = nx; y = ny; }
  else if (t >= VOA.salta[0] && t < VOA.salta[1]) { const u = fatia(t, VOA.salta[0], VOA.salta[1]); y = CONVES * (1 - u) - 6 * Math.sin(Math.PI * u); }
  return { x, y, k, nave };
}

const linhaDoTempo = [
  [0, 'o palco abre acima do cartão: um dia nublado sobre uma floresta'],
  [VOA.chega[0], 'a navinha chega e encosta; o Clawd pula nela e os dois sobem'],
  [CAPSULAS[0], 'cápsulas de droides caem do céu na floresta'],
  [BATE[0] - 1.5, 'droides sobem da floresta atirando; ele rebate os 5 tiros de volta neles'],
  [T.gigante[0], 'um droide gigante desce nos jatos, com dois de escolta, e o olho dele carrega'],
  [T.agarra, 'o Clawd apaga o sabre e ergue a mão: a Força arranca uma pedra do chão da floresta'],
  [T.joga[0], 'ele arremessa a pedra no gigante'],
  [T.acerta, 'acerta: o gigante tomba pra trás e cai na floresta (poeira e folhas)'],
  [T.reacende[0], 'o sabre acende de novo'],
  [T.foge[0], 'a escolta foge'],
  [T.nuvens[0], 'as nuvens abrem e o sol sai'],
  [T.passaros[0], 'passarinhos voltam'],
  [T.saudacao[0], 'ele gira o sabre e faz a saudação'],
  [VOA.desce[0], 'a navinha desce; ele salta pro cartão e ela vai embora'],
  [T.fecha[0], 'o palco fecha de volta pra borda do cartão'],
];

// ---------- desenhos ----------
// a cápsula dos droides (cai de pé; os pezinhos embaixo)
const CAPSULA = [
  '..ggg..',
  '.gllkg.',
  'gllllkg',
  'glrRlkg',
  'gllllkg',
  'gkkkkkg',
  '.gkkkg.',
  'a.a.a.a',
];
const KW = CAPSULA[0].length * P, KH = CAPSULA.length * P;
// a pedra: musgo em cima, a terra presa embaixo
const PEDRA = [
  '.....mmmmmm.....',
  '...mmMMMMMMmm...',
  '..mMMMssMMMMMm..',
  '.mMMsssMMMMMMMb.',
  'mMMMssMMMMMMMMbb',
  'mMMMMMMMMMMMMbbb',
  'MMMMMMMMMMMMbbbb',
  'bMMMMMMMMMMbbbbb',
  '.bbMMMMMMbbbbbb.',
  '..bbbbbbbbbbbb..',
  '...btbbbbbbtb...',
  '....t..tt..t....',
];
const COR_PEDRA = { m: '#5E7A45', M: '#8A7F6A', s: '#B5AC94', b: '#5C5244', t: '#5C3A1E' };
const PW = PEDRA[0].length * P, PH = PEDRA.length * P;

// a paisagem: o céu (nublado ou de sol), o morro, as copas de trás e os pinheiros da frente; no
// nublado, a floresta é a do sol escurecida
const CEU = { nublado: ['#6F6B60', '#A19A86'], sol: ['#E3DCC1', '#FAF5E4'] };
const FLORA = { morro: '#A3AE86', morroLuz: '#BCC59D', copa: '#557A3E', copaLuz: '#76984F', pinho: '#2F5228', pinhoLuz: '#46703A', faixa: '#27451F', chao: '#4A3520' };
const corDe = (clima, n) => (clima === 'sol' ? FLORA[n] : mistura(FLORA[n], '#3A372E', 0.38));
// o céu, o morro e as copas de trás, prontos no tamanho da tela
const FUNDOS = cache(6);
function fundo(J, e, clima) {
  const W = Math.round(J.cw * e), H = Math.round(J.HJ * e), chave = `${W}x${H}${clima}`;
  const pronto = FUNDOS.get(chave);
  if (pronto) return pronto;
  const c = tela(W, H), k = c.getContext('2d'), r = rng(1138), [c0, c1] = CEU[clima];
  const Y = v => (J.HJ + v) * e;  // DIP do palco -> linha da imagem
  for (let y = 0; y < H; y++) { k.fillStyle = mistura(c0, c1, y / Math.max(1, H - 1)); k.fillRect(0, y, W, 1); }  // o raster não tem gradiente linear
  // o morro: a crista ondulada, com a borda de cima mais clara
  for (let x = 0; x < W; x++) {
    const X = x / e, topo = Math.round(Y(J.morro + 5 * Math.sin(X * 0.031 + 1) + 3 * Math.sin(X * 0.083 + 2)));
    k.fillStyle = corDe(clima, 'morro'); k.fillRect(x, topo, 1, H - topo);
    k.fillStyle = corDe(clima, 'morroLuz'); k.fillRect(x, topo, 1, Math.max(1, Math.round(e)));
  }
  // as copas redondas de trás, com o lado de cima à esquerda mais claro
  const chao = Math.round(Y(J.copas + 3));
  k.fillStyle = corDe(clima, 'copa'); k.fillRect(0, chao, W, H - chao);
  for (let x = -6; x < J.cw + 8; x += 7 + 5 * r()) {
    const cy = J.copas + (r() - 0.5) * 6, raio = 5 + 4 * r();
    k.fillStyle = corDe(clima, 'copa'); k.beginPath(); k.arc(x * e, Y(cy), raio * e, 0, Math.PI * 2); k.fill();
    k.fillStyle = corDe(clima, 'copaLuz'); k.beginPath(); k.arc((x - raio * 0.3) * e, Y(cy - raio * 0.3), raio * 0.5 * e, 0, Math.PI * 2); k.fill();
  }
  return FUNDOS.set(chave, c);
}
// os pinheiros da frente e a faixa cheia de baixo (só as linhas de baixo do palco: oy = a 1ª)
const FRENTES = cache(6);
function frente(J, e, clima) {
  const W = Math.round(J.cw * e), oy = Math.max(0, Math.floor((J.HJ + J.base - J.pinho - 2) * e)), H = Math.round(J.HJ * e) - oy, chave = `${W}x${H}${oy}${clima}`;
  const pronta = FRENTES.get(chave);
  if (pronta) return pronta;
  const c = tela(W, H), k = c.getContext('2d'), r = rng(2187);
  const Y = v => (J.HJ + v) * e - oy;
  const tri = (cor, a, b, d) => { k.fillStyle = cor; k.beginPath(); k.moveTo(a[0] * e, Y(a[1])); k.lineTo(b[0] * e, Y(b[1])); k.lineTo(d[0] * e, Y(d[1])); k.closePath(); k.fill(); };
  // três andares de triângulo; o lado esquerdo mais claro (a luz vem do alto)
  for (let x = -4; x < J.cw + 6; x += 6 + 6 * r()) {
    const h = J.pinho * (0.55 + 0.45 * r()), w = h * 0.62, b = J.base + 0.5;
    for (let i = 0; i < 3; i++) {
      const yb = b - i * h * 0.27, yt = yb - h * 0.46, wi = w * (1 - i * 0.24) / 2;
      tri(corDe(clima, 'pinho'), [x - wi, yb], [x + wi, yb], [x, yt]);
      tri(corDe(clima, 'pinhoLuz'), [x - wi, yb], [x - wi * 0.2, yb], [x, yt]);
    }
  }
  const faixa = Math.round(Y(J.base));
  k.fillStyle = corDe(clima, 'faixa'); k.fillRect(0, faixa, W, H - faixa);
  for (let x = 0; x < J.cw; x += 4 + 4 * r()) { k.beginPath(); k.arc(x * e, Y(J.base + 0.5), (1.5 + 2 * r()) * e, 0, Math.PI * 2); k.fill(); }  // as moitas
  const chao = Math.round(Y(-1.5));
  k.fillStyle = corDe(clima, 'chao'); k.fillRect(0, chao, W, H - chao);
  return FRENTES.set(chave, { img: c, oy });
}
// o sol: o brilho e os raios (pulsam) e o disco, prontos no tamanho da tela
const SOIS = cache(4);
function solImg(e) {
  const R = 36, D = Math.ceil(2 * R * e) + 2, chave = `${D}`;
  const pronto = SOIS.get(chave);
  if (pronto) return pronto;
  const brilho = tela(D, D), k = brilho.getContext('2d'), c = D / 2;
  const gr = k.createRadialGradient(c, c, 0, c, c, R * e);
  gr.addColorStop(0, rgba('#FFF3C4', 0.75)); gr.addColorStop(0.35, rgba('#FDE68A', 0.28)); gr.addColorStop(1, rgba('#FDE68A', 0));
  k.fillStyle = gr; k.fillRect(0, 0, D, D);
  k.fillStyle = rgba('#FDE68A', 0.35);
  for (let i = 0; i < 12; i++) {
    const a = i * Math.PI / 6, L = (i % 2 ? 22 : 31) * e, w = 0.07;
    k.beginPath(); k.moveTo(c + Math.cos(a - w) * 11 * e, c + Math.sin(a - w) * 11 * e); k.lineTo(c + Math.cos(a) * L, c + Math.sin(a) * L); k.lineTo(c + Math.cos(a + w) * 11 * e, c + Math.sin(a + w) * 11 * e); k.closePath(); k.fill();
  }
  const disco = tela(D, D), d = disco.getContext('2d');
  d.fillStyle = '#FDE68A'; d.beginPath(); d.arc(c, c, 9 * e, 0, Math.PI * 2); d.fill();
  d.fillStyle = '#FFF7D6'; d.beginPath(); d.arc(c - 1.5 * e, c - 1.5 * e, 6 * e, 0, Math.PI * 2); d.fill();
  return SOIS.set(chave, { brilho, disco, D });
}
// uma nuvem carregada (bolhas com a borda de cima clara e a de baixo escura), pronta no tamanho da tela
const NUVENS = cache(16);
function nuvemImg(w, h, e, sem) {
  const W = Math.ceil(w * e) + 2, H = Math.ceil(h * e) + 2, chave = `${W}x${H}:${sem}`;
  const pronta = NUVENS.get(chave);
  if (pronta) return pronta;
  const c = tela(W, H), k = c.getContext('2d'), r = rng(sem), n = 5, bolhas = [];
  for (let i = 0; i < n; i++) {
    const s = Math.sin(Math.PI * (i + 0.5) / n), raio = h * (0.26 + 0.2 * s * (0.7 + 0.3 * r()));
    bolhas.push([w * (0.16 + 0.68 * i / (n - 1)) + (r() - 0.5) * w * 0.06, h - raio - h * 0.12 * r(), raio]);
  }
  for (const [cor, dy] of [['#857E6C', 1.5], ['#BDB6A2', -1.2], ['#A29B87', 0]]) {
    k.fillStyle = cor;
    for (const [x, y, raio] of bolhas) { k.beginPath(); k.arc(x * e + 1, (y + dy) * e + 1, raio * e, 0, Math.PI * 2); k.fill(); }
  }
  return NUVENS.set(chave, c);
}

// ---------- o plano (pela semente) ----------
// curva de Bézier quadrática do droide: começa em te, dura D, p0 -> c -> p1; balança 1 px
function posDroide(f, t) {
  const u = (t - f.te) / f.D, v = 1 - u;
  return [v * v * f.p0[0] + 2 * u * v * f.c[0] + u * u * f.p1[0], v * v * f.p0[1] + 2 * u * v * f.c[1] + u * u * f.p1[1] + Math.sin(t * 6 + f.fase)];
}
// a cápsula caindo (acelera; parada no chão depois)
function posCapsula(p, t) {
  const u = lim((t - p.t0) / QUEDA, 0, 1);
  return [p.x0 + (p.x1 - p.x0) * u, p.y0 + (p.y1 - p.y0) * (0.35 * u + 0.65 * u * u)];
}
// o gigante em t: o meio dele (x, y), o giro (tombando, em volta do pé) e se aparece
function giganteEm(J, t) {
  const G = J.gigante, u = sai(fatia(t, T.gigante[0], T.gigante[1]));
  let x = G.x, y = -J.HJ - GH + (G.y + J.HJ + GH) * u + Math.sin(t * 1.7) * 1.2 * u, ang = 0;
  if (t >= T.acerta) { const k = fatia(t, T.tomba[0], T.tomba[1]); ang = G.dir * 1.2 * entra(k); x += G.dir * 14 * k; y += (20 - G.y) * entra(k); }
  return { x, y, ang, ve: t >= T.gigante[0] && t < T.cai + 0.3 };
}
// um da escolta em t: chega com o gigante, paira, e foge pro alto
function escoltaEm(J, s, t) {
  let x = s.x, y = -J.HJ - 14 + (s.y + J.HJ + 14) * sai(fatia(t, T.gigante[0] + 0.15, T.gigante[1] + 0.25)) + Math.sin(t * 2.3 + s.fase) * 1.5;
  const f = entra(fatia(t, T.foge[0] + s.atraso, T.foge[1] + s.atraso));
  x += J.lado * 70 * f; y -= (y + J.HJ + 20) * f;
  return { x, y, foge: f > 0, ve: t >= T.gigante[0] && t < T.foge[1] + s.atraso };
}
// a pedra em t (o meio): sobe do chão, treme, recua e voa até o gigante girando
function pedraEm(J, t) {
  if (t < T.arranca[0] || t >= T.acerta) return null;
  const R = J.pedra, de = J.base + 14, s = sai(fatia(t, T.arranca[0], T.arranca[1]));
  let x = R.x, y = de + (R.y - de) * s + Math.sin(t * 3) * s, ang = 0;
  if (t < T.joga[0]) {
    if (t >= T.arranca[1]) { x += Math.sin(t * 61) * 0.7; y += Math.cos(t * 53) * 0.5; }
    x -= J.lado * 5 * sai(fatia(t, T.recua[0], T.recua[1]));
    return { x, y, ang };
  }
  const u = fatia(t, T.joga[0], T.joga[1]), x0 = R.x - J.lado * 5, G = giganteEm(J, T.acerta);
  return { x: x0 + (G.x - x0) * entra(u), y: R.y + (G.y - R.y) * entra(u) - 8 * Math.sin(Math.PI * u), ang: J.lado * 2 * Math.PI * u };
}

function montar(m, r) {
  const c = m.host.cartao || [98, 260, 248, 146], casa = m.pose();
  const cw = c[2], HJ = Math.round(lim(c[1] - 14, 112, 184)), X0 = casa.x - c[0];
  const J = { cw, HJ, X0 };
  // a floresta: a crista do morro, a linha das copas, a faixa cheia de baixo e a altura dos pinheiros
  J.morro = -HJ * 0.42; J.copas = -HJ * 0.3; J.base = -Math.round(HJ * 0.07); J.pinho = HJ * 0.14;
  // o voo: a ~1/3 do palco, no alto o bastante pros droides passarem por baixo; balança sem sair
  J.alt = Math.round(lim(HJ * 0.36, 32, 62));
  J.Xb = Math.round(lim(cw * 0.32, 34, cw - 110));
  J.deriva = lim(Math.min(J.Xb - 24, cw - J.Xb - 30), 0, 7);
  const lado = J.lado = J.Xb + 120 <= cw - 10 ? 1 : -1;  // de que lado vem a briga (onde cabe)
  // as cápsulas: caem do alto, inclinadas, do lado da briga, e somem atrás dos pinheiros
  const vao = Math.max(24, lado > 0 ? cw - 14 - (J.Xb + 44) : J.Xb - 58);
  J.capsulas = CAPSULAS.map((t0, i) => {
    const ti = t0 + 0.15 * r(), x1 = lim(J.Xb + lado * (44 + (i + r()) * vao / 3), 14, cw - 14);
    return { t0: ti, pousa: ti + QUEDA, x0: lim(x1 + lado * (24 + 24 * r()), 8, cw - 8), y0: -HJ - 12, x1, y1: J.base + 3, sem: Math.floor(r() * 1e9) };
  });
  // os droides: cada um sobe da cápsula dele, atira em tf (no meio da curva) e o sabre devolve
  J.droides = BATE.map((b0, i) => {
    const tb = b0 + (r() - 0.5) * 0.24, tf = tb - VOO, th = tb + VOLTA, cl = clawdEm(J, tb), cx = X0 + cl.x, cy = cl.y - 14;
    const q = [lim(cx + lado * (42 + 26 * r()), 20, cw - 20), cy - 4 - 12 * r()];
    const p0 = [J.capsulas[i % 3].x1, J.base + 4], p1 = [q[0] + lado * (30 + 40 * r()), -HJ - 14];
    const s = [cx + SABRE[0], cl.y + SABRE[1]];  // onde o tiro bate no sabre (o Clawd no ar, em tb)
    return { tb, tf, th, te: tf - DV / 2, D: DV, fase: r() * 6, p0, p1, s, c: [2 * q[0] - (p0[0] + p1[0]) / 2, 2 * q[1] - (p0[1] + p1[1]) / 2] };
  });
  // o gigante: do lado da briga, pairando acima das copas, olhando pro Clawd; a escolta em volta
  const G = J.gigante = { x: lim(J.Xb + lado * 86, GW / 2 + 6, cw - GW / 2 - 6), y: -Math.round(lim(HJ * 0.52, 50, 86)), dir: lado };
  J.escolta = [
    { x: lim(G.x - lado * 36, 10, cw - 10), y: G.y - GH / 2 - 4, fase: r() * 6, atraso: 0 },
    { x: lim(G.x + lado * 18, 10, cw - 10), y: G.y - GH / 2 - 16, fase: r() * 6, atraso: 0.15 },
  ];
  J.pedra = { x: lim(J.Xb + lado * 38, 16, cw - 16), y: -J.alt - 16 };
  // o céu: o sol do lado de lá (atrás do Clawd), coberto por uma faixa de nuvens
  J.sol = { x: Math.round(cw * (lado > 0 ? 0.18 : 0.82)), y: -Math.round(HJ * 0.8) };
  J.nuvens = Array.from({ length: 5 }, (_, i) => ({
    x: cw * (i + 0.5) / 5 + (r() - 0.5) * cw * 0.12, y: -HJ * (0.74 + 0.1 * r()),
    w: Math.round(cw * (0.34 + 0.14 * r())), h: Math.round(HJ * (0.12 + 0.05 * r())), sem: Math.floor(r() * 1e9),
  }));
  J.passaros = Array.from({ length: 5 }, (_, i) => ({ t0: T.passaros[0] + i * 0.4 + 0.3 * r(), y: -HJ * (0.58 + 0.25 * r()), v: 28 + 16 * r(), fase: r() * 6 }));
  const rd = rng(Math.floor(r() * 4294967296));
  J.cacos = Array.from({ length: 10 }, () => ({ a: rd() * Math.PI * 2, v: 30 + rd() * 60, s: rd() < 0.4 ? 3 : 2, cor: rd() < 0.5 ? COR_PEDRA.M : COR_PEDRA.b }));
  J.terra = Array.from({ length: 10 }, () => ({ a: Math.PI * (1.15 + 0.7 * rd()), v: 20 + rd() * 35, cor: rd() < 0.5 ? '#5C3A1E' : '#7A5230' }));
  J.folhas = Array.from({ length: 14 }, () => ({ a: Math.PI * (1.1 + 0.8 * rd()), v: 25 + rd() * 40, fase: rd() * 6, cor: rd() < 0.35 ? '#7A5230' : rd() < 0.5 ? FLORA.copaLuz : FLORA.copa }));
  J.sem = Math.floor(rd() * 4294967296);
  return J;
}

// ---------- o quadro ----------
// poeira subindo de (x, y): bolhas que crescem, sobem e somem (d = s desde o começo; tam: o
// tamanho das bolhas, n: quantas)
function poeira(g, x, y, d, raio, dur, sem, tam = 1, n = 9) {
  if (d < 0 || d >= dur) return;
  const u = d / dur, r = rng(sem);
  g.save(); g.globalAlpha *= 0.75 * (1 - u);
  for (let i = 0; i < n; i++) {
    const a = Math.PI * (1 + r()), v = raio * (0.4 + 0.6 * r()) * sai(u), w = (2 + 3 * r()) * (0.6 + 1.2 * u) * tam;
    g.fillStyle = i % 3 ? '#B8A784' : '#8C7A5A';
    g.beginPath(); g.arc(x + Math.cos(a) * v, y + Math.sin(a) * v * 0.6 - 10 * tam * u * r(), w, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

function desenharSol(g, t, J, e, OX, OY) {
  const s = suave(fatia(t, T.sol[0], T.sol[1]));
  if (s <= 0) return;
  const S = solImg(e), x = Math.round((OX + J.sol.x) * e - S.D / 2), y = Math.round((OY + J.sol.y + 12 * (1 - s)) * e - S.D / 2);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.globalAlpha = s * (0.85 + 0.15 * Math.sin(t * 2.1)); g.drawImage(S.brilho, x, y);
  g.globalAlpha = s; g.drawImage(S.disco, x, y);
  g.restore();
}

function desenharNuvens(g, t, J, e, OX, OY) {
  const u = fatia(t, T.nuvens[0], T.nuvens[1]);
  if (u >= 1) return;
  const a = 1 - fatia(u, 0.45, 1);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = a;
  J.nuvens.forEach((n, i) => {
    const dx = Math.sign(n.x - J.sol.x || 1) * J.cw * 0.75 * entra(u) + Math.sin(t * 0.35 + i * 1.7) * 3;
    g.drawImage(nuvemImg(n.w, n.h, e, n.sem), Math.round((OX + n.x + dx - n.w / 2) * e), Math.round((OY + n.y - n.h / 2) * e));
  });
  g.restore();
}

// os passarinhos: um V marrom batendo as asas, do lado do sol pro lado da briga
function desenharPassaros(g, t, J) {
  g.fillStyle = '#4A3A22';
  for (const p of J.passaros) {
    const d = t - p.t0;
    if (d < 0 || t >= T.passaros[1]) continue;
    const x = (J.lado > 0 ? -6 : J.cw + 6) + J.lado * p.v * d, y = p.y + Math.sin(d * 3 + p.fase) * 2;
    if (x < -8 || x > J.cw + 8) continue;
    const asa = Math.sin(d * 18 + p.fase) > 0 ? -1 : 0.5;
    g.fillRect(x - 0.5, y, 1, 1);
    g.fillRect(x - 2.5, y + asa, 2, 1); g.fillRect(x + 0.5, y + asa, 2, 1);
  }
}

function desenharCapsulas(g, t, J, X, Y) {
  const img = arte(CAPSULA, A.CORES_FROTA);
  for (const p of J.capsulas) {
    if (t < p.t0) continue;
    // a fumaça do rastro fica no ar e some em 1,2 s
    for (let j = 0; j < 10; j++) {
      const tj = p.t0 + j * QUEDA / 10, d = t - tj;
      if (d < 0 || d > 1.2) continue;
      const [x, y] = posCapsula(p, tj), w = 2 + 5 * d;
      g.fillStyle = rgba(j % 2 ? '#8F8A7C' : '#A8A293', 0.5 * (1 - d / 1.2)); g.fillRect(x - w / 2, y - 6 - w / 2 - 6 * d, w, w);
    }
    if (t >= p.pousa) continue;
    const [x, y] = posCapsula(p, t);
    g.save(); g.globalCompositeOperation = 'lighter';  // o fogo da entrada, atrás (em cima)
    for (let k = 1; k <= 6; k++) {
      const [fx, fy] = posCapsula(p, t - k * 0.025), s = 4 - k * 0.4;
      g.fillStyle = rgba(k < 3 ? '#FDE68A' : '#F97316', 0.5 * (1 - k / 7)); g.fillRect(fx - s / 2, fy - 6 - s / 2, s, s);
    }
    g.restore();
    g.drawImage(img, X(x - KW / 2), Y(y - KH / 2), KW, KH);
  }
}

function desenharGigante(g, t, J, X, Y) {
  const G = J.gigante, n = giganteEm(J, t);
  if (!n.ve) return;
  const chega = fatia(t, T.gigante[0], T.gigante[1]);
  g.save();
  g.globalAlpha *= 1 - fatia(t, T.cai, T.cai + 0.3);  // some na poeira
  g.translate(X(n.x), Y(n.y + GH / 2)); g.rotate(n.ang);  // o giro em volta do pé
  // os jatos embaixo: fortes descendo, falhando depois da pedrada
  const jato = t < T.acerta ? 0.55 + 0.45 * (1 - chega) : 0.6 * (1 - fatia(t, T.acerta, T.acerta + 0.4)) * (Math.sin(t * 50) > 0 ? 1 : 0.3);
  if (jato > 0) {
    g.save(); g.globalCompositeOperation = 'lighter';
    for (const jx of [-15, 15]) {
      const L = (4 + 7 * jato) * (0.85 + 0.15 * Math.sin(t * 37 + jx));
      g.fillStyle = rgba('#F97316', 0.6 * jato); g.fillRect(jx - 2, 0, 4, L);
      g.fillStyle = rgba('#FDE68A', 0.8 * jato); g.fillRect(jx - 1, 0, 2, L * 0.55);
    }
    g.restore();
  }
  g.scale(G.dir, 1);
  g.drawImage(arte(GIGANTE, A.CORES_FROTA), -GW / 2, -GH, GW, GH);
  if (t >= T.acerta) {  // o olho apagou
    g.fillStyle = '#111827'; g.fillRect(-GW / 2 + 6 * PG, -GH + 5 * PG, 6 * PG, 4 * PG);
    g.fillStyle = '#450A0A'; g.fillRect(-GW / 2 + 8 * PG, -GH + 6 * PG, 2 * PG, 2 * PG);
  }
  g.restore();
  // o olho carregando (mirando o Clawd) até a pedrada: brilho que cresce e faíscas sendo puxadas
  const carga = fatia(t, T.mira[0], T.mira[1]);
  if (carga > 0 && t < T.acerta) {
    const ox = n.x + G.dir * (27 - GW / 2), oy = n.y + 21 - GH / 2, pisca = 0.75 + 0.25 * Math.sin(t * 40);
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(ox, oy, 0, ox, oy, 4 + 12 * carga);
    gr.addColorStop(0, rgba('#FECACA', 0.9 * carga * pisca)); gr.addColorStop(1, rgba('#EF4444', 0));
    g.fillStyle = gr; g.fillRect(ox - 16, oy - 16, 32, 32);
    g.restore();
    const r = rng(4747);
    g.fillStyle = '#FCA5A5';
    for (let i = 0; i < 7; i++) {
      const a = r() * Math.PI * 2, k = (t * 1.6 + r()) % 1, d = 22 * (1 - k);
      g.fillRect(ox + Math.cos(a) * d, oy + Math.sin(a) * d, 1, 1);
    }
  }
  if (t >= T.acerta && t < T.cai) A.fumaca(g, n.x, n.y - 4, (t - T.acerta) % 0.4, 0.4);  // fumegando enquanto cai
}

function desenharEscolta(g, t, J, X, Y) {
  const img = A.droide();
  for (const s of J.escolta) {
    const n = escoltaEm(J, s, t);
    if (!n.ve) continue;
    g.save(); g.translate(X(n.x), Y(n.y));
    if ((J.lado < 0) !== n.foge) g.scale(-1, 1);  // olha pro Clawd; fugindo, vira as costas
    g.drawImage(img, -7.5, -6, 15, 12);
    g.restore();
  }
}

function desenharDroides(g, t, J, X, Y) {
  const img = A.droide();
  for (const f of J.droides) {
    if (t < f.te) continue;
    if (t < f.th) {
      const [x, y] = posDroide(f, t);
      g.save(); g.translate(X(x), Y(y));
      if (J.lado < 0) g.scale(-1, 1);
      g.drawImage(img, -7.5, -6, 15, 12);
      g.restore();
    }
    const s = f.s;  // o tiro vermelho até o sabre, e rebatido de volta no droide
    if (t >= f.tf && t < f.tb) {
      const de = posDroide(f, f.tf), u = (t - f.tf) / VOO;
      A.tiro(g, de[0] + (s[0] - de[0]) * u, de[1] + (s[1] - de[1]) * u, Math.atan2(s[1] - de[1], s[0] - de[0]), LUZ.tiro);
    } else if (t >= f.tb && t < f.th) {
      const ate = posDroide(f, f.th), u = (t - f.tb) / VOLTA;
      A.tiro(g, s[0] + (ate[0] - s[0]) * u, s[1] + (ate[1] - s[1]) * u, Math.atan2(ate[1] - s[1], ate[0] - s[0]), LUZ.tiro);
    }
    A.faiscas(g, s[0], s[1], t - f.tb, J.sem + f.tb * 1000, 8, ['#F0FDF4', '#4ADE80', '#FDE68A']);
    if (t >= f.th) { const [x, y] = posDroide(f, f.th); explosao(g, x, y, t - f.th, J.sem + Math.round(f.th * 977)); }
  }
}

// a pedra: a Força em volta (verde), o fio da mão até ela, a terra caindo enquanto sobe
function desenharPedra(g, t, J, X, Y) {
  const p = pedraEm(J, t);
  if (!p) return;
  const forca = fatia(t, T.agarra, T.agarra + 0.3) * (1 - fatia(t, T.joga[0], T.joga[0] + 0.15));
  if (forca > 0) {
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(p.x, p.y, 4, p.x, p.y, 24);
    gr.addColorStop(0, rgba(LUZ.forca, 0.45 * forca)); gr.addColorStop(1, rgba(LUZ.forca, 0));
    g.fillStyle = gr; g.fillRect(p.x - 24, p.y - 24, 48, 48);
    // o fio da Força: uma onda que sai da mão e chega na pedra
    const cl = clawdEm(J, t), mx = J.X0 + cl.x + MAO[0], my = cl.y + MAO[1], dx = p.x - mx, dy = p.y - my, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
    for (let i = 0; i < 24; i++) {
      const k = (i / 24 + t * 0.9) % 1, meio = Math.sin(Math.PI * k), w = Math.sin(k * 14 - t * 18) * 3 * meio;
      g.fillStyle = rgba(i % 3 ? LUZ.forca : LUZ.palida, (0.35 + 0.55 * meio) * forca);
      g.fillRect(mx + dx * k + nx * w - 0.5, my + dy * k + ny * w - 0.5, 1.5, 1.5);
    }
    g.restore();
  }
  // a terra que solta dela enquanto sobe
  for (let j = 0; j < 12; j++) {
    const tj = T.arranca[0] + 0.15 + j * 0.08, d = t - tj;
    if (d < 0 || d > 0.7) continue;
    const q = pedraEm(J, tj);
    g.fillStyle = j % 2 ? '#5C3A1E' : '#7A5230';
    g.fillRect(q.x + ((j * 37) % 17) - 8, q.y + PH / 2 - 1 + 60 * d * d, 1.5, 1.5);
  }
  g.save(); g.translate(X(p.x), Y(p.y)); g.rotate(p.ang);
  g.drawImage(arte(PEDRA, COR_PEDRA), -PW / 2, -PH / 2, PW, PH);
  g.restore();
}

// o que vai na frente dos pinheiros: a poeira dos pousos, o buraco da pedra, os cacos da pedrada,
// a queda do gigante (poeira, fogo e folhas)
function desenharPoeira(g, t, J, X, Y) {
  for (const p of J.capsulas) {
    const d = t - p.pousa;
    if (d >= 0 && d < 0.1) { g.fillStyle = rgba('#FDBA74', 0.8 * (1 - d / 0.1)); g.fillRect(p.x1 - 4, J.base - 4, 8, 4); }
    poeira(g, p.x1, J.base - 1, d, 14, 1.4, p.sem);
  }
  const da = t - T.arranca[0];  // a pedra arrancando: terra pra cima e poeira
  if (da >= 0 && da < 0.9) {
    for (const q of J.terra) { const v = q.v * da; g.fillStyle = q.cor; g.fillRect(J.pedra.x + Math.cos(q.a) * v, J.base + Math.sin(q.a) * v + 70 * da * da, 1.5, 1.5); }
  }
  poeira(g, J.pedra.x, J.base - 1, da, 16, 1.5, J.sem + 5);
  const dh = t - T.acerta;  // a pedrada: clarão, cacos e faíscas
  if (dh >= 0 && dh < 1.2) {
    const G = giganteEm(J, T.acerta);
    if (dh < 0.25) {
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(G.x, G.y, 0, G.x, G.y, 34);
      gr.addColorStop(0, rgba('#FFFBEB', 0.9 * (1 - dh / 0.25))); gr.addColorStop(1, rgba('#FDE68A', 0));
      g.fillStyle = gr; g.fillRect(G.x - 34, G.y - 34, 68, 68); g.restore();
    }
    for (const q of J.cacos) {
      const k = q.v * (1 - Math.exp(-2.5 * dh)) / 2.5;
      g.fillStyle = q.cor; g.fillRect(G.x + Math.cos(q.a) * k, G.y + Math.sin(q.a) * k * 0.8 + 45 * dh * dh, q.s, q.s);
    }
    A.faiscas(g, G.x, G.y, dh, J.sem + 77, 12, ['#FDE68A', '#F97316', '#FFFFFF']);
  }
  const dc = t - T.cai;  // a queda na floresta
  if (dc >= 0) {
    const cx = J.gigante.x + J.gigante.dir * 14, cy = J.base - 3;
    explosao(g, cx - 12, cy - 6, dc, J.sem + 97);  // três estouros em sequência, ao longo do corpo
    explosao(g, cx + 10, cy - 9, dc - 0.12, J.sem + 98);
    explosao(g, cx, cy - 3, dc - 0.25, J.sem + 99);
    poeira(g, cx - 12, cy, dc, 40, 2.2, J.sem + 1, 2.2, 12);
    poeira(g, cx + 12, cy, dc - 0.15, 36, 2.0, J.sem + 2, 2, 12);
    if (dc < 2.6) {
      for (const f of J.folhas) {
        const k = f.v * (1 - Math.exp(-3 * dc)) / 3, x = cx + Math.cos(f.a) * k + Math.sin(dc * 4 + f.fase) * 3, y = cy + Math.sin(f.a) * k + 9 * dc * dc;
        g.fillStyle = rgba(f.cor, 1 - fatia(dc, 1.8, 2.6)); g.fillRect(x, y, Math.sin(dc * 6 + f.fase) > 0 ? 2.5 : 1.2, 1.5);
      }
    }
  }
}

function desenhar(g, t, m, J) {
  const e = m.host.escala || 1, c = m.host.cartao;
  if (!c) return;
  const OX = c[0], OY = c[1];
  const ab = t < T.fecha[0] ? sai(fatia(t, T.abre[0], T.abre[1])) : 1 - entra(fatia(t, T.fecha[0], T.fecha[1]));
  if (ab <= 0) return;
  const topo = Math.round(-J.HJ * ab * e) / e;
  // o tremor (as cápsulas e o gigante caindo): tudo, menos o céu e o fundo
  let tr = 0;
  for (const p of J.capsulas) { const d = t - p.pousa; if (d >= 0 && d < 0.2) tr = Math.max(tr, 0.8 * (1 - d / 0.2)); }
  if (t >= T.cai && t < T.cai + 0.5) tr = Math.max(tr, 2.5 * (1 - (t - T.cai) / 0.5));
  const sx = Math.round(Math.sin(t * 93) * tr), sy = Math.round(Math.cos(t * 71) * 0.8 * tr);
  const X = v => Math.round((OX + v + sx) * e) / e - OX, Y = v => Math.round((OY + v + sy) * e) / e - OY;
  // o sol clareia o céu e a floresta: o nublado some por baixo do de sol
  const sol = suave(fatia(t, T.sol[0], T.sol[1])), climas = sol <= 0 ? [['nublado', 1]] : sol >= 1 ? [['sol', 1]] : [['nublado', 1], ['sol', sol]];
  g.save();
  // o céu, o morro e as copas de trás: o pedaço que já abriu, no pixel da tela
  const hp = Math.round(-topo * e);
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (hp > 0) {
    for (const [clima, a] of climas) {
      const img = fundo(J, e, clima);
      g.globalAlpha = a;
      g.drawImage(img, 0, img.height - hp, img.width, hp, Math.round(OX * e), Math.round(OY * e) - hp, img.width, hp);
    }
    g.globalAlpha = 1;
  }
  g.setTransform(e, 0, 0, e, OX * e, OY * e);
  g.beginPath(); g.rect(0, topo, J.cw, -topo); g.clip();
  desenharSol(g, t, J, e, OX, OY);
  desenharNuvens(g, t, J, e, OX, OY);
  desenharPassaros(g, t, J);
  desenharCapsulas(g, t, J, X, Y);
  desenharGigante(g, t, J, X, Y);
  desenharEscolta(g, t, J, X, Y);
  desenharDroides(g, t, J, X, Y);
  desenharPedra(g, t, J, X, Y);
  // os pinheiros da frente (tremem junto)
  g.setTransform(1, 0, 0, 1, 0, 0);
  for (const [clima, a] of climas) {
    const f = frente(J, e, clima);
    g.globalAlpha = a;
    g.drawImage(f.img, Math.round((OX + sx) * e), Math.round(OY * e) - Math.round(J.HJ * e) + f.oy + Math.round(sy * e));
  }
  g.globalAlpha = 1;
  g.setTransform(e, 0, 0, e, OX * e, OY * e);
  desenharPoeira(g, t, J, X, Y);
  g.restore();
  // a moldura do palco: marrom, com a borda de cima verde (acesa enquanto abre e fecha)
  g.save(); g.setTransform(e, 0, 0, e, OX * e, OY * e);
  g.fillStyle = '#5C3A1E';
  g.fillRect(0, topo, 1, -topo); g.fillRect(J.cw - 1, topo, 1, -topo);
  g.fillStyle = t < T.abre[1] || t >= T.fecha[0] ? LUZ.clara : LUZ.escura; g.fillRect(0, topo, J.cw, 1);
  g.restore();
}

// o Clawd: na navinha, sabre pronto, as defesas (como no 'deflete'), a mão erguida na Força,
// o empurrão da pedra, a saudação no fim (um giro e a lâmina de pé na frente do rosto)
function angSaudacao(t) {
  const [a, b] = T.saudacao;
  if (t < a + 0.55) return 25 + 360 * suave(fatia(t, a, a + 0.55));
  if (t < b - 0.3) return 25 * (1 - sai(fatia(t, a + 0.55, a + 0.8)));
  return 25 * sai(fatia(t, b - 0.3, b));
}
function desenharClawd(g, t, J, T0, m) {
  let ang = 25, len = 1, x = 0, y = 0, bracos = null, aura = 0, vento = 0.4, extra = null;
  for (const f of J.droides) {
    const d = t - f.tb;
    if (d > -0.18 && d < 0.12) ang = d < 0 ? 25 - 55 * sai((d + 0.18) / 0.18) : -30 + 55 * (d / 0.12);
    if (d >= 0 && d < 0.15) x = -1.5 * Math.sin(Math.PI * d / 0.15);
  }
  if (t >= T.apaga[0] && t < T.reacende[1]) {  // apaga girando pra baixo, acende voltando
    len = t < T.reacende[0] ? 1 - fatia(t, T.apaga[0], T.apaga[1]) : fatia(t, T.reacende[0], T.reacende[1]);
    ang = t < T.reacende[0] ? 25 + 135 * suave(fatia(t, T.apaga[0], T.apaga[1])) : 160 - 135 * suave(fatia(t, T.reacende[0], T.reacende[1]));
    if (t >= T.agarra - 0.05 && t < T.solta[1]) bracos = [0, -3];
    aura = 0.8 * fatia(t, T.agarra, T.agarra + 0.3) * (1 - fatia(t, T.solta[0], T.solta[1]));
    if (t >= T.joga[0] && t < T.joga[0] + 0.25) x += J.lado * 1.5 * Math.sin(Math.PI * (t - T.joga[0]) / 0.25);  // o empurrão
  }
  if (t >= T.saudacao[0] && t < T.saudacao[1]) {
    ang = angSaudacao(t);
    if (t < T.saudacao[0] + 0.55) {
      vento = 0.5;
      extra = function (k, dy) {  // o rastro: a lâmina de uns centésimos atrás, sumindo
        k.save(); k.globalCompositeOperation = 'lighter';
        for (let i = 1; i <= 5; i++) {
          k.save(); k.translate(12, -7.5 + dy); k.rotate(angSaudacao(t - i * 0.022) * Math.PI / 180);
          k.fillStyle = rgba(LUZ.lamina, 0.3 * (1 - i / 6)); k.fillRect(-1.2, -1.8 - A.LAMINA, 2.4, A.LAMINA);
          k.restore();
        }
        k.restore();
      };
    }
  }
  const cl = clawdEm(J, t);
  x += cl.x; y += cl.y;
  if (cl.k > 0) vento = Math.max(vento, 0.4 + 0.3 * cl.k);
  g.save();
  g.setTransform(T0.a, T0.b, T0.c, T0.d, T0.e, T0.f);
  A.clawdSith(g, { T: m.T, x, y, bracos, aura, vento, sabre: { ang, len }, extra });
  if (cl.nave.ve) {  // a navinha por cima dos pés, só dentro do palco
    const ab = t < T.fecha[0] ? sai(fatia(t, T.abre[0], T.abre[1])) : 1 - entra(fatia(t, T.fecha[0], T.fecha[1]));
    g.beginPath(); g.rect(-J.X0, -J.HJ * ab, J.cw, J.HJ * ab + 3); g.clip();
    A.navinha(g, cl.nave, t);
  }
  g.restore();
}

// a trilha (som.js): tudo sai do plano, então cada tiro, rebatida e queda soa na hora certa
const SS = n => `sons-sith/${n}.wav`, VOLUME = 0.68;  // VOLUME: a trilha mixada no volume dos outros épicos (~-22 LUFS)
function sons(J) {
  const L = [[0, SS('hiper-abre'), 0.45], [0.15, SS('floresta'), 0.8], [VOA.chega[0], SS('nave'), 0.35, 1.7]];
  for (const p of J.capsulas) L.push([p.t0, SS('capsula'), 0.55]);  // o baque cai no pouso (0,85 s)
  for (const f of J.droides) L.push([f.tf, SS('blaster'), 0.35], [f.tb, SS('rebate'), 0.7], [f.th, SS('explode'), 0.5]);
  L.push([T.gigante[0], SS('nave'), 0.6, 0.75, 1.6], [T.mira[0], SS('carga'), 0.3]);
  L.push([T.agarra, SS('forca-luz'), 0.85], [T.arranca[0], SS('pedra'), 0.8], [T.joga[0], SS('arremesso'), 0.8], [T.acerta, SS('tomba'), 1]);  // o estrondo do tomba cai na queda
  L.push([T.reacende[0], SS('terminou'), 1]);  // o sabre acendendo (o aviso, que já é baixinho)
  L.push([T.sol[0], SS('sol'), 0.9], [T.passaros[0] + 0.3, SS('passaros'), 0.5]);
  L.push([VOA.vai[0], SS('nave'), 0.3, 1.9], [T.fecha[0], SS('hiper-abre'), 0.35, 0.75]);
  return L.map(([t, a, g, ...r]) => [t, a, g * VOLUME, ...r]);
}

function cena(m) {
  const semente = Math.floor(m.sorteio() * 4294967296);
  const J = montar(m, rng(semente));
  return {
    nome: 'epico-luz', lado: 'luz', dur: T.dur, espaco: { frente: 0, tras: 0 }, modos: ['andando'],
    plano: J,  // pros testes
    sons: sons(J),
    quadro(g, t, mundo) {
      const T0 = g.getTransform(), mm = mundo || m;
      desenhar(g, t, mm, J);
      desenharClawd(g, t, J, T0, mm);  // a capa no relógio do motor (mm.T), como nas outras cenas
    },
  };
}

module.exports = { linhaDoTempo, cena, T, VOA, CONVES, SABRE, MAO, GW, GH, PW, PH, QUEDA, posDroide, posCapsula, clawdEm, giganteEm, escoltaEm, pedraEm };  // do T em diante: pros testes
