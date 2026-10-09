'use strict';
// Tema Sith: o que enfeita o cartão. Moldura = painel imperial (fio vermelho aceso com cantoneiras
// de metal), bolinha = cristal kyber com o brilho da cor da situação, barra do usage = sabre que
// acende até o quanto foi gasto e muda de cor com ele, pelas cores do lado sombrio (violeta, roxo,
// magenta, carmim; vermelho a partir de 80%, quando a lâmina fica instável; a partir de 95%
// crepita), números = a fonte de visor do tema Dragon Ball. Coordenadas: as da janela, em DIPs.
const { lim, arte, rgba, mistura, rng } = require('./comum');
const { escrever } = require('./dragonball-cartao');
const { SITH } = require('./sith-arte');

const corHex = (c, reserva) => (/^#[0-9a-f]{6}$/i.test(c) ? c : reserva);
const pulso = t => 0.65 + 0.35 * Math.cos(2 * Math.PI * t / 1.6);  // o do "trabalhando" da janelinha
const nivelDe = u => (u.nivel != null ? lim(u.nivel | 0, 0, 2) : u.pct >= 95 ? 2 : u.pct >= 80 ? 1 : 0);
const CORES_PCT = ['#FCA5A5', '#F59E0B', '#EF4444'];  // o % do usage: normal, >= 80%, >= 95%
// a cor da lâmina pelo %: entre duas paradas, a mistura das duas
const CORES_LAMINA = [[0, '#5B21B6'], [30, '#9333EA'], [50, '#C026D3'], [65, '#BE123C'], [80, SITH.verm]];
function corDaLamina(pct) {
  const p = lim(Number(pct) || 0, 0, 100);
  for (let i = 1; i < CORES_LAMINA.length; i++) {
    const [p0, c0] = CORES_LAMINA[i - 1], [p1, c1] = CORES_LAMINA[i];
    if (p <= p1) return mistura(c0, c1, (p - p0) / (p1 - p0));
  }
  return SITH.verm;
}
// o número do %: abaixo de 80, um tom claro da lâmina; daí pra cima, o âmbar e o vermelho de todo tema
const corDoPct = (pct, nivel) => (nivel ? CORES_PCT[nivel] : mistura(corDaLamina(pct), '#FFFFFF', 0.5));

// ---------- moldura: fio vermelho aceso em volta e cantoneiras de metal ----------
function moldura(g, [x, y, w, h], t) {
  const brilho = 0.75 + 0.25 * Math.sin(t * 1.3);
  g.save(); g.globalCompositeOperation = 'lighter';
  g.fillStyle = rgba(SITH.verm, 0.18 * brilho);
  g.fillRect(x - 1, y - 1, w + 2, 3); g.fillRect(x - 1, y + h - 2, w + 2, 3);
  g.fillRect(x - 1, y + 2, 3, h - 4); g.fillRect(x + w - 2, y + 2, 3, h - 4);
  g.restore();
  g.fillStyle = rgba('#B91C1C', 0.95);
  g.fillRect(x + 1, y + 1, w - 2, 1); g.fillRect(x + 1, y + h - 2, w - 2, 1);
  g.fillRect(x + 1, y + 2, 1, h - 4); g.fillRect(x + w - 2, y + 2, 1, h - 4);
  // cantoneiras: um L de metal em cada canto, com um rebite
  const L = 9;
  for (const [cx, cy, sx, sy] of [[x, y, 1, 1], [x + w, y, -1, 1], [x, y + h, 1, -1], [x + w, y + h, -1, -1]]) {
    g.fillStyle = '#4B5563';
    g.fillRect(sx > 0 ? cx : cx - L, sy > 0 ? cy : cy - 3, L, 3);
    g.fillRect(sx > 0 ? cx : cx - 3, sy > 0 ? cy : cy - L, 3, L);
    g.fillStyle = '#9CA3AF';
    g.fillRect(sx > 0 ? cx : cx - L, sy > 0 ? cy : cy - 1, L, 1);
    g.fillStyle = '#D1D5DB'; g.fillRect(sx > 0 ? cx + 1 : cx - 2, sy > 0 ? cy + 1 : cy - 2, 1, 1);
  }
}

// ---------- bolinha: cristal kyber (7x9) com brilho da cor da situação ----------
const KYBER = ['...w...', '..wcc..', '.wccco.', '.ccooo.', 'wccood.', '.coood.', '.cood..', '..od...', '...d...'];
function kyber(g, linha, t) {
  const [x, y, w, h] = linha.bola, cor = corHex(linha.cor, '#9CA3AF');
  const cx = x + w / 2, cy = y + h / 2;
  const a = linha.sit === 'working' ? pulso(t) : 1;
  g.save(); g.globalAlpha *= a; g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(cx, cy, 1, cx, cy, 8);
  gr.addColorStop(0, rgba(cor, 0.75)); gr.addColorStop(1, rgba(cor, 0));
  g.fillStyle = gr; g.fillRect(cx - 8, cy - 8, 16, 16);
  g.restore();
  g.drawImage(arte(KYBER, { w: mistura(cor, '#FFFFFF', 0.75), c: mistura(cor, '#FFFFFF', 0.3), o: cor, d: mistura(cor, '#000000', 0.45) }),
    Math.round(cx - 3.5), Math.round(cy - 4.5));
}

// ---------- barra: o sabre do usage ----------
// cabo de 12 px na esquerda da caixa; a lâmina vai até pct% do resto. Trilho escuro por baixo.
function barra(g, [x, y, w, h], pct, nivel, t) {
  const cy = y + h / 2, cabo = 12, x0 = x + cabo, livre = w - cabo, cheio = livre * lim(pct, 0, 100) / 100;
  const cor = corDaLamina(pct);
  g.fillStyle = '#1F2128'; g.fillRect(x0, cy - 1, livre, 2);
  // cabo: preto com anéis de metal e um botão da cor da lâmina
  g.fillStyle = '#111827'; g.fillRect(x, cy - 2, cabo, 4);
  g.fillStyle = SITH.prata; g.fillRect(x, cy - 2, 2, 4); g.fillRect(x + cabo - 2, cy - 2.5, 2, 5); g.fillRect(x + 5, cy - 2, 1, 4);
  g.fillStyle = cor; g.fillRect(x + 7, cy - 2.5, 2, 1);
  if (cheio < 0.5) return;
  const treme = nivel >= 1 ? 0.15 * Math.sin(t * 37) + 0.1 * Math.sin(t * 83) : 0.05 * Math.sin(t * 9);
  g.save(); g.globalCompositeOperation = 'lighter';
  g.fillStyle = rgba(cor, 0.25 + treme * 0.5); g.fillRect(x0, cy - 3, cheio + 1.5, 6);
  g.fillStyle = rgba(cor, 0.45 + treme * 0.5); g.fillRect(x0, cy - 2, cheio + 0.5, 4);
  g.restore();
  g.fillStyle = cor; g.fillRect(x0, cy - 1.5, cheio, 3);
  g.fillStyle = mistura(cor, '#FFFFFF', 0.85); g.fillRect(x0, cy - 0.5, Math.max(0, cheio - 1), 1);
  if (nivel >= 1) {  // instável: a lâmina solta faíscas pelos lados (mais no limite)
    const r = rng(Math.floor(t * 18) * 104729 + Math.round(x));
    const n = nivel >= 2 ? 5 : 2;
    for (let i = 0; i < n; i++) {
      const px = x0 + cheio * r(), lado = r() < 0.5 ? -1 : 1;
      g.fillStyle = r() < 0.5 ? '#FECACA' : '#F97316';
      g.fillRect(Math.round(px), Math.round(cy + lado * (2.5 + r() * 2)), 1, 1);
    }
  }
}

module.exports = { moldura, kyber, barra, nivelDe, escrever, CORES_PCT, corDaLamina, corDoPct };
