'use strict';
// Tema Akatsuki: o que enfeita o cartão. Moldura = uma corrente de nuvens pretas do manto (contorno
// branco) sobre um fio vermelho, tudo chapado: branco, preto e vermelho (dono, 16/10: "menos neon"). Bolinha = nuvenzinha da cor da situação (pulsa trabalhando, como as dos outros
// temas). Barra do usage = "chakra": trilho escuro, azul até o quanto foi gasto e um redemoinho
// (Rasengan) girando na ponta; a partir de 80% vira laranja (Kurama), a partir de 95% vermelha e
// solta brasas. No lado Time 7 (o tema troca de lado a cada 50 voltas): folhas verdes girando no
// lugar das nuvens, bolinha = folhinha e a barra é dourada. Números = a fonte de visor do tema
// Dragon Ball. Coordenadas: as da janela, em DIPs.
const { lim, arte, rgba, mistura, rng } = require('./comum');
const { escrever } = require('./dragonball-cartao');
const { COR } = require('./akatsuki-arte');

const corHex = (c, reserva) => (/^#[0-9a-f]{6}$/i.test(c) ? c : reserva);
const pulso = t => 0.65 + 0.35 * Math.cos(2 * Math.PI * t / 1.6);  // o do "trabalhando" da janelinha
const nivelDe = u => (u.nivel != null ? lim(u.nivel | 0, 0, 2) : u.pct >= 95 ? 2 : u.pct >= 80 ? 1 : 0);
// as cores de cada lado: trilho, cheio/fim (o degradê da barra), kurama (>= 80%), forte (>= 95%),
// pct (o % do usage: normal, >= 80%, >= 95%)
const PAL = {
  akatsuki: { trilho: '#262626', cheio: '#F3F4F6', kurama: '#DC2626', forte: '#DC2626', pct: ['#F3F4F6', '#DC2626', '#DC2626'] },
  time7: { trilho: '#1E293B', cheio: '#F97316', kurama: '#DC2626', forte: '#DC2626', pct: ['#FDBA74', '#F97316', '#EF4444'] },
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
// Akatsuki: uma corrente de nuvens PRETAS do manto (contorno branco, a mesma nuvem desenhada à mão do
// tema) em cima de um fio vermelho liso, tudo em cores chapadas: branco, preto e vermelho, sem brilho
// nem halo (dono, 16/10: "menos neon", "parece Star Wars"). As nuvens só andam quando a janelinha está
// mexendo (alguém trabalhando, cena): parado o motor desenha a 5 quadros/s e o que andasse daria
// saltos de 5 px, os "tickzinhos de lag". Time 7: moldura parada, fio azul-marinho e fio laranja.
let fase = 0, ultimoT = null;
// o relógio do movimento: só avança quando "mexendo"; uma pausa longa entre dois quadros não vira salto
function andar(t, mexendo) {
  if (mexendo && ultimoT != null) fase += Math.min(Math.max(t - ultimoT, 0), 0.1);
  ultimoT = t;
  return fase;
}
const NUVEM_NEGRA = () => arte(NUVEM, { w: '#F3F4F6', r: '#0A0A0A' });
const FIO = '#DC2626', AZUL = '#1E3A8A', LARANJA = '#F97316';
const PASSO_NUVEM = 36, VEL = 26, RAIO = 8, INSET = 4;  // o espaço entre uma e outra, a velocidade (DIPs/s), o raio do cartão e o quanto as nuvens ficam pra dentro da borda
// o caminho do retângulo de cantos arredondados, i DIPs pra dentro da borda
function caminho(g, x, y, w, h, i) {
  const r = Math.max(RAIO - i, 1), X = x + i, Y = y + i, W = w - 2 * i, H = h - 2 * i;
  g.beginPath(); g.moveTo(X + r, Y);
  g.arc(X + W - r, Y + r, r, -Math.PI / 2, 0); g.arc(X + W - r, Y + H - r, r, 0, Math.PI / 2);
  g.arc(X + r, Y + H - r, r, Math.PI / 2, Math.PI); g.arc(X + r, Y + r, r, Math.PI, 1.5 * Math.PI);
  g.closePath();
}
// o trilho das nuvens: o retângulo arredondado INSET DIPs pra dentro da borda, do meio da reta de cima, no
// sentido horário. Devolve o comprimento e a função "[x, y] a s DIPs do começo"
function trilho(x, y, w, h) {
  const X = x + INSET, Y = y + INSET, W = w - 2 * INSET, H = h - 2 * INSET, r = Math.max(RAIO - INSET, 1);
  const a = W - 2 * r, b = H - 2 * r, q = Math.PI * r / 2, P = Math.PI;
  const reta = (px, py, dx, dy, len) => ({ len, em: s => [px + dx * s, py + dy * s] });
  const canto = (cx, cy, a0) => ({ len: q, em: s => [cx + r * Math.cos(a0 + s / r), cy + r * Math.sin(a0 + s / r)] });
  const segs = [
    reta(X + r + a / 2, Y, 1, 0, a / 2), canto(X + W - r, Y + r, -P / 2), reta(X + W, Y + r, 0, 1, b), canto(X + W - r, Y + H - r, 0),
    reta(X + W - r, Y + H, -1, 0, a), canto(X + r, Y + H - r, P / 2), reta(X, Y + H - r, 0, -1, b), canto(X + r, Y + r, P),
    reta(X + r, Y, 1, 0, a / 2),
  ];
  const per = segs.reduce((n, sg) => n + sg.len, 0);
  return { per, em(s) { s = ((s % per) + per) % per; for (const sg of segs) { if (s <= sg.len) return sg.em(s); s -= sg.len; } return segs[0].em(0); } };
}
function moldura(g, [x, y, w, h], t) {
  g.save(); g.lineWidth = 1;
  if (COR.lado === 'time7') {
    g.strokeStyle = AZUL; caminho(g, x, y, w, h, 0.5); g.stroke();
    g.strokeStyle = LARANJA; caminho(g, x, y, w, h, 1.5); g.stroke();
    g.restore(); return;
  }
  g.strokeStyle = FIO; caminho(g, x, y, w, h, 0.5); g.stroke();
  caminho(g, x, y, w, h, 0); g.clip();  // o que passa do canto arredondado do cartão fica de fora
  const tr = trilho(x, y, w, h), img = NUVEM_NEGRA();
  const n = Math.round(tr.per / PASSO_NUVEM), esp = tr.per / n;
  for (let i = 0; i < n; i++) {
    const [cx, cy] = tr.em(i * esp + t * VEL);
    g.drawImage(img, Math.round(cx - img.width / 2), Math.round(cy - img.height / 2));
  }
  g.restore();
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

// ---------- barra: o chakra azul até o quanto foi gasto, e o redemoinho na ponta ----------
// o redemoinho (Rasengan): disco de 9 DIPs e 3 braços em espiral girando devagar, em pixels duros
function redemoinho(g, cx, cy, cor, t) {
  cx = Math.round(cx); cy = Math.round(cy);
  g.fillStyle = '#0A0A0A';
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (dx * dx + dy * dy <= 18) g.fillRect(cx + dx, cy + dy, 1, 1);
  g.fillStyle = cor;
  for (let arm = 0; arm < 3; arm++) {
    for (let r = 0.6; r <= 4.4; r += 0.3) {
      const ang = arm * 2 * Math.PI / 3 + 0.9 * r - t * 2.4;
      g.fillRect(cx + Math.round(Math.cos(ang) * r), cy + Math.round(Math.sin(ang) * r), 1, 1);
    }
  }
  g.fillStyle = '#F3F4F6'; g.fillRect(cx, cy, 1, 1);
}
// a barra: trilho escuro e a cor chapada até o quanto foi gasto (branco; vermelho a partir de 80%;
// vermelho com um filete branco em cima a partir de 95%), o redemoinho girando na ponta
function barra(g, [x, y, w, h], pct, nivel, t) {
  const cy = y + h / 2, livre = w - 8, cheio = livre * lim(pct, 0, 100) / 100, P = pal();
  g.fillStyle = P.trilho; g.fillRect(x, cy - 1.5, livre, 3);
  const cor = nivel >= 2 ? P.forte : nivel >= 1 ? P.kurama : P.cheio;
  if (cheio >= 0.5) {
    g.fillStyle = cor; g.fillRect(x, cy - 1.5, cheio, 3);
    if (nivel >= 2) { g.fillStyle = '#F3F4F6'; g.fillRect(x, cy - 1.5, cheio, 1); }
  }
  redemoinho(g, x + Math.max(cheio, 4), cy, cor, t);
}

module.exports = { moldura, andar, redemoinho, bolinha, barra, nivelDe, escrever, CORES_PCT, corDoPct, PAL, nuvem, NUVEM, folha, FOLHA };
