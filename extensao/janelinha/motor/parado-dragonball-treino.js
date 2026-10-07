'use strict';
// Tema Dragon Ball, parado há muito tempo: TREINO. O Clawd de gi faz séries de exercício em
// cima da borda do cartão, com o contador de repetições em cima dele (a fonte do visor), até
// algo voltar a rodar. Cada série é um bloco de BLOCO s: entra na posição, faz as repetições
// (1, 2, 3...), o número fica dourado, levanta e descansa (ofega, enxuga o rosto com a toalha,
// alonga; 1 em 4 descansos solta o ki, a aura do tema). As séries pares são de flexões e as
// ímpares sorteiam abdominais ou socos de kata: sempre troca. Depois de um tempo de série ele
// começa a suar (gotinhas saltam da cabeça no esforço de cada repetição); a toalha enxuga.
// O contador recomeça em cada série (no máximo 2 algarismos, calmo de olhar por horas): um
// número que só cresce chegaria a 4 algarismos em 3 h e a série dá o ritmo do treino.
// Saída (algo voltou a rodar): levanta, sacode o suor e fica em pé normal no mesmo lugar.
// Deitado, o Clawd é pixel art nova no tamanho de pixel dele (de lado, inclinado em degraus
// ou girado em células: nada de rotação borrada). Tudo função do tempo: o bloco
// k = floor((t - INICIO) / BLOCO) é sorteado com rng(semente + k), nunca com contador.
const { lim, sai, entra, cache, tela, arte, tingida, rng, rgba } = require('./comum');
const A = require('./dragonball-arte');

const P = 1.5;               // px do Clawd (meia-fileira)
const INICIO = 0.35;         // s em pé normal antes da 1ª série
const BLOCO = 42;            // s por série (entra + repetições + levanta + descanso)
const ENTRA = 0.5, SAI = 0.45;
const SUOR_1 = 12, SUOR = 7; // s de série até começar a suar (a 1ª demora mais; depois já está quente)
const COR_N = '#E7E5E4', COR_FIM = '#FDE047';
const sementes = new WeakMap();  // mundo -> semente da cena (a saída precisa saber o que ele fazia)

// o que o Clawd veste agora (cópia do vestir() do tema-dragonball.js, que não exporta)
function vestir(m) {
  const tr = m.estado && m.estado.tr, R = { ta: m.T };
  if (!tr) return R;
  return { ...R, ...A.efeitoTransf(tr.v, m.T - tr.t0, tr.tv0 != null ? m.T - tr.tv0 : null, m.T).R };
}

// ---------- os exercícios ----------
// per = s por repetição; conta = fração do ciclo em que a repetição conta (o ponto alto)
const EXERC = {
  flexao: { per: 1.7, conta: 1 },
  abdominal: { per: 1.5, conta: 0.55 },
  soco: { per: 1.25, conta: 0.12 },
};

// O Clawd deitado, de lado (olhando pra frente, x+), em células de 1,5 px: pés à esquerda,
// cabelo à direita. Flexão: de barriga pra baixo (costas em cima). Abdominal: de costas.
// b bota, p perna, g gi, z dobra, f faixa, u gola, # pele, o olho, h cabelo, j brilho.
const PRANCHA = [
  '...........h.h..',
  '....gfgg###hhjh.',
  '....gfgg#o#hhhhh',
  '.pppgfgu###hhhh.',
  'bpppgfgu###hhhhh',
];
// abdominal: o tronco de costas (a barriga e o olho pra cima, a cabeça à direita), girado em volta
// do quadril (canto de baixo à esquerda); as pernas dobradas ficam paradas à esquerda
const TRONCO = [
  '.........h.h',
  'gfgu###hhhhh',
  'gfgu#o#hhhh.',
  'gfgg###hhhhh',
  'gfgg###hhjh.',
];
const PERNAS = ['..p..', '.p.p.', 'p...p', 'b...p'];  // o joelho pra cima, a bota no chão
function coresDe(R) {
  const D = A.DB, cab = R.cabelo || [D.cabelo, D.cabeloLuz];
  return { b: D.azul, p: D.gi, g: D.gi, z: D.giDobra, f: D.azul, u: D.azulEsc, '#': D.corpo, o: D.olho, h: cab[0], j: cab[1] };
}
// O corpo inclinado: cada coluna sobe (base + round(nivel * (x - pivo) / resto)) células (degrau de
// pixel art: as colunas ficam inteiras, nada de rotação borrada). Pronta 1x por nível e guardada.
const NMAX = 6;
const desloc = (x, nivel, pivo, W, base) => (x <= pivo ? 0 : base + Math.round(nivel * (x - pivo) / (W - 1 - pivo)));
const CIS = cache(64);
function inclinado(linhas, cores, nivel, pivo, base) {
  const chave = linhas[1] + JSON.stringify(cores) + nivel + ',' + pivo + ',' + base;
  const pronta = CIS.get(chave);
  if (pronta) return pronta;
  const art = arte(linhas, cores), W = art.width, H = art.height;
  const c = tela(W, H + NMAX), k = c.getContext('2d');
  for (let x = 0; x < W; x++) k.drawImage(art, x, 0, 1, H, x, NMAX - desloc(x, nivel, pivo, W, base), 1, H);
  return CIS.set(chave, c);
}
// desenha o sprite deitado começando em x0 (px), o chão em y = 0; tinta = a do Kaioken
function deitado(g, linhas, R, nivel, pivo, base, x0) {
  const cores = coresDe(R), spr = inclinado(linhas, cores, nivel, pivo, base), w = spr.width * P, h = spr.height * P;
  g.drawImage(spr, x0, -h, w, h);
  const tinta = R.tinta;
  if (tinta && tinta.a > 0) {
    g.save(); g.globalAlpha *= tinta.a;
    g.drawImage(tingida(spr, tinta.cor, 'treino' + linhas[1] + nivel + pivo + base + JSON.stringify(cores)), x0, -h, w, h);
    g.restore();
  }
}
const W_D = PRANCHA[0].length;
const X_PE = -Math.round(W_D * P / 2);  // o corpo deitado fica centrado no lugar dele em pé
const OMBRO = 8;    // coluna do ombro na prancha (o braço desce dali)
// flexão no nível n (0 = embaixo, 3 = em cima): os pés no chão, o corpo 1 célula acima e inclinado
function prancha(g, R, n) {
  deitado(g, PRANCHA, R, n, 0, 1, X_PE);
  const s = desloc(OMBRO, n, 0, W_D, 1), x = X_PE + OMBRO * P, D = A.DB;
  g.fillStyle = D.corpo;
  g.fillRect(x + P, -P, P, P);                         // a mão no chão (os dedos pra frente)
  if (s >= 2) {                                        // braço esticado: do chão até o meio do corpo
    g.fillRect(x, -(s + 2) * P, P, (s + 2) * P);
    g.fillStyle = D.azul; g.fillRect(x, -2 * P, P, P);   // munhequeira
  } else {                                             // embaixo: o cotovelo dobra pra trás e sobe
    g.fillRect(x, -(s + 2) * P, P, (s + 2) * P);
    g.fillRect(x - P, -(s + 3) * P, P, 2 * P);
  }
}
// Giro em células (vizinho mais próximo, 1x por ângulo e guardado): pixel art girada sem borrar.
// ang em graus, + = anti-horário na tela; (px, py) = o pivô em células. Devolve a arte e onde o
// pivô ficou nela.
const GIROS = cache(32);
function girada(linhas, ang, px, py) {
  const chave = linhas.join('|') + ang + ',' + px + ',' + py;
  const pronta = GIROS.get(chave);
  if (pronta) return pronta;
  const H = linhas.length, W = linhas[0].length, C = W + H, c = Math.cos(ang * Math.PI / 180), s = Math.sin(ang * Math.PI / 180);
  const grade = [];
  let x0 = Infinity, y0 = Infinity, x1 = -1, y1 = -1;
  for (let oy = 0; oy < 2 * C; oy++) {
    let lin = '';
    for (let ox = 0; ox < 2 * C; ox++) {
      const dx = ox + 0.5 - C, dy = oy + 0.5 - C, sx = Math.floor(dx * c - dy * s + px), sy = Math.floor(dx * s + dy * c + py);
      const ch = sx >= 0 && sy >= 0 && sx < W && sy < H ? linhas[sy][sx] : '.';
      if (ch !== '.') { x0 = Math.min(x0, ox); x1 = Math.max(x1, ox); y0 = Math.min(y0, oy); y1 = Math.max(y1, oy); }
      lin += ch;
    }
    grade.push(lin);
  }
  // o olho é 1 célula: o vizinho mais próximo pode pular ele; põe onde o centro dele cai
  linhas.forEach((l, y) => [...l].forEach((ch, x) => {
    if (ch !== 'o') return;
    const dx = x + 0.5 - px, dy = y + 0.5 - py, ox = Math.floor(C + dx * c + dy * s), oy = Math.floor(C - dx * s + dy * c);
    grade[oy] = grade[oy].slice(0, ox) + 'o' + grade[oy].slice(ox + 1);
  }));
  const g = { linhas: grade.slice(y0, y1 + 1).map(l => l.slice(x0, x1 + 1)), px: C - x0, py: C - y0 };
  return GIROS.set(chave, g);
}
const ANG_ABD = [0, 20, 40, 60, 76];
const X_QUADRIL = -3;  // onde fica o quadril do abdominal (px)
// abdominal no nível n (0 = deitado, 4 = sentado)
function abdominal(g, R, n) {
  const D = A.DB, cores = coresDe(R), gi = girada(TRONCO, ANG_ABD[n], 0, TRONCO.length);
  const img = arte(gi.linhas, cores);
  g.drawImage(img, X_QUADRIL - gi.px * P, -gi.py * P, img.width * P, img.height * P);
  if (R.tinta && R.tinta.a > 0) {
    g.save(); g.globalAlpha *= R.tinta.a;
    g.drawImage(tingida(img, R.tinta.cor, 'treinoAbd' + n + JSON.stringify(cores)), X_QUADRIL - gi.px * P, -gi.py * P, img.width * P, img.height * P);
    g.restore();
  }
  g.drawImage(arte(PERNAS, { p: D.gi, b: D.azul }), X_QUADRIL - 5 * P, -4 * P, 5 * P, 4 * P);
}

// ---------- o bloco k ----------
function bloco(semente, k) {
  const r = rng((semente + k * 7919) >>> 0);
  const ex = k % 2 === 0 ? 'flexao' : r() < 0.5 ? 'abdominal' : 'soco';
  const E = EXERC[ex], descanso = 6.5 + 2.5 * r();
  const reps = Math.max(4, Math.floor((BLOCO - ENTRA - SAI - descanso) / E.per));
  const fimReps = ENTRA + reps * E.per;
  const alonga = r() < 0.5 ? 'cima' : 'lados', ki = k > 0 && r() < 0.25;  // 1 em 4 descansos: solta o ki
  return { k, ex, E, reps, fimReps, descanso: fimReps + SAI, alonga: ki ? 'ki' : alonga, semente };
}
// onde está no bloco: { b, u } (u = s desde o começo do bloco), ou null antes da 1ª série
function ondeEsta(semente, t) {
  if (t < INICIO) return null;
  const k = Math.floor((t - INICIO) / BLOCO);
  return { b: bloco(semente, k), u: t - INICIO - k * BLOCO };
}
// repetições já feitas (o contador)
function feitas(b, u) {
  if (u < ENTRA) return 0;
  return Math.min(b.reps, Math.floor((u - ENTRA) / b.E.per + 1 - b.E.conta));
}
// suor 0..1: começa depois de SUOR s de série, cresce em 8 s, a toalha zera
function suor(b, u) {
  const t0 = ENTRA + (b.k === 0 ? SUOR_1 : SUOR);
  const s = lim((u - t0) / 8, 0, 1);
  const enx = b.descanso + 1.2;  // enxuga de enx a enx + 1,6
  return s * (1 - lim((u - enx) / 1.6, 0, 1));
}

// ---------- a pose num instante (função pura) ----------
// devolve { tipo: 'pe', p (pro clawdDB), soco, toalha } | { tipo: 'prancha', n } | { tipo: 'abdominal', n },
// e cabeca: [x, y] (de onde sai o suor)
const CAB_PE = [0, -17], CAB_PRANCHA = n => [X_PE + 14 * P, -(7 + n) * P], CAB_ABD = n => { const a = ANG_ABD[n] * Math.PI / 180, r = 10 * P; return [X_QUADRIL + r * Math.cos(a), -2 * P - r * Math.sin(a)]; };
function pose(semente, t) {
  const o = ondeEsta(semente, t);
  if (!o) return { tipo: 'pe', p: {}, cabeca: CAB_PE };
  const { b, u } = o, ex = b.ex;
  // entrando na posição: agacha e cai deitado (ou fica na base do kata)
  if (u < ENTRA) {
    if (ex === 'soco') return { tipo: 'pe', p: { sy: 1 - 0.08 * Math.sin(Math.PI * lim(u / ENTRA, 0, 1)) }, cabeca: CAB_PE };
    if (u < 0.22) return { tipo: 'pe', p: { sy: 1 - 0.14 * sai(u / 0.22) }, cabeca: CAB_PE };
    return ex === 'flexao' ? { tipo: 'prancha', n: 3, cabeca: CAB_PRANCHA(3), poeira: u - 0.22 } : { tipo: 'abdominal', n: 0, cabeca: CAB_ABD(0), poeira: u - 0.22 };
  }
  if (u < b.fimReps) {
    const f = (((u - ENTRA) / b.E.per) % 1 + 1) % 1;
    if (ex === 'flexao') {
      // em cima 0–0,25 · desce 0,25–0,6 · embaixo 0,6–0,68 · sobe 0,68–1 (conta ao chegar em cima)
      let v = 1;
      if (f >= 0.25 && f < 0.6) v = 1 - suave((f - 0.25) / 0.35);
      else if (f >= 0.6 && f < 0.68) v = 0;
      else if (f >= 0.68) v = suave((f - 0.68) / 0.32);
      const n = Math.round(3 * v);
      return { tipo: 'prancha', n, cabeca: CAB_PRANCHA(n) };
    }
    if (ex === 'abdominal') {
      // deitado 0–0,3 · sobe 0,3–0,55 (conta) · em cima 0,55–0,7 · desce 0,7–1
      let v = 0;
      if (f >= 0.3 && f < 0.55) v = suave((f - 0.3) / 0.25);
      else if (f >= 0.55 && f < 0.7) v = 1;
      else if (f >= 0.7) v = 1 - suave((f - 0.7) / 0.3);
      const n = Math.round(4 * v);
      return { tipo: 'abdominal', n, cabeca: CAB_ABD(n) };
    }
    // soco: estica 0–0,12 (conta) · segura até 0,35 · recolhe até 0,6 · guarda
    const i = Math.floor((u - ENTRA) / b.E.per), lado = i % 2 ? -1 : 1;
    let e = 0;
    if (f < 0.12) e = sai(f / 0.12); else if (f < 0.35) e = 1; else if (f < 0.6) e = 1 - (f - 0.35) / 0.25;
    return { tipo: 'pe', p: { x: e > 0.5 ? lado * P : 0 }, soco: { lado, e, f }, cabeca: CAB_PE };
  }
  // levantando
  const d = u - b.fimReps;
  if (d < SAI && ex !== 'soco') {
    if (d < 0.12) return ex === 'flexao' ? { tipo: 'prancha', n: 3, cabeca: CAB_PRANCHA(3) } : { tipo: 'abdominal', n: 0, cabeca: CAB_ABD(0) };
    const v = (d - 0.12) / (SAI - 0.12);
    return { tipo: 'pe', p: { sy: 0.86 + 0.14 * sai(v) + 0.04 * Math.sin(Math.PI * v) }, cabeca: CAB_PE, poeira: d - 0.12 };
  }
  if (d < SAI) return { tipo: 'pe', p: {}, cabeca: CAB_PE };
  // descanso: ofega · enxuga com a toalha · alonga · respira
  const q = u - b.descanso;
  if (q < 1.2) return { tipo: 'pe', p: { sy: 1 + 0.03 * Math.sin(2 * Math.PI * q / 0.6) }, cabeca: CAB_PE };
  if (q < 2.8) {
    const w = (q - 1.2) / 1.6;
    return { tipo: 'pe', p: { olhos: 'fechados', bracos: [0, -3] }, toalha: w, cabeca: CAB_PE };
  }
  if (q < 5.0) {
    const w = (q - 2.8) / 2.2;
    if (b.alonga === 'ki') {  // agacha, fecha os olhos e a aura do tema sobe, segura e se apaga
      const e = q - 2.8, sobe = sai(lim((e - 0.3) / 0.35, 0, 1)) * (1 - lim((e - 1.6) / 0.6, 0, 1));
      const p = { sy: 1 - 0.1 * sai(lim(e / 0.3, 0, 1)) * (1 - lim((e - 0.3) / 0.2, 0, 1)), olhos: e < 1.7 ? 'fechados' : 'abertos', ta: t };
      if (e >= 0.3 && e < 0.6) p.x = Math.floor(e / 0.05) % 2 ? 0.75 : -0.75;
      if (sobe > 0) Object.assign(p, { aura: sobe, auraCor: A.DB.aura, auraEstilo: {} });
      return { tipo: 'pe', p, cabeca: CAB_PE };
    }
    if (b.alonga === 'cima') {
      const sobe = sai(lim(w / 0.25, 0, 1)) * (1 - entra(lim((w - 0.8) / 0.2, 0, 1)));
      return { tipo: 'pe', p: { sy: 1 + 0.07 * sobe, bracos: [-4.5 * sobe, -4.5 * sobe], olhos: sobe > 0.5 ? 'fechados' : 'abertos' }, cabeca: CAB_PE };
    }
    const lado = w < 0.5 ? -1 : 1, v = Math.sin(Math.PI * ((w % 0.5) / 0.5));
    return { tipo: 'pe', p: { rot: 8 * lado * v, bracos: lado < 0 ? [0, -4.5 * v] : [-4.5 * v, 0], olhos: 'fechados' }, cabeca: CAB_PE };
  }
  const pisca = (q - 5) % 3.3 > 3.15;
  return { tipo: 'pe', p: { sy: 1 + 0.02 * Math.sin(2 * Math.PI * (q - 5) / 1.6), olhos: pisca ? 'fechados' : 'abertos' }, cabeca: CAB_PE };
}
const suave = u => u * u * (3 - 2 * u);

// ---------- desenho ----------
function desenhaPose(g, ps, R) {
  if (ps.tipo === 'prancha') prancha(g, R, ps.n);
  else if (ps.tipo === 'abdominal') abdominal(g, R, ps.n);
  else {
    const p = { ...R, ...ps.p };
    if (ps.soco) p.mao = (k, dy) => soco(k, ps.soco, dy);
    if (ps.toalha != null) p.mao = (k, dy) => toalha(k, ps.toalha, dy);
    A.clawdDB(g, p);
  }
  if (ps.poeira != null) poeira(g, ps.poeira);
}
// o soco: do toco do braço (2x2 células, munhequeira + mão) sai o antebraço, a munhequeira e o
// punho, esticando pro lado (lado 1 = frente); um risquinho de vento no fim
function soco(g, s, dy) {
  const D = A.DB, ext = Math.round(5 * s.e) * P;
  if (ext <= 0) return;
  const y = -9 + dy, ombro = s.lado > 0 ? 12 : -12, dir = s.lado;
  const ponta = ombro + dir * ext;                        // onde o punho termina
  const x = (a, w) => (dir > 0 ? a : a - w);             // retângulo a partir de a, pra fora
  g.fillStyle = D.corpo; g.fillRect(x(ombro, ext), y, ext, P);                // antebraço
  g.fillStyle = D.azul; g.fillRect(x(ponta - dir * 3 * P, P), y, P, 2 * P);   // munhequeira
  g.fillStyle = D.corpo; g.fillRect(x(ponta - dir * 2 * P, 2 * P), y, 2 * P, 2 * P);  // punho
  if (s.f >= 0.04 && s.f < 0.3) {  // dois risquinhos de vento atrás do punho
    g.fillStyle = rgba('#FFFFFF', 0.85 * (1 - (s.f - 0.04) / 0.26));
    const w = Math.min(ext - P, 3 * P);
    if (w > 0) { g.fillRect(x(ponta - dir * (3 * P + w), w), y - P, w, P * 0.5); g.fillRect(x(ponta - dir * (3 * P + w), w), y + 2.5 * P, w, P * 0.5); }
  }
}
// a toalha: um pano branco (dobra cinza, a ponta pendurada) na mão levantada, esfregando o rosto em
// voltinhas (w 0..1 = 3 voltas)
function toalha(g, w, dy) {
  const a = w * 6 * Math.PI, x = 3 + Math.round(Math.cos(a)) * P, y = -15 + Math.round(Math.sin(a)) * P + dy;
  g.fillStyle = '#F5F5F4'; g.fillRect(x, y, 4 * P, 3 * P); g.fillRect(x + 3 * P, y + 3 * P, P, 2 * P);
  g.fillStyle = '#D6D3D1'; g.fillRect(x, y + 2 * P, 3 * P, P); g.fillRect(x + 3 * P, y + 4.5 * P, P, P * 0.5);
}
// poeirinha quando ele deita ou levanta (d = s desde a troca)
function poeira(g, d) {
  if (d < 0 || d >= 0.35) return;
  const u = d / 0.35;
  for (let j = 0; j < 6; j++) {
    const lado = j % 2 ? 1 : -1, x = lado * (8 + 10 * sai(u) + (j >> 1) * 4), y = -P - Math.floor(j / 2) * P * sai(u);
    g.fillStyle = rgba(j % 3 ? '#A8A29E' : '#D6D3D1', 1 - u);
    g.fillRect(Math.round(x / P) * P, Math.round(y / P) * P, P, P);
  }
}
// gotinhas de suor: saltam da cabeça no esforço de cada repetição (embaixo na flexão, em cima no
// abdominal, no soco), uma ou duas conforme o suor; no descanso, ofegando, até a toalha. Vivem VIDA s.
const VIDA = 0.5, ESFORCO = { flexao: 0.62, abdominal: 0.55, soco: 0.1 }, OFEGA = 0.45;
function gotas(g, semente, t) {
  const o = ondeEsta(semente, t);
  if (!o) return;
  const { b, u } = o, per = b.E.per, ef = ESFORCO[b.ex];
  const emite = (ti, chave) => {
    const d = u - ti, S = suor(b, ti);
    if (d < 0 || d >= VIDA || S <= 0) return;
    const r = rng((b.semente * 31 + b.k * 977 + chave * 13 + 5) >>> 0), ps = pose(b.semente, t - d), [cx, cy] = ps.cabeca;
    for (let j = 0; j < 2; j++) {
      const sorte = r(), vx = (r() - 0.5) * 60, vy = -(35 + 25 * r());
      if (sorte > S * (j ? 0.5 : 1)) continue;
      const x = cx + (ps.tipo === 'pe' ? Math.sign(vx) * 8 : 0) + vx * d, y = cy + vy * d + 200 * d * d;
      if (y < -2) gota(g, x, y, d > VIDA - 0.15 ? (VIDA - d) / 0.15 : 1);
    }
  };
  const i0 = Math.max(0, Math.floor((u - VIDA - ENTRA) / per - ef)), i1 = Math.min(b.reps - 1, Math.floor((u - ENTRA) / per - ef));
  for (let i = i0; i <= i1; i++) emite(ENTRA + (i + ef) * per, i);
  const q0 = b.descanso, q1 = b.descanso + 2.0;
  for (let j = Math.max(0, Math.floor((u - VIDA - q0) / OFEGA)); q0 + j * OFEGA <= Math.min(u, q1); j++) emite(q0 + j * OFEGA, 1000 + j);
}
// o contador em cima dele; no fim da série fica dourado e some
function contador(g, semente, t, alfa = 1) {
  const o = ondeEsta(semente, t);
  if (!o) return;
  const { b, u } = o, n = feitas(b, u);
  if (n < 1) return;
  let cor = COR_N, a = alfa;
  const fim = u - b.fimReps;
  if (fim >= 0) { cor = COR_FIM; a *= 1 - lim((fim - 2.0) / 0.5, 0, 1); }
  if (a <= 0) return;
  const s = String(n), x = Math.round(-A.largPx(s) / 2), ultima = (u - ENTRA) / b.E.per + 1 - b.E.conta - n;
  const y = -38 - (ultima >= 0 && ultima < 0.12 / b.E.per && fim < 0 ? 1 : 0);
  g.save(); g.globalAlpha *= a;
  A.textoPx(g, s, x, y, cor);
  g.restore();
}

// na saída: as gotas voando pros dois lados quando ele sacode (mais se estava suado)
const SAI_FIM = 0.95;
function sacode(g, semente, t, S) {
  const n = 4 + Math.round(6 * S);
  for (let j = 0; j < n; j++) {
    const d = t - (0.42 + j * 0.2 / n);
    if (d < 0 || d >= 0.35) continue;
    const r = rng((semente * 17 + j * 101 + 3) >>> 0), lado = j % 2 ? 1 : -1;
    const x = lado * (6 + (40 + 30 * r()) * d), y = -15 - (35 + 20 * r()) * d + 200 * d * d;
    if (y > -2) continue;
    gota(g, x, y, d > 0.2 ? (0.35 - d) / 0.15 : 1);
  }
}
function suorEm(semente, t) { const o = ondeEsta(semente, t); return o ? suor(o.b, o.u) : 0; }
function gota(g, x, y, a) {
  const X = Math.round(x / P) * P, Y = Math.round(y / P) * P;
  g.fillStyle = rgba('#7DD3FC', a); g.fillRect(X, Y, P, 2 * P);
  g.fillStyle = rgba('#F0F9FF', a); g.fillRect(X, Y, P, P);
}

function quadroTreino(g, t, m, semente) {
  const R = vestir(m), ps = pose(semente, t);
  desenhaPose(g, ps, R);
  gotas(g, semente, t);
  contador(g, semente, t);
}

module.exports = {
  texturas: [],
  linhaDoTempo: [
    [0, 'em pé, normal'],
    [INICIO, 'agacha e deita: 1ª série, flexões'],
    [INICIO + ENTRA + 1.7, 'contador 1, 2, 3... (uma flexão a cada 1,7 s)'],
    [INICIO + ENTRA + SUOR_1, 'começa a suar: gotinhas saltam a cada flexão'],
    [INICIO + ENTRA + 19 * 1.7, '~19 flexões: o número fica dourado; levanta'],
    [INICIO + ENTRA + 19 * 1.7 + SAI, 'descansa: ofega, enxuga o rosto com a toalha, alonga (1 em 4: solta o ki)'],
    [INICIO + BLOCO, 'nova série a cada 42 s: abdominais ou socos de kata, e flexões de novo'],
  ],
  cena(m) {
    const semente = Math.floor(m.sorteio() * 4294967296);
    sementes.set(m, semente);
    return {
      nome: 'parado', dur: Infinity, espaco: { frente: 0, tras: 0 }, modos: ['parado'], semente,
      quadro(g, t, mundo) { quadroTreino(g, t, mundo || m, semente); },
    };
  },
  // algo voltou a rodar: levanta (se estava no chão), sacode o suor e fica em pé normal no lugar.
  // tCorte = o t da cena quando cortou (na entrada ou depois de horas): a pose de lá é o começo.
  saida: {
    dur: 1.0,
    quadro(g, t, m, tCorte) {
      const R = vestir(m), semente = sementes.get(m) || 0;
      if (t >= SAI_FIM) { A.clawdDB(g, R); return; }
      const ps0 = pose(semente, tCorte), noChao = ps0.tipo !== 'pe';
      if (noChao && t < 0.12) desenhaPose(g, { ...ps0, poeira: null }, R);
      else if (t < 0.4) {
        let p;
        if (noChao) { const v = (t - 0.12) / 0.28; p = { sy: 0.86 + 0.14 * sai(v) + 0.04 * Math.sin(Math.PI * v) }; }
        else {  // em pé: o que ele fazia (soco, toalha, alongamento, ki) volta pro normal em 0,15 s
          const v = 1 - lim(t / 0.15, 0, 1), q = ps0.p || {};
          p = { sy: 1 + ((q.sy ?? 1) - 1) * v, rot: (q.rot || 0) * v, x: (q.x || 0) * v };
          if (v > 0.5 && q.olhos) p.olhos = q.olhos;
          if (q.bracos && v > 0) p.bracos = [q.bracos[0] * v, q.bracos[1] * v];
          if (q.aura && v > 0) Object.assign(p, { aura: q.aura * v, auraCor: q.auraCor, auraEstilo: q.auraEstilo, ta: tCorte + t });
          if (ps0.soco && v > 0) p.mao = (k, dy) => soco(k, { ...ps0.soco, e: ps0.soco.e * v, f: 1 }, dy);
          if (ps0.toalha != null && v > 0) p.mao = (k, dy) => { k.save(); k.globalAlpha *= v; toalha(k, ps0.toalha, dy); k.restore(); };
        }
        A.clawdDB(g, { ...R, ...p });
        if (noChao) poeira(g, t - 0.12);
      } else {
        const tr = t < 0.8 ? (Math.floor((t - 0.4) / 0.05) % 2 ? 0.75 : -0.75) : 0;  // sacode
        A.clawdDB(g, { ...R, x: tr, olhos: t < 0.8 ? 'fechados' : 'abertos' });
      }
      sacode(g, semente, t, suorEm(semente, tCorte));
      contador(g, semente, tCorte, 1 - lim(t / 0.3, 0, 1));
    },
  },
  // pros testes: o bloco k da semente (exercício, repetições, quando descansa) e os tempos
  bloco, BLOCO, INICIO, ENTRA, EXERC,
};
