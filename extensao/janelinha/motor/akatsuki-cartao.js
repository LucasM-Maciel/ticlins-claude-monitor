'use strict';
// Tema Akatsuki: o que enfeita o cartão. Tudo chapado, só branco, preto e vermelho (dono, 16/10:
// "menos neon", sem brilho, halo nem degradê). Moldura = um fio vermelho de 1 px na borda e, montadas
// nele, nuvens pretas do manto (contorno branco, sombrinha vermelha de 1 px), sempre em pé, que dão a
// volta no cartão enquanto alguém trabalha. Elas andam EM CIMA da borda (como a nuvem do Dragon Ball):
// metade fica pra fora, então não encostam no texto. Bolinha = nuvenzinha da cor da situação. Barra do
// usage = um fio branco até o quanto foi gasto (vermelho a partir de 80%) com o Sharingan na ponta, as
// 3 vírgulas girando; a partir de 95% vira o Mangekyō. No lado Time 7 (o tema troca de lado a cada 50
// voltas): a bandana da Folha, ou seja, uma faixa azul parada com a placa de aço da Folha no meio do alto,
// barra laranja e a shuriken na ponta (dono, 17/10: escolheu a bandana e pediu a borda azul). Números = a
// fonte de visor do tema Dragon Ball.
// Coordenadas: as da janela, em DIPs. Moldura e ponta da barra são desenhadas em pixel da TELA
// (prontas 1x por escala e guardadas): em escala quebrada (1,25) a nuvem andando não "tremula".
const { lim, arte, tela, cache } = require('./comum');
const { escrever } = require('./dragonball-cartao');
const { COR } = require('./akatsuki-arte');

const corHex = (c, reserva) => (/^#[0-9a-f]{6}$/i.test(c) ? c : reserva);
const pulso = t => 0.65 + 0.35 * Math.cos(2 * Math.PI * t / 1.6);  // o do "trabalhando" da janelinha
const nivelDe = u => (u.nivel != null ? lim(u.nivel | 0, 0, 2) : u.pct >= 95 ? 2 : u.pct >= 80 ? 1 : 0);
// as cores de cada lado: trilho, cheio (normal), kurama (>= 80%), forte (>= 95%), pct (o % do usage:
// normal, >= 80%, >= 95%)
const PAL_T7 = { trilho: '#1E293B', cheio: '#F97316', kurama: '#DC2626', forte: '#DC2626', pct: ['#FDBA74', '#F97316', '#EF4444'] };
const PAL = {
  akatsuki: { trilho: '#262626', cheio: '#F3F4F6', kurama: '#DC2626', forte: '#DC2626', pct: ['#F3F4F6', '#DC2626', '#DC2626'] },
  time7: PAL_T7,
};
const pal = () => PAL[COR.lado] || PAL.akatsuki;
const CORES_PCT = PAL.akatsuki.pct;
const corDoPct = nivel => pal().pct[nivel];
const BRANCO = '#F3F4F6', PRETO = '#0A0A0A', VERMELHO = '#DC2626', AZUL = '#2563EB', LARANJA = '#F97316';
const cor32 = hex => (0xFF000000 | parseInt(hex.slice(1, 7), 16)) >>> 0;

// a nuvem vermelha (contorno branco), 1 px = 1 DIP (a do manto do Clawd)
const NUVEM = [
  '.....wwww.......',
  '...wwrrrrw..www.',
  '..wrrrrrrrwwrrrw',
  '.wrrrwwrrrrrrrrw',
  'wrrrw..wrrrrrrw.',
  'wrrrrwwrrrrrrw..',
  '.wwrrrrrrrrww...',
  '...wwwwwwww.....',
];
const nuvem = () => arte(NUVEM, { w: COR.borda, r: COR.nuvem });
// a nuvenzinha da bolinha (9x7): o miolo da cor da situação, contorno branco
const NUVENZINHA = ['..www....', '.wcccw.w.', 'wcccccwcw', 'wcccccccw', 'wccccccw.', '.wwccccw.', '...wwww..'];
// a folha do Time 7 (a ponta pra cima e à direita, o cabinho embaixo à esquerda), 1 px = 1 DIP
const FOLHA = [
  '.........dd.',
  '......ddlld.',
  '....ddlllLd.',
  '..ddllllLld.',
  '.dlllllLlld.',
  '.dllllLlld..',
  'dlllLllldd..',
  'dllLlllld...',
  '.dLddddd....',
  'sd..........',
];
const folha = () => arte(FOLHA, { d: '#14532D', l: '#22C55E', L: '#86EFAC', s: '#14532D' });
// a folhinha da bolinha (9x8): o miolo da cor da situação, contorno branco
const FOLHINHA = ['......ww.', '....wwccw', '..wwcccw.', '.wccccw..', 'wccccw...', 'wcccw....', 'wwww.....', 'w........'];

// ---------- pixel da tela ----------
// a escala e o deslocamento do quadro (o motor só põe escala; sem giro)
function escalaDe(g) { const m = g.getTransform(); return { e: m.a || 1, ox: m.e, oy: m.f }; }
// o pixel (px, py) do cartão de W x H px (cantos de raio rr px) está dentro dele, k px pra dentro da borda?
function dentro(px, py, W, H, rr, k) {
  const cx = px + 0.5, cy = py + 0.5;
  if (cx < k || cy < k || cx > W - k || cy > H - k) return false;
  const r = Math.max(rr - k, 0);
  const qx = Math.max(Math.abs(cx - W / 2) - (W / 2 - k - r), 0), qy = Math.max(Math.abs(cy - H / 2) - (H / 2 - k - r), 0);
  return qx * qx + qy * qy <= r * r + 1e-9;
}

// ---------- moldura ----------
// Os fios, em pixel da tela: cada faixa [de, até, cor] em px pra dentro da borda. Pronta 1x por tamanho
// e guardada; no quadro só as 4 tiras da borda são copiadas.
const ANEIS = cache(8);
function anel(W, H, rr, faixas) {
  const chave = W + 'x' + H + '|' + rr + '|' + faixas.join(';');
  const pronto = ANEIS.get(chave);
  if (pronto) return pronto;
  const c = tela(W, H), px = c.pixels, K = Math.min(Math.ceil(Math.max(rr, faixas[faixas.length - 1][1])) + 1, Math.ceil(W / 2), Math.ceil(H / 2));
  const cores = faixas.map(f => cor32(f[2]));
  const pinta = (x, y) => {
    for (let i = 0; i < faixas.length; i++) {
      if (dentro(x, y, W, H, rr, faixas[i][0]) && !dentro(x, y, W, H, rr, faixas[i][1])) { px[y * W + x] = cores[i]; return; }
    }
  };
  for (let y = 0; y < H; y++) {
    if (y < K || y >= H - K) for (let x = 0; x < W; x++) pinta(x, y);
    else { for (let x = 0; x < K; x++) pinta(x, y); for (let x = W - K; x < W; x++) pinta(x, y); }
  }
  c.borda = K;
  return ANEIS.set(chave, c);
}
function colarAnel(g, img, X, Y) {
  const W = img.width, H = img.height, K = img.borda;
  g.drawImage(img, 0, 0, W, K, X, Y, W, K);
  g.drawImage(img, 0, H - K, W, K, X, Y + H - K, W, K);
  if (H > 2 * K) {
    g.drawImage(img, 0, K, K, H - 2 * K, X, Y + K, K, H - 2 * K);
    g.drawImage(img, W - K, K, K, H - 2 * K, X + W - K, Y + K, K, H - 2 * K);
  }
}

// a nuvem do manto (20x8): preta, contorno branco, 3 lombadas e o caracol no lóbulo da esquerda; a
// sombrinha vermelha de 1 px (embaixo à direita) entra em comSombra
const NUVEM_MANTO = [
  '.....www.....www....',
  '...wwkkkw.wwwkkkw...',
  '..wkkkkkkwkkkwkkkw..',
  '.wkkkwwkkkkkkkkkkkw.',
  'wkkkwkkwkkkkkkkkkkkw',
  'wkkkkkwkkkkkkkkkkkw.',
  '.wwkkkkkkkkkkkkkww..',
  '...wwwwwwwwwwwww....',
];
const NW = NUVEM_MANTO[0].length, NH = NUVEM_MANTO.length;
function comSombra(L) {
  const o = Array.from({ length: L.length + 1 }, () => Array(L[0].length + 1).fill('.'));
  L.forEach((l, y) => [...l].forEach((ch, x) => { if (ch !== '.') o[y + 1][x + 1] = 'r'; }));
  L.forEach((l, y) => [...l].forEach((ch, x) => { if (ch !== '.') o[y][x] = ch; }));
  return o.map(l => l.join(''));
}
const ARTE_NUVEM = comSombra(NUVEM_MANTO);
const NUVENS = cache(8);
function nuvemNaTela(e) {  // a nuvem na escala da tela, ampliada pixel a pixel
  const pronta = NUVENS.get(e);
  if (pronta) return pronta;
  const base = arte(ARTE_NUVEM, { w: BRANCO, k: PRETO, r: VERMELHO });
  const c = tela(Math.round(base.width * e), Math.round(base.height * e));
  c.getContext('2d').drawImage(base, 0, 0, c.width, c.height);
  return NUVENS.set(e, c);
}

// As nuvens só andam quando a janelinha está mexendo (alguém trabalhando, cena): parado o motor
// desenha a 5 quadros/s e o que andasse daria saltos, os "tickzinhos de lag". Time 7: parada.
let fase = 0, ultimoT = null;
// o relógio do movimento: só avança quando "mexendo"; uma pausa longa entre dois quadros não vira salto
function andar(t, mexendo) {
  if (mexendo && ultimoT != null) fase += Math.min(Math.max(t - ultimoT, 0), 0.1);
  ultimoT = t;
  return fase;
}
// O trilho das nuvens (o centro delas): um retângulo de cantos redondos (raio CURVA) com o alto e o pé
// SOBE DIPs pra dentro da borda e os lados LADO DIPs pra fora; assim a nuvem fica montada no fio e no
// máximo 5 a 7 DIPs dela entram no cartão (o texto começa a 10-12). QTD_NUVENS: quantas dão a volta (8, dono,
// 17/10: "tem nuvens demais, ficou poluído"); VEL: DIPs/s, no sentido horário.
const RAIO = 8, SOBE = 1, LADO = 3, CURVA = 8, QTD_NUVENS = 8, VEL = 20;
function noTrilho(s, rx, ry, rw, rh) {  // o ponto a s DIPs do começo do alto do trilho
  const a = CURVA, Lh = rw - 2 * a, Lv = rh - 2 * a, arco = Math.PI * a / 2;
  const seg = [Lh, arco, Lv, arco, Lh, arco, Lv, arco];
  const per = 2 * (Lh + Lv) + 4 * arco;
  s = ((s % per) + per) % per;
  let i = 0;
  while (s > seg[i] && i < 7) s -= seg[i++];
  const q = s / a;  // nas curvas: o ângulo andado
  switch (i) {
    case 0: return [rx + a + s, ry];
    case 1: return [rx + rw - a + a * Math.sin(q), ry + a - a * Math.cos(q)];
    case 2: return [rx + rw, ry + a + s];
    case 3: return [rx + rw - a + a * Math.cos(q), ry + rh - a + a * Math.sin(q)];
    case 4: return [rx + rw - a - s, ry + rh];
    case 5: return [rx + a - a * Math.sin(q), ry + rh - a + a * Math.cos(q)];
    case 6: return [rx, ry + rh - a - s];
    default: return [rx + a - a * Math.cos(q), ry + a - a * Math.sin(q)];
  }
}
function moldura(g, [x, y, w, h], t) {
  const T = escalaDe(g), e = T.e;
  const X = Math.round(T.ox + x * e), Y = Math.round(T.oy + y * e);
  const W = Math.round(T.ox + (x + w) * e) - X, H = Math.round(T.oy + (y + h) * e) - Y, rr = RAIO * e, fio = Math.max(1, Math.round(e));
  if (W < 4 || H < 4) return;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  if (COR.lado === 'time7') { molduraT7(g, T, [x, y, w, h], [X, Y, W, H], rr, fio, t); g.restore(); return; }
  colarAnel(g, anel(W, H, rr, [[0, fio, VERMELHO]]), X, Y);
  const rx = x - LADO, ry = y + SOBE, rw = w + 2 * LADO, rh = h - 2 * SOBE;
  if (rw > 2 * CURVA && rh > 2 * CURVA) {
    const per = 2 * (rw + rh) - 8 * CURVA + 2 * Math.PI * CURVA;
    const n = QTD_NUVENS, esp = per / n, img = nuvemNaTela(e);
    for (let i = 0; i < n; i++) {
      const [cx, cy] = noTrilho(i * esp + t * VEL, rx, ry, rw, rh);
      g.drawImage(img, Math.round(T.ox + (cx - NW / 2) * e), Math.round(T.oy + (cy - NH / 2) * e));
    }
  }
  g.restore();
}

// ---------- Time 7: ajudantes ----------
// os azuis da bandana: o fio escuro de fora, claro, o azul (AZUL), sombra, sombra funda, a sombrinha
// no cartão e 2 luzes
const T7 = { o: '#0B1533', L: '#60A5FA', B: '#2563EB', D: '#1D4ED8', N: '#1E3A8A', S: '#070B16', l2: '#93C5FD', l3: '#DBEAFE' };
const T7_32 = Object.fromEntries(Object.entries(T7).map(([k, v]) => [k, cor32(v)]));
// sprite na escala da tela, ampliado pixel a pixel e guardado (linhas: a arte ou quem faz a arte)
const SPRITES = cache(96);
function naTela(nome, linhas, cores, e) {
  const chave = nome + '@' + e, pronto = SPRITES.get(chave);
  if (pronto) return pronto;
  const base = arte(typeof linhas === 'function' ? linhas() : linhas, cores);
  const c = tela(Math.round(base.width * e), Math.round(base.height * e));
  c.getContext('2d').drawImage(base, 0, 0, c.width, c.height);
  return SPRITES.set(chave, c);
}
const colar = (g, T, img, dx, dy) => g.drawImage(img, Math.round(T.ox + dx * T.e), Math.round(T.oy + dy * T.e));  // (dx, dy): canto, em DIPs
const espelho = L => L.map(l => [...l].reverse().join(''));
// o símbolo da Folha (13x11): a espiral, a ponta pra cima e à direita, o cabinho embaixo à esquerda
const SIMBOLO_FOLHA_13 = [
  '...........k.',
  '......kkkkkk.',
  '....kk....k..',
  '...k..kkk..k.',
  '..k..k...k.k.',
  '..k.k..k.k.k.',
  '..k.k...kk.k.',
  '..k..k.....k.',
  '...k..kkkkk..',
  '.k..kk.......',
  'kk...........',
];
// a placa de aço (31x13): borda escura de quinas cortadas, luz em cima e à esquerda, sombra embaixo e
// à direita, 4 rebites e a Folha gravada no meio (o sulco escuro e, embaixo dele, a beira que pega luz)
function placaAco(brilho) {  // brilho: a coluna do reflexo (null = sem)
  const W = 31, H = 13, L = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
    if (y === 0 || y === H - 1) return x === 0 || x === W - 1 ? '.' : 'k';
    if (x === 0 || x === W - 1) return 'k';
    if (y === 1) return '1';
    if (y === H - 2 || x === W - 2) return 'm';
    if (x === 1 || y === 2) return 'h';
    return y >= 7 ? 'n' : 's';
  }));
  for (const [x, y] of [[3, 3], [W - 5, 3], [3, H - 5], [W - 5, H - 5]]) { L[y][x] = 'R'; L[y][x + 1] = 'r'; L[y + 1][x] = 'r'; L[y + 1][x + 1] = 'd'; }
  SIMBOLO_FOLHA_13.forEach((l, y) => [...l].forEach((ch, x) => { if (ch === 'k') L[y + 1][x + 9] = 'g'; }));
  SIMBOLO_FOLHA_13.forEach((l, y) => [...l].forEach((ch, x) => { if (ch === 'k' && L[y + 2] && 'sn'.includes(L[y + 2][x + 9])) L[y + 2][x + 9] = 'G'; }));
  if (brilho != null) for (let y = 1; y < H - 1; y++) for (let x = 1; x < W - 1; x++) {
    const d = (x - brilho) + (y - 6) * 0.7;
    if ('1hsnmG'.includes(L[y][x]) && Math.abs(d) < 1.3) L[y][x] = 'w';
    else if ('hsnm'.includes(L[y][x]) && Math.abs(d) < 2.4) L[y][x] = '1';
  }
  return L.map(l => l.join(''));
}
const CORES_PLACA = { k: '#1E293B', 1: '#F8FAFC', h: '#E2E8F0', s: '#CBD5E1', n: '#B8C3D1', m: '#94A3B8', d: '#475569', r: '#64748B', R: '#F8FAFC', g: '#475569', G: '#EEF2F7', w: '#FFFFFF' };
const BRILHO_PLACA = 5.5;  // de 5,5 em 5,5 s um reflexo atravessa a placa (em 0,5 s)
function colarPlaca(g, T, dx, dy, t) {
  const fb = (t % BRILHO_PLACA) / 0.5, b = fb < 1 ? Math.round(-4 + 40 * fb) : null;
  colar(g, T, naTela('t7-placa#' + b, () => placaAco(b), CORES_PLACA, T.e), dx, dy);
}

// O anel vivo: a faixa em volta do cartão, em pixel da tela, com cada pixel sabendo a fileira dele
// (0 = a de fora) e onde está na volta (s, em DIPs, sentido horário a partir do começo da reta de
// cima). Pronto 1x por tamanho; no quadro só recolore (cor(fileira, s, xadrez) -> cor32) e cola as 4
// tiras. fileiras: [de, até] em px pra dentro da borda (de < 0: do lado de fora).
const VIVOS = cache(4);
function anelVivo(W, H, rr, e, fileiras) {
  const chave = W + 'x' + H + '|' + rr + '|' + e + '|' + fileiras.join(';');
  const pronto = VIVOS.get(chave);
  if (pronto) return pronto;
  const M = Math.max(0, -Math.min(...fileiras.map(f => f[0]))), CW = W + 2 * M, CH = H + 2 * M;
  const K = Math.min(Math.ceil(Math.max(rr, fileiras[fileiras.length - 1][1])) + 1 + M, Math.ceil(CW / 2), Math.ceil(CH / 2));
  const c = tela(CW, CH), idx = [], fil = [], s = [], par = [];
  const r = rr, lw = W - 2 * r, lh = H - 2 * r, arco = Math.PI * r / 2;
  const arcoDe = (cx, cy) => {
    if (cx >= r && cx <= W - r) return cy < H / 2 ? cx - r : lw + 2 * arco + lh + (W - r - cx);
    if (cy >= r && cy <= H - r) return cx > W / 2 ? lw + arco + (cy - r) : 2 * lw + 3 * arco + lh + (H - r - cy);
    if (cx > W - r && cy < r) return lw + (Math.atan2(cy - r, cx - (W - r)) + Math.PI / 2) * r;
    if (cx > W - r) return lw + arco + lh + Math.atan2(cy - (H - r), cx - (W - r)) * r;
    if (cy > H - r) return 2 * lw + 2 * arco + lh + (Math.atan2(cy - (H - r), cx - r) - Math.PI / 2) * r;
    return 2 * lw + 3 * arco + 2 * lh + (Math.atan2(cy - r, cx - r) + Math.PI) * r;
  };
  const ver = (x, y) => {
    const px = x - M, py = y - M;
    for (let i = 0; i < fileiras.length; i++) {
      if (dentro(px, py, W, H, rr, fileiras[i][0]) && !dentro(px, py, W, H, rr, fileiras[i][1])) {
        idx.push(y * CW + x); fil.push(i); s.push(arcoDe(px + 0.5, py + 0.5) / e); par.push((Math.floor(px / e) + Math.floor(py / e)) & 1);
        return;
      }
    }
  };
  for (let y = 0; y < CH; y++) {
    if (y < K || y >= CH - K) for (let x = 0; x < CW; x++) ver(x, y);
    else { for (let x = 0; x < K; x++) ver(x, y); for (let x = CW - K; x < CW; x++) ver(x, y); }
  }
  const ord = Int32Array.from(s.map((_, i) => i).sort((a, b) => s[a] - s[b]));
  return VIVOS.set(chave, {
    c, M, K, idx: Int32Array.from(idx), fil: Uint8Array.from(fil), s: Float32Array.from(s), par: Uint8Array.from(par),
    ord, sOrd: Float32Array.from(ord, i => s[i]), per: (2 * lw + 2 * lh + 4 * arco) / e, base: null, sujo: [],
  });
}
// Pinta o anel só onde muda: a base inteira 1x; a cada quadro devolve a base onde pintou no quadro
// anterior e pinta as janelas novas ([a, b] em DIPs da volta, podem passar do fim). corDe(fileira, s,
// xadrez) -> cor32, ou 0 pra ficar a base.
function pintarJanelas(A, base, janelas, corDe) {
  const px = A.c.pixels, { idx, fil, s, par, ord, sOrd, per } = A;
  if (A.base !== base) { for (let i = 0; i < idx.length; i++) px[idx[i]] = base[fil[i]]; A.base = base; A.sujo = []; }
  for (const [j0, j1] of A.sujo) for (let j = j0; j < j1; j++) { const i = ord[j]; px[idx[i]] = base[fil[i]]; }
  A.sujo = [];
  const acha = v => { let lo = 0, hi = sOrd.length; while (lo < hi) { const m = (lo + hi) >> 1; if (sOrd[m] < v) lo = m + 1; else hi = m; } return lo; };
  const pinta = (a, b) => {
    const j0 = acha(a), j1 = acha(b);
    for (let j = j0; j < j1; j++) { const i = ord[j], c = corDe(fil[i], s[i], par[i]); if (c) px[idx[i]] = c; }
    A.sujo.push([j0, j1]);
  };
  for (const [a0, b0] of janelas) {
    const a = ((a0 % per) + per) % per, b = a + Math.min(b0 - a0, per);
    if (b <= per) pinta(a, b); else { pinta(a, per); pinta(0, b - per); }
  }
}
function colarVivo(g, A, X, Y) {
  const { c, M, K } = A, W = c.width, H = c.height;
  X -= M; Y -= M;
  g.drawImage(c, 0, 0, W, K, X, Y, W, K);
  g.drawImage(c, 0, H - K, W, K, X, Y + H - K, W, K);
  if (H > 2 * K) {
    g.drawImage(c, 0, K, K, H - 2 * K, X, Y + K, K, H - 2 * K);
    g.drawImage(c, W - K, K, K, H - 2 * K, X + W - K, Y + K, K, H - 2 * K);
  }
}

// ---------- Time 7 (A): a bandana amarrada em volta do cartão ----------
// A faixa é pano: fio escuro por fora, 3 tons de azul (claro na beira, o azul da bandana, a sombra) e
// uma sombrinha no cartão. O pano junta e alarga até a placa de aço no meio do alto (o Clawd parado
// pisa nela), e atrás da "cabeça" (o meio de baixo) tem o nó, com as duas pontas balançando no vento.
// Um brilho macio (pontilhado nas beiras) corre pelo pano no sentido horário; de tempos em tempos um
// reflexo atravessa a placa. Entre as sessões e o usage, uma travessa do mesmo pano (o shoji).
const CORES_PANO = { o: T7.o, L: T7.L, B: T7.B, D: T7.D, N: T7.N, S: T7.S };
// o pano juntando até a placa (11 de largura, do lado esquerdo; o direito é o espelho): a coluna 0
// é a faixa normal, a 10 encosta na placa; as dobras (N) correm pra quina da placa
const JUNTA = [
  'ooooooooooo',
  'LLLLLLLLLLL',
  'BBBBBBBBBBB',
  'DDDDBBBBBBB',
  'SSSSDDBBLNB',
  '....SSDBLNB',
  '......SDLBN',
  '.......SDLN',
  '........DLN',
  '........SDL',
  '.........SD',
  '..........S',
];
// o nó atrás (8x9, centrado no meio de baixo): a faixa engrossa e torce (dobras na diagonal); as\n// pontas das colunas 0 e 9 são as fileiras da faixa
const NO = [
  '.ooooo.',
  'oLLLBDo',
  'oLBNBDo',
  'oLBNBDo',
  'oBBNBDo',
  'oBBNDDo',
  'oDDDDNo',
  '.ooooo.',
];
// as duas pontas do nó, soltas da quina no vento (quadro q de RABO_Q): fitas de pixel em degraus de
// 1 px, uma deitada (feita coluna a coluna, 4 de grossura afinando pra 3) e uma caindo (fileira a
// fileira, 3 afinando pra 2), claro de um lado e sombra do outro, a onda crescendo pra ponta e a
// ponta cortada torta; fio escuro em volta
const RABO_Q = 8, RABO_DY = 8;  // o nó fica em (4, 4 + RABO_DY) da grade
function rabos(q) {
  const W = 28, H = 26, f = q / RABO_Q;
  const grade = Array.from({ length: H }, () => Array(W).fill('.'));
  // uma fita deitada, coluna a coluna, saindo do nó pra direita; frente = fio escuro nas 2 beiras
  const fita = (len, b0, incl, amp, fase, frente) => {
    for (let i = 0; i < len; i++) {
      const u = i / len, c = b0 + incl * i + amp * u * Math.sin(2 * Math.PI * (i / 16 - f - fase));
      const gros = u < 0.7 ? 3 : 2, ini = Math.round(c - gros / 2), x = 4 + i;
      const tons = gros === 3 ? ['L', 'B', 'D'] : ['L', 'D'];
      for (let k = 0; k < gros; k++) {
        if (i === len - 1 && k < gros - 1) continue;  // a ponta cortada na diagonal
        if (grade[ini + k] && x < W) grade[ini + k][x] = tons[k];
      }
      if (frente) for (const yy of [ini - 1, ini + gros]) if (grade[yy] && x < W && 'LBDN'.includes(grade[yy][x])) grade[yy][x] = 'O';
    }
  };
  fita(16, 6 + RABO_DY, 0.42, 1.6, 0.3, false);  // a de baixo, atrás, caindo mais
  fita(21, 3 + RABO_DY, 0.22, 1.8, 0, true);     // a de cima, na frente, voando
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (grade[y][x] !== '.') continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => grade[y + b] && 'LBDN'.includes(grade[y + b][x + a] || '.'))) grade[y][x] = 'O';
  }
  return grade.map(l => l.join('').replace(/O/g, 'o'));
}
// a faixa em fileiras de 1 fio: o fio de fora, claro, azul, sombra, e a sombrinha no cartão
const FILEIRAS_A = f => [[-f, 0], [0, f], [f, 2 * f], [2 * f, 3 * f], [3 * f, 4 * f]];
const BASE_A = [T7_32.o, T7_32.L, T7_32.B, T7_32.D, T7_32.S];
const BRILHOS = 3, BRILHO_VEL = 24;  // DIPs/s
function molduraT7(g, T, [x, y, w, h], [X, Y, W, H], rr, fio, t) {
  const e = T.e, A = anelVivo(W, H, rr, e, FILEIRAS_A(fio)), per = A.per, esp = per / BRILHOS;
  const c0 = (t * BRILHO_VEL) % per, janelas = [];
  for (let k = 0; k < BRILHOS; k++) janelas.push([c0 + k * esp - 9, c0 + k * esp + 7]);
  pintarJanelas(A, BASE_A, janelas, (f, s, par) => {
    if (f < 1 || f > 3) return 0;
    let d = ((s - c0 + f * 0.8) % esp + esp) % esp;  // inclinado: o brilho atravessa o pano na diagonal
    d = Math.min(d, esp - d);
    if (d < 2.5) return f === 1 ? T7_32.l3 : f === 2 ? T7_32.l2 : T7_32.L;
    if (d < 6 && par) return f === 1 ? T7_32.l2 : f === 2 ? T7_32.L : T7_32.B;
    return 0;
  });
  colarVivo(g, A, X, Y);
  // a placa e o pano juntando nela (a borda de cima da placa = a da faixa: o Clawd parado pisa ali)
  const cx = Math.round(x + w / 2 - 15.5);
  colar(g, T, naTela('t7a-junta', JUNTA, CORES_PANO, e), cx - 11, y - 1);
  colar(g, T, naTela('t7a-junta-d', espelho(JUNTA), CORES_PANO, e), cx + 31, y - 1);
  colarPlaca(g, T, cx, y - 1, t);
  // o nó na beira da direita (atrás da "cabeça"), com as duas pontas voando pra fora no vento
  const q = Math.floor(t * 7) % RABO_Q, nx = Math.round(x + w - 5), ny = Math.round(y + 22);
  colar(g, T, naTela('t7a-rabos#' + q, () => rabos(q), CORES_PANO, e), nx, ny - RABO_DY);
  colar(g, T, naTela('t7a-no', NO, CORES_PANO, e), nx, ny);
}
// a travessa entre as sessões e o usage: do pano da faixa, de uma beira à outra (cobre o traço da janelinha)
function divisoria(g, hst) {
  if (COR.lado !== 'time7' || !hst.cartao || !(hst.linhas || []).length || !(hst.uso || []).length) return;
  const [x, , w] = hst.cartao, ul = hst.linhas[hst.linhas.length - 1], u0 = hst.uso[0];
  const y0 = ul.bola[1] + 14, y1 = (u0.rotulo ? u0.rotulo.caixa[1] : u0.barra[1]) - 2, meio = Math.round((y0 + y1) / 2);
  const T = escalaDe(g), e = T.e, f = Math.max(1, Math.round(e));
  const X0 = Math.round(T.ox + (x + 3) * e), X1 = Math.round(T.ox + (x + w - 3) * e), Y = Math.round(T.oy + meio * e) - f;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  for (const [k, cor] of [[0, T7.D], [1, T7.N], [2, T7.S]]) { g.fillStyle = cor; g.fillRect(X0, Y + k * f, X1 - X0, f); }
  g.restore();
}

// a ponta da barra do Time 7: a shuriken de aço (os outros tipos ficaram de fora da escolha do dono). Disco de 9 DIPs feito pixel a pixel na escala da tela, contorno de 1 DIP; o giro anda em
// passos (a figura se repete a cada 1/4, 1/1 e 1/5 de volta). Pronto 1x por passo e guardado.
const PONTAS7 = cache(300);
function ponta7(tipo, e, giro) {
  const per = tipo === 'shuriken' ? Math.PI / 2 : tipo === 'sakura' ? 2 * Math.PI / 5 : 2 * Math.PI, passos = tipo === 'uzumaki' ? 48 : 24;
  const passo = ((Math.round(giro / per * passos) % passos) + passos) % passos, a = passo / passos * per;
  const chave = tipo + '@' + e + '#' + passo, pronto = PONTAS7.get(chave);
  if (pronto) return pronto;
  const D = tipo === 'uzumaki' ? 9 : 11, n = Math.max(D, Math.round(D * e)), R = n / (2 * e), c = tela(n, n), px = c.pixels, cor = new Uint32Array(n * n);
  const mod = (v, m) => ((v % m) + m) % m;
  const C = tipo === 'shuriken' ? { f: '#CBD5E1', o: '#334155', m: '#334155' }
    : tipo === 'sakura' ? { f: '#F9A8D4', o: '#BE185D', m: '#FDE047' } : { f: '#FFF7ED', o: '#7C2D12', m: '#EA580C' };
  const F = cor32(C.f), O = cor32(C.o), M = cor32(C.m);
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const dx = (i + 0.5 - n / 2) / e, dy = (j + 0.5 - n / 2) / e, d = Math.hypot(dx, dy), th = Math.atan2(dy, dx);
    let k = 0;
    if (tipo === 'shuriken') {
      const q = Math.abs(Math.cos(2 * (th - a + 0.12 * d)));
      if (d <= R * (0.42 + 0.58 * q ** 3)) k = d < 1 ? M : F;
    } else if (tipo === 'sakura') {
      const p = mod(th - a, per) - per / 2;
      if (d <= R * (0.46 + 0.54 * Math.cos(p * Math.PI / per)) && !(Math.abs(p) < 0.17 && d > R - 1.3)) k = d < 1.15 ? M : F;
    } else if (d <= R) {
      const b = (R - 1.4) / (2.5 * Math.PI), f0 = mod(th - a, 2 * Math.PI);
      let traco = d < 0.8;
      for (let m = 0; m < 3 && !traco; m++) traco = Math.abs(d - b * (f0 + 2 * Math.PI * m)) < 0.6;
      k = traco ? M : F;
    }
    cor[j * n + i] = k;
  }
  const s = Math.max(1, Math.round(e));  // o contorno: 1 DIP de pixel de dentro que encosta no de fora
  const fora = (i, j) => i < 0 || j < 0 || i >= n || j >= n || !cor[j * n + i];
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    if (!cor[j * n + i]) continue;
    let borda = false;
    for (let q = 1; q <= s && !borda; q++) borda = fora(i - q, j) || fora(i + q, j) || fora(i, j - q) || fora(i, j + q);
    px[j * n + i] = borda ? O : cor[j * n + i];
  }
  return PONTAS7.set(chave, c);
}

// ---------- bolinha: a nuvenzinha (ou a folhinha), chapada ----------
function bolinha(g, linha, t) {
  const [x, y, w, h] = linha.bola, cor = corHex(linha.cor, '#9CA3AF');
  const cx = x + w / 2, cy = y + h / 2;
  g.save(); g.globalAlpha *= linha.sit === 'working' ? pulso(t) : 1;
  if (COR.lado === 'time7') g.drawImage(arte(FOLHINHA, { w: COR.borda, c: cor }), Math.round(cx - 4.5), Math.round(cy - 4));
  else g.drawImage(arte(NUVENZINHA, { w: COR.borda, c: cor }), Math.round(cx - 4.5), Math.round(cy - 3.5));
  g.restore();
}

// ---------- a ponta da barra: Sharingan, Mangekyō (Akatsuki) e Rasengan (Time 7) ----------
// disco de 9 DIPs feito pixel a pixel na escala da tela; o giro anda em 24 passos por 1/3 de volta
// (as 3 vírgulas / lâminas / braços se repetem a cada 120 graus). Pronto 1x por passo e guardado.
const OLHOS = cache(240), TERCO = 2 * Math.PI / 3, PASSOS = 24;
function olho(tipo, e, giro) {
  const passo = ((Math.round(giro / TERCO * PASSOS) % PASSOS) + PASSOS) % PASSOS;
  const chave = tipo + '@' + e + '#' + passo, pronto = OLHOS.get(chave);
  if (pronto) return pronto;
  const n = Math.max(9, Math.round(9 * e)), c = tela(n, n), px = c.pixels, R = n / (2 * e), a = passo / PASSOS * TERCO;
  const P = cor32(PRETO), V = cor32(VERMELHO), A = cor32(AZUL), M = cor32('#3B82F6'), C = cor32('#DBEAFE'), B = cor32('#F8FAFC');
  for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
    const dx = (i + 0.5 - n / 2) / e, dy = (j + 0.5 - n / 2) / e, d = Math.hypot(dx, dy);
    if (d > R) continue;
    const borda = d > R - 1.05, th = Math.atan2(dy, dx);
    let cor;
    if (tipo === 'rasengan') {
      const f = ((((th + 0.9 * d - a) % TERCO) + TERCO) % TERCO) / TERCO;
      cor = borda ? A : d < 0.9 ? B : f < 0.32 ? C : M;
    } else if (tipo === 'mangekyo') {
      const f = ((((th - a - 0.6 * d) % TERCO) + TERCO) % TERCO) / TERCO;
      cor = borda || d < 0.9 || f < 0.34 ? P : V;
    } else {
      let marca = d < 0.75;
      for (let k = 0; k < 3 && !marca; k++) {
        const ak = a + k * TERCO, ac = ak - 0.6;
        marca = Math.hypot(dx - 2.25 * Math.cos(ak), dy - 2.25 * Math.sin(ak)) < 0.95
          || Math.hypot(dx - 2.4 * Math.cos(ac), dy - 2.4 * Math.sin(ac)) < 0.55;
      }
      cor = borda || marca ? P : V;
    }
    px[j * n + i] = cor;
  }
  return OLHOS.set(chave, c);
}
// a ponta da barra do Time 7 com o centro em (cx, cy) DIPs, girando com t (cor: a do miolo da barra; a
// ponta tem as cores dela)
function redemoinho(g, cx, cy, cor, t) {
  const T = escalaDe(g);
  const img = ponta7('shuriken', T.e, t * 3);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(img, Math.round(T.ox + cx * T.e - img.width / 2), Math.round(T.oy + cy * T.e - img.height / 2));
  g.restore();
}

// ---------- barra: o fio até o quanto foi gasto e o olho na ponta ----------
// fio de 3 DIPs (branco; vermelho a partir de 80%) sobre o trilho escuro; na ponta o Sharingan girando
// (a partir de 95% o Mangekyō). Time 7: laranja, com a shuriken.
function barra(g, [x, y, w, h], pct, nivel, t) {
  const P = pal(), T = escalaDe(g), e = T.e, cy = y + h / 2, livre = w - 8, cheio = livre * lim(pct, 0, 100) / 100;
  const Y0 = Math.round(T.oy + (cy - 1.5) * e), Y1 = Math.round(T.oy + (cy + 1.5) * e);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const faixa = (a, b, cor) => {
    const X0 = Math.round(T.ox + a * e), X1 = Math.round(T.ox + b * e);
    if (X1 > X0 && Y1 > Y0) { g.fillStyle = cor; g.fillRect(X0, Y0, X1 - X0, Y1 - Y0); }
  };
  faixa(x, x + livre, P.trilho);
  if (cheio >= 0.5) faixa(x, x + cheio, nivel >= 2 ? P.forte : nivel >= 1 ? P.kurama : P.cheio);
  g.restore();
  const ponta = x + Math.max(cheio, 4);
  if (COR.lado === 'time7') { redemoinho(g, ponta, cy, P.cheio, t); return; }
  const img = olho(nivel >= 2 ? 'mangekyo' : 'sharingan', e, t * 1.8);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(img, Math.round(T.ox + ponta * e - img.width / 2), Math.round(T.oy + cy * e - img.height / 2));
  g.restore();
}

module.exports = { divisoria, moldura, andar, redemoinho, bolinha, barra, nivelDe, escrever, CORES_PCT, corDoPct, PAL, nuvem, NUVEM, folha, FOLHA };
