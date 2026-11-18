/* Funções OBD2 padrão (SAE J1979): modos 01, 02, 03, 04, 07, 09 e 0A.
 * As fórmulas dos PIDs vêm de data/pids.json (tabela declarativa). */

const hex2 = (n) => n.toString(16).toUpperCase().padStart(2, '0');

/** Decodifica 2 bytes de DTC: bits 7-6 = P/C/B/U, bits 5-4 = 1º dígito, resto = 3 dígitos hex. */
export function decodificarDtc(a, b) {
  const letra = 'PCBU'[a >> 6];
  const d1 = (a >> 4) & 0x03;
  const d2 = (a & 0x0f).toString(16).toUpperCase();
  return `${letra}${d1}${d2}${hex2(b)}`;
}

/** Compila uma fórmula da tabela (somente A-D, números e operadores). */
export function compilarFormula(f) {
  const limpo = f.replace(/NaN/g, '');
  if (!/^[\sA-D0-9+\-*/().?:<>=!&|]+$/.test(limpo)) throw new Error('Fórmula inválida: ' + f);
  // eslint-disable-next-line no-new-func
  return new Function('A', 'B', 'C', 'D', `return (${f});`);
}

export class TabelaPids {
  constructor(json) {
    this.json = json;
    this.porPid = new Map();
    for (const p of json.pids) {
      const item = { ...p };
      if (p.formula) item.fn = compilarFormula(p.formula);
      if (p.extra?.formula) item.extraFn = compilarFormula(p.extra.formula);
      this.porPid.set(p.pid, item);
    }
  }
  get(pid) { return this.porPid.get(pid); }
  get todos() { return [...this.porPid.values()]; }

  /** Converte bytes em valor físico. Retorna { valor, texto, extra } */
  decodificar(pid, bytes) {
    const def = this.get(pid);
    if (!def) return { valor: null, texto: bytes.map(hex2).join(' ') };
    const [A = 0, B = 0, C = 0, D = 0] = bytes;
    if (def.tipo === 'enum') {
      const chave = hex2(A);
      const texto = def.opcoes?.[chave] ?? `Código ${chave}`;
      return { valor: A, texto };
    }
    if (def.tipo === 'especial' || !def.fn) return { valor: null, texto: bytes.map(hex2).join(' ') };
    const valor = def.fn(A, B, C, D);
    const r = { valor, texto: formatarNumero(valor, def.casas) };
    if (def.extraFn) {
      const ev = def.extraFn(A, B, C, D);
      r.extra = { nome: def.extra.nome, valor: ev, texto: Number.isNaN(ev) ? '—' : formatarNumero(ev, def.extra.casas) + ' ' + def.extra.unidade };
    }
    return r;
  }
}

export function formatarNumero(v, casas = 0) {
  if (v === null || v === undefined || Number.isNaN(v)) return '—';
  return Number(v).toLocaleString('pt-BR', { minimumFractionDigits: casas, maximumFractionDigits: casas });
}

/** Erro amigável quando nenhuma ECU responde. */
export class ErroObd extends Error {
  constructor(msg, codigo) { super(msg); this.codigo = codigo; }
}

export class Obd {
  constructor(elm, tabela) {
    this.elm = elm;
    this.tab = tabela;
    this.suportados = new Map(); // ecu -> Set de PIDs (hex)
    this.suportadosUniao = new Set();
    this.multiPid = true; // pedir até 6 PIDs por vez (CAN)
  }

  _respostas(r, sidEsperado) {
    return r.msgs.filter((m) => m.dados[0] === sidEsperado);
  }

  _negativas(r) {
    return r.msgs.filter((m) => m.dados[0] === 0x7f);
  }

  /** Lança erro legível se o pedido falhou por completo. */
  _verificar(r) {
    if (r.erro && !r.msgs.length) throw new ErroObd(r.erro.msg, r.erro.codigo);
  }

  // ------------------------------------------------------------------ modo 01
  /** Descobre os PIDs suportados (00, 20, 40, 60, 80, A0, C0) e guarda por ECU. */
  async descobrirPids() {
    await this.elm.restaurarPadrao();
    this.suportados.clear();
    this.suportadosUniao.clear();
    for (const base of [0x00, 0x20, 0x40, 0x60, 0x80, 0xa0, 0xc0]) {
      const r = await this.elm.pedir('01' + hex2(base), { timeout: 3000 });
      const resp = this._respostas(r, 0x41).filter((m) => m.dados[1] === base);
      if (!resp.length) {
        if (base === 0) this._verificar(r);
        break;
      }
      let continua = false;
      for (const m of resp) {
        const set = this.suportados.get(m.ecu) || new Set();
        const mascara = m.dados.slice(2, 6);
        for (let i = 0; i < 32; i++) {
          if (mascara[i >> 3] & (0x80 >> (i & 7))) {
            const pid = hex2(base + i + 1);
            set.add(pid);
            this.suportadosUniao.add(pid);
          }
        }
        this.suportados.set(m.ecu, set);
        if (set.has(hex2(base + 0x20))) continua = true;
      }
      if (!continua) break;
    }
    return this.suportadosUniao;
  }

  suporta(pid) { return pid === 'RV' || this.suportadosUniao.has(pid); }

  /**
   * Lê vários PIDs do modo 01. Em CAN usa pedidos com até 6 PIDs (mais rápido).
   * Retorna Map pid -> { valor, texto, extra, ecu }.
   */
  async lerPids(pids) {
    const resultado = new Map();
    const lista = pids.filter((p) => p !== 'RV' && this.tab.get(p));
    const grupoMax = this.multiPid && this.elm.ehCan ? 6 : 1;
    for (let i = 0; i < lista.length; i += grupoMax) {
      const grupo = lista.slice(i, i + grupoMax);
      const r = await this.elm.pedir('01' + grupo.join(''), { tentativas: 1 });
      if (r.erro && !r.msgs.length) {
        if (r.erro.codigo === 'NO_DATA' && grupo.length > 1) {
          // alguma ECU não aceita multi-PID: cai para um por vez
          this.multiPid = false;
          const sub = await this.lerPids(grupo);
          sub.forEach((v, k) => resultado.set(k, v));
          continue;
        }
        if (['TIMEOUT', 'DESCONECTADO', 'ESCRITA'].includes(r.erro.codigo)) throw new ErroObd(r.erro.msg, r.erro.codigo);
        continue;
      }
      for (const m of this._respostas(r, 0x41)) {
        this._decodificarMulti(m.dados.slice(1), m.ecu, resultado);
      }
    }
    if (pids.includes('RV')) {
      const v = await this.elm.lerTensao();
      if (v !== null) resultado.set('RV', { valor: v, texto: formatarNumero(v, 1), ecu: 'ELM' });
    }
    return resultado;
  }

  /** Percorre a resposta "PID dados PID dados ..." usando o tamanho de cada PID da tabela. */
  _decodificarMulti(bytes, ecu, saida) {
    let i = 0;
    while (i < bytes.length) {
      const pid = hex2(bytes[i]);
      const def = this.tab.get(pid);
      if (!def) break; // não sabemos o tamanho: para aqui
      const n = def.bytes || 1;
      const dados = bytes.slice(i + 1, i + 1 + n);
      if (dados.length < n) break;
      // se duas ECUs responderem o mesmo PID, mantém o do motor (primeiro)
      if (!saida.has(pid)) saida.set(pid, { ...this.tab.decodificar(pid, dados), ecu, bytes: dados });
      i += 1 + n;
    }
  }

  /** Modo 01 PID 01: MIL, número de DTCs e monitores de prontidão por ECU. */
  async lerStatus() {
    await this.elm.restaurarPadrao();
    const r = await this.elm.pedir('0101');
    this._verificar(r);
    const mons = this.tab.json.monitores;
    const porEcu = [];
    for (const m of this._respostas(r, 0x41).filter((x) => x.dados[1] === 0x01)) {
      const [A, B, C, D] = m.dados.slice(2, 6);
      const compressao = !!(B & 0x08);
      const lista = [];
      for (const mon of mons.continuos) {
        const sup = !!(B & (1 << mon.bit));
        const inc = !!(B & (1 << (mon.bit + 4)));
        lista.push({ ...mon, tipo: 'contínuo', suportado: sup, completo: sup && !inc });
      }
      for (const mon of compressao ? mons.compressao : mons.faisca) {
        const sup = !!(C & (1 << mon.bit));
        const inc = !!(D & (1 << mon.bit));
        lista.push({ ...mon, tipo: 'não contínuo', suportado: sup, completo: sup && !inc });
      }
      porEcu.push({ ecu: m.ecu, mil: !!(A & 0x80), qtdDtc: A & 0x7f, compressao, monitores: lista });
    }
    if (!porEcu.length) throw new ErroObd('A ECU não informou o status (PID 01).', 'NO_DATA');
    const motor = porEcu.find((e) => /7E8|^10$/.test(e.ecu)) || porEcu[0];
    return {
      mil: porEcu.some((e) => e.mil),
      qtdDtc: porEcu.reduce((s, e) => s + e.qtdDtc, 0),
      monitores: motor.monitores,
      incompletos: motor.monitores.filter((x) => x.suportado && !x.completo).length,
      porEcu
    };
  }

  // ------------------------------------------------------------------ modos 03/07/0A
  /**
   * Lê DTCs. modo: '03' armazenados, '07' pendentes, '0A' permanentes.
   * Retorna [{ codigo, ecu }] sem duplicatas por ECU.
   */
  async lerDtcs(modo = '03') {
    await this.elm.restaurarPadrao();
    const sid = parseInt(modo, 16) + 0x40;
    const r = await this.elm.pedir(modo, { timeout: 4000 });
    if (r.erro && !r.msgs.length) {
      if (r.erro.codigo === 'NO_DATA') return []; // nenhuma ECU com códigos (ou modo não suportado)
      throw new ErroObd(r.erro.msg, r.erro.codigo);
    }
    const saida = [];
    const vistos = new Set();
    const msgs = this._respostas(r, sid);
    // Em CAN o byte após o SID é a quantidade; em K-line/J1850 não existe
    const can = this.elm.ehCan;
    for (const m of msgs) {
      let dados = m.dados.slice(1);
      if (can) {
        const qtd = dados[0];
        dados = dados.slice(1, 1 + qtd * 2);
      }
      for (let i = 0; i + 1 < dados.length; i += 2) {
        if (dados[i] === 0 && dados[i + 1] === 0) continue; // preenchimento
        const codigo = decodificarDtc(dados[i], dados[i + 1]);
        const chave = m.ecu + codigo;
        if (vistos.has(chave)) continue;
        vistos.add(chave);
        saida.push({ codigo, ecu: m.ecu });
      }
    }
    return saida;
  }

  // ------------------------------------------------------------------ modo 02
  /** Freeze frame (quadro 00): DTC que causou e valores congelados. */
  async lerFreezeFrame() {
    await this.elm.restaurarPadrao();
    const r = await this.elm.pedir('020200');
    const resp = this._respostas(r, 0x42).find((m) => m.dados[1] === 0x02);
    if (!resp) return null;
    const [a, b] = resp.dados.slice(3, 5);
    if (!a && !b) return null; // sem freeze frame armazenado
    const dtc = decodificarDtc(a, b);
    const ecu = resp.ecu;

    // descobre quais PIDs existem no freeze frame
    const suportados = [];
    for (const base of [0x00, 0x20, 0x40]) {
      const rs = await this.elm.pedir('02' + hex2(base) + '00');
      const m = this._respostas(rs, 0x42).find((x) => x.ecu === ecu && x.dados[1] === base);
      if (!m) break;
      const mascara = m.dados.slice(3, 7);
      for (let i = 0; i < 32; i++) if (mascara[i >> 3] & (0x80 >> (i & 7))) suportados.push(hex2(base + i + 1));
      if (!suportados.includes(hex2(base + 0x20))) break;
    }
    const lista = suportados.length ? suportados : [...this.suportadosUniao];
    const valores = [];
    for (const pid of lista) {
      const def = this.tab.get(pid);
      if (!def || def.tipo === 'especial' || pid === '02' || /^(20|40|60)$/.test(pid)) continue;
      const rv = await this.elm.pedir('02' + pid + '00', { tentativas: 0 });
      const m = this._respostas(rv, 0x42).find((x) => x.ecu === ecu && hex2(x.dados[1]) === pid);
      if (!m) continue;
      const dec = this.tab.decodificar(pid, m.dados.slice(3, 3 + (def.bytes || 1)));
      valores.push({ pid, nome: def.nome, unidade: def.unidade || '', ...dec });
    }
    return { dtc, ecu, valores, data: new Date().toISOString() };
  }

  // ------------------------------------------------------------------ modo 04
  /** Verifica se o motor está desligado (RPM = 0) antes de apagar. */
  async motorDesligado() {
    const r = await this.lerPids(['0C']);
    const rpm = r.get('0C')?.valor;
    if (rpm === undefined) {
      throw new ErroObd('Não foi possível ler a rotação. Ligue a ignição (sem dar partida) e tente de novo.', 'NO_RPM');
    }
    return rpm < 50;
  }

  /** Modo 04: apaga DTCs e zera monitores de prontidão. */
  async apagarDtcs() {
    await this.elm.restaurarPadrao();
    const r = await this.elm.pedir('04', { timeout: 5000, tentativas: 0 });
    const neg = this._negativas(r);
    if (neg.length) {
      const nrc = neg[0].dados[2];
      if (nrc === 0x22) throw new ErroObd('A ECU recusou: condições incorretas. Desligue o motor e deixe só a ignição ligada.', 'NRC22');
      throw new ErroObd(`A ECU recusou o apagamento (código ${hex2(nrc)}).`, 'NRC');
    }
    this._verificar(r);
    const ok = this._respostas(r, 0x44);
    if (!ok.length) throw new ErroObd('Nenhuma ECU confirmou o apagamento.', 'SEM_CONFIRMACAO');
    return ok.map((m) => m.ecu);
  }

  // ------------------------------------------------------------------ modo 09
  async _modo09(pid) {
    await this.elm.restaurarPadrao();
    const r = await this.elm.pedir('09' + pid, { timeout: 4000 });
    return this._respostas(r, 0x49).filter((m) => hex2(m.dados[1]) === pid);
  }

  /** Junta respostas de K-line/J1850 (várias linhas numeradas) ou CAN (uma mensagem). */
  _dados09(m, todas) {
    if (this.elm.ehCan) return m.dados.slice(3); // 49 PID NN dados...
    const doMesmo = todas.filter((x) => x.ecu === m.ecu).sort((a, b) => a.dados[2] - b.dados[2]);
    return doMesmo.flatMap((x) => x.dados.slice(3));
  }

  async lerVin() {
    const msgs = await this._modo09('02');
    if (!msgs.length) return null;
    const bytes = this._dados09(msgs[0], msgs).filter((b) => b >= 0x20 && b < 0x7f);
    const vin = String.fromCharCode(...bytes).replace(/[^A-HJ-NPR-Z0-9]/gi, '').slice(-17);
    return vin || null;
  }

  async lerCalibracao() {
    const msgs = await this._modo09('04');
    const saida = [];
    for (const m of msgs) {
      const bytes = this._dados09(m, msgs);
      for (let i = 0; i < bytes.length; i += 16) {
        const txt = String.fromCharCode(...bytes.slice(i, i + 16).filter((b) => b >= 0x20 && b < 0x7f)).trim();
        if (txt) saida.push({ ecu: m.ecu, calid: txt });
      }
      if (this.elm.ehCan) continue;
      break;
    }
    return saida;
  }

  async lerCvn() {
    const msgs = await this._modo09('06');
    const saida = [];
    for (const m of msgs) {
      const bytes = this._dados09(m, msgs);
      for (let i = 0; i + 3 < bytes.length; i += 4) saida.push({ ecu: m.ecu, cvn: bytes.slice(i, i + 4).map(hex2).join('') });
      if (!this.elm.ehCan) break;
    }
    return saida;
  }
}
