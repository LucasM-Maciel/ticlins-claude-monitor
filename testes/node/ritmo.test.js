'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { ritmoDe, desenharRitmo } = require('../../extensao/janelinha/motor/comum');

test('ritmo: a cor usa a diferença real, antes do arredondamento', () => {
  for (const [d, txt, cor] of [
    [-30, '-30', '#22C55E'], [-10, '-10', '#22C55E'],
    [-9.9, '-10', '#9CA3AF'], [-5.1, '-5', '#9CA3AF'],
    [-5, '-5', '#9CA3AF'], [-0.5, '-1', '#9CA3AF'],
    [0, '0', '#9CA3AF'], [0.5, '+1', '#9CA3AF'],
    [5, '+5', '#9CA3AF'], [5.9, '+6', '#9CA3AF'],
    [6, '+6', '#F59E0B'], [19, '+19', '#F59E0B'],
    [19.9, '+20', '#F59E0B'], [20, '+20', '#EF4444'], [50, '+50', '#EF4444'],
  ]) {
    for (const rotulo of ['5h', '7d']) {
      assert.deepEqual(ritmoDe(50 + d, 50, rotulo), { txt, cor }, `${rotulo}: d=${d}`);
    }
  }
});

test('ritmo: só a janela de 5h esconde o número nas pontas', () => {
  for (const decorrido of [0, 3.32, 96.68, 100]) {
    assert.deepEqual(ritmoDe(decorrido, decorrido, '5h'), { txt: '', cor: '#9CA3AF' });
    assert.deepEqual(ritmoDe(decorrido, decorrido, '7d'), { txt: '0', cor: '#9CA3AF' });
  }
  for (const decorrido of [3.33, 96.67]) {
    assert.deepEqual(ritmoDe(decorrido, decorrido, '5h'), { txt: '0', cor: '#9CA3AF' });
  }
});

test('ritmo: sem janela conhecida ou decorrido, não há número', () => {
  for (const rotulo of ['30d', '120min']) {
    assert.deepEqual(ritmoDe(50, 25, rotulo), { txt: '', cor: '#6B7280' });
  }
  assert.deepEqual(ritmoDe(50, null, '5h'), { txt: '', cor: '#6B7280' });
});

test('desenharRitmo: preserva as quatro cores recebidas e o tracinho sem número', () => {
  const retangulos = [], textos = [];
  const g = { fillRect(...caixa) { retangulos.push([this.fillStyle, caixa]); } };
  for (const cor of ['#9CA3AF', '#F59E0B', '#EF4444', '#22C55E']) {
    const ritmo = { txt: '+20', cor, caixa: [130, 0, 34, 16] };
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
