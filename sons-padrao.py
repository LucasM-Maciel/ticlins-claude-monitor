"""Gera os sons do tema Padrão (sino), feitos do zero: nada de terceiros.
terminou (uma sessão acabou), esperando (pergunta/permissão), tudo (a última
terminou e não sobrou nada). WAV mono 16 bits 44100, como os do Minecraft
(a extensão só mexe no volume de PCM 8/16).
Uso: python sons-padrao.py  (precisa de numpy e scipy) -> extensao/janelinha/sons-padrao/"""
import os
import numpy as np
from scipy.io import wavfile

SR = 44100
PASTA = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'extensao', 'janelinha', 'sons-padrao')


def hz(nota):
    return 440.0 * 2 ** ((nota - 69) / 12)


# parciais de sino, decaimento longo
def sino(nota, duracao=1.4):
    x = np.arange(int(duracao * SR)) / SR
    s = sum(a * np.sin(2 * np.pi * hz(nota) * r * x) * np.exp(-x * k) for r, a, k in
            ((1, 1, 3.2), (2.0, .45, 4.5), (2.76, .3, 6), (5.4, .12, 9), (8.9, .05, 12)))
    s = s * (1 - np.exp(-x * 900))
    s[:int(.004 * SR)] *= np.linspace(0, 1, int(.004 * SR))
    s[-int(.03 * SR):] *= np.linspace(1, 0, int(.03 * SR))
    return s


def juntar(duracao, *notas):
    saida = np.zeros(int(duracao * SR))
    for inicio, s in notas:
        i = int(inicio * SR)
        j = min(len(saida), i + len(s))
        saida[i:j] += s[:j - i]
    return saida


sons = {
    'terminou': (juntar(1.5, (0, sino(84))), -21),                                  # um "dim"
    'esperando': (juntar(1.7, (0, sino(88, 1.2)), (.22, sino(84, 1.4))), -19),             # "dim-dom", chama
    'tudo': (juntar(2.2, (0, sino(79)), (.14, sino(84)), (.28, sino(88)), (.42, sino(91, 1.7))), -19),  # arpejo
}
os.makedirs(PASTA, exist_ok=True)
for nome, (s, alvo) in sons.items():
    # volume igual ao dos sons do Minecraft (xp -19, levelup -18 dB): média das janelas de
    # 50 ms mais altas. Pelo pico, tom puro ficava 5-12 dB acima.
    w = int(SR * .05)
    n = len(s) // w
    rms = np.sort(np.sqrt((s[:n * w].reshape(n, w) ** 2).mean(1)))[::-1][:max(1, n // 5)].mean()
    s = s * 10 ** (alvo / 20) / rms
    assert np.abs(s).max() < 1, nome
    wavfile.write(os.path.join(PASTA, f'{nome}.wav'), SR, (s * 32767).astype(np.int16))
    print(f'{nome}.wav {len(s) / SR:.2f}s')
