'use strict';
// motor/parado-padrao-dorme.js: o dorme do tema Padrão com a bolha no nariz e os sonhos de dev.
// A entrada quadro a quadro e o laço até 3 h nas 3 escalas, o quadro como função do tempo, o
// custo, o sorteio das janelas (bolha/sonho alternando, os 5 sonhos, estouros), a saída
// (cortando na entrada, na bolha, no estouro, no sonho e no laço) terminando no Clawd do tema
// parado, e nada em cima do conteúdo do cartão.
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const dorme = require(path.join(MOTOR, 'parado-padrao-dorme'));
const tema = require(path.join(MOTOR, 'tema-padrao'));
const { Tela } = require(path.join(MOTOR, 'raster'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const { layoutDe } = require(path.join(MOTOR, 'comum'));
const { estadoDeMentira } = require('../motor-foto');

const ESCALAS = [1, 1.25, 2];
const HORAS3 = 3 * 3600;
const { evento, eventoEm, LACO, JAN } = dorme._teste;
// parado no meio de cima do cartão e a cena começando em T=0
function novoMundo({ escala = 1, sessoes = 4, semente = 7 } = {}) {
  const m = new Mundo({ tema, semente });
  m.erros = [];
  m.aoErro = e => m.erros.push(e);
  m.receber({ ...estadoDeMentira('padrao', 'parado', { sessoes }), escala });
  m.comecarCena(dorme.cena(m));
  return m;
}
const semDe = m => m.estado.dormeSemente;
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
// os eventos (bolha/sonho) das janelas até 'ate' s
function eventos(sem, ate) {
  const lista = [];
  for (let k = 0; LACO + k * JAN < ate; k++) { const ev = evento(sem, k); if (ev) lista.push({ k, ...ev }); }
  return lista;
}
// instantes: a entrada e o laço quadro a quadro até 30 s (o 1º estouro e o 1º sonho), depois
// amostras até 3 h
const ENTRADA = Array.from({ length: 30 * 30 + 1 }, (_, n) => n / 30);
const AMOSTRAS = Array.from({ length: 60 }, (_, n) => 30 + (HORAS3 - 30) * ((n + 1) / 60) ** 2 + n * 0.37);
// o conteúdo do cartão (o que a janelinha escreve), em pixels da tela
function conteudo(m, escala) {
  const L = layoutDe(tema), [x, y, w, h] = m.host.cartao, [me, mc, md, mb] = L.moldura, [pe, pc, pd, pb] = L.padding;
  const x0 = x + me + pe, y0 = y + mc + pc, x1 = x + w - md - pd, y1 = y + h - mb - pb;
  return [Math.floor(x0 * escala), Math.floor(y0 * escala), Math.ceil(x1 * escala), Math.ceil(y1 * escala)];
}
// o 1º pixel pintado no retângulo (ou null); compara linha a linha com zeros (memcmp: rápido)
const ZEROS = Buffer.alloc(4 * 2048);
function pintadoEm(tela, [x0, y0, x1, y1]) {
  const W = tela.width, px = tela.pixels;
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(W, x1); y1 = Math.min(tela.height, y1);
  if (x1 <= x0) return null;
  const n = 4 * (x1 - x0), zero = ZEROS.subarray(0, n);
  for (let y = y0; y < y1; y++) {
    if (Buffer.from(px.buffer, px.byteOffset + 4 * (y * W + x0), n).equals(zero)) continue;
    for (let x = x0; x < x1; x++) if (px[y * W + x] !== 0) return [x, y];
  }
  return null;
}
const cheia = tela => tela.pixels.some(p => p !== 0);

test('a cena no formato combinado: parado, até algo rodar, e a linha do tempo pra prévia', () => {
  const m = novoMundo();
  assert.ok(m.cena, 'a cena começou');
  assert.deepStrictEqual([m.cena.nome, m.cena.dur, m.cena.espaco, m.cena.modos], ['parado', Infinity, { frente: 0, tras: 0 }, ['parado']]);
  assert.deepStrictEqual(dorme.texturas, []);
  assert.strictEqual(dorme.saida.dur, 0.6, 'a saída dura o mesmo que o acordar de hoje (ACORDA)');
  assert.ok(Array.isArray(dorme.linhaDoTempo) && dorme.linhaDoTempo.length >= 6);
  dorme.linhaDoTempo.forEach(([t, txt], i) => {
    assert.ok(t >= 0 && typeof txt === 'string' && txt.length > 2, `item ${i}`);
    if (i) assert.ok(t >= dorme.linhaDoTempo[i - 1][0], `fora de ordem: ${i}`);
  });
  // começa com o Clawd normal do tema, parado (sem pulo nenhum na troca)
  const casa = m.pose(), a = telaDa(1), b = telaDa(1);
  so(a, 1, casa, g => m.cena.quadro(g, 0, m));
  so(b, 1, casa, g => tema.clawd(g, m));
  assert.ok(a.bgra().equals(b.bgra()), 'o 1º quadro é o Clawd parado do tema');
});

test('o laço: bolha e sonho alternando em janelas, os 5 sonhos, estouros de vez em quando (sem contador)', () => {
  for (const semente of [7, 8, 9, 10, 11]) {
    const m = novoMundo({ semente }), sem = semDe(m), evs = eventos(sem, HORAS3);
    // a 1ª bolha estoura (o quase-acordar) e o 1º sonho é o bug: o que a prévia mostra primeiro
    assert.deepStrictEqual([evs[0].k, evs[0].tipo, evs[0].estoura, evs[1].k, evs[1].tipo, evs[1].qual], [0, 'bolha', true, 1, 'sonho', 'bug'], `semente ${semente}`);
    for (const ev of evs) {
      assert.strictEqual(ev.tipo, ev.k % 2 ? 'sonho' : 'bolha', 'pares = bolha, ímpares = sonho');
      assert.ok(ev.t0 >= LACO + ev.k * JAN + 1 && ev.fim <= LACO + (ev.k + 1) * JAN, `o evento ${ev.k} cabe na janela dele`);
    }
    const sonhos = evs.filter(e => e.tipo === 'sonho'), bolhas = evs.filter(e => e.tipo === 'bolha');
    assert.deepStrictEqual([...new Set(sonhos.map(e => e.qual))].sort(), ['bug', 'cafe', 'foguete', 'tarefas', 'teste']);
    for (let i = 1; i < sonhos.length; i++) {
      if (sonhos[i].k - sonhos[i - 1].k === 2) assert.notStrictEqual(sonhos[i].qual, sonhos[i - 1].qual, `o mesmo sonho 2 vezes seguidas (janela ${sonhos[i].k})`);
    }
    // os 5 aparecem logo: nos 5 primeiros sonhos (sem janela vazia no meio), um de cada
    const primeiros = sonhos.filter(e => e.k < 10).map(e => e.qual);
    assert.strictEqual(new Set(primeiros).size, primeiros.length, `repetiu no 1º bloco: ${primeiros}`);
    const estouros = bolhas.filter(b => b.estoura).length / bolhas.length, nada = 1 - evs.length / Math.ceil((HORAS3 - LACO) / JAN);
    assert.ok(estouros > 0.25 && estouros < 0.6, `estouram ${estouros.toFixed(2)} das bolhas`);
    assert.ok(nada > 0.05 && nada < 0.3, `${nada.toFixed(2)} das janelas só com z z z`);
  }
});

test('a entrada e o laço quadro a quadro (30/s) até 30 s e amostras até 3 h, nas escalas 1, 1,25 e 2: sem erro', () => {
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
  // todos os sonhos e um estouro inteiros, quadro a quadro, numa semente qualquer
  const m = novoMundo({ escala: 1.25, semente: 3 }), tela = telaDa(1.25), vistos = new Set();
  for (const ev of eventos(semDe(m), 1200)) {
    if (vistos.has(ev.qual || ev.estoura)) continue;
    vistos.add(ev.qual || ev.estoura);
    for (let s = ev.t0 - 1; s < ev.fim + 1; s += 1 / 30) { m.passo(s); quadro(m, tela, 1.25); }
  }
  assert.strictEqual(vistos.size, 7, 'os 5 sonhos, bolha que estoura e bolha que não estoura');
  assert.deepStrictEqual([m.erros, [...m.ruins]], [[], []]);
});

test('mesmo instante = mesmos bytes (quadro a quadro, pulando quadros, de novo e voltando no tempo)', () => {
  const instantes = [0.2, 0.7, 1.2, 3, 5.3, 8.4, 8.6, 9.3, 22.5, 24, 26.9, 400.5, HORAS3 - 0.3];
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

test('custo em 1,25: mediana < 2 ms e pior < 8 ms por quadro (falha só em 8 / 32: o CI é mais lento; a entrada, o estouro, o sonho e amostras até 3 h)', (t) => {
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
  t.diagnostic(`quadro inteiro (cena) em 1,25: mediana ${mediana.toFixed(2)} ms, p95 ${ms[Math.floor(ms.length * 0.95)].toFixed(2)}, pior ${pior.toFixed(2)} (t=${qual.toFixed(2)} s); 1º quadro frio ${frio.toFixed(2)}`);
  assert.ok(mediana < 8, `mediana ${mediana.toFixed(2)} ms (alvo 2)`);
  assert.ok(pior < 32, `pior quadro ${pior.toFixed(2)} ms (alvo 8)`);
});

test('a saída (cortada na entrada, na bolha, no estouro, no sonho e no laço): espreguiça e termina no Clawd parado do tema, no lugar', () => {
  const m0 = novoMundo(), evs = eventos(semDe(m0), 200);
  const bolha = evs.find(e => e.tipo === 'bolha' && !e.estoura), estoura = evs[0], sonho = evs[1];
  const cortes = [
    0.1, 0.27, 0.4, 0.68, 1.5, 2.9,
    bolha.t0 + 0.9, bolha.t0 + 2.4,                                         // bolha cheia, bolha murcha
    estoura.tp - 0.2, estoura.tp - 0.01, estoura.tp + 0.03, estoura.tp + 0.2,  // tremendo, estourando, respingo
    estoura.tp + 0.6, estoura.tp + 1.5, estoura.tp + 2.1,                      // quase acordado, '!', dormindo de novo
    sonho.t0 + 0.05, sonho.t0 + 0.35, sonho.t0 + 2, sonho.fim - 0.3, sonho.fim - 0.05,
    400.5, HORAS3,
  ];
  for (const escala of ESCALAS) {
    for (const tc of cortes) {
      const m = novoMundo({ escala }), casa = m.pose();
      for (let s = 0; s < tc; s += tc > 60 ? 30 : 1 / 30) m.passo(s);
      m.passo(tc);
      const tCorte = m.T - m.cena.t0;
      m.fimCena(true);  // algo voltou a rodar: o Mundo corta a cena e o tema toca a saída
      const tela = telaDa(escala), ref = telaDa(escala), D = dorme.saida.dur;
      for (let f = 0; f <= Math.round(D * 30); f++) {
        const u = Math.min(D, f / 30);
        m.passo(tc + u);
        so(tela, escala, casa, g => dorme.saida.quadro(g, u, m, tCorte));
        assert.ok(cheia(tela), `corte ${tc}, escala ${escala}: saída vazia em ${u.toFixed(2)}`);
        assert.strictEqual(pintadoEm(tela, conteudo(m, escala)), null, `corte ${tc}, escala ${escala}: a saída cobriu o cartão em ${u.toFixed(2)}`);
        // o que estava no ar some antes de 0,45 s: dali pra frente é só o Clawd espreguiçando
        if (u >= 0.45) {
          so(ref, escala, casa, g => dorme.saida.quadro(g, u, { estado: {} }, 0));
          assert.ok(tela.bgra().equals(ref.bgra()), `corte ${tc}, escala ${escala}: sobrou coisa em ${u.toFixed(2)}`);
        }
      }
      so(ref, escala, casa, g => tema.clawd(g, m));
      assert.ok(tela.bgra().equals(ref.bgra()), `corte ${tc}, escala ${escala}: o fim não é o Clawd parado do tema`);
      assert.deepStrictEqual([m.pose().x, m.pose().y], [casa.x, casa.y], 'no mesmo lugar');
    }
  }
  // a espreguiçada é a de hoje (o acordar do tema): sy = 1 + 0,1·sen(π·u/0,3) e em pé
  const m = novoMundo(), casa = m.pose(), a = telaDa(1.25), b = telaDa(1.25);
  for (const u of [0, 0.05, 0.15, 0.29, 0.31, 0.5]) {
    so(a, 1.25, casa, g => dorme.saida.quadro(g, u, m, 0.1));
    so(b, 1.25, casa, g => require(path.join(MOTOR, 'clawd')).desenhaClawd(g, { sy: u < 0.3 ? 1 + 0.1 * Math.sin(Math.PI * u / 0.3) : 1 }));
    assert.ok(a.bgra().equals(b.bgra()), `espreguiçada diferente em ${u}`);
  }
  // pergunta no meio (modo pulando): o Mundo corta a cena e o tema desenha o Clawd pulando
  for (const tc of [estoura.tp + 0.1, sonho.t0 + 2]) {
    const p = novoMundo({ escala: 1.25 }), tela = telaDa(1.25);
    for (let s = 0; s < tc; s += 1 / 30) p.passo(s);
    p.receber({ modo: 'pulando' });
    assert.strictEqual(p.cena, null);
    for (let s = tc; s < tc + 1; s += 1 / 30) { p.passo(s); quadro(p, tela, 1.25); }
    assert.deepStrictEqual([p.erros, [...p.ruins]], [[], []]);
  }
});

test('nada desenhado em cima do conteúdo do cartão (o laço inteiro, com bolhas e sonhos, nas 3 escalas e cartões de 1 e 4 sessões)', () => {
  const instantes = [...Array.from({ length: 80 * 10 }, (_, n) => n / 10), ...AMOSTRAS];
  for (const escala of ESCALAS) {
    for (const sessoes of [4, 1]) {
      const m = novoMundo({ escala, sessoes }), tela = telaDa(escala), casa = m.pose(), rect = conteudo(m, escala);
      // e os eventos inteiros de uma semente que tem todos (quadro a quadro, 15/s)
      const extra = [];
      for (const ev of eventos(semDe(m), 400)) for (let s = ev.t0; s < ev.fim; s += 1 / 15) extra.push(s);
      let fora = 0;
      for (const s of [...instantes, ...extra]) {
        m.passo(s);
        so(tela, escala, casa, g => m.cena.quadro(g, s, m));
        assert.strictEqual(pintadoEm(tela, rect), null, `escala ${escala}, ${sessoes} sessões: pintou o conteúdo em ${s.toFixed(2)} s`);
        // e nada longe dele (o balão fica até 70 px acima e 60 px pros lados)
        const [x0, y0, x1] = [Math.floor((casa.x - 60) * escala), Math.floor((casa.y - 70) * escala), Math.ceil((casa.x + 60) * escala)];
        if (pintadoEm(tela, [0, 0, tela.width, Math.max(0, y0)]) || pintadoEm(tela, [0, 0, Math.max(0, x0), tela.height]) || pintadoEm(tela, [x1, 0, tela.width, tela.height])) fora++;
      }
      assert.strictEqual(fora, 0, `escala ${escala}: desenhou longe do Clawd`);
    }
  }
  // e nunca abaixo da borda de cima do cartão (y > 0 no referencial dele): nem o respingo
  const m = novoMundo({ escala: 1 }), tela = telaDa(1), casa = m.pose();
  for (const ev of eventos(semDe(m), 2000).filter(e => e.estoura)) {
    for (let s = ev.tp - 0.4; s < ev.tp + 0.6; s += 1 / 60) {
      so(tela, 1, casa, g => m.cena.quadro(g, s, m));
      assert.strictEqual(pintadoEm(tela, [0, Math.ceil(casa.y) + 1, tela.width, tela.height]), null, `respingo no cartão em ${s.toFixed(2)}`);
    }
  }
  assert.ok(eventoEm, 'eventoEm exportado');
});
