'use strict';
// Tema Akatsuki: os desenhos. Tudo desenhado aqui, nada copiado do anime: o Clawd veste um chapéu
// de palha com fitas brancas e um manto preto de nuvens vermelhas (sem bandana, símbolo de vila
// nem personagem). Os corvos, o tronco, a kunai, a fumaça, a bola de fogo e o bug são genéricos.
// No referencial do Clawd: origem entre os pés, x+ pra frente, y- pra fora do cartão.
const { DEG, lim, sai, entra, cache, arte, tingida, rng, rgba } = require('./comum');
const { desenhaClawd, spriteClawd, andando: andandoBase, pulando: pulandoBase } = require('./clawd');

const fatia = (t, a, b) => lim((t - a) / (b - a), 0, 1);
const P = 1.5;  // o pixel do Clawd

const COR = {
  manto: '#141414', nuvem: '#DC2626', borda: '#F3F4F6', palha: '#D6B26E', palhaEsc: '#9C7A3C', fita: '#F3F4F6',
  olho: '#DC2626', corpo: '#D77757', contorno: '#5B1414', fumaca: '#F3F4F6', fumacaEsc: '#9CA3AF', corvo: '#0A0A0A',
};

// ---------- o Clawd: a roupa da vez (akatsuki-roupas.js, 3 de cada lado) ----------
// O tema veste (vestir) antes de desenhar cada quadro; daqui pra frente tudo sai com a roupa e o
// contorno dela. ROUPA = a de antes (o chapéu de palha), a primeira do lado Akatsuki.
const ROUPAS = require('./akatsuki-roupas');
const ROUPA = 'akatsuki';
COR.roupa = ROUPA; COR.lado = 'akatsuki';
const ladoDaRoupa = roupa => (ROUPAS.LADOS.time7.includes(roupa) ? 'time7' : 'akatsuki');
function vestir(roupa) {
  if (!ROUPAS.ROUPAS[roupa] || COR.roupa === roupa) return;
  COR.roupa = roupa; COR.contorno = ROUPAS.CONTORNO[roupa]; COR.lado = ladoDaRoupa(roupa);
}
const ALTURA = ROUPAS.ROUPAS[ROUPA].linhas.length;

// contorno de 1 px (vinho): o manto preto anda por cima de qualquer fundo
function contorno(g, pernas, dy, L, olhos, cor = COR.contorno) {
  const spr = tingida(spriteClawd(COR.roupa, pernas, olhos, false, null), cor, 'aka-cont' + COR.roupa + pernas + olhos);
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.drawImage(spr, -13.5 + ox, -L * P + dy + oy, 27, L * P);
}

// os selos de mão: as duas mãos juntas na frente do peito, trocando de forma (k = qual selo)
const SELOS = [[[-2, -6.5], [0, -6.5]], [[-1.5, -8], [-1.5, -6.5]], [[-2.5, -7.25], [0.5, -7.25]], [[-1.5, -8.5], [0, -7]]];
function maos(g, k, dy) {
  for (const [x, y] of SELOS[((k % SELOS.length) + SELOS.length) % SELOS.length]) {
    g.fillStyle = COR.contorno; g.fillRect(x - 0.5, y + dy - 0.5, 2.5, 2.5);
    g.fillStyle = COR.corpo; g.fillRect(x, y + dy, 1.5, 1.5);
  }
}

// uma mão só, em (x, y) (jogando a kunai, levando à boca)
function maoNa(g, x, y) {
  g.fillStyle = COR.contorno; g.fillRect(x - 0.5, y - 0.5, 2.5, 2.5);
  g.fillStyle = COR.corpo; g.fillRect(x, y, 1.5, 1.5);
}

// p: o do desenhaClawd + { selo (número: as mãos fazendo selo), contorno (false: sem) }
function clawdAkatsuki(g, p = {}) {
  const pernas = p.sentado ? 'nenhuma' : (p.pernas || 'ambas'), olhos = p.olhos || 'abertos';
  desenhaClawd(g, {
    ...p, roupa: COR.roupa, ferr: null,
    atras(k, dy, L) { if (p.contorno !== false && !p.branco) contorno(k, pernas, dy, L, olhos); if (p.atras) p.atras(k, dy, L); },
    mao(k, dy) {
      if (p.selo != null && !p.branco) maos(k, Math.floor(p.selo), dy);
      if (p.mao) p.mao(k, dy);
    },
  });
}
const andando = (t, extra = {}) => ({ ...andandoBase(t), T: t, ...extra });
const pulando = (t, extra = {}) => ({ ...pulandoBase(t), T: t, ...extra });
// o selo que as mãos fazem no instante t (troca a cada 0,12 s)
const seloEm = t => Math.floor(t / 0.12);

// ---------- fumaça (o "puf"): bolotas brancas de contorno cinza que crescem e somem ----------
// u 0..1 (o tempo dela), tam: o tamanho (1 = do Clawd)
function puf(g, x, y, u, sem, tam = 1, n = 7) {
  if (u <= 0 || u >= 1) return;
  const r = rng(sem >>> 0);
  g.save(); g.globalAlpha *= 1 - entra(u);
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, d = sai(u) * (5 + r() * 7) * tam, raio = (3 + r() * 3) * tam * (0.55 + 0.6 * sai(u));
    const cx = x + Math.cos(a) * d, cy = y + Math.sin(a) * d * 0.7 - 3 * u * tam;
    g.fillStyle = COR.fumacaEsc; g.beginPath(); g.arc(cx, cy, raio + 0.8, 0, Math.PI * 2); g.fill();
    g.fillStyle = i % 2 ? '#E5E7EB' : COR.fumaca; g.beginPath(); g.arc(cx, cy, raio, 0, Math.PI * 2); g.fill();
  }
  g.restore();
}

// ---------- corvo (de frente, asa pra cima ou aberta), 1 px = P ----------
const CORVO = [['x.....x', '.x...x.', '..xex..', '...x...'], ['.......', 'xxx.xxx', '..xex..', '...x...']];
// o contorno cinza-azulado separa o preto de um papel de parede escuro
function corvo(g, x, y, asa, p = P, alfa = 1) {
  const img = arte(CORVO[asa ? 0 : 1], { x: COR.corvo, e: '#DC2626' }), borda = tingida(img, '#64748B', 'akacorvo' + (asa ? 1 : 0));
  g.save(); g.globalAlpha *= alfa;
  const x0 = x - 3.5 * p, y0 = y - 2 * p;
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.drawImage(borda, x0 + ox, y0 + oy, 7 * p, 4 * p);
  g.drawImage(img, x0, y0, 7 * p, 4 * p);
  g.restore();
}
// uma pena caindo (balança de lado)
function pena(g, x, y, t, fase) {
  const b = Math.sin(t * 5 + fase) * 2, px = x + b, lado = b > 0 ? -1 : 1;
  g.fillStyle = '#64748B'; g.fillRect(px - 0.5, y - 0.5, 2, 3.5); g.fillRect(px + lado - 0.5, y, 2, 2);
  g.fillStyle = COR.corvo; g.fillRect(px, y, 1, 2.5); g.fillRect(px + lado, y + 0.5, 1, 1);
}

// ---------- o tronco da substituição (de pé, a ponta serrada em cima) ----------
const TRONCO = [
  '...eeee....',
  '.eeEEEEee..',
  '.eEEooEEe..',
  '.beeeeeeb..',
  '.bbBbbbBb..',
  '.bbBbbbbbbb',
  '.bBbbbBbbB.',
  '.bBbbbBbb..',
  '.bbbbBbbb..',
  '.bbBbbBbb..',
  '.bbBbbbbb..',
  'bbbbbbbbbb.',
];
const COR_TRONCO = { e: '#C08A4E', E: '#A06A35', o: '#7C4A21', b: '#7C4A21', B: '#5B3416' };
const tronco = () => arte(TRONCO, COR_TRONCO);

// ---------- kunai (deitada, a ponta pra frente), 1 px = 1 DIP ----------
const KUNAI = ['oo....ss...', 'o.ohhhsssS.', 'oo....ss...'];
const COR_KUNAI = { o: '#9CA3AF', h: '#991B1B', s: '#D1D5DB', S: '#F9FAFB' };
function kunai(g, x, y, ang = 0, e = 1) {
  const img = arte(KUNAI, COR_KUNAI);
  g.save(); g.translate(x, y); g.rotate(ang); g.drawImage(img, -10 * e, -1.5 * e, 11 * e, 3 * e); g.restore();
}

// ---------- o bug (o do tema Padrão: o mesmo bichinho verde), 1,6 px por pixel ----------
const BUG = ['a............', '.a...vvvvv...', '..a.vwwvvvvv.', '.aaavwvvxvvvv', 'aoaavvvvvxvvv', '.aaaavvvvvxv.', '..pq..pq..pq.', '.p..qp..qp..q'];
const COR_BUG = { v: '#65A30D', w: '#A3E635', x: '#365314', a: '#111827', o: '#F8FAFC', p: '#111827', q: '#111827' };
const BUG_P = 1.6, BUG_W = 13 * BUG_P, BUG_H = 8 * BUG_P;
// passo: 'p' | 'q' (as pernas); cor: pinta por cima (vermelho do golpe, preto do fogo)
function bug(g, x, y, { passo = 'p', cor = null, a = 0, sx = 1, sy = 1, alfa = 1 } = {}) {
  let img = arte(BUG.map(l => l.replace(passo === 'p' ? /q/g : /p/g, '.')), COR_BUG);
  if (cor) img = tingida(img, cor, 'akabug' + passo);
  g.save(); g.globalAlpha *= alfa; g.translate(x, y); g.scale(sx, sy);
  g.drawImage(img, -BUG_W / 2, -BUG_H, BUG_W, BUG_H);
  if (a > 0 && !cor) { g.globalAlpha *= a; g.drawImage(tingida(img, '#EF4444', 'akabugv' + passo), -BUG_W / 2, -BUG_H, BUG_W, BUG_H); }
  g.restore();
}
// cinzas: o bug queimado vira pó que cai e some (d = s desde que começou; w, h: o tamanho de quem queimou)
function cinzas(g, x, y, d, sem, n = 14, w = BUG_W, h = BUG_H) {
  if (d < 0 || d > 0.9) return;
  const r = rng(sem >>> 0);
  g.save(); g.globalAlpha *= 1 - fatia(d, 0.4, 0.9);
  for (let i = 0; i < n; i++) {
    const px = x + (r() - 0.5) * w, py = y - r() * h, vx = (r() - 0.5) * 10;
    g.fillStyle = i % 3 ? '#1F2937' : '#6B7280';
    g.fillRect(px + vx * d, Math.min(y - 0.5, py + 30 * d * d), 1, 1);
  }
  g.restore();
}

// ---------- fogo ----------
// a bola de fogo: miolo branco-amarelo, laranja, vermelho por fora e chamas pra trás (dir = -1: vai pra trás)
function bolaDeFogo(g, x, y, r, t, dir = 1) {
  g.save(); g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y, 0, x, y, r * 2.2);
  gr.addColorStop(0, rgba('#F97316', 0.55)); gr.addColorStop(1, rgba('#DC2626', 0));
  g.fillStyle = gr; g.fillRect(x - r * 2.2, y - r * 2.2, r * 4.4, r * 4.4);
  g.restore();
  const rr = rng(Math.floor(t * 24) * 7919 + 13);
  for (let i = 0; i < 5; i++) {  // as línguas de fogo pra trás
    const l = r * (0.8 + rr()), yy = y + (rr() - 0.5) * r * 1.2;
    g.fillStyle = i % 2 ? '#F97316' : '#DC2626';
    g.fillRect(dir > 0 ? x - r - l : x + r, yy - 0.75, l, 1.5);
  }
  for (const [f, cor] of [[1, '#DC2626'], [0.75, '#F97316'], [0.5, '#FDE047'], [0.25, '#FFF7ED']]) {
    g.fillStyle = cor; g.beginPath(); g.arc(x, y, r * f, 0, Math.PI * 2); g.fill();
  }
}
// labaredas subindo de (x, y) (o bug pegando fogo), d = s desde a batida
function labaredas(g, x, y, d, sem, w = BUG_W) {
  if (d < 0 || d > 0.8) return;
  const r = rng(sem >>> 0), forca = 1 - fatia(d, 0.35, 0.8);
  // cada chama: base larga amarela, meio laranja, ponta fina vermelha, tremendo
  for (let i = 0; i < 7; i++) {
    const px = x + (r() - 0.5) * w * 0.9, fase = r() * 6, alt = (5 + r() * 7) * forca * (0.75 + 0.25 * Math.sin(d * 30 + fase));
    if (alt < 1) continue;
    const ond = Math.sin(d * 24 + fase) * 0.6;
    g.fillStyle = '#DC2626'; g.fillRect(px - 0.5 + ond * 1.6, y - alt, 1, alt * 0.45);
    g.fillStyle = '#F97316'; g.fillRect(px - 1 + ond, y - alt * 0.7, 2, alt * 0.5);
    g.fillStyle = '#FDE047'; g.fillRect(px - 1.5, y - alt * 0.35, 3, alt * 0.35);
  }
}

// os riscos de velocidade atrás de quem corre (x = onde ele está)
function rastro(g, x, t, cor = '#D1D5DB') {
  g.fillStyle = rgba(cor, 0.55);
  for (const [dy, l] of [[-5, 6], [-10, 9], [-15, 5]]) g.fillRect(x - 15 - l - ((t * 90) % 4), dy, l, 1);
}

// onde ficam os olhos vermelhos ('r') de uma roupa, no referencial do Clawd (1,5 DIP por pixel,
// a arte começa em x = -13,5 e os pés em 0): um ponto por coluna (a máscara em espiral tem um só)
function olhosDe(roupa) {
  const L = ROUPAS.ROUPAS[roupa].linhas, cols = new Map();
  L.forEach((l, i) => [...l].forEach((c, j) => { if (c === 'r') (cols.get(j) || cols.set(j, []).get(j)).push(i); }));
  return [...cols].map(([j, is]) => [-13.5 + (j + 0.5) * 1.5, -L.length * 1.5 + (is.reduce((a, b) => a + b, 0) / is.length + 0.5) * 1.5]);
}
// os olhos acendendo vermelhos (a: 0..1), no referencial do Clawd; dy = o pulo dele
function olhosAcesos(g, roupa, a, dy = 0) {
  if (!(a > 0.005)) return;  // (o seno no fim da janela dá 1e-16, não 0)
  g.save(); g.globalCompositeOperation = 'lighter';
  for (const [ox, oy] of olhosDe(roupa)) {
    const gr = g.createRadialGradient(ox, oy + dy, 0, ox, oy + dy, 5);
    gr.addColorStop(0, rgba('#EF4444', 0.9 * a)); gr.addColorStop(1, rgba('#EF4444', 0));
    g.fillStyle = gr; g.fillRect(ox - 5, oy + dy - 5, 10, 10);
  }
  g.restore();
}

// o braço erguido com o punho fechado, do lado da frente, do ombro até acima da cabeça (alto = as
// meias-fileiras da roupa); dentro do mao(k, dy) do desenhaClawd
function punhoErguido(g, dy, alto) {
  const x = 12, y0 = -9 + dy, y1 = -alto * 1.5 - 1.5 + dy;
  g.fillStyle = COR.contorno; g.fillRect(x - 0.5, y1 - 0.5, 2.5, y0 - y1 + 1); g.fillRect(x - 1.25, y1 - 3.25, 4, 3.5);
  g.fillStyle = COR.corpo; g.fillRect(x, y1, 1.5, y0 - y1); g.fillRect(x - 0.75, y1 - 2.75, 3, 3);
}

// as cenas de parado: nada passa pra dentro do cartão (no referencial do Clawd)
function acimaDoCartao(g, desenha) {
  g.save(); g.beginPath(); g.rect(-80, -110, 160, 116); g.clip();
  try { desenha(); } finally { g.restore(); }
}

module.exports = {
  COR, ROUPA, ROUPAS, vestir, ladoDaRoupa, ALTURA, P, fatia, sai, entra, DEG, clawdAkatsuki, andando, pulando, seloEm, maos, maoNa, contorno, puf,
  corvo, pena, tronco, TRONCO, kunai, bug, BUG_W, BUG_H, cinzas, bolaDeFogo, labaredas, rastro, olhosDe, olhosAcesos, punhoErguido, acimaDoCartao,
};
