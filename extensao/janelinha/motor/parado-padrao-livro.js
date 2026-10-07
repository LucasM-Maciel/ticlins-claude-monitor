'use strict';
// GUARDADA, DESLIGADA: na prévia de 07/10 o dono escolheu o videogame; pra ligar, pôr 'livro'
// no paradas('padrao', [...]) do tema-padrao.js.
// Tema Padrão, parado há muito tempo: o Clawd LÊ UM LIVRO GROSSO ("a documentação": capa escura
// com o ✻ laranja do Claude Code). O livro aparece num puf, pesa nos braços, abre na frente dele
// (só os olhos por cima) e ele lê: os olhos vão e voltam acompanhando as linhas, e a cada 6,5 a
// 10,5 s ele vira a página (a folha levanta, fica em pé e passa pro outro lado). As páginas
// variam (texto, título laranja, bloco de código). Às vezes uma ideia (o ✻ girando e a lâmpada,
// como na cena 'pensando') ou um marca-texto amarelo numa linha. De vez em quando COCHILA: pisca
// devagar e (a) afunda a cara no livro aberto, (b) fecha o livro devagarinho e dorme abraçado
// nele (a lombada grossa na frente), ou (c) quase dorme e se pega; z z z, e acorda num susto
// (pulinho e "!"). Depois do (b) ele reabre e folheia rápido procurando onde estava.
// Saída (algo voltou a rodar): acorda, fecha o livro com um "tum" (poeirinha), o livro some num
// puf e ele se espreguiça, como o acordar do tema.
// Tudo função do tempo: o laço é dividido em janelas de J s, cada uma sorteada com rng(semente +
// k) (cache com teto); a semente fica num WeakMap pra saída saber o que estava acontecendo.
const { lim, sai, rng, arte, cache } = require('./comum');
const { desenhaClawd } = require('./clawd');

const P = 1.5;                // o pixel do Clawd
const CORPO = '#D77757', OLHO = '#1A1A1A';
const sementes = new WeakMap();  // mundo -> semente da cena

// ---------- desenhos (1 DIP por pixel, como o notebook e a lista do tema) ----------
// o livro aberto com folhas de pw px: borda da capa dos lados e embaixo, as duas folhas (o topo
// arqueado), a dobra no meio e a grossura embaixo (bordas das folhas). Largura 2*pw + 4.
const COR_LIVRO = { c: '#52525B', k: '#3F3F46', w: '#F3F4F6', e: '#E5E7EB', d: '#A1A1AA', g: '#D1D5DB' };
function linhasAberto(pw) {
  const f = ch => ch.repeat(pw), F = pw - 2;
  return [
    '..' + 'w'.repeat(F) + '....' + 'w'.repeat(F) + '..',
    '.' + f('w') + 'gg' + f('w') + '.',
    ...Array.from({ length: 5 }, () => 'c' + f('w') + 'gg' + f('w') + 'c'),
    'c' + f('e') + 'gg' + f('e') + 'c',
    'c' + f('d') + 'kk' + f('d') + 'c',
    'c' + f('e') + 'kk' + f('e') + 'c',
    'k'.repeat(2 * pw + 4),
  ];
}
const ALT_ABERTO = 11, PW = 10;
const FECHA = [PW, 7, 4, 0];  // pw das folhas nos quadros de abrir/fechar (0 = fechado)
// o livro fechado de frente (a capa: borda clara, o ✻ e a grossura à direita e embaixo) e de lado
// (a lombada grossa, com as faixas laranja e o ✻ pequeno: quando ele dorme abraçado)
const CAPA = [
  'cccccccccccccc..',
  'cKKKKKKKKKKKKcw.',
  'cKKKKKKKKKKKKcwk',
  'cKKKKKKKKKKKKcdk',
  'cKKKKKKKKKKKKcwk',
  'cKKKKKKKKKKKKcdk',
  'cKKKKKKKKKKKKcwk',
  'cKKKKKKKKKKKKcdk',
  'cKKKKKKKKKKKKcwk',
  'cKKKKKKKKKKKKcdk',
  'cccccccccccccckk',
  '.kkkkkkkkkkkkkk.',
];
const LOMBADA = [
  'cKKKKKKc',
  'cOOOOOOc',
  'cKKKKKKc',
  'cKoKoKoc',
  'cKKoooKc',
  'cKoooooc',
  'cKKoooKc',
  'cKoKoKoc',
  'cKKKKKKc',
  'cOOOOOOc',
  'cKKKKKKc',
  'kkkkkkkk',
];
const COR_CAPA = { c: '#52525B', K: '#27272A', w: '#E5E7EB', d: '#A1A1AA', k: '#3F3F46', O: CORPO, o: CORPO };
const ASTER = [  // os 6 desenhos do ✻ do tema (ida e volta); o do meio vai na capa
  ['.......', '.......', '.......', '...#...', '.......', '.......', '.......'],
  ['.......', '...#...', '...#...', '.#####.', '...#...', '...#...', '.......'],
  ['.......', '.#.#.#.', '..###..', '.#####.', '..###..', '.#.#.#.', '.......'],
  ['...#...', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '...#...'],
  ['#..#..#', '.#.#.#.', '..###..', '###.###', '..###..', '.#.#.#.', '#..#..#'],
  ['.#.#.#.', '##.#.##', '..###..', '###.###', '..###..', '##.#.##', '.#.#.#.'],
];
const SEQ_ASTER = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1];
const LAMPADA = ['.yyy.', 'yWyyy', 'yyyyy', 'yyyyy', '.yyy.', '.ggg.', '..g..'];
const COR_LAMPADA = { y: '#FACC15', W: '#FEF9C3', g: '#9CA3AF' };
const RAIOS = [[-6, -25, 2, 1], [4, -25, 2, 1], [-5, -29, 1, 1], [4, -29, 1, 1], [-0.5, -30, 1, 2]];
const ZS = [['###', '.#.', '###'], ['####', '..#.', '.#..', '####'], ['#####', '...#.', '..#..', '.#...', '#####']];
const EXCL = ['##', '##', '##', '..', '##'];
let SPR = null;  // prontos 1x (poucos e pequenos)
function sprites() {
  if (SPR) return SPR;
  SPR = {
    aberto: Object.fromEntries(FECHA.filter(pw => pw).map(pw => [pw, arte(linhasAberto(pw), COR_LIVRO)])),
    capa: arte(CAPA, COR_CAPA), estrela: arte(ASTER[3], { '#': CORPO }), lombada: arte(LOMBADA, COR_CAPA),
    ast: ASTER.map(a => arte(a, { '#': CORPO })), lamp: arte(LAMPADA, COR_LAMPADA),
    zs: ZS.map(z => arte(z, { '#': '#CBD5E1' })), excl: arte(EXCL, { '#': '#FACC15' }),
  };
  return SPR;
}

// ---------- o que está escrito: cada folha sorteada pelo número dela ----------
// texto (3 linhas cinza), título (a 1ª laranja e curta) ou código (1 linha e um bloco escuro com
// riscos coloridos). Linhas: [x, largura, cor] dentro da folha.
const CORES_COD = ['#D77757', '#60A5FA', '#22C55E', '#E5E7EB'];
const PAGINAS = cache(64);
function pagina(sem, id) {
  const chave = sem + ':' + id, pronta = PAGINAS.get(chave);
  if (pronta) return pronta;
  const r = rng((sem ^ Math.imul(id + 1, 0x9E3779B1)) >>> 0), x = r();
  const cinza = () => [1, 4 + Math.floor(r() * 5), '#A1A1AA'];
  let linhas, bloco = null;
  if (x < 0.5) linhas = [cinza(), cinza(), cinza()];
  else if (x < 0.75) linhas = [[1, 3 + Math.floor(r() * 3), CORPO], cinza(), cinza()];
  else {
    linhas = [cinza()];
    bloco = [[2 + Math.floor(r() * 3), CORES_COD[Math.floor(r() * 4)]], [2 + Math.floor(r() * 4), CORES_COD[Math.floor(r() * 4)]]];
  }
  return PAGINAS.set(chave, { linhas, bloco });
}
// as linhas de uma folha de pw px a partir de (x0, y0) = canto de cima à esquerda da folha
function escrita(g, pg, x0, y0, pw, marca) {
  const max = pw - 1;
  if (marca && marca.u > 0) {  // o marca-texto: faixa amarela atrás da linha, crescendo da esquerda
    const [lx, lw] = pg.linhas[Math.min(marca.linha, pg.linhas.length - 1)], w = Math.round(Math.min(lw + 2, max - lx + 1) * marca.u);
    if (w > 0) { g.fillStyle = '#FACC15'; g.fillRect(x0 + lx - 1, y0 + 1 + Math.min(marca.linha, pg.linhas.length - 1) * 2, w, 3); }
  }
  pg.linhas.forEach(([lx, lw, cor], i) => {
    const w = Math.min(lw, max - lx);
    if (w > 0) { g.fillStyle = cor; g.fillRect(x0 + lx, y0 + 2 + i * 2, w, 1); }
  });
  if (pg.bloco) {
    g.fillStyle = '#3F3F46'; g.fillRect(x0 + 1, y0 + 4, max - 1, 4);
    pg.bloco.forEach(([w, cor], i) => { g.fillStyle = cor; g.fillRect(x0 + 2 + i, y0 + 5 + i, Math.min(w, max - 3 - i), 1); });
  }
}

// ---------- linha do tempo ----------
const T = { puf: 0.35, pesa: 0.55, abre: 0.9, ler: 1.25 };
const J = 40;                 // s por janela do laço
const FLIP = 0.4, RAPIDO = 0.22;
const LINHA = 1.25;           // s lendo cada linha (os olhos vão e voltam)
const TOPO = -8;              // y do topo das folhas (logo abaixo dos olhos)
const BRACOS = 3;             // os braços do sprite descem pra trás do livro (as mãos são desenhadas nele)

// sorteio repetível de uma janela k (canal separa os usos)
const sorte = (sem, k, canal) => rng((sem + Math.imul(k + 1, 0x9E3779B1) + Math.imul(canal, 0x85EBCA6B)) >>> 0);
const cochilaBruto = (sem, k) => sorte(sem, k, 2)() < 0.25;
// As 3 primeiras janelas têm o evento fixo (a prévia mostra tudo em ~1,5 min; o resto é sorteado):
// 0 = ideia em PRIMEIRA.ideia, 1 = cochilo (tipo sorteado) em PRIMEIRA.cochilo, 2 = marca-texto.
const PRIMEIRA = { vira: 7.5, ideia: 9.9, vira1: 8, cochilo: 11, dorme: 8, marca: 10.5 };
// o plano da janela k: as viradas de página, o cochilo (ou nada) e o evento (ideia, marca-texto)
const PLANOS = cache(32);
function plano(sem, k) {
  const chave = sem + ':' + k, pronto = PLANOS.get(chave);
  if (pronto) return pronto;
  const r = sorte(sem, k, 1);
  const vira = [{ t0: 0, dur: k === 0 ? 0 : FLIP }];  // a janela começa virando a página (a 0ª só abre)
  // cochila: a 2ª janela sempre; depois ~1 em 5 janelas, nunca duas seguidas
  const cochila = k === 1 || (k >= 3 && cochilaBruto(sem, k) && !cochilaBruto(sem, k - 1));
  let soneca = null, evento = null;
  if (cochila) {
    const x = r(), tipo = x < 0.38 ? 'afunda' : x < 0.76 ? 'abraca' : 'quase';
    soneca = { tipo, espera: 2 + r() * 2, dorme: k === 1 ? PRIMEIRA.dorme : 6 + r() * 5, rapidas: 2 + Math.floor(r() * 2) };
  } else {
    const x = r();
    const tipo = k === 0 ? 'ideia' : k === 2 ? 'marca' : x < 0.4 ? 'ideia' : x < 0.8 ? 'marca' : null;
    if (tipo) evento = { tipo, ondeVira: 1 + Math.floor(r() * 2), espera: 1.5 + r() * 2, linha: Math.floor(r() * 3), lado: r() < 0.5 ? 0 : 1 };
  }
  let s = 0;
  if (k <= 2) {  // a 1ª virada das 3 primeiras janelas é fixa (a ideia, o cochilo e a marca na linha do tempo)
    s = k === 0 ? PRIMEIRA.vira : PRIMEIRA.vira1;
    vira.push({ t0: s, dur: FLIP });
    if (evento) { evento.ondeVira = 1; evento.espera = (k === 0 ? PRIMEIRA.ideia : PRIMEIRA.marca) - s - FLIP; }
    if (soneca) soneca.espera = PRIMEIRA.cochilo - s - FLIP;
  }
  for (;;) {
    const i = vira.length - 1;
    if (soneca && soneca.c0 == null && i === 1) {  // cochila lendo a 2ª aberta da janela
      const c = soneca;
      c.c0 = s + vira[i].dur + c.espera;
      c.c1 = c.c0 + (c.tipo === 'quase' ? 2.2 : 3.0);              // sonolento: pisca devagar
      if (c.tipo === 'quase') { c.c2 = c.c3 = c.c1 + 0.8; c.fim = c.c3 + 0.6; }  // cabeceia e se pega
      else {
        c.c2 = c.c1 + (c.tipo === 'afunda' ? 1.2 : 1.4);           // afunda / fecha o livro devagar
        c.c3 = c.c2 + c.dorme;                                       // dorme (z z z)
        c.c4 = c.fim = c.c3 + 0.7;                                   // o susto
        if (c.tipo === 'abraca') {                                   // reabre e folheia rápido
          c.c5 = c.c4 + 0.35;
          for (let j = 0; j < c.rapidas; j++) vira.push({ t0: c.c5 + j * 0.27, dur: RAPIDO });
          c.fim = c.c5 + c.rapidas * 0.27;
        }
      }
      s = c.fim;
      continue;
    }
    const prox = s + (i === 0 && k > 0 ? FLIP : 0) + 6.5 + r() * 4;
    if (prox > J - 3.5) break;
    vira.push({ t0: prox, dur: FLIP });
    s = prox;
  }
  if (evento) {
    const j = Math.min(evento.ondeVira, vira.length - 1), v = vira[j];
    evento.e0 = v.t0 + v.dur + evento.espera;
    evento.folha = idAberta(k, j) * 2 + evento.lado;
  }
  return PLANOS.set(chave, { k, vira, soneca, evento });
}
const idAberta = (k, j) => k * 64 + j;   // a aberta j da janela k (as folhas: 2*id e 2*id + 1)

// onde está o laço em t: janela k, s (tempo nela), a aberta j, a virada de página (ou null) e
// desde (s lendo esta aberta)
function ondeEsta(sem, t) {
  const tl = t - T.ler, k = Math.floor(tl / J), s = tl - k * J, pl = plano(sem, k);
  let j = 0;
  while (j + 1 < pl.vira.length && pl.vira[j + 1].t0 <= s) j++;
  const v = pl.vira[j];
  let flip = null;
  if (v.dur > 0 && s < v.t0 + v.dur) {
    const de = j > 0 ? idAberta(k, j - 1) : idAberta(k - 1, plano(sem, k - 1).vira.length - 1);
    flip = { u: (s - v.t0) / v.dur, de, para: idAberta(k, j), rapido: v.dur < FLIP };
  }
  return { k, s, pl, j, flip, desde: s - v.t0 - v.dur };
}

// ---------- a pose num instante (função pura) ----------
// { livro: 'nenhum'|'capa'|'lombada'|'aberto', ab (pw das folhas), esc (escala do livro), ly
//   (desce o livro), cy (desce o Clawd), sy, sentado, pernas, bracos, olhos, desl (pupilas -1/0/1),
//   zs (s dormindo), excl (s desde o susto), ideia (s), onde (as páginas) }
function pose(sem, t) {
  if (t < T.puf) return { livro: 'nenhum' };
  if (t < T.ler) {  // aparece (puf), pesa nos braços e abre
    const pesa = t >= T.pesa && t < T.pesa + 0.3 ? Math.sin(Math.PI * (t - T.pesa) / 0.3) : 0;
    const q = lim(Math.floor((t - T.abre) / 0.08), -1, 2);
    return {
      livro: q < 0 ? 'capa' : 'aberto', ab: q < 0 ? 0 : FECHA[2 - q], esc: sai(lim((t - T.puf) / 0.2, 0, 1)),
      ly: pesa > 0.5 ? 1 : 0, sy: 1 - 0.07 * pesa, bracos: BRACOS * lim((t - T.puf) / 0.2, 0, 1),
    };
  }
  const o = ondeEsta(sem, t), { s, pl } = o, c = pl.soneca;
  const p = { livro: 'aberto', ab: PW, bracos: BRACOS, desl: olhosLendo(o.desde), onde: o };
  // piscadas: uma a cada ~3,7 s (janela própria)
  const kb = Math.floor((t - T.ler) / 3.7), rb = sorte(sem, kb, 3), tb = T.ler + kb * 3.7 + 0.4 + rb() * 2.8;
  if (rb() < 0.75 && t >= tb && t < tb + 0.12) p.olhos = 'fechados';
  if (o.flip) p.desl = o.flip.rapido ? 1 : o.flip.u < 0.5 ? 1 : -1;  // acompanha a folha
  if (c && s >= c.c0 && s < c.fim) cochilo(p, c, s);
  const ev = pl.evento;
  if (ev && ev.tipo === 'ideia' && s >= ev.e0 && s < ev.e0 + 2.3) {
    const e = s - ev.e0;
    p.ideia = e; p.olhos = e < 1.3 ? 'cima' : 'abertos'; p.desl = 0;
    if (e >= 1.3 && e < 1.55) p.cy = p.ly = -3 * Math.sin(Math.PI * (e - 1.3) / 0.25);
  }
  if (ev && ev.tipo === 'marca' && s >= ev.e0 - 0.3 && s < ev.e0 + 0.8) p.desl = ev.lado ? 1 : -1;  // olha a linha
  return p;
}
// os olhos lendo: 3 linhas na folha da esquerda, 3 na da direita; em cada linha vão da esquerda
// pro meio (ou do meio pra direita) e voltam no começo da próxima
function olhosLendo(d) {
  if (d < 0) return 0;
  const n = Math.floor(d / LINHA) % 6, f = (d % LINHA) / LINHA;
  return n < 3 ? (f < 0.6 ? -1 : 0) : (f < 0.45 ? 0 : 1);
}
// o cochilo na pose p (s = tempo na janela)
function cochilo(p, c, s) {
  p.desl = 0;
  if (s < c.c1) {  // sonolento: piscadas cada vez mais longas, o livro escorrega 1 px
    const u = (s - c.c0) / (c.c1 - c.c0);
    p.olhos = (u > 0.2 && u < 0.3) || (u > 0.5 && u < 0.66) || u > 0.82 ? 'fechados' : 'abertos';
    p.ly = u > 0.5 ? 1 : 0;
    return;
  }
  p.olhos = 'fechados';
  if (s < c.c3) {
    if (c.tipo === 'quase') {  // a cabeça cai 2 degraus
      p.cy = s - c.c1 < 0.4 ? P : 2 * P; p.ly = 1;
    } else if (c.tipo === 'afunda') {  // afunda atrás do livro em 3 degraus e respira lá
      p.cy = [P, 2 * P, 4][Math.min(2, Math.floor((s - c.c1) / 0.4))]; p.pernas = 'nenhuma'; p.ly = 1;
      if (s >= c.c2) { p.zs = s - c.c2; if (Math.sin(2 * Math.PI * p.zs / 2.4) > 0.3) p.cy = 4 - P; }
    } else {  // abraça: o livro fecha devagar (3 quadros), ele senta e dorme abraçado na lombada
      const q = Math.min(3, Math.floor((s - c.c1) / 0.35));
      p.ab = FECHA[q]; p.ly = 1;
      if (q >= 3) { p.livro = 'lombada'; p.bracos = 0; p.ly = 0; }
      if (s >= c.c2) {  // senta como no dorme do tema (amassa 0,3 s) e respira a cada 1,6 s
        const d = s - c.c2;
        p.zs = d; p.sentado = true; p.ly = 1;
        p.sy = d < 0.3 ? 1 - 0.12 * Math.sin(Math.PI * d / 0.3) : 1 + 0.05 * Math.sin(2 * Math.PI * (d - 0.3) / 1.6);
      }
    }
    return;
  }
  // o susto: pula, abre os olhos, "!"; o livro pula junto (o 'quase' só se pega e sacode a cabeça)
  const e = s - c.c3;
  p.olhos = 'abertos'; p.excl = e;
  if (c.tipo === 'quase') {
    if (e < 0.25) p.cy = p.ly = -3 * Math.sin(Math.PI * e / 0.25);
    else if (e < 0.5) p.cx = Math.floor(e / 0.06) % 2 ? 0.75 : -0.75;
    return;
  }
  if (c.tipo === 'abraca') {
    if (s < c.c4) { p.livro = 'lombada'; p.bracos = 0; }
    else { const q = Math.min(3, Math.floor((s - c.c4) / 0.09)); p.ab = FECHA[3 - q]; if (q === 0) p.livro = 'lombada'; }
  }
  if (e < 0.3) { p.cy = -5 * Math.sin(Math.PI * e / 0.3); p.ly = -3 * Math.sin(Math.PI * Math.min(1, e / 0.26)); }
  else if (e < 0.42) p.sy = 1 - 0.08 * Math.sin(Math.PI * (e - 0.3) / 0.12);
}

// ---------- desenho ----------
// os olhos: o sprite desenha 'abertos'/'fechados'/'cima'; desl move as pupilas 1 célula pro lado
const PUPILAS = { [-1]: (g, dy) => pupilas(g, dy, -1), 1: (g, dy) => pupilas(g, dy, 1) };
function pupilas(g, dy, desl) {
  for (const col of [5, 12]) {
    g.fillStyle = CORPO; g.fillRect((col - 9) * P, -12 + dy, P, 2 * P);
    g.fillStyle = OLHO; g.fillRect((col + desl - 9) * P, -12 + dy, P, 2 * P);
  }
}
// a folha virando (u 0..1): levanta da direita (a ponta de fora mais alta), fica em pé no meio
// (passa do topo do livro), deita na esquerda e assenta
function folha(g, u, y0) {
  const B = '#F3F4F6', S = '#D1D5DB';
  if (u < 0.25) {
    g.fillStyle = B; g.fillRect(1, y0 - 1, 4, 7); g.fillRect(5, y0 - 2, 3, 7);
    g.fillStyle = S; g.fillRect(7, y0 - 2, 1, 7);
  } else if (u < 0.5) {
    g.fillStyle = B; g.fillRect(-1, y0 - 4, 2, 10);
    g.fillStyle = S; g.fillRect(0, y0 - 4, 1, 10);
  } else if (u < 0.75) {
    g.fillStyle = B; g.fillRect(-5, y0 - 1, 4, 7); g.fillRect(-8, y0 - 2, 3, 7);
    g.fillStyle = S; g.fillRect(-8, y0 - 2, 1, 7);
  } else {
    g.fillStyle = B; g.fillRect(-11, y0, 10, 7);
    g.fillStyle = S; g.fillRect(-11, y0 + 1, 1, 6);
  }
}
// o livro aberto (pw), com as páginas de 'onde' (ou o que estava na 1ª aberta) e as mãos dos lados
function livroAberto(g, sem, pw, y0, o) {
  const S = sprites(), W = 2 * pw + 4, x0 = -W / 2;
  g.drawImage(S.aberto[pw], x0, y0, W, ALT_ABERTO);
  if (pw >= PW) {
    let esq = 0, dir = 1, marcas = null;
    if (o) {
      const id = idAberta(o.k, o.j);
      if (o.flip) { esq = (o.flip.u < 0.75 ? o.flip.de : o.flip.para) * 2; dir = o.flip.para * 2 + 1; }
      else { esq = id * 2; dir = id * 2 + 1; }
      const ev = o.pl.evento;
      if (ev && ev.tipo === 'marca' && o.s >= ev.e0) marcas = { [ev.folha]: { linha: ev.linha, u: lim((o.s - ev.e0) / 0.6, 0, 1) } };
    }
    escrita(g, pagina(sem, esq), x0 + 1, y0, pw, marcas && marcas[esq]);
    escrita(g, pagina(sem, dir), x0 + pw + 3, y0, pw, marcas && marcas[dir]);
    if (o && o.flip) folha(g, o.flip.u, y0);
  }
  g.fillStyle = CORPO;  // as mãos
  g.fillRect(-pw - 3.5, y0 + 2.5, 3, 3); g.fillRect(pw + 0.5, y0 + 2.5, 3, 3);
}
// o livro fechado: a capa (de frente) ou a lombada; y0 = topo das folhas; esc cresce/encolhe a
// partir de baixo (o puf)
function livroFechado(g, tipo, y0, esc = 1) {
  const S = sprites();
  g.save(); g.translate(0, y0 + 11); if (esc !== 1) g.scale(esc, esc);
  if (tipo === 'lombada') g.drawImage(S.lombada, -4, -12, 8, 12);
  else { g.drawImage(S.capa, -7, -12, 16, 12); g.drawImage(S.estrela, -3, -10, 7, 7); }
  g.restore();
}
// fumaça do puf: a do bug do tema (8 quadradinhos que nascem numa roda, sobem e crescem por 0,6 s)
const VOOS = [[-30, -60], [-12, -80], [10, -75], [28, -55], [-22, -30], [20, -35], [0, -90], [34, -20]];
function puf(g, cx, cy, d) {
  if (d < 0 || d >= 0.6) return;
  g.save(); g.globalAlpha *= 1 - d / 0.6;
  const w = 3 + 5 * d;
  VOOS.forEach(([vx, vy], i) => {
    g.fillStyle = i % 2 ? '#9CA3AF' : '#E5E7EB';
    g.fillRect(cx + vx * (0.06 + d * 0.3) - w / 2, cy + vy * (0.06 + d * 0.2) - 10 * d - w / 2, w, w);
  });
  g.restore();
}
// poeirinha do "tum" (u 0..1): 4 grãos saindo de baixo do livro pros lados
function poeira(g, u) {
  if (u < 0 || u >= 1) return;
  g.save(); g.globalAlpha *= 1 - u;
  for (let j = 0; j < 4; j++) {
    const lado = j % 2 ? 1 : -1, longe = j < 2 ? 1 : 0.6;
    g.fillStyle = j < 2 ? '#E5E7EB' : '#9CA3AF';
    g.fillRect(lado * (7 + 7 * sai(u) * longe) - 0.75, -1.5 - 3 * sai(u) * longe, P, P);
  }
  g.restore();
}
// z z z (os do dorme do tema: nascem a cada 0,9 s, sobem 16 px em 1,8 s, crescem 3→4→5 px)
function zzz(g, d, x0, y0) {
  const S = sprites(), a0 = g.globalAlpha, ZP = 1.4;
  for (let k = Math.max(0, Math.floor((d - 2.3) / 0.9)); 0.5 + 0.9 * k <= d; k++) {
    const e = d - (0.5 + 0.9 * k);
    if (e >= 1.8) continue;
    const u = e / 1.8, z = S.zs[Math.min(2, Math.floor(u * 3))];
    g.globalAlpha = a0 * (u < 0.1 ? u / 0.1 : u > 0.75 ? (1 - u) / 0.25 : 1);
    g.drawImage(z, x0 + 9 * u + Math.sin(u * 7) * 1.2, y0 - 16 * u - z.height * ZP, z.width * ZP, z.height * ZP);
  }
  g.globalAlpha = a0;
}
// a ideia: o ✻ girando em cima da cabeça 1,3 s, depois a lâmpada (raios piscando) e some
function ideia(g, e, pulo) {
  const S = sprites();
  if (e < 1.3) { g.drawImage(S.ast[SEQ_ASTER[Math.floor(e / 0.12) % SEQ_ASTER.length]], -3.5, -27, 7, 7); return; }
  g.save(); g.globalAlpha *= e < 2.1 ? 1 : Math.max(0, 1 - (e - 2.1) / 0.2);
  g.drawImage(S.lamp, -2.5, -27 + pulo, 5, 7);
  if (Math.floor(e / 0.15) % 2) { g.fillStyle = '#FDE047'; for (const [x, y, w, h] of RAIOS) g.fillRect(x, y + pulo, w, h); }
  g.restore();
}

function desenha(g, sem, p) {
  const S = sprites(), y0 = TOPO + (p.ly || 0), comLivro = p.livro && p.livro !== 'nenhum';
  const c = { pernas: p.pernas || 'ambas' };
  if (p.cx) c.x = p.cx;
  if (p.cy) c.y = p.cy;
  if (p.sy != null && p.sy !== 1) c.sy = p.sy;
  if (p.sentado) c.sentado = true;
  if (p.olhos && p.olhos !== 'abertos') c.olhos = p.olhos;
  if (comLivro || p.bracos) c.bracos = [p.bracos || 0, p.bracos || 0];
  if (p.desl) c.frente = PUPILAS[p.desl];
  desenhaClawd(g, c);
  if (p.livro === 'aberto' && p.ab > 0) livroAberto(g, sem, p.ab, y0, p.onde);
  else if (comLivro) livroFechado(g, p.livro === 'aberto' ? 'lombada' : p.livro, y0, p.esc ?? 1);
  if (p.puf != null) puf(g, 0.5, -3, p.puf);
  if (p.tum != null) poeira(g, p.tum);
  if (p.zs != null) zzz(g, p.zs, 5, (p.sentado ? 3 : 0) + (p.cy || 0) - 13);
  if (p.excl != null && p.excl < 0.6) {
    g.save(); g.globalAlpha *= p.excl < 0.45 ? 1 : (0.6 - p.excl) / 0.15;
    g.drawImage(S.excl, 9, -26 + Math.min(0, p.cy || 0), 2 * P, 5 * P); g.restore();
  }
  if (p.ideia != null) ideia(g, p.ideia, p.cy || 0);
}
function quadro(g, sem, t) {
  const p = pose(sem, t);
  if (t >= T.puf && t < T.puf + 0.6) p.puf = t - T.puf;
  desenha(g, sem, p);
}

// ---------- a saída ----------
// algo voltou a rodar: acorda (a cabeça volta pro lugar, os olhos abrem), fecha o livro (3
// quadros), "tum" (o livro afunda 1 px e solta poeirinha), o livro encolhe num puf (os braços
// voltam) e ele se espreguiça como no acordar do tema
const SAIDA = { tum: 0.25, some: 0.38, estica: 0.6, fim: 1.0 };
function saida(g, u, m, tCorte) {
  const sem = sementes.get(m) || 0, p0 = pose(sem, Math.max(0, tCorte || 0));
  if (p0.livro === 'nenhum') { desenhaClawd(g, { pernas: 'ambas' }); return; }  // nem tinha livro
  const volta = 1 - lim(u / 0.15, 0, 1);  // a cabeça e o livro voltam pro lugar
  const p = { livro: p0.livro, ab: p0.ab, cy: (p0.cy || 0) * volta, ly: Math.round((p0.ly || 0) * volta), bracos: p0.bracos, onde: p0.onde, esc: p0.esc };
  if (p.cy > 1) p.pernas = 'nenhuma';
  if (p0.sentado && u < 0.1) p.sentado = true;  // dormia sentado: levanta num pulo
  if (p0.livro === 'aberto') {  // fecha em 3 quadros (até a lombada)
    const q = FECHA.indexOf(p0.ab) + Math.floor(u / 0.08) + (p0.ab === PW ? 0 : 1);
    p.ab = FECHA[Math.min(3, q)];
    if (p.ab === 0) p.livro = 'lombada';
    if (p.ab < PW) p.onde = null;
  }
  if (u >= SAIDA.tum && u < SAIDA.some) { p.ly += 1; p.tum = (u - SAIDA.tum) / 0.3; }
  if (u >= SAIDA.some) {  // encolhe até o chão e os braços voltam
    const e = lim((u - SAIDA.some) / 0.2, 0, 1);
    p.esc = (p.esc ?? 1) * (1 - sai(e)); p.bracos = (p.bracos || 0) * (1 - e); p.tum = (u - SAIDA.tum) / 0.3;
    if (e >= 1) { p.livro = 'nenhum'; p.bracos = 0; }
  }
  const e = u - SAIDA.estica;  // espreguiça (0,3 s) e fica em pé
  if (e >= 0) p.sy = e < 0.3 ? 1 + 0.08 * Math.sin(Math.PI * e / 0.3) : 1;
  desenha(g, sem, p);
  puf(g, 0.5, -3, (u - SAIDA.some) * 1.25);  // o puf (0,6 s do tema, um pouco mais rápido)
  const c = Math.max(0, tCorte || 0);
  if (c >= T.puf && c < T.puf + 0.6) puf(g, 0.5, -3, c - T.puf + u);  // o puf da entrada termina
  if (u < 0.2 && (p0.zs != null || p0.ideia != null)) {  // os z e a ideia somem rapidinho
    g.save(); g.globalAlpha *= 1 - u / 0.2;
    if (p0.zs != null) zzz(g, p0.zs, 5, (p0.sentado ? 3 : 0) + (p0.cy || 0) - 13);
    if (p0.ideia != null) ideia(g, p0.ideia, 0);
    g.restore();
  }
}

module.exports = {
  texturas: [],
  linhaDoTempo: [
    [0, 'em pé, normal'],
    [T.puf, 'puf: aparece um livro grosso, capa escura com o ✻ (a documentação)'],
    [T.pesa, 'pesa nos braços'],
    [T.abre, 'abre o livro na frente dele: só os olhos por cima'],
    [T.ler, 'lê: os olhos vão e voltam nas linhas; vira a página a cada 6,5–10,5 s'],
    [T.ler + PRIMEIRA.vira, 'vira a página (a folha levanta, fica em pé e passa pro outro lado)'],
    [T.ler + PRIMEIRA.ideia, 'uma ideia: o ✻ gira em cima da cabeça, acende a lâmpada e ele dá um pulinho'],
    [T.ler + J + PRIMEIRA.cochilo, 'fica com sono: pisca devagar...'],
    [T.ler + J + PRIMEIRA.cochilo + 3, '...e cochila (sorteado): afunda a cara no livro, fecha o livro e dorme abraçado nele, ou quase dorme e se pega'],
    [T.ler + J + PRIMEIRA.cochilo + 4.3 + PRIMEIRA.dorme, 'acorda num susto (pulinho e "!"); se fechou o livro, reabre e folheia rápido procurando onde estava'],
    [T.ler + 2 * J + PRIMEIRA.marca, 'marca-texto: olha uma linha e ela fica amarela'],
    [T.ler + 3 * J, `depois: janelas de ${J} s sorteadas (ideia, marca-texto ou nada); ~1 em 5 cochila, nunca duas seguidas`],
  ],
  cena(m) {
    const sem = Math.floor(m.sorteio() * 4294967296);
    sementes.set(m, sem);
    return {
      nome: 'parado', dur: Infinity, espaco: { frente: 0, tras: 0 }, modos: ['parado'],
      quadro(g, t) { quadro(g, sem, t); },
    };
  },
  saida: { dur: SAIDA.fim, quadro: saida },
  // pros testes: o plano da janela k, a pose em t, os tempos
  plano, pose, J, T, PRIMEIRA,
};
