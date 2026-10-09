'use strict';
// Tema Dragon Ball: o que enfeita o cartão (prévia 3, escolhas do dono): bolinha = esfera com
// halo da cor da situação (anel mais grosso que na prévia, que ficou ilegível em 1x), borda =
// nuvem voadora, barra = barra de ki (+ "MAIS DE 8000!"), números = fonte do visor; e as 7
// esferas no canto com o dragão serpente. Coordenadas: as da janela, em DIPs.
const { lim, sai, tela, cache, arte, tingida, rgba, reamostrar } = require('./comum');
const { trilha } = require('./clawd');
const { disco, impacto, ESTRELA3, largPx, textoPx } = require('./dragonball-arte');

// a cor que a janelinha mandou ('#RRGGBB'); outra coisa, a reserva (a mistura da sombra precisa do hex)
const corHex = (c, reserva) => (/^#[0-9a-f]{6}$/i.test(c) ? c : reserva);

// ---------- texto em pixel da tela ----------
// A fonte do visor é desenhada em 1x e levada pro tamanho da tela 1x por texto: em escala
// inteira pixel duro; em escala quebrada (1,25) suavizada, senão o traço de 1 px sai torto.
const LETREIROS = cache(200);
function pronta(chave, e, desenhar) {
  const k0 = chave + '@' + e;
  const feita = LETREIROS.get(k0);
  if (feita) return feita;
  const base = desenhar();  // com 1 px transparente em volta
  let img;
  if (Number.isInteger(e)) {
    img = tela(base.width * e, base.height * e);
    img.getContext('2d').drawImage(base, 0, 0, base.width * e, base.height * e);
  } else img = reamostrar(base, base.width * e, base.height * e);
  return LETREIROS.set(k0, img);
}
function colar(g, img, x, y, e) {  // x, y = DIPs do canto (sem a margem de 1 px)
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  g.drawImage(img, Math.round((x - 1) * e), Math.round((y - 1) * e));
  g.restore();
}
function letreiro(txt, cor, e) {
  return pronta(txt + '|' + cor, e, () => {
    const c = tela(largPx(txt) + 3, 16);
    textoPx(c.getContext('2d'), txt, 1, 1, cor);
    return c;
  });
}
// caixa = [x, y, w, h] da janelinha; o texto (11 px) no meio da altura, à esquerda ou à direita
function escrever(g, e, txt, cor, caixa, direita) {
  if (!txt || !caixa) return;
  txt = String(txt);
  const [x, y, w, h] = caixa, x0 = direita ? x + w - largPx(txt) : x;
  colar(g, letreiro(txt, corHex(cor, '#E5E7EB'), e), x0, y + (h - 11) / 2, e);
}

// ---------- bolinhas: esfera (estrela vermelha) + halo da cor da situação ----------
const BOLA9 = ['..kkkkk..', '.kccccok.', 'kcwccoook', 'kcccooook', 'kccoooodk', 'kcooooodk', 'koooooddk', '.koodddk.', '..kkkkk..'];
const ESTRELA1 = [[4, 3], [3, 4], [4, 4], [5, 4], [4, 5]];
const COR_ESFERA = { k: '#8A3B0C', c: '#FCD34D', o: '#F59E0B', d: '#D97706', w: '#FFF7D6', s: '#DC2626' };
const ESFERA9 = BOLA9.map((l, y) => [...l].map((ch, x) => (ESTRELA1.some(([a, b]) => a === x && b === y) ? 's' : ch)).join(''));
// halo: 2 px cheios em volta da esfera (8 vizinhos, depois 4) e 1 px a 40% por fora
const HALO = (() => {
  const N = 15, O = 3, cel = Array.from({ length: N }, () => new Uint8Array(N));  // 0 fora, 9 esfera, 1/2 cheio, 3 fraco
  for (let y = 0; y < 9; y++) for (let x = 0; x < 9; x++) if (BOLA9[y][x] !== '.') cel[y + O][x + O] = 9;
  const crescer = (marca, oito) => {
    const novos = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (cel[y][x]) continue;
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if ((!oito && dx && dy) || (!dx && !dy)) continue;
        const v = (cel[y + dy] || [])[x + dx];
        if (v && v !== marca) { novos.push([x, y]); dx = dy = 2; }
      }
    }
    for (const [x, y] of novos) cel[y][x] = marca;
  };
  crescer(1, true); crescer(2, false); crescer(3, false);
  return cel;
})();
const HALOS = cache(16);
function halo(cor) {
  const pronto = HALOS.get(cor);
  if (pronto) return pronto;
  const c = tela(15, 15), k = c.getContext('2d');
  HALO.forEach((linha, y) => linha.forEach((v, x) => {
    if (v === 0 || v === 9) return;
    k.fillStyle = v === 3 ? rgba(cor, 0.4) : cor; k.fillRect(x, y, 1, 1);
  }));
  return HALOS.set(cor, c);
}
// pulso do "trabalhando" (o do app: 1 -> 0,3 em 0,8 s, vai e volta)
const pulso = t => 0.65 + 0.35 * Math.cos(2 * Math.PI * t / 1.6);

function bolinha(g, linha, t) {
  const [x, y] = linha.bola;
  g.save();
  if (linha.sit === 'working') g.globalAlpha *= pulso(t);
  g.drawImage(halo(corHex(linha.cor, '#9CA3AF')), x - 3, y - 3);
  g.restore();
  g.drawImage(arte(ESFERA9, COR_ESFERA), x, y);
}

// ---------- borda: nuvem voadora embaixo do cartão ----------
// corpo contínuo (faixa de -8 a w+8) + bolhas em cima e embaixo, em 1 px; respira a 6 quadros/s
// (36 desenhos). Pronta 1x por desenho e guardada.
const NUVENS = cache(40);
const NUV = { esq: 16, cima: 8, alt: 24 };
function nuvemBolhas(w, q) {
  const f = q * Math.PI / 18, b = [];
  for (let i = 0, x = -4; x <= w + 4; i++, x += 12) { const grande = i % 2 === 0; b.push([x, grande ? 1 : 3, (grande ? 7.2 : 5.4) + 0.6 * Math.sin(f + i * 1.3)]); }
  for (let i = 0, x = 4; x <= w - 4; i++, x += 13) b.push([x, 9, 4.2 + 0.5 * Math.sin(i * 1.7 + 1) + 0.4 * Math.cos(f + i)]);
  b.push([-9, 5, 6 + 0.5 * Math.sin(2 * f)], [w + 9, 5, 6 + 0.5 * Math.cos(2 * f)]);
  return b;
}
const cor32 = hex => { const n = parseInt(hex.slice(1), 16); return (0xFF000000 | n) >>> 0; };
const NUV_CORES = ['#FFFBEB', '#B97F06', '#D99A06', '#FEF3C7', '#FDE047', '#FACC15', '#EAB308'].map(cor32);
function nuvemArte(w, q) {
  const chave = w + ',' + q;
  const pronta = NUVENS.get(chave);
  if (pronta) return pronta;
  const W = w + 2 * NUV.esq, H = NUV.alt, b = nuvemBolhas(w, q);
  // grade com 1 px de folga em volta (vizinho fora = vazio); px = x - esq, py = y - cima
  const GW = W + 2, GH = H + 2, den = new Uint8Array(GW * GH), capa = new Uint8Array(GW * GH);
  const idx = (px, py) => (py + NUV.cima + 1) * GW + (px + NUV.esq + 1);
  for (let py = 0; py <= 10; py++) for (let px = -8; px <= w + 8; px++) den[idx(px, py)] = 1;
  for (const [bx, by, r] of b) {
    for (let py = Math.floor(by - r - 1); py <= by + r; py++) for (let px = Math.floor(bx - r - 1); px <= bx + r; px++) {
      if (px < -NUV.esq || px >= W - NUV.esq || py < -NUV.cima || py >= H - NUV.cima) continue;
      const dx = px + 0.5 - bx, dy = py + 0.5 - by;
      if (dx * dx + dy * dy > r * r) continue;
      den[idx(px, py)] = 1;
      if (dy < -0.38 * r) capa[idx(px, py)] = 1;
    }
  }
  const c = tela(W, H), pix = c.pixels;
  for (let py = -NUV.cima; py < H - NUV.cima; py++) for (let px = -NUV.esq; px < W - NUV.esq; px++) {
    const i = idx(px, py);
    if (!den[i]) continue;
    const k = !den[i - GW] ? 0 : !den[i + GW] ? 1 : (!den[i - 1] || !den[i + 1]) ? 2 : capa[i] ? 3 : py < 6 ? 4 : py < 10 ? 5 : 6;
    pix[(py + NUV.cima) * W + px + NUV.esq] = NUV_CORES[k];
  }
  return NUVENS.set(chave, c);
}
function nuvem(g, cartao, t) {
  const [x, y, w, h] = cartao, wi = Math.max(16, Math.round(w)), img = nuvemArte(wi, Math.floor(t * 6) % 36);
  g.drawImage(img, x - NUV.esq, y + h - NUV.cima, img.width, img.height);
  for (let k = 0; k < 3; k++) {  // fiapos que ficam pra trás (a nuvem "voa" pra direita)
    const f = (t / 1.8 + k / 3) % 1, r = 1 + 3 * (1 - f), cx = x - 17 - 30 * f, cy = y + h + 5 + 2 * Math.sin(k * 2);
    disco(g, Math.round(cx), Math.round(cy), r + 0.5, rgba('#FDE68A', 0.85 * (1 - f)));
  }
}

// ---------- barra de ki ----------
const CORES_BARRA = [
  { b: '#FACC15', l: '#FEF08A', d: '#CA8A04', txt: '#FDE047' },
  { b: '#F59E0B', l: '#FCD34D', d: '#B45309', txt: '#F59E0B' },
  { b: '#EF4444', l: '#FCA5A5', d: '#B91C1C', txt: '#EF4444' },
];
const nivelDe = u => (u.nivel != null ? lim(u.nivel | 0, 0, 2) : u.pct >= 95 ? 2 : u.pct >= 80 ? 1 : 0);
function barra(g, [x, y, w, h], pct, nivel, t) {
  const c = CORES_BARRA[nivel], wi = w - 2, hi = h - 2, wf = Math.round(wi * lim(pct, 0, 100) / 100);
  g.fillStyle = '#0B0F19'; g.fillRect(x, y, w, h);
  g.fillStyle = '#262B38'; g.fillRect(x + 1, y + 1, wi, hi);
  if (wf <= 0) return;
  g.fillStyle = c.b; g.fillRect(x + 1, y + 1, wf, hi);
  g.fillStyle = c.l; g.fillRect(x + 1, y + 1, wf, 1);
  g.fillStyle = c.d; g.fillRect(x + 1, y + hi, wf, 1);
  g.fillStyle = 'rgba(0,0,0,.22)'; for (let i = 10; i < wf; i += 10) g.fillRect(x + 1 + i, y + 1, 1, hi);  // gomos
  const s = ((t % 2.4) / 2.4) * (wf + 12) - 6;  // brilho que passa, cortado no enchimento
  g.fillStyle = 'rgba(255,255,255,.55)';
  for (let j = 0; j < hi; j++) {
    const a = Math.max(x + 1, Math.round(x + 1 + s - j)), b = Math.min(x + 1 + wf, Math.round(x + 1 + s - j) + 2);
    if (b > a) g.fillRect(a, y + 1 + j, b - a, 1);
  }
}
// easter egg: "MAIS DE 8000!" piscando 0,18 s aceso / 0,18 apagado (2,8 clarões/s, abaixo do
// limite de 3/s) por 1,4 s a cada 5 s, com 80% ou mais
const OVO = 'MAIS DE 8000!';
const ovoAceso = t => { const f = ((t % 5) + 5) % 5; return f < 1.4 && Math.floor(f / 0.18) % 2 === 0; };
function ovo(g, e, cx, cy) {
  const w = largPx(OVO);
  const img = pronta('ovo', e, () => {
    const c = tela(w + 8, 17), k = c.getContext('2d');
    k.fillStyle = 'rgba(0,0,0,.82)'; k.fillRect(1, 1, w + 6, 15);
    k.fillStyle = '#EF4444'; k.fillRect(1, 1, w + 6, 1); k.fillRect(1, 15, w + 6, 1);
    textoPx(k, OVO, 4, 3, '#FDE047');
    return c;
  });
  colar(g, img, Math.round(cx - w / 2) - 3, cy - 7, e);
}

// ---------- as 7 esferas no canto e o dragão serpente ----------
const ESFERA7 = ['.kkkkk.', 'kcwcook', 'kccsodk', 'kcsssdk', 'kcosodk', 'koooddk', '.kkkkk.'];
const esfera7 = () => arte(ESFERA7, COR_ESFERA);
// cabeça de perfil olhando pra frente (pra onde anda), 1,5 px por pixel (30x18)
const DRAGAO_CABECA = [
  'hh..................', '.hhh................', '...hhh..............', '....hkkkkk..........',
  '..skgggggggkk.......', '.sskggggggggggkk....', 'sssgggggwrgggggggkk.', '.ssggggggggggggggggn',
  '..sgggggggggggggggkk', '...kgbbbbbbtbtbtbtk.', '....kbbbbbbbbbbbb...', '.....kkkkkkkkkkk....',
];
const COR_DRAGAO = { h: '#FEF3C7', k: '#14532D', g: '#22A45A', s: '#15803D', w: '#FFFFFF', r: '#DC2626', n: '#0F3D22', b: '#FDE68A', t: '#FFFFFF' };
// pedido: s pairando depois de subir (o Clawd faz o pedido e ganha; dragonball-pedido.js)
const DRAG = { afasta: 9, vel: 300, seg: 64, passo: 3.2, luz: 0.7, sobe: 46, pedido: 5.0, fim: 1.1 };
// G = { w, h, r, extra } do cartão (extra = a trilha que desce por baixo da nuvem)
const posEsfera = (G, k) => ({ x: G.w - 14 - (6 - k) * 9, y: -7 });
const centroEsferas = G => G.w - 14 - 27 + 3.5;
// caminho: a trilha do cartão afastada 9 px pra fora, 1 volta a partir das esferas, e depois sobe
function caminhoDragao(G) {
  const o = DRAG.afasta, W = G.w + 2 * o, H = G.h + G.extra + 2 * o, r = G.r + o, xs = centroEsferas(G);
  const per = 2 * (W - 2 * r) + 2 * (H - 2 * r) + 4 * (Math.PI * r / 2), d0 = xs + o - r;
  return {
    per,
    P(s) {
      if (s <= per) { const p = trilha(W, H, d0 + s, r); return { x: p.x - o, y: p.y - o, a: p.a }; }
      const u = s - per; return { x: xs + 6 * Math.sin(u / 12), y: -o - u, a: -Math.PI / 2 + 0.4 * Math.cos(u / 12) };
    },
  };
}
const paraEm = c => DRAG.luz + (c.per + DRAG.sobe) / DRAG.vel;  // quando ele para de subir e fica pairando
const duracaoDragao = G => paraEm(caminhoDragao(G)) + DRAG.pedido + DRAG.fim;
const voltaAng = a => Math.atan2(Math.sin(a), Math.cos(a));  // pro intervalo -pi..pi
// a cabeça em t (relativa ao canto do cartão): subindo, segue o caminho; pairando, balança e
// vira pra olhar o alvo (o Clawd fazendo o pedido) em 0,5 s
function cabecaDragao(G, t, alvo, c = caminhoDragao(G)) {
  const TS = paraEm(c), sCab = Math.min(DRAG.vel * (t - DRAG.luz), c.per + DRAG.sobe), ph = c.P(Math.max(0, sCab));
  if (t < TS || !alvo) return { x: ph.x, y: ph.y, a: ph.a };
  const hv = t - TS, k = Math.min(1, hv / 0.6), u = k * k * (3 - 2 * k);
  const y = ph.y + 1.5 * Math.sin(hv * 2.4) * k, quer = Math.atan2(alvo.y - y, alvo.x - ph.x);
  return { x: ph.x, y, a: ph.a + voltaAng(quer - ph.a) * u };
}
// gomos do corpo prontos (contorno + corpo; a barriga vai por cima, virada pra dentro)
const GOMOS = cache(140);
function gomo(rs, branco) {
  const chave = rs.toFixed(3) + branco;
  const pronto = GOMOS.get(chave);
  if (pronto) return pronto;
  const n = Math.ceil(rs + 1) + 1, c = tela(2 * n, 2 * n), k = c.getContext('2d');
  disco(k, n, n, rs + 1, branco ? '#FFFFFF' : '#14532D');
  disco(k, n, n, rs, branco ? '#FFFFFF' : '#22A45A');
  c.meio = n;
  return GOMOS.set(chave, c);
}
// t = s desde o começo do evento; (ox, oy) = canto do cartão. o: { alvo {x, y} (pra onde a cabeça
// vira pairando, relativo ao cartão), olho 0..1 (os olhos acendem: o pedido concedido) }
function desenhaDragao(g, ox, oy, G, t, o = {}) {
  const c = caminhoDragao(G), TS = paraEm(c), T1 = TS + DRAG.pedido;
  if (t < DRAG.luz || t >= T1 + DRAG.fim) return;
  const sCab = Math.min(DRAG.vel * (t - DRAG.luz), c.per + DRAG.sobe), branco = t >= T1 && t < T1 + 0.15;
  const hv = t - TS, onda = hv > 0 ? Math.min(1, hv / 0.6) : 0;  // pairando: o corpo ondula
  g.save(); g.translate(ox, oy);
  if (t < T1 + 0.15) {
    for (let i = DRAG.seg; i >= 1; i--) {
      const s = sCab - i * DRAG.passo;
      if (s < 0) continue;
      const p = c.P(s), rs = 1.5 + 2.6 * (1 - i / DRAG.seg), nx = Math.sin(p.a), ny = -Math.cos(p.a);
      if (onda) { const d = 1.3 * onda * Math.sin(hv * 3.2 - i * 0.32); p.x += nx * d; p.y += ny * d; }
      const img = gomo(rs, branco);
      g.drawImage(img, Math.round(p.x) - img.meio, Math.round(p.y) - img.meio);
      if (!branco) {
        disco(g, p.x - nx * rs * 0.5, p.y - ny * rs * 0.5, rs * 0.55, '#FDE68A');
        if (i % 3 === 0) { g.fillStyle = '#15803D'; g.fillRect(Math.round(p.x + nx * (rs + 1.5)) - 1, Math.round(p.y + ny * (rs + 1.5)) - 1, 2, 2); }
        if (i === DRAG.seg) { g.fillStyle = '#FDE68A'; g.fillRect(Math.round(p.x - Math.cos(p.a) * 3) - 1, Math.round(p.y - Math.sin(p.a) * 3) - 1, 3, 3); }  // ponta do rabo
      }
    }
    const ph = cabecaDragao(G, t, o.alvo, c);
    g.save(); g.translate(ph.x, ph.y); g.rotate(ph.a);
    if (Math.cos(ph.a) < 0) g.scale(1, -1);  // olhando pra trás: desvira (o queixo pra baixo)
    if (!branco) {  // bigodes ondulando pra trás
      g.fillStyle = '#FDE68A';
      for (let j = 1; j <= 11; j++) g.fillRect(Math.round(21 - j * 2.5), Math.round(4.5 + j * 0.7 + 1.8 * Math.sin(t * 9 + j * 0.6)), 1.5, 1.5);
    }
    const cab = arte(DRAGAO_CABECA, COR_DRAGAO);
    g.drawImage(branco ? tingida(cab, '#FFFFFF', 'dragao') : cab, -4.5, -10.5, 30, 18);
    if (o.olho > 0 && !branco) {  // o olho acende (o 'r' da coluna 9, linha 6)
      const ex = -4.5 + 9 * 1.5 + 0.75, ey = -10.5 + 6 * 1.5 + 0.75, gr = g.createRadialGradient(ex, ey, 0, ex, ey, 9);
      gr.addColorStop(0, rgba('#FEF08A', 0.85 * o.olho)); gr.addColorStop(0.4, rgba('#F87171', 0.45 * o.olho)); gr.addColorStop(1, rgba('#F87171', 0));
      g.fillStyle = gr; g.fillRect(ex - 9, ey - 9, 18, 18);
      g.fillStyle = rgba('#FFFFFF', o.olho); g.fillRect(ex - 0.75, ey - 0.75, 1.5, 1.5);
    }
    g.restore();
  } else {  // some num brilho: estrelinhas subindo de onde o corpo estava
    const u = (t - T1 - 0.15) / (DRAG.fim - 0.15), a3 = arte(ESTRELA3, { '#': '#FEF9C3', w: '#FFFFFF' });
    g.globalAlpha *= lim(1 - u, 0, 1);
    for (let i = 0; i <= DRAG.seg; i += 4) {
      const p = c.P(sCab - i * DRAG.passo);
      g.drawImage(a3, Math.round(p.x + Math.sin(i + u * 6) * 3 - 1.5), Math.round(p.y - 26 * sai(u) - 1.5));
    }
  }
  g.restore();
}
// esferas: n = quantas, tAdd[k] = quando a k-ésima chegou (pula ao aparecer), ev = s desde o evento (ou null)
function desenhaEsferas(g, ox, oy, G, n, tAdd, t, ev) {
  const img = esfera7(), T1 = ev == null ? 0 : duracaoDragao(G) - DRAG.fim;
  for (let k = 0; k < Math.min(7, n); k++) {
    let { x, y } = posEsfera(G, k), esc = 1, alfa = 1, pedra = false;
    if (ev == null) { const d = t - (tAdd[k] ?? -9); if (d >= 0 && d < 0.25) { esc = sai(lim(d / 0.25, 0, 1)) * 1.25; y -= 6 * Math.sin(Math.PI * lim(d / 0.25, 0, 1)); } }
    else if (ev >= DRAG.luz && ev < T1 + 0.2) pedra = true;  // viram pedra enquanto o dragão está fora
    else if (ev >= T1 + 0.2) {  // se espalham e somem
      const u = lim((ev - T1 - 0.2) / 0.8, 0, 1), an = -Math.PI / 2 + (k - 3) * 0.45;
      x += Math.cos(an) * 46 * sai(u); y += Math.sin(an) * 46 * sai(u); alfa = 1 - u;
    }
    if (!(alfa > 0) || !(esc > 0)) continue;
    g.save(); g.globalAlpha *= alfa; g.translate(ox + x + 3.5, oy + y + 3.5); g.scale(esc, esc);
    if (ev != null && ev < DRAG.luz) {  // brilham antes do dragão
      const a0 = g.globalAlpha;
      g.globalAlpha = a0 * (0.55 + 0.45 * Math.sin(ev * 18 + k));
      disco(g, 0, 0, 6, 'rgba(253,224,71,.45)');
      g.globalAlpha = a0;
    }
    g.drawImage(pedra ? tingida(img, '#8A8F98', 'esfera7') : img, -3.5, -3.5);
    g.restore();
  }
  if (ev != null && ev < DRAG.luz + 0.25) {  // coluna de luz subindo das esferas + clarão
    const xs = ox + centroEsferas(G), u = lim(ev / DRAG.luz, 0, 1), w = 1 + Math.round(4 * u), alto = 70 * sai(u);
    if (alto > 0) {
      g.fillStyle = rgba('#FEF08A', 0.55 + 0.4 * u); g.fillRect(Math.round(xs - w / 2), oy - 4 - alto, w, alto);
      g.fillStyle = rgba('#FFFFFF', 0.7 * u); g.fillRect(Math.round(xs - w / 4), oy - 4 - alto, Math.max(1, Math.round(w / 2)), alto);
    }
    impacto(g, xs, oy - 4, ev - DRAG.luz, 1.6);
  }
}

module.exports = {
  escrever, bolinha, nuvem, nuvemArte, barra, nivelDe, CORES_BARRA, ovo, ovoAceso, OVO, largPx,
  desenhaEsferas, desenhaDragao, duracaoDragao, cabecaDragao, caminhoDragao, paraEm, DRAG, HALO,
};
