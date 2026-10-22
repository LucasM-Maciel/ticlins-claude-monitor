'use strict';
// Tema Elden Ring: ouro envelhecido, losangos e um florão como os galhos da Árvore Dourada.
// Contrato: moldura(g, [x,y,w,h], t), bolinha(g, linha, t), barra(g, [x,y,w,h], pct, nivel, t), nivelDe(u),
// escrever(g, e, txt, cor, caixa, direita), corDoPct(pct, nivel), andar(t, emMovimento) -> fase. Coordenadas: as da janela, em DIPs.
const { lim, rgba } = require('./comum');
const { escrever } = require('./dragonball-cartao');
const { COR } = require('./elden-arte');

const nivelDe = u => (u.nivel != null ? lim(u.nivel | 0, 0, 2) : u.pct >= 95 ? 2 : u.pct >= 80 ? 1 : 0);
const CORES_PCT = [COR.ouroClaro, '#F59E0B', COR.sangueClaro];
const corDoPct = (pct, nivel) => CORES_PCT[nivel] || CORES_PCT[0];
const CORES_BARRA = [COR.ouro, '#F59E0B', COR.sangueClaro];
const BRILHOS = [COR.ouroClaro, '#FCD34D', '#FCA5A5'];
const SOMBRAS = [COR.ouroEsc, '#B45309', COR.sangue];
let fase = 0, ultimo = null;
function andar(t, andando) { if (ultimo != null && andando) fase += t - ultimo; ultimo = t; return fase; }

// Losango em linhas de pixel: sem imagem nova, rotação ou suavização por quadro.
function losango(g, cx, cy, raio, cor) {
  g.fillStyle = cor;
  for (let dy = -raio; dy <= raio; dy++) {
    const meia = raio - Math.abs(dy);
    g.fillRect(cx - meia, cy + dy, meia * 2 + 1, 1);
  }
}
function fio(g, x, y, w, h, cor) {
  g.fillStyle = cor;
  g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1);
  g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
}

function moldura(g, [x, y, w, h], t = 0) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  // Só um halo pequeno sob o florão, recortado ao cartão; nenhum bitmap por quadro.
  const cx = Math.round(x + w / 2), cy = y + 5, r = 24;
  g.save(); g.beginPath(); g.rect(x + 3, y + 3, w - 6, h - 6); g.clip();
  g.globalCompositeOperation = 'lighter';
  const luz = g.createRadialGradient(cx, cy, 0, cx, cy, r);
  luz.addColorStop(0, rgba(COR.ouroClaro, 0.06 + 0.01 * Math.sin(t * 0.9)));
  luz.addColorStop(1, rgba(COR.ouro, 0));
  g.fillStyle = luz; g.fillRect(cx - r, cy - r, r * 2, r * 2);
  g.restore();

  fio(g, x, y, w, h, COR.ouro);
  fio(g, x + 1, y + 1, w - 2, h - 2, COR.ouroFundo);
  fio(g, x + 2, y + 2, w - 4, h - 4, COR.ouroEsc);
  for (let canto = 0; canto < 4; canto++) {
    const px = canto & 1 ? x + w - 2 : x + 1, py = canto & 2 ? y + h - 2 : y + 1;
    losango(g, px, py, 2, COR.ouroEsc);
    losango(g, px, py, 1, COR.ouro);
    g.fillStyle = COR.ouroClaro; g.fillRect(px, py - 1, 1, 1);
  }
  // Florão simétrico: haste, galhos em degraus e a gota de ouro no alto.
  g.fillStyle = COR.ouroFundo; g.fillRect(cx - 5, y - 1, 11, 4);
  g.fillStyle = COR.ouroEsc; g.fillRect(cx - 5, y + 2, 11, 1);
  g.fillStyle = COR.ouro;
  g.fillRect(cx, y - 3, 1, 6); g.fillRect(cx - 3, y, 7, 1);
  g.fillRect(cx - 4, y - 1, 2, 1); g.fillRect(cx + 3, y - 1, 2, 1);
  g.fillRect(cx - 5, y - 2, 1, 1); g.fillRect(cx + 5, y - 2, 1, 1);
  g.fillStyle = COR.ouroClaro; g.fillRect(cx, y - 4, 1, 1);
}
function bolinha(g, linha, t = 0) {
  const [x, y, w, h] = linha.bola;
  const cx = Math.round(x + (w - 1) / 2), cy = Math.round(y + (h - 1) / 2);
  g.save();
  if (linha.sit === 'working') g.globalAlpha *= 0.65 + 0.35 * Math.cos(2 * Math.PI * t / 1.6);
  losango(g, cx, cy, 3, COR.ouroFundo);
  losango(g, cx, cy, 2, linha.cor || '#9CA3AF');
  g.fillStyle = COR.ouroClaro; g.fillRect(cx, cy - 2, 1, 1);
  g.restore();
}
function barra(g, [x, y, w, h], pct, nivel, t) {
  x = Math.round(x); y = Math.round(y); w = Math.round(w); h = Math.round(h);
  if (w < 3 || h < 3) return;
  const n = lim(nivel | 0, 0, 2), wi = w - 2, hi = h - 2;
  const cheio = Math.round(wi * lim(pct, 0, 100) / 100);
  // O contorno deixa os quatro pixels dos cantos vazios: corte reto, sem arredondar.
  g.fillStyle = COR.ouroFundo;
  g.fillRect(x + 1, y, wi, h); g.fillRect(x, y + 1, w, hi);
  g.fillStyle = '#1A130A'; g.fillRect(x + 1, y + 1, wi, hi);
  if (cheio > 0) {
    g.fillStyle = CORES_BARRA[n]; g.fillRect(x + 1, y + 1, cheio, hi);
    if (hi > 1) { g.fillStyle = SOMBRAS[n]; g.fillRect(x + 1, y + hi, cheio, 1); }
    g.fillStyle = BRILHOS[n]; g.fillRect(x + 1, y + 1, cheio, 1);
  }
  // Os extremos já são o contorno; as três marcas internas dividem o trilho em quartos.
  g.fillStyle = COR.ouroFundo;
  for (let i = 1; i < 4; i++) g.fillRect(x + 1 + Math.floor((wi - 1) * i / 4), y + 1, 1, hi);
}

module.exports = { moldura, bolinha, barra, nivelDe, escrever, corDoPct, andar };
