'use strict';
// Tema Padrão, parado há muito tempo: o Clawd DORME. Igual ao de sempre (fecha os olhos, senta,
// respira e solta z z z), com mais duas coisas que se revezam:
// - a BOLHA NO NARIZ (de anime): sai da frente do rosto, enche quando ele solta o ar e murcha
//   quando ele puxa; às vezes cresce mais que o normal, treme e ESTOURA (respingo): ele quase
//   acorda (abre os olhos, às vezes 1 só, '!', olha pra trás e pra frente) e volta a dormir;
// - os SONHOS DE DEV: um balão de pensamento (bolinhas subindo da cabeça até a nuvem) com uma
//   mini animação dentro: o bug esmagado (um Clawd pequeno pula nele, como na cena 'pisa'), a
//   caneca de café com fumacinha e corações, os testes passando (pontinhos, barra e ✓), o deploy
//   (foguetinho voando) e a lista de tarefas toda riscada. Sonhando, ele sorri (^ ^, corado).
// Os z param enquanto há bolha ou sonho (a respiração vai pra bolha; fica menos poluído).
// O laço é feito de janelas de JAN s: as pares têm bolha e as ímpares sonho (às vezes nada,
// só z z z); o que acontece em cada janela k sai de rng(semente, k), nunca de contador: tudo é
// função do tempo. A semente fica em m.estado.dormeSemente pra saída saber o que estava no ar.
// Saída (algo voltou a rodar): a espreguiçada de sempre (0,6 s); a bolha estoura, o balão
// encolhe e os z apagam, tudo antes de 0,45 s.
const { sai, arte, rng, cache, tela } = require('./comum');
const { desenhaClawd, spriteClawd, registrarRoupas, ROUPAS } = require('./clawd');

const P = 1.5;                 // px do Clawd (meia-fileira)
const RESPIRA = 1.6;           // s por respiração (sentado)
const LACO = 2.6;              // s: começa o laço (os 2 primeiros z já subiram)
const JAN = 18;                // s por janela (no máximo 1 evento cada)
const VAZIA = 1.0;             // a bolha está vazia em VAZIA + RESPIRA·j (ele acabou de puxar o ar)
const TREME = 0.35;            // s: a bolha grande tremendo antes de estourar
const REACAO = 2.2;            // s: do estouro até dormir de novo
const ESTOURA = 0.4;           // chance de a bolha estourar (janelas sorteadas)
const NADA = 0.15;             // chance de uma janela não ter nada (só z z z)
const SONHOS = ['bug', 'cafe', 'teste', 'foguete', 'tarefas'];

// ---------- desenhos (copiados do tema-padrao.js: BUG/COR_BUG, CANECA, CHECK, ZS) ----------
const BUG = ['a............', '.a...vvvvv...', '..a.vwwvvvvv.', '.aaavwvvxvvvv', 'aoaavvvvvxvvv', '.aaaavvvvvxv.', '..pq..pq..pq.', '.p..qp..qp..q'];
const COR_BUG = { v: '#65A30D', w: '#A3E635', x: '#365314', a: '#111827', o: '#F8FAFC', p: '#111827', q: '#111827' };
const COR_BUG_V = { v: '#EF4444', w: '#FCA5A5', x: '#991B1B', a: '#450A0A', o: '#FEE2E2', p: '#450A0A', q: '#450A0A' };
const CHECK = ['......#', '.....##', '#...##.', '##.##..', '.###...', '..#....'];
const CANECA = ['wcccw..', 'wwwwwhh', 'ooooo.h', 'wwwwwhh', 'wwwww..'];
const COR_CANECA = { w: '#F3F4F6', c: '#5B3A1E', o: '#60A5FA', h: '#D1D5DB' };
const ZS = [['###', '.#.', '###'], ['####', '..#.', '.#..', '####'], ['#####', '...#.', '..#..', '.#...', '#####']];
const VOOS = [[-30, -60], [-12, -80], [10, -75], [28, -55], [-22, -30], [20, -35], [0, -90], [34, -20]];
// novos
const EXCLAMA = ['#', '#', '#', '.', '#'];
const CORACAO = ['.#.#.', '#####', '.###.', '..#..'];
const FOGUETE = ['...r...', '..rrr..', '..www..', '.wwbww.', '.wbBbw.', '.wwbww.', '.wwwww.', 'rwwwwwr', 'rr...rr'];
const COR_FOGUETE = { r: '#EF4444', w: '#E5E7EB', b: '#60A5FA', B: '#DBEAFE' };

const Z_COR = '#CBD5E1';
const BOLHA_BORDA = '#BFDBFE', BOLHA_MIOLO = 0.2;  // miolo: a borda com esse alfa
const NUVEM_BORDA = '#CBD5E1', NUVEM_MIOLO = '#3F3F46';

// sprite de pixel de 1 DIP com borda: dentro(x, y) diz a forma; a borda é o que encosta no lado
// de fora. Escreve direto nos pixels (BGRA pré-multiplicado, como o reamostrar do comum.js): é
// feito 1x, mas um fillRect por pixel custaria uns ms no quadro em que aparece.
const pm = (hex, a = 1) => {
  const n = parseInt(hex.slice(1, 7), 16), A = Math.round(a * 255), c = v => Math.round(v * A / 255);
  return ((A << 24) | (c((n >> 16) & 255) << 16) | (c((n >> 8) & 255) << 8) | c(n & 255)) >>> 0;
};
function forma(W, H, dentro, borda, miolo) {
  const c = tela(W, H), px = c.pixels, d = (x, y) => x >= 0 && y >= 0 && x < W && y < H && dentro(x, y);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (!d(x, y)) continue;
    px[y * W + x] = !d(x - 1, y) || !d(x + 1, y) || !d(x, y - 1) || !d(x, y + 1) ? borda : miolo;
  }
  return c;
}
// bolha (círculo de raio R): borda azul clara, miolo translúcido, brilho de 1 px em cima à esquerda
function circulo(R, borda, miolo, brilho) {
  const n = 2 * R + 1, c = forma(n, n, (x, y) => (x - R) ** 2 + (y - R) ** 2 <= R * R + 0.8 * R, borda, miolo);
  if (brilho && R >= 3) { const d = Math.round(R * 0.45); c.pixels[(R - d) * n + R - d] = pm('#FFFFFF'); }
  return c;
}
// a nuvem do sonho: união de círculos, borda clara, miolo escuro
const BOLOS = [[11, 19, 9], [45, 18, 9.5], [19, 11, 8.5], [30, 9, 9], [41, 11, 8], [20, 25, 7.5], [36, 25.5, 7.5]];
function nuvemArte() {
  return forma(56, 34, (x, y) => {
    const px = x + 0.5, py = y + 0.5;
    return (px >= 8 && px <= 48 && py >= 10 && py <= 28) || BOLOS.some(([cx, cy, r]) => (px - cx) ** 2 + (py - cy) ** 2 <= r * r);
  }, pm(NUVEM_BORDA), pm(NUVEM_MIOLO));
}
// sprites prontos 1x, cada um na 1ª vez que aparece (o 1º quadro não paga tudo de uma vez);
// guardados aqui: o cache de arte() tem teto e é dividido com os temas
const bugArte = (perna, verm) => arte(BUG.map(l => l.replace(perna === 'p' ? /q/g : /p/g, '.')), verm ? COR_BUG_V : COR_BUG);
const FAZ = {
  zs: () => ZS.map(z => arte(z, { '#': Z_COR })),
  trilha: () => [arte(['##', '##'], { '#': NUVEM_BORDA }), circulo(2, pm(NUVEM_BORDA), pm(NUVEM_MIOLO), false), circulo(3, pm(NUVEM_BORDA), pm(NUVEM_MIOLO), false)],
  nuvem: nuvemArte,
  exclama: () => arte(EXCLAMA, { '#': '#FACC15' }),
  bugs: () => ({ p: bugArte('p', false), q: bugArte('q', false), pv: bugArte('p', true), qv: bugArte('q', true) }),
  check: () => arte(CHECK, { '#': '#22C55E' }),
  caneca: () => arte(CANECA, COR_CANECA),
  coracao: () => arte(CORACAO, { '#': '#F472B6' }),
  foguete: () => arte(FOGUETE, COR_FOGUETE),
};
const PRONTO = {}, SPR = {};
for (const k of Object.keys(FAZ)) Object.defineProperty(SPR, k, { get: () => PRONTO[k] || (PRONTO[k] = FAZ[k]()) });
const sprites = () => SPR;
const BOLHAS = [];
const bolhaDe = r => BOLHAS[r] || (BOLHAS[r] = circulo(r, pm(BOLHA_BORDA), pm(BOLHA_BORDA, BOLHA_MIOLO), true));

// ---------- sorteio por janela ----------
const sorte = (sem, k, canal) => rng((sem + Math.imul(k + 1, 0x9E3779B1) + Math.imul(canal, 0x85EBCA6B)) >>> 0);
// As janelas pares são de bolha e as ímpares de sonho (às vezes, NADA, só z z z). Os sonhos vêm
// em blocos de 5 com os 5 tipos embaralhados (o 1º do bloco não repete o último do anterior; o
// 1º sonho de todos é o bug): variedade pra horas, sem contador.
function ordemCrua(sem, b) {
  const r = sorte(sem, b, 2), p = [0, 1, 2, 3, 4];
  for (let i = p.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  if (b === 0) { const i = p.indexOf(0); [p[0], p[i]] = [p[i], p[0]]; }
  return p;
}
function qualSonho(sem, k) {
  const j = (k - 1) >> 1, b = Math.floor(j / 5), p = ordemCrua(sem, b);
  if (b > 0 && p[0] === ordemCrua(sem, b - 1)[4]) [p[0], p[1]] = [p[1], p[0]];
  return SONHOS[p[j % 5]];
}
const DUR_SONHO = { bug: 3.6, cafe: 3.9, teste: 3.7, foguete: 3.9, tarefas: 3.3 };
const ABRE = 0.6, FECHA = 0.4;  // s: o balão subindo (bolinhas + nuvem) e sumindo

const EVENTOS = cache(32);
function evento(sem, k) {
  if (k < 0) return null;
  const chave = sem + ':' + k, pronto = EVENTOS.get(chave);
  if (pronto !== undefined) return pronto;
  return EVENTOS.set(chave, sortearEvento(sem, k));
}
function sortearEvento(sem, k) {
  const r = sorte(sem, k, 1), ini = LACO + k * JAN, tipo = k % 2 ? 'sonho' : 'bolha';
  if (r() < NADA && k > 1) return null;
  if (tipo === 'sonho') {
    const qual = qualSonho(sem, k), dur = ABRE + DUR_SONHO[qual] + FECHA;
    const t0 = ini + 1.2 + (k === 1 ? 0 : r() * (JAN - 1.5 - dur));
    return { tipo, qual, t0, dur, fim: t0 + dur };
  }
  const estoura = k === 0 || r() < ESTOURA, n = k === 0 ? 3 : 3 + Math.floor(r() * 3);
  const dur = estoura ? (n - 1) * RESPIRA + RESPIRA / 2 + TREME + REACAO : n * RESPIRA;
  const bruto = ini + 1.2 + (k === 0 ? 0 : r() * (JAN - 1.5 - RESPIRA - dur));
  const t0 = VAZIA + RESPIRA * Math.ceil((bruto - VAZIA) / RESPIRA - 1e-9);  // começa vazia
  // raio máximo de cada respiração; a que estoura cresce mais (e a de antes já um pouco)
  const altos = Array.from({ length: n }, () => 4 + Math.floor(r() * 2));
  if (estoura) { altos[n - 1] = 8; if (n > 1) altos[n - 2] = 6; }
  const tp = estoura ? t0 + (n - 1) * RESPIRA + RESPIRA / 2 + TREME : null;
  // o respingo: 4 gotas saindo da borda, pra cima e pra frente (nada cai no rosto nem no cartão)
  const gotas = Array.from({ length: 4 }, (_, i) => {
    const a = (-118 + 112 * (i + 0.2 + r() * 0.6) / 4) * Math.PI / 180;
    return { a, v: 24 + r() * 14, w: i % 2 ? 1 : 2 };
  });
  const umOlho = k > 0 && r() < 0.4;  // quase acordando, às vezes abre só 1 olho
  return { tipo, t0, n, altos, estoura, tp, gotas, umOlho, dur, fim: t0 + dur };
}
// a 1ª bolha (estoura) e o 1º sonho (o bug) não dependem do sorteio: pra linha do tempo
const B0 = VAZIA + RESPIRA * Math.ceil((LACO + 1.2 - VAZIA) / RESPIRA - 1e-9), P0 = B0 + 2.5 * RESPIRA + TREME, S0 = LACO + JAN + 1.2;
function eventoEm(sem, t) {
  if (t < LACO) return null;
  const ev = evento(sem, Math.floor((t - LACO) / JAN));
  return ev && t >= ev.t0 && t < ev.fim ? ev : null;
}
// o z que nasce em tb fica calado se há bolha ou sonho (ou se vai começar já já)
function calado(sem, tb) {
  if (tb < LACO) return false;
  const ev = evento(sem, Math.floor((tb - LACO) / JAN));
  return !!ev && tb >= ev.t0 - 0.9 && tb < ev.fim - 0.3;
}

// ---------- a bolha ----------
const LO = 2;  // raio quando ele puxa o ar (não some de todo no meio da sessão)
// raio da bolha em t (0 = não tem), e se está tremendo
function raioBolha(ev, t) {
  const d = t - ev.t0;
  if (d < 0 || t >= ev.fim) return 0;
  const i = Math.floor(d / RESPIRA), f = d / RESPIRA - i;
  if (ev.estoura && (i > ev.n - 1 || (i === ev.n - 1 && f >= 0.5))) {
    if (t >= ev.tp) return 0;
    const segura = t - (ev.tp - TREME);
    return segura < 0 ? ev.altos[i] : ev.altos[ev.n - 1] + (Math.floor(segura / 0.06) % 2);  // treme
  }
  if (i >= ev.n) return 0;
  const s = 0.5 - 0.5 * Math.cos(2 * Math.PI * f);
  const lo = f < 0.5 ? (i === 0 ? 0 : LO) : (i === ev.n - 1 ? 0 : LO);
  return lo + (ev.altos[i] - lo) * s;
}
// onde fica a bolha de raio R: presa na frente do rosto, crescendo pra frente e um pouco pra cima
const centroBolha = (R, sy) => [Math.round(8 + R * 0.85), Math.round(-6.5 * sy - R * 0.45)];
function desenhaBolha(g, R, sy) {
  const r = Math.round(R);
  if (r < 1) return;
  const [cx, cy] = centroBolha(r, sy), img = bolhaDe(Math.min(11, r));
  g.drawImage(img, cx - r, cy - r, img.width, img.height);
}
// o estouro: tracinhos saindo da borda (0,08 s) e as gotas voando (0,4 s); d = s desde o estouro
function estouro(g, ev, d, sy) {
  if (d < 0 || d >= 0.45) return;
  const R = ev.altos[ev.n - 1], [cx, cy] = centroBolha(R, sy), a0 = g.globalAlpha;
  if (d < 0.09) {  // a bolha vira tracinhos que voam pra fora (pra cima e pra frente: nem no rosto nem no cartão)
    g.fillStyle = '#DBEAFE';
    for (const i of [5, 6, 7, 0, 1]) {
      const a = i * Math.PI / 4, rr = R + d * 30;
      for (const e of [0, 1.5]) {
        const x = Math.round(cx + Math.cos(a) * (rr + e)), y = Math.round(cy + Math.sin(a) * (rr + e));
        if (y < -1) g.fillRect(x, y, 1, 1);
      }
    }
  }
  for (const gt of ev.gotas) {
    const x = cx + Math.cos(gt.a) * (R + gt.v * d), y = cy + Math.sin(gt.a) * (R + gt.v * d) + 70 * d * d;
    if (y > -1) continue;
    g.globalAlpha = a0 * (d < 0.25 ? 1 : (0.45 - d) / 0.2);
    g.fillStyle = gt.w === 2 ? BOLHA_BORDA : '#FFFFFF';
    g.fillRect(Math.round(x), Math.round(y), gt.w, gt.w);
  }
  g.globalAlpha = a0;
}

// ---------- os olhos ----------
// roupas a mais no grid do Clawd (registrarRoupas, como as cenas do Dragon Ball): os olhos
// desenhados em 'k' (não piscam) nas meias-fileiras 2 e 3: olhando pra trás (x-) e pra frente
// (x+), feliz (^ ^ e bochecha corada, sonhando) e com 1 olho só aberto (o da frente; o de trás
// fica no risquinho de dormir).
const CORPO = ['...############...', '...############...', '...############...', '...############...', '.################.', '.################.', '...############...', '...############...', '....A.B....A.B....', '....A.B....A.B....'];
const marca = (l, cols, ch) => [...l].map((c, i) => (cols.includes(i) ? ch : c)).join('');
const comOlhos = (c2, c3, corado) => ({
  ...ROUPAS.clawd,
  linhas: CORPO.map((l, i) => (i === 2 ? marca(l, c2, 'k') : i === 3 ? marca(l, c3, 'k') : i === 4 && corado ? marca(l, [4, 5, 12, 13], 'b') : l)),
  cores: { ...ROUPAS.clawd.cores, k: '#1A1A1A', b: '#F4A4A4' },
});
const OLHOS = {
  tras: comOlhos([4, 11], [4, 11]), frente: comOlhos([6, 13], [6, 13]), feliz: comOlhos([5, 12], [4, 6, 11, 13], true),
  um: comOlhos([12], [5, 12]), umTras: comOlhos([11], [5, 11]), umFrente: comOlhos([13], [5, 13]),
};
const ROUPA = Object.fromEntries(Object.keys(OLHOS).map(k => [k, 'padrao-dorme-' + k]));
registrarRoupas(Object.fromEntries(Object.entries(OLHOS).map(([k, v]) => [ROUPA[k], v])));

// ---------- o Clawd na cena ----------
function respiro(t) { return 1 + 0.05 * Math.sin(2 * Math.PI * (t - 0.6) / RESPIRA); }
// a pose do Clawd em t (a entrada é a de sempre); ev = o evento agora
function poseClawd(t, ev) {
  if (t < 0.3) return { olhos: t > 0.25 ? 'fechados' : 'abertos' };
  if (t < 0.6) return { olhos: 'fechados', sentado: true, sy: 1 - 0.12 * Math.sin(Math.PI * (t - 0.3) / 0.3) };
  const p = { olhos: 'fechados', sentado: true, sy: respiro(t) };
  if (!ev) return p;
  if (ev.tipo === 'sonho') {
    const d = t - ev.t0;
    if (d >= 0.45 && d < ev.dur - 0.25) p.roupa = ROUPA.feliz;
    return p;
  }
  if (!ev.estoura || t < ev.tp) return p;
  // quase acorda: abre os olhos (às vezes só 1) num pulinho, olha pra trás e pra frente, pisca
  // devagar, suspira e dorme
  const d = t - ev.tp, um = ev.umOlho, aberto = um ? { roupa: ROUPA.um } : { olhos: 'abertos' };
  if (d < 0.07) return p;
  if (d < 0.32) { const u = (d - 0.07) / 0.25; return { ...p, ...aberto, y: -3 * Math.sin(Math.PI * u), sy: p.sy * (1 + 0.06 * Math.sin(Math.PI * u)) }; }
  if (d < 0.42) return { ...p, ...aberto };
  if (d < 0.78) return { ...p, roupa: um ? ROUPA.umTras : ROUPA.tras, x: -1 };      // olha pra trás
  if (d < 1.14) return { ...p, roupa: um ? ROUPA.umFrente : ROUPA.frente, x: 1 };   // olha pra frente
  if (d < 1.36) return { ...p, ...aberto };
  if (d < 1.46) return p;                                                   // pisca devagar
  if (d < 1.62) return { ...p, ...aberto };
  if (d < 1.95) return { ...p, sy: p.sy * (1 - 0.07 * Math.sin(Math.PI * (d - 1.62) / 0.33)) };  // suspira e dorme
  return p;
}
// o '!' do susto, em cima da cabeça (d = s desde o estouro)
function exclama(g, d, alfa = 1) {
  if (d < 0.1 || d >= 1.0) return;
  const img = sprites().exclama, e = d < 0.16 ? 1.35 : 1, a0 = g.globalAlpha;
  g.globalAlpha = a0 * alfa * (d < 0.85 ? 1 : (1.0 - d) / 0.15);
  const w = img.width * P * e, h = img.height * P * e;
  g.drawImage(img, Math.round(6 - w / 2), Math.round(-17 - h), w, h);
  g.globalAlpha = a0;
}

// ---------- z z z (os de sempre, calados durante bolha e sonho) ----------
// ate: só os que nasceram até esse instante (a saída); some: alfa extra
function zzz(g, t, sem, ate = Infinity, some = 1) {
  if (!(some > 0)) return;
  const zs = sprites().zs, ZP = 1.4, a0 = g.globalAlpha, ev = eventoEm(sem, Math.min(t, ate));
  for (let k = Math.max(0, Math.floor((t - 2.6) / 0.9)); 0.8 + 0.9 * k <= Math.min(t, ate); k++) {
    const nasce = 0.8 + 0.9 * k, e = t - nasce;
    if (e >= 1.8 || calado(sem, nasce)) continue;
    // começou bolha ou sonho: os z que ainda subiam apagam em 0,3 s
    const cala = ev && nasce < ev.t0 ? Math.max(0, 1 - (Math.min(t, ate) - ev.t0) / 0.3) : 1;
    if (!(cala > 0)) continue;
    const u = e / 1.8, z = zs[Math.min(2, Math.floor(u * 3))];
    g.globalAlpha = a0 * some * cala * (u < 0.1 ? u / 0.1 : u > 0.75 ? (1 - u) / 0.25 : 1);
    g.drawImage(z, 6 + 9 * u + Math.sin(u * 7) * 1.2, -12 - 16 * u - z.height * ZP, z.width * ZP, z.height * ZP);
  }
  g.globalAlpha = a0;
}

// ---------- o balão do sonho ----------
// a nuvem (56x34) com o canto de baixo em NX, NY; as bolinhas da cabeça até ela
const NX = -36, NY = -63;              // canto de cima à esquerda da nuvem
const CHAO_X = NX + 28, CHAO_Y = NY + 27;  // o chão do sonho (meio, embaixo do miolo)
const TRILHA = [[-1, -15, 0], [-4, -20, 1], [-8, -27, 2]];  // [x, y, qual] do centro das bolinhas
// o tamanho da nuvem (0..1,1) d s depois do começo do sonho: cresce de 0,3 a 0,55 (passa um
// pouco e volta), encolhe no fim; e se a bolinha i da trilha aparece
function escalaNuvem(ev, d) {
  const fecha = ev.dur - FECHA;
  if (d >= 0.3 && d < 0.55) { const u = (d - 0.3) / 0.25; return u < 0.7 ? 1.1 * sai(u / 0.7) : 1.1 - 0.1 * (u - 0.7) / 0.3; }
  if (d >= 0.55 && d < fecha + 0.1) return 1;
  if (d >= fecha + 0.1 && d < ev.dur) return 1 - sai((d - fecha - 0.1) / (ev.dur - fecha - 0.1));
  return 0;
}
const temBolinha = (ev, d, i) => d >= i * 0.1 && d < ev.dur - FECHA + 0.08 * (i + 1);
// o balão d s depois do começo do sonho. Saída: u = s desde o corte (tudo encolhe em 0,25 s,
// as bolinhas somem de baixo pra cima, o conteúdo some na hora)
function balao(g, ev, d, u = null) {
  const s = sprites();
  TRILHA.forEach(([x, y, q], i) => {
    if (!temBolinha(ev, d, i) || (u != null && u >= 0.07 * (i + 1))) return;
    const img = s.trilha[q];
    g.drawImage(img, x - (img.width >> 1), y - (img.height >> 1), img.width, img.height);
  });
  const e = escalaNuvem(ev, d) * (u == null ? 1 : 1 - sai(Math.min(1, u / 0.25)));
  if (e > 0.05) {
    const w = Math.round(56 * e), h = Math.round(34 * e);
    g.drawImage(s.nuvem, Math.round(NX + 28 - w / 2), Math.round(NY + 34 - h + 3 * (1 - e)), w, h);
  }
  if (u == null && d >= ABRE && d < ev.dur - FECHA) conteudo(g, ev.qual, d - ABRE);
}

// o conteúdo de cada sonho; tau = s desde que a nuvem abriu; (CHAO_X, CHAO_Y) = o chão
function conteudo(g, qual, tau) {
  const s = sprites(), X = CHAO_X, Y = CHAO_Y;
  if (qual === 'bug') {
    // bug chega 0–1,0 · Clawd pequeno agacha 1,0–1,15 · pulo 1,15–1,5 · pisa em 1,5 (achata, vermelho)
    // · volta 1,6–1,95 · fumaça 1,65–2,25 · pulinhos de alegria 2,3–2,9
    const pisa = 1.5, bx0 = X + 2, bx = tau < 1 ? bx0 + 9 * (1 - tau) : bx0;
    let perna = Math.floor(tau / 0.1) % 2 ? 'q' : 'p', verm = false, sy = 1;
    if (tau >= 1 && tau < pisa) perna = Math.floor(tau / 0.25) % 2 ? 'q' : 'p';
    if (tau >= pisa) { sy = Math.max(0.3, 1 - (tau - pisa) / 0.06 * 0.7); verm = tau - pisa < 0.15; perna = 'p'; }
    if (tau < 1.65) {
      g.save(); g.translate(Math.round(bx), Y); g.scale(1, sy); g.drawImage(s.bugs[perna + (verm ? 'v' : '')], 0, -8, 13, 8); g.restore();
    }
    g.save(); g.translate(bx0 + 6.5, Y - 2); g.scale(0.5, 0.5); fumacaBug(g, 0, 0, tau - 1.65); g.restore();
    const cx0 = X - 13, alvo = bx0 + 6.5;
    let x = cx0, y = 0, sq = 1, olhos = 'abertos';
    if (tau >= 1 && tau < 1.15) sq = 1 - 0.15 * Math.sin(Math.PI * (tau - 1) / 0.15);
    else if (tau >= 1.15 && tau < pisa) { const u = (tau - 1.15) / (pisa - 1.15); x = cx0 + (alvo - cx0) * u; y = -6 * u - 9 * Math.sin(Math.PI * u); }
    else if (tau >= pisa && tau < 1.6) { x = alvo; y = -6 + 3 * Math.min(1, (tau - pisa) / 0.06); }
    else if (tau >= 1.6 && tau < 1.95) { const u = (tau - 1.6) / 0.35; x = alvo + (cx0 - alvo) * u; y = -3 * (1 - u) - 7 * Math.sin(Math.PI * u); }
    else if (tau >= 2.3 && tau < 2.9) { const u = ((tau - 2.3) % 0.3) / 0.3; y = -3 * Math.sin(Math.PI * u); olhos = 'cima'; }
    miniClawd(g, x, Y + y, sq, olhos);
  } else if (qual === 'cafe') {
    // caneca chega 0–0,25 (2 DIP por pixel: o sonho é de perto) · fumacinha · corações sobem em 0,8 e 2,1
    const e = tau < 0.25 ? sai(tau / 0.25) : 1, w = 14, h = 10, mx = X - 8, my = Y;
    g.save(); g.translate(mx + w / 2, my); g.scale(e, e); g.drawImage(s.caneca, -w / 2, -h, w, h); g.restore();
    if (tau >= 0.3) {
      const a0 = g.globalAlpha;
      g.fillStyle = '#E5E7EB';
      for (let j = 0; j < 4; j++) {  // 2 fios de fumaça ondulando
        const f = (tau * 0.8 + j / 4) % 1, fio = j % 2;
        g.globalAlpha = a0 * (1 - f);
        g.fillRect(mx + 3 + 5 * fio + Math.sin(f * 7 + fio * 3) * 1.5, my - h - 1.5 - f * 8, 1.5, 1.5);
      }
      for (const c0 of [0.8, 2.1]) {
        const dc = tau - c0;
        if (dc < 0 || dc >= 1.6) continue;
        const u = dc / 1.6;
        g.globalAlpha = a0 * (u < 0.7 ? 1 : (1 - u) / 0.3);
        g.drawImage(s.coracao, Math.round(mx + 10 + 2 * Math.sin(u * 5)), Math.round(my - h - 5 - 6 * sai(u)), 7.5, 6);
      }
      g.globalAlpha = a0;
    }
  } else if (qual === 'teste') {
    // 5 testes passando (0,3 s cada, a barra enche junto) · ✓ grande em 2,0 (com brilho)
    const n = Math.max(0, Math.min(5, Math.floor((tau - 0.2) / 0.3) + 1)), x0 = X - 12, y0 = Y - 13;
    if (tau < 2.0) {
      for (let i = 0; i < 5; i++) { g.fillStyle = i < n ? '#22C55E' : '#52525B'; g.fillRect(x0 + 5 * i, y0, 3, 3); }
      g.fillStyle = '#3F3F46'; g.fillRect(x0, y0 + 6, 23, 3);
      g.fillStyle = '#22C55E'; g.fillRect(x0, y0 + 6, Math.round(23 * n / 5), 3);
    } else {
      const u = tau - 2.0, e = u < 0.12 ? u / 0.12 * 1.3 : u < 0.22 ? 1.3 - 0.3 * (u - 0.12) / 0.1 : 1;
      const w = 14 * e, h = 12 * e;
      g.drawImage(s.check, Math.round(X - w / 2), Math.round(Y - 10 - h / 2), w, h);
      if (u >= 0.2 && Math.floor(u / 0.18) % 2 === 0) {
        g.fillStyle = '#FACC15';
        for (const [bx, by] of [[-12, -18], [11, -20], [-10, -5], [12, -7]]) g.fillRect(X + bx, Y + by, 1.5, 1.5);
      }
    }
  } else if (qual === 'foguete') {
    // deploy: treme no chão 0–0,6 (fumaça) · sobe 0,6–1,4 · voa (as estrelas passam) até o fim
    const fw = 7 * P, fh = 9 * P, fx = X - fw / 2, sobe = tau < 0.6 ? 0 : Math.min(1, (tau - 0.6) / 0.8);
    const treme = tau < 0.6 && Math.floor(tau / 0.05) % 2 ? 0.75 : 0;
    const base = Y - 1 - 6 * sai(sobe) - (sobe >= 1 ? Math.sin((tau - 1.4) * 5) : 0);
    if (sobe > 0.3) {  // estrelas descendo (o foguete sobe)
      g.fillStyle = '#9CA3AF';
      for (const [sx, f] of [[-17, 0], [-11, 0.55], [10, 0.25], [16, 0.8], [-21, 0.4], [21, 0.1]]) {
        const yy = Y - 21 + ((tau * 1.3 + f) % 1) * 17;
        g.fillRect(X + sx, Math.round(yy), 1, 2);
      }
    }
    if (tau >= 0.15) {  // fogo
      const pisca = Math.floor(tau / 0.08) % 2, ch = sobe > 0 ? 3 + 1.5 * pisca : 1.5;
      g.fillStyle = pisca ? '#FACC15' : '#F97316'; g.fillRect(fx + 2 * P, base, 3 * P, ch);
      g.fillStyle = '#FDE68A'; g.fillRect(fx + 3 * P, base, P, ch + 1.5);
    }
    if (tau < 1.2) {  // fumaça no chão
      g.fillStyle = '#9CA3AF';
      for (let i = 0; i < 4; i++) {
        const f = (tau * 1.6 + i / 4) % 1, lado = i % 2 ? 1 : -1;
        g.fillRect(X + lado * (3 + 8 * f) - 1, Y - 1.5 - 2 * f, 2, 1.5);
      }
    }
    g.drawImage(s.foguete, fx + treme, base - fh, fw, fh);
  } else if (qual === 'tarefas') {
    // 3 tarefas (palavras de 2 DIP), riscadas em 0,5 / 1,2 / 1,9: a caixa fica verde e um risco
    // verde passa da esquerda pra direita por cima das palavras (que apagam)
    const x0 = X - 13, y0 = Y - 19;
    PALAVRAS.forEach((pal, i) => {
      const y = y0 + 6 * i, f = Math.max(0, Math.min(1, (tau - (0.5 + 0.7 * i)) / 0.3));
      g.fillStyle = f > 0 ? '#22C55E' : '#9CA3AF'; g.fillRect(x0, y, 4, 4);
      if (f <= 0) { g.fillStyle = NUVEM_MIOLO; g.fillRect(x0 + 1, y + 1, 2, 2); }
      let x = x0 + 7;
      g.fillStyle = f >= 1 ? '#71717A' : '#E5E7EB';
      for (const w of pal) { g.fillRect(x, y + 1, w, 2); x += w + 2; }
      if (f > 0) { g.fillStyle = '#22C55E'; g.fillRect(x0 + 6, y + 1.5, Math.round((x - x0 - 6) * f), 1); }
    });
  }
}
const PALAVRAS = [[5, 7, 4], [8, 6], [4, 6, 5]];
// o Clawd pequeno do sonho (1 DIP por célula: 18x10)
function miniClawd(g, x, y, sq, olhos) {
  const spr = spriteClawd('clawd', 'ambas', olhos, false);
  g.save(); g.translate(Math.round(x), Math.round(y)); g.scale(1, sq); g.drawImage(spr, -9, -10, 18, 10); g.restore();
}
// fumaça do bug (igual ao tema): 8 quadradinhos que nascem numa roda, sobem e crescem por 0,6 s
function fumacaBug(g, cx, cy, d) {
  if (d < 0 || d >= 0.6) return;
  g.save(); g.globalAlpha *= 1 - d / 0.6;
  const w = 3 + 5 * d;
  VOOS.forEach(([vx, vy], i) => {
    g.fillStyle = i % 2 ? '#9CA3AF' : '#E5E7EB';
    g.fillRect(cx + vx * (0.06 + d * 0.3) - w / 2, cy + vy * (0.06 + d * 0.2) - 10 * d - w / 2, w, w);
  });
  g.restore();
}

// ---------- a cena ----------
function quadroCena(g, t, sem) {
  const ev = eventoEm(sem, t), bolha = ev && ev.tipo === 'bolha';
  if (bolha && ev.estoura && t >= ev.tp) estouro(g, ev, t - ev.tp, respiro(ev.tp));  // o respingo, atrás dele
  desenhaClawd(g, poseClawd(t, ev));
  if (bolha) {
    const R = raioBolha(ev, t);
    if (R > 0) desenhaBolha(g, R, respiro(t));  // a bolha, na frente do rosto
    if (ev.estoura && t >= ev.tp) exclama(g, t - ev.tp);
  } else if (ev && ev.tipo === 'sonho') balao(g, ev, t - ev.t0);
  zzz(g, t, sem);
}

module.exports = {
  texturas: [],
  linhaDoTempo: [
    [0, 'em pé, normal'], [0.25, 'fecha os olhos'], [0.3, 'senta e respira (a cada 1,6 s)'], [0.8, 'z z z subindo'],
    [B0, 'bolha no nariz: enche quando ele solta o ar, murcha quando puxa (os z param)'],
    [P0 - TREME - RESPIRA / 2, 'a bolha cresce demais e treme'],
    [P0, 'estoura (respingo): quase acorda, abre os olhos, "!", olha pra trás e pra frente'],
    [P0 + 1.62, 'suspira e volta a dormir (z z z)'],
    [S0, 'sonho de dev: balão com um Clawd pequeno pisando no bug; ele sorri dormindo (^ ^)'],
    [S0 + ABRE + DUR_SONHO.bug + FECHA, `depois, até algo rodar: a cada ${JAN} s uma bolha (4 em 10 estouram; às vezes ele abre 1 olho só) ou um sonho (café, testes passando, deploy, tarefas riscadas, bug: os 5 a cada 5 sonhos); às vezes só z z z`],
  ],
  cena(m) {
    const sem = Math.floor(m.sorteio() * 4294967296);
    m.estado.dormeSemente = sem;
    return {
      nome: 'parado', dur: Infinity, espaco: { frente: 0, tras: 0 }, modos: ['parado'],
      quadro(g, t) { quadroCena(g, t, sem); },
    };
  },
  // algo voltou a rodar: a espreguiçada de sempre (0,6 s); o que estava no ar some antes de 0,45 s
  saida: {
    dur: 0.6,
    quadro(g, u, m, tCorte) {
      const sem = (m.estado.dormeSemente || 0) >>> 0, c = Math.max(0, tCorte || 0);
      const ev = eventoEm(sem, c), bolha = ev && ev.tipo === 'bolha';
      if (bolha) {  // a bolha que estava no ar estoura na hora; o respingo de antes termina de cair
        const R = raioBolha(ev, c);
        if (R >= 1) estouro(g, { ...ev, altos: [...ev.altos.slice(0, -1), Math.round(R)] }, u, respiro(c));
        if (ev.estoura && c >= ev.tp) estouro(g, ev, c - ev.tp + u, respiro(ev.tp));
      }
      desenhaClawd(g, { sy: u < 0.3 ? 1 + 0.1 * Math.sin(Math.PI * u / 0.3) : 1 });
      if (bolha && ev.estoura && c >= ev.tp) exclama(g, c - ev.tp, 1 - Math.min(1, u / 0.15));
      else if (ev && ev.tipo === 'sonho') balao(g, ev, c - ev.t0, u);
      zzz(g, c + u, sem, c, 1 - Math.min(1, u / 0.25));
    },
  },
  // pros testes e pras fotos: o evento da janela k (bolha, sonho ou null)
  _teste: { evento, eventoEm, LACO, JAN },
};
