'use strict';
// motor/tema-dragonball.js: toda cena quadro a quadro nas 3 escalas, o quadro como função do
// tempo, o custo, e as regras (transformação 1 em 10 ao começar a andar, por 30 s, as mais
// fortes mais raras; esferas que sobrevivem a reabrir e chamam o dragão na 7ª).
// Custo medido (Node 24, Windows, 06/10/2026, escala 1,25, depois de aquecer): passeio com a
// nuvem e os enfeites ~0,5 ms por quadro (mediana); pior quadro das cenas 2 a 6 ms (alvo 12).
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const { Tela } = require(path.join(MOTOR, 'raster'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const tema = require(path.join(MOTOR, 'tema-dragonball'));
const { largPx } = require(path.join(MOTOR, 'dragonball-arte'));
const { estadoDeMentira } = require('../motor-foto');

const ESCALAS = [1, 1.25, 2];
// um Mundo com o cartão de mentira, sem transformação sorteada no começo (o teste escolhe)
function montar({ escala = 1, modo = 'andando', semente = 2, pasta = null } = {}) {
  const m = new Mundo({ tema, semente, pasta });
  const erros = [];
  m.aoErro = e => erros.push(e);
  m.receber({ ...estadoDeMentira('dragonball', modo), escala });
  if (m.cena) m.fimCena(true);
  m.estado.tr = null;
  const tela = new Tela(Math.round(380 * escala), Math.round(440 * escala)), g = tela.getContext('2d');
  const quadro = T => {
    m.passo(T);
    tela.limpar(); g.setTransform(escala, 0, 0, escala, 0, 0); g.globalAlpha = 1;
    m.desenhar(g);
    return tela;
  };
  return { m, erros, tela, quadro };
}
const cheia = tela => { const px = tela.pixels; for (let i = 0; i < px.length; i++) if (px[i] !== 0) return true; return false; };

test('toda cena, quadro a quadro (30/s), a duração inteira, sem erro, nas escalas 1, 1,25 e 2', () => {
  assert.ok(tema.cenas.length >= 13, tema.cenas.join());
  for (const escala of ESCALAS) {
    for (const nome of tema.cenas) {
      const { m, erros, tela, quadro } = montar({ escala });
      const cena = tema.cenaPorNome(m, nome);
      assert.ok(cena && cena.dur > 0, `${nome}: cenaPorNome`);
      m.comecarCena(cena);
      assert.strictEqual(m.cena && m.cena.nome, nome, `${nome} não começou`);
      for (let f = 0; f <= Math.ceil(cena.dur * 30) + 1; f++) {
        quadro(f / 30);
        if (f % 10 === 0) assert.ok(cheia(tela), `${nome} @ ${escala}: quadro ${f} vazio`);
      }
      assert.deepStrictEqual(erros, [], `${nome} @ ${escala}`);
      assert.strictEqual(m.ruins.size, 0, `${nome} @ ${escala}: ${[...m.ruins]}`);
      assert.ok(!m.cena || m.cena.nome !== nome, `${nome} não terminou`);
    }
  }
  const { m } = montar();
  assert.strictEqual(tema.cenaPorNome(m, 'nao-existe'), null);
});

test('o quadro é função do tempo: o mesmo instante dá os mesmos bytes, por qualquer caminho', () => {
  for (const nome of tema.cenas) {
    const a = montar({ escala: 1.25 }), b = montar({ escala: 1.25 });
    const cena = tema.cenaPorNome(a.m, nome);
    a.m.comecarCena(cena); b.m.comecarCena(tema.cenaPorNome(b.m, nome));
    for (const t of [0.4, cena.dur * 0.62]) {
      for (let s = 1 / 30; s < t; s += 1 / 30) a.m.passo(s);
      for (let s = 1 / 7; s < t; s += 1 / 7) b.m.passo(s);  // pulando quadros
      const ta = Buffer.from(a.quadro(t).bgra()), tb = Buffer.from(b.quadro(t).bgra());
      assert.ok(ta.equals(tb), `${nome} @ ${t.toFixed(2)} s`);
      assert.ok(ta.equals(Buffer.from(a.quadro(t).bgra())), `${nome} @ ${t.toFixed(2)} s: desenhar de novo mudou`);
    }
  }
  // fora de cena (andando, com a nuvem e os enfeites): desenhar 2x o mesmo instante
  const { quadro } = montar({ escala: 1.25 });
  for (let s = 0; s < 3; s += 1 / 30) quadro(s);
  assert.ok(Buffer.from(quadro(3).bgra()).equals(Buffer.from(quadro(3).bgra())));
});

test('custo em 1,25: passeio < 4 ms por quadro e cena < 12 ms no pior (falha só acima de 16 e 40)', (t) => {
  const medir = (nome, segundos) => {
    const { m, quadro } = montar({ escala: 1.25 });
    let dur = segundos;
    if (nome) { const c = tema.cenaPorNome(m, nome); m.comecarCena(c); dur = c.dur; }
    const ms = [];
    for (let f = 0; f <= dur * 30; f++) {
      const ini = process.hrtime.bigint();
      quadro(f / 30);
      ms.push(Number(process.hrtime.bigint() - ini) / 1e6);
    }
    ms.sort((x, y) => x - y);
    return { mediana: ms[ms.length >> 1], pior: ms[ms.length - 1] };
  };
  medir(null, 8); for (const c of tema.cenas) medir(c);  // aquece: o 1º quadro de cada coisa monta o que fica guardado
  const passeio = Math.min(medir(null, 8).mediana, medir(null, 8).mediana);
  t.diagnostic(`passeio (nuvem + enfeites + Clawd andando): ${passeio.toFixed(2)} ms por quadro (mediana)`);
  assert.ok(passeio < 16, `${passeio.toFixed(2)} ms (alvo 4)`);
  for (const c of tema.cenas) {
    const r = [medir(c), medir(c)], pior = Math.min(r[0].pior, r[1].pior);  // a máquina oscila: o melhor de 2
    t.diagnostic(`${c}: mediana ${r[0].mediana.toFixed(2)} ms, pior ${pior.toFixed(2)} ms`);
    assert.ok(pior < 40, `${c}: pior quadro ${pior.toFixed(2)} ms (alvo 12)`);
  }
});

test('transformação: ~1 em 10 ao começar a andar, as mais fortes mais raras, 30 s e volta', () => {
  const m = new Mundo({ tema, semente: 1234 });
  m.receber(estadoDeMentira('dragonball', 'parado'));
  const conta = {}, N = 20000;
  for (let i = 0; i < N; i++) {
    m.receber({ modo: 'parado' }); m.receber({ modo: 'andando' });
    const tr = m.estado.tr;
    if (tr) {
      conta[tr.v.id] = (conta[tr.v.id] || 0) + 1;
      assert.strictEqual(m.cena && m.cena.nome, tr.v.id, 'a entrada é uma cena (ele para pra se transformar)');
      m.fimCena(true); m.estado.tr = null;
    }
  }
  const total = Object.values(conta).reduce((s, n) => s + n, 0);
  assert.ok(Math.abs(total / N - 0.1) < 0.01, `${total} em ${N}`);
  const peso = { kaioken: 7, ssj: 6, ssj2: 5, ssj3: 4, deus: 3, blue: 2, instinto: 1 };
  for (const [id, p] of Object.entries(peso)) {
    const esperado = total * p / 28;
    assert.ok(Math.abs(conta[id] - esperado) < esperado * 0.25 + 10, `${id}: ${conta[id]} (esperado ~${esperado.toFixed(0)})`);
  }
  assert.ok(conta.kaioken > conta.ssj2 && conta.ssj2 > conta.deus && conta.deus > conta.instinto, JSON.stringify(conta));

  // já transformado: começar a andar de novo não sorteia outra
  const { m: m2, quadro } = montar();
  m2.comecarCena(tema.cenaPorNome(m2, 'blue'));
  const ent = m2.estado.tr.v.entrada, dist0 = m2.dist;
  quadro(ent / 2);
  assert.strictEqual(m2.dist, dist0, 'parado durante a entrada');
  for (let s = ent / 2; s < ent + 1; s += 1 / 30) quadro(s);
  assert.ok(m2.dist > dist0, 'anda transformado depois da entrada');
  for (let i = 0; i < 50; i++) { m2.receber({ modo: 'parado' }); m2.receber({ modo: 'andando' }); }
  assert.strictEqual(m2.estado.tr.v.id, 'blue');
  if (m2.cena) m2.fimCena(true);
  for (let s = ent + 1; s < ent + 29.9; s += 0.1) m2.passo(s);
  assert.ok(m2.estado.tr && m2.estado.tr.tv0 == null, 'ainda transformado aos 29,9 s');
  m2.passo(ent + 30.05);
  assert.ok(m2.estado.tr && m2.estado.tr.tv0 != null, 'começa a voltar aos 30 s');
  m2.passo(ent + 30.6);
  assert.strictEqual(m2.estado.tr, null, 'normal de novo');

  // pergunta no meio da entrada: corta a cena e ele já fica transformado
  const { m: m3 } = montar();
  m3.comecarCena(tema.cenaPorNome(m3, 'ssj3'));
  m3.passo(0.5); m3.receber({ modo: 'pulando' });
  assert.strictEqual(m3.cena, null);
  assert.ok(m3.T - m3.estado.tr.t0 >= m3.estado.tr.v.entrada, 'pulou o resto da entrada');
});

test('esferas: cada sessão que termina dá uma, sobrevivem a reabrir, e a 7ª chama o dragão', () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'cm-dragonball-'));
  try {
    let { m, quadro } = montar({ pasta });
    for (let i = 0; i < 6; i++) m.evento('terminou');
    assert.strictEqual(m.estado.n, 6);
    assert.strictEqual(JSON.parse(fs.readFileSync(path.join(pasta, 'motor-estado.json'), 'utf8')).esferas, 6);
    ({ m, quadro } = montar({ pasta }));  // reabriu a janelinha
    assert.strictEqual(m.estado.n, 6, 'as 6 voltaram');
    m.evento('tudo');
    assert.strictEqual(m.estado.n, 7);
    assert.strictEqual(m.salvo.esferas, 0, 'o dragão já gastou as 7');
    quadro(0.3);
    assert.ok(!m.cena || m.cena.nome !== 'dragao', 'o dragão espera a 7ª aparecer');
    m.evento('terminou');
    assert.strictEqual(m.estado.n, 7, 'durante o evento não conta');
    quadro(0.7);
    assert.strictEqual(m.cena && m.cena.nome, 'dragao');
    assert.strictEqual(m.estado.n, 0);
    const fim = m.T + m.cena.dur;
    m.evento('terminou');
    assert.strictEqual(m.estado.n, 0, 'durante o dragão não conta');
    for (let s = 0.7; s < fim + 0.1; s += 1 / 30) quadro(s);
    assert.strictEqual(m.cena, null, 'o dragão foi embora');
    m.evento('terminou');
    assert.strictEqual(m.estado.n, 1, 'recomeça a contar');
    assert.strictEqual(montar({ pasta }).m.estado.n, 1);
    // Clawd desligado: não ganha esfera
    const sem = montar({ pasta });
    sem.m.receber({ clawd: false });
    sem.m.evento('terminou');
    assert.strictEqual(sem.m.estado.n, 1);
  } finally {
    fs.rmSync(pasta, { recursive: true, force: true });
  }
});

test('nuvem: dá a volta inteira e termina onde começou; cortada, fica onde parou', () => {
  let { m, quadro } = montar();
  for (let s = 0; s < 1; s += 1 / 30) quadro(s);
  const per = m.perimetro(), d0 = m.dist;
  m.comecarCena(tema.cenaPorNome(m, 'nuvem'));
  for (let s = m.T + 1 / 30; m.cena; s += 1 / 30) quadro(s);
  assert.ok(Math.abs(((m.dist - d0) % per)) < 2, `${m.dist} ${d0}`);  // no quadro em que acaba ele já dá um passo
  ({ m, quadro } = montar());
  m.comecarCena(tema.cenaPorNome(m, 'nuvem'));
  quadro(2.3);
  m.receber({ modo: 'pulando' });
  assert.ok(Math.abs(m.dist - 120 * 2) < 1, `${m.dist}`);
});

test('layout: as colunas cabem os números na fonte do visor (com a sombra)', () => {
  const { colunas, letra, barra, enfeites } = tema.layout;
  assert.strictEqual(enfeites, true);
  assert.strictEqual(letra, 11);
  assert.deepStrictEqual(barra, [118, 6]);
  for (const s of ['agora', '15h47', '23h59', '59m']) assert.ok(largPx(s) + 1 <= colunas.tempo, s);
  for (const s of ['2d23h', '1h20']) assert.ok(largPx(s) + 1 <= colunas.falta, s);
  assert.ok(largPx('100%') + 1 <= colunas.pct - 4, '100% com folga da barra');
  for (const s of ['5h', '7d']) assert.ok(largPx(s) + 1 <= colunas.rotulo - 2, s);
  assert.deepStrictEqual(tema.trilha, { raio: 8, baixo: 14 });
});

test('parado e sem nada acontecendo, o motor pode cair pra 5 quadros/s', () => {
  const { m, quadro } = montar({ modo: 'parado' });
  m.receber({ uso: [] });
  quadro(1);
  assert.strictEqual(tema.animado(m), false);
  const b = montar();
  b.m.comecarCena(tema.cenaPorNome(b.m, 'ssj'));
  b.m.receber({ modo: 'parado', uso: [] });  // parou transformado: a aura mexe
  assert.ok(b.m.estado.tr);
  assert.strictEqual(tema.animado(b.m), true);
  const c = montar({ modo: 'parado' });  // 85% de usage: o "MAIS DE 8000!" pisca nos 1,4 s dele
  assert.strictEqual(tema.animado(c.m), false);
  c.quadro(2.6);
  assert.strictEqual(tema.animado(c.m), true);
});
