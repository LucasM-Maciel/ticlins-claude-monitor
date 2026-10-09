#!/bin/bash
# Instala o Claude Monitor no Linux: a extensão no VS Code/Cursor, os hooks no Claude Code,
# a janelinha (Python + GTK 3, sem compilar nada) e os sons e a picareta do Minecraft.
# Rodar de novo não estraga: reinstala por cima. Não precisa de root: se faltar a ponte
# GTK <-> cairo (python3-gi-cairo), baixa o .deb e usa de dentro da ~/.claude-monitor.
# Uso: abra o terminal na pasta extraída e rode  bash instalar-linux.sh
# Testes: --sem-abrir (não abre a janelinha no final).
SEM_ABRIR=""
[ "${1:-}" = "--sem-abrir" ] && SEM_ABRIR=1

passo() { printf '\n\033[36m== %s\033[0m\n' "$1"; }
ok() { printf '   \033[32mOK\033[0m  %s\n' "$1"; }
aviso() { printf '   \033[33m!!\033[0m  %s\n' "$1"; }
falhou() { printf '\n   \033[31mXX\033[0m  %s\n\n' "$1"; exit 1; }

AQUI="$(cd "$(dirname "$0")" && pwd)"
PASTA="$HOME/.claude-monitor"
VSIX=$(ls "$AQUI"/arquivos/claude-monitor-*.vsix 2>/dev/null | tail -1)
[ -n "$VSIX" ] || falhou "Não achei o arquivos/claude-monitor-*.vsix do lado deste instalador. Extraia o .zip inteiro antes."
VERSAO=$(basename "$VSIX" .vsix | sed 's/^claude-monitor-//')
printf '\033[36mClaude Monitor %s\033[0m\n' "$VERSAO"
command -v unzip >/dev/null 2>&1 || falhou "Falta o unzip (sudo apt install unzip) e rode de novo."

passo "Procurando o VS Code / Cursor"
EDITORES=()
for nome in code cursor; do
  exe=""
  while IFS= read -r c; do
    # o Cursor pode pôr um "code" dele no PATH: esse não é o VS Code
    if [ "$nome" = code ]; then case "$c $(readlink -f "$c" 2>/dev/null)" in *[Cc]ursor*) continue ;; esac; fi
    exe="$c"
    break
  done < <(type -ap "$nome" 2>/dev/null)
  if [ -n "$exe" ]; then EDITORES+=("$exe"); ok "$exe"; fi
done
[ ${#EDITORES[@]} -gt 0 ] || falhou "Não achei o VS Code nem o Cursor. Instale o VS Code (https://code.visualstudio.com) e rode de novo."

passo "Instalando a extensão"
for exe in "${EDITORES[@]}"; do
  if saida=$("$exe" --install-extension "$VSIX" --force 2>&1); then ok "$(basename "$exe")"
  else aviso "$(basename "$exe") não aceitou a extensão:"; echo "$saida" | sed 's/^/       /'; fi
done

passo "Copiando os arquivos pra ~/.claude-monitor"
# os mesmos que a extensão copia quando o VS Code abre; aqui já saem de dentro do .vsix (é um zip)
TEMP=$(mktemp -d)
mkdir -p "$PASTA"
# instalação nova começa no tema Padrão; quem já usava (tem versao-janelinha) fica no que tinha
[ -f "$PASTA/versao-janelinha" ] || [ -f "$PASTA/config.json" ] || printf '{"tema":"padrao"}' > "$PASTA/config.json"
for p in motor sons-padrao sons-dragonball sons-sith; do
  mkdir -p "$PASTA/$p"
  unzip -o -j -q "$VSIX" "extension/janelinha/$p/*" -d "$PASTA/$p" || falhou "O .vsix está incompleto (falta janelinha/$p/). Baixe de novo."
done
unzip -o -j -q "$VSIX" extension/out/hook.js extension/out/processes.js \
  extension/janelinha/overlay-linux.py extension/janelinha/minecraft.js extension/janelinha/vorbis.min.js -d "$PASTA" \
  || falhou "O .vsix está incompleto. Baixe de novo."
unzip -o -j -q "$VSIX" extension/out/install.js -d "$TEMP" || falhou "O .vsix está incompleto. Baixe de novo."
printf '%s' "$VERSAO" > "$PASTA/versao-janelinha"  # a extensão só recopia quando a versão muda
ok "$PASTA"

passo "Ligando o Claude Code na extensão (hooks)"
if command -v node >/dev/null 2>&1; then
  if saida=$(node -e 'require(process.argv[1]).installHooks()' "$TEMP/install.js" 2>&1); then
    ok "hooks no ~/.claude/settings.json (cópia do anterior em settings.json.bak-claude-monitor)"
  else
    aviso "Não consegui mexer no ~/.claude/settings.json: $saida"
    aviso "Depois, no VS Code: Ctrl+Shift+P > \"Claude Monitor: Instalar hooks no Claude Code\"."
  fi
else
  aviso "Falta o Node.js: o Claude Code usa ele pra avisar quais sessões estão rodando."
  aviso "Instale a versão LTS (https://nodejs.org ou o gerenciador da sua distro) e rode este instalador de novo."
fi
rm -rf "$TEMP"

passo "Conferindo a janelinha (Python + GTK 3)"
GTK='import gi; gi.require_version("Gtk", "3.0"); from gi.repository import Gtk'
PONTE="import gi, sys; gi.__path__.append(sys.argv[1]); gi.require_foreign('cairo')"
JANELINHA=1
if ! python3 -c "$GTK" >/dev/null 2>&1; then
  aviso "Falta o Python com GTK 3. Instale com:  sudo apt install python3-gi python3-gi-cairo gir1.2-gtk-3.0"
  aviso "(Fedora: sudo dnf install python3-gobject gtk3) e rode este instalador de novo."
  JANELINHA=""
elif python3 -c "$PONTE" "$PASTA/gi-cairo" >/dev/null 2>&1; then
  ok "GTK 3 e cairo"
else
  # sem root: baixa o python3-gi-cairo e usa o módulo de dentro da ~/.claude-monitor
  if command -v apt-get >/dev/null 2>&1 && command -v dpkg-deb >/dev/null 2>&1; then
    DEB=$(mktemp -d)
    if (cd "$DEB" && apt-get download python3-gi-cairo >/dev/null 2>&1) && dpkg-deb -x "$DEB"/python3-gi-cairo_*.deb "$DEB/x" 2>/dev/null; then
      mkdir -p "$PASTA/gi-cairo"
      cp "$DEB"/x/usr/lib/python3/dist-packages/gi/_gi_cairo*.so "$PASTA/gi-cairo/" 2>/dev/null
    fi
    rm -rf "$DEB"
  fi
  if python3 -c "$PONTE" "$PASTA/gi-cairo" >/dev/null 2>&1; then
    ok "GTK 3 e cairo (ponte baixada pra ~/.claude-monitor/gi-cairo)"
  else
    aviso "Falta o python3-gi-cairo. Instale com:  sudo apt install python3-gi-cairo   e rode de novo."
    JANELINHA=""
  fi
fi

passo "Sons do Minecraft (do servidor da Mojang: não precisa ter o jogo)"
if command -v node >/dev/null 2>&1; then node "$PASTA/minecraft.js" || true
else aviso "Sem Node.js a janelinha fica com os sons do sistema."; fi

if [ -z "$SEM_ABRIR" ] && [ -n "$JANELINHA" ]; then
  nohup python3 "$PASTA/overlay-linux.py" >/dev/null 2>&1 &
fi

if [ -n "$JANELINHA" ]; then
  printf '\n\033[32mPronto! A janelinha aparece no canto de baixo à direita.\033[0m\n'
else
  printf '\n\033[33mA extensão e os hooks estão instalados; a janelinha espera o GTK (acima).\033[0m\n'
fi
echo "Feche e abra o VS Code de novo. Sessões do Claude que já estavam abertas"
echo "precisam ser reabertas pra aparecer (as novas aparecem sozinhas)."
