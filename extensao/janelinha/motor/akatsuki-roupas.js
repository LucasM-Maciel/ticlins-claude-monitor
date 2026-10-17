'use strict';
// Tema Akatsuki: as roupas do Clawd, 5 no lado Akatsuki e 4 no Time 7 (dono, 13/10: "os 3 variam de
// cada vez que trocar"; Kisame e Konan entraram em 17/10). A cada troca de lado (tema-akatsuki.js, 50 voltas) ele veste a próxima roupa do lado
// novo. Desenho nosso, no pixel do Clawd: nada copiado do anime, sem símbolo de vila na bandana.
// Letras: '#' corpo, A/B pernas, o resto é de cada roupa (as cores logo abaixo das linhas). Mais
// de 10 meias-fileiras = cabelo/chapéu/máscara crescendo pra cima (como no clawd.js).
const { registrarRoupas } = require('./clawd');

const PELE = '#D77757';
const PELE_TUBARAO = '#7A97B0';  // o Kisame: o corpo todo azul acinzentado (a pálpebra vem dele)
const MANTO = { b: '#141414', q: '#F3F4F6', R: '#DC2626' };  // o manto preto, a borda e a nuvem
const BANDANA = { n: '#1E3A8A', p: '#CBD5E1' };              // o pano azul e a plaquinha de metal lisa

// ---------- lado Akatsuki ----------
// 1. o chapéu de palha com fitas (a de antes)
const PALHA = [
  '......wwwwww......',
  '....wwwwWwwwww....',
  '..wwwwwwwwwwwwww..',
  'WWWWWWWWWWWWWWWWWW',
  '.f.############.f.',
  '.f.############.f.',
  '...##r######r##...',
  '...##r######r##...',
  '.bbbbbbbbbbbbbbbb.',
  '.bbbqqqbbbbbbbbbb.',
  '...qRRRqbbbbbqqq..',
  '..bbqqqbbbbbqRRRq.',
  '....A.B....A.B....',
  '....A.B....A.B....',
];
// 2. a máscara laranja em espiral (um furo só, no olho da frente), o cabelo preto espetado
const ESPIRAL = [
  '....h.hh.hh.h.....',
  '...hhhhhhhhhhhh...',
  '....mmmmmmmmmm....',
  '...mmmkkkkkkmmm...',
  '...mmkmmmmmmkmm...',
  '...mkmmkkkkmmkm...',
  '...mkmkmmmrkmkm...',
  '...mmkmkkkmmkmm...',
  '.bbbbbbbbbbbbbbbb.',
  '.bbbqqqbbbbbbbbbb.',
  '...qRRRqbbbbbqqq..',
  '..bbqqqbbbbbqRRRq.',
  '....A.B....A.B....',
  '....A.B....A.B....',
];
// 3. o cabelo preto comprido e a bandana com a plaquinha riscada
const RISCADA = [
  '....hhhhhhhhhh....',
  '...hhhhhhhhhhhh...',
  '..hnnnnppxpnnnnh..',
  '..hnnnnpxppnnnnh..',
  '..h##r######r##h..',
  '..h##r######r##h..',
  '.bbbbbbbbbbbbbbbb.',
  '.bbbqqqbbbbbbbbbb.',
  '...qRRRqbbbbbqqq..',
  '..bbqqqbbbbbqRRRq.',
  '....A.B....A.B....',
  '....A.B....A.B....',
];
// 4. o tubarão: a pele azul acinzentada, o cabelo azul-escuro em barbatanas (a ponta atrás), a
// bandana riscada, as brânquias na bochecha (g), os dentes pontudos entre os olhos e a espada
// enfaixada nas costas, saindo inclinada por cima do ombro
const TUBARAO = [
  '...h.............H',
  '...hh..h........sS',
  '...hhh.hh..h....Ss',
  '...hhhhhhhhhhhhsS.',
  '...nnnnppxpnnnnSs.',
  '...############sS.',
  '...g#r#tttt#r#gSs.',
  '...#gr#tktk#rg#sS.',
  '.bbbbbbbbbbbbbbbb.',
  '.bbbqqqbbbbbbbbbb.',
  '...qRRRqbbbbbqqq..',
  '..bbqqqbbbbbqRRRq.',
  '....A.B....A.B....',
  '....A.B....A.B....',
];
// 5. o cabelo azul-violeta curto com o coque redondo no alto e a flor de papel logo abaixo dele, do
// lado da frente; as mechas emoldurando o rosto e a sombra roxa em cima dos olhos (a pálpebra também)
const FLOR = [
  '.......hhh........',
  '.......jhhh.......',
  '....hhhhhhhfff....',
  '...hhhhhhhhfFfh...',
  '..hhhh######hhhh..',
  '..hh#e######e#hh..',
  '..h##r######r##h..',
  '..j##r######r##j..',
  '.bbbbbbbbbbbbbbbb.',
  '.bbbqqqbbbbbbbbbb.',
  '...qRRRqbbbbbqqq..',
  '..bbqqqbbbbbqRRRq.',
  '....A.B....A.B....',
  '....A.B....A.B....',
];

// ---------- lado Time 7 ----------
// 1. o cabelo amarelo espetado e a jaqueta laranja de ombros pretos
const LARANJA = [
  '...y.yy.yy.yy.y...',
  '..yyyyyyyyyyyyyy..',
  '...nnnnppppnnnn...',
  '..y############y..',
  '...##o######o##...',
  '...#v########v#...',
  '.KKJJJJJzJJJJJJKK.',
  '.JJJJJJJzJJJJJJJJ.',
  '...JJJJJzJJJJJJ...',
  '...KKKKKKKKKKKK...',
  '....A.B....A.B....',
  '....A.B....A.B....',
];
// 2. o cabelo branco caído pro lado, a bandana tapando um olho, a máscara no rosto, o colete verde
const COLETE = [
  '.......wwwwwww....',
  '....wwwwwwwwwwww..',
  '...wwwwwwwwwwwww..',
  '...nnnnppppnnnn...',
  '...nnn#########...',
  '...nnnn#####o##...',
  '...MMMMMMMMMMMM...',
  '.MMggggggggggggMM.',
  '.MMgPPggggggPPgMM.',
  '...gggggggggggg...',
  '...MMMMMMMMMMMM...',
  '....A.B....A.B....',
  '....A.B....A.B....',
];
// 3. o cabelo preto espetado pra trás, a blusa azul-escura e o short claro
const AZUL = [
  '..hh.hhhhhhhh.....',
  '.hhhhhhhhhhhhhh...',
  'hhhnnnnppppnnnn...',
  '.hh############...',
  '...##o######o##...',
  '...############...',
  '.##CCCCCCCCCCCC##.',
  '.CCCCCCCCCCCCCCCC.',
  '...CCCCCCCCCCCC...',
  '...WWWWWWWWWWWW...',
  '....A.B....A.B....',
  '....A.B....A.B....',
];
// só no épico do Time 7 (a terceira do time; o Clawd nunca veste): o cabelo rosa até o ombro com a
// bandana de tiara, a blusa vermelha sem manga
const ROSA = [
  '....hhhhhhhhhh....',
  '..hnnnnppppnnnnh..',
  '..h############h..',
  '..h##o######o##h..',
  '..h############h..',
  '..hh##########hh..',
  '.##RRRRRRRRRRRR##.',
  '.#RRRRRRRRRRRRRR#.',
  '...RRRRRRRRRRRR...',
  '...SSSSSSSSSSSS...',
  '....A.B....A.B....',
  '....A.B....A.B....',
];

const ROUPAS = {
  akatsuki: {
    linhas: PALHA, perna: ['#4B5563', '#9CA3AF'], corpo: PELE, olho: /r/,
    cores: { '#': PELE, r: '#DC2626', w: '#D6B26E', W: '#9C7A3C', f: '#F3F4F6', ...MANTO },
  },
  'aka-espiral': {
    linhas: ESPIRAL, perna: ['#4B5563', '#9CA3AF'], corpo: PELE, olho: /r/, palpebra: '#0A0A0A',
    cores: { '#': PELE, r: '#DC2626', h: '#111111', m: '#EA8A1E', k: '#7C2D12', ...MANTO },
  },
  'aka-riscada': {
    linhas: RISCADA, perna: ['#4B5563', '#9CA3AF'], corpo: PELE, olho: /r/,
    cores: { '#': PELE, r: '#DC2626', h: '#111111', x: '#334155', ...BANDANA, ...MANTO },
  },
  'aka-kisame': {
    linhas: TUBARAO, perna: ['#4B5563', '#9CA3AF'], corpo: PELE_TUBARAO, olho: /r/,
    cores: {
      '#': PELE_TUBARAO, r: '#0F172A', h: '#34528F', g: '#3E5A75', t: '#F8FAFC', k: '#0F172A',
      s: '#E7E2D3', S: '#A39C88', H: '#4B4540', x: '#334155', ...BANDANA, ...MANTO,
    },
  },
  'aka-konan': {
    linhas: FLOR, perna: ['#4B5563', '#9CA3AF'], corpo: PELE, olho: /r/, palpebra: '#7C3AED',
    cores: { '#': PELE, r: '#1A1A1A', h: '#6F7FE0', j: '#4B57B5', f: '#F8FAFC', F: '#9DBCE8', e: '#7C3AED', ...MANTO },
  },
  't7-laranja': {
    linhas: LARANJA, perna: ['#F97316', '#1E3A8A'], corpo: PELE,
    cores: { '#': PELE, o: '#1E3A8A', y: '#FACC15', v: '#9A4A2E', J: '#F97316', K: '#1F2937', z: '#F3F4F6', ...BANDANA },
  },
  't7-colete': {
    linhas: COLETE, perna: ['#1E293B', '#1E293B'], corpo: PELE,
    cores: { '#': PELE, o: '#1A1A1A', w: '#E5E7EB', M: '#1E293B', g: '#4D7C0F', P: '#3F6212', ...BANDANA },
  },
  't7-azul': {
    linhas: AZUL, perna: ['#E5E7EB', '#1E293B'], corpo: PELE,
    cores: { '#': PELE, o: '#1A1A1A', h: '#111827', C: '#1E2A4A', W: '#E5E7EB', ...BANDANA },
  },
  't7-rosa': {
    linhas: ROSA, perna: ['#1F2937', '#111827'], corpo: PELE,
    cores: { '#': PELE, o: '#15803D', h: '#F9A8D4', R: '#DC2626', S: '#1F2937', ...BANDANA },
  },
};
for (const [nome, R] of Object.entries(ROUPAS)) {
  for (const l of R.linhas) if (l.length !== 18) throw new Error(`roupa ${nome}: linha com ${l.length} colunas`);
}
registrarRoupas(ROUPAS);

// a ordem de cada lado (a rosa fica de fora: só aparece no épico) e o contorno de 1 px de cada roupa
// (o Clawd anda por cima de qualquer fundo)
const LADOS = {
  akatsuki: ['akatsuki', 'aka-espiral', 'aka-riscada', 'aka-kisame', 'aka-konan'],
  time7: ['t7-laranja', 't7-colete', 't7-rosa', 't7-azul'],  // Naruto, Kakashi, Sakura, Sasuke (troca a cada 20 voltas; dono, 17/10)
};
const CONTORNO = {
  akatsuki: '#5B1414', 'aka-espiral': '#5B1414', 'aka-riscada': '#5B1414', 'aka-kisame': '#5B1414', 'aka-konan': '#5B1414',
  't7-laranja': '#1E293B', 't7-colete': '#0F172A', 't7-azul': '#0F172A', 't7-rosa': '#0F172A',
};

module.exports = { ROUPAS, LADOS, CONTORNO };
