'use strict';
// motor/parado-sith-medita.js e parado-sith-forja.js: as cenas de "parado há muito tempo" do
// tema Sith (medita flutuando; a forja do sabre). No tema de verdade (Mundo + tema-sith.js +
// cartão de mentira): a entrada quadro a quadro e o laço por horas nas 3 escalas, o quadro como
// função do tempo, o custo, a saída terminando no Clawd parado do tema, nada em cima do texto
// do cartão, e as duas revezando.
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const { Tela } = require(path.join(MOTOR, 'raster'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const { layoutDe } = require(path.join(MOTOR, 'comum'));
const tema = require(path.join(MOTOR, 'tema-sith'));
const { estadoDeMentira } = require('../motor-foto');

const ESCALAS = [1, 1.25, 2];
const HORAS3 = 3 * 3600;
const CENAS = { medita: require(path.join(MOTOR, 'parado-sith-medita')), forja: require(path.join(MOTOR, 'parado-sith-forja')) };
// instantes que pegam cada pedaço: a entrada e, na forja, um ciclo inteiro (encaixe, lâmina acesa, desmonte)
const forja = CENAS.forja, ciclo = k => forja.INICIO + k * forja.CICLO;
const MARCOS = {
  medita: [0.3, 0.5, 1.0, 1.9, 2.4, 3.0, 9.4, 14.6, 33.3],
  forja: [0.3, 0.5, 1.0, 1.9, 2.6, ciclo(0) + 0.6, ciclo(0) + 2.2, ciclo(0) + 2.6, ciclo(0) + 4.9, ciclo(0) + 5.3, ciclo(0) + 7.0, ciclo(0) + 8.5, ciclo(0) + 9.8, ciclo(0) + 10.6, ciclo(0) + 13.0, ciclo(1) + 6.6, ciclo(200) + 7.1],
};
// um Mundo parado com a cena começando em T = 0
function montar(id, { escala = 1, semente = 5, sessoes = 4 } = {}) {
  const P = CENAS[id];
  const m = new Mundo({ tema, semente });
  const erros = [];
  m.aoErro = e => erros.push(e);
  m.receber({ ...estadoDeMentira('sith', 'parado', { sessoes }), escala });
  if (m.cena) m.fimCena(true);
  m.comecarCena(P.cena(m));
  assert.strictEqual(m.cena && m.cena.nome, 'parado', 'a cena começou');
  const tela = new Tela(Math.round(380 * escala), Math.round(440 * escala)), g = tela.getContext('2d');
  const limpa = () => { tela.limpar(); g.setTransform(escala, 0, 0, escala, 0, 0); g.globalAlpha = 1; };
  const quadro = T => { m.passo(T); limpa(); m.desenhar(g); return tela; };
  const noLugar = (T, desenha) => {
    if (T != null) m.passo(T);
    limpa();
    const p = m.pose();
    g.save(); g.translate(p.x, p.y); g.rotate(p.a); desenha(g); g.restore();
    return tela;
  };
  const cena = T => noLugar(T, k => m.cena.quadro(k, m.T - m.cena.t0, m));
  return { P, m, erros, tela, g, quadro, cena, noLugar, escala };
}
const cheia = tela => tela.pixels.some(p => p !== 0);
const bytes = tela => Buffer.from(tela.bgra());
function conteudo(m, escala) {
  const [x, y, w, h] = m.host.cartao, L = layoutDe(tema), [me, mc, md, mb] = L.moldura, [pe, pc, pd, pb] = L.padding;
  return [x + me + pe, y + mc + pc, w - me - pe - pd - md, h - mc - pc - pb - mb].map(v => v * escala);
}
function nadaDentro(tela, [x, y, w, h]) {
  const x0 = Math.ceil(x), y0 = Math.ceil(y), x1 = Math.floor(x + w), y1 = Math.floor(y + h);
  for (let py = y0; py < y1; py++) for (let px = x0; px < x1; px++) if (tela.pixels[py * tela.width + px] !== 0) return `${px},${py}`;
  return null;
}

test('o contrato: texturas, linha do tempo, cena infinita só parado, saída curta; o tema reveza as duas', () => {
  for (const [id, P] of Object.entries(CENAS)) {
    assert.deepStrictEqual(P.texturas, [], id);
    assert.ok(P.linhaDoTempo.length >= 4 && P.linhaDoTempo.every(([t, s]) => typeof t === 'number' && typeof s === 'string'), id);
    const { m } = montar(id);
    const c = P.cena(m);
    assert.strictEqual(c.nome, 'parado');
    assert.strictEqual(c.dur, Infinity);
    assert.deepStrictEqual(c.modos, ['parado']);
    assert.deepStrictEqual(c.espaco, { frente: 0, tras: 0 });
    assert.ok(P.saida.dur > 0 && P.saida.dur <= 1.2, id);
  }
  // parado há 1 min: a da vez; a seguinte na próxima vez (m.salvo.paradoVez)
  const m = new Mundo({ tema, semente: 3 });
  m.receber({ ...estadoDeMentira('sith', 'parado') });
  const vistas = [];
  let T = 0;
  for (let vez = 0; vez < 4; vez++) {
    for (let fim = T + 61; T < fim; T += 0.5) m.passo(T);
    vistas.push(m.cena && m.cena.nome);
    m.receber({ modo: 'andando' }); m.passo(T += 0.5);
    for (let fim = T + 2; T < fim; T += 0.1) m.passo(T);  // a saída
    m.receber({ modo: 'parado' }); m.passo(T += 0.1);
  }
  assert.deepStrictEqual(vistas, ['medita', 'forja', 'medita', 'forja']);
});

test('entrada e laço: 0–40 s quadro a quadro e amostras até 3 h, nas escalas 1, 1,25 e 2', () => {
  for (const id of Object.keys(CENAS)) {
    for (const escala of ESCALAS) {
      const { m, erros, tela, quadro } = montar(id, { escala });
      const passo = escala === 1.25 ? 1 / 30 : 1 / 7;
      for (let t = 0; t <= 40; t += passo) {
        quadro(t);
        assert.ok(cheia(tela), `${id} @ ${escala}: ${t.toFixed(2)} vazio`);
      }
      for (let T = 40; T <= HORAS3; T += 97.3) quadro(T);
      quadro(HORAS3);
      assert.deepStrictEqual(erros, [], `${id} @ ${escala}`);
      assert.strictEqual(m.ruins.size, 0);
      assert.strictEqual(m.cena && m.cena.nome, 'parado', `${id}: continua depois de 3 h`);
    }
  }
});

test('o quadro é função do tempo: o mesmo instante dá os mesmos bytes, por qualquer caminho', () => {
  for (const id of Object.keys(CENAS)) {
    const a = montar(id, { escala: 1.25 }), b = montar(id, { escala: 1.25 });
    const fotos = new Map();
    let ta = 0, tb = 0;
    for (const t of MARCOS[id]) {
      for (; ta + 1 / 30 < t && t - ta < 60; ta += 1 / 30) a.quadro(ta);
      for (; tb + 1 / 7 < t && t - tb < 60; tb += 1 / 7) b.quadro(tb);
      ta = tb = t;
      const fa = bytes(a.quadro(t)), fb = bytes(b.quadro(t));
      assert.ok(fa.equals(fb), `${id} @ ${t.toFixed(2)} s`);
      assert.ok(fa.equals(bytes(a.quadro(t))), `${id} @ ${t.toFixed(2)} s: desenhar de novo mudou`);
      fotos.set(t, fa);
    }
    for (const t of [...MARCOS[id]].reverse()) assert.ok(bytes(b.quadro(t)).equals(fotos.get(t)), `${id}, voltando, @ ${t.toFixed(2)} s`);
    assert.deepStrictEqual([...a.erros, ...b.erros], []);
  }
});

test('custo em 1,25: mediana < 2 ms e pior < 8 ms por quadro (falha só em 8 / 32: o CI é mais lento)', (t) => {
  for (const id of Object.keys(CENAS)) {
    const medir = () => {
      const { cena } = montar(id, { escala: 1.25 }), so = [];
      for (const [a, b] of [[0, 40], [HORAS3, HORAS3 + 20]]) {
        for (let f = Math.round(a * 30); f <= b * 30; f++) {
          const ini = process.hrtime.bigint();
          cena(f / 30);
          so.push(Number(process.hrtime.bigint() - ini) / 1e6);
        }
      }
      so.sort((x, y) => x - y);
      return { mediana: so[so.length >> 1], pior: so[so.length - 1] };
    };
    medir();
    const r = [medir(), medir()], mediana = Math.min(r[0].mediana, r[1].mediana), pior = Math.min(r[0].pior, r[1].pior);
    t.diagnostic(`${id}: mediana ${mediana.toFixed(2)} ms, pior ${pior.toFixed(2)} ms`);
    assert.ok(mediana < 8, `${id}: mediana ${mediana.toFixed(2)} ms (alvo 2)`);
    assert.ok(pior < 32, `${id}: pior ${pior.toFixed(2)} ms (alvo 8)`);
  }
});

test('a saída (algo voltou a rodar), cortando na entrada e no laço, termina no Clawd parado do tema', () => {
  for (const [id, P] of Object.entries(CENAS)) {
    for (const escala of ESCALAS) {
      for (const tCorte of [0, ...MARCOS[id], 3600.4, HORAS3 + 0.77]) {
        const { m, erros, tela, noLugar } = montar(id, { escala });
        for (let s = 0; s < tCorte; s += tCorte - s > 60 ? 50 : 1 / 30) m.passo(s);
        m.passo(tCorte);
        m.receber({ modo: 'andando' });
        assert.strictEqual(m.cena, null);
        const dur = P.saida.dur;
        for (let f = 0; f <= Math.ceil(dur * 30); f++) {
          const t = Math.min(dur, f / 30);
          noLugar(null, k => P.saida.quadro(k, t, m, tCorte));
          assert.ok(cheia(tela), `${id}, corte ${tCorte} @ ${escala}: saída ${t.toFixed(2)} vazia`);
        }
        const fim = bytes(noLugar(null, k => P.saida.quadro(k, dur, m, tCorte)));
        m.receber({ modo: 'parado' });
        const parado = bytes(noLugar(null, k => tema.clawd(k, m)));
        assert.ok(fim.equals(parado), `${id}, corte ${tCorte} @ ${escala}: a saída não termina no Clawd parado do tema`);
        assert.deepStrictEqual(erros, []);
      }
    }
  }
});

test('nada desenhado em cima do conteúdo do cartão (o texto), com 1 e 4 sessões, no laço e na saída', () => {
  for (const [id, P] of Object.entries(CENAS)) {
    for (const sessoes of [1, 4]) {
      for (const escala of ESCALAS) {
        const { m, tela, cena, noLugar } = montar(id, { escala, sessoes });
        const ret = conteudo(m, escala);
        const instantes = [...MARCOS[id]];
        for (let t = 0; t < 60; t += 0.37) instantes.push(t);
        for (let t = 600; t < HORAS3; t += 311.1) instantes.push(t);
        for (const t of instantes) {
          cena(t);
          const px = nadaDentro(tela, ret);
          assert.strictEqual(px, null, `${id}, ${sessoes} sessão(ões) @ ${escala}, t = ${t.toFixed(2)}: pixel ${px} no conteúdo`);
        }
        for (const tCorte of MARCOS[id]) {
          for (let t = 0; t <= P.saida.dur; t += 1 / 30) {
            noLugar(null, k => P.saida.quadro(k, t, m, tCorte));
            assert.strictEqual(nadaDentro(tela, ret), null, `${id}, saída (corte ${tCorte}) @ ${escala}, t = ${t.toFixed(2)}`);
          }
        }
      }
    }
  }
});
