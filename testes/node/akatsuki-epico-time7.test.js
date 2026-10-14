'use strict';
// motor/akatsuki-epico-time7.js: o épico do lado Time 7 (os três do time, a cada 30 bugs).
// A cena inteira quadro a quadro em 3 escalas, 3 roupas e 3 cartões, mesmo instante = mesmos
// bytes, o custo, o Clawd de volta no lugar no fim, a trilha, quem é quem em cada roupa (de azul ou
// de laranja ele é um dos três; de colete, o mestre, e chegam os três) e o plano dentro do palco.
// Ver a olho: node testes/motor-foto.js --tema akatsuki --cena epico --tira 1,4.7,7.4,9.05,10.8 --escala 1.25 --saida f.png
// (com o motor-estado.json do Time 7: akaRoupa t7-laranja, akaVoltas 50)
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const epico = require(path.join(MOTOR, 'akatsuki-epico-time7'));
const A = require(path.join(MOTOR, 'akatsuki-arte'));
const { Tela } = require(path.join(MOTOR, 'raster'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const { lerWav } = require(path.join(MOTOR, 'som'));
const tema = require(path.join(MOTOR, 'tema-akatsuki'));
const { estadoDeMentira } = require('../motor-foto');

const JANELINHA = path.join(MOTOR, '..');
const VOLTAS = { 't7-laranja': 50, 't7-colete': 150, 't7-azul': 250 };
const ROUPAS = Object.keys(VOLTAS);
// o Clawd (na roupa) parado na reta de cima (fração 'onde' dela) e a cena começando em T = 0;
// largura: outro cartão, mais estreito (o mesmo canto de baixo à direita)
function novoMundo({ escala = 1, onde = 0.5, semente = 7, sessoes = 4, largura = null, roupa = 't7-laranja', cena = epico.cena } = {}) {
  const m = new Mundo({ tema, semente });
  Object.assign(m.salvo, { akaRoupa: roupa, akaVoltas: VOLTAS[roupa] });
  m.erros = [];
  m.aoErro = e => m.erros.push(e);
  const est = estadoDeMentira('akatsuki', 'andando', { sessoes });
  if (largura) { const [x, y, w, h] = est.cartao; est.cartao = [x + w - largura, y, largura, h]; }
  m.receber({ ...est, escala });
  if (m.cena) m.fimCena(true);
  const g = m.geometria();
  m.dist = (g.w - 2 * g.r) * onde;
  m.proxima = Infinity;
  m.comecarCena(cena(m));
  return m;
}
const telaDa = escala => new Tela(Math.round(380 * escala), Math.round(440 * escala));
function quadro(m, tela, escala) {
  const g = tela.getContext('2d');
  tela.limpar();
  g.setTransform(escala, 0, 0, escala, 0, 0);
  g.globalAlpha = 1;
  m.desenhar(g);
}
const passo = (m, T) => { m.passo(T); m.proxima = Infinity; };
const CARTOES = [{ sessoes: 4, onde: 0.5 }, { sessoes: 8, onde: 0.1 }, { sessoes: 12, onde: 0.95, largura: 200 }];

test('o módulo: linha do tempo e a cena no formato combinado (11 a 15 s, reta de cima, só andando)', () => {
  assert.ok(Array.isArray(epico.linhaDoTempo) && epico.linhaDoTempo.length >= 6);
  for (const [t, txt] of epico.linhaDoTempo) assert.ok(typeof t === 'number' && typeof txt === 'string' && txt.length);
  const c = novoMundo().cena;
  assert.strictEqual(c.nome, 'epico');
  assert.ok(c.dur >= 11 && c.dur <= 15, `dur ${c.dur}`);
  assert.deepStrictEqual(c.espaco, { frente: 0, tras: 0 });
  assert.deepStrictEqual(c.modos, ['andando']);
  assert.strictEqual(typeof c.quadro, 'function');
});

test('quem é quem: de azul ou de laranja ele é um dos três (chegam os outros dois); de colete, o mestre (chegam os três)', () => {
  const { TRIO, MESTRE } = epico;
  assert.deepStrictEqual(TRIO, ['t7-azul', 't7-laranja', 't7-rosa']);
  for (const roupa of ROUPAS) {
    const J = novoMundo({ roupa }).cena.plano;
    if (roupa === MESTRE) {
      assert.strictEqual(J.eu, MESTRE);
      assert.deepStrictEqual(J.ajudantes, TRIO);
      assert.ok(J.lugar[MESTRE] < J.lugar['t7-azul'], 'o mestre fica atrás (à esquerda)');
    } else {
      assert.strictEqual(J.eu, roupa);
      assert.deepStrictEqual(J.ajudantes, TRIO.filter(r => r !== roupa));
    }
    assert.ok(J.lugar['t7-azul'] < J.lugar['t7-laranja'] && J.lugar['t7-laranja'] < J.lugar['t7-rosa'], roupa);
  }
});

test('a cena inteira, quadro a quadro (30/s), nas escalas 1, 1,25 e 2, nas 3 roupas e em 3 cartões: sem erro, pintando, e acaba', () => {
  try {
    for (const escala of [1, 1.25, 2]) {
      for (const [i, cartao] of CARTOES.entries()) {
        const roupa = ROUPAS[i];
        const tela = telaDa(escala), m = novoMundo({ escala, roupa, ...cartao }), dur = m.cena.dur, onde_ = `escala ${escala}, ${roupa}, ${JSON.stringify(cartao)}`;
        let meio = 0;
        for (let n = 1; n / 30 < dur; n++) {
          passo(m, n / 30);
          assert.ok(m.cena && m.cena.nome === 'epico', `acabou antes da hora em ${n / 30} (${onde_})`);
          quadro(m, tela, escala);
          if (n === 150) meio = tela.pixels.filter(p => p !== 0).length;
        }
        assert.deepStrictEqual([m.erros, [...m.ruins]], [[], []], onde_);
        assert.ok(meio > 20000 * escala * escala, `o palco pinta pouco no meio (${onde_}): ${meio}`);
        assert.strictEqual(A.COR.roupa, roupa, `a roupa dele volta no fim do quadro (${onde_})`);
        passo(m, dur + 0.05);
        assert.strictEqual(m.cena, null, `não terminou (${onde_})`);
      }
    }
  } finally { A.vestir('akatsuki'); }
});

test('mesmo instante = mesmos bytes, de quadro em quadro ou pulando direto pro instante', () => {
  try {
    for (const escala of [1, 1.25]) {
      for (const roupa of ['t7-laranja', 't7-colete']) {
        const a = novoMundo({ escala, roupa }), dur = a.cena.dur, ta = telaDa(escala), tb = telaDa(escala);
        const instantes = [0.2, 0.6, 1.0, 2.7, 3.8, 4.8, 6.6, 7.9, 8.7, 9.05, 9.8, 10.9, 11.5, 12.0, dur - 0.05].map(t => Math.round(t * 30) / 30);
        let i = 0;
        for (let n = 1; n / 30 < dur && i < instantes.length; n++) {
          passo(a, n / 30);
          if (Math.abs(n / 30 - instantes[i]) > 1e-9) continue;
          quadro(a, ta, escala);
          const b = novoMundo({ escala, roupa });  // b só existe no instante da foto
          passo(b, n / 30);
          quadro(b, tb, escala);
          assert.ok(ta.bgra().equals(tb.bgra()), `t=${instantes[i]}, escala ${escala}, ${roupa}`);
          quadro(a, tb, escala);  // de novo, no mesmo instante
          assert.ok(ta.bgra().equals(tb.bgra()), `repetido, t=${instantes[i]}`);
          i++;
        }
        assert.strictEqual(i, instantes.length);
      }
    }
  } finally { A.vestir('akatsuki'); }
});

test('custo por quadro na escala 1,25 (alvo: mediana abaixo de 4 ms, pior abaixo de 12; falha só acima de 10 e 50)', (t) => {
  const escala = 1.25, tela = telaDa(escala), linhas = [];
  let todas = [];
  try {
    for (const roupa of ROUPAS) {
      const rodar = (vezes) => {
        const m = novoMundo({ escala, roupa });
        const ms = [];
        for (let n = 1; n / 30 < m.cena.dur; n++) {
          passo(m, n / 30);
          let melhor = Infinity;
          for (let k = 0; k < vezes; k++) {  // o menor de 3: a máquina oscila (e roda outros testes junto)
            const a = process.hrtime.bigint();
            quadro(m, tela, escala);
            melhor = Math.min(melhor, Number(process.hrtime.bigint() - a) / 1e6);
          }
          ms.push(melhor);
        }
        return ms;
      };
      rodar(1);  // aquece o JIT e deixa prontos o céu, o guerreiro e a raposa
      const ms = rodar(3).sort((a, b) => a - b);
      linhas.push(`${roupa} ${ms[ms.length >> 1].toFixed(2)}/${ms[ms.length - 1].toFixed(2)}`);
      todas = todas.concat(ms);
    }
  } finally { A.vestir('akatsuki'); }
  todas.sort((a, b) => a - b);
  const mediana = todas[todas.length >> 1], pior = todas[todas.length - 1];
  t.diagnostic(`ms por quadro (mediana/pior): ${linhas.join(', ')}; todas ${mediana.toFixed(2)}/${pior.toFixed(2)}, p95 ${todas[Math.floor(todas.length * 0.95)].toFixed(2)}`);
  assert.ok(mediana < 10, `mediana ${mediana.toFixed(2)} ms (alvo 4)`);
  assert.ok(pior < 50, `pior quadro ${pior.toFixed(2)} ms (alvo 12)`);
});

test('o último quadro é o Clawd de sempre, na roupa dele, no lugar onde começou', () => {
  const pronto = () => ({ nome: 'pronto', dur: 100, espaco: { frente: 0, tras: 0 }, modos: ['andando'], quadro(g, t, mundo) { A.clawdAkatsuki(g, { T: mundo.T }); } });
  try {
    for (const roupa of ROUPAS) {
      for (const escala of [1, 1.25, 2]) {
        for (const onde of [0.05, 0.5, 0.95]) {
          const m = novoMundo({ escala, onde, roupa }), dur = m.cena.dur, ref = novoMundo({ escala, onde, roupa, cena: pronto });
          const ta = telaDa(escala), tb = telaDa(escala);
          for (let n = 1; n / 30 < dur; n++) passo(m, n / 30);
          passo(m, dur - 0.01);
          passo(ref, dur - 0.01);
          assert.deepStrictEqual([m.pose().x, m.pose().y], [ref.pose().x, ref.pose().y], 'o Mundo não andou com ele');
          quadro(m, ta, escala); quadro(ref, tb, escala);
          assert.ok(ta.bgra().equals(tb.bgra()), `${roupa}, escala ${escala}, onde ${onde}: o último quadro não é o Clawd de sempre`);
        }
      }
    }
  } finally { A.vestir('akatsuki'); }
});

test('cortada no meio (pergunta): encerra sem erro, e o tema volta a desenhar o Clawd na roupa dele', () => {
  try {
    for (const roupa of ROUPAS) {
      const m = novoMundo({ escala: 1.25, roupa }), tela = telaDa(1.25);
      for (let n = 1; n <= 7 * 30; n++) { passo(m, n / 30); quadro(m, tela, 1.25); }
      m.receber({ modo: 'pulando' });
      assert.strictEqual(m.cena, null);
      for (let n = 7 * 30 + 1; n <= 8 * 30; n++) { passo(m, n / 30); quadro(m, tela, 1.25); }
      assert.deepStrictEqual(m.erros, []);
      assert.strictEqual(A.COR.roupa, roupa);
    }
  } finally { A.vestir('akatsuki'); }
});

test('a trilha: todo som existe, é WAV que o motor lê, cai dentro da cena e no volume dos outros épicos', () => {
  for (const roupa of ROUPAS) {
    const c = novoMundo({ roupa }).cena;
    assert.ok(c.sons.length >= 12, `${c.sons.length} sons`);
    for (const [t, arquivo, ganho] of c.sons) {
      assert.ok(t >= 0 && t < c.dur, `${arquivo} em ${t}`);
      assert.ok(ganho > 0 && ganho <= 1, `${arquivo} ganho ${ganho}`);
      const f = path.join(JANELINHA, arquivo);
      assert.ok(fs.existsSync(f), `falta ${f}`);
      assert.ok(lerWav(fs.readFileSync(f)).amostras.length > 100, arquivo);
    }
    // um puf por quem chega (e o da saída), o corte no corte, o soco no soco
    const quando = n => c.sons.filter(s => s[1] === `sons-akatsuki/${n}.wav`).map(s => s[0]);
    assert.strictEqual(quando('fumaca').length, c.plano.ajudantes.length + 1, roupa);
    assert.deepStrictEqual(quando('espada'), [epico.T.corte[0]]);
    assert.deepStrictEqual(quando('soco'), [epico.T.soco]);
  }
});

test('o plano, em 5 lugares da reta, 3 roupas e 4 cartões: todos dentro do palco, a de rosa cai na frente do bug, e ele volta pro lugar', () => {
  const { T, pose, bugEm, TRIO, MESTRE } = epico;
  try {
    for (const onde of [0.05, 0.3, 0.5, 0.75, 0.95]) {
      for (const cartao of [{ sessoes: 3 }, { sessoes: 8 }, { sessoes: 12 }, { sessoes: 4, largura: 200 }]) {
        for (const roupa of ROUPAS) {
          const m = novoMundo({ onde, roupa, ...cartao }), J = m.cena.plano, quem = `onde ${onde}, ${roupa}, ${JSON.stringify(cartao)}`;
          const gente = J.eu === MESTRE ? [MESTRE, ...TRIO] : TRIO;
          assert.ok(J.X0 >= 0 && J.X0 <= J.cw, `o Clawd fora do cartão (${quem})`);
          // nos lugares: todos no palco, sem encostar um no outro, e longe do bug parado
          for (const r of gente) assert.ok(J.lugar[r] - 13.5 >= 0 && J.lugar[r] + 13.5 <= J.bugX - J.BW / 2, `${r} fora do lugar (${quem})`);
          // a de rosa salta pra frente e cai antes do meio do bug; o bug cabe no palco
          assert.ok(J.pouso > J.lugar['t7-rosa'] && J.pouso < J.bugX, `o pouso da de rosa (${quem})`);
          assert.ok(J.bugX + J.BW / 2 + 10 <= J.cw + 6, `o bug não cabe (${quem})`);
          for (let t = 0; t < T.dur; t += 0.05) {
            const b = bugEm(J, t);
            if (b.visivel && t >= T.bug[1] && t < T.joga) assert.ok(b.x + J.BW / 2 <= J.cw + 6, `o bug sai do palco em ${t.toFixed(2)} (${quem})`);
            for (const r of gente) {
              const p = pose(J, r, t);
              if (p.visivel) assert.ok(p.x >= 0 && p.x <= J.cw && p.y <= 0 && p.y >= -J.HJ + 20, `${r} fora do palco em ${t.toFixed(2)} (${quem})`);
            }
          }
          // ele: sai do lugar dele e volta pra lá; os ajudantes só aparecem entre o puf de chegada e o de saída
          for (const t of [0, T.dur]) assert.deepStrictEqual([pose(J, J.eu, t).x, pose(J, J.eu, t).y + 0], [J.X0, 0], `${t} (${quem})`);  // (+ 0: o -0 do seno)
          for (const r of J.ajudantes) for (const t of [0, T.dur]) assert.strictEqual(pose(J, r, t).visivel, false, `${r} em ${t} (${quem})`);
        }
      }
    }
  } finally { A.vestir('akatsuki'); }
});
