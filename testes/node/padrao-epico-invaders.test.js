'use strict';
// motor/padrao-epico-invaders.js: o épico do Padrão, candidata "invaders" (fliperama dos bugs).
// A cena inteira quadro a quadro em 3 escalas e 2 cartões, mesmo instante = mesmos bytes, o
// custo, o Clawd de volta no lugar no fim, e o plano (pela semente) sempre jogável: todo bug
// morre, nenhuma bomba encosta no Clawd, ele não corre mais que o combinado nem sai da tela.
// Ver a olho: node <scratchpad>/epico/epico-foto.js --modulo invaders --tira 1.5,5,8.5,13.9 --escala 1.25 --saida f.png
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const epico = require(path.join(MOTOR, 'padrao-epico-invaders'));
const { Tela } = require(path.join(MOTOR, 'raster'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const { desenhaClawd } = require(path.join(MOTOR, 'clawd'));
const tema = require(path.join(MOTOR, 'tema-padrao'));
const { estadoDeMentira } = require('../motor-foto');

// o Clawd parado na reta de cima (fração 'onde' dela) e a cena começando em T = 0
function novoMundo({ escala = 1, onde = 0.5, semente = 7, sessoes = 4, cena = epico.cena } = {}) {
  const m = new Mundo({ tema, semente });
  m.erros = [];
  m.aoErro = e => m.erros.push(e);
  m.receber({ ...estadoDeMentira('padrao', 'andando', { sessoes }), escala });
  const g = m.geometria();
  m.dist = (g.w - 2 * g.r) * onde;
  m.proxima = Infinity;
  m.comecarCena(cena(m));
  return m;
}
const telaDa = escala => new Tela(Math.round(380 * escala), Math.round(440 * escala));
// um quadro como o motor.js desenha (tela da janela inteira, na escala)
function quadro(m, tela, escala) {
  const g = tela.getContext('2d');
  tela.limpar();
  g.setTransform(escala, 0, 0, escala, 0, 0);
  g.globalAlpha = 1;
  m.desenhar(g);
}
const passo = (m, T) => { m.passo(T); m.proxima = Infinity; };

test('o módulo: linha do tempo e a cena no formato combinado (16 a 21 s, reta de cima, só andando)', () => {
  assert.ok(Array.isArray(epico.linhaDoTempo) && epico.linhaDoTempo.length >= 6);
  for (const [t, txt] of epico.linhaDoTempo) assert.ok(typeof t === 'number' && typeof txt === 'string' && txt.length);
  const m = novoMundo();
  const c = m.cena;
  assert.strictEqual(c.nome, 'epico');
  assert.ok(c.dur >= 16 && c.dur <= 21, `dur ${c.dur}`);
  assert.deepStrictEqual(c.espaco, { frente: 0, tras: 0 });
  assert.deepStrictEqual(c.modos, ['andando']);
  assert.strictEqual(typeof c.quadro, 'function');
});

test('a cena inteira, quadro a quadro (30/s), nas escalas 1, 1,25 e 2 e em 2 cartões: sem erro, pintando, e acaba', () => {
  for (const escala of [1, 1.25, 2]) {
    for (const { sessoes, onde } of [{ sessoes: 4, onde: 0.5 }, { sessoes: 8, onde: 0.1 }]) {
      const tela = telaDa(escala), m = novoMundo({ escala, sessoes, onde }), dur = m.cena.dur, onde_ = `escala ${escala}, ${sessoes} sessões`;
      let meio = 0;
      for (let n = 1; n / 30 < dur; n++) {
        passo(m, n / 30);
        assert.ok(m.cena && m.cena.nome === 'epico', `acabou antes da hora em ${n / 30} (${onde_})`);
        quadro(m, tela, escala);
        if (n === 150) meio = tela.pixels.filter(p => p !== 0).length;
      }
      assert.deepStrictEqual([m.erros, [...m.ruins]], [[], []], onde_);
      assert.ok(meio > 30000 * escala * escala, `a tela do fliperama pinta pouco no meio (${onde_}): ${meio}`);
      passo(m, dur + 0.05);
      assert.strictEqual(m.cena, null, `não terminou (${onde_})`);
    }
  }
});

test('mesmo instante = mesmos bytes, de quadro em quadro ou pulando direto pro instante', () => {
  for (const escala of [1, 1.25]) {
    const a = novoMundo({ escala }), dur = a.cena.dur, ta = telaDa(escala), tb = telaDa(escala);
    const instantes = [0.2, 0.7, 1.4, 3.3, 5.1, 8.4, 11.9, dur - 4.5, dur - 3.3, dur - 1.2, dur - 0.05].map(t => Math.round(t * 30) / 30);
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

test('custo por quadro na escala 1,25: mediana abaixo de 4 ms e pior abaixo de 12', (t) => {
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
    rodar(1);  // aquece o JIT e deixa prontos a tela, os escudos e as letras
    const ms = rodar(3).sort((a, b) => a - b);
    linhas.push(`semente ${semente} ${ms[ms.length >> 1].toFixed(2)}/${ms[ms.length - 1].toFixed(2)}`);
    todas = todas.concat(ms);
  }
  todas.sort((a, b) => a - b);
  const mediana = todas[todas.length >> 1], pior = todas[todas.length - 1];
  t.diagnostic(`ms por quadro (mediana/pior): ${linhas.join(', ')}; todas ${mediana.toFixed(2)}/${pior.toFixed(2)}, p95 ${todas[Math.floor(todas.length * 0.95)].toFixed(2)}`);
  assert.ok(mediana < 4, `mediana ${mediana.toFixed(2)} ms`);
  assert.ok(pior < 12, `pior quadro ${pior.toFixed(2)} ms`);
});

test('o último quadro é o Clawd normal, em pé, no lugar onde começou (e nada mais)', () => {
  const parado = () => ({ nome: 'parado', dur: 100, espaco: { frente: 0, tras: 0 }, modos: ['andando'], quadro(g) { desenhaClawd(g, {}); } });
  for (const escala of [1, 1.25, 2]) {
    for (const onde of [0.05, 0.5, 0.95]) {
      const m = novoMundo({ escala, onde }), dur = m.cena.dur, ref = novoMundo({ escala, onde, cena: parado });
      const ta = telaDa(escala), tb = telaDa(escala);
      for (let n = 1; n / 30 < dur; n++) passo(m, n / 30);
      passo(m, dur - 0.01);
      passo(ref, dur - 0.01);
      assert.deepStrictEqual([m.pose().x, m.pose().y], [ref.pose().x, ref.pose().y], 'o Mundo não andou com ele');
      quadro(m, ta, escala); quadro(ref, tb, escala);
      assert.ok(ta.bgra().equals(tb.bgra()), `escala ${escala}, onde ${onde}: o último quadro não é o Clawd parado`);
    }
  }
});

test('cortada no meio (pergunta): encerra sem erro e o tema volta a desenhar o Clawd', () => {
  const m = novoMundo({ escala: 1.25 }), tela = telaDa(1.25);
  for (let n = 1; n <= 9 * 30; n++) { passo(m, n / 30); quadro(m, tela, 1.25); }
  m.receber({ modo: 'pulando' });
  assert.strictEqual(m.cena, null);
  for (let n = 9 * 30 + 1; n <= 10 * 30; n++) { passo(m, n / 30); quadro(m, tela, 1.25); }
  assert.deepStrictEqual(m.erros, []);
});

test('o plano, em 150 sementes e 3 lugares da reta: todo bug morre, bomba não encosta, o Clawd não corre demais', () => {
  const VMAX = 105, durs = [];
  let semNave = 0;
  for (let s = 0; s < 50; s++) {
    for (const onde of [0.05, 0.5, 0.95]) {
      const m = novoMundo({ semente: 1000 + s, onde }), J = m.cena.plano, quem = `semente ${1000 + s}, onde ${onde}`;
      durs.push(m.cena.dur);
      assert.ok(m.cena.dur >= 16 && m.cena.dur <= 21, `dur ${m.cena.dur} (${quem})`);
      // todos os 18 morrem, um de cada vez, e o último é o tiro final
      const mortes = J.bugs.map(b => b.morte);
      assert.ok(mortes.every(t => t < J.tFinal + 1e-9), `sobrou bug (${quem})`);
      assert.strictEqual(J.acoes[J.acoes.length - 1].tipo, 'final', quem);
      assert.strictEqual(Math.max(...mortes), J.tFinal);
      assert.ok(J.tFinal > J.t17 + 1.5, `o último bug tem o momento dele (${quem})`);
      if (!J.chefeOk) semNave++;
      // o Clawd: dentro da tela, chega a tempo em cada tiro, sem passar de 1,5x a velocidade média
      for (const [t0, t1, x0, x1] of J.segs) {
        assert.ok(t1 >= t0 - 1e-9, quem);
        if (Math.abs(x1 - x0) > 0.01 && t1 > J.tFinal) continue;  // a volta pra casa
        assert.ok(Math.abs(x1 - x0) <= VMAX * (t1 - t0) + 1e-6, `rápido demais em ${t0.toFixed(2)} (${quem})`);
        if (t0 > 1) assert.ok(x1 >= J.xMin - 1e-9 && x1 <= J.xMax + 1e-9, `fora da tela (${quem})`);
      }
      // nenhuma bomba encosta no Clawd (corpo 27x15 e canhão), conferido aqui de novo
      const xEm = t => {
        let x = J.X0;
        for (const [t0, t1, x0, x1] of J.segs) {
          if (t < t0) break;
          if (t >= t1) { x = x1; continue; }
          const u = (t - t0) / (t1 - t0); x = x0 + (x1 - x0) * u * u * (3 - 2 * u);
        }
        return x;
      };
      for (const b of J.bombas) {
        for (let t = b.tb; t <= b.tI; t += 1 / 240) {
          const fundo = b.y0 + 10.5 + 95 * (t - b.tb), dx = Math.abs(b.x - xEm(t));
          if (fundo > -21) assert.ok(dx >= 6, `bomba no canhão em ${t.toFixed(2)} (${quem})`);
          if (fundo > -15) assert.ok(dx >= 15.75, `bomba no Clawd em ${t.toFixed(2)} (${quem})`);
        }
      }
    }
  }
  durs.sort((a, b) => a - b);
  assert.ok(semNave <= 6, `a nave escapou em ${semNave} de 150`);
});
