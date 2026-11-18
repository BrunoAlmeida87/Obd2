/* Transporte Bluetooth clássico (RFCOMM/SPP) via Web Serial API.
 * Suportado no Chrome para Android (versão 117+). O ELM327 precisa estar
 * PAREADO antes nas configurações de Bluetooth do Android. */
import { BaseTransport } from './base.js';

// UUID do Serial Port Profile (SPP)
export const SPP_UUID = '00001101-0000-1000-8000-00805f9b34fb';

export class SerialBtTransport extends BaseTransport {
  constructor(opcoes = {}) {
    super();
    this.nome = 'Bluetooth (Serial/SPP)';
    this.port = null;
    this.reader = null;
    this.baudRate = opcoes.baudRate || 38400; // ignorado pelo RFCOMM, mas exigido pela API
    this.mostrarTodos = !!opcoes.mostrarTodos;
    this._leitura = null;
    this._enc = new TextEncoder();
    this._dec = new TextDecoder('latin1');
  }

  static disponivel() {
    return typeof navigator !== 'undefined' && 'serial' in navigator;
  }

  async open() {
    if (!SerialBtTransport.disponivel()) {
      throw new Error('Web Serial indisponível neste navegador. Abra no Chrome.');
    }
    const req = { allowedBluetoothServiceClassIds: [SPP_UUID] };
    // Com o filtro, a lista mostra só aparelhos com SPP. Alguns clones não anunciam
    // o serviço corretamente; nesse caso o usuário pode ativar "mostrar todos".
    if (!this.mostrarTodos) req.filters = [{ bluetoothServiceClassId: SPP_UUID }];
    this.port = await navigator.serial.requestPort(req);
    await this._abrirPorta();
  }

  /** Reconecta a uma porta já autorizada antes (sem abrir o seletor). */
  async openPortaConhecida(port) {
    this.port = port;
    await this._abrirPorta();
  }

  async _abrirPorta() {
    await this.port.open({ baudRate: this.baudRate, bufferSize: 4096 });
    this.aberto = true;
    this.port.addEventListener?.('disconnect', () => this._caiu());
    this._leitura = this._loopLeitura();
  }

  async _loopLeitura() {
    while (this.aberto && this.port?.readable) {
      this.reader = this.port.readable.getReader();
      try {
        for (;;) {
          const { value, done } = await this.reader.read();
          if (done) break;
          if (value) this._receber(this._dec.decode(value));
        }
      } catch (e) {
        // erro de leitura = conexão perdida
        console.warn('Serial: erro de leitura', e);
        break;
      } finally {
        try { this.reader.releaseLock(); } catch { /* ignora */ }
        this.reader = null;
      }
    }
    if (this.aberto) this._caiu();
  }

  async write(texto) {
    if (!this.aberto || !this.port?.writable) throw new Error('Adaptador desconectado.');
    const writer = this.port.writable.getWriter();
    try {
      await writer.write(this._enc.encode(texto));
    } finally {
      writer.releaseLock();
    }
  }

  async close() {
    this.aberto = false;
    try { await this.reader?.cancel(); } catch { /* ignora */ }
    try { await this._leitura; } catch { /* ignora */ }
    try { await this.port?.close(); } catch { /* ignora */ }
    this.port = null;
  }
}
