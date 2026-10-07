'use strict';
// motor/parado-minecraft-cama.js: a cena de "parado há muito tempo" do tema Minecraft (a cama).
// A entrada quadro a quadro e o laço por horas, nas escalas 1, 1,25 e 2, sem erro; mesmo instante
// = mesmos bytes (de passo em passo, pulando e voltando no tempo); o custo; a saída (algo voltou
// a rodar), cortando na entrada, no laço e no sonho, termina com o Clawd do tema em pé no lugar;
// e nada desenhado dentro do conteúdo do cartão.
// Texturas: as da Mojang na pasta CM_TEXTURAS, se existir; as que faltarem (o CI não tem nenhuma)
// viram texturas de mentira do tamanho certo, que passam pelo mesmo código.
// Ver a olho: node <scratchpad>/parado/parado-foto.js --tema minecraft --modulo cama --tira 0,1,2,3,6,25 --zoom 3 --saida f.png
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const { Tela } = require(path.join(MOTOR, 'raster'));
const { IMG, carregarTexturas } = require(path.join(MOTOR, 'comum'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const tema = require(path.join(MOTOR, 'tema-minecraft'));
const cama = require(path.join(MOTOR, 'parado-minecraft-cama'));
const { TEXTURAS } = require(path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'minecraft'));
const { estadoDeMentira } = require('../motor-foto');

const VAZIA = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-cama-'));
const PASTA = process.env.CM_TEXTURAS && fs.existsSync(process.env.CM_TEXTURAS) ? process.env.CM_TEXTURAS : VAZIA;
// a de mentira: pixels opacos que mudam a cada pixel (como no tema-minecraft.test.js)
function deMentira(nome) {
  const [w, h] = /^xp_/.test(nome) ? [182, 5] : nome === 'fonte' ? [128, 128]
    : /^(zumbi|creeper|esqueleto|aranha|slime|silverfish|enderman|lobo|galinha|orbe|escudo)/.test(nome) ? [64, 64]
      : /^(explosao|varrida|flecha)/.test(nome) ? [32, 32] : [16, 16];
  const t = new Tela(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (nome === 'fonte' && !(x % 8 < 5 && y % 8 < 7 && (x + y) % 2 === 0)) continue;
    t.pixels[y * w + x] = (0xFF000000 | ((x * 2654435761 + y * 40503 + nome.length * 977) & 0xFFFFFF)) >>> 0;
  }
  return t;
}
const NOMES = [...new Set([...tema.texturas, ...cama.texturas])];
carregarTexturas(PASTA, NOMES);
for (const n of NOMES) if (!IMG[n]) IMG[n] = deMentira(n);

const ESCALAS = [1, 1.25, 2];
const HORA = 3600;
// um Mundo no tema, PARADO, com a cena da cama começando em T = 0
function novoMundo({ escala = 1, sessoes = 4, roupa = 'mc_steve', semente = 7 } = {}) {
  const m = new Mundo({ tema, semente, relogio: () => new Date(2026, 9, 5, 23, 0, 0) });
  m.erros = [];
  m.aoErro = e => m.erros.push(e);
  m.receber({ ...estadoDeMentira('minecraft', 'parado', { sessoes }), escala });
  m.roupa = roupa;
  m.comecarCena(cama.cena(m));
  assert.ok(m.cena && m.cena.nome === 'parado', 'a cena não começou');
  return m;
}
const telaDa = escala => new Tela(Math.round(380 * escala), Math.round(440 * escala));
// o quadro como o motor.js desenha (janela inteira, na escala)
function quadro(m, tela, escala) {
  const g = tela.getContext('2d');
  tela.limpar();
  g.setTransform(escala, 0, 0, escala, 0, 0);
  g.globalAlpha = 1;
  m.desenhar(g);
}
// só o que a cena desenha (sem os enfeites do cartão): no lugar do Clawd
function soCena(m, tela, escala, desenhar) {
  const g = tela.getContext('2d'), p = m.pose();
  tela.limpar();
  g.setTransform(escala, 0, 0, escala, 0, 0);
  g.globalAlpha = 1;
  g.translate(p.x, p.y); g.rotate(p.a);
  desenhar(g);
}
// os instantes: a entrada e 20 s quadro a quadro, depois amostras até 3 h (com o sonho e as janelas)
const ENTRADA = Array.from({ length: 20 * 30 + 1 }, (_, k) => k / 30);
const LACO = [...Array.from({ length: 300 }, (_, k) => 20 + k * 0.37), 75.5, 119.2, 600.3, 1799.9, HORA + 0.1, 2 * HORA + 17.3, 3 * HORA];
const INSTANTES = [...ENTRADA, ...LACO];

test('o módulo: texturas do minecraft.js, linha do tempo e a cena no formato combinado', () => {
  assert.ok(Array.isArray(cama.texturas) && cama.texturas.length > 0);
  assert.strictEqual(new Set(cama.texturas).size, cama.texturas.length, 'sem repetidas');
  for (const n of cama.texturas) assert.ok(TEXTURAS[n], `${n} não está no TEXTURAS do minecraft.js`);
  for (const n of ['cama_pe', 'cama_cabeca']) assert.ok(cama.texturas.includes(n), n);
  assert.ok(cama.linhaDoTempo.length >= 3);
  let antes = -1;
  for (const [t, txt] of cama.linhaDoTempo) {
    assert.ok(typeof t === 'number' && t > antes && typeof txt === 'string' && txt.length > 3, `linha ${t}`);
    antes = t;
  }
  const m = novoMundo();
  const c = cama.cena(m);
  assert.strictEqual(c.dur, Infinity);
  assert.deepStrictEqual(c.modos, ['parado']);
  assert.deepStrictEqual(c.espaco, { frente: 0, tras: 0 });
  assert.ok(cama.saida.dur > 0 && cama.saida.dur <= 1.2);
});

test('a entrada quadro a quadro e o laço até 3 h, nas escalas 1, 1,25 e 2, sem erro', () => {
  for (const escala of ESCALAS) {
    for (const sessoes of [1, 4]) {
      const m = novoMundo({ escala, sessoes }), tela = telaDa(escala);
      let pintou = 0;
      for (const s of INSTANTES) {
        m.passo(s);
        quadro(m, tela, escala);
        if (s === 10) pintou = tela.pixels.filter(p => p !== 0).length;
      }
      const onde = `escala ${escala}, ${sessoes} sessão(ões)`;
      assert.deepStrictEqual(m.erros, [], onde);
      assert.ok(m.cena && m.cena.nome === 'parado', `a cena acabou sozinha (${onde})`);
      assert.ok(pintou > 1000, `pintou pouco dormindo (${onde}): ${pintou}`);
    }
  }
});

test('mesmo instante = mesmos bytes: de passo em passo, pulando direto e voltando no tempo', () => {
  // na entrada, quadros dela (k/30: olhando, batendo, a cama aparecendo, no ar, deitando, dormindo)
  const instantes = [...[15, 51, 58, 77, 87, 93, 132, 296].map(k => ENTRADA[k]), 21.3, 23.7, 25.2, 61.7, 1234.5, 2 * HORA + 0.4];
  for (const escala of [1, 1.25]) {
    const a = novoMundo({ escala }), ta = telaDa(escala), tb = telaDa(escala), tc = telaDa(escala);
    const fotos = new Map();
    let i = 0;
    for (const s of [...ENTRADA, ...instantes.filter(x => x > 20)]) {
      a.passo(s);
      if (i >= instantes.length || s !== instantes[i]) continue;
      quadro(a, ta, escala);
      const b = novoMundo({ escala });  // b só existe no instante da foto
      b.passo(s);
      quadro(b, tb, escala);
      assert.ok(ta.bgra().equals(tb.bgra()), `t=${s}, escala ${escala}`);
      fotos.set(s, Buffer.from(ta.bgra()));
      i++;
    }
    assert.strictEqual(i, instantes.length);
    // voltando: o mesmo Mundo, do fim pro começo
    for (const s of [...instantes].reverse()) {
      a.passo(s);
      quadro(a, tc, escala);
      assert.ok(tc.bgra().equals(fotos.get(s)), `voltando, t=${s}, escala ${escala}`);
    }
    assert.deepStrictEqual(a.erros, []);
  }
});

test('custo na escala 1,25: mediana abaixo de 2 ms e pior quadro abaixo de 8 ms (falha só em 8 / 32: o CI é mais lento)', (t) => {
  const escala = 1.25, tela = telaDa(escala);
  const instantes = [...ENTRADA, ...LACO.slice(0, 120)];
  const saidas = [2.0, 5.3, 24.1].map(tc => ({ tc, ts: Array.from({ length: 37 }, (_, k) => k / 30) }));
  const rodar = (vezes) => {
    const m = novoMundo({ escala });
    const ms = instantes.map(s => {
      m.passo(s);
      let melhor = Infinity;
      for (let k = 0; k < vezes; k++) {  // o menor de 3: a máquina oscila (e roda outros testes junto)
        const a = process.hrtime.bigint();
        quadro(m, tela, escala);
        melhor = Math.min(melhor, Number(process.hrtime.bigint() - a) / 1e6);
      }
      return melhor;
    });
    for (const { tc, ts } of saidas) {
      const n = novoMundo({ escala });
      n.passo(tc);
      for (const s of ts) {
        let melhor = Infinity;
        for (let k = 0; k < vezes; k++) {
          const a = process.hrtime.bigint();
          soCena(n, tela, escala, g => cama.saida.quadro(g, s, n, tc));
          melhor = Math.min(melhor, Number(process.hrtime.bigint() - a) / 1e6);
        }
        ms.push(melhor);
      }
    }
    return ms;
  };
  rodar(1);  // aquece o JIT e deixa prontos os sprites (cama, coberta, letras)
  const ms = rodar(3).sort((a, b) => a - b), mediana = ms[ms.length >> 1], pior = ms[ms.length - 1];
  t.diagnostic(`escala 1,25 (cartão + cena, ${ms.length} quadros): mediana ${mediana.toFixed(2)} ms, p95 ${ms[Math.floor(ms.length * 0.95)].toFixed(2)}, pior ${pior.toFixed(2)}`);
  assert.ok(mediana < 8, `mediana ${mediana.toFixed(2)} ms (alvo 2)`);
  assert.ok(pior < 32, `pior quadro ${pior.toFixed(2)} ms (alvo 8)`);
});

// a saída como o tema vai tocar: algo volta a rodar (o Mundo corta a cena), o quadro da saída no
// lugar do Clawd; no fim, igual ao Clawd parado do tema (desenhado antes de mudar o modo, no mesmo T)
const CORTES = [0.05, 0.5, 1.0, 1.4, 1.75, 1.92, 1.97, 2.2, 2.35, 2.6, 2.9, 3.0, 3.3, 3.8, 7.77, 24.2, 25.9, 100.4, HORA + 3.3, 3 * HORA];
test('a saída, cortando na entrada, no laço e no sonho, termina com o Clawd do tema em pé no lugar', () => {
  const dur = cama.saida.dur;
  for (const escala of ESCALAS) {
    for (const roupa of escala === 1.25 ? ['mc_steve', 'mc_alex', 'mc_herobrine'] : ['mc_steve']) {
      for (const tc of CORTES) {
        const m = novoMundo({ escala, roupa }), ref = telaDa(escala), tela = telaDa(escala);
        m.passo(tc);
        quadro(m, tela, escala);  // o último quadro da cena
        soCena(m, ref, escala, g => tema.clawd(g, m));
        const tCorte = m.T - m.cena.t0;
        m.receber({ modo: 'andando' });
        assert.strictEqual(m.cena, null, 'andando corta a cena');
        const onde = `corte ${tc} s, ${roupa}, escala ${escala}`;
        for (let k = 0; k <= Math.round(dur * 30); k++) soCena(m, tela, escala, g => cama.saida.quadro(g, Math.min(dur, k / 30), m, tCorte));
        soCena(m, tela, escala, g => cama.saida.quadro(g, dur, m, tCorte));
        assert.deepStrictEqual(m.erros, [], onde);
        assert.ok(tela.bgra().equals(ref.bgra()), `o fim da saída não é o Clawd do tema (${onde})`);
      }
    }
  }
});

test('a saída com o Clawd machucado termina com os corações do tema (e a mesma saída de novo = mesmos bytes)', () => {
  const escala = 1.25, m = novoMundo({ escala }), ref = telaDa(escala), a = telaDa(escala), b = telaDa(escala);
  m.estado.vida = 6.5;
  m.passo(12.3);
  soCena(m, ref, escala, g => tema.clawd(g, m));
  m.receber({ modo: 'andando' });
  for (const s of [0, 0.13, 0.4, 0.55, 0.8]) {
    soCena(m, a, escala, g => cama.saida.quadro(g, s, m, 12.3));
    soCena(m, b, escala, g => cama.saida.quadro(g, s, m, 12.3));
    assert.ok(a.bgra().equals(b.bgra()), `saída em ${s}`);
  }
  soCena(m, a, escala, g => cama.saida.quadro(g, cama.saida.dur, m, 12.3));
  assert.ok(a.bgra().equals(ref.bgra()));
});

test('pergunta/permissão no meio do sono: o tema desenha o Clawd pulando, sem erro', () => {
  const escala = 1.25, m = novoMundo({ escala }), tela = telaDa(escala);
  for (const s of [0.5, 2.0, 2.6, 8.4]) m.passo(s);
  m.receber({ modo: 'pulando' });
  assert.strictEqual(m.cena, null);
  for (let k = 0; k < 30; k++) { m.passo(8.4 + k / 30); quadro(m, tela, escala); }
  assert.deepStrictEqual(m.erros, []);
});

// o retângulo do conteúdo do cartão: dentro da moldura do tema (a faixa de grama em cima pode)
function dentroDoConteudo(m, tela, escala) {
  const [x, y, w, h] = m.host.cartao, [me, mc, md, mb] = tema.layout.moldura;
  const x0 = Math.ceil((x + me) * escala), x1 = Math.floor((x + w - md) * escala), y0 = Math.ceil((y + mc) * escala), y1 = Math.floor((y + h - mb) * escala);
  let n = 0;
  for (let j = y0; j < y1; j++) for (let i = x0; i < x1; i++) if (tela.pixels[j * tela.width + i] !== 0) n++;
  return n;
}
test('nada desenhado dentro do conteúdo do cartão (entrada, laço, sonho e saídas; 1 e 4 sessões)', () => {
  for (const escala of ESCALAS) {
    for (const sessoes of [1, 4]) {
      const m = novoMundo({ escala, sessoes }), tela = telaDa(escala);
      for (const s of [...ENTRADA.filter((_, k) => k % 2 === 0), ...LACO]) {
        m.passo(s);
        soCena(m, tela, escala, g => m.cena.quadro(g, m.T - m.cena.t0, m));
        assert.strictEqual(dentroDoConteudo(m, tela, escala), 0, `t=${s}, escala ${escala}, ${sessoes} sessão(ões)`);
      }
      for (const tc of [1.95, 2.6, 9.1, 24.3]) {
        const n = novoMundo({ escala, sessoes });
        n.passo(tc);
        for (let k = 0; k <= 36; k++) {
          soCena(n, tela, escala, g => cama.saida.quadro(g, k / 30, n, tc));
          assert.strictEqual(dentroDoConteudo(n, tela, escala), 0, `saída ${tc}+${(k / 30).toFixed(2)}, escala ${escala}`);
        }
      }
    }
  }
});
