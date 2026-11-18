# -*- coding: utf-8 -*-
"""Problemas conhecidos do Cerato 2014, faixas de fallback e textos do banco."""

PROBLEMAS = [
    {
        "id": "ignicao",
        "titulo": "Falhas de ignição / bobinas e velas",
        "motor": "ambos",
        "codigos": ["P0300", "P0301", "P0302", "P0303", "P0304", "P0351", "P0352", "P0353", "P0354"],
        "sintomas": ["Motor tremendo em marcha lenta", "Falta de força ao acelerar", "Luz de injeção piscando em aceleração", "Cheiro de combustível no escape"],
        "explicacao": "Os motores Gamma 1.6 e Nu 2.0 usam uma bobina por cilindro. Velas além do prazo, bobinas com trinca e combustível de baixa qualidade são as causas mais comuns. Rodar com falha de ignição superaquece e pode destruir o catalisador.",
        "verificacoes": ["Trocar as bobinas de cilindro entre si para ver se a falha acompanha", "Verificar as velas e o prazo de troca do manual", "Abastecer em posto confiável", "Teste de compressão se velas e bobinas estiverem boas"],
        "confianca": "media"
    },
    {
        "id": "cvvt",
        "titulo": "Comando variável (CVVT) — óleo, válvulas OCV e corrente",
        "motor": "ambos",
        "codigos": ["P0010", "P0011", "P0012", "P0013", "P0014", "P0015", "P0016", "P0017"],
        "sintomas": ["Marcha lenta irregular", "Perda de desempenho", "Ruído metálico de corrente nos primeiros segundos após a partida a frio"],
        "explicacao": "O comando variável depende de pressão e qualidade do óleo. Troca de óleo atrasada ou óleo fora da especificação entope a tela das válvulas OCV e gera os códigos de CVVT. Com quilometragem alta, a corrente de comando pode esticar e causar P0016/P0017.",
        "verificacoes": ["Conferir nível e especificação do óleo; trocar óleo e filtro", "Remover e limpar as telas das OCVs", "Se persistir com ruído na partida, verificar ponto e corrente de comando"],
        "confianca": "media"
    },
    {
        "id": "termostato",
        "titulo": "Termostato travado aberto",
        "motor": "ambos",
        "codigos": ["P0128", "P0125"],
        "sintomas": ["Ponteiro de temperatura demorando para subir", "Ar quente fraco", "Consumo maior"],
        "explicacao": "A válvula termostática travada aberta faz o motor trabalhar frio. A central registra P0128 quando o motor não atinge a temperatura esperada no tempo previsto.",
        "verificacoes": ["Ver a temperatura ao vivo durante o aquecimento", "Conferir se a ventoinha não fica ligada com o motor frio", "Trocar o termostato e completar o líquido de arrefecimento correto"],
        "confianca": "media"
    },
    {
        "id": "catalisador",
        "titulo": "Catalisador com baixa eficiência",
        "motor": "ambos",
        "codigos": ["P0420"],
        "sintomas": ["Normalmente nenhum sintoma ao dirigir", "Às vezes cheiro de ovo podre no escape", "Reprovação na inspeção"],
        "explicacao": "O P0420 costuma aparecer em carros com quilometragem alta ou que rodaram com falha de ignição ou mistura rica. Antes de trocar o catalisador, resolva a causa (ignição, mistura, consumo de óleo) e confira a sonda traseira.",
        "verificacoes": ["Comparar ao vivo as sondas dianteira (14) e traseira (15)", "Resolver códigos P030x e P0171/P0172 primeiro", "Procurar vazamentos no escape"],
        "confianca": "media"
    },
    {
        "id": "sondas",
        "titulo": "Sondas lambda",
        "motor": "ambos",
        "codigos": ["P0130", "P0131", "P0132", "P0133", "P0134", "P0135", "P0136", "P0137", "P0138", "P0139", "P0140", "P0141", "P2195", "P2196", "P0030", "P0031", "P0032", "P0036", "P0037", "P0038"],
        "sintomas": ["Consumo maior", "Marcha lenta irregular", "Reprovação na inspeção"],
        "explicacao": "A sonda dianteira controla a mistura; a traseira monitora o catalisador. Sondas envelhecem e se contaminam com combustível ruim e aditivos. Códigos de aquecedor (P0030–P0038, P0135, P0141) normalmente são a resistência interna queimada ou fusível.",
        "verificacoes": ["Ver ao vivo a tensão das sondas com o motor quente", "Verificar conectores e chicote perto do escape", "Medir a resistência do aquecedor"],
        "confianca": "media"
    },
    {
        "id": "evap",
        "titulo": "EVAP / canister e tampa do tanque",
        "motor": "ambos",
        "codigos": ["P0441", "P0442", "P0443", "P0455", "P0456", "P0457", "P0496", "P0497"],
        "sintomas": ["Cheiro de combustível", "Dificuldade de partida logo após abastecer", "Marcha lenta irregular após abastecer"],
        "explicacao": "Tampa do tanque mal fechada é a causa mais simples. A válvula de purga do canister (PCSV) travada aberta deixa vapor de combustível entrar no motor e atrapalha a partida depois de abastecer. Completar o tanque após o desarme da bomba pode encharcar o canister.",
        "verificacoes": ["Fechar a tampa até estalar e conferir a vedação", "Testar a válvula de purga (deve ficar fechada sem energia)", "Não completar o tanque após o primeiro desarme da bomba"],
        "confianca": "media"
    },
    {
        "id": "borboleta",
        "titulo": "Corpo de borboleta eletrônico",
        "motor": "ambos",
        "codigos": ["P2135", "P2101", "P2119", "P2104", "P2106", "P2111", "P2112", "P0638", "P0121", "P0122", "P0123", "P0506", "P0507"],
        "sintomas": ["Marcha lenta oscilando ou baixa", "Carro sem aceleração (modo de emergência)", "Motor apagando ao parar"],
        "explicacao": "Carvão e vapor de óleo do respiro sujam o corpo de borboleta e alteram a marcha lenta. Conectores oxidados geram códigos de correlação (P2135). Depois de limpar ou desconectar a bateria é preciso reaprender a posição da borboleta.",
        "verificacoes": ["Limpar o corpo de borboleta com produto próprio", "Fazer o reaprendizado (ignição ligada ~10 s sem acelerar, depois marcha lenta por alguns minutos)", "Verificar o conector do corpo de borboleta"],
        "confianca": "media"
    },
    {
        "id": "sensores_cambio",
        "titulo": "Sensores de rotação do câmbio automático",
        "motor": "ambos",
        "cambio": "automatico",
        "codigos": ["P0715", "P0716", "P0717", "P0720", "P0721", "P0722", "P0700"],
        "sintomas": ["Trocas duras", "Câmbio preso numa marcha (modo de emergência)", "Velocímetro oscilando"],
        "explicacao": "O câmbio automático de 6 marchas usa sensores de rotação de entrada e de saída. Falhas nesses sensores ou no conector fazem a central do câmbio entrar em modo de emergência.",
        "verificacoes": ["Ler os códigos da TCM (ECU 7E9)", "Inspecionar o conector do câmbio e os sensores", "Verificar o fluido do câmbio"],
        "confianca": "media"
    },
    {
        "id": "solenoides_cambio",
        "titulo": "Solenoides e fluido do câmbio automático",
        "motor": "ambos",
        "cambio": "automatico",
        "codigos": ["P0741", "P0743", "P0745", "P0748", "P0750", "P0755", "P0760", "P0765", "P0770", "P0730", "P0731", "P0732", "P0733", "P0734", "P0735"],
        "sintomas": ["Trancos nas trocas", "Patinação (rotação sobe sem o carro ganhar velocidade)", "Rotação oscilando em velocidade constante"],
        "explicacao": "Solenoides do corpo de válvulas comandam as trocas. Fluido vencido ou fora da especificação acelera o desgaste e causa travamento dos solenoides. Códigos de relação incorreta (P073x) indicam patinação interna.",
        "verificacoes": ["Verificar nível e estado do fluido seguindo o procedimento do manual", "Usar somente o fluido especificado", "Diagnóstico em oficina especializada em câmbio automático"],
        "confianca": "media"
    },
    {
        "id": "detonacao",
        "titulo": "Sensor de detonação e combustível",
        "motor": "ambos",
        "codigos": ["P0325", "P0326", "P0327", "P0328"],
        "sintomas": ["Perda de força", "Batida de pino em subidas", "Consumo maior"],
        "explicacao": "O sensor de detonação permite à central adiantar o ponto com segurança. Com o sensor em falha ou com combustível ruim (detonação real), a central atrasa o ponto e o motor perde desempenho.",
        "verificacoes": ["Verificar o conector do sensor sob o coletor de admissão", "Conferir o torque de aperto", "Abastecer em posto confiável"],
        "confianca": "media"
    },
    {
        "id": "flex_mistura",
        "titulo": "Flex: mistura pobre/rica e adaptação de etanol",
        "motor": "ambos",
        "codigos": ["P0171", "P0172", "P2187", "P2188", "P2177", "P2178", "P0170", "P1123", "P1124", "P1127", "P1128"],
        "sintomas": ["Marcha lenta instável", "Falhas logo depois de abastecer", "Consumo alterado"],
        "explicacao": "O motor flex calcula o teor de etanol pela sonda lambda. Logo após trocar de combustível a central ainda está aprendendo e pode registrar mistura pobre/rica. Se o código persistir depois de rodar alguns dias, a causa é física: entrada falsa de ar, bicos sujos, pressão de combustível ou combustível adulterado.",
        "verificacoes": ["Rodar 10–20 km em ritmo variado depois de abastecer", "Ver correções de combustível (STFT/LTFT) e teor de etanol (PID 52) ao vivo", "Procurar entradas falsas de ar", "Medir pressão de combustível e testar bicos"],
        "confianca": "media"
    },
    {
        "id": "flex_frio",
        "titulo": "Flex: partida a frio com etanol",
        "motor": "ambos",
        "codigos": ["P0117", "P0118", "P0128", "P0171"],
        "sintomas": ["Motor demora a pegar em manhãs frias com etanol", "Falhas nos primeiros minutos"],
        "explicacao": "Etanol vaporiza mal em temperaturas baixas. A estratégia de partida a frio (reservatório auxiliar de gasolina ou aquecimento) varia por versão: consulte o manual do seu carro. Sensor de temperatura do motor lendo errado piora muito a partida a frio.",
        "verificacoes": ["Conferir a temperatura do motor ao vivo antes da partida (deve ser parecida com a ambiente)", "Se o seu carro tiver reservatório auxiliar de gasolina, mantenha-o abastecido", "Verificar bateria e velas"],
        "confianca": "baixa"
    },
    {
        "id": "bateria",
        "titulo": "Bateria, alternador e códigos de comunicação",
        "motor": "ambos",
        "codigos": ["P0562", "P0563", "P2503", "P2504", "U0100", "U0101", "U0121", "U0155", "C1102", "B1102"],
        "sintomas": ["Vários códigos U (comunicação) de uma vez", "Luzes do painel piscando na partida", "Partida fraca"],
        "explicacao": "Bateria fraca faz a tensão cair na partida e os módulos registram perda de comunicação e tensão baixa. Antes de procurar defeito em módulos, teste bateria e alternador.",
        "verificacoes": ["Medir tensão em repouso (~12,6 V) e com motor ligado (13,5–14,7 V)", "Limpar e apertar terminais e aterramentos", "Apagar os códigos e ver quais voltam"],
        "confianca": "media"
    },
    {
        "id": "abs_rodas",
        "titulo": "Sensores de roda do ABS",
        "motor": "ambos",
        "codigos": ["C1200", "C1201", "C1202", "C1203", "C1204", "C1205", "C1206", "C1207", "C1208", "C1209", "C1210", "C1211", "P0500"],
        "sintomas": ["Luzes de ABS e ESC acesas", "Velocímetro falhando", "ABS atuando sem necessidade em baixa velocidade"],
        "explicacao": "Sujeira, oxidação ou fio rompido no sensor de roda é comum, principalmente após troca de rolamento/cubo ou serviço de suspensão. Como a velocidade do carro vem do ABS, pode aparecer P0500 junto.",
        "verificacoes": ["Ler os códigos do ABS na aba Módulos Kia", "Inspecionar o sensor e o chicote da roda indicada", "Verificar folga no rolamento"],
        "confianca": "media"
    }
]

FAIXAS = [
    {"prefixo": "P00", "sistema": "Motor - Medição de ar/combustível e emissões auxiliares", "severidade": "media"},
    {"prefixo": "P01", "sistema": "Motor - Medição de ar e combustível", "severidade": "media"},
    {"prefixo": "P02", "sistema": "Motor - Medição de combustível (injetores)", "severidade": "media"},
    {"prefixo": "P03", "sistema": "Motor - Ignição ou falha de combustão", "severidade": "alta"},
    {"prefixo": "P04", "sistema": "Emissões - Controles auxiliares", "severidade": "media"},
    {"prefixo": "P05", "sistema": "Velocidade, marcha lenta e entradas auxiliares", "severidade": "media"},
    {"prefixo": "P06", "sistema": "Central (ECU) e circuitos de saída", "severidade": "media"},
    {"prefixo": "P07", "sistema": "Transmissão", "severidade": "media"},
    {"prefixo": "P08", "sistema": "Transmissão", "severidade": "media"},
    {"prefixo": "P09", "sistema": "Transmissão", "severidade": "media"},
    {"prefixo": "P0A", "sistema": "Propulsão híbrida", "severidade": "baixa"},
    {"prefixo": "P0B", "sistema": "Propulsão híbrida", "severidade": "baixa"},
    {"prefixo": "P0C", "sistema": "Propulsão híbrida", "severidade": "baixa"},
    {"prefixo": "P1", "sistema": "Motor/transmissão - código do fabricante", "severidade": "media", "fabricante": "fabricante (não catalogado)"},
    {"prefixo": "P20", "sistema": "Motor - Combustível, ar e emissões", "severidade": "media"},
    {"prefixo": "P21", "sistema": "Motor - Borboleta, pedal e mistura", "severidade": "media"},
    {"prefixo": "P22", "sistema": "Motor - Sensores de emissões e barométrico", "severidade": "media"},
    {"prefixo": "P23", "sistema": "Motor - Ignição", "severidade": "alta"},
    {"prefixo": "P24", "sistema": "Emissões - EVAP, EGR e ar secundário", "severidade": "media"},
    {"prefixo": "P25", "sistema": "Controles auxiliares e sistema de carga", "severidade": "media"},
    {"prefixo": "P26", "sistema": "Central (ECU) e circuitos de saída", "severidade": "media"},
    {"prefixo": "P27", "sistema": "Transmissão", "severidade": "media"},
    {"prefixo": "P28", "sistema": "Transmissão", "severidade": "media"},
    {"prefixo": "P29", "sistema": "Motor - Combustível e ar (genérico)", "severidade": "media"},
    {"prefixo": "P2A", "sistema": "Motor - Combustível e ar (genérico)", "severidade": "media"},
    {"prefixo": "P30", "sistema": "Motor/transmissão - código do fabricante", "severidade": "media", "fabricante": "fabricante (não catalogado)"},
    {"prefixo": "P31", "sistema": "Motor/transmissão - código do fabricante", "severidade": "media", "fabricante": "fabricante (não catalogado)"},
    {"prefixo": "P32", "sistema": "Motor/transmissão - código do fabricante", "severidade": "media", "fabricante": "fabricante (não catalogado)"},
    {"prefixo": "P33", "sistema": "Motor/transmissão - código do fabricante", "severidade": "media", "fabricante": "fabricante (não catalogado)"},
    {"prefixo": "P34", "sistema": "Motor - Desativação de cilindros", "severidade": "baixa"},
    {"prefixo": "P35", "sistema": "Motor/transmissão - código do fabricante", "severidade": "media", "fabricante": "fabricante (não catalogado)"},
    {"prefixo": "P36", "sistema": "Motor/transmissão - código do fabricante", "severidade": "media", "fabricante": "fabricante (não catalogado)"},
    {"prefixo": "P37", "sistema": "Motor/transmissão - código do fabricante", "severidade": "media", "fabricante": "fabricante (não catalogado)"},
    {"prefixo": "P38", "sistema": "Motor/transmissão - código do fabricante", "severidade": "media", "fabricante": "fabricante (não catalogado)"},
    {"prefixo": "P39", "sistema": "Motor/transmissão - código do fabricante", "severidade": "media", "fabricante": "fabricante (não catalogado)"},
    {"prefixo": "C0", "sistema": "Chassi (genérico): freios, suspensão, direção", "severidade": "media"},
    {"prefixo": "C1", "sistema": "Chassi - código do fabricante (na Kia: ABS/ESC, direção)", "severidade": "media", "fabricante": "fabricante (não catalogado)"},
    {"prefixo": "C2", "sistema": "Chassi - código do fabricante (na Kia: ABS/ESC)", "severidade": "media", "fabricante": "fabricante (não catalogado)"},
    {"prefixo": "C3", "sistema": "Chassi (reservado/genérico)", "severidade": "media"},
    {"prefixo": "B0", "sistema": "Carroceria (genérico): airbag, conforto", "severidade": "media"},
    {"prefixo": "B1", "sistema": "Carroceria - código do fabricante (na Kia: airbag, BCM)", "severidade": "media", "fabricante": "fabricante (não catalogado)"},
    {"prefixo": "B2", "sistema": "Carroceria - código do fabricante", "severidade": "media", "fabricante": "fabricante (não catalogado)"},
    {"prefixo": "B3", "sistema": "Carroceria (reservado/genérico)", "severidade": "media"},
    {"prefixo": "U0", "sistema": "Rede de comunicação (genérico)", "severidade": "media"},
    {"prefixo": "U1", "sistema": "Rede de comunicação - código do fabricante", "severidade": "media", "fabricante": "fabricante (não catalogado)"},
    {"prefixo": "U2", "sistema": "Rede de comunicação - código do fabricante", "severidade": "media", "fabricante": "fabricante (não catalogado)"},
    {"prefixo": "U3", "sistema": "Rede de comunicação (genérico)", "severidade": "media"},
]

for f in FAIXAS:
    fab = "fabricante" in f
    f["descricao"] = (f"Código não catalogado neste banco. Pela numeração, é um código {'específico do fabricante' if fab else 'genérico'} "
                      f"da área: {f['sistema']}. Consulte o manual de serviço ou um scanner da marca para a descrição exata.")
    f["verificacoes"] = ["Ler de novo para confirmar o código (clones às vezes corrompem respostas)",
                         "Anotar o freeze frame e os demais códigos presentes",
                         "Consultar a descrição exata em fonte do fabricante antes de trocar peças"]
    f.setdefault("fabricante", "generico")

TEXTOS = {
    "nao_encontrado": "Código não encontrado no banco.",
    "sistema_desconhecido": "Sistema não identificado",
    "pode_rodar_desconhecido": "Sem informação para este código. Se o carro estiver funcionando normalmente, rode com cuidado até um diagnóstico.",
    "aviso_sem_entrada": "Este código não tem descrição exata no banco. O texto acima vem da faixa de numeração (SAE J2012). Confirme em uma fonte do fabricante antes de trocar peças.",
    "severidades": {
        "alta": {"rotulo": "Grave", "explicacao": "Pode causar dano ou risco. Resolva antes de rodar."},
        "media": {"rotulo": "Atenção", "explicacao": "Resolva logo; pode piorar consumo, emissões ou dirigibilidade."},
        "baixa": {"rotulo": "Leve", "explicacao": "Não costuma afetar a segurança; resolva quando possível."}
    }
}
