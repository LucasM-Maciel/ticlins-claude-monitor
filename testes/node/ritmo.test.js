'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ritmoDe, desenharRitmo } = require('../../extensao/janelinha/motor/comum');

test('ritmo: a cor usa a diferença real, antes do arredondamento', () => {
  for (const [d, txt, cor] of [
    [-30, 'folga', '#22C55E'], [-10, 'folga', '#22C55E'],
    [-9, 'no ritmo', '#9CA3AF'], [-9.9, 'no ritmo', '#9CA3AF'], [-5.1, 'no ritmo', '#9CA3AF'],
    [-5, 'no ritmo', '#9CA3AF'], [-0.5, 'no ritmo', '#9CA3AF'],
    [0, 'no ritmo', '#9CA3AF'], [0.5, 'no ritmo', '#9CA3AF'],
    [5, 'no ritmo', '#9CA3AF'], [5.9, 'no ritmo', '#9CA3AF'],
    [6, 'acima', '#F59E0B'], [19, 'acima', '#F59E0B'],
    [19.9, 'acima', '#F59E0B'], [20, 'estourando', '#EF4444'], [50, 'estourando', '#EF4444'],
  ]) {
    for (const rotulo of ['5h', '7d']) {
      assert.deepEqual(ritmoDe(50 + d, 50, rotulo), { txt, cor }, `${rotulo}: d=${d}`);
    }
  }
});

test('ritmo em inglês (Idioma = English no menu): mesmas faixas e cores, palavra traduzida', () => {
  for (const [d, txt, cor] of [[-10, 'slow', '#22C55E'], [0, 'on pace', '#9CA3AF'], [6, 'fast', '#F59E0B'], [20, 'too fast', '#EF4444']]) {
    assert.deepEqual(ritmoDe(50 + d, 50, '7d', 'en'), { txt, cor }, `d=${d}`);
  }
  assert.equal(ritmoDe(50, 50, '7d', 'klingon').txt, 'no ritmo', 'idioma desconhecido: português');
});

test('ritmo: só a janela de 5h esconde a palavra nas pontas', () => {
  for (const decorrido of [0, 3.32, 96.68, 100]) {
    assert.deepEqual(ritmoDe(decorrido, decorrido, '5h'), { txt: '', cor: '#9CA3AF' });
    assert.deepEqual(ritmoDe(decorrido, decorrido, '7d'), { txt: 'no ritmo', cor: '#9CA3AF' });
  }
  for (const decorrido of [3.33, 96.67]) {
    assert.deepEqual(ritmoDe(decorrido, decorrido, '5h'), { txt: 'no ritmo', cor: '#9CA3AF' });
  }
});

test('ritmo: sem janela conhecida ou decorrido, não há palavra', () => {
  for (const rotulo of ['30d', '120min']) {
    assert.deepEqual(ritmoDe(50, 25, rotulo), { txt: '', cor: '#6B7280' });
  }
  assert.deepEqual(ritmoDe(50, null, '5h'), { txt: '', cor: '#6B7280' });
});

test('ritmo desligado: sem palavra, tracinho ou coluna em todos os temas', () => {
  const { estadoDeMentira } = require('../motor-foto');
  for (const tema of ['padrao', 'minecraft', 'dragonball', 'sith', 'akatsuki', 'elden']) {
    const ligado = estadoDeMentira(tema);
    const desligado = estadoDeMentira(tema, 'andando', { ritmo: false });
    assert.ok(desligado.cartao[2] < ligado.cartao[2], tema);
    for (const u of desligado.uso) {
      assert.equal(u.ritmo.txt, '');
      assert.equal(u.ritmo.caixa[2], 0);
      assert.equal(u.decorrido, null);
      desenharRitmo({ fillRect() { assert.fail('tracinho desligado'); } }, u, '#E5E7EB', () => assert.fail('palavra desligada'));
    }
  }
});

test('desenharRitmo: preserva as quatro cores recebidas e o tracinho sem palavra', () => {
  const retangulos = [], textos = [];
  const g = { fillRect(...caixa) { retangulos.push([this.fillStyle, caixa]); } };
  for (const cor of ['#9CA3AF', '#F59E0B', '#EF4444', '#22C55E']) {
    const ritmo = { txt: 'estourando', cor, caixa: [130, 0, 72, 16] };
    desenharRitmo(g, { barra: [10, 10, 100, 4], decorrido: 50, ritmo }, '#E5E7EB',
      (...args) => textos.push(args));
    assert.deepEqual(textos.at(-1), [ritmo.txt, cor, ritmo.caixa]);
  }
  desenharRitmo(g, { barra: [10, 10, 100, 4], decorrido: 1, ritmo: { txt: '', cor: '#9CA3AF' } },
    '#E5E7EB', (...args) => textos.push(args));
  assert.equal(textos.length, 4);
  assert.equal(retangulos.length, 5);
  assert.deepEqual(retangulos.at(-1), ['#E5E7EB', [10, 8, 2, 8]]);
});
