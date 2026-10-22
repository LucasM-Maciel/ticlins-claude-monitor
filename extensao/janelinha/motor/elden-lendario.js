'use strict';
// O evento LENDÁRIO do tema Elden Ring (dono, 21/10): depois dos 4 chefes, a 5ª luta, ~25,7 s, com som. Radagon da Ordem
// Áurea aparece em luz dourada; o Clawd rola por baixo do salto dele, pula a onda do martelo, devolve dois golpes e crava o
// salto; Radagon congela, racha e se estilhaça, o céu vira o cosmos e a Besta Prístina sobe do Anel Prístino. Daí, a luta
// dela: o Clawd corre das estrelas, pula o anel que varre o chão, apanha das estrelas, bebe o frasco e crava o salto final; a
// Besta se desfaz em luz, "DEUS ABATIDO" cruza o palco e o Clawd recebe a coroa de Lorde Prístino.
//
// O motor é o do épico (elden-epico.js): cada fase é uma luta com o seu roteiro (J.T), tirado da luta de cada chefe
// (elden-chefe-radagon.js e elden-chefe-besta.js); aqui ficam a troca de fase, o estilhaço, o céu do cosmos, a coroa e a
// trilha. Tudo é função de t.
const E = require('./elden-epico');
const A = require('./elden-arte');
const { sai, cache, tela, rng, rgba, arte, lim, tr } = require('./comum');

const { fatia, COR } = A;
const { NUNCA } = E;

// Radagon: a luta dele; não se ajoelha: racha logo depois do salto final e estilhaça
const RR = E.roteiro(require('./elden-chefe-radagon').luta);
const ESTILHACO = RR.final[1] + 1.1;
const TROCA = ESTILHACO + 0.5;    // s: daqui em diante, o palco é o da Besta
const DESLOCA = ESTILHACO + 0.2;  // s: a luta da Besta começa aqui
const R = {
  ...RR,
  ajoelha: NUNCA, morte: [ESTILHACO, ESTILHACO + 0.15], letreiro: NUNCA, volta: NUNCA, fecha: NUNCA, dur: ESTILHACO,
  someBarra: [ESTILHACO, ESTILHACO + 0.4],
  racha: [RR.final[1], ESTILHACO],
  recuo: [ESTILHACO, ESTILHACO + 0.4],  // o estouro empurra o Clawd de volta pro lugar
  tremeMais: [[ESTILHACO, ESTILHACO + 0.8, 2.6, true]],
};
// a Besta: a luta dela deslocada; o Clawd já está no lugar e o palco já está aberto; depois do letreiro, a coroa
const desloca = v => (Array.isArray(v) ? v.map(desloca) : typeof v === 'number' ? v + DESLOCA : v);
const BB = E.roteiro(require('./elden-chefe-besta').luta);
const B = {
  ...Object.fromEntries(Object.entries(BB).map(([k, v]) => [k,
    k === 'vida' ? v.map(([h, x]) => [h + DESLOCA, x]) : k === 'ataques' ? v.map(a => ({ ...a, t: a.t + DESLOCA })) : desloca(v)])),
  abre: [-1, -0.5], vai: BB.vai,
  tremeMais: R.tremeMais,
};
const COROA = [B.letreiro[1], B.letreiro[1] + 2.4];
Object.assign(B, { volta: [COROA[1], COROA[1] + 0.5], fecha: [COROA[1] + 0.5, COROA[1] + 1], dur: COROA[1] + 1.1 });

const linhaDoTempo = [
  [0, 'o palco abre e o Clawd vai pro lugar dele'],
  [R.entra[0], 'Radagon da Ordem Áurea aparece em luz dourada; o nome e a barra enchem no topo'],
  [R.ataques[0].t, 'o salto dourado cai em cima do Clawd: ele rola por baixo e contra-ataca'],
  [R.ataques[1].t, 'o martelo solta a onda dourada pelo chão: o Clawd pula por cima, golpeia e crava o salto final'],
  [R.racha[0], 'Radagon congela e racha em linhas douradas'],
  [ESTILHACO, 'Radagon se estilhaça: os cacos voam, o chão treme, o céu vira o cosmos'],
  [B.entra[0], 'a Besta Prístina sobe do Anel Prístino; o nome e a barra nova'],
  [B.ataques[0].t, 'as estrelas prístinas perseguem o Clawd: ele corre e contra-ataca'],
  [B.ataques[1].t, 'o anel prístino varre o chão: o Clawd pula por cima e golpeia'],
  [B.ataques[2].t, 'as estrelas de novo: o Clawd apanha, bebe o frasco, golpeia e crava o salto final'],
  [B.ajoelha[0], 'a Besta se desfaz em luz'],
  [B.letreiro[0], 'DEUS ABATIDO cruza o palco'],
  [COROA[0], 'o Anel Prístino acende atrás do Clawd e a coroa de Lorde Prístino desce na cabeça dele'],
  [B.volta[0], 'o Clawd volta pro lugar dele e o palco fecha'],
];

// ---------- o céu do cosmos (a arena da Besta): nebulosa violeta/azul/dourada, estrelas e o mar de ouro ----------
const COSMOS = cache(8);
const manchaRadial = (k, x, y, R, cor, a) => {
  const gr = k.createRadialGradient(x, y, 0, x, y, R);
  gr.addColorStop(0, rgba(cor, a)); gr.addColorStop(0.5, rgba(cor, a * 0.45)); gr.addColorStop(1, rgba(cor, 0));
  k.fillStyle = gr; k.fillRect(Math.floor(x - R), Math.floor(y - R), Math.ceil(R * 2), Math.ceil(R * 2));
};
// as estrelas que cintilam: poucas, sorteadas (as mesmas em todo quadro); desenhadas por quadro
function estrelasVivas(J) {
  const r = rng(J.cw * 7 + J.HJ * 3), L = [];
  for (let i = 0; i < 9; i++) L.push({ x: Math.floor(r() * (J.cw - 6)) + 3, y: Math.floor(r() * (J.HJ - 14)) + 3, f: r() * 6, v: 2 + r() * 3, cor: i % 3 ? COR.ouroClaro : '#BFD4FF' });
  return L;
}
function cosmos(J) {
  const chave = `${J.cw}x${J.HJ}`, pronto = COSMOS.get(chave);
  if (pronto) return pronto;
  const W = J.cw, H = J.HJ, img = tela(W, H), k = img.getContext('2d');
  for (let y = 0; y < H; y++) {
    const u = y / (H - 1), c = [Math.round(8 + 20 * u), Math.round(5 + 9 * u), Math.round(26 + 8 * u)];
    k.fillStyle = `rgb(${c[0]},${c[1]},${c[2]})`; k.fillRect(0, y, W, 1);
  }
  const r = rng(W * 17 + H);
  // a nebulosa: manchas largas de gradiente radial, empilhadas
  const manchas = [['#5B21B6', 0.55, 0.28, 0.2, 0.62], ['#1D4ED8', 0.4, 0.72, 0.3, 0.55], ['#7C3AED', 0.4, 0.45, 0.45, 0.5],
    ['#B8860B', 0.34, 0.2, 0.5, 0.5], ['#0EA5E9', 0.22, 0.88, 0.2, 0.45], ['#C026D3', 0.2, 0.6, 0.18, 0.4], ['#D4AF37', 0.3, 0.55, 0.62, 0.42]];
  for (const [cor, a, fx, fy, fr] of manchas) manchaRadial(k, W * (fx + (r() - 0.5) * 0.1), H * fy, Math.max(W, H * 2) * fr * 0.55, cor, a);
  // a poeira de estrelas: pontos pequenos, alguns médios com cruz
  for (let i = 0; i < 90; i++) {
    const x = Math.floor(r() * W), y = Math.floor(r() * (H - 8)), b = r();
    k.fillStyle = rgba(b < 0.15 ? '#BFD4FF' : COR.ouroClaro, 0.2 + b * 0.55); k.fillRect(x, y, 1, 1);
  }
  for (let i = 0; i < 9; i++) {
    const x = 3 + Math.floor(r() * (W - 6)), y = 3 + Math.floor(r() * (H * 0.75));
    k.fillStyle = rgba('#FFFFFF', 0.9); k.fillRect(x, y, 1, 1);
    k.fillStyle = rgba(COR.ouroClaro, 0.45); k.fillRect(x - 1, y, 1, 1); k.fillRect(x + 1, y, 1, 1); k.fillRect(x, y - 1, 1, 1); k.fillRect(x, y + 1, 1, 1);
  }
  // o mar de ouro: o chão, com cristas claras e o brilho do horizonte
  manchaRadial(k, W * 0.5, H - 3, W * 0.7, '#D4AF37', 0.28);
  k.fillStyle = '#4A3410'; k.fillRect(0, H - 5, W, 5);
  k.fillStyle = '#6B4F17'; k.fillRect(0, H - 4, W, 3);
  k.fillStyle = COR.ouroClaro; k.fillRect(0, H - 5, W, 1);
  for (let i = 0; i < Math.floor(W / 5); i++) {
    const x = Math.floor(r() * W), y = H - 4 + Math.floor(r() * 3), w = 2 + Math.floor(r() * 5);
    k.fillStyle = rgba(r() < 0.5 ? COR.ouroClaro : COR.ouro, 0.75); k.fillRect(x, y, w, 1);
  }
  COSMOS.set(chave, img);
  return img;
}
const ceuVira = t => sai(fatia(t, ESTILHACO, ESTILHACO + 1.3));
const ESTRELAS = cache(8);

// o anel prístino: acende quando a Besta entra e ela sobe dele (referencial do palco)
function anelDaBesta(g, t, J) {
  const [e0, e1] = B.entra;
  const a = sai(fatia(t, TROCA, e1)) * (1 - fatia(t, e1 + 0.2, e1 + 1.4));
  if (a <= 0) return;
  const r = lim(Math.min(J.alt * 0.55, J.bossX - 2, J.cw - J.bossX - 2), 12, 60), cy = -Math.round(J.alt * 0.5);
  A.luz(g, J.bossX, cy, r * 1.5, 0.45 * a, '#7C3AED');
  A.anelPristino(g, J.bossX, cy, r * (0.85 + 0.15 * sai(fatia(t, TROCA, e1))), a);
}
// o anel atrás do Clawd na coroa
function anelDoClawd(g, t, J) {
  const a = sai(fatia(t, COROA[0], COROA[0] + 0.7)) * (1 - fatia(t, COROA[1] + 0.4, COROA[1] + 0.9)) * (0.85 + 0.15 * Math.sin(t * 5));
  if (a <= 0) return;
  const c = E.clawdEm(J, t), r = lim(J.HJ * 0.36, 22, 44);
  A.luz(g, c.x, -14, r * 1.6, 0.5 * a);
  A.anelPristino(g, c.x, -14, r, a);
}

// o fundo das duas fases: o cosmos entra por cima do céu de sempre a partir do estilhaço
function fundo(g, t, J) {
  const a = ceuVira(t);
  if (a <= 0) return;
  g.save(); g.globalAlpha *= a;
  g.drawImage(cosmos(J), 0, -J.HJ, J.cw, J.HJ);
  let est = ESTRELAS.get(`${J.cw}x${J.HJ}`);
  if (!est) est = ESTRELAS.set(`${J.cw}x${J.HJ}`, estrelasVivas(J));
  g.globalCompositeOperation = 'lighter';
  for (const s of est) {  // cintilam: o brilho e a cruz vão e vêm
    const b = 0.5 + 0.5 * Math.sin(t * s.v + s.f);
    if (b < 0.25) continue;
    const x = s.x, y = s.y - J.HJ;
    g.fillStyle = rgba(s.cor, 0.35 + 0.65 * b); g.fillRect(x, y, 1, 1);
    if (b > 0.7) { g.fillStyle = rgba(s.cor, 0.5 * b); g.fillRect(x - 2, y, 2, 1); g.fillRect(x + 1, y, 2, 1); g.fillRect(x, y - 2, 1, 2); g.fillRect(x, y + 1, 1, 2); }
  }
  g.restore();
  if (t >= TROCA) anelDaBesta(g, t, J);
  anelDoClawd(g, t, J);
}

// a frente: o clarão e os cacos do estilhaço (do lugar do Radagon)
const CACOS = 46, GRAV = 150;
function frente(g, t, J, onde) {
  const s = t - ESTILHACO, u = fatia(t, ESTILHACO, ESTILHACO + 1.3);
  if (s <= 0 || u >= 1) return;
  const cx = onde.x, alt = onde.alt, chao = -1;
  // o clarão: forte no 1º décimo de segundo, depois some
  const f = 1 - fatia(s, 0, 0.1) * 0.35, resto = 1 - fatia(s, 0.1, 0.7);
  if (s < 0.7) {
    A.luz(g, cx, -alt * 0.5, alt * (0.6 + 1.6 * fatia(s, 0, 0.3)), (s < 0.1 ? 1 : 0.65 * resto) * f);
    if (s < 0.14) {
      g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba('#FFF4D0', 0.75 * (1 - s / 0.14));
      g.fillRect(0, -J.HJ, J.cw, J.HJ); g.restore();
    }
  }
  const r = rng(91);
  // os fios de luz, subindo
  g.save(); g.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 12; i++) {
    const x = Math.round(cx + (r() - 0.5) * onde.alt * 0.6), v = 40 + r() * 60, len = 6 + Math.floor(r() * 16), atraso = r() * 0.15;
    const q = s - atraso;
    if (q <= 0) continue;
    const topo = Math.round(-alt * 0.15 - v * q * (1 - q * 0.35)), a = 0.75 * (1 - u) * (1 - fatia(q, 0.5, 1.2));
    if (a <= 0) continue;
    g.fillStyle = rgba(i % 3 ? COR.ouroClaro : '#FFFFFF', a); g.fillRect(x, topo, 1, len);
    g.fillStyle = rgba(COR.ouro, a * 0.4); g.fillRect(x - 1, topo + 2, 1, len - 2); g.fillRect(x + 1, topo + 2, 1, len - 2);
  }
  g.restore();
  // os cacos: angulosos, girando e caindo com gravidade; os do chão quicam uma vez e esmaecem
  const cores = [COR.ouroClaro, COR.ouro, '#FFF4D0', COR.ouroEsc];
  for (let i = 0; i < CACOS; i++) {
    const ang = -Math.PI / 2 + (r() - 0.5) * 2.7, v = 30 + r() * 130, tam = i % 5 === 0 ? 4.5 : i % 3 === 0 ? 3 : 2;
    const gira = (r() - 0.5) * 18, a0 = r() * 6.28, cor = cores[Math.floor(r() * 4)], ox = (r() - 0.5) * alt * 0.35, oy = -alt * (0.15 + r() * 0.7);
    const px = cx + ox + Math.cos(ang) * v * s * 0.9;
    let py = oy + Math.sin(ang) * v * s + 0.5 * GRAV * s * s;
    if (py > chao) py = chao - Math.min(5, (py - chao) * 0.12);
    const a = 1 - fatia(s, 0.6, 1.3);
    if (a <= 0) continue;
    g.save(); g.globalAlpha *= a; g.translate(Math.round(px), Math.round(py)); g.rotate(a0 + gira * s);
    g.fillStyle = cor; g.beginPath(); g.moveTo(-tam, tam * 0.6); g.lineTo(0, -tam); g.lineTo(tam * 0.9, tam * 0.5); g.closePath(); g.fill();
    if (tam > 2) { g.fillStyle = '#FFFFFF'; g.fillRect(-1, -1, 1, 1); }
    g.restore();
  }
}

// a coroa de Lorde Prístino: dourada, com joias; desce e assenta na cabeça do Clawd (no referencial dele)
const CORO = ['......w......', 'w..L..L..L..w', 'L..oL.o.Lo..L', 'Lo.ooLoLoo.oL', 'LooooooooooooL', 'LoobooroobooL', 'd' + 'o'.repeat(11) + 'd', 'ddddddddddddd'];
const COROA_IMG = () => arte(CORO, { L: COR.ouroClaro, o: COR.ouro, d: COR.ouroEsc, w: '#FFFFFF', r: COR.sangueClaro, b: COR.azul });
function coroa(g, t, J, T0) {
  const u = fatia(t, COROA[0], COROA[1] + 0.5);
  if (u <= 0) return;
  const c = E.clawdEm(J, t), desce = sai(fatia(u, 0, 0.35)), assenta = fatia(u, 0.35, 0.5);
  g.save();
  g.setTransform(T0.a, T0.b, T0.c, T0.d, T0.e, T0.f);
  g.beginPath(); g.rect(-J.X0, -J.HJ, J.cw, J.HJ); g.clip();  // o palco todo, nada passa
  g.translate(c.x - J.X0, 0);
  const img = COROA_IMG(), K = J.HJ >= 110 ? 2 : 1, w = img.width * K, h = img.height * K, base = -17;
  const y = Math.round(base - h - 20 * (1 - desce)), x = -Math.floor(w / 2);
  g.globalAlpha *= Math.min(1, u * 5);
  if (desce < 1) {  // o rastro de luz da descida
    g.save(); g.globalCompositeOperation = 'lighter'; g.fillStyle = rgba(COR.ouroClaro, 0.3 * (1 - desce));
    g.fillRect(x + 4, y - 12, 5, 12); g.fillRect(x + 5, y - 22, 3, 10); g.restore();
  }
  g.drawImage(img, x, y, w, h);
  const brilho = Math.sin(Math.PI * assenta) * 0.9 + (assenta >= 1 ? 0.25 + 0.15 * Math.sin(t * 6) : 0);
  if (brilho > 0) {
    A.luz(g, 0, y + 4, 16, brilho);
    g.save(); g.globalCompositeOperation = 'lighter'; g.globalAlpha *= brilho * 0.5; g.drawImage(img, x, y, w, h); g.restore();
    const r = rng(77), s = t - COROA[0] - 0.35 * (COROA[1] + 0.5 - COROA[0]);
    g.save(); g.globalCompositeOperation = 'lighter';
    for (let i = 0; i < 8; i++) {  // faíscas ao assentar
      const ang = -Math.PI / 2 + (r() - 0.5) * 3, v = 8 + r() * 14, q = Math.max(0, s) , a = 1 - fatia(q, 0, 0.7);
      if (a > 0 && q > 0) { g.fillStyle = rgba(COR.ouroClaro, a); g.fillRect(Math.round(Math.cos(ang) * v * q * 2), Math.round(y + 3 + Math.sin(ang) * v * q * 2 + 12 * q * q), 1, 1); }
    }
    g.restore();
  }
  // o título: pequeno, centrado na cabeça, mas sempre dentro da largura do palco
  const ta = fatia(u, 0.35, 0.45);  // acende quando a coroa pousa
  if (ta > 0) {
    const titulo = tr(J.idioma, 'LORDE PRÍSTINO', 'ELDEN LORD'), tw = A.largTexto(titulo, 1);
    const mid = lim(0, -c.x + 4 + tw / 2, J.cw - c.x - 4 - tw / 2);
    const ty = Math.max(-J.HJ + 3 + 2, y - 10);
    g.save(); g.globalAlpha *= ta;
    g.fillStyle = rgba('#050302', 0.85); g.fillRect(Math.round(mid - tw / 2) - 3, ty - 3, tw + 6, 11);
    g.fillStyle = rgba(COR.ouro, 0.6); g.fillRect(Math.round(mid - tw / 2) - 3, ty - 3, tw + 6, 1); g.fillRect(Math.round(mid - tw / 2) - 3, ty + 7, tw + 6, 1);
    A.texto(g, titulo, mid, ty, 1, { centro: true }); g.restore();
  }
  g.restore();
}

// a trilha (som.js): a de cada fase sai do roteiro dela (E.sons), com os sons do lendário no lugar dos de sempre
const SS = n => `sons-elden/${n}.wav`, VOLUME = 0.35;  // o mesmo nível do épico
function sons(JR, JB) {
  const radagon = E.sons(JR, 'radagon', { ataque: { 0: { impacto: 'martelo-aureo' } } });  // até o estilhaço (R.dur)
  const besta = E.sons(JB, 'besta', {
    ataque: { 0: { antes: [0.9, 'estrelas', 0.8] }, 1: { antes: [0.85, 'anel', 1] } }, nomes: { chefe: 'anel', abatido: 'deus-abatido' },
  });
  return [...radagon, [ESTILHACO - 0.62, SS('estilhaco'), VOLUME], ...besta, [COROA[0] + 0.2, SS('coroa'), VOLUME]].sort((a, b) => a[0] - b[0]);
}

function cena(m) {
  const radagon = E.carregaChefe('radagon'), besta = E.carregaChefe('besta');
  if (!radagon || !besta) { if (m.aoErro) m.aoErro(`elden-chefe-${radagon ? 'besta' : 'radagon'}.js com defeito`); return null; }
  const JR = E.montar(m, radagon, R), JB = E.montar(m, besta, B);
  JR.sem = JB.sem = Math.floor(m.sorteio() * 4294967296);
  JB.aqui = JR.aqui;  // o Clawd não pula na troca de fase
  const onde = { x: JR.bossX, alt: JR.alt };
  for (const J of [JR, JB]) {
    J.fundo = fundo;
    J.frente = (g, t, JJ) => frente(g, t, JJ, onde);
  }
  JR.mais = t => ({ racha: fatia(t, R.racha[0], R.racha[1]) });
  JB.letreiro = tr(JB.idioma, 'DEUS ABATIDO', 'GOD SLAIN');
  return {
    nome: 'epico', dur: B.dur, espaco: { frente: 0, tras: 0 }, modos: ['andando'],
    plano: JR, planos: [JR, JB],  // pros testes
    sons: sons(JR, JB),
    quadro(g, t, mundo) {
      const T0 = g.getTransform(), mm = mundo || m, J = t < TROCA ? JR : JB;
      E.desenhar(g, t, mm, J);
      E.desenharClawd(g, t, J, T0, mm);
      coroa(g, t, J, T0);
    },
  };
}

module.exports = { linhaDoTempo, cena, R, B, TROCA, ESTILHACO, COROA, cosmos };  // do R em diante: pros testes

