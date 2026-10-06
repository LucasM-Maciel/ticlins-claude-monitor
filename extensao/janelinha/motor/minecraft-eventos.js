'use strict';
// Os eventos do tema Minecraft, os mesmos da prévia (p3c1-3): cada mob com o jeito dele.
// fazer(ctx) devolve { dur, danos: [[t, meios corações]], mortes: [[t, n]], totem, pet,
// quadro(g, t, roupa) }, no referencial do Clawd (via quadroEvento). O quadro é função do tempo: tudo que é
// sorteado sai de rng(semente) na hora do fazer. ctx = { vida (0..10), nivel, sobe (esta
// morte sobe de nível), minerio, semente }. Sem sons (o dono não quis).
const { DEG, lim, sai, entra, rng, IMG, tingida } = require('./comum');
const clawd = require('./clawd');
const { MOB, desenhaMob, meioMob, recuo, fazPoof, desenhaPoof, fazExplosao, desenhaExplosao, desenhaDrop, fazOrbes, desenhaOrbes,
  desenhaNivel, desenhaCoracoes, desenhaVarrida, fazFaiscas, desenhaCritico, fazPontos, desenhaPontos, ROXOS, fazCacos, desenhaCacos,
  desenhaBloco, desenhaBrilhos, desenhaCratera, desenhaEscudo, desenhaFlecha } = require('./minecraft-kit');

// o Clawd das cenas: o relógio do motor (pro brilho do Herobrine) e o escudo na frente
let T_AGORA = 0;
function desenhaClawd(g, p) {
  const q = { T: T_AGORA, ...p };
  if (p.escudo) { const e = p.escudo; q.frente = (k, dy) => desenhaEscudo(k, e.x, e.y + dy, e.giro || 0); }
  clawd.desenhaClawd(g, q);
}
const { andando, golpe } = clawd;
const VERMELHO = 'rgba(255,0,0,.3)';

// espada: prepara 0,45 s e acerta em h; volta em 0,12 s
function angEspada(t, hits, prep = 0.45) {
  for (const h of hits) {
    if (t >= h - prep && t < h) return golpe((t - (h - prep)) / prep);
    if (t >= h && t < h + 0.12) return 70 * (1 - (t - h) / 0.12);
  }
  return 0;
}
// golpe crítico = como no jogo: pula e acerta caindo (8 px de pulo, 0,46 s)
function puloCritico(t, h) { const a = h - 0.42; return t < a || t > h + 0.04 ? 0 : -8 * Math.sin(Math.PI * (t - a) / 0.46); }
// o Clawd leva dano em tD: vermelho 0,3 s, empurrão de 5 px (volta em 0,4 s)
function danoClawd(t, danos) {
  for (const [tD] of danos) {
    const e = t - tD;
    if (e >= 0 && e < 0.55) return { dx: e < 0.15 ? -5 * sai(e / 0.15) : -5 * (1 - (e - 0.15) / 0.4), dy: e < 0.15 ? -2 * Math.sin(Math.PI * e / 0.15) : 0, tinta: e < 0.3 ? VERMELHO : null };
  }
  return { dx: 0, dy: 0, tinta: null };
}
function poseLuta(t, roupa, { hits = [], crit = [], danos = [], ferr = 'espada', x = 0, ...extra } = {}) {
  const d = danoClawd(t, danos);
  let y = d.dy;
  for (const h of crit) y += puloCritico(t, h);
  return { roupa, ferr, ang: angEspada(t, hits), x: x + d.dx, y, tinta: d.tinta, ...extra };
}
// o mob apanha: vermelho 0,3 s e o empurrão de sempre (recuo)
function mobApanha(t, hits) {
  let ult = null;
  for (const h of hits) if (t >= h) ult = h;
  if (ult == null) return { dx: 0, dy: 0, tinta: null, andando: false, D: 0 };
  const D = t - ult, k = recuo(D);
  return { dx: k.dx, dy: k.dy, tinta: D < 0.3 ? VERMELHO : null, andando: k.andando, D };
}
// corações em cima do Clawd: aparecem quando ele perde vida e somem 1,8 s depois
function desenhaVida(g, t, vida0, danos, { x = 0, sempre = false, ouro = 0, vidaFixa = null } = {}) {
  let v = vida0, ult = -9;
  for (const [tD, d] of danos) if (t >= tD) { v -= d; ult = tD; }
  if (vidaFixa != null) v = vidaFixa;
  const e = t - ult, alfa = sempre ? 1 : e < 1.8 ? 1 : e < 2.2 ? (2.2 - e) / 0.4 : 0;
  if (alfa <= 0) return;
  g.save(); g.translate(x, 0); desenhaCoracoes(g, Math.max(0, v), ouro, e < 0.5 && Math.floor(e / 0.1) % 2 === 0, alfa); g.restore();
}
// varrida em cada golpe normal; estrelinhas no crítico
function desenhaGolpes(g, t, hits, crit, cx, cy, faiscas) {
  for (const h of hits) if (!crit.includes(h)) desenhaVarrida(g, cx, cy, t - h);
  for (const h of crit) desenhaCritico(g, faiscas, cx + 4, cy, t - h);
}
// morte do jeito do jogo + recompensa: tomba vermelho (0,45 s), deitado até +0,75, fumaça,
// o item quica e gira e voa pro Clawd (+0,9 s), as orbes voam pro Clawd, o nível aparece em cima dele
function fazMorte(r, m, { drop = null, nOrbes = 3, esc = 1 } = {}) { return { m, drop, esc, fumaca: fazPoof(r, 16), orbes: fazOrbes(r, nOrbes), vx: 8 + r() * 18 }; }
function desenhaMorte(g, M, ax, t, tM, ctx, alvoX = 0) {
  const e = t - tM, m = M.m;
  if (e < 0) return;
  if (e < 0.75) {
    const u = Math.min(1, e / 0.2);
    desenhaMob(g, m, ax + 6 * sai(u), e < 0.2 ? -3 * Math.sin(Math.PI * u) : 0, { tinta: VERMELHO, queda: Math.min(1, Math.sqrt(e / 0.45)), esc: M.esc });
    return;
  }
  const s = m.s * M.esc, W = (m.caixa.x1 - m.caixa.x0) * s, H = (m.caixa.y1 - m.caixa.y0) * s;
  const [cx, cy] = meioMob(m, ax + 6, 1, M.esc);
  desenhaPoof(g, M.fumaca, cx, cy, m.queda === 90 ? H : W, m.queda === 90 ? W : H, e - 0.75);
  if (M.drop) desenhaDrop(g, M.drop, e - 0.75, cx, Math.min(-2, cy), M.vx, 0.9, 7, alvoX);
  if (M.orbes.length) {
    desenhaOrbes(g, M.orbes, cx, Math.min(-2, cy), e - 0.8, alvoX);
    if (!ctx.semNivel) { g.save(); g.translate(alvoX, 0); desenhaNivel(g, e - 1.75, ctx.nivel, ctx.sobe); g.restore(); }
  }
}

// ---------- os eventos ----------
// texturas: o que o evento precisa além do kit comum (sem elas ele não é sorteado);
// espaco: reta livre que ele usa (px na frente, atrás), conferida nas fotos
const N = (base, n) => Array.from({ length: n }, (_, i) => base + i);
const KIT = ['espada', 'orbe', 'fonte', 'critico', 'coracao_cheio', 'coracao_meio', 'coracao_vazio', 'coracao_vazio_pisca', ...N('poof', 8), ...N('varrida', 8)];
const EVENTOS = [];
const EV = {};
function evento(e) { e.texturas = [...KIT, ...e.texturas]; EVENTOS.push(e); EV[e.id] = e; }

// zumbi: chega devagar de braços esticados, dá um tapa (-1 coração), leva 3 espadadas (a 3ª crítica) e solta carne podre
evento({
  id: 'zumbi', grupo: 'hostil', raridade: 'comum', mortes: 1, espaco: { frente: 80, tras: 25 }, texturas: ['zumbi', 'it_carne'],
  fazer(ctx) {
    const m = MOB.zumbiAtaca, r = rng(11 + (ctx.semente || 0)), ax = 24, H = [2.4, 2.85, 3.35], CR = [3.35], D = [[1.75, 2]], tM = 3.35;
    const M = fazMorte(r, m, { drop: 'it_carne', nOrbes: 3 }), fa = fazFaiscas(r, 10);
    return {
      dur: tM + 2.6, danos: D, mortes: [[tM, 1]],
      quadro(g, t, roupa) {
        desenhaClawd(g, poseLuta(t, roupa, { hits: H, crit: CR, danos: D }));
        if (t < tM) {
          let x = ax, y = 0;
          const o = {};
          if (t < 1.6) { x = ax + 40 * (1 - t / 1.6); o.quadro = Math.floor(t / 0.22) % 2; }
          else if (t < 1.95) { const k = -45 * Math.sin(Math.PI * (t - 1.6) / 0.35); o.pose = { be: { rot: k }, bd: { rot: k } }; }
          else { const a = mobApanha(t, H.slice(0, 2)); x += a.dx; y += a.dy; o.tinta = a.tinta; if (a.andando) o.quadro = Math.floor(a.D / 0.15) % 2; }
          desenhaMob(g, m, x, y, o);
        }
        desenhaMorte(g, M, ax, t, tM, ctx);
        desenhaGolpes(g, t, H, CR, ax - 7, -10, fa);
        desenhaVida(g, t, ctx.vida, D);
      },
    };
  },
});

// esqueleto: atira de longe; a 1ª flecha bate no escudo, a 2ª passa por baixo do pulo; aí ele apanha e solta um osso
evento({
  id: 'esqueleto', grupo: 'hostil', raridade: 'comum', mortes: 1, espaco: { frente: 135, tras: 45 },
  texturas: ['esqueleto', 'it_osso', 'arco', 'arco0', 'arco1', 'arco2', 'flecha', 'escudo'],
  fazer(ctx) {
    const m = MOB.esqueleto, r = rng(23 + (ctx.semente || 0)), ax = 92, H = [4.25, 4.7, 5.2], CR = [5.2], tM = 5.2, AV = 66;
    const M = fazMorte(r, m, { drop: 'it_osso', nOrbes: 3 }), fa = fazFaiscas(r, 10);
    const arco = t => (t >= 1.0 && t < 1.45) || (t >= 2.0 && t < 2.45) ? 'arco' + Math.min(2, Math.floor(((t - (t < 1.45 ? 1.0 : 2.0)) / 0.45) * 3)) : 'arco';
    return {
      dur: 8.3, danos: [], mortes: [[tM, 1]],
      quadro(g, t, roupa) {
        let cx = 0, p;
        if (t >= 3.1 && t < 3.8) cx = AV * (t - 3.1) / 0.7; else if (t >= 3.8 && t < 7.3) cx = AV; else if (t >= 7.3 && t < 8.1) cx = AV * (1 - (t - 7.3) / 0.8);
        if (t >= 1.3 && t < 2.0) p = { roupa, escudo: { x: 9, y: -8, giro: t < 1.42 ? 70 * (1 - (t - 1.3) / 0.12) : 0 } };
        else if (t >= 2.55 && t < 3.0) p = { roupa, ferr: 'espada', ang: -20, y: -14 * Math.sin(Math.PI * (t - 2.55) / 0.45) };
        else if ((t >= 3.1 && t < 3.8) || (t >= 7.3 && t < 8.1)) p = andando(t, { roupa, ferr: 'espada' });
        else p = poseLuta(t, roupa, { hits: H, crit: CR });
        p.x = (p.x || 0) + cx;
        desenhaClawd(g, p);
        if (t < tM) {
          let x = ax, y = 0;
          const o = {};
          if (t < 1.0) { x = ax + 38 * (1 - t); o.quadro = Math.floor(t / 0.15) % 2; }
          else { const a = mobApanha(t, H.slice(0, 2)); x += a.dx; y += a.dy; o.tinta = a.tinta; if (a.andando) o.quadro = Math.floor(a.D / 0.15) % 2; }
          desenhaMob(g, m, x, y, o);
          const img = IMG[arco(t)];
          if (img) { g.save(); g.translate(x - 6.5, y - 9); g.rotate(-45 * DEG); g.drawImage(img, -5, -5, 10, 10); g.restore(); }
          if ((t >= 1.0 && t < 1.45) || (t >= 2.0 && t < 2.45)) desenhaFlecha(g, x - 8, y - 9, 180);
        }
        // flecha 1: voa até o escudo e ricocheteia
        if (t >= 1.45 && t < 1.8) { const u = (t - 1.45) / 0.35; desenhaFlecha(g, 84 - 74 * u, -9 - 5 * Math.sin(Math.PI * u), 180 - 15 * Math.cos(Math.PI * u)); }
        else if (t >= 1.8 && t < 2.6) {
          const e = t - 1.8, y = Math.min(-1, -9 - 55 * e + 150 * e * e);
          g.save(); g.globalAlpha *= e > 0.5 ? Math.max(0, (0.8 - e) / 0.3) : 1; desenhaFlecha(g, 10 + 28 * e, y, 180 + 900 * Math.min(e, 0.5)); g.restore();
        }
        // flecha 2: passa por baixo do pulo e crava no chão atrás
        if (t >= 2.45 && t < 3.0) { const u = (t - 2.45) / 0.55; desenhaFlecha(g, 84 - 122 * u, -11 + 9 * u, 176); }
        else if (t >= 3.0 && t < 7.9) { g.save(); g.globalAlpha *= t > 7.5 ? (7.9 - t) / 0.4 : 1; desenhaFlecha(g, -38, -1.5, 160); g.restore(); }
        desenhaMorte(g, M, ax, t, tM, ctx, AV);
        desenhaGolpes(g, t, H, CR, ax - 8, -10, fa);
      },
    };
  },
});

// creeper: leva 2 espadadas, chia, incha, pisca e EXPLODE (cratera, cacos de grama e terra,
// o Clawd voa e cai sentado). Se a explosão mataria o Clawd, o totem da imortalidade salva.
// verdes e amarelos das faíscas do jogo, numa paleta fixa (cor sorteada por faísca enchia o cache de tintas)
const AMARELOS = ['rgb(166,179,13)', 'rgb(191,217,38)', 'rgb(179,198,26)'];
const VERDES = ['rgb(31,115,13)', 'rgb(51,140,26)', 'rgb(71,166,38)', 'rgb(38,158,5)', 'rgb(64,107,46)', 'rgb(46,128,31)'];
const GLITTER_CORES = r => (r() < 0.25 ? AMARELOS[Math.floor(r() * AMARELOS.length)] : VERDES[Math.floor(r() * VERDES.length)]);
function fazTotem(r) { return Array.from({ length: 46 }, () => { const a = -Math.PI / 2 + (r() - 0.5) * 2.6, v = 35 + r() * 70; return { vx: Math.cos(a) * v, vy: Math.sin(a) * v, vida: 0.8 + r() * 0.7, cor: GLITTER_CORES(r), tam: 2.4 + r() * 1.8 }; }); }
// o totem sobe girando e crescendo (como na tela do jogo); as faíscas verdes e amarelas espirram
function desenhaTotem(g, lista, x, y, e) {
  if (e < 0) return;
  for (const p of lista) {
    if (e >= p.vida) continue;
    const u = e / p.vida, f = 7 - Math.min(7, Math.floor(u * 8)), img = IMG['brilho' + f];
    if (!img) continue;
    g.save(); g.globalAlpha *= u > 0.7 ? (1 - u) / 0.3 : 1;
    g.drawImage(tingida(img, p.cor, 'brilho' + f), x + p.vx * e - p.tam / 2, y + p.vy * e + 45 * e * e - p.tam / 2, p.tam, p.tam);
    g.restore();
  }
  if (e < 1.15 && IMG.totem) {
    const sz = e < 0.45 ? 6 + 16 * sai(e / 0.45) : e < 0.8 ? 22 : 22 + 10 * (e - 0.8) / 0.35;
    const yy = y - 4 - 18 * sai(Math.min(1, e / 0.45));
    g.save(); g.globalAlpha *= e < 0.8 ? 1 : 1 - (e - 0.8) / 0.35;
    g.translate(x, yy); g.scale(Math.cos(e * 11) || 0.02, 1); g.drawImage(IMG.totem, -sz / 2, -sz / 2, sz, sz); g.restore();
  }
}
const TEX_CREEPER = ['creeper', 'grama', 'terra', 'totem', 'coracao_ouro', ...N('explosao', 16), ...N('brilho', 8)];
function fazCreeper(ctx) {
  const m = MOB.creeper, r = rng(31 + (ctx.semente || 0)), ax = 23.4, C = 1.0, G = 0.45;
  const fa = fazFaiscas(r, 10);
  const E = C + 1.95, H = [C + G, C + 2 * G], boom = fazExplosao(r, 9), grama = fazCacos(r, 8, 110, 3.2), terra = fazCacos(r, 8, 95, 3);
  const totem = !ctx.semTotem && ctx.vida - 8 <= 0, TT = E + 0.1, brilhos = fazTotem(r);
  const D = [[E, totem ? ctx.vida : Math.min(8, ctx.vida - 1)]];
  return {
    dur: E + 2.5, danos: D, mortes: [], totem, tTotem: TT,
    quadro(g, t, roupa) {
      const d = t - E;
      g.save();
      if (d >= 0 && d < 0.3) { const k = 1 - d / 0.3; g.translate(Math.sin(d * 90) * 1.4 * k, Math.cos(d * 70) * k); }  // tremida
      desenhaCratera(g, ax, 10, d < 0 ? 0 : t > E + 2.1 ? (E + 2.5 - t) / 0.4 : 1);
      // Clawd: voa, cai sentado; com o totem, brilha dourado
      const gq = (t - C) / G;
      let pose = { roupa, ferr: 'espada', ang: gq >= 0 && gq < 2 ? golpe(gq % 1) : 0 };
      if (t >= C + 2 * G && d < 0) pose.x = -2 * sai(lim((t - C - 2 * G) / 0.3, 0, 1));
      if (d >= 0) {
        if (d < 0.55) { const u = d / 0.55; pose = { roupa, ferr: 'espada', ang: -60, x: -2 - 24 * sai(u), y: -12 * Math.sin(Math.PI * u), rot: -35 * Math.sin(Math.PI * u), olhos: 'fechados' }; }
        else if (d < 1.5) { const e = d - 0.55; pose = { roupa, ferr: 'espada', ang: 35, x: -26, sentado: true, sy: e < 0.15 ? 1 - 0.18 * Math.sin(Math.PI * e / 0.15) : 1, olhos: e < 0.35 ? 'fechados' : 'abertos' }; }
        else if (d < 2.1) { const u = (d - 1.5) / 0.6; pose = andando(d, { roupa, ferr: 'espada', x: -26 + 26 * u }); }
        if (d < 0.25) pose.tinta = VERMELHO;
        if (totem && t >= TT && t < TT + 1.6) {
          const k = 1 - (t - TT) / 1.6;
          pose.brilho = k;
          if (!pose.tinta) pose.tinta = `rgba(255,215,64,${(0.45 * k * (0.6 + 0.4 * Math.sin((t - TT) * 18))).toFixed(2)})`;
        }
      }
      desenhaClawd(g, pose);
      if (d < 0) {
        let x = ax, y = 0;
        const o = {};
        if (t < C) { x = ax + 28 * (1 - t / C); o.quadro = Math.floor(t / 0.15) % 2; }
        else { const a = mobApanha(t, H); x += a.dx; y += a.dy; o.tinta = a.tinta; if (a.andando) o.quadro = Math.floor(a.D / 0.15) % 2; }
        if (t >= C + G) {  // incha e pisca branco (como o jogo: 1,5 s)
          const f = lim((t - C - G) / 1.5, 0, 1), f1 = 1 + Math.sin(f * 100) * f * 0.01, f4 = f ** 4;
          o.sx = (1 + f4 * 0.4) * f1; o.sy = (1 + f4 * 0.1) / f1;
          if (!o.tinta && Math.floor(f * 10) % 2) o.tinta = `rgba(255,255,255,${(0.75 * lim(f, 0.5, 1)).toFixed(2)})`;
        }
        desenhaMob(g, m, x, y, o);
      }
      if (d >= 0) {
        desenhaCacos(g, grama, 'grama', ax, -3, d); desenhaCacos(g, terra, 'terra', ax, -2, d);
        desenhaExplosao(g, boom, ax, -9, d);
      }
      desenhaGolpes(g, t, H, [], ax - 6, -10, fa);
      const xv = d >= 0 ? -26 * sai(Math.min(1, d / 0.55)) : 0;
      if (totem) {
        desenhaTotem(g, brilhos, -16, -8, t - TT);
        desenhaVida(g, t, ctx.vida, D, { x: xv, sempre: true, ouro: t >= TT + 0.35 ? 4 : 0, vidaFixa: t >= TT + 0.35 ? 1 : null });
      } else desenhaVida(g, t, ctx.vida, D, { x: xv });
      g.restore();
    },
  };
}
evento({ id: 'creeper', grupo: 'hostil', raridade: 'comum', mortes: 0, espaco: { frente: 60, tras: 45 }, texturas: TEX_CREEPER, fazer: fazCreeper });
// o totem não é sorteado: é o creeper quando a explosão mataria (aqui, com 3 corações)
evento({ id: 'totem', grupo: 'raro', raridade: 'raro', especial: true, mortes: 0, espaco: { frente: 60, tras: 45 }, texturas: TEX_CREEPER, fazer: ctx => fazCreeper({ ...ctx, vida: 6 }) });

// aranha: desce num fio de teia com os olhos vermelhos brilhando, dá o bote (-1 coração), apanha e solta linha
evento({
  id: 'aranha', grupo: 'hostil', raridade: 'comum', mortes: 1, espaco: { frente: 55, tras: 25 }, texturas: ['aranha', 'aranha_olhos', 'it_linha'],
  fazer(ctx) {
    const m = MOB.aranha, r = rng(41 + (ctx.semente || 0)), ax = 33, H = [3.3, 3.75, 4.25], CR = [4.25], tM = 4.25, D = [[2.6, 2]];
    const M = fazMorte(r, m, { drop: 'it_linha', nOrbes: 3 }), fa = fazFaiscas(r, 10);
    return {
      dur: tM + 2.6, danos: D, mortes: [[tM, 1]],
      quadro(g, t, roupa) {
        desenhaClawd(g, poseLuta(t, roupa, { hits: H, crit: CR, danos: D, olhos: t > 0.5 && t < 2.0 ? 'cima' : 'abertos' }));
        if (t < tM) {
          let x = ax, y = 0, fio = false;
          const o = {};
          if (t < 1.2) { y = -62 + 32 * sai(t / 1.2); fio = true; o.quadro = Math.floor(t / 0.1) % 2; }
          else if (t < 1.8) { y = -30 + Math.sin((t - 1.2) * 6) * 1.2; x += Math.sin((t - 1.2) * 3.5) * 2; fio = true; }
          else if (t < 2.0) y = -30 + 30 * entra((t - 1.8) / 0.2);
          else if (t < 2.3) o.sy = 1 - 0.15 * Math.sin(Math.PI * (t - 2.0) / 0.3);
          else if (t < 2.65) { const u = (t - 2.3) / 0.35; x = ax - 14 * u; y = -14 * Math.sin(Math.PI * u); o.quadro = 1; }
          else if (t < 2.95) { const u = (t - 2.65) / 0.3; x = ax - 14 + 14 * sai(u); y = -4 * Math.sin(Math.PI * u); o.quadro = Math.floor(t / 0.08) % 2; }
          else { const a = mobApanha(t, H.slice(0, 2)); x += a.dx; y += a.dy; o.tinta = a.tinta; if (a.andando) o.quadro = Math.floor(a.D / 0.1) % 2; }
          if (fio) { g.strokeStyle = 'rgba(229,231,235,.8)'; g.lineWidth = 0.6; g.beginPath(); g.moveTo(x, -100); g.lineTo(x, y - 9.5); g.stroke(); }
          if (t < 2.3) {  // os olhos vermelhos brilham (halo que pulsa)
            const a = 0.25 + 0.2 * Math.sin(t * 9), gr = g.createRadialGradient(x, y - 6.5, 0.5, x, y - 6.5, 6);
            gr.addColorStop(0, `rgba(255,20,20,${a.toFixed(2)})`); gr.addColorStop(1, 'rgba(255,20,20,0)'); g.fillStyle = gr; g.fillRect(x - 6, y - 12.5, 12, 12);
          }
          desenhaMob(g, m, x, y, o);
        }
        desenhaMorte(g, M, ax, t, tM, ctx);
        desenhaGolpes(g, t, H, CR, ax - 12, -6, fa);
        desenhaVida(g, t, ctx.vida, D);
      },
    };
  },
});

// slime: cada espadada divide (grande -> 2 médios -> 4 pequenos) e uma varrida acaba com os 4
function pulos(t, a, b, x0, x1, n, h) { const u = lim((t - a) / (b - a), 0, 1); return { x: x0 + (x1 - x0) * u, y: -h * Math.abs(Math.sin(Math.PI * n * u)), sy: 1 + 0.12 * Math.abs(Math.sin(Math.PI * n * u)) }; }
evento({
  id: 'slime', grupo: 'hostil', raridade: 'incomum', mortes: 4, espaco: { frente: 95, tras: 25 }, texturas: ['slime', 'it_slime'],
  fazer(ctx) {
    const m = MOB.slime, r = rng(53 + (ctx.semente || 0)), GR = 1.35, MD = 0.8, PQ = 0.45, V = 3.3;
    const poofs = [fazPoof(r, 10), fazPoof(r, 8), fazPoof(r, 8)];
    const peqs = [[2.25, 26, 19], [2.25, 26, 30], [2.8, 40, 35], [2.8, 40, 47]].map(([nasce, de, para], i) => ({ nasce, de, para, M: fazMorte(r, m, { drop: i % 2 ? null : 'it_slime', nOrbes: 1, esc: PQ }) }));
    return {
      dur: V + 2.6, danos: [], mortes: [[V, 4]],
      quadro(g, t, roupa) {
        desenhaClawd(g, poseLuta(t, roupa, { hits: [1.65, 2.2, 2.75, V] }));
        if (t < 1.7) {  // grande
          let x = 36, y = 0;
          const o = { esc: GR };
          if (t < 1.2) { const p = pulos(t, 0, 1.2, 74, 36, 3, 7); x = p.x; y = p.y; o.sy = p.sy; }
          else o.sy = 1 + 0.04 * Math.sin(t * 9);
          if (t >= 1.65) { o.tinta = VERMELHO; o.sy = 0.8; o.sx = 1.15; }
          desenhaMob(g, m, x, y, o);
        }
        desenhaPoof(g, poofs[0], 36, -8, 14, 10, t - 1.7);
        const medio = (nasce, para, morre, i) => {
          if (t < nasce || t >= morre) return;
          let x, y = 0;
          const o = { esc: MD };
          if (t < nasce + 0.35) { const u = (t - nasce) / 0.35; x = 36 + (para - 36) * u; y = -10 * Math.sin(Math.PI * u); }
          else if (i === 1 && t >= 2.3 && t < 2.6) { const p = pulos(t, 2.3, 2.6, para, 40, 1, 5); x = p.x; y = p.y; }
          else { x = i === 1 && t >= 2.6 ? 40 : para; o.sy = 1 + 0.05 * Math.sin(t * 11 + i); }
          if (morre - t < 0.05) { o.tinta = VERMELHO; o.sy = 0.8; }
          desenhaMob(g, m, x, y, o);
        };
        medio(1.7, 26, 2.25, 0); medio(1.7, 48, 2.8, 1);
        desenhaPoof(g, poofs[1], 26, -5, 9, 7, t - 2.25); desenhaPoof(g, poofs[2], 40, -5, 9, 7, t - 2.8);
        // pequenos: nascem pulando pra fora, pulam no lugar, morrem todos na varrida
        peqs.forEach((p, i) => {
          if (t < p.nasce) return;
          if (t < V) {
            let x, y;
            if (t < p.nasce + 0.3) { const u = (t - p.nasce) / 0.3; x = p.de + (p.para - p.de) * u; y = -8 * Math.sin(Math.PI * u); }
            else { x = p.para; y = -2.5 * Math.abs(Math.sin((t - p.nasce) * 6 + i)); }
            desenhaMob(g, m, x, y, { esc: PQ });
          } else desenhaMorte(g, p.M, p.para, t, V, i === 0 ? ctx : { ...ctx, semNivel: true });
        });
        for (const h of [1.65, 2.2, 2.75]) desenhaVarrida(g, h === 1.65 ? 26 : h === 2.2 ? 20 : 32, -7, t - h);
        desenhaVarrida(g, 32, -6, t - V, '#FFFFFF', 36);
      },
    };
  },
});

// traça: o bloco de pedra que o Clawd minera era infestado; ela corre em zigue-zague, morde (meio coração) e leva 2 picaretadas
evento({
  id: 'traca', grupo: 'hostil', raridade: 'incomum', mortes: 1, espaco: { frente: 60, tras: 25 }, texturas: ['silverfish', 'rocha', 'picareta', ...N('racha', 10)],
  fazer(ctx) {
    const m = MOB.traca, r = rng(61 + (ctx.semente || 0)), H = [2.55, 3.0], tM = 3.0, D = [[2.1, 1]];
    const M = fazMorte(r, m, { nOrbes: 2 }), cacos = fazCacos(r, 12, 80);
    const rota = [[1.4, 40], [1.7, 24], [1.9, 44], [2.1, 24]];
    return {
      dur: tM + 2.6, danos: D, mortes: [[tM, 1]],
      quadro(g, t, roupa) {
        if (t < 1.1) desenhaClawd(g, { roupa, ferr: 'picareta', ang: t < 0.3 ? 0 : golpe(((t - 0.3) % 0.2) / 0.2) });
        else desenhaClawd(g, poseLuta(t, roupa, { hits: H, danos: D, ferr: 'picareta' }));
        if (t < 1.1) desenhaBloco(g, 'rocha', 14, 12, t < 0.3 ? -1 : (t - 0.3) / 0.8 * 0.4, Math.min(1, t / 0.3));
        desenhaCacos(g, cacos, 'rocha', 20, -6, t - 1.1);
        if (t >= 1.1 && t < tM) {
          let x, y = 0, vira = false;
          const o = {};
          if (t < 1.4) { const u = (t - 1.1) / 0.3; x = 20 + 20 * u; y = -10 * Math.sin(Math.PI * u); vira = true; }
          else if (t < 2.1) {
            let k = 1;
            while (k < rota.length - 1 && t >= rota[k][0]) k++;
            const [a, xa] = rota[k - 1], [b, xb] = rota[k], u = (t - a) / (b - a);
            x = xa + (xb - xa) * u; vira = xb > xa; o.quadro = Math.floor(t / 0.05) % 2;
          } else { const a = mobApanha(t, H.slice(0, 1)); x = 30 + a.dx - 6 * Math.max(0, 1 - (t - 2.1) / 0.2); y = a.dy; o.tinta = a.tinta; o.quadro = Math.floor(t / 0.05) % 2; }
          o.vira = vira;
          desenhaMob(g, m, x, y, o);
        }
        desenhaMorte(g, M, 30, t, tM, ctx);
        for (const h of H) desenhaVarrida(g, 18, -4, t - h);
        desenhaVida(g, t, ctx.vida, D);
      },
    };
  },
});

// enderman: aparece teleportando, arranca um bloco de grama da borda do cartão e segura;
// leva uma espadada e some, volta, leva um crítico, solta o bloco (volta pro buraco) e vai embora
function desenhaBuraco(g, x, w) { g.fillStyle = '#121212'; g.fillRect(x, 0, w, 6); g.fillStyle = 'rgba(0,0,0,.5)'; g.fillRect(x, 0, w, 1); }
function blocoGrama(g, x, y, lado = 6) { if (IMG.grama) g.drawImage(IMG.grama, x - lado / 2, y - lado, lado, lado); }
evento({
  id: 'enderman', grupo: 'hostil', raridade: 'raro', mortes: 0, espaco: { frente: 85, tras: 25 }, texturas: ['enderman', 'enderman_olhos', 'grama'],
  fazer(ctx) {
    const m = MOB.enderman, r = rng(71 + (ctx.semente || 0)), H = [2.15, 3.45], CR = [3.45], fa = fazFaiscas(r, 10);
    const tps = [[0.1, null, 44], [1.6, 44, 24], [2.3, 24, 70], [2.95, 70, 24], [3.6, 24, null]].map(([t, de, para]) => ({ t, de, para, a: fazPontos(r, 22, ROXOS, 24, 0.7), b: fazPontos(r, 22, ROXOS, 24, 0.7) }));
    const B = 55;  // onde fica o buraco do bloco
    return {
      dur: 4.8, danos: [], mortes: [],
      quadro(g, t, roupa) {
        if (t >= 0.9 && t < 3.95) desenhaBuraco(g, B - 3, 6);
        desenhaClawd(g, poseLuta(t, roupa, { hits: H, crit: CR }));
        let x = null, entrando = 0;
        for (const tp of tps) if (t >= tp.t) { x = tp.para; entrando = t - tp.t; }
        if ((t >= 1.6 && t < 1.75) || (t >= 2.3 && t < 2.5) || (t >= 2.95 && t < 3.05)) x = null;
        if (x != null) {
          const o = { alfa: Math.min(1, entrando / 0.1) };
          if (t >= 0.6 && t < 0.9) o.pose = { cab: { dy: 1.5 }, be: { rot: -20 }, bd: { rot: 20 } };
          const a = mobApanha(t, H);
          if (a.tinta) o.tinta = a.tinta;
          const segura = t >= 1.1 && t < 3.5;
          if (segura) o.pose = { be: { rot: -35 }, bd: { rot: 35 } };
          desenhaMob(g, m, x + a.dx, a.dy, o);
          if (segura) blocoGrama(g, x + a.dx, -9.5 + a.dy, 6);
        }
        if (t >= 0.9 && t < 1.1) { const u = (t - 0.9) / 0.2; blocoGrama(g, B + (44 - B) * u, -9.5 * u, 6); }
        if (t >= 3.5 && t < 3.95) { const u = (t - 3.5) / 0.45; blocoGrama(g, 24 + (B - 24) * u, -9.5 * (1 - u) - 14 * Math.sin(Math.PI * u) + 6 * u, 6); }
        // partículas roxas de cada teleporte (onde sumiu e onde apareceu)
        for (const tp of tps) {
          if (tp.de != null) desenhaPontos(g, tp.a, tp.de, -11, 10, 20, t - tp.t);
          if (tp.para != null) desenhaPontos(g, tp.b, tp.para, -11, 10, 20, t - tp.t - (tp.de != null ? 0.12 : 0));
        }
        desenhaGolpes(g, t, H, CR, 18, -12, fa);
      },
    };
  },
});

// lobo: o Clawd mostra um osso; na 2ª tentativa saem corações, o lobo ganha coleira vermelha e passa a seguir o Clawd
function fazCoracoes(r, n) { return Array.from({ length: n }, (_, i) => ({ atraso: i * 0.13, ox: (r() - 0.5) * 10, vx: (r() - 0.5) * 6 })); }
function desenhaCoracoesPart(g, lista, cx, cy, e) {
  if (!IMG.coracao_part) return;
  for (const p of lista) {
    const k = e - p.atraso;
    if (k < 0 || k >= 0.9) continue;
    g.save(); g.globalAlpha *= k > 0.6 ? (0.9 - k) / 0.3 : 1;
    g.drawImage(IMG.coracao_part, cx + p.ox + p.vx * k - 2, cy - 14 * k - 2, 4, 4);
    g.restore();
  }
}
evento({
  id: 'lobo', grupo: 'pacifico', raridade: 'incomum', mortes: 0, espaco: { frente: 105, tras: 45 }, texturas: ['lobo', 'lobo_manso', 'lobo_coleira', 'coracao_part', 'it_osso'],
  fazer(ctx) {
    const r = rng(81 + (ctx.semente || 0)), fumaca = fazPontos(r, 12, ['#9CA3AF', '#D1D5DB', '#6B7280'], 14, 0.6), cor = fazCoracoes(r, 6);
    return {
      dur: 5.0, danos: [], mortes: [], pet: 2.2,  // vira manso em 2,2 s: dali em diante ele segue o Clawd
      quadro(g, t, roupa) {
        const m = MOB[t >= 2.2 ? 'loboManso' : 'lobo'];
        let x, vira = false, q = 0, andaClawd = false;
        if (t < 1.2) { x = 86 - 46 * (t / 1.2); q = Math.floor(t / 0.12) % 2; }
        else if (t < 2.9) x = 40;
        else if (t < 3.8) { x = 40 - 66 * (t - 2.9) / 0.9; q = Math.floor(t / 0.09) % 2; }
        else { x = -26; vira = true; q = Math.floor(t / 0.16) % 2; andaClawd = true; }
        const atras = x < 18;
        if (atras) desenhaMob(g, m, x, 0, { quadro: q, vira });
        if (andaClawd) desenhaClawd(g, andando(t, { roupa, ferr: 'espada' }));
        else desenhaClawd(g, { roupa, ferr: t >= 1.3 && t < 3.0 ? 'it_osso' : 'espada', ang: t >= 1.3 && t < 3.0 ? 25 : 0 });
        if (!atras) desenhaMob(g, m, x, 0, { quadro: q, vira });
        desenhaPontos(g, fumaca, 30, -14, 6, 4, t - 1.6);
        desenhaCoracoesPart(g, cor, 32, -14, t - 2.2);
      },
    };
  },
});

// galinha: passa ciscando, bota um ovo e vai embora batendo as asas; o ovo voa pro Clawd
evento({
  id: 'galinha', grupo: 'pacifico', raridade: 'incomum', mortes: 0, espaco: { frente: 105, tras: 25 }, texturas: ['galinha', 'it_ovo'],
  fazer() {
    const m = MOB.galinha;
    return {
      dur: 4.0, danos: [], mortes: [],
      quadro(g, t, roupa) {
        const pulo = t >= 3.3 && t < 3.55 ? -4 * Math.sin(Math.PI * (t - 3.3) / 0.25) : 0;
        desenhaClawd(g, { roupa, ferr: 'espada', y: pulo, olhos: t >= 3.3 && t < 3.7 ? 'cima' : 'abertos' });
        let x = 34, y = 0;
        const o = {};
        if (t < 1.4) { x = 84 - 50 * t / 1.4; o.quadro = Math.floor(t / 0.15) % 2; o.pose = { cab: { dx: Math.floor(t / 0.3) % 2 ? -0.5 : 0 } }; }
        else if (t < 2.6) { const bica = (t >= 1.5 && t < 1.8) || (t >= 2.0 && t < 2.3); if (bica) o.pose = { cab: { dx: -1, dy: 3 * Math.sin(Math.PI * ((t - (t < 1.8 ? 1.5 : 2.0)) / 0.3)) } }; }
        else if (t < 3.6) { const u = (t - 2.6) / 1.0; x = 34 + 62 * u; y = -2 * Math.abs(Math.sin(u * Math.PI * 3)); o.vira = true; o.quadro = Math.floor(t / 0.06) % 2; o.pose = { asa: { dy: Math.floor(t / 0.05) % 2 ? -1.5 : 0 } }; }
        if (t < 3.6) desenhaMob(g, m, x, y, o);
        desenhaDrop(g, 'it_ovo', t - 2.4, 40, -5, 10, 0.6, 7);
      },
    };
  },
});

// mineração: o minério é sorteado (diamante mais raro, e brilha); rachaduras do jogo, cacos, item e XP
const MINERIOS = [
  { id: 'carvao', bloco: 'min_carvao', item: 'it_carvao', n: 1, xp: 1, peso: 30 },
  { id: 'ferro', bloco: 'min_ferro', item: 'it_ferro', n: 1, xp: 0, peso: 22 },
  { id: 'ouro', bloco: 'min_ouro', item: 'it_ouro', n: 1, xp: 0, peso: 12 },
  { id: 'redstone', bloco: 'min_redstone', item: 'it_redstone', n: 2, xp: 2, peso: 12 },
  { id: 'lapis', bloco: 'min_lapis', item: 'it_lapis', n: 2, xp: 3, peso: 10 },
  { id: 'esmeralda', bloco: 'min_esmeralda', item: 'it_esmeralda', n: 1, xp: 4, peso: 6 },
  { id: 'diamante', bloco: 'pedra', item: 'diamante', n: 1, xp: 5, peso: 4, brilha: true },  // pedra/diamante: os nomes da janelinha
];
function sorteiaMinerio(x) { const tot = MINERIOS.reduce((a, m) => a + m.peso, 0); let k = x * tot; for (const m of MINERIOS) { k -= m.peso; if (k < 0) return m; } return MINERIOS[0]; }
evento({
  id: 'mineracao', grupo: 'mina', raridade: 'comum', mortes: 0, espaco: { frente: 45, tras: 20 },
  texturas: ['picareta', ...N('racha', 10), ...MINERIOS.flatMap(m => [m.bloco, m.item])],
  fazer(ctx) {
    const M = ctx.minerio || sorteiaMinerio(rng(91 + (ctx.semente || 0))()), r = rng(97 + (ctx.semente || 0)), Q = 1.9;
    const cacos = fazCacos(r, 14, 85), orbes = fazOrbes(r, Math.min(5, M.xp)), vxs = [12, -8];
    return {
      dur: 4.6, danos: [], mortes: [], minerio: M,
      quadro(g, t, roupa) {
        desenhaClawd(g, { roupa, ferr: 'picareta', ang: t < 0.3 || t >= Q ? 0 : golpe(((t - 0.3) % 0.2) / 0.2) });
        if (t < Q) {
          desenhaBloco(g, M.bloco, 14, 12, t < 0.3 ? -1 : (t - 0.3) / 1.6, Math.min(1, t / 0.3));
          if (M.brilha) desenhaBrilhos(g, 14, -12, 12, 12, t, 3);
        }
        desenhaCacos(g, cacos, M.bloco, 20, -6, t - Q);
        for (let i = 0; i < M.n; i++) desenhaDrop(g, M.item, t - Q - i * 0.06, 20, -6, vxs[i], 0.9, 7);
        if (M.brilha && t >= Q && t < Q + 1.15) desenhaBrilhos(g, 20, -12, 14, 10, t, 2);
        if (orbes.length) { desenhaOrbes(g, orbes, 20, -6, t - Q - 0.05); desenhaNivel(g, t - Q - 1.0, ctx.nivel, ctx.sobe); }
      },
    };
  },
});

// o quadro de um evento: guarda o relógio do motor pro brilho do Herobrine
function quadroEvento(c, g, t, roupa, T) { T_AGORA = T; c.quadro(g, t, roupa); }

module.exports = { EVENTOS, EV, MINERIOS, sorteiaMinerio, quadroEvento };
