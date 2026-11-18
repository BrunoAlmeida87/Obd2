# -*- coding: utf-8 -*-
"""Códigos genéricos P3400–P3497 (desativação de cilindros) e genéricos C0, B0 e U0 relevantes."""
P = "P"
L = []        # códigos de alta confiança (SAE J2012)
L_MEDIA = []  # genéricos cuja numeração varia entre fabricantes -> confiança média
add = L.append

# ---------------------------------------------------------------- P3400–P3497
add(("P3400", "desativacao", "Sistema de desativação de cilindros — banco 1"))
for c in range(1, 13):
    base = 3401 + (c - 1) * 8
    itens = [
        ("válvula de admissão/desativação — circuito de controle aberto"),
        ("válvula de admissão/desativação — desempenho do controle"),
        ("válvula de admissão/desativação — circuito de controle com sinal baixo"),
        ("válvula de admissão/desativação — circuito de controle com sinal alto"),
        ("válvula de escape — circuito de controle aberto"),
        ("válvula de escape — desempenho do controle"),
        ("válvula de escape — circuito de controle com sinal baixo"),
        ("válvula de escape — circuito de controle com sinal alto"),
    ]
    for i, t in enumerate(itens):
        add((P + "%04d" % (base + i), "desativacao", f"Desativação do cilindro {c} — {t}"))
add(("P3497", "desativacao", "Sistema de desativação de cilindros — banco 2"))

# ---------------------------------------------------------------- U0xxx rede (genéricos)
U = [
    ("U0001", "Barramento CAN de alta velocidade — falha de comunicação"),
    ("U0002", "Barramento CAN de alta velocidade — desempenho"),
    ("U0003", "Barramento CAN de alta velocidade (+) aberto"),
    ("U0004", "Barramento CAN de alta velocidade (+) com sinal baixo"),
    ("U0005", "Barramento CAN de alta velocidade (+) com sinal alto"),
    ("U0006", "Barramento CAN de alta velocidade (−) aberto"),
    ("U0007", "Barramento CAN de alta velocidade (−) com sinal baixo"),
    ("U0008", "Barramento CAN de alta velocidade (−) com sinal alto"),
    ("U0009", "Barramento CAN de alta velocidade (−) em curto com o (+)"),
    ("U0010", "Barramento CAN de média velocidade — falha de comunicação"),
    ("U0011", "Barramento CAN de média velocidade — desempenho"),
    ("U0019", "Barramento CAN de baixa velocidade — falha de comunicação"),
    ("U0020", "Barramento CAN de baixa velocidade — desempenho"),
    ("U0028", "Barramento de comunicação do veículo \"A\""),
    ("U0029", "Barramento de comunicação do veículo \"A\" — desempenho"),
    ("U0100", "Perda de comunicação com a central do motor (ECM/PCM \"A\")"),
    ("U0101", "Perda de comunicação com a central do câmbio (TCM)"),
    ("U0102", "Perda de comunicação com o módulo da caixa de transferência"),
    ("U0103", "Perda de comunicação com o módulo da alavanca de câmbio"),
    ("U0104", "Perda de comunicação com o módulo do piloto automático"),
    ("U0105", "Perda de comunicação com o módulo de controle dos injetores"),
    ("U0106", "Perda de comunicação com o módulo das velas aquecedoras"),
    ("U0107", "Perda de comunicação com o módulo do atuador da borboleta"),
    ("U0108", "Perda de comunicação com o módulo de combustível alternativo"),
    ("U0109", "Perda de comunicação com o módulo da bomba de combustível"),
    ("U0115", "Perda de comunicação com a central do motor \"B\""),
    ("U0121", "Perda de comunicação com o módulo do ABS"),
    ("U0122", "Perda de comunicação com o módulo de controle de estabilidade (ESC/VDC)"),
    ("U0123", "Perda de comunicação com o sensor de taxa de guinada (yaw)"),
    ("U0124", "Perda de comunicação com o sensor de aceleração lateral"),
    ("U0125", "Perda de comunicação com o sensor de aceleração multieixo"),
    ("U0126", "Perda de comunicação com o sensor de ângulo de direção"),
    ("U0127", "Perda de comunicação com o módulo de pressão dos pneus (TPMS)"),
    ("U0128", "Perda de comunicação com o módulo do freio de estacionamento"),
    ("U0129", "Perda de comunicação com o módulo do sistema de freios"),
    ("U0130", "Perda de comunicação com o módulo de esforço de direção"),
    ("U0131", "Perda de comunicação com o módulo da direção assistida (MDPS)"),
    ("U0140", "Perda de comunicação com o módulo da carroceria (BCM)"),
    ("U0141", "Perda de comunicação com o módulo da carroceria \"A\""),
    ("U0142", "Perda de comunicação com o módulo da carroceria \"B\""),
    ("U0146", "Perda de comunicação com o gateway \"A\""),
    ("U0151", "Perda de comunicação com o módulo do airbag (SRS)"),
    ("U0155", "Perda de comunicação com o painel de instrumentos"),
    ("U0156", "Perda de comunicação com o centro de informações \"A\""),
    ("U0159", "Perda de comunicação com o módulo do sensor de estacionamento \"A\""),
    ("U0164", "Perda de comunicação com o módulo do ar-condicionado (HVAC)"),
    ("U0167", "Perda de comunicação com o módulo do imobilizador"),
    ("U0168", "Perda de comunicação com o módulo de segurança/alarme"),
    ("U0184", "Perda de comunicação com o rádio/multimídia"),
    ("U0300", "Incompatibilidade de software de módulo interno"),
    ("U0301", "Incompatibilidade de software com a central do motor (ECM/PCM)"),
    ("U0302", "Incompatibilidade de software com a central do câmbio (TCM)"),
    ("U0401", "Dados inválidos recebidos da central do motor (ECM/PCM \"A\")"),
    ("U0402", "Dados inválidos recebidos da central do câmbio (TCM)"),
    ("U0415", "Dados inválidos recebidos do módulo do ABS"),
    ("U0416", "Dados inválidos recebidos do módulo de controle de estabilidade"),
    ("U0422", "Dados inválidos recebidos do módulo da carroceria (BCM)"),
    ("U0423", "Dados inválidos recebidos do painel de instrumentos"),
    ("U0428", "Dados inválidos recebidos do sensor de ângulo de direção"),
]
for cod, d in U:
    add((cod, "rede", d))

# ---------------------------------------------------------------- C0 / B0 (numeração varia por fabricante)
L_MEDIA.extend([
    ("C0035", "abs", "Sensor de velocidade da roda dianteira esquerda — circuito"),
    ("C0040", "abs", "Sensor de velocidade da roda dianteira direita — circuito"),
    ("C0045", "abs", "Sensor de velocidade da roda traseira esquerda — circuito"),
    ("C0050", "abs", "Sensor de velocidade da roda traseira direita — circuito"),
    ("C0031", "abs", "Sensor de velocidade da roda dianteira esquerda"),
    ("C0034", "abs", "Sensor de velocidade da roda dianteira direita"),
    ("C0037", "abs", "Sensor de velocidade da roda traseira esquerda"),
    ("C003A", "abs", "Sensor de velocidade da roda traseira direita"),
    ("B0001", "srs", "Controle de acionamento do airbag frontal do motorista — estágio 1"),
    ("B0002", "srs", "Controle de acionamento do airbag frontal do motorista — estágio 2"),
    ("B0010", "srs", "Controle de acionamento do airbag frontal do passageiro — estágio 1"),
    ("B0011", "srs", "Controle de acionamento do airbag frontal do passageiro — estágio 2"),
])
