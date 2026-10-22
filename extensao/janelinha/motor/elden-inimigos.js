'use strict';
// Tema Elden Ring: os inimigos das cenas da caminhada. Além do bug (o do tema Padrão, mas sujo e com contorno
// escuro, como se tivesse vindo das Terras Intermédias), 3 criaturas do jogo: o soldado de Godrick (elmo de ferro
// com crista, cota de malha, escudo redondo e espada enferrujada), o cão de caça magro e o espírito (uma cinza
// de espírito azulada, translúcida, sem pernas). Desenho nosso, em pixel, do tamanho do Clawd, virados pra esquerda
// (pro Clawd). A cena sorteia um dos 4 pela semente.
// Contrato: TIPOS, sortear(semente) -> { tipo, larg, alt }, inimigo(g, ini, x, y, opc) com (x, y) = os pés.
// opc: { passo 'p'|'q' (pernas), cor (pinta por cima), a (0..1 o vermelho do golpe), sx, sy, alfa, morte (0..1), t (relógio:
// o espírito flutua e pulsa; sem t, fica parado) }.
const { arte, tingida, rng } = require('./comum');

const TIPOS = ['bug', 'soldado', 'cao', 'espirito'];
const PX = '#0B0907';  // o contorno de todos (o mesmo escuro da armadura do Clawd)

// contorno de 1 px em volta de uma arte (o bug do Padrão não tem): célula vazia encostada numa cheia vira contorno
function contornar(linhas, k = 'k') {
  const w = linhas[0].length + 2, h = linhas.length + 2;
  const cel = (x, y) => (y >= 1 && y <= linhas.length && x >= 1 && x <= linhas[0].length ? linhas[y - 1][x - 1] : '.');
  const out = [];
  for (let y = 0; y < h; y++) {
    let l = '';
    for (let x = 0; x < w; x++) {
      const c = cel(x, y);
      l += c !== '.' ? c : (cel(x - 1, y) !== '.' || cel(x + 1, y) !== '.' || cel(x, y - 1) !== '.' || cel(x, y + 1) !== '.' ? k : '.');
    }
    out.push(l);
  }
  return out;
}

// ---------- o bug: o do Padrão, mais sujo (musgo e uma mancha escura) e de contorno escuro ----------
const BUG = ['a............', '.a...vvvvv...', '..a.vwwvvvvv.', '.aaavwvvxvvvv', 'aoaavvvvvxvvv', '.aaaavvvvvxv.', '..pq..pq..pq.', '.p..qp..qp..q'];
const BUG_SUJO = ['.............', '.....vvvvv...', '....vwwvvmvv.', '.....wvvxvvvv', '...avvmvvxvvv', '.....vvvvvxv.', '..pq..pq..pq.', '.p..qp..qp..q'];
const COR_BUG = { v: '#5E8C0F', w: '#9DD62F', x: '#2F4A12', m: '#4A5E1A', a: '#111827', o: '#F8FAFC', p: '#111827', q: '#111827', k: PX };
const bugLinhas = passo => contornar(BUG_SUJO.map((l, y) => (y < 6 ? l.replace(/a/g, 'x') : l.replace(passo === 'p' ? /q/g : /p/g, '.'))).concat([]));

// ---------- o soldado de Godrick: 15 x 14, de pé virado pra esquerda (escudo na frente, espada erguida atrás) ----------
// k contorno · c crista · i/I/d ferro (meio, luz, sombra) · e fresta do elmo (âmbar) · m/M cota · s/S escudo · b ouro do aro
// l couro · r/R espada enferrujada · f bota
const SOLDADO_CORPO = [
  '.....kccck.....',
  '....kcciick.k..',
  '....kiIIiidk.kr',
  '...kiIiiiiddkkr',
  '...keeiiiiddk.r',
  '...kiiidddddk.r',
  '..kkkiidkkdk..r',
  '.kbbbbkMmmMkkkr',
  'kbSSSsbkMmmMk.l',
  'kbSssssbkMmMkll',
  'kbSssbsbkmMmkl.',
  'kbSsssSbkMmmk..',
  '.kbsssbk.kllk..',
];
const SOLDADO_PERNAS = {
  p: ['..kkkkkkkkkk...', '...kMmkkmMk....', '...kffk.kffk...'],
  q: ['..kkkkkkkkkk...', '..kMmk..kmMk...', '.kffk....kffk..'],
};
const COR_SOLDADO = {
  k: PX, c: '#9B1C1C', i: '#8D95A0', I: '#C3C9D2', d: '#4B525C', e: '#F59E0B', m: '#3A3F4A', M: '#545B68',
  s: '#7A4A21', S: '#A8703A', b: '#8E949E', l: '#3B2A1A', r: '#8B4F26', R: '#C58A52', f: '#2A1E14',
};

// ---------- o cão de caça: 22 x 12, magro, pelo cinza-escuro, olho âmbar, de dentes à mostra ----------
// g/G/h pelo (meio, luz, sombra) · e olho · t dente · n nariz · l língua
const CAO_CORPO = [
  '..kk.kk...............',
  '.kGGkGGk..............',
  '.kGhhGhk........kk....',
  'kgeGGgggkkkkkkkkGGk...',
  'kngGgggGGGGGGgggghhk..',
  'kttgGGggggGhgggghhgk..',
  '.ktlkgggggghgggghgk...',
  '..kkkkgggghggghhgk....',
  '......kgkkgkkgkkgk....',
];
const CAO_PERNAS = {
  p: ['.....kgk.kgk.kgk.kk...', '.....kgk.kgk.kgk......', '....kkkk.kkkk.kkk.....'],
  q: ['....kgk...kgk..kgk.kk..', '...kgk.....kgk.kgk....', '..kkkk.....kkkk.kkk...'],
};
const COR_CAO = { k: PX, g: '#4B5057', G: '#6B717A', h: '#2D3036', e: '#FBBF24', n: '#1A1A1A', t: '#F3F4F6', l: '#B91C3A' };

// ---------- o espírito: 12 x 15, uma cinza de espírito (capuz, olhos vazios, os braços estendidos, cauda de névoa) ----------
// w luz · u meio · v borda · e olho · n névoa
const ESPIRITO_CORPO = [
  '......vvv.....',
  '.....vuwwv....',
  '....vuwwwuv...',
  '...vuwwwwwuv..',
  '...vweweuwuv..',
  '...vweweuuuv..',
  '...vuwwwuuuv..',
  'vv.vuwuuuuuuv.',
  'vwvuuuvuuuuuv.',
  '.vwuuvvuuuuuv.',
  '..vuuuuuuuuv..',
  '..vuuuuuuuuv..',
  '...vnuuunnuv..',
];
const ESPIRITO = {  // a cauda de névoa balança de um passo pro outro
  p: ESPIRITO_CORPO.concat(['....vnnnnnnv.n', '.....vnnnv.n.n', '......vnv.n..n']),
  q: ESPIRITO_CORPO.concat(['....vnnnnnnvn.', '.....vnnnvn.n.', '......vnvn.n..']),
};
const COR_ESPIRITO = { w: '#E6F4FF', u: '#A9D2F5', v: '#5B93CF', e: '#08172E', n: '#7FB4E8' };

const P = 1.4;  // o pixel dos inimigos
const MODELOS = {
  bug: { p: 1.6, linhas: passo => bugLinhas(passo), cores: COR_BUG },
  soldado: { p: P, linhas: passo => SOLDADO_CORPO.concat(SOLDADO_PERNAS[passo]), cores: COR_SOLDADO },
  cao: { p: 1.15, linhas: passo => CAO_CORPO.concat(CAO_PERNAS[passo]), cores: COR_CAO },
  espirito: { p: P, linhas: passo => ESPIRITO[passo], cores: COR_ESPIRITO },
};
for (const m of Object.values(MODELOS)) {
  const l = m.linhas('p');
  m.w = l[0].length * m.p; m.h = l.length * m.p;
}
const IMGS = new Map();  // 4 tipos x 2 passos: nunca passa disso
function imagem(tipo, passo) {
  const chave = tipo + passo;
  let img = IMGS.get(chave);
  if (!img) { const m = MODELOS[tipo]; img = arte(m.linhas(passo), m.cores); IMGS.set(chave, img); }
  return img;
}

function sortear(semente) {
  const r = rng((semente * 31 + 7) >>> 0);  // (sementes 1..12 dão os 4 tipos)
  r();
  const tipo = TIPOS[Math.floor(r() * TIPOS.length)];
  return { tipo, larg: Math.round(MODELOS[tipo].w), alt: Math.round(MODELOS[tipo].h) };
}

// o espírito: flutua um palmo, o alfa pulsa, e na névoa o passo balança a cauda
function inimigo(g, ini, x, y, opc = {}) {
  const tipo = MODELOS[ini.tipo] ? ini.tipo : 'bug', M = MODELOS[tipo], passo = opc.passo === 'q' ? 'q' : 'p';
  const morte = Math.max(0, Math.min(1, opc.morte || 0)), t = opc.t || 0;
  let img = imagem(tipo, passo);
  const chave = 'eldini' + tipo + passo;
  if (opc.cor) img = tingida(img, opc.cor, chave);
  let sx = opc.sx == null ? 1 : opc.sx, sy = opc.sy == null ? 1 : opc.sy, alfa = opc.alfa == null ? 1 : opc.alfa, rot = 0, dx = 0, dy = 0;
  if (morte > 0) {
    const e = morte * morte;
    if (tipo === 'bug') { sy *= 1 - 0.7 * e; sx *= 1 + 0.3 * e; alfa *= 1 - Math.max(0, (morte - 0.6) / 0.4); }
    // o soldado cai de costas (pra longe do Clawd), girando no pé de trás; o cão desaba de lado, achatando
    else if (tipo === 'soldado') { rot = 86 * e; dx = 4.9; sx *= 1 - 0.3 * e; alfa *= 1 - Math.max(0, (morte - 0.75) / 0.25); }
    else if (tipo === 'cao') { rot = 8 * e; sy *= 1 - 0.55 * e; sx *= 1 + 0.12 * e; alfa *= 1 - Math.max(0, (morte - 0.75) / 0.25); }
    else { dy = -10 * morte; sy *= 1 + 0.35 * morte; sx *= 1 - 0.25 * morte; alfa *= 1 - morte; }
  }
  if (tipo === 'espirito') {
    dy -= 3 + 1.6 * Math.sin(t * 3.2);
    alfa *= 0.72 + 0.2 * Math.sin(t * 5.1);
  }
  g.save(); g.globalAlpha *= alfa; g.translate(x + dx, y + dy);
  if (rot) g.rotate(rot * Math.PI / 180);
  g.scale(sx, sy);
  const ox = tipo === 'soldado' && morte > 0 ? -M.w / 2 - 4.9 : -M.w / 2;  // gira no pé de trás (a coluna 11 da imagem)
  g.drawImage(img, ox, -M.h, M.w, M.h);
  if (opc.a > 0 && !opc.cor) { g.save(); g.globalAlpha *= opc.a; g.drawImage(tingida(img, '#EF4444', chave + 'v'), ox, -M.h, M.w, M.h); g.restore(); }
  if (tipo === 'espirito') {  // o brilho frio da cinza, por cima
    g.globalCompositeOperation = 'lighter'; g.globalAlpha *= 0.3;
    g.drawImage(img, ox, -M.h, M.w, M.h);
  }
  g.restore();
}

module.exports = { TIPOS, sortear, inimigo };
