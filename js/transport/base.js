/* Classe base dos transportes.
 * Todos os transportes (Serial Bluetooth, BLE e simulador) expõem a mesma interface:
 *   open()            -> conecta (pode abrir o seletor de dispositivo do navegador)
 *   write(texto)      -> envia texto ASCII para o adaptador
 *   read(timeoutMs)   -> devolve o que chegou desde a última leitura ('' se estourar o tempo)
 *   close()           -> desconecta
 * Os dados recebidos são acumulados em um buffer interno; read() espera até chegar algo. */
export class BaseTransport {
  constructor() {
    this.nome = 'base';
    this.aberto = false;
    this._buf = '';
    this._esperas = [];
    /** Chamado quando a conexão cai sem o usuário pedir. */
    this.onDisconnect = null;
  }

  /** Usado pelas subclasses quando chegam bytes do adaptador. */
  _receber(texto) {
    if (!texto) return;
    this._buf += texto;
    const esperas = this._esperas.splice(0);
    esperas.forEach((fn) => fn());
  }

  /** Lê o que houver no buffer; se vazio, espera até timeoutMs. */
  async read(timeoutMs = 1000) {
    if (!this._buf) {
      await new Promise((resolve) => {
        let timer = null;
        const acordar = () => { clearTimeout(timer); resolve(); };
        timer = setTimeout(() => {
          const i = this._esperas.indexOf(acordar);
          if (i >= 0) this._esperas.splice(i, 1);
          resolve();
        }, timeoutMs);
        this._esperas.push(acordar);
      });
    }
    const dados = this._buf;
    this._buf = '';
    return dados;
  }

  /** Descarta qualquer lixo pendente antes de um novo comando. */
  limparEntrada() {
    this._buf = '';
  }

  _caiu() {
    const estava = this.aberto;
    this.aberto = false;
    // acorda quem estiver esperando leitura
    const esperas = this._esperas.splice(0);
    esperas.forEach((fn) => fn());
    if (estava && typeof this.onDisconnect === 'function') this.onDisconnect();
  }

  async open() { throw new Error('não implementado'); }
  async write() { throw new Error('não implementado'); }
  async close() { this.aberto = false; }
}
