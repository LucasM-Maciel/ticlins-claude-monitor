'use strict';
// O Clawd (mascote do Claude Code) e a trilha em volta do cartão. Mesmo desenho do
// overlay.ps1 de antes, em meias-fileiras: as 5 fileiras de 3 px viraram 10 de 1,5 px,
// pra caber roupa (cinto, sapato, cabelo). Origem (0,0) = entre os pés; y- = pra fora
// do cartão. Cada tema registra as roupas dele (registrarRoupas).
const { DEG, tela, cache, tingida, IMG } = require('./comum');

// '#' corpo, 'o' olho, A/B pernas (alternam a cada 160 ms; perna[0] em cima, perna[1] embaixo).
// Roupa com mais de 10 meias-fileiras (cabelo em cima da cabeça) cresce pra cima.
// olho: as letras que piscam (padrão 'o'); palpebra: cor da pálpebra (padrão a do corpo);
// olhoFechado: na skin inteira o olho fecha num risco dessa cor.
const ROUPAS = {
  clawd: {
    linhas: ['...############...', '...############...', '...##o######o##...', '...##o######o##...', '.################.', '.################.', '...############...', '...############...', '....A.B....A.B....', '....A.B....A.B....'],
    cores: { '#': '#D77757', o: '#1A1A1A' }, perna: ['#D77757', '#D77757'], corpo: '#D77757',
  },
};
function registrarRoupas(novas) { Object.assign(ROUPAS, novas); }

const BRACOS = [[4, 1], [4, 2], [5, 1], [5, 2], [4, 15], [4, 16], [5, 15], [5, 16]];  // [meia-fileira, coluna]
const ehBraco = (yb, x) => (yb === 4 || yb === 5) && (x === 1 || x === 2 || x === 15 || x === 16);

// olhos: 'abertos' | 'fechados' (só a meia de baixo) | 'cima' (só a de cima); cabelo: [h, j] troca a cor do cabelo
const SPR = cache(300);
function spriteClawd(roupa, pernas, olhos, semBracos, cabelo) {
  const chave = [roupa, pernas, olhos, semBracos, cabelo ? cabelo.join('') : ''].join(',');
  const pronto = SPR.get(chave);
  if (pronto) return pronto;
  const R = ROUPAS[roupa] || ROUPAS.clawd, L = R.linhas.length;
  const cores = cabelo ? { ...R.cores, h: cabelo[0], j: cabelo[1] } : R.cores;
  const olho = R.olho || /o/, palpebra = R.palpebra || R.corpo || '#D77757';
  const c = tela(18, L);
  const k = c.getContext('2d');
  R.linhas.forEach((lin, y) => {
    const yb = y - (L - 10);  // meia-fileira no referencial do Clawd de hoje (0..9)
    for (let x = 0; x < lin.length; x++) {
      const ch = lin[x];
      if (ch === '.') continue;
      if (semBracos && ehBraco(yb, x)) continue;
      let cor;
      if (ch === 'A' || ch === 'B') {
        if (pernas === 'nenhuma' || (pernas === 'A' && ch === 'B') || (pernas === 'B' && ch === 'A')) continue;
        cor = R.perna[yb - 8];
      } else if (R.olhoFechado && olho.test(ch) && olhos === 'fechados') cor = R.olhoFechado;
      else if (olho.test(ch) && ((olhos === 'fechados' && yb === 2) || (olhos === 'cima' && yb === 3))) cor = palpebra;
      else cor = cores[ch];
      if (!cor) continue;
      k.fillStyle = cor; k.fillRect(x, y, 1, 1);
    }
  });
  c.chave = chave;
  return SPR.set(chave, c);
}
function corBraco(roupa, yb, col) { const R = ROUPAS[roupa] || ROUPAS.clawd; return R.cores[R.linhas[R.linhas.length - 10 + yb][col]]; }

// Herobrine: halo de 1 px em volta de cada olho ('g'), pulsando a cada 1,6 s, e o olho branco por cima
function brilhoOlhos(g, roupa, dy, olhos, T) {
  const R = ROUPAS[roupa];
  if (!R.olhosCx) {
    R.olhosCx = [[], []];
    R.linhas.forEach((l, y) => [...l].forEach((ch, x) => { if (ch === 'g') R.olhosCx[x < 9 ? 0 : 1].push([x, y]); }));
  }
  const L = R.linhas.length;
  const a = 0.15 + 0.4 * (0.5 + 0.5 * Math.sin(T * 2 * Math.PI / 1.6));
  for (const cel of R.olhosCx) {
    if (!cel.length) continue;
    const xs = cel.map(c => c[0]), ys = cel.map(c => c[1]);
    const x0 = (Math.min(...xs) - 9) * 1.5, y0 = (Math.min(...ys) - L) * 1.5 + dy;
    const w = (Math.max(...xs) - Math.min(...xs) + 1) * 1.5, h = (Math.max(...ys) - Math.min(...ys) + 1) * 1.5;
    g.fillStyle = `rgba(214,240,255,${a.toFixed(3)})`; g.fillRect(x0 - 1, y0 - 1, w + 2, h + 2);
    g.fillStyle = '#FFFFFF';
    for (const [x, y] of cel) if (!(olhos === 'cima' && y - (L - 10) === 3)) g.fillRect((x - 9) * 1.5, (y - L) * 1.5 + dy, 1.5, 1.5);
  }
}
// a ferramenta: cabo no pixel (2,5; 13,5) da textura, na mão (12; -7,5), 1,1 px por pixel
function ferramenta(g, nome, ang, dy = 0) {
  const img = IMG[nome];
  if (!img) return;
  g.save(); g.translate(12, -7.5 + dy); g.rotate(ang * DEG); g.drawImage(img, -2.75, -14.85, 17.6, 17.6); g.restore();
}

// p: { x, y, rot, sx, sy, roupa, pernas, olhos, cabelo:[h,j], branco (true ou cor: o sprite inteiro dessa cor),
//      tinta (cor, ou {cor, a}: pinta por cima), alfa, sentado, bracos:[dyEsq, dyDir], brilho (0..1, halo dourado),
//      ferr, ang, T (relógio, pro brilho do Herobrine),
//      aura(g) antes de amassar, atras(g, dy, L) atrás do sprite, frente(g, dy, L) por cima, mao(g, dy) }
function desenhaClawd(g, p = {}) {
  const roupa = ROUPAS[p.roupa] ? p.roupa : 'clawd', R = ROUPAS[roupa], L = R.linhas.length;
  const corBranco = p.branco === true ? '#FFFFFF' : p.branco;
  g.save();
  g.translate(p.x || 0, p.y || 0);
  if (p.rot) g.rotate(p.rot * DEG);
  if (p.aura) p.aura(g);  // a aura não estica junto
  if (p.sx != null || p.sy != null) g.scale(p.sx ?? 1, p.sy ?? 1);  // amassa a partir dos pés
  if (p.alfa != null) g.globalAlpha *= p.alfa;
  const dy = p.sentado ? 3 : 0;
  if (p.brilho) {
    const gr = g.createRadialGradient(0, -8 + dy, 2, 0, -8 + dy, 22);
    gr.addColorStop(0, `rgba(255,236,140,${(0.55 * p.brilho).toFixed(3)})`); gr.addColorStop(1, 'rgba(255,236,140,0)');
    g.fillStyle = gr; g.fillRect(-24, -32 + dy, 48, 48);
  }
  if (p.atras) p.atras(g, dy, L);
  let spr = spriteClawd(roupa, p.sentado ? 'nenhuma' : (p.pernas || 'ambas'), p.olhos || 'abertos', !!p.bracos, p.cabelo);
  if (corBranco) spr = tingida(spr, corBranco, 'cl' + spr.chave);
  g.drawImage(spr, -13.5, -L * 1.5 + dy, 27, L * 1.5);
  const tinta = typeof p.tinta === 'string' ? { cor: p.tinta, a: 1 } : p.tinta;
  if (tinta && tinta.a > 0) {
    g.save(); g.globalAlpha *= tinta.a;
    g.drawImage(tingida(spr, tinta.cor, 'cl' + spr.chave), -13.5, -L * 1.5 + dy, 27, L * 1.5);
    g.restore();
  }
  if (p.bracos) {
    for (const [lin, col] of BRACOS) {
      g.fillStyle = corBranco || corBraco(roupa, lin, col);
      g.fillRect((col - 9) * 1.5, (lin - 10) * 1.5 + dy + (col < 9 ? p.bracos[0] : p.bracos[1]), 1.5, 1.5);
    }
  }
  if (R.brilho && p.olhos !== 'fechados') brilhoOlhos(g, roupa, dy, p.olhos, p.T || 0);
  if (p.ferr) ferramenta(g, p.ferr, p.ang || 0, dy);
  if (p.frente) p.frente(g, dy, L);
  if (p.mao) p.mao(g, dy);
  g.restore();
}
// andando no lugar: pulinho de 5 px (160 ms sobe, 160 desce), perna troca a cada 160 ms, ferramenta -25°..15°
function andando(t, extra = {}) {
  const q = (t % 0.32) / 0.32, u = q < 0.5 ? 2 * q : 2 - 2 * q;
  const q2 = (t % 0.64) / 0.64, v = q2 < 0.5 ? 2 * q2 : 2 - 2 * q2;
  return { y: -5 * (1 - (1 - u) * (1 - u)), pernas: Math.floor(t / 0.16) % 2 ? 'B' : 'A', ang: -25 + 40 * Math.sin(v * Math.PI / 2), ...extra };
}
// pulando no lugar (pergunta/permissão)
function pulando(t, extra = {}) {
  const q = (t % 0.32) / 0.32, u = q < 0.5 ? 2 * q : 2 - 2 * q;
  return { y: -5 * (1 - (1 - u) * (1 - u)), pernas: 'ambas', ang: 0, ...extra };
}
// ângulo da ferramenta num golpe (u de 0 a 1): levanta devagar, desce rápido
function golpe(u) { return u < 0.7 ? -40 * u / 0.7 : -40 + 110 * (u - 0.7) / 0.3; }

// trilha = borda do cartão no sentido horário, cantos com raio r; devolve x, y (relativos
// ao canto de cima à esquerda do cartão), a (ângulo, rad) e reta (o trecho é reto) e falta
// (quanto falta até o fim do trecho reto, pra cena saber se cabe)
function perimetro(w, h, r) { return 2 * (w - 2 * r) + 2 * (h - 2 * r) + 2 * Math.PI * r; }
function trilha(w, h, dist, r) {
  const arco = Math.PI * r / 2, lw = w - 2 * r, lh = h - 2 * r, per = 2 * lw + 2 * lh + 4 * arco;
  let d = ((dist % per) + per) % per;
  const seg = [
    [lw, u => ({ x: r + u, y: 0, a: 0 }), true],
    [arco, u => { const th = -Math.PI / 2 + u / r; return { x: w - r + r * Math.cos(th), y: r + r * Math.sin(th), a: th + Math.PI / 2 }; }],
    [lh, u => ({ x: w, y: r + u, a: Math.PI / 2 }), true],
    [arco, u => { const th = u / r; return { x: w - r + r * Math.cos(th), y: h - r + r * Math.sin(th), a: th + Math.PI / 2 }; }],
    [lw, u => ({ x: w - r - u, y: h, a: Math.PI }), true],
    [arco, u => { const th = Math.PI / 2 + u / r; return { x: r + r * Math.cos(th), y: h - r + r * Math.sin(th), a: th + Math.PI / 2 }; }],
    [lh, u => ({ x: 0, y: h - r - u, a: 1.5 * Math.PI }), true],
    [arco, u => { const th = Math.PI + u / r; return { x: r + r * Math.cos(th), y: r + r * Math.sin(th), a: th + Math.PI / 2 }; }],
  ];
  for (const [len, f, reta] of seg) {
    if (d <= len) { const p = f(d); p.reta = !!reta; p.andou = d; p.falta = len - d; return p; }
    d -= len;
  }
  return { x: r, y: 0, a: 0, reta: true, andou: 0, falta: lw };
}

module.exports = { ROUPAS, registrarRoupas, spriteClawd, corBraco, desenhaClawd, ferramenta, andando, pulando, golpe, trilha, perimetro, BRACOS };
