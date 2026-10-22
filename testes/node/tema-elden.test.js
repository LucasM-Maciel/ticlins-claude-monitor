'use strict';
// motor/tema-elden.js: toda cena quadro a quadro nas 3 escalas, o quadro como função do tempo, o custo, o local de graça
// quando acaba tudo, as cenas que terminam mais à frente, as de parado (graça e Torrent, até 3 h, a saída terminando no
// Clawd andando), o layout, a roupa sorteada a cada volta, os inimigos sorteados nas cenas, o épico a cada 30 inimigos
// abatidos (o chefe em rodízio) e os sons do tema existindo. A luta em si: elden-epico.test.js.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const { Tela } = require(path.join(MOTOR, 'raster'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const { lerWav } = require(path.join(MOTOR, 'som'));
const tema = require(path.join(MOTOR, 'tema-elden'));
const A = require(path.join(MOTOR, 'elden-arte'));
const INI = require(path.join(MOTOR, 'elden-inimigos'));
const { estadoDeMentira } = require('../motor-foto');

const ESCALAS = [1, 1.25, 2];
const JANELINHA = path.join(MOTOR, '..');
const PARADAS = ['graca', 'torrent'];
function montar({ escala = 1, modo = 'andando', semente = 2 } = {}) {
  const m = new Mundo({ tema, semente });
  const erros = [];
  m.aoErro = e => erros.push(e);
  m.receber({ ...estadoDeMentira('elden', modo), escala });
  if (m.cena) m.fimCena(true);
  if (modo === 'andando') m.dist = 60;  // no meio da reta de cima: as cenas cabem (a trilha começa no canto)
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
const modoDa = nome => (PARADAS.includes(nome) ? 'parado' : 'andando');
const durDe = cena => (Number.isFinite(cena.dur) ? cena.dur : 20);  // as de parado não acabam sozinhas: 20 s

test('toda cena, quadro a quadro (30/s), a duração inteira, sem erro, nas escalas 1, 1,25 e 2', () => {
  assert.deepStrictEqual(tema.cenas, ['abatido', 'mensagem', 'mimico', 'morreu', 'graca', 'torrent', 'graca-descoberta']);
  for (const escala of ESCALAS) {
    for (const nome of tema.cenas) {
      const { m, erros, tela, quadro } = montar({ escala, modo: modoDa(nome) });
      const cena = tema.cenaPorNome(m, nome);
      assert.ok(cena && cena.dur > 0, `${nome}: cenaPorNome`);
      m.comecarCena(cena);
      assert.strictEqual(m.cena && m.cena.nome, nome, `${nome} não começou`);
      const dur = durDe(cena);
      for (let f = 0; f <= Math.ceil(dur * 30) + 1; f++) {
        m.proxima = Infinity;
        quadro(f / 30);
        if (f % 10 === 0) assert.ok(cheia(tela), `${nome} @ ${escala}: quadro ${f} vazio`);
      }
      assert.deepStrictEqual(erros, [], `${nome} @ ${escala}`);
      assert.strictEqual(m.ruins.size, 0, `${nome} @ ${escala}: ${[...m.ruins]}`);
      if (Number.isFinite(cena.dur)) assert.ok(!m.cena || m.cena.nome !== nome, `${nome} não terminou`);
    }
  }
  const { m } = montar();
  assert.strictEqual(tema.cenaPorNome(m, 'nao-existe'), null);
});

test('o quadro é função do tempo: o mesmo instante dá os mesmos bytes, por qualquer caminho', () => {
  for (const nome of tema.cenas) {
    const a = montar({ escala: 1.25, modo: modoDa(nome) }), b = montar({ escala: 1.25, modo: modoDa(nome) });
    const cena = tema.cenaPorNome(a.m, nome);
    a.m.comecarCena(cena); b.m.comecarCena(tema.cenaPorNome(b.m, nome));
    for (const t of [0.4, durDe(cena) * 0.62]) {
      for (let s = 1 / 30; s < t; s += 1 / 30) a.m.passo(s);
      for (let s = 1 / 7; s < t; s += 1 / 7) b.m.passo(s);  // pulando quadros
      const ta = Buffer.from(a.quadro(t).bgra()), tb = Buffer.from(b.quadro(t).bgra());
      assert.ok(ta.equals(tb), `${nome} @ ${t.toFixed(2)} s`);
      assert.ok(ta.equals(Buffer.from(a.quadro(t).bgra())), `${nome} @ ${t.toFixed(2)} s: desenhar de novo mudou`);
    }
  }
});

test('custo em 1,25: passeio < 4 ms por quadro e cena < 12 ms no pior (falha só acima de 16 e 40)', (t) => {
  const medir = (nome, segundos) => {
    const { m, quadro } = montar({ escala: 1.25, modo: nome ? modoDa(nome) : 'andando' });
    let dur = segundos;
    if (nome) { const c = tema.cenaPorNome(m, nome); m.comecarCena(c); dur = durDe(c); }
    const ms = [];
    for (let f = 0; f <= dur * 30; f++) {
      const ini = process.hrtime.bigint();
      quadro(f / 30);
      ms.push(Number(process.hrtime.bigint() - ini) / 1e6);
    }
    ms.sort((x, y) => x - y);
    return { mediana: ms[ms.length >> 1], pior: ms[ms.length - 1] };
  };
  medir(null, 8); for (const c of tema.cenas) medir(c);  // aquece
  const passeio = Math.min(medir(null, 8).mediana, medir(null, 8).mediana);
  t.diagnostic(`passeio (moldura + enfeites + Clawd andando): ${passeio.toFixed(2)} ms por quadro (mediana)`);
  assert.ok(passeio < 16, `${passeio.toFixed(2)} ms (alvo 4)`);
  for (const c of tema.cenas) {
    const r = [medir(c), medir(c)], pior = Math.min(r[0].pior, r[1].pior), mediana = Math.min(r[0].mediana, r[1].mediana);
    t.diagnostic(`${c}: mediana ${mediana.toFixed(2)} ms, pior ${pior.toFixed(2)} ms`);
    assert.ok(mediana < 16, `${c}: mediana ${mediana.toFixed(2)} ms`);
    assert.ok(pior < 40, `${c}: pior quadro ${pior.toFixed(2)} ms (alvo 12)`);
  }
});

test('acabou tudo: o local de graça corta a cena da vez, não repete por cima e não corta o épico', () => {
  for (const modo of ['andando', 'parado']) {
    const { m, quadro } = montar({ modo });
    if (modo === 'andando') m.comecarCena(tema.cenaPorNome(m, 'mimico'));
    quadro(0.5);
    m.evento('tudo');
    assert.strictEqual(m.cena && m.cena.nome, 'graca-descoberta', modo);
    const t0 = m.cena.t0;
    quadro(1);
    m.evento('tudo');  // o segundo não recomeça
    assert.strictEqual(m.cena.t0, t0);
  }
  const { m } = montar();
  m.evento('terminou');
  assert.strictEqual(m.cena, null);
  m.receber({ clawd: false });
  m.evento('tudo');
  assert.strictEqual(m.cena, null);
  const e = montar().m;
  e.comecarCena(tema.cenaPorNome(e, 'epico'));
  e.evento('tudo');
  assert.strictEqual(e.cena && e.cena.nome, 'epico', 'o aviso toca por cima do épico');
});

test('as cenas que terminam mais à frente só andam se ele já chegou lá; cortada antes fica onde estava', () => {
  assert.ok(Object.keys(tema.pula).includes('mensagem'), 'a mensagem: ele pula e cai mais adiante');
  const ate = (m, t) => { const T0 = m.cena.t0; for (let T = m.T + 1 / 30; m.cena && T - T0 < t; T += 1 / 30) { m.proxima = Infinity; m.passo(T); } };
  for (const [nome, [quando, quanto]] of Object.entries(tema.pula)) {
    const { m, quadro } = montar();
    m.comecarCena(tema.cenaPorNome(m, nome));
    const d0 = m.dist;
    ate(m, 99);
    assert.strictEqual(m.cena, null, nome);
    assert.ok(m.dist - d0 >= quanto && m.dist - d0 < quanto + 2, `${nome}: andou ${m.dist - d0}`);
    quadro(m.T);
    const b = montar().m;
    b.comecarCena(tema.cenaPorNome(b, nome));
    const d1 = b.dist;
    ate(b, quando - 0.2);
    b.receber({ modo: 'pulando' });
    assert.strictEqual(b.dist, d1, `${nome}: cortada antes`);
    const c = montar().m;
    c.comecarCena(tema.cenaPorNome(c, nome));
    const d2 = c.dist;
    ate(c, quando + 0.1);
    c.fimCena(true);
    assert.strictEqual(c.dist, d2 + quanto, `${nome}: cortada depois`);
  }
  for (const nome of tema.sorteadas.filter(n => !(n in tema.pula))) {  // as outras ficam onde estão
    const { m } = montar();
    m.comecarCena(tema.cenaPorNome(m, nome));
    const d0 = m.dist;
    ate(m, 99);
    assert.ok(m.dist - d0 < 2, `${nome}: andou ${m.dist - d0}`);
  }
});

test('parado há 1 min: graça e Torrent; algo rodando, a saída toca e termina no Clawd andando', () => {
  for (const id of PARADAS) {
    const { m, quadro, erros } = montar({ modo: 'parado' });
    m.salvo.paradoVez = PARADAS.indexOf(id);
    for (let T = 0; T < 61; T += 1 / 5) quadro(T);
    assert.strictEqual(m.cena && m.cena.nome, id);
    for (let T = 61; T < 3 * 3600; T += 37) quadro(T);  // 3 h, pulando quadros
    assert.strictEqual(m.cena && m.cena.nome, id);
    const T0 = 3 * 3600 + 1;
    quadro(T0);
    m.receber({ modo: 'andando' });
    assert.strictEqual(m.cena, null);
    assert.ok(tema.bloqueia(m), 'a saída segura o Clawd');
    for (let T = T0; T < T0 + 1.5; T += 1 / 30) quadro(T);
    assert.ok(!tema.bloqueia(m), 'a saída acabou');
    assert.deepStrictEqual(erros, [], id);
  }
});

test('layout: enfeites do tema, moldura de 3 px, e as colunas de sempre', () => {
  assert.strictEqual(tema.layout.enfeites, true);
  assert.deepStrictEqual(tema.layout.moldura, [3, 3, 3, 3]);
  assert.deepStrictEqual(Object.keys(tema.layout.colunas), ['tempo', 'pct', 'falta', 'rotulo']);
  const a = montar({ modo: 'parado' });
  assert.ok(cheia(a.quadro(0)), 'a moldura e os enfeites desenham');
  assert.deepStrictEqual(a.erros, []);
});

test('a roupa é sorteada a cada volta, sempre diferente da anterior, e as 3 aparecem', () => {
  assert.deepStrictEqual([...A.ROUPAS.LISTA].sort(), ['elden-bandido', 'elden-cavaleiro', 'elden-feiticeiro']);
  const { m } = montar();
  const vistas = new Set();
  let antes = tema.roupaDe(m);
  vistas.add(antes);
  for (let v = 1; v <= 40; v++) {
    tema.aoDarVolta(m);
    const agora = tema.roupaDe(m);
    assert.notStrictEqual(agora, antes, `volta ${v}: a mesma roupa duas vezes seguidas`);
    assert.strictEqual(m.salvo.eldenVoltas, v);
    vistas.add(agora); antes = agora;
  }
  assert.strictEqual(vistas.size, 3);
  // cada roupa desenha o Clawd sem erro e diferente das outras
  const imagens = A.ROUPAS.LISTA.map(r => {
    const t = montar({ modo: 'parado' });
    t.m.salvo.eldenRoupa = r;
    return Buffer.from(t.quadro(1).bgra());
  });
  assert.ok(!imagens[0].equals(imagens[1]) && !imagens[1].equals(imagens[2]) && !imagens[0].equals(imagens[2]));
});

test('os inimigos: o bug, o soldado, o cão e o espírito, sorteados pela semente; desenham sem erro em qualquer estado', () => {
  assert.deepStrictEqual(INI.TIPOS, ['bug', 'soldado', 'cao', 'espirito']);
  const vistos = new Set();
  for (let s = 1; s <= 80; s++) {
    const ini = INI.sortear(s);
    assert.ok(INI.TIPOS.includes(ini.tipo) && ini.larg > 0 && ini.alt > 0, `semente ${s}`);
    vistos.add(ini.tipo);
    assert.deepStrictEqual(INI.sortear(s), ini, 'o sorteio é determinístico');
  }
  assert.strictEqual(vistos.size, 4);
  const g = new Tela(120, 80).getContext('2d');
  for (const tipo of INI.TIPOS) {
    for (const opc of [{}, { passo: 'q' }, { a: 0.8 }, { morte: 0.5 }, { morte: 1 }, { alfa: 0.5, sx: 1.2, sy: 0.8 }]) {
      g.save(); INI.inimigo(g, { tipo, larg: 20, alt: 14 }, 60, 70, opc); g.restore();
    }
  }
});

test('épico: a cada 30 inimigos abatidos, na próxima parada na reta de cima; cortado volta, quebrado não; o chefe gira 0→3→0', () => {
  const falso = { cena: () => ({ nome: 'epico', dur: 2, espaco: { frente: 0, tras: 0 }, modos: ['andando'], quadro() {} }) };
  const naReta = (m, lado) => { const g = m.geometria(); m.dist = lado === 'cima' ? (g.w - 2 * g.r) / 2 : (g.w - 2 * g.r) + Math.PI * g.r / 2 + 10; };
  const ateOFim = m => { for (let T = m.T + 0.1; m.cena; T += 0.1) { m.proxima = Infinity; m.passo(T); } };
  const cena = (m, nome, ate = Infinity) => {
    naReta(m, 'cima');
    m.comecarCena(tema.cenaPorNome(m, nome));
    const T0 = m.T;
    for (let T = T0 + 0.1; m.cena && T - T0 < ate; T += 0.1) { m.proxima = Infinity; m.passo(T); }
    if (m.cena) m.receber({ modo: 'pulando' });
    m.receber({ modo: 'andando' });
  };
  assert.strictEqual(tema.inimigosPorEpico, 30);
  assert.deepStrictEqual(tema.chefes, ['margit', 'godrick', 'malenia', 'radahn', 'lendario']);
  try {
    tema.trocarEpico(falso);
    const { m, erros } = montar();
    m.salvo.eldenAbatidos = 27;
    cena(m, 'abatido', 0.5);
    assert.strictEqual(m.salvo.eldenAbatidos, 27, 'cortada antes do golpe: não conta');
    cena(m, 'mensagem'); cena(m, 'morreu');
    assert.strictEqual(m.salvo.eldenAbatidos, 27, 'só o abatido e o baú derrubam');
    cena(m, 'abatido'); cena(m, 'mimico');
    assert.strictEqual(m.salvo.eldenAbatidos, 29);
    assert.ok(!m.salvo.eldenEpico);
    cena(m, 'abatido');
    assert.strictEqual(m.salvo.eldenEpico, true, 'o 30º pede o épico');
    naReta(m, 'lado');
    assert.strictEqual(tema.naParada(m), undefined, 'no lado do cartão: espera chegar na reta de cima');
    naReta(m, 'cima');
    const c = tema.naParada(m);
    assert.ok(c && c.nome === 'epico' && c.epico, 'na reta de cima: o épico, sem o cara-ou-coroa');
    m.comecarCena(c);
    assert.strictEqual(m.salvo.eldenEpico, false);
    m.passo(m.T + 0.5);
    m.receber({ modo: 'pulando' });  // pergunta no meio: corta e não gasta a vez (nem o chefe)
    assert.strictEqual(m.cena, null);
    assert.strictEqual(m.salvo.eldenEpico, true, 'cortado: o pedido volta');
    assert.ok(!m.salvo.eldenChefe, 'cortado: o chefe é o mesmo');
    m.receber({ modo: 'andando' });
    for (let i = 1; i <= 6; i++) {  // até o fim: gasta e passa pro próximo chefe, girando 0 → 4 (o lendário) → 0
      m.salvo.eldenEpico = true;
      naReta(m, 'cima');
      m.comecarCena(tema.naParada(m));
      ateOFim(m);
      assert.strictEqual(m.salvo.eldenEpico, false, 'até o fim: gasta');
      assert.strictEqual(m.salvo.eldenChefe, i % 5, `depois de ${i} lutas`);
    }
    // quebrou: não volta, e a parada segue normal
    m.salvo.eldenEpico = true;
    naReta(m, 'cima');
    m.comecarCena(tema.naParada(m));
    m.ruins.add('epico'); m.fimCena(true);
    assert.strictEqual(m.salvo.eldenEpico, false, 'quebrado: não pede de novo');
    // sem o arquivo: idem
    m.ruins.clear();
    tema.trocarEpico(null);
    m.salvo.eldenEpico = true;
    const d = tema.naParada(m);
    assert.ok(!d || d.nome !== 'epico');
    assert.strictEqual(m.salvo.eldenEpico, false);
    assert.strictEqual(tema.cenaPorNome(m, 'epico'), null);
    assert.deepStrictEqual(erros, []);
  } finally { tema.trocarEpico(undefined); }
});

test('os sons do tema existem e são WAV que o motor lê; toda cena e todo chefe só pedem sons que existem', () => {
  const ler = n => {
    const f = path.join(JANELINHA, 'sons-elden', n + '.wav');
    assert.ok(fs.existsSync(f), `falta ${f}`);
    const w = lerWav(fs.readFileSync(f));
    assert.ok(w && w.amostras && w.amostras.length > 1000, n);
  };
  for (const n of ['esperando', 'terminou', 'tudo']) ler(n);
  const pedidos = new Set();
  for (const chefe of tema.chefes.keys()) {
    const m = montar().m;
    m.salvo.eldenChefe = chefe;
    for (const [, arq] of tema.cenaPorNome(m, 'epico').sons) pedidos.add(arq);
  }
  for (const nome of tema.cenas) {
    const m = montar({ modo: modoDa(nome) }).m;
    for (let s = 1; s <= 12; s++) {
      const c = new Mundo({ tema, semente: s });
      c.receber({ ...estadoDeMentira('elden', modoDa(nome)), escala: 1 });
      for (const [, arq] of (tema.cenaPorNome(c, nome).sons || [])) pedidos.add(arq);
    }
    void m;
  }
  for (const arq of pedidos) {
    assert.match(arq, /^sons-elden\/[a-z0-9-]+\.wav$/, arq);
    ler(path.basename(arq, '.wav'));
  }
  assert.ok(pedidos.size >= 15,`só ${pedidos.size} sons pedidos`);
});
