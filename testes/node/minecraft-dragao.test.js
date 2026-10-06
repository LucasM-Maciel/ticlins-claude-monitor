'use strict';
// motor/minecraft-dragao.js: o Ender Dragon (evento raro do tema Minecraft, a versão A da
// prévia, 19,2 s). Sem as texturas o módulo só carrega; com elas (pasta em CM_TEXTURAS ou
// ~/.claude-monitor, a primeira que tiver todas): a cena inteira quadro a quadro em 3 escalas
// e 2 cartões, mesmo instante = mesmos bytes, o dragão sempre inteiro dentro da janela, e o custo.
// Ver a olho: node testes/motor-foto.js --tema minecraft --cena dragao --tira 3.3,8.95,12.6,17.9 --pasta <texturas> --saida f.png
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const dragao = require(path.join(MOTOR, 'minecraft-dragao'));
const { Tela } = require(path.join(MOTOR, 'raster'));
const { carregarTexturas, temTexturas } = require(path.join(MOTOR, 'comum'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const { estadoDeMentira } = require('../motor-foto');

const DUR = 19.2;
// um tema de mentira, só o que a cena usa (layout com a moldura do Minecraft)
const TEMA = { layout: { raio: 0, moldura: [6, 8, 6, 6] }, trilha: { raio: 1 }, clawd() {}, naParada() { return null; } };
// cartões: 1 sessão (baixo, sobra céu) e 8 (alto: o dragão espremido em cima); o Clawd em
// cima do cartão (vai andando) ou do lado direito (vai teleportando)
const CARTOES = [{ sessoes: 1, dist: 140 }, { sessoes: 8, dist: 300 }];

function pastaComTexturas() {
  const pastas = [process.env.CM_TEXTURAS, path.join(os.homedir(), '.claude-monitor')].filter(p => p && fs.existsSync(p));
  return pastas.find(p => dragao.texturas.every(n => fs.existsSync(path.join(p, n + '.png'))));
}
function novoMundo({ escala = 1, sessoes = 4, dist = 140 } = {}) {
  const m = new Mundo({ tema: TEMA, semente: 7 });
  m.erros = [];
  m.aoErro = e => m.erros.push(e);
  m.receber({ ...estadoDeMentira('minecraft', 'andando', { sessoes }), escala });
  m.dist = dist;
  const c = dragao.cena(m);
  m.comecarCena(c);
  return { m, c };
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
const quadros = Array.from({ length: Math.round(DUR * 30) }, (_, n) => n / 30);

test('carrega sem as texturas: a lista delas e a cena no formato combinado com o tema', () => {
  assert.ok(Array.isArray(dragao.texturas) && dragao.texturas.length > 10);
  for (const n of ['dragao', 'dragao_olhos', 'end_stone', 'cristal', 'ovo_dragao', 'espada']) assert.ok(dragao.texturas.includes(n), n);
  assert.strictEqual(new Set(dragao.texturas).size, dragao.texturas.length, 'sem repetidas');
  assert.ok(!temTexturas(...dragao.texturas), 'aqui ninguém carregou as texturas ainda');
  const m = new Mundo({ tema: TEMA, semente: 7 });
  m.receber(estadoDeMentira('minecraft', 'andando'));
  const c = dragao.cena(m);  // montar a cena não toca nas texturas
  assert.strictEqual(c.nome, 'dragao');
  assert.strictEqual(c.dur, DUR);
  assert.deepStrictEqual(c.espaco, { frente: 0, tras: 0 });
  assert.deepStrictEqual(c.modos, ['andando']);
  assert.strictEqual(typeof c.quadro, 'function');
});

test('com as texturas: a cena inteira, quadro a quadro (30/s), nas escalas 1, 1,25 e 2 e em 2 cartões, sem erro', (t) => {
  const pasta = pastaComTexturas();
  if (!pasta) return t.skip('sem as texturas do dragão (ponha a pasta em CM_TEXTURAS)');
  carregarTexturas(pasta, dragao.texturas);
  for (const escala of [1, 1.25, 2]) {
    const tela = telaDa(escala);
    for (const cartao of CARTOES) {
      const { m } = novoMundo({ escala, ...cartao });
      let pintou = 0;
      for (const s of quadros) {
        m.passo(s);
        quadro(m, tela, escala);
        if (s === 9) pintou = tela.pixels.filter(p => p !== 0).length;
      }
      const onde = `escala ${escala}, ${cartao.sessoes} sessão(ões)`;
      assert.deepStrictEqual(m.erros, [], onde);
      assert.ok(m.cena && m.cena.nome === 'dragao', `a cena acabou antes da hora (${onde})`);
      assert.ok(pintou > 30000 * escala * escala, `pintou pouco no meio da luta (${onde}): ${pintou}`);
      m.passo(DUR + 0.05);
      assert.strictEqual(m.cena, null, `a cena não terminou (${onde})`);
    }
  }
});

test('com as texturas: o mesmo instante dá os mesmos bytes (de passo em passo ou pulando direto)', (t) => {
  const pasta = pastaComTexturas();
  if (!pasta) return t.skip('sem as texturas do dragão');
  carregarTexturas(pasta, dragao.texturas);
  const instantes = [0.3, 2.5, 4.4, 6.3, 9.2, 12.8, 14.6, 16.2, 17.9, 19.1];
  for (const escala of [1, 1.25]) {
    const a = novoMundo({ escala }), b = novoMundo({ escala });
    const ta = telaDa(escala), tb = telaDa(escala);
    let i = 0;
    for (const s of quadros) {
      a.m.passo(s);
      if (i >= instantes.length || Math.abs(s - instantes[i]) > 1e-9) continue;
      quadro(a.m, ta, escala);
      b.m.passo(s);  // b só existe nos instantes da foto
      quadro(b.m, tb, escala);
      assert.ok(ta.bgra().equals(tb.bgra()), `t=${s}, escala ${escala}`);
      i++;
    }
    assert.strictEqual(i, instantes.length);
  }
});

test('com as texturas: o dragão nunca sai da janela (a caixa dele, instante a instante)', (t) => {
  const pasta = pastaComTexturas();
  if (!pasta) return t.skip('sem as texturas do dragão');
  carregarTexturas(pasta, dragao.texturas);
  for (const cartao of [{ sessoes: 4, dist: 30 }, ...CARTOES]) {
    const { c } = novoMundo(cartao);
    let visto = 0, perto = Infinity;
    for (const s of quadros) {
      const k = c.caixaDragao(s);
      if (!k) continue;
      visto++;
      const [x0, y0, x1, y1] = k.pixels, onde = `t=${s.toFixed(2)}, ${cartao.sessoes} sessão(ões): ${k.pixels}`;
      assert.ok(x0 >= 0 && y0 >= 0 && x1 <= 380 && y1 <= 440, `saiu da janela (${onde})`);
      // a caixa medida (a que empurra o dragão pra dentro) contém o que foi pintado
      const [mx0, my0, mx1, my1] = k.medida;
      assert.ok(x0 >= Math.floor(mx0) - 1 && y0 >= Math.floor(my0) - 1 && x1 <= Math.ceil(mx1) + 1 && y1 <= Math.ceil(my1) + 1, `pintou fora da caixa medida (${onde}; medida ${k.medida.map(v => v.toFixed(1))})`);
      perto = Math.min(perto, x0, y0, 380 - x1, 440 - y1);
    }
    assert.ok(visto > 300, `o dragão aparece de 1,2 a 13,9 s: ${visto} quadros`);
    assert.ok(perto < 30, `em algum instante ele passa perto da borda (sem cortar): ${perto} px`);
  }
});

test('com as texturas: custo por quadro na escala 1,25 (alvo: mediana bem abaixo de 4 ms, pior abaixo de 12)', (t) => {
  const pasta = pastaComTexturas();
  if (!pasta) return t.skip('sem as texturas do dragão');
  carregarTexturas(pasta, dragao.texturas);
  const escala = 1.25, tela = telaDa(escala);
  const rodar = (vezes) => {
    const { m } = novoMundo({ escala, sessoes: 4, dist: 30 });
    return quadros.map(s => {
      m.passo(s);
      let melhor = Infinity;
      for (let k = 0; k < vezes; k++) {  // o menor de 3: a máquina oscila (e roda outros testes junto)
        const a = process.hrtime.bigint();
        quadro(m, tela, escala);
        melhor = Math.min(melhor, Number(process.hrtime.bigint() - a) / 1e6);
      }
      return melhor;
    });
  };
  rodar(1);  // aquece o JIT e deixa prontos o céu, a borda e o ovo
  const ms = rodar(3).sort((a, b) => a - b), mediana = ms[ms.length >> 1], pior = ms[ms.length - 1];
  t.diagnostic(`escala 1,25: mediana ${mediana.toFixed(2)} ms, p95 ${ms[Math.floor(ms.length * 0.95)].toFixed(2)}, pior ${pior.toFixed(2)}`);
  assert.ok(mediana < 10, `mediana ${mediana.toFixed(2)} ms (alvo bem abaixo de 4)`);
  assert.ok(pior < 50, `pior quadro ${pior.toFixed(2)} ms (alvo 12)`);
});
