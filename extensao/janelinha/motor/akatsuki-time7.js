'use strict';
// Tema Akatsuki, lado Time 7 (dono, 13/10: "trocar os 4"): as 4 cenas da caminhada desse lado.
// Desenho nosso (os nomes do anime podem aparecer: dono, 13/10): o Gamabunta, de cuja cabeça ele
// lança o Rasenshuriken no bug; o Rasengan (a esfera azul girando na mão, um clone ajuda a formar)
// que manda o bug rodopiando pro céu; o Chidori (a mão de raios que atravessa o bug, ele cai
// depois); e o redemoinho de folhas que leva o Clawd pra mais à frente. Cada uma:
// semente => { dur, espaco, quadro(g, t, m) }, no referencial do Clawd (como as do tema-akatsuki.js).
const { rng, rgba } = require('./comum');
const A = require('./akatsuki-arte');
const S = require('./akatsuki-sapo');
const INI = require('./akatsuki-inimigos');

const { fatia, sai, entra } = A;
// s: quando o inimigo da cena cai · [a partir de quando ele já está lá na frente (s), quanto (px)]
const MORTE = { sapo: 2.58, esfera: 1.65, raio: 1.9 };
const PULA = { sapo: [2.75, 44], esfera: [1.65, 46], raio: [1.42, 80], folhas: [1.45, 52] };
const FOLHAS = ['#22C55E', '#16A34A', '#86EFAC', '#4ADE80'];

// uma folhinha (2,5 x 1,5 px, girando), a cor de FOLHAS
function folhinha(g, x, y, ang, cor) {
  g.save(); g.translate(x, y); g.rotate(ang);
  g.fillStyle = '#14532D'; g.fillRect(-1.75, -1, 3.5, 2);
  g.fillStyle = cor; g.fillRect(-1.25, -0.5, 2.5, 1);
  g.restore();
}

// o inimigo (sorteado: o bug, o Zetsu Branco, o ninja renegado ou a marionete; dono, 14/10)
// andando da direita até parar em x1 (de 0 a 'chega' s), virado pro Clawd
function inimigoChegando(g, ini, t, x0, x1, chega, extra = {}) {
  const x = t < chega ? x0 + (x1 - x0) * fatia(t, 0, chega) : x1;
  INI.inimigo(g, ini, x, 0, { passo: t < chega && Math.floor(t / 0.12) % 2 ? 'q' : 'p', t, ...extra });
  return x;
}

const FABRICAS = {
  // selos, a mão no chão, um puf grande: o Gamabunta aparece com ele em cima da cabeça. Um bug chega;
  // ele ergue a mão e forma o Rasenshuriken (a esfera azul, o disco e as quatro lâminas brancas
  // girando, o vento zunindo). O sapo agacha e salta; lá do alto ele lança o Rasenshuriken, que voa
  // deixando rastro e estoura no bug numa esfera de vento cheia de laminazinhas: o bug treme,
  // encolhe e some. O sapo cai, coaxa e some num puf; o Clawd desce lá na frente e segue.
  // Selos 0–0,55 · mão 0,55 · puf 0,7 · sobe 0,75–0,95 · bug 0,3–1,4 · forma 1,0–1,9 · agacha 1,9–2,1
  // · salta 2,1–2,75 · lança 2,38 · estoura 2,58 · vento 2,58–3,45 · cai 2,75 · coaxa 3,1–3,5 · puf 3,55
  // · some 3,75 · desce 3,75–4,0 · fim 4,5
  sapo: semente => {
    const K = 1, ANDA = 14, ALTO = 20, SALTA = 2.1, CAI = PULA.sapo[0], LANCA = 2.38, ESTOURA = MORTE.sapo, BX = 58;
    const LONGE = PULA.sapo[1], ALVO = [BX, -8], ini = INI.sortear(semente, 'time7');
    const sapoEm = t => {
      let cx = 0, y = 0, sx = 1, sy = 1;
      if (t < SALTA) { const a = sai(fatia(t, 1.9, SALTA)); sy = 1 - 0.15 * a; sx = 1 + 0.06 * a; }
      else if (t < CAI) { const u = fatia(t, SALTA, CAI); cx = ANDA * u; y = -ALTO * 4 * u * (1 - u); sy = 1 + 0.1 * (1 - u); }
      else { cx = ANDA; const q = fatia(t, CAI, CAI + 0.25); if (q < 1) sy = 1 - 0.18 * Math.sin(Math.PI * q); }
      return { cx, y, sx, sy, pisca: t >= 1.3 && t < 1.4, papo: fatia(t, 3.1, 3.5), fumo: t };
    };
    // o Rasenshuriken na mão erguida (em cima da cabeça dele), no referencial da cena
    const naMao = (hx, hy) => [hx + 4, hy - 29];
    return {
      dur: 4.5, espaco: { frente: 105, tras: 30 },
      quadro(g, t, m) {
        // o inimigo: chega, leva o Rasenshuriken (vermelho, tremendo), encolhe e some no vento
        if (t < 2.95) {
          const pega = t >= ESTOURA, some = fatia(t, 2.7, 2.95);
          g.save(); g.globalAlpha *= 1 - some;
          if (pega) { g.translate(BX + Math.sin(t * 90) * 1.2, 0); g.scale(1 - 0.5 * some, 1 - 0.5 * some); g.translate(-BX, 0); }
          inimigoChegando(g, ini, Math.max(0, t - 0.3), 95, BX, 1.1, pega ? { a: 1 } : {});
          g.restore();
        }
        const s = sapoEm(t), visivel = t >= 0.8 && t < 3.75;
        if (visivel) S.desenhar(g, s.cx, s.y, K, s);
        if (t >= CAI) {  // a poeira do tombo
          const u = fatia(t, CAI, CAI + 0.5);
          A.puf(g, ANDA - 26, -2, u, semente + 5, 0.6, 5); A.puf(g, ANDA + 26, -2, u, semente + 6, 0.6, 5);
        }
        // o Clawd: selos, a mão no chão, sobe na cabeça do sapo (dentro do puf), ergue a mão (o
        // Rasenshuriken), lança lá do alto e desce lá na frente
        const [hx, hy] = S.ponto(s.cx, s.y, K, S.CABECA, s.sx, s.sy);
        const ergue = t >= 1.0 && t < LANCA + 0.12;
        let c;
        if (t < 0.75) c = { x: 0, y: 0, sy: t >= 0.55 ? 0.9 : 1, selo: t < 0.55 ? A.seloEm(t) : null, mao: t >= 0.55 ? [8, -1.5] : null };
        else if (t < 0.95) { const u = sai(fatia(t, 0.75, 0.95)); c = { x: hx * u, y: hy * u - 6 * Math.sin(Math.PI * u) }; }
        else if (t < 3.75) c = { x: hx, y: hy, sy: t >= 1.9 && t < 2.2 ? 0.92 : 1, selo: t >= 3.1 && t < 3.5 ? 3 : null, mao: ergue ? [3.25, -19.5] : null };
        else if (t < 4.0) { const u = fatia(t, 3.75, 4.0); c = { x: hx + (LONGE - hx) * u, y: hy * (1 - u * u) - 5 * Math.sin(Math.PI * u) }; }
        else { const q = fatia(t, 4.0, 4.12); c = { x: LONGE, y: 0, sy: q < 1 ? 1 - 0.1 * Math.sin(Math.PI * q) : 1 }; }
        A.clawdAkatsuki(g, {
          T: m.T, x: c.x, y: c.y, sy: c.sy, selo: c.selo,
          mao: c.mao && function (k, dy) { A.maoNa(k, c.mao[0], c.mao[1] + dy); },
        });
        // o Rasenshuriken: forma na mão, voa até o bug com rastro, estoura numa esfera de vento
        if (t >= 1.0 && t < LANCA) {
          const [rx, ry] = naMao(hx, hy), f = sai(fatia(t, 1.0, 1.45));
          rasenshuriken(g, c.x + (rx - hx), c.y + (ry - hy), 4.5 * f, sai(fatia(t, 1.3, 1.9)), t, 1 - fatia(t, 1.8, 2.0));
        } else if (t >= LANCA && t < ESTOURA) {
          const l = sapoEm(LANCA), [lx, ly] = S.ponto(l.cx, l.y, K, S.CABECA, l.sx, l.sy), [x0, y0] = naMao(lx, ly);
          const em = u => [x0 + (ALVO[0] - x0) * entra(u), y0 + (ALVO[1] - y0) * entra(u) - 8 * Math.sin(Math.PI * u)];
          const u = fatia(t, LANCA, ESTOURA);
          for (let i = 4; i >= 1; i--) {  // o rastro
            const [px, py] = em(Math.max(0, u - i * 0.07));
            g.fillStyle = rgba('#BAE6FD', 0.45 * (1 - i / 5)); g.beginPath(); g.arc(px, py, 5 - i * 0.7, 0, Math.PI * 2); g.fill();
          }
          const [px, py] = em(u);
          rasenshuriken(g, px, py, 4.5, 1, t, 0);
        }
        if (t >= ESTOURA && t < 3.45) vento(g, ALVO[0], ALVO[1], fatia(t, ESTOURA, 3.45), t, semente);
        // os puf: o da invocação (ele dentro) e o da despedida
        A.puf(g, 0, -15, fatia(t, 0.7, 1.3), semente, 2.4, 9);
        A.puf(g, ANDA, -15, fatia(t, 3.55, 4.2), semente + 1, 2.4, 9);
      },
    };
  },
  // um bug chega; ele faz um selo e um clone sai da fumaça na frente dele, virado pra ele: os dois
  // formam uma esfera azul girando na mão dele. O clone some, ele dispara com a esfera na frente e
  // acerta o bug, que sai rodopiando pro céu e vira uma estrelinha.
  // Bug 0–1,0 · selo 0,15–0,5 · clone 0,5–1,3 · esfera 0,7–1,25 · corre 1,4–1,65 · acerta 1,65 ·
  // voa 1,65–2,45 · brilha 2,45–2,75 · fim 3,1
  esfera: semente => {
    const LONGE = PULA.esfera[1], BATE = MORTE.esfera, BX = 58, FIM = [96, -46], ini = INI.sortear(semente, 'time7');
    return {
      dur: 3.1, espaco: { frente: 105, tras: 20 },
      quadro(g, t, m) {
        const corre = sai(fatia(t, 1.4, BATE)), x = LONGE * corre, correndo = t >= 1.4 && t < BATE;
        if (correndo) A.rastro(g, x, t, '#BFDBFE');
        // o inimigo: chega, leva a esfera e sai rodopiando (em volta do meio dele)
        if (t < BATE) inimigoChegando(g, ini, t, 92, BX, 1.0);
        else if (t < 2.45) {
          const u = fatia(t, BATE, 2.45), bx = BX + (FIM[0] - BX) * sai(u), by = FIM[1] * Math.sin(Math.PI / 2 * u);
          g.save(); g.translate(bx, by - ini.h / 2); g.rotate(u * 14); g.scale(1 - 0.6 * u, 1 - 0.6 * u);
          INI.inimigo(g, ini, 0, ini.h / 2, { a: 1 - u, t });
          g.restore();
        }
        if (t >= 2.45 && t < 2.75) {  // a estrelinha
          const u = fatia(t, 2.45, 2.75), r = 1 + 3 * Math.sin(Math.PI * u);
          g.fillStyle = rgba('#FFFFFF', 1 - u * 0.5);
          g.fillRect(FIM[0] - r, FIM[1] - 6.5, 2 * r + 1, 1); g.fillRect(FIM[0] - 0.5 + 0.5, FIM[1] - 6 - r, 1, 2 * r);
        }
        // o clone: na frente, virado pra ele (espelhado: a esfera fica em x = cloneX - 13,5 no
        // referencial dele), as mãos girando em volta dela
        const cloneX = 27;
        if (t >= 0.55 && t < 1.36) {
          A.clawdAkatsuki(g, {
            T: m.T + 0.37, x: cloneX, sx: -1,
            mao: t >= 0.7 && function (k, dy) {
              for (const f of [0, Math.PI]) { const a = t * 12 + f; A.maoNa(k, cloneX - 13.5 + Math.cos(a) * 5 - 0.75, -10 + Math.sin(a) * 4.5 - 0.75 + dy); }
            },
          });
        }
        A.clawdAkatsuki(g, {
          T: m.T, x, pernas: correndo ? (Math.floor(t / 0.06) % 2 ? 'A' : 'B') : 'ambas',
          selo: t >= 0.15 && t < 0.5 ? 1 : null,
          mao: t >= 0.6 && t < 1.95 && function (k, dy) { A.maoNa(k, 9, -10.75 + dy); },
        });
        A.puf(g, cloneX, -9, fatia(t, 0.5, 0.9), semente);
        A.puf(g, cloneX, -9, fatia(t, 1.3, 1.7), semente + 1);
        // a esfera: cresce na mão, vai na frente dele na corrida, estoura no bug
        if (t >= 0.7 && t < BATE + 0.05) esfera(g, x + 13.5, -10, 1 + 4 * sai(fatia(t, 0.7, 1.25)), t);
        if (t >= BATE && t < BATE + 0.4) {  // o estouro
          const u = fatia(t, BATE, BATE + 0.4);
          g.save(); g.globalCompositeOperation = 'lighter';
          const gr = g.createRadialGradient(BX, -8, 1, BX, -8, 22);
          gr.addColorStop(0, rgba('#EFF6FF', 0.9 * (1 - u))); gr.addColorStop(0.5, rgba('#60A5FA', 0.5 * (1 - u))); gr.addColorStop(1, rgba('#3B82F6', 0));
          g.fillStyle = gr; g.fillRect(BX - 22, -30, 44, 44);
          g.restore();
          g.strokeStyle = rgba('#BFDBFE', 1 - u); g.lineWidth = 1;
          g.beginPath(); g.ellipse(BX, -8, 4 + 14 * u, 3 + 9 * u, 0, 0, Math.PI * 2); g.stroke();
        }
      },
    };
  },
  // um bug chega; ele agacha com a mão pra baixo e ela enche de raios (estalando). Dispara: passa
  // pelo bug num risco de luz e para lá atrás, de costas. Um instante depois o bug solta faísca,
  // fica cinza e desmonta numa fumacinha.
  // Bug 0–1,0 · carrega 0,25–1,25 · dispara 1,25–1,42 · lá 1,42 · raios somem 1,42–1,7 · bug cai 1,9
  // · fumacinha 2,0–2,4 · fim 3,0
  raio: semente => {
    const LONGE = PULA.raio[1], CAI = MORTE.raio, BX = 46, ini = INI.sortear(semente, 'time7');
    return {
      dur: 3.0, espaco: { frente: 110, tras: 20 },
      quadro(g, t, m) {
        const vai = sai(fatia(t, 1.25, 1.42)), x = LONGE * vai, correndo = t >= 1.25 && t < 1.42;
        // o risco de luz que ele deixa (some devagar)
        if (t >= 1.25 && t < 1.9) {
          const a = 1 - fatia(t, 1.42, 1.9), r = rng(semente + 77);
          g.save(); g.globalCompositeOperation = 'lighter';
          g.strokeStyle = rgba('#93C5FD', 0.8 * a); g.lineWidth = 1;
          g.beginPath(); g.moveTo(0, -6);
          for (let px = 6; px < x; px += 6) g.lineTo(px, -6 + (r() - 0.5) * 5);
          g.lineTo(x, -6); g.stroke();
          g.restore();
        }
        // o inimigo: chega, leva o raio (estremece), solta faísca e desmonta
        if (t < 2.2) {
          const morto = t >= CAI, levou = t >= 1.33;
          const treme = levou && !morto ? Math.sin(t * 90) * 0.6 : 0;
          g.save(); g.globalAlpha *= 1 - fatia(t, 2.0, 2.2);
          inimigoChegando(g, ini, t, 92, BX + treme, 1.0, morto ? { cor: '#57534E', sy: 1 - 0.4 * fatia(t, CAI, 2.1), sx: 1 + 0.2 * fatia(t, CAI, 2.1) } : levou ? { a: 0.5 + 0.5 * Math.sin(t * 40) } : {});
          g.restore();
          if (levou && t < 2.1) faiscas(g, BX, -6, t, semente + 5, morto ? 10 : 4, morto ? 9 : 6);
        }
        A.puf(g, BX, -4, fatia(t, 2.0, 2.4), semente + 9, 0.6, 5);
        if (correndo) A.rastro(g, x, t, '#BFDBFE');
        A.clawdAkatsuki(g, {
          T: m.T, x, sy: t >= 0.25 && t < 1.25 ? 0.93 : 1, pernas: correndo ? (Math.floor(t / 0.05) % 2 ? 'A' : 'B') : 'ambas',
          tinta: correndo ? { cor: '#BFDBFE', a: 0.45 } : null,
          mao: t >= 0.25 && t < 1.7 && function (k, dy) { A.maoNa(k, 10, -5 + dy); },
        });
        // a mão de raios: carregando, na corrida e se apagando lá na frente
        const forte = t < 1.42 ? fatia(t, 0.25, 0.7) : 1 - fatia(t, 1.42, 1.7);
        if (forte > 0 && t >= 0.25) raios(g, x + 11, -4.5, t, semente, forte);
      },
    };
  },
  // um selo; as folhas sobem girando em volta dele e ele some no meio delas; elas voam pra frente
  // num rio, giram lá na frente e ele aparece no meio; as folhas caem.
  // Selo 0–0,35 · gira 0,3–0,9 · some 0,55–0,75 · voa 0,8–1,3 · gira 1,2–1,6 · aparece 1,35–1,55 ·
  // caem 1,55–2,3 · fim 2,5
  folhas: semente => {
    const LONGE = PULA.folhas[1], r = rng(semente);
    const bando = Array.from({ length: 18 }, () => ({ fase: r() * Math.PI * 2, raio: 6 + r() * 7, alt: -2 - r() * 18, atraso: r() * 0.15, vez: r(), cor: FOLHAS[Math.floor(r() * FOLHAS.length)], gira: 4 + r() * 6, cai: r() * 10 - 5 }));
    return {
      dur: 2.5, espaco: { frente: 75, tras: 20 },
      quadro(g, t, m) {
        if (t < 0.75) A.clawdAkatsuki(g, { T: m.T, alfa: 1 - fatia(t, 0.55, 0.75), selo: t < 0.35 ? 1 : null });
        if (t >= 1.35) A.clawdAkatsuki(g, { T: m.T, x: LONGE, alfa: fatia(t, 1.35, 1.55) });
        for (const f of bando) {
          const t0 = 0.3 + f.atraso;
          if (t < t0) continue;
          let x, y;
          // gira em volta dele subindo; sai num rio pra frente (cada folha na vez dela), ondulando;
          // gira lá na frente; cai
          const roda = f.fase + (Math.min(t, 1.6) - t0) * f.gira, sobe = fatia(t, t0, 0.8);
          const u = sai(fatia(t, 0.72 + 0.28 * f.vez, 1.05 + 0.28 * f.vez));
          if (t < 1.6) {
            x = LONGE * u + Math.cos(roda) * f.raio * (0.5 + 0.5 * sobe) * (1 - 0.6 * Math.sin(Math.PI * u));
            y = -2 + (f.alt + 2) * sobe - 5 * Math.sin(Math.PI * u) + Math.sin(roda) * 2;
          } else {
            const d = t - 1.6;
            x = LONGE + Math.cos(roda) * f.raio + f.cai * d; y = Math.min(-1, f.alt + Math.sin(roda) * 2 + 14 * d * d + 4 * d);
          }
          g.save(); g.globalAlpha *= 1 - fatia(t, 1.9, 2.3);
          folhinha(g, x, y, roda * 0.7, f.cor);
          g.restore();
        }
      },
    };
  },
};

// a esfera azul girando: brilho, miolo claro, a borda e 3 riscos girando por dentro
function esfera(g, x, y, r, t) {
  g.save(); g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y, r * 0.5, x, y, r * 2.6);
  gr.addColorStop(0, rgba('#60A5FA', 0.55)); gr.addColorStop(1, rgba('#60A5FA', 0));
  g.fillStyle = gr; g.fillRect(x - r * 2.6, y - r * 2.6, r * 5.2, r * 5.2);
  g.restore();
  g.fillStyle = '#3B82F6'; g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
  g.fillStyle = '#BFDBFE'; g.beginPath(); g.arc(x, y, r * 0.62, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#EFF6FF'; g.lineWidth = 0.8;
  for (let i = 0; i < 3; i++) {
    const a = t * 22 + i * 2.09;
    g.beginPath(); g.ellipse(x, y, r * 0.85, r * 0.35, a, 0, Math.PI * 1.2); g.stroke();
  }
}

// o Rasenshuriken: a esfera azul (a do esfera()), o disco de vento em volta e as quatro lâminas
// brancas girando, curvas pra trás do giro, com um rastro do giro. r: o raio da esfera; pas: o
// tamanho das lâminas (0 a 1); zune: os riscos de vento girando em volta, se formando (0 a 1)
function rasenshuriken(g, x, y, r, pas, t, zune) {
  if (r <= 0.2) return;
  const L = r * 3.6 * pas, giro = t * 9, R = r + L * 1.1 + 2;
  g.save(); g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y, r * 0.5, x, y, R);
  gr.addColorStop(0, rgba('#E0F2FE', 0.6)); gr.addColorStop(1, rgba('#38BDF8', 0));
  g.fillStyle = gr; g.fillRect(x - R, y - R, R * 2, R * 2);
  if (pas > 0) {
    g.strokeStyle = rgba('#F0F9FF', 0.55 * pas); g.lineWidth = 0.7;
    g.beginPath(); g.ellipse(x, y, r + L * 0.55, (r + L * 0.55) * 0.92, 0, 0, Math.PI * 2); g.stroke();  // o disco
    for (const [atras, alfa] of [[0.35, 0.35], [0, 0.95]]) {
      g.fillStyle = rgba('#F8FAFC', alfa * pas);
      for (let i = 0; i < 4; i++) {
        const a = giro - atras + i * Math.PI / 2, b0 = a - 0.45, b1 = a + 0.25, p = a - 0.35;
        g.beginPath();
        g.moveTo(x + Math.cos(b0) * r * 0.9, y + Math.sin(b0) * r * 0.9);
        g.lineTo(x + Math.cos(p) * (r + L), y + Math.sin(p) * (r + L));
        g.lineTo(x + Math.cos(b1) * r * 0.9, y + Math.sin(b1) * r * 0.9);
        g.closePath(); g.fill();
      }
    }
  }
  if (zune > 0) {  // o vento entrando, em espiral
    g.strokeStyle = rgba('#E0F2FE', 0.6 * zune); g.lineWidth = 0.6;
    for (let i = 0; i < 3; i++) {
      const a = -t * 7 + i * 2.09, rr = r + L + 3 + ((t * 18 + i * 3) % 6);
      g.beginPath(); g.arc(x, y, rr, a, a + 0.9); g.stroke();
    }
  }
  g.restore();
  esfera(g, x, y, r, t);
}

// o estouro do Rasenshuriken: uma esfera de vento que cresce rápido, cheia de laminazinhas (riscos
// brancos sorteados a cada 1/20 s), e uma onda que sai e some; u de 0 a 1
function vento(g, x, y, u, t, semente) {
  const R = 26 * sai(Math.min(1, u / 0.25)), a = u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
  if (R < 0.5) return;
  g.save(); g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y, 0, x, y, R * 1.4);
  gr.addColorStop(0, rgba('#F0F9FF', 0.85 * a)); gr.addColorStop(0.6, rgba('#7DD3FC', 0.5 * a)); gr.addColorStop(1, rgba('#38BDF8', 0));
  g.fillStyle = gr; g.fillRect(x - R * 1.4, y - R * 1.4, R * 2.8, R * 2.8);
  const f = 1 - fatia(u, 0, 0.18);  // o clarão do impacto
  if (f > 0) { g.fillStyle = rgba('#FFFFFF', 0.8 * f); g.beginPath(); g.arc(x, y, 6 + 30 * (1 - f), 0, Math.PI * 2); g.fill(); }
  g.restore();
  g.strokeStyle = rgba('#E0F2FE', 0.9 * a); g.lineWidth = 1;
  g.beginPath(); g.arc(x, y, R, 0, Math.PI * 2); g.stroke();
  const o = fatia(u, 0, 0.5);  // a onda
  if (o > 0 && o < 1) {
    g.strokeStyle = rgba('#BAE6FD', 0.7 * (1 - o));
    g.beginPath(); g.ellipse(x, y, R + 30 * o, (R + 30 * o) * 0.8, 0, 0, Math.PI * 2); g.stroke();
  }
  const r = rng((semente + Math.floor(t * 20) * 7919) >>> 0);
  g.strokeStyle = rgba('#FFFFFF', a); g.lineWidth = 0.7;
  for (let i = 0; i < 20; i++) {
    const d = Math.sqrt(r()) * R * 0.9, b = r() * Math.PI * 2, c = r() * Math.PI, l = 3 + r() * 5;
    const px = x + Math.cos(b) * d, py = y + Math.sin(b) * d, [dx, dy] = [Math.cos(c) * l / 2, Math.sin(c) * l / 2];
    g.beginPath(); g.moveTo(px - dx, py - dy); g.lineTo(px + dx, py + dy); g.stroke();
  }
}

// os raios na mão: riscos quebrados saindo do meio, trocando a cada 1/20 s, e o brilho
function raios(g, x, y, t, semente, forte) {
  g.save(); g.globalCompositeOperation = 'lighter';
  const gr = g.createRadialGradient(x, y, 1, x, y, 9);
  gr.addColorStop(0, rgba('#DBEAFE', 0.8 * forte)); gr.addColorStop(1, rgba('#3B82F6', 0));
  g.fillStyle = gr; g.fillRect(x - 9, y - 9, 18, 18);
  g.restore();
  const r = rng((semente + Math.floor(t * 20) * 7919) >>> 0);
  g.strokeStyle = rgba('#F0F9FF', forte); g.lineWidth = 0.8;
  for (let i = 0; i < 5; i++) {
    let a = r() * Math.PI * 2, px = x, py = y;
    const n = 2 + Math.floor(r() * 3);
    g.beginPath(); g.moveTo(px, py);
    for (let j = 0; j < n; j++) { a += (r() - 0.5) * 1.4; const l = (2 + r() * 2.5) * (0.5 + 0.5 * forte); px += Math.cos(a) * l; py += Math.sin(a) * l; g.lineTo(px, Math.min(0, py)); }
    g.stroke();
  }
  // faíscas no chão embaixo da mão
  g.fillStyle = rgba('#93C5FD', forte);
  for (let i = 0; i < 3; i++) g.fillRect(Math.round(x - 4 + r() * 8), Math.round(-1 - r() * 2), 1, 1);
}

// faíscas pulando de um ponto (o bug que levou o raio)
function faiscas(g, x, y, t, semente, n, alcance) {
  const r = rng((semente + Math.floor(t * 24) * 104729) >>> 0);
  g.fillStyle = '#DBEAFE';
  for (let i = 0; i < n; i++) g.fillRect(Math.round(x + (r() - 0.5) * alcance * 2), Math.round(y + (r() - 0.5) * alcance), 1, 1);
}

module.exports = { FABRICAS, MORTE, PULA, folhinha, FOLHAS, esfera, raios };
