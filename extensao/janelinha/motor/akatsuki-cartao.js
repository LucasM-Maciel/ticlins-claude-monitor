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
// máximo 5 a 7 DIPs dela entram no cartão (o texto começa a 10-12). PASSO: o espaço entre uma nuvem e a
// próxima; VEL: DIPs/s, no sentido horário.
const RAIO = 8, SOBE = 1, LADO = 3, CURVA = 8, PASSO = 70, VEL = 20;
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
    const n = Math.max(4, Math.round(per / PASSO)), esp = per / n, img = nuvemNaTela(e);
    for (let i = 0; i < n; i++) {
      const [cx, cy] = noTrilho(i * esp + t * VEL, rx, ry, rw, rh);
      g.drawImage(img, Math.round(T.ox + (cx - NW / 2) * e), Math.round(T.oy + (cy - NH / 2) * e));
    }
  }
  g.restore();
}

// ---------- Time 7: as 3 variantes da moldura ----------
// sprite na escala da tela, ampliado pixel a pixel e guardado
const SPRITES = cache(32);
function naTela(nome, linhas, cores, e) {
  const chave = nome + '@' + e, pronto = SPRITES.get(chave);
  if (pronto) return pronto;
  const base = arte(linhas, cores);
  const c = tela(Math.round(base.width * e), Math.round(base.height * e));
  c.getContext('2d').drawImage(base, 0, 0, c.width, c.height);
  return SPRITES.set(chave, c);
}
const colar = (g, T, img, dx, dy) => g.drawImage(img, Math.round(T.ox + dx * T.e), Math.round(T.oy + dy * T.e));  // (dx, dy): canto, em DIPs
// A: a placa de aço da bandana com a Folha gravada (31x13), rebites nos cantos
const SIMBOLO_FOLHA = [
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
const PLACA = (() => {
  const W = 31, H = 13, L = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) =>
    (y === 0 || y === H - 1) ? (x === 0 || x === W - 1 ? '.' : 'd') : (x === 0 || x === W - 1) ? 'd' : 's'));
  for (const [x, y] of [[2, 2], [W - 3, 2], [2, H - 3], [W - 3, H - 3]]) L[y][x] = 'r';
  SIMBOLO_FOLHA.forEach((l, y) => [...l].forEach((ch, x) => { if (ch === 'k') L[y + 1][x + 9] = 'k'; }));
  return L.map(l => l.join(''));
})();
const CORES_PLACA = { d: '#334155', s: '#CBD5E1', r: '#64748B', k: '#334155' };
function molduraT7(g, T, [x, y, w, h], [X, Y, W, H], rr, fio) {
  // a faixa azul da bandana e a placa no meio do alto (parada: é metal)
  colarAnel(g, anel(W, H, rr, [[0, 2 * fio, AZUL]]), X, Y);
  colar(g, T, naTela('placa', PLACA, CORES_PLACA, T.e), Math.round(x + w / 2 - 15.5), y - 5);
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

module.exports = { moldura, andar, redemoinho, bolinha, barra, nivelDe, escrever, CORES_PCT, corDoPct, PAL, nuvem, NUVEM, folha, FOLHA };
