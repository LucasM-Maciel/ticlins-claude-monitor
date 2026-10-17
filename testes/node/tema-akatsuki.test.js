'use strict';
// motor/tema-akatsuki.js: toda cena quadro a quadro nas 3 escalas, o quadro como função do tempo, o
// custo, a lua quando acaba tudo (sem trilha: o aviso já toca), as cenas que terminam mais à frente
// na trilha, o épico a cada 30 bugs, as cenas de parado (lámen e treino, até 3 h, a saída
// terminando no Clawd andando), os sons do tema existindo, e os dois lados (a cada 50 voltas: a
// virada, as 3 roupas de cada lado, as cores e as cenas do Time 7, o épico de cada lado), e os
// inimigos sorteados nas cenas (o bug e mais 3 de cada lado). Os épicos em si: akatsuki-epico.test.js e akatsuki-epico-time7.test.js.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const { Tela } = require(path.join(MOTOR, 'raster'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const { layoutDe } = require(path.join(MOTOR, 'comum'));
const { lerWav } = require(path.join(MOTOR, 'som'));
const tema = require(path.join(MOTOR, 'tema-akatsuki'));
const K = require(path.join(MOTOR, 'akatsuki-cartao'));
const A = require(path.join(MOTOR, 'akatsuki-arte'));
const INI = require(path.join(MOTOR, 'akatsuki-inimigos'));
const { estadoDeMentira } = require('../motor-foto');

const ESCALAS = [1, 1.25, 2];
const JANELINHA = path.join(MOTOR, '..');
// roupa: veste antes de começar (com as voltas que levam a ela, pra não pedir a virada)
const VOLTAS_DA = { akatsuki: 0, 't7-laranja': 50, 'aka-espiral': 100, 't7-colete': 150, 'aka-riscada': 200, 't7-azul': 250 };
function montar({ escala = 1, modo = 'andando', semente = 2, roupa = null, pasta = null } = {}) {
  const m = new Mundo({ tema, semente, pasta });
  if (roupa) Object.assign(m.salvo, { akaRoupa: roupa, akaVoltas: VOLTAS_DA[roupa] });
  const erros = [];
  m.aoErro = e => erros.push(e);
  m.receber({ ...estadoDeMentira('akatsuki', modo), escala });
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
const PARADAS = ['lamen', 'treino'];
const modoDa = nome => (PARADAS.includes(nome) ? 'parado' : 'andando');
const durDe = cena => (Number.isFinite(cena.dur) ? cena.dur : 20);  // as de parado não acabam sozinhas: 20 s

test('toda cena, quadro a quadro (30/s), a duração inteira, sem erro, nas escalas 1, 1,25 e 2', () => {
  assert.deepStrictEqual(tema.cenas, ['clones', 'corvos', 'tronco', 'fogo', 'sapo', 'esfera', 'raio', 'folhas', 'lamen', 'treino', 'lua', 'virada']);
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
    const r = [medir(c), medir(c)], pior = Math.min(r[0].pior, r[1].pior);
    t.diagnostic(`${c}: mediana ${r[0].mediana.toFixed(2)} ms, pior ${pior.toFixed(2)} ms`);
    assert.ok(pior < 40, `${c}: pior quadro ${pior.toFixed(2)} ms (alvo 12)`);
  }
});

test('acabou tudo: a lua corta a cena da vez, sem trilha (o aviso já toca) e não repete por cima', () => {
  for (const modo of ['andando', 'parado']) {
    const { m, quadro } = montar({ modo });
    const sons = [];
    m.aoSom = c => sons.push(c && c.nome);
    if (modo === 'andando') m.comecarCena(tema.cenaPorNome(m, 'fogo'));
    quadro(0.5);
    m.evento('tudo');
    assert.strictEqual(m.cena && m.cena.nome, 'lua', modo);
    const t0 = m.cena.t0;
    quadro(1);
    m.evento('tudo');  // o segundo não recomeça
    assert.strictEqual(m.cena.t0, t0);
    m.receber({ modo: 'parado' });  // o estado 'parado' chegando depois não corta
    assert.strictEqual(m.cena && m.cena.nome, 'lua');
    assert.deepStrictEqual(sons, [], 'som de cena: só o épico tem (como nos outros temas)');
  }
  const { m } = montar();
  m.evento('terminou');
  assert.strictEqual(m.cena, null);
  m.receber({ clawd: false });
  m.evento('tudo');
  assert.strictEqual(m.cena, null);
});

test('clones, corvos, tronco, sapo, esfera, raio e folhas terminam mais à frente: só se ele já chegou lá, e cortada antes fica onde estava', () => {
  assert.deepStrictEqual(Object.keys(tema.pula), ['clones', 'corvos', 'tronco', 'sapo', 'esfera', 'raio', 'folhas']);
  const ate = (m, t) => { const T0 = m.cena.t0; for (let T = m.T + 1 / 30; m.cena && T - T0 < t; T += 1 / 30) { m.proxima = Infinity; m.passo(T); } };
  for (const [nome, [quando, quanto]] of Object.entries(tema.pula)) {
    // até o fim: o Clawd aparece onde a cena deixou (o último quadro e o seguinte batem)
    const { m, quadro } = montar();
    m.comecarCena(tema.cenaPorNome(m, nome));
    const d0 = m.dist;
    ate(m, 99);
    assert.strictEqual(m.cena, null, nome);
    // (o passo que encerra a cena já anda 1 quadro: até 50/30 px a mais)
    assert.ok(m.dist - d0 >= quanto && m.dist - d0 < quanto + 2, `${nome}: andou ${m.dist - d0}`);
    quadro(m.T);
    // cortada (pergunta) antes de chegar: fica; depois: vai
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
    c.fimCena(true);  // 'tudo' cortando andando (a lua entra no lugar, andando)
    assert.strictEqual(c.dist, d2 + quanto, `${nome}: cortada depois`);
  }
  // as que não andam ficam
  for (const nome of ['fogo']) {
    const { m } = montar();
    m.comecarCena(tema.cenaPorNome(m, nome));
    const d0 = m.dist;
    ate(m, 99);
    assert.ok(m.dist - d0 < 2, `${nome}: andou ${m.dist - d0}`);
  }
});

test('o último quadro da cena que anda e o 1º do Clawd andando ficam no mesmo lugar (sem pulo na tela)', () => {
  // compara o x do Clawd (a coluna mais à direita do chapéu, nas linhas da aba) antes e depois do
  // fim; olha 4 linhas porque andando ele balança e a aba sobe e desce
  const colunaDoChapeu = (tela, y0) => {
    let maior = -1;
    for (let y = y0 - 2; y <= y0 + 1; y++) {
      for (let x = 0; x < tela.width; x++) { const p = tela.pixels[y * tela.width + x]; if (p !== 0 && ((p >>> 8) & 255) > 150 && ((p >>> 16) & 255) > 150) maior = Math.max(maior, x); }
    }
    return maior;
  };
  for (const nome of Object.keys(tema.pula)) {
    const { m, quadro } = montar();
    m.comecarCena(tema.cenaPorNome(m, nome));
    const dur = m.cena.dur;
    let T = 0;
    for (; T < dur - 1 / 30; T += 1 / 30) { m.proxima = Infinity; quadro(T); }
    const y = Math.round(m.host.cartao[1] - 19);  // a aba do chapéu
    const antes = colunaDoChapeu(quadro(T), y);
    m.proxima = Infinity;
    const depois = colunaDoChapeu(quadro(dur + 0.001), y);
    assert.ok(antes > 0 && Math.abs(antes - depois) <= 6, `${nome}: ${antes} -> ${depois}`);
  }
});

test('parado há 1 min: lámen, depois treino; algo rodando, a saída toca e termina no Clawd andando', () => {
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

test('layout: enfeites do tema, moldura de 2 px e as colunas de sempre', () => {
  const l = layoutDe(tema);
  assert.strictEqual(l.enfeites, true);
  assert.deepStrictEqual(l.moldura, [2, 2, 2, 2]);
  assert.deepStrictEqual(l.colunas, { tempo: 36, pct: 38, falta: 48, rotulo: 18 });
});

test('a moldura é chapada: um fio vermelho de 1 px na borda e, por dentro, só as nuvens (sem brilho, sem fio largo)', () => {
  const W = 220, H = 110, tela = new Tela(W, H), g = tela.getContext('2d');
  K.moldura(g, [0, 0, W, H], 0);
  let fio = 0; for (let x = 12; x < W - 12; x++) if ((tela.pixels[x] >>> 0) === 0xFFDC2626) fio++;
  assert.ok(fio > 100, `o fio vermelho liso na borda de cima: ${fio} px`);
  for (let y = 2; y < 8; y++) {  // por dentro do fio, o antigo era uma linha de ~175 px seguidos (vinho ou vermelho, com o brilho)
    let corrida = 0, maior = 0;
    for (let x = 12; x < W - 12; x++) {
      const p = tela.pixels[y * W + x], r = (p >>> 16) & 255, gg = (p >>> 8) & 255, b = p & 255;
      corrida = r > 100 && gg < 70 && b < 70 ? corrida + 1 : 0; maior = Math.max(maior, corrida);
    }
    assert.ok(maior < 30, `linha ${y}: ${maior} px seguidos de vermelho`);
  }
});

test('a moldura anda: o quadro em t=0 difere do de t=3', () => {
  const quadro = t => { const tela = new Tela(120, 60), g = tela.getContext('2d'); K.moldura(g, [0, 0, 120, 60], t); return tela.pixels; };
  const a = quadro(0), b = quadro(3);
  let dif = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) dif++;
  assert.ok(dif > 100, `${dif} pixels diferentes`);
});

test('a moldura do Time 7 é parada: fio azul-marinho por fora, laranja por dentro, igual em qualquer instante', () => {
  try {
    A.vestir('t7-colete');
    const quadro = t => { const tela = new Tela(120, 60), g = tela.getContext('2d'); K.moldura(g, [0, 0, 120, 60], t); return tela; };
    const a = quadro(0), b = quadro(3);
    assert.deepStrictEqual(Array.from(a.pixels), Array.from(b.pixels));
    assert.strictEqual(a.pixels[1 * 120 + 60] >>> 0, 0xFFF97316, 'laranja na 2ª linha');
  } finally { A.vestir('akatsuki'); }
});

test('a barra do usage: branca até o gasto, vermelha nos níveis altos, redemoinho na ponta (sem kunai), e a nuvenzinha da situação', () => {
  const px = (tela, x, y) => { const p = tela.pixels[y * tela.width + x]; return { r: (p >>> 16) & 255, g: (p >>> 8) & 255, b: p & 255 }; };
  const barra = (pct, nivel = pct >= 95 ? 2 : pct >= 80 ? 1 : 0) => { const tela = new Tela(130, 8), g = tela.getContext('2d'); K.barra(g, [0, 1, 118, 5], pct, nivel, 0); return tela; };
  const b = barra(50), cheio = (118 - 8) * 0.5;
  const branco = px(b, 10, 4), trilho = px(b, Math.round(cheio + 20), 4), olho = px(b, Math.round(cheio), 4);
  assert.ok(branco.r > 230 && branco.g > 230 && branco.b > 230, `branco: ${JSON.stringify(branco)}`);
  assert.ok(trilho.r < 80 && trilho.b < 80, `trilho escuro: ${JSON.stringify(trilho)}`);
  assert.ok(olho.r > 240 && olho.g > 240 && olho.b > 240, `o olho do redemoinho (branco) na ponta: ${JSON.stringify(olho)}`);
  const kur = px(barra(85), 10, 4), forte = px(barra(97), 10, 4);
  assert.ok(kur.r > 200 && kur.g < 110 && kur.b < 110, `vermelha a partir de 80%: ${JSON.stringify(kur)}`);
  assert.ok(forte.r > 200 && forte.g < 110 && forte.b < 110, `vermelha: ${JSON.stringify(forte)}`);
  assert.deepStrictEqual([0, 79, 80, 94, 95, 140].map(p => K.nivelDe({ pct: p })), [0, 0, 1, 1, 2, 2]);
  const tela = new Tela(20, 20), g = tela.getContext('2d');
  K.bolinha(g, { bola: [6, 6, 8, 8], cor: '#22C55E', sit: 'finished' }, 0);
  const miolo = px(tela, 9, 10);
  assert.ok(miolo.g > miolo.r && miolo.g > miolo.b, `a nuvenzinha verde: ${JSON.stringify(miolo)}`);
});

test('épico: a cada 30 bugs derrubados, na próxima parada na reta de cima; cortado volta, quebrado não', () => {
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
  assert.strictEqual(tema.bugsPorEpico, 30);
  try {
    tema.trocarEpico(falso);
    const { m, erros } = montar();
    m.salvo.akaBugs = 27;
    cena(m, 'tronco', 1.0);
    assert.strictEqual(m.salvo.akaBugs, 27, 'cortada antes do golpe: não conta');
    cena(m, 'clones'); cena(m, 'corvos');
    assert.strictEqual(m.salvo.akaBugs, 27, 'só tronco e fogo derrubam');
    cena(m, 'folhas');
    assert.strictEqual(m.salvo.akaBugs, 27, 'no Time 7, o rio de folhas não derruba');
    m.salvo.akaBugs = 24;
    cena(m, 'sapo'); cena(m, 'esfera'); cena(m, 'raio');
    assert.strictEqual(m.salvo.akaBugs, 27, 'sapo, esfera e raio derrubam (a conta é uma só pros dois lados)');
    cena(m, 'tronco'); cena(m, 'fogo');
    assert.strictEqual(m.salvo.akaBugs, 29);
    assert.ok(!m.salvo.akaEpico);
    cena(m, 'fogo');
    assert.strictEqual(m.salvo.akaEpico, true, 'o 30º pede o épico');
    naReta(m, 'lado');
    assert.strictEqual(tema.naParada(m), undefined, 'no lado do cartão: espera chegar na reta de cima');
    naReta(m, 'cima');
    const c = tema.naParada(m);
    assert.ok(c && c.nome === 'epico' && c.epico, 'na reta de cima: o épico, sem o cara-ou-coroa');
    m.comecarCena(c);
    assert.strictEqual(m.salvo.akaEpico, false);
    m.evento('tudo');  // acabou tudo no meio: não corta (o aviso toca por cima)
    assert.strictEqual(m.cena && m.cena.nome, 'epico');
    m.passo(m.T + 0.5);
    m.receber({ modo: 'pulando' });  // pergunta no meio: corta e não gasta a vez
    assert.strictEqual(m.cena, null);
    assert.strictEqual(m.salvo.akaEpico, true, 'cortado: o pedido volta');
    m.receber({ modo: 'andando' });
    naReta(m, 'cima');
    m.comecarCena(tema.naParada(m));
    ateOFim(m);
    assert.strictEqual(m.salvo.akaEpico, false, 'até o fim: gasta');
    assert.strictEqual(m.salvo.akaBugs, 30, 'o épico não mexe na conta');
    // quebrou: não volta, e a parada segue normal
    m.salvo.akaEpico = true;
    naReta(m, 'cima');
    m.comecarCena(tema.naParada(m));
    m.ruins.add('epico'); m.fimCena(true);
    assert.strictEqual(m.salvo.akaEpico, false, 'quebrado: não pede de novo');
    m.salvo.akaEpico = true;
    let d = tema.naParada(m);
    assert.ok(!d || d.nome !== 'epico');
    assert.strictEqual(m.salvo.akaEpico, false);
    // sem o arquivo: idem
    m.ruins.clear();
    tema.trocarEpico(null);
    m.salvo.akaEpico = true;
    d = tema.naParada(m);
    assert.ok(!d || d.nome !== 'epico');
    assert.strictEqual(m.salvo.akaEpico, false);
    assert.strictEqual(tema.cenaPorNome(m, 'epico'), null);
    assert.deepStrictEqual(erros, []);
  } finally { tema.trocarEpico(undefined); }
});

test('os sons do tema existem e são WAV que o motor lê', () => {
  for (const n of ['esperando', 'terminou', 'tudo']) {
    const f = path.join(JANELINHA, 'sons-akatsuki', n + '.wav');
    assert.ok(fs.existsSync(f), `falta ${f}`);
    const w = lerWav(fs.readFileSync(f));
    assert.ok(w && w.amostras && w.amostras.length > 1000, n);
  }
});

// ---------- os dois lados ----------
test('Time 7: toda cena quadro a quadro sem erro, na roupa e nas cores do lado, e diferente da Akatsuki; as outras roupas também', () => {
  try {
    for (const nome of tema.cenas) {
      const { m, erros, tela, quadro } = montar({ escala: 1.25, modo: modoDa(nome), roupa: 't7-laranja' });
      const cena = tema.cenaPorNome(m, nome);
      m.comecarCena(cena);
      for (let f = 0; f <= Math.ceil(durDe(cena) * 30) + 1; f++) {
        m.proxima = Infinity;
        quadro(f / 30);
        if (f % 10 === 0) assert.ok(cheia(tela), `${nome}: quadro ${f} vazio`);
        if (f === 15 && nome !== 'virada') assert.deepStrictEqual([A.COR.roupa, A.COR.lado], ['t7-laranja', 'time7'], nome);
      }
      assert.deepStrictEqual(erros, [], nome);
      assert.strictEqual(m.ruins.size, 0, `${nome}: ${[...m.ruins]}`);
    }
    // as outras 4 roupas (de 1/6 em 1/6 s): nenhuma quebra cena nenhuma
    for (const roupa of ['aka-espiral', 'aka-riscada', 't7-colete', 't7-azul']) {
      for (const nome of tema.cenas) {
        const { m, erros, quadro } = montar({ escala: 1.25, modo: modoDa(nome), roupa });
        const cena = tema.cenaPorNome(m, nome);
        m.comecarCena(cena);
        for (let T = 0; T <= durDe(cena) + 0.2; T += 1 / 6) { m.proxima = Infinity; quadro(T); }
        assert.deepStrictEqual([erros, [...m.ruins]], [[], []], `${roupa}, ${nome}`);
      }
    }
    // o mesmo instante nos dois lados: outro desenho (cartão e Clawd)
    const um = roupa => { const { quadro } = montar({ escala: 1.25, roupa }); return Buffer.from(quadro(1.0).bgra()); };
    assert.ok(!um('t7-laranja').equals(um('akatsuki')));
    assert.ok(!um('t7-laranja').equals(um('t7-azul')), 'cada roupa é um desenho');
  } finally { A.vestir('akatsuki'); }
});

test('os inimigos (dono, 14/10): o bug e mais 3 de cada lado, sorteados pela semente; toda cena com cada um, sem erro, e cada um aparece', () => {
  assert.deepStrictEqual(INI.LADOS, { akatsuki: ['bug', 'anbu', 'folha', 'kakashi'], time7: ['bug', 'zetsu', 'renegado', 'marionete'] });
  // o desenho: todas as linhas da mesma largura, e toda letra tem cor (as pernas também)
  for (const [nome, I] of Object.entries(INI.TIPOS)) {
    for (const passo of ['p', 'q']) {
      const linhas = I.linhas.concat(passo === 'p' ? ['...onnnnno...', '...onnonno...', '...oddoddo...'] : ['...onnnnno...', '..onno.onno..', '.oddo...oddo.']);
      for (const l of linhas) {
        assert.strictEqual(l.length, 13, `${nome}: largura`);
        for (const c of l) assert.ok(c === '.' || I.cores[c], `${nome}: a letra ${c} sem cor`);
      }
    }
  }
  // o sorteio: repetível, e os 4 de cada lado aparecem (cada um em ~1/4 das sementes)
  for (const [lado, lista] of Object.entries(INI.LADOS)) {
    const conta = {};
    for (let s = 0; s < 800; s++) {
      const I = INI.sortear(s, lado);
      assert.strictEqual(INI.sortear(s, lado), I, 'repetível');
      conta[I.nome] = (conta[I.nome] || 0) + 1;
    }
    for (const nome of lista) assert.ok(conta[nome] > 120, `${lado}: ${nome} saiu ${conta[nome] || 0} de 800`);
    assert.deepStrictEqual(Object.keys(conta).sort(), [...lista].sort());
  }
  // as cenas com inimigo, com cada um: quadro a quadro sem erro, e o quadro com ele chegando muda
  const CENAS = { tronco: 'akatsuki', fogo: 'akatsuki', sapo: 'time7', esfera: 'time7', raio: 'time7' };
  for (const [nome, lado] of Object.entries(CENAS)) {
    const vistos = new Set();
    for (const quem of INI.LADOS[lado]) {
      let semente = 0;
      while (INI.sortear(semente, lado).nome !== quem) semente++;
      const { m, erros, tela, quadro } = montar({ roupa: lado === 'time7' ? 't7-laranja' : 'akatsuki' });
      const sorteio = m.sorteio;
      m.sorteio = () => (semente + 0.5) / 4294967296;
      const cena = tema.cenaPorNome(m, nome);
      m.sorteio = sorteio;
      m.comecarCena(cena);
      for (let f = 0; f <= Math.ceil(cena.dur * 30) + 1; f++) {
        m.proxima = Infinity;
        quadro(f / 30);
        if (f === 27) vistos.add(Buffer.from(tela.pixels.buffer).toString('base64'));
      }
      assert.deepStrictEqual(erros, [], `${nome} com ${quem}`);
      assert.strictEqual(m.ruins.size, 0, `${nome} com ${quem}: ${[...m.ruins]}`);
    }
    assert.strictEqual(vistos.size, 4, `${nome}: os 4 inimigos aparecem diferentes`);
  }
});

test('a cada 50 voltas andadas troca de lado, pela virada na parada seguinte; cada volta pra um lado veste a próxima roupa dele', () => {
  try {
    assert.strictEqual(tema.voltasPorLado, 50);
    assert.deepStrictEqual(A.ROUPAS.LADOS, { akatsuki: ['akatsuki', 'aka-espiral', 'aka-riscada'], time7: ['t7-laranja', 't7-colete', 't7-azul'] });
    const { m, erros } = montar();
    const ate = (m2, t) => { for (let T = m2.T + 1 / 30; m2.cena && T - m2.cena.t0 < t; T += 1 / 30) { m2.proxima = Infinity; m2.passo(T); } };
    assert.strictEqual(m.salvo.akaRoupa, 'akatsuki', 'começa na Akatsuki, de chapéu de palha');
    for (let i = 0; i < 49; i++) tema.aoDarVolta(m);
    let c = tema.naParada(m);
    assert.ok(!c || c.nome !== 'virada', '49 voltas: ainda não');
    tema.aoDarVolta(m);
    assert.strictEqual(m.salvo.akaVoltas, 50);
    c = tema.naParada(m);
    assert.ok(c && c.nome === 'virada' && c.de === 'akatsuki' && c.para === 't7-laranja', 'a 50ª: a virada, sem o cara-ou-coroa');
    // cortada antes do puf: não troca, e a próxima parada tenta de novo
    m.comecarCena(c);
    ate(m, 1.0);
    assert.strictEqual(tema.ladoDe(m), 'akatsuki', 'antes do puf, o lado velho');
    m.receber({ modo: 'pulando' });
    assert.strictEqual(m.cena, null);
    assert.strictEqual(m.salvo.akaRoupa, 'akatsuki');
    m.receber({ modo: 'andando' });
    c = tema.naParada(m);
    assert.ok(c && c.nome === 'virada', 'tenta de novo');
    // do puf em diante já é o lado novo; cortada depois dele, vale
    m.comecarCena(c);
    ate(m, 1.8);
    assert.deepStrictEqual([tema.ladoDe(m), tema.roupaDe(m)], ['time7', 't7-laranja'], 'do puf em diante, o lado novo');
    m.receber({ modo: 'pulando' });
    assert.strictEqual(m.salvo.akaRoupa, 't7-laranja');
    m.receber({ modo: 'andando' });
    c = tema.naParada(m);
    assert.ok(!c || c.nome !== 'virada', 'já trocou');
    // as próximas: a cada volta pra um lado, a próxima roupa dele; depois da 3ª, recomeça
    let antes = 't7-laranja';
    ['aka-espiral', 't7-colete', 'aka-riscada', 't7-azul', 'akatsuki', 't7-laranja'].forEach((roupa, i) => {
      for (let v = 0; v < 50; v++) tema.aoDarVolta(m);
      assert.strictEqual(tema.roupaAlvo(m), roupa);
      if (i === 2) {  // quebrada: troca sem cena
        m.ruins.add('virada');
        c = tema.naParada(m);
        assert.ok(!c || c.nome !== 'virada');
        assert.strictEqual(m.salvo.akaRoupa, roupa, 'quebrada: troca direto');
        m.ruins.delete('virada');
      } else {
        c = tema.naParada(m);
        assert.ok(c && c.nome === 'virada' && c.de === antes && c.para === roupa, `${antes} -> ${roupa}`);
        m.comecarCena(c);
        ate(m, 99);
        assert.strictEqual(m.cena, null);
        assert.strictEqual(m.salvo.akaRoupa, roupa);
      }
      antes = roupa;
    });
    // a virada pedida pelo nome (a prévia do dono): vai pro outro lado, sem mexer na conta
    const p = tema.cenaPorNome(m, 'virada');
    assert.deepStrictEqual([p.de, p.para], ['t7-laranja', 'akatsuki']);
    assert.deepStrictEqual(erros, []);
  } finally { A.vestir('akatsuki'); }
});

test('as voltas contam andando de verdade, ficam no motor-estado.json, e quem reabre já começa na roupa da conta', () => {
  const pasta = fs.mkdtempSync(path.join(os.tmpdir(), 'aka-lado-'));
  const arq = path.join(pasta, 'motor-estado.json');
  try {
    const { m } = montar({ pasta });
    for (let T = 0; T < 120; T += 1 / 30) { m.proxima = Infinity; m.passo(T); }  // 2 min andando, sem parar
    assert.ok(m.salvo.akaVoltas >= 2, `voltas: ${m.salvo.akaVoltas}`);
    const salvo = JSON.parse(fs.readFileSync(arq, 'utf8'));
    assert.deepStrictEqual([salvo.akaVoltas, salvo.akaRoupa], [m.salvo.akaVoltas, 'akatsuki']);
    // reabriu com 173 voltas e sem roupa salva: já começa de colete, sem virada
    fs.writeFileSync(arq, JSON.stringify({ akaVoltas: 173, akaBugs: 4 }));
    const b = montar({ pasta }).m;
    assert.strictEqual(b.salvo.akaRoupa, 't7-colete');
    const c = tema.naParada(b);
    assert.ok(!c || c.nome !== 'virada');
    assert.strictEqual(b.salvo.akaBugs, 4);
    // uma roupa que não existe (arquivo de outra versão): a da conta
    fs.writeFileSync(arq, JSON.stringify({ akaVoltas: 10, akaRoupa: 'nao-existe' }));
    assert.strictEqual(montar({ pasta }).m.salvo.akaRoupa, 'akatsuki');
  } finally { fs.rmSync(pasta, { recursive: true, force: true }); A.vestir('akatsuki'); }
});

test('o cartão no Time 7: a barra laranja (sem o branco da Akatsuki), o % nas cores do lado e a folhinha da situação', () => {
  const px = (tela, x, y) => { const p = tela.pixels[y * tela.width + x]; return { r: (p >>> 16) & 255, g: (p >>> 8) & 255, b: p & 255 }; };
  const barra = pct => { const tela = new Tela(130, 8), g = tela.getContext('2d'); K.barra(g, [0, 1, 118, 5], pct, pct >= 80 ? 1 : 0, 0); return tela; };
  try {
    assert.deepStrictEqual(Object.keys(K.PAL), ['akatsuki', 'time7']);
    A.vestir('t7-colete');
    const lar = px(barra(50), 10, 4);
    assert.ok(lar.r > 200 && lar.g > 90 && lar.g < 150 && lar.b < 60, `laranja: ${JSON.stringify(lar)}`);
    assert.deepStrictEqual([0, 1, 2].map(K.corDoPct), K.PAL.time7.pct);
    const tela = new Tela(20, 20), g = tela.getContext('2d');
    K.bolinha(g, { bola: [6, 6, 8, 8], cor: '#22C55E', sit: 'finished' }, 0);
    const miolo = px(tela, 9, 10);
    assert.ok(miolo.g > miolo.r && miolo.g > miolo.b, `a folhinha verde: ${JSON.stringify(miolo)}`);
    A.vestir('aka-riscada');
    assert.deepStrictEqual([0, 1, 2].map(K.corDoPct), K.CORES_PCT, 'de volta na Akatsuki');
    const branco = px(barra(50), 10, 4);
    assert.ok(branco.r > 230 && branco.g > 230 && branco.b > 230, `branco: ${JSON.stringify(branco)}`);
  } finally { A.vestir('akatsuki'); }
});

test('o épico é o do lado da tela (a fera na Akatsuki, o trio no Time 7), e a conta dos bugs é uma só', () => {
  const falso = quem => ({ cena: () => ({ nome: 'x', quem, dur: 2, espaco: { frente: 0, tras: 0 }, modos: ['andando'], quadro() {} }) });
  const naReta = m => { const g = m.geometria(); m.dist = (g.w - 2 * g.r) / 2; };
  try {
    tema.trocarEpico(falso('aka'), 'akatsuki');
    tema.trocarEpico(falso('t7'), 'time7');
    const { m, erros } = montar({ roupa: 't7-azul' });
    m.salvo.akaEpico = true;
    naReta(m);
    const c = tema.naParada(m);
    assert.ok(c && c.nome === 'epico' && c.epico && c.quem === 't7', 'no Time 7, o do Time 7');
    m.comecarCena(c);
    m.receber({ modo: 'pulando' });
    assert.strictEqual(m.salvo.akaEpico, true, 'cortado: o pedido volta');
    m.receber({ modo: 'andando' });
    Object.assign(m.salvo, { akaRoupa: 'aka-riscada', akaVoltas: 200 });
    naReta(m);
    const d = tema.naParada(m);
    assert.ok(d && d.epico && d.quem === 'aka', 'na Akatsuki, o da Akatsuki');
    assert.strictEqual(tema.cenaPorNome(m, 'epico').quem, 'aka');
    // o Time 7 sem o arquivo: o pedido se gasta (como na Akatsuki)
    tema.trocarEpico(null, 'time7');
    Object.assign(m.salvo, { akaRoupa: 't7-azul', akaVoltas: 250, akaEpico: true });
    const e = tema.naParada(m);
    assert.ok(!e || !e.epico);
    assert.strictEqual(m.salvo.akaEpico, false);
    assert.deepStrictEqual(erros, []);
    // os de verdade: cada lado o seu, e o trio sabe quem ele é
    tema.trocarEpico(undefined);
    const fera = tema.cenaPorNome(montar().m, 'epico'), trio = tema.cenaPorNome(montar({ roupa: 't7-azul' }).m, 'epico');
    assert.ok(fera && fera.plano.feraX > 0 && fera.dur < trio.dur);
    assert.strictEqual(trio.plano.eu, 't7-azul');
  } finally { tema.trocarEpico(undefined); A.vestir('akatsuki'); }
});
