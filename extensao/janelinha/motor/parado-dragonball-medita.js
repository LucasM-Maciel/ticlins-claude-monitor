'use strict';
// Tema Dragon Ball, parado há muito tempo: o Clawd MEDITA FLUTUANDO. Respira fundo, fecha os
// olhos, senta de pernas cruzadas (as perninhas dobradas num colo largo, botas pra fora, mãos
// nos joelhos), acende uma aura calma e sobe uns pixels acima da borda do cartão; fica
// flutuando, subindo e descendo devagar (a respiração), com a aura pulsando fraquinha, um
// brilho de ki na borda embaixo dele e fagulhas de ki subindo de vez em quando. Raro: um
// "pulso" de ki em que pedrinhas soltas sobem da borda, flutuam em volta dele e descem de novo.
// Na saída (algo voltou a rodar) ele abre os olhos, desce, pousa e fica em pé normal no lugar.
// Tudo função do tempo: sorteios por janela (rng da semente da cena + o número da janela); a
// semente fica em m.estado.meditaSemente pra saída saber o que estava no ar.
const { lim, sai, entra, rng, rgba, mistura, arte, cache } = require('./comum');
const { desenhaClawd, registrarRoupas } = require('./clawd');
const A = require('./dragonball-arte');

const P = 1.5, q = v => Math.round(v / P) * P;          // o pixel do Clawd
const fatia = A.fatia, suave = u => u * u * (3 - 2 * u);
const DB = A.DB;

// ---------- o Clawd meditando (3 roupas a mais, no grid do Clawd de gi) ----------
// Sentado ele fica 1 meia-fileira mais baixo: o colo (as pernas dobradas, uma faixa de calça
// mais larga que o corpo, com a dobra no meio e as botas pra fora) cobre o quadril; os braços
// descem 1 meia-fileira e as mãos ficam nos joelhos; o olho fechado é um risquinho.
const BASE = A.ROUPAS[A.ROUPA];
const OLHO_FECHADO = ['...############...', '...#oo######oo#...'];
const SENTADO = ['...ggggguuggggg...', '.#wggggggzgggggw#.', '.#wffffffffffffw#.', '.gggggggzzggggggg.', 'bbgggggg..ggggggbb'];
const cab = olhos => [...BASE.linhas.slice(0, 6), ...(olhos ? BASE.linhas.slice(6, 8) : OLHO_FECHADO)];
const R_PE = 'dragonball-medita-pe', R_SENTA = 'dragonball-medita', R_ABRE = 'dragonball-medita-olhos';
const ROUPAS = {
  [R_PE]: { ...BASE, linhas: [...cab(false), ...BASE.linhas.slice(8)] },          // em pé, olhos fechados
  [R_SENTA]: { ...BASE, linhas: [...cab(false), ...SENTADO], cores: { ...BASE.cores, b: DB.azul } },
  [R_ABRE]: { ...BASE, linhas: [...cab(true), ...SENTADO], cores: { ...BASE.cores, b: DB.azul } },
};
registrarRoupas(ROUPAS);

// o que o Clawd veste agora (cópia do vestir() do tema-dragonball.js: a transformação, se houver)
function vestir(m) {
  const tr = m.estado.tr, R = { ta: m.T };
  if (!tr) return R;
  return { ...R, ...A.efeitoTransf(tr.v, m.T - tr.t0, tr.tv0 != null ? m.T - tr.tv0 : null, m.T).R };
}
// o clawdDB do tema com outra roupa (a transformação continua valendo: cabelo, crina, raios, tinta)
function clawdRoupa(g, p, roupa) {
  const alfa = p.alfa ?? 1, ta = p.ta || 0;
  const qq = { ...p, roupa, cabelo: p.cabelo || null, aura: null, atras: null, frente: null };
  if (p.aura > 0) qq.aura = k => A.aura(k, ta, p.aura, alfa * (p.auraAlfa ?? 1), p.auraCor, p.auraEstilo);
  if (p.longo > 0) qq.atras = (k, dy, L) => A.crina(k, p.longo, p.cabelo || [DB.cabelo, DB.cabeloLuz], L, ta, dy, null);
  if (p.raios) qq.frente = (k, dy, L) => A.raiosEletricos(k, ta, L);
  desenhaClawd(g, qq);
}

// ---------- linha do tempo ----------
const T = {
  respira: 0.35, fecha: 0.5, agacha: 0.62, senta: 0.74, sentou: 1.0,
  aura0: 0.9, aura1: 1.8, sobe0: 1.5, sobe1: 4.4,
};
const ALTO = 6;          // px acima da borda quando flutua
const BOIA = 2.5;        // px que ele sobe e desce
const RESPIRA = 4.4;     // s por respiração (sobe inspirando, desce soltando o ar)
const KI = '#60A5FA';    // o ki calmo (azul claro, o das cenas de luta)
const PULSO = { janela: 60, dur: 7.8, primeiro: 10, chance: 0.5 };  // o pulso raro

// sorteio repetível de uma janela k (canal separa os usos)
const sorte = (sem, k, canal) => rng((sem + Math.imul(k + 1, 0x9E3779B1) + Math.imul(canal, 0x85EBCA6B)) >>> 0);
const respiro = t => t < T.sobe1 ? 0 : (1 - Math.cos(2 * Math.PI * (t - T.sobe1) / RESPIRA)) / 2;  // 0..1

// o pulso que está acontecendo em t (ou null): { k, t0, tau, pedras }
const pedraArte = [['.ll.', 'lbbc', 'bbcd', '.dd.'], ['.lll.', 'lbbbc', 'bbbcd', '.ddd.'], ['ll.', 'lbc', 'cdd'], ['.ll..', 'lbbbl', 'bbbcc', '.cdd.'], ['lb', 'bd']]
  .map(l => arte(l, { l: '#D6D3D1', b: '#A8A29E', c: '#78716C', d: '#57534E' }));
const PULSOS = cache(16);
function pulsoDe(sem, k) {
  if (k < 0) return null;
  const chave = sem + ':' + k, pronto = PULSOS.get(chave);
  if (pronto !== undefined) return pronto;
  return PULSOS.set(chave, sortearPulso(sem, k));
}
function sortearPulso(sem, k) {
  const r = sorte(sem, k, 1);
  const tem = k === 0 || r() < PULSO.chance;
  const ini = k === 0 ? PULSO.primeiro : 3 + r() * (PULSO.janela - PULSO.dur - 6);
  if (!tem) return null;
  // 4 ou 5 pedrinhas, dos dois lados, em vagas que não se sobrepõem
  const vagas = [-41, -32, -23, 22, 31, 40].map(x => x + (r() - 0.5) * 3), n = 4 + (r() < 0.5 ? 1 : 0);
  for (let i = vagas.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [vagas[i], vagas[j]] = [vagas[j], vagas[i]]; }
  const pedras = vagas.slice(0, n).map((x, i) => ({
    x, img: pedraArte[Math.floor(r() * pedraArte.length)], alvo: 10 + r() * 15,
    sobe: 0.35 + i * 0.22 + r() * 0.1, fase: r() * 2 * Math.PI, desce: 5.3 + r() * 0.5,
  }));
  return { k, t0: T.sobe1 + k * PULSO.janela + ini, pedras };
}
function pulsoEm(sem, t) {
  if (t < T.sobe1) return null;
  const p = pulsoDe(sem, Math.floor((t - T.sobe1) / PULSO.janela));
  return p && t >= p.t0 && t < p.t0 + PULSO.dur ? { ...p, tau: t - p.t0 } : null;
}
// o quanto o pulso está forte (0..1): cresce em 0,8 s, segura, solta de 5,4 a 7,4
const forcaPulso = tau => tau == null ? 0 : sai(fatia(tau, 0, 0.8)) * (1 - suave(fatia(tau, 5.4, 7.4)));
const POUSA = 1.3;  // s descendo (as pedrinhas)
// altura de uma pedrinha (px acima da borda) no instante tau do pulso; null = não está no ar
function alturaPedra(p, tau) {
  if (tau < p.sobe) return null;
  const subiu = p.alvo * sai(fatia(tau, p.sobe, p.sobe + 1.6));
  const boia = 1.5 * Math.sin(2 * Math.PI * (tau - p.sobe) / 2.6 + p.fase) * fatia(tau, p.sobe + 0.8, p.sobe + 1.8);
  const h = (subiu + boia) * (1 - suave(fatia(tau, p.desce, p.desce + POUSA)));
  return tau >= p.desce + POUSA ? null : h;
}
// poeirinha da borda (a pedrinha sai do chão / volta pra ele); d = s desde o toque
function poeira(g, x, d) {
  if (d < 0 || d >= 0.4) return;
  const u = d / 0.4;
  g.save(); g.globalAlpha *= 1 - u;
  for (let j = 0; j < 4; j++) {
    const lado = j < 2 ? -1 : 1, longe = j % 2 ? 0.55 : 1;
    g.fillStyle = j % 2 ? '#D6D3D1' : '#A8A29E';
    g.fillRect(q(x + lado * (1.5 + 5 * sai(u)) * longe), q(-(0.75 + 3 * sai(u)) * (j % 2 ? 1 : 0.5)) - P, P, P);
  }
  g.restore();
}

// o estado do Clawd na cena em t: altura, roupa, amassado, aura
function estado(t, sem) {
  const pul = pulsoEm(sem, t), f = forcaPulso(pul && pul.tau), b = respiro(t);
  let roupa = A.ROUPA, sy = 1;
  if (t >= T.fecha) roupa = R_PE;
  if (t >= T.respira && t < T.agacha) sy = 1 + 0.05 * Math.sin(Math.PI * fatia(t, T.respira, T.agacha));  // enche o peito
  else if (t >= T.agacha && t < T.senta) sy = 1 - 0.12 * sai(fatia(t, T.agacha, T.senta));                 // abaixa
  if (t >= T.senta) { roupa = R_SENTA; sy = t < T.sentou ? 0.9 + 0.1 * sai(fatia(t, T.senta, T.sentou)) : 1; }
  const alt = ALTO * suave(fatia(t, T.sobe0, T.sobe1)) + BOIA * b + 2.5 * f;
  const acende = sai(fatia(t, T.aura0, T.aura1));
  return {
    roupa, sy, alt, pul, f, b,
    auraSobe: acende * (0.94 + 0.06 * b + 0.1 * f),
    auraAlfa: acende * (0.42 + 0.3 * b + 0.28 * f),
  };
}

// ---------- desenho ----------
// a aura calma: o jeito da aura do tema (colunas de 1,5 px, a ponta ondulando devagar como
// chama), mas um ovo em volta dele inteiro (ele está no ar: embaixo arredonda em vez de
// cortar reto no chão), fraca e sem as faíscas. cy = o meio do ovo; a = alfa (o pulso)
function auraCalma(g, t, cor, a, cresce = 1) {
  if (!(a > 0.005) || !(cresce > 0)) return;
  const meio = mistura(cor, '#FFFFFF', 0.35), luz = mistura(cor, '#FFFFFF', 0.72), borda = Math.min(1, 1.6 * a);
  const larg = 19 * (0.6 + 0.4 * cresce), cima = 13.5 * cresce, baixo = 9.75 * cresce, cy = -9.75, n = Math.floor(larg / P);
  for (let i = -n; i <= n; i++) {
    const x = i * P, k = 1 - (x / larg) ** 2;
    if (k <= 0) continue;
    const lingua = 0.4 * (6 * Math.max(0, Math.sin(i * 0.9 + t * 4)) + 4 * Math.max(0, Math.sin(i * 0.47 - t * 2.8)));
    const topo = q(cy - cima * Math.sqrt(k) - lingua * cresce), fundo = q(cy + baixo * Math.sqrt(k));
    if (fundo - topo < 2 * P) continue;
    g.fillStyle = rgba(cor, 0.15 * a); g.fillRect(x - P / 2, topo + P, P, fundo - topo - P);  // o miolo, bem fraco
    g.fillStyle = rgba(meio, 0.6 * a); g.fillRect(x - P / 2, topo + P, P, P);                      // a chama
    g.fillStyle = rgba(luz, borda); g.fillRect(x - P / 2, topo, P, P);                             // a borda clara
    if (Math.abs(i) === n) { g.fillStyle = rgba(luz, 0.8 * borda); g.fillRect(x - P / 2, topo + P, P, fundo - topo - 3 * P); }
  }
}
// brilho do ki na borda do cartão embaixo dele (fica na borda: não entra no conteúdo)
function brilhoBorda(g, cor, a, larg) {
  if (!(a > 0.01)) return;
  const luz = mistura(cor, '#FFFFFF', 0.6);
  for (const [f, al] of [[1, 0.18], [0.66, 0.3], [0.33, 0.45]]) {  // mais forte no meio
    const w = q(larg * f / 2);
    g.fillStyle = rgba(luz, al * a); g.fillRect(-w, 0, 2 * w, P);
  }
}
// fagulhas de ki subindo de vez em quando (nascem perto dele, sobem 22 px em 2,4 s e somem);
// ate: só as que nasceram até esse instante (a saída), some: alfa extra
const FAG = { janela: 0.8, vida: 2.4, chance: 0.6 };
function fagulhas(g, t, sem, cor, ate = Infinity, some = 1) {
  if (t < T.aura1 || !(some > 0)) return;
  const luz = mistura(cor, '#FFFFFF', 0.55), a0 = g.globalAlpha;
  const k1 = Math.floor((Math.min(t, ate) - T.aura1) / FAG.janela);
  for (let k = Math.max(0, Math.floor((t - FAG.vida - T.aura1) / FAG.janela)); k <= k1; k++) {
    const r = sorte(sem, k, 2);
    if (r() > FAG.chance) continue;
    const nasce = T.aura1 + (k + r()) * FAG.janela, d = t - nasce;
    if (d < 0 || d >= FAG.vida || nasce > ate) continue;
    const u = d / FAG.vida, x0 = (r() - 0.5) * 30, y0 = -(estado(nasce, sem).alt + 3 + r() * 12), branca = r() < 0.3;
    const x = x0 + Math.sin(d * 2.2 + k) * 1.5, y = y0 - 22 * sai(u);
    g.globalAlpha = a0 * some * Math.min(1, d / 0.25) * (u < 0.5 ? 1 : (1 - u) / 0.5);
    g.fillStyle = branca ? '#FFFFFF' : luz;
    g.fillRect(q(x), q(y), P, u < 0.35 ? 2 * P : P);  // nasce num risquinho, vira um ponto
  }
  g.globalAlpha = a0;
}
// as pedrinhas do pulso (no ar) e a poeira de quando saem e voltam pra borda
function pedrinhas(g, pul, tau) {
  for (const p of pul.pedras) {
    poeira(g, p.x, tau - p.sobe);
    poeira(g, p.x, tau - p.desce - POUSA);
    const h = alturaPedra(p, tau);
    if (h == null) continue;
    g.drawImage(p.img, q(p.x - p.img.width * P / 2), q(-h) - p.img.height * P, p.img.width * P, p.img.height * P);
  }
}
// o Clawd (com a aura calma por trás, a da transformação por cima da calma) a alt px do chão
function clawdNoAr(g, R, s, tt) {
  const tr = R.aura > 0 ? Math.min(1, R.aura) : 0, cor = tr ? R.auraCor || DB.aura : KI;
  const calma = s.auraAlfa * (1 - tr);
  brilhoBorda(g, cor, Math.max(calma * 1.6, tr * 0.6) * (1 - lim(s.alt / 40, 0, 0.6)), 20 + 8 * s.b + 10 * s.f);
  if (calma > 0.005 && s.auraSobe > 0) {
    g.save(); g.translate(0, -q(s.alt)); auraCalma(g, tt, KI, calma, s.auraSobe); g.restore();
  }
  clawdRoupa(g, { ...R, y: -q(s.alt), sy: s.sy }, s.roupa);
}

module.exports = {
  texturas: [],
  linhaDoTempo: [
    [0, 'em pé, normal'], [T.respira, 'respira fundo'], [T.fecha, 'fecha os olhos'],
    [T.agacha, 'senta de pernas cruzadas, mãos nos joelhos'], [T.aura0, 'acende uma aura calma (azul claro)'],
    [T.sobe0, 'sobe devagar até 6 px acima da borda'],
    [T.sobe1, `flutua: sobe e desce ${BOIA} px a cada ${RESPIRA} s, a aura pulsa junto; fagulhas de ki subindo`],
    [T.sobe1 + PULSO.primeiro, 'pulso de ki: a aura cresce, ele sobe mais 2,5 px, pedrinhas sobem da borda'],
    [T.sobe1 + PULSO.primeiro + 2, 'as pedrinhas flutuam em volta dele'],
    [T.sobe1 + PULSO.primeiro + 5.3, 'descem devagar e voltam pra borda (poeirinha)'],
    [T.sobe1 + PULSO.janela, `depois: 1 pulso em 2 a cada ${PULSO.janela} s, até algo rodar`],
  ],
  cena(m) {
    const sem = Math.floor(m.sorteio() * 4294967296);
    m.estado.meditaSemente = sem;  // pra saída saber onde estavam as pedrinhas
    return {
      nome: 'parado', dur: Infinity, espaco: { frente: 0, tras: 0 }, modos: ['parado'],
      quadro(g, t, mm) {
        const R = vestir(mm), s = estado(t, sem);
        if (t < T.respira) { A.clawdDB(g, R); return; }  // começa com o Clawd normal do tema
        if (s.pul && s.pul.tau < 1.0) {  // a onda do pulso: um anel claro saindo de trás dele, cortado na borda do cartão
          g.save(); g.beginPath(); g.rect(-60, -90, 120, 90); g.clip();
          g.translate(0, -q(s.alt)); g.globalAlpha *= 0.55; A.anelClarao(g, s.pul.tau / 1.0, '#BFDBFE');
          g.restore();
        }
        clawdNoAr(g, R, s, t);
        fagulhas(g, t, sem, R.aura > 0 ? R.auraCor || DB.aura : KI);
        if (s.pul) pedrinhas(g, s.pul, s.pul.tau);
      },
    };
  },
  // algo voltou a rodar: abre os olhos, desce, pousa e fica em pé (no máximo 1,1 s)
  saida: {
    dur: 1.1,
    quadro(g, u, m, tCorte) {
      const R = vestir(m), sem = m.estado.meditaSemente >>> 0, c = Math.max(0, tCorte || 0);
      const s0 = estado(c, sem), sentado = s0.roupa === R_SENTA;
      const desce = 0.15 + 0.45 * lim(s0.alt / ALTO, 0, 1), levanta = sentado ? desce + 0.15 : 0.1;
      // o Clawd: abre os olhos, desce (a aura apaga junto), pousa, levanta esticando e fica normal
      if (u >= levanta + 0.25 || c < T.respira) A.clawdDB(g, R);
      else if (u >= levanta) A.clawdDB(g, { ...R, sy: 1 + 0.07 * Math.sin(Math.PI * fatia(u, levanta, levanta + 0.25)) });
      else {
        const v = fatia(u, 0, desce), s = { ...s0, alt: s0.alt * (1 - suave(v)), auraAlfa: s0.auraAlfa * (1 - v), f: s0.f * (1 - v) };
        if (sentado) {
          s.roupa = u < 0.12 ? R_SENTA : R_ABRE;
          s.sy = u < desce ? s0.sy + (1 - s0.sy) * v : 1 - 0.1 * Math.sin(Math.PI * fatia(u, desce, levanta));  // pousa
        } else {
          s.roupa = u < 0.06 && s0.roupa === R_PE ? R_PE : A.ROUPA;
          s.sy = s0.sy + (1 - s0.sy) * fatia(u, 0, levanta);
        }
        clawdNoAr(g, R, s, c + u);
      }
      // o que estava no ar: as pedrinhas caem e somem na poeira, as fagulhas apagam (tudo em < 1 s)
      if (s0.pul) {
        const tau = s0.pul.tau;
        for (const p of s0.pul.pedras) {
          if (tau < p.sobe) continue;  // essa nem tinha saído do chão (ainda não aparece)
          poeira(g, p.x, tau + u - p.sobe);
          const h0 = alturaPedra(p, tau);
          if (h0 == null) { poeira(g, p.x, tau + u - p.desce - POUSA); continue; }
          const cai = 0.2 + 0.012 * h0, v = fatia(u, 0, cai);
          if (v < 1) g.drawImage(p.img, q(p.x - p.img.width * P / 2), q(-h0 * (1 - entra(v))) - p.img.height * P, p.img.width * P, p.img.height * P);
          poeira(g, p.x, u - cai);
        }
      }
      fagulhas(g, c + u, sem, KI, c, 1 - fatia(u, 0, 0.35));
    },
  },
};
