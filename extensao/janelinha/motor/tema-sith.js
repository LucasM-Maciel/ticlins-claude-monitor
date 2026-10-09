'use strict';
// Tema Sith (PR #3 do gjthec, 09/10/2026; acertado com os outros temas). O Clawd de lorde Sith: elmo, máscara,
// painel no peito, capa e sabre vermelho. Andando, o sabre fica aceso; parado, o cabo vai pro
// cinto; pergunta/permissão, pula com o sabre erguido. O cartão é um painel imperial: bolinha =
// cristal kyber, barra do usage = sabre que muda de cor com o gasto (violeta, roxo, magenta,
// carmim, vermelho; instável a partir de 80%), números na fonte de visor.
// Nas paradas da caminhada: rebate tiros de blaster, corta um droide ao meio, esgana um droide
// com a Força ou só respira fundo. Acabou tudo: a nave triangular passa num painel acima do
// cartão e salta pro hiperespaço (sem trilha: o aviso já toca). A cada 30 droides destruídos,
// o épico raro, a batalha da frota, com som (sith-epico.js). Parado há 1 min, uma vez cada:
// medita flutuando, com a Força levantando pedrinhas (parado-sith-medita.js), ou monta um
// sabre no ar com a Força (parado-sith-forja.js). Os desenhos estão em sith-*.js.
const { DEG, lim, sai, entra, rng, rgba } = require('./comum');
const A = require('./sith-arte');
const K = require('./sith-cartao');
const P = require('./parado').paradas('sith', ['medita', 'forja']);

const { fatia } = A;
const SORTEADAS = ['deflete', 'droide', 'esgana', 'respira'];
const CHANCE = 0.6;  // das paradas da caminhada, quantas têm cena
const MORTE = { droide: 1.75, esgana: 2.5 };  // s: quando o droide da cena é destruído
const DROIDES = 30;  // droides destruídos por épico (dono, 09/10): ~30/h andando = 1 a cada ~1 h
const COR = { rotulo: '#9CA3AF', falta: '#6B7280' };

// ---------- as cenas da caminhada ----------
// Cada uma: semente => { dur, espaco, quadro(g, t, m) } no referencial do Clawd.
const FABRICAS = {
  // três tiros chegam pela frente; ele gira o sabre e rebate cada um pra cima (faíscas na batida);
  // no fim, uma volta do sabre. Tiros em 0,5 / 1,2 / 1,8 (0,35 s voando) · volta 2,3–2,7 · fim 3,0
  deflete: semente => {
    const BATE = [0.85, 1.55, 2.15], VOO = 0.35, ALVO = [16, -15];
    const r = rng(semente), alturas = BATE.map(() => -9 - r() * 8), saidas = BATE.map(() => -50 - r() * 40);
    return {
      dur: 3.0, espaco: { frente: 80, tras: 15 },
      quadro(g, t, m) {
        let ang = 25, recuo = 0;
        for (const b of BATE) {
          const d = t - b;
          if (d > -0.18 && d < 0.12) ang = d < 0 ? 25 - 55 * sai((d + 0.18) / 0.18) : -30 + 55 * (d / 0.12);
          if (d >= 0 && d < 0.15) recuo = -1.5 * Math.sin(Math.PI * d / 0.15);
        }
        if (t >= 2.3 && t < 2.7) ang = 25 + 360 * sai((t - 2.3) / 0.4);
        A.clawdSith(g, { T: m.T, x: recuo, sabre: { ang, len: 1 }, vento: 0.4 });
        BATE.forEach((b, i) => {
          const d = t - (b - VOO);
          if (d < 0) return;
          if (d < VOO) {  // voando até o sabre
            const u = d / VOO, x = 110 - (110 - ALVO[0]) * u, y = alturas[i] + (ALVO[1] - alturas[i]) * u;
            A.tiro(g, x, y, Math.atan2(ALVO[1] - alturas[i], ALVO[0] - 110) + Math.PI);
          } else if (d < VOO + 0.45) {  // rebatido, subindo e sumindo
            const e = d - VOO, a = saidas[i] * DEG;
            g.save(); g.globalAlpha *= 1 - e / 0.45;
            A.tiro(g, ALVO[0] + Math.cos(a) * 170 * e, ALVO[1] + Math.sin(a) * 170 * e, a);
            g.restore();
          }
          A.faiscas(g, ALVO[0], ALVO[1], d - VOO, semente + i);
        });
      },
    };
  },
  // um droide chega flutuando; ele ergue o sabre e corta de cima pra baixo: as metades caem
  // soltando faísca e fumaça. Chega 0–1,2 · ergue 1,35–1,6 · corta 1,7–1,8 · cai 1,8–2,5 · some 2,7–3,0
  droide: semente => {
    const r = rng(semente), lado = r() < 0.5 ? -1 : 1, X = 26, Y = -17;
    return {
      dur: 3.4, espaco: { frente: 70, tras: 15 },
      quadro(g, t, m) {
        let ang = 30;
        if (t >= 1.35 && t < 1.6) ang = 30 - 95 * sai((t - 1.35) / 0.25);
        else if (t >= 1.6 && t < 1.7) ang = -65;
        else if (t >= 1.7 && t < 1.8) ang = -65 + 185 * ((t - 1.7) / 0.1);
        else if (t >= 1.8 && t < 2.6) ang = 120 - 90 * sai((t - 1.8) / 0.8);
        A.clawdSith(g, { T: m.T, x: t >= 1.65 && t < 1.85 ? 3 : 0, sabre: { ang, len: 1 }, vento: 0.3 });
        const img = A.droide(), w = img.width * A.P, h = img.height * A.P;
        if (t < 1.75) {
          const x = t < 1.2 ? X + 60 * (1 - sai(t / 1.2)) : X, y = Y + 1.5 * Math.sin(t * 5);
          g.drawImage(img, x - w / 2, y - h / 2, w, h);
          return;
        }
        const d = t - 1.75, some = 1 - fatia(t, 2.7, 3.0);
        g.save(); g.globalAlpha *= some;
        const cima = A.droideMetade(true), baixo = A.droideMetade(false);
        const yc = Math.min(0, Y - 6 + (-30 * d + 140 * d * d)), xc = X + 18 * d * lado;
        const yb = Math.min(0, Y + 1 + 80 * d * d), xb = X - 6 * d * lado;
        g.save(); g.translate(xc, yc); g.rotate(d * 6 * lado * (yc < 0 ? 1 : 0)); g.drawImage(cima, -w / 2, -cima.height * A.P, w, cima.height * A.P); g.restore();
        g.drawImage(baixo, xb - w / 2, yb - baixo.height * A.P, w, baixo.height * A.P);
        g.restore();
        A.faiscas(g, X, Y, d, semente, 10);
        A.fumaca(g, X, Y + 2, d - 0.05);
        A.fumaca(g, xb, -2, d - 0.6);
      },
    };
  },
  // um droide chega; ele apaga o sabre, ergue a mão e a Força levanta o droide, que treme, é
  // esmagado e estoura. Chega 0–1,0 · apaga 0,8–1,0 · sobe 1,1–1,6 · treme 1,6–2,4 · amassa
  // 2,0–2,5 · estoura 2,5 · cai 2,5–3,1 · acende o sabre 3,0–3,3 · fim 3,6
  esgana: semente => {
    const X = 30;
    return {
      dur: 3.6, espaco: { frente: 70, tras: 15 },
      quadro(g, t, m) {
        const len = t < 1.0 ? 1 - fatia(t, 0.8, 1.0) : fatia(t, 3.0, 3.3);
        const mao = t >= 1.0 && t < 2.9;
        const forca = fatia(t, 1.0, 1.3) * (1 - fatia(t, 2.5, 2.9));
        A.clawdSith(g, {
          T: m.T, bracos: mao ? [0, -3] : null, aura: forca * 0.6, vento: 0.2,
          sabre: { ang: mao ? 160 : 30, len },
        });
        const img = A.droide(), w = img.width * A.P, h = img.height * A.P;
        if (t < 2.5) {
          const chega = t < 1.0 ? 50 * (1 - sai(t)) : 0;
          const y = -16 - 14 * sai(fatia(t, 1.1, 1.6)) + (t < 1.1 ? 1.5 * Math.sin(t * 5) : 0);
          const tre = t >= 1.6 ? Math.sin(t * 60) * 1.2 : 0, aperta = 1 - 0.45 * entra(fatia(t, 2.0, 2.5));
          const cx = X + chega + tre, cy = y;
          if (forca > 0) {
            g.save(); g.globalCompositeOperation = 'lighter';
            const gr = g.createRadialGradient(cx, cy, 2, cx, cy, 13);
            gr.addColorStop(0, rgba(A.SITH.forca, 0.55 * forca)); gr.addColorStop(1, rgba(A.SITH.forca, 0));
            g.fillStyle = gr; g.fillRect(cx - 13, cy - 13, 26, 26); g.restore();
          }
          g.save(); g.translate(cx, cy); g.scale(aperta, 1 + (1 - aperta) * 0.3); g.drawImage(img, -w / 2, -h / 2, w, h); g.restore();
          if (forca > 0 && Math.floor(t * 12) % 3 === 0) {  // o fio da Força entre a mão e o droide
            g.fillStyle = rgba(A.SITH.forca, 0.5 * forca);
            for (let i = 1; i < 6; i++) g.fillRect(12 + (cx - 12) * i / 6, -9 + (cy + 9) * i / 6, 1, 1);
          }
          return;
        }
        const d = t - 2.5, r = rng(semente);
        A.faiscas(g, X, -30, d, semente, 14, ['#FDE68A', '#EF4444', '#FECACA']);
        A.fumaca(g, X, -28, d, 1.0);
        g.save(); g.globalAlpha *= 1 - fatia(d, 0.6, 1.0);
        for (let i = 0; i < 5; i++) {  // os pedaços caindo
          const vx = (r() - 0.5) * 50, vy = -20 - r() * 25;
          const x = X + vx * d, y = Math.min(0, -30 + vy * d + 160 * d * d);
          g.fillStyle = i % 2 ? '#6B7280' : '#9CA3AF'; g.fillRect(x, y - 2, 2, 2);
        }
        g.restore();
      },
    };
  },
  // para, apaga o sabre e respira fundo (a cabeça sobe e desce, as luzinhas do peito piscam, o
  // ar sai da grade em fumacinha). Apaga 0–0,25 · respira 0,3–2,2 · acende 2,3–2,6 · fim 2,7
  respira: () => ({
    dur: 2.7, espaco: { frente: 20, tras: 15 },
    quadro(g, t, m) {
      const len = 1 - fatia(t, 0, 0.25) + fatia(t, 2.3, 2.6), ciclo = fatia(t, 0.3, 2.2);
      const peito = Math.sin(ciclo * Math.PI * 2) * 0.6;
      A.clawdSith(g, {
        T: m.T, sy: 1 + 0.03 * peito, vento: 0.1, sabre: { ang: 150, len },
        extra(k, dy) {  // as luzinhas do painel piscando por cima
          const f = Math.floor(t * 6);
          const L = A.ALTURA, y8 = (8 - L) * A.P + dy, y9 = (9 - L) * A.P + dy;
          k.fillStyle = f % 2 ? A.SITH.verm : '#7F1D1D'; k.fillRect(-4.5, y8, A.P, A.P);
          k.fillStyle = f % 3 ? A.SITH.verde : '#14532D'; k.fillRect(-3, y9, A.P, A.P);
          k.fillStyle = f % 4 < 2 ? A.SITH.azul : '#1E3A8A'; k.fillRect(-1.5, y8, A.P, A.P);
        },
      });
      for (const b of [0.75, 1.7]) {  // o ar saindo da grade
        const d = t - b;
        if (d < 0 || d > 0.7) continue;
        g.save(); g.globalAlpha *= 0.6 * (1 - d / 0.7);
        g.fillStyle = '#D1D5DB';
        for (let i = 0; i < 3; i++) g.fillRect(2 + 10 * d + i * 2, -11 - 6 * d - i, 1.5 + d * 2, 1.5 + d * 2);
        g.restore();
      }
    },
  }),
};

// ---------- acabou tudo: a nave salta pro hiperespaço ----------
// Um painel escuro abre acima do cartão com estrelas; a nave triangular entra pela direita,
// carrega, as estrelas esticam em riscos e ela some num clarão; os riscos voltam a ser estrelas e
// o painel fecha. O Clawd fica com o sabre erguido. Janela inteira: desenha em DIPs. Sem trilha:
// o aviso 'tudo' já toca (som de cena é só do épico, como nos outros temas).
// Abre 0–0,35 · nave 0,4–2,3 · estica 2,3–2,7 · salta 2,7–2,85 · clarão 2,85–3,3 · volta 3,3–4,6
// · fecha 4,8–5,3
const HIPER = { dur: 5.4, alt: 100, folga: 38 };
function painelDoSalto(m) {
  const c = m.host.cartao, x = c[0], w = c[2], h = HIPER.alt, y = Math.max(4, c[1] - HIPER.folga - h);
  return { x, y, w, h };
}
function desenhaSalto(g, R, t, semente) {
  const abre = t < 0.35 ? sai(t / 0.35) : t > 4.8 ? 1 - fatia(t, 4.8, 5.3) : 1;
  if (abre <= 0) return;
  const hh = R.h * abre, y0 = R.y + (R.h - hh) / 2, cx = R.x + R.w / 2, cy = R.y + R.h / 2;
  g.save();
  g.fillStyle = 'rgba(5,6,10,0.92)'; g.fillRect(R.x, y0, R.w, hh);
  g.fillStyle = '#B91C1C';
  g.fillRect(R.x, y0, R.w, 1); g.fillRect(R.x, y0 + hh - 1, R.w, 1); g.fillRect(R.x, y0, 1, hh); g.fillRect(R.x + R.w - 1, y0, 1, hh);
  g.beginPath(); g.rect(R.x + 1, y0 + 1, R.w - 2, hh - 2); g.clip();
  // estrelas: esticam em riscos saindo do centro durante o salto
  const estica = t < 2.3 ? 0 : t < 2.85 ? entra(fatia(t, 2.3, 2.85)) * 2.5 : 2.5 * (1 - sai(fatia(t, 3.0, 4.6)));
  const r = rng(semente);
  for (let i = 0; i < 46; i++) {
    const sx = (r() - 0.5) * R.w, sy = (r() - 0.5) * R.h, brilho = 0.5 + 0.5 * Math.sin(t * 3 + i);
    if (estica < 0.05) {
      g.fillStyle = rgba('#E5E7EB', 0.4 + 0.5 * brilho); g.fillRect(Math.round(cx + sx), Math.round(cy + sy), 1, 1);
      continue;
    }
    const n = Math.ceil(6 * estica);
    for (let k = 0; k <= n; k++) {
      const f = 1 + estica * k / n;
      g.fillStyle = rgba(k === n ? '#FFFFFF' : '#93C5FD', 0.25 + 0.6 * k / n);
      g.fillRect(cx + sx * f, cy + sy * f, 1, 1);
    }
  }
  // a nave: entra, treme carregando e dispara pra esquerda esticada
  if (t >= 0.4 && t < 2.85) {
    const img = A.nave(R.w * 0.5), w = img.width, h = img.height;
    let x = cx + R.w * 0.55 - R.w * 0.62 * sai(fatia(t, 0.4, 2.3)), sx = 1;
    let y = cy - h / 2 + Math.sin(t * 2) * 1.5;
    if (t >= 2.3) { x += Math.sin(t * 70) * 0.8; y += Math.cos(t * 63) * 0.5; }
    if (t >= 2.7) { const u = entra(fatia(t, 2.7, 2.85)); x -= R.w * 1.2 * u; sx = 1 + 3 * u; }
    g.save(); g.translate(x, y); g.scale(sx, 1); g.drawImage(img, -w / 2, 0); g.restore();
  }
  if (t >= 2.8 && t < 3.3) {  // o clarão
    g.fillStyle = rgba('#FFFFFF', 0.85 * (1 - fatia(t, 2.8, 3.3))); g.fillRect(R.x, y0, R.w, hh);
  }
  g.restore();
}
function cenaSalto(m) {
  const semente = Math.floor(m.sorteio() * 4294967296);
  return {
    nome: 'hiperespaco', dur: HIPER.dur, espaco: { frente: 0, tras: 0 }, modos: ['andando', 'parado', 'pulando'],
    quadro(g, t, mm) {
      const e = mm.host.escala || 1;
      g.save(); g.setTransform(e, 0, 0, e, 0, 0); desenhaSalto(g, painelDoSalto(mm), t, semente); g.restore();
      const bob = t < 2.7 ? 0 : -3 * Math.sin(Math.PI * fatia(t, 2.7, 3.1));  // pulinho no salto
      A.clawdSith(g, { T: mm.T, y: bob, sabre: { ang: -4 + 3 * Math.sin(t * 2), len: fatia(t, 0, 0.3) }, vento: 0.5 });
    },
  };
}

// o épico mora no sith-epico.js, que pode não existir: carrega na 1ª vez que precisa
let epicoModulo, epicoErro = null;
function epico() {
  if (epicoModulo === undefined) {
    try { epicoModulo = require('./sith-epico'); } catch (e) {
      epicoModulo = null;
      if (!(e.code === 'MODULE_NOT_FOUND' && String(e.message).split('\n')[0].includes('sith-epico'))) epicoErro = `sith-epico.js com defeito: ${e.message}`;
    }
  }
  return epicoModulo && typeof epicoModulo.cena === 'function' ? epicoModulo : null;
}
function cenaDoEpico(m) {
  const c = epico() && !m.ruins.has('epico') ? epico().cena(m) : null;
  return c ? { ...c, nome: 'epico', epico: true } : null;
}

function cenaPorNome(m, nome) {
  if (P.ids.includes(nome)) return P.cena(m, nome);
  if (nome === 'hiperespaco') return cenaSalto(m);
  if (nome === 'epico') return cenaDoEpico(m);
  const fazer = FABRICAS[nome];
  return fazer ? { nome, ...fazer(Math.floor(m.sorteio() * 4294967296)) } : null;
}

module.exports = {
  layout: {
    raio: 6, fundo: '#EE0B0C10', moldura: [3, 3, 3, 3], padding: [10, 6, 10, 6], enfeites: true,
    colunas: { tempo: 36, pct: 38, falta: 48, rotulo: 18 }, letra: 11, barra: [118, 6],
  },
  texturas: P.texturas,
  trilha: { raio: 6 },
  cenas: [...SORTEADAS, ...P.ids, 'hiperespaco'],
  cenaPorNome,

  iniciar(m) { Object.assign(m.estado, { acende: -9 }); },
  passo(m) { P.passo(m); },
  // o sabre acende quando começa a andar (depois da saída da meditação, se tiver)
  aoComecarAndar(m) { m.estado.acende = m.T + (m.estado.saida && m.estado.saida.t0 === m.T ? 1.0 : 0); },
  naParada(m) {
    // o épico, sem o cara-ou-coroa, só na reta de cima (a cena conta com o Clawd ali)
    if (m.salvo.sithEpico) {
      const c = cenaDoEpico(m);
      if (epicoErro && m.aoErro) { m.aoErro(epicoErro); epicoErro = null; }
      if (c) {
        const p = m.pose();
        return p.reta && Math.cos(p.a) > 0.99 ? c : undefined;
      }
      m.salvo.sithEpico = false; m.salvar();
    }
    const boas = SORTEADAS.filter(n => !m.ruins.has(n));
    if (!boas.length || !m.chance(CHANCE)) return null;
    return cenaPorNome(m, boas[Math.floor(m.sorteio() * boas.length)]);
  },
  aoComecarCena(m, cena) {
    P.aoComecarCena(m, cena);
    if (cena.epico) { m.salvo.sithEpico = false; m.salvar(); }
  },
  aoFimCena(m, cena, cortada) {
    P.aoFimCena(m, cena, cortada);
    // épico cortado (pergunta, permissão, tudo pronto) não gasta a vez; quebrado não volta
    if (cena.epico && cortada && !m.ruins.has(cena.nome)) { m.salvo.sithEpico = true; m.salvar(); }
    // droide destruído (cortada antes do golpe não conta); o 30º pede o épico
    if (MORTE[cena.nome] != null && m.T - cena.t0 >= MORTE[cena.nome]) {
      const antes = m.salvo.droides || 0;
      m.salvo.droides = antes + 1;
      if (Math.floor(m.salvo.droides / DROIDES) > Math.floor(antes / DROIDES)) m.salvo.sithEpico = true;
      m.salvar();
    }
  },
  bloqueia: P.bloqueia,
  // acabou tudo: o salto pro hiperespaço passa na frente de qualquer cena, menos do épico (que
  // já tem o salto dele; o aviso toca por cima, como nos outros temas)
  aoEvento(m, tipo) {
    if (tipo !== 'tudo' || !m.host.clawd || m.modo === 'oculto') return;
    if (m.cena && (m.cena.nome === 'hiperespaco' || m.cena.epico)) return;
    if (m.cena) m.fimCena(true);
    m.comecarCena(cenaSalto(m));
  },

  // -- desenho --
  fundo(g, m) {  // a moldura e os enfeites, nas caixas que a janelinha mandou
    const h = m.host, e = h.escala || 1, t = m.T;
    if (h.cartao) K.moldura(g, h.cartao, t);
    for (const l of h.linhas || []) {
      if (l.bola) K.kyber(g, l, t);
      if (l.tempo) K.escrever(g, e, l.tempo.txt, l.tempo.cor, l.tempo.caixa, true);
    }
    for (const u of h.uso || []) {
      const nivel = K.nivelDe(u);
      if (u.rotulo) K.escrever(g, e, u.rotulo.txt, COR.rotulo, u.rotulo.caixa, false);
      if (u.barra) K.barra(g, u.barra, u.pct, nivel, t);
      if (u.pctTxt) K.escrever(g, e, u.pctTxt.txt, K.corDoPct(u.pct, nivel), u.pctTxt.caixa, true);
      if (u.falta) K.escrever(g, e, u.falta.txt, COR.falta, u.falta.caixa, true);
    }
  },
  clawd(g, m) {
    if (P.clawd(g, m)) return;  // a saída da meditação
    const t = m.T, modo = m.andando ? 'andando' : m.host.modo;
    if (modo === 'andando') {
      const len = lim((t - m.estado.acende) / 0.3, 0, 1), p = A.andando(t);
      A.clawdSith(g, { ...p, sabre: { ...p.sabre, len } });
    } else if (modo === 'pulando') A.clawdSith(g, A.pulando(t));
    else A.clawdSith(g, { T: t, pernas: 'ambas', sabre: null, vento: 0 });
  },
  // parado mexe a moldura (devagar) e as barras do usage quando estão instáveis
  animado(m) {
    if (m.modo === 'pulando' || m.cena) return true;
    return (m.host.uso || []).some(u => K.nivelDe(u) >= 1);
  },
  droidesPorEpico: DROIDES,
  // pros testes: troca o sith-epico.js (null = não existe; undefined = o de verdade)
  trocarEpico(mod) { epicoModulo = mod; epicoErro = null; },
};
