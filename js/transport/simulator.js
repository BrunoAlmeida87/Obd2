/* Simulador de ELM327 + carro (Kia Cerato 2014 flex) para o modo demonstração.
 * Responde como um ELM327 v1.5 real: eco, espaços, cabeçalhos, prompt '>',
 * respostas ISO-TP multi-frame, duas ECUs (motor 7E8 e câmbio 7E9),
 * módulos Kia (ABS em UDS, SRS em KWP2000, BCM e painel) e dados ao vivo variando. */
import { BaseTransport } from './base.js';

const hex2 = (n) => (n & 0xff).toString(16).toUpperCase().padStart(2, '0');
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const rnd = (a, b) => a + Math.random() * (b - a);

/** Converte código "P0301" em 2 bytes no formato OBD. */
function dtcBytes(cod) {
  const tipo = { P: 0, C: 1, B: 2, U: 3 }[cod[0]];
  const d1 = parseInt(cod[1], 16);
  const resto = parseInt(cod.slice(2), 16);
  return [(tipo << 6) | (d1 << 4) | (resto >> 8), resto & 0xff];
}

/** Monta máscara de PIDs suportados (4 bytes) para a faixa base..base+0x20. */
function mascara(lista, base) {
  const bytes = [0, 0, 0, 0];
  for (const pid of lista) {
    if (pid > base && pid <= base + 0x20) {
      const bit = pid - base - 1;
      bytes[bit >> 3] |= 0x80 >> (bit & 7);
    }
  }
  return bytes;
}

// PIDs do modo 01 que a ECU do motor simulada suporta
const PIDS_MOTOR = [0x01, 0x03, 0x04, 0x05, 0x06, 0x07, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x10, 0x11, 0x13, 0x14, 0x15,
  0x1c, 0x1f, 0x20, 0x21, 0x2e, 0x2f, 0x30, 0x31, 0x33, 0x3c, 0x40, 0x41, 0x42, 0x43, 0x44, 0x45, 0x46, 0x47,
  0x49, 0x4a, 0x4c, 0x51, 0x52];
// PIDs que precisam aparecer como "ponte" para a próxima faixa
const PONTES = [0x20, 0x40];
// Respostas reais do modo 06 de um Cerato 2014 (relatório técnico), sem o byte 46
const MODO06 = {
  0x01: '01010a0e670e670e6701020a0e670e670e6701070a000000000e6701080a1ded0e6724cf0109110002000000 0a010a100000000006d60189850200fc680398',
  0x02: '02010a14ce14ce14ce02020a14ce14ce14ce02070a000000000e6702080a1c7c0e67229102810a14ce14ce28cf02830a00000000 04cd',
  0x21: '2180053680000040 00',
  0x35: '358a9dffefffde0006358b9dffefffde0006',
  0x3d: '3d88170000000000 00',
  0x41: '41811400660000 0cc0',
  0x42: '428114005a00000406'
};
const PIDS_FREEZE = [0x02, 0x03, 0x04, 0x05, 0x06, 0x07, 0x0b, 0x0c, 0x0d, 0x0e, 0x0f, 0x11];

// Módulos Kia simulados (tx -> comportamento)
const MODULOS = {
  0x7e0: { nome: 'ECM', proto: 'uds', idKwp: 'DEMOTOOL KNAFX411BE5000000 DEMO-CAL-GAMMA16', dtcs: [['P0301', 0x00, 0x2f], ['P0171', 0x00, 0x28], ['P0420', 0x00, 0x08]] },
  0x7e1: { nome: 'TCM', proto: 'uds', dtcs: [['P0715', 0x00, 0x09]], pendente78: true },
  0x7d1: { nome: 'ABS/ESC', proto: 'uds', dtcs: [['C1201', 0x00, 0x09]] },
  0x7d2: { nome: 'SRS', proto: 'kwp', soAceita1800: true, dtcs: [['B1102', 0x00, 0x60]] },
  0x7a0: { nome: 'BCM', proto: 'uds', dtcs: [], pecaUds: '95400DEMO01' },
  0x7c6: { nome: 'Painel', proto: 'kwp', dtcs: [] }
};

export class SimulatorTransport extends BaseTransport {
  constructor(opcoes = {}) {
    super();
    this.nome = 'Simulador (demo)';
    this.cloneRuidoso = !!opcoes.cloneRuidoso;
    this._entrada = '';
    this._t0 = Date.now();
    this.motorLigado = opcoes.motorLigado !== false;
    this._resetEstadoElm();
    this._resetCarro();
  }

  static disponivel() { return true; }

  _resetEstadoElm() {
    this.eco = true;
    this.linefeed = false;
    this.espacos = true;
    this.cabecalhos = false;
    this.protocolo = 0; // 0 = automático
    this.protocoloDetectado = false;
    this.txHeader = 0x7df;
    this.filtroRx = null;
  }

  _resetCarro() {
    this.dtcsArmazenados = { 0x7e8: ['P0301', 'P0171', 'P0420'], 0x7e9: ['P0715'] };
    this.dtcsPendentes = { 0x7e8: ['P0128'], 0x7e9: [] };
    this.dtcsPermanentes = { 0x7e8: ['P0420'], 0x7e9: [] };
    this.freezeDtc = 'P0301';
    this.monitoresIncompletos = 0x04; // EVAP incompleto
    this.distDesdeApagar = 1843;
    this.distMil = 212;
    this.aquecimentos = 37;
    this.modulos = JSON.parse(JSON.stringify(MODULOS));
    this.sessaoUds = {};
  }

  async open() {
    await new Promise((r) => setTimeout(r, 300));
    this.aberto = true;
  }

  async close() {
    this.aberto = false;
  }

  async write(texto) {
    if (!this.aberto) throw new Error('Simulador fechado.');
    this._entrada += texto;
    let i;
    while ((i = this._entrada.indexOf('\r')) >= 0) {
      const cmd = this._entrada.slice(0, i);
      this._entrada = this._entrada.slice(i + 1);
      this._processar(cmd);
    }
  }

  // ---------------------------------------------------------------- saída
  get _eol() { return this.linefeed ? '\r\n' : '\r'; }

  _enviar(linhas, atraso = 40) {
    const eol = this._eol;
    let txt = linhas.map((l) => l + eol).join('') + eol + '>';
    if (this.cloneRuidoso && Math.random() < 0.15) txt = '\x00' + txt; // lixo de clone
    const lento = this.cloneRuidoso ? rnd(60, 220) : rnd(20, 60);
    setTimeout(() => this._receber(txt), atraso + lento);
  }

  _fmtBytes(arr) {
    return arr.map(hex2).join(this.espacos ? ' ' : '');
  }

  /** Divide um payload em quadros ISO-TP e formata conforme ATH/ATS. */
  _quadros(rx, payload, pad = 0xaa) {
    const h = rx.toString(16).toUpperCase();
    const sep = this.espacos ? ' ' : '';
    const linhas = [];
    if (payload.length <= 7) {
      if (this.cabecalhos) {
        const f = [payload.length, ...payload];
        while (f.length < 8) f.push(pad);
        linhas.push(h + sep + this._fmtBytes(f));
      } else {
        linhas.push(this._fmtBytes(payload));
      }
      return linhas;
    }
    // multi-frame
    const total = payload.length;
    if (this.cabecalhos) {
      linhas.push(h + sep + this._fmtBytes([0x10 | (total >> 8), total & 0xff, ...payload.slice(0, 6)]));
      let seq = 1;
      for (let i = 6; i < total; i += 7) {
        const f = [0x20 | (seq & 0x0f), ...payload.slice(i, i + 7)];
        while (f.length < 8) f.push(pad);
        linhas.push(h + sep + this._fmtBytes(f));
        seq++;
      }
    } else {
      linhas.push(total.toString(16).toUpperCase().padStart(3, '0'));
      linhas.push('0:' + sep + this._fmtBytes(payload.slice(0, 6)));
      let seq = 1;
      for (let i = 6; i < total; i += 7) {
        linhas.push((seq & 0x0f).toString(16).toUpperCase() + ':' + sep + this._fmtBytes(payload.slice(i, i + 7)));
        seq++;
      }
    }
    return linhas;
  }

  // ---------------------------------------------------------------- comandos
  _processar(bruto) {
    const cmd = bruto.replace(/\s+/g, '').toUpperCase();
    const linhas = [];
    if (this.eco) linhas.push(bruto);
    if (!cmd) { this._enviar(linhas); return; }

    if (cmd.startsWith('AT')) {
      this._at(cmd.slice(2), linhas);
      return;
    }
    if (!/^[0-9A-F]+$/.test(cmd) || cmd.length % 2) {
      linhas.push('?');
      this._enviar(linhas);
      return;
    }
    const bytes = cmd.match(/../g).map((x) => parseInt(x, 16));
    let atraso = 0;
    if (this.protocolo === 0 && !this.protocoloDetectado) {
      linhas.push('SEARCHING...');
      this.protocoloDetectado = true;
      atraso = 600;
    }
    const respostas = this._obd(bytes);
    if (!respostas.length) linhas.push('NO DATA');
    else respostas.forEach((r) => linhas.push(...r));
    this._enviar(linhas, atraso);
  }

  _at(c, linhas) {
    let resp = 'OK';
    if (c === 'Z' || c === 'WS') {
      this._resetEstadoElm();
      linhas.push('', 'ELM327 v1.5');
      this._enviar(linhas, 400);
      return;
    } else if (c === 'I') resp = 'ELM327 v1.5';
    else if (c === '@1') resp = 'OBDII to RS232 Interpreter';
    else if (c === 'RV') resp = (this.motorLigado ? rnd(13.9, 14.3) : rnd(12.3, 12.6)).toFixed(1) + 'V';
    else if (c === 'DP') resp = (this.protocolo === 0 ? 'AUTO, ' : '') + 'ISO 15765-4 (CAN 11/500)';
    else if (c === 'DPN') resp = this.protocolo === 0 ? 'A6' : String(this.protocolo);
    else if (/^E[01]$/.test(c)) this.eco = c[1] === '1';
    else if (/^L[01]$/.test(c)) this.linefeed = c[1] === '1';
    else if (/^S[01]$/.test(c)) this.espacos = c[1] === '1';
    else if (/^H[01]$/.test(c)) this.cabecalhos = c[1] === '1';
    else if (/^SP[0-9A-C]$/.test(c) || /^TP[0-9A-C]$/.test(c)) {
      const p = parseInt(c[2], 16);
      if (p !== 0 && p !== 6) {
        // o carro é CAN 11/500; outros protocolos não respondem
        this.protocolo = p;
      } else {
        this.protocolo = p;
      }
      this.protocoloDetectado = p !== 0;
    } else if (/^SH[0-9A-F]{3}$/.test(c)) this.txHeader = parseInt(c.slice(2), 16);
    else if (/^SH[0-9A-F]{6,8}$/.test(c)) this.txHeader = parseInt(c.slice(2), 16);
    else if (/^CRA[0-9A-F]{3}$/.test(c)) this.filtroRx = parseInt(c.slice(3), 16);
    else if (c === 'CRA' || c === 'AR') this.filtroRx = null;
    else if (/^(AT[0-2]|ST[0-9A-F]{2}|CAF[01]|D|M[01]|PC|FCSH[0-9A-F]{3,8}|FCSD[0-9A-F]+|FCSM[0-2]|CFC[01]|AL|NL|R[01]|D[01])$/.test(c)) resp = 'OK';
    else resp = '?';
    linhas.push(resp);
    this._enviar(linhas);
  }

  // ---------------------------------------------------------------- carro
  /** Valores físicos simulados variando com o tempo. */
  _estado() {
    const t = (Date.now() - this._t0) / 1000;
    if (!this.motorLigado) {
      return { rpm: 0, vel: 0, tmp: clamp(25 + t / 30, 25, 40), iat: 26, map: 96, maf: 0, tps: 0, carga: 0, avanco: 0, o2a: 0.45, o2b: 0.45, stft: 0, ltft: 0, cat: 30 };
    }
    // ciclo de condução de 60 s: parado, acelera, cruzeiro, desacelera
    const fase = t % 60;
    let vel = 0;
    if (fase < 10) vel = 0;
    else if (fase < 25) vel = (fase - 10) * 4.2;
    else if (fase < 45) vel = 63 + Math.sin(t) * 3;
    else vel = Math.max(0, 63 - (fase - 45) * 4.5);
    const acelerando = fase >= 10 && fase < 25;
    const marcha = vel < 15 ? 1 : vel < 30 ? 2 : vel < 45 ? 3 : vel < 60 ? 4 : 5;
    const rpm = vel < 2 ? 760 + rnd(-25, 25) : clamp(vel * (130 - marcha * 18) + (acelerando ? 600 : 0) + rnd(-40, 40), 900, 6500);
    const tps = vel < 2 ? 0 : acelerando ? 28 + rnd(0, 6) : 12 + rnd(0, 3);
    const carga = vel < 2 ? 22 + rnd(0, 3) : acelerando ? 62 + rnd(0, 8) : 35 + rnd(0, 6);
    const tmp = clamp(35 + t * 0.35, 35, 91 + Math.sin(t / 20) * 2);
    const map = vel < 2 ? 32 + rnd(0, 2) : acelerando ? 70 + rnd(0, 8) : 45 + rnd(0, 5);
    const maf = rpm * carga / 15000 * 2.2;
    const o2a = Math.sin(t * 6) > 0 ? rnd(0.65, 0.85) : rnd(0.08, 0.25);
    return {
      rpm, vel, tmp, iat: 31 + Math.sin(t / 50) * 2, map, maf, tps, carga,
      avanco: vel < 2 ? 8 + rnd(-2, 2) : acelerando ? 18 + rnd(-2, 2) : 28 + rnd(-2, 2),
      o2a, o2b: 0.68 + rnd(-0.03, 0.03), stft: rnd(-4, 6), ltft: 9.4, cat: clamp(300 + t * 4, 300, 640) + rnd(-5, 5)
    };
  }

  /** Bytes de dados (sem o 41/PID) de um PID do modo 01. */
  _pid01(pid, ecu) {
    const s = this._estado();
    const t = (Date.now() - this._t0) / 1000;
    const w = (v) => { const n = Math.round(v); return [(n >> 8) & 0xff, n & 0xff]; };
    if (ecu === 0x7e9) {
      if (pid === 0x00) return mascara([0x01], 0x00);
      if (pid === 0x01) return this._status(0x7e9);
      return null;
    }
    if (pid === 0x00 || pid === 0x20 || pid === 0x40) {
      const m = mascara(PIDS_MOTOR, pid);
      return m;
    }
    if (pid === 0x60) return null;
    if (!PIDS_MOTOR.includes(pid)) return null;
    switch (pid) {
      case 0x01: return this._status(0x7e8);
      case 0x03: return [0x02, 0x00]; // malha fechada
      case 0x04: return [Math.round(s.carga * 2.55)];
      case 0x05: return [Math.round(s.tmp + 40)];
      case 0x06: return [Math.round(s.stft * 1.28 + 128)];
      case 0x07: return [Math.round(s.ltft * 1.28 + 128)];
      case 0x0b: return [Math.round(s.map)];
      case 0x0c: return w(s.rpm * 4);
      case 0x0d: return [Math.round(s.vel)];
      case 0x0e: return [Math.round((s.avanco + 64) * 2)];
      case 0x0f: return [Math.round(s.iat + 40)];
      case 0x10: return w(s.maf * 100);
      case 0x11: return [Math.round((s.tps + 15) * 2.55)];
      case 0x13: return [0x03];
      case 0x14: return [Math.round(s.o2a * 200), Math.round(s.stft * 1.28 + 128)];
      case 0x15: return [Math.round(s.o2b * 200), 0xff];
      case 0x1c: return [0x1d]; // OBDBr-2
      case 0x1f: return w(this.motorLigado ? t + 120 : 0);
      case 0x21: return w(this.distMil);
      case 0x2e: return [Math.round(rnd(0, 40))];
      case 0x2f: return [Math.round(52 * 2.55)];
      case 0x30: return [this.aquecimentos];
      case 0x31: return w(this.distDesdeApagar);
      case 0x33: return [94];
      case 0x3c: return w((s.cat + 40) * 10);
      case 0x41: return [0x00, 0x07, 0xe5, 0x00];
      case 0x42: return w((this.motorLigado ? 14.1 : 12.5) * 1000 + rnd(-50, 50));
      case 0x43: return w(s.carga * 2.55);
      case 0x44: return w(32768 * (1 + rnd(-0.01, 0.01)));
      case 0x45: return [Math.round(s.tps * 2.55)];
      case 0x46: return [Math.round(28 + 40)];
      case 0x47: return [Math.round((s.tps + 15) * 2.55)];
      case 0x49: return [Math.round((s.tps * 0.8 + 15) * 2.55)];
      case 0x4a: return [Math.round((s.tps * 0.4 + 7) * 2.55)];
      case 0x4c: return [Math.round(s.tps * 2.55)];
      case 0x51: return [0x01];
      case 0x52: return [Math.round(27 * 2.55)]; // gasolina comum brasileira ~27% de etanol
      default: return null;
    }
  }

  _status(ecu) {
    const n = (this.dtcsArmazenados[ecu] || []).length;
    const mil = ecu === 0x7e8 && n > 0 ? 0x80 : 0;
    if (ecu === 0x7e9) return [mil | n, 0x00, 0x00, 0x00];
    return [mil | n, 0x07, 0x65, this.monitoresIncompletos];
  }

  _ecusAlvo() {
    // 7DF = funcional (todas). 7E0/7E1 = físico.
    if (this.txHeader === 0x7df) return [0x7e8, 0x7e9];
    if (this.txHeader === 0x7e0) return [0x7e8];
    if (this.txHeader === 0x7e1) return [0x7e9];
    return [];
  }

  _obd(bytes) {
    if (this.protocolo !== 0 && this.protocolo !== 6 && this.protocolo !== 0x0a) return [];
    // Requisições para módulos (UDS/KWP) quando o cabeçalho não é OBD padrão
    if (this.txHeader !== 0x7df && MODULOS[this.txHeader] && ![0x01, 0x02, 0x03, 0x04, 0x07, 0x09, 0x0a].includes(bytes[0])) {
      return this._modulo(bytes);
    }
    const ecus = this._ecusAlvo();
    if (!ecus.length) return [];
    const modo = bytes[0];
    const saida = [];
    for (const ecu of ecus) {
      if (this.filtroRx && this.filtroRx !== ecu) continue;
      const pad = ecu === 0x7e8 ? 0xaa : 0x55;
      let payload = null;
      if (modo === 0x01) {
        const pids = bytes.slice(1, 7);
        const dados = [0x41];
        for (const pid of pids) {
          const d = this._pid01(pid, ecu);
          if (d) dados.push(pid, ...d);
        }
        if (dados.length > 1) payload = dados;
      } else if (modo === 0x02) {
        payload = this._freeze(bytes[1], ecu);
      } else if (modo === 0x03 || modo === 0x07 || modo === 0x0a) {
        const fonte = modo === 0x03 ? this.dtcsArmazenados : modo === 0x07 ? this.dtcsPendentes : this.dtcsPermanentes;
        const lista = fonte[ecu] || [];
        payload = [modo + 0x40, lista.length];
        lista.forEach((c) => payload.push(...dtcBytes(c)));
      } else if (modo === 0x04) {
        if (this.motorLigado) payload = [0x7f, 0x04, 0x22];
        else {
          if (ecu === 0x7e8) {
            this.dtcsArmazenados = { 0x7e8: [], 0x7e9: [] };
            this.dtcsPendentes = { 0x7e8: [], 0x7e9: [] };
            this.freezeDtc = null;
            this.monitoresIncompletos = 0x65;
            this.distDesdeApagar = 0;
            this.aquecimentos = 0;
            this.distMil = 0;
          }
          payload = [0x44];
        }
      } else if (modo === 0x06) {
        if (ecu === 0x7e8) {
          const mid = bytes[1];
          if (mid === 0x00) payload = [0x46, 0x00, 0xc0, 0x00, 0x00, 0x01];
          else if (mid === 0x20) payload = [0x46, 0x20, 0x80, 0x00, 0x08, 0x09];
          else if (mid === 0x40) payload = [0x46, 0x40, 0xc0, 0x00, 0x00, 0x00];
          else if (MODO06[mid]) payload = [0x46, ...MODO06[mid].replace(/\s/g, '').match(/../g).map((x) => parseInt(x, 16))];
        }
      } else if (modo === 0x09) {
        payload = this._modo09(bytes[1], ecu);
      }
      if (payload) saida.push(this._quadros(ecu, payload, pad));
    }
    return saida;
  }

  _freeze(pid, ecu) {
    if (ecu !== 0x7e8) return null;
    if (pid === 0x00) return [0x42, 0x00, 0x00, ...mascara(PIDS_FREEZE, 0)];
    if (!this.freezeDtc) return null;
    if (pid === 0x02) return [0x42, 0x02, 0x00, ...dtcBytes(this.freezeDtc)];
    if (!PIDS_FREEZE.includes(pid)) return null;
    // valores congelados fixos no momento da falha
    const fixo = { 0x03: [0x02, 0x00], 0x04: [0x8c], 0x05: [0x7a], 0x06: [0x92], 0x07: [0x8c], 0x0b: [0x3c], 0x0c: [0x1a, 0x90], 0x0d: [0x2a], 0x0e: [0x96], 0x0f: [0x47], 0x11: [0x40] };
    return [0x42, pid, 0x00, ...fixo[pid]];
  }

  _modo09(pid, ecu) {
    if (ecu !== 0x7e8) {
      if (pid === 0x00) return [0x49, 0x00, 0x14, 0x40, 0x00, 0x00];
      if (pid === 0x0a) return [0x49, 0x0a, 0x01, ...[...'TCM'].map((c) => c.charCodeAt(0)), 0, ...[...'-TransmisCtrl'].map((c) => c.charCodeAt(0)), 0, 0, 0];
      return null;
    }
    const ascii = (s) => [...s].map((c) => c.charCodeAt(0));
    if (pid === 0x00) return [0x49, 0x00, ...mascara([0x02, 0x04, 0x06, 0x0a], 0)];
    if (pid === 0x0a) return [0x49, 0x0a, 0x01, ...ascii('ECM'), 0, ...ascii('-Engine Control'), 0];
    if (pid === 0x02) return [0x49, 0x02, 0x01, ...ascii('KNAFX411BE5000000')];
    if (pid === 0x04) return [0x49, 0x04, 0x01, ...ascii('DEMO-CAL-GAMMA16').slice(0, 16)];
    if (pid === 0x06) return [0x49, 0x06, 0x01, 0x3a, 0x5c, 0x91, 0x0e];
    return null;
  }

  /** Serviços de diagnóstico UDS/KWP2000 dos módulos Kia simulados. */
  _modulo(bytes) {
    const tx = this.txHeader;
    const rx = tx + 8;
    if (this.filtroRx && this.filtroRx !== rx) return [];
    const m = this.modulos[tx];
    const sid = bytes[0];
    const neg = (nrc) => [0x7f, sid, nrc];
    let p;
    if (sid === 0x10) {
      p = m.proto === 'kwp' && bytes[1] === 0x03 ? neg(0x12) : [0x50, bytes[1], 0x00, 0x32, 0x01, 0xf4];
      if (m.proto === 'kwp') p = bytes[1] === 0x01 || bytes[1] === 0x81 ? [0x50, bytes[1]] : neg(0x12);
      this.sessaoUds[tx] = bytes[1];
    } else if (sid === 0x3e) {
      p = [0x7e, 0x00];
    } else if (sid === 0x19 && bytes[1] === 0x02) {
      if (m.proto !== 'uds') p = neg(0x11);
      else {
        p = [0x59, 0x02, 0xff];
        m.dtcs.forEach(([c, ftb, st]) => p.push(...dtcBytes(c), ftb, st));
        if (m.pendente78 && !m._jaPendente) {
          m._jaPendente = true;
          return [this._quadros(rx, neg(0x78)), this._quadros(rx, p)];
        }
      }
    } else if (sid === 0x18) {
      if (m.proto !== 'kwp') p = neg(0x11);
      else if (m.soAceita1800 && bytes[1] !== 0x00) p = neg(0x12); // como o ABS/ECM reais: formato 18 02 recusado
      else {
        p = [0x58, m.dtcs.length];
        m.dtcs.forEach(([c, , st]) => p.push(...dtcBytes(c), st));
      }
    } else if (sid === 0x14) {
      m.dtcs = [];
      p = m.proto === 'uds' ? [0x54] : [0x54, 0xff, 0x00];
    } else if (sid === 0x1a && bytes[1] === 0x80 && m.idKwp) {
      p = [0x5a, 0x80, ...[...m.idKwp].map((c) => c.charCodeAt(0))];
    } else if (sid === 0x22 && bytes[1] === 0xf1 && bytes[2] === 0x87 && m.pecaUds) {
      p = [0x62, 0xf1, 0x87, ...[...m.pecaUds].map((c) => c.charCodeAt(0))];
    } else if (sid === 0x22 || sid === 0x1a || sid === 0x21) {
      p = neg(0x31);
    } else {
      p = neg(0x11);
    }
    return [this._quadros(rx, p, 0xaa)];
  }
}
