'use strict';
// motor/padrao-epico-kaiju.js: o evento épico BUG KAIJU do tema Padrão (19,2 s). A cena
// inteira quadro a quadro em 3 escalas e 3 lugares da reta, mesmo instante = mesmos bytes,
// o custo, e o fim com o Clawd normal no lugar onde começou.
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const kaiju = require(path.join(MOTOR, 'padrao-epico-kaiju'));
const { Tela } = require(path.join(MOTOR, 'raster'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const { desenhaClawd } = require(path.join(MOTOR, 'clawd'));
const tema = require(path.join(MOTOR, 'tema-padrao'));
const { estadoDeMentira } = require('../motor-foto');

const DUR = 19.2;
// o Clawd parado na reta de cima, na fração 'onde' dela, e a cena começando em T=0
function novoMundo({ escala = 1, onde = 0.5, sessoes = 4, semente = 7 } = {}) {
  const m = new Mundo({ tema, semente });
  m.erros = [];
  m.aoErro = e => m.erros.push(e);
  m.receber({ ...estadoDeMentira('padrao', 'andando', { sessoes }), escala });
  const g = m.geometria();
  m.dist = (g.w - 2 * g.r) * onde;
  m.proxima = Infinity;
  m.comecarCena(kaiju.cena(m));
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
const passo = (m, s) => { m.passo(s); m.proxima = Infinity; };  // sem parada sorteada no meio
const quadros = Array.from({ length: Math.round(DUR * 30) }, (_, n) => n / 30);

test('a cena no formato combinado com o tema e a linha do tempo', () => {
  const m = novoMundo();
  assert.ok(m.cena, 'a cena começou');
  assert.deepStrictEqual([m.cena.nome, m.cena.dur, m.cena.espaco, m.cena.modos], ['epico', DUR, { frente: 0, tras: 0 }, ['andando']]);
  assert.ok(DUR >= 16 && DUR <= 21);
  assert.ok(Array.isArray(kaiju.linhaDoTempo) && kaiju.linhaDoTempo.length > 8);
  kaiju.linhaDoTempo.forEach(([t, txt], i) => {
    assert.ok(t >= 0 && t <= DUR && typeof txt === 'string' && txt.length > 2, `item ${i}`);
    if (i) assert.ok(t >= kaiju.linhaDoTempo[i - 1][0], `fora de ordem: ${i}`);
  });
});

test('a cena inteira, quadro a quadro (30/s), nas escalas 1, 1,25 e 2, em 3 lugares da reta e 3 cartões: sem erro', () => {
  for (const escala of [1, 1.25, 2]) {
    const tela = telaDa(escala);
    for (const [onde, sessoes] of [[0.05, 4], [0.5, 1], [0.95, 8]]) {
      const m = novoMundo({ escala, onde, sessoes });
      let pintou = 0;
      for (const s of quadros) {
        passo(m, s);
        quadro(m, tela, escala);
        if (Math.abs(s - 12) < 1e-9) pintou = tela.pixels.filter(p => p !== 0).length;
      }
      const onde_ = `escala ${escala}, onde ${onde}, ${sessoes} sessões`;
      assert.deepStrictEqual([m.erros, [...m.ruins]], [[], []], onde_);
      assert.ok(m.cena && m.cena.nome === 'epico', `acabou antes da hora (${onde_})`);
      assert.ok(pintou > 40000 * escala * escala, `pintou pouco no meio da luta (${onde_}): ${pintou}`);
      passo(m, DUR + 0.05);
      assert.strictEqual(m.cena, null, `não terminou (${onde_})`);
    }
  }
});

test('mesmo instante = mesmos bytes (de quadro em quadro, de novo, ou pulando direto)', () => {
  const instantes = [3, 11, 63, 138, 171, 225, 297, 366, 438, 459, 507, 540, 573].map(n => quadros[n]);  // quadros: 0,1 s ... 19,1 s
  for (const escala of [1, 1.25]) {
    const a = novoMundo({ escala }), ta = telaDa(escala), tb = telaDa(escala);
    let i = 0;
    for (const s of quadros) {
      passo(a, s);
      if (s !== instantes[i]) continue;
      quadro(a, ta, escala);
      const b = novoMundo({ escala, semente: 7 });  // outro mundo, pulando direto pro instante
      passo(b, s);
      quadro(b, tb, escala);
      assert.ok(ta.bgra().equals(tb.bgra()), `t=${s}, escala ${escala}: pulando direto deu outro quadro`);
      quadro(a, tb, escala);  // o mesmo de novo
      assert.ok(ta.bgra().equals(tb.bgra()), `t=${s}, escala ${escala}: de novo deu outro quadro`);
      i++;
    }
    assert.strictEqual(i, instantes.length);
  }
});

test('custo em escala 1,25 e 2: mediana abaixo de 4 ms, pior abaixo de 12 ms (falha só em 16 / 48)', (t) => {
  for (const escala of [1.25, 2]) {
    const tela = telaDa(escala);
    const rodar = (vezes) => {
      const m = novoMundo({ escala, onde: 0.3 });
      return quadros.map(s => {
        passo(m, s);
        let melhor = Infinity;
        for (let k = 0; k < vezes; k++) {  // o menor de 3: a máquina oscila
          const a = process.hrtime.bigint();
          quadro(m, tela, escala);
          melhor = Math.min(melhor, Number(process.hrtime.bigint() - a) / 1e6);
        }
        return melhor;
      });
    };
    const frio = rodar(1)[0];  // a 1ª passada aquece o JIT e deixa prontos o céu, a cidade e as artes
    const ms = rodar(3), pior = Math.max(...ms), qual = quadros[ms.indexOf(pior)];
    ms.sort((a, b) => a - b);
    const mediana = ms[ms.length >> 1];
    t.diagnostic(`escala ${escala}: mediana ${mediana.toFixed(2)} ms, p95 ${ms[Math.floor(ms.length * 0.95)].toFixed(2)}, pior ${pior.toFixed(2)} (t=${qual.toFixed(2)}); 1º quadro frio ${frio.toFixed(2)}`);
    assert.ok(mediana < 16, `mediana ${mediana.toFixed(2)} ms (alvo 4)`);
    assert.ok(pior < 48, `pior quadro ${pior.toFixed(2)} ms (alvo 12)`);
  }
});

test('o último quadro é o Clawd normal, em pé, no lugar onde começou (nada sobra)', () => {
  for (const escala of [1, 1.25, 2]) {
    for (const onde of [0.05, 0.5, 0.95]) {
      const m = novoMundo({ escala, onde });
      const casa = m.pose();
      for (const s of quadros) passo(m, s);
      const fim = telaDa(escala);
      quadro(m, fim, escala);
      // o Clawd parado, desenhado sozinho na mesma pose
      const ref = telaDa(escala), g = ref.getContext('2d');
      g.setTransform(escala, 0, 0, escala, 0, 0);
      g.translate(casa.x, casa.y); g.rotate(casa.a);
      desenhaClawd(g, {});
      assert.ok(fim.bgra().equals(ref.bgra()), `escala ${escala}, onde ${onde}: o fim não é o Clawd parado no lugar`);
      const p = m.pose();
      assert.deepStrictEqual([p.x, p.y], [casa.x, casa.y], 'o Mundo não andou durante a cena');
    }
  }
});
