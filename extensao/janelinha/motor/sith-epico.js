'use strict';
// Evento épico raro do tema Sith (a cada 30 droides destruídos), ~19 s: A BATALHA DA FROTA.
// A área acima do cartão vira o espaço (abre de baixo pra cima, a partir da borda do cartão).
// A nave-mãe do lorde entra pela esquerda e para no alto, e o Clawd sai do cartão levitando na
// Força até o meio da batalha (dono, 09/10); caças droides chegam: as torres da nave derrubam
// uns, outros mergulham atirando nele, que rebate os tiros com o sabre de volta neles. Um
// droide gigante sai do hiperespaço e o olho dele carrega: o Clawd apaga o sabre, ergue a mão e
// a Força o esmaga até estourar (clarão, onda de choque, destroços). A nave carrega o salto e
// dispara num risco de luz, e a gente vai junto: o túnel do hiperespaço. Na saída, a nave
// chega na frente de um planeta vermelho; o Clawd desce de volta pro lugar dele, o espaço fecha
// de volta pra borda e ele segue o passeio. Desenho nosso (nada de filme): a nave é uma cunha
// genérica, os caças e o gigante são os droides do tema.
//
// Tudo é pré-calculado na cena(m), pela semente: o caminho de cada caça, cada tiro e onde ele
// bate. O quadro só consulta isso: é função de t. Coordenadas do palco: DIPs a partir do canto
// de cima à esquerda do cartão (X pra direita, Y- pra cima, 0 = borda de cima do cartão),
// como nos épicos do Padrão; o quadro soma o cartão de agora.
const { lim, sai, entra, tela, cache, arte, rng, rgba } = require('./comum');
const A = require('./sith-arte');

const { fatia, explosao, GIGANTE } = A;  // o gigante e a explosão: sith-arte.js (os dois épicos usam)
const P = A.P;

// ---------- ritmo (s) ----------
const T = {
  abre: [0, 0.5], nave: [0.45, 3.3],
  gigante: [8.5, 9.0], mira: [9.0, 9.95], apaga: [9.6, 9.8], agarra: 9.85, treme: [10.3, 11.3], amassa: [11.3, 11.8], boom: 11.8,
  solta: [12.3, 12.6], reacende: [12.6, 12.9],
  carga: [13.1, 14.5], estica: [14.1, 14.6], salta: [14.55, 14.7], tunel: [14.7, 16.5], sai: 16.5,
  fecha: [17.9, 18.4], volta: [18.2, 18.6], dur: 18.8,
};
const BATE = [4.7, 6.05, 7.35];             // o tiro do caça que mergulha chega no sabre
const TORRE = [4.2, 5.35, 5.75, 6.7, 7.95];  // a torre da nave acerta um caça
const VOO = 0.32, VOLTA = 0.2, VT = 0.14, VB = 0.3;  // tiro do caça até o sabre, rebatido até o caça, da torre, do caça na nave
const SABRE = [16, -15];                     // onde o tiro bate no sabre (referencial do Clawd)
const MAO = [12, -9];                        // a mão erguida (a Força sai dela)

// ---------- o voo (dono, 09/10): o Clawd sai do cartão e luta no ar, levitando na Força ----------
// Ele sobe em diagonal até o meio da batalha (J.Xb, a ~metade do vão até a nave), paira
// balançando, e no fim desce de volta pro lugar onde estava. Sobe 0,55–1,6 · desce 17,2–18,1
const VOA = { sobe: [0.55, 1.6], desce: [17.2, 18.1] };
// onde o Clawd está em t, a partir do lugar dele no cartão (k: 0 no chão, 1 no alto)
function clawdEm(J, t) {
  const k = sai(fatia(t, VOA.sobe[0], VOA.sobe[1])) * (1 - entra(fatia(t, VOA.desce[0], VOA.desce[1])));
  const x = (J.Xb - J.X0) * k + Math.sin(t * 0.8) * J.deriva * k, y = -J.alt * k + Math.sin(t * 2.2) * 1.5 * k;  // paira: balança de lado e sobe e desce
  return { x, y, k, aura: 0.45 * k };
}

const linhaDoTempo = [
  [0, 'o espaço abre acima do cartão, de baixo pra cima'],
  [T.nave[0], 'a nave-mãe entra pela esquerda e para no alto'],
  [VOA.sobe[0], 'o Clawd levita na Força e sobe pro meio da batalha'],
  [4.2, 'caças droides: as torres da nave derrubam 5; 3 mergulham no Clawd e ele rebate os tiros neles'],
  [T.gigante[0], 'um droide gigante sai do hiperespaço e o olho dele carrega'],
  [T.agarra, 'o Clawd apaga o sabre e ergue a mão: a Força segura o gigante, que treme'],
  [T.amassa[0], 'a Força esmaga o gigante'],
  [T.boom, 'estoura: clarão, onda de choque e destroços'],
  [T.reacende[0], 'o sabre acende de novo'],
  [T.carga[0], 'a nave carrega o salto; as estrelas esticam em riscos'],
  [T.salta[0], 'a nave dispara num risco de luz'],
  [T.tunel[0], 'o túnel do hiperespaço (a capa voando)'],
  [T.sai, 'a saída: clarão, a nave chega e um planeta vermelho sobe'],
  [VOA.desce[0], 'o Clawd desce de volta pro lugar dele'],
  [T.fecha[0], 'o espaço fecha de volta pra borda do cartão'],
  [T.volta[0], 'o sabre volta pra posição do passeio'],
];

// ---------- desenhos ----------
const COR = A.CORES_FROTA;
// caça droide: o casco redondo dos droides do tema, o olho vermelho e duas asas pra trás (bico pra esquerda)
const CACA = [
  '.....kkw.',
  '..ggg.k..',
  '.gllgg...',
  'grRllgkkk',
  'glllkg...',
  '.gkkgg...',
  '..ggg.k..',
  '.....kkw.',
];
const CW = CACA[0].length * P, CH = CACA.length * P;
const PG = 3, GW = GIGANTE[0].length * PG, GH = GIGANTE.length * PG, OLHO = [27 - GW / 2, 21 - GH / 2];  // o olho, do centro dele

// a nave-mãe de lado (a ponta pra direita), w de comprimento: o casco em cunha (a face de cima
// clara, a de baixo escura com as placas e as janelinhas), a torre em degraus perto da popa e
// os 3 motores na popa (o brilho deles vai por cima, no quadro). Em DIPs, 1 pixel = 1 DIP.
const NAVES = cache(6);
function medidasNave(w) {
  const h = Math.round(w * 0.26), topo = 9;
  return {
    w, h, topo, alt: h + topo + 1,
    cima: x => topo + 0.62 * h * x / w,                 // a borda de cima do casco em x
    baixo: x => topo + h - 0.38 * h * x / w,            // a de baixo (a barriga)
    quina: x => topo + 0.45 * h + 0.17 * h * x / w,     // a quina entre as duas faces
    motores: [0.2, 0.45, 0.7].map(f => topo + h * f), motorH: Math.max(2, Math.round(h * 0.13)),
  };
}
function naveMae(w) {
  w = Math.round(w);
  const pronta = NAVES.get(w);
  if (pronta) return pronta;
  const N = medidasNave(w), { h, topo } = N, c = tela(w + 1, N.alt), k = c.getContext('2d');
  const tri = (cor, a, b, d) => { k.fillStyle = cor; k.beginPath(); k.moveTo(...a); k.lineTo(...b); k.lineTo(...d); k.closePath(); k.fill(); };
  const ponta = [w, topo + 0.62 * h];
  tri('#2B303A', [0, topo], ponta, [0, topo + h]);            // a face de baixo
  tri('#8B93A1', [0, topo], ponta, [0, topo + 0.45 * h]);     // a de cima (a luz vem de cima)
  tri('#C4C9D2', [0, topo], ponta, [0, topo + 1.2]);          // o fio de luz na borda de cima
  tri('#1F2937', [0, topo + 0.45 * h], ponta, [0, topo + 0.45 * h + 1.2]);  // a quina
  // as placas da face de baixo: linhas que encurtam pra ponta
  k.fillStyle = '#353B47';
  for (let i = 1; i <= 3; i++) {
    const y = topo + 0.45 * h + i * 0.55 * h / 4, ate = Math.min((topo + h - y) * w / (0.38 * h), (y - topo - 0.45 * h) * w / (0.17 * h));
    k.fillRect(1, Math.round(y), Math.max(0, ate - 3), 1);
  }
  // a torre em degraus perto da popa, com a fileira de janelas da ponte
  k.fillStyle = '#6B7280'; k.fillRect(Math.round(w * 0.07), topo - 3, Math.round(w * 0.27), 3 + Math.ceil(0.62 * h * 0.34));
  k.fillStyle = '#4B5563'; k.fillRect(Math.round(w * 0.11), topo - 6, Math.round(w * 0.17), 3);
  k.fillStyle = '#9CA3AF'; k.fillRect(Math.round(w * 0.14), topo - 9, Math.round(w * 0.11), 3);
  k.fillStyle = '#FDE68A';
  for (let x = Math.round(w * 0.15); x < w * 0.24; x += 2) k.fillRect(x, topo - 8, 1, 1);
  k.fillStyle = '#9CA3AF'; k.fillRect(Math.round(w * 0.3), topo - 9, 1, 3);
  // as janelinhas da face de baixo (sorteio fixo: a nave é sempre a mesma)
  const r = rng(w * 31 + 7);
  for (let i = 0; i < Math.round(w / 5); i++) {
    const x = w * (0.04 + 0.8 * r()), y0 = N.quina(x) + 2, y1 = N.baixo(x) - 2;
    if (y1 <= y0) continue;
    k.fillStyle = r() < 0.75 ? '#BFDBFE' : '#FDE68A';
    k.fillRect(Math.round(x), Math.round(y0 + (y1 - y0) * r()), 1, 1);
  }
  // os motores na popa
  for (const y of N.motores) {
    k.fillStyle = '#111827'; k.fillRect(0, Math.round(y), 2, N.motorH);
    k.fillStyle = '#60A5FA'; k.fillRect(0, Math.round(y) + 0.5, 1, N.motorH - 1);
  }
  return NAVES.set(w, c);
}

// o céu do palco (fundo escuro, a nebulosa vermelha e roxa, as estrelas), pronto no tamanho da tela
const CEUS = cache(4);
function ceu(cw, HJ, e) {
  const W = Math.round(cw * e), H = Math.round(HJ * e), chave = `${W}x${H}`;
  const pronto = CEUS.get(chave);
  if (pronto) return pronto;
  const c = tela(W, H), k = c.getContext('2d'), r = rng(1977);
  k.fillStyle = '#05060A'; k.fillRect(0, 0, W, H);
  for (const [cor, a] of [['#7F1D1D', 0.26], ['#4C1D95', 0.18], ['#7F1D1D', 0.16]]) {
    const x = r() * W, y = r() * H, raio = (0.35 + 0.3 * r()) * Math.max(W, H), gr = k.createRadialGradient(x, y, 0, x, y, raio);
    gr.addColorStop(0, rgba(cor, a)); gr.addColorStop(1, rgba(cor, 0));
    k.fillStyle = gr; k.fillRect(0, 0, W, H);
  }
  // as estrelas no pixel da tela (nítidas em qualquer escala); umas coloridas, umas maiores
  for (let i = 0, n = Math.round(W * H / 650); i < n; i++) {
    const x = Math.floor(r() * W), y = Math.floor(r() * H), b = r(), s = b > 0.96 && e >= 1.2 ? 2 : 1;
    k.fillStyle = b < 0.07 ? '#FECACA' : b < 0.14 ? '#BFDBFE' : rgba('#E5E7EB', 0.3 + 0.7 * r());
    k.fillRect(x, y, s, s);
  }
  return CEUS.set(chave, c);
}

// o planeta vermelho da chegada (raio R em DIPs), pronto no tamanho da tela
const PLANETAS = cache(4);
function planeta(R, e) {
  const rr = R * e, D = Math.ceil(2 * rr) + 4, chave = `${D}`;
  const pronto = PLANETAS.get(chave);
  if (pronto) return pronto;
  const c = tela(D, D), k = c.getContext('2d'), cx = D / 2, cy = D / 2;
  k.save();
  k.beginPath(); k.arc(cx, cy, rr, 0, Math.PI * 2); k.clip();
  k.fillStyle = '#5B0F0F'; k.fillRect(0, 0, D, D);
  const r = rng(66);
  for (let i = 0; i < 9; i++) {  // as faixas
    const y = cy - rr + (i + 0.5) * 2 * rr / 9 + (r() - 0.5) * rr * 0.08;
    k.fillStyle = rgba(i % 2 ? '#7F1D1D' : '#3F0A0A', 0.7); k.fillRect(0, Math.round(y), D, Math.max(1, Math.round(rr * (0.05 + 0.06 * r()))));
  }
  const luz = k.createRadialGradient(cx - 0.45 * rr, cy - 0.55 * rr, 0, cx - 0.45 * rr, cy - 0.55 * rr, 1.3 * rr);
  luz.addColorStop(0, rgba('#F87171', 0.55)); luz.addColorStop(1, rgba('#F87171', 0));
  k.fillStyle = luz; k.fillRect(0, 0, D, D);
  const sombra = k.createRadialGradient(cx + 0.55 * rr, cy + 0.45 * rr, 0, cx + 0.55 * rr, cy + 0.45 * rr, 1.25 * rr);
  sombra.addColorStop(0, rgba('#000000', 0.7)); sombra.addColorStop(1, rgba('#000000', 0));
  k.fillStyle = sombra; k.fillRect(0, 0, D, D);
  k.restore();
  // a atmosfera: um fio claro na borda do lado da luz
  k.fillStyle = rgba('#FCA5A5', 0.8);
  for (let a = Math.PI * 0.95; a < Math.PI * 1.75; a += 0.6 / rr) k.fillRect(Math.round(cx + Math.cos(a) * rr), Math.round(cy + Math.sin(a) * rr), 1, 1);
  return PLANETAS.set(chave, c);
}

// ---------- o plano (pela semente) ----------
// curva de Bézier quadrática do caça: começa em te, dura D, p0 -> c -> p1; balança 1 px
function posCaca(f, t) {
  const u = (t - f.te) / f.D, v = 1 - u;
  return [v * v * f.p0[0] + 2 * u * v * f.c[0] + u * u * f.p1[0], v * v * f.p0[1] + 2 * u * v * f.c[1] + u * u * f.p1[1] + Math.sin(t * 6 + f.fase)];
}
// onde a nave está em t: x (popa), y (topo do desenho), sx (esticada no salto) e se aparece
function naveEm(J, t) {
  const N = J.nave;
  let x, sx = 1, y = N.y + Math.sin(t * 1.3) * 0.8;
  if (t < T.salta[1]) {
    x = -N.w - 24 + (N.x + N.w + 24) * sai(fatia(t, T.nave[0], T.nave[1]));
    if (t >= T.carga[0] + 0.7) { const k = fatia(t, T.carga[0] + 0.7, T.salta[0]); x += Math.sin(t * 70) * 0.8 * k; y += Math.cos(t * 63) * 0.5 * k; }
    if (t >= T.salta[0]) { const u = entra(fatia(t, T.salta[0], T.salta[1])); sx = 1 + 3 * u; x += (J.cw + 40) * u; }
    return { x, y, sx, ve: t >= T.nave[0] && t < T.salta[1] };
  }
  if (t < T.sai) return { ve: false };
  const u = sai(fatia(t, T.sai, T.sai + 0.25));  // chega: vem de trás, esticada, e encolhe no lugar
  x = -N.w * 2 + (N.x + 6 + N.w * 2) * u + 4 * fatia(t, T.sai + 0.25, T.fecha[1]);
  return { x, y, sx: 1 + 3 * (1 - u), ve: true };
}
// um ponto da barriga da nave (fração f do comprimento) em t, no palco
function barrigaEm(J, f, t) {
  const n = naveEm(J, Math.min(t, T.salta[0])), M = J.nave.M;
  return [n.x + f * J.nave.w, n.y + M.baixo(f * J.nave.w)];
}

function montar(m, r) {
  const c = m.host.cartao || [98, 260, 248, 146], casa = m.pose();
  const cw = c[2], HJ = Math.round(lim(c[1] - 14, 112, 184)), X0 = casa.x - c[0];
  const w = Math.round(Math.min(cw * 0.66, HJ * 0.95)), M = medidasNave(w);
  const J = { cw, HJ, X0, nave: { w, M, x: Math.round(cw * 0.06), y: -HJ + 6 } };
  J.barriga = J.nave.y + M.topo + M.h;
  // o voo: ~metade do vão entre o cartão e a barriga da nave, a ~1/3 do palco (o gigante cabe na
  // frente); balança de lado sem sair do palco
  J.alt = Math.round(lim(-J.barriga * 0.5, 22, 66));
  J.Xb = Math.round(lim(cw * 0.32, 24, cw - 110));
  J.deriva = lim(Math.min(J.Xb - 14, cw - J.Xb - 30), 0, 7);
  const banda = [J.barriga + 9, Math.max(J.barriga + 11, Math.min(-42, -(J.alt + 30)))];
  const naBanda = () => banda[0] + (banda[1] - banda[0]) * r();
  J.cacas = [];
  // os que a torre derruba: entram pela direita e cruzam o palco; a torre acerta no meio do caminho
  for (const t0 of TORRE) {
    const th = t0 + (r() - 0.5) * 0.2, D = (cw + 36) / (80 + 25 * r()), te = th - D * (0.3 + 0.35 * r());
    const f = { tipo: 'torre', th, te, D, fase: r() * 6, p0: [cw + 12, naBanda()], c: [cw / 2 + (r() - 0.5) * 60, naBanda()], p1: [-24, naBanda()] };
    if (th - te > 0.7) f.ts = te + (th - te) * 0.45;  // antes, ele atira na nave
    const alvo = posCaca(f, th);
    f.torre = [0.25, 0.45, 0.65].reduce((a, b) => (Math.abs(barrigaEm(J, b, th)[0] - alvo[0]) < Math.abs(barrigaEm(J, a, th)[0] - alvo[0]) ? b : a));
    J.cacas.push(f);
  }
  // os que mergulham no Clawd: descem do alto, atiram em tf (no fundo da curva) e o sabre devolve
  for (const b0 of BATE) {
    const tb = b0 + (r() - 0.5) * 0.24, tf = tb - VOO, th = tb + VOLTA, D = 2.2, cl = clawdEm(J, tb);
    const lado = J.Xb + 110 <= cw - 10 ? 1 : -1, xq = lim(X0 + cl.x + lado * (40 + 30 * r()), 20, cw - 20);
    const yq = Math.max(J.barriga + 10, cl.y - 28 - 6 * r()), q = [xq, yq];
    const p0 = [xq + 70, -HJ - 14], p1 = [xq - 80, -HJ - 14];
    const s = [X0 + cl.x + SABRE[0], cl.y + SABRE[1]];  // onde o tiro bate no sabre (o Clawd no ar, em tb)
    J.cacas.push({ tipo: 'mergulho', tb, tf, th, te: tf - D / 2, D, fase: r() * 6, p0, p1, s, c: [2 * q[0] - (p0[0] + p1[0]) / 2, 2 * q[1] - (p0[1] + p1[1]) / 2] });
  }
  J.cacas.sort((a, b) => a.te - b.te);
  // o gigante: na frente do Clawd se cabe, senão atrás (e olhando pra ele)
  const dir = J.Xb + 80 + GW / 2 <= cw - 6 ? 1 : -1;
  J.gigante = { x: lim(J.Xb + dir * 80, GW / 2 + 6, cw - GW / 2 - 6), y: Math.max(J.barriga + 26, Math.min(-54, -HJ * 0.48)), dir };
  const rd = rng(Math.floor(r() * 4294967296));
  J.destrocos = Array.from({ length: 16 }, () => ({ a: rd() * Math.PI * 2, v: 40 + rd() * 90, s: rd() < 0.4 ? 3 : 2, cor: rd() < 0.5 ? '#6B7280' : '#9CA3AF', gira: rd() * 6 }));
  J.estrelas = Array.from({ length: 64 }, () => ({ a: rd() * Math.PI * 2, r0: 0.15 + 0.85 * rd(), z: rd(), v: 0.75 + 0.5 * rd() }));
  J.sem = Math.floor(rd() * 4294967296);
  return J;
}

// ---------- o quadro ----------

function desenharCacas(g, t, J, X, Y) {
  const img = arte(CACA, COR);
  for (const f of J.cacas) {
    if (t < f.te) continue;
    if (t < f.th) { const [x, y] = posCaca(f, t); g.drawImage(img, X(x - CW / 2), Y(y - CH / 2), CW, CH); }
    // o tiro do caça na nave, e a faísca no casco
    if (f.ts != null && t >= f.ts && t < f.ts + VB + 0.5) {
      const de = posCaca(f, f.ts), ate = barrigaEm(J, 0.35 + 0.4 * ((f.fase / 6) % 1), f.ts + VB), d = t - f.ts;
      if (d < VB) { const u = d / VB; A.tiro(g, de[0] + (ate[0] - de[0]) * u, de[1] + (ate[1] - de[1]) * u, Math.atan2(ate[1] - de[1], ate[0] - de[0])); }
      else A.faiscas(g, ate[0], ate[1], d - VB, J.sem + f.te * 1000, 6);
    }
    if (f.tipo === 'torre') {  // o tiro vermelho da torre
      const d = t - (f.th - VT);
      if (d >= 0 && d < VT) {
        const de = barrigaEm(J, f.torre, f.th - VT), ate = posCaca(f, f.th), u = d / VT;
        if (d < 0.06) { g.fillStyle = '#FEF3C7'; g.fillRect(de[0] - 1.5, de[1] - 0.5, 3, 3); }
        A.tiro(g, de[0] + (ate[0] - de[0]) * u, de[1] + (ate[1] - de[1]) * u, Math.atan2(ate[1] - de[1], ate[0] - de[0]), '#EF4444');
      }
    } else {  // o tiro verde até o sabre, e rebatido de volta no caça
      const s = f.s;
      if (t >= f.tf && t < f.tb) {
        const de = posCaca(f, f.tf), u = (t - f.tf) / VOO;
        A.tiro(g, de[0] + (s[0] - de[0]) * u, de[1] + (s[1] - de[1]) * u, Math.atan2(s[1] - de[1], s[0] - de[0]));
      } else if (t >= f.tb && t < f.th) {
        const ate = posCaca(f, f.th), u = (t - f.tb) / VOLTA;
        A.tiro(g, s[0] + (ate[0] - s[0]) * u, s[1] + (ate[1] - s[1]) * u, Math.atan2(ate[1] - s[1], ate[0] - s[0]));
      }
      A.faiscas(g, s[0], s[1], t - f.tb, J.sem + f.tb * 1000, 8);
    }
    if (t >= f.th) { const [x, y] = posCaca(f, f.th); explosao(g, x, y, t - f.th, J.sem + Math.round(f.th * 977)); }
  }
}

function desenharGigante(g, t, J, X, Y) {
  const G = J.gigante;
  if (t < T.gigante[0] || t > T.boom + 2.2) return;
  if (t < T.boom) {
    // chega do hiperespaço: vem da direita (ou da esquerda) esticado e encolhe no lugar
    const u = sai(fatia(t, T.gigante[0], T.gigante[1])), de = G.dir > 0 ? J.cw + GW : -GW;
    let x = de + (G.x - de) * u, y = G.y, sx = 1 + 3 * (1 - u), sy = 1;
    if (t >= T.agarra) y -= 6 * sai(fatia(t, T.agarra, T.treme[1]));
    if (t >= T.treme[0]) { x += Math.sin(t * 60) * 1.3; y += Math.cos(t * 47) * 0.8; }
    const aperta = 1 - 0.45 * entra(fatia(t, T.amassa[0], T.amassa[1]));
    sx *= aperta; sy = 1 + (1 - aperta) * 0.3;
    const forca = fatia(t, T.agarra, T.agarra + 0.3);
    if (forca > 0) {  // o brilho vermelho da Força em volta dele
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(x, y, 6, x, y, 44);
      gr.addColorStop(0, rgba(A.SITH.forca, 0.5 * forca)); gr.addColorStop(1, rgba(A.SITH.forca, 0));
      g.fillStyle = gr; g.fillRect(x - 44, y - 44, 88, 88); g.restore();
    }
    g.save(); g.translate(X(x), Y(y)); g.scale(sx * G.dir, sy);
    g.drawImage(arte(GIGANTE, COR), -GW / 2, -GH / 2, GW, GH);
    g.restore();
    // o olho carregando: brilho que cresce e faíscas sendo puxadas pra dentro; a Força corta a carga
    const carga = fatia(t, T.mira[0], T.mira[1]) * (1 - fatia(t, T.agarra + 0.1, T.agarra + 0.6));
    if (carga > 0 && t < T.amassa[0]) {
      const ox = x + G.dir * OLHO[0] * sx, oy = y + OLHO[1], pisca = 0.75 + 0.25 * Math.sin(t * 40);
      g.save(); g.globalCompositeOperation = 'lighter';
      const gr = g.createRadialGradient(ox, oy, 0, ox, oy, 4 + 12 * carga);
      gr.addColorStop(0, rgba('#FECACA', 0.9 * carga * pisca)); gr.addColorStop(1, rgba('#EF4444', 0));
      g.fillStyle = gr; g.fillRect(ox - 16, oy - 16, 32, 32);
      g.restore();
      const r = rng(4747);
      g.fillStyle = '#FCA5A5';
      for (let i = 0; i < 7; i++) {
        const a = r() * Math.PI * 2, k = (t * 1.6 + r()) % 1, d = 22 * (1 - k);
        g.fillRect(ox + Math.cos(a) * d, oy + Math.sin(a) * d, 1, 1);
      }
    }
    if (forca > 0) {
      // o fio da Força: uma onda vermelha que sai da mão e chega nele; e os estalos em volta
      const cl = clawdEm(J, t), mx = J.X0 + cl.x + MAO[0], my = cl.y + MAO[1], dx = x - mx, dy = y - my, L = Math.hypot(dx, dy) || 1, nx = -dy / L, ny = dx / L;
      g.save(); g.globalCompositeOperation = 'lighter';
      for (let i = 0; i < 28; i++) {
        const k = (i / 28 + t * 0.9) % 1, meio = Math.sin(Math.PI * k), w = Math.sin(k * 14 - t * 18) * 3 * meio;
        g.fillStyle = rgba(i % 3 ? A.SITH.forca : '#FECACA', (0.35 + 0.55 * meio) * forca);
        g.fillRect(mx + dx * k + nx * w - 0.5, my + dy * k + ny * w - 0.5, 1.5, 1.5);
      }
      g.restore();
      if (t >= T.treme[0]) {
        const r = rng((J.sem + Math.floor(t * 15) * 7919) >>> 0);
        g.fillStyle = r() < 0.5 ? '#FECACA' : A.SITH.verm;
        for (let i = 0; i < 2; i++) {
          let a = r() * Math.PI * 2, px = x + Math.cos(a) * 24, py = y + Math.sin(a) * 18;
          for (let s = 0; s < 4; s++) { a += (r() - 0.5) * 1.4; const nx = px + Math.cos(a) * 3, ny = py + Math.sin(a) * 3; g.fillRect(Math.min(px, nx), Math.min(py, ny), Math.abs(nx - px) + 1, Math.abs(ny - py) + 1); px = nx; py = ny; }
        }
      }
    }
    if (t >= T.amassa[0]) A.faiscas(g, x, y, (t - T.amassa[0]) % 0.25, J.sem + Math.floor((t - T.amassa[0]) / 0.25), 9, ['#FDE68A', '#EF4444', '#FECACA']);
    return;
  }
  // estourou: bola de fogo, a onda de choque achatada, os destroços e a fumaça
  const d = t - T.boom, x = G.x, y = G.y - 6;
  if (d < 0.7) {
    const u = d / 0.7, raio = 6 + 30 * sai(u);
    g.save(); g.globalAlpha *= 1 - entra(u);
    for (const [f, cor] of [[1, '#B91C1C'], [0.8, '#F97316'], [0.55, '#FDE68A'], [0.3, '#FFFFFF']]) { g.fillStyle = cor; g.beginPath(); g.arc(x, y, raio * f, 0, Math.PI * 2); g.fill(); }
    g.restore();
  }
  if (d < 1.1) {
    const u = d / 1.1, rx = 12 + 240 * sai(u), ry = 3 + 26 * sai(u);
    g.save(); g.globalAlpha *= 1 - u; g.fillStyle = '#FECACA';
    for (let i = 0; i < 72; i++) { const a = i * Math.PI * 2 / 72; g.fillRect(x + Math.cos(a) * rx, y + Math.sin(a) * ry, 1.5, 1); }
    g.fillStyle = '#FFFFFF';
    const r2 = 8 + 70 * sai(u);
    for (let i = 0; i < 40; i++) { const a = i * Math.PI * 2 / 40; g.fillRect(x + Math.cos(a) * r2, y + Math.sin(a) * r2, 1, 1); }
    g.restore();
  }
  g.save(); g.globalAlpha *= 1 - fatia(d, 1.4, 2.2);
  for (const p of J.destrocos) {
    const k = p.v * (1 - Math.exp(-2.2 * d)) / 2.2;
    g.fillStyle = p.cor; g.fillRect(x + Math.cos(p.a) * k, y + Math.sin(p.a) * k * 0.8, p.s, Math.floor(d * 8 + p.gira) % 2 ? p.s : p.s - 1);
  }
  g.restore();
  A.fumaca(g, x - 6, y, d - 0.3, 1.6);
  A.fumaca(g, x + 6, y + 2, d - 0.45, 1.5);
  A.faiscas(g, x, y, d, J.sem + 31, 16, ['#FDE68A', '#F97316', '#FFFFFF']);
}

// as estrelas do salto: esticam em riscos saindo do ponto de fuga, depois o túnel que gira
function desenharSalto(g, t, J) {
  const vx = J.cw / 2, vy = -J.HJ / 2, R = Math.hypot(J.cw, J.HJ) / 2;
  if (t >= T.estica[0] && t < T.tunel[0] + 0.15) {
    const estica = 2.5 * entra(fatia(t, T.estica[0], T.estica[1])), some = 1 - fatia(t, T.tunel[0], T.tunel[0] + 0.15);
    for (const s of J.estrelas) {
      const dx = Math.cos(s.a) * s.r0 * R, dy = Math.sin(s.a) * s.r0 * R * 0.7, n = Math.max(1, Math.ceil(6 * estica));
      for (let k = 0; k <= n; k++) {
        const f = 1 + estica * k / n;
        g.fillStyle = rgba(k === n ? '#FFFFFF' : '#93C5FD', (0.25 + 0.6 * k / n) * some);
        g.fillRect(vx + dx * f, vy + dy * f, 1, 1);
      }
    }
  }
  if (t < T.tunel[0] || t >= T.sai + 0.1) return;
  const d = t - T.tunel[0], aparece = fatia(t, T.tunel[0], T.tunel[0] + 0.3) * (1 - fatia(t, T.sai - 0.1, T.sai + 0.1));
  // o fundo azul do túnel e o brilho no ponto de fuga
  g.fillStyle = rgba('#0B1D4D', 0.8 * aparece); g.fillRect(0, -J.HJ, J.cw, J.HJ);
  g.save(); g.globalCompositeOperation = 'lighter';
  const nucleo = g.createRadialGradient(vx, vy, 0, vx, vy, 26);
  nucleo.addColorStop(0, rgba('#E0F2FE', (0.55 + 0.2 * Math.sin(t * 9)) * aparece)); nucleo.addColorStop(1, rgba('#3B82F6', 0));
  g.fillStyle = nucleo; g.fillRect(vx - 26, vy - 26, 52, 52);
  g.restore();
  // os riscos: cada estrela vem do fundo (z) e acelera pra fora, girando devagar
  for (const s of J.estrelas) {
    const z = (s.z + d * 0.85 * s.v) % 1, r = 6 + R * 1.15 * z * z, cauda = r * (0.55 + 0.2 * z), a = s.a + 0.35 * d;
    const ca = Math.cos(a), sa = Math.sin(a) * 0.75, n = 5;
    for (let k = 0; k <= n; k++) {
      const q = cauda + (r - cauda) * k / n;
      g.fillStyle = rgba(z > 0.6 && k === n ? '#FFFFFF' : z > 0.3 ? '#BFDBFE' : '#60A5FA', (0.2 + 0.7 * z) * (0.35 + 0.65 * k / n) * aparece);
      g.fillRect(vx + ca * q, vy + sa * q, 1, 1);
    }
  }
  // anéis de luz passando
  for (let i = 0; i < 2; i++) {
    const u = (d / 0.6 + i * 0.5) % 1, r = 4 + R * 1.1 * u * u;
    g.fillStyle = rgba('#93C5FD', 0.45 * (1 - u) * aparece);
    for (let k = 0; k < 32; k++) { const a = k * Math.PI / 16 + i; g.fillRect(vx + Math.cos(a) * r, vy + Math.sin(a) * r * 0.75, 1, 1); }
  }
}

function desenharNave(g, t, J, X, Y) {
  const n = naveEm(J, t);
  if (!n.ve) return;
  const N = J.nave, img = naveMae(N.w), M = N.M;
  const motor = t < T.carga[0] ? 0.5 : t < T.salta[1] ? 0.5 + 1.1 * fatia(t, T.carga[0], T.salta[0]) : 1;
  g.save(); g.translate(X(n.x), Y(n.y)); g.scale(n.sx, 1);
  g.drawImage(img, 0, 0, N.w + 1, M.alt);
  // o brilho dos motores (pra trás da popa)
  g.globalCompositeOperation = 'lighter';
  const L = 3 + 7 * motor;
  for (const y of M.motores) {
    g.fillStyle = rgba('#3B82F6', Math.min(1, 0.35 * motor)); g.fillRect(-L, y - 1, L, M.motorH + 2);
    g.fillStyle = rgba('#E0F2FE', Math.min(1, 0.5 * motor)); g.fillRect(-L * 0.5, y, L * 0.5, M.motorH);
  }
  g.restore();
}

function desenhar(g, t, m, J) {
  const e = m.host.escala || 1, c = m.host.cartao;
  if (!c) return;
  const OX = c[0], OY = c[1];
  const ab = t < T.fecha[0] ? sai(fatia(t, T.abre[0], T.abre[1])) : 1 - entra(fatia(t, T.fecha[0], T.fecha[1]));
  if (ab <= 0) return;
  const topo = Math.round(-J.HJ * ab * e) / e;
  // o tremor da explosão (tudo, menos o céu)
  const tr = t >= T.boom && t < T.boom + 0.5 ? 1 - (t - T.boom) / 0.5 : 0;
  const sx = Math.round(Math.sin(t * 93) * 2.5 * tr), sy = Math.round(Math.cos(t * 71) * 2 * tr);
  const X = v => Math.round((OX + v + sx) * e) / e - OX, Y = v => Math.round((OY + v + sy) * e) / e - OY;
  g.save();
  // o céu: o pedaço que já abriu, no pixel da tela
  const img = ceu(J.cw, J.HJ, e), hp = Math.round(-topo * e);
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (hp > 0) g.drawImage(img, 0, img.height - hp, img.width, hp, Math.round(OX * e), Math.round(OY * e) - hp, img.width, hp);
  g.setTransform(e, 0, 0, e, OX * e, OY * e);
  g.beginPath(); g.rect(0, topo, J.cw, -topo); g.clip();
  // a chegada: o planeta subindo atrás
  if (t >= T.sai) {
    const R = J.cw * 0.55, u = sai(fatia(t, T.sai, T.sai + 1.2)), pl = planeta(R, e);
    const cx = J.cw * 0.7, cy = R * 0.62 + 24 - 24 * u, x0 = Math.round((OX + cx) * e - pl.width / 2), y0 = Math.round((OY + cy) * e - pl.height / 2);
    const corte = Math.min(pl.height, Math.round(OY * e) - y0);
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (corte > 0) g.drawImage(pl, 0, 0, pl.width, corte, x0, y0, pl.width, corte);
    g.setTransform(e, 0, 0, e, OX * e, OY * e);
  }
  desenharSalto(g, t, J);
  desenharNave(g, t, J, X, Y);
  desenharCacas(g, t, J, X, Y);
  desenharGigante(g, t, J, X, Y);
  // os clarões: o estouro do gigante (quente, saindo dele), o salto e a saída do túnel (brancos)
  if (t >= T.boom && t < T.boom + 0.35) {
    const u = 1 - (t - T.boom) / 0.35, fx = J.gigante.x, fy = J.gigante.y - 6;
    g.save(); g.globalCompositeOperation = 'lighter';
    const gr = g.createRadialGradient(fx, fy, 0, fx, fy, J.cw);
    gr.addColorStop(0, rgba('#FFF7ED', 0.95 * u)); gr.addColorStop(0.2, rgba('#F97316', 0.5 * u)); gr.addColorStop(1, rgba('#7F1D1D', 0.2 * u));
    g.fillStyle = gr; g.fillRect(0, topo, J.cw, -topo); g.restore();
  }
  let clarao = 0;
  if (t >= T.salta[1] - 0.05 && t < T.salta[1] + 0.35) clarao = Math.max(clarao, 0.9 * (1 - fatia(t, T.salta[1], T.salta[1] + 0.35)));
  if (t >= T.sai - 0.05 && t < T.sai + 0.4) clarao = Math.max(clarao, 0.95 * (1 - fatia(t, T.sai, T.sai + 0.4)));
  if (clarao > 0) { g.fillStyle = rgba('#FFFFFF', clarao); g.fillRect(0, topo, J.cw, -topo); }
  g.restore();
  // a moldura do palco: vermelha, com a borda de cima acesa enquanto abre e fecha
  g.save(); g.setTransform(e, 0, 0, e, OX * e, OY * e);
  const borda = t < T.abre[1] || t >= T.fecha[0] ? '#FCA5A5' : '#B91C1C';
  g.fillStyle = '#B91C1C';
  g.fillRect(0, topo, 1, -topo); g.fillRect(J.cw - 1, topo, 1, -topo);
  g.fillStyle = borda; g.fillRect(0, topo, J.cw, 1);
  g.restore();
}

// levitando: um anel achatado de faíscas da Força girando embaixo dele e 3 pedrinhas que sobem junto
const PEDRAS = [[-9, 6, 2, 0], [5, 9, 1.5, 1.7], [10, 4.5, 1.5, 3.1]];
function levita(g, c, t) {
  if (c.k <= 0.02) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const a = i * Math.PI / 8 + t * 2.4, frente = Math.sin(a) > 0 ? 1 : 0.45;
    g.fillStyle = rgba(i % 4 ? A.SITH.forca : '#FECACA', 0.6 * frente * c.k);
    g.fillRect(c.x + Math.cos(a) * 10 - 0.5, c.y + 2.5 + Math.sin(a) * 2.2 - 0.5, 1, 1);
  }
  g.restore();
  g.save(); g.globalAlpha *= c.k;
  for (const [px, py, l, f] of PEDRAS) {
    const y = c.y + py + Math.sin(t * 2 + f) * 1.2;
    g.fillStyle = '#6B7280'; g.fillRect(c.x + px, y, l, l);
    g.fillStyle = '#9CA3AF'; g.fillRect(c.x + px, y, l * 0.5, l * 0.5);
  }
  g.restore();
}

// o Clawd: levita na Força, sabre pronto, as defesas (como no 'deflete'), a mão
// erguida na Força, o sabre alto no salto e a capa voando no túnel; desce e, no fim, a pose do passeio
function desenharClawd(g, t, J, T0, m) {
  let ang = 25, len = 1, x = 0, y = 0, bracos = null, aura = 0, vento = 0.4;
  for (const f of J.cacas) {
    if (f.tipo !== 'mergulho') continue;
    const d = t - f.tb;
    if (d > -0.18 && d < 0.12) ang = d < 0 ? 25 - 55 * sai((d + 0.18) / 0.18) : -30 + 55 * (d / 0.12);
    if (d >= 0 && d < 0.15) x = -1.5 * Math.sin(Math.PI * d / 0.15);
  }
  if (t >= T.apaga[0] && t < T.reacende[1]) {
    len = t < T.reacende[0] ? 1 - fatia(t, T.apaga[0], T.apaga[1]) : fatia(t, T.reacende[0], T.reacende[1]);
    ang = 160;
    if (t >= T.agarra - 0.05 && t < T.solta[1]) bracos = [0, -3];
    aura = 0.8 * fatia(t, T.agarra, T.agarra + 0.3) * (1 - fatia(t, T.solta[0], T.solta[1]));
  }
  if (t >= T.reacende[1]) {
    ang = 25 - 29 * sai(fatia(t, T.carga[0], T.carga[0] + 0.3)) + 29 * sai(fatia(t, T.volta[0], T.volta[1]));
    if (t >= T.salta[0] && t < T.salta[0] + 0.4) y = -3 * Math.sin(Math.PI * (t - T.salta[0]) / 0.4);
    vento = 0.4 + 0.6 * (fatia(t, T.tunel[0], T.tunel[0] + 0.3) - fatia(t, T.sai, T.sai + 0.6));
  }
  const cl = clawdEm(J, t);
  x += cl.x; y += cl.y; aura = Math.max(aura, cl.aura);
  if (cl.k > 0) vento = Math.max(vento, 0.4 + 0.3 * cl.k);
  g.save();
  g.setTransform(T0.a, T0.b, T0.c, T0.d, T0.e, T0.f);
  levita(g, cl, t);
  A.clawdSith(g, { T: m.T, x, y, bracos, aura, vento, sabre: { ang, len } });
  g.restore();
}

// a trilha (som.js): tudo sai do plano, então cada tiro, rebatida e explosão soa na hora certa
const SS = n => `sons-sith/${n}.wav`, VOLUME = 0.72;  // VOLUME: a trilha mixada dá ~-22 LUFS, como os épicos dos outros temas
function sons(J) {
  const L = [[0, SS('hiper-abre'), 0.6], [T.nave[0], SS('nave'), 0.8], [T.nave[0] + 0.3, SS('frota'), 0.9]];
  for (const f of J.cacas) {
    if (f.ts != null) L.push([f.ts, SS('blaster'), 0.22, 0.9]);
    if (f.tipo === 'torre') L.push([f.th - VT, SS('laser'), 0.4]);
    else L.push([f.tf, SS('blaster'), 0.35], [f.tb, SS('rebate'), 0.7]);
    L.push([f.th, SS('explode'), 0.5]);
  }
  L.push([T.gigante[0], SS('salto'), 0.5, 1.3], [T.mira[0], SS('carga'), 0.3, 1.6, T.agarra + 0.4 - T.mira[0]]);
  L.push([T.agarra, SS('forca'), 0.85], [T.amassa[0], SS('amassa'), 0.7], [T.boom, SS('boom'), 1]);
  L.push([T.reacende[0], SS('terminou'), 1]);  // o sabre acendendo (o aviso, que já é baixinho)
  L.push([T.carga[0], SS('carga'), 0.6], [T.salta[0] - 0.42, SS('salto'), 0.9], [T.tunel[0], SS('tunel'), 0.8], [T.sai, SS('chegada'), 0.8]);
  L.push([T.fecha[0], SS('hiper-abre'), 0.35, 0.75]);
  L.push([VOA.sobe[0], SS('forca'), 0.4, 1.25], [VOA.desce[0], SS('forca'), 0.25, 0.8]);  // levita e desce
  return L.map(([t, a, g, ...r]) => [t, a, g * VOLUME, ...r]);
}

function cena(m) {
  const semente = Math.floor(m.sorteio() * 4294967296);
  const J = montar(m, rng(semente));
  return {
    nome: 'epico', dur: T.dur, espaco: { frente: 0, tras: 0 }, modos: ['andando'],
    plano: J,  // pros testes
    sons: sons(J),
    quadro(g, t, mundo) {
      const T0 = g.getTransform(), mm = mundo || m;
      desenhar(g, t, mm, J);
      desenharClawd(g, t, J, T0, mm);  // a capa e o tremor do sabre no relógio do motor (mm.T), como nas outras cenas
    },
  };
}

module.exports = { linhaDoTempo, cena, T, VOA, SABRE, MAO, GW, GH, posCaca, clawdEm };  // do T em diante: pros testes
