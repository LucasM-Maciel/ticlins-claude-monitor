'use strict';
// Som das cenas épicas. A cena diz o que toca e quando, em `sons: [[t, arquivo, ganho = 1,
// tom = 1, dur], ...]` (t em s desde o começo da cena; arquivo relativo à pasta da janelinha,
// ex. 'sons-padrao/epico-tiro.wav' ou 'sons/dragao_rugido1.wav'; tom > 1 = mais agudo e
// mais curto, como o XP do jogo; dur = corta ali, sumindo em até 0,25 s). Quando ela começa, o motor junta tudo num .wav só (mono,
// 16 bits, 44100) e a janelinha toca do começo, com o volume do botão direito; cortada no
// meio (pergunta), a janelinha para. Som que não existe fica de fora: o resto toca.
const TAXA = 44100;

// .wav PCM 8/16/24/32 bits ou float de 32, qualquer taxa e canais -> { taxa, amostras } (mono, -1..1)
function lerWav(buf) {
  if (buf.length < 12 || buf.toString('latin1', 0, 4) !== 'RIFF' || buf.toString('latin1', 8, 12) !== 'WAVE') throw new Error('não é .wav');
  let fmt = null, dados = null;
  for (let i = 12; i + 8 <= buf.length;) {
    const id = buf.toString('latin1', i, i + 4), n = buf.readUInt32LE(i + 4);
    if (id === 'fmt ') {
      let tipo = buf.readUInt16LE(i + 8);
      if (tipo === 0xFFFE) tipo = buf.readUInt16LE(i + 32);  // WAVE_FORMAT_EXTENSIBLE: o formato de verdade abre o GUID
      fmt = { tipo, canais: buf.readUInt16LE(i + 10), taxa: buf.readUInt32LE(i + 12), bits: buf.readUInt16LE(i + 22) };
    } else if (id === 'data') dados = buf.subarray(i + 8, Math.min(buf.length, i + 8 + n));
    i += 8 + n + (n & 1);
  }
  if (!fmt || !dados) throw new Error('.wav sem fmt ou data');
  const { tipo, canais, bits } = fmt, B = bits / 8;
  const ler = tipo === 3 && bits === 32 ? o => dados.readFloatLE(o)
    : tipo !== 1 ? null
      : bits === 8 ? o => (dados[o] - 128) / 128
        : bits === 16 ? o => dados.readInt16LE(o) / 32768
          : bits === 24 ? o => dados.readIntLE(o, 3) / 8388608
            : bits === 32 ? o => dados.readInt32LE(o) / 2147483648 : null;
  if (!ler || !canais || !fmt.taxa) throw new Error(`.wav que não sei ler (formato ${tipo}, ${bits} bits)`);
  const quadros = Math.floor(dados.length / (B * canais)), amostras = new Float32Array(quadros);
  for (let q = 0; q < quadros; q++) {
    let s = 0;
    for (let c = 0; c < canais; c++) s += ler((q * canais + c) * B);
    amostras[q] = s / canais;
  }
  return { taxa: fmt.taxa, amostras };
}

function wav16(mix) {
  const n = mix.length, out = Buffer.alloc(44 + 2 * n);
  out.write('RIFF', 0, 'latin1'); out.writeUInt32LE(36 + 2 * n, 4); out.write('WAVEfmt ', 8, 'latin1');
  out.writeUInt32LE(16, 16); out.writeUInt16LE(1, 20); out.writeUInt16LE(1, 22);  // PCM, mono
  out.writeUInt32LE(TAXA, 24); out.writeUInt32LE(TAXA * 2, 28); out.writeUInt16LE(2, 32); out.writeUInt16LE(16, 34);
  out.write('data', 36, 'latin1'); out.writeUInt32LE(2 * n, 40);
  for (let i = 0; i < n; i++) out.writeInt16LE(Math.round(Math.max(-1, Math.min(1, mix[i])) * 32767), 44 + 2 * i);
  return out;
}

// as pistas da cena -> o .wav (Buffer), ou null se nenhum som deu pra ler. ler(arquivo)
// devolve o Buffer do arquivo (ou lança erro); os que falharam vão pra `faltando`.
function mixar(pistas, ler, faltando = []) {
  const lidos = new Map(), partes = [];
  for (const [t, arquivo, ganho = 1, tom = 1, dur = Infinity] of pistas) {
    if (!lidos.has(arquivo)) {
      try { lidos.set(arquivo, lerWav(ler(arquivo))); } catch { lidos.set(arquivo, null); faltando.push(arquivo); }
    }
    const w = lidos.get(arquivo);
    if (!w || w.amostras.length < 2 || !(t >= 0) || !(dur > 0)) continue;
    const passo = w.taxa * tom / TAXA, m = Math.min(Math.floor((w.amostras.length - 1) / passo), Math.floor(dur * TAXA));
    partes.push({ i0: Math.round(t * TAXA), a: w.amostras, ganho, passo, m, some: dur < Infinity ? Math.max(1, Math.round(Math.min(0.25, dur / 4) * TAXA)) : 0 });
  }
  if (!partes.length) return null;
  let n = 0;
  for (const p of partes) n = Math.max(n, p.i0 + p.m + 1);
  const mix = new Float32Array(n);
  for (const { i0, a, ganho, passo, m, some } of partes) {
    for (let i = 0; i <= m; i++) {  // linear: só o tom do Minecraft (e taxa diferente) cai entre amostras
      const x = i * passo, k = Math.floor(x), f = x - k;
      const v = k + 1 < a.length ? a[k] + (a[k + 1] - a[k]) * f : a[k];
      mix[i0 + i] += ganho * v * (some && m - i < some ? (m - i) / some : 1);
    }
  }
  // passou do teto: abaixa tudo junto, sem distorcer
  let pico = 0;
  for (let i = 0; i < n; i++) pico = Math.max(pico, Math.abs(mix[i]));
  if (pico > 0.98) for (let i = 0; i < n; i++) mix[i] *= 0.98 / pico;
  return wav16(mix);
}

module.exports = { TAXA, lerWav, mixar, wav16 };
