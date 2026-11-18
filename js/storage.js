/* Armazenamento local em IndexedDB.
 * Stores:
 *   leituras -> cada leitura de erros (ou apagamento) com data, km, VIN, códigos e freeze frame
 *   sessoes  -> gravações de dados ao vivo
 *   kv       -> configurações e outros valores simples */
const NOME_DB = 'cerato-obd';
const VERSAO_DB = 1;

let _db = null;

function abrir() {
  if (_db) return Promise.resolve(_db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(NOME_DB, VERSAO_DB);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains('leituras')) {
        const s = db.createObjectStore('leituras', { keyPath: 'id', autoIncrement: true });
        s.createIndex('data', 'data');
      }
      if (!db.objectStoreNames.contains('sessoes')) {
        const s = db.createObjectStore('sessoes', { keyPath: 'id', autoIncrement: true });
        s.createIndex('data', 'data');
      }
      if (!db.objectStoreNames.contains('kv')) db.createObjectStore('kv');
    };
    req.onsuccess = () => { _db = req.result; resolve(_db); };
    req.onerror = () => reject(req.error || new Error('IndexedDB indisponível.'));
  });
}

async function tx(store, modo, fn) {
  const db = await abrir();
  return new Promise((resolve, reject) => {
    const t = db.transaction(store, modo);
    const s = t.objectStore(store);
    let resultado;
    const req = fn(s);
    if (req) req.onsuccess = () => { resultado = req.result; };
    t.oncomplete = () => resolve(resultado);
    t.onerror = () => reject(t.error);
    t.onabort = () => reject(t.error);
  });
}

// ------------------------------------------------------------ leituras
export const salvarLeitura = (l) => tx('leituras', 'readwrite', (s) => s.put({ ...l, data: l.data || new Date().toISOString() }));
export const obterLeitura = (id) => tx('leituras', 'readonly', (s) => s.get(id));
export const excluirLeitura = (id) => tx('leituras', 'readwrite', (s) => s.delete(id));
export async function listarLeituras() {
  const todas = await tx('leituras', 'readonly', (s) => s.getAll());
  return (todas || []).sort((a, b) => (a.data < b.data ? 1 : -1));
}

// ------------------------------------------------------------ sessões gravadas
export const salvarSessao = (x) => tx('sessoes', 'readwrite', (s) => s.put(x));
export const obterSessao = (id) => tx('sessoes', 'readonly', (s) => s.get(id));
export const excluirSessao = (id) => tx('sessoes', 'readwrite', (s) => s.delete(id));
export async function listarSessoes() {
  // devolve só o resumo (sem as amostras) para a lista ficar leve
  const todas = await tx('sessoes', 'readonly', (s) => s.getAll());
  return (todas || []).map(({ amostras, ...resto }) => ({ ...resto, qtdAmostras: amostras?.length || 0 }))
    .sort((a, b) => (a.data < b.data ? 1 : -1));
}

// ------------------------------------------------------------ chave/valor
export const kvGet = (k) => tx('kv', 'readonly', (s) => s.get(k));
export const kvSet = (k, v) => tx('kv', 'readwrite', (s) => s.put(v, k));

// ------------------------------------------------------------ backup
export async function exportarTudo() {
  const leituras = await tx('leituras', 'readonly', (s) => s.getAll());
  const sessoes = await tx('sessoes', 'readonly', (s) => s.getAll());
  const config = await kvGet('config');
  return {
    app: 'cerato-obd',
    formato: 1,
    exportado_em: new Date().toISOString(),
    config: config || null,
    leituras: leituras || [],
    sessoes: sessoes || []
  };
}

/** Importa um backup. Por padrão mescla (ids novos); com substituir=true apaga tudo antes. */
export async function importarTudo(dados, { substituir = false } = {}) {
  if (!dados || dados.app !== 'cerato-obd' || !Array.isArray(dados.leituras)) {
    throw new Error('Arquivo de backup inválido (não é um backup deste app).');
  }
  if (substituir) {
    await tx('leituras', 'readwrite', (s) => s.clear());
    await tx('sessoes', 'readwrite', (s) => s.clear());
  }
  let n = 0;
  for (const l of dados.leituras) {
    const { id, ...resto } = l;
    await tx('leituras', 'readwrite', (s) => s.add(substituir ? { id, ...resto } : resto));
    n++;
  }
  for (const x of dados.sessoes || []) {
    const { id, ...resto } = x;
    await tx('sessoes', 'readwrite', (s) => s.add(substituir ? { id, ...resto } : resto));
  }
  if (dados.config && substituir) await kvSet('config', dados.config);
  return n;
}

export async function apagarTudo() {
  await tx('leituras', 'readwrite', (s) => s.clear());
  await tx('sessoes', 'readwrite', (s) => s.clear());
}
