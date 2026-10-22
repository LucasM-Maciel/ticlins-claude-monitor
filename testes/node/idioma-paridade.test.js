'use strict';
// O inglês do menu (Idioma = English) nas 3 janelinhas: o mesmo glossário no Windows, no Mac e no
// Linux, e nenhum texto da tela em português sem o par em inglês do lado. O Swift só compila no CI:
// é aqui que um texto esquecido no Mac aparece antes.
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const JANELINHA = path.join(__dirname, '..', '..', 'extensao', 'janelinha');
const ARQUIVOS = ['overlay.ps1', 'overlay.swift', 'overlay-linux.py'];
const linhas = Object.fromEntries(ARQUIVOS.map(f => [f, fs.readFileSync(path.join(JANELINHA, f), 'utf8').split('\n')]));
const escapar = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const comentario = l => /^\s*(#|\/\/)/.test(l);

// os rótulos do menu: "Temas" no Windows e no Mac, "Tema: X" no Linux (e "Uso" também é nome de painel
// no XAML), então só o começo do par
const ROTULOS = [['Tema', 'Theme'], ['Uso', 'Usage'], ['Mostrar', 'Show'], ['Idioma', 'Language']];
// [pt, en]: o que a janelinha escreve na tela e no menu; o par fica na mesma linha (no tr(...) ou na tabela)
const GLOSSARIO = [
  ['Padrão', 'Default'], ['Os dois', 'Both'], ['Abas', 'Tabs'], ['Agentes', 'Agents'], ['Tudo', 'All'],
  ['Ritmo', 'Pace'], ['Opacidade', 'Opacity'], ['Fechar', 'Close'], ['Português', 'English'],
  ['trabalhando', 'working'], ['terminou', 'done'], ['pergunta pra você', 'asking you'], ['pedindo permissão', 'needs permission'],
  ['agora', 'now'], ['folga', 'slow'], ['no ritmo', 'on pace'], ['acima', 'fast'], ['estourando', 'too fast'],
  ['padrão', 'default'], ['conta', 'account'],
  ['usage indisponível', 'usage unavailable'], ['Codex: sem uso ainda', 'Codex: no usage yet'], ['nenhuma sessão aberta', 'no open sessions'],
  ['↑ versão', '↑ version'], ['Baixa o zip: extraia e siga o COMO ATUALIZAR.txt', 'Downloads the zip: extract it and follow HOW TO UPDATE.txt'],
];

test('idioma: cada par do glossário aparece junto (pt e en na mesma linha) nas 3 janelinhas', () => {
  for (const [pt, en] of [...ROTULOS, ...GLOSSARIO]) {
    const comeca = s => new RegExp(`['"]${escapar(s)}`);
    for (const f of ARQUIVOS) {
      assert.ok(linhas[f].some(l => !comentario(l) && comeca(pt).test(l) && comeca(en).test(l)), `${f}: falta o par "${pt}" / "${en}"`);
    }
  }
});

test('idioma: nenhum texto do glossário em português sem o inglês do lado (nada esquecido)', () => {
  for (const [pt, en] of GLOSSARIO.filter(([pt]) => pt !== 'terminou')) {  // "terminou" também é o nome do som (terminou.wav)
    const literal = new RegExp(`(['"])${escapar(pt)}\\1`);
    for (const f of ARQUIVOS) {
      linhas[f].forEach((l, i) => {
        if (!comentario(l) && literal.test(l)) assert.ok(l.includes(en), `${f}:${i + 1} tem "${pt}" sem "${en}": ${l.trim()}`);
      });
    }
  }
});
