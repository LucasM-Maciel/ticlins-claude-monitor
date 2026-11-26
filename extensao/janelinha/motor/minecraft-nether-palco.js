'use strict';
// O palco da cena do portal do Nether (minecraft-nether.js): o Nether que abre ACIMA do cartão, como o
// palco dos épicos do Elden e do Akatsuki, e o Ghast que mora nele.
//  - desenhaPalco: o cenário do bioma (netherrack: mar de lava e a fortaleza ao longe; soul sand:
//    vale azul, ossos e almas subindo; basalto: colunas e cinza caindo), o teto de netherrack com
//    glowstone e a luz que cai dele, e a moldura de netherrack. Em camadas: o fundo pronto (cache
//    por tamanho e bioma), o que se mexe (lava, fogo, brasas) e a luz;
//  - desenhaGhast / desenhaBola: o Ghast (a cara da textura do jogo, os 9 tentáculos balançando) e a
//    bola de fogo girando, com o rastro.
// Referencial do palco: x de 0 (esquerda do cartão) a cw, y de 0 (borda de cima do cartão) pra cima
// (negativo) até -HJ. Nada aqui desenha abaixo de y = 0: o cartão e os nomes nunca ficam cobertos.
const { lim, rng, IMG, cache, tela, tingida } = require('./comum');

const fatia = (t, a, b) => lim((t - a) / (b - a), 0, 1);
const rgbDe = h => { const n = parseInt(h.slice(1, 7), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const mix = (a, b, u) => a.map((v, i) => Math.round(v + (b[i] - v) * u));
const css = c => `rgb(${c[0]},${c[1]},${c[2]})`;
const cssA = (h, a) => { const c = rgbDe(h); return `rgba(${c[0]},${c[1]},${c[2]},${+a.toFixed(3)})`; };
const par = n => Math.max(2, Math.round(n / 2) * 2);
// cor numa escada de paradas [[u, [r,g,b]], ...]
function corEm(paradas, u) {
  u = lim(u, 0, 1);
  for (let i = 1; i < paradas.length; i++) if (u <= paradas[i][0]) return mix(paradas[i - 1][1], paradas[i][1], (u - paradas[i - 1][0]) / (paradas[i][0] - paradas[i - 1][0] || 1));
  return paradas[paradas.length - 1][1];
}
// o quadro q de uma textura animada (16 x 16·n)
const nQuadros = img => Math.max(1, Math.floor(img.height / img.width));
const yQuadro = (img, q) => { const n = nQuadros(img); return ((q % n) + n) % n * img.width; };

// ---------- medidas do palco ----------
// P = { cw, HJ, OX, OY, e }: a largura do cartão, a altura do palco (a mesma dos épicos: o espaço
// acima do cartão, de 72 a 184), a origem do cartão na janela e a escala
function montarPalco(m) {
  const c = m.host.cartao, e = m.host.escala || 1;
  return { cw: Math.round(c[2]), HJ: Math.round(lim(c[1] - 14, 72, 184)), OX: c[0], OY: c[1], e };
}
// o corpo do Ghast: a cara da textura tem 32 texels; 32, 48 ou 64 px (1x, 1,5x, 2x) pra o pixel sair parelho
const GHAST_LADO = P => (P.HJ < 110 ? 32 : P.HJ < 150 ? 48 : 64);
// o teto, o mar/chão e o horizonte, em px do palco
function medidas(P) {
  const { HJ } = P;
  return { teto: lim(Math.round(HJ * 0.08), 6, 12), mar: lim(Math.round(HJ * 0.11), 14, 20), lado: GHAST_LADO(P) };
}

// ---------- os biomas ----------
const BIOMAS = {
  netherrack: {
    ceu: [[0, [12, 2, 6]], [0.4, [38, 8, 10]], [0.72, [92, 24, 10]], [1, [178, 72, 18]]],
    serras: [['#3A0C12', '#5C1A1C', 0.34, 0.1], ['#2B080E', '#46130F', 0.2, 0.08]],
    bruma: '#C03A12', luz: '#FF5A14', luzForca: 0.6, glow: '#FF9A3A', tinta: null,
  },
  almas: {
    ceu: [[0, [3, 8, 16]], [0.45, [8, 28, 46]], [0.78, [16, 64, 88]], [1, [44, 124, 140]]],
    serras: [['#0E2A3A', '#17475A', 0.34, 0.1], ['#091D2A', '#103244', 0.2, 0.08]],
    bruma: '#5FD4E8', luz: '#3FD0FF', luzForca: 0.5, glow: '#FFE08A', tinta: [92, 124, 196],
  },
  basalto: {
    ceu: [[0, [10, 8, 18]], [0.45, [30, 22, 42]], [0.78, [66, 42, 60]], [1, [128, 66, 54]]],
    serras: [['#2C2438', '#44395A', 0.34, 0.1], ['#1E182A', '#30283F', 0.2, 0.08]],
    bruma: '#B07A8A', luz: '#FF6A28', luzForca: 0.4, glow: '#FFC264', tinta: [156, 124, 170],
  },
};

// ---------- peças do fundo (tudo em px locais: y de 0 no teto do palco a HJ no cartão) ----------
const BAYER = [[0, 2], [3, 1]];
// o céu em faixas de 8 px, com uma trama (dither de 2 px) entre uma faixa e a seguinte: o raster não
// tem gradiente linear e a trama é o jeito de pixel art de suavizar
function ceuEm(k, cw, ate, paradas) {
  const faixa = 8;
  for (let y = 0; y < ate; y += 2) {
    const b = Math.floor(y / faixa), f = ((y % faixa) / 2) / 4;
    k.fillStyle = css(corEm(paradas, b * faixa / Math.max(1, ate - 1)));
    k.fillRect(0, y, cw, 2);
    if (f > 0) {
      k.fillStyle = css(corEm(paradas, (b + 1) * faixa / Math.max(1, ate - 1)));
      for (let x = 0, cx = 0; x < cw; x += 2, cx++) if ((BAYER[(y >> 1) & 1][cx & 1] + 0.5) / 4 < f) k.fillRect(x, y, 2, 2);
    }
  }
}
// uma serra ao longe: o topo (px a partir do teto), a variação, e o fio de luz de cima
function serra(k, cw, HJ, topo, amp, semente, cor, fio) {
  const r = rng(semente), f = [r() * 6.28, r() * 6.28, r() * 6.28], per = [26 + r() * 20, 12 + r() * 8, 5 + r() * 3];
  let anterior = null;
  for (let x = 0; x < cw; x += 2) {
    const h = topo + amp * (0.5 * Math.sin(x / per[0] + f[0]) + 0.3 * Math.sin(x / per[1] + f[1]) + 0.2 * Math.sin(x / per[2] + f[2]));
    const y = par(h);
    k.fillStyle = cor; k.fillRect(x, y, 2, HJ - y);
    if (fio) { k.fillStyle = fio; k.fillRect(x, y, 2, 2); if (anterior !== null && Math.abs(y - anterior) > 2) k.fillRect(x, Math.min(y, anterior), 2, Math.abs(y - anterior) + 2); }
    anterior = y;
  }
}
// uma textura 1x1 em tiras repetidas dentro de um retângulo (px locais)
function ladrilha(k, img, x, y, w, h, lado = 16, ox = 0) {
  if (!img) return;
  const s = img.width / 16;
  for (let ty = y; ty < y + h; ty += lado) for (let tx = x - (((x - ox) % lado) + lado) % lado; tx < x + w; tx += lado) {
    const a0 = Math.max(x, tx), a1 = Math.min(x + w, tx + lado), b0 = Math.max(y, ty), b1 = Math.min(y + h, ty + lado);
    if (a1 <= a0 || b1 <= b0) continue;
    k.drawImage(img, (a0 - tx) / lado * 16 * s, (b0 - ty) / lado * 16 * s, (a1 - a0) / lado * 16 * s, (b1 - b0) / lado * 16 * s, a0, b0, a1 - a0, b1 - b0);
  }
}
// uma camada com forma de silhueta preenchida de textura: a silhueta (retângulos) recorta a textura
function recortada(cw, HJ, retangulos, img, lado, escurece, fogo) {
  const sil = tela(cw, HJ), a = sil.getContext('2d');
  a.fillStyle = '#000';
  for (const [x, y, w, h] of retangulos) a.fillRect(x, y, w, h);
  const cam = tela(cw, HJ), k = cam.getContext('2d');
  ladrilha(k, img, 0, 0, cw, HJ, lado);
  k.globalCompositeOperation = 'destination-in'; k.drawImage(sil, 0, 0);
  k.globalCompositeOperation = 'source-atop';
  k.fillStyle = escurece; k.fillRect(0, 0, cw, HJ);
  if (fogo) for (let i = 0; i < 16; i++) { k.fillStyle = cssA(fogo, 0.3 * (1 - i / 16)); k.fillRect(0, HJ - 2 * (i + 1) - 0, cw, 2); }
  return { cam, sil };
}

// a fortaleza do Nether, ao longe à direita: muro com arcos, ameias, torres com as bocas acesas e uma
// ponte de arcos; mais atrás, uma segunda fortaleza apagada, pra dar profundidade
function fortaleza(k, cw, HJ, hz, tijolo) {
  const hf = lim(HJ / 184, 0.5, 1), base = hz + 2, janelas = [];
  const torre = (R, x, w, h) => {
    const alt = par(h * hf), cab = par(8 * hf);
    R.push([x, base - alt, w, alt]);                                  // o corpo
    R.push([x - 4, base - alt - cab, w + 8, cab]);                    // o cabeção que passa pra fora
    for (let i = 0; i < w + 8; i += 8) R.push([x - 4 + i, base - alt - cab - par(4 * hf), 4, par(4 * hf)]);  // as ameias
    for (let y = base - alt + par(12 * hf); y < base - par(28 * hf); y += par(18 * hf)) janelas.push([x + Math.round(w / 2) - 2, y, 4, par(8 * hf)]);
  };
  // 1) a de trás: baixa, no meio do palco, bem apagada
  const trasR = [], x1 = par(cw * 0.2);
  trasR.push([x1, base - par(18 * hf), par(cw * 0.3), par(18 * hf)]);
  for (let x = x1; x < x1 + cw * 0.3; x += 10) trasR.push([x, base - par(22 * hf), 5, par(4 * hf)]);
  for (const [dx, w, h] of [[20, 14, 38], [par(cw * 0.3) - 30, 16, 30]]) { const alt = par(h * hf); trasR.push([x1 + dx, base - alt, w, alt], [x1 + dx - 3, base - alt - par(6 * hf), w + 6, par(6 * hf)]); }
  const ct = recortada(cw, HJ, trasR, tijolo, 8, 'rgba(30,6,14,0.62)', '#FF5A14');
  k.drawImage(ct.cam, 0, 0);
  // 2) a da frente, à direita
  const x0 = par(cw * 0.52), R = [], furos = [];
  const muro = par(28 * hf);
  R.push([x0, base - muro, cw - x0 + 4, muro]);
  for (let x = x0; x < cw; x += 8) R.push([x, base - muro - par(4 * hf), 4, par(4 * hf)]);
  const xa = x0 + 30, wa = 26, xb = x0 + 118, wb = 22;
  torre(R, xa, wa, 78); torre(R, xb, wb, 56); torre(R, cw - 26, 26, 66);
  // a ponte de arcos entre as duas primeiras torres
  const ya = base - par(46 * hf), pa = xa + wa, pb = xb, nArc = 3, lar = (pb - pa) / nArc;
  R.push([pa, ya, pb - pa, base - ya]);
  for (let x = pa + 2; x < pb - 2; x += 4) R.push([x, ya - par(4 * hf), 2, par(4 * hf)]);   // o corrimão
  for (let i = 0; i < nArc; i++) furos.push([pa + lar * (i + 0.5), ya + par(10 * hf) + 4, Math.max(5, Math.floor(lar / 2) - 3)]);
  for (let i = 0; i < 2; i++) furos.push([x0 + 4 + i * 0, base, 0]);
  const sil = tela(cw, HJ), a = sil.getContext('2d');
  a.fillStyle = '#000';
  for (const [x, y, w, h] of R) a.fillRect(x, y, w, h);
  a.globalCompositeOperation = 'destination-out';
  for (const [cx, cy, r] of furos) if (r > 0) { a.fillRect(Math.round(cx - r), Math.round(cy), r * 2, base - Math.round(cy) - 2); a.beginPath(); a.arc(cx, cy, r, Math.PI, 2 * Math.PI); a.fill(); }
  const cam = tela(cw, HJ), c = cam.getContext('2d');
  ladrilha(c, tijolo, 0, 0, cw, HJ, 8);
  c.globalCompositeOperation = 'destination-in'; c.drawImage(sil, 0, 0);
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = 'rgba(34,8,18,0.34)'; c.fillRect(0, 0, cw, HJ);
  for (let i = 0; i < 22; i++) { c.fillStyle = cssA('#FF5A14', 0.4 * (1 - i / 22)); c.fillRect(0, HJ - 2 * (i + 1) - 4, cw, 2); }  // o clarão da lava por baixo
  c.globalCompositeOperation = 'source-over';
  // cada torre mais clara no lado da frente e um fio no topo de cada peça
  c.fillStyle = 'rgba(170,76,86,0.5)';
  for (const [x, y, w] of R) c.fillRect(x, y, w, 1);
  k.drawImage(cam, 0, 0);
  // as janelas: um halo, o brilho e a luz mais forte em cima
  for (const [x, y, w, h] of janelas) {
    k.fillStyle = 'rgba(255,130,40,0.2)'; k.fillRect(x - 3, y - 3, w + 6, h + 6);
    k.fillStyle = '#FF8A24'; k.fillRect(x, y + 2, w, h - 2); k.fillRect(x + 1, y, w - 2, 2);
    k.fillStyle = '#FFE08A'; k.fillRect(x + 1, y + 2, w - 2, 3);
  }
}

// o teto: netherrack com a borda de baixo irregular (estalactites) e os cachos de glowstone
function teto(k, cw, HJ, med, tinta, semente) {
  const camT = tela(cw, HJ), t = camT.getContext('2d'), r = rng(semente), n = Math.ceil(cw / 2), d = new Array(n);
  for (let i = 0; i < n; i++) d[i] = med.teto + Math.floor(r() * 2);
  for (let i = 0; i < n; i++) if (r() < 0.1) {      // uma estalactite: um pico com 3 a 5 células de pé
    const alt = par(3 + r() * (HJ < 110 ? 5 : 12)), lar = 1 + Math.floor(r() * 2);
    for (let j = -lar - 1; j <= lar + 1; j++) if (i + j >= 0 && i + j < n) d[i + j] = Math.max(d[i + j], med.teto + Math.round(alt * (1 - Math.abs(j) / (lar + 2))));
  }
  const img = IMG.netherrack;
  for (let i = 0; i < n; i++) {
    if (img) { const s = img.width / 16, x = i * 2; let y = 0; while (y < d[i]) { const h = Math.min(16 - (y % 16), d[i] - y); t.drawImage(img, (x % 16) * s, (y % 16) * s, 2 * s, h * s, x, y, 2, h); y += h; } }
    else { t.fillStyle = '#6B2A2A'; t.fillRect(i * 2, 0, 2, d[i]); }
  }
  t.globalCompositeOperation = 'source-atop';
  t.fillStyle = 'rgba(0,0,0,0.38)'; t.fillRect(0, 0, cw, HJ);
  if (tinta) { t.fillStyle = cssA('#' + tinta.map(v => v.toString(16).padStart(2, '0')).join(''), 0.5); t.fillRect(0, 0, cw, HJ); }  // source-atop: só onde há teto (o multiply do raster pinta até no vazio)
  t.globalCompositeOperation = 'source-over';
  // a sombra na borda de baixo (1 célula mais escura) e o fio claro no encontro com a luz
  for (let i = 0; i < n; i++) { t.fillStyle = 'rgba(8,0,2,0.55)'; t.fillRect(i * 2, d[i] - 2, 2, 2); }
  // os cachos de glowstone: 2 blocos de 8 px lado a lado e 1 pendurado (só 1 bloco de fundo no palco baixo)
  const glows = [];
  for (const f of [0.14, 0.33, 0.5]) {
    const cx = par(cw * f + (r() - 0.5) * 10), i = Math.min(n - 1, Math.floor(cx / 2)), base = Math.max(d[i], d[Math.max(0, i - 4)], d[Math.min(n - 1, i + 4)]) - 2;
    const blocos = HJ < 110 ? [[0, 0]] : [[0, 0], [8, 0], [4, 8]];
    for (const [bx, by] of blocos) {
      if (IMG.glowstone) t.drawImage(IMG.glowstone, 0, 0, 16, 16, cx - 8 + bx, base + by, 8, 8);
      else { t.fillStyle = '#E0A040'; t.fillRect(cx - 8 + bx, base + by, 8, 8); }
    }
    glows.push([cx, base + (HJ < 110 ? 4 : 10)]);
  }
  k.drawImage(camT, 0, 0);
  return glows;
}

// ---------- o fundo de cada bioma ----------
// devolve { atras: o que vai por trás do Ghast, frente: o que passa na frente dele (teto, chão), luz: o brilho somado }
const FUNDOS = cache(12);
function fundo(P, bioma) {
  const chave = `${P.cw}x${P.HJ}x${bioma}`, pronto = FUNDOS.get(chave);
  if (pronto && pronto.tem === !!(IMG.lava && IMG.tijolo_nether && IMG.glowstone)) return pronto;
  const { cw, HJ } = P, B = BIOMAS[bioma] || BIOMAS.netherrack, med = medidas(P), hz = HJ - med.mar, semente = cw * 31 + HJ * 7 + bioma.length;
  const atras = tela(cw, HJ), a = atras.getContext('2d');
  const frente = tela(cw, HJ), f = frente.getContext('2d');
  const luz = tela(cw, HJ), l = luz.getContext('2d');
  ceuEm(a, cw, hz + 6, B.ceu);
  // estrelas de cinza/brasa no alto (almas: brilhos azuis), pra o céu não ficar vazio
  const r = rng(semente);
  for (let i = 0; i < 22; i++) { a.fillStyle = cssA(B.luz, 0.15 + r() * 0.35); a.fillRect(2 * Math.floor(r() * cw / 2), 2 * Math.floor(r() * hz * 0.55 / 2), 2, 2); }
  for (const [cor, fio, topo, amp] of B.serras) serra(a, cw, HJ, par(hz - HJ * topo), HJ * amp, semente + cor.length * 17 + Math.round(topo * 100), cor, fio);
  if (bioma === 'netherrack') fortaleza(a, cw, HJ, hz, IMG.tijolo_nether);
  if (bioma === 'almas') ossos(a, cw, HJ, hz, med);
  if (bioma === 'basalto') colunas(a, cw, HJ, hz, med, semente);
  // a bruma: uma faixa mais clara perto do horizonte, em 3 degraus
  for (let i = 0; i < 3; i++) { a.fillStyle = cssA(B.bruma, 0.07 + i * 0.03); a.fillRect(0, hz - 14 + i * 4, cw, 14 - i * 4 + 4); }
  // o chão (almas e basalto; no netherrack é a lava, que se mexe)
  if (bioma === 'almas') chaoAlmas(f, cw, HJ, hz, med, semente);
  if (bioma === 'basalto') chaoBasalto(f, cw, HJ, hz, med, semente);
  const glows = teto(f, cw, HJ, med, B.tinta, semente + 5);
  // a luz: o clarão do horizonte (uma elipse) e a luz de baixo de cada cacho de glowstone
  l.save(); l.translate(cw / 2, hz); l.scale(cw / (HJ * 1.5), 1);
  const R1 = HJ * 0.85, g1 = l.createRadialGradient(0, 0, 2, 0, 0, R1);
  g1.addColorStop(0, cssA(B.luz, B.luzForca)); g1.addColorStop(1, cssA(B.luz, 0));
  l.fillStyle = g1; l.fillRect(-R1 * 2, -R1, R1 * 4, R1 * 2);
  l.restore();
  for (const [gx, gy] of glows) {
    const R2 = Math.max(22, HJ * 0.26), g2 = l.createRadialGradient(gx, gy, 2, gx, gy, R2);
    g2.addColorStop(0, cssA(B.glow, 0.36)); g2.addColorStop(1, cssA(B.glow, 0));
    l.fillStyle = g2; l.fillRect(gx - R2, gy - R2, R2 * 2, R2 * 2);
  }
  // almas e basalto: o chão é pedra/areia escura e a luz soma (lighter) por cima; sem isto ele lava de claro e o
  // Clawd perde o contraste. Apaga quase toda a luz da faixa do chão (a lava do netherrack fica como está)
  if (bioma !== 'netherrack') { l.globalCompositeOperation = 'destination-out'; l.fillStyle = 'rgba(0,0,0,0.82)'; l.fillRect(0, hz + 2, cw, HJ - hz); l.globalCompositeOperation = 'source-over'; }
  return FUNDOS.set(chave, { atras, frente, luz, glows, hz, med, tem: !!(IMG.lava && IMG.tijolo_nether && IMG.glowstone) });
}

// almas: a caixa torácica de um bicho enorme enterrada na areia, com a coluna, e um crânio de longe
function ossos(k, cw, HJ, hz, med) {
  const cor = '#8C93A0', luz = '#C4CCD6', x0 = par(cw * 0.1), n = 7, hf = lim(HJ / 184, 0.5, 1);
  const chao = hz + 2, passo = Math.round(cw * 0.5 / n);
  k.fillStyle = cor; k.fillRect(x0 - 6, chao - 4, passo * n + 14, 4);  // a coluna
  for (let i = 0; i < n; i++) {
    const x = x0 + i * passo, alt = Math.round((18 + 34 * Math.sin(Math.PI * (i + 0.7) / (n + 0.4))) * hf), tipo = 2;
    for (let y = 0; y < alt; y += 2) {  // a costela: um arco que sobe e se curva pra frente
      const u = y / alt, dx = Math.round(Math.sin(u * 1.45) * alt * 0.38 / 2) * 2;
      k.fillStyle = cor; k.fillRect(x + dx, chao - 4 - y - 2, tipo + 2, 2);
      k.fillStyle = luz; k.fillRect(x + dx, chao - 4 - y - 2, 2, 2);
    }
  }
  // o crânio: um bloco com 2 órbitas, à direita, mais longe
  const sx = par(cw * 0.78), sy = chao - par(14 * hf);
  k.fillStyle = '#6C7482'; k.fillRect(sx, sy - 8, 22, 16); k.fillRect(sx + 20, sy - 4, 8, 10);
  k.fillStyle = '#05101A'; k.fillRect(sx + 4, sy - 4, 6, 6); k.fillRect(sx + 13, sy - 4, 6, 6);
  k.fillStyle = '#A8B0BC'; k.fillRect(sx, sy - 8, 22, 2);
  for (let i = 0; i < 5; i++) { k.fillStyle = 'rgba(40,110,150,0.08)'; k.fillRect(0, chao - HJ * 0.5 + i * HJ * 0.08, cw, HJ * 0.5 - i * HJ * 0.08); }  // a névoa por cima dos ossos, em degraus
}
// basalto: as colunas de rocha que sobem (a textura do lado do jogo, escurecida pela distância), mais altas no meio
function colunas(k, cw, HJ, hz, med, semente) {
  const r = rng(semente + 9), base = hz + 2, camada = tela(cw, HJ), c = camada.getContext('2d'), sil = tela(cw, HJ), s = sil.getContext('2d');
  s.fillStyle = '#000';
  const cols = [];
  for (let x = -4; x < cw; ) {
    const w = 10 + Math.floor(r() * 3) * 2, alt = par((10 + r() * HJ * 0.38) * (0.7 + 0.6 * Math.sin(Math.PI * Math.min(1, Math.max(0, x / cw)))));
    cols.push([x, base - alt, w, alt]); s.fillRect(x, base - alt, w, alt);
    x += w + (r() < 0.35 ? -2 : 0) + Math.floor(r() * 2) * 2;
  }
  ladrilha(c, IMG.basalto_lado, 0, 0, cw, HJ, 16);
  c.globalCompositeOperation = 'destination-in'; c.drawImage(sil, 0, 0);
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = 'rgba(18,10,28,0.5)'; c.fillRect(0, 0, cw, HJ);
  for (const [x, y, w] of cols) {   // o lado escuro de cada coluna (a face da direita) e a tampa clara
    c.fillStyle = 'rgba(8,4,14,0.4)'; c.fillRect(x + w - Math.floor(w / 3), y, Math.floor(w / 3), base - y);
    c.fillStyle = 'rgba(190,170,210,0.38)'; c.fillRect(x, y, w, 2);
  }
  for (let i = 0; i < 12; i++) { c.fillStyle = cssA('#FF6A28', 0.2 * (1 - i / 12)); c.fillRect(0, HJ - 2 * (i + 1), cw, 2); }
  k.drawImage(camada, 0, 0);
}
function chaoAlmas(f, cw, HJ, hz, med, semente) {
  const r = rng(semente + 3), n = Math.ceil(cw / 2), alt = new Array(n);
  let h = med.mar - 4;
  for (let i = 0; i < n; i++) { h = lim(h + (r() < 0.3 ? (r() < 0.5 ? -2 : 2) : 0), med.mar - 8, med.mar - 2); alt[i] = h; }
  const cam = tela(cw, HJ), c = cam.getContext('2d');
  for (let i = 0; i < n; i++) if (IMG.areia_almas) {
    const s = IMG.areia_almas.width / 16, x = i * 2, y = HJ - alt[i];
    for (let yy = y; yy < HJ; ) { const hh = Math.min(16 - (yy % 16), HJ - yy); c.drawImage(IMG.areia_almas, (x % 16) * s, (yy % 16) * s, 2 * s, hh * s, x, yy, 2, hh); yy += hh; }
  } else { c.fillStyle = '#4A3A30'; c.fillRect(i * 2, HJ - alt[i], 2, alt[i]); }
  c.globalCompositeOperation = 'source-atop';  // (o multiply do raster pinta até no vazio: tinta com source-atop)
  c.fillStyle = 'rgba(70,110,210,0.55)'; c.fillRect(0, 0, cw, HJ);
  for (let i = 0; i < n; i++) { c.fillStyle = 'rgba(150,230,255,0.38)'; c.fillRect(i * 2, HJ - alt[i], 2, 2); c.fillStyle = 'rgba(2,10,24,0.4)'; c.fillRect(i * 2, HJ - alt[i] + 2, 2, 2); }
  c.fillStyle = 'rgba(2,8,20,0.28)'; c.fillRect(0, HJ - med.mar, cw, med.mar);
  f.drawImage(cam, 0, 0);
}
function chaoBasalto(f, cw, HJ, hz, med, semente) {
  const r = rng(semente + 4), n = Math.ceil(cw / 2), alt = new Array(n);
  let h = med.mar - 5;
  for (let i = 0; i < n; i++) { h = lim(h + (r() < 0.25 ? (r() < 0.5 ? -2 : 2) : 0), med.mar - 9, med.mar - 2); alt[i] = h; }
  const cam = tela(cw, HJ), c = cam.getContext('2d');
  for (let i = 0; i < n; i++) if (IMG.basalto_topo) {
    const s = IMG.basalto_topo.width / 16, x = i * 2, y = HJ - alt[i];
    for (let yy = y; yy < HJ; ) { const hh = Math.min(16 - (yy % 16), HJ - yy); c.drawImage(IMG.basalto_topo, (x % 16) * s, (yy % 16) * s, 2 * s, hh * s, x, yy, 2, hh); yy += hh; }
  } else { c.fillStyle = '#3A3444'; c.fillRect(i * 2, HJ - alt[i], 2, alt[i]); }
  c.globalCompositeOperation = 'source-atop';
  c.fillStyle = 'rgba(130,100,160,0.5)'; c.fillRect(0, 0, cw, HJ);
  for (let i = 0; i < n; i++) { c.fillStyle = 'rgba(210,190,230,0.3)'; c.fillRect(i * 2, HJ - alt[i], 2, 2); c.fillStyle = 'rgba(8,4,14,0.4)'; c.fillRect(i * 2, HJ - alt[i] + 2, 2, 2); }
  f.drawImage(cam, 0, 0);
}

// ---------- o que se mexe ----------
// netherrack: o mar de lava (a textura do jogo, animada, em 2 fileiras: a de trás mais baixa e escura)
function mar(g, P, T0, med) {
  const img = IMG.lava, { cw } = P;
  if (!img) return;
  const q = Math.floor(T0 * 5), y0 = -med.mar, h1 = Math.round(med.mar * 0.38), h2 = med.mar - h1;
  for (let x = 0; x < cw; x += 16) {
    g.drawImage(img, 0, yQuadro(img, q + (x >> 4) * 3), img.width, img.width, x, y0, Math.min(16, cw - x), h1);
    g.drawImage(img, 0, yQuadro(img, q + 7 + (x >> 4) * 5), img.width, img.width, x - 5, y0 + h1, 16, h2);
  }
  g.fillStyle = 'rgba(70,10,4,0.34)'; g.fillRect(0, y0, cw, h1);
  g.fillStyle = 'rgba(255,214,110,0.6)'; g.fillRect(0, y0, cw, 1);
  g.fillStyle = 'rgba(40,4,2,0.4)'; g.fillRect(0, y0 + h1, cw, 1);
}
// netherrack: a cachoeira de lava do teto ao mar (a textura rolando pra baixo)
function lavaQueda(g, P, T0, med, x) {
  const img = IMG.lava, { HJ } = P;
  if (!img) return;
  const alto = HJ - med.teto + 2 - med.mar, q = Math.floor(T0 * 5), desl = Math.floor(T0 * 14) % 16;
  g.save(); g.beginPath(); g.rect(x, -HJ + med.teto - 2, 8, alto + 2); g.clip();
  for (let y = -HJ + med.teto - 18 + desl; y < -med.mar; y += 16) g.drawImage(img, 0, yQuadro(img, q + (y >> 4)), img.width, img.width, x - 4, y, 16, 16);
  g.restore();
  g.fillStyle = 'rgba(255,224,130,0.5)'; g.fillRect(x, -HJ + med.teto, 1, alto); g.fillStyle = 'rgba(80,10,4,0.4)'; g.fillRect(x + 7, -HJ + med.teto, 1, alto);
}
// as ilhotas de netherrack em cima da lava, com fogo (netherrack) ou soul fire (almas)
function ilha(g, x, y, fogo, T0, alfaFogo = 1) {
  const img = IMG.netherrack;
  if (img) { g.drawImage(img, 0, 0, 16, 16, x, y, 16, 14); g.drawImage(img, 0, 0, 16, 16, x + 16, y + 5, 16, 9); }
  g.fillStyle = 'rgba(14,0,2,0.46)'; g.fillRect(x, y, 32, 14);
  g.fillStyle = 'rgba(255,170,90,0.4)'; g.fillRect(x, y, 16, 1); g.fillRect(x + 16, y + 5, 16, 1);
  g.fillStyle = 'rgba(255,90,20,0.32)'; g.fillRect(x, y + 11, 32, 3);
  if (fogo) chama(g, fogo, x + 2, y - 12, 12, T0, x, alfaFogo);
}
function chama(g, nome, x, y, lado, T0, sem, alfa = 1) {
  const img = IMG[nome];
  if (!img || alfa <= 0) return;
  g.save(); g.globalAlpha *= alfa;
  g.drawImage(img, 0, yQuadro(img, Math.floor(T0 * 16) + Math.round(sem * 3)), img.width, img.width, x, y, lado, lado);
  g.restore();
}
// brasas, almas e cinza: cada bioma tem as suas partículas, todas função do tempo
function particulas(g, P, bioma, T0, med) {
  const { cw, HJ } = P;
  if (bioma === 'netherrack') {
    for (let i = 0; i < 28; i++) {
      const per = 2.6 + (i % 5) * 0.55, u = ((T0 + i * 0.41) % per) / per, x = (i * 53.7 + Math.sin(T0 * 0.9 + i) * 7) % cw, y = -med.mar - u * HJ * 0.78;
      g.fillStyle = cssA(['#FF9A2E', '#FFD060', '#FF5A1A'][i % 3], 0.9 * (1 - u) * (u < 0.06 ? u / 0.06 : 1));
      g.fillRect(Math.round(x), Math.round(y), i % 4 ? 1 : 2, i % 4 ? 1 : 2);
    }
  } else if (bioma === 'almas') {
    for (let i = 0; i < 16; i++) {  // as almas: um ponto claro com a cauda, subindo devagar e se balançando
      const per = 4 + (i % 4) * 0.8, u = ((T0 + i * 0.77) % per) / per, x = (i * 71.3) % cw + Math.sin(T0 * 1.4 + i * 2) * 5, y = -med.mar - 4 - u * (HJ - med.mar - med.teto - 8), a = Math.sin(Math.PI * u);
      g.fillStyle = cssA('#9FEFFF', 0.85 * a); g.fillRect(Math.round(x), Math.round(y), 2, 2);
      g.fillStyle = cssA('#5CC8F0', 0.5 * a); g.fillRect(Math.round(x), Math.round(y) + 2, 2, 2); g.fillRect(Math.round(x) - 1, Math.round(y) + 4, 1, 2);
      g.fillStyle = cssA('#1E7CB4', 0.32 * a); g.fillRect(Math.round(x), Math.round(y) + 6, 2, 2);
    }
    for (let i = 0; i < 8; i++) {  // faíscas azuis do fogo
      const per = 1.8 + (i % 3) * 0.4, u = ((T0 + i * 0.5) % per) / per, x = (i * 97.7 + 30) % cw;
      g.fillStyle = cssA('#7DE0FF', 0.9 * (1 - u)); g.fillRect(Math.round(x), Math.round(-med.mar - u * 30), 1, 1);
    }
  } else {
    for (let i = 0; i < 36; i++) {  // a cinza caindo, de lado com o vento
      const vel = 9 + (i % 5) * 3, u = ((T0 * vel + i * 23.7) % (HJ + 8)) / (HJ + 8), x = ((i * 41.3 + T0 * (6 + i % 4) - u * 20) % (cw + 20) + cw + 20) % (cw + 20) - 10;
      g.fillStyle = i % 3 ? 'rgba(226,222,232,0.78)' : 'rgba(150,142,160,0.78)';
      g.fillRect(Math.round(x + Math.sin(T0 * 1.3 + i) * 2), Math.round(-HJ + u * HJ), i % 4 ? 1 : 2, i % 4 ? 1 : 2);
    }
    for (let i = 0; i < 6; i++) {  // fagulhas da lava
      const per = 2 + (i % 3) * 0.5, u = ((T0 + i * 0.6) % per) / per, x = (i * 83.1 + 20) % cw;
      g.fillStyle = cssA('#FF9A2E', 0.9 * (1 - u)); g.fillRect(Math.round(x), Math.round(-med.mar - u * 34), 1, 1);
    }
  }
}
// basalto: a poça de lava e os blocos de magma, brilhando
function lavaBasalto(g, P, T0, med) {
  const { cw } = P, img = IMG.lava, mg = IMG.magma, x0 = par(cw * 0.52), w = par(cw * 0.22), y = -med.mar + 5, h = 8, q = Math.floor(T0 * 5);
  if (img) {
    for (let x = x0; x < x0 + w; x += 16) g.drawImage(img, 0, yQuadro(img, q + (x >> 4) * 3), img.width, img.width, x, y, Math.min(16, x0 + w - x), h);
    g.fillStyle = 'rgba(70,10,4,0.3)'; g.fillRect(x0, y, w, 3); g.fillStyle = 'rgba(255,214,110,0.55)'; g.fillRect(x0, y, w, 1);
  }
  if (mg) for (const f of [0.12, 0.33, 0.9]) {
    const x = par(cw * f), n = nQuadros(mg), sy = ((Math.floor(T0 * 2.5) % n) * mg.width);
    g.drawImage(mg, 0, sy, mg.width, mg.width, x, -med.mar - 2, 12, 12);
    g.fillStyle = 'rgba(8,4,14,0.32)'; g.fillRect(x, -med.mar - 2, 12, 12);
    g.drawImage(mg, 0, sy, mg.width, mg.width, x, -med.mar - 2, 12, 5);
  }
}
// almas: o soul fire em cima da areia, em 5 pontos
function fogosAlmas(g, P, T0, med) {
  const { cw } = P;
  [0.08, 0.27, 0.55, 0.74, 0.93].forEach((f, i) => chama(g, 'fogo_almas', par(cw * f), -med.mar - 8, 11, T0, i * 5));
}

// ---------- o palco inteiro ----------
// ab (0..1): o quanto abriu (a cortina sobe de baixo pra cima, como nos épicos). T0: o relógio do mundo
// (as animações); cb = { atras(g), frente(g) }: o que a cena põe entre o cenário e o chão, e por cima de tudo
function desenhaPalco(g, P, bioma, ab, T0, cb = {}) {
  if (ab <= 0) return;
  const { cw, HJ, OX, OY, e } = P, B = BIOMAS[bioma] || BIOMAS.netherrack, F = fundo(P, bioma), med = F.med;
  const topo = Math.round(-HJ * ab * e) / e;
  g.save();
  g.setTransform(e, 0, 0, e, OX * e, OY * e);
  g.beginPath(); g.rect(0, topo, cw, -topo); g.clip();
  g.drawImage(F.atras, 0, -HJ, cw, HJ);
  if (bioma === 'netherrack') lavaQueda(g, P, T0, med, par(cw * 0.9));
  if (cb.atras) { g.save(); cb.atras(g); g.restore(); }
  if (bioma === 'netherrack') mar(g, P, T0, med);
  g.drawImage(F.frente, 0, -HJ, cw, HJ);
  if (bioma === 'netherrack') { ilha(g, par(cw * 0.47), -med.mar - 6, 'fogo', T0); ilha(g, par(cw * 0.8), -med.mar - 4, 'fogo', T0 + 0.3); }
  if (bioma === 'almas') fogosAlmas(g, P, T0, med);
  if (bioma === 'basalto') lavaBasalto(g, P, T0, med);
  if (cb.frente) { g.save(); cb.frente(g); g.restore(); }
  particulas(g, P, bioma, T0, med);
  // a luz de cima e do horizonte, somada, tremendo de leve
  g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha = 0.82 + 0.14 * Math.sin(T0 * 7) * Math.sin(T0 * 2.3);
  g.drawImage(F.luz, 0, -HJ, cw, HJ);
  g.restore();
  g.restore();
  // a moldura: netherrack nos lados e em cima, a de cima clara enquanto abre e fecha
  g.save(); g.setTransform(e, 0, 0, e, OX * e, OY * e);
  const tex = IMG.netherrack;
  for (const x of [0, cw - 3]) {
    if (tex) for (let y = Math.round(topo); y < 0; y += 16) g.drawImage(tex, (x % 16) * (tex.width / 16), 0, 3 * (tex.width / 16), 16 * (tex.width / 16), x, y, 3, Math.min(16, -y));
    else { g.fillStyle = '#6B2A2A'; g.fillRect(x, topo, 3, -topo); }
    g.fillStyle = 'rgba(10,0,2,0.55)'; g.fillRect(x + (x ? 2 : 0), topo, 1, -topo);
  }
  g.fillStyle = '#2A0A0C'; g.fillRect(0, topo, cw, 3);
  g.fillStyle = ab < 1 ? '#FF6A3D' : '#8C3A2E'; g.fillRect(0, topo, cw, 1);
  g.fillStyle = 'rgba(0,0,0,0.5)'; g.fillRect(0, topo + 3, cw, 1);
  g.restore();
}

// ---------- o Ghast ----------
// x, y: o meio de baixo do corpo (sem os tentáculos), no referencial do palco.
// est = { alfa, boca, balanco (s: o relógio do balanço), golpeado (0..1: vermelho) }
const FACES = cache(8);
function cara(img, boca) {
  const k = `${img.width}x${img.height}${boca ? 'b' : 'f'}`, pronta = FACES.get(k);
  if (pronta) return pronta;
  const s = img.width / 128, c = tela(32, 32);
  c.getContext('2d').drawImage(img, 32 * s, 32 * s, 32 * s, 32 * s, 0, 0, 32, 32);  // a cara da frente: u 32..64, v 32..64 (a textura é 128x64)
  return FACES.set(k, c);
}
// os 9 tentáculos, como o mob do jogo: colunas de blocos cor de pele, de comprimentos diferentes, que se
// balançam por segmento (cada bloco anda um pouco mais que o de cima, com a onda descendo). Os de trás
// (profundidade 2) vão mais escuros e são desenhados antes. (x0, y0): o canto de cima do corpo; L: o lado
const TENT_COMP = [7, 11, 8, 13, 9, 12, 8, 10, 6];     // em texels (·k px)
const TENT_PROF = [0, 2, 1, 2, 0, 1, 1, 0, 2];         // 0 = na frente, 2 = no fundo
function tentaculos(g, x0, y0, L, k, bal) {
  const larg = Math.max(2, Math.round(2.4 * k)), seg = Math.max(2, Math.round(2 * k)), topo = y0 + L - Math.round(2 * k);
  for (let prof = 2; prof >= 0; prof--) for (let i = 0; i < 9; i++) {
    if (TENT_PROF[i] !== prof) continue;
    const tx = x0 + Math.round((i + 0.5) * L / 9 - larg / 2), n = Math.max(2, Math.round(TENT_COMP[i] * k / seg)), esc = 1 - 0.16 * prof;
    let ant = 0;
    for (let s = 0; s < n; s++) {
      const u = s / (n - 1), dx = Math.round(Math.sin(bal * 2.6 + i * 1.9 - s * 0.7) * Math.min(2.4 * k, 0.4 * k * s));
      const c = mix([238, 232, 232], [172, 164, 170], u * 0.85 + (s % 2 ? 0.06 : 0)).map(v => Math.round(v * esc));
      const y = topo + s * seg, x = tx + dx, w = larg, xo = x;
      g.fillStyle = css(c); g.fillRect(xo, y, w, seg);
      if (w >= 3) {   // o lado de cá mais claro e o de lá mais escuro (volume de bloco)
        g.fillStyle = css(c.map(v => Math.min(255, v + 16))); g.fillRect(xo, y, 1, seg);
        g.fillStyle = css(c.map(v => Math.round(v * 0.78))); g.fillRect(xo + w - 1, y, 1, seg);
      }
      if (s > 0 && dx !== ant) { g.fillStyle = css(c.map(v => Math.round(v * 0.82))); g.fillRect(Math.min(x, tx + ant), y, Math.abs(dx - ant) + w, 1); }  // a emenda de um bloco no outro
      ant = dx;
    }
  }
}
function desenhaGhast(g, P, x, y, est = {}) {
  const img = est.boca && IMG.ghast_atira ? IMG.ghast_atira : IMG.ghast;
  if (!img) return;
  const L = GHAST_LADO(P), k = L / 32, alfa = est.alfa == null ? 1 : est.alfa, bal = est.balanco || 0, gol = est.golpeado || 0;
  if (alfa <= 0) return;
  const x0 = Math.round(x - L / 2), y0 = Math.round(y - L);
  g.save(); g.globalAlpha *= alfa;
  tentaculos(g, x0, y0, L, k, bal);
  // o corpo: a cara do jogo, em pixel duro
  const cr = cara(img, est.boca);
  g.drawImage(cr, 0, 0, 32, 32, x0, y0, L, L);
  if (gol > 0) { g.save(); g.globalAlpha *= gol; g.drawImage(tingida(cr, '#FF2A1A', 'ghast' + (est.boca ? 'b' : 'f')), 0, 0, 32, 32, x0, y0, L, L); g.restore(); }
  // o contorno e a sombra de baixo, pra ele descolar do fundo claro (a bruma) e do escuro
  g.fillStyle = 'rgba(30,8,16,0.5)'; g.fillRect(x0 - 1, y0, 1, L); g.fillRect(x0 + L, y0, 1, L); g.fillRect(x0, y0 - 1, L, 1);
  g.fillStyle = 'rgba(60,20,30,0.28)'; g.fillRect(x0, y0 + L - Math.round(2 * k), L, Math.round(2 * k));
  g.restore();
}
// a explosão do Ghast, como a do jogo: um clarão branco curto, a nuvem de fumaça em blocos quadrados
// (branca, depois cinza, depois escura) que se espalha subindo e some, e pedaços do corpo que caem.
// Função pura de da (s desde o golpe): sem sorteio, cada peça vem de um hash do seu número.
// (cx, cy): o meio do Ghast; lado: o lado do corpo
const hash01 = n => { n = Math.imul(n ^ (n >>> 15), 2246822519); n ^= n >>> 13; n = Math.imul(n, 3266489917); n ^= n >>> 16; return (n >>> 0) / 4294967296; };
const PEDACOS = ['#D8D0D2', '#BDB4B6', '#8E8488', '#BDB4B6'];
function desenhaExplosaoGhast(g, cx, cy, lado, da) {
  if (da < 0 || da > 1.3) return;
  const k = lado / 32, gr = Math.max(2, Math.round(2 * k)), sn = v => Math.round(v / gr) * gr;
  // o clarão: um quadrado branco que estoura e some em 0,18 s, com um halo quente em volta
  const fl = (1 - fatia(da, 0, 0.14)) ** 2;
  if (fl > 0.01) {
    const R = sn(lado * (0.4 + 0.45 * (1 - fl)));   // (sem halo em volta: um gradiente ou quadrado translúcido aparece como caixa)
    g.fillStyle = `rgba(255,255,248,${Math.min(1, fl * 1.6).toFixed(3)})`; g.fillRect(sn(cx - R), sn(cy - R), R * 2, R * 2);
  }
  // a nuvem: 34 blocos de fumaça que saem do corpo em todas as direções e sobem
  for (let i = 0; i < 34; i++) {
    const h1 = hash01(i * 7 + 1), h2 = hash01(i * 7 + 2), h3 = hash01(i * 7 + 3), h4 = hash01(i * 7 + 4), h5 = hash01(i * 7 + 5);
    const e = (da - h1 * 0.14) / (0.55 + h2 * 0.6);
    if (e < 0 || e >= 1) continue;
    const ang = h3 * 6.2832, vel = (0.2 + h4 * 0.7) * lado * 0.8, ease = 1 - (1 - e) * (1 - e);
    const x = cx + (h5 - 0.5) * lado * 0.6 + Math.cos(ang) * vel * ease, y = cy + (h1 - 0.5) * lado * 0.6 + Math.sin(ang) * vel * ease * 0.8 - 9 * k * e;
    const tam = Math.max(gr, sn((4 + h2 * 7) * k * (0.55 + 0.9 * ease) * (1 - 0.6 * fatia(e, 0.55, 1))));
    const c = e < 0.2 ? [255, 255, 255] : e < 0.45 ? [226, 226, 226] : e < 0.7 ? [178, 178, 178] : [120, 120, 124];
    g.save(); g.globalAlpha *= 1 - fatia(e, 0.72, 1);
    g.fillStyle = css(c); g.fillRect(sn(x - tam / 2), sn(y - tam / 2), tam, tam);
    g.fillStyle = css(c.map(v => Math.round(v * 0.74))); g.fillRect(sn(x - tam / 2) + tam - gr, sn(y - tam / 2) + gr, gr, tam - gr); g.fillRect(sn(x - tam / 2), sn(y - tam / 2) + tam - gr, tam, gr);   // o lado de baixo e da direita, mais escuros
    g.restore();
  }
  // os pedaços do corpo (e umas brasas): saltam e caem
  for (let i = 0; i < 12; i++) {
    const h1 = hash01(i * 5 + 101), h2 = hash01(i * 5 + 102), h3 = hash01(i * 5 + 103), h4 = hash01(i * 5 + 104);
    const vida = 0.7 + h4 * 0.5;
    if (da >= vida) continue;
    const x = cx + (h1 - 0.5) * lado * 0.4 + (h2 - 0.5) * 2 * 80 * k * da, y = cy + (h3 - 0.5) * lado * 0.3 - (30 + h2 * 80) * k * da + 230 * k * da * da, tam = Math.max(gr, sn((2 + h3 * 3) * k));
    g.save(); g.globalAlpha *= 1 - fatia(da, vida * 0.7, vida);
    g.fillStyle = i % 4 === 3 ? '#FF9A2E' : PEDACOS[(i * 3 + 1) % 4]; g.fillRect(sn(x), sn(y), i % 4 === 3 ? gr : tam, i % 4 === 3 ? gr : tam);
    g.restore();
  }
}
// a bola de fogo (item/fire_charge, 16x16): gira, com o halo de luz e as brasas do rastro
function desenhaBola(g, x, y, t, o = {}) {
  const lado = o.lado || 12, ang = t * 9, branca = o.branca || 0;
  if (o.rastro) for (let i = o.rastro.length - 1; i >= 0; i--) {  // [[x, y], ...] do mais novo pro mais velho
    const [rx, ry] = o.rastro[i], a = (1 - i / o.rastro.length) * 0.55, s = lado * (0.7 - 0.5 * i / o.rastro.length);
    g.fillStyle = cssA(branca > 0.5 ? '#FFF0C0' : i % 2 ? '#FF6A1A' : '#FFB030', a); g.fillRect(Math.round(rx - s / 2), Math.round(ry - s / 2), Math.max(1, Math.round(s)), Math.max(1, Math.round(s)));
  }
  g.save(); g.globalCompositeOperation = 'lighter';
  const R = lado * 2.2, gr = g.createRadialGradient(x, y, 1, x, y, R);
  gr.addColorStop(0, cssA(branca > 0.5 ? '#FFF2C0' : '#FF8A2A', 0.62)); gr.addColorStop(1, cssA('#FF5A14', 0));
  g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2);
  g.restore();
  if (IMG.bola_fogo) {
    g.save(); g.translate(x, y); g.rotate(ang);
    g.drawImage(IMG.bola_fogo, 0, 0, IMG.bola_fogo.width, IMG.bola_fogo.height, -lado / 2, -lado / 2, lado, lado);
    g.restore();
  } else { g.fillStyle = '#FF8A1A'; g.fillRect(Math.round(x - lado / 2), Math.round(y - lado / 2), lado, lado); }
}

module.exports = { montarPalco, desenhaPalco, desenhaGhast, desenhaBola, desenhaExplosaoGhast, GHAST_LADO, medidas, BIOMAS: Object.keys(BIOMAS) };
