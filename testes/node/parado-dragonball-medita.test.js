'use strict';
// motor/parado-dragonball-medita.js: a cena de "parado há muito tempo" do Dragon Ball (o Clawd
// medita flutuando). A entrada quadro a quadro e o laço até 3 h nas 3 escalas, o quadro como
// função do tempo, o custo, a saída (cortando na entrada, no laço e no meio do pulso das
// pedrinhas) terminando no Clawd do tema parado, e nada em cima do conteúdo do cartão.
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const medita = require(path.join(MOTOR, 'parado-dragonball-medita'));
const tema = require(path.join(MOTOR, 'tema-dragonball'));
const A = require(path.join(MOTOR, 'dragonball-arte'));
const { Tela } = require(path.join(MOTOR, 'raster'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const { layoutDe } = require(path.join(MOTOR, 'comum'));
const { estadoDeMentira } = require('../motor-foto');

const ESCALAS = [1, 1.25, 2];
const HORAS3 = 3 * 3600;
// parado no meio de cima do cartão, sem transformação, e a cena começando em T=0
function novoMundo({ escala = 1, sessoes = 4, semente = 7 } = {}) {
  const m = new Mundo({ tema, semente });
  m.erros = [];
  m.aoErro = e => m.erros.push(e);
  m.receber({ ...estadoDeMentira('dragonball', 'parado', { sessoes }), escala });
  m.estado.tr = null;
  m.comecarCena(medita.cena(m));
  return m;
}
const telaDa = escala => new Tela(Math.round(380 * escala), Math.round(440 * escala));
function quadro(m, tela, escala) {  // o quadro inteiro, como o motor.js
  const g = tela.getContext('2d');
  tela.limpar(); g.setTransform(escala, 0, 0, escala, 0, 0); g.globalAlpha = 1;
  m.desenhar(g);
  return tela;
}
function so(tela, escala, pose, desenha) {  // só o Clawd (cena, saída ou tema), no lugar dele
  const g = tela.getContext('2d');
  tela.limpar(); g.setTransform(escala, 0, 0, escala, 0, 0); g.globalAlpha = 1;
  g.translate(pose.x, pose.y); g.rotate(pose.a);
  desenha(g);
  return tela;
}
// instantes: a entrada e o laço quadro a quadro até 20 s, depois amostras até 3 h
const ENTRADA = Array.from({ length: 20 * 30 + 1 }, (_, n) => n / 30);
const AMOSTRAS = Array.from({ length: 60 }, (_, n) => 20 + (HORAS3 - 20) * ((n + 1) / 60) ** 2 + n * 0.37);
// o conteúdo do cartão (o que a janelinha escreve), em pixels da tela
function conteudo(m, escala) {
  const L = layoutDe(tema), [x, y, w, h] = m.host.cartao, [me, mc, md, mb] = L.moldura, [pe, pc, pd, pb] = L.padding;
  const x0 = x + me + pe, y0 = y + mc + pc, x1 = x + w - md - pd, y1 = y + h - mb - pb;
  return [Math.floor(x0 * escala), Math.floor(y0 * escala), Math.ceil(x1 * escala), Math.ceil(y1 * escala)];
}
function pintadoEm(tela, [x0, y0, x1, y1]) {
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (tela.pixels[y * tela.width + x] !== 0) return [x, y];
  return null;
}
const cheia = tela => tela.pixels.some(p => p !== 0);

test('a cena no formato combinado: parado, até algo rodar, e a linha do tempo pra prévia', () => {
  const m = novoMundo();
  assert.ok(m.cena, 'a cena começou');
  assert.deepStrictEqual([m.cena.nome, m.cena.dur, m.cena.espaco, m.cena.modos], ['parado', Infinity, { frente: 0, tras: 0 }, ['parado']]);
  assert.deepStrictEqual(medita.texturas, []);
  assert.ok(medita.saida && medita.saida.dur > 0 && medita.saida.dur <= 1.2, 'saída de até 1,2 s');
  assert.ok(Array.isArray(medita.linhaDoTempo) && medita.linhaDoTempo.length >= 6);
  medita.linhaDoTempo.forEach(([t, txt], i) => {
    assert.ok(t >= 0 && typeof txt === 'string' && txt.length > 2, `item ${i}`);
    if (i) assert.ok(t >= medita.linhaDoTempo[i - 1][0], `fora de ordem: ${i}`);
  });
  // começa com o Clawd normal do tema, parado (sem pulo nenhum na troca)
  const casa = m.pose(), a = telaDa(1), b = telaDa(1);
  so(a, 1, casa, g => m.cena.quadro(g, 0, m));
  so(b, 1, casa, g => tema.clawd(g, m));
  assert.ok(a.bgra().equals(b.bgra()), 'o 1º quadro é o Clawd parado do tema');
});

test('a entrada e o laço quadro a quadro (30/s) até 20 s e amostras até 3 h, nas escalas 1, 1,25 e 2: sem erro', () => {
  for (const escala of ESCALAS) {
    for (const sessoes of [4, 1]) {
      const m = novoMundo({ escala, sessoes }), tela = telaDa(escala);
      for (const s of [...ENTRADA, ...AMOSTRAS]) {
        m.passo(s);
        quadro(m, tela, escala);
        if (Math.round(s * 30) % 15 === 0) assert.ok(cheia(tela), `quadro vazio em ${s.toFixed(2)} s`);
      }
      const onde = `escala ${escala}, ${sessoes} sessões`;
      assert.deepStrictEqual([m.erros, [...m.ruins]], [[], []], onde);
      assert.ok(m.cena && m.cena.nome === 'parado', `a cena acabou sozinha (${onde})`);
    }
  }
  // transformado (o tema respeita a transformação: cabelo, crina, aura), e a volta ao normal no meio
  for (const id of ['ssj3', 'kaioken', 'instinto']) {
    const m = novoMundo({ escala: 1.25 }), tela = telaDa(1.25);
    m.estado.tr = { v: A.VAR[id], t0: -10, tv0: null, ate: 8 };
    for (let s = 0; s <= 12; s += 1 / 30) { m.passo(s); quadro(m, tela, 1.25); }
    assert.deepStrictEqual([m.erros, [...m.ruins]], [[], []], id);
    assert.strictEqual(m.estado.tr, null, `${id}: voltou ao normal meditando`);
  }
});

test('mesmo instante = mesmos bytes (quadro a quadro, pulando quadros, de novo e voltando no tempo)', () => {
  const instantes = [0.2, 0.7, 1.2, 3, 7.7, 14.6, 17.3, 20.9, 400.5, HORAS3 - 0.3];
  for (const escala of [1, 1.25]) {
    const a = novoMundo({ escala }), ta = telaDa(escala), tb = telaDa(escala);
    const guardados = [];
    let ant = 0;
    for (const t of instantes) {
      for (let s = ant; s < t; s += 1 / 30) a.passo(s);
      ant = t;
      a.passo(t);
      quadro(a, ta, escala);
      const b = novoMundo({ escala });  // outro mundo, pulando quadros (7/s) até o instante
      for (let s = 0; s < t; s += t > 60 ? 50 : 1 / 7) b.passo(s);
      b.passo(t);
      quadro(b, tb, escala);
      assert.ok(ta.bgra().equals(tb.bgra()), `t=${t}, escala ${escala}: pulando quadros deu outro quadro`);
      quadro(a, tb, escala);
      assert.ok(ta.bgra().equals(tb.bgra()), `t=${t}, escala ${escala}: de novo deu outro quadro`);
      guardados.push([t, Buffer.from(ta.bgra())]);
    }
    for (const [t, buf] of guardados.reverse()) {  // voltando no tempo
      a.passo(t);
      assert.ok(buf.equals(quadro(a, ta, escala).bgra()), `t=${t}, escala ${escala}: voltando no tempo deu outro quadro`);
    }
  }
});

test('custo em 1,25: mediana < 2 ms e pior < 8 ms por quadro (falha só em 8 / 32: o CI é mais lento) (a entrada, o laço com o pulso e amostras até 3 h)', (t) => {
  const escala = 1.25, tela = telaDa(escala);
  const instantes = [...Array.from({ length: 30 * 30 }, (_, n) => n / 30), ...AMOSTRAS];
  const rodar = vezes => {
    const m = novoMundo({ escala });
    return instantes.map(s => {
      m.passo(s);
      let melhor = Infinity;
      for (let k = 0; k < vezes; k++) {  // o menor de 3: a máquina oscila
        const ini = process.hrtime.bigint();
        quadro(m, tela, escala);
        melhor = Math.min(melhor, Number(process.hrtime.bigint() - ini) / 1e6);
      }
      return melhor;
    });
  };
  const frio = rodar(1)[0];  // aquece o JIT e deixa prontos os sprites (o 1º quadro)
  const ms = rodar(3), pior = Math.max(...ms), qual = instantes[ms.indexOf(pior)];
  ms.sort((x, y) => x - y);
  const mediana = ms[ms.length >> 1];
  t.diagnostic(`quadro inteiro (nuvem + enfeites + cena) em 1,25: mediana ${mediana.toFixed(2)} ms, p95 ${ms[Math.floor(ms.length * 0.95)].toFixed(2)}, pior ${pior.toFixed(2)} (t=${qual.toFixed(2)} s); 1º quadro frio ${frio.toFixed(2)}`);
  assert.ok(mediana < 8, `mediana ${mediana.toFixed(2)} ms (alvo 2)`);
  assert.ok(pior < 32, `pior quadro ${pior.toFixed(2)} ms (alvo 8)`);
});

test('a saída (cortada na entrada, no laço e no pulso): abre os olhos, desce e termina no Clawd parado do tema, no lugar', () => {
  const cortes = [0.1, 0.4, 0.68, 0.8, 1.2, 2.5, 4.4, 6.6, 14.9, 15.6, 17.5, 20.4, 21.6, 400.5, HORAS3];
  for (const escala of ESCALAS) {
    for (const tc of cortes) {
      const m = novoMundo({ escala }), casa = m.pose();
      for (let s = 0; s < tc; s += tc > 60 ? 30 : 1 / 30) m.passo(s);
      m.passo(tc);
      const tCorte = m.T - m.cena.t0;
      m.fimCena(true);  // algo voltou a rodar: o Mundo corta a cena e o tema toca a saída
      const tela = telaDa(escala), ref = telaDa(escala), D = medita.saida.dur;
      for (let f = 0; f <= Math.round(D * 30); f++) {
        const u = Math.min(D, f / 30);
        m.passo(tc + u);
        so(tela, escala, casa, g => medita.saida.quadro(g, u, m, tCorte));
        assert.ok(cheia(tela), `corte ${tc}, escala ${escala}: saída vazia em ${u.toFixed(2)}`);
        assert.strictEqual(pintadoEm(tela, conteudo(m, escala)), null, `corte ${tc}, escala ${escala}: a saída cobriu o cartão em ${u.toFixed(2)}`);
      }
      so(ref, escala, casa, g => tema.clawd(g, m));
      assert.ok(tela.bgra().equals(ref.bgra()), `corte ${tc}, escala ${escala}: o fim não é o Clawd parado do tema`);
      assert.deepStrictEqual([m.pose().x, m.pose().y], [casa.x, casa.y], 'no mesmo lugar');
    }
  }
  // transformado na hora do corte: termina com a transformação do tema (cabelo, crina, aura)
  const m = novoMundo({ escala: 1.25 }), casa = m.pose();
  for (let s = 0; s < 8; s += 1 / 30) m.passo(s);
  m.estado.tr = { v: A.VAR.ssj3, t0: m.T - 5, tv0: null, ate: m.T + 60 };
  m.passo(8);
  const tCorte = m.T - m.cena.t0;
  m.fimCena(true);
  m.passo(8 + medita.saida.dur);
  const fim = so(telaDa(1.25), 1.25, casa, g => medita.saida.quadro(g, medita.saida.dur, m, tCorte));
  const ref = so(telaDa(1.25), 1.25, casa, g => tema.clawd(g, m));
  assert.ok(fim.bgra().equals(ref.bgra()), 'transformado: o fim não é o Clawd do tema');
  // pergunta no meio (modo pulando): o Mundo corta a cena e o tema desenha o Clawd pulando
  const p = novoMundo({ escala: 1.25 }), tela = telaDa(1.25);
  for (let s = 0; s < 9; s += 1 / 30) p.passo(s);
  p.receber({ modo: 'pulando' });
  assert.strictEqual(p.cena, null);
  for (let s = 9; s < 10; s += 1 / 30) { p.passo(s); quadro(p, tela, 1.25); }
  assert.deepStrictEqual([p.erros, [...p.ruins]], [[], []]);
});

test('nada desenhado em cima do conteúdo do cartão (o laço inteiro, com os pulsos, nas 3 escalas e cartões de 1 e 4 sessões)', () => {
  const instantes = [...Array.from({ length: 70 * 10 }, (_, n) => n / 10), ...AMOSTRAS];
  for (const escala of ESCALAS) {
    for (const sessoes of [4, 1]) {
      const m = novoMundo({ escala, sessoes }), tela = telaDa(escala), casa = m.pose(), rect = conteudo(m, escala);
      let fora = 0;
      for (const s of instantes) {
        m.passo(s);
        so(tela, escala, casa, g => m.cena.quadro(g, s, m));
        assert.strictEqual(pintadoEm(tela, rect), null, `escala ${escala}, ${sessoes} sessões: pintou o conteúdo em ${s.toFixed(1)} s`);
        // e nada fora da janela
        const [x0, y0] = [Math.floor((casa.x - 60) * escala), Math.floor((casa.y - 70) * escala)];
        if (pintadoEm(tela, [0, 0, tela.width, Math.max(0, y0)]) || pintadoEm(tela, [0, 0, Math.max(0, x0), tela.height])) fora++;
      }
      assert.strictEqual(fora, 0, `escala ${escala}: desenhou longe do Clawd`);
    }
  }
});
