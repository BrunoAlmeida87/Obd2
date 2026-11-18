/* Configurações do app (persistidas em IndexedDB, chave "config"). */
import { kvGet, kvSet } from './storage.js';
import { MODULOS_PADRAO } from './kia.js';

export const PADRAO = {
  tema: 'dark',
  transporte: 'serial',          // 'serial' (Bluetooth clássico SPP) ou 'ble'
  mostrarTodos: false,           // seletor Web Serial sem filtro de SPP
  compat: false,                 // modo compatibilidade para clones
  timeout: 2500,                 // ms esperando o prompt '>'
  tentativas: 2,
  protocoloPreferido: 6,         // ISO 15765-4 CAN 11/500
  motor: '',                     // '1.6' (Gamma) | '2.0' (Nu) | ''
  cambio: '',                    // 'automatico' | 'manual' | ''
  pidsSelecionados: null,        // null = usar seleção padrão do pids.json
  visualizacao: 'medidores',     // 'medidores' | 'lista' | 'grafico'
  intervaloMinimo: 0,            // ms mínimos entre ciclos de leitura
  alertas: [
    { pid: '05', acima: 105, abaixo: null, ativo: true },
    { pid: 'RV', acima: null, abaixo: 12.0, ativo: true }
  ],
  modulos: MODULOS_PADRAO,
  permitirApagarCriticos: false, // ABS/SRS: desativado por padrão
  demo: { motorLigado: true, cloneRuidoso: false },
  ultimoKm: ''
};

export const config = structuredClone(PADRAO);

export async function carregarConfig() {
  try {
    const salvo = await kvGet('config');
    if (salvo) Object.assign(config, structuredClone(PADRAO), salvo, { demo: { ...PADRAO.demo, ...(salvo.demo || {}) } });
  } catch (e) {
    console.warn('Não foi possível carregar a configuração', e);
  }
  aplicarTema();
  return config;
}

export async function salvarConfig(parcial = {}) {
  Object.assign(config, parcial);
  aplicarTema();
  try { await kvSet('config', structuredClone(config)); } catch (e) { console.warn(e); }
}

export function aplicarTema() {
  document.documentElement.dataset.theme = config.tema === 'light' ? 'light' : 'dark';
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.content = config.tema === 'light' ? '#f4f6f9' : '#0b0f14';
}
