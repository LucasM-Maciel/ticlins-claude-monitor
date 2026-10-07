'use strict';
// motor/parado-dragonball-treino.js: a cena de "parado há muito tempo" do Dragon Ball (treino:
// flexões, abdominais e socos com o contador em cima, suor, descanso). No tema de verdade
// (Mundo + tema-dragonball.js + cartão de mentira): a entrada quadro a quadro e o laço por horas
// nas 3 escalas, o quadro como função do tempo, o custo, a saída terminando no Clawd parado do
// tema e nada em cima do texto do cartão.
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const { Tela } = require(path.join(MOTOR, 'raster'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const { layoutDe } = require(path.join(MOTOR, 'comum'));
const tema = require(path.join(MOTOR, 'tema-dragonball'));
const P = require(path.join(MOTOR, 'parado-dragonball-treino'));
const { estadoDeMentira } = require('../motor-foto');

const ESCALAS = [1, 1.25, 2];
const HORAS3 = 3 * 3600;
// um Mundo parado com a cena começando em T = 0
function montar({ escala = 1, semente = 5, sessoes = 4 } = {}) {
  const m = new Mundo({ tema, semente });
  const erros = [];
  m.aoErro = e => erros.push(e);
  m.receber({ ...estadoDeMentira('dragonball', 'parado', { sessoes }), escala });
  m.comecarCena(P.cena(m));
  assert.strictEqual(m.cena && m.cena.nome, 'parado', 'a cena começou');
  const tela = new Tela(Math.round(380 * escala), Math.round(440 * escala)), g = tela.getContext('2d');
  const limpa = () => { tela.limpar(); g.setTransform(escala, 0, 0, escala, 0, 0); g.globalAlpha = 1; };
  // o quadro inteiro, como o motor desenha (enfeites do tema + a cena)
  const quadro = T => { m.passo(T); limpa(); m.desenhar(g); return tela; };
  // só a cena (ou outra coisa no lugar do Clawd), na pose dele; T = null: sem andar o relógio
  const noLugar = (T, desenha) => {
    if (T != null) m.passo(T);
    limpa();
    const p = m.pose();
    g.save(); g.translate(p.x, p.y); g.rotate(p.a); desenha(g); g.restore();
    return tela;
  };
  const cena = T => noLugar(T, k => m.cena.quadro(k, m.T - m.cena.t0, m));
  return { m, erros, tela, g, quadro, cena, noLugar, escala };
}
const cheia = tela => tela.pixels.some(p => p !== 0);
const bytes = tela => Buffer.from(tela.bgra());
// o primeiro bloco (série) de cada exercício e o primeiro descanso com o ki, pela semente da cena
function blocosPorExercicio(semente) {
  const achados = {};
  for (let k = 0; Object.keys(achados).length < 4 && k < 200; k++) {
    const b = P.bloco(semente, k);
    if (!(b.ex in achados)) achados[b.ex] = k;
    if (b.alonga === 'ki' && !('ki' in achados)) achados.ki = k;
  }
  assert.deepStrictEqual(Object.keys(achados).sort(), ['abdominal', 'flexao', 'ki', 'soco']);
  return achados;
}
// o retângulo do conteúdo do cartão (o texto), em px da tela
function conteudo(m, escala) {
  const [x, y, w, h] = m.host.cartao, L = layoutDe(tema), [me, mc, md, mb] = L.moldura, [pe, pc, pd, pb] = L.padding;
  return [x + me + pe, y + mc + pc, w - me - pe - pd - md, h - mc - pc - pb - mb].map(v => v * escala);
}
function nadaDentro(tela, [x, y, w, h]) {
  const x0 = Math.ceil(x), y0 = Math.ceil(y), x1 = Math.floor(x + w), y1 = Math.floor(y + h);
  for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) if (tela.pixels[py * tela.width + px] !== 0) return `${px},${py}`;
  return null;
}

test('o contrato: texturas, linha do tempo, cena infinita só parado, saída curta', () => {
  assert.deepStrictEqual(P.texturas, []);
  assert.ok(P.linhaDoTempo.length >= 4 && P.linhaDoTempo.every(([t, s]) => typeof t === 'number' && typeof s === 'string'));
  const { m } = montar();
  const c = P.cena(m);
  assert.strictEqual(c.nome, 'parado');
  assert.strictEqual(c.dur, Infinity);
  assert.deepStrictEqual(c.modos, ['parado']);
  assert.deepStrictEqual(c.espaco, { frente: 0, tras: 0 });
  assert.ok(P.saida.dur > 0 && P.saida.dur <= 1.2);
  // o contador recomeça a cada série: até 3 h e meia, sempre 2 algarismos; flexão a cada 2 séries
  // e as outras trocam (abdominal ou soco); toda série tem descanso
  const vistos = new Set();
  for (let k = 0; k * P.BLOCO < HORAS3 + 1800; k++) {
    const b = P.bloco(c.semente, k);
    vistos.add(b.ex);
    assert.ok(b.reps >= 4 && b.reps <= 99, `bloco ${k}: ${b.reps} repetições`);
    assert.strictEqual(b.ex === 'flexao', k % 2 === 0, `bloco ${k}: ${b.ex}`);
    assert.ok(P.BLOCO - b.descanso >= 6, `bloco ${k}: descanso de ${(P.BLOCO - b.descanso).toFixed(1)} s`);
  }
  assert.deepStrictEqual([...vistos].sort(), ['abdominal', 'flexao', 'soco']);
});

test('entrada e laço: 0–20 s quadro a quadro, uma série de cada exercício inteira e amostras até 3 h, nas escalas 1, 1,25 e 2', () => {
  for (const escala of ESCALAS) {
    const { m, erros, tela, quadro } = montar({ escala });
    for (let f = 0; f <= 20 * 30; f++) {
      quadro(f / 30);
      if (f % 15 === 0) assert.ok(cheia(tela), `@ ${escala}: quadro ${f} vazio`);
    }
    // uma série inteira de cada exercício (entra, repetições, levanta, descanso) e um descanso com o
    // ki, a 30/s em 1,25;
    // nas outras escalas, a 7/s
    const passo = escala === 1.25 ? 1 / 30 : 1 / 7;
    for (const k of Object.values(blocosPorExercicio(m.cena.semente))) {
      const t0 = P.INICIO + k * P.BLOCO;
      for (let t = t0 - 0.5; t < t0 + P.BLOCO + 0.5; t += passo) quadro(t);
    }
    for (let T = 20; T <= HORAS3; T += 97.3) quadro(T);
    quadro(HORAS3);
    assert.deepStrictEqual(erros, [], `@ ${escala}`);
    assert.strictEqual(m.ruins.size, 0);
    assert.strictEqual(m.cena && m.cena.nome, 'parado', 'continua depois de 3 h');
  }
});

test('o quadro é função do tempo: o mesmo instante dá os mesmos bytes, por qualquer caminho', () => {
  const a = montar({ escala: 1.25 }), b = montar({ escala: 1.25 });
  const ks = blocosPorExercicio(a.m.cena.semente);
  const tAbd = P.INICIO + ks.abdominal * P.BLOCO, tSoco = P.INICIO + ks.soco * P.BLOCO;
  const tKi = P.INICIO + ks.ki * P.BLOCO + P.bloco(a.m.cena.semente, ks.ki).descanso + 3.4;  // a aura acesa
  const instantes = [tKi, 0.4, 1.3, 5.07, 14.2, 33.3, 35.5, 37.1, 41.9, tAbd + 1.25, tAbd + 20.6, tSoco + 1.0, tSoco + 30.4, 3601.7, HORAS3 - 0.3];
  const fotos = new Map();
  let ta = 0, tb = 0;
  for (const t of instantes) {
    for (; ta + 1 / 30 < t && t - ta < 60; ta += 1 / 30) a.quadro(ta);  // quadro a quadro (pulando as horas)
    for (; tb + 1 / 7 < t && t - tb < 60; tb += 1 / 7) b.quadro(tb);    // pulando quadros
    ta = tb = t;
    const fa = bytes(a.quadro(t)), fb = bytes(b.quadro(t));
    assert.ok(fa.equals(fb), `@ ${t.toFixed(2)} s`);
    assert.ok(fa.equals(bytes(a.quadro(t))), `@ ${t.toFixed(2)} s: desenhar de novo mudou`);
    fotos.set(t, fa);
  }
  // voltando no tempo
  for (const t of [...instantes].reverse()) assert.ok(bytes(b.quadro(t)).equals(fotos.get(t)), `voltando, @ ${t.toFixed(2)} s`);
  assert.deepStrictEqual([...a.erros, ...b.erros], []);
});

test('custo em 1,25: mediana < 2 ms e pior < 8 ms por quadro (falha só em 8 / 32: o CI é mais lento)', (t) => {
  const medir = () => {
    const { m, cena, quadro } = montar({ escala: 1.25 });
    const ks = blocosPorExercicio(m.cena.semente), so = [], tudo = [];
    const trechos = [[0, 45], ...Object.values(ks).map(k => [P.INICIO + k * P.BLOCO, P.INICIO + (k + 1) * P.BLOCO]), [HORAS3, HORAS3 + 10]];
    for (const [a, b] of trechos) {
      for (let f = Math.round(a * 30); f <= b * 30; f++) {
        let ini = process.hrtime.bigint();
        cena(f / 30);
        so.push(Number(process.hrtime.bigint() - ini) / 1e6);
        ini = process.hrtime.bigint();
        quadro(f / 30);
        tudo.push(Number(process.hrtime.bigint() - ini) / 1e6);
      }
    }
    const ord = v => v.sort((x, y) => x - y);
    ord(so); ord(tudo);
    return { mediana: so[so.length >> 1], pior: so[so.length - 1], medianaTudo: tudo[tudo.length >> 1], piorTudo: tudo[tudo.length - 1] };
  };
  medir();  // aquece: o 1º quadro de cada pose monta o que fica guardado
  const r = [medir(), medir()], mediana = Math.min(r[0].mediana, r[1].mediana), pior = Math.min(r[0].pior, r[1].pior);  // a máquina oscila: o melhor de 2
  t.diagnostic(`cena: mediana ${mediana.toFixed(2)} ms, pior ${pior.toFixed(2)} ms`);
  t.diagnostic(`quadro inteiro (nuvem + enfeites + cena): mediana ${r[0].medianaTudo.toFixed(2)} ms, pior ${r[0].piorTudo.toFixed(2)} ms`);
  assert.ok(mediana < 8, `mediana ${mediana.toFixed(2)} ms (alvo 2)`);
  assert.ok(pior < 32, `pior ${pior.toFixed(2)} ms (alvo 8)`);
});

test('a saída (algo voltou a rodar), cortando na entrada e no laço, termina no Clawd parado do tema', () => {
  const base = montar();
  const ks = blocosPorExercicio(base.m.cena.semente);
  const tAbd = P.INICIO + ks.abdominal * P.BLOCO, tSoco = P.INICIO + ks.soco * P.BLOCO;
  const tKi = P.INICIO + ks.ki * P.BLOCO + P.bloco(base.m.cena.semente, ks.ki).descanso + 3.4;
  const cortes = [tKi, 0, 0.2, 0.4, 0.55, 0.7, 1.0, 5.0, 6.0, 14.9, 20.3, 33.2, 33.5, 35.5, 37.1, 40, tAbd + 0.6, tAbd + 10.4, tSoco + 0.9, tSoco + 10.0, 3600.4, HORAS3 + 0.77];
  for (const escala of ESCALAS) {
    for (const tCorte of cortes) {
      const { m, erros, tela, noLugar } = montar({ escala });
      for (let s = 0; s < tCorte; s += tCorte - s > 60 ? 50 : 1 / 30) m.passo(s);
      m.passo(tCorte);
      m.receber({ modo: 'andando' });  // algo voltou a rodar: o Mundo corta a cena
      assert.strictEqual(m.cena, null);
      // o tema segura o Clawd no lugar durante a saída (como o acordar do Padrão): sem andar o relógio
      const dur = P.saida.dur;
      for (let f = 0; f <= Math.ceil(dur * 30); f++) {
        const t = Math.min(dur, f / 30);
        noLugar(null, k => P.saida.quadro(k, t, m, tCorte));
        assert.ok(cheia(tela), `corte ${tCorte} @ ${escala}: saída ${t.toFixed(2)} vazia`);
      }
      const fim = bytes(noLugar(null, k => P.saida.quadro(k, dur, m, tCorte)));
      m.receber({ modo: 'parado' });
      const parado = bytes(noLugar(null, k => tema.clawd(k, m)));
      assert.ok(fim.equals(parado), `corte ${tCorte} @ ${escala}: a saída não termina no Clawd parado do tema`);
      assert.deepStrictEqual(erros, []);
    }
  }
  // pergunta/permissão corta a cena sem a saída: o tema desenha o Clawd pulando, sem quebrar
  const { m, erros, quadro } = montar({ escala: 1.25 });
  for (let s = 0; s < 6; s += 1 / 30) quadro(s);
  m.receber({ modo: 'pulando' });
  assert.strictEqual(m.cena, null);
  for (let s = 6; s < 7; s += 1 / 30) quadro(s);
  assert.deepStrictEqual(erros, []);
});

test('nada desenhado em cima do conteúdo do cartão (o texto), com 1 e 4 sessões, no laço e na saída', () => {
  for (const sessoes of [1, 4]) {
    for (const escala of ESCALAS) {
      const { m, tela, cena, noLugar } = montar({ escala, sessoes });
      const ret = conteudo(m, escala), ks = blocosPorExercicio(m.cena.semente);
      const instantes = [];
      for (let t = 0; t < 90; t += 0.37) instantes.push(t);
      for (const k of Object.values(ks)) for (let t = 0; t < P.BLOCO; t += 0.53) instantes.push(P.INICIO + k * P.BLOCO + t);
      for (let t = 600; t < HORAS3; t += 311.1) instantes.push(t);
      for (const t of instantes) {
        cena(t);
        const px = nadaDentro(tela, ret);
        assert.strictEqual(px, null, `${sessoes} sessão(ões) @ ${escala}, t = ${t.toFixed(2)}: pixel ${px} no conteúdo`);
      }
      for (const tCorte of [6.0, 20.3, 35.5, P.INICIO + ks.soco * P.BLOCO + 10, P.INICIO + ks.abdominal * P.BLOCO + 10]) {
        for (let t = 0; t <= P.saida.dur; t += 1 / 30) {
          noLugar(null, k => P.saida.quadro(k, t, m, tCorte));
          assert.strictEqual(nadaDentro(tela, ret), null, `saída (corte ${tCorte}) @ ${escala}, t = ${t.toFixed(2)}`);
        }
      }
    }
  }
});
