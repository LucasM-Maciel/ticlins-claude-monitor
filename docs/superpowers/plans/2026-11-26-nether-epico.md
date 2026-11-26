# Portal do Nether épico (palco + Ghast) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** a cena do portal do Nether (tema Minecraft) ganha um palco acima do cartão com o cenário do
bioma e um Ghast cuja bola de fogo o Clawd rebate. O mob que vinha andando pela borda sai.

**Architecture:**
- O motor é Node e é compartilhado pelas 3 janelinhas. Tudo é função de `t`, desenhado num
  canvas de mentira (`raster.js`).
- O palco segue o molde do `elden-epico.js` `desenhar()`: `setTransform(e,0,0,e,OX*e,OY*e)`,
  clip `rect(0, topo, cw, -topo)`, altura `HJ = round(lim(cartao.y - 14, 72, 184))`, fundo
  pronto em cache por tamanho.
- O palco e o Ghast moram num arquivo novo. `minecraft-nether.js` só orquestra a linha do tempo,
  o Clawd, o portal e a trilha.

**Tech Stack:** Node 22, `node:test`. Sem dependências novas. Texturas e sons vêm da Mojang via
`extensao/janelinha/minecraft.js`.

**Spec:** `docs/superpowers/specs/2026-11-26-nether-epico-design.md`

## Global Constraints
- **Duração:** a cena continua ~20 s (`T.fim` ≤ 21). O portal segue a cada 30 eventos
  (`PORTAL = 30`, já feito). A trava de "cortado antes do Nether não gasta a vez" usa `T.vira0`:
  manter essa chave.
- **Volume:** a trilha fica com RMS de -29 ± 2 dBFS e janela de 0,4 s mais alta ≤ -20 dBFS,
  medidos como `scratchpad/nether/gravar.js` mede. O ganho final segue `VOLUME * 0.75`.
- **Espaço:** nada do palco desenha abaixo da borda de cima do cartão (y > 0 no referencial do
  cartão). O cartão e os nomes nunca ficam cobertos.
- **Sem textura:** a cena não roda (`temTexturas`), como hoje. Nenhum erro em `m.erros`.
- **Interface:** `evento.id = 'portal'`, `especial`, `soCima`, `espaco.frente`, `fundoNether`,
  `BIOMAS` e `T` continuam exportados. `tema-minecraft.js` não muda, salvo se um teste mostrar
  que precisa.
- **Comentários:** em português, no estilo do arquivo.

## Review Focus
1. **Instalação antiga, sem as texturas novas** (`ghast`, `lava_still`...): o portal não pode
   quebrar a janelinha. Esperado: a cena fica fora até o `minecraft.js` baixar de novo. Teste na
   Task 1.
2. **Cartão baixo** (`cartao.y` pequeno, `HJ` = 72): o Ghast e a bola de fogo cabem no palco
   sem cortar a cabeça. Teste na Task 2.
3. **Cena cortada no meio** (pergunta ou permissão chegou, `aoFimCena` com `cortada`): a borda e
   o palco somem no quadro seguinte, sem resto desenhado. Teste na Task 3.
4. **Escala 1,5 / 2** (`host.escala`): o palco alinha com o cartão, sem a faixa de 1 px. Foto na
   Task 4.
5. **Portal pelo menu com o Clawd parado** (`manual`, `naTrilha`): o palco abre a partir de onde
   ele está. Teste na Task 3.

---

### Task 1: texturas e sons novos no download do Minecraft

**Files:**
- Modify: `extensao/janelinha/minecraft.js:56-81` (SONS, RECORTES, ATAQUES) e `:157-162` (TEXTURAS)
- Test: `testes/node/minecraft.test.js` (já cobre qualquer item novo das listas)

**Interfaces:**
- Produces:
  - em `IMG` (motor): `ghast`, `ghast_atira`, `lava`, `tijolo_nether`, `glowstone`, `bola_fogo`;
  - em `sons/`: `nether_ghast_geme`, `nether_ghast_grita`, `nether_ghast_morre`, `nether_explode`
    (o `sopro`, que é `mob/ghast/fireball4`, já existe).

- [ ] **Step 1:** Acrescentar ao `Object.assign(TEXTURAS, {...})` do Nether:
  - `ghast: "entity/ghast/ghast"`, `ghast_atira: "entity/ghast/ghast_shooting"`;
  - `lava: "block/lava_still"`, `tijolo_nether: "block/nether_bricks"`;
  - `glowstone: "block/glowstone"`, `bola_fogo: "item/fire_charge"`.
- [ ] **Step 2:** Acrescentar aos SONS:
  - `nether_ghast_geme: "mob/ghast/moan1"`, `nether_ghast_grita: "mob/ghast/scream1"`;
  - `nether_ghast_morre: "mob/ghast/death"`, `nether_explode: "random/explode1"`.
- [ ] **Step 3:** Rodar `node --test testes/node/minecraft.test.js`. Esperado: PASS (o falso da
  Mojang serve tudo o que está nas listas).
- [ ] **Step 4:** No `minecraft-nether.test.js`, escrever o teste
  `'portal: sem as texturas novas a cena não entra'`: apagar `IMG.ghast` e
  `m.salvo.portal = true`; `tema.naParada(m)` no começo da borda de cima não devolve a cena
  `portal`. Rodar: PASS depois da Task 3 (pôr `ghast` em `TEXTURAS` do evento).

### Task 2: o palco e o Ghast (arquivo novo)

**Files:**
- Create: `extensao/janelinha/motor/minecraft-nether-palco.js`
- Test: `testes/node/minecraft-nether.test.js`

**Interfaces:**
- Consumes: `IMG`, `lim`, `sai`, `rng` de `./comum`, e `fazExplosao`, `desenhaExplosao`,
  `fazOrbes`/`desenhaOrbes` (ou os nomes que `minecraft-kit.js` exporta pro XP) de
  `./minecraft-kit`.
- Produces:
  - `montarPalco(m) -> P`, com `P = { cw, HJ, OX, OY, e }`;
  - `desenhaPalco(g, P, bioma, ab, T0)`: `ab` 0..1 é o quanto abriu. Desenha o fundo do bioma, o
    teto de netherrack com glowstone, a luz e as partículas. Também a moldura de netherrack no
    contorno do palco, com a borda de cima clara enquanto abre/fecha;
  - `desenhaGhast(g, P, x, y, est)`: `est = { alfa, boca: bool, balanco: s, golpeado: 0..1 }`. O
    `x`/`y` é o meio de baixo do corpo, no referencial do palco;
  - `desenhaBola(g, x, y, t)`: a bola de fogo girando;
  - `GHAST_LADO(P) -> px`: o tamanho do corpo do Ghast, em px, que cabe no palco.

- [ ] **Step 1: testes**
  - `'palco: cabe acima do cartão'`: com `cartao` em `[98, 90, 248, 146]` e em
    `[98, 300, 248, 146]`, verificar `P.HJ === Math.round(lim(cartao[1]-14, 72, 184))`.
    Desenhar `desenhaPalco(..., ab=1)` numa `Tela` 380x440 e verificar que nenhum pixel abaixo
    de `cartao.y` mudou em relação à tela vazia.
  - `'palco: o Ghast cabe'`: com `HJ = 72`, verificar que `GHAST_LADO(P) + 8` (os tentáculos)
    `<= HJ - 12` (o teto). Com `HJ = 184`, verificar `GHAST_LADO(P) >= 40`.
  - `'palco: 3 biomas desenham sem erro'`.
- [ ] **Step 2:** Rodar `node --test testes/node/minecraft-nether.test.js`. Esperado: FAIL
  (módulo não existe).
- [ ] **Step 3: implementar.** Fundo pronto em cache por `cw x HJ x bioma`, faixas por linha (o
  raster não tem gradiente).
  - **netherrack:** céu vermelho-escuro; mar de `lava` (textura animada, 4 quadros/s) nos 18 px de
    baixo; silhueta da fortaleza em `tijolo_nether` à direita, ao fundo; colunas de netherrack.
  - **almas:** azul-escuro, chão de soul sand, fogo azul e almas subindo.
  - **basalto:** cinza-roxo, colunas de basalto (`basalto_lado`/`basalto_topo`) e cinza caindo.
  - **Teto:** uma fileira de netherrack com 2–3 `glowstone`, e um clarão de luz debaixo de cada
    glowstone.
  - **Ghast:** o rosto é a face da frente do cubo na textura 64x32 (u 16..32, v 16..32). A boca
    aberta vem de `ghast_atira`. Os 9 tentáculos são colunas de 2 px da cor do corpo, balançando
    com `sin(t*3 + i)`. Desenhar com `imageSmoothing` desligado (pixel duro).
- [ ] **Step 4:** Rodar os testes. Esperado: PASS.
- [ ] **Step 5:** Foto: rodar `node testes/motor-foto.js` com uma cena de teste ou um script
  scratch, nos 3 biomas, e olhar o PNG. Não commitar.

### Task 3: a linha do tempo nova em `minecraft-nether.js`

**Files:**
- Modify: `extensao/janelinha/motor/minecraft-nether.js`. Tirar o mob (`BIOMAS[].mob`, `MAGMA`,
  o bloco "o mob" em `quadro`, os sons do mob). Mudar `T` e `sons()`. Portal 2x (`L = 16`).
- Test: `testes/node/minecraft-nether.test.js`

**Interfaces:**
- Consumes: Task 2 (`montarPalco`, `desenhaPalco`, `desenhaGhast`, `desenhaBola`, `GHAST_LADO`).
- Produces (o `T` novo, em s; quem mexer depois usa estes nomes):
  - mantém: `poe, cada, isqueiro, acende, vai, chega, some, vira0, vira1, volta, saiu, desvira0,
    desvira1, reaparece0, reaparece1, sai0, sai1, quebra, fim`;
  - novos: `abre0, abre1` (o palco abre, junto com `vira0..vira1`); `ghast0, ghast1` (sobe por
    trás do cenário e geme); `atira` (abre a boca e cospe); `rebate` (a bola chega no Clawd e ele
    golpeia com a varrida); `acerta` (a bola volta e explode no Ghast, com orbes); `fecha0, fecha1`
    (o palco fecha, junto com `desvira0..desvira1`).
  - Sai: `mob0, mob1, susto, corre0, corre1, entra` (o `entra` vira a volta pelo portal depois do
    `acerta`, com o mesmo papel).

- [ ] **Step 1: testes**
  - `'portal: a cena inteira nos 3 biomas, quadro a quadro, sem erro'`: o teste que já existe
    passa a andar até `T.fim` com o palco.
  - `'portal: o Ghast morre e solta orbes'`: em `t = T.acerta + 0.3`, a cena desenha a explosão.
    Ou seja: `quadro` não lança erro e o pixel no meio do Ghast é diferente de
    `t = T.acerta - 0.1`.
  - `'portal: a trilha tem os sons do Ghast e não tem mais os do mob'`: `c.sons` inclui
    `sons/nether_ghast_geme.wav`, `sons/nether_ghast_morre.wav` e `sons/nether_explode.wav`, e
    não inclui nenhum `nether_piglin*`, `nether_esqueleto` ou `nether_magma*`.
  - `'portal cortado: a borda e o palco somem'` (Review Focus 3): cortar em
    `T.ghast0 + 0.5`; o quadro seguinte do tema não desenha nada acima do cartão.
  - `'portal pelo menu, parado: o palco abre'` (Review Focus 5): estender o teste do menu que já
    existe. Em `t = T.abre1 + 0.1`, há pixels desenhados acima do cartão.
- [ ] **Step 2:** Rodar. Esperado: FAIL nos novos.
- [ ] **Step 3: implementar.**
  - `quadro(g, t, roupa, mundo)` desenha o palco primeiro, salvando e restaurando o transform:
    `g.getTransform()`, depois `setTransform` pro cartão, como no Elden. Depois o portal e o
    Clawd, como hoje.
  - O Clawd não leva susto. Na linha do tempo:
    1. ele para em `X1` e olha o Ghast subir;
    2. em `rebate`, golpeia com a picareta (`clawd.golpe`) e solta a varrida do kit;
    3. depois do `acerta`, comemora: olhos `cima`, um pulinho;
    4. volta pro portal e repete a saída de hoje.
  - A bola vai do Ghast até o Clawd em `atira..rebate` e volta em `rebate..acerta`, ambas em linha
    com um leve arco.
  - A música não abaixa mais no susto (sai o PAN). O grito do Ghast vai em `atira`, a explosão e
    a morte em `acerta`.
  - Ganho final: `VOLUME * 0.75`.
  - Acrescentar `ghast`, `ghast_atira`, `lava`, `tijolo_nether`, `glowstone` e `bola_fogo` em
    `TEXTURAS`. Tirar `piglin_zumbi` e `esqueleto` de `TEXTURAS` se nada mais usar.
- [ ] **Step 4:** Rodar `node --test testes/node/minecraft-nether.test.js testes/node/tema-minecraft.test.js`.
  Esperado: PASS.
- [ ] **Step 5:** Medir o volume com o `scratchpad/nether/gravar.js`. Esperado: RMS de -29 ± 2,
  janela mais alta ≤ -20.

### Task 4: prévia pro dono (portão) e vídeo

- [ ] **Step 1:** Tira de 6 quadros com as texturas reais, nos instantes `T.acende+0.3`,
  `T.abre1+0.2`, `T.ghast1`, `(T.atira+T.rebate)/2`, `T.acerta+0.15` e `T.fecha0+0.3`. Bioma
  netherrack, escala 2, `--zoom 2`. Mandar pro dono. **Parar até ele aprovar o visual**; ajustes
  de arte voltam pra Task 2/3.
- [ ] **Step 2:** Aprovado: vídeo dos 3 biomas, com som
  (`scratchpad/nether/gravar.js <saida> portal:<bioma>` + ffmpeg).
- [ ] **Step 3:** Escala 1,5 (Review Focus 4): uma foto. Conferir que a moldura do palco alinha
  com o cartão.

### Task 5: fechar

- [ ] **Step 1:** README.md, linha do portal (~154): descrever a cena nova. O README.en.md não
  cita o portal hoje: acrescentar uma linha equivalente.
- [ ] **Step 2:** `npm run empacotar`, depois `node --test` com a lista de arquivos de
  `testes/node/*.test.js` (uma pasta não roda). Esperado: só as falhas de tempo de sempre, que
  passam sozinhas.
- [ ] **Step 3:** `powershell.exe -File testes\windows\testes.ps1`. Esperado: tudo ok.
- [ ] **Step 4:** O agente `paridade-monitor` no diff. É só motor, então espera-se nada a fazer
  no Mac e no Linux.
- [ ] **Step 5:** Commit (noreply + Co-Authored-By) **só com o OK do dono**. Push e versão nova:
  o dono decide.
