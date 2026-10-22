#!/bin/bash
# Instala o Claude Monitor no Mac: a extensão no VS Code/Cursor, os hooks no
# Claude Code, a janelinha (compilada aqui, uma vez) e, se tiver Minecraft, os
# sons e a picareta do jogo. Rodar de novo não estraga: reinstala por cima.
# Uso: abra o Terminal, digite "bash " (com espaço), arraste este arquivo pra
# janela e aperte Enter.
# Testes: --sem-abrir (não abre a janelinha no final).
SEM_ABRIR=""
[ "${1:-}" = "--sem-abrir" ] && SEM_ABRIR=1

AQUI="$(cd "$(dirname "$0")" && pwd)"
PASTA="$HOME/.claude-monitor"
# o idioma do botão direito da janelinha (config.json): quem já escolheu inglês reinstala em inglês
EN=""
grep -q '"idioma"[[:space:]]*:[[:space:]]*"en"' "$PASTA/config.json" 2>/dev/null && EN=1
# o texto em português ($1) ou, com o idioma em inglês, o $2 (quando vier)
msg() { if [ -n "$EN" ] && [ -n "${2:-}" ]; then printf '%s' "$2"; else printf '%s' "$1"; fi; }
passo() { printf '\n\033[36m== %s\033[0m\n' "$(msg "$@")"; }
ok() { printf '   \033[32mOK\033[0m  %s\n' "$(msg "$@")"; }
aviso() { printf '   \033[33m!!\033[0m  %s\n' "$(msg "$@")"; }
falhou() { printf '\n   \033[31mXX\033[0m  %s\n\n' "$(msg "$@")"; exit 1; }

VSIX=$(ls "$AQUI"/arquivos/claude-monitor-*.vsix 2>/dev/null | tail -1)
[ -n "$VSIX" ] || falhou "Não achei o arquivos/claude-monitor-*.vsix do lado deste instalador. Extraia o .zip inteiro antes." "Couldn't find arquivos/claude-monitor-*.vsix next to this installer. Extract the whole .zip first."
VERSAO=$(basename "$VSIX" .vsix | sed 's/^claude-monitor-//')
printf '\033[36mClaude Monitor %s\033[0m\n' "$VERSAO"

passo "Procurando o VS Code / Cursor" "Looking for VS Code / Cursor"
EDITORES=()
for par in "code|/Applications/Visual Studio Code.app/Contents/Resources/app/bin/code" \
           "cursor|/Applications/Cursor.app/Contents/Resources/app/bin/cursor"; do
  nome="${par%%|*}"
  fixo="${par#*|}"
  exe=""
  while IFS= read -r c; do
    # o Cursor pode pôr um "code" dele no PATH: esse não é o VS Code
    if [ "$nome" = code ]; then case "$c $(readlink "$c" 2>/dev/null)" in *[Cc]ursor*) continue ;; esac; fi
    exe="$c"
    break
  done < <(type -ap "$nome" 2>/dev/null)
  [ -z "$exe" ] && [ -x "$fixo" ] && exe="$fixo"
  if [ -n "$exe" ]; then EDITORES+=("$exe"); ok "$exe"; fi
done
[ ${#EDITORES[@]} -gt 0 ] || falhou "Não achei o VS Code nem o Cursor. Instale o VS Code (https://code.visualstudio.com) e rode de novo." "Couldn't find VS Code or Cursor. Install VS Code (https://code.visualstudio.com) and run this again."

passo "Instalando a extensão" "Installing the extension"
for exe in "${EDITORES[@]}"; do
  if saida=$("$exe" --install-extension "$VSIX" --force 2>&1); then ok "$(basename "$exe")"
  else aviso "$(basename "$exe") não aceitou a extensão:" "$(basename "$exe") didn't accept the extension:"; echo "$saida" | sed 's/^/       /'; fi
done

passo "Copiando os arquivos pra ~/.claude-monitor" "Copying the files to ~/.claude-monitor"
# os mesmos que a extensão copia quando o VS Code abre; aqui já saem de dentro do .vsix (é um zip)
TEMP=$(mktemp -d)
mkdir -p "$PASTA"
# instalação nova começa no tema Padrão; quem já usava (tem versao-janelinha) fica no Minecraft
[ -f "$PASTA/versao-janelinha" ] || [ -f "$PASTA/config.json" ] || printf '{"tema":"padrao"}' > "$PASTA/config.json"
# pastas inteiras: o motor das animações e os sons dos temas
for p in motor sons-padrao sons-dragonball sons-sith sons-akatsuki sons-elden; do
  mkdir -p "$PASTA/$p"
  unzip -o -j -q "$VSIX" "extension/janelinha/$p/*" -d "$PASTA/$p" || falhou "O .vsix está incompleto (falta janelinha/$p/). Baixe de novo." "The .vsix is incomplete (janelinha/$p/ is missing). Download it again."
done
unzip -o -j -q "$VSIX" extension/out/hook.js extension/out/processes.js extension/out/sem-node.sh \
  extension/janelinha/overlay.swift extension/janelinha/minecraft.js extension/janelinha/vorbis.min.js -d "$PASTA" \
  || falhou "O .vsix está incompleto. Baixe de novo." "The .vsix is incomplete. Download it again."
unzip -o -j -q "$VSIX" extension/out/install.js -d "$TEMP" || falhou "O .vsix está incompleto. Baixe de novo." "The .vsix is incomplete. Download it again."
printf '%s' "$VERSAO" > "$PASTA/versao-janelinha"  # a extensão só recopia quando a versão muda
ok "$PASTA"

passo "Ligando o Claude Code na extensão (hooks)" "Connecting Claude Code to the extension (hooks)"
if command -v node >/dev/null 2>&1; then
  if saida=$(node -e 'require(process.argv[1]).installHooks()' "$TEMP/install.js" 2>&1); then
    ok "hooks no ~/.claude/settings.json (cópia do anterior em settings.json.bak-claude-monitor)" "hooks in ~/.claude/settings.json (the previous one is copied to settings.json.bak-claude-monitor)"
  else
    aviso "Não consegui mexer no ~/.claude/settings.json: $saida" "Couldn't change ~/.claude/settings.json: $saida"
    aviso "Depois, no VS Code: Cmd+Shift+P > \"Claude Monitor: Instalar hooks no Claude Code\"." "Later, in VS Code: Cmd+Shift+P > \"Claude Monitor: Instalar hooks no Claude Code\"."
  fi
else
  aviso "Falta o Node.js: o Claude Code usa ele pra avisar quais sessões estão rodando." "Node.js is missing: Claude Code uses it to report which sessions are running."
  if command -v brew >/dev/null 2>&1; then aviso "Instale com:  brew install node   e rode este instalador de novo." "Install it with:  brew install node   and run this installer again."
  else aviso "Instale a versão LTS em https://nodejs.org e rode este instalador de novo." "Install the LTS version from https://nodejs.org and run this installer again."; fi
fi
rm -rf "$TEMP"

passo "Montando a janelinha" "Building the floating window"
if ! xcode-select -p >/dev/null 2>&1; then
  aviso "Faltam as ferramentas de linha de comando da Apple (uma vez só)." "Apple's command line tools are missing (only once)."
  aviso "Vai abrir uma janela: clique em Instalar, espere terminar e rode este instalador de novo." "A window will open: click Install, wait for it to finish and run this installer again."
  xcode-select --install >/dev/null 2>&1
  exit 1
fi
if xcrun swiftc -swift-version 5 -O -o "$PASTA/ClaudeMonitor.novo" "$PASTA/overlay.swift" 2> "$PASTA/compilar.log"; then
  mv "$PASTA/ClaudeMonitor.novo" "$PASTA/ClaudeMonitor"  # troca de uma vez: a aberta se reabre com a nova
  ok "janelinha pronta" "floating window ready"
else
  cat "$PASTA/compilar.log"
  falhou "Não consegui montar a janelinha. Mande o texto acima pra quem te passou o Claude Monitor." "Couldn't build the floating window. Send the text above to whoever gave you Claude Monitor."
fi

passo "Sons do Minecraft (do servidor da Mojang: não precisa ter o jogo)" "Minecraft sounds (from Mojang's server: you don't need the game)"
if command -v node >/dev/null 2>&1; then node "$PASTA/minecraft.js" || true
else aviso "Sem Node.js a janelinha fica com os sons do Mac." "Without Node.js the floating window keeps the Mac sounds."; fi

if [ -z "$SEM_ABRIR" ]; then
  nohup "$PASTA/ClaudeMonitor" >/dev/null 2>&1 &
fi

if [ -n "$EN" ]; then
  printf '\n\033[32mDone! The floating window shows up in the bottom-right corner.\033[0m\n'
  echo "Close and reopen VS Code. Claude sessions that were already open"
  echo "need to be reopened to show up (new ones show up on their own)."
  echo "If your Mac asks whether \"security\" may access \"Claude Code-credentials\","
  echo "click \"Always Allow\": it's only so the floating window can read your usage (5h/7d)."
else
  printf '\n\033[32mPronto! A janelinha aparece no canto de baixo à direita.\033[0m\n'
  echo "Feche e abra o VS Code de novo. Sessões do Claude que já estavam abertas"
  echo "precisam ser reabertas pra aparecer (as novas aparecem sozinhas)."
  echo "Se o Mac perguntar se \"security\" pode acessar \"Claude Code-credentials\","
  echo "clique em \"Permitir Sempre\": é só pra janelinha ler o seu usage (5h/7d)."
  echo "Language: right-click the floating window > \"Idioma\" > English."
fi
