# Portal do Nether: o Nether abre em cima do cartão (redesenho)

## Por quê
O dono viu o vídeo da cena do PR #5 (26/11) e disse: "tá feio e nada criativo, deixe melhor o
visual". Hoje o portal é minúsculo (vão de 16x24 px), o "Nether" é só a textura da borda trocada
e o espaço da janelinha acima do cartão fica vazio. Os outros épicos (Akatsuki, Elden, Dragon
Ball) usam esse espaço como palco.

## Objetivo
Uma cena épica no nível dos outros temas, sem jogar fora o trabalho do PR (o portal, a borda
virando Nether, os sons do jogo).

- **Não é objetivo:** mudar a frequência (30 eventos, decidido em 26/11) nem o volume (o novo,
  ~-29 dBFS).
- **Seria fracasso:** continuar pequeno e confinado à borda. Também seria fracasso cobrir o cartão
  ou os nomes das sessões.

## Abordagens consideradas
- **A. Polir a cena atual.** Portal maior e animado, partículas e luz. Rápido, mas continua pequena.
- **B. O Nether abre em cima do cartão + Ghast.** ⭐ **Escolhida pelo dono (26/11).**
- **C. História nova** (bastião, Piglins). Joga fora quase tudo do PR.

## A cena (B), ~20 s
1. **Portal** (mantém): o Clawd põe as obsidianas e acende o portal. O portal fica **2x maior**,
   com o roxo girando e partículas roxas subindo. Ele entra.
2. **O palco abre** acima do cartão, de baixo pra cima. É o mesmo palco dos outros épicos:
   altura `lim(cartao.y - 14, 72, 184)`.
   - O cenário é do bioma sorteado, os mesmos 3 de hoje:
     - netherrack: mar de lava no fundo e a fortaleza (tijolo do Nether) recortada no horizonte;
     - soul sand: vale azul, fogo azul e almas subindo;
     - basalto: colunas de basalto e cinza caindo.
   - Teto de netherrack e glowstone em cima.
   - Luz vermelha (ou azul) no palco.
   - A borda do cartão vira Nether, como já faz hoje.
3. **Ghast:** ele sobe por trás do cenário, com o gemido do jogo, e flutua com os tentáculos
   balançando. Abre a boca e cospe uma bola de fogo.
4. **Rebate:** o Clawd golpeia a bola de fogo de volta, com o golpe da varrida que já existe. A
   bola acerta o Ghast, que explode em fumaça e solta orbes de XP.
5. **Volta:** o Clawd volta pelo portal, o palco fecha de cima pra baixo, a borda volta a ser
   grama e o portal quebra. Ele segue andando, como hoje.

O mob que vem andando pela borda (piglin, esqueleto, magma cube) **sai**: o Ghast é o adversário.
O susto vira o momento da bola de fogo.

## Como (decisões minhas, o dono pode corrigir)
- **Arquivo:** continua sendo `minecraft-nether.js`, e o palco segue o molde de `elden-epico.js`
  e `akatsuki-epico.js`. O motor é compartilhado, então vale nos 3 sistemas sem mexer nas
  janelinhas.
- **Texturas e sons novos, baixados da Mojang pelo `minecraft.js`** (como todos os do tema):
  - texturas: `entity/ghast/ghast`, `ghast_shooting`, `block/lava_still` (animada),
    `block/nether_bricks`, `block/glowstone`;
  - sons: `mob/ghast/moan`, `mob/ghast/scream`, `mob/ghast/death` e `random/explode`.
  - Sem textura, a cena não roda, como hoje (`temTexturas`).
- **Volume:** a trilha nova no mesmo nível medido de agora: RMS de -29 dBFS, com o pico abaixo de
  -20 dBFS.
- **Testes:** `minecraft-nether.test.js` cobre a cena nos 3 biomas sem erro, o palco não cobrindo
  o cartão, o Ghast morrendo e a trilha com os sons novos. O resto do teste continua (frequência,
  menu, portal cortado).
- **Aprovação em 2 passos:**
  1. uma tira de 6 quadros (portal, palco aberto, Ghast, bola de fogo, explosão, volta) pro dono
     aprovar o visual;
  2. depois, a cena inteira em vídeo com som.

## Fica pro construtor
Posições exatas, tempos de cada fase e a arte em pixel do cenário: o que ficar bonito na tira de
prévia.
