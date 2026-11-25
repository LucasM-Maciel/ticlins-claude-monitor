'use strict';
// motor/minecraft-nether.js (o portal do Nether, épico do tema Minecraft) e o modo compacto do
// tema (a bússola no lugar da barra de XP, minecraft-enfeites.js):
// - o portal fica fora do sorteio comum, arma a cada 12 eventos e só começa no começo da borda de
//   cima; cortado antes do Nether não gasta a vez; o do menu (evento 'portal') não gasta nunca;
// - pelo menu, parado ou andando, ele vai pro começo da borda de cima e fica lá até o fim, mesmo
//   que comece a andar no meio; no fim a trilha avança o tanto que ele andou (sem pulo);
// - a cena inteira nos 3 biomas, quadro a quadro, sem erro; a borda vira Nether e volta;
// - a bússola: o quadro marca o tempo da janela de uso e gira com sessão trabalhando.
// Texturas de mentira (o CI não tem as da Mojang), como em tema-minecraft.test.js.
// Ver a olho: node testes/motor-foto.js --tema minecraft --pasta <texturas> --cena portal:almas --tira 2,8,12.7,16 --zoom 3 --saida f.png
const { test } = require('node:test');
const assert = require('node:assert');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const { Tela } = require(path.join(MOTOR, 'raster'));
const { IMG } = require(path.join(MOTOR, 'comum'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const tema = require(path.join(MOTOR, 'tema-minecraft'));
const enfeites = require(path.join(MOTOR, 'minecraft-enfeites'));
const { T: TN } = require(path.join(MOTOR, 'minecraft-nether'));
const { estadoDeMentira } = require('../motor-foto');

// textura de mentira: uma cor por textura (as das mobs em 64x64), e a bússola com uma cor por quadro
function deMentira(nome, w = 16, h = 16, cor = null) {
  const t = new Tela(w, h), c = cor != null ? cor : (nome.length * 2654435761 + nome.charCodeAt(0) * 40503) & 0xFFFFFF;
  t.pixels.fill((0xFF000000 | c) >>> 0);
  return t;
}
const corDaBussola = q => 0x100000 + q * 0x0101;  // quadro q -> cor única
for (const n of tema.texturas) {
  if (IMG[n]) continue;
  const q = /^bussola(\d\d)$/.exec(n);
  IMG[n] = q ? deMentira(n, 16, 16, corDaBussola(Number(q[1])))
    : /^(zumbi|creeper|esqueleto|aranha|slime|silverfish|enderman|lobo|galinha|orbe|escudo|piglin_zumbi)/.test(n) ? deMentira(n, 64, 64)
      : /^xp_/.test(n) ? deMentira(n, 182, 5) : n === 'fonte' ? deMentira(n, 128, 128) : deMentira(n);
}

function novoMundo(modo = 'andando', semente = 7) {
  const m = new Mundo({ tema, semente, relogio: () => new Date(2026, 9, 5, 12, 0, 0) });
  m.erros = [];
  m.aoErro = e => m.erros.push(e);
  m.sons = [];
  m.aoSom = c => m.sons.push(c && c.nome);
  m.receber(estadoDeMentira('minecraft', modo));
  m.dist = 70;
  return m;
}
const emCima = m => Math.cos(m.pose().a) > 0.99;
const comum = { nome: 'zumbi', evento: { danos: [], mortes: [] } };

test('portal: fora do sorteio comum, arma a cada 12 eventos e só começa na borda de cima', () => {
  const m = novoMundo();
  assert.ok(!('portal' in tema.pesosDosEventos(m)), 'o portal não entra no sorteio comum');
  for (let i = 1; i <= 11; i++) tema.aoComecarCena(m, { ...comum });
  assert.ok(!m.salvo.portal, 'armou antes do 12º');
  tema.aoComecarCena(m, { ...comum });
  assert.strictEqual(m.salvo.portal, true, 'o 12º evento arma o portal');
  // no lado direito: espera (undefined); em cima: a cena do portal
  const [, , w] = m.host.cartao;
  m.dist = w + 20;
  assert.strictEqual(tema.naParada(m), undefined);
  m.dist = 2;
  const c = tema.naParada(m);
  assert.ok(c && c.nome === 'portal' && emCima(m), 'o portal em cima');
  assert.ok(Array.isArray(c.sons) && c.sons.length > 20, 'com a trilha');
  assert.strictEqual(tema.naParada(m), c, 'sem espaço: devolve o mesmo, sem sortear de novo');
  tema.aoComecarCena(m, c);
  assert.ok(!m.salvo.portal, 'começou: gastou a vez');
  // 12 eventos depois, arma de novo
  for (let i = 0; i < 12; i++) tema.aoComecarCena(m, { ...comum });
  assert.strictEqual(m.salvo.portal, true);
});

test('portal cortado antes de chegar no Nether não gasta a vez; depois dele, gasta', () => {
  const m = novoMundo();
  const c = tema.cenaPorNome(m, 'portal');
  tema.aoComecarCena(m, c);
  tema.aoFimCena(m, { ...c, t0: m.T - (TN.vira0 - 1) }, true);
  assert.strictEqual(m.salvo.portal, true, 'cortado antes do Nether: volta na próxima');
  const d = novoMundo();
  const c2 = tema.cenaPorNome(d, 'portal');
  tema.aoComecarCena(d, c2);
  tema.aoFimCena(d, { ...c2, t0: d.T - (TN.vira0 + 1) }, true);
  assert.ok(!d.salvo.portal, 'já tinha ido pro Nether: gastou');
});

test('menu (evento portal): parado ou andando, no começo da borda de cima até o fim, sem gastar a vez; a trilha avança sem pulo', () => {
  for (const [modo, muda] of [['parado', null], ['andando', null], ['parado', 'andando']]) {
    const m = novoMundo(modo);
    m.salvo.portal = true;  // o portal ganho
    for (let T = 0; T < 1; T += 0.05) m.passo(T);
    m.evento('portal');
    assert.ok(m.cena && m.cena.nome === 'portal', `${modo}: não começou`);
    const [cx] = m.host.cartao;
    assert.ok(emCima(m) && m.pose().x < cx + 3, `${modo}: começou fora do começo da borda de cima (x=${m.pose().x}, cartão em ${cx})`);
    assert.deepStrictEqual(m.sons, ['portal'], `${modo}: a trilha`);
    const tela = new Tela(380, 440), g = tela.getContext('2d');
    let distFim = null;
    for (let T = 1; T < 1 + TN.fim + 0.5; T += 1 / 30) {
      if (muda && Math.abs(T - 9) < 1 / 60) { m.receber({ modo: muda }); assert.ok(m.pose().x < cx + 3, 'voltou pro meio ao começar a andar'); }
      const antes = m.dist;
      m.passo(T);
      tela.limpar(); g.setTransform(1, 0, 0, 1, 0, 0);
      m.desenhar(g);
      if (!m.cena && distFim === null) distFim = m.dist - antes;
    }
    assert.deepStrictEqual(m.erros, [], `${modo}: erros`);
    assert.strictEqual(m.salvo.portal, true, `${modo}: o do menu gastou o portal ganho`);
    if (m.andando) assert.ok(Math.abs(distFim - 66) < 3, `${modo}: a trilha avançou ${distFim} no fim (esperado ~66)`);
  }
});

test('a cena nos 3 biomas, quadro a quadro, sem erro; a borda vira Nether e volta a ser terra', () => {
  for (const bioma of ['netherrack', 'almas', 'basalto']) {
    const m = novoMundo();
    m.dist = 2;
    const tela = new Tela(380, 440), g = tela.getContext('2d');
    const [cx, cy, cw] = m.host.cartao;
    // um pixel da borda de cima, longe do portal e do Clawd
    const px = Math.round(cx + cw - 12), py = Math.round(cy + 4), pixel = () => tela.pixels[py * tela.width + px];
    const quadro = T => { m.passo(T); tela.limpar(); g.setTransform(1, 0, 0, 1, 0, 0); m.desenhar(g); return pixel(); };
    const antes = quadro(0);
    m.comecarCena(tema.cenaPorNome(m, 'portal:' + bioma));
    const t0 = m.T, vistos = {};
    for (let t = 0; t < TN.fim; t += 1 / 20) vistos[t.toFixed(2)] = quadro(t0 + t);
    assert.deepStrictEqual(m.erros, [], `${bioma}: erros`);
    assert.notStrictEqual(vistos[(TN.vira1 + 1).toFixed(2)], antes, `${bioma}: a borda não virou Nether`);
    assert.strictEqual(vistos[(TN.desvira1 + 0.5).toFixed(2)], antes, `${bioma}: a borda não voltou a ser terra`);
  }
});

test('compacto: a bússola no lugar da barra; o quadro marca o tempo da janela e gira com sessão trabalhando', () => {
  const host = estadoDeMentira('minecraft', 'andando', { usos: 1 });
  const u = host.uso[0];
  u.barra = [u.barra[0], u.barra[1] - 8, 20, 20];
  const meio = [Math.round(u.barra[0] + 10), Math.round(u.barra[1] + 10)];
  const quadroVisto = (janela, trabalhando, T) => {
    const h = { ...host, compacto: true, uso: [{ ...u, janela }], linhas: host.linhas.map(l => ({ ...l, sit: trabalhando ? 'working' : 'finished' })) };
    const tela = new Tela(380, 440), g = tela.getContext('2d');
    enfeites.desenharEnfeites(g, h, T);
    const p = tela.pixels[meio[1] * tela.width + meio[0]] & 0xFFFFFF;
    for (let q = 0; q < 32; q++) if (p === corDaBussola(q)) return q;
    return null;
  };
  // parado: 0% = agulha pra cima (quadro 16), metade = pra baixo (0), sem tempo = pra cima
  assert.strictEqual(quadroVisto(0, false, 0), 16);
  assert.strictEqual(quadroVisto(50, false, 0), 0);
  assert.strictEqual(quadroVisto(75, false, 0), 8);
  assert.strictEqual(quadroVisto(undefined, false, 0), 16);
  // o tempo não mexe parado; trabalhando, gira (20 quadros por s)
  assert.strictEqual(quadroVisto(50, false, 3.3), 0);
  const giro = [0, 0.1, 0.2, 0.3].map(T => quadroVisto(50, true, T));
  assert.deepStrictEqual(giro, [0, 2, 4, 6]);
  // sem compacto: a barra de XP de sempre (nenhum quadro da bússola ali)
  const tela = new Tela(380, 440), g = tela.getContext('2d');
  enfeites.desenharEnfeites(g, { ...host, compacto: false, uso: [{ ...u, barra: host.uso[0].barra, janela: 50 }] }, 0);
  const p = tela.pixels[meio[1] * tela.width + meio[0]] & 0xFFFFFF;
  assert.ok(![...Array(32).keys()].some(q => p === corDaBussola(q)), 'desenhou bússola sem o compacto');
});
