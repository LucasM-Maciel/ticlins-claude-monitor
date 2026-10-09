# Conta quantos pixels (quase opacos) de um PNG têm uma cor, com tolerância: o pixels.swift do Mac.
# Uso: python3 pixels.py arquivo.png r g b tolerância [lista | alfaMin alfaMax]
# Lê com o cairo da janelinha (python3-gi-cairo; sem PIL). O cairo guarda a cor já multiplicada
# pelo alfa: desfaz como ele mesmo faz ao gravar o PNG, pra comparar com o valor do arquivo.
# Com "lista": em vez do total, mostra cada cor que casou, pra entender uma falha no CI.
import sys
from collections import Counter

import cairo

a = sys.argv
try:
    if not 6 <= len(a) <= 8:
        raise ValueError("argumentos")
    s = cairo.ImageSurface.create_from_png(a[1])
    r, g, b, tol = (int(x) for x in a[2:6])
except Exception:
    print("-1")
    sys.exit(1)
lista = len(a) == 7
# "pixels.py arquivo.png r g b tol 0.3 0.6": conta os com alfa entre 0,3 e 0,6 (com tol 255, de qualquer cor)
faixa = (float(a[6]), float(a[7])) if len(a) == 8 else (0.78, 1.01)
s.flush()
largura, altura, linha = s.get_width(), s.get_height(), s.get_stride() // 4
px = memoryview(bytes(s.get_data())).cast("I")  # ARGB32: um inteiro por pixel, o alfa no byte de cima
n = 0
vistas = Counter()
for y in range(altura):
    for x in range(largura):
        v = px[y * linha + x]
        pa = v >> 24
        if pa:
            cr = (((v >> 16) & 255) * 255 + pa // 2) // pa
            cg = (((v >> 8) & 255) * 255 + pa // 2) // pa
            cb = ((v & 255) * 255 + pa // 2) // pa
        else:
            cr = cg = cb = 0
        if abs(cr - r) > tol or abs(cg - g) > tol or abs(cb - b) > tol:
            continue
        if faixa[0] < pa / 255 <= faixa[1]:
            n += 1
        if lista:
            vistas[f"{cr},{cg},{cb} alfa={pa / 255:.2f}"] += 1
if lista:
    print(f"{n} contados")
    for k, v in vistas.most_common(10):
        print(f"  {v}x {k}")
else:
    print(n)
