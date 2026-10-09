'use strict';
// motor/dragonball-epico-ssj4.js (o épico da lua cheia do tema Dragon Ball: a cada 150 voltas no
// cartão, o Clawd vira macaco dourado gigante e volta no SSJ 4, que fica 2 min) e
// motor/dragonball-pedido.js (o dragão das 7 esferas para no ar e realiza um pedido do Clawd,
// 4 em rodízio). O épico quadro a quadro em 3 escalas e 2 cartões, mesmo instante = mesmos
// bytes, o custo, o último quadro (o Clawd SSJ 4 no lugar), a trilha, o plano (o macaco e a lua
// dentro do palco em 50 sementes) e as regras (a contagem das voltas, a espera, cortado antes e
// depois do clarão, quebrado, os 2 min) e o visual escolhido (a fera, também meditando). O
// pedido: o rodízio salvo, os 4 inteiros, a cabeça do dragão olhando pro Clawd, as barras
// douradas só no desenho e a trilha.
// Ver a olho: node testes/motor-foto.js --tema dragonball --cena ssj4 --tira 2,5.5,7,8.4,10,12.6 --escala 1.25 --saida f.png
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const epico = require(path.join(MOTOR, 'dragonball-epico-ssj4'));
const Mc = require(path.join(MOTOR, 'dragonball-macaco'));
const A = require(path.join(MOTOR, 'dragonball-arte'));
const K = require(path.join(MOTOR, 'dragonball-cartao'));
const Pd = require(path.join(MOTOR, 'dragonball-pedido'));
const { Tela } = require(path.join(MOTOR, 'raster'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const { lerWav } = require(path.join(MOTOR, 'som'));
const tema = require(path.join(MOTOR, 'tema-dragonball'));
const { estadoDeMentira } = require('../motor-foto');

const JANELINHA = path.join(MOTOR, '..');
const LUTAS = ['onda', 'teleporte', 'nuvem', 'genki', 'rastreador'];
// um Mundo com o Clawd andando na reta de cima (fração 'onde' dela), sem transformação, e a
// cena (o épico, pelo tema) começando em T = 0
function novoMundo({ escala = 1, onde = 0.5, semente = 7, sessoes = 4, modo = 'andando', pasta = null, cena = mm => tema.cenaPorNome(mm, 'ssj4') } = {}) {
  const m = new Mundo({ tema, semente, pasta });
  m.erros = [];
  m.aoErro = e => m.erros.push(e);
  m.receber({ ...estadoDeMentira('dragonball', modo, { sessoes }), escala });
  if (m.cena) m.fimCena(true);
  m.estado.tr = null;
  const g = m.geometria();
  m.dist = (g.w - 2 * g.r) * onde;
  m.proxima = Infinity;
  if (cena) m.comecarCena(cena(m));
  return m;
}
const telaDa = escala => new Tela(Math.round(380 * escala), Math.round(440 * escala));
function quadro(m, tela, escala) {
  const g = tela.getContext('2d');
  tela.limpar();
  g.setTransform(escala, 0, 0, escala, 0, 0);
  g.globalAlpha = 1;
  m.desenhar(g);
}
const passo = (m, T) => { m.passo(T); m.proxima = Infinity; };
const comPasta = f => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-ssj4-'));
  try { f(pasta); } finally { fs.rmSync(pasta, { recursive: true, force: true }); }
};
const salvoEm = pasta => JSON.parse(fs.readFileSync(path.join(pasta, 'motor-estado.json'), 'utf8'));

// ============================== o épico ==============================
test('o módulo: linha do tempo e a cena no formato combinado (14 a 20 s, reta de cima, só andando)', () => {
  assert.ok(Array.isArray(epico.linhaDoTempo) && epico.linhaDoTempo.length >= 6);
  for (const [t, txt] of epico.linhaDoTempo) assert.ok(typeof t === 'number' && typeof txt === 'string' && txt.length);
  const c = epico.cena(novoMundo({ cena: null }));
  assert.ok(c.dur >= 14 && c.dur <= 20, `dur ${c.dur}`);
  assert.ok(c.revela > 0 && c.revela < c.dur);
  assert.deepStrictEqual(c.espaco, { frente: 0, tras: 0 });
  assert.deepStrictEqual(c.modos, ['andando']);
  assert.strictEqual(typeof c.quadro, 'function');
});

test('pelo tema: o ssj4 é este épico, está na lista das cenas e não entra no sorteio da transformação', () => {
  const m = novoMundo();
  assert.strictEqual(m.cena.nome, 'ssj4');
  assert.ok(m.cena.epico);
  assert.strictEqual(m.cena.dur, epico.T.dur);
  assert.ok(tema.cenas.includes('ssj4'));
  assert.ok(!A.VARIACOES.some(v => v.id === 'ssj4'), 'o SSJ 4 só vem pela lua');
  assert.strictEqual(tema.voltasPorLua, 150);
  assert.strictEqual(tema.duraSSJ4, 120);
});

test('a cena inteira, quadro a quadro (30/s), nas escalas 1, 1,25 e 2 e em 2 cartões: sem erro, pintando, acaba e ele fica SSJ 4', () => {
  for (const escala of [1, 1.25, 2]) {
    for (const { sessoes, onde } of [{ sessoes: 4, onde: 0.5 }, { sessoes: 8, onde: 0.1 }]) {
      const tela = telaDa(escala), m = novoMundo({ escala, sessoes, onde }), dur = m.cena.dur, onde_ = `escala ${escala}, ${sessoes} sessões`;
      let meio = 0;
      for (let n = 1; n / 30 < dur; n++) {
        passo(m, n / 30);
        assert.ok(m.cena && m.cena.nome === 'ssj4', `acabou antes da hora em ${n / 30} (${onde_})`);
        quadro(m, tela, escala);
        if (n === 210) meio = tela.pixels.filter(p => p !== 0).length;  // 7 s: o rugido
      }
      assert.deepStrictEqual([m.erros, [...m.ruins]], [[], []], onde_);
      assert.ok(meio > 30000 * escala * escala, `o palco pinta pouco no meio (${onde_}): ${meio}`);
      passo(m, dur + 0.05);
      assert.strictEqual(m.cena, null, `não terminou (${onde_})`);
      assert.strictEqual(m.estado.tr && m.estado.tr.v, A.SSJ4, onde_);
      assert.ok(Math.abs(m.estado.tr.ate - m.T - 120) < 0.1, `fica 2 min (${onde_})`);
      quadro(m, tela, escala);
      assert.deepStrictEqual(m.erros, [], onde_);
    }
  }
});

test('mesmo instante = mesmos bytes, de quadro em quadro ou pulando direto pro instante', () => {
  for (const escala of [1, 1.25]) {
    const a = novoMundo({ escala }), dur = a.cena.dur, ta = telaDa(escala), tb = telaDa(escala);
    const instantes = [0.2, 1.4, 3.1, 4.5, 5.5, 7, 8.4, 9.3, 10, 10.9, 11.6, 12.8, 15.6, dur - 0.05].map(t => Math.round(t * 30) / 30);
    let i = 0;
    for (let n = 1; n / 30 < dur && i < instantes.length; n++) {
      passo(a, n / 30);
      if (Math.abs(n / 30 - instantes[i]) > 1e-9) continue;
      quadro(a, ta, escala);
      const b = novoMundo({ escala });  // b só existe no instante da foto
      passo(b, n / 30);
      quadro(b, tb, escala);
      assert.ok(ta.bgra().equals(tb.bgra()), `t=${instantes[i]}, escala ${escala}`);
      quadro(a, tb, escala);  // de novo, no mesmo instante
      assert.ok(ta.bgra().equals(tb.bgra()), `repetido, t=${instantes[i]}`);
      i++;
    }
    assert.strictEqual(i, instantes.length);
  }
});

test('custo por quadro na escala 1,25 (alvo: mediana abaixo de 4 ms, pior abaixo de 12; falha só acima de 10 e 50)', (t) => {
  const escala = 1.25, tela = telaDa(escala), linhas = [];
  let todas = [];
  for (const semente of [7, 8, 9]) {
    const rodar = (vezes) => {
      const m = novoMundo({ escala, semente });
      const ms = [];
      for (let n = 1; n / 30 < m.cena.dur; n++) {
        passo(m, n / 30);
        let melhor = Infinity;
        for (let k = 0; k < vezes; k++) {  // o menor de 3: a máquina oscila (e roda outros testes junto)
          const a = process.hrtime.bigint();
          quadro(m, tela, escala);
          melhor = Math.min(melhor, Number(process.hrtime.bigint() - a) / 1e6);
        }
        ms.push(melhor);
      }
      return ms;
    };
    rodar(1);  // aquece o JIT e deixa prontos o céu, os morros, a lua e as poses do macaco
    const ms = rodar(3).sort((a, b) => a - b);
    linhas.push(`semente ${semente} ${ms[ms.length >> 1].toFixed(2)}/${ms[ms.length - 1].toFixed(2)}`);
    todas = todas.concat(ms);
  }
  todas.sort((a, b) => a - b);
  const mediana = todas[todas.length >> 1], pior = todas[todas.length - 1];
  t.diagnostic(`ms por quadro (mediana/pior): ${linhas.join(', ')}; todas ${mediana.toFixed(2)}/${pior.toFixed(2)}, p95 ${todas[Math.floor(todas.length * 0.95)].toFixed(2)}`);
  assert.ok(mediana < 10, `mediana ${mediana.toFixed(2)} ms (alvo 4)`);
  assert.ok(pior < 50, `pior quadro ${pior.toFixed(2)} ms (alvo 12)`);
});

test('o último quadro é o Clawd SSJ 4 parado (o que o tema desenha depois), no lugar onde começou', () => {
  const pronto = () => ({ nome: 'pronto', dur: 100, espaco: { frente: 0, tras: 0 }, modos: ['andando'], quadro(g, t, mundo) { A.clawdDB(g, { ta: mundo.T, ...A.ativoTransf(A.SSJ4, mundo.T) }); } });
  for (const escala of [1, 1.25, 2]) {
    for (const onde of [0.05, 0.5, 0.95]) {
      const m = novoMundo({ escala, onde }), dur = m.cena.dur, ref = novoMundo({ escala, onde, cena: pronto });
      const ta = telaDa(escala), tb = telaDa(escala);
      for (let n = 1; n / 30 < dur; n++) passo(m, n / 30);
      passo(m, dur - 0.01);
      passo(ref, dur - 0.01);
      assert.deepStrictEqual([m.pose().x, m.pose().y], [ref.pose().x, ref.pose().y], 'o Mundo não andou com ele');
      quadro(m, ta, escala); quadro(ref, tb, escala);
      assert.ok(ta.bgra().equals(tb.bgra()), `escala ${escala}, onde ${onde}: o último quadro não é o Clawd SSJ 4 parado`);
    }
  }
});

test('cortado (pergunta) antes do clarão: fica pendente pra próxima parada; do clarão em diante, já é SSJ 4', () => {
  const tela = telaDa(1.25);
  for (const [ate, vira] of [[5, false], [epico.T.revela - 0.1, false], [epico.T.revela + 0.1, true], [14, true]]) {
    const m = novoMundo({ escala: 1.25 });
    assert.ok(!m.salvo.dbLua, 'começar gasta a pendência');
    for (let n = 1; n / 30 <= ate; n++) { passo(m, n / 30); quadro(m, tela, 1.25); }
    m.receber({ modo: 'pulando' });
    assert.strictEqual(m.cena, null);
    assert.strictEqual(!!m.salvo.dbLua, !vira, `cortado em ${ate}`);
    assert.strictEqual(m.estado.tr ? m.estado.tr.v : null, vira ? A.SSJ4 : null, `cortado em ${ate}`);
    for (let n = 1; n <= 30; n++) { passo(m, ate + n / 30); quadro(m, tela, 1.25); }
    assert.deepStrictEqual(m.erros, []);
  }
});

test('a trilha: todo som existe, é WAV que o motor lê e cai dentro da cena, na hora certa', () => {
  const c = novoMundo().cena;
  assert.ok(c.sons.length >= 12, `${c.sons.length} sons`);
  for (const [t, arquivo, ganho] of c.sons) {
    assert.ok(t >= 0 && t < c.dur, `${arquivo} em ${t}`);
    assert.ok(ganho > 0 && ganho <= 1, `${arquivo} ganho ${ganho}`);
    assert.ok(arquivo.startsWith('sons-dragonball/ssj4-'), arquivo);
    const f = path.join(JANELINHA, arquivo);
    assert.ok(fs.existsSync(f), `falta ${f}`);
    assert.ok(lerWav(fs.readFileSync(f)).amostras.length > 100, arquivo);
  }
  const quando = n => c.sons.filter(s => s[1] === `sons-dragonball/${n}.wav`).map(s => s[0]);
  assert.deepStrictEqual(quando('ssj4-coracao'), epico.T.batidas);
  assert.deepStrictEqual(quando('ssj4-soco'), epico.T.socos);
  assert.deepStrictEqual(quando('ssj4-ruge'), [epico.T.ruge[0]]);
});

test('o plano, em 50 sementes, 3 lugares da reta e 2 cartões: o macaco e a lua dentro do palco', () => {
  const { T, macacoEm } = epico;
  for (let s = 0; s < 50; s++) {
    for (const onde of [0.05, 0.5, 0.95]) {
      for (const sessoes of [3, 8]) {
        const m = novoMundo({ semente: 1000 + s, onde, sessoes }), J = m.cena.plano, quem = `semente ${1000 + s}, onde ${onde}, ${sessoes} sessões`;
        assert.ok(J.X0 >= 0 && J.X0 <= J.cw, `o Clawd fora do cartão (${quem})`);
        // o macaco: os pés no chão do palco, inteiro dentro dele (com o tremor), começando e
        // terminando do tamanho e no lugar do Clawd
        for (let t = T.cresce[0]; t < T.encolhe[1]; t += 0.05) {
          const M = macacoEm(J, t), w = Mc.MW * J.P * M.k, h = Mc.MH * J.P * M.k;
          assert.ok(M.x - w / 2 - M.treme >= 0 && M.x + w / 2 + M.treme <= J.cw, `o macaco sai dos lados em ${t.toFixed(2)} (${quem})`);
          assert.ok(h + M.treme <= J.HJ, `o macaco passa do teto em ${t.toFixed(2)} (${quem})`);
        }
        assert.strictEqual(macacoEm(J, T.cresce[0] - 0.01), null);
        assert.strictEqual(macacoEm(J, T.encolhe[1]), null);
        assert.ok(Math.abs(macacoEm(J, T.encolhe[1] - 1e-6).x - J.X0) < 0.01, `o macaco não volta pro lugar do Clawd (${quem})`);
        // a lua: nasce atrás dos morros e sobe até o céu, dentro do palco, do lado oposto ao Clawd
        const L = J.lua;
        assert.ok(L.x - L.r >= 0 && L.x + L.r <= J.cw, `a lua sai dos lados (${quem})`);
        assert.ok(L.y1 - L.r >= -J.HJ, `a lua passa do teto (${quem})`);
        assert.ok(L.y0 - L.r > J.horizonte, `a lua já nasce de fora dos morros (${quem})`);
        assert.ok(Math.abs(L.x - J.X0) >= J.cw * 0.25, `a lua em cima do Clawd (${quem})`);
        for (const f of J.faiscas) assert.ok(f.x >= 0 && f.x <= J.cw && f.y <= 0 && f.y >= -J.HJ, `faísca fora do palco (${quem})`);
      }
    }
  }
});

// ============================== as regras da lua ==============================
test('a lua: a cada 150 voltas no cartão (contadas e salvas), fica pendente; sobrevive a reabrir', () => {
  comPasta(pasta => {
    let m = novoMundo({ pasta, cena: null });
    m.chance = () => false;  // sem transformação sorteada no meio
    for (let i = 1; i < 150; i++) tema.aoDarVolta(m);
    assert.strictEqual(m.salvo.dbVoltas, 149);
    assert.ok(!m.salvo.dbLua, 'a 149ª ainda não');
    tema.aoDarVolta(m);
    assert.strictEqual(m.salvo.dbLua, true, 'a 150ª chama a lua');
    assert.deepStrictEqual([salvoEm(pasta).dbVoltas, salvoEm(pasta).dbLua], [150, true]);
    m = novoMundo({ pasta, cena: null });  // reabriu a janelinha
    assert.strictEqual(m.salvo.dbLua, true, 'pendente depois de reabrir');
    m.comecarCena(tema.naParada(m));
    assert.strictEqual(m.cena && m.cena.nome, 'ssj4');
    assert.ok(!salvoEm(pasta).dbLua, 'começou: gastou');
    m.fimCena(true);  // cortado antes do clarão: volta a ficar pendente
    assert.strictEqual(salvoEm(pasta).dbLua, true);
    // e de novo na 300ª
    m.salvo.dbLua = false; m.salvo.dbVoltas = 298;
    m.chance = () => false;
    tema.aoDarVolta(m);
    assert.ok(!m.salvo.dbLua);
    tema.aoDarVolta(m);
    assert.strictEqual(m.salvo.dbLua, true, 'a 300ª');
    // contagem estragada no arquivo: recomeça do zero, sem quebrar
    m.salvo.dbVoltas = 'xyz'; m.salvo.dbLua = false;
    tema.aoDarVolta(m);
    assert.strictEqual(m.salvo.dbVoltas, 1);
  });
});

test('a lua pendente espera: só na reta de cima, andando pra direita, e sem transformação (tenta de novo em 1 s)', () => {
  const m = novoMundo({ cena: null }), g = m.geometria();
  m.salvo.dbLua = true;
  m.dist = (g.w - 2 * g.r) + Math.PI * g.r / 2 + 10;  // descendo a lateral direita
  assert.strictEqual(tema.naParada(m), undefined);
  m.dist = (g.w - 2 * g.r) * 2 + (g.h - 2 * g.r) + Math.PI * g.r + 10;  // na reta de baixo, pra esquerda
  assert.strictEqual(tema.naParada(m), undefined);
  m.dist = (g.w - 2 * g.r) * 0.3;
  m.estado.tr = { v: A.VAR.ssj, t0: 0, tv0: null, ate: 30 };
  assert.strictEqual(tema.naParada(m), undefined, 'espera a transformação acabar');
  m.estado.tr = null;
  const c = tema.naParada(m);
  assert.strictEqual(c && c.nome, 'ssj4');
  assert.strictEqual(m.salvo.dbLua, true, 'só gasta quando começa');
  // pelo Mundo: na parada seguinte ele começa sozinho
  const m2 = novoMundo({ cena: null });
  m2.salvo.dbLua = true; m2.dist = (g.w - 2 * g.r) * 0.2; m2.proxima = 0;
  m2.passo(1 / 30);
  assert.strictEqual(m2.cena && m2.cena.nome, 'ssj4');
});

test('a lua quebrada ou sem o arquivo do épico: a pendência some e as paradas voltam a ser as lutas', () => {
  const m = novoMundo({ cena: null });
  m.salvo.dbLua = true;
  m.ruins.add('ssj4');
  assert.ok(LUTAS.includes(tema.naParada(m).nome));
  assert.ok(!m.salvo.dbLua);
  assert.strictEqual(tema.cenaPorNome(m, 'ssj4'), null);
  try {
    tema.trocarEpicoLua(null);  // o dragonball-epico-ssj4.js não existe
    const m2 = novoMundo({ cena: null });
    m2.salvo.dbLua = true;
    assert.ok(LUTAS.includes(tema.naParada(m2).nome));
    assert.ok(!m2.salvo.dbLua);
    assert.strictEqual(tema.cenaPorNome(m2, 'ssj4'), null);
    assert.deepStrictEqual(m2.erros, [], 'faltar não é erro');
  } finally {
    tema.trocarEpicoLua(undefined);
  }
  // quebrado no meio: anota, não fica pendente e não vira SSJ 4
  const m3 = novoMundo();
  m3.cena.quadro = () => { throw new Error('de propósito'); };
  quadro(m3, telaDa(1), 1);
  assert.strictEqual(m3.erros.length, 1);
  assert.ok(m3.ruins.has('ssj4'));
  assert.ok(!m3.salvo.dbLua);
  assert.strictEqual(m3.estado.tr, null);
});

test('o SSJ 4 fica 2 min e volta ao normal (o cabelo pisca e a aura encolhe)', () => {
  const m = novoMundo(), tela = telaDa(1), dur = m.cena.dur;
  for (let n = 1; n / 30 < dur + 0.1; n++) passo(m, n / 30);
  const t0 = m.T;
  assert.strictEqual(m.estado.tr.v, A.SSJ4);
  for (let s = t0; s < t0 + 119.5; s += 0.5) passo(m, s);
  assert.strictEqual(m.estado.tr && m.estado.tr.v, A.SSJ4, 'ainda SSJ 4');
  quadro(m, tela, 1);
  passo(m, t0 + 120.1);
  assert.ok(m.estado.tr && m.estado.tr.tv0 != null, 'voltando');
  quadro(m, tela, 1);
  passo(m, t0 + 120.2 + A.VOLTA);
  assert.strictEqual(m.estado.tr, null, 'normal de novo');
  quadro(m, tela, 1);
  assert.deepStrictEqual(m.erros, []);
});

test('o visual é a "fera" (o dono escolheu entre 5, 09/10): pelo carmim, juba nas costas, cauda fina, aura mais baixa e fraca', () => {
  const R = A.ativoTransf(A.SSJ4, 1);
  assert.strictEqual(R.roupa, A.ROUPA_SSJ4);
  assert.ok(A.ROUPAS[A.ROUPA_SSJ4].linhas.every(l => l.length === 18), 'grid de 18 colunas');
  assert.strictEqual(R.auraCor, A.PELO);
  assert.deepStrictEqual([R.longo, R.juba, R.caudaForma], [1, A.JUBA_SSJ4, A.CAUDA_SSJ4]);
  assert.ok(R.aura < 1 && R.auraAlfa < 1, 'a aura não cobre o pelo nem a juba');
  // voltando ao normal: a juba e a cauda continuam as dele (encolhendo) e a aura some
  const V = A.efeitoTransf(A.SSJ4, 200, A.VOLTA * 0.5, 201).R;
  assert.deepStrictEqual([V.juba, V.caudaForma, V.auraAlfa], [A.JUBA_SSJ4, A.CAUDA_SSJ4, R.auraAlfa]);
  assert.ok(V.aura < R.aura && V.longo < 1);
  // a juba e a cauda aparecem de verdade, e são as dele (não a crina do SSJ 3 nem a cauda de sempre)
  const desenho = p => { const t = new Tela(80, 70), g = t.getContext('2d'); g.translate(46, 62); A.clawdDB(g, { ta: 0, ...p }); return Buffer.from(t.bgra()); };
  const fera = desenho({ ...R, aura: 0 });
  for (const [outro, o_que] of [[{ longo: 0 }, 'sem juba'], [{ juba: undefined }, 'crina do SSJ 3'], [{ cauda: 0 }, 'sem cauda'], [{ caudaForma: undefined }, 'cauda de sempre']]) {
    assert.ok(!fera.equals(desenho({ ...R, aura: 0, ...outro })), `igual a ${o_que}`);
  }
});

// ============================== o pedido ao dragão ==============================
const geo = m => { const c = m.host.cartao, g = m.geometria(); return { w: c[2], h: c[3], r: g.r, extra: g.h - c[3] }; };
const paraEm = m => K.paraEm(K.caminhoDragao(geo(m)));

test('meditando (parado), o SSJ 4 continua de pelo e de cauda: respirando, de olhos fechados, sentado e na saída', () => {
  const medita = require(path.join(MOTOR, 'parado-dragonball-medita'));
  require(path.join(MOTOR, 'clawd')).registrarRoupas(A.ROUPAS);  // o tema faz isso no iniciar()
  const c = A.PELO.slice(1).match(/../g).map(h => parseInt(h, 16));
  const quadro = (v, t, u) => {
    let s = 777;
    const m = { T: t, estado: { tr: { v, t0: -50, tv0: null, ate: 1e9 } }, sorteio: () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648), chance: () => false };
    const cena = medita.cena(m), tl = new Tela(90, 70), g = tl.getContext('2d');
    g.translate(45, 62);
    if (u != null) { m.T = t + u; medita.saida.quadro(g, u, m, t); } else cena.quadro(g, t, m);
    return Buffer.from(tl.bgra());
  };
  const pelo = b => { let n = 0; for (let i = 0; i < b.length; i += 4) if (b[i] === c[2] && b[i + 1] === c[1] && b[i + 2] === c[0] && b[i + 3] === 255) n++; return n; };
  // antes de 09/10 a cena trocava a roupa dele pela do gi: 0 pixel de pelo do respiro em diante
  for (const [t, u] of [[0.4], [0.6], [1.2], [3], [40], [15.5, 0.05], [15.5, 0.7]]) {
    assert.ok(pelo(quadro(A.SSJ4, t, u)) >= 40, `sem pelo em t=${t}${u != null ? `, saída ${u}` : ''}`);
  }
  for (const t of [0.6, 3, 40]) assert.ok(!quadro(A.SSJ4, t).equals(quadro({ ...A.SSJ4, cauda: 0 }, t)), `sem cauda em t=${t}`);
});

test('o pedido: 4 em rodízio (infinito, feijões, banquete, código), um por dragão, salvo pra reabrir', () => {
  assert.deepStrictEqual(Pd.PEDIDOS, ['infinito', 'feijoes', 'banquete', 'codigo']);
  comPasta(pasta => {
    const vistos = [];
    for (let i = 0; i < 6; i++) {
      const m = novoMundo({ pasta, cena: mm => tema.cenaPorNome(mm, 'dragao') });  // cada dragão numa janelinha reaberta
      vistos.push(m.cena.pedido);
      assert.strictEqual(salvoEm(pasta).dbPedidos, i + 1);
    }
    assert.deepStrictEqual(vistos, ['infinito', 'feijoes', 'banquete', 'codigo', 'infinito', 'feijoes']);
  });
  const m = novoMundo({ cena: null });
  m.salvo.dbPedidos = -3;  // arquivo estragado: não quebra
  assert.ok(Pd.PEDIDOS.includes(tema.cenaPorNome(m, 'dragao').pedido));
  m.salvo.dbPedidos = 'xyz';
  assert.strictEqual(tema.cenaPorNome(m, 'dragao').pedido, 'infinito');
});

test('os 4 pedidos inteiros, quadro a quadro, andando e parado, em 2 escalas: sem erro e acabam', () => {
  for (let k = 0; k < 4; k++) {
    for (const modo of ['andando', 'parado']) {
      for (const escala of [1, 1.25]) {
        const m = novoMundo({ escala, modo, onde: 0.3, cena: mm => { mm.salvo.dbPedidos = k; return tema.cenaPorNome(mm, 'dragao'); } });
        const tela = telaDa(escala), dur = m.cena.dur, quem = `${Pd.PEDIDOS[k]}, ${modo}, escala ${escala}`;
        assert.strictEqual(m.cena.pedido, Pd.PEDIDOS[k]);
        assert.ok(dur > paraEm(m) + K.DRAG.pedido, quem);
        for (let n = 1; n / 30 < dur; n++) { passo(m, n / 30); assert.ok(m.cena, `acabou antes em ${n / 30} (${quem})`); quadro(m, tela, escala); }
        passo(m, dur + 0.05);
        assert.strictEqual(m.cena, null, quem);
        assert.deepStrictEqual([m.erros, [...m.ruins]], [[], []], quem);
      }
    }
  }
});

test('pairando, a cabeça do dragão vira pro Clawd; os olhos acendem no "concedido"', () => {
  const m = novoMundo({ cena: null }), G = geo(m), TS = paraEm(m);
  const alvo = { x: 40, y: -15 };
  const antes = K.cabecaDragao(G, TS - 0.2, alvo), sem = K.cabecaDragao(G, TS - 0.2, null);
  assert.deepStrictEqual(antes, sem, 'subindo: segue o caminho');
  const h = K.cabecaDragao(G, TS + 1, alvo), quer = Math.atan2(alvo.y - h.y, alvo.x - h.x);
  assert.ok(Math.abs(Math.atan2(Math.sin(h.a - quer), Math.cos(h.a - quer))) < 0.01, `olha pro Clawd: ${h.a} x ${quer}`);
  assert.strictEqual(Pd.olho(Pd.H.concede[0] - 0.01), 0);
  assert.ok(Pd.olho(Pd.H.concede[0] + 0.3) > 0.9);
  assert.strictEqual(Pd.olho(Pd.H.ganha[1]), 0);
});

test('infinito: as barras enchem douradas só no desenho, durante o pedido (o uso de verdade não muda)', () => {
  const corEm = (k, h) => {
    const m = novoMundo({ cena: mm => { mm.salvo.dbPedidos = k; return tema.cenaPorNome(mm, 'dragao'); } }), tela = telaDa(1);
    const uso = JSON.stringify(m.host.uso), b = m.host.uso[0].barra, t = paraEm(m) + h;
    for (let n = 1; n / 30 < t; n++) passo(m, n / 30);
    passo(m, t);
    quadro(m, tela, 1);
    assert.strictEqual(JSON.stringify(m.host.uso), uso);
    const p = tela.pixels[Math.round(b[1] + b[3] / 2) * tela.width + Math.round(b[0] + b[2] - 3)];  // o fim da barra (vazio a 38%)
    return { r: (p >>> 16) & 255, b: p & 255 };
  };
  const ouro = corEm(0, 3.3), feijao = corEm(1, 3.3), cedo = corEm(0, 0.5);
  assert.ok(ouro.r > ouro.b + 100, `infinito: dourada ${JSON.stringify(ouro)}`);
  assert.ok(feijao.r < feijao.b, `feijões: vazia ${JSON.stringify(feijao)}`);
  assert.ok(cedo.r < cedo.b, `antes do pedido: vazia ${JSON.stringify(cedo)}`);
});

test('a trilha de cada pedido: todo som existe e é WAV, dentro da cena; o vento acaba quando ele para no ar', () => {
  for (let k = 0; k < 4; k++) {
    const m = novoMundo({ cena: mm => { mm.salvo.dbPedidos = k; return tema.cenaPorNome(mm, 'dragao'); } }), c = m.cena, TS = paraEm(m);
    const nomes = c.sons.map(s => path.basename(s[1], '.wav'));
    assert.ok(nomes.includes('pedido-fala') && nomes.includes('pedido-concede') && nomes.includes('pedido-festa'), nomes.join());
    for (const [t, arquivo, ganho] of c.sons) {
      assert.ok(t >= 0 && t < c.dur, `${arquivo} em ${t}`);
      assert.ok(ganho > 0 && ganho <= 1, `${arquivo} ganho ${ganho}`);
      const f = path.join(JANELINHA, arquivo);
      assert.ok(fs.existsSync(f), `falta ${f}`);
      assert.ok(lerWav(fs.readFileSync(f)).amostras.length > 100, arquivo);
      if (arquivo.includes('/pedido-')) assert.ok(t >= TS && t < TS + K.DRAG.pedido, `${arquivo} fora do pedido`);
    }
    const voo = c.sons.find(s => s[1].endsWith('shenlong-voo.wav'));
    assert.ok(voo[0] + voo[4] <= TS, 'o vento passa da volta');
  }
});
