'use strict';
// O macaco dourado gigante do épico da lua cheia (dragonball-epico-ssj4.js). Desenho nosso,
// genérico: um gorila de pelo dourado, de frente, com o focinho e o peito na cor da pele do
// Clawd (é ele) e os olhos vermelhos. Montado de formas (elipses e cápsulas) numa grade de
// MW x MH células; o contorno, a luz de cima e a sombra onde uma parte passa na frente da
// outra saem sozinhos. Cada pose (os dois braços + a boca) vira uma imagem de 1 px por
// célula, guardada; quem desenha estica (pixel duro).
const { cache, tela } = require('./comum');

const MW = 34, MH = 44, MY = 4;  // a grade; MY: a folga de cima (os punhos erguidos passam da cabeça)
const COR = {
  K: '#3B2205',                                   // contorno
  F: '#F0B020', L: '#FFE07A', f: '#D6960F', D: '#A9690A',  // pelo: o dourado, a luz de cima, meia-sombra, sombra
  S: '#D77757', s: '#EBA184', d: '#A9553C',       // a pele do Clawd (focinho, peito, orelha)
  E: '#F43F3F', e: '#FFB4B4',                     // o olho vermelho e o brilho dele
  W: '#FFFFFF', M: '#4A0C12', t: '#C2414B',       // dente, a boca aberta, a língua
  N: '#5B2A1A', B: '#5E3404',                     // narina/risco da boca, a sobrancelha
};

// ---------- formas (coordenadas do corpo: x 0..MW, y 0..40 = o chão; o MY vem depois) ----------
const eli = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
function cap(x1, y1, x2, y2, r) {
  const dx = x2 - x1, dy = y2 - y1, L2 = dx * dx + dy * dy || 1;
  return (x, y) => {
    const u = Math.max(0, Math.min(1, ((x - x1) * dx + (y - y1) * dy) / L2));
    return (x - x1 - u * dx) ** 2 + (y - y1 - u * dy) ** 2 <= r * r;
  };
}
function tri(ax, ay, bx, by, cx, cy) {
  const s = (px, py, qx, qy, x, y) => (x - qx) * (py - qy) - (px - qx) * (y - qy);
  return (x, y) => {
    const d1 = s(x, y, ax, ay, bx, by) < 0, d2 = s(x, y, bx, by, cx, cy) < 0, d3 = s(x, y, cx, cy, ax, ay) < 0;
    return d1 === d2 && d2 === d3;
  };
}
const ou = (...fs) => (x, y) => fs.some(f => f(x, y));
const espelho = f => (x, y) => f(MW - x, y);

// os braços (o da esquerda da tela; o outro é o espelho): ombro -> cotovelo -> punho
const BRACO = {
  baixo: ou(cap(7, 16, 5, 24, 3.2), cap(5, 24, 5.5, 31.5, 3.4), eli(6, 34.5, 3.6, 3)),
  cima: ou(cap(7, 15, 3.5, 8, 3.2), cap(3.5, 8, 5, 1.5, 3.2), eli(5.5, 0, 3.4, 3)),
  peito: ou(cap(7, 16, 4.5, 22, 3.2), cap(4.5, 22, 11.5, 21, 3), eli(13, 20.5, 3, 3)),
  recua: ou(cap(7, 16, 2.8, 19.5, 3.2), cap(2.8, 19.5, 2.5, 13, 3), eli(3, 11.5, 3, 3)),
};
const CAUDA = ou(cap(25, 33, 30, 31, 1.4), cap(30, 31, 32, 26, 1.4), cap(32, 26, 30.5, 22, 1.4), cap(30.5, 22, 27.5, 22.5, 1.3));

// z: quem fica na frente (cauda 0, pernas 1, tronco 2, braços 3, cabeça 4)
function montarGrade(pose) {
  const m = Array.from({ length: MH }, () => new Array(MW).fill(null));
  const z = Array.from({ length: MH }, () => new Array(MW).fill(-1));
  const pinta = (f, mat, zz, so) => {  // so: só por cima do que já é desse material
    for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
      if (!f(x + 0.5, y + 0.5 - MY)) continue;
      if (so ? m[y][x] !== so : zz < z[y][x]) continue;
      m[y][x] = mat; z[y][x] = zz;
    }
  };
  pinta(CAUDA, 'F', 0);
  pinta(ou(eli(11.5, 31.5, 4.2, 4.5), eli(22.5, 31.5, 4.2, 4.5), eli(10.5, 37.3, 5, 2.4), eli(23.5, 37.3, 5, 2.4)), 'F', 1);
  pinta(ou(eli(17, 22, 10, 9.5), eli(17, 16, 12.5, 5.2), eli(17, 28, 9, 4)), 'F', 2);
  pinta(eli(17, 22.5, 6.2, 6.5), 'S', 2);                                   // o peito
  pinta(ou(cap(17, 18.5, 17, 21, 0.3), cap(13, 24.5, 16, 25.5, 0.45), cap(18, 25.5, 21, 24.5, 0.45)), 'd', 2, 'S');  // o vinco do peitoral
  pinta(BRACO[pose.E], 'F', 3);
  pinta(espelho(BRACO[pose.D]), 'F', 3);
  // a cabeça: o crânio, os tufos de cima, as bochechas, as orelhas
  pinta(ou(eli(17, 9.8, 7, 6.3), tri(12, 5, 15.5, 3.8, 12.5, 1.2), tri(15.5, 3.6, 18.5, 3.6, 17.8, 0.6), tri(18.5, 3.8, 22, 5, 22.5, 2.2),
    eli(10.3, 12.5, 2.4, 2.6), eli(23.7, 12.5, 2.4, 2.6), eli(9.2, 8.5, 2, 2.2), eli(24.8, 8.5, 2, 2.2)), 'F', 4);
  pinta(ou(eli(9.2, 8.5, 0.9, 1.1), eli(24.8, 8.5, 0.9, 1.1)), 'S', 4);     // dentro da orelha
  const aberta = pose.boca > 0;
  pinta(aberta ? eli(17, 14, 5.2, 4.3) : eli(17, 13.2, 5.2, 3.3), 'S', 4);  // o focinho (a boca aberta desce o queixo)
  pinta(ou(cap(11.2, 7.2, 15.6, 8.6, 0.75), cap(22.8, 7.2, 18.4, 8.6, 0.75)), 'B', 4);  // a sobrancelha grossa, brava (em V)
  const cel = (x, y, mat) => { if (m[y + MY]) { m[y + MY][x] = mat; z[y + MY][x] = 4; } };
  for (const x of [13, 14, 20, 21]) cel(x, 9, 'E');                          // os olhos
  cel(14, 9, 'e'); cel(20, 9, 'e');
  cel(16, 11, 'N'); cel(18, 11, 'N');                                        // as narinas
  if (aberta) {
    pinta(eli(17, 15.2, 3.7, 2.5), 'M', 4, 'S');
    for (const x of [16, 17, 18]) cel(x, 16, 't');
    cel(14, 13, 'W'); cel(20, 13, 'W'); cel(15, 17, 'W'); cel(19, 17, 'W');   // as presas
  } else {
    for (let x = 14; x <= 20; x++) cel(x, 14, 'N');
    cel(13, 15, 'N'); cel(21, 15, 'N');  // os cantos pra baixo: bravo
    cel(15, 15, 'W'); cel(19, 15, 'W');  // as presas por cima do lábio
  }
  return { m, z };
}

// a luz, a sombra e o contorno
function sombrear({ m, z }) {
  const vazio = (x, y) => y < 0 || y >= MH || x < 0 || x >= MW || m[y][x] == null;
  const out = m.map(l => l.slice());
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const c = m[y][x];
    if (c == null) {
      if (!vazio(x - 1, y) || !vazio(x + 1, y) || !vazio(x, y - 1) || !vazio(x, y + 1)) out[y][x] = 'K';
      continue;
    }
    const naFrente = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !vazio(x + dx, y + dy) && z[y + dy][x + dx] > z[y][x]);
    if (c === 'F') {
      const frente2 = [[2, 0], [-2, 0], [0, 2], [0, -2]].some(([dx, dy]) => !vazio(x + dx, y + dy) && z[y + dy][x + dx] > z[y][x]);
      if (naFrente || vazio(x, y + 1) || vazio(x + 1, y)) out[y][x] = 'D';
      else if (vazio(x, y - 1) || vazio(x - 1, y)) out[y][x] = 'L';
      else if (frente2 || vazio(x, y + 2) || vazio(x + 2, y)) out[y][x] = 'f';  // arredonda
    } else if (c === 'S') {
      if (naFrente || (!vazio(x, y + 1) && m[y + 1][x] !== 'S' && m[y + 1][x] !== 'd')) out[y][x] = 'd';
      else if (!vazio(x, y - 1) && m[y - 1][x] !== 'S' && m[y - 1][x] !== 's') out[y][x] = 's';
    }
  }
  return out;
}

// a imagem de uma pose: { E, D: 'baixo' | 'cima' | 'peito' | 'recua', boca: 0 | 1 }
const IMGS = cache(24);
function macaco(pose) {
  const chave = `${pose.E},${pose.D},${pose.boca ? 1 : 0}`;
  const pronta = IMGS.get(chave);
  if (pronta) return pronta;
  const g = sombrear(montarGrade(pose)), c = tela(MW, MH), k = c.getContext('2d');
  for (let y = 0; y < MH; y++) for (let x = 0; x < MW; x++) {
    const ch = g[y][x];
    if (ch && COR[ch]) { k.fillStyle = COR[ch]; k.fillRect(x, y, 1, 1); }
  }
  c.chave = 'macaco' + chave;
  return IMGS.set(chave, c);
}
// onde ficam (em células, a partir do canto de cima à esquerda da imagem) a boca e o peito: as
// ondas do rugido e os socos saem dali; os pés ficam na linha MH
const BOCA = [17, 15 + MY], PEITO = [17, 21 + MY];

module.exports = { macaco, MW, MH, MY, BOCA, PEITO, COR };
