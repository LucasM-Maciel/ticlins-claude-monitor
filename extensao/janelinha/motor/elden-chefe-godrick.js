'use strict';
// Tema Elden Ring, chefe GODRICK, O ENXERTADO (contrato de elden-epico.js: { id, nome, H, W, desenha, efeito, ataques }).
// O que o define: tronco ENORME e cabeça pequena, pele cinza-pálida, cabelo ralo e sujo, diadema, armadura de ouro VELHA (fosca,
// amassada, com pedaços faltando e o tecido encardido aparecendo), capa vermelho-escura esfarrapada com gola de pele marrom,
// dois braços extras ENXERTADOS (pele verde-acinzentada, costuras) brotando das costelas, grande machado de lâmina dupla
// com o leão e, no lugar da mão esquerda, uma cabeça de dragão enxertada que abre a boca e cospe fogo.
// Camadas pintadas UMA vez, em pixels da arte: corpo (3 faixas que se abaixam e balançam), braço do machado e braço de dragão
// (cada um gira em torno do próprio ombro). O machado só varre o arco de BAIXO: por cima ele passaria do H e invadiria a barra de vida.
const { tela, tingida, rng, rgba } = require('./comum');
const A = require('./elden-arte');
const { COR, fatia } = A;

const W = 56, H = 48;
const ACERTA = [0.5, 0.65];
const OMBRO = [10, 29];      // ombro do machado (pixels da arte: x a partir do meio, y a partir dos pés)
const OMBRO_D = [-10, 29];   // ombro do braço de dragão
const REP_W = 0, REP_A = 160, ATRAS_M = 138, BATE_M = 228;  // machado (graus; 0 = pra cima, 90 = pra trás, 180 = pra baixo): REP_W = cabo em pé, REP_A = braço pendurado
const R_M = 22;              // do ombro ao centro da lâmina no golpe (G_M do braço + 7 do cabo)
const G_M = 15, KNEE_W = -155, KNEE_A = 205;
const REP_D = -128, ALVO_D = -100;  // braço de dragão: tempo-base do repouso ao apontar (o desenho usa NECK_*/BEND_R)
const NECK_R = -150, NECK_A = -100, BEND_R = 25, LN = 11, R_B = 16.5;  // pescoço (repouso e ataque), curva da cabeça no repouso, comprimento do pescoço, dobradiça até a boca

// ---------- tintas ----------
const K = '#0B0907';
const OURO = ['#B89A3E', '#8A6E27', '#5C4719', '#33260D'];  // ouro velho: claro, médio, escuro, fundo
const BRILHO = '#E3CD83', SUJO = '#463611', FERRUGEM = '#6E4A20';
const PANO = ['#6A5B46', '#52452F', '#3A3022', '#271F16'];   // tecido encardido por baixo da armadura
const CAPA = ['#8C2B24', '#6A1D19', '#47110F', '#2A0A09'];
const PELO = ['#977651', '#6F5237', '#4A3422', '#2E2015'];
const ENX = ['#B4C0AA', '#8E9C86', '#5F6B5B', '#3C463A'];     // pele dos braços enxertados: mais pálida, verde-acinzentada
const CABELO = ['#BDAE82', '#8E8058', '#5F5538'];

// ruído determinístico: mesma posição, mesmo valor
const ruido = (x, y, s = 0) => { let n = (x * 374761393 + y * 668265263 + s * 1274126177) | 0; n = Math.imul(n ^ (n >>> 13), 1274126177); return ((n ^ (n >>> 16)) >>> 0) / 4294967296; };

// ---------- construção das camadas (uma vez) ----------
const IMGS = {};
function imagem(nome, w, h, pinta) {
  if (!IMGS[nome]) {
    const t = tela(w, h), k = t.getContext('2d');
    pinta(k, (x, y, ww, hh, cor) => { k.fillStyle = cor; k.fillRect(x, y, ww, hh); });
    IMGS[nome] = t;
  }
  return IMGS[nome];
}
// ascii: cada letra é uma cor da paleta; '.' é vazio. Sem letra na paleta, ignora.
const asc = (px, linhas, pal, x0, y0) => linhas.forEach((l, y) => { for (let x = 0; x < l.length; x++) { const c = pal[l[x]]; if (c) px(x0 + x, y0 + y, 1, 1, c); } });
// uma forma redonda com luz de cima/esquerda: 4 tons, contorno escuro e a sujeira do ouro velho
function bola(px, cx, cy, rx, ry, T, suja = 1, sem = 0) {
  const dentro = (x, y) => ((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1;
  for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry); y++) for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx); x++) {
    if (!dentro(x, y)) continue;
    if (!dentro(x - 1, y) || !dentro(x + 1, y) || !dentro(x, y - 1) || !dentro(x, y + 1)) { px(x, y, 1, 1, K); continue; }
    const l = (x + 0.5 - cx) / rx * 0.6 + (y + 0.5 - cy) / ry * 0.75, r = ruido(x, y, sem);
    let c = l < -0.55 ? T[0] : l < 0.05 ? T[1] : l < 0.6 ? T[2] : T[3];
    if (suja && r < 0.09 * suja) c = SUJO; else if (suja && r < 0.15 * suja && l > -0.2) c = FERRUGEM;
    if (suja && l < -0.85 && r > 0.3) c = BRILHO;
    px(x, y, 1, 1, c);
  }
}
// um membro grosso por uma linha de pontos: contorno, 3 tons com luz da esquerda; devolve o último ponto
function membro(px, pts, T, esp = 2.5) {
  const passos = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const [x0, y0] = pts[i], [x1, y1] = pts[i + 1], n = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2);
    for (let j = 0; j <= n; j++) passos.push([x0 + (x1 - x0) * j / n, y0 + (y1 - y0) * j / n]);
  }
  const disco = (r, dx, dy, cor) => passos.forEach(([cx, cy]) => {
    for (let y = Math.floor(cy + dy - r); y <= Math.ceil(cy + dy + r); y++) for (let x = Math.floor(cx + dx - r); x <= Math.ceil(cx + dx + r); x++)
      if ((x + 0.5 - cx - dx) ** 2 + (y + 0.5 - cy - dy) ** 2 <= r * r) px(x, y, 1, 1, cor);
  });
  disco(esp + 0.9, 0, 0, K); disco(esp, 0, 0, T[2]); disco(esp * 0.8, -0.4, -0.4, T[1]); disco(esp * 0.4, -0.9, -0.9, T[0]);
}

// uma mão de garra: palma redonda + dedos finos em polilinha (pontos relativos à palma), halo escuro, unha clara na ponta
function garra(px, x, y, dedos, T = ENX) {
  const ao = (f, fn) => f.forEach((p, i) => {
    if (!i) return;
    const [x0, y0] = f[i - 1], n = Math.ceil(Math.hypot(p[0] - x0, p[1] - y0) * 2);
    for (let j = 0; j <= n; j++) fn(Math.round(x + x0 + (p[0] - x0) * j / n), Math.round(y + y0 + (p[1] - y0) * j / n), i === f.length - 1 && j === n);
  });
  dedos.forEach(f => ao(f, (a, b) => { for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) px(a + i, b + j, 1, 1, K); }));
  bola(px, x, y, 2.4, 2.1, T, 0, 30);
  dedos.forEach(f => ao(f, (a, b, ponta) => px(a, b, 1, 1, ponta ? '#E8DFCF' : T[1])));
}
// o remendo de pele pálida com a costura em X (fio escuro, pontos claros nas pontas)
function costura(px, cx, cy) {
  bola(px, cx, cy, 2.9, 2.9, ENX, 0, 40);
  for (let i = -2; i <= 2; i++) { px(cx + i, cy + i, 1, 1, '#1F1A14'); px(cx + i, cy - i, 1, 1, '#1F1A14'); }
  for (const [a, b] of [[-3, -3], [3, -3], [-3, 3], [3, 3]]) px(cx + a, cy + b, 1, 1, '#E8DFCF');
}

// a cabeça: PEQUENA (11 x 12), pele pálida, cabelo ralo caindo dos lados, olhar sério; metade esquerda e espelho
const MEIA_CABECA = [
  '...KKK',
  '..KhhH',
  '.KhhhH',
  '.Khhpp',
  '.Khppp',
  '.KrrrP',
  '.KpeeP',
  '.KppqP',
  '.Kppql',
  '..KppP',
  '...Kqq',
  '....KK',
];
function cabeca(px, x0, y0) {
  MEIA_CABECA.forEach((m, y) => {
    const linha = m + m.slice(0, 5).split('').reverse().join('');
    for (let x = 0; x < linha.length; x++) {
      let c = linha[x]; const dir = x > 5;
      if (c === '.') continue;
      const cor = { K, h: dir ? CABELO[1] : CABELO[0], H: CABELO[2], p: dir ? '#A39C90' : '#CFC8BB', P: '#A39C90', q: dir ? '#74706A' : '#A39C90', r: '#74706A', e: '#1E1A22', l: '#8E6F66' }[c];
      px(x0 + x, y0 + y, 1, 1, cor);
    }
  });
  px(x0 + 2, y0 + 6, 2, 1, '#1E1A22'); px(x0 + 7, y0 + 6, 2, 1, '#1E1A22');  // os olhos fundos
  px(x0 + 3, y0 + 6, 1, 1, '#9FB6C8'); px(x0 + 7, y0 + 6, 1, 1, '#7C93A6');
  px(x0 + 3, y0 + 8, 5, 1, '#8E6F66');  // a boca fina e reta
}

// o corpo: 44 x 46, centro em x = 22
function corpo() {
  return imagem('godrick-corpo', 44, 46, (k, px) => {
    const CX = 22, pp = (x, y, c) => px(x, y, 1, 1, c);
    // capa esfarrapada, atrás de tudo: larga (sobra pra trás e pra frente do corpo), 3 tons de vermelho-escuro em dobras diagonais,
    // barra em tiras de 3 px com entalhes de alturas diferentes
    const hem = x => 43 - Math.abs(x - CX) * 0.12 - Math.floor(ruido(Math.floor((x + 1) / 3), 7) * 7) - ((x + 1) % 3 === 2 ? 2 : 0);
    const naCapa = (x, y) => y >= 13 && x >= 6 - Math.min(2, (y - 13) * 0.2) && x <= 38 + Math.min(5, (y - 13) * 0.4) && y <= hem(x);
    for (let y = 13; y <= 43; y++) for (let x = 0; x < 44; x++) {
      if (!naCapa(x, y)) continue;
      if (!naCapa(x - 1, y) || !naCapa(x + 1, y) || !naCapa(x, y - 1) || !naCapa(x, y + 1)) { pp(x, y, K); continue; }
      const dobra = (x + Math.floor(y * 0.15)) % 6;
      let c = dobra === 0 ? CAPA[0] : dobra < 4 ? CAPA[1] : CAPA[2];
      if (y < 20 && dobra === 1) c = CAPA[0];  // o topo pega mais luz
      pp(x, y, c);
    }
    // pernas (grevas): ouro velho com joelheira, amassados e bota de couro
    const perna = x0 => {
      px(x0 - 1, 32, 10, 14, K);
      for (let y = 32; y < 45; y++) for (let i = 0; i < 8; i++) {
        const r = ruido(x0 + i, y, 4);
        let c = i === 0 ? OURO[0] : i < 4 ? OURO[1] : i < 6 ? OURO[2] : OURO[3];
        if (r < 0.1) c = SUJO; else if (r < 0.15 && i > 1) c = FERRUGEM;
        pp(x0 + i, y, c);
      }
      bola(px, x0 + 3.6, 38, 4.6, 3, OURO, 1, x0);  // joelheira
      px(x0 + 2, 33, 3, 1, OURO[0]); px(x0 + 1, 41, 6, 1, OURO[3]);
      px(x0 - 2, 42, 11, 4, K); px(x0 - 1, 42, 9, 3, '#4A3322'); px(x0 - 1, 42, 9, 1, '#6B4E32'); px(x0 - 1, 44, 3, 1, '#2B1D12');  // a bota
    };
    perna(11); perna(25);  // pernas afastadas: a capa aparece entre elas
    px(20, 32, 3, 4, PANO[2]);
    // peitoral ENORME: contorno, 4 tons, peitorais em placas, barriga, cinto e os rombos onde a armadura quebrou
    for (let y = 12; y <= 31; y++) {
      const hw = y < 18 ? 15 : 15 - 7.5 * Math.pow((y - 18) / 13, 1.1);
      const l = Math.round(CX - hw), r = Math.round(CX + hw) - 1;
      for (let x = l - 1; x <= r + 1; x++) {
        if (x < l || x > r) { pp(x, y, K); continue; }
        const f = (x - l) / (r - l), rr = ruido(x, y, 2);
        let c = f < 0.2 ? OURO[0] : f < 0.5 ? OURO[1] : f < 0.8 ? OURO[2] : OURO[3];
        if (rr < 0.1) c = SUJO; else if (rr < 0.16 && f > 0.2) c = FERRUGEM;
        pp(x, y, c);
      }
    }
    bola(px, 16.5, 19, 6.5, 5.3, OURO, 1, 3); bola(px, 27.5, 19, 6.5, 5.3, OURO, 1, 4);
    bola(px, 22, 27, 8.5, 4.2, OURO, 1.2, 5);
    px(13, 30, 18, 2, K); px(14, 30, 16, 1, '#54402A'); px(20, 30, 4, 2, K); px(21, 30, 2, 1, OURO[1]);  // o cinto de couro e a fivela
    for (let i = 0; i < 5; i++) { pp(18 + i, 16 + i, OURO[3]); pp(29 - i, 24 + (i >> 1), OURO[3]); }  // riscos de espada
    bola(px, 24.5, 21.5, 2.2, 1.6, [OURO[2], OURO[2], OURO[3], OURO[3]], 0, 6);  // amassado
    bola(px, 13.5, 25.2, 3, 2.4, PANO, 0, 7); bola(px, 31, 24.2, 2.6, 2.4, PANO, 0, 8);  // rombos: o pano de baixo
    bola(px, 11.6, 15.2, 2.2, 2, PANO, 0, 9);  // o canto quebrado do peitoral
    for (const [x, y] of [[17, 16], [27, 16], [19, 26], [25, 26], [14, 21], [30, 20]]) pp(x, y, BRILHO);  // rebites
    // o tecido encardido, saindo por baixo do cinto
    for (let x = 14; x < 30; x++) { const fim = 36 + Math.floor(ruido(x, 5) * 3) - ((x % 3) === 0 ? 1 : 0); for (let y = 31; y <= fim; y++) if (x < 21 || x > 22) pp(x, y, y === fim ? K : (x + y) % 4 === 0 ? PANO[2] : PANO[1]); }
    // os dois braços ENXERTADOS: finos, de pele verde-acinzentada bem diferente do ouro, costura em X no ombro, cotovelo dobrado, mão de garra.
    // A: sai do flanco direito e cai pelas costas. B: sai das costelas e agarra o cinto.
    membro(px, [[38, 22], [40.5, 27], [39, 31]], ENX, 1.5);
    garra(px, 39, 33, [[[-1.5, 1.5], [-2.5, 3.5], [-2.5, 5.5]], [[0.2, 2], [0, 4.5], [-1, 6.5]], [[1.8, 1.5], [2.2, 3.8], [1.3, 5.8]]]);
    costura(px, 38, 21);
    membro(px, [[14, 25.5], [10.5, 29.5], [14.5, 31]], ENX, 1.5);
    garra(px, 16, 31, [[[2, -1.5], [4, -1], [5, 0.5]], [[2.3, 0.2], [4.5, 0.8], [5.5, 2.3]], [[1.8, 1.8], [3.8, 2.6], [4.5, 4]]]);
    costura(px, 14, 25);
    // gola de pele marrom, suja, em tufos pelos ombros
    for (let x = 7; x <= 37; x++) {
      const topo = Math.abs(x - CX) < 7 ? 12 : 10 + Math.floor(Math.abs(x - CX) / 9), fim = 16 + Math.floor(ruido(x, 3) * 3) + (Math.abs(x - CX) > 12 ? -1 : 0);
      for (let y = topo; y <= fim; y++) {
        const borda = y === topo || y === fim || x === 7 || x === 37, r = ruido(x, y, 1);
        let c = (x * 2 + y * 3) % 5 === 0 ? PELO[2] : r < 0.12 ? PELO[0] : (x < 20 ? PELO[1] : PELO[2]);
        if (y === topo + 1 && x < 22) c = PELO[0];
        pp(x, y, borda ? K : c);
      }
    }
    // cabelo comprido, ralo, loiro-acinzentado e sujo, caindo dos lados da cabeça
    for (let lado = 0; lado < 2; lado++) for (let i = 0; i < 4; i++) {  // mechas ralas: três fios por lado, desfiados embaixo
      const d = lado ? 1 : -1, fim = 25 - i * 2 + Math.floor(ruido(i, lado, 13) * 5) - (lado ? 2 : 0);
      for (let y = 3 + i * 2; y <= fim; y++) {
        const xo = (lado ? 28 : 16) + d * (i + Math.floor((y - 3) / 5));
        if (ruido(xo, y, 11) < 0.08 + y * 0.012) continue;  // ralo: mais falhas embaixo
        pp(xo, y, y > fim - 3 ? CABELO[2] : (i + y) % 4 === 0 ? CABELO[2] : i === 0 ? CABELO[0] : CABELO[1]);
      }
    }
    cabeca(px, 17, 1);
    // o pequeno diadema de ouro: faixa e três pontas
    px(19, 2, 7, 1, '#B8922E'); px(19, 3, 7, 1, '#7C5F1C'); px(19, 1, 1, 1, '#B8922E'); px(22, 1, 1, 1, '#E0B93A'); px(25, 1, 1, 1, '#B8922E'); px(22, 0, 1, 1, K);
  });
}

// braço do machado (sprite 16x34, pivô no ombro em (8,26), a mão fica G_M acima): ombreira redonda gasta, braçal quebrado e luva.
function braco() {
  return imagem('godrick-braco', 16, 34, (k, px) => {
    const P = 26, cx = 8, pp = (x, y, c) => px(x, y, 1, 1, c);
    px(cx - 4, P - 13, 9, 11, K);  // o braçal de ouro (antebraço) e o pano do braço, 7 de largura, com um rombo
    for (let y = P - 12; y < P - 3; y++) for (let i = 0; i < 7; i++) {
      const x = cx - 3 + i, r = ruido(x, y, 12), pano = y > P - 8;
      let c = pano ? (i < 3 ? PANO[1] : PANO[2]) : i < 2 ? OURO[0] : i < 5 ? OURO[1] : OURO[2];
      if (!pano && y > P - 10 && y < P - 8 && i > 3) c = PANO[1];  // rombo no braçal: o pano de baixo
      if (r < 0.1) c = SUJO;
      pp(x, y, c);
    }
    px(cx - 3, P - 8, 7, 1, OURO[3]); px(cx - 3, P - 12, 7, 1, OURO[0]);
    px(cx - 4, P - 18, 9, 6, K); px(cx - 3, P - 17, 7, 4, '#3A2E22'); px(cx - 3, P - 17, 7, 1, '#5E4A33'); px(cx - 3, P - 14, 7, 1, '#241B13');  // a luva de couro
    for (let i = 0; i < 3; i++) pp(cx - 2 + i * 2, P - 15, K);
    bola(px, cx, P, 6.2, 5.6, OURO, 1.2, 14);  // a ombreira redonda, gasta
    for (const [x, y] of [[cx - 4, P - 2], [cx + 3, P - 2], [cx - 1, P + 3]]) pp(x, y, BRILHO);
  });
}

// a cabeça do machado: DUAS meias-luas recortadas (a da frente, +x, maior) em 2 tons chapados, contorno de 1 px, sulco escuro e FIO claro
// na borda curva; o leão é um disco escuro com 4 pontos claros. Sprite 30x28, centro (12,14), cabo na vertical.
function lamina() {
  return imagem('godrick-lamina', 30, 28, (k, px) => {
    const cx = 12, cy = 14, W = 30, H = 28;
    const elip = (x, y, ox, rx, ry) => ((x - ox) / rx) ** 2 + (y / ry) ** 2;
    const colar = (x, y) => Math.abs(x) <= 3 && Math.abs(y) <= 4;
    const frente = (x, y) => x >= 1 && elip(x, y, 0, 12, 10) <= 1 && elip(x, y, 2, 3.5, 5) > 1;
    const tras = (x, y) => x <= -1 && elip(x, y, 0, 8, 8) <= 1 && elip(x, y, -2, 2.5, 4) > 1;
    const solido = (x, y) => colar(x, y) || frente(x, y) || tras(x, y);
    // profundidade: 1 = contorno, 2 = fio, 3 = sulco (só na borda curva de fora)
    const prof = new Map(), chave = (x, y) => (x + 20) * 100 + (y + 20);
    const viz = [[1, 0], [-1, 0], [0, 1], [0, -1]];
    let borda = [];
    for (let y = -14; y <= 14; y++) for (let x = -14; x <= 17; x++) if (solido(x, y) && viz.some(([a, b]) => !solido(x + a, y + b))) { prof.set(chave(x, y), 1); borda.push([x, y]); }
    for (let n = 2; n <= 3; n++) {
      const prox = [];
      for (const [x, y] of borda) for (const [a, b] of viz) if (solido(x + a, y + b) && !prof.has(chave(x + a, y + b))) { prof.set(chave(x + a, y + b), n); prox.push([x + a, y + b]); }
      borda = prox;
    }
    for (let y = -14; y <= 14; y++) for (let x = -14; x <= 17; x++) {
      if (!solido(x, y)) continue;
      const d = prof.get(chave(x, y)) || 9;
      const fora = !colar(x, y) && ((x > 0 && elip(x, y, 0, 12, 10) > 0.55) || (x < 0 && elip(x, y, 0, 8, 8) > 0.55)) && (x > 0 ? elip(x, y, 2, 3.5, 5) > 1.9 : true);
      let c = colar(x, y) ? (y < 0 ? '#8A6E27' : '#6E5620') : y < 0 ? OURO[0] : OURO[1];
      if (d === 1) c = K; else if (d === 2 && fora) c = '#F3E6A8'; else if (d === 3 && fora) c = '#4A3811';
      px(cx + x, cy + y, 1, 1, c);
    }
    px(cx - 1, cy - 2, 1, 1, K); px(cx + 1, cy + 2, 1, 1, K); px(cx, cy - 1, 1, 1, BRILHO);  // rebites do colar
    bola(px, cx + 8, cy, 2, 2.2, ['#33260D', '#33260D', '#2A1D08', '#2A1D08'], 0, 1);  // o leão: disco escuro
    px(cx + 7, cy - 1, 1, 1, BRILHO); px(cx + 9, cy - 1, 1, 1, BRILHO); px(cx + 7, cy + 1, 2, 1, OURO[0]);  // olhos e focinho
  });
}

// o cabo: madeira escura e anéis de couro; topo em ponta de ferro, pomo de ferro. y < 0 é pra cima, a mão fica na origem.
function haste(g, pb, topo, base, cor) {
  const R = (x, y, w, h, c) => { g.fillStyle = cor || c; g.fillRect(x * pb, y * pb, w * pb, h * pb); };
  R(-2, topo - 1, 5, base - topo + 2, K);
  R(-1, topo, 1, base - topo, '#5C4630'); R(0, topo, 1, base - topo, '#3B2B1C'); R(1, topo, 1, base - topo, '#241A10');
  for (let y = base - 6; y > topo + 3; y -= 7) R(-1, y, 3, 1, '#7A6840');
  R(-2, base - 1, 5, 3, K); R(-1, base - 1, 3, 1, '#9A9EA3'); R(-1, base, 3, 1, '#5A5E64');  // o pomo de ferro
  R(-1, topo - 5, 3, 4, K); R(0, topo - 4, 1, 3, '#B8BCC2');  // a ponta
}

// braço de dragão, em 3 peças: pescoço escamoso (pivô no ombro), crânio e mandíbula (esta gira na dobradiça e abre).
// Crânio e mandíbula são escritos com o focinho à direita e espelhados ao pintar (viram o focinho pra cima ao girar 90 graus).
const ESC = { K, S: '#5E9A5C', s: '#3A6B42', t: '#244A2E', u: '#162E1D', c: '#E2D8BC', d: '#8A7C5C', a: '#F0A82A', A: '#FFE08A', w: '#F4EFE0', n: '#E8631A', N: '#FFC24A', m: '#7A1E14' };
const CRANIO = [
  'dd..KKKK..........',
  '.cdKSSSSKKK.......',
  '..cKSSSSSSsKKKK...',
  '...KSSaASSsssssKKK',
  '..KSSSSsssssssssKK',
  '..KsssssssKwKKwKK.',
  '...KKmmmmmmKKKK...',
];
const MANDIBULA = [
  '......KwKnKwKnKwK.',
  '....KSSssssssssssK'.slice(0, 18),
  '....KsstttttttttKK',
  '.....KKKKKKKKKKK..',
];
const espelha = l => l.map(s => [...s].reverse().join(''));
function pescoco() {
  return imagem('godrick-pescoco', 11, 22, (k, px) => {
    const P = 16, cx = 5, pp = (x, y, c) => px(x, y, 1, 1, c);
    for (let y = 4; y <= P; y++) {  // escamas verde-escuras: claro na frente (-x), escuro nas costas (+x)
      const hw = 3 + (y - 4) / 12 * 1.4;
      for (let x = Math.floor(cx - hw); x <= Math.ceil(cx + hw); x++) {
        const i = (x - (cx - hw)) / (2 * hw), par = (x + y) % 3 === 0;
        let c = i < 0.25 ? ESC.S : i < 0.7 ? ESC.s : ESC.t;
        if (par && i > 0.2) c = i < 0.7 ? ESC.t : ESC.u;
        pp(x, y, x < cx - hw + 0.5 || x > cx + hw - 0.5 ? K : c);
      }
    }
    for (const y of [6, 9, 12]) { pp(cx + 5, y, ESC.c); pp(cx + 4, y, K); }  // espinhos no dorso
    px(cx - 5, P - 5, 11, 3, K); px(cx - 4, P - 4, 9, 1, OURO[1]); px(cx - 4, P - 3, 9, 1, OURO[3]); px(cx - 4, P - 4, 3, 1, OURO[0]);  // o braçal que sobrou
    bola(px, cx, P, 5.2, 4.8, OURO, 1.2, 21);  // a ombreira, em cima
    for (const [x, y] of [[cx - 3, P - 2], [cx + 2, P - 1]]) pp(x, y, BRILHO);
  });
}
function crania() { return imagem('godrick-cranio', 18, 7, (k, px) => asc(px, espelha(CRANIO), ESC, 0, 0)); }
function mandibula() { return imagem('godrick-mandibula', 18, 4, (k, px) => asc(px, espelha(MANDIBULA), ESC, 0, 0)); }

// ---------- tinta de golpe e movimentos ----------
function tinta(g, img, nome, est, desenhaCom) {
  desenhaCom(img);
  if (est.golpeado > 0) {
    const cor = Math.floor(est.T * 30) % 2 ? 'rgba(255,255,255,0.9)' : 'rgba(239,68,68,0.85)';
    g.save(); g.globalAlpha *= 0.8 * est.golpeado;
    desenhaCom(tingida(img, cor, nome));
    g.restore();
  }
}
const suave = u => u * u * (3 - 2 * u);

// a pose do machado: w = ângulo do cabo, alfa = ângulo do braço, r = 1 em repouso (cabo em pé no chão, braço pendurado) e 0 no golpe
// (braço e cabo alinhados, a lâmina a R_M do ombro). A volta do golpe sobe pela FRENTE (228 até 356 graus), longe da borda direita.
function poseMachado(est) {
  const kn = est.ajoelha;
  if (kn > 0) return { w: REP_W + (KNEE_W - REP_W) * kn, alfa: REP_A + (KNEE_A - REP_A) * kn, r: 1 - kn };
  const a = est.ataque;
  if (!a || a.id !== 0) return { w: REP_W, alfa: REP_A, r: 1 };
  const u = a.u, ac = ACERTA[0];
  let w, r;
  if (u < 0.07) { w = REP_W + 6 * Math.sin(Math.PI * fatia(u, 0, 0.07)); r = 1; }
  else if (u < ac - 0.14) { const s = suave(fatia(u, 0.07, ac - 0.14)); w = REP_W + (ATRAS_M - REP_W) * s; r = 1 - s; }
  else if (u < ac) { w = ATRAS_M + (BATE_M - ATRAS_M) * Math.pow(fatia(u, ac - 0.14, ac), 1.4); r = 0; }
  else { const s = fatia(u, ac, 0.9), q = suave(fatia(s, 0.5, 1)); w = BATE_M - 6 * Math.sin(Math.PI * Math.min(1, s * 3)) + (REP_W + 360 - BATE_M) * q; r = q; }
  return { w, alfa: w * (1 - r) + REP_A * r, r };
}
function anguloDragao(est) {
  const a = est.ataque;
  if (est.ajoelha > 0 || !a || a.id !== 1) return REP_D;
  const u = a.u, ac = ACERTA[1];
  if (u < 0.1) return REP_D;
  if (u < ac - 0.25) return REP_D + (ALVO_D - REP_D) * suave(fatia(u, 0.1, ac - 0.25));
  if (u < ac + 0.2) return ALVO_D;
  return ALVO_D + (REP_D - ALVO_D) * suave(fatia(u, ac + 0.2, ac + 0.5));
}
// quanto a boca abre (0..1), com rampa de abrir e de fechar
function abertura(est) {
  const a = est.ataque;
  if (!a || a.id !== 1 || est.ajoelha) return 0;
  return fatia(a.u, ACERTA[1] - 0.32, ACERTA[1] - 0.2) * (1 - fatia(a.u, ACERTA[1] + 0.18, ACERTA[1] + 0.3));
}
// pescoço e curva da cabeça (graus; 0 = pra cima): no repouso o pescoço cai e a cabeça fica baixa; no golpe estica reto na direção do Clawd
function poseDragao(est) {
  const t = (anguloDragao(est) - REP_D) / (ALVO_D - REP_D), neck = NECK_R + (NECK_A - NECK_R) * t;
  return { neck, bend: BEND_R * (1 - t), dir: neck + BEND_R * (1 - t) };
}
// a boca, em pixels da arte (x a partir do meio, y a partir dos pés); dy = quanto o ombro desceu
function bocaArte(est, lean, dy) {
  const p = poseDragao(est), n = p.neck * Math.PI / 180, d = p.dir * Math.PI / 180;
  const hx = OMBRO_D[0] + lean + LN * Math.sin(n), hy = OMBRO_D[1] - dy + LN * Math.cos(n);
  return [hx + R_B * Math.sin(d), hy + R_B * Math.cos(d)];
}
function postura(est) {  // quanto o tronco vai pra frente (negativo = esquerda) e se agacha, em pixels
  const a = est.ataque;
  if (!a) return { lean: 0, agacha: 0 };
  if (a.id === 1) return { lean: -2 * Math.sin(Math.PI * fatia(a.u, 0.1, 0.9)), agacha: 0 };
  const u = a.u, ac = ACERTA[0];
  if (u < ac - 0.14) return { lean: 2.5 * suave(fatia(u, 0.07, ac - 0.14)), agacha: 0 };
  if (u < ac) { const s = fatia(u, ac - 0.14, ac); return { lean: 2.5 - 6 * s, agacha: 6 * s }; }
  const s = fatia(u, ac + 0.1, 0.95);
  return { lean: -3.5 * (1 - s), agacha: 6 * (1 - s) };
}

function desenha(g, J, x, y, est) {
  const pb = J.pb, T = est.T, kn = est.ajoelha, gol = est.golpeado;
  const p = postura(est);
  const respira = kn > 0 ? 0 : Math.floor(0.5 + 0.5 * Math.sin(T * 1.9));
  const lean = p.lean + 1.5 * gol - 3 * kn;
  const dyUp = respira + p.agacha + 8 * kn, dyMid = p.agacha * 0.6 + 4 * kn;
  const X = bx => x + bx * pb, Y = by => y - by * pb;
  const img = corpo();
  const faixa = (sy0, sy1, dx, dy) => tinta(g, img, 'godrick-corpo', est, im => g.drawImage(im, 0, sy0, 44, sy1 - sy0, X(-22 + dx), Y(46 - sy0 - dy), 44 * pb, (sy1 - sy0) * pb));
  faixa(31, 46, 0, 0);
  faixa(20, 31, lean * 0.5, dyMid);
  faixa(0, 20, lean, dyUp);
  // o braço de dragão (à frente) e o machado
  const D = poseDragao(est), phi = abertura(est) * 40 * Math.PI / 180, RAD = Math.PI / 180;
  g.save(); g.translate(X(OMBRO_D[0] + lean), Y(OMBRO_D[1] - dyUp)); g.rotate(D.neck * RAD);
  tinta(g, pescoco(), 'godrick-pescoco', est, im => g.drawImage(im, -5 * pb, -16 * pb, 11 * pb, 22 * pb));
  g.translate(0, -LN * pb); g.rotate(D.bend * RAD); g.rotate(Math.PI / 2);  // a cabeça: focinho pra cima, dorso pra +x
  g.save(); g.translate(-6 * pb, 3 * pb); g.rotate(-phi);  // a mandíbula gira na dobradiça
  tinta(g, mandibula(), 'godrick-mandibula', est, im => g.drawImage(im, -12 * pb, -0.5 * pb, 18 * pb, 4 * pb));
  g.restore();
  tinta(g, crania(), 'godrick-cranio', est, im => g.drawImage(im, -18 * pb, -3.5 * pb, 18 * pb, 7 * pb));
  g.restore();
  // o machado: o braço desce do ombro (alfa), o cabo sai da mão (w) e a cabeça desliza por ele; em pé no chão em repouso
  const M = poseMachado(est), ra = M.alfa * RAD, rw = M.w * RAD;
  const mx = OMBRO[0] + lean + G_M * Math.sin(ra), my = OMBRO[1] - dyUp + G_M * Math.cos(ra) + respira * M.r;
  const d = 7 + 9 * M.r;
  g.save(); g.translate(X(mx), Y(my)); g.rotate(rw);
  haste(g, pb, -(d + 8), 13);
  if (gol > 0) { g.save(); g.globalAlpha *= 0.8 * gol; haste(g, pb, -(d + 8), 13, Math.floor(T * 30) % 2 ? 'rgba(255,255,255,0.9)' : 'rgba(239,68,68,0.85)'); g.restore(); }
  g.restore();
  g.save(); g.translate(X(OMBRO[0] + lean), Y(OMBRO[1] - dyUp)); g.rotate(ra);
  tinta(g, braco(), 'godrick-braco', est, im => g.drawImage(im, -8 * pb, -26 * pb, 16 * pb, 34 * pb));
  g.restore();
  g.save(); g.translate(X(mx), Y(my)); g.rotate(rw);
  tinta(g, lamina(), 'godrick-lamina', est, im => g.drawImage(im, -12 * pb, (-d - 14) * pb, 30 * pb, 28 * pb));
  g.restore();
  // o olhar severo: um fio de luz fria nos olhos
  A.luz(g, X(0 + lean), Y(46 - 7 - dyUp), 2 * pb, 0.2 * (1 - kn), '#BFD9FF');
}

// ---------- efeito ----------
function efeito(g, J, est, x, y) {
  const a = est.ataque;
  if (!a) return;
  const pb = J.pb, tx = J.aqui + 16, u = a.u;
  const p = postura(est), lean = p.lean, dyUp = p.agacha;
  if (a.id === 0) {
    const ac = ACERTA[0];
    if (u < ac - 0.16 || u > ac + 0.45) return;
    const ox = x + (OMBRO[0] + lean) * pb, oy = -(OMBRO[1] - dyUp) * pb;  // o ombro, em DIPs
    // o arco de luz: o rastro do machado do alto atrás até o chão, esmaece pra trás no tempo
    const t0 = Math.max(u - 0.14, ac - 0.14);
    if (u < ac + 0.1) {
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 28; i++) {
        const tt = t0 + (Math.min(u, ac) - t0) * i / 27;
        const s = fatia(tt, ac - 0.14, ac), th = (ATRAS_M + (BATE_M - ATRAS_M) * Math.pow(s, 1.4)) * Math.PI / 180;
        for (const rr of [R_M + 8, R_M + 4, R_M]) {
          g.fillStyle = rgba(rr > R_M + 6 ? '#FFFFFF' : COR.ouroClaro, 0.5 * (i / 27) * (rr > R_M + 6 ? 0.9 : 0.6));
          g.fillRect(Math.round(ox + rr * pb * Math.sin(th)) - 1, Math.round(oy - rr * pb * Math.cos(th)) - 1, 3, 3);
        }
      }
      g.restore();
    }
    if (u < ac) return;
    const s = (u - ac) * 2, ix = x + (OMBRO[0] + lean + R_M * Math.sin(BATE_M * Math.PI / 180)) * pb;
    A.luz(g, ix, -5 * pb, 8 + 7 * pb, 1 - fatia(s, 0, 0.25));
    const frente = ix + (tx - ix) * (1 - Math.pow(1 - fatia(s, 0, 0.45), 2));
    for (let i = 0; i < 10; i++) {  // poeira e pedra voando pelo chão
      const px = frente + i * 7, idade = fatia(s, i * 0.025, 0.7 + i * 0.02);
      if (px > ix + 6 || idade >= 1) continue;
      const h = (4 + 7 * (1 - i / 10)) * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, idade * 1.6))), al = 0.6 * (1 - idade);
      g.fillStyle = rgba('#6E6350', al); g.fillRect(Math.round(px), -h, 6, h);
      g.fillStyle = rgba('#B5A887', al * 0.8); g.fillRect(Math.round(px), -h, 6, 1);
    }
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = rgba(COR.ouroClaro, 0.85 * (1 - fatia(s, 0.3, 0.7))); g.fillRect(Math.round(frente), -2, 16, 2); g.fillRect(Math.round(frente) + 4, -5, 5, 3);
    const r = rng(41);
    for (let i = 0; i < 16; i++) {  // faíscas
      const an = Math.PI * (0.55 + 0.9 * r()), v = (28 + 55 * r()) * pb * 0.5, tt = Math.max(0, s - 0.02);
      const sx = ix + Math.cos(an) * v * tt * 1.4, sy = -4 * pb - Math.sin(an) * v * tt + 70 * tt * tt, vida = 1 - fatia(s, 0.3, 0.9);
      if (sy > 0 || vida <= 0) continue;
      g.fillStyle = rgba(i % 3 ? COR.ouroClaro : '#FFFFFF', vida); g.fillRect(Math.round(sx), Math.round(sy), i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
    }
    g.restore();
    return;
  }
  // cabeça de dragão: jato de fogo em cone da boca até o Clawd
  const ac = ACERTA[1];
  if (u < ac - 0.3 || u > ac + 0.35) return;
  const [bx, by] = bocaArte(est, lean, dyUp), hx = x + bx * pb, hy = -by * pb;
  const ty = -8, dx = tx - hx, dy = ty - hy, L = Math.hypot(dx, dy), nx = -dy / L, ny = dx / L;
  const acende = fatia(u, ac - 0.3, ac - 0.2) * (1 - fatia(u, ac + 0.15, ac + 0.35));
  const frente = L * (1 - Math.pow(1 - fatia(u, ac - 0.25, ac), 2)) + L * 0.15 * fatia(u, ac, ac + 0.15);
  A.luz(g, hx, hy, 8 + 6 * pb, acende, '#FFB347');
  if (frente <= 0 || acende <= 0) return;
  const r = rng(913);
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 70; i++) {
    const q0 = r(), desv = r() - 0.5, cor = r(), q = (q0 + u * 3 + i * 0.013) % 1, d = q * frente;
    const abre = desv * (4 + d * 0.5), px = hx + dx / L * d + nx * abre, py = hy + dy / L * d + ny * abre - Math.sin(q * 3) * 3 * (1 - q);
    if (py > -1) continue;
    const tam = Math.round(2 + 6 * Math.sin(Math.PI * Math.min(1, q * 1.15)) * (1 - 0.3 * Math.abs(desv)));
    const c = q < 0.2 ? '#FFF6C0' : q < 0.45 ? '#FFC24A' : q < 0.75 ? '#F2701D' : '#8A2A12';
    g.fillStyle = rgba(c, acende * (1 - q * 0.55)); g.fillRect(Math.round(px - tam / 2), Math.round(py - tam / 2), tam, tam);
    if (cor < 0.25 && q > 0.1) { g.fillStyle = rgba('#FFE08A', acende * 0.5); g.fillRect(Math.round(px), Math.round(py), 1, 1); }
  }
  g.restore();
  if (u >= ac - 0.02) A.luz(g, tx, ty, 20, acende, '#FF8A2E');
}

module.exports = {
  id: 'godrick', nome: 'GODRICK, O ENXERTADO', nomeEn: 'GODRICK THE GRAFTED', H, W, desenha, efeito,
  ataques: [{ nome: 'machado', acerta: ACERTA[0] }, { nome: 'braço de dragão', acerta: ACERTA[1] }],
  // a luta (elden-epico.js), como no jogo: o machado em COMBO de 2 (o Clawd rola dos dois) e o contra-ataque; o sopro de fogo
  // do dragão (o Clawd corre pra trás e o fogo cai onde ele estava), a volta com 2 golpes e o salto final. Sem apanhar, sem frasco
  luta: {
    ataques: [[0, 2.3, 1.5, 'rola'], [0, 3.8, 1.5, 'rola'], [1, 6.2, 2.2, 'corre']],
    cortes: [[5.4, 0.72], [8.7, 0.45], [9.35, 0.2]],
    final: 10,
  },
};
