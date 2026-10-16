#!/bin/sh
# Plano B do hook: sem node no PATH (Node trocado com o VS Code aberto, fnm sem o default no
# PATH, WSL sem node), roda o hook.js no node do VS Code (o Electron, com ELECTRON_RUN_AS_NODE).
# O caminho dele vem no node-reserva, que a extensão grava toda vez que liga. Com node no PATH
# quem roda é o outro hook (node hook.js), e este sai sem fazer nada.
command -v node >/dev/null 2>&1 && exit 0
d=$(dirname "$0")
n=$(cat "$d/node-reserva" 2>/dev/null)
[ -n "$n" ] && [ -x "$n" ] || exit 0
ELECTRON_RUN_AS_NODE=1 exec "$n" "$d/hook.js" "$@"
