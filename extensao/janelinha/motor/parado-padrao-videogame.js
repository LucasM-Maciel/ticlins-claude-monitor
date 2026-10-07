'use strict';
// Tema Padrão, parado há muito tempo: VIDEOGAME. Uma TVzinha de tubo aparece com um "puf" na
// frente dele (x+, em cima da borda do cartão), ele senta, o controle aparece no colo (fio
// até a TV) e a tela liga numa linha que abre. Daí joga partidas até algo rodar: 3, 2, 1,
// um joguinho de verdade na tela de 14x10 (corrida pulando bugs, pong ou navinha atirando em
// bugs, um de cada por rodada de 3), os braços e o corpo indo junto com os lances. Fim
// sorteado: GANHA (tela pisca verde, troféu, ele pula ou dança com o controle pro alto,
// confete) ou PERDE (tela pisca vermelho, X, ele bufa: olhos fechados, murcha, fumacinha;
// às vezes joga o controle no chão e pega de volta). Menu com ▶ piscando (raro: a TV dá
// chuvisco e ele dá um tapa nela) e outra partida.
// Saída (algo voltou a rodar): a TV desliga (a imagem fecha numa linha e num ponto), TV e
// controle somem num puf e ele levanta espreguiçando; termina no Clawd normal em pé.
// Tudo função do tempo: a partida k = floor((t - INICIO) / JANELA) é sorteada com
// rng(semente + k) e o plano dela (cada pulo, cada rebatida, cada tiro) sai pronto 1x
// (cache com teto); nada acumulado entre quadros.
const { lim, sai, arte, rng, cache } = require('./comum');
const { desenhaClawd } = require('./clawd');

const P = 1.5;                 // o pixel do Clawd (e da TV, do controle e do joguinho)
const CORPO = '#D77757', OLHO = '#1A1A1A';
const sementes = new WeakMap(); // mundo -> semente da cena (a saída precisa saber o que estava na tela)
const sorte = (sem, k, canal) => rng((sem + Math.imul(k + 1, 0x9E3779B1) + Math.imul(canal, 0x85EBCA6B)) >>> 0);
const suave = u => u * u * (3 - 2 * u);
const fatia = (t, a, b) => lim((t - a) / (b - a), 0, 1);

// ---------- linha do tempo ----------
const T = { tv: 0.15, senta: 0.35, controle: 0.6, fio: 0.72, liga: 0.9, ligou: 1.3 };
const INICIO = T.ligou;        // a 1ª partida
const JANELA = 28;             // s por partida: 3-2-1 + jogo + resultado + menu
const CONTA = 1.5;             // 3, 2, 1
const RES = 5.0;               // o resultado: fim do jogo, pisca, troféu ou X, a reação dele
const FIM = 0.6;               // s do resultado em que o joguinho ainda mostra o lance final
const MAXG = JANELA - CONTA - RES - 1.5;  // o jogo mais longo (sobra pelo menos 1,5 s de menu)
const JOGOS = ['pulo', 'pong', 'nave'];
// o chuvisco (raro, no menu): a tela chia · ele olha a TV · olha pra gente com um "?" · se
// inclina e dá um tapa na TV (ela treme) · a imagem volta
const CH = { ini: 0.4, duvida: 1.2, inclina: 1.75, tapa: 2.05, fim: 2.3, volta: 2.6 };

// ---------- desenhos (pixel art no tamanho do Clawd) ----------
// a TV de tubo: antena em V, tela de 14x10 com os cantos redondos, painel com 2 botões e a
// grade do alto-falante, pezinhos
const TV = [
  '.....l.......l.....',
  '......a.....a......',
  '.......a...a.......',
  '........a.a........',
  '.......ddddd.......',
  '.ccccccccccccccccc.',
  'ccSSSSSSSSSSSSccccd',
  'cSSSSSSSSSSSSSSckkd',
  'cSSSSSSSSSSSSSSckkd',
  'cSSSSSSSSSSSSSScccd',
  'cSSSSSSSSSSSSSSckkd',
  'cSSSSSSSSSSSSSSckkd',
  'cSSSSSSSSSSSSSScccd',
  'cSSSSSSSSSSSSSScddd',
  'cSSSSSSSSSSSSSScccd',
  'ccSSSSSSSSSSSSccddd',
  'ccccccccccccccccdcd',
  '.dddddddddddddddddd',
  '..dd...........dd..',
];
const COR_TV = { c: '#52525B', d: '#3F3F46', k: '#A1A1AA', l: '#E5E7EB', a: '#9CA3AF', S: '#0B1220' };
const TVW = 19, TVH = 19, TVX = 17;              // TVX: a borda esquerda da TV (o Clawd ocupa até 13,5)
const SW = 14, SH = 10;                          // a tela, em células de P
const SX = TVX + P, SY = -TVH * P + 6 * P;       // o canto de cima à esquerda da tela
const TELA = '#0F172A';                          // a tela ligada (um tico mais clara que a desligada)
const LED = [TVX + 16 * P, -3 * P];              // a luzinha embaixo do painel (acesa com a TV ligada)
// o controle (no colo, as mãos nas pontas): cruz, os botões vermelho e azul
const PAD = ['.gdgggggrg.', 'gdddgggbgrg', 'ggdgggggbgg', '.ggg...ggg.'];
const COR_PAD = { g: '#D4D4D8', d: '#3F3F46', r: '#EF4444', b: '#60A5FA' };
const PADW = PAD[0].length * P, PADH = PAD.length * P, PADX = -PADW / 2;
const PAD_COLO = -9, PAD_ALTO = -22.5;            // o topo do controle no colo / no alto (Clawd em pé; sentado + 3)
const FIO = '#71717A';
// o joguinho
const HEROI = [['####', '####', '.#.#'], ['####', '####', '#.#.']];   // correndo (perninhas trocam)
const HEROI_AR = ['####', '####', '#..#'];
const NUVEM_PULO = ['.##.', '####'];
const COR_HEROI = { '#': CORPO };
const BICHO = [['wv', 'vv', 'p.'], ['wv', 'vv', '.p']];               // o bug do Padrão, 2x3 (perninhas trocam)
const COR_BICHO = { w: '#A3E635', v: '#65A30D', p: '#A3E635' };
const NAVE = ['..#..', '.###.', '##.##'];
const INVASOR = [['wvw', 'vvv', 'p.p'], ['wvw', 'vvv', '.p.']];
const TROFEU = ['y.yyyyy.y', 'yywyyyyyy', '.yywyyyo.', '..yyyyo..', '...yyo...', '....o....', '...ooo...'];
const COR_TROFEU = { y: '#FACC15', w: '#FEF9C3', o: '#CA8A04' };
const XIS = ['##....##', '.##..##.', '..####..', '..####..', '.##..##.', '##....##'];
const PLAY = ['#...', '##..', '###.', '####', '###.', '##..', '#...'];
const DIGITOS = { 1: ['.#.', '##.', '.#.', '.#.', '###'], 2: ['###', '..#', '###', '#..', '###'], 3: ['###', '..#', '.##', '..#', '###'] };
const CONFETE = ['#D77757', '#FACC15', '#22C55E', '#60A5FA', '#F472B6', '#E5E7EB'];
// o puf (a fumacinha do bug do tema): 8 quadradinhos que sobem e crescem por 0,6 s
const VOOS = [[-30, -60], [-12, -80], [10, -75], [28, -55], [-22, -30], [20, -35], [0, -90], [34, -20]];
function puf(g, cx, cy, d, k = 1) {
  if (d < 0 || d >= 0.6) return;
  g.save(); g.globalAlpha *= 1 - d / 0.6;
  const w = (3 + 5 * d) * k;
  VOOS.forEach(([vx, vy], i) => {
    g.fillStyle = i % 2 ? '#9CA3AF' : '#E5E7EB';
    g.fillRect(cx + vx * (0.06 + d * 0.3) * k - w / 2, cy + vy * (0.06 + d * 0.2) * k - 10 * d - w / 2, w, w);
  });
  g.restore();
}
// o puf da TV (aparece / some): uma nuvem de 12 quadradinhos que abre em roda em volta dela e
// some em 0,4 s (dois anéis desencontrados: no começo eles se tocam e parecem uma nuvem)
function pufTV(g, d) {
  if (d < 0 || d >= 0.4) return;
  const u = d / 0.4, cx = TVX + TVW * P / 2, cy = -TVH * P / 2 + 2;
  g.save(); g.globalAlpha *= u < 0.5 ? 1 : (1 - u) / 0.5;
  for (let i = 0; i < 12; i++) {
    const dentro = i % 2, a = (i / 12) * 2 * Math.PI + 0.2, r = (dentro ? 0.15 : 0.3) + (dentro ? 0.55 : 0.8) * sai(u), w = (dentro ? 6 : 7.5) * (1 - 0.65 * u);
    const y = cy + Math.sin(a) * 15 * r;
    if (y > -w / 2) continue;  // nada abaixo da borda do cartão
    g.fillStyle = dentro ? '#9CA3AF' : '#E5E7EB';
    g.fillRect(cx + Math.cos(a) * 19 * r - w / 2, y - w / 2, w, w);
  }
  g.restore();
}
// ---------- a tela: células de P, cortadas na borda (e nos 4 cantos redondos) ----------
function cel(g, i, j, w = 1, h = 1) {
  const i0 = Math.max(0, i), j0 = Math.max(0, j), i1 = Math.min(SW, i + w), j1 = Math.min(SH, j + h);
  if (i1 <= i0 || j1 <= j0) return;
  g.fillRect(SX + i0 * P, SY + j0 * P, (i1 - i0) * P, (j1 - j0) * P);
}
// sprite de arte() na célula (i, j), cortado na borda da tela
function spr(g, img, i, j) {
  const i0 = Math.max(0, i), j0 = Math.max(0, j), i1 = Math.min(SW, i + img.width), j1 = Math.min(SH, j + img.height);
  if (i1 <= i0 || j1 <= j0) return;
  g.drawImage(img, i0 - i, j0 - j, i1 - i0, j1 - j0, SX + i0 * P, SY + j0 * P, (i1 - i0) * P, (j1 - j0) * P);
}
function fundoTela(g) { g.fillStyle = TELA; fundoTelaCor(g); }
function fundoTelaCor(g) {
  g.fillRect(SX + P, SY, (SW - 2) * P, P); g.fillRect(SX, SY + P, SW * P, (SH - 2) * P); g.fillRect(SX + P, SY + (SH - 1) * P, (SW - 2) * P, P);
}
// os 4 cantos redondos da tela (a moldura), por cima do que passou deles
function cantos(g) {
  g.fillStyle = COR_TV.c;
  for (const [i, j] of [[0, 0], [SW - 1, 0], [0, SH - 1], [SW - 1, SH - 1]]) g.fillRect(SX + i * P, SY + j * P, P, P);
}
// brilho por cima da tela inteira (pisca verde/vermelho, a TV ligando)
function brilhoTela(g, cor, a) {
  if (!(a > 0.004)) return;
  g.save(); g.globalAlpha *= a; g.fillStyle = cor; fundoTelaCor(g); g.restore();
}
const brilho = (cx, cy) => {  // o "+" de quando pega a moeda / acerta
  return (g, d) => {
    if (d < 0 || d >= 0.24) return;
    g.fillStyle = Math.floor(d / 0.06) % 2 ? '#FACC15' : '#FFFFFF';
    if (d < 0.12) cel(g, cx, cy); else { cel(g, cx - 1, cy); cel(g, cx + 1, cy); cel(g, cx, cy - 1); cel(g, cx, cy + 1); }
  };
};

// ---------- os joguinhos ----------
// Cada um: plano(r, ganha, alvo) -> { G (s de jogo), ... } e tela(g, pl, tau) (tau pode passar
// de G até G + FIM: o lance final), e mao(pl, tau) -> o que o Clawd faz no controle:
// { esq, dir } (px que cada braço sobe: a cruz e os botões), x, y (px que o corpo vai junto: pro
// lado, quica no lugar). Nada de girar: girado o pixel art serrilha.

// CORRIDA: o bonequinho laranja pula os bugs que vêm pela direita; às vezes pega uma moeda
// no alto do pulo. Ganha: chega na bandeira. Perde: não pula o último bug, que pega ele.
const PU = { vel: 10, hx: 2, pulo: 1.0, alto: 4, chao: 8 };
function planoPulo(r, ganha, alvo) {
  const bugs = [];
  for (let tc = 1.5 + r() * 0.6; tc < alvo - (ganha ? 1.3 : 0); tc += 1.2 + r() * 1.0) bugs.push({ tc, moeda: r() < 0.35 });
  let G;
  if (ganha) G = bugs[bugs.length - 1].tc + 1.0 + r() * 0.4;
  else { const u = bugs[bugs.length - 1]; u.bate = true; G = u.tc - 0.3; }
  return { G, ganha, bugs };
}
function puloEm(pl, tau) {  // a altura do bonequinho (células) e se está no ar
  for (const b of pl.bugs) {
    if (b.bate) continue;
    const f = (tau - (b.tc - PU.pulo / 2)) / PU.pulo;
    if (f >= 0 && f < 1) return { h: Math.round(PU.alto * Math.sin(Math.PI * f)), f };
  }
  return { h: 0, f: -1 };
}
function telaPulo(g, pl, tau) {
  const t = Math.min(tau, pl.G), x0 = PU.vel * t;  // o quanto o chão andou (para no fim)
  // duas nuvenzinhas lá atrás (andam a 1/4 do chão) e o chão com os risquinhos que passam
  for (const [x, y] of [[3, 2], [12, 3]]) spr(g, arte(NUVEM_PULO, { '#': '#334155' }), Math.round(((x - x0 / 4) % 20 + 20) % 20) - 4, y);
  g.fillStyle = '#52525B'; cel(g, 0, PU.chao, SW, 1);
  g.fillStyle = '#9CA3AF';
  for (let k = Math.floor(x0 / 5); k * 5 - x0 < SW; k++) cel(g, Math.floor(k * 5 - x0), PU.chao);
  // a bandeira (ganhou): chega com o chão e sobe no mastro no lance final
  if (pl.ganha) {
    const bx = Math.round(PU.hx + 6 + PU.vel * (pl.G - t));
    if (bx < SW) {
      g.fillStyle = '#9CA3AF'; cel(g, bx, 1, 1, PU.chao - 1);
      const sobe = Math.round(4 * sai(fatia(tau, pl.G, pl.G + 0.45)));
      g.fillStyle = '#22C55E'; cel(g, bx + 1, 5 - sobe, 2, 1); cel(g, bx + 1, 6 - sobe, 1, 1);
    }
  }
  // os bugs (e as moedas em cima deles)
  for (const b of pl.bugs) {
    const bx = Math.round(PU.hx + 1 + PU.vel * (b.tc - t));
    if (bx >= SW || bx < -2) continue;
    spr(g, arte(BICHO[Math.floor(tau / 0.15) % 2], COR_BICHO), bx, PU.chao - 3);
    if (b.moeda) {
      if (t < b.tc) { g.fillStyle = Math.floor(tau / 0.2) % 2 ? '#FACC15' : '#FDE047'; cel(g, bx + 1, 1); }
      else brilho(PU.hx + 2, 1)(g, tau - b.tc);
    }
  }
  // o bonequinho
  const bate = !pl.ganha && tau >= pl.G;
  if (bate) {  // pegou: pisca e cai pra fora da tela
    const d = tau - pl.G, y = PU.chao - 3 - (d < 0.25 ? 0 : Math.round(3 * Math.sin(Math.PI * Math.min(1, (d - 0.25) / 0.35)) - 12 * Math.max(0, d - 0.6)));
    const img = arte(HEROI_AR, { '#': d < 0.25 && Math.floor(d / 0.06) % 2 ? '#FFFFFF' : '#EF4444' });
    spr(g, img, PU.hx, y);
    return;
  }
  const { h } = puloEm(pl, t);
  let pulinho = 0;
  if (pl.ganha && tau >= pl.G) pulinho = Math.round(2 * Math.sin(Math.PI * fatia(tau, pl.G, pl.G + 0.3)));
  const img = h || pulinho ? arte(HEROI_AR, COR_HEROI) : arte(HEROI[Math.floor(t / 0.12) % 2], COR_HEROI);
  spr(g, img, PU.hx, PU.chao - 3 - h - pulinho);
}
function maoPulo(pl, tau) {
  const { f } = puloEm(pl, tau);
  const p = { esq: 0, dir: 0, x: 0, y: 0 };
  if (f >= 0) { p.y = f < 0.7 ? -P : 0; if (f < 0.15) p.dir = P; }
  return p;
}

// PONG: a raquete laranja (dele) contra a azul; quem fizer 3 ganha. A bola anda célula por
// célula, rebate nas paredes; quem erra a bola fica pra trás e o ponto acende lá em cima.
const PO = { cima: 1, baixo: 9, xa: 1, xb: 12 };
function dobra(y) {  // reflete y nas paredes (cima..baixo)
  const a = PO.cima, L = PO.baixo - PO.cima, v = ((y - a) % (2 * L) + 2 * L) % (2 * L);
  return a + (v <= L ? v : 2 * L - v);
}
function planoPong(r, ganha, alvo) {
  const segs = [], pts = [0, 0], lado = ganha ? 0 : 1;  // 0 = ele (esquerda), 1 = a CPU
  const perde = r() < 0.34 ? 0 : r() < 0.6 ? 1 : 2;
  const ordem = [...Array(3).fill(lado), ...Array(perde).fill(1 - lado)];
  const ultimo = ordem.shift();
  for (let i = ordem.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ordem[i], ordem[j]] = [ordem[j], ordem[i]]; }
  ordem.push(ultimo);
  let t = 0, raq = [5, 5], saque = r() < 0.5 ? 0 : 1;
  ordem.forEach((quem, i) => {          // quem faz o ponto: o outro erra
    const erra = 1 - quem, porPonto = (alvo - t) / (ordem.length - i);
    // um ponto: pausa 0,55 + saque ~0,6 + ~0,95 por chegada a mais + sai 0,25. As chegadas
    // alternam de lado (a 1ª no lado do saque) e a última é no lado de quem erra
    let n = Math.max(1, Math.round((porPonto - 1.4) / 0.95) + 1 + (r() < 0.25 ? -1 : r() < 0.33 ? 1 : 0));
    if ((n % 2 === 1) !== (saque === erra)) n += n > 1 && r() < 0.5 ? -1 : 1;
    let x = 6.5, y = 2 + Math.floor(r() * 7), alvoLado = saque;
    segs.push({ tipo: 'pausa', t0: t, t1: t + 0.55, raq: raq.slice() });
    t += 0.55;
    for (let a = 0; a < n; a++) {
      const yb = 1 + Math.floor(r() * 9), dur = (x === 6.5 ? 0.5 : 0.85) + r() * 0.2;
      const parede = x !== 6.5 && r() < 0.4 ? (r() < 0.5 ? 2 * PO.cima - yb : 2 * PO.baixo - yb) : yb;
      const xb = alvoLado === 0 ? PO.xa : PO.xb, ultima = a === n - 1;
      const fim = raq.slice();
      fim[alvoLado] = ultima ? lim(yb + (yb > 5 ? -3 : 3), 2, 8) : lim(yb + Math.floor(r() * 3) - 1, 2, 8);
      segs.push({ tipo: ultima ? 'erra' : 'bola', t0: t, t1: t + dur, x, y, xb, Y: parede, raq: raq.slice(), fim, alvo: alvoLado });
      t += dur; raq = fim; x = xb; y = yb; alvoLado = 1 - alvoLado;
    }
    // a bola passa da raquete e sai da tela; o ponto acende
    pts[quem]++;
    segs.push({ tipo: 'sai', t0: t, t1: t + 0.25, x, y, xb: x === PO.xa ? -2 : SW + 1, Y: y, raq: raq.slice(), pts: pts.slice(), quem });
    t += 0.25;
    saque = erra;
  });
  // passou do tempo da janela: a partida inteira um tico mais rápida
  const k = Math.min(1, MAXG / t);
  if (k < 1) for (const s of segs) { s.t0 *= k; s.t1 *= k; }
  return { G: t * k, ganha, segs, pts };
}
function segPong(pl, tau) {
  const S = pl.segs;
  if (tau >= pl.G) return S[S.length - 1];
  let a = 0, b = S.length - 1;
  while (a < b) { const m = (a + b + 1) >> 1; if (S[m].t0 <= tau) a = m; else b = m - 1; }
  return S[a];
}
// onde estão as raquetes (centro, em células) no segmento s em tau
function raquetes(s, tau) {
  if (s.tipo === 'pausa' || s.tipo === 'sai') return s.raq;
  const u = fatia(tau, s.t0 + 0.12, s.t1 - 0.08), r = s.raq.slice();  // quem erra vai pro lado errado
  r[s.alvo] = Math.round(s.raq[s.alvo] + (s.fim[s.alvo] - s.raq[s.alvo]) * suave(u));
  return r;
}
function telaPong(g, pl, tau) {
  const s = segPong(pl, tau), t = Math.min(tau, pl.G);
  // a rede e o placar (3 pontinhos de cada lado)
  g.fillStyle = '#3F3F46';
  for (let j = 1; j < SH; j += 2) cel(g, 7, j);
  let pts = [0, 0];
  for (const q of pl.segs) if (q.tipo === 'sai' && q.t0 <= t) pts = q.pts;
  for (let i = 0; i < 3; i++) {
    const pisca = (lado) => { const q = s.tipo === 'sai' || s.tipo === 'pausa' ? ultimoPonto(pl, t) : null; return q && q.quem === lado && i === q.pts[lado] - 1 && t - q.t0 < 0.8 && Math.floor((t - q.t0) / 0.1) % 2; };
    g.fillStyle = i < pts[0] && !pisca(0) ? CORPO : '#334155'; cel(g, 1 + 2 * i, 0);
    g.fillStyle = i < pts[1] && !pisca(1) ? '#60A5FA' : '#334155'; cel(g, 12 - 2 * i, 0);
  }
  // as raquetes
  const r = raquetes(s, t);
  g.fillStyle = CORPO; cel(g, 0, r[0] - 1, 1, 3);
  g.fillStyle = '#60A5FA'; cel(g, SW - 1, r[1] - 1, 1, 3);
  // a bola
  if (s.tipo !== 'pausa' && tau < pl.G + 0.05) {
    const u = fatia(t, s.t0, s.t1), x = Math.round(s.x + (s.xb - s.x) * u), y = Math.round(dobra(s.y + (s.Y - s.y) * u));
    g.fillStyle = '#FFFFFF'; cel(g, x, y);
  }
}
function ultimoPonto(pl, t) { let q = null; for (const s of pl.segs) if (s.tipo === 'sai' && s.t0 <= t) q = s; return q; }
function maoPong(pl, tau) {
  const s = segPong(pl, tau), p = { esq: 0, dir: 0, x: 0, y: 0 };
  if (s.tipo !== 'bola' && s.tipo !== 'erra') return p;
  if (s.alvo === 0) {  // a bola vem nele: a raquete corre, ele inclina junto
    const d = s.fim[0] - s.raq[0], u = fatia(tau, s.t0 + 0.12, s.t1 - 0.08);
    if (d && u > 0 && u < 1) p.esq = P;
    if (fatia(tau, s.t0, s.t1) > 0.6) p.x = P;  // a bola chegando: vai junto pra TV
  } else if (tau - s.t0 < 0.15 && s.x === PO.xa) p.dir = P;  // acabou de rebater
  return p;
}

// NAVINHA: a navinha laranja atira nos bugs que aparecem lá em cima (2 de cada vez, andando
// de lado); de vez em quando um bug solta uma bomba rosa e ela passa longe. Ganha: o último
// bug estoura. Perde: a bomba do último bug pega a navinha embaixo dele.
// A navinha tem 5 de largura (o meio = x + 2, a ponta na linha NA.ponta); o bug, 3x3 (o meio = x + 1).
const NA = { ponta: 7, vtiro: 20, vbomba: 8 };
const bugX = (b, t) => b.x + ((Math.floor(t / 0.7) + b.fase) % 2 ? 1 : 0) * (b.x < 10 ? 1 : -1);
function planoNave(r, ganha, alvo) {
  const bugs = [];
  let f = 1.0 + r() * 0.4, x = 5;
  for (let i = 0; ; i++) {
    let nx;
    do nx = 1 + Math.floor(r() * 10); while (Math.abs(nx - x) < 3);
    const y = 1 + Math.floor(r() * 2), fase = Math.floor(r() * 2);
    const b = { x: nx, y, fase, nasce: i === 0 ? 0.2 : bugs[i - 1].tiro - 0.4, tiro: f };
    b.acerto = f + (NA.ponta - 1 - (y + 2)) / NA.vtiro;
    b.mira = bugX(b, b.acerto) + 1;  // a coluna do tiro (o meio da navinha e o do bug no acerto)
    bugs.push(b);
    x = nx;
    if (f > alvo - 1.8) break;
    f += 1.15 + r() * 0.9;
  }
  const ult = bugs[bugs.length - 1];
  let G;
  if (ganha) G = ult.acerto + 0.05;
  else {  // a bomba sai quando a navinha está chegando embaixo dele, e pega antes do tiro
    ult.bomba = { t: ult.tiro - 0.45, bate: true };
    G = ult.bomba.t + (NA.ponta - (ult.y + 3)) / NA.vbomba;
    ult.tiro = ult.acerto = Infinity;
    ult.para = G;
  }
  // bombas que passam longe (a navinha nunca está a menos de 3 células quando ela chega)
  const pl = { G, ganha, bugs };
  bugs.forEach((b, i) => {
    if (b.bomba || i === 0 || r() < 0.5) return;
    const t = b.nasce + 0.5 + r() * Math.max(0.1, b.tiro - b.nasce - 1.2), bx = bugX(b, t) + 1;
    const chega = t + (NA.ponta - (b.y + 3)) / NA.vbomba, sai = chega + (SH - NA.ponta) / NA.vbomba;
    let longe = sai < G;  // passa pelas linhas da navinha sem chegar perto dela
    for (let q = chega - 0.05; q <= sai + 0.05 && longe; q += 0.02) longe = Math.abs(naveX(pl, q) + 2 - bx) >= 3;
    if (longe) b.bomba = { t };
  });
  return pl;
}
// a navinha (coluna da esquerda): vai pra baixo do próximo bug (onde ele vai estar no acerto) e
// para pra atirar
function naveX(pl, tau) {
  let de = 4, t0 = 0;
  for (const b of pl.bugs) {
    const para = b.para ?? b.tiro, ax = lim(bugX(b, b.para ? b.bomba.t : b.acerto) - 1, 0, SW - 5);
    const fim = para - 0.15;
    if (tau < fim) return Math.round(de + (ax - de) * suave(fatia(tau, t0 + 0.1, fim)));
    if (tau < para + 0.1 || b === pl.bugs[pl.bugs.length - 1]) return ax;
    de = ax; t0 = para;
  }
  return de;
}
function telaNave(g, pl, tau) {
  const t = Math.min(tau, pl.G), nx = naveX(pl, t);
  // estrelinhas que descem devagar
  g.fillStyle = '#334155';
  for (let k = 0; k < 3; k++) cel(g, (k * 5 + 2) % SW, Math.floor(((k * 7 + 3) + t * 1.5) % SH));
  for (const b of pl.bugs) {
    if (t < b.nasce) continue;
    const x = bugX(b, Math.min(t, b.acerto));
    if (t < b.acerto) {
      if (!(t - b.nasce < 0.3 && Math.floor((t - b.nasce) / 0.075) % 2)) spr(g, arte(INVASOR[Math.floor(tau / 0.35) % 2], COR_BICHO), x, b.y);  // aparece piscando
    } else brilho(x + 1, b.y + 1)(g, tau - b.acerto);
    // o tiro (sai da ponta da navinha)
    if (t >= b.tiro && t < b.acerto) {
      const y = Math.round(NA.ponta - 1 - NA.vtiro * (t - b.tiro));
      g.fillStyle = '#FACC15'; cel(g, b.mira, y - 1, 1, 2);
    }
    // a bomba
    if (b.bomba && t >= b.bomba.t) {
      const by = Math.floor(b.y + 3 + NA.vbomba * (t - b.bomba.t)), bx = bugX(b, b.bomba.t) + 1;
      if (by < (b.bomba.bate ? NA.ponta : SH)) { g.fillStyle = Math.floor(t / 0.1) % 2 ? '#F472B6' : '#FBCFE8'; cel(g, bx, by); }
    }
  }
  // a navinha (perdeu: estoura em faíscas e some)
  if (!pl.ganha && tau >= pl.G) {
    const d = tau - pl.G, cx = nx + 2, cy = NA.ponta + 1;
    if (d < 0.5) {
      g.fillStyle = Math.floor(d / 0.06) % 2 ? '#FACC15' : '#EF4444';
      const s = Math.round(1 + 3 * d);
      cel(g, cx, cy - s); cel(g, cx - s, cy); cel(g, cx + s, cy); cel(g, cx - s, cy - s); cel(g, cx + s, cy - s);
      if (d < 0.2) cel(g, nx + 1, cy - 1, 3, 2);
    }
    return;
  }
  spr(g, arte(NAVE, COR_HEROI), nx, NA.ponta);
}
function maoNave(pl, tau) {
  const p = { esq: 0, dir: 0, x: 0, y: 0 }, a = naveX(pl, tau - 0.08), b = naveX(pl, tau + 0.08);
  if (a !== b) { p.esq = P; p.x = Math.sign(b - a) * P; }
  for (const bg of pl.bugs) if (tau >= bg.tiro && tau < bg.tiro + 0.15) p.dir = P;
  return p;
}
const JOGO = {
  pulo: { plano: planoPulo, tela: telaPulo, mao: maoPulo },
  pong: { plano: planoPong, tela: telaPong, mao: maoPong },
  nave: { plano: planoNave, tela: telaNave, mao: maoNave },
};

// ---------- as partidas ----------
// o jogo da partida k: rodadas de 3 com os 3 jogos embaralhados (a rodada seguinte não
// começa com o que a anterior terminou)
function rodada(sem, c) { const r = sorte(sem, c, 7), o = JOGOS.slice(); for (let i = 2; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [o[i], o[j]] = [o[j], o[i]]; } return o; }
function jogoDa(sem, k) {
  const c = Math.floor(k / 3), o = rodada(sem, c);
  if (c > 0 && o[0] === rodada(sem, c - 1)[2]) [o[0], o[1]] = [o[1], o[0]];
  return o[k % 3];
}
const PARTIDAS = cache(24);
function partida(sem, k) {
  const chave = sem + ':' + k, pronta = PARTIDAS.get(chave);
  if (pronta) return pronta;
  const r = sorte(sem, k, 1), jogo = jogoDa(sem, k), ganha = r() < 0.55;
  const alvo = 15.5 + r() * 4;
  const festa = r() < 0.6 ? 'pulos' : 'danca', raiva = r() < 0.4 ? 'joga' : 'bufa';
  const pl = JOGO[jogo].plano(sorte(sem, k, 2), ganha, alvo), menu = JANELA - CONTA - pl.G - RES;
  const chuvisco = r() < 0.22 && menu >= CH.fim + 1;  // de vez em quando, no menu, a TV dá chuvisco
  return PARTIDAS.set(chave, { k, jogo, ganha, festa, raiva, pl, menu, chuvisco, t0: INICIO + k * JANELA });
}
// onde está: { p (a partida), fase: 'conta'|'jogo'|'res'|'menu', u (s na fase) }, null antes da 1ª
function ondeEsta(sem, t) {
  if (t < INICIO) return null;
  const k = Math.floor((t - INICIO) / JANELA), p = partida(sem, k), u = t - p.t0, G = p.pl.G;
  if (u < CONTA) return { p, fase: 'conta', u };
  if (u < CONTA + G) return { p, fase: 'jogo', u: u - CONTA };
  if (u < CONTA + G + RES) return { p, fase: 'res', u: u - CONTA - G };
  return { p, fase: 'menu', u: u - CONTA - G - RES };
}

// ---------- o Clawd ----------
// o olhar pra TV: os olhos (colunas 5 e 12, meias-fileiras 2 e 3) andam 1 coluna pra frente
function olhaTV(g, dy, olhos) {
  const y2 = -12 + dy;
  g.fillStyle = CORPO; g.fillRect(-6, y2, P, 2 * P); g.fillRect(4.5, y2, P, 2 * P);
  g.fillStyle = OLHO;
  const y = olhos === 'fechados' ? y2 + P : y2, h = olhos === 'abertos' ? 2 * P : P;
  g.fillRect(-4.5, y, P, h); g.fillRect(6, y, P, h);
}
// o controle: no colo, no alto (comemorando) ou solto (jogado), com o tamanho esc (aparecendo)
function controle(g, x, y, esc = 1) {
  if (esc <= 0) return;
  const img = arte(PAD, COR_PAD);
  if (esc === 1) { g.drawImage(img, x, y, PADW, PADH); return; }
  g.save(); g.translate(x + PADW / 2, y + PADH / 2); g.scale(esc, esc); g.drawImage(img, -PADW / 2, -PADH / 2, PADW, PADH); g.restore();
}
// pose: { sentado, x, y, sy, olhos, tv (olha pra TV), bracos: [esq, dir], pad: 'colo'|'alto'|null, padEsc }
function desenhaPose(g, ps) {
  const p = { x: ps.x || 0, y: ps.y || 0, sy: ps.sy, olhos: ps.olhos || 'abertos', sentado: !!ps.sentado };
  if (ps.bracos) p.bracos = ps.bracos;
  if (ps.tv) p.frente = (k, dy) => olhaTV(k, dy, p.olhos);
  if (ps.pad === 'alto') {  // os braços esticados pra cima (do ombro até as pontas do controle)
    p.bracos = [-12, -12];
    p.mao = (k, dy) => {
      k.fillStyle = CORPO; k.fillRect(-12, -18 + dy, 2 * P, 9); k.fillRect(9, -18 + dy, 2 * P, 9);
      controle(k, PADX, PAD_ALTO + dy, ps.padEsc ?? 1);
    };
  } else if (ps.pad) p.mao = (k, dy) => controle(k, PADX, PAD_COLO + dy, ps.padEsc ?? 1);
  desenhaClawd(g, p);
}
const pisca = (t, fase = 0) => ((t + fase) % 3.7 + 3.7) % 3.7 < 0.12;

// a pose da cena em t (função pura); devolve também o controle solto e a fumacinha
function pose(sem, t) {
  // entrada: em pé · senta olhando a TV · o controle aparece no colo
  if (t < T.senta) return { olhos: 'abertos', tv: t >= T.senta - 0.12 };
  if (t < INICIO) {
    const ps = { sentado: true, tv: true, bracos: t >= T.controle ? [P, P] : null };
    if (t < T.senta + 0.3) ps.sy = 1 - 0.12 * Math.sin(Math.PI * (t - T.senta) / 0.3);
    if (t >= T.controle) { ps.pad = 'colo'; ps.padEsc = sai(fatia(t, T.controle, T.controle + 0.18)); }
    return ps;
  }
  const o = ondeEsta(sem, t), { p } = o;
  const base = { sentado: true, tv: true, bracos: [P, P], pad: 'colo', olhos: pisca(t) ? 'fechados' : 'abertos' };
  if (o.fase === 'conta') return base;
  if (o.fase === 'jogo') {
    const m = JOGO[p.jogo].mao(p.pl, o.u);
    return { ...base, bracos: [P - m.esq, P - m.dir], x: m.x, y: m.y };
  }
  if (o.fase === 'menu') {
    // descansa olhando pra gente; com tempo, esquenta os dedos (os braços batucam no controle);
    // no fim volta a olhar a TV pro 3-2-1
    const u = o.u, ps = { ...base, tv: u > p.menu - 0.5, olhos: pisca(t, 1.3) ? 'fechados' : 'abertos', sy: 1 + 0.03 * Math.sin(2 * Math.PI * u / 1.8) };
    if (p.chuvisco && u >= CH.ini && u < CH.volta) {
      if (u < CH.duvida) return { ...base, tv: true, olhos: 'abertos' };
      if (u < CH.inclina) return { ...base, tv: false, olhos: 'abertos' };
      const ida = sai(fatia(u, CH.inclina, CH.inclina + 0.2)) * (1 - sai(fatia(u, CH.fim, CH.volta)));
      const braco = u < CH.tapa ? -6 * sai(fatia(u, CH.inclina, CH.tapa - 0.05)) : u < CH.fim ? -2 : P;
      return { ...base, tv: true, x: P * Math.round(3 * ida), bracos: [P, braco], olhos: u >= CH.fim ? 'cima' : 'abertos' };
    }
    if (p.menu >= 3 && u >= 0.7 && u < 1.5 && !p.chuvisco) { ps.bracos = Math.floor((u - 0.7) / 0.1) % 2 ? [P - 3, P] : [P, P - 3]; ps.olhos = 'cima'; }
    return ps;
  }
  return reacao(p, o.u, base);
}
// o resultado: u desde o fim do jogo (o lance final vai até FIM)
function reacao(p, u, base) {
  if (u < FIM) return { ...base, olhos: 'abertos' };
  const v = u - FIM;
  if (p.ganha && p.festa === 'pulos') {
    // levanta 0–0,1 · pulo 10 px 0,1–0,55 · pulo 6 px 0,62–0,97 · pulo 3 px 1,04–1,3 · em pé · senta 2,1–2,4
    const alto = { olhos: 'cima', pad: 'alto' };
    const pulo = (a, b, h) => -h * Math.sin(Math.PI * fatia(v, a, b));
    if (v < 0.1) return { ...base, sy: 1 - 0.12 * Math.sin(Math.PI * v / 0.1), olhos: 'cima' };
    if (v < 0.55) return { ...alto, y: pulo(0.1, 0.55, 10) };
    if (v < 0.62) return { ...alto, sy: 1 - 0.12 * Math.sin(Math.PI * (v - 0.55) / 0.07) };
    if (v < 0.97) return { ...alto, y: pulo(0.62, 0.97, 6) };
    if (v < 1.04) return { ...alto, sy: 1 - 0.1 * Math.sin(Math.PI * (v - 0.97) / 0.07) };
    if (v < 1.3) return { ...alto, y: pulo(1.04, 1.3, 3) };
    if (v < 2.1) return { olhos: 'cima', bracos: [0, 0], pad: 'colo' };
    if (v < 2.4) return { ...base, olhos: 'cima', tv: false, sy: 1 - 0.1 * Math.sin(Math.PI * (v - 2.1) / 0.3) };
    return { ...base, tv: v > 3.6, olhos: v < 3.0 ? 'cima' : base.olhos };
  }
  if (p.ganha) {
    // dança sentado, o controle pro alto: balança pros lados, pulinhos a cada batida (0,3 s)
    if (v < 2.0) {
      const b = Math.floor(v / 0.3), f = (v % 0.3) / 0.3, lado = b % 2 ? 1 : -1;
      return { ...base, tv: false, olhos: 'cima', pad: 'alto', x: lado * P, y: -P * Math.round(2 * Math.sin(Math.PI * f)) };
    }
    if (v < 2.25) return { ...base, tv: false, olhos: 'cima', sy: 1 - 0.08 * Math.sin(Math.PI * (v - 2.0) / 0.25) };
    return { ...base, tv: v > 3.6, olhos: v < 3.0 ? 'cima' : base.olhos };
  }
  // perdeu: congela 0–0,3 · bufa (olhos fechados, murcha, fumacinha) · solta o ar · volta
  const murcha = 1 - 0.1 * suave(fatia(v, 0.3, 0.6)) * (1 - suave(fatia(v, 2.4, 2.9)));
  const fecha = v >= 0.3 && v < 2.6;
  if (p.raiva === 'bufa') {  // os braços caem junto (o controle desce no colo); abre os olhos pra gente e volta pra TV
    const cai = P + P * suave(fatia(v, 0.3, 0.6)) * (1 - fatia(v, 2.4, 2.9));
    return { ...base, tv: v < 0.3 || v >= 3.2, olhos: fecha ? 'fechados' : base.olhos, sy: murcha, bracos: [cai, cai] };
  }
  // joga o controle: levanta 0,3–0,5 · solta 0,5 (voa até o chão) · bufa · inclina e pega 2,5–3,1
  if (v < 0.3) return { ...base, olhos: 'abertos' };
  if (v < 0.5) return { ...base, pad: 'alto', olhos: 'fechados', y: -P * Math.round(suave(fatia(v, 0.3, 0.5))) };
  if (v < 2.5) return { ...base, pad: null, bracos: v < 0.65 ? [-3, -3] : [P, P], olhos: 'fechados', tv: false, sy: murcha };
  if (v < 3.1) {
    const w = fatia(v, 2.5, 3.1), inc = Math.sin(Math.PI * w);
    return { ...base, pad: w >= 0.5 ? 'colo' : null, tv: false, x: -P * Math.round(2 * inc), bracos: [P - 3 * inc, P], sy: murcha * (1 - 0.06 * inc) };
  }
  return { ...base, tv: v > 3.6 };
}
// o controle jogado (perdeu, raiva 'joga'): onde está, ou null se está na mão
const PAD_CHAO = -30;  // x do meio do controle no chão (à esquerda dele)
function padSolto(p, u) {
  if (p.ganha || p.raiva !== 'joga') return null;
  const v = u - FIM;
  if (v < 0.5 || v >= 2.8) return null;
  // x = o meio do controle, y = o topo; sai do alto (sentado, PAD_ALTO + 3) e cai no chão
  const y0 = PAD_ALTO + 3 - P, chao = -PADH, colo = PAD_COLO + 3;
  if (v < 0.85) { const w = (v - 0.5) / 0.35; return { x: PAD_CHAO * w, y: y0 + (chao - y0) * w * w - 6 * Math.sin(Math.PI * w) }; }
  if (v < 1.05) { const w = (v - 0.85) / 0.2; return { x: PAD_CHAO - 3 * w, y: chao - 3 * Math.sin(Math.PI * w) }; }  // quica
  if (v < 2.5) return { x: PAD_CHAO - 3, y: chao };
  const w = (v - 2.5) / 0.3;  // volta pra mão num arquinho
  return { x: (PAD_CHAO - 3) * (1 - w) - 2 * P * w, y: chao + (colo - chao) * w - 10 * Math.sin(Math.PI * w) };  // ele está inclinado 2 px
}
// a bufada: 3 bufadas (0 · 0,55 · 1,1 s), cada uma solta uma nuvenzinha de cada lado da cabeça
// que sobe, abre um tico pra fora, cresce e some em 0,6 s (3 quadradinhos, branca e cinza);
// e a veia de bravo (vermelha) no canto de cima da cabeça
const BUFA = [0, 0.55, 1.1];
const NUVEM = [[0, 0, 1], [1.2, -0.9, 0.8], [1.6, 0.5, 0.7]];  // [dx, dy, tamanho] em unidades de P
function bufada(g, d, sy) {
  if (d < 0 || d > 1.8) return;
  const a0 = g.globalAlpha;
  for (const t0 of BUFA) {
    const e = d - t0;
    if (e < 0 || e >= 0.6) continue;
    const u = e / 0.6, s = 1.5 + 2.5 * sai(u);
    g.globalAlpha = a0 * (u < 0.6 ? 1 : (1 - u) / 0.4);
    for (const lado of [-1, 1]) {
      const cx = lado * (9.5 + 3 * sai(u)), cy = -10.5 * sy - 9 * sai(u);
      NUVEM.forEach(([dx, dy, k], i) => {
        const w = s * k * P / 1.5;
        g.fillStyle = i ? '#D1D5DB' : '#F3F4F6';
        g.fillRect(cx + lado * dx * s * 0.6 - w / 2, cy + dy * s * 0.6 - w / 2, w, w);
      });
    }
  }
  g.globalAlpha = a0;
  if (d < 1.7) {
    const k = sai(lim(d / 0.12, 0, 1)), w = 5 * P * k;
    g.save(); g.translate(-11, -17 * sy); g.globalAlpha *= d < 1.5 ? 1 : (1.7 - d) / 0.2;
    g.drawImage(arte(VEIA, { '#': '#EF4444' }), -w / 2, -w / 2, w, w); g.restore();
  }
}
const VEIA = ['.#.#.', '##.##', '.....', '##.##', '.#.#.'];
// confete de quem ganhou (16 pedaços, como a festa do tema; não cai no cartão)
function confete(g, sem, k, d) {
  if (d < 0 || d > 1.8) return;
  const r = sorte(sem, k, 3), a0 = g.globalAlpha;
  for (let i = 0; i < 16; i++) {
    const vx = (r() - 0.5) * 60, vy = -(40 + r() * 60), cor = CONFETE[Math.floor(r() * 6)], gira = Math.floor(r() * 4), t0 = r() * 0.08;
    const e = d - t0;
    if (e < 0) continue;
    const x = vx * e, y = -34 + vy * e + 70 * e * e;
    if (y > -2) continue;
    g.globalAlpha = a0 * (e > 1.3 ? Math.max(0, (1.8 - e) / 0.5) : 1); g.fillStyle = cor;
    if ((Math.floor(e * 10) + gira) % 2) g.fillRect(x, y, 2, 1); else g.fillRect(x, y, 1, 2);
  }
  g.globalAlpha = a0;
}

// ---------- a TV ----------
function tvSprite(g, esc) {
  if (esc <= 0) return;
  const img = arte(TV, COR_TV), w = TVW * P, h = TVH * P;
  if (esc === 1) { g.drawImage(img, TVX, -h, w, h); return; }
  g.save(); g.translate(TVX + w / 2, 0); g.scale(esc, esc); g.drawImage(img, -w / 2, -h, w, h); g.restore();
}
function texto(g, linhas, i, j, cor, k = 1) {
  const img = arte(linhas, { '#': cor, y: COR_TROFEU.y, w: COR_TROFEU.w, o: COR_TROFEU.o });
  g.drawImage(img, SX + i * P, SY + j * P, img.width * P * k, img.height * P * k);
}
// o que a tela mostra em t (TV ligada)
function conteudo(g, sem, t) {
  fundoTela(g);
  const o = ondeEsta(sem, t);
  if (!o) return;
  const { p, fase, u } = o, J = JOGO[p.jogo];
  if (fase === 'conta') {
    const n = 3 - Math.floor(u / 0.5), f = (u % 0.5) / 0.5;
    if (f < 0.8) texto(g, DIGITOS[n], 4, 0, '#E5E7EB', 2);
    return;
  }
  if (fase === 'jogo') { J.tela(g, p.pl, u); return; }
  if (fase === 'menu') {
    if (p.chuvisco && u >= CH.ini && u < CH.fim) { chuvisco(g, t); return; }
    if ((u % 1.0) < 0.6) texto(g, PLAY, 5, 1, '#E5E7EB');
    return;
  }
  // resultado: o lance final · pisca 2x · troféu (ganhou) ou X (perdeu) · some no fim
  const cor = p.ganha ? '#22C55E' : '#EF4444';
  if (u < FIM) { J.tela(g, p.pl, p.pl.G + u); return; }
  const v = u - FIM;
  if (v < 0.4) { J.tela(g, p.pl, p.pl.G + FIM); brilhoTela(g, cor, Math.floor(v / 0.1) % 2 ? 0 : 0.7); return; }
  if (v > RES - FIM - 0.5) return;  // a tela limpa antes do menu
  if (p.ganha) {
    const y = v < 0.6 ? Math.round(2 * (1 - sai((v - 0.4) / 0.2))) : 0;
    texto(g, TROFEU, 2, 1 + y, '#FACC15');
    // brilhinhos em volta
    const f = Math.floor(v / 0.2) % 4;
    g.fillStyle = '#FEF9C3';
    if (f === 0) { cel(g, 1, 1); cel(g, 12, 5); } else if (f === 2) { cel(g, 12, 1); cel(g, 1, 6); }
    g.fillStyle = '#22C55E'; cel(g, 4, 9, 6, 1);
  } else if (Math.floor((v - 0.4) / 0.35) % 2 === 0 || v > 2) texto(g, XIS, 3, 2, '#EF4444');
}
// o chuvisco: a tela cinza com pontinhos claros e escuros sorteados a cada 0,07 s e uma faixa
// clara que desce devagar
function chuvisco(g, t) {
  g.fillStyle = '#52525B'; fundoTelaCor(g);
  const faixa = Math.floor((t * 6) % (SH + 3)) - 1;
  g.fillStyle = '#71717A'; cel(g, 0, faixa, SW, 2);
  const r = rng(Math.floor(t / 0.07) * 7919 + 13);
  for (let i = 0; i < 42; i++) {
    const v = r(), x = Math.floor(r() * SW), y = Math.floor(r() * SH);
    if ((x === 0 || x === SW - 1) && (y === 0 || y === SH - 1)) continue;  // os cantos redondos
    g.fillStyle = v < 0.4 ? '#E5E7EB' : v < 0.7 ? '#A1A1AA' : '#27272A';
    cel(g, x, y);
  }
}
const DUVIDA = ['###', '..#', '.##', '...', '.#.'];
// a TV tremendo depois do tapa (px pro lado), e o "?" e a estrelinha do tapa
function tremor(o) {
  if (!o || o.fase !== 'menu' || !o.p.chuvisco) return 0;
  const d = o.u - CH.tapa;
  return d >= 0 && d < 0.3 ? (Math.floor(d / 0.05) % 2 ? P : -P) * (d < 0.2 ? 1 : 0) : 0;
}
function enfeitesChuvisco(g, o, ps) {
  if (!o || o.fase !== 'menu' || !o.p.chuvisco) return;
  const u = o.u;
  if (u >= CH.duvida && u < CH.inclina + 0.1) {  // "?" em cima da cabeça
    const k = sai(fatia(u, CH.duvida, CH.duvida + 0.12));
    g.save(); g.translate(0, -17); g.scale(k, k);
    g.drawImage(arte(DUVIDA, { '#': '#E5E7EB' }), -2.25, -7.5, 4.5, 7.5); g.restore();
  }
  const d = u - CH.tapa;
  if (d >= 0 && d < 0.25) {  // a estrelinha do tapa, onde a mão bate na TV
    g.fillStyle = Math.floor(d / 0.06) % 2 ? '#FACC15' : '#FFFFFF';
    const x = TVX + 0.75, y = -10.5, s = d < 0.1 ? 1 : 2.5;
    g.fillRect(x - 0.75, y - 0.75 - s, P, P + 2 * s); g.fillRect(x - 0.75 - s, y - 0.75, P + 2 * s, P);
  }
}
// a tela ligando (0..1): um risco que cresce no meio, abre pra cima e pra baixo, clarão que apaga
function ligando(g, f) {
  if (f <= 0) return;
  const cx = SX + SW * P / 2, cy = SY + SH * P / 2;
  if (f < 0.3) { const w = SW * P * sai(f / 0.3); g.fillStyle = '#E5E7EB'; g.fillRect(cx - w / 2, cy - P / 2, w, P); return; }
  const v = (f - 0.3) / 0.7, h = Math.max(P, SH * P * sai(v));
  g.save(); g.globalAlpha *= 1 - 0.7 * v; g.fillStyle = '#E5E7EB'; g.fillRect(SX, cy - h / 2, SW * P, h); g.restore();
}
// a tela desligando (0..1): a imagem clareia e fecha num risco, o risco vira um ponto que apaga
function desligando(g, f) {
  const cx = SX + SW * P / 2, cy = SY + SH * P / 2;
  if (f < 0.45) { const h = Math.max(P, SH * P * (1 - sai(f / 0.45))); g.fillStyle = '#E5E7EB'; g.fillRect(SX, cy - h / 2, SW * P, h); return; }
  if (f < 0.8) { const w = Math.max(P, SW * P * (1 - sai((f - 0.45) / 0.35))); g.fillStyle = '#FFFFFF'; g.fillRect(cx - w / 2, cy - P / 2, w, P); return; }
  g.save(); g.globalAlpha *= 1 - (f - 0.8) / 0.2; g.fillStyle = '#FFFFFF'; g.fillRect(cx - P / 2, cy - P / 2, P, P); g.restore();
}
// o fio, do controle até a TV, caindo até o chão no meio (atrás do Clawd); parte = 0..1 (a entrada)
function fio(g, ax, ay, parte = 1) {
  const bx = TVX + 0.75, by = -2.25, mx = (ax + bx) / 2, my = 1.5;
  const n = Math.ceil(Math.hypot(bx - ax, by - ay) / 1.1) + 2, ate = Math.round(n * parte);
  g.fillStyle = FIO;
  for (let i = 0; i <= ate; i++) {
    const s = i / n, x = (1 - s) * (1 - s) * ax + 2 * s * (1 - s) * mx + s * s * bx, y = Math.min(-0.75, (1 - s) * (1 - s) * ay + 2 * s * (1 - s) * my + s * s * by);
    g.fillRect(Math.round(x / 0.75) * 0.75 - 0.75, Math.round(y / 0.75) * 0.75 - 0.75, P, P);
  }
}
// a ponta do fio no controle (no colo / no alto / solto)
function pontaFio(ps, solto) {
  if (solto) return [solto.x + PADW / 2 - P, solto.y + 3 * P];
  const dy = ps.sentado ? 3 : 0, y = (ps.pad === 'alto' ? PAD_ALTO : PAD_COLO) + dy;
  return [(ps.x || 0) + PADX + PADW - P, (ps.y || 0) + y + 3 * P];
}

// ---------- o quadro ----------
// a TV aparece num puf e cresce passando um tico do tamanho
const escTV = t => t >= T.tv + 0.4 ? 1 : t < T.tv + 0.3 ? 1.12 * sai(fatia(t, T.tv, T.tv + 0.3)) : 1.12 - 0.12 * fatia(t, T.tv + 0.3, T.tv + 0.4);
function quadro(g, t, sem) {
  if (t < T.tv) { desenhaClawd(g, { pernas: 'ambas' }); return; }
  const ps = pose(sem, t), o = ondeEsta(sem, t), solto = o && o.fase === 'res' ? padSolto(o.p, o.u) : null;
  const treme = tremor(o);
  if (treme) { g.save(); g.translate(treme, 0); }
  tvSprite(g, escTV(t));
  if (t >= T.liga) {
    if (t < T.ligou) ligando(g, (t - T.liga) / (T.ligou - T.liga));
    else conteudo(g, sem, t);
    cantos(g);
    g.fillStyle = '#22C55E'; g.fillRect(LED[0], LED[1], P, P);
  }
  if (treme) g.restore();
  // o fio (atrás dele) e o Clawd
  if (ps.pad || solto) fio(g, ...pontaFio(ps, solto), fatia(t, T.fio, T.fio + 0.2));
  desenhaPose(g, ps);
  if (solto) controle(g, solto.x - PADW / 2, solto.y);
  pufTV(g, t - T.tv);
  enfeitesChuvisco(g, o, ps);
  if (o && o.fase === 'res') {
    const v = o.u - FIM;
    if (o.p.ganha) confete(g, sem, o.p.k, v - (o.p.festa === 'pulos' ? 0.25 : 0.1));
    else bufada(g, v - (o.p.raiva === 'joga' ? 0.75 : 0.4), ps.sy || 1);
  }
}

module.exports = {
  texturas: [],
  linhaDoTempo: [
    [0, 'em pé, normal'], [T.tv, 'puf: uma TVzinha de tubo aparece na frente dele'],
    [T.senta, 'senta olhando pra TV'], [T.controle, 'o controle aparece no colo, com o fio até a TV'],
    [T.liga, 'a tela liga (um risco que abre)'], [INICIO, '3, 2, 1...'],
    [INICIO + CONTA, 'joga (14 a 20 s): corrida pulando bugs, pong ou navinha (os 3 a cada 3 partidas); os braços e o corpo vão junto'],
    [INICIO + CONTA + 17, 'ganhou: tela pisca verde, troféu; ele pula ou dança com o controle pro alto, confete'],
    [INICIO + CONTA + 17.1, 'ou perdeu: pisca vermelho, X; ele bufa (olhos fechados, murcha, fumacinha, veia de bravo); às vezes joga o controle no chão e pega de volta'],
    [INICIO + CONTA + 17 + RES, 'menu: ▶ piscando, ele olha pra gente e esquenta os dedos'],
    [INICIO + CONTA + 17 + RES + 0.1, 'de vez em quando (1 menu em 5): a TV dá chuvisco, ele olha pra gente com um "?" e dá um tapa nela'],
    [INICIO + JANELA, `outra partida a cada ${JANELA} s, até algo rodar`],
  ],
  cena(m) {
    const sem = Math.floor(m.sorteio() * 4294967296);
    sementes.set(m, sem);
    return {
      nome: 'parado', dur: Infinity, espaco: { frente: 0, tras: 0 }, modos: ['parado'],
      quadro(g, t) { quadro(g, t, sem); },
    };
  },
  // algo voltou a rodar: a TV desliga (fecha num risco e num ponto), TV e controle somem num
  // puf, ele levanta espreguiçando e fica em pé normal no lugar
  saida: {
    dur: 1.0,
    quadro(g, u, m, tCorte) {
      const sem = sementes.get(m) || 0, c = Math.max(0, tCorte || 0);
      if (c < T.tv) { desenhaClawd(g, { pernas: 'ambas' }); return; }
      const ps0 = pose(sem, c), o = ondeEsta(sem, c), solto = o && o.fase === 'res' ? padSolto(o.p, o.u) : null;
      const ligada = c >= T.liga;
      // a TV: desliga 0–0,3 · puf e encolhe 0,3–0,45
      const some = 1 - fatia(u, 0.3, 0.45);
      if (some > 0) {
        tvSprite(g, escTV(c) * some);
        if (ligada && u < 0.3 && some === 1) {
          if (u < 0.06) { if (c < T.ligou) ligando(g, (c - T.liga) / (T.ligou - T.liga)); else conteudo(g, sem, c); }
          desligando(g, u / 0.3);
          cantos(g);
        }
      }
      // o Clawd: desce se estava no ar, o que fazia volta pro normal em 0,15 s; senta até 0,45
      const v = 1 - fatia(u, 0, 0.15), sentado = ps0.sentado;
      const ps = { sentado, x: P * Math.round((ps0.x || 0) * v / P), y: (ps0.y || 0) * v, sy: 1 + ((ps0.sy || 1) - 1) * v, olhos: u < 0.15 ? ps0.olhos : 'abertos' };
      const temPad = (ps0.pad || solto) && u < 0.45;
      if (temPad && !solto) { ps.pad = ps0.pad === 'alto' && v > 0 ? 'alto' : 'colo'; ps.padEsc = (ps0.padEsc ?? 1) * (1 - fatia(u, 0.3, 0.45)); ps.bracos = ps0.bracos ? ps0.bracos.map(b => b * v + P * (1 - v)) : null; }
      if (u >= 0.45 && sentado) {  // levanta espreguiçando
        const w = fatia(u, 0.45, 0.75);
        if (w < 1) { desenhaClawd(g, { sy: 1 + 0.1 * Math.sin(Math.PI * w) }); } else desenhaClawd(g, { pernas: 'ambas' });
      } else if (u >= 0.45) desenhaClawd(g, { pernas: 'ambas' });
      else {
        if (temPad && u < 0.3) fio(g, ...pontaFio(ps, solto), fatia(c, T.fio, T.fio + 0.2));  // o fio some com a TV
        desenhaPose(g, ps);
        if (temPad && solto) controle(g, solto.x - PADW / 2, solto.y, 1 - fatia(u, 0.3, 0.45));
      }
      pufTV(g, c - T.tv + u);  // o da entrada, se ainda estava no ar
      pufTV(g, u - 0.3);
      if (solto) puf(g, solto.x, solto.y + PADH / 2, u - 0.3, 0.5);  // o do colo só encolhe (o puf cobriria ele)
    },
  },
  // pros testes: a partida k (jogo, ganha, plano), onde está em t, os tempos e as contas dos jogos
  partida, ondeEsta, INICIO, JANELA, CONTA, RES, FIM, MAXG, T, TVX, SX, SY, SW, SH,
  jogos: { PU, PO, NA, puloEm, raquetes, segPong, dobra, naveX, bugX },
};
