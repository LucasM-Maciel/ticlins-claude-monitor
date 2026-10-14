'use strict';
// Evento épico raro do lado Time 7 (a cada 30 bugs derrubados), ~13 s: OS TRÊS DO TIME (dono, 13/10:
// "os 3 do time, mas mais épico"). A área acima do cartão vira uma tarde dourada com a fileira de
// árvores (abre de baixo pra cima). Os três ficam lado a lado na borda do cartão: o de azul, o de
// laranja e a de rosa. O Clawd é um deles quando está de azul ou de laranja (os outros dois chegam
// num puf); de colete ele é o mestre, fica atrás, e chegam os três. Um bug gigante entra pela direita.
// - O de azul (Sasuke): uma aura roxa sobe e vira o Susanoo, o guerreiro espiritual gigante,
//   translúcido, de espada; o corte joga o bug pra trás.
// - O de laranja (Naruto): a aura laranja vira a Kurama, a raposa gigante de nove caudas, de lado;
//   ela ruge, arma a patada e dá o bote: três garras de chakra rasgam o bug de baixo pra cima e
//   jogam ele pro alto.
// - A de rosa (Sakura): a marca na testa acende, ela salta e soca o chão bem onde o bug cai: o chão
//   racha, pedras voam e o bug some no céu numa estrelinha.
// Pose de punho erguido, os ajudantes somem num puf e o palco fecha. Desenho nosso, no pixel do
// tema (os nomes do anime podem aparecer: dono, 13/10, "produto não lucrativo").
//
// Tudo é função de t (o sorteio da semente só mexe nas rachaduras, pedras e fumaça). Coordenadas do
// palco como no akatsuki-epico.js (DIPs a partir do canto de cima à esquerda do cartão, Y- pra cima);
// os personagens são desenhados no referencial do Clawd (x = palco - X0).
const { lim, sai, entra, cache, arte, tela, rng, rgba } = require('./comum');
const A = require('./akatsuki-arte');
const T7 = require('./akatsuki-time7');

const { fatia } = A;

// ---------- ritmo (s) ----------
const T = {
  abre: [0, 0.5], vai: [0.4, 0.8], chega: [0.7, 0.95, 1.2],  // os puf de chegada, um por ajudante
  bug: [1.2, 2.6], empina: [2.6, 3.0],
  auraAzul: [2.8, 4.6], guerreiro: [3.3, 4.3], corte: [4.6, 4.85], acerta: 4.75, recua: [4.75, 5.1], volta: [5.1, 5.7], someGuerreiro: [5.3, 5.9],
  auraLaranja: [5.7, 7.4], raposa: [6.2, 7.0], ruge: [7.0, 7.45], arma: [7.45, 7.65], bote: [7.65, 7.83], joga: 7.85, garras: [7.8, 8.3],
  voltaRaposa: [8.2, 8.55], cai: [7.85, 8.95], someRaposa: [8.6, 9.3],
  marca: [8.0, 9.6], agacha: [8.15, 8.4], salto: [8.4, 8.98], soco: 9.0, rachas: [9.0, 9.7], voa: [9.0, 9.6], estrela: [9.6, 10.1],
  volta2: [10.0, 10.5], pose: [10.6, 11.3], saem: [11.4, 11.55, 11.7], fica: [11.8, 12.2], fecha: [12.4, 12.8], dur: 13.0,
};

const linhaDoTempo = [
  [0, 'a tarde dourada abre acima do cartão, de baixo pra cima'],
  [T.vai[0], 'o Clawd vai pro lugar dele; os outros do time chegam num puf'],
  [T.bug[0], 'um bug gigante entra pela direita e se empina'],
  [T.auraAzul[0], 'o de azul: a aura roxa vira um guerreiro espiritual gigante de espada'],
  [T.corte[0], 'o corte: o bug voa pra trás e volta'],
  [T.auraLaranja[0], 'o de laranja: a aura laranja vira a Kurama, a raposa gigante de nove caudas'],
  [T.ruge[0], 'a raposa ruge, arma a patada e dá o bote'],
  [T.joga, 'três garras de chakra rasgam o bug de baixo pra cima e jogam ele pro alto'],
  [T.marca[0], 'a de rosa: a marca na testa acende, ela salta'],
  [T.soco, 'o soco no chão: rachaduras, pedras, o bug some no céu numa estrelinha'],
  [T.pose[0], 'os três erguem o punho; os ajudantes somem num puf'],
  [T.fecha[0], 'o céu fecha de volta pra borda do cartão'],
];

const TRIO = ['t7-azul', 't7-laranja', 't7-rosa'];  // da esquerda pra direita
const MESTRE = 't7-colete';

const TREMORES = [[T.acerta, T.acerta + 0.35, 2, true], [T.ruge[0], T.ruge[1], 1.8], [T.joga, T.joga + 0.3, 2.2, true], [T.soco, T.soco + 0.6, 3.5, true]];
function tremor(t) {
  let a = 0;
  for (const [t0, t1, forca, decai] of TREMORES) {
    if (t < t0 || t >= t1) continue;
    const u = fatia(t, t0, t1);
    a = Math.max(a, forca * (decai ? 1 - u : Math.sin(Math.PI * u)));
  }
  return a;
}

// ---------- os gigantes (gerados pixel a pixel por elipses, nítidos como o resto do tema) ----------
const dentro = (x, y, cx, cy, rx, ry) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
function grade(W, H) {
  const g = Array.from({ length: H }, () => Array(W).fill('.'));
  const pinta = (cor, f, so) => { for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (f(x, y) && (!so || so.includes(g[y][x]))) g[y][x] = cor; };
  // um chifre/orelha: base em (hx, hy), altura h, inclinação inc (px por linha), meia-largura na base
  const ponta = (cor, hx, hy, h, inc, larg, so) => pinta(cor, (x, y) => y <= hy && y > hy - h && Math.abs(x + 0.5 - (hx + inc * (hy - y))) <= 0.3 + larg * (y - (hy - h)) / h, so);
  return { g, pinta, ponta };
}
function contornar(g, W, H) {  // todo vazio encostado (em cruz) no desenho vira 'O'
  return Array.from({ length: H + 2 }, (_, y) => Array.from({ length: W + 2 }, (_, x) => {
    const c = g[y - 1] && g[y - 1][x - 1];
    if (c && c !== '.') return c;
    const viz = [[0, -1], [0, 1], [-1, 0], [1, 0]].some(([dx, dy]) => { const v = g[y - 1 + dy] && g[y - 1 + dy][x - 1 + dx]; return v && v !== '.'; });
    return viz ? 'O' : '.';
  }).join(''));
}

// o guerreiro espiritual: de frente, da cintura pra cima. Primeiro sobe o esqueleto (o crânio, as
// costelas, os ossos do braço); a armadura aparece por cima, translúcida: o elmo de chifres em lua
// crescente, os olhos acesos e bravos, a máscara de grades, as ombreiras de três placas, as
// costelas embaixo do peito. Pixel a pixel (o contorno já vem junto); as chamas roxas nas bordas
// são desenhadas por cima a cada quadro.
const GUERREIRO = [
  '.....O..............................O.....',
  '....OLO............................OLO....',
  '....OLLO............OO............OLDO....',
  '....OLGLO..........OLLO..........OLGDO....',
  '....OLGGLO.........OLDO.........OLGGDO....',
  '....OLGGGLO......OOOLDOOO......OLGGGDO....',
  '.....OLGGDOO...OOHLLGGLLLOO...OLGGGDO.....',
  '.....OLGGGLLOOOLHGGGGGGGGLLOOOLGGGGDO.....',
  '......OLGGGGLLLHGGGGGGGGGGGLLLGGGGDO......',
  '.......OLGGGGGGGGGGGGGGGGGGGGGGGGDO.......',
  '........OLGGGGGGGGGGGGGGGGGGGGGDDO........',
  '.........OLDGGGGGGGGGGGGGGGGGGDOO.........',
  '..........OOLGGGGGGGGGGGGGGGGDO...........',
  '............OLEYYEEEEEEEEYYEDO............',
  '............OLEEWYYEEEEYYWEEDO............',
  '............OLEEEEEEHLEEEEEEDO............',
  '............OLGGGGGGHLGGGGGGDO............',
  '............OLGGGGGGLLGGGGGGDO............',
  '............OLGEEEEEEEEEEEEGDO............',
  '.....OOOOOOOOOLLELELELELELEDOOOOOOOOO.....',
  '....OLLLLLLLLOOLELELELELELEOOLLLLLLLLO....',
  '...OLGGHHGGGGLOOELELELELELOOLGGGGGHHGLO...',
  '..OLGGGGGGGGGGLLELELELELELELGGGGGGGGGGLO..',
  '..OLGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGDO..',
  '.OLGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGLO.',
  '.OLDDDDDDDDDDLLLLLLLLDLLLLLLLDDDDDDDDDDDO.',
  'OLDLLLLLLLLLLDGGGGGGLDGGGGGGDLLLLLLLLLLDLO',
  'OLLGGGGGGGGGGLDDDDDGLDGDDDDDLGGGGGGGGGGLDO',
  'OLGDDDDDDDDDDGGGGGGGLDGGGGGGGDDDDDDDDDDGDO',
  'OLDLLLLLLLLLLDGGGGGGLDGGGGGGDLLLLLLLLLLDDO',
  'OLLGGGGGGGGGGLGGGGGGLDGGGGGGLGGGGGGGGGGLDO',
  'OLGDDDDDDDDDDGGGGGGGGDGGGGGGGDDDDDDDDDDGDO',
  'OLDLLLLLLDLLLDLLLLLLEELLLLLLDLLLDLLLLLLDO.',
  '.OLGGGGGDOLGEEEEEEEEEEEEEEEEEEGDOLDDGGDO..',
  '.OLGGGGDOOLGGGGGGGGGEEGGGGGGGGGDOOOOLDO...',
  '.OLGGGGDOOLGGLLLLLLLEELLLLLLLGGDO...OO....',
  '.OLGGGGDO.OLGEEEEEEEEEEEEEEEEGDO..........',
  '.OLGGGGDO.OLGGGGGGGGEEGGGGGGGGDO..........',
  '.OLGGGGDO.OLGGLLLLLLEELLLLLLGGDO..........',
  '.ODDDDDDO..OLGEEEEEEEEEEEEEEGDO...........',
  '.OLHHHHHO..OLGGGGGGGEEGGGGGGGDO...........',
  '..OLGGGDO...OLGLLLLLEELLLLLGDO............',
  '..OLGGGGLO..OLGEEEEEEEEEEEEGDO............',
  '..OLGGGGDO..OLGGGGGGEEGGGGGGDO............',
  '..OLGGGGDO...OLDDDDDEEDDDDDDO.............',
  '..OLDDDDDO....OOOOOOOOOOOOOO..............',
  '...OOOOOO.................................',
  '..........................................',
];
const ESQUELETO = [
  '..........................................',
  '..........................................',
  '..........................................',
  '..........................................',
  '..........................................',
  '..........................................',
  '..........................................',
  '..................OOOOOO..................',
  '................OOLLLLLLOO................',
  '...............OLLLLLLLLLLO...............',
  '...............OLLLLLLLLLLO...............',
  '..............OLLLLLLLLLLLLO..............',
  '..............OLEEEELLEEEELO..............',
  '..............OLEYEELLEEYELO..............',
  '..............OLEEEELLEEEELO..............',
  '...............OLLLLLLLLLLO...............',
  '...............OLLLLEELLLLO...............',
  '...............OLLLLLLLLLLO...............',
  '...............OLLLLLLLLLLO...............',
  '...............OELELELELELO...............',
  '...............OLLLLLLLLLLO...............',
  '.........OOOOOOOOOOOLLOOOOOOOOOOO.........',
  '........OLLLLLLLLLLLLLLLLLLLLLLLLO........',
  '........OLLLLLLLLLLLLLLLLLLLLLLLLO........',
  '.......OLLOOOOOOOLLLLLLLLOOOOOOOO.........',
  '.......OLLO..OLLLOOOLLOOOLLLO.............',
  '......OLLO..OLOOOOOOLLOOOOOOLO............',
  '......OLLO...OOOLLLLLLLLLLOOO.............',
  '......OLLO..OLLLOOOOLLOOOOLLLO............',
  '.....OLLO..OLOOOOOOOLLOOOOOOOLO...........',
  '.....OLLO...OOOOLLLLLLLLLLOOOO............',
  '.....OLLO..OLLLLOOOOLLOOOOLLLLO...........',
  '....OLLO..OLOOOOOOOOLLOOOOOOOOLO..........',
  '....OLLO...O.OOOLLLLLLLLLLOOO.O...........',
  '.....OLLO...OLLLOOOOLLOOOOLLLO............',
  '......OLLO.OLOOO.OOOLLOOO.OOOLO...........',
  '.......OLLO.O.OOOLLLLLLLLOOO.O............',
  '........OLLO.OLLLOOOLLOOOLLLO.............',
  '........OLLOOLOOOOOOLLOOOOOOLO............',
  '.........OLLOO.OOLLLLLLLLOO.O.............',
  '..........OLLOOLLOOOLLOOOLLO..............',
  '..........OLLLLOO.OOLLOO.OOLO.............',
  '..........OLLLLOOOLLLLLLOO.O..............',
  '..........OLLLLOLLOOLLOOLLO...............',
  '...........OOOOLOO.OLLO.OOLO..............',
  '...............O...OLLO...O...............',
  '....................OO....................',
  '..........................................',
];
const GW = GUERREIRO[0].length, GH = GUERREIRO.length;
const COR_G = { O: '#2E1065', G: '#7C3AED', L: '#A78BFA', H: '#DDD6FE', D: '#5B21B6', E: '#3B0F86', Y: '#FEF9C3', W: '#FFFFFF', T: '#EDE9FE' };
const OMBRO = [33, 30], OLHOS_G = [[16, 14], [25, 14]];  // de onde sai o braço da espada e os olhos (pixels da textura)
const CHAMAS_G = [[0, 26], [2, 22], [4, 1], [6, 1], [8, 3], [10, 5], [12, 7], [14, 7], [16, 6], [18, 5], [20, 2], [22, 3], [24, 5], [26, 6], [28, 7], [30, 6], [32, 4], [34, 2], [36, 0], [38, 21], [40, 24]];  // o alto da armadura, de 2 em 2 colunas: de onde saem as chamas
const GUERREIROS = cache(2);
function guerreiro(osso = false) {
  const chave = osso ? 'o' : 'g', pronto = GUERREIROS.get(chave);
  if (pronto) return pronto;
  return GUERREIROS.set(chave, arte(osso ? ESQUELETO : GUERREIRO, COR_G));
}

// a raposa de nove caudas (a Kurama), de lado, virada pro bug, à espreita: o quadril atrás (a raiz
// das caudas), a corcova dos ombros, a cabeça grande e as orelhas compridas pra trás, o sorriso de
// dentes, a marca preta da orelha até o olho. Pixel a pixel, o contorno já vem junto (fonte:
// kurama3.py, no scratchpad da arte). Os outros quadros são remendos pintados por cima: 'ruge' (a
// mandíbula cai), 'arma' (a mão erguida no peito, garras abertas) e 'patada' (o braço esticado
// embaixo do focinho, rasgando); a textura é mais larga que o corpo por causa da patada.
const RAPOSA = [
  '...............................O....................................',
  '..............................OLO............O......................',
  '...............................OLO..........ODO.....................',
  '...............................OLLO.........ODDO....................',
  '...............................OLGLO........ODDO....................',
  '................................OKGLO......ODDDO....................',
  '................................OLKGLO.....ODKDO....................',
  '.................................OKKGLO....ODKKO....................',
  '.................................OKKKGLO..ODDKKDO...................',
  '.................................OLKKKGLO.ODDKKDO...................',
  '.............O....................OKKKKGLOODKKKDO...................',
  '............OLO.........OOOOOO....OKKKKKGEDDKKKDO...................',
  '............OLLOO.....OOLLLLLLOO...OKKKKGGEEEEDDDO..................',
  '.............OLLLO..OOLLLLGGGGLLOO.OKGGGGGGGGGEEDO..................',
  '......O......OLGGLOOLLLLLLLLGGGGLLOOLGGGGKKGGGGDEO..................',
  '.....OLOOO...OLGDDOLLLLLLLLLLGGGGGLOLGGGGGKKKGKKKKOOO...............',
  '......OLLLOOO.OLOLLGLLLLLLLLGGGGGGDEGGGGGGGGKKKKRRRKKOO.............',
  '.......OLGLLLOOLLGGGGGLLLLGGGGGGGGGEGGGGGGGGGGKKRRKRKLLOO...........',
  '........OLGDGLLGGGGGGGGGGGGGGGGGGGGEGGGGGGGGGGGGKKKKLLGLLO..........',
  '.OOO..OOOOLOLGGGGGGGGGGGGGGGGGGGGGEGGGGGGGGGGGGGGGGGGGGGDKO.........',
  'OLLLOOLLLLGLGGGGGGGGGGGGGGGGGGGGGEGGGGGGGGGGGGGGGGGGGGGGKKO.........',
  '.OLGLLLLLLLLGGGGGGGGGGGGGGGGGGGEEEGGGGGGKKGGGGGGGGGGGGGGDO..........',
  '..OLGLLLLLLLLGGGGGGGGGGEEEEGGGGGGGEGGGGGGKKTTTTTTTTTTKGDO...........',
  '...OLLLLLLLLLGGGGGGGGGGEGGGEEEEEGGGEGGGGGGGKMTMTMTMTMKKO............',
  '..OLGGLLLLLLGGGGGGGGGGGEGGGGGGGEGGEGGGGGGGGGKKKKKKKKKOO.............',
  '..OLGGGGGGGGGGGGGGGGGGGGEGGGGGGEEEEEEEGGGGGGGGDDDOOOO...............',
  '..OLGGGGGGGGGGGGGGGGGGGGEGGGGGGEEEHHHLEGGDDDDDOOO...................',
  '..OLGGGGGGGGGGGGDGGGGGGGEGGGGGGEGHHHHEEDDOOOOO......................',
  '..OLGGGGGGGGGGGGGDGGGGGGEGGGGGGEGHHHEELOO...........................',
  '..OLGGGGGGGGGGGGGGDGGGGGEGGGGGGEGHHEHHLLO...........................',
  '..OLGGGGGGGGGGGGGGDGGGGEGGGGGGGEGHHHHHLDOOO.........................',
  '..OLGGGGGGGGGGGGGGGDGGEGGGGGGGGGEHHHHHLEDDDO........................',
  '...OLGGGGGGGGGGGGGGDGEGGGGGGGGGGEHHHHHHEDDDO........................',
  '...OLGGGGGGGGGGGGGDGEEEEEGGGGGGGGEHHLGEDDDDDO.......................',
  '....OLGGGGGGGGGGGGGGGGGGGEEGGGGGGEGGLEDDDDDDO.......................',
  '.....OLDDGGGGGGGGGGDDDDDDDDEGGGGGGEGLDODDDDDO.......................',
  '......OOOLDGGGGGGGDOOOOOOOOOLGGGGGGEDOODDDDDDO......................',
  '.........OOLGGGGGGDO.......OLGGGGGGDO.ODDDDDDO......................',
  '.........ODDDDDDDDO.........OLGGGGGGLOODDDDDDO......................',
  '........ODDDDDDDDO...........OLGGGGGDO.ODDDDDDO.....................',
  '.......ODDDDDDDDO............OLGGGGGGLOODDDDDDO.....................',
  '......ODDDDDDDDO..............OLGGGGGGLODDDDDDO.....................',
  '.....ODDDDDDDDDOOO.............OLGGGGDOOODDDDDDO....................',
  '.....ODDDDDDDDDDDDOO...........OLGGGGGLLEDDDDDDDOO..................',
  '....ODDDDDDDDDDDDDDDO...........OLGGGGGGGEEDDDDDDDO.................',
  '....OEEEEEEEEEEEEEEEO...........OLDGGGGGGDDEDDDDDDO.................',
  '.....OOOOOOOOOOOOOOO.............OOLDDDDTOEDDDDDOO..................',
  '...................................OOOOOO.OOOOOO....................',
];
const QUADROS_R = {
  ruge: { x: 40, y: 20, linhas: [
    'KKGGGGGGGGGGGGGGKK',
    'GKTKTTTTTTTTTTKKDO',
    'GGKMMMMMMMMMMMMMKO',
    'GGKMMNNNNNNMMMMMKO',
    'GGKMMMMMMMMMMMMKO.',
    'GGGKTMTMTMTMTMKO..',
    'GDDDKGGGGGGGGKO...',
    'DOOOOKKKKKKKKO....',
    'O....OOOOOOOO.....',
  ] },
  arma: { x: 23, y: 25, linhas: [
    'EGGGGGGGEEEEEEEGGGGGGGGD',
    'EGGGGGGGEEEHHHLEGGDDEDDO',
    'EGGGGGGEGGHHHHEEEEOOTOO.',
    'GEGGGGGGEGHHHEEELLOTO...',
    'GEGGGGGGGEEEEEGGGGTO.OO.',
    'EGGGGGGGGGGGGGGGGGDOOTTO',
    'GGGGGGGGGGGGGGGGGGGETOO.',
    'GGGGGGGGGGGGGGGGGGEDO...',
    'EEEEGGGGGGGGGGGGGGEEDOO.',
    'GGGGEGGGGGEEEEEDEEDDETTO',
    'DDDDDEDDEELGGLDODDDDDOO.',
    'OOOOOOOOLDDDDDOODDDDDDO.',
    '........OOOOOO.ODDDDDDO.',
    '...............ODDDDDDO.',
    '................ODDDDDDO',
    '................ODDDDDDO',
    '................ODDDDDDO',
    '.................ODDDDDD',
    '.................ODDDDDD',
    '.................ODDDDDD',
    '.................ODDDDDD',
    '..................OODDDD',
    '....................OOOO',
  ] },
  patada: { x: 20, y: 21, linhas: [
    'GGGGGGGGGGGEEEGGGGGGKKGGGGGGGGGGGGGGDO....O.....',
    'GGGEEEEGGGGGGGEGGGGGGKKTTTTTTTTTTKGDO....OTO....',
    'GGGEGGGEEEEEEEGEGGGGGGGKMTMTMTMTMKKO....OTO.OO..',
    'GGGEGGGGGGGGGGEGGGGGGGGGKKKKKKKKKOOOOOOOTO.OTTO.',
    'GGGEGGGGGGGGEEEEEEGGGGGGGGEEEOOOOOOLLLLLLOOTOO..',
    'GGGEGGGGGGGEEEGGGGEGGEEEEELLLLLLLLLGGGGGDOTO....',
    'GGGGEGGGGGGGGGGGGEEEEGGGGGGGGGGGGGGGGGGGGLO.OOO.',
    'GGGGEGGGGGGGGGGGEEGGGGGGGGGGGGGGGGGGGGGGGDOOTTTO',
    'GGGGEGGGGGGGGGGEGGGGGGGGGGGGGGGGGGGGGGGGGDTTOOO.',
    'GGGGEGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGDOOO....',
    'GGGGEEEGGGGGGGGGGGGGGGGGGGGGGGGDDDDDDDDDDO......',
    'GGGGGGGEEEEEEEEEGGGGEEEEDDDDDDDOOOOOOOOOO.......',
    'GGGGGGGGGGGGGHHHEGEEDDDDOOOOOOO.................',
    'GGGGGGGGGDDGGLGEGEDDDDDDO.......................',
    'DDDDDDDDDOOLGLGEEDODDDDDO.......................',
    'OOOOOOOOO.OLDDEDDOODDDDDDO......................',
    '...........OOOOOO.ODDDDDDO......................',
    '..................ODDDDDDO......................',
    '...................ODDDDDDO.....................',
    '...................ODDDDDDO.....................',
    '...................ODDDDDDO.....................',
    '....................ODDDDDDO....................',
    '....................ODDDDDDDOO..................',
    'O...................ODDDDDDDDDO.................',
    'O...................ODDDDDDDDDO.................',
    '.....................OODDDDDOO..................',
    '.......................OOOOO....................',
  ] },
};
const RW = RAPOSA[0].length, RH = RAPOSA.length;
const COR_R = { O: '#2A0C04', G: '#F06A1D', L: '#FF9445', H: '#FFC27A', D: '#B9440F', E: '#7C2709', K: '#150605', R: '#E11D2A', Y: '#FFE680', T: '#FFF4E0', M: '#3D0A0A', N: '#B91C3C' };
// (pixels da textura) a raiz das caudas, a boca, a mão da patada e a ponta do focinho
const ANCA = [8, 23], BOCA_R = [55, 22], MAO_R = [58.5, 28.5], FOCINHO_R = 58;
const RAPOSAS = cache(4);
function raposa(quadro = 'f') {
  const pronto = RAPOSAS.get(quadro);
  if (pronto) return pronto;
  const linhas = RAPOSA.slice(), r = QUADROS_R[quadro];
  if (r) r.linhas.forEach((l, i) => { const y = r.y + i; linhas[y] = linhas[y].slice(0, r.x) + l + linhas[y].slice(r.x + l.length); });
  return RAPOSAS.set(quadro, arte(linhas, COR_R));
}
// uma cauda de raposa: fina na raiz, gorda no meio, pontuda na ponta; a sombra embaixo e a luz em
// cima. Da raiz (x, y) no ângulo a0 (radianos, Y- pra cima), comprimento L, grossura máxima R
function caudaDeRaposa(g, x, y, a0, L, R, onda, k) {
  if (L <= k) return;
  const n = Math.max(3, Math.ceil(L / k)), q = v => Math.round(v / k) * k, pts = [];
  for (let j = 0; j <= n; j++) {
    const s = j / n, a = a0 + onda(s);
    pts.push([q(x), q(y), R * Math.sin(Math.PI * (0.14 + 0.86 * s)) ** 0.7]);
    x += Math.cos(a) * L / n; y += Math.sin(a) * L / n;
  }
  const camada = (cor, d, mais, f) => {
    g.fillStyle = cor;
    for (const [px, py, r] of pts) { const rr = Math.max(k, q(r * f)) + mais; g.fillRect(px - rr + d, py - rr + d, rr * 2, rr * 2); }
  };
  camada(COR_R.O, 0, k, 1);  // laranja como o corpo (de lado, nada da cara fica na frente delas)
  camada(COR_R.D, 0, 0, 1);
  camada(COR_R.G, -k, 0, 0.8);
  camada(COR_R.L, -2 * k, 0, 0.35);
}

// uma cauda grossa, em blocos do pixel do gigante: da raiz (x, y) no ângulo a0 (radianos, Y- pra
// cima), comprimento L, grossura de r0 a r1, ondulando; cores { O contorno, G, L luz, P ponta }
function cauda(g, x, y, a0, L, r0, r1, onda, k, C) {
  if (L <= k) return;
  const n = Math.max(2, Math.ceil(L / k)), q = v => Math.round(v / k) * k, pts = [];
  for (let j = 0; j <= n; j++) {
    const s = j / n, a = a0 + onda(s);
    pts.push([x, y, r0 + (r1 - r0) * s, s]);
    x += Math.cos(a) * L / n; y += Math.sin(a) * L / n;
  }
  for (const [cor, mais] of [[C.O, k], [C.G, 0]]) {
    g.fillStyle = cor;
    for (const [px, py, r] of pts) { const rr = Math.max(k, q(r)) + mais; g.fillRect(q(px) - rr, q(py) - rr, rr * 2, rr * 2); }
  }
  if (C.P) {
    g.fillStyle = C.P;
    for (const [px, py, r, s] of pts) if (s > 0.8) { const rr = Math.max(k, q(r)); g.fillRect(q(px) - rr, q(py) - rr, rr * 2, rr * 2); }
  }
  g.fillStyle = C.L;
  for (let j = 2; j < pts.length * 0.75; j += 2) { const [px, py, r] = pts[j], rr = Math.max(k, q(r)); g.fillRect(q(px) - rr + k, q(py) - rr + k, k, k); }
}

// ---------- o palco ----------
function montar(m) {
  const c = m.host.cartao || [98, 260, 248, 146], casa = m.pose();
  const cw = c[2], HJ = Math.round(lim(c[1] - 14, 112, 184)), X0 = casa.x - c[0];
  const k = HJ >= 150 && cw >= 230 ? 3 : 2;
  const BP = k * 2 + 1, BW = 13 * BP, BH = 8 * BP;  // o bug gigante: o do tema, 2k+1 por pixel
  const J = { cw, HJ, X0, k, BP, BW, BH };
  const roupa = A.ROUPAS.ROUPAS[m.salvo.akaRoupa] ? m.salvo.akaRoupa : A.COR.roupa;
  J.eu = TRIO.includes(roupa) ? roupa : MESTRE;  // de colete ele é o mestre
  const s = 28, mestre = J.eu === MESTRE;
  J.meio = Math.round(lim(X0, (mestre ? 2 : 1) * s + 14, cw * 0.42));
  J.lugar = { 't7-azul': J.meio - s, 't7-laranja': J.meio, 't7-rosa': J.meio + s };
  if (mestre) J.lugar[MESTRE] = J.meio - 2 * s;
  J.ajudantes = TRIO.filter(r => r !== J.eu);
  J.bugX = cw - 4 - BW / 2;
  J.GW = GW * k; J.GH = GH * k; J.RW = RW * k; J.RH = RH * k;
  J.gX = Math.round(lim(J.lugar['t7-azul'] - J.GW * 0.32, -J.GW * 0.2, cw - J.GW));  // a esquerda do guerreiro
  // a esquerda da raposa: a ponta do focinho encosta nas costas do bug; o quadril dela pode sair pela
  // esquerda do palco (ela não cabe inteira: é gigante)
  J.rX = Math.round(Math.min(2, J.bugX - BW / 2 + 6 - FOCINHO_R * k));
  J.rY = -5;                                                                      // os pés dela, na grama
  J.pouso = Math.round(J.bugX - BW / 2 - 8);  // onde a de rosa cai socando o chão
  return J;
}

const CEUS = cache(4);
function ceu(J) {  // a tarde: o azul descendo pro dourado, o sol baixo, as nuvens, a fileira de árvores
  const chave = J.cw + 'x' + J.HJ, pronto = CEUS.get(chave);
  if (pronto) return pronto;
  const c = tela(J.cw, J.HJ), k = c.getContext('2d');
  const faixas = ['#1E3A5F', '#2B4F7A', '#3F6A94', '#6F87A8', '#C99A7B', '#EDB27A', '#F6C177'];
  faixas.forEach((cor, i) => { k.fillStyle = cor; k.fillRect(0, Math.floor(J.HJ * i / faixas.length), J.cw, Math.ceil(J.HJ / faixas.length) + 1); });
  const R = Math.round(J.HJ * 0.12), sx = Math.round(J.cw * 0.8), sy = Math.round(J.HJ * 0.7);
  const gr = k.createRadialGradient(sx, sy, R * 0.8, sx, sy, R * 3);
  gr.addColorStop(0, rgba('#FDE68A', 0.55)); gr.addColorStop(1, rgba('#FDE68A', 0));
  k.fillStyle = gr; k.fillRect(sx - R * 3, sy - R * 3, R * 6, R * 6);
  k.fillStyle = '#FEF3C7'; k.beginPath(); k.arc(sx, sy, R, 0, Math.PI * 2); k.fill();
  const r = rng(J.cw * 71 + J.HJ);
  k.fillStyle = rgba('#FDE7C7', 0.45);
  for (let i = 0; i < 6; i++) { const w = 20 + r() * 40; k.fillRect(Math.floor(r() * J.cw), Math.floor(J.HJ * (0.2 + 0.45 * r())), w, 2); }
  k.fillStyle = '#1F3B2A';  // as árvores
  for (let x = -6; x < J.cw + 14; x += 12 + Math.floor(r() * 8)) { k.beginPath(); k.ellipse(x, J.HJ - 6, 9 + r() * 6, 16 + r() * 18, 0, 0, Math.PI * 2); k.fill(); }
  k.fillStyle = '#17301F';
  for (let x = 4; x < J.cw + 14; x += 16 + Math.floor(r() * 10)) { k.beginPath(); k.ellipse(x, J.HJ - 2, 8 + r() * 5, 10 + r() * 10, 0, 0, Math.PI * 2); k.fill(); }
  return CEUS.set(chave, c);
}
// o chão na frente dos gigantes: a terra e a linha de grama
function chao(g, J) {
  g.fillStyle = '#3B2A1A'; g.fillRect(0, -7, J.cw, 7);
  g.fillStyle = '#4D7C0F'; g.fillRect(0, -8, J.cw, 2);
  g.fillStyle = '#65A30D';
  for (let x = 3; x < J.cw; x += 7) g.fillRect(x, -10 + (x % 3 === 0 ? 0 : 1), 1, 2);
}

// a aura: chamas subindo em volta de alguém (no referencial do Clawd: x = o meio dele, pés em 0)
function aura(g, x, cor, t, forca, alto = 24) {
  if (!(forca > 0.005)) return;  // (o seno no fim da janela dá 1e-16, não 0)
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 9; i++) {
    const px = x + (i - 4) * 3.2, h = alto * forca * (0.55 + 0.45 * Math.abs(Math.sin(t * 9 + i * 1.7))) * (1 - Math.abs(i - 4) / 6);
    g.fillStyle = rgba(cor, 0.45 * forca); g.fillRect(px - 1.5, -h, 3, h);
    g.fillStyle = rgba('#FFFFFF', 0.22 * forca); g.fillRect(px - 0.5, -h * 0.6, 1, h * 0.6);
  }
  for (let i = 0; i < 6; i++) {  // as faíscas
    const v = (t * 1.3 + i / 6) % 1;
    g.fillStyle = rgba(cor, (1 - v) * forca); g.fillRect(x + Math.sin(i * 2.3 + t * 3) * 10, -6 - v * alto * 1.3, 1.5, 1.5);
  }
  g.restore();
}

// o guerreiro em t: quanto já apareceu (de baixo pra cima), a opacidade, o ângulo da espada
const RAD = Math.PI / 180;
function guerreiroEm(t) {
  const surge = sai(fatia(t, T.guerreiro[0], T.guerreiro[1])), some = fatia(t, T.someGuerreiro[0], T.someGuerreiro[1]);
  const c = fatia(t, T.corte[0], T.corte[1]);
  return { surge, alfa: 0.82 * Math.min(1, surge * 1.5) * (1 - some), espada: (-80 + 110 * sai(c)) * RAD, cortando: c > 0 && c < 1, antes: (-80 + 110 * sai(fatia(t - 0.06, T.corte[0], T.corte[1]))) * RAD };
}
function desenhaGuerreiro(g, J, t) {
  const G = guerreiroEm(t);
  if (G.alfa <= 0.01) return;
  const k = J.k, base = 0, topo = base - J.GH;
  const sobe = sai(Math.min(1, G.surge / 0.55)), veste = sai(fatia(G.surge, 0.4, 1));  // o esqueleto sobe; a armadura vem por cima
  g.save();
  g.beginPath(); g.rect(J.gX - 60, base - J.GH * sobe - 4, J.GW + 200, J.GH * sobe + 6); g.clip();  // aparece de baixo pra cima
  g.globalAlpha *= G.alfa;
  // o brilho em volta, pulsando
  g.save(); g.globalCompositeOperation = 'lighter';
  const mx = J.gX + J.GW / 2, my = base - J.GH * 0.5, R = J.GW * (0.8 + 0.04 * Math.sin(t * 6));
  const gr = g.createRadialGradient(mx, my, R * 0.25, mx, my, R);
  gr.addColorStop(0, rgba('#A855F7', 0.4)); gr.addColorStop(1, rgba('#A855F7', 0));
  g.fillStyle = gr; g.fillRect(mx - R, my - R, R * 2, R * 2);
  g.restore();
  if (veste < 1) { g.save(); g.globalAlpha *= 1 - 0.55 * veste; g.drawImage(guerreiro(true), J.gX, topo, J.GW, J.GH); g.restore(); }  // o esqueleto (aparece por dentro da armadura)
  if (veste <= 0) { g.restore(); return; }
  g.globalAlpha *= veste;
  g.drawImage(guerreiro(), J.gX, topo, J.GW, J.GH);
  // as chamas roxas no alto da armadura, tremulando, e as fagulhas subindo
  g.save(); g.globalCompositeOperation = 'lighter';
  CHAMAS_G.forEach(([x, y], i) => {
    const px = J.gX + x * k, py = topo + y * k, h = Math.round(k * (1 + 3.5 * Math.abs(Math.sin(t * 6 + i * 1.3)) * (0.5 + 0.5 * Math.sin(i * 2.7))) / k) * k;
    g.fillStyle = rgba('#9333EA', 0.6); g.fillRect(px - k / 2, py - h, k * 2, h);
    g.fillStyle = rgba('#C084FC', 0.45); g.fillRect(px, py - h - k, k, h);
  });
  for (let i = 0; i < 10; i++) {
    const v = (t * 1.1 + i / 10) % 1, [x, y] = CHAMAS_G[(i * 7) % CHAMAS_G.length];
    g.fillStyle = rgba('#C084FC', 0.8 * (1 - v)); g.fillRect(J.gX + x * k + Math.sin(t * 4 + i) * k, topo + y * k - k * 3 - v * k * 14, k, k);
  }
  // os olhos acesos
  for (const [x, y] of OLHOS_G) {
    const ex = J.gX + x * k, ey = topo + y * k, r = k * (3.2 + 0.4 * Math.sin(t * 9));
    const go = g.createRadialGradient(ex, ey, 0, ex, ey, r);
    go.addColorStop(0, rgba('#FEF9C3', 0.7)); go.addColorStop(1, rgba('#FDE68A', 0));
    g.fillStyle = go; g.fillRect(ex - r, ey - r, r * 2, r * 2);
  }
  g.restore();
  // o braço e a espada (uma reta só: o braço estendido e a lâmina)
  const ox = J.gX + OMBRO[0] * k, oy = topo + OMBRO[1] * k, braco = 11 * k, lamina = 34 * k;
  cauda(g, ox, oy, G.espada, braco, 2.4 * k, 2 * k, () => 0, k, { O: COR_G.O, G: COR_G.G, L: COR_G.L });
  const hx = ox + Math.cos(G.espada) * braco, hy = oy + Math.sin(G.espada) * braco;
  const ca = Math.cos(G.espada), sa = Math.sin(G.espada), w = 1.9 * k;
  if (G.cortando) {  // o rastro do corte: um leque de luz entre o ângulo de antes e o de agora
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba('#C4B5FD', 0.3);
    g.beginPath();
    for (let i = 0; i <= 8; i++) { const a = G.antes + (G.espada - G.antes) * i / 8; g.lineTo(ox + Math.cos(a) * (braco + lamina), oy + Math.sin(a) * (braco + lamina)); }
    for (let i = 8; i >= 0; i--) { const a = G.antes + (G.espada - G.antes) * i / 8; g.lineTo(ox + Math.cos(a) * (braco + lamina * 0.55), oy + Math.sin(a) * (braco + lamina * 0.55)); }
    g.closePath(); g.fill(); g.restore();
  }
  g.fillStyle = COR_G.O;  // a lâmina: contorno, corpo claro, fio branco; a guarda atravessada
  g.beginPath(); g.moveTo(hx - sa * (w + 1), hy + ca * (w + 1)); g.lineTo(hx + ca * (lamina + 2), hy + sa * (lamina + 2)); g.lineTo(hx + sa * (w + 1), hy - ca * (w + 1)); g.closePath(); g.fill();
  g.fillStyle = '#DDD6FE';
  g.beginPath(); g.moveTo(hx - sa * w, hy + ca * w); g.lineTo(hx + ca * lamina, hy + sa * lamina); g.lineTo(hx + sa * w, hy - ca * w); g.closePath(); g.fill();
  g.fillStyle = '#FFFFFF';
  g.beginPath(); g.moveTo(hx - sa * 0.5, hy + ca * 0.5); g.lineTo(hx + ca * (lamina - 3), hy + sa * (lamina - 3)); g.lineTo(hx + sa * 0.5, hy - ca * 0.5); g.closePath(); g.fill();
  g.fillStyle = COR_G.D;
  g.beginPath(); g.moveTo(hx - sa * 3 * k, hy + ca * 3 * k); g.lineTo(hx - sa * 3 * k + ca * k, hy + ca * 3 * k + sa * k); g.lineTo(hx + sa * 3 * k + ca * k, hy - ca * 3 * k + sa * k); g.lineTo(hx + sa * 3 * k, hy - ca * 3 * k); g.closePath(); g.fill();
  g.globalCompositeOperation = 'lighter';  // a chama roxa correndo pela lâmina
  for (let j = 0; j < 7; j++) {
    const d = lamina * (0.12 + j * 0.13), f = Math.sin(t * 13 + j * 2.1), lx = hx + ca * d - sa * f * k, ly = hy + sa * d + ca * f * k;
    g.fillStyle = rgba(j % 2 ? '#C084FC' : '#F0ABFC', 0.5); g.fillRect(lx - k, ly - k, k * 2, k * 2);
  }
  g.restore();
}

// a raposa em t: aparece (das chamas), ruge, arma a patada (recua um pouco), dá o bote (pra frente,
// o braço esticado), volta pro lugar e some
function raposaEm(J, t) {
  const surge = fatia(t, T.raposa[0], T.raposa[1]), some = fatia(t, T.someRaposa[0], T.someRaposa[1]);
  const recua = sai(fatia(t, T.arma[0], T.arma[1])), bote = sai(fatia(t, T.bote[0], T.bote[1]));
  const dx = (t < T.bote[0] ? -4 * recua : -4 + 18 * bote) * (1 - entra(fatia(t, T.voltaRaposa[0], T.voltaRaposa[1])));
  const quadro = t >= T.ruge[0] && t < T.ruge[1] ? 'ruge'
    : t >= T.arma[0] && t < T.bote[0] + 0.05 ? 'arma'
      : t >= T.bote[0] + 0.05 && t < T.voltaRaposa[0] + 0.1 ? 'patada' : 'f';
  return { surge, alfa: Math.min(1, surge * 1.4) * (1 - some), x: J.rX + Math.round(dx), quadro };
}
function desenhaRaposa(g, J, t) {
  const R = raposaEm(J, t);
  if (R.alfa <= 0.01) return;
  const k = J.k, topo = J.rY - J.RH;
  g.save(); g.globalAlpha *= R.alfa;
  // as nove caudas, em leque do quadril pra trás e pra cima, por trás das costas
  const [ax, ay] = [R.x + ANCA[0] * k, topo + ANCA[1] * k];
  for (const i of [0, 8, 1, 7, 2, 6, 3, 5, 4]) {
    const L = J.HJ * (0.6 + 0.05 * ((i * 5) % 3)) * sai(fatia(t, T.raposa[0] + i * 0.05, T.raposa[1])), a0 = (195 + 105 * i / 8) * RAD;
    const abre = Math.sign(i - 4) * 0.7;  // as pontas abrem pra fora do leque
    caudaDeRaposa(g, ax, ay, a0, L, 4 * k, s => abre * s * s + 0.4 * s * Math.sin(t * 2.6 + i * 1.7 + s * 4), k);
  }
  g.drawImage(raposa(R.quadro), R.x, topo, J.RW, J.RH);
  g.restore();
  // o chakra na mão, armando e na patada
  if (R.quadro === 'arma' || R.quadro === 'patada') {
    const [mx, my] = R.quadro === 'patada' ? [R.x + MAO_R[0] * k, topo + MAO_R[1] * k] : [R.x + 40 * k, topo + 31 * k];
    g.save(); g.globalCompositeOperation = 'lighter';
    const r = k * (6 + Math.sin(t * 40)), gr = g.createRadialGradient(mx, my, 0, mx, my, r);
    gr.addColorStop(0, rgba('#FFF7ED', 0.7)); gr.addColorStop(0.5, rgba('#F97316', 0.45)); gr.addColorStop(1, rgba('#F97316', 0));
    g.fillStyle = gr; g.fillRect(mx - r, my - r, r * 2, r * 2);
    g.restore();
  }
  // a chama em volta enquanto aparece
  if (R.surge > 0 && R.surge < 1) {
    g.save(); g.globalCompositeOperation = 'lighter';
    // (no meio do corpo: a textura é mais larga por causa da patada)
    const mx = R.x + J.RW * 0.42, my = J.rY - J.RH * 0.45, r = J.RW * 0.55 * (0.6 + 0.4 * R.surge), a = Math.sin(Math.PI * R.surge);
    const gr = g.createRadialGradient(mx, my, 0, mx, my, r);
    gr.addColorStop(0, rgba('#FDBA74', 0.8 * a)); gr.addColorStop(0.6, rgba('#F97316', 0.45 * a)); gr.addColorStop(1, rgba('#F97316', 0));
    g.fillStyle = gr; g.fillRect(mx - r, my - r, r * 2, r * 2);
    g.restore();
  }
  // o rugido: ondas saindo da boca
  const [bx, by] = [R.x + BOCA_R[0] * k, topo + BOCA_R[1] * k];
  for (let j = 0; j < 3; j++) {
    const u = fatia(t, T.ruge[0] + j * 0.14, T.ruge[0] + j * 0.14 + 0.45);
    if (u <= 0 || u >= 1) continue;
    const r = k * 4 + u * J.cw * 0.3;
    g.save(); g.globalCompositeOperation = 'lighter';
    g.strokeStyle = rgba('#FDBA74', 0.6 * (1 - u)); g.lineWidth = 2;
    g.beginPath(); g.arc(bx, by, r, -Math.PI * 0.35, Math.PI * 0.35); g.stroke();
    g.restore();
  }
}

// o bug gigante: entra, se empina, apanha do corte (recua e volta), voa pro alto e cai, e o soco
// manda ele pro céu (gira e encolhe até virar estrelinha)
function bugEm(J, t) {
  let x = J.bugX, y = 0, giro = 0, esc = 1, sy = 1;
  if (t < T.bug[1]) x = J.bugX + (J.cw + J.BW / 2 + 4 - J.bugX) * (1 - sai(fatia(t, T.bug[0], T.bug[1])));
  x += 10 * sai(fatia(t, T.recua[0], T.recua[1])) * (1 - sai(fatia(t, T.volta[0], T.volta[1])));
  if (t >= T.empina[0] && t < T.empina[1]) sy = 1 + 0.12 * Math.sin(Math.PI * fatia(t, T.empina[0], T.empina[1]));
  if (t >= T.joga && t < T.cai[1]) { const u = fatia(t, T.cai[0], T.cai[1]); y = -J.HJ * 0.55 * 4 * u * (1 - u); giro = 720 * u; }
  if (t >= T.voa[0]) { const u = fatia(t, T.voa[0], T.voa[1]); x = J.bugX + (J.cw - 16 - J.bugX) * sai(u); y = (-J.HJ + 22) * sai(u); giro = 900 * u; esc = 1 - 0.85 * u; }
  return { x, y, giro, esc, sy, visivel: t >= T.bug[0] && t < T.voa[1], anda: (t >= T.bug[0] && t < T.bug[1]) || (t >= T.volta[0] && t < T.volta[1]) };
}
function desenhaBug(g, J, t) {
  const b = bugEm(J, t);
  if (!b.visivel) return;
  const f = J.BP / 1.6 * b.esc, apanha = Math.max(...[T.acerta, T.joga, T.soco].map(t0 => (t >= t0 && t < t0 + 0.4 ? 1 - (t - t0) / 0.4 : 0)));
  g.save(); g.translate(b.x, b.y - J.BH / 2 * b.esc); g.rotate(b.giro * RAD); g.scale(f, f * b.sy);
  A.bug(g, 0, A.BUG_H / 2, { passo: b.anda && Math.floor(t / 0.1) % 2 ? 'q' : 'p', a: apanha });
  g.restore();
}

// as três garras de chakra da patada: luas finas e curvas, de baixo à esquerda pra cima à direita,
// cruzando o bug, lado a lado; crescem rápido (até u = 0,25) e somem devagar. Por fora o laranja,
// por dentro o creme
function garras(g, J, u) {
  const cresce = sai(Math.min(1, u / 0.25)), a = u < 0.3 ? 1 : 1 - (u - 0.3) / 0.7;
  const cx = J.bugX - J.BW * 0.05, cy = -J.BH * 0.95, L = J.BW * 0.5, ang = -0.8;
  const [ux, uy] = [Math.cos(ang), Math.sin(ang)], [nx, ny] = [-uy, ux], curva = -J.k * 4, n = 12;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = -1; i <= 1; i++) {
    const ox = cx + nx * i * J.k * 6 - ux * L, oy = cy + ny * i * J.k * 6 - uy * L;  // o começo de cada uma
    for (const [cor, larg, alfa] of [['#F97316', 2.6, 0.5], ['#FDBA74', 1.5, 0.75], ['#FFF7ED', 0.6, 1]]) {
      const cima = [], baixo = [];
      for (let s = 0; s <= n; s++) {
        const v = cresce * s / n, b = Math.sin(Math.PI * v), h = J.k * larg * b;
        const px = ox + ux * 2 * L * v + nx * curva * b, py = oy + uy * 2 * L * v + ny * curva * b;
        cima.push([px + nx * h, py + ny * h]); baixo.push([px - nx * h, py - ny * h]);
      }
      g.fillStyle = rgba(cor, alfa * a);
      g.beginPath(); g.moveTo(cima[0][0], cima[0][1]);
      for (const [x, y] of cima.slice(1).concat(baixo.reverse())) g.lineTo(x, y);
      g.closePath(); g.fill();
    }
  }
  g.restore();
}

// os clarões dos golpes, as rachaduras, as pedras e a estrelinha
function golpes(g, J, t) {
  const brilho = (x, y, R, a, cores) => {
    if (a <= 0 || R <= 1) return;
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(x, y, 0, x, y, R);
    gr.addColorStop(0, rgba(cores[0], 0.9 * a)); gr.addColorStop(0.4, rgba(cores[1], 0.6 * a)); gr.addColorStop(1, rgba(cores[1], 0));
    g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2);
    g.restore();
  };
  const by = -J.BH / 2;
  // o corte: um X de luz em cima do bug
  const c = fatia(t, T.acerta, T.acerta + 0.35);
  if (c > 0 && c < 1) {
    brilho(J.bugX, by, J.BW * 0.7, 1 - c, ['#FFFFFF', '#A855F7']);
    g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba('#F5F3FF', 1 - c); g.lineWidth = 2;
    const L = J.BW * 0.5 * sai(Math.min(1, c * 3));
    g.beginPath(); g.moveTo(J.bugX - L, by - L * 0.6); g.lineTo(J.bugX + L, by + L * 0.6); g.stroke();
    g.beginPath(); g.moveTo(J.bugX - L, by + L * 0.6); g.lineTo(J.bugX + L, by - L * 0.6); g.stroke();
    g.restore();
  }
  // a patada da raposa: um estouro laranja e as três garras de chakra
  const j = fatia(t, T.joga, T.joga + 0.35);
  if (j > 0 && j < 1) brilho(J.bugX - J.BW * 0.15, by, J.BW * 0.8, 1 - j, ['#FFF7ED', '#F97316']);
  const r = fatia(t, T.garras[0], T.garras[1]);
  if (r > 0 && r < 1) garras(g, J, r);
  // o soco no chão
  const s = fatia(t, T.soco, T.soco + 0.5), px = J.pouso + 8;
  if (s > 0 && s < 1) {
    brilho(px, -3, J.HJ * 0.4 * sai(s), 1 - s, ['#FFFFFF', '#F472B6']);
    g.save(); g.globalCompositeOperation = 'lighter'; g.strokeStyle = rgba('#FBCFE8', 0.9 * (1 - s)); g.lineWidth = 3;
    const rx = 8 + J.cw * 0.5 * sai(s);
    g.beginPath(); g.ellipse(px, -4, rx, rx * 0.15, 0, 0, Math.PI * 2); g.stroke();
    g.restore();
  }
  // as rachaduras: correm pelo chão pros dois lados e ficam até o palco fechar
  if (t >= T.soco) {
    const u = sai(fatia(t, T.rachas[0], T.rachas[1])), r = rng(J.sem ^ 0x2545f491);
    g.strokeStyle = '#1C1208'; g.lineWidth = 1.5;
    for (let i = 0; i < 4; i++) {
      const lado = i % 2 ? 1 : -1, alcance = J.cw * (0.18 + 0.2 * r()) * u;
      let x = px, y = -4;
      g.beginPath(); g.moveTo(x, y);
      for (let d = 0; d < alcance; d += 4 + r() * 4) { x = px + lado * d; y = lim(y + (r() - 0.5) * 3, -7, -1); g.lineTo(x, y); }
      g.stroke();
    }
    // as pedras voando
    const d = t - T.soco;
    if (d < 1) {
      for (let i = 0; i < 16; i++) {
        const ang = -Math.PI * (0.15 + 0.7 * r()), vel = 35 + r() * 55, tam = r() < 0.4 ? J.k + 1 : J.k;
        const qx = px + (r() - 0.5) * 12 + Math.cos(ang) * vel * d, qy = Math.min(-2, -4 + Math.sin(ang) * vel * d + 90 * d * d);
        g.fillStyle = rgba(i % 3 ? '#78716C' : '#A8A29E', 1 - fatia(d, 0.6, 1)); g.fillRect(qx, qy, tam, tam);
      }
    }
  }
  // a estrelinha onde o bug sumiu
  const e = fatia(t, T.estrela[0], T.estrela[1]);
  if (e > 0 && e < 1) {
    const ex = J.cw - 16, ey = -J.HJ + 22, R = 7 * Math.sin(Math.PI * e);
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = rgba('#FEF9C3', 0.95); g.fillRect(ex - R, ey - 0.75, R * 2, 1.5); g.fillRect(ex - 0.75, ey - R, 1.5, R * 2);
    g.fillStyle = rgba('#FFFFFF', 1); g.fillRect(ex - 1, ey - 1, 2, 2);
    g.restore();
  }
}

// as folhas atravessando o palco devagar
function folhas(g, J, t) {
  const r = rng(J.cw * 13 + 7);
  for (let i = 0; i < 9; i++) {
    const v = r() * 0.4 + 0.25, f0 = r(), y0 = -J.HJ * (0.25 + 0.6 * r()), u = (f0 + t * v * 0.12) % 1;
    T7.folhinha(g, -8 + (J.cw + 16) * u, y0 + Math.sin(t * 1.5 + i) * 6 + u * 20, t * 2 + i, T7.FOLHAS[i % T7.FOLHAS.length]);
  }
}

function desenhar(g, t, m, J) {
  const e = m.host.escala || 1, c = m.host.cartao;
  if (!c) return null;
  const OX = c[0], OY = c[1];
  const ab = t < T.fecha[0] ? sai(fatia(t, T.abre[0], T.abre[1])) : 1 - entra(fatia(t, T.fecha[0], T.fecha[1]));
  if (ab <= 0) return null;
  const topo = Math.round(-J.HJ * ab * e) / e, tr = tremor(t);
  const sx = Math.round(Math.sin(t * 93) * 2.5 * tr) / 2, sy = Math.round(Math.cos(t * 71) * 2 * tr) / 2;
  g.save();
  g.setTransform(e, 0, 0, e, OX * e, OY * e);
  g.beginPath(); g.rect(0, topo, J.cw, -topo); g.clip();
  g.drawImage(ceu(J), 0, -J.HJ, J.cw, J.HJ);
  folhas(g, J, t);
  g.translate(sx, sy);
  desenhaGuerreiro(g, J, t);
  desenhaRaposa(g, J, t);
  chao(g, J);
  desenhaBug(g, J, t);
  golpes(g, J, t);
  g.restore();
  // a moldura do palco: azul, com a borda de cima laranja enquanto abre e fecha
  g.save(); g.setTransform(e, 0, 0, e, OX * e, OY * e);
  g.fillStyle = '#1E3A8A';
  g.fillRect(0, topo, 1, -topo); g.fillRect(J.cw - 1, topo, 1, -topo);
  g.fillStyle = t < T.abre[1] || t >= T.fecha[0] ? '#FDBA74' : '#F97316'; g.fillRect(0, topo, J.cw, 1);
  g.restore();
  return { topo, sx, sy };
}

// ---------- os três (e o mestre) ----------
// onde cada um está em t, no palco: x, y (pulo), sy (agachado), selo, punho erguido, a mão no chão
function pose(J, r, t) {
  const p = { x: J.lugar[r], y: 0, sy: 1, selo: null, punho: false, mao: null, visivel: true };
  if (r === J.eu) {
    const ida = fatia(t, T.vai[0], T.vai[1]), volta = fatia(t, T.fica[0], T.fica[1]);
    if (t < T.vai[1]) { p.x = J.X0 + (J.lugar[r] - J.X0) * ida; p.y = -6 * Math.sin(Math.PI * ida); }
    else if (t >= T.fica[1]) p.x = J.X0;  // de volta, certinho no lugar dele
    else if (t >= T.fica[0]) { p.x = J.lugar[r] + (J.X0 - J.lugar[r]) * volta; p.y = -6 * Math.sin(Math.PI * volta); }
  } else {
    const i = J.ajudantes.indexOf(r);
    p.visivel = t >= T.chega[i] + 0.12 && t < T.saem[i] + 0.12;
  }
  const seloDe = ([a, b]) => (t >= a && t < b ? (t < a + 0.6 ? Math.floor(t / 0.09) : 3) : null);
  if (r === 't7-azul') p.selo = seloDe([T.auraAzul[0], T.guerreiro[1]]);
  if (r === 't7-laranja') p.selo = seloDe([T.auraLaranja[0], T.raposa[1]]);
  if (r === 't7-rosa') {
    if (t >= T.agacha[0] && t < T.salto[0]) p.sy = 1 - 0.15 * sai(fatia(t, T.agacha[0], T.agacha[1]));
    if (t >= T.salto[0] && t < T.soco) {
      const u = fatia(t, T.salto[0], T.salto[1]);
      p.x = J.lugar[r] + (J.pouso - J.lugar[r]) * u; p.y = -J.HJ * 0.42 * 4 * u * (1 - u);
      p.mao = [9, -4];  // o punho na frente, descendo
    }
    if (t >= T.soco && t < T.volta2[0]) { p.x = J.pouso; p.sy = t < T.soco + 0.35 ? 0.82 : 1; p.mao = [9, -1.5]; }
    if (t >= T.volta2[0] && t < T.volta2[1]) { const u = fatia(t, T.volta2[0], T.volta2[1]); p.x = J.pouso + (J.lugar[r] - J.pouso) * u; p.y = -10 * Math.sin(Math.PI * u); }
  }
  if (t >= T.pose[0] && t < T.pose[1]) p.punho = true;
  return p;
}
function desenharGente(g, t, J, T0, m, d) {
  const ordem = J.eu === MESTRE ? [MESTRE, ...TRIO] : TRIO;
  g.save();
  g.setTransform(T0.a, T0.b, T0.c, T0.d, T0.e, T0.f);
  if (d) g.translate(d.sx * 0.6, 0);
  for (const r of ordem) {
    const p = pose(J, r, t), lx = p.x - J.X0;
    if (r === 't7-azul') aura(g, lx, '#A855F7', t, Math.sin(Math.PI * fatia(t, T.auraAzul[0], T.auraAzul[1])));
    if (r === 't7-laranja') aura(g, lx, '#F97316', t, Math.sin(Math.PI * fatia(t, T.auraLaranja[0], T.auraLaranja[1])));
    if (!p.visivel) continue;
    A.vestir(r);
    const alto = A.ROUPAS.ROUPAS[r].linhas.length;
    A.clawdAkatsuki(g, {
      T: m.T, x: lx, y: p.y, sy: p.sy, selo: p.selo,
      mao: (p.punho || p.mao) && function (k, dy) {
        if (p.punho) A.punhoErguido(k, dy, alto);
        else A.maoNa(k, p.mao[0], p.mao[1] + dy);
      },
    });
    if (r === 't7-rosa') {  // a marca na testa acendendo
      const a = Math.sin(Math.PI * fatia(t, T.marca[0], T.marca[1]));
      if (a > 0) {
        const mx = lx, my = p.y - 14.25 * p.sy;
        g.save(); g.globalCompositeOperation = 'lighter';
        const gr = g.createRadialGradient(mx, my, 0, mx, my, 6);
        gr.addColorStop(0, rgba('#C084FC', 0.9 * a)); gr.addColorStop(1, rgba('#C084FC', 0));
        g.fillStyle = gr; g.fillRect(mx - 6, my - 6, 12, 12);
        g.restore();
        g.fillStyle = rgba('#7C3AED', a);
        g.beginPath(); g.moveTo(mx, my - 1.4); g.lineTo(mx + 1.2, my); g.lineTo(mx, my + 1.4); g.lineTo(mx - 1.2, my); g.closePath(); g.fill();
      }
    }
  }
  A.vestir(J.eu);
  // os puf de quem chega e de quem vai
  J.ajudantes.forEach((r, i) => {
    const lx = J.lugar[r] - J.X0;
    A.puf(g, lx, -10, fatia(t, T.chega[i], T.chega[i] + 0.6), J.sem + i * 31, 1.3, 7);
    A.puf(g, lx, -10, fatia(t, T.saem[i], T.saem[i] + 0.6), J.sem + i * 37, 1.3, 7);
  });
  g.restore();
}

// a trilha (som.js)
const SS = n => `sons-akatsuki/${n}.wav`, VOLUME = 0.52;  // VOLUME: a trilha mixada dá ~-22 LUFS (medido), como os épicos dos outros temas
function sons(J) {
  const L = J.ajudantes.map((r, i) => [T.chega[i], SS('fumaca'), 0.55, 1 + 0.08 * i]);
  L.push(
    [T.bug[0], SS('rasteja'), 0.5, 1, T.bug[1] - T.bug[0]], [T.empina[0], SS('chiado'), 0.6],
    [T.auraAzul[0], SS('aura'), 0.7, 0.9, T.guerreiro[1] - T.auraAzul[0]], [T.corte[0], SS('espada'), 0.9], [T.acerta, SS('golpe'), 0.8],
    [T.auraLaranja[0], SS('aura'), 0.7, 1.1, T.raposa[1] - T.auraLaranja[0]], [T.ruge[0], SS('rugido'), 0.9, 1.25],
    [T.bote[0], SS('pulo'), 0.6, 0.8], [T.joga, SS('golpe'), 0.9, 0.85],
    [T.marca[0], SS('brilho'), 0.5], [T.salto[0], SS('pulo'), 0.6], [T.soco, SS('soco'), 1], [T.estrela[0], SS('estrelinha'), 0.6],
    [T.saem[0], SS('fumaca'), 0.5, 1.1], [T.fecha[0], SS('terminou'), 0.8],
  );
  return L.map(([t, a, g, ...r]) => [t, a, g * VOLUME, ...r]);
}

function cena(m) {
  const J = montar(m);
  J.sem = Math.floor(m.sorteio() * 4294967296);
  return {
    nome: 'epico', dur: T.dur, espaco: { frente: 0, tras: 0 }, modos: ['andando'],
    plano: J,  // pros testes
    sons: sons(J),
    quadro(g, t, mundo) {
      const T0 = g.getTransform(), mm = mundo || m;
      const d = desenhar(g, t, mm, J);
      desenharGente(g, t, J, T0, mm, d);
    },
  };
}

module.exports = { linhaDoTempo, cena, T, TRIO, MESTRE, guerreiro, raposa, guerreiroEm, raposaEm, bugEm, pose, tremor };  // do T em diante: pros testes
