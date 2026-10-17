'use strict';
// Tema Akatsuki (votação de 07/10; venceu junto com o Elden Ring, dono 13/10). O Clawd ninja de
// chapéu de palha e manto preto de nuvens vermelhas. O cartão tem um fio vermelho com nuvens
// presas na borda: bolinha = nuvenzinha da cor da situação, barra do usage = vermelha com uma
// kunai na ponta (pulsa a partir de 80%, solta brasas a partir de 95%), números na fonte de visor.
// Nas paradas da caminhada (dono, 13/10, as 4): faz selos e solta três clones de fumaça que correm
// com ele; vira uma revoada de corvos e se refaz mais à frente; um inimigo pula nele e acerta um
// tronco (ele já está atrás, e joga a kunai); ou cospe uma bola de fogo num inimigo. O inimigo é
// sorteado (dono, 14/10): o bug, um ANBU, um ninja da Folha ou o Kakashi (akatsuki-inimigos.js; o
// Time 7 enfrenta outros 3). Os três que andam (clones,
// corvos, tronco) terminam mais à frente na trilha. Acabou tudo: a lua vermelha sobe atrás do
// cartão e uma revoada cruza na frente dela (sem trilha: o aviso já toca). A cada 30 inimigos
// derrubados, o épico raro, com som (akatsuki-epico.js). Parado há 1 min, uma vez cada: come um
// lámen (parado-akatsuki-lamen.js) ou treina jogando kunais num poste (parado-akatsuki-treino.js).
// Os desenhos estão em akatsuki-*.js.
// OS DOIS LADOS (dono, 13/10: "igual do Star Wars, com Akatsuki e Time 7"): a cada 50 voltas
// andadas ele troca de lado, pra sempre, numa cena (a virada: um redemoinho de corvos ou de folhas e
// um puf). Cada lado tem 3 roupas, e a cada volta pra um lado ele veste a próxima
// (akatsuki-roupas.js). No Time 7 o cartão fica azul-marinho e laranja com folhas, as 4 cenas da
// caminhada são outras (akatsuki-time7.js), a lua do 'tudo' é clara com folhas, e o épico também é
// outro (akatsuki-epico-time7.js).
const { lim, sai, entra, rng, rgba } = require('./comum');
const A = require('./akatsuki-arte');
const K = require('./akatsuki-cartao');
const T7 = require('./akatsuki-time7');
const INI = require('./akatsuki-inimigos');
const P = require('./parado').paradas('akatsuki', ['lamen', 'treino']);

const { fatia } = A;
const SORTEADAS = { akatsuki: ['clones', 'corvos', 'tronco', 'fogo'], time7: ['sapo', 'esfera', 'raio', 'folhas'] };
const VOLTAS = 50;  // voltas andadas em cada lado (como no Sith)
const CHANCE = 0.6;  // das paradas da caminhada, quantas têm cena
const MORTE = { tronco: 1.75, fogo: 1.85, ...T7.MORTE };  // s: quando o inimigo da cena cai
const BUGS = 30;  // inimigos derrubados por épico: ~30/h andando = 1 a cada ~1 h (como os droides do Sith)
// as cenas que terminam mais à frente: [a partir de quando ele já está lá (s), quanto (px)]
const PULA = { clones: [2.35, 40], corvos: [1.7, 48], tronco: [1.18, 44], ...T7.PULA };
const COR = { rotulo: '#9CA3AF', falta: '#6B7280' };


// ---------- as cenas da caminhada ----------
// Cada uma: semente => { dur, espaco, quadro(g, t, m) } no referencial do Clawd.
const FABRICAS = {
  // selos; três clones saem da fumaça (um atrás, dois na frente), cada um dá um pulinho em onda, os
  // quatro disparam juntos pra frente e os clones viram fumaça; ele segue de lá.
  // Selos 0–0,7 · puf 0,7–1,2 · onda 0,95–1,55 · corrida 1,7–2,35 · somem 2,5–3,0 · selo 2,9–3,2 · fim 3,4
  clones: semente => {
    const XS = [-22, 0, 22, 44], LONGE = PULA.clones[1];
    return {
      dur: 3.4, espaco: { frente: 100, tras: 36 },
      quadro(g, t, m) {
        const dx = LONGE * sai(fatia(t, 1.7, 2.35)), correndo = t >= 1.7 && t < 2.35;
        if (correndo) for (const x0 of XS) A.rastro(g, x0 + dx, t);  // atrás de todos (entre eles, some atrás do da frente)
        XS.forEach((x0, i) => {
          const eu = x0 === 0, h = 0.95 + i * 0.12, sumiu = 2.5 + i * 0.12;
          const pulo = t >= h && t < h + 0.26 ? -6 * Math.sin(Math.PI * (t - h) / 0.26) : 0;
          if (eu || (t >= 0.78 && t < sumiu + 0.06)) {
            A.clawdAkatsuki(g, {
              T: m.T, x: x0 + dx, y: pulo, pernas: correndo ? (Math.floor(t / 0.06 + i) % 2 ? 'A' : 'B') : 'ambas',
              selo: eu && t < 0.7 ? A.seloEm(t) : eu && t >= 2.9 && t < 3.2 ? 3 : null,
            });
          }
          if (eu) return;
          A.puf(g, x0, -9, fatia(t, 0.7, 1.2), semente + i);
          A.puf(g, x0 + LONGE, -9, fatia(t, sumiu, sumiu + 0.5), semente + 7 + i);
        });
      },
    };
  },
  // ele escurece, explode numa revoada de corvos que sobe num arco e desce junta lá na frente, onde
  // ele se refaz (escuro, clareando); as penas caem onde ele estava.
  // Escurece 0,2–0,48 · revoada 0,45–1,55 · junta 1,55–1,85 · volta 1,7–2,2 · fim 2,9
  corvos: semente => {
    const r = rng(semente), LONGE = PULA.corvos[1];
    const bando = Array.from({ length: 12 }, () => ({
      sx: (r() - 0.5) * 16, sy: -2 - r() * 17, cx: LONGE * (0.25 + r() * 0.5), cy: -30 - r() * 26,
      ex: LONGE + (r() - 0.5) * 24, ey: -6 - r() * 18, atraso: r() * 0.15, fase: Math.floor(r() * 4),
    }));
    const penas = Array.from({ length: 5 }, () => ({ x: (r() - 0.5) * 16, y: -6 - r() * 14, f: r() * 6 }));
    return {
      dur: 2.9, espaco: { frente: 70, tras: 20 },
      quadro(g, t, m) {
        if (t < 0.48) A.clawdAkatsuki(g, { T: m.T, tinta: { cor: A.COR.corvo, a: 0.85 * fatia(t, 0.2, 0.46) }, sy: 1 + 0.05 * fatia(t, 0.3, 0.46) });
        if (t >= 1.7) A.clawdAkatsuki(g, { T: m.T, x: LONGE, alfa: fatia(t, 1.7, 1.86), tinta: { cor: A.COR.corvo, a: 0.85 * (1 - fatia(t, 1.86, 2.2)) } });
        for (const p of penas) {
          const d = t - 0.48;
          if (d < 0 || d > 1.5) continue;
          g.save(); g.globalAlpha *= 1 - fatia(d, 1.1, 1.5);
          A.pena(g, p.x + 3 * d, Math.min(-1.5, p.y + 10 * d), t, p.f);
          g.restore();
        }
        for (const c of bando) {
          const t0 = 0.45 + c.atraso, j = fatia(t, 1.55, 1.85);
          if (t < t0 || j >= 1) continue;
          const u = sai(fatia(t, t0, 1.55)), v = 1 - u;
          let x = v * v * c.sx + 2 * v * u * c.cx + u * u * c.ex, y = v * v * c.sy + 2 * v * u * c.cy + u * u * c.ey;
          x += (LONGE - x) * entra(j); y += (-11 - y) * entra(j);
          A.corvo(g, x, y, (Math.floor(t * 12) + c.fase) % 2 === 0, A.P * (1 - 0.4 * j), 1 - fatia(j, 0.5, 1));
        }
      },
    };
  },
  // um inimigo chega e pula nele; no puf, quem leva a pancada é um tronco, e ele já está lá atrás
  // do inimigo, virado, e joga a kunai; o inimigo cai, o tronco vira fumaça e ele se vira e segue.
  // Bug chega 0–1,0 · pula 1,0–1,25 · troca 1,12 · tonto 1,25–1,75 · joga 1,45–1,55 · voa 1,55–1,75
  // · cai 1,75–2,05 · tronco some 2,4 · vira 2,95 · fim 3,6
  tronco: semente => {
    const LONGE = PULA.tronco[1], TROCA = 1.12, GOLPE = MORTE.tronco, TW = 11 * A.P, TH = 12 * A.P;
    const ALVO = [15, -6], ini = INI.sortear(semente, 'akatsuki');
    return {
      dur: 3.6, espaco: { frente: 95, tras: 20 },
      quadro(g, t, m) {
        if (t >= TROCA && t < 2.45) {
          const tre = t >= 1.25 && t < 1.45 ? Math.sin(t * 80) * 0.7 : 0;  // a pancada
          g.drawImage(A.tronco(), -TW / 2 + tre, -TH, TW, TH);
        }
        if (t < TROCA) A.clawdAkatsuki(g, { T: m.T, selo: t >= 0.8 ? A.seloEm(t) : null });
        else {
          const joga = fatia(t, 1.45, 1.55);
          A.clawdAkatsuki(g, {
            T: m.T, x: LONGE, sx: t >= 2.95 ? 1 : -1, sy: t < 1.45 ? 0.94 : 1,
            mao: t >= 1.3 && t < 1.75 && function (k, dy) { A.maoNa(k, 4 + 6 * joga, -15 + 4 * joga + dy); },
          });
        }
        A.puf(g, 0, -9, fatia(t, TROCA - 0.05, TROCA + 0.45), semente);
        A.puf(g, LONGE, -9, fatia(t, TROCA, TROCA + 0.4), semente + 5, 0.8);
        A.puf(g, 0, -8, fatia(t, 2.38, 2.85), semente + 3);
        // o inimigo: anda, pula no tronco, quica pra trás, leva a kunai e amassa
        if (t < 2.1) {
          let x, y = 0;
          if (t < 1.0) x = 85 - 63 * fatia(t, 0, 1.0);
          else if (t < 1.25) { const u = fatia(t, 1.0, 1.25); x = 22 - 13 * u; y = -7 * Math.sin(Math.PI * u); }
          else if (t < 1.45) { const u = fatia(t, 1.25, 1.45); x = 9 + 6 * sai(u); y = -3 * Math.sin(Math.PI * u); }
          else x = ALVO[0] + (t < GOLPE ? Math.sin(t * 9) * 0.6 : 0);
          const amassa = fatia(t, GOLPE, 2.05);
          INI.inimigo(g, ini, x, y, { passo: t < 1.0 && Math.floor(t / 0.12) % 2 ? 'q' : 'p', a: t >= GOLPE ? 1 - 0.5 * amassa : 0, sy: 1 - 0.65 * amassa, sx: 1 + 0.2 * amassa, t });
        }
        A.puf(g, ALVO[0], -3, fatia(t, 2.02, 2.4), semente + 9, 0.55, 5);
        // a kunai: sai da mão, crava no inimigo e cai com ele
        if (t >= 1.55 && t < 2.3) {
          const u = fatia(t, 1.55, GOLPE), d = Math.max(0, t - GOLPE);
          const x = LONGE - 10 + (ALVO[0] + 6 - (LONGE - 10)) * u, y = -12 + (ALVO[1] + 12) * u + Math.min(4.5, 40 * d * d);
          g.save(); g.globalAlpha *= 1 - fatia(t, 2.1, 2.3);
          A.kunai(g, x, y, Math.PI + (d > 0 ? Math.min(0.6, d * 3) : 0), 1);
          g.restore();
        }
      },
    };
  },
  // um inimigo chega; ele faz selos, puxa o ar com a mão na boca e sopra uma bola de fogo que
  // acerta o inimigo: labaredas, ele fica preto e vira cinza.
  // Bug chega 0–1,0 · selos 0,3–1,05 · puxa 1,05–1,3 · bola 1,3–1,85 · batida 1,85 · cinza 2,25 · fim 3,4
  fogo: semente => {
    const X = 52, BATE = MORTE.fogo, ini = INI.sortear(semente, 'akatsuki');
    return {
      dur: 3.4, espaco: { frente: 75, tras: 15 },
      quadro(g, t, m) {
        const puxa = fatia(t, 1.05, 1.3), sopra = fatia(t, 1.3, 1.42), volta = fatia(t, 1.9, 2.3);
        A.clawdAkatsuki(g, {
          T: m.T, x: -1.2 * puxa * (1 - sopra) + 1.5 * sopra * (1 - volta), sy: 1 + 0.06 * puxa * (1 - sopra),
          selo: t >= 0.3 && t < 1.05 ? A.seloEm(t) : null,
          mao: t >= 1.05 && t < 1.9 && function (k, dy) { A.maoNa(k, 9, -12.5 + dy); },
        });
        const morto = t >= BATE;
        if (t < 2.4) {
          const x = t < 1.0 ? X + 38 * (1 - fatia(t, 0, 1.0)) : X;
          INI.inimigo(g, ini, x + (morto ? Math.sin(t * 70) * 0.8 : 0), 0, {
            passo: t < 1.0 && Math.floor(t / 0.12) % 2 ? 'q' : 'p', cor: morto ? '#57534E' : null, alfa: 1 - fatia(t, 2.2, 2.4), t,
          });
        }
        A.cinzas(g, X, 0, t - 2.25, semente, 14, ini.w, ini.h);
        if (t >= 1.3 && t < BATE) {
          const u = fatia(t, 1.3, BATE);
          A.bolaDeFogo(g, 14 + (X - 4 - 14) * u, -12 + 4 * u, 2.5 + 3 * sai(u), t);
        }
        if (t >= BATE && t < BATE + 0.45) {  // o clarão da batida
          const a = 1 - fatia(t, BATE, BATE + 0.45);
          g.save(); g.globalCompositeOperation = 'lighter';
          const gr = g.createRadialGradient(X, -6, 1, X, -6, 20);
          gr.addColorStop(0, rgba('#FDE047', 0.8 * a)); gr.addColorStop(0.5, rgba('#F97316', 0.45 * a)); gr.addColorStop(1, rgba('#DC2626', 0));
          g.fillStyle = gr; g.fillRect(X - 20, -26, 40, 40); g.restore();
        }
        A.labaredas(g, X, 0, t - BATE, semente);
      },
    };
  },
};

Object.assign(FABRICAS, T7.FABRICAS);

// ---------- os dois lados: a roupa da vez e a virada (a cada 50 voltas) ----------
// A conta de voltas decide o lado (alterna a cada 50) e a roupa dele (a próxima das 3, cada vez que
// ele volta pra esse lado). O que está na tela é a roupa salva; a virada troca no puf.
function roupaAlvo(m) {
  const ciclo = Math.floor((m.salvo.akaVoltas || 0) / VOLTAS), lista = A.ROUPAS.LADOS[ciclo % 2 ? 'time7' : 'akatsuki'];
  return lista[Math.floor(ciclo / 2) % lista.length];
}
function roupaDe(m) {
  const c = m.cena;
  if (c && c.nome === 'virada') return m.T - c.t0 >= VIRA.troca ? c.para : c.de;
  return A.ROUPAS.ROUPAS[m.salvo.akaRoupa] ? m.salvo.akaRoupa : A.ROUPA;
}
const ladoDe = m => A.ladoDaRoupa(roupaDe(m));

// A virada: ele faz selos e escurece (ou clareia) enquanto um redemoinho do lado novo (corvos pra
// Akatsuki, folhas pro Time 7) aperta em volta dele; um puf, e quando a fumaça abre ele está com a
// roupa nova: dá um pulinho e, na Akatsuki, os olhos acendem vermelhos; no Time 7, ergue o punho.
// Selos 0,2–1,3 · redemoinho 0,2–1,65 · puf 1,45–2,1 · troca 1,6 · pulinho 2,3–2,6 · pose 2,6–3,2 · fim 3,6
const VIRA = { dur: 3.6, troca: 1.6 };
function cenaVirada(m, para) {
  const de = roupaDe(m), novo = A.ladoDaRoupa(para), sem = Math.floor(m.sorteio() * 4294967296), r = rng(sem);
  const bando = Array.from({ length: 14 }, () => ({
    fase: r() * Math.PI * 2, raio: 9 + r() * 7, atraso: r() * 0.35, alt: -3 - r() * 17, cor: T7.FOLHAS[Math.floor(r() * T7.FOLHAS.length)],
  }));
  return {
    nome: 'virada', de, para, dur: VIRA.dur, espaco: { frente: 25, tras: 25 },
    quadro(g, t, mm) {
      A.vestir(t >= VIRA.troca ? para : de);
      const antes = t < VIRA.troca, pulo = t >= 2.3 && t < 2.6 ? -6 * Math.sin(Math.PI * fatia(t, 2.3, 2.6)) : 0;
      const tinta = antes ? { cor: novo === 'time7' ? '#FED7AA' : A.COR.corvo, a: 0.7 * fatia(t, 0.3, 1.5) } : null;
      const punho = !antes && novo === 'time7' && t >= 2.6 && t < 3.2;
      A.clawdAkatsuki(g, {
        T: mm.T, y: pulo, tinta, selo: t >= 0.2 && t < 1.3 ? A.seloEm(t) : null,
        mao: punho && function (k, dy) { A.punhoErguido(k, dy, A.ROUPAS.ROUPAS[para].linhas.length); },
      });
      if (!antes && novo === 'akatsuki' && t >= 2.6 && t < 3.3) A.olhosAcesos(g, para, Math.sin(Math.PI * fatia(t, 2.6, 3.3)));
      // o redemoinho do lado novo, apertando e subindo
      for (const b of bando) {
        const u = fatia(t, 0.2 + b.atraso, 1.65);
        if (u <= 0 || u >= 1) continue;
        const a = b.fase + u * 11, rr = b.raio * (1 - 0.55 * u), x = Math.cos(a) * rr, y = b.alt * (1 - 0.3 * u) + Math.sin(a) * 2.5;
        if (novo === 'time7') T7.folhinha(g, x, y, a, b.cor);
        else A.corvo(g, x, y, Math.floor(t * 12 + b.fase) % 2 === 0, 1, 1);
      }
      A.puf(g, 0, -10, fatia(t, 1.45, 2.1), sem, 1.5, 8);
    },
  };
}

// ---------- acabou tudo: a lua vermelha ----------
// A lua sobe de trás da borda de cima do cartão, uma revoada de corvos cruza na frente dela da
// direita pra esquerda, e ela se apaga. O Clawd faz selos e dá um pulinho quando os corvos passam.
// No Time 7 a lua é clara e quem cruza é um rio de folhas.
// Janela inteira: desenha em DIPs. Sem trilha: o aviso 'tudo' já toca.
// Sobe 0–1,2 · corvos 1,0–4,0 · apaga 4,2–5,0
const LUA = { dur: 5.0, raio: 15, alto: 50 };
const LUAS = {
  akatsuki: { brilho: '#DC2626', borda: '#991B1B', cheia: '#DC2626', cratera: '#B91C1C' },
  time7: { brilho: '#FDE68A', borda: '#D6C68A', cheia: '#FEF3C7', cratera: '#EADDAF' },
};
function desenhaLua(g, c, t, bando, lado) {
  const L = LUAS[lado] || LUAS.akatsuki;
  const [x, y, w] = c, R = LUA.raio, cx = x + w * 0.7, cy = y + R + 3 - (LUA.alto + R + 3) * sai(fatia(t, 0, 1.2));
  const some = 1 - fatia(t, 4.2, 5.0);
  if (some <= 0) return;
  g.save(); g.globalAlpha *= some;
  g.beginPath(); g.rect(x - 60, y - 200, w + 120, 198); g.clip();  // nasce atrás da borda
  g.save(); g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(cx, cy, R * 0.6, cx, cy, R * 2.6);
  gr.addColorStop(0, rgba(L.brilho, 0.45)); gr.addColorStop(1, rgba(L.brilho, 0));
  g.fillStyle = gr; g.fillRect(cx - R * 2.6, cy - R * 2.6, R * 5.2, R * 5.2);
  g.restore();
  g.fillStyle = L.borda; g.beginPath(); g.arc(cx, cy, R, 0, Math.PI * 2); g.fill();
  g.fillStyle = L.cheia; g.beginPath(); g.arc(cx - 1, cy - 1, R - 1.5, 0, Math.PI * 2); g.fill();
  g.fillStyle = L.cratera;
  for (const [dx, dy, r] of [[-5, -4, 3], [4, 3, 4], [5, -6, 2], [-4, 6, 2]]) { g.beginPath(); g.arc(cx + dx, cy + dy, r, 0, Math.PI * 2); g.fill(); }
  g.restore();
  for (const b of bando) {
    const u = fatia(t, 1.0 + b.atraso, 1.0 + b.atraso + b.dur);
    if (u <= 0 || u >= 1) continue;
    const bx = x + w + 30 - (w + 90) * u, by = y - LUA.alto + b.dy + Math.sin(u * 9 + b.fase) * 2;
    if (lado === 'time7') {
      g.save(); g.globalAlpha *= some;
      for (let i = 0; i < 3; i++) T7.folhinha(g, bx + i * 5, by + Math.sin(t * 6 + i + b.fase) * 2, t * 5 + i + b.fase, T7.FOLHAS[(b.fase + i) % T7.FOLHAS.length]);
      g.restore();
    } else A.corvo(g, bx, by, (Math.floor(t * 9) + b.fase) % 2 === 0, A.P, some);
  }
}
function cenaLua(m) {
  const r = rng(Math.floor(m.sorteio() * 4294967296));
  const bando = Array.from({ length: 9 }, () => ({ atraso: r() * 1.2, dy: (r() - 0.5) * 34, dur: 1.6 + r() * 0.6, fase: Math.floor(r() * 4) }));
  return {
    nome: 'lua', dur: LUA.dur, espaco: { frente: 0, tras: 0 }, modos: ['andando', 'parado', 'pulando'],
    quadro(g, t, mm) {
      const e = mm.host.escala || 1;
      g.save(); g.setTransform(e, 0, 0, e, 0, 0); desenhaLua(g, mm.host.cartao, t, bando, ladoDe(mm)); g.restore();
      const pulo = t >= 1.6 && t < 1.9 ? -5 * Math.sin(Math.PI * fatia(t, 1.6, 1.9)) : 0;
      A.clawdAkatsuki(g, { T: mm.T, y: pulo, selo: t >= 0.2 && t < 0.9 ? A.seloEm(t) : null });
    },
  };
}

// os épicos (um de cada lado) moram em akatsuki-epico.js e akatsuki-epico-time7.js, que podem não
// existir: carrega na 1ª vez que precisa
const EPICOS = { akatsuki: 'akatsuki-epico', time7: 'akatsuki-epico-time7' };
const epicoModulo = { akatsuki: undefined, time7: undefined };
let epicoErro = null;
function epico(lado) {
  const arq = EPICOS[lado];
  if (epicoModulo[lado] === undefined) {
    try { epicoModulo[lado] = require('./' + arq); } catch (e) {
      epicoModulo[lado] = null;
      if (!(e.code === 'MODULE_NOT_FOUND' && String(e.message).split('\n')[0].includes(arq))) epicoErro = `${arq}.js com defeito: ${e.message}`;
    }
  }
  const mod = epicoModulo[lado];
  return mod && typeof mod.cena === 'function' ? mod : null;
}
function cenaDoEpico(m) {
  const mod = epico(ladoDe(m));
  const c = mod && !m.ruins.has('epico') ? mod.cena(m) : null;
  return c ? { ...c, nome: 'epico', epico: true } : null;
}

function cenaPorNome(m, nome) {
  if (P.ids.includes(nome)) return P.cena(m, nome);
  if (nome === 'lua') return cenaLua(m);
  if (nome === 'epico') return cenaDoEpico(m);
  if (nome === 'virada') {  // pra onde a conta manda; se ela não manda trocar, pro outro lado
    const alvo = roupaAlvo(m), outro = A.ROUPAS.LADOS[ladoDe(m) === 'time7' ? 'akatsuki' : 'time7'][0];
    return cenaVirada(m, alvo !== roupaDe(m) ? alvo : outro);
  }
  const fazer = FABRICAS[nome];
  return fazer ? { nome, ...fazer(Math.floor(m.sorteio() * 4294967296)) } : null;
}

// o motor está a 32 quadros/s: pulando, em cena ou com alguém trabalhando
function emMovimento(m) {
  return m.modo === 'pulando' || !!m.cena || (m.host.linhas || []).some(l => l.sit === 'working') || ladoDe(m) === 'akatsuki';  // as nuvens da Akatsuki giram sempre (a 5 quadros/s dariam tiquinhos); o Time 7 só com tarefa
}

module.exports = {
  layout: {
    raio: 8, fundo: '#EE121212', moldura: [2, 2, 2, 2], padding: [10, 6, 10, 6], enfeites: true,
    colunas: { tempo: 36, pct: 38, falta: 48, rotulo: 18 }, letra: 11, barra: [118, 5],
  },
  texturas: P.texturas,
  trilha: { raio: 8 },
  cenas: [...SORTEADAS.akatsuki, ...SORTEADAS.time7, ...P.ids, 'lua', 'virada'],
  cenaPorNome,

  iniciar(m) {
    if (!A.ROUPAS.ROUPAS[m.salvo.akaRoupa]) m.salvo.akaRoupa = roupaAlvo(m);
  },
  passo(m) { P.passo(m); },
  // a cada volta inteira andada: conta (a 50ª troca de lado na parada seguinte)
  aoDarVolta(m) { m.salvo.akaVoltas = (m.salvo.akaVoltas || 0) + 1; m.salvar(); },
  naParada(m) {
    // trocou de lado: a virada vem antes de tudo (quebrada: troca sem cena)
    const alvo = roupaAlvo(m);
    if (alvo !== m.salvo.akaRoupa) {
      if (!m.ruins.has('virada')) return cenaVirada(m, alvo);
      m.salvo.akaRoupa = alvo; m.salvar();
    }
    // o épico, sem o cara-ou-coroa, só na reta de cima (a cena conta com o Clawd ali)
    if (m.salvo.akaEpico) {
      const c = cenaDoEpico(m);
      if (epicoErro && m.aoErro) { m.aoErro(epicoErro); epicoErro = null; }
      if (c) {
        const p = m.pose();
        return p.reta && Math.cos(p.a) > 0.99 ? c : undefined;
      }
      m.salvo.akaEpico = false; m.salvar();
    }
    const boas = SORTEADAS[ladoDe(m)].filter(n => !m.ruins.has(n));
    if (!boas.length || !m.chance(CHANCE)) return null;
    return cenaPorNome(m, boas[Math.floor(m.sorteio() * boas.length)]);
  },
  aoComecarCena(m, cena) {
    P.aoComecarCena(m, cena);
    if (cena.epico) { m.salvo.akaEpico = false; m.salvar(); }
  },
  aoFimCena(m, cena, cortada) {
    P.aoFimCena(m, cena, cortada);
    if (!cena) return;
    const dt = m.T - cena.t0;
    // épico cortado (pergunta, permissão, tudo pronto) não gasta a vez; quebrado não volta
    if (cena.epico && cortada && !m.ruins.has(cena.nome)) { m.salvo.akaEpico = true; m.salvar(); }
    // a virada vale do puf em diante; cortada antes dele, tenta de novo na próxima parada
    if (cena.nome === 'virada' && dt >= VIRA.troca) { m.salvo.akaRoupa = cena.para; m.salvar(); }
    // as cenas que terminam lá na frente: o Clawd segue de onde está (quebrada: fica onde estava)
    const pula = PULA[cena.nome];
    if (pula && m.andando && dt >= pula[0] && !m.ruins.has(cena.nome)) m.dist += pula[1];
    // bug derrubado (cortada antes do golpe não conta); o 30º pede o épico
    if (MORTE[cena.nome] != null && dt >= MORTE[cena.nome]) {
      const antes = m.salvo.akaBugs || 0;
      m.salvo.akaBugs = antes + 1;
      if (Math.floor(m.salvo.akaBugs / BUGS) > Math.floor(antes / BUGS)) m.salvo.akaEpico = true;
      m.salvar();
    }
  },
  bloqueia: P.bloqueia,
  // acabou tudo: a lua passa na frente de qualquer cena, menos do épico (o aviso toca por cima)
  aoEvento(m, tipo) {
    if (tipo !== 'tudo' || !m.host.clawd || m.modo === 'oculto') return;
    if (m.cena && (m.cena.nome === 'lua' || m.cena.epico)) return;
    if (m.cena) m.fimCena(true);
    m.comecarCena(cenaLua(m));
  },

  // -- desenho --
  fundo(g, m) {  // a moldura e os enfeites, nas caixas que a janelinha mandou
    A.vestir(roupaDe(m));  // o 1º desenho do quadro: daqui pra frente, tudo com a roupa (e o lado) da vez
    const h = m.host, e = h.escala || 1, t = m.T;
    const fase = K.andar(t, emMovimento(m));  // a moldura e o redemoinho só andam com o motor a 32 quadros/s
    if (h.cartao) K.moldura(g, h.cartao, fase);
    for (const l of h.linhas || []) {
      if (l.bola) K.bolinha(g, l, t);
      if (l.tempo) K.escrever(g, e, l.tempo.txt, l.tempo.cor, l.tempo.caixa, true);
    }
    for (const u of h.uso || []) {
      const nivel = K.nivelDe(u);
      if (u.rotulo) K.escrever(g, e, u.rotulo.txt, COR.rotulo, u.rotulo.caixa, false);
      if (u.barra) K.barra(g, u.barra, u.pct, nivel, fase);
      if (u.pctTxt) K.escrever(g, e, u.pctTxt.txt, K.corDoPct(nivel), u.pctTxt.caixa, true);
      if (u.falta) K.escrever(g, e, u.falta.txt, COR.falta, u.falta.caixa, true);
    }
  },
  clawd(g, m) {
    A.vestir(roupaDe(m));
    if (P.clawd(g, m)) return;  // a saída da cena de parado
    const t = m.T, modo = m.andando ? 'andando' : m.host.modo;
    if (modo === 'andando') A.clawdAkatsuki(g, A.andando(t));
    else if (modo === 'pulando') A.clawdAkatsuki(g, A.pulando(t));
    else A.clawdAkatsuki(g, { T: t, pernas: 'ambas' });
  },
  // a moldura (as nuvens) e o redemoinho da barra só andam com a janelinha mexendo: alguém trabalhando ou
  // uma cena. Parado o motor desenha a 5 quadros/s, e o que andasse daria saltos (os "tickzinhos de lag")
  animado: emMovimento,
  bugsPorEpico: BUGS,
  voltasPorLado: VOLTAS,
  pula: PULA,
  sorteadas: SORTEADAS,
  roupaDe,
  ladoDe,
  roupaAlvo,
  // pros testes: troca o épico de um lado, ou dos dois (null = não existe; undefined = o de verdade)
  trocarEpico(mod, lado) {
    for (const l of lado ? [lado] : Object.keys(epicoModulo)) epicoModulo[l] = mod;
    epicoErro = null;
  },
};
