'use strict';
// motor/som.js: o som das cenas épicas. A leitura dos .wav (formatos que aparecem por aí), a
// mixagem (quando, quanto, tom, corte com fade, o que falta, o teto), o Mundo avisando quando a
// trilha começa e para, e a trilha de cada épico: só arquivos que existem, dentro da cena.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const JANELINHA = path.join(__dirname, '..', '..', 'extensao', 'janelinha');
const MOTOR = path.join(JANELINHA, 'motor');
const { TAXA, lerWav, mixar } = require(path.join(MOTOR, 'som'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const { SONS, TONS } = require(path.join(JANELINHA, 'minecraft'));
const { estadoDeMentira } = require('../motor-foto');

// um .wav com as amostras já no formato (inteiros ou float), intercaladas por canal
function fazWav({ tipo = 1, bits = 16, canais = 1, taxa = TAXA, amostras, extensivel = false, antes = null }) {
  const B = bits / 8, dados = Buffer.alloc(amostras.length * B);
  amostras.forEach((v, i) => {
    if (tipo === 3) dados.writeFloatLE(v, i * B);
    else if (bits === 8) dados[i] = v;
    else dados.writeIntLE(v, i * B, B);
  });
  const fmt = Buffer.alloc(extensivel ? 40 : 16);
  fmt.writeUInt16LE(extensivel ? 0xFFFE : tipo, 0); fmt.writeUInt16LE(canais, 2); fmt.writeUInt32LE(taxa, 4);
  fmt.writeUInt32LE(taxa * canais * B, 8); fmt.writeUInt16LE(canais * B, 12); fmt.writeUInt16LE(bits, 14);
  if (extensivel) { fmt.writeUInt16LE(22, 16); fmt.writeUInt16LE(bits, 18); fmt.writeUInt16LE(tipo, 24); }  // o GUID começa com o formato
  const pedaco = (id, b) => Buffer.concat([Buffer.from(id, 'latin1'), Buffer.from(new Uint32Array([b.length]).buffer), b, b.length & 1 ? Buffer.alloc(1) : Buffer.alloc(0)]);
  const corpo = Buffer.concat([Buffer.from('WAVE', 'latin1'), pedaco('fmt ', fmt), ...(antes ? [pedaco(antes[0], antes[1])] : []), pedaco('data', dados)]);
  return Buffer.concat([Buffer.from('RIFF', 'latin1'), Buffer.from(new Uint32Array([corpo.length]).buffer), corpo]);
}
const perto = (a, b, msg) => assert.ok(Math.abs(a - b) < 1e-4, `${msg}: ${a} != ${b}`);
const comoLista = w => Array.from(w.amostras);

test('lerWav: 8, 16, 24 e 32 bits, float, estéreo (vira mono), extensível e pedaço extra no meio', () => {
  const casos = [
    [{ bits: 8, amostras: [128, 192, 0] }, [0, 0.5, -1]],
    [{ bits: 16, amostras: [0, 16384, -32768] }, [0, 0.5, -1]],
    [{ bits: 24, amostras: [0, 4194304, -8388608] }, [0, 0.5, -1]],
    [{ bits: 32, amostras: [0, 1073741824, -2147483648] }, [0, 0.5, -1]],
    [{ tipo: 3, bits: 32, amostras: [0, 0.5, -1] }, [0, 0.5, -1]],
    [{ canais: 2, amostras: [16384, 0, -16384, -16384] }, [0.25, -0.5]],
    [{ bits: 24, extensivel: true, amostras: [4194304] }, [0.5]],
    [{ tipo: 3, bits: 32, extensivel: true, amostras: [-0.25] }, [-0.25]],
    [{ antes: ['LIST', Buffer.from('abc')], amostras: [16384] }, [0.5]],  // tamanho ímpar: tem o byte de folga
  ];
  for (const [w, esperado] of casos) {
    const lido = lerWav(fazWav({ taxa: 22050, ...w }));
    assert.strictEqual(lido.taxa, 22050);
    assert.strictEqual(lido.amostras.length, esperado.length, JSON.stringify(w));
    esperado.forEach((v, i) => perto(lido.amostras[i], v, `${JSON.stringify(w)} [${i}]`));
  }
  assert.throws(() => lerWav(Buffer.from('não é um wav, é um texto')), /não é \.wav/);
  assert.throws(() => lerWav(fazWav({ tipo: 2, bits: 4, amostras: [] })), /não sei ler/);  // ADPCM
});

// pistas com arquivos de mentira: 'meio' = 100 amostras em 0,5, 'lento' = o mesmo em 22050 Hz
const ARQUIVOS = {
  meio: fazWav({ amostras: new Array(100).fill(16384) }),
  lento: fazWav({ taxa: 22050, amostras: new Array(100).fill(16384) }),
  longo: fazWav({ amostras: new Array(TAXA).fill(16384) }),  // 1 s
  rampa: fazWav({ amostras: Array.from({ length: 101 }, (_, i) => i * 300) }),
};
const ler = a => { if (!ARQUIVOS[a]) throw new Error('não existe'); return ARQUIVOS[a]; };
const mix = (pistas, faltando) => { const b = mixar(pistas, ler, faltando); return b && lerWav(b); };

test('mixar: o .wav sai mono, 16 bits, 44100', () => {
  const b = mixar([[0, 'meio']], ler);
  assert.strictEqual(b.toString('latin1', 0, 4), 'RIFF');
  assert.deepStrictEqual([b.readUInt16LE(20), b.readUInt16LE(22), b.readUInt32LE(24), b.readUInt16LE(34)], [1, 1, TAXA, 16]);
  assert.strictEqual(b.readUInt32LE(40), b.length - 44);
});

test('mixar: começa no t, com o ganho, e soma o que toca junto', () => {
  const w = mix([[0.5, 'meio', 0.5]]);
  const i0 = 0.5 * TAXA;
  assert.strictEqual(w.amostras.length, i0 + 100);
  assert.ok(comoLista(w).slice(0, i0).every(v => v === 0), 'tocou antes do t');
  for (const i of [i0, i0 + 50, i0 + 99]) perto(w.amostras[i], 0.25, `amostra ${i}`);
  const dois = mix([[0, 'meio', 0.5], [50 / TAXA, 'meio', 0.25]]);
  assert.strictEqual(dois.amostras.length, 150);
  perto(dois.amostras[10], 0.25, 'só o 1º');
  perto(dois.amostras[70], 0.375, 'os dois juntos');
  perto(dois.amostras[120], 0.125, 'só o 2º');
});

test('mixar: tom (mais agudo = mais curto, interpolando) e arquivo em outra taxa', () => {
  const agudo = mix([[0, 'rampa', 1, 2]]);
  assert.strictEqual(agudo.amostras.length, 51);
  perto(agudo.amostras[10], 20 * 300 / 32768, 'tom 2 pula de 2 em 2');
  const meio = mix([[0, 'rampa', 1, 1.5]]);
  perto(meio.amostras[1], 1.5 * 300 / 32768, 'entre duas amostras: a reta entre elas');
  assert.strictEqual(mix([[0, 'lento']]).amostras.length, 199, '22050 Hz dura o dobro em 44100');
});

test('mixar: dur corta ali, sumindo (fade de até 0,25 s, um quarto da dur se ela for curta)', () => {
  const curto = mix([[0, 'longo', 1, 1, 0.1]]);
  const m = Math.floor(0.1 * TAXA), some = Math.round(0.025 * TAXA);
  assert.strictEqual(curto.amostras.length, m + 1);
  perto(curto.amostras[m - some], 0.5, 'antes do fade: inteiro');
  perto(curto.amostras[m - 551], 0.5 * 551 / some, 'no meio do fade: ~metade');
  assert.strictEqual(curto.amostras[m], 0, 'o fim em silêncio (sem estalo)');
  const longo = mix([[0, 'longo', 1, 1, 0.8]]), M = Math.floor(0.8 * TAXA);
  perto(longo.amostras[M - Math.round(0.25 * TAXA)], 0.5, 'dur longa: o fade é de 0,25 s');
  assert.strictEqual(mix([[0, 'meio', 1, 1, 10]]).amostras.length, 100, 'dur maior que o som: toca ele inteiro');
});

test('mixar: o que falta fica de fora (anotado uma vez) e o resto toca; nada pra tocar = null', () => {
  const faltando = [];
  const w = mix([[0, 'sumiu'], [0, 'meio', 0.5], [0.001, 'sumiu']], faltando);
  assert.deepStrictEqual(faltando, ['sumiu']);
  assert.strictEqual(w.amostras.length, 100);
  assert.strictEqual(mixar([[0, 'sumiu']], ler), null);
  assert.strictEqual(mixar([], ler), null);
  assert.strictEqual(mixar([[-1, 'meio'], [0, 'meio', 1, 1, 0], [NaN, 'meio']], ler), null, 't negativo, dur 0 e t inválido não tocam');
});

test('mixar: passou de 0,98 abaixa tudo junto (sem distorcer), e o que está abaixo fica igual', () => {
  const alto = mix([[0, 'meio', 1.6], [0, 'meio', 1.6], [100 / TAXA, 'meio', 0.4]]);
  perto(alto.amostras[50], 0.98, 'o pico vira 0,98');  // 1,6 = 0,8 + 0,8 -> 0,98
  perto(alto.amostras[150], 0.2 * 0.98 / 1.6, 'o resto abaixa na mesma proporção');
  perto(mix([[0, 'meio', 1.9]]).amostras[0], 0.95, 'abaixo do teto: igual');
});

// -- o Mundo: a trilha começa junto com a cena e para se ela for cortada --
const TEMA = { layout: { raio: 0, moldura: [6, 8, 6, 6] }, trilha: { raio: 1 }, clawd() {}, naParada() { return null; } };
function mundoOuvindo() {
  const m = new Mundo({ tema: TEMA, semente: 7 }), ouviu = [];
  m.aoSom = c => ouviu.push(c && c.nome);
  m.receber(estadoDeMentira('minecraft', 'andando'));
  m.proxima = Infinity;
  return { m, ouviu };
}
const cenaCom = sons => ({ nome: 'teste', dur: 2, espaco: { frente: 0, tras: 0 }, modos: ['andando'], ...(sons ? { sons } : {}), quadro() {} });

test('Mundo: aoSom com a cena quando ela começa; até o fim natural, mais nada', () => {
  const { m, ouviu } = mundoOuvindo();
  m.comecarCena(cenaCom([[0, 'meio']]));
  assert.deepStrictEqual(ouviu, ['teste']);
  m.passo(1); m.passo(2.05);
  assert.strictEqual(m.cena, null, 'acabou');
  assert.deepStrictEqual(ouviu, ['teste'], 'o fim natural não manda parar: o som acaba sozinho');
});

test('Mundo: cortada (pergunta no meio, ou quebrou) manda parar; cena sem sons não fala com o som', () => {
  const { m, ouviu } = mundoOuvindo();
  m.comecarCena(cenaCom([[0, 'meio']]));
  m.receber({ modo: 'pulando' });  // a pergunta: interrompe a cena
  assert.deepStrictEqual(ouviu, ['teste', null]);
  const b = mundoOuvindo();
  b.m.comecarCena({ ...cenaCom([[0, 'meio']]), quadro() { throw new Error('quebrou'); } });
  b.m.aoErro = () => {};
  b.m.desenhar({ save() {}, restore() {}, translate() {}, rotate() {} });
  assert.deepStrictEqual(b.ouviu, ['teste', null]);
  const c = mundoOuvindo();
  c.m.comecarCena(cenaCom(null));
  c.m.receber({ modo: 'pulando' });
  assert.deepStrictEqual(c.ouviu, []);
});

// -- a trilha de cada épico: só arquivos que existem, tudo dentro da cena, e mixa sem faltar nada --
const naJanelinha = a => fs.readFileSync(path.join(JANELINHA, a));
function conferirTrilha(cena, nome, existe, lerArquivo) {
  assert.ok(Array.isArray(cena.sons) && cena.sons.length >= 5, `${nome}: cadê a trilha?`);
  for (const [t, arquivo, ganho, tom = 1, dur = 1] of cena.sons) {
    assert.ok(t >= 0 && t < cena.dur, `${nome}: ${arquivo} em t=${t}, fora da cena (${cena.dur} s)`);
    assert.ok(ganho > 0 && ganho <= 1 && tom > 0 && dur > 0, `${nome}: ${arquivo} com ganho ${ganho}, tom ${tom}, dur ${dur}`);
    assert.ok(existe(arquivo), `${nome}: ${arquivo} não existe`);
  }
  if (!lerArquivo) return;
  const faltando = [], wav = mixar(cena.sons, lerArquivo, faltando);
  assert.deepStrictEqual(faltando, [], nome);
  const s = (wav.length - 44) / 2 / TAXA;
  assert.ok(s > cena.dur * 0.6 && s < cena.dur + 3, `${nome}: a trilha tem ${s.toFixed(1)} s (cena de ${cena.dur.toFixed(1)} s)`);
}
const existeNaJanelinha = pasta => a => a.startsWith(pasta + '/') && fs.existsSync(path.join(JANELINHA, a));

test('trilha dos épicos do Padrão (Invaders em 6 sementes, Kaiju em 3): sons-padrao, dentro da cena', () => {
  const tema = require(path.join(MOTOR, 'tema-padrao'));
  for (const [id, sementes] of [['invaders', [1, 2, 3, 7, 11, 42]], ['kaiju', [1, 7, 42]]]) {
    const epico = require(path.join(MOTOR, `padrao-epico-${id}`));
    for (const semente of sementes) {
      const m = new Mundo({ tema, semente });
      m.receber(estadoDeMentira('padrao', 'andando'));
      conferirTrilha(epico.cena(m), `${id}, semente ${semente}`, existeNaJanelinha('sons-padrao'), naJanelinha);
    }
  }
});

test('trilha do Shenlong (cartão baixo e alto): sons-dragonball, dentro da cena', () => {
  const tema = require(path.join(MOTOR, 'tema-dragonball'));
  const durs = [1, 8].map(sessoes => {
    const m = new Mundo({ tema, semente: 2 });
    m.receber(estadoDeMentira('dragonball', 'andando', { sessoes }));
    const cena = tema.cenaPorNome(m, 'dragao');
    conferirTrilha(cena, `dragão, ${sessoes} sessões`, existeNaJanelinha('sons-dragonball'), naJanelinha);
    return cena.dur;
  });
  assert.notStrictEqual(durs[0], durs[1], 'o cartão maior não mudou a volta do dragão');
});

test('trilha do Ender Dragon: só sons que o minecraft.js baixa da Mojang (e, com eles na máquina, mixa inteira)', (t) => {
  const dragao = require(path.join(MOTOR, 'minecraft-dragao'));
  const nomes = new Set(Object.keys(SONS).flatMap(n => TONS[n] ? TONS[n].map((_, i) => n + (i + 1)) : [n]));
  const baixa = a => { const k = /^sons\/(.+)\.wav$/.exec(a); return !!k && nomes.has(k[1]); };
  // os sons de verdade (CM_TEXTURAS ou ~/.claude-monitor, a 1ª que tiver todos), se houver
  const pasta = [process.env.CM_TEXTURAS, path.join(os.homedir(), '.claude-monitor')]
    .find(p => p && [...nomes].every(n => fs.existsSync(path.join(p, 'sons', n + '.wav'))));
  const lerArquivo = pasta && (a => fs.readFileSync(path.join(pasta, a)));
  t.diagnostic(pasta ? `mixou com os sons de ${pasta}` : 'sem os sons da Mojang nesta máquina: só os nomes');
  let levelups = 0;
  for (const nivel of [4, 9, 12, 30]) {
    for (const [sessoes, dist] of [[1, 140], [8, 300]]) {
      const m = new Mundo({ tema: { ...TEMA, nivel: () => nivel }, semente: 7 });
      m.receber(estadoDeMentira('minecraft', 'andando', { sessoes }));
      m.dist = dist;
      const cena = dragao.cena(m);
      conferirTrilha(cena, `dragão MC, nível ${nivel}, ${sessoes} sessões`, baixa, lerArquivo);
      levelups += cena.sons.filter(s => s[1] === 'sons/levelup.wav').length;
    }
  }
  assert.ok(levelups > 0, 'o levelup a cada 5 níveis nunca tocou');
});
