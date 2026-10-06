'use strict';
// Tema Minecraft (o que o dono escolheu nas prévias): o Clawd com a roupa do Steve (Alex
// 1 em 10, Herobrine 1 em 50, sorteados cada vez que ele começa a andar); nas paradas da
// caminhada, 1 em 2 vira um evento do jogo (minecraft-eventos.js), raros mais raros e, de
// noite, mais hostis; vida, nível a cada 5 mortes + os do dragão (sobrevive a reabrir), o lobo pet e, a
// cada 20 mortes, o Ender Dragon (minecraft-dragao.js, se existir). Os enfeites do cartão
// são os mesmos da janelinha WPF (minecraft-enfeites.js).
const { IMG, arte, temTexturas, sortearPeso, rng } = require('./comum');
const { registrarRoupas, desenhaClawd, andando, pulando } = require('./clawd');
const enfeites = require('./minecraft-enfeites');
const { MOB, desenhaMob, desenhaCoracoes } = require('./minecraft-kit');
const { EVENTOS, EV, MINERIOS, sorteiaMinerio, quadroEvento } = require('./minecraft-eventos');

const NIVEL = 5;      // mortes por nível
const DRAGAO = 20;    // mortes por Ender Dragon (o dono mudou de 30 pra 20 em 06/10)
const PET = 25;       // s que o lobo manso segue o Clawd
const PESO = { comum: 4, incomum: 2, raro: 1 };
// 1 nível a cada 5 mortes + os que o Ender Dragon deu (o dono quis que o +28 da cena ficasse)
const nivelDe = (m, mortes = m.salvo.mortes || 0) => Math.floor(mortes / NIVEL) + (m.salvo.niveisDoDragao || 0);

// sem as texturas da Mojang: os 16x16 desenhados no overlay.ps1, com o cabo no mesmo pixel
const CORES16 = { d: '#1B6E73', c: '#4AEDD9', b: '#C9FFF6', k: '#3B2A14', h: '#8A5A2B' };
const DESENHOS = {
  picareta: ['................', '....ddddd.......', '...dbbcccdd.....', '....dddcccbd....', '.......ddcccd...', '.........dccd...', '........kdcbcd..', '.......khkdccd..', '......khk..dcd..', '.....khk...dcd..', '....khk.....dd..', '...khk..........', '..khk...........', '..kk............', '................', '................'],
  espada: ['................', '............ddd.', '...........dbcd.', '..........dbcd..', '.........dbcd...', '........dbcd....', '.......dbcd.....', '......dbcd......', '..dd.dbcd.......', '..dcdbcd........', '...dccd.........', '...kdcdd........', '..khkddcd.......', '.khk...dd.......', '.kk.............', '................'],
};

// -- roupas: a B da prévia (roupa + cabelo), cores das texturas do Steve e da Alex --
const STEVE = { camisa: '#00AFAF', calca: '#463AA5', sapato: '#4A4A4A', cabelo: '#3F2A15', cabeloEsc: '#2B1E0D' };
const ALEX = { camisa: '#8CBE8A', calca: '#7C573E', bota: '#656565', cabelo: '#EB983F' };
const CORPO = ['.cccccccccccccccc.', '.##cccccccccccc##.', '...cccccccccccc...', '...pppppppppppp...', '....A.B....A.B....', '....A.B....A.B....'];
const CABECA_STEVE = ['...hhhhhhhhhhhh...', '...H##########H...', '...##o######o##...', '...##o######o##...'];
const CORES_STEVE = { '#': '#D77757', o: '#1A1A1A', c: STEVE.camisa, p: STEVE.calca, h: STEVE.cabelo, H: STEVE.cabeloEsc };
const ROUPAS = {
  mc_steve: { linhas: [...CABECA_STEVE, ...CORPO], cores: CORES_STEVE, perna: [STEVE.calca, STEVE.sapato], corpo: '#D77757' },
  mc_alex: {
    linhas: ['...hhhhhhhhhhhh...', '...hhhhh#####hh...', '...h#o######o#h...', '...h#o######o#h...', ...CORPO],
    cores: { '#': '#D77757', o: '#1A1A1A', c: ALEX.camisa, p: ALEX.calca, h: ALEX.cabelo }, perna: [ALEX.calca, ALEX.bota], corpo: '#D77757',
  },
  // Herobrine: o Steve com os olhos brancos brilhando ('g': sem pupila, com o halo que pulsa)
  mc_herobrine: {
    linhas: [...CABECA_STEVE.map(l => l.replace(/o/g, 'g')), ...CORPO], cores: { ...CORES_STEVE, g: '#FFFFFF' },
    perna: [STEVE.calca, STEVE.sapato], corpo: '#D77757', olho: /g/, brilho: true,
  },
};
// primeiro o Herobrine (o mais raro), depois a Alex, senão o Steve
function sortearRoupa(m) {
  if (m.chance(1 / 50)) return 'mc_herobrine';
  if (m.chance(1 / 10)) return 'mc_alex';
  return 'mc_steve';
}

// -- o Ender Dragon é de outro arquivo, que pode não existir: carrega na 1ª vez que precisa
// (e não na hora do require: ele pode querer coisas deste arquivo) --
let dragaoModulo, dragaoErro = null;
function dragao() {
  if (dragaoModulo === undefined) {
    try { dragaoModulo = require('./minecraft-dragao'); } catch (e) {
      dragaoModulo = null;
      if (!(e.code === 'MODULE_NOT_FOUND' && String(e.message).split('\n')[0].includes('minecraft-dragao'))) dragaoErro = e.message;
    }
  }
  return dragaoModulo;
}
const texturasDoDragao = () => { const d = dragao(); return d && Array.isArray(d.texturas) ? d.texturas : []; };
const temDragao = () => { const d = dragao(); return !!(d && typeof d.cena === 'function' && temTexturas(...texturasDoDragao())); };
function cenaDoDragao(m) {
  const c = dragao().cena(m);
  return c && !m.ruins.has(c.nome) ? { ...c, dragao: true } : null;  // quebrou antes: não volta até reabrir
}

// -- eventos --
// só os que têm as texturas, nunca o anterior; raro pesa menos; de noite, hostis x3,
// pacíficos x0,3 e o enderman x2 a mais
function pesosDosEventos(m) {
  const noite = m.noite();
  let lista = EVENTOS.filter(ev => !ev.especial && !m.ruins.has(ev.id) && temTexturas(...ev.texturas));
  if (lista.length > 1) lista = lista.filter(ev => ev.id !== m.estado.ultimo);
  const peso = ev => PESO[ev.raridade] * (noite ? (ev.grupo === 'hostil' ? 3 : ev.grupo === 'pacifico' ? 0.3 : 1) * (ev.id === 'enderman' ? 2 : 1) : 1);
  return Object.fromEntries(lista.map(ev => [ev.id, peso(ev)]));
}
// a cena de um evento: vida, nível e sorteios ficam presos na hora (o quadro é função do tempo)
function cenaDoEvento(m, ev, minerio) {
  const mortes = m.salvo.mortes || 0, nivel = nivelDe(m, mortes), r = rng(Math.floor(m.sorteio() * 4294967296));
  const ctx = { vida: Math.max(1, Math.round(m.estado.vida)), nivel, sobe: false, semente: Math.floor(r() * 999), minerio: minerio || sorteiaMinerio(r()) };
  if (ev.mortes) { ctx.nivel = nivelDe(m, mortes + ev.mortes); ctx.sobe = ctx.nivel > nivel; }
  const c = ev.fazer(ctx);
  return {
    nome: ev.id, dur: c.dur, espaco: ev.espaco, evento: c, ctx,
    quadro(g, t, mundo) { quadroEvento(c, g, t, mundo.roupa || 'mc_steve', mundo.T); },
  };
}

const TEXTURAS = [...new Set(['picareta', 'espada', ...enfeites.TEXTURAS, ...EVENTOS.flatMap(ev => ev.texturas)])];

module.exports = {
  // enfeites só com as 6 texturas deles (sem elas a janelinha desenha os dela); o motor
  // manda o layout depois de carregar as texturas
  get layout() {
    return {
      raio: 0, fundo: '#F0181818', moldura: [6, 8, 6, 6], padding: [8, 6, 8, 6], enfeites: enfeites.prontos(),
      colunas: { tempo: 44, pct: 38, falta: 56, rotulo: 18 }, letra: 11, barra: [118, 5],
    };
  },
  get texturas() { return [...new Set([...TEXTURAS, ...texturasDoDragao()])]; },
  trilha: { raio: 1 },
  roupas: ROUPAS,
  cenas: EVENTOS.map(ev => ev.id),

  iniciar(m) {
    for (const n of Object.keys(DESENHOS)) if (!IMG[n]) IMG[n] = arte(DESENHOS[n], CORES16);
    registrarRoupas(ROUPAS);
    m.roupa = 'mc_steve';
    Object.assign(m.estado, { vida: 10, ouro: 0, ouroAte: 0, petAte: -1, ultimo: null, pendente: null });
    if (!Number.isFinite(m.salvo.mortes)) m.salvo.mortes = 0;
  },
  passo(m, dt) {
    const e = m.estado;
    if (!m.cena) e.vida = Math.min(10, e.vida + dt / 4);  // regenera meio coração a cada 4 s (como a prévia)
    if (e.ouro && m.T > e.ouroAte) e.ouro = 0;
  },
  fundo(g, m) { enfeites.desenharEnfeites(g, m.host, m.T); },
  // o lobo manso segue 30 px atrás, na trilha, por 25 s
  atras(g, m) {
    const e = m.estado;
    if (!(e.petAte > m.T) || !m.andando || !IMG.lobo_manso) return;
    const p = m.poseEm(-30), anda = !m.cena && !m.bloqueado();
    g.translate(p.x, p.y); g.rotate(p.a);
    desenhaMob(g, MOB.loboManso, 0, 0, { vira: true, quadro: anda ? Math.floor(m.T / 0.12) % 2 : 0, alfa: Math.min(1, (e.petAte - m.T) / 0.5) });
  },
  clawd(g, m) {
    const t = m.T, modo = m.andando ? 'andando' : m.host.modo, e = m.estado;
    const p = modo === 'andando' ? andando(t) : modo === 'pulando' ? pulando(t) : { pernas: 'ambas', ang: 0 };
    desenhaClawd(g, { ...p, roupa: m.roupa || 'mc_steve', ferr: 'picareta', T: t });
    if (e.vida < 9.99 || e.ouro) desenhaCoracoes(g, Math.floor(e.vida), e.ouro, false, 0.9);
  },
  naParada(m) {
    const e = m.estado;
    if (dragaoErro && m.aoErro) { m.aoErro(`minecraft-dragao.js com defeito: ${dragaoErro}`); dragaoErro = null; }
    // a cada 20 mortes, na próxima parada: o dragão (se o arquivo e as texturas dele estão aí)
    if (m.salvo.dragao) {
      const c = temDragao() && cenaDoDragao(m);
      if (c) return c;
      m.salvo.dragao = false; m.salvar();
    }
    if (e.pendente) return e.pendente;  // já sorteado, esperando espaço na reta
    // como na prévia, só em cima ou embaixo do cartão (nos lados os mobs ficariam deitados)
    if (Math.abs(Math.sin(m.pose().a)) > 0.01) return undefined;
    if (!m.chance(0.5)) return null;
    const id = sortearPeso(pesosDosEventos(m), m.sorteio);
    return id ? (e.pendente = cenaDoEvento(m, EV[id])) : null;
  },
  aoComecarAndar(m) { m.roupa = sortearRoupa(m); m.estado.pendente = null; },
  aoComecarCena(m, cena) {
    m.estado.pendente = null;
    if (cena.dragao) { m.salvo.dragao = false; m.salvar(); }
    if (cena.evento) m.estado.ultimo = cena.nome;
  },
  // cortada (pergunta/permissão): só conta o que já aconteceu
  aoFimCena(m, cena) {
    if (cena && cena.dragao) {
      const n = (cena.subidas || []).filter(s => m.T - cena.t0 >= s).length;
      if (n) { m.salvo.niveisDoDragao = (m.salvo.niveisDoDragao || 0) + n; m.salvar(); }
      return;
    }
    const c = cena && cena.evento;
    if (!c) return;
    const e = m.estado, foi = m.T - cena.t0;
    if (c.totem && foi >= c.tTotem) Object.assign(e, { vida: 1, ouro: 4, ouroAte: m.T + 5 });
    else e.vida = Math.max(1, e.vida - c.danos.reduce((s, [t, d]) => s + (foi >= t ? d : 0), 0));
    const n = c.mortes.reduce((s, [t, k]) => s + (foi >= t ? k : 0), 0);
    if (n) {
      const antes = m.salvo.mortes || 0;
      m.salvo.mortes = antes + n;
      if (Math.floor(m.salvo.mortes / DRAGAO) > Math.floor(antes / DRAGAO)) m.salvo.dragao = true;
      m.salvar();
    }
    if (c.pet != null && foi >= c.pet) e.petAte = m.T + PET;
  },
  // pros testes e pro motor-foto (--cena mineracao:diamante escolhe o minério)
  cenaPorNome(m, nome) {
    if (nome === 'dragao') return dragao() && typeof dragao().cena === 'function' ? cenaDoDragao(m) : null;
    const [id, minerio] = String(nome).split(':');
    return EV[id] ? cenaDoEvento(m, EV[id], minerio && MINERIOS.find(x => x.id === minerio)) : null;
  },
  // parado, só o orbe de quem está trabalhando mexe
  animado(m) { return enfeites.prontos() && (m.host.linhas || []).some(l => l.sit === 'working'); },

  // pros testes: troca o minecraft-dragao.js por outro (null = não existe)
  trocarDragao(modulo) { dragaoModulo = modulo; },
  nivel: m => nivelDe(m),
  pesosDosEventos,
};
