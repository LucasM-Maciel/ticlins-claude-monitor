'use strict';
// motor/parado.js nos temas: parado há 60 s começa a cena de parado do tema, uma vez cada uma
// (sobrevive a reabrir); algo voltou a rodar = a saída no lugar e depois anda; pergunta corta
// sem saída e não gasta a vez; quebrada ou sem textura fica de fora. As cenas em si (desenho,
// custo, saída terminando no Clawd normal) têm o teste delas (parado-<tema>-<id>.test.js).
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const { Tela } = require(path.join(MOTOR, 'raster'));
const { IMG, carregarTexturas } = require(path.join(MOTOR, 'comum'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const { ESPERA } = require(path.join(MOTOR, 'parado'));
const { estadoDeMentira } = require('../motor-foto');

const TEMAS = { padrao: ['dorme', 'videogame'], minecraft: ['cama', 'pesca'], dragonball: ['medita', 'treino'] };
const tema = nome => require(path.join(MOTOR, `tema-${nome}`));
const modulo = (nome, id) => require(path.join(MOTOR, `parado-${nome}-${id}`));

// Minecraft sem as texturas da Mojang (o CI): de mentira, no tamanho certo
function deMentira(nome) {
  const [w, h] = /^xp_/.test(nome) ? [182, 5] : nome === 'fonte' ? [128, 128] : nome === 'agua' ? [16, 512] : nome === 'boia' ? [8, 8]
    : /^(zumbi|creeper|esqueleto|aranha|slime|silverfish|enderman|lobo|galinha|orbe|escudo)/.test(nome) ? [64, 64]
      : /^(explosao|varrida|flecha)/.test(nome) ? [32, 32] : [16, 16];
  const t = new Tela(w, h);
  for (let i = 0; i < w * h; i++) t.pixels[i] = (0xFF000000 | ((i * 2654435761 + nome.length * 977) & 0xFFFFFF)) >>> 0;
  return t;
}
const VAZIA = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-parado-'));
const PASTA = process.env.CM_TEXTURAS && fs.existsSync(process.env.CM_TEXTURAS) ? process.env.CM_TEXTURAS : VAZIA;
carregarTexturas(PASTA, tema('minecraft').texturas);
for (const n of tema('minecraft').texturas) if (!IMG[n]) IMG[n] = deMentira(n);

function novoMundo(nome, { pasta = null, semente = 7 } = {}) {
  const m = new Mundo({ tema: tema(nome), semente, pasta, relogio: () => new Date(2026, 9, 5, 12, 0, 0) });
  m.erros = [];
  m.aoErro = e => m.erros.push(e);
  m.receber({ ...estadoDeMentira(nome, 'parado'), escala: 1 });
  return m;
}
const tela = new Tela(380, 440);
function quadro(m) {
  const g = tela.getContext('2d');
  tela.limpar(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1;
  m.desenhar(g);
}
function andar(m, a, b, dt = 0.2, cada) { for (let T = a + dt; T <= b + 1e-9; T += dt) { m.passo(T); if (cada) cada(T); } }
// fica parado até a cena de parado começar e devolve o nome dela
function esperarCena(m) {
  const T0 = m.T;
  andar(m, T0, T0 + ESPERA - 0.4, 0.2, () => assert.strictEqual(m.cena, null, `começou cedo em ${m.T - T0}`));
  andar(m, m.T, T0 + ESPERA + 0.4);
  assert.ok(m.cena && m.cena.parado, 'não começou depois de 60 s parado');
  return m.cena.nome;
}
// algo volta a rodar: a saída toca no lugar e só depois ele anda
function acordar(m, nome, id) {
  quadro(m);
  const meio = m.pose(), dur = modulo(nome, id).saida.dur, T0 = m.T;
  m.receber({ modo: 'andando' });
  assert.strictEqual(m.cena, null);
  assert.ok(m.bloqueado(), `${id}: saindo, ainda não anda`);
  andar(m, T0, T0 + dur - 0.05, 1 / 30, () => quadro(m));
  assert.deepStrictEqual([m.pose().x, m.pose().y, m.pose().a], [meio.x, meio.y, 0], `${id}: a saída é no lugar`);
  andar(m, m.T, T0 + dur + 1, 1 / 30, () => quadro(m));
  assert.ok(!m.bloqueado() && m.pose().x > meio.x + 30, `${id}: depois da saída, anda`);
  m.receber({ modo: 'parado' });
}

for (const [nome, ids] of Object.entries(TEMAS)) {
  test(`${nome}: 60 s parado começa ${ids.join(' / ')}, uma vez cada; a saída no lugar e depois anda`, () => {
    const m = novoMundo(nome);
    const vistas = [];
    for (let i = 0; i < 4; i++) {
      const id = esperarCena(m);
      vistas.push(id);
      andar(m, m.T, m.T + 30, 1 / 30, T => { if (Math.round(T * 30) % 45 === 0) quadro(m); });
      assert.strictEqual(m.cena && m.cena.nome, id, 'fica até algo rodar');
      acordar(m, nome, id);
    }
    assert.deepStrictEqual(vistas, [...ids, ...ids], 'uma vez cada');
    assert.deepStrictEqual(m.erros, []);
  });

  test(`${nome}: pergunta corta sem saída e não gasta a vez; quebrada fica de fora; o motor-foto acha pelo nome`, () => {
    const m = novoMundo(nome);
    assert.strictEqual(esperarCena(m), ids[0]);
    m.receber({ modo: 'pulando' });
    assert.ok(!m.cena && !m.bloqueado(), 'a pergunta aparece na hora');
    quadro(m);
    m.receber({ modo: 'parado' });
    assert.strictEqual(esperarCena(m), ids[0], 'cortada pela pergunta: volta a mesma');
    // a do meio quebra: o Mundo anota, encerra e a outra faz as vezes dela
    m.ruins.add(ids[0]); m.fimCena(true);
    andar(m, m.T, m.T + 0.4);
    assert.strictEqual(m.cena && m.cena.nome, ids[1]);
    acordar(m, nome, ids[1]);
    assert.strictEqual(esperarCena(m), ids[1], 'só sobrou ela');
    for (const id of ids) assert.strictEqual(tema(nome).cenaPorNome(m, id).nome, id);
    assert.deepStrictEqual(m.erros, []);
  });

  test(`${nome}: a vez sobrevive a reabrir; saída com defeito vira o Clawd normal e anota`, () => {
    const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-parado-salvo-'));
    let m = novoMundo(nome, { pasta });
    assert.strictEqual(esperarCena(m), ids[0]);
    m = novoMundo(nome, { pasta });
    assert.strictEqual(esperarCena(m), ids[1], 'reabriu: a próxima');
    const mod = modulo(nome, ids[1]), q = mod.saida.quadro;
    try {
      mod.saida.quadro = () => { throw new Error('de propósito'); };
      m.receber({ modo: 'andando' });
      quadro(m);
      assert.ok(tela.pixels.some(p => p !== 0), 'desenhou o Clawd normal');
      assert.ok(!m.bloqueado(), 'sem saída: anda');
      assert.strictEqual(m.erros.length, 1);
      assert.match(m.erros[0], new RegExp(`saída de ${ids[1]} quebrou`));
    } finally { mod.saida.quadro = q; }
  });
}

test('minecraft: sem as texturas de uma, a outra faz as vezes; sem nenhuma, nada', () => {
  const guardadas = {}, outra = { cama: 'pesca', pesca: 'cama' };
  // só as que são dela (picareta, poof... as duas usam)
  const tirar = id => {
    for (const n of modulo('minecraft', id).texturas) {
      if (modulo('minecraft', outra[id]).texturas.includes(n)) continue;
      if (IMG[n]) guardadas[n] = IMG[n];
      delete IMG[n];
    }
  };
  try {
    tirar('cama');
    let m = novoMundo('minecraft');
    assert.strictEqual(esperarCena(m), 'pesca');
    tirar('pesca');
    m = novoMundo('minecraft');
    andar(m, 0, 120);
    assert.strictEqual(m.cena, null, 'sem textura nenhuma: fica parado como sempre');
  } finally { Object.assign(IMG, guardadas); }
});
