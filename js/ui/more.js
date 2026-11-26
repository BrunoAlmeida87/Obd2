/* Aba Mais: prontidão, informações do veículo, varredura de módulos, terminal,
 * configurações, modo demonstração e ajuda. */
import { estado, aoMudar, conectado, exigirConexao, conectar, aoLog, textoLog, ir, definirTitulo } from '../app.js';
import { config, salvarConfig, PADRAO } from '../settings.js';
import { MODULOS_PADRAO } from '../kia.js';
import { infoDb, pesquisar, todosProblemas, buscarDtc } from '../dtcdb.js';
import { apagarTudo } from '../storage.js';
import { el, $, $$, icone, escHtml, modal, confirmar, toast, vazio, comCarregamento } from './dom.js';
import { abrirDetalhe } from './dtc.js';
import { horaMs, copiarTexto, baixarArquivo, carimbo } from '../util.js';
import { coletarCompleto, coletarTecnico, coletarCorrelacao } from '../coleta.js';
import { gerarRelatorioHtml, gerarRelatorioCompletoHtml, abrirHtml } from './report.js';
import { listarLeituras } from '../storage.js';
import { comparar } from './history.js';

const SUBTELAS = {
  relatorios: { titulo: 'Relatórios', icone: 'printer', desc: 'Erros, carro completo e relatório técnico para melhorar o app', fn: telaRelatorios },
  testes: { titulo: 'Testes dos monitores (modo 06)', icone: 'chart', desc: 'Resultado dos testes internos: catalisador, sondas, comando variável', fn: telaTestes },
  prontidao: { titulo: 'Prontidão (monitores)', icone: 'shield', desc: 'Monitores completos/incompletos e luz de injeção', fn: telaProntidao },
  veiculo: { titulo: 'Informações do veículo', icone: 'car', desc: 'VIN, calibração (CALID), CVN, adaptador', fn: telaVeiculo },
  varredura: { titulo: 'Varredura de módulos', icone: 'scan', desc: 'Descobrir quais endereços 7xx respondem (experimental)', fn: telaVarredura },
  terminal: { titulo: 'Terminal', icone: 'terminal', desc: 'Comandos AT/OBD manuais com log completo', fn: telaTerminal },
  config: { titulo: 'Configurações', icone: 'settings', desc: 'Tema, conexão, alertas, módulos, segurança', fn: telaConfig },
  demo: { titulo: 'Modo demonstração', icone: 'demo', desc: 'Simulador de ELM327 para testar sem o carro', fn: telaDemo },
  ajuda: { titulo: 'Ajuda e banco de códigos', icone: 'help', desc: 'Pareamento, problemas conhecidos, busca de códigos', fn: telaAjuda }
};

export function render(view, sub) {
  if (sub && SUBTELAS[sub]) {
    definirTitulo(SUBTELAS[sub].titulo, true);
    // cada subtela ganha o próprio contêiner: se uma operação assíncrona terminar
    // depois que o usuário sair da tela, ela redesenha um elemento já desanexado
    const cont = el('<div></div>');
    view.appendChild(cont);
    return SUBTELAS[sub].fn(cont);
  }
  view.innerHTML = `<ul class="menu">${Object.entries(SUBTELAS).map(([id, s]) => `<li><button data-sub="${id}">${icone(s.icone)}<span class="t"><b>${s.titulo}</b><span>${s.desc}</span></span>${icone('next')}</button></li>`).join('')}</ul>
    <p class="muted small center" style="margin-top:16px">Cerato OBD2 · v1.0 · código aberto · sem anúncios</p>`;
  $$('[data-sub]', view).forEach((b) => b.addEventListener('click', () => ir('more/' + b.dataset.sub)));
  return null;
}

// ------------------------------------------------------------------ prontidão
function telaProntidao(view) {
  const desenhar = () => {
    const st = estado.status;
    const mons = estado.tabela?.json.monitores;
    let corpo;
    if (!st) corpo = vazio('shield', conectado() ? 'Toque em “Atualizar”.' : 'Conecte para ler os monitores.');
    else {
      const linhas = st.monitores.map((m) => `<div class="mon"><div><b>${escHtml(m.nome)}</b><div class="muted small">${escHtml(m.explicacao)}</div></div>
        <span class="st ${!m.suportado ? 'na' : m.completo ? 'ok' : 'inc'}">${!m.suportado ? 'N/A' : m.completo ? 'Completo' : 'Incompleto'}</span></div>`).join('');
      corpo = `<div class="card"><div class="mil ${st.mil ? 'on' : 'off'}"><div class="lamp">${icone('engine')}</div><div><b>${st.mil ? 'Luz de injeção ACESA' : 'Luz de injeção apagada'}</b><div class="muted small">${st.qtdDtc} código(s) confirmado(s)</div></div></div></div>
        <div class="card"><b>${st.incompletos === 0 ? 'Todos os monitores suportados estão completos.' : `${st.incompletos} monitor(es) incompleto(s).`}</b><p class="small muted">${escHtml(mons?.dica_vistoria || '')}</p></div>
        <div class="card">${linhas}</div>`;
    }
    view.innerHTML = `<button class="btn primary block" id="btnAt" ${conectado() ? '' : 'disabled'} style="margin-bottom:12px">${icone('refresh')} Atualizar</button>${corpo}`;
    $('#btnAt', view).addEventListener('click', (e) => comCarregamento(e.currentTarget, async () => {
      exigirConexao();
      estado.status = await estado.obd.lerStatus();
      desenhar();
    }, 'Lendo…'));
  };
  desenhar();
  return aoMudar(desenhar);
}

// ------------------------------------------------------------------ veículo
function telaVeiculo(view) {
  let extra = { calid: null, cvn: null };
  const desenhar = () => {
    const i = estado.info || {};
    const pids = estado.obd ? [...estado.obd.suportadosUniao].sort() : [];
    view.innerHTML = `
      <button class="btn primary block" id="btnLerInfo" ${conectado() ? '' : 'disabled'} style="margin-bottom:12px">${icone('refresh')} Ler VIN, CALID e CVN</button>
      <div class="card"><dl class="kv">
        <dt>VIN</dt><dd class="mono">${escHtml(estado.vin || '—')}</dd>
        <dt>Calibração</dt><dd class="mono">${extra.calid ? extra.calid.map((c) => `${escHtml(c.calid)} <span class="muted">(${escHtml(c.ecu)})</span>`).join('<br>') : '—'}</dd>
        <dt>CVN</dt><dd class="mono">${extra.cvn ? extra.cvn.map((c) => `${escHtml(c.cvn)} <span class="muted">(${escHtml(c.ecu)})</span>`).join('<br>') : '—'}</dd>
        <dt>Centrais</dt><dd>${extra.nomes?.length ? extra.nomes.map((n) => `${escHtml(n.nome)} <span class="muted">(${escHtml(n.ecu)})</span>`).join('<br>') : '—'}</dd>
        <dt>Motor</dt><dd>${escHtml(config.motor || 'não informado')} <a href="#more/config">alterar</a></dd>
        <dt>Câmbio</dt><dd>${escHtml(config.cambio || 'não informado')}</dd>
      </dl></div>
      <div class="card"><h3>Adaptador</h3><dl class="kv">
        <dt>Chip</dt><dd>${escHtml(i.versao || '—')}</dd>
        <dt>Descrição</dt><dd>${escHtml(i.dispositivo || '—')}</dd>
        <dt>Protocolo</dt><dd>${escHtml(i.protocolo || '—')}${i.protocoloNum ? ` (ATSP${i.protocoloNum.toString(16).toUpperCase()})` : ''}</dd>
        <dt>Bateria</dt><dd>${i.tensao != null ? i.tensao.toFixed(1).replace('.', ',') + ' V' : '—'}</dd>
        <dt>Transporte</dt><dd>${escHtml(estado.transporte?.nome || '—')}</dd>
      </dl>
      ${/v2\.1/i.test(i.versao || '') ? '<p class="small muted">“v2.1” é típico de clones: o chip real costuma ser uma cópia da v1.5. Se houver falhas, ative o modo compatibilidade.</p>' : ''}</div>
      <div class="card"><h3>PIDs suportados (modo 01)</h3>
        ${estado.obd ? [...estado.obd.suportados.entries()].map(([ecu, set]) => `<p class="small"><b>ECU ${escHtml(ecu)}:</b> <span class="mono">${[...set].sort().join(' ')}</span></p>`).join('') : '<p class="muted small">Conecte para descobrir.</p>'}
        ${pids.length ? `<p class="small muted">${pids.length} PIDs no total.</p>` : ''}</div>`;
    $('#btnLerInfo', view).addEventListener('click', (e) => comCarregamento(e.currentTarget, async () => {
      exigirConexao();
      estado.vin = await estado.obd.lerVin();
      extra = { calid: await estado.obd.lerCalibracao(), cvn: await estado.obd.lerCvn(), nomes: await estado.obd.lerNomesEcu().catch(() => []) };
      desenhar();
    }, 'Lendo…'));
  };
  desenhar();
  return aoMudar(desenhar);
}

// ------------------------------------------------------------------ varredura
function telaVarredura(view) {
  let achados = window.__ultimaVarredura || [];
  let rodando = false;
  const desenhar = (prog) => {
    view.innerHTML = `
      <div class="card" style="border-color:#7a3cff"><span class="tag exp">EXPERIMENTAL</span>
        <p class="small">Envia <span class="mono">3E 00</span> (TesterPresent) e, se não houver resposta, <span class="mono">10 01</span> (sessão padrão) para cada endereço, assumindo resposta em <b>endereço + 8</b> (convenção Hyundai/Kia). São só comandos de leitura/presença. Faça com a <b>ignição ligada e o motor desligado</b>.</p></div>
      <div class="btn-grid" style="margin:12px 0">
        <button class="btn primary" id="btnRapida" ${conectado() && !rodando ? '' : 'disabled'}>${icone('scan')} Rápida</button>
        <button class="btn" id="btnCompleta" ${conectado() && !rodando ? '' : 'disabled'}>${icone('scan')} Completa 700–7F7</button>
      </div>
      ${rodando ? `<button class="btn danger block" id="btnCancelar">${icone('stop')} Cancelar</button>` : ''}
      ${prog ? `<div class="card"><div class="row between small"><span>Testando ${escHtml(prog.tx)}…</span><span>${prog.atual}/${prog.total}</span></div><div class="progress" style="margin-top:8px"><div style="width:${(prog.atual / prog.total * 100).toFixed(1)}%"></div></div></div>` : ''}
      <div class="card"><h3>Módulos que responderam (${achados.length})</h3>
        ${achados.length ? `<div class="table-wrap"><table class="t"><thead><tr><th>Envio</th><th>Resp.</th><th>Provável</th><th>Resposta</th></tr></thead><tbody>
        ${achados.map((a) => `<tr><td class="mono">${escHtml(a.tx)}</td><td class="mono">${escHtml(a.rx)}</td><td>${escHtml(a.provavel)}</td><td class="mono small">${escHtml(a.servico)} → ${escHtml(a.resposta)}${a.negativa ? `<br><span class="muted">${escHtml(a.negativa)}</span>` : ''}</td></tr>`).join('')}
        </tbody></table></div>
        <div class="btn-grid" style="margin-top:10px"><button class="btn sm" id="btnCopiarVar">${icone('copy')} Copiar</button><button class="btn sm" id="btnAddVar">${icone('download')} Adicionar à tabela</button></div>` : '<p class="muted small">Nenhuma varredura feita ainda.</p>'}
      </div>`;
    const iniciar = (lista) => comCarregamento(null, async () => {
      exigirConexao();
      rodando = true;
      desenhar({ atual: 0, total: 1, tx: '…' });
      try {
        achados = await estado.kia.varrer({ lista, onProgresso: (p) => { achados = p.achados; if (!p.fim) desenhar(p); } });
        window.__ultimaVarredura = achados;
        toast(`Varredura concluída: ${achados.length} módulo(s) responderam.`, 'ok');
      } finally {
        rodando = false;
        desenhar();
      }
    });
    $('#btnRapida', view)?.addEventListener('click', () => {
      const lista = [...new Set([...config.modulos.map((m) => parseInt(m.tx, 16)), 0x7e0, 0x7e1, 0x7e2, 0x7d0, 0x7d1, 0x7d2, 0x7d4, 0x7a0, 0x7a5, 0x7b0, 0x7b3, 0x7c4, 0x7c6, 0x770, 0x790, 0x7f1])];
      iniciar(lista);
    });
    $('#btnCompleta', view)?.addEventListener('click', () => iniciar(null));
    $('#btnCancelar', view)?.addEventListener('click', () => estado.kia?.cancelarVarredura());
    $('#btnCopiarVar', view)?.addEventListener('click', async () => {
      await copiarTexto(achados.map((a) => `${a.tx} -> ${a.rx} | ${a.servico} -> ${a.resposta}${a.negativa ? ' (' + a.negativa + ')' : ''}`).join('\n'));
      toast('Resultado copiado.', 'ok');
    });
    $('#btnAddVar', view)?.addEventListener('click', async () => {
      const mods = [...config.modulos];
      let n = 0;
      for (const a of achados) {
        if (mods.some((m) => m.tx === a.tx)) continue;
        mods.push({ id: 'm' + a.tx.toLowerCase(), nome: `Módulo ${a.tx}`, tx: a.tx, rx: a.rx, critico: false });
        n++;
      }
      await salvarConfig({ modulos: mods });
      toast(n ? `${n} módulo(s) adicionados. Renomeie em Configurações.` : 'Todos já estavam na tabela.', 'ok');
    });
  };
  desenhar();
  return () => { if (rodando) estado.kia?.cancelarVarredura(); };
}

// ------------------------------------------------------------------ terminal
function telaTerminal(view) {
  const atalhos = ['ATI', 'AT@1', 'ATRV', 'ATDP', 'ATDPN', '0100', '0101', '010C', '03', '07', '0A', '0902', 'ATZ'];
  view.innerHTML = `
    <div class="term-log" id="log" aria-live="polite"></div>
    <form class="term-input" id="frm"><input class="input mono" id="cmd" autocomplete="off" autocapitalize="characters" spellcheck="false" placeholder="Ex.: ATRV ou 010C"><button class="btn primary">${icone('play')}</button></form>
    <div class="chips">${atalhos.map((a) => `<button data-cmd="${a}">${a}</button>`).join('')}</div>
    <div class="btn-grid" style="margin-top:12px"><button class="btn" id="btnCopiar">${icone('copy')} Copiar log</button><button class="btn" id="btnBaixar">${icone('download')} Baixar log</button></div>
    <button class="btn ghost block" id="btnLimpar" style="margin-top:8px">${icone('trash')} Limpar log</button>
    <p class="muted small">Cuidado: comandos digitados vão direto ao carro. Evite 04 (apaga códigos) e comandos de escrita que você não conhece.</p>`;
  const log = $('#log', view);
  const linha = (l) => `<div><span class="ts">${horaMs(l.ts)}</span> <span class="${l.dir}">${l.dir.toUpperCase()} ${escHtml(l.texto)}</span></div>`;
  log.innerHTML = estado.log.slice(-500).map(linha).join('') || '<div class="ev">Log vazio. Conecte e envie um comando.</div>';
  log.scrollTop = log.scrollHeight;
  const off = aoLog((l) => {
    log.insertAdjacentHTML('beforeend', linha(l));
    while (log.childElementCount > 800) log.firstElementChild.remove();
    log.scrollTop = log.scrollHeight;
  });
  const enviar = async (cmd) => {
    cmd = cmd.trim().toUpperCase();
    if (!cmd) return;
    if (!conectado()) { toast('Conecte primeiro (ou use o modo demo).', 'err'); return; }
    if (/^04$/.test(cmd.replace(/\s/g, '')) && !(await confirmar('Enviar 04?', 'O comando 04 apaga os códigos e zera os monitores. Use o botão da aba Erros, que verifica o motor desligado.', { perigo: true, textoOk: 'Enviar mesmo assim' }))) return;
    const r = await estado.elm.comando(cmd, { tentativas: 0, timeout: /^ATZ|^ATWS/.test(cmd) ? 4000 : config.timeout + 2000 });
    if (/^ATSH|^ATCRA|^ATSP|^ATTP/.test(cmd)) { estado.elm.cabecalhoAtual = null; estado.elm.filtroAtual = null; estado.elm.fcAtual = null; }
    if (r.erro && r.erro.codigo === 'TIMEOUT') toast(r.erro.msg, 'err');
  };
  $('#frm', view).addEventListener('submit', (e) => { e.preventDefault(); const i = $('#cmd', view); enviar(i.value); i.value = ''; });
  $$('[data-cmd]', view).forEach((b) => b.addEventListener('click', () => enviar(b.dataset.cmd)));
  $('#btnCopiar', view).addEventListener('click', async () => { toast((await copiarTexto(textoLog())) ? 'Log copiado.' : 'Não foi possível copiar.', 'ok'); });
  $('#btnBaixar', view).addEventListener('click', () => baixarArquivo(`log-elm327-${carimbo()}.txt`, textoLog()));
  $('#btnLimpar', view).addEventListener('click', () => { estado.log.length = 0; log.innerHTML = ''; });
  return off;
}

// ------------------------------------------------------------------ configurações
function telaConfig(view) {
  const sw = (id, titulo, sub, marcado) => `<label class="switch"><span class="t"><b>${titulo}</b><small>${sub}</small></span><input type="checkbox" id="${id}" ${marcado ? 'checked' : ''}></label>`;
  const desenhar = () => {
    view.innerHTML = `
      <div class="section-title">Veículo</div>
      <div class="card">
        <label class="field"><span>Motor</span><select class="input" id="cfgMotor">
          <option value="">Não informado</option><option value="1.6" ${config.motor === '1.6' ? 'selected' : ''}>1.6 16V Gamma (flex)</option><option value="2.0" ${config.motor === '2.0' ? 'selected' : ''}>2.0 16V Nu (flex)</option></select></label>
        <label class="field"><span>Câmbio</span><select class="input" id="cfgCambio">
          <option value="">Não informado</option><option value="automatico" ${config.cambio === 'automatico' ? 'selected' : ''}>Automático 6 marchas</option><option value="manual" ${config.cambio === 'manual' ? 'selected' : ''}>Manual 6 marchas</option></select>
          <small>Usado no relatório e para destacar os problemas típicos de cada versão.</small></label>
      </div>
      <div class="card">
        ${sw('cfgPerguntarKm', 'Perguntar a quilometragem ao ler erros', 'Desligado: o app não pergunta e usa o km informado abaixo (se houver).', config.perguntarKm)}
        <label class="field" style="margin-top:8px"><span>Km atual do painel (opcional)</span><input class="input" id="cfgKm" type="number" inputmode="numeric" value="${escHtml(config.ultimoKm || '')}" placeholder="ex.: 85432">
          <small>Fica gravado nas próximas leituras e relatórios. Atualize quando quiser.</small></label>
      </div>
      <div class="section-title">Aparência</div>
      <div class="card">${sw('cfgClaro', 'Tema claro', 'Padrão é o escuro (melhor à noite). O claro pode ajudar sob sol forte.', config.tema === 'light')}</div>
      <div class="section-title">Conexão</div>
      <div class="card">
        <label class="field"><span>Tipo de adaptador</span><select class="input" id="cfgTransp">
          <option value="serial" ${config.transporte === 'serial' ? 'selected' : ''}>Bluetooth clássico (SPP) — ELM327 Mini azul</option>
          <option value="ble" ${config.transporte === 'ble' ? 'selected' : ''}>Bluetooth LE (FFE0/FFF0)</option></select></label>
        ${sw('cfgTodos', 'Mostrar todos os dispositivos', 'Use se o adaptador pareado não aparecer na lista (clones que não anunciam SPP).', config.mostrarTodos)}
        ${sw('cfgCompat', 'Modo compatibilidade (clones)', 'Pausas entre comandos, timeout maior (ATST96), leitura mais lenta. Nunca usa ATAT2.', config.compat)}
        <label class="field" style="margin-top:12px"><span>Timeout de resposta (ms)</span><input class="input" id="cfgTimeout" type="number" min="500" max="15000" step="100" value="${config.timeout}"></label>
        <label class="field"><span>Repetições em caso de erro</span><input class="input" id="cfgTent" type="number" min="0" max="5" value="${config.tentativas}"></label>
        <label class="field"><span>Protocolo inicial</span><select class="input" id="cfgProto">
          <option value="6" ${config.protocoloPreferido === 6 ? 'selected' : ''}>ATSP6 — CAN 11 bit 500 kbps (Cerato 2014)</option>
          <option value="0" ${config.protocoloPreferido === 0 ? 'selected' : ''}>ATSP0 — automático</option></select>
          <small>Se o protocolo inicial falhar, o app sempre tenta o automático.</small></label>
        <label class="field"><span>Intervalo mínimo entre leituras ao vivo (ms)</span><input class="input" id="cfgInt" type="number" min="0" max="5000" step="50" value="${config.intervaloMinimo}"></label>
      </div>
      <div class="section-title">Alertas ao vivo</div>
      <div class="card"><div class="table-wrap"><table class="t" id="tabAlertas"><thead><tr><th>Ativo</th><th>PID</th><th>Acima de</th><th>Abaixo de</th><th></th></tr></thead><tbody>
        ${config.alertas.map((a, i) => `<tr data-i="${i}"><td><input type="checkbox" data-k="ativo" ${a.ativo ? 'checked' : ''} style="width:24px;height:24px"></td>
          <td><select class="input" data-k="pid">${(estado.tabela?.todos || []).filter((p) => p.formula || p.pid === 'RV').map((p) => `<option value="${p.pid}" ${p.pid === a.pid ? 'selected' : ''}>${escHtml(p.curto)}</option>`).join('')}</select></td>
          <td><input data-k="acima" type="number" step="any" value="${a.acima ?? ''}"></td><td><input data-k="abaixo" type="number" step="any" value="${a.abaixo ?? ''}"></td>
          <td><button class="btn sm ghost" data-del="${i}" aria-label="Remover">${icone('x')}</button></td></tr>`).join('')}
      </tbody></table></div><button class="btn sm" id="btnAddAlerta" style="margin-top:8px">+ Alerta</button></div>
      <div class="section-title">Módulos Kia (experimental)</div>
      <div class="card"><p class="small muted">Endereços prováveis (tx → rx). Confirme com a varredura.</p><div class="table-wrap"><table class="t" id="tabMods"><thead><tr><th>Nome</th><th>Envio</th><th>Resp.</th><th>Crítico</th><th></th></tr></thead><tbody>
        ${config.modulos.map((m, i) => `<tr data-i="${i}"><td><input data-k="nome" value="${escHtml(m.nome)}"></td><td><input data-k="tx" class="mono" maxlength="3" value="${escHtml(m.tx)}"></td><td><input data-k="rx" class="mono" maxlength="3" value="${escHtml(m.rx)}"></td>
          <td><input type="checkbox" data-k="critico" ${m.critico ? 'checked' : ''} style="width:24px;height:24px"></td><td><button class="btn sm ghost" data-delm="${i}" aria-label="Remover">${icone('x')}</button></td></tr>`).join('')}
      </tbody></table></div>
      <div class="btn-grid" style="margin-top:8px"><button class="btn sm" id="btnAddMod">+ Módulo</button><button class="btn sm" id="btnResetMods">Restaurar padrão</button></div></div>
      <div class="section-title">Segurança</div>
      <div class="card">${sw('cfgCriticos', 'Permitir apagar ABS/ESC e airbag', 'DESATIVADO por padrão. Leia o aviso antes de ligar.', config.permitirApagarCriticos)}</div>
      <div class="section-title">Dados</div>
      <div class="card"><button class="btn danger block" id="btnApagarTudo">${icone('trash')} Apagar todo o histórico</button>
      <button class="btn ghost block" id="btnResetCfg" style="margin-top:8px">Restaurar configurações padrão</button></div>`;
    ligar();
  };

  const ligar = () => {
    const bind = (id, fn) => $(id, view)?.addEventListener('change', (e) => fn(e.target));
    bind('#cfgMotor', (t) => salvarConfig({ motor: t.value }));
    bind('#cfgCambio', (t) => salvarConfig({ cambio: t.value }));
    bind('#cfgPerguntarKm', (t) => salvarConfig({ perguntarKm: t.checked }));
    bind('#cfgKm', (t) => salvarConfig({ ultimoKm: t.value.trim() }));
    bind('#cfgClaro', (t) => salvarConfig({ tema: t.checked ? 'light' : 'dark' }));
    bind('#cfgTransp', (t) => salvarConfig({ transporte: t.value }));
    bind('#cfgTodos', (t) => salvarConfig({ mostrarTodos: t.checked }));
    bind('#cfgCompat', (t) => { salvarConfig({ compat: t.checked }); if (estado.elm) estado.elm.opc.compat = t.checked; toast('Vale totalmente na próxima conexão.'); });
    bind('#cfgTimeout', (t) => { const v = Math.max(500, Number(t.value) || 2500); salvarConfig({ timeout: v }); if (estado.elm) estado.elm.opc.timeout = v; });
    bind('#cfgTent', (t) => { const v = Math.max(0, Math.min(5, Number(t.value) || 0)); salvarConfig({ tentativas: v }); if (estado.elm) estado.elm.opc.tentativas = v; });
    bind('#cfgProto', (t) => salvarConfig({ protocoloPreferido: Number(t.value) }));
    bind('#cfgInt', (t) => salvarConfig({ intervaloMinimo: Math.max(0, Number(t.value) || 0) }));

    // alertas
    $$('#tabAlertas tbody tr', view).forEach((tr) => {
      const i = Number(tr.dataset.i);
      $$('[data-k]', tr).forEach((inp) => inp.addEventListener('change', () => {
        const a = { ...config.alertas[i] };
        const k = inp.dataset.k;
        if (k === 'ativo') a.ativo = inp.checked;
        else if (k === 'pid') a.pid = inp.value;
        else a[k] = inp.value === '' ? null : Number(inp.value);
        const lista = [...config.alertas]; lista[i] = a;
        salvarConfig({ alertas: lista });
      }));
    });
    $$('[data-del]', view).forEach((b) => b.addEventListener('click', () => { const l = [...config.alertas]; l.splice(Number(b.dataset.del), 1); salvarConfig({ alertas: l }); desenhar(); }));
    $('#btnAddAlerta', view).addEventListener('click', () => { salvarConfig({ alertas: [...config.alertas, { pid: '0C', acima: 6000, abaixo: null, ativo: true }] }); desenhar(); });

    // módulos
    $$('#tabMods tbody tr', view).forEach((tr) => {
      const i = Number(tr.dataset.i);
      $$('[data-k]', tr).forEach((inp) => inp.addEventListener('change', () => {
        const m = { ...config.modulos[i] };
        const k = inp.dataset.k;
        if (k === 'critico') m.critico = inp.checked;
        else if (k === 'tx' || k === 'rx') {
          const v = inp.value.trim().toUpperCase();
          if (!/^[0-7][0-9A-F]{2}$/.test(v)) { toast('Endereço inválido (use 3 dígitos hex, ex.: 7D1).', 'err'); inp.value = m[k]; return; }
          m[k] = v;
        } else m.nome = inp.value;
        const lista = [...config.modulos]; lista[i] = m;
        salvarConfig({ modulos: lista });
      }));
    });
    $$('[data-delm]', view).forEach((b) => b.addEventListener('click', () => { const l = [...config.modulos]; l.splice(Number(b.dataset.delm), 1); salvarConfig({ modulos: l }); desenhar(); }));
    $('#btnAddMod', view).addEventListener('click', () => { salvarConfig({ modulos: [...config.modulos, { id: 'm' + Date.now(), nome: 'Novo módulo', tx: '7B0', rx: '7B8', critico: false }] }); desenhar(); });
    $('#btnResetMods', view).addEventListener('click', () => { salvarConfig({ modulos: structuredClone(MODULOS_PADRAO) }); desenhar(); });

    // segurança: aviso forte para ABS/SRS
    $('#cfgCriticos', view).addEventListener('change', async (e) => {
      if (!e.target.checked) { salvarConfig({ permitirApagarCriticos: false }); return; }
      e.target.checked = false;
      const ok = await confirmar('Liberar apagamento de ABS e airbag?', `<div class="warn-box">
        <p><b>Risco à segurança.</b> Códigos de ABS/ESC e airbag (SRS) indicam falhas em sistemas que protegem a sua vida.</p>
        <ul class="clean small"><li>Apagar não conserta: com a falha presente, o airbag pode <b>não abrir</b> numa batida e o ABS/ESC pode ficar inoperante.</li>
        <li>Códigos de colisão registrada (crash data) no airbag normalmente <b>exigem troca do módulo</b> e não devem ser apagados.</li>
        <li>Esta função é experimental: o protocolo do módulo é descoberto por tentativa.</li>
        <li>Nunca mexa no conector amarelo do airbag com a ignição ligada.</li></ul></div>
        <p>Só continue se o reparo já foi feito por um profissional.</p>`, { textoOk: 'Entendo os riscos, liberar', perigo: true });
      if (ok) { await salvarConfig({ permitirApagarCriticos: true }); e.target.checked = true; toast('Apagamento de ABS/SRS liberado.', 'warn'); }
    });

    $('#btnApagarTudo', view).addEventListener('click', async () => {
      if (!(await confirmar('Apagar histórico?', 'Todas as leituras e sessões gravadas serão removidas deste aparelho. Faça um backup antes.', { perigo: true, textoOk: 'Apagar tudo' }))) return;
      await apagarTudo(); estado.ultimaLeitura = null; toast('Histórico apagado.', 'ok');
    });
    $('#btnResetCfg', view).addEventListener('click', async () => {
      if (!(await confirmar('Restaurar padrão?', 'Volta todas as configurações ao padrão de fábrica do app.'))) return;
      await salvarConfig(structuredClone(PADRAO)); desenhar();
    });
  };
  desenhar();
  return null;
}

// ------------------------------------------------------------------ demo
function telaDemo(view) {
  const desenhar = () => {
    const sim = estado.demo ? estado.transporte : null;
    view.innerHTML = `
      <div class="card"><p>O modo demonstração usa um <b>simulador de ELM327</b> embutido: responde comandos AT, usa CAN 11/500 com cabeçalhos, envia respostas multi-frame de duas ECUs (motor 7E8 e câmbio 7E9), tem códigos de exemplo, freeze frame, VIN, módulos Kia (ABS em UDS, airbag em KWP2000) e dados ao vivo variando num ciclo de condução.</p>
      <p class="small muted">Os dados são fictícios e as leituras ficam marcadas como “demo” no histórico.</p></div>
      ${estado.demo ? `<button class="btn block" id="btnSair">${icone('x')} Sair do modo demo</button>` : `<button class="btn primary big" id="btnEntrar">${icone('demo')} Iniciar modo demo</button>`}
      <div class="section-title">Simulação</div>
      <div class="card">
        <label class="switch"><span class="t"><b>Motor ligado</b><small>Desligue para testar o apagamento de códigos (exige rotação zero).</small></span><input type="checkbox" id="dMotor" ${config.demo.motorLigado ? 'checked' : ''}></label>
        <label class="switch"><span class="t"><b>Simular clone problemático</b><small>Atrasos aleatórios e bytes de lixo nas respostas.</small></span><input type="checkbox" id="dRuido" ${config.demo.cloneRuidoso ? 'checked' : ''}></label>
      </div>
      ${sim ? '<p class="small muted">As mudanças valem na hora para o simulador conectado.</p>' : ''}`;
    $('#btnEntrar', view)?.addEventListener('click', (e) => comCarregamento(e.currentTarget, async () => { await conectar('demo'); ir('home'); }, 'Iniciando…'));
    $('#btnSair', view)?.addEventListener('click', async () => { const { desconectar } = await import('../app.js'); await desconectar(); desenhar(); });
    $('#dMotor', view).addEventListener('change', (e) => { salvarConfig({ demo: { ...config.demo, motorLigado: e.target.checked } }); if (sim) sim.motorLigado = e.target.checked; });
    $('#dRuido', view).addEventListener('change', (e) => { salvarConfig({ demo: { ...config.demo, cloneRuidoso: e.target.checked } }); if (sim) sim.cloneRuidoso = e.target.checked; });
  };
  desenhar();
  return aoMudar(desenhar);
}

// ------------------------------------------------------------------ ajuda
function telaAjuda(view) {
  const info = infoDb();
  const probs = todosProblemas().filter((p) => !config.motor || !p.motor || p.motor === 'ambos' || p.motor === config.motor)
    .filter((p) => !p.cambio || !config.cambio || p.cambio === config.cambio);
  view.innerHTML = `
    <div class="card"><h3>${icone('search')} Buscar código ou palavra</h3>
      <input class="input" id="busca" placeholder="Ex.: P0420, sonda, bobina" autocomplete="off">
      <div id="resBusca" style="margin-top:10px"></div>
      <p class="muted small">${info ? `${info.total.toLocaleString('pt-BR')} códigos no banco (versão ${escHtml(info.versao)}).` : 'Carregando banco…'}</p></div>
    <div class="section-title">Problemas conhecidos do Cerato 2014${config.motor ? ' ' + escHtml(config.motor) : ''}</div>
    ${probs.map((p, i) => `<details class="card"><summary><b>${escHtml(p.titulo)}</b> <span class="muted small mono">${escHtml((p.codigos || []).join(' '))}</span></summary>
      <p class="small">${escHtml(p.explicacao)}</p>
      ${p.sintomas?.length ? `<p class="small"><b>Sintomas:</b></p><ul class="clean small">${p.sintomas.map((s) => `<li>${escHtml(s)}</li>`).join('')}</ul>` : ''}
      ${p.verificacoes?.length ? `<p class="small"><b>O que verificar:</b></p><ul class="clean small">${p.verificacoes.map((s) => `<li>${escHtml(s)}</li>`).join('')}</ul>` : ''}
      <div class="chips">${(p.codigos || []).map((c) => `<button data-dtc="${escHtml(c)}">${escHtml(c)}</button>`).join('')}</div>
      <p class="muted small">Aplica-se a: ${escHtml(p.motor === 'ambos' || !p.motor ? 'motores 1.6 e 2.0' : 'motor ' + p.motor)}${p.cambio ? ' · câmbio ' + escHtml(p.cambio) : ''} · confiança ${escHtml(p.confianca || '')}</p></details>`).join('')}
    <div class="section-title">Como usar</div>
    <details class="card" open><summary><b>Parear o ELM327 (Bluetooth clássico)</b></summary><ol class="clean small">
      <li>Adaptador na tomada OBD, ignição ligada (a luz do adaptador acende).</li>
      <li>Android › Configurações › Conexões › Bluetooth › procurar. Escolha “OBDII” e digite o PIN 1234 (ou 0000, 6789).</li>
      <li>Abra este app no <b>Chrome</b> e toque em Conectar. A lista mostra só aparelhos pareados com porta serial.</li>
      <li>Não use o adaptador em outro app ao mesmo tempo (o Bluetooth clássico aceita uma conexão por vez).</li></ol></details>
    <details class="card"><summary><b>Instalar como aplicativo</b></summary><p class="small">No Chrome, menu ⋮ › <b>Instalar app</b> (ou “Adicionar à tela inicial”). Depois da primeira abertura o app funciona offline.</p></details>
    <details class="card"><summary><b>O adaptador não responde</b></summary><ul class="clean small">
      <li>Confira a ignição ligada e o encaixe na tomada.</li>
      <li>Ative o <b>modo compatibilidade</b> em Configurações e aumente o timeout para 4000 ms.</li>
      <li>Abra o Terminal e envie ATZ, ATI e 0100 para ver o que o adaptador responde. Use “Copiar log” para pedir ajuda.</li>
      <li>Clones “v2.1” muitas vezes não aceitam alguns comandos AT (respondem “?”). O app ignora esses casos.</li></ul></details>
    <details class="card"><summary><b>Sobre o banco de códigos</b></summary><p class="small">${escHtml(info?.fontes?.resumo || '')}</p>
      <p class="small muted">Códigos genéricos seguem SAE J2012 / ISO 15031-6. Códigos de fabricante trazem o nível de confiança e a fonte. Descrições são orientativas: confirme com testes antes de trocar peças.</p></details>`;
  const res = $('#resBusca', view);
  $('#busca', view).addEventListener('input', (e) => {
    const r = pesquisar(e.target.value, 30);
    res.innerHTML = r.length ? r.map((c) => `<button class="dtc sev-${c.severidade}" data-dtc="${escHtml(c.codigo)}"><div class="code">${escHtml(c.codigo)}</div><div class="desc"><b>${escHtml(c.descricao)}</b><div class="meta">${escHtml(c.sistema)}</div></div></button>`).join('')
      : (e.target.value.trim() ? (() => { const b = buscarDtc(e.target.value.trim()); return /^[PCBU][0-9A-F]{4}$/i.test(e.target.value.trim()) ? `<button class="dtc sev-${b.severidade}" data-dtc="${escHtml(b.codigo)}"><div class="code">${escHtml(b.codigo)}</div><div class="desc"><b>${escHtml(b.descricao)}</b><div class="meta">${escHtml(b.sistema)}</div></div></button>` : '<p class="muted small">Nada encontrado.</p>'; })() : '');
    $$('[data-dtc]', res).forEach((b) => b.addEventListener('click', () => abrirDetalhe(b.dataset.dtc)));
  });
  $$('[data-dtc]', view).forEach((b) => b.addEventListener('click', () => abrirDetalhe(b.dataset.dtc)));
  return null;
}

// ------------------------------------------------------------------ relatórios
function telaRelatorios(view) {
  let rodando = false;
  let pararCorrel = false;
  const desenhar = (prog) => {
    const l = estado.ultimaLeitura;
    view.innerHTML = `
      <div class="card"><h3>${icone('alert')} Relatório dos erros</h3>
        <p class="small">Todos os códigos da última leitura (armazenados, pendentes, permanentes e módulos), com gravidade, “posso rodar?”, causas, verificações, notas do Cerato, freeze frame e monitores.</p>
        <p class="muted small">${l ? 'Última leitura: ' + escHtml(new Date(l.data).toLocaleString('pt-BR')) : 'Nenhuma leitura ainda — use “Ler erros” ou o relatório completo abaixo.'}</p>
        <button class="btn block" id="btnRelErros" ${l ? '' : 'disabled'}>${icone('printer')} Abrir relatório dos erros</button></div>
      <div class="card"><h3>${icone('car')} Relatório completo do carro</h3>
        <p class="small">Lê tudo de uma vez e gera um relatório único: identificação (VIN, calibração), luz de injeção, monitores, todos os códigos, módulos Kia, freeze frame, valor atual de <b>todos</b> os sensores suportados e o histórico.</p>
        <p class="muted small">Leva de 30 s a 2 min. Ignição ligada; motor pode estar ligado ou desligado. Só faz leituras.</p>
        <button class="btn primary block" id="btnRelCompleto" ${conectado() && !rodando ? '' : 'disabled'}>${icone('search')} Coletar tudo e gerar</button></div>
      <div class="card"><h3>${icone('wrench')} Relatório técnico (para melhorar o app)</h3>
        <p class="small">Grava as respostas <b>brutas</b> do adaptador e das centrais: PIDs suportados, testes do modo 06, informações do modo 09 e a identificação/dados de cada módulo (motor, câmbio, ABS, airbag, BCM, painel e os achados na varredura). Com esse arquivo dá para ensinar o app a ler mais coisas do seu carro.</p>
        <p class="muted small">Dica: faça antes a <a href="#more/varredura">varredura completa</a>. Leva de 1 a 4 min. Só faz leituras.</p>
        <label class="switch"><span class="t"><b>Exploração profunda</b><small>Procura blocos de dados extras em cada módulo (21 00–FF e 22 B0xx/F1xx). Leva de 5 a 10 min. Só leitura.</small></span><input type="checkbox" id="chkProfundo"></label>
        <button class="btn block" id="btnRelTecnico" ${conectado() && !rodando ? '' : 'disabled'}>${icone('download')} Gerar relatório técnico</button></div>
      <div class="card"><h3>${icone('record')} Gravação para decodificar dados</h3>
        <p class="small">Grava ao mesmo tempo rotação, velocidade e temperaturas (conhecidas) e os blocos de dados do motor, câmbio, ABS, direção, carroceria e painel. Cruzando as duas coisas dá para descobrir o que cada bloco significa e ensinar o app a mostrar esses dados.</p>
        <p class="small"><b>Como fazer:</b> comece parado com o motor ligado, toque em Gravar, deixe o celular preso no suporte e <b>dirija normalmente</b> (acelerar, frear, virar o volante, parar). Não mexa no celular dirigindo: a gravação para sozinha. Só leitura.</p>
        <label class="field"><span>Duração</span><select class="input" id="selMinutos"><option value="3">3 minutos</option><option value="5" selected>5 minutos</option><option value="8">8 minutos</option></select></label>
        <button class="btn block" id="btnCorrel" ${conectado() && !rodando ? '' : 'disabled'}>${icone('record')} Gravar</button>
        ${rodando === 'correl' ? `<button class="btn danger block" id="btnPararCorrel" style="margin-top:8px">${icone('stop')} Parar agora e salvar</button>` : ''}</div>
      ${prog ? `<div class="card"><div class="small">${escHtml(prog.texto)}</div><div class="progress" style="margin-top:8px"><div style="width:${prog.pct}%"></div></div></div>` : ''}
      ${!conectado() ? '<p class="muted small center">Conecte ao carro (ou ao modo demo) para coletar.</p>' : ''}`;

    $('#btnRelErros', view)?.addEventListener('click', async () => {
      const todas = await listarLeituras().catch(() => []);
      const ll = estado.ultimaLeitura;
      const cmp = comparar(ll, todas);
      abrirHtml(ll.completo ? gerarRelatorioCompletoHtml(ll, todas, cmp) : gerarRelatorioHtml(ll, cmp), `relatorio-erros-${carimbo()}.html`);
    });

    $('#btnRelCompleto', view)?.addEventListener('click', () => comCarregamento(null, async () => {
      rodando = true;
      try {
        const r = await coletarCompleto((texto, pct) => desenhar({ texto, pct }));
        const todas = await listarLeituras().catch(() => []);
        const html = gerarRelatorioCompletoHtml(r, todas, comparar(r, todas));
        const nome = `relatorio-completo-${carimbo()}.html`;
        rodando = false;
        desenhar();
        modal({
          titulo: 'Relatório completo pronto',
          conteudo: `<p>${(r.valores || []).length} sensores lidos, ${['armazenados', 'pendentes', 'permanentes'].reduce((s, k) => s + r.dtcs[k].length, 0)} código(s) OBD e ${r.dtcs.modulos.reduce((s, m) => s + m.dtcs.length, 0)} em módulos. A coleta também foi salva no Histórico.</p>`,
          botoes: [
            { texto: 'Fechar', classe: 'ghost' },
            { texto: 'Baixar', icone: 'download', aoClicar: () => { baixarArquivo(nome, html, 'text/html;charset=utf-8'); return false; } },
            { texto: 'Abrir', classe: 'primary', icone: 'printer', aoClicar: () => { abrirHtml(html, nome); return false; } }
          ]
        });
      } finally { if (rodando) { rodando = false; desenhar(); } }
    }));

    $('#btnPararCorrel', view)?.addEventListener('click', () => { pararCorrel = true; });
    $('#btnCorrel', view)?.addEventListener('click', () => comCarregamento(null, async () => {
      const minutos = Number($('#selMinutos', view).value) || 5;
      rodando = 'correl';
      pararCorrel = false;
      try {
        const rel = await coletarCorrelacao((texto, pct) => desenhar({ texto, pct }), { minutos, deveParar: () => pararCorrel });
        const json = JSON.stringify(rel);
        const nome = `gravacao-correlacao-${carimbo()}.json`;
        rodando = false;
        desenhar();
        baixarArquivo(nome, json, 'application/json');
        modal({
          titulo: 'Gravação concluída',
          conteudo: `<p>${rel.amostras.length} amostras em ${Math.round((rel.amostras.at(-1)?.t || 0) / 1000)} s. O arquivo <b>${escHtml(nome)}</b> foi baixado (pasta Downloads). Envie esse arquivo na conversa com o Claude.</p>`,
          botoes: [
            { texto: 'Fechar', classe: 'ghost' },
            { texto: 'Baixar de novo', icone: 'download', aoClicar: () => { baixarArquivo(nome, json, 'application/json'); return false; } }
          ]
        });
      } finally { if (rodando) { rodando = false; desenhar(); } }
    }));

    $('#btnRelTecnico', view)?.addEventListener('click', () => comCarregamento(null, async () => {
      rodando = true;
      try {
        const profundo = !!$('#chkProfundo', view)?.checked;
        const rel = await coletarTecnico((texto, pct) => desenhar({ texto, pct }), { profundo });
        const json = JSON.stringify(rel, null, 1);
        const nome = `relatorio-tecnico${rel.profundo ? '-profundo' : ''}-${carimbo()}.json`;
        const res = rel.resumo;
        const textoResumo = `Relatório técnico Cerato OBD2 ${rel.data}\nAdaptador: ${rel.adaptador.versao} | ${rel.adaptador.protocolo}\nPIDs modo 01: ${res.pids_modo01.join(' ')}\nMIDs modo 06: ${res.mids_modo06.join(' ') || 'nenhum'}\nModo 09: ${res.infos_modo09.join(' ') || 'nenhum'}\nMódulos que responderam: ${res.modulos_que_responderam.join(' ') || 'nenhum'}\nComandos: ${res.total_comandos}`;
        rodando = false;
        desenhar();
        baixarArquivo(nome, json, 'application/json');
        modal({
          titulo: 'Relatório técnico gerado',
          conteudo: `<p>O arquivo <b>${escHtml(nome)}</b> foi baixado (pasta Downloads). Envie esse arquivo na conversa com o Claude para ele analisar o que mais o seu carro suporta.</p>
            <pre class="term-log" style="height:auto;max-height:40vh">${escHtml(textoResumo)}</pre>`,
          botoes: [
            { texto: 'Fechar', classe: 'ghost' },
            { texto: 'Baixar de novo', icone: 'download', aoClicar: () => { baixarArquivo(nome, json, 'application/json'); return false; } },
            { texto: 'Copiar tudo', classe: 'primary', icone: 'copy', aoClicar: async () => { toast((await copiarTexto(json)) ? 'Copiado. Cole na conversa.' : 'Não foi possível copiar.', 'ok'); return false; } }
          ]
        });
      } finally { if (rodando) { rodando = false; desenhar(); } }
    }));
  };
  desenhar();
  return aoMudar(() => { if (!rodando) desenhar(); });
}

// ------------------------------------------------------------------ modo 06
function telaTestes(view) {
  let testes = null;
  const fmt = (v) => (Math.abs(v) >= 100 || Number.isInteger(v) ? Math.round(v * 10) / 10 : Number(v.toPrecision(3))).toLocaleString('pt-BR');
  const desenhar = () => {
    let corpo;
    if (!testes) corpo = vazio('chart', conectado() ? 'Toque em “Ler testes”.' : 'Conecte para ler os testes.');
    else if (!testes.length) corpo = vazio('info', 'A central não informou resultados de testes (modo 06).');
    else {
      const grupos = {};
      testes.forEach((t) => { (grupos[t.monitor] ||= []).push(t); });
      corpo = Object.entries(grupos).map(([mon, ts]) => `<div class="card"><h3>${escHtml(mon)}</h3>${ts.map((t) => `
        <div class="mon"><div><b>${escHtml(t.teste)}</b><div class="muted small">Valor ${escHtml(fmt(t.valor))} ${escHtml(t.unidade)} · limites ${escHtml(fmt(t.min))} a ${escHtml(fmt(t.max))}</div></div>
        <span class="st ${t.passou ? (t.pertoDoLimite ? 'inc' : 'ok') : 'na'}" style="${t.passou ? '' : 'background:var(--bad);color:#fff'}">${t.passou ? (t.pertoDoLimite ? 'Perto do limite' : 'Aprovado') : 'Reprovado'}</span></div>`).join('')}</div>`).join('');
    }
    view.innerHTML = `<div class="card small">A central testa sozinha cada sistema enquanto você dirige e guarda o último resultado. Aqui aparece o valor medido e os limites de aprovação. <b>“Perto do limite”</b> = está passando, mas com menos de 15% de folga — bom sinal de alerta antes de virar código de erro.</div>
      <button class="btn primary block" id="btnLer06" ${conectado() ? '' : 'disabled'} style="margin:12px 0">${icone('refresh')} Ler testes</button>${corpo}`;
    $('#btnLer06', view).addEventListener('click', (e) => comCarregamento(e.currentTarget, async () => {
      exigirConexao();
      if (!estado.tab06) throw new Error('Tabela do modo 06 não carregada.');
      testes = await estado.obd.lerModo06(estado.tab06);
      desenhar();
    }, 'Lendo…'));
  };
  desenhar();
  return aoMudar(() => { if (!testes) desenhar(); });
}
