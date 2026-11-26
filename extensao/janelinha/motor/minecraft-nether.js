'use strict';
// Cena do portal do Nether (tema Minecraft). Só no começo da borda de CIMA do cartão: a cena
// precisa da reta inteira na frente e de altura pro portal e pro palco.
//  1. o Clawd põe 10 obsidianas (o portal 4x5 sem os cantos, em dobro: blocos de 16 px) e acende
//     com o isqueiro;
//  2. anda até o portal, some no roxo e a borda do cartão vira Nether a partir do portal:
//     netherrack (fogo vermelho), soul sand (fogo azul e almas subindo) ou basalto (blocos de
//     magma no meio e cinza caindo, como nos Basalt Deltas), sorteado. Ao mesmo tempo o PALCO abre
//     acima do cartão (minecraft-nether-palco.js): o Nether do bioma, com o teto de netherrack e a
//     luz do glowstone;
//  3. ele sai do portal do lado de lá e para, olhando pro alto: um Ghast sobe por trás do cenário,
//     geme, abre a boca e cospe uma bola de fogo. O Clawd rebate com a picareta (o golpe, a varrida),
//     a bola volta e explode no Ghast, que solta orbes de XP;
//  4. o Clawd comemora e volta pro portal, o palco fecha, a borda volta a ser terra e grama, ele
//     sai do lado de cá, o portal quebra e ele segue andando dali (avanca).
// Quadro = função do tempo (referencial do Clawd: x+ pra frente, y- pra fora do cartão, chão 0).
// A borda virando Nether é desenhada no fundo (fundoNether, coordenadas da janela) pelo
// tema-minecraft.js, por cima da borda de terra e por baixo do Clawd. O palco é desenhado aqui, no
// referencial do cartão (como o palco dos épicos do Elden e do Akatsuki), por baixo do Clawd.
const { lim, sai, entra, rng, IMG } = require('./comum');
const clawd = require('./clawd');
const { fazPoof, desenhaPoof, fazPontos, desenhaPontos, ROXOS, fazCacos, desenhaCacos, fazOrbes, desenhaOrbes, fazFaiscas, desenhaVarrida } = require('./minecraft-kit');
const palco = require('./minecraft-nether-palco');

const L = 16;                      // lado do bloco de obsidiana (px)
const FX = 20;                     // a coluna de fora do portal, à esquerda (px na frente do Clawd)
const CX = FX + 2 * L;             // o meio do portal (52)
const DENTRO = [FX + L, -4 * L, 2 * L, 3 * L];  // o vão do portal [x, y, w, h]: 32 x 48
// as 10 obsidianas na ordem em que o Clawd põe: [x da esquerda, y de baixo]
const BLOCOS = [
  [FX + L, 0], [FX + 2 * L, 0],
  [FX, -L], [FX, -2 * L], [FX, -3 * L],
  [FX + 3 * L, -L], [FX + 3 * L, -2 * L], [FX + 3 * L, -3 * L],
  [FX + L, -4 * L], [FX + 2 * L, -4 * L],
];
// a linha do tempo (s): 20 s, ~9 no Nether
const T = {
  poe: 0.5, cada: 0.24,            // 1 obsidiana a cada 0,24 s (dá pra ouvir cada uma)
  isqueiro: 3.1, acende: 3.7,      // risca o isqueiro; o roxo enche em 0,25 s
  vai: 4.3, chega: 5.2,            // anda até o portal
  some: 5.7,                       // some no roxo
  vira0: 5.5, vira1: 6.4,          // a borda vira Nether (do portal pros lados)
  abre0: 5.6, abre1: 6.6,          // o palco abre, de baixo pra cima (junto com a borda)
  volta: 6.6, saiu: 7.0,           // aparece do lado de lá
  anda1: 7.05, anda2: 7.65,        // sai do portal e para (X1), olhando pro alto
  ghast0: 7.3, ghast1: 9.3,        // o Ghast sobe por trás do cenário e geme
  atira: 9.8,                      // abre a boca (a bola cresce nela) e cospe 0,4 s depois
  rebate: 11.2,                    // a bola chega no Clawd e ele rebate com a picareta
  acerta: 11.9,                    // a bola volta e explode no Ghast, que solta orbes
  retorna0: 13.0, retorna1: 13.8,  // o Clawd comemorou e volta andando pro portal
  entra: 14.2,                     // some no portal
  fecha0: 14.1, fecha1: 15.0,      // o palco fecha, de cima pra baixo (junto com desvira0..desvira1)
  desvira0: 14.1, desvira1: 15.0,  // a borda volta a ser terra
  reaparece0: 14.9, reaparece1: 15.3,
  sai0: 15.6, sai1: 16.2,          // sai do portal do lado de cá
  ufa: 16.5,                       // fecha os olhos um instante: ufa
  quebra: 18.6, fim: 20.0,
};
const X1 = 108;                    // onde ele para do lado de lá (a direita do portal)
const FIM_X = FX + 4 * L + 4;      // onde ele termina (a cena avança a trilha isso)
const LANCA = 0.4;                 // a bola sai da boca 0,4 s depois de ele abrir (atira + LANCA)
const GOLPE = [-0.51, 0.09];       // a janela do golpe em volta do rebate (o impacto cai no meio da descida)

const BIOMAS = {
  netherrack: { bloco: 'netherrack', fogo: 'fogo' },
  almas: { bloco: 'areia_almas', fogo: 'fogo_almas', almas: true },
  basalto: { bloco: 'basalto_lado', cinza: true, magma: true },
};
const NOMES_BIOMAS = Object.keys(BIOMAS);

// ---------- utilidades ----------
const fatia = (t, a, b) => lim((t - a) / (b - a), 0, 1);
// quadro de textura animada (16 x 16·n), o quadro q
function quadroDe(img, q) { const n = Math.max(1, Math.floor(img.height / img.width)); return ((q % n) + n) % n * img.width; }
function bloco(g, nome, x, yBaixo, lado, escala = 1, alfa = 1) {
  const img = IMG[nome];
  if (!img || escala <= 0 || alfa <= 0) return;
  g.save(); g.globalAlpha *= alfa;
  g.translate(x + lado / 2, yBaixo - lado / 2); g.scale(escala, escala);
  g.drawImage(img, 0, 0, 16, 16, -lado / 2, -lado / 2, lado, lado);
  g.restore();
}

// ---------- a trilha (som.js): sons do próprio jogo, que o minecraft.js baixou da Mojang ----------
// cada obsidiana posta, o isqueiro, o zumbido do portal aceso, o "entrar no portal" (trigger) e a
// chegada (travel, só o começo), a música do bioma enquanto está no Nether (um trecho de 11 s), o
// fogo crepitando, o Ghast (gemido ao subir, grito ao cuspir, a explosão e a morte), a bola (o
// sopro), o golpe do Clawd, o XP e a obsidiana quebrando no fim
const S = n => `sons/${n}.wav`, VOLUME = 0.42;  // o nível dos avisos, como o dragão
const MUSICA = { netherrack: 'nether_musica_netherrack', almas: 'nether_musica_almas', basalto: 'nether_musica_basalto' };
// os trechos de 11 s já vêm no mesmo volume (o minecraft.js iguala ao recortar)
const GANHO_MUSICA = { netherrack: 1.3, almas: 1.3, basalto: 1.3 };
function sons(nomeBioma, B) {
  const musica = S(MUSICA[nomeBioma]), gm = GANHO_MUSICA[nomeBioma];
  const L = [
    ...BLOCOS.map((_, i) => [T.poe + i * T.cada + 0.05, S(`nether_pedra${i % 4 + 1}`), 0.55, 0.85 + (i % 3) * 0.08]),
    [T.acende - 0.12, S('nether_isqueiro'), 0.9],
    [T.acende, S('nether_portal'), 0.35, 1, T.chega - T.acende + 0.2],
    // ida: entra (o som de ficar no portal), chega do lado de lá
    [T.chega - 0.25, S('nether_entra'), 0.7, 1.1, T.volta - T.chega + 0.35],
    [T.volta - 0.05, S('nether_viagem'), 0.45, 1, 1.0],
    // a música do bioma, do começo do Nether até a borda voltar (sem baixar: o Ghast é o clima)
    [T.vira0, musica, gm, 1, T.desvira1 - T.vira0 + 0.3],
    // o Ghast: geme ao subir (duas vezes), grita ao cuspir, a bola sopra; o golpe, a explosão e a morte
    [T.ghast0 + 0.15, S('nether_ghast_geme'), 0.8, 1, 0.9],
    [T.ghast0 + 1.25, S('nether_ghast_geme'), 0.7, 0.9, 0.9],
    [T.atira, S('nether_ghast_grita'), 0.85, 1, 1.1],
    [T.atira + LANCA, S('sopro'), 0.8, 1, 1.0],
    [T.rebate - 0.02, S('critico1'), 0.8],
    [T.rebate, S('sopro'), 0.6, 1.25, 0.8],
    [T.acerta, S('nether_explode'), 0.8, 1, 1.4],
    [T.acerta + 0.05, S('nether_ghast_morre'), 0.8, 1, 1.5],
    // o XP chegando no Clawd (o tom sobe, como no jogo)
    ...[0, 1, 2].map(i => [T.acerta + 1.05 + i * 0.09, S(`xp${i + 1}`), 0.55]),
    // volta: entra de novo, chega do lado de cá
    [T.retorna1 - 0.1, S('nether_entra'), 0.65, 1.2, T.reaparece0 - T.retorna1 + 0.3],
    [T.reaparece0 - 0.05, S('nether_viagem'), 0.4, 1.1, 0.9],
    // o portal quebra
    ...[0, 0.06, 0.13].map((d, i) => [T.quebra + d, S(`nether_pedra${i + 1}`), 0.6, 0.75]),
  ];
  // o fogo crepitando o tempo todo do lado de lá
  if (B.fogo) for (let t = T.vira1 - 0.2; t < T.desvira0; t += 1.5) L.push([t, S('nether_fogo'), 0.32, 1, 1.6]);
  // 0,75 (era 1,35, perto do dragão): ~5 dB abaixo; o dono achou alto (26/11)
  return L.map(([t, a, g, ...r]) => [t, a, g * VOLUME * 0.75, ...r]);
}

// ---------- o Ghast e a bola: onde cada um está em cada instante ----------
// tudo em px do palco (x de 0 na esquerda do cartão, y de 0 na borda de cima, pra cima negativo).
// xc: onde o Clawd para (X1 no palco)
function medidasDaCena(P, xc) {
  const med = palco.medidas(P), lado = med.lado;
  const gx = lim(xc + 96, xc + 56, P.cw - lado / 2 - 18);
  const yb = -P.HJ + med.teto + lado + (P.HJ < 110 ? 8 : 24);  // o meio de baixo do corpo, no repouso (abaixo das estalactites)
  const alvo = [xc + 15, -11];                        // o peito do Clawd, onde ele rebate
  return { med, lado, gx, yb, alvo, centro: [gx, yb - lado / 2], bola: Math.round(8 + lado / 8) };
}
// a posição do Ghast em t: sobe de trás do horizonte, flutua, treme quando apanha e some
function ghastEm(t, M) {
  const k = M.lado / 32, flu = Math.sin(t * 1.7) * 2 * k;
  const sobe = sai(fatia(t, T.ghast0, T.ghast1)), partida = -M.med.mar + 10 + M.lado;
  let x = M.gx, y = partida + (M.yb - partida) * sobe + (sobe >= 1 ? flu : flu * sobe);
  // um tranco pra trás ao cuspir (a bola sai) e o tremor de quando apanha
  const cuspe = t >= T.atira + LANCA ? Math.sin(Math.PI * fatia(t, T.atira + LANCA, T.atira + LANCA + 0.3)) : 0;
  x += 3 * k * cuspe;
  const apanha = fatia(t, T.acerta, T.acerta + 0.4);
  if (t >= T.acerta) x += Math.round(Math.sin(t * 70) * 2 * k * (1 - apanha));
  return { x, y, alfa: fatia(t, T.ghast0, T.ghast0 + 0.5) * (1 - fatia(t, T.acerta + 0.2, T.acerta + 0.3)), boca: t >= T.atira && t < T.acerta + 0.2, golpeado: t >= T.acerta ? (1 - fatia(t, T.acerta + 0.03, T.acerta + 0.28)) * 0.5 : 0 };
}
// a bola: cresce na boca, vai até o Clawd (reta com um arco leve) e volta mais rápida pro Ghast
function bolaEm(t, M, G) {
  const tl = T.atira + LANCA;
  if (t < T.atira || t >= T.acerta) return null;
  const mx = G.x, my = G.y - Math.round(M.lado * 0.32);
  if (t < tl) return { x: mx - 2, y: my + 2, lado: Math.max(3, M.bola * fatia(t, T.atira, tl) * 0.7), branca: 0, carga: true };
  if (t < T.rebate) {
    const u = fatia(t, tl, T.rebate);
    return { x: mx + (M.alvo[0] - mx) * u, y: my + (M.alvo[1] - my) * u - 7 * Math.sin(Math.PI * u), lado: M.bola, branca: 0 };
  }
  const v = fatia(t, T.rebate, T.acerta), w = v * v * 0.6 + v * 0.4;
  return { x: M.alvo[0] + (M.centro[0] - M.alvo[0]) * w, y: M.alvo[1] + (M.centro[1] - M.alvo[1]) * w - 5 * Math.sin(Math.PI * v), lado: M.bola + 2, branca: 1 };
}

// ---------- o evento ----------
// ctx.variante (testes: "portal:almas") escolhe o bioma; senão sorteia
function fazer(ctx) {
  const r = rng(131 + (ctx.semente || 0));
  const nomeBioma = BIOMAS[ctx.variante] ? ctx.variante : NOMES_BIOMAS[Math.floor(r() * NOMES_BIOMAS.length) % NOMES_BIOMAS.length];
  const B = BIOMAS[nomeBioma];
  const roxos = [0, 1, 2, 3, 4, 5, 6, 7].map(() => fazPontos(r, 8, ROXOS, 18, 0.9));
  const faiscas = fazPontos(r, 12, ['#FFF3A0', '#FFC23A', '#FF8A1A'], 56, 0.35);
  const poofs = BLOCOS.map(() => fazPoof(r, 5));
  const cacos = fazCacos(r, 20, 70, 3);
  const orbes = fazOrbes(r, 8), fagulhas = fazFaiscas(r, 10, 90);
  return {
    dur: T.fim, danos: [], mortes: [], bioma: nomeBioma, avanca: FIM_X, sons: sons(nomeBioma, B),
    // o fundo (a borda virando Nether) precisa saber onde o portal ficou e em que pé está
    nether(t) {
      const k = t < T.vira0 ? 0 : t < T.vira1 ? sai(fatia(t, T.vira0, T.vira1)) : t < T.desvira0 ? 1 : 1 - sai(fatia(t, T.desvira0, T.desvira1));
      return { k, bioma: nomeBioma, B, portalX: CX };
    },
    quadro(g, t, roupa, mundo) {
      // -- o palco, acima do cartão (no referencial do cartão: o transform do Clawd fica pra depois) --
      if (mundo && mundo.host && mundo.host.cartao) {
        const P = palco.montarPalco(mundo), ab = t < T.fecha0 ? sai(fatia(t, T.abre0, T.abre1)) : 1 - entra(fatia(t, T.fecha0, T.fecha1));
        if (ab > 0) {
          const xc = mundo.pose().x - P.OX + X1, M = medidasDaCena(P, xc), G = ghastEm(t, M), bola = bolaEm(t, M, G), T0 = mundo.T;
          palco.desenhaPalco(g, P, nomeBioma, ab, T0, {
            // por trás do chão: o Ghast subindo do horizonte (a lava e o teto cobrem o que passa deles)
            atras: k => palco.desenhaGhast(k, P, G.x, G.y, { alfa: G.alfa, boca: G.boca, balanco: t, golpeado: G.golpeado }),
            // por cima de tudo: a bola e o rastro, o golpe, a explosão, a fumaça e os orbes
            frente: k => desenhaAcao(k, t, M, G, bola, { orbes, fagulhas }, xc, P),
          });
        }
      }
      // -- o portal: obsidianas, o roxo e a quebra no fim --
      const quebra = fatia(t, T.quebra, T.quebra + 0.3);
      if (t >= T.acende && t < T.quebra + 0.1 && IMG.portal_nether) {
        const a = fatia(t, T.acende, T.acende + 0.25) * (1 - fatia(t, T.quebra - 0.05, T.quebra + 0.1));
        const img = IMG.portal_nether, q = quadroDe(img, Math.floor(t * 20));
        g.save(); g.globalAlpha *= 0.82 * a;
        g.drawImage(img, 0, q, 16, 16, DENTRO[0], DENTRO[1], DENTRO[2], DENTRO[3]);
        g.restore();
        // o roxo soltando pontinhos
        for (let i = 0; i < roxos.length; i++) desenhaPontos(g, roxos[i], CX, -40, 28, 44, ((t - T.acende + i * 0.15) % 0.9));
      }
      BLOCOS.forEach(([x, yb], i) => {
        const t0 = T.poe + i * T.cada;
        if (t < t0) return;
        const brota = sai(fatia(t, t0, t0 + 0.12));
        bloco(g, 'obsidiana', x, yb, L, quebra > 0 ? 1 - quebra : 0.4 + 0.6 * brota);
        desenhaPoof(g, poofs[i], x + L / 2, yb - L / 2, L, L, t - T.quebra);
      });
      desenhaCacos(g, cacos, 'obsidiana', CX, -32, t - T.quebra);
      // faísca do isqueiro
      desenhaPontos(g, faiscas, CX, -14, 10, 8, t - (T.acende - 0.05));

      // -- o Clawd --
      const p = { roupa, T: mundo ? mundo.T : 0 };
      let x = 0, y = 0, alfa = 1, tinta = null, olhos = 'abertos', ferr = null, ang = 0, sx = 1, pose = {};
      const roxo = a => ({ cor: '#B31FE6', a });
      const sobePortal = xx => (xx < FX + 4 * L ? -L : -L * (1 - lim((xx - (FX + 4 * L)) / 4, 0, 1)));  // dentro do portal ele está em cima das obsidianas
      if (t < T.isqueiro) {
        // pondo as obsidianas: o braço vai e volta a cada bloco, com o bloquinho na mão
        const i = Math.floor((t - T.poe) / T.cada);
        if (t >= T.poe && i < BLOCOS.length) {
          const u = ((t - T.poe) % T.cada) / T.cada;
          ang = clawd.golpe(u);
          p.mao = k => { k.save(); k.translate(12, -7.5); k.rotate(ang * Math.PI / 180); if (IMG.obsidiana) k.drawImage(IMG.obsidiana, 0, 0, 16, 16, 2, -9, 5, 5); k.restore(); };
        }
      } else if (t < T.vai) {
        ferr = 'isqueiro';
        ang = t < T.acende ? clawd.golpe(fatia(t, T.isqueiro, T.acende)) : 0;
      } else if (t < T.chega) {
        // anda até o portal e sobe na obsidiana de baixo
        const u = fatia(t, T.vai, T.chega);
        x = CX * u; pose = clawd.andando(t);
        y = pose.y + (x > FX ? -L * lim((x - FX) / L, 0, 1) : 0);
      } else if (t < T.some) {
        x = CX; y = -L; alfa = 1 - fatia(t, T.chega, T.some); tinta = roxo(fatia(t, T.chega, T.some));
      } else if (t < T.volta) {
        alfa = 0;
      } else if (t < T.anda1) {
        x = CX; y = -L; alfa = fatia(t, T.volta, T.saiu); tinta = roxo(1 - fatia(t, T.volta, T.saiu));
      } else if (t < T.anda2) {
        const u = fatia(t, T.anda1, T.anda2);
        x = CX + (X1 - CX) * u; pose = clawd.andando(t);
        y = pose.y + sobePortal(x);
      } else if (t < T.retorna0) {
        // parado em X1, de olho no Ghast: olha pro alto (pisca pra frente), levanta a picareta quando a bola
        // sai, golpeia no rebate, comemora com dois pulinhos quando a bola explode
        x = X1;
        olhos = Math.floor(t / 0.55) % 3 === 2 ? 'abertos' : 'cima';
        const a0 = T.rebate + GOLPE[0], a1 = T.rebate + GOLPE[1];
        if (t >= T.atira + LANCA && t < a0) pose = { ang: -28 * sai(fatia(t, T.atira + LANCA, T.atira + LANCA + 0.25)) };
        else if (t >= a0 && t < a1) { const u = fatia(t, a0, a1); pose = { ang: clawd.golpe(u) }; x = X1 + 4 * Math.sin(Math.PI * u); olhos = 'abertos'; }
        else if (t >= a1) pose = { ang: 70 * (1 - sai(fatia(t, T.acerta, T.acerta + 0.5))) };
        if (t >= T.acerta + 0.15 && t < T.acerta + 0.75) { y = -7 * Math.abs(Math.sin(Math.PI * 2 * fatia(t, T.acerta + 0.15, T.acerta + 0.75))); olhos = 'cima'; }
        if (t >= T.retorna0 - 0.25) sx = -1;
      } else if (t < T.retorna1) {
        // volta andando pro portal (virado pra trás)
        const u = fatia(t, T.retorna0, T.retorna1);
        x = X1 + (CX - X1) * u; sx = -1; pose = clawd.andando(t);
        y = pose.y + sobePortal(x);
      } else if (t < T.entra) {
        x = CX; y = -L; sx = -1; alfa = 1 - fatia(t, T.retorna1, T.entra); tinta = roxo(fatia(t, T.retorna1, T.entra));
      } else if (t < T.reaparece0) {
        alfa = 0;
      } else if (t < T.sai0) {
        x = CX; y = -L; alfa = fatia(t, T.reaparece0, T.reaparece1); tinta = roxo(1 - fatia(t, T.reaparece0, T.reaparece1));
      } else if (t < T.sai1) {
        const u = fatia(t, T.sai0, T.sai1);
        x = CX + (FIM_X - CX) * u; pose = clawd.andando(t);
        y = pose.y + sobePortal(x);
      } else {
        // ufa: fecha os olhos um instante e espera o portal quebrar
        x = FIM_X;
        if (t >= T.ufa && t < T.ufa + 0.5) { olhos = 'fechados'; y = 1; }
      }
      if (alfa > 0) {
        // a ferramenta: o isqueiro na hora de acender, nada (o bloquinho na mão) pondo obsidiana, senão a picareta
        const naMao = ferr || (p.mao ? null : 'picareta'), angulo = ferr || p.mao ? ang : (pose.ang || 0);
        g.save(); g.translate(x, 0);
        clawd.desenhaClawd(g, { ...p, ...pose, x: 0, y, sx, alfa, tinta, olhos, ferr: naMao, ang: angulo });
        g.restore();
      }
    },
  };
}

// a ação do palco, no referencial do palco: a bola, o golpe, a explosão, a fumaça, os orbes
function desenhaAcao(g, t, M, G, bola, P, xc, PP) {
  const { lado } = M;
  if (bola) {
    const rastro = [];
    for (let i = 1; i <= 6; i++) { const b = bolaEm(Math.max(T.atira + LANCA, t - i * 0.03), M, ghastEm(Math.max(T.atira + LANCA, t - i * 0.03), M)); if (b && !b.carga) rastro.push([b.x, b.y]); }
    palco.desenhaBola(g, bola.x, bola.y, t, { lado: bola.lado, branca: bola.branca, rastro: bola.carga ? null : rastro });
  }
  // o golpe: a varrida da picareta e as faíscas no choque, e o clarão da bola mudando de lado
  const dr = t - T.rebate;
  if (dr >= -0.02 && dr < 0.3) {
    desenhaVarrida(g, xc + 14, -13, dr + 0.02, '#FFFFFF', 30);
    g.save(); g.globalCompositeOperation = 'lighter';
    const R = 22, a = 0.7 * (1 - fatia(dr, 0, 0.22)), gr = g.createRadialGradient(M.alvo[0], M.alvo[1], 1, M.alvo[0], M.alvo[1], R);
    gr.addColorStop(0, `rgba(255,240,190,${a.toFixed(3)})`); gr.addColorStop(1, 'rgba(255,200,120,0)');
    g.fillStyle = gr; g.fillRect(M.alvo[0] - R, M.alvo[1] - R, 2 * R, 2 * R);
    g.restore();
    for (const f of P.fagulhas) if (dr >= 0 && dr < f.vida) { g.fillStyle = f.cor; g.fillRect(Math.round(M.alvo[0] + f.vx * dr * 0.5), Math.round(M.alvo[1] + f.vy * dr * 0.5 + 60 * dr * dr), 2, 2); }
  }
  // a explosão no Ghast: clarão, a nuvem de fumaça em blocos e os pedaços; depois os orbes
  const da = t - T.acerta;
  if (da >= 0) {
    const [cx, cy] = M.centro;
    palco.desenhaExplosaoGhast(g, cx, cy, lado, da);
    desenhaOrbes(g, P.orbes, cx, cy, da - 0.3, xc);
  }
}

// ---------- o fundo: a borda do cartão virando Nether ----------
// k (0..1) = quanto já virou: a borda vira de dentro pra fora a partir do portal (só as
// colunas a até k·alcance px do portal, na janela). Blocos de 32 (2 px por pixel da textura),
// como a terra, começando no canto do cartão. Moldura: 8 em cima, 6 dos lados e embaixo.
function ladrilhos(g, img, cx, cy, [x0, y0, x1, y1], q = 0, magma = null) {
  if (!img || x1 <= x0 || y1 <= y0) return;
  for (let tx = cx + 32 * Math.floor((x0 - cx) / 32); tx < x1; tx += 32) {
    for (let ty = cy + 32 * Math.floor((y0 - cy) / 32); ty < y1; ty += 32) {
      const a0 = Math.max(x0, tx), a1 = Math.min(x1, tx + 32), b0 = Math.max(y0, ty), b1 = Math.min(y1, ty + 32);
      if (a1 <= a0 || b1 <= b0) continue;
      // basalto: 1 bloco de magma a cada 3 colunas (a coluna conta a partir do canto)
      const col = Math.round((tx - cx) / 32), usa = magma && ((col % 3) + 3) % 3 === 1 ? magma : img;
      const sq = usa === magma ? quadroDe(magma, q) : 0;
      g.drawImage(usa, (a0 - tx) / 2, sq + (b0 - ty) / 2, (a1 - a0) / 2, (b1 - b0) / 2, a0, b0, a1 - a0, b1 - b0);
    }
  }
}
function fundoNether(g, info, T0) {
  const { k, B, portalJanela, cartao } = info;
  if (!(k > 0) || !cartao) return;
  const [cx, cy, cw, ch] = cartao, alcance = Math.max(portalJanela - cx, cx + cw - portalJanela) + 4, R = k * alcance;
  const l0 = portalJanela - R, l1 = portalJanela + R;
  const corta = ([x0, y0, x1, y1]) => [Math.max(x0, l0), y0, Math.min(x1, l1), y1];
  const tiras = [[cx, cy, cx + cw, cy + 8], [cx, cy + ch - 6, cx + cw, cy + ch], [cx, cy + 8, cx + 6, cy + ch - 6], [cx + cw - 6, cy + 8, cx + cw, cy + ch - 6]];
  const img = IMG[B.bloco], magma = B.magma ? IMG.magma : null, q = Math.floor(T0 * 4);
  for (const tira of tiras) ladrilhos(g, img, cx, cy, corta(tira), q, magma);
  // a frente da onda: um risco roxo onde a borda está virando
  if (k < 1) {
    g.fillStyle = 'rgba(204,51,255,0.85)';
    for (const fx of [l0, l1]) if (fx > cx && fx < cx + cw) { g.fillRect(fx - 1, cy, 2, 8); g.fillRect(fx - 1, cy + ch - 6, 2, 6); }
  }
  // fogos em cima da borda (longe do portal): vermelho no netherrack, azul na soul sand
  const fogo = B.fogo && IMG[B.fogo];
  if (fogo) {
    for (const f of [0.62, 0.84, 0.97]) {
      const fx = cx + cw * f;
      if (fx < l0 || fx > l1 || Math.abs(fx - portalJanela) < 26) continue;
      const qf = quadroDe(fogo, Math.floor(T0 * 16) + Math.round(f * 13));
      g.save(); g.globalAlpha *= Math.min(1, k * 1.5);
      g.drawImage(fogo, 0, qf, 16, 16, fx - 5, cy - 10, 10, 10);
      g.restore();
    }
  }
  // almas subindo (soul sand): pontinhos azul-claros que sobem e somem
  if (B.almas) {
    for (let i = 0; i < 10; i++) {
      const per = 2.2 + (i % 4) * 0.4, u = ((T0 + i * 0.73) % per) / per, x = cx + ((i * 61.7) % cw);
      if (x < l0 || x > l1) continue;
      g.fillStyle = `rgba(120,220,255,${(0.75 * (1 - u) * k).toFixed(3)})`;
      g.fillRect(x + Math.sin((T0 + i) * 3) * 2, cy - 4 - u * 26, 2, 2);
    }
  }
  // cinza caindo (basalto): pontinhos brancos e cinza descendo devagar em volta do cartão
  if (B.cinza) {
    for (let i = 0; i < 28; i++) {
      const per = 5 + (i % 5), u = ((T0 + i * 0.91) % per) / per, x = cx - 10 + ((i * 47.3 + T0 * 4) % (cw + 20));
      if (x < l0 || x > l1) continue;
      g.fillStyle = i % 3 ? `rgba(230,230,230,${(0.7 * k).toFixed(3)})` : `rgba(150,150,150,${(0.7 * k).toFixed(3)})`;
      g.fillRect(x + Math.sin((T0 + i) * 1.3) * 3, cy - 70 + u * 70, i % 4 ? 1.5 : 2, i % 4 ? 1.5 : 2);
    }
  }
}

const TEXTURAS = ['obsidiana', 'portal_nether', 'isqueiro', 'netherrack', 'areia_almas', 'basalto_lado', 'basalto_topo', 'magma', 'fogo', 'fogo_almas', 'ghast', 'ghast_atira', 'lava', 'tijolo_nether', 'glowstone', 'bola_fogo'];

module.exports = {
  // cena épica (especial: fora do sorteio comum; o tema chama a cada PORTAL eventos), só na
  // borda de cima, no comecinho dela: o portal, o palco e o Ghast precisam da reta inteira
  evento: { id: 'portal', grupo: 'nether', raridade: 'raro', especial: true, mortes: 0, soCima: true, espaco: { frente: 140, tras: 0 }, texturas: TEXTURAS, fazer },
  T, FIM_X,
  fundoNether, BIOMAS,
};
