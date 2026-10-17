'use strict';
// Tema Akatsuki: o que enfeita o cartão. Moldura = só nuvens pretas do manto (contorno vermelho
// fino, sobre uma faixa vinho escuro), grandes e sobrepostas, cobrindo a volta toda da borda e deslizando devagar no sentido
// horário como uma esteira, sem fio, sem neon e sem rastro (dono, 16/10: "parece Star Wars"); elas
// ocupam a faixa de 8 DIPs da borda (a moldura de 2 + o começo do padding, que é de >= 6), sem
// tocar o conteúdo. Bolinha = nuvenzinha da cor da situação (pulsa trabalhando, como as dos outros
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
  akatsuki: { trilho: '#2A2A2A', cheio: '#38BDF8', fim: '#0EA5E9', kurama: '#F59E0B', forte: '#EF4444', pct: ['#FCA5A5', '#F59E0B', '#EF4444'] },
  time7: { trilho: '#1E293B', cheio: '#FBBF24', fim: '#F97316', kurama: '#EA580C', forte: '#EF4444', pct: ['#FDBA74', '#F59E0B', '#EF4444'] },
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

// ---------- moldura: a esteira de nuvens ----------
// as nuvens do manto: círculos (cx, cy, r) viram a máscara; a borda da máscara é o contorno vermelho
// de 1 px (limpo, sem pontinhos), o resto é preto, e os lóbulos têm alturas diferentes pra a
// silhueta ler como nuvem. Lóbulos grandes e redondos, base reta, 6 a 8 DIPs de altura (a faixa de borda livre):
// a base encosta na borda e os lóbulos apontam pra dentro. Elas andam sobre uma faixa vinho escuro, que faz o corpo preto aparecer.
const FAIXA = '#3B0A0A', CORPO = '#050505', ALTURA_FAIXA = 8;
function nuvemDe(circulos, larg, alt) {
  const dentro = (x, y) => x >= 0 && y >= 0 && x < larg && y < alt && circulos.some(([cx, cy, r]) => (x + 0.5 - cx) ** 2 + (y + 0.5 - cy) ** 2 <= r * r);
  const linhas = [];
  for (let y = 0; y < alt; y++) {
    let l = '';
    for (let x = 0; x < larg; x++) {
      if (!dentro(x, y)) { l += '.'; continue; }
      // a base (a última linha) encosta na borda do cartão e fica sem contorno; 
      const borda = !dentro(x - 1, y) || !dentro(x + 1, y) || !dentro(x, y - 1) || (y < alt - 1 && !dentro(x, y + 1));
      l += borda ? 'r' : 'k';
    }
    linhas.push(l);
  }
  return arte(linhas, { r: COR.nuvem, k: CORPO });
}
const FORMAS = [
  [[[4.5, 5.2, 3.5], [11.5, 4.2, 4.4], [19, 5.2, 3.8]], 24, 8],
  [[[4.5, 4.6, 3.8], [11.5, 4, 4.2], [18.5, 5.4, 3.2]], 23, 8],
  [[[4, 5.4, 3], [10, 4.4, 4], [17, 4, 4.2], [23.5, 5.2, 3.4]], 27, 8],
];
let NUVENS = null;  // as 3 formas, montadas na 1ª vez
const FOLHA_ESC = 0.6, PASSO_NUVEM = 20, PASSO_FOLHA = 8, VEL = 11;  // a folha em 0,6; o espaço de uma pra outra e a velocidade (DIPs/s)
const INSET = 4, RAIO = 8;  // o centro das nuvens: 4 DIPs pra dentro da borda; o raio do cartão
// o trilho: o retângulo de cantos arredondados pelo centro das nuvens, do meio da reta de cima, no
// sentido horário. Devolve o comprimento e a função "[x, y, ângulo da tangente] a s DIPs do começo"
function trilho(x, y, w, h) {
  const X = x + INSET, Y = y + INSET, W = w - 2 * INSET, H = h - 2 * INSET, r = Math.max(RAIO - INSET, 1);
  const a = W - 2 * r, b = H - 2 * r, q = Math.PI * r / 2, P = Math.PI;
  const reta = (px, py, dx, dy, len) => ({ len, em: s => [px + dx * s, py + dy * s, Math.atan2(dy, dx)] });
  const canto = (cx, cy, a0) => ({ len: q, em: s => [cx + r * Math.cos(a0 + s / r), cy + r * Math.sin(a0 + s / r), a0 + s / r + P / 2] });
  const segs = [
    reta(X + r + a / 2, Y, 1, 0, a / 2), canto(X + W - r, Y + r, -P / 2), reta(X + W, Y + r, 0, 1, b), canto(X + W - r, Y + H - r, 0),
    reta(X + W - r, Y + H, -1, 0, a), canto(X + r, Y + H - r, P / 2), reta(X, Y + H - r, 0, -1, b), canto(X + r, Y + r, P),
    reta(X + r, Y, 1, 0, a / 2),
  ];
  const per = segs.reduce((n, sg) => n + sg.len, 0);
  return { per, em(s) { s = ((s % per) + per) % per; for (const sg of segs) { if (s <= sg.len) return sg.em(s); s -= sg.len; } return segs[0].em(0); } };
}
// as nuvens (as folhas, no Time 7) numa esteira que dá a volta inteira: uma colada na outra,
// sobrepostas, andando VEL DIPs por segundo no sentido horário
function moldura(g, [x, y, w, h], t) {
  const time7 = COR.lado === 'time7', tr = trilho(x, y, w, h);
  const n = Math.round(tr.per / (time7 ? PASSO_FOLHA : PASSO_NUVEM)), esp = tr.per / n;
  if (!NUVENS) NUVENS = FORMAS.map(f => nuvemDe(...f));
  g.save(); g.beginPath();  // o que passa do canto arredondado do cartão fica de fora
  g.moveTo(x + RAIO, y);
  g.arc(x + w - RAIO, y + RAIO, RAIO, -Math.PI / 2, 0); g.arc(x + w - RAIO, y + h - RAIO, RAIO, 0, Math.PI / 2);
  g.arc(x + RAIO, y + h - RAIO, RAIO, Math.PI / 2, Math.PI); g.arc(x + RAIO, y + RAIO, RAIO, Math.PI, 1.5 * Math.PI);
  g.closePath(); g.clip();
  if (!time7) {  // a faixa vinho por trás: o corpo preto das nuvens precisa de fundo pra aparecer
    g.fillStyle = FAIXA;
    g.fillRect(x, y, w, ALTURA_FAIXA); g.fillRect(x, y + h - ALTURA_FAIXA, w, ALTURA_FAIXA);
    g.fillRect(x, y + ALTURA_FAIXA, ALTURA_FAIXA, h - 2 * ALTURA_FAIXA); g.fillRect(x + w - ALTURA_FAIXA, y + ALTURA_FAIXA, ALTURA_FAIXA, h - 2 * ALTURA_FAIXA);
  }
  for (let i = 0; i < n; i++) {
    const s = i * esp + t * VEL + 1.2 * Math.sin(t * 0.7 + i * 2.3);  // a fase de cada uma varia um pouco
    const [cx, cy, ang] = tr.em(s);
    if (time7) {  // a folha gira no lugar
      g.save(); g.translate(Math.round(cx), Math.round(cy)); g.rotate(t * 2.5 + i * 2.1);
      g.drawImage(folha(), -6 * FOLHA_ESC, -5 * FOLHA_ESC, 12 * FOLHA_ESC, 10 * FOLHA_ESC); g.restore();
    } else {
      const img = NUVENS[(i * 5 + (i >> 1)) % NUVENS.length];
      g.save(); g.translate(Math.round(cx), Math.round(cy)); g.rotate(Math.round(ang / (Math.PI / 2)) * Math.PI / 2 + Math.PI);  // a base fica na borda do cartão e os lóbulos pra dentro
      g.drawImage(img, -img.width / 2, -(img.height - INSET)); g.restore();
    }
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
  g.save(); g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(cx, cy, 2, cx, cy, 8);
  gr.addColorStop(0, rgba(cor, 0.45)); gr.addColorStop(1, rgba(cor, 0));
  g.fillStyle = gr; g.fillRect(cx - 8, cy - 8, 16, 16);
  g.restore();
  g.fillStyle = mistura(cor, '#0B1220', 0.35);
  for (let dy = -4; dy <= 4; dy++) for (let dx = -4; dx <= 4; dx++) if (dx * dx + dy * dy <= 18) g.fillRect(cx + dx, cy + dy, 1, 1);
  const claro = mistura(cor, '#FFFFFF', 0.75);
  for (let arm = 0; arm < 3; arm++) {
    for (let r = 0.6; r <= 4.4; r += 0.3) {
      const ang = arm * 2 * Math.PI / 3 + 0.9 * r - t * 2.4;
      g.fillStyle = r > 3.4 ? cor : claro;
      g.fillRect(cx + Math.round(Math.cos(ang) * r), cy + Math.round(Math.sin(ang) * r), 1, 1);
    }
  }
  g.fillStyle = '#FFFFFF'; g.fillRect(cx, cy, 1, 1);
}
function barra(g, [x, y, w, h], pct, nivel, t) {
  const cy = y + h / 2, livre = w - 8, cheio = livre * lim(pct, 0, 100) / 100, P = pal();
  g.fillStyle = P.trilho; g.fillRect(x, cy - 1.5, livre, 3);
  const forte = nivel >= 1 ? 0.75 + 0.25 * Math.sin(t * (nivel >= 2 ? 9 : 4)) : 1;
  const cor = nivel >= 2 ? P.forte : nivel >= 1 ? P.kurama : P.cheio;
  if (cheio >= 0.5) {
    g.save(); g.globalCompositeOperation = 'lighter';
    g.fillStyle = rgba(cor, 0.2 * forte + 0.05 * Math.sin(t * 1.5)); g.fillRect(x, cy - 2.5, cheio, 5);
    g.restore();
    if (nivel === 0) {  // o degradê do azul claro ao azul forte, coluna a coluna
      for (let i = 0; i < Math.ceil(cheio); i++) {
        g.fillStyle = mistura(P.cheio, P.fim, i / Math.max(livre, 1));
        g.fillRect(x + i, cy - 1.5, Math.min(1, cheio - i), 3);
      }
    } else { g.fillStyle = cor; g.fillRect(x, cy - 1.5, cheio, 3); }
    g.fillStyle = mistura(nivel === 0 ? P.cheio : cor, '#FFFFFF', 0.5); g.fillRect(x, cy - 1.5, cheio, 1);
    if (nivel >= 2) {  // brasas subindo da barra
      const r = rng(Math.floor(t * 12) * 104729 + Math.round(x));
      for (let i = 0; i < 4; i++) {
        g.fillStyle = r() < 0.5 ? '#FDE047' : '#F97316';
        g.fillRect(Math.round(x + cheio * r()), Math.round(cy - 3 - r() * 3), 1, 1);
      }
    }
  }
  redemoinho(g, x + Math.max(cheio, 4), cy, nivel === 0 ? P.fim : cor, t);
}

module.exports = { moldura, redemoinho, bolinha, barra, nivelDe, escrever, CORES_PCT, corDoPct, PAL, nuvem, NUVEM, folha, FOLHA };
