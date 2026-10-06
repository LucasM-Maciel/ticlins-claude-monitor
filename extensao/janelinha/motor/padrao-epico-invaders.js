'use strict';
// Evento épico raro do tema Padrão (a cada 25 bugs pisados), candidata "invaders" (~19 s):
// homenagem ao conceito do Space Invaders, desenho nosso. A área acima do cartão vira a tela
// de um fliperama (liga como TV de tubo) e a borda de cima do cartão, o chão verde; o Clawd
// ganha um canhão na cabeça e enfrenta 18 bugs do Padrão em formação, que marcham em passos
// (mais rápido a cada baixa) e soltam bombas em zigue-zague, atrás de 4 escudos { } que os
// tiros dos dois lados vão comendo. A nave do Bug-rei atravessa o topo (tiro difícil, "?" e
// 300); sobra o último bug, que dispara, desce até a pista de baixo cavando os escudos, e o
// Clawd acerta no último instante. ✓ CLEAR, a tela desliga e o Clawd volta pro lugar.
//
// Tudo é pré-calculado na cena(m), pela semente: a marcha passo a passo, cada tiro (de onde,
// quando e em quem bate), cada bomba (sempre passando raspando pelo Clawd), o caminho dele e
// o que cada impacto come dos escudos. O quadro só consulta essas listas: é função de t.
// Coordenadas do jogo: DIPs a partir do canto de cima à esquerda do cartão (X pra direita,
// Y- pra cima, chão = 0 = borda de cima do cartão); o quadro soma o cartão de agora.
const { lim, sai, entra, tela, cache, arte, tingida, rng } = require('./comum');
const { desenhaClawd, andando } = require('./clawd');

// ---------- medidas (DIPs) e ritmo (s) ----------
const PB = 1.6, BW = 13 * PB, BH = 8 * PB;      // o bug do Padrão: 13x8 pixels de 1,6
const P = 1.5;                                   // o pixel do Clawd: escudos, letras, canhão, tiros
const COLS = 6, FILAS = 3, DXF = 28, DYF = 19;   // a formação: 3 fileiras de 6
const MARG = 5;                                  // da borda da tela até onde o jogo vai
const EW = 14 * P, EH = 11 * P, ESC_Y = -26 - EH;  // escudo { } de 14x11 pixels; a base fica 26 acima do chão
const PONTA = -21;                               // a ponta do canhão: onde o tiro nasce
const LIM_BASE = -49, PISTA = -27;               // até onde desce a base da formação / a do último bug
const VS = 330, VB = 95, VMAX = 105;             // tiro, bomba, Clawd deslizando (média)
const RECUO = 0.12, CHEGA = 0.03;                // o Clawd fica parado no tiro e chega um pouco antes do próximo
const LIGA = 0.45, CAI = [0.5, 0.82], SURGE = 1.0, SURGE_DT = 0.06, MARCHA = 2.25, FOGO = 2.55;
const CHEFE = { ida: 6.9, dur: 3.4, tiro: 7.5 };
const PAUSA = 0.45;                              // o último bug parado, antes de disparar
const RW = 22 * PB, RH = 12 * PB;                // a nave do Bug-rei

const linhaDoTempo = [
  [0, 'a tela do fliperama liga e o chão acende'], [0.5, 'o canhão cai na cabeça do Clawd'],
  [1.0, '18 bugs se materializam em formação'], [2.25, 'a formação marcha; o Clawd atira e desvia das bombas'],
  [4.5, 'o Clawd cava um buraco num escudo e atira por ele'], [6.9, 'a nave do Bug-rei atravessa o topo'],
  [8.5, 'tiro difícil: a nave explode, ? e 300'], [11.5, 'sobra o último bug: corre e desce até a pista de baixo'],
  [14.3, 'acerto no último instante'], [15.0, '✓ CLEAR pisca e o Clawd comemora'],
  [16.8, 'a tela desliga e o Clawd volta pro lugar dele'],
];

// ---------- desenhos ----------
// o bug do Padrão (tema-padrao.js), de cabeça e pernas claras (o preto dele some na tela
// escura); uma cor por fileira, e a elite (fileira de cima) com 2 antenas de ponta acesa
const BUG = ['a............', '.a...vvvvv...', '..a.vwwvvvvv.', '.aaavwvvxvvvv', 'aoaavvvvvxvvv', '.aaaavvvvvxv.', '..pq..pq..pq.', '.p..qp..qp..q'];
const ELITE = ['y..y.........', '.a.a.vvvvv...', '..aavwwvvvvv.', '.aaavwvvxvvvv', 'aoaavvvvvxvvv', '.aaaavvvvvxv.', '..pq..pq..pq.', '.p..qp..qp..q'];
const COR_FILA = [
  { v: '#A855F7', w: '#D8B4FE', x: '#6B21A8', a: '#DDD6FE', o: '#1E1B4B', y: '#FDE047', p: '#DDD6FE', q: '#DDD6FE' },  // 30
  { v: '#3B82F6', w: '#93C5FD', x: '#1E3A8A', a: '#BFDBFE', o: '#172554', p: '#BFDBFE', q: '#BFDBFE' },               // 20
  { v: '#65A30D', w: '#A3E635', x: '#365314', a: '#D9F99D', o: '#1A2E05', p: '#D9F99D', q: '#D9F99D' },               // 10
];
const COR_V = { v: '#EF4444', w: '#FCA5A5', x: '#991B1B', a: '#FECACA', o: '#450A0A', y: '#FECACA', p: '#FECACA', q: '#FECACA' };
const PTS = [30, 20, 10];
// o Bug-rei: o bug de coroa numa navezinha (luzes que piscam: L e M trocam de cor)
const REI = [
  '...........y.y.y......',
  '...........yryry......',
  '..a.......vvvvvvv.....',
  '...a.....vwwvvvvvv....',
  '..aaa...vwwvvvvxvvv...',
  '.aoaaa..vvvvvvvvxvv...',
  '..aaaaavvvvvvvvvvxv...',
  '...sssssssssssssssss..',
  '.ssLssMssLssMssLssMss.',
  'ssssssssssssssssssssss',
  '..dddddddddddddddddd..',
  '.....dd........dd.....',
];
const COR_REI = { y: '#FACC15', r: '#EF4444', v: '#65A30D', w: '#A3E635', x: '#365314', a: '#D9F99D', o: '#1A2E05', s: '#9CA3AF', d: '#52525B' };
// escudo { }: as chaves de código, em verde de fliperama
const ESCUDO = ['...###..###...', '..####..####..', '..##......##..', '..##......##..', '.###......###.', '###........###', '.###......###.', '..##......##..', '..##......##..', '..####..####..', '...###..###...'];
const CANHAO = ['..w..', '..g..', '.ggg.', 'ddddd'];
const COR_CANHAO = { w: '#F3F4F6', g: '#9CA3AF', d: '#52525B' };
const BOMBA = [['.#.', '#..', '.#.', '..#', '.#.', '#..', '.#.'], ['.#.', '..#', '.#.', '#..', '.#.', '..#', '.#.']];
const VISTO = ['..............###', '.............####', '............####.', '...........####..', '##........####...', '###......####....', '####....####.....', '.####..####......', '..########.......', '...######........', '....####.........', '.....##..........'];
// fonte de 3x5, só o que aparece: SCORE, CLEAR, números, ? e !
const FONTE = {
  0: ['###', '#.#', '#.#', '#.#', '###'], 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'],
  3: ['###', '..#', '.##', '..#', '###'], 4: ['#.#', '#.#', '###', '..#', '..#'], 5: ['###', '#..', '###', '..#', '###'],
  6: ['###', '#..', '###', '#.#', '###'], 7: ['###', '..#', '..#', '.#.', '.#.'], 8: ['###', '#.#', '###', '#.#', '###'],
  9: ['###', '#.#', '###', '..#', '###'], S: ['.##', '#..', '.#.', '..#', '##.'], C: ['.##', '#..', '#..', '#..', '.##'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'], R: ['##.', '#.#', '##.', '#.#', '#.#'], E: ['###', '#..', '##.', '#..', '###'],
  L: ['#..', '#..', '#..', '#..', '###'], A: ['.#.', '#.#', '###', '#.#', '#.#'], '?': ['##.', '..#', '.#.', '...', '.#.'],
  '!': ['#', '#', '#', '.', '#'],
};
const espelha = L => L.map(l => [...l].reverse().join(''));
function textoArte(txt, cor) {
  const L = ['', '', '', '', ''];
  [...txt].forEach((ch, k) => { const f = FONTE[ch]; for (let y = 0; y < 5; y++) L[y] += (k ? '.' : '') + f[y]; });
  return arte(L, { '#': cor });
}
// bug pronto: fila (0 elite), perna (0/1), olhando pra direita, vermelho (acertado)
function bugArte(fila, perna, dir, verm) {
  let L = (fila === 0 ? ELITE : BUG).map(l => l.replace(perna ? /p/g : /q/g, '.'));
  if (dir) L = espelha(L);
  return arte(L, verm ? COR_V : COR_FILA[fila]);
}
function reiArte(luz, dir) {
  const L = dir ? espelha(REI) : REI;  // o desenho olha pra esquerda: indo pra direita, espelha
  const cor = { ...COR_REI, L: luz ? '#FACC15' : '#F472B6', M: luz ? '#F472B6' : '#FACC15' };
  return arte(L, cor);
}

// ---------- o plano ----------
function montar(m, r) {
  const c = m.host.cartao || [104, 264, 242, 142], casa = m.pose();
  const cw = c[2], HJ = Math.round(lim(c[1] - 14, 112, 184));
  const J = { cw, HJ, X0: casa.x - c[0], L: MARG, R: cw - MARG, xMin: MARG + 15, xMax: cw - MARG - 15 };
  const fx = Math.round((cw - ((COLS - 1) * DXF + BW)) / 2), fy = -HJ + 40;
  J.bugs = [];
  for (let f = 0; f < FILAS; f++) {
    for (let k = 0; k < COLS; k++) J.bugs.push({ f, col: k, x: fx + k * DXF, y: fy + f * DYF, surge: SURGE + ((FILAS - 1 - f) * COLS + k) * SURGE_DT, morte: Infinity });
  }
  const n = cw >= 200 ? 4 : 3, folga = (cw - 2 * MARG - n * EW) / (n + 1);
  J.escudos = Array.from({ length: n }, (_, i) => {
    const morte = new Float64Array(14 * 11).fill(-1);  // -1: não tem pixel; Infinity: inteiro; t: comido em t
    ESCUDO.forEach((l, y) => { for (let x = 0; x < 14; x++) if (l[x] === '#') morte[y * 14 + x] = Infinity; });
    return { x: Math.round(MARG + folga + i * (EW + folga)), y: ESC_Y, morte };
  });
  // os vãos entre os escudos: onde o Clawd espera um bug passar quando não dá pra mirar
  J.vaos = Array.from({ length: n + 1 }, (_, i) => lim(Math.round(MARG + folga / 2 + i * (EW + folga)), J.xMin, J.xMax));
  J.dir0 = r() < 0.5 ? 1 : -1;
  const daEsq = r() < 0.5;  // a nave entra por um lado e sai pelo outro
  J.chefe = { x0: daEsq ? -RW : cw, x1: daEsq ? cw : -RW, y: -HJ + 15, dir: daEsq ? 1 : -1, morte: Infinity };
  return J;
}

// a marcha: passos de 3,2 (2 pixels do bug), mais rápidos com menos bugs; na borda desce 8 e
// inverte (até LIM_BASE). O último bug (ult): parado até ult.t0, depois corre pra borda mais
// perto em passos de 4,8 a cada 0,02 s, e na borda desce ult.dl em passos de 4,8 (até a PISTA)
function marcha(J, ult, fim) {
  const B = J.bugs, n = B.length, M = { ts: [MARCHA], ox: [0], oy: [0], dir: [J.dir0] };
  let t = MARCHA, x = 0, y = 0, d = J.dir0, falta = 0;
  const conta = tt => { let c = 0; for (let i = 0; i < n; i++) if (B[i].morte > tt) c++; return c; };
  while (t < fim) {
    const v0 = conta(t);
    if (!v0) break;
    let tn = t + (v0 > 1 ? 0.07 + 0.15 * (v0 - 2) / 16 : ult ? 0.02 : 0.07);
    const v1 = conta(tn);
    if (!v1) break;
    const so = v1 === 1 && ult;
    if (so && tn <= ult.t0) {  // dispara pra borda mais perto
      tn = ult.t0;
      const b = B.find(q => q.morte > tn);
      d = b.x + x - J.L < J.R - (b.x + x + BW) ? -1 : 1;
    }
    const passo = so ? 4.8 : 3.2;
    if (falta > 0) {
      const k = Math.min(falta, 4.8);
      y += k; falta -= k;
      if (falta < 1e-9) { falta = 0; d = -d; }
    } else {
      let x0 = Infinity, x1 = -Infinity, base = -Infinity;
      for (let i = 0; i < n; i++) if (B[i].morte > tn) { x0 = Math.min(x0, B[i].x); x1 = Math.max(x1, B[i].x + BW); base = Math.max(base, B[i].y + BH); }
      if ((d > 0 && x1 + x + passo > J.R) || (d < 0 && x0 + x - passo < J.L)) {
        const desce = Math.max(0, Math.min(so ? ult.dl : 8, (so ? PISTA : LIM_BASE) - base - y));
        if (so && desce > 4.8) { y += 4.8; falta = desce - 4.8; } else { y += desce; d = -d; }
      } else x += d * passo;
    }
    t = tn;
    M.ts.push(t); M.ox.push(x); M.oy.push(y); M.dir.push(d);
  }
  return M;
}
// o último passo em t (0 antes de a marcha começar)
function passoEm(M, t) {
  const ts = M.ts;
  if (t < ts[0]) return 0;
  let a = 0, b = ts.length - 1;
  while (a < b) { const k = (a + b + 1) >> 1; if (ts[k] <= t) a = k; else b = k - 1; }
  return a;
}
function chefeEm(J, t) {
  const c = J.chefe;
  if (t < CHEFE.ida || t >= CHEFE.ida + CHEFE.dur || t >= c.morte) return null;
  return { x: c.x0 + (c.x1 - c.x0) * (t - CHEFE.ida) / CHEFE.dur, y: c.y };
}
// o tiro do Clawd saindo de x em tF: em quem bate primeiro (bug, nave) ou se sai pelo topo
function tiro(J, M, x, tF) {
  for (let t = tF; ; t += 1 / 120) {
    const yp = PONTA - VS * (t - tF);
    if (yp < -J.HJ + 3) return { tipo: 'topo', t };
    const k = passoEm(M, t);
    for (let i = 0; i < J.bugs.length; i++) {
      const b = J.bugs[i];
      if (b.morte <= t) continue;
      const bx = b.x + M.ox[k], by = b.y + M.oy[k];
      if (x > bx + 0.5 && x < bx + BW - 0.5 && yp <= by + BH && yp >= by) return { tipo: 'bug', i, t, bx };
    }
    const c = chefeEm(J, t);
    if (c && x > c.x + 3 && x < c.x + RW - 3 && yp <= c.y + RH && yp >= c.y) return { tipo: 'chefe', t };
  }
}
// o tiro sobe por x sem bater em escudo (no instante t)
function livre(J, x, t) {
  const a = x - 1.15, b = x + 1.15;
  for (const e of J.escudos) {
    if (b <= e.x || a >= e.x + EW) continue;
    for (let cc = 0; cc < 14; cc++) {
      const c0 = e.x + cc * P;
      if (c0 + P <= a || c0 >= b) continue;
      for (let j = 0; j < 11; j++) if (e.morte[j * 14 + cc] > t) return false;
    }
  }
  return true;
}
// o escudo comido em volta da célula (cc, j) no instante t; baixo = de baixo pra cima (o laser)
function comer(e, cc, j, t, r, baixo) {
  const s = baixo ? -1 : 1, mancha = baixo ? [[0, 0], [-1, 0], [1, 0], [0, 1], [-1, 1], [1, 1], [0, 2]] : [[0, 0], [-1, 0], [1, 0], [0, 1]];
  for (const extra of [[-2, 0], [2, 0], [-1, 2], [1, 2], [0, 3], [2, 1], [-2, 1]]) if (r() < (baixo ? 0.4 : 0.2)) mancha.push(extra);
  for (const [dx, dy] of mancha) {
    const x = cc + dx, y = j + s * dy;
    if (x < 0 || x >= 14 || y < 0 || y >= 11) continue;
    if (e.morte[y * 14 + x] > t) e.morte[y * 14 + x] = t;
  }
}
const chegaEm = (prev, x) => prev.t + RECUO + CHEGA + Math.abs(x - prev.x) / VMAX;

// mira no bug i: o tiro sai quando o Clawd chega e acerta perto do meio; null se não dá
function mirar(J, M, i, prev, tProx, r) {
  const b = J.bugs[i], desvio = (r() - 0.5) * 5;
  let x = prev.x, tF = tProx;
  for (let it = 0; it < 4; it++) {
    tF = Math.max(tProx, chegaEm(prev, x));
    const tH = tF + (PONTA - (b.y + M.oy[passoEm(M, tF)] + BH)) / VS;
    x = lim(b.x + M.ox[passoEm(M, tH)] + BW / 2 + desvio, J.xMin, J.xMax);
  }
  tF = Math.max(tF, chegaEm(prev, x));
  if (!livre(J, x, tF)) return null;
  for (let w = 0; w < 0.3; w += 1 / 30) {  // errou a conta (o bug desceu, virou): espera ele passar por cima
    const res = tiro(J, M, x, tF + w);
    if (res.tipo === 'bug' && res.i === i && Math.abs(x - (res.bx + BW / 2)) <= BW / 2 - 3) return { tipo: 'bug', i, t: tF + w, x, tH: res.t };
  }
  return null;
}
// parado em x (o buraco do escudo), espera um bug passar por cima
function mirarFixo(J, M, x, prev, tProx) {
  for (let tF = Math.max(tProx, chegaEm(prev, x)); tF < tProx + 1.0; tF += 1 / 60) {
    const res = tiro(J, M, x, tF);
    if (res.tipo === 'bug' && res.i !== J.ultimo && Math.abs(x - (res.bx + BW / 2)) <= BW / 2 - 3) return { tipo: 'bug', i: res.i, t: tF, x, tH: res.t, furo: true };
  }
  return null;
}
// a nave: tiro difícil, com ela já a 1/4 do caminho, por um vão da formação
function mirarChefe(J, M, prev, tProx) {
  for (let tF = tProx; tF < CHEFE.ida + CHEFE.dur - 0.5; tF += 1 / 60) {
    const tH = tF + (PONTA - (J.chefe.y + RH)) / VS, c = chefeEm(J, tH);
    if (!c || (tH - CHEFE.ida) / CHEFE.dur < 0.25) continue;
    const x = c.x + RW / 2;
    if (x < J.xMin || x > J.xMax || tF < chegaEm(prev, x) || !livre(J, x, tF)) continue;
    const res = tiro(J, M, x, tF);
    if (res.tipo === 'chefe') return { tipo: 'chefe', t: tF, x, tH: res.t };
  }
  return null;
}
// cava um buraco no escudo mais perto (pelo gancho da chave, onde só há pixel em cima e
// embaixo): tiros de baixo até o laser passar
function cavar(J, prev, tProx, r) {
  const ord = J.escudos.map((e, s) => s).sort((a, b) => Math.abs(J.escudos[a].x + EW / 2 - prev.x) - Math.abs(J.escudos[b].x + EW / 2 - prev.x));
  for (const s of ord) {
    const e = J.escudos[s];
    for (const lado of r() < 0.5 ? [5, 9] : [9, 5]) {
      const x = e.x + lado * P;
      if (x < J.xMin || x > J.xMax) continue;
      const acoes = [];
      let t = Math.max(tProx, chegaEm(prev, x)), ok = false;
      for (let n = 0; n < 4; n++) {
        if (livre(J, x, t)) { ok = true; break; }
        let alvo = null;
        for (let cc = 0; cc < 14; cc++) {
          const c0 = e.x + cc * P;
          if (c0 + P <= x - 0.75 || c0 >= x + 0.75) continue;
          for (let j = 10; j >= 0; j--) if (e.morte[j * 14 + cc] > t) { if (!alvo || j > alvo.j) alvo = { cc, j }; break; }
        }
        const yH = e.y + (alvo.j + 1) * P, tH = t + (PONTA - yH) / VS;
        comer(e, alvo.cc, alvo.j, tH, r, true);
        acoes.push({ tipo: 'cava', t, x, tH, yH });
        t += 0.24;
      }
      if (ok && acoes.length) return acoes;
    }
  }
  return [];
}

function planejar(J, r, ritmo = 1) {
  const B = J.bugs, acoes = [];
  J.ultimo = r() < 0.5 ? 2 : 3;  // sobra um da elite, numa coluna do meio
  let prev = { t: CAI[1] - RECUO, x: J.X0 }, tProx = FOGO, M = null, chefe = false, cavou = false, furo = null;
  for (let n = 0, tent = 0; n < B.length - 1 && tent < 200; tent++) {
    M = marcha(J, null, tProx + 4);
    if (!chefe && tProx >= CHEFE.tiro) {  // tenta a cada baixa, enquanto a nave passa
      const a = mirarChefe(J, M, prev, tProx);
      if (a) { chefe = true; acoes.push(a); J.chefe.morte = a.tH; prev = a; tProx = a.tH + 0.12; continue; }
      if (tProx > CHEFE.ida + CHEFE.dur) chefe = true;
    }
    if (!cavou && n === 4) {
      cavou = true;
      const cs = cavar(J, prev, tProx, r);
      if (cs.length) { acoes.push(...cs); prev = cs[cs.length - 1]; tProx = prev.t + 0.24; furo = prev.x; }
    }
    let melhor = null;
    if (furo != null) { melhor = mirarFixo(J, M, furo, prev, tProx); furo = null; }
    if (!melhor) {
      for (let col = 0; col < COLS; col++) {  // só o de baixo de cada coluna: os outros estão atrás dele
        let i = -1;
        for (let f = FILAS - 1; f >= 0 && i < 0; f--) if (B[f * COLS + col].morte === Infinity) i = f * COLS + col;
        if (i < 0 || i === J.ultimo) continue;
        const a = mirar(J, M, i, prev, tProx, r);
        if (a) { a.nota = a.tH + r() * 0.15; if (!melhor || a.nota < melhor.nota) melhor = a; }
      }
    }
    if (!melhor) {  // ninguém na mira: vai pra um vão e espera um passar por cima
      for (const x of J.vaos) {
        const a = mirarFixo(J, M, x, prev, tProx);
        if (a && (!melhor || a.tH < melhor.tH)) melhor = a;
      }
    }
    if (!melhor) { tProx += 0.1; continue; }
    acoes.push(melhor); B[melhor.i].morte = melhor.tH; prev = melhor; n++;
    tProx = Math.max(melhor.tH + 0.04, melhor.t + (0.5 - 0.012 * n) * ritmo);
  }
  // o último bug: parado PAUSA s; corre; desce em 2 bordas até a pista e vem pelo chão
  const u = B[J.ultimo], T17 = prev.tH ?? FOGO;
  M = marcha(J, null, T17 + 1);
  const base17 = u.y + M.oy[passoEm(M, T17)] + BH;
  J.t17 = T17; J.ult = { t0: T17 + PAUSA, dl: Math.max(0, (PISTA - base17) / 2) };
  M = marcha(J, J.ult, T17 + 14);
  const k0 = passoEm(M, J.ult.t0), naPista = k => u.y + M.oy[k] + BH >= PISTA - 0.01;
  let kP = -1;
  for (let k = k0 + 1; k < M.ts.length; k++) if (naPista(k) && M.dir[k] !== M.dir[k - 1]) { kP = k; break; }
  if (kP < 0) for (let k = k0; k < M.ts.length; k++) if (naPista(k)) { kP = k; break; }
  if (kP < 0) kP = M.ts.length - 1;
  J.kPista = kP;
  // o último bug come os escudos por onde passa
  for (let k = k0; k < M.ts.length; k++) {
    const bx = u.x + M.ox[k], by = u.y + M.oy[k];
    for (const e of J.escudos) {
      if (bx + BW <= e.x || bx >= e.x + EW || by + BH <= e.y || by >= e.y + EH) continue;
      for (let j = 0; j < 11; j++) for (let cc = 0; cc < 14; cc++) {
        const mx = e.x + (cc + 0.5) * P, my = e.y + (j + 0.5) * P, q = j * 14 + cc;
        if (mx > bx + 1 && mx < bx + BW - 1 && my > by + 1.5 && my < by + BH - 0.5 && e.morte[q] > M.ts[k]) e.morte[q] = M.ts[k];
      }
    }
  }
  // um tiro que erra (ele é rápido demais), entre a 1ª borda e a pista, e o tiro final: com o
  // bug na pista, vindo; o Clawd chega antes e espera. Fica o par que acaba mais cedo.
  const centro = k => u.x + M.ox[k] + BW / 2;
  let corrida = 0;
  for (let k = kP + 1; k < M.ts.length && M.dir[k] === M.dir[kP]; k++) corrida++;
  const kAlvo = kP + 1 + Math.floor(corrida * (0.3 + 0.2 * r()));
  const final = (antes, k1) => {
    for (let k = k1; k < M.ts.length && k < k1 + 300; k++) {
      const tF = M.ts[k] + 0.003, x = centro(k);
      if (x < J.xMin || x > J.xMax || tF < chegaEm(antes, x) + 0.3 || !livre(J, x, tF)) continue;
      const res = tiro(J, M, x, tF);
      if (res.tipo === 'bug' && res.i === J.ultimo) return { tipo: 'final', i: J.ultimo, t: tF, x, tH: res.t };
    }
    return null;
  };
  let erro = null, fim = null;
  for (let k = k0 + 3; k < kP - 3; k++) {
    const tF = M.ts[k] + 0.004, x = centro(k);
    if (x < J.xMin || x > J.xMax || tF < chegaEm(prev, x) || !livre(J, x, tF)) continue;
    const res = tiro(J, M, x, tF);
    if (res.tipo !== 'topo') continue;
    const e = { tipo: 'erro', t: tF, x, tH: res.t }, f = final(e, kAlvo);
    if (f && (!fim || f.tH < fim.tH - 1e-9)) { erro = e; fim = f; }
  }
  if (erro) acoes.push(erro); else fim = final(prev, kAlvo) || final(prev, k0 + 1);
  if (!fim) fim = { tipo: 'final', i: J.ultimo, t: J.ult.t0 + 3, x: prev.x, tH: J.ult.t0 + 3.05 };
  acoes.push(fim);
  u.morte = fim.tH;
  J.M = M; J.acoes = acoes; J.chefeOk = J.chefe.morte < Infinity;
  // depois: ✓ CLEAR, o canhão sai, a tela desliga e o Clawd volta
  const TF = J.tFinal = fim.tH;
  J.tVisto = TF + 0.75; J.tSolta = TF + 2.3; J.tOff = TF + 2.4; J.tVolta = TF + 2.5;
  const dv = Math.abs(fim.x - J.X0);
  J.dVolta = dv < 0.5 ? 0 : lim(dv / 95, 0.45, 1.7);
  J.dur = Math.max(J.tVolta + J.dVolta, J.tOff + 0.55) + 0.4;
  // o caminho do Clawd: parado em cada tiro, deslizando (suave) de um pro outro
  J.segs = [];
  let p = { t: CAI[1] - RECUO, x: J.X0 };
  for (const a of acoes) { J.segs.push([p.t + RECUO, a.t - CHEGA, p.x, a.x]); p = a; }
  J.segs.push([J.tVolta, J.tVolta + J.dVolta, p.x, J.X0]);
  J.bombas = bombas(J, M, r);
  J.buracos = J.bombas.filter(b => b.onde === 'chao').map(b => ({ x: b.x, t: b.tI }));
  // o placar
  let soma = 0;
  J.placar = acoes.filter(a => a.tipo === 'bug' || a.tipo === 'final' || a.tipo === 'chefe')
    .map(a => ({ t: a.tH, v: (soma += a.tipo === 'chefe' ? 300 : PTS[B[a.i].f]) }));
  // as versões de cada escudo (cada instante em que perde pixel)
  for (const e of J.escudos) e.tempos = [...new Set([...e.morte].filter(v => v >= 0 && v < Infinity))].sort((a, b) => a - b);
}

// onde o Clawd está (x) e com que velocidade
function clawdEm(J, t) {
  const S = J.segs;
  let a = -1, b = S.length - 1;
  while (a < b) { const k = (a + b + 1) >> 1; if (S[k][0] <= t) a = k; else b = k - 1; }
  if (a < 0) return { x: J.X0, v: 0 };
  const [t0, t1, x0, x1] = S[a];
  if (t >= t1 || t1 <= t0) return { x: x1, v: 0 };
  const u = (t - t0) / (t1 - t0);
  return { x: x0 + (x1 - x0) * u * u * (3 - 2 * u), v: (x1 - x0) * 6 * u * (1 - u) / (t1 - t0) };
}

// ---------- as bombas ----------
// cai de (x, y0) em tb: onde para (o 1º pixel de escudo inteiro no caminho, ou o chão)
function queda(J, x, y0, tb) {
  const a = x - 2.25, b = x + 2.25, fundo0 = y0 + 7 * P;
  let q = { tI: tb + (0 - fundo0) / VB, onde: 'chao', yI: 0 };
  J.escudos.forEach((e, s) => {
    if (b <= e.x || a >= e.x + EW) return;
    for (let cc = 0; cc < 14; cc++) {
      const c0 = e.x + cc * P;
      if (c0 + P <= a || c0 >= b) continue;
      for (let j = 0; j < 11; j++) {
        const tc = tb + (e.y + j * P - fundo0) / VB;
        if (e.morte[j * 14 + cc] > tc) { if (tc < q.tI) q = { tI: tc, onde: 'escudo', s, cc, j, yI: e.y + j * P }; break; }
      }
    }
  });
  return q;
}
// não encosta no Clawd nem no canhão (com folga de 1,5)
function seguro(J, x, y0, tb, tI) {
  for (let t = tb; t <= tI; t += 1 / 120) {
    const fundo = y0 + 7 * P + VB * (t - tb);
    if (fundo < PONTA - 1.5) continue;
    const dx = Math.abs(x - clawdEm(J, t).x);
    if (dx < 3.75 + 2.25 + 1.5 || (fundo > -16.5 && dx < 13.5 + 2.25 + 1.5)) return false;
  }
  return true;
}
function bombas(J, M, r) {
  const B = J.bugs, lista = [];
  let tb = FOGO + 0.45 + r() * 0.3;
  while (tb < J.tFinal - 0.45) {
    const k = passoEm(M, tb), vivos = B.filter(b => b.morte > tb).length;
    const pausa = tb >= J.t17 && tb < J.ult.t0 + 0.15;
    let melhor = null;
    for (let col = 0; col < COLS && !pausa; col++) {
      let i = -1;
      for (let f = FILAS - 1; f >= 0; f--) if (B[f * COLS + col].morte > tb + 0.05) { i = f * COLS + col; break; }
      if (i < 0) continue;
      const b = B[i], x = b.x + M.ox[k] + BW / 2, y0 = b.y + M.oy[k] + BH, q = queda(J, x, y0, tb);
      if (!seguro(J, x, y0, tb, q.tI)) continue;
      const nota = Math.abs(Math.abs(x - clawdEm(J, q.tI).x) - 22) + r() * 14 + (q.onde === 'escudo' ? 12 : 0);  // o escudo dura mais
      if (!melhor || nota < melhor.nota) melhor = { i, x, y0, tb, ...q, nota };
    }
    if (melhor) {
      if (melhor.onde === 'escudo') comer(J.escudos[melhor.s], melhor.cc, melhor.j, melhor.tI, r, false);
      lista.push(melhor);
    }
    tb += (0.45 + r() * 0.5) * (0.6 + 0.4 * vivos / B.length);
  }
  return lista;
}

// ---------- prontos 1x ----------
// a tela do fliperama (moldura de cantos redondos, quase preta, estrelas fraquinhas) na escala
const TELAS = cache(3);
function telaPronta(J, e) {
  const chave = [J.cw, J.HJ, e].join(',');
  const pronta = TELAS.get(chave);
  if (pronta) return pronta;
  const c = tela(Math.round(J.cw * e), Math.round(J.HJ * e)), k = c.getContext('2d');
  k.setTransform(e, 0, 0, e, 0, 0);
  const caixa = (x, y, w, h, raio, cor) => {
    k.fillStyle = cor; k.beginPath();
    k.moveTo(x + raio, y); k.lineTo(x + w - raio, y); k.arc(x + w - raio, y + raio, raio, -Math.PI / 2, 0);
    k.lineTo(x + w, y + h); k.lineTo(x, y + h); k.lineTo(x, y + raio); k.arc(x + raio, y + raio, raio, Math.PI, 1.5 * Math.PI);
    k.fill();
  };
  caixa(0, 0, J.cw, J.HJ, 8, '#52525B');
  caixa(1.5, 1.5, J.cw - 3, J.HJ - 1.5, 6.5, '#27272A');
  caixa(3, 3, J.cw - 6, J.HJ - 3, 5, '#050508');
  const r = rng(1979);
  for (let i = 0; i < 34; i++) {
    const x = 6 + r() * (J.cw - 12), y = 16 + r() * (J.HJ - 70), a = 0.18 + 0.4 * r();
    k.fillStyle = `rgba(229,231,235,${a.toFixed(2)})`; k.fillRect(x, y, r() < 0.25 ? 1.5 : 1, 1);
  }
  return TELAS.set(chave, c);
}
// o escudo s no instante t: uma versão por instante em que perdeu pixel
const ESCUDOS = cache(240);
let SERIE = 0;  // cada plano tem seus escudos
function escudoEm(J, s, t) {
  const e = J.escudos[s];
  let v = 0;
  while (v < e.tempos.length && e.tempos[v] <= t) v++;
  const chave = J.id + ':' + s + ':' + v;
  const pronta = ESCUDOS.get(chave);
  if (pronta) return pronta;
  const lim0 = v ? e.tempos[v - 1] : -Infinity, c = tela(14, 11), k = c.getContext('2d');
  k.fillStyle = '#22C55E';
  for (let j = 0; j < 11; j++) for (let cc = 0; cc < 14; cc++) { const q = e.morte[j * 14 + cc]; if (q >= 0 && q > lim0) k.fillRect(cc, j, 1, 1); }
  return ESCUDOS.set(chave, c);
}

// ---------- efeitos ----------
const VOOS = [[-30, -60], [-12, -80], [10, -75], [28, -55], [-22, -30], [20, -35], [0, -90], [34, -20]];
// a fumacinha do bug (fumacaBug do tema), k = tamanho
function fumaca(g, cx, cy, d, k = 1) {
  if (d < 0 || d >= 0.6) return;
  g.save(); g.globalAlpha *= 1 - d / 0.6;
  const w = (3 + 5 * d) * k;
  VOOS.forEach(([vx, vy], i) => {
    g.fillStyle = i % 2 ? '#9CA3AF' : '#E5E7EB';
    g.fillRect(cx + vx * (0.06 + d * 0.3) * k - w / 2, cy + vy * (0.06 + d * 0.2) * k - 10 * d - w / 2, w, w);
  });
  g.restore();
}
const FAISCAS = (() => {
  const r = rng(31), cores = ['#FACC15', '#FB923C', '#FFFFFF', '#F472B6'];
  return Array.from({ length: 16 }, (_, i) => { const a = (i / 16) * 2 * Math.PI + r() * 0.3, v = 50 + r() * 55; return { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, cor: cores[i % 4], tam: r() < 0.5 ? P : 2 * P }; });
})();
function faiscas(g, cx, cy, d, dur = 0.75) {
  if (d < 0 || d >= dur) return;
  g.save(); g.globalAlpha *= 1 - d / dur;
  for (const f of FAISCAS) { g.fillStyle = f.cor; g.fillRect(cx + f.vx * d - f.tam / 2, cy + f.vy * d + 70 * d * d - f.tam / 2, f.tam, f.tam); }
  g.restore();
}
// estalo pequeno (bomba no chão/escudo, laser no topo/escudo)
function estalo(g, x, y, d, cor) {
  if (d < 0 || d >= 0.2) return;
  const s = 1.5 + d * 14;
  g.save(); g.globalAlpha *= 1 - d / 0.2; g.fillStyle = cor;
  g.fillRect(x - 0.75, y - 0.75, P, P);
  for (const [a, b] of [[-1, -1], [1, -1], [-1, 1], [1, 1], [0, -1.3]]) g.fillRect(x + a * s - 0.75, y + b * s - 0.75, P, P);
  g.restore();
}
// clarão em cruz (boca do canhão, acerto)
function cruz(g, x, y, k, cor) { g.fillStyle = cor; g.fillRect(x - 0.75, y - 0.75 - 1.5 * k, P, P + 3 * k); g.fillRect(x - 0.75 - 1.5 * k, y - 0.75, P + 3 * k, P); }
function texto(g, txt, cor, x, y, k = 1) { const a = textoArte(txt, cor); g.drawImage(a, x, y, a.width * P * k, a.height * P * k); }

// a tela: TV de tubo que liga numa linha e abre, e desliga fechando numa linha e num ponto
function abertura(J, t) {
  const lin = 1.5 / J.HJ, o = J.tOff;
  if (t < 0) return null;
  if (t < 0.12) return { w: sai(t / 0.12), h: lin, brilho: 1 };
  if (t < LIGA) { const u = (t - 0.12) / (LIGA - 0.12); return { w: 1, h: Math.max(lin, sai(u)), brilho: 0.55 * (1 - u) * (1 - u) }; }
  if (t < o) return { w: 1, h: 1, brilho: 0 };
  if (t < o + 0.22) { const u = (t - o) / 0.22; return { w: 1, h: Math.max(lin, 1 - entra(u)), brilho: 0.7 * u * u }; }
  if (t < o + 0.38) { const u = (t - o - 0.22) / 0.16; return { w: Math.max(3 / J.cw, 1 - sai(u)), h: lin * 2, brilho: 1 }; }
  if (t < o + 0.55) return { w: 3 / J.cw, h: 3 / J.HJ, brilho: 1, alfa: 1 - (t - o - 0.38) / 0.17 };
  return null;
}

// ---------- o quadro ----------
function desenhar(g, t, m, J) {
  const e = m.host.escala || 1, c = m.host.cartao, T0 = g.getTransform();
  if (!c) return;
  const OX = c[0], OY = c[1], M = J.M, B = J.bugs;
  const X = v => Math.round((OX + v) * e) / e, Y = v => Math.round((OY + v) * e) / e;  // no pixel da tela
  g.save();
  // a tela
  const ab = abertura(J, t);
  if (ab) {
    const img = telaPronta(J, e), W = img.width, H = img.height;
    const w = Math.max(1, Math.round(W * ab.w)), h = Math.max(1, Math.round(H * ab.h)), sx = Math.round((W - w) / 2), sy = Math.round((H - h) / 2);
    const x0 = Math.round(OX * e) + sx, y0 = Math.round((OY - J.HJ) * e) + sy;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.globalAlpha = ab.alfa ?? 1;
    g.drawImage(img, sx, sy, w, h, x0, y0, w, h);
    if (ab.brilho > 0) { g.globalAlpha = (ab.alfa ?? 1) * ab.brilho; g.fillStyle = '#E5E7EB'; g.fillRect(x0, y0, w, h); }
    g.globalAlpha = 1;
  }
  g.setTransform(e, 0, 0, e, 0, 0);
  const ligada = t >= LIGA && t < J.tOff, TF = J.tFinal;
  if (ligada) {
    // estrelas que piscam
    const rs = rng(4242);
    for (let i = 0; i < 6; i++) {
      const x = 8 + rs() * (J.cw - 16), y = -J.HJ + 18 + rs() * (J.HJ - 75), f = rs() * 6, w = 1.5 + rs() * 2;
      g.globalAlpha = 0.15 + 0.6 * (0.5 + 0.5 * Math.sin(t * w + f));
      g.fillStyle = '#E5E7EB'; g.fillRect(X(x), Y(y), P, P);
    }
    g.globalAlpha = 1;
    // o placar: SCORE e os pontos
    if (t >= 0.5 && !(t < 0.9 && Math.floor((t - 0.5) / 0.1) % 2)) {
      let v = 0;
      for (const p of J.placar) if (p.t <= t) v = p.v;
      texto(g, 'SCORE', '#9CA3AF', X(MARG + 2), Y(-J.HJ + 6));
      texto(g, String(v).padStart(4, '0'), '#E5E7EB', X(MARG + 2 + 23 * P), Y(-J.HJ + 6));
    }
    desenharChefe(g, t, J, X, Y);
    desenharBugs(g, t, J, X, Y, M);
    // escudos
    J.escudos.forEach((es, s) => g.drawImage(escudoEm(J, s, t), X(es.x), Y(es.y), EW, EH));
    // bombas
    for (const b of J.bombas) {
      if (t < b.tb) break;
      if (t < b.tI) {
        const y = b.y0 + VB * (t - b.tb);
        g.drawImage(arte(BOMBA[Math.floor(t / 0.07) % 2], { '#': '#F472B6' }), X(b.x - 2.25), Y(Math.min(y, b.yI - 7 * P)), 3 * P, 7 * P);
      } else estalo(g, X(b.x), Y(b.yI - 1), t - b.tI, '#F472B6');
    }
    // tiros do Clawd e o que eles acertam
    for (const a of J.acoes) {
      if (t < a.t) break;
      if (t < a.tH) {
        const yp = PONTA - VS * (t - a.t);
        g.fillStyle = '#FACC15'; g.fillRect(X(a.x - 0.75), Y(yp + P), P, Math.min(5 * P, PONTA - yp));
        g.fillStyle = '#FFFFFF'; g.fillRect(X(a.x - 0.75), Y(yp), P, P);
      } else if (a.tipo === 'cava') { estalo(g, X(a.x), Y(a.yH), t - a.tH, '#FACC15'); if (t - a.tH < 0.06) cruz(g, X(a.x), Y(a.yH), 1, '#FEF9C3'); }
      else if (a.tipo === 'erro') estalo(g, X(a.x), Y(-J.HJ + 4), t - a.tH, '#FACC15');
    }
    desenharEfeitos(g, t, J, X, Y, M);
    // ✓ CLEAR
    if (t >= J.tVisto && t < J.tSolta) {
      const d = t - J.tVisto, aceso = d < 0.35 || (d >= 0.5 && d < 0.85) || d >= 1.0;
      if (aceso) {
        const cx = J.cw / 2, cy = -J.HJ / 2 - 4, k = d < 0.12 ? sai(d / 0.12) : 1;
        const sombra = arte(VISTO, { '#': '#14532D' }), visto = arte(VISTO, { '#': '#22C55E' }), vw = 17 * P * k, vh = 12 * P * k;
        g.drawImage(sombra, X(cx - vw / 2 + P), Y(cy - vh + P), vw, vh);
        g.drawImage(visto, X(cx - vw / 2), Y(cy - vh), vw, vh);
        const tx = textoArte('CLEAR', '#FACC15');
        g.drawImage(tx, X(cx - tx.width * P / 2), Y(cy + 5), tx.width * P, tx.height * P);
        for (let i = 0; i < 4; i++) {  // brilhos em volta
          const a = i * Math.PI / 2 + 0.6 + d * 1.5, f = Math.floor((d + i * 0.13) / 0.12) % 3;
          if (f < 2) cruz(g, X(cx + Math.cos(a) * 26), Y(cy - 6 + Math.sin(a) * 15), f, '#FEF9C3');
        }
      }
    }
    // o clarão do último acerto
    if (t >= TF && t < TF + 0.14) {
      g.globalAlpha = 0.28 * (1 - (t - TF) / 0.14); g.fillStyle = '#FFFFFF';
      g.fillRect(X(3), Y(-J.HJ + 3), J.cw - 6, J.HJ - 3); g.globalAlpha = 1;
    }
  }
  // o chão: acende do Clawd pros lados; as bombas que chegam nele deixam falha
  if (t >= 0.25 && t < J.tOff + 0.45) {
    const u = sai(lim((t - 0.25) / 0.35, 0, 1)), meio = J.X0, a = Math.max(0, meio - u * J.cw), b = Math.min(J.cw, meio + u * J.cw);
    g.globalAlpha = t < J.tOff + 0.1 ? 1 : 1 - (t - J.tOff - 0.1) / 0.35;
    g.fillStyle = '#22C55E';
    const furos = J.buracos.filter(f => f.t <= t).map(f => [f.x - 2.25, f.x + 2.25]).sort((p, q) => p[0] - q[0]);
    let x = a;
    for (const [f0, f1] of furos) { if (f0 > x) g.fillRect(X(x), Y(0), X(Math.min(f0, b)) - X(x), P); x = Math.max(x, f1); }
    if (b > x) g.fillRect(X(x), Y(0), X(b) - X(x), P);
    g.globalAlpha = 1;
  }
  g.restore();
  desenharClawd(g, t, J, T0);
}

function desenharBugs(g, t, J, X, Y, M) {
  const B = J.bugs, k = passoEm(M, t);
  for (let i = 0; i < B.length; i++) {
    const b = B[i];
    if (t < b.surge || t >= b.morte + 0.1) continue;
    const ultimo = i === J.ultimo && t >= J.t17, zoom = ultimo && t >= J.ult.t0;
    let perna = t < MARCHA ? 0 : k % 2;
    if (ultimo && !zoom) perna = Math.floor(t / 0.09) % 2;  // parado, mexendo as pernas
    const dir = M.dir[k] > 0, bx = b.x + M.ox[k], by = b.y + M.oy[k];
    if (zoom && t < b.morte) {  // rastro: onde ele estava 2 e 4 passos atrás
      for (const [atras, a] of [[4, 0.18], [2, 0.38]]) {
        const kk = Math.max(0, k - atras);
        if (M.ts[kk] < J.ult.t0) continue;
        g.globalAlpha = a; g.drawImage(bugArte(b.f, perna, M.dir[kk] > 0, false), X(b.x + M.ox[kk]), Y(b.y + M.oy[kk]), BW, BH);
      }
      g.globalAlpha = 1;
    }
    let img = bugArte(b.f, perna, dir, t >= b.morte);
    if (t - b.surge < 0.08) img = tingida(img, '#FFFFFF', 'inv' + b.f + perna + dir);
    g.drawImage(img, X(bx), Y(by), BW, BH);
    if (ultimo && !zoom && t >= J.t17 + 0.1) texto(g, '!', '#FACC15', X(bx + BW / 2 - 0.75), Y(by - 10));
  }
}

function desenharChefe(g, t, J, X, Y) {
  const c = chefeEm(J, t);
  if (!c) return;
  const img = reiArte(Math.floor(t / 0.12) % 2, J.chefe.dir > 0), x = X(c.x), y = Y(c.y), a = X(3), b = X(J.cw - 3);
  const x0 = Math.max(x, a), x1 = Math.min(x + RW, b);
  if (x1 <= x0) return;
  g.drawImage(img, (x0 - x) / PB, 0, (x1 - x0) / PB, img.height, x0, y, x1 - x0, RH);
}

function desenharEfeitos(g, t, J, X, Y, M) {
  const B = J.bugs;
  for (const a of J.acoes) {
    if (t < a.tH || t > a.tH + 1.4) continue;
    const d = t - a.tH;
    if (a.tipo === 'bug' || a.tipo === 'final') {
      const b = B[a.i], k = passoEm(M, a.tH), cx = b.x + M.ox[k] + BW / 2, cy = b.y + M.oy[k] + BH / 2, grande = a.tipo === 'final';
      if (d < 0.05) cruz(g, X(a.x), Y(b.y + M.oy[k] + BH), 2, '#FEF9C3');
      fumaca(g, X(cx), Y(cy), d - 0.08, grande ? 1.6 : 1);
      if (grande) { faiscas(g, X(cx), Y(cy), d); fumaca(g, X(cx), Y(cy), d - 0.3, 1.1); }
      if (d >= 0.12 && d < 0.95) {  // os pontos sobem
        const u = (d - 0.12) / 0.83;
        g.globalAlpha = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
        const s = String(PTS[b.f]), w = (s.length * 4 - 1) * P;
        texto(g, s, COR_FILA[b.f].w, X(cx - w / 2), Y(cy - 4 - 10 * sai(u)));
        g.globalAlpha = 1;
      }
    } else if (a.tipo === 'chefe') {
      const c0 = J.chefe, cx = c0.x0 + (c0.x1 - c0.x0) * (a.tH - CHEFE.ida) / CHEFE.dur + RW / 2, cy = c0.y + RH / 2;
      if (d < 0.07) { const img = reiArte(0, c0.dir > 0); g.drawImage(tingida(img, '#FFFFFF', 'rei' + c0.dir), X(cx - RW / 2), Y(c0.y), RW, RH); }
      fumaca(g, X(cx), Y(cy), d - 0.05, 1.8);
      faiscas(g, X(cx), Y(cy), d - 0.02);
      if (d >= 0.15 && d < 0.6 && Math.floor(d / 0.09) % 2 === 0) texto(g, '?', '#F472B6', X(cx - 2.25), Y(cy - 4), 1.4);
      if (d >= 0.6 && d < 1.4) {
        const u = (d - 0.6) / 0.8;
        g.globalAlpha = u < 0.7 ? 1 : 1 - (u - 0.7) / 0.3;
        texto(g, '300', '#FACC15', X(cx - 8.25), Y(cy - 4 - 8 * sai(u)));
        g.globalAlpha = 1;
      }
    }
  }
}

function desenharClawd(g, t, J, T0) {
  const { x, v } = clawdEm(J, t), TF = J.tFinal;
  const p = { pernas: Math.abs(v) > 8 ? (Math.floor(t / 0.08) % 2 ? 'A' : 'B') : 'ambas' };
  if (t >= CAI[0] && t < TF + 0.6) p.olhos = 'cima';
  // o canhão chega caindo e encaixa (amassa um pouco); recuo a cada tiro
  if (t >= CAI[1] && t < CAI[1] + 0.12) p.sy = 1 - 0.12 * Math.sin(Math.PI * (t - CAI[1]) / 0.12);
  let disparo = -1;
  for (const a of J.acoes) { if (a.t > t) break; if (t - a.t < 0.1) disparo = t - a.t; }
  if (disparo >= 0) p.sy = 1 - 0.08 * Math.sin(Math.PI * disparo / 0.1);
  // comemora: 2 pulinhos de olhos fechados
  for (const [a, b, h] of [[TF + 0.75, TF + 1.05, 7], [TF + 1.15, TF + 1.45, 5]]) if (t >= a && t < b) { p.y = -h * Math.sin(Math.PI * (t - a) / (b - a)); p.olhos = 'fechados'; }
  // volta andando pro lugar
  if (t >= J.tVolta && t < J.tVolta + J.dVolta) {
    const w = andando(t - J.tVolta);
    p.pernas = w.pernas; p.y = w.y * Math.min(1, (J.tVolta + J.dVolta - t) / 0.15);
  }
  const comCanhao = t >= CAI[1] && t < J.tSolta;
  if (comCanhao) {
    p.frente = (k, dy) => {
      k.drawImage(arte(CANHAO, COR_CANHAO), -3.75, -15 - 4 * P + dy, 5 * P, 4 * P);
      if (disparo >= 0 && disparo < 0.06) cruz(k, 0, PONTA - 1.5 + dy, 1, '#FEF9C3');
    };
  }
  g.save();
  g.setTransform(T0.a, T0.b, T0.c, T0.d, T0.e, T0.f);
  g.translate(x - J.X0, 0);
  desenhaClawd(g, p);
  // o canhão caindo, e saindo com uma fumacinha
  if (t >= CAI[0] && t < CAI[1]) {
    const u = (t - CAI[0]) / (CAI[1] - CAI[0]);
    g.drawImage(arte(CANHAO, COR_CANHAO), -3.75, -15 - 4 * P - 60 * (1 - entra(u)), 5 * P, 4 * P);
  }
  fumaca(g, 0, -18, t - J.tSolta, 0.7);
  g.restore();
}

function cena(m) {
  const semente = Math.floor(m.sorteio() * 4294967296);
  let J;
  for (let k = 0; k < 3; k++) {  // passou de ~20,6 s: de novo, num ritmo mais rápido
    const r = rng(semente + k);
    J = montar(m, r);
    J.id = ++SERIE;
    planejar(J, r, 1 - 0.15 * k);
    if (J.dur <= 20.6) break;
  }
  return {
    nome: 'epico', dur: J.dur, espaco: { frente: 0, tras: 0 }, modos: ['andando'],
    plano: J,  // pros testes
    quadro(g, t, mundo) { desenhar(g, t, mundo || m, J); },
  };
}

module.exports = { linhaDoTempo, cena };
