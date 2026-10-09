#!/bin/bash
# Testes do Linux (no CI rodam num Ubuntu do GitHub, numa tela de mentira):
#   npm run empacotar && xvfb-run -a bash testes/linux/testes.sh [pasta dos prints]
# Precisa do que a janelinha precisa: sudo apt install python3-gi python3-gi-cairo gir1.2-gtk-3.0
# Testa o dist/ClaudeMonitor.zip (o que o amigo baixa) numa casa de mentira (HOME trocado),
# com "VS Code" e "Cursor" de mentira que só anotam o que receberam. Não mexe na sua
# ~/.claude-monitor, no seu VS Code nem na internet. O irmão dele é o testes/mac/testes.sh.
RAIZ="$(cd "$(dirname "$0")/../.." && pwd)"
SAIDA="${1:-$RAIZ/testes/saida}"
mkdir -p "$SAIDA"
TMP=$(mktemp -d)
FALHAS=0
TOTAL=0

teste() {
  local nome="$1" msg
  shift
  TOTAL=$((TOTAL + 1))
  if msg=$("$@" 2>&1); then
    printf '  \033[32mok\033[0m  %s\n' "$nome"
  else
    FALHAS=$((FALHAS + 1))
    printf '  \033[31mXX\033[0m  %s\n' "$nome"
    printf '%s\n' "$msg" | sed 's/^/      /'
  fi
}
falha() { echo "$*"; return 1; }
# roda com prazo: travou = falha (e mata). Vigia sem processo à parte: um
# "sleep" órfão segurava o $(...) aberto e cada chamada esperava o prazo inteiro
com_prazo() {
  local s=$1 t=0
  shift
  "$@" &
  local p=$!
  while kill -0 "$p" 2>/dev/null; do
    if [ $t -ge $((s * 10)) ]; then kill -9 "$p" 2>/dev/null; break; fi
    sleep 0.1
    t=$((t + 1))
  done
  wait "$p"
}

echo "$(uname -sr) — $(python3 --version 2>&1)"
VERSAO=$(node -p "require('$RAIZ/extensao/package.json').version")
ZIP="$RAIZ/dist/ClaudeMonitor.zip"
[ -f "$ZIP" ] || { echo "Falta o dist/ClaudeMonitor.zip: rode npm run empacotar"; exit 1; }
python3 -c 'import gi; gi.require_foreign("cairo"); gi.require_version("Gtk", "3.0")' 2>/dev/null \
  || { echo "Falta o Python com GTK 3: sudo apt install python3-gi python3-gi-cairo gir1.2-gtk-3.0"; exit 1; }
[ -n "$DISPLAY" ] || { echo "Sem tela (DISPLAY): rode com xvfb-run -a bash testes/linux/testes.sh"; exit 1; }
unzip -q "$ZIP" -d "$TMP/baixado"
PACOTE="$TMP/baixado/ClaudeMonitor"
# o pixels.swift do Mac, em Python: lê o PNG com o cairo da janelinha (sem PIL)
pixels() { python3 -I "$RAIZ/testes/linux/pixels.py" "$@"; }

# casa de mentira com espaço e acento, como "/home/João Silva"
CASA="$TMP/home/João Silva"
BIN="$TMP/bin falso"
mkdir -p "$CASA" "$BIN"
for e in code cursor; do
  printf '#!/bin/bash\necho "$@" >> "%s/%s.log"\n' "$BIN" "$e" > "$BIN/$e"
  chmod +x "$BIN/$e"
done
PATH_TESTE="$BIN:$(dirname "$(command -v node)"):/usr/bin:/bin:/usr/sbin:/sbin"
MONITOR="$CASA/.claude-monitor"
# servidor da Mojang de mentira (testes/mojang-falso.js), no ar até o fim: o instalador baixa dele
node "$RAIZ/testes/mojang-falso.js" > "$TMP/mojang.txt" &
MOJANG_PID=$!
for _ in $(seq 1 100); do [ -s "$TMP/mojang.txt" ] && break; sleep 0.1; done
MOJANG=$(head -1 "$TMP/mojang.txt")
instalar() { env HOME="$CASA" PATH="$PATH_TESTE" CLAUDE_MONITOR_MOJANG="$MOJANG" bash "$PACOTE/instalar-linux.sh" --sem-abrir; }

echo ""
echo "Pacote"
t_sintaxe() {
  local f
  for f in "$RAIZ"/instalar/*.sh "$RAIZ"/testes/linux/*.sh "$PACOTE"/*.sh; do
    bash -n "$f" || falha "erro de sintaxe em $f" || return 1
  done
}
teste "todos os .sh sem erro de sintaxe" t_sintaxe
t_executavel() { [ -x "$PACOTE/instalar-linux.sh" ] || falha "instalar-linux.sh saiu do zip sem permissão de executar"; }
teste "instalar-linux.sh sai do zip executável" t_executavel

echo ""
echo "Instalador"
# os 4 eventos com um hook nosso cada
HOOKS="const h=require(process.argv[1]).hooks; console.log(['UserPromptSubmit','Stop','Notification','SessionEnd'].filter(e=>h[e]&&h[e].length===1).length)"
t_instala() {
  local saida
  saida=$(com_prazo 300 instalar 2>&1) || falha "saiu com erro: $saida" || return 1
  local e
  for e in code cursor; do
    grep -q -- "--install-extension .*claude-monitor-$VERSAO.vsix --force" "$BIN/$e.log" 2>/dev/null \
      || falha "$e recebeu: $(cat "$BIN/$e.log" 2>/dev/null)" || return 1
  done
  local f
  for f in hook.js processes.js overlay-linux.py minecraft.js vorbis.min.js sons-padrao/terminou.wav sons-padrao/esperando.wav sons-padrao/tudo.wav sons-dragonball/tudo.wav sons-sith/terminou.wav sons-sith/esperando.wav sons-sith/tudo.wav motor/motor.js motor/raster.js; do
    [ -f "$MONITOR/$f" ] || falha "falta $f" || return 1
  done
  [ -f "$MONITOR/sons/levelup.wav" ] || falha "não baixou os sons do Minecraft: $saida" || return 1
  [ ! -f "$MONITOR/install.js" ] || falha "install.js sobrou na pasta" || return 1
  [ "$(cat "$MONITOR/versao-janelinha")" = "$VERSAO" ] || falha "versão marcada: $(cat "$MONITOR/versao-janelinha")" || return 1
  # instalação nova começa no tema Padrão (a janelinha lê e grava o tema no mesmo config.json)
  [ "$(cat "$MONITOR/config.json" 2>/dev/null)" = '{"tema":"padrao"}' ] || falha "config.json da instalação nova: $(cat "$MONITOR/config.json" 2>/dev/null)" || return 1
  local n
  n=$(node -e "$HOOKS" "$CASA/.claude/settings.json")
  [ "$n" = 4 ] || falha "hooks: $n de 4" || return 1
  # a mensagem final só sai com o GTK achado (sem ele: "a janelinha espera o GTK")
  echo "$saida" | grep -q "canto de baixo à direita" || falha "não terminou com a mensagem final: $saida"
}
teste "instala: extensão no VS Code e no Cursor, arquivos (com sons-sith/ e overlay-linux.py) e hooks" t_instala
t_de_novo() {
  com_prazo 300 instalar >/dev/null 2>&1 || falha "2ª instalação falhou" || return 1
  local n
  n=$(node -e "$HOOKS" "$CASA/.claude/settings.json")
  [ "$n" = 4 ] || falha "só $n de 4 eventos com um hook só (duplicou): $(cat "$CASA/.claude/settings.json")"
}
teste "rodar o instalador de novo não duplica os hooks" t_de_novo
t_hook() {
  local cmd sh nome
  cmd=$(node -p "require(process.argv[1]).hooks.UserPromptSubmit[0].hooks[0].command" "$CASA/.claude/settings.json")
  # o /bin/sh do Ubuntu é o dash
  for sh in /bin/bash /bin/sh; do
    nome="via-$(basename "$sh")"
    echo "{\"session_id\":\"$nome\",\"cwd\":\"/tmp\"}" | env HOME="$CASA" PATH="$PATH_TESTE" "$sh" -c "$cmd"
    [ -f "$MONITOR/sessions/$nome.json" ] || falha "pelo $sh não gravou a sessão (comando: $cmd)" || return 1
  done
}
teste "o hook instalado funciona pelo bash e pelo sh, com acento no caminho" t_hook
t_sem_editor() {
  local saida r caminho
  caminho="$(dirname "$(command -v node)"):/usr/bin:/bin:/usr/sbin:/sbin"
  saida=$(env HOME="$TMP/outra casa" PATH="$caminho" bash "$PACOTE/instalar-linux.sh" --sem-abrir 2>&1)
  r=$?
  if env PATH="$caminho" bash -c 'type -P code || type -P cursor' >/dev/null 2>&1; then
    echo "(esta máquina tem VS Code/Cursor no PATH: só confiro que não quebrou)"
    return 0
  fi
  [ $r = 1 ] || falha "saiu com $r: $saida" || return 1
  echo "$saida" | grep -q "Não achei o VS Code" || falha "$saida"
}
teste "sem VS Code nem Cursor: explica e sai com erro" t_sem_editor

echo ""
echo "Janelinha (cenários de testes/cenarios.js; prints em $SAIDA)"
# Com node (o CI tem), quem desenha o Clawd, as cenas e os enfeites do tema é o motor
# (motor/motor.js, ao lado do overlay-linux.py); $2 = --sem-motor: o de quando falta o node,
# que no Linux é só o cartão (o Clawd desenhado na janelinha, o do Mac, não veio pro Linux)
t_cenario() {
  local c=$1 sem=${2:-} nome=$1
  [ -n "$sem" ] && nome="$1-sem-motor"
  local pasta="$TMP/cenario $nome ção" foto="$SAIDA/linux-$nome.png" saida
  node "$RAIZ/testes/cenarios.js" "$pasta" "$c" $$ >/dev/null || falha "cenarios.js falhou" || return 1
  rm -f "$foto" "$foto.txt"
  local extra=()
  [ -n "$sem" ] && extra=("$sem")
  [ -f "$pasta/uso.json" ] && extra+=(--uso "$pasta/uso.json")
  [ -f "$pasta/clicar.txt" ] && extra+=(--clicar "$(cat "$pasta/clicar.txt")")
  [ -f "$pasta/cena.txt" ] && extra+=(--cena "$(cat "$pasta/cena.txt")")
  # stderr junto: no --foto o que iria pro diário (o motor reclamando) sai ali
  saida=$(com_prazo 60 env HOME="$CASA" PATH="$PATH_TESTE" python3 "$MONITOR/overlay-linux.py" --foto "$foto" --pasta "$pasta" "${extra[@]}" 2>&1) \
    || falha "a janelinha não terminou direito: $saida" || return 1
  diff "$pasta/esperado.txt" "$foto.txt" || falha "o que a janelinha mostrou é diferente do esperado (acima): $saida" || return 1
  if [ -n "$sem" ]; then
    echo "$saida" | grep -q '^motor: desligado$' || falha "com --sem-motor o motor desenhou: $saida" || return 1
  else
    echo "$saida" | grep -q '^motor: desenhou$' || falha "o motor não desenhou (ficou só o cartão): $saida" || return 1
  fi
  [ ! -f "$pasta/janelinha.log" ] || falha "o --foto anotou no diário: $(cat "$pasta/janelinha.log")" || return 1
  if [ "$c" = preferencias ]; then
    # config.json do botão direito: sem Clawd e o cartão a 50% (fundo 90% x 50% = alfa ~0,45)
    [ "$(pixels "$foto" 215 119 87 30)" -lt 5 ] || falha "o Clawd apareceu desligado" || return 1
    [ "$(pixels "$foto" 24 24 24 10)" -lt 100 ] || falha "o cartão ficou opaco com opacidade 50%" || return 1
    [ "$(pixels "$foto" 0 0 0 255 0.3 0.6)" -gt 5000 ] || falha "cadê o cartão meio transparente? $(pixels "$foto" 0 0 0 255 lista)" || return 1
    return 0
  fi
  # o PNG não saiu vazio: tem o cartão escuro e, com o motor, o Clawd (as mesmas cores do Mac)
  [ "$(pixels "$foto" 24 24 24 10)" -gt 5000 ] || falha "cadê o cartão escuro? perto: $(pixels "$foto" 24 24 24 40 lista)" || return 1
  if [ -z "$sem" ]; then
    [ "$(pixels "$foto" 215 119 87 30)" -gt 30 ] || falha "cadê o Clawd (laranja)? perto: $(pixels "$foto" 215 119 87 80 lista)" || return 1
  fi
}
for c in misto andando parado vazio levelup xp-rodando xp-esperando aldeao clique atualizar preferencias minecraft padrao epico; do
  teste "cenário '$c': mostra exatamente o esperado" t_cenario "$c"
done
# Sem o motor fica só o cartão. As lutas antigas do Mac sem motor (pedra, bug: "andando (pedra)")
# são do Clawd desenhado no overlay.swift, que o Linux não tem: aqui sairia só "andando". As cenas
# do motor têm os testes delas (testes/node/tema-*.test.js)
for c in andando padrao; do
  teste "sem o motor (--sem-motor), cenário '$c': só o cartão, com o mesmo texto" t_cenario "$c" --sem-motor
done

# a janelinha de verdade (GTK, na tela de mentira): uma só, e vira a versão nova quando o arquivo muda
t_uma_so() {
  local pasta="$TMP/uma so"
  mkdir -p "$pasta"
  cp "$MONITOR/overlay-linux.py" "$pasta/overlay-linux.py"
  env HOME="$CASA" PATH="$PATH_TESTE" python3 "$pasta/overlay-linux.py" --pasta "$pasta" >/dev/null 2>&1 &
  local primeira=$!
  sleep 3
  kill -0 $primeira 2>/dev/null || falha "a janelinha não ficou aberta: $(cat "$pasta/janelinha.log" 2>/dev/null)" || return 1
  com_prazo 10 env HOME="$CASA" PATH="$PATH_TESTE" python3 "$pasta/overlay-linux.py" --pasta "$pasta" \
    || falha "a 2ª não desistiu (ficariam duas)" || return 1
  # versão nova = arquivo trocado: a aberta tem que virar a nova (aqui, um script que deixa um sinal)
  printf 'import os\nopen(os.path.join(os.path.dirname(os.path.abspath(__file__)), "reabriu"), "w").close()\n' > "$pasta/novo"
  mv "$pasta/novo" "$pasta/overlay-linux.py"
  for _ in $(seq 1 20); do [ -f "$pasta/reabriu" ] && break; sleep 0.5; done
  kill -9 $primeira 2>/dev/null
  [ -f "$pasta/reabriu" ] || falha "não se reabriu com o arquivo novo: $(cat "$pasta/janelinha.log" 2>/dev/null)" || return 1
  # o diário (janelinha.log, o mesmo dos outros), no formato dele: esta cópia não tem a pasta motor/ ao lado
  grep -Eq "^[0-9]{4}-[0-9]{2}-[0-9]{2} [0-9]{2}:[0-9]{2}:[0-9]{2}\.[0-9]{3} \[$primeira\] motor desligado: sem motor\.js; fica só o cartão$" "$pasta/janelinha.log" \
    || falha "o diário não contou que ficou sem motor: $(cat "$pasta/janelinha.log" 2>/dev/null)" || return 1
  # os timers (2 s e 33 ms) rodaram aberta sem erro (com erro, o sem_cair anota "erro em ...")
  if grep "erro em" "$pasta/janelinha.log"; then falha "a janelinha aberta deu erro (acima)"; return 1; fi
}
teste "uma janelinha só, e ela vira a versão nova quando o arquivo muda" t_uma_so

echo ""
echo "Minecraft (servidor da Mojang de mentira: testes/mojang-falso.js)"
t_mc_baixa() {
  local pasta="$TMP/mc1/.claude-monitor" saida f
  mkdir -p "$pasta"
  printf 'janelinha' > "$pasta/overlay-linux.py"
  touch -t 202001010000 "$pasta/overlay-linux.py" "$TMP/2020"
  saida=$(env HOME="$TMP/mc1" PATH="$PATH_TESTE" CLAUDE_MONITOR_MOJANG="$MOJANG" node "$MONITOR/minecraft.js" 2>&1) || falha "saiu com erro: $saida" || return 1
  for f in xp1 xp2 xp3 levelup aldeao_hmm1 aldeao_hmm2 gato; do [ -f "$pasta/sons/$f.wav" ] || falha "falta $f.wav: $saida" || return 1; done
  for f in picareta espada diamante pedra; do [ -f "$pasta/$f.png" ] || falha "falta $f.png: $saida" || return 1; done
  [ "$pasta/overlay-linux.py" -nt "$TMP/2020" ] || falha "não cutucou a janelinha pra recarregar" || return 1
  echo "$saida" | grep -q "Pronto!" || falha "$saida"
}
teste "baixa os sons e as texturas, sem Minecraft nem ffmpeg, e recarrega a janelinha" t_mc_baixa
t_mc_sem_internet() {
  local saida
  mkdir -p "$TMP/mc2"
  if saida=$(env HOME="$TMP/mc2" CLAUDE_MONITOR_MOJANG="http://127.0.0.1:9" node "$MONITOR/minecraft.js" 2>&1); then
    falha "devia sair com erro: $saida"
    return 1
  fi
  echo "$saida" | grep -q 'Ctrl+Shift+P > "Claude Monitor: Usar sons do Minecraft"' || falha "$saida" || return 1
  [ ! -d "$TMP/mc2/.claude-monitor/sons" ] || falha "criou a pasta de sons sem ter som"
}
teste "sem internet: explica como tentar de novo, não quebra e não cria nada" t_mc_sem_internet

kill "$MOJANG_PID" 2>/dev/null
rm -rf "$TMP"
echo ""
if [ $FALHAS -gt 0 ]; then printf '\033[31m%d de %d testes FALHARAM\033[0m\n' $FALHAS $TOTAL; exit 1; fi
printf '\033[32m%d testes ok\033[0m\n' $TOTAL
