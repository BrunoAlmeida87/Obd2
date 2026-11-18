# Cerato OBD2 — diagnóstico para Kia Cerato 2014 com ELM327 Bluetooth

Web app (PWA) próprio, **sem anúncios e sem paywall**, para ler e apagar códigos de erro, ver dados ao vivo e entender os problemas em português. Feito para o **Kia Cerato 2014 brasileiro (flex)** com adaptador **ELM327 Mini Bluetooth** e **Chrome no Android** (testado como alvo: Galaxy S22).

> **Motor e câmbio:** o app atende o **1.6 Gamma** e o **2.0 Nu**, com câmbio **automático ou manual de 6 marchas**. Informe a sua versão em **Mais › Configurações › Veículo**: ela aparece no relatório e filtra os problemas típicos na Ajuda.

## O que o app faz

| Área | Recursos |
|---|---|
| Conexão | Bluetooth clássico (SPP) via **Web Serial**; adaptadores **BLE** (FFE0/FFF0/18F0) via **Web Bluetooth**; detecção de navegador sem suporte (“Abra no Chrome”); **modo demonstração** com simulador |
| ELM327 | Fila estritamente sequencial (lê até o `>`), timeout e repetição configuráveis, init `ATZ ATE0 ATL0 ATS0 ATH1 ATAT1`, `ATSP6` primeiro e `ATSP0`+`ATDPN` como alternativa, `ATI`, `AT@1`, `ATRV`, tratamento de `SEARCHING…`, `NO DATA`, `?`, `CAN ERROR`, `BUS INIT…ERROR`, `UNABLE TO CONNECT`, `BUFFER FULL`, `STOPPED`, `<RX ERROR`, eco e lixo; **ISO-TP multi-frame** agrupado por ECU; modo compatibilidade para clones (nunca usa `ATAT2`) |
| OBD2 | Modo 01 (descoberta de PIDs 00–C0, MIL, DTCs, **monitores de prontidão**), 02 (freeze frame), 03/07/0A (armazenados/pendentes/permanentes), 04 (apagar com dupla confirmação, só com motor desligado), 09 (VIN, CALID, CVN) |
| Módulos Kia (experimental) | UDS `19 02 FF` (com `10 01`/`10 03` e TesterPresent `3E 00`) e KWP2000 `18 02 FF 00`, via `ATSH`/`ATCRA`/`ATFCSH`; tradução de NRC (`7F xx yy`, inclusive `78` = resposta pendente); **varredura de módulos 7xx**; tabela de endereços editável; apagar ABS/SRS **desativado por padrão** |
| Ao vivo | PIDs escolhidos pelo usuário (só os suportados), taxa adaptativa, medidores, lista e gráfico, **modo painel em paisagem**, gravação com CSV, alertas configuráveis, tela sempre ligada (Wake Lock) |
| Banco de códigos | `data/dtc-db.json` em pt-BR: **1.914 códigos** (P0, P2, P34xx, U0, C0/B0 e de fabricante Hyundai/Kia com nível de confiança), problemas conhecidos do Cerato e textos de faixa para códigos não catalogados |
| Histórico | IndexedDB com data, km, códigos, freeze frame e VIN; comparação (novos, sumiram, voltaram depois de apagados); backup/importação JSON; CSV; **relatório HTML imprimível** (salve como PDF pelo Chrome) |
| Terminal | Comandos AT/OBD manuais, log TX/RX com horário, copiar e baixar log |

## Passo a passo

### 1. Parear o ELM327 no Android (uma vez)

1. Encaixe o ELM327 na tomada OBD (embaixo do painel, lado do motorista) e **ligue a ignição**.
2. Android › **Configurações › Conexões › Bluetooth** › procurar dispositivos.
3. Escolha “OBDII” (ou “OBD2”, “V-LINK”) e digite o PIN **1234** (se não funcionar, **0000** ou 6789).
4. Pronto: o app só enxerga adaptadores **já pareados**.

> O ELM327 Mini azul “v2.1” é Bluetooth **clássico (SPP)**, que precisa do **Chrome para Android 117 ou mais novo** (Web Serial). Não funciona no Samsung Internet nem no Firefox: lá só o modo demo funciona.

### 2. Publicar no GitHub Pages

O repositório já vem com o workflow `.github/workflows/pages.yml`, que valida os dados, roda os testes e publica a raiz do repositório.

1. No GitHub: **Settings › Pages › Build and deployment › Source: GitHub Actions** (já ativado neste repositório).
2. Faça push para `main` (ou para o branch configurado no workflow). A aba **Actions** mostra o deploy.
3. O endereço fica em `https://<usuario>.github.io/<repositorio>/`, por exemplo `https://brunoalmeida87.github.io/Obd2/`.

O Bluetooth só funciona em **HTTPS**, por isso o GitHub Pages é o caminho mais simples e gratuito.

### 3. Abrir no Chrome e conectar

1. Abra o endereço no **Chrome** do celular.
2. Aba **Início › Conectar** › escolha o adaptador na lista do Chrome.
3. O app mostra versão do ELM, protocolo, tensão da bateria, VIN e estado da luz de injeção.
4. Toque em **Ler erros**. Informe o km do painel (opcional) para o histórico.

Se o adaptador não aparecer: **Mais › Configurações › Mostrar todos os dispositivos**. Se responder mal: ative o **Modo compatibilidade** e aumente o timeout.

### 4. Instalar como app

No Chrome: menu **⋮ › Instalar app** (ou “Adicionar à tela inicial”). Depois da primeira abertura, o app funciona **offline** (service worker).

## Uso rápido

- **Erros:** cartões coloridos por gravidade (vermelho = grave, amarelo = atenção, azul = leve). Toque para ver causas, verificações, notas do Cerato, problemas conhecidos e o freeze frame.
- **Apagar códigos:** botão no rodapé da aba Erros. Pede duas confirmações, avisa que **zera os monitores de prontidão** (afeta a inspeção veicular) e só funciona com **motor desligado e ignição ligada**.
- **Ao vivo:** escolha os PIDs em “PIDs” (menos PIDs = mais rápido). Vire o celular para o **modo painel**. “Gravar” salva a sessão no Histórico e exporta CSV. Alertas padrão: temperatura do motor > 105 °C e bateria < 12,0 V (edite em Configurações).
- **Flex:** acompanhe o **teor de etanol (PID 52)** e as correções de combustível (STFT/LTFT) depois de abastecer.
- **Mais › Varredura de módulos:** descobre quais endereços respondem no seu carro. Use o resultado para ajustar a tabela de módulos.
- **Modo demo:** testa todas as telas sem o carro (Mais › Modo demonstração). Para testar o apagamento, desligue o “motor” simulado.

## Arquitetura

HTML, CSS e JavaScript puros (ES modules), sem build e sem backend. Nenhuma dependência de CDN: ícones em SVG inline e gráfico em canvas próprio.

```
index.html, manifest.webmanifest, sw.js   PWA (instalável, offline)
css/app.css                               tema escuro/claro, mobile-first
js/app.js                                 estado, conexão, navegação entre abas
js/transport/base.js                      interface comum open/write/read/close
js/transport/serial-bt.js                 Web Serial (Bluetooth SPP/RFCOMM)
js/transport/ble.js                       Web Bluetooth (BLE)
js/transport/simulator.js                 simulador de ELM327 + carro (modo demo)
js/elm327.js                              fila, inicialização, limpeza de respostas, ISO-TP
js/obd.js                                 modos 01–0A e decodificação de PIDs/DTCs
js/kia.js                                 UDS/KWP2000, endereços, NRC, varredura
js/storage.js                             IndexedDB (leituras, sessões, configuração)
js/settings.js, js/dtcdb.js, js/util.js   configuração, consulta ao banco, utilidades
js/ui/*.js                                telas (início, erros, ao vivo, histórico, mais), medidor, gráfico, relatório
data/pids.json                            tabela declarativa de PIDs (pid, bytes, fórmula, unidade, mín., máx.)
data/dtc-db.json                          banco de códigos em pt-BR (gerado)
tools/dtc/*.py                            gerador do banco de códigos
tools/test/                               testes do núcleo (Node) e de ponta a ponta (Playwright)
```

Nenhuma descrição de código de erro fica no código-fonte: tudo vem de `data/dtc-db.json`.

## Banco de códigos

O arquivo `data/dtc-db.json` é gerado por `tools/dtc/gerar.py` (Python 3, sem dependências):

```bash
python3 tools/dtc/gerar.py
```

- **Genéricos (SAE J2012 / ISO 15031-6):** 995 dos 1.000 números de P0000–P0999 (P0395–P0399 são reservados pela norma), 687 números de P2000–P2999, P3400–P3497, U0 de rede e alguns C0/B0. Os números da faixa P2 que não têm entrada são reservados ou não foram incluídos por falta de fonte confiável; para eles o app mostra a descrição **da faixa** (também em português, vinda do arquivo de dados) e avisa que não há descrição exata.
- **Hyundai/Kia:** P1xxx, ABS/ESC (C1xxx/C2xxx) e airbag (B1xxx) com campo `"confianca"` (`media` ou `baixa`) e `"fonte"`. **Nenhum foi verificado contra o manual de serviço do Cerato 2014 brasileiro**, por isso nenhum tem confiança “alta”. Na dúvida o código ficou de fora.
- **Problemas conhecidos do Cerato 2014:** falhas de ignição/bobinas, CVVT, termostato, catalisador, sondas, EVAP/canister, corpo de borboleta, sensores e solenoides do câmbio automático, detonação, mistura pobre/rica e partida a frio no flex, bateria/comunicação e sensores de roda do ABS.

Formato de cada entrada:

```json
{
  "codigo": "P0301",
  "sistema": "Motor - Ignição / falha de combustão",
  "descricao": "Falha de ignição detectada no cilindro 1",
  "severidade": "alta",
  "pode_rodar": "Evite rodar, principalmente se a luz de injeção piscar…",
  "causas_comuns": ["Vela de ignição gasta…", "Bobina do cilindro 1 defeituosa…"],
  "verificacoes": ["Trocar a bobina do cilindro 1 com a de outro cilindro…"],
  "notas_cerato": "Comum nos motores Gamma 1.6 e Nu 2.0…",
  "fabricante": "generico",
  "confianca": "alta",
  "fonte": "SAE J2012 / ISO 15031-6 (descrição traduzida e adaptada)"
}
```

As descrições são orientativas. Confirme o diagnóstico com testes antes de trocar peças.

## Testes

```bash
npm test                      # núcleo: simulador → ELM327 → ISO-TP → OBD → módulos Kia (Node 20+)
python3 -m http.server 8765   # em outro terminal
npm run e2e                   # ponta a ponta no modo demo (precisa do Playwright + Chromium)
```

Os testes do núcleo rodam também no workflow, antes de cada publicação. O teste de ponta a ponta cobre: conectar no demo, ler erros (multi-frame de duas ECUs), detalhe com freeze frame, módulos Kia (UDS, KWP, resposta pendente), recusa de apagar com motor ligado, apagamento com motor desligado, ao vivo com gravação e CSV, histórico com comparação, backup, relatório, terminal, varredura, configurações, busca na ajuda, persistência após recarregar e funcionamento offline.

## Segurança

- Apagar códigos (modo 04) exige confirmação dupla e motor desligado; o app avisa que os monitores de prontidão serão zerados.
- Apagar códigos de **ABS/ESC e airbag** fica **desativado por padrão**; liberar exige aceitar um aviso forte em Configurações. Nunca apague código de colisão registrada no airbag.
- O terminal envia comandos direto ao carro; o comando `04` pede confirmação.

## Referências e licenças

- Datasheet do ELM327 (ELM Electronics): comandos AT, mensagens de erro e formato das respostas.
- SAE J1979 / ISO 15031-5 (modos e PIDs) e SAE J2012 / ISO 15031-6 (códigos de erro), ISO 15765-2 (ISO-TP), ISO 14229 (UDS) e ISO 14230 (KWP2000).
- O projeto **AndrOBD** (github.com/fr3ts0n/AndrOBD, GPL-3.0) foi usado só como referência conceitual. **Nenhum código foi copiado dele** nem de outro projeto; todo o código deste repositório é original.

Este repositório não declara uma licença; escolha uma (por exemplo MIT) se quiser permitir que outras pessoas reutilizem o código.
