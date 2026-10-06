'use strict';
// Enfeites do cartão no tema Minecraft: os MESMOS da janelinha WPF (overlay.ps1), que é o
// que aparece quando o motor cai, então os dois têm que ficar iguais. Borda de terra com
// grama e uma sombrinha embaixo dela; bolinha = o menor orbe de XP pintado com a cor da
// situação; barra do usage = a barra de XP; números na letra do jogo em 11/9, suavizada.
// Tudo que é caro (moldura, letreiros, orbes, barras pintadas) é feito 1x e guardado.
const { IMG, tela, cache, temTexturas, reamostrar } = require('./comum');

const TEXTURAS = ['terra', 'grama', 'orbe', 'xp_fundo', 'xp_barra', 'fonte'];
// as 6 e no tamanho do jogo (a janelinha confere igual antes de usar cada uma)
function prontos() {
  if (!temTexturas(...TEXTURAS)) return false;
  return IMG.orbe.width >= 12 && IMG.orbe.height >= 12 && IMG.xp_fundo.width === 182 && IMG.xp_barra.width === 182 &&
    IMG.xp_fundo.height >= 5 && IMG.xp_barra.height >= 5 && IMG.fonte.width === 128 && IMG.fonte.height === 128;
}

// arredonda como o PowerShell ([math]::Round e o byte de um double): meio vai pro par
function par(v) { const r = Math.round(v); return r - v === 0.5 && r % 2 ? r - 1 : r; }
const rgb = hex => {
  const n = /^#[0-9a-f]{6}/i.test(hex) ? parseInt(hex.slice(1, 7), 16) : 0x9CA3AF;  // cor estranha: o cinza do "outro"
  return [((n >> 16) & 255) / 255, ((n >> 8) & 255) / 255, (n & 255) / 255];
};
// os pixels crus (RGBA sem pré-multiplicar, como o Bgra32 do WPF) de um pedaço, e de volta pra imagem
const pixelsDe = (img, x, y, w, h) => img.getContext('2d').getImageData(x, y, w, h);
function telaDe(dados) { const t = tela(dados.width, dados.height); t.getContext('2d').putImageData(dados, 0, 0); return t; }

// -- borda de terra com grama em cima (blocos de 32: 2 px por pixel da textura) e a sombra
// de 1 px (#59000000) logo abaixo da grama, como a janelinha WPF pinta (fotos de 06/10):
// - o pincel em ladrilho (TileMode Tile) sai SUAVIZADO, apesar do NearestNeighbor: cada
//   pixel é a média bilinear dos 4 pixels da textura em volta do centro dele, e na beira do
//   bloco a média dá a volta pro outro lado da textura;
// - o cartão pode cair em meio pixel (y = 259,5): a beira fica com a parte coberta do pixel.
// O ladrilho começa no canto do cartão. Pronta 1x por tamanho/escala; por quadro, só as 4
// tiras que têm borda.
const MOLDURAS = cache(4);
const SOMBRA = 0x59 / 255;
const resto = (a, n) => ((a % n) + n) % n;
// quanto de [a, a+1) cai em [b0, b1)
const sobre = (a, b0, b1) => Math.max(0, Math.min(a + 1, b1) - Math.max(a, b0));
// a cor (pré-multiplicada, em 4 canais) do ladrilho no ponto x, y (DIPs a partir do canto do cartão)
function amostra(img, x, y, cor, saida) {
  if (!img) { saida.set(cor); return saida; }
  const tx = img.pixels, tw = img.width, th = img.height;
  const u = x * tw / 32 - 0.5, v = y * th / 32 - 0.5, u0 = Math.floor(u), v0 = Math.floor(v), fu = u - u0, fv = v - v0;
  const l0 = resto(v0, th) * tw, l1 = resto(v0 + 1, th) * tw, c0 = resto(u0, tw), c1 = resto(u0 + 1, tw);
  const a = tx[l0 + c0], b = tx[l0 + c1], c = tx[l1 + c0], d = tx[l1 + c1];
  for (let k = 0, s = 0; k < 4; k++, s += 8) {  // B, G, R, A
    saida[k] = ((a >>> s) & 255) * (1 - fu) * (1 - fv) + ((b >>> s) & 255) * fu * (1 - fv) + ((c >>> s) & 255) * (1 - fu) * fv + ((d >>> s) & 255) * fu * fv;
  }
  return saida;
}
const opaca = hex => { const n = parseInt(hex.slice(1), 16); return [n & 255, (n >> 8) & 255, (n >> 16) & 255, 255]; };
const SEM_TERRA = opaca('#866043'), SEM_GRAMA = opaca('#5D9C36');  // as cores da janelinha sem textura
function moldura([x, y, w, h], esc) {
  const chave = [x, y, w, h, esc, !!IMG.terra, !!IMG.grama].join();
  const pronta = MOLDURAS.get(chave);
  if (pronta) return pronta;
  const X0 = Math.floor(x * esc), Y0 = Math.floor(y * esc);
  const W = Math.max(1, Math.ceil((x + w) * esc) - X0), H = Math.max(1, Math.ceil((y + h) * esc) - Y0);
  const t = tela(W, H), px = t.pixels;
  const cx = x * esc - X0, cy = y * esc - Y0;  // o canto do cartão dentro da tela (px)
  // os retângulos (DIPs a partir do canto do cartão) em px da tela: [x0, x1, y0, y1]
  const ret = (a0, b0, a1, b1) => [cx + a0 * esc, cx + Math.max(a0, a1) * esc, cy + b0 * esc, cy + Math.max(b0, b1) * esc];
  const GRAMA = ret(0, 0, w, 8), FORA = ret(0, 8, w, h), MIOLO = ret(6, 8, w - 6, h - 6), SOMB = ret(6, 8, w - 6, 9);
  const cobre = (r, i, j) => sobre(i, r[0], r[1]) * sobre(j, r[2], r[3]);
  const ct = new Float64Array(4), cg = new Float64Array(4);
  // só a faixa da borda: no miolo, as linhas do meio passam direto pras colunas do lado
  const ateCima = Math.ceil(cy + 9 * esc) + 1, desdeBaixo = Math.floor(cy + (h - 6) * esc) - 1;
  const esq = Math.ceil(cx + 6 * esc) + 1, dir = Math.floor(cx + (w - 6) * esc) - 1;
  for (let j = 0; j < H; j++) {
    const inteira = j < ateCima || j >= desdeBaixo;
    for (let i = 0; i < W; i++) {
      if (!inteira && i === esq && dir > esq) i = dir;
      const g = cobre(GRAMA, i, j), te = cobre(FORA, i, j) - cobre(MIOLO, i, j), so = cobre(SOMB, i, j) * SOMBRA;
      if (g <= 0 && te <= 1e-9 && so <= 0) continue;
      const xd = (i + 0.5 - cx) / esc, yd = (j + 0.5 - cy) / esc;  // o centro do pixel, em DIPs do cartão
      if (g > 0) amostra(IMG.grama, xd, yd, SEM_GRAMA, cg); else cg.fill(0);
      if (te > 1e-9) amostra(IMG.terra, xd, yd, SEM_TERRA, ct); else ct.fill(0);
      let p = 0;
      for (let k = 0, s = 0; k < 4; k++, s += 8) {
        const v = cg[k] * g + ct[k] * Math.max(0, te);   // grama e terra não se sobrepõem
        p += Math.min(255, Math.round(k === 3 ? so * 255 + v * (1 - so) : v * (1 - so))) * 2 ** s;  // a sombra por cima
      }
      px[j * W + i] = p;
    }
  }
  // tiras sem sobrepor (a sombra é translúcida: passar 2x escureceria)
  const cima = Math.min(H, Math.ceil(9 * esc) + 2), baixo = Math.min(H - cima, Math.ceil(6 * esc) + 2), lado = Math.min(W, Math.ceil(6 * esc) + 2);
  const meio = H - cima - baixo;
  const tiras = [[0, 0, W, cima], [0, H - baixo, W, baixo], [0, cima, lado, meio], [W - lado, cima, lado, meio]].filter(([, , a, b]) => a > 0 && b > 0);
  return MOLDURAS.set(chave, { img: t, X0, Y0, tiras });
}
function desenharMoldura(g, cartao, esc) {
  const M = moldura(cartao, esc);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  for (const [sx, sy, sw, sh] of M.tiras) g.drawImage(M.img, sx, sy, sw, sh, M.X0 + sx, M.Y0 + sy, sw, sh);
  g.restore();
}

// -- bolinha: o menor quadro do orbe (8x8 no canto 4,4), que é cinza: o jogo pinta por cima.
// Trabalhando, a cor anima como no jogo (f = ms/100, uma volta a cada 0,63 s, em 32 quadros).
const ORBES = cache(64);
function orbePintado(chave, [r, g, b]) {
  const pronto = ORBES.get(chave);
  if (pronto) return pronto;
  const d = pixelsDe(IMG.orbe, 4, 4, 8, 8), p = d.data;
  for (let k = 0; k < p.length; k += 4) { p[k] = par(p[k] * r); p[k + 1] = par(p[k + 1] * g); p[k + 2] = par(p[k + 2] * b); }
  return ORBES.set(chave, telaDe(d));
}
function orbeDaSituacao(sit, cor, T) {
  if (sit !== 'working') return orbePintado(cor, rgb(cor));
  const q = Math.floor(T * 10 / (2 * Math.PI) * 32) % 32, f = 2 * Math.PI * q / 32;
  return orbePintado('trabalhando' + q, [(Math.sin(f) + 1) / 2, 1, (Math.sin(f + 4.18879) + 1) * 0.1]);
}

// -- barra de XP (182 no jogo, 118 aqui): 117 colunas + a ponta, sem esticar os gomos.
// Dourada e vermelha: a verde repintada com o mesmo brilho (a fórmula do overlay.ps1).
const BARRAS = cache(4);
function barraPintada(nivel) {
  if (!nivel) return IMG.xp_barra;
  const pronta = BARRAS.get(nivel);
  if (pronta) return pronta;
  const [r, g, b] = rgb(nivel === 1 ? '#FFAA00' : '#FF5555'), d = pixelsDe(IMG.xp_barra, 0, 0, 182, 5), p = d.data;
  for (let k = 0; k < p.length; k += 4) {
    const brilho = Math.max(p[k], p[k + 1], p[k + 2]) / 0xF5 * 1.05;
    p[k] = par(Math.min(255, r * brilho * 255)); p[k + 1] = par(Math.min(255, g * brilho * 255)); p[k + 2] = par(Math.min(255, b * brilho * 255));
  }
  return BARRAS.set(nivel, telaDe(d));
}
function desenharBarra(g, u) {
  const [x, y] = u.barra, nivel = u.nivel === 1 || u.nivel === 2 ? u.nivel : 0;
  const cheia = par(118 * Math.min(Math.max(Number(u.pct) || 0, 0), 100) / 100), tinta = barraPintada(nivel);
  g.drawImage(IMG.xp_fundo, 0, 0, 117, 5, x, y, 117, 5);
  g.drawImage(IMG.xp_fundo, 181, 0, 1, 5, x + 117, y, 1, 5);
  if (cheia > 0) g.drawImage(tinta, 0, 0, Math.min(cheia, 117), 5, x, y, Math.min(cheia, 117), 5);
  if (cheia >= 118) g.drawImage(tinta, 181, 0, 1, 5, x + 117, y, 1, 5);
}

// -- letra do Minecraft (font/ascii.png: 16x16 letras de 8x8). Cada letra vai até a última
// coluna pintada (o espaço tem 3), 1 px entre elas; a sombra é a cor/4, 1 px pra direita e
// pra baixo. Na tela: 11/9 do tamanho, suavizada como o HighQuality do WPF.
let LARGURAS = null;
function larguraLetra(k) {
  if (!LARGURAS) {
    if (!IMG.fonte) return 0;
    LARGURAS = new Uint8Array(256);
    LARGURAS[32] = 3;
    const px = IMG.fonte.pixels, W = IMG.fonte.width;
    for (let c = 33; c < 256; c++) {
      const cx = (c % 16) * 8, cy = Math.floor(c / 16) * 8;
      for (let x = 7; x >= 0 && !LARGURAS[c]; x--) for (let y = 0; y < 8; y++) if (px[(cy + y) * W + cx + x] >>> 24) { LARGURAS[c] = x + 1; break; }
    }
  }
  return LARGURAS[k] || 0;
}
const LETREIROS = cache(200);
// o texto pronto pra colar na tela: { img, kx, ky (onde o texto começa dentro dela, px), w (largura em DIPs) }
function letreiro(texto, cor, esc) {
  const chave = esc + ' ' + cor + ' ' + texto;
  const pronto = LETREIROS.get(chave);
  if (pronto) return pronto;
  const codigos = [...texto].map(c => c.charCodeAt(0)).filter(k => k < 256);
  let W = 1;
  for (const k of codigos) W += larguraLetra(k) + 1;
  // 1 px transparente em volta: na suavização a borda esmaece pra fora em vez de cortar
  const base = tela(W + 2, 11), px = base.pixels, fonte = IMG.fonte.pixels, [r, g, b] = rgb(cor);
  for (const [d, brilho] of [[1, 0.25], [0, 1]]) {  // a sombra, e a letra por cima
    const p = ((255 << 24) | (par(r * brilho * 255) << 16) | (par(g * brilho * 255) << 8) | par(b * brilho * 255)) >>> 0;
    let x0 = d;
    for (const k of codigos) {
      const cx = (k % 16) * 8, cy = Math.floor(k / 16) * 8, lw = larguraLetra(k);
      for (let y = 0; y < 8; y++) for (let x = 0; x < lw; x++) if (fonte[(cy + y) * 128 + cx + x] >>> 24) px[(y + d + 1) * (W + 2) + x0 + x + 1] = p;
      x0 += lw + 1;
    }
  }
  const w = par(W * 11 / 9), kx = w * esc / W, ky = 11 * esc / 9;
  return LETREIROS.set(chave, { img: reamostrar(base, (W + 2) * kx, 11 * ky), kx, ky, w });
}
// encostado à direita (ou à esquerda) da caixa e centrado na altura, em pixel inteiro da tela
function escrever(g, texto, cor, caixa, direita, esc) {
  if (texto == null || texto === '' || !caixa) return;
  const L = letreiro(String(texto), cor, esc);
  const x = direita ? caixa[0] + caixa[2] - L.w : caixa[0], y = caixa[1] + (caixa[3] - 11) / 2;
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(L.img, Math.round(x * esc - L.kx), Math.round(y * esc - L.ky));
  g.restore();
}

const COR_PCT = ['#80FF20', '#FFAA00', '#FF5555'];  // normal, >= 80%, >= 95%
// o cartão inteiro: a moldura sempre (sem textura, nas cores da janelinha); bolinhas,
// números e barra só com as 6 texturas (sem elas a janelinha desenha os dela)
function desenharEnfeites(g, host, T) {
  if (!host.cartao) return;
  const esc = host.escala || 1;
  desenharMoldura(g, host.cartao, esc);
  if (!prontos()) return;
  for (const l of host.linhas || []) {
    if (l.bola) g.drawImage(orbeDaSituacao(l.sit, l.cor, T), l.bola[0], l.bola[1], l.bola[2], l.bola[3]);
    if (l.tempo) escrever(g, l.tempo.txt, l.cor, l.tempo.caixa, true, esc);
  }
  for (const u of host.uso || []) {
    if (u.barra) desenharBarra(g, u);
    if (u.rotulo) escrever(g, u.rotulo.txt, '#9CA3AF', u.rotulo.caixa, false, esc);
    if (u.pctTxt) escrever(g, u.pctTxt.txt, COR_PCT[u.nivel] || COR_PCT[0], u.pctTxt.caixa, true, esc);
    if (u.falta) escrever(g, u.falta.txt, '#6B7280', u.falta.caixa, true, esc);
  }
}

module.exports = { TEXTURAS, prontos, desenharEnfeites, larguraLetra, letreiro };
