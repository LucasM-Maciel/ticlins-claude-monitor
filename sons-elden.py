"""Gera os sons do tema Elden Ring, feitos do zero (nada do jogo nem de terceiros) -> extensao/janelinha/sons-elden/:
- esperando.wav  um sino de ouro e duas notas de harpa subindo (pergunta / permissão)
- terminou.wav   o acorde da graça: notas claras abrindo devagar, como um coro de sinos (uma sessão terminou)
- tudo.wav       o gongo, uma frase curta de harpa e o acorde final (acabou tudo; melodia original)
- a luta de chefe (elden-epico.js): chefe, rugido-<chefe> (margit, godrick, malenia, radahn), swoosh, impacto, rolar,
  golpe, acerta, acerta-forte, frasco, abatido
- as cenas da caminhada (elden-cenas.js): runas, bau-abre, bau-morde, morreu, graca, mensagem, espirito, cao-late, soldado
- o lendário (elden-lendario.js): rugido-radagon, martelo-aureo, estilhaco, rugido-besta, estrelas, anel, deus-abatido, coroa
  (gravados depois dos outros: o sorteio do ruído dos de cima continua igual)
- os padrões de cada chefe (elden-chefe-*.js, luta): grilhao (o Grilhão de Margit), cura (a Malenia se curando no golpe)
  (gravados por último, pelo mesmo motivo)
Reaproveita os instrumentos (corda, tambor, tilinta, filtros) do sons-akatsuki.py, que ficam ao lado deste arquivo.
Volume dos 3 avisos nivelado com os dos outros temas (o pico de cada um em gravar); o dos épicos, no VOLUME do elden-epico.js.
WAV mono 16 bits 44100. Só a biblioteca padrão do Python: python3 sons-elden.py"""
import importlib.util
import math
import os

_aqui = os.path.dirname(os.path.abspath(__file__))
_spec = importlib.util.spec_from_file_location('sons_akatsuki', os.path.join(_aqui, 'sons-akatsuki.py'))
S = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(S)
S.PASTA = os.path.join(_aqui, 'extensao', 'janelinha', 'sons-elden')
S.rnd.seed(1040)

SR, hz, n, zeros, somar, envelope, decai, inchar = S.SR, S.hz, S.n, S.zeros, S.somar, S.envelope, S.decai, S.inchar
seno, ruido, passa_baixa, passa_alta, filtro_variavel, saturar = S.seno, S.ruido, S.passa_baixa, S.passa_alta, S.filtro_variavel, S.saturar
corda, tambor, tilinta, vento, estouro, gravar = S.corda, S.tambor, S.tilinta, S.vento, S.estouro, S.gravar


def sino(f, d=1.2, g=1.0):
    """sino de ouro: parciais quase harmônicas que somem devagar"""
    out = zeros(d)
    for mult, ganho, vel in [(1.0, 1.0, 3.2), (2.0, 0.55, 4.5), (2.76, 0.35, 6), (4.07, 0.2, 9), (5.4, 0.1, 12)]:
        somar(out, decai(seno(d, f * mult), vel), 0, ganho * g)
    return envelope(out, 0.002, 0.2)


def coro(f, d=1.8, g=1.0):
    """voz de sino: três senos levemente desafinados que abrem e fecham devagar (o brilho da graça)"""
    out = zeros(d)
    for det in (0.994, 1.0, 1.006):
        somar(out, seno(d, f * det), 0, g / 3)
    somar(out, seno(d, f * 2.0), 0, g * 0.15)
    return envelope(out, 0.35 * d, 0.5 * d)


def gongo(d=2.4, f=96):
    """gongo de chefe: baque grave com um metal largo que demora a morrer"""
    out = decai(seno(d, f * 1.3, f), 2.2)
    for mult, ganho, vel in [(1.0, 0.6, 1.4), (1.51, 0.5, 1.8), (2.18, 0.35, 2.4), (3.03, 0.25, 3.2)]:
        somar(out, decai(seno(d, f * mult * 2, f * mult * 1.98), vel), 0, ganho)
    somar(out, decai(passa_baixa(ruido(0.2), 1200), 22), 0, 0.5)
    return envelope(out, 0.003, 0.5)


# ---------- os avisos ----------
def esperando():
    out = zeros(1.1)
    somar(out, sino(1318, 0.9), 0, 0.6)
    somar(out, corda(hz(72), 0.8, 0.7), 0.28, 0.9)
    somar(out, corda(hz(79), 0.7, 0.7), 0.44, 1.0)
    return out


def terminou():
    out = zeros(2.0)
    for k, nota in enumerate((67, 74, 79, 83)):
        somar(out, coro(hz(nota), 1.6, 0.8), 0.08 + k * 0.12)
    somar(out, sino(hz(91), 1.4), 0.3, 0.25)
    return out


def tudo():
    out = zeros(3.6)
    somar(out, gongo(2.0, 90), 0, 0.9)
    for t, nota in [(0.5, 67), (0.8, 70), (1.1, 74), (1.5, 72), (1.8, 70)]:
        somar(out, corda(hz(nota), 1.0, 0.6), t, 0.8)
    for k, nota in enumerate((62, 69, 74, 79)):
        somar(out, coro(hz(nota), 2.0, 0.9), 1.9 + k * 0.1)
    somar(out, sino(hz(98), 1.6), 2.0, 0.3)
    return out


# ---------- a luta de chefe ----------
def chefe():
    return gongo(2.4, 80)


def rugido_grave(d=1.8, f=60, aspereza=1.0, tremor=5.0, sobe=0.5):
    """rugido: dente de serra grave sacudindo (a tremida) com um sopro rouco por cima"""
    total, fase, out = n(d), 0.0, []
    for i in range(total):
        u = i / total
        ff = f * (1 + sobe * math.sin(math.pi * min(1.0, u * 1.5))) * (1 + 0.03 * math.sin(2 * math.pi * tremor * i / SR))
        fase = (fase + ff / SR) % 1.0
        out.append((2 * fase - 1) * (0.7 + 0.3 * math.sin(2 * math.pi * 28 * i / SR)))
    out = saturar(passa_baixa(out, 900 * aspereza), 2.0)
    somar(out, vento(d, 300, 2200 * aspereza, 0.8), 0, 0.8)
    return envelope(out, 0.08, 0.5)


def rugido_margit():
    """o agourento: grunhido velho e rouco, grave, que cai no fim"""
    return rugido_grave(1.7, 55, 0.7, 4.0, 0.4)


def rugido_godrick():
    """o enxertado: rugido largo e grosso, com um segundo tom mais agudo (o dragão enxertado)"""
    out = rugido_grave(1.9, 70, 1.1, 6.0, 0.6)
    somar(out, rugido_grave(1.2, 150, 1.4, 9.0, 0.3), 0.4, 0.5)
    return out


def rugido_malenia():
    """a lâmina: um grito claro e fino subindo, com o tinido de uma lâmina atrás"""
    total, fase, out = n(1.5), 0.0, []
    for i in range(total):
        u = i / total
        f = 520 * (1 + 0.6 * math.sin(math.pi * min(1.0, u * 1.4))) * (1 + 0.015 * math.sin(2 * math.pi * 6 * i / SR))
        fase += 2 * math.pi * f / SR
        out.append(math.sin(fase) + 0.4 * math.sin(2 * fase) + 0.15 * math.sin(3 * fase))
    out = envelope(out, 0.12, 0.5)
    somar(out, tilinta(3200, 0.8), 0.1, 0.5)
    somar(out, sino(hz(81), 1.0), 0.2, 0.25)
    return out


def rugido_radahn():
    """o flagelo: um rugido gigante, com o chão retumbando e o céu trovejando"""
    out = rugido_grave(2.2, 45, 0.9, 3.5, 0.8)
    somar(out, estouro(1.6, 700, 55, 0.7), 0.1, 0.9)
    return saturar(out, 1.4)


def swoosh():
    out = vento(0.45, 500, 4200, 1.0)
    somar(out, envelope(seno(0.3, 180, 520), 0.01, 0.15), 0.05, 0.15)
    return out


def impacto():
    out = envelope(decai(seno(0.7, 110, 36), 5), 0.002, 0.25)
    somar(out, decai(passa_alta(ruido(0.2), 1200), 22), 0, 0.8)
    somar(out, estouro(0.8, 1100, 70, 0.5), 0.01, 0.7)
    return saturar(out, 1.6)


def rolar():
    """o rolamento: tecido roçando, passos e um baque macio no fim"""
    out = vento(0.45, 300, 1800, 0.7)
    for t in (0.05, 0.22):
        somar(out, decai(passa_baixa(ruido(0.05), 1500), 40), t, 0.5)
    somar(out, envelope(decai(seno(0.2, 120, 70), 14), 0.002, 0.08), 0.38, 0.6)
    return out


def golpe():
    """o golpe de espada no ar: sopro agudo e um fio de metal"""
    out = vento(0.35, 900, 6000, 1.0)
    somar(out, tilinta(2800, 0.3), 0.12, 0.25)
    return out


def acerta():
    """a espada acertando armadura: tinido seco e um baque curto"""
    out = tilinta(2400, 0.5)
    somar(out, decai(passa_alta(ruido(0.1), 1500), 45), 0, 0.9)
    somar(out, envelope(decai(seno(0.3, 150, 70), 12), 0.002, 0.1), 0, 0.8)
    return saturar(out, 1.3)


def acerta_forte():
    """o golpe final: o baque grave, o tinido enorme e um clarão de sinos"""
    out = acerta()
    somar(out, envelope(decai(seno(0.9, 90, 32), 4), 0.002, 0.3), 0, 1.0)
    somar(out, estouro(0.9, 1400, 80, 0.5), 0, 0.6)
    for k, nota in enumerate((84, 88, 91)):
        somar(out, sino(hz(nota), 1.1), 0.1 + k * 0.05, 0.3)
    return saturar(out, 1.3)


def frasco():
    """o frasco de lágrimas: três goles e um brilho morno subindo"""
    out = zeros(1.2)
    for t in (0.0, 0.18, 0.36):
        somar(out, envelope(decai(seno(0.15, 380, 220), 18), 0.004, 0.06), t, 0.6)
    for k, nota in enumerate((67, 71, 74, 79)):
        somar(out, coro(hz(nota), 0.9, 0.8), 0.55 + k * 0.08)
    return out


def abatido():
    """GRANDE INIMIGO ABATIDO: um acorde grave que se abre devagar e um clarão de sinos dourados caindo"""
    out = zeros(3.6)
    somar(out, inchar(seno(2.4, 55, 58), 0.15), 0, 0.8)
    somar(out, envelope(decai(seno(2.4, 110, 114), 1.1), 0.15, 0.8), 0.05, 0.7)
    for k, nota in enumerate((55, 62, 67, 74, 79)):
        somar(out, coro(hz(nota), 3.0, 0.9), 0.2 + k * 0.15)
    for k, nota in enumerate((91, 86, 83, 79)):
        somar(out, sino(hz(nota), 1.8), 0.6 + k * 0.22, 0.3)
    return envelope(out, 0.02, 0.9)


# ---------- as cenas da caminhada ----------
def runas():
    """as runas subindo: faíscas agudas, cada uma mais alta que a anterior"""
    out = zeros(1.2)
    for k, nota in enumerate((84, 88, 91, 93, 96, 100)):
        somar(out, envelope(decai(seno(0.5, hz(nota)), 6), 0.003, 0.15), 0.08 * k, 0.4)
    return out


def bau_abre():
    """o baú abrindo de repente: madeira estalando e a dobradiça rangendo"""
    out = decai(passa_alta(ruido(0.12), 800), 30)
    somar(out, envelope(seno(0.5, 260, 520), 0.02, 0.3), 0.04, 0.15)
    somar(out, envelope(decai(seno(0.2, 130, 70), 14), 0.002, 0.08), 0, 0.8)
    return out


def bau_morde():
    """a mordida do baú: dentes batendo e um rosnado curto"""
    out = zeros(0.8)
    for t in (0.0, 0.14, 0.3):
        somar(out, decai(passa_alta(ruido(0.05), 1500), 60), t, 0.8)
        somar(out, envelope(decai(seno(0.12, 200, 110), 20), 0.002, 0.05), t, 0.5)
    somar(out, rugido_grave(0.5, 110, 1.0, 12, 0.2), 0.1, 0.4)
    return out


def morreu():
    """VOCÊ MORREU: um sino grave solitário, um drone escuro caindo e o silêncio"""
    out = zeros(3.0)
    somar(out, sino(hz(43), 3.0), 0, 0.8)
    somar(out, envelope(seno(3.0, 70, 38), 0.2, 1.3), 0, 0.6)
    somar(out, vento(2.4, 120, 600, 0.5), 0.1)
    return out


def graca():
    """a graça acendendo: um acorde de sinos subindo e um fio de luz agudo"""
    out = zeros(1.8)
    for k, nota in enumerate((72, 79, 84)):
        somar(out, coro(hz(nota), 1.3, 0.7), 0.1 * k)
    somar(out, sino(hz(96), 1.2), 0.3, 0.2)
    return out


def mensagem():
    """a mensagem no chão: duas notas suaves, como um recado brilhando"""
    out = zeros(1.0)
    somar(out, sino(hz(79), 0.8), 0, 0.5)
    somar(out, sino(hz(84), 0.8), 0.14, 0.4)
    return out


def espirito():
    """o espírito: sopro etéreo com um tremor agudo (um lamento fino)"""
    out = vento(1.2, 600, 3000, 0.6)
    somar(out, envelope([math.sin(2 * math.pi * (880 + 40 * math.sin(2 * math.pi * 6 * i / SR)) * i / SR) for i in range(n(1.0))], 0.2, 0.5), 0.1, 0.2)
    return out


def cao_late():
    """o cão: dois latidos curtos, roucos e sacudidos"""
    out = zeros(0.7)
    for t in (0.0, 0.26):
        latido = filtro_variavel(ruido(0.18), lambda u: 1400 - 700 * u)
        somar(out, [v * math.exp(-9 * i / SR) for i, v in enumerate(latido)], t, 1.4)
        somar(out, envelope(decai(seno(0.15, 330, 160), 10), 0.003, 0.05), t, 0.6)
    return out


def soldado():
    """o soldado: um tilintar de cota de malha e um bufo grave"""
    out = zeros(0.8)
    for k in range(7):
        somar(out, tilinta(2000 + 300 * (k % 3), 0.15), 0.03 * k, 0.3)
    somar(out, rugido_grave(0.45, 95, 0.8, 8, 0.2), 0.05, 0.5)
    return out


# ---------- o lendário: Radagon e a Besta Prístina ----------
def rugido_radagon():
    """Radagon não ruge: um zumbido sagrado grave que abre num acorde de sinos"""
    out = zeros(2.2)
    somar(out, envelope(seno(2.2, 73, 75), 0.3, 0.8), 0, 0.7)
    for k, nota in enumerate((50, 57, 62)):
        somar(out, coro(hz(nota), 2.0, 0.8), 0.1 + k * 0.12)
    somar(out, sino(hz(86), 1.6), 0.5, 0.35)
    return out


def martelo_aureo():
    """o martelo de Radagon no chão: baque de metal, o tinido largo e uma onda sagrada"""
    out = impacto()
    somar(out, gongo(1.6, 120), 0, 0.6)
    somar(out, tilinta(1900, 0.9), 0.01, 0.4)
    for k, nota in enumerate((79, 86)):
        somar(out, sino(hz(nota), 1.2), 0.08 + k * 0.06, 0.3)
    return saturar(out, 1.2)


def estilhaco():
    """Radagon se estilhaçando: o vidro de ouro rachando, os cacos voando e o estrondo grave"""
    out = zeros(2.4)
    for k in range(5):  # as rachaduras: estalos secos cada vez mais perto
        somar(out, decai(passa_alta(ruido(0.06), 2500), 50), 0.12 * k, 0.4 + 0.1 * k)
    somar(out, estouro(1.4, 900, 45, 0.9), 0.62, 1.0)
    for k in range(18):  # os cacos tilintando
        somar(out, tilinta(2200 + S.rnd.random() * 3800, 0.4 + S.rnd.random() * 0.5), 0.62 + S.rnd.random() * 0.9, 0.18)
    somar(out, envelope(decai(seno(1.6, 80, 34), 2.2), 0.003, 0.6), 0.62, 0.9)
    return saturar(out, 1.2)


def rugido_besta():
    """a Besta Prístina: um coro cósmico grave que sobe, um uivo etéreo e o céu de sinos"""
    out = zeros(3.2)
    for k, nota in enumerate((38, 45, 50, 57)):
        somar(out, coro(hz(nota), 3.0, 0.9), 0.1 * k)
    total, fase, uivo = n(2.4), 0.0, []
    for i in range(total):
        u = i / total
        fase += 2 * math.pi * (300 + 260 * math.sin(math.pi * u)) * (1 + 0.01 * math.sin(2 * math.pi * 5 * i / SR)) / SR
        uivo.append(math.sin(fase) + 0.3 * math.sin(3 * fase))
    somar(out, envelope(passa_baixa(uivo, 2400), 0.5, 0.9), 0.4, 0.35)
    somar(out, vento(3.0, 200, 1400, 0.5), 0, 0.5)
    for k, nota in enumerate((86, 91, 98)):
        somar(out, sino(hz(nota), 1.6), 1.0 + k * 0.25, 0.22)
    return envelope(out, 0.05, 0.8)


def estrelas():
    """as estrelas prístinas: faíscas caindo do agudo pro grave, com um sopro"""
    out = zeros(1.8)
    for k, nota in enumerate((100, 96, 93, 91, 88, 84, 81, 79)):
        somar(out, envelope(decai(seno(0.6, hz(nota), hz(nota) * 0.97), 5), 0.003, 0.2), 0.11 * k, 0.35)
    somar(out, vento(1.4, 1200, 6000, 0.6), 0.05, 0.4)
    return out


def anel():
    """o anel prístino: um zumbido grave inchando e a onda de luz estourando"""
    out = zeros(2.0)
    somar(out, inchar(seno(0.9, 60, 90), 0.1), 0, 0.7)
    somar(out, estouro(1.1, 1600, 60, 0.6), 0.85, 0.9)
    for k, nota in enumerate((74, 81, 86)):
        somar(out, sino(hz(nota), 1.0), 0.85 + k * 0.03, 0.3)
    return saturar(out, 1.2)


def deus_abatido():
    """DEUS ABATIDO: o gongo, o coro grave abrindo devagar e a chuva de sinos (maior que o abatido)"""
    out = zeros(4.6)
    somar(out, gongo(3.0, 70), 0, 0.7)
    somar(out, inchar(seno(3.4, 49, 52), 0.15), 0, 0.7)
    for k, nota in enumerate((43, 50, 55, 62, 67, 74, 79)):
        somar(out, coro(hz(nota), 3.8, 0.9), 0.2 + k * 0.14)
    for k, nota in enumerate((98, 93, 91, 86, 83, 79)):
        somar(out, sino(hz(nota), 2.0), 0.8 + k * 0.2, 0.28)
    return envelope(out, 0.02, 1.2)


def coroa():
    """a coroa de Lorde Prístino: sinos subindo e o acorde maior que fica no ar"""
    out = zeros(2.6)
    for k, nota in enumerate((79, 83, 86, 91)):
        somar(out, sino(hz(nota), 1.4), 0.12 * k, 0.4)
    for k, nota in enumerate((55, 62, 67, 71, 74)):
        somar(out, coro(hz(nota), 2.0, 0.8), 0.45 + k * 0.08)
    return out


# ---------- os padrões de cada chefe ----------
def grilhao():
    """o Grilhão de Margit: o selo dourado acendendo e as correntes tilintando enquanto puxam ele pro chão"""
    out = zeros(1.6)
    somar(out, sino(hz(74), 1.2), 0, 0.4)
    for k in range(9):  # os elos batendo, cada vez mais apertados
        somar(out, tilinta(1600 + 250 * (k % 4) + S.rnd.random() * 200, 0.2), 0.25 + 0.07 * k, 0.35)
    somar(out, envelope(decai(seno(0.5, 140, 60), 7), 0.002, 0.15), 0.9, 0.8)  # o baque dele de joelhos
    return out


def cura():
    """a Malenia se curando no golpe: o corte molhado e um brilho vermelho subindo"""
    out = decai(passa_alta(ruido(0.15), 1800), 30)
    for k, nota in enumerate((69, 72, 76, 81)):
        somar(out, envelope(seno(0.5, hz(nota) * 0.98, hz(nota)), 0.06, 0.3), 0.1 + 0.07 * k, 0.3)
    return out


# os rugidos saturados têm RMS alto pro mesmo pico: abaixados pra luta ficar no nível do resto (medido: radahn -9 dB de RMS, os outros ~-18)
PICOS = {'rugido-margit': 0.45, 'rugido-godrick': 0.4, 'rugido-malenia': 0.5, 'rugido-radahn': 0.28, 'impacto': 0.45, 'acerta-forte': 0.45, 'morreu': 0.45}

if __name__ == '__main__':
    gravar('esperando', esperando(), 0.49)   # pico: os avisos no volume dos outros temas (~-21 LUFS)
    gravar('terminou', terminou(), 0.42)
    gravar('tudo', tudo(), 0.62)
    for nome, f in [('chefe', chefe), ('rugido-margit', rugido_margit), ('rugido-godrick', rugido_godrick),
                    ('rugido-malenia', rugido_malenia), ('rugido-radahn', rugido_radahn), ('swoosh', swoosh),
                    ('impacto', impacto), ('rolar', rolar), ('golpe', golpe), ('acerta', acerta),
                    ('acerta-forte', acerta_forte), ('frasco', frasco), ('abatido', abatido), ('runas', runas),
                    ('bau-abre', bau_abre), ('bau-morde', bau_morde), ('morreu', morreu), ('graca', graca),
                    ('mensagem', mensagem), ('espirito', espirito), ('cao-late', cao_late), ('soldado', soldado),
                    ('rugido-radagon', rugido_radagon), ('martelo-aureo', martelo_aureo), ('estilhaco', estilhaco),
                    ('rugido-besta', rugido_besta), ('estrelas', estrelas), ('anel', anel), ('deus-abatido', deus_abatido),
                    ('coroa', coroa), ('grilhao', grilhao), ('cura', cura)]:
        gravar(nome, f(), PICOS.get(nome, 0.6))
    with open(os.path.join(S.PASTA, 'LICENCAS.txt'), 'w', encoding='utf-8') as f:
        f.write('Sons do tema Elden Ring: sintetizados do zero pelo sons-elden.py deste projeto (MIT, como o resto).\n'
                'Nenhum som de jogo ou de terceiros.\n')
