'use strict';
// Tema Elden Ring: as cenas da caminhada e a do "acabou tudo". Quatro paradas, cada uma tirada do jogo:
//   abatido  um inimigo (bug, soldado de Godrick, cão ou espírito, sorteado pela semente) chega, o Clawd o derruba e as runas
//            douradas sobem do corpo e voam pra ele;
//   mensagem o recado no chão (o losango de luz com letras fantasma) diz TENTE PULAR; ele lê, pula e cai;
//   mimico   o baú que abre de repente com língua e dentes e morde; o Clawd revida e o baú tomba;
//   morreu   um inimigo o acerta, a tela escurece e surge VOCÊ MORREU em vermelho; a graça o levanta.
// E o 'tudo': LOCAL DE GRAÇA DESCOBERTO (janela inteira).
// Contrato (tema-elden.js): SORTEADAS, FABRICAS { id: semente => { dur, espaco, quadro(g, t, m), sons } }, MORTE { id: s } (quando o
// inimigo cai: o tema conta o abatido), PULA { id: [s, px] } (cenas que terminam mais adiante), cenaGraca(m).
// Tudo no referencial do Clawd (x+ pra frente, y- pra fora do cartão), função pura de t. O que é do palco inteiro (a faixa
// de texto, a vinheta) é desenhado em coordenadas da janela, como a lua do Akatsuki.
const { rng, rgba, arte, tingida, tr } = require('./comum');
const lingua = m => (m.host || {}).idioma;  // Idioma = English: os letreiros do jogo em inglês
const A = require('./elden-arte');
const INI = require('./elden-inimigos');

const { fatia, sai, entra, COR, lim } = A;
const som = n => `sons-elden/${n}.wav`;
const SORTEADAS = ['abatido', 'mensagem', 'mimico', 'morreu'];
const MORTE = { abatido: 1.5, mimico: 2 };
// as cenas que terminam mais à frente: [a partir de quando ele já está lá (s), quanto (px)]
const PULA = { mensagem: [2.75, 86], mimico: [1.95, 26] };

// nada passa pra dentro do cartão: tudo da cena sai por cima da linha dos pés (o contorno do Clawd leva 1 px a mais)
function acima(g, desenha) {
  g.save(); g.beginPath(); g.rect(-400, -300, 800, 301.5); g.clip();
  try { desenha(); } finally { g.restore(); }
}
// o palco inteiro, em DIPs da janela (host.cartao = [x, y, w, h]; por cima do cartão fica o palco)
function naJanela(g, m, f) {
  const e = m.host.escala || 1;
  g.save(); g.setTransform(e, 0, 0, e, 0, 0);
  try { f(m.host.cartao); } finally { g.restore(); }
}
// a faixa escura de texto: o raster não tem gradiente linear, então tiras de 4 px que somem nas pontas
function faixa(g, c, cy, meia, alfa, cor = '#050302') {
  if (alfa <= 0 || meia <= 0) return;
  const x0 = c[0] - 30, w = c[2] + 60;
  for (let x = 0; x < w; x += 4) {
    const u = (x + 2) / w, al = alfa * Math.min(1, u / 0.18, (1 - u) / 0.18);
    g.fillStyle = rgba(cor, al); g.fillRect(x0 + x, cy - meia, 4, meia * 2);
  }
}
// o golpe da arma: de trás (-45) pra frente (110) em 0,13 s a partir de t0, e depois de volta pro passo (30) entre v0 e v1
function armaGolpe(t, t0, v0, v1) {
  const bate = -45 + 155 * sai(fatia(t, t0, t0 + 0.13));
  return bate + (30 - 110) * fatia(t, v0, v1);
}
const piscar = t => (Math.floor(t / 0.12) % 2 ? 'q' : 'p');

// ---------- o recado no chão: o losango de luz, com letras fantasma ----------
const RECADO = [
  '.....k.....',
  '....kYk....',
  '...kYYYk...',
  '..kYWYWYk..',
  '.kYYYYYYYk.',
  'kYYsYsYYsYk',
  '.kYYYYYYYk.',
  'kYYsYYsYsYk',
  '.kYYYYYYYk.',
  '..kYsYsYk..',
  '...kYYYk...',
  '....kYk....',
  '.....k.....',
];
const COR_RECADO = { k: '#7A5A12', Y: '#F2D77A', W: '#FFF6C9', s: '#B8891F' };
function recado(g, x, t, forca) {
  if (forca <= 0) return;
  const img = arte(RECADO, COR_RECADO), w = 11 * 1.5, h = 13 * 1.5, voa = Math.sin(t * 2.4) * 1.2;
  g.save(); g.globalAlpha *= forca;
  g.save(); g.translate(x, -1); g.scale(1, 0.28); A.luz(g, 0, 0, 22, 0.55 + 0.1 * Math.sin(t * 3)); g.restore();  // a luz no chão
  g.drawImage(img, Math.round(x - w / 2), -h - 4 + voa, w, h);
  g.globalCompositeOperation = 'lighter'; g.globalAlpha *= 0.35 + 0.15 * Math.sin(t * 3.4);
  g.drawImage(img, Math.round(x - w / 2), -h - 4 + voa, w, h);
  g.restore();
  A.brasas(g, x - 12, -34, 24, 30, t, 41, 9, COR.ouroClaro, 0.2);
}

// ---------- o baú mímico: o corpo, a tampa (gira na dobradiça de trás, à direita), a língua e os dentes ----------
// k contorno · W/w madeira (luz, meio) · D madeira escura · i ferro · g ouro · t dente · r boca · T gengiva
const BAU_CORPO = [
  '.t.t.t.t.t.t.t.',
  'kttttttttttttk.',
  'krrrrrrrrrrrrrk',
  'kiWWWWWWWWWWWik',
  'kiwwwwwwwwwwwik',
  'kiwwWwwwwwWwwik',
  'kiwwwwwwwwwwwik',
  'kiDwwwwwwwwwDik',
  'kkkkkkkkkkkkkkk',
];
const BAU_TAMPA = [
  '..kkkkkkkkkkk..',
  '.kWWWWWWWWWWWk.',
  'kiWwwwwwwwwwwik',
  'kiwwwWwwwwWwwik',
  'kiwwgggwwwwwwik',
  'krrrrrrrrrrrrrk',
  '.t.t.t.t.t.t.t.',
];
const COR_BAU = { k: '#0B0907', W: '#B07A3F', w: '#8A5A2B', D: '#5B3A1A', i: '#6B7280', g: '#D4AF37', t: '#F3F4F6', r: '#7F1D1D' };
const PB = 1.6, BW = 15 * PB;
// ang: abertura da tampa em graus (0 = fechado); lingua 0..1; rot: o baú tomba pro pé de trás; a: vermelho do golpe
function bau(g, x, y, { ang = 0, lingua = 0, rot = 0, a = 0, alfa = 1, t = 0, sy = 1 } = {}) {
  const corpo = arte(BAU_CORPO, COR_BAU), tampa = arte(BAU_TAMPA, COR_BAU);
  const aberto = ang > 1;
  g.save(); g.globalAlpha *= alfa; g.translate(x + BW / 2 - 1, y);  // o pivô: o pé de trás
  if (rot) g.rotate(rot * Math.PI / 180);
  g.scale(1, sy); g.translate(-BW / 2 + 1, 0);
  const cabeca = (img, ox, oy, w, h, cortaAte) => {
    const sh = cortaAte == null ? img.height : cortaAte;
    g.drawImage(img, 0, 0, img.width, sh, ox, oy, w, sh * PB);
    if (a > 0) { g.save(); g.globalAlpha *= a; g.drawImage(tingida(img, '#EF4444', 'eldbau' + img.height), 0, 0, img.width, sh, ox, oy, w, sh * PB); g.restore(); }
  };
  if (aberto) {
    cabeca(corpo, -BW / 2, -9 * PB, BW, 9 * PB);
    // a língua: do fundo da boca pra fora, pra frente (esquerda), balançando
    for (let i = 0; i < 9; i++) {
      const u = i / 8, lx = -BW / 2 + 1 - u * 13 * lingua, ly = -7.2 * PB + u * 4 * lingua + Math.sin(t * 12 + i * 0.6) * 0.8 * lingua;
      g.fillStyle = '#0B0907'; g.fillRect(lx - 0.8, ly - 1.8, 3.4, 4.4);
    }
    for (let i = 0; i < 9; i++) {
      const u = i / 8, lx = -BW / 2 + 1 - u * 13 * lingua, ly = -7.2 * PB + u * 4 * lingua + Math.sin(t * 12 + i * 0.6) * 0.8 * lingua;
      g.fillStyle = i % 3 === 0 ? '#F43F5E' : '#BE123C'; g.fillRect(lx, ly - 1, 2.2, 2.4);
    }
    // a tampa gira em volta da dobradiça (canto de trás, em cima do corpo)
    g.save(); g.translate(BW / 2 - 1, -7 * PB); g.rotate(ang * Math.PI / 180);
    g.translate(-BW / 2 + 1, 0);
    cabeca(tampa, -BW / 2, -5 * PB - 1, BW, 7 * PB);
    g.restore();
  } else {
    // fechado: o corpo (sem a fileira de dentes) e a tampa só com a madeira, por cima
    g.save(); g.translate(0, 0);
    g.drawImage(corpo, 0, 3, corpo.width, 6, -BW / 2, -6 * PB, BW, 6 * PB);
    if (a > 0) { g.save(); g.globalAlpha *= a; g.drawImage(tingida(corpo, '#EF4444', 'eldbau' + corpo.height), 0, 3, corpo.width, 6, -BW / 2, -6 * PB, BW, 6 * PB); g.restore(); }
    g.restore();
    g.drawImage(tampa, 0, 0, tampa.width, 5, -BW / 2, -11 * PB, BW, 5 * PB);
    if (a > 0) { g.save(); g.globalAlpha *= a; g.drawImage(tingida(tampa, '#EF4444', 'eldbau' + tampa.height), 0, 0, tampa.width, 5, -BW / 2, -11 * PB, BW, 5 * PB); g.restore(); }
  }
  g.restore();
}

// o som de chegada de cada inimigo
const SOM_ENTRADA = { soldado: 'soldado', cao: 'cao-late', espirito: 'espirito' };
const entrada = (ini, t = 0.15) => (SOM_ENTRADA[ini.tipo] ? [[t, som(SOM_ENTRADA[ini.tipo]), 0.7]] : []);
// quando cada inimigo chega à marca (o cão corre, o espírito desliza devagar)
const CHEGA = { bug: 1.2, soldado: 1.3, cao: 0.85, espirito: 1.35 };
const andaDe = (ini, t) => (ini.tipo === 'espirito' ? (Math.floor(t / 0.3) % 2 ? 'q' : 'p') : Math.floor(t / (ini.tipo === 'cao' ? 0.08 : 0.12)) % 2 ? 'q' : 'p');

const FABRICAS = {
  // o inimigo chega pela frente; o Clawd ergue a arma, golpeia e ele cai; do corpo sobem as runas, que voam pro Clawd.
  // Chega 0–1,3 · arma atrás 1,0–1,45 · golpe 1,45–1,58 · cai 1,5–2,3 · runas 1,9–2,9 · brilho 2,5–3,3 · texto 2,7–3,5 · fim 3,9
  abatido: semente => {
    const ini = INI.sortear(semente), X = 38, G = MORTE.abatido, ch = CHEGA[ini.tipo];
    return {
      dur: 3.9, espaco: { frente: 115, tras: 20 },
      sons: [...entrada(ini), [G - 0.06, som('golpe'), 0.9], [G, som('acerta'), 1], [1.95, som('runas'), 0.8]],
      quadro(g, t, m) {
        acima(g, () => {
          const mexe = t < ch, ex = X + 66 * (1 - sai(fatia(t, 0, ch))) + 5 * sai(fatia(t, G, G + 0.2)) * (1 - fatia(t, G + 0.2, G + 0.9));
          const u = fatia(t, G, G + 0.85);
          if (u < 1) {
            INI.inimigo(g, ini, ex, 0, { passo: mexe ? andaDe(ini, t) : 'p', a: t >= G ? 1 - fatia(t, G, G + 0.4) : 0, morte: u, t });
          }
          // o clarão do golpe e a luz do corpo antes das runas
          if (t >= G && t < G + 0.2) A.luz(g, X - 8, -10, 13, 1 - fatia(t, G, G + 0.2), '#FFFFFF');
          A.luz(g, X, -6, 14, Math.sin(Math.PI * fatia(t, 1.7, 2.5)) * 0.8);
          A.runas(g, X, -8, 4, -12, fatia(t, 1.9, 2.9), semente + 5, 16);
          // o Clawd: anda, firma, ergue a arma e golpeia; as runas entram nele
          const brilho = Math.sin(Math.PI * fatia(t, 2.5, 3.3));
          if (t < 1.0 || t >= 3.3) A.clawdElden(g, A.andando(m.T));
          else {
            A.clawdElden(g, {
              T: m.T, pernas: 'ambas', x: 7 * sai(fatia(t, 1.4, 1.5)) * (1 - fatia(t, 1.6, 1.95)), brilho,
              arma: { ang: t < 1.45 ? 30 - 75 * sai(fatia(t, 1.0, 1.3)) : armaGolpe(t, 1.45, 2.2, 2.9) },
            });
          }
          if (t >= 2.7 && t < 3.6) {  // "RUNAS" sobe da cabeça dele
            g.save(); g.globalAlpha *= sai(fatia(t, 2.7, 2.9)) * (1 - fatia(t, 3.3, 3.6));
            A.texto(g, tr(lingua(m), 'runas', 'runes'), 4, -44 - 6 * fatia(t, 2.7, 3.6), 1, { centro: true, cor: COR.ouroClaro });
            g.restore();
          }
        });
      },
    };
  },

  // o recado dourado brilha no chão; "TENTE PULAR" flutua em cima; ele lê, pula por cima... e cai.
  // Anda 0–0,6 · lê 0,6–1,9 · agacha 1,9–2,05 · pula 2,05–2,75 · cai 2,8–3,15 · deitado 3,15–3,7 · levanta 3,7–4,1 · fim 4,5
  mensagem: semente => {
    const X = 62, LONGE = PULA.mensagem[1], PARTE = 30;
    return {
      dur: 4.5, espaco: { frente: 125, tras: 20 },
      sons: [[0.55, som('mensagem'), 0.8], [2.82, som('acerta'), 0.55]],
      quadro(g, t, m) {
        acima(g, () => {
          recado(g, X, t, sai(fatia(t, 0, 0.45)));
          // o texto flutua em cima do recado
          const a = sai(fatia(t, 0.7, 1.2)) * (1 - fatia(t, 3.4, 3.9));
          if (a > 0) {
            g.save(); g.globalAlpha *= a;
            A.texto(g, tr(lingua(m), 'tente pular', 'try jumping'), X, -62 + Math.sin(t * 2.2) * 1.5 + 4 * (1 - sai(fatia(t, 0.7, 1.2))), 2, { centro: true, cor: COR.ouroClaro });
            g.restore();
          }
          const pulo = fatia(t, 2.05, 2.75), cai = fatia(t, 2.8, 3.15), levanta = fatia(t, 3.7, 4.1);
          if (t < 0.6) A.clawdElden(g, A.andando(m.T, { x: PARTE * fatia(t, 0, 0.6) }));
          else if (t < 2.05) {  // lê, olhando pra cima
            A.clawdElden(g, { T: m.T, pernas: 'ambas', x: PARTE, olhos: t > 0.9 && t < 1.8 ? 'cima' : 'abertos', arma: { ang: 30 }, sy: t >= 1.9 ? 1 - 0.07 * sai(fatia(t, 1.9, 2.05)) : 1 });
          } else if (t < 2.8) {
            const x = PARTE + (LONGE - PARTE) * pulo;
            A.clawdElden(g, A.pulando(m.T, { x, y: -20 * Math.sin(Math.PI * pulo), sy: pulo > 0.92 ? 0.92 : 1 }));
            if (pulo > 0.9) A.luz(g, LONGE, -2, 9, (pulo - 0.9) * 6, '#C8B68C');
          } else {
            const rot = t < 3.7 ? 86 * entra(cai) : 86 * (1 - sai(levanta)), lar = t < 3.15 ? 1 : 0;
            A.clawdElden(g, {
              T: m.T, pernas: 'ambas', x: LONGE, rot, sx: 1 - 0.4 * Math.sin(rot * Math.PI / 180), y: -9 * Math.sin(rot * Math.PI / 180), olhos: t >= 3.15 && t < 3.7 ? 'fechados' : 'abertos',
              arma: { ang: lar ? 120 : 60 },
            });
          }
        });
      },
    };
  },

  // um baú de madeira e ferro; o Clawd chega, o baú abre de repente (língua e dentes) e morde; ele revida e o baú tomba.
  // Anda 0–0,6 · treme 0,5–1,0 · abre 1,0–1,15 · pula 1,0–1,35 · morde 1,45 · revida 1,75–2,0 · tomba 2,1–2,8 · some 3,2–3,8 · fim 4,1
  mimico: semente => {
    const BX = 72, ALVO = 52, PARTE = 26, ACERTA = MORTE.mimico;
    void semente;
    return {
      dur: 4.1, espaco: { frente: 115, tras: 30 },
      sons: [[1.0, som('bau-abre'), 0.9], [1.42, som('bau-morde'), 1], [1.62, som('bau-morde'), 0.7], [ACERTA - 0.06, som('golpe'), 0.9], [ACERTA, som('acerta'), 1]],
      quadro(g, t, m) {
        acima(g, () => {
          const salta = fatia(t, 1.0, 1.35), recua = fatia(t, ACERTA, ACERTA + 0.18);
          let x = BX - (BX - ALVO) * sai(salta) + 4 * sai(recua), y = -9 * Math.sin(Math.PI * salta);
          if (t < 1.0) x = BX + (t > 0.5 ? Math.sin(t * 60) * 0.5 : 0);  // treme de leve antes de abrir
          // a boca: abre num estouro (passa um pouco do ponto), morde duas vezes, e a tampa bate quando ele leva o golpe
          let ang = 0;
          if (t >= 1.0 && t < ACERTA) {
            ang = 70 * sai(fatia(t, 1.0, 1.15)) + 6 * Math.sin(t * 40) * (t < 1.2 ? 1 : 0);
            if (t >= 1.38 && t < 1.5) ang = 70 - 66 * Math.sin(Math.PI * fatia(t, 1.38, 1.5)) * 1;
            if (t >= 1.58 && t < 1.7) ang = 70 - 66 * Math.sin(Math.PI * fatia(t, 1.58, 1.7));
          } else if (t >= ACERTA) ang = 70 * (1 - sai(fatia(t, ACERTA, ACERTA + 0.1)));
          const aberto = ang > 1, tomba = fatia(t, 2.1, 2.8);
          const quica = t >= 2.8 && t < 2.95 ? 1.5 * Math.sin(Math.PI * fatia(t, 2.8, 2.95)) : 0;
          bau(g, x, y - quica, {
            ang, lingua: aberto ? sai(fatia(t, 1.0, 1.2)) : 0, t, rot: 7 * sai(tomba), sy: 1 - 0.1 * sai(tomba),
            a: t >= ACERTA ? 1 - fatia(t, ACERTA, ACERTA + 0.4) : 0, alfa: 1 - fatia(t, 3.2, 3.8),
          });
          if (t >= 1.0 && t < 1.2) A.luz(g, x - 12, -11, 14, 1 - fatia(t, 1.0, 1.2), '#FFE9A8');
          if (t >= ACERTA && t < ACERTA + 0.2) A.luz(g, ALVO - 8, -9, 13, 1 - fatia(t, ACERTA, ACERTA + 0.2), '#FFFFFF');
          if (t >= 2.7 && t < 3.6) A.luz(g, x + 4, -4, 14, Math.sin(Math.PI * fatia(t, 2.7, 3.6)) * 0.7);  // o brilho do que o baú guardava
          // o Clawd
          const mordido = fatia(t, 1.45, 1.65);
          if (t < 0.6) A.clawdElden(g, A.andando(m.T, { x: PARTE * fatia(t, 0, 0.6) }));
          else if (t < 1.45) A.clawdElden(g, { T: m.T, pernas: 'ambas', x: PARTE, arma: { ang: 30 }, sy: t > 0.9 ? 0.96 : 1 });
          else if (t < 1.75) {  // a mordida: ele é jogado pra trás, vermelho
            const dor = 1 - fatia(t, 1.45, 1.75);
            A.clawdElden(g, { T: m.T, pernas: 'ambas', x: PARTE - 16 * sai(mordido), tinta: { cor: '#EF4444', a: 0.8 * dor }, sx: 1 - 0.06 * dor, arma: { ang: 5 } });
          } else if (t >= 3.4) A.clawdElden(g, A.andando(m.T, { x: PARTE }));
          else {
            A.clawdElden(g, {
              T: m.T, pernas: 'ambas', x: PARTE - 16 + 16 * sai(fatia(t, 1.78, 1.95)),
              arma: { ang: t < 1.85 ? 5 - 50 * sai(fatia(t, 1.75, 1.85)) : armaGolpe(t, 1.85, 2.4, 3.0) },
            });
          }
        });
      },
    };
  },

  // um inimigo o acerta; a tela escurece, VOCÊ MORREU em vermelho com a faixa preta atrás; depois uma luz dourada o levanta.
  // Chega 0–1 · golpe 1,0–1,15 · cai 1,2–1,75 · escurece 1,3–2,0 · letreiro 1,9–3,9 · graça 3,4–4,6 · levanta 3,9–4,5 · fim 5,0
  morreu: semente => {
    const ini = INI.sortear(semente), X = 36, ch = CHEGA[ini.tipo], GOLPE = 1.15;
    return {
      dur: 5.0, espaco: { frente: 110, tras: 55 },
      sons: [...entrada(ini), [GOLPE, som('acerta'), 1], [1.75, som('morreu'), 1], [3.5, som('graca'), 0.8]],
      quadro(g, t, m) {
        const escuro = sai(fatia(t, 1.3, 2.0)) * (1 - fatia(t, 3.7, 4.5)), texto = sai(fatia(t, 1.9, 2.5)) * (1 - fatia(t, 3.5, 4.0));
        // a vinheta e a faixa vão por baixo do Clawd e dos inimigos (coordenadas da janela)
        naJanela(g, m, c => {
          if (escuro <= 0) return;
          const cx = c[0] + c[2] / 2, cy = c[1] - 44, R = Math.max(c[2], 160) * 0.42;
          const gr = g.createRadialGradient(cx, cy, R * 0.15, cx, cy, R);
          gr.addColorStop(0, rgba('#000000', 0.7 * escuro)); gr.addColorStop(1, rgba('#000000', 0));
          g.fillStyle = gr; g.fillRect(cx - R, cy - R, R * 2, R * 2);
          faixa(g, c, cy, Math.round(24 * sai(fatia(t, 1.3, 1.9))), 0.88 * escuro);
          if (texto > 0) {
            const morreu = tr(lingua(m), 'você morreu', 'you died'), k = A.largTexto(morreu, 3) <= c[2] - 20 ? 3 : 2;
            g.save(); g.globalAlpha *= texto;
            A.texto(g, morreu, cx, cy - Math.round(k * 3.5), k, { centro: true, cor: COR.sangue });
            g.restore();
          }
        });
        acima(g, () => {
          const bate = t >= 1.0 && t < 1.15 ? sai(fatia(t, 1.0, 1.15)) : (t >= 1.15 ? 1 - fatia(t, 1.15, 1.35) : 0);
          const ex = X + 56 * (1 - sai(fatia(t, 0, ch))) - 10 * bate;
          const alfaI = 1 - fatia(t, 2.0, 2.7);
          if (alfaI > 0) INI.inimigo(g, ini, ex, 0, { passo: t < ch ? andaDe(ini, t) : 'p', alfa: alfaI, t });
          if (t >= GOLPE && t < GOLPE + 0.2) A.luz(g, 24, -10, 13, 1 - fatia(t, GOLPE, GOLPE + 0.2), '#FFFFFF');
          // a graça que o levanta: o facho de luz sob ele
          const forca = sai(fatia(t, 3.4, 3.9)) * (1 - fatia(t, 4.4, 5.0)), cai = fatia(t, 1.2, 1.75), sobe = fatia(t, 3.9, 4.5);
          A.graca(g, -16, 0, forca, t);
          let rot = 0, x = 0;
          if (t < 1.2) { rot = 0; x = 0; }
          else if (t < 3.9) { rot = -88 * entra(cai); x = -7 - 7 * sai(cai); }
          else { rot = -88 * (1 - sai(sobe)); x = -14 * (1 - sai(sobe)); }
          const dor = t >= GOLPE ? 1 - fatia(t, GOLPE, GOLPE + 0.5) : 0;
          if (t < 0.7 || t >= 4.8) A.clawdElden(g, A.andando(m.T));
          else {
            A.clawdElden(g, {
              T: m.T, pernas: 'ambas', x, rot, sx: 1 - 0.4 * Math.sin(Math.abs(rot) * Math.PI / 180), y: -9 * Math.sin(Math.abs(rot) * Math.PI / 180), tinta: { cor: '#EF4444', a: 0.85 * dor },
              olhos: rot < -60 && t < 4.2 ? 'fechados' : 'abertos', brilho: Math.sin(Math.PI * fatia(t, 3.8, 4.8)) * 0.9,
              arma: { ang: rot < -10 ? 60 : (t > 4.4 ? 30 : 5) },
            });
          }
        });
      },
    };
  },
};

// ---------- acabou tudo: LOCAL DE GRAÇA DESCOBERTO ----------
// Janela inteira. Uma graça se acende no chão ao lado do Clawd, o letreiro dourado aparece e some, e ele se senta pra descansar.
// Acende 0,3–1,3 · letreiro 1,0–3,4 · senta 1,5–1,9 · luz apaga 3,9–4,6
function cenaGraca() {
  const X = 34;
  return {
    nome: 'graca-descoberta', dur: 4.6, espaco: { frente: 0, tras: 0 }, modos: ['andando', 'parado', 'pulando'],
    sons: [[0.3, som('graca'), 1]],
    quadro(g, t, m) {
      const forca = sai(fatia(t, 0.3, 1.3)) * (1 - fatia(t, 3.9, 4.6)), txt = tr(lingua(m), 'LOCAL DE GRAÇA DESCOBERTO', 'LOST GRACE DISCOVERED');
      const a = sai(fatia(t, 1.0, 1.4)) * (1 - entra(fatia(t, 3.1, 3.6))), abre = sai(fatia(t, 1.0, 1.5));
      naJanela(g, m, c => {
        if (a <= 0) return;
        const k = A.largTexto(txt, 2) <= c[2] - 16 ? 2 : 1, cy = c[1] - 48, meia = Math.round((k * 5.5 + 5) * abre);
        g.save(); g.globalAlpha *= a;
        faixa(g, c, cy, meia, 0.8);
        g.fillStyle = rgba(COR.ouro, 0.55);
        const lx = Math.round(c[0] + c[2] * 0.12), lw = Math.round(c[2] * 0.76);
        g.fillRect(lx, cy - meia, lw, 1); g.fillRect(lx, cy + meia - 1, lw, 1);
        if (abre > 0.6) A.texto(g, txt, c[0] + c[2] / 2, cy - Math.round(k * 3.5), k, { centro: true, cor: COR.ouroClaro });
        g.restore();
      });
      acima(g, () => {
        A.graca(g, X, 0, forca, t);
        if (forca > 0.4) A.brasas(g, X - 14, -40, 28, 38, t, 77, 10, COR.graca, 0.25);
        // o Clawd: no que estava fazendo, e depois senta ao lado da graça
        const senta = fatia(t, 1.5, 1.9), vai = fatia(t, 0.2, 1.5);
        const x = m.modo === 'andando' ? (X - 20) * sai(vai) : 0;
        if (t < 1.5) {
          const base = m.modo === 'pulando' ? A.pulando(m.T) : m.modo === 'andando' ? A.andando(m.T) : { T: m.T, pernas: 'ambas', arma: { ang: 165 } };
          A.clawdElden(g, { ...base, x: base.x != null ? base.x : x });
        } else {
          A.clawdElden(g, {
            T: m.T, x, sentado: senta > 0.5, pernas: 'ambas', olhos: t > 2.3 && t < 3.9 ? 'fechados' : 'abertos',
            arma: { ang: senta > 0.5 ? 165 : 120 }, brilho: 0.5 * Math.sin(Math.PI * fatia(t, 1.3, 4.4)),
          });
        }
      });
    },
  };
}

module.exports = { SORTEADAS, FABRICAS, MORTE, PULA, cenaGraca };
