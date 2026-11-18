/* Aba Histórico: linha do tempo de leituras, apagamentos e sessões gravadas; comparação; backup. */
import { listarLeituras, listarSessoes, obterSessao, excluirLeitura, excluirSessao, exportarTudo, importarTudo } from '../storage.js';
import { buscarDtc } from '../dtcdb.js';
import { estado } from '../app.js';
import { el, $, $$, icone, escHtml, modal, confirmar, toast, vazio, comCarregamento } from './dom.js';
import { dataHora, duracao, baixarArquivo, gerarCsv, carimbo, escolherArquivo } from '../util.js';
import { abrirRelatorio, baixarRelatorio } from './report.js';
import { exportarSessaoCsv } from './live.js';
import { formatarNumero } from '../obd.js';

const codigosDe = (l) => {
  const d = l?.dtcs || {};
  const s = new Set();
  ['armazenados', 'pendentes', 'permanentes'].forEach((k) => (d[k] || []).forEach((x) => s.add(x.codigo)));
  (d.modulos || []).forEach((m) => (m.dtcs || []).forEach((x) => s.add(x.codigo)));
  return s;
};

/**
 * Compara uma leitura com a anterior:
 *  novos    = estão nesta e não estavam na anterior
 *  sumiram  = estavam na anterior e não estão nesta
 *  voltaram = estão nesta e tinham sido apagados em um apagamento anterior a ela
 */
export function comparar(leitura, todas) {
  const ordem = [...todas].sort((a, b) => (a.data < b.data ? -1 : 1));
  const idx = ordem.findIndex((x) => x.id === leitura.id && x.tipo === leitura.tipo);
  const antes = ordem.slice(0, idx);
  const anterior = [...antes].reverse().find((x) => x.tipo === 'leitura');
  if (!anterior) return null;
  const atual = codigosDe(leitura);
  const ant = codigosDe(anterior);
  const apagados = new Set();
  antes.filter((x) => x.tipo === 'apagamento').forEach((ap) => codigosDe({ dtcs: ap.apagados }).forEach((c) => apagados.add(c)));
  return {
    anterior,
    novos: [...atual].filter((c) => !ant.has(c)),
    sumiram: [...ant].filter((c) => !atual.has(c)),
    voltaram: [...atual].filter((c) => apagados.has(c))
  };
}

export function render(view) {
  const raiz = el(`<div>
    <div class="btn-grid" style="margin-bottom:12px">
      <button class="btn" id="btnBackup">${icone('download')} Backup JSON</button>
      <button class="btn" id="btnImportar">${icone('upload')} Importar</button>
      <button class="btn" id="btnCsv">${icone('file')} Exportar CSV</button>
      <button class="btn" id="btnRelatorio">${icone('printer')} Relatório</button>
    </div>
    <div id="tl"><div class="empty"><span class="spin"></span></div></div>
  </div>`);
  view.appendChild(raiz);
  let leituras = [];
  let sessoes = [];

  const carregar = async () => {
    try {
      [leituras, sessoes] = await Promise.all([listarLeituras(), listarSessoes()]);
    } catch (e) {
      $('#tl', raiz).innerHTML = vazio('alert', 'Não foi possível abrir o histórico (IndexedDB bloqueado?).');
      return;
    }
    const itens = [...leituras.map((l) => ({ ...l, _k: 'l' })), ...sessoes.map((s) => ({ ...s, _k: 's' }))].sort((a, b) => (a.data < b.data ? 1 : -1));
    if (!itens.length) { $('#tl', raiz).innerHTML = vazio('history', 'Nada salvo ainda. Cada leitura de erros e cada gravação ao vivo aparece aqui.'); return; }
    $('#tl', raiz).innerHTML = `<div class="timeline">${itens.map((x) => itemHtml(x, leituras)).join('')}</div>`;
    $$('[data-item]', raiz).forEach((b) => b.addEventListener('click', () => {
      const [k, id] = b.dataset.item.split(':');
      if (k === 's') abrirSessao(Number(id), carregar);
      else abrirLeitura(leituras.find((l) => l.id === Number(id)), leituras, carregar);
    }));
  };

  $('#btnBackup', raiz).addEventListener('click', async () => {
    const dados = await exportarTudo();
    baixarArquivo(`backup-cerato-obd-${carimbo()}.json`, JSON.stringify(dados, null, 1), 'application/json');
    toast('Backup exportado.', 'ok');
  });
  $('#btnImportar', raiz).addEventListener('click', (e) => comCarregamento(e.currentTarget, async () => {
    const { texto } = await escolherArquivo('.json,application/json');
    let dados;
    try { dados = JSON.parse(texto); } catch { throw new Error('O arquivo não é um JSON válido.'); }
    const substituir = await confirmar('Importar backup', `<p>O arquivo tem ${dados.leituras?.length || 0} leitura(s) e ${dados.sessoes?.length || 0} sessão(ões).</p><p>Deseja <b>substituir</b> o histórico atual? (Cancelar = somar ao atual.)</p>`, { textoOk: 'Substituir' });
    const n = await importarTudo(dados, { substituir });
    toast(`${n} leitura(s) importada(s).`, 'ok');
    carregar();
  }, 'Importando…'));
  $('#btnCsv', raiz).addEventListener('click', () => exportarCsvLeituras(leituras));
  $('#btnRelatorio', raiz).addEventListener('click', () => {
    const l = leituras.find((x) => x.tipo === 'leitura');
    if (!l) { toast('Nenhuma leitura para gerar relatório.', 'warn'); return; }
    abrirRelatorio(l, comparar(l, leituras));
  });

  carregar();
}

function itemHtml(x, leituras) {
  if (x._k === 's') {
    return `<div class="tl-item session"><button class="card" style="width:100%;text-align:left" data-item="s:${x.id}">
      <div class="muted small">${escHtml(dataHora(x.data))}${x.demo ? ' · demo' : ''}</div>
      <b>${icone('record')} Sessão gravada</b> <span class="muted small">${duracao(x.duracaoMs)} · ${x.qtdAmostras} amostras · ${x.pids.length} PIDs</span></button></div>`;
  }
  if (x.tipo === 'apagamento') {
    const n = codigosDe({ dtcs: x.apagados }).size;
    return `<div class="tl-item clear"><button class="card" style="width:100%;text-align:left" data-item="l:${x.id}">
      <div class="muted small">${escHtml(dataHora(x.data))}${x.km ? ' · ' + x.km.toLocaleString('pt-BR') + ' km' : ''}${x.demo ? ' · demo' : ''}</div>
      <b>${icone('trash')} Códigos apagados</b> <span class="muted small">${n} código(s) · monitores zerados</span></button></div>`;
  }
  const cods = [...codigosDe(x)];
  const cmp = comparar(x, leituras);
  return `<div class="tl-item"><button class="card" style="width:100%;text-align:left" data-item="l:${x.id}">
    <div class="muted small">${escHtml(dataHora(x.data))}${x.km ? ' · ' + x.km.toLocaleString('pt-BR') + ' km' : ''}${x.demo ? ' · demo' : ''}</div>
    <b>${icone('search')} Leitura: ${cods.length} código(s)</b>
    <div class="mono small" style="margin-top:4px">${escHtml(cods.join(' ') || 'nenhum')}</div>
    ${cmp ? `<div class="small" style="margin-top:4px">${cmp.novos.length ? `<span class="diff-new">+${escHtml(cmp.novos.join(' +'))}</span> ` : ''}${cmp.sumiram.length ? `<span class="diff-gone">−${escHtml(cmp.sumiram.join(' −'))}</span> ` : ''}${cmp.voltaram.length ? `<span class="diff-back">↻ voltou: ${escHtml(cmp.voltaram.join(', '))}</span>` : ''}</div>` : ''}
  </button></div>`;
}

function abrirLeitura(l, todas, recarregar) {
  if (!l) return;
  const cmp = l.tipo === 'leitura' ? comparar(l, todas) : null;
  const bloco = (titulo, lista) => `<h3 style="margin-top:12px">${titulo}</h3>${lista?.length ? lista.map((x) => {
    const i = buscarDtc(x.codigo);
    return `<div class="dtc sev-${i.severidade}" style="cursor:default"><div class="code">${escHtml(x.codigo)}</div><div class="desc"><b>${escHtml(i.descricao)}</b><div class="meta">${escHtml(i.sistema)}${x.ecu ? ' · ECU ' + escHtml(x.ecu) : ''}</div></div></div>`;
  }).join('') : '<p class="muted small">Nenhum.</p>'}`;
  const d = l.tipo === 'apagamento' ? (l.apagados || {}) : (l.dtcs || {});
  const conteudo = `
    <p class="muted small">${escHtml(dataHora(l.data))}${l.km ? ' · ' + l.km.toLocaleString('pt-BR') + ' km' : ''} · VIN ${escHtml(l.vin || '—')}${l.demo ? ' · <b>demo</b>' : ''}</p>
    ${l.tipo === 'apagamento' ? '<p><b>Apagamento de códigos (modo 04).</b> Estes eram os códigos lidos antes:</p>' : ''}
    ${cmp ? `<div class="card"><b>Comparação com ${escHtml(dataHora(cmp.anterior.data))}</b><div class="small" style="margin-top:6px">
      <div><span class="diff-new">Novos:</span> ${escHtml(cmp.novos.join(', ') || '—')}</div>
      <div><span class="diff-gone">Sumiram:</span> ${escHtml(cmp.sumiram.join(', ') || '—')}</div>
      <div><span class="diff-back">Voltaram depois de apagados:</span> ${escHtml(cmp.voltaram.join(', ') || '—')}</div></div></div>` : ''}
    ${bloco('Armazenados', d.armazenados)}${bloco('Pendentes', d.pendentes)}${bloco('Permanentes', d.permanentes)}
    ${(d.modulos || []).map((m) => bloco(`Módulo ${escHtml(m.modulo?.nome || '')}`, m.dtcs)).join('')}
    ${l.freeze ? `<h3 style="margin-top:12px">Freeze frame (${escHtml(l.freeze.dtc)})</h3><table class="t">${l.freeze.valores.map((v) => `<tr><td>${escHtml(v.nome)}</td><td class="num">${escHtml(v.texto)} ${escHtml(v.unidade || '')}</td></tr>`).join('')}</table>` : ''}`;
  const botoes = [{ texto: 'Excluir', classe: 'ghost', icone: 'trash', aoClicar: async () => {
    if (!(await confirmar('Excluir registro?', 'Esta leitura será removida do histórico.', { perigo: true, textoOk: 'Excluir' }))) return false;
    await excluirLeitura(l.id);
    if (estado.ultimaLeitura?.id === l.id) estado.ultimaLeitura = null;
    recarregar();
    return true;
  } }];
  if (l.tipo === 'leitura') {
    botoes.push({ texto: 'Relatório', classe: 'primary', icone: 'printer', aoClicar: () => { abrirRelatorio(l, cmp); return false; } });
    botoes.push({ texto: 'Baixar', classe: '', icone: 'download', aoClicar: () => { baixarRelatorio(l, cmp); return false; } });
  }
  modal({ titulo: l.tipo === 'apagamento' ? 'Apagamento' : 'Leitura de erros', conteudo, botoes });
}

async function abrirSessao(id, recarregar) {
  const s = await obterSessao(id);
  if (!s) return;
  const stats = s.pids.map((p) => {
    const vals = s.amostras.map((a) => a.v[p]).filter((v) => typeof v === 'number');
    if (!vals.length) return { p, n: 0 };
    const min = Math.min(...vals); const max = Math.max(...vals);
    const med = vals.reduce((a, b) => a + b, 0) / vals.length;
    return { p, n: vals.length, min, max, med };
  });
  const conteudo = `<p class="muted small">${escHtml(dataHora(s.data))} · ${duracao(s.duracaoMs)} · ${s.amostras.length} amostras${s.demo ? ' · demo' : ''}</p>
    <div class="table-wrap"><table class="t"><thead><tr><th>PID</th><th class="num">Mín</th><th class="num">Média</th><th class="num">Máx</th></tr></thead><tbody>
    ${stats.map((x) => `<tr><td>${escHtml(s.nomes?.[x.p] || x.p)} <span class="muted small">${escHtml(s.unidades?.[x.p] || '')}</span></td>${x.n ? `<td class="num">${formatarNumero(x.min, 1)}</td><td class="num">${formatarNumero(x.med, 1)}</td><td class="num">${formatarNumero(x.max, 1)}</td>` : '<td colspan="3" class="muted">sem dados</td>'}</tr>`).join('')}
    </tbody></table></div>`;
  modal({
    titulo: 'Sessão gravada',
    conteudo,
    botoes: [
      { texto: 'Excluir', classe: 'ghost', icone: 'trash', aoClicar: async () => {
        if (!(await confirmar('Excluir sessão?', 'A gravação será removida.', { perigo: true, textoOk: 'Excluir' }))) return false;
        await excluirSessao(id); recarregar(); return true;
      } },
      { texto: 'Exportar CSV', classe: 'primary', icone: 'download', aoClicar: () => { exportarSessaoCsv(s); return false; } }
    ]
  });
}

function exportarCsvLeituras(leituras) {
  const linhas = [['data_hora', 'tipo', 'km', 'vin', 'categoria', 'ecu', 'codigo', 'descricao', 'severidade', 'demo']];
  for (const l of leituras) {
    const d = l.tipo === 'apagamento' ? (l.apagados || {}) : (l.dtcs || {});
    const add = (cat, x) => {
      const i = buscarDtc(x.codigo);
      linhas.push([dataHora(l.data), l.tipo, l.km ?? '', l.vin || '', cat, x.ecu || '', x.codigo, i.descricao, i.severidade, l.demo ? 'sim' : 'não']);
    };
    let algum = false;
    ['armazenados', 'pendentes', 'permanentes'].forEach((k) => (d[k] || []).forEach((x) => { add(k, x); algum = true; }));
    (d.modulos || []).forEach((m) => (m.dtcs || []).forEach((x) => { add('modulo ' + (m.modulo?.nome || ''), { ...x, ecu: m.modulo?.rx }); algum = true; }));
    if (!algum) linhas.push([dataHora(l.data), l.tipo, l.km ?? '', l.vin || '', '', '', '', 'sem códigos', '', l.demo ? 'sim' : 'não']);
  }
  baixarArquivo(`historico-obd-${carimbo()}.csv`, gerarCsv(linhas), 'text/csv;charset=utf-8');
  toast('CSV exportado.', 'ok');
}
