'use strict';
// Foto do épico do tema Elden Ring com o chefe que pedir (0 Margit, 1 Godrick, 2 Malenia, 3 Radahn, 4 o lendário), ou de uma cena.
//   node testes/elden-foto.js --chefe 2 --tira 1.5,3,4.5,6 --saida f.png [--zoom 2] [--roupa elden-bandido] [--altura 120]
//   node testes/elden-foto.js --id radagon --tira 1.5,3 --saida f.png   (um chefe sozinho na luta de sempre, fora do rodízio)
//   node testes/elden-foto.js --cena abatido --tira 0.5,1,1.5 --saida f.png [--semente 7]
const path = require('path');
const fs = require('fs');
const foto = require('./motor-foto');
const MOTOR = path.join(__dirname, '..', 'extensao', 'janelinha', 'motor');
const { Mundo } = require(path.join(MOTOR, 'mundo.js'));
const { Tela } = require(path.join(MOTOR, 'raster.js'));
const tema = require(path.join(MOTOR, 'tema-elden'));
const A = require(path.join(MOTOR, 'elden-arte'));

function quadro({ chefe = 0, id = null, cena = null, t = 1, roupa, semente = 7, altura = 130, escala = 1 }) {
  const m = new Mundo({ tema, semente: Number(semente), relogio: () => new Date(2026, 9, 5, 12) });
  const host = { ...foto.estadoDeMentira('elden', 'andando'), escala };
  if (altura) { host.cartao = [host.cartao[0], Number(altura) + 14, host.cartao[2], host.cartao[3]]; }
  m.receber(host);
  if (roupa) A.vestir(roupa);
  m.salvo.eldenChefe = Number(chefe);
  const c = id ? { ...require(path.join(MOTOR, 'elden-epico')).cena(m, id), nome: 'epico', epico: true } : tema.cenaPorNome(m, cena || 'epico');
  if (!c) throw new Error('cena não existe');
  m.comecarCena(c);
  for (let s = 1 / 30; s < t; s += 1 / 30) m.passo(s);
  m.passo(t);
  const W = Math.round(380 * escala), H = Math.round(440 * escala), tela = new Tela(W, H), g = tela.getContext('2d');
  g.setTransform(escala, 0, 0, escala, 0, 0);
  foto.cartaoDeMentira(g, m.host, tema.layout);
  m.desenhar(g);
  return tela;
}

if (require.main === module) {
  const a = {};
  for (let i = 2; i < process.argv.length; i += 2) a[process.argv[i].slice(2)] = process.argv[i + 1];
  const ts = String(a.tira || '1').split(',').map(Number), zoom = Number(a.zoom || 1);
  const telas = ts.map(t => quadro({ chefe: a.chefe || 0, id: a.id, cena: a.cena, t, roupa: a.roupa, semente: a.semente || 7, altura: a.altura || 130 }));
  fs.writeFileSync(a.saida, foto.png(foto.tira(telas), zoom));
  console.log(`${a.saida}: ${telas.length} quadro(s)`);
}
module.exports = { quadro };
