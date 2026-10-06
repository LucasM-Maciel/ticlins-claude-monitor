'use strict';
// Evento épico do tema Padrão (a cada 25 bugs pisados): BUG KAIJU, um filme de monstro de
// 19,2 s. O céu acima do cartão vira um pôr do sol vermelho e uma cidadezinha de pixel sobe da
// borda de cima, dos dois lados do Clawd; o chão treme e o bug do Padrão, gigante, sobe por
// trás do cartão (só aparece o que passa da borda). Ele ruge e cospe ácido: o Clawd pula por
// cima do raio e um prédio desmorona. O Clawd brilha, cresce 3x, troca golpes com ele e acaba
// como sempre: pisa. O kaiju achata, fica vermelho e vira uma nuvem de fumaça gigante; o Clawd
// volta pro lugar dele, encolhe, a cidade desce e o céu some.
//
// Tudo em DIPs da janela (setTransform na escala), cartão em m.host.cartao, chão = borda de
// cima do cartão. O Clawd sai da pose dele (no fim, o mesmo desenho do Clawd parado, no mesmo
// lugar). O quadro é função do tempo: sorteios na semente da cena, tremor = ruído de t.
// Prontos 1x: o céu (com o sol), os prédios e as artes do kaiju; o kaiju passa por uma lona
// que acaba na borda do cartão (o "atrás do cartão").
const { DEG, lim, sai, entra, tela, cache, arte, tingida, rng } = require('./comum');
const { desenhaClawd } = require('./clawd');

const DUR = 19.2;
const KP = 2, CP = 1.5, SG = 3.2;   // DIPs por pixel do kaiju e da cidade (a do Clawd); o tamanho do Clawd gigante
const AC = 32, CHAO_K = 29;         // o pé do kaiju na arte: meio do casco, linha do chão
// a coreografia (s desde o começo da cena)
const PASSOS = [2.0, 2.6, 3.2, 3.8, 4.4];   // o chão treme: passos do kaiju embaixo da terra
const SUBIDA = [[3.2, 0], [3.5, 0.3], [3.8, 0.3], [4.1, 0.62], [4.4, 0.62], [4.75, 0.93], [5.2, 1]];  // um tranco por passo
const OLHOS = 4.95, RUGE = 5.6, CARGA = 6.6, RAIO = 7.2, RAIO_VEL = 125;
const PODER = 9.0, CRESCE = [[9.55, 9.8, 1.9], [9.95, 10.2, 2.6], [10.3, 10.5, SG]];  // [começa, chega, tamanho]
const MORDE = 11.3, BATE = 11.55, SOCOS = [12.18, 12.78], SALTA = 13.6, TOPO = 14.2, MERGULHA = 14.35, PISA = 14.58;
const EXPLODE = 15.0, VOLTA = 15.7, ENCOLHE = [[16.7, 16.85, 2.4], [17.0, 17.15, 1.7], [17.3, 17.45, 1]];
const DESCE = 17.1, CEU_SAI = [17.6, 18.7], PULINHO = [18.45, 18.75];

const linhaDoTempo = [
  [0, 'o céu vira um pôr do sol vermelho'], [0.35, 'a cidadezinha sobe da borda do cartão'], [2.0, 'o chão treme: passos'],
  [3.2, 'o BUG KAIJU sobe por trás do cartão, aos trancos'], [4.95, 'os olhos vermelhos acendem'], [5.6, 'rugido: anel de choque, clarão, !!'],
  [6.6, 'carrega o ácido'], [7.2, 'raio de ácido: o Clawd pula por cima, um prédio desmorona'], [9.0, 'o Clawd brilha e cresce 3x'],
  [11.3, 'o kaiju morde, o Clawd segura'], [12.18, 'dois socos: o kaiju cambaleia e fica tonto'], [13.6, 'salto bem alto'],
  [14.58, 'PISA: o kaiju achata e fica vermelho'], [15.0, 'fumaça gigante; o Clawd volta pro lugar'], [15.9, 'vitória: confete'],
  [16.7, 'encolhe'], [17.1, 'a cidade desce e o céu some'], [DUR, 'fim: segue andando'],
];

// ---------- desenhos ----------
// o bug do Padrão (BUG/COR_BUG do tema), gigante: casco com a listra, cabeça preta, olho
// vermelho bravo; 2 quadros das pernas ('p' de cá, 'q' de lá). Olha pra esquerda.
const KAIJU_A = [
  '..........................wwwwxxwwwwww..............',
  '.......................wwwwwwwvxxvvvvvvvv...........',
  '.....................wwwwwvvvvvxxvvvvvvvvvv.........',
  '....................wwwwwvvvvvvvxxvvvvvvvvvv........',
  '...................wwwWWvvvvvvvvxxvvvvvvvmmvv.......',
  '..................wwwWwvvvvvvvvvvxxvvvvvvmmvvv......',
  '.................wwwvvvvvvvvvvvvvxxvxxvvvvmmvvx.....',
  '................wvvvvvvvvvvvvvvvvvxxvvvvvvmmvvvx....',
  '...........bbbbbbbvvvvvvvvvvvvvvvvxxvvvvvvvmmvvx....',
  '........bbbccccaaaccvkvvvvvvvvvvvvvxxvvvvvvmmvvvx...',
  '......bbaccaakkaccacckvvvxxvvvvvvvvvxxvvvvvmmvvvx...',
  '.....baaaaakkkaaacaackvvvxxvvvvvvvvvxxvvvvvvmxvvx...',
  '....baaaakkarraaaaaaakvvvvvvvvvvvvvvvxxvvvvvmxvvx...',
  '...aaaaakarrrraaaaaaakvvvvvvvvvvvvvvvxxvvvvvvmmmx...',
  '...aaaaaarRrrraaaaaaakvvvvvvvvvvvvvvvvxxvvvvvmmmx...',
  '...aaaaarRrrrdaaaaaaakvvvvvvvvvvvvvvvvxxvvvvmmmmx...',
  '...aaaaarrrrddaaaaaaakvvvvvxvvvvvvvxxvvxxvmmmmmmx...',
  '...kaaaaardddaaaaaaaakvvvvvvvvvvvvvxvvvxxmmmmmmmx...',
  '...kkaaaaaaaaaaaaaaaakvvvvvvvvvvvvvvvvmmxxmmmmmx....',
  '....kkaaaaapppaaaaaavkvvvvvvvvvvvvvvmmmmxxmmmmmxq...',
  '......aaapppppaaaaavvkvpppvvvvvvvvvmppmmmxxmmmxqq...',
  '.......ppppppaaaa.xxxpppppxxxxxxxxxxppppxxxxxx.qqq..',
  '......pppppqq........ppp...qqq.......ppppp......qq..',
  '.....pppp..qq.......ppp...qqq..........pppp.....qq..',
  '.....ppp..qqq.......ppp...qq.............ppp....qqq.',
  '.....pp...qq........pp....qq.............ppp.....qq.',
  '....ppp...qq........pp....qq..............ppp....qq.',
  '....ppp...................qq..............ppp.......',
  '....pp....................qq...............pp.......',
];
const KAIJU_B = [
  ...KAIJU_A.slice(0, 19),
  '....kkaaaappppaaaaaavkvvvvvvvvvvvvvvmmmmxxmmmmmx....',
  '......apppppppaaaaavvkvvppvvvvvvvvvmpppppxxmmmx.....',
  '......pppppaaaaaa.xxxxppppxxxxxxxxxxppppppppxxqq....',
  '......ppp..qqq.......pppp..qq..........ppppppqqq....',
  '......pp..qqq.......pppp...qq.............ppp.qqq...',
  '.....ppp..qq........pp.....qq..............ppp.qq...',
  '.....ppp..qq.......ppp.....qq..............ppp.qq...',
  '.....pp..qqq.......ppp.....qq...............pp.qqq..',
  '.........qq........pp...........................qq..',
  '.........qq........pp...........................qq..',
];
const OLHO_K = KAIJU_A.map(l => l.replace(/[^rRd]/g, '.'));  // o olho sozinho: por cima da silhueta
// a pinça de cima (a de baixo é ela de ponta-cabeça); dobradiça em (12,5; 3,5), presas 'f'
const PINCA = [
  '......aaaaaa..',
  '....aabbbbbbaa',
  '..aaab....aaaa',
  '.aaf.f..f..aaa',
  '.af...........',
  '.f............',
];
const COR_K = { v: '#65A30D', w: '#A3E635', W: '#D9F99D', m: '#4D7C0F', x: '#365314', a: '#111827', b: '#374151', c: '#1F2937', k: '#030712', r: '#EF4444', R: '#FCA5A5', d: '#991B1B', p: '#111827', q: '#030712', f: '#E7E5E4' };
// pisado: vermelho como o COR_BUG_V do tema
const COR_KV = { v: '#EF4444', w: '#FCA5A5', W: '#FEE2E2', m: '#DC2626', x: '#991B1B', a: '#450A0A', b: '#7F1D1D', c: '#5C0F0F', k: '#2B0505', r: '#FEE2E2', R: '#FFFFFF', d: '#FCA5A5', p: '#450A0A', q: '#2B0505', f: '#FEE2E2' };
const EXCL = ['kkk.kkk', 'kyk.kyk', 'kyk.kyk', 'kyk.kyk', 'kkk.kkk', 'kyk.kyk', 'kkk.kkk'];  // "!!"
const ESTRELA = ['..y..', '.yyy.', 'yyWyy', '.yyy.', '..y..'];
const CONFETE = ['#D77757', '#FACC15', '#22C55E', '#60A5FA', '#F472B6', '#E5E7EB'];
const FUMACA = ['#E5E7EB', '#9CA3AF', '#D1D5DB', '#F3F4F6'];
const COR_CLAWD = '#D77757', CONTORNO = '#2A0F1F';
// a cidade: silhueta roxa contra o pôr do sol, janelas acesas
const PREDIO = { corpo: '#2A1638', beira: '#4A2A5C', sombra: '#1C0D26', apagada: '#3D2A4F', luz: ['#FACC15', '#FDE68A', '#FDBA74'] };
// o céu: faixas de baixo (horizonte) pra cima, [altura em DIPs acima da borda, cor]
const FAIXAS = [[0, '#FB923C'], [10, '#F97316'], [22, '#EA580C'], [36, '#DC2626'], [52, '#B91C1C'], [70, '#9F1239'], [92, '#881337'], [118, '#6B1D4F'], [150, '#4C1D5E'], [190, '#2E1046']];

// ---------- tempo ----------
const faixa = (t, a, b) => lim((t - a) / (b - a), 0, 1);
const suave = u => u * u * (3 - 2 * u);
const pulso = (t, a, b) => (t >= a && t < b ? Math.sin(Math.PI * (t - a) / (b - a)) : 0);
// 0 antes de a, sobe até b, fica, desce de c a d
const janela = (t, a, b, c, d) => (t < a || t >= d ? 0 : t < b ? suave(faixa(t, a, b)) : t < c ? 1 : 1 - suave(faixa(t, c, d)));
// valor por pontos-chave [t, v], suave entre eles
function curvaK(t, kfs) {
  if (t <= kfs[0][0]) return kfs[0][1];
  for (let i = 0; i < kfs.length - 1; i++) {
    const [a, va] = kfs[i], [b, vb] = kfs[i + 1];
    if (t <= b) return va + (vb - va) * suave((t - a) / (b - a));
  }
  return kfs[kfs.length - 1][1];
}
// o tremor do chão: ronco enquanto o kaiju vem e impulsos [começa, dura, força em DIPs]
const IMPULSOS = [
  ...PASSOS.map((p, i) => [p, 0.45, 1.1 + 0.35 * i]), [RUGE, 0.9, 2.6], ...CRESCE.map(([, b], i) => [b, 0.35, 1 + 0.6 * i]),
  [BATE, 0.3, 1.4], [SOCOS[0], 0.3, 1.8], [SOCOS[1], 0.45, 2.6], [PISA, 0.8, 4], [EXPLODE, 0.6, 3], [VOLTA, 0.4, 2.2],
];
function forcaTremor(P, t) {
  let k = 0.8 * janela(t, 1.9, 3.2, 5.0, 5.5);
  for (const [t0, d, a] of IMPULSOS) { const e = t - t0; if (e >= 0 && e < d) k += a * (1 - e / d) * (1 - e / d); }
  const e = t - P.tHit;
  if (e >= 0 && e < 0.5) k += 1.4 * (1 - e / 0.5) * (1 - e / 0.5);
  return k;
}
// ruído de t, um por coisa (i): dois senos que não batem; no pixel da tela
const ruido = (t, i) => 0.6 * Math.sin(t * 89 + i * 1.7) + 0.4 * Math.sin(t * 53.3 + i * 4.1);
const noPixel = (v, esc) => Math.round(v * esc) / esc;

// ---------- pixels (o colar do minecraft-dragao.js): colar a lona e o céu direto na tela ----------
const VISTAS = new WeakMap();
function i32(t) {
  let v = VISTAS.get(t.pixels);
  if (!v) { v = new Int32Array(t.pixels.buffer, t.pixels.byteOffset, t.pixels.length); VISTAS.set(t.pixels, v); }
  return v;
}
function mul(p, k) {
  let rb = (p & 0xff00ff) * k + 0x800080;
  rb = ((rb + ((rb >>> 8) & 0xff00ff)) >>> 8) & 0xff00ff;
  let ag = ((p >>> 8) & 0xff00ff) * k + 0x800080;
  ag = (ag + ((ag >>> 8) & 0xff00ff)) & 0xff00ff00;
  return rb | ag;
}
// cola a imagem em (x, y) pixels da tela, por cima, com alfa; regiao = [w, h] só esse pedaço de
// cima à esquerda (senão, os trechos não vazios guardados em img.trechos). clarao (0-255): puxa
// pro branco (o clarão do céu, sem outra imagem). Fora do raster, cai no drawImage.
function colar(g, img, x, y, alfa = 1, regiao = null, clarao = 0) {
  const tl = g.canvas, ga = Math.round(lim(alfa, 0, 1) * 255);
  if (!ga) return;
  if (!tl || !(tl.pixels instanceof Uint32Array)) {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = alfa;
    if (regiao) g.drawImage(img, 0, 0, regiao[0], regiao[1], x, y, regiao[0], regiao[1]); else g.drawImage(img, x, y);
    g.restore(); return;
  }
  const D = i32(tl), W = tl.width, H = tl.height, S = i32(img), w = img.width, kc = clarao | 0;
  const linha = (sy, x0, x1) => {
    const ty = sy + y;
    if (ty < 0 || ty >= H) return;
    const a = Math.max(x0, -x), b = Math.min(x1, W - x), os = sy * w, od = ty * W + x;
    for (let i = a; i < b; i++) {
      let s = S[os + i];
      if (s === 0) continue;
      if (kc) { const sa = s >>> 24; s = (mul(s, 255 - kc) + mul((sa << 24) | (sa << 16) | (sa << 8) | sa, kc)) | 0; }
      if (ga !== 255) s = mul(s, ga);
      const sa = s >>> 24, d = D[od + i];
      D[od + i] = sa === 255 || d === 0 ? s : (s + mul(d, 255 - sa)) | 0;
    }
  };
  if (regiao) { for (let sy = 0; sy < regiao[1]; sy++) linha(sy, 0, regiao[0]); return; }
  const t = img.trechos;
  for (let k = 0; k < t.length; k += 3) linha(t[k], t[k + 1], t[k + 2]);
}

// ---------- o palco: o que depende do cartão e de onde o Clawd estava (cache com teto) ----------
const PALCOS = cache(4);
function palcoDe(m, semente) {
  const [W, H] = m.host.janela || [380, 440], [cx, cy, cw] = m.host.cartao, casa = m.pose();
  const chave = [W, H, cx, cy, cw, casa.x, casa.y, semente].map(v => Math.round(v * 100)).join(',');
  const pronto = PALCOS.get(chave);
  if (pronto) return pronto;
  const r = rng(semente);
  const hx = lim(casa.x, cx + 8, cx + cw - 8);   // o Clawd está na reta de cima (o tema garante)
  const s = hx <= cx + cw / 2 ? 1 : -1;          // o kaiju sobe do lado com mais espaço, olhando pro Clawd
  const ka = hx + s * Math.min(150, s > 0 ? cx + cw - 30 - hx : hx - cx - 30);  // o pé do kaiju (meio do casco)
  const fx = ka - s * 118;                       // onde o Clawd gigante luta: o kaiju na ponta do soco
  const frente = ka - s * 74;                    // a ponta das pinças
  const vao = s * (frente - hx);
  // o prédio que o ácido derruba: entre os dois, ou atrás do Clawd se ele está colado no kaiju
  const bt = lim(vao >= 56 ? hx + s * Math.max(26, vao * 0.5) : hx - s * 30, cx + 12, cx + cw - 12);
  // o raio varre o chão de perto das pinças pra trás do Clawd; o Clawd pula quando ele chega e
  // o raio apaga antes de ele pousar (a linha da boca ao chão não pode atravessar ele no chão)
  const g0 = frente - s * 2;
  const tRaio = x => RAIO + Math.abs(x - g0) / RAIO_VEL;
  const tPulo = Math.max(RAIO - 0.15, tRaio(hx) - 0.28), tPouso = tPulo + 0.7;
  let g1 = lim(s > 0 ? Math.min(hx, fx, bt) - 18 : Math.max(hx, fx, bt) + 18, cx + 4, cx + cw - 4);
  if (tRaio(g1) > tPouso - 0.14) g1 = g0 - s * (tPouso - 0.14 - RAIO) * RAIO_VEL;
  const P = {
    W, H, cx, cy, cw, hx, s, ka, fx, bt, g0, g1, tPulo, tPouso, tHit: tRaio(bt), tApaga: tRaio(g1),
    // o salto final: o mais alto que cabe (o Clawd gigante, girando, inteiro na janela)
    yTopo: Math.max(cy - 58 - 72, 6 + 22 * SG),
  };
  P.cidade = cidadeDe(P, r);
  P.poeira = poeiraDe(P, r);
  P.trilha = Array.from({ length: 18 }, (_, i) => { const x = g0 + (P.g1 - g0) * (i + 0.5) / 18; return { x, t: tRaio(x), f: r() * 6 }; });
  P.confete = Array.from({ length: 40 }, () => ({ vx: (r() - 0.5) * 150, vy: -(50 + r() * 80), cor: CONFETE[Math.floor(r() * 6)], gira: Math.floor(r() * 4), t0: r() * 0.1 }));
  // onde o pé do Clawd fica em cima do casco do kaiju (acompanha o kaiju tonto e achatado)
  P.pisada = tt => { const [x, y] = kaijuPt(P, kaijuEm(P, Math.min(tt, EXPLODE - 1e-6)), 30, 1); return [x, y - P.cy]; };
  return PALCOS.set(chave, P);
}

// ---------- o céu: pôr do sol em faixas de pixel, sol atrás do kaiju, nuvens e estrelas ----------
// Pronto 1x por janela/cartão/escala, conta direta nos pixels (como o céu do dragão) e aos
// pedaços nos primeiros quadros, quando ele ainda não aparece. Some antes da borda da janela
// (lá a janelinha é transparente) e acaba na borda de cima do cartão (o horizonte).
const CEUS = cache(2);
const RGB = h => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const FAIXAS_RGB = FAIXAS.map(([h, c]) => [h, RGB(c)]);
const SOL = [RGB('#FFF4D6'), RGB('#FDE68A'), RGB('#FCD34D')], NUVEM = [RGB('#5B1037'), RGB('#FB7185')], ESTRELA_C = RGB('#FDE68A');
function ceuPronto(P, esc, linhas = Infinity) {
  const chave = [P.W, P.H, P.cx, P.cy, P.cw, P.ka, esc].join(',');
  const Wd = Math.round(P.W * esc), Hd = Math.min(Math.round(P.H * esc), Math.ceil(P.cy * esc - 0.5));
  const o = CEUS.get(chave) || CEUS.set(chave, { tela: tela(Wd, Math.max(1, Hd)), feitas: 0, trechos: [] });
  if (o.feitas >= Hd) return o.tela;
  const px = i32(o.tela), { cx, cy, cw, ka, s } = P;
  const topo = Math.max(0, cy - 300), sx = ka + s * 10, sy = cy - 8, RS = 28;
  // nuvens compridas: [altura da base, meio, largura]; 4 fileiras de célula, a de baixo acesa pelo sol
  const nuvens = [[64, cx + 52, 74], [90, cx + 178, 96], [126, cx + 24, 84], [164, cx + 192, 70]].map(([nh, xm, w]) =>
    [[nh, xm - w / 2 + 3, xm + w / 2 - 2, 1], [nh + CP, xm - w / 2, xm + w / 2, 0], [nh + 2 * CP, xm - w / 2 + 5, xm + w / 2 - 7, 0], [nh + 3 * CP, xm - w * 0.18, xm + w * 0.2, 0]]);
  const fim = Math.min(Hd, o.feitas + linhas);
  for (let y = o.feitas; y < fim; y++) {
    const Y = (y + 0.5) / esc, h = cy - Y, iy = Math.floor(h / CP), hc = (iy + 0.5) * CP;  // a célula de 1,5 DIP
    const ay = 0.96 * suave(lim((Y - topo) / 70, 0, 1));
    let b = 0;
    while (b + 1 < FAIXAS_RGB.length && FAIXAS_RGB[b + 1][0] <= hc) b++;
    let ini = -1;
    for (let x = 0; x <= Wd; x++) {
      let p = 0;
      if (x < Wd && ay > 0) {
        const X = (x + 0.5) / esc, ix = Math.floor(X / CP), xc = (ix + 0.5) * CP;
        const ax = X < cx ? lim(1 - (cx - X) / 60, 0, 1) : X > cx + cw ? lim(1 - (X - cx - cw) / Math.max(1, P.W - cx - cw), 0, 1) : 1;
        const al = ay * suave(ax);
        if (al * 255 >= 0.5) {
          // faixa, com 2 células de xadrez na emenda
          let c = FAIXAS_RGB[b][1];
          if (b > 0 && hc - FAIXAS_RGB[b][0] < 2 * CP && (ix + iy) % 2) c = FAIXAS_RGB[b - 1][1];
          // o sol (com as listras do pôr do sol na metade de baixo) e o halo dele
          const dx = xc - sx, dy = hc - (cy - sy), d = Math.sqrt(dx * dx + dy * dy);
          const listra = (hc > 2 && hc < 4.5) || (hc > 8 && hc < 10.5) || (hc > 15 && hc < 16.5);
          if (d < RS && !listra) c = d < RS - 7 ? SOL[0] : d < RS - 2.5 ? SOL[1] : SOL[2];
          else if (d < RS + 6 && (ix + iy) % 2 && !listra) c = SOL[2];
          for (const nv of nuvens) for (const [nh, n0, n1, acesa] of nv) if (hc >= nh && hc < nh + CP && xc > n0 && xc < n1) c = NUVEM[acesa ? 1 : 0];
          // estrelas no alto (sorteio fixo por célula)
          if (h > 140) {
            let n = (Math.imul(ix, 374761393) + Math.imul(iy, 668265263)) | 0;
            n = Math.imul(n ^ (n >>> 13), 1274126177); n ^= n >>> 16;
            if ((n >>> 0) % 170 === 0) c = ESTRELA_C;
          }
          const a = Math.round(al * 255);
          p = (a << 24) | (Math.round(c[0] * al) << 16) | (Math.round(c[1] * al) << 8) | Math.round(c[2] * al);
        }
      }
      if (p) { px[y * Wd + x] = p; if (ini < 0) ini = x; } else if (ini >= 0) { o.trechos.push(y, ini, x); ini = -1; }
    }
  }
  o.feitas = fim;
  if (fim < Hd) return null;
  o.tela.trechos = Int32Array.from(o.trechos);
  o.trechos = null;
  return o.tela;
}

// ---------- a cidade ----------
// prédios de pixel (1,5 DIP) na borda de cima do cartão: baixinhos onde o kaiju sobe (o casco
// aparece por cima), mais altos no resto; um deles é o que o ácido derruba
let PREDIOS = 0;  // id de cada prédio (a chave da versão branca dele no cache do tingida)
function cidadeDe(P, r) {
  const { cx, cw, hx, ka, s, bt } = P;
  const k0 = s > 0 ? ka - 64 : ka - 40, k1 = s > 0 ? ka + 40 : ka + 64;
  const lista = [], maxd = Math.max(hx - cx, cx + cw - hx);
  const novo = (x, w, h, alvo) => {
    const topos = ['reto', 'reto', 'degrau', 'antena', 'caixa'];
    const b = { x, w, h, alvo, topo: alvo ? 'antena' : topos[Math.floor(r() * topos.length)], fase: r() * 2, luz: 1.0 + 0.9 * r() };
    const d = Math.abs(x + w * CP / 2 - hx) / maxd;
    b.sobe = 0.35 + 0.8 * d; b.desce = DESCE + 0.75 * (1 - d);
    b.janelas = [];
    for (let j = 2; j < h - 1; j += 2) for (let i = 1; i < w - 1; i += 2) b.janelas.push([i, j, r() < 0.62 ? PREDIO.luz[Math.floor(r() * 3)] : null]);
    lista.push(b);
  };
  let x = cx + 3;
  while (x < cx + cw - 3 - 6 * CP) {
    let w = 6 + Math.floor(r() * 6);
    if (x + w * CP > cx + cw - 3) w = Math.floor((cx + cw - 3 - x) / CP);
    if (x + w * CP > bt - 10 && x < bt + 10) {  // a vaga do prédio do ácido
      novo(bt - 9, 12, 16, true);
      x = bt + 9 + CP * Math.floor(r() * 2);
      continue;
    }
    const meio = x + w * CP / 2, noKaiju = meio > k0 && meio < k1;
    novo(x, w, noKaiju ? 5 + Math.floor(r() * 3) : 8 + Math.floor(r() * 13), false);
    x += w * CP + CP * Math.floor(r() * 3);
  }
  for (const b of lista) { b.spr = [predioArte(b, false), predioArte(b, true)]; b.id = 'predio' + ++PREDIOS; }
  return lista;
}
// o desenho de um prédio, 1 pixel por letra: teto em cima (altura extra), janelas, sombra
function predioArte(b, acesas) {
  const extra = { antena: 5, caixa: 3, degrau: 2 }[b.topo] || 0, c = tela(b.w, b.h + extra), k = c.getContext('2d');
  const f = (cor, x, y, w, h) => { k.fillStyle = cor; k.fillRect(x, y, w, h); };
  f(PREDIO.corpo, 0, extra, b.w, b.h);
  f(PREDIO.sombra, b.w - 1, extra, 1, b.h);
  f(PREDIO.beira, 0, extra, b.w - 1, 1);
  if (b.topo === 'degrau') { f(PREDIO.corpo, 2, 0, b.w - 4, 2); f(PREDIO.beira, 2, 0, b.w - 4, 1); }
  if (b.topo === 'antena') f(PREDIO.beira, Math.floor(b.w / 2), 0, 1, extra);
  if (b.topo === 'caixa') { f(PREDIO.beira, 1, 0, 3, 2); f(PREDIO.sombra, 1, 2, 1, 1); f(PREDIO.sombra, 3, 2, 1, 1); }
  for (const [i, j, luz] of b.janelas) f(acesas && luz ? luz : PREDIO.apagada, i, extra + j, 1, 1);
  b.extra = extra;
  return c;
}
// um prédio com o pé afundado 'baixa' DIPs: só o que fica acima da borda do cartão
function pintaPredio(g, P, img, x, baixa) {
  const alt = img.height * CP - baixa;
  if (alt <= 0) return;
  g.drawImage(img, 0, 0, img.width, alt / CP, x, P.cy - alt, img.width * CP, alt);
}
function pintaCidade(g, P, t, k, esc) {
  for (let i = 0; i < P.cidade.length; i++) {
    const b = P.cidade[i];
    if (t < b.sobe) continue;
    const alt = (b.h + b.extra) * CP;
    let baixa = alt * (1 - sai(faixa(t, b.sobe, b.sobe + 0.35))) + alt * entra(faixa(t, b.desce, b.desce + 0.35));
    const dx = noPixel(k * 0.5 * ruido(t, i + 3), esc);
    baixa += noPixel(k * 0.35 * Math.abs(ruido(t, i + 11)), esc);
    let x = b.x + dx, img = b.spr[t >= b.luz ? 1 : 0];
    // o rugido apaga e acende as luzes
    if (t >= RUGE && t < RUGE + 0.6 && ruido(Math.floor(t / 0.07), i) > 0.2) img = b.spr[0];
    if (b.alvo && t >= P.tHit) {
      const e = t - P.tHit;
      if (e < 0.12) img = tingida(b.spr[1], '#FFFFFF', b.id);
      baixa += alt * entra(faixa(e, 0.15, 0.95));
      x += e < 0.95 ? noPixel(Math.sin(e * 70), esc) : 0;
    }
    pintaPredio(g, P, img, x, baixa);
    if (b.topo === 'antena' && baixa < alt && Math.floor((t + b.fase) / 0.55) % 2) {  // luzinha piscando
      g.fillStyle = '#EF4444'; g.fillRect(x + Math.floor(b.w / 2) * CP, P.cy - alt + baixa, CP, CP);
    }
  }
}
// o que sobra do prédio do ácido: entulho com ácido borbulhando
function pintaEntulho(g, P, t) {
  const b = P.cidade.find(c => c.alvo);
  const e = t - P.tHit - 0.6;
  if (!b || e < 0) return;
  const baixa = 6 * CP * (1 - sai(lim(e / 0.3, 0, 1))) + 6 * CP * entra(faixa(t, b.desce, b.desce + 0.35));
  const x = b.x - CP;
  const monte = [[0, 1], [1, 2], [2, 3], [4, 4], [6, 3], [8, 4], [10, 2], [12, 1]];
  for (const [i, h] of monte) {
    const alt = h * CP - baixa;
    if (alt > 0) { g.fillStyle = i % 4 ? PREDIO.corpo : PREDIO.beira; g.fillRect(x + i * CP, P.cy - alt, 2 * CP, alt); }
  }
  if (baixa > 0) return;
  for (let j = 0; j < 4; j++) {  // bolhas verdes
    const f = (t * 1.3 + j / 4) % 1;
    g.globalAlpha = 1 - f; g.fillStyle = j % 2 ? '#4ADE80' : '#A3E635';
    g.fillRect(x + (2 + j * 3) * CP, P.cy - 3 * CP - f * 8, CP, CP);
  }
  g.globalAlpha = 1;
}

// ---------- poeira do tremor ----------
function poeiraDe(P, r) {
  const { cx, cw, ka, s } = P, lista = [];
  const solta = (t0, x0, x1, n, forca = 1) => {
    for (let i = 0; i < n; i++) {
      lista.push({ t0: t0 + r() * 0.12, x: x0 + (x1 - x0) * r(), vx: (r() - 0.5) * 14 * forca, vy: -(8 + r() * 12) * forca, vida: 0.55 + r() * 0.45, tam: (1.5 + r() * 1.5) * Math.sqrt(forca), cor: ['#E7D7C9', '#C4B5A5', '#A8A29E'][Math.floor(r() * 3)] });
    }
  };
  for (const p of PASSOS) solta(p, cx + 4, cx + cw - 4, 9);
  for (let t = 3.2; t < 5.2; t += 0.09) solta(t, ka - 60, ka + 40, 1, 1.2);  // o kaiju subindo levanta terra
  solta(RUGE, cx + 4, cx + cw - 4, 12);
  return lista;
}
function pintaPoeira(g, P, t, extra) {
  for (const p of P.poeira.concat(extra)) {
    const e = t - p.t0;
    if (e < 0 || e >= p.vida) continue;
    g.globalAlpha = 0.85 * (1 - e / p.vida); g.fillStyle = p.cor;
    g.fillRect(p.x + p.vx * e - p.tam / 2, P.cy + p.vy * e + 10 * e * e - p.tam, p.tam, p.tam);
  }
  g.globalAlpha = 1;
}
// as nuvens de poeira dos pousos do gigante (sorteio fixo: SORTE)
const SORTE = rng(2610);
const POUSO = Array.from({ length: 14 }, (_, i) => ({ dx: (i / 13 - 0.5) * 2, vy: -(6 + SORTE() * 10), vida: 0.5 + SORTE() * 0.4, tam: 2 + SORTE() * 2.5, cor: ['#E7D7C9', '#C4B5A5', '#A8A29E'][i % 3] }));
const poeiraPouso = (t0, x, larg) => POUSO.map(p => ({ ...p, t0, x: x + p.dx * larg, vx: p.dx * 30 }));

// ---------- o kaiju ----------
// pose no instante t (null = ainda embaixo do cartão ou já explodiu); dy inclui o quanto falta subir
function kaijuEm(P, t) {
  if (t < SUBIDA[0][0] || t >= EXPLODE) return null;
  const s = P.s;
  const k = { dx: 0, dy: 66 * (1 - curvaK(t, SUBIDA)), tilt: 0, sx: 1, sy: 1, perna: 0, ab: 0.2 + 0.04 * Math.sin(t * 3), olhos: 0, sil: 1 - faixa(t, OLHOS, OLHOS + 0.5), branco: 0, verm: false, tonto: 0, vento: 1 };
  if (t >= OLHOS) k.olhos = 1 + 0.9 * (1 - faixa(t, OLHOS, OLHOS + 0.35)) + 0.12 * Math.sin(t * 7);
  const depressa = t < 5.3 || (t >= MORDE && t < 11.9) || (t >= SOCOS[0] && t < 13.3);
  k.perna = Math.floor(t / (depressa ? 0.12 : 0.45)) % 2;
  // rugido: empina, abre as pinças
  const ruge = janela(t, RUGE - 0.25, RUGE, RUGE + 0.85, RUGE + 1.05);
  k.tilt += 9 * ruge; k.ab += 0.6 * ruge; k.vento += 2 * ruge;
  // carga e raio: inclina pra frente, boca aberta
  const raio = janela(t, CARGA, CARGA + 0.4, P.tApaga, P.tApaga + 0.35);
  k.tilt -= 6 * raio; k.ab += 0.3 * raio + 0.08 * raio * Math.sin(t * 40);
  // o Clawd cresce: recua de susto
  const susto = janela(t, CRESCE[2][1], CRESCE[2][1] + 0.12, 10.8, 11.1);
  k.dx += 6 * susto; k.tilt += 4 * susto;
  if (t >= 10.65 && t < MORDE) k.ab += 0.22 * Math.abs(Math.sin(t * 24));  // chia (bate as pinças)
  // morde: avança, abre e fecha as pinças na batida
  k.dx -= 18 * curvaK(t, [[MORDE, 0], [BATE, 1], [BATE + 0.3, 0]]);
  k.tilt -= 6 * janela(t, MORDE, BATE, BATE, BATE + 0.3);
  if (t >= MORDE && t < BATE) k.ab = 0.2 + 0.45 * faixa(t, MORDE, BATE - 0.08);
  else if (t >= BATE && t < BATE + 0.2) k.ab = 0.05;
  // os socos: vai pra trás e empina; o segundo deixa tonto até a pisada
  k.dx += curvaK(t, [[SOCOS[0], 0], [SOCOS[0] + 0.1, 11], [SOCOS[0] + 0.45, 5], [SOCOS[1], 5], [SOCOS[1] + 0.12, 18], [SOCOS[1] + 0.5, 12]]);
  k.tilt += curvaK(t, [[SOCOS[0], 0], [SOCOS[0] + 0.1, 10], [SOCOS[0] + 0.45, 2], [SOCOS[1], 2], [SOCOS[1] + 0.12, 16], [SOCOS[1] + 0.5, 7]]);
  for (const h of SOCOS) if (t >= h && t < h + 0.1) k.branco = 1 - (t - h) / 0.1;
  if (t >= SOCOS[1] + 0.3 && t < PISA) {
    k.tonto = faixa(t, SOCOS[1] + 0.3, SOCOS[1] + 0.6);
    k.tilt += 4 * Math.sin(t * 6) * k.tonto; k.dx += 2 * Math.sin(t * 4.3) * k.tonto;
    k.ab = 0.3 + 0.1 * Math.sin(t * 5); k.vento = 2.5;
    k.olhos *= Math.floor(t / 0.09) % 3 ? 1 : 0.4;
  }
  // pisado: achata (pelo pé), alarga, fica vermelho e treme
  if (t >= PISA) {
    k.sy = Math.max(0.34, 1 - (t - PISA) / 0.08 * 0.66); k.sx = 1 + 0.3 * (1 - k.sy);
    k.verm = true; k.olhos = 0; k.ab = 0.7; k.tilt = 0; k.vento = 3;
    k.dx += Math.sin(t * 90) * 0.8;
    if (t < PISA + 0.07) k.branco = 1 - (t - PISA) / 0.07;
  }
  k.dx *= s;  // + = longe do Clawd
  return k;
}
// um ponto da arte do kaiju (pixels da arte) na janela
function kaijuPt(P, k, ax, ay) {
  const lx = P.s * KP * k.sx * (ax - AC), ly = KP * k.sy * (ay - CHAO_K), a = P.s * k.tilt * DEG, c = Math.cos(a), sn = Math.sin(a);
  return [P.ka + k.dx + lx * c - ly * sn, P.cy + k.dy + lx * sn + ly * c];
}
// antena: gomos de 1 pixel da arte saindo do alto da cabeça, curvando pra frente e balançando
function antena(g, x, y, n, t, k, cor, fase) {
  let ang = -0.6 * Math.PI;
  g.fillStyle = cor;
  for (let i = 0; i < n; i++) {
    ang -= 0.022 + 0.03 * k.vento * Math.sin(t * (2.2 + k.vento) + fase - i * 0.35) * (i / n);
    x += Math.cos(ang); y += Math.sin(ang);
    g.fillRect(Math.round(x), Math.round(y), 1, 1);
  }
  g.fillStyle = k.verm ? '#7F1D1D' : '#374151';
  g.fillRect(Math.round(x) - 1, Math.round(y) - 1, 2, 2);
}
// a lona do kaiju: ele inteiro numa tela à parte que termina na borda do cartão; colada por cima
const LONA = { tela: null };
const MX = 116, MY = 120;  // DIPs da lona em volta do pé do kaiju (pra frente/trás e pra cima)
function pintaKaiju(g, P, k, t, esc) {
  const ox = Math.floor((P.ka - MX) * esc), oy = Math.max(0, Math.floor((P.cy - MY) * esc));
  const w = Math.ceil(2 * MX * esc) + 2, h = Math.ceil(P.cy * esc - 0.5) - oy;  // linhas com o centro acima da borda
  if (h <= 0) return;
  if (!LONA.tela || LONA.tela.width < w || LONA.tela.height < h) LONA.tela = tela(Math.max(w, LONA.tela ? LONA.tela.width : 0), Math.max(h, LONA.tela ? LONA.tela.height : 0));
  const L = LONA.tela, c = L.getContext('2d');
  c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.globalCompositeOperation = 'source-over';
  c.clearRect(0, 0, w, h);
  c.setTransform(esc, 0, 0, esc, -ox, -oy);
  c.save();
  c.translate(P.ka + k.dx, P.cy + k.dy); c.rotate(P.s * k.tilt * DEG); c.scale(P.s * KP * k.sx, KP * k.sy); c.translate(-AC, -CHAO_K);
  const cor = k.verm ? COR_KV : COR_K;
  antena(c, 15, 8, 13, t, k, cor.q, 1.3);
  c.drawImage(arte(k.perna ? KAIJU_B : KAIJU_A, cor), 0, 0);
  antena(c, 12, 8, 15, t, k, cor.a, 0);
  for (const [linhas, hy, lado] of [[PINCA, 3.5, -1], [PINCA.slice().reverse(), 2.5, 1]]) {
    c.save(); c.translate(6, 17.5 + lado * 0.5); c.rotate(-lado * k.ab); c.drawImage(arte(linhas, cor), -12.5, -hy); c.restore();
  }
  c.restore();
  // silhueta contra o sol (até os olhos acenderem) e o branco das pancadas: tinta por cima da lona
  const tinta = k.branco > 0 ? [`rgba(255,255,255,${k.branco.toFixed(3)})`] : k.sil > 0 ? [`rgba(28,10,34,${k.sil.toFixed(3)})`] : null;
  if (tinta) { c.save(); c.setTransform(1, 0, 0, 1, 0, 0); c.globalCompositeOperation = 'source-atop'; c.fillStyle = tinta[0]; c.fillRect(0, 0, w, h); c.restore(); }
  if (k.olhos > 0 && !k.verm) {
    c.save();
    c.translate(P.ka + k.dx, P.cy + k.dy); c.rotate(P.s * k.tilt * DEG); c.scale(P.s * KP * k.sx, KP * k.sy); c.translate(-AC, -CHAO_K);
    if (k.sil > 0) c.drawImage(arte(OLHO_K, COR_K), 0, 0);
    c.globalCompositeOperation = 'lighter';
    luz(c, 'olho', 10.5, 15, 7 * Math.min(1.6, k.olhos), Math.min(1, k.olhos * 0.8));
    c.restore();
  }
  colar(g, L, ox, oy, 1, [w, h]);
}

// ---------- luzes (gradiente pronto 1x, esticado) ----------
let LUZES = null;
// chao: até onde desce (o resto não passa da borda do cartão: o texto dele fica limpo)
function luz(g, nome, x, y, raio, alfa, chao = Infinity) {
  if (alfa <= 0 || raio <= 0) return;
  if (!LUZES) {
    LUZES = {};
    const fazer = (n, cores) => {
      const c = tela(32, 32), k = c.getContext('2d'), gr = k.createRadialGradient(16, 16, 0, 16, 16, 16);
      cores.forEach(([p, cor]) => gr.addColorStop(p, cor));
      k.fillStyle = gr; k.fillRect(0, 0, 32, 32);
      LUZES[n] = c;
    };
    fazer('olho', [[0, 'rgba(255,120,120,1)'], [0.3, 'rgba(239,68,68,.8)'], [1, 'rgba(239,68,68,0)']]);
    fazer('verde', [[0, 'rgba(220,252,231,1)'], [0.35, 'rgba(74,222,128,.75)'], [1, 'rgba(34,197,94,0)']]);
    fazer('ouro', [[0, 'rgba(255,236,140,.55)'], [1, 'rgba(255,236,140,0)']]);  // o brilho do desenhaClawd
    fazer('branca', [[0, 'rgba(255,255,255,1)'], [0.4, 'rgba(255,247,214,.7)'], [1, 'rgba(255,247,214,0)']]);
  }
  const a0 = g.globalAlpha;
  g.globalAlpha = a0 * lim(alfa, 0, 1);
  const h = Math.min(2 * raio, chao - (y - raio));
  if (h > 0) g.drawImage(LUZES[nome], 0, 0, 32, 32 * h / (2 * raio), x - raio, y - raio, 2 * raio, h);
  g.globalAlpha = a0;
}

// ---------- o Clawd ----------
// onde ele está e o que faz: x na janela, y = altura do pé (<= 0), S = tamanho, giro (graus, em
// volta do meio dele), rot/sy (como no desenhaClawd), soco = quanto o braço estica, brilho, aura
function clawdEm(P, t) {
  const { hx, fx, s } = P;
  const c = { x: hx, y: 0, S: 1, giro: 0, rot: 0, sy: 1, olhos: 'abertos', bracos: null, soco: 0, brilho: 0, aura: 0, branco: 0 };
  if (t < P.tPulo) {
    if (t >= 2.0 && t < CARGA) c.olhos = 'cima';
    for (const p of PASSOS) c.y -= 2.5 * pulso(t, p + 0.02, p + 0.22);
    c.y -= 7 * pulso(t, RUGE + 0.04, RUGE + 0.34);  // susto do rugido
    if (t >= RUGE + 0.04 && t < RUGE + 0.6) c.olhos = 'abertos';
    if (t >= CARGA + 0.2) c.sy = 1 - 0.12 * faixa(t, CARGA + 0.2, P.tPulo);  // agacha pro pulo
    return c;
  }
  if (t < P.tPouso) {  // pula por cima do raio, dando uma cambalhota
    const u = faixa(t, P.tPulo, P.tPouso);
    c.x = hx + (fx - hx) * u; c.y = -30 * Math.sin(Math.PI * u); c.giro = 360 * Math.sign(fx - hx || s) * suave(u);
    return c;
  }
  // de volta pra casa depois da pisada (o resto em casa, encolhendo)
  if (t >= EXPLODE) {
    c.S = SG;
    for (const [a, b, alvo] of ENCOLHE) if (t >= a) c.S = t >= b ? alvo : c.S + (alvo - c.S) * suave(faixa(t, a, b));
    if (t < VOLTA) {
      const u = faixa(t, EXPLODE, VOLTA), [x0, y0] = P.pisada(t);
      c.x = x0 + (hx - x0) * u; c.y = y0 * (1 - u) - 46 * Math.sin(Math.PI * u); c.giro = -360 * s * suave(u);
      c.olhos = 'fechados';
    } else {
      c.sy = 1 - 0.2 * pulso(t, VOLTA, VOLTA + 0.16) + 0.06 * pulso(t, 16.0, 16.3) - 0.06 * pulso(t, 16.3, 16.5);
      if (t >= 15.95 && t < 16.65) { c.bracos = [-4.5, -4.5]; c.olhos = 'fechados'; }
      for (const [a] of ENCOLHE) if (t >= a && t < a + 0.12) c.branco = 1 - (t - a) / 0.12;
      c.y = -4 * pulso(t, PULINHO[0], PULINHO[1]);
    }
    c.aura = c.S > 1.05 ? (c.S - 1) / (SG - 1) : 0; c.brilho = c.aura * 0.8;
    return c;
  }
  c.x = fx;
  // pousou: firma, aperta os olhos e carrega
  c.sy = 1 - 0.18 * pulso(t, P.tPouso, P.tPouso + 0.16);
  if (t >= P.tPouso + 0.5) c.olhos = 'fechados';
  c.brilho = faixa(t, PODER, PODER + 0.5);
  c.aura = faixa(t, PODER + 0.2, CRESCE[0][0]);
  for (const [a, b, alvo] of CRESCE) if (t >= a) c.S = t >= b ? alvo : c.S + (alvo - c.S) * saiPassa(faixa(t, a, b));
  for (const [a] of CRESCE) if (t >= a && t < a + 0.12) c.branco = 1 - (t - a) / 0.12;
  if (t >= PODER && t < CRESCE[2][1] + 0.2) c.sy *= 1 + 0.04 * Math.sin(t * 30);  // tremendo de força
  if (t >= CRESCE[2][1]) {
    c.brilho = 1 - 0.6 * faixa(t, CRESCE[2][1], 11.2);
    c.olhos = 'abertos';
    c.sy *= 1 + 0.025 * Math.sin((t - CRESCE[2][1]) * 4);  // respirando
  }
  // a mordida: segura e é empurrado
  c.x -= s * 8 * curvaK(t, [[BATE, 0], [BATE + 0.1, 1], [BATE + 0.45, 0]]);
  c.rot -= s * 6 * janela(t, BATE, BATE + 0.08, BATE + 0.15, BATE + 0.45);
  // os socos: puxa (inclina pra trás), estica o braço e avança
  for (const h of SOCOS) {
    const puxa = janela(t, h - 0.24, h - 0.1, h - 0.1, h - 0.04), vai = janela(t, h - 0.08, h, h + 0.08, h + 0.3);
    c.rot += s * (-9 * puxa + 7 * vai);
    c.x += s * 12 * vai;
    c.soco = Math.max(c.soco, vai);
    if (puxa > 0 || vai > 0) c.olhos = 'fechados';
  }
  // o salto final: agacha, sobe dando uma cambalhota, para no alto, mergulha e pisa
  if (t >= SALTA - 0.25) {
    c.sy *= 1 - 0.22 * pulso(t, SALTA - 0.25, SALTA + 0.02);
    c.olhos = t < MERGULHA ? 'cima' : 'fechados';
  }
  if (t >= SALTA) {
    const [xp, yp] = P.pisada(PISA);
    const xt = fx + (xp - fx) * 0.55, yt = P.yTopo - P.cy;
    if (t < TOPO) { const u = sai(faixa(t, SALTA, TOPO)); c.x = fx + (xt - fx) * u; c.y = yt * u; c.giro = 360 * s * suave(faixa(t, SALTA, TOPO)); }
    else if (t < MERGULHA) { c.x = xt + (xp - xt) * 0.1 * faixa(t, TOPO, MERGULHA); c.y = yt - 2 * pulso(t, TOPO, MERGULHA); }
    else if (t < PISA) { const u = entra(faixa(t, MERGULHA, PISA)); c.x = xt + (xp - xt) * (0.1 + 0.9 * u); c.y = yt + (yp - yt) * u; }
    else { [c.x, c.y] = P.pisada(t); c.sy = 1 - 0.25 * pulso(t, PISA, PISA + 0.18); }
  }
  return c;
}
// sai e passa um pouco (o crescer dá um pulinho no tamanho)
const saiPassa = u => 1 + 2.2 * (u - 1) ** 3 + 1.2 * (u - 1) ** 2;
// o braço do soco: estica pro lado do kaiju (pixels do Clawd, 1,5 DIP), com o punho na ponta
function braco(lado, soco, cor) {
  return g => {
    const ext = 5 * soco, x = lado > 0 ? 12 : -12 - ext;
    g.fillStyle = cor; g.fillRect(x, -9, ext, 3);
    g.fillRect(lado > 0 ? 12 + ext : -12 - ext - 4.5, -10.5, 4.5, 4.5);
  };
}
function pintaClawd(g, T0, P, c, k, t, esc) {
  g.save();
  g.setTransform(T0.a, T0.b, T0.c, T0.d, T0.e, T0.f);
  // tremor: o pé pula do chão (nunca entra no cartão); no ar, nada
  let dx = 0, dy = 0;
  if (k > 0 && c.y === 0) { dx = noPixel(k * 0.5 * ruido(t, 1), esc); dy = -noPixel(k * 0.5 * Math.abs(ruido(t, 8)), esc); }
  g.translate(c.x - P.hx + dx, c.y + dy);
  const S = c.S, meio = 7.5 * S;
  if (c.brilho > 0) luz(g, 'ouro', 0, -8 * S, 24 * S, c.brilho, -(c.y + dy));
  if (c.aura > 0) aura(g, S, t, c.aura);
  if (c.giro) { g.translate(0, -meio); g.rotate(c.giro * DEG); g.translate(0, meio); }
  if (S !== 1) g.scale(S, S);
  const p = { rot: c.rot, olhos: c.olhos, bracos: c.bracos || (c.soco ? [0, 0] : undefined) };
  if (c.sy !== 1) p.sy = c.sy;
  // contorno escuro: o laranja dele some no pôr do sol (aparece e some junto com o céu)
  const ct = S > 1.3 ? 1 : c.contorno;
  if (ct > 0) {
    const o = 1 / S;
    for (const [ox, oy] of [[-o, 0], [o, 0], [0, -o], [0, o]]) {
      desenhaClawd(g, { ...p, x: ox, y: oy, branco: CONTORNO, alfa: ct, mao: c.soco ? braco(P.s, c.soco, CONTORNO) : undefined });
    }
  }
  if (c.soco) p.mao = braco(P.s, c.soco, COR_CLAWD);
  if (c.branco > 0) p.tinta = { cor: '#FFFFFF', a: c.branco };
  desenhaClawd(g, p);
  g.restore();
}
// aura laranja: faíscas subindo pela borda do Clawd (no referencial do pé dele)
const AURA = Array.from({ length: 22 }, () => ({ x: (SORTE() - 0.5) * 2, fase: SORTE(), v: 0.6 + SORTE() * 0.5, cor: ['#FDBA74', '#FB923C', '#FACC15', '#FED7AA'][Math.floor(SORTE() * 4)] }));
function aura(g, S, t, a) {
  const a0 = g.globalAlpha;
  for (const p of AURA) {
    const f = (t * p.v + p.fase) % 1, lado = Math.abs(p.x);
    g.globalAlpha = a0 * a * (1 - f) * 0.9; g.fillStyle = p.cor;
    const q = 1.5 * Math.max(1, S * 0.5);
    g.fillRect(p.x * 13 * S - q / 2, -(lado * 6 + 2) * S - f * 12 * S, q, q);
  }
  g.globalAlpha = a0;
}

// ---------- efeitos (DIPs da janela) ----------
const FAISCAS = Array.from({ length: 14 }, () => { const a = SORTE() * 2 * Math.PI, v = 50 + SORTE() * 60; return { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 20, vida: 0.3 + SORTE() * 0.25, cor: ['#FFFFFF', '#FDE047', '#FACC15', '#FB923C'][Math.floor(SORTE() * 4)], tam: 1.5 + SORTE() * 1.5 }; });
function faiscas(g, x, y, e, forca = 1) {
  if (e < 0 || e > 0.6) return;
  for (const p of FAISCAS) {
    if (e >= p.vida) continue;
    const k = (1 - Math.exp(-5 * e)) / 5 * forca;
    g.globalAlpha = 1 - e / p.vida; g.fillStyle = p.cor;
    const q = p.tam * forca;
    g.fillRect(x + p.vx * k - q / 2, y + p.vy * k + 40 * e * e - q / 2, q, q);
  }
  g.globalAlpha = 1;
}
// anel de choque: quadradinhos numa roda que cresce (achata = elipse no chão)
function anel(g, x, y, e, dur, r0, r1, achata, cor, n = 36) {
  if (e < 0 || e >= dur) return;
  const u = e / dur, r = r0 + (r1 - r0) * sai(u), q = 3.5 * (1 - u) + 1;
  g.globalAlpha = 1 - u; g.fillStyle = cor;
  for (let i = 0; i < n; i++) {
    const a = i / n * 2 * Math.PI;
    g.fillRect(x + Math.cos(a) * r - q / 2, y + Math.sin(a) * r * achata - q / 2, q, q);
  }
  g.globalAlpha = 1;
}
// a fumaça do bug do tema (8 quadradinhos numa roda que sobem e crescem), k vezes maior, e mais
// uma nuvem de quadrados por cima (a explosão do kaiju: o mesmo desenho, gigante)
const VOOS = [[-30, -60], [-12, -80], [10, -75], [28, -55], [-22, -30], [20, -35], [0, -90], [34, -20]];
const NUVEM_K = Array.from({ length: 30 }, () => ({ ox: (SORTE() - 0.5) * 2, oy: -SORTE(), vx: (SORTE() - 0.5) * 2, vy: -(0.4 + SORTE()), atraso: SORTE() * 0.25, tam: 0.5 + SORTE() * 0.6, cor: SORTE() < 0.2 ? '#FCA5A5' : FUMACA[Math.floor(SORTE() * 4)] }));
function fumaca(g, cx, cy, d, k, dur, nuvem = 0) {
  if (d < 0 || d >= dur) return;
  const u = d / dur;
  g.save(); g.globalAlpha *= 1 - u * u;
  const w = (3 + 3 * u) * k;
  VOOS.forEach(([vx, vy], i) => {
    g.fillStyle = i % 2 ? '#9CA3AF' : '#E5E7EB';
    g.fillRect(cx + vx * (0.06 + 0.18 * u) * k - w / 2, cy + vy * (0.06 + 0.12 * u) * k - 6 * u * k - w / 2, w, w);
  });
  for (const p of nuvem ? NUVEM_K : []) {
    const e = d - p.atraso;
    if (e < 0) continue;
    const v = sai(Math.min(1, e / (dur - p.atraso))), q = p.tam * nuvem * (0.5 + 0.7 * v);
    g.fillStyle = p.cor;
    g.fillRect(cx + (p.ox * 0.45 + p.vx * 0.4 * v) * nuvem * 3 - q / 2, cy + (p.oy * 0.6 + p.vy * 0.5 * v) * nuvem * 2.2 - q / 2, q, q);
  }
  g.restore();
}
// pedaços voando com gravidade (prédio, casco)
const CACOS = Array.from({ length: 12 }, () => ({ vx: (SORTE() - 0.5) * 70, vy: -(30 + SORTE() * 60), tam: 1.5 + Math.floor(SORTE() * 2) * 1.5, gira: SORTE() }));
function cacos(g, x, y, e, cores, forca = 1) {
  if (e < 0 || e > 1.1) return;
  CACOS.forEach((p, i) => {
    const yy = y + p.vy * forca * e + 110 * e * e;
    if (yy > y + 2) return;  // caiu atrás da borda
    g.globalAlpha = 1 - e / 1.1; g.fillStyle = cores[i % cores.length];
    g.fillRect(x + p.vx * forca * e, yy, p.tam * forca, p.tam * forca);
  });
  g.globalAlpha = 1;
}
// o raio de ácido: da boca até o chão, 3 camadas que tremem, pulsos correndo e respingos no chão
const GOTAS = Array.from({ length: 10 }, () => ({ vx: (SORTE() - 0.5) * 50, vy: -(25 + SORTE() * 35), fase: SORTE() }));
function raioAcido(g, a, b, t, forca) {
  const dx = b[0] - a[0], dy = b[1] - a[1], L = Math.hypot(dx, dy);
  if (L < 1 || forca <= 0) return;
  g.save(); g.translate(a[0], a[1]); g.rotate(Math.atan2(dy, dx));
  const w = forca * (1 + 0.18 * Math.sin(t * 61));
  g.globalAlpha = 0.4; g.fillStyle = '#22C55E'; g.fillRect(0, -5 * w, L, 10 * w);
  g.globalAlpha = 1; g.fillStyle = '#4ADE80'; g.fillRect(0, -2.5 * w, L, 5 * w);
  g.fillStyle = '#F0FDF4'; g.fillRect(0, -1 * w, L, 2 * w);
  g.fillStyle = '#DCFCE7';
  for (let i = 0; i < 4; i++) { const f = (t * 3.2 + i / 4) % 1; g.fillRect(f * L - 2, -2 * w, 4, 4 * w); }
  g.restore();
  g.globalAlpha = forca;
  for (const p of GOTAS) {
    const e = (t + p.fase * 0.35) % 0.35;
    g.fillStyle = p.fase < 0.5 ? '#4ADE80' : '#A3E635';
    g.fillRect(b[0] + p.vx * e - 1, b[1] + p.vy * e + 150 * e * e - 2, 2, 2);
  }
  g.globalAlpha = 1;
}
// pixel art pequena (!!, estrela) no tamanho q por pixel, centrada
function pixelArte(g, linhas, cores, x, y, q) {
  const img = arte(linhas, cores);
  g.drawImage(img, x - img.width * q / 2, y - img.height * q / 2, img.width * q, img.height * q);
}
function confete(g, P, x, y, e) {
  if (e < 0 || e > 2.2) return;
  for (const c of P.confete) {
    const f = e - c.t0;
    if (f < 0 || f > 2) continue;
    g.globalAlpha = f > 1.5 ? (2 - f) / 0.5 : 1; g.fillStyle = c.cor;
    const xx = x + c.vx * f, yy = y + c.vy * f + 80 * f * f;
    if ((Math.floor(f * 10) + c.gira) % 2) g.fillRect(xx, yy, 3, 1.5); else g.fillRect(xx, yy, 1.5, 3);
  }
  g.globalAlpha = 1;
}
function brilhinhos(g, x, y, w, h, t, n, a = 1) {
  for (let i = 0; i < n; i++) {
    const f = (t * 1.4 + i / n) % 1, v = Math.sin(Math.PI * f);
    if (v < 0.2) continue;
    const q = Math.floor(t * 1.4 + i / n), px = x + ((i * 37 + q * 13) % 10) / 10 * w, py = y + ((i * 53 + q * 29) % 10) / 10 * h;
    g.globalAlpha = v * a;
    pixelArte(g, ESTRELA, { y: '#FDE68A', W: '#FFFFFF' }, px, py, 0.8 + 0.6 * v);
  }
  g.globalAlpha = 1;
}

// =====================================================================================
// O quadro
// =====================================================================================
function desenhar(g, t, m, semente) {
  const P = palcoDe(m, semente), esc = m.host.escala || 1, T0 = g.getTransform();
  const k = forcaTremor(P, t), kz = kaijuEm(P, t);
  g.save();
  // céu (pronto aos pedaços nos 0,2 s antes de aparecer; depois, de uma vez)
  const kc = t < CEU_SAI[0] ? faixa(t, 0.2, 1.4) : 1 - faixa(t, CEU_SAI[0], CEU_SAI[1]);
  const ceu = ceuPronto(P, esc, t < 0.2 ? Math.ceil(P.cy * esc / 5) : Infinity);
  if (ceu && kc > 0) {
    const flash = Math.max(janela(t, RUGE, RUGE + 0.03, RUGE + 0.05, RUGE + 0.22), janela(t, PISA, PISA + 0.02, PISA + 0.05, PISA + 0.3), 0.8 * janela(t, EXPLODE, EXPLODE + 0.03, EXPLODE + 0.06, EXPLODE + 0.3), 0.5 * janela(t, OLHOS, OLHOS + 0.03, OLHOS + 0.05, OLHOS + 0.2));
    colar(g, ceu, 0, 0, kc, null, Math.round(200 * flash));
  }
  g.setTransform(esc, 0, 0, esc, 0, 0);
  // o kaiju (atrás da cidade, cortado na borda do cartão)
  const kk = kz && { ...kz, dx: kz.dx + noPixel(k * 0.6 * ruido(t, 5), esc), dy: kz.dy + noPixel(k * 0.4 * Math.abs(ruido(t, 6)), esc) };
  if (kk) {
    pintaKaiju(g, P, kk, t, esc);
    g.setTransform(esc, 0, 0, esc, 0, 0);
    // tonto: estrelinhas rodando em volta da cabeça
    if (kk.tonto > 0) {
      const [x, y] = kaijuPt(P, kk, 12, 4);
      for (let i = 0; i < 3; i++) {
        const a = t * 5 + i * 2.1;
        g.globalAlpha = kk.tonto;
        pixelArte(g, ESTRELA, { y: '#FACC15', W: '#FFFFFF' }, x + Math.cos(a) * 13, y + Math.sin(a) * 4, 1.2);
      }
      g.globalAlpha = 1;
    }
  }
  // a cidade e o que o ácido deixou
  pintaCidade(g, P, t, k, esc);
  pintaEntulho(g, P, t);
  // bolhas no rastro do raio
  for (const b of P.trilha) {
    const e = t - b.t;
    if (e < 0 || e > 1.2) continue;
    g.globalAlpha = 1 - e / 1.2; g.fillStyle = (b.f | 0) % 2 ? '#4ADE80' : '#86EFAC';
    g.fillRect(b.x + Math.sin(e * 9 + b.f) * 1.5, P.cy - 2 - e * 7, 1.5, 1.5);
  }
  g.globalAlpha = 1;
  // boca verde carregando e o raio (na frente da cidade: ele bate no chão do lado de cá)
  if (kk) {
    const boca = kaijuPt(P, kk, 1, 17.5);
    const carga = janela(t, CARGA, RAIO, P.tApaga, P.tApaga + 0.15);
    if (carga > 0) {
      luz(g, 'verde', boca[0], boca[1], 6 + 6 * carga + Math.sin(t * 40), 0.85 * carga);
      if (t < RAIO) for (let i = 0; i < 6; i++) {  // o ácido juntando na boca
        const f = (t * 2.2 + i / 6) % 1, a = i * 1.05;
        g.globalAlpha = f; g.fillStyle = i % 2 ? '#4ADE80' : '#A3E635';
        g.fillRect(boca[0] + Math.cos(a) * 22 * (1 - f) - 1, boca[1] + Math.sin(a) * 16 * (1 - f) - 1, 2, 2);
      }
      g.globalAlpha = 1;
    }
    if (t >= RAIO && t < P.tApaga + 0.15) {
      const gx = P.g0 + (P.g1 - P.g0) * faixa(t, RAIO, P.tApaga);
      raioAcido(g, boca, [gx, P.cy], t, t < RAIO + 0.06 ? faixa(t, RAIO, RAIO + 0.06) : 1 - faixa(t, P.tApaga, P.tApaga + 0.15));
      if (t < RAIO + 0.12) luz(g, 'branca', boca[0], boca[1], 16, 1 - faixa(t, RAIO, RAIO + 0.12));
    }
  }
  // o prédio do ácido: clarão, cacos e fumaça
  const bt = P.cidade.find(c => c.alvo);
  if (bt) {
    const xm = bt.x + bt.w * CP / 2;
    luz(g, 'verde', xm, P.cy - 14, 20, 1 - faixa(t - P.tHit, 0, 0.3) - (t < P.tHit ? 1 : 0), P.cy);
    cacos(g, xm, P.cy - 18, t - P.tHit, [PREDIO.corpo, PREDIO.beira, '#FACC15']);
    fumaca(g, xm, P.cy - 4, t - P.tHit - 0.1, 2.2, 1.3, 9);
  }
  // poeira: passos, subida, pousos
  const extra = t > P.tPouso - 0.1 && t < P.tPouso + 1 ? poeiraPouso(P.tPouso, P.fx, 10) : t > CRESCE[2][1] && t < VOLTA + 1.2 ? [
    ...poeiraPouso(CRESCE[2][1], P.fx, 34), ...poeiraPouso(PISA, P.pisada(PISA)[0], 50), ...poeiraPouso(VOLTA, P.hx, 34)] : [];
  pintaPoeira(g, P, t, extra);
  // o Clawd
  const c = clawdEm(P, t);
  c.contorno = kc;
  pintaClawd(g, T0, P, c, k, t, esc);
  g.setTransform(esc, 0, 0, esc, 0, 0);
  // rugido: anéis de choque e o "!!" em cima do Clawd
  if (kz && t >= RUGE - 0.1 && t < RUGE + 1.2) {
    const boca = kaijuPt(P, kz, 2, 16);
    for (let i = 0; i < 3; i++) anel(g, boca[0], boca[1], t - RUGE - i * 0.25, 0.6, 6, 120, 0.8, i % 2 ? '#FFFFFF' : '#FDE68A', 40);
  }
  if (t >= RUGE + 0.05 && t < RUGE + 1.0) {
    const e = t - RUGE - 0.05, q = 2 * (e < 0.12 ? sai(e / 0.12) * 1.3 : 1 + 0.3 * Math.max(0, 1 - (e - 0.12) / 0.15));
    g.globalAlpha = e > 0.8 ? 1 - (e - 0.8) / 0.15 : 1;
    pixelArte(g, EXCL, { k: '#1F2937', y: '#FACC15' }, P.hx + Math.sin(e * 50) * (e < 0.3 ? 1 : 0), P.cy - 32, q);
    g.globalAlpha = 1;
  }
  // o poder: anéis dourados quando cresce
  for (const [a] of CRESCE) anel(g, P.fx, P.cy - 7.5 * SG, t - a, 0.45, 8, 70, 0.7, '#FDE68A', 28);
  if (c.aura > 0 && t < EXPLODE) brilhinhos(g, c.x - 12 * c.S, P.cy - 18 * c.S, 24 * c.S, 16 * c.S, t, 4, c.aura);
  // a mordida e os socos: faíscas onde bate
  if (kz) {
    if (t >= BATE && t < BATE + 0.6) faiscas(g, P.fx + P.s * 36, P.cy - 24, t - BATE, 1);
    SOCOS.forEach((h, i) => { if (t >= h && t < h + 0.6) { const [x, y] = kaijuPt(P, kaijuEm(P, h), 10, 13); faiscas(g, x, y, t - h, 1.2 + 0.5 * i); luz(g, 'branca', x, y, 14 + 8 * i, 1 - faixa(t, h, h + 0.15)); } });
    if (t >= TOPO && t < MERGULHA + 0.05) brilhinhos(g, c.x - 20, P.yTopo - 70, 40, 30, t, 3);
  }
  // a pisada: clarão, onda no chão, faíscas; a explosão: fumaça gigante e cacos do casco
  if (t >= PISA - 0.02) {
    const [xp] = P.pisada(PISA);
    if (t < PISA + 0.25) luz(g, 'branca', xp, P.cy - 22, 50, 1 - faixa(t, PISA, PISA + 0.25), P.cy + 6);
    anel(g, xp, P.cy, t - PISA, 0.7, 10, 150, 0.12, '#FDE68A', 44);
    faiscas(g, xp, P.cy - 22, t - PISA, 2);
    const ke = kaijuPt(P, kaijuEm(P, EXPLODE - 1e-6), 26, 16);
    fumaca(g, ke[0], P.cy - 4, t - EXPLODE, 6, 1.5, 34);
    cacos(g, ke[0], P.cy - 12, t - EXPLODE, ['#EF4444', '#FCA5A5', '#991B1B', '#450A0A'], 1.6);
    anel(g, ke[0], P.cy - 14, t - EXPLODE, 0.5, 10, 110, 0.85, '#FFFFFF', 40);
    if (t >= EXPLODE && t < EXPLODE + 0.2) luz(g, 'branca', ke[0], P.cy - 18, 60, 1 - faixa(t, EXPLODE, EXPLODE + 0.2), P.cy + 6);
  }
  // vitória: confete e brilhinhos; encolhendo: brilhinhos
  confete(g, P, P.hx, P.cy - 7.5 * SG - 20, t - 15.95);
  if (t >= ENCOLHE[0][0] && t < ENCOLHE[2][1] + 0.3) brilhinhos(g, P.hx - 14 * c.S, P.cy - 16 * c.S - 6, 28 * c.S, 16 * c.S, t, 5);
  g.restore();
}

// a trilha (som.js, 8-bit): o baixo do tubarão chegando, os passos, o rugido, o ácido, a luta e
// a vitória. O pulo e o prédio caindo dependem de onde o Clawd está (o palco)
const S = n => `sons-padrao/kaiju-${n}.wav`, VOLUME = 0.45;  // VOLUME: o nível dos avisos (−17 dB)
function sons(P) {
  return [
    [0.5, S('baixo1'), 0.6], [1.05, S('baixo2'), 0.6], [1.5, S('baixo1'), 0.65], [1.8, S('baixo2'), 0.65],
    ...[2.3, 2.9].map((t, i) => [t, S(`baixo${i + 1}`), 0.6]),
    ...PASSOS.map(t => [t, S('passo'), 0.9]),
    ...[3.5, 4.1, 4.75].map(t => [t, S('tranco'), 0.6]),
    [OLHOS, S('olhos'), 0.45], [RUGE, S('ruge'), 0.85], [CARGA, S('carga'), 0.45],
    [RAIO, S('raio'), 0.45, 1, Math.max(0.3, P.tApaga - RAIO + 0.1)], [P.tPulo, S('pulo'), 0.4], [P.tHit, S('desaba'), 0.65],
    [PODER, S('poder'), 0.5], ...CRESCE.map(([a], i) => [a, S('cresce'), 0.45, [1, 1.19, 1.41][i]]),
    [MORDE, S('morde'), 0.65], [BATE, S('soco'), 0.55], ...SOCOS.map(t => [t, S('soco'), 0.85]), [SOCOS[1] + 0.35, S('tonto'), 0.35],
    [SALTA, S('pulo'), 0.5, 0.8], [PISA, S('pisa'), 1], [EXPLODE, S('boom'), 0.8], [15.9, S('vitoria'), 0.55],
    ...ENCOLHE.map(([a], i) => [a, S('encolhe'), 0.4, [1, 1.12, 1.26][i]]), [DESCE, S('desce'), 0.55], [PULINHO[0], S('pulo'), 0.3, 1.4],
  ].map(([t, a, g, ...r]) => [t, a, g * VOLUME, ...r]);
}

module.exports = {
  linhaDoTempo,
  cena(m) {
    const semente = Math.floor(m.sorteio() * 4294967296);
    return {
      nome: 'epico', dur: DUR, espaco: { frente: 0, tras: 0 }, modos: ['andando'], sons: sons(palcoDe(m, semente)),
      quadro(g, t, mundo) { desenhar(g, t, mundo || m, semente); },
    };
  },
};
