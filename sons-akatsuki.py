"""Gera os sons do tema Akatsuki, feitos do zero (nada de anime, jogo nem de terceiros) -> extensao/janelinha/sons-akatsuki/:
- esperando.wav  duas kunais tilintando e duas notas de corda dedilhada (pergunta / permissão)
- terminou.wav   um puf de fumaça e um acorde dedilhado que resolve (uma sessão terminou)
- tudo.wav       uma frase curta de corda dedilhada na escala japonesa, com tambor grave (acabou
                 tudo; melodia original)
- o resto é a trilha dos dois épicos:
  a fera (akatsuki-epico.js): selos, batida, tremor, olho, rugido, rasteja, susto, carrega, disparo,
  explosao
  o trio (akatsuki-epico-time7.js): fumaca, chiado, aura, espada, golpe, brilho, pulo, soco,
  estrelinha (e rasteja, rugido e terminou, que já existem)
Volume dos 3 avisos nivelado com os dos outros temas (o pico de cada um em gravar); o dos épicos, no
VOLUME do akatsuki-epico.js e do akatsuki-epico-time7.js. Os sons novos entram sempre no FIM (o
sorteio é um só: mudar a ordem muda os que já existem).
WAV mono 16 bits 44100. Só a biblioteca padrão do Python: python3 sons-akatsuki.py"""
import math
import os
import random
import struct
import wave

SR = 44100
PASTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'extensao', 'janelinha', 'sons-akatsuki')
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


def decai(x, vel):
    """some exponencial: vel = quantas vezes "e" por segundo"""
    return [v * math.exp(-vel * i / SR) for i, v in enumerate(x)]


def inchar(x, ate=1.0):
    """crescendo: o volume sobe do zero até o fim (ate = fração do som em que chega no máximo)"""
    a = max(1, int(len(x) * ate))
    return [v * min(1.0, i / a) for i, v in enumerate(x)]


def passa_baixa(x, corte):
    """filtro de 1 polo (o bastante pra arredondar dente de serra e ruído)"""
    k = 1 - math.exp(-2 * math.pi * corte / SR)
    y, s = [], 0.0
    for v in x:
        s += k * (v - s)
        y.append(s)
    return y


def passa_alta(x, corte):
    return [a - b for a, b in zip(x, passa_baixa(x, corte))]


def filtro_variavel(x, corte):
    """o passa_baixa com o corte mudando ao longo do som (corte: função de u, 0..1)"""
    y, s, total = [], 0.0, len(x)
    for i, v in enumerate(x):
        s += (1 - math.exp(-2 * math.pi * corte(i / total) / SR)) * (v - s)
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


def saturar(x, forca=2.0):
    return [math.tanh(v * forca) for v in x]


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


# ---------- os instrumentos ----------
def corda(f, d, brilho=0.5, perda=0.996):
    """corda dedilhada (Karplus-Strong): um ruído curto que vira nota ao circular num atraso"""
    N = max(2, int(round(SR / f)))
    buf = passa_baixa([rnd.uniform(-1, 1) for _ in range(N)], 1500 + 9000 * brilho)
    out = []
    for i in range(n(d)):
        j = i % N
        v = buf[j]
        buf[j] = perda * 0.5 * (v + buf[(j + 1) % N])
        out.append(v)
    return envelope(out, 0.001, 0.05)


def tambor(d=0.9, f0=110, f1=48, ganho_pele=1.0):
    """tambor grave: a pele (seno caindo de f0 pra f1) e o tapa (ruído curto)"""
    out = decai(seno(d, f0, f1), 5.5)
    somar(out, decai(passa_baixa(ruido(0.05), 2500), 60), 0, 0.5 * ganho_pele)
    return envelope(out, 0.002, 0.1)


def tilinta(f, d=0.5, ganho=1.0):
    """metal batendo (kunai): parciais desarmônicas que somem rápido"""
    out = zeros(d)
    for mult, g, vel in [(1.0, 1.0, 9), (1.47, 0.6, 12), (2.09, 0.4, 16), (2.83, 0.25, 22)]:
        somar(out, decai(seno(d, f * mult), vel), 0, g * ganho)
    somar(out, decai(passa_alta(ruido(0.012), 3000), 300), 0, 0.4 * ganho)
    return out


def puf(d=0.4, corte=1300):
    """fumaça: um sopro de ruído abafado que abre e some, com um "pff" grave"""
    x = decai(passa_baixa(passa_baixa(ruido(d), corte), corte), 9)
    out = [3.0 * v for v in envelope(x, 0.008, 0.08)]
    somar(out, envelope(decai(seno(min(d, 0.25), 190, 80), 12), 0.004, 0.08), 0, 0.35)
    return out


def estouro(d, corte, grave, ganho_grave):
    """explosão: ruído filtrado que vai morrendo e um baque grave caindo"""
    x = passa_baixa(passa_baixa(ruido(d), corte), corte)
    out = [3 * v * math.exp(-4.5 * i / SR / d) for i, v in enumerate(x)]
    somar(out, envelope(seno(min(d, 0.6), grave, grave * 0.45), 0.003, 0.3), 0, ganho_grave)
    return out


def vento(d, de, ate, ganho=1.0):
    """um sopro com o corte do filtro subindo e descendo (de/ate em Hz)"""
    x = filtro_variavel(ruido(d), lambda u: de + (ate - de) * math.sin(math.pi * u))
    return [v * ganho * 2.5 * math.sin(math.pi * i / len(x)) for i, v in enumerate(x)]


# ---------- os avisos ----------
ESCALA = [62, 63, 67, 69, 70, 74, 75, 79]  # a escala japonesa em ré (ré, mi bemol, sol, lá, si bemol)


def esperando():
    """duas kunais tilintando e duas notas de corda subindo (chama atenção sem assustar)"""
    out = zeros(1.1)
    somar(out, tilinta(3150, 0.45), 0, 0.5)
    somar(out, tilinta(3700, 0.45), 0.12, 0.45)
    somar(out, corda(hz(69), 0.8, 0.7), 0.3, 0.9)
    somar(out, corda(hz(74), 0.7, 0.7), 0.44, 1.0)
    return out


def terminou():
    """um puf e um acorde dedilhado de ré (a frase resolve)"""
    out = zeros(1.4)
    somar(out, puf(0.35), 0, 0.5)
    for k, nota in enumerate((62, 69, 74)):
        somar(out, corda(hz(nota), 1.1, 0.55), 0.12 + k * 0.07, 0.9)
    return out


def tudo():
    """acabou tudo: uma frase original na escala japonesa, o tambor no começo e no fim"""
    out = zeros(3.2)
    somar(out, tambor(0.8), 0, 0.9)
    for t, nota in [(0.05, 62), (0.25, 63), (0.45, 67), (0.65, 69), (0.95, 70), (1.15, 69)]:
        somar(out, corda(hz(nota), 0.9, 0.6), t, 0.8)
    somar(out, tambor(1.2, 90, 40), 1.4, 1.0)
    somar(out, corda(hz(74), 1.8, 0.5, 0.998), 1.42, 1.0)
    somar(out, corda(hz(50), 1.8, 0.3, 0.998), 1.42, 0.7)
    return out


# ---------- a trilha da fera ----------
def selos(d=1.15):
    """as mãos trocando de selo: estalos secos e rápidos de pano e palma"""
    out = zeros(d)
    t = 0.0
    while t < d - 0.08:
        x = decai(passa_baixa(passa_alta(ruido(0.04), 700), 4500), 120)
        somar(out, x, t, 0.6 + 0.4 * rnd.random())
        t += 0.085 + 0.02 * rnd.random()
    return out


def batida():
    """a mão batendo no chão: um baque grave e os riscos vermelhos estalando pela borda"""
    out = zeros(1.0)
    somar(out, envelope(decai(seno(0.6, 150, 42), 6), 0.002, 0.2), 0, 1.0)
    somar(out, decai(passa_baixa(ruido(0.12), 2200), 30), 0, 0.8)
    for _ in range(26):  # os estalos correndo
        t = 0.04 + 0.5 * rnd.random()
        somar(out, decai(passa_alta(ruido(0.006), 2500), 600), t, 0.35 * (1 - t))
    return out


def tremor(d=2.6):
    """o chão tremendo: um ronco bem grave que balança"""
    base = passa_baixa(passa_baixa(ruido(d), 110), 110)
    out = [5.0 * v * (0.75 + 0.25 * math.sin(2 * math.pi * 7 * i / SR)) for i, v in enumerate(base)]
    somar(out, [v * (0.6 + 0.4 * math.sin(2 * math.pi * 3.3 * i / SR)) for i, v in enumerate(seno(d, 38, 33))], 0, 0.5)
    return envelope(out, 0.35, 0.5)


def olho():
    """o olho abrindo: um grave que incha e um anel agudo que fica tinindo"""
    out = zeros(1.4)
    for f, g in [(55, 1.0), (82.5, 0.5), (110, 0.25)]:
        somar(out, envelope(inchar(seno(1.2, f), 0.5), 0.01, 0.6), 0, g)
    for f, g in [(1320, 0.18), (1985, 0.12), (2650, 0.06)]:
        somar(out, envelope(decai(seno(1.2, f, f * 1.01), 3), 0.04, 0.4), 0.15, g)
    return out


def rugido(d=1.7):
    """o rugido: um grave áspero (dente de serra sacudindo) com um sopro rouco por cima"""
    total, fase, out = n(d), 0.0, []
    for i in range(total):
        u = i / total
        f = 62 + 40 * math.sin(math.pi * min(1.0, u * 1.6)) - 18 * u
        f *= 1 + 0.03 * math.sin(2 * math.pi * 5.5 * i / SR)
        fase = (fase + f / SR) % 1.0
        out.append((2 * fase - 1) * (0.7 + 0.3 * math.sin(2 * math.pi * 31 * i / SR)))
    out = passa_baixa(out, 900)
    rouco = passa_baixa(passa_alta(ruido(d), 250), 1400)
    somar(out, [v * (0.6 + 0.4 * math.sin(2 * math.pi * 23 * i / SR)) for i, v in enumerate(rouco)], 0, 1.1)
    return envelope(saturar(out, 2.2), 0.12, 0.6)


def rasteja(d=1.6):
    """o bug andando: patinhas estalando rápido, um farfalhar baixinho"""
    out = [0.15 * v for v in passa_baixa(ruido(d), 600)]
    t = 0.0
    while t < d - 0.02:
        somar(out, decai(passa_alta(ruido(0.008), 1800), 500), t, 0.4 + 0.6 * rnd.random())
        t += 0.028 + 0.035 * rnd.random()
    return envelope(out, 0.05, 0.15)


def susto():
    """o bug se assustando: um "uí?" que sobe, duas vezes"""
    out = zeros(0.5)
    somar(out, envelope(seno(0.12, 500, 1500), 0.005, 0.04), 0, 0.6)
    somar(out, envelope(seno(0.16, 900, 1900), 0.005, 0.06), 0.15, 0.6)
    somar(out, envelope(passa_alta(ruido(0.3), 3000), 0.01, 0.2), 0.1, 0.06)
    return out


def carrega(d=1.6):
    """a esfera escura carregando: um zumbido grave subindo e o ar sendo sugado pra ela"""
    total, fase, ft, out = n(d), 0.0, 0.0, []
    for i in range(total):
        u = i / total
        fase += 2 * math.pi * 55 * 4 ** u / SR
        ft += 2 * math.pi * (5 + 25 * u) / SR
        out.append((math.sin(fase) + 0.5 * math.sin(2 * fase + 0.3) + 0.25 * math.sin(3 * fase)) * (0.7 + 0.3 * math.sin(ft)) * (0.25 + 0.75 * u))
    sugado = filtro_variavel(ruido(d), lambda u: 300 + 3200 * u * u)
    somar(out, inchar(sugado, 0.95), 0, 1.6)
    return envelope(out, 0.08, 0.06)


def disparo():
    """o disparo: um zap grosso caindo, o sopro e o baque"""
    out = zeros(0.6)
    somar(out, envelope(passa_baixa(serra(0.45, 600), 2500), 0.002, 0.3), 0, 0.5)
    somar(out, envelope(seno(0.45, 700, 70), 0.002, 0.3), 0, 0.6)
    somar(out, decai(passa_baixa(ruido(0.4), 3000), 9), 0, 0.9)
    somar(out, envelope(decai(seno(0.4, 90, 40), 7), 0.003, 0.2), 0.02, 0.8)
    return out


def explosao():
    """a explosão: estrondo longo, o baque bem grave, o chiado do clarão e estilhaços"""
    out = estouro(2.6, 650, 65, 1.5)
    somar(out, decai(passa_alta(ruido(0.5), 2500), 8), 0, 0.5)
    for _ in range(16):
        t = 0.05 + 1.1 * rnd.random() ** 1.5
        somar(out, decai(passa_baixa(ruido(0.03), 5000), 90), t, 0.45 * (1.2 - t))
    return saturar(out, 1.3)


# ---------- a trilha do trio ----------
def fumaca():
    """um puf de fumaça (alguém chegando ou indo)"""
    return puf(0.42, 1500)


def chiado():
    """o bug empinando: um chiado de inseto, tremido"""
    x = passa_baixa(passa_alta(ruido(0.65), 2600), 7000)
    x = [v * (0.55 + 0.45 * math.sin(2 * math.pi * 27 * i / SR)) for i, v in enumerate(x)]
    return envelope(x, 0.04, 0.25)


def aura(d=2.1):
    """a aura subindo: um brilho de várias notas que sobe devagar e um vento crescendo"""
    out = zeros(d)
    for f, g in [(220, 0.5), (221.5, 0.5), (330, 0.35), (440, 0.25), (661, 0.12)]:
        somar(out, inchar(seno(d, f, f * 1.25), 0.7), 0, g)
    somar(out, inchar(filtro_variavel(ruido(d), lambda u: 500 + 2200 * u), 0.8), 0, 1.5)
    return envelope(out, 0.25, 0.45)


def espada():
    """o corte da espada gigante: o sopro largo e o metal tinindo na batida"""
    out = vento(0.5, 400, 4500, 1.0)
    somar(out, tilinta(2100, 0.6, 0.8), 0.18)
    somar(out, envelope(decai(seno(0.4, 220, 90), 8), 0.002, 0.2), 0.18, 0.5)
    return out


def golpe():
    """uma pancada pesada"""
    out = envelope(decai(seno(0.4, 130, 48), 9), 0.002, 0.15)
    somar(out, decai(passa_baixa(ruido(0.2), 1800), 28), 0, 1.1)
    return saturar(out, 1.6)


def brilho():
    """a marca acendendo: quatro notas agudas subindo e um brilho no fim"""
    out = zeros(0.9)
    for k, nota in enumerate((86, 87, 91, 93)):
        somar(out, envelope(decai(seno(0.5, hz(nota)), 7), 0.003, 0.1), k * 0.06, 0.5)
    somar(out, envelope(decai(seno(0.6, hz(98), hz(98) * 1.02), 4), 0.01, 0.2), 0.26, 0.35)
    return out


def pulo():
    """o salto: um sopro curto subindo"""
    out = vento(0.35, 600, 3500, 0.8)
    somar(out, envelope(seno(0.3, 260, 820), 0.01, 0.15), 0, 0.25)
    return out


def soco():
    """o soco no chão: o baque enorme, o chão rachando e as pedras caindo"""
    out = envelope(decai(seno(0.9, 95, 30), 3.5), 0.002, 0.3)
    somar(out, decai(passa_alta(ruido(0.15), 1500), 25), 0, 0.7)  # o estalo da racha
    somar(out, estouro(1.3, 900, 70, 0.6), 0.02, 0.8)
    for _ in range(12):  # as pedras
        t = 0.2 + 0.8 * rnd.random()
        somar(out, decai(passa_baixa(ruido(0.025), 3000), 120), t, 0.4 * (1.2 - t))
    return saturar(out, 1.5)


def estrelinha():
    """o bug virando estrelinha lá no céu: "tim!" agudo"""
    out = zeros(0.7)
    for f, g, v in [(2637, 0.6, 6), (3951, 0.35, 8), (5274, 0.15, 11)]:
        somar(out, envelope(decai(seno(0.7, f, f * 1.01), v), 0.003, 0.15), 0, g)
    return out


if __name__ == '__main__':
    gravar('esperando', esperando(), 0.49)   # pico: os avisos no volume dos outros temas (~-21 LUFS)
    gravar('terminou', terminou(), 0.42)
    gravar('tudo', tudo(), 0.71)
    for nome, f in [('selos', selos), ('batida', batida), ('tremor', tremor), ('olho', olho), ('rugido', rugido),
                    ('rasteja', rasteja), ('susto', susto), ('carrega', carrega), ('disparo', disparo), ('explosao', explosao),
                    ('fumaca', fumaca), ('chiado', chiado), ('aura', aura), ('espada', espada), ('golpe', golpe),
                    ('brilho', brilho), ('pulo', pulo), ('soco', soco), ('estrelinha', estrelinha)]:
        gravar(nome, f())
    with open(os.path.join(PASTA, 'LICENCAS.txt'), 'w', encoding='utf-8') as f:
        f.write('Sons do tema Akatsuki: sintetizados do zero pelo sons-akatsuki.py deste projeto (MIT, como o resto).\n'
                'Nenhum som de anime, jogo ou terceiros.\n')
