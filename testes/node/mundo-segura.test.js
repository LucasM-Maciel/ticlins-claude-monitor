'use strict';
// mundo.js com `segura` (o motor.js liga 5 s): um parado no meio da caminhada sem o 'tudo' antes
// (a lista piscou: uma sessão sumiu por uma atualização) não congela o Clawd nem o devolve pro
// meio de cima (dono 28/10, Elden: "dá 1 2 3 passos, trava e volta"). Parado que dura vale;
// com o 'tudo' (o overlay.ps1 manda antes do estado) vale na hora; pulando e oculto também.
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const { estadoDeMentira } = require('../motor-foto');

const SEGURA = 5;
const tema = nome => require(path.join(MOTOR, `tema-${nome}`));

function andando(nome = 'elden', opcoes = { segura: SEGURA }) {
  const m = new Mundo({ tema: tema(nome), semente: 7, relogio: () => new Date(2026, 9, 5, 12, 0, 0), ...opcoes });
  m.estadoDe = modo => ({ ...estadoDeMentira(nome, modo), escala: 1 });
  m.receber(m.estadoDe('andando'));
  m.ate = T => { for (let s = m.T + 1 / 30; s < T; s += 1 / 30) m.passo(s); m.passo(T); };
  m.ate(3);
  return m;
}

test('piscada de parado (2 s) no meio da caminhada: segue andando de onde estava', () => {
  const m = andando();
  const meioDeCima = (() => { const g = m.geometria(); return g.w / 2 - g.r; })();
  m.receber(m.estadoDe('parado'));
  assert.strictEqual(m.modo, 'andando');
  const antes = m.dist;
  m.ate(5);
  assert.strictEqual(m.modo, 'andando');
  assert.ok(m.dist > antes + 90, `andou ${m.dist - antes} px em 2 s`);
  m.receber(m.estadoDe('andando'));
  assert.strictEqual(m.modo, 'andando');
  assert.ok(m.dist > antes + 90 && m.dist !== meioDeCima, 'não voltou pro meio de cima');
  m.ate(30);
  assert.strictEqual(m.modo, 'andando', 'a piscada não ficou pendurada');
});

test('parado que dura mais que o segura vale (e o tempo parado conta dali)', () => {
  const m = andando();
  m.receber(m.estadoDe('parado'));
  m.ate(3 + SEGURA - 0.1);
  assert.strictEqual(m.modo, 'andando');
  m.ate(3 + SEGURA + 0.1);
  assert.strictEqual(m.modo, 'parado');
  assert.ok(Math.abs(m.desdeModo - (3 + SEGURA)) < 0.1);
});

test("com o 'tudo' antes (o normal: acabou a última), para na hora", () => {
  const m = andando();
  m.evento('tudo');
  m.receber(m.estadoDe('parado'));
  assert.strictEqual(m.modo, 'parado');
});

test("parado esperando e chega o 'tudo': para na hora", () => {
  const m = andando();
  m.receber(m.estadoDe('parado'));
  m.ate(4);
  m.evento('tudo');
  assert.strictEqual(m.modo, 'parado');
});

test("Padrão: a festa do 'tudo' continua (tudo + parado na mesma atualização)", () => {
  const m = andando('padrao');
  m.evento('tudo');
  m.receber(m.estadoDe('parado'));
  m.ate(3.5);
  assert.strictEqual(m.cena && m.cena.nome, 'festa');
});

test('pulando e oculto passam na hora (a pergunta tem que aparecer)', () => {
  const m = andando();
  m.receber(m.estadoDe('parado'));
  m.receber(m.estadoDe('pulando'));
  assert.strictEqual(m.modo, 'pulando');
  m.ate(3 + SEGURA + 1);
  assert.strictEqual(m.modo, 'pulando', 'o parado que esperava não volta depois');
  const o = andando();
  o.receber({ ...o.estadoDe('parado'), cartao: null });
  assert.strictEqual(o.modo, 'oculto');
});

test('sem segura (os outros testes, o -Foto): parado vale na hora, como sempre', () => {
  const m = andando('elden', {});
  m.receber(m.estadoDe('parado'));
  assert.strictEqual(m.modo, 'parado');
});
