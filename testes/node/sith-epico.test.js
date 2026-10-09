'use strict';
// motor/sith-epico.js: o épico do tema Sith (a batalha da frota, a cada 30 droides).
// A cena inteira quadro a quadro em 3 escalas e 2 cartões, mesmo instante = mesmos bytes, o
// custo, o Clawd de volta no lugar no fim, a trilha, e o plano (pela semente) sempre dentro do
// palco: todo caça cai antes do gigante, o gigante e a nave cabem, nada nasce em cima do Clawd.
// Ver a olho: node testes/motor-foto.js --tema sith --cena epico --tira 2,4.75,10.4,11.9,15.2,17 --escala 1.25 --saida f.png
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const epico = require(path.join(MOTOR, 'sith-epico'));
const A = require(path.join(MOTOR, 'sith-arte'));
const { Tela } = require(path.join(MOTOR, 'raster'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const { lerWav } = require(path.join(MOTOR, 'som'));
const tema = require(path.join(MOTOR, 'tema-sith'));
const { estadoDeMentira } = require('../motor-foto');

const JANELINHA = path.join(MOTOR, '..');
// o Clawd parado na reta de cima (fração 'onde' dela) e a cena começando em T = 0
function novoMundo({ escala = 1, onde = 0.5, semente = 7, sessoes = 4, cena = epico.cena } = {}) {
  const m = new Mundo({ tema, semente });
  m.erros = [];
  m.aoErro = e => m.erros.push(e);
  m.receber({ ...estadoDeMentira('sith', 'andando', { sessoes }), escala });
  if (m.cena) m.fimCena(true);
  const g = m.geometria();
  m.dist = (g.w - 2 * g.r) * onde;
  m.proxima = Infinity;
  m.comecarCena(cena(m));
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

test('o módulo: linha do tempo e a cena no formato combinado (16 a 21 s, reta de cima, só andando)', () => {
  assert.ok(Array.isArray(epico.linhaDoTempo) && epico.linhaDoTempo.length >= 6);
  for (const [t, txt] of epico.linhaDoTempo) assert.ok(typeof t === 'number' && typeof txt === 'string' && txt.length);
  const c = novoMundo().cena;
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
      assert.ok(meio > 30000 * escala * escala, `o espaço pinta pouco no meio (${onde_}): ${meio}`);
      passo(m, dur + 0.05);
      assert.strictEqual(m.cena, null, `não terminou (${onde_})`);
    }
  }
});

test('mesmo instante = mesmos bytes, de quadro em quadro ou pulando direto pro instante', () => {
  for (const escala of [1, 1.25]) {
    const a = novoMundo({ escala }), dur = a.cena.dur, ta = telaDa(escala), tb = telaDa(escala);
    const instantes = [0.2, 1.4, 4.4, 4.75, 6.1, 9.9, 10.6, 11.9, 14.68, 15.5, 16.55, dur - 1.2, dur - 0.05].map(t => Math.round(t * 30) / 30);
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
    rodar(1);  // aquece o JIT e deixa prontos o céu, a nave e o planeta
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

test('o último quadro é o Clawd de sabre pronto (o fim das outras cenas do tema), no lugar onde começou', () => {
  const pronto = () => ({ nome: 'pronto', dur: 100, espaco: { frente: 0, tras: 0 }, modos: ['andando'], quadro(g, t, mundo) { A.clawdSith(g, { T: mundo.T, sabre: { ang: 25, len: 1 }, vento: 0.4 }); } });
  for (const escala of [1, 1.25, 2]) {
    for (const onde of [0.05, 0.5, 0.95]) {
      const m = novoMundo({ escala, onde }), dur = m.cena.dur, ref = novoMundo({ escala, onde, cena: pronto });
      const ta = telaDa(escala), tb = telaDa(escala);
      for (let n = 1; n / 30 < dur; n++) passo(m, n / 30);
      passo(m, dur - 0.01);
      passo(ref, dur - 0.01);
      assert.deepStrictEqual([m.pose().x, m.pose().y], [ref.pose().x, ref.pose().y], 'o Mundo não andou com ele');
      quadro(m, ta, escala); quadro(ref, tb, escala);
      assert.ok(ta.bgra().equals(tb.bgra()), `escala ${escala}, onde ${onde}: o último quadro não é o Clawd de sabre pronto`);
    }
  }
});

test('cortada no meio (pergunta): encerra sem erro e o tema volta a desenhar o Clawd', () => {
  const m = novoMundo({ escala: 1.25 }), tela = telaDa(1.25);
  for (let n = 1; n <= 11 * 30; n++) { passo(m, n / 30); quadro(m, tela, 1.25); }
  m.receber({ modo: 'pulando' });
  assert.strictEqual(m.cena, null);
  for (let n = 11 * 30 + 1; n <= 12 * 30; n++) { passo(m, n / 30); quadro(m, tela, 1.25); }
  assert.deepStrictEqual(m.erros, []);
});

test('a trilha: todo som existe, é WAV que o motor lê, cai dentro da cena e no volume dos outros épicos', () => {
  const c = novoMundo().cena;
  assert.ok(c.sons.length >= 20, `${c.sons.length} sons`);
  for (const [t, arquivo, ganho] of c.sons) {
    assert.ok(t >= 0 && t < c.dur, `${arquivo} em ${t}`);
    assert.ok(ganho > 0 && ganho <= 1, `${arquivo} ganho ${ganho}`);
    const f = path.join(JANELINHA, arquivo);
    assert.ok(fs.existsSync(f), `falta ${f}`);
    assert.ok(lerWav(fs.readFileSync(f)).amostras.length > 100, arquivo);
  }
  // cada caça que cai soa na hora em que cai; o estouro do gigante soa no estouro
  const quando = n => c.sons.filter(s => s[1] === `sons-sith/${n}.wav`).map(s => s[0]);
  assert.deepStrictEqual(quando('explode'), c.plano.cacas.map(f => f.th));
  assert.deepStrictEqual(quando('boom'), [epico.T.boom]);
});

test('o plano, em 50 sementes, 3 lugares da reta e 2 cartões: tudo dentro do palco e longe do Clawd', () => {
  const { T, SABRE, GW, GH, posCaca } = epico;
  for (let s = 0; s < 50; s++) {
    for (const onde of [0.05, 0.5, 0.95]) {
      for (const sessoes of [3, 8]) {
        const m = novoMundo({ semente: 1000 + s, onde, sessoes }), J = m.cena.plano, quem = `semente ${1000 + s}, onde ${onde}, ${sessoes} sessões`;
        const dentro = ([x, y], folga, o) => assert.ok(x >= folga && x <= J.cw - folga && y >= -J.HJ + folga && y <= -folga, `${o} fora do palco em ${x.toFixed(1)},${y.toFixed(1)} (${quem})`);
        assert.ok(J.X0 >= 0 && J.X0 <= J.cw, `o Clawd fora do cartão (${quem})`);
        // a nave cabe no palco, no alto
        assert.ok(J.nave.x >= 0 && J.nave.x + J.nave.w <= J.cw && J.nave.y >= -J.HJ, `a nave não cabe (${quem})`);
        // 5 caças pra torre e 3 que mergulham; todos caem dentro do palco, antes do gigante chegar
        assert.deepStrictEqual(['torre', 'mergulho'].map(k => J.cacas.filter(f => f.tipo === k).length), [5, 3], quem);
        for (const f of J.cacas) {
          assert.ok(f.th < T.gigante[0] - 0.3, `caça vivo quando o gigante chega (${quem})`);
          dentro(posCaca(f, f.th), 4, 'a explosão do caça');
          assert.ok(posCaca(f, f.th)[1] > J.barriga, `caça explode dentro da nave (${quem})`);
          if (f.tipo === 'mergulho') {
            dentro(posCaca(f, f.tf), 4, 'o tiro do mergulho');
            assert.ok(Math.abs(f.tb - f.tf - 0.32) < 1e-9 && Math.abs(f.th - f.tb - 0.2) < 1e-9, quem);
            assert.ok(posCaca(f, f.th)[1] < SABRE[1] - 20, `caça explode em cima do Clawd (${quem})`);
          }
        }
        // o gigante cabe, abaixo da nave, e não nasce em cima do Clawd
        const G = J.gigante;
        assert.ok(G.x - GW / 2 >= 0 && G.x + GW / 2 <= J.cw && G.y - GH / 2 >= J.barriga && G.y + GH / 2 <= 0, `o gigante não cabe (${quem})`);
        assert.ok(Math.abs(G.x - J.X0) >= GW / 2 + 8 || G.y + GH / 2 < -30, `o gigante em cima do Clawd (${quem})`);
      }
    }
  }
});
