/* Camada ELM327: fila de comandos, inicialização, limpeza de respostas e ISO-TP.
 * Referência: datasheet ELM327 (ELM Electronics). Implementação própria.
 *
 * Regras importantes para clones:
 *  - nunca enviar dois comandos ao mesmo tempo (fila estritamente sequencial);
 *  - só considerar a resposta completa quando chegar o prompt '>';
 *  - descartar eco, bytes nulos e lixo; tratar mensagens especiais (NO DATA, CAN ERROR...). */

export const ERROS_ELM = [
  { re: /^NO DATA$/, codigo: 'NO_DATA', msg: 'A ECU não respondeu a este pedido (função não suportada ou ignição desligada).', repetir: false },
  { re: /^UNABLE TO CONNECT$/, codigo: 'UNABLE', msg: 'O adaptador não conseguiu falar com o carro. Verifique se a ignição está ligada.', repetir: false },
  { re: /^CAN ERROR$/, codigo: 'CAN_ERROR', msg: 'Erro no barramento CAN. Confira o encaixe do adaptador na tomada OBD e se a ignição está ligada.', repetir: true },
  { re: /^BUS INIT.*ERROR$/, codigo: 'BUS_INIT', msg: 'Falha ao iniciar o barramento de diagnóstico.', repetir: true },
  { re: /^BUS BUSY$/, codigo: 'BUS_BUSY', msg: 'Barramento ocupado. Tente novamente.', repetir: true },
  { re: /^BUS ERROR$/, codigo: 'BUS_ERROR', msg: 'Erro elétrico no barramento.', repetir: true },
  { re: /^FB ERROR$/, codigo: 'FB_ERROR', msg: 'Erro de realimentação no barramento (problema de fiação ou adaptador).', repetir: true },
  { re: /^<?DATA ERROR>?/, codigo: 'DATA_ERROR', msg: 'Dados corrompidos na resposta.', repetir: true },
  { re: /^BUFFER FULL$/, codigo: 'BUFFER_FULL', msg: 'Buffer do adaptador cheio (clone lento). Ative o modo compatibilidade.', repetir: true },
  { re: /^STOPPED$/, codigo: 'STOPPED', msg: 'Comando interrompido pelo adaptador.', repetir: true },
  { re: /^<RX ERROR/, codigo: 'RX_ERROR', msg: 'Erro de recepção de dados.', repetir: true },
  { re: /^ERR\d+/, codigo: 'ERR_INTERNO', msg: 'Erro interno do adaptador.', repetir: true },
  { re: /^LV RESET$/, codigo: 'LV_RESET', msg: 'O adaptador reiniciou por tensão baixa. Verifique a bateria.', repetir: true },
  { re: /^(ACT|LP) ALERT$/, codigo: 'ALERT', msg: 'O adaptador entrou em modo de economia de energia.', repetir: true },
  { re: /^\?$/, codigo: 'DESCONHECIDO', msg: 'Comando não reconhecido pelo adaptador.', repetir: false }
];

export const ERRO_TIMEOUT = { codigo: 'TIMEOUT', msg: 'O adaptador não respondeu. Verifique se a ignição está ligada e se o adaptador está pareado.' };

export const PROTOCOLOS = {
  0: 'Automático', 1: 'SAE J1850 PWM (41.6 kbps)', 2: 'SAE J1850 VPW (10.4 kbps)', 3: 'ISO 9141-2 (5 baud init)',
  4: 'ISO 14230-4 KWP (5 baud init)', 5: 'ISO 14230-4 KWP (fast init)', 6: 'ISO 15765-4 CAN (11 bit, 500 kbps)',
  7: 'ISO 15765-4 CAN (29 bit, 500 kbps)', 8: 'ISO 15765-4 CAN (11 bit, 250 kbps)', 9: 'ISO 15765-4 CAN (29 bit, 250 kbps)',
  10: 'SAE J1939 CAN (29 bit, 250 kbps)', 11: 'USER1 CAN', 12: 'USER2 CAN'
};

const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const agora = () => new Date();

export class Elm327 {
  constructor(transporte, opcoes = {}) {
    this.t = transporte;
    this.opc = {
      timeout: 2500,       // ms aguardando o prompt '>'
      tentativas: 2,       // repetições em caso de erro recuperável
      compat: false,       // modo compatibilidade para clones
      atrasoCompat: 120,   // pausa entre comandos no modo compatibilidade
      ...opcoes
    };
    this._fila = Promise.resolve();
    this._pendentes = 0;
    this._ouvintes = {};
    this.info = { versao: '', dispositivo: '', protocolo: '', protocoloNum: null, tensao: null };
    this.cabecalhoAtual = '7DF';
    this.filtroAtual = null;
  }

  // ------------------------------------------------------------ eventos
  on(evento, fn) { (this._ouvintes[evento] ||= []).push(fn); return () => this.off(evento, fn); }
  off(evento, fn) { this._ouvintes[evento] = (this._ouvintes[evento] || []).filter((f) => f !== fn); }
  _emit(evento, dados) { (this._ouvintes[evento] || []).forEach((fn) => { try { fn(dados); } catch (e) { console.error(e); } }); }
  _log(dir, texto) { this._emit('log', { dir, texto, ts: agora() }); }

  get ocupado() { return this._pendentes > 0; }
  get pendentes() { return this._pendentes; }

  /** Coloca uma função na fila; ela só roda quando a anterior terminar. */
  enfileirar(fn) {
    this._pendentes++;
    const p = this._fila.then(fn, fn);
    this._fila = p.catch(() => {}).finally(() => { this._pendentes--; });
    return p;
  }

  /**
   * Envia um comando pela fila e devolve { cmd, linhas, erro, bruto }.
   * opcoes: { timeout, tentativas }
   */
  comando(cmd, opcoes = {}) {
    return this.enfileirar(async () => {
      if (opcoes.alvo) await this._garantirAlvo(opcoes.alvo);
      return this._executarComRetry(cmd, opcoes);
    });
  }

  async _executarComRetry(cmd, opcoes) {
    const tentativas = opcoes.tentativas ?? this.opc.tentativas;
    let r = null;
    for (let i = 0; i <= tentativas; i++) {
      if (i > 0) {
        this._log('ev', `Repetindo "${cmd}" (tentativa ${i + 1})`);
        await espera(this.opc.compat ? 300 : 100);
      }
      r = await this._executar(cmd, opcoes.timeout ?? this.opc.timeout);
      if (!r.erro) break;
      const recuperavel = r.erro.codigo === 'TIMEOUT' || r.erro.repetir;
      if (!recuperavel) break;
    }
    return r;
  }

  /** Executa um único comando: escreve, lê até o '>' e limpa a resposta. */
  async _executar(cmd, timeout) {
    if (!this.t?.aberto) return { cmd, linhas: [], erro: { codigo: 'DESCONECTADO', msg: 'Adaptador desconectado.' }, bruto: '' };
    if (this.opc.compat) await espera(this.opc.atrasoCompat);
    this.t.limparEntrada();
    this._log('tx', cmd);
    try {
      await this.t.write(cmd + '\r');
    } catch (e) {
      this._log('er', 'Falha ao enviar: ' + e.message);
      return { cmd, linhas: [], erro: { codigo: 'ESCRITA', msg: 'Não foi possível enviar ao adaptador: ' + e.message }, bruto: '' };
    }
    let bruto = '';
    const limite = Date.now() + timeout;
    while (Date.now() < limite) {
      const parte = await this.t.read(Math.max(10, limite - Date.now()));
      if (parte) bruto += parte;
      if (bruto.includes('>')) break;
      if (!this.t.aberto) break;
    }
    const completo = bruto.includes('>');
    const textoLog = bruto.replace(/\x00/g, '').replace(/[\r\n]+/g, ' | ').replace(/>/g, '').trim();
    if (textoLog) this._log('rx', textoLog);

    if (!completo) {
      this._log('er', `Sem prompt '>' após ${timeout} ms`);
      // tenta destravar o adaptador: qualquer caractere interrompe o comando atual
      try {
        await this.t.write('\r');
        const lim2 = Date.now() + 600;
        let lixo = '';
        while (Date.now() < lim2 && !lixo.includes('>')) lixo += await this.t.read(lim2 - Date.now());
      } catch { /* ignora */ }
      const linhas = this.limparResposta(bruto, cmd);
      return { cmd, linhas, erro: { ...ERRO_TIMEOUT, repetir: true }, bruto };
    }

    const linhas = this.limparResposta(bruto, cmd);
    const erro = this.detectarErro(linhas);
    if (erro) this._log(erro.codigo === 'NO_DATA' ? 'ev' : 'er', erro.msg);
    return { cmd, linhas: erro ? linhas.filter((l) => !erro.re.test(l)) : linhas, erro, bruto };
  }

  /** Remove eco, prompt, nulos, "SEARCHING..." e linhas vazias. */
  limparResposta(bruto, cmd) {
    const semEspacoCmd = (cmd || '').replace(/\s+/g, '').toUpperCase();
    return bruto
      .replace(/[^\x20-\x7e\r\n]/g, '') // lixo binário de clones
      .replace(/>/g, '')
      .split(/[\r\n]+/)
      .map((l) => l.trim())
      .filter((l) => l.length > 0)
      .filter((l) => l.replace(/\s+/g, '').toUpperCase() !== semEspacoCmd) // eco
      .map((l) => l.replace(/^SEARCHING\.{0,3}\s*/i, '').trim())
      .filter((l) => l.length > 0)
      .filter((l) => !/^BUS INIT:?\s*\.*\s*(OK)?$/i.test(l));
  }

  /** Classifica a resposta. Se houver dados válidos, só considera erro o que indica dado corrompido. */
  detectarErro(linhas) {
    const achados = [];
    const dados = [];
    for (const l of linhas) {
      const e = ERROS_ELM.find((x) => x.re.test(l.toUpperCase()));
      if (e) achados.push(e); else dados.push(l);
    }
    if (!achados.length) return null;
    if (!dados.length) return { ...achados[0] };
    const grave = achados.find((e) => ['BUFFER_FULL', 'RX_ERROR', 'DATA_ERROR', 'STOPPED'].includes(e.codigo));
    return grave ? { ...grave } : null;
  }

  // ------------------------------------------------------------ inicialização
  /**
   * Inicializa o adaptador. Ordem: ATZ, ATE0, ATL0, ATS0, ATH1, ATAT1, ATSP6 (CAN 11/500)
   * e, se não responder, ATSP0 (automático) -> ATDPN -> fixa o protocolo detectado.
   * progresso(texto) é chamado a cada etapa para mostrar na tela.
   */
  async inicializar(progresso = () => {}, opcoes = {}) {
    const passo = async (cmd, texto, extra = {}) => {
      progresso(texto);
      const r = await this.comando(cmd, extra);
      return r;
    };

    progresso('Reiniciando o adaptador (ATZ)…');
    let r = await this.comando('ATZ', { timeout: 4000, tentativas: 1 });
    if (r.erro?.codigo === 'TIMEOUT') {
      // alguns clones demoram após ATZ: tenta reset "suave"
      r = await this.comando('ATWS', { timeout: 4000, tentativas: 1 });
      if (r.erro?.codigo === 'TIMEOUT') throw new Error(ERRO_TIMEOUT.msg);
    }
    await espera(this.opc.compat ? 800 : 300);
    const versaoReset = r.linhas.find((l) => /ELM/i.test(l));

    await passo('ATE0', 'Desligando eco (ATE0)…');
    await passo('ATL0', 'Configurando quebras de linha (ATL0)…');
    await passo('ATS0', 'Removendo espaços (ATS0)…');
    await passo('ATH1', 'Ligando cabeçalhos (ATH1)…');
    await passo('ATAT1', 'Tempo adaptativo (ATAT1)…');
    if (this.opc.compat) {
      // clones lentos: timeout maior (0x96 * 4 ms = 600 ms)
      await passo('ATST96', 'Modo compatibilidade: timeout estendido (ATST96)…');
    }

    r = await passo('ATI', 'Lendo versão (ATI)…');
    this.info.versao = r.linhas.find((l) => /ELM|v\d/i.test(l)) || versaoReset || r.linhas[0] || '?';
    r = await passo('AT@1', 'Lendo descrição (AT@1)…');
    this.info.dispositivo = r.erro ? '(não informado)' : r.linhas.join(' ');

    await this.lerTensao();

    // Protocolo: tenta CAN 11/500 primeiro (padrão do Cerato 2014)
    const preferido = opcoes.protocolo ?? 6;
    let ok = false;
    if (preferido !== 0) {
      await passo(`ATSP${preferido.toString(16).toUpperCase()}`, `Testando protocolo ${PROTOCOLOS[preferido]}…`);
      r = await passo('0100', 'Consultando a ECU (0100)…', { timeout: 5000, tentativas: 1 });
      ok = !r.erro && r.linhas.some((l) => /41\s?00/i.test(l.replace(/\s/g, '')) || /4100/.test(l.replace(/\s/g, '')));
      if (ok) this.info.protocoloNum = preferido;
    }
    if (!ok) {
      await passo('ATSP0', 'Buscando protocolo automaticamente (ATSP0)…');
      r = await passo('0100', 'Procurando o protocolo do carro (pode levar até 15 s)…', { timeout: 15000, tentativas: 0 });
      if (r.erro) {
        throw new Error(r.erro.codigo === 'TIMEOUT' ? ERRO_TIMEOUT.msg : r.erro.msg);
      }
      r = await passo('ATDPN', 'Lendo número do protocolo (ATDPN)…');
      const num = parseInt((r.linhas[0] || '').replace(/^A/i, ''), 16);
      if (!Number.isNaN(num) && num > 0) {
        this.info.protocoloNum = num;
        await passo(`ATSP${num.toString(16).toUpperCase()}`, 'Fixando o protocolo detectado…');
      }
    }
    r = await passo('ATDP', 'Lendo nome do protocolo (ATDP)…');
    this.info.protocolo = (r.linhas[0] || PROTOCOLOS[this.info.protocoloNum] || '?').replace(/^AUTO,\s*/i, '');
    this.cabecalhoAtual = '7DF';
    this.filtroAtual = null;
    this.fcAtual = null;
    this._emit('info', this.info);
    return this.info;
  }

  async lerTensao() {
    const r = await this.comando('ATRV', { tentativas: 1 });
    const m = (r.linhas[0] || '').match(/(\d+(?:[.,]\d+)?)\s*V/i);
    this.info.tensao = m ? parseFloat(m[1].replace(',', '.')) : null;
    this._emit('info', this.info);
    return this.info.tensao;
  }

  get ehCan() { return [6, 7, 8, 9, 10, 11, 12].includes(this.info.protocoloNum ?? 6); }
  get can29() { return [7, 9, 10].includes(this.info.protocoloNum); }

  // ------------------------------------------------------------ cabeçalhos (módulos)
  /** Direciona os próximos pedidos para um módulo específico (ATSH/ATCRA/ATFCSH). */
  /**
   * Ajusta cabeçalho/filtro DENTRO de um trabalho da fila (não enfileira nada).
   * alvo = { tx, rx, leve }. tx '7DF' = OBD padrão (todas as ECUs).
   * leve = só ATSH/ATCRA (varredura), sem configurar o controle de fluxo.
   */
  async _garantirAlvo(alvo) {
    const ex = (c) => this._executarComRetry(c, { tentativas: 1 });
    const T = alvo.tx.toUpperCase();
    if (T === '7DF') {
      if (this.cabecalhoAtual === '7DF' && !this.filtroAtual) return;
      await ex('ATSH7DF');
      await ex('ATAR'); // desfaz o filtro ATCRA (clones não aceitam "ATCRA" sem parâmetro)
      if (this.fcAtual) await ex('ATFCSM0');
      this.cabecalhoAtual = '7DF';
      this.filtroAtual = null;
      this.fcAtual = null;
      return;
    }
    if (this.cabecalhoAtual !== T) {
      await ex('ATSH' + T);
      this.cabecalhoAtual = T;
    }
    if (!alvo.leve && this.fcAtual !== T) {
      // controle de fluxo ISO-TP: o ELM responde "30 00 00" usando o mesmo endereço de envio
      await ex('ATFCSH' + T);
      await ex('ATFCSD300000');
      await ex('ATFCSM1');
      this.fcAtual = T;
    }
    const R = alvo.rx ? alvo.rx.toUpperCase() : null;
    if (R && this.filtroAtual !== R) {
      await ex('ATCRA' + R);
      this.filtroAtual = R;
    }
  }

  /** Direciona os próximos pedidos para um módulo (ATSH/ATCRA/ATFCSH). */
  definirAlvo(tx, rx) {
    return this.enfileirar(() => this._garantirAlvo({ tx, rx }));
  }

  /** Volta ao endereçamento OBD padrão (funcional 7DF, recebe de todas as ECUs). */
  restaurarPadrao() {
    return this.enfileirar(() => this._garantirAlvo({ tx: '7DF' }));
  }

  /**
   * Envia um pedido e devolve as mensagens já montadas por ECU.
   * Com opcoes.alvo, troca o endereço e envia o pedido no MESMO trabalho da fila:
   * nenhuma outra operação consegue mudar o cabeçalho no meio.
   */
  async pedir(hex, opcoes = {}) {
    const r = await this.comando(hex, opcoes);
    const msgs = r.erro && r.linhas.length === 0 ? [] : parsearMensagens(r.linhas, this.info.protocoloNum ?? 6);
    return { ...r, msgs };
  }

  async fechar() {
    try { await this.t?.close(); } catch { /* ignora */ }
  }
}

// ==================================================================== parsing
const ehHex = (s) => /^[0-9A-F]+$/i.test(s);
const paraBytes = (s) => (s.match(/../g) || []).map((x) => parseInt(x, 16));

/**
 * Separa cada linha em { ecu, bytes } conforme o protocolo e se há cabeçalho.
 * CAN 11 bit com ATH1/ATS0: "7E8064100BE3FA813" -> ecu 7E8, bytes [06 41 00 ...]
 * CAN 29 bit: "18DAF110064100..." -> ecu 18DAF110
 * J1850/ISO: "486B104100BE3FA813C9" -> ecu = 3º byte, último byte = checksum
 */
export function separarQuadros(linhas, protocolo = 6) {
  const quadros = [];
  let formatadoSemCab = null; // formato "014 / 0: .. / 1: .." (cabeçalhos desligados)
  for (const original of linhas) {
    const l = original.replace(/\s+/g, '').toUpperCase();
    if (!l) continue;
    const mFmt = l.match(/^([0-9A-F]):([0-9A-F]+)$/);
    if (mFmt) {
      formatadoSemCab ||= { total: null, dados: [] };
      formatadoSemCab.dados.push(...paraBytes(mFmt[2]));
      continue;
    }
    if (!ehHex(l)) continue; // lixo
    const can = [6, 7, 8, 9, 10, 11, 12].includes(protocolo);
    if (can) {
      if (/^[0-9A-F]{3}$/.test(l)) { formatadoSemCab = { total: parseInt(l, 16), dados: [] }; continue; }
      const is29 = [7, 9, 10].includes(protocolo) || (/^18D[AB]/.test(l) && l.length >= 12);
      if (is29 && l.length >= 10 && l.length % 2 === 0) {
        quadros.push({ ecu: l.slice(0, 8), bytes: paraBytes(l.slice(8)), cru: true });
      } else if (l.length % 2 === 1 && l.length >= 5) {
        quadros.push({ ecu: l.slice(0, 3), bytes: paraBytes(l.slice(3)), cru: true });
      } else {
        // sem cabeçalho (clone ignorou ATH1): dados já sem PCI
        quadros.push({ ecu: 'ECU', bytes: paraBytes(l), cru: false });
      }
    } else {
      const b = paraBytes(l);
      if (b.length >= 5) quadros.push({ ecu: hex2(b[2]), bytes: b.slice(3, -1), cru: false });
      else quadros.push({ ecu: 'ECU', bytes: b, cru: false });
    }
  }
  if (formatadoSemCab) {
    const d = formatadoSemCab.total ? formatadoSemCab.dados.slice(0, formatadoSemCab.total) : formatadoSemCab.dados;
    quadros.push({ ecu: 'ECU', bytes: d, cru: false, montado: true });
  }
  return quadros;
}

const hex2 = (n) => n.toString(16).toUpperCase().padStart(2, '0');

/**
 * Monta mensagens ISO-TP completas agrupadas por ECU de origem.
 * Retorna lista [{ ecu: '7E8', dados: [0x43, ...] }, ...] na ordem de chegada.
 *  PCI 0x0N = quadro único (N bytes)
 *  PCI 0x1N NN = primeiro quadro (comprimento de 12 bits)
 *  PCI 0x2N = quadro consecutivo (sequência 1..F, 0..F)
 *  PCI 0x3N = controle de fluxo (ignorado)
 */
export function parsearMensagens(linhas, protocolo = 6) {
  const quadros = separarQuadros(linhas, protocolo);
  const saida = [];
  const emMontagem = new Map();
  for (const q of quadros) {
    if (!q.cru) { saida.push({ ecu: q.ecu, dados: q.bytes }); continue; }
    const b = q.bytes;
    if (!b.length) continue;
    const tipo = b[0] >> 4;
    if (tipo === 0) {
      let len = b[0] & 0x0f;
      let ini = 1;
      if (len === 0 && b.length > 1) { len = b[1]; ini = 2; } // CAN FD
      saida.push({ ecu: q.ecu, dados: b.slice(ini, ini + len) });
    } else if (tipo === 1) {
      const len = ((b[0] & 0x0f) << 8) | b[1];
      const m = { ecu: q.ecu, len, dados: b.slice(2), seq: 1 };
      emMontagem.set(q.ecu, m);
      saida.push(m); // mantém a ordem de chegada
    } else if (tipo === 2) {
      const m = emMontagem.get(q.ecu);
      if (!m) continue; // consecutivo sem primeiro quadro: descarta
      const seq = b[0] & 0x0f;
      if (seq !== (m.seq & 0x0f)) m.falhaSeq = true;
      m.seq++;
      m.dados.push(...b.slice(1));
      if (m.dados.length >= m.len) {
        m.dados = m.dados.slice(0, m.len);
        emMontagem.delete(q.ecu);
      }
    }
    // tipo 3 = flow control: ignora
  }
  return saida.map((m) => ({ ecu: m.ecu, dados: m.len ? m.dados.slice(0, m.len) : m.dados, incompleto: m.len ? m.dados.length < m.len : false, falhaSeq: !!m.falhaSeq }));
}
