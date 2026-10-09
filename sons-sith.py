"""Gera os sons do tema Sith, feitos do zero (nada de filme nem de terceiros) -> extensao/janelinha/sons-sith/:
- esperando.wav  bipes de droide (pergunta / permissão)
- terminou.wav   o sabre acendendo (uma sessão terminou)
- tudo.wav       acorde menor grave de metais (acabou tudo; melodia original)
- o resto é a trilha do épico (sith-epico.js: sons): hiper-abre, nave, salto, frota, blaster, laser,
  rebate, explode, carga, forca, amassa, boom, tunel, chegada
- e a do épico do lado da luz (sith-epico-luz.js), que usa vários desses e mais: floresta, capsula,
  forca-luz, pedra, arremesso, tomba, sol, passaros
Volume dos 3 avisos nivelado com os dos outros temas (pico de cada um em gravar); o dos épicos, no
VOLUME do sith-epico.js e do sith-epico-luz.js. Os sons novos entram sempre no FIM (o sorteio é um só: mudar a ordem muda
os que já existem).
WAV mono 16 bits 44100. Só a biblioteca padrão do Python: python3 sons-sith.py"""
import math
import os
import random
import struct
import wave

SR = 44100
PASTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'extensao', 'janelinha', 'sons-sith')
rnd = random.Random(2026)


def n(d):
    return int(round(d * SR))


def hz(nota):
    return 440.0 * 2 ** ((nota - 69) / 12)


def zeros(d):
    return [0.0] * n(d)


def somar(base, outro, em=0.0, ganho=1.0):
    i0 = n(em)
    if len(base) < i0 + len(outro):
        base.extend([0.0] * (i0 + len(outro) - len(base)))
    for i, v in enumerate(outro):
        base[i0 + i] += v * ganho
    return base


def envelope(x, ataque, solta):
    a, s, total = n(ataque), n(solta), len(x)
    for i in range(total):
        g = 1.0
        if a and i < a:
            g = i / a
        if s and i > total - s:
            g *= max(0.0, (total - i) / s)
        x[i] *= g
    return x


def passa_baixa(x, corte):
    """filtro de 1 polo (o bastante pra arredondar dente de serra e ruído)"""
    k = 1 - math.exp(-2 * math.pi * corte / SR)
    y, s = [], 0.0
    for v in x:
        s += k * (v - s)
        y.append(s)
    return y


def seno(d, f, f1=None):
    """seno de f até f1 (varredura exponencial)"""
    total, fase, out = n(d), 0.0, []
    for i in range(total):
        u = i / max(1, total - 1)
        fi = f if f1 is None else f * (f1 / f) ** u
        fase += 2 * math.pi * fi / SR
        out.append(math.sin(fase))
    return out


def serra(d, f, vibrato=0.0, vel=5.0):
    total, fase, out = n(d), 0.0, []
    for i in range(total):
        fi = f * (1 + vibrato * math.sin(2 * math.pi * vel * i / SR))
        fase = (fase + fi / SR) % 1.0
        out.append(2 * fase - 1)
    return out


def ruido(d):
    return [rnd.uniform(-1, 1) for _ in range(n(d))]


def normalizar(x, pico=0.6):
    m = max(1e-9, max(abs(v) for v in x))
    return [v * pico / m for v in x]


def gravar(nome, x, pico=0.6):
    os.makedirs(PASTA, exist_ok=True)
    x = normalizar(x, pico)
    with wave.open(os.path.join(PASTA, nome + '.wav'), 'wb') as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(SR)
        w.writeframes(b''.join(struct.pack('<h', int(max(-1, min(1, v)) * 32767)) for v in x))
    print(nome + '.wav', f'{len(x) / SR:.2f} s')


def bipes():
    """droide: 5 chilreios curtos subindo e descendo"""
    out = []
    t = 0.0
    for f0, f1, d in [(1800, 2600, 0.07), (2400, 1500, 0.06), (1200, 2200, 0.09), (2800, 2100, 0.05), (1600, 3000, 0.11)]:
        somar(out, envelope(seno(d, f0, f1), 0.005, 0.02), t, 0.8)
        t += d + 0.03
    return out


def sabre_liga(d=0.9):
    """estalo de ruído + zumbido grave (dente de serra filtrado) que sobe e se assenta"""
    out = zeros(d)
    estalo = envelope(passa_baixa(ruido(0.12), 3000), 0.002, 0.1)
    somar(out, estalo, 0, 0.8)
    zum = passa_baixa(serra(d, 92, vibrato=0.012, vel=6), 900)
    sobe = n(0.25)
    for i in range(len(zum)):
        zum[i] *= min(1.0, i / sobe) * (1 - 0.4 * max(0.0, (i - sobe) / (len(zum) - sobe)))
    somar(out, envelope(zum, 0.01, 0.25), 0, 1.0)
    somar(out, envelope(seno(d, 184, 190), 0.02, 0.25), 0, 0.25)
    return out


def metais(d, nota, ganho=1.0):
    """um "metal" grave: 2 dentes de serra quase iguais, filtrados, com ataque lento"""
    f = hz(nota)
    x = [a + b for a, b in zip(serra(d, f, 0.003, 5), serra(d, f * 1.004, 0.003, 4.3))]
    return [v * ganho for v in envelope(passa_baixa(x, 700 + f * 2), 0.06, 0.25)]


def acorde_sombrio():
    """acabou tudo: sol menor subindo (melodia original) e um acorde grave segurando"""
    out = []
    for t, nota, d in [(0.0, 55, 0.28), (0.3, 58, 0.28), (0.6, 62, 0.28), (0.9, 61, 0.22), (1.15, 62, 1.1)]:
        somar(out, metais(d, nota), t, 0.55)
    for nota in (43, 50, 55):  # o grave: sol, ré, sol
        somar(out, metais(1.5, nota, 0.5), 0.9)
    return out


def abre():
    """o painel abrindo: varredura curta subindo"""
    return envelope([a * 0.6 + b * 0.3 for a, b in zip(seno(0.4, 200, 900), passa_baixa(ruido(0.4), 2000))], 0.02, 0.15)


def ronco_da_nave(d=2.4):
    """a nave passando: ronco grave com ruído, crescendo e sumindo"""
    base = passa_baixa(ruido(d), 160)
    tom = passa_baixa(serra(d, 46, 0.02, 0.7), 300)
    x = [a * 2.5 + b * 0.6 for a, b in zip(base, tom)]
    total = len(x)
    for i in range(total):
        x[i] *= math.sin(math.pi * i / total) ** 0.7
    return x


def salto():
    """o salto: zumbido subindo rápido e um baque com estrondo"""
    out = []
    somar(out, envelope(seno(0.45, 80, 1400), 0.05, 0.05), 0, 0.7)
    estrondo = passa_baixa(ruido(0.9), 400)
    for i in range(len(estrondo)):
        estrondo[i] *= math.exp(-4 * i / SR)
    somar(out, estrondo, 0.42, 1.6)
    somar(out, envelope(seno(0.6, 70, 35), 0.005, 0.4), 0.42, 0.9)
    return out


# ---------- a trilha do épico (a batalha da frota) ----------
def inchar(x, ate=1.0):
    """crescendo: o volume sobe do zero até o fim (ate = fração do som em que chega no máximo)"""
    a = max(1, int(len(x) * ate))
    return [v * min(1.0, i / a) for i, v in enumerate(x)]


def frota():
    """a nave-mãe chegando: dois acordes de metais crescendo, ré menor -> si bemol (o ronco é o nave.wav)"""
    out = []
    for nota in (38, 50, 53, 57):
        somar(out, inchar(metais(1.45, nota, 0.4), 0.8), 0)
    for nota in (34, 46, 50, 53):
        somar(out, metais(1.6, nota, 0.42), 1.3)
    return out


def blaster():
    """o tiro dos caças: um "piu" descendo rápido, meio quadrado, com um chiado"""
    d = 0.16
    x = [math.copysign(abs(v) ** 0.5, v) for v in seno(d, 1700, 280)]
    somar(x, passa_baixa(ruido(0.03), 4000), 0, 0.4)
    return envelope(x, 0.002, d * 0.7)


def laser():
    """o canhão da torre da nave: mais grave e mais grosso que o tiro dos caças"""
    d = 0.24
    x = [a * 0.6 + b * 0.5 for a, b in zip(seno(d, 900, 110), passa_baixa(serra(d, 120), 1500))]
    somar(x, passa_baixa(ruido(0.05), 3000), 0, 0.5)
    return envelope(x, 0.002, 0.16)


def rebate():
    """o sabre rebatendo o tiro: estalo, um "tzing" metálico e o zumbido do sabre balançando"""
    out = zeros(0.45)
    somar(out, envelope(passa_baixa(ruido(0.04), 6000), 0.001, 0.035), 0, 0.9)
    for f, g in [(2350, 0.5), (3170, 0.3), (4430, 0.18)]:
        x = seno(0.4, f, f * 0.97)
        somar(out, [v * math.exp(-11 * i / SR) for i, v in enumerate(x)], 0.004, g)
    somar(out, envelope(passa_baixa(serra(0.35, 110, 0.06, 9), 900), 0.01, 0.25), 0, 0.5)
    return out


def estouro(d, corte, grave, ganho_grave):
    """explosão: ruído filtrado que vai morrendo e um baque grave caindo"""
    x = passa_baixa(passa_baixa(ruido(d), corte), corte)
    out = [3 * v * math.exp(-4.5 * i / SR / d) for i, v in enumerate(x)]
    somar(out, envelope(seno(min(d, 0.6), grave, grave * 0.45), 0.003, 0.3), 0, ganho_grave)
    return out


def explode():
    """um caça estourando"""
    return estouro(0.6, 1400, 120, 0.8)


def carga(d=1.4):
    """carregando: um zumbido subindo, com um tremor cada vez mais rápido"""
    total, fase, ft, out = n(d), 0.0, 0.0, []
    for i in range(total):
        u = i / total
        fase += 2 * math.pi * 160 * 7 ** u / SR
        ft += 2 * math.pi * (4 + 22 * u) / SR
        out.append((math.sin(fase) + 0.3 * math.sin(2 * fase)) * (0.75 + 0.25 * math.sin(ft)) * (0.3 + 0.7 * u))
    return envelope(out, 0.05, 0.08)


def forca(d=2.0):
    """a Força segurando: um grave escuro e meio desafinado que cresce, e um ar apertado pulsando"""
    out = zeros(d)
    for f, g in [(55, 1.0), (58.3, 0.6), (82.4, 0.5), (110, 0.25)]:
        somar(out, passa_baixa(serra(d, f, 0.004, 3), 500), 0, g)
    ar = passa_baixa(ruido(d), 900)
    somar(out, [v * (0.5 + 0.5 * math.sin(2 * math.pi * 7 * i / SR)) for i, v in enumerate(ar)], 0, 1.2)
    return envelope(out, 0.35, 0.6)


def amassa():
    """o casco amassando: rangidos metálicos, cada vez mais fortes"""
    out = zeros(0.6)
    for k in range(9):
        t, f = k * 0.06 + 0.01 * rnd.random(), 300 + 500 * rnd.random()
        x = [a * b for a, b in zip(seno(0.08, f, f * 0.6), passa_baixa(ruido(0.08), 2500))]
        somar(out, envelope(x, 0.002, 0.05), t, 1.0 + k * 0.08)
    return out


def boom():
    """o gigante estourando: estrondo longo, o baque bem grave e estalos espalhados"""
    out = estouro(2.4, 500, 70, 1.4)
    for _ in range(14):
        t = 0.05 + 0.9 * rnd.random() ** 1.5
        somar(out, envelope(passa_baixa(ruido(0.03), 5000), 0.001, 0.025), t, 0.5 * (1 - t))
    return out


def tunel(d=1.9):
    """o túnel do hiperespaço: um vento que pulsa, o grave rodando e um brilho agudo"""
    out = [1.6 * v * (0.7 + 0.3 * math.sin(2 * math.pi * 1.7 * i / SR)) for i, v in enumerate(passa_baixa(ruido(d), 700))]
    for f in (660, 990):
        somar(out, [v * (0.5 + 0.5 * math.sin(2 * math.pi * 0.9 * i / SR)) for i, v in enumerate(seno(d, f, f * 1.05))], 0, 0.08)
    somar(out, passa_baixa(serra(d, 55, 0.01, 2), 300), 0, 0.5)
    return envelope(out, 0.15, 0.4)


def chegada():
    """a saída do salto: um baque abafado e o acorde de ré menor da frota, aberto"""
    out = []
    somar(out, envelope(seno(0.5, 160, 50), 0.003, 0.35), 0, 0.9)
    somar(out, envelope(passa_baixa(ruido(0.5), 900), 0.002, 0.4), 0, 1.5)
    for nota in (38, 50, 53, 57):
        somar(out, metais(1.6, nota, 0.45), 0.12)
    return out


# ---------- a trilha do épico da luz (a defesa da floresta) ----------
def filtro_variavel(x, corte):
    """o passa_baixa com o corte mudando ao longo do som (corte: função de u, 0..1)"""
    y, s, total = [], 0.0, len(x)
    for i, v in enumerate(x):
        s += (1 - math.exp(-2 * math.pi * corte(i / total) / SR)) * (v - s)
        y.append(s)
    return y


def piado(f0, f1, d):
    """um piado de passarinho: seno varrendo rápido, com um trinado"""
    return envelope([v * (0.7 + 0.3 * math.sin(2 * math.pi * 38 * i / SR)) for i, v in enumerate(seno(d, f0, f1))], 0.004, d * 0.5)


def floresta(d=2.6):
    """a floresta abrindo: o vento nas folhas crescendo e sumindo, e passarinhos ao longe"""
    vento = passa_baixa(ruido(d), 700)
    total = len(vento)
    out = [1.4 * v * math.sin(math.pi * i / total) ** 0.8 * (0.75 + 0.25 * math.sin(2 * math.pi * 0.7 * i / SR)) for i, v in enumerate(vento)]
    t = 0.25
    for _ in range(6):
        f = 2600 + 1800 * rnd.random()
        for k in range(2 + int(rnd.random() * 2)):
            somar(out, piado(f, f * (1.25 + 0.2 * rnd.random()), 0.05 + 0.03 * rnd.random()), t + k * 0.09, 0.22)
        t += 0.25 + 0.2 * rnd.random()
    return out


def capsula():
    """a cápsula dos droides caindo: um assobio descendo e o baque no chão da floresta (em 0,85 s)"""
    out = []
    queda = [a * 0.5 + b * 0.5 for a, b in zip(seno(0.85, 1900, 380), passa_baixa(ruido(0.85), 2500))]
    somar(out, inchar(envelope(queda, 0.02, 0.05), 0.9), 0, 0.6)
    somar(out, envelope(seno(0.5, 110, 40), 0.003, 0.4), 0.85, 1.0)
    baque = passa_baixa(passa_baixa(ruido(0.6), 600), 600)
    somar(out, [3 * v * math.exp(-7 * i / SR) for i, v in enumerate(baque)], 0.85, 1.2)
    return out


def forca_luz(d=2.0):
    """a Força da luz: uma quinta grave e limpa que cresce, e um brilho agudo cintilando"""
    out = zeros(d)
    for f, g in [(110, 1.0), (165, 0.7), (220, 0.45)]:
        somar(out, passa_baixa(serra(d, f, 0.003, 4), 700), 0, g)
    for f in (880, 1320):
        somar(out, [v * (0.5 + 0.5 * math.sin(2 * math.pi * 6 * i / SR)) for i, v in enumerate(seno(d, f, f * 1.02))], 0, 0.12)
    somar(out, passa_baixa(ruido(d), 1200), 0, 0.5)
    return envelope(out, 0.4, 0.6)


def pedra(d=1.3):
    """a pedra arrancada do chão: um ronco de terra subindo e estalos de raiz e cascalho"""
    ronco = passa_baixa(passa_baixa(ruido(d), 220), 220)
    out = [4 * v * (0.3 + 0.7 * i / len(ronco)) for i, v in enumerate(ronco)]
    for _ in range(16):
        somar(out, envelope(passa_baixa(ruido(0.025), 3500), 0.001, 0.02), d * rnd.random() ** 0.8, 0.35 + 0.4 * rnd.random())
    return envelope(out, 0.08, 0.25)


def arremesso(d=0.55):
    """a pedra arremessada: um zunido de ar que sobe e passa"""
    x = filtro_variavel(ruido(d), lambda u: 300 + 2600 * math.sin(math.pi * min(1.0, u * 1.2)) ** 2)
    total = len(x)
    return [2.5 * v * math.sin(math.pi * i / total) ** 1.5 for i, v in enumerate(x)]


def tomba():
    """o gigante acertado: a pedra batendo no casco, o metal rangendo e o estrondo na floresta (em 0,85 s)"""
    out = zeros(2.2)
    somar(out, envelope(seno(0.4, 140, 55), 0.002, 0.3), 0, 1.0)
    for f, g in [(520, 0.4), (780, 0.25), (1170, 0.15)]:  # o casco ressoando
        somar(out, [v * math.exp(-6 * i / SR) for i, v in enumerate(seno(0.8, f, f * 0.96))], 0, g)
    somar(out, envelope(passa_baixa(serra(0.9, 70, 0.03, 2), 400), 0.1, 0.3), 0.15, 0.5)  # rangendo enquanto cai
    somar(out, estouro(1.3, 700, 80, 1.2), 0.85)
    for _ in range(12):  # os galhos quebrando
        somar(out, envelope(passa_baixa(ruido(0.02), 4500), 0.001, 0.015), 0.85 + 0.6 * rnd.random(), 0.4)
    return out


def sol():
    """o sol saindo: um arpejo maior subindo nos metais (melodia original) e o acorde abrindo"""
    out = []
    for t, nota, d in [(0.0, 67, 0.32), (0.3, 72, 0.32), (0.6, 76, 0.32), (0.9, 74, 0.26), (1.15, 79, 1.5)]:
        somar(out, metais(d, nota), t, 0.45)
    for nota in (48, 55, 60, 64):  # dó maior
        somar(out, inchar(metais(2.2, nota, 0.4), 0.5), 0.6)
    return out


def passaros():
    """os passarinhos voltando: piados em dupla, de lá pra cá"""
    out = zeros(2.0)
    t = 0.0
    for _ in range(7):
        f = 2800 + 1600 * rnd.random()
        for k in range(2):
            somar(out, piado(f * (1 + 0.15 * k), f * (1.35 + 0.15 * k), 0.06), t + k * 0.08, 0.5)
        t += 0.2 + 0.15 * rnd.random()
    return out


if __name__ == '__main__':
    gravar('esperando', bipes(), 0.14)   # pico: os avisos no volume dos outros temas (~-21 LUFS)
    gravar('terminou', sabre_liga(), 0.216)
    gravar('tudo', acorde_sombrio())
    gravar('hiper-abre', abre())
    gravar('nave', ronco_da_nave())
    gravar('salto', salto())
    for nome, f in [('frota', frota), ('blaster', blaster), ('laser', laser), ('rebate', rebate), ('explode', explode),
                    ('carga', carga), ('forca', forca), ('amassa', amassa), ('boom', boom), ('tunel', tunel), ('chegada', chegada)]:
        gravar(nome, f())
    # o épico da luz: depois de todos os outros (o sorteio é um só)
    for nome, f in [('floresta', floresta), ('capsula', capsula), ('forca-luz', forca_luz), ('pedra', pedra),
                    ('arremesso', arremesso), ('tomba', tomba), ('sol', sol), ('passaros', passaros)]:
        gravar(nome, f())
    with open(os.path.join(PASTA, 'LICENCAS.txt'), 'w', encoding='utf-8') as f:
        f.write('Sons do tema Sith: sintetizados do zero pelo sons-sith.py deste projeto (MIT, como o resto).\n'
                'Nenhum som de filme, jogo ou terceiros.\n')
