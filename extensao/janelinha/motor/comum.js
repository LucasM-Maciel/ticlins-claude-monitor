'use strict';
// Ajudantes das animações, os mesmos das prévias (o código das cenas veio de lá):
// telas em memória, pixel art a partir de texto, tinta por cima e sorteio repetível.
// O motor roda dias sem parar: todo cache aqui tem teto.
const fs = require('fs');
const path = require('path');
const { Tela, decodificarPNG } = require('./raster');

const DEG = Math.PI / 180;
const lim = (v, a, b) => Math.max(a, Math.min(b, v));
const sai = u => 1 - (1 - u) * (1 - u);   // desacelera
const entra = u => u * u;                  // acelera

function tela(w, h) { return new Tela(Math.max(1, Math.ceil(w)), Math.max(1, Math.ceil(h))); }

// cache com teto: passou do limite, esvazia (o que for usado de novo é refeito na hora)
function cache(teto) {
  const m = new Map();
  return {
    get: k => m.get(k),
    set: (k, v) => { if (m.size >= teto) m.clear(); m.set(k, v); return v; },
    get size() { return m.size; },
  };
}

// texturas (as do Minecraft vêm da Mojang pelo minecraft.js; faltando, quem usa desiste da cena)
const IMG = {};
function carregarTexturas(pasta, nomes) {
  const faltando = [];
  for (const n of nomes) {
    if (IMG[n]) continue;
    try { IMG[n] = decodificarPNG(fs.readFileSync(path.join(pasta, n + '.png'))); } catch { faltando.push(n); }
  }
  return faltando;
}
const temTexturas = (...nomes) => nomes.every(n => IMG[n]);

// pixel art: linhas de texto + mapa de cores -> tela de 1 px por letra
const ARTES = cache(400);
function arte(linhas, cores) {
  const chave = linhas.join('|') + JSON.stringify(cores);
  const pronta = ARTES.get(chave);
  if (pronta) return pronta;
  const c = tela(Math.max(...linhas.map(l => l.length)), linhas.length);
  const k = c.getContext('2d');
  linhas.forEach((l, y) => { for (let x = 0; x < l.length; x++) { const cor = cores[l[x]]; if (cor) { k.fillStyle = cor; k.fillRect(x, y, 1, 1); } } });
  return ARTES.set(chave, c);
}
// a mesma imagem pintada por cima (o vermelho do dano, o branco do creeper, os cinzas da fumaça)
const TINTAS = cache(600);
function tingida(img, cor, chave) {
  const k0 = chave + cor;
  const pronta = TINTAS.get(k0);
  if (pronta) return pronta;
  const c = tela(img.width, img.height);
  const k = c.getContext('2d');
  k.drawImage(img, 0, 0);
  k.globalCompositeOperation = 'source-atop'; k.fillStyle = cor; k.fillRect(0, 0, c.width, c.height);
  return TINTAS.set(k0, c);
}
// sorteio repetível: cada cena tem a sua semente, então o quadro é função do tempo
function rng(semente) {
  let a = semente >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
// escolhe pela tabela de pesos { nome: peso }; sem nada com peso > 0, null
function sortearPeso(pesos, sorteio) {
  const itens = Object.entries(pesos).filter(([, p]) => p > 0);
  const total = itens.reduce((s, [, p]) => s + p, 0);
  if (!total) return null;
  let r = sorteio() * total;
  for (const [nome, p] of itens) { r -= p; if (r < 0) return nome; }
  return itens[itens.length - 1][0];
}

// cores das prévias: '#RRGGBB' com alfa, e a mistura de duas (f = 0 só a, 1 só b)
function rgba(hex, a) {
  const n = parseInt(hex.slice(1, 7), 16);
  return `rgba(${n >> 16},${(n >> 8) & 255},${n & 255},${+a.toFixed(3)})`;
}
function mistura(a, b, f) {
  const x = parseInt(a.slice(1, 7), 16), y = parseInt(b.slice(1, 7), 16);
  const c = s => Math.round(((x >> s) & 255) * (1 - f) + ((y >> s) & 255) * f);
  return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1).toUpperCase();
}
// a imagem em outro tamanho, SUAVIZADA (bilinear, como o HighQuality do WPF): o raster só
// desenha pixel duro, e a letra do Minecraft em 11/9 sai torta assim. Caro: fazer 1x por
// tamanho e guardar (cache com teto). Deixe 1 px transparente em volta da imagem: a borda
// não esmaece pra fora.
function reamostrar(img, w, h) {
  w = Math.max(1, Math.round(w)); h = Math.max(1, Math.round(h));
  const out = tela(w, h), src = img.pixels, sw = img.width, sh = img.height, dst = out.pixels;
  const ex = sw / w, ey = sh / h;
  for (let y = 0; y < h; y++) {
    const fy = lim((y + 0.5) * ey - 0.5, 0, sh - 1), y0 = Math.floor(fy), y1 = Math.min(sh - 1, y0 + 1), ty = fy - y0;
    for (let x = 0; x < w; x++) {
      const fx = lim((x + 0.5) * ex - 0.5, 0, sw - 1), x0 = Math.floor(fx), x1 = Math.min(sw - 1, x0 + 1), tx = fx - x0;
      const a = src[y0 * sw + x0], b = src[y0 * sw + x1], c = src[y1 * sw + x0], d = src[y1 * sw + x1];
      let p = 0;
      for (let s = 0; s < 32; s += 8) {  // BGRA pré-multiplicado: mistura canal a canal
        const v = ((a >>> s) & 255) * (1 - tx) * (1 - ty) + ((b >>> s) & 255) * tx * (1 - ty) + ((c >>> s) & 255) * (1 - tx) * ty + ((d >>> s) & 255) * tx * ty;
        p += Math.round(v) * 2 ** s;
      }
      dst[y * w + x] = p;
    }
  }
  return out;
}

// o layout do tema com o que ele não disse igual ao Padrão (docs/MOTOR.md)
const LAYOUT = { raio: 8, fundo: '#E6181818', moldura: [0, 0, 0, 0], padding: [10, 6, 10, 6], enfeites: false, colunas: { tempo: 36, pct: 38, ritmo: 72, falta: 48, rotulo: 18 }, letra: 16, barra: [118, 4] };
function layoutDe(tema) {
  const l = (tema && tema.layout) || {};
  return { ...LAYOUT, ...l, colunas: { ...LAYOUT.colunas, ...(l.colunas || {}) } };
}

// o texto na língua do menu da janelinha (m.host.idioma; sem ele, português)
const tr = (idioma, pt, en) => idioma === 'en' ? en : pt;

// Limites espelhados em overlay.ps1/RitmoDe, overlay.swift/ritmo e overlay-linux.py/ritmo.
const PALAVRAS_RITMO = ['folga', 'no ritmo', 'acima', 'estourando'];
const PALAVRAS_RITMO_EN = ['slow', 'on pace', 'fast', 'too fast'];
function ritmoDe(pct, decorrido, rotulo, idioma) {
  if (!['5h', '7d'].includes(rotulo) || !Number.isFinite(decorrido)) return { txt: '', cor: '#6B7280' };
  if (rotulo === '5h' && (decorrido < 3.33 || decorrido > 96.67)) return { txt: '', cor: '#9CA3AF' };
  const d = pct - decorrido;

  const cor = d >= 20 ? '#EF4444' : d >= 6 ? '#F59E0B' : d <= -10 ? '#22C55E' : '#9CA3AF';
  return { txt: tr(idioma, PALAVRAS_RITMO, PALAVRAS_RITMO_EN)[d >= 20 ? 3 : d >= 6 ? 2 : d <= -10 ? 0 : 1], cor };
}

// o ritmo do usage (docs/MOTOR.md): o tracinho na barra onde o % estaria se gastasse por
// igual até renovar (u.decorrido) e a palavra na caixa dela, com a letra do tema
// (escrever(txt, cor, caixa)). Coordenadas da janela, em DIPs, como as do fundo()
function desenharRitmo(g, u, cor, escrever) {
  if (u.barra && Number.isFinite(u.decorrido)) {
    const [x, y, w, h] = u.barra;
    g.fillStyle = cor;
    g.fillRect(Math.round(x + w * lim(u.decorrido, 0, 100) / 100 - 1), y - 2, 2, h + 4);
  }
  if (u.ritmo && u.ritmo.txt) escrever(u.ritmo.txt, u.ritmo.cor, u.ritmo.caixa);
}

module.exports = { DEG, lim, sai, entra, tela, cache, IMG, carregarTexturas, temTexturas, arte, tingida, rng, sortearPeso, rgba, mistura, reamostrar, layoutDe, tr, PALAVRAS_RITMO, PALAVRAS_RITMO_EN, ritmoDe, desenharRitmo };
