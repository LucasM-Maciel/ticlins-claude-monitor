'use strict';
// motor/tema-padrao.js: as 7 cenas da prévia 2 (desenho, custo, mesmo instante = mesmos
// bytes) e quando cada uma aparece (dorme parado, festa no 'tudo', metade das paradas).
// Ver a olho: node testes/motor-foto.js --tema padrao --cena festa --modo parado --tira 0,0.5,1 --zoom 3 --saida f.png
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const { Tela } = require(path.join(MOTOR, 'raster'));
const { layoutDe } = require(path.join(MOTOR, 'comum'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const tema = require(path.join(MOTOR, 'tema-padrao'));
const { estadoDeMentira, fotografar } = require('../motor-foto');

const SORTEADAS = ['pisa', 'notebook', 'cafe', 'pensando', 'tarefas'];
const modoDa = nome => ((tema.cenaPorNome({ sorteio: () => 0 }, nome).modos || ['andando']).includes('andando') ? 'andando' : 'parado');
function novoMundo(modo, { semente = 7, t = tema, escala = 1 } = {}) {
  const m = new Mundo({ tema: t, semente });
  m.erros = [];
  m.aoErro = e => m.erros.push(e);
  m.receber({ ...estadoDeMentira('padrao', modo), escala });
  return m;
}
// um quadro como o motor.js desenha (tela da janela inteira, na escala)
function quadro(m, tela, escala) {
  const g = tela.getContext('2d');
  tela.limpar();
  g.setTransform(escala, 0, 0, escala, 0, 0);
  g.globalAlpha = 1;
  m.desenhar(g);
}
const telaDa = escala => new Tela(Math.round(380 * escala), Math.round(440 * escala));
const duracao = c => (c.dur === Infinity ? 10 : c.dur);
// anda o relógio de a até b de dt em dt (5 quadros/s parado, como o motor)
function andar(m, a, b, dt = 0.2, cada) { for (let T = a + dt; T <= b + 1e-9; T += dt) { m.passo(T); if (cada) cada(T); } }

test('o tema: layout, trilha e as 7 cenas que a prévia aprovou', () => {
  assert.deepStrictEqual(tema.cenas.slice().sort(), [...SORTEADAS, 'dorme', 'festa'].sort());
  const L = layoutDe(tema);
  assert.strictEqual(L.raio, 8);
  assert.strictEqual(L.enfeites, false, 'a janelinha desenha bolinhas, números e barras');
  assert.deepStrictEqual(tema.trilha, { raio: 8 });
  const m = novoMundo('andando');
  for (const nome of tema.cenas) {
    const c = tema.cenaPorNome(m, nome);
    assert.strictEqual(c.nome, nome);
    assert.ok(c.dur > 0 && typeof c.quadro === 'function', nome);
  }
  assert.strictEqual(tema.cenaPorNome(m, 'zumbi'), null);
  assert.strictEqual(tema.cenaPorNome(m, 'dorme').dur, Infinity, 'dorme até algo rodar');
  assert.deepStrictEqual([tema.cenaPorNome(m, 'dorme').modos, tema.cenaPorNome(m, 'festa').modos], [['parado'], ['parado']]);
});

test('toda cena, quadro a quadro (30/s) a duração inteira, nas escalas 1, 1,25 e 2: sem erro e pintando', () => {
  for (const escala of [1, 1.25, 2]) {
    const tela = telaDa(escala);
    for (const nome of tema.cenas) {
      const m = novoMundo(modoDa(nome), { escala });
      m.comecarCena(tema.cenaPorNome(m, nome));
      assert.strictEqual(m.cena && m.cena.nome, nome, `${nome} não começou`);
      const dur = duracao(m.cena);
      for (let n = 1; n / 30 < dur; n++) {
        m.passo(n / 30);
        assert.strictEqual(m.cena && m.cena.nome, nome, `${nome} acabou antes da hora em ${n / 30}`);
        quadro(m, tela, escala);
        if (n % 15 === 0) assert.ok(tela.pixels.some(p => p !== 0), `${nome} em ${n / 30} s: tela vazia`);
      }
      assert.deepStrictEqual([m.erros, [...m.ruins]], [[], []], `${nome} na escala ${escala}`);
      const infinita = m.cena.dur === Infinity;
      m.passo(dur + 0.05);
      assert.strictEqual(!!m.cena, infinita, infinita ? `${nome} acordou sozinho` : `${nome} não acabou no fim`);
    }
  }
});

test('mesmo instante = mesmos bytes, de 30 em 30 quadros ou pulando direto pro instante', () => {
  for (const nome of tema.cenas) {
    const modo = modoDa(nome), escala = 1.25, c = tema.cenaPorNome({ sorteio: () => 0 }, nome);
    const instantes = [0.37, duracao(c) / 2, duracao(c) * 0.9];
    const fotos = instantes.map(t => {
      const a = fotografar({ tema: 'padrao', cena: nome, t, escala, modo }), b = fotografar({ tema: 'padrao', cena: nome, t, escala, modo });
      assert.ok(a.bgra().equals(b.bgra()), `${nome} em ${t}: duas fotos diferentes`);
      // o motor pode pular quadros: um passo só até t dá o mesmo desenho
      const m = novoMundo(modo, { escala });
      m.comecarCena(tema.cenaPorNome(m, nome));
      m.passo(t);
      const pulo = telaDa(escala);
      quadro(m, pulo, escala);
      assert.ok(a.bgra().equals(pulo.bgra()), `${nome} em ${t}: pulando direto deu outro quadro`);
      return a;
    });
    assert.ok(!fotos[0].bgra().equals(fotos[1].bgra()), `${nome} não mexe`);
  }
});

test('custo: quadro típico abaixo de 4 ms e pior quadro abaixo de 12 ms em escala 1,25 (falha só em 16 / 48)', (t) => {
  const escala = 1.25, tela = telaDa(escala), linhas = [];
  let todas = [], pior = 0;
  for (const nome of tema.cenas) {
    const tempos = [];
    for (const medir of [false, true]) {  // a 1ª passada aquece o JIT e as pixel arts
      const m = novoMundo(modoDa(nome), { escala });
      m.comecarCena(tema.cenaPorNome(m, nome));
      const dur = duracao(m.cena);
      for (let n = 1; n / 30 < dur; n++) {
        const ini = process.hrtime.bigint();
        m.passo(n / 30);
        quadro(m, tela, escala);
        if (medir) tempos.push(Number(process.hrtime.bigint() - ini) / 1e6);
      }
    }
    tempos.sort((a, b) => a - b);
    const med = tempos[tempos.length >> 1], max = tempos[tempos.length - 1];
    linhas.push(`${nome} ${med.toFixed(2)}/${max.toFixed(2)}`);
    todas = todas.concat(tempos);
    pior = Math.max(pior, max);
  }
  todas.sort((a, b) => a - b);
  const mediana = todas[todas.length >> 1];
  t.diagnostic(`ms por quadro, mediana/pior: ${linhas.join(', ')}; todas: ${mediana.toFixed(2)}/${pior.toFixed(2)}`);
  assert.ok(mediana < 16, `mediana ${mediana.toFixed(2)} ms (alvo 4)`);
  assert.ok(pior < 48, `pior quadro ${pior.toFixed(2)} ms (alvo 12)`);
});

test('dorme: só depois de 60 s parado, fica dormindo e acorda no lugar quando algo roda', () => {
  const m = novoMundo('parado');
  const tela = telaDa(1);
  andar(m, 0, 59.8, 0.2, () => assert.strictEqual(m.cena, null, `dormiu cedo em ${m.T}`));
  assert.strictEqual(tema.animado(m), false, 'parado sem cena: o motor cai pra 5 quadros/s');
  andar(m, 59.8, 60.2);
  assert.strictEqual(m.cena && m.cena.nome, 'dorme');
  assert.strictEqual(tema.animado(m), true, 'dormindo mexe (respira, z z z)');
  andar(m, 60.2, 600, 0.5);
  assert.strictEqual(m.cena && m.cena.nome, 'dorme', 'dorme enquanto nada roda');
  quadro(m, tela, 1);
  const meio = m.pose();
  // algo começou a rodar: acorda (0,6 s no lugar) e sai andando dali
  m.receber({ modo: 'andando' });
  assert.strictEqual(m.cena, null);
  assert.ok(m.bloqueado(), 'acordando: ainda não anda');
  const acordando = m.pose();
  assert.deepStrictEqual([acordando.x, acordando.y, acordando.a], [meio.x, meio.y, 0], 'acorda onde dormiu');
  const T0 = m.T;
  andar(m, T0, T0 + 0.55, 1 / 30, () => quadro(m, tela, 1));
  assert.deepStrictEqual([m.pose().x, m.pose().y], [meio.x, meio.y], 'espreguiçando, não anda');
  andar(m, T0 + 0.55, T0 + 2, 1 / 30, () => quadro(m, tela, 1));
  assert.ok(!m.bloqueado() && m.pose().x > meio.x + 30, 'depois de acordar, anda');
  assert.deepStrictEqual(m.erros, []);
});

test('dorme: andando nunca; parado de novo recomeça a conta; pergunta acorda sem espreguiçar', () => {
  let m = novoMundo('andando', { semente: 3 });
  andar(m, 0, 400, 0.1, () => assert.ok(!m.cena || SORTEADAS.includes(m.cena.nome), `andando apareceu ${m.cena && m.cena.nome}`));
  m = novoMundo('parado');
  andar(m, 0, 50);
  m.receber({ modo: 'andando' });
  andar(m, 50, 55);
  m.receber({ modo: 'parado' });
  andar(m, 55, 114.8, 0.2, () => assert.strictEqual(m.cena, null, `dormiu em ${m.T}: contou o tempo de antes`));
  andar(m, 114.8, 115.2);
  assert.strictEqual(m.cena && m.cena.nome, 'dorme');
  m.receber({ modo: 'pulando' });
  assert.strictEqual(m.cena, null, 'a pergunta tem que aparecer');
  assert.ok(!m.bloqueado());
  assert.strictEqual(tema.animado(m), true);
});

test("festa: no 'tudo', antes ou depois do estado 'parado'; dura 3 s e corta o que estava", () => {
  // como o overlay.ps1 manda: o evento chega andando (no meio de uma cena), o 'parado' logo depois
  let m = novoMundo('andando');
  m.comecarCena(tema.cenaPorNome(m, 'cafe'));
  andar(m, 0, 1, 1 / 30);
  m.evento('tudo');
  assert.strictEqual(m.cena.nome, 'cafe', 'andando ainda: espera o parado');
  m.receber({ modo: 'parado' });
  assert.strictEqual(m.cena && m.cena.nome, 'festa');
  andar(m, 1, 3.9, 1 / 30);
  assert.strictEqual(m.cena && m.cena.nome, 'festa');
  andar(m, 3.9, 4.2, 1 / 30);
  assert.strictEqual(m.cena, null, 'acabou em 3 s');
  assert.strictEqual(tema.animado(m), false);
  // já parado (o Mac pode mandar nessa ordem): na hora
  m = novoMundo('parado');
  m.evento('tudo');
  assert.strictEqual(m.cena && m.cena.nome, 'festa');
  // dormindo: a festa acorda, e depois ele volta a dormir
  m = novoMundo('parado');
  andar(m, 0, 61);
  assert.strictEqual(m.cena.nome, 'dorme');
  m.evento('tudo');
  assert.strictEqual(m.cena.nome, 'festa');
  andar(m, 61, 64.6);
  assert.strictEqual(m.cena && m.cena.nome, 'dorme');
  // 'terminou' (uma só) não é festa; 'tudo' velho ou cortado por pergunta também não
  m = novoMundo('parado');
  m.evento('terminou');
  assert.strictEqual(m.cena, null);
  m = novoMundo('andando');
  m.evento('tudo');
  andar(m, 0, 5);
  m.receber({ modo: 'parado' });
  assert.strictEqual(m.cena, null, "o 'tudo' de 5 s atrás não vale mais");
  m = novoMundo('andando');
  m.evento('tudo');
  m.receber({ modo: 'pulando' });
  m.receber({ modo: 'parado' });
  assert.strictEqual(m.cena, null, 'veio uma pergunta no meio: sem festa');
});

test('paradas da caminhada: metade sem cena, a outra metade entre as 5 sorteadas', (t) => {
  let nulos = 0;
  const comecadas = [];
  const espiao = {
    ...tema,
    naParada(m) { const c = tema.naParada(m); if (c === null) nulos++; return c; },
    aoComecarCena(m, c) { tema.aoComecarCena(m, c); comecadas.push(c.nome); },
  };
  const m = novoMundo('andando', { semente: 2026, t: espiao });
  andar(m, 0, 4 * 3600, 0.1);  // 4 h andando
  const total = nulos + comecadas.length, conta = Object.fromEntries(SORTEADAS.map(n => [n, comecadas.filter(c => c === n).length]));
  t.diagnostic(`4 h andando: ${total} paradas, ${nulos} sem cena; ${JSON.stringify(conta)}`);
  assert.ok(total > 300, `só ${total} paradas`);
  assert.ok(Math.abs(nulos / total - 0.5) < 0.08, `${nulos} de ${total} paradas sem cena`);
  assert.deepStrictEqual(comecadas.filter(n => !SORTEADAS.includes(n)), [], 'dorme e festa não saem no sorteio');
  for (const n of SORTEADAS) assert.ok(conta[n] > comecadas.length / 10, `${n} saiu ${conta[n]} de ${comecadas.length}`);
  assert.deepStrictEqual(m.erros, []);
  // cena que quebrou não sai mais; sem nenhuma boa, toda parada fica sem cena
  const q = novoMundo('andando');
  for (const n of SORTEADAS.slice(1)) q.ruins.add(n);
  for (let i = 0; i < 40; i++) { const c = tema.naParada(q); assert.ok(c === null || c.nome === 'pisa'); if (c) tema.aoComecarCena(q, c); }
  q.ruins.add('pisa');
  for (let i = 0; i < 10; i++) assert.strictEqual(tema.naParada(q), null);
});
