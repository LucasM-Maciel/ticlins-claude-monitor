'use strict';
// Tema Elden Ring, chefe MARGIT, O AGOURENTO (contrato de elden-epico.js: { id, nome, H, W, desenha, efeito, ataques }).
// Alto, magro e CURVADO (a corcunda fica atrás, a cabeça vai à frente), dois chifres de osso saindo das têmporas, olhos fundos
// âmbar, cabelo ralo e barba rala grisalhos, costelas à mostra, capa de pele rasgada e uma cauda fina com tufo na ponta. Na mão
// de trás só existe o martelo quando ele o INVOCA (luz dourada); parado, só a bengala nodosa de madeira, cravada no chão.
// Camadas (cada uma pintada UMA vez, em pixels da arte): corpo (cortado em 3 faixas que balançam), bengala, braço da bengala
// e braço + martelo (gira em torno do ombro). Tudo é função de est; o aleatório do efeito sai de rng(semente fixa).
const { tela, tingida, rng, rgba } = require('./comum');
const A = require('./elden-arte');
const { COR, fatia } = A;

const W = 46, H = 48;
const ACERTA = [0.55, 0.6];
const OMBRO = [4, 30];       // ombro do martelo (em cima da corcunda), em pixels da arte (x a partir do meio, y a partir dos pés)
const OMBRO_F = [-10, 26];    // ombro do braço da bengala
const REPOUSO = -135, ALTO = 28;  // ângulos do martelo (graus; 0 = pra cima, negativo = pra frente/esquerda)
const R_MARTELO = 32;        // do ombro ao centro da cabeça do martelo
const L_BRACO = 15;          // do ombro à mão do braço da bengala
const PAL = {
  K: '#0B0907',
  I: '#F1E7CC', i: '#C6B692', j: '#86775A',                        // osso (chifres)
  S: '#B7A596', s: '#9A8878', t: '#73645A', u: '#4B3F39',          // pele cinza-amarronzada
  w: '#DAD6CB', v: '#A39F96', x: '#6E6A64',                        // cabelo e barba
  E: '#FFE066', e: '#FF9A1F',                                      // olhos
  l: '#9C876B', m: '#76634D', n: '#50402F', o: '#33281F',          // pele de animal da capa
  Y: '#8A6A45', W: '#5A3F2A', V: '#33231A',                        // madeira
  g: COR.ouro, G: COR.ouroClaro, r: COR.ouroEsc, f: COR.ouroFundo,  // ouro do martelo
};

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
const hash = (x, y, s = 0) => { let h = (x * 374761393 + y * 668265263 + s * 144665) | 0; h = Math.imul(h ^ (h >>> 13), 1274126177); return ((h ^ (h >>> 16)) >>> 0) % 100; };
const interp = (tab, y) => {
  if (y <= tab[0][0]) return tab[0][1];
  for (let i = 1; i < tab.length; i++) if (y <= tab[i][0]) { const [y0, v0] = tab[i - 1], [y1, v1] = tab[i]; return v0 + (v1 - v0) * (y - y0) / (y1 - y0); }
  return tab[tab.length - 1][1];
};

// o rosto (12 colunas, x=10..21, y=5..18): a luz vem da ESQUERDA/CIMA, o lado direito afunda. Nariz adunco, boca fina, olhos fundos
const ROSTO = [
  '...Sssst....',
  '..SSsssttu..',
  '.SSSsssttuu.',
  '.SSSsssttttu',
  'SuuKKuuuuKKu',
  'SuEeuStueutu',
  'SSttsSsttutu',
  '.SsttSstuttu',
  '.ttuSsstutu.',
  '..tSsstuutu.',
  '...utKtuuu..',
  '....SsKKKtu.',
  '.....Sstu...',
  '......stu...',
];
const ROSTO_X = 10, ROSTO_Y = 5, OLHO_LIN = 10;

// um chifre: linha central (x,y) com largura que afina; 3 tons de osso (luz na esquerda) e anéis de crescimento
function chifre(set, pts, w0) {
  const n = 40;
  for (let k = 0; k <= n; k++) {
    const f = k / n, seg = f * (pts.length - 1), i = Math.min(pts.length - 2, Math.floor(seg)), ff = seg - i;
    const cx = pts[i][0] + (pts[i + 1][0] - pts[i][0]) * ff, cy = pts[i][1] + (pts[i + 1][1] - pts[i][1]) * ff;
    const hw = Math.max(0.35, w0 * (1 - f * 0.85)), anel = k % 7 === 0, luz = k % 7 === 1;
    const xa = Math.round(cx - hw), xb = Math.round(cx + hw);
    for (let x = xa; x <= xb; x++) {
      let c = x === xa ? 'I' : x === xb ? 'j' : 'i';
      if (xa === xb) c = 'i';
      if (anel) c = x === xa ? 'i' : 'j';
      else if (luz && x < xb) c = 'I';
      set(x, Math.round(cy), c);
    }
  }
}

function corpo() {
  return imagem('margit-corpo', W, H, (k, px) => {
    const G = Array.from({ length: H }, () => new Array(W).fill('.'));
    const set = (x, y, c) => { if (x >= 0 && x < W && y >= 0 && y < H) G[y][x] = c; };
    const ret = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };
    // a cauda: fina, sai de baixo da capa, curva pra fora e termina num tufo
    for (let i = 0; i <= 40; i++) { const u = i / 40, x = Math.round(34 + 10 * u), y = Math.round(37 + 8 * u * u); set(x, y, 'u'); set(x, y + 1, 't'); }
    ret(41, 43, 44, 46, 'm'); set(40, 45, 'n'); set(45, 45, 'm'); set(42, 42, 'l'); set(43, 43, 'l'); set(41, 47, 'o'); set(44, 47, 'o'); set(42, 47, 'n');
    // a capa de pele: ESTREITA, cai das costas e da corcunda; rasgada (buracos) e com a barra em tiras compridas de tamanhos diferentes
    const LT = [[8, 24], [13, 21], [20, 19], [44, 20]];
    const RT = [[8, 24], [10, 28], [13, 30], [18, 32], [24, 33], [34, 33], [42, 32], [46, 30]];
    const BURACOS = [[27, 22, 2, 3], [31, 28, 1, 3], [25, 30, 2, 2], [29, 36, 1, 2], [23, 25, 1, 2]];
    for (let y = 8; y < 47; y++) {
      const l = Math.round(interp(LT, y)), r = Math.round(interp(RT, y));
      for (let x = l; x <= r; x++) {
        const tira = Math.floor((x + 2) / 3), TIRAS = [43, 37, 45, 39, 46, 36, 42, 40, 44, 38];
        const fl = TIRAS[tira % 10];
        const bot = (x + 2) % 3 === 0 ? fl - 3 : fl;
        if (y > bot) continue;
        if (y > 18 && hash(x, y, 21) < 4) continue;
        if (BURACOS.some(b => x >= b[0] && x < b[0] + b[2] && y >= b[1] && y < b[1] + b[3])) continue;
        const u = (x - l) / Math.max(1, r - l);
        const q = (1 - u) * 0.3 + (y - 8) / 75 + (hash(x, 0, 6) % 30) / 110 + (hash(x, Math.floor(y / 3), 4) < 22 ? 0.18 : 0);
        let c = q < 0.12 ? 'l' : q < 0.32 ? 'm' : q < 0.56 ? 'n' : 'o';
        if (y >= bot - 1 || x === r) c = 'o';
        set(x, y, c);
      }
    }
    // as pernas finas e os pés descalços
    ret(16, 38, 18, 46, 'u'); ret(16, 38, 16, 46, 't'); ret(22, 38, 24, 46, 'u'); ret(22, 38, 22, 46, 't');
    ret(14, 46, 18, 47, 'u'); ret(21, 46, 26, 47, 'u'); ret(14, 46, 15, 46, 't'); ret(21, 46, 22, 46, 't');
    // o tronco esquálido: ombros estreitos, clavículas, 4 costelas curvas, esterno, barriga funda e osso do quadril
    ret(13, 19, 18, 22, 'u'); ret(13, 19, 13, 22, 'S'); ret(14, 19, 15, 22, 's'); set(16, 20, 't'); set(15, 21, 'u');   // pescoço magro com tendões
    for (let y = 22; y <= 37; y++) {
      const l = y < 24 ? 10 : y < 30 ? 11 : 11 + Math.round((y - 30) * 0.3), r = y < 24 ? 22 : y < 30 ? 21 : 21 - Math.round((y - 30) * 0.3);
      for (let x = l; x <= r; x++) {
        let c = x <= l + 1 ? 'S' : x >= r - 1 ? 'u' : x < (l + r) / 2 ? 's' : 't';
        if (y >= 34) c = x < 16 ? 't' : 'u';
        set(x, y, c);
      }
    }
    for (let x = 12; x <= 20; x++) if (x !== 16) { set(x, 23, x < 16 ? 'S' : 's'); if (Math.abs(x - 16) >= 2) set(x, 24, 'u'); }   // clavículas
    for (let y = 25; y <= 33; y += 2) set(16, y, 't');   // esterno
    for (const y0 of [26, 28, 30, 32]) for (let x = 12; x <= 20; x++) {
      if (x === 16) continue;
      const dy = Math.floor((Math.abs(x - 16) - 1) / 2);
      set(x, y0 + dy, 'u');
      if (x < 16 && G[y0 + dy + 1] && G[y0 + dy + 1][x] !== 'u') set(x, y0 + dy + 1, 'S');
    }
    set(12, 36, 'S'); set(20, 36, 't'); ret(15, 35, 17, 36, 'u'); set(16, 35, 'K');   // quadris e o umbigo fundo
    // a tanga de pelo na cintura (esfiapada)
    for (let y = 37; y <= 42; y++) for (let x = 14; x <= 23; x++) {
      if (y > 41 + (x % 3)) continue;
      set(x, y, y === 37 ? 'o' : (x + y) % 3 === 0 ? 'n' : 'm');
    }
    // a gola de pelo: um tufo no ombro da frente com duas tiras rasgadas penduradas, e a pele jogada no ombro de trás
    const tufo = (cx, cy, rx, ry) => {
      for (let y = cy - ry; y <= cy + ry; y++) for (let x = cx - rx; x <= cx + rx; x++) {
        const d = ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2;
        if (d > 1 + (hash(x, y, 2) < 40 ? 0.35 : 0)) continue;
        const q = (x - cx) / rx * 0.5 + (y - cy) / ry * 0.6 + (hash(x, y, 3) % 30) / 80;
        set(x, y, q < -0.35 ? 'l' : q < 0.15 ? 'm' : q < 0.6 ? 'n' : 'o');
      }
    };
    tufo(10, 23, 3, 2); tufo(22, 22, 3, 2);
    for (const [x, len] of [[8, 9], [10, 13], [11, 7]]) for (let y = 24; y < 24 + len; y++) set(x, y, y > 24 + len - 3 ? 'o' : (x + y) % 3 ? 'n' : 'm');
    // o cabelo ralo em FIOS de 1 px: mechas finas alternando 3 tons de branco/cinza, pontas desfiadas
    const fio = (x, y0, len, claro) => {
      const tons = claro ? ['w', 'w', 'v', 'w'] : ['v', 'x', 'v', 'w'];
      for (let y = y0; y < y0 + len; y++) {
        const fim = y0 + len - y;
        if (fim <= 2 && hash(x, y, 5) < 55) continue;
        let c = tons[(hash(x, 0, 3) + (y >> 2)) % 4];
        if (hash(x, y, 9) < 14) c = 'x';
        set(x, y, c);
      }
    };
    [[8, 9, 18, 1], [9, 7, 22, 1]].forEach(([x, y0, len, c]) => fio(x, y0, len, c));
    [[22, 8, 16, 0], [23, 9, 20, 0]].forEach(([x, y0, len, c]) => fio(x, y0, len, c));
    for (const x of [14, 16, 18]) fio(x, 4, 2 + hash(x, 1) % 2, 1);   // restos de cabelo no alto do crânio
    // a cabeça: rosto assimétrico
    ROSTO.forEach((l, i) => { for (let j = 0; j < l.length; j++) if (l[j] !== '.') set(ROSTO_X + j, ROSTO_Y + i, l[j]); });
    // os chifres de osso (volume em 3 tons, anéis)
    chifre(set, [[10, 8], [8, 7], [6, 5], [5, 3], [5, 1]], 1.7);
    chifre(set, [[21, 8], [23, 7], [25, 5], [26, 3], [26, 1]], 1.7);
    // a barba rala em fios, comprida até o peito (a ponta fica acima das costelas, só o meio chega a 1-2 costelas)
    for (let x = 12; x <= 20; x++) {
      const d = Math.abs(x - 16.5);
      const ini = d >= 3.5 ? 16 : d >= 2.6 ? 17 : 18;
      const fim = Math.round(26 - d * 1.6) + hash(x, 1, 6) % 4 - 1;
      for (let y = ini; y <= fim; y++) {
        const ponta = fim - y;
        if (ponta <= 2 && hash(x, y, 7) < 50) continue;
        if (hash(x, y, 12) < 7 && y > ini + 3) continue;   // rala: falhas
        let c = ['w', 'v', 'w', 'x'][(hash(x, 0, 4) + (y >> 2)) % 4];
        if (x < 15 && c === 'x') c = 'v';
        if (hash(x, y, 8) < 16) c = c === 'w' ? 'v' : 'x';
        set(x, y, c);
      }
    }
    // o contorno escuro por fora de tudo e entre a pele e a capa
    const cheio = (x, y) => y >= 0 && y < H && x >= 0 && x < W && G[y][x] !== '.' && G[y][x] !== 'K';
    const K = [];
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (G[y][x] === '.' && (cheio(x - 1, y) || cheio(x + 1, y) || cheio(x, y - 1) || cheio(x, y + 1))) K.push([x, y]);
    K.forEach(([x, y]) => { G[y][x] = 'K'; });
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) { const c = PAL[G[y][x]]; if (c) px(x, y, 1, 1, c); }
  });
}

// a bengala nodosa de madeira escura, com a ponta clara de osso
function bengala() {
  return imagem('margit-bengala', 7, 42, (k, px) => {
    px(1, 8, 5, 34, PAL.K); px(2, 8, 3, 33, PAL.W); px(2, 8, 1, 33, PAL.Y); px(4, 8, 1, 33, PAL.V);
    for (const y of [14, 24, 33]) { px(1, y, 5, 3, PAL.K); px(2, y, 3, 2, PAL.W); px(2, y, 1, 1, PAL.Y); px(4, y + 1, 1, 1, PAL.V); }
    px(2, 16, 1, 1, PAL.V); px(3, 28, 1, 1, PAL.V); px(3, 20, 1, 1, PAL.Y);
    px(3, 41, 1, 1, PAL.K);
    // a ponta: um nó de osso com uma fenda
    px(0, 1, 7, 8, PAL.K); px(1, 0, 5, 1, PAL.K); px(1, 2, 5, 6, PAL.i); px(1, 2, 2, 5, PAL.I); px(5, 3, 1, 4, PAL.j);
    px(3, 1, 1, 3, PAL.K); px(1, 7, 5, 1, PAL.j); px(2, 1, 1, 1, PAL.I); px(4, 1, 1, 1, PAL.i);
  });
}
// braço magro da bengala: o pivô é o ombro (embaixo), a mão fica no alto
function bracoF() {
  return imagem('margit-bracoF', 6, 18, (k, px) => {
    px(1, 4, 4, 11, PAL.K); px(2, 4, 2, 11, PAL.u); px(2, 4, 1, 11, PAL.t);
    px(0, 0, 6, 5, PAL.K); px(1, 1, 4, 3, PAL.s); px(1, 1, 4, 1, PAL.S); px(4, 2, 1, 2, PAL.t); px(1, 4, 4, 1, PAL.u);
    px(1, 3, 1, 2, PAL.K); px(3, 3, 1, 2, PAL.K);   // os dedos
    px(0, 8, 6, 4, PAL.K); px(1, 8, 4, 3, PAL.s); px(1, 8, 2, 1, PAL.S); px(3, 10, 2, 1, PAL.u); px(4, 9, 1, 1, PAL.t);  // o cotovelo marcado
    px(0, 14, 6, 4, PAL.K); px(1, 14, 4, 3, PAL.m); px(1, 14, 2, 1, PAL.l); px(3, 16, 2, 1, PAL.n);  // o punho de pele
  });
}
// braço + martelo: pivô no ombro, a haste sobe; a cabeça (18x11, pontas mais altas) fica no topo
function martelo() {
  return imagem('margit-martelo', 20, 43, (k, px) => {
    px(9, 10, 3, 33, PAL.K); px(10, 10, 1, 32, PAL.r); px(11, 10, 1, 31, PAL.f); px(10, 11, 1, 12, PAL.g);
    px(9, 40, 3, 2, PAL.K); px(10, 40, 1, 1, PAL.G);  // o pomo
    for (let y = 0; y < 11; y++) for (let x = 1; x < 19; x++) {
      const ponta = x <= 3 || x >= 16, dentro = ponta ? true : y >= 1 && y <= 9;
      if (!dentro) continue;
      const topo = ponta ? 0 : 1, base = ponta ? 10 : 9;
      let c;
      if (y === topo || y === base || x === 1 || x === 18) c = PAL.K;
      else if (y === topo + 1) c = PAL.G;
      else if (y <= topo + 3) c = PAL.g;
      else if (y <= base - 3) c = PAL.r;
      else c = PAL.f;
      if (ponta && c !== PAL.K && c !== PAL.G) c = c === PAL.g ? PAL.r : c === PAL.r ? PAL.f : c;
      px(x, y, 1, 1, c);
    }
    px(8, 2, 4, 1, PAL.G); px(8, 5, 4, 2, PAL.G); px(9, 5, 2, 1, '#FFF4C2');  // a faixa e o brilho do meio
    px(2, 4, 1, 1, PAL.G); px(17, 4, 1, 1, PAL.r); px(2, 7, 1, 1, PAL.g); px(17, 7, 1, 1, PAL.f);  // rebites
    // o braço magro de pele segurando a haste, com o punho de pelo
    px(7, 27, 6, 11, PAL.K); px(8, 27, 4, 11, PAL.u); px(8, 27, 1, 11, PAL.t);
    px(6, 31, 8, 4, PAL.K); px(7, 31, 6, 3, PAL.s); px(7, 31, 3, 1, PAL.S); px(10, 33, 3, 1, PAL.u);  // o cotovelo
    px(7, 25, 6, 5, PAL.K); px(8, 26, 4, 3, PAL.s); px(8, 26, 4, 1, PAL.S); px(11, 27, 1, 2, PAL.t);
    px(6, 36, 8, 4, PAL.K); px(7, 36, 6, 3, PAL.m); px(7, 36, 3, 1, PAL.l); px(10, 38, 3, 1, PAL.n);
  });
}
function adaga() {  // aponta pra esquerda
  return imagem('margit-adaga', 11, 3, (k, px) => {
    px(0, 1, 8, 1, '#FFFFFF'); px(1, 0, 6, 1, PAL.G); px(1, 2, 6, 1, PAL.g); px(2, 1, 5, 1, '#FFF4C2');
    px(8, 0, 1, 3, PAL.r); px(9, 1, 2, 1, PAL.f);
  });
}

// ---------- pintura com a camada tingida quando apanha ----------
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

// ---------- o estado do corpo ----------
function anguloMartelo(est) {
  const a = est.ataque;
  if (est.ajoelha > 0) return REPOUSO + (-112 - REPOUSO) * est.ajoelha;
  if (!a || a.id !== 0) return REPOUSO;
  const u = a.u, ac = ACERTA[0];
  if (u < 0.08) return REPOUSO - 6 * Math.sin(Math.PI * fatia(u, 0, 0.08));  // encolhe antes de erguer
  if (u < ac - 0.12) return REPOUSO + (ALTO - REPOUSO) * suave(fatia(u, 0.08, ac - 0.12));
  if (u < ac) { const s = fatia(u, ac - 0.12, ac); return ALTO + (REPOUSO - ALTO) * s * s; }
  return REPOUSO - 7 * Math.sin(Math.PI * fatia(u, ac, ac + 0.2));  // quica no chão
}
// o martelo é de luz: só existe quando ele o invoca (surge no começo do ataque e se desfaz depois do golpe)
function visMartelo(est) {
  const a = est.ataque;
  if (est.ajoelha > 0 || !a || a.id !== 0) return 0;
  return fatia(a.u, 0, 0.1) * (1 - fatia(a.u, ACERTA[0] + 0.22, ACERTA[0] + 0.42));
}
function anguloBengala(est) {
  const a = est.ataque, REP = -160;
  if (est.ajoelha > 0) return REP;
  if (!a || a.id !== 1) return REP;
  const u = a.u, ac = ACERTA[1];
  if (u < 0.1) return REP;
  if (u < ac - 0.32) return REP + 78 * suave(fatia(u, 0.1, ac - 0.32));
  if (u < ac + 0.05) return REP + 78;
  return REP + 78 * (1 - suave(fatia(u, ac + 0.05, ac + 0.35)));
}
function inclina(est) {  // quanto o tronco vai pra frente (negativo = esquerda) em pixels
  const a = est.ataque;
  if (!a || a.id !== 0) return a && a.id === 1 ? -1.2 * Math.sin(Math.PI * fatia(a.u, 0.1, 0.85)) : 0;
  const u = a.u, ac = ACERTA[0];
  if (u < ac - 0.12) return 2 * suave(fatia(u, 0.08, ac - 0.12));
  if (u < ac) return 2 - 5 * fatia(u, ac - 0.12, ac);
  return -3 * (1 - fatia(u, ac + 0.1, 0.95));
}

function desenha(g, J, x, y, est) {
  const pb = J.pb, T = est.T;
  const kn = est.ajoelha, gol = est.golpeado;
  const respira = kn > 0 ? 0 : Math.floor(0.5 + 0.5 * Math.sin(T * 2.2));  // sobe 1 px e desce
  const recuo = 1.5 * gol;
  const lean = inclina(est) + recuo - 3 * kn;
  const dyUp = respira + 8 * kn, dyMid = 4 * kn;
  const sway = kn > 0 ? 0 : Math.round(Math.sin(T * 1.6));
  const X = bx => x + bx * pb, Y = by => y - by * pb;
  const corpoImg = corpo();
  // faixas do corpo: barra (38..48), meio (26..38), alto (0..26), de baixo pra cima
  const faixa = (sy0, sy1, dx, dy) => tinta(g, corpoImg, 'margit-corpo', est, im => g.drawImage(im, 0, sy0, W, sy1 - sy0, X(-W / 2 + dx), Y(H - sy0 - dy), W * pb, (sy1 - sy0) * pb));
  // a bengala fica cravada no chão, à frente
  const beng = bengala();
  tinta(g, beng, 'margit-bengala', est, im => { const cort = Math.round(10 * kn); g.drawImage(im, 0, cort, 7, 42 - cort, X(-19 + lean * 0.2), Y(42 - cort), 7 * pb, (42 - cort) * pb); });
  faixa(38, 48, sway * 0.5 + recuo * 0.2, 0);
  faixa(26, 38, lean * 0.5, dyMid);
  faixa(0, 26, lean, dyUp);
  // o brilho dos olhos fundos
  const pisca = 0.75 + 0.25 * Math.sin(T * 7);
  const ey = H - OLHO_LIN - 0.5 - dyUp;
  for (const [ex, rr] of [[-10, 2.2], [-4.5, 1.7]]) A.luz(g, X(ex + lean), Y(ey), rr * pb, 0.45 * pisca * (1 - kn * 0.7), '#FFB830');
  // o braço da bengala
  const bf = bracoF(), thF = anguloBengala(est) * Math.PI / 180;
  g.save(); g.translate(X(OMBRO_F[0] + lean), Y(OMBRO_F[1] - dyUp)); g.rotate(thF);
  tinta(g, bf, 'margit-bracoF', est, im => g.drawImage(im, -3 * pb, -17 * pb, 6 * pb, 18 * pb));
  g.restore();
  // o martelo de luz
  const vis = visMartelo(est);
  if (vis > 0) {
    const mi = martelo(), th = anguloMartelo(est) * Math.PI / 180;
    g.save(); g.globalAlpha *= 0.94 * vis; g.translate(X(OMBRO[0] + lean), Y(OMBRO[1] - dyUp)); g.rotate(th);
    tinta(g, mi, 'margit-martelo', est, im => g.drawImage(im, -10 * pb, -37 * pb, 20 * pb, 43 * pb));
    g.restore();
    const cx = X(OMBRO[0] + lean) + R_MARTELO * pb * Math.sin(th), cy = Y(OMBRO[1] - dyUp) - R_MARTELO * pb * Math.cos(th);
    A.luz(g, cx, cy, 9 * pb, 0.55 * vis);
  }
}

// ---------- o efeito (por cima do chefe) ----------
function maoDaBengala(J, x, est, lean) {  // onde fica a mão aberta, em DIPs
  const th = anguloBengala(est) * Math.PI / 180, pb = J.pb;
  return [x + (OMBRO_F[0] + lean + L_BRACO * Math.sin(th)) * pb, -(OMBRO_F[1] + L_BRACO * Math.cos(th)) * pb];
}
function efeito(g, J, est, x, y) {
  const a = est.ataque;
  if (!a) return;
  const pb = J.pb, tx = J.aqui + 16, ty = -10, u = a.u;
  if (a.id === 0) {
    const ac = ACERTA[0];
    if (u < ac - 0.02 || u > ac + 0.45) return;
    const s = (u - ac) * 2;                // segundos desde o impacto
    const ix = x + (OMBRO[0] + R_MARTELO * Math.sin(REPOUSO * Math.PI / 180)) * pb;  // onde o martelo cai
    const alvoX = tx;
    A.luz(g, ix, -4 * pb, 8 + 8 * pb, 1 - fatia(s, 0, 0.22));
    const frente = ix + (alvoX - ix) * (1 - Math.pow(1 - fatia(s, 0, 0.45), 2));
    // poeira correndo pelo chão, mais alta perto da frente da onda
    for (let i = 0; i < 10; i++) {
      const px = frente + i * 7, idade = fatia(s, i * 0.025, 0.7 + i * 0.02);
      if (px > ix + 6 || idade >= 1) continue;
      const h = (4 + 7 * (1 - i / 10)) * (0.5 + 0.5 * Math.sin(Math.PI * Math.min(1, idade * 1.6))), al = 0.6 * (1 - idade);
      g.fillStyle = rgba('#8A7650', al); g.fillRect(Math.round(px), -h, 6, h);
      g.fillStyle = rgba('#CDB27A', al * 0.8); g.fillRect(Math.round(px), -h, 6, 1);
    }
    g.save(); g.globalCompositeOperation = 'lighter';  // a crista dourada da onda
    g.fillStyle = rgba(COR.ouroClaro, 0.8 * (1 - fatia(s, 0.3, 0.7))); g.fillRect(Math.round(frente), -2, 14, 2); g.fillRect(Math.round(frente) + 4, -5, 5, 3);
    // as faíscas douradas saltando do impacto
    const r = rng(77);
    for (let i = 0; i < 18; i++) {
      const ang = Math.PI * (0.55 + 0.9 * r()), v = (30 + 60 * r()) * pb * 0.5, tt = Math.max(0, s - 0.02);
      const sx = ix + Math.cos(ang) * v * tt * (r() < 0.6 ? 1.6 : 0.6), sy = -4 * pb - Math.sin(ang) * v * tt + 70 * tt * tt;
      const vida = 1 - fatia(s, 0.3, 0.9);
      if (sy > 0 || vida <= 0) continue;
      g.fillStyle = rgba(i % 3 ? COR.ouroClaro : '#FFFFFF', vida); g.fillRect(Math.round(sx), Math.round(sy), i % 4 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1);
    }
    // colunas de luz brotando do chão onde o Clawd rola
    const bro = fatia(s, 0.18, 0.7), alt = Math.sin(Math.PI * bro);
    if (bro > 0 && bro < 1) for (let i = -2; i <= 2; i++) {
      const h = Math.round((10 + 12 * (1 - Math.abs(i) / 3)) * alt);
      g.fillStyle = rgba(COR.ouroClaro, 0.5 * alt); g.fillRect(Math.round(tx + i * 6 - 1), -h, 3, h);
      g.fillStyle = rgba('#FFFFFF', 0.5 * alt); g.fillRect(Math.round(tx + i * 6), -h, 1, h);
    }
    g.restore();
    return;
  }
  // adagas de luz: abrem em leque na mão e cruzam o palco até o Clawd
  const ac = ACERTA[1], N = 5;
  if (u < ac - 0.5 || u > ac + 0.3) return;
  const lean = inclina(est), [hx, hy] = maoDaBengala(J, x, est, lean);
  const carga = fatia(u, ac - 0.5, ac - 0.32), brilho = carga * (1 - fatia(u, ac - 0.3, ac + 0.1));
  A.luz(g, hx, hy, 6 + 8 * pb, brilho);
  const img = adaga(), esc = Math.min(pb, 2);
  for (let i = 0; i < N; i++) {
    const phi = (i - (N - 1) / 2) * 0.42;
    const sx = hx - Math.cos(phi) * 14 * pb * 0.6, sy = hy - Math.sin(phi) * 14 * pb * 0.6;
    const lanca = ac - 0.3 + i * 0.012, voo = fatia(u, lanca, ac + 0.015 * i);
    const pos = s2 => {
      const e = s2 * s2 * (0.4 + 0.6 * s2), px = sx + (tx - sx) * e, py = sy + (ty - sy) * e;
      const dist = Math.hypot(tx - sx, ty - sy), b = Math.sin(Math.PI * s2) * phi * dist * 0.45;
      return [px, py + b];
    };
    if (u < lanca) {  // ainda no ar da mão: surgem aos poucos
      const [px, py] = [sx, sy];
      g.save(); g.globalAlpha *= carga; g.translate(px, py); g.rotate(phi * 0.6);
      g.drawImage(img, -5.5 * esc, -1.5 * esc, 11 * esc, 3 * esc); g.restore();
      continue;
    }
    if (voo >= 1) continue;
    const [px, py] = pos(voo), [qx, qy] = pos(Math.min(1, voo + 0.04));
    const ang = Math.atan2(qy - py, qx - px) - Math.PI;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let k = 1; k <= 4; k++) {  // o rastro
      const [rx, ry] = pos(Math.max(0, voo - k * 0.03));
      g.fillStyle = rgba(COR.ouroClaro, 0.35 / k); g.fillRect(Math.round(rx - 2), Math.round(ry - 1), 4, 2);
    }
    g.restore();
    g.save(); g.translate(px, py); g.rotate(ang);
    g.drawImage(img, -5.5 * esc, -1.5 * esc, 11 * esc, 3 * esc); g.restore();
    g.save(); g.globalCompositeOperation = 'lighter';  // o brilho em volta: dois retângulos (gradiente por adaga custava caro)
    g.fillStyle = rgba(COR.ouroClaro, 0.22); g.fillRect(Math.round(px - 5), Math.round(py - 4), 10, 8);
    g.fillStyle = rgba('#FFFFFF', 0.25); g.fillRect(Math.round(px - 2), Math.round(py - 1), 4, 2);
    g.restore();
  }
  if (u >= ac && u < ac + 0.15) A.luz(g, tx, ty, 18, 1 - fatia(u, ac, ac + 0.15));
}

module.exports = {
  id: 'margit', nome: 'MARGIT, O AGOURENTO', nomeEn: 'MARGIT, THE FELL OMEN', H, W, desenha, efeito,
  ataques: [{ nome: 'martelo', acerta: ACERTA[0] }, { nome: 'adagas de luz', acerta: ACERTA[1] }],
  // a luta (elden-epico.js), como no jogo: o martelo ATRASADO pega quem rola cedo, então o Clawd espera em guarda e rola no
  // último instante; as adagas de luz o acertam; o frasco; o Grilhão de Margit prende o Margit de joelhos pra 2 golpes; o
  // martelo rápido, o rolamento e o salto final
  luta: {
    ataques: [[0, 2.3, 2.6, 'rolaTarde'], [1, 5.0, 1.6, 'apanha'], [0, 10.45, 1.3, 'rola']],
    cortes: [[4.05, 0.75], [8.55, 0.5], [9.2, 0.28]],
    frasco: 6.7, grilhao: 7.7, final: 11.5,
  },
};
