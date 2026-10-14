'use strict';
// motor/akatsuki-epico.js: o épico do lado Akatsuki (a fera de dez caudas, a cada 30 bugs).
// A cena inteira quadro a quadro em 3 escalas e 3 cartões, mesmo instante = mesmos bytes, o custo,
// o Clawd de volta no lugar no fim, a trilha, e o plano sempre dentro do palco: a fera cabe e
// mira o bug, e o Clawd fica longe do bug (se estava na ponta, pula pro meio e volta).
// Ver a olho: node testes/motor-foto.js --tema akatsuki --cena epico --tira 1.6,3.4,4.6,7.5,8.5,10.2 --escala 1.25 --saida f.png
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const epico = require(path.join(MOTOR, 'akatsuki-epico'));
const A = require(path.join(MOTOR, 'akatsuki-arte'));
const { Tela } = require(path.join(MOTOR, 'raster'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const { lerWav } = require(path.join(MOTOR, 'som'));
const tema = require(path.join(MOTOR, 'tema-akatsuki'));
const { estadoDeMentira } = require('../motor-foto');

const JANELINHA = path.join(MOTOR, '..');
// o Clawd parado na reta de cima (fração 'onde' dela) e a cena começando em T = 0;
// largura: outro cartão, mais estreito (o mesmo canto de baixo à direita)
function novoMundo({ escala = 1, onde = 0.5, semente = 7, sessoes = 4, largura = null, cena = epico.cena } = {}) {
  const m = new Mundo({ tema, semente });
  m.erros = [];
  m.aoErro = e => m.erros.push(e);
  const est = estadoDeMentira('akatsuki', 'andando', { sessoes });
  if (largura) { const [x, y, w, h] = est.cartao; est.cartao = [x + w - largura, y, largura, h]; }
  m.receber({ ...est, escala });
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
const CARTOES = [{ sessoes: 4, onde: 0.5 }, { sessoes: 8, onde: 0.1 }, { sessoes: 12, onde: 0.95, largura: 200 }];

test('o módulo: linha do tempo e a cena no formato combinado (10 a 14 s, reta de cima, só andando)', () => {
  assert.ok(Array.isArray(epico.linhaDoTempo) && epico.linhaDoTempo.length >= 6);
  for (const [t, txt] of epico.linhaDoTempo) assert.ok(typeof t === 'number' && typeof txt === 'string' && txt.length);
  const c = novoMundo().cena;
  assert.strictEqual(c.nome, 'epico');
  assert.ok(c.dur >= 10 && c.dur <= 14, `dur ${c.dur}`);
  assert.deepStrictEqual(c.espaco, { frente: 0, tras: 0 });
  assert.deepStrictEqual(c.modos, ['andando']);
  assert.strictEqual(typeof c.quadro, 'function');
});

test('a cena inteira, quadro a quadro (30/s), nas escalas 1, 1,25 e 2 e em 3 cartões: sem erro, pintando, e acaba', () => {
  for (const escala of [1, 1.25, 2]) {
    for (const cartao of CARTOES) {
      const tela = telaDa(escala), m = novoMundo({ escala, ...cartao }), dur = m.cena.dur, onde_ = `escala ${escala}, ${JSON.stringify(cartao)}`;
      let meio = 0;
      for (let n = 1; n / 30 < dur; n++) {
        passo(m, n / 30);
        assert.ok(m.cena && m.cena.nome === 'epico', `acabou antes da hora em ${n / 30} (${onde_})`);
        quadro(m, tela, escala);
        if (n === 150) meio = tela.pixels.filter(p => p !== 0).length;
      }
      assert.deepStrictEqual([m.erros, [...m.ruins]], [[], []], onde_);
      assert.ok(meio > 20000 * escala * escala, `o palco pinta pouco no meio (${onde_}): ${meio}`);
      passo(m, dur + 0.05);
      assert.strictEqual(m.cena, null, `não terminou (${onde_})`);
    }
  }
});

test('mesmo instante = mesmos bytes, de quadro em quadro ou pulando direto pro instante', () => {
  for (const escala of [1, 1.25]) {
    for (const onde of [0.5, 0.95]) {
      const a = novoMundo({ escala, onde }), dur = a.cena.dur, ta = telaDa(escala), tb = telaDa(escala);
      const instantes = [0.2, 1.0, 1.6, 3.0, 4.5, 5.1, 6.7, 8.3, 8.45, 9.3, 10.4, 10.8, dur - 0.05].map(t => Math.round(t * 30) / 30);
      let i = 0;
      for (let n = 1; n / 30 < dur && i < instantes.length; n++) {
        passo(a, n / 30);
        if (Math.abs(n / 30 - instantes[i]) > 1e-9) continue;
        quadro(a, ta, escala);
        const b = novoMundo({ escala, onde });  // b só existe no instante da foto
        passo(b, n / 30);
        quadro(b, tb, escala);
        assert.ok(ta.bgra().equals(tb.bgra()), `t=${instantes[i]}, escala ${escala}, onde ${onde}`);
        quadro(a, tb, escala);  // de novo, no mesmo instante
        assert.ok(ta.bgra().equals(tb.bgra()), `repetido, t=${instantes[i]}`);
        i++;
      }
      assert.strictEqual(i, instantes.length);
    }
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
    rodar(1);  // aquece o JIT e deixa prontos o céu, os morros e a fera
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

test('o último quadro é o Clawd de sempre (o fim das outras cenas do tema), no lugar onde começou', () => {
  const pronto = () => ({ nome: 'pronto', dur: 100, espaco: { frente: 0, tras: 0 }, modos: ['andando'], quadro(g, t, mundo) { A.clawdAkatsuki(g, { T: mundo.T }); } });
  for (const escala of [1, 1.25, 2]) {
    for (const onde of [0.05, 0.5, 0.95]) {
      const m = novoMundo({ escala, onde }), dur = m.cena.dur, ref = novoMundo({ escala, onde, cena: pronto });
      const ta = telaDa(escala), tb = telaDa(escala);
      for (let n = 1; n / 30 < dur; n++) passo(m, n / 30);
      passo(m, dur - 0.01);
      passo(ref, dur - 0.01);
      assert.deepStrictEqual([m.pose().x, m.pose().y], [ref.pose().x, ref.pose().y], 'o Mundo não andou com ele');
      quadro(m, ta, escala); quadro(ref, tb, escala);
      assert.ok(ta.bgra().equals(tb.bgra()), `escala ${escala}, onde ${onde}: o último quadro não é o Clawd de sempre`);
    }
  }
});

test('cortada no meio (pergunta): encerra sem erro e o tema volta a desenhar o Clawd', () => {
  for (const onde of [0.5, 0.95]) {
    const m = novoMundo({ escala: 1.25, onde }), tela = telaDa(1.25);
    for (let n = 1; n <= 7 * 30; n++) { passo(m, n / 30); quadro(m, tela, 1.25); }
    m.receber({ modo: 'pulando' });
    assert.strictEqual(m.cena, null);
    for (let n = 7 * 30 + 1; n <= 8 * 30; n++) { passo(m, n / 30); quadro(m, tela, 1.25); }
    assert.deepStrictEqual(m.erros, []);
  }
});

test('a trilha: todo som existe, é WAV que o motor lê, cai dentro da cena e no volume dos outros épicos', () => {
  const c = novoMundo().cena;
  assert.ok(c.sons.length >= 10, `${c.sons.length} sons`);
  for (const [t, arquivo, ganho] of c.sons) {
    assert.ok(t >= 0 && t < c.dur, `${arquivo} em ${t}`);
    assert.ok(ganho > 0 && ganho <= 1, `${arquivo} ganho ${ganho}`);
    const f = path.join(JANELINHA, arquivo);
    assert.ok(fs.existsSync(f), `falta ${f}`);
    assert.ok(lerWav(fs.readFileSync(f)).amostras.length > 100, arquivo);
  }
  // o rugido no rugido, o disparo no disparo, a explosão na explosão
  const quando = n => c.sons.filter(s => s[1] === `sons-akatsuki/${n}.wav`).map(s => s[0]);
  assert.deepStrictEqual(quando('rugido'), [epico.T.ruge[0]]);
  assert.deepStrictEqual(quando('disparo'), [epico.T.tiro[0]]);
  assert.deepStrictEqual(quando('explosao'), [epico.T.explode]);
});

test('o plano, em 3 lugares da reta e 4 cartões: a fera cabe e mira o bug, e o Clawd fica longe do bug', () => {
  const { T, feraEm, naFera, OLHO, BOCA, clawdEm } = epico;
  for (const onde of [0.05, 0.3, 0.5, 0.75, 0.95]) {
    for (const cartao of [{ sessoes: 3 }, { sessoes: 8 }, { sessoes: 12 }, { sessoes: 4, largura: 200 }]) {
      const m = novoMundo({ onde, ...cartao }), J = m.cena.plano, quem = `onde ${onde}, ${JSON.stringify(cartao)}`;
      assert.ok(J.X0 >= 0 && J.X0 <= J.cw, `o Clawd fora do cartão (${quem})`);
      // em pé (fera inteira de fora): o topo dos chifres cabe, o olho e a boca dentro do palco
      const F = feraEm(J, T.olho[1] + 0.1), [ox, oy] = naFera(F, OLHO), [bx, by] = naFera(F, BOCA);
      assert.ok(F.y - J.TH >= -J.HJ, `os chifres saem do palco (${quem})`);
      for (const [x, y, o] of [[ox, oy, 'o olho'], [bx, by, 'a boca']]) assert.ok(x > 0 && x < J.cw && y > -J.HJ && y < 0, `${o} fora do palco (${quem})`);
      // escondida no começo e no fim (atrás dos morros)
      for (const t of [0, T.dur]) assert.ok(feraEm(J, t).y - J.TH >= 0, `a fera aparece em ${t} s (${quem})`);
      // o bug: inteiro no palco (com o recuo do susto) e à direita da boca
      assert.ok(J.bugX + J.BW / 2 + 6 <= J.cw && bx < J.bugX - J.BW / 2, `o bug (${quem})`);
      // o Clawd: longe do bug a cena toda, e no fim de volta onde estava
      for (let t = 0; t <= T.dur; t += 0.05) {
        const c = clawdEm(J, t);
        assert.ok(c.x + 13.5 <= J.bugX - J.BW / 2 - 8 || t < T.vai[1] || t >= T.volta[0], `o Clawd em cima do bug em ${t.toFixed(2)} s (${quem})`);
      }
      assert.deepStrictEqual([clawdEm(J, 0).x, clawdEm(J, T.dur).x, clawdEm(J, T.dur).y], [J.X0, J.X0, 0], quem);
      if (J.aqui === J.X0) for (let t = 0; t < T.dur; t += 0.05) assert.strictEqual(clawdEm(J, t).x, J.X0, `longe do bug: não sai do lugar (${quem})`);
    }
  }
});
