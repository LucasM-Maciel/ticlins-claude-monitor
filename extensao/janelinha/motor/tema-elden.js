'use strict';
// Tema Elden Ring (venceu a votação de 07/10 junto com o Akatsuki; dono, 13/10 e 21/10). O Clawd é um Maculado:
// elmo cinza com os olhos amarelos, capa e espada (o Cavaleiro), ou o Bandido de capuz com a adaga, ou o Feiticeiro
// de chapéu pontudo com o cajado. A roupa é sorteada a CADA VOLTA andada no cartão. O cartão tem borda de ouro com
// losangos, bolinha em losango, barra dourada (âmbar a partir de 80%, vermelha a partir de 95%) e a Árvore Dourada
// brilhando atrás. Nas paradas da caminhada, 4 cenas: o inimigo abatido (bug ou inimigo do jogo) com as runas voando pro
// contador, a mensagem no chão (pula e cai), o baú mímico e VOCÊ MORREU (volta na luz dourada). Acabou tudo: LOCAL DE
// GRAÇA DESCOBERTO. A cada 30 inimigos abatidos, o épico raro, com som: a luta de chefe (elden-epico.js), um chefe do jogo
// por vez, em rodízio: Margit, Godrick, Malenia, Radahn. Parado há 1 min, uma vez cada: descansa na graça
// (parado-elden-graca.js) ou faz carinho no Torrent (parado-elden-torrent.js). Um lado só (dono, 21/10).
const { desenharRitmo } = require('./comum');
const A = require('./elden-arte');
const K = require('./elden-cartao');
const C = require('./elden-cenas');
const P = require('./parado').paradas('elden', ['graca', 'torrent']);

const CHANCE = 0.6;  // das paradas da caminhada, quantas têm cena
const INIMIGOS = 30;  // inimigos abatidos por épico (como o Sith e o Akatsuki: ~1 por hora andando)
const CHEFES = ['margit', 'godrick', 'malenia', 'radahn', 'lendario'];  // o 5º: o evento lendário, Radagon e a Besta Prístina

// ---------- a roupa da vez: sorteada a cada volta, sempre diferente da anterior ----------
const roupaValida = r => A.ROUPAS.ROUPAS[r] != null;
const roupaDe = m => (roupaValida(m.salvo.eldenRoupa) ? m.salvo.eldenRoupa : A.ROUPAS.LISTA[0]);
function sortearRoupa(m) {
  const outras = A.ROUPAS.LISTA.filter(r => r !== roupaDe(m));
  return outras[Math.floor(m.sorteio() * outras.length)];
}

// ---------- os épicos: carrega na 1ª vez que precisa (elden-epico.js pode não existir ainda) ----------
let epicoModulo;
let epicoErro = null;
function epico() {
  if (epicoModulo === undefined) {
    try { epicoModulo = require('./elden-epico'); } catch (e) {
      epicoModulo = null;
      if (!(e.code === 'MODULE_NOT_FOUND' && String(e.message).split('\n')[0].includes('elden-epico'))) epicoErro = `elden-epico.js com defeito: ${e.message}`;
    }
  }
  return epicoModulo && typeof epicoModulo.cena === 'function' ? epicoModulo : null;
}
let lendarioModulo;
function lendario() {  // o 5º épico (elden-lendario.js), em cima do motor do épico
  if (lendarioModulo === undefined) {
    try { lendarioModulo = require('./elden-lendario'); } catch (e) { lendarioModulo = null; epicoErro = `elden-lendario.js com defeito: ${e.message}`; }
  }
  return lendarioModulo;
}
function cenaDoEpico(m) {
  const mod = epico();
  if (!mod || m.ruins.has('epico')) return null;
  const lend = CHEFES[(m.salvo.eldenChefe || 0) % CHEFES.length] === 'lendario' && lendario();
  const c = (lend && lend.cena(m)) || mod.cena(m);  // o lendário com defeito: a luta de sempre no lugar
  return c ? { ...c, nome: 'epico', epico: true } : null;
}

function cenaPorNome(m, nome) {
  if (P.ids.includes(nome)) return P.cena(m, nome);
  if (nome === 'graca-descoberta') return C.cenaGraca(m);
  if (nome === 'epico') return cenaDoEpico(m);
  const fazer = C.FABRICAS[nome];
  return fazer ? { nome, ...fazer(Math.floor(m.sorteio() * 4294967296)) } : null;
}

// a moldura e o brilho andam com a janelinha mexendo: alguém trabalhando, uma cena ou o pulo
function emMovimento(m) {
  return m.modo === 'pulando' || !!m.cena || (m.host.linhas || []).some(l => l.sit === 'working');
}

module.exports = {
  layout: {
    raio: 6, fundo: '#EE0D0A06', moldura: [3, 3, 3, 3], padding: [10, 6, 10, 6], enfeites: true,
    colunas: { tempo: 36, pct: 38, falta: 48, rotulo: 18 }, letra: 11, barra: [118, 5],
  },
  texturas: P.texturas,
  trilha: { raio: 6 },
  cenas: [...C.SORTEADAS, ...P.ids, 'graca-descoberta'],
  cenaPorNome,

  iniciar(m) { if (!roupaValida(m.salvo.eldenRoupa)) m.salvo.eldenRoupa = A.ROUPAS.LISTA[Math.floor(m.sorteio() * A.ROUPAS.LISTA.length)]; },
  passo(m) { P.passo(m); },
  // a cada volta inteira andada: roupa nova (sorteada, diferente da anterior)
  aoDarVolta(m) {
    m.salvo.eldenVoltas = (m.salvo.eldenVoltas || 0) + 1;
    m.salvo.eldenRoupa = sortearRoupa(m);
    m.salvar();
  },
  naParada(m) {
    // o épico, sem o cara-ou-coroa, só na reta de cima (a cena conta com o Clawd ali)
    if (m.salvo.eldenEpico) {
      const c = cenaDoEpico(m);
      if (epicoErro && m.aoErro) { m.aoErro(epicoErro); epicoErro = null; }
      if (c) {
        const p = m.pose();
        return p.reta && Math.cos(p.a) > 0.99 ? c : undefined;
      }
      m.salvo.eldenEpico = false; m.salvar();
    }
    const boas = C.SORTEADAS.filter(n => !m.ruins.has(n));
    if (!boas.length || !m.chance(CHANCE)) return null;
    return cenaPorNome(m, boas[Math.floor(m.sorteio() * boas.length)]);
  },
  aoComecarCena(m, cena) {
    P.aoComecarCena(m, cena);
    if (cena.epico) { m.salvo.eldenEpico = false; m.salvar(); }
  },
  aoFimCena(m, cena, cortada) {
    P.aoFimCena(m, cena, cortada);
    if (!cena) return;
    const dt = m.T - cena.t0;
    if (cena.epico) {
      // cortado (pergunta, permissão, tudo pronto) não gasta a vez; quebrado não volta; terminou: o próximo chefe
      if (cortada && !m.ruins.has(cena.nome)) { m.salvo.eldenEpico = true; m.salvar(); }
      else if (!cortada) { m.salvo.eldenChefe = ((m.salvo.eldenChefe || 0) + 1) % CHEFES.length; m.salvar(); }
    }
    // as cenas que terminam lá na frente: o Clawd segue de onde está (quebrada: fica onde estava)
    const pula = C.PULA[cena.nome];
    if (pula && m.andando && dt >= pula[0] && !m.ruins.has(cena.nome)) m.dist += pula[1];
    // inimigo abatido (cortada antes do golpe não conta); o 30º pede o épico
    if (C.MORTE[cena.nome] != null && dt >= C.MORTE[cena.nome]) {
      const antes = m.salvo.eldenAbatidos || 0;
      m.salvo.eldenAbatidos = antes + 1;
      if (Math.floor(m.salvo.eldenAbatidos / INIMIGOS) > Math.floor(antes / INIMIGOS)) m.salvo.eldenEpico = true;
      m.salvar();
    }
  },
  bloqueia: P.bloqueia,
  // acabou tudo: o local de graça passa na frente de qualquer cena, menos do épico (o aviso toca por cima)
  aoEvento(m, tipo) {
    if (tipo !== 'tudo' || !m.host.clawd || m.modo === 'oculto') return;
    if (m.cena && (m.cena.nome === 'graca-descoberta' || m.cena.epico)) return;
    if (m.cena) m.fimCena(true);
    m.comecarCena(C.cenaGraca(m));
  },

  // -- desenho --
  fundo(g, m) {  // a moldura e os enfeites, nas caixas que a janelinha mandou
    A.vestir(roupaDe(m));  // o 1º desenho do quadro: daqui pra frente, tudo com a roupa da vez
    const h = m.host, e = h.escala || 1, t = m.T;
    const fase = K.andar ? K.andar(t, emMovimento(m)) : t;
    if (h.cartao) K.moldura(g, h.cartao, fase);
    for (const l of h.linhas || []) {
      if (l.bola) K.bolinha(g, l, t);
      if (l.tempo) K.escrever(g, e, l.tempo.txt, l.tempo.cor, l.tempo.caixa, true);
    }
    for (const u of h.uso || []) {
      const nivel = K.nivelDe(u);
      if (u.rotulo) K.escrever(g, e, u.rotulo.txt, A.COR.rotulo, u.rotulo.caixa, false);
      if (u.barra) K.barra(g, u.barra, u.pct, nivel, fase);
      desenharRitmo(g, u, '#F2D77A', (txt, cor, caixa) => K.escrever(g, e, txt, cor, caixa, true));
      if (u.pctTxt) K.escrever(g, e, u.pctTxt.txt, K.corDoPct(u.pct, nivel), u.pctTxt.caixa, true);
      if (u.falta) K.escrever(g, e, u.falta.txt, A.COR.falta, u.falta.caixa, true);
    }
  },
  clawd(g, m) {
    A.vestir(roupaDe(m));
    if (P.clawd(g, m)) return;  // a saída da cena de parado
    const t = m.T, modo = m.andando ? 'andando' : m.host.modo;
    if (modo === 'andando') A.clawdElden(g, A.andando(t));
    else if (modo === 'pulando') A.clawdElden(g, A.pulando(t));
    else A.clawdElden(g, { T: t, pernas: 'ambas', arma: { ang: 165 } });  // parado: a arma descansa no ombro
  },
  animado: emMovimento,
  inimigosPorEpico: INIMIGOS,
  chefes: CHEFES,
  pula: C.PULA,
  sorteadas: C.SORTEADAS,
  roupaDe,
  // pros testes: troca o épico, o lendário junto (null = não existe; undefined = o de verdade)
  trocarEpico(mod) { epicoModulo = lendarioModulo = mod; epicoErro = null; },
};
