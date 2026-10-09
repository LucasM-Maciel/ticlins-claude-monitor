'use strict';
// O pedido ao dragão (tema Dragon Ball, pedido do dono em 09/10): depois da volta no cartão
// ele sobe, para no ar e vira a cabeça pro Clawd; o Clawd faz o pedido (um balão com o
// desenho), os olhos do dragão acendem e o pedido chega. São 4, um por vez, em rodízio
// (m.salvo.dbPedidos, no tema):
//   infinito  um raio dourado sai do dragão e enche as barras de ki, douradas com "∞" (só o
//             desenho: o uso de verdade não muda); o Clawd brilha de braços pra cima
//   feijoes   cai um saquinho; ele come um feijão, mastiga e a energia volta num clarão
//   banquete  chove comida na frente dele; come tudo, a barriga estica, arroto
//   codigo    bichinhos (os bugs) vêm andando pela trilha; desce um pergaminho "0 BUGS" e
//             eles estouram em estrelinhas
// h = s desde que o dragão parou no ar (0..DRAG.pedido, dragonball-cartao.js). O Clawd e o
// presente: no referencial do Clawd (y- pra fora do cartão); o balão e o pergaminho se
// desviram (ficam de pé na tela) em qualquer lado da trilha. O raio e as barras: na janela.
const { lim, sai, arte, rgba } = require('./comum');
const A = require('./dragonball-arte');
const K = require('./dragonball-cartao');

const PEDIDOS = ['infinito', 'feijoes', 'banquete', 'codigo'];
const H = { fala: [0.3, 1.6], concede: [1.6, 2.2], ganha: [2.2, 4.6], festa: 4.6 };
const fatia = A.fatia, ALTO = A.ALTURA * 1.5;  // a altura do Clawd em px
const OURO = '#FDE047';

// ---------- desenhos (1 px por letra nos do balão, 1,5 px nos que caem) ----------
const ICONE = {
  feijoes: arte(['..gg......', '.gLgg.....', 'gLggg..gg.', 'gggg..gLgg', '.gg..gLggg', '.....gggg.', '......gg..'],
    { g: '#4D7C0F', L: '#A3E635' }),
  banquete: arte(['..mmmm.....', '.mMMmmm....', 'mMmmmmmd...', 'mmmmmmmd...', '.mmmmmdd...', '..dddd.ww..', '.......wWw.', '........ww.'],
    { m: '#B45309', M: '#F59E0B', d: '#78350F', w: '#D6D3D1', W: '#F5F5F4' }),
};
// o bichinho visto de cima (antenas, cabeça, corpo listrado, 3 pares de pernas: 2 quadros)
const BUG = [
  ['k...k', '.kbk.', 'k.B.k', '.bRb.', 'k.b.k', '..b..'],
  ['.k.k.', '.kbk.', '.kBk.', 'kbRbk', '.kbk.', '..b..'],
].map(l => arte(l, { k: '#1C1917', b: '#9333EA', B: '#E879F9', R: '#DC2626' }));  // roxos: no corpo verde do dragão aparecem
// o "proibido bug" do balão: o bichinho num círculo vermelho cortado
const ICONE_CODIGO = (() => {
  const L = [];
  for (let y = 0; y < 11; y++) {
    let l = '';
    for (let x = 0; x < 11; x++) {
      const d = Math.hypot(x - 5, y - 5);
      l += d >= 4.3 && d <= 5.5 ? 'r' : Math.abs(x - y) < 0.6 && d < 4.3 ? 'r' : x >= 3 && x <= 7 && y >= 2 && y <= 8 ? 'b' : '.';
    }
    L.push(l);
  }
  return arte(L, { r: '#DC2626', b: '#9333EA' });
})();
const COMIDA = [
  arte(['.mmm...', 'mMmmm..', 'mmmmmd.', '.mmmdd.', '....ww.', '.....ww'], { m: '#B45309', M: '#F59E0B', d: '#78350F', w: '#F5F5F4' }),
  arte(['..www..', '.wwwww.', 'bbbbbbb', '.bBbbb.', '..bbb..'], { w: '#FFFFFF', b: '#1D4ED8', B: '#60A5FA' }),
  arte(['..ww..', '.wwww.', 'wwwwvw', 'wwwwww', '.vvvv.'], { w: '#FFF7ED', v: '#D6BFA0' }),
  arte(['..s.l', '.aaa.', 'aAaaa', 'aaaaa', 'aaaad', '.ada.'], { a: '#DC2626', A: '#FCA5A5', d: '#991B1B', s: '#78350F', l: '#16A34A' }),
  arte(['.mmm...', 'mMmmm..', 'mmmmmd.', '.mmmdd.', '....ww.', '.....ww'], { m: '#B45309', M: '#F59E0B', d: '#78350F', w: '#F5F5F4' }),
];
// onde cada comida para (x, e quantas tem embaixo: a de cima cai em cima das outras)
const PILHA = [[14, 0], [24, 0], [34, 0], [19, 1], [29, 1]];
const SACO = arte(['...kk....', '..kTTk...', '...kk....', '..ksssk..', '.ksssssk.', 'kssSssssk', 'ksssssssk', 'ksssssssk', '.kkkkkkk.'],
  { k: '#5B3A1A', s: '#C08A4A', S: '#E0B070', T: '#DC2626' });
const FEIJAO = arte(['.gg.', 'gLgg', 'gggg', '.gg.'], { g: '#4D7C0F', L: '#A3E635' });
const px = (g, img, x, y, P = 1.5) => g.drawImage(img, Math.round(x), Math.round(y), img.width * P, img.height * P);

// ---------- o balão e o pergaminho (de pé na tela: desfaz o giro da trilha) ----------
function dePe(g, x, y, a, desenhar) {
  g.save(); g.translate(x, y); g.rotate(-a); desenhar(); g.restore();
}
function balao(g, qual, h, a) {
  const u = fatia(h, H.fala[0], H.fala[0] + 0.15), v = fatia(h, H.fala[1] - 0.15, H.fala[1]);
  if (u <= 0 || v >= 1) return;
  const k = sai(u) * (1 - v), w = 24, hh = 17, cx = 9, cy = -ALTO - 15 - 2 * (1 - k);
  g.save(); g.globalAlpha *= k;
  // a pontinha: degraus até a cabeça
  g.fillStyle = '#1C1917';
  for (let j = 0; j < 4; j++) g.fillRect(Math.round(cx - 5 - j), Math.round(cy + hh / 2 + j), 3, 1);
  dePe(g, cx, cy, a, () => {
    g.fillStyle = '#1C1917'; g.fillRect(-w / 2 + 1, -hh / 2, w - 2, hh); g.fillRect(-w / 2, -hh / 2 + 1, w, hh - 2);
    g.fillStyle = '#FFFFFF'; g.fillRect(-w / 2 + 1, -hh / 2 + 1, w - 2, hh - 2);
    const pul = Math.floor(h / 0.18) % 2;  // o desenho dá pulinhos: ele está falando
    if (qual === 'infinito') A.textoPx(g, '∞', -5, -6 - pul, '#CA8A04', false);
    else if (qual === 'codigo') px(g, ICONE_CODIGO, -5.5, -5.5 - pul, 1);
    else { const img = ICONE[qual]; px(g, img, -img.width / 2, -img.height / 2 - pul, 1); }
  });
  g.restore();
}
function pergaminho(g, h, a) {
  const desce = fatia(h, 2.55, 3.0), abre = fatia(h, 2.85, 3.2), some = fatia(h, 4.0, 4.4);
  if (desce <= 0 || some >= 1) return;
  const W = 50, alto = Math.round(4 + 15 * sai(abre)), y = -ALTO - 52 + 30 * sai(desce) - 8 * some;
  g.save(); g.globalAlpha *= 1 - some;
  dePe(g, 0, y, a, () => {
    if (h > 3.25 && h < 3.9) {  // brilha quando os bugs estouram
      const gr = g.createRadialGradient(0, alto / 2, 2, 0, alto / 2, 32);
      gr.addColorStop(0, rgba('#FEF9C3', 0.7)); gr.addColorStop(1, rgba('#FEF9C3', 0));
      g.fillStyle = gr; g.fillRect(-34, alto / 2 - 32, 68, 64);
    }
    g.fillStyle = '#FEF3C7'; g.fillRect(-W / 2 + 2, 0, W - 4, alto);
    g.fillStyle = '#E9D5A1'; g.fillRect(-W / 2 + 2, alto - 1, W - 4, 1);
    if (abre > 0.85) A.textoPx(g, '0 BUGS', -Math.round(A.largPx('0 BUGS') / 2), Math.round(alto / 2 - 6), '#16A34A', false);
    for (const yy of [-2, alto - 1]) {  // os dois rolinhos
      g.fillStyle = '#78350F'; g.fillRect(-W / 2, yy, W, 3);
      g.fillStyle = '#B45309'; g.fillRect(-W / 2, yy, W, 1);
    }
  });
  g.restore();
}

// ---------- o olho do dragão (0..1): acende no "concedido" ----------
function olho(h) {
  if (h < H.concede[0] || h >= H.ganha[1]) return 0;
  return Math.min(sai(fatia(h, H.concede[0], H.concede[0] + 0.2)), 1 - fatia(h, H.concede[1] + 0.1, H.concede[1] + 0.5));
}

// ---------- o Clawd e o presente (referencial do Clawd); R = o que ele veste, a = o ângulo da trilha ----------
function clawd(g, qual, h, R, a, T) {
  const p = { ...R, olhos: 'cima', pernas: 'ambas' };
  if (h >= H.fala[0] && h < H.fala[1]) p.sy = 1 + 0.035 * Math.abs(Math.sin(h * 17));  // falando
  if (h >= H.festa) Object.assign(p, A.pulando(T, R), { bracos: [-4.5, -4.5] });  // comemora
  const extra = [];
  if (qual === 'infinito') presenteInfinito(p, h);
  else if (qual === 'feijoes') presenteFeijoes(p, h, extra);
  else if (qual === 'banquete') presenteBanquete(p, h, extra);
  else if (qual === 'codigo') presenteCodigo(p, h, extra);
  for (const f of extra) if (f.atras) f.atras(g);
  A.clawdDB(g, p);
  for (const f of extra) if (f.frente) f.frente(g);
  balao(g, qual, h, a);
  if (qual === 'codigo') pergaminho(g, h, a);
  A.anelClarao(g, (h - H.ganha[0]) / 0.7, OURO);  // chegou
}
function presenteInfinito(p, h) {
  const u = fatia(h, H.ganha[0], H.ganha[0] + 0.4), v = fatia(h, H.festa - 0.3, H.festa + 0.3);
  if (u <= 0) return;
  const k = sai(u) * (1 - 0.6 * v);
  Object.assign(p, { brilho: k, aura: Math.max(p.aura || 0, 1.2 * k), auraCor: OURO, olhos: 'abertos' });
  if (h < H.festa) p.bracos = [-4.5 * sai(u), -4.5 * sai(u)];
}
function presenteFeijoes(p, h, extra) {
  const cai = fatia(h, H.ganha[0], 2.75), xs = 15;
  const pula = fatia(h, 2.95, 3.3), mastiga = h >= 3.3 && h < 3.9, poder = fatia(h, 3.9, 4.6);
  if (cai > 0 && h < 4.2) extra.push({ atras: g => {  // o saquinho cai na frente dele (quica)
    const y = cai < 1 ? -70 * (1 - cai * cai) : -2 * Math.sin(Math.PI * Math.min(1, (h - 2.75) / 0.18));
    g.save(); g.globalAlpha *= 1 - fatia(h, 4.0, 4.2); px(g, SACO, xs - 6.75, y - 13.5); g.restore();
  } });
  if (pula > 0 && pula < 1) extra.push({ frente: g => {  // um feijão pula do saco pra boca
    const x = xs + (2 - xs) * pula, y = -12 - (ALTO * 0.55 - 12) * pula - 18 * Math.sin(Math.PI * pula);
    px(g, FEIJAO, x - 3, y - 3);
  } });
  if (h >= 2.95 && h < 3.3) p.bracos = [-2, -2];
  if (mastiga) Object.assign(p, { olhos: 'fechados', sy: 1 - 0.05 * Math.abs(Math.sin((h - 3.3) * 16)) });
  if (poder > 0 && h < H.festa) {
    const q = Math.sin(Math.PI * Math.min(1, poder * 1.4));
    Object.assign(p, { olhos: 'abertos', aura: Math.max(p.aura || 0, 1.3 * q + 0.4), sy: 1 + 0.06 * q, bracos: [1.5 * q, 1.5 * q] });
    extra.push({ frente: g => { A.anelClarao(g, poder / 0.5, '#BEF264'); A.estrelinhas(g, 0, -ALTO / 2, h - 3.9, 0.7, 6); } });
  }
}
function presenteBanquete(p, h, extra) {
  const comeu = k => 3.0 + k * 0.2 + 0.1;  // quando cada uma some
  let n = 0;
  for (let k = 0; k < 5; k++) if (h >= comeu(k)) n++;
  const desincha = fatia(h, H.festa, H.festa + 0.4);
  p.sx = 1 + 0.06 * n * (1 - desincha);
  p.sy = (p.sy || 1) * (1 + 0.02 * n * (1 - desincha));
  if (h >= 3.0 && h < 4.0) {
    const q = ((h - 3.0) % 0.2) / 0.2;
    Object.assign(p, { olhos: q < 0.5 ? 'fechados' : 'abertos', x: 2 * Math.sin(Math.PI * q), bracos: q < 0.5 ? [-2, -2] : null });
  }
  if (h >= 4.0 && h < H.festa) Object.assign(p, { olhos: 'fechados', bracos: Math.floor(h / 0.12) % 2 ? [1.5, 0] : [0, 1.5] });  // bate na barriga
  extra.push({ atras: g => {
    COMIDA.forEach((img, k) => {
      const t0 = H.ganha[0] + k * 0.13, u = fatia(h, t0, t0 + 0.4);
      if (u <= 0 || h >= comeu(k)) return;
      const [x, emCima] = PILHA[k], chao = -emCima * 7;
      px(g, img, x - img.width * 0.75, chao - img.height * 1.5 - 90 * (1 - u * u));
    });
  }, frente: g => {
    for (let k = 0; k < 5; k++) {  // farelo voando de cada mordida
      const d = h - comeu(k);
      if (d < 0 || d > 0.3) continue;
      g.fillStyle = k % 2 ? '#F59E0B' : '#FFF7ED';
      for (let j = 0; j < 4; j++) g.fillRect(Math.round(6 + j * 2 + d * 30 * (j - 1.5) / 2), Math.round(-ALTO * 0.5 - d * 20 + d * d * 120), 1.5, 1.5);
    }
    const d = h - 4.3;  // o arroto: uma nuvenzinha sobe da boca
    if (d >= 0 && d < 0.6) {
      g.save(); g.globalAlpha *= 1 - d / 0.6;
      for (const [dx, dy, r] of [[0, 0, 2.5], [3, -2, 3], [6, 0, 2.5]]) A.disco(g, 12 + dx + d * 8, -ALTO * 0.6 + dy - d * 14, r + d * 3, '#E5E7EB');
      g.restore();
    }
  } });
}
function presenteCodigo(p, h, extra) {
  const XS = [-34, -24, 22, 31, 40];  // onde cada bug para (atrás e na frente dele)
  const anda = fatia(h, H.ganha[0], 2.9), estoura = k => 3.3 + k * 0.09;
  if (h >= 3.75 && h < H.festa) p.bracos = [-4.5, -4.5];
  else if (h >= H.ganha[0] && h < 3.3) p.olhos = 'abertos';
  extra.push({ frente: g => {
    XS.forEach((x, k) => {
      if (h >= estoura(k)) { A.estrelinhas(g, x, -4, h - estoura(k), 0.5, 5); return; }
      const de = x < 0 ? x - 40 : x + 40, xi = de + (x - de) * sai(anda), img = BUG[Math.floor(h / 0.1 + k) % 2];
      g.save(); g.translate(Math.round(xi), -5); if (x > 0) g.scale(-1, 1);
      g.rotate(Math.PI / 2); px(g, img, -3.75, -4.5); g.restore();  // de lado: anda pela trilha
    });
  } });
}

// ---------- na janela (DIPs): o raio dourado e as barras (infinito) ----------
// boca = {x, y} da boca do dragão na janela; uso = m.host.uso; alvo = a cabeça do Clawd (sem barras)
function janela(g, qual, h, { boca, uso = [], alvo, e = 1, T = 0 }) {
  if (qual !== 'infinito' || h < H.ganha[0] || h >= H.ganha[1]) return;
  const barras = uso.filter(u => u && u.barra);
  const alvos = barras.length ? barras.map(u => ({ x: u.barra[0] + u.barra[2] / 2, y: u.barra[1] + u.barra[3] / 2 })) : [alvo];
  const raio = fatia(h, H.ganha[0], H.ganha[0] + 0.25), apaga = fatia(h, 2.85, 3.15);
  if (apaga < 1) for (const a of alvos) {  // o raio: grosso dourado, miolo branco, vai até o alvo
    const dx = a.x - boca.x, dy = a.y - boca.y, L = Math.hypot(dx, dy) || 1, n = Math.ceil(L * raio / 1.5);
    g.save(); g.globalAlpha *= 1 - apaga;
    for (let i = 0; i <= n; i++) {
      const f = i * 1.5 / L, x = boca.x + dx * f, y = boca.y + dy * f, o = Math.sin(i * 0.9 - h * 40) * 0.6;
      g.fillStyle = rgba(OURO, 0.55); g.fillRect(Math.round(x - 2.5 + o), Math.round(y - 2.5), 5, 5);
      g.fillStyle = '#FFFFFF'; g.fillRect(Math.round(x - 1), Math.round(y - 1), 2, 2);
    }
    g.restore();
  }
  const enche = fatia(h, H.ganha[0] + 0.2, H.ganha[0] + 0.8), volta = fatia(h, 4.3, H.ganha[1]);
  if (enche <= 0) return;
  barras.forEach(u => {  // a barra enche até 100% dourada e o "38%" vira "∞"
    g.save(); g.globalAlpha *= 1 - volta;
    const pct = lim(u.pct, 0, 100);
    K.barra(g, u.barra, pct + (100 - pct) * sai(enche), 0, T * 3);
    if (enche >= 1 && u.pctTxt && u.pctTxt.caixa) {
      const [x, y, w, hh] = u.pctTxt.caixa;
      g.fillStyle = '#181818'; g.fillRect(x, y - 1, w, hh + 2);  // tampa o número (o fundo do cartão)
      if (volta <= 0) K.escrever(g, e, '∞', OURO, u.pctTxt.caixa, true);
    }
    g.restore();
  });
}

// ---------- a trilha (relativa ao h = 0) ----------
function sons(qual) {
  const S = [[H.fala[0], 'pedido-fala', 0.7], [H.concede[0], 'pedido-concede', 0.85]];
  if (qual === 'infinito') S.push([H.ganha[0], 'pedido-infinito', 0.8]);
  if (qual === 'feijoes') S.push([2.75, 'pedido-cai', 0.7], [3.3, 'pedido-mordida', 0.8], [3.55, 'pedido-mordida', 0.6, 0.9], [3.9, 'pedido-energia', 0.8]);
  if (qual === 'banquete') {
    for (let k = 0; k < 5; k++) S.push([H.ganha[0] + k * 0.13 + 0.4, 'pedido-cai', 0.5, 1 + 0.08 * k]);
    for (let k = 0; k < 5; k++) S.push([3.1 + k * 0.2, 'pedido-mordida', 0.65, 0.95 + 0.05 * (k % 3)]);
    S.push([4.3, 'pedido-arroto', 0.8]);
  }
  if (qual === 'codigo') {
    S.push([2.55, 'pedido-papel', 0.7]);
    for (let k = 0; k < 5; k++) S.push([3.3 + k * 0.09, 'pedido-estala', 0.55, 1 + 0.1 * k]);
  }
  S.push([H.festa, 'pedido-festa', 0.7]);
  return S;
}

module.exports = { PEDIDOS, H, olho, clawd, janela, sons };
