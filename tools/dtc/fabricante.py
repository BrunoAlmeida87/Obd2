# -*- coding: utf-8 -*-
"""Códigos de fabricante Hyundai/Kia.

IMPORTANTE: códigos de fabricante não são padronizados. A mesma numeração pode ter
significado diferente em outra marca ou até em outro modelo Hyundai/Kia. Só entram aqui
códigos com descrição recorrente na literatura de serviço Hyundai/Kia. Nenhum foi verificado
contra o manual de serviço específico do Cerato 2014 brasileiro, por isso a confiança
máxima é "media". Na dúvida o código ficou de fora.
"""

FONTE_HK = "Descrição recorrente em listas de DTC de serviço Hyundai/Kia (não verificada no manual do Cerato 2014 BR)"
FONTE_HK_BAIXA = "Citado em fóruns e listas de terceiros para Hyundai/Kia; significado pode variar por modelo"

# (codigo, chave_sistema, descricao, confianca, fonte, nota_cerato)
L = [
    # ---------------- motor / trem de força (P1xxx)
    ("P1115", "ect", "Sinal de temperatura do motor enviado da central do motor (ECM) para a do câmbio (TCM)", "media", FONTE_HK, ""),
    ("P1123", "mistura", "Correção de longo prazo (aditiva, sistema de ar) — mistura rica demais", "media", FONTE_HK,
     "A parte \"aditiva\" corrige principalmente em marcha lenta; valores altos costumam indicar entrada falsa de ar ou vapores do canister."),
    ("P1124", "mistura", "Correção de longo prazo (aditiva, sistema de ar) — mistura pobre demais", "media", FONTE_HK,
     "Muito associada a entrada falsa de ar em marcha lenta (mangueira do respiro, servo-freio, junta do coletor)."),
    ("P1127", "mistura", "Correção de longo prazo (multiplicativa) — mistura rica demais", "media", FONTE_HK,
     "A parte \"multiplicativa\" atua em carga média/alta; sugere excesso de combustível (bico pingando, pressão alta)."),
    ("P1128", "mistura", "Correção de longo prazo (multiplicativa) — mistura pobre demais", "media", FONTE_HK,
     "Sugere falta de combustível em carga: bomba fraca, filtro entupido, bicos sujos ou combustível adulterado."),
    ("P1326", "detonacao", "Sistema de detecção de batida/desgaste (KSDS) detectou vibração anormal do motor", "media", FONTE_HK,
     "O KSDS foi instalado por campanha em motores específicos da Hyundai/Kia. A aplicação ao Cerato 2014 brasileiro não está confirmada. Se aparecer, não ignore: procure a concessionária."),
    ("P1372", "ckp", "Aquisição incorreta do tempo de segmento (sinal da roda fônica do virabrequim)", "media", FONTE_HK, ""),
    ("P1529", "trans", "Curto no circuito de ligação direta entre central do motor e central do câmbio (pedido de MIL)", "media", FONTE_HK, ""),
    ("P1586", "trans", "Erro de codificação câmbio manual/automático (MT/AT) na central do motor", "media", FONTE_HK,
     "Pode aparecer após troca ou reprogramação da central."),
    ("P1602", "rede", "Falha de comunicação serial entre central do motor e central do câmbio", "media", FONTE_HK, ""),
    ("P1611", "trans", "Circuito de pedido de MIL (TCM → ECM) com sinal baixo", "media", FONTE_HK, ""),
    ("P1624", "trans", "Pedido de acendimento da MIL enviado pela central do câmbio (TCM) à central do motor", "media", FONTE_HK,
     "A falha real está na central do câmbio: leia os códigos da TCM (aba Módulos Kia)."),
    ("P1690", "imob", "Imobilizador (SMARTRA): sem resposta do módulo/antena", "media", FONTE_HK, ""),
    ("P1691", "imob", "Imobilizador: erro na bobina da antena", "media", FONTE_HK, ""),
    ("P1692", "imob", "Imobilizador: falha no circuito da lâmpada indicadora", "baixa", FONTE_HK_BAIXA, ""),
    ("P1693", "imob", "Imobilizador: erro de transponder (chave)", "media", FONTE_HK, ""),
    ("P1694", "imob", "Imobilizador: erro de mensagem enviada pela central do motor", "media", FONTE_HK, ""),
    ("P1695", "imob", "Imobilizador: erro na memória (EEPROM) da central do motor", "media", FONTE_HK, ""),
    ("P1696", "imob", "Imobilizador: falha de autenticação da chave", "media", FONTE_HK, ""),
    ("P1697", "imob", "Imobilizador: central do motor bloqueada ou sem chave aprendida", "baixa", FONTE_HK_BAIXA, ""),

    # ---------------- ABS / ESC (Cxxxx) — módulos Mando/Bosch usados pela Hyundai/Kia
    ("C1101", "abs", "Tensão da bateria alta (módulo ABS/ESC)", "media", FONTE_HK, ""),
    ("C1102", "abs", "Tensão da bateria baixa (módulo ABS/ESC)", "media", FONTE_HK, "Comum após partida com bateria fraca; apague e veja se volta."),
    ("C1200", "abs", "Sensor de velocidade da roda dianteira esquerda — circuito aberto ou em curto", "media", FONTE_HK, ""),
    ("C1201", "abs", "Sensor de velocidade da roda dianteira esquerda — faixa/desempenho", "media", FONTE_HK, ""),
    ("C1202", "abs", "Sensor de velocidade da roda dianteira esquerda — sinal inválido ou ausente", "media", FONTE_HK, ""),
    ("C1203", "abs", "Sensor de velocidade da roda dianteira direita — circuito aberto ou em curto", "media", FONTE_HK, ""),
    ("C1204", "abs", "Sensor de velocidade da roda dianteira direita — faixa/desempenho", "media", FONTE_HK, ""),
    ("C1205", "abs", "Sensor de velocidade da roda dianteira direita — sinal inválido ou ausente", "media", FONTE_HK, ""),
    ("C1206", "abs", "Sensor de velocidade da roda traseira esquerda — circuito aberto ou em curto", "media", FONTE_HK, ""),
    ("C1207", "abs", "Sensor de velocidade da roda traseira esquerda — faixa/desempenho", "media", FONTE_HK, ""),
    ("C1208", "abs", "Sensor de velocidade da roda traseira esquerda — sinal inválido ou ausente", "media", FONTE_HK, ""),
    ("C1209", "abs", "Sensor de velocidade da roda traseira direita — circuito aberto ou em curto", "media", FONTE_HK, ""),
    ("C1210", "abs", "Sensor de velocidade da roda traseira direita — faixa/desempenho", "media", FONTE_HK, ""),
    ("C1211", "abs", "Sensor de velocidade da roda traseira direita — sinal inválido ou ausente", "media", FONTE_HK, ""),
    ("C1282", "abs", "Sensor de taxa de guinada / aceleração lateral — falha elétrica", "baixa", FONTE_HK_BAIXA, ""),
    ("C1513", "abs", "Interruptor do pedal de freio — falha", "baixa", FONTE_HK_BAIXA, "Confira se as luzes de freio acendem."),
    ("C1604", "abs", "Erro de hardware da unidade de controle ABS/ESC", "media", FONTE_HK, ""),
    ("C1611", "abs", "Tempo esgotado na comunicação CAN com a central do motor (EMS)", "media", FONTE_HK, ""),
    ("C1612", "abs", "Tempo esgotado na comunicação CAN com a central do câmbio (TCU)", "media", FONTE_HK, ""),
    ("C1616", "abs", "Barramento CAN desligado (bus off) no módulo ABS/ESC", "media", FONTE_HK, ""),
    ("C1702", "abs", "Erro de codificação de variante do módulo ABS/ESC", "media", FONTE_HK, "Aparece após troca do módulo sem codificação correta."),
    ("C2112", "abs", "Relé das válvulas (solenoides) do ABS — falha", "media", FONTE_HK, ""),
    ("C2402", "abs", "Motor da bomba do ABS — falha elétrica", "media", FONTE_HK, ""),

    # ---------------- Airbag / SRS (Bxxxx)
    ("B1101", "srs", "Tensão da bateria alta (módulo do airbag)", "media", FONTE_HK, ""),
    ("B1102", "srs", "Tensão da bateria baixa (módulo do airbag)", "media", FONTE_HK, "Comum com bateria fraca; recarregue/troque a bateria e apague com equipamento adequado."),
    ("B1346", "srs", "Airbag do motorista — resistência alta no circuito", "media", FONTE_HK,
     "Causa muito comum: cinta do volante (clock spring) gasta. Não mexa no airbag por conta própria."),
    ("B1347", "srs", "Airbag do motorista — resistência baixa no circuito", "media", FONTE_HK, ""),
    ("B1348", "srs", "Airbag do motorista — circuito em curto com o terra", "media", FONTE_HK, ""),
    ("B1349", "srs", "Airbag do motorista — circuito em curto com a bateria", "media", FONTE_HK, ""),
    ("B1352", "srs", "Airbag do passageiro — resistência alta no circuito", "media", FONTE_HK, ""),
    ("B1353", "srs", "Airbag do passageiro — resistência baixa no circuito", "media", FONTE_HK, ""),
    ("B1354", "srs", "Airbag do passageiro — circuito em curto com o terra", "media", FONTE_HK, ""),
    ("B1355", "srs", "Airbag do passageiro — circuito em curto com a bateria", "media", FONTE_HK, ""),
    ("B1361", "srs", "Pré-tensionador do cinto do motorista — resistência alta", "baixa", FONTE_HK_BAIXA,
     "Verifique o conector amarelo sob o banco do motorista (com bateria desligada há alguns minutos)."),
    ("B1362", "srs", "Pré-tensionador do cinto do motorista — resistência baixa", "baixa", FONTE_HK_BAIXA, ""),
    ("B1620", "srs", "Falha interna do módulo do airbag (SRSCM)", "media", FONTE_HK, ""),
    ("B1650", "srs", "Colisão frontal registrada no módulo do airbag", "media", FONTE_HK,
     "Depois de um acionamento, o módulo normalmente precisa ser substituído. NÃO apague este código."),
]
