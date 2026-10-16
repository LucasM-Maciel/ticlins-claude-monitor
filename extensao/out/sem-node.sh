#!/bin/sh
# Plano B do hook: sem node no PATH (Node trocado com o VS Code aberto, fnm sem o default no
# PATH, WSL sem node), roda o hook.js no node do VS Code (o Electron, com ELECTRON_RUN_AS_NODE).
# O caminho dele vem no node-reserva, que a extensão grava toda vez que liga. Com node no PATH
# quem roda é o outro hook (node hook.js), e este sai sem fazer nada.
# Só comandos do próprio sh (sem dirname nem cat): o PATH aqui pode estar faltando pedaço, e no
# Mac o dirname mora em /usr/bin.
command -v node >/dev/null 2>&1 && exit 0
d=${0%/*}
n=
[ -r "$d/node-reserva" ] && read -r n < "$d/node-reserva"
[ -n "$n" ] && [ -x "$n" ] || exit 0
ELECTRON_RUN_AS_NODE=1 exec "$n" "$d/hook.js" "$@"
