'use strict';
// Evento épico raro do tema Elden Ring (a cada 30 inimigos abatidos), 13 a 16 s: a LUTA DE CHEFE. Um chefe do jogo (Margit,
// Godrick, Malenia e Radahn, em rodízio: m.salvo.eldenChefe) espera na névoa acima do cartão; o nome dele e a barra de vida
// ficam no TOPO do palco, fora do cartão. Cada chefe luta do jeito dele no jogo e o Clawd responde como o jogador: rola por
// baixo do golpe, espera o golpe atrasado do Margit e rola no último instante, corre do fogo e dos meteoros, pula a onda no
// chão ou apanha; contra-ataca, bebe o frasco, prende o Margit com o Grilhão e crava o golpe final; o chefe se ajoelha e se
// desfaz em luz dourada, e o letreiro dourado "GRANDE INIMIGO ABATIDO" cruza o palco. Cada chefe traz o desenho, o jeito dos
// dois ataques e a luta dele (elden-chefe-<id>.js: { id, nome, H, W, desenha, efeito?, ataques: [{nome, acerta} x2], luta? }).
//
// Tudo é função de t (a semente só mexe nas brasas e nas estrelas). Coordenadas do palco: DIPs a partir do canto de cima à
// esquerda do cartão (X pra direita, Y- pra cima, 0 = borda de cima do cartão, onde o Clawd e o chefe pisam), como nos outros épicos.
const { lim, sai, entra, cache, tela, rng, rgba, tr } = require('./comum');
const A = require('./elden-arte');

const { fatia, COR } = A;
const CHEFES = ['margit', 'godrick', 'malenia', 'radahn'];
const NUNCA = [1e3, 1e3 + 1];  // o que não acontece num roteiro: bem depois do fim (Infinity daria NaN no fatia)
const RESPOSTAS = ['rola', 'rolaTarde', 'corre', 'pula', 'apanha'];  // o que o Clawd faz em cada ataque
const CORTE = 0.5, ACERTO = 0.42;  // s: o golpe do Clawd e quando ele acerta, desde o começo do golpe
const suave = u => u * u * (3 - 2 * u);

// ---------- a luta (s) ----------
// A luta de um chefe (chefe.luta), em dados:
//   ataques: [[animação 0|1, início, duração, resposta do Clawd], ...]; o golpe cai em início + duração × acerta da animação
//   cortes:  [[início, vida do chefe depois], ...]: os golpes do Clawd
//   curas:   [[quando, vida depois], ...]: a vida que SOBE (a Malenia se cura quando acerta)
//   frasco, grilhao (o Grilhão de Margit: o chefe fica preso de joelhos) e final (o salto): quando começam
// roteiro(luta) monta o resto: a entrada é sempre a mesma e o fim sai do salto final.
function roteiro(L) {
  const f = L.final, g = L.grilhao;
  return {
    abre: [0, 0.6], vai: [0.1, 0.9], entra: [0.5, 1.9], nome: [0.8, 1.4], barra: [1.0, 1.9],
    ataques: L.ataques.map(([id, t, dur, resp]) => ({ id, t, dur, resp })),
    cortes: L.cortes.map(([t]) => [t, t + CORTE]),
    vida: [...L.cortes.map(([t, v]) => [t + ACERTO, v]), ...(L.curas || []), [f + 0.5, 0]].sort((a, b) => a[0] - b[0]),
    frasco: L.frasco === undefined ? NUNCA : [L.frasco, L.frasco + 0.9],
    grilhao: g === undefined ? NUNCA : [g, g + 0.8], preso: g === undefined ? NUNCA : [g + 0.5, g + 2.7],
    salto: [f, f + 0.5], final: [f, f + 0.8], hf: f + 0.5,
    ajoelha: [f + 0.8, f + 1.4], morte: [f + 1.4, f + 2.4], letreiro: [f + 1.5, f + 2.9], volta: [f + 2.5, f + 3], fecha: [f + 3, f + 3.5], dur: f + 3.6,
  };
}
// a luta de quem não traz a dele: rola do 1º ataque, apanha do 2º, frasco, dois golpes e o salto
const PADRAO = { ataques: [[0, 2.3, 2, 'rola'], [1, 5.2, 2, 'apanha']], cortes: [[4.5, 0.7], [8.6, 0.45], [9.3, 0.22]], frasco: 7.4, final: 10 };
const T = roteiro(PADRAO);
// Cada luta lê o roteiro dela (J.T); o lendário (elden-lendario.js) põe nos dele ainda someBarra (a barra apaga), nevoaVolta
// (a névoa engrossa de novo), recuo (o Clawd volta 16 px) e tremeMais ([t0, t1, força, decai]).
const golpesDe = R => R.vida.filter((v, i) => v[1] < (i ? R.vida[i - 1][1] : 1)).map(v => v[0]);  // a vida desce: o Clawd acertou
const curasDe = R => R.vida.filter((v, i) => v[1] > (i ? R.vida[i - 1][1] : 1)).map(v => v[0]);   // a vida sobe: o chefe se curou
const curaEm = (t, R) => curasDe(R).reduce((a, c) => (t >= c && t < c + 0.7 ? Math.max(a, 1 - (t - c) / 0.7) : a), 0);
const presoEm = (t, R) => sai(fatia(t, R.preso[0], R.preso[0] + 0.35)) * (1 - entra(fatia(t, R.preso[1] - 0.35, R.preso[1])));

const linhaDoTempo = [
  [0, 'o palco abre acima do cartão, de baixo pra cima, com névoa dourada; o Clawd vai pro lado do chefe'],
  [T.entra[0], 'o chefe aparece na névoa'],
  [T.nome[0], 'o nome do chefe e a barra de vida enchem no topo do palco (fora do cartão)'],
  [2.3, 'a luta: cada chefe ataca do jeito dele no jogo e o Clawd responde como o jogador (rola, espera e rola, corre, pula ou apanha)'],
  [4.5, 'o Clawd contra-ataca: a barra de vida cai (a da Malenia sobe quando ela acerta: ela se cura)'],
  [7.4, 'o frasco quando apanha; contra o Margit, o Grilhão: correntes douradas o prendem de joelhos'],
  [T.final[0], 'o Clawd salta e crava o golpe final: clarão e o chão treme'],
  [T.ajoelha[0], 'o chefe se ajoelha e se desfaz em luz dourada'],
  [T.letreiro[0], 'GRANDE INIMIGO ABATIDO cruza o palco'],
  [T.volta[0], 'o Clawd volta pro lugar dele'],
  [T.fecha[0], 'o palco fecha de volta pra borda do cartão'],
];

// o chão tremendo: [início, fim, força, decai (true) ou sobe e desce]
function tremores(J) {
  const R = J.T;
  const L = [...golpesDe(R).map(h => (h === R.hf ? [h, h + 0.6, 3, true] : [h, h + 0.25, 1, true])),
    [R.morte[0], R.morte[0] + 0.7, 1.5], ...(R.tremeMais || [])];
  R.ataques.forEach((a, k) => { const ia = J.impacto[k]; L.push([ia, ia + 0.35, a.resp === 'apanha' ? 2.2 : 1.6, true]); });
  return L;
}
function tremor(t, J) {
  let a = 0;
  for (const [t0, t1, forca, decai] of tremores(J)) {
    if (t < t0 || t >= t1) continue;
    const u = fatia(t, t0, t1);
    a = Math.max(a, forca * (decai ? 1 - u : Math.sin(Math.PI * u)));
  }
  return a;
}

// ---------- o chefe da vez ----------
const CARREGADOS = {};
function carregaChefe(id) {
  if (CARREGADOS[id] === undefined) {
    try { CARREGADOS[id] = require(`./elden-chefe-${id}`); } catch (e) { CARREGADOS[id] = null; CARREGADOS[id + ':erro'] = e.message; }
  }
  return CARREGADOS[id];
}

// o estado que o chefe recebe a cada quadro
function estadoDoChefe(J, t) {
  const R = J.T;
  let ataque = null;
  for (const a of R.ataques) if (t >= a.t && t < a.t + a.dur) ataque = { id: a.id, u: (t - a.t) / a.dur };
  let golpeado = 0;
  for (const h of golpesDe(R)) if (t >= h && t < h + 0.3) golpeado = Math.max(golpeado, 1 - (t - h) / 0.3);
  const preso = presoEm(t, R);  // preso pelo Grilhão: de joelhos, sem desenho novo
  const est = {
    T: t, t, ataque, golpeado, ajoelha: Math.max(suave(fatia(t, R.ajoelha[0], R.ajoelha[1])), suave(preso)),
    morte: fatia(t, R.morte[0], R.morte[1]), entra: sai(fatia(t, R.entra[0], R.entra[1])), preso, cura: curaEm(t, R),
  };
  return J.mais ? Object.assign(est, J.mais(t)) : est;  // J.mais: o que um chefe a mais recebe (o Radagon: a rachadura)
}
// a vida (0..1) com a faixa clara que demora a descer
function vidaEm(t, R = T) {
  let v = 1;
  for (const [h, depois] of R.vida) {
    if (t < h) break;
    v += (depois - v) * fatia(t, h, h + 0.12);
    if (t < h + 0.12) break;
    v = depois;
  }
  return v;
}
const vidaComRastro = (t, R) => ({ vida: vidaEm(t, R), rastro: vidaEm(t - 0.5, R) });

// a janela da resposta do Clawd a um ataque que cai em i (corre: da saída até a volta)
const janela = (resp, i) => ({ rola: [i - 0.65, i - 0.05], rolaTarde: [i - 0.35, i - 0.02], corre: [i - 0.8, i + 0.95], pula: [i - 0.3, i + 0.3], apanha: [i, i + 0.45] })[resp];

function montar(m, chefe, R = chefe.luta ? roteiro(chefe.luta) : T) {
  const c = m.host.cartao || [98, 260, 248, 146], casa = m.pose();
  const cw = c[2], HJ = Math.round(lim(c[1] - 14, 72, 184)), X0 = casa.x - c[0];
  let pb = Math.floor(2 * (HJ - 26) / chefe.H) / 2;
  pb = Math.min(pb, Math.floor(2 * cw * 0.5 / chefe.W) / 2);
  pb = lim(pb, 1, 4);
  const larg = chefe.W * pb, alt = chefe.H * pb;
  const bossX = Math.round(Math.min(cw * 0.68, cw - larg / 2 - 6));
  const aqui = Math.max(16, Math.round(bossX - larg / 2 - 44));
  const J = { cw, HJ, X0, pb, larg, alt, bossX, aqui, chefe, T: R, idioma: m.host.idioma };  // idioma: os letreiros e o nome em inglês
  J.impacto = R.ataques.map(a => a.t + a.dur * lim(chefe.ataques[a.id].acerta, 0.3, 0.85));
  // o Clawd chega no posto (aqui + 16, onde os golpes do chefe caem) no 1º rolamento ou no 1º golpe dele, o que vier antes
  const rolos = R.ataques.flatMap((a, k) => (a.resp === 'rola' || a.resp === 'rolaTarde' ? [janela(a.resp, J.impacto[k])] : []));
  J.chega = [...rolos, ...R.cortes].sort((a, b) => a[0] - b[0])[0] || NUNCA;
  return J;
}

// ---------- o palco ----------
const CEUS = cache(8);
function ceu(J) {  // o fundo do palco: noite quente, estrelas, a Árvore Dourada ao longe e o chão (pronto no tamanho do palco)
  const chave = `${J.cw}x${J.HJ}`, pronto = CEUS.get(chave);
  if (pronto) return pronto;
  const img = tela(J.cw, J.HJ), k = img.getContext('2d');
  const mix = (a, b, u) => a.map((v, i) => Math.round(v + (b[i] - v) * u));  // o raster não tem gradiente linear: uma faixa por linha
  for (let y = 0; y < J.HJ; y++) {
    const u = y / (J.HJ - 1), c = u < 0.55 ? mix([7, 5, 10], [21, 14, 7], u / 0.55) : mix([21, 14, 7], [46, 32, 12], (u - 0.55) / 0.45);
    k.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; k.fillRect(0, y, J.cw, 1);
  }
  const r = rng(J.cw * 31 + J.HJ);
  for (let i = 0; i < 26; i++) { k.fillStyle = rgba(COR.ouroClaro, 0.15 + r() * 0.4); k.fillRect(Math.floor(r() * J.cw), Math.floor(r() * J.HJ * 0.6), 1, 1); }
  A.arvore(k, Math.round(J.cw * 0.2), J.HJ - 3, Math.round(J.cw * 0.5), Math.round(J.HJ * 0.88), 0.55, 0, 5);
  k.fillStyle = '#120C06'; k.fillRect(0, J.HJ - 3, J.cw, 3);
  k.fillStyle = COR.ouroFundo; k.fillRect(0, J.HJ - 3, J.cw, 1);
  CEUS.set(chave, img);
  return img;
}

// o nome e a barra de vida: no topo do palco, longe do cartão
function barraDeVida(g, t, J) {
  const R = J.T, a = sai(fatia(t, R.nome[0], R.nome[1])) * (R.someBarra ? 1 - fatia(t, R.someBarra[0], R.someBarra[1]) : 1);
  if (a <= 0) return;
  const x0 = Math.round(J.cw * 0.1), w = J.cw - 2 * x0, y = -J.HJ + 17, h = 6;
  const enche = sai(fatia(t, R.barra[0], R.barra[1])), { vida, rastro } = vidaComRastro(t, R);
  g.save(); g.globalAlpha *= a;
  A.texto(g, tr(J.idioma, J.chefe.nome, J.chefe.nomeEn || J.chefe.nome), x0, -J.HJ + 6, 1, { cor: COR.ouroClaro });
  g.fillStyle = '#0B0907'; g.fillRect(x0, y, w, h);
  const iw = w - 4, cheio = iw * enche;
  g.fillStyle = '#E5B85B'; g.fillRect(x0 + 2, y + 2, Math.round(cheio * rastro), h - 4);
  g.fillStyle = '#9F1B1B'; g.fillRect(x0 + 2, y + 2, Math.round(cheio * vida), h - 4);
  g.fillStyle = COR.sangueClaro; g.fillRect(x0 + 2, y + 2, Math.round(cheio * vida), 1);
  const cura = curaEm(t, R);
  if (cura > 0) { g.fillStyle = rgba('#FFB4BE', 0.75 * cura); g.fillRect(x0 + 2, y + 2, Math.round(cheio * vida), h - 4); }  // a barra pisca: ele se curou
  g.fillStyle = COR.ouro;
  g.fillRect(x0, y, w, 1); g.fillRect(x0, y + h - 1, w, 1); g.fillRect(x0, y, 1, h); g.fillRect(x0 + w - 1, y, 1, h);
  g.fillRect(x0 - 2, y + 1, 2, h - 2); g.fillRect(x0 + w, y + 1, 2, h - 2);  // as pontas
  g.restore();
}

// o letreiro dourado
function letreiro(g, t, J) {
  const R = J.T, a = sai(fatia(t, R.letreiro[0], R.letreiro[0] + 0.4)) * (1 - entra(fatia(t, R.letreiro[1] - 0.3, R.letreiro[1])));
  if (a <= 0) return;
  const txt = J.letreiro || tr(J.idioma, 'GRANDE INIMIGO ABATIDO', 'GREAT ENEMY FELLED'), k = A.largTexto(txt, 2) <= J.cw - 8 ? 2 : 1, cy = -Math.round(J.HJ * 0.48);
  const abre = sai(fatia(t, R.letreiro[0], R.letreiro[0] + 0.5));
  g.save(); g.globalAlpha *= a;
  const meia = Math.round((k * 7 + 10) * abre);
  for (let x = 0; x < J.cw; x += 4) {  // a faixa escura some nas pontas (sem gradiente linear no raster: tiras de 4 px)
    const u = (x + 2) / J.cw, al = 0.78 * Math.min(1, u / 0.18, (1 - u) / 0.18);
    g.fillStyle = rgba('#050302', al); g.fillRect(x, cy - meia, 4, meia * 2);
  }
  g.fillStyle = rgba(COR.ouro, 0.5); g.fillRect(Math.round(J.cw * 0.12), cy - meia, Math.round(J.cw * 0.76), 1); g.fillRect(Math.round(J.cw * 0.12), cy + meia - 1, Math.round(J.cw * 0.76), 1);
  if (abre > 0.6) A.texto(g, txt, J.cw / 2, cy - Math.round(k * 3.5), k, { centro: true, cor: COR.ouroClaro });
  g.restore();
}

// o chefe se desfazendo em luz dourada
function dissolve(g, t, J, est) {
  const u = est.morte;
  if (u <= 0 || u >= 1) return;
  const cy = -J.alt * 0.5;
  A.luz(g, J.bossX, cy, J.alt * (0.5 + 0.7 * Math.sin(Math.PI * u)), Math.sin(Math.PI * Math.min(1, u * 1.2)));
  g.save(); g.globalCompositeOperation = 'lighter';
  g.fillStyle = rgba(COR.ouroClaro, 0.35 * Math.sin(Math.PI * u));
  g.fillRect(Math.round(J.bossX - J.larg * 0.18), -J.HJ, Math.round(J.larg * 0.36), J.HJ);  // a coluna de luz
  g.restore();
  A.brasas(g, J.bossX - J.larg / 2, -J.alt - 4, J.larg, J.alt + 4, t * 2.2, J.sem + 5, 60, COR.ouroClaro, 0.5);
}

// o Grilhão de Margit: três correntes douradas saem de selos no chão e prendem o chefe de joelhos
function correntes(g, J, preso) {
  if (preso <= 0) return;
  const q = Math.max(1, Math.round(J.pb / 2)), alto = -J.alt * 0.42;
  for (const [de, ate] of [[-0.62, -0.18], [0.55, 0.16], [-0.05, 0.02]]) {
    const ax = J.bossX + J.larg * de, bx = J.bossX + J.larg * ate, n = Math.max(6, Math.round(Math.hypot(bx - ax, alto) / (2 * q)));
    A.luz(g, ax, -1, 5 + 2 * q, 0.7 * preso);  // o selo no chão
    g.save(); g.globalAlpha *= preso;
    for (let k = 0; k <= n * Math.min(1, preso * 1.4); k++) {
      const u = k / n, x = Math.round(ax + (bx - ax) * u), y = Math.round(alto * u);
      g.fillStyle = k % 2 ? COR.ouroEsc : COR.ouroClaro;
      if (k % 2) g.fillRect(x - q, y - q, 2 * q, 2 * q); else { g.fillRect(x - q, y - q, 2 * q, q); g.fillRect(x - q, y, 2 * q, q); }
    }
    g.restore();
  }
}
// a cura da Malenia: o sangue que ela rouba sobe por ela em brilho vermelho
function curaNoChefe(g, t, J, cura) {
  if (cura <= 0) return;
  A.luz(g, J.bossX, -J.alt * 0.5, J.alt * 0.7, 0.75 * cura, '#E11D48');
  A.brasas(g, J.bossX - J.larg / 3, -J.alt, J.larg * 0.66, J.alt, t * 3, J.sem + 9, 24, '#FF5A6E', 0.8 * cura);
}

function desenhar(g, t, m, J) {
  const e = m.host.escala || 1, c = m.host.cartao;
  if (!c) return;
  const OX = c[0], OY = c[1], R = J.T;
  const ab = t < R.fecha[0] ? sai(fatia(t, R.abre[0], R.abre[1])) : 1 - entra(fatia(t, R.fecha[0], R.fecha[1]));
  if (ab <= 0) return;
  const topo = Math.round(-J.HJ * ab * e) / e, tr = tremor(t, J);
  const sx = Math.round(Math.sin(t * 93) * 2.5 * tr) / 2, sy = Math.round(Math.cos(t * 71) * 2 * tr) / 2;
  const est = estadoDoChefe(J, t), chefe = J.chefe;
  g.save();
  g.setTransform(e, 0, 0, e, OX * e, OY * e);
  g.beginPath(); g.rect(0, topo, J.cw, -topo); g.clip();
  g.drawImage(ceu(J), 0, -J.HJ, J.cw, J.HJ);
  if (J.fundo) J.fundo(g, t, J);  // o que uma luta põe entre o céu e a névoa (o lendário: o cosmos)
  const nevoa = 1 - 0.6 * fatia(t, R.entra[0], R.entra[1] + 0.5) + 0.5 * dissolveFog(t, R);
  A.nevoa(g, 0, -J.HJ, J.cw, J.HJ, R.nevoaVolta ? nevoa + 0.6 * fatia(t, R.nevoaVolta[0], R.nevoaVolta[1]) : nevoa, t);
  g.translate(sx, sy);
  A.brasas(g, 0, -J.HJ, J.cw, J.HJ, t, J.sem, 16);
  // o chefe: aparece na névoa, treme quando apanha, some em luz
  if (est.entra > 0 && est.morte < 1) {
    g.save();
    g.globalAlpha *= est.entra * (1 - est.morte);
    const abalo = Math.round(Math.sin(t * 60) * 2 * est.golpeado) / 2;
    chefe.desenha(g, J, J.bossX + abalo, 0, est);
    g.restore();
    if (chefe.efeito) chefe.efeito(g, J, est, J.bossX, 0);
    correntes(g, J, est.preso);
    curaNoChefe(g, t, J, est.cura);
  }
  dissolve(g, t, J, est);
  for (const h of golpesDe(R)) {  // o clarão do golpe no chefe
    if (t >= h && t < h + 0.25) A.luz(g, J.bossX - J.larg * 0.28, -J.alt * 0.42, 10 + (h === R.hf ? 14 : 4), 1 - (t - h) / 0.25);
  }
  if (J.frente) J.frente(g, t, J, est);  // o que uma luta põe na frente do chefe (o lendário: os cacos do Radagon)
  g.restore();
  // a barra e o letreiro são do palco: no referencial do cartão, não no do Clawd (que anda pela reta)
  g.save(); g.setTransform(e, 0, 0, e, OX * e, OY * e);
  barraDeVida(g, t, J);
  letreiroNoPalco(g, t, J, topo);
  g.restore();
  // a moldura do palco: dourada, com a borda de cima clara enquanto abre e fecha
  g.save(); g.setTransform(e, 0, 0, e, OX * e, OY * e);
  g.fillStyle = COR.ouroEsc;
  g.fillRect(0, topo, 1, -topo); g.fillRect(J.cw - 1, topo, 1, -topo);
  g.fillStyle = t < R.abre[1] || t >= R.fecha[0] ? COR.ouroClaro : COR.ouro; g.fillRect(0, topo, J.cw, 1);
  g.restore();
}
const dissolveFog = (t, R) => Math.sin(Math.PI * fatia(t, R.morte[0], R.morte[1])) * 0.4;
function letreiroNoPalco(g, t, J, topo) {  // o letreiro e a barra de vida ficam dentro do clip do palco (o palco que abre)
  g.save(); g.beginPath(); g.rect(0, topo, J.cw, -topo); g.clip();
  letreiro(g, t, J);
  g.restore();
}

// ---------- o Clawd ----------
// x: onde ele está no palco. Ele chega no posto (aqui + 16) e toda resposta volta pro posto: quem corre ou pula vê o golpe
// do chefe cair no lugar vazio, e o rolamento passa por baixo dele (invulnerável, como no jogo).
function clawdEm(J, t) {
  const R = J.T;
  const arco = ([a, b], alt) => (t >= a && t < b ? alt * Math.sin(Math.PI * fatia(t, a, b)) : 0);
  const ida = fatia(t, R.vai[0], R.vai[1]), volta = fatia(t, R.volta[0], R.volta[1]);
  const andando = (ida > 0 && ida < 1) || (volta > 0 && volta < 1);
  const posto = u => J.aqui + 16 * fatia(u, J.chega[0], J.chega[1]);
  let dx = 0, y = 0, rot = 0, ang = 20, tinta = null, brilho = 0, sy = 1, frasco = 0, grilhao = 0, correndo = false, noAr = false;
  R.ataques.forEach((a, k) => {
    const i = J.impacto[k], w = janela(a.resp, i), u = fatia(t, w[0], w[1]);
    if (a.resp === 'rola' || a.resp === 'rolaTarde') {
      if (a.resp === 'rolaTarde' && t >= i - 1.3 && t < w[0]) { ang = -10; sy = 0.96; }  // em guarda: o golpe atrasado ainda não veio
      if (u > 0 && u < 1) {
        rot = 360 * u; y = -arco(w, 6);
        if (w[0] !== J.chega[0]) dx += 8 * Math.sin(Math.PI * u);  // já no posto: rola por baixo e volta
      }
    } else if (a.resp === 'corre') {  // recua correndo antes do golpe (sem sair do palco) e volta depois
      const D = Math.min(40, posto(i) - 14), foge = suave(fatia(t, w[0], w[0] + 0.6)), vem = suave(fatia(t, i + 0.35, w[1]));
      dx -= D * (foge - vem);
      correndo = correndo || (foge > 0 && foge < 1) || (vem > 0 && vem < 1);
    } else if (a.resp === 'pula' && u > 0 && u < 1) {  // por cima da onda no chão
      y = -arco(w, 14); ang = -20; noAr = true;
    } else if (a.resp === 'apanha' && u > 0 && u < 1) {  // o golpe acerta: recua e fica vermelho
      const s = Math.sin(Math.PI * u);
      dx -= 14 * s; y -= 3 * s; rot = -10 * s;
      tinta = { cor: COR.sangueClaro, a: 0.65 * (1 - fatia(t, i, i + 0.3)) };
    }
  });
  // os golpes: avança, levanta a arma devagar e desce rápido
  const swing = ([a, b]) => {
    const u = fatia(t, a, b);
    if (u <= 0 || u >= 1) return null;
    return { u, ang: u < 0.55 ? -35 * (u / 0.55) : -35 + 150 * ((u - 0.55) / 0.45), dx: 10 * Math.sin(Math.PI * u) };
  };
  for (const j of R.cortes) { const s = swing(j); if (s) { ang = s.ang; dx += s.dx; } }
  // o Grilhão: ergue a algema dourada, que brilha
  if (t >= R.grilhao[0] && t < R.grilhao[1]) {
    const u = fatia(t, R.grilhao[0], R.grilhao[1]);
    grilhao = Math.sin(Math.PI * Math.min(1, u * 1.15));
    brilho = 0.8 * Math.sin(Math.PI * fatia(u, 0.3, 1));
    ang = 40 + 50 * grilhao;
  }
  // o golpe final: salta alto com a arma erguida e cai crava
  if (t >= R.final[0] && t < R.final[1]) {
    const uSalto = fatia(t, R.salto[0], R.salto[1]), uFim = fatia(t, R.salto[1], R.final[1]);
    y = -22 * Math.sin(Math.PI * uSalto) * (t < R.salto[1] ? 1 : 0);
    dx += 18 * entra(uSalto) * (1 - sai(uFim));
    ang = t < R.hf - 0.15 ? -20 : lim(-20 + 150 * fatia(t, R.hf - 0.15, R.hf), -20, 130);
  }
  // o frasco: levanta, bebe, o halo dourado sobe
  if (t >= R.frasco[0] && t < R.frasco[1]) {
    const u = fatia(t, R.frasco[0], R.frasco[1]);
    frasco = Math.sin(Math.PI * Math.min(1, u * 1.15));
    brilho = Math.max(0, Math.sin(Math.PI * fatia(u, 0.35, 1)));
    ang = 40 + 50 * frasco;
    sy = 1 - 0.04 * Math.sin(Math.PI * fatia(u, 0.3, 0.55));
  }
  if (R.recuo) dx -= 16 * sai(fatia(t, R.recuo[0], R.recuo[1]));  // devolve os 16 px do rolamento
  const x = J.X0 + (posto(t) - J.X0) * (ida - volta) + dx;  // na volta, sai do posto direto pra casa
  return { x, y: y + (andando || correndo ? A.andando(t).y : 0), rot, ang, tinta, brilho, sy, frasco, grilhao, andando, correndo, noAr };
}
function desenharClawd(g, t, J, T0, m) {
  const c = clawdEm(J, t), tr = tremor(t, J), anda = c.andando || c.correndo;
  g.save();
  g.setTransform(T0.a, T0.b, T0.c, T0.d, T0.e, T0.f);
  g.translate(Math.round(Math.sin(t * 93) * 1.5 * tr) / 2, 0);
  g.translate(c.x - J.X0, 0);
  g.beginPath(); g.rect(-400, -400, 800, 401); g.clip();  // o rolamento não afunda no cartão: o que passa do chão fica de fora
  const p = anda ? A.andando(m.T) : { pernas: 'ambas', y: 0 };
  g.translate(0, c.y - (anda ? p.y : 0));
  if (c.rot) { g.translate(0, -8); g.rotate(c.rot * Math.PI / 180); g.translate(0, 8); }
  A.clawdElden(g, {
    T: m.T, pernas: c.rot || c.noAr ? 'ambas' : p.pernas, arma: { ang: c.andando ? p.ang : c.ang }, sy: c.sy, tinta: c.tinta || undefined,
    brilho: c.brilho || undefined, y: anda ? p.y : 0,
    mao: c.frasco ? (k, dy) => {  // o frasco âmbar subindo até a boca
      const subida = c.frasco * 9;
      k.fillStyle = '#7C2D12'; k.fillRect(11.5, -11 - subida + dy, 3, 4.5);
      k.fillStyle = '#F59E0B'; k.fillRect(12, -10 - subida + dy, 2, 3);
      k.fillStyle = COR.ouroClaro; k.fillRect(12, -12 - subida + dy, 2, 1);
    } : c.grilhao ? (k, dy) => {  // a algema dourada do Grilhão, erguida, com um elo pendurado
      const s = c.grilhao * 9, y0 = -16 - s + dy;
      k.fillStyle = COR.ouroEsc; k.fillRect(10.5, y0, 6, 5);
      k.fillStyle = '#050302'; k.fillRect(12, y0 + 1.5, 3, 2);
      k.fillStyle = COR.ouroClaro; k.fillRect(10.5, y0, 6, 1); k.fillRect(13, y0 + 5, 1, 2);
      k.fillStyle = COR.ouro; k.fillRect(12.5, y0 + 7, 2, 2);
    } : null,
  });
  g.restore();
}

// a trilha (som.js), tirada do roteiro: o swoosh e o impacto de cada ataque, o que o Clawd faz em cada um, os golpes dele.
// extra.ataque[id]: { impacto, antes: [quanto antes, som, ganho] } troca o som de uma animação; extra.nomes troca um som.
const SS = n => `sons-elden/${n}.wav`, VOLUME = 0.35;  // VOLUME: no nível dos avisos, como o do Akatsuki (a luta mixada fica ~-23 dBFS de RMS)
function sons(J, id, extra = {}) {
  const R = J.T, L = [[R.entra[0], 'chefe', 0.8], [R.entra[1] - 0.3, 'rugido-' + id, 1]];
  R.ataques.forEach((a, k) => {
    const i = J.impacto[k], s = (extra.ataque || {})[a.id] || {};
    L.push([i - 0.35, 'swoosh', 0.7], [i, s.impacto || 'impacto', a.resp === 'apanha' ? 1 : 0.85]);
    if (s.antes) L.push([i - s.antes[0], s.antes[1], s.antes[2]]);
    const pe = { rola: [0.65, 'rolar', 0.6], rolaTarde: [0.35, 'rolar', 0.6], corre: [0.8, 'rolar', 0.35], pula: [0.3, 'swoosh', 0.4] }[a.resp];
    if (pe) L.push([i - pe[0], pe[1], pe[2]]);
  });
  for (const [a] of R.cortes) L.push([a + 0.15, 'golpe', 0.6]);
  for (const h of golpesDe(R)) if (h !== R.hf) L.push([h, 'acerta', 0.8]);
  for (const h of curasDe(R)) L.push([h + 0.05, 'cura', 0.8]);
  L.push([R.frasco[0] + 0.1, 'frasco', 0.7], [R.grilhao[0] + 0.2, 'grilhao', 0.9],
    [R.hf - 0.2, 'golpe', 0.8], [R.hf, 'acerta-forte', 1], [R.letreiro[0], 'abatido', 1], [R.fecha[0], 'terminou', 0.8]);
  const nomes = extra.nomes || {};
  return L.filter(s => s[0] < R.dur).sort((a, b) => a[0] - b[0]).map(([t, n, g]) => [t, SS(nomes[n] || n), g * VOLUME]);
}

function cena(m, pedido) {  // pedido: um chefe pelo id, fora do rodízio (a foto de quem desenha o Radagon e a Besta)
  const id = pedido || CHEFES[(m.salvo.eldenChefe || 0) % CHEFES.length], chefe = carregaChefe(id);
  if (!chefe) { if (m.aoErro) m.aoErro(`elden-chefe-${id}.js com defeito: ${CARREGADOS[id + ':erro']}`); return null; }
  const J = montar(m, chefe);
  J.sem = Math.floor(m.sorteio() * 4294967296);
  return {
    nome: 'epico', dur: J.T.dur, espaco: { frente: 0, tras: 0 }, modos: ['andando'],
    plano: J,  // pros testes
    sons: sons(J, id),
    quadro(g, t, mundo) {
      const T0 = g.getTransform(), mm = mundo || m;
      desenhar(g, t, mm, J);
      desenharClawd(g, t, J, T0, mm);
    },
  };
}

module.exports = {
  linhaDoTempo, cena, T, CHEFES, RESPOSTAS, estadoDoChefe, vidaEm, clawdEm, tremor, montar, golpesDe, curasDe,  // do T em diante: pros testes
  NUNCA, roteiro, carregaChefe, desenhar, desenharClawd, sons,  // pro lendário
};
