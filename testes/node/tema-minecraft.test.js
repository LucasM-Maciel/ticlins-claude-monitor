'use strict';
// motor/tema-minecraft.js (+ minecraft-enfeites/kit/eventos.js): os eventos da prévia 2 quadro a
// quadro nas escalas 1, 1,25 e 2 sem erro; mesmo instante = mesmos bytes; o custo; os enfeites
// iguais aos da janelinha WPF; e as regras do sorteio (1 em 2 nas paradas, raridade, noite,
// Alex/Herobrine, nível a cada 5 mortes, dragão a cada 20 só se o minecraft-dragao.js existir).
// Texturas: as da Mojang na pasta CM_TEXTURAS, se existir; as que faltarem (o CI não tem
// nenhuma) viram texturas de mentira do tamanho certo, que passam pelo mesmo código. Sem
// textura nenhuma, num processo à parte: nada quebra e enfeites = false.
// Ver a olho: node testes/motor-foto.js --tema minecraft --pasta <texturas> --cena zumbi --tira 0,1,2 --zoom 3 --saida f.png
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const { Tela } = require(path.join(MOTOR, 'raster'));
const { IMG, carregarTexturas, layoutDe, sortearPeso } = require(path.join(MOTOR, 'comum'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const tema = require(path.join(MOTOR, 'tema-minecraft'));
const { EV } = require(path.join(MOTOR, 'minecraft-eventos'));
const { estadoDeMentira, fotografar } = require('../motor-foto');

const VAZIA = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-mc-'));
const PASTA = process.env.CM_TEXTURAS && fs.existsSync(process.env.CM_TEXTURAS) ? process.env.CM_TEXTURAS : VAZIA;
const REAIS = PASTA !== VAZIA;
// a de mentira: pixels opacos que mudam a cada pixel; a letra com "glifos" de 5 colunas
function deMentira(nome) {
  const [w, h] = /^xp_/.test(nome) ? [182, 5] : nome === 'fonte' ? [128, 128]
    : /^(zumbi|creeper|esqueleto|aranha|slime|silverfish|enderman|lobo|galinha|orbe|escudo)/.test(nome) ? [64, 64]
      : /^(explosao|varrida|flecha)/.test(nome) ? [32, 32] : [16, 16];
  const t = new Tela(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (nome === 'fonte' && !(x % 8 < 5 && y % 8 < 7 && (x + y) % 2 === 0)) continue;
    const v = 128 + ((x * y) % 100);  // o orbe é cinza (o jogo pinta)
    t.pixels[y * w + x] = (0xFF000000 | (nome === 'orbe' ? v * 0x10101 : (x * 2654435761 + y * 40503 + nome.length * 977) & 0xFFFFFF)) >>> 0;
  }
  return t;
}
const faltando = carregarTexturas(PASTA, tema.texturas);
for (const n of faltando) IMG[n] = deMentira(n);
for (const n of tema.texturas) if (!IMG[n]) IMG[n] = deMentira(n);

function novoMundo({ modo = 'andando', semente = 7, escala = 1, hora = 12, pasta = null } = {}) {
  const m = new Mundo({ tema, semente, pasta, relogio: () => new Date(2026, 9, 5, hora, 0, 0) });
  m.erros = [];
  m.aoErro = e => m.erros.push(e);
  m.receber({ ...estadoDeMentira('minecraft', modo), escala });
  m.dist = 70;  // no meio da reta de cima, com espaço
  return m;
}
function quadro(m, tela, escala) {
  const g = tela.getContext('2d');
  tela.limpar();
  g.setTransform(escala, 0, 0, escala, 0, 0);
  g.globalAlpha = 1;
  m.desenhar(g);
}
const telaDa = escala => new Tela(Math.round(380 * escala), Math.round(440 * escala));
// a cena inteira, quadro a quadro (30/s); cada(T, ms) depois de cada quadro
function rodarCena(nome, escala, cada) {
  const m = novoMundo({ escala }), tela = telaDa(escala);
  m.comecarCena(tema.cenaPorNome(m, nome));
  assert.ok(m.cena, `a cena ${nome} não começou`);
  const dur = m.cena.dur;
  for (let k = 0; k <= Math.ceil(dur * 30); k++) {
    m.passo(k / 30);
    const ini = process.hrtime.bigint();
    quadro(m, tela, escala);
    if (cada) cada(k / 30, Number(process.hrtime.bigint() - ini) / 1e6, tela);
  }
  return m;
}
const px = (tela, x, y) => tela.pixels[y * tela.width + x];
// o pincel em ladrilho do WPF: bilinear no centro do pixel (x, y em DIPs a partir do canto do
// cartão; o bloco tem 32), dando a volta na beira da textura
function ladrilhoWPF(img, x, y) {
  const tw = img.width, th = img.height, u = x * tw / 32 - 0.5, v = y * th / 32 - 0.5, u0 = Math.floor(u), v0 = Math.floor(v), fu = u - u0, fv = v - v0;
  const t = (i, j) => px(img, ((i % tw) + tw) % tw, ((j % th) + th) % th);
  let p = 0;
  for (let s = 0; s < 32; s += 8) {
    const c = q => (q >>> s) & 255;
    p += Math.round(c(t(u0, v0)) * (1 - fu) * (1 - fv) + c(t(u0 + 1, v0)) * fu * (1 - fv) + c(t(u0, v0 + 1)) * (1 - fu) * fv + c(t(u0 + 1, v0 + 1)) * fu * fv) * 2 ** s;
  }
  return p;
}

test('o tema: layout dos enfeites, trilha e os eventos da prévia', () => {
  assert.deepStrictEqual(tema.cenas.slice().sort(), ['aranha', 'creeper', 'enderman', 'esqueleto', 'galinha', 'lobo', 'mineracao', 'slime', 'totem', 'traca', 'zumbi']);
  const L = layoutDe(tema);
  assert.deepStrictEqual(L, {
    raio: 0, fundo: '#F0181818', moldura: [6, 8, 6, 6], padding: [8, 6, 8, 6], enfeites: true,
    colunas: { tempo: 44, pct: 38, falta: 56, rotulo: 18 }, letra: 11, barra: [118, 5],
  });
  assert.strictEqual(tema.trilha.raio, 1);
  for (const n of ['terra', 'grama', 'orbe', 'xp_fundo', 'xp_barra', 'fonte', 'zumbi', 'rocha', 'racha9', 'explosao15']) assert.ok(tema.texturas.includes(n), n);
  // cada textura do tema (fora as do dragão, que vêm com ele) a janelinha sabe baixar
  const { TEXTURAS } = require('../../extensao/janelinha/minecraft.js');
  let doDragao = [];
  try { doDragao = require(path.join(MOTOR, 'minecraft-dragao')).texturas || []; } catch { /* ainda não existe */ }
  assert.deepStrictEqual(tema.texturas.filter(n => !(n in TEXTURAS) && !doDragao.includes(n)), []);
  // enfeites só com as 6 texturas deles
  const fonte = IMG.fonte;
  delete IMG.fonte;
  try { assert.strictEqual(layoutDe(tema).enfeites, false); } finally { IMG.fonte = fonte; }
});

test('sem textura nenhuma: nada quebra, enfeites = false, moldura nas cores da janelinha e nenhum evento é sorteado', () => {
  const script = `
    const path = require('path');
    const MOTOR = ${JSON.stringify(MOTOR)};
    const { Tela } = require(path.join(MOTOR, 'raster'));
    const { layoutDe, carregarTexturas } = require(path.join(MOTOR, 'comum'));
    const { Mundo } = require(path.join(MOTOR, 'mundo'));
    const tema = require(path.join(MOTOR, 'tema-minecraft'));
    const { estadoDeMentira } = require(${JSON.stringify(path.join(__dirname, '..', 'motor-foto'))});
    carregarTexturas(${JSON.stringify(VAZIA)}, tema.texturas);
    const erros = [], r = { cenas: 0, quadros: 0 };
    const novo = () => { const m = new Mundo({ tema, semente: 3 }); m.aoErro = e => erros.push(e); m.receber({ ...estadoDeMentira('minecraft', 'andando'), escala: 1.25 }); m.dist = 70; return m; };
    const tela = new Tela(475, 550), g = tela.getContext('2d');
    const desenha = m => { tela.limpar(); g.setTransform(1.25, 0, 0, 1.25, 0, 0); m.desenhar(g); r.quadros++; };
    for (const nome of tema.cenas) {
      const m = novo();
      m.comecarCena(tema.cenaPorNome(m, nome));
      const dur = m.cena.dur;
      for (let k = 0; k <= dur * 30; k += 2) { m.passo(k / 30); desenha(m); }
      if (m.ruins.size) erros.push('quebrou: ' + [...m.ruins]);
    }
    // 20 min andando: as paradas acontecem, mas sem as texturas nenhum evento sai
    const m = novo();
    for (let T = 0.2; T < 1200; T += 0.2) { m.passo(T); if (m.cena) r.cenas++; }
    desenha(m);
    const [x, y] = m.host.cartao.map(v => Math.round(v * 1.25));
    const rgba = p => [(p >>> 16) & 255, (p >>> 8) & 255, p & 255, p >>> 24];
    r.terra = rgba(tela.pixels[(y + 30) * 475 + x + 2]);
    r.grama = rgba(tela.pixels[(y + 2) * 475 + x + 40]);
    r.enfeites = layoutDe(tema).enfeites;
    r.erros = erros;
    process.stdout.write(JSON.stringify(r));
  `;
  const p = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 120000 });
  assert.strictEqual(p.status, 0, p.stderr);
  const r = JSON.parse(p.stdout);
  assert.deepStrictEqual(r.erros, []);
  assert.ok(r.quadros > 800, `desenhou só ${r.quadros} quadros`);
  assert.strictEqual(r.enfeites, false);
  assert.strictEqual(r.cenas, 0, 'sorteou evento sem as texturas');
  assert.deepStrictEqual(r.terra, [0x86, 0x60, 0x43, 255], 'borda sem textura: #866043');
  assert.deepStrictEqual(r.grama, [0x5D, 0x9C, 0x36, 255], 'grama sem textura: #5D9C36');
});

const TEMPOS = {};  // ms de cada quadro em 1,25 (o teste de custo aproveita como 1ª passada)
test('toda cena, quadro a quadro (30/s) a duração inteira, sem erro, nas escalas 1, 1,25 e 2', () => {
  for (const escala of [1, 1.25, 2]) {
    for (const nome of tema.cenas) {
      let pintou = 0;
      const tempos = [];
      const m = rodarCena(nome, escala, (T, ms, tela) => { tempos.push(ms); if (T === 1) pintou = tela.pixels.reduce((s, p) => s + (p !== 0), 0); });
      if (escala === 1.25) TEMPOS[nome] = tempos;
      assert.deepStrictEqual(m.erros, [], `${nome} em ${escala}`);
      assert.strictEqual(m.ruins.size, 0, `${nome} em ${escala}`);
      assert.strictEqual(m.cena, null, `${nome} em ${escala}: não acabou na duração`);
      assert.ok(pintou > 2000 * escala * escala, `${nome} em ${escala}: pintou pouco (${pintou})`);
    }
  }
});

test('mesmo instante = mesmos bytes (de novo, e pulando quadros)', () => {
  for (const [cena, t] of [['zumbi', 2.42], ['creeper', 3.15], ['totem', 3.4], ['enderman', 1.4], ['lobo', 2.4], ['mineracao', 2.2], [null, 1.3]]) {
    const a = fotografar({ tema: 'minecraft', cena, t, escala: 1.25, pasta: PASTA });
    const b = fotografar({ tema: 'minecraft', cena, t, escala: 1.25, pasta: PASTA });
    assert.ok(a.bgra().equals(b.bgra()), `${cena} em ${t}`);
  }
  // o motor pode pular quadros: o quadro é função do tempo da cena
  for (const [nome, t] of [['slime', 3.6], ['esqueleto', 6.1], ['aranha', 2.5]]) {
    const telas = [1 / 30, 0.25].map(passo => {
      const m = novoMundo({ escala: 1.25 }), tela = telaDa(1.25);
      m.comecarCena(tema.cenaPorNome(m, nome));
      for (let T = passo; T < t; T += passo) m.passo(T);
      m.passo(t);
      quadro(m, tela, 1.25);
      return tela;
    });
    assert.ok(telas[0].bgra().equals(telas[1].bgra()), `${nome} em ${t}`);
  }
});

test('custo: quadro típico abaixo de 4 ms e pior quadro abaixo de 12 ms em escala 1,25 (falha só em 16 / 48)', (t) => {
  const escala = 1.25, tela = telaDa(escala);
  // típico: enfeites + o Clawd andando (sem parada)
  const m = novoMundo({ escala });
  m.proxima = Infinity;
  for (let k = 0; k < 30; k++) { m.passo(k / 30); quadro(m, tela, escala); }  // aquece o JIT
  const rodadas = [];
  for (let r = 0; r < 7; r++) {
    const ini = process.hrtime.bigint();
    for (let k = 0; k < 30; k++) { m.passo(1 + r + k / 30); quadro(m, tela, escala); }
    rodadas.push(Number(process.hrtime.bigint() - ini) / 1e6 / 30);
  }
  const tipico = rodadas.sort((a, b) => a - b)[3];
  // pior quadro de cada cena: o menor de 3 passadas (a máquina oscila; o GC cai em qualquer quadro)
  const linhas = [];
  let pior = 0;
  for (const nome of tema.cenas) {
    const tempos = TEMPOS[nome] ? TEMPOS[nome].slice() : [];
    for (let r = 0; r < (TEMPOS[nome] ? 2 : 3); r++) {
      let k = 0;
      rodarCena(nome, escala, (T, ms) => { tempos[k] = tempos[k] == null ? ms : Math.min(tempos[k], ms); k++; });
    }
    const p = Math.max(...tempos);
    pior = Math.max(pior, p);
    linhas.push(`${nome} ${p.toFixed(1)}`);
  }
  t.diagnostic(`típico ${tipico.toFixed(2)} ms (melhor ${rodadas[0].toFixed(2)}); pior quadro por cena: ${linhas.join(', ')}`);
  assert.ok(tipico < 16, `típico ${tipico.toFixed(2)} ms (alvo 4)`);
  assert.ok(pior < 48, `pior quadro ${pior.toFixed(2)} ms (alvo 12)`);
});

test('enfeites iguais aos da janelinha: terra com grama e sombra, barra de XP, orbe pintado, números à direita', () => {
  const m = novoMundo({ escala: 1 }), tela = telaDa(1);
  m.proxima = Infinity;
  m.passo(0);
  quadro(m, tela, 1);
  const [x, y, w, h] = m.host.cartao;
  // terra e grama em blocos de 32 a partir do canto do cartão, suavizados como o WPF pinta
  // o pincel em ladrilho (a 1ª fileira da grama mistura com a última da textura: dá a volta)
  for (const [i, j] of [[1, 20], [w - 2, 40], [3, h - 1], [w - 6, 100]]) assert.strictEqual(px(tela, x + i, y + j), ladrilhoWPF(IMG.terra, i + 0.5, j + 0.5), `terra em ${i},${j}`);
  for (const [i, j] of [[3, 0], [40, 3], [w - 1, 7]]) assert.strictEqual(px(tela, x + i, y + j), ladrilhoWPF(IMG.grama, i + 0.5, j + 0.5), `grama em ${i},${j}`);
  assert.strictEqual(px(tela, x + 6, y + 20), 0, 'a borda do lado tem 6');
  const sombra = px(tela, x + 30, y + 8);
  assert.strictEqual(sombra >>> 24, 0x59, 'sombra #59000000 logo abaixo da grama');
  assert.strictEqual(sombra & 0xFFFFFF, 0);
  assert.strictEqual(px(tela, x + 30, y + 9), 0, 'o miolo é da janelinha');
  // barra: 38% de 118 = 44,84 -> 45 colunas cheias (o resto é o fundo); 85% (nível 1) é dourada
  const [u0, u1] = m.host.uso, [bx, by] = u0.barra;
  if (px(IMG.xp_barra, 44, 2) >>> 24 === 255) assert.strictEqual(px(tela, bx + 44, by + 2), px(IMG.xp_barra, 44, 2));
  assert.strictEqual(px(tela, bx + 45, by + 2), px(IMG.xp_fundo, 45, 2));
  assert.strictEqual(px(tela, bx + 117, by + 2), px(IMG.xp_fundo, 181, 2), 'a ponta é a última coluna da textura');
  const ouro = px(tela, u1.barra[0] + 50, u1.barra[1] + 2), [r, g, b] = [(ouro >>> 16) & 255, (ouro >>> 8) & 255, ouro & 255];
  assert.ok(r >= g && g >= b && r > b, `barra dourada: ${[r, g, b]}`);
  // orbe: o da sessão terminada é vermelho; o de quem trabalha muda de cor com o tempo
  const [l0, l1] = m.host.linhas, meio = l => [l.bola[0] + 4, l.bola[1] + 4];
  const verm = px(tela, ...meio(l1));
  assert.ok(((verm >>> 16) & 255) > ((verm >>> 8) & 255), 'orbe da sessão terminada (#EF4444)');
  const antes = px(tela, ...meio(l0));
  m.passo(0.157);
  quadro(m, tela, 1);
  assert.notStrictEqual(px(tela, ...meio(l0)), antes, 'orbe de quem trabalha anima');
  // tempo encostado à direita da caixa, centrado na altura
  const [cx, cy, cw, ch] = l0.tempo.caixa;
  let direita = -1, cima = Infinity, baixo = -1;
  for (let yy = Math.floor(cy) - 3; yy < cy + ch + 3; yy++) for (let xx = cx; xx < cx + cw + 4; xx++) if (px(tela, xx, yy) >>> 24) { direita = Math.max(direita, xx); cima = Math.min(cima, yy); baixo = Math.max(baixo, yy); }
  assert.ok(direita >= cx + cw - 3 && direita <= cx + cw + 1, `tempo termina em ${direita}, caixa até ${cx + cw}`);
  assert.ok(cima >= cy - 2 && baixo <= cy + ch + 1 && baixo - cima >= 8, `tempo de ${cima} a ${baixo}, caixa de ${cy} a ${cy + ch}`);
});

test('1 em 2 nas paradas; só em cima ou embaixo do cartão; sorteado e sem espaço, espera em vez de sortear de novo', () => {
  const m = novoMundo({ semente: 11 });
  let cenas = 0;
  const N = 4000;
  for (let i = 0; i < N; i++) {
    m.estado.pendente = null;
    const c = tema.naParada(m);
    if (c) { cenas++; assert.ok(EV[c.nome] && !EV[c.nome].especial, c.nome); } else assert.strictEqual(c, null);
  }
  assert.ok(Math.abs(cenas / N - 0.5) < 0.03, `${cenas} de ${N}`);
  // sem espaço (o Mundo tenta de novo em 0,5 s): devolve a mesma cena
  m.estado.pendente = null;
  let c;
  do c = tema.naParada(m); while (!c);
  assert.strictEqual(tema.naParada(m), c);
  // no lado direito do cartão: "tenta já já" (undefined), sem gastar o sorteio
  const [, , w] = m.host.cartao;
  m.dist = w + 20;
  m.estado.pendente = null;
  assert.strictEqual(tema.naParada(m), undefined);
});

test('raros mais raros (comum 4 : incomum 2 : raro 1), nunca o anterior, e de noite mais hostis', () => {
  const dia = { zumbi: 4, esqueleto: 4, creeper: 4, aranha: 4, mineracao: 4, slime: 2, traca: 2, lobo: 2, galinha: 2, enderman: 1 };
  const m = novoMundo({ semente: 5 });
  assert.deepStrictEqual(tema.pesosDosEventos(m), dia);
  // a frequência de verdade bate com os pesos
  const N = 29000, conta = {};
  for (let i = 0; i < N; i++) { const id = sortearPeso(tema.pesosDosEventos(m), m.sorteio); conta[id] = (conta[id] || 0) + 1; }
  for (const [id, p] of Object.entries(dia)) assert.ok(Math.abs(conta[id] / N - p / 29) < 0.012, `${id}: ${conta[id]} de ${N} (esperado ${p}/29)`);
  m.estado.ultimo = 'zumbi';
  assert.ok(!('zumbi' in tema.pesosDosEventos(m)), 'nunca repete o anterior');
  // de noite (22h-6h): hostis x3, pacíficos x0,3, o enderman x2 a mais
  const noite = novoMundo({ hora: 23 });
  const pn = tema.pesosDosEventos(noite);
  assert.deepStrictEqual(Object.fromEntries(Object.entries(pn).map(([k, v]) => [k, +v.toFixed(2)])),
    { zumbi: 12, esqueleto: 12, creeper: 12, aranha: 12, mineracao: 4, slime: 6, traca: 6, lobo: 0.6, galinha: 0.6, enderman: 6 });
  assert.ok(novoMundo({ hora: 5 }).noite() && !novoMundo({ hora: 6 }).noite());
  // sem a textura de um evento, ele sai do sorteio
  const galinha = IMG.galinha;
  delete IMG.galinha;
  try { assert.ok(!('galinha' in tema.pesosDosEventos(m))); } finally { IMG.galinha = galinha; }
});

test('roupa sorteada a cada volta no cartão: Steve, Alex ~1 em 10, Herobrine ~1 em 50', () => {
  const m = novoMundo({ semente: 21 }), conta = { mc_steve: 0, mc_alex: 0, mc_herobrine: 0 }, N = 20000;
  for (let i = 0; i < N; i++) { tema.aoDarVolta(m); conta[m.roupa]++; }
  assert.ok(Math.abs(conta.mc_herobrine / N - 0.02) < 0.005, `Herobrine ${conta.mc_herobrine} de ${N}`);
  assert.ok(Math.abs(conta.mc_alex / N - 0.098) < 0.012, `Alex ${conta.mc_alex} de ${N}`);
  // de verdade: começar a andar não sorteia; a 1ª volta inteira andada (com as paradas no meio), sim
  const r = novoMundo({ modo: 'parado', semente: 1 });
  r.roupa = null;
  r.receber({ modo: 'andando' });
  assert.strictEqual(r.roupa, null, 'começar a andar não sorteia');
  let T = 0;
  for (; T < 300 && r.roupa === null; T += 1 / 30) r.passo(T);
  assert.ok(['mc_steve', 'mc_alex', 'mc_herobrine'].includes(r.roupa), `roupa ${r.roupa} em ${T.toFixed(1)} s`);
  assert.ok(T >= r.perimetro() / 50, `sorteou em ${T.toFixed(1)} s, antes de uma volta (${(r.perimetro() / 50).toFixed(1)} s)`);
  assert.deepStrictEqual(r.erros, []);
  // o Herobrine tem os olhos brancos que brilham
  assert.ok(tema.roupas.mc_herobrine.brilho && tema.roupas.mc_herobrine.linhas.some(l => l.includes('g')));
});

test('nível a cada 5 mortes, guardado em motor-estado.json (sobrevive a reabrir); cortada antes da morte não conta', () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-mc-nivel-'));
  try {
    const m = novoMundo({ pasta });
    for (let i = 1; i <= 5; i++) {
      m.comecarCena(tema.cenaPorNome(m, 'zumbi'));
      const c = m.cena;
      assert.strictEqual(c.ctx.sobe, i === 5, `a ${i}ª morte ${i === 5 ? '' : 'não '}sobe de nível`);
      assert.strictEqual(c.ctx.nivel, i === 5 ? 1 : 0);
      const T0 = m.T;
      for (let T = T0 + 0.1; m.cena; T += 0.1) m.passo(T);
      assert.strictEqual(m.salvo.mortes, i);
    }
    assert.strictEqual(tema.nivel(m), 1);
    const slime = tema.cenaPorNome(m, 'slime');
    assert.ok(slime.ctx.sobe === false && slime.ctx.nivel === 1, 'o slime mata 4: de 5 pra 9, continua no 1');
    // reabriu
    const reaberto = novoMundo({ pasta });
    assert.strictEqual(reaberto.salvo.mortes, 5);
    assert.strictEqual(tema.nivel(reaberto), 1);
    // pergunta no meio (pulando) antes da espadada final: a morte não conta, o tapa sim
    reaberto.comecarCena(tema.cenaPorNome(reaberto, 'zumbi'));
    const vida = reaberto.estado.vida, T0 = reaberto.T;
    for (let T = T0 + 0.1; T < T0 + 2.5; T += 0.1) reaberto.passo(T);
    reaberto.receber({ modo: 'pulando' });
    assert.strictEqual(reaberto.cena, null);
    assert.strictEqual(reaberto.salvo.mortes, 5);
    assert.strictEqual(reaberto.estado.vida, vida - 2, 'o tapa do zumbi (1 coração) já tinha acontecido');
  } finally { fs.rmSync(pasta, { recursive: true, force: true }); }
});

test('vida: dano dos mobs, regenera fora de cena; o totem salva quando a explosão mataria', () => {
  const m = novoMundo();
  const ate = (T1) => { for (let T = m.T + 0.1; T <= T1 + 1e-9; T += 0.1) m.passo(T); };
  const fim = () => { for (let T = m.T + 0.1; m.cena; T += 0.1) m.passo(T); };
  m.comecarCena(tema.cenaPorNome(m, 'creeper'));
  assert.strictEqual(m.cena.evento.totem, false, 'vida cheia: a explosão tira 4 corações, não mata');
  fim();
  assert.strictEqual(m.estado.vida, 2);
  m.comecarCena(tema.cenaPorNome(m, 'creeper'));
  assert.strictEqual(m.cena.evento.totem, true, 'com 1 coração a explosão mataria: totem');
  fim();
  assert.deepStrictEqual([m.estado.vida, m.estado.ouro], [1, 4]);
  ate(m.T + 6);
  assert.strictEqual(m.estado.ouro, 0, 'os corações dourados somem em 5 s');
  assert.ok(m.estado.vida > 2.4 && m.estado.vida < 2.6, `regenera meio coração a cada 4 s: ${m.estado.vida}`);
});

test('lobo: vira pet e segue o Clawd 25 s, atrás dele na trilha', () => {
  const m = novoMundo({ escala: 1 }), tela = telaDa(1);
  m.comecarCena(tema.cenaPorNome(m, 'lobo'));
  for (let T = 0.1; m.cena; T += 0.1) m.passo(T);
  assert.ok(m.estado.petAte > m.T + 24.5);
  m.proxima = Infinity;
  m.passo(m.T + 0.1);
  quadro(m, tela, 1);
  const p = m.poseEm(-30);
  let pet = 0;
  for (let y = Math.round(p.y) - 14; y < p.y; y++) for (let x = Math.round(p.x) - 14; x < p.x + 14; x++) pet += px(tela, x, y) !== 0;
  assert.ok(pet > 40, `o lobo atrás do Clawd (${pet} px)`);
  for (let T = m.T + 0.1, fim = m.T + 26; T < fim; T += 0.1) { m.proxima = Infinity; m.passo(T); }
  assert.ok(m.estado.petAte < m.T, 'depois de 25 s ele vai embora');
});

test('Ender Dragon: a cada 20 mortes, na próxima parada, só se o minecraft-dragao.js existir (e as texturas dele)', () => {
  const falso = { texturas: ['espada'], cena: () => ({ nome: 'dragao', dur: 2, espaco: { frente: 0, tras: 0 }, quadro() {} }) };
  const matar = (m) => { m.comecarCena(tema.cenaPorNome(m, 'zumbi')); for (let T = m.T + 0.1; m.cena; T += 0.1) m.passo(T); };
  try {
    // sem o arquivo: a parada segue normal e o pedido some
    tema.trocarDragao(null);
    let m = novoMundo();
    m.salvo.mortes = 19;
    matar(m);
    assert.strictEqual(m.salvo.dragao, true, 'a 20ª morte pede o dragão');
    const c = tema.naParada(m);
    assert.ok(!c || c.nome !== 'dragao');
    assert.strictEqual(m.salvo.dragao, false);
    // com o arquivo mas sem as texturas dele: igual
    tema.trocarDragao({ ...falso, texturas: ['textura_que_nao_existe'] });
    m.salvo.dragao = true;
    assert.ok(!(tema.naParada(m) || {}).dragao);
    // com tudo: a próxima parada é o dragão, mesmo no lado do cartão e sem o "1 em 2"
    tema.trocarDragao(falso);
    m = novoMundo();
    m.salvo.mortes = 38;
    matar(m);
    assert.strictEqual(m.salvo.dragao, undefined, '39 mortes: ainda não');
    matar(m);
    assert.strictEqual(m.salvo.dragao, true, '40 mortes: dragão');
    const d = tema.naParada(m);
    assert.ok(d && d.nome === 'dragao' && d.dragao);
    assert.strictEqual(tema.naParada(m).nome, 'dragao', 'sem espaço: continua sendo o dragão');
    m.comecarCena(d);
    assert.strictEqual(m.salvo.dragao, false);
    // cortado antes de subir nível (pergunta no meio): não gasta, volta na próxima parada (dono 07/10)
    m.passo(m.T + 0.5);
    m.receber({ modo: 'pulando' });
    assert.strictEqual(m.cena, null);
    assert.strictEqual(m.salvo.dragao, true, 'cortado: o pedido volta');
    m.receber({ modo: 'andando' });
    const deNovo = tema.naParada(m);
    assert.ok(deNovo && deNovo.dragao, 'na próxima parada: o dragão de novo');
    // até o fim: gasta
    m.comecarCena(deNovo);
    for (let T = m.T + 0.1; m.cena; T += 0.1) { m.proxima = Infinity; m.passo(T); }
    assert.strictEqual(m.salvo.dragao, false);
    // quebrou: não volta
    m.salvo.dragao = true;
    m.comecarCena(tema.naParada(m));
    m.ruins.add('dragao'); m.fimCena(true);  // o que o Mundo faz quando o quadro da cena dá erro
    assert.strictEqual(m.salvo.dragao, false, 'quebrado: não pede de novo');
  } finally { tema.trocarDragao(undefined); }
});

test('Ender Dragon: os níveis que a cena mostra subindo ficam (dono 06/10); cortada, só os que já subiram', () => {
  const falso = { texturas: ['espada'], cena: () => ({ nome: 'dragao', dur: 4, espaco: { frente: 0, tras: 0 }, subidas: [1, 2, 3], quadro() {} }) };
  try {
    tema.trocarDragao(falso);
    const m = novoMundo();
    m.salvo.mortes = 10;
    m.comecarCena(tema.cenaPorNome(m, 'dragao'));
    for (let T = m.T + 0.1; m.cena; T += 0.1) {
      m.passo(T);
      if (m.cena) assert.strictEqual(tema.nivel(m), 2, 'durante a cena o nível de partida não muda (a cena soma por cima)');
    }
    assert.strictEqual(tema.nivel(m), 5, '2 (10 mortes) + 3 do dragão');
    assert.strictEqual(tema.cenaPorNome(m, 'galinha').ctx.nivel, 5, 'os eventos mostram o nível com o do dragão');
    m.comecarCena(tema.cenaPorNome(m, 'dragao'));
    const T0 = m.T;
    for (let T = T0 + 0.1; T < T0 + 2.5; T += 0.1) m.passo(T);
    m.receber({ modo: 'pulando' });
    assert.strictEqual(m.cena, null);
    assert.strictEqual(tema.nivel(m), 7, 'cortada em 2,5 s: só as 2 subidas que já tinham acontecido');
    assert.strictEqual(m.salvo.dragao, false, 'cortado depois de subir nível: já valeu, não volta');
  } finally { tema.trocarDragao(undefined); }
});

test('mineração: o minério é sorteado com os pesos da prévia (diamante 4%)', () => {
  const m = novoMundo({ semente: 9 }), conta = {}, N = 5000;
  for (let i = 0; i < N; i++) { const id = tema.cenaPorNome(m, 'mineracao').evento.minerio.id; conta[id] = (conta[id] || 0) + 1; }
  for (const [id, p] of Object.entries({ carvao: 30, ferro: 22, ouro: 12, redstone: 12, lapis: 10, esmeralda: 6, diamante: 4 })) {
    assert.ok(Math.abs(conta[id] / N - p / 96) < 0.02, `${id}: ${conta[id]} de ${N}`);
  }
  assert.strictEqual(tema.cenaPorNome(m, 'mineracao:diamante').evento.minerio.bloco, 'pedra', 'o minério de diamante é a "pedra" da janelinha');
});

test.after(() => fs.rmSync(VAZIA, { recursive: true, force: true }));
if (!REAIS) test('(texturas de mentira: as fotos só valem com CM_TEXTURAS apontando pras da Mojang)', () => {});
