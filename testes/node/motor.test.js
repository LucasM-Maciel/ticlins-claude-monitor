'use strict';
// O motor das animações visto de fora, como a janelinha vê (docs/MOTOR.md): um processo
// node, uma linha JSON por mensagem na entrada, mensagens binárias "CM" na saída.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawn } = require('child_process');
const { estadoDeMentira } = require('../motor-foto');

const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor', 'motor.js');

function abrir(argumentos = []) {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-motor-'));
  const p = spawn(process.execPath, [MOTOR, '--pasta', pasta, ...argumentos], { stdio: ['pipe', 'pipe', 'pipe'] });
  const chegou = [], esperando = [];
  let resto = Buffer.alloc(0);
  p.stdout.on('data', pedaco => {
    resto = Buffer.concat([resto, pedaco]);
    while (resto.length >= 8) {
      assert.strictEqual(resto.toString('latin1', 0, 2), 'CM', 'mensagem fora do formato');
      const n = resto.readUInt32LE(4);
      if (resto.length < 8 + n) break;
      chegou.push({ tipo: String.fromCharCode(resto[2]), dados: Buffer.from(resto.subarray(8, 8 + n)) });
      resto = resto.subarray(8 + n);
    }
    for (const e of esperando.splice(0)) e();
  });
  const saiu = new Promise(ok => p.on('exit', codigo => ok(codigo)));
  // a próxima mensagem desse tipo que ainda não foi pega
  let lidas = 0;
  function proxima(tipo, ms = 8000) {
    return new Promise((ok, erro) => {
      const limite = setTimeout(() => erro(new Error(`não chegou ${tipo} em ${ms} ms`)), ms);
      const olhar = () => {
        const i = chegou.findIndex((m, k) => k >= lidas && m.tipo === tipo);
        if (i >= 0) { lidas = i + 1; clearTimeout(limite); ok(chegou[i]); } else esperando.push(olhar);
      };
      olhar();
    });
  }
  return {
    p, chegou, saiu, proxima,
    enviar: o => p.stdin.write((typeof o === 'string' ? o : JSON.stringify(o)) + '\n'),
    fechar: () => { p.kill(); fs.rmSync(pasta, { recursive: true, force: true }); },
  };
}
function quadro(m) {
  const [W, H, x, y, w, h] = [0, 2, 4, 6, 8, 10].map(i => m.dados.readUInt16LE(i));
  return { W, H, x, y, w, h, bytes: m.dados.length - 12 };
}

test('ao abrir manda P com o layout completo de cada tema', async () => {
  const m = abrir();
  try {
    const p = JSON.parse((await m.proxima('P')).dados.toString('utf8'));
    assert.strictEqual(p.pronto, true);
    for (const nome of ['padrao', 'minecraft']) {
      const l = p.temas[nome];
      assert.ok(l, `sem o tema ${nome}`);
      for (const k of ['raio', 'fundo', 'moldura', 'padding', 'enfeites', 'colunas', 'letra', 'barra']) assert.ok(k in l, `${nome}: layout sem ${k}`);
      assert.strictEqual(l.moldura.length, 4);
    }
  } finally { m.fechar(); }
});

test('o 1º quadro é a tela inteira; os seguintes só o pedaço que mudou', async () => {
  const m = abrir();
  try {
    m.enviar(estadoDeMentira('padrao', 'andando'));
    const q1 = quadro(await m.proxima('Q'));
    assert.deepStrictEqual([q1.W, q1.H, q1.x, q1.y, q1.w, q1.h], [380, 440, 0, 0, 380, 440]);
    assert.strictEqual(q1.bytes, 380 * 440 * 4);
    const q2 = quadro(await m.proxima('Q'));  // o Clawd andando: muda pouco
    assert.ok(q2.w * q2.h < 380 * 440 / 4, `pedaço grande demais: ${q2.w}x${q2.h}`);
    assert.strictEqual(q2.bytes, q2.w * q2.h * 4);
    assert.ok(q2.x + q2.w <= 380 && q2.y + q2.h <= 440);
  } finally { m.fechar(); }
});

test('escala: o quadro vem em pixels da tela (DIPs x escala)', async () => {
  const m = abrir();
  try {
    m.enviar({ ...estadoDeMentira('padrao', 'parado'), escala: 1.25 });
    const q = quadro(await m.proxima('Q'));
    assert.deepStrictEqual([q.W, q.H], [475, 550]);
  } finally { m.fechar(); }
});

test('mensagem ruim vira linha no diário e o motor segue desenhando', async () => {
  const m = abrir();
  try {
    m.enviar('isto não é json');
    let l;  // antes pode vir o "sem as texturas" do começo
    do l = (await m.proxima('L')).dados.toString('utf8'); while (!/mensagem ruim/.test(l));
    m.enviar(estadoDeMentira('padrao', 'andando'));
    await m.proxima('Q');
  } finally { m.fechar(); }
});

test('tema que não existe cai no Padrão', async () => {
  const m = abrir();
  try {
    m.enviar(estadoDeMentira('nao-existe', 'andando'));
    const q = quadro(await m.proxima('Q'));
    assert.strictEqual(q.W, 380);
  } finally { m.fechar(); }
});

test('--foto: só fotografa quando a janelinha pede, manda 1 quadro e sai', async () => {
  const m = abrir(['--foto', '1', '--semente', '7', '--hora', '12']);
  try {
    m.enviar(estadoDeMentira('padrao', 'andando'));
    await new Promise(ok => setTimeout(ok, 400));
    assert.ok(!m.chegou.some(x => x.tipo === 'Q'), 'fotografou antes do pedido');
    m.enviar({ msg: 'foto' });
    const q = quadro(await m.proxima('Q'));
    assert.deepStrictEqual([q.x, q.y, q.w, q.h], [0, 0, 380, 440]);
    assert.strictEqual(await m.saiu, 0);
  } finally { m.fechar(); }
});

test('a janelinha fechou (entrada acabou): o motor sai', async () => {
  const m = abrir();
  try {
    await m.proxima('P');
    m.p.stdin.end();
    assert.strictEqual(await m.saiu, 0);
  } finally { m.fechar(); }
});

test('cena que quebrou não é pedida de novo a cada quadro', () => {
  const { Mundo } = require(path.join(path.dirname(MOTOR), 'mundo'));
  let pedidas = 0;
  const tema = { nome: 'falso', naParada: () => { pedidas++; return { nome: 'quebrada', dur: 1 }; } };
  const m = new Mundo({ tema, semente: 1 });
  m.receber(estadoDeMentira('padrao', 'andando'));
  m.ruins.add('quebrada');
  m.temEspaco = () => true;
  m.proxima = 0;
  for (let T = 0.05; T <= 5; T += 0.05) m.passo(T);  // 100 quadros: a próxima parada fica 20-45 s depois
  assert.strictEqual(pedidas, 1);
});
