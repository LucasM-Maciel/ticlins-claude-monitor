'use strict';
// Tema Akatsuki: o que enfeita o cartão. Moldura = fio vinho com um fio vermelho por dentro e três
// nuvens vermelhas de contorno branco correndo a volta da borda, cada uma com um rastro de luz no
// fio (dono, 14/10: "rodando tipo o laser do Star Wars"; as folhas giram enquanto voam), bolinha
// = nuvenzinha da cor da situação (pulsa trabalhando, como as dos outros temas), barra do usage =
// trilho escuro, o vermelho até o quanto foi gasto e uma kunai na ponta; a partir de 80% ele pulsa,
// a partir de 95% solta brasas. No lado Time 7 (o tema troca de lado a cada 50 voltas): fio
// azul-marinho com o laranja por dentro, folhas verdes no lugar das nuvens, a bolinha é uma folhinha
// e a barra é laranja. Números = a fonte de visor do tema Dragon Ball. Coordenadas: as da janela,
// em DIPs.
const { lim, arte, rgba, mistura, rng } = require('./comum');
const { escrever } = require('./dragonball-cartao');
const { COR, kunai } = require('./akatsuki-arte');

const corHex = (c, reserva) => (/^#[0-9a-f]{6}$/i.test(c) ? c : reserva);
const pulso = t => 0.65 + 0.35 * Math.cos(2 * Math.PI * t / 1.6);  // o do "trabalhando" da janelinha
const nivelDe = u => (u.nivel != null ? lim(u.nivel | 0, 0, 2) : u.pct >= 95 ? 2 : u.pct >= 80 ? 1 : 0);
// as cores de cada lado: fora/dentro (os fios da moldura), trilho, cheio/forte (a barra, normal e
// >= 95%), pct (o % do usage: normal, >= 80%, >= 95%)
const PAL = {
  akatsuki: { fora: '#7F1D1D', dentro: '#DC2626', trilho: '#2A2A2A', cheio: '#DC2626', forte: '#EF4444', pct: ['#FCA5A5', '#F59E0B', '#EF4444'] },
  time7: { fora: '#1E3A8A', dentro: '#F97316', trilho: '#1E293B', cheio: '#F97316', forte: '#EF4444', pct: ['#FDBA74', '#F59E0B', '#EF4444'] },
};
const pal = () => PAL[COR.lado] || PAL.akatsuki;
const CORES_PCT = PAL.akatsuki.pct;
const corDoPct = nivel => pal().pct[nivel];

// a nuvem vermelha (contorno branco), 1 px = 1 DIP
const NUVEM = [
  '.....wwww.......',
  '...wwrrrrw..www.',
  '..wrrrrrrrwwrrrw',
  '.wrrrwwrrrrrrrrw',
  'wrrrw..wrrrrrrw.',
  'wrrrrwwrrrrrrw..',
  '.wwrrrrrrrrww...',
  '...wwwwwwww.....',
];
const nuvem = () => arte(NUVEM, { w: COR.borda, r: COR.nuvem });
// a nuvenzinha da bolinha (9x7): o miolo da cor da situação, contorno branco
const NUVENZINHA = ['..www....', '.wcccw.w.', 'wcccccwcw', 'wcccccccw', 'wccccccw.', '.wwccccw.', '...wwww..'];
// a folha do Time 7 (a ponta pra cima e à direita, o cabinho embaixo à esquerda), 1 px = 1 DIP
const FOLHA = [
  '.........dd.',
  '......ddlld.',
  '....ddlllLd.',
  '..ddllllLld.',
  '.dlllllLlld.',
  '.dllllLlld..',
  'dlllLllldd..',
  'dllLlllld...',
  '.dLddddd....',
  'sd..........',
];
const folha = () => arte(FOLHA, { d: '#14532D', l: '#22C55E', L: '#86EFAC', s: '#14532D' });
// a folhinha da bolinha (9x8): o miolo da cor da situação, contorno branco
const FOLHINHA = ['......ww.', '....wwccw', '..wwcccw.', '.wccccw..', 'wccccw...', 'wcccw....', 'wwww.....', 'w........'];

// ---------- moldura ----------
// as nuvens (as folhas) correm no sentido horário, uma volta em VOLTA s, a 1/3 de volta uma da outra
const VOLTA = 10;
// o ponto a s DIPs do canto de cima à esquerda, andando no sentido horário pelo retângulo
function naBorda(X, Y, W, H, s) {
  const per = 2 * (W + H);
  s = ((s % per) + per) % per;
  if (s < W) return [X + s, Y];
  if (s < W + H) return [X + W, Y + s - W];
  if (s < 2 * W + H) return [X + W - (s - W - H), Y + H];
  return [X, Y + H - (s - 2 * W - H)];
}
function moldura(g, [x, y, w, h], t) {
  const P = pal();
  g.fillStyle = P.fora;
  g.fillRect(x, y, w, 1); g.fillRect(x, y + h - 1, w, 1); g.fillRect(x, y, 1, h); g.fillRect(x + w - 1, y, 1, h);
  g.fillStyle = rgba(P.dentro, 0.75 + 0.1 * Math.sin(t * 0.9));
  g.fillRect(x + 1, y + 1, w - 2, 1); g.fillRect(x + 1, y + h - 2, w - 2, 1); g.fillRect(x + 1, y + 1, 1, h - 2); g.fillRect(x + w - 2, y + 1, 1, h - 2);
  // as nuvens (as folhas, no Time 7) correndo no fio de dentro, cada uma com o rastro de luz atrás
  const time7 = COR.lado === 'time7', img = time7 ? folha() : nuvem(), corre = mistura(P.dentro, '#FFFFFF', 0.45);
  const X = x + 1, Y = y + 1, W = w - 3, H = h - 3, per = 2 * (W + H);
  for (let i = 0; i < 3; i++) {
    const cab = ((t / VOLTA + i / 3) % 1) * per;
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let k = 4; k < 44; k++) {
      const [px, py] = naBorda(X, Y, W, H, cab - k), a = 1 - (k - 4) / 40;
      g.fillStyle = rgba(corre, 0.9 * a); g.fillRect(px, py, 1, 1);
      if (k < 16) { g.fillStyle = rgba(P.dentro, 0.3 * a); g.fillRect(px - 1.5, py - 1.5, 4, 4); }
    }
    g.restore();
    const [cx, cy] = naBorda(X, Y, W, H, cab);
    if (time7) {  // a folha gira voando
      g.save(); g.translate(cx, cy); g.rotate(t * 2.5 + i * 2.1); g.drawImage(img, -6, -5); g.restore();
    } else g.drawImage(img, Math.round(cx - 8), Math.round(cy - 4));
  }
}

// ---------- bolinha: a nuvenzinha ----------
function bolinha(g, linha, t) {
  const [x, y, w, h] = linha.bola, cor = corHex(linha.cor, '#9CA3AF');
  const cx = x + w / 2, cy = y + h / 2;
  const a = linha.sit === 'working' ? pulso(t) : 1;
  g.save(); g.globalAlpha *= a;
  g.save(); g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(cx, cy, 1, cx, cy, 7);
  gr.addColorStop(0, rgba(cor, 0.5)); gr.addColorStop(1, rgba(cor, 0));
  g.fillStyle = gr; g.fillRect(cx - 7, cy - 7, 14, 14);
  g.restore();
  if (COR.lado === 'time7') g.drawImage(arte(FOLHINHA, { w: COR.borda, c: cor }), Math.round(cx - 4.5), Math.round(cy - 4));
  else g.drawImage(arte(NUVENZINHA, { w: COR.borda, c: cor }), Math.round(cx - 4.5), Math.round(cy - 3.5));
  g.restore();
}

// ---------- barra: o vermelho até o quanto foi gasto, e a kunai na ponta ----------
function barra(g, [x, y, w, h], pct, nivel, t) {
  const cy = y + h / 2, livre = w - 8, cheio = livre * lim(pct, 0, 100) / 100, P = pal();
  g.fillStyle = P.trilho; g.fillRect(x, cy - 1.5, livre, 3);
  if (cheio >= 0.5) {
    const forte = nivel >= 1 ? 0.75 + 0.25 * Math.sin(t * (nivel >= 2 ? 9 : 4)) : 1;
    const cor = nivel >= 2 ? P.forte : P.cheio;
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = rgba(cor, 0.25 * forte); g.fillRect(x, cy - 2.5, cheio, 5);
    g.restore();
    g.fillStyle = cor; g.fillRect(x, cy - 1.5, cheio, 3);
    g.fillStyle = mistura(cor, '#FFFFFF', 0.45); g.fillRect(x, cy - 1.5, cheio, 1);
    if (nivel >= 2) {  // brasas subindo da barra
      const r = rng(Math.floor(t * 12) * 104729 + Math.round(x));
      for (let i = 0; i < 4; i++) {
        g.fillStyle = r() < 0.5 ? '#FDE047' : '#F97316';
        g.fillRect(Math.round(x + cheio * r()), Math.round(cy - 3 - r() * 3), 1, 1);
      }
    }
  }
  kunai(g, x + cheio + 9, cy, 0, 1);  // a ponta da kunai encosta no fim do vermelho
}

module.exports = { moldura, bolinha, barra, nivelDe, escrever, CORES_PCT, corDoPct, PAL, nuvem, NUVEM, folha, FOLHA };
