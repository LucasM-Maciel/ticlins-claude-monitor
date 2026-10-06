'use strict';
// O que acontece em volta do cartão, quadro a quadro: onde o Clawd está na trilha,
// quando ele para, qual cena o tema sorteia, e o estado que sobrevive entre cenas
// (vida, nível, esferas...). O tema decide o que desenhar; aqui só a regra comum.
//
// Cena = o que o tema devolve no sorteio: { nome, dur (s, Infinity = até o modo mudar),
// espaco: {frente, tras} (px de reta livre que ela precisa), modos: em quais modos ela
// continua (padrão ['andando']; 'parado' = em pé em cima do cartão, ex. festa, dormir),
// quadro(g, t, mundo) desenhando no referencial do Clawd (x+ pra frente, y- pra fora do
// cartão, o próprio Clawd incluído) }.
// Modos: andando (algo rodando), pulando (pergunta/permissão: interrompe qualquer cena,
// a pergunta tem que aparecer), parado (nada rodando), oculto (Clawd desligado).
const fs = require('fs');
const path = require('path');
const { rng } = require('./comum');
const { trilha, perimetro } = require('./clawd');

const VELOCIDADE = 50;           // px/s pela trilha, como sempre foi
const PARADA = [20, 45];         // s andando entre uma parada e outra (sorteio de cena)
const ESPACO = { frente: 120, tras: 30 };

class Mundo {
  constructor({ tema, semente = Date.now(), pasta = null, relogio = null } = {}) {
    this.tema = tema;
    this.sorteio = rng(semente);
    this.pasta = pasta;
    this.T = 0;                  // relógio do motor (s)
    this.host = { modo: 'parado', clawd: true, cartao: null, raio: 8, linhas: [], uso: [], opacidade: 1 };
    this.dist = 0;               // onde o Clawd está na trilha (px desde o canto de cima à esquerda)
    this.cena = null;            // { nome, t0, ...o que o tema devolveu }
    this.proxima = Infinity;     // T da próxima parada
    this.andando = false;
    this.modo = 'oculto';
    this.desdeModo = 0;          // T em que entrou no modo atual (dormir depois de um tempo parado)
    this.roupa = null;
    this.relogio = relogio;      // () => Date (o teste fixa a hora pra "de noite")
    this.salvo = this.lerSalvo();
    this.estado = {};            // livre pro tema (transformação, pet...)
    this.ruins = new Set();      // cenas que quebraram: não sorteia mais até reabrir
    this.aoErro = null;          // (texto) => anota no diário
    if (tema.iniciar) tema.iniciar(this);
  }

  // -- o que a janelinha mandou --
  receber(host) {
    this.host = { ...this.host, ...host };
    const h = this.host;
    const modo = !h.clawd || !h.cartao ? 'oculto' : h.modo === 'andando' ? 'andando' : h.modo === 'pulando' ? 'pulando' : 'parado';
    if (modo === this.modo) return;
    const antes = this.modo;
    this.modo = modo;
    this.desdeModo = this.T;
    this.andando = modo === 'andando';
    if (this.cena && !(this.cena.modos || ['andando']).includes(modo)) this.fimCena(true);
    if (this.andando) {
      // parado e pulando ficam no meio de cima: sai andando dali, sem pular pra outro ponto da trilha
      if (antes === 'parado' || antes === 'pulando') { const g = this.geometria(); this.dist = g.w / 2 - g.r; }
      this.proxima = this.T + this.entre(...PARADA);
      if (this.tema.aoComecarAndar) this.tema.aoComecarAndar(this);
    }
    if (this.tema.aoMudarModo) this.tema.aoMudarModo(this, antes, modo);
  }
  evento(tipo) { if (this.tema.aoEvento) this.tema.aoEvento(this, tipo); }

  // -- relógio --
  passo(T) {
    const dt = Math.min(0.1, Math.max(0, T - this.T));  // depois de hibernar não dá um salto de minutos
    this.T = T;
    if (this.tema.passo) this.tema.passo(this, dt);
    if (this.cena && T - this.cena.t0 >= this.cena.dur) this.fimCena(false);
    const c = this.host.cartao;
    if (!this.andando || !c) return;
    if (!this.cena && !this.bloqueado() && T >= this.proxima) {
      const cena = this.tema.naParada ? this.tema.naParada(this) : null;
      if (cena === undefined) this.proxima = T + 1;            // o tema pediu pra tentar já já
      else if (cena && this.temEspaco(cena.espaco || ESPACO)) {
        this.comecarCena(cena);
        if (!this.cena) this.proxima = T + this.entre(...PARADA);  // cena quebrada: não pergunta de novo a cada quadro
      }
      else if (cena) this.proxima = T + 0.5;                   // sem espaço aqui: anda mais um pouco
      else this.proxima = T + this.entre(...PARADA);           // o sorteio deu "nada"
    }
    if (!this.cena && !this.bloqueado()) this.dist += VELOCIDADE * dt;
  }
  bloqueado() { return this.tema.bloqueia ? this.tema.bloqueia(this) : false; }  // o tema segura o Clawd (dragão passando...)
  comecarCena(cena) {
    if (this.ruins.has(cena.nome) || this.modo === 'oculto') return;
    if (!(cena.modos || ['andando']).includes(this.modo)) return;
    this.cena = { ...cena, t0: this.T };
    if (this.tema.aoComecarCena) this.tema.aoComecarCena(this, this.cena);
  }
  fimCena(cortada) {
    const cena = this.cena;
    this.cena = null;
    if (this.tema.aoFimCena) this.tema.aoFimCena(this, cena, cortada);
    this.proxima = this.T + this.entre(...PARADA);
  }

  // -- desenho: enfeites do tema (com a opacidade do cartão), o que fica atrás, o Clawd
  // (ou a cena) no lugar dele na trilha, e o que fica na frente. Cena com defeito: anota
  // (aoErro), encerra e não sorteia mais ela até reabrir.
  desenhar(g) {
    const t = this.tema, h = this.host;
    if (t.fundo) { g.save(); g.globalAlpha = h.opacidade ?? 1; t.fundo(g, this); g.restore(); }
    if (!h.clawd || !h.cartao) return;
    if (t.atras) { g.save(); t.atras(g, this); g.restore(); }
    const p = this.pose();
    g.save();
    g.translate(p.x, p.y); g.rotate(p.a);
    try {
      if (this.cena) this.cena.quadro(g, this.T - this.cena.t0, this);
      else t.clawd(g, this);
    } catch (e) {
      if (!this.cena) { g.restore(); throw e; }
      if (this.aoErro) this.aoErro(`cena ${this.cena.nome} quebrou: ${e.stack || e.message}`);
      this.ruins.add(this.cena.nome);
      this.fimCena(true);
    }
    g.restore();
    if (t.frente) { g.save(); t.frente(g, this); g.restore(); }
  }

  // -- trilha --
  geometria() {
    const c = this.host.cartao, extra = (this.tema.trilha && this.tema.trilha.baixo) || 0;
    const r = this.tema.trilha && this.tema.trilha.raio != null ? this.tema.trilha.raio : this.host.raio;
    return { x: c[0], y: c[1], w: c[2], h: c[3] + extra, r: Math.max(1, Math.min(r, c[2] / 2, c[3] / 2)) };
  }
  // onde o Clawd está: na trilha andando (ou parado no meio dela, em cena); senão no meio de cima
  pose() {
    const g = this.geometria();
    if (!this.andando) return { x: g.x + g.w / 2, y: g.y, a: 0, reta: true, andou: g.w / 2 - g.r, falta: g.w / 2 - g.r };
    const p = trilha(g.w, g.h, this.dist, g.r);
    return { ...p, x: g.x + p.x, y: g.y + p.y };
  }
  // num ponto da trilha a d px daqui (o pet que segue atrás)
  poseEm(d) { const g = this.geometria(); const p = trilha(g.w, g.h, this.dist + d, g.r); return { ...p, x: g.x + p.x, y: g.y + p.y }; }
  perimetro() { const g = this.geometria(); return perimetro(g.w, g.h, g.r); }
  temEspaco({ frente, tras }) {
    const g = this.geometria(), p = trilha(g.w, g.h, this.dist, g.r);
    return p.reta && p.andou >= tras && p.falta >= frente;
  }

  // -- sorteio e hora --
  chance(p) { return this.sorteio() < p; }
  entre(a, b) { return a + (b - a) * this.sorteio(); }
  agora() { return this.relogio ? this.relogio() : new Date(); }
  noite() { const h = this.agora().getHours(); return h >= 22 || h < 6; }

  // -- o que sobrevive a reabrir a janelinha (nível, esferas): motor-estado.json --
  lerSalvo() {
    if (!this.pasta) return {};
    try { return JSON.parse(fs.readFileSync(path.join(this.pasta, 'motor-estado.json'), 'utf8')) || {}; } catch { return {}; }
  }
  salvar() {
    if (!this.pasta) return;
    try { fs.writeFileSync(path.join(this.pasta, 'motor-estado.json'), JSON.stringify(this.salvo)); } catch { /* sem disco, perde o nível: tudo bem */ }
  }
}

module.exports = { Mundo, VELOCIDADE, PARADA, ESPACO };
