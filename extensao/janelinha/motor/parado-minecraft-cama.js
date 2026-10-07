'use strict';
// Parado há muito tempo, tema Minecraft: a CAMA (o "pular a noite" do jogo). O Clawd olha pros
// lados e pro céu, bate a picareta e põe uma cama vermelha do jogo do lado dele (2 blocos de
// 12 DIPs, o bloco da mineração; 9/16 de altura, como no jogo), pula nela e deita na hora (como
// no jogo), fecha os olhos e dorme: a coberta sobe e desce devagar e saem "z" com a letra do jogo.
// De vez em quando (janelas de 40 s; a 1ª sempre) ele sonha com um item, num balão.
// Algo voltou a rodar (saida): acorda, pula da cama pro lugar dele, quebra a cama com a picareta
// e ela vira item, que quica e voa pra ele; termina com o Clawd do tema em pé, no mesmo lugar.
// Referencial do Clawd: x+ pra direita, y- pra cima, chão = 0 = borda de cima do cartão. O quadro
// é função do tempo: os sorteios saem da semente fixada no cena(m).
const { sai, entra, rng, cache, tela, arte, tingida, IMG, sortearPeso } = require('./comum');
const { ROUPAS, registrarRoupas, spriteClawd, desenhaClawd, golpe } = require('./clawd');
const { quique, fazCacos, desenhaCacos, desenhaCoracoes } = require('./minecraft-kit');

const B = 12, TX = B / 16, ALT = 9 * TX;   // bloco (DIPs, o da mineração), texel, altura da cama
const CX = 13.5;                            // a cama: pé em CX, cabeceira até CX + 2B (à direita)
const FIM = CX + 2 * B;                     // ponta da cabeceira: a cabeça do Clawd deitado
const PX = 1.5;                             // pixel do Clawd
const XP = 27;                              // onde ele pousa em pé na cama (meio do Clawd)

// a entrada (s desde o começo da cena)
const T = {
  olhaE: 0.45, olhaD: 0.85, ceu: 1.25, bate: 1.6, poe: 1.9,   // olha em volta; a picareta põe a cama
  agacha: 2.3, pula: 2.4, pousa: 2.8, deita: 2.95,            // pula na cama e deita
  fecha: 3.55, laco: 3.55,                                    // fecha os olhos: o laço
};
const RESP = 3.2;                 // s por respiração
const Z_CADA = 1.35, Z_VIDA = 3.2; // um z a cada 1,35 s; cada um vive 3,2 s
const JANELA = 40, SONHO = 5.5;   // sonho: no máximo 1 por janela de 40 s (a 1ª sempre)
const ITENS = { diamante: 5, it_esmeralda: 2, it_ouro: 1, it_bacalhau: 1 };

// ---------- desenhos ----------
// a cama de lado: pé (cama_pe) à esquerda, cabeceira (cama_cabeca, travesseiro) à direita; só as
// 9 linhas de baixo da textura têm pixel. s = escala do "pop" (a partir do meio de baixo)
function desenhaCama(g, s = 1) {
  if (s <= 0) return;
  g.save();
  if (s !== 1) { g.translate(CX + B, 0); g.scale(s, s); g.translate(-(CX + B), 0); }
  if (IMG.cama_pe) g.drawImage(IMG.cama_pe, 0, 7, 16, 9, CX, -ALT, B, ALT);
  if (IMG.cama_cabeca) g.drawImage(IMG.cama_cabeca, 0, 7, 16, 9, CX + B, -ALT, B, ALT);
  g.restore();
}

// o Clawd olhando pro lado: a roupa com os olhos 1 pixel pro lado (registrada 1x, com o brilho
// do Herobrine junto)
function olhando(roupa, d) {
  const k = `${roupa}~olha${d > 0 ? 'D' : 'E'}`;
  if (!ROUPAS[k]) {
    const R = ROUPAS[roupa] || ROUPAS.clawd, olho = R.olho || /o/;
    const linhas = R.linhas.map(l => {
      const a = [...l], idx = a.map((c, i) => (olho.test(c) ? i : -1)).filter(i => i >= 0);
      for (const i of d > 0 ? idx.reverse() : idx) {
        const j = i + d;
        if (a[j] && a[j] !== '.' && !olho.test(a[j])) { a[i] = a[j]; a[j] = l[i]; }
      }
      return a.join('');
    });
    registrarRoupas({ [k]: { ...R, linhas, olhosCx: undefined } });
  }
  return k;
}
const roupaDe = m => (m.roupa && ROUPAS[m.roupa] ? m.roupa : 'mc_steve');

// em pé, como o tema desenha (picareta na mão; corações se ele estiver machucado)
function clawdEmPe(g, m, p = {}) {
  const { olhar, coracoes, ...resto } = p, roupa = roupaDe(m);
  desenhaClawd(g, { pernas: 'ambas', ang: 0, ...resto, roupa: olhar ? olhando(roupa, olhar) : roupa, ferr: 'picareta', T: m.T });
  const e = m.estado || {};
  if (coracoes && (e.vida < 9.99 || e.ouro)) desenhaCoracoes(g, Math.floor(e.vida), e.ouro, false, 0.9);
}

// deitado de lado, cabeça no travesseiro: a cabeça do sprite do tema girada 90° (pra direita),
// só as colunas 3 a 6 (o resto fica "dentro" do colchão), pixel a pixel e guardada; o corpo
// fica embaixo da coberta
const C0 = 3, C1 = 6;
const DEITADOS = cache(24);
function cabecaDeitada(roupa, olhos) {
  const chave = roupa + '|' + olhos, pronto = DEITADOS.get(chave);
  if (pronto) return pronto;
  const spr = spriteClawd(roupa, 'ambas', olhos, false), W = spr.width, L = spr.height, N = L - 6;  // 6 = corpo
  const out = tela(N, C1 - C0 + 1);
  for (let lin = 0; lin < N; lin++) for (let col = C0; col <= C1; col++) out.pixels[(col - C0) * N + (N - 1 - lin)] = spr.pixels[lin * W + col];
  return DEITADOS.set(chave, out);
}
// a coberta por cima do corpo, do pé ao pescoço: altura em texels de cada coluna (pés, canelas,
// quadril, ombro: 2 texels abaixo do alto da cabeça) e quanto o peito sobe quando ele respira
// (b = 0, 1, 2: no máximo até a altura da cabeça)
const PESCOCO = FIM - 4 * PX;
const PERFIL = [3, 4, 4, 3, 3, 3, 4, 4, 4, 5, 5, 5, 6, 6, 6, 6, 6, 6, 6, 5];
const folego = (x, b) => (b === 1 ? +(x >= 11 && x <= 17) : b === 2 ? (x >= 12 && x <= 16 ? 2 : +(x >= 9 && x <= 18)) : 0);
const COR_COBERTA = { a: '#A22722', b: '#902120', c: '#851A1A', d: '#761718', e: '#6B1213' };
function coberta(b) {
  const hs = PERFIL.map((h, i) => h + folego(i, b)), H = Math.max(...hs), n = hs.length;
  const linhas = [];
  for (let y = 0; y < H; y++) {
    let s = '';
    for (let x = 0; x < n; x++) {
      const d = y - (H - hs[x]);
      if (d < 0) s += '.';
      else if (x === n - 1) s += 'd';                         // a beirada no pescoço
      else if (d === 0) s += 'a';                             // o alto do pano
      else if (y === H - 1) s += 'c';                         // encostado no colchão
      else if ((x === 7 || x === 13) && d >= 1 && d <= 2) s += 'c';  // dobras
      else s += 'b';
    }
    linhas.push(s);
  }
  return arte(linhas, COR_COBERTA);
}
function clawdDeitado(g, m, olhos, b) {
  const cab = cabecaDeitada(roupaDe(m), olhos);
  g.drawImage(cab, PESCOCO, -ALT - cab.height * PX, cab.width * PX, cab.height * PX);
  const c = coberta(b);
  g.drawImage(c, PESCOCO - c.width * TX, -ALT - c.height * TX, c.width * TX, c.height * TX);
}

// os "z" com a letra do jogo (font/ascii): branco com a sombra 1/4 da cor, 1 px pra baixo e pra direita
const LETRAS = { z: ['#####', '...#.', '..#..', '.#...', '#####'], Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'] };
function comSombra(l) {
  const out = Array.from({ length: l.length + 1 }, () => Array(l[0].length + 1).fill('.'));
  l.forEach((s, y) => [...s].forEach((c, x) => { if (c === '#') out[y + 1][x + 1] = 's'; }));
  l.forEach((s, y) => [...s].forEach((c, x) => { if (c === '#') out[y][x] = '#'; }));
  return out.map(r => r.join(''));
}
const COR_LETRA = { '#': '#FFFFFF', s: '#3F3F3F' };
const zArte = grande => arte(comSombra(LETRAS[grande ? 'Z' : 'z']), COR_LETRA);
// o z número k nasce em zNasce(k) acima da cabeça, sobe 22 DIPs em Z_VIDA indo pra direita e
// cresce (z, Z, Z maior); some no fim. Os que nasceriam durante um sonho (ou 2 s antes) não nascem.
const zNasce = k => T.laco + 0.4 + k * Z_CADA;
function desenhaZs(g, t, P, alfa = 1, ateNascer = Infinity) {
  if (alfa <= 0 || t < zNasce(0)) return;
  const a0 = g.globalAlpha;
  for (let k = Math.max(0, Math.floor((t - Z_VIDA - zNasce(0)) / Z_CADA)); zNasce(k) <= t; k++) {
    const tz = zNasce(k), e = t - tz;
    if (e >= Z_VIDA || tz > ateNascer || sonhando(P, tz, 2)) continue;
    const u = e / Z_VIDA, fase = (k * 2.39996) % (2 * Math.PI);
    const img = zArte(u >= 0.3), esc = u < 0.62 ? 1 : 1.5;
    const x = FIM - 3 + 10 * u + Math.sin(u * 5 + fase) * 1.4, y = -ALT - 8 - 22 * u;
    g.globalAlpha = a0 * alfa * (u < 0.1 ? u / 0.1 : u > 0.75 ? (1 - u) / 0.25 : 1);
    g.drawImage(img, Math.round(x), Math.round(y - img.height * esc), img.width * esc, img.height * esc);
  }
  g.globalAlpha = a0;
}

// o sonho: bolinhas saem da cabeça, o balão abre e o item aparece; 5,5 s
const BALAO = ['..######..', '.#wwwwww#.', '#wwwwwwww#', '#wwwwwwww#', '#wwwwwwww#', '#wwwwwwww#', '#wwwwwwww#', '.#wwwwww#.', '..######..'];
const COR_BALAO = { '#': '#3F3F3F', w: '#FFFFFF' };
const BOLINHAS = [[FIM - 3, -ALT - 9.75, 1], [FIM - 6, -ALT - 14.25, 2]];  // [x, y, lado em px do Clawd]
const BX = FIM - 12, BY = -ALT - 29;  // canto de cima à esquerda do balão (à esquerda dos z)
function sonhoDa(P, k) {
  if (k < 0) return null;
  const r = rng(P.semente + 7919 * (k + 1));
  if (k > 0 && r() >= 0.3) return null;
  // o 1º logo (pra quem olha ver), os outros em qualquer ponto da janela, sem passar dela
  const t0 = k === 0 ? T.laco + 16 + r() * 6 : T.laco + k * JANELA + 4 + r() * (JANELA - SONHO - 8);
  return { t0, item: sortearPeso(ITENS, r) };
}
function sonhoEm(P, t) {
  const s = sonhoDa(P, Math.floor((t - T.laco) / JANELA));
  return s && t >= s.t0 && t < s.t0 + SONHO ? s : null;
}
// t cai num sonho (com folga antes)? (os z param de nascer)
function sonhando(P, t, folga) { return !!(sonhoEm(P, t + folga) || sonhoEm(P, t)); }
function desenhaSonho(g, t, P, alfa = 1) {
  const s = sonhoEm(P, t);
  if (!s || alfa <= 0) return;
  const d = t - s.t0, sumindo = d > SONHO - 0.4 ? (SONHO - d) / 0.4 : 1;
  g.save(); g.globalAlpha *= alfa * sumindo;
  BOLINHAS.forEach(([x, y, n], i) => { if (d >= 0.2 * i) { g.fillStyle = '#3F3F3F'; g.fillRect(x - 0.75, y - 0.75, n * PX + 1.5, n * PX + 1.5); g.fillStyle = '#FFFFFF'; g.fillRect(x, y, n * PX, n * PX); } });
  if (d >= 0.45) {
    const u = Math.min(1, (d - 0.45) / 0.15), s2 = 0.6 + 0.4 * sai(u), img = arte(BALAO, COR_BALAO);
    const w = img.width * PX, h = img.height * PX, cx = BX + w / 2, cy = BY + h;
    g.save(); g.translate(cx, cy); g.scale(s2, s2); g.translate(-cx, -cy);
    g.drawImage(img, BX, BY, w, h);
    const it = IMG[s.item];
    if (it && d >= 0.6) g.drawImage(it, BX + w / 2 - 4.5, BY + h / 2 - 4.5, 9, 9);
    g.restore();
  }
  g.restore();
}

// o item da cama (como o jogo larga uma cama quebrada): de 3/4, montado das texturas 1x
let icone = null;
function iconeCama() {
  if (icone && icone.de === IMG.cama_pe && icone.de2 === IMG.cama_cabeca) return icone.img;
  const c = tela(16, 16), px = c.pixels;
  const pega = (img, x, y) => (img ? img.pixels[Math.min(img.height - 1, y) * img.width + Math.min(img.width - 1, x)] : 0);
  for (let x = 0; x < 16; x++) {
    const u = x * 2, pe = u < 16;
    // em cima: a coberta e o travesseiro vistos de cima (4 linhas)
    for (let y = 0; y < 4; y++) {
      const img = pe ? IMG.cama_pe_cima : IMG.cama_cabeca_cima, v = pe ? 15 - u : 31 - u;
      px[(6 + y) * 16 + x] = pega(img, y * 4 + 2, v);
    }
    // de lado: as 9 linhas da cama em 6
    for (let y = 0; y < 6; y++) px[(10 + y) * 16 + x] = pega(pe ? IMG.cama_pe : IMG.cama_cabeca, pe ? u : u - 16, 7 + Math.floor(y * 9 / 6));
  }
  icone = { img: c, de: IMG.cama_pe, de2: IMG.cama_cabeca };
  return c;
}
// o item caído: pula, quica, gira em pé e voa pro Clawd (o desenhaDrop do kit, com a imagem)
function desenhaItem(g, img, e, x0, y0, vx, vy, pega, tam, alvoX = 0) {
  if (e < 0) return;
  let p = quique(e, x0, y0, vx, vy), esc = 1;
  if (e >= pega) {
    const u = (e - pega) / 0.24;
    if (u >= 1) return;
    const q = quique(pega, x0, y0, vx, vy);
    p = { x: q.x + (alvoX - q.x) * entra(u), y: q.y + (-8 - q.y) * entra(u) }; esc = 1 - 0.5 * u;
  }
  g.save(); g.translate(p.x, p.y - 1);
  g.scale((Math.abs(Math.cos(e * 3.2)) + 0.08) * esc, esc);
  g.drawImage(img, -tam / 2, -tam, tam, tam);
  g.restore();
}

function desenhaPoeira(g, lista, d) {
  if (d < 0) return;
  for (const p of lista) {
    if (d >= p.vida) continue;
    const f = 7 - Math.min(7, Math.floor(d / p.vida * 8)), img = IMG['poof' + f];
    if (!img) continue;
    const x = (p.lado < 0 ? CX : FIM) + p.vx * d, y = p.dy + p.vy * d;
    g.save(); g.globalAlpha *= 0.85; g.drawImage(tingida(img, '#BFBFBF', 'poof' + f), x - p.tam / 2, y - p.tam / 2, p.tam, p.tam); g.restore();
  }
}

// ---------- a cena ----------
// sorteios da cena (pó de pôr a cama, cacos de quebrar): tudo a partir da semente
function sorteios(semente) {
  const r = rng(semente);
  // pó de pôr a cama: nuvenzinhas cinza saindo das pontas, rente ao chão
  const poeira = [[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([lado, k]) => ({ lado, vx: lado * (14 + r() * 8), vy: -(3 + r() * 4) * (k > 0 ? 1.6 : 1), tam: 2.2 + r() * 1.2, vida: 0.3 + r() * 0.1, dy: k > 0 ? -2.2 : -0.8 }));
  const caco = p => ({ ...p, sy: 7 + (p.sy % 6), vida: 0.32 + (p.vida - 0.7) * 0.4 });
  return { semente, poeira, cacosPe: fazCacos(r, 6, 70, 2).map(caco), cacosCab: fazCacos(r, 6, 70, 2).map(caco) };
}
const ULTIMA = new WeakMap();  // mundo -> sorteios da última cena (pra saída)

// o "pop" da cama aparecendo (d = s desde que ela apareceu)
const pop = d => (d < 0 ? 0 : d < 0.07 ? 0.75 + 0.35 * (d / 0.07) : d < 0.15 ? 1.1 - 0.1 * ((d - 0.07) / 0.08) : 1);
const respira = t => { const f = 0.5 - 0.5 * Math.cos(2 * Math.PI * (t - T.laco) / RESP); return t < T.laco ? 0 : f < 0.25 ? 0 : f < 0.75 ? 1 : 2; };

// onde está tudo no instante t da cena: { cama (escala do pop), pose } em pé/no ar, ou
// { cama, deitado, olhos, b (a respiração da coberta) }
function estado(t) {
  const cama = pop(t - T.poe);
  if (t < T.agacha) {
    const p = { x: 0, y: 0 };
    if (t >= T.olhaE && t < T.olhaD) p.olhar = -1;
    else if (t >= T.olhaD && t < T.ceu) p.olhar = 1;
    else if (t >= T.ceu && t < T.bate) p.olhos = 'cima';
    else if (t >= T.bate && t < T.poe) p.ang = golpe((t - T.bate) / (T.poe - T.bate));
    if (t >= T.poe && t < T.poe + 0.12) p.ang = 70 * (1 - (t - T.poe) / 0.12);
    if (t >= T.poe + 0.15) p.olhar = 1;  // olha a cama
    return { cama, pose: p };
  }
  if (t < T.pula) return { cama, pose: { sy: 1 - 0.12 * Math.sin(Math.PI * (t - T.agacha) / (T.pula - T.agacha)), olhar: 1 } };
  if (t < T.pousa) {
    const u = (t - T.pula) / (T.pousa - T.pula);
    return { cama, pose: { x: XP * u, y: -ALT * u - 12 * Math.sin(Math.PI * u), ang: -20 * Math.sin(Math.PI * u) } };
  }
  if (t < T.deita) return { cama, pose: { x: XP, y: -ALT, sy: 1 - 0.12 * Math.sin(Math.PI * (t - T.pousa) / (T.deita - T.pousa)) } };
  const d = t - T.deita;
  const pisca = t >= T.fecha - 0.3 && t < T.fecha - 0.18;  // uma piscada de sono antes de fechar
  return { cama, deitado: true, olhos: t < T.fecha && !pisca ? 'abertos' : 'fechados', b: d < 0.1 ? 2 : d < 0.2 ? 1 : respira(t) };
}
function desenha(g, t, m, P, e) {
  desenhaCama(g, e.cama);
  if (e.cama) desenhaPoeira(g, P.poeira, t - T.poe);
  if (e.deitado) clawdDeitado(g, m, e.olhos, e.b);
  else clawdEmPe(g, m, e.pose);
}

// ---------- a saída: acorda, pula pro lugar dele, quebra a cama, pega o item ----------
const ACORDA = 0.1, VOLTA = 0.3, BATE = 0.14, PEGA = 0.38;
function quadroSaida(g, t, m, tCorte) {
  const P = ULTIMA.get(m) || sorteios(0), e0 = estado(Math.max(0, tCorte));
  const temCama = e0.cama > 0;
  // de onde ele volta: deitado (acorda antes), no ar ou em cima da cama; ou já no lugar
  const p0 = e0.deitado ? { x: XP, y: -ALT } : e0.pose;
  const longe = Math.abs(p0.x || 0) > 0.01 || Math.abs(p0.y || 0) > 0.01;
  const tAcorda = e0.deitado ? ACORDA : 0, tVolta = tAcorda + (longe ? VOLTA : 0);
  // a picareta no meio de um golpe (acabou de pôr a cama) volta ao normal antes de bater de novo
  const ang0 = (!longe && e0.pose && e0.pose.ang) || 0;
  const tBate = temCama ? Math.max(tVolta - 0.04, ang0 ? 0.1 : 0) : Infinity, tQuebra = tBate + BATE;
  // a cama (termina o pop) e a quebra
  if (temCama && t < tQuebra) desenhaCama(g, t < 0.08 ? e0.cama + (1 - e0.cama) * (t / 0.08) : 1);
  if (temCama) desenhaPoeira(g, P.poeira, tCorte + t - T.poe);
  if (temCama) {
    desenhaCacos(g, P.cacosPe, 'cama_pe', CX + B / 2, -3.4, t - tQuebra);
    desenhaCacos(g, P.cacosCab, 'cama_cabeca', CX + 1.5 * B, -3.4, t - tQuebra);
  }
  // o Clawd
  if (e0.deitado && t < tAcorda) clawdDeitado(g, m, 'abertos', e0.b);
  else if (t < tVolta) {
    const u = (t - tAcorda) / VOLTA;
    clawdEmPe(g, m, { x: (p0.x || 0) * (1 - u), y: (p0.y || 0) * (1 - u) - 10 * Math.sin(Math.PI * u), ang: -20 * Math.sin(Math.PI * u), coracoes: true });
  } else {
    const p = { coracoes: true };
    const dPouso = t - tVolta;
    if (longe && dPouso < 0.1) p.sy = 1 - 0.1 * Math.sin(Math.PI * dPouso / 0.1);
    if (t >= tBate && t < tQuebra) p.ang = golpe((t - tBate) / BATE);
    else if (t >= tQuebra && t < tQuebra + 0.12) p.ang = 70 * (1 - (t - tQuebra) / 0.12);
    else if (ang0 && t < 0.1) p.ang = ang0 * (1 - t / 0.1);
    clawdEmPe(g, m, p);
  }
  // o item da cama, por cima do Clawd e baixinho (por baixo da picareta), voa pra ele
  if (temCama) desenhaItem(g, iconeCama(), t - tQuebra, CX + B, -3, -34, -50, PEGA, 10, 0);
  // o que estava no ar some: os z sobem mais um pouco, o sonho fecha
  const some = Math.max(0, 1 - t / 0.3);
  desenhaZs(g, tCorte + t, P, some, tCorte);
  desenhaSonho(g, tCorte, P, Math.max(0, 1 - t / 0.15));
}

module.exports = {
  texturas: ['cama_pe', 'cama_cabeca', 'cama_pe_cima', 'cama_cabeca_cima', 'picareta', ...Array.from({ length: 8 }, (_, i) => 'poof' + i),
    ...Object.keys(ITENS), 'coracao_cheio', 'coracao_meio', 'coracao_vazio', 'coracao_vazio_pisca', 'coracao_ouro'],
  linhaDoTempo: [
    [0, 'em pé, olha pra um lado, pro outro e pro céu'],
    [T.bate, 'bate a picareta: a cama vermelha aparece do lado dele (pó)'],
    [T.agacha, 'agacha, pula na cama e deita na hora (como no jogo)'],
    [T.fecha, 'fecha os olhos e dorme: a coberta sobe e desce, saem z z Z (laço até algo rodar)'],
    [T.laco + 16, '1º sonho (entre ~20 e ~26 s, 5,5 s): balão com um diamante (às vezes esmeralda, ouro, peixe); depois ~1 a cada 2 min'],
  ],
  cena(m) {
    const P = sorteios(Math.floor(m.sorteio() * 4294967296));
    ULTIMA.set(m, P);
    return {
      nome: 'parado', dur: Infinity, espaco: { frente: 0, tras: 0 }, modos: ['parado'],
      quadro(g, t, mundo) {
        desenha(g, t, mundo, P, estado(t));
        desenhaZs(g, t, P);
        desenhaSonho(g, t, P);
      },
    };
  },
  saida: { dur: 1.2, quadro: quadroSaida },
};
