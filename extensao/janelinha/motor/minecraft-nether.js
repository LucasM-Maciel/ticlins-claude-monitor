'use strict';
// Cena do portal do Nether (tema Minecraft). Só no começo da borda de CIMA do cartão: a cena
// precisa da reta inteira na frente (o mob vem da outra ponta) e de altura pro portal.
//  1. o Clawd põe 10 obsidianas (o portal 4x5 sem os cantos) e acende com o isqueiro;
//  2. anda até o portal, some no roxo e a borda do cartão vira Nether a partir do portal:
//     netherrack (fogo vermelho), soul sand (fogo azul e almas subindo) ou basalto (blocos de
//     magma no meio e cinza caindo, como nos Basalt Deltas), sorteado;
//  3. sai do portal do lado de lá, olha em volta; um mob do bioma vem da outra ponta da borda
//     (netherrack: piglin zumbi; soul sand: esqueleto; basalto: magma cube pulando);
//  4. o Clawd leva um susto, corre de volta pro portal, a borda volta a ser terra e grama,
//     ele sai do lado de cá, o portal quebra e ele segue andando dali (avanca).
// Quadro = função do tempo (referencial do Clawd: x+ pra frente, y- pra fora do cartão, chão 0).
// A borda virando Nether é desenhada no fundo (fundoNether, coordenadas da janela) pelo
// tema-minecraft.js, por cima da borda de terra e por baixo do Clawd.
const { lim, sai, rng, IMG, arte, tingida } = require('./comum');
const clawd = require('./clawd');
const { MOB, desenhaMob, fazPoof, desenhaPoof, fazPontos, desenhaPontos, ROXOS, fazCacos, desenhaCacos } = require('./minecraft-kit');

const L = 8;                       // lado do bloco de obsidiana (px)
const FX = 30;                     // a coluna de fora do portal, à esquerda (px na frente do Clawd)
const CX = FX + 2 * L;             // o meio do portal (46)
const DENTRO = [FX + L, -4 * L, 2 * L, 3 * L];  // o vão do portal [x, y, w, h]: 16 x 24
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
  volta: 6.6, saiu: 7.0,           // aparece do lado de lá
  anda1: 7.05, anda2: 7.65,        // sai do portal e para (X1), olha em volta
  explora0: 8.9, explora1: 9.5,    // anda mais um pouco (X2) e fica olhando pros lados
  mob0: 9.6, mob1: 13.4,           // o mob vem devagar da outra ponta (ele não vê: está virado)
  susto: 12.6, corre0: 13.1, corre1: 13.8, entra: 14.2,
  desvira0: 14.1, desvira1: 15.0,  // a borda volta a ser terra
  reaparece0: 14.9, reaparece1: 15.3,
  sai0: 15.6, sai1: 16.2,          // sai do portal do lado de cá
  ufa: 16.5,                       // fecha os olhos um instante: ufa
  quebra: 18.6, fim: 20.0,
};
const X1 = 72, X2 = 92;            // as duas paradas do lado de lá
const FIM_X = 66;                  // onde ele termina (a cena avança a trilha isso)

const BIOMAS = {
  netherrack: { bloco: 'netherrack', fogo: 'fogo', mob: 'piglin' },
  almas: { bloco: 'areia_almas', fogo: 'fogo_almas', mob: 'esqueleto', almas: true },
  basalto: { bloco: 'basalto_lado', mob: 'magma', cinza: true, magma: true },
};
const NOMES_BIOMAS = Object.keys(BIOMAS);

// magma cube (8x8): fatias pretas e vermelhas com a lava entre elas, olhos laranja
const MAGMA = arte([
  'kkkkkkkk',
  'yoyooyoy',
  'kRkkkkRk',
  'kOOkkOOk',
  'oyooyooy',
  'kkRkkRkk',
  'yoyyooyo',
  'kkkkkkkk',
], { k: '#2A0A06', R: '#4A120A', o: '#E05A0A', y: '#FFC23A', O: '#FF8A1A' });

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
// o "!" do susto, em cima da cabeça
function exclamacao(g, x, y, alfa) {
  if (alfa <= 0) return;
  g.save(); g.globalAlpha *= alfa;
  g.fillStyle = '#3A0000'; g.fillRect(x - 2, y - 11, 4, 8); g.fillRect(x - 2, y - 2, 4, 4);
  g.fillStyle = '#FF5555'; g.fillRect(x - 1, y - 10, 2, 6); g.fillRect(x - 1, y - 1, 2, 2);
  g.restore();
}

// ---------- a trilha (som.js): sons do próprio jogo, que o minecraft.js baixou da Mojang ----------
// cada obsidiana posta, o isqueiro, o zumbido do portal aceso, o "entrar no portal" (trigger) e a
// chegada (travel, só o começo), a música do bioma enquanto está no Nether (um trecho de 7 s), o
// fogo crepitando, o mob (grunhido do piglin, o esqueleto, os pulos do magma cube), o susto (o
// som de clima tenso do bioma) e a obsidiana quebrando no fim
const S = n => `sons/${n}.wav`, VOLUME = 0.42;  // o nível dos avisos, como o dragão
const MUSICA = { netherrack: 'nether_musica_netherrack', almas: 'nether_musica_almas', basalto: 'nether_musica_basalto' };
// os trechos de 11 s já vêm no mesmo volume (o minecraft.js iguala ao recortar)
const GANHO_MUSICA = { netherrack: 1.3, almas: 1.3, basalto: 1.3 };
const PAN = 1.6;   // s que a música fica baixa no susto
function sons(nomeBioma, B) {
  const musica = S(MUSICA[nomeBioma]), gm = GANHO_MUSICA[nomeBioma], antes = T.susto - T.vira0;
  const L = [
    ...BLOCOS.map((_, i) => [T.poe + i * T.cada + 0.05, S(`nether_pedra${i % 4 + 1}`), 0.55, 0.85 + (i % 3) * 0.08]),
    [T.acende - 0.12, S('nether_isqueiro'), 0.9],
    [T.acende, S('nether_portal'), 0.35, 1, T.chega - T.acende + 0.2],
    // ida: entra (o som de ficar no portal), chega do lado de lá
    [T.chega - 0.25, S('nether_entra'), 0.7, 1.1, T.volta - T.chega + 0.35],
    [T.volta - 0.05, S('nether_viagem'), 0.45, 1, 1.0],
    // a música do bioma: normal; 1 s antes do susto ela baixa (o silêncio tenso), fica baixa
    // enquanto o PAN soa, e volta quando ele foge
    [T.vira0, musica, gm, 1, antes - 1.0 + 0.1],
    [T.susto - 1.0, musica, gm * 0.25, 1, 1.0 + 0.1, antes - 1.0],
    [T.susto, musica, gm * 0.3, 1, PAN, antes],
    [T.susto + PAN, musica, gm, 1, T.desvira1 - T.susto - PAN + 0.3, antes + PAN],
    // o susto: o PAN (a morte do enderman, que já começa forte) e o clima tenso do bioma por baixo
    [T.susto - 0.03, S('nether_pan'), 1.25, 1, 1.6],
    [T.susto + 0.05, S(`nether_susto_${nomeBioma}`), 0.9, 1, 2.6],
    // volta: entra de novo, chega do lado de cá
    [T.corre1 - 0.1, S('nether_entra'), 0.65, 1.2, T.reaparece0 - T.corre1 + 0.3],
    [T.reaparece0 - 0.05, S('nether_viagem'), 0.4, 1.1, 0.9],
    // o portal quebra
    ...[0, 0.06, 0.13].map((d, i) => [T.quebra + d, S(`nether_pedra${i + 1}`), 0.6, 0.75]),
  ];
  // o fogo crepitando o tempo todo do lado de lá
  // (menos no silêncio antes do susto e durante o PAN)
  if (B.fogo) for (let t = T.vira1 - 0.2; t < T.desvira0; t += 1.5) {
    if (t + 1.6 > T.susto - 1.0 && t < T.susto + PAN) continue;
    L.push([t, S('nether_fogo'), 0.32, 1, 1.6]);
  }
  // o mob: de vez em quando enquanto vem, e no susto (o piglin bravo)
  // (o do meio antes do silêncio que vem 1 s antes do susto)
  if (B.mob === 'piglin') L.push([T.mob0 + 0.2, S('nether_piglin1'), 0.6], [T.mob0 + 1.3, S('nether_piglin1'), 0.6, 0.92, 0.6], [T.susto + 0.15, S('nether_piglin2'), 0.85]);
  if (B.mob === 'esqueleto') L.push([T.mob0 + 0.2, S('nether_esqueleto'), 0.6], [T.mob0 + 1.3, S('nether_esqueleto'), 0.6, 0.95], [T.susto + 0.2, S('nether_esqueleto'), 0.8, 1.15]);
  if (B.mob === 'magma') {
    // cada vez que ele cai do pulo (o mesmo ritmo do desenho: 1,6 pulos por s, cai em 0,7 da volta)
    for (let k = Math.ceil(T.mob0 * 1.6 - 0.7); (k + 0.7) / 1.6 < T.desvira0; k++) {
      const t = (k + 0.7) / 1.6;
      if (t >= T.mob0 + 0.1) L.push([t, S(`nether_magma${k % 2 + 1}`), 0.6]);
    }
  }
  return L.map(([t, a, g, ...r]) => [t, a, g * VOLUME * 1.35, ...r]);  // 1,35: perto do volume do dragão
}

// ---------- o evento ----------
// ctx.variante (testes: "portal:almas") escolhe o bioma; senão sorteia. ctx.falta: quanto
// de reta tinha na frente quando a cena começou (o mob nasce lá na ponta)
function fazer(ctx) {
  const r = rng(131 + (ctx.semente || 0));
  const nomeBioma = BIOMAS[ctx.variante] ? ctx.variante : NOMES_BIOMAS[Math.floor(r() * NOMES_BIOMAS.length) % NOMES_BIOMAS.length];
  const B = BIOMAS[nomeBioma];
  const roxos = [0, 1, 2, 3, 4, 5].map(() => fazPontos(r, 8, ROXOS, 10, 0.9));
  const faiscas = fazPontos(r, 10, ['#FFF3A0', '#FFC23A', '#FF8A1A'], 40, 0.35);
  const poofs = BLOCOS.map(() => fazPoof(r, 5));
  const cacos = fazCacos(r, 16, 60, 2);
  return {
    dur: T.fim, danos: [], mortes: [], bioma: nomeBioma, avanca: FIM_X, sons: sons(nomeBioma, B),
    // o fundo (a borda virando Nether) precisa saber onde o portal ficou e em que pé está
    nether(t) {
      const k = t < T.vira0 ? 0 : t < T.vira1 ? sai(fatia(t, T.vira0, T.vira1)) : t < T.desvira0 ? 1 : 1 - sai(fatia(t, T.desvira0, T.desvira1));
      return { k, bioma: nomeBioma, B, portalX: CX };
    },
    quadro(g, t, roupa, mundo) {
      const falta = mundo ? mundo.pose().falta : 160;
      // -- o portal: obsidianas, o roxo e a quebra no fim --
      const quebra = fatia(t, T.quebra, T.quebra + 0.3);
      if (t >= T.acende && t < T.quebra + 0.1 && IMG.portal_nether) {
        const a = fatia(t, T.acende, T.acende + 0.25) * (1 - fatia(t, T.quebra - 0.05, T.quebra + 0.1));
        const img = IMG.portal_nether, q = quadroDe(img, Math.floor(t * 20));
        g.save(); g.globalAlpha *= 0.82 * a;
        g.drawImage(img, 0, q, 16, 16, DENTRO[0], DENTRO[1], DENTRO[2], DENTRO[3]);
        g.restore();
        // o roxo soltando pontinhos
        for (let i = 0; i < roxos.length; i++) desenhaPontos(g, roxos[i], CX, -20, 14, 22, ((t - T.acende + i * 0.15) % 0.9));
      }
      BLOCOS.forEach(([x, yb], i) => {
        const t0 = T.poe + i * T.cada;
        if (t < t0) return;
        const brota = sai(fatia(t, t0, t0 + 0.12));
        bloco(g, 'obsidiana', x, yb, L, quebra > 0 ? 1 - quebra : 0.4 + 0.6 * brota);
        desenhaPoof(g, poofs[i], x + L / 2, yb - L / 2, L, L, t - T.quebra);
      });
      desenhaCacos(g, cacos, 'obsidiana', CX, -16, t - T.quebra);
      // faísca do isqueiro
      desenhaPontos(g, faiscas, CX, -10, 6, 4, t - (T.acende - 0.05));

      // -- o mob (só do lado de lá: aparece quando ele já saiu, some quando a borda volta) --
      if (t >= T.mob0 && t < T.desvira0 + 0.35) {
        // nasce na ponta da reta, chega perto (X2 + 30) e, quando ele foge, vai atrás até o portal
        const x0 = lim(falta - 10, X2 + 56, 300), x1 = X2 + 30, xParado = CX + 34;
        const u = fatia(t, T.mob0, T.mob1);
        let x = x0 + (x1 - x0) * u;
        if (t > T.mob1) x = x1 + (xParado - x1) * sai(fatia(t, T.mob1, T.desvira0));
        const alfa = fatia(t, T.mob0, T.mob0 + 0.3) * (1 - fatia(t, T.desvira0, T.desvira0 + 0.3));
        const anda = t < T.desvira0;
        if (B.mob === 'magma') {
          // pula: sobe 7 px, amassa ao cair
          const p = (t * 1.6) % 1, alto = Math.sin(Math.PI * Math.min(1, p / 0.7)) * (p < 0.7 ? 7 : 0), amassa = p >= 0.7 ? 1 - 0.25 * Math.sin(Math.PI * (p - 0.7) / 0.3) : 1;
          g.save(); g.globalAlpha *= alfa; g.translate(x, -alto); g.scale(1 / amassa, amassa);
          g.drawImage(MAGMA, -6, -12, 12, 12);
          g.restore();
        } else {
          const m = B.mob === 'piglin' ? MOB.piglinZumbi : MOB.esqueleto;
          desenhaMob(g, m, x, 0, { quadro: anda ? Math.floor(t / 0.2) % 2 : 0, alfa });
        }
      }

      // -- o Clawd --
      const p = { roupa, T: mundo ? mundo.T : 0 };
      let x = 0, y = 0, alfa = 1, tinta = null, olhos = 'abertos', ferr = null, ang = 0, sx = 1, pose = {};
      const roxo = a => ({ cor: '#B31FE6', a });
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
        y = pose.y + (x < FX + 4 * L ? -L : -L * (1 - lim((x - (FX + 4 * L)) / 4, 0, 1)));
      } else if (t < T.explora0) {
        // 1ª parada: olha pra frente e pra trás, olhos piscando
        x = X1;
        sx = Math.floor((t - T.anda2) / 0.6) % 2 ? -1 : 1;
        olhos = Math.floor(t / 0.45) % 2 ? 'abertos' : 'cima';
      } else if (t < T.explora1) {
        const u = fatia(t, T.explora0, T.explora1);
        x = X1 + (X2 - X1) * u; pose = clawd.andando(t);
      } else if (t < T.susto) {
        // 2ª parada: olhando pros lados (quase sempre pra trás, pro portal): não vê o mob chegando
        x = X2;
        sx = t >= T.susto - 0.7 || Math.floor((t - T.explora1) / 0.9) % 2 === 0 ? -1 : 1;
        olhos = Math.floor(t / 0.5) % 2 ? 'abertos' : 'cima';
      } else if (t < T.corre0) {
        // vira pra frente, dá de cara com o mob: pula e arregala
        x = X2;
        y = -6 * Math.sin(Math.PI * fatia(t, T.susto, T.susto + 0.3)); olhos = 'cima';
      } else if (t < T.corre1) {
        // corre de volta (virado pra trás)
        const u = fatia(t, T.corre0, T.corre1);
        x = X2 + (CX - X2) * u; sx = -1; pose = clawd.andando(t * 1.6);
        y = pose.y + (x < FX + 4 * L ? -L : 0);
        olhos = 'cima';
      } else if (t < T.entra) {
        x = CX; y = -L; sx = -1; alfa = 1 - fatia(t, T.corre1, T.entra); tinta = roxo(fatia(t, T.corre1, T.entra));
      } else if (t < T.reaparece0) {
        alfa = 0;
      } else if (t < T.sai0) {
        x = CX; y = -L; alfa = fatia(t, T.reaparece0, T.reaparece1); tinta = roxo(1 - fatia(t, T.reaparece0, T.reaparece1));
      } else if (t < T.sai1) {
        const u = fatia(t, T.sai0, T.sai1);
        x = CX + (FIM_X - CX) * u; pose = clawd.andando(t);
        y = pose.y + (x < FX + 4 * L ? -L : -L * (1 - lim((x - (FX + 4 * L)) / 4, 0, 1)));
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
      exclamacao(g, X2, -24, t >= T.susto && t < T.corre0 + 0.1 ? 1 : 0);
    },
  };
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

const TEXTURAS = ['obsidiana', 'portal_nether', 'isqueiro', 'netherrack', 'areia_almas', 'basalto_lado', 'magma', 'fogo', 'fogo_almas', 'piglin_zumbi', 'esqueleto'];

module.exports = {
  // cena épica (especial: fora do sorteio comum; o tema chama a cada PORTAL eventos), só na
  // borda de cima, no comecinho dela: o mob precisa da reta inteira pra vir
  evento: { id: 'portal', grupo: 'nether', raridade: 'raro', especial: true, mortes: 0, soCima: true, espaco: { frente: 140, tras: 0 }, texturas: TEXTURAS, fazer },
  T,
  fundoNether, BIOMAS,
};
