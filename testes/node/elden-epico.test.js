'use strict';
// motor/elden-epico.js e os 4 chefes (elden-chefe-*.js): cada luta dura de 12 a 16 s, não anda (espaco 0/0), tem linha do
// tempo e trilha completas, é função do tempo, não vaza do palco (nada dentro do cartão nem acima do topo), a barra de vida
// fica no topo do palco (fora do cartão) e desce de 1 até 0 (só sobe quando a Malenia se cura), e custa pouco. Cada chefe
// luta do jeito dele (chefe.luta) e a resposta do Clawd funciona: quem corre fica longe do golpe, quem pula está no ar, quem
// rola está girando e quem apanha fica vermelho; o Clawd não pula de lugar, não entra no chefe nem sai do palco.
// E o 5º, o evento lendário (elden-lendario.js: Radagon se estilhaça e a Besta Prístina sobe), nas mesmas regras e mais as dele.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');
const MOTOR = path.join(__dirname, '..', '..', 'extensao', 'janelinha', 'motor');
const { Tela } = require(path.join(MOTOR, 'raster'));
const { Mundo } = require(path.join(MOTOR, 'mundo'));
const tema = require(path.join(MOTOR, 'tema-elden'));
const E = require(path.join(MOTOR, 'elden-epico'));
const L = require(path.join(MOTOR, 'elden-lendario'));
const A = require(path.join(MOTOR, 'elden-arte'));
const { estadoDeMentira } = require('../motor-foto');

const JANELINHA = path.join(MOTOR, '..');
const ESCALAS = [1, 1.25, 2];
const ALTURAS = [72, 130, 184];  // do palco: a mínima, uma média e a máxima

function montar({ chefe = 0, escala = 1, altura = 130, meio = false, idioma } = {}) {
  const m = new Mundo({ tema, semente: 2 });
  const erros = [];
  m.aoErro = e => erros.push(e);
  const host = { ...estadoDeMentira('elden', 'andando'), escala, idioma };
  host.cartao = [host.cartao[0], altura + 14, host.cartao[2], host.cartao[3]];
  m.receber(host);
  if (meio) { const g = m.geometria(); m.dist = (g.w - 2 * g.r) * 0.5; }  // o Clawd na metade da reta, como no uso real
  m.salvo.eldenChefe = chefe;
  const c = chefe === LENDARIO ? L.cena(m) : E.cena(m);
  return { m, c, erros };
}
// o épico sozinho numa tela limpa: o que ele pinta (o cartão em si fica por conta do tema)
function desenhar({ m, c }, t, escala) {
  const tela = new Tela(Math.round(380 * escala), Math.round(520 * escala)), g = tela.getContext('2d');
  const casa = m.pose();  // o motor entrega o épico no referencial do Clawd (origem entre os pés, onde ele pisa)
  g.setTransform(escala, 0, 0, escala, casa.x * escala, casa.y * escala);
  m.T = t;
  c.quadro(g, t, m);
  return tela;
}
const NOMES = E.CHEFES;
const LENDARIO = NOMES.length;  // o 5º do rodízio
const TODAS = [...NOMES, 'lendario'];  // as 5 lutas, pelos índices do rodízio
// o contrato de um chefe; o nome tem que sair inteiro na fonte do tema (um glifo que falta vira buraco: "L MINA")
function contrato(id) {
  const chefe = require(path.join(MOTOR, `elden-chefe-${id}`));
  assert.strictEqual(chefe.id, id);
  assert.ok(typeof chefe.nome === 'string' && chefe.nome.length > 4 && chefe.nome === chefe.nome.toUpperCase(), `${id}: nome`);
  for (const ch of chefe.nome) assert.ok(ch === ' ' || A.GLIFOS[ch], `${id}: falta a letra "${ch}" na fonte`);
  // o nome em inglês (idioma do menu): o do jogo, também inteiro na fonte
  assert.ok(typeof chefe.nomeEn === 'string' && chefe.nomeEn.length > 4 && chefe.nomeEn === chefe.nomeEn.toUpperCase(), `${id}: nomeEn`);
  for (const ch of chefe.nomeEn) assert.ok(ch === ' ' || A.GLIFOS[ch], `${id}: falta a letra "${ch}" na fonte (nomeEn)`);
  assert.ok(chefe.H > 0 && chefe.H <= 48 && chefe.W > 0 && chefe.W <= 56, `${id}: tamanho ${chefe.W}x${chefe.H}`);
  assert.strictEqual(typeof chefe.desenha, 'function');
  assert.strictEqual(chefe.ataques.length, 2);
  for (const a of chefe.ataques) assert.ok(a.nome && a.acerta >= 0.3 && a.acerta <= 0.85, `${id}: ${a.nome}`);
  return chefe;
}
// os pixels dourados nas 26 primeiras linhas do palco (o nome e a barra de vida), entre x0 e x1 se pedir
function ouroNoTopo(tela, cy, HJ, x0 = 0, x1 = tela.width) {
  let ouro = 0;
  for (let y = cy - HJ; y < cy - HJ + 26; y++) {
    for (let x = x0; x < x1; x++) {
      const p = tela.pixels[y * tela.width + x];
      if (p !== 0 && ((p >>> 16) & 255) > 150 && ((p >>> 8) & 255) > 120 && (p & 255) < 130) ouro++;
    }
  }
  return ouro;
}

test('os 4 chefes giram na ordem Margit, Godrick, Malenia, Radahn e cada um cumpre o contrato', () => {
  assert.deepStrictEqual(NOMES, ['margit', 'godrick', 'malenia', 'radahn']);
  assert.deepStrictEqual(tema.chefes, TODAS);
  for (const [i, id] of NOMES.entries()) {
    const chefe = contrato(id);
    const { c } = montar({ chefe: i });
    assert.ok(c && c.nome === 'epico', id);
    assert.ok(c.plano.chefe === chefe, `o chefe ${i} é o ${id}`);
  }
});

test('cada luta: 12 a 16 s, não anda, linha do tempo e trilha completas', () => {
  assert.ok(E.linhaDoTempo.length >= 6);
  for (const [t, txt] of E.linhaDoTempo) assert.ok(t >= 0 && t < E.T.dur && typeof txt === 'string' && txt.length > 10);
  for (const i of NOMES.keys()) {
    const { c } = montar({ chefe: i });
    assert.ok(c.dur >= 12 && c.dur <= 16, `${NOMES[i]}: ${c.dur} s`);
    assert.deepStrictEqual(c.espaco, { frente: 0, tras: 0 });
    assert.deepStrictEqual(c.modos, ['andando']);
    assert.ok(c.sons.length >= 10, `${NOMES[i]}: ${c.sons.length} sons`);
    for (const [t, arq, ganho] of c.sons) {
      assert.ok(t >= 0 && t < c.dur, `${NOMES[i]}: ${arq} em ${t}`);
      assert.ok(ganho > 0 && ganho <= 1, `${NOMES[i]}: ganho de ${arq}: ${ganho}`);
      assert.ok(fs.existsSync(path.join(JANELINHA, arq)), `${NOMES[i]}: falta ${arq}`);
    }
    assert.ok(c.sons.some(s => s[1] === `sons-elden/rugido-${NOMES[i]}.wav`), `${NOMES[i]}: o rugido dele`);
  }
});

test('toda luta, quadro a quadro (30/s), nas escalas 1, 1,25 e 2 e nas 3 alturas de palco, sem erro e sem vazar', () => {
  const NOMES = TODAS;  // as 5, o lendário junto
  for (const i of NOMES.keys()) {
    for (const escala of ESCALAS) {
      for (const altura of ALTURAS) {
        const alvo = montar({ chefe: i, escala, altura });
        const { m, c } = alvo, [cx, cy] = m.host.cartao;
        let desenhou = 0;
        for (let f = 0; f <= Math.ceil(c.dur * 30) + 1; f += (escala === 1 && altura === 130 ? 1 : 5)) {  // 30/s só no caso médio; nos outros, 1 de cada 5 (o teste é pesado)
          const t = f / 30;
          const tela = desenhar(alvo, t, escala);
          const px = tela.pixels, W = tela.width;
          // o palco: de y = cy-HJ até y = cy (borda de cima do cartão); só o Clawd pisa 1 DIP abaixo (o contorno)
          const borda = Math.round(cy * escala), topoPalco = Math.round((cy - c.plano.HJ) * escala);
          let dentro = 0, acima = 0;
          for (let y = 0; y < tela.height; y++) {
            for (let x = 0; x < W; x++) {
              if (px[y * W + x] === 0) continue;
              if (y >= borda + 3 * escala) dentro++;
              if (y < topoPalco - 2 * escala) acima++;
              desenhou++;
            }
          }
          assert.strictEqual(dentro, 0, `${NOMES[i]} @ ${escala}/${altura} t=${t.toFixed(2)}: ${dentro} pixels dentro do cartão`);
          assert.strictEqual(acima, 0, `${NOMES[i]} @ ${escala}/${altura} t=${t.toFixed(2)}: ${acima} pixels acima do palco`);
        }
        assert.ok(desenhou > 1000, `${NOMES[i]} @ ${escala}/${altura}: quase nada desenhado`);
        assert.deepStrictEqual(alvo.erros, []);
        void cx;
      }
    }
  }
});

test('o quadro é função do tempo: o mesmo instante dá os mesmos bytes, por qualquer caminho', () => {
  for (const i of TODAS.keys()) {
    const a = montar({ chefe: i, escala: 1.25 }), b = montar({ chefe: i, escala: 1.25 });
    const ts = [0.7, 3.3, 5.9, 8.1, 10.5, 11.6, 12.4, ...(i === LENDARIO ? [L.ESTILHACO + 0.05, L.TROCA + 0.05, 15, 20.2, 23] : [])];
    for (const t of ts) {
      const ta = Buffer.from(desenhar(a, t, 1.25).bgra());
      desenhar(b, 99 % 13, 1.25);  // b passeia por outro instante antes
      const tb = Buffer.from(desenhar(b, t, 1.25).bgra());
      assert.ok(ta.equals(tb), `${TODAS[i]} @ ${t}`);
    }
  }
});

test('a barra de vida: no topo do palco (fora do cartão), cheia no começo, vazia no fim, só sobe quando a Malenia se cura', () => {
  for (const id of NOMES) {
    const R = E.roteiro(require(path.join(MOTOR, `elden-chefe-${id}`)).luta), curas = E.curasDe(R), golpes = E.golpesDe(R);
    assert.strictEqual(E.vidaEm(0, R), 1, id);
    assert.strictEqual(E.vidaEm(R.dur, R), 0, id);
    assert.strictEqual(curas.length > 0, id === 'malenia', `${id}: só a Malenia se cura`);
    let antes = 1;
    for (let t = 0; t <= R.dur; t += 1 / 60) {
      const v = E.vidaEm(t, R);
      assert.ok(v >= 0 && (v <= antes + 1e-9 || curas.some(c => t >= c && t < c + 0.2)), `${id}: a vida subiu em ${t.toFixed(2)} s`);
      antes = v;
    }
    assert.ok(E.vidaEm(golpes[0] - 0.01, R) === 1 && E.vidaEm(golpes[0] + 0.2, R) < 1, id);
    for (const h of golpes) assert.ok(E.vidaEm(h + 0.2, R) < E.vidaEm(h - 0.01, R), `${id}: golpe em ${h}`);
    for (const h of curas) assert.ok(E.vidaEm(h + 0.2, R) > E.vidaEm(h - 0.01, R), `${id}: cura em ${h}`);
    assert.strictEqual(golpes[golpes.length - 1], R.hf, `${id}: o último golpe é o salto final`);
  }
  // a barra aparece no topo: com a altura mínima do palco, no começo, há pixels dourados nas 24 primeiras linhas do palco
  for (const altura of ALTURAS) {
    const alvo = montar({ chefe: 0, altura });
    const ouro = ouroNoTopo(desenhar(alvo, 2.0, 1), alvo.m.host.cartao[1], alvo.c.plano.HJ);
    assert.ok(ouro > 40, `altura ${altura}: barra de vida e nome não aparecem no topo (${ouro})`);
  }
});

test('com o Clawd no meio da reta (e não no canto), a barra, o nome e o letreiro continuam dentro do palco (em português e em inglês)', () => {
  // quando a barra tem que estar lá: no lendário, a do Radagon apaga no estilhaço e a da Besta enche depois
  const temBarra = (i, t, R) => (i === LENDARIO
    ? (t >= L.R.barra[1] && t < L.R.someBarra[0]) || (t >= L.B.barra[1] && t < L.B.fecha[0])
    : t >= R.barra[1] && t < R.fecha[0]);
  for (const idioma of ['pt', 'en']) {
    for (const i of TODAS.keys()) {
      const alvo = montar({ chefe: i, meio: true, idioma });
      const { c } = alvo, [cx, cy, cw] = alvo.m.host.cartao;
      for (let t = 0.5; t < c.dur; t += 0.5) {
        const tela = desenhar(alvo, t, 1), W = tela.width;
        let fora = 0;
        for (let y = 0; y < cy; y++) for (let x = 0; x < W; x++) if (tela.pixels[y * W + x] !== 0 && (x < cx - 3 || x > cx + cw + 3)) fora++;
        assert.strictEqual(fora, 0, `${TODAS[i]} (${idioma}) t=${t}: ${fora} pixels fora da largura do palco`);
        const ouro = ouroNoTopo(tela, cy, c.plano.HJ);
        if (temBarra(i, t, c.plano.T)) assert.ok(ouro > 40, `${TODAS[i]} (${idioma}) t=${t}: sem barra no topo (${ouro})`);
      }
    }
  }
});

test('em inglês (idioma do menu): o texto do jogo no nome do chefe e nos letreiros, com todas as letras na fonte', () => {
  for (const i of NOMES.keys()) {
    const { c } = montar({ chefe: i, idioma: 'en' });
    assert.strictEqual(c.plano.idioma, 'en');
    assert.ok(!c.plano.letreiro, `${NOMES[i]}: letreiro próprio`);  // o padrão: GREAT ENEMY FELLED
  }
  const { c } = montar({ chefe: LENDARIO, idioma: 'en' });
  assert.strictEqual(c.planos[1].letreiro, 'GOD SLAIN');
  assert.strictEqual(montar({ chefe: LENDARIO }).c.planos[1].letreiro, 'DEUS ABATIDO', 'sem idioma: português');
  for (const txt of ['GREAT ENEMY FELLED', 'GOD SLAIN', 'ELDEN LORD', 'YOU DIED', 'LOST GRACE DISCOVERED', 'RUNES', 'TRY JUMPING']) {
    for (const ch of txt) assert.ok(ch === ' ' || A.GLIFOS[ch], `${txt}: falta "${ch}"`);
  }
});

test('o lendário vem depois dos 4: Radagon e a Besta Prístina cumprem o contrato; 22 a 26 s, linha do tempo e trilha completas', () => {
  const radagon = contrato('radagon'), besta = contrato('besta');
  assert.strictEqual(besta.nome, 'BESTA PRÍSTINA');
  for (const txt of ['DEUS ABATIDO', 'LORDE PRÍSTINO']) for (const ch of txt) assert.ok(ch === ' ' || A.GLIFOS[ch], `falta "${ch}"`);
  const { c, erros } = montar({ chefe: LENDARIO });
  assert.ok(c && c.nome === 'epico');
  assert.ok(c.dur >= 22 && c.dur <= 26, `${c.dur} s`);
  assert.deepStrictEqual(c.espaco, { frente: 0, tras: 0 });
  assert.deepStrictEqual(c.modos, ['andando']);
  assert.ok(c.planos[0].chefe === radagon && c.planos[1].chefe === besta, 'Radagon primeiro, a Besta depois');
  let antes = -1;
  for (const [t, txt] of L.linhaDoTempo) {
    assert.ok(t >= antes && t < c.dur && typeof txt === 'string' && txt.length > 10, `linha do tempo em ${t}`);
    antes = t;
  }
  assert.ok(c.sons.length >= 20, `${c.sons.length} sons`);
  for (const [t, arq, ganho] of c.sons) {
    assert.ok(t >= 0 && t < c.dur, `${arq} em ${t}`);
    assert.ok(ganho > 0 && ganho <= 1, `ganho de ${arq}: ${ganho}`);
    assert.ok(fs.existsSync(path.join(JANELINHA, arq)), `falta ${arq}`);
  }
  for (const n of ['rugido-radagon', 'estilhaco', 'rugido-besta', 'deus-abatido', 'coroa']) {
    assert.ok(c.sons.some(s => s[1] === `sons-elden/${n}.wav`), `falta o som ${n}`);
  }
  assert.deepStrictEqual(erros, []);
});

test('o lendário: o Clawd não pula (nem na troca de fase), Radagon some antes de a Besta entrar e a barra troca de dono', () => {
  for (const meio of [false, true]) {
    const { c } = montar({ chefe: LENDARIO, meio }), [JR, JB] = c.planos;
    const onde = t => E.clawdEm(t < L.TROCA ? JR : JB, t);
    for (let f = 1; f <= c.dur * 30; f++) {
      const a = onde((f - 1) / 30), b = onde(f / 30);
      if (a.andando || b.andando) continue;  // a ida e a volta são a caminhada de sempre, não pulo
      assert.ok(Math.abs(b.x - a.x) < 6, `meio=${meio} t=${(f / 30).toFixed(2)}: o Clawd pulou ${(b.x - a.x).toFixed(1)} px`);
    }
    assert.ok(Math.abs(onde(L.TROCA - 1e-6).x - onde(L.TROCA).x) < 1, 'na troca de fase, o Clawd fica onde está');
  }
  const alvo = montar({ chefe: LENDARIO }), [JR, JB] = alvo.c.planos;
  assert.strictEqual(E.estadoDoChefe(JR, L.ESTILHACO + 0.2).morte, 1, 'o Radagon já se estilhaçou');
  assert.ok(E.estadoDoChefe(JR, L.R.racha[0] + 0.5).racha > 0, 'o Radagon racha antes');
  assert.strictEqual(E.estadoDoChefe(JB, L.TROCA).entra, 0, 'a Besta ainda não entrou na troca');
  assert.ok(E.estadoDoChefe(JB, L.B.entra[1] + 0.1).entra === 1);
  // a barra do Radagon some e a da Besta aparece: entre as duas, o topo do palco fica quase sem ouro
  // (sem o cosmos, o anel e os cacos, que também são dourados, e só na metade direita da barra, longe da árvore: aqui só
  // conta a barra)
  for (const J of [JR, JB]) J.fundo = J.frente = null;
  const [cx, cy] = alvo.m.host.cartao;
  const ouro = t => ouroNoTopo(desenhar(alvo, t, 1), cy, JR.HJ, Math.round(cx + JR.cw * 0.55), Math.round(cx + JR.cw * 0.9));
  const radagon = ouro(4), vao = ouro((L.R.someBarra[1] + L.B.nome[0]) / 2), besta = ouro(L.B.barra[1] + 0.5);
  assert.ok(radagon > 40 && besta > 40, `barras: Radagon ${radagon}, Besta ${besta}`);
  assert.ok(vao < Math.min(radagon, besta) / 3, `entre as barras ainda há ouro no topo (${vao})`);
  // a vida de cada fase: cheia no começo, zero no golpe final, só desce
  for (const R of [L.R, L.B]) {
    assert.strictEqual(E.vidaEm(R.entra[0], R), 1);
    assert.strictEqual(E.vidaEm(R.hf + 1, R), 0);
    let v0 = 1;
    for (let t = 0; t < L.B.dur; t += 1 / 30) { const v = E.vidaEm(t, R); assert.ok(v <= v0 + 1e-9); v0 = v; }
  }
});

test('o estado do chefe: cada ataque na janela dele, golpeado, preso, curando e morte nos tempos certos', () => {
  for (const i of NOMES.keys()) {
    const J = montar({ chefe: i }).c.plano, R = J.T, id = NOMES[i];
    assert.strictEqual(E.estadoDoChefe(J, 1).ataque, null, id);
    for (const [k, a] of R.ataques.entries()) {
      const e = E.estadoDoChefe(J, a.t + a.dur / 2);
      assert.ok(e.ataque.id === a.id && Math.abs(e.ataque.u - 0.5) < 1e-9, `${id}: ataque ${k}`);
      assert.ok(J.impacto[k] > a.t && J.impacto[k] < a.t + a.dur, `${id}: o impacto do ataque ${k} cai dentro da janela dele`);
    }
    const [h] = E.golpesDe(R);
    assert.ok(E.estadoDoChefe(J, h + 0.01).golpeado > 0.9, id);
    assert.strictEqual(E.estadoDoChefe(J, h + 0.5).golpeado, 0, id);
    assert.strictEqual(E.estadoDoChefe(J, 2).ajoelha, 0, id);
    assert.strictEqual(E.estadoDoChefe(J, R.ajoelha[1] + 0.1).ajoelha, 1, id);
    assert.strictEqual(E.estadoDoChefe(J, R.morte[1] + 0.1).morte, 1, id);
    // o Margit preso pelo Grilhão fica de joelhos, e só ele; a Malenia brilha quando se cura
    let preso = 0;
    for (let t = 0; t < R.dur; t += 0.05) preso = Math.max(preso, E.estadoDoChefe(J, t).preso);
    assert.strictEqual(preso, id === 'margit' ? 1 : 0, `${id}: preso`);
    if (id === 'margit') assert.strictEqual(E.estadoDoChefe(J, (R.preso[0] + R.preso[1]) / 2).ajoelha, 1, 'o Margit preso fica de joelhos');
    for (const c of E.curasDe(R)) assert.ok(E.estadoDoChefe(J, c + 0.05).cura > 0.8, `${id}: cura em ${c}`);
  }
});

test('cada chefe tem o seu padrão de ataques, e cada luta é válida', () => {
  const ids = [...NOMES, 'radagon', 'besta'], padroes = new Set();
  for (const id of ids) {
    const chefe = require(path.join(MOTOR, `elden-chefe-${id}`)), L = chefe.luta, R = E.roteiro(L);
    assert.ok(L && L.ataques.length >= 2 && L.cortes.length >= 2, `${id}: sem luta`);
    padroes.add(JSON.stringify(L.ataques.map(([a, , , r]) => [a, r])));
    let fim = 0;
    for (const [a, t, dur, resp] of L.ataques) {
      assert.ok((a === 0 || a === 1) && E.RESPOSTAS.includes(resp) && dur >= 0.8 && dur <= 3, `${id}: ataque em ${t}`);
      assert.ok(t >= R.barra[1] && t >= fim, `${id}: o ataque em ${t} começa antes da barra ou do anterior acabar`);
      fim = t + dur;
    }
    // o Clawd faz uma coisa de cada vez: a resposta a cada ataque, os golpes, o frasco, o grilhão e o salto não se cruzam
    const impacto = L.ataques.map(([a, t, dur]) => t + dur * Math.min(0.85, Math.max(0.3, chefe.ataques[a].acerta)));
    const janela = { rola: i => [i - 0.65, i - 0.05], rolaTarde: i => [i - 0.35, i - 0.02], corre: i => [i - 0.8, i + 0.95],
      pula: i => [i - 0.3, i + 0.3], apanha: i => [i, i + 0.45] };
    const acoes = [...L.ataques.map(([, , , r], k) => [...janela[r](impacto[k]), r]), ...R.cortes.map(c => [...c, 'golpe']),
      [...R.frasco, 'frasco'], [...R.grilhao, 'grilhao'], [...R.final, 'final']].filter(a => a[0] < 1e3).sort((a, b) => a[0] - b[0]);
    for (let k = 1; k < acoes.length; k++) {
      assert.ok(acoes[k][0] >= acoes[k - 1][1] - 1e-9, `${id}: ${acoes[k - 1][2]} (${acoes[k - 1][0].toFixed(2)}) e ${acoes[k][2]} (${acoes[k][0].toFixed(2)}) se cruzam`);
    }
    for (const [t, v] of L.cortes) assert.ok(v > 0 && v < 1 && t < L.final, `${id}: golpe em ${t}`);
    // a cura vem do golpe da Malenia que acerta o Clawd
    for (const [t] of L.curas || []) {
      assert.ok(L.ataques.some(([, , , r], k) => r === 'apanha' && Math.abs(impacto[k] - t) < 1e-9), `${id}: cura em ${t} sem golpe que acerta`);
    }
    assert.strictEqual(R.vida[R.vida.length - 1][1], 0, `${id}: o salto final zera`);
  }
  assert.strictEqual(padroes.size, ids.length, 'dois chefes com o mesmo padrão');
});

test('a resposta do Clawd funciona: corre pra longe, pula por cima, rola girando ou apanha vermelho', () => {
  const lutas = [...NOMES.keys()].map(i => [NOMES[i], montar({ chefe: i }).c.plano]);
  const [JR, JB] = montar({ chefe: LENDARIO }).c.planos;
  lutas.push(['radagon', JR], ['besta', JB]);
  for (const [id, J] of lutas) {
    for (const [k, a] of J.T.ataques.entries()) {
      const i = J.impacto[k], posto = J.aqui + 16 * A.fatia(i, J.chega[0], J.chega[1]), c = E.clawdEm(J, i);
      const qual = `${id}: ataque ${k} (${a.resp}) em ${i.toFixed(2)}`;
      if (a.resp === 'corre') assert.ok(posto - c.x >= 24, `${qual}: o Clawd está a ${(posto - c.x).toFixed(1)} px do golpe`);
      if (a.resp === 'pula') assert.ok(c.y <= -8 && c.noAr, `${qual}: y ${c.y.toFixed(1)}`);
      if (a.resp === 'rola' || a.resp === 'rolaTarde') assert.ok(E.clawdEm(J, i - 0.1).rot > 0, `${qual}: não está rolando`);
      if (a.resp === 'apanha') assert.ok(E.clawdEm(J, i + 0.05).tinta, `${qual}: não ficou vermelho`);
      if (a.resp !== 'corre') assert.ok(Math.abs(c.x - posto) < 12, `${qual}: longe do posto (${(c.x - posto).toFixed(1)} px)`);
    }
  }
});

test('o Clawd em cada luta: não pula de lugar, não entra no chefe e não sai do palco', () => {
  for (const i of NOMES.keys()) {
    for (const meio of [false, true]) {
      const { c } = montar({ chefe: i, meio }), J = c.plano, R = J.T, onde = t => E.clawdEm(J, t);
      for (let f = 1; f <= c.dur * 30; f++) {
        const t = f / 30, a = onde(t - 1 / 30), b = onde(t);
        if (!a.andando && !b.andando) assert.ok(Math.abs(b.x - a.x) < 6, `${NOMES[i]} meio=${meio} t=${t.toFixed(2)}: o Clawd pulou ${(b.x - a.x).toFixed(1)} px`);
        if (t < R.vai[1] || t >= R.volta[0]) continue;  // a ida e a volta são a caminhada de sempre (o chefe ainda não está lá)
        assert.ok(b.x <= J.bossX - J.larg / 2 - 4, `${NOMES[i]} meio=${meio} t=${t.toFixed(2)}: o Clawd entrou no chefe (x ${b.x.toFixed(1)})`);
        assert.ok(b.x >= 8, `${NOMES[i]} meio=${meio} t=${t.toFixed(2)}: o Clawd saiu do palco (x ${b.x.toFixed(1)})`);
      }
    }
  }
});

test('custo em 1,25: mediana < 16 ms e pior quadro < 40 ms em cada luta', (t) => {
  const medir = i => {
    const alvo = montar({ chefe: i, escala: 1.25, altura: 184 });
    const ms = [];
    for (let f = 0; f <= alvo.c.dur * 30; f++) {
      const ini = process.hrtime.bigint();
      desenhar(alvo, f / 30, 1.25);
      ms.push(Number(process.hrtime.bigint() - ini) / 1e6);
    }
    ms.sort((x, y) => x - y);
    return { mediana: ms[ms.length >> 1], pior: ms[ms.length - 1] };
  };
  for (const i of TODAS.keys()) medir(i);  // aquece
  for (const [i, id] of TODAS.entries()) {
    const r = [medir(i), medir(i)], pior = Math.min(r[0].pior, r[1].pior), mediana = Math.min(r[0].mediana, r[1].mediana);
    t.diagnostic(`${id}: mediana ${mediana.toFixed(2)} ms, pior ${pior.toFixed(2)} ms`);
    assert.ok(mediana < 16, `${id}: mediana ${mediana.toFixed(2)} ms`);
    assert.ok(pior < 40, `${id}: pior quadro ${pior.toFixed(2)} ms`);
  }
});
