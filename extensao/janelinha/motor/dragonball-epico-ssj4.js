'use strict';
// Evento épico raro do tema Dragon Ball: A LUA CHEIA (dono, 09/10), ~16 s. A cada 150 voltas
// no cartão (~1 por dia de uso), na parada seguinte em cima do cartão. A área acima do cartão
// abre numa noite de deserto e a lua cheia sobe do lado de lá. O Clawd olha pra ela, o coração
// bate forte 3 vezes, a cauda sai, ele treme, fica dourado e cresce num macaco dourado
// gigante, que ruge (ondas de choque, tudo treme) e soca o peito 4 vezes. Aí ele brilha,
// encolhe num clarão e volta Clawd no SSJ 4: cabelo preto comprido, pelo vermelho, a cauda e a
// aura vermelha. O palco fecha e ele fica assim 2 min (o tema-dragonball.js liga no fim).
// Desenho nosso: o macaco (dragonball-macaco.js), a lua e o deserto são genéricos.
//
// Como os épicos do Sith: o plano sai da cena(m), pela semente, e o quadro é função de t.
// Coordenadas do palco: DIPs a partir do canto de cima à esquerda do cartão (X pra direita,
// Y- pra cima, 0 = a borda de cima do cartão, onde o Clawd pisa).
const { lim, sai, entra, tela, cache, arte, rng, rgba, mistura, tingida } = require('./comum');
const A = require('./dragonball-arte');
const Mc = require('./dragonball-macaco');

const { fatia } = A;
const suave = u => u * u * (3 - 2 * u);
const treme = (t, a) => (Math.floor(t / 0.05) % 2 ? a : -a);

// ---------- ritmo (s) ----------
const T = {
  abre: [0, 0.6], lua: [0.6, 3.0], olha: 1.3, batidas: [3.0, 3.55, 4.1], cauda: [3.25, 3.55],
  treme: [4.2, 4.8], cresce: [4.8, 6.3], ruge: [6.5, 8.1], ondas: [6.6, 7.1, 7.6],
  socos: [8.35, 8.65, 8.95, 9.25], brilha: [9.6, 10.5], encolhe: [10.5, 11.4], clarao: [11.3, 11.9],
  revela: 11.5, poder: [12.3, 13.3], fecha: [15.4, 16.0], dur: 16.2,
};
const NOITE = { topo: '#060A1F', baixo: '#2C1C50', morro: '#221A47', borda: '#5D4CA3', chao: '#130E2A' };
const OURO = '#FDE047', MOLDURA = '#FACC15';

const linhaDoTempo = [
  [0, 'o palco abre acima do cartão: noite no deserto'],
  [T.lua[0], 'a lua cheia sobe do lado de lá; o Clawd olha pra ela'],
  [T.batidas[0], 'o coração bate forte 3 vezes (o palco pulsa vermelho) e a cauda sai'],
  [T.treme[0], 'ele treme e fica dourado'],
  [T.cresce[0], 'cresce num macaco dourado gigante'],
  [T.ruge[0], 'o macaco ruge de braços erguidos: ondas de choque, tudo treme'],
  [T.socos[0] - 0.15, 'soca o peito 4 vezes'],
  [T.brilha[0], 'brilha e encolhe num clarão'],
  [T.revela, 'volta Clawd no SSJ 4: cabelo preto comprido, pelo vermelho, cauda, aura vermelha'],
  [T.poder[0], 'a pose de poder'],
  [T.fecha[0], 'o palco fecha (ele fica no SSJ 4 por 2 min)'],
];

// ---------- o plano ----------
function montar(m, r) {
  const c = m.host.cartao || [98, 260, 248, 146], casa = m.pose();
  const cw = c[2], HJ = Math.round(lim(c[1] - 14, 112, 184)), X0 = casa.x - c[0];
  const J = { cw, HJ, X0 };
  // o macaco: o maior que cabe no palco (P = DIPs por célula), no meio do Clawd se couber inteiro
  J.P = lim((HJ - 10) / Mc.MH, 2.2, 3.4);
  const AW = Mc.MW * J.P;
  J.Xa = cw - AW - 8 > 0 ? lim(X0, AW / 2 + 4, cw - AW / 2 - 4) : cw / 2;
  J.kmin = (A.ALTURA * 1.5) / ((Mc.MH - Mc.MY) * J.P);  // do tamanho do Clawd
  // a lua: sobe de trás dos morros, do lado oposto ao do Clawd
  J.horizonte = -Math.round(HJ * 0.16);
  const lr = lim(Math.round(HJ * 0.075), 9, 14);
  J.lua = { x: Math.round(X0 < cw / 2 ? cw * 0.8 : cw * 0.2), y0: J.horizonte + lr + 6, y1: -Math.round(HJ * 0.7), r: lr };
  J.brilhos = Array.from({ length: 7 }, () => ({ x: 6 + r() * (cw - 12), y: -HJ * (0.42 + 0.5 * r()), fase: r() * 6, v: 1.5 + r() * 2 }));
  // as faíscas que o macaco solta quando brilha (e que voltam pro Clawd quando encolhe)
  J.faiscas = Array.from({ length: 18 }, () => ({ x: J.Xa + (r() - 0.5) * AW * 0.9, y: -(0.1 + 0.8 * r()) * (Mc.MH - Mc.MY) * J.P, d: r() * 0.3, cor: r() < 0.5 ? OURO : '#FFFFFF' }));
  return J;
}

// o macaco em t: { k (tamanho 0..1), x (meio), pose, dourado (só a silhueta), branco (0..1), treme }
// ou null (é o Clawd)
function macacoEm(J, t) {
  if (t < T.cresce[0] || t >= T.encolhe[1]) return null;
  const baixo = { E: 'baixo', D: 'baixo', boca: 0 };
  if (t < T.cresce[1]) {
    const u = fatia(t, T.cresce[0], T.cresce[1]), s = suave(u);
    return { k: J.kmin + (1 - J.kmin) * s + 0.035 * Math.sin(u * Math.PI * 7) * (1 - u), x: J.X0 + (J.Xa - J.X0) * s, pose: baixo,
      dourado: u < 0.85 && Math.floor(t / 0.07) % 2 === 0, branco: 0, treme: 1.2 * u };
  }
  if (t >= T.encolhe[0]) {
    const u = entra(fatia(t, T.encolhe[0], T.encolhe[1]));
    return { k: 1 - (1 - J.kmin) * u, x: J.Xa + (J.X0 - J.Xa) * u, pose: baixo, dourado: false, branco: 1, treme: 0 };
  }
  const M = { k: 1, x: J.Xa, pose: baixo, dourado: false, branco: 0, treme: 0 };
  if (t >= T.ruge[0] && t < T.ruge[1]) {
    M.pose = { E: 'cima', D: 'cima', boca: t >= T.ruge[0] + 0.05 && t < T.ruge[1] - 0.1 ? 1 : 0 };
    M.treme = 2.2 * (1 - 0.5 * fatia(t, T.ruge[1] - 0.4, T.ruge[1]));
  }
  const S = T.socos;
  if (t >= S[0] - 0.15 && t < S[S.length - 1] + 0.2) {
    let i = 0;
    while (i + 1 < S.length && t >= S[i + 1] - 0.15) i++;
    const d = t - S[i];  // antes do soco: o braço armado; no soco: o punho no peito
    M.pose = d < 0 ? { E: 'recua', D: 'recua', boca: 0 } : i % 2 ? { E: 'recua', D: 'peito', boca: 1 } : { E: 'peito', D: 'recua', boca: 1 };
    if (d >= 0 && d < 0.15) M.treme = 1.4 * (1 - d / 0.15);
  }
  if (t >= T.brilha[0]) M.branco = 0.9 * fatia(t, T.brilha[0], T.brilha[1]);
  return M;
}

// o coração (ba-dum): 0..1
function pulso(t) {
  let p = 0;
  const bate = d => (d >= 0 && d < 0.18 ? 1 - d / 0.18 : 0);
  for (const b of T.batidas) p = Math.max(p, bate(t - b), 0.6 * bate(t - b - 0.16));
  return p;
}

// ---------- desenhos prontos (no pixel da tela) ----------
// o céu: a noite em faixas (o raster não tem gradiente linear) e as estrelas fixas
const CEUS = cache(6);
function ceu(J, e) {
  const W = Math.round(J.cw * e), H = Math.round(J.HJ * e), chave = `${W}x${H}`;
  const pronto = CEUS.get(chave);
  if (pronto) return pronto;
  const c = tela(W, H), k = c.getContext('2d'), r = rng(4242), px = Math.max(1, Math.round(e));
  for (let y = 0; y < H; y++) { k.fillStyle = mistura(NOITE.topo, NOITE.baixo, (y / Math.max(1, H - 1)) ** 1.4); k.fillRect(0, y, W, 1); }
  const n = Math.round(J.cw * J.HJ / 240);
  for (let i = 0; i < n; i++) {
    const x = Math.floor(r() * W), y = Math.floor(r() * H * 0.78), a = 0.35 + 0.65 * r() * (1 - y / H);
    k.fillStyle = rgba(r() < 0.25 ? '#FDE68A' : '#FFFFFF', a); k.fillRect(x, y, px, px);
  }
  return CEUS.set(chave, c);
}
// os morros: mesas de topo reto (a borda de cima acesa pela lua) e o chão escuro; o resto vazio
const MORROS = cache(6);
function morros(J, e) {
  const W = Math.round(J.cw * e), H = Math.round(J.HJ * e), chave = `${W}x${H}`;
  const pronto = MORROS.get(chave);
  if (pronto) return pronto;
  const c = tela(W, H), k = c.getContext('2d'), r = rng(31);
  const mesas = [];
  for (let x = -20; x < J.cw + 20; x += 26 + 40 * r()) mesas.push({ a: x, b: x + 18 + 34 * r(), topo: J.HJ * (0.2 + 0.13 * r()), lado: 3 + 5 * r() });
  const alt = X => {  // altura do morro (DIPs acima da borda do cartão) na coluna X
    let h = -J.horizonte + 1.5 * Math.sin(X * 0.09) + 1.2 * Math.sin(X * 0.23 + 1);
    for (const ms of mesas) {
      const f = X < ms.a ? (X - (ms.a - ms.lado)) / ms.lado : X > ms.b ? ((ms.b + ms.lado) - X) / ms.lado : 1;
      if (f > 0) h = Math.max(h, -J.horizonte + (ms.topo + J.horizonte) * Math.min(1, f));
    }
    return h;
  };
  const px = Math.max(1, Math.round(e));
  for (let x = 0; x < W; x++) {
    const topo = Math.round(H - alt(x / e) * e);
    k.fillStyle = NOITE.morro; k.fillRect(x, topo, 1, H - topo);
    k.fillStyle = NOITE.borda; k.fillRect(x, topo, 1, px);
  }
  const chao = Math.round(H - J.HJ * 0.06 * e);
  k.fillStyle = NOITE.chao; k.fillRect(0, chao, W, H - chao);
  k.fillStyle = mistura(NOITE.chao, NOITE.borda, 0.35); k.fillRect(0, chao, W, px);
  return MORROS.set(chave, c);
}
// a lua cheia: o brilho em volta, o disco e as crateras
const LUAS = cache(6);
function luaImg(r0, e) {
  const R = r0 * e, G = R * 3.2, D = Math.ceil(2 * G) + 2, chave = `${D},${R}`;
  const pronta = LUAS.get(chave);
  if (pronta) return pronta;
  const brilho = tela(D, D), k = brilho.getContext('2d'), c = D / 2;
  const gr = k.createRadialGradient(c, c, R * 0.9, c, c, G);
  gr.addColorStop(0, rgba('#FFF4C2', 0.5)); gr.addColorStop(0.35, rgba('#FDE68A', 0.14)); gr.addColorStop(1, rgba('#FDE68A', 0));
  k.fillStyle = gr; k.fillRect(0, 0, D, D);
  const disco = tela(D, D), d = disco.getContext('2d');
  d.fillStyle = '#FFF6D5'; d.beginPath(); d.arc(c, c, R, 0, Math.PI * 2); d.fill();
  d.fillStyle = '#EFE3B0';
  for (const [x, y, s] of [[-0.35, -0.2, 0.22], [0.28, 0.12, 0.27], [-0.05, 0.48, 0.17], [0.42, -0.42, 0.12], [-0.5, 0.3, 0.1]]) {
    d.beginPath(); d.arc(c + x * R, c + y * R, s * R, 0, Math.PI * 2); d.fill();
  }
  return LUAS.set(chave, { brilho, disco, D });
}

// ---------- o quadro ----------
function aberto(t) { return t < T.fecha[0] ? sai(fatia(t, T.abre[0], T.abre[1])) : 1 - entra(fatia(t, T.fecha[0], T.fecha[1])); }
const BRILHO = ['.#.', '#w#', '.#.'];

function desenhar(g, t, m, J) {
  const e = m.host.escala || 1, c = m.host.cartao;
  if (!c) return;
  const OX = c[0], OY = c[1];
  const ab = aberto(t);
  if (ab <= 0) return;
  const topo = Math.round(-J.HJ * ab * e) / e, hp = Math.round(-topo * e);
  const M = macacoEm(J, t), tr = M ? M.treme : 0;
  const sx = Math.round(Math.sin(t * 93) * tr), sy = Math.round(Math.cos(t * 71) * 0.7 * tr);
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (hp > 0) { const img = ceu(J, e); g.drawImage(img, 0, img.height - hp, img.width, hp, Math.round(OX * e), Math.round(OY * e) - hp, img.width, hp); }
  g.setTransform(e, 0, 0, e, OX * e, OY * e);
  g.beginPath(); g.rect(0, topo, J.cw, -topo); g.clip();
  // as estrelas que piscam
  J.brilhos.forEach(b => {
    const a = 0.5 + 0.5 * Math.sin(t * b.v + b.fase);
    if (a < 0.15) return;
    g.globalAlpha = a; g.drawImage(arte(BRILHO, { '#': '#FDE68A', w: '#FFFFFF' }), Math.round(b.x), Math.round(b.y), 3, 3);
  });
  g.globalAlpha = 1;
  // a lua (sobe de trás dos morros)
  const ul = suave(fatia(t, T.lua[0], T.lua[1]));
  if (t >= T.lua[0]) {
    const L = luaImg(J.lua.r, e), ly = J.lua.y0 + (J.lua.y1 - J.lua.y0) * ul;
    const x = Math.round((OX + J.lua.x) * e - L.D / 2), y = Math.round((OY + ly) * e - L.D / 2);
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = ul * (0.85 + 0.15 * Math.sin(t * 1.7)) + 0.6 * pulso(t); g.drawImage(L.brilho, x, y);
    g.globalAlpha = 1; g.drawImage(L.disco, x, y);
    g.restore();
  }
  // os morros e o chão (tremem junto com o macaco)
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  const mo = morros(J, e);
  g.drawImage(mo, Math.round((OX + sx) * e), Math.round(OY * e) - mo.height + Math.round(sy * e));
  g.restore();
  // o coração: o palco pulsa vermelho
  const pu = pulso(t);
  if (pu > 0) { g.fillStyle = rgba('#DC2626', 0.22 * pu); g.fillRect(0, topo, J.cw, -topo); }
  if (M) desenharMacaco(g, t, J, e, OX, OY, sx, sy, M);
  desenharFaiscas(g, t, J);
  // o clarão da volta
  if (t >= T.clarao[0] && t < T.clarao[1]) {
    const a = t < T.revela ? fatia(t, T.clarao[0], T.revela) : 1 - fatia(t, T.revela, T.clarao[1]);
    g.fillStyle = rgba('#FFFBEB', 0.95 * a); g.fillRect(0, topo, J.cw, -topo);
  }
  g.restore();
  // a moldura do palco: dourada, a borda de cima mais clara enquanto abre e fecha
  g.save(); g.setTransform(e, 0, 0, e, OX * e, OY * e);
  g.fillStyle = mistura(MOLDURA, '#000000', 0.35);
  g.fillRect(0, topo, 1, -topo); g.fillRect(J.cw - 1, topo, 1, -topo);
  g.fillStyle = t < T.abre[1] || t >= T.fecha[0] ? '#FEF08A' : MOLDURA; g.fillRect(0, topo, J.cw, 1);
  g.restore();
}

function desenharMacaco(g, t, J, e, OX, OY, sx, sy, M) {
  const Pp = Math.max(1, Math.round(J.P * e)), w = Math.max(1, Math.round(Mc.MW * Pp * M.k)), h = Math.max(1, Math.round(Mc.MH * Pp * M.k));
  const x = Math.round((OX + M.x + sx) * e - w / 2), y = Math.round((OY + sy) * e) - h;
  const img = Mc.macaco(M.pose);
  g.save(); g.setTransform(1, 0, 0, 1, 0, 0);
  if (M.dourado) {  // crescendo: pisca entre a silhueta dourada e o macaco
    g.drawImage(tingida(img, OURO, img.chave), x, y, w, h);
  } else {
    g.drawImage(img, x, y, w, h);
    if (M.branco > 0) { g.globalAlpha = Math.min(1, M.branco); g.drawImage(tingida(img, '#FFF7D6', img.chave), x, y, w, h); g.globalAlpha = 1; }
    // os olhos vermelhos brilham no escuro
    if (M.k > 0.9 && M.branco < 0.5) {
      const a = (0.35 + 0.2 * Math.sin(t * 6)) * (1 - 2 * M.branco), s = w / Mc.MW;
      g.globalCompositeOperation = 'lighter';
      for (const cx of [14, 21]) {
        const ex = x + cx * s, ey = y + (9.5 + Mc.MY) * s, gr = g.createRadialGradient(ex, ey, 0, ex, ey, 3 * s);
        gr.addColorStop(0, rgba('#F87171', a)); gr.addColorStop(1, rgba('#F87171', 0));
        g.fillStyle = gr; g.fillRect(ex - 3 * s, ey - 3 * s, 6 * s, 6 * s);
      }
      g.globalCompositeOperation = 'source-over';
    }
  }
  g.restore();
  // o rugido: ondas de choque saindo da boca
  const k = M.k * J.P, bx = M.x + sx + (Mc.BOCA[0] - Mc.MW / 2) * k, by = sy - (Mc.MH - Mc.BOCA[1]) * k;
  for (const o of T.ondas) {
    const d = t - o;
    if (d < 0 || d >= 0.9) continue;
    const u = d / 0.9, r = 6 + 70 * sai(u);
    g.save(); g.globalAlpha = 0.8 * (1 - u); g.strokeStyle = '#FFF3C4'; g.lineWidth = 2;
    g.beginPath(); g.ellipse(bx, by, r, r * 0.75, 0, 0, Math.PI * 2); g.stroke(); g.restore();
  }
  // os socos no peito: um anel dourado
  const px = M.x + sx + (Mc.PEITO[0] - Mc.MW / 2) * k, py = sy - (Mc.MH - Mc.PEITO[1]) * k;
  T.socos.forEach((s0, i) => {
    const d = t - s0;
    if (d < 0 || d >= 0.35) return;
    const u = d / 0.35, lado = i % 2 ? 1 : -1;
    g.save(); g.globalAlpha = 1 - u; g.strokeStyle = OURO; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(px + lado * 4 * k, py, 4 + 22 * sai(u), (4 + 22 * sai(u)) * 0.7, 0, 0, Math.PI * 2); g.stroke(); g.restore();
  });
}

// as faíscas: saem do macaco quando ele brilha e voltam pro Clawd quando ele encolhe
function desenharFaiscas(g, t, J) {
  if (t < T.brilha[0] || t >= T.revela) return;
  const alvo = [J.X0, -12];
  for (const f of J.faiscas) {
    const a0 = T.brilha[0] + f.d, sobe = fatia(t, a0, a0 + 0.6), volta = entra(fatia(t, T.encolhe[0] + f.d * 0.5, T.encolhe[1] - 0.05));
    if (sobe <= 0) continue;
    const x0 = f.x, y0 = f.y - 10 * sobe;
    const x = x0 + (alvo[0] - x0) * volta, y = y0 + (alvo[1] - y0) * volta;
    g.globalAlpha = Math.min(1, sobe * 2) * (0.6 + 0.4 * Math.sin(t * 20 + f.d * 40));
    g.fillStyle = f.cor; g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
  }
  g.globalAlpha = 1;
}

// o Clawd: antes do macaco (olha a lua, o coração, a cauda, treme dourado) e depois (SSJ 4)
function clawdAntes(t, ta) {
  const p = { ta, olhos: t >= T.olha ? 'cima' : 'abertos' }, pu = pulso(t);
  if (pu > 0) { p.sx = 1 + 0.08 * pu; p.sy = 1 + 0.08 * pu; p.tinta = { cor: '#DC2626', a: 0.45 * pu }; }
  if (t >= T.cauda[0]) p.cauda = sai(fatia(t, T.cauda[0], T.cauda[1]));
  if (t >= T.treme[0]) {
    const u = fatia(t, T.treme[0], T.treme[1]);
    Object.assign(p, { x: treme(t, 0.75 + 0.75 * u), sy: 1 - 0.08 * u, olhos: 'fechados', tinta: { cor: OURO, a: 0.85 * u }, aura: 0.25 + 0.55 * u, auraCor: OURO });
  }
  return p;
}
// a aura estoura forte no clarão e na pose de poder e assenta na do SSJ 4 (mais baixa e mais fraca),
// que é a que o tema desenha depois
function clawdDepois(t, ta) {
  const p = { ta, ...A.ativoTransf(A.SSJ4, ta) }, tam = p.aura, alfa = p.auraAlfa ?? 1;
  const u = fatia(t, T.revela, T.revela + 0.7), forte = k => alfa + (1 - alfa) * k;
  p.aura = tam * (u < 0.3 ? 0.2 + 1.3 * sai(u / 0.3) : 1.5 - 0.5 * sai((u - 0.3) / 0.7));
  p.auraAlfa = forte(1 - sai(u));
  if (t < T.revela + 0.12) p.branco = true;
  if (t >= T.poder[0] && t < T.poder[1]) {  // a pose de poder: abaixa, punhos fechados, a aura cresce
    const v = fatia(t, T.poder[0], T.poder[1]), q = Math.sin(Math.PI * v);
    Object.assign(p, { sy: 1 - 0.08 * q, bracos: [1.5 * q, 1.5 * q], aura: tam * (1 + 0.25 * q + 0.06 * Math.sin(t * 30)), auraAlfa: forte(q), olhos: v < 0.8 ? 'fechados' : 'abertos', x: v < 0.7 ? treme(t, 0.4 * q) : 0 });
  }
  return p;
}
function desenharClawd(g, t, J, T0, m) {
  if (macacoEm(J, t)) return;  // é ele
  const depois = t >= T.encolhe[1];
  g.save();
  g.setTransform(T0.a, T0.b, T0.c, T0.d, T0.e, T0.f);
  A.clawdDB(g, depois ? clawdDepois(t, m.T) : clawdAntes(t, m.T));
  if (depois) {
    A.anelClarao(g, (t - T.revela) / 0.8, '#F87171');
    A.anelClarao(g, (t - T.poder[1] + 0.25) / 0.8, '#FCA5A5');
  }
  g.restore();
}

// a trilha (som.js), feita do zero pelo sons-epicos.py
const SD = n => `sons-dragonball/${n}.wav`, VOLUME = 0.5;  // no volume dos outros épicos (~-22 LUFS, medido)
function sons() {
  const L = [[0, SD('ssj4-noite'), 0.6], [T.lua[0], SD('ssj4-lua'), 0.7]];
  for (const b of T.batidas) L.push([b, SD('ssj4-coracao'), 0.95]);
  L.push([T.treme[0], SD('ssj4-cresce'), 0.8], [T.ruge[0], SD('ssj4-ruge'), 1]);
  for (const s of T.socos) L.push([s, SD('ssj4-soco'), 0.8]);
  L.push([T.brilha[0], SD('ssj4-aura'), 0.5, 0.8], [T.encolhe[0] - 0.1, SD('ssj4-encolhe'), 0.7], [T.revela - 0.05, SD('ssj4-explode'), 0.9], [T.revela + 0.2, SD('ssj4-aura'), 0.6], [T.poder[0], SD('ssj4-aura'), 0.5, 1.2]);
  return L.map(([t, a, g, ...r]) => [t, a, g * VOLUME, ...r]);
}

function cena(m) {
  const semente = Math.floor(m.sorteio() * 4294967296);
  const J = montar(m, rng(semente));
  return {
    nome: 'ssj4', dur: T.dur, revela: T.revela, espaco: { frente: 0, tras: 0 }, modos: ['andando'],  // revela: dali em diante já é SSJ 4
    plano: J,  // pros testes
    sons: sons(),
    quadro(g, t, mundo) {
      const T0 = g.getTransform(), mm = mundo || m;
      desenhar(g, t, mm, J);
      desenharClawd(g, t, J, T0, mm);
    },
  };
}

module.exports = { linhaDoTempo, cena, T, macacoEm, pulso, montar };
