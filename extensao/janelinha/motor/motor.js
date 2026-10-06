'use strict';
// Motor das animações da janelinha (Windows e Mac, o mesmo código): desenha cada quadro
// em software (raster.js) e manda só o pedaço que mudou. A janelinha cuida do resto
// (nomes das sessões, clique, sons) e cola esses pixels por cima do cartão.
//
// Entrada (stdin), uma linha JSON por mensagem:
//   {"msg":"estado", tema, clawd, modo: andando|pulando|parado, escala, janela:[w,h],
//    cartao:[x,y,w,h], raio, opacidade, linhas:[...], uso:[...]}   (só o que mudou, em DIPs)
//   {"msg":"evento","tipo":"terminou"|"tudo"}
//   {"msg":"foto"} (só com --foto): desenha o quadro do teste com o último estado e sai
// Saída (stdout), mensagens binárias: "CM" + tipo (1 byte) + 0 + tamanho (uint32 LE) + dados
//   Q quadro: W,H (tamanho da tela), x,y,w,h (uint16 LE cada) + w*h*4 bytes BGRA pré-multiplicado
//   L uma linha pro diário da janelinha (utf8)
//   P pronto: JSON com a versão e o layout de cada tema
// Teste: --foto <s> espera a mensagem "foto", desenha um quadro nesse instante (com --cena
// <nome>, o instante da cena), manda e sai; --semente fixa o sorteio; --hora HH fixa o
// relógio (noite). A janelinha só pede a foto depois de montar o cartão com o layout da P.
const path = require('path');
const { Tela } = require('./raster');
const { carregarTexturas, layoutDe } = require('./comum');
const { Mundo } = require('./mundo');

const args = {};
for (let i = 2; i < process.argv.length; i++) {
  const a = process.argv[i];
  if (a.startsWith('--')) { const v = process.argv[i + 1]; if (v == null || v.startsWith('--')) args[a.slice(2)] = true; else { args[a.slice(2)] = v; i++; } }
}
const PASTA = args.pasta || path.join(require('os').homedir(), '.claude-monitor');
const QPS = 30;

// -- saída --
function enviar(tipo, dados) {
  const h = Buffer.alloc(8);
  h.write('CM', 0, 'latin1'); h[2] = tipo.charCodeAt(0); h[3] = 0; h.writeUInt32LE(dados.length, 4);
  process.stdout.write(Buffer.concat([h, dados]));
}
const anotados = new Map();  // o mesmo erro a cada quadro enche o diário: 1x por minuto
function anotar(texto) {
  const agora = Date.now(), chave = texto.slice(0, 120);
  if (agora - (anotados.get(chave) || 0) < 60000) return;
  if (anotados.size > 200) anotados.clear();
  anotados.set(chave, agora);
  enviar('L', Buffer.from(texto, 'utf8'));
}
process.stdout.on('error', () => process.exit(0));  // a janelinha fechou

// -- temas: um que não carrega não derruba os outros --
const NOMES = { padrao: './tema-padrao', minecraft: './tema-minecraft', dragonball: './tema-dragonball' };
const temas = {};
for (const [nome, arquivo] of Object.entries(NOMES)) {
  try { temas[nome] = require(arquivo); } catch (e) { if (e.code !== 'MODULE_NOT_FOUND' || !String(e.message).includes(arquivo.slice(2))) anotar(`motor: tema ${nome} com defeito: ${e.message}`); }
}
function tema(nome) { return temas[nome] || temas.padrao; }
const faltando = new Set();
for (const t of Object.values(temas)) for (const n of carregarTexturas(PASTA, t.texturas || [])) faltando.add(n);
if (faltando.size && !args.foto) anotar(`motor: sem as texturas ${[...faltando].join(', ')} (o que depende delas fica de fora)`);

// -- estado --
const relogio = args.hora != null ? () => { const d = new Date(); d.setHours(Number(args.hora), 0, 0, 0); return d; } : null;
let mundo = null;
let host = null;
function trocarTema(nome) {
  const salvoAntes = mundo && { dist: mundo.dist, T: mundo.T };
  mundo = new Mundo({ tema: tema(nome), semente: args.semente != null ? Number(args.semente) : Date.now(), pasta: args.foto ? null : PASTA, relogio });
  if (salvoAntes) { mundo.dist = salvoAntes.dist; mundo.T = salvoAntes.T; }
  mundo.nomeTema = nome;
  mundo.aoErro = texto => anotar(`motor: ${texto}`);
}
function receber(m) {
  if (m.msg === 'estado') {
    host = { ...(host || {}), ...m };
    if (!mundo || mundo.nomeTema !== host.tema) trocarTema(host.tema);
    mundo.receber(host);
  } else if (m.msg === 'evento' && mundo) mundo.evento(m.tipo);
  else if (m.msg === 'foto' && args.foto && mundo && host.janela) foto();
}

// -- desenho --
let atual = null, anterior = null, g = null;
let errosSeguidos = 0;
function quadro(T) {
  if (!host || !host.janela) return null;
  const esc = host.escala || 1;
  const W = Math.max(1, Math.round(host.janela[0] * esc)), H = Math.max(1, Math.round(host.janela[1] * esc));
  if (!atual || atual.width !== W || atual.height !== H) { atual = new Tela(W, H); anterior = null; g = atual.getContext('2d'); }
  mundo.passo(T);
  atual.limpar();
  g.setTransform(esc, 0, 0, esc, 0, 0);
  g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  try {
    mundo.desenhar(g);
    errosSeguidos = 0;
  } catch (e) {
    errosSeguidos++;
    anotar(`motor: quadro quebrou (${mundo.nomeTema}): ${e.stack || e.message}`);
    // o tema inteiro com defeito: fica no Padrão até reabrir
    if (errosSeguidos > 10 && mundo.nomeTema !== 'padrao' && temas.padrao) { delete temas[mundo.nomeTema]; trocarTema('padrao'); mundo.receber(host); }
    atual.limpar();
    g = atual.getContext('2d');  // o erro pode ter deixado save() sem restore()
    if (g.reset) g.reset();
  }
  const ret = anterior ? atual.diferenca(anterior) : { x: 0, y: 0, w: W, h: H };
  if (ret) {
    const cab = Buffer.alloc(12);
    [W, H, ret.x, ret.y, ret.w, ret.h].forEach((v, i) => cab.writeUInt16LE(v, i * 2));
    enviar('Q', Buffer.concat([cab, atual.recorte(ret.x, ret.y, ret.w, ret.h)]));
  }
  if (!anterior) anterior = new Tela(W, H);
  anterior.copiarDe(atual);
  return ret;
}

// -- entrada --
let resto = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', pedaco => {
  resto += pedaco;
  let i;
  while ((i = resto.indexOf('\n')) >= 0) {
    const linha = resto.slice(0, i).trim();
    resto = resto.slice(i + 1);
    if (!linha) continue;
    try { receber(JSON.parse(linha)); } catch (e) { anotar(`motor: mensagem ruim (${e.message}): ${linha.slice(0, 200)}`); }
  }
});
process.stdin.on('end', () => process.exit(0));  // a janelinha fechou
process.on('uncaughtException', e => { try { anotar(`motor: caiu: ${e.stack || e.message}`); } finally { setTimeout(() => process.exit(1), 50); } });

enviar('P', Buffer.from(JSON.stringify({
  pronto: true,
  temas: Object.fromEntries(Object.entries(temas).map(([n, t]) => [n, layoutDe(t)])),
}), 'utf8'));

// -- teste: um quadro num instante e sai --
let fotografou = false;
function foto() {
  if (fotografou) return;
  fotografou = true;
  const t = Number(args.foto) || 0;
  mundo.T = 0;
  if (args.cena && mundo.tema.cenaPorNome) {
    const cena = mundo.tema.cenaPorNome(mundo, args.cena);
    if (cena) mundo.comecarCena(cena); else anotar(`motor: não conheço a cena ${args.cena}`);
  }
  anterior = null;
  // anda o relógio até o instante pedido (a cena e o passeio são função do tempo)
  for (let s = 1 / QPS; s < t; s += 1 / QPS) mundo.passo(s);
  quadro(t);
  process.stdout.write('', () => process.exit(0));
}

// -- o relógio: 30 quadros/s; parado e sem nada mexendo, 5 --
if (!args.foto) {
  const t0 = process.hrtime.bigint();
  const agora = () => Number(process.hrtime.bigint() - t0) / 1e9;
  let proximo = 0;
  const tique = () => {
    const T = agora();
    if (mundo && host) quadro(T);
    const animado = mundo && (mundo.andando || mundo.cena || (mundo.tema.animado ? mundo.tema.animado(mundo) : mundo.host.modo !== 'parado'));
    proximo = Math.max(proximo + 1 / (animado ? QPS : 5), T);
    setTimeout(tique, Math.max(0, (proximo - agora()) * 1000));
  };
  tique();
}
