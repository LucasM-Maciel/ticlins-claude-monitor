'use strict';
// Tema Dragon Ball (prévia 3, escolhas do dono). O cartão de cantos redondos em cima de uma
// nuvem amarela que respira; a bolinha é uma esfera com halo da cor da situação; a barra do
// usage é de ki; os números, na fonte do visor. O Clawd de gi e cabelo luta com ki nas paradas
// (onda de energia, teletransporte, nuvem, esfera gigante, rastreador) e, 1 em 10 voltas que
// dá no cartão, se transforma por 30 s. Cada sessão que termina dá uma esfera; na 7ª, o
// dragão serpente dá a volta no cartão, para no ar e realiza um pedido do Clawd (4 em rodízio,
// dragonball-pedido.js). A cada 150 voltas, o épico da lua cheia: vira macaco
// dourado gigante e volta no SSJ 4, que fica 2 min (dragonball-epico-ssj4.js). Parado há 1 min:
// medita ou treina, uma vez cada (parado.js). Os desenhos estão em dragonball-*.js.
const { lim, sortearPeso } = require('./comum');
const { registrarRoupas } = require('./clawd');
const A = require('./dragonball-arte');
const K = require('./dragonball-cartao');
const Pd = require('./dragonball-pedido');
const { CENAS } = require('./dragonball-cenas');
const P = require('./parado').paradas('dragonball', ['medita', 'treino']);

const LUTAS = ['onda', 'teleporte', 'nuvem', 'genki', 'rastreador'];
const TRANSF = { chance: 1 / 10, dura: 30 };  // 1 em 10 a cada volta no cartão; fica 30 s (+ a entrada)
const PESOS = Object.fromEntries(A.VARIACOES.map(v => [v.id, 8 - v.forca]));  // as mais fortes mais raras
const ESPERA_DRAGAO = 0.6;  // s entre a 7ª esfera chegar e o dragão sair
const LUA = { voltas: 150, dura: 120 };  // o épico da lua cheia: a cada 150 voltas (dono, 09/10); o SSJ 4 fica 2 min
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
// o dragão: as esferas brilham, ele sai delas, dá a volta no cartão, sobe e para no ar olhando
// pro Clawd, que faz o pedido (o da vez no rodízio, m.salvo.dbPedidos) e ganha; aí ele some num
// brilho. Precisa da janela inteira: desenha em DIPs (setTransform) por cima de tudo.
// A trilha (som.js): o brilho, o trovão e ele saindo com um rugido, o vento da volta (o tamanho
// do cartão muda quanto ela dura), o pedido, o rugido de novo e as esferas se espalhando.
const SD = n => `sons-dragonball/${n}.wav`, VOLUME = 0.5;  // VOLUME: o nível dos avisos (−17 dB)
function sonsDoDragao(dur, qual) {
  const T1 = dur - K.DRAG.fim, TS = T1 - K.DRAG.pedido;
  return [
    [0, SD('shenlong-brilho'), 0.55], [K.DRAG.luz - 0.1, SD('tudo'), 0.7], [K.DRAG.luz, SD('shenlong-sobe'), 0.55], [K.DRAG.luz + 0.05, SD('shenlong-ruge'), 0.8],
    [K.DRAG.luz + 0.3, SD('shenlong-voo'), 0.45, 1, Math.max(0.5, TS - K.DRAG.luz - 0.3)],
    ...Pd.sons(qual).map(([h, a, g, ...r]) => [TS + h, SD(a), g, ...r]),
    [T1, SD('shenlong-ruge'), 0.6, 1.15], [T1, SD('terminou'), 0.6], [T1 + 0.2, SD('shenlong-espalha'), 0.55],
  ].map(([t, a, g, ...r]) => [t, a, g * VOLUME, ...r]);
}
const pedidoDaVez = m => Pd.PEDIDOS[(((Math.floor(Number(m.salvo.dbPedidos)) || 0) % Pd.PEDIDOS.length) + Pd.PEDIDOS.length) % Pd.PEDIDOS.length];
function cenaDragao(m) {
  const dur = K.duracaoDragao(geoCartao(m)), qual = pedidoDaVez(m);
  return {
    nome: 'dragao', pedido: qual, dur, espaco: { frente: 0, tras: 0 }, modos: ['andando', 'parado', 'pulando'], sons: sonsDoDragao(dur, qual),
    quadro(g, t, mm) {
      const e = mm.host.escala || 1, c = mm.host.cartao, G = geoCartao(mm), h = t - K.paraEm(K.caminhoDragao(G));
      const p = mm.pose(), alvo = { x: p.x - c[0] + 15 * Math.sin(p.a), y: p.y - c[1] - 15 * Math.cos(p.a) };  // a cabeça do Clawd
      g.save(); g.setTransform(e, 0, 0, e, 0, 0);
      K.desenhaEsferas(g, c[0], c[1], G, 7, [], mm.T, t);
      K.desenhaDragao(g, c[0], c[1], G, t, { alvo, olho: Pd.olho(h) });
      g.restore();
      // o Clawd na frente do corpo do dragão (que fica deitado na trilha): parado no meio, ele some atrás
      const R = vestir(mm);
      if (h >= 0 && h < K.DRAG.pedido) Pd.clawd(g, qual, h, R, p.a, mm.T);
      else A.clawdDB(g, A.pulando(mm.T, R));
      if (h >= 0) {  // a boca do dragão (20 px à frente da cabeça) e o raio dourado do "infinito"
        const ph = K.cabecaDragao(G, t, alvo), boca = { x: c[0] + ph.x + 20 * Math.cos(ph.a), y: c[1] + ph.y + 20 * Math.sin(ph.a) };
        g.save(); g.setTransform(e, 0, 0, e, 0, 0);
        Pd.janela(g, qual, h, { boca, uso: mm.host.uso, alvo: { x: c[0] + alvo.x, y: c[1] + alvo.y }, e, T: mm.T });
        g.restore();
      }
    },
  };
}
// o épico da lua cheia mora em dragonball-epico-ssj4.js, que pode não existir: carrega na 1ª
// vez que precisa (com defeito: avisa uma vez e o tema segue sem ele)
let luaModulo, luaErro = null;
function epicoLua() {
  if (luaModulo === undefined) {
    try { luaModulo = require('./dragonball-epico-ssj4'); } catch (e) {
      luaModulo = null;
      if (!(e.code === 'MODULE_NOT_FOUND' && String(e.message).split('\n')[0].includes('dragonball-epico-ssj4'))) luaErro = `dragonball-epico-ssj4.js com defeito: ${e.message}`;
    }
  }
  return luaModulo && typeof luaModulo.cena === 'function' ? luaModulo : null;
}
function cenaLua(m) {
  const mod = epicoLua();
  return mod && !m.ruins.has('ssj4') ? { ...mod.cena(m), nome: 'ssj4', epico: true } : null;
}
function cenaPorNome(m, nome, k = 0) {
  if (P.ids.includes(nome)) return P.cena(m, nome);
  if (nome === 'ssj4') return cenaLua(m);
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
  texturas: P.texturas,
  trilha: { raio: 8, baixo: 14 },
  roupas: A.ROUPAS,
  cenas: [...LUTAS, ...A.VARIACOES.map(v => v.id), 'dragao', 'ssj4'],
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
    P.passo(m);
  },

  // -- regras --
  aoDarVolta(m) {
    // conta as voltas (sobrevive a reabrir): a cada 150, o épico da lua fica pendente pra parada
    // seguinte. O sorteio da transformação vem depois, igual (a contagem não mexe nele)
    const n = m.salvo.dbVoltas = (Math.floor(Number(m.salvo.dbVoltas)) || 0) + 1;
    if (n % LUA.voltas === 0) m.salvo.dbLua = true;
    m.salvar();
    if (m.estado.tr || m.cena || !m.chance(TRANSF.chance)) return;
    m.comecarCena(cenaTransf(sortearPeso(PESOS, m.sorteio)));
  },
  aoComecarCena(m, cena) {
    P.aoComecarCena(m, cena);
    if (cena.nome === 'ssj4') { m.salvo.dbLua = false; m.salvar(); m.estado.tr = null; }
    if (cena.nome === 'dragao') { m.salvo.dbPedidos = (Math.floor(Number(m.salvo.dbPedidos)) || 0) + 1; m.salvar(); }  // o próximo pedido
    const v = A.VAR[cena.nome];
    if (v) m.estado.tr = { v, t0: m.T, tv0: null, ate: m.T + v.entrada + TRANSF.dura };
  },
  aoFimCena(m, cena, cortada) {
    P.aoFimCena(m, cena);
    const tr = m.estado.tr;
    if (cortada && tr && cena.nome === tr.v.id) tr.t0 = Math.min(tr.t0, m.T - tr.v.entrada);  // pula o resto da entrada
    if (cortada && cena.andou) m.dist += cena.andou(m.T - cena.t0);  // a nuvem parou no meio da volta: ele fica lá
    // o épico da lua: do clarão em diante ele já é SSJ 4 (2 min); cortado antes (pergunta, o
    // dragão), fica pendente pra próxima parada; quebrado não volta
    if (cena && cena.nome === 'ssj4' && !m.ruins.has('ssj4')) {
      if (m.T - cena.t0 >= (cena.revela ?? cena.dur)) m.estado.tr = { v: A.SSJ4, t0: m.T, tv0: null, ate: m.T + LUA.dura };
      else if (cortada) { m.salvo.dbLua = true; m.salvar(); }
    }
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
    // o épico da lua pendente, sem sorteio: só na reta de cima, andando pra direita (a cena conta
    // com o Clawd ali) e sem transformação (espera ela acabar); até lá tenta de novo a cada 1 s
    if (m.salvo.dbLua) {
      const mod = epicoLua();
      if (luaErro && m.aoErro) { m.aoErro(luaErro); luaErro = null; }
      if (mod && !m.ruins.has('ssj4')) {
        const p = m.pose();
        return p.reta && Math.cos(p.a) > 0.99 && !m.estado.tr ? cenaLua(m) : undefined;
      }
      m.salvo.dbLua = false; m.salvar();
    }
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
      if (u.barra && nivel >= 1 && K.ovoAceso(t + j * 2.5) && !(m.cena && m.cena.nome === 'dragao')) K.ovo(g, e, u.barra[0] + u.barra[2] / 2, u.barra[1] + u.barra[3] / 2);
    });
  },
  atras(g, m) {  // as esferas ganhas, em cima da borda (no dragão, quem desenha é a cena)
    const s = m.estado, c = m.host.cartao;
    if (!s.n || (m.cena && m.cena.nome === 'dragao')) return;
    K.desenhaEsferas(g, c[0], c[1], geoCartao(m), s.n, s.tAdd, m.T, null);
  },
  clawd(g, m) {
    if (P.clawd(g, m)) return;  // a saída da cena de parado
    const R = vestir(m), modo = m.andando ? 'andando' : m.host.modo;
    A.clawdDB(g, modo === 'andando' ? A.andando(m.T, R) : modo === 'pulando' ? A.pulando(m.T, R) : R);
  },
  bloqueia: P.bloqueia,
  voltasPorLua: LUA.voltas,
  duraSSJ4: LUA.dura,
  // pros testes: troca o épico da lua (null = não existe; undefined = o de verdade)
  trocarEpicoLua(mod) { luaModulo = mod; luaErro = null; },
  // parado, só mexe a aura (transformado), o dragão chegando e o "MAIS DE 8000!" (a nuvem
  // respira a 6 quadros/s e o brilho da barra passa devagar: os 5 quadros/s do motor bastam)
  animado(m) {
    if (m.estado.tr || m.estado.dragaoEm != null) return true;
    return (m.host.uso || []).some((u, j) => { const f = (((m.T + j * 2.5) % 5) + 5) % 5; return K.nivelDe(u) >= 1 && (f < 1.5 || f > 4.7); });
  },
};
