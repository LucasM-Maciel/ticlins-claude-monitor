// motor/raster.js: o Canvas 2D em software que roda as animações fora do navegador.
// Pixels esperados escritos à mão pela regra do centro: o pixel entra se o centro
// dele (px+0,5; py+0,5) cai dentro da forma.
// Desempenho medido (Node 24.14, Windows, 05/10/2026; 380x440, limpar + 300 fillRect +
// 150 drawImage 16x16 escalados, 1 em 8 girado, + 20 com globalAlpha): 1,5 a 1,9 ms por
// quadro, mediana (alvo: 4 ms). A mesma cena em 760x880 (Retina, zoom 4): 5 a 8 ms.
// Texturas reais: ~/.claude-monitor/*.png e, se existir, a pasta em CM_TEXTURAS.
const { test } = require("node:test");
const assert = require("node:assert");
const fs = require("fs");
const os = require("os");
const path = require("path");
const zlib = require("zlib");
const { spawnSync } = require("child_process");
const { Tela, decodificarPNG, lerCor } = require("../../extensao/janelinha/motor/raster");

const COR = { R: [255, 0, 0, 255], G: [0, 255, 0, 255], B: [0, 0, 255, 255], Y: [255, 255, 0, 255], W: [255, 255, 255, 255], K: [0, 0, 0, 255] };
const CSS = { R: "#ff0000", G: "#00ff00", B: "#0000ff", Y: "#ffff00", W: "#ffffff", K: "#000000" };
const nova = (w, h) => { const t = new Tela(w, h); return [t, t.getContext("2d")]; };
const pixel = (t, x, y) => Array.from(t.getContext("2d").getImageData(x, y, 1, 1).data);
/** A tela em texto: '.' transparente, a letra de COR quando bate, '#' qualquer outra coisa. */
function mapa(t) {
    const d = t.getContext("2d").getImageData(0, 0, t.width, t.height).data, linhas = [];
    for (let y = 0; y < t.height; y++) {
        let s = "";
        for (let x = 0; x < t.width; x++) {
            const p = Array.from(d.subarray((y * t.width + x) * 4, (y * t.width + x) * 4 + 4));
            s += p[3] === 0 ? "." : Object.keys(COR).find((k) => COR[k].every((v, i) => v === p[i])) || "#";
        }
        linhas.push(s);
    }
    return linhas;
}
/** Tela pintada a partir do texto (o contrário de mapa): fonte de drawImage nos testes. */
function desenho(linhas) {
    const [t, g] = nova(linhas[0].length, linhas.length);
    linhas.forEach((l, y) => [...l].forEach((c, x) => { if (CSS[c]) { g.fillStyle = CSS[c]; g.fillRect(x, y, 1, 1); } }));
    return t;
}
const div255 = (x) => Math.round(x / 255);
const premult = (r, g, b, a) => (a === 0 ? 0 : ((a << 24) | (div255(r * a) << 16) | (div255(g * a) << 8) | div255(b * a)) >>> 0);

test("lerCor: os formatos das prévias, nomes, e null pro que não conhece", () => {
    assert.deepStrictEqual(lerCor("#abc"), [170, 187, 204, 1]);
    assert.deepStrictEqual(lerCor("#D77757"), [215, 119, 87, 1]);
    assert.deepStrictEqual(lerCor("#ff000080"), [255, 0, 0, 128 / 255]);
    assert.deepStrictEqual(lerCor("rgb(12,34,56)"), [12, 34, 56, 1]);
    assert.deepStrictEqual(lerCor("rgba(24,24,24,.902)"), [24, 24, 24, 0.902]);
    assert.deepStrictEqual(lerCor("rgba( 0, 0, 0, 0.35 )"), [0, 0, 0, 0.35]);
    assert.deepStrictEqual(lerCor("rgba(255,236,140,6.6e-9)"), [255, 236, 140, 6.6e-9], "0.55*brilho vira notação científica");
    assert.deepStrictEqual(lerCor("rgb(300,-5,12.6)"), [255, 0, 13, 1], "fora de 0-255 satura, fração arredonda");
    assert.deepStrictEqual(lerCor("white"), [255, 255, 255, 1]);
    assert.deepStrictEqual(lerCor("transparent"), [0, 0, 0, 0]);
    for (const ruim of ["hsl(0,0%,0%)", "#12", "rgb(1,2)", "vermelho", "", 7]) assert.strictEqual(lerCor(ruim), null, String(ruim));
    const c = lerCor("#123456");
    c[0] = 99;  // devolve cópia: o cache não estraga
    assert.deepStrictEqual(lerCor("#123456"), [18, 52, 86, 1]);
    const [, g] = nova(1, 1);
    assert.throws(() => { g.fillStyle = "hsl(0,0%,0%)"; }, /cor não suportada/);
});

test("fillRect: translate e scale fracionário pela regra do centro (pixel de 1,5 = colunas de 1 e 2)", () => {
    let [t, g] = nova(7, 3);
    g.scale(1.5, 1.5);
    "RGRG".split("").forEach((c, x) => { g.fillStyle = CSS[c]; g.fillRect(x, 0, 1, 1); });
    assert.deepStrictEqual(mapa(t), ["RGGRGG.", ".......", "......."]);
    [t, g] = nova(6, 4);
    g.translate(1.5, 0.5);  // [1,5; 3,5) x [0,5; 2,5): centros 1,5 e 2,5 nas duas direções
    g.fillStyle = CSS.B;
    g.fillRect(0, 0, 2, 2);
    assert.deepStrictEqual(mapa(t), [".BB...", ".BB...", "......", "......"]);
    [t, g] = nova(6, 4);
    g.fillStyle = CSS.R;
    g.fillRect(4, 3, -2, -2);  // negativo: o mesmo que (2, 1, 2, 2)
    g.fillRect(-10, -10, 11, 11);  // saindo da tela: só o pedaço de dentro
    g.fillRect(3, 3, 0, 5);  // largura zero: nada
    assert.deepStrictEqual(mapa(t), ["R.....", "..RR..", "..RR..", "......"]);
});

test("rotate: 90° fica exato e 45° vira losango", () => {
    let [t, g] = nova(5, 4);
    g.translate(4, 0);
    g.rotate(Math.PI / 2);  // (x, y) -> (4 - y, x)
    assert.deepStrictEqual(g.getTransform(), { a: 0, b: 1, c: -1, d: 0, e: 4, f: 0 });
    g.fillStyle = CSS.G;
    g.fillRect(0, 0, 3, 1);
    assert.deepStrictEqual(mapa(t), ["...G.", "...G.", "...G.", "....."]);
    [t, g] = nova(8, 8);
    g.translate(4, 4);
    g.rotate(Math.PI / 4);  // quadrado de lado 4 girado: |dx| + |dy| < 2,83 a partir do centro
    g.fillStyle = CSS.R;
    g.fillRect(-2, -2, 4, 4);
    assert.deepStrictEqual(mapa(t), ["........", "........", "...RR...", "..RRRR..", "..RRRR..", "...RR...", "........", "........"]);
});

test("drawImage: as 3 formas", () => {
    const img = desenho(["RG", "BY"]);
    let [t, g] = nova(4, 4);
    g.drawImage(img, 1, 1);
    assert.deepStrictEqual(mapa(t), ["....", ".RG.", ".BY.", "...."]);
    [t, g] = nova(4, 4);
    g.drawImage(img, 0, 0, 4, 4);
    assert.deepStrictEqual(mapa(t), ["RRGG", "RRGG", "BBYY", "BBYY"]);
    [t, g] = nova(4, 4);
    g.drawImage(img, 1, 0, 1, 2, 0, 0, 3, 2);  // só a coluna da direita, esticada
    assert.deepStrictEqual(mapa(t), ["GGG.", "YYY.", "....", "...."]);
    [t, g] = nova(4, 4);
    g.scale(1.5, 1.5);
    g.drawImage(img, 0, 0);
    assert.deepStrictEqual(mapa(t), ["RGG.", "BYY.", "BYY.", "...."]);
    [t, g] = nova(4, 2);
    g.drawImage(desenho(["RGBY"]), 0, 0, 6, 1);  // escala 1,5 pelo tamanho do destino: mesma regra
    assert.deepStrictEqual(mapa(t), ["RGGB", "...."]);
    assert.throws(() => g.drawImage({ width: 1, height: 1 }, 0, 0), /Tela/);
    assert.throws(() => g.drawImage(img, 0, 0, 1), /argumentos/);
});

test("drawImage: espelhado, w/h negativos, origem recortada, girado e na própria tela", () => {
    const img = desenho(["RG", "BY"]);
    let [t, g] = nova(4, 2);
    g.translate(4, 0);
    g.scale(-1, 1);
    g.drawImage(img, 0, 0);
    assert.deepStrictEqual(mapa(t), ["..GR", "..YB"], "scale(-1,1) espelha");
    [t, g] = nova(4, 2);
    g.drawImage(img, 0, 0, 2, 2, 2, 0, -2, 2);
    assert.deepStrictEqual(mapa(t), ["RG..", "BY.."], "largura negativa só muda o canto, não espelha");
    [t, g] = nova(4, 2);
    g.drawImage(img, -1, 0, 2, 1, 0, 0, 4, 2);  // metade da origem fora da imagem: o destino encolhe junto
    assert.deepStrictEqual(mapa(t), ["..RR", "..RR"]);
    [t, g] = nova(3, 2);
    g.translate(2, 0);
    g.rotate(Math.PI / 2);
    g.drawImage(img, 0, 0);
    assert.deepStrictEqual(mapa(t), ["BR.", "YG."]);
    // girado 45°: imagem opaca cobre exatamente os mesmos pixels que o fillRect
    const cheia = desenho(["WWWW", "WWWW", "WWWW", "WWWW"]), [a, ga] = nova(16, 16), [b, gb] = nova(16, 16);
    for (const x of [ga, gb]) { x.translate(8, 7.3); x.rotate(0.7); x.scale(2.2, 1.7); }
    ga.drawImage(cheia, -2, -2);
    gb.fillStyle = CSS.W;
    gb.fillRect(-2, -2, 4, 4);
    assert.strictEqual(a.diferenca(b), null);
    assert.ok(mapa(a).join("").includes("W"));
    [t, g] = nova(4, 1);
    g.fillStyle = CSS.R; g.fillRect(0, 0, 1, 1);
    g.fillStyle = CSS.G; g.fillRect(1, 0, 1, 1);
    g.drawImage(t, 1, 0);  // a origem é a tela de antes de desenhar
    assert.deepStrictEqual(mapa(t), ["RRG."]);
});

test("Clawd com pixel de 1,5: fillRect por pixel e drawImage escalado dão os mesmos bytes", () => {
    const sprite = ["..RR.RR..", ".RRRRRRR.", "RRKRRRKRR", ".RRRRRRR.", ".R.R.R.R."];
    const [a, ga] = nova(16, 9), [b, gb] = nova(16, 9);
    ga.translate(1, 0.75); ga.scale(1.5, 1.5);
    sprite.forEach((l, y) => [...l].forEach((c, x) => { if (CSS[c]) { ga.fillStyle = CSS[c]; ga.fillRect(x, y, 1, 1); } }));
    gb.translate(1, 0.75); gb.scale(1.5, 1.5);
    gb.drawImage(desenho(sprite), 0, 0);
    assert.ok(a.bgra().equals(b.bgra()));
    assert.deepStrictEqual(mapa(a)[4], ".RRRKRRRRRKRRR..");  // células de 1 e 2 px alternadas
});

test("globalAlpha multiplica fillRect e drawImage", () => {
    let [t, g] = nova(2, 1);
    g.globalAlpha = 0.5;
    g.fillStyle = CSS.R;
    g.fillRect(0, 0, 1, 1);
    assert.deepStrictEqual(pixel(t, 0, 0), [255, 0, 0, 128]);
    assert.strictEqual(t.pixels[0], 0x80800000, "guarda pré-multiplicado");
    g.globalAlpha = 2;  // fora de 0-1 o navegador ignora
    assert.strictEqual(g.globalAlpha, 0.5);
    [t, g] = nova(2, 1);
    g.fillStyle = CSS.W;
    g.fillRect(0, 0, 2, 1);
    g.globalAlpha = 0.5;
    g.fillStyle = "rgba(255,0,0,.5)";  // 0,5 da cor x 0,5 do global = alfa 64
    g.fillRect(0, 0, 1, 1);
    g.drawImage(desenho(["R"]), 1, 0);
    assert.deepStrictEqual(pixel(t, 0, 0), [255, 191, 191, 255]);
    assert.deepStrictEqual(pixel(t, 1, 0), [255, 127, 127, 255]);
});

test("globalCompositeOperation: cada uma como no navegador", () => {
    let [t, g] = nova(4, 1);
    g.fillStyle = CSS.B; g.fillRect(0, 0, 2, 1);
    g.globalCompositeOperation = "source-atop";
    g.fillStyle = CSS.R; g.fillRect(0, 0, 4, 1);
    assert.deepStrictEqual(mapa(t), ["RR.."], "source-atop só pinta onde já tinha");

    [t, g] = nova(4, 1);
    g.fillStyle = CSS.B; g.fillRect(0, 0, 4, 1);
    g.globalCompositeOperation = "destination-in";
    g.fillStyle = "rgba(0,0,0,.5)"; g.fillRect(1, 0, 2, 1);
    assert.deepStrictEqual(mapa(t)[0][0] + mapa(t)[0][3], "..", "destination-in apaga também fora da forma");
    assert.deepStrictEqual(pixel(t, 1, 0), [0, 0, 255, 128]);

    [t, g] = nova(3, 1);  // o tingir das prévias: multiply + destination-in com a própria imagem
    const img = desenho(["W.W"]);
    g.drawImage(img, 0, 0);
    g.globalCompositeOperation = "multiply"; g.fillStyle = "rgb(128,255,0)"; g.fillRect(0, 0, 3, 1);
    g.globalCompositeOperation = "destination-in"; g.drawImage(img, 0, 0);
    assert.deepStrictEqual([pixel(t, 0, 0), pixel(t, 1, 0)], [[128, 255, 0, 255], [0, 0, 0, 0]]);

    [t, g] = nova(4, 1);
    g.fillStyle = CSS.B; g.fillRect(0, 0, 4, 1);
    g.globalCompositeOperation = "destination-out";
    g.fillStyle = CSS.K; g.fillRect(1, 0, 1, 1);
    g.fillStyle = "rgba(0,0,0,.5)"; g.fillRect(2, 0, 1, 1);
    assert.deepStrictEqual([pixel(t, 0, 0), pixel(t, 1, 0), pixel(t, 2, 0)], [[0, 0, 255, 255], [0, 0, 0, 0], [0, 0, 255, 127]]);

    [t, g] = nova(2, 1);
    g.fillStyle = "rgb(200,100,50)"; g.fillRect(0, 0, 1, 1);
    g.globalCompositeOperation = "multiply";
    g.fillStyle = "rgb(128,255,0)"; g.fillRect(0, 0, 2, 1);
    assert.deepStrictEqual([pixel(t, 0, 0), pixel(t, 1, 0)], [[100, 100, 0, 255], [128, 255, 0, 255]], "sobre o vazio, multiply = a fonte");

    [t, g] = nova(2, 1);
    g.fillStyle = "rgb(100,50,0)"; g.fillRect(0, 0, 1, 1);
    g.fillStyle = "rgba(255,0,0,.5)"; g.fillRect(1, 0, 1, 1);
    g.globalCompositeOperation = "lighter";
    g.fillStyle = "rgb(100,100,100)"; g.fillRect(0, 0, 1, 1);
    g.fillStyle = "rgba(0,0,255,.5)"; g.fillRect(1, 0, 1, 1);
    g.fillStyle = "rgb(100,100,100)"; g.fillRect(0, 0, 1, 1);
    assert.deepStrictEqual([pixel(t, 0, 0), pixel(t, 1, 0)], [[255, 250, 200, 255], [128, 0, 128, 255]], "lighter soma e satura");

    assert.throws(() => { g.globalCompositeOperation = "screen"; }, /não suportada/);
    assert.strictEqual(g.globalCompositeOperation, "lighter");
});

test("clip: retângulo, evenodd (moldura), interseção, e some no restore", () => {
    let [t, g] = nova(6, 6);
    g.beginPath(); g.rect(0, 0, 6, 6); g.rect(2, 2, 2, 2); g.clip("evenodd");
    g.fillStyle = CSS.R; g.fillRect(0, 0, 6, 6);
    assert.deepStrictEqual(mapa(t), ["RRRRRR", "RRRRRR", "RR..RR", "RR..RR", "RRRRRR", "RRRRRR"]);
    [t, g] = nova(6, 6);
    g.beginPath(); g.rect(0, 0, 6, 6); g.rect(2, 2, 2, 2); g.clip();  // nonzero: os dois giram igual, não fura
    g.fillStyle = CSS.R; g.fillRect(0, 0, 6, 6);
    assert.ok(mapa(t).every((l) => l === "RRRRRR"));
    [t, g] = nova(6, 3);
    g.save();
    g.beginPath(); g.rect(0, 0, 4, 3); g.clip();
    g.beginPath(); g.rect(2, 1, 4, 2); g.clip();  // os dois juntos: interseção
    g.fillStyle = CSS.G; g.fillRect(0, 0, 6, 3);
    g.drawImage(desenho(["BBBBBB"]), 0, 2);
    assert.deepStrictEqual(mapa(t), ["......", "..GG..", "..BB.."]);
    g.restore();
    g.clearRect(0, 2, 3, 1);
    assert.deepStrictEqual(mapa(t), ["......", "..GG..", "...B.."]);
});

test("arc e ellipse cheios", () => {
    let [t, g] = nova(8, 8);
    g.fillStyle = CSS.R;
    g.beginPath(); g.arc(4, 4, 3, 0, 2 * Math.PI); g.fill();
    assert.deepStrictEqual(mapa(t), ["........", "..RRRR..", ".RRRRRR.", ".RRRRRR.", ".RRRRRR.", ".RRRRRR.", "..RRRR..", "........"]);
    [t, g] = nova(8, 8);
    g.fillStyle = CSS.B;
    g.beginPath(); g.ellipse(4, 4, 3, 2, 0, 0, 2 * Math.PI); g.fill();
    assert.deepStrictEqual(mapa(t), ["........", "........", "..BBBB..", ".BBBBBB.", ".BBBBBB.", "..BBBB..", "........", "........"]);
    [t, g] = nova(8, 8);
    g.fillStyle = CSS.B;
    g.beginPath(); g.ellipse(4, 4, 3, 2, Math.PI / 2, 0, 2 * Math.PI); g.fill();  // girada: a de cima deitada
    assert.deepStrictEqual(mapa(t), ["........", "...BB...", "..BBBB..", "..BBBB..", "..BBBB..", "..BBBB..", "...BB...", "........"]);
    [t, g] = nova(8, 8);
    g.fillStyle = CSS.G;
    g.beginPath(); g.ellipse(4, 2, 3, 3, 0, 0, Math.PI); g.closePath(); g.fill();  // meia elipse de baixo (o clip da p3b)
    assert.deepStrictEqual(mapa(t), ["........", "........", ".GGGGGG.", ".GGGGGG.", "..GGGG..", "........", "........", "........"]);
    [t, g] = nova(8, 8);
    g.fillStyle = CSS.R;
    g.beginPath(); g.arc(4, 4, 3, 0, 2 * Math.PI); g.arc(4, 4, 2, 0, 2 * Math.PI); g.fill("evenodd");
    assert.strictEqual(mapa(t)[4], ".R....R.", "evenodd fura o círculo de dentro");
    assert.throws(() => g.arc(0, 0, -1, 0, 1), RangeError);
});

test("stroke: fino, grosso, juntas, uma passada só por pixel, e strokeRect", () => {
    let [t, g] = nova(6, 4);
    g.strokeStyle = CSS.R;
    g.beginPath(); g.moveTo(0, 1.5); g.lineTo(5, 1.5); g.stroke();
    assert.deepStrictEqual(mapa(t), ["......", "RRRRR.", "......", "......"]);
    [t, g] = nova(6, 4);
    g.lineWidth = 3;
    g.beginPath(); g.moveTo(2.5, 0); g.lineTo(2.5, 4); g.stroke();
    g.lineWidth = 0.3;  // mais fino que 1 px: fica com 1 px, senão sumiria
    g.beginPath(); g.moveTo(5.5, 0); g.lineTo(5.5, 2); g.stroke();
    assert.deepStrictEqual(mapa(t), [".KKK.K", ".KKK.K", ".KKK..", ".KKK.."]);
    [t, g] = nova(8, 8);
    g.strokeStyle = CSS.B;
    g.beginPath(); g.arc(4, 4, 2.5, 0, 2 * Math.PI); g.stroke();
    assert.deepStrictEqual(mapa(t), ["........", "..BBBB..", ".BB..BB.", ".B....B.", ".B....B.", ".BB..BB.", "..BBBB..", "........"]);
    [t, g] = nova(7, 6);
    g.strokeStyle = CSS.G;
    g.lineWidth = 2;
    g.beginPath(); g.moveTo(1, 1); g.lineTo(5, 1); g.lineTo(5, 5); g.stroke();  // canto em ponta (miter)
    assert.deepStrictEqual(mapa(t), [".GGGGG.", ".GGGGG.", "....GG.", "....GG.", "....GG.", "......."]);
    [t, g] = nova(6, 1);
    g.strokeStyle = "rgba(255,0,0,.5)";
    g.beginPath(); g.moveTo(0, 0.5); g.lineTo(5, 0.5); g.lineTo(1, 0.5); g.lineTo(4, 0.5); g.stroke();
    assert.deepStrictEqual(pixel(t, 2, 0), [255, 0, 0, 128], "passou 3 vezes, pintou uma");
    [t, g] = nova(7, 6);
    g.beginPath(); g.rect(0, 0, 1, 1);
    g.strokeStyle = CSS.Y;
    g.strokeRect(1.5, 1.5, 4, 3);
    g.fillStyle = CSS.R;
    g.fill();  // o caminho de antes do strokeRect continua lá
    assert.deepStrictEqual(mapa(t), ["R......", ".YYYYY.", ".Y...Y.", ".Y...Y.", ".YYYYY.", "......."]);
    [t, g] = nova(8, 2);
    g.scale(4, 4);
    g.lineWidth = 0.5;  // 2 px na tela
    g.beginPath(); g.moveTo(1, 0); g.lineTo(1, 0.5); g.stroke();
    assert.deepStrictEqual(mapa(t), ["...KK...", "...KK..."]);
});

test("gradiente radial: concêntrico, segue a transformação e o globalAlpha", () => {
    let [t, g] = nova(9, 9);
    const gr = g.createRadialGradient(4.5, 4.5, 0, 4.5, 4.5, 4);
    gr.addColorStop(0, "rgba(255,0,0,1)");
    gr.addColorStop(1, "rgba(255,0,0,0)");
    g.fillStyle = gr;
    g.fillRect(0, 0, 9, 9);
    assert.deepStrictEqual(pixel(t, 4, 4), [255, 0, 0, 255], "no centro, a 1ª cor");
    assert.deepStrictEqual(pixel(t, 6, 4), [255, 0, 0, 127], "no meio do raio, metade");
    assert.deepStrictEqual(pixel(t, 8, 4), [0, 0, 0, 0], "na borda, a última");
    assert.deepStrictEqual(pixel(t, 0, 0), [0, 0, 0, 0], "fora do raio fica a última cor");
    const linha = [4, 5, 6, 7].map((x) => pixel(t, x, 4)[3]);
    assert.ok(linha.every((a, i) => i === 0 || a < linha[i - 1]), `alfa tem que cair: ${linha}`);
    [t, g] = nova(20, 9);
    g.translate(10, 0);
    g.globalAlpha = 0.5;
    g.fillStyle = gr;
    g.fillRect(-10, 0, 20, 9);
    assert.deepStrictEqual(pixel(t, 14, 4), [255, 0, 0, 128]);
    assert.deepStrictEqual(pixel(t, 4, 4), [0, 0, 0, 0]);
    assert.throws(() => gr.addColorStop(1.5, "#fff"), RangeError);
    assert.throws(() => gr.addColorStop(0.5, "hsl(1,1%,1%)"), SyntaxError);
});

test("getImageData/putImageData: ida e volta com alfa parcial, sem transformação nem clip", () => {
    const [t, g] = nova(4, 4);
    const img = g.createImageData(2, 2);
    img.data.set([200, 100, 50, 128, 10, 20, 30, 255, 10, 20, 30, 0, 255, 0, 0, 128]);
    g.translate(1, 1); g.globalAlpha = 0.3;
    g.beginPath(); g.rect(0, 0, 0.1, 0.1); g.clip();
    g.putImageData(img, 1, 1);
    assert.strictEqual(t.pixels[5], 0x80643219, "pré-multiplicado: 200*128/255 = 100, 50, 25");
    // 100*255/128 = 199: o pré-multiplicado perde a fração (o navegador também)
    assert.deepStrictEqual(Array.from(g.getImageData(1, 1, 2, 2).data), [199, 100, 50, 128, 10, 20, 30, 255, 0, 0, 0, 0, 255, 0, 0, 128]);
    assert.deepStrictEqual(Array.from(g.getImageData(-1, -1, 2, 2).data), new Array(16).fill(0), "fora da tela vem transparente");
    assert.deepStrictEqual(Array.from(g.getImageData(3, 3, -2, -2).data), Array.from(g.getImageData(1, 1, 2, 2).data));
    g.putImageData(img, 3, 3);  // saindo da tela: só o pedaço de dentro
    assert.deepStrictEqual(pixel(t, 3, 3), [199, 100, 50, 128]);
    assert.throws(() => g.getImageData(0, 0, 0, 1), RangeError);
    assert.deepStrictEqual([g.createImageData(img).width, g.createImageData(3, 2).data.length], [2, 24]);
});

test("save/restore guarda transformação, alfa, estilos, op, lineWidth e clip", () => {
    const [t, g] = nova(4, 1);
    g.fillStyle = CSS.R; g.strokeStyle = CSS.G; g.lineWidth = 2; g.globalAlpha = 0.5;
    g.save();
    g.translate(2, 0); g.scale(3, 3); g.fillStyle = CSS.B; g.strokeStyle = CSS.B; g.lineWidth = 7; g.globalAlpha = 1;
    g.globalCompositeOperation = "lighter"; g.imageSmoothingEnabled = false; g.filter = "drop-shadow(0 0 1px red)";
    g.beginPath(); g.rect(0, 0, 0.1, 0.1); g.clip();
    g.restore();
    g.restore();  // pilha vazia: não faz nada
    assert.deepStrictEqual(g.getTransform(), { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    assert.deepStrictEqual([g.fillStyle, g.strokeStyle, g.lineWidth, g.globalAlpha, g.globalCompositeOperation, g.imageSmoothingEnabled, g.filter],
        [CSS.R, CSS.G, 2, 0.5, "source-over", true, "none"]);
    g.globalAlpha = 1;
    g.fillRect(0, 0, 4, 1);
    assert.deepStrictEqual(mapa(t), ["RRRR"], "o clip sumiu");
});

test("transform, setTransform (números e objeto), resetTransform", () => {
    const [, g] = nova(1, 1);
    g.translate(10, 20); g.scale(2, 3);
    g.transform(1, 0, 0, 1, 5, 5);
    assert.deepStrictEqual(g.getTransform(), { a: 2, b: 0, c: 0, d: 3, e: 20, f: 35 });
    const m = g.getTransform();
    g.setTransform(1, 2, 3, 4, 5, 6);
    assert.deepStrictEqual(g.getTransform(), { a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 });
    g.setTransform(m);
    assert.deepStrictEqual(g.getTransform(), m);
    g.translate(NaN, 1);  // não finito: ignora, como o navegador
    assert.deepStrictEqual(g.getTransform(), m);
    g.setTransform();
    assert.deepStrictEqual(g.getTransform(), { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    g.rotate(Math.PI); g.resetTransform();
    assert.deepStrictEqual(g.getTransform(), { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
});

test("reset() volta tudo de fábrica (pilha, transformação, clip, estilos, caminho) e apaga a tela; getContext é sempre o mesmo", () => {
    const [t, g] = nova(4, 2);
    assert.strictEqual(t.getContext("2d"), g);
    assert.strictEqual(g.canvas, t);
    assert.strictEqual(t.getContext("webgl"), null);
    g.fillStyle = CSS.R; g.fillRect(0, 0, 4, 2);
    for (let i = 0; i < 3; i++) { g.save(); g.translate(1, 1); }  // quadro quebrou no meio: save sem restore
    g.beginPath(); g.rect(0, 0, 0.1, 0.1); g.clip();
    g.globalAlpha = 0.3; g.globalCompositeOperation = "multiply"; g.strokeStyle = CSS.B; g.lineWidth = 5;
    g.beginPath(); g.rect(0, 0, 1, 1);
    g.reset();
    assert.ok(t.pixels.every((p) => p === 0), "o reset do navegador também apaga a tela");
    assert.deepStrictEqual(g.getTransform(), { a: 1, b: 0, c: 0, d: 1, e: 0, f: 0 });
    assert.deepStrictEqual([g.fillStyle, g.strokeStyle, g.lineWidth, g.globalAlpha, g.globalCompositeOperation], ["#000000", "#000000", 1, 1, "source-over"]);
    g.restore();  // a pilha foi esvaziada
    assert.deepStrictEqual(g.getTransform().e, 0);
    g.fill();  // caminho vazio: nada
    assert.ok(t.pixels.every((p) => p === 0));
    g.fillRect(0, 0, 4, 2);
    assert.deepStrictEqual(mapa(t), ["KKKK", "KKKK"], "preto opaco, sem clip");
    assert.strictEqual(t.getContext("2d"), g, "continua o mesmo objeto");
    t.width = 3;  // como o canvas: mudar o tamanho apaga e zera o estado, mas o contexto é o mesmo
    assert.deepStrictEqual([t.width, t.height, t.pixels.length, t.getContext("2d") === g], [3, 2, 6, true]);
});

test("Tela: bgra sem copiar, diferenca, recorte, copiarDe, limpar", () => {
    const [t, g] = nova(8, 6);
    assert.deepStrictEqual([new Tela().width, new Tela().height], [300, 150]);
    g.fillStyle = "rgba(255,0,0,.5)";
    g.fillRect(0, 0, 1, 1);
    const bgra = t.bgra();
    assert.deepStrictEqual(Array.from(bgra.subarray(0, 8)), [0, 0, 128, 128, 0, 0, 0, 0], "B, G, R, A pré-multiplicado");
    g.fillStyle = CSS.B;
    g.fillRect(1, 0, 1, 1);
    assert.deepStrictEqual(Array.from(bgra.subarray(4, 8)), [255, 0, 0, 255], "é uma view: muda junto");
    const [u] = nova(8, 6);
    u.copiarDe(t);
    assert.strictEqual(t.diferenca(u), null);
    u.getContext("2d").fillRect(2, 1, 1, 1);
    u.getContext("2d").fillRect(5, 3, 1, 1);
    assert.deepStrictEqual(t.diferenca(u), { x: 2, y: 1, w: 4, h: 3 });
    u.copiarDe(t);
    u.getContext("2d").fillRect(7, 5, 1, 1);
    assert.deepStrictEqual(u.diferenca(t), { x: 7, y: 5, w: 1, h: 1 });
    u.getContext("2d").fillRect(0, 4, 1, 1);
    assert.deepStrictEqual(u.diferenca(t), { x: 0, y: 4, w: 8, h: 2 });
    const r = t.recorte(0, 0, 2, 1);
    assert.deepStrictEqual(Array.from(r), [0, 0, 128, 128, 255, 0, 0, 255]);
    g.fillRect(0, 0, 1, 1);
    assert.strictEqual(r[3], 128, "recorte é cópia");
    assert.throws(() => t.recorte(7, 0, 2, 1), RangeError);
    assert.throws(() => t.diferenca(new Tela(2, 2)), RangeError);
    assert.throws(() => t.copiarDe(new Tela(2, 2)), RangeError);
    t.limpar();
    assert.ok(t.pixels.every((p) => p === 0));
});

// ---------- PNG ----------
const TABELA_CRC = Array.from({ length: 256 }, (_, n) => { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; return c >>> 0; });
function crc32(b) { let c = 0xffffffff; for (const x of b) c = TABELA_CRC[(c ^ x) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function pedaco(nome, dados) {
    const corpo = Buffer.concat([Buffer.from(nome, "latin1"), dados]), b = Buffer.alloc(corpo.length + 8);
    b.writeUInt32BE(dados.length, 0); corpo.copy(b, 4); b.writeUInt32BE(crc32(corpo), corpo.length + 4);
    return b;
}
const paeth = (a, b, c) => { const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c); return pa <= pb && pa <= pc ? a : pb <= pc ? b : c; };
/** PNG de teste: amostras por linha (já na profundidade), filtro da linha y = y % 5 (os 5 tipos). */
function fazerPNG({ w, tipo, prof = 8, linhas, plte, trns, entrelacado = 0 }) {
    const canais = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[tipo], bpp = Math.max(1, (canais * prof) >> 3);
    const cruas = linhas.map((amostras) => {
        const b = Buffer.alloc(Math.ceil((w * canais * prof) / 8));
        amostras.forEach((v, i) => { const bit = i * prof; b[bit >> 3] |= v << (8 - prof - (bit & 7)); });
        return b;
    });
    const filtradas = cruas.map((l, y) => {
        const f = y % 5, ant = y ? cruas[y - 1] : Buffer.alloc(l.length), out = Buffer.alloc(l.length + 1);
        out[0] = f;
        for (let i = 0; i < l.length; i++) {
            const esq = i >= bpp ? l[i - bpp] : 0, cima = ant[i], ce = i >= bpp ? ant[i - bpp] : 0;
            out[i + 1] = (l[i] - [0, esq, cima, (esq + cima) >> 1, paeth(esq, cima, ce)][f]) & 255;
        }
        return out;
    });
    const ihdr = Buffer.alloc(13);
    ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(linhas.length, 4); ihdr[8] = prof; ihdr[9] = tipo; ihdr[12] = entrelacado;
    return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), pedaco("IHDR", ihdr),
        ...(plte ? [pedaco("PLTE", Buffer.from(plte))] : []), ...(trns ? [pedaco("tRNS", Buffer.from(trns))] : []),
        pedaco("IDAT", zlib.deflateSync(Buffer.concat(filtradas))), pedaco("IEND", Buffer.alloc(0))]);
}
const sorteio = (semente) => () => (semente = (semente * 1103515245 + 12345) & 0x7fffffff) >> 16 & 255;

test("PNG: RGBA, RGB, cinza+alfa com os 5 filtros", () => {
    const r = sorteio(7), w = 5, h = 10;
    const rgba = Array.from({ length: h }, () => Array.from({ length: w * 4 }, r));
    rgba[0].splice(0, 4, 10, 20, 30, 0);  // um transparente e um com alfa parcial
    rgba[0].splice(4, 4, 200, 100, 50, 128);
    let t = decodificarPNG(fazerPNG({ w, tipo: 6, linhas: rgba }));
    assert.deepStrictEqual([t.width, t.height], [w, h]);
    for (let i = 0; i < w * h; i++) assert.strictEqual(t.pixels[i], premult(...rgba[Math.floor(i / w)].slice((i % w) * 4, (i % w) * 4 + 4)), `pixel ${i}`);
    assert.deepStrictEqual(pixel(t, 1, 0), [199, 100, 50, 128]);
    const rgb = Array.from({ length: h }, () => Array.from({ length: w * 3 }, r));
    rgb[3].splice(6, 3, 1, 2, 3);
    t = decodificarPNG(fazerPNG({ w, tipo: 2, linhas: rgb, trns: [0, 1, 0, 2, 0, 3] }));
    assert.deepStrictEqual(pixel(t, 2, 3), [0, 0, 0, 0], "a cor do tRNS some");
    assert.deepStrictEqual(pixel(t, 0, 5), [...rgb[5].slice(0, 3), 255]);
    const ga = Array.from({ length: h }, () => Array.from({ length: w * 2 }, r));
    t = decodificarPNG(fazerPNG({ w, tipo: 4, linhas: ga }));
    for (let i = 0; i < w * h; i++) {
        const [v, a] = ga[Math.floor(i / w)].slice((i % w) * 2, (i % w) * 2 + 2);
        assert.strictEqual(t.pixels[i], premult(v, v, v, a), `cinza+alfa ${i}`);
    }
});

test("PNG: cinza e paleta em 1/2/4/8 bits, com tRNS e largura que não fecha o byte", () => {
    let t = decodificarPNG(fazerPNG({ w: 3, tipo: 0, linhas: [[0, 128, 255], [7, 7, 9]], trns: [0, 7] }));
    assert.deepStrictEqual(mapa(t), ["K#W", "..#"]);
    t = decodificarPNG(fazerPNG({ w: 10, tipo: 0, prof: 1, linhas: [[1, 0, 1, 1, 0, 0, 0, 0, 1, 0], [0, 1, 0, 1, 0, 1, 0, 1, 0, 1]], trns: [0, 1] }));
    assert.deepStrictEqual(mapa(t), [".K..KKKK.K", "K.K.K.K.K."], "1 bit com tRNS: o 1 (branco) some, como nas explosões");
    t = decodificarPNG(fazerPNG({ w: 3, tipo: 0, prof: 2, linhas: [[0, 1, 3]] }));
    assert.deepStrictEqual([pixel(t, 1, 0), pixel(t, 2, 0)], [[85, 85, 85, 255], [255, 255, 255, 255]]);
    t = decodificarPNG(fazerPNG({ w: 2, tipo: 0, prof: 4, linhas: [[1, 15]] }));
    assert.deepStrictEqual(pixel(t, 0, 0), [17, 17, 17, 255]);
    const plte = [255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 0];  // R G B Y
    for (const prof of [1, 2, 4, 8]) {
        const n = Math.min(4, 1 << prof), linhas = Array.from({ length: 6 }, (_, y) => Array.from({ length: 5 }, (_, x) => (x + y) % n));
        t = decodificarPNG(fazerPNG({ w: 5, tipo: 3, prof, linhas, plte: plte.slice(0, 3 * n), trns: [0] }));
        assert.deepStrictEqual(mapa(t), linhas.map((l) => l.map((v) => ".GBY"[v]).join("")), `paleta ${prof} bits (tRNS curto: do 2º em diante é opaco)`);
    }
    t = decodificarPNG(fazerPNG({ w: 1, tipo: 3, linhas: [[0]], plte: [0, 0, 255], trns: [128] }));
    assert.deepStrictEqual(pixel(t, 0, 0), [0, 0, 255, 128]);
    const [d, g] = nova(2, 2);
    g.drawImage(t, 0, 0, 2, 2);  // o PNG é uma Tela: serve pro drawImage
    assert.deepStrictEqual(pixel(d, 1, 1), [0, 0, 255, 128]);
});

test("PNG: entrelaçado, 16 bits e lixo dão erro claro", () => {
    assert.throws(() => decodificarPNG(fazerPNG({ w: 1, tipo: 0, linhas: [[0]], entrelacado: 1 })), /entrelaçado/);
    assert.throws(() => decodificarPNG(fazerPNG({ w: 1, tipo: 0, prof: 16, linhas: [[0]] })), /16 bits não é suportado/);
    assert.throws(() => decodificarPNG(Buffer.from("GIF89a....")), /não é um PNG/);
    const bom = fazerPNG({ w: 1, tipo: 0, linhas: [[0]] });
    assert.throws(() => decodificarPNG(bom.subarray(0, bom.length - 20)), /cortado/);
});

function texturasReais() {
    const pastas = [path.join(os.homedir(), ".claude-monitor"), process.env.CM_TEXTURAS].filter((p) => p && fs.existsSync(p));
    return pastas.flatMap((p) => fs.readdirSync(p).filter((f) => f.endsWith(".png")).map((f) => path.join(p, f)));
}
function pythonComPIL() {
    for (const py of ["python3", "python"]) {
        const r = spawnSync(py, ["-c", "import PIL"], { encoding: "utf8" });
        if (r.status === 0) return py;
    }
    return null;
}

test("PNG: as texturas reais do Minecraft abrem e batem pixel a pixel com o PIL", async (t) => {
    const arquivos = texturasReais();
    if (!arquivos.length) return t.skip("sem texturas nesta máquina (rode o minecraft.js ou ponha a pasta em CM_TEXTURAS)");
    const telas = new Map(arquivos.map((f) => [f, decodificarPNG(fs.readFileSync(f))]));
    for (const [f, tela] of telas) assert.ok(tela.width > 0 && tela.height > 0 && tela.pixels.some((p) => p !== 0), f);
    await t.test("igual ao PIL (pré-multiplicando o RGBA dele)", { skip: !pythonComPIL() && "sem Python com PIL" }, () => {
        const script = "import sys, json, base64\nfrom PIL import Image\nout = {}\nfor f in sys.argv[1:]:\n" +
            "    im = Image.open(f).convert('RGBA')\n    out[f] = [im.width, im.height, base64.b64encode(im.tobytes()).decode()]\nprint(json.dumps(out))";
        const r = spawnSync(pythonComPIL(), ["-c", script, ...arquivos], { encoding: "utf8", maxBuffer: 1 << 28 });
        assert.strictEqual(r.status, 0, r.stderr);
        const pil = JSON.parse(r.stdout);
        for (const [f, tela] of telas) {
            const [w, h, b64] = pil[f], d = Buffer.from(b64, "base64");
            assert.deepStrictEqual([tela.width, tela.height], [w, h], f);
            for (let i = 0; i < w * h; i++) {
                if (tela.pixels[i] !== premult(d[4 * i], d[4 * i + 1], d[4 * i + 2], d[4 * i + 3]))
                    assert.fail(`${path.basename(f)}: pixel (${i % w}, ${Math.floor(i / w)}) difere do PIL`);
            }
        }
        t.diagnostic(`${arquivos.length} texturas iguais ao PIL`);
    });
});

// ---------- determinismo e desempenho ----------
const PALETA = ["#D77757", "#1A1A1A", "#F58A1F", "#2453C9", "#FDE047", "rgba(24,24,24,.902)", "#22C55E", "rgba(0,0,0,.35)", "#93C5FD", "#EF4444", "#FFFFFF", "rgba(74,222,128,.55)"];
function texturas() {
    const r = sorteio(42);
    return Array.from({ length: 8 }, () => {
        const t = new Tela(16, 16), g = t.getContext("2d"), img = g.createImageData(16, 16);
        for (let i = 0; i < 256; i++) img.data.set(r() < 40 ? [0, 0, 0, 0] : [r(), r(), r(), r() < 30 ? 128 : 255], 4 * i);
        g.putImageData(img, 0, 0);
        return t;
    });
}
/** O quadro típico: limpar + 300 fillRect + 150 drawImage 16x16 escalados (1 em 8 girado) + 20 com globalAlpha. */
function quadroTipico(t, g, tex, n) {
    t.limpar();
    g.setTransform(2, 0, 0, 2, 0, 0);  // zoom 2 das prévias
    for (let i = 0; i < 300; i++) {
        g.save();
        g.translate((i * 37 + n) % 180, (i * 53) % 210);
        g.scale(1.5, 1.5);
        if (i % 30 === 0) g.globalAlpha = 0.5;
        g.fillStyle = PALETA[i % PALETA.length];
        g.fillRect(0, 0, 1 + (i % 5), 1 + (i % 3));
        g.restore();
    }
    for (let i = 0; i < 150; i++) {
        g.save();
        g.translate((i * 29 + 2 * n) % 170, (i * 41) % 200);
        if (i % 8 === 0) g.rotate(0.1 * i + 0.05 * n);
        if (i % 15 === 0) g.globalAlpha = 0.6;
        const k = [1, 1.5, 2][i % 3];
        g.scale(i % 4 === 0 ? -k : k, k);
        g.drawImage(tex[i % tex.length], -8, -8);
        g.restore();
    }
}
/** Tudo que o raster sabe fazer, num quadro só. */
function cenaCompleta(t, g, tex) {
    quadroTipico(t, g, tex, 3);
    g.save();
    g.beginPath(); g.rect(10, 10, 150, 180); g.rect(20, 20, 50, 50); g.clip("evenodd");
    const gr = g.createRadialGradient(60, 60, 2, 70, 65, 40);
    gr.addColorStop(0, "rgba(255,236,140,.55)"); gr.addColorStop(0.4, "#2453C9"); gr.addColorStop(1, "rgba(255,236,140,0)");
    g.fillStyle = gr; g.fillRect(0, 0, 190, 220);
    g.strokeStyle = "rgba(229,231,235,.8)"; g.lineWidth = 1.5;
    g.beginPath(); g.ellipse(90, 100, 30, 20, 0.3, 0, 2 * Math.PI); g.moveTo(5, 5); g.lineTo(120, 40); g.lineTo(60, 150); g.stroke();
    g.globalCompositeOperation = "lighter"; g.drawImage(tex[1], 0, 0, 16, 16, 40, 120, 48, 30);
    g.globalCompositeOperation = "multiply"; g.fillStyle = "rgb(128,255,0)"; g.fillRect(100, 100, 40, 40);
    g.globalCompositeOperation = "source-atop"; g.beginPath(); g.arc(120, 60, 25, 0.2, 4); g.fill();
    g.globalCompositeOperation = "destination-out"; g.translate(150, 150); g.rotate(1); g.fillRect(-10, -10, 20, 20);
    g.restore();
}

test("determinismo: a mesma cena dá os mesmos bytes (tela nova ou reaproveitada)", () => {
    const tex = texturas(), [a, ga] = nova(380, 440), [b, gb] = nova(380, 440);
    cenaCompleta(a, ga, tex);
    cenaCompleta(b, gb, tex);
    assert.ok(a.bgra().equals(b.bgra()));
    gb.reset();
    cenaCompleta(b, gb, tex);
    assert.ok(a.bgra().equals(b.bgra()));
    const cobertos = a.pixels.filter((p) => p !== 0).length;
    assert.ok(cobertos > 50000, `a cena pintou pouco: ${cobertos}`);
});

test("desempenho: quadro típico 380x440 abaixo de 4 ms (falha só acima de 16)", (t) => {
    const tex = texturas(), [tela, g] = nova(380, 440);
    for (let n = 0; n < 30; n++) quadroTipico(tela, g, tex, n);  // aquece o JIT
    const rodadas = [];  // mediana de 7 rodadas de 30 quadros: a máquina oscila
    for (let r = 0; r < 7; r++) {
        const ini = process.hrtime.bigint();
        for (let n = 0; n < 30; n++) quadroTipico(tela, g, tex, n);
        rodadas.push(Number(process.hrtime.bigint() - ini) / 1e6 / 30);
    }
    const ms = rodadas.sort((a, b) => a - b)[3];
    t.diagnostic(`${ms.toFixed(2)} ms por quadro (mediana; melhor ${rodadas[0].toFixed(2)})`);
    assert.ok(ms < 16, `${ms.toFixed(2)} ms por quadro (alvo 4 ms)`);
});
