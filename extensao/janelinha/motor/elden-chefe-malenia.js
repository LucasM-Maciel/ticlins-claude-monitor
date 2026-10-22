'use strict';
// Tema Elden Ring, chefe MALENIA, LÂMINA DE MIQUELLA (contrato de elden-epico.js: { id, nome, H, W, desenha, efeito, ataques }).
// Esbelta e ereta: elmo dourado com a crista fina e as asas em lâmina, cabelo laranja-fogo até o chão (metade da silhueta), peitoral
// dourado, saia curta de pano creme rasgado com a Podridão Escarlate, braço direito e pernas de ouro (próteses) e a katana longa e
// fina, com o cabo fundido na mão de ouro. Camadas: cabelo (balança em fatias), corpo (elmo, torso, saia, braço pálido), pernas e
// braço da katana (por quadro, com fillRect, porque se mexem). Tudo é função de est.T/est.ataque.u; os sprites nascem uma vez (cache).
const { arte, tingida, lim, rgba, mistura, rng } = require('./comum');
const { COR, fatia, luz } = require('./elden-arte');

const W = 56, H = 48, CX = 28;  // o desenho; CX = a coluna do meio do corpo
const PAL = {
  o: '#17100A', w: '#F1EDE2', v: '#C9C2B2', u: '#8F8878', g: '#D4AF37', G: '#F6DC83', d: '#7E5F18',
  h: '#D2461F', H: '#FF8A3A', k: '#FFB766', j: '#8A2410', s: '#F0CDAA', S: '#C99F7B', m: '#A04A40', r: '#6E1414', R: '#B02A24',
};
const A0 = 0.6, A1 = 0.5;  // onde da janela do ataque (0..1) o golpe cai

const grade = () => Array.from({ length: H }, () => Array(W).fill('.'));
const hash = (a, b) => ((a * 73856093) ^ (b * 19349663)) >>> 0;
const sprite = G => arte(G.map(r => r.join('')), PAL);
const luzFraca = (g, x, y, r, u) => luz(g, x, y, r, u, '#FF7A5A');
const pt = (G, x, y, c) => { x = Math.round(x); y = Math.round(y); if (G[y] && x >= 0 && x < W) G[y][x] = c; };
const rect = (G, x, y, w, h, c) => { for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) pt(G, x + i, y + j, c); };
const disco = (G, cx, cy, r, c) => { for (let y = -r; y <= r; y++) for (let x = -r; x <= r; x++) if (x * x + y * y <= r * r + 0.5) pt(G, cx + x, cy + y, c); };
// lâmina que afina: do ponto 0 ao 1, espessura w0 → 1, com uma barriga `bow` pra cima no meio
function afina(G, x0, y0, x1, y1, w0, bow, c) {
  const n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
  for (let i = 0; i <= n; i++) {
    const t = i / n, w = Math.max(1, Math.round(w0 * (1 - t * 0.9)));
    const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t - bow * Math.sin(Math.PI * t);
    for (let k = 0; k < w; k++) pt(G, x, y + k - Math.floor(w / 2), c);
  }
}
// luz de cima/esquerda: o canto de cima/esquerda de cada material clareia e o de baixo/direita escurece [claro, médio, escuro]
const MAT = { M: ['G', 'g', 'd'], N: ['w', 'w', 'v'], P: ['s', 's', 'S'], Q: ['v', 'v', 'u'] };
function sombra(G) {
  const cp = G.map(r => r.slice()), vaz = (x, y) => !cp[y] || cp[y][x] === undefined || cp[y][x] === '.';
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const m = MAT[cp[y][x]];
    if (!m) continue;
    const cl = vaz(x, y - 1) || vaz(x - 1, y), es = vaz(x, y + 1) || vaz(x + 1, y);
    G[y][x] = cl && !es ? m[0] : es && !cl ? m[2] : m[1];
  }
}
// contorno escuro de 1 pixel em volta de tudo
function contorna(G) {
  const cp = G.map(r => r.slice());
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (cp[y][x] !== '.') continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => cp[y + b] && cp[y + b][x + a] && cp[y + b][x + a] !== '.')) G[y][x] = 'o';
  }
}

// ---------- os sprites (1 vez) ----------
let CAMADAS = null;
function camadas() {
  if (CAMADAS) return CAMADAS;
  // cabelo: uma massa laranja-fogo atrás dela, em mechas onduladas de 6 tons, que desce até o chão e se espalha pra trás; pontas em dentes
  const C = grade();
  for (let r = 5; r < H; r++) {
    const e = (r - 5) / (H - 6);
    const l = Math.round(CX - 6 - e * 7 + 1.2 * Math.sin(r * 0.45));
    const rr = Math.min(W - 2, Math.round(CX + 7 + Math.pow(e, 0.6) * 20 + 1.8 * Math.sin(r * 0.3 + 1)));
    for (let x = l; x <= rr; x++) {
      const ponta = H - 1 - (Math.abs(((x + 1) % 6) - 3) * 2 + hash(x, 3) % 2);  // cada mecha termina numa ponta
      if (r > ponta) continue;
      const pos = ((Math.floor(x - 0.32 * r + 2.2 * Math.sin(r * 0.23)) % 6) + 6) % 6;
      let c = ['j', 'h', 'H', 'H', 'h', 'j'][pos];
      if (pos === 2 && (r % 9) < 2) c = 'k';
      if (e > 0.55 && pos === 0 && (r % 4) === 0) c = 'o';  // vão entre as mechas
      C[r][x] = c;
    }
  }
  contorna(C);
  // corpo
  const B = grade();
  // asas do elmo: a asa fina em pena que nasce do lado do elmo e varre pra trás (direita) e um pouco pra cima, colada à cabeça, 3 penas recortadas;
  // a da frente fica escondida atrás da cúpula (perfil)
  // a base fica 1 px longe da cúpula (o contorno escuro separa) e as penas ficam em linhas afastadas, cada uma com seu contorno
  afina(B, CX + 7, 3, CX + 22, 0, 2, 0.2, 'M'); afina(B, CX + 7, 6, CX + 20, 3, 2, 0.2, 'M'); afina(B, CX + 7, 9, CX + 15, 7, 2, 0.2, 'M');
  // o elmo: cúpula lisa e arredondada que desce até a testa, sem pontas
  [[4, 2], [6, 3], [8, 4], [9, 5], [10, 6], [10, 7], [10, 8]].forEach(([n, y]) => rect(B, CX - Math.ceil(n / 2) + (n > 8 ? 0 : 0), y, n, 1, 'M'));
  // rosto: sombra sob a viseira, maçã clara à esquerda, boca fina, queixo afilado e o pescoço
  rect(B, CX - 3, 9, 6, 1, 'S'); rect(B, CX - 3, 10, 4, 1, 's'); rect(B, CX + 1, 10, 2, 1, 'S');
  rect(B, CX - 3, 11, 5, 1, 's'); rect(B, CX - 2, 12, 3, 1, 's'); pt(B, CX, 12, 'S'); rect(B, CX - 1, 13, 3, 1, 'S');
  pt(B, CX - 2, 11, 'm'); pt(B, CX - 1, 11, 'r');  // a boca: 2 px escuros contra o queixo claro
  // torso: peitoral de ouro (6 linhas) e a cintura creme; ombreiras em disco
  for (let y = 14; y <= 25; y++) {
    const hw = y < 19 ? 4 : y < 22 ? 3 : 3;
    for (let x = CX - hw; x <= CX + hw - 1; x++) pt(B, x, y, y < 20 ? 'M' : 'N');
  }
  disco(B, CX - 6, 15, 3, 'M'); disco(B, CX + 5, 15, 2, 'M');
  rect(B, CX - 6, 23, 12, 2, 'M');  // o cinto de ouro
  // saia comprida (quase até o joelho) de pano creme, a barra em tiras rasgadas de tamanhos diferentes, dobras verticais e a Podridão Escarlate
  for (let y = 25; y < 43; y++) {
    const r = y - 25, hw = 5 + r * 0.3, l = Math.round(CX - hw), rr = Math.round(CX + hw) - 1;
    for (let x = l; x <= rr; x++) {
      const tira = Math.floor((x - l) / 3), col = (x - l) % 3;
      const fim = 36 + hash(tira, 5) % 7 - (col === 2 ? 2 : 0) - (hash(x, 4) % 5 === 0 ? 1 : 0);
      if (y > fim) continue;
      let c = col === 2 && r > 1 ? 'Q' : 'N';
      if (col === 1 && r > 3 && (r + tira * 3) % 7 === 0) c = 'Q';  // dobra fina no meio da tira
      const p = hash(x * 7 + 1, y * 13 + 5) % 100, forte = r < 7 ? 0 : (r / 17) * 17;  // mais mancha embaixo
      if (p < forte) c = ['r', 'R', 'h', 'r', 'j'][hash(x, y) % 5];
      else if (y >= fim - 1 && y > 36 && hash(x, y) % 3) c = hash(x, 2) % 2 ? 'r' : 'R';  // a ponta da tira, tingida
      B[y][x] = c;
    }
  }
  [[CX - 3, 29, 2, 1], [CX + 1, 32, 1, 2], [CX - 5, 34, 2, 1], [CX + 3, 28, 1, 1], [CX - 1, 38, 2, 1], [CX + 4, 37, 1, 1]].forEach(([x, y, w, h], i) => {
    rect(B, x, y, w, h, i % 2 ? 'R' : 'r'); pt(B, x + w, y - 1, 'H'); pt(B, x, y + h, i % 2 ? 'h' : 'j');
  });
  // braço esquerdo, pálido e magro, caído atrás (o direito, de ouro, é o do quadro)
  afina(B, CX + 6, 17, CX + 9, 29, 3, 0, 'P'); rect(B, CX + 8, 29, 3, 2, 'P');
  sombra(B);
  contorna(B);
  // os vãos entre as tiras (contorno com pano dos dois lados) ficam cinza de sombra de pano, não preto chapado
  const pano = c => c && 'wvuQrRhjH'.includes(c);
  for (let y = 30; y < 44; y++) for (let x = CX - 12; x <= CX + 12; x++)
    if (B[y][x] === 'o' && pano(B[y][x - 1]) && pano(B[y][x + 1])) B[y][x] = 'u';
  // a fenda da saia: a coxa dourada da perna da frente aparece (a perna é desenhada por baixo desta camada)
  for (let y = 36; y <= 42; y++) for (let x = CX - 5; x <= CX - 3; x++) B[y][x] = '.';
  // detalhes à mão (por cima da sombra automática): brilho e crista da cúpula, aba/viseira lisa sem fendas
  pt(B, CX - 2, 2, 'G'); pt(B, CX - 1, 2, 'G'); pt(B, CX - 3, 3, 'G'); pt(B, CX - 4, 4, 'G');
  for (let y = 2; y <= 7; y++) { pt(B, CX, y, 'G'); if (y > 2) pt(B, CX + 1, y, 'd'); }  // a crista fina, rente à cúpula
  for (let y = 4; y <= 7; y++) pt(B, CX + 4, y, 'd');
  for (let x = CX - 5; x <= CX + 4; x++) { pt(B, x, 8, 'd'); pt(B, x, 7, x < CX ? 'G' : 'g'); }  // a aba: brilho em cima, sombra embaixo
  pt(B, CX - 4, 7, 'G');
  for (let y = 14; y <= 19; y++) pt(B, CX, y, y % 2 ? 'G' : 'w');  // faixa creme no peito
  for (let x = CX - 3; x <= CX + 2; x++) pt(B, x, 18, 'd');       // a linha do busto
  pt(B, CX - 6, 14, 'G'); pt(B, CX - 7, 15, 'G'); pt(B, CX + 5, 14, 'G');
  for (let y = 14; y <= 19; y++) pt(B, CX, y, y % 2 ? 'G' : 'w');  // faixa creme no peito
  for (let x = CX - 3; x <= CX + 2; x++) pt(B, x, 18, 'd');       // a linha do busto
  pt(B, CX - 6, 14, 'G'); pt(B, CX - 7, 15, 'G'); pt(B, CX + 5, 14, 'G');
  CAMADAS = { cabelo: sprite(C), corpo: sprite(B) };
  return CAMADAS;
}

// ---------- a pose ----------
// vetor: [ângulo da lâmina (0 = pra esquerda, 90 = pra baixo, negativo = pra cima), mão x, mão y, corpo x, corpo y (+ desce), inclinação do tronco,
//         perna da frente recuada (px), altura do pé de trás, comprimento da lâmina]
const REPOUSO = [45, 0, 0, 0, 0, 0, 0, 0, 34];
const suave = u => u * u * (3 - 2 * u);
function sequencia(u, chaves) {  // chaves: [[u, vetor], ...] em ordem; interpola com suavização
  if (u <= chaves[0][0]) return chaves[0][1];
  for (let i = 1; i < chaves.length; i++) {
    if (u <= chaves[i][0]) {
      const [u0, a] = chaves[i - 1], [u1, b] = chaves[i], k = suave(lim((u - u0) / (u1 - u0), 0, 1));
      return a.map((v, j) => v + (b[j] - v) * k);
    }
  }
  return chaves[chaves.length - 1][1];
}
const DANCA = [
  [0, REPOUSO], [0.06, REPOUSO],
  [A0 - 0.16, [-105, 1, -8, 3, 1, 2, 5, 3, 20]],  // recua a perna e ergue a katana atrás da cabeça
  [A0 - 0.08, [18, -5, 0, -3, 1, -3, 2, 0, 38]],  // o corte: desce rápido, na horizontal, e avança
  [A0 + 0.04, [24, -5, 1, -3, 1, -3, 2, 0, 38]],
  [A0 + 0.4, REPOUSO], [1, REPOUSO],
];
const FLOR = [
  [0, REPOUSO], [0.06, REPOUSO],
  [0.14, [55, 0, 3, 0, 2, 1, 0, 0, 34]],         // agacha
  [0.3, [-40, -2, -6, 0, -17, -1, 0, 0, 22]],    // salta, katana erguida
  [A1 - 0.06, [50, -2, 0, 0, -9, 1, 0, 0, 34]],
  [A1, [90, -3, 8, -1, 6, -4, 0, 0, 34]],        // cai em pose de flor: ajoelhada, katana cravada no chão
  [0.82, [90, -3, 8, -1, 6, -4, 0, 0, 34]],
  [1, REPOUSO],
];
const KNEEL = [90, -3, 9, -1, 9, -5, 0, 0, 34];
function pose(est) {
  const a = est.ataque;
  let v = a ? sequencia(a.u, a.id ? FLOR : DANCA) : REPOUSO;
  if (!a) {  // parado: respira e a katana balança de leve
    const r = Math.sin(est.T * 1.7);
    v = [45 + r * 1.5, 0, r * 0.4, 0, 0, r * 0.6, 0, 0, 34];
  }
  if (est.ajoelha > 0) v = v.map((x, i) => x + (KNEEL[i] - x) * est.ajoelha);
  if (est.golpeado > 0) { v = v.slice(); v[3] += 2 * est.golpeado; v[5] += 1.5 * est.golpeado; }
  return v;
}

// ---------- desenho ----------
function desenha(g, J, x, y, est) {
  const pb = J.pb, K = camadas(), v = pose(est);
  const X0 = Math.round(x - (CX + 0.5) * pb), Y0 = y - H * pb;
  const dx = Math.round(v[3]), dy = Math.round(v[4]), incl = v[5];
  const tinta = est.golpeado > 0 ? (Math.floor(est.T * 30) % 2 ? '#FF2A2A' : '#FFFFFF') : null;
  const mixa = c => (tinta ? mistura(c, tinta, 0.65 * est.golpeado) : c);
  // fatias de 2 linhas: o tronco inclina (mais em cima), o corpo desce ajoelhando; o que passa do chão some
  const fatias = (img, chave, balanco) => {
    const alt = tinta ? [img, tingida(img, tinta, chave)] : [img];
    for (let r = 0; r < H; r += 2) {
      const destino = r + dy;
      if (destino >= H) break;
      const k = 1 - r / H;
      let off = dx + incl * k * k * 1.6 + (balanco ? Math.sin(est.T * 1.6 - r * 0.16) * (r / H) * 1.8 : 0);
      if (est.ajoelha > 0 && r < 14) off -= 2 * est.ajoelha * (1 - r / 14);  // a cabeça pende
      off = Math.round(off);
      alt.forEach((im, i) => {
        if (i) { g.save(); g.globalAlpha *= 0.65 * est.golpeado; }
        g.drawImage(im, 0, r, W, 2, X0 + off * pb, Y0 + destino * pb, W * pb, 2 * pb);
        if (i) g.restore();
      });
    }
  };
  g.save();
  g.beginPath(); g.rect(x - 90 * pb, y - 80 * pb, 180 * pb, 80 * pb); g.clip();  // nada abaixo do chão
  const px = (cx, cy, w, h, c) => { g.fillStyle = mixa(c); g.fillRect(X0 + Math.round(cx) * pb, Y0 + Math.round(cy) * pb, w * pb, h * pb); };
  fatias(K.cabelo, 'mal-c', true);
  // pernas de ouro: contorno, placas, joelho articulado e pé fino de bailarina; a da frente (esquerda) recua na dança, a de trás ergue o calcanhar
  const perna = (c0, recua, alto) => {
    const base = H + dy, n = 12 - alto;
    for (let r = 0; r < n; r++) {
      const yy = base - 12 + r - alto, xx = c0 + dx + (r > 5 ? recua : recua * 0.5);
      if (yy >= H) continue;
      const larg = r < 5 ? 3 : r < 7 ? 3 : 2;  // coxa, joelho, canela fina
      px(xx - 1, yy, 1, 1, '#17100A'); px(xx + larg, yy, 1, 1, '#17100A');
      const junta = r === 5 || r === 6 || r === n - 2;
      px(xx, yy, larg, 1, junta ? '#7E5F18' : '#D4AF37');
      px(xx, yy, 1, 1, junta ? '#D4AF37' : '#F6DC83');             // luz de cima/esquerda
      if (larg > 2) px(xx + larg - 1, yy, 1, 1, '#7E5F18');
      if (r === 6) px(xx + 1, yy, 1, 1, '#F6DC83');                // o parafuso da junta
    }
    const yb = base - 1 - alto;
    if (yb < H) { px(c0 + dx + recua - 3, yb, 5, 1, '#17100A'); px(c0 + dx + recua - 2, yb - 1, 3, 1, '#D4AF37'); px(c0 + dx + recua - 2, yb, 1, 1, '#F6DC83'); }
  };
  perna(CX - 5, v[6], 0); perna(CX + 1, 0, Math.round(v[7]));
  fatias(K.corpo, 'mal-b', false);
  // o braço direito, protético de ouro (ombro, cotovelo articulado, manopla) e a katana fundida na mão
  const ombro = [CX - 6 + dx + incl * 0.4, 16 + dy], mao = [CX - 10 + v[1] + dx + incl * 0.5, 24 + v[2] + dy];
  const cotovelo = [(ombro[0] + mao[0]) / 2 - 1, (ombro[1] + mao[1]) / 2 + 1];
  const traco = (a, b, larg, c, ox = 0, oy = 0) => {
    const n = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) * 1.5);
    for (let i = 0; i <= n; i++) { const q = i / n; px(a[0] + (b[0] - a[0]) * q - (larg - 1) / 2 + ox, a[1] + (b[1] - a[1]) * q - (larg - 1) / 2 + oy, larg, larg, c); }
  };
  const ang = v[0] * Math.PI / 180, ux = -Math.cos(ang), uy = Math.sin(ang), L = v[8], nx = -uy, ny = ux;
  const ponto = d => { const s = Math.pow(d / L, 2) * 2.2; return [mao[0] + ux * d + nx * s, mao[1] + uy * d + ny * s]; };
  const passos = []; for (let d = -3; d < L; d += 2) passos.push(ponto(d)); passos.push(ponto(L));
  // 1) contornos (braço, mão, lâmina)
  traco(ombro, cotovelo, 5, '#17100A'); traco(cotovelo, mao, 5, '#17100A'); traco(mao, mao, 5, '#17100A');
  for (let i = 1; i < passos.length; i++) traco(passos[i - 1], passos[i], 3, '#17100A');
  // 2) o ouro do braço, com luz e sombra
  [[ombro, cotovelo], [cotovelo, mao]].forEach(([a, b]) => {
    traco(a, b, 3, '#D4AF37'); traco(a, b, 1, '#F6DC83', -1, 0); traco(a, b, 1, '#7E5F18', 1, 0);
  });
  px(cotovelo[0] - 1, cotovelo[1] - 1, 3, 3, '#7E5F18'); px(cotovelo[0], cotovelo[1], 1, 1, '#F6DC83');  // junta do cotovelo
  px(ombro[0] - 1, ombro[1] - 1, 3, 2, '#F6DC83');
  px(mao[0] - 1, mao[1] - 1, 3, 3, '#D4AF37'); px(mao[0] - 1, mao[1] - 1, 3, 1, '#F6DC83'); px(mao[0] - 1, mao[1] + 1, 3, 1, '#7E5F18');  // a manopla
  // 3) a katana: cabo de ouro escuro fundido na mão, guarda pequena, lâmina de aço em dois tons e a ponta branca
  for (let i = 1; i < passos.length; i++) {
    const d = -3 + (i - 1) * 2;
    if (d < 5) { traco(passos[i - 1], passos[i], 1, d % 4 ? '#7E5F18' : '#D4AF37'); continue; }
    traco(passos[i - 1], passos[i], 1, '#8C97AE', Math.abs(uy) > Math.abs(ux) ? 1 : 0, Math.abs(uy) > Math.abs(ux) ? 0 : 1);
    traco(passos[i - 1], passos[i], 1, '#E6EBF5');
  }
  const gd = ponto(5);
  traco([gd[0] - nx * 2, gd[1] - ny * 2], [gd[0] + nx * 2, gd[1] + ny * 2], 1, '#D4AF37');
  px(gd[0] - nx * 2, gd[1] - ny * 2, 1, 1, '#F6DC83');
  const pta = ponto(L); px(pta[0], pta[1], 1, 1, '#FFFFFF');
  g.restore();
}

// ---------- os efeitos ----------
// um corte em arco (crescente) que segue pro Clawd: pixels quadrados em 'lighter'
function corte(g, X, Yc, tilt, r, al, pb) {
  const q = Math.max(2, Math.round(pb));
  g.save(); g.globalCompositeOperation = 'lighter';
  const c = Math.cos(tilt), s = Math.sin(tilt);
  for (let pass = 0; pass < 3; pass++) {  // cauda: cópias atrasadas, mais fracas
    const atraso = pass * 9, a2 = al * (1 - pass * 0.32);
    for (let a = -1.05; a <= 1.05; a += 0.07) {
      const esp = 2 * q * Math.cos(a * 1.5) * (1 - pass * 0.15);
      const ex = -r * Math.cos(a), ey = r * Math.sin(a);
      const rx = ex * c - ey * s, ry = ex * s + ey * c;
      const cor = pass === 0 ? '#FFF6D8' : pass === 1 ? COR.ouroClaro : COR.ouro;
      g.fillStyle = rgba(cor, a2 * (0.45 + 0.55 * Math.cos(a * 1.4)));
      g.fillRect(Math.round(X + rx + atraso), Math.round(Yc + ry), q, Math.max(q, Math.round(esp)));
    }
  }
  g.restore();
}

// uma pétala: lente de quadradinhos ao longo de um eixo que sai do centro
function petala(g, cx, cy, ang, R, larg, bloom, cor, al, q) {
  const n = Math.max(6, Math.round(R * bloom / q / 1.3)), c = Math.cos(ang), sn = Math.sin(ang);
  g.fillStyle = rgba(cor, al);
  for (let i = 1; i <= n; i++) {
    const s = i / n;
    const meia = larg * Math.sin(Math.PI * Math.pow(s, 0.65)) * bloom;
    const px = cx + c * R * bloom * s, py = cy - sn * R * bloom * s;
    const m = Math.max(1, Math.round(meia / q));
    for (let k = -m; k <= m; k++) g.fillRect(Math.round(px - sn * k * q), Math.round(py - c * k * q), q, q);
  }
}

function efeito(g, J, est, x, y) {
  const a = est.ataque;
  if (!a || est.morte > 0) return;
  const pb = J.pb, alvo = J.aqui + 16;
  if (a.id === 0) {
    const xs = x - 10 * pb, ys = [-20, -11, -3], tilts = [-0.55, 0.05, 0.5], r = Math.max(14, 9 * pb);
    for (let k = 0; k < 3; k++) {
      const p = (a.u - (A0 - 0.08 + k * 0.05)) / 0.08;
      if (p < 0 || p > 1.3) continue;
      const al = p < 1 ? 0.5 + 0.5 * p : 1 - (p - 1) / 0.3;
      corte(g, xs + (alvo - xs) * p, y + ys[k], tilts[k], r, al, pb);
      if (p >= 1) luz(g, alvo, y + ys[k], 8, 1 - (p - 1) / 0.3);
    }
    return;
  }
  // flor escarlate: desabrocha a partir do pouso
  const b = suave(fatia(a.u, A1, A1 + 0.22)) * (1 - suave(fatia(a.u, 0.86, 1)));
  if (b <= 0) return;
  const q = Math.max(2, Math.round(pb)), cx = x - 3 * pb, cy = y - 5 * pb;
  const R = Math.max(40, (cx - alvo) + 16), Ry = Math.min(R * 0.78, J.HJ - 36);
  g.save(); g.globalCompositeOperation = 'lighter';
  luzFraca(g, cx, cy - 6, R * 0.5 * b, 0.28);
  // três voltas de pétalas: as de trás escuras, as da frente claras, abrindo em leque
  const voltas = [[11, 0.78, '#7A1010', 0.3, 5], [9, 1, '#C41E1E', 0.28, 4], [7, 0.62, '#FF5A4A', 0.24, 3]];
  for (const [n, esc, cor, al, larg] of voltas) {
    for (let i = 0; i < n; i++) {
      const ang = Math.PI * (0.04 + 0.92 * i / (n - 1)) + (esc < 1 ? 0.12 : 0);
      const mexe = 1 + 0.04 * Math.sin(est.T * 3 + i * 1.7);
      const Rp = (Math.abs(Math.cos(ang)) > 0.5 ? R : Ry + (R - Ry) * Math.abs(Math.cos(ang))) * esc * mexe;
      petala(g, cx, cy, ang, Rp, larg * q * 0.8, b, cor, al, q);
    }
  }
  // esporos subindo e abrindo em leque
  const r = rng(77);
  for (let i = 0; i < 46; i++) {
    const ang = Math.PI * r(), vel = 0.4 + r() * 0.6, fase = r(), u = lim((a.u - A1) / 0.45 + fase * 0.15, 0, 1);
    const d = R * vel * u, t2 = Math.sin(Math.PI * u);
    g.fillStyle = rgba(r() < 0.5 ? '#FF6A5A' : '#FFC0A0', 0.8 * t2 * (1 - suave(fatia(a.u, 0.86, 1))));
    g.fillRect(Math.round(cx + Math.cos(ang) * d), Math.round(cy - Math.sin(ang) * d * 0.8 - u * 6), q > 2 ? 2 : 1, q > 2 ? 2 : 1);
  }
  g.restore();
}

module.exports = {
  id: 'malenia', nome: 'MALENIA, LÂMINA DE MIQUELLA', nomeEn: 'MALENIA, BLADE OF MIQUELLA', H, W, desenha, efeito,
  ataques: [{ nome: 'dança da garça', acerta: A0 }, { nome: 'flor escarlate', acerta: A1 }],
  // a luta (elden-epico.js), como no jogo: a Dança da Ave Aquática em 3 rajadas (o Clawd corre da 1ª e rola a 2ª e a 3ª), 2
  // golpes; uma rajada o acerta e ela SE CURA (a barra sobe); o frasco; a Aeonia Escarlate (o Clawd corre da flor), o golpe e
  // o salto final
  luta: {
    ataques: [[0, 2.3, 1.1, 'corre'], [0, 4.0, 1.0, 'rola'], [0, 5.0, 1.0, 'rola'], [0, 7.2, 1.0, 'apanha'], [1, 9.05, 2.0, 'corre']],
    cortes: [[6.05, 0.72], [6.65, 0.5], [11.1, 0.3]],
    curas: [[7.2 + 1.0 * A0, 0.66]],  // no impacto da rajada que acerta
    frasco: 8.35, final: 11.75,
  },
};
