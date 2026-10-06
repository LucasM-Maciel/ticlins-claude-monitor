'use strict';
// Evento raro do tema Minecraft (o tema chama a cada N mortes): o Ender Dragon, a versão A da prévia
// ("Batalha do End", 19,2 s). O céu arroxeia em volta do cartão e a borda vira pedra do
// End; dois cristais nos cantos curam o dragão; ele chega de longe e dá um rasante
// cuspindo o sopro; o Clawd rola, derruba os cristais com o arco e acerta 3 críticos; o
// dragão sobe soltando raios de luz e se desfaz, chove XP e cai o ovo, que teleporta
// quando o Clawd encosta; ele pega e volta pro lugar dele.
//
// O dragão é montado das faces do modelo do jogo (entity/enderdragon/dragon.png) em
// projeção oblíqua, como na prévia, mas:
// - a espinha não segue o caminho do voo (subindo na vertical ele virava uma coluna): o
//   corpo inclina no máximo ~24°, pescoço e rabo ondulam em volta dele, e pra virar ele
//   vai pro fundo (encolhe), fica de lado e volta;
// - a caixa dele é medida a cada quadro (o mesmo desenho num contexto que só soma pontos)
//   e ele é empurrado pra dentro da janela: asa nenhuma sai;
// - o contorno claro e o brilho roxo (o drop-shadow da prévia) são um borrão do alfa só
//   na caixa do dragão; o céu, a borda de pedra e o ovo com brilho ficam prontos 1x.
// Tudo em DIPs da janela (setTransform na escala), cartão em m.host.cartao.
const { DEG, lim, sai, entra, tela, cache, IMG, tingida, rng, layoutDe } = require('./comum');
const { desenhaClawd, andando, golpe } = require('./clawd');

const DUR = 19.2;
const E = 0.52;              // DIPs por pixel da textura, de perto (a prévia: 0,6 num cartão de 300; o de verdade tem ~250)
const KX = -0.3, KY = 0.5;   // projeção: (X pra frente, Y pra quem olha, Z pra cima) -> (X + KX*Y, -Z + KY*Y)
const MARGEM = 5;            // DIPs de brilho em volta do dragão: cabem na janela também
const ROXOS = ['#E64DFF', '#B31FE6', '#CC33FF', '#8A1FB3', '#D966FF'];

// a coreografia (s desde o começo da cena)
const CHEGA = 1.2, MORTE = 10.0, SOME = 13.95, HITS = [8.9, 9.4, 9.95];
const QUEBRA_R = 6.2, QUEBRA_L = 7.15, OVO_CAI = [13.9, 14.55], TELE = 16.15, PEGA = 17.3, GUARDA = 18.3;
const VIRADAS = [[3.35, 3.85, 1], [5.45, 5.95, -1], [7.15, 7.6, 1]];  // [começa, termina, lado depois]; chega olhando pra esquerda

const TEXTURAS = ['dragao', 'dragao_olhos', 'end_stone', 'ceu_end', 'cristal', 'cristal_raio', 'dragao_bola', 'flash', 'ovo_dragao',
  'boss_fundo', 'boss_barra', 'orbe', 'fonte', 'espada', 'arco', 'arco0', 'arco1', 'arco2', 'flecha', 'critico',
  ...Array.from({ length: 16 }, (_, i) => 'explosao' + i), ...Array.from({ length: 8 }, (_, i) => 'poof' + i)];

// ---------- ajudantes de tempo ----------
const faixa = (t, a, b) => lim((t - a) / (b - a), 0, 1);
const suave = u => u * u * (3 - 2 * u);
const pulso = (t, a, b) => (t >= a && t < b ? Math.sin(Math.PI * (t - a) / (b - a)) : 0);
// valor por pontos-chave [t, v]: reto entre eles, ou suave (sai e chega devagar)
function linhaK(t, kfs, f = u => u) {
  if (t <= kfs[0][0]) return kfs[0][1];
  for (let i = 0; i < kfs.length - 1; i++) {
    const [a, va] = kfs[i], [b, vb] = kfs[i + 1];
    if (t <= b) return va + (vb - va) * f((t - a) / (b - a));
  }
  return kfs[kfs.length - 1][1];
}
const curvaK = (t, kfs) => linhaK(t, kfs, suave);
function tremida(t, lista) {
  let dx = 0, dy = 0;
  for (const [t0, dur, amp] of lista) {
    const e = t - t0;
    if (e >= 0 && e < dur) { const k = amp * (1 - e / dur); dx += Math.sin(e * 83) * k; dy += Math.cos(e * 71) * k; }
  }
  return [dx, dy];
}
// voo por pontos-chave [t, x, y, s] (Catmull-Rom); s = 1 perto, menor = longe
function catmull(kfs, t) {
  const n = kfs.length;
  if (t <= kfs[0][0]) return [kfs[0][1], kfs[0][2], kfs[0][3]];
  if (t >= kfs[n - 1][0]) return [kfs[n - 1][1], kfs[n - 1][2], kfs[n - 1][3]];
  let i = 0;
  while (kfs[i + 1][0] < t) i++;
  const p0 = kfs[Math.max(0, i - 1)], p1 = kfs[i], p2 = kfs[i + 1], p3 = kfs[Math.min(n - 1, i + 2)], u = (t - p1[0]) / (p2[0] - p1[0]);
  const cr = k => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * u + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * u * u + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * u * u * u);
  return [cr(1), cr(2), cr(3)];
}

// ---------- sorteios (sementes fixas: o quadro é função do tempo) ----------
function fazExplosao(r, n) {
  return Array.from({ length: n }, (_, i) => ({ atraso: i ? r() * 0.22 : 0, vida: 0.38 + r() * 0.14, ox: i ? (r() - 0.5) * 22 : 0, oy: i ? (r() - 0.5) * 16 : 0, tam: 15 + r() * 10, cor: ['#999999', '#B3B3B3', '#CCCCCC', '#E6E6E6', '#FFFFFF'][Math.floor(r() * 5)] }));
}
const fazPontos = (r, n, vel = 26, vida = 0.7) => Array.from({ length: n }, () => ({ ox: (r() - 0.5) * 2, oy: (r() - 0.5) * 2, vx: (r() - 0.5) * vel, vy: (r() - 0.5) * vel - vel * 0.3, vida: vida * (0.6 + r() * 0.6), cor: ROXOS[Math.floor(r() * ROXOS.length)], tam: 2 + r() * 2.5 }));
const SORTE = rng(2026);
const BOOM_R = fazExplosao(SORTE, 9), BOOM_L = fazExplosao(SORTE, 9), BOOM_BOLA = fazExplosao(SORTE, 5);
const NUVEM = Array.from({ length: 46 }, () => ({ x: (SORTE() - 0.5) * 2, y: -SORTE() * 0.5, vy: -(3 + SORTE() * 9), fase: SORTE() * 6, vida: 0.7 + SORTE() * 0.9, cor: ROXOS[Math.floor(SORTE() * ROXOS.length)], tam: 2.5 + SORTE() * 3 }));
const RAIOS = Array.from({ length: 60 }, () => ({ a: SORTE() * 2 * Math.PI, v: (SORTE() - 0.5) * 0.8, L: 40 + SORTE() * 90, w: 0.04 + SORTE() * 0.07 }));
// chuva de XP: hora de saída, impulso e cor de cada orbe (84 = 28 níveis, 3 por nível)
const CHUVA = Array.from({ length: 84 }, (_, i) => ({ sai: 10.8 + 3 * (i / 84) + SORTE() * 0.1, vx: (SORTE() - 0.5) * 120, vy: -(40 + SORTE() * 90), ic: Math.floor(SORTE() * 6), fase: SORTE() * 9, voo: 0.5 + SORTE() * 0.3 }));
const CHEGADAS = CHUVA.map(o => o.sai + o.voo + 0.35).sort((a, b) => a - b);
const SUBIDAS = CHEGADAS.filter((_, i) => i % 3 === 2);
const FAISCAS = (() => { const r = rng(5), cinzas = ['#B3B3B3', '#CCCCCC', '#E6E6E6', '#FFFFFF']; return Array.from({ length: 12 }, () => { const a = r() * 2 * Math.PI, v = 60 * (0.5 + r() * 0.7); return { vx: Math.cos(a) * v, vy: Math.sin(a) * v - 15, vida: 0.35 + r() * 0.25, cor: cinzas[Math.floor(r() * 4)], tam: 3 + r() * 1.5 }; }); })();
const PONTOS = [9, 10, 11, 12].map(s => fazPontos(rng(s), 22));  // ovo some / ovo aparece / Clawd some / Clawd aparece

// =====================================================================================
// O dragão
// =====================================================================================
// faces [sx, sy, sw, sh] da textura: lado (u = comprimento), topo ('lat' = u é a largura), frente (u = largura)
const SEG = { lado: [192, 114, 10, 10], topo: [202, 104, 10, 10] };
const CAIXAS = {
  gomo: { L: 10, H: 10, W: 10, yc: 0, f: SEG, espinho: true },
  corpo: { L: 64, H: 24, W: 24, yc: 0, f: { lado: [0, 64, 64, 24], topo: [64, 0, 24, 64, 'lat'] }, costas: true },
  cabeca: { L: 16, H: 16, W: 16, yc: 0, f: { lado: [112, 46, 16, 16], topo: [128, 30, 16, 16], frente: [128, 46, 16, 16] }, olhos: [128, 46, 16, 16] },
  focinho: { L: 16, H: 5, W: 12, yc: 1.5, f: { lado: [176, 60, 16, 5], topo: [192, 44, 12, 16, 'lat'], frente: [192, 60, 12, 5] } },
  queixo: { L: 16, H: 4, W: 12, yc: 6, f: { lado: [176, 81, 16, 4], frente: [192, 81, 12, 4] } },
};
const PERNAS = { perna_tras: [0, 16, 16, 32, 55], perna_frente: [112, 112, 8, 24, 45] };  // [sx, sy, sw, sh, graus pra trás]

// gradientes prontos, de raio 1 no centro (cada uso é translate + scale): criar um por quadro
// refaz a tabela de cores dele
let GR = null;
function gradiente(nome) {
  if (!GR) {
    const k = tela(1, 1).getContext('2d');
    const f = (r0, ...cores) => { const x = k.createRadialGradient(0, 0, r0, 0, 0, 1); cores.forEach(([p, c]) => x.addColorStop(p, c)); return x; };
    GR = {
      olho: f(0.04, [0, 'rgba(250,190,255,1)'], [0.35, 'rgba(220,70,255,.75)'], [1, 'rgba(200,40,255,0)']),
      cristal: f(1 / 11, [0, 'rgba(255,120,255,.55)'], [1, 'rgba(255,120,255,0)']),
      bola: f(1 / 11, [0, 'rgba(220,90,255,.9)'], [1, 'rgba(220,90,255,0)']),
      acido: f(2 / 26, [0, 'rgba(190,60,255,.45)'], [1, 'rgba(190,60,255,0)']),
      raio: f(0, [0, 'rgba(255,255,255,1)'], [1, 'rgba(255,0,255,0)']),
    };
  }
  return GR[nome];
}
// a região da textura num paralelogramo: origem O, borda u (largura toda) e v (altura toda)
function quad(g, img, sx, sy, sw, sh, O, U, V) {
  g.save(); g.transform(U[0] / sw, U[1] / sw, V[0] / sh, V[1] / sh, O[0], O[1]);
  g.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh); g.restore();
}
// uma caixa do modelo (comprimento L, altura H, largura W, centro da altura em yc), vista de 3/4
function caixa(g, c, e, s) {
  const { L, H, W, yc, f } = c, img = IMG.dragao;
  const x0 = -L / 2 * e + KX * W / 2 * e, y0 = (yc - H / 2) * e + KY * W / 2 * e;  // canto de cima/trás da face de cá
  const fx = -KX * W * e, fy = -KY * W * e;                                       // da borda de cá pra de lá
  if (f.topo) {
    const [sx, sy, sw, sh, lat] = f.topo, O = [x0 + fx, y0 + fy], Lv = [L * e, 0], Wv = [-fx, -fy];
    if (lat) quad(g, img, sx, sy, sw, sh, O, Wv, Lv); else quad(g, img, sx, sy, sw, sh, O, Lv, Wv);
  }
  if (f.frente) { const [sx, sy, sw, sh] = f.frente; quad(g, img, sx, sy, sw, sh, [x0 + L * e + fx, y0 + fy], [-fx, -fy], [0, H * e]); }
  if (c.olhos) olhos(g, c.olhos, [x0 + L * e + fx, y0 + fy], fx, fy, H * e, s);
  if (f.lado) { const [sx, sy, sw, sh] = f.lado; quad(g, img, sx, sy, sw, sh, [x0, y0], [L * e, 0], [0, H * e]); }
  if (c.espinho) quad(g, img, 48, 6, 6, 4, [-3 * e, (yc - H / 2 - 4) * e], [6 * e, 0], [0, 4 * e]);
  if (c.costas) for (const dx of [-16, 0, 16]) quad(g, img, 220, 65, 12, 6, [(dx - 6) * e, (yc - H / 2 - 6) * e], [12 * e, 0], [0, 6 * e]);
}
// os olhos roxos (dragon_eyes) na cara, com brilho somado
function olhos(g, [sx, sy, sw, sh], O, fx, fy, alt, s) {
  quad(g, IMG.dragao_olhos, sx, sy, sw, sh, O, [-fx, -fy], [0, alt]);
  g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = gradiente('olho');
  for (const u of [2.5 / 16, 12.5 / 16]) {
    g.save(); g.translate(O[0] - fx * u, O[1] - fy * u + 4.5 / 16 * alt); g.scale(5 * s, 5 * s); g.fillRect(-1, -1, 2, 2); g.restore();
  }
  g.restore();
}
// asa de 3/4: a pele (de cima, 0,88) + a ponta (0,144) num paralelogramo; fi = ângulo da batida (0 = reta)
function asa(g, e, fi, perto) {
  const k = perto ? 1 : 0.85, lat = perto ? 1 : -1;
  const S = [KX * Math.cos(fi) * lat * k, (KY * Math.cos(fi) * lat - Math.sin(fi)) * k];  // envergadura, por pixel da textura
  const C = [-56 * e, 56 * 0.12 * e];                                                      // corda: pra trás
  for (const [sy, base] of [[88, 0], [144, 56]]) quad(g, IMG.dragao, 0, sy, 56, 56, [(56 + base) * S[0] * e, (56 + base) * S[1] * e], [-56 * S[0] * e, -56 * S[1] * e], C);
  // os ossos na borda da frente
  quad(g, IMG.dragao, 120, 88, 56, 8, [56 * S[0] * e, 56 * S[1] * e - 2 * e], [-56 * S[0] * e, -56 * S[1] * e], [0, 5 * e]);
  quad(g, IMG.dragao, 116, 136, 56, 4, [112 * S[0] * e, 112 * S[1] * e - 1.5 * e], [-56 * S[0] * e, -56 * S[1] * e], [0, 3.5 * e]);
}

// a espinha no referencial do dragão (pixels da textura; x pra frente, y pra baixo, origem no
// meio do corpo): rabo e pescoço em gomos de 10, cada um no seu ângulo; pescoco > 0 baixa a
// cabeça, rabo > 0 levanta o rabo, onda = quanto o rabo ondula
function espinha(pescoco, rabo, onda, t) {
  const pecas = [];
  let x = -32, y = 0, ang = 0;
  for (let j = 0; j < 12; j++) {
    const f = (j + 1) / 12;
    ang = rabo * f + onda * f * Math.sin(t * 4.2 - j * 0.6);
    const nx = x - 10 * Math.cos(ang), ny = y - 10 * Math.sin(ang);
    pecas.push({ tipo: 'gomo', x: (x + nx) / 2, y: (y + ny) / 2, ang });
    x = nx; y = ny;
  }
  pecas.reverse();  // desenha da ponta do rabo pra frente
  pecas.push({ tipo: 'perna_tras', x: -22, y: 0, ang: 0 }, { tipo: 'corpo', x: 0, y: 0, ang: 0 }, { tipo: 'perna_frente', x: 22, y: 0, ang: 0 });
  x = 32; y = 0;
  for (let i = 0; i < 5; i++) {
    ang = pescoco * (i + 1) / 5 + 0.12 * Math.sin(t * 3.1 - i * 0.7);
    const nx = x + 10 * Math.cos(ang), ny = y + 10 * Math.sin(ang);
    pecas.push({ tipo: 'gomo', x: (x + nx) / 2, y: (y + ny) / 2, ang });
    x = nx; y = ny;
  }
  const c = Math.cos(ang), s = Math.sin(ang);
  pecas.push({ tipo: 'cabeca', x: x + 8 * c, y: y + 8 * s, ang }, { tipo: 'focinho', x: x + 24 * c, y: y + 24 * s, ang }, { tipo: 'queixo', x: x + 24 * c, y: y + 24 * s, ang });
  return { pecas, boca: [x + 30 * c - 4 * s, y + 30 * s + 4 * c], cabeca: [x + 14 * c, y + 14 * s] };
}

// o dragão inteiro na pose p (coordenadas da janela)
function pintarDragao(g, p) {
  const e = E * p.s;
  g.save();
  g.translate(p.x, p.y); g.scale(p.sx, 1); g.rotate(p.pitch);
  const asaEm = perto => { g.save(); g.translate(14 * e, -10 * e); asa(g, e, p.fi, perto); g.restore(); };
  asaEm(false);
  for (const pc of p.pecas) {
    g.save(); g.translate(pc.x * e, pc.y * e); g.rotate(pc.ang);
    const perna = PERNAS[pc.tipo];
    if (perna) {  // penduradas pra trás
      const [sx, sy, sw, sh, ang] = perna;
      g.translate(0, 8 * e); g.rotate(ang * DEG);
      quad(g, IMG.dragao, sx, sy, sw, sh, [-sw / 2 * e + KX * 8 * e, KY * 8 * e], [sw * e, 0], [0, sh * e]);
    } else {
      if (pc.tipo === 'queixo' && p.boca) { g.translate(-8 * e, 4 * e); g.rotate(p.boca * 0.45); g.translate(8 * e, -4 * e); }  // abre pela dobradiça de trás
      caixa(g, CAIXAS[pc.tipo], e, p.s);
    }
    g.restore();
  }
  asaEm(true);
  g.restore();
}
// um ponto do referencial do dragão (pixels da textura) na janela
function noMundo(p, lx, ly) {
  const e = E * p.s, c = Math.cos(p.pitch), s = Math.sin(p.pitch);
  return [p.x + p.sx * (lx * c - ly * s) * e, p.y + (lx * s + ly * c) * e];
}

// contexto de mentira: só acompanha a transformação e soma a caixa do que seria pintado
// (pilha num Float64Array: roda várias vezes por quadro, sem lixo pro GC)
const MEDE = {
  m: new Float64Array(6), pilha: new Float64Array(6 * 64), n: 0, k: [0, 0, 0, 0], globalCompositeOperation: 'source-over', fillStyle: null,
  zerar() { this.m.set([1, 0, 0, 1, 0, 0]); this.n = 0; this.k = [Infinity, Infinity, -Infinity, -Infinity]; },
  save() { const o = 6 * this.n++; for (let i = 0; i < 6; i++) this.pilha[o + i] = this.m[i]; },
  restore() { if (!this.n) return; const o = 6 * --this.n; for (let i = 0; i < 6; i++) this.m[i] = this.pilha[o + i]; },
  transform(a, b, c, d, e, f) {
    const m = this.m, A = m[0], B = m[1], C = m[2], D = m[3];
    m[0] = A * a + C * b; m[1] = B * a + D * b; m[2] = A * c + C * d; m[3] = B * c + D * d; m[4] += A * e + C * f; m[5] += B * e + D * f;
  },
  translate(x, y) { this.transform(1, 0, 0, 1, x, y); },
  rotate(r) { const c = Math.cos(r), s = Math.sin(r); this.transform(c, s, -s, c, 0, 0); },
  scale(x, y) { this.transform(x, 0, 0, y, 0, 0); },
  ponto(px, py) {
    const m = this.m, k = this.k, X = m[0] * px + m[2] * py + m[4], Y = m[1] * px + m[3] * py + m[5];
    if (X < k[0]) k[0] = X; if (Y < k[1]) k[1] = Y; if (X > k[2]) k[2] = X; if (Y > k[3]) k[3] = Y;
  },
  retangulo(x, y, w, h) { this.ponto(x, y); this.ponto(x + w, y); this.ponto(x, y + h); this.ponto(x + w, y + h); },
  drawImage(img, ...a) { if (a.length === 8) this.retangulo(a[4], a[5], a[6], a[7]); else if (a.length === 4) this.retangulo(...a); else this.retangulo(a[0], a[1], img.width, img.height); },
  fillRect(x, y, w, h) { this.retangulo(x, y, w, h); },
  createRadialGradient() { return { addColorStop() {} }; },
};
function medir(p) { MEDE.zerar(); pintarDragao(MEDE, p); return MEDE.k; }

// o dragão no instante t: lugar, lado, inclinação, espinha, asas, tinta, e a caixa (DIPs),
// já empurrado pra dentro da janela com a margem do brilho; null fora de cena
function poseDragao(P, t) {
  if (t < CHEGA || t >= SOME) return null;
  const tv = Math.min(t, MORTE);
  let [x, y, s] = catmull(P.voo, tv);
  s = lim(s, 0.25, 1);
  // lado: em cada volta a escala x encolhe e troca de sinal no meio; não passa de 0,3 (bem
  // de lado ele virava um palito: a coluna de novo)
  let lado = -1, sx = -1;
  for (const [a, b, depois] of VIRADAS) {
    if (t >= b) { lado = sx = depois; continue; }
    if (t >= a) { const u = suave(faixa(t, a, b)); sx = -depois * Math.cos(Math.PI * u); lado = u < 0.5 ? -depois : depois; }
    break;
  }
  if (Math.abs(sx) < 0.3) sx = 0.3 * lado;
  // inclinação pela velocidade (no máximo ~24°: nada de coluna), e a de pouso/morte
  const a1 = catmull(P.voo, tv - 0.04), a2 = catmull(P.voo, tv + 0.04);
  let pitch = lim(Math.atan2((a2[1] - a1[1]) / 0.08, Math.max(60, (a2[0] - a1[0]) / 0.08 * lado)), -0.42, 0.42);
  pitch += (curvaK(t, [[8.4, 0.2], [MORTE, 0.2], [MORTE + 1, -0.3]]) - pitch) * curvaK(t, [[7.9, 0], [8.4, 1]]);
  // encolhido na volta, todo ângulo fica mais em pé na tela: corrige pra ele parecer o mesmo
  const k = Math.abs(sx), igual = a => Math.atan(Math.tan(a) * k);
  pitch = igual(pitch);
  if (t >= 8.4) y += 1.5 * Math.sin((t - 8.4) * 5);   // pairando
  y -= 55 * sai(faixa(t, MORTE, MORTE + 4));          // morte: sobe
  const ts = P.tSopro;
  const pescoco = curvaK(t, [[0, 0.12], [ts - 0.35, 0.12], [ts - 0.1, 0.5], [ts + 0.2, 0.5], [ts + 0.5, 0.12], [7.7, 0.12], [8.3, 1.05], [MORTE, 1.05], [MORTE + 0.8, -0.35]]);
  const rabo = curvaK(t, [[0, -0.05], [7.9, -0.05], [8.4, 0.45], [MORTE, 0.45], [MORTE + 1, 0.15]]);
  const esp = espinha(igual(pescoco), igual(rabo), (t < MORTE ? 0.3 : 0.55) * k, t);
  const fase = t < MORTE ? 2 * Math.PI * t / 0.95 : 2 * Math.PI * (MORTE / 0.95 + (t - MORTE) / 1.6);  // bate mais devagar morrendo
  const hit = HITS.find(h => t >= h && t < h + 0.25);
  const [tx, ty] = tremida(t, [[7.6, 0.4, 1.5], [MORTE, 4.0, 0.8], ...HITS.map(h => [h, 0.2, 1.2])]);
  const p = {
    x: x + tx, y: y + ty, s, sx, pitch, pecas: esp.pecas, bocaL: esp.boca, cabecaL: esp.cabeca,
    fi: 0.2 + 0.95 * Math.sin(fase),
    boca: Math.max(pulso(t, ts - 0.25, ts + 0.25), pulso(t, 7.5, 8.1), t >= MORTE ? 1 : 0),
    tinta: hit != null ? 'rgba(255,0,0,.4)' : t >= MORTE ? `rgba(255,255,255,${(0.25 + 0.2 * Math.sin(t * 20)).toFixed(2)})` : null,
    desmancha: faixa(t, 12.2, 13.9), alfa: faixa(t, CHEGA, CHEGA + 0.4),
  };
  const c = medir(p);
  const dx = c[0] - MARGEM < 0 ? MARGEM - c[0] : c[2] + MARGEM > P.W ? P.W - MARGEM - c[2] : 0;
  const dy = c[1] - MARGEM < 0 ? MARGEM - c[1] : c[3] + MARGEM > P.H ? P.H - MARGEM - c[3] : 0;
  p.x += dx; p.y += dy;
  p.caixa = [c[0] + dx, c[1] + dy, c[2] + dx, c[3] + dy];
  return p;
}

// ---------- pixels: o raster faz tudo, mas pintar a janela inteira por ele custa ~3 ms ----------
// Os laços daqui leem e escrevem os pixels (BGRA pré-multiplicado) como Int32: lido de um
// Uint32Array, pixel com alfa >= 128 vira double no V8 e o laço fica ~2x mais lento.
const VISTAS = new WeakMap();  // pixels da tela -> a mesma memória como Int32Array (some junto com a tela)
function i32(t) {
  let v = VISTAS.get(t.pixels);
  if (!v) { v = new Int32Array(t.pixels.buffer, t.pixels.byteOffset, t.pixels.length); VISTAS.set(t.pixels, v); }
  return v;
}
// p * k/255 nos 4 canais, dois canais por multiplicação (a mesma conta do raster)
function mul(p, k) {
  let rb = (p & 0xff00ff) * k + 0x800080;
  rb = ((rb + ((rb >>> 8) & 0xff00ff)) >>> 8) & 0xff00ff;
  let ag = ((p >>> 8) & 0xff00ff) * k + 0x800080;
  ag = (ag + ((ag >>> 8) & 0xff00ff)) & 0xff00ff00;
  return rb | ag;
}
// os trechos não transparentes de cada linha da imagem [y, x0, x1, ...]: a imagem pronta (céu,
// borda) é quase toda vazia, e colar só esses trechos é o que deixa o céu barato
function trechos(img) {
  if (img.trechos) return img.trechos;
  const px = i32(img), W = img.width, t = [];
  for (let y = 0; y < img.height; y++) {
    for (let x = 0; x < W;) {
      while (x < W && px[y * W + x] === 0) x++;
      const x0 = x;
      while (x < W && px[y * W + x] !== 0) x++;
      if (x > x0) t.push(y, x0, x);
    }
  }
  return (img.trechos = Int32Array.from(t));
}
// cola a imagem em (x, y) pixels da tela, por cima (source-over), com alfa; regiao = [w, h]
// cola só esse pedaço de cima à esquerda. Sem transformação nem clip: escreve direto nos
// pixels da tela do contexto (o motor não usa clip); fora do raster, cai no drawImage
function colar(g, img, x, y, alfa = 1, regiao = null) {
  const tl = g.canvas, ga = Math.round(lim(alfa, 0, 1) * 255);
  if (!ga) return;
  if (!tl || !(tl.pixels instanceof Uint32Array)) {
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = alfa;
    if (regiao) g.drawImage(img, 0, 0, regiao[0], regiao[1], x, y, regiao[0], regiao[1]); else g.drawImage(img, x, y);
    g.restore(); return;
  }
  const D = i32(tl), W = tl.width, H = tl.height, S = i32(img), w = img.width;
  const linha = (sy, x0, x1) => {
    const ty = sy + y;
    if (ty < 0 || ty >= H) return;
    const a = Math.max(x0, -x), b = Math.min(x1, W - x), os = sy * w, od = ty * W + x;
    for (let i = a; i < b; i++) {
      let s = S[os + i];
      if (s === 0) continue;
      if (ga !== 255) s = mul(s, ga);
      const sa = s >>> 24, d = D[od + i];
      D[od + i] = sa === 255 || d === 0 ? s : (s + mul(d, 255 - sa)) | 0;
    }
  };
  if (regiao) { for (let sy = 0; sy < regiao[1]; sy++) linha(sy, 0, regiao[0]); return; }
  const t = trechos(img);
  for (let k = 0; k < t.length; k += 3) linha(t[k], t[k + 1], t[k + 2]);
}

// ---------- composição: o dragão numa tela à parte, com tinta, desmanche, contorno e brilho ----------
const LONA = {};
function lona(Wd, Hd) {
  if (!LONA.tela || LONA.tela.width !== Wd || LONA.tela.height !== Hd) {
    const n = Wd * Hd;
    Object.assign(LONA, { tela: tela(Wd, Hd), saida: tela(Wd, Hd), a: new Int32Array(n), c: new Int32Array(n), d: new Int32Array(n), col: new Int32Array(Wd) });
  }
  return LONA;
}
// média de uma janela 2r+1 na horizontal e depois na vertical (fora da região = 0); a
// vertical soma por coluna andando linha a linha (memória em ordem)
function borrar(src, dst, tmp, col, w, h, r) {
  const inv = Math.round(65536 / (2 * r + 1));
  for (let y = 0, o = 0; y < h; y++, o += w) {
    let s = 0;
    for (let x = 0; x < r && x < w; x++) s += src[o + x];
    for (let x = 0; x < w; x++) {
      if (x + r < w) s += src[o + x + r];
      tmp[o + x] = (s * inv) >>> 16;
      if (x >= r) s -= src[o + x - r];
    }
  }
  col.fill(0, 0, w);
  for (let y = 0; y < r && y < h; y++) for (let x = 0, o = y * w; x < w; x++) col[x] += tmp[o + x];
  for (let y = 0; y < h; y++) {
    if (y + r < h) for (let x = 0, o = (y + r) * w; x < w; x++) col[x] += tmp[o + x];
    for (let x = 0, o = y * w; x < w; x++) dst[o + x] = (col[x] * inv) >>> 16;
    if (y >= r) for (let x = 0, o = (y - r) * w; x < w; x++) col[x] -= tmp[o + x];
  }
}
// roxo do brilho e rosa do contorno, já pré-multiplicados em cada alfa
const ROXO = new Int32Array(256), ROSA = new Int32Array(256);
for (let a = 0; a < 256; a++) {
  const p = (r, g, b) => (a << 24) | (Math.round(r * a / 255) << 16) | (Math.round(g * a / 255) << 8) | Math.round(b * a / 255);
  ROXO[a] = p(168, 85, 247); ROSA[a] = p(245, 208, 254);
}
// o drop-shadow duplo da prévia: contorno claro de 1 px e, por baixo, brilho roxo (σ ≈ 1,75
// DIP, borrado em meia resolução: 4x menos conta); lê a região w×h de L.tela e escreve
// dragão + contorno + brilho em L.saida
function brilhar(L, w, h, esc, forca = 1) {
  const Wd = L.tela.width, src = i32(L.tela), out = i32(L.saida), A = L.a, G = L.c, T = L.d;
  const w2 = (w + 1) >> 1, h2 = (h + 1) >> 1;
  G.fill(0, 0, w2 * h2);
  for (let y = 0; y < h; y++) {
    for (let x = 0, o = y * w, od = y * Wd, o2 = (y >> 1) * w2; x < w; x++) { const a = src[od + x] >>> 24; A[o + x] = a; G[o2 + (x >> 1)] += a; }
  }
  for (let i = 0; i < w2 * h2; i++) G[i] >>= 2;
  const sg = 0.875 * esc, r = Math.max(1, Math.round(Math.sqrt(sg * sg * 1.5 + 0.25) - 0.5));  // 2 médias ≈ gaussiana
  borrar(G, G, T, L.col, w2, h2, r); borrar(G, G, T, L.col, w2, h2, r);
  const ganho = Math.round(333 * forca), kc = Math.round(200 * forca);  // brilho x1,3; contorno ~80%
  for (let y = 0; y < h; y++) {
    const o = y * w, od = y * Wd, o2 = (y >> 1) * w2, cima = y > 0, baixo = y < h - 1;
    for (let x = 0; x < w; x++) {
      const d = src[od + x], da = d >>> 24;
      if (da === 255) { out[od + x] = d; continue; }
      let ag = (G[o2 + (x >> 1)] * ganho) >> 8;
      if (ag > 255) ag = 255;
      // contorno: o vizinho (em cruz) mais opaco
      let ac = x > 0 ? A[o + x - 1] : 0;
      if (x < w - 1 && A[o + x + 1] > ac) ac = A[o + x + 1];
      if (cima && A[o - w + x] > ac) ac = A[o - w + x];
      if (baixo && A[o + w + x] > ac) ac = A[o + w + x];
      ac = (ac * kc) >> 8;
      if (ac > 255) ac = 255;
      let p = ROXO[ag];
      if (ac) p = (ROSA[ac] + mul(p, 255 - ac)) | 0;
      out[od + x] = da ? (d + mul(p, 255 - da)) | 0 : p;
    }
  }
}
// sorteio fixo por célula (pro desmanche)
function ruido(x, y) {
  let h = (Math.imul(x, 374761393) + Math.imul(y, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}
function desenharDragao(g, p, esc, Wd, Hd) {
  const ox = Math.max(0, Math.floor((p.caixa[0] - MARGEM) * esc)), oy = Math.max(0, Math.floor((p.caixa[1] - MARGEM) * esc));
  const w = Math.min(Wd, Math.ceil((p.caixa[2] + MARGEM) * esc)) - ox, h = Math.min(Hd, Math.ceil((p.caixa[3] + MARGEM) * esc)) - oy;
  if (w <= 0 || h <= 0 || p.alfa <= 0) return;
  const L = lona(Wd, Hd), k = L.tela.getContext('2d');
  L.tela.limpar();
  k.save(); k.setTransform(esc, 0, 0, esc, -ox, -oy); pintarDragao(k, p); k.restore();
  if (p.tinta) { k.save(); k.globalCompositeOperation = 'source-atop'; k.fillStyle = p.tinta; k.fillRect(0, 0, w, h); k.restore(); }
  if (p.desmancha > 0) {  // some em quadradinhos de 2 DIPs, como o desmanche da prévia
    const px = i32(L.tela), q = 2 * esc;
    for (let y = 0; y < h; y++) {
      const cy = Math.floor((oy + y + 0.5) / q);
      let cx = -1, some = false;
      for (let x = 0; x < w; x++) {
        const c = Math.floor((ox + x + 0.5) / q);
        if (c !== cx) { cx = c; some = ruido(c, cy) < p.desmancha; }
        if (some) px[y * Wd + x] = 0;
      }
    }
  }
  brilhar(L, w, h, esc);
  colar(g, L.saida, ox, oy, p.alfa, [w, h]);
}

// =====================================================================================
// O palco: tudo que depende do cartão e de onde o Clawd estava (muda pouco: cache com teto)
// =====================================================================================
const PALCOS = cache(4);
function palcoDe(m) {
  const [W, H] = m.host.janela || [380, 440], [cx, cy, cw, ch] = m.host.cartao, casa = m.pose();
  const chave = [W, H, cx, cy, cw, ch, casa.x, casa.y, casa.a].map(v => Math.round(v * 100)).join(',');
  const pronto = PALCOS.get(chave);
  if (pronto) return pronto;
  const noTopo = Math.abs(casa.a) < 1e-6;
  // onde o Clawd luta, na borda de cima: espaço pra rolar e pro ovo à direita, e pro dragão
  // pousar à esquerda (corpo 64 antes dele, rabo ~80 mais) com o rabo dentro da janela
  const lo = Math.max(cx + 50, 175), hi = Math.max(lo, cx + cw - 100);
  const B = lim(noTopo ? casa.x : cx + cw * 0.55, lo, hi);
  const yT = v => Math.max(78, v);  // asa pra cima cabe
  // o corpo do dragão: chega de longe (pequeno) pela direita, passa por cima, volta pelo fundo,
  // rasante pra direita (sopro), volta, passa de novo, volta e pousa na frente do Clawd
  const voo = [
    [CHEGA, W - 80, yT(cy - 200), 0.3], [2.3, W * 0.56, yT(cy - 150), 0.8], [3.0, 140, yT(cy - 138), 1], [3.35, 110, yT(cy - 140), 1],
    [3.6, 88, yT(cy - 162), 0.62], [3.85, 92, yT(cy - 140), 0.85],
    [4.3, 150, yT(cy - 82), 1], [4.8, 240, yT(cy - 92), 1], [5.45, W - 105, yT(cy - 150), 1],
    [5.7, W - 90, yT(cy - 172), 0.62], [5.95, W - 100, yT(cy - 160), 0.85],
    [6.6, W * 0.5, yT(cy - 158), 1], [7.15, 122, yT(cy - 150), 1],
    [7.38, 100, yT(cy - 170), 0.65], [7.6, 104, yT(cy - 150), 0.85],
    [8.4, B - 64, yT(cy - 58), 1], [MORTE, B - 64, yT(cy - 58), 1],
  ];
  // o sopro sai quando a cabeça passa ~30 px antes do Clawd
  let tSopro = 4.45;
  for (let t = 3.95; t <= 4.85; t += 0.01) if (catmull(voo, t)[0] + 114 * E >= B - 30) { tSopro = t; break; }
  const OVO1 = Math.max(cx + 22, B - 45), xPega = B + 15;
  const P = {
    W, H, cx, cy, cw, ch, casa, noTopo, B, voo, tSopro, tRola: tSopro + 0.1, alvo: [B, cy - 1],
    cristR: cx + cw - 12, cristL: cx + 12, OVO1, OVO2: xPega + 13, xPega,
  };
  // o Clawd na borda de cima: rola pra direita do sopro, volta pra lutar, recua, vai até o ovo, volta e pega
  P.xs = [[0, B], [P.tRola, B], [P.tRola + 0.4, B + 40], [7.6, B + 40], [8.4, B], [10.1, B], [10.3, B + 8], [15.2, B + 8], [16.0, OVO1 + 20], [16.6, OVO1 + 20], [17.2, xPega]];
  // ir até lá e voltar: andando se estava na borda de cima e perto; senão teleporta (como o ovo)
  P.ida = noTopo && Math.abs(B - casa.x) <= 55 ? 'anda' : 'teleporte';
  P.volta = noTopo && Math.abs(xPega - casa.x) <= 62 ? 'anda' : 'teleporte';
  return PALCOS.set(chave, P);
}
// pontos do dragão que outras coisas usam (a origem de cada orbe, onde o golpe acerta...)
function corpoEm(P, t) { const p = poseDragao(P, t); return p ? noMundo(p, 0, 0) : [P.B - 64, P.cy - 113]; }
// a origem de cada orbe: calculada quando ele sai (uma ou duas por quadro, não 84 de uma vez)
function origem(P, i) { const o = P.origens || (P.origens = []); return o[i] || (o[i] = corpoEm(P, CHUVA[i].sai)); }
function golpes(P) { return P.golpes || (P.golpes = HITS.map(h => { const p = poseDragao(P, h); return noMundo(p, p.cabecaL[0], p.cabecaL[1]); })); }

// =====================================================================================
// Cenário, efeitos e itens (DIPs da janela)
// =====================================================================================
// textura multiplicada por uma cor (o céu do End arroxeado, o orbe de XP)
const MULT = cache(140);
function multiplicada(img, cor, chave, sx = 0, sy = 0, sw = img.width, sh = img.height) {
  const k0 = chave + cor;
  const pronta = MULT.get(k0);
  if (pronta) return pronta;
  const c = tela(sw, sh), x = c.getContext('2d');
  x.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  x.globalCompositeOperation = 'multiply'; x.fillStyle = cor; x.fillRect(0, 0, sw, sh);
  x.globalCompositeOperation = 'destination-in'; x.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh);
  return MULT.set(k0, c);
}
// o céu do End em volta do cartão, pronto 1x por janela/cartão/escala: um gradiente elíptico
// que some antes das bordas da janela (lá a janelinha é transparente) com a textura do céu
// (environment/end_sky, arroxeada) somada bem fraquinha, e o cartão de fora (o fundo é da
// janelinha). Conta direta por pixel (pelo raster, gradiente + 3 passadas na janela inteira,
// o 1º quadro do dragão levava ~40 ms) e aos pedaços: `linhas` por chamada, nos primeiros
// quadros, quando o céu ainda não aparece; devolve null até ficar pronto.
const CEUS = cache(2);
// a cor do céu em 256 degraus do centro (0) pra borda (255), já pré-multiplicada [r, g, b, a]
// (rgba(30,8,48,.92) -> rgba(26,7,44,.8) aos 60% -> transparente)
const CEU_TAB = (() => {
  const tab = new Float64Array(256 * 4), cores = [[0, 30, 8, 48, 0.92], [0.6, 26, 7, 44, 0.8], [1, 24, 6, 40, 0]];
  for (let i = 0; i < 256; i++) {
    const u = i / 255, j = u < 0.6 ? 0 : 1, a = cores[j], b = cores[j + 1], f = (u - a[0]) / (b[0] - a[0]), al = a[4] + (b[4] - a[4]) * f;
    for (let k = 0; k < 3; k++) tab[4 * i + k] = (a[k + 1] + (b[k + 1] - a[k + 1]) * f) * al;
    tab[4 * i + 3] = al;
  }
  return tab;
})();
function ceuPronto(P, esc, linhas = Infinity) {
  const chave = [P.W, P.H, P.cx, P.cy, P.cw, P.ch, esc].join(',');
  const Wd = Math.round(P.W * esc), Hd = Math.round(P.H * esc);
  const o = CEUS.get(chave) || CEUS.set(chave, { tela: tela(Wd, Hd), feitas: 0, trechos: [] });
  if (o.feitas >= Hd) return o.tela;
  const px = i32(o.tela), tex = IMG.ceu_end, tw = tex.width, th = tex.height, tp = i32(tex);
  const r0 = P.W * 0.14, r1 = P.W / 2, ky = P.W / P.H, kr = 0.22 * 0xB5 / 255, kg = 0.22 * 0x7B / 255, kb = 0.22 * 0xFF / 255;
  const fx0 = Math.ceil(P.cx * esc - 0.5), fx1 = Math.ceil((P.cx + P.cw) * esc - 0.5);  // o cartão: pixels com o centro nele
  const fy0 = Math.ceil(P.cy * esc - 0.5), fy1 = Math.ceil((P.cy + P.ch) * esc - 0.5);
  const fim = Math.min(Hd, o.feitas + linhas);
  for (let y = o.feitas; y < fim; y++) {
    const Y = (y + 0.5) / esc, dy = (Y - P.H / 2) * ky, lt = Math.floor((Y % 64) / 64 * th) * tw, noCartao = y >= fy0 && y < fy1;
    let ini = -1;
    for (let x = 0; x <= Wd; x++) {
      let p = 0;
      if (x < Wd && !(noCartao && x >= fx0 && x < fx1)) {
        const X = (x + 0.5) / esc, dx = X - P.W / 2, u = (Math.sqrt(dx * dx + dy * dy) - r0) / (r1 - r0);
        const i = u >= 1 ? -1 : 4 * (u <= 0 ? 0 : Math.round(u * 255)), al = i < 0 ? 0 : CEU_TAB[i + 3];
        if (al * 255 >= 0.5) {
          const t = tp[lt + Math.floor((X % 64) / 64 * tw)];  // textura: soma fraquinha, some junto com o céu
          const r = CEU_TAB[i] + ((t >>> 16) & 255) * kr * al, g = CEU_TAB[i + 1] + ((t >>> 8) & 255) * kg * al, b = CEU_TAB[i + 2] + (t & 255) * kb * al;
          const a = Math.min(255, Math.round(al * 255 * 1.22));
          p = (a << 24) | (Math.min(a, Math.round(r)) << 16) | (Math.min(a, Math.round(g)) << 8) | Math.min(a, Math.round(b));
        }
      }
      if (p) { px[y * Wd + x] = p; if (ini < 0) ini = x; } else if (ini >= 0) { o.trechos.push(y, ini, x); ini = -1; }
    }
  }
  o.feitas = fim;
  if (fim < Hd) return null;
  o.tela.trechos = Int32Array.from(o.trechos);  // o colar() usa direto
  o.trechos = null;
  return o.tela;
}
// a moldura do cartão vira pedra do End (por cima da terra/grama do tema), pronta 1x
const BORDAS = cache(2);
function bordaPronta(P, m, esc) {
  const ml = layoutDe(m.tema).moldura, [me, mc, md, mb] = ml.some(v => v > 0) ? ml : [5, 5, 5, 5];  // sem moldura: um anel fino no padding
  const chave = [P.cx, P.cy, P.cw, P.ch, me, mc, md, mb, esc].join(',');
  const pronta = BORDAS.get(chave);
  if (pronta) return pronta;
  const x = Math.floor(P.cx * esc), y = Math.floor(P.cy * esc), c = tela(Math.ceil((P.cx + P.cw) * esc) - x, Math.ceil((P.cy + P.ch) * esc) - y), k = c.getContext('2d');
  k.setTransform(esc, 0, 0, esc, -x, -y);
  k.beginPath(); k.rect(P.cx, P.cy, P.cw, P.ch); k.rect(P.cx + me, P.cy + mc, P.cw - me - md, P.ch - mc - mb); k.clip('evenodd');
  for (let i = P.cx; i < P.cx + P.cw; i += 16) for (let j = P.cy; j < P.cy + P.ch; j += 16) k.drawImage(IMG.end_stone, i, j, 16, 16);
  return BORDAS.set(chave, { tela: c, x, y });
}
// cristal do End: base de bedrock + cubo rosa com runas dentro do vidro, girando e flutuando
function cristal(g, x, y, t, alfa, sobe) {
  if (alfa <= 0) return null;
  g.save(); g.globalAlpha = alfa;
  g.drawImage(IMG.cristal, 0, 56, 24, 8, x - 6, y - 4, 12, 4);
  const cy = y - 13 * sobe + Math.sin(t * 2.2) * 1.5;
  g.save(); g.translate(x, cy); g.scale(11, 11); g.fillStyle = gradiente('cristal'); g.fillRect(-1, -1, 2, 2); g.restore();
  g.save(); g.translate(x, cy); g.rotate(-t * 2.4); g.scale(Math.cos(t * 1.7) * 0.25 + 0.75, 1); g.drawImage(IMG.cristal, 80, 16, 16, 16, -3.5, -3.5, 7, 7); g.restore();
  g.save(); g.translate(x, cy); g.rotate(t * 1.6 + Math.PI / 4); g.drawImage(IMG.cristal, 16, 16, 16, 16, -5.5, -5.5, 11, 11); g.restore();
  g.restore();
  return [x, cy];
}
// raio de cura do cristal até o dragão (entity/end_crystal/end_crystal_beam, correndo)
function raioCristal(g, a, b, t) {
  const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
  if (L < 1) return;
  g.save(); g.globalAlpha = 0.85; g.globalCompositeOperation = 'lighter';
  g.translate(a[0], a[1]); g.rotate(Math.atan2(b[1] - a[1], b[0] - a[0]) - Math.PI / 2);  // o comprido da textura no sentido do raio
  const img = tingida(IMG.cristal_raio, '#FFB8FF', 'raio');
  for (let d = -((t * 120) % 256); d < L; d += 256) {
    const y0 = Math.max(0, d), y1 = Math.min(L, d + 256);
    if (y1 > y0) g.drawImage(img, 0, y0 - d, 16, y1 - y0, -1.5, y0, 3, y1 - y0);
  }
  g.restore();
}
// clarão branco (particle/flash)
function clarao(g, x, y, e, tam) {
  if (e < 0 || e > 0.2) return;
  g.save(); g.globalAlpha = 1 - e / 0.2; g.globalCompositeOperation = 'lighter'; g.drawImage(IMG.flash, x - tam / 2, y - tam / 2, tam, tam); g.restore();
}
// bola de fogo do dragão (dragon_fireball) e a nuvem de ácido que fica no cartão
function bolaFogo(g, x, y, t) {
  g.save(); g.globalCompositeOperation = 'lighter'; g.translate(x, y); g.scale(11, 11);
  g.fillStyle = gradiente('bola'); g.fillRect(-1, -1, 2, 2); g.restore();
  g.save(); g.translate(x, y); g.rotate(t * 8); g.drawImage(IMG.dragao_bola, -6, -6, 12, 12); g.restore();
}
function nuvemAcida(g, cx, cy, raio, e, dur) {
  if (e < 0 || e > dur) return;
  const k = e < 0.25 ? e / 0.25 : e > dur - 0.6 ? (dur - e) / 0.6 : 1;
  g.save();
  g.save(); g.globalAlpha = k; g.translate(cx, cy); g.scale(raio, raio);
  g.fillStyle = gradiente('acido'); g.beginPath(); g.ellipse(0, 0, 1, 0.45, 0, 0, 2 * Math.PI); g.fill(); g.restore();
  for (const p of NUVEM) {
    const v = (e + p.fase) % p.vida, u = v / p.vida, f = 7 - Math.min(7, Math.floor(u * 8));
    g.globalAlpha = k * (1 - u);
    g.drawImage(tingida(IMG['poof' + f], p.cor, 'poof' + f), cx + p.x * raio * 0.9 - p.tam / 2, cy + p.y * 6 + p.vy * v * 2 - p.tam / 2, p.tam, p.tam);
  }
  g.restore();
}
function desenhaExplosao(g, lista, cx, cy, d) {
  for (const p of lista) {
    const e = d - p.atraso;
    if (e < 0 || e >= p.vida) continue;
    const f = Math.min(15, Math.floor(e / p.vida * 16));
    g.drawImage(tingida(IMG['explosao' + f], p.cor, 'exp' + f), cx + p.ox - p.tam / 2, cy + p.oy - p.tam / 2, p.tam, p.tam);
  }
}
// pontinhos roxos do teleporte (generic_0..7)
function desenhaPontos(g, lista, cx, cy, w, h, e) {
  if (e < 0) return;
  for (const p of lista) {
    if (e >= p.vida) continue;
    const u = e / p.vida, f = 7 - Math.min(7, Math.floor(u * 8));
    g.globalAlpha = 1 - u * 0.6;
    g.drawImage(tingida(IMG['poof' + f], p.cor, 'poof' + f), cx + p.ox * w / 2 + p.vx * e - p.tam / 2, cy + p.oy * h / 2 + p.vy * e - p.tam / 2, p.tam, p.tam);
  }
  g.globalAlpha = 1;
}
// estrelinhas do golpe crítico (particle/critical_hit)
function desenhaCritico(g, cx, cy, e) {
  if (e < 0) return;
  for (const p of FAISCAS) {
    if (e >= p.vida) continue;
    const k = 1 - Math.exp(-4 * e);  // freio do ar
    g.globalAlpha = 1 - e / p.vida;
    g.drawImage(tingida(IMG.critico, p.cor, 'critico'), cx + p.vx * k / 4 - p.tam / 2, cy + p.vy * k / 4 + 20 * e * e - p.tam / 2, p.tam, p.tam);
  }
  g.globalAlpha = 1;
}
// raios de luz da morte (triângulos saindo do corpo, do branco pro magenta, girando). Um raio
// pronto 1x por escala (a cunha com o gradiente), e cada raio é ela girada e esticada: 60
// triângulos com gradiente por pixel custavam ~4 ms. Por cima (source-over) e não somando:
// no escuro dá quase o mesmo, e o que é transparente na cunha não custa nada. O alfa vai na
// cunha (de 0,1 em 0,1): com globalAlpha o raster refaz a conta em todo pixel, até nos vazios.
const CUNHA_L = 130, CUNHA_W = 0.11, CUNHAS = cache(24);
function cunha(esc, alfa) {
  const chave = esc + ':' + alfa, pronta = CUNHAS.get(chave);
  if (pronta) return pronta;
  const h = CUNHA_L * Math.tan(CUNHA_W), c = tela(CUNHA_L * esc, 2 * h * esc + 2), k = c.getContext('2d');
  k.setTransform(esc, 0, 0, esc, 0, c.height / 2);
  k.scale(CUNHA_L, CUNHA_L); k.fillStyle = gradiente('raio'); k.globalAlpha = alfa;
  k.beginPath(); k.moveTo(0, 0); k.lineTo(1, -h / CUNHA_L); k.lineTo(1, h / CUNHA_L); k.closePath(); k.fill();
  return CUNHAS.set(chave, { tela: c, w: c.width / esc, h: c.height / esc });
}
function raiosMorte(g, x, y, p, t, esc) {
  if (p <= 0) return;
  const n = Math.min(60, Math.floor((p + p * p) / 2 * 60) + 1), c = cunha(esc, Math.round(9 * (1 - p * 0.5)) / 10);
  g.save(); g.translate(x, y);
  for (let i = 0; i < n; i++) {
    const r = RAIOS[i], k = r.L * Math.min(1, p * 1.4) / CUNHA_L;
    g.save(); g.rotate(r.a + r.v * t); g.scale(k, k * Math.tan(r.w) / Math.tan(CUNHA_W));
    g.drawImage(c.tela, 0, -c.h / 2, c.w, c.h);
    g.restore();
  }
  g.restore();
}
// orbe de XP como o jogo pinta (vermelho e azul oscilando): 6 tamanhos x 16 fases
const ORBE_FASES = 16;
function orbePintado(ic, fase) {
  const f = fase / ORBE_FASES * 2 * Math.PI, r = (Math.sin(f) + 1) * 0.5, b = (Math.sin(f + 4.1887903) + 1) * 0.1;
  return multiplicada(IMG.orbe, `rgb(${Math.round(r * 255)},255,${Math.round(b * 255)})`, 'orbe' + ic, (ic % 4) * 16, Math.floor(ic / 4) * 16, 16, 16);
}
// chuva de orbes: saem do corpo do dragão (P.origens), sobem, caem e voam pro Clawd
function chuvaOrbes(g, P, alvo, t) {
  CHUVA.forEach((o, i) => {
    const e = t - o.sai;
    if (e < 0 || e >= o.voo + 0.35) return;
    const [ox, oy] = origem(P, i);
    let x, y;
    if (e < o.voo) { x = ox + o.vx * e; y = oy + o.vy * e + 150 * e * e; }
    else {
      const u = entra((e - o.voo) / 0.35), qx = ox + o.vx * o.voo, qy = oy + o.vy * o.voo + 150 * o.voo * o.voo;
      x = qx + (alvo[0] - qx) * u; y = qy + (alvo[1] - qy) * u;
    }
    g.drawImage(orbePintado(o.ic, Math.floor((t + o.fase) * 10 / (2 * Math.PI) * ORBE_FASES) % ORBE_FASES), x - 5, y - 5, 10, 10);
  });
}
// letra do jogo (font/ascii): largura de cada caractere, lida da textura
let LARG = null;
function largFonte(ch) {
  if (!LARG || LARG.img !== IMG.fonte) {
    LARG = { img: IMG.fonte };
    const px = IMG.fonte.pixels, W = IMG.fonte.width;
    for (let k = 33; k < 127; k++) {
      const cx = (k % 16) * 8, cy = Math.floor(k / 16) * 8;
      let w = 0;
      for (let i = 7; i >= 0 && !w; i--) for (let j = 0; j < 8; j++) if (px[(cy + j) * W + cx + i] >>> 24) { w = i + 1; break; }
      LARG[k] = w;
    }
  }
  return LARG[ch.charCodeAt(0)] ?? 4;
}
function letras(g, s, x, y, cor, esc) {
  const img = tingida(IMG.fonte, cor, 'fonte');
  for (const ch of s) {
    const k = ch.charCodeAt(0), lw = ch === ' ' ? 3 : largFonte(ch);
    if (ch !== ' ') g.drawImage(img, (k % 16) * 8, Math.floor(k / 16) * 8, lw, 8, x, y, lw * esc, 8 * esc);
    x += (lw + 1) * esc;
  }
}
const largura = (s, esc) => ([...s].reduce((w, ch) => w + (ch === ' ' ? 3 : largFonte(ch)) + 1, 0) - 1) * esc;
// o número do nível com contorno preto e verde de XP; cresce e solta raios dourados quando sobe
function nivelGrande(g, x, y, nivel, e, alfa) {
  if (alfa <= 0) return;
  g.save(); g.globalAlpha = alfa;
  if (e >= 0 && e < 0.3) {
    const u = e / 0.3;
    g.save(); g.translate(x, y + 3); g.globalAlpha = alfa * (1 - u);
    for (let i = 0; i < 10; i++) { g.rotate(Math.PI / 5); g.fillStyle = '#FFF59D'; g.fillRect(-0.6, -(7 + 10 * u), 1.2, 6); }
    g.restore();
  }
  const s = String(nivel), esc = 1.25 + (e >= 0 && e < 0.25 ? 0.5 * Math.sin(Math.PI * e / 0.25) : 0), x0 = x - largura(s, esc) / 2;
  for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) letras(g, s, x0 + dx * esc, y - 4 + dy * esc, '#000000', esc);
  letras(g, s, x0, y - 4, '#80FF20', esc);
  g.restore();
}
// barra de chefe (boss_bar/purple) com o nome
function barraChefe(g, W, vida, alfa) {
  if (alfa <= 0) return;
  g.save(); g.globalAlpha = alfa;
  const x = W / 2 - 91, y = 22, w = Math.round(182 * lim(vida, 0, 1));
  g.drawImage(IMG.boss_fundo, x, y, 182, 5);
  if (w > 0) g.drawImage(IMG.boss_barra, 0, 0, w, 5, x, y, w, 5);
  const nome = 'Ender Dragon', x0 = W / 2 - largura(nome, 1) / 2;
  letras(g, nome, x0 + 1, 12, '#3F3F3F', 1); letras(g, nome, x0, 11, '#FFFFFF', 1);
  g.restore();
}
// ovo do dragão (block/dragon_egg) recortado no formato do ovo, com contorno e brilho roxo:
// pronto 1x por escala. Maior que na prévia (lá sumia no 1x): 1,75 px por pixel do ovo.
const OVO_LINHAS = [4, 7, 9, 10, 11, 11, 10, 8], OVO_ESC = 1.75;
const OVOS = cache(4);
function ovoPronto(esc) {
  const pronto = OVOS.get(esc);
  if (pronto) return pronto;
  const meio = 6 * OVO_ESC + MARGEM, Wd = Math.ceil(2 * meio * esc), Hd = Math.ceil((12 * OVO_ESC + 2 * MARGEM) * esc);
  const n = Wd * Hd, L = { tela: tela(Wd, Hd), saida: tela(Wd, Hd), a: new Int32Array(n), c: new Int32Array(n), d: new Int32Array(n), col: new Int32Array(Wd) };
  const k = L.tela.getContext('2d');
  k.setTransform(esc * OVO_ESC, 0, 0, esc * OVO_ESC, meio * esc, (12 * OVO_ESC + MARGEM) * esc);  // origem no pé do ovo
  k.beginPath(); OVO_LINHAS.forEach((w, i) => k.rect(-w / 2, -12 + i * 1.5, w, 1.5)); k.clip();
  k.drawImage(IMG.ovo_dragao, -6, -12, 12, 12);
  brilhar(L, Wd, Hd, esc, 1.7);
  return OVOS.set(esc, { tela: L.saida, dx: meio, dy: 12 * OVO_ESC + MARGEM });
}
function ovoDragao(g, x, y, esc, tam = 1, alfa = 1) {
  if (alfa <= 0 || tam <= 0) return;
  const o = ovoPronto(esc);
  g.save(); g.globalAlpha = alfa; g.translate(x, y); g.scale(tam, tam);
  g.drawImage(o.tela, -o.dx, -o.dy, o.tela.width / esc, o.tela.height / esc);
  g.restore();
}
// partículas roxas paradas em volta do ovo (como o jogo)
function brilhoOvo(g, x, y, t) {
  for (let i = 0; i < 5; i++) {
    const f = (t * 0.9 + i / 5) % 1, a = i * 1.3 + t;
    g.globalAlpha = Math.sin(Math.PI * f) * 0.9; g.fillStyle = ROXOS[i % ROXOS.length];
    g.fillRect(x + Math.cos(a) * 9 - 0.75, y - 8 - f * 12 + Math.sin(a) * 2, 1.5, 1.5);
  }
  g.globalAlpha = 1;
}
// estrelinhas de 4 pontas piscando (o ovo na mão)
function desenhaBrilhos(g, x, y, w, h, t, n = 3) {
  for (let i = 0; i < n; i++) {
    const f = (t * 1.6 + i / n) % 1, a = Math.sin(Math.PI * f);
    if (a < 0.15) continue;
    const q = Math.floor(t * 1.6 + i / n), px = x + ((i * 37 + q * 13) % 10) / 10 * w, py = y + ((i * 53 + q * 29) % 10) / 10 * h, r = 1 + 1.5 * a;
    g.globalAlpha = a; g.fillStyle = '#FFFFFF';
    g.fillRect(px - 0.4, py - r, 0.8, 2 * r); g.fillRect(px - r, py - 0.4, 2 * r, 0.8);
  }
  g.globalAlpha = 1;
}
// flecha de lado (entity/projectiles/arrow), voando num arquinho
function flechaVoa(g, de, para, u) {
  if (u < 0 || u > 1) return;
  g.save();
  g.translate(de[0] + (para[0] - de[0]) * u, de[1] + (para[1] - de[1]) * u - 6 * Math.sin(Math.PI * u));
  g.rotate(Math.atan2(para[1] - de[1], para[0] - de[0]));
  g.drawImage(IMG.flecha, 0, 0, 16, 5, -8, -1.25, 8, 2.5);
  g.restore();
}

// =====================================================================================
// O Clawd
// =====================================================================================
// espada: prepara 0,45 s e acerta em h; crítico = pula e acerta caindo (como o jogo)
function angEspada(t) {
  for (const h of HITS) {
    if (t >= h - 0.45 && t < h) return golpe((t - (h - 0.45)) / 0.45);
    if (t >= h && t < h + 0.12) return 70 * (1 - (t - h) / 0.12);
  }
  return 0;
}
const puloCritico = (t, h) => (t < h - 0.42 || t > h + 0.04 ? 0 : -8 * Math.sin(Math.PI * (t - h + 0.42) / 0.46));
// arco puxando (bow_pulling_0..2) mirando no alvo; o ângulo do item = mira + 45°
function poseArco(t, x, y, alvo, t0, tiro, vira) {
  const ang = Math.atan2(alvo[1] - (y - 7.5), (alvo[0] - x) * vira - 12) / DEG + 45;
  return { ferr: t < tiro ? 'arco' + Math.min(2, Math.floor(faixa(t, t0, tiro) * 3)) : 'arco', ang };
}
// onde o Clawd está e o que faz: { casa: true } = no lugar dele (referencial do motor),
// senão x na borda de cima; vira -1 = olhando pra esquerda; null = sumido (teleportando)
function clawdEm(P, t, roupa, T) {
  const base = { roupa, T, ferr: 'espada' }, emCasa = { roupa, T, ferr: 'picareta' };  // em casa, a ferramenta do tema (sem ela, sem nada)
  // ida
  const dIda = P.B - P.casa.x, fimIda = 0.15 + Math.abs(dIda) / 50;
  if (P.ida === 'teleporte') {
    if (t < 0.25) return { casa: true, pose: emCasa };
    if (t < 0.4) return null;
  } else if (t < fimIda) {
    return t < 0.15 || !dIda ? { x: P.casa.x, vira: 1, pose: emCasa } : { x: P.casa.x + dIda * faixa(t, 0.15, fimIda), vira: Math.sign(dIda), pose: andando(t, base) };
  }
  // volta
  const dVolta = P.casa.x - P.xPega, iniVolta = 19.15 - Math.abs(dVolta) / 50;
  if (P.volta === 'teleporte') {
    if (t >= 18.75) return { casa: true, pose: emCasa };
    if (t >= 18.6) return null;
  } else if (t >= iniVolta && dVolta) {
    return { x: P.xPega + dVolta * faixa(t, iniVolta, 19.15), vira: Math.sign(dVolta), pose: t < 19.15 ? andando(t, base) : emCasa };
  }
  // a luta
  const x = linhaK(t, P.xs);
  let pose = { ...base }, rolo = 0, vira = 1;
  if (t >= 0.5 && t < 4.5) pose.olhos = 'cima';
  if (t >= P.tRola && t < P.tRola + 0.4) rolo = 2 * Math.PI * sai(faixa(t, P.tRola, P.tRola + 0.4));
  else if (t >= 5.35 && t < 6.25) pose = { ...base, ...poseArco(t, x, P.cy, [P.cristR, P.cy - 13], 5.35, 5.9, 1) };
  else if (t >= 6.25 && t < 7.6) { vira = -1; if (t < 7.25) pose = { ...base, ...poseArco(t, x, P.cy, [P.cristL, P.cy - 13], 6.3, 6.9, -1) }; }
  else if (t >= 7.6 && t < 8.4) { vira = -1; pose = andando(t, base); }
  else if (t >= 8.4 && t < 10.1) { vira = -1; pose = { ...base, ang: angEspada(t), y: HITS.reduce((s, h) => s + puloCritico(t, h), 0) }; }
  else if (t >= 10.1 && t < 15.2) { vira = -1; pose.olhos = 'cima'; }
  else if (t >= 15.2 && t < 16.6) {
    vira = -1;
    if (t < 16.0) pose = andando(t, base);
    else if (t < 16.2) pose.ang = golpe(faixa(t, 15.95, 16.15));            // encosta no ovo
    else if (t >= 16.25 && t < 16.55) pose.y = -5 * Math.sin(Math.PI * faixa(t, 16.25, 16.55));  // susto
  } else if (t >= 16.6 && t < PEGA) pose = andando(t, base);
  else if (t >= PEGA) {
    pose = { ...base, ferr: null, olhos: 'cima' };
    if (t > 17.55 && t < 17.85) pose.y = -4 * Math.sin(Math.PI * faixa(t, 17.55, 17.85));  // pulinho de alegria
  }
  return { x, vira, pose, rolo };
}
function desenharClawd(g, c, P, T0) {
  if (!c) return;
  g.save();
  if (c.casa) { g.setTransform(T0.a, T0.b, T0.c, T0.d, T0.e, T0.f); desenhaClawd(g, c.pose); g.restore(); return; }
  g.translate(c.x, P.cy);
  if (c.vira < 0) g.scale(-1, 1);
  if (c.rolo) { g.translate(0, -7.5); g.rotate(c.rolo); desenhaClawd(g, { ...c.pose, y: (c.pose.y || 0) + 7.5 }); } else desenhaClawd(g, c.pose);
  g.restore();
}
// o meio do Clawd na janela (onde o teleporte solta os pontinhos)
function meioClawd(P, emCasa) {
  if (!emCasa) return [P.B, P.cy - 8];
  const a = P.casa.a;
  return [P.casa.x + 8 * Math.sin(a), P.casa.y - 8 * Math.cos(a)];
}

// =====================================================================================
// O quadro
// =====================================================================================
function desenhar(g, t, m) {
  const P = palcoDe(m), esc = m.host.escala || 1, T0 = g.getTransform();
  const Wd = Math.round(P.W * esc), Hd = Math.round(P.H * esc), cy = P.cy;
  g.save();
  // céu e borda de pedra do End (prontos 1x; o cartão não treme: é a janelinha que pinta)
  // o céu fica pronto aos pedaços nos 0,2 s antes de aparecer (depois disso, de uma vez: o
  // quadro continua função do tempo); a borda e o resto que é pronto 1x, no 1º quadro
  const ceu = ceuPronto(P, esc, t < 0.2 ? Math.ceil(Hd / 5) : Infinity);
  const kc = t < 17.6 ? faixa(t, 0.2, 1.2) : 1 - faixa(t, 17.6, 18.6);
  if (kc > 0) colar(g, ceu, 0, 0, kc);
  const kb = t < 17.8 ? faixa(t, 0.4, 1.2) : 1 - faixa(t, 17.8, 18.8);
  if (kb > 0) { const b = bordaPronta(P, m, esc); colar(g, b.tela, b.x, b.y, kb); }
  g.setTransform(esc, 0, 0, esc, 0, 0);
  const tCai = P.tSopro + 0.45;
  nuvemAcida(g, P.alvo[0], cy, 26, t - tCai, 3.5);
  // cristais nos cantos (sobem de 0,8 a 1,7) até a flecha acertar
  const cR = t < QUEBRA_R ? cristal(g, P.cristR, cy, t, faixa(t, 0.8, 1.2), faixa(t, 0.8, 1.6)) : null;
  const cL = t < QUEBRA_L ? cristal(g, P.cristL, cy, t + 1.3, faixa(t, 0.95, 1.35), faixa(t, 0.95, 1.75)) : null;
  // Clawd
  const cl = clawdEm(P, t, m.roupa, m.T);
  desenharClawd(g, cl, P, T0);
  if (P.ida === 'teleporte') { const [x, y] = meioClawd(P, true); desenhaPontos(g, PONTOS[2], x, y, 10, 12, t - 0.25); desenhaPontos(g, PONTOS[3], P.B, cy - 8, 10, 12, t - 0.4); }
  if (P.volta === 'teleporte') { const [x, y] = meioClawd(P, true); desenhaPontos(g, PONTOS[2], P.xPega, cy - 8, 10, 12, t - 18.6); desenhaPontos(g, PONTOS[3], x, y, 10, 12, t - 18.75); }
  // dragão
  const d = poseDragao(P, t);
  if (d) {
    desenharDragao(g, d, esc, Wd, Hd);
    g.setTransform(esc, 0, 0, esc, 0, 0);
    const corpo = noMundo(d, 0, 0);
    if (t >= 1.6 && t < MORTE) { if (cR) raioCristal(g, cR, corpo, t); if (cL) raioCristal(g, cL, corpo, t); }
    if (t >= MORTE) raiosMorte(g, corpo[0], corpo[1], faixa(t, MORTE, 13.9) * (t > 13.9 ? 0 : 1), t, esc);
  }
  // sopro: sai da boca e cai onde o Clawd estava
  if (t >= P.tSopro && t < tCai) {
    const a = P.boca || (P.boca = (p0 => noMundo(p0, p0.bocaL[0], p0.bocaL[1]))(poseDragao(P, P.tSopro))), u = faixa(t, P.tSopro, tCai);
    bolaFogo(g, a[0] + (P.alvo[0] - a[0]) * u, a[1] + (P.alvo[1] - a[1]) * u, t);
  }
  desenhaExplosao(g, BOOM_BOLA, P.alvo[0], cy - 6, t - tCai);
  // flechas nos cristais
  const xFlecha = linhaK(5.9, P.xs);
  if (t >= 5.9 && t < QUEBRA_R) flechaVoa(g, [xFlecha + 14, cy - 9], [P.cristR, cy - 13], faixa(t, 5.9, QUEBRA_R));
  if (t >= 6.9 && t < QUEBRA_L) flechaVoa(g, [xFlecha - 14, cy - 9], [P.cristL, cy - 13], faixa(t, 6.9, QUEBRA_L));
  desenhaExplosao(g, BOOM_R, P.cristR, cy - 12, t - QUEBRA_R); clarao(g, P.cristR, cy - 12, t - QUEBRA_R, 50);
  desenhaExplosao(g, BOOM_L, P.cristL, cy - 12, t - QUEBRA_L); clarao(g, P.cristL, cy - 12, t - QUEBRA_L, 50);
  // críticos na cara do dragão
  if (t >= HITS[0] && t < HITS[2] + 0.6) golpes(P).forEach((q, i) => desenhaCritico(g, q[0], q[1], t - HITS[i]));
  // o clarão do fim, a chuva de XP e o nível subindo
  if (t >= 13.8 && t < 14.1) { const fim = P.fim || (P.fim = corpoEm(P, 13.9)); clarao(g, fim[0], fim[1], t - 13.85, 120); }
  const xc = cl && !cl.casa ? cl.x : P.B;
  if (t >= 10.8 && t < 14.5) chuvaOrbes(g, P, [xc, cy - 8], t);
  if (t >= 10.9 && t < 15.6) {
    let ult = -1, n = 0;
    for (const s of SUBIDAS) if (s <= t) { ult = s; n++; }
    const nivel0 = typeof m.tema.nivel === 'function' ? m.tema.nivel(m) : 12;  // o nível que o tema mostra
    nivelGrande(g, xc, cy - 30, nivel0 + n, ult >= 0 ? t - ult : -1, t > 15.2 ? 1 - faixa(t, 15.2, 15.6) : faixa(t, 10.9, 11.2));
  }
  // o ovo: cai de onde o dragão sumiu, fica, teleporta quando o Clawd encosta, e ele pega
  if (t >= OVO_CAI[0] && t < PEGA) {
    let ox = t < TELE ? P.OVO1 : P.OVO2, oy = cy;
    if (t < OVO_CAI[1]) { const u = faixa(t, OVO_CAI[0], OVO_CAI[1]), de = P.fim || (P.fim = corpoEm(P, 13.9)); ox = de[0] + (P.OVO1 - de[0]) * u; oy = de[1] + (cy - de[1]) * entra(u); }
    else if (t < OVO_CAI[1] + 0.25) oy = cy - 5 * Math.sin(Math.PI * faixa(t, OVO_CAI[1], OVO_CAI[1] + 0.25));
    ovoDragao(g, ox, oy, esc, 1, t >= TELE - 0.05 && t < TELE + 0.1 ? 0 : 1);
    if (t > OVO_CAI[1]) brilhoOvo(g, ox, oy, t);
  }
  desenhaPontos(g, PONTOS[0], P.OVO1, cy - 8, 12, 14, t - TELE);
  desenhaPontos(g, PONTOS[1], P.OVO2, cy - 8, 12, 14, t - TELE - 0.08);
  if (t >= PEGA && t < GUARDA + 0.2 && cl && !cl.casa) {
    const u = faixa(t, PEGA, PEGA + 0.25), x = cl.x, topo = cy - 17 + (cl.pose.y || 0);
    const ox = P.OVO2 + (x - P.OVO2) * u, oy = cy + (topo - cy) * u;
    const g2 = faixa(t, GUARDA, GUARDA + 0.2);  // guarda: encolhe pra dentro do Clawd
    ovoDragao(g, ox, oy + 10 * g2, esc, (1 - 0.15 * u) * (1 - 0.8 * g2));  // na mão fica um pouco menor
    if (t > PEGA + 0.25 && t < GUARDA) desenhaBrilhos(g, x - 9, topo - 24, 18, 14, t, 3);
  }
  // barra de chefe
  const vida = t < HITS[0] ? 1 : t < HITS[1] ? 0.62 : t < HITS[2] ? 0.31 : 0;
  barraChefe(g, P.W, vida, t < 10.5 ? faixa(t, 1.4, 1.9) : 1 - faixa(t, 10.5, 11.0));
  g.restore();
}

// a trilha (som.js): os sons do próprio jogo, que o minecraft.js baixou da Mojang (sem eles, muda).
// O bater das asas enquanto voa, o sopro, as flechas nos cristais, os críticos, a morte (18 s no
// jogo: corta quando ele some), cada orbe que chega e o levelup a cada 5 níveis, como no jogo
const S = n => `sons/${n}.wav`, VOLUME = 0.42;  // VOLUME: o nível dos avisos (−17 dB)
function sons(P, nivel0) {
  const tCai = P.tSopro + 0.45, L = [
    [CHEGA, S('dragao_rugido1'), 0.45], [P.tSopro - 0.15, S('dragao_rugido2'), 0.6], [P.tSopro, S('sopro'), 0.8], [tCai, S('explosao1'), 0.45],
    [5.9, S('arco'), 0.8], [QUEBRA_R, S('explosao2'), 0.6], [6.9, S('arco'), 0.8], [QUEBRA_L, S('explosao1'), 0.6], [8.0, S('dragao_rugido3'), 0.6],
    ...HITS.flatMap((t, i) => [[t, S(`critico${i % 2 + 1}`), 0.9], [t + 0.04, S(`dragao_dano${i + 1}`), 0.7]]),
    [MORTE, S('dragao_morte'), 0.75, 1, SOME + 1.5 - MORTE],
    [TELE, S('teleporte'), 0.6], [PEGA, S('pop'), 0.8],
  ];
  for (let t = CHEGA + 0.35, i = 0; t < 8.2; t += 0.72, i++) L.push([t, S(`dragao_asa${i % 4 + 1}`), 0.4]);
  CHEGADAS.forEach((t, i) => { if (i % 2 === 0) L.push([t, S(`xp${(i / 2) % 3 + 1}`), 0.22]); });
  SUBIDAS.forEach((t, i) => { if ((nivel0 + i + 1) % 5 === 0) L.push([t, S('levelup'), 0.6]); });
  if (P.ida === 'teleporte') L.push([0.25, S('teleporte'), 0.5]);
  if (P.volta === 'teleporte') L.push([18.6, S('teleporte'), 0.5]);
  return L.map(([t, a, g, ...r]) => [t, a, g * VOLUME, ...r]);
}

// a cena (o tema checa temTexturas(...texturas) antes de chamar)
function cena(m) {
  return {
    nome: 'dragao', dur: DUR, espaco: { frente: 0, tras: 0 }, modos: ['andando'],
    sons: sons(palcoDe(m), typeof m.tema.nivel === 'function' ? m.tema.nivel(m) : 12),
    subidas: SUBIDAS,  // quando cada nível sobe: o tema guarda os que já subiram (dono 06/10)
    quadro(g, t, mundo) { desenhar(g, t, mundo || m); },
    // pros testes: a caixa (DIPs) dos pixels do dragão no instante t, desenhado sozinho numa
    // tela com folga em volta (o que sairia da janela aparece), e a caixa medida; null sem dragão
    caixaDragao(t) {
      const P = palcoDe(m), p = poseDragao(P, t);
      if (!p) return null;
      const F = 200, c = tela(P.W + 2 * F, P.H + 2 * F), k = c.getContext('2d');
      k.translate(F, F); pintarDragao(k, p);
      const px = c.pixels, W = c.width;
      let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
      for (let i = 0; i < px.length; i++) if (px[i] >>> 24) { const x = i % W, y = (i - x) / W; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
      return { pixels: x0 === Infinity ? null : [x0 - F, y0 - F, x1 + 1 - F, y1 + 1 - F], medida: p.caixa };
    },
  };
}

module.exports = { texturas: TEXTURAS, cena };
