'use strict';
// motor/parado-minecraft-pesca.js: a cena de "parado há muito tempo" do tema Minecraft (pescando).
// A entrada quadro a quadro e o laço até 3 h nas escalas 1, 1,25 e 2, em cartões de 1 e 4 sessões,
// sem erro; mesmo instante = mesmos bytes (de novo, pulando quadros, voltando no tempo); o custo;
// a saída, cortando na entrada e no laço, termina com o Clawd do tema parado, no lugar; e nada
// desenhado dentro do conteúdo do cartão. Texturas: as da Mojang na pasta CM_TEXTURAS, se
// existir; as que faltarem (o CI não tem nenhuma) viram texturas de mentira do tamanho certo.
// Ver a olho: parado-foto.js --tema minecraft --modulo pesca --tira 0,1.5,2.3,3.7,22 (scratchpad do dono)
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const { Tela } = require(path.join(MOTOR, 'raster'));
const { IMG, carregarTexturas } = require(path.join(MOTOR, 'comum'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const tema = require(path.join(MOTOR, 'tema-minecraft'));
const pesca = require(path.join(MOTOR, 'parado-minecraft-pesca'));
const { estadoDeMentira } = require('../motor-foto');

const VAZIA = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-pesca-'));
const PASTA = process.env.CM_TEXTURAS && fs.existsSync(process.env.CM_TEXTURAS) ? process.env.CM_TEXTURAS : VAZIA;
// a de mentira (a mesma ideia do tema-minecraft.test.js): pixels opacos que mudam a cada pixel,
// no tamanho da de verdade (a água é a tira de 32 quadros; a boia, 8x8)
function deMentira(nome) {
  const [w, h] = /^xp_/.test(nome) ? [182, 5] : nome === 'fonte' ? [128, 128] : nome === 'agua' ? [16, 512] : nome === 'boia' ? [8, 8]
    : /^(zumbi|creeper|esqueleto|aranha|slime|silverfish|enderman|lobo|galinha|orbe|escudo)/.test(nome) ? [64, 64]
      : /^(explosao|varrida|flecha)/.test(nome) ? [32, 32] : [16, 16];
  const t = new Tela(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    if (nome === 'fonte' && !(x % 8 < 5 && y % 8 < 7 && (x + y) % 2 === 0)) continue;
    const v = 128 + ((x * y) % 100);  // o orbe e a água são cinza (o jogo pinta)
    t.pixels[y * w + x] = (0xFF000000 | (nome === 'orbe' || nome === 'agua' ? v * 0x10101 : (x * 2654435761 + y * 40503 + nome.length * 977) & 0xFFFFFF)) >>> 0;
  }
  return t;
}
const TODAS = [...new Set([...tema.texturas, ...pesca.texturas])];
carregarTexturas(PASTA, TODAS);
for (const n of TODAS) if (!IMG[n]) IMG[n] = deMentira(n);

const DUR_SAIDA = pesca.saida.dur;
function novoMundo({ escala = 1.25, sessoes = 4, semente = 7, roupa = 'mc_steve' } = {}) {
  const m = new Mundo({ tema, semente, relogio: () => new Date(2026, 9, 5, 12, 0, 0) });
  m.erros = [];
  m.aoErro = e => m.erros.push(e);
  m.receber({ ...estadoDeMentira('minecraft', 'parado', { sessoes }), escala });
  m.roupa = roupa;
  const cena = pesca.cena(m);
  m.comecarCena(cena);
  assert.ok(m.cena, 'a cena não começou');
  return { m, cena, sem: m.estado.pesca.semente };
}
const telaDa = escala => new Tela(Math.round(380 * escala), Math.round(440 * escala));
// um quadro como o motor.js desenha (fundo do tema + a cena no lugar do Clawd)
function quadro(m, tela, escala) {
  const g = tela.getContext('2d');
  tela.limpar();
  g.setTransform(escala, 0, 0, escala, 0, 0);
  g.globalAlpha = 1;
  m.desenhar(g);
}
// só a cena (sem o fundo), no lugar do Clawd: o que o custo mede
function soCena(m, tela, escala) {
  const g = tela.getContext('2d'), p = m.pose();
  tela.limpar();
  g.setTransform(escala, 0, 0, escala, 0, 0);
  g.translate(p.x, p.y);
  m.cena.quadro(g, m.T - m.cena.t0, m);
}
// só o fundo do tema (moldura, orbes, números): a referência do conteúdo do cartão
function soFundo(m, tela, escala) {
  const g = tela.getContext('2d');
  tela.limpar();
  g.setTransform(escala, 0, 0, escala, 0, 0);
  g.globalAlpha = m.host.opacidade ?? 1;
  tema.fundo(g, m);
}
// o retângulo do conteúdo do cartão (o cartão menos a moldura do Minecraft), em px da tela
function conteudo(m, escala) {
  const [x, y, w, h] = m.host.cartao, [me, mc, md, mb] = tema.layout.moldura;
  return [Math.floor((x + me) * escala), Math.floor((y + mc) * escala), Math.ceil((x + w - md) * escala), Math.ceil((y + h - mb) * escala)];
}
// o conteúdo do cartão é igual com e sem a cena? (null = igual; senão o 1º pixel diferente)
function invadiu(m, tela, ref, escala) {
  soFundo(m, ref, escala);
  const [x0, y0, x1, y1] = conteudo(m, escala), W = tela.width;
  for (let y = y0; y < y1; y++) for (let x = x0; x < x1; x++) if (tela.pixels[y * W + x] !== ref.pixels[y * W + x]) return [x, y];
  return null;
}
const pintados = tela => tela.pixels.reduce((s, p) => s + (p !== 0), 0);
// os instantes que interessam no laço: as primeiras mordidas (pega, pilha, a que ele guarda), um "vazio" e até 3 h
function instantesDoLaco(sem) {
  const L = pesca._L0, J = pesca._JANELA, ts = [];
  let vazio = null, cheia = null, pegas = 0;
  for (let k = 0; k < 400 && (vazio === null || cheia === null); k++) {
    const j = pesca._janela(sem, k);
    if (!j.peixe && vazio === null) vazio = j.b;
    if (j.peixe && ++pegas === 7) cheia = j.b;  // a 7ª pega: a pilha está cheia, ele guarda
  }
  for (const b of [pesca._janela(sem, 0).b, pesca._janela(sem, 1).b, vazio, cheia]) for (let d = -1.6; d <= 2.6; d += 0.1) ts.push(b + d);
  for (let T = L + J; T < 3 * 3600; T += 997) ts.push(T);
  ts.push(3 * 3600);
  return ts;
}

test('o formato combinado: texturas, linha do tempo, cena infinita no modo parado, saída curta', () => {
  assert.ok(Array.isArray(pesca.texturas) && pesca.texturas.length > 10);
  assert.strictEqual(new Set(pesca.texturas).size, pesca.texturas.length, 'sem repetidas');
  for (const n of ['vara', 'vara_lancada', 'boia', 'agua', 'it_bacalhau', 'it_salmao', 'it_peixe_tropical']) assert.ok(pesca.texturas.includes(n), n);
  // cada textura a janelinha sabe baixar
  const { TEXTURAS } = require('../../extensao/janelinha/minecraft.js');
  assert.deepStrictEqual(pesca.texturas.filter(n => !(n in TEXTURAS)), []);
  assert.ok(pesca.linhaDoTempo.length > 3 && pesca.linhaDoTempo.every(([t, s]) => Number.isFinite(t) && typeof s === 'string' && s));
  const { cena } = novoMundo();
  assert.strictEqual(cena.nome, 'parado');
  assert.strictEqual(cena.dur, Infinity);
  assert.deepStrictEqual(cena.modos, ['parado']);
  assert.deepStrictEqual(cena.espaco, { frente: 0, tras: 0 });
  assert.ok(pesca.saida.dur > 0 && pesca.saida.dur <= 1.2);
});

test('o sorteio do laço: 1ª sempre pega; ~12% vazio, tropical e lixo raros; 15–41 s entre mordidas; pilha até 6', () => {
  const { sem } = novoMundo();
  const conta = {}, N = 3000;
  let antes = null;
  for (let k = 0; k < N; k++) {
    const j = pesca._janela(sem, k);
    conta[j.peixe] = (conta[j.peixe] || 0) + 1;
    if (antes !== null) assert.ok(j.b - antes >= 15 && j.b - antes <= 41, `intervalo ${(j.b - antes).toFixed(1)} s`);
    antes = j.b;
  }
  assert.ok(pesca._janela(sem, 0).peixe, 'a 1ª mordida sempre pega');
  const pct = n => (conta[n] || 0) / N;
  assert.ok(pct(null) > 0.08 && pct(null) < 0.16, `vazio ${pct(null)}`);
  assert.ok(pct('it_bacalhau') > pct('it_salmao') && pct('it_salmao') > pct('it_peixe_tropical'), JSON.stringify(conta));
  assert.ok(pct('it_peixe_tropical') < 0.08 && pct('it_osso') + pct('it_linha') < 0.08, JSON.stringify(conta));
  // a pilha é função do tempo: começa vazia, cresce com as pegas e para em 6
  assert.strictEqual(pesca._estado(sem, pesca._L0 + 1).soltos.length, 0);
  const tres = pesca._estado(sem, 3 * 3600).soltos.filter(s => s.giro == null);
  assert.strictEqual(tres.length, 6);
});

test('a entrada quadro a quadro (30/s) até 20 s e o laço até 3 h, nas escalas 1, 1,25 e 2, cartões de 1 e 4 sessões, sem erro', () => {
  for (const escala of [1, 1.25, 2]) {
    const tela = telaDa(escala);
    for (const sessoes of [1, 4]) {
      const { m, sem } = novoMundo({ escala, sessoes });
      let pintou = 0;
      for (let k = 0; k <= 20 * 30; k++) {
        m.passo(k / 30);
        quadro(m, tela, escala);
        if (k === 5 * 30) { soCena(m, tela, escala); pintou = pintados(tela); }  // a cena sozinha (sem a moldura)
      }
      for (const T of instantesDoLaco(sem)) { m.passo(T); quadro(m, tela, escala); }
      const onde = `escala ${escala}, ${sessoes} sessão(ões)`;
      assert.deepStrictEqual(m.erros, [], onde);
      assert.strictEqual(m.ruins.size, 0, onde);
      assert.ok(m.cena && m.cena.nome === 'parado', `${onde}: a cena acabou sozinha`);
      assert.ok(pintou > 300 * escala * escala, `${onde}: a cena pintou pouco (${pintou})`);
    }
  }
});

test('mesmo instante = mesmos bytes (de novo, pulando quadros e voltando no tempo)', () => {
  const escala = 1.25, { sem } = novoMundo();
  const b0 = pesca._janela(sem, 0).b;
  const instantes = [0.5, 1.6, 2.3, 3.7, 4.0, b0 - 0.7, b0 + 0.1, b0 + 0.6, b0 + 1.2, b0 + 1.9, 5000.3, 3 * 3600];
  // a referência: cada instante num Mundo novo, chegando lá direto
  const ref = instantes.map(t => { const { m } = novoMundo(), tela = telaDa(escala); m.passo(t); quadro(m, tela, escala); return tela.bgra(); });
  // o mesmo Mundo passando quadro a quadro (30/s) e de 0,25 em 0,25 s
  for (const passo of [1 / 30, 0.25]) {
    const { m } = novoMundo(), tela = telaDa(escala);
    let T = 0;
    instantes.forEach((t, i) => {
      if (t < 30) for (; T < t; T += passo) { m.passo(T); quadro(m, tela, escala); }
      m.passo(t); quadro(m, tela, escala); T = t;
      assert.ok(tela.bgra().equals(ref[i]), `passo ${passo}: t = ${t}`);
    });
  }
  // voltando no tempo (o quadro é função do tempo da cena)
  const { m } = novoMundo(), tela = telaDa(escala);
  for (const i of [11, 3, 8, 0, 6, 10, 2, 7]) { m.passo(instantes[i]); quadro(m, tela, escala); assert.ok(tela.bgra().equals(ref[i]), `de volta pra t = ${instantes[i]}`); }
});

test('custo em escala 1,25: mediana < 2 ms e pior quadro < 8 ms (só a cena; o pior é o menor de 3 passadas; falha só em 8 / 32: o CI é mais lento)', (t) => {
  const escala = 1.25, { m, sem } = novoMundo({ escala }), tela = telaDa(escala);
  const ts = [];
  for (let k = 0; k <= 8 * 30; k++) ts.push(k / 30);  // a entrada inteira
  for (const k of [0, 1]) { const b = pesca._janela(sem, k).b; for (let d = -2; d <= 3; d += 1 / 30) ts.push(b + d); }  // duas mordidas
  for (let T = 600; T < 3 * 3600; T += 337) ts.push(T);
  const melhor = new Array(ts.length).fill(Infinity);
  for (let r = 0; r < 3; r++) {
    ts.forEach((T, i) => {
      m.passo(T);
      const ini = process.hrtime.bigint();
      soCena(m, tela, escala);
      melhor[i] = Math.min(melhor[i], Number(process.hrtime.bigint() - ini) / 1e6);
    });
  }
  const ord = melhor.slice().sort((a, b) => a - b), mediana = ord[Math.floor(ord.length / 2)], pior = ord[ord.length - 1];
  // o quadro inteiro (com a moldura e os enfeites do tema), só pra referência
  const inteiro = [];
  for (const T of ts.slice(0, 120)) { m.passo(T); const ini = process.hrtime.bigint(); quadro(m, tela, escala); inteiro.push(Number(process.hrtime.bigint() - ini) / 1e6); }
  inteiro.sort((a, b) => a - b);
  t.diagnostic(`só a cena: mediana ${mediana.toFixed(2)} ms, pior ${pior.toFixed(2)} ms (${ts.length} quadros); quadro inteiro: mediana ${inteiro[60].toFixed(2)} ms`);
  assert.ok(mediana < 8, `mediana ${mediana.toFixed(2)} ms (alvo 2)`);
  assert.ok(pior < 32, `pior ${pior.toFixed(2)} ms (alvo 8)`);
});

// a saída cortando no instante tC: quadro a quadro (30/s) até o fim; devolve o último quadro e se invadiu o conteúdo
function rodarSaida({ tC, escala = 1.25, sessoes = 4, roupa = 'mc_steve' }) {
  const { m } = novoMundo({ escala, sessoes, roupa }), tela = telaDa(escala), ref = telaDa(escala);
  m.passo(tC);
  m.receber({ modo: 'andando' });  // algo voltou a rodar: o Mundo corta a cena
  assert.strictEqual(m.cena, null, 'o Mundo não cortou a cena');
  const p = m.pose(), g = tela.getContext('2d');
  let invasao = null;
  for (let k = 0; k <= Math.ceil(DUR_SAIDA * 30); k++) {
    const u = Math.min(DUR_SAIDA, k / 30);
    tela.limpar();
    g.setTransform(escala, 0, 0, escala, 0, 0);
    g.globalAlpha = 1;
    tema.fundo(g, m);
    g.save(); g.translate(p.x, p.y); g.rotate(p.a);
    pesca.saida.quadro(g, u, m, tC);
    g.restore();
    invasao = invasao || invadiu(m, tela, ref, escala);
  }
  // o último quadro, só o Clawd (sem o fundo)
  tela.limpar();
  g.setTransform(escala, 0, 0, escala, 0, 0);
  g.translate(p.x, p.y); g.rotate(p.a);
  pesca.saida.quadro(g, DUR_SAIDA, m, tC);
  return { m, tela, pose: p, invasao };
}
// o Clawd do tema, parado no meio de cima (o que o tema desenha sem cena)
function clawdDoTema({ escala = 1.25, sessoes = 4, roupa = 'mc_steve', T }) {
  const m = new Mundo({ tema, semente: 3 });
  m.receber({ ...estadoDeMentira('minecraft', 'parado', { sessoes }), escala });
  m.roupa = roupa; m.T = T;
  const tela = telaDa(escala), g = tela.getContext('2d'), p = m.pose();
  g.setTransform(escala, 0, 0, escala, 0, 0);
  g.translate(p.x, p.y); g.rotate(p.a);
  tema.clawd(g, m);
  return { tela, pose: p };
}

test('a saída, cortando na entrada e no laço (vários), termina com o Clawd do tema parado, no lugar', () => {
  const { sem } = novoMundo();
  const b0 = pesca._janela(sem, 0).b, b1 = pesca._janela(sem, 1).b;
  let vazio = null;
  for (let k = 0; vazio === null; k++) if (!pesca._janela(sem, k).peixe) vazio = pesca._janela(sem, k).b;
  const cortes = [0, 0.4, 1.0, 1.52, 1.75, 2.05, 2.3, 2.6, 2.9, 3.4, 3.6, 3.9, 4.3, 12,
    b0 - 0.8, b0 + 0.1, b0 + 0.35, b0 + 0.8, b0 + 1.4, b0 + 1.9, b1 + 0.6, vazio + 0.5, vazio + 1.2, 2 * 3600 + 13.7, 3 * 3600];
  const casos = [...cortes.map(tC => ({ tC })), { tC: b0 + 0.6, escala: 1, sessoes: 1 }, { tC: 2.3, escala: 2 }, { tC: b1 + 0.5, roupa: 'mc_alex' }, { tC: 600, roupa: 'mc_herobrine', escala: 2 }];
  for (const c of casos) {
    const r = rodarSaida(c);
    const onde = `corte em ${c.tC.toFixed(2)} s (escala ${c.escala || 1.25}, ${c.roupa || 'mc_steve'})`;
    assert.deepStrictEqual(r.m.erros, [], onde);
    assert.strictEqual(r.invasao, null, `${onde}: desenhou dentro do conteúdo do cartão em ${r.invasao}`);
    const t = clawdDoTema({ ...c, T: r.m.T });
    assert.deepStrictEqual([t.pose.x, t.pose.y, t.pose.a], [r.pose.x, r.pose.y, r.pose.a], `${onde}: o lugar`);
    assert.ok(r.tela.bgra().equals(t.tela.bgra()), `${onde}: o último quadro não é o Clawd do tema parado`);
  }
});

test('nada desenhado dentro do conteúdo do cartão (a entrada, o laço e as mordidas, cartões de 1 e 4 sessões)', () => {
  for (const [escala, sessoes] of [[1.25, 4], [1, 1], [2, 1]]) {
    const { m, sem } = novoMundo({ escala, sessoes }), tela = telaDa(escala), ref = telaDa(escala);
    const ts = [];
    for (let k = 0; k <= 6 * 30; k++) ts.push(k / 30);
    ts.push(...instantesDoLaco(sem));
    for (const T of ts) {
      m.passo(T); quadro(m, tela, escala);
      const onde = invadiu(m, tela, ref, escala);
      assert.strictEqual(onde, null, `escala ${escala}, ${sessoes} sessão(ões), t = ${T.toFixed(2)}: pixel ${onde}`);
    }
  }
});

test('sem textura nenhuma: a entrada, o laço e a saída não quebram', () => {
  const script = `
    const path = require('path');
    const MOTOR = ${JSON.stringify(MOTOR)};
    const { Tela } = require(path.join(MOTOR, 'raster'));
    const { Mundo } = require(path.join(MOTOR, 'mundo'));
    const tema = require(path.join(MOTOR, 'tema-minecraft'));
    const pesca = require(path.join(MOTOR, 'parado-minecraft-pesca'));
    const { estadoDeMentira } = require(${JSON.stringify(path.join(__dirname, '..', 'motor-foto'))});
    const m = new Mundo({ tema, semente: 5 }), erros = [];
    m.aoErro = e => erros.push(e);
    m.receber({ ...estadoDeMentira('minecraft', 'parado'), escala: 1.25 });
    m.comecarCena(pesca.cena(m));
    const tela = new Tela(475, 550), g = tela.getContext('2d');
    for (let T = 0; T < 60; T += 1 / 15) { m.passo(T); tela.limpar(); g.setTransform(1.25, 0, 0, 1.25, 0, 0); m.desenhar(g); }
    if (!m.cena) erros.push('a cena acabou');
    const p = m.pose();
    for (let u = 0; u <= pesca.saida.dur; u += 0.05) { tela.limpar(); g.setTransform(1.25, 0, 0, 1.25, 0, 0); g.translate(p.x, p.y); pesca.saida.quadro(g, u, m, 59.9); }
    process.stdout.write(JSON.stringify(erros));
  `;
  const p = spawnSync(process.execPath, ['-e', script], { encoding: 'utf8', timeout: 120000 });
  assert.strictEqual(p.status, 0, p.stderr);
  assert.deepStrictEqual(JSON.parse(p.stdout), []);
});
