/* Módulos Kia/Hyundai (EXPERIMENTAL).
 * Leitura de DTCs de módulos além do motor por requisições diretas em CAN:
 *   ATSH <tx>  -> endereço de envio
 *   ATCRA <rx> -> só aceita respostas deste endereço
 *   ATFCSH/ATFCSD/ATFCSM -> controle de fluxo ISO-TP para respostas longas
 * Protocolos tentados: UDS (19 02 FF) e KWP2000 sobre CAN (18 02 FF 00).
 * Os endereços são PROVÁVEIS e precisam ser confirmados pela varredura. */
import { decodificarDtc } from './obd.js';

const hex2 = (n) => n.toString(16).toUpperCase().padStart(2, '0');
const hex3 = (n) => n.toString(16).toUpperCase().padStart(3, '0');
const espera = (ms) => new Promise((r) => setTimeout(r, ms));
const espacado = (hex) => hex.match(/../g).join(' ');

/** Trechos de texto legível (>= 3 caracteres) dentro de uma resposta binária. */
export function textoAscii(bytes) {
  return bytes.map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '\u0000')).join('')
    .split('\u0000').map((t) => t.trim()).filter((t) => t.length >= 3);
}

// Topologia confirmada em um Cerato 2014 (relatório técnico de 26/11/2026).
// "nota" explica como cada endereço foi identificado.
export const MODULOS_PADRAO = [
  { id: 'ecm', nome: 'Motor (ECM)', tx: '7E0', rx: '7E8', critico: false, nota: 'Confirmado (Kefico, KWP2000)' },
  { id: 'tcm', nome: 'Câmbio automático (TCM)', tx: '7E1', rx: '7E9', critico: false, nota: 'Confirmado (KWP2000)' },
  { id: 'abs', nome: 'ABS', tx: '7D1', rx: '7D9', critico: true, nota: 'Confirmado: "YD ABS", peça 58920-A7100 (KWP2000)' },
  { id: 'srs', nome: 'Airbag (SRS)', tx: '7D2', rx: '7DA', critico: true, nota: 'Responde; identificação não lida' },
  { id: 'bcm', nome: 'Carroceria (BCM)', tx: '7A0', rx: '7A8', critico: false, nota: 'Confirmado: peça 95400-A7140 (UDS)' },
  { id: 'painel', nome: 'Painel de instrumentos', tx: '7C6', rx: '7CE', critico: false, nota: 'Confirmado: peça 94003-A7220 (UDS)' },
  { id: 'sjb', nome: 'Caixa de junção (SJB)', tx: '771', rx: '779', critico: false, nota: 'Provável pela peça 91950-A7010 (UDS)' },
  { id: 'mdps', nome: 'Direção elétrica (MDPS)', tx: '7D4', rx: '7DC', critico: false, nota: 'Provável pelo endereço (convenção Hyundai/Kia)' },
  { id: 'ac', nome: 'Ar-condicionado', tx: '7B3', rx: '7BB', critico: false, nota: 'Provável pelo endereço (convenção Hyundai/Kia)' },
  { id: 'm7f1', nome: 'Módulo 7F1 (desconhecido)', tx: '7F1', rx: '7F9', critico: false, nota: 'Responde; função desconhecida' }
];

/** Códigos de resposta negativa (NRC) — ISO 14229 (UDS) / ISO 14230 (KWP2000). */
export const NRC = {
  0x10: 'Recusa geral',
  0x11: 'Serviço não suportado',
  0x12: 'Subfunção não suportada',
  0x13: 'Tamanho da mensagem incorreto ou formato inválido',
  0x14: 'Resposta grande demais',
  0x21: 'Ocupado — repita o pedido',
  0x22: 'Condições incorretas (ex.: motor ligado, velocidade, sessão)',
  0x24: 'Sequência de pedidos incorreta',
  0x25: 'Sem resposta de subcomponente',
  0x26: 'Falha impede a execução',
  0x31: 'Fora de faixa (identificador não suportado)',
  0x33: 'Acesso de segurança negado',
  0x35: 'Chave de segurança inválida',
  0x36: 'Número de tentativas excedido',
  0x37: 'Tempo de espera ainda não expirou',
  0x70: 'Transferência não aceita',
  0x72: 'Falha geral de programação',
  0x78: 'Resposta pendente (a ECU ainda está processando)',
  0x7e: 'Subfunção não suportada na sessão atual',
  0x7f: 'Serviço não suportado na sessão atual',
  0x80: 'Serviço não suportado no modo de diagnóstico ativo (KWP2000)',
  0x81: 'Rotação alta demais',
  0x82: 'Rotação baixa demais',
  0x83: 'Motor está ligado',
  0x84: 'Motor não está ligado',
  0x88: 'Velocidade do veículo alta demais',
  0x92: 'Tensão alta demais',
  0x93: 'Tensão baixa demais'
};

export function traduzirNrc(nrc) {
  return NRC[nrc] || `Código desconhecido 0x${hex2(nrc)}`;
}

/** Interpreta o byte de status UDS (ISO 14229 DTCStatusMask). */
export function statusUds(st) {
  const bits = [];
  if (st & 0x01) bits.push('falha ativa agora');
  if (st & 0x02) bits.push('falhou neste ciclo');
  if (st & 0x04) bits.push('pendente');
  if (st & 0x08) bits.push('confirmado');
  if (st & 0x10) bits.push('teste incompleto desde o apagamento');
  if (st & 0x20) bits.push('falhou desde o apagamento');
  if (st & 0x40) bits.push('teste incompleto neste ciclo');
  if (st & 0x80) bits.push('pediu luz de aviso');
  return bits.join(', ') || 'sem flags';
}

/** Status KWP2000 (ISO 14230-3): bit 7 = luz de aviso, bits 6-5 = estado de armazenamento. */
export function statusKwp(st) {
  const est = (st >> 5) & 0x03;
  const textos = ['sem falha detectada', 'não presente agora (histórico)', 'intermitente/amadurecendo', 'presente agora'];
  return `${textos[est]}${st & 0x80 ? ', pediu luz de aviso' : ''}`;
}

export class ErroModulo extends Error {
  constructor(msg, codigo) { super(msg); this.codigo = codigo; }
}

export class Kia {
  /**
   * @param elm instância de Elm327
   * @param obterConfig função que devolve as configurações atuais (permitirApagarCriticos, compat)
   */
  constructor(elm, obterConfig = () => ({})) {
    this.elm = elm;
    this.cfg = obterConfig;
    this._cancelar = false;
  }

  /** Envia um pedido ao módulo e trata "resposta pendente" (NRC 78). */
  async _pedir(hex, mod, opcoes = {}) {
    const rx = mod.rx.toUpperCase();
    const alvo = { tx: mod.tx.toUpperCase(), rx };
    let r = await this.elm.pedir(hex, { timeout: 3000, tentativas: 1, ...opcoes, alvo });
    for (let i = 0; i < 4; i++) {
      const doModulo = r.msgs.filter((m) => m.ecu === rx || m.ecu === 'ECU');
      const final = doModulo.filter((m) => !(m.dados[0] === 0x7f && m.dados[2] === 0x78));
      if (final.length || !doModulo.length) return { ...r, msgs: final.length ? final : doModulo };
      // só chegou "resposta pendente": espera e pede de novo
      await espera(400 + i * 300);
      r = await this.elm.pedir(hex, { timeout: 5000, tentativas: 0, alvo });
    }
    return r;
  }

  _negativa(msgs, sid) {
    const n = msgs.find((m) => m.dados[0] === 0x7f && m.dados[1] === sid);
    return n ? n.dados[2] : null;
  }

  /** Mantém a sessão viva enviando TesterPresent (3E 00) a cada 2 s. */
  _iniciarTesterPresent(mod) {
    this._parar();
    const alvo = { tx: mod.tx.toUpperCase(), rx: mod.rx.toUpperCase() };
    this._tp = setInterval(() => { this.elm.comando('3E00', { tentativas: 0, timeout: 800, alvo }); }, 2000);
  }
  _parar() { if (this._tp) clearInterval(this._tp); this._tp = null; }

  /**
   * Lê DTCs de um módulo. Tenta UDS e depois KWP2000.
   * Retorna { modulo, protocolo, dtcs:[{codigo, ftb, status, statusTexto}], log:[...] }
   */
  async lerModulo(mod) {
    const log = [];
    const anota = (t) => log.push(t);
    let algumaResposta = false;
    const pedir = async (hex, op) => {
      const r = await this._pedir(hex, mod, op);
      if (r.msgs.length) algumaResposta = true;
      return r;
    };
    try {
      // ---- sessão: UDS 10 01; módulos KWP2000 recusam com NRC 12 e aceitam 10 81
      let sessao = await pedir('1001');
      let neg = this._negativa(sessao.msgs, 0x10);
      if (!sessao.msgs.length) {
        anota('Sem resposta à sessão padrão (10 01).');
        sessao = await pedir('1003');
        if (sessao.msgs.length && this._negativa(sessao.msgs, 0x10) === null) anota('Sessão estendida aberta (10 03).');
      } else if (neg !== null) {
        anota(`Sessão 10 01 recusada: ${traduzirNrc(neg)}.`);
        const kwpSessao = await pedir('1081');
        if (kwpSessao.msgs.some((m) => m.dados[0] === 0x50)) anota('Sessão KWP2000 aberta (10 81).');
      } else anota('Sessão padrão aberta (10 01).');
      if (algumaResposta) this._iniciarTesterPresent(mod);

      // ---- UDS 19 02: alguns módulos recusam a máscara FF (NRC 31) e aceitam 09/08/0D
      for (const cmd of ['1902FF', '190209', '190208', '19020D']) {
        const r = await pedir(cmd, { timeout: 4000 });
        const ok = r.msgs.find((m) => m.dados[0] === 0x59);
        if (ok) {
          const dtcs = [];
          const d = ok.dados.slice(3); // 59 02 máscara
          for (let i = 0; i + 3 < d.length; i += 4) {
            const [a, b, ftb, st] = d.slice(i, i + 4);
            if (!a && !b && !ftb) continue;
            dtcs.push({ codigo: decodificarDtc(a, b), ftb: hex2(ftb), status: hex2(st), statusTexto: statusUds(st) });
          }
          anota(`UDS ${espacado(cmd)} respondeu: ${dtcs.length} código(s).`);
          return { modulo: mod, protocolo: 'UDS', comando: cmd, dtcs, log };
        }
        neg = this._negativa(r.msgs, 0x19);
        anota(`UDS ${espacado(cmd)}: ${neg !== null ? traduzirNrc(neg) + ` (0x${hex2(neg)})` : 'sem resposta'}.`);
        if (neg === null || neg === 0x11) break; // serviço inexistente ou módulo calado: não adianta variar
      }

      // ---- KWP2000 18: variantes de status/grupo (NRC 12 = formato não aceito)
      for (const cmd of ['1802FF00', '1800FF00', '18020000', '18000000']) {
        const r = await pedir(cmd, { timeout: 4000 });
        const ok = r.msgs.find((m) => m.dados[0] === 0x58);
        if (ok) {
          const n = ok.dados[1];
          const d = ok.dados.slice(2);
          const dtcs = [];
          for (let i = 0; i < n && i * 3 + 2 < d.length; i++) {
            const [a, b, st] = d.slice(i * 3, i * 3 + 3);
            dtcs.push({ codigo: decodificarDtc(a, b), ftb: null, status: hex2(st), statusTexto: statusKwp(st) });
          }
          anota(`KWP2000 ${espacado(cmd)} respondeu: ${dtcs.length} código(s).`);
          return { modulo: mod, protocolo: 'KWP2000', comando: cmd, dtcs, log };
        }
        neg = this._negativa(r.msgs, 0x18);
        anota(`KWP ${espacado(cmd)}: ${neg !== null ? traduzirNrc(neg) + ` (0x${hex2(neg)})` : 'sem resposta'}.`);
        if (neg === null || neg === 0x11) break;
      }

      if (!algumaResposta) {
        throw new ErroModulo(`O módulo ${mod.nome} (${mod.tx}→${mod.rx}) não respondeu. O endereço pode não existir neste carro — use a varredura de módulos.`, 'SEM_RESPOSTA');
      }
      throw new ErroModulo(`O módulo ${mod.nome} respondeu, mas recusou todos os formatos de leitura de códigos testados. Gere um relatório técnico para descobrirmos o formato dele.`, 'NAO_SUPORTADO');
    } finally {
      this._parar();
      await this.elm.restaurarPadrao();
    }
  }

  /**
   * Identificação do módulo (somente leitura): UDS 22 F187/F18C/F190/F193/F195
   * ou KWP2000 1A 80/1A 90. Devolve [{ campo, valor }].
   */
  async identificarModulo(mod) {
    const campos = [];
    try {
      const dids = [['F187', 'Número da peça'], ['F18C', 'Número de série'], ['F190', 'VIN'], ['F193', 'Versão de hardware'], ['F195', 'Versão de software']];
      let udsOk = false;
      for (const [did, nome] of dids) {
        const r = await this._pedir('22' + did, mod, { timeout: 1500, tentativas: 0 });
        const ok = r.msgs.find((m) => m.dados[0] === 0x62);
        if (ok) { udsOk = true; campos.push({ campo: nome, valor: textoAscii(ok.dados.slice(3)).join(' ') }); }
        else if (!r.msgs.length && !udsOk) break; // módulo calado para 22: não insiste
      }
      if (!udsOk) {
        for (const [id, nome] of [['1A80', 'Identificação'], ['1A90', 'VIN']]) {
          const r = await this._pedir(id, mod, { timeout: 1500, tentativas: 0 });
          const ok = r.msgs.find((m) => m.dados[0] === 0x5a);
          if (ok) textoAscii(ok.dados.slice(2)).forEach((t) => campos.push({ campo: nome, valor: t }));
        }
      }
      return campos;
    } finally {
      await this.elm.restaurarPadrao();
    }
  }

  /** Apaga DTCs de um módulo (UDS 14 FF FF FF ou KWP 14 FF 00). ABS/SRS bloqueados por padrão. */
  async apagarModulo(mod, protocolo) {
    if (mod.critico && !this.cfg().permitirApagarCriticos) {
      throw new ErroModulo('Apagar códigos de ABS/ESC e airbag está DESATIVADO. Habilite em Mais > Configurações, por sua conta e risco.', 'BLOQUEADO');
    }
    try {
      const cmd = protocolo === 'KWP2000' ? '14FF00' : '14FFFFFF';
      if (protocolo !== 'KWP2000') await this._pedir('1001', mod);
      const r = await this._pedir(cmd, mod, { timeout: 5000 });
      const neg = this._negativa(r.msgs, 0x14);
      if (neg !== null) throw new ErroModulo(`O módulo recusou o apagamento: ${traduzirNrc(neg)}.`, 'NRC');
      if (!r.msgs.some((m) => m.dados[0] === 0x54)) throw new ErroModulo('O módulo não confirmou o apagamento.', 'SEM_CONFIRMACAO');
      return true;
    } finally {
      await this.elm.restaurarPadrao();
    }
  }

  cancelarVarredura() { this._cancelar = true; }

  /**
   * Varredura: envia TesterPresent (3E 00) e, se calado, sessão padrão (10 01)
   * para cada endereço 7xx, assumindo resposta em tx+8 (convenção Hyundai/Kia).
   * onProgresso({ atual, total, tx, achados })
   */
  async varrer({ inicio = 0x700, fim = 0x7f7, lista = null, onProgresso = () => {} } = {}) {
    this._cancelar = false;
    const enderecos = lista || [];
    if (!lista) for (let a = inicio; a <= fim; a++) if (a !== 0x7df) enderecos.push(a);
    const achados = [];
    const compat = !!this.cfg().compat;
    await this.elm.comando('ATST19', { tentativas: 0 }); // ~100 ms de espera por endereço
    await this.elm.comando('ATFCSM0', { tentativas: 0 });
    try {
      for (let i = 0; i < enderecos.length; i++) {
        if (this._cancelar) break;
        const tx = enderecos[i];
        const rx = tx + 8;
        onProgresso({ atual: i + 1, total: enderecos.length, tx: hex3(tx), achados });
        const alvo = { tx: hex3(tx), rx: hex3(rx), leve: true };
        let r = await this.elm.pedir('3E00', { timeout: 600, tentativas: 0, alvo });
        let servico = '3E 00';
        if (!r.msgs.length) {
          r = await this.elm.pedir('1001', { timeout: 600, tentativas: 0, alvo });
          servico = '10 01';
        }
        if (r.msgs.length) {
          const m = r.msgs[0];
          const resp = m.dados.map(hex2).join(' ');
          const neg = m.dados[0] === 0x7f ? traduzirNrc(m.dados[2]) : null;
          achados.push({ tx: hex3(tx), rx: m.ecu, servico, resposta: resp, negativa: neg, provavel: nomeProvavel(tx) });
        }
      }
    } finally {
      await this.elm.comando(compat ? 'ATST96' : 'ATST32', { tentativas: 0 });
      await this.elm.restaurarPadrao();
    }
    onProgresso({ atual: enderecos.length, total: enderecos.length, tx: '', achados, fim: true });
    return achados;
  }
}

/** Sugere o que um endereço provavelmente é, pela convenção Hyundai/Kia (não confirmado). */
export function nomeProvavel(tx) {
  const m = MODULOS_PADRAO.find((x) => parseInt(x.tx, 16) === tx);
  if (m) return m.nome + ' (provável)';
  if (tx >= 0x7e0 && tx <= 0x7e7) return 'Trem de força (OBD)';
  return 'Desconhecido';
}
