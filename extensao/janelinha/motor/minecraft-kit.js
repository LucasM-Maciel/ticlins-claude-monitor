'use strict';
// Kit do tema Minecraft, o mesmo das prévias (p3, p3m, p3b): os mobs recortados das
// texturas do jogo e o que as lutas usam (itens que quicam, orbes de XP, corações, número
// de nível, partículas do jogo, blocos com rachadura, cratera, escudo, flecha).
// Referencial do Clawd: x+ pra frente, y- pra fora do cartão, chão = 0.
// Textura faltando: aquela parte some (nada lança erro); o tema nem sorteia o evento.
const { DEG, sai, entra, tela, cache, IMG, tingida } = require('./comum');
const { larguraLetra } = require('./minecraft-enfeites');

// ---------- mobs ----------
// Peça: [srcX, srcY, larg, alt, dstX, dstY, espelhar, opções]. src = pixels da textura;
// dst = em pixels da textura, (0,0) = meio dos pés, y- = pra cima. Opções: parte (anima ao
// andar: pe/pd pernas, be/bd braços, p1/p2 patas, cab, asa, rabo), onda (gomo da traça),
// giro (graus; dst = PIVÔ na ponta de dentro), rot (gira no meio da borda de cima), r90 (a
// face deitada: corpo de bicho de 4 patas visto de lado), tex (outra textura), mult (cor
// multiplicada: a coleira). "Cabeçudo": cabeça inteira e tronco/pernas cortados, pra caber
// ao lado do Clawd sem a cara virar 3 px.
const LOBO_PECAS = manso => [
  [9, 20, 2, 8, 6.5, -12, 0, { parte: 'rabo', rot: manso ? -120 : -60 }],  // rabo (manso = levantado)
  [0, 20, 2, 8, 4.5, -8, 0, { parte: 'p2', rot: 0 }],                      // pata de trás (de lá)
  [0, 20, 2, 8, -6.5, -8, 0, { parte: 'p1', rot: 0 }],                     // pata da frente (de lá)
  [18, 20, 6, 9, -1.5, -13, 0, { r90: true }],                             // corpo deitado
  [21, 7, 7, 6, -7.5, -14, 0, { r90: true }],                              // juba
  ...(manso ? [[21, 7, 7, 6, -7.5, -14, 0, { r90: true, tex: 'lobo_coleira', mult: '#B02E26' }]] : []),  // coleira vermelha
  [0, 4, 4, 6, -10.5, -13.5, 0, { parte: 'cab' }],                         // cabeça (lado)
  [17, 15, 2, 2, -8.5, -15.5, 0, { parte: 'cab' }],                        // orelha
  [0, 14, 4, 3, -13.5, -10.5, 0, { parte: 'cab' }],                        // focinho
  [5, 14, 1, 1, -13.5, -10.5, 0, { parte: 'cab' }],                        // nariz
  [4, 6, 2, 1, -10, -12, 1, { parte: 'cab' }],                             // olho
  [0, 20, 2, 8, 4.5, -8, 0, { parte: 'p1', rot: 0 }],                      // pata de trás (de cá)
  [0, 20, 2, 8, -6.5, -8, 0, { parte: 'p2', rot: 0 }],                     // pata da frente (de cá)
];
const MOBS = [
  { id: 'zumbiAtaca', tex: 'zumbi', s: 0.8, andar: 'humano', queda: 90, pecas: [  // braços apontando pro Clawd
    [44, 20, 4, 8, -6, -15.5, 1, { parte: 'bd', rot: 90 }],                     // braço de lá
    [4, 20, 4, 4, -4, -6, 0, { parte: 'pe' }], [4, 30, 4, 2, -4, -2, 0, { parte: 'pe' }],
    [4, 20, 4, 4, 0, -6, 1, { parte: 'pd' }], [4, 30, 4, 2, 0, -2, 1, { parte: 'pd' }],
    [20, 20, 8, 6, -4, -14], [20, 30, 8, 2, -4, -8], [8, 8, 8, 8, -4, -22],
    [44, 20, 4, 8, -6, -13, 0, { parte: 'be', rot: 90 }],                      // braço de cá
  ] },
  { id: 'creeper', tex: 'creeper', s: 0.9, andar: 'humano', queda: 90, pecas: [
    [4, 20, 4, 2, -4, -4, 0, { parte: 'pe' }], [4, 24, 4, 2, -4, -2, 0, { parte: 'pe' }],
    [4, 20, 4, 2, 0, -4, 1, { parte: 'pd' }], [4, 24, 4, 2, 0, -2, 1, { parte: 'pd' }],
    [20, 20, 8, 8, -4, -12],                                                    // corpo (8 das 12 linhas)
    [8, 8, 8, 8, -4, -20],                                                      // rosto
  ] },
  { id: 'esqueleto', tex: 'esqueleto', s: 0.8, andar: 'humano', queda: 90, pecas: [
    [2, 18, 2, 6, -3, -6, 0, { parte: 'pe' }], [2, 18, 2, 6, 1, -6, 1, { parte: 'pd' }],
    [20, 20, 8, 6, -4, -14], [20, 30, 8, 2, -4, -8],
    [42, 18, 2, 8, -6, -14, 0, { parte: 'be' }], [42, 18, 2, 8, 4, -14, 1, { parte: 'bd' }],
    [8, 8, 8, 8, -4, -22],
  ] },
  { id: 'aranha', tex: 'aranha', s: 0.75, andar: 'aranha', queda: 180, pecas: [
    [12, 24, 10, 8, -5, -13],                                                   // abdômen
    [20, 2, 14, 2, 4, -10, 0, { giro: 18, parte: 'p1' }],                       // pernas giradas
    [20, 2, 14, 2, 4, -10, 0, { giro: 32, parte: 'p2' }],
    [20, 2, 14, 2, 4, -10, 0, { giro: 46, parte: 'p1' }],
    [20, 2, 14, 2, -4, -10, 1, { giro: 162, parte: 'p2' }],
    [20, 2, 14, 2, -4, -10, 1, { giro: 148, parte: 'p1' }],
    [20, 2, 14, 2, -4, -10, 1, { giro: 134, parte: 'p2' }],
    [40, 12, 8, 8, -4, -13],                                                    // rosto
    [40, 12, 8, 8, -4, -13, 0, { tex: 'aranha_olhos' }],                        // olhos vermelhos
  ] },
  { id: 'slime', tex: 'slime', s: 1.5, andar: 'slime', queda: 90, pecas: [
    [6, 22, 6, 6, -3, -7], [34, 2, 2, 2, -3.25, -6], [34, 6, 2, 2, 1.25, -6], [33, 9, 1, 1, 0, -3],
    [8, 8, 8, 8, -4, -8],                                                       // casca (translúcida na textura)
  ] },
  { id: 'traca', tex: 'silverfish', s: 1.6, andar: 'traca', queda: 'vira', pecas: [  // de lado, cabeça pro Clawd
    [0, 2, 2, 2, -8.5, -2, 0, { onda: 0 }], [0, 6, 2, 3, -6.5, -3, 0, { onda: 1 }], [0, 12, 3, 4, -4.5, -4, 0, { onda: 2 }],
    [0, 19, 3, 3, -1.5, -3, 0, { onda: 3 }], [0, 25, 3, 2, 1.5, -2, 0, { onda: 4 }], [11, 2, 2, 1, 4.5, -1, 0, { onda: 5 }],
    [13, 6, 2, 1, 6.5, -1, 0, { onda: 6 }], [2, 1, 1, 1, -8.5, -2, 0, { onda: 0 }],
  ] },
  { id: 'enderman', tex: 'enderman', s: 0.65, andar: 'humano', queda: 90, pecas: [
    [58, 2, 2, 14, -3, -14, 0, { parte: 'pe' }], [58, 2, 2, 14, 1, -14, 1, { parte: 'pd' }],
    [36, 20, 8, 10, -4, -24],
    // rot 0: a caixa conta o braço girado (na prévia a ponta do braço cortava ao segurar o bloco)
    [58, 2, 2, 16, -6, -24, 0, { parte: 'be', rot: 0 }], [58, 2, 2, 16, 4, -24, 1, { parte: 'bd', rot: 0 }],
    [8, 8, 8, 8, -4, -32, 0, { parte: 'cab' }],
    [8, 8, 8, 8, -4, -32, 0, { parte: 'cab', tex: 'enderman_olhos' }],
  ] },
  { id: 'lobo', tex: 'lobo', s: 0.9, andar: 'quatro', queda: 90, pecas: LOBO_PECAS(false) },
  { id: 'loboManso', tex: 'lobo_manso', s: 0.9, andar: 'quatro', queda: 90, pecas: LOBO_PECAS(true) },
  { id: 'galinha', tex: 'galinha', s: 1.1, andar: 'galinha', queda: 90, pecas: [
    [35, 3, 3, 5, -0.5, -5, 0, { parte: 'p2' }], [32, 2, 3, 1, -0.5, -1, 0, { parte: 'p2' }],  // perna e pé (de lá)
    [0, 15, 6, 8, -4, -11, 0, { r90: true }],                                  // corpo deitado
    [24, 19, 6, 4, -3, -11, 0, { parte: 'asa' }],
    [0, 3, 3, 6, -6, -15, 0, { parte: 'cab' }], [3, 4, 1, 1, -5.5, -14, 0, { parte: 'cab' }],  // cabeça, olho
    [14, 2, 2, 2, -8, -13, 0, { parte: 'cab' }], [4, 7, 2, 2, -7, -11, 0, { parte: 'cab' }],   // bico, barbela
    [35, 3, 3, 5, -2, -5, 0, { parte: 'p1' }], [32, 2, 3, 1, -2, -1, 0, { parte: 'p1' }],     // perna e pé (de cá)
  ] },
];
const MOB = Object.fromEntries(MOBS.map(m => [m.id, m]));
const SS = 4;  // o mob é montado a 4 px por pixel da textura (as peças caem em 1/4 de pixel)

function cantosPeca([, , w, h, dx, dy, , o = {}], rotExtra = 0) {
  if (o.giro != null) {
    const c = Math.cos(o.giro * DEG), s = Math.sin(o.giro * DEG);
    return [[0, -h / 2], [w, -h / 2], [0, h / 2], [w, h / 2]].map(([x, y]) => [dx + x * c - y * s, dy + x * s + y * c]);
  }
  if (o.r90) return [[dx, dy], [dx + h, dy + w]];
  if (o.rot != null || rotExtra) {
    const a = ((o.rot || 0) + rotExtra) * DEG, px = dx + w / 2;
    return [[-w / 2, 0], [w / 2, 0], [-w / 2, h], [w / 2, h]].map(([x, y]) => [px + x * Math.cos(a) - y * Math.sin(a), dy + x * Math.sin(a) + y * Math.cos(a)]);
  }
  return [[dx, dy], [dx + w, dy + h]];
}
function caixaMob(m) {
  let x0 = 1e9, y0 = 1e9, x1 = -1e9, y1 = -1e9, rx1 = -1e9;
  for (const p of m.pecas) {
    const o = p[7] || {};
    for (const [x, y] of cantosPeca(p)) { rx1 = Math.max(rx1, x); x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    if (o.rot != null || ((m.andar === 'quatro' || m.andar === 'galinha') && /^p[12]$/.test(o.parte || ''))) {
      for (const r of [-45, 45]) for (const [x, y] of cantosPeca(p, r)) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
    }
  }
  return { x0: Math.floor(x0) - 2, y0: Math.floor(y0) - 3, x1: Math.ceil(x1) + 2, y1: Math.ceil(y1) + 1, rx1 };
}
for (const m of MOBS) m.caixa = caixaMob(m);

// textura multiplicada por uma cor (a coleira é branca na textura; o jogo pinta com o corante)
const MULTIPLICADAS = cache(8);
function multiplicada(img, cor, chave) {
  const k0 = chave + cor;
  const pronta = MULTIPLICADAS.get(k0);
  if (pronta) return pronta;
  const c = tela(img.width, img.height), x = c.getContext('2d');
  x.drawImage(img, 0, 0); x.globalCompositeOperation = 'multiply'; x.fillStyle = cor; x.fillRect(0, 0, c.width, c.height);
  x.globalCompositeOperation = 'destination-in'; x.drawImage(img, 0, 0);
  return MULTIPLICADAS.set(k0, c);
}
// pose arredondada (1/4 de pixel, 3°): a montagem é guardada, e a diferença não se vê
function arredondaPose(pose) {
  if (!pose) return null;
  const q = {};
  for (const [parte, v] of Object.entries(pose)) {
    q[parte] = v.esconde ? { esconde: true } : { dx: Math.round((v.dx || 0) * 4) / 4, dy: Math.round((v.dy || 0) * 4) / 4, rot: Math.round((v.rot || 0) / 3) * 3 };
  }
  return q;
}
// o mob montado (quadro 0/1 = passo do andar; tinta = cor por cima: dano/branco; pose =
// { parte: { dx, dy, rot, esconde } }), pronto 1x por combinação
const MONTADOS = cache(96);
function montaMob(m, quadro, tinta, pose) {
  const chave = m.id + '|' + quadro + '|' + (tinta || '') + '|' + (pose ? JSON.stringify(pose) : '');
  const pronto = MONTADOS.get(chave);
  if (pronto) return pronto;
  const b = m.caixa, c = tela((b.x1 - b.x0) * SS, (b.y1 - b.y0) * SS), k = c.getContext('2d');
  for (const [sx, sy, w, h, dx, dy, esp, o = {}] of m.pecas) {
    let img = IMG[o.tex || m.tex];
    if (!img) continue;
    if (o.mult) img = multiplicada(img, o.mult, o.tex || m.tex);
    let ox = 0, oy = 0, giro = o.giro, rot = o.rot || 0;
    if (o.parte) {
      if (m.andar === 'humano' && ((quadro === 0 && (o.parte === 'pe' || o.parte === 'bd')) || (quadro === 1 && (o.parte === 'pd' || o.parte === 'be')))) oy = -1;
      if (m.andar === 'aranha' && giro != null) giro += (quadro ? 7 : -7) * (o.parte === 'p1' ? 1 : -1);
      if (m.andar === 'quatro' && (o.parte === 'p1' || o.parte === 'p2')) rot += (quadro ? 1 : -1) * (o.parte === 'p1' ? 22 : -22);
      if (m.andar === 'galinha' && ((quadro === 0 && o.parte === 'p1') || (quadro === 1 && o.parte === 'p2'))) oy = -1;
      if (m.andar === 'galinha' && o.parte === 'asa' && quadro) oy = -0.5;
      const ps = pose && pose[o.parte];
      if (ps) { if (ps.esconde) continue; ox += ps.dx || 0; oy += ps.dy || 0; rot += ps.rot || 0; }
    }
    if (m.andar === 'traca' && o.onda != null) oy = (o.onda + quadro) % 2 ? -0.5 : 0;
    k.save();
    if (giro != null) { k.translate((dx + ox - b.x0) * SS, (dy + oy - b.y0) * SS); k.rotate(giro * DEG); k.translate(0, -h / 2 * SS); }
    else if (o.r90) { k.translate((dx + ox - b.x0) * SS, (dy + oy - b.y0) * SS); k.translate(h * SS, 0); k.rotate(Math.PI / 2); }
    else if (o.rot != null || rot) { k.translate((dx + ox + w / 2 - b.x0) * SS, (dy + oy - b.y0) * SS); k.rotate(rot * DEG); k.translate(-w / 2 * SS, 0); }
    else k.translate((dx + ox - b.x0) * SS, (dy + oy - b.y0) * SS);
    if (esp) { k.translate(w * SS, 0); k.scale(-1, 1); }
    k.drawImage(img, sx, sy, w, h, 0, 0, w * SS, h * SS);
    k.restore();
  }
  if (tinta) { k.globalCompositeOperation = 'source-atop'; k.fillStyle = tinta; k.fillRect(0, 0, c.width, c.height); }
  return MONTADOS.set(chave, c);
}
// o: { quadro, tinta, queda (0..1), sx, sy, esc (tamanho), vira (olha pro outro lado), pose, alfa }
function desenhaMob(g, m, x, y, o = {}) {
  if (!IMG[m.tex]) return;
  const c = montaMob(m, o.quadro || 0, o.tinta, arredondaPose(o.pose));
  const b = m.caixa, s = m.s * (o.esc || 1);
  g.save(); g.translate(x, y);
  if (o.alfa != null) g.globalAlpha *= Math.max(0, Math.min(1, o.alfa));
  if (o.vira) g.scale(-1, 1);
  const q = o.queda || 0;
  if (q) {
    if (m.queda === 90) { const px = b.rx1 * s; g.translate(px, 0); g.rotate(q * 90 * DEG); g.translate(-px, 0); }
    else {
      const cy = (b.y0 + b.y1) / 2 * s;
      g.translate(0, cy);
      if (m.queda === 180) g.rotate(q * 180 * DEG); else g.scale(1, Math.cos(q * Math.PI) || 0.001);
      g.translate(0, -cy);
    }
  }
  if (o.sx || o.sy) g.scale(o.sx || 1, o.sy || 1);
  g.drawImage(c, b.x0 * s, b.y0 * s, (b.x1 - b.x0) * s, (b.y1 - b.y0) * s);
  g.restore();
}
// onde fica o meio do mob (pra fumaça), já tombado
function meioMob(m, x, queda, esc = 1) {
  const b = m.caixa, s = m.s * esc, cx = (b.x0 + b.x1) / 2 * s, cy = (b.y0 + b.y1) / 2 * s;
  if (m.queda === 90 && queda) { const px = b.rx1 * s; return [x + px - cy, cx - px]; }
  return [x + cx, cy];
}
// empurrão do golpe (D = s desde o golpe): vai 6 px pra trás com um pulinho e volta andando
function recuo(D) {
  if (D < 0.2) { const u = D / 0.2; return { dx: 6 * sai(u), dy: -3 * Math.sin(Math.PI * u), andando: false }; }
  if (D < 0.45) return { dx: 6 * (1 - (D - 0.2) / 0.25), dy: 0, andando: true };
  return { dx: 0, dy: 0, andando: false };
}

// ---------- partículas do jogo ----------
// fumaça da morte (poof: generic_7 -> generic_0) e a explosão (explosion_0..15)
const CINZAS = ['#B3B3B3', '#CCCCCC', '#E6E6E6', '#FFFFFF'];
function fazPoof(r, n) {
  return Array.from({ length: n }, () => ({ ox: r() - 0.5, oy: r() - 0.5, vx: (r() - 0.5) * 14, vy: -(5 + r() * 12), tam: 5 + r() * 4, vida: 0.45 + r() * 0.3, cor: CINZAS[Math.floor(r() * 4)] }));
}
function desenhaPoof(g, lista, cx, cy, w, h, d) {
  for (const p of lista) {
    if (d < 0 || d >= p.vida) continue;
    const f = 7 - Math.min(7, Math.floor(d / p.vida * 8)), img = IMG['poof' + f];
    if (!img) continue;
    const x = cx + p.ox * w * 0.9 + p.vx * d, y = cy + p.oy * h * 0.8 + p.vy * d;
    g.drawImage(tingida(img, p.cor, 'poof' + f), x - p.tam / 2, y - p.tam / 2, p.tam, p.tam);
  }
}
function fazExplosao(r, n) {
  return Array.from({ length: n }, (_, i) => ({ atraso: i === 0 ? 0 : r() * 0.22, vida: 0.38 + r() * 0.14, ox: i === 0 ? 0 : (r() - 0.5) * 22, oy: i === 0 ? 0 : (r() - 0.5) * 16, tam: 15 + r() * 10, cor: ['#999999', '#B3B3B3', '#CCCCCC', '#E6E6E6', '#FFFFFF'][Math.floor(r() * 5)] }));
}
function desenhaExplosao(g, lista, cx, cy, d) {
  for (const p of lista) {
    const e = d - p.atraso;
    if (e < 0 || e >= p.vida) continue;
    const f = Math.min(15, Math.floor(e / p.vida * 16)), img = IMG['explosao' + f];
    if (!img) continue;
    g.drawImage(tingida(img, p.cor, 'exp' + f), cx + p.ox - p.tam / 2, cy + p.oy - p.tam / 2, p.tam, p.tam);
  }
}

// ---------- kit de "jogo" ----------
const GRAV = 300;  // px/s², pra itens, orbes e cacos
// algo jogado de (x0,y0) com (vx,vy), quicando no chão (y = 0)
function quique(e, x0, y0, vx, vy, amort = 0.45) {
  let x = x0, y = y0, v = vy, h = vx, t = e;
  for (let k = 0; k < 5; k++) {
    const a = GRAV / 2, tc = (-v + Math.sqrt(Math.max(0, v * v - 4 * a * y))) / (2 * a);
    if (t <= tc) return { x: x + h * t, y: Math.min(0, y + v * t + a * t * t) };
    t -= tc; x += h * tc; y = 0; v = -(v + GRAV * tc) * amort; h *= 0.5;
    if (Math.abs(v) < 18) return { x: x + h * Math.min(t, 0.12), y: 0 };
  }
  return { x, y: 0 };
}
// item caído (16x16 do jogo): pula, quica, gira em pé (como no jogo) e depois voa até o Clawd
function desenhaDrop(g, nome, e, x0, y0, vx, pega = 0.9, tam = 7, alvoX = 0) {
  if (e < 0 || !IMG[nome]) return;
  let p = quique(e, x0, y0, vx, -75), esc = 1;
  if (e >= pega) {
    const u = (e - pega) / 0.25;
    if (u >= 1) return;
    const q = quique(pega, x0, y0, vx, -75);
    p = { x: q.x + (alvoX - q.x) * entra(u), y: q.y + (-8 - q.y) * entra(u) }; esc = 1 - 0.5 * u;
  }
  g.save(); g.translate(p.x, p.y - 1 + (e > 0.5 ? Math.sin(e * 5) * 0.7 - 0.7 : 0));
  g.scale((Math.abs(Math.cos(e * 3.2)) + 0.08) * esc, esc);
  g.drawImage(IMG[nome], -tam / 2, -tam, tam, tam);
  g.restore();
}
// orbe de XP: a textura do jogo (4x4 tamanhos) pintada como o jogo pinta (vermelho e azul oscilam)
const ORBE_FASES = 16;
const ORBES = cache(64);
function orbePintado(ic, fase) {
  const k = ic + '_' + fase;
  const pronto = ORBES.get(k);
  if (pronto) return pronto;
  const f = fase / ORBE_FASES * 2 * Math.PI, r = (Math.sin(f) + 1) * 0.5, b = (Math.sin(f + 4.1887903) + 1) * 0.1;
  const c = tela(16, 16), x = c.getContext('2d'), sx = (ic % 4) * 16, sy = Math.floor(ic / 4) * 16;
  x.drawImage(IMG.orbe, sx, sy, 16, 16, 0, 0, 16, 16);
  x.globalCompositeOperation = 'multiply'; x.fillStyle = `rgb(${Math.round(r * 255)},255,${Math.round(b * 255)})`; x.fillRect(0, 0, 16, 16);
  x.globalCompositeOperation = 'destination-in'; x.drawImage(IMG.orbe, sx, sy, 16, 16, 0, 0, 16, 16);
  return ORBES.set(k, c);
}
function desenhaOrbe(g, x, y, ic, t) {
  if (!IMG.orbe) return;
  g.drawImage(orbePintado(ic, Math.floor(((t * 10) / (2 * Math.PI)) * ORBE_FASES) % ORBE_FASES), x - 4.5, y - 4.5, 9, 9);
}
function fazOrbes(r, n) { return Array.from({ length: n }, () => ({ vx: (r() - 0.5) * 50, vy: -(45 + r() * 40), ic: Math.floor(r() * 3), fase: r() * 10, atraso: r() * 0.12 })); }
// orbes saltam do mob e, depois de 0,45 s, voam até o Clawd (somem em 0,8 s + atraso)
function desenhaOrbes(g, lista, x0, y0, e, alvoX = 0) {
  for (const o of lista) {
    const k = e - o.atraso;
    if (k < 0) continue;
    let p;
    if (k < 0.45) p = quique(k, x0, y0, o.vx, o.vy, 0.3);
    else {
      const u = (k - 0.45) / 0.35;
      if (u >= 1) continue;
      const q = quique(0.45, x0, y0, o.vx, o.vy, 0.3);
      p = { x: q.x + (alvoX - q.x) * entra(u), y: q.y + (-7 - q.y) * entra(u) };
    }
    desenhaOrbe(g, p.x, p.y - 2.5, o.ic, k + o.fase);
  }
}
// número de nível com a letra do jogo: contorno preto e verde #80FF20, como na barra de XP
function numeroMC(g, s, cx, y, cor = '#80FF20', esc = 0.75) {
  if (!IMG.fonte) return;
  s = String(s);
  let w = 0;
  for (const ch of s) w += larguraLetra(ch.charCodeAt(0)) + 1;
  w -= 1;
  const x0 = cx - w * esc / 2;
  for (const [dx, dy, c] of [[-1, 0, '#000'], [1, 0, '#000'], [0, -1, '#000'], [0, 1, '#000'], [0, 0, cor]]) {
    const img = tingida(IMG.fonte, c, 'fonte');
    let px = x0 + dx * esc;
    for (const ch of s) {
      const k = ch.charCodeAt(0), lw = larguraLetra(k);
      if (k < 256 && lw) g.drawImage(img, (k % 16) * 8, Math.floor(k / 16) * 8, lw, 8, px, y + dy * esc, lw * esc, 8 * esc);
      px += (lw + 1) * esc;
    }
  }
}
// nível em cima do Clawd: aparece quando chega XP; se sobe de nível, cresce, brilha e o número troca
function desenhaNivel(g, e, nivel, sobe) {
  if (e < 0 || e > 1.3 || (nivel <= 0 && !sobe)) return;  // nível 0 o jogo não mostra
  const a = e < 0.1 ? e / 0.1 : e > 1.0 ? (1.3 - e) / 0.3 : 1;
  g.save(); g.globalAlpha *= a;
  if (sobe) {
    const u = Math.min(1, e / 0.25), r = 6 + 8 * sai(u);
    g.save(); g.translate(0, -31); g.globalAlpha *= 1 - u * 0.6;
    g.fillStyle = '#FFF59D';
    for (let i = 0; i < 8; i++) { g.rotate(Math.PI / 4); g.fillRect(-0.5, -r, 1, r * 0.55); }
    g.restore();
    numeroMC(g, e < 0.12 ? nivel - 1 : nivel, 0, -35, '#80FF20', 1 + (e < 0.4 ? 0.45 * Math.sin(Math.PI * e / 0.4) : 0));
  } else numeroMC(g, nivel, 0, -35, '#80FF20', 1);
  g.restore();
}
// corações (gui/sprites/hud/heart): 5 = 10 de vida, em cima do Clawd; ouro = absorção (do totem)
function desenhaCoracoes(g, vida, ouro = 0, pisca = false, alfa = 1) {
  if (alfa <= 0) return;
  const n = 5 + Math.ceil(ouro / 2), passo = 4.6, x0 = -(n * passo) / 2;
  const icone = (nome, i) => { if (IMG[nome]) g.drawImage(IMG[nome], x0 + i * passo, -26, 5, 5); };
  g.save(); g.globalAlpha *= alfa;
  for (let i = 0; i < n; i++) {
    if (i < 5) {
      icone(pisca ? 'coracao_vazio_pisca' : 'coracao_vazio', i);
      const v = vida - i * 2;
      if (v >= 2) icone('coracao_cheio', i); else if (v === 1) icone('coracao_meio', i);
    } else { icone('coracao_vazio', i); icone('coracao_ouro', i); }
  }
  g.restore();
}
const CINZA_CLARO = ['#999999', '#B3B3B3', '#CCCCCC', '#E6E6E6', '#FFFFFF'];
function desenhaVarrida(g, x, y, e, cor = '#E6E6E6', tam = 22) {  // sweep_0..7 em 0,25 s
  if (e < 0 || e >= 0.25) return;
  const f = Math.floor(e / 0.25 * 8), img = IMG['varrida' + f];
  if (img) g.drawImage(tingida(img, cor, 'varrida' + f), x - tam / 2, y - tam / 2, tam, tam);
}
function fazFaiscas(r, n, vel = 60) {
  return Array.from({ length: n }, () => { const a = r() * 2 * Math.PI, v = vel * (0.5 + r() * 0.7); return { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 15, vida: 0.35 + r() * 0.25, cor: CINZA_CLARO[1 + Math.floor(r() * 4)], tam: 3 + r() * 1.5 }; });
}
function desenhaCritico(g, lista, cx, cy, e) {  // estrelinhas do golpe crítico (particle/critical_hit)
  if (e < 0 || !IMG.critico) return;
  const k = 1 - Math.exp(-4 * e);  // freio do ar
  for (const p of lista) {
    if (e >= p.vida) continue;
    g.save(); g.globalAlpha *= 1 - e / p.vida;
    g.drawImage(tingida(IMG.critico, p.cor, 'critico'), cx + p.vx * k / 4 - p.tam / 2, cy + p.vy * k / 4 + 20 * e * e - p.tam / 2, p.tam, p.tam);
    g.restore();
  }
}
// pontinhos coloridos (generic_0..7): o portal roxo do enderman, a fumaça cinza
function fazPontos(r, n, cores, vel = 20, vida = 0.6) {
  return Array.from({ length: n }, () => ({ ox: (r() - 0.5) * 2, oy: (r() - 0.5) * 2, vx: (r() - 0.5) * vel, vy: (r() - 0.5) * vel - vel * 0.3, vida: vida * (0.6 + r() * 0.6), cor: cores[Math.floor(r() * cores.length)], tam: 2 + r() * 2.5 }));
}
function desenhaPontos(g, lista, cx, cy, w, h, e) {
  if (e < 0) return;
  for (const p of lista) {
    if (e >= p.vida) continue;
    const u = e / p.vida, f = 7 - Math.min(7, Math.floor(u * 8)), img = IMG['poof' + f];
    if (!img) continue;
    g.save(); g.globalAlpha *= 1 - u * 0.6;
    g.drawImage(tingida(img, p.cor, 'poof' + f), cx + p.ox * w / 2 + p.vx * e - p.tam / 2, cy + p.oy * h / 2 + p.vy * e - p.tam / 2, p.tam, p.tam);
    g.restore();
  }
}
const ROXOS = ['#E64DFF', '#B31FE6', '#CC33FF', '#8A1FB3', '#D966FF'];
// cacos de bloco (pedaços 4x4 da textura), com gravidade e giro
function fazCacos(r, n, vel = 70, tam = 2) {
  return Array.from({ length: n }, () => ({ sx: Math.floor(r() * 12), sy: Math.floor(r() * 12), vx: (r() - 0.5) * vel, vy: -(vel * 0.4 + r() * vel * 0.8), giro: (r() - 0.5) * 12, tam: tam + r() * tam * 0.8, vida: 0.7 + r() * 0.5 }));
}
function desenhaCacos(g, lista, bloco, cx, cy, e) {
  const img = IMG[bloco];
  if (!img || e < 0) return;
  for (const p of lista) {
    if (e >= p.vida) continue;
    const x = cx + p.vx * e, y = Math.min(0, cy + p.vy * e + GRAV / 2 * e * e);
    g.save(); g.globalAlpha *= e > p.vida - 0.2 ? (p.vida - e) / 0.2 : 1; g.translate(x, y - p.tam / 2); g.rotate(p.giro * e);
    g.drawImage(img, p.sx, p.sy, 4, 4, -p.tam / 2, -p.tam / 2, p.tam, p.tam);
    g.restore();
  }
}
// um bloco "de pé" na frente do Clawd (textura 16x16), com as rachaduras do jogo (destroy_stage_0..9)
function desenhaBloco(g, bloco, x, lado, progresso = -1, brota = 1) {
  if (!IMG[bloco] || brota <= 0) return;
  g.save(); g.translate(x + lado / 2, 0); g.scale(1, brota); g.translate(-lado / 2, 0);
  g.drawImage(IMG[bloco], 0, -lado, lado, lado);
  if (progresso >= 0) {
    const racha = IMG['racha' + Math.min(9, Math.floor(progresso * 10))];
    if (racha) { g.globalAlpha *= 0.85; g.drawImage(racha, 0, -lado, lado, lado); }
  }
  g.restore();
}
// brilho do diamante: estrelinhas de 4 pontas piscando
function desenhaBrilhos(g, x, y, w, h, t, n = 3) {
  g.fillStyle = '#FFFFFF';
  for (let i = 0; i < n; i++) {
    const f = (t * 1.6 + i / n) % 1, a = Math.sin(Math.PI * f);
    if (a < 0.15) continue;
    const k = Math.floor(t * 1.6 + i / n);
    const px = x + ((i * 37 + k * 13) % 10) / 10 * w, py = y + ((i * 53 + k * 29) % 10) / 10 * h, r = 1 + 1.5 * a;
    g.save(); g.globalAlpha *= a;
    g.fillRect(px - 0.4, py - r, 0.8, 2 * r); g.fillRect(px - r, py - 0.4, 2 * r, 0.8);
    g.restore();
  }
}
// cratera da explosão: um "dente" na borda do cartão, com a terra à mostra
function desenhaCratera(g, cx, raio, alfa = 1) {
  if (alfa <= 0) return;
  g.save(); g.globalAlpha *= Math.min(1, alfa);
  g.beginPath(); g.ellipse(cx, 0, raio, raio * 0.55, 0, 0, Math.PI); g.closePath(); g.clip();
  if (IMG.terra) for (let x = cx - raio - 16; x < cx + raio; x += 16) g.drawImage(IMG.terra, x, 0, 16, 16);
  g.fillStyle = 'rgba(0,0,0,.45)'; g.fillRect(cx - raio, 0, raio * 2, raio);
  g.restore();
}
// o escudo (entity/shield/shield_base_nopattern: frente em (1,1) 12x22), 0,45 px por pixel
function desenhaEscudo(g, x, y, giro = 0) {
  if (!IMG.escudo) return;
  g.save(); g.translate(x, y); g.rotate(giro * DEG); g.drawImage(IMG.escudo, 1, 1, 12, 22, -2.7, -5, 5.4, 9.9); g.restore();
}
// flecha de lado (entity/projectiles/arrow: tira (0,0) 16x5, ponta pra direita); ang em graus
function desenhaFlecha(g, x, y, ang) {
  if (!IMG.flecha) return;
  g.save(); g.translate(x, y); g.rotate(ang * DEG); g.drawImage(IMG.flecha, 0, 0, 16, 5, -8, -1.25, 8, 2.5); g.restore();
}

module.exports = {
  MOB, desenhaMob, meioMob, recuo, fazPoof, desenhaPoof, fazExplosao, desenhaExplosao, quique, desenhaDrop,
  desenhaOrbe, fazOrbes, desenhaOrbes, numeroMC, desenhaNivel, desenhaCoracoes, desenhaVarrida, fazFaiscas, desenhaCritico,
  fazPontos, desenhaPontos, ROXOS, fazCacos, desenhaCacos, desenhaBloco, desenhaBrilhos, desenhaCratera, desenhaEscudo, desenhaFlecha,
};
