'use strict';
// Fotografa o motor das animações sem a janelinha: um cartão de mentira (4 sessões, uma
// em cada situação, e o usage), o tema e a cena que pedir, num instante, num PNG.
// Pros testes (testes/node/motor.test.js) e pra conferir desenho de cena a olho.
//   node testes/motor-foto.js --tema minecraft --cena zumbi --t 1.5 --saida f.png [--escala 2]
//        [--modo andando|pulando|parado] [--hora 23] [--semente 7] [--pasta ~/.claude-monitor]
//        [--tira 0,0.5,1,1.5] (vários instantes lado a lado) [--zoom 3] (amplia sem suavizar)
//        [--cartao nao] (sem o cartão de mentira por baixo)
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

const MOTOR = path.join(__dirname, '..', 'extensao', 'janelinha', 'motor');
const { Tela } = require(path.join(MOTOR, 'raster'));
const { carregarTexturas, layoutDe } = require(path.join(MOTOR, 'comum'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));

// O cartão como a janelinha manda (DIPs, docs/MOTOR.md): janela 380x440, cartão no canto
// de baixo à direita (34 de margem), montado pelo layout do tema como a janelinha monta:
// linha de sessão = bolinha 8 + 8 + nome 170 + tempo, 16 de altura + 2 em cima e embaixo;
// traço de 10; linha do usage = rótulo + barra + % + falta, na altura da letra + 4.
const SITUACOES = [['working', '#22C55E', '12m'], ['finished', '#EF4444', '9m'], ['question', '#60A5FA', 'agora'], ['permission', '#FACC15', '21m']];
const USOS = [['5h', 38, '1h20'], ['7d', 85, '2d23h'], ['7d', 97, '15h47']];
function estadoDeMentira(tema, modo = 'andando', { sessoes = 4, usos = 2 } = {}) {
  let modulo = null;
  try { modulo = require(path.join(MOTOR, 'tema-' + tema)); } catch { /* tema que não existe: o layout do Padrão */ }
  const L = layoutDe(modulo), col = L.colunas, [me, mc, md, mb] = L.moldura, [pe, pc, pd, pb] = L.padding;
  const conteudoW = Math.max(8 + 8 + 170 + col.tempo, col.rotulo + L.barra[0] + col.pct + col.falta);
  const altUso = Math.max(L.letra, L.barra[1]) + 4;
  const conteudoH = sessoes * 20 + 10 + (usos ? usos * altUso : 20);
  const w = me + pe + conteudoW + pd + md, h = mc + pc + conteudoH + pb + mb;
  const x = 380 - 34 - w, y = 440 - 34 - h, cx = x + me + pe, cy = y + mc + pc;
  const linhas = Array.from({ length: sessoes }, (_, i) => {
    const [sit, cor, txt] = SITUACOES[i % SITUACOES.length], ly = cy + i * 20 + 2;
    return { id: 'sessao' + i, sit, cor, bola: [cx, ly + 4, 8, 8], tempo: { txt, cor, caixa: [cx + 186, ly + (16 - L.letra) / 2, col.tempo, L.letra] } };
  });
  const uso = USOS.slice(0, usos).map(([rotulo, pct, falta], j) => {
    const uy = cy + sessoes * 20 + 10 + j * altUso + 2, nivel = pct >= 95 ? 2 : pct >= 80 ? 1 : 0, cor = ['#D1D5DB', '#F59E0B', '#EF4444'][nivel];
    let ux = cx;
    const caixa = (largura, alt = L.letra) => { const c = [ux, uy + (altUso - 4 - alt) / 2, largura, alt]; ux += largura; return c; };
    return {
      rotulo: { txt: rotulo, cor: '#9CA3AF', caixa: caixa(col.rotulo) }, barra: caixa(L.barra[0], L.barra[1]), pct, nivel,
      pctTxt: { txt: pct + '%', cor, caixa: caixa(col.pct) }, falta: { txt: falta, cor: '#6B7280', caixa: caixa(col.falta) },
    };
  });
  return { msg: 'estado', tema, clawd: true, modo, escala: 1, janela: [380, 440], cartao: [x, y, w, h], raio: L.raio, opacidade: 1, linhas, uso };
}

function argumentos(argv) {
  const a = {};
  for (let i = 2; i < argv.length; i++) if (argv[i].startsWith('--')) { a[argv[i].slice(2)] = argv[i + 1]; i++; }
  return a;
}

// o que a janelinha pinta por baixo do motor: o fundo do cartão (cantos do layout) e, no
// lugar dos nomes das sessões, um traço cinza; sem enfeites no tema, as bolinhas dela também
function cartaoDeMentira(g, host, L) {
  const [x, y, w, h] = host.cartao, r = Math.min(L.raio, w / 2, h / 2);
  g.save();
  g.fillStyle = '#' + L.fundo.slice(3) ; g.globalAlpha = parseInt(L.fundo.slice(1, 3), 16) / 255 * (host.opacidade ?? 1);
  g.beginPath();
  g.moveTo(x + r, y); g.lineTo(x + w - r, y); g.arc(x + w - r, y + r, r, -Math.PI / 2, 0);
  g.lineTo(x + w, y + h - r); g.arc(x + w - r, y + h - r, r, 0, Math.PI / 2);
  g.lineTo(x + r, y + h); g.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI);
  g.lineTo(x, y + r); g.arc(x + r, y + r, r, Math.PI, 1.5 * Math.PI);
  g.fill();
  g.globalAlpha = 1;
  for (const l of host.linhas) {
    g.fillStyle = '#4B5563'; g.fillRect(l.bola[0] + 16, l.bola[1] + 1, 120, 6);
    const c = l.tempo.caixa;
    if (!L.enfeites) { g.fillStyle = l.cor; g.fillRect(...l.bola); g.fillRect(c[0] + c[2] - 20, c[1] + c[3] / 2 - 3, 20, 6); }
  }
  if (!L.enfeites) for (const u of host.uso) { g.fillStyle = '#3F3F46'; g.fillRect(...u.barra); g.fillStyle = u.pctTxt.cor; g.fillRect(u.barra[0], u.barra[1], u.barra[2] * u.pct / 100, u.barra[3]); }
  g.restore();
}

// um quadro do tema no instante t (cena começando em 0), como o motor.js faria; cartao:
// false = só o que o motor desenha (o que os testes comparam)
function fotografar({ tema = 'padrao', cena = null, t = 1, escala = 1, modo = 'andando', hora = 12, semente = 7, pasta, estado, cartao = false } = {}) {
  const modulo = require(path.join(MOTOR, 'tema-' + tema));
  carregarTexturas(pasta || path.join(require('os').homedir(), '.claude-monitor'), modulo.texturas || []);
  const relogio = () => { const d = new Date(2026, 9, 5, 0, 0, 0); d.setHours(Number(hora)); return d; };
  const m = new Mundo({ tema: modulo, semente: Number(semente), relogio });
  const host = { ...estadoDeMentira(tema, modo), ...(estado || {}), escala };
  m.receber(host);
  if (cena) {
    const c = modulo.cenaPorNome ? modulo.cenaPorNome(m, cena) : null;
    if (!c) throw new Error(`o tema ${tema} não conhece a cena ${cena}`);
    m.comecarCena(c);
  }
  for (let s = 1 / 30; s < t; s += 1 / 30) m.passo(s);
  m.passo(t);
  const W = Math.round(380 * escala), H = Math.round(440 * escala);
  const tela = new Tela(W, H), g = tela.getContext('2d');
  g.setTransform(escala, 0, 0, escala, 0, 0);
  if (cartao) cartaoDeMentira(g, m.host, layoutDe(modulo));
  m.desenhar(g);
  return tela;
}
// PNG RGBA a partir da tela (BGRA pré-multiplicado), sobre um fundo escuro como a área de trabalho
function png(tela, zoom = 1, fundo = [40, 44, 60]) {
  const W = tela.width * zoom, H = tela.height * zoom, src = tela.bgra();
  const linhas = Buffer.alloc((W * 4 + 1) * H);
  for (let y = 0; y < H; y++) {
    linhas[y * (W * 4 + 1)] = 0;
    for (let x = 0; x < W; x++) {
      const i = ((Math.floor(y / zoom) * tela.width) + Math.floor(x / zoom)) * 4, o = y * (W * 4 + 1) + 1 + x * 4;
      const a = src[i + 3] / 255;
      linhas[o] = Math.round(src[i + 2] + fundo[0] * (1 - a)); linhas[o + 1] = Math.round(src[i + 1] + fundo[1] * (1 - a));
      linhas[o + 2] = Math.round(src[i] + fundo[2] * (1 - a)); linhas[o + 3] = 255;
    }
  }
  const crcTab = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
  const crc = b => { let c = 0xFFFFFFFF; for (const x of b) c = crcTab[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xFFFFFFFF) >>> 0; };
  const pedaco = (tipo, dados) => { const t = Buffer.from(tipo, 'latin1'), n = Buffer.alloc(4), c = Buffer.alloc(4); n.writeUInt32BE(dados.length); c.writeUInt32BE(crc(Buffer.concat([t, dados]))); return Buffer.concat([n, t, dados, c]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4); ihdr[8] = 8; ihdr[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), pedaco('IHDR', ihdr), pedaco('IDAT', zlib.deflateSync(linhas)), pedaco('IEND', Buffer.alloc(0))]);
}
// vários instantes lado a lado
function tira(telas) {
  const W = telas.reduce((s, t) => s + t.width, 0), H = Math.max(...telas.map(t => t.height));
  const junta = new Tela(W, H), g = junta.getContext('2d');
  let x = 0;
  for (const t of telas) { g.drawImage(t, x, 0); x += t.width; }
  return junta;
}

if (require.main === module) {
  const a = argumentos(process.argv);
  const base = { tema: a.tema, cena: a.cena, escala: Number(a.escala || 1), modo: a.modo, hora: a.hora ?? 12, semente: a.semente ?? 7, pasta: a.pasta, cartao: a.cartao !== 'nao' };
  const instantes = a.tira ? a.tira.split(',').map(Number) : [Number(a.t ?? 1)];
  const telas = instantes.map(t => fotografar({ ...base, t }));
  const saida = a.saida || 'motor-foto.png';
  fs.writeFileSync(saida, png(telas.length > 1 ? tira(telas) : telas[0], Number(a.zoom || 1)));
  console.log(`${saida}: ${instantes.length} quadro(s)`);
}

module.exports = { fotografar, estadoDeMentira, cartaoDeMentira, png, tira };
