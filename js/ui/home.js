/* Aba Início: status da conexão, botão Conectar, dados do adaptador e botão "Ler erros". */
import { estado, aoMudar, conectar, desconectar, apisDisponiveis, ir, conectado } from '../app.js';
import { config, salvarConfig } from '../settings.js';
import { el, $, icone, escHtml, comCarregamento, toast } from './dom.js';
import { lerErros } from './dtc.js';
import { formatarNumero } from '../obd.js';

export function render(view) {
  const raiz = el('<div class="stack"></div>');
  view.appendChild(raiz);
  const desenhar = () => { raiz.innerHTML = html(); ligar(raiz); };
  desenhar();
  return aoMudar(desenhar);
}

function html() {
  const c = estado.conexao;
  const apis = apisDisponiveis();
  const i = estado.info || {};
  const st = estado.status;
  const rotuloConexao = { off: 'Desconectado', conectando: 'Conectando…', on: estado.demo ? 'Conectado (demonstração)' : 'Conectado' }[c];

  let blocoConexao;
  if (c === 'off') {
    blocoConexao = `
      <button class="btn primary big" id="btnConectar" ${!apis.serial && config.transporte === 'serial' && !apis.ble ? 'disabled' : ''}>
        ${icone('bt')} Conectar ${config.transporte === 'ble' ? '(BLE)' : ''}
      </button>
      <div class="btn-grid">
        <button class="btn" id="btnTrocar">${icone('bt')} ${config.transporte === 'ble' ? 'Usar Bluetooth clássico' : 'Usar BLE'}</button>
        <button class="btn" id="btnDemo">${icone('demo')} Modo demo</button>
      </div>
      ${!apis.serial && !apis.ble ? `<div class="card"><b>Abra no Chrome.</b> <span class="muted">Este navegador não permite acesso ao Bluetooth. Use o Google Chrome no Android (versão 117 ou mais nova).</span></div>` : ''}
      <details class="card" ${localStorage.getItem('dicaPareamentoVista') ? '' : 'open'} id="dicaPar">
        <summary><b>Antes de conectar (primeira vez)</b></summary>
        <ol class="clean small">
          <li>Encaixe o ELM327 na tomada OBD (embaixo do painel, lado do motorista).</li>
          <li>Ligue a <b>ignição</b> (motor pode ficar desligado).</li>
          <li>No Android: <b>Configurações › Conexões › Bluetooth</b>, procure “OBDII”/“OBD2”/“V-LINK” e <b>pareie</b> com o PIN <b>1234</b> (ou 0000).</li>
          <li>Volte aqui no <b>Chrome</b>, toque em <b>Conectar</b> e escolha o adaptador na lista.</li>
          <li>Se o adaptador não aparecer, ative “Mostrar todos os dispositivos” em Mais › Configurações.</li>
        </ol>
      </details>`;
  } else if (c === 'conectando') {
    blocoConexao = `<div class="card"><div class="row"><span class="btn ghost" style="border:0;padding:0;min-height:0"><span class="spin"></span></span><div><b>Conectando…</b><div class="muted small">${escHtml(estado.progresso || '')}</div></div></div></div>`;
  } else {
    blocoConexao = `
      <button class="btn primary big" id="btnLer">${icone('search')} Ler erros</button>
      <div class="btn-grid">
        <button class="btn" id="btnVivo">${icone('gauge')} Dados ao vivo</button>
        <button class="btn" id="btnDesc">${icone('x')} Desconectar</button>
      </div>`;
  }

  const milHtml = st
    ? `<div class="mil ${st.mil ? 'on' : 'off'}"><div class="lamp">${icone('engine')}</div>
        <div><b>${st.mil ? 'Luz de injeção ACESA' : 'Luz de injeção apagada'}</b>
        <div class="muted small">${st.qtdDtc} código(s) confirmado(s) · ${st.incompletos} monitor(es) incompleto(s)</div></div></div>`
    : `<div class="mil"><div class="lamp">${icone('engine')}</div><div><b>Luz de injeção</b><div class="muted small">${c === 'on' ? 'Toque em “Ler erros”.' : 'Conecte para verificar.'}</div></div></div>`;

  return `
    <div class="card">
      <div class="row between">
        <div><div class="muted small">Status</div><div style="font-size:1.3rem;font-weight:800">${rotuloConexao}</div></div>
        <div class="muted small" style="text-align:right">${escHtml(estado.transporte?.nome || (config.transporte === 'ble' ? 'Bluetooth LE' : 'Bluetooth clássico (SPP)'))}</div>
      </div>
    </div>
    ${blocoConexao}
    <div class="card">${milHtml}</div>
    <div class="status-grid">
      <div class="stat"><div class="k">${icone('battery', 'i')} Bateria</div><div class="v" id="vBat">${i.tensao != null ? formatarNumero(i.tensao, 1) + ' V' : '—'}</div></div>
      <div class="stat"><div class="k">${icone('chip', 'i')} ELM</div><div class="v sm">${escHtml(i.versao || '—')}</div></div>
      <div class="stat wide"><div class="k">Protocolo</div><div class="v sm">${escHtml(i.protocolo || '—')}</div></div>
      <div class="stat wide"><div class="k">VIN</div><div class="v sm mono">${escHtml(estado.vin || '—')}</div></div>
    </div>
    ${estado.ultimaLeitura ? resumoUltima() : ''}
    <p class="muted small center">Cerato OBD2 · sem anúncios · funciona offline${config.motor ? ` · motor ${escHtml(config.motor)}` : ''}${config.cambio ? ` · câmbio ${escHtml(config.cambio)}` : ''}</p>`;
}

function resumoUltima() {
  const l = estado.ultimaLeitura;
  const n = (l.dtcs?.armazenados?.length || 0) + (l.dtcs?.pendentes?.length || 0) + (l.dtcs?.permanentes?.length || 0);
  return `<button class="card" id="btnUltima" style="width:100%;text-align:left;cursor:pointer">
    <div class="muted small">Última leitura</div>
    <b>${n} código(s)</b> <span class="muted small">— toque para ver</span></button>`;
}

function ligar(raiz) {
  $('#btnConectar', raiz)?.addEventListener('click', (e) => {
    localStorage.setItem('dicaPareamentoVista', '1');
    comCarregamento(e.currentTarget, () => conectar(config.transporte), 'Conectando…');
  });
  $('#btnDemo', raiz)?.addEventListener('click', (e) => comCarregamento(e.currentTarget, () => conectar('demo'), 'Iniciando…'));
  $('#btnTrocar', raiz)?.addEventListener('click', async () => {
    await salvarConfig({ transporte: config.transporte === 'ble' ? 'serial' : 'ble' });
    toast(config.transporte === 'ble' ? 'Usando Bluetooth LE (adaptadores BLE).' : 'Usando Bluetooth clássico (SPP).');
    raiz.innerHTML = html(); ligar(raiz);
  });
  $('#btnDesc', raiz)?.addEventListener('click', () => desconectar());
  $('#btnVivo', raiz)?.addEventListener('click', () => ir('live'));
  $('#btnUltima', raiz)?.addEventListener('click', () => ir('dtc'));
  $('#btnLer', raiz)?.addEventListener('click', (e) => {
    if (!conectado()) return;
    comCarregamento(e.currentTarget, async () => {
      const ok = await lerErros();
      if (ok) ir('dtc');
    }, 'Lendo erros…');
  });
}
