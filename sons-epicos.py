"""Gera os sons dos eventos épicos, feitos do zero (nada de terceiros):
- Padrão (8-bit): Space Invaders (epico-*.wav) e Bug Kaiju (kaiju-*.wav) -> sons-padrao/
- Dragon Ball: o dragão das 7 esferas (shenlong-*.wav) -> sons-dragonball/
Cada um é uma peça curta; quem diz quando cada peça toca é a cena (sons: [...]) e o motor
junta tudo num .wav só quando ela começa (motor/som.js). O Ender Dragon usa os sons do
próprio Minecraft, baixados da Mojang na instalação (minecraft.js).
WAV mono 16 bits 44100. Uso: python sons-epicos.py  (precisa de numpy e scipy)"""
import os
import numpy as np
from scipy.io import wavfile
from scipy.signal import butter, sosfilt

SR = 44100
RAIZ = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'extensao', 'janelinha')
rng = np.random.default_rng(2026)


def N(d):
    return int(round(d * SR))


def hz(nota):
    return 440.0 * 2 ** ((nota - 69) / 12)


def tempo(d):
    return np.arange(N(d)) / SR


def varre(d, f0, f1, curva='exp'):
    """frequência de f0 a f1 em d s (por amostra)"""
    u = np.linspace(0, 1, N(d), endpoint=False)
    return f0 * (f1 / f0) ** u if curva == 'exp' else f0 + (f1 - f0) * u


def quadrada(freq, duty=0.5):
    fase = np.cumsum(freq) / SR % 1.0
    return np.where(fase < duty, 1.0, -1.0)


def triangulo(freq):
    fase = np.cumsum(freq) / SR % 1.0
    return 4 * np.abs(fase - 0.5) - 1


def seno(freq):
    return np.sin(2 * np.pi * np.cumsum(freq) / SR)


def constante(d, f):
    return np.full(N(d), float(f))


def ruido(d, taxa=8000):
    """ruído de console: um valor ±1 sorteado a cada 1/taxa s"""
    n, k = N(d), max(1, int(SR / taxa))
    return np.repeat(rng.choice([-1.0, 1.0], n // k + 1), k)[:n]


def env(n, ataque=0.003, queda=None, solta=0.02):
    """envelope: sobe em `ataque` s, cai exponencial (queda = s até 1/e) e some nos últimos `solta` s"""
    t = np.arange(n) / SR
    e = np.minimum(1, t / max(ataque, 1e-6))
    if queda:
        e *= np.exp(-t / queda)
    k = min(n, N(solta))
    if k:
        e[-k:] *= np.linspace(1, 0, k)
    return e


def filtro(x, fc, tipo='low', ordem=2):
    return sosfilt(butter(ordem, np.array(fc) / (SR / 2), tipo, output='sos'), x)


def juntar(d, *partes):
    out = np.zeros(N(d))
    for t0, s, g in partes:
        i = N(t0)
        j = min(len(out), i + len(s))
        out[i:j] += g * s[:j - i]
    return out


def nota(n, d, duty=0.5, queda=0.15, onda=quadrada):
    s = onda(constante(d, hz(n))) if onda is not quadrada else quadrada(constante(d, hz(n)), duty)
    return s * env(len(s), 0.002, queda, 0.01)


def eco(x, atraso=0.11, volta=0.35, vezes=4):
    out = np.concatenate([x, np.zeros(N(atraso * vezes))])
    for k in range(1, vezes + 1):
        i = N(atraso * k)
        out[i:i + len(x)] += x * volta ** k
    return out


# ============================== Padrão: Space Invaders ==============================
def invaders():
    s = {}
    d = 0.6
    sobe = quadrada(np.concatenate([varre(0.45, 60, 900), constante(d - 0.45, 900)]))
    s['epico-liga'] = filtro(sobe * env(len(sobe), 0.005, 0.25, 0.05) * 0.8 + ruido(d, 12000) * env(len(sobe), 0.002, 0.12) * 0.25, 7000)
    d = 0.55
    desce = quadrada(np.concatenate([varre(0.42, 900, 50), constante(d - 0.42, 50)]))
    s['epico-desliga'] = filtro(desce * env(len(desce), 0.002, 0.3, 0.03) + juntar(d, (0.42, seno(constante(0.06, 70)) * env(N(0.06), 0.001, 0.02), 1.2)), 6000)
    s['epico-cai'] = filtro(quadrada(varre(0.32, 1500, 450, 'lin'), 0.25) * env(N(0.32), 0.002, None, 0.04) * 0.55, 6000)
    s['epico-encaixa'] = filtro(ruido(0.15, 3000) * env(N(0.15), 0.001, 0.025), 1500) + quadrada(constante(0.15, 120)) * env(N(0.15), 0.001, 0.04) * 0.6
    s['epico-surge'] = quadrada(varre(0.07, 880, 1320)) * env(N(0.07), 0.001, 0.03, 0.01) * 0.45
    for i, n in enumerate([43, 41, 39, 38]):  # sol, fá, mi bemol, ré: os 4 passos da marcha
        s[f'epico-marcha{i + 1}'] = filtro(quadrada(constante(0.11, hz(n))) * env(N(0.11), 0.002, 0.045, 0.01), 1200)
    s['epico-tiro'] = filtro(quadrada(varre(0.16, 1800, 300), 0.25) * env(N(0.16), 0.001, 0.07, 0.01) * 0.6, 7000)
    s['epico-explode'] = filtro(ruido(0.34, 6000) * env(N(0.34), 0.001, 0.08), 3200)
    s['epico-escudo'] = filtro(ruido(0.06, 14000) * env(N(0.06), 0.001, 0.015), 6000) * 0.6
    t = tempo(3.6)
    s['epico-nave'] = filtro(quadrada(720 + 220 * np.sin(2 * np.pi * 7 * t)) * env(len(t), 0.1, None, 0.2) * 0.32, 5000)
    d = 0.75
    s['epico-nave-explode'] = filtro(ruido(d, 5000) * env(N(d), 0.001, 0.2) + quadrada(varre(d, 600, 70)) * env(N(d), 0.001, 0.15) * 0.5, 4000)
    s['epico-pontos'] = juntar(0.4, (0, nota(88, 0.09, queda=0.05), 0.4), (0.09, nota(93, 0.3, queda=0.09), 0.4))
    # ✓ CLEAR: arpejo dó-mi-sol-dó e o acorde segurando, com o baixo
    clear = juntar(1.6, *[(0.09 * i, nota(n, 0.1, 0.25, 0.06), 0.35) for i, n in enumerate([72, 76, 79, 84])])
    acorde = sum(quadrada(constante(1.2, hz(n)) * (1 + 0.006 * np.sin(2 * np.pi * 6 * tempo(1.2))), 0.25) for n in (84, 88, 91)) / 3
    clear += juntar(1.6, (0.36, acorde * env(N(1.2), 0.005, 0.5, 0.1), 0.4), (0.36, triangulo(constante(1.2, hz(48))) * env(N(1.2), 0.005, 0.6, 0.1), 0.6))
    s['epico-clear'] = filtro(clear, 7000)
    return s


# ============================== Padrão: Bug Kaiju ==============================
def kaiju():
    s = {}
    d = 0.55
    s['kaiju-passo'] = filtro(triangulo(varre(d, 62, 34)) * env(N(d), 0.002, 0.16) + ruido(d, 2000) * env(N(d), 0.001, 0.05) * 0.5, 600)
    d = 0.35
    s['kaiju-tranco'] = filtro(ruido(d, 4000) * env(N(d), 0.001, 0.06), 2200) * 0.7 + triangulo(constante(d, 70)) * env(N(d), 0.002, 0.1) * 0.7
    d = 0.6
    s['kaiju-olhos'] = (quadrada(constante(d, hz(95)), 0.25) + quadrada(constante(d, hz(95) * 1.012), 0.25)) / 2 * env(N(d), 0.003, 0.18, 0.03) * 0.35
    # o rugido: a voz quadrada descendo, áspera (vibrato rápido), com o chiado por cima
    d = 1.5
    t = tempo(d)
    voz = quadrada(varre(d, 120, 62) + 18 * np.sin(2 * np.pi * 27 * t), 0.4)
    chiado = filtro(ruido(d, 9000), [400, 2600], 'band') * (1 - 0.5 * t / d)
    s['kaiju-ruge'] = filtro((voz * 0.7 + chiado * 0.8) * env(len(t), 0.06, None, 0.45), 4500)
    d = 0.7
    t = tempo(d)
    s['kaiju-carga'] = filtro(quadrada(varre(d, 150, 1800)) * (0.6 + 0.4 * np.sin(2 * np.pi * 30 * t)) * np.minimum(1, t / d * 1.3) * env(len(t), 0.01, None, 0.03) * 0.45, 6000)
    d = 1.2
    t = tempo(d)
    raio = quadrada(constante(d, 160) + 25 * np.sin(2 * np.pi * 11 * t)) + quadrada(constante(d, 163)) + ruido(d, 7000) * 0.4
    s['kaiju-raio'] = filtro(raio / 2.4 * env(len(t), 0.02, None, 0.2), 3500)
    d = 1.1
    t = tempo(d)
    pedras = ruido(d, 3000) * (0.4 + 0.6 * (rng.random(int(d * 25) + 1).repeat(int(SR / 25) + 1)[:len(t)] > 0.45))
    s['kaiju-desaba'] = filtro(pedras * env(len(t), 0.005, 0.45) + triangulo(constante(d, 48)) * env(len(t), 0.01, 0.4) * 0.6, 2500)
    # power-up: arpejo subindo e o trinado no alto
    poder = juntar(1.05, *[(0.055 * i, nota(n, 0.07, 0.5, 0.05), 0.4) for i, n in enumerate([60, 64, 67, 72, 76, 79, 84, 88])])
    poder += juntar(1.05, *[(0.46 + 0.035 * i, nota(84 if i % 2 else 88, 0.04, 0.5, 0.03), 0.35 * (1 - i / 17)) for i in range(16)])
    s['kaiju-poder'] = filtro(poder, 7000)
    s['kaiju-cresce'] = filtro(quadrada(varre(0.3, 180, 620)) * env(N(0.3), 0.002, 0.14, 0.02) * 0.6, 4000)
    s['kaiju-encolhe'] = filtro(quadrada(varre(0.3, 620, 180)) * env(N(0.3), 0.002, 0.14, 0.02) * 0.6, 4000)
    d = 0.2
    s['kaiju-morde'] = juntar(d, (0, filtro(ruido(0.04, 9000), 5000) * env(N(0.04), 0.001, 0.01), 0.8), (0.07, filtro(ruido(0.05, 6000), 4000) * env(N(0.05), 0.001, 0.012), 0.9)) + quadrada(varre(d, 320, 140)) * env(N(d), 0.001, 0.06) * 0.4
    d = 0.18
    s['kaiju-soco'] = filtro(ruido(d, 5000) * env(N(d), 0.001, 0.03), 2500) + triangulo(varre(d, 110, 60)) * env(N(d), 0.001, 0.05) * 0.9
    piu = quadrada(varre(0.08, 2000, 2700), 0.25) * env(N(0.08), 0.002, 0.04, 0.01)
    s['kaiju-tonto'] = juntar(0.9, (0, piu, 0.3), (0.25, piu, 0.3), (0.5, piu, 0.3))
    s['kaiju-pulo'] = filtro(quadrada(varre(0.35, 280, 1250), 0.25) * env(N(0.35), 0.002, None, 0.06) * 0.45, 6000)
    d = 0.7
    s['kaiju-pisa'] = filtro(ruido(d, 3000) * env(N(d), 0.001, 0.12), 1500) + triangulo(varre(d, 55, 30)) * env(N(d), 0.002, 0.25) + quadrada(varre(d, 140, 40)) * env(N(d), 0.001, 0.08) * 0.4
    d = 1.5
    s['kaiju-boom'] = filtro(ruido(d, 4000) * env(N(d), 0.001, 0.4), 2500) + triangulo(varre(d, 60, 30)) * env(N(d), 0.002, 0.5) * 0.7
    # vitória: sol-dó-mi-sol e o acorde de dó, com o baixo
    vit = juntar(1.9, *[(0.11 * i, nota(n, 0.12, 0.25, 0.08), 0.35) for i, n in enumerate([67, 72, 76, 79])])
    acorde = sum(quadrada(constante(1.3, hz(n)), 0.25) for n in (84, 76, 79)) / 3
    vit += juntar(1.9, (0.44, acorde * env(N(1.3), 0.005, 0.6, 0.15), 0.4), (0.44, triangulo(constante(1.3, hz(48))) * env(N(1.3), 0.005, 0.7, 0.15), 0.6))
    s['kaiju-vitoria'] = filtro(vit, 7000)
    d = 1.4
    s['kaiju-desce'] = filtro(triangulo(varre(d, 85, 38)) * env(N(d), 0.05, 0.6, 0.2) * 0.8 + filtro(ruido(d, 2000), 500) * env(N(d), 0.05, 0.5, 0.2) * 0.5, 1500)
    for i, n in enumerate([40, 41]):  # mi e fá, grave e pesado: o tubarão chegando
        s[f'kaiju-baixo{i + 1}'] = filtro(triangulo(constante(0.3, hz(n))) * env(N(0.3), 0.004, 0.12, 0.03) + quadrada(constante(0.3, hz(n)), 0.5) * env(N(0.3), 0.004, 0.06, 0.03) * 0.3, 900)
    return s


# ============================== Dragon Ball: o dragão ==============================
def shenlong():
    s = {}
    # as esferas brilham: parciais agudos tremendo, subindo de tom, e um zumbido grave crescendo
    d = 1.0
    t = tempo(d)
    sobe = 2 ** (5 / 12 * t / d)
    brilho = sum(np.sin(2 * np.pi * np.cumsum(constante(d, f) * sobe) / SR) * (0.5 + 0.5 * np.sin(2 * np.pi * (9 + k) * t + k)) for k, f in enumerate([2093, 2637, 3136, 3951, 4699])) / 5
    zumbido = (seno(constante(d, 110)) + 0.6 * seno(constante(d, 165)) + 0.3 * seno(constante(d, 220))) / 1.9
    s['shenlong-brilho'] = (brilho * 0.6 + zumbido * 0.5) * np.minimum(1, t / (d * 0.8)) ** 2 * env(len(t), 0.01, None, 0.08)
    # ele sai das esferas: um sopro que sobe do grave pro agudo
    d = 1.8
    t = tempo(d)
    centro = 250 * (2600 / 250) ** np.minimum(1, t / 0.9)
    sopro = np.zeros(len(t))
    n = N(0.05)
    ru = rng.standard_normal(len(t))
    for i in range(0, len(t), n):  # filtro passa-banda que anda (em pedaços de 50 ms)
        c = centro[i]
        sopro[i:i + n] = filtro(ru, [c * 0.6, min(c * 1.6, 15000)], 'band')[i:i + n]
    s['shenlong-sobe'] = sopro * np.minimum(1, t / 0.5) * env(len(t), 0.01, 0.7, 0.2)
    # o rugido grave, com a garganta (ruído em banda) e um eco
    d = 1.6
    t = tempo(d)
    f = varre(d, 85, 52) + 6 * np.sin(2 * np.pi * 19 * t)
    voz = sum(np.sin(2 * np.pi * np.cumsum(f * k) / SR) / k for k in range(1, 12))  # dente de serra sem serrilhado
    garganta = filtro(rng.standard_normal(len(t)), [300, 1400], 'band') * (0.6 + 0.4 * np.sin(2 * np.pi * 23 * t))
    s['shenlong-ruge'] = eco(filtro((voz * 0.55 + garganta * 0.5) * env(len(t), 0.12, None, 0.5), 3000), 0.13, 0.3, 4)
    # o vento enquanto ele dá a volta no cartão
    d = 4.0
    t = tempo(d)
    vento = filtro(rng.standard_normal(len(t)), 700) * (0.55 + 0.45 * np.sin(2 * np.pi * 0.9 * t) * np.sin(2 * np.pi * 0.37 * t + 1))
    s['shenlong-voo'] = vento * env(len(t), 0.4, None, 0.5)
    # as esferas se espalham: 7 tilins descendo
    def sino(fq, dd=0.6):
        tt = tempo(dd)
        return sum(a * np.sin(2 * np.pi * fq * r * tt) * np.exp(-tt * k) for r, a, k in ((1, 1, 6), (2.76, .35, 9), (5.4, .12, 14))) * env(len(tt), 0.002, None, 0.03)
    s['shenlong-espalha'] = juntar(1.3, *[(0.085 * i, sino(hz(96 - 2 * i)), 0.32) for i in range(7)])
    return s


def gravar(pasta, sons):
    os.makedirs(pasta, exist_ok=True)
    for nome, x in sons.items():
        x = np.asarray(x, float)
        x = x / (np.abs(x).max() + 1e-9) * 0.9  # pico de 0,9: o volume de cada um é a cena que acerta
        wavfile.write(os.path.join(pasta, f'{nome}.wav'), SR, (x * 32767).astype(np.int16))
        print(f'{nome}.wav {len(x) / SR:.2f}s')


gravar(os.path.join(RAIZ, 'sons-padrao'), {**invaders(), **kaiju()})
gravar(os.path.join(RAIZ, 'sons-dragonball'), shenlong())
