'use strict';
// Tema Sith: o que enfeita o cartão. Moldura = neon duplo (vermelho; no lado da luz, off-white com
// brilho verde), bolinha = cristal kyber com o brilho da cor da situação, barra do usage = sabre que
// acende até o quanto foi gasto e muda de cor com ele: no lado sombrio violeta, roxo, magenta,
// carmim e vermelho a partir de 80% (a lâmina fica instável; a partir de 95% crepita); no da luz
// verde-escuro, verde, verde-claro, amarelo a partir de 80% e vermelho a partir de 95% (caindo pro
// lado sombrio). Números = a fonte de visor do tema Dragon Ball. Coordenadas: as da janela, em DIPs.
const { lim, arte, rgba, mistura, rng } = require('./comum');
const { escrever } = require('./dragonball-cartao');
const { SITH, COR } = require('./sith-arte');

const corHex = (c, reserva) => (/^#[0-9a-f]{6}$/i.test(c) ? c : reserva);
const pulso = t => 0.65 + 0.35 * Math.cos(2 * Math.PI * t / 1.6);  // o do "trabalhando" da janelinha
const nivelDe = u => (u.nivel != null ? lim(u.nivel | 0, 0, 2) : u.pct >= 95 ? 2 : u.pct >= 80 ? 1 : 0);
const CORES_PCT = ['#FCA5A5', '#F59E0B', '#EF4444'];  // o % do usage: normal, >= 80%, >= 95%
// a cor da lâmina pelo %: entre duas paradas, a mistura das duas; depois da última, uma cor só
// (na luz: amarelo dos 80 aos 95, vermelho daí pra cima)
const CORES_LAMINA = {
  sombra: [[0, '#5B21B6'], [30, '#9333EA'], [50, '#C026D3'], [65, '#BE123C'], [80, SITH.verm]],
  luz: [[0, '#15803D'], [30, '#22C55E'], [50, '#4ADE80'], [65, '#D9F99D'], [80, '#FACC15']],
};
function corDaLamina(pct, lado = COR.nome) {
  const p = lim(Number(pct) || 0, 0, 100), C = CORES_LAMINA[lado] || CORES_LAMINA.sombra;
  if (lado === 'luz' && p >= 95) return '#EF4444';
  for (let i = 1; i < C.length; i++) {
    const [p0, c0] = C[i - 1], [p1, c1] = C[i];
    if (p <= p1) return mistura(c0, c1, (p - p0) / (p1 - p0));
  }
  return C[C.length - 1][1];
}
// o número do %: abaixo de 80, um tom claro da lâmina; daí pra cima, o âmbar e o vermelho de todo tema
const corDoPct = (pct, nivel, lado) => (nivel ? CORES_PCT[nivel] : mistura(corDaLamina(pct, lado), '#FFFFFF', 0.5));

// ---------- moldura: neon duplo (dono, 09/10) ----------
// um fio escuro por fora, o tubo de neon aceso 2 px pra dentro (com o brilho somado), um ponto de
// luz que corre a volta toda em 6 s deixando rastro, e uma estrelinha em cada canto. A espessura é
// a mesma nos dois lados (3 px): o host lê o layout.
const NEON = {
  sombra: { fora: '#5B1414', brilho: '#EF4444', fio: '#EF4444', corre: '#FCA5A5', canto: '#7F1D1D', miolo: '#FCA5A5' },
  luz: { fora: '#3B2412', brilho: '#4ADE80', fio: '#E8E2D0', corre: '#BBF7D0', canto: '#5C3A1E', miolo: '#4ADE80' },
};
function moldura(g, [x, y, w, h], t) {
  const N = NEON[COR.nome] || NEON.sombra, brilho = 0.8 + 0.2 * Math.sin(t * 1.3);
  g.fillStyle = N.fora;
  g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
  const X = x + 2, Y = y + 2, W = w - 4, H = h - 4;
  g.save(); g.globalCompositeOperation = 'lighter';
  g.fillStyle = rgba(N.brilho, 0.2 * brilho);
  g.fillRect(X - 1, Y - 1, W + 2, 3); g.fillRect(X - 1, Y + H - 2, W + 2, 3); g.fillRect(X - 1, Y + 2, 3, H - 4); g.fillRect(X + W - 2, Y + 2, 3, H - 4);
  g.restore();
  g.fillStyle = rgba(N.fio, brilho);
  g.fillRect(X, Y, W, 1); g.fillRect(X, Y + H - 1, W, 1); g.fillRect(X, Y, 1, H); g.fillRect(X + W - 1, Y, 1, H);
  // o ponto que corre (sentido horário, a partir do canto de cima à esquerda) e o rastro dele
  const per = 2 * (W + H), cab = ((t / 6) % 1) * per;
  const ponto = s => {
    s = ((s % per) + per) % per;
    if (s < W) return [X + s, Y];
    if (s < W + H) return [X + W - 1, Y + s - W];
    if (s < 2 * W + H) return [X + W - 1 - (s - W - H), Y + H - 1];
    return [X, Y + H - 1 - (s - 2 * W - H)];
  };
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let k = 0; k < 46; k++) {
    const [px, py] = ponto(cab - k), a = 1 - k / 46;
    g.fillStyle = rgba(N.corre, 0.9 * a); g.fillRect(px, py, 1, 1);
    if (k < 10) { g.fillStyle = rgba(N.brilho, 0.35 * a); g.fillRect(px - 1.5, py - 1.5, 4, 4); }
  }
  g.restore();
  for (const [cx, cy] of [[x, y], [x + w, y], [x, y + h], [x + w, y + h]]) {
    g.fillStyle = N.canto; g.fillRect(cx - 2, cy - 1, 4, 2); g.fillRect(cx - 1, cy - 2, 2, 4);
    g.fillStyle = N.miolo; g.fillRect(cx - 0.5, cy - 0.5, 1, 1);
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
  // cabo: preto com anéis de metal (na luz: madeira com anéis off-white) e um botão da cor da lâmina
  const luz = COR.nome === 'luz';
  g.fillStyle = luz ? '#4A2E16' : '#111827'; g.fillRect(x, cy - 2, cabo, 4);
  g.fillStyle = luz ? '#E8E2D0' : SITH.prata; g.fillRect(x, cy - 2, 2, 4); g.fillRect(x + cabo - 2, cy - 2.5, 2, 5); g.fillRect(x + 5, cy - 2, 1, 4);
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
      g.fillStyle = r() < 0.5 ? (luz ? '#FEF9C3' : '#FECACA') : '#F97316';
      g.fillRect(Math.round(px), Math.round(cy + lado * (2.5 + r() * 2)), 1, 1);
    }
  }
}

module.exports = { moldura, kyber, barra, nivelDe, escrever, CORES_PCT, corDaLamina, corDoPct };
