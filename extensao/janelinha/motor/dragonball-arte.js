'use strict';
// Tema Dragon Ball: os desenhos (prévia 3, escolhas do dono). Tudo desenhado aqui, nada
// copiado do anime nem de jogo, sem logo nem rosto de personagem: o Clawd veste o tema;
// robô, monstrinho, meteoro e dragão são genéricos. No referencial do Clawd: origem entre
// os pés, x+ pra frente, y- pra fora do cartão.
const { DEG, lim, sai, tela, cache, arte, tingida, rng, rgba, mistura } = require('./comum');
const { desenhaClawd } = require('./clawd');

const fatia = (t, a, b) => lim((t - a) / (b - a), 0, 1);

// ---------- o Clawd de gi e cabelo (roupa C da prévia) ----------
const DB = {
  corpo: '#D77757', olho: '#1A1A1A', gi: '#F58A1F', giDobra: '#C8650E', azul: '#2453C9', azulEsc: '#1A3A94',
  cabelo: '#161616', cabeloLuz: '#454545', aura: '#FDE047',
};
// g gi, z dobra, u gola, w punho, f faixa, h cabelo, j brilho do cabelo; o cabelo cresce 4 meias-fileiras pra cima
const GI = ['.#wggggguugggggw#.', '.#wggggggzgggggw#.', '...ffffffffffff...', '...gggggggfgggg...', '....A.B....A.B....', '....A.B....A.B....'];
const CABELO = ['......h...h.......', '..h..hh..hhh...h..', '..hhhjhhhhhhhhhh..', '.hhhjhhhhhhhhhhhhh', 'hhhhhhhhhhhhhhhhh.', '...hh#hh##hh#hh...', '...##o######o##...', '...##o######o##...'];
const ROUPA = 'dragonball';
const ROUPAS = {
  [ROUPA]: {
    linhas: [...CABELO, ...GI],
    cores: { '#': DB.corpo, o: DB.olho, g: DB.gi, z: DB.giDobra, u: DB.azulEsc, w: DB.azul, f: DB.azul, h: DB.cabelo, j: DB.cabeloLuz },
    perna: [DB.gi, DB.azul], corpo: DB.corpo,
  },
};
const ALTURA = ROUPAS[ROUPA].linhas.length;  // 14 meias-fileiras

// SSJ 3: crina comprida atrás do corpo (colunas -6..2 do Clawd, meias-fileiras 2..13 do sprite)
const CRINA = ['......hhh', '....hhhhh', '..hhhhhhh', '.hhhhhhhh', 'hhhhjhhhh', 'hhhhhhhhh', 'hhhjhhhh.', '.hhhhhhh.', '.hhhhhhj.', '..hhhhh..', '..hhhh...', '...hh....'];
function crina(g, longo, cabelo, L, t, dy, branco) {
  const n = Math.ceil(lim(longo, 0, 1) * CRINA.length);
  const escuro = mistura(cabelo[0], '#000000', 0.4), vazio = (r, c) => r >= n || c < 0 || c >= 9 || CRINA[r][c] === '.';
  for (let r = 0; r < n; r++) {
    const balanco = Math.round(Math.sin(t * 5 - Math.floor(r / 3) * 0.9) * (r / 11)) * 1.5;  // a ponta balança mais
    for (let c = 0; c < 9; c++) {
      const ch = CRINA[r][c];
      if (ch === '.') continue;
      const borda = vazio(r, c - 1) || vazio(r + 1, c);
      g.fillStyle = branco || (borda ? escuro : ch === 'j' ? cabelo[1] : cabelo[0]);
      g.fillRect((c - 15) * 1.5 + balanco, (r + 2 - L) * 1.5 + dy, 1.5, 1.5);
    }
  }
}

// ---------- aura ----------
// Colunas de 1,5 px numa elipse em volta do Clawd; a ponta de cada coluna ondula (chama).
// sobe: 0..1 (cresce dos pés pra cima). e (estilo): calma, fina, forte, claro [meio, luz], brilho.
// As línguas de fogo repetem a cada 20π/9 s (9 e 6,3 rad/s fecham juntas): o corpo da aura
// é feito 1x por fase (em meio pixel: as colunas de 1,5 ficam exatas) e guardado; "sobe"
// (a aura crescendo dos pés, o pulso do Kaioken) estica a pronta na vertical a partir do chão.
const AURAS = cache(130);
const FASES = 120, AURA_W = 54, AURA_TOPO = 46, AURA_PE = 4, AURA_H = AURA_TOPO + AURA_PE, CHAO = 1.5;
function auraPronta(cor, e, fase, periodo) {
  const chave = `${cor},${JSON.stringify(e)},${fase}`;
  const pronta = AURAS.get(chave);
  if (pronta) return pronta;
  const img = tela(AURA_W * 2, AURA_H * 2), k = img.getContext('2d');
  k.scale(2, 2); k.translate(AURA_W / 2, AURA_TOPO);
  corpoAura(k, (fase + 0.5) / FASES * periodo, 1, 1, cor, e);
  return AURAS.set(chave, img);
}
function aura(g, t, sobe = 1, alfa = 1, cor = DB.aura, e = {}) {
  if (!(sobe > 0) || !(alfa > 0)) return;
  cor = cor || DB.aura; e = e || {};
  const vel = e.calma ? 0.45 : e.forte ? 1.3 : 1, periodo = 20 * Math.PI / 9 / vel;
  const fase = Math.floor((((t % periodo) + periodo) % periodo) / periodo * FASES) % FASES;
  g.save(); g.globalAlpha *= Math.min(1, alfa);
  g.drawImage(auraPronta(cor, e, fase, periodo), -AURA_W / 2, CHAO - (AURA_TOPO + CHAO) * sobe, AURA_W, AURA_H * sobe);
  g.restore();
  faiscasAura(g, t, sobe, alfa, cor, e);
}
function corpoAura(g, t, sobe, alfa, cor, e) {
  const [c1, c2] = e.claro || [0.45, 0.85];
  const P = 1.5, q = v => Math.round(v / P) * P, meio = mistura(cor, '#FFFFFF', c1), luz = mistura(cor, '#FFFFFF', c2);
  const larg = e.fina ? 18 : 21, alt = e.forte ? 27 : e.calma ? 22 : 24, vel = e.calma ? 0.45 : e.forte ? 1.3 : 1, ling = e.calma ? 0.4 : e.forte ? 1.25 : 1;
  const [a1, a2, a3] = e.fina ? [0.05, 0, 0] : e.forte ? [0.85, 0.75, 0.6] : [0.72, 0.7, 0.6];
  const n = Math.floor(larg / P);
  for (let i = -n; i <= n; i++) {
    const x = i * P, k = 1 - (x / larg) ** 2;
    if (k <= 0) continue;
    const lingua = ling * (6 * Math.max(0, Math.sin(i * 0.9 + t * 9 * vel)) + 4 * Math.max(0, Math.sin(i * 0.47 - t * 6.3 * vel)));
    const h = Math.max(0, (alt * Math.sqrt(k) + lingua) * sobe);
    g.fillStyle = rgba(cor, a1 * alfa); g.fillRect(x - P / 2, 1.5 - q(h), P, q(h));
    if (e.fina) { g.fillStyle = rgba(luz, 0.8 * alfa); g.fillRect(x - P / 2, 1.5 - q(h), P, Math.min(q(h), 2 * P)); continue; }  // só a ponta
    g.fillStyle = rgba(meio, a2 * alfa); g.fillRect(x - P / 2, 1.5 - q(h * 0.72), P, q(h * 0.72));
    if (a3 && Math.abs(i) <= 9) { g.fillStyle = rgba(luz, a3 * alfa); g.fillRect(x - P / 2, 1.5 - q(h * 0.45), P, q(h * 0.45)); }
  }
}
function faiscasAura(g, t, sobe, alfa, cor, e) {
  const P = 1.5, q = v => Math.round(v / P) * P;
  const larg = e.fina ? 18 : 21, alt = e.forte ? 27 : e.calma ? 22 : 24, vel = e.calma ? 0.45 : e.forte ? 1.3 : 1;
  const nf = e.calma ? 3 : 6;
  for (let k = 0; k < nf; k++) {  // faíscas que sobem
    const f = (t * 1.25 * vel + k / nf) % 1, x = ((k * 23) % (larg * 1.4)) - larg * 0.7;
    g.fillStyle = rgba(k % 2 ? '#FFFFFF' : cor, alfa * (1 - f) * Math.min(1, sobe));
    g.fillRect(q(x), q(1 - f * (alt + 14) * Math.min(1, sobe)), P, 3);
  }
  if (e.brilho) for (let k = 0; k < 4; k++) {  // brilhinhos girando devagar (Instinto)
    const f = (t * 0.35 + k / 4) % 1, an = f * 2 * Math.PI + k, x = Math.cos(an) * (larg + 3), y = -12 + Math.sin(an) * 12;
    const a = alfa * Math.sin(Math.PI * ((t * 1.1 + k * 0.37) % 1));
    if (!(a > 0)) continue;
    g.save(); g.globalAlpha *= Math.min(1, a);
    g.fillStyle = e.brilho; g.fillRect(q(x) - P, q(y), 3 * P, P); g.fillRect(q(x), q(y) - P, P, 3 * P);
    g.fillStyle = '#FFFFFF'; g.fillRect(q(x), q(y), P, P);
    g.restore();
  }
}
// raios elétricos piscando em volta (SSJ 2): até 3 zigue-zagues de 7 pixels, sorteados a cada 0,09 s
function raiosEletricos(g, t, L = ALTURA, cor = '#7DD3FC') {
  const passo = Math.floor(t / 0.09), P = 1.5;
  for (let k = 0; k < 4; k++) {
    const r = rng(passo * 7 + k * 131 + 1);
    if (r() > 0.65) continue;
    const an = r() * 2 * Math.PI;
    let x = Math.cos(an) * 16, y = -L * 0.75 + Math.sin(an) * 13;
    const dx = Math.cos(an + Math.PI / 2) > 0 ? P : -P, dy2 = r() < 0.5 ? P : -P;
    for (let j = 0; j < 7; j++) {
      g.fillStyle = j % 3 === 1 ? '#FFFFFF' : cor;
      g.fillRect(Math.round(x / P) * P, Math.round(y / P) * P, P, P);
      if (j % 2) x += dx; else y += dy2;
      if (r() < 0.3) x -= dx;
    }
  }
}
// o raio que cai do céu na entrada do SSJ 2; u 0..1 = quanto já desceu
function raioCaindo(g, u, L, a = 1) {
  if (u <= 0 || a <= 0) return;
  const r = rng(99), P = 1.5, topo = -78, fim = -L * 1.5, y1 = topo + (fim - topo) * lim(u, 0, 1);
  g.save(); g.globalAlpha *= Math.min(1, a);
  let x = 6;
  for (let y = topo; y < y1; y += P) {
    if (r() < 0.35) x += (r() < 0.5 ? -P : P) * 2;
    g.fillStyle = '#7DD3FC'; g.fillRect(Math.round(x / P) * P - P, y, 3 * P, P);
    g.fillStyle = '#FFFFFF'; g.fillRect(Math.round(x / P) * P, y, P, P);
  }
  g.restore();
}
// poeira e pedrinhas subindo do chão (entrada do SSJ 3)
function poeira(g, t, forca = 1) {
  for (let k = 0; k < 9; k++) {
    const f = (t * 1.6 + k / 9) % 1, x = ((k * 37) % 44) - 22, y = -f * 26 * forca;
    g.fillStyle = rgba(k % 3 ? '#A8A29E' : '#D6D3D1', 1 - f);
    g.fillRect(Math.round(x / 1.5) * 1.5 + Math.sin(t * 9 + k) * 0.75, Math.round(y / 1.5) * 1.5, 1.5, 1.5);
  }
}
// brilhinhos prateados que vão aparecendo (entrada do Instinto); te = s desde o começo
const PONTOS_INST = [[-16, -20], [15, -24], [-11, -32], [19, -10], [-20, -6], [6, -36]];
function brilhosEntrada(g, te) {
  PONTOS_INST.forEach(([x, y], k) => {
    const d = te - (0.2 + 0.25 * k);
    if (d < 0 || d > 0.9) return;
    g.save(); g.globalAlpha *= Math.sin(Math.PI * d / 0.9);
    g.fillStyle = '#E5E7EB'; g.fillRect(x - 1.5, y, 4.5, 1.5); g.fillRect(x, y - 1.5, 1.5, 4.5);
    g.fillStyle = '#93C5FD'; g.fillRect(x, y, 1.5, 1.5);
    g.restore();
  });
}
// anel de clarão (onda de choque); u 0..1
function anelClarao(g, u, cor = '#FFFFFF') {
  if (u == null || u < 0 || u >= 1) return;
  const r = 4 + 24 * sai(u);
  g.save(); g.globalAlpha *= 1 - u; g.strokeStyle = cor; g.lineWidth = 1.5;
  g.beginPath(); g.ellipse(0, -10, r, r * 0.8, 0, 0, 2 * Math.PI); g.stroke(); g.restore();
}

// ---------- transformações (sorteadas pelo tema; força 1 = mais fraca) ----------
const VOLTA = 0.45;  // s: o cabelo pisca e a aura encolhe
const treme = (te, a) => (Math.floor(te / 0.05) % 2 ? a : -a);
const VARIACOES = [
  { id: 'ssj', forca: 2, cabelo: ['#FDE047', '#FFFBD1'], aura: '#FDE047', estilo: {}, entrada: 1.9 },
  { id: 'ssj2', forca: 3, cabelo: ['#FDE047', '#FFFFFF'], aura: '#FDE047', estilo: {}, raios: true, entrada: 1.7 },
  { id: 'ssj3', forca: 4, cabelo: ['#FBBF24', '#FEF3C7'], aura: '#FDE047', estilo: {}, longo: true, entrada: 2.4 },
  { id: 'deus', forca: 5, cabelo: ['#D7263D', '#FF8A8A'], aura: '#E11D48', estilo: { calma: true, claro: [0.25, 0.65] }, entrada: 2.0 },
  { id: 'blue', forca: 6, cabelo: ['#22D3EE', '#CFFAFE'], aura: '#38BDF8', estilo: {}, entrada: 1.3 },
  { id: 'instinto', forca: 7, cabelo: ['#D1D5DB', '#FFFFFF'], aura: '#E5E7EB', estilo: { calma: true, fina: true, brilho: '#93C5FD' }, entrada: 2.4 },
  { id: 'kaioken', forca: 1, cabelo: null, aura: '#EF4444', estilo: { forte: true, claro: [0.15, 0.5] }, entrada: 1.2 },
];
const VAR = Object.fromEntries(VARIACOES.map(v => [v.id, v]));
const cabeloEm = (v, k) => [mistura(DB.cabelo, v.cabelo[0], k), mistura(DB.cabeloLuz, v.cabelo[1], k)];
function ativoTransf(v, t) {
  const R = { cabelo: v.cabelo, aura: 1, auraCor: v.aura, auraEstilo: v.estilo };
  if (v.raios) R.raios = true;
  if (v.longo) R.longo = 1;
  if (v.id === 'kaioken') { const s = Math.sin(2 * Math.PI * t / 0.5); R.aura = 1 + 0.12 * s; R.tinta = { cor: '#EF4444', a: 0.14 + 0.1 * s }; }
  return R;
}
const ESTRELINHA_AZUL = ['..#..', '..#..', '##w##', '..#..', '..#..'];
// v = variação; te = s desde o começo da entrada; tv = s desde o começo da volta (ou null); t = relógio
// devolve { R (vai pro Clawd), pose (só na entrada: ele fica parado), anel {u, cor}, extra(g, L) }
function efeitoTransf(v, te, tv, t) {
  const base = { auraCor: v.aura, auraEstilo: v.estilo };
  if (tv != null) {
    const u = fatia(tv, 0, VOLTA), pisca = u < 1 && Math.floor(tv / 0.075) % 2 === 0;
    return { R: { ...base, cabelo: v.cabelo && pisca ? v.cabelo : null, aura: 1 - u, longo: v.longo ? 1 - u : 0 } };
  }
  if (te >= v.entrada) return { R: ativoTransf(v, t) };
  const P = (R, pose = {}, anel = null, extra = null) => ({ R: { ...base, ...R }, pose, anel, extra });
  switch (v.id) {
    case 'ssj':
      if (te < 0.5) return P({ aura: 0.18 * (0.6 + 0.4 * Math.sin(te * 40)) }, { x: treme(te, 0.75), sy: 1 - 0.12 * sai(te / 0.5), olhos: 'fechados' });
      if (te < 1.1) return P({ cabelo: Math.floor((te - 0.5) / 0.1) % 2 === 0 ? v.cabelo : null, aura: 0.3 + 0.08 * Math.sin(te * 50) }, { x: treme(te, 0.75), sy: 0.88, olhos: 'fechados' });
      if (te < 1.2) return P({ cabelo: v.cabelo, aura: 0.4 }, { branco: true }, { u: (te - 1.1) / 0.8 });
      { const u = fatia(te, 1.2, 1.9); return P({ cabelo: v.cabelo, aura: sai(u) }, { sy: 1 + 0.06 * Math.sin(Math.PI * u) }, { u: (te - 1.1) / 0.8 }); }
    case 'ssj2': {
      const queda = (g, L) => raioCaindo(g, fatia(te, 0.4, 0.48), L, 1 - fatia(te, 0.48, 0.6));
      if (te < 0.4) return P({ aura: 0.15 }, { x: treme(te, 0.75), sy: 1 - 0.1 * sai(te / 0.4), olhos: 'fechados' });
      if (te < 0.45) return P({ aura: 0.15 }, { sy: 0.9, olhos: 'fechados' }, null, queda);
      if (te < 0.55) return P({ cabelo: v.cabelo, aura: 0.4 }, { branco: '#E0F2FE' }, { u: (te - 0.45) / 0.8, cor: '#BAE6FD' }, queda);
      const u = fatia(te, 0.55, 1.2);
      return P({ cabelo: v.cabelo, aura: sai(u), raios: true }, { x: te < 0.8 ? treme(te, 0.5) : 0, sy: 1 + 0.05 * Math.sin(Math.PI * u) }, { u: (te - 0.45) / 0.8, cor: '#BAE6FD' }, queda);
    }
    case 'ssj3':
      if (te < 0.3) return P({ aura: 0.1 }, { sy: 1 - 0.1 * sai(te / 0.3), olhos: 'fechados' });
      if (te < 1.9) return P({ cabelo: te < 0.6 && Math.floor(te / 0.1) % 2 ? null : v.cabelo, longo: fatia(te, 0.6, 1.9), aura: 0.25 + 0.1 * Math.sin(te * 40) },
        { x: treme(te, 1), sy: 0.9, olhos: 'fechados' }, null, g => poeira(g, te));
      if (te < 2.0) return P({ cabelo: v.cabelo, longo: 1, aura: 0.4 }, { branco: true }, { u: (te - 1.9) / 0.8 });
      { const u = fatia(te, 2.0, 2.4); return P({ cabelo: v.cabelo, longo: 1, aura: sai(u) }, { sy: 1 + 0.05 * Math.sin(Math.PI * u) }, { u: (te - 1.9) / 0.8 }); }
    case 'deus': {
      const u = fatia(te, 0.4, 1.6), k = Math.floor(u * 4) / 4;
      return P({ cabelo: k > 0 ? cabeloEm(v, k) : null, aura: sai(u) }, { olhos: te < 1.8 ? 'fechados' : 'abertos' }, te >= 1.6 ? { u: (te - 1.6) / 1.0, cor: '#FDA4AF' } : null);
    }
    case 'blue':
      if (te < 0.25) return P({}, { sy: 1 - 0.12 * sai(te / 0.25) });
      if (te < 0.35) return P({ cabelo: v.cabelo, aura: 0.5 }, { branco: '#CFFAFE' }, { u: (te - 0.25) / 0.6, cor: '#67E8F9' });
      { const u = fatia(te, 0.35, 0.8), anel2 = (te - 0.4) / 0.6;
        return P({ cabelo: v.cabelo, aura: 1 + 0.15 * Math.sin(Math.PI * u) }, { sy: 1 + 0.07 * Math.sin(Math.PI * u) }, { u: te < 0.85 ? (te - 0.25) / 0.6 : anel2, cor: '#67E8F9' }); }
    case 'instinto': {
      const k = Math.floor(fatia(te, 0.8, 2.0) * 4) / 4;
      return P({ cabelo: k > 0 ? cabeloEm(v, k) : null, aura: 1, auraAlfa: fatia(te, 0.6, 2.2) }, { olhos: te < 1.4 ? 'fechados' : 'abertos' }, null, (g, L) => {
        brilhosEntrada(g, te);
        if (te >= 2.2) { g.save(); g.globalAlpha *= Math.sin(Math.PI * fatia(te, 2.2, 2.4)); g.drawImage(arte(ESTRELINHA_AZUL, { '#': '#93C5FD', w: '#FFFFFF' }), 3, -L * 1.5 - 2, 7.5, 7.5); g.restore(); }
      });
    }
    case 'kaioken': {
      let pul = 0;
      for (const p0 of [0, 0.35, 0.7]) if (te >= p0 && te < p0 + 0.3) pul = 1 - (te - p0) / 0.3;
      const firme = te >= 1.0;
      return P({ aura: firme ? 1 : 0.6 + 0.7 * pul, tinta: { cor: '#EF4444', a: firme ? 0.2 : 0.5 * pul } }, { sy: 1 - 0.08 * pul });
    }
  }
  return { R: ativoTransf(v, t) };
}

// o Clawd do tema: p = pose + o que a transformação veste (cabelo, aura, auraCor, auraEstilo,
// auraAlfa, longo, raios, tinta, ta = relógio); vira os ganchos do desenhaClawd do núcleo
function clawdDB(g, p = {}) {
  const alfa = p.alfa ?? 1, ta = p.ta || 0, corBranco = p.branco === true ? '#FFFFFF' : p.branco;
  const q = { ...p, roupa: ROUPA, cabelo: p.cabelo || null, aura: null, atras: null, frente: null };
  if (p.aura > 0) q.aura = k => aura(k, ta, p.aura, alfa * (p.auraAlfa ?? 1), p.auraCor, p.auraEstilo);
  if (p.longo > 0) q.atras = (k, dy, L) => crina(k, p.longo, p.cabelo || [DB.cabelo, DB.cabeloLuz], L, ta, dy, corBranco);
  if (p.raios) q.frente = (k, dy, L) => raiosEletricos(k, ta, L);
  desenhaClawd(g, q);
}
// como no app: pulinho de 5 px (160 ms sobe, 160 desce), perna troca a cada 160 ms
function andando(t, extra = {}) {
  const q = (t % 0.32) / 0.32, u = q < 0.5 ? 2 * q : 2 - 2 * q;
  return { ...extra, y: -5 * (1 - (1 - u) * (1 - u)), pernas: Math.floor(t / 0.16) % 2 ? 'B' : 'A' };
}
function pulando(t, extra = {}) { const q = (t % 0.32) / 0.32, u = q < 0.5 ? 2 * q : 2 - 2 * q; return { ...extra, y: -5 * (1 - (1 - u) * (1 - u)), pernas: 'ambas' }; }

// ---------- inimigos (1,5 px por pixel, olhando pra esquerda = pro Clawd) ----------
const INIMIGOS = {
  robo: {
    linhas: ['....x.....', '....a.....', '..llllll..', '..mvvmmn..', '..mmmmmn..', '...nnnn...', '.llllllll.', 'embbbmmmme', 'embrbmmmme', 'embbbmmmne', '.mmmmmmmn.', '..dd..dd..', '.ddd.ddd..'],
    cores: { x: '#EF4444', a: '#4B5563', l: '#D1D5DB', m: '#9CA3AF', e: '#4B5563', n: '#6B7280', d: '#4B5563', v: '#22D3EE', b: '#F9FAFB', r: '#DC2626' },
  },
  monstro: {
    linhas: ['.h.......h.', '..h.....h..', '..lllllll..', '.lgowggowgk', 'lggggggggkk', 'gdtdtdtdgkk', 'ggdddddggkk', '.ggggggggk.', '.gk....gk..', '.kk....kk..'],
    cores: { h: '#E7E5E4', l: '#86D15A', g: '#4D9E2A', k: '#2F6B17', w: '#FFFFFF', o: '#111827', d: '#3B0A0A', t: '#FFFFFF' },
  },
  meteoro: {
    linhas: ['..dddd...', '.dbllbdd.', 'dbllbbbcd', 'dblbbbbbd', 'dbbbcbbbd', 'dbbbbbbcd', 'dcbbbbbbd', '.dccbbdd.', '..dddd...'],
    cores: { d: '#3F3A36', b: '#78716C', l: '#A8A29E', c: '#57534E' },
  },
};
// (x, y) = entre os pés (robô, monstro) ou o centro (meteoro). e: { t, golpe (vermelho), branco, alfa, rot }
function desenhaInimigo(g, id, x, y, e = {}) {
  const I = INIMIGOS[id], L = I.linhas, w = L[0].length * 1.5, h = L.length * 1.5;
  let img = arte(L, I.cores);
  if (e.branco) img = tingida(img, '#FFFFFF', 'ini' + id); else if (e.golpe) img = tingida(img, '#EF4444', 'ini' + id);
  g.save(); g.translate(x, y); if (e.rot) g.rotate(e.rot * DEG); if (e.alfa != null) g.globalAlpha *= e.alfa;
  const a0 = g.globalAlpha;
  if (id === 'meteoro') {
    // rastro de fogo pra cima e pra direita (de onde ele vem)
    for (let j = 1; j <= 9; j++) {
      const f = (Math.floor((e.t || 0) / 0.06) + j) % 3, s = (5.5 - j * 0.45) + (f === 0 ? 0.75 : 0);
      g.fillStyle = j < 3 ? '#FEF9C3' : j < 5 ? '#FDE047' : j < 7 ? '#F97316' : '#DC2626';
      g.globalAlpha = a0 * (1 - j / 11);
      g.fillRect(Math.round((j * 2.4) / 1.5) * 1.5 - s / 2, Math.round((-j * 1.8) / 1.5) * 1.5 - s / 2, s, s);
    }
    g.globalAlpha = a0;
    g.drawImage(img, -w / 2, -h / 2, w, h);
  } else {
    g.drawImage(img, -w / 2, -h, w, h);
    if (id === 'robo' && Math.floor((e.t || 0) / 0.4) % 2) { g.fillStyle = '#7F1D1D'; g.fillRect(-w / 2 + 6, -h, 1.5, 1.5); }  // luz da antena pisca
  }
  g.restore();
}
// chegada a pé (robô anda balançando; monstro vem pulando); devolve x, y
function chegando(id, t, x0, x1, dur = 0.8) {
  const u = fatia(t, 0, dur), x = x0 + (x1 - x0) * u;
  if (id === 'monstro') return { x, y: u < 1 ? -4 * Math.abs(Math.sin(t * Math.PI / 0.27)) : -0.75 * Math.abs(Math.sin(t * 5)) };
  return { x, y: u < 1 ? -(Math.floor(t / 0.14) % 2) * 1.5 : 0 };
}

// ---------- efeitos ----------
function disco(g, cx, cy, r, cor, P = 1) {  // círculo em pixels de P px
  if (!(r > 0)) return;
  g.fillStyle = cor;
  for (let y = -Math.ceil(r / P) * P; y < r; y += P) {
    const yc = y + P / 2, w = Math.round(Math.sqrt(Math.max(0, r * r - yc * yc)) / P) * P;
    if (w > 0) g.fillRect(Math.round(cx / P) * P - w, Math.round(cy / P) * P + y, 2 * w, P);
  }
}
function bolaKi(g, cx, cy, r, t, cor = '#60A5FA') {
  const f = 1 + 0.08 * Math.sin(t * 40);
  disco(g, cx, cy, (r + 2.5) * f, rgba(cor, 0.28));
  disco(g, cx, cy, r * f, cor);
  disco(g, cx, cy, r * 0.72 * f, mistura(cor, '#FFFFFF', 0.6));
  disco(g, cx, cy, Math.max(0.8, r * 0.4), '#FFFFFF');
}
function feixe(g, x0, x1, y, t, k = 1) {  // a onda de energia (azul por fora, branca no meio)
  const w = Math.round(x1 - x0);
  if (w <= 0 || k <= 0) return;
  const o = Math.floor(t / 0.05) % 2, faixa = (h, cor) => { const hh = Math.max(1, Math.round(h)); g.fillStyle = cor; g.fillRect(Math.round(x0), Math.round(y - hh / 2), w, hh); };
  faixa((8 + o) * k, 'rgba(59,130,246,.5)'); faixa((5 + o) * k, '#93C5FD'); faixa(2.5 * k, '#FFFFFF');
  g.fillStyle = 'rgba(255,255,255,.6)';
  for (let s = (t * 180) % 12; s < w - 3; s += 12) g.fillRect(Math.round(x0 + s), Math.round(y - 2 * k), 3, 1);
}
const VOOS = [[-30, -60], [-12, -80], [10, -75], [28, -55], [-22, -30], [20, -35], [0, -90], [34, -20], [-36, -45], [14, -50]];
function fumaca(g, cx, cy, d, dur = 0.7) {
  if (d < 0 || d >= dur) return;
  const u = d / dur;
  g.save(); g.globalAlpha *= 1 - u;
  VOOS.forEach(([vx, vy], i) => {
    const w = Math.round(3 + 5 * u);
    g.fillStyle = i % 2 ? '#9CA3AF' : '#E5E7EB';
    g.fillRect(Math.round(cx + vx * (0.06 + u * 0.24) - w / 2), Math.round(cy + vy * (0.05 + u * 0.16) - 8 * u - w / 2), w, w);
  });
  g.restore();
}
const ESTRELA5 = ['..#..', '..#..', '##w##', '..#..', '..#..'], ESTRELA3 = ['.#.', '#w#', '.#.'];
function estrelinhas(g, cx, cy, d, dur = 0.8, n = 6) {
  if (d < 0 || d >= dur) return;
  const u = d / dur, a5 = arte(ESTRELA5, { '#': '#FDE047', w: '#FFFFFF' }), a3 = arte(ESTRELA3, { '#': '#FFFFFF', w: '#FDE047' });
  g.save(); g.globalAlpha *= u < 0.6 ? 1 : (1 - u) / 0.4;
  for (let k = 0; k < n; k++) {
    const an = (k / n) * 2 * Math.PI + 0.35, r = 4 + 20 * sai(u), img = (k + Math.floor(d / 0.08)) % 2 ? a5 : a3;
    g.drawImage(img, Math.round(cx + Math.cos(an) * r - img.width / 2), Math.round(cy + Math.sin(an) * r * 0.8 - img.height / 2));
  }
  g.restore();
}
function impacto(g, cx, cy, d, tam = 1) {  // clarão branco + raios curtos
  if (d < 0 || d >= 0.2) return;
  const u = d / 0.2;
  g.save(); g.globalAlpha *= 1 - u;
  disco(g, cx, cy, (3 + 7 * sai(u)) * tam, '#FFFFFF');
  g.fillStyle = '#FDE047';
  for (let k = 0; k < 8; k++) { const an = k * Math.PI / 4, r = (6 + 9 * u) * tam; g.fillRect(Math.round(cx + Math.cos(an) * r) - 1, Math.round(cy + Math.sin(an) * r) - 1, 2, 2); }
  g.restore();
}
function linhasVel(g, x0, x1, d, dur = 0.25) {  // traços de velocidade do teletransporte
  if (d < 0 || d >= dur) return;
  const u = d / dur;
  g.save(); g.globalAlpha *= 1 - u; g.fillStyle = '#E0F2FE';
  [[-3, 0.9], [-7.5, 0.6], [-12, 1], [-16, 0.5], [-9.5, 0.75]].forEach(([y, k], i) => {
    const a = x0 + (x1 - x0) * lim(u * 1.6 - i * 0.08, 0, 1) * 0.4, b = a + (x1 - x0) * k * 0.6;
    const w = Math.round(Math.abs(b - a));
    if (w > 0) g.fillRect(Math.round(Math.min(a, b)), y, w, 1);
  });
  g.restore();
}
// nuvenzinha (montaria), a mesma paleta da nuvem da borda
const NUV_P = cache(16);
function nuvemPequena(passo) {  // passo 0..11: respira a 6 quadros/s
  let c = NUV_P.get(passo);
  if (c) return c;
  const q = passo * Math.PI / 6;
  const b = [[-8, 0, 3.8 + 0.4 * Math.sin(q)], [-3, -2, 4.6 + 0.4 * Math.cos(q)], [3, -2, 4.8 + 0.4 * Math.sin(q + 2)], [8, 0, 4 + 0.4 * Math.cos(q + 1)], [-12, 2, 2.6], [12, 2, 2.6]];
  const den = (x, y) => (x >= -12 && x <= 12 && y >= 0 && y <= 3) || b.some(([bx, by, r]) => (x + 0.5 - bx) ** 2 + (y + 0.5 - by) ** 2 <= r * r);
  c = tela(30, 14);
  const k = c.getContext('2d');
  for (let y = -7; y < 7; y++) for (let x = -15; x < 15; x++) {
    if (!den(x, y)) continue;
    k.fillStyle = !den(x, y - 1) ? '#FFF7CC' : !den(x, y + 1) ? '#B97F06' : (!den(x - 1, y) || !den(x + 1, y)) ? '#D99A06' : y < -2 ? '#FDE68A' : y < 2 ? '#FACC15' : '#EAB308';
    k.fillRect(x + 15, y + 7, 1, 1);
  }
  return NUV_P.set(passo, c);
}
function desenhaNuvemP(g, x, y, t, esc = 1) {  // (x, y) = onde o Clawd pisa (a nuvem afunda 3 px nele)
  if (!(esc > 0)) return;
  const n = nuvemPequena(Math.floor(t * 6) % 12);
  g.save(); g.translate(x, y); g.scale(esc, esc); g.drawImage(n, -15, -4); g.restore();
}
function fiapo(g, x, y, f, cor = '#FDE047') { g.save(); g.globalAlpha *= 1 - f; disco(g, x, y, 1 + 2.2 * (1 - f), cor); g.restore(); }

// ---------- fonte de pixel do visor: 11 px de altura, traço de 1 px ('g' desce 2) ----------
const GLIFOS = {
  0: ['.####.', '#....#', '#....#', '#....#', '#....#', '#....#', '#....#', '#....#', '#....#', '#....#', '.####.'],
  1: ['...#..', '..##..', '.#.#..', '...#..', '...#..', '...#..', '...#..', '...#..', '...#..', '...#..', '.#####'],
  2: ['.####.', '#....#', '.....#', '.....#', '....#.', '...#..', '..#...', '.#....', '#.....', '#.....', '######'],
  3: ['.####.', '#....#', '.....#', '.....#', '.....#', '..###.', '.....#', '.....#', '.....#', '#....#', '.####.'],
  4: ['....#.', '...##.', '..#.#.', '.#..#.', '#...#.', '#...#.', '######', '....#.', '....#.', '....#.', '....#.'],
  5: ['######', '#.....', '#.....', '#.....', '#####.', '.....#', '.....#', '.....#', '.....#', '#....#', '.####.'],
  6: ['..###.', '.#....', '#.....', '#.....', '#####.', '#....#', '#....#', '#....#', '#....#', '#....#', '.####.'],
  7: ['######', '.....#', '.....#', '....#.', '....#.', '...#..', '...#..', '..#...', '..#...', '..#...', '..#...'],
  8: ['.####.', '#....#', '#....#', '#....#', '#....#', '.####.', '#....#', '#....#', '#....#', '#....#', '.####.'],
  9: ['.####.', '#....#', '#....#', '#....#', '#....#', '#....#', '.#####', '.....#', '.....#', '....#.', '.###..'],
  '%': ['.#....', '#.#..#', '.#..#.', '....#.', '...#..', '...#..', '..#...', '.#....', '.#..#.', '#..#.#', '....#.'],
  h: ['#.....', '#.....', '#.....', '#.....', '#.###.', '##...#', '#....#', '#....#', '#....#', '#....#', '#....#'],
  m: ['.......', '.......', '.......', '.......', '.##.##.', '#..#..#', '#..#..#', '#..#..#', '#..#..#', '#..#..#', '#..#..#'],
  d: ['.....#', '.....#', '.....#', '.....#', '.#####', '#....#', '#....#', '#....#', '#....#', '#....#', '.#####'],
  a: ['......', '......', '......', '......', '.####.', '.....#', '.....#', '.#####', '#....#', '#....#', '.#####'],
  g: ['......', '......', '......', '......', '.#####', '#....#', '#....#', '#....#', '#....#', '.#####', '.....#', '.....#', '.####.'],
  o: ['......', '......', '......', '......', '.####.', '#....#', '#....#', '#....#', '#....#', '#....#', '.####.'],
  r: ['.....', '.....', '.....', '.....', '#.##.', '##..#', '#....', '#....', '#....', '#....', '#....'],
  M: ['#.....#', '##...##', '#.#.#.#', '#..#..#', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#', '#.....#'],
  A: ['.####.', '#....#', '#....#', '#....#', '#....#', '######', '#....#', '#....#', '#....#', '#....#', '#....#'],
  I: ['###', '.#.', '.#.', '.#.', '.#.', '.#.', '.#.', '.#.', '.#.', '.#.', '###'],
  S: ['.####.', '#....#', '#.....', '#.....', '#.....', '.####.', '.....#', '.....#', '.....#', '#....#', '.####.'],
  D: ['#####.', '#....#', '#....#', '#....#', '#....#', '#....#', '#....#', '#....#', '#....#', '#....#', '#####.'],
  E: ['######', '#.....', '#.....', '#.....', '#.....', '#####.', '#.....', '#.....', '#.....', '#.....', '######'],
  '!': ['#', '#', '#', '#', '#', '#', '#', '#', '.', '.', '#'],
  '+': ['.....', '.....', '.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....', '.....', '.....'],
};
const largGlifo = ch => ch === ' ' ? 3 : (GLIFOS[ch] ? GLIFOS[ch][0].length : 5);
function largPx(s) { let w = 0; for (const ch of s) w += largGlifo(ch) + 1; return Math.max(0, w - 1); }
// x = começo, y = topo da letra (11 px); sombra escura 1 px pra baixo/direita
function textoPx(g, s, x, y, cor, sombra = true) {
  for (const [c, d] of sombra ? [[mistura(cor, '#000000', 0.72), 1], [cor, 0]] : [[cor, 0]]) {
    let px = x + d;
    for (const ch of s) {
      if (GLIFOS[ch]) g.drawImage(arte(GLIFOS[ch], { '#': c }), px, y + d);
      px += largGlifo(ch) + 1;
    }
  }
}

module.exports = {
  DB, ROUPA, ROUPAS, ALTURA, fatia, aura, crina, raiosEletricos, anelClarao, VOLTA, VARIACOES, VAR, efeitoTransf, ativoTransf,
  clawdDB, andando, pulando, INIMIGOS, desenhaInimigo, chegando, disco, bolaKi, feixe, fumaca, estrelinhas, impacto, linhasVel,
  ESTRELA3, nuvemPequena, desenhaNuvemP, fiapo, GLIFOS, largPx, textoPx,
};
