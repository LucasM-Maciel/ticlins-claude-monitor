# Motor das animações

Tudo que mexe em volta do cartão (o Clawd, as cenas, os enfeites de cada tema) é
desenhado por **um** programa em Node, `extensao/janelinha/motor/motor.js`, igual no
Windows e no Mac. A janelinha (overlay.ps1 / overlay.swift) cuida do resto: lista das
sessões, nomes, clique, sons, menu. Node já é obrigatório (os hooks rodam `node`); sem
ele, ou com o motor caído, a janelinha mostra o Clawd simples de antes, sem cenas, e os
enfeites dela (no Windows, os do Minecraft em WPF; o resto, como o Padrão).

## Como conversam

- A janelinha abre `node motor/motor.js --pasta ~/.claude-monitor` e manda, pela entrada
  padrão, uma linha JSON por mensagem:
  - `{"msg":"estado", ...}` (abaixo): só quando algo muda.
  - `{"msg":"evento","tipo":"terminou"|"tudo"}`: uma sessão terminou / acabou tudo.
- O motor desenha 30 quadros/s (5 quando nada mexe) em software (`raster.js`, um pedaço
  do Canvas 2D sem suavização) e manda pela saída padrão só o retângulo que mudou:
  `"CM"` + tipo + 0 + tamanho (uint32 LE) + dados. Tipos: `Q` quadro (W,H,x,y,w,h em
  uint16 + BGRA pré-multiplicado), `L` linha pro diário, `P` pronto (`{pronto, temas:
  {nome: layout}}`).
- Windows: `motor/Motor.cs` (compilado pelo overlay.ps1 e guardado em
  `~/.claude-monitor/motor-<hash>.dll`) lê numa thread própria e cola num WriteableBitmap
  por cima da janela inteira.
- Mac: `overlay.swift` abre o node com `Process` + `Pipe`, lê numa thread própria e cola
  os pixels num `CGImage` por cima da janela inteira; o layout do motor vale sempre que
  ele está vivo (a moldura de terra do Minecraft sai do motor mesmo sem textura).

### A mensagem `estado`

Tudo em DIPs, relativo à janela (o motor multiplica por `escala` pra desenhar em pixels).

```js
{
  msg: 'estado', tema: 'minecraft', clawd: true, modo: 'andando' | 'pulando' | 'parado',
  escala: 1.25, janela: [380, 440], cartao: [x, y, w, h], raio: 8, opacidade: 1,
  // uma por sessão, na ordem da lista
  linhas: [{
    id, sit: 'working' | 'finished' | 'question' | 'permission' | <outra>,
    cor: '#22C55E',                                  // a cor que a janelinha usaria
    bola: [x, y, w, h],                              // o lugar da bolinha (8x8)
    tempo: { txt: '12m', cor, caixa: [x, y, w, h] }, // encostado à DIREITA da caixa
  }],
  // as barras do usage (5h, 7d); [] = usage indisponível (a janelinha escreve isso)
  uso: [{
    rotulo: { txt: '5h', cor, caixa },               // à esquerda
    barra: [x, y, w, h], pct: 38, nivel: 0 | 1 | 2,  // nivel: 1 = ≥80%, 2 = ≥95%
    pctTxt: { txt: '38%', cor, caixa },              // à direita
    falta: { txt: '1h20', cor, caixa },              // à direita
  }],
}
```

`linhas` e `uso` vêm sempre, mas só valem pro tema com `layout.enfeites`; sem isso quem
desenha a bolinha, os números e a barra é a janelinha. O nome da sessão, "nenhuma sessão aberta",
"usage indisponível" e o aviso de versão nova são sempre da janelinha (Segoe UI 12).

### O `layout` de cada tema (vai na mensagem P)

A janelinha monta o cartão com isso enquanto o motor está vivo; sem motor, usa o dela.

```js
layout: {
  raio: 8,                    // cantos do cartão
  fundo: '#E6181818',         // fundo do cartão (a janelinha pinta, com a opacidade)
  moldura: [0, 0, 0, 0],      // esq, cima, dir, baixo: px livres em volta do conteúdo pra
                              // moldura que o tema desenha no fundo() (Minecraft: [6, 8, 6, 6])
  padding: [10, 6, 10, 6],    // entre a moldura e o conteúdo
  enfeites: false,            // true: o tema desenha bolinha, números e barra nas caixas
                              // de linhas/uso; a janelinha só guarda o lugar
  colunas: { tempo: 36, pct: 38, falta: 48, rotulo: 18 },  // largura das caixas (enfeites)
  letra: 16,                  // altura das caixas de número (a linha do usage fica dessa altura)
  barra: [118, 4],            // tamanho da caixa da barra
}
```

## Arquivos

| Arquivo | O quê |
|---|---|
| `raster.js` | Canvas 2D em software (fillRect, drawImage, transformações, alfa, caminhos, clip) + PNG |
| `comum.js` | ajudantes das cenas: `tela`, `arte` (pixel art de texto), `tingida`, `rng`, `sortearPeso`, `cache`, `IMG` (texturas), `rgba`, `mistura`, `reamostrar` (suavizado) |
| `clawd.js` | o Clawd (roupas, `desenhaClawd`, `andando`, `pulando`, `golpe`) e a `trilha` |
| `mundo.js` | a simulação: onde o Clawd está, paradas, sorteio de cena, modos, `motor-estado.json` |
| `motor.js` | entrada/saída e o relógio |
| `tema-*.js` | um por tema (com os arquivos `<tema>-*.js` dele, se precisar) |

O que o `raster.js` **não** tem (dá erro ou é ignorado): `fillText`/`measureText`/`font`
(texto = fonte de pixel desenhada pelo tema), `roundRect` (TypeError), `filter` (ignorado),
gradiente linear, `Path2D`, curvas de Bézier. Cor ou `globalCompositeOperation` inválidos
LANÇAM erro (o navegador ignora). `drawImage` é sempre pixel duro; pra suavizar, `reamostrar`.

## Um tema

```js
module.exports = {
  layout: { ... },                // acima
  texturas: ['picareta', ...],    // PNGs da pasta (as do Minecraft vêm da Mojang pelo minecraft.js)
  trilha: { raio, baixo },        // canto da trilha; "baixo" estica a trilha pra baixo (a nuvem)
  roupas: { ... },                // opcional: registrarRoupas() no iniciar
  iniciar(m), passo(m, dt),       // estado próprio em m.estado; o que dura entre aberturas em m.salvo + m.salvar()
  fundo(g, m),                    // moldura e enfeites do cartão (com a opacidade do cartão)
  atras(g, m), frente(g, m),      // o que fica atrás/na frente do Clawd (pet, nuvem, dragão), coordenadas da janela
  clawd(g, m),                    // o Clawd fora de cena, já no lugar dele (m.modo: andando|pulando|parado)
  naParada(m),                    // andando, a cada 20-45 s: devolve uma cena, null (nada) ou undefined (tenta já já)
  aoComecarAndar(m), aoMudarModo(m, antes, agora), aoEvento(m, tipo),
  aoComecarCena(m, cena), aoFimCena(m, cena, cortada), bloqueia(m),
  cenaPorNome(m, nome),           // pros testes e pro -Foto -Cena
  cenas: ['zumbi', ...],          // os nomes que cenaPorNome conhece (o teste passa por todas)
  animado(m),                     // false = nada mexe parado (o motor cai pra 5 quadros/s)
};
```

Cena: `{ nome, dur, espaco: {frente, tras}, modos: ['andando'], quadro(g, t, m) }`. O
quadro é **função do tempo** (`t` desde o começo da cena): sorteios com `rng(semente)`
fixada quando a cena começa. Assim o teste fotografa qualquer instante e o motor pode
pular quadros. Coordenadas: origem entre os pés do Clawd, x+ pra frente, y- pra fora do
cartão. Cena que precisa da janela inteira (o dragão): `g.save(); g.setTransform(e, 0, 0,
e, 0, 0)` com `e = m.host.escala || 1`, desenha em DIPs da janela, `g.restore()`.
Pergunta/permissão (modo `pulando`) corta qualquer cena.

Dentro do `fundo`, `frente` e `atras` as coordenadas já são as da janela (DIPs).

## Regras

- Nada de cache sem teto (`cache(n)` do comum.js): o motor roda dias.
- Cena que lança erro é anotada no diário, encerrada e não é mais sorteada até reabrir;
  erro fora de cena 10x seguidas: o tema cai pro Padrão até reabrir.
- Custo: quadro típico abaixo de 4 ms em escala 1,25 (o node fica em ~3% de um núcleo); o
  pior quadro de qualquer cena abaixo de 12 ms. Desenho caro (nuvem, letras, dragão):
  pronto 1x e guardado.
- Ver um quadro: `node testes/motor-foto.js --tema minecraft --cena zumbi --tira 0,1,2 --zoom 3 --saida f.png`.
- Testes de cada tema em `testes/node/tema-<nome>.test.js`: toda cena, quadro a quadro, sem
  erro, nas escalas 1, 1,25 e 2; mesmo quadro = mesmos bytes; o custo acima.
