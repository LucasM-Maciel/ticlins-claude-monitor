'use strict';
// Tema Dragon Ball (prévia 3, escolhas do dono). O cartão de cantos redondos em cima de uma
// nuvem amarela que respira; a bolinha é uma esfera com halo da cor da situação; a barra do
// usage é de ki; os números, na fonte do visor. O Clawd de gi e cabelo luta com ki nas paradas
// (onda de energia, teletransporte, nuvem, esfera gigante, rastreador) e, 1 em 10 vezes que
// começa a andar, se transforma por 30 s. Cada sessão que termina dá uma esfera; na 7ª, o
// dragão serpente dá a volta no cartão. Os desenhos estão em dragonball-*.js.
const { lim, sortearPeso } = require('./comum');
const { registrarRoupas } = require('./clawd');
const A = require('./dragonball-arte');
const K = require('./dragonball-cartao');
const { CENAS } = require('./dragonball-cenas');

const LUTAS = ['onda', 'teleporte', 'nuvem', 'genki', 'rastreador'];
const TRANSF = { chance: 1 / 10, dura: 30 };  // 1 em 10 ao começar a andar; fica 30 s (+ a entrada)
const PESOS = Object.fromEntries(A.VARIACOES.map(v => [v.id, 8 - v.forca]));  // as mais fortes mais raras
const ESPERA_DRAGAO = 0.6;  // s entre a 7ª esfera chegar e o dragão sair
const COR = { rotulo: '#86EFAC', falta: '#5E8F6E' };  // verdes de visor

// o que o Clawd veste agora: a transformação (entrando, ativa ou voltando) ou nada
function vestir(m) {
  const tr = m.estado.tr, R = { ta: m.T };
  if (!tr) return R;
  return { ...R, ...A.efeitoTransf(tr.v, m.T - tr.t0, tr.tv0 != null ? m.T - tr.tv0 : null, m.T).R };
}
// o cartão pro dragão e as esferas (a trilha desce 14 px por baixo da nuvem)
function geoCartao(m) {
  const c = m.host.cartao, g = m.geometria();
  return { w: c[2], h: c[3], r: g.r, extra: g.h - c[3] };
}

// entrada da transformação: ele para e se transforma (a pose, o clarão e os extras de cada uma).
// Vira o estado m.estado.tr no aoComecarCena; cortada (pergunta), já fica transformado.
function cenaTransf(id) {
  const v = A.VAR[id];
  return {
    nome: id, dur: v.entrada, espaco: { frente: 0, tras: 0 }, modos: ['andando'],
    quadro(g, t, m) {
      const ef = A.efeitoTransf(v, t, null, m.T);
      A.clawdDB(g, { ta: m.T, ...ef.R, ...ef.pose });
      if (ef.extra) ef.extra(g, A.ALTURA);
      if (ef.anel) A.anelClarao(g, ef.anel.u, ef.anel.cor);
    },
  };
}
// o dragão: as esferas brilham, ele sai delas, dá a volta no cartão e some num brilho; o Clawd
// pula de alegria. Precisa da janela inteira: desenha em DIPs (setTransform) por cima de tudo.
function cenaDragao(m) {
  return {
    nome: 'dragao', dur: K.duracaoDragao(geoCartao(m)), espaco: { frente: 0, tras: 0 }, modos: ['andando', 'parado', 'pulando'],
    quadro(g, t, mm) {
      const e = mm.host.escala || 1, c = mm.host.cartao, G = geoCartao(mm);
      g.save(); g.setTransform(e, 0, 0, e, 0, 0); K.desenhaEsferas(g, c[0], c[1], G, 7, [], mm.T, t); g.restore();
      A.clawdDB(g, A.pulando(mm.T, vestir(mm)));
      g.save(); g.setTransform(e, 0, 0, e, 0, 0); K.desenhaDragao(g, c[0], c[1], G, t); g.restore();
    },
  };
}
function cenaPorNome(m, nome, k = 0) {
  if (CENAS[nome]) {
    const c = CENAS[nome](k, m);
    return { nome, modos: ['andando'], ...c, quadro(g, t, mm) { c.quadro.call(this, g, t, vestir(mm), mm); } };
  }
  if (A.VAR[nome]) return cenaTransf(nome);
  if (nome === 'dragao') return cenaDragao(m);
  return null;
}

module.exports = {
  layout: {
    raio: 8, fundo: '#E6181818', moldura: [0, 0, 0, 0], padding: [10, 6, 10, 6], enfeites: true,
    // na fonte do visor (com a sombra): 'agora' 34, '15h47' 35, '2d23h' 35, '100%' 28, '7d' 14
    colunas: { tempo: 36, pct: 38, falta: 48, rotulo: 18 }, letra: 11, barra: [118, 6],
  },
  texturas: [],
  trilha: { raio: 8, baixo: 14 },
  roupas: A.ROUPAS,
  cenas: [...LUTAS, ...A.VARIACOES.map(v => v.id), 'dragao'],
  cenaPorNome,

  iniciar(m) {
    registrarRoupas(A.ROUPAS);
    const n = lim(Math.floor(Number(m.salvo.esferas) || 0), 0, 6);  // as esferas sobrevivem a reabrir
    Object.assign(m.estado, { tr: null, n, tAdd: new Array(n).fill(-9), dragaoEm: null });
  },
  passo(m) {
    const s = m.estado, tr = s.tr;
    if (tr) {  // passados os 30 s, volta ao normal (o cabelo pisca e a aura encolhe)
      if (tr.tv0 == null && m.T >= tr.ate) tr.tv0 = m.T;
      if (tr.tv0 != null && m.T - tr.tv0 >= A.VOLTA) s.tr = null;
    }
    if (s.dragaoEm != null && m.T >= s.dragaoEm && m.modo !== 'oculto') {
      if (m.cena) m.fimCena(true);  // o dragão passa na frente de qualquer cena
      m.comecarCena(cenaDragao(m));
      s.dragaoEm = null; s.n = 0; s.tAdd = [];
    }
  },

  // -- regras --
  aoComecarAndar(m) {
    if (m.estado.tr || m.cena || !m.chance(TRANSF.chance)) return;
    m.comecarCena(cenaTransf(sortearPeso(PESOS, m.sorteio)));
  },
  aoComecarCena(m, cena) {
    const v = A.VAR[cena.nome];
    if (v) m.estado.tr = { v, t0: m.T, tv0: null, ate: m.T + v.entrada + TRANSF.dura };
  },
  aoFimCena(m, cena, cortada) {
    const tr = m.estado.tr;
    if (cortada && tr && cena.nome === tr.v.id) tr.t0 = Math.min(tr.t0, m.T - tr.v.entrada);  // pula o resto da entrada
    if (cortada && cena.andou) m.dist += cena.andou(m.T - cena.t0);  // a nuvem parou no meio da volta: ele fica lá
  },
  // cada sessão que termina dá uma esfera (o "tudo" é a última que terminou); na 7ª, o dragão
  aoEvento(m, tipo) {
    const s = m.estado;
    if ((tipo !== 'terminou' && tipo !== 'tudo') || !m.host.clawd) return;
    if (s.dragaoEm != null || (m.cena && m.cena.nome === 'dragao') || s.n >= 7) return;
    s.tAdd[s.n] = m.T; s.n++;
    if (s.n >= 7) s.dragaoEm = m.T + ESPERA_DRAGAO;
    m.salvo.esferas = s.n >= 7 ? 0 : s.n;
    m.salvar();
  },
  naParada(m) {
    const livres = LUTAS.filter(n => !m.ruins.has(n));
    if (!livres.length) return null;
    return cenaPorNome(m, livres[Math.floor(m.sorteio() * livres.length)], Math.floor(m.sorteio() * 6));
  },

  // -- desenho --
  fundo(g, m) {  // a nuvem e os enfeites, nas caixas que a janelinha mandou
    const h = m.host, e = h.escala || 1, t = m.T;
    if (h.cartao) K.nuvem(g, h.cartao, t);
    for (const l of h.linhas || []) {
      if (l.bola) K.bolinha(g, l, t);
      if (l.tempo) K.escrever(g, e, l.tempo.txt, l.tempo.cor, l.tempo.caixa, true);
    }
    (h.uso || []).forEach((u, j) => {
      const nivel = K.nivelDe(u), cor = K.CORES_BARRA[nivel].txt;
      if (u.rotulo) K.escrever(g, e, u.rotulo.txt, COR.rotulo, u.rotulo.caixa, false);
      if (u.barra) K.barra(g, u.barra, u.pct, nivel, t);
      if (u.pctTxt) K.escrever(g, e, u.pctTxt.txt, cor, u.pctTxt.caixa, true);
      if (u.falta) K.escrever(g, e, u.falta.txt, COR.falta, u.falta.caixa, true);
      if (u.barra && nivel >= 1 && K.ovoAceso(t + j * 2.5)) K.ovo(g, e, u.barra[0] + u.barra[2] / 2, u.barra[1] + u.barra[3] / 2);
    });
  },
  atras(g, m) {  // as esferas ganhas, em cima da borda (no dragão, quem desenha é a cena)
    const s = m.estado, c = m.host.cartao;
    if (!s.n || (m.cena && m.cena.nome === 'dragao')) return;
    K.desenhaEsferas(g, c[0], c[1], geoCartao(m), s.n, s.tAdd, m.T, null);
  },
  clawd(g, m) {
    const R = vestir(m), modo = m.andando ? 'andando' : m.host.modo;
    A.clawdDB(g, modo === 'andando' ? A.andando(m.T, R) : modo === 'pulando' ? A.pulando(m.T, R) : R);
  },
  // parado, só mexe a aura (transformado), o dragão chegando e o "MAIS DE 8000!" (a nuvem
  // respira a 6 quadros/s e o brilho da barra passa devagar: os 5 quadros/s do motor bastam)
  animado(m) {
    if (m.estado.tr || m.estado.dragaoEm != null) return true;
    return (m.host.uso || []).some((u, j) => { const f = (((m.T + j * 2.5) % 5) + 5) % 5; return K.nivelDe(u) >= 1 && (f < 1.5 || f > 4.7); });
  },
};
