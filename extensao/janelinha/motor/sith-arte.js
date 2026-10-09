'use strict';
// Tema Sith: os desenhos. Tudo desenhado aqui, nada copiado de filme nem de jogo: o Clawd veste
// o elmo, a máscara, o painel do peito e a capa de um lorde Sith e carrega um sabre vermelho;
// no lado da luz, o manto (capuz abaixado: a cara dele) e um sabre verde. Os droides, os tiros e
// a nave triangular são genéricos. No referencial do Clawd: origem entre os pés, x+ pra frente,
// y- pra fora do cartão.
const { DEG, lim, sai, tela, cache, arte, tingida, rng, rgba, mistura } = require('./comum');
const { desenhaClawd, spriteClawd, registrarRoupas, andando: andandoBase, pulando: pulandoBase } = require('./clawd');

const fatia = (t, a, b) => lim((t - a) / (b - a), 0, 1);
const P = 1.5;  // o pixel do Clawd

// ---------- o Clawd de lorde Sith ----------
// h elmo, j brilho do elmo, k máscara, L lente, m/n grade da boca, a braço (luva), c painel do
// peito com as luzinhas r/v/z, e cinto, s/b fivela, o resto da armadura em k. O elmo cresce 4
// meias-fileiras pra cima; os olhos são lentes (não piscam).
const SITH = {
  elmo: '#15171C', brilho: '#5B6170', mascara: '#2A2E37', lente: '#050507', grade: '#9CA3AF', gradeEsc: '#4B5563',
  armadura: '#101115', luva: '#1C1E24', painel: '#6B7280', verm: '#EF4444', verde: '#22C55E', azul: '#3B82F6',
  cinto: '#374151', prata: '#D1D5DB', fivela: '#F3F4F6', contorno: '#7F1D1D', capa: '#09090B', capaBorda: '#26282F',
  forca: '#DC2626',
};
const LINHAS = [
  '.....hhhhhhhh.....',
  '....hjjhhhhhhh....',
  '...hjhhhhhhhhhh...',
  '..hhhhhhhhhhhhhh..',
  '..hhkkkkkkkkkkhh..',
  '.hhhkLLkkkkLLkhhh.',
  '.hhhkLLkkkkLLkhhh.',
  '.hhhkkmnmnmkkkhhh.',
  '.aakkcrvzckkkkkaa.',
  '.aakkczrvckkkkkaa.',
  '...eeessbbsseee...',
  '...dddddddddddd...',
  '....A.B....A.B....',
  '....A.B....A.B....',
];
const ROUPA = 'sith';
const CORES = {
  h: SITH.elmo, j: SITH.brilho, k: SITH.mascara, L: SITH.lente, m: SITH.grade, n: SITH.gradeEsc, a: SITH.luva,
  c: SITH.painel, r: SITH.verm, v: SITH.verde, z: SITH.azul, e: SITH.cinto, s: SITH.prata, b: SITH.fivela, d: SITH.armadura,
};
const ROUPAS = {
  [ROUPA]: { linhas: LINHAS, cores: CORES, perna: [SITH.armadura, SITH.armadura], corpo: SITH.armadura, olho: /Q/ },
};
// o Clawd do lado da luz: a cabeça é a dele (olhos que piscam), o capuz caído nos ombros, a
// túnica off-white, o cinto e o manto marrons
const JEDI = [
  '...############...',
  '...############...',
  '..H##o######o##H..',
  '..H##o######o##H..',
  '.aHTTTTTDDTTTTTHa.',
  '.aaTTTTTDDTTTTTaa.',
  '...cccccbbccccc...',
  '...RRRRRDDRRRRR...',
  '....A.B....A.B....',
  '....A.B....A.B....',
];
ROUPAS.jedi = {
  linhas: JEDI, perna: ['#3F2A17', '#3F2A17'], corpo: '#D77757',
  cores: { '#': '#D77757', o: '#1A1A1A', H: '#6B4423', T: '#E7D9B8', D: '#C9B48C', a: '#D77757', c: '#5C3A1E', b: '#E8E2D0', R: '#7A5230' },
};
registrarRoupas(ROUPAS);
const ALTURA = LINHAS.length;  // 14 meias-fileiras (o do lado sombrio)

// ---------- os dois lados (dono, 09/10) ----------
// A cada 50 voltas o Clawd troca de lado (tema-sith.js): o lorde de sabre vermelho, ou o Clawd de
// manto, sabre verde, nas cores off-white, verde e marrom. COR guarda as cores do lado de agora:
// o tema troca (trocarLado) antes de desenhar cada quadro, e os desenhos leem daqui o que muda.
// lamina: o sabre · escura/funda/clara/palida: tons dela · nucleo: o miolo do sabre · forca: a
// aura · cristal: o kyber da forja · tiro: o blaster dos droides (do lado da luz é vermelho, que
// verde já é o sabre)
const LADOS = {
  sombra: {
    roupa: 'sith', lamina: '#EF4444', escura: '#B91C1C', funda: '#7F1D1D', clara: '#FCA5A5', palida: '#FECACA', nucleo: '#FFE4E6',
    forca: '#DC2626', cristal: '#DC2626', tiro: '#4ADE80', contorno: SITH.contorno, capa: SITH.capa, capaBorda: SITH.capaBorda,
  },
  luz: {
    roupa: 'jedi', lamina: '#4ADE80', escura: '#16A34A', funda: '#14532D', clara: '#BBF7D0', palida: '#DCFCE7', nucleo: '#F0FDF4',
    forca: '#4ADE80', cristal: '#16A34A', tiro: '#F87171', contorno: '#2B1B0E', capa: '#5C3A1E', capaBorda: '#7A5230',
  },
};
const COR = { nome: 'sombra', ...LADOS.sombra };
function trocarLado(nome) { if (COR.nome !== nome && LADOS[nome]) Object.assign(COR, LADOS[nome], { nome }); }

// contorno de 1 px (vermelho-escuro; marrom na luz): o Clawd anda por cima de qualquer fundo
function contorno(g, pernas, dy, L, cor = COR.contorno) {
  const spr = tingida(spriteClawd(COR.roupa, pernas, 'abertos', false, null), cor, 'sith-cont' + COR.roupa + pernas);
  for (const [ox, oy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) g.drawImage(spr, -13.5 + ox, -L * P + dy + oy, 27, L * P);
}

// a capa: presa nos ombros, cai pra trás até o chão; o vento (0..1) leva a ponta pra trás e ela ondula
function capa(g, dy, t, vento = 0) {
  const onda = Math.sin(t * 7) * 1.2 * (0.3 + vento), recua = 4 + 7 * vento;
  const pts = [[5, -11], [-7, -11.5], [-10 - recua * 0.5, -6 + onda * 0.4], [-11 - recua, -1 + onda], [-9 - recua * 0.6, 0.6], [2, 0.6]];
  g.save(); g.translate(0, dy);
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y))); g.closePath();
  g.fillStyle = COR.capaBorda; g.fill();
  g.translate(0.8, -0.4);
  g.beginPath(); pts.forEach(([x, y], i) => (i ? g.lineTo(x * 0.93, y) : g.moveTo(x * 0.93, y))); g.closePath();
  g.fillStyle = COR.capa; g.fill();
  g.restore();
}

// ---------- o sabre ----------
// cabo na mão; ang em graus a partir de "pra cima", + = pra frente; len 0..1 (acendendo); o
// núcleo quase branco, a lâmina da cor do lado e o brilho somado por fora. Tremor leve (função de t).
const LAMINA = 17;
function sabre(g, x, y, ang, len, t, { instavel = 0, cor = COR.lamina, nucleo = COR.nucleo } = {}) {
  g.save(); g.translate(x, y); g.rotate(ang * DEG);
  g.fillStyle = '#111827'; g.fillRect(-0.9, -1, 1.8, 4.5);
  g.fillStyle = SITH.prata; g.fillRect(-0.9, -1.8, 1.8, 0.9); g.fillRect(-0.9, 1.2, 1.8, 0.6);
  if (len > 0.01) {
    const L = LAMINA * len, treme = 1 + 0.08 * Math.sin(t * 47) + instavel * 0.25 * Math.sin(t * 91 + 1.3);
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = rgba(cor, 0.22 * treme); g.fillRect(-2.6, -1.8 - L, 5.2, L + 0.6);
    g.fillStyle = rgba(cor, 0.45 * treme); g.fillRect(-1.6, -1.8 - L, 3.2, L + 0.3);
    g.restore();
    g.fillStyle = cor; g.fillRect(-1, -1.8 - L, 2, L);
    g.fillStyle = nucleo; g.fillRect(-0.45, -1.8 - L + 0.4, 0.9, L - 0.4);
    if (instavel > 0) {  // a lâmina que crepita: faíscas saindo dos lados
      const r = rng(Math.floor(t * 20) * 7919);
      for (let i = 0; i < 3; i++) {
        const yy = -1.8 - L * r(), lado = r() < 0.5 ? -1 : 1;
        g.fillStyle = r() < 0.5 ? COR.palida : cor; g.fillRect(lado * (1.6 + r() * 1.5), yy, 0.9, 0.9);
      }
    }
  }
  g.restore();
}
// o cabo apagado, pendurado no cinto
function caboNoCinto(g, dy) {
  g.fillStyle = '#111827'; g.fillRect(5.5, -4.6 + dy, 4.2, 1.6);
  g.fillStyle = SITH.prata; g.fillRect(5.5, -4.6 + dy, 0.8, 1.6); g.fillRect(8.9, -4.6 + dy, 0.8, 1.6);
}

// p: o do desenhaClawd + { sabre: {ang, len, instavel} | null (no cinto), vento (capa), aura (0..1, a Força), mao: braço pra frente }
function clawdSith(g, p = {}) {
  const pernas = p.sentado ? 'nenhuma' : (p.pernas || 'ambas'), t = p.T || 0;
  desenhaClawd(g, {
    ...p, roupa: COR.roupa, ferr: null,
    aura: p.aura > 0 ? k => auraForca(k, t, p.aura) : null,
    atras(k, dy, L) { capa(k, dy, t, p.vento || 0); if (p.contorno !== false && !p.branco) contorno(k, pernas, dy, L); },
    mao(k, dy) {
      if (p.sabre) sabre(k, 12, -7.5 + dy, p.sabre.ang || 0, p.sabre.len ?? 1, t, { instavel: p.sabre.instavel || 0 });
      else if (!p.branco) caboNoCinto(k, dy);
      if (p.extra) p.extra(k, dy);
    },
  });
}
// andando: o pulinho e as pernas de sempre, o sabre balançando e a capa ao vento
function andando(t, extra = {}) { const a = andandoBase(t); return { ...a, T: t, vento: 0.6, sabre: { ang: 10 + a.ang * 0.6, len: 1 }, ...extra }; }
// pergunta/permissão: pulando com o sabre erguido
function pulando(t, extra = {}) { return { ...pulandoBase(t), T: t, vento: 0.3, sabre: { ang: -8, len: 1 }, ...extra }; }

// a Força: um brilho da cor do lado que pulsa atrás dele
function auraForca(g, t, forca) {
  const a = forca * (0.55 + 0.2 * Math.sin(t * 4));
  const gr = g.createRadialGradient(0, -11, 2, 0, -11, 22);
  gr.addColorStop(0, rgba(COR.forca, 0.5 * a)); gr.addColorStop(1, rgba(COR.forca, 0));
  g.fillStyle = gr; g.fillRect(-24, -34, 48, 46);
}

// ---------- o que aparece nas cenas ----------
// droide genérico que flutua (bola com um olho vermelho e três perninhas)
const DROIDE = [
  '...gggg...',
  '..gllllg..',
  '.glllllkg.',
  'gllrRllkkg',
  'glllllkkkg',
  '.gkkkkkkg.',
  '..g.g.g...',
  '..g..g..g.',
];
const COR_DROIDE = { g: '#374151', l: '#9CA3AF', k: '#6B7280', r: '#B91C1C', R: '#FCA5A5' };
const droide = () => arte(DROIDE, COR_DROIDE);
// metade de cima / de baixo (o corte do sabre)
const droideMetade = cima => arte(cima ? DROIDE.slice(0, 4) : DROIDE.slice(4), COR_DROIDE);
// tiro de blaster: um risco com brilho (verde; do lado da luz, vermelho)
function tiro(g, x, y, ang, cor = COR.tiro) {
  g.save(); g.translate(x, y); g.rotate(ang);
  g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba(cor, 0.4); g.fillRect(-4.5, -1.5, 9, 3); g.restore();
  g.fillStyle = cor; g.fillRect(-3.5, -0.6, 7, 1.2);
  g.fillStyle = cor === '#4ADE80' ? '#F0FDF4' : mistura(cor, '#FFFFFF', 0.85); g.fillRect(-2.5, -0.3, 5, 0.6);
  g.restore();
}
// faíscas: n pedacinhos saindo de (x, y), d = s desde a batida; sorteio da semente
function faiscas(g, x, y, d, semente, n = 8, cores = ['#FDE68A', '#F97316', '#FECACA']) {
  if (d < 0 || d > 0.5) return;
  const r = rng(semente);
  g.save(); g.globalAlpha *= 1 - d / 0.5;
  for (let i = 0; i < n; i++) {
    const a = r() * Math.PI * 2, v = 25 + r() * 45;
    g.fillStyle = cores[i % cores.length];
    g.fillRect(x + Math.cos(a) * v * d, y + Math.sin(a) * v * d + 40 * d * d, 1, 1);
  }
  g.restore();
}
// as cenas de parado: nada passa pra dentro do cartão (o brilho da Força e as faíscas param
// 6 DIPs abaixo dos pés; o texto começa em 9). No referencial do Clawd (gira com ele nas curvas).
function acimaDoCartao(g, desenha) {
  g.save(); g.beginPath(); g.rect(-70, -90, 140, 96); g.clip();
  try { desenha(); } finally { g.restore(); }
}
// fumacinha cinza (o droide destruído)
function fumaca(g, x, y, d, dur = 0.8) {
  if (d < 0 || d >= dur) return;
  const u = d / dur;
  g.save(); g.globalAlpha *= 0.8 * (1 - u);
  for (let i = 0; i < 5; i++) {
    const w = 2 + 4 * u;
    g.fillStyle = i % 2 ? '#6B7280' : '#9CA3AF';
    g.fillRect(x + (i - 2) * 3 * (0.4 + u) - w / 2, y - 12 * u - (i % 3) * 2 - w / 2, w, w);
  }
  g.restore();
}

// a nave triangular genérica (de lado, a ponta pra esquerda), w de comprimento
const NAVES = cache(8);
function nave(w) {
  w = Math.round(w);
  const pronta = NAVES.get(w);
  if (pronta) return pronta;
  const h = Math.round(w * 0.32), c = tela(w + 4, h + 10), k = c.getContext('2d');
  // casco: um triângulo comprido, a ponte em cima, as luzinhas e os motores atrás
  k.fillStyle = '#4B5563';
  k.beginPath(); k.moveTo(0, h * 0.62 + 6); k.lineTo(w, 6); k.lineTo(w, h + 6); k.closePath(); k.fill();
  k.fillStyle = '#9CA3AF';
  k.beginPath(); k.moveTo(2, h * 0.6 + 6); k.lineTo(w, 6); k.lineTo(w, h * 0.42 + 6); k.closePath(); k.fill();
  k.fillStyle = '#374151'; k.fillRect(w * 0.15, h * 0.62 + 6, w * 0.85, 1);
  k.fillStyle = '#6B7280'; k.fillRect(w * 0.66, 1, w * 0.18, 5); k.fillRect(w * 0.72, -1 + 1, w * 0.06, 2);
  const r = rng(w);
  k.fillStyle = '#E5E7EB';
  for (let i = 0; i < Math.round(w / 6); i++) { const x = w * (0.25 + 0.7 * r()); k.fillRect(Math.round(x), Math.round(6 + h * (0.45 + 0.35 * r())), 1, 1); }
  k.fillStyle = '#93C5FD'; for (let i = 0; i < 3; i++) k.fillRect(w, 6 + h * (0.2 + 0.25 * i), 3, Math.max(2, h * 0.16));
  return NAVES.set(w, c);
}

// ---------- a frota dos droides (os dois épicos: sith-epico.js e sith-epico-luz.js) ----------
const CORES_FROTA = { g: '#374151', l: '#9CA3AF', k: '#6B7280', r: '#B91C1C', R: '#FCA5A5', w: '#EF4444', o: '#111827', a: '#4B5563', W: '#FFF1F2' };
// o droide gigante: o casco do droide do tema, o olho enorme, dois canhões e as perninhas
const GIGANTE = [
  '.......gggggg.......',
  '.....ggllllllgg.....',
  '....glllllllllkg....',
  '...gllllllllllkkg...',
  '..glllgggggglllkkg..',
  'aaglgoorRRrooglkkgaa',
  'aaglgorRWWRrogllkgaa',
  'aaglgorRWWRrogllkgaa',
  '..glgoorRRroogllkg..',
  '..glllggggggllkkkg..',
  '...gkkkkkkkkkkkkg...',
  '....ggkkkkkkkkgg....',
  '.....g..g..g..g.....',
  '....g..g....g..g....',
];
function explosao(g, x, y, d, sem) {  // um caça: clarão, bola de fogo, faíscas e fumaça
  if (d < 0 || d > 1.1) return;
  if (d < 0.06) { g.fillStyle = '#FFFFFF'; g.fillRect(x - 3, y - 3, 6, 6); }
  if (d < 0.35) {
    const u = d / 0.35, raio = 2 + 6 * sai(u);
    g.save(); g.globalAlpha *= 1 - u;
    for (const [f, cor] of [[1, '#F97316'], [0.65, '#FDE68A'], [0.3, '#FFFFFF']]) { g.fillStyle = cor; g.beginPath(); g.arc(x, y, raio * f, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  faiscas(g, x, y, d, sem, 10, ['#FDE68A', '#F97316', '#EF4444']);
  fumaca(g, x, y + 3, d - 0.1, 0.9);
}

// ---------- a navinha (o épico do lado da luz) ----------
// de lado, o bico pra frente: casco creme, a faixa e a amurada marrons, a luz verde no bico. No
// referencial do Clawd; n: { x, y (o convés: onde os pés pisam), rastro (0..1: chegando ou indo
// embora) }. O motor e o rastro verdes, as luzes de baixo âmbar.
const NAVINHA = [
  '...hhhhhhhhhhhhhh...',
  '.gggggggggggggggggrw',
  'mgkkkkkkkkkkkkkkkgg.',
  '.ggggggggggggggggg..',
  '....kk.......kk.....',
];
const COR_NAVINHA = { h: '#7A5230', g: '#E7D9B8', k: '#5C3A1E', r: '#16A34A', w: '#BBF7D0', m: '#3F2A17' };
function navinha(g, n, t) {
  const x0 = n.x - 15, y0 = n.y - P;
  g.save(); g.globalCompositeOperation = 'lighter';
  if (n.rastro > 0.05) for (let i = 0; i < 3; i++) { g.fillStyle = rgba('#BBF7D0', 0.3 * n.rastro); g.fillRect(x0 - 26 * n.rastro, y0 + 1.5 + i * 1.5, 26 * n.rastro, 0.6); }
  const L = 3 + 1.5 * Math.sin(t * 41) + 6 * n.rastro;
  g.fillStyle = rgba('#4ADE80', 0.55); g.fillRect(x0 - L, y0 + 2.6, L, 2.2);
  g.fillStyle = rgba('#F0FDF4', 0.8); g.fillRect(x0 - L * 0.5, y0 + 3.1, L * 0.5, 1.2);
  const pulsa = 0.5 + 0.3 * Math.sin(t * 13);
  for (const fx of [4.5, 13.5]) { g.fillStyle = rgba('#FDE68A', 0.45 * pulsa); g.fillRect(x0 + fx * P - 1, y0 + 7.5, 3, 1.5 + pulsa); }
  g.restore();
  g.drawImage(arte(NAVINHA, COR_NAVINHA), x0, y0, NAVINHA[0].length * P, NAVINHA.length * P);
}

module.exports = {
  SITH, ROUPA, ROUPAS, ALTURA, LADOS, COR, trocarLado, LAMINA, P, fatia, sai, clawdSith, andando, pulando, sabre, caboNoCinto, capa, contorno,
  auraForca, droide, droideMetade, DROIDE, tiro, faiscas, fumaca, nave, acimaDoCartao,
  CORES_FROTA, GIGANTE, explosao, NAVINHA, navinha,
};
