/* Aba Ao vivo: medidores, lista e gráfico; gravação em CSV; alertas; wake lock; modo painel. */
import { estado, conectado, exigirConexao, aoMudar } from '../app.js';
import { config, salvarConfig } from '../settings.js';
import { salvarSessao } from '../storage.js';
import { el, $, $$, icone, escHtml, modal, toast, vazio } from './dom.js';
import { criarMedidor } from './gauge.js';
import { GraficoTempo, CORES } from './chart.js';
import { formatarNumero } from '../obd.js';
import { espera, baixarArquivo, gerarCsv, carimbo, duracao } from '../util.js';

// estado do laço de leitura (sobrevive à troca de aba enquanto grava)
const vivo = {
  rodando: false,
  ciclo: 0,
  ultimos: new Map(),     // pid -> { valor, texto, extra }
  buffer: [],             // últimos ~60 s [{ t, pid, valor }] para o gráfico
  gravando: null,         // { inicio, pids, amostras }
  hz: 0,
  wakeLock: null,
  alertaVisto: new Map(), // pid -> timestamp do último aviso
  ui: null                // referências da tela (null se outra aba estiver aberta)
};

function tabela() { return estado.tabela; }

/** PIDs escolhidos pelo usuário, só os suportados pelo carro (quando conectado). */
function pidsSelecionados() {
  const base = config.pidsSelecionados || tabela()?.json.selecao_padrao || [];
  const obd = estado.obd;
  return base.filter((p) => tabela()?.get(p) && (!obd || !obd.suportadosUniao.size || obd.suporta(p)));
}

// ------------------------------------------------------------------ laço
export async function iniciarLeitura() {
  exigirConexao();
  if (vivo.rodando) return;
  vivo.rodando = true;
  pedirWakeLock();
  atualizarBarra();
  let ultimoLento = 0;
  let janelaInicio = performance.now();
  let leiturasJanela = 0;
  while (vivo.rodando && conectado()) {
    const inicioCiclo = performance.now();
    const todos = pidsSelecionados();
    // PIDs lentos (combustível, contadores, bateria) só a cada ~5 s
    const agoraMs = Date.now();
    const incluirLentos = agoraMs - ultimoLento > 5000;
    if (incluirLentos) ultimoLento = agoraMs;
    const desteCiclo = todos.filter((p) => incluirLentos || !tabela().get(p)?.lento);
    if (!desteCiclo.length) { await espera(500); continue; }
    try {
      const r = await estado.obd.lerPids(desteCiclo);
      r.forEach((v, pid) => vivo.ultimos.set(pid, v));
      leiturasJanela += r.size;
      processarAmostra(r);
    } catch (e) {
      toast(e.message || 'Falha na leitura ao vivo.', 'err', 5000);
      if (['TIMEOUT', 'DESCONECTADO', 'ESCRITA'].includes(e.codigo)) { await espera(1500); }
    }
    vivo.ciclo++;
    const dt = performance.now() - janelaInicio;
    if (dt > 2000) { vivo.hz = (leiturasJanela * 1000) / dt; leiturasJanela = 0; janelaInicio = performance.now(); }
    desenharValores();
    // taxa adaptativa: com poucos PIDs o ciclo é curto naturalmente;
    // o intervalo mínimo configurável evita saturar clones lentos
    const gasto = performance.now() - inicioCiclo;
    const minimo = config.compat ? Math.max(config.intervaloMinimo, 150) : config.intervaloMinimo;
    await espera(Math.max(0, minimo - gasto)); // também libera a fila para outros comandos
  }
  vivo.rodando = false;
  soltarWakeLock();
  atualizarBarra();
}

export function pararLeitura() {
  vivo.rodando = false;
  if (vivo.gravando) pararGravacao();
}

function processarAmostra(r) {
  if (vivo.gravando) {
    const v = {};
    r.forEach((x, pid) => { if (typeof x.valor === 'number') v[pid] = Math.round(x.valor * 1000) / 1000; });
    vivo.gravando.amostras.push({ t: Date.now() - vivo.gravando.inicio, v });
  }
  const agora = Date.now();
  r.forEach((x, pid) => { if (typeof x.valor === 'number') vivo.buffer.push({ t: agora, pid, valor: x.valor }); });
  while (vivo.buffer.length && vivo.buffer[0].t < agora - 62000) vivo.buffer.shift();
  if (vivo.ui?.grafico) r.forEach((x, pid) => vivo.ui.grafico.adicionar(pid, x.valor, agora));
  verificarAlertas(r);
}

function emAlarme(pid, valor) {
  if (typeof valor !== 'number') return false;
  return config.alertas.some((a) => a.ativo && a.pid === pid && ((a.acima != null && valor > a.acima) || (a.abaixo != null && valor < a.abaixo)));
}

function verificarAlertas(r) {
  r.forEach((x, pid) => {
    if (!emAlarme(pid, x.valor)) return;
    const ultimo = vivo.alertaVisto.get(pid) || 0;
    if (Date.now() - ultimo < 30000) return;
    vivo.alertaVisto.set(pid, Date.now());
    const def = tabela().get(pid);
    toast(`Alerta: ${def?.curto || pid} = ${x.texto} ${def?.unidade || ''}`, 'err', 6000);
    try { navigator.vibrate?.([200, 100, 200]); } catch { /* ignora */ }
  });
}

// ------------------------------------------------------------------ wake lock
async function pedirWakeLock() {
  try {
    if ('wakeLock' in navigator && !vivo.wakeLock) {
      vivo.wakeLock = await navigator.wakeLock.request('screen');
      vivo.wakeLock.addEventListener('release', () => { vivo.wakeLock = null; });
    }
  } catch (e) { console.warn('Wake lock', e); }
}
function soltarWakeLock() { try { vivo.wakeLock?.release(); } catch { /* ignora */ } vivo.wakeLock = null; }
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && vivo.rodando) pedirWakeLock();
});

// ------------------------------------------------------------------ gravação
function iniciarGravacao() {
  vivo.gravando = { inicio: Date.now(), pids: pidsSelecionados(), amostras: [] };
  toast('Gravando sessão…');
  atualizarBarra();
}

async function pararGravacao() {
  const g = vivo.gravando;
  vivo.gravando = null;
  atualizarBarra();
  if (!g || !g.amostras.length) { toast('Gravação vazia descartada.'); return; }
  const sessao = {
    tipo: 'sessao',
    data: new Date(g.inicio).toISOString(),
    duracaoMs: Date.now() - g.inicio,
    pids: g.pids,
    nomes: Object.fromEntries(g.pids.map((p) => [p, tabela().get(p)?.nome || p])),
    unidades: Object.fromEntries(g.pids.map((p) => [p, tabela().get(p)?.unidade || ''])),
    vin: estado.vin,
    demo: estado.demo,
    amostras: g.amostras
  };
  sessao.id = await salvarSessao(sessao);
  toast(`Sessão salva (${duracao(sessao.duracaoMs)}, ${g.amostras.length} amostras).`, 'ok');
  modal({
    titulo: 'Sessão gravada',
    conteudo: `<p>${g.amostras.length} amostras em ${duracao(sessao.duracaoMs)}. Ela fica no Histórico.</p>`,
    botoes: [{ texto: 'Fechar', classe: 'ghost' }, { texto: 'Exportar CSV', classe: 'primary', icone: 'download', aoClicar: () => exportarSessaoCsv(sessao) }]
  });
}

export function exportarSessaoCsv(s) {
  const cab = ['tempo_s', 'data_hora', ...s.pids.map((p) => `${s.nomes?.[p] || p} (${s.unidades?.[p] || ''})`)];
  const inicio = new Date(s.data).getTime();
  const linhas = [cab];
  let ultimo = {};
  for (const a of s.amostras) {
    ultimo = { ...ultimo, ...a.v }; // repete o último valor dos PIDs lentos
    linhas.push([(a.t / 1000).toFixed(2), new Date(inicio + a.t).toLocaleString('pt-BR'), ...s.pids.map((p) => ultimo[p] ?? '')]);
  }
  baixarArquivo(`sessao-${carimbo()}.csv`, gerarCsv(linhas), 'text/csv;charset=utf-8');
}

// ------------------------------------------------------------------ painel (paisagem)
export function aoGirar(paisagem) {
  if (!vivo.ui) return;
  if (paisagem && vivo.rodando) entrarPainel(false);
  else if (!paisagem) sairPainel();
}

async function entrarPainel(comGesto = true) {
  document.body.classList.add('dash');
  if (vivo.ui && config.visualizacao !== 'medidores') { config.visualizacao = 'medidores'; montarConteudo(); }
  if (!$('.dash-exit')) {
    const b = el(`<button class="btn dash-exit">${icone('x')} Sair</button>`);
    b.addEventListener('click', sairPainel);
    document.body.appendChild(b);
  }
  if (comGesto) {
    try { await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); } catch { /* ignora */ }
    try { await screen.orientation?.lock?.('landscape'); } catch { /* nem todo aparelho permite */ }
  }
}

function sairPainel() {
  document.body.classList.remove('dash');
  $('.dash-exit')?.remove();
  try { if (document.fullscreenElement) document.exitFullscreen(); } catch { /* ignora */ }
  try { screen.orientation?.unlock?.(); } catch { /* ignora */ }
}

// ------------------------------------------------------------------ render
export function render(view) {
  view.innerHTML = '';
  const raiz = el(`<div>
    <div class="live-toolbar">
      <button class="btn primary" id="btnPlay"></button>
      <button class="btn" id="btnRec"></button>
      <button class="btn" id="btnPids">${icone('list')} PIDs</button>
      <button class="btn" id="btnPainel" aria-label="Modo painel">${icone('fullscreen')}</button>
    </div>
    <div class="segmented live-extra" id="segVis">
      <button data-vis="medidores">${icone('gauge')} Medidores</button>
      <button data-vis="lista">${icone('list')} Lista</button>
      <button data-vis="grafico">${icone('chart')} Gráfico</button>
    </div>
    <div class="row between live-extra" style="margin-bottom:8px"><span class="rate" id="taxa"></span><span class="rate" id="recInfo"></span></div>
    <div id="conteudo"></div>
  </div>`);
  view.appendChild(raiz);
  vivo.ui = { raiz, grafico: null, medidores: new Map() };

  $('#btnPlay', raiz).addEventListener('click', () => {
    if (vivo.rodando) { vivo.rodando = false; atualizarBarra(); return; }
    try { exigirConexao(); } catch (e) { toast(e.message, 'err'); return; }
    iniciarLeitura();
  });
  $('#btnRec', raiz).addEventListener('click', () => {
    if (vivo.gravando) { pararGravacao(); return; }
    if (!vivo.rodando) { try { exigirConexao(); } catch (e) { toast(e.message, 'err'); return; } iniciarLeitura(); }
    iniciarGravacao();
  });
  $('#btnPids', raiz).addEventListener('click', escolherPids);
  $('#btnPainel', raiz).addEventListener('click', () => entrarPainel(true));
  $$('[data-vis]', raiz).forEach((b) => b.addEventListener('click', () => {
    salvarConfig({ visualizacao: b.dataset.vis });
    montarConteudo();
  }));

  montarConteudo();
  atualizarBarra();
  const off = aoMudar(() => atualizarBarra());

  // ao sair da aba: para a leitura (a menos que esteja gravando)
  return () => {
    off();
    if (!vivo.gravando) vivo.rodando = false;
    sairPainel();
    vivo.ui = null;
  };
}

function montarConteudo() {
  const ui = vivo.ui;
  if (!ui) return;
  const cont = $('#conteudo', ui.raiz);
  $$('[data-vis]', ui.raiz).forEach((b) => b.classList.toggle('active', b.dataset.vis === config.visualizacao));
  const pids = pidsSelecionados();
  ui.medidores = new Map();
  ui.grafico = null;
  if (!tabela()) { cont.innerHTML = vazio('alert', 'Tabela de PIDs não carregada.'); return; }
  if (!pids.length) { cont.innerHTML = vazio('list', 'Nenhum PID selecionado (ou nenhum suportado pelo carro). Toque em “PIDs”.'); return; }

  if (config.visualizacao === 'lista') {
    cont.innerHTML = `<div class="card live-list">${pids.map((p) => {
      const d = tabela().get(p);
      return `<div class="li" data-pid="${p}"><span>${escHtml(d.nome)}<br><span class="muted small extra"></span></span><span><b class="val">—</b> <span class="muted">${escHtml(d.unidade || '')}</span></span></div>`;
    }).join('')}</div>`;
  } else if (config.visualizacao === 'grafico') {
    const numericos = pids.filter((p) => tabela().get(p)?.formula || p === 'RV').slice(0, 8);
    cont.innerHTML = `<div class="chart-box"><canvas id="cv"></canvas>
      <div class="legend">${numericos.map((p, i) => `<span><i style="background:${CORES[i % CORES.length]}"></i>${escHtml(tabela().get(p).curto)} <b data-leg="${p}">—</b></span>`).join('')}</div></div>
      <p class="muted small">Até 8 PIDs no gráfico; cada linha usa a própria escala (mín.–máx. do sensor). Janela de 60 s.</p>`;
    ui.grafico = new GraficoTempo($('#cv', cont), 60);
    ui.grafico.definirSeries(numericos.map((p) => ({ pid: p, nome: tabela().get(p).curto, min: tabela().get(p).min ?? 0, max: tabela().get(p).max ?? 100 })));
    vivo.buffer.forEach((b) => ui.grafico.adicionar(b.pid, b.valor, b.t)); // repõe o último minuto
    ui.grafico.desenhar();
  } else {
    const grade = el('<div class="gauges"></div>');
    for (const p of pids) {
      const d = tabela().get(p);
      const m = criarMedidor({ id: p, nome: d.curto || d.nome, unidade: d.unidade, min: d.min ?? 0, max: d.max ?? 100 });
      ui.medidores.set(p, m);
      grade.appendChild(m.el);
    }
    cont.innerHTML = '';
    cont.appendChild(grade);
  }
  desenharValores();
}

function desenharValores() {
  const ui = vivo.ui;
  if (!ui) return;
  for (const [pid, v] of vivo.ultimos) {
    const alarme = emAlarme(pid, v.valor);
    const m = ui.medidores.get(pid);
    if (m) m.atualizar(v.valor, v.texto, alarme);
    const li = ui.raiz.querySelector(`.li[data-pid="${pid}"]`);
    if (li) {
      li.querySelector('.val').textContent = v.texto;
      li.classList.toggle('alarm', alarme);
      const ex = li.querySelector('.extra');
      if (ex) ex.textContent = v.extra ? `${v.extra.nome}: ${v.extra.texto}` : '';
    }
    const leg = ui.raiz.querySelector(`[data-leg="${pid}"]`);
    if (leg) leg.textContent = v.texto;
  }
  const taxa = $('#taxa', ui.raiz);
  if (taxa) taxa.textContent = vivo.rodando ? `${formatarNumero(vivo.hz, 1)} leituras/s · ${pidsSelecionados().length} PIDs` : (conectado() ? 'Parado' : 'Desconectado');
  const rec = $('#recInfo', ui.raiz);
  if (rec) rec.innerHTML = vivo.gravando ? `<span class="row"><span class="rec-dot"></span> ${duracao(Date.now() - vivo.gravando.inicio)} · ${vivo.gravando.amostras.length} amostras</span>` : '';
}

function atualizarBarra() {
  const ui = vivo.ui;
  if (!ui) return;
  const bp = $('#btnPlay', ui.raiz);
  bp.innerHTML = vivo.rodando ? `${icone('stop')} Pausar` : `${icone('play')} Iniciar`;
  bp.disabled = !conectado();
  const br = $('#btnRec', ui.raiz);
  br.innerHTML = vivo.gravando ? `${icone('stop')} Parar gravação` : `${icone('record')} Gravar`;
  br.classList.toggle('danger', !!vivo.gravando);
  br.disabled = !conectado();
  desenharValores();
}

// ------------------------------------------------------------------ escolha de PIDs
function escolherPids() {
  const tab = tabela();
  if (!tab) return;
  const atuais = new Set(config.pidsSelecionados || tab.json.selecao_padrao);
  const obd = estado.obd;
  const conhecido = obd && obd.suportadosUniao.size;
  const grupos = {};
  tab.todos.filter((p) => p.listavel !== false).forEach((p) => { (grupos[p.grupo || 'Outros'] ||= []).push(p); });
  const htmlLista = Object.entries(grupos).map(([g, itens]) => `<div class="section-title">${escHtml(g)}</div><div class="pid-pick">${itens.map((p) => {
    const sup = !conhecido || obd.suporta(p.pid);
    return `<label class="${sup ? '' : 'unsupported'}"><input type="checkbox" value="${p.pid}" ${atuais.has(p.pid) ? 'checked' : ''} ${sup ? '' : 'disabled'}>
      <span><b>${escHtml(p.nome)}</b><br><span class="muted small">${p.pid === 'RV' ? 'ATRV' : p.fonte === 'modulo' ? 'Módulo ' + p.tx + ' · ' + p.cmd.match(/../g).join(' ') : 'PID 01 ' + p.pid}${p.unidade ? ' · ' + escHtml(p.unidade) : ''}${sup ? '' : ' · não suportado pelo carro'}</span></span></label>`;
  }).join('')}</div>`).join('');
  modal({
    titulo: 'Escolher PIDs',
    conteudo: `<p class="muted small">Menos PIDs = atualização mais rápida.${conhecido ? ` O carro informou ${obd.suportadosUniao.size} PIDs suportados.` : ' Conecte para ver quais o carro suporta.'}</p>${htmlLista}`,
    botoes: [
      { texto: 'Padrão', classe: 'ghost', aoClicar: async () => { await salvarConfig({ pidsSelecionados: null }); montarConteudo(); } },
      { texto: 'Salvar', classe: 'primary', aoClicar: async (r) => {
        const sel = $$('input[type=checkbox]:checked', r).map((i) => i.value);
        await salvarConfig({ pidsSelecionados: sel });
        if (vivo.gravando) toast('A gravação atual continua com os PIDs anteriores.', 'warn');
        montarConteudo();
      } }
    ]
  });
}

