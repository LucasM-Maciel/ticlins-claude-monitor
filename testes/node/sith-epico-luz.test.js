'use strict';
// motor/sith-epico-luz.js: o épico do tema Sith no lado da luz (a defesa da floresta, a cada 30
// droides, como o sombrio). A cena inteira quadro a quadro em 3 escalas e 2 cartões, mesmo
// instante = mesmos bytes, o custo, o Clawd de jedi de volta no lugar no fim, a trilha, e o plano
// (pela semente) sempre dentro do palco: a navinha e o Clawd, as cápsulas, os droides caindo
// longe dele, o gigante, a escolta, a pedra e o sol.
// Ver a olho: node testes/motor-foto.js --tema sith --cena epico-luz --tira 1.15,4.3,10.3,11.9,15.2,17.3 --escala 1.25 --saida f.png
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const epico = require(path.join(MOTOR, 'sith-epico-luz'));
const A = require(path.join(MOTOR, 'sith-arte'));
const { Tela } = require(path.join(MOTOR, 'raster'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const { lerWav } = require(path.join(MOTOR, 'som'));
const tema = require(path.join(MOTOR, 'tema-sith'));
const { estadoDeMentira } = require('../motor-foto');

const JANELINHA = path.join(MOTOR, '..');
// o Clawd (no lado da luz) parado na reta de cima (fração 'onde' dela) e a cena começando em T = 0
function novoMundo({ escala = 1, onde = 0.5, semente = 7, sessoes = 4, cena = epico.cena } = {}) {
  const m = new Mundo({ tema, semente });
  m.salvo.sithLado = 'luz'; m.salvo.sithVoltas = 50;
  m.erros = [];
  m.aoErro = e => m.erros.push(e);
  m.receber({ ...estadoDeMentira('sith', 'andando', { sessoes }), escala });
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

test('o módulo: linha do tempo e a cena no formato combinado (16 a 21 s, reta de cima, só andando, lado da luz)', () => {
  assert.ok(Array.isArray(epico.linhaDoTempo) && epico.linhaDoTempo.length >= 6);
  for (const [t, txt] of epico.linhaDoTempo) assert.ok(typeof t === 'number' && typeof txt === 'string' && txt.length);
  const c = novoMundo().cena;
  assert.strictEqual(c.nome, 'epico-luz');
  assert.strictEqual(c.lado, 'luz');
  assert.ok(c.dur >= 16 && c.dur <= 21, `dur ${c.dur}`);
  assert.deepStrictEqual(c.espaco, { frente: 0, tras: 0 });
  assert.deepStrictEqual(c.modos, ['andando']);
  assert.strictEqual(typeof c.quadro, 'function');
});

test('pelo tema: o epico-luz é este, com o Clawd de jedi', () => {
  const m = novoMundo({ cena: mm => tema.cenaPorNome(mm, 'epico-luz') });
  assert.strictEqual(m.cena.nome, 'epico-luz');
  assert.ok(m.cena.epico);
  assert.strictEqual(m.cena.dur, epico.T.dur);
  quadro(m, telaDa(1), 1);
  assert.strictEqual(A.COR.roupa, 'jedi');
  assert.deepStrictEqual(m.erros, []);
});

test('a cena inteira, quadro a quadro (30/s), nas escalas 1, 1,25 e 2 e em 2 cartões: sem erro, pintando, e acaba', () => {
  for (const escala of [1, 1.25, 2]) {
    for (const { sessoes, onde } of [{ sessoes: 4, onde: 0.5 }, { sessoes: 8, onde: 0.1 }]) {
      const tela = telaDa(escala), m = novoMundo({ escala, sessoes, onde }), dur = m.cena.dur, onde_ = `escala ${escala}, ${sessoes} sessões`;
      let meio = 0;
      for (let n = 1; n / 30 < dur; n++) {
        passo(m, n / 30);
        assert.ok(m.cena && m.cena.nome === 'epico-luz', `acabou antes da hora em ${n / 30} (${onde_})`);
        quadro(m, tela, escala);
        if (n === 150) meio = tela.pixels.filter(p => p !== 0).length;
      }
      assert.deepStrictEqual([m.erros, [...m.ruins]], [[], []], onde_);
      assert.ok(meio > 30000 * escala * escala, `o palco pinta pouco no meio (${onde_}): ${meio}`);
      passo(m, dur + 0.05);
      assert.strictEqual(m.cena, null, `não terminou (${onde_})`);
    }
  }
});

test('mesmo instante = mesmos bytes, de quadro em quadro ou pulando direto pro instante', () => {
  for (const escala of [1, 1.25]) {
    const a = novoMundo({ escala }), dur = a.cena.dur, ta = telaDa(escala), tb = telaDa(escala);
    const instantes = [0.2, 0.8, 1.15, 2.2, 4.4, 6.1, 9.6, 10.6, 11.6, 12.4, 14.1, 15.3, 16.8, 17.3, dur - 1.2, dur - 0.05].map(t => Math.round(t * 30) / 30);
    let i = 0;
    for (let n = 1; n / 30 < dur && i < instantes.length; n++) {
      passo(a, n / 30);
      if (Math.abs(n / 30 - instantes[i]) > 1e-9) continue;
      quadro(a, ta, escala);
      const b = novoMundo({ escala });  // b só existe no instante da foto
      passo(b, n / 30);
      quadro(b, tb, escala);
      assert.ok(ta.bgra().equals(tb.bgra()), `t=${instantes[i]}, escala ${escala}`);
      quadro(a, tb, escala);  // de novo, no mesmo instante
      assert.ok(ta.bgra().equals(tb.bgra()), `repetido, t=${instantes[i]}`);
      i++;
    }
    assert.strictEqual(i, instantes.length);
  }
});

test('custo por quadro na escala 1,25 (alvo: mediana abaixo de 4 ms, pior abaixo de 12; falha só acima de 10 e 50)', (t) => {
  const escala = 1.25, tela = telaDa(escala), linhas = [];
  let todas = [];
  for (const semente of [7, 8, 9]) {
    const rodar = (vezes) => {
      const m = novoMundo({ escala, semente });
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
    rodar(1);  // aquece o JIT e deixa prontos o céu, a floresta, as nuvens e o sol
    const ms = rodar(3).sort((a, b) => a - b);
    linhas.push(`semente ${semente} ${ms[ms.length >> 1].toFixed(2)}/${ms[ms.length - 1].toFixed(2)}`);
    todas = todas.concat(ms);
  }
  todas.sort((a, b) => a - b);
  const mediana = todas[todas.length >> 1], pior = todas[todas.length - 1];
  t.diagnostic(`ms por quadro (mediana/pior): ${linhas.join(', ')}; todas ${mediana.toFixed(2)}/${pior.toFixed(2)}, p95 ${todas[Math.floor(todas.length * 0.95)].toFixed(2)}`);
  // a suíte roda os arquivos em paralelo (os dois épicos juntos, no CI também): o alvo é 4 e 12
  // (sozinho dá ~1,4 e ~6), mas só falha bem acima, como o do Ender Dragon
  assert.ok(mediana < 10, `mediana ${mediana.toFixed(2)} ms (alvo 4)`);
  assert.ok(pior < 50, `pior quadro ${pior.toFixed(2)} ms (alvo 12)`);
});

test('o último quadro é o Clawd de jedi de sabre pronto (o fim das outras cenas do tema), no lugar onde começou', () => {
  const pronto = () => ({ nome: 'pronto', lado: 'luz', dur: 100, espaco: { frente: 0, tras: 0 }, modos: ['andando'], quadro(g, t, mundo) { A.clawdSith(g, { T: mundo.T, sabre: { ang: 25, len: 1 }, vento: 0.4 }); } });
  for (const escala of [1, 1.25, 2]) {
    for (const onde of [0.05, 0.5, 0.95]) {
      const m = novoMundo({ escala, onde }), dur = m.cena.dur, ref = novoMundo({ escala, onde, cena: pronto });
      const ta = telaDa(escala), tb = telaDa(escala);
      for (let n = 1; n / 30 < dur; n++) passo(m, n / 30);
      passo(m, dur - 0.01);
      passo(ref, dur - 0.01);
      assert.deepStrictEqual([m.pose().x, m.pose().y], [ref.pose().x, ref.pose().y], 'o Mundo não andou com ele');
      quadro(m, ta, escala); quadro(ref, tb, escala);
      assert.ok(ta.bgra().equals(tb.bgra()), `escala ${escala}, onde ${onde}: o último quadro não é o Clawd de sabre pronto`);
      assert.strictEqual(A.COR.roupa, 'jedi');
    }
  }
});

test('cortada no meio (pergunta): encerra sem erro e o tema volta a desenhar o Clawd', () => {
  const m = novoMundo({ escala: 1.25 }), tela = telaDa(1.25);
  for (let n = 1; n <= 11 * 30; n++) { passo(m, n / 30); quadro(m, tela, 1.25); }
  m.receber({ modo: 'pulando' });
  assert.strictEqual(m.cena, null);
  for (let n = 11 * 30 + 1; n <= 12 * 30; n++) { passo(m, n / 30); quadro(m, tela, 1.25); }
  assert.deepStrictEqual(m.erros, []);
});

test('a trilha: todo som existe, é WAV que o motor lê, cai dentro da cena e na hora certa', () => {
  const c = novoMundo().cena;
  assert.ok(c.sons.length >= 20, `${c.sons.length} sons`);
  for (const [t, arquivo, ganho] of c.sons) {
    assert.ok(t >= 0 && t < c.dur, `${arquivo} em ${t}`);
    assert.ok(ganho > 0 && ganho <= 1, `${arquivo} ganho ${ganho}`);
    const f = path.join(JANELINHA, arquivo);
    assert.ok(fs.existsSync(f), `falta ${f}`);
    assert.ok(lerWav(fs.readFileSync(f)).amostras.length > 100, arquivo);
  }
  // cada droide que cai soa na hora em que cai; cada cápsula, quando começa a cair; a pedrada, na pedrada
  const quando = n => c.sons.filter(s => s[1] === `sons-sith/${n}.wav`).map(s => s[0]);
  assert.deepStrictEqual(quando('explode'), c.plano.droides.map(f => f.th));
  assert.deepStrictEqual(quando('capsula'), c.plano.capsulas.map(p => p.t0));
  assert.deepStrictEqual(quando('tomba'), [epico.T.acerta]);
  assert.deepStrictEqual(quando('forca-luz'), [epico.T.agarra]);
});

test('o plano, em 50 sementes, 3 lugares da reta e 2 cartões: tudo dentro do palco e longe do Clawd (que voa na navinha)', () => {
  const { T, VOA, GW, GH, PW, PH, QUEDA, posDroide, posCapsula, clawdEm, giganteEm, escoltaEm, pedraEm } = epico;
  // o Clawd em t: o meio do corpo (ele tem 27 x 28) no palco
  const corpo = (J, t) => { const c = clawdEm(J, t); return [J.X0 + c.x, c.y - 14]; };
  for (let s = 0; s < 50; s++) {
    for (const onde of [0.05, 0.5, 0.95]) {
      for (const sessoes of [3, 8]) {
        const m = novoMundo({ semente: 1000 + s, onde, sessoes }), J = m.cena.plano, quem = `semente ${1000 + s}, onde ${onde}, ${sessoes} sessões`;
        const dentro = ([x, y], folga, o) => assert.ok(x >= folga && x <= J.cw - folga && y >= -J.HJ + folga && y <= -folga, `${o} fora do palco em ${x.toFixed(1)},${y.toFixed(1)} (${quem})`);
        assert.ok(J.X0 >= 0 && J.X0 <= J.cw, `o Clawd fora do cartão (${quem})`);
        // o Clawd: dentro do palco o tempo todo (na navinha, acima da floresta); volta pro lugar dele no fim
        for (let t = 0; t < T.dur; t += 0.05) {
          const [x, y] = corpo(J, t), c = clawdEm(J, t);
          assert.ok(x - 13.5 >= 0 && x + 13.5 <= J.cw && y - 14 >= -J.HJ + 6, `o Clawd sai do palco em ${t.toFixed(2)} s (${quem})`);
          if (t >= VOA.embarca[1] && t < VOA.salta[0]) {  // a bordo: a navinha (30 de largura) inteira no palco, e ele em cima dela
            assert.ok(J.X0 + c.nave.x - 15 >= 0 && J.X0 + c.nave.x + 15 <= J.cw, `a navinha sai do palco em ${t.toFixed(2)} s (${quem})`);
            assert.deepStrictEqual([c.x, c.y], [c.nave.x, c.nave.y], quem);
          }
        }
        assert.deepStrictEqual(corpo(J, T.dur), [J.X0, -14], quem);
        assert.strictEqual(clawdEm(J, T.dur).nave.ve, false, quem);
        // as cápsulas: pousam na floresta, dentro do palco, antes do droide delas sair
        assert.strictEqual(J.capsulas.length, 3, quem);
        for (const p of J.capsulas) {
          dentro(posCapsula(p, p.pousa), 0, 'a cápsula pousada');
          assert.ok(p.x0 >= 8 && p.x0 <= J.cw - 8, `a cápsula começa fora de cima do palco (${quem})`);
          assert.ok(Math.abs(p.pousa - p.t0 - QUEDA) < 1e-9 && p.y1 > J.base, quem);
          assert.ok(Math.abs(p.x1 - (J.X0 + clawdEm(J, p.pousa).x)) >= 30, `a cápsula cai em cima do Clawd (${quem})`);
        }
        // 5 droides: cada um sai da sua cápsula depois do pouso, atira dentro do palco e cai longe do Clawd, antes do gigante
        assert.strictEqual(J.droides.length, 5, quem);
        J.droides.forEach((f, i) => {
          const p = J.capsulas[i % 3];
          assert.ok(f.te >= p.pousa + 0.2, `o droide ${i} sai antes da cápsula pousar (${quem})`);
          assert.ok(f.th < T.gigante[0] - 0.3, `droide vivo quando o gigante chega (${quem})`);
          assert.ok(Math.abs(f.tb - f.tf - 0.32) < 1e-9 && Math.abs(f.th - f.tb - 0.2) < 1e-9, quem);
          dentro(posDroide(f, f.tf), 4, 'o tiro do droide');
          dentro(posDroide(f, f.th), 4, 'a explosão do droide');
          const [px, py] = posDroide(f, f.th), [cx, cy] = corpo(J, f.th);
          assert.ok(Math.hypot(px - cx, py - cy) >= 24, `droide explode em cima do Clawd (${quem})`);
          const [sx, sy] = f.s, [bx, by] = corpo(J, f.tb);  // o tiro bate no sabre, na mão dele
          assert.ok(Math.hypot(sx - bx, sy - by) < 24, `o tiro bate longe do sabre (${quem})`);
        });
        // o gigante: cabe no palco (acima da floresta) e não chega em cima do Clawd; tomba pra dentro da floresta
        const G = giganteEm(J, T.agarra), [cx, cy] = corpo(J, T.agarra);
        assert.ok(G.x - GW / 2 >= 0 && G.x + GW / 2 <= J.cw && G.y - GH / 2 >= -J.HJ && G.y + GH / 2 <= J.base, `o gigante não cabe (${quem})`);
        assert.ok(Math.abs(G.x - cx) >= GW / 2 + 13.5 + 8 || Math.abs(G.y - cy) >= GH / 2 + 14 + 8, `o gigante em cima do Clawd (${quem})`);
        const caido = giganteEm(J, T.cai);
        assert.ok(caido.y > J.base - GH / 2 && caido.x >= 0 && caido.x <= J.cw, `o gigante não cai na floresta (${quem})`);
        // a escolta: dentro do palco até fugir
        for (const e of J.escolta) {
          const n = escoltaEm(J, e, T.foge[0]);
          dentro([n.x, n.y], 6, 'a escolta');
          assert.ok(Math.abs(n.x - cx) >= 24 || Math.abs(n.y - cy) >= 24, `a escolta em cima do Clawd (${quem})`);
        }
        // a pedra: sai de dentro do chão da floresta, sobe até o lado dele sem encostar nele e vai
        // até o gigante dentro do palco
        for (let t = T.arranca[0]; t < T.acerta; t += 0.02) {
          const p = pedraEm(J, t), [x, y] = corpo(J, t);
          assert.ok(p.x - PW / 2 >= 0 && p.x + PW / 2 <= J.cw && p.y - PH / 2 >= -J.HJ && p.y <= J.base + 14, `a pedra fora do palco em ${t.toFixed(2)} (${quem})`);
          assert.ok(Math.abs(p.x - x) >= PW / 2 + 13.5 || Math.abs(p.y - y) >= PH / 2 + 14, `a pedra encosta no Clawd em ${t.toFixed(2)} (${quem})`);
        }
        // o sol nasce dentro do palco, do lado de lá
        dentro([J.sol.x, J.sol.y], 10, 'o sol');
      }
    }
  }
});
