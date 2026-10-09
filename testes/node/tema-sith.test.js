'use strict';
// motor/tema-sith.js: toda cena quadro a quadro nas 3 escalas, o quadro como função do tempo, o
// custo, o salto pro hiperespaço quando acaba tudo (com a trilha de som) e a meditação de parado
// (a cena até 3 h, a saída terminando no Clawd do tema), e os sons do tema existindo.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const { Tela } = require(path.join(MOTOR, 'raster'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const { layoutDe } = require(path.join(MOTOR, 'comum'));
const { lerWav } = require(path.join(MOTOR, 'som'));
const tema = require(path.join(MOTOR, 'tema-sith'));
const { estadoDeMentira } = require('../motor-foto');

const ESCALAS = [1, 1.25, 2];
const JANELINHA = path.join(MOTOR, '..');
function montar({ escala = 1, modo = 'andando', semente = 2 } = {}) {
  const m = new Mundo({ tema, semente });
  const erros = [];
  m.aoErro = e => erros.push(e);
  m.receber({ ...estadoDeMentira('sith', modo), escala });
  if (m.cena) m.fimCena(true);
  const tela = new Tela(Math.round(380 * escala), Math.round(440 * escala)), g = tela.getContext('2d');
  const quadro = T => {
    m.passo(T);
    tela.limpar(); g.setTransform(escala, 0, 0, escala, 0, 0); g.globalAlpha = 1;
    m.desenhar(g);
    return tela;
  };
  return { m, erros, tela, quadro };
}
const cheia = tela => { const px = tela.pixels; for (let i = 0; i < px.length; i++) if (px[i] !== 0) return true; return false; };
const modoDa = nome => (nome === 'medita' ? 'parado' : 'andando');
const durDe = cena => (Number.isFinite(cena.dur) ? cena.dur : 20);  // a meditação não acaba sozinha: 20 s

test('toda cena, quadro a quadro (30/s), a duração inteira, sem erro, nas escalas 1, 1,25 e 2', () => {
  assert.deepStrictEqual(tema.cenas, ['deflete', 'droide', 'esgana', 'respira', 'medita', 'hiperespaco']);
  for (const escala of ESCALAS) {
    for (const nome of tema.cenas) {
      const { m, erros, tela, quadro } = montar({ escala, modo: modoDa(nome) });
      const cena = tema.cenaPorNome(m, nome);
      assert.ok(cena && cena.dur > 0, `${nome}: cenaPorNome`);
      m.comecarCena(cena);
      assert.strictEqual(m.cena && m.cena.nome, nome === 'medita' ? 'medita' : nome, `${nome} não começou`);
      const dur = durDe(cena);
      for (let f = 0; f <= Math.ceil(dur * 30) + 1; f++) {
        quadro(f / 30);
        if (f % 10 === 0) assert.ok(cheia(tela), `${nome} @ ${escala}: quadro ${f} vazio`);
      }
      assert.deepStrictEqual(erros, [], `${nome} @ ${escala}`);
      assert.strictEqual(m.ruins.size, 0, `${nome} @ ${escala}: ${[...m.ruins]}`);
      if (Number.isFinite(cena.dur)) assert.ok(!m.cena || m.cena.nome !== nome, `${nome} não terminou`);
    }
  }
  const { m } = montar();
  assert.strictEqual(tema.cenaPorNome(m, 'nao-existe'), null);
});

test('o quadro é função do tempo: o mesmo instante dá os mesmos bytes, por qualquer caminho', () => {
  for (const nome of tema.cenas) {
    const a = montar({ escala: 1.25, modo: modoDa(nome) }), b = montar({ escala: 1.25, modo: modoDa(nome) });
    const cena = tema.cenaPorNome(a.m, nome);
    a.m.comecarCena(cena); b.m.comecarCena(tema.cenaPorNome(b.m, nome));
    for (const t of [0.4, durDe(cena) * 0.62]) {
      for (let s = 1 / 30; s < t; s += 1 / 30) a.m.passo(s);
      for (let s = 1 / 7; s < t; s += 1 / 7) b.m.passo(s);  // pulando quadros
      const ta = Buffer.from(a.quadro(t).bgra()), tb = Buffer.from(b.quadro(t).bgra());
      assert.ok(ta.equals(tb), `${nome} @ ${t.toFixed(2)} s`);
      assert.ok(ta.equals(Buffer.from(a.quadro(t).bgra())), `${nome} @ ${t.toFixed(2)} s: desenhar de novo mudou`);
    }
  }
});

test('custo em 1,25: passeio < 4 ms por quadro e cena < 12 ms no pior (falha só acima de 16 e 40)', (t) => {
  const medir = (nome, segundos) => {
    const { m, quadro } = montar({ escala: 1.25, modo: nome ? modoDa(nome) : 'andando' });
    let dur = segundos;
    if (nome) { const c = tema.cenaPorNome(m, nome); m.comecarCena(c); dur = durDe(c); }
    const ms = [];
    for (let f = 0; f <= dur * 30; f++) {
      const ini = process.hrtime.bigint();
      quadro(f / 30);
      ms.push(Number(process.hrtime.bigint() - ini) / 1e6);
    }
    ms.sort((x, y) => x - y);
    return { mediana: ms[ms.length >> 1], pior: ms[ms.length - 1] };
  };
  medir(null, 8); for (const c of tema.cenas) medir(c);  // aquece
  const passeio = Math.min(medir(null, 8).mediana, medir(null, 8).mediana);
  t.diagnostic(`passeio (moldura + enfeites + Clawd andando): ${passeio.toFixed(2)} ms por quadro (mediana)`);
  assert.ok(passeio < 16, `${passeio.toFixed(2)} ms (alvo 4)`);
  for (const c of tema.cenas) {
    const r = [medir(c), medir(c)], pior = Math.min(r[0].pior, r[1].pior);
    t.diagnostic(`${c}: mediana ${r[0].mediana.toFixed(2)} ms, pior ${pior.toFixed(2)} ms`);
    assert.ok(pior < 40, `${c}: pior quadro ${pior.toFixed(2)} ms (alvo 12)`);
  }
});

test('acabou tudo: o salto pro hiperespaço corta a cena da vez, toca a trilha e não repete por cima', () => {
  for (const modo of ['andando', 'parado']) {
    const { m, quadro } = montar({ modo });
    const sons = [];
    m.aoSom = c => sons.push(c && c.nome);
    if (modo === 'andando') m.comecarCena(tema.cenaPorNome(m, 'droide'));
    quadro(0.5);
    m.evento('tudo');
    assert.strictEqual(m.cena && m.cena.nome, 'hiperespaco', modo);
    assert.deepStrictEqual(sons, ['hiperespaco']);
    m.evento('tudo');  // o segundo não recomeça
    assert.deepStrictEqual(sons, ['hiperespaco']);
    m.receber({ modo: 'parado' });  // o estado 'parado' chegando depois não corta
    assert.strictEqual(m.cena && m.cena.nome, 'hiperespaco');
    for (const [, arquivo] of m.cena.sons) assert.ok(fs.existsSync(path.join(JANELINHA, arquivo)), `falta ${arquivo}`);
  }
  // 'terminou' não faz nada; com o Clawd desligado, nem o 'tudo'
  const { m } = montar();
  m.evento('terminou');
  assert.strictEqual(m.cena, null);
  m.receber({ clawd: false });
  m.evento('tudo');
  assert.strictEqual(m.cena, null);
});

test('parado há 1 min: medita; algo rodando, a saída toca e termina no Clawd andando com o sabre aceso', () => {
  const { m, quadro, erros } = montar({ modo: 'parado' });
  for (let T = 0; T < 61; T += 1 / 5) quadro(T);
  assert.strictEqual(m.cena && m.cena.nome, 'medita');
  for (let T = 61; T < 3 * 3600; T += 37) quadro(T);  // 3 h meditando, pulando quadros
  assert.strictEqual(m.cena && m.cena.nome, 'medita');
  const T0 = 3 * 3600 + 1;
  quadro(T0);
  m.receber({ modo: 'andando' });
  assert.strictEqual(m.cena, null);
  assert.ok(tema.bloqueia(m), 'a saída segura o Clawd');
  for (let T = T0; T < T0 + 1.5; T += 1 / 30) quadro(T);
  assert.ok(!tema.bloqueia(m), 'a saída acabou');
  assert.ok(m.estado.acende >= T0 + 0.9, 'o sabre acende depois da saída');
  assert.deepStrictEqual(erros, []);
});

test('layout: enfeites do tema, moldura de 3 px e as colunas de sempre', () => {
  const l = layoutDe(tema);
  assert.strictEqual(l.enfeites, true);
  assert.deepStrictEqual(l.moldura, [3, 3, 3, 3]);
  assert.deepStrictEqual(l.colunas, { tempo: 36, pct: 38, falta: 48, rotulo: 18 });
});

test('os sons do tema existem e são WAV que o motor lê', () => {
  for (const n of ['esperando', 'terminou', 'tudo', 'hiper-abre', 'nave', 'salto']) {
    const f = path.join(JANELINHA, 'sons-sith', n + '.wav');
    assert.ok(fs.existsSync(f), `falta ${f}`);
    const w = lerWav(fs.readFileSync(f));
    assert.ok(w && w.amostras && w.amostras.length > 1000, n);
  }
});
