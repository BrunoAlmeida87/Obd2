# -*- coding: utf-8 -*-
"""Base do gerador do banco de códigos (dtc-db.json).

Cada código é definido como (codigo, chave_do_sistema, descricao_em_portugues).
O gerador completa severidade, "pode rodar?", causas comuns e verificações
a partir do sistema e do tipo de falha (palavras-chave da descrição).
Entradas detalhadas (detalhados.py) sobrescrevem os campos gerados.
"""

# ---------------------------------------------------------------------------
# Sistemas: rótulo, severidade padrão, "pode rodar?", causas e verificações típicas
# ---------------------------------------------------------------------------
NAO_APLICA = ("O Cerato 2014 brasileiro (motores Gamma 1.6 / Nu 2.0 aspirados, injeção indireta, flex) "
              "não tem este sistema. Se o código aparecer, confira se a leitura veio mesmo do seu carro "
              "(clones às vezes corrompem respostas) e leia de novo.")

S = {}

def sistema(chave, rotulo, sev, rodar, causas=(), verif=(), nota=""):
    S[chave] = dict(rotulo=rotulo, sev=sev, rodar=rodar, causas=list(causas), verif=list(verif), nota=nota)

RODAR_OK = "Pode rodar normalmente; resolva quando possível."
IMPROVAVEL = "Código improvável neste motor de 4 cilindros em linha: leia de novo para confirmar antes de tomar qualquer decisão."
RODAR_ATENCAO = "Pode rodar com cuidado, mas resolva logo: o consumo e as emissões podem piorar."
RODAR_EVITE = "Evite rodar até verificar: há risco de dano ao motor, ao catalisador ou de o carro apagar."
RODAR_CAMBIO = "Rode só o necessário: o câmbio pode entrar em modo de emergência (marcha fixa) e trancos podem desgastar embreagens internas."

sistema("comb_vol", "Motor - Alimentação de combustível", "media", RODAR_ATENCAO,
        ["Válvula ou regulador de combustível com defeito", "Pressão de combustível incorreta"],
        ["Medir a pressão de combustível com manômetro", "Verificar alimentação e terra do componente"])
sistema("vvt", "Motor - Comando variável (CVVT)", "media", RODAR_ATENCAO,
        ["Nível de óleo baixo ou óleo vencido/viscosidade errada", "Válvula OCV (solenoide do CVVT) travada ou com a tela (filtro) entupida",
         "Corrente de comando esticada ou fora de ponto", "Atuador (variador) do comando com defeito"],
        ["Conferir nível e data da troca de óleo (use a especificação do manual)", "Remover a OCV, limpar a tela e testar acionamento com 12 V",
         "Medir a resistência da OCV e comparar com o manual", "Comparar ao vivo ângulo de comando desejado x real com scanner avançado"])
sistema("o2h", "Motor - Aquecedor da sonda lambda", "media", RODAR_ATENCAO,
        ["Resistência de aquecimento da sonda queimada", "Fusível do aquecedor queimado", "Chicote da sonda derretido encostando no escapamento"],
        ["Medir a resistência do aquecedor nos terminais da sonda (normalmente poucos ohms)", "Verificar 12 V de alimentação do aquecedor com ignição ligada",
         "Inspecionar o chicote perto do escapamento"])
sistema("o2", "Motor - Sonda lambda", "media", RODAR_ATENCAO,
        ["Sonda lambda gasta ou contaminada (óleo, aditivo, combustível ruim)", "Vazamento no escapamento antes da sonda", "Mistura realmente pobre ou rica",
         "Chicote ou conector da sonda danificado"],
        ["Ver o sinal ao vivo: a sonda antes do catalisador deve oscilar entre ~0,1 e ~0,9 V com motor quente",
         "A sonda depois do catalisador costuma ficar mais estável (~0,6–0,8 V) se o catalisador estiver bom",
         "Procurar vazamentos no coletor/flexível de escape", "Verificar as correções de combustível (STFT/LTFT)"])
sistema("turbo", "Motor - Turbo/compressor", "baixa", RODAR_OK, [], [], NAO_APLICA)
sistema("ar_adm", "Motor - Medição de ar (MAF/MAP)", "media", RODAR_ATENCAO,
        ["Sensor sujo ou defeituoso", "Entrada falsa de ar (mangueira rachada, junta do coletor)", "Filtro de ar muito sujo", "Mangueira de vácuo do sensor MAP solta"],
        ["Comparar MAP ao vivo com a pressão barométrica (motor desligado e ignição ligada devem ser iguais)",
         "Em marcha lenta o MAP normalmente fica bem abaixo da pressão atmosférica", "Procurar vazamentos de vácuo com o motor funcionando"])
sistema("temp_ar", "Motor - Temperatura do ar de admissão", "baixa", RODAR_OK,
        ["Sensor de temperatura do ar defeituoso", "Conector do sensor (muitas vezes integrado ao MAP) oxidado"],
        ["Com motor frio, a temperatura do ar deve ser parecida com a ambiente", "Medir a resistência do sensor e comparar com a tabela do manual"])
sistema("temp_amb", "Sensor de temperatura ambiente", "baixa", RODAR_OK,
        ["Sensor de temperatura externa (geralmente atrás do para-choque) danificado", "Conector oxidado"],
        ["Conferir a leitura ao vivo com a temperatura real", "Inspecionar o sensor e o chicote atrás do para-choque dianteiro"])
sistema("ect", "Motor - Sensor de temperatura do motor", "media", "Pode rodar com cuidado, mas acompanhe o ponteiro de temperatura: a central pode usar valor fixo e ligar a ventoinha direto.",
        ["Sensor de temperatura do líquido de arrefecimento defeituoso", "Conector oxidado (vazamento de líquido)", "Nível baixo de líquido / ar no sistema"],
        ["Comparar a temperatura ao vivo com motor frio (deve ser próxima da ambiente)", "Verificar o nível e a mistura do líquido de arrefecimento",
         "Medir a resistência do sensor em duas temperaturas"])
sistema("tps", "Motor - Borboleta eletrônica / pedal do acelerador", "alta", "Rode só até um local seguro: o carro pode entrar em modo de emergência (potência limitada ou marcha lenta forçada).",
        ["Corpo de borboleta sujo (carvão/óleo do respiro)", "Sensor de posição da borboleta ou do pedal com defeito", "Conector do corpo de borboleta ou do pedal oxidado",
         "Chicote danificado"],
        ["Limpar o corpo de borboleta com produto próprio (motor desligado, sem forçar a borboleta com a ignição ligada)",
         "Depois de limpar ou desconectar a bateria, fazer o reaprendizado da borboleta (ignição ligada ~10 s sem acelerar, depois marcha lenta por alguns minutos)",
         "Ver ao vivo as posições de borboleta/pedal: os dois sinais devem andar juntos, sem saltos"])
sistema("mistura", "Motor - Mistura ar/combustível", "media", RODAR_ATENCAO,
        ["Entrada falsa de ar (mangueira do respiro/PCV, junta do coletor, servo-freio)", "Pressão de combustível baixa (bomba fraca, filtro/regulador)",
         "Bicos injetores sujos ou entupidos", "Sensor MAP/MAF ou sonda lambda com leitura errada", "Combustível adulterado ou com água"],
        ["Ver STFT/LTFT ao vivo: somados acima de +10% indicam mistura pobre; abaixo de −10%, rica",
         "Se a correção melhora ao acelerar, suspeite de entrada de ar; se piora, de falta de combustível",
         "Medir a pressão de combustível", "No flex, rode alguns km após abastecer para a central reaprender o teor de etanol"])
sistema("comb_temp", "Motor - Temperatura do combustível", "baixa", RODAR_OK,
        ["Sensor de temperatura do combustível defeituoso", "Chicote/conector"], ["Verificar o sensor e o chicote"])
sistema("comb_press", "Motor - Pressão de combustível", "media", RODAR_ATENCAO,
        ["Bomba de combustível fraca", "Filtro de combustível entupido", "Regulador de pressão com defeito", "Sensor de pressão defeituoso"],
        ["Medir a pressão de combustível com manômetro (motor funcionando e após desligar)", "Verificar a alimentação da bomba (relé e fusível)"])
sistema("comb_comp", "Motor - Composição do combustível (flex)", "baixa", RODAR_OK,
        ["Sensor de composição/etanol defeituoso (quando existir)", "Combustível fora de especificação"],
        ["Conferir o teor de etanol ao vivo (PID 52) após rodar alguns km"],
        "A maioria dos flex brasileiros estima o teor de etanol pela sonda lambda, sem sensor físico. Código de circuito do sensor é incomum no Cerato.")
sistema("oleo", "Motor - Temperatura do óleo", "media", RODAR_ATENCAO,
        ["Sensor de temperatura do óleo defeituoso", "Conector/chicote"], ["Verificar o sensor e comparar com a temperatura do motor"])
sistema("injetor", "Motor - Bicos injetores", "alta", RODAR_EVITE,
        ["Bico injetor com bobina aberta ou em curto", "Conector do bico solto/oxidado", "Chicote danificado (calor do motor)", "Driver do injetor na central com defeito (raro)"],
        ["Medir a resistência do bico (comparar com os demais)", "Testar o pulso do bico com caneta de polaridade ou osciloscópio",
         "Trocar o conector de posição com outro cilindro e ver se o erro acompanha"])
sistema("diesel", "Motor - Sistema diesel", "baixa", RODAR_OK, [], [], NAO_APLICA)
sistema("bomba_comb", "Motor - Bomba de combustível", "alta", "Evite rodar: o motor pode falhar ou apagar por falta de combustível.",
        ["Bomba de combustível desgastada", "Relé ou fusível da bomba", "Chicote/conector da bomba (sob o banco traseiro)", "Filtro/peneira da bomba entupido"],
        ["Ouvir se a bomba funciona ~2 s ao ligar a ignição", "Medir a tensão no conector da bomba", "Medir a pressão de combustível"])
sistema("superaq", "Motor - Superaquecimento / rotação excessiva", "alta", "Pare o carro em local seguro e desligue o motor. Rodar superaquecido pode empenar o cabeçote e danificar o motor.",
        ["Nível baixo de líquido de arrefecimento / vazamento", "Ventoinha do radiador não liga", "Termostato travado fechado", "Bomba d'água com defeito", "Radiador entupido"],
        ["Com motor FRIO, verificar o nível do reservatório e do radiador", "Ligar o ar-condicionado e ver se a ventoinha liga", "Procurar vazamentos e mangueiras ressecadas"])
sistema("misfire", "Motor - Ignição / falha de combustão", "alta", "Evite rodar, principalmente se a luz de injeção piscar: a falha de combustão superaquece e pode destruir o catalisador.",
        ["Vela de ignição gasta ou com folga incorreta", "Bobina de ignição defeituosa", "Bico injetor sujo ou com defeito", "Entrada falsa de ar",
         "Compressão baixa (válvula, anéis, junta do cabeçote)", "Combustível adulterado ou com água"],
        ["Trocar a bobina do cilindro com falha por outra e ver se o erro muda de cilindro", "Inspecionar as velas (cor, desgaste, folga) e o prazo de troca",
         "Fazer teste de compressão se as velas e bobinas estiverem boas", "Verificar bicos injetores e correções de combustível"])
sistema("detonacao", "Motor - Sensor de detonação", "media", "Pode rodar com cuidado e sem acelerar fundo: a central atrasa o ponto e o motor perde desempenho.",
        ["Sensor de detonação com defeito", "Sensor com torque de aperto errado", "Conector/chicote danificado", "Combustível de baixa octanagem ou adulterado",
         "Ruído mecânico real no motor"],
        ["Conferir o conector e o chicote do sensor (fica no bloco, sob o coletor de admissão)", "Verificar o torque de aperto do sensor conforme manual",
         "Abastecer em posto confiável e observar se o código volta"])
sistema("ckp", "Motor - Sensor de rotação (virabrequim)", "alta", "Evite rodar: o motor pode apagar em movimento ou não dar partida.",
        ["Sensor de rotação (CKP) defeituoso", "Roda fônica danificada ou suja", "Chicote/conector do sensor", "Folga incorreta entre sensor e roda fônica"],
        ["Inspecionar o sensor (sujeira metálica na ponta) e o conector", "Medir resistência/sinal do sensor com osciloscópio", "Verificar se a rotação ao vivo some durante a falha"])
sistema("cmp", "Motor - Sensor de fase (comando)", "media", RODAR_ATENCAO,
        ["Sensor de fase (CMP) defeituoso", "Chicote/conector", "Roda de sinal do comando danificada", "Corrente de comando fora de ponto"],
        ["Inspecionar conector e sensor", "Verificar alimentação e sinal do sensor", "Se houver códigos de CVVT juntos, verificar ponto da corrente"])
sistema("bobina", "Motor - Bobinas de ignição", "alta", RODAR_EVITE,
        ["Bobina de ignição com defeito", "Conector da bobina solto/oxidado", "Chicote de alimentação/comando danificado", "Vela muito gasta forçando a bobina"],
        ["Trocar a bobina de cilindro e ver se o código acompanha", "Verificar 12 V de alimentação e o sinal de comando", "Inspecionar as velas"])
sistema("egr", "Emissões - Recirculação de gases (EGR)", "media", RODAR_ATENCAO,
        ["Válvula EGR suja/travada", "Passagens de EGR obstruídas por carvão", "Sensor/atuador da EGR com defeito"],
        ["Verificar se o motor tem válvula EGR (consulte o manual)", "Limpar passagens e testar a válvula"],
        "Os motores Gamma/Nu aspirados normalmente não usam válvula EGR externa (a recirculação é feita pelo comando variável). Confira no manual antes de procurar a peça.")
sistema("ar_sec", "Emissões - Ar secundário", "baixa", RODAR_OK, [], [], NAO_APLICA)
sistema("catalisador", "Emissões - Catalisador", "media", "Pode rodar, mas o problema que causou o código (falha de ignição, consumo de óleo) pode piorar e o carro pode ser reprovado na inspeção.",
        ["Catalisador com baixa eficiência (velho, derretido ou contaminado)", "Falhas de ignição anteriores que superaqueceram o catalisador",
         "Consumo de óleo pelo motor", "Sonda lambda traseira lenta ou defeituosa", "Vazamento no escapamento"],
        ["Comparar ao vivo as sondas: a traseira deve oscilar bem menos que a dianteira", "Resolver antes qualquer código de falha de ignição ou mistura",
         "Procurar vazamentos de escape antes/depois do catalisador", "Verificar se o motor consome óleo"])
sistema("evap", "Emissões - Sistema evaporativo (canister/EVAP)", "baixa", "Pode rodar normalmente. Pode haver cheiro de combustível e dificuldade de partida depois de abastecer.",
        ["Tampa do tanque mal fechada ou com vedação ressecada", "Válvula de purga do canister (PCSV) travada ou com defeito", "Mangueiras do EVAP rachadas ou soltas",
         "Canister saturado (completar o tanque após a bomba desarmar)", "Válvula de respiro/fechamento do canister com defeito"],
        ["Conferir a tampa do tanque (fechar até estalar) e a borracha de vedação", "Inspecionar mangueiras do canister até o coletor de admissão",
         "Testar a válvula de purga: com motor desligado ela deve estar fechada (não deixar passar ar)", "Evitar completar o tanque depois do primeiro desarme da bomba"])
sistema("nivel_comb", "Painel - Sensor de nível de combustível", "baixa", RODAR_OK,
        ["Boia/sensor de nível (dentro do tanque) gasto", "Conector da bomba/sensor oxidado", "Chicote"],
        ["Comparar a leitura com o abastecimento real", "Verificar o conector sobre a bomba de combustível"])
sistema("escape", "Emissões - Pressão/temperatura de escape", "baixa", RODAR_OK, [], [], NAO_APLICA)
sistema("ventoinha", "Motor - Ventoinha do radiador", "alta", "Rode com cuidado olhando a temperatura: sem ventoinha o motor pode superaquecer no trânsito.",
        ["Relé ou fusível da ventoinha", "Motor da ventoinha travado ou queimado", "Resistor/módulo de velocidade da ventoinha", "Chicote/conector"],
        ["Ligar o ar-condicionado: a ventoinha deve funcionar", "Verificar fusíveis e relés da caixa do motor", "Medir 12 V no conector da ventoinha"])
sistema("velocidade", "Sensor de velocidade do veículo", "media", "Pode rodar, mas o velocímetro, o câmbio automático e o controle de tração podem funcionar mal.",
        ["Sensor de velocidade de roda (ABS) com defeito", "Falha de comunicação com o módulo ABS", "Chicote/conector do sensor"],
        ["Ler também os códigos do módulo ABS (aba Módulos Kia)", "Comparar a velocidade ao vivo com o velocímetro"],
        "No Cerato 2014 a velocidade normalmente vem dos sensores de roda do ABS pela rede CAN; códigos de velocidade costumam vir junto com códigos de ABS.")
sistema("marcha_lenta", "Motor - Controle de marcha lenta", "media", RODAR_ATENCAO,
        ["Corpo de borboleta sujo", "Entrada falsa de ar", "Borboleta não reaprendida após limpeza ou troca de bateria", "Carga elétrica alta / alternador"],
        ["Limpar o corpo de borboleta e fazer o reaprendizado", "Procurar vazamentos de vácuo", "Ver rotação de marcha lenta ao vivo com e sem carga (A/C, faróis)"])
sistema("imob", "Imobilizador / chave", "alta", "O carro pode não dar partida. Tente a chave reserva.",
        ["Chave (transponder) com defeito ou não programada", "Antena do imobilizador (anel no cilindro de ignição) com defeito", "Módulo do imobilizador (SMARTRA) ou comunicação com a ECU"],
        ["Testar com a chave reserva", "Verificar a bateria do carro (tensão baixa atrapalha a leitura da chave)", "Programação da chave exige equipamento de concessionária/chaveiro especializado"])
sistema("bateria", "Elétrica - Bateria / carga", "media", "Pode rodar, mas o carro pode não pegar na próxima partida. Verifique bateria e alternador.",
        ["Bateria fraca ou com sulfatação", "Alternador não carregando ou sobrecarregando", "Terminais da bateria frouxos/oxidados", "Correia do alternador patinando"],
        ["Medir a tensão: ~12,4–12,7 V com motor desligado e ~13,5–14,7 V com motor ligado", "Apertar e limpar os terminais da bateria",
         "Fazer teste de carga da bateria e do alternador"])
sistema("pressao_oleo", "Motor - Pressão do óleo", "alta", "Pare o motor imediatamente se a luz de óleo acender. Falta de pressão funde o motor em minutos.",
        ["Nível de óleo baixo", "Sensor/interruptor de pressão de óleo defeituoso", "Bomba de óleo ou pescador entupido", "Viscosidade do óleo incorreta"],
        ["Verificar o nível de óleo com o carro plano e motor desligado", "Medir a pressão com manômetro mecânico antes de trocar o sensor"])
sistema("cruise", "Piloto automático", "baixa", RODAR_OK,
        ["Interruptor/botões do volante", "Interruptor do pedal de freio", "Chicote (cinta do volante/clock spring)"],
        ["Testar o interruptor do pedal de freio (luz de freio funciona?)", "Verificar os botões do volante"])
sistema("ac", "Ar-condicionado", "baixa", RODAR_OK,
        ["Sensor de pressão do gás (transdutor) com defeito", "Carga de gás baixa ou vazamento", "Chicote/conector"],
        ["Verificar se o compressor arma", "Medir pressões com manômetro de A/C (oficina)"])
sistema("direcao", "Direção", "media", "Pode rodar com cuidado; a direção pode ficar pesada.",
        ["Sensor/atuador da direção", "Chicote/conector", "Módulo da direção elétrica (MDPS)"], ["Ler os códigos do módulo da direção, se acessível"])
sistema("freio", "Freio - Interruptor/servo", "media", "Pode rodar com cuidado; confira se as luzes de freio funcionam.",
        ["Interruptor do pedal de freio desregulado ou com defeito", "Chicote/conector", "Fusível das luzes de freio"],
        ["Pedir para alguém conferir as luzes de freio", "Ver o estado do interruptor do pedal de freio"])
sistema("ecu", "Módulo de controle (ECU/PCM)", "alta", "Pode haver falhas imprevisíveis. Verifique bateria e aterramentos antes de suspeitar da central.",
        ["Tensão de bateria baixa ou instável", "Aterramentos da central oxidados", "Software/calibração corrompido", "Central defeituosa (menos comum)"],
        ["Verificar bateria, terminais e aterramentos do motor/carroceria", "Apagar o código e ver se volta", "Atualização/reprogramação só em concessionária ou especialista"])
sistema("alternador", "Elétrica - Alternador", "media", "Pode rodar por pouco tempo: sem carga a bateria descarrega e o carro apaga.",
        ["Alternador ou regulador de tensão com defeito", "Chicote do alternador (fio de campo/lâmpada)", "Correia patinando", "Bateria muito fraca"],
        ["Medir tensão com motor ligado (13,5–14,7 V)", "Verificar conectores no alternador", "Inspecionar a correia"])
sistema("ref_5v", "Elétrica - Alimentação de referência dos sensores (5 V)", "alta", "Evite rodar: vários sensores podem ficar sem alimentação e o carro entrar em modo de emergência.",
        ["Sensor em curto puxando a linha de 5 V para baixo", "Chicote em curto com terra ou 12 V", "Central com defeito (raro)"],
        ["Desconectar sensores um a um (MAP, borboleta, pedal, pressão de A/C) e ver se a tensão de 5 V volta", "Inspecionar chicotes perto de partes quentes e móveis"])
sistema("rele_ecu", "Elétrica - Relé principal da central", "alta", "O motor pode apagar ou não ligar.",
        ["Relé principal com defeito", "Fusível", "Chicote/conector"], ["Trocar o relé por um igual da caixa de fusíveis e testar", "Verificar fusíveis principais"])
sistema("trans", "Transmissão automática - Geral", "media", RODAR_CAMBIO,
        ["Falha elétrica em sensor ou solenoide do câmbio", "Fluido do câmbio (ATF) vencido, baixo ou errado", "Falha de comunicação ECM/TCM", "Conector do câmbio oxidado"],
        ["Ler os códigos da central do câmbio (TCM, ECU 7E9)", "Verificar o nível e o estado do fluido (cor e cheiro de queimado)", "Inspecionar o conector principal do câmbio"])
sistema("trans_sensor", "Transmissão - Sensores", "media", RODAR_CAMBIO,
        ["Sensor com defeito", "Chicote/conector do câmbio", "Limalha metálica no sensor", "Fluido contaminado"],
        ["Inspecionar o conector e o sensor", "Medir resistência/sinal do sensor", "Verificar o fluido do câmbio"])
sistema("trans_solenoide", "Transmissão - Solenoides", "media", RODAR_CAMBIO,
        ["Solenoide com defeito (elétrico ou travado)", "Fluido do câmbio contaminado ou vencido", "Chicote interno/conector do câmbio", "Corpo de válvulas com desgaste"],
        ["Medir a resistência do solenoide no conector do câmbio", "Verificar nível e estado do fluido", "Diagnóstico completo exige scanner com acesso à TCM"])
sistema("trans_relacao", "Transmissão - Relação de marcha / patinação", "alta", RODAR_CAMBIO,
        ["Embreagens/freios internos patinando", "Pressão hidráulica baixa (fluido baixo, bomba)", "Solenoide ou corpo de válvulas com defeito", "Sensores de rotação com leitura errada"],
        ["Verificar o nível do fluido com o procedimento correto do manual", "Observar trancos ou rotação subindo sem o carro ganhar velocidade", "Levar a uma oficina especializada em câmbio automático"])
sistema("trans_conversor", "Transmissão - Embreagem do conversor de torque", "media", RODAR_CAMBIO,
        ["Solenoide da embreagem do conversor (TCC) com defeito", "Fluido vencido", "Desgaste interno do conversor"],
        ["Verificar o fluido", "Observar se a rotação oscila em velocidade constante na estrada"])
sistema("trans_amt", "Transmissão automatizada/embreagem", "baixa", RODAR_OK, [], [],
        "O Cerato 2014 tem câmbio manual ou automático convencional de 6 marchas; este código é de câmbio automatizado e normalmente não se aplica.")
sistema("embreagem", "Transmissão manual - Pedal de embreagem", "baixa", RODAR_OK,
        ["Interruptor do pedal de embreagem desregulado ou com defeito", "Chicote/conector"], ["Verificar o interruptor no pedal de embreagem"])
sistema("tracao", "Tração 4x4", "baixa", RODAR_OK, [], [], NAO_APLICA)
sistema("nox", "Emissões - Sensor de NOx / pós-tratamento", "baixa", RODAR_OK, [], [], NAO_APLICA)
sistema("admissao_var", "Motor - Coletor de admissão variável", "media", RODAR_ATENCAO,
        ["Atuador/solenoide do coletor variável", "Mangueira de vácuo", "Chicote/conector"],
        ["Verificar se o motor tem coletor variável (o Nu 2.0 pode ter; confira no manual)", "Testar o atuador"])
sistema("carga_sist", "Elétrica - Entradas da central", "media", RODAR_ATENCAO,
        ["Chicote/conector", "Interruptor ou sinal de outro módulo com defeito", "Tensão de bateria"],
        ["Verificar o circuito indicado", "Verificar bateria e aterramentos"])
sistema("desativacao", "Motor - Desativação de cilindros", "baixa", RODAR_OK, [], [], NAO_APLICA)
sistema("rede", "Rede de comunicação (CAN)", "media", "Pode rodar se o carro estiver normal, mas sistemas como ABS, câmbio e painel podem ficar sem informação.",
        ["Conector de algum módulo solto ou oxidado", "Fios da rede CAN rompidos ou em curto", "Módulo sem alimentação ou terra (fusível)", "Bateria fraca/tensão instável durante a partida",
         "Módulo com defeito"],
        ["Verificar a bateria (códigos U aparecem muito após partida com bateria fraca)", "Apagar e ver se volta", "Medir ~60 Ω entre CAN-H e CAN-L na tomada OBD (pinos 6 e 14) com bateria desligada",
         "Verificar fusíveis do módulo citado"])
sistema("abs", "Freios - ABS / ESC", "media", "Os freios comuns continuam funcionando, mas o ABS e o controle de estabilidade podem estar desligados. Dirija com mais cuidado, principalmente na chuva.",
        ["Sensor de velocidade de roda sujo, danificado ou com folga", "Anel/roda fônica do cubo danificado", "Chicote do sensor rompido (perto da roda)", "Bateria/alimentação do módulo",
         "Módulo ABS/ESC com defeito"],
        ["Inspecionar o sensor de roda e o chicote (sujeira, fio rompido)", "Verificar o rolamento/cubo da roda (folga)", "Comparar a velocidade das 4 rodas com scanner que acesse o ABS"])
sistema("srs", "Airbag (SRS)", "alta", "Pode rodar, mas o airbag e os pré-tensionadores podem NÃO funcionar numa batida. Leve a um especialista.",
        ["Conector do airbag ou do pré-tensionador solto (embaixo dos bancos)", "Cinta do volante (clock spring) com defeito", "Chicote danificado", "Módulo do airbag com defeito",
         "Colisão registrada (exige troca do módulo)"],
        ["NUNCA mexa em conectores do airbag com a ignição ligada ou sem desligar a bateria e esperar alguns minutos",
         "Verificar conectores amarelos embaixo dos bancos (comum após mexer nos bancos)", "Diagnóstico e reparo por profissional"])
sistema("carroceria", "Carroceria / conforto", "baixa", RODAR_OK,
        ["Chicote/conector", "Componente defeituoso", "Módulo da carroceria (BCM)"], ["Verificar o componente citado e seus fusíveis"])
sistema("hibrido", "Sistema híbrido/elétrico", "baixa", RODAR_OK, [], [], NAO_APLICA)
sistema("reservado", "Reservado / sem uso", "baixa", RODAR_OK, [], [],
        "Código reservado pela norma ou sem uso definido. Se aparecer, pode ser leitura corrompida: leia de novo.")
sistema("pcv", "Motor - Ventilação do cárter / respiro", "baixa", RODAR_ATENCAO,
        ["Mangueira do respiro (PCV) rachada ou solta", "Válvula PCV com defeito"], ["Inspecionar mangueiras do respiro do cárter"])

# ---------------------------------------------------------------------------
# Tipos de falha (inferidos pela descrição) -> causas e verificações elétricas
# ---------------------------------------------------------------------------
TIPOS = [
    ("baixo", ["sinal baixo", "tensão baixa", "entrada baixa", "circuito baixo", "corrente baixa"],
     ["Fio de sinal em curto com o terra (massa)", "Componente defeituoso", "Conector solto, oxidado ou com terminal frouxo"],
     ["Medir tensão e sinal no conector com multímetro (ignição ligada)", "Procurar fio descascado encostando na carroceria ou no motor"]),
    ("alto", ["sinal alto", "tensão alta", "entrada alta", "circuito alto", "corrente alta"],
     ["Fio de sinal aberto ou em curto com tensão (5 V/12 V)", "Terra (massa) do componente interrompido", "Componente defeituoso"],
     ["Verificar continuidade do sinal e do terra até a central", "Inspecionar o conector (terminais frouxos/oxidados)"]),
    ("aberto", ["aberto"],
     ["Fio rompido no chicote", "Conector desencaixado ou com terminal frouxo", "Componente com bobina/elemento interno aberto", "Fusível ou relé de alimentação"],
     ["Medir a resistência do componente e a continuidade do chicote", "Verificar fusíveis e relés do circuito"]),
    ("interm", ["intermitente", "irregular"],
     ["Mau contato no conector", "Chicote roçando com isolamento danificado", "Aterramento ruim", "Componente com falha intermitente (calor/vibração)"],
     ["Mexer no chicote e no conector com o motor ligado observando os dados ao vivo", "Limpar e apertar os terminais do conector"]),
    ("travado", ["travad"],
     ["Componente travado (sujeira, verniz, desgaste)", "Problema hidráulico ou mecânico", "Falha elétrica do componente"],
     ["Testar o acionamento do componente", "Verificar fluido/óleo do sistema"]),
    ("correl", ["correlação", "trocados"],
     ["Um dos sensores fora de calibração", "Resistência elevada em conector ou chicote", "Problema mecânico no sistema monitorado"],
     ["Comparar ao vivo os dois sinais citados", "Inspecionar conectores dos dois sensores"]),
    ("semsinal", ["sem sinal", "sem atividade", "sem pulsos", "não detectad"],
     ["Sensor defeituoso", "Fio de sinal rompido", "Conector desligado", "Roda de sinal danificada ou folga incorreta"],
     ["Verificar alimentação e sinal do sensor", "Inspecionar conector e chicote"]),
    ("desemp", ["faixa/desempenho", "desempenho", "lenta", "abaixo do limite", "fora da faixa"],
     ["Componente desgastado ou fora de calibração", "Problema real no sistema monitorado (vazamento, obstrução, sujeira)", "Resistência elevada no circuito"],
     ["Comparar o valor ao vivo com o esperado", "Verificar o sistema mecânico relacionado antes de trocar o sensor"]),
    ("circuito", ["circuito", "mau funcionamento"],
     ["Chicote aberto ou em curto", "Conector solto ou oxidado", "Componente defeituoso", "Fusível/relé de alimentação"],
     ["Verificar o conector e o chicote do componente", "Medir alimentação, terra e sinal"]),
]

def tipo_falha(desc):
    d = desc.lower()
    for nome, chaves, causas, verif in TIPOS:
        if any(k in d for k in chaves):
            return nome, causas, verif
    return "geral", [], []

def unicos(lista, limite):
    vistos, saida = set(), []
    for x in lista:
        if x not in vistos:
            vistos.add(x)
            saida.append(x)
    return saida[:limite]

def montar(codigo, chave, descricao, extra=None):
    s = S[chave]
    nome_tipo, causas_tipo, verif_tipo = tipo_falha(descricao)
    eletrico = nome_tipo in ("baixo", "alto", "aberto", "interm", "circuito", "semsinal")
    if eletrico:
        causas = causas_tipo + s["causas"]
        verif = verif_tipo + s["verif"]
    else:
        causas = s["causas"] + causas_tipo
        verif = s["verif"] + verif_tipo
    sev = s["sev"]
    rodar = s["rodar"]
    nota = s["nota"]
    # códigos de banco 2 / cilindros 5+ não existem no 4 cilindros em linha
    d = descricao.lower()
    if s["nota"] != NAO_APLICA and ("banco 2" in d) and "banco 1" not in d:
        nota = "O motor do Cerato é 4 cilindros em linha e tem só o banco 1. Código de banco 2 é improvável neste carro: leia de novo."
        sev = "baixa" if sev != "alta" else "media"
        rodar = IMPROVAVEL
    for n in range(5, 13):
        if f"cilindro {n}" in d and "cilindros" not in d:
            nota = "O motor do Cerato tem 4 cilindros; código de cilindro acima de 4 é improvável neste carro: leia de novo."
            sev = "baixa"
            rodar = IMPROVAVEL
    if not causas:
        causas = ["Sistema não usado neste veículo — possível leitura incorreta"]
    if not verif:
        verif = ["Ler os códigos de novo para confirmar", "Se persistir, procurar oficina com scanner do fabricante"]
    e = {
        "codigo": codigo,
        "sistema": s["rotulo"],
        "descricao": descricao,
        "severidade": sev,
        "pode_rodar": rodar,
        "causas_comuns": unicos(causas, 6),
        "verificacoes": unicos(verif, 6),
        "notas_cerato": nota,
        "fabricante": "generico",
        "confianca": "alta",
        "fonte": "SAE J2012 / ISO 15031-6 (descrição traduzida e adaptada)"
    }
    if extra:
        e.update(extra)
    return e

# ---------------------------------------------------------------------------
# Ajudantes para séries de códigos
# ---------------------------------------------------------------------------
def hx(n):
    return "%04d" % n

def serie(prefixo, inicio, chave, base, sufixos):
    """Gera códigos consecutivos: base + sufixo. inicio é inteiro (ex.: 110)."""
    out = []
    for i, suf in enumerate(sufixos):
        out.append((prefixo + hx(inicio + i), chave, f"{base} — {suf}" if suf else base))
    return out

# sufixos padrão
C5 = ["mau funcionamento do circuito", "faixa/desempenho", "sinal baixo no circuito", "sinal alto no circuito", "circuito intermitente/irregular"]
C4 = ["mau funcionamento do circuito", "faixa/desempenho", "sinal baixo no circuito", "sinal alto no circuito"]
CTRL3 = ["circuito de controle aberto", "circuito de controle com sinal baixo", "circuito de controle com sinal alto"]
CTRL4 = ["circuito de controle aberto", "circuito de controle — faixa/desempenho", "circuito de controle com sinal baixo", "circuito de controle com sinal alto"]
SOL5 = ["mau funcionamento", "desempenho ou travado desligado", "travado ligado", "falha elétrica", "circuito intermitente"]
VEL4 = ["mau funcionamento do circuito", "faixa/desempenho", "sem sinal", "circuito intermitente"]
