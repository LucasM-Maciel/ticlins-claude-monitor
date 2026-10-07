'use strict';
// Parado há muito tempo, tema Minecraft: PESCANDO. Nada rodando há um tempo: o Clawd cava um
// buraco na grama da borda do cartão, na frente dele (picareta, rachaduras e cacos do jogo; o
// bloco de grama vira item e ele pega), enche com um balde de água (a água parada do jogo,
// pintada de azul como o jogo pinta), senta, troca pra vara de pesca e lança: a boia voa em
// arco e cai na água com respingo. Laço (horas): a boia balança, a vara balança de leve, ele
// pisca. Uma mordida por janela de JANELA s, num instante sorteado da janela: bolhinhas vêm na
// direção da boia, ela afunda e ele puxa; sai um peixe (bacalhau; salmão às vezes; o tropical
// raro; de vez em quando um lixo do jogo, osso ou linha) que voa por cima dele e cai numa
// pilhinha atrás dele (as PILHA primeiras pegas; as seguintes voam pra ele: guardou), com
// orbes de XP. Às vezes nada: ele puxa atrasado e a boia volta vazia. Aí lança de novo.
// Saída (algo voltou a rodar): recolhe a boia, levanta, troca pra picareta, pega os peixes (e
// o que estiver voando) e a água some num poof (o bloco de grama volta pro buraco).
// Referencial do Clawd: x+ pra frente, y- pra cima, chão = 0 = em cima da grama da borda. O
// buraco fica na faixa da grama da moldura (8 de altura): nada entra no conteúdo do cartão.
// O quadro é função do tempo: o que acontece na janela k sai de rng(semente + k). A saída só recebe
// o Mundo e o tCorte: cena(m) guarda a semente em m.estado.pesca pra ela refazer o estado do corte.
const { DEG, lim, sai, entra, rng, IMG, tela, arte, cache } = require('./comum');
const { desenhaClawd, golpe } = require('./clawd');
const { desenhaCoracoes, fazCacos, desenhaCacos, desenhaDrop, fazOrbes, desenhaOrbes, fazPoof, desenhaPoof } = require('./minecraft-kit');

const N = (base, n) => Array.from({ length: n }, (_, i) => base + i);
const TEXTURAS = ['picareta', 'vara', 'vara_lancada', 'boia', 'agua', 'grama', 'terra', 'orbe',
  'it_bacalhau', 'it_salmao', 'it_peixe_tropical', 'it_osso', 'it_linha', ...N('racha', 10), ...N('poof', 8)];

// ---------- onde fica cada coisa ----------
const B0 = 18, B1 = 42;      // o buraco (o laguinho), na faixa de grama: x de B0 a B1
const FUNDO = 6.5;           // fundo do buraco (a faixa de grama tem 8; o conteúdo começa em 8)
const SUP = 1.5;             // a superfície da água cheia (a água do jogo fica um tico abaixo do bloco)
const BX = 32;               // onde a boia cai
const AZUL = '#3F76E4';      // a cor da água (o jogo pinta a textura cinza com ela)
const JANELA = 28;           // s: uma mordida por janela (entre ~15 e ~40 s de uma pra outra)
const L0 = 4.6;              // s: fim da entrada, começo do laço (a boia já assentou)
const PILHA = 6;             // peixes visíveis na pilhinha (os seguintes ele guarda)
// as vagas da pilhinha atrás dele (x, y), de baixo pra cima
const VAGAS = [[-21, 0], [-27, 0], [-33, 0], [-24, -3], [-30, -3], [-27, -6]];
const ITEM = 7;              // tamanho de um item no chão (como os drops dos eventos)

// ---------- o balde (o jogo não tem textura de balde na lista: pixel art nossa) ----------
const BALDE = [
  '...kkkkkk...',
  '..k......k..',
  '.kkkkkkkkkk.',
  'kLaaaaaaaaLk',
  'kLLLLLLLLLLk',
  '.kMMMMMMMDk.',
  '.kMLMMMMMDk.',
  '..kMLMMMDk..',
  '..kMMMMMDk..',
  '...kkkkkk...',
];
const COR_BALDE = { k: '#2A2A2A', L: '#D6D6D6', M: '#A4A4A4', D: '#6B6B6B' };
const baldeArte = cheio => arte(BALDE, { ...COR_BALDE, a: cheio ? AZUL : '#3A3A3A' });
const BALDE_C = [18, -7];    // o meio do balde na mão (em pé)

// ---------- a água: os 32 quadros da textura cinza pintados de azul (multiplicar), prontos 1x ----------
const AGUAS = new WeakMap();
function quadroDaAgua(t) {
  const img = IMG.agua;
  if (!img) return null;
  let qs = AGUAS.get(img);
  if (!qs) AGUAS.set(img, qs = new Array(Math.max(1, Math.floor(img.height / img.width))));
  const i = Math.floor(t / 0.1) % qs.length;  // 0,1 s por quadro, como no jogo
  if (!qs[i]) {  // cada quadro pintado na 1ª vez que aparece (não os 32 de uma vez)
    const w = img.width, c = tela(w, w), x = c.getContext('2d');
    x.drawImage(img, 0, i * w, w, w, 0, 0, w, w);
    x.globalCompositeOperation = 'multiply'; x.fillStyle = AZUL; x.fillRect(0, 0, w, w);
    x.globalCompositeOperation = 'destination-in'; x.drawImage(img, 0, i * w, w, w, 0, 0, w, w);
    qs[i] = c;
  }
  return qs[i];
}
// um pedaço de largura w a partir de x, ladrilhando a textura a 1 px por pixel (cortando, sem clip)
function ladrilho(g, img, x, y, w, h, sy = 0) {
  if (!img || w <= 0 || h <= 0) return;
  const tw = img.width, th = Math.min(img.width, img.height);
  for (let i = 0; i < w; i += tw) {
    const lw = Math.min(tw, w - i), lh = Math.min(th - sy, h);
    g.drawImage(img, 0, sy, lw, lh, x + i, y, lw, lh);
  }
}
// o buraco cavado na grama (terra escura) e as rachaduras de quando ele ainda está cavando
function desenhaBuraco(g) {
  ladrilho(g, IMG.terra, B0, 0, B1 - B0, FUNDO, 4);
  g.fillStyle = 'rgba(0,0,0,.55)'; g.fillRect(B0, 0, B1 - B0, FUNDO);
  g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(B0, 0, B1 - B0, 1); g.fillRect(B0, 0, 1, FUNDO); g.fillRect(B1 - 1, 0, 1, FUNDO);
}
function desenhaRachas(g, p, alfa = 1) {
  const img = IMG['racha' + Math.min(9, Math.floor(p * 10))];
  if (!img || alfa <= 0) return;
  g.save(); g.globalAlpha *= 0.85 * alfa;
  const lado = (B1 - B0) / 2, h = 7;  // dois blocos de 11, só a parte da faixa (7 de 11)
  for (let i = 0; i < 2; i++) g.drawImage(img, 0, 0, img.width, img.height * h / lado, B0 + i * lado, 0, lado, h);
  g.restore();
}
// a água do buraco, da altura y até o fundo
function desenhaAgua(g, y, t) {
  const q = quadroDaAgua(t);
  if (!q || y >= FUNDO) return;
  g.fillStyle = 'rgba(38,78,170,.8)'; g.fillRect(B0, y, B1 - B0, FUNDO - y);  // o fundo da água (sem ele, a terra escura apaga o azul)
  ladrilho(g, q, B0, y, B1 - B0, FUNDO - y);
  g.fillStyle = 'rgba(150,190,255,.45)'; g.fillRect(B0, y, B1 - B0, 0.6);  // o brilho da superfície
}

// ---------- a vara e o que mais ele segura ----------
// a ferramenta do clawd.js (cabo no pixel 2,5;13,5 na mão em 12;-7,5, 1,1 px por pixel), com tamanho
function naMao(g, nome, ang, dy, esc = 1) {
  const img = IMG[nome];
  if (!img || esc <= 0) return;
  g.save(); g.translate(12, -7.5 + dy); g.rotate(ang * DEG); if (esc !== 1) g.scale(esc, esc);
  g.drawImage(img, -2.75, -14.85, 17.6, 17.6); g.restore();
}
// a ponta da vara (o pixel 14,5;1,5 da textura)
function pontaDaVara(ang, dy) {
  const c = Math.cos(ang * DEG), s = Math.sin(ang * DEG);
  return { x: 12 + 13.2 * c + 13.2 * s, y: -7.5 + dy + 13.2 * s - 13.2 * c };
}
function desenhaItem(g, it, dy) {
  if (it.nome === 'balde' || it.nome === 'balde_vazio') {
    if (it.esc <= 0) return;
    g.save(); g.translate(BALDE_C[0], BALDE_C[1] + dy); g.rotate(it.ang * DEG); g.scale(it.esc, it.esc);
    g.drawImage(baldeArte(it.nome === 'balde'), -4.5, -3.75, 9, 7.5); g.restore();
  } else naMao(g, it.nome, it.ang, dy, it.esc);
}
// a boca do balde inclinado (de onde a água cai)
function bocaDoBalde(ang) { const a = ang * DEG; return { x: BALDE_C[0] + 2.6 * Math.sin(a), y: BALDE_C[1] - 2.6 * Math.cos(a) }; }
// troca de item como na barra do jogo: o da mão desce e some, o novo sobe (dur s a partir de t0)
function troca(t, t0, de, para, angDe = 0, angPara = 0, dur = 0.3) {
  const u = lim((t - t0) / dur, 0, 1);
  if (u < 0.5) { const k = sai(u / 0.5); return { nome: de, ang: angDe + (75 - angDe) * k, esc: 1 - 0.55 * k }; }
  const k = 1 - sai((u - 0.5) / 0.5);
  return { nome: para, ang: angPara + (75 - angPara) * k, esc: 1 - 0.55 * k };
}

// ---------- partículas ----------
// respingo: pinguinhos brancos e azul-claros que pulam e caem (0,45 s)
const RESPINGO = ['#FFFFFF', '#CFE2FF', '#9EC2FF'];
function fazRespingo(r, n, forca = 1) {
  return Array.from({ length: n }, () => ({ vx: (r() - 0.5) * 34 * forca, vy: -(22 + r() * 34) * forca, vida: 0.3 + r() * 0.18, cor: RESPINGO[Math.floor(r() * 3)], tam: r() < 0.3 ? 1.5 : 1 }));
}
function desenhaRespingo(g, lista, x, y, e) {
  if (e < 0 || e >= 0.5) return;
  const a0 = g.globalAlpha;
  for (const p of lista) {
    if (e >= p.vida) continue;
    const py = y + p.vy * e + 160 * e * e;
    if (py > y + 1) continue;  // caiu de volta na água
    g.globalAlpha = a0 * (e > p.vida - 0.12 ? (p.vida - e) / 0.12 : 1);
    g.fillStyle = p.cor; g.fillRect(x + p.vx * e - p.tam / 2, py - p.tam, p.tam, p.tam);
  }
  g.globalAlpha = a0;
}
// as bolhinhas que vêm na direção da boia antes da mordida (como no jogo): 1,4 s
function desenhaBolhas(g, lado, e) {
  if (e < 0 || e >= 1.4) return;
  const u = e / 1.4, x0 = lado < 0 ? B0 + 1.5 : B1 - 1.5, a0 = g.globalAlpha;
  for (let i = 0; i < 4; i++) {
    const v = u - i * 0.06;
    if (v < 0) continue;
    const x = x0 + (BX - x0) * sai(v);
    g.globalAlpha = a0 * (1 - i * 0.22) * (u > 0.9 ? (1 - u) / 0.1 : 1);
    g.fillStyle = i % 2 ? '#CFE2FF' : '#FFFFFF';
    g.fillRect(x - 0.5, SUP - 1 + Math.sin(e * 23 + i * 2) * 0.4, 1, 1);
  }
  g.globalAlpha = a0;
}

// ---------- o que acontece em cada janela do laço ----------
// peixe: o item pescado (null = puxou vazio); b: instante da mordida; lado: de onde vêm as bolhas
const JANELAS = cache(48);
function janela(sem, k) {
  const chave = sem + ':' + k, pronta = JANELAS.get(chave);
  if (pronta) return pronta;
  const r = rng((sem + 7919 * (k + 1)) >>> 0);
  const b = L0 + k * JANELA + 6 + r() * 12.5, u = r(), lado = r() < 0.5 ? -1 : 1;
  let peixe;
  if (k === 0) peixe = u < 0.7 ? 'it_bacalhau' : 'it_salmao';  // a primeira sempre vem
  else if (u < 0.12) peixe = null;
  else if (u < 0.17) peixe = r() < 0.5 ? 'it_osso' : 'it_linha';
  else if (u < 0.22) peixe = 'it_peixe_tropical';
  else if (u < 0.45) peixe = 'it_salmao';
  else peixe = 'it_bacalhau';
  const J = {
    b, peixe, lado,
    puxa: peixe ? 0.25 : 0.75,        // s depois da mordida em que ele puxa (vazio: atrasado)
    relanca: peixe ? 1.5 : 1.65,      // s depois da mordida em que ele lança de novo
    respMordida: fazRespingo(r, peixe ? 7 : 4, peixe ? 1 : 0.6),
    respPuxa: fazRespingo(r, 8, 1.1),
    respCai: fazRespingo(r, 6, 0.8),
    orbes: peixe ? fazOrbes(r, 1 + Math.floor(r() * 3)) : [],
  };
  return JANELAS.set(chave, J);
}
// a pilhinha no instante t: as PILHA primeiras pegas que já caíram; e a vaga do peixe da janela k (-1 = cheia: ele guarda)
function pilhaEm(sem, t, k) {
  const pilha = [];
  let n = 0, vaga = -1;
  for (let j = 0; j <= k && n < PILHA; j++) {
    const J = janela(sem, j);
    if (!J.peixe) continue;
    if (j === k) vaga = n;
    else pilha.push({ nome: J.peixe, x: VAGAS[n][0], y: VAGAS[n][1] });
    n++;
  }
  return { pilha, vaga };
}
const FUGA = 0.8;  // s do voo do peixe da água até a pilha
// o peixe voando (e: s desde que saiu da água): por cima do Clawd até a vaga (ou até ele: guardou)
function voo(J, vaga, e) {
  if (e < 0) return null;
  const alvo = vaga >= 0 ? VAGAS[vaga] : [0, -8];
  if (e < FUGA) {
    const u = e / FUGA, x = BX + (alvo[0] - BX) * u, y = SUP - 2 + (alvo[1] - SUP + 2) * u - 30 * Math.sin(Math.PI * u);
    return { nome: J.peixe, x, y, giro: Math.abs(Math.cos(e * 9)) + 0.08, esc: vaga >= 0 ? 1 : 1 - 0.5 * Math.max(0, (u - 0.7) / 0.3) };
  }
  if (vaga < 0) return null;  // guardou
  const d = e - FUGA;
  return { nome: J.peixe, x: alvo[0], y: alvo[1] - (d < 0.18 ? 2.5 * Math.sin(Math.PI * d / 0.18) : 0), giro: 1, esc: 1, pousou: d >= 0.18 };
}

// ---------- o lançamento (u: s desde o começo) ----------
// recua a vara 0–0,25, solta 0,25–0,35 (a boia sai da ponta em 0,33), assenta 0,35–0,65; a boia voa
// 0,33–0,75 em arco e cai na água
const ANG = 15;  // a vara pescando (a ponta um pouco antes do lugar da boia: a linha desce inclinada)
const SOLTA = 0.33;
const balanco = t => 1.2 * Math.sin(2 * Math.PI * t / 3.3);
const boiaBalanca = t => 0.6 * Math.sin(2 * Math.PI * t / 2.4);
function lancamento(u, t, a0, dy) {
  let nome = 'vara', ang;
  if (u < 0.25) ang = a0 + (-60 - a0) * sai(u / 0.25);
  else if (u < 0.35) ang = -60 + 85 * entra((u - 0.25) / 0.1);
  else if (u < 0.65) ang = 25 - (25 - ANG) * sai((u - 0.35) / 0.3);
  else ang = ANG + balanco(t) * Math.min(1, (u - 0.65) / 0.6);
  if (u >= SOLTA) nome = 'vara_lancada';
  let boia = null;
  if (u >= SOLTA && u < 0.75) {
    const p = pontaDaVara(-60 + 85 * entra((SOLTA - 0.25) / 0.1), dy), v = (u - SOLTA) / (0.75 - SOLTA);
    boia = { x: p.x + (BX - p.x) * v, y: p.y + (SUP - p.y) * v * v - 9 * Math.sin(Math.PI * v) * (1 - v), voando: true };
  } else if (u >= 0.75) {
    const d = u - 0.75;
    boia = { x: BX, y: SUP + boiaBalanca(t) * Math.min(1, d / 0.8) + (d < 0.7 ? 1.6 * Math.exp(-5 * d) * Math.cos(d * 16) : 0) };
  }
  return { item: { nome, ang, esc: 1 }, boia };
}

// ---------- o estado da cena no instante t ----------
// { rachas (-1 ou 0..1), buraco, agua (0..1), sentado, sy, y, olhos, item {nome, ang, esc},
//   boia (null = na vara) {x, y, voando}, soltos: itens no chão/voando [{nome, x, y, giro, esc}] (giro = voando),
//   efeitos(g, tt): o que é passageiro (cacos, respingos, bolhas, orbes, a água caindo) no tempo tt }
const DY = 3;  // sentado, o clawd.js desce o corpo 3
// o que a entrada sorteia (cacos do bloco, respingo do 1º lançamento), pronto 1x por semente
const FIXOS = cache(8);
function fixos(sem) {
  const pronto = FIXOS.get(sem);
  if (pronto) return pronto;
  const r = rng(sem + 101);
  return FIXOS.set(sem, { cacosG: fazCacos(r, 8, 85, 2.2), cacosT: fazCacos(r, 7, 75, 2), respCai: fazRespingo(r, 6, 0.8) });
}
function piscando(sem, t) {
  const k = Math.floor(t / 4.3), f = rng((sem ^ 0x5bd1e995) + k)();
  const e = t - k * 4.3 - 0.5 - f * 3;
  return e >= 0 && e < 0.13;
}
function estado(sem, t) {
  const s = { rachas: -1, buraco: false, agua: 0, sentado: false, sy: 1, y: 0, olhos: 'abertos', item: { nome: 'picareta', ang: 0, esc: 1 }, boia: null, soltos: [], efeitos: [] };
  const { cacosG, cacosT, respCai } = fixos(sem);
  // -- entrada --
  if (t < L0) {
    if (t >= 0.3 && t < 1.5) { s.item.ang = golpe(((t - 0.3) % 0.2) / 0.2); s.rachas = (t - 0.3) / 1.2; }
    if (t >= 1.5) {
      s.buraco = true;
      s.efeitos.push((g, tt) => {
        const e = tt - 1.5;
        desenhaCacos(g, cacosG, 'grama', BX, -3, e); desenhaCacos(g, cacosT, 'terra', BX, -2, e);
        desenhaDrop(g, 'grama', e, BX, -4, -16, 0.55, 5, 0);  // o bloco de grama: ele pega
      });
    }
    if (t >= 1.6 && t < 1.9) s.item = troca(t, 1.6, 'picareta', 'balde');
    else if (t >= 1.9 && t < 2.8) {
      let ang = 0;
      if (t >= 1.95 && t < 2.15) ang = 110 * sai((t - 1.95) / 0.2); else if (t >= 2.15 && t < 2.5) ang = 110; else if (t >= 2.5 && t < 2.68) ang = 110 * (1 - sai((t - 2.5) / 0.18));
      s.item = { nome: t < 2.5 ? 'balde' : 'balde_vazio', ang, esc: 1 };
    }
    // a água cai do balde 2,1–2,55 e enche o buraco 2,15–2,55
    if (t >= 2.15) s.agua = sai(lim((t - 2.15) / 0.4, 0, 1));
    if (t >= 2.1 && t < 2.6) {
      const ini = 2.1, fim = 2.45;
      s.efeitos.push(Object.assign((g, tt) => {
        if (tt < ini || tt >= fim + 0.15) return;
        const b = bocaDoBalde(110), topo = FUNDO - (FUNDO - SUP) * sai(lim((tt - 2.15) / 0.4, 0, 1));
        const y0 = tt < fim ? b.y : b.y + 140 * (tt - fim), y1 = Math.min(topo, b.y + 140 * (tt - ini));
        if (y1 <= y0) return;
        g.fillStyle = 'rgba(63,118,228,.9)'; g.fillRect(b.x + 0.3, y0, 1.6, y1 - y0);
        g.fillStyle = 'rgba(160,196,255,.8)'; g.fillRect(b.x + 0.3, y0, 0.6, y1 - y0);
      }, { soNaCena: true }));  // a água caindo do balde: na saída o balde desvira, ela não continua
    }
    if (t >= 2.75) {
      s.sentado = true;
      if (t < 3.05) s.sy = 1 - 0.12 * Math.sin(Math.PI * (t - 2.75) / 0.3);
    }
    if (t >= 2.8 && t < 3.1) s.item = troca(t, 2.8, 'balde_vazio', 'vara');
    else if (t >= 3.1 && t < 3.25) s.item = { nome: 'vara', ang: 0, esc: 1 };
    else if (t >= 3.25) {
      const l = lancamento(t - 3.25, t, 0, DY);
      s.item = l.item; s.boia = l.boia;
      const tc = 3.25 + 0.75;
      s.efeitos.push((g, tt) => desenhaRespingo(g, respCai, BX, SUP, tt - tc));
    }
    return s;
  }
  // -- laço --
  s.buraco = true; s.agua = 1; s.sentado = true;
  const k = Math.floor((t - L0) / JANELA), J = janela(sem, k), e = t - J.b;
  const { pilha, vaga } = pilhaEm(sem, t, k);
  s.soltos.push(...pilha);
  // o lançamento da entrada (ou o da janela anterior) ainda assentando
  const base = lancamento(k === 0 ? t - 3.25 : t - (janela(sem, k - 1).b + janela(sem, k - 1).relanca), t, 5, DY);
  s.item = base.item; s.boia = base.boia;
  if (piscando(sem, t)) s.olhos = 'fechados';
  if (e >= -1.4) s.efeitos.push((g, tt) => desenhaBolhas(g, J.lado, tt - (J.b - 1.4)));
  if (e >= 0) {
    s.efeitos.push((g, tt) => desenhaRespingo(g, J.respMordida, BX, SUP, tt - J.b));
    const balancoAgora = ANG + balanco(t);
    if (e < J.puxa) {
      // mordeu: a boia afunda (puxando vazio: só belisca e volta)
      const d = J.peixe ? 2.5 * sai(Math.min(1, e / 0.08)) : (e < 0.3 ? 1.5 * Math.sin(Math.PI * e / 0.3) : 0);
      s.boia = { x: BX, y: SUP + d + (J.peixe ? 0 : boiaBalanca(t)) };
    } else {
      // puxa: a vara vai pra trás e a boia volta pra ponta; depois a vara volta devagar
      const p = e - J.puxa;
      let ang;
      if (p < 0.1) ang = balancoAgora + (-30 - balancoAgora) * sai(p / 0.1);
      else if (p < 0.25) ang = -30;
      else ang = -30 + 35 * sai(Math.min(1, (p - 0.25) / 0.4));
      if (p < 0.25) {
        const v = p / 0.25, de = { x: BX, y: SUP + (J.peixe ? 2.5 : boiaBalanca(J.b + J.puxa)) }, pt = pontaDaVara(ang, DY);
        s.boia = { x: de.x + (pt.x - de.x) * entra(v), y: de.y + (pt.y - de.y) * entra(v) - 5 * Math.sin(Math.PI * v), voando: true };
        s.item = { nome: 'vara_lancada', ang, esc: 1 };
      } else { s.boia = null; s.item = { nome: 'vara', ang, esc: 1 }; }
      s.efeitos.push((g, tt) => desenhaRespingo(g, J.respPuxa, BX, SUP, tt - (J.b + J.puxa)));
      if (J.peixe) {
        const f = voo(J, vaga, e - J.puxa - 0.05);
        if (f && !f.pousou) s.soltos.push(f); else if (f) s.soltos.push({ nome: f.nome, x: f.x, y: f.y });
        if (e - J.puxa >= 0.1 && e - J.puxa < 0.75) s.olhos = 'cima';  // olha o peixe passando por cima
        s.efeitos.push((g, tt) => desenhaOrbes(g, J.orbes, BX, -2, tt - (J.b + J.puxa + 0.1), 0));
      } else if (p >= 0.3 && p < 0.65) { s.olhos = 'fechados'; s.sy = 1 - 0.07 * Math.sin(Math.PI * (p - 0.3) / 0.35); }  // puxou vazio: hmpf
      // lança de novo
      if (e >= J.relanca) {
        const l = lancamento(e - J.relanca, t, 5, DY);
        s.item = l.item; s.boia = l.boia;
        s.efeitos.push((g, tt) => desenhaRespingo(g, J.respCai, BX, SUP, tt - (J.b + J.relanca + 0.75)));
      }
    }
  }
  return s;
}

// ---------- desenho ----------
function desenhaSolto(g, it) {
  const img = IMG[it.nome];
  if (!img || (it.esc ?? 1) <= 0) return;
  const esc = it.esc ?? 1;
  g.save(); g.translate(it.x, it.y);
  g.scale((it.giro ?? 1) * esc, esc);
  g.drawImage(img, -ITEM / 2, -ITEM, ITEM, ITEM);
  g.restore();
}
function desenhaLinha(g, ponta, boia) {
  g.strokeStyle = 'rgba(214,214,214,.8)'; g.lineWidth = 0.5;
  g.beginPath(); g.moveTo(ponta.x, ponta.y); g.lineTo(boia.x, boia.y - 3); g.stroke();
}
// a boia (8x8, 1 px por pixel): o flutuador em cima da linha d'água, o anzol dentro; nunca abaixo do fundo do buraco
function desenhaBoia(g, b) {
  const img = IMG.boia;
  if (!img) return;
  const h = b.voando ? 8 : Math.min(8, FUNDO - (b.y - 4));
  if (h > 0) g.drawImage(img, 0, 0, img.width, img.height * h / 8, b.x - 4.5, b.y - 4, 8, h);
}
// o Clawd: a picareta parada vai pelo clawd.js (igual ao tema); o resto pela mão
function desenhaPersonagem(g, s, roupa, T) {
  const p = { roupa, T, pernas: 'ambas', olhos: s.olhos };
  if (s.sentado) p.sentado = true;
  if (s.sy !== 1) p.sy = s.sy;
  if (s.y) p.y = s.y;
  const it = s.item;
  if (it.nome === 'picareta' && it.esc === 1) { p.ferr = 'picareta'; p.ang = it.ang; } else p.mao = (k, dy) => desenhaItem(k, it, dy);
  desenhaClawd(g, p);
}
function coracoes(g, mundo) {
  const e = mundo.estado || {};
  if (e.vida < 9.99 || e.ouro) desenhaCoracoes(g, Math.floor(e.vida), e.ouro, false, 0.9);
}
// a cena no instante t (o laguinho, a pilha, o Clawd, a linha, o que voa)
function desenhaCena(g, s, t, mundo) {
  const dy = s.sentado ? DY : 0;
  if (s.buraco) desenhaBuraco(g);
  if (s.rachas >= 0) desenhaRachas(g, s.rachas);
  if (s.boia && !s.boia.voando) desenhaBoia(g, s.boia);  // embaixo da água (o anzol fica dentro)
  if (s.buraco && s.agua > 0) desenhaAgua(g, FUNDO - (FUNDO - SUP) * s.agua, t);
  for (const it of s.soltos) if (it.giro == null) desenhaSolto(g, it);
  desenhaPersonagem(g, s, mundo.roupa || 'mc_steve', mundo.T);
  if (s.boia) {
    desenhaLinha(g, pontaDaVara(s.item.ang, dy), s.boia);
    if (s.boia.voando) desenhaBoia(g, s.boia);
  }
  for (const it of s.soltos) if (it.giro != null) desenhaSolto(g, it);
  for (const f of s.efeitos) f(g, t);
  coracoes(g, mundo);
}

// ---------- a saída: recolhe, levanta, troca pra picareta, pega tudo, a água some ----------
// boia volta 0–0,22 · levanta 0,2–0,48 · troca pra picareta 0,22–0,52 · itens voam pra ele
// 0,08–0,6 · poof no laguinho 0,2 (some em 0,35; o poof acaba antes de 1,0) · 1,0 o Clawd normal
const SAIDA = 1.0;
function quadroSaida(g, u, mundo, tCorte) {
  const sem = (mundo.estado && mundo.estado.pesca && mundo.estado.pesca.semente) || 0;
  const s = estado(sem, Math.max(0, tCorte)), T = mundo.T, roupa = mundo.roupa || 'mc_steve';
  // o laguinho e as rachaduras
  if (s.buraco && u < 0.35) {
    desenhaBuraco(g);
    if (s.boia && !s.boia.voando && u < 0.22) desenhaBoia(g, recolhe(s, u));
    if (s.agua > 0) desenhaAgua(g, FUNDO - (FUNDO - SUP) * s.agua, tCorte + u);
  }
  if (s.rachas >= 0) desenhaRachas(g, s.rachas, 1 - u / 0.15);
  // o que está no chão ou voando: vai pra ele, um atrás do outro
  const soltos = s.soltos.slice().sort((a, b) => (b.giro != null) - (a.giro != null) || a.y - b.y);
  soltos.forEach((it, i) => {
    const v = (u - 0.08 - 0.05 * i) / 0.25;
    if (v >= 1) return;
    if (v <= 0) { desenhaSolto(g, it); return; }
    desenhaSolto(g, { ...it, x: it.x * (1 - entra(v)), y: it.y + (-8 - it.y) * entra(v) - 5 * Math.sin(Math.PI * v), esc: (it.esc ?? 1) * (1 - 0.5 * v) });
  });
  // o Clawd: a vara puxa a boia de volta, ele levanta e troca pra picareta
  const p = { ...s, olhos: 'abertos', sy: 1, y: 0 };
  let item = s.item;
  const picareta = item.nome === 'picareta';  // já está com ela (cavando, ou no meio da troca): só volta pro lugar
  if (s.boia) item = { nome: u < 0.22 ? 'vara_lancada' : 'vara', ang: item.ang + (-25 - item.ang) * sai(Math.min(1, u / 0.12)), esc: 1 };
  else { const k = sai(Math.min(1, u / 0.15)); item = { ...item, ang: item.ang * (1 - k), esc: item.esc + (1 - item.esc) * k }; }
  if (!picareta && u >= 0.22) item = troca(u, 0.22, item.nome, 'picareta', item.ang, 0);
  if (u >= 0.52) item = { nome: 'picareta', ang: 0, esc: 1 };
  p.item = item;
  if (s.sentado) {
    if (u < 0.3) p.sy = u < 0.2 ? 1 : 1 - 0.1 * Math.sin(Math.PI * (u - 0.2) / 0.1);
    else { p.sentado = false; p.y = u < 0.48 ? -3 * Math.sin(Math.PI * (u - 0.3) / 0.18) : 0; }
  }
  if (u >= 0.52) Object.assign(p, { sentado: false, sy: 1, y: 0 });
  desenhaPersonagem(g, p, roupa, T);
  if (s.boia && u < 0.22) {
    const b = recolhe(s, u);
    desenhaLinha(g, pontaDaVara(item.ang, p.sentado ? DY : 0), b);
    if (s.boia.voando) desenhaBoia(g, b);
  }
  // o passageiro (cacos, respingos, orbes) some em 0,5 s; o poof cobre o laguinho sumindo
  if (u < 0.5) {
    const a0 = g.globalAlpha;
    g.globalAlpha = a0 * (1 - u / 0.5);
    for (const f of s.efeitos) if (!f.soNaCena) f(g, tCorte + u);
    g.globalAlpha = a0;
  }
  if (s.buraco) desenhaPoof(g, poofDoLago(sem), (B0 + B1) / 2, -2, B1 - B0, 6, u - 0.2);
  coracoes(g, mundo);
}
// a boia voltando pra ponta da vara na saída
function recolhe(s, u) {
  const v = entra(Math.min(1, u / 0.22)), ang = s.item.ang + (-25 - s.item.ang) * sai(Math.min(1, u / 0.12)), pt = pontaDaVara(ang, s.sentado ? DY : 0);
  return { x: s.boia.x + (pt.x - s.boia.x) * v, y: s.boia.y + (pt.y - s.boia.y) * v, voando: s.boia.voando };
}
const POOFS = cache(8);
function poofDoLago(sem) { return POOFS.get(sem) || POOFS.set(sem, fazPoof(rng(sem + 202), 11)); }

module.exports = {
  texturas: TEXTURAS,
  linhaDoTempo: [
    [0, 'em pé, com a picareta'], [0.3, 'cava um buraco na grama da borda (rachaduras)'], [1.5, 'o bloco quebra: cacos, o bloco vira item e ele pega'],
    [1.6, 'troca pro balde de água'], [1.95, 'vira o balde: a água enche o buraco'], [2.75, 'senta'], [2.8, 'troca pra vara de pesca'],
    [3.25, 'lança: a boia voa em arco e cai na água com respingo'], [L0, 'laço: a boia balança, a vara balança, ele pisca'],
    [L0 + 6, `1 mordida por janela de ${JANELA} s (instante sorteado, 15–40 s entre elas): bolhinhas vêm, a boia afunda, ele puxa`],
    [L0 + 6.3, 'o peixe (bacalhau; salmão às vezes; tropical raro; lixo: osso/linha) voa por cima dele pra pilhinha, com XP'],
    [L0 + 7, `pilhinha até ${PILHA}; depois ele guarda (o peixe voa pra ele); às vezes puxa vazio (12%)`], [L0 + 7.7, 'lança de novo'],
  ],
  linhaDaSaida: [[0, 'recolhe a boia'], [0.2, 'levanta e troca pra picareta; pega os peixes'], [0.2, 'a água some num poof (o bloco volta pro buraco)'], [0.55, 'o Clawd normal, em pé']],
  cena(m) {
    const semente = Math.floor(m.sorteio() * 4294967296);
    m.estado.pesca = { semente };  // a saída (depois do corte) precisa da mesma semente
    return {
      nome: 'parado', dur: Infinity, espaco: { frente: 0, tras: 0 }, modos: ['parado'], semente,
      quadro(g, t, mundo) { desenhaCena(g, estado(semente, t), t, mundo); },
    };
  },
  saida: { dur: SAIDA, quadro: quadroSaida },
  // pros testes
  _estado: estado, _janela: janela, _JANELA: JANELA, _L0: L0, _B: [B0, B1, FUNDO],
};
