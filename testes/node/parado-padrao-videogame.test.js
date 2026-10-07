'use strict';
// motor/parado-padrao-videogame.js: a cena de "parado há muito tempo" do Padrão (o Clawd joga
// videogame numa TVzinha). A entrada quadro a quadro e as partidas até 3 h nas 3 escalas, o
// quadro como função do tempo, o custo, a saída (cortando na entrada, no jogo, nos pulos da
// vitória, com o controle jogado no chão e no chuvisco) terminando no Clawd parado do tema, nada em cima do
// conteúdo do cartão, e os joguinhos sem trapaça (pula todo bug, a raquete pega toda bola que
// não é o ponto, nenhuma bomba encosta na navinha quando ele ganha).
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const vg = require(path.join(MOTOR, 'parado-padrao-videogame'));
const tema = require(path.join(MOTOR, 'tema-padrao'));
const { Tela } = require(path.join(MOTOR, 'raster'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const { layoutDe, rng } = require(path.join(MOTOR, 'comum'));
const { estadoDeMentira } = require('../motor-foto');

const ESCALAS = [1, 1.25, 2];
const HORAS3 = 3 * 3600;
// parado no meio de cima do cartão, e a cena começando em T=0
function novoMundo({ escala = 1, sessoes = 4, semente = 7 } = {}) {
  const m = new Mundo({ tema, semente });
  m.erros = [];
  m.aoErro = e => m.erros.push(e);
  m.receber({ ...estadoDeMentira('padrao', 'parado', { sessoes }), escala });
  m.comecarCena(vg.cena(m));
  return m;
}
const telaDa = escala => new Tela(Math.round(380 * escala), Math.round(440 * escala));
function quadro(m, tela, escala) {  // o quadro inteiro, como o motor.js
  const g = tela.getContext('2d');
  tela.limpar(); g.setTransform(escala, 0, 0, escala, 0, 0); g.globalAlpha = 1;
  m.desenhar(g);
  return tela;
}
function so(tela, escala, pose, desenha) {  // só o Clawd (cena, saída ou tema), no lugar dele
  const g = tela.getContext('2d');
  tela.limpar(); g.setTransform(escala, 0, 0, escala, 0, 0); g.globalAlpha = 1;
  g.translate(pose.x, pose.y); g.rotate(pose.a);
  desenha(g);
  return tela;
}
// a semente da cena que o mundo de semente 7 sorteia (pra achar as partidas certas)
const SEM = Math.floor(rng(7)() * 4294967296);
// instantes: a entrada e a 1ª partida quadro a quadro até 20 s, depois amostras até 3 h
const ENTRADA = Array.from({ length: 20 * 30 + 1 }, (_, n) => n / 30);
const AMOSTRAS = Array.from({ length: 60 }, (_, n) => 20 + (HORAS3 - 20) * ((n + 1) / 60) ** 2 + n * 0.37);
// o conteúdo do cartão (o que a janelinha escreve), em pixels da tela
function conteudo(m, escala) {
  const L = layoutDe(tema), [x, y, w, h] = m.host.cartao, [me, mc, md, mb] = L.moldura, [pe, pc, pd, pb] = L.padding;
  const x0 = x + me + pe, y0 = y + mc + pc, x1 = x + w - md - pd, y1 = y + h - mb - pb;
  return [Math.floor(x0 * escala), Math.floor(y0 * escala), Math.ceil(x1 * escala), Math.ceil(y1 * escala)];
}
function pintadoEm(tela, [x0, y0, x1, y1]) {
  for (let y = Math.max(0, y0); y < Math.min(tela.height, y1); y++) for (let x = Math.max(0, x0); x < Math.min(tela.width, x1); x++) if (tela.pixels[y * tela.width + x] !== 0) return [x, y];
  return null;
}
const cheia = tela => tela.pixels.some(p => p !== 0);
// a 1ª partida (a partir da k0) que cumpre o filtro, e o t (da cena) do começo do resultado e do menu
function achar(filtro, k0 = 0) {
  for (let k = k0; k < 400; k++) {
    const p = vg.partida(SEM, k);
    if (filtro(p)) return { p, res: p.t0 + vg.CONTA + p.pl.G, menu: p.t0 + vg.CONTA + p.pl.G + vg.RES };
  }
  throw new Error('nenhuma partida assim');
}
const CHUVISCO = achar(p => p.chuvisco).menu;  // a TV dá chuvisco e ele bate nela

test('a cena no formato combinado: parado, até algo rodar, e a linha do tempo pra prévia', () => {
  const m = novoMundo();
  assert.ok(m.cena, 'a cena começou');
  assert.deepStrictEqual([m.cena.nome, m.cena.dur, m.cena.espaco, m.cena.modos], ['parado', Infinity, { frente: 0, tras: 0 }, ['parado']]);
  assert.deepStrictEqual(vg.texturas, []);
  assert.ok(vg.saida && vg.saida.dur > 0 && vg.saida.dur <= 1.2, 'saída de até 1,2 s');
  assert.ok(Array.isArray(vg.linhaDoTempo) && vg.linhaDoTempo.length >= 6);
  vg.linhaDoTempo.forEach(([t, txt], i) => {
    assert.ok(t >= 0 && typeof txt === 'string' && txt.length > 2, `item ${i}`);
    if (i) assert.ok(t >= vg.linhaDoTempo[i - 1][0], `fora de ordem: ${i}`);
  });
  // começa com o Clawd normal do tema, parado (sem pulo nenhum na troca)
  const casa = m.pose(), a = telaDa(1), b = telaDa(1);
  so(a, 1, casa, g => m.cena.quadro(g, 0, m));
  so(b, 1, casa, g => tema.clawd(g, m));
  assert.ok(a.bgra().equals(b.bgra()), 'o 1º quadro é o Clawd parado do tema');
});

test('as partidas: os 3 jogos se revezam, ganha e perde, todas as reações, e cabem na janela', () => {
  const n = Math.ceil(HORAS3 / vg.JANELA), conta = {};
  let anterior = null;
  for (let k = 0; k < n; k++) {
    const p = vg.partida(SEM, k);
    for (const c of [p.jogo, p.ganha ? 'ganha' : 'perde', p.ganha ? p.festa : p.raiva, p.chuvisco && 'chuvisco']) if (c) conta[c] = (conta[c] || 0) + 1;
    assert.notStrictEqual(p.jogo, anterior, `partida ${k}: o mesmo jogo duas vezes seguidas`);
    anterior = p.jogo;
    if (k % 3 === 2) assert.deepStrictEqual(new Set([0, 1, 2].map(i => vg.partida(SEM, k - i).jogo)).size, 3, `rodada ${k / 3 | 0}: os 3 jogos`);
    assert.ok(p.pl.G >= 8 && p.pl.G <= vg.MAXG + 1e-9, `partida ${k} (${p.jogo}): ${p.pl.G.toFixed(2)} s de jogo`);
  }
  for (const c of ['pulo', 'pong', 'nave']) assert.ok(conta[c] > n / 4, `${c}: ${conta[c]} de ${n}`);
  for (const c of ['ganha', 'perde', 'pulos', 'danca', 'bufa', 'joga']) assert.ok(conta[c] > n / 10, `${c}: ${conta[c]} de ${n}`);
  assert.ok(conta.chuvisco > n / 12 && conta.chuvisco < n / 3, `chuvisco (raro): ${conta.chuvisco} de ${n}`);
  // as fases em ordem: 3-2-1, jogo, resultado, menu
  const p = vg.partida(SEM, 3), fases = [];
  for (let t = p.t0; t < p.t0 + vg.JANELA; t += 0.05) { const f = vg.ondeEsta(SEM, t).fase; if (fases[fases.length - 1] !== f) fases.push(f); }
  assert.deepStrictEqual(fases, ['conta', 'jogo', 'res', 'menu']);
});

test('os joguinhos sem trapaça (as 400 primeiras partidas)', () => {
  const { PU, NA, puloEm, raquetes, segPong, dobra, naveX, bugX } = vg.jogos;
  for (let k = 0; k < 400; k++) {
    const p = vg.partida(SEM, k), pl = p.pl, onde = `partida ${k} (${p.jogo}, ${p.ganha ? 'ganha' : 'perde'})`;
    if (p.jogo === 'pulo') {
      // o bonequinho (4x3) nunca encosta num bug (2x3) antes do fim; perdendo, o último está colado nele no fim
      for (let tau = 0; tau < pl.G; tau += 0.01) {
        const h = puloEm(pl, tau).h;
        for (const b of pl.bugs) {
          const bx = Math.round(PU.hx + 1 + PU.vel * (b.tc - tau));
          if (bx <= PU.hx + 3 && bx + 1 >= PU.hx) assert.ok(h >= 3, `${onde}: encostou num bug em ${tau.toFixed(2)}`);
        }
      }
      if (!p.ganha) { const b = pl.bugs[pl.bugs.length - 1]; assert.strictEqual(Math.round(PU.hx + 1 + PU.vel * (b.tc - pl.G)), PU.hx + 4, onde); }
    } else if (p.jogo === 'pong') {
      // a raquete pega toda bola que chega nela, menos a do ponto; o placar termina 3 pro vencedor
      for (const s of pl.segs) {
        if (s.tipo !== 'bola' && s.tipo !== 'erra') continue;
        const yb = Math.round(dobra(s.Y)), r = raquetes(s, s.t1)[s.alvo];
        assert.strictEqual(Math.abs(r - yb) <= 1, s.tipo === 'bola', `${onde}: ${s.tipo} em ${s.t1.toFixed(2)} (raquete ${r}, bola ${yb})`);
      }
      assert.strictEqual(segPong(pl, pl.G).pts[p.ganha ? 0 : 1], 3, onde);
      assert.ok(segPong(pl, pl.G).pts[p.ganha ? 1 : 0] < 3, onde);
    } else {
      // todo tiro acerta o bug na coluna dele; nenhuma bomba passa perto da navinha (perdendo, a última pega)
      for (const b of pl.bugs) {
        if (b.tiro < Infinity) assert.strictEqual(bugX(b, b.acerto) + 1, b.mira, onde);
        if (b.tiro < Infinity) assert.strictEqual(naveX(pl, b.tiro) + 2, b.mira, `${onde}: a navinha não está embaixo do bug no tiro`);
        if (!b.bomba) continue;
        const bx = bugX(b, b.bomba.t) + 1, chega = b.bomba.t + (NA.ponta - (b.y + 3)) / NA.vbomba;
        if (b.bomba.bate) { assert.ok(!p.ganha && Math.abs(chega - pl.G) < 1e-9, onde); assert.strictEqual(naveX(pl, pl.G) + 2, bx, onde); continue; }
        for (let q = chega; q < chega + 3 / NA.vbomba; q += 0.01) assert.ok(Math.abs(naveX(pl, q) + 2 - bx) >= 3, `${onde}: bomba raspando em ${q.toFixed(2)}`);
      }
    }
  }
});

test('a entrada e as partidas quadro a quadro (30/s) até 20 s e amostras até 3 h, nas escalas 1, 1,25 e 2: sem erro', () => {
  for (const escala of ESCALAS) {
    for (const sessoes of [4, 1]) {
      const m = novoMundo({ escala, sessoes }), tela = telaDa(escala);
      for (const s of [...ENTRADA, ...AMOSTRAS]) {
        m.passo(s);
        quadro(m, tela, escala);
        if (Math.round(s * 30) % 15 === 0) assert.ok(cheia(tela), `quadro vazio em ${s.toFixed(2)} s`);
      }
      const onde = `escala ${escala}, ${sessoes} sessões`;
      assert.deepStrictEqual([m.erros, [...m.ruins]], [[], []], onde);
      assert.ok(m.cena && m.cena.nome === 'parado', `a cena acabou sozinha (${onde})`);
    }
  }
  // um resultado de cada (pulos, dança, bufa, joga), quadro a quadro, em 1,25
  for (const f of [p => p.ganha && p.festa === 'pulos', p => p.ganha && p.festa === 'danca', p => !p.ganha && p.raiva === 'bufa', p => !p.ganha && p.raiva === 'joga']) {
    const { res } = achar(f), m = novoMundo({ escala: 1.25 }), tela = telaDa(1.25);
    for (let s = 0; s < res - 3; s += 5) m.passo(s);
    for (let s = res - 3; s < res + vg.RES + 4; s += 1 / 30) { m.passo(s); quadro(m, tela, 1.25); }
    assert.deepStrictEqual([m.erros, [...m.ruins]], [[], []], `resultado em ${res.toFixed(1)}`);
  }
  const m = novoMundo({ escala: 2 }), tela = telaDa(2);
  for (let s = 0; s < CHUVISCO; s += 5) m.passo(s);
  for (let s = CHUVISCO; s < CHUVISCO + 4; s += 1 / 30) { m.passo(s); quadro(m, tela, 2); }
  assert.deepStrictEqual([m.erros, [...m.ruins]], [[], []], 'chuvisco');
});

test('mesmo instante = mesmos bytes (quadro a quadro, pulando quadros, de novo e voltando no tempo)', () => {
  const vitoria = achar(p => p.ganha && p.festa === 'pulos').res, joga = achar(p => !p.ganha && p.raiva === 'joga').res;
  const instantes = [0.2, 0.5, 0.75, 1.1, 1.6, 7.7, 14.6, vitoria + 0.75, vitoria + 1.0, joga + 1.3, joga + 2.2, CHUVISCO + 1.0, CHUVISCO + 2.1, 3000.5, HORAS3 - 0.3];
  for (const escala of [1, 1.25]) {
    const a = novoMundo({ escala }), ta = telaDa(escala), tb = telaDa(escala);
    const guardados = [];
    let ant = 0;
    for (const t of instantes) {
      for (let s = ant; s < t; s += t - ant > 60 ? 7 : 1 / 30) a.passo(s);
      ant = t;
      a.passo(t);
      quadro(a, ta, escala);
      const b = novoMundo({ escala });  // outro mundo, pulando quadros até o instante
      for (let s = 0; s < t; s += t > 60 ? 50 : 1 / 7) b.passo(s);
      b.passo(t);
      quadro(b, tb, escala);
      assert.ok(ta.bgra().equals(tb.bgra()), `t=${t}, escala ${escala}: pulando quadros deu outro quadro`);
      quadro(a, tb, escala);
      assert.ok(ta.bgra().equals(tb.bgra()), `t=${t}, escala ${escala}: de novo deu outro quadro`);
      guardados.push([t, Buffer.from(ta.bgra())]);
    }
    for (const [t, buf] of guardados.reverse()) {  // voltando no tempo
      a.passo(t);
      assert.ok(buf.equals(quadro(a, ta, escala).bgra()), `t=${t}, escala ${escala}: voltando no tempo deu outro quadro`);
    }
  }
});

test('custo em 1,25: mediana < 2 ms e pior < 8 ms por quadro (falha só em 8 / 32: o CI é mais lento; a entrada, uma partida inteira, as reações, o chuvisco e amostras até 3 h)', (t) => {
  const escala = 1.25, tela = telaDa(escala);
  const reacoes = [p => p.ganha && p.festa === 'pulos', p => p.ganha && p.festa === 'danca', p => !p.ganha && p.raiva === 'joga'].map(f => achar(f).res).concat([CHUVISCO]);
  const instantes = [...Array.from({ length: 30 * 30 }, (_, n) => n / 30), ...reacoes.flatMap(r => Array.from({ length: 5 * 30 }, (_, n) => r + n / 30)), ...AMOSTRAS];
  const rodar = vezes => {
    const m = novoMundo({ escala });
    return instantes.map(s => {
      m.passo(s);
      let melhor = Infinity;
      for (let k = 0; k < vezes; k++) {  // o menor de 3: a máquina oscila
        const ini = process.hrtime.bigint();
        quadro(m, tela, escala);
        melhor = Math.min(melhor, Number(process.hrtime.bigint() - ini) / 1e6);
      }
      return melhor;
    });
  };
  const frio = rodar(1)[0];  // aquece o JIT e deixa prontos os sprites (o 1º quadro)
  const ms = rodar(3), pior = Math.max(...ms), qual = instantes[ms.indexOf(pior)];
  ms.sort((x, y) => x - y);
  const mediana = ms[ms.length >> 1];
  t.diagnostic(`quadro inteiro (cena) em 1,25: mediana ${mediana.toFixed(2)} ms, p95 ${ms[Math.floor(ms.length * 0.95)].toFixed(2)}, pior ${pior.toFixed(2)} (t=${qual.toFixed(2)} s); 1º quadro frio ${frio.toFixed(2)}`);
  assert.ok(mediana < 8, `mediana ${mediana.toFixed(2)} ms (alvo 2)`);
  assert.ok(pior < 32, `pior quadro ${pior.toFixed(2)} ms (alvo 8)`);
});

test('a saída (cortada na entrada, no jogo, na vitória, na derrota): a TV desliga, some e termina no Clawd parado do tema, no lugar', () => {
  const vit = achar(p => p.ganha && p.festa === 'pulos').res + vg.FIM, dan = achar(p => p.ganha && p.festa === 'danca').res + vg.FIM;
  const joga = achar(p => !p.ganha && p.raiva === 'joga').res + vg.FIM, bufa = achar(p => !p.ganha && p.raiva === 'bufa').res + vg.FIM;
  const cortes = [0.05, 0.2, 0.4, 0.62, 0.7, 0.8, 1.0, 1.25, 2.0, 6.6, 14.9, 27.5,
    vit + 0.05, vit + 0.3, vit + 0.6, vit + 1.1, vit + 2.2, dan + 0.5, dan + 2.1,
    joga + 0.4, joga + 0.7, joga + 1.5, joga + 2.7, joga + 3.0, bufa + 1.0, CHUVISCO + 1.0, CHUVISCO + 2.0, CHUVISCO + 2.1, HORAS3];
  for (const escala of ESCALAS) {
    for (const tc of cortes) {
      const m = novoMundo({ escala }), casa = m.pose();
      for (let s = 0; s < tc; s += tc - s > 2 ? 5 : 1 / 30) m.passo(s);
      m.passo(tc);
      const tCorte = m.T - m.cena.t0;
      m.fimCena(true);  // algo voltou a rodar: o Mundo corta a cena e o tema toca a saída
      const tela = telaDa(escala), ref = telaDa(escala), D = vg.saida.dur;
      for (let f = 0; f <= Math.round(D * 30); f++) {
        const u = Math.min(D, f / 30);
        m.passo(tc + u);
        so(tela, escala, casa, g => vg.saida.quadro(g, u, m, tCorte));
        assert.ok(cheia(tela), `corte ${tc}, escala ${escala}: saída vazia em ${u.toFixed(2)}`);
        assert.strictEqual(pintadoEm(tela, conteudo(m, escala)), null, `corte ${tc}, escala ${escala}: a saída cobriu o cartão em ${u.toFixed(2)}`);
      }
      so(ref, escala, casa, g => tema.clawd(g, m));
      assert.ok(tela.bgra().equals(ref.bgra()), `corte ${tc}, escala ${escala}: o fim não é o Clawd parado do tema`);
      assert.deepStrictEqual([m.pose().x, m.pose().y], [casa.x, casa.y], 'no mesmo lugar');
    }
  }
  // pergunta no meio (modo pulando): o Mundo corta a cena e o tema desenha o Clawd pulando
  for (const tc of [0.5, 9, joga + 1.5]) {
    const p = novoMundo({ escala: 1.25 }), tela = telaDa(1.25);
    for (let s = 0; s < tc; s += tc - s > 60 ? 30 : 1 / 30) p.passo(s);
    p.receber({ modo: 'pulando' });
    assert.strictEqual(p.cena, null);
    for (let s = tc; s < tc + 1; s += 1 / 30) { p.passo(s); quadro(p, tela, 1.25); }
    assert.deepStrictEqual([p.erros, [...p.ruins]], [[], []]);
  }
});

test('nada desenhado em cima do conteúdo do cartão nem longe do Clawd (o laço inteiro, as reações, 3 escalas, 1 e 4 sessões)', () => {
  const reacoes = [p => p.ganha && p.festa === 'pulos', p => p.ganha && p.festa === 'danca', p => !p.ganha && p.raiva === 'joga', p => !p.ganha && p.raiva === 'bufa']
    .map(f => achar(f).res).concat([CHUVISCO - 1]).flatMap(r => Array.from({ length: 6 * 20 }, (_, n) => r + n / 20));
  const instantes = [...Array.from({ length: 60 * 10 }, (_, n) => n / 10), ...reacoes, ...AMOSTRAS];
  for (const escala of ESCALAS) {
    for (const sessoes of [4, 1]) {
      const m = novoMundo({ escala, sessoes }), tela = telaDa(escala), casa = m.pose(), rect = conteudo(m, escala);
      const perto = [Math.floor((casa.x - 60) * escala), Math.floor((casa.y - 80) * escala), Math.ceil((casa.x + 70) * escala), Math.ceil((casa.y + 6) * escala)];
      instantes.forEach((s, i) => {
        m.passo(s);
        so(tela, escala, casa, g => m.cena.quadro(g, s, m));
        assert.strictEqual(pintadoEm(tela, rect), null, `escala ${escala}, ${sessoes} sessões: pintou o conteúdo em ${s.toFixed(2)} s`);
        if (i % 3) return;  // longe do Clawd: 1 em 3 (varrer a tela inteira é caro)
        const longe = pintadoEm(tela, [0, 0, tela.width, perto[1]]) || pintadoEm(tela, [0, 0, perto[0], tela.height]) || pintadoEm(tela, [perto[2], 0, tela.width, tela.height]);
        assert.strictEqual(longe, null, `escala ${escala}: desenhou longe do Clawd em ${s.toFixed(2)} s`);
      });
    }
  }
});
