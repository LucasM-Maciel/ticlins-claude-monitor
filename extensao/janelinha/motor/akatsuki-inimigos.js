'use strict';
// Tema Akatsuki: os inimigos das cenas da caminhada (dono, 14/10: "queria que os bugs não fossem os
// únicos inimigos"). Além do bug, cada lado enfrenta 3: o Time 7 enfrenta o Zetsu Branco, um ninja
// renegado (bandana riscada) e uma marionete (presa em fios de chakra); a Akatsuki enfrenta um ANBU
// (máscara de gato), um ninja da Folha (colete verde) e o Kakashi (lendo o livrinho laranja).
// Desenho nosso, em pixel, do tamanho do Clawd, virados pra esquerda (pro Clawd). A cena sorteia
// um dos 4 pela semente. Os épicos seguem com o bug (dono, 14/10).
// No referencial da cena: origem entre os pés, como o bug.
const { arte, tingida, rng, rgba } = require('./comum');
const A = require('./akatsuki-arte');

const P = 1.5;  // o pixel do Clawd

// as pernas: parado (juntas) e andando (passo aberto); n = a calça, d = o pé
const PERNAS = {
  p: ['...onnnnno...', '...onnonno...', '...oddoddo...'],
  q: ['...onnnnno...', '..onno.onno..', '.oddo...oddo.'],
};
const PELE = { o: '#111827', s: '#F6CFA6', S: '#D99B6C', e: '#111827' };

const TIPOS = {
  // o ninja da Folha: cabelo castanho espetado, bandana com a placa de metal, colete verde
  folha: {
    linhas: [
      '...o..o..o...',
      '..oho.oHoHo..',
      '.ohhhohhhhhho',
      '.ohhhhhhhhhho',
      '.ommmmmmbbbho',
      '.omMkkMmbbhho',
      '.osssssssShho',
      '.osesssesShho',
      '.osesssesSso.',
      '..osssSSSo...',
      '.ovvVvvvVvvo.',
      'osvvVvwvVvvvo',
      '.onvVvvvVvno.',
    ],
    cores: { ...PELE, h: '#6B3F1D', H: '#8B5A2B', m: '#D1D5DB', M: '#9CA3AF', k: '#4B5563', b: '#1E3A8A', v: '#5B7F2A', V: '#3F5F1A', w: '#7CA03A', n: '#1E3A8A', d: '#1F2937' },
  },
  // o ANBU: máscara branca de gato com riscos vermelhos, colete cinza, a espada nas costas
  anbu: {
    linhas: [
      '....ooooo....',
      '...ohhhhhoo..',
      '..ohhhhhhhho.',
      '.owwwwwwhhhho',
      '.owwrwwwwhhho',
      '.oeewwweewhho',
      '.owrwwwwwwho.',
      '.owwwwwwwwho.',
      '..owwwrwwwo..',
      '..okkkkkkkoyo',
      '.ogGGgggGGkyo',
      'owggGgggGgkko',
      '.okggGgGggko.',
    ],
    cores: { ...PELE, h: '#4C1D95', w: '#F3F4F6', r: '#DC2626', g: '#D1D5DB', G: '#9CA3AF', k: '#1F2937', y: '#78716C', n: '#1F2937', d: '#111827' },
  },
  // o Kakashi: cabelo prateado espetado pra trás, a bandana torta tapando um olho, a máscara azul
  // e o livrinho laranja aberto na mão
  kakashi: {
    linhas: [
      '.......o.o.o.',
      '.....owoWowWo',
      '...oowwwwwwWo',
      '..owwwwwwwwwo',
      '.ommmmmmmbwwo',
      '.osssmmmmbbwo',
      '.osesssmMbwo.',
      '.onnnnnnnNwo.',
      '.onnnnnnnNo..',
      '..onnnnNNo...',
      '.oBBvVvvVvvo.',
      'osBBvVvvVvvvo',
      '.onvVvvvVvno.',
    ],
    cores: { ...PELE, w: '#E5E7EB', W: '#F9FAFB', m: '#D1D5DB', M: '#9CA3AF', b: '#1E3A8A', n: '#1E3A8A', N: '#172554', v: '#5B7F2A', V: '#3F5F1A', B: '#F97316', d: '#1F2937' },
  },
  // o Zetsu Branco: todo branco, careca, olhos pretos e o sorriso de dentes
  zetsu: {
    linhas: [
      '....ooooo....',
      '...owwwwwo...',
      '..owwwwwwWo..',
      '.owwwwwwwwWo.',
      '.oewwwewwwWo.',
      '.oewwwewwwWo.',
      '.okwwwwwwkWo.',
      '.owktktkkwWo.',
      '..owwwwwwWo..',
      '..owwwwwwWo..',
      '.owwwwwwwwWo.',
      'owwowwwwwWoWo',
      '.o.owwwwWo.o.',
    ],
    cores: { ...PELE, w: '#F1F5F9', W: '#CBD5E1', k: '#1F2937', t: '#F8FAFC', n: '#E2E8F0', d: '#CBD5E1' },
  },
  // o ninja renegado: bandana com o risco no símbolo, cachecol vinho tapando a boca, roupa preta
  renegado: {
    linhas: [
      '....ooooo....',
      '...okkkkkoo..',
      '..okkkkkkkko.',
      '.ommmmmmbbkko',
      '.omxxxxmbbkko',
      '.osssssssSkko',
      '.osesssesSko.',
      '.orrrrrrrrRo.',
      '.orrrrrrrRRRo',
      '..orrrrRRoRRo',
      '.okkKkkkKkko.',
      'oskkKkkkKkkko',
      '.okkKkkkKkko.',
    ],
    cores: { ...PELE, k: '#27272A', K: '#18181B', m: '#D1D5DB', b: '#3F3F46', x: '#991B1B', r: '#7F1D1D', R: '#5B1414', n: '#27272A', d: '#111827' },
  },
  // a marionete: cabeça de madeira, olhos vazios, a mandíbula de dobradiça, presa em fios de chakra
  marionete: {
    linhas: [
      '....ooooo....',
      '...ommmmmo...',
      '..ommMmmmMo..',
      '.ommmmmmmmMo.',
      '.okkmmmkkmMo.',
      '.okemmmkemMo.',
      '.ommmmmmmmMo.',
      '.okkkkkkkMMo.',
      '.ommmmmmmMo..',
      '..oMMoMMMo...',
      '.occmccmccco.',
      'omccmccmcccco',
      '.occmccmccco.',
    ],
    cores: { ...PELE, m: '#B7791F', M: '#7C4A12', k: '#1C1917', e: '#38BDF8', c: '#44403C', n: '#7C4A12', d: '#5A3410' },
    fios: true,
  },
};
for (const [nome, t] of Object.entries(TIPOS)) {
  t.nome = nome; t.w = 13 * P; t.h = (t.linhas.length + 3) * P;
}
const BUG = { nome: 'bug', w: A.BUG_W, h: A.BUG_H };

// quem cada lado enfrenta (o bug é um dos 4)
const LADOS = { akatsuki: ['bug', 'anbu', 'folha', 'kakashi'], time7: ['bug', 'zetsu', 'renegado', 'marionete'] };
const tipo = nome => (nome === 'bug' ? BUG : TIPOS[nome]);
// o inimigo da cena: sorteado pela semente (sem mexer nos outros sorteios dela)
function sortear(semente, lado) {
  const lista = LADOS[lado], r = rng((semente * 2654435761 + 97) >>> 0);
  r();
  return tipo(lista[Math.floor(r() * lista.length)]);
}

// os fios de chakra da marionete: das mãos e da cabeça pra cima, balançando um pouco
function fios(g, x, y, t, alfa) {
  g.save(); g.globalAlpha *= alfa * 0.7;
  g.strokeStyle = rgba('#7DD3FC', 1); g.lineWidth = 0.5;
  for (const [fx, fy, d] of [[-8, -15, 0], [-1, -27, 1.7], [7, -15, 3.1]]) {
    const b = Math.sin(t * 3 + d) * 2;
    g.beginPath(); g.moveTo(x + fx, y + fy); g.lineTo(x + fx + 6 + b, y - 60); g.stroke();
  }
  g.restore();
}

// o mesmo jeito de desenhar do bug: passo 'p' (parado) | 'q' (andando); cor pinta por cima (o
// cinza do fogo); a: o vermelho do golpe (0 a 1); sx/sy: amassa; t: o relógio (os fios balançam)
function inimigo(g, I, x, y, { passo = 'p', cor = null, a = 0, sx = 1, sy = 1, alfa = 1, t = 0 } = {}) {
  if (I.nome === 'bug') return A.bug(g, x, y, { passo, cor, a, sx, sy, alfa });
  let img = arte(I.linhas.concat(PERNAS[passo === 'q' ? 'q' : 'p']), I.cores);
  const chave = 'akaini' + I.nome + passo;
  if (I.fios && !cor && a === 0 && sy === 1) fios(g, x, y, t, alfa);  // no golpe, os fios arrebentam
  if (cor) img = tingida(img, cor, chave);
  g.save(); g.globalAlpha *= alfa; g.translate(x, y); g.scale(sx, sy);
  g.drawImage(img, -I.w / 2, -I.h, I.w, I.h);
  if (a > 0 && !cor) { g.globalAlpha *= a; g.drawImage(tingida(img, '#EF4444', chave + 'v'), -I.w / 2, -I.h, I.w, I.h); }
  g.restore();
}

module.exports = { TIPOS, LADOS, BUG, tipo, sortear, inimigo };
