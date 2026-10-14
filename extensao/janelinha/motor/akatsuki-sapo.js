'use strict';
// Tema Akatsuki: o sapo chefe da invocação (o evento "sapo" do lado Time 7), o Gamabunta (dono, 13/10:
// nomes liberados, "mais bonito e parecido"). Desenho nosso, de frente: sentado, largo, o colete azul
// aberto, o cachimbo fumegando no canto da boca, a espada curta na cintura, a cicatriz no olho, a
// pálpebra pesada de mau humor. Pixel art em texto ('.' é vazio; o contorno já vem desenhado); quem
// desenha escolhe o tamanho do pixel (k). Fonte: scratchpad arte/sapo2.py.
const { cache, arte, rgba } = require('./comum');

const SAPO = [
  '..............................................................',
  '..............................................................',
  '.............OOOOOOOO....................OOOOOOOO.............',
  '............OLLLLLLLLO..................OLELLLLLLO............',
  '...........OLGGGGGGGGLO................OLGGEGGGGGLO...........',
  '..........OLGGDDDDDDDGLOOOOOOOOOOOOOOOOLGDDEDDDDGGLO..........',
  '..........OGGYYWWYYYYYDOLLLLLLLLLLLLLLOGYYWWMYYYYGDO..........',
  '..........OGGYYYYYYYYYGLGGGGGHGGGGGGGGLGYYYYEMYYYGDO..........',
  '.........OLGGYKKKKKKKYGGGGGGGGEGGGGGGGGGYKKKEKKKYGGLO.OO......',
  '..........OGGyYYKKKYYyGHGGGGGGGGGGGGHGGGyYYKEKYYyGDO.OMMO.....',
  '..........OGGGyYYYYYyGGGEGGGGGGGGGGGGEGGGyYYYEMyGGDOOsSSsO....',
  '..........OGGGGyyyyyGGGGGGGGGGGGGGGGGGGGGGyyyEMGGGDOOSSSSO....',
  '..........OGGGGGGGGGHGGGGGGGGGGGGGGGGGGHGGGGGEGGGGDOOSSSSO....',
  '..........OGGGGGGGGGGEGGGGGGGGGGGGGGGGGGEGGGGGEGGGDO.OSSO.....',
  '.........OLGHGGGGGGGGGGGGGGKGGGGGGKGGGGGGGGGGGEHGGGLOOpPO.....',
  '.........OGGGEGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGEGGDppPO......',
  '.........OGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGppPOO.......',
  '.........ODGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGpPPO.........',
  '..........OGGGGGGGGGGDDDDDDDDDDDDDDDDDDDDGGGGGGppPDO..........',
  '..........OGGGGGDDDDDMMMMMMMMMMMMMMMMMMMMDDDDDpPPGDO..........',
  '..........OGGGGDMMMMMLLLLLLLLLLLLLLLLLLLLMMMMMPGGGDO..........',
  '..........ObbbbMLLLLLGGGGCCCCCCCCCCCcGGGGLLLLLMbbbbO..........',
  '.........ObBBBBBbWGGGGGCCCCCCCCCCCCCCCcGGGGGWbBBBBBbO.........',
  '........ObBBBBBBBBbWGGcCCCCCCCCCCCCCCCCcGGWbBBBBBBBBbO........',
  '........OBBBBBBBBBBBbWGccCCCCCCCCCCCCccGWbBBBBBBBBBBBO........',
  '.....OOObBBBBBBBBBBBBWGGGCCCCCCCCCCCcGGGWBBBBBBBBBBBBbOOO.....',
  '....ObbbBBBBBBBBBBBBBWGCCCccccccccccCCcGWBBBBBBBBBBBBBbbbO....',
  '...ObBBBBBBBBBBBBBBBWGGCCCCCCCCCCCCCCCcGGWBBBBBBBBBBBBBBBbO...',
  '..ObBBBBBBBBDGGGGDBBWDCCCCCCccccccCCCCCcDWBBDGGGGDBBBBBBBBbO..',
  '.ObBBBBBBBBBDGGGGDBBWDCCCCCCCCCCCCCCCCCcDWBBDGGGGDBBBBBBBBBbO.',
  '.OBBBBBBBBBBDGGGGDBBWDCCCCCCCCCCCCCCCCCcDWBBDGGGGDBBBpXAAAABO.',
  '.OBBBBBBBBBBBDGGGGDBWDCCCCCCCCCCCCCCCCCcDWBDGGGXXpXpXXXAABABO.',
  '.OBBBBBBBBBBBDGGGGDBWDCCCCCCCCCCCCCCCCCcDWXXXXXXXXXXXBBBBBBBO.',
  '.OnnnnnnnnnnnDGGGGDnWDcCCCCCCCCCCCCCCCCXXXXXXXXGDnnnnnnnnnnnO.',
  '.OnnnnnnnnnnnDGGGGDWDGGCCCCCCCCCCCCCCCcXXXWDGGGGDnnnnnnnnnnnO.',
  '..OnnnnnnnnnnDGGGGDWDGGccCCCCCCCCCCCCccGGDWDGGGGDnnnnnnnnnnO..',
  '...ODGGGGGGGGGGGGGGODDDDDcCCCCCCCCCCcDDDDDOGGGGGGGGGGGGGGDO...',
  '..OOOGGGGGGGGGGGGGGOOOOOODccccccccccDOOOOOOGGGGGGGGGGGGGDOOO..',
  '.ODDDDDDDDDDGGGGGGGGO....OOOOOOOOOOOO....OGGGGGGGGDDDDDDDDDDO.',
  'ODDDDDDDDDDDGGGGGGGGO....................OGGGGGGGGDDDDDDDDDDDO',
  '.ODDDDDDDDDDDHGGHGGHO....................OHGGHGGHDDDDDDDDDDDO.',
  '..OOOOOOOOOOOOOOOOOO......................OOOOOOOOOOOOOOOOOO..',
];
// os olhos fechados (o remendo por cima do SAPO)
const PISCA = { x: 13, y: 5, linhas: [
  'GGGGGGGGGLOOOOOOOOOOOOOOOOLGGGEGGGGG',
  'GGGGGGGGGDOLLLLLLLLLLLLLLOGGGGEGGGGG',
  'GGGGGGGGGGLGGGGGHGGGGGGGGLGGGGGEGGGG',
  'MMMMMMMMMGGGGGGGGEGGGGGGGGGMMMMMMMMM',
  'DDDDDDDDDGHGGGGGGGGGGGGHGGGDDDDEDDDD',
  'GGGGGGGGGGGEGGGGGGGGGGGGEGGGGGGGEGGG',
  'GGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGGEGGG',
] };
const SW = SAPO[0].length, SH = SAPO.length;
const COR_SAPO = { O: '#2A0E06', G: '#C8562A', L: '#E47A45', H: '#F6A06A', D: '#8F3415', E: '#5E200C', C: '#F3D9B1', c: '#D9B88A', Y: '#FACC15', y: '#CA8A04', K: '#111111', M: '#3A1208', B: '#22306A', b: '#34468F', n: '#151D44', W: '#E5E7EB', P: '#5B3A1E', p: '#8B5E34', S: '#9CA3AF', s: '#D1D5DB', A: '#D4A017', X: '#1A1A1A' };
const CABECA = [31, 6];       // onde o Clawd fica em pé (o alto da cabeça, entre os olhos), em pixels da textura
const PAPO = [31, 23.5];      // de onde o papo enche (a garganta)
const CACHIMBO = [55, 8.5];   // a boca do fornilho, de onde sai a fumaça

const SAPOS = cache(4);
function textura(pisca = false) {
  const chave = pisca ? 'p' : 's', pronto = SAPOS.get(chave);
  if (pronto) return pronto;
  let linhas = SAPO;
  if (pisca) {
    linhas = SAPO.map((l, y) => {
      const r = PISCA.linhas[y - PISCA.y];
      return r ? l.slice(0, PISCA.x) + r + l.slice(PISCA.x + r.length) : l;
    });
  }
  return SAPOS.set(chave, arte(linhas, COR_SAPO));
}

// um ponto da textura (em pixels dela) com o sapo de meio em cx, pés em y, pixel k e amassado sx/sy
function ponto(cx, y, k, [px, py], sx = 1, sy = 1) {
  return [cx + (px - SW / 2) * k * sx, y - (SH - py) * k * sy];
}

// o sapo: meio em cx, pés em y, pixel k. s: { pisca, sx, sy (amassa a partir dos pés), papo (0..1:
// o papo enchendo e esvaziando), fumo (o relógio da fumaça do cachimbo, em s; sem ele, sem fumaça) }
function desenhar(g, cx, y, k, s = {}) {
  const sx = s.sx ?? 1, sy = s.sy ?? 1, w = SW * k, h = SH * k;
  g.save(); g.translate(cx, y); g.scale(sx, sy);
  g.drawImage(textura(!!s.pisca), -w / 2, -h, w, h);
  g.restore();
  if (s.fumo != null) {  // a fumaça: 3 bolinhas subindo do fornilho, crescendo, entortando e sumindo
    const [fx, fy] = ponto(cx, y, k, CACHIMBO, sx, sy);
    for (let i = 0; i < 3; i++) {
      const u = (s.fumo * 0.8 + i / 3) % 1, r = k * (0.7 + 1.8 * u);
      g.fillStyle = rgba('#E5E7EB', 0.7 * (1 - u));
      g.beginPath(); g.arc(fx + k * (2.5 * u + Math.sin(u * 5 + i * 2) * 1.2), fy - k * 10 * u, r, 0, Math.PI * 2); g.fill();
    }
  }
  const u = s.papo || 0;
  if (u > 0 && u < 1) {
    const [px, py] = ponto(cx, y, k, PAPO, sx, sy), r = k * (1.5 + 4.5 * Math.sin(Math.PI * u));
    g.fillStyle = COR_SAPO.O; g.beginPath(); g.ellipse(px, py, r + k * 0.7, r * 0.8 + k * 0.7, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = COR_SAPO.C; g.beginPath(); g.ellipse(px, py, r, r * 0.8, 0, 0, Math.PI * 2); g.fill();
    g.fillStyle = '#FFFFFF'; g.fillRect(px - r * 0.4, py - r * 0.5, k, k);
  }
}

module.exports = { textura, desenhar, ponto, SW, SH, CABECA, PAPO, CACHIMBO, COR_SAPO };
