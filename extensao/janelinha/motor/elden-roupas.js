'use strict';
// Tema Elden Ring: as roupas do Clawd (dono, 21/10: 3 armaduras, sorteadas a cada volta). Desenho nosso, no
// pixel do Clawd. Letras: '#' corpo, A/B pernas, o resto é de cada roupa (as cores logo abaixo das linhas).
// Mais de 10 meias-fileiras = elmo/chapéu crescendo pra cima (como no clawd.js). Os olhos são as letras 'o'.
const { registrarRoupas } = require('./clawd');

const PELE = '#D77757';

// 1. o Cavaleiro: elmo de aço com a viseira escura e os olhos amarelos, ombreiras, fivela de ouro e a capa
// nas costas (atrás dele, do lado esquerdo)
const CAVALEIRO = [
  '........ee........',
  '.......eeee.......',
  '.....eeeeeeee.....',
  '....eeeeeeeeee....',
  '...eeeeeeeeeeee...',
  '...evovvvvvvove...',
  '...evovvvvvvove...',
  '.PPDppppppppppDPP.',
  '.PDppppggggppppDP.',
  'cccDppppppppppD...',
  'cccbbbbggbbbbbb...',
  '.cc.A.B....A.B....',
  '.cc.A.B....A.B....',
];
// 2. o Bandido: capuz de couro com o rosto na sombra (só os olhos), peitoral de couro com a tira e o lenço
const BANDIDO = [
  '.......hhhh.......',
  '.....hhhhhhhh.....',
  '....hhhhhhhhhh....',
  '...hHhhhhhhhhhh...',
  '...hsossssssosh...',
  '...hsossssssosh...',
  '.hhllllllllllllhh.',
  '.hlLllllggllllLlh.',
  '...wwllllllllll...',
  '...LLLLggLLLLLL...',
  '....A.B....A.B....',
  '....A.B....A.B....',
];
// 3. o Feiticeiro: chapéu pontudo azul com uma estrela de ouro, túnica com a barra dourada e a barba branca
const FEITICEIRO = [
  '.........uu.......',
  '.......uuuu.......',
  '......uuuuuu......',
  '.....uuyuuuuu.....',
  '....uuuuuuuuuu....',
  '..uuuuuuuuuuuuuu..',
  '...gggggggggggg...',
  '...##o######o##...',
  '...##o######o##...',
  '.RRrrrrrrrrrrrrRR.',
  '.RrrrrggggrrrrrrR.',
  '...rrrWWWWWWrrr...',
  '...rrrrrWWrrrrr...',
  '....A.B....A.B....',
  '....A.B....A.B....',
];

const ROUPAS = {
  'elden-cavaleiro': {
    linhas: CAVALEIRO, perna: ['#4B5563', '#1F2937'], corpo: PELE, olho: /o/, palpebra: '#1B222B',
    cores: {
      '#': PELE, e: '#A8B0BC', E: '#6B7280', v: '#1B222B', o: '#FACC15', P: '#B6BDC8', p: '#7B8594', D: '#4B5563',
      g: '#D4AF37', b: '#4A3426', c: '#3B2B22',
    },
  },
  'elden-bandido': {
    linhas: BANDIDO, perna: ['#3B2F2A', '#1F1A17'], corpo: PELE, olho: /o/, palpebra: '#0B0D10',
    cores: {
      '#': PELE, h: '#2B2F36', H: '#454D58', s: '#0B0D10', o: '#FDE68A', l: '#3B2F2A', L: '#6B4F3A', g: '#D4AF37', w: '#9F1D1D',
    },
  },
  'elden-feiticeiro': {
    linhas: FEITICEIRO, perna: ['#4C4FB5', '#34377F'], corpo: PELE, olho: /o/,
    cores: {
      '#': PELE, o: '#1A1A1A', u: '#3B3A8C', y: '#FDE68A', g: '#D4AF37', R: '#34377F', r: '#4C4FB5', W: '#E5E7EB',
    },
  },
};
for (const [nome, R] of Object.entries(ROUPAS)) {
  for (const l of R.linhas) if (l.length !== 18) throw new Error(`roupa ${nome}: linha com ${l.length} colunas`);
}
registrarRoupas(ROUPAS);

// a ordem do sorteio e o contorno de 1 px de cada roupa (o Clawd anda por cima de qualquer fundo)
const LISTA = ['elden-cavaleiro', 'elden-bandido', 'elden-feiticeiro'];
const CONTORNO = { 'elden-cavaleiro': '#3A2C0E', 'elden-bandido': '#5A4410', 'elden-feiticeiro': '#1E1B4B' };

module.exports = { ROUPAS, LISTA, CONTORNO };
