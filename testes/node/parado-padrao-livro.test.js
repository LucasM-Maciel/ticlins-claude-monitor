'use strict';
// motor/parado-padrao-livro.js: a cena de "parado há muito tempo" do Padrão (o Clawd lê a
// documentação, vira páginas e às vezes cochila). A entrada quadro a quadro e o laço até 3 h nas
// 3 escalas, o quadro como função do tempo, o custo, o sorteio das janelas (cochilos: os 3 tipos,
// nunca dois seguidos), a saída (cortando na entrada, lendo, virando a página e em cada cochilo)
// terminando no Clawd parado do tema, e nada em cima do conteúdo do cartão.
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const livro = require(path.join(MOTOR, 'parado-padrao-livro'));
const tema = require(path.join(MOTOR, 'tema-padrao'));
const { Tela } = require(path.join(MOTOR, 'raster'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const { layoutDe, rng } = require(path.join(MOTOR, 'comum'));
const { estadoDeMentira } = require('../motor-foto');

const ESCALAS = [1, 1.25, 2];
const HORAS3 = 3 * 3600;
const { J, T } = livro;
// parado no meio de cima do cartão, a cena começando em T=0
function novoMundo({ escala = 1, sessoes = 4, semente = 7 } = {}) {
  const m = new Mundo({ tema, semente });
  m.erros = [];
  m.aoErro = e => m.erros.push(e);
  m.receber({ ...estadoDeMentira('padrao', 'parado', { sessoes }), escala });
  m.comecarCena(livro.cena(m));
  return m;
}
const semDe = semente => Math.floor(rng(semente)() * 4294967296);  // a semente da cena (o 1º sorteio do Mundo)
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
// o 1º cochilo inteiro (a 2ª janela), quadro a quadro
const COCHILO = Array.from({ length: 30 * 30 }, (_, n) => T.ler + J + 8 + n / 30);
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
// sementes do Mundo em que a 2ª janela cochila de cada jeito
function sementeDoCochilo(tipo) {
  for (let s = 1; s < 500; s++) if (livro.plano(semDe(s), 1).soneca.tipo === tipo) return s;
  throw new Error('sem semente pro cochilo ' + tipo);
}

test('a cena no formato combinado: parado, até algo rodar, e a linha do tempo pra prévia', () => {
  const m = novoMundo();
  assert.ok(m.cena, 'a cena começou');
  assert.deepStrictEqual([m.cena.nome, m.cena.dur, m.cena.espaco, m.cena.modos], ['parado', Infinity, { frente: 0, tras: 0 }, ['parado']]);
  assert.deepStrictEqual(livro.texturas, []);
  assert.ok(livro.saida && livro.saida.dur > 0 && livro.saida.dur <= 1.2, 'saída de até 1,2 s');
  assert.ok(Array.isArray(livro.linhaDoTempo) && livro.linhaDoTempo.length >= 6);
  livro.linhaDoTempo.forEach(([t, txt], i) => {
    assert.ok(t >= 0 && typeof txt === 'string' && txt.length > 2, `item ${i}`);
    if (i) assert.ok(t >= livro.linhaDoTempo[i - 1][0], `fora de ordem: ${i}`);
  });
  // começa com o Clawd normal do tema, parado (sem pulo nenhum na troca)
  const casa = m.pose(), a = telaDa(1), b = telaDa(1);
  so(a, 1, casa, g => m.cena.quadro(g, 0, m));
  so(b, 1, casa, g => tema.clawd(g, m));
  assert.ok(a.bgra().equals(b.bgra()), 'o 1º quadro é o Clawd parado do tema');
});

test('o sorteio das janelas: páginas viradas sem atropelar o cochilo, cochilos de 3 jeitos, nunca dois seguidos', () => {
  const tipos = {};
  for (const semente of [7, 8, 9, 10, 11]) {
    const sem = semDe(semente);
    let antes = false, cochilos = 0;
    for (let k = 0; k < Math.ceil(HORAS3 / J); k++) {
      const pl = livro.plano(sem, k), c = pl.soneca;
      assert.strictEqual(pl.vira[0].t0, 0, `janela ${k}: começa virando a página`);
      for (let i = 1; i < pl.vira.length; i++) {
        const a = pl.vira[i - 1], b = pl.vira[i];
        assert.ok(b.t0 >= a.t0 + a.dur, `janela ${k}: viradas encavaladas`);
        if (c && b.t0 > c.c0) assert.ok(b.t0 >= (c.c5 ?? c.fim), `janela ${k}: virou a página dormindo`);
      }
      const ult = pl.vira[pl.vira.length - 1];
      assert.ok(ult.t0 + ult.dur <= J - 3, `janela ${k}: a última aberta fica pelo menos 3 s`);
      if (k === 1) assert.ok(c, 'a 2ª janela sempre cochila (a prévia mostra)');
      if (c) {
        cochilos++;
        tipos[c.tipo] = (tipos[c.tipo] || 0) + 1;
        assert.ok(!antes, `janela ${k}: dois cochilos seguidos`);
        assert.ok(c.c0 > 2 && c.fim < J - 4, `janela ${k}: o cochilo cabe na janela (${c.c0.toFixed(1)}–${c.fim.toFixed(1)})`);
        assert.ok(!pl.evento, `janela ${k}: cochilo e evento juntos`);
      }
      antes = !!c;
    }
    assert.ok(cochilos > 20 && cochilos < 90, `semente ${semente}: ${cochilos} cochilos em 3 h`);
  }
  assert.deepStrictEqual(Object.keys(tipos).sort(), ['abraca', 'afunda', 'quase'], 'os 3 jeitos de cochilar');
  // as 3 primeiras janelas: ideia, cochilo, marca-texto (a linha do tempo da prévia)
  const sem = semDe(7);
  assert.deepStrictEqual([livro.plano(sem, 0).evento.tipo, !!livro.plano(sem, 1).soneca, livro.plano(sem, 2).evento.tipo], ['ideia', true, 'marca']);
});

test('a entrada e o laço quadro a quadro (30/s) até 20 s, o 1º cochilo e amostras até 3 h, nas escalas 1, 1,25 e 2: sem erro', () => {
  for (const escala of ESCALAS) {
    for (const sessoes of [4, 1]) {
      const m = novoMundo({ escala, sessoes }), tela = telaDa(escala);
      for (const s of [...ENTRADA, ...COCHILO, ...AMOSTRAS]) {
        m.passo(s);
        quadro(m, tela, escala);
        if (Math.round(s * 30) % 15 === 0) assert.ok(cheia(tela), `quadro vazio em ${s.toFixed(2)} s`);
      }
      const onde = `escala ${escala}, ${sessoes} sessões`;
      assert.deepStrictEqual([m.erros, [...m.ruins]], [[], []], onde);
      assert.ok(m.cena && m.cena.nome === 'parado', `a cena acabou sozinha (${onde})`);
    }
  }
  // os outros dois jeitos de cochilar, quadro a quadro
  for (const tipo of ['afunda', 'quase', 'abraca']) {
    const m = novoMundo({ escala: 1.25, semente: sementeDoCochilo(tipo) }), tela = telaDa(1.25);
    for (const s of COCHILO) { m.passo(s); quadro(m, tela, 1.25); }
    assert.deepStrictEqual([m.erros, [...m.ruins]], [[], []], tipo);
  }
});

test('mesmo instante = mesmos bytes (quadro a quadro, pulando quadros, de novo e voltando no tempo)', () => {
  const instantes = [0.2, 0.5, 0.95, 3, 8.9, 11.9, 17.3, 53.4, 58.2, 64.9, 66, 400.5, HORAS3 - 0.3];
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
      for (let s = 0; s < t; s += t > 100 ? 50 : 1 / 7) b.passo(s);
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

test('custo em 1,25: mediana < 2 ms e pior < 8 ms por quadro (falha só em 8 / 32: o CI é mais lento; a entrada, o laço, o 1º cochilo e amostras até 3 h)', (t) => {
  const escala = 1.25, tela = telaDa(escala);
  const instantes = [...Array.from({ length: 30 * 30 }, (_, n) => n / 30), ...COCHILO, ...AMOSTRAS];
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
  t.diagnostic(`quadro inteiro em 1,25: mediana ${mediana.toFixed(2)} ms, p95 ${ms[Math.floor(ms.length * 0.95)].toFixed(2)}, pior ${pior.toFixed(2)} (t=${qual.toFixed(2)} s); 1º quadro frio ${frio.toFixed(2)}`);
  assert.ok(mediana < 8, `mediana ${mediana.toFixed(2)} ms (alvo 2)`);
  assert.ok(pior < 32, `pior quadro ${pior.toFixed(2)} ms (alvo 8)`);
});

test('a saída (cortada na entrada, lendo, virando a página, na ideia, no marca-texto e em cada cochilo) termina no Clawd parado do tema, no lugar', () => {
  const c1 = T.ler + J;  // a 2ª janela (o 1º cochilo começa em c1 + PRIMEIRA.cochilo)
  const cortes = [0.1, 0.4, 0.5, 0.7, 0.95, 1.1, 1.3, 3, 8.85, 8.95, 9.1, 11.8, 12.8, c1 + 12, c1 + 14.3, c1 + 15, c1 + 18, c1 + 23.4, c1 + 23.6, c1 + 24.3, c1 + 24.6, 92.0, 400.5, HORAS3];
  const sementes = { abraca: sementeDoCochilo('abraca'), afunda: sementeDoCochilo('afunda'), quase: sementeDoCochilo('quase') };
  for (const escala of ESCALAS) {
    for (const [tipo, semente] of Object.entries(sementes)) {
      for (const tc of cortes) {
        if (tipo !== 'abraca' && (tc < c1 || tc > c1 + 30)) continue;  // fora do cochilo: igual pros 3
        const m = novoMundo({ escala, semente }), casa = m.pose();
        for (let s = 0; s < tc; s += tc > 120 ? 30 : 1 / 30) m.passo(s);
        m.passo(tc);
        const tCorte = m.T - m.cena.t0;
        m.fimCena(true);  // algo voltou a rodar: o Mundo corta a cena e o tema toca a saída
        const tela = telaDa(escala), ref = telaDa(escala), D = livro.saida.dur, rect = conteudo(m, escala);
        for (let f = 0; f <= Math.round(D * 30); f++) {
          const u = Math.min(D, f / 30);
          so(tela, escala, casa, g => livro.saida.quadro(g, u, m, tCorte));
          const onde = `${tipo}, corte ${tc.toFixed(2)}, escala ${escala}, em ${u.toFixed(2)}`;
          assert.ok(cheia(tela), `${onde}: saída vazia`);
          assert.strictEqual(pintadoEm(tela, rect), null, `${onde}: a saída cobriu o cartão`);
        }
        so(ref, escala, casa, g => tema.clawd(g, m));
        assert.ok(tela.bgra().equals(ref.bgra()), `${tipo}, corte ${tc}, escala ${escala}: o fim não é o Clawd parado do tema`);
        assert.deepStrictEqual([m.pose().x, m.pose().y], [casa.x, casa.y], 'no mesmo lugar');
      }
    }
  }
  // pergunta no meio (modo pulando): o Mundo corta a cena e o tema desenha o Clawd pulando
  const p = novoMundo({ escala: 1.25 }), tela = telaDa(1.25);
  for (let s = 0; s < 9; s += 1 / 30) p.passo(s);
  p.receber({ modo: 'pulando' });
  assert.strictEqual(p.cena, null);
  for (let s = 9; s < 10; s += 1 / 30) { p.passo(s); quadro(p, tela, 1.25); }
  assert.deepStrictEqual([p.erros, [...p.ruins]], [[], []]);
});

test('nada desenhado em cima do conteúdo do cartão (a entrada, o laço e amostras até 3 h nas 3 escalas e cartões de 1 e 4 sessões; os 3 cochilos)', () => {
  const c1 = T.ler + J, laco = [...Array.from({ length: 100 * 10 }, (_, n) => n / 10), ...AMOSTRAS];
  const cochilo = Array.from({ length: 22 * 10 }, (_, n) => c1 + 8 + n / 10);
  const casos = [];
  for (const escala of ESCALAS) for (const sessoes of [4, 1]) casos.push({ escala, sessoes, tipo: 'abraca', instantes: laco });
  for (const escala of [1.25, 2]) for (const tipo of ['afunda', 'quase']) casos.push({ escala, sessoes: 4, tipo, instantes: cochilo });
  for (const { escala, sessoes, tipo, instantes } of casos) {
    const m = novoMundo({ escala, sessoes, semente: sementeDoCochilo(tipo) }), tela = telaDa(escala), casa = m.pose(), rect = conteudo(m, escala);
    // e nada longe do Clawd (fora de uma caixa de 60 px pros lados e 50 pra cima)
    const [x0, y0, x1] = [Math.floor((casa.x - 60) * escala), Math.floor((casa.y - 50) * escala), Math.ceil((casa.x + 60) * escala)];
    const longe = [[0, 0, tela.width, Math.max(0, y0)], [0, 0, Math.max(0, x0), tela.height], [Math.min(tela.width, x1), 0, tela.width, tela.height]];
    for (const s of instantes) {
      so(tela, escala, casa, g => m.cena.quadro(g, s, m));
      const onde = `${tipo}, escala ${escala}, ${sessoes} sessões, ${s.toFixed(1)} s`;
      assert.strictEqual(pintadoEm(tela, rect), null, `${onde}: pintou o conteúdo`);
      assert.ok(longe.every(r => !pintadoEm(tela, r)), `${onde}: desenhou longe do Clawd`);
    }
  }
});
