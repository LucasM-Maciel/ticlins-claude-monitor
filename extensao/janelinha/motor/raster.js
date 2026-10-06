"use strict";
/**
 * Canvas 2D em software, só o pedaço que as animações da janelinha usam: o motor
 * roda fora do navegador o mesmo código das prévias (feitas pra <canvas>) e manda
 * cada quadro como pixels pra janela (WPF no Windows, AppKit no Mac).
 *
 * Pixel art: sem suavização e sem antialiasing. O pixel (px, py) é pintado se o
 * CENTRO dele (px+0,5; py+0,5), levado de volta pela transformação, cai dentro da
 * forma; no drawImage a cor vem do texel mais próximo. Por isso um Clawd com pixel
 * de 1,5 vira colunas de 1 e 2 px alternadas, igual à janela WPF de hoje. Centro
 * em cima da borda: a borda de cima/esquerda conta, a de baixo/direita não
 * ([início, fim) na tela). Mesma entrada, mesmos bytes.
 *
 * Os pixels ficam em BGRA pré-multiplicado, um Uint32 por pixel (little-endian),
 * que é o formato do WriteableBitmap Pbgra32 (WPF) e do CGImage premultipliedFirst
 * (Mac): bgra() entrega o buffer sem copiar.
 *
 * Uso:
 *   const { Tela, decodificarPNG } = require("./raster");
 *   const t = new Tela(380, 440), g = t.getContext("2d");
 *   g.drawImage(decodificarPNG(fs.readFileSync("terra.png")), 0, 0, 32, 32);
 *   const mudou = t.diferenca(anterior);  // e manda só t.recorte(mudou.x, mudou.y, mudou.w, mudou.h)
 */
const zlib = require("zlib");

// ---------- cores ----------
const NOMES = new Map([["white", [255, 255, 255, 1]], ["black", [0, 0, 0, 1]], ["transparent", [0, 0, 0, 0]]]);
const NUM = String.raw`\s*([+-]?(?:\d+\.?\d*|\.\d+)(?:e[+-]?\d+)?)(%?)\s*`;
const RGB = new RegExp(String.raw`^rgba?\(${NUM},${NUM},${NUM}(?:,${NUM})?\)$`);
const CORES = new Map();  // cache do parse: as mesmas cores voltam todo quadro

function interpretar(s) {
    if (s[0] === "#") {
        const h = s.slice(1);
        if (!/^(?:[0-9a-f]{3,4}|[0-9a-f]{6}|[0-9a-f]{8})$/.test(h)) return null;
        const curto = h.length <= 4;
        const v = (k) => (curto ? parseInt(h[k] + h[k], 16) : parseInt(h.slice(2 * k, 2 * k + 2), 16));
        return [v(0), v(1), v(2), h.length === 4 || h.length === 8 ? v(3) / 255 : 1];
    }
    const nome = NOMES.get(s);
    if (nome) return nome.slice();
    const m = RGB.exec(s);
    if (!m) return null;
    const canal = (i) => Math.min(255, Math.max(0, Math.round(m[i + 1] ? m[i] * 2.55 : +m[i])));
    const a = m[7] === undefined ? 1 : m[8] ? m[7] / 100 : +m[7];
    return [canal(1), canal(3), canal(5), Math.min(1, Math.max(0, a))];
}
/** Cor CSS -> [r, g, b, a] (a de 0 a 1), ou null. O array volta do cache: não mexa nele. */
function corDe(css) {
    if (typeof css !== "string") return null;
    let c = CORES.get(css);
    if (c !== undefined) return c;
    c = interpretar(css.trim().toLowerCase());
    if (CORES.size >= 4096) CORES.clear();  // rgba com alfa animado gera cor nova todo quadro
    CORES.set(css, c);
    return c;
}
/** Cor CSS -> [r, g, b, a(0-1)], ou null se não reconhece. */
function lerCor(css) {
    const c = corDe(css);
    return c && c.slice();
}

// ---------- pixels: Uint32 = A<<24 | R<<16 | G<<8 | B, pré-multiplicado ----------
const div255 = (x) => (x + 128 + ((x + 128) >> 8)) >> 8;  // round(x/255) exato pra 0..65025
function empacotar(r, g, b, a) {
    if (a <= 0) return 0;
    if (a < 255) { r = div255(r * a); g = div255(g * a); b = div255(b * a); }
    return ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
}
/** Os 4 canais de p vezes k/255, arredondado, dois canais por multiplicação. */
function mulCanais(p, k) {
    let rb = (p & 0xff00ff) * k + 0x800080;
    rb = ((rb + ((rb >>> 8) & 0xff00ff)) >>> 8) & 0xff00ff;
    let ag = ((p >>> 8) & 0xff00ff) * k + 0x800080;
    ag = (ag + ((ag >>> 8) & 0xff00ff)) & 0xff00ff00;
    return (rb | ag) >>> 0;
}

const SOBRE = 0, ATOP = 1, DEST_IN = 2, DEST_OUT = 3, MULT = 4, SOMA = 5, APAGAR = 6;
const OPERACOES = new Map([["source-over", SOBRE], ["source-atop", ATOP], ["destination-in", DEST_IN],
    ["destination-out", DEST_OUT], ["multiply", MULT], ["lighter", SOMA]]);

/** Porter-Duff em pré-multiplicado: s = fonte, d = o que já está na tela. */
function compor(op, s, d) {
    const sa = s >>> 24;
    switch (op) {
        case SOBRE: return s + mulCanais(d, 255 - sa);
        case DEST_IN: return mulCanais(d, sa);
        case DEST_OUT: return mulCanais(d, 255 - sa);
        case ATOP: {
            const da = d >>> 24, ia = 255 - sa;
            if (da === 0) return 0;
            const r = div255(((s >>> 16) & 255) * da + ((d >>> 16) & 255) * ia);
            const g = div255(((s >>> 8) & 255) * da + ((d >>> 8) & 255) * ia);
            const b = div255((s & 255) * da + (d & 255) * ia);
            return ((da << 24) | (r << 16) | (g << 8) | b) >>> 0;
        }
        case MULT: {
            const da = d >>> 24, isa = 255 - sa, ida = 255 - da;
            const a = sa + da - div255(sa * da);
            const sr = (s >>> 16) & 255, sg = (s >>> 8) & 255, sb = s & 255;
            const dr = (d >>> 16) & 255, dg = (d >>> 8) & 255, db = d & 255;
            const r = Math.min(a, div255(sr * ida + dr * isa + sr * dr));
            const g = Math.min(a, div255(sg * ida + dg * isa + sg * dg));
            const b = Math.min(a, div255(sb * ida + db * isa + sb * db));
            return ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
        }
        case SOMA: {
            const a = Math.min(255, sa + (d >>> 24));
            const r = Math.min(255, ((s >>> 16) & 255) + ((d >>> 16) & 255));
            const g = Math.min(255, ((s >>> 8) & 255) + ((d >>> 8) & 255));
            const b = Math.min(255, (s & 255) + (d & 255));
            return ((a << 24) | (r << 16) | (g << 8) | b) >>> 0;
        }
        default: return 0;  // APAGAR (clearRect)
    }
}

// ---------- varredura de polígonos (caminhos, retângulos girados, traços) ----------
// Arestas já na tela: x no y de cima, y de cima, y de baixo, dx/dy, sentido (+1 desce, -1 sobe).
let ARESTAS = new Float64Array(5 * 256), nArestas = 0;
let CRUZ = new Float64Array(64), SENT = new Int8Array(64);
let SPANS = new Int32Array(3 * 1024);  // y, x inicial, x final (exclusivo)
let COLUNAS = new Int32Array(1024);    // drawImage sem giro: texel de cada coluna da tela
let TRECHOS = new Int32Array(2048), nTrechos = 0;  // colunas seguidas com o mesmo texel: (texel, quantas)

function novaAresta(xa, ya, xb, yb) {
    if (ya === yb || !(Number.isFinite(xa) && Number.isFinite(ya) && Number.isFinite(xb) && Number.isFinite(yb))) return;
    let sentido = 1;
    if (ya > yb) { let k = xa; xa = xb; xb = k; k = ya; ya = yb; yb = k; sentido = -1; }
    if ((nArestas + 1) * 5 > ARESTAS.length) { const novo = new Float64Array(ARESTAS.length * 2); novo.set(ARESTAS); ARESTAS = novo; }
    const k = nArestas++ * 5;
    ARESTAS[k] = xa; ARESTAS[k + 1] = ya; ARESTAS[k + 2] = yb; ARESTAS[k + 3] = (xb - xa) / (yb - ya); ARESTAS[k + 4] = sentido;
}
/** Polígono fechado com n pontos (x0, y0, x1, y1, ...). */
function poligono(pts, n) {
    for (let i = 0; i < n; i++) {
        const j = i + 1 === n ? 0 : i + 1;
        novaAresta(pts[2 * i], pts[2 * i + 1], pts[2 * j], pts[2 * j + 1]);
    }
}
/**
 * Linhas cobertas pelas arestas guardadas -> SPANS; devolve quantos. Cada linha é
 * amostrada no centro (py+0,5) e cada pixel entra se o centro dele cai no trecho:
 * nenhum pixel é pintado duas vezes, mesmo com o caminho cruzando ele mesmo.
 */
function varrer(parImpar, W, H) {
    if (nArestas === 0) return 0;
    let ymin = Infinity, ymax = -Infinity;
    for (let k = 0; k < nArestas * 5; k += 5) {
        if (ARESTAS[k + 1] < ymin) ymin = ARESTAS[k + 1];
        if (ARESTAS[k + 2] > ymax) ymax = ARESTAS[k + 2];
    }
    const py0 = Math.max(0, Math.ceil(ymin - 0.5)), py1 = Math.min(H, Math.ceil(ymax - 0.5));
    let ns = 0;
    for (let py = py0; py < py1; py++) {
        const yc = py + 0.5;
        let nc = 0;
        for (let k = 0; k < nArestas * 5; k += 5) {
            const ya = ARESTAS[k + 1];
            if (yc < ya || yc >= ARESTAS[k + 2]) continue;
            const x = ARESTAS[k] + (yc - ya) * ARESTAS[k + 3];
            if (nc === CRUZ.length) {
                const c = new Float64Array(nc * 2); c.set(CRUZ); CRUZ = c;
                const s = new Int8Array(nc * 2); s.set(SENT); SENT = s;
            }
            let j = nc++;
            while (j > 0 && CRUZ[j - 1] > x) { CRUZ[j] = CRUZ[j - 1]; SENT[j] = SENT[j - 1]; j--; }
            CRUZ[j] = x; SENT[j] = ARESTAS[k + 4];
        }
        let w = 0, ini = 0;
        for (let j = 0; j < nc; j++) {
            const antes = w;
            w = parImpar ? w ^ 1 : w + SENT[j];
            if (antes === 0 && w !== 0) ini = CRUZ[j];
            else if (antes !== 0 && w === 0) {
                const xa = Math.max(0, Math.ceil(ini - 0.5)), xb = Math.min(W, Math.ceil(CRUZ[j] - 0.5));
                if (xa >= xb) continue;
                if ((ns + 1) * 3 > SPANS.length) { const novo = new Int32Array(SPANS.length * 2); novo.set(SPANS); SPANS = novo; }
                SPANS[3 * ns] = py; SPANS[3 * ns + 1] = xa; SPANS[3 * ns + 2] = xb;
                ns++;
            }
        }
    }
    return ns;
}

const quaseZero = (v) => (Math.abs(v) < 1e-12 ? 0 : v);  // rotate(90°) dá matriz exata, sem 6e-17 sobrando
const finito = Number.isFinite;

/** Giro de um arco como o Chrome (adjustEndAngle): sentido horário positivo, volta inteira no máximo. */
function giroDoArco(a0, a1, anti) {
    const VOLTA = 2 * Math.PI;
    if (!anti && a1 - a0 >= VOLTA) return VOLTA;
    if (anti && a0 - a1 >= VOLTA) return -VOLTA;
    if (!anti && a0 > a1) return VOLTA - ((a0 - a1) % VOLTA);
    if (anti && a0 < a1) return -(VOLTA - ((a1 - a0) % VOLTA));
    return a1 - a0;
}

function regraParImpar(regra) {
    if (regra === undefined || regra === "nonzero") return false;
    if (regra === "evenodd") return true;
    throw new TypeError(`regra de preenchimento desconhecida: ${regra} (Path2D não é suportado)`);
}

// ---------- gradiente radial ----------
class GradienteRadial {
    constructor(x0, y0, r0, x1, y1, r1) {
        if (![x0, y0, r0, x1, y1, r1].every(finito)) throw new TypeError("createRadialGradient: número inválido");
        if (r0 < 0 || r1 < 0) throw new RangeError("createRadialGradient: raio negativo");
        this._g = [x0, y0, r0, x1, y1, r1];
        this._paradas = [];  // [posição, cor], em ordem; posições iguais ficam na ordem em que chegaram
        this._pronto = null;
        this._prontoAlfa = -1;
    }
    addColorStop(pos, cor) {
        pos = Number(pos);
        if (!(pos >= 0 && pos <= 1)) throw new RangeError(`addColorStop: posição fora de 0-1: ${pos}`);
        const c = corDe(cor);
        if (!c) throw new SyntaxError(`addColorStop: cor não suportada: ${cor}`);
        let k = this._paradas.length;
        while (k > 0 && this._paradas[k - 1][0] > pos) k--;
        this._paradas.splice(k, 0, [pos, c]);
        this._pronto = null;
    }
    /** Tabela de 256 cores (com o globalAlpha) + o que a conta por pixel precisa; null = não pinta nada. */
    _preparar(alfa) {
        const [x0, y0, r0, x1, y1, r1] = this._g;
        if (x0 === x1 && y0 === y1 && r0 === r1) return null;  // o navegador não pinta nada
        if (this._pronto && this._prontoAlfa === alfa) return this._pronto;
        const p = this._paradas, tabela = new Uint32Array(256);
        // interpola em RGBA sem pré-multiplicar, como manda a especificação do canvas
        if (p.length) for (let k = 0; k < 256; k++) {
            const t = k / 255;
            let j = -1;
            while (j + 1 < p.length && p[j + 1][0] <= t) j++;
            let c;
            if (j < 0) c = p[0][1];
            else if (j === p.length - 1) c = p[j][1];
            else {
                const [t0, c0] = p[j], [t1, c1] = p[j + 1], f = (t - t0) / (t1 - t0);
                c = [0, 1, 2, 3].map((i) => c0[i] + (c1[i] - c0[i]) * f);
            }
            tabela[k] = empacotar(Math.round(c[0]), Math.round(c[1]), Math.round(c[2]), Math.round(c[3] * alfa * 255));
        }
        const cdx = x1 - x0, cdy = y1 - y0, dr = r1 - r0;
        this._pronto = { tabela, x0, y0, r0, cdx, cdy, dr, qa: cdx * cdx + cdy * cdy - dr * dr };
        this._prontoAlfa = alfa;
        return this._pronto;
    }
}

const PRETO = [0, 0, 0, 1];
function corDoEstilo(v) {
    if (v instanceof GradienteRadial) return null;
    const c = corDe(v);
    // o navegador ignoraria em silêncio; aqui é melhor quebrar alto do que pintar da cor errada
    if (!c) throw new Error(`cor não suportada: ${v}`);
    return c;
}

// ---------- contexto 2d ----------
class Contexto {
    constructor(tela) {
        this.canvas = tela;
        this._reiniciar();
    }
    _reiniciar() {
        this._a = 1; this._b = 0; this._c = 0; this._d = 1; this._e = 0; this._f = 0;
        this._alfa = 1;
        this._preenchimento = "#000000"; this._corP = PRETO;
        this._traco = "#000000"; this._corT = PRETO;
        this._largura = 1;
        this._op = SOBRE; this._nomeOp = "source-over";
        this._clip = null;  // Uint8Array (1 = pode pintar) ou null; nunca muda depois de criado, o save guarda a referência
        this._suavizar = true; this._filtro = "none";
        this._pilha = [];
        this._caminho = []; this._sub = null;  // subcaminhos { pts: [x, y, ...] já na tela, fechado }
        // pintura em andamento
        this._opAtual = SOBRE; this._pCor = 0; this._pGrad = null; this._ga = 255; this._marcando = null;
        this._i0 = 1; this._i1 = 0; this._i2 = 0; this._i3 = 1; this._i4 = 0; this._i5 = 0;  // inversa
    }

    // ----- estado -----
    get fillStyle() { return this._preenchimento; }
    set fillStyle(v) { this._corP = corDoEstilo(v); this._preenchimento = v; }
    get strokeStyle() { return this._traco; }
    set strokeStyle(v) { this._corT = corDoEstilo(v); this._traco = v; }
    get globalAlpha() { return this._alfa; }
    set globalAlpha(v) { v = Number(v); if (v >= 0 && v <= 1) this._alfa = v; }  // fora de 0-1 o navegador ignora
    get lineWidth() { return this._largura; }
    set lineWidth(v) { v = Number(v); if (v > 0 && v < Infinity) this._largura = v; }
    get globalCompositeOperation() { return this._nomeOp; }
    set globalCompositeOperation(v) {
        const op = OPERACOES.get(v);
        if (op === undefined) throw new Error(`globalCompositeOperation não suportada: ${v}`);
        this._op = op; this._nomeOp = v;
    }
    // aceitos e ignorados: aqui nunca tem suavização, e filtro (drop-shadow) não existe
    get imageSmoothingEnabled() { return this._suavizar; }
    set imageSmoothingEnabled(v) { this._suavizar = !!v; }
    get filter() { return this._filtro; }
    set filter(v) { this._filtro = String(v); }

    save() {
        this._pilha.push({
            a: this._a, b: this._b, c: this._c, d: this._d, e: this._e, f: this._f, alfa: this._alfa,
            preenchimento: this._preenchimento, corP: this._corP, traco: this._traco, corT: this._corT,
            largura: this._largura, op: this._op, nomeOp: this._nomeOp, clip: this._clip,
            suavizar: this._suavizar, filtro: this._filtro,
        });
    }
    /** Como o reset() do navegador: estado de fábrica (pilha, transformação, clip, estilos, caminho) e tela transparente. */
    reset() {
        this._reiniciar();
        this.canvas.pixels.fill(0);
    }
    restore() {
        const s = this._pilha.pop();
        if (!s) return;
        this._a = s.a; this._b = s.b; this._c = s.c; this._d = s.d; this._e = s.e; this._f = s.f; this._alfa = s.alfa;
        this._preenchimento = s.preenchimento; this._corP = s.corP; this._traco = s.traco; this._corT = s.corT;
        this._largura = s.largura; this._op = s.op; this._nomeOp = s.nomeOp; this._clip = s.clip;
        this._suavizar = s.suavizar; this._filtro = s.filtro;
    }

    // ----- transformação: tela = (a*x + c*y + e, b*x + d*y + f) -----
    translate(x, y) {
        if (!finito(x) || !finito(y)) return;
        this._e += this._a * x + this._c * y;
        this._f += this._b * x + this._d * y;
    }
    scale(x, y) {
        if (!finito(x) || !finito(y)) return;
        this._a *= x; this._b *= x; this._c *= y; this._d *= y;
    }
    rotate(angulo) {
        if (!finito(angulo)) return;
        const cs = quaseZero(Math.cos(angulo)), sn = quaseZero(Math.sin(angulo));
        this._multiplicar(cs, sn, -sn, cs, 0, 0);
    }
    transform(a, b, c, d, e, f) {
        if ([a, b, c, d, e, f].every(finito)) this._multiplicar(a, b, c, d, e, f);
    }
    _multiplicar(a, b, c, d, e, f) {
        const A = this._a, B = this._b, C = this._c, D = this._d;
        this._a = A * a + C * b; this._b = B * a + D * b;
        this._c = A * c + C * d; this._d = B * c + D * d;
        this._e += A * e + C * f; this._f += B * e + D * f;
    }
    setTransform(a, b, c, d, e, f) {
        if (a === undefined) return this.resetTransform();
        if (typeof a === "object") ({ a, b, c, d, e, f } = a);  // setTransform(g.getTransform())
        if (![a, b, c, d, e, f].every(finito)) return;
        this._a = a; this._b = b; this._c = c; this._d = d; this._e = e; this._f = f;
    }
    resetTransform() { this._a = 1; this._b = 0; this._c = 0; this._d = 1; this._e = 0; this._f = 0; }
    getTransform() { return { a: this._a, b: this._b, c: this._c, d: this._d, e: this._e, f: this._f }; }
    _inversa() {
        const det = this._a * this._d - this._b * this._c;
        if (!(det !== 0 && finito(det))) return false;
        this._i0 = this._d / det; this._i1 = -this._b / det; this._i2 = -this._c / det; this._i3 = this._a / det;
        this._i4 = (this._c * this._f - this._d * this._e) / det;
        this._i5 = (this._b * this._e - this._a * this._f) / det;
        return true;
    }

    // ----- pintura: fonte -> op -> clip -----
    _prepararFonte(estilo, cor) {
        if (cor !== null) {
            this._pGrad = null;
            this._pCor = empacotar(cor[0], cor[1], cor[2], Math.round(cor[3] * this._alfa * 255));
            return true;
        }
        if (!this._inversa()) return false;  // o gradiente vive no espaço do usuário
        this._pGrad = estilo._preparar(this._alfa);
        this._pCor = 0;
        return this._pGrad !== null;
    }
    _comecar(op) {
        this._opAtual = op;
        this._ga = Math.round(this._alfa * 255);
        if (op !== DEST_IN) { this._marcando = null; return; }
        const t = this.canvas;
        if (t._marca) t._marca.fill(0); else t._marca = new Uint8Array(t.pixels.length);
        this._marcando = t._marca;
    }
    _terminar() {
        const m = this._marcando;
        if (m === null) return;
        // destination-in apaga também o que ficou fora da forma (dentro do clip), como o navegador
        const px = this.canvas.pixels, clip = this._clip;
        for (let i = 0; i < m.length; i++) if (m[i] === 0 && (clip === null || clip[i] !== 0)) px[i] = 0;
        this._marcando = null;
    }
    /** Um pixel com a cor da fonte já pronta (pré-multiplicada, com globalAlpha). */
    _ponto(i, s) {
        if (this._clip !== null && this._clip[i] === 0) return;
        const px = this.canvas.pixels, op = this._opAtual;
        if (op === SOBRE) {
            const sa = s >>> 24;
            if (sa !== 0) px[i] = sa === 255 ? s : s + mulCanais(px[i], 255 - sa);
            return;
        }
        px[i] = compor(op, s, px[i]);
        if (this._marcando !== null) this._marcando[i] = 1;
    }
    /** Pinta [x0, x1) da linha y com a fonte preparada (cor sólida ou gradiente). */
    _pintarLinha(y, x0, x1) {
        if (this._pGrad !== null) return this._linhaGradiente(y, x0, x1);
        const px = this.canvas.pixels, clip = this._clip, op = this._opAtual, s = this._pCor;
        const W = this.canvas._w, fim = y * W + x1;
        let i = y * W + x0;
        if (op === SOBRE) {
            const sa = s >>> 24;
            if (sa === 0) return;
            if (sa === 255 && clip === null) { px.fill(s, i, fim); return; }
            const ia = 255 - sa;
            for (; i < fim; i++) if (clip === null || clip[i] !== 0) px[i] = s + mulCanais(px[i], ia);
            return;
        }
        if (op === APAGAR && clip === null) { px.fill(0, i, fim); return; }
        const marca = this._marcando;
        for (; i < fim; i++) {
            if (clip !== null && clip[i] === 0) continue;
            px[i] = compor(op, s, px[i]);
            if (marca !== null) marca[i] = 1;
        }
    }
    _linhaGradiente(y, x0, x1) {
        const G = this._pGrad, tabela = G.tabela, qa = G.qa, r0 = G.r0, dr = G.dr;
        const cy = y + 0.5;
        // centro do pixel no espaço do usuário, relativo ao 1º círculo; anda (i0, i1) por pixel
        const ux = this._i2 * cy + this._i4 - G.x0, uy = this._i3 * cy + this._i5 - G.y0;
        let i = y * this.canvas._w + x0;
        for (let x = x0; x < x1; x++, i++) {
            const cx = x + 0.5;
            const pdx = this._i0 * cx + ux, pdy = this._i1 * cx + uy;
            // maior w com o pixel no círculo w e raio r0 + w*dr >= 0 (a*w² - 2b*w + c = 0)
            const b = pdx * G.cdx + pdy * G.cdy + r0 * dr, c = pdx * pdx + pdy * pdy - r0 * r0;
            let w = NaN;
            if (qa === 0) {
                if (b !== 0) { w = c / (2 * b); if (r0 + w * dr < 0) w = NaN; }
            } else {
                const disc = b * b - qa * c;
                if (disc >= 0) {
                    const raiz = Math.sqrt(disc), w1 = (b + raiz) / qa, w2 = (b - raiz) / qa;
                    const maior = w1 > w2 ? w1 : w2, menor = w1 > w2 ? w2 : w1;
                    w = r0 + maior * dr >= 0 ? maior : r0 + menor * dr >= 0 ? menor : NaN;
                }
            }
            this._ponto(i, w === w ? tabela[w <= 0 ? 0 : w >= 1 ? 255 : (w * 255 + 0.5) | 0] : 0);
        }
    }
    _pintarSpans(n) {
        for (let k = 0; k < 3 * n; k += 3) this._pintarLinha(SPANS[k], SPANS[k + 1], SPANS[k + 2]);
    }
    /** As 4 bordas do retângulo do usuário (x0, y0)-(x1, y1), levadas pra tela. */
    _quadrilatero(x0, y0, x1, y1) {
        const a = this._a, b = this._b, c = this._c, d = this._d, e = this._e, f = this._f;
        const ax = a * x0 + c * y0 + e, ay = b * x0 + d * y0 + f, bx = a * x1 + c * y0 + e, by = b * x1 + d * y0 + f;
        const cx = a * x1 + c * y1 + e, cy = b * x1 + d * y1 + f, dx = a * x0 + c * y1 + e, dy = b * x0 + d * y1 + f;
        novaAresta(ax, ay, bx, by); novaAresta(bx, by, cx, cy); novaAresta(cx, cy, dx, dy); novaAresta(dx, dy, ax, ay);
    }

    // ----- retângulos -----
    fillRect(x, y, w, h) { this._retangulo(x, y, w, h, this._op, this._preenchimento, this._corP); }
    clearRect(x, y, w, h) { this._retangulo(x, y, w, h, APAGAR, null, null); }
    _retangulo(x, y, w, h, op, estilo, cor) {
        if (!(finito(x) && finito(y) && finito(w) && finito(h)) || w === 0 || h === 0) return;
        if (op === APAGAR) { this._pGrad = null; this._pCor = 0; } else if (!this._prepararFonte(estilo, cor)) return;
        this._comecar(op);
        const t = this.canvas, W = t._w, H = t._h;
        if (this._b === 0 && this._c === 0) {
            // só translate/scale: o retângulo continua reto, sem conta por pixel
            let X0 = this._a * x + this._e, X1 = this._a * (x + w) + this._e;
            let Y0 = this._d * y + this._f, Y1 = this._d * (y + h) + this._f;
            if (X1 < X0) { const k = X0; X0 = X1; X1 = k; }
            if (Y1 < Y0) { const k = Y0; Y0 = Y1; Y1 = k; }
            const px0 = Math.max(0, Math.ceil(X0 - 0.5)), px1 = Math.min(W, Math.ceil(X1 - 0.5));
            const py1 = Math.min(H, Math.ceil(Y1 - 0.5));
            if (px0 < px1) for (let py = Math.max(0, Math.ceil(Y0 - 0.5)); py < py1; py++) this._pintarLinha(py, px0, px1);
        } else {
            nArestas = 0;
            this._quadrilatero(x, y, x + w, y + h);
            this._pintarSpans(varrer(false, W, H));
        }
        this._terminar();
    }
    strokeRect(x, y, w, h) {
        if (!(finito(x) && finito(y) && finito(w) && finito(h))) return;
        const caminho = this._caminho, sub = this._sub;  // strokeRect não mexe no caminho atual
        this._caminho = []; this._sub = null;
        this.rect(x, y, w, h);
        this.stroke();
        this._caminho = caminho; this._sub = sub;
    }

    // ----- imagens -----
    drawImage(img, a1, a2, a3, a4, a5, a6, a7, a8) {
        if (!img || !(img.pixels instanceof Uint32Array)) throw new TypeError("drawImage: a imagem tem que ser uma Tela (ou o que decodificarPNG devolve)");
        const iw = img.width, ih = img.height, n = arguments.length;
        let sx = 0, sy = 0, sw = iw, sh = ih, dx, dy, dw = iw, dh = ih;
        if (n === 3) { dx = a1; dy = a2; }
        else if (n === 5) { dx = a1; dy = a2; dw = a3; dh = a4; }
        else if (n === 9) { sx = a1; sy = a2; sw = a3; sh = a4; dx = a5; dy = a6; dw = a7; dh = a8; }
        else throw new TypeError(`drawImage: ${n} argumentos (aceita 3, 5 ou 9)`);
        if (![sx, sy, sw, sh, dx, dy, dw, dh].every(finito)) return;
        if (!iw || !ih || !sw || !sh || !dw || !dh) return;
        // largura/altura negativa só muda o canto, não espelha (como o navegador)
        if (sw < 0) { sx += sw; sw = -sw; }
        if (sh < 0) { sy += sh; sh = -sh; }
        if (dw < 0) { dx += dw; dw = -dw; }
        if (dh < 0) { dy += dh; dh = -dh; }
        if (sx < 0 || sy < 0 || sx + sw > iw || sy + sh > ih) {
            // origem saindo da imagem: recorta e encolhe o destino na mesma proporção
            const nx0 = Math.max(0, sx), ny0 = Math.max(0, sy), nx1 = Math.min(iw, sx + sw), ny1 = Math.min(ih, sy + sh);
            if (nx1 <= nx0 || ny1 <= ny0) return;
            const kx = dw / sw, ky = dh / sh;
            dx += (nx0 - sx) * kx; dy += (ny0 - sy) * ky; dw = (nx1 - nx0) * kx; dh = (ny1 - ny0) * ky;
            sx = nx0; sy = ny0; sw = nx1 - nx0; sh = ny1 - ny0;
        }
        const src = img === this.canvas ? img.pixels.slice() : img.pixels;  // desenhar a tela nela mesma
        this._comecar(this._op);
        if (this._ga === 0 && this._op !== DEST_IN) return;
        if (this._b === 0 && this._c === 0) this._imagemReta(src, iw, ih, sx, sy, sw, sh, dx, dy, dw, dh);
        else this._imagemGirada(src, iw, ih, sx, sy, sw, sh, dx, dy, dw, dh);
        this._terminar();
    }
    /** Sem giro: o texel de cada coluna é calculado uma vez, e cada linha só copia/mistura. */
    _imagemReta(src, iw, ih, sx, sy, sw, sh, dx, dy, dw, dh) {
        const a = this._a, d = this._d, e = this._e, f = this._f;
        if (a === 0 || d === 0) return;
        const t = this.canvas, W = t._w, H = t._h;
        let X0 = a * dx + e, X1 = a * (dx + dw) + e, Y0 = d * dy + f, Y1 = d * (dy + dh) + f;
        if (X1 < X0) { const k = X0; X0 = X1; X1 = k; }
        if (Y1 < Y0) { const k = Y0; Y0 = Y1; Y1 = k; }
        const px0 = Math.max(0, Math.ceil(X0 - 0.5)), px1 = Math.min(W, Math.ceil(X1 - 0.5));
        const py0 = Math.max(0, Math.ceil(Y0 - 0.5)), py1 = Math.min(H, Math.ceil(Y1 - 0.5));
        const n = px1 - px0;
        if (n <= 0 || py0 >= py1) return;
        if (COLUNAS.length < n) COLUNAS = new Int32Array(2 * n);
        const tx0 = Math.max(0, Math.floor(sx)), tx1 = Math.min(iw, Math.ceil(sx + sw)) - 1;
        const ty0 = Math.max(0, Math.floor(sy)), ty1 = Math.min(ih, Math.ceil(sy + sh)) - 1;
        for (let k = 0; k < n; k++) {
            // (u*sw)/dw e não u*(sw/dw): com escala 1,5 o centro cai exato na borda do texel
            const u = (px0 + k + 0.5 - e) / a - dx;
            const tx = Math.floor(sx + (u * sw) / dw);
            COLUNAS[k] = tx < tx0 ? tx0 : tx > tx1 ? tx1 : tx;
        }
        // ampliada, cada texel cobre várias colunas: o caso comum lê e testa o texel uma vez por trecho
        if (TRECHOS.length < 2 * n) TRECHOS = new Int32Array(4 * n);
        nTrechos = 0;
        for (let k = 0; k < n;) {
            const c = COLUNAS[k];
            let j = k + 1;
            while (j < n && COLUNAS[j] === c) j++;
            TRECHOS[2 * nTrechos] = c; TRECHOS[2 * nTrechos + 1] = j - k;
            nTrechos++;
            k = j;
        }
        for (let py = py0; py < py1; py++) {
            const v = (py + 0.5 - f) / d - dy;
            let ty = Math.floor(sy + (v * sh) / dh);
            ty = ty < ty0 ? ty0 : ty > ty1 ? ty1 : ty;
            this._linhaTexels(py * W + px0, n, src, ty * iw);
        }
    }
    _linhaTexels(i, n, src, base) {
        const px = this.canvas.pixels, clip = this._clip, op = this._opAtual, ga = this._ga, cols = COLUNAS;
        if (op === SOBRE && clip === null && ga === 255) {  // o caso de quase todo quadro
            const tr = TRECHOS;
            for (let r = 0; r < 2 * nTrechos; r += 2) {
                const s = src[base + tr[r]], sa = s >>> 24, fim = i + tr[r + 1];
                if (sa === 255) for (; i < fim; i++) px[i] = s;
                else if (sa === 0) i = fim;
                else for (; i < fim; i++) px[i] = s + mulCanais(px[i], 255 - sa);
            }
            return;
        }
        if (op === SOBRE) {
            for (let k = 0; k < n; k++, i++) {
                let s = src[base + cols[k]];
                if (s === 0 || (clip !== null && clip[i] === 0)) continue;
                if (ga !== 255) s = mulCanais(s, ga);
                const sa = s >>> 24;
                if (sa === 255) px[i] = s;
                else if (sa !== 0) px[i] = s + mulCanais(px[i], 255 - sa);
            }
            return;
        }
        const marca = this._marcando;
        for (let k = 0; k < n; k++, i++) {
            if (clip !== null && clip[i] === 0) continue;
            let s = src[base + cols[k]];
            if (ga !== 255) s = mulCanais(s, ga);
            px[i] = compor(op, s, px[i]);
            if (marca !== null) marca[i] = 1;
        }
    }
    /** Com giro: a forma vem da varredura e cada pixel volta pela inversa até o texel. */
    _imagemGirada(src, iw, ih, sx, sy, sw, sh, dx, dy, dw, dh) {
        if (!this._inversa()) return;
        const t = this.canvas, W = t._w;
        nArestas = 0;
        this._quadrilatero(dx, dy, dx + dw, dy + dh);
        const ns = varrer(false, W, t._h);
        const ga = this._ga, px = t.pixels, clip = this._clip, op = this._opAtual, marca = this._marcando;
        // texel = origem + (ponto do usuário - destino) * escala, afim nos pixels da tela: anda (tu, tv) por coluna
        const kx = sw / dw, ky = sh / dh;
        const tu = this._i0 * kx, tv = this._i1 * ky, su = this._i2 * kx, sv = this._i3 * ky;
        const ou = sx + (this._i4 - dx) * kx, ov = sy + (this._i5 - dy) * ky;
        // limites em int32: misturar double no índice deixa o laço ~40% mais lento
        const tx0 = Math.max(0, Math.floor(sx)) | 0, tx1 = (Math.min(iw, Math.ceil(sx + sw)) - 1) | 0;
        const ty0 = Math.max(0, Math.floor(sy)) | 0, ty1 = (Math.min(ih, Math.ceil(sy + sh)) - 1) | 0, larg = iw | 0;
        for (let k = 0; k < 3 * ns; k += 3) {
            const y = SPANS[k], xa = SPANS[k + 1], xb = SPANS[k + 2], cy = y + 0.5;
            const u0 = ou + su * cy, v0 = ov + sv * cy;
            let i = y * W + xa;
            for (let x = xa; x < xb; x++, i++) {
                if (clip !== null && clip[i] === 0) continue;
                const cx = x + 0.5;
                // |0 em vez de floor: índice já inteiro; só difere abaixo de zero, e aí o clamp leva pro mesmo texel
                let tx = (u0 + tu * cx) | 0, ty = (v0 + tv * cx) | 0;
                tx = tx < tx0 ? tx0 : tx > tx1 ? tx1 : tx;
                ty = ty < ty0 ? ty0 : ty > ty1 ? ty1 : ty;
                let s = src[ty * larg + tx];
                if (ga !== 255) s = mulCanais(s, ga);
                if (op === SOBRE) {
                    const sa = s >>> 24;
                    if (sa === 255) px[i] = s;
                    else if (sa !== 0) px[i] = s + mulCanais(px[i], 255 - sa);
                } else {
                    px[i] = compor(op, s, px[i]);
                    if (marca !== null) marca[i] = 1;
                }
            }
        }
    }

    // ----- caminhos (guardados já na tela, como o canvas: a transformação vale na hora de cada ponto) -----
    beginPath() { this._caminho = []; this._sub = null; }
    moveTo(x, y) {
        if (!finito(x) || !finito(y)) return;
        this._sub = { pts: [this._a * x + this._c * y + this._e, this._b * x + this._d * y + this._f], fechado: false };
        this._caminho.push(this._sub);
    }
    lineTo(x, y) {
        if (!finito(x) || !finito(y)) return;
        if (this._sub === null) return this.moveTo(x, y);
        this._sub.pts.push(this._a * x + this._c * y + this._e, this._b * x + this._d * y + this._f);
    }
    closePath() {
        const s = this._sub;
        if (s === null || s.pts.length < 2) return;
        s.fechado = true;
        this._sub = { pts: [s.pts[0], s.pts[1]], fechado: false };  // o próximo começa no início deste
        this._caminho.push(this._sub);
    }
    rect(x, y, w, h) {
        if (!(finito(x) && finito(y) && finito(w) && finito(h))) return;
        this.moveTo(x, y); this.lineTo(x + w, y); this.lineTo(x + w, y + h); this.lineTo(x, y + h);
        this.closePath();
    }
    arc(x, y, r, a0, a1, anti = false) {
        if (r < 0) throw new RangeError(`arc: raio negativo (${r})`);
        this.ellipse(x, y, r, r, 0, a0, a1, anti);
    }
    ellipse(x, y, rx, ry, rot, a0, a1, anti = false) {
        if (![x, y, rx, ry, rot, a0, a1].every(finito)) return;
        if (rx < 0 || ry < 0) throw new RangeError(`ellipse: raio negativo (${rx}, ${ry})`);
        const giro = giroDoArco(a0, a1, !!anti);
        // segmentos curtos o bastante pro polígono não errar mais que 0,02 px na tela
        const r = Math.max(rx, ry) * Math.max(Math.hypot(this._a, this._b), Math.hypot(this._c, this._d));
        const passo = r > 0.02 ? 2 * Math.acos(1 - 0.02 / r) : Math.PI / 2;
        const n = Math.max(1, Math.min(10000, Math.ceil(Math.abs(giro) / passo)));
        const cr = quaseZero(Math.cos(rot)), sr = quaseZero(Math.sin(rot));
        for (let k = 0; k <= n; k++) {
            const ang = a0 + (giro * k) / n, ex = rx * Math.cos(ang), ey = ry * Math.sin(ang);
            const px = x + ex * cr - ey * sr, py = y + ex * sr + ey * cr;
            if (k === 0 && this._sub === null) this.moveTo(px, py); else this.lineTo(px, py);
        }
    }
    _arestasDoCaminho() {
        nArestas = 0;
        for (const s of this._caminho) if (s.pts.length >= 4) poligono(s.pts, s.pts.length / 2);
    }
    fill(regra) {
        const parImpar = regraParImpar(regra);
        if (!this._prepararFonte(this._preenchimento, this._corP)) return;
        this._arestasDoCaminho();
        this._comecar(this._op);
        this._pintarSpans(varrer(parImpar, this.canvas._w, this.canvas._h));
        this._terminar();
    }
    clip(regra) {
        const parImpar = regraParImpar(regra), t = this.canvas, W = t._w;
        this._arestasDoCaminho();
        const n = varrer(parImpar, W, t._h), m = new Uint8Array(t.pixels.length);
        for (let k = 0; k < 3 * n; k += 3) m.fill(1, SPANS[k] * W + SPANS[k + 1], SPANS[k] * W + SPANS[k + 2]);
        if (this._clip !== null) for (let i = 0; i < m.length; i++) m[i] &= this._clip[i];  // clips se somam por interseção
        this._clip = m;
    }
    stroke() {
        if (!this._inversa() || !this._prepararFonte(this._traco, this._corT)) return;
        this._arestasDoTraco();
        this._comecar(this._op);
        this._pintarSpans(varrer(false, this.canvas._w, this.canvas._h));
        this._terminar();
    }
    /**
     * Traço = um retângulo por segmento (ponta reta) + junta em ponta (miter, limite 10,
     * o padrão do canvas) em cada vértice, tudo no espaço do usuário e com a mesma
     * orientação: a sobreposição soma e o nonzero pinta uma vez só.
     */
    _arestasDoTraco() {
        const k = Math.sqrt(Math.abs(this._a * this._d - this._b * this._c));
        // sem antialiasing, linha mais fina que 1 px sumiria: fica com 1 px na tela
        const meia = this._largura * k < 1 ? 0.5 / k : this._largura / 2;
        nArestas = 0;
        for (const sub of this._caminho) {
            const d = sub.pts, u = [];
            for (let j = 0; j < d.length; j += 2) {
                const x = this._i0 * d[j] + this._i2 * d[j + 1] + this._i4, y = this._i1 * d[j] + this._i3 * d[j + 1] + this._i5;
                if (u.length && u[u.length - 2] === x && u[u.length - 1] === y) continue;
                u.push(x, y);
            }
            const fechado = sub.fechado;
            if (fechado && u.length > 4 && u[0] === u[u.length - 2] && u[1] === u[u.length - 1]) u.length -= 2;
            const n = u.length / 2;
            if (n < 2) continue;
            for (let s = 0; s < (fechado ? n : n - 1); s++) {
                const t = (s + 1) % n, px = u[2 * s], py = u[2 * s + 1], qx = u[2 * t], qy = u[2 * t + 1];
                const len = Math.hypot(qx - px, qy - py), nx = (-(qy - py) / len) * meia, ny = ((qx - px) / len) * meia;
                this._poligonoUsuario([px + nx, py + ny, qx + nx, qy + ny, qx - nx, qy - ny, px - nx, py - ny]);
            }
            for (let v = fechado ? 0 : 1; v < (fechado ? n : n - 1); v++) {
                const ant = (v + n - 1) % n, prox = (v + 1) % n, vx = u[2 * v], vy = u[2 * v + 1];
                let l = Math.hypot(vx - u[2 * ant], vy - u[2 * ant + 1]);
                const d0x = (vx - u[2 * ant]) / l, d0y = (vy - u[2 * ant + 1]) / l;
                l = Math.hypot(u[2 * prox] - vx, u[2 * prox + 1] - vy);
                const d1x = (u[2 * prox] - vx) / l, d1y = (u[2 * prox + 1] - vy) / l;
                const vira = d0x * d1y - d0y * d1x, cos = d0x * d1x + d0y * d1y;
                if (Math.abs(vira) < 1e-12 && cos > 0) continue;  // reto: não precisa de junta
                const lado = vira > 0 ? -meia : meia;  // o lado de fora da curva
                const ax = vx - d0y * lado, ay = vy + d0x * lado, bx = vx - d1y * lado, by = vy + d1x * lado;
                if (1 + cos >= 0.02) {  // razão do miter sqrt(2/(1+cos)) <= 10
                    const mx = vx + ((-d0y - d1y) * lado) / (1 + cos), my = vy + ((d0x + d1x) * lado) / (1 + cos);
                    this._poligonoUsuario([vx, vy, ax, ay, mx, my, bx, by]);
                } else this._poligonoUsuario([vx, vy, ax, ay, bx, by]);
            }
        }
    }
    /** Polígono no espaço do usuário -> arestas na tela, sempre com área negativa (a dos retângulos do traço). */
    _poligonoUsuario(p) {
        const n = p.length / 2;
        let area = 0;
        for (let i = 0; i < n; i++) { const j = (i + 1) % n; area += p[2 * i] * p[2 * j + 1] - p[2 * j] * p[2 * i + 1]; }
        const t = new Array(p.length);
        for (let i = 0; i < n; i++) {
            const o = area > 0 ? n - 1 - i : i, x = p[2 * o], y = p[2 * o + 1];
            t[2 * i] = this._a * x + this._c * y + this._e;
            t[2 * i + 1] = this._b * x + this._d * y + this._f;
        }
        poligono(t, n);
    }

    createRadialGradient(x0, y0, r0, x1, y1, r1) { return new GradienteRadial(x0, y0, r0, x1, y1, r1); }

    // ----- pixels crus (RGBA sem pré-multiplicar, como o navegador; ignoram transformação, alfa e clip) -----
    createImageData(w, h) {
        if (w && typeof w === "object") { h = w.height; w = w.width; }
        w = Math.abs(Math.trunc(w)); h = Math.abs(Math.trunc(h));
        if (!w || !h) throw new RangeError("createImageData: largura/altura zero");
        return { width: w, height: h, data: new Uint8ClampedArray(w * h * 4) };
    }
    getImageData(x, y, w, h) {
        x = Math.trunc(x); y = Math.trunc(y); w = Math.trunc(w); h = Math.trunc(h);
        if (!w || !h) throw new RangeError("getImageData: largura/altura zero");
        if (w < 0) { x += w; w = -w; }
        if (h < 0) { y += h; h = -h; }
        const img = this.createImageData(w, h), out = img.data, px = this.canvas.pixels, W = this.canvas._w, H = this.canvas._h;
        for (let j = 0; j < h; j++) {
            if (y + j < 0 || y + j >= H) continue;
            for (let k = 0; k < w; k++) {
                if (x + k < 0 || x + k >= W) continue;
                const p = px[(y + j) * W + x + k], a = p >>> 24, o = (j * w + k) * 4;
                if (a === 0) continue;
                const r = (p >>> 16) & 255, g = (p >>> 8) & 255, b = p & 255;
                if (a === 255) { out[o] = r; out[o + 1] = g; out[o + 2] = b; }
                else { out[o] = Math.round((r * 255) / a); out[o + 1] = Math.round((g * 255) / a); out[o + 2] = Math.round((b * 255) / a); }
                out[o + 3] = a;
            }
        }
        return img;
    }
    putImageData(img, x, y) {
        if (arguments.length > 3) throw new TypeError("putImageData: o retângulo sujo (dirty) não é suportado");
        if (!finito(x) || !finito(y)) return;
        x = Math.trunc(x); y = Math.trunc(y);
        const { width: w, height: h, data } = img, px = this.canvas.pixels, W = this.canvas._w, H = this.canvas._h;
        for (let j = Math.max(0, -y); j < h && y + j < H; j++) {
            for (let k = Math.max(0, -x); k < w && x + k < W; k++) {
                const o = (j * w + k) * 4;
                px[(y + j) * W + x + k] = empacotar(data[o], data[o + 1], data[o + 2], data[o + 3]);
            }
        }
    }
}

// ---------- tela ----------
const tamanho = (v) => { v = Math.floor(Number(v)); return v > 0 ? v : 0; };
class Tela {
    constructor(largura = 300, altura = 150) {
        this._ctx = null;
        this._mudarTamanho(largura, altura);
    }
    get width() { return this._w; }
    set width(v) { this._mudarTamanho(v, this._h); }
    get height() { return this._h; }
    set height(v) { this._mudarTamanho(this._w, v); }
    // como o canvas: mudar o tamanho apaga tudo e zera o estado do contexto
    _mudarTamanho(w, h) {
        this._w = tamanho(w); this._h = tamanho(h);
        this.pixels = new Uint32Array(this._w * this._h);  // BGRA pré-multiplicado
        this._marca = null;
        if (this._ctx) this._ctx._reiniciar();
    }
    getContext(tipo) {
        if (tipo !== "2d") return null;
        return this._ctx || (this._ctx = new Contexto(this));
    }
    /** Tudo transparente. */
    limpar() { this.pixels.fill(0); }
    /** Os pixels em BGRA pré-multiplicado, linha a linha. Não copia: muda junto com a tela. */
    bgra() { return Buffer.from(this.pixels.buffer, this.pixels.byteOffset, this.pixels.byteLength); }
    /** Menor retângulo { x, y, w, h } com todos os pixels diferentes de `outra`, ou null se iguais. */
    diferenca(outra) {
        if (outra._w !== this._w || outra._h !== this._h) throw new RangeError("diferenca: telas de tamanhos diferentes");
        const a = this.pixels, b = outra.pixels, W = this._w, n = a.length;
        let i = 0, j = n - 1;
        while (i < n && a[i] === b[i]) i++;
        if (i === n) return null;
        while (a[j] === b[j]) j--;
        const y0 = Math.floor(i / W), y1 = Math.floor(j / W);
        let x0 = i % W, x1 = j % W;
        for (let y = y0; y <= y1; y++) {
            const o = y * W;
            for (let x = 0; x < x0; x++) if (a[o + x] !== b[o + x]) { x0 = x; break; }
            for (let x = W - 1; x > x1; x--) if (a[o + x] !== b[o + x]) { x1 = x; break; }
        }
        return { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
    }
    /** Cópia em BGRA pré-multiplicado só do retângulo (pra mandar só o pedaço que mudou). */
    recorte(x, y, w, h) {
        if (![x, y, w, h].every(Number.isInteger) || x < 0 || y < 0 || w < 0 || h < 0 || x + w > this._w || y + h > this._h)
            throw new RangeError(`recorte fora da tela: ${x},${y} ${w}x${h} (tela ${this._w}x${this._h})`);
        const out = new Uint32Array(w * h);
        for (let j = 0; j < h; j++) out.set(this.pixels.subarray((y + j) * this._w + x, (y + j) * this._w + x + w), j * w);
        return Buffer.from(out.buffer);
    }
    copiarDe(outra) {
        if (outra._w !== this._w || outra._h !== this._h) throw new RangeError("copiarDe: telas de tamanhos diferentes");
        this.pixels.set(outra.pixels);
    }
}

// ---------- PNG ----------
const CANAIS = [1, 0, 3, 1, 2, 0, 4];  // por tipo de cor: 0 cinza, 2 RGB, 3 paleta, 4 cinza+alfa, 6 RGBA

function desfiltrar(d, h, linha, bpp) {
    for (let y = 0; y < h; y++) {
        const o = y * (linha + 1) + 1, cima = o - (linha + 1), f = d[o - 1];  // cima = começo da linha de cima
        if (f === 0) continue;
        for (let i = 0; i < linha; i++) {
            const esq = i >= bpp ? d[o + i - bpp] : 0, up = y > 0 ? d[cima + i] : 0;
            if (f === 1) d[o + i] += esq;
            else if (f === 2) d[o + i] += up;
            else if (f === 3) d[o + i] += (esq + up) >> 1;
            else if (f === 4) {
                const ce = y > 0 && i >= bpp ? d[cima + i - bpp] : 0, p = esq + up - ce;
                const pa = Math.abs(p - esq), pb = Math.abs(p - up), pc = Math.abs(p - ce);
                d[o + i] += pa <= pb && pa <= pc ? esq : pb <= pc ? up : ce;
            } else throw new Error(`decodificarPNG: filtro ${f} desconhecido na linha ${y}`);
        }
    }
}

/**
 * PNG -> Tela (serve pro drawImage). Tipos de cor 0, 2, 3 (paleta, com tRNS), 4 e 6;
 * 8 bits (e 1/2/4 no cinza e na paleta). Sem entrelaçamento.
 */
function decodificarPNG(dados) {
    const b = Buffer.isBuffer(dados) ? dados : Buffer.from(dados);
    if (b.length < 8 || b.readUInt32BE(0) !== 0x89504e47 || b.readUInt32BE(4) !== 0x0d0a1a0a) throw new Error("decodificarPNG: não é um PNG");
    let w = 0, h = 0, prof = 0, tipo = -1, paleta = null, trns = null;
    const idat = [];
    for (let p = 8; p + 8 <= b.length;) {
        const n = b.readUInt32BE(p), nome = b.toString("latin1", p + 4, p + 8);
        if (p + 12 + n > b.length) throw new Error(`decodificarPNG: pedaço ${nome} cortado`);
        const c = b.subarray(p + 8, p + 8 + n);
        p += 12 + n;
        if (nome === "IHDR") {
            w = c.readUInt32BE(0); h = c.readUInt32BE(4); prof = c[8]; tipo = c[9];
            if (c[12] !== 0) throw new Error("decodificarPNG: PNG entrelaçado (Adam7) não é suportado; salve sem entrelaçamento");
        } else if (nome === "PLTE") paleta = c;
        else if (nome === "tRNS") trns = c;
        else if (nome === "IDAT") idat.push(c);
        else if (nome === "IEND") break;
    }
    const canais = CANAIS[tipo];
    if (!canais || !(prof === 8 || ((tipo === 0 || tipo === 3) && (prof === 1 || prof === 2 || prof === 4))))
        throw new Error(`decodificarPNG: tipo de cor ${tipo} com ${prof} bits não é suportado`);
    if (!w || !h) throw new Error("decodificarPNG: sem IHDR");
    if (tipo === 3 && !paleta) throw new Error("decodificarPNG: PNG de paleta sem PLTE");
    const bruto = zlib.inflateSync(Buffer.concat(idat));
    const bitsPx = canais * prof, linha = Math.ceil((w * bitsPx) / 8);
    if (bruto.length < h * (linha + 1)) throw new Error("decodificarPNG: dados de imagem incompletos");
    desfiltrar(bruto, h, linha, Math.max(1, bitsPx >> 3));
    const maxV = (1 << prof) - 1, escala = 255 / maxV;
    // tRNS no cinza/RGB: uma cor exata (na profundidade da imagem) que vira transparente
    const trnsCinza = tipo === 0 && trns && trns.length >= 2 ? trns.readUInt16BE(0) : -1;
    const trnsRGB = tipo === 2 && trns && trns.length >= 6 ? [trns.readUInt16BE(0), trns.readUInt16BE(2), trns.readUInt16BE(4)] : null;
    const tela = new Tela(w, h), px = tela.pixels;
    for (let y = 0; y < h; y++) {
        const o = y * (linha + 1) + 1;
        for (let x = 0; x < w; x++) {
            let r, g, bl, a = 255;
            if (tipo === 0 || tipo === 3) {
                const bit = x * prof, v = (bruto[o + (bit >> 3)] >> (8 - prof - (bit & 7))) & maxV;
                if (tipo === 3) {
                    if (3 * v + 2 < paleta.length) { r = paleta[3 * v]; g = paleta[3 * v + 1]; bl = paleta[3 * v + 2]; } else r = g = bl = 0;
                    if (trns && v < trns.length) a = trns[v];
                } else {
                    r = g = bl = Math.round(v * escala);
                    if (v === trnsCinza) a = 0;
                }
            } else {
                const k = o + x * canais;
                if (tipo === 4) { r = g = bl = bruto[k]; a = bruto[k + 1]; }
                else {
                    r = bruto[k]; g = bruto[k + 1]; bl = bruto[k + 2];
                    if (tipo === 6) a = bruto[k + 3];
                    else if (trnsRGB && r === trnsRGB[0] && g === trnsRGB[1] && bl === trnsRGB[2]) a = 0;
                }
            }
            px[y * w + x] = empacotar(r, g, bl, a);
        }
    }
    return tela;
}

module.exports = { Tela, decodificarPNG, lerCor };
