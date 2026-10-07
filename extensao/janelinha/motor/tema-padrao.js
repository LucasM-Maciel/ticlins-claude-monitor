'use strict';
// Tema Padrão: o cartão é o da janelinha (cantos redondos, bolinhas e números dela);
// aqui só o Clawd, sem ferramenta, e as 7 cenas da prévia aprovada (prévia 2, p4.js),
// tudo desenhado aqui, no tamanho de pixel do Clawd. Quando cada uma aparece:
// - pisa no bug, notebook, café, pensando ✻ e lista de tarefas: metade das paradas
//   da caminhada (a cada 20-45 s andando), sorteada entre as 5;
// - dorme: parado (nada rodando) há DORME s; dorme até algo rodar e acorda no lugar;
// - festa: acabou tudo (evento 'tudo');
// - épico: a cada 25 bugs pisados, na próxima parada na reta de cima; Space Invaders e Bug
//   Kaiju se revezam (padrao-epico-<id>.js, se existir).
// Texto (✻, z z z, a lista) é pixel art: o raster não escreve.
const { DEG, sai, arte, rng } = require('./comum');
const { desenhaClawd, andando, pulando } = require('./clawd');

const DORME = 60;          // s parado até dormir (a prévia não diz)
const ACORDA = 0.6;        // s acordando antes de andar: espreguiça 0,3 e fica em pé 0,3 (o fim da cena da prévia)
const ESPERA_FESTA = 2;    // s: o overlay.ps1 manda o 'tudo' antes do estado 'parado' (Avisar vem antes do Clawd)
const SORTEADAS = ['pisa', 'notebook', 'cafe', 'pensando', 'tarefas'];
const PISOU = 1.6;         // s: quando o Clawd pisa no bug (a cena 'pisa')
const EPICO = 25;          // bugs pisados por evento épico (dono 06/10)

// ---------- desenhos ----------
// o bug de hoje, igual ao overlay.ps1 ($desenhos.bug / $coresBug), 1,6 px por pixel
const BUG = ['a............', '.a...vvvvv...', '..a.vwwvvvvv.', '.aaavwvvxvvvv', 'aoaavvvvvxvvv', '.aaaavvvvvxv.', '..pq..pq..pq.', '.p..qp..qp..q'];
const COR_BUG = { v: '#65A30D', w: '#A3E635', x: '#365314', a: '#111827', o: '#F8FAFC', p: '#111827', q: '#111827' };
const COR_BUG_V = { v: '#EF4444', w: '#FCA5A5', x: '#991B1B', a: '#450A0A', o: '#FEE2E2', p: '#450A0A', q: '#450A0A' };
const bugArte = (perna, verm) => arte(BUG.map(l => l.replace(perna === 'p' ? /q/g : /p/g, '.')), verm ? COR_BUG_V : COR_BUG);
// fumaça do bug de hoje: 8 quadradinhos que nascem numa roda, sobem e crescem por 0,6 s
const VOOS = [[-30, -60], [-12, -80], [10, -75], [28, -55], [-22, -30], [20, -35], [0, -90], [34, -20]];
function fumacaBug(g, cx, cy, d) {
  if (d < 0 || d >= 0.6) return;
  g.save(); g.globalAlpha *= 1 - d / 0.6;
  const w = 3 + 5 * d;
  VOOS.forEach(([vx, vy], i) => {
    g.fillStyle = i % 2 ? '#9CA3AF' : '#E5E7EB';
    g.fillRect(cx + vx * (0.06 + d * 0.3) - w / 2, cy + vy * (0.06 + d * 0.2) - 10 * d - w / 2, w, w);
  });
  g.restore();
}
const NOTE_TAMPA = ['cccccccccccccc', 'cssssssssssssc', 'cssssssssssssc', 'cssssssssssssc', 'cssssssssssssc', 'cssssssssssssc', 'cssssssssssssc', 'cssssssssssssc', 'cssssssssssssc', 'cccccccccccccc'];
const NOTE_BASE = ['kkkkkkkkkkkkkkkkkk', '.eeeeeeeeeeeeeeee.'];
const COR_NOTE = { c: '#3F3F46', s: '#0B1220', k: '#A1A1AA', e: '#52525B' };
const CODIGO = [[[0, 3, '#D77757'], [4, 5, '#9CA3AF']], [[2, 4, '#60A5FA'], [7, 3, '#E5E7EB']], [[2, 2, '#22C55E'], [5, 5, '#9CA3AF']], [[0, 2, '#D77757']]];
const CHECK = ['......#', '.....##', '#...##.', '##.##..', '.###...', '..#....'];
const CANECA = ['wcccw..', 'wwwwwhh', 'ooooo.h', 'wwwwwhh', 'wwwww..'];
const COR_CANECA = { w: '#F3F4F6', c: '#5B3A1E', o: '#60A5FA', h: '#D1D5DB' };
const ZS = [['###', '.#.', '###'], ['####', '..#.', '.#..', '####'], ['#####', '...#.', '..#..', '.#...', '#####']];
// o ✻ que gira no terminal do Claude Code: 6 desenhos, ida e volta
const ASTER = [
  ['.......', '.......', '.......', '...#...', '.......', '.......', '.......'],
  ['.......', '...#...', '...#...', '.#####.', '...#...', '...#...', '.......'],
  ['.......', '.#.#.#.', '..###..', '.#####.', '..###..', '.#.#.#.', '.......'],
  ['...#...', '.#.#.#.', '..###..', '#######', '..###..', '.#.#.#.', '...#...'],
  ['#..#..#', '.#.#.#.', '..###..', '###.###', '..###..', '.#.#.#.', '#..#..#'],
  ['.#.#.#.', '##.#.##', '..###..', '###.###', '..###..', '##.#.##', '.#.#.#.'],
];
const SEQ_ASTER = [0, 1, 2, 3, 4, 5, 4, 3, 2, 1];
const LAMPADA = ['.yyy.', 'yWyyy', 'yyyyy', 'yyyyy', '.yyy.', '.ggg.', '..g..'];
const COR_LAMPADA = { y: '#FACC15', W: '#FEF9C3', g: '#9CA3AF' };
const RAIOS = [[-6, -25, 2, 1], [4, -25, 2, 1], [-5, -29, 1, 1], [4, -29, 1, 1], [-0.5, -30, 1, 2]];
const CONFETE = ['#D77757', '#FACC15', '#22C55E', '#60A5FA', '#F472B6', '#E5E7EB'];

// ---------- as cenas ----------
// Cada uma: semente => { dur (s), espaco (px de reta livre na frente/atrás), modos,
// quadro(g, t) } no referencial do Clawd (x+ pra frente, y- pra fora do cartão, chão = 0).
// Tempos da prévia nos comentários; o quadro é função de t (sorteio pela semente).
const FABRICAS = {
  // bug chega 0–1,0 (de 22 px adiante) · agacha 1,0–1,15 · pulo 1,15–1,6 (sobe 16 px) · pisa em 1,6:
  // achata em 0,06 s (vermelho 0,15 s) · quica de volta 1,7–2,15 · fumaça 1,85–2,45 · fim 2,9
  pisa: () => {
    const C = 1.0, PX = 1.6, bw = 13 * PX, bh = 8 * PX, bx0 = 24, alvo = bx0 + 8 * PX, pisou = PISOU;
    const bugs = { p: bugArte('p', false), q: bugArte('q', false), pv: bugArte('p', true), qv: bugArte('q', true) };
    return {
      dur: 2.9, espaco: { frente: 70, tras: 15 },
      quadro(g, t) {
        let bx = t < C ? bx0 + 22 * (1 - t / C) : bx0, sy = 1, perna = Math.floor(t / 0.1) % 2 ? 'q' : 'p', verm = false;
        if (t >= pisou) { sy = Math.max(0.3, 1 - (t - pisou) / 0.06 * 0.7); verm = t - pisou < 0.15; perna = 'p'; }
        if (t >= C && t < pisou) perna = Math.floor(t / 0.25) % 2 ? 'q' : 'p';  // parado, mexendo as pernas
        if (t < 1.85) { g.save(); g.translate(bx, 0); g.scale(1, sy); g.drawImage(bugs[perna + (verm ? 'v' : '')], 0, -bh, bw, bh); g.restore(); }
        fumacaBug(g, bx0 + bw / 2, -3, t - 1.85);
        let p = {};
        if (t >= C && t < 1.15) p = { sy: 1 - 0.15 * Math.sin(Math.PI * (t - C) / 0.15) };
        else if (t >= 1.15 && t < pisou) { const u = (t - 1.15) / (pisou - 1.15); p = { x: alvo * u, y: -11 * u - 16 * Math.sin(Math.PI * u) }; }
        else if (t >= pisou && t < 1.7) { const e = Math.min(1, (t - pisou) / 0.08); p = { x: alvo, y: -11 + 7 * e, sy: 1 - 0.2 * Math.sin(Math.PI * e) }; }
        else if (t >= 1.7 && t < 2.15) { const u = (t - 1.7) / 0.45; p = { x: alvo * (1 - u), y: -4 * (1 - u) - 12 * Math.sin(Math.PI * u) }; }
        else if (t >= 2.15 && t < 2.3) p = { sy: 1 - 0.12 * Math.sin(Math.PI * (t - 2.15) / 0.15) };
        desenhaClawd(g, p);
      },
    };
  },
  // abre 0–0,3 · digita 0,35–2,1 (14 letras/s, braços alternam a cada 0,09) · tela verde + ✓ sobe
  // 12 px 2,15–2,95 · fecha 3,0–3,3 · some 3,3–3,5 · fim 3,7
  notebook: semente => {
    const LX = 13, tampa = arte(NOTE_TAMPA, COR_NOTE), base = arte(NOTE_BASE, COR_NOTE), ok = arte(CHECK, { '#': '#22C55E' });
    const r = rng(semente), teclas = Array.from({ length: 80 }, () => 1 + Math.floor(r() * 16));
    return {
      dur: 3.7, espaco: { frente: 35, tras: 15 },
      quadro(g, t) {
        const abre = t < 0.3 ? t / 0.3 : t < 3.0 ? 1 : Math.max(0, 1 - (t - 3.0) / 0.3);
        const digita = t >= 0.35 && t < 2.1, f = Math.floor(t / 0.09) % 2;
        desenhaClawd(g, digita ? { bracos: [f ? 1.5 : 0, f ? 0 : 1.5] } : {});
        g.save(); g.globalAlpha *= t < 3.3 ? 1 : Math.max(0, 1 - (t - 3.3) / 0.2);
        g.drawImage(base, LX, -2, 18, 2);
        if (digita) { g.fillStyle = '#F4F4F5'; g.fillRect(LX + teclas[Math.floor(t / 0.08) % 80], -2, 1, 1); }
        if (abre > 0) {
          g.save(); g.translate(LX + 2, -2); g.scale(1, abre); g.drawImage(tampa, 0, -10, 14, 10);
          if (abre === 1) {
            let n = Math.max(0, Math.floor((t - 0.35) * 14)), cx = 1, cy = 2;
            CODIGO.forEach((lin, i) => lin.forEach(([x, w, cor]) => {
              const v = Math.min(w, n); n -= v;
              if (v > 0) { g.fillStyle = cor; g.fillRect(1 + x, -10 + 2 + i * 2, v, 1); cx = 1 + x + v; cy = 2 + i * 2; }
            }));
            if (t < 2.15 && Math.floor(t / 0.25) % 2) { g.fillStyle = '#F4F4F5'; g.fillRect(cx, -10 + cy, 1, 1); }  // cursor
            if (t >= 2.15 && t < 2.45) { g.fillStyle = 'rgba(34,197,94,.35)'; g.fillRect(1, -9, 12, 8); }
          }
          g.restore();
        }
        g.restore();
        if (t >= 2.15 && t < 2.95) {
          const u = (t - 2.15) / 0.8;
          g.save(); g.globalAlpha *= u < 0.6 ? 1 : 1 - (u - 0.6) / 0.4;
          g.drawImage(ok, LX + 6, -20 - 12 * sai(u), 7, 6); g.restore();
        }
      },
    };
  },
  // caneca aparece 0–0,25 · fumaça 0,25–1,3 · levanta e inclina -45° 1,3–1,65 · gole 1,65–2,2 (olhos
  // fechados) · abaixa 2,2–2,55 · pulinho 2,55–2,8 · fumaça até 3,5 · caneca some 3,5–3,7 · fim 3,9
  cafe: () => {
    const caneca = arte(CANECA, COR_CANECA);
    return {
      dur: 3.9, espaco: { frente: 25, tras: 15 },
      quadro(g, t) {
        let k = 0;  // 0 = na mão embaixo, 1 = na boca
        if (t >= 1.3 && t < 1.65) k = sai((t - 1.3) / 0.35); else if (t >= 1.65 && t < 2.2) k = 1; else if (t >= 2.2 && t < 2.55) k = 1 - sai((t - 2.2) / 0.35);
        const esc = t < 0.25 ? sai(t / 0.25) : t > 3.5 ? Math.max(0, 1 - (t - 3.5) / 0.2) : 1;
        const mx = 11.5 - 4.5 * k, my = -5.5 - 2.5 * k, giro = -45 * k;
        const pulo = t >= 2.55 && t < 2.8 ? -3 * Math.sin(Math.PI * (t - 2.55) / 0.25) : 0;
        desenhaClawd(g, {
          y: pulo, olhos: t >= 1.5 && t < 2.4 ? 'fechados' : 'abertos',
          mao(g) { if (esc <= 0) return; g.save(); g.translate(mx, my); g.rotate(giro * DEG); g.scale(esc, esc); g.drawImage(caneca, -0.5, -7.5, 10.5, 7.5); g.restore(); },
        });
        if (k < 0.2 && esc === 1) {  // fumacinha do café
          const a0 = g.globalAlpha;
          g.fillStyle = '#E5E7EB';
          for (let j = 0; j < 3; j++) {
            const f = (t * 1.1 + j / 3) % 1;
            g.globalAlpha = a0 * 0.85 * (1 - f);
            g.fillRect(mx + 3.5 + Math.sin(f * 6 + j * 2) * 1.5, my + pulo - 9 - f * 9, 1.5, 1.5);
          }
          g.globalAlpha = a0;
        }
      },
    };
  },
  // asterisco 0–2,4 (6 desenhos, ida e volta, 0,12 s cada; corpo balança ±4°) · lâmpada 2,4–3,2
  // (pulinho 4 px em 0,25 s, raios piscam) · some 3,2–3,4 · fim 3,4
  pensando: () => {
    const ast = ASTER.map(a => arte(a, { '#': '#D77757' })), lamp = arte(LAMPADA, COR_LAMPADA);
    return {
      dur: 3.4, espaco: { frente: 20, tras: 15 },
      quadro(g, t) {
        const ideia = t >= 2.4;
        const pulo = ideia && t < 2.65 ? -4 * Math.sin(Math.PI * (t - 2.4) / 0.25) : 0;
        desenhaClawd(g, { y: pulo, rot: ideia ? 0 : 4 * Math.sin(t * 3.2), olhos: ideia ? 'abertos' : 'cima' });
        if (!ideia) { g.drawImage(ast[SEQ_ASTER[Math.floor(t / 0.12) % SEQ_ASTER.length]], -3.5, -27, 7, 7); return; }
        g.save(); g.globalAlpha *= t < 3.2 ? 1 : Math.max(0, 1 - (t - 3.2) / 0.2);
        g.drawImage(lamp, -2.5, -27 + pulo, 5, 7);
        if (Math.floor(t / 0.15) % 2) {
          g.fillStyle = '#FDE047';
          for (const [x, y, w, h] of RAIOS) g.fillRect(x, y + pulo, w, h);
        }
        g.restore();
      },
    };
  },
  // lista aparece 0–0,25 · itens feitos em 0,7 / 1,25 / 1,8 (pulinho 4 px de 0,25 s em cada) · borda
  // verde 2,2–2,5 · sobe 6 px e some 2,5–2,9 · fim 3,1
  tarefas: () => {
    const marcas = [0.7, 1.25, 1.8], larg = [9, 7, 8];
    return {
      dur: 3.1, espaco: { frente: 35, tras: 15 },
      quadro(g, t) {
        let pulo = 0;
        for (const m of marcas) if (t >= m && t < m + 0.25) pulo = -4 * Math.sin(Math.PI * (t - m) / 0.25);
        desenhaClawd(g, { y: pulo, olhos: 'cima' });
        const esc = t < 0.25 ? sai(t / 0.25) : 1, sobe = t >= 2.5 ? (t - 2.5) / 0.4 : 0;
        if (sobe >= 1 || esc <= 0) return;
        g.save(); g.globalAlpha *= 1 - sobe; g.translate(23, -21 - 6 * sobe); g.scale(esc, esc); g.translate(-9, -7.5);
        g.fillStyle = t >= 2.2 && t < 2.5 ? '#22C55E' : '#52525B'; g.fillRect(0, 0, 18, 15);
        g.fillStyle = '#1F1F23'; g.fillRect(1, 1, 16, 13);
        g.fillStyle = '#D77757'; g.fillRect(1, 1, 16, 1);
        for (let i = 0; i < 3; i++) {
          const y = 3 + 4 * i, feito = t >= marcas[i];
          if (feito) { g.fillStyle = '#22C55E'; g.fillRect(2, y, 3, 3); }
          else { g.fillStyle = '#9CA3AF'; g.fillRect(2, y, 3, 3); g.fillStyle = '#1F1F23'; g.fillRect(3, y + 1, 1, 1); }
          g.fillStyle = feito ? '#52525B' : '#D1D5DB'; g.fillRect(7, y + 1, larg[i], 1);
        }
        g.restore();
      },
    };
  },
  // fecha os olhos 0,25 · senta 0,3–0,6 · dorme até algo rodar (respira a cada 1,6 s) · um z a cada
  // 0,9 s desde 0,8 (sobe 16 px em 1,8 s, cresce 3→4→5 px). O acordar fica no clawd() do tema.
  dorme: () => {
    const zs = ZS.map(z => arte(z, { '#': '#CBD5E1' })), ZP = 1.4;  // 1,4 px por pixel
    return {
      dur: Infinity, modos: ['parado'],
      quadro(g, t) {
        let p;
        if (t < 0.3) p = { olhos: t > 0.25 ? 'fechados' : 'abertos' };
        else if (t < 0.6) p = { olhos: 'fechados', sentado: true, sy: 1 - 0.12 * Math.sin(Math.PI * (t - 0.3) / 0.3) };
        else p = { olhos: 'fechados', sentado: true, sy: 1 + 0.05 * Math.sin(2 * Math.PI * (t - 0.6) / 1.6) };
        desenhaClawd(g, p);
        const a0 = g.globalAlpha;
        // o z número k nasce em 0,8 + 0,9k e vive 1,8 s: só os 2 últimos estão na tela
        for (let k = Math.max(0, Math.floor((t - 2.6) / 0.9)); 0.8 + 0.9 * k <= t; k++) {
          const e = t - (0.8 + 0.9 * k);
          if (e >= 1.8) continue;
          const u = e / 1.8, z = zs[Math.min(2, Math.floor(u * 3))];
          g.globalAlpha = a0 * (u < 0.1 ? u / 0.1 : u > 0.75 ? (1 - u) / 0.25 : 1);
          g.drawImage(z, 6 + 9 * u + Math.sin(u * 7) * 1.2, -12 - 16 * u - z.height * ZP, z.width * ZP, z.height * ZP);
        }
        g.globalAlpha = a0;
      },
    };
  },
  // agacha 0–0,15 · pulo 16 px 0,15–0,6 · confete em 0,4 (28 pedaços, gravidade 140 px/s², somem em
  // 2 s) · pulo 9 px 0,72–1,1 · pulo 5 px 1,2–1,5 · fim 3,0
  festa: semente => {
    const r = rng(semente);
    const conf = Array.from({ length: 28 }, () => ({ vx: (r() - 0.5) * 90, vy: -(45 + r() * 70), cor: CONFETE[Math.floor(r() * 6)], gira: Math.floor(r() * 4), t0: 0.4 + r() * 0.08 }));
    return {
      dur: 3.0, modos: ['parado'],
      quadro(g, t) {
        const pulo = (a, b, h) => -h * Math.sin(Math.PI * (t - a) / (b - a));
        let p = {};
        if (t < 0.15) p = { sy: 1 - 0.15 * Math.sin(Math.PI * t / 0.15) };
        else if (t < 0.6) p = { y: pulo(0.15, 0.6, 16), olhos: 'cima' };
        else if (t < 0.72) p = { sy: 1 - 0.15 * Math.sin(Math.PI * (t - 0.6) / 0.12), olhos: 'cima' };
        else if (t < 1.1) p = { y: pulo(0.72, 1.1, 9), olhos: 'cima' };
        else if (t < 1.2) p = { olhos: 'cima' };
        else if (t < 1.5) p = { y: pulo(1.2, 1.5, 5), olhos: 'cima' };
        desenhaClawd(g, p);
        const a0 = g.globalAlpha;
        for (const c of conf) {
          const e = t - c.t0;
          if (e < 0 || e > 2.0) continue;
          const x = c.vx * e, y = -16 + c.vy * e + 70 * e * e;
          g.globalAlpha = a0 * (e > 1.5 ? (2.0 - e) / 0.5 : 1); g.fillStyle = c.cor;
          if ((Math.floor(e * 10) + c.gira) % 2) g.fillRect(x, y, 2, 1); else g.fillRect(x, y, 1, 2);
        }
        g.globalAlpha = a0;
      },
    };
  },
};

// cada épico mora num arquivo padrao-epico-<id>.js, que pode não existir: carrega na 1ª vez
// que precisa. Eles se revezam na ordem de EPICOS (dono 06/10); o que falta ou quebrou é pulado.
const EPICOS = ['invaders', 'kaiju'];
let epicoModulos = {}, epicoErros = [];
function epico(id) {
  if (!(id in epicoModulos)) {
    const arq = `padrao-epico-${id}`;
    try { epicoModulos[id] = require(`./${arq}`); } catch (e) {
      epicoModulos[id] = null;
      if (!(e.code === 'MODULE_NOT_FOUND' && String(e.message).split('\n')[0].includes(arq))) epicoErros.push(`${arq}.js com defeito: ${e.message}`);
    }
  }
  const d = epicoModulos[id];
  return d && typeof d.cena === 'function' ? d : null;
}
// o da vez: a partir de salvo.epicos (quantos já começaram), o 1º que existe e não quebrou
function epicoDaVez(m) {
  const n = m.salvo.epicos || 0;
  for (let i = 0; i < EPICOS.length; i++) {
    const id = EPICOS[(n + i) % EPICOS.length];
    if (epico(id) && !m.ruins.has(`epico-${id}`)) return id;  // quebrou antes: não volta até reabrir
  }
  return null;
}
function cenaDoEpico(m, id) {
  if (!id || !epico(id)) return null;
  const c = epico(id).cena(m);
  return c ? { ...c, nome: `epico-${id}`, epico: id } : null;
}

function cenaPorNome(m, nome) {
  if (nome === 'epico') return cenaDoEpico(m, epicoDaVez(m));
  if (nome.startsWith('epico-')) return cenaDoEpico(m, nome.slice(6));
  const fazer = FABRICAS[nome];
  return fazer ? { nome, ...fazer(Math.floor(m.sorteio() * 4294967296)) } : null;
}
function festejar(m) {
  if (m.cena) m.fimCena(true);  // o 'tudo' ganha de qualquer cena (até do sono)
  m.comecarCena(cenaPorNome(m, 'festa'));
}

module.exports = {
  layout: { raio: 8, enfeites: false },
  texturas: [],
  trilha: { raio: 8 },
  cenas: [...SORTEADAS, 'dorme', 'festa'],
  cenaPorNome,
  clawd(g, m) {
    const t = m.T, a = m.estado.acordou;
    if (m.andando && a != null && t - a < ACORDA) {  // acordou: espreguiça antes de sair andando
      desenhaClawd(g, { sy: t - a < 0.3 ? 1 + 0.1 * Math.sin(Math.PI * (t - a) / 0.3) : 1 });
      return;
    }
    const p = m.andando ? andando(t) : m.modo === 'pulando' ? pulando(t) : { pernas: 'ambas' };
    desenhaClawd(g, { ...p, ang: 0 });
  },
  passo(m) {
    if (m.modo === 'parado' && !m.cena && m.T - m.desdeModo >= DORME && !m.ruins.has('dorme')) m.comecarCena(cenaPorNome(m, 'dorme'));
  },
  // metade das paradas não tem cena. A escolha fica guardada até a cena começar: sem
  // espaço ali, o Mundo pergunta de novo em 0,5 s e um novo cara-ou-coroa deixaria
  // "nada" mais comum que a metade.
  naParada(m) {
    const e = m.estado;
    // o épico, sem o cara-ou-coroa, só na reta de cima (a cena conta com o Clawd ali)
    if (m.salvo.epico) {
      const id = epicoDaVez(m);
      for (const e of epicoErros.splice(0)) if (m.aoErro) m.aoErro(e);
      if (id) {
        const p = m.pose();
        if (!(p.reta && Math.cos(p.a) > 0.99)) return undefined;
        const c = cenaDoEpico(m, id);
        if (c) return c;
      }
      m.salvo.epico = false; m.salvar();
    }
    if (e.escolhida && m.ruins.has(e.escolhida)) e.escolhida = undefined;
    if (e.escolhida === undefined) {
      const boas = SORTEADAS.filter(n => !m.ruins.has(n));
      e.escolhida = boas.length && m.chance(0.5) ? boas[Math.floor(m.sorteio() * boas.length)] : null;
    }
    if (e.escolhida === null) { e.escolhida = undefined; return null; }
    return cenaPorNome(m, e.escolhida);
  },
  aoComecarCena(m, cena) {
    if (cena.nome === m.estado.escolhida) m.estado.escolhida = undefined;
    // o próximo é o seguinte a este na roda
    if (cena.epico) { m.salvo.epico = false; m.salvo.epicos = EPICOS.indexOf(cena.epico) + 1; m.salvar(); }
  },
  aoFimCena(m, cena, cortada) {
    // épico cortado (pergunta, permissão, tudo pronto) não gasta a vez: o mesmo volta na
    // próxima parada (dono 07/10). Quebrado não volta (m.ruins: o outro faz a vez dele)
    if (cena.epico && cortada && !m.ruins.has(cena.nome)) {
      m.salvo.epico = true; m.salvo.epicos = EPICOS.indexOf(cena.epico); m.salvar();
    }
    // bug pisado (cortada antes da pisada não conta); o 25º pede o épico
    if (cena.nome === 'pisa' && m.T - cena.t0 >= PISOU) {
      const antes = m.salvo.bugs || 0;
      m.salvo.bugs = antes + 1;
      if (Math.floor(m.salvo.bugs / EPICO) > Math.floor(antes / EPICO)) m.salvo.epico = true;
      m.salvar();
    }
    // acordou porque algo começou a rodar: acorda no lugar (meio de cima) e sai andando dali
    if (cena.nome === 'dorme' && m.modo === 'andando') {
      const g = m.geometria();
      m.dist = g.w / 2 - g.r;
      m.estado.acordou = m.T;
    }
  },
  bloqueia(m) { return m.estado.acordou != null && m.T - m.estado.acordou < ACORDA; },
  // o 'tudo' pode chegar antes do estado 'parado' (overlay.ps1) ou depois (já parado)
  aoEvento(m, tipo) {
    if (tipo !== 'tudo') return;
    if (m.modo === 'parado') festejar(m); else m.estado.festa = m.T;
  },
  aoMudarModo(m, antes, agora) {
    const f = m.estado.festa;
    m.estado.festa = null;
    if (agora === 'parado' && f != null && m.T - f <= ESPERA_FESTA) festejar(m);
  },
  animado(m) { return m.modo === 'pulando' || !!m.cena; },
  epicos: EPICOS,
  // pros testes: troca os padrao-epico-<id>.js ({id: módulo}; o que faltar = não existe;
  // undefined = os de verdade)
  trocarEpicos(mapa) {
    epicoModulos = mapa === undefined ? {} : Object.fromEntries(EPICOS.map(id => [id, (mapa || {})[id] || null]));
    epicoErros = [];
  },
};
