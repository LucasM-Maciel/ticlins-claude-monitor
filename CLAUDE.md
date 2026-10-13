# Claude Monitor

Notas para quem mexe no código, incluindo o Claude Code. O que é o projeto e como instalar
está no README.

## Onde fica cada coisa

- `extensao/`: a extensão do VS Code. `out/*.js` É o código-fonte (não tem build de TS).
  `out/hook.js` é o hook do Claude Code; ele grava o estado de cada sessão em
  `~/.claude-monitor/sessions/<id>.json`.
- `extensao/janelinha/`: a janelinha. Uma por sistema:
  `overlay.ps1` (Windows, WPF no PowerShell 5.1), `overlay.swift` (Mac),
  `overlay-linux.py` (Linux, GTK 3). As animações saem de um motor único em Node
  (`motor/`, explicado em `docs/MOTOR.md`), com um `tema-*.js` por tema.
- `instalar/`: os instaladores dos 3 sistemas.
- `testes/`: `node/*.test.js`, `windows/testes.ps1`, `mac/testes.sh`, `linux/testes.sh`.
  Os cenários de foto ficam em `testes/cenarios.js`.

## Testar

```
npm ci
npm run empacotar     # gera dist/: SEMPRE antes dos testes
npm run testar        # node --test testes/node/*.test.js
powershell.exe -NoProfile -ExecutionPolicy Bypass -File testes\windows\testes.ps1
```

- Rode o `testes.ps1` só no **Windows PowerShell 5.1** (`powershell.exe`). No pwsh 7 ele dá
  ~19 falhas falsas de System.Drawing. O CI e a máquina dos usuários usam o 5.1.
- Não teste em paralelo com o `npm run empacotar`: o teste pegaria o `dist/` velho.
- O Swift (Mac) só compila no CI. Para ver a janelinha do Mac:
  `gh run download <id> -n prints-macos-15`. Para o Linux: `-n prints-linux`.
- O teste "uma só / se reabre" pula quando há uma janelinha real aberta. Nesse caso, só o CI prova.
- O teste "custo por quadro na escala 1,25" oscila com o PC ocupado. Rode de novo antes de
  concluir que quebrou.
- Teste que cria pasta temporária (a "casa falsa" `cm-ext-*`) apaga a pasta no fim. Sem isso,
  o Temp junta GBs por dia.
- Os `.sh` passam pelo shellcheck no CI (`-S warning`).

## Os 3 sistemas andam juntos

Mudança que aparece na janelinha (desenho, clique, menu, som, config.json) vale para Windows,
Mac e Linux. Ela entra nos 3 overlays e ganha um cenário nos 3 testes. O menu do botão direito
do Mac (sliders) não tem teste: só compila.

## PowerShell (overlay.ps1): pegadinhas que já derrubaram a janelinha

- **Escopo dinâmico.** O `$win.DragMove()` (e ShowDialog, PushFrame) roda os timers DENTRO
  do handler do clique. Uma variável local do handler com o nome de uma variável do script
  troca a do script no meio do arrasto, e a janelinha morre sem "fechou" no diário. Todo nome
  novo em handler tem que ser único. O teste "nomes do clique" confere isso pelo AST.
- `[math]::Min(1, x)` escolhe a versão inteira (0,33 vira 0). Use `1.0`.
- `-ErrorAction SilentlyContinue`, e também erro pego em try/catch, somam no `$Error`. Isso
  vira um "fechou (N erros)" falso no diário. Use `-ErrorAction Ignore`, ou confira
  `[IO.File]::Exists` antes.
- O PowerShell não diferencia maiúscula de minúscula: o parâmetro `-Cena` e a variável `$cena`
  são a mesma coisa (por isso o estado da luta se chama `$luta`).
- Processo filho do VS Code herda `ELECTRON_RUN_AS_NODE=1`, e com ela o `Code.exe --open-url`
  morre calado. O overlay.ps1 remove a variável logo no início. Faça o mesmo antes de testar
  um link `vscode://`.

## Sons e texturas do Minecraft

São da Mojang. A `janelinha/minecraft.js` baixa tudo na máquina de cada usuário. Nunca commite
`.ogg`, `.wav` ou `.png` do jogo (a EULA proíbe redistribuir). Nos testes, a Mojang é falsa
(`testes/mojang-falso.js`).

## Diário

O diário fica em `~/.claude-monitor/janelinha.log`, uma linha por evento: `hora [pid] evento`.
Para diagnosticar "sumiu":
- `reabri como [N]` sem um `[N] abriu` depois: o processo morreu antes do mutex.
- `abriu` sem `fechou`: crash ou kill.
- Processo vivo e janela visível: olhe a ordem Z antes de concluir que ela fechou.

## Versão nova

1. Suba a `version` em `extensao/package.json`.
2. Faça o push e espere o CI ficar verde (pacote + Windows + macOS 14/15 + Linux).
3. Crie e envie a tag: `git tag vX.Y.Z && git push origin vX.Y.Z`. O job `publicar` cria a
   release com o `ClaudeMonitor.zip`.

Nunca reescreva uma tag publicada: suba a versão de novo.

## Commits

Conventional Commits em português, com escopo: `feat(sith): ...`, `fix(instalador): ...`,
`chore: 0.9.0`. Use o e-mail noreply do GitHub.
