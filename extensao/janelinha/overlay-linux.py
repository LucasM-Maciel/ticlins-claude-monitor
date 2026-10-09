#!/usr/bin/env python3
# Claude Monitor no Linux: a mesma janelinha do Mac (overlay.swift) em Python + GTK 3 (cairo/Pango).
# Sempre por cima, com as sessões do Claude Code (arquivos do hook em ~/.claude-monitor/sessions)
# e o usage (mesmo endpoint do /usage, com o login do Claude Code em ~/.claude/.credentials.json;
# só lê, nunca renova o token). O Clawd, as cenas e os enfeites do cartão vêm do motor das
# animações (motor/motor.js, o mesmo do Windows e do Mac; docs/MOTOR.md), que desenha em software
# e manda os pixels. Sem node, ou com o motor caído, fica só o cartão (o Clawd desenhado aqui, o do
# Mac sem motor, não veio pro Linux); ele tenta de novo em 5 s, 30 s e 2 min.
# Sons: os .wav do tema (paplay); sem eles, os do freedesktop.
# Clique numa sessão: abre ela no VS Code (vscode://local.claude-monitor/...). Arrastar: botão
# esquerdo. Duplo clique: traz o VS Code. Botão direito: Tema, Clawd, Opacidade, Volume e Fechar.
# Saiu versão nova (a extensão consulta o GitHub): linha roxa embaixo; o clique baixa o zip.
# A extensão abre isto (python3 overlay-linux.py); a trava em overlay.lock deixa uma só. Quando
# este arquivo muda (versão nova), ela se reabre sozinha. Diário em janelinha.log (o mesmo dos outros).
# Precisa de python3-gi e gir1.2-gtk-3.0 (vêm no Ubuntu/Fedora com GNOME).
# Teste: overlay-linux.py --foto arquivo.png desenha, salva o PNG (e, ao lado, um .txt com o que
# viu) e sai, sem abrir janela. Sem internet: o usage vem de --uso arquivo.json, se passar.
# --pasta troca a ~/.claude-monitor por outra. --sem-motor: sem o motor, como quando falta o node.
import fcntl
import json
import math
import os
import random
import re
import shutil
import signal
import struct
import subprocess
import sys
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

import gi


def argumento(nome):
    a = sys.argv
    if nome in a:
        i = a.index(nome)
        if i + 1 < len(a):
            return a[i + 1]
    return None


home = os.path.expanduser("~")
arquivo_foto = argumento("--foto")
pasta = argumento("--pasta") or os.path.join(home, ".claude-monitor")
dir_sessoes = os.path.join(pasta, "sessions")
sem_motor = "--sem-motor" in sys.argv
script = os.path.realpath(__file__)

os.makedirs(pasta, exist_ok=True)
signal.signal(signal.SIGPIPE, signal.SIG_IGN)  # escrever no motor que caiu dá erro na escrita, não derruba

# a ponte GTK <-> cairo (python3-gi-cairo). Sem root pra instalar, o instalador baixa o .deb e
# deixa o módulo em ~/.claude-monitor/gi-cairo
try:
    gi.require_foreign("cairo")
except ImportError:
    gi.__path__.append(os.path.join(pasta, "gi-cairo"))
    try:
        gi.require_foreign("cairo")
    except ImportError:
        sys.exit("Claude Monitor: falta o python3-gi-cairo (sudo apt install python3-gi-cairo)")
gi.require_version("Pango", "1.0")
gi.require_version("PangoCairo", "1.0")
import cairo  # noqa: E402
from gi.repository import GLib, Pango, PangoCairo  # noqa: E402

if arquivo_foto is None:
    # no Wayland o GTK não deixa a janela escolher onde fica nem ficar por cima: vai pelo XWayland
    gdk_meu = "GDK_BACKEND" not in os.environ
    os.environ.setdefault("GDK_BACKEND", "x11")
    gi.require_version("Gtk", "3.0")
    gi.require_version("Gdk", "3.0")
    from gi.repository import Gdk, Gtk  # noqa: E402
    # o import já abriu a tela no X11; o xdg-open, o navegador e o VS Code abrem com o ambiente do usuário
    if gdk_meu:
        del os.environ["GDK_BACKEND"]

# --- diário em janelinha.log (o mesmo do Windows, do Mac e da extensão). O --foto conta no stderr.
diario = os.path.join(pasta, "janelinha.log")


def anotar(texto):
    limpo = re.sub(r"\s*[\r\n]+\s*", " ", texto)
    if arquivo_foto is not None:
        sys.stderr.write(limpo + "\n")
        return
    try:
        if os.path.exists(diario) and os.path.getsize(diario) > 256 * 1024:
            os.replace(diario, diario + ".1")
        agora = time.time()
        hora = time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(agora)) + ".%03d" % int((agora % 1) * 1000)
        with open(diario, "a", encoding="utf-8") as f:
            f.write(f"{hora} [{os.getpid()}] {limpo}\n")
    except OSError:
        pass


def sem_cair(fn, normal):
    """Pros timers do GLib: o que dá erro sai do laço pra sempre (a janelinha congelava). Aqui o erro
    vai pro diário (só quando muda, pra não encher) e o timer segue (devolve `normal`)."""
    visto = [None]

    def rodar(*args):
        try:
            return fn(*args)
        except Exception as e:
            texto = f"erro em {fn.__name__}: {type(e).__name__}: {e}"
            if texto != visto[0]:
                visto[0] = texto
                anotar(texto)
            return normal

    return rodar


# --- botão direito: tema, Clawd, opacidade e volume, gravados em config.json (os outros leem o mesmo).
temas = [("padrao", "Padrão"), ("minecraft", "Minecraft"), ("dragonball", "Dragon Ball"), ("sith", "Star Wars")]
arquivo_config = os.path.join(pasta, "config.json")
config = {"opacidade": 1.0, "clawd": True, "volume": 1.0, "tema": "minecraft"}


def ler_json(caminho):
    try:
        with open(caminho, "rb") as f:
            o = json.loads(f.read())
        return o if isinstance(o, dict) else None
    except (OSError, ValueError):
        return None


def numero(v):
    return float(v) if isinstance(v, (int, float)) and not isinstance(v, bool) else None


_o = ler_json(arquivo_config)
if _o:
    if numero(_o.get("opacidade")) is not None:
        config["opacidade"] = min(1.0, max(0.2, numero(_o["opacidade"])))
    if isinstance(_o.get("clawd"), bool):
        config["clawd"] = _o["clawd"]
    if numero(_o.get("volume")) is not None:
        config["volume"] = min(1.0, max(0.0, numero(_o["volume"])))
    if _o.get("tema") in [t for t, _ in temas]:
        config["tema"] = _o["tema"]


def salvar_config():
    # por cima do que já tinha: chave que esta versão não conhece continua lá
    o = ler_json(arquivo_config) or {}
    o.update(config)
    try:
        with open(arquivo_config, "w", encoding="utf-8") as f:
            json.dump(o, f)
    except OSError:
        pass


# --- uma janelinha só (a trava solta sozinha no execv: o Python abre sem herança)
if arquivo_foto is None:
    _trava = open(os.path.join(pasta, "overlay.lock"), "a+")
    try:
        fcntl.flock(_trava, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except OSError:
        sys.exit(0)


def data_do_arquivo(caminho):
    try:
        return os.path.getmtime(caminho)
    except OSError:
        return None


versao = data_do_arquivo(script)


def hex_cor(codigo):
    """'#RRGGBB' ou '#AARRGGBB' -> (r, g, b, a) de 0 a 1."""
    s = codigo[1:] if codigo.startswith("#") else codigo
    a = 1.0
    if len(s) == 8:
        a = int(s[:2], 16) / 255
        s = s[2:]
    try:
        v = int(s, 16)
    except ValueError:
        v = 0
    return ((v >> 16) & 0xFF) / 255, ((v >> 8) & 0xFF) / 255, (v & 0xFF) / 255, a


# situação da sessão -> cor da bolinha e texto do tooltip
estados = {
    "working": ("#22C55E", "trabalhando"),
    "finished": ("#EF4444", "terminou"),
    "question": ("#60A5FA", "pergunta pra você"),
    "permission": ("#FACC15", "pedindo permissão"),
}

# --- sons de cada aviso por tema; com mais de um, sorteia. Sem o arquivo, o do freedesktop.
aviso_da_situacao = {"permission": "esperando", "question": "esperando", "finished": "terminou", "tudo": "tudo"}
sons_do_tema = {
    "minecraft": {"esperando": ["sons/aldeao_hmm1", "sons/aldeao_hmm2"], "terminou": ["sons/xp1", "sons/xp2", "sons/xp3"],
                  "tudo": ["sons/levelup"]},
    "padrao": {"esperando": ["sons-padrao/esperando"], "terminou": ["sons-padrao/terminou"], "tudo": ["sons-padrao/tudo"]},
    "dragonball": {"esperando": ["sons-dragonball/esperando"], "terminou": ["sons-dragonball/terminou"],
                   "tudo": ["sons-dragonball/tudo"]},
    "sith": {"esperando": ["sons-sith/esperando"], "terminou": ["sons-sith/terminou"], "tudo": ["sons-sith/tudo"]},
}
som_do_sistema = {"esperando": "window-question", "terminou": "complete", "tudo": "bell"}
nome_do_som = {  # pro diário e pro .txt do --foto
    "minecraft": {"esperando": "aldeao", "terminou": "xp", "tudo": "levelup"},
    "padrao": {"esperando": "sino-esperando", "terminou": "sino-terminou", "tudo": "sino-tudo"},
    "dragonball": {"esperando": "esferas-esperando", "terminou": "esferas-terminou", "tudo": "esferas-tudo"},
    "sith": {"esperando": "droide-bipes", "terminou": "sabre-liga", "tudo": "acorde-sith"},
}
tocador = shutil.which("paplay") or shutil.which("pw-play")


def abrir_som(arquivo):
    if not tocador:
        return None
    if os.path.basename(tocador) == "paplay":
        # o --volume do paplay é cúbico (65536 = 100%): a raiz cúbica deixa linear como no Mac e no Windows
        args = [tocador, f"--volume={round(65536 * config['volume'] ** (1 / 3))}", arquivo]
    else:  # o do pw-play já é linear
        args = [tocador, f"--volume={config['volume']:.2f}", arquivo]
    try:
        return subprocess.Popen(args, stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    except OSError:
        return None


tocando = None  # o aviso que está tocando (o próximo corta)


def tocar(situacao):
    global tocando
    aviso = aviso_da_situacao.get(situacao)
    if not aviso:
        return
    nome = nome_do_som.get(config["tema"], {}).get(aviso, aviso)
    if config["volume"] <= 0:
        anotar(f"não toquei {nome}: volume no 0 (botão direito > Volume)")
        return
    arquivos = [os.path.join(pasta, f + ".wav") for f in sons_do_tema.get(config["tema"], {}).get(aviso, [])]
    arquivos = [a for a in arquivos if os.path.exists(a)]
    if arquivos:
        arquivo = random.choice(arquivos)
    else:
        arquivo = f"/usr/share/sounds/freedesktop/stereo/{som_do_sistema[aviso]}.oga"
    if tocando and tocando.poll() is None:
        tocando.terminate()
    tocando = abrir_som(arquivo)
    anotar(f"tocou {nome} ({os.path.basename(arquivo)})" if tocando else f"não toquei {nome} ({arquivo}; sem paplay?)")


# o som das cenas épicas: o motor manda pronto (mensagem S, um .wav ou parar). Outro processo,
# pra não cortar nem ser cortado pelos avisos.
som_da_cena = None
som_da_cena_visto = None


def parar_som_da_cena():
    global som_da_cena
    if som_da_cena and som_da_cena.poll() is None:
        som_da_cena.terminate()
    som_da_cena = None


def tocar_som_da_cena(texto):
    global som_da_cena, som_da_cena_visto
    try:
        o = json.loads(texto)
    except ValueError:
        anotar(f"motor: mensagem S com defeito: {texto}")
        return
    if o.get("parar") is True:
        parar_som_da_cena()
        if arquivo_foto is not None:
            som_da_cena_visto = "parou"
        return
    arquivo = o.get("tocar")
    if not isinstance(arquivo, str):
        return
    cena = o.get("cena") or "?"
    som_da_cena_visto = cena
    if arquivo_foto is not None:
        return
    if config["volume"] <= 0:
        anotar(f"não toquei o som de {cena}: volume no 0 (botão direito > Volume)")
        return
    parar_som_da_cena()
    som_da_cena = abrir_som(arquivo)
    anotar(f"tocou o som de {cena}" if som_da_cena else f"não toquei o som de {cena} ({arquivo})")


# --- sessões (mesma regra da extensão e das outras janelinhas) ---
def pid_vivo(pid):
    try:
        os.kill(pid, 0)
        return True
    except PermissionError:
        return True
    except (OSError, OverflowError, ValueError):  # pid que o sistema nem aceita (json com defeito): morto
        return False


def ler_sessoes(agora):
    try:
        arquivos = os.listdir(dir_sessoes)
    except OSError:
        return []
    vistas = {}
    for arquivo in arquivos:
        if not arquivo.endswith(".json"):
            continue
        d = ler_json(os.path.join(dir_sessoes, arquivo))
        if d is None:
            continue
        pid = d.get("pid")
        # NaN e Infinity (o json do Python aceita) não viram int: sem pid, como no Mac
        pid = int(pid) if (isinstance(pid, int) and not isinstance(pid, bool)) or (
            isinstance(pid, float) and pid.is_integer()) else None
        updated = numero(d.get("updated")) or 0
        # pid vivo; sem pid, atualizada nas últimas 6h
        if pid and pid > 0:
            if not pid_vivo(pid):
                continue
        elif agora - updated > 6 * 3600:
            continue
        sid = arquivo[:-5]
        transcript = d.get("transcript") if isinstance(d.get("transcript"), str) else ""
        s = {
            "id": sid, "nome": titulo(transcript) or (d.get("name") if isinstance(d.get("name"), str) else "sessão"),
            "estado": d.get("state") if isinstance(d.get("state"), str) else "waiting",
            "since": numero(d.get("since")) or updated, "updated": updated, "pid": pid, "transcript": transcript,
        }
        chave = f"pid:{pid}" if pid is not None else f"id:{sid}"
        if chave in vistas and vistas[chave]["updated"] >= s["updated"]:
            continue
        vistas[chave] = s
    lista = list(vistas.values())
    for s in lista:
        s["situacao"] = situacao(s)
    return sorted(lista, key=lambda s: s["updated"], reverse=True)


# Título da aba: o do /rename ("custom-title") ganha do automático ("ai-title"). Lê só o pedaço
# novo do transcript.
titulos = {}


def titulo(transcript):
    if not transcript:
        return None
    t = titulos.setdefault(transcript, {"lido": 0, "custom": None, "ai": None})
    try:
        with open(transcript, "rb") as f:
            tamanho = f.seek(0, 2)
            if tamanho < t["lido"]:
                t.update(lido=0, custom=None, ai=None)
            if tamanho > t["lido"]:
                f.seek(t["lido"])
                dados = f.read(tamanho - t["lido"])
                fim = dados.rfind(b"\n")  # não consome linha pela metade
                if fim >= 0:
                    completo = dados[:fim + 1]
                    t["lido"] += len(completo)
                    for linha in completo.split(b"\n"):
                        if b'"type":"ai-title"' not in linha and b'"type":"custom-title"' not in linha:
                            continue
                        try:
                            o = json.loads(linha)
                        except ValueError:
                            continue
                        if o.get("type") == "custom-title" and isinstance(o.get("customTitle"), str) and o["customTitle"]:
                            t["custom"] = o["customTitle"]
                        if o.get("type") == "ai-title" and isinstance(o.get("aiTitle"), str) and o["aiTitle"]:
                            t["ai"] = o["aiTitle"]
    except OSError:
        pass
    return t["custom"] or t["ai"]


# O que a última mensagem da conversa pede: "caixa" (AskUserQuestion aberto), "texto" (resposta
# terminando em pergunta) ou nada. Lê só o fim do transcript, e só quando ele muda de tamanho.
pedidos = {}
_citacao = re.compile(r'"[^"]*"|“[^”]*”|`[^`]*`')


def ultimo_pedido(transcript):
    if not transcript:
        return None
    try:
        with open(transcript, "rb") as f:
            tamanho = f.seek(0, 2)
            c = pedidos.get(transcript)
            if c and c[0] == tamanho:
                return c[1]
            n = min(tamanho, 65536)
            f.seek(tamanho - n)
            linhas = f.read(n).split(b"\n")
    except OSError:
        return None
    if n < tamanho and linhas:
        linhas.pop(0)  # leu do meio: a 1ª pode ter vindo pela metade
    resultado = None
    for linha in reversed(linhas):
        try:
            o = json.loads(linha)
        except ValueError:
            continue
        if not isinstance(o, dict):
            continue
        tipo = o.get("type")
        if tipo not in ("assistant", "user"):
            continue
        if o.get("isSidechain") is True:
            continue
        conteudo = (o.get("message") or {}).get("content") if isinstance(o.get("message"), dict) else None
        if tipo == "assistant" and isinstance(conteudo, list) and conteudo and isinstance(conteudo[-1], dict):
            bloco = conteudo[-1]
            if bloco.get("type") == "tool_use":
                if bloco.get("name") == "AskUserQuestion":
                    resultado = "caixa"
            elif bloco.get("type") == "text" and isinstance(bloco.get("text"), str):
                # "?" entre aspas ou crases é citação, não pergunta pra você
                ultima = _citacao.sub("", bloco["text"].strip().split("\n")[-1])
                if "?" in ultima:
                    resultado = "texto"
        break
    pedidos[transcript] = (tamanho, resultado)
    return resultado


def situacao(s):
    estado = s["estado"]
    # depois de aprovar uma permissão nenhum hook dispara até a sessão parar; se o transcript
    # mexeu depois do pedido, ela voltou a trabalhar (regra da extensão)
    if estado == "permission":
        m = data_do_arquivo(s["transcript"]) if s["transcript"] else None
        if m is not None and m > s["since"] + 2:
            estado = "working"
    pedido = ultimo_pedido(s["transcript"])
    if estado in ("working", "permission"):
        return "question" if pedido == "caixa" else estado
    return "question" if pedido is not None else "finished"


# som quando alguma sessão MUDA de situação pra terminou/pergunta/permissão (uma vez por mudança;
# na abertura não toca). Se vierem juntas, a pergunta ganha do terminou. Terminou a última: "tudo".
ultima_situacao = {}
if arquivo_foto is not None:
    _antes = ler_json(os.path.join(pasta, "antes.json"))
    if _antes:
        ultima_situacao = dict(_antes)
som_da_vez = None


def avisar(sessoes):
    global som_da_vez
    tocar_ = None
    for s in sessoes:
        antes = ultima_situacao.get(s["id"])
        if (antes is not None and antes != s["situacao"] and s["situacao"] in estados and s["situacao"] != "working"
                and tocar_ not in ("permission", "question")):
            tocar_ = s["situacao"]
        ultima_situacao[s["id"]] = s["situacao"]
    if tocar_ == "finished" and all(s["situacao"] == "finished" for s in sessoes):
        tocar_ = "tudo"
    if not tocar_:
        return
    # o tema comemora (no motor) na mesma hora em que o som toca
    if tocar_ in ("finished", "tudo"):
        motor_evento("tudo" if tocar_ == "tudo" else "terminou")
    som_da_vez = tocar_
    if arquivo_foto is None:
        tocar(tocar_)


def tempo(minutos):
    if not math.isfinite(minutos):
        return ""
    m = max(0, int(math.floor(minutos)))
    if m < 1:
        return "agora"
    if m < 60:
        return f"{m}m"
    if m < 1440:
        return f"{m // 60}h" + ("0" if m % 60 < 10 else "") + f"{m % 60}"
    return f"{m // 1440}d{(m % 1440) // 60}h"


# --- usage: o mesmo endpoint do /usage, a cada 2 min ---
uso = None  # [(rotulo, pct, renova_epoch|None)]
proxima_busca = None
buscando = False
uso_guardado = os.path.join(pasta, "ultimo-uso.json")


def falta_pra_renovar(renova):
    return tempo((renova - time.time()) / 60) if renova else ""


def data_iso(texto):
    if not isinstance(texto, str):
        return None
    s = re.sub(r"\.\d+", "", texto).replace("Z", "+00:00")
    try:
        from datetime import datetime
        return datetime.fromisoformat(s).timestamp()
    except ValueError:
        return None


def medida(v):
    if not isinstance(v, dict) or numero(v.get("utilization")) is None:
        return None
    renova = data_iso(v.get("resets_at"))
    if renova is not None and renova <= time.time():
        return (0.0, None)  # o guardado já renovou: zerou
    return (numero(v["utilization"]), renova)


def uso_de(o):
    r = []
    for rotulo, chave in (("5h", "five_hour"), ("7d", "seven_day")):
        m = medida(o.get(chave))
        if m:
            r.append((rotulo, m[0], m[1]))
    return r or None


def token():
    o = ler_json(os.path.join(home, ".claude", ".credentials.json"))
    oauth = (o or {}).get("claudeAiOauth")
    return oauth.get("accessToken") if isinstance(oauth, dict) else None


class SemRedirecionar(urllib.request.HTTPRedirectHandler):
    """Redirecionou: vira erro, em vez de levar o token pra outro endereço."""

    def redirect_request(self, *_):
        return None


abridor = urllib.request.build_opener(SemRedirecionar)


def buscar_uso():
    global uso, proxima_busca, buscando
    if arquivo_foto is not None:  # teste: nada de internet
        f = argumento("--uso")
        if uso is None and f:
            o = ler_json(f)
            if o:
                uso = uso_de(o)
        return
    if proxima_busca is None:
        o = ler_json(uso_guardado)
        if o:
            uso = uso_de(o)
        proxima_busca = 0
    if buscando or time.time() < proxima_busca:
        return
    buscando = True
    proxima_busca = time.time() + 20  # se falhar, tenta de novo logo

    def buscar():
        status, dados = 0, None
        tk = token()
        if tk:
            req = urllib.request.Request("https://api.anthropic.com/api/oauth/usage", headers={
                "Authorization": "Bearer " + tk, "anthropic-beta": "oauth-2025-04-20", "User-Agent": "claude-monitor"})
            try:
                with abridor.open(req, timeout=5) as r:
                    status, dados = r.status, r.read()
            except urllib.error.HTTPError as e:
                status = e.code
            except (OSError, ValueError):
                pass
        GLib.idle_add(chegou, status, dados)

    def chegou(status, dados):
        global uso, proxima_busca, buscando
        buscando = False
        novo = None
        if status == 200 and dados:
            try:
                o = json.loads(dados)
                novo = uso_de(o) if isinstance(o, dict) else None
            except ValueError:
                pass
        if novo:
            uso = novo
            proxima_busca = time.time() + 120
            try:
                with open(uso_guardado, "wb") as f:
                    f.write(dados)
            except OSError:
                pass
        elif status == 429:
            proxima_busca = time.time() + 300  # limite de requisições: espera mais
        return False

    threading.Thread(target=buscar, daemon=True).start()


# --- clique numa sessão: a extensão recebe o link e abre a aba (ou o terminal) dela ---
clique_da_vez = None
zip_url = "https://github.com/LucasM-Maciel/ticlins-claude-monitor/releases/latest/download/ClaudeMonitor.zip"


def abrir_link(url):
    try:
        subprocess.Popen(["xdg-open", url], stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL,
                         stderr=subprocess.DEVNULL, start_new_session=True)
        return True
    except OSError:
        return False


def abrir_sessao(sid):
    global clique_da_vez
    url = "vscode://local.claude-monitor/sessao?id=" + urllib.parse.quote(sid, safe="-._~")
    if arquivo_foto is not None:
        clique_da_vez = url
        return
    if not abrir_link(url):
        trazer_editor()


def versao_nova():
    def ler(nome):
        try:
            with open(os.path.join(pasta, nome), encoding="utf-8") as f:
                return f.read().strip()
        except OSError:
            return None

    publicada, instalada = ler("consulta-versao"), ler("versao-janelinha")
    if not publicada or not instalada:
        return None

    def partes(v):
        return [int(x) if x.isdigit() else 0 for x in re.split(r"[^0-9]+", v) if x != ""]

    return publicada if partes(publicada) > partes(instalada) else None


def clicar(alvo):
    global clique_da_vez
    if alvo.startswith("sessao:"):
        abrir_sessao(alvo[7:])
    elif alvo == "baixar":
        if arquivo_foto is not None:
            clique_da_vez = zip_url
        else:
            abrir_link(zip_url)


def trazer_editor():
    # X11: a janela do VS Code (ou do Cursor), se tiver xdotool
    if not shutil.which("xdotool"):
        return
    for classe in ("code", "cursor"):
        r = subprocess.run(["xdotool", "search", "--onlyvisible", "--class", classe],
                           capture_output=True, text=True)
        ids = r.stdout.split()
        if ids:
            subprocess.run(["xdotool", "windowactivate", ids[-1]], capture_output=True)
            return


# --- desenho ---
# janela fixa (a mesma dos outros: o motor desenha nela inteira); o resto é transparente e o clique passa
L, A = 380, 440
M = 34  # espaço em volta do cartão, por onde o Clawd anda
fonte = Pango.FontDescription.from_string("Sans")
fonte.set_absolute_size(12 * Pango.SCALE)


def escrever(cr, s, cor, r, alinhamento="esq"):
    x, y, w, h = r
    layout = PangoCairo.create_layout(cr)
    layout.set_font_description(fonte)
    layout.set_text(s, -1)
    layout.set_width(int(max(1, w) * Pango.SCALE))
    layout.set_ellipsize(Pango.EllipsizeMode.END)
    layout.set_alignment(Pango.Alignment.RIGHT if alinhamento == "dir" else Pango.Alignment.LEFT)
    _, lh = layout.get_pixel_size()
    cr.save()
    cr.set_source_rgba(*cor)
    cr.move_to(x, y + (h - lh) / 2)
    PangoCairo.show_layout(cr, layout)
    cr.restore()


def retangulo_redondo(cr, x, y, w, h, r):
    r = max(0, min(r, w / 2, h / 2))
    if r == 0:
        cr.rectangle(x, y, w, h)
        return
    cr.new_sub_path()
    cr.arc(x + w - r, y + r, r, -math.pi / 2, 0)
    cr.arc(x + w - r, y + h - r, r, 0, math.pi / 2)
    cr.arc(x + r, y + h - r, r, math.pi / 2, math.pi)
    cr.arc(x + r, y + r, r, math.pi, 3 * math.pi / 2)
    cr.close_path()


# trabalhando: a bolinha verde pulsa (pra quem não distingue verde de vermelho). Volta em 1,6 s.
def opacidade_do_pulso():
    fase = float(argumento("--pulso") or 0) if arquivo_foto is not None else (time.monotonic() % 1.6) / 1.6
    return 0.65 + 0.35 * math.cos(2 * math.pi * fase)


# cor do % do usage em cada tema, pro motor: normal, >= 80%, >= 95%
cores_do_uso = {
    "padrao": ["#D1D5DB", "#F59E0B", "#EF4444"], "minecraft": ["#80FF20", "#FFAA00", "#FF5555"],
    "dragonball": ["#FDE047", "#F59E0B", "#EF4444"], "sith": ["#FCA5A5", "#F59E0B", "#EF4444"],
}


# A cara do cartão: a de sempre ou, com o motor vivo, o layout do tema (mensagem P, docs/MOTOR.md).
def aparencia(o=None):
    a = {"raio": 8.0, "fundo": "#E6181818", "moldura": [0, 0, 0, 0], "padding": [10, 6, 10, 6], "enfeites": False,
         "colTempo": 36.0, "colPct": 38.0, "colFalta": 48.0, "colRotulo": 18.0, "letra": 16.0, "barra": (118.0, 4.0)}
    if not o:
        return a

    def quatro(v):
        if isinstance(v, list):
            r = [numero(x) for x in v]
            if len(r) == 4 and None not in r:
                return r
        return None

    if numero(o.get("raio")) is not None:
        a["raio"] = numero(o["raio"])
    if isinstance(o.get("fundo"), str):
        a["fundo"] = o["fundo"]
    if quatro(o.get("moldura")):
        a["moldura"] = quatro(o["moldura"])
    if quatro(o.get("padding")):
        a["padding"] = quatro(o["padding"])
    if isinstance(o.get("enfeites"), bool):
        a["enfeites"] = o["enfeites"]
    c = o.get("colunas")
    if isinstance(c, dict):
        for k, nome in (("tempo", "colTempo"), ("pct", "colPct"), ("falta", "colFalta"), ("rotulo", "colRotulo")):
            if numero(c.get(k)) is not None:
                a[nome] = numero(c[k])
    if numero(o.get("letra")) is not None:
        a["letra"] = numero(o["letra"])
    b = o.get("barra")
    if isinstance(b, list) and len(b) == 2 and numero(b[0]) is not None and numero(b[1]) is not None:
        a["barra"] = (numero(b[0]), numero(b[1]))
    return a


motor = None          # o processo aberto (vivo, ou ainda sem o 1º quadro)
motor_vivo = False    # já mandou quadro: o Clawd e os enfeites são dele
tentativas_do_motor = 0  # quedas seguidas; 99 = desistiu (sem node, sem motor.js)
enviado_ao_motor = ""
layouts = None
pediu_foto = False


def aparencia_atual():
    if layouts and (motor_vivo or arquivo_foto is not None) and config["tema"] in layouts:
        return layouts[config["tema"]]
    return aparencia()


class Cartao:
    """O cartão: preso no canto de baixo à direita da janela, cresce pra cima."""

    def __init__(self):
        self.linhas = []  # {id, sit, cor, nome, tempo, rotulo}
        self.aviso = None
        self.ap = aparencia()
        self.x0, self.y0, self.largura = 10, 6, 222
        self.altura_linha = self.altura_uso = 20
        self.y_uso = self.y_aviso = 0
        self.frame = (0, 0, 0, 0)  # x, y, w, h na janela

    def arrumar(self):
        ap = self.ap = aparencia_atual()
        self.x0 = ap["moldura"][0] + ap["padding"][0]
        self.y0 = ap["moldura"][1] + ap["padding"][1]
        self.altura_linha = max(16, ap["letra"]) + 4
        self.altura_uso = max(0 if ap["enfeites"] else 16, ap["letra"], ap["barra"][1]) + 4
        self.largura = max(186 + ap["colTempo"], ap["colRotulo"] + ap["barra"][0] + ap["colPct"] + ap["colFalta"])
        self.y_uso = self.y0 + (20 if not self.linhas else len(self.linhas) * self.altura_linha) + 10
        altura_do_uso = len(uso) * self.altura_uso if uso else 20
        self.y_aviso = self.y_uso + altura_do_uso + 10
        w = self.x0 + self.largura + ap["padding"][2] + ap["moldura"][2]
        h = self.y_aviso - 10 + (0 if self.aviso is None else 30) + ap["padding"][3] + ap["moldura"][3]
        self.frame = (L - M - w, A - M - h, w, h)

    def desenhar(self, cr):
        fx, fy, fw, fh = self.frame
        ap = self.ap
        cr.save()
        cr.translate(fx, fy)
        # opacidade do botão direito: o cartão inteiro numa camada só
        camada = config["opacidade"] < 1
        if camada:
            cr.push_group()
        mo = ap["moldura"]
        raio = max(0, ap["raio"] - max(mo))
        cr.set_source_rgba(*_rgba_cairo(ap["fundo"]))
        retangulo_redondo(cr, mo[0], mo[1], fw - mo[0] - mo[2], fh - mo[1] - mo[3], raio)
        cr.fill()
        x0, largura = self.x0, self.largura
        y = self.y0
        if not self.linhas:
            escrever(cr, "nenhuma sessão aberta", hex_cor("#9CA3AF"), (x0, y, largura, 20))
            y += 20
        for l in self.linhas:
            cor = hex_cor(l["cor"])
            if not ap["enfeites"]:  # com enfeites, a bolinha e o tempo são do motor
                alfa = opacidade_do_pulso() if l["sit"] == "working" else 1
                cr.set_source_rgba(cor[0], cor[1], cor[2], cor[3] * alfa)
                cr.arc(x0 + 4, y + self.altura_linha / 2, 4, 0, 2 * math.pi)
                cr.fill()
                escrever(cr, l["tempo"], cor, (x0 + 186, y, ap["colTempo"], self.altura_linha), "dir")
            escrever(cr, l["nome"], hex_cor("#E5E7EB"), (x0 + 16, y, 170, self.altura_linha))
            y += self.altura_linha
        y += 5
        cr.set_source_rgba(*hex_cor("#33FFFFFF"))
        cr.rectangle(x0, y, largura, 1)
        cr.fill()
        y += 5
        if self.aviso:
            cr.set_source_rgba(*hex_cor("#33FFFFFF"))
            cr.rectangle(x0, self.y_aviso - 5, largura, 1)
            cr.fill()
            escrever(cr, f"↑ versão {self.aviso} disponível · baixar", hex_cor("#A78BFA"), (x0, self.y_aviso, largura, 20))
        if not uso:
            escrever(cr, "usage indisponível", hex_cor("#6B7280"), (x0, y, largura, 20))
        elif not ap["enfeites"]:  # com enfeites: rótulo, barra, % e falta o motor desenha
            bw, bh = ap["barra"]
            r = min(2, bh / 2)
            for rotulo, pct, renova in uso:
                c = hex_cor("#EF4444" if pct >= 95 else "#F59E0B" if pct >= 80 else "#D1D5DB")
                escrever(cr, rotulo, hex_cor("#9CA3AF"), (x0, y, ap["colRotulo"], self.altura_uso))
                tx, ty = x0 + ap["colRotulo"], y + (self.altura_uso - bh) / 2
                cr.set_source_rgba(*hex_cor("#3F3F46"))
                retangulo_redondo(cr, tx, ty, bw, bh, r)
                cr.fill()
                cheio = bw * min(max(pct, 0), 100) / 100
                if cheio > 0:
                    cr.set_source_rgba(*c)
                    retangulo_redondo(cr, tx, ty, cheio, bh, r)
                    cr.fill()
                escrever(cr, "%.0f%%" % pct, c, (tx + bw, y, ap["colPct"], self.altura_uso), "dir")
                escrever(cr, falta_pra_renovar(renova), hex_cor("#6B7280"),
                         (tx + bw + ap["colPct"], y, ap["colFalta"], self.altura_uso), "dir")
                y += self.altura_uso
        if camada:
            cr.pop_group_to_source()
            cr.paint_with_alpha(config["opacidade"])
        cr.restore()

    # --- o que o motor precisa saber (docs/MOTOR.md): onde ficou cada coisa, na janela ---
    def na_janela(self, x, y, w, h):
        return [round(v * 100) / 100 for v in (x + self.frame[0], y + self.frame[1], w, h)]

    @staticmethod
    def texto(txt, cor, caixa):
        return {"txt": txt, "cor": cor, "caixa": caixa}

    def caixas_das_linhas(self):
        ap = self.ap
        r = []
        for i, l in enumerate(self.linhas):
            ly = self.y0 + i * self.altura_linha
            r.append({
                "id": l["id"], "sit": l["sit"], "cor": l["cor"],
                "bola": self.na_janela(self.x0, ly + (self.altura_linha - 8) / 2, 8, 8),
                "tempo": self.texto(l["tempo"], l["cor"], self.na_janela(
                    self.x0 + 186, ly + (self.altura_linha - ap["letra"]) / 2, ap["colTempo"], ap["letra"])),
            })
        return r

    def caixas_do_uso(self):
        if not uso:
            return []
        ap = self.ap
        cores = cores_do_uso.get(config["tema"], ["#D1D5DB", "#F59E0B", "#EF4444"])
        r = []
        for j, (rotulo, pct, renova) in enumerate(uso):
            uy = self.y_uso + j * self.altura_uso
            yl = uy + (self.altura_uso - ap["letra"]) / 2
            nivel = 2 if pct >= 95 else 1 if pct >= 80 else 0
            xb = self.x0 + ap["colRotulo"]
            xp = xb + ap["barra"][0]
            xf = xp + ap["colPct"]
            r.append({
                "rotulo": self.texto(rotulo, "#9CA3AF", self.na_janela(self.x0, yl, ap["colRotulo"], ap["letra"])),
                "barra": self.na_janela(xb, uy + (self.altura_uso - ap["barra"][1]) / 2, ap["barra"][0], ap["barra"][1]),
                "pct": pct, "nivel": nivel,
                "pctTxt": self.texto("%.0f%%" % pct, cores[nivel], self.na_janela(xp, yl, ap["colPct"], ap["letra"])),
                "falta": self.texto(falta_pra_renovar(renova), "#6B7280", self.na_janela(xf, yl, ap["colFalta"], ap["letra"])),
            })
        return r

    def alvo_no_ponto(self, px, py):
        """px, py na janela -> 'sessao:<id>', 'baixar' ou None."""
        fx, fy, fw, fh = self.frame
        x, y = px - fx, py - fy
        if not (0 <= x < fw and 0 <= y < fh) or y < self.y0:
            return None
        if self.aviso and self.y_aviso <= y < self.y_aviso + 20:
            return "baixar"
        i = int((y - self.y0) // self.altura_linha)
        return "sessao:" + self.linhas[i]["id"] if i < len(self.linhas) else None

    def dica_no_ponto(self, px, py):
        fx, fy, fw, fh = self.frame
        x, y = px - fx, py - fy
        if not (0 <= x < fw and 0 <= y < fh):
            return None
        if self.aviso and self.y_aviso <= y < self.y_aviso + 20:
            return "Baixa o zip: extraia e siga o COMO ATUALIZAR.txt"
        if y >= self.y0:
            i = int((y - self.y0) // self.altura_linha)
            if i < len(self.linhas):
                return self.linhas[i]["rotulo"]
        return None


def _rgba_cairo(codigo):
    return hex_cor(codigo)


cartao = Cartao()
modo = ""  # o que o Clawd faz: andando | pulando | parado


# --- Motor das animações (motor/motor.js, o mesmo código do Windows e do Mac; docs/MOTOR.md) ---
# Abre o node, manda o estado da janelinha (uma linha JSON por mensagem) e guarda os quadros que
# voltam ("CM" + tipo + 0 + tamanho uint32 LE + dados). Lê numa thread própria; a janela nunca espera.
class Motor:
    def __init__(self):
        self.proc = None
        self.trava = threading.Lock()
        self.buf = None  # bytearray W*H*4, BGRA pré-multiplicado = o ARGB32 do cairo
        self.W = self.H = 0
        self.superficie = None
        self.quadros = 0
        self.pendente = False
        self.vivo = False
        self.pronto = ""
        self.ao_linha = self.ao_pronto = self.ao_primeiro = self.ao_sair = self.ao_som = self.ao_quadro = None
        self.fila = []
        self.fila_cv = threading.Condition()

    def iniciar(self, node, como_node, argumentos):
        env = dict(os.environ)
        if como_node:
            env["ELECTRON_RUN_AS_NODE"] = "1"
        else:
            env.pop("ELECTRON_RUN_AS_NODE", None)
        self.proc = subprocess.Popen([node] + argumentos, stdin=subprocess.PIPE, stdout=subprocess.PIPE,
                                     stderr=subprocess.PIPE, env=env, cwd=pasta, bufsize=0)
        self.vivo = True
        threading.Thread(target=self._ler, daemon=True, name="motor-ler").start()
        threading.Thread(target=self._ler_erros, daemon=True, name="motor-stderr").start()
        threading.Thread(target=self._escrever, daemon=True, name="motor-escrever").start()

    def enviar(self, texto):
        if not self.vivo:
            return
        with self.fila_cv:
            if len(self.fila) >= 64:  # fila cheia = motor travado: descarta em vez de travar a janela
                return
            self.fila.append((texto + "\n").encode())
            self.fila_cv.notify()

    def _escrever(self):
        while True:
            with self.fila_cv:
                while not self.fila and self.vivo:
                    self.fila_cv.wait(1)
                if not self.vivo:
                    return
                dados = self.fila.pop(0)
            try:
                self.proc.stdin.write(dados)
            except (OSError, ValueError):
                return  # o motor saiu: o _ler avisa

    def parar(self):
        if self.proc and self.proc.poll() is None:
            self.proc.terminate()

    def _contar(self, texto):
        GLib.idle_add(lambda: (self.ao_linha and self.ao_linha(texto), False)[1])

    def _ler_tudo(self, f, n):
        partes, falta = [], n
        while falta > 0:
            b = f.read(falta)
            if not b:
                return None
            partes.append(b)
            falta -= len(b)
        return b"".join(partes)

    def _ler(self):
        f = self.proc.stdout
        try:
            while True:
                cab = self._ler_tudo(f, 8)
                if cab is None:
                    break
                if cab[0] != 67 or cab[1] != 77:  # "CM"
                    self._contar("motor: mensagem fora do formato, parei de ler")
                    self.parar()
                    break
                n = struct.unpack_from("<I", cab, 4)[0]
                if n > 64 * 1024 * 1024:
                    self._contar(f"motor: mensagem grande demais ({n})")
                    self.parar()
                    break
                dados = self._ler_tudo(f, n) if n else b""
                if dados is None:
                    break
                tipo = cab[2]
                if tipo == 81:  # Q: um quadro
                    self._quadro(dados)
                elif tipo == 76:  # L: uma linha pro diário
                    self._contar(dados.decode("utf-8", "replace"))
                elif tipo == 80:  # P: pronto, com o layout de cada tema
                    texto = dados.decode("utf-8", "replace")
                    GLib.idle_add(self._chegou_pronto, texto)
                elif tipo == 83:  # S: o som da cena épica
                    texto = dados.decode("utf-8", "replace")
                    GLib.idle_add(lambda t=texto: (self.ao_som and self.ao_som(t), False)[1])
        finally:
            codigo = self.proc.wait()
            GLib.idle_add(self._saiu, codigo)

    def _chegou_pronto(self, texto):
        self.pronto = texto
        if self.ao_pronto:
            self.ao_pronto()
        return False

    def _saiu(self, codigo):
        self.vivo = False
        with self.fila_cv:
            self.fila_cv.notify_all()
        if self.ao_sair:
            self.ao_sair(codigo)
        return False

    def _ler_erros(self):
        for linha in self.proc.stderr:
            t = linha.decode("utf-8", "replace").strip()
            if t:
                self._contar("motor (stderr): " + t)

    # Q: W,H (o tamanho da tela), x,y,w,h (uint16 LE) + w*h*4 bytes do pedaço que mudou
    def _quadro(self, d):
        if len(d) < 12:
            self._contar("motor: quadro com tamanho errado")
            return
        w0, h0, x, y, w, h = struct.unpack_from("<6H", d, 0)
        if w0 == 0 or h0 == 0 or 12 + w * h * 4 > len(d) or x + w > w0 or y + h > h0:
            self._contar("motor: quadro com tamanho errado")
            return
        with self.trava:
            if w0 != self.W or h0 != self.H or self.buf is None:
                self.W, self.H = w0, h0
                self.buf = bytearray(w0 * h0 * 4)
                self.superficie = cairo.ImageSurface.create_for_data(self.buf, cairo.FORMAT_ARGB32, w0, h0, w0 * 4)
            if w > 0 and h > 0:
                linha = w * 4
                larg = self.W * 4
                buf = self.buf
                for r in range(h):
                    de = 12 + r * linha
                    para = (y + r) * larg + x * 4
                    buf[para:para + linha] = d[de:de + linha]
            self.quadros += 1
            primeiro = self.quadros == 1
            postar = not self.pendente
            self.pendente = True
        if postar:
            GLib.idle_add(self._aplicar)
        if primeiro:
            GLib.idle_add(lambda: (self.ao_primeiro and self.ao_primeiro(), False)[1])

    def _aplicar(self):
        with self.trava:
            self.pendente = False
        if self.ao_quadro:
            self.ao_quadro()
        return False

    def desenhar(self, cr):
        with self.trava:
            s = self.superficie
            if s is None or self.W <= 0:
                return
            s.mark_dirty()
            cr.save()
            cr.scale(L / self.W, A / self.H)
            cr.set_source_surface(s, 0, 0)
            cr.get_source().set_filter(cairo.FILTER_NEAREST)  # pixel duro, como nos outros
            cr.paint()
            cr.restore()


# --- janela ---
janela = None
area = None


def redesenhar():
    if area is not None:
        area.queue_draw()


def escala():
    if janela is not None:
        try:
            return float(janela.get_scale_factor())
        except Exception:
            pass
    return 1.0


def desenhar_tudo(cr):
    cr.save()
    cr.set_operator(cairo.OPERATOR_SOURCE)
    cr.set_source_rgba(0, 0, 0, 0)
    cr.paint()
    cr.restore()
    if cartao.frame[2] > 0:
        cartao.desenhar(cr)
    if motor_vivo and motor is not None:
        motor.desenhar(cr)  # por cima de tudo


def aplicar_config():
    redesenhar()
    motor_estado()


def achar_node():
    """O node dos hooks (no PATH); sem ele, o do VS Code que me abriu (Electron como node)."""
    for d in os.environ.get("PATH", "").split(":") + ["/usr/local/bin", "/usr/bin"]:
        c = os.path.join(d, "node")
        if d and os.path.isfile(c) and os.access(c, os.X_OK):
            return c, False
    c = os.environ.get("CLAUDE_MONITOR_NODE")
    if c and os.path.isfile(c) and os.access(c, os.X_OK):
        return c, True
    return None


script_do_motor = os.path.join(os.path.dirname(script), "motor", "motor.js")


def ligar_motor():
    global motor, tentativas_do_motor, enviado_ao_motor
    if sem_motor or motor is not None:
        return False
    achado = achar_node()
    if not achado or not os.path.exists(script_do_motor):
        if tentativas_do_motor == 0:
            anotar(f"motor desligado: {'sem node' if not achado else 'sem motor.js'}; fica só o cartão")
        tentativas_do_motor = 99
        return False
    m = Motor()
    m.ao_linha = anotar
    m.ao_som = lambda t: motor is m and tocar_som_da_cena(t)

    def ao_pronto():
        global layouts
        if motor is not m:
            return
        layouts = None
        try:
            o = json.loads(m.pronto)
            do_tema = o.get("temas")
            if isinstance(do_tema, dict):
                layouts = {nome: aparencia(v) for nome, v in do_tema.items() if isinstance(v, dict)}
        except ValueError:
            anotar("motor: mensagem P com defeito")
        if arquivo_foto is not None:
            atualizar()

    def ao_primeiro():
        global motor_vivo, tentativas_do_motor
        if motor is not m:
            return
        if 0 < tentativas_do_motor < 99:
            anotar("motor voltou")
        motor_vivo = True
        tentativas_do_motor = 0
        aplicar_config()
        atualizar()  # os enfeites do tema passam pro motor

    def ao_sair(codigo):
        global motor, motor_vivo, enviado_ao_motor, tentativas_do_motor, layouts
        if motor is not m:
            return
        if arquivo_foto is not None:
            if not motor_vivo:
                tentativas_do_motor = 99
                layouts = None
                atualizar()
            return
        motor = None
        motor_vivo = False
        parar_som_da_cena()  # a cena morreu junto
        enviado_ao_motor = ""
        tentativas_do_motor += 1
        aplicar_config()
        atualizar()
        espera = [5, 30, 120][min(2, tentativas_do_motor - 1)]
        if tentativas_do_motor <= 5:
            anotar(f"motor saiu ({codigo}); tento de novo em {espera} s")
            GLib.timeout_add_seconds(espera, sem_cair(ligar_motor, False))
        else:
            anotar(f"motor saiu ({codigo}) de novo; desisti até reabrir")

    m.ao_pronto, m.ao_primeiro, m.ao_sair, m.ao_quadro = ao_pronto, ao_primeiro, ao_sair, redesenhar
    args = [script_do_motor, "--pasta", pasta]
    if arquivo_foto is not None:
        partes = (argumento("--cena") or "").split(" ")
        args += ["--foto", partes[1] if len(partes) == 2 else "1", "--semente", "7", "--hora", "12"]
        if len(partes) == 2:
            args += ["--cena", partes[0]]
    try:
        m.iniciar(achado[0], achado[1], args)
    except OSError as e:
        anotar(f"não abri o motor ({achado[0]}): {e}")
        tentativas_do_motor = 99
        return False
    motor = m
    enviado_ao_motor = ""
    motor_estado()
    return False


def motor_estado():
    """O que o motor precisa saber (docs/MOTOR.md); só manda quando mudou."""
    global enviado_ao_motor, pediu_foto
    m = motor
    if m is None or cartao.frame[2] <= 0:
        return
    fw, fh = cartao.frame[2], cartao.frame[3]
    estado = {
        "msg": "estado", "tema": config["tema"], "clawd": config["clawd"], "modo": modo,
        "escala": escala(), "janela": [float(L), float(A)],
        "cartao": cartao.na_janela(0, 0, fw, fh), "raio": float(cartao.ap["raio"]), "opacidade": config["opacidade"],
        "linhas": cartao.caixas_das_linhas(), "uso": cartao.caixas_do_uso(),
    }
    texto = json.dumps(estado, sort_keys=True, ensure_ascii=False, separators=(",", ":"))
    if texto != enviado_ao_motor:
        enviado_ao_motor = texto
        m.enviar(texto)
    # --foto: a foto sai com o cartão já montado pelo layout do tema
    if arquivo_foto is not None and layouts is not None and not pediu_foto:
        pediu_foto = True
        m.enviar('{"msg":"foto"}')


def motor_evento(tipo):
    if motor_vivo and motor is not None:
        motor.enviar(json.dumps({"msg": "evento", "tipo": tipo}))


def se_atualizou():
    """A extensão trocou este arquivo por uma versão nova: vira ela (mesmo processo)."""
    if arquivo_foto is not None or versao is None:
        return
    agora = data_do_arquivo(script)
    if agora is None or agora == versao:
        return
    if motor is not None:
        motor.parar()  # a versão nova abre o motor dela; este não pode ficar órfão
    anotar("janelinha nova: me reabrindo")
    os.execv(sys.executable, [sys.executable, script] + sys.argv[1:])


def ajustar_entrada():
    """Só o cartão pega clique; o resto da janela (onde o Clawd anda) deixa passar."""
    if janela is None or cartao.frame[2] <= 0:
        return
    x, y, w, h = cartao.frame
    rect = cairo.RectangleInt(int(x), int(y), int(math.ceil(w)), int(math.ceil(h)))
    janela.input_shape_combine_region(cairo.Region(rect))


def atualizar():
    global modo
    agora = time.time()
    sessoes = ler_sessoes(agora)
    avisar(sessoes)
    cartao.linhas = []
    for s in sessoes:
        cor, rotulo = estados.get(s["situacao"], ("#9CA3AF", s["situacao"]))
        cartao.linhas.append({"id": s["id"], "sit": s["situacao"], "cor": cor, "nome": s["nome"],
                              "tempo": tempo((agora - s["since"]) / 60), "rotulo": rotulo})
    buscar_uso()
    cartao.aviso = versao_nova()
    cartao.arrumar()
    ajustar_entrada()
    # pedindo algo (pergunta/permissão) ganha de trabalhando, que ganha de parado
    sits = {s["situacao"] for s in sessoes}
    modo = "pulando" if ("question" in sits or "permission" in sits) else "andando" if "working" in sits else "parado"
    redesenhar()
    motor_estado()
    if arquivo_foto is not None:
        # --clicar: o meio da linha daquela sessão (ou do aviso, com "baixar"), pelo mesmo caminho do clique
        alvo = argumento("--clicar")
        if alvo:
            y = None
            if alvo == "baixar":
                y = cartao.y_aviso + 10
            else:
                for i, l in enumerate(cartao.linhas):
                    if l["id"] == alvo:
                        y = cartao.y0 + i * cartao.altura_linha + cartao.altura_linha / 2
                        break
            if y is not None:
                achou = cartao.alvo_no_ponto(cartao.frame[0] + cartao.frame[2] / 2, cartao.frame[1] + y)
                if achou:
                    clicar(achou)
        clawd = modo if config["clawd"] else "desligado"
        aviso = aviso_da_situacao.get(som_da_vez) if som_da_vez else None
        som = nome_do_som.get(config["tema"], {}).get(aviso, "nenhum") if aviso else "nenhum"
        visto = [f"sessao: {s['nome']} | hook={s['estado']} | janelinha={s['situacao']}" for s in sessoes] + [
            f"clawd: {clawd}", f"usage: {'indisponivel' if not uso else 'ok'}", f"som: {som}",
            f"som da cena: {som_da_cena_visto or 'nenhum'}", f"clique: {clique_da_vez or 'nenhum'}",
            f"atualizacao: {cartao.aviso or 'nenhuma'}"]
        with open(arquivo_foto + ".txt", "w", encoding="utf-8") as f:
            f.write("\n".join(visto) + "\n")
    se_atualizou()
    return True


def tique():
    # o pulso da bolinha verde (com enfeites, quem desenha é o motor)
    if not cartao.ap["enfeites"] and any(l["sit"] == "working" for l in cartao.linhas):
        redesenhar()
    return True


def fechar(*_):
    if motor is not None:
        motor.parar()
    parar_som_da_cena()
    if arquivo_foto is None:
        Gtk.main_quit()


# --- menu do botão direito ---
def montar_menu():
    menu = Gtk.Menu()

    sub = Gtk.Menu()
    grupo = None
    for tid, nome in temas:
        item = Gtk.RadioMenuItem.new_with_label_from_widget(grupo, nome)
        grupo = item
        item.set_active(config["tema"] == tid)
        item.connect("toggled", lambda it, t=tid: it.get_active() and trocar("tema", t))
        sub.append(item)
    item = Gtk.MenuItem(label="Tema: " + dict(temas)[config["tema"]])
    item.set_submenu(sub)
    menu.append(item)

    clawd = Gtk.CheckMenuItem(label="Clawd")
    clawd.set_active(config["clawd"])
    clawd.connect("toggled", lambda it: trocar("clawd", it.get_active()))
    menu.append(clawd)

    for chave, rotulo, valores in (("opacidade", "Opacidade", [100, 90, 80, 70, 60, 50, 40, 30, 20]),
                                   ("volume", "Volume", [100, 80, 60, 40, 20, 10, 0])):
        sub = Gtk.Menu()
        grupo = None
        atual = round(config[chave] * 100)
        if atual not in valores:
            valores = sorted(valores + [atual], reverse=True)
        for v in valores:
            it = Gtk.RadioMenuItem.new_with_label_from_widget(grupo, f"{v}%")
            grupo = it
            it.set_active(v == atual)
            it.connect("toggled", lambda i, c=chave, v=v: i.get_active() and trocar(c, v / 100))
            sub.append(it)
        item = Gtk.MenuItem(label=f"{rotulo}: {atual}%")
        item.set_submenu(sub)
        menu.append(item)

    menu.append(Gtk.SeparatorMenuItem())
    sair = Gtk.MenuItem(label="Fechar")
    sair.connect("activate", fechar)
    menu.append(sair)
    menu.show_all()
    return menu


def trocar(chave, valor):
    config[chave] = valor
    salvar_config()
    if chave == "tema":
        anotar(f"tema: {valor}")
        atualizar()
    aplicar_config()


# --- o --foto: desenha sem janela, salva o PNG e sai ---
def rodar_foto():
    laco = GLib.MainLoop()
    tiques = [0]

    def passo():
        tiques[0] += 1
        if tiques[0] < 6:
            return True
        if motor is not None and not motor_vivo and tentativas_do_motor < 99 and tiques[0] < 40:
            motor_estado()
            return True
        try:
            atualizar()
            s = cairo.ImageSurface(cairo.FORMAT_ARGB32, L, A)
            desenhar_tudo(cairo.Context(s))
            s.write_to_png(arquivo_foto)
            print(f"foto: {arquivo_foto}")
            print(f"motor: {'desenhou' if motor_vivo else 'desligado'}")
        finally:
            fechar()
            laco.quit()
        return False

    atualizar()
    ligar_motor()
    GLib.timeout_add(200, sem_cair(passo, True))
    laco.run()


def rodar_janela():
    global janela, area
    janela = Gtk.Window(type=Gtk.WindowType.TOPLEVEL)
    janela.set_title("Claude Monitor")
    janela.set_wmclass("claude-monitor", "Claude Monitor")
    janela.set_decorated(False)
    janela.set_resizable(False)
    janela.set_default_size(L, A)
    janela.set_size_request(L, A)
    janela.set_keep_above(True)
    janela.set_skip_taskbar_hint(True)
    janela.set_skip_pager_hint(True)
    janela.set_accept_focus(False)
    janela.set_focus_on_map(False)
    janela.set_type_hint(Gdk.WindowTypeHint.UTILITY)
    janela.stick()  # em todas as áreas de trabalho
    janela.set_app_paintable(True)
    visual = janela.get_screen().get_rgba_visual()
    if visual is not None:
        janela.set_visual(visual)
    else:
        anotar("sem compositor (sem transparência): a janela fica com fundo preto")

    area = Gtk.DrawingArea()
    area.set_has_tooltip(True)
    area.add_events(Gdk.EventMask.BUTTON_PRESS_MASK | Gdk.EventMask.BUTTON_RELEASE_MASK
                    | Gdk.EventMask.POINTER_MOTION_MASK)
    janela.add(area)

    area.connect("draw", lambda _w, cr: desenhar_tudo(cr) or False)

    def dica(_w, x, y, _teclado, tooltip):
        t = cartao.dica_no_ponto(x, y)
        if t:
            tooltip.set_text(t)
            return True
        return False

    area.connect("query-tooltip", dica)

    # arrasto na mão: andou menos de 3 pixels = clique
    arrasto = {"ativo": False, "mx": 0, "my": 0, "jx": 0, "jy": 0, "alvo": None}

    def apertou(_w, ev):
        if ev.button == 3 and ev.type == Gdk.EventType.BUTTON_PRESS:
            montar_menu().popup_at_pointer(ev)
            return True
        if ev.button != 1:
            return False
        if ev.type == Gdk.EventType._2BUTTON_PRESS:
            arrasto["ativo"] = False
            arrasto["alvo"] = None
            trazer_editor()
            return True
        if ev.type != Gdk.EventType.BUTTON_PRESS:
            return False
        jx, jy = janela.get_position()
        arrasto.update(ativo=True, mx=ev.x_root, my=ev.y_root, jx=jx, jy=jy, alvo=cartao.alvo_no_ponto(ev.x, ev.y))
        return True

    def moveu(_w, ev):
        if arrasto["ativo"]:
            dx, dy = ev.x_root - arrasto["mx"], ev.y_root - arrasto["my"]
            if math.hypot(dx, dy) >= 3:
                janela.move(int(arrasto["jx"] + dx), int(arrasto["jy"] + dy))
        return False

    def soltou(_w, ev):
        if ev.button != 1 or not arrasto["ativo"]:
            return False
        arrasto["ativo"] = False
        if arrasto["alvo"] and math.hypot(ev.x_root - arrasto["mx"], ev.y_root - arrasto["my"]) < 3:
            clicar(arrasto["alvo"])
        arrasto["alvo"] = None
        return True

    area.connect("button-press-event", apertou)
    area.connect("motion-notify-event", moveu)
    area.connect("button-release-event", soltou)
    janela.connect("destroy", fechar)
    # mudou de tela (HiDPI ou não): o motor desenha na escala nova
    janela.connect("notify::scale-factor", lambda *_: motor_estado())

    # nasce no canto de baixo à direita (a margem M já afasta o cartão da borda)
    tela = Gdk.Display.get_default()
    monitor = tela.get_primary_monitor() or tela.get_monitor(0)
    if monitor is not None:
        wa = monitor.get_workarea()
        janela.move(wa.x + wa.width - L, wa.y + wa.height - A)

    for s in (signal.SIGTERM, signal.SIGINT):
        GLib.unix_signal_add(GLib.PRIORITY_DEFAULT, s, lambda *_: (fechar(), False)[1])

    atualizar()
    janela.show_all()
    ajustar_entrada()
    ligar_motor()
    GLib.timeout_add_seconds(2, sem_cair(atualizar, True))
    GLib.timeout_add(33, sem_cair(tique, True))
    Gtk.main()


if __name__ == "__main__":
    if arquivo_foto is not None:
        rodar_foto()
    else:
        rodar_janela()
