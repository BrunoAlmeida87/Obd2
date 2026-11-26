/* Ponto de entrada: estado global, conexão com o adaptador e navegação entre abas. */
import { Elm327 } from './elm327.js';
import { Obd, TabelaPids } from './obd.js';
import { Kia } from './kia.js';
import { SerialBtTransport } from './transport/serial-bt.js';
import { BleTransport } from './transport/ble.js';
import { SimulatorTransport } from './transport/simulator.js';
import { carregarConfig, config, salvarConfig } from './settings.js';
import { carregarDtcDb } from './dtcdb.js';
import { $, $$, toast, icone } from './ui/dom.js';
import { hidratarIcones } from './ui/icons.js';
import { horaMs } from './util.js';
import * as telaInicio from './ui/home.js';
import * as telaErros from './ui/dtc.js';
import * as telaVivo from './ui/live.js';
import * as telaHistorico from './ui/history.js';
import * as telaMais from './ui/more.js';

// ------------------------------------------------------------------ estado
export const estado = {
  conexao: 'off',        // 'off' | 'conectando' | 'on'
  demo: false,
  transporte: null,
  elm: null,
  obd: null,
  kia: null,
  tabela: null,
  info: {},              // versão, protocolo, tensão
  vin: null,
  status: null,          // resultado do PID 01
  ultimaLeitura: null,   // última leitura de DTCs (objeto salvo no histórico)
  log: [],               // log do terminal (TX/RX)
  progresso: ''
};

const ouvintes = new Set();
/** Telas se inscrevem para redesenhar quando o estado muda. */
export function aoMudar(fn) { ouvintes.add(fn); return () => ouvintes.delete(fn); }
export function notificar() { ouvintes.forEach((fn) => { try { fn(estado); } catch (e) { console.error(e); } }); atualizarPilula(); }

// ------------------------------------------------------------------ compatibilidade
export function apisDisponiveis() {
  return { serial: SerialBtTransport.disponivel(), ble: BleTransport.disponivel() };
}

// ------------------------------------------------------------------ conexão
/**
 * Conecta ao adaptador. tipo: 'serial' | 'ble' | 'demo'.
 * Deve ser chamado a partir de um clique (o seletor de dispositivo exige gesto do usuário).
 */
export async function conectar(tipo = config.transporte) {
  if (estado.conexao === 'conectando') return;
  await desconectar(true);
  let t;
  if (tipo === 'demo') t = new SimulatorTransport({ ...config.demo });
  else if (tipo === 'ble') t = new BleTransport();
  else t = new SerialBtTransport({ mostrarTodos: config.mostrarTodos });

  estado.conexao = 'conectando';
  estado.demo = tipo === 'demo';
  estado.progresso = tipo === 'demo' ? 'Iniciando simulador…' : 'Escolha o adaptador na lista…';
  notificar();

  try {
    await t.open();
  } catch (e) {
    estado.conexao = 'off';
    estado.progresso = '';
    notificar();
    if (e?.name === 'NotFoundError' || /No port selected|cancel/i.test(e?.message || '')) {
      throw new Error('Nenhum adaptador escolhido. Confira se o ELM327 está pareado no Bluetooth do Android.');
    }
    // registra o erro real no log (Mais › Terminal › Copiar log)
    const detalhe = `${e?.name || 'Erro'}: ${e?.message || e}`;
    estado.log.push({ dir: 'er', texto: 'Falha ao abrir: ' + detalhe + (t.tentativasFalhas ? ' | tentativas: ' + t.tentativasFalhas.join(' ; ') : ''), ts: new Date() });
    if (e?.name === 'NetworkError' || /Failed to open|connect/i.test(e?.message || '')) {
      throw new Error('O adaptador não aceitou a conexão (4 tentativas). 1) Feche totalmente outros apps OBD (Car Scanner, Torque) — o adaptador só aceita uma conexão. 2) Desligue e ligue o Bluetooth do celular. 3) Tire e recoloque o adaptador na tomada com a ignição ligada. Detalhe: ' + detalhe);
    }
    throw e;
  }

  estado.transporte = t;
  const elm = new Elm327(t, { timeout: config.timeout, tentativas: config.tentativas, compat: config.compat });
  elm.on('log', (l) => {
    estado.log.push(l);
    if (estado.log.length > 3000) estado.log.splice(0, estado.log.length - 3000);
    ouvintesLog.forEach((fn) => fn(l));
  });
  elm.on('info', (i) => { estado.info = { ...i }; notificar(); });
  estado.elm = elm;
  estado.obd = new Obd(elm, estado.tabela);
  estado.kia = new Kia(elm, () => config);
  t.onDisconnect = () => {
    toast('A conexão com o adaptador caiu.', 'err', 6000);
    estado.conexao = 'off';
    telaVivo.pararLeitura?.();
    notificar();
  };

  try {
    estado.progresso = 'Inicializando o ELM327…';
    notificar();
    await elm.inicializar((p) => { estado.progresso = p; notificar(); }, { protocolo: config.protocoloPreferido });
    estado.info = { ...elm.info };
    estado.progresso = 'Descobrindo PIDs suportados…';
    notificar();
    try { await estado.obd.descobrirPids(); } catch (e) { console.warn('PIDs', e); }
    // a central do câmbio automático (7E9) responde ao OBD: preenche o câmbio se estiver vazio
    if (!config.cambio && estado.obd.suportados.has('7E9')) salvarConfig({ cambio: 'automatico' });
    estado.progresso = 'Lendo VIN e status…';
    notificar();
    try { estado.vin = await estado.obd.lerVin(); } catch (e) { console.warn('VIN', e); }
    try { estado.status = await estado.obd.lerStatus(); } catch (e) { console.warn('Status', e); }
    estado.conexao = 'on';
    estado.progresso = '';
    notificar();
    toast(estado.demo ? 'Modo demonstração conectado.' : 'Conectado ao carro!', 'ok');
  } catch (e) {
    estado.progresso = '';
    await desconectar(true);
    throw e;
  }
}

export async function desconectar(silencioso = false) {
  telaVivo.pararLeitura?.();
  const t = estado.transporte;
  estado.transporte = null;
  estado.elm = null;
  estado.obd = null;
  estado.kia = null;
  estado.conexao = 'off';
  estado.status = null;
  if (t) { t.onDisconnect = null; try { await t.close(); } catch { /* ignora */ } }
  if (!silencioso) toast('Desconectado.');
  notificar();
}

export function conectado() { return estado.conexao === 'on' && !!estado.elm; }

/** Garante conexão antes de uma operação; mostra mensagem clara se não houver. */
export function exigirConexao() {
  if (!conectado()) throw new Error('Conecte ao adaptador (ou ative o modo demo) na aba Início.');
}

// ------------------------------------------------------------------ log do terminal
const ouvintesLog = new Set();
export function aoLog(fn) { ouvintesLog.add(fn); return () => ouvintesLog.delete(fn); }
export function textoLog() {
  return estado.log.map((l) => `${horaMs(l.ts)} ${l.dir.toUpperCase().padEnd(2)} ${l.texto}`).join('\n');
}

// ------------------------------------------------------------------ navegação
const TELAS = {
  home: { titulo: 'Início', mod: telaInicio },
  dtc: { titulo: 'Códigos de erro', mod: telaErros },
  live: { titulo: 'Ao vivo', mod: telaVivo },
  history: { titulo: 'Histórico', mod: telaHistorico },
  more: { titulo: 'Mais', mod: telaMais }
};
let telaAtual = null;
let limparTela = null;

/** Navega para uma aba (e opcionalmente uma sub-tela, ex.: "more/terminal"). */
export function ir(rota) {
  if (location.hash !== '#' + rota) history.pushState(null, '', '#' + rota);
  renderizar(true);
}

let rotaRenderizada = null;
/** Desenha a tela da rota atual. Sem "forcar", ignora eventos repetidos da mesma rota. */
function renderizar(forcar = false) {
  const rota = (location.hash.slice(1) || 'home');
  if (!forcar && rota === rotaRenderizada) return;
  rotaRenderizada = rota;
  const [aba, ...resto] = rota.split('/');
  const tela = TELAS[aba] || TELAS.home;
  if (typeof limparTela === 'function') { try { limparTela(); } catch (e) { console.error(e); } }
  limparTela = null;
  telaAtual = aba;
  $$('#tabbar button').forEach((b) => b.classList.toggle('active', b.dataset.tab === aba));
  const view = $('#view');
  view.innerHTML = '';
  const sub = resto.join('/');
  definirTitulo(tela.titulo, !!sub);
  limparTela = tela.mod.render(view, sub, { definirTitulo }) || null;
  view.focus({ preventScroll: true });
  window.scrollTo(0, 0);
}

export function definirTitulo(titulo, mostrarVoltar = false) {
  $('#screenTitle').textContent = titulo;
  const b = $('#btnBack');
  b.classList.toggle('hidden', !mostrarVoltar);
}

function atualizarPilula() {
  const p = $('#connPill');
  if (!p) return;
  const mapa = {
    off: ['off', 'Desconectado'],
    conectando: ['busy', 'Conectando…'],
    on: [estado.demo ? 'demo' : 'on', estado.demo ? 'Demo' : 'Conectado']
  };
  const [st, txt] = mapa[estado.conexao] || mapa.off;
  p.dataset.state = st;
  p.querySelector('.label').textContent = txt;
}

export function mostrarBanner(html, tipo = '') {
  const b = $('#banner');
  if (!html) { b.classList.add('hidden'); return; }
  b.className = 'banner ' + tipo;
  b.innerHTML = html;
}

// ------------------------------------------------------------------ inicialização
async function iniciar() {
  hidratarIcones();
  $('#btnBack').innerHTML = icone('back');
  $('#btnBack').addEventListener('click', () => history.back());
  $$('#tabbar button').forEach((b) => b.addEventListener('click', () => ir(b.dataset.tab)));
  // pushState não dispara eventos; voltar/avançar disparam popstate e/ou hashchange
  window.addEventListener('popstate', () => renderizar(false));
  window.addEventListener('hashchange', () => renderizar(false));

  await carregarConfig();
  try {
    const resp = await fetch('data/pids.json');
    estado.tabela = new TabelaPids(await resp.json());
  } catch (e) {
    toast('Falha ao carregar a tabela de PIDs.', 'err');
  }
  carregarDtcDb().catch(() => toast('Falha ao carregar o banco de códigos.', 'err'));
  fetch('data/modo06.json').then((r) => r.json()).then((j) => { estado.tab06 = j; }).catch(() => {});

  const apis = apisDisponiveis();
  if (!apis.serial && !apis.ble) {
    mostrarBanner(`${icone('alert')} <b>Abra no Chrome.</b> Este navegador não tem acesso ao Bluetooth (Web Serial/Web Bluetooth). No Samsung Internet e no Firefox só o modo demonstração funciona.`, 'bad');
  } else if (!apis.serial) {
    mostrarBanner('Web Serial indisponível: o ELM327 Bluetooth clássico (SPP) precisa do Chrome para Android 117 ou mais novo. BLE e demo funcionam.', '');
  }
  if (!window.isSecureContext) {
    mostrarBanner('O app precisa ser aberto em HTTPS para acessar o Bluetooth.', 'bad');
  }

  // Service worker para funcionar offline
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('sw.js').catch((e) => console.warn('SW', e));
  }

  // Modo painel automático ao virar o celular na tela Ao vivo
  const mq = matchMedia('(orientation: landscape) and (max-height: 600px)');
  mq.addEventListener?.('change', () => telaVivo.aoGirar?.(mq.matches));

  renderizar(true);
  atualizarPilula();
}

// expõe para depuração no console
window.ceratoObd = { estado, conectar, desconectar };

iniciar();
