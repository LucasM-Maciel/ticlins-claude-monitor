'use strict';
// Tema Sith, parado há muito tempo: o lorde Sith MEDITA FLUTUANDO. Ajoelha (senta), a Força
// acende num brilho vermelho atrás dele e ele sobe uns pixels acima da borda; fica flutuando,
// subindo e descendo devagar, enquanto pedrinhas sobem da borda e giram em volta dele (as de
// trás passam atrás, as da frente na frente). De vez em quando um raio vermelho estala entre
// as mãos. Na saída (algo voltou a rodar) as pedrinhas caem, ele desce, pousa e levanta. No lado
// da luz, o brilho e o estalo são verdes (as cores vêm de A.COR).
// Tudo função do tempo: os sorteios vêm da semente da cena (m.estado.sithSemente, pra saída).
const { sai, entra, rng, arte } = require('./comum');
const A = require('./sith-arte');

const { fatia } = A;
const suave = u => u * u * (3 - 2 * u);
const T = { senta: 0.4, sentou: 0.6, forca0: 0.7, forca1: 1.8, sobe0: 1.2, sobe1: 2.6, pedras: 2.0 };
const ALTO = 5, BOIA = 2, RESPIRA = 4.4, GIRO = 0.55;  // px, px, s, rad/s
const RAIO = { janela: 9, dur: 0.35 };  // um estalo a cada janela de 9 s, em lugar sorteado

const pedraArte = [['.ll.', 'lbbc', 'bbcd', '.dd.'], ['.lll.', 'lbbbc', 'bbbcd', '.ddd.'], ['ll.', 'lbc', 'cdd'], ['lb', 'bd']]
  .map(l => arte(l, { l: '#A8A29E', b: '#78716C', c: '#57534E', d: '#3F3A36' }));

function pedras(sem) {
  const r = rng(sem);
  return Array.from({ length: 5 }, (_, i) => ({
    img: pedraArte[Math.floor(r() * pedraArte.length)], fase: (i / 5) * Math.PI * 2 + r() * 0.4,
    rx: 22 + r() * 8, alt: 12 + r() * 10, sobe: T.pedras + i * 0.25,
  }));
}
// altura dele acima da borda e a força (0..1) no instante t
function estado(t) {
  const alt = ALTO * suave(fatia(t, T.sobe0, T.sobe1)) + (t > T.sobe1 ? BOIA * (1 - Math.cos(2 * Math.PI * (t - T.sobe1) / RESPIRA)) / 2 : 0);
  const forca = fatia(t, T.forca0, T.forca1) * (t > T.forca1 ? 0.85 + 0.15 * Math.sin(t * 2) : 1);
  return { alt, forca, sentado: t >= T.sentou };
}
// onde está cada pedrinha (x, y, atrás?) em t; d = 0..1 o quanto já caiu (saída)
function posPedra(p, t, cai = 0) {
  if (t < p.sobe) return null;
  const a = p.fase + GIRO * (t - p.sobe), sobe = sai(fatia(t, p.sobe, p.sobe + 1.2));
  const y = -(p.alt + 1.5 * Math.sin(t * 1.7 + p.fase)) * sobe * (1 - entra(cai));
  return { x: Math.cos(a) * p.rx * sobe, y, atras: Math.sin(a) < 0 };
}
function desenhaPedras(g, lista, t, atras, cai = 0, alfa = 1) {
  g.save(); g.globalAlpha *= alfa;
  for (const p of lista) {
    const q = posPedra(p, t, cai);
    if (!q || q.atras !== atras) continue;
    g.drawImage(p.img, Math.round(q.x / A.P) * A.P - p.img.width * A.P / 2, Math.round(q.y / A.P) * A.P - p.img.height * A.P, p.img.width * A.P, p.img.height * A.P);
  }
  g.restore();
}
// o estalo vermelho entre as mãos (raio em zigue-zague), uma vez por janela
function raio(g, t, sem, alt) {
  if (t < T.sobe1) return;
  const k = Math.floor((t - T.sobe1) / RAIO.janela), r = rng((sem + k * 7919) >>> 0), ini = 2 + r() * (RAIO.janela - 3);
  const d = t - T.sobe1 - k * RAIO.janela - ini;
  if (d < 0 || d > RAIO.dur) return;
  const rr = rng((sem + k * 104729 + Math.floor(d * 30)) >>> 0);
  g.save(); g.globalAlpha *= 1 - d / RAIO.dur;
  let x = -12, y = -8 - alt;
  for (let i = 0; i < 8; i++) {
    const nx = x + 3, ny = -8 - alt + (rr() - 0.5) * 6;
    g.fillStyle = i % 2 ? A.COR.palida : A.COR.lamina;
    g.fillRect(Math.min(x, nx), Math.min(y, ny), 1.2, Math.abs(ny - y) + 1);
    x = nx; y = ny;
  }
  g.restore();
}
function clawdMeditando(g, t, s) {
  A.clawdSith(g, {
    T: t, y: -s.alt, sentado: s.sentado, sabre: null, aura: s.forca, vento: 0,
    sy: t >= T.senta && t < T.sentou ? 1 - 0.15 * Math.sin(Math.PI * fatia(t, T.senta, T.sentou)) : 1,
  });
}

module.exports = {
  texturas: [],
  linhaDoTempo: [
    [0, 'em pé, sabre no cinto'], [T.senta, 'ajoelha'], [T.forca0, 'a Força acende (brilho vermelho)'],
    [T.sobe0, `sobe devagar até ${ALTO} px acima da borda`], [T.pedras, 'pedrinhas sobem da borda e giram em volta dele'],
    [T.sobe1, `flutua: sobe e desce ${BOIA} px a cada ${RESPIRA} s; um raio vermelho estala entre as mãos a cada ~${RAIO.janela} s`],
  ],
  cena(m) {
    const sem = Math.floor(m.sorteio() * 4294967296);
    m.estado.sithSemente = sem;
    const lista = pedras(sem);
    return {
      nome: 'parado', dur: Infinity, espaco: { frente: 0, tras: 0 }, modos: ['parado'],
      quadro(g, t) {
        const s = estado(t);
        A.acimaDoCartao(g, () => {
          desenhaPedras(g, lista, t, true);
          clawdMeditando(g, t, s);
          raio(g, t, sem, s.alt);
          desenhaPedras(g, lista, t, false);
        });
      },
    };
  },
  // algo voltou a rodar: as pedrinhas caem, a Força apaga, ele desce, pousa e levanta (1 s)
  saida: {
    dur: 1.0,
    quadro(g, u, m, tCorte) { A.acimaDoCartao(g, () => this.desenha(g, u, m, tCorte)); },
    desenha(g, u, m, tCorte) {
      const sem = m.estado.sithSemente >>> 0, c = Math.max(0, tCorte || 0), lista = pedras(sem), s0 = estado(c);
      const cai = fatia(u, 0, 0.35);
      desenhaPedras(g, lista, c, true, cai, 1 - fatia(u, 0.35, 0.5));
      if (u >= 0.75 || c < T.senta) A.clawdSith(g, { T: m.T, sabre: null });
      else {
        const v = fatia(u, 0, 0.45), alt = s0.alt * (1 - suave(v)), sentado = s0.sentado && u < 0.55;
        const sy = u >= 0.55 ? 1 + 0.07 * Math.sin(Math.PI * fatia(u, 0.55, 0.75)) : 1;
        A.clawdSith(g, { T: m.T, y: -alt, sentado, sabre: null, aura: s0.forca * (1 - v), sy });
      }
      desenhaPedras(g, lista, c, false, cai, 1 - fatia(u, 0.35, 0.5));
    },
  },
};
