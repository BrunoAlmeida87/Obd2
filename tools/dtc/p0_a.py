# -*- coding: utf-8 -*-
"""Códigos genéricos P0000–P0299 (SAE J2012)."""
from base import serie, C5, C4, CTRL3

P = "P"
L = []
add = L.append
ext = L.extend

# ---------------------------------------------------------------- P000x
add(("P0000", "reservado", "Nenhuma falha registrada (alguns scanners exibem P0000 quando não há código)"))
ext(serie(P, 1, "comb_vol", "Regulador de volume de combustível", ["circuito de controle aberto", "circuito de controle — faixa/desempenho", "circuito de controle com sinal baixo", "circuito de controle com sinal alto"]))
ext(serie(P, 5, "comb_vol", "Válvula de corte de combustível \"A\"", CTRL3))
add(("P0008", "vvt", "Desempenho do sistema de posição do motor (sincronismo virabrequim/comando) — banco 1"))
add(("P0009", "vvt", "Desempenho do sistema de posição do motor (sincronismo virabrequim/comando) — banco 2"))
add(("P000A", "vvt", "Resposta lenta da posição do comando \"A\" — banco 1"))
add(("P000B", "vvt", "Resposta lenta da posição do comando \"B\" — banco 1"))
add(("P000C", "vvt", "Resposta lenta da posição do comando \"A\" — banco 2"))
add(("P000D", "vvt", "Resposta lenta da posição do comando \"B\" — banco 2"))
add(("P000E", "comb_vol", "Regulador de volume de combustível — limite de aprendizado excedido"))
add(("P000F", "comb_vol", "Válvula de alívio de sobrepressão do sistema de combustível acionada"))

# ---------------------------------------------------------------- P0010–P0029 comando variável
def vvt_banco(ini, banco):
    return [
        (P + "%04d" % (ini + 0), "vvt", f"Atuador de posição do comando \"A\" (admissão) — circuito aberto/mau funcionamento — banco {banco}"),
        (P + "%04d" % (ini + 1), "vvt", f"Posição do comando \"A\" (admissão) — ponto adiantado demais ou desempenho do sistema — banco {banco}"),
        (P + "%04d" % (ini + 2), "vvt", f"Posição do comando \"A\" (admissão) — ponto atrasado demais — banco {banco}"),
        (P + "%04d" % (ini + 3), "vvt", f"Atuador de posição do comando \"B\" (escape) — circuito aberto/mau funcionamento — banco {banco}"),
        (P + "%04d" % (ini + 4), "vvt", f"Posição do comando \"B\" (escape) — ponto adiantado demais ou desempenho do sistema — banco {banco}"),
        (P + "%04d" % (ini + 5), "vvt", f"Posição do comando \"B\" (escape) — ponto atrasado demais — banco {banco}"),
    ]
ext(vvt_banco(10, 1))
add(("P0016", "vvt", "Correlação entre posição do virabrequim e do comando — banco 1, sensor A (admissão)"))
add(("P0017", "vvt", "Correlação entre posição do virabrequim e do comando — banco 1, sensor B (escape)"))
add(("P0018", "vvt", "Correlação entre posição do virabrequim e do comando — banco 2, sensor A"))
add(("P0019", "vvt", "Correlação entre posição do virabrequim e do comando — banco 2, sensor B"))
ext(vvt_banco(20, 2))
add(("P0026", "vvt", "Solenoide de controle das válvulas de admissão — faixa/desempenho do circuito — banco 1"))
add(("P0027", "vvt", "Solenoide de controle das válvulas de escape — faixa/desempenho do circuito — banco 1"))
add(("P0028", "vvt", "Solenoide de controle das válvulas de admissão — faixa/desempenho do circuito — banco 2"))
add(("P0029", "vvt", "Solenoide de controle das válvulas de escape — faixa/desempenho do circuito — banco 2"))

# ---------------------------------------------------------------- P0030–P0064 aquecedor sonda / turbo
def aquecedor(ini, b, s):
    return [
        (P + "%04d" % ini, "o2h", f"Aquecedor da sonda lambda — mau funcionamento do circuito de controle (banco {b}, sensor {s})"),
        (P + "%04d" % (ini + 1), "o2h", f"Aquecedor da sonda lambda — circuito de controle com sinal baixo (banco {b}, sensor {s})"),
        (P + "%04d" % (ini + 2), "o2h", f"Aquecedor da sonda lambda — circuito de controle com sinal alto (banco {b}, sensor {s})"),
    ]
ext(aquecedor(30, 1, 1))
add(("P0033", "turbo", "Válvula de alívio (bypass) do turbo/compressor — mau funcionamento do circuito de controle"))
add(("P0034", "turbo", "Válvula de alívio (bypass) do turbo/compressor — circuito de controle com sinal baixo"))
add(("P0035", "turbo", "Válvula de alívio (bypass) do turbo/compressor — circuito de controle com sinal alto"))
ext(aquecedor(36, 1, 2))
add(("P0039", "turbo", "Válvula de alívio (bypass) do turbo/compressor — faixa/desempenho do circuito de controle"))
add(("P0040", "o2", "Sinais das sondas lambda trocados — banco 1 sensor 1 / banco 2 sensor 1"))
add(("P0041", "o2", "Sinais das sondas lambda trocados — banco 1 sensor 2 / banco 2 sensor 2"))
ext(aquecedor(42, 1, 3))
ext(serie(P, 45, "turbo", "Controle de pressão do turbo/compressor \"A\"", ["circuito aberto", "faixa/desempenho do circuito", "circuito com sinal baixo", "circuito com sinal alto"]))
add(("P0049", "turbo", "Rotação excessiva da turbina do turbo/compressor"))
ext(aquecedor(50, 2, 1))
add(("P0053", "o2h", "Resistência do aquecedor da sonda lambda fora da faixa (banco 1, sensor 1)"))
add(("P0054", "o2h", "Resistência do aquecedor da sonda lambda fora da faixa (banco 1, sensor 2)"))
add(("P0055", "o2h", "Resistência do aquecedor da sonda lambda fora da faixa (banco 1, sensor 3)"))
ext(aquecedor(56, 2, 2))
add(("P0059", "o2h", "Resistência do aquecedor da sonda lambda fora da faixa (banco 2, sensor 1)"))
add(("P0060", "o2h", "Resistência do aquecedor da sonda lambda fora da faixa (banco 2, sensor 2)"))
add(("P0061", "o2h", "Resistência do aquecedor da sonda lambda fora da faixa (banco 2, sensor 3)"))
ext(aquecedor(62, 2, 3))

# ---------------------------------------------------------------- P0065–P0099
add(("P0065", "injetor", "Controle do injetor assistido a ar — faixa/desempenho"))
add(("P0066", "injetor", "Controle do injetor assistido a ar — mau funcionamento ou sinal baixo no circuito"))
add(("P0067", "injetor", "Controle do injetor assistido a ar — sinal alto no circuito"))
add(("P0068", "ar_adm", "Correlação entre MAP/MAF e posição da borboleta (entrada falsa de ar provável)"))
add(("P0069", "ar_adm", "Correlação entre pressão do coletor (MAP) e pressão barométrica"))
ext(serie(P, 70, "temp_amb", "Sensor de temperatura do ar ambiente", C5))
def valvula_sol(ini, tipo, banco):
    return [
        (P + "%04d" % ini, "vvt", f"Solenoide de controle das válvulas de {tipo} — mau funcionamento do circuito (banco {banco})"),
        (P + "%04d" % (ini + 1), "vvt", f"Solenoide de controle das válvulas de {tipo} — sinal baixo no circuito (banco {banco})"),
        (P + "%04d" % (ini + 2), "vvt", f"Solenoide de controle das válvulas de {tipo} — sinal alto no circuito (banco {banco})"),
    ]
ext(valvula_sol(75, "admissão", 1))
ext(valvula_sol(78, "escape", 1))
ext(valvula_sol(81, "admissão", 2))
ext(valvula_sol(84, "escape", 2))
add(("P0087", "comb_press", "Pressão do sistema/galeria de combustível muito baixa"))
add(("P0088", "comb_press", "Pressão do sistema/galeria de combustível muito alta"))
add(("P0089", "comb_press", "Regulador de pressão de combustível 1 — desempenho"))
add(("P0090", "comb_press", "Regulador de pressão de combustível 1 — mau funcionamento do circuito de controle"))
add(("P0091", "comb_press", "Regulador de pressão de combustível 1 — circuito de controle com sinal baixo"))
add(("P0092", "comb_press", "Regulador de pressão de combustível 1 — circuito de controle com sinal alto"))
add(("P0093", "comb_press", "Vazamento no sistema de combustível detectado — vazamento grande"))
add(("P0094", "comb_press", "Vazamento no sistema de combustível detectado — vazamento pequeno"))
ext(serie(P, 95, "temp_ar", "Sensor 2 de temperatura do ar de admissão", C5))

# ---------------------------------------------------------------- P0100–P0129
ext(serie(P, 100, "ar_adm", "Sensor de fluxo de ar (MAF)", C5))
ext(serie(P, 105, "ar_adm", "Sensor de pressão absoluta do coletor (MAP) / barométrica", C5))
ext(serie(P, 110, "temp_ar", "Sensor de temperatura do ar de admissão (IAT)", C5))
ext(serie(P, 115, "ect", "Sensor de temperatura do líquido de arrefecimento (ECT)", C5))
ext(serie(P, 120, "tps", "Sensor de posição da borboleta/pedal \"A\"", C5))
add(("P0125", "ect", "Temperatura do líquido de arrefecimento insuficiente para entrar em malha fechada"))
add(("P0126", "ect", "Temperatura do líquido de arrefecimento insuficiente para funcionamento estável"))
add(("P0127", "temp_ar", "Temperatura do ar de admissão muito alta"))
add(("P0128", "ect", "Termostato — temperatura do líquido abaixo da temperatura de regulagem do termostato"))
add(("P0129", "ar_adm", "Pressão barométrica muito baixa"))

# ---------------------------------------------------------------- P0130–P0167 sondas lambda
def sonda(ini, b, s):
    nomes = ["mau funcionamento do circuito", "tensão baixa no circuito", "tensão alta no circuito", "resposta lenta do circuito",
             "nenhuma atividade detectada (sem sinal)", "mau funcionamento do circuito do aquecedor"]
    out = []
    for i, n in enumerate(nomes):
        ch = "o2h" if i == 5 else "o2"
        out.append((P + "%04d" % (ini + i), ch, f"Sonda lambda (banco {b}, sensor {s}) — {n}"))
    return out
ext(sonda(130, 1, 1))
ext(sonda(136, 1, 2))
ext(sonda(142, 1, 3))
add(("P0148", "comb_press", "Erro na entrega de combustível"))
add(("P0149", "comb_press", "Erro no tempo (ponto) de injeção de combustível"))
ext(sonda(150, 2, 1))
ext(sonda(156, 2, 2))
ext(sonda(162, 2, 3))
add(("P0168", "comb_temp", "Temperatura do combustível muito alta"))
add(("P0169", "comb_comp", "Composição de combustível incorreta"))
add(("P0170", "mistura", "Correção de combustível (fuel trim) com mau funcionamento — banco 1"))
add(("P0171", "mistura", "Sistema muito pobre (mistura com pouco combustível) — banco 1"))
add(("P0172", "mistura", "Sistema muito rico (mistura com combustível demais) — banco 1"))
add(("P0173", "mistura", "Correção de combustível (fuel trim) com mau funcionamento — banco 2"))
add(("P0174", "mistura", "Sistema muito pobre — banco 2"))
add(("P0175", "mistura", "Sistema muito rico — banco 2"))
ext(serie(P, 176, "comb_comp", "Sensor de composição do combustível (etanol)", ["mau funcionamento do circuito", "faixa/desempenho", "sinal baixo no circuito", "sinal alto no circuito"]))
ext(serie(P, 180, "comb_temp", "Sensor \"A\" de temperatura do combustível", C5))
ext(serie(P, 185, "comb_temp", "Sensor \"B\" de temperatura do combustível", C5))
ext(serie(P, 190, "comb_press", "Sensor de pressão da galeria de combustível", C5))
ext(serie(P, 195, "oleo", "Sensor de temperatura do óleo do motor", C5))

# ---------------------------------------------------------------- P0200–P0299
add(("P0200", "injetor", "Circuito dos bicos injetores — mau funcionamento"))
for c in range(1, 13):
    add((P + "%04d" % (200 + c), "injetor", f"Circuito do bico injetor — cilindro {c} — mau funcionamento"))
add(("P0213", "injetor", "Injetor de partida a frio 1 — mau funcionamento"))
add(("P0214", "injetor", "Injetor de partida a frio 2 — mau funcionamento"))
add(("P0215", "diesel", "Solenoide de corte do motor — mau funcionamento"))
add(("P0216", "diesel", "Circuito de controle do ponto de injeção — mau funcionamento"))
add(("P0217", "superaq", "Condição de superaquecimento do motor"))
add(("P0218", "trans", "Condição de superaquecimento da transmissão"))
add(("P0219", "superaq", "Condição de rotação excessiva do motor"))
ext(serie(P, 220, "tps", "Sensor de posição da borboleta/pedal \"B\"", C5))
ext(serie(P, 225, "tps", "Sensor de posição da borboleta/pedal \"C\"", C5))
add(("P0230", "bomba_comb", "Bomba de combustível — mau funcionamento do circuito primário"))
add(("P0231", "bomba_comb", "Bomba de combustível — circuito secundário com sinal baixo"))
add(("P0232", "bomba_comb", "Bomba de combustível — circuito secundário com sinal alto"))
add(("P0233", "bomba_comb", "Bomba de combustível — circuito secundário intermitente"))
add(("P0234", "turbo", "Condição de sobrepressão do turbo/compressor (overboost)"))
ext(serie(P, 235, "turbo", "Sensor \"A\" de pressão do turbo", C4))
ext(serie(P, 239, "turbo", "Sensor \"B\" de pressão do turbo", C4))
ext(serie(P, 243, "turbo", "Solenoide \"A\" da wastegate do turbo", ["mau funcionamento", "faixa/desempenho", "sinal baixo", "sinal alto"]))
ext(serie(P, 247, "turbo", "Solenoide \"B\" da wastegate do turbo", ["mau funcionamento", "faixa/desempenho", "sinal baixo", "sinal alto"]))
ext(serie(P, 251, "diesel", "Controle \"A\" de dosagem da bomba injetora", ["mau funcionamento", "faixa/desempenho", "sinal baixo", "sinal alto", "intermitente"]))
ext(serie(P, 256, "diesel", "Controle \"B\" de dosagem da bomba injetora", ["mau funcionamento", "faixa/desempenho", "sinal baixo", "sinal alto", "intermitente"]))
for c in range(1, 13):
    base = 261 + (c - 1) * 3
    add((P + "%04d" % base, "injetor", f"Circuito do bico injetor do cilindro {c} — sinal baixo"))
    add((P + "%04d" % (base + 1), "injetor", f"Circuito do bico injetor do cilindro {c} — sinal alto"))
    add((P + "%04d" % (base + 2), "misfire", f"Falha de contribuição/balanceamento do cilindro {c}"))
add(("P0297", "superaq", "Condição de velocidade excessiva do veículo"))
add(("P0298", "oleo", "Temperatura do óleo do motor muito alta"))
add(("P0299", "turbo", "Pressão do turbo/compressor abaixo do esperado (underboost)"))
