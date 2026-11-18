/* Transporte Bluetooth Low Energy via Web Bluetooth.
 * Para adaptadores ELM327 BLE (não serve para o clone SPP clássico).
 * Perfis comuns:
 *   FFE0 -> FFE1 (notificação + escrita)          ex.: clones "BLE 4.0"
 *   FFF0 -> FFF1 (notificação) / FFF2 (escrita)   ex.: clones iOS
 *   18F0 -> 2AF0 (notificação) / 2AF1 (escrita)   ex.: Vgate iCar
 */
import { BaseTransport } from './base.js';

const uuid16 = (h) => `0000${h}-0000-1000-8000-00805f9b34fb`.toLowerCase();

export const PERFIS_BLE = [
  { servico: uuid16('ffe0'), notificar: uuid16('ffe1'), escrever: uuid16('ffe1') },
  { servico: uuid16('fff0'), notificar: uuid16('fff1'), escrever: uuid16('fff2') },
  { servico: uuid16('18f0'), notificar: uuid16('2af0'), escrever: uuid16('2af1') },
  { servico: 'e7810a71-73ae-499d-8c15-faa9aef0c3f2', notificar: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f', escrever: 'bef8d6c9-9c21-4c9e-b632-bd58c1009f9f' }
];

export class BleTransport extends BaseTransport {
  constructor() {
    super();
    this.nome = 'Bluetooth LE';
    this.device = null;
    this.charTx = null;
    this.charRx = null;
    this._enc = new TextEncoder();
    this._dec = new TextDecoder('latin1');
    this._onNotify = (ev) => this._receber(this._dec.decode(ev.target.value));
    this._onGattOff = () => this._caiu();
  }

  static disponivel() {
    return typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  }

  async open() {
    if (!BleTransport.disponivel()) throw new Error('Web Bluetooth indisponível. Abra no Chrome.');
    const servicos = PERFIS_BLE.map((p) => p.servico);
    this.device = await navigator.bluetooth.requestDevice({
      acceptAllDevices: true,
      optionalServices: servicos
    });
    this.device.addEventListener('gattserverdisconnected', this._onGattOff);
    const server = await this.device.gatt.connect();

    // Procura o primeiro perfil conhecido presente no adaptador
    let perfil = null;
    let servico = null;
    for (const p of PERFIS_BLE) {
      try {
        servico = await server.getPrimaryService(p.servico);
        perfil = p;
        break;
      } catch { /* tenta o próximo */ }
    }
    if (!perfil) {
      server.disconnect();
      throw new Error('Este adaptador BLE não tem um serviço ELM327 conhecido (FFE0/FFF0/18F0).');
    }
    this.charRx = await servico.getCharacteristic(perfil.notificar);
    this.charTx = perfil.escrever === perfil.notificar ? this.charRx : await servico.getCharacteristic(perfil.escrever);
    await this.charRx.startNotifications();
    this.charRx.addEventListener('characteristicvaluechanged', this._onNotify);
    this.aberto = true;
  }

  async write(texto) {
    if (!this.aberto || !this.charTx) throw new Error('Adaptador desconectado.');
    const dados = this._enc.encode(texto);
    // BLE: no máximo 20 bytes por pacote no MTU padrão
    for (let i = 0; i < dados.length; i += 20) {
      const parte = dados.slice(i, i + 20);
      if (this.charTx.properties.writeWithoutResponse && this.charTx.writeValueWithoutResponse) {
        await this.charTx.writeValueWithoutResponse(parte);
      } else {
        await this.charTx.writeValue(parte);
      }
    }
  }

  async close() {
    this.aberto = false;
    try {
      this.charRx?.removeEventListener('characteristicvaluechanged', this._onNotify);
      await this.charRx?.stopNotifications();
    } catch { /* ignora */ }
    try {
      this.device?.removeEventListener('gattserverdisconnected', this._onGattOff);
      if (this.device?.gatt?.connected) this.device.gatt.disconnect();
    } catch { /* ignora */ }
    this.device = null;
  }
}
