/* Relatórios imprimíveis (HTML) — podem ser salvos como PDF pela impressão do Chrome.
 *  - Relatório dos erros: todos os códigos de uma leitura com explicação completa.
 *  - Relatório completo do carro: identificação, status, monitores, códigos, módulos,
 *    freeze frame, valores de todos os sensores, PIDs suportados e histórico. */
import { buscarDtc, problemasConhecidos } from '../dtcdb.js';
import { escHtml, dataHora, baixarArquivo, carimbo } from '../util.js';
import { config } from '../settings.js';

const CATS = [['armazenados', 'Armazenados (modo 03)', 'Confirmados. Normalmente acendem a luz de injeção.'],
  ['pendentes', 'Pendentes (modo 07)', 'Detectados uma vez, ainda não confirmados. Podem virar armazenados.'],
  ['permanentes', 'Permanentes (modo 0A)', 'Não apagam pelo scanner; somem sozinhos quando o carro confirma o reparo.']];
const SEV = { alta: 'GRAVE', media: 'ATENÇÃO', baixa: 'LEVE' };
const fmt06 = (v) => (Math.abs(v) >= 100 || Number.isInteger(v) ? Math.round(v * 10) / 10 : Number(v.toPrecision(3))).toLocaleString('pt-BR');

const CSS = `
body{font:14px/1.45 system-ui,sans-serif;color:#111;margin:24px;max-width:960px}
h1{font-size:21px;margin:0 0 4px}h2{font-size:16px;margin:24px 0 8px;border-bottom:2px solid #222;padding-bottom:3px}h3{font-size:14px;margin:14px 0 4px}
table{width:100%;border-collapse:collapse;margin:4px 0}td,th{border-bottom:1px solid #ccc;padding:5px 6px;vertical-align:top;text-align:left}th{font-size:12px;color:#555}
td.num{text-align:right;white-space:nowrap}.cod{font:700 16px monospace;width:110px}.s{font-size:12.5px;color:#333;margin-top:3px}
.sev{display:inline-block;padding:1px 7px;border-radius:9px;font-size:11px;font-weight:700;color:#fff}.sev.alta{background:#c00}.sev.media{background:#b07800}.sev.baixa{background:#0a5bc4}
tr.alta td.cod{color:#b00}tr.media td.cod{color:#8a5a00}tr.baixa td.cod{color:#0a4fa0}
.meta td{border:0;padding:2px 10px 2px 0}.ok{color:#0a6b2f;font-weight:600}.ruim{color:#b00;font-weight:700}
.resumo{display:flex;gap:10px;flex-wrap:wrap;margin:10px 0}.box{border:1px solid #bbb;border-radius:8px;padding:8px 12px;min-width:120px}.box b{display:block;font-size:20px}
.aviso{font-size:12px;color:#444;margin-top:28px;border-top:1px solid #ccc;padding-top:8px}.demo{background:#ffe9a8;padding:8px;border-radius:6px;font-weight:700}
.mono{font-family:monospace}@media print{body{margin:10mm}.noprint{display:none}h2{break-after:avoid}tr{break-inside:avoid}}`;

function cabecalho(titulo, l) {
  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escHtml(titulo)} — ${escHtml(dataHora(l.data))}</title><style>${CSS}</style></head><body>
<button class="noprint" onclick="print()" style="float:right;padding:10px 16px;font-size:15px">Imprimir / salvar PDF</button>
<h1>${escHtml(titulo)}</h1>
${l.demo ? '<p class="demo">MODO DEMONSTRAÇÃO — dados simulados, não são do seu carro.</p>' : ''}
<table class="meta">
<tr><td>Veículo:</td><td><b>Kia Cerato 2014${config.motor ? ' ' + escHtml(config.motor) : ''}${config.cambio ? ' · câmbio ' + escHtml(config.cambio) : ''}</b></td></tr>
<tr><td>VIN:</td><td class="mono"><b>${escHtml(l.vin || 'não lido')}</b></td></tr>
<tr><td>Data:</td><td>${escHtml(dataHora(l.data))}</td></tr>
<tr><td>Quilometragem:</td><td>${l.km ? escHtml(Number(l.km).toLocaleString('pt-BR')) + ' km' : 'não informada'}</td></tr>
<tr><td>Adaptador:</td><td>${escHtml(l.elm || '—')} · ${escHtml(l.protocolo || '—')}${l.info?.tensao != null ? ` · bateria ${escHtml(String(l.info.tensao).replace('.', ','))} V` : ''}</td></tr>
</table>`;
}

function todosCodigos(l) {
  const d = l.dtcs || {};
  const out = [];
  CATS.forEach(([k]) => (d[k] || []).forEach((x) => out.push({ ...x, cat: k })));
  (d.modulos || []).forEach((m) => (m.dtcs || []).forEach((x) => out.push({ ...x, ecu: m.modulo?.rx, cat: 'modulo', modulo: m.modulo?.nome })));
  return out;
}

function resumo(l) {
  const cods = todosCodigos(l);
  const unicos = new Map();
  cods.forEach((c) => unicos.set(c.codigo, buscarDtc(c.codigo).severidade));
  const n = (s) => [...unicos.values()].filter((x) => x === s).length;
  const st = l.status;
  return `<div class="resumo">
    <div class="box">Luz de injeção<b class="${st?.mil ? 'ruim' : 'ok'}">${st ? (st.mil ? 'ACESA' : 'apagada') : '—'}</b></div>
    <div class="box">Códigos diferentes<b>${unicos.size}</b></div>
    <div class="box">Graves<b class="${n('alta') ? 'ruim' : ''}">${n('alta')}</b></div>
    <div class="box">Atenção<b>${n('media')}</b></div>
    <div class="box">Leves<b>${n('baixa')}</b></div>
    <div class="box">Monitores incompletos<b>${st ? st.incompletos : '—'}</b></div>
  </div>`;
}

function linhasDtc(lista, freeze) {
  return lista.map((x) => {
    const i = buscarDtc(x.codigo);
    const probs = problemasConhecidos(x.codigo);
    return `<tr class="${i.severidade}"><td class="cod">${escHtml(x.codigo)}${x.ftb && x.ftb !== '00' ? '-' + escHtml(x.ftb) : ''}<br><span class="sev ${i.severidade}">${SEV[i.severidade] || ''}</span></td>
      <td><b>${escHtml(i.descricao)}</b>
      <div class="s">${escHtml(i.sistema)} · ECU ${escHtml(x.ecu || '?')}${i.fabricante && i.fabricante !== 'generico' ? ` · código ${escHtml(i.fabricante)} (confiança ${escHtml(i.confianca)})` : ''}${freeze && freeze.dtc === x.codigo ? ' · <b>gerou o freeze frame</b>' : ''}</div>
      ${!i.encontrado ? '<div class="s"><i>Sem descrição exata no banco; texto pela faixa do código.</i></div>' : ''}
      ${x.statusTexto ? `<div class="s"><b>Status no módulo:</b> ${escHtml(x.statusTexto)}</div>` : ''}
      <div class="s"><b>Posso rodar?</b> ${escHtml(i.pode_rodar || '—')}</div>
      ${i.causas_comuns?.length ? `<div class="s"><b>Causas comuns:</b> ${escHtml(i.causas_comuns.join('; '))}</div>` : ''}
      ${i.verificacoes?.length ? `<div class="s"><b>O que verificar:</b> ${escHtml(i.verificacoes.join('; '))}</div>` : ''}
      ${i.notas_cerato ? `<div class="s"><b>No Cerato 2014:</b> ${escHtml(i.notas_cerato)}</div>` : ''}
      ${probs.map((p) => `<div class="s"><b>Problema conhecido — ${escHtml(p.titulo)}:</b> ${escHtml(p.explicacao)}</div>`).join('')}
      </td></tr>`;
  }).join('');
}

function secaoCodigos(l) {
  const d = l.dtcs || {};
  let h = CATS.map(([k, nome, exp]) => `<h2>${nome}</h2><p class="s">${exp}</p>${(d[k] || []).length ? `<table>${linhasDtc(d[k], l.freeze)}</table>` : '<p class="ok">Nenhum código.</p>'}`).join('');
  if ((d.modulos || []).length) {
    h += '<h2>Módulos Kia (leitura experimental)</h2>' + d.modulos.map((m) => `<h3>${escHtml(m.modulo?.nome || '')} <span class="mono">(${escHtml(m.modulo?.tx || '')}→${escHtml(m.modulo?.rx || '')})</span>${m.protocolo ? ' · ' + escHtml(m.protocolo) : ''}</h3>
      ${m.erro ? `<p class="s">${escHtml(m.erro)}</p>` : m.dtcs.length ? `<table>${linhasDtc(m.dtcs.map((x) => ({ ...x, ecu: m.modulo?.rx })))}</table>` : '<p class="ok">Nenhum código.</p>'}`).join('');
  }
  return h;
}

function secaoFreeze(l) {
  if (!l.freeze) return '';
  return `<h2>Freeze frame — condições no momento da falha ${escHtml(l.freeze.dtc)}</h2>
    <table>${l.freeze.valores.map((v) => `<tr><td>${escHtml(v.nome)}</td><td class="num"><b>${escHtml(v.texto)}</b> ${escHtml(v.unidade || '')}</td></tr>`).join('')}</table>`;
}

function secaoMonitores(l) {
  const ms = l.status?.monitores?.filter((m) => m.suportado);
  if (!ms?.length) return '';
  return `<h2>Monitores de prontidão</h2><p class="s">Monitores incompletos podem reprovar o carro na inspeção. Depois de apagar códigos todos voltam a “incompleto”.</p>
    <table><tr><th>Monitor</th><th>Estado</th><th>O que é</th></tr>${ms.map((m) => `<tr><td>${escHtml(m.nome)}</td><td class="${m.completo ? 'ok' : 'ruim'}">${m.completo ? 'Completo' : 'INCOMPLETO'}</td><td class="s">${escHtml(m.explicacao || '')}</td></tr>`).join('')}</table>`;
}

function secaoComparacao(c) {
  if (!c) return '';
  return `<h2>Comparação com a leitura anterior (${escHtml(dataHora(c.anterior.data))})</h2>
    <p><b>Novos:</b> ${escHtml(c.novos.join(', ') || '—')}<br><b>Sumiram:</b> ${escHtml(c.sumiram.join(', ') || '—')}<br><b>Voltaram depois de apagados:</b> ${escHtml(c.voltaram.join(', ') || '—')}</p>`;
}

const RODAPE = `<p class="aviso">Gerado pelo app Cerato OBD2. As descrições são orientativas; confirme o diagnóstico com testes e com o manual de serviço antes de trocar peças.</p></body></html>`;

/** Relatório completo dos erros de uma leitura. */
export function gerarRelatorioHtml(l, comparacao = null) {
  return cabecalho('Relatório de erros — OBD2', l) + resumo(l) + secaoComparacao(comparacao) + secaoCodigos(l) + secaoFreeze(l) + secaoMonitores(l) + RODAPE;
}

/** Relatório completo do carro (leitura feita com "coletar tudo") + histórico. */
export function gerarRelatorioCompletoHtml(l, leituras = [], comparacao = null) {
  const valores = l.valores || [];
  const grupos = {};
  valores.forEach((v) => { (grupos[v.grupo] ||= []).push(v); });
  const secValores = valores.length ? `<h2>Sensores no momento da coleta (${valores.length})</h2>
    <p class="s">Valores lidos ao mesmo tempo. Com motor desligado e ignição ligada, rotação e velocidade ficam em zero.</p>
    ${Object.entries(grupos).map(([g, vs]) => `<h3>${escHtml(g)}</h3><table>${vs.map((v) => `<tr><td>${escHtml(v.nome)} <span class="s mono">(01 ${escHtml(v.pid)})</span></td><td class="num"><b>${escHtml(v.texto)}</b> ${escHtml(v.unidade)}${v.extra ? `<div class="s">${escHtml(v.extra)}</div>` : ''}</td></tr>`).join('')}</table>`).join('')}` : '';
  const ident = `<h2>Identificação do veículo e das centrais</h2><table>
    <tr><td>VIN</td><td class="mono">${escHtml(l.vin || '—')}</td></tr>
    ${(l.nomesEcu || []).map((n) => `<tr><td>Nome da central ${escHtml(n.ecu)}</td><td>${escHtml(n.nome)}</td></tr>`).join('')}
    ${(l.calid || []).map((c) => `<tr><td>Calibração (CALID) · ECU ${escHtml(c.ecu)}</td><td class="mono">${escHtml(c.calid)}</td></tr>`).join('')}
    ${(l.cvn || []).map((c) => `<tr><td>Verificação de calibração (CVN) · ECU ${escHtml(c.ecu)}</td><td class="mono">${escHtml(c.cvn)}</td></tr>`).join('')}
    ${(l.status?.porEcu || []).map((e) => `<tr><td>Central ${escHtml(e.ecu)}</td><td>${e.qtdDtc} código(s) confirmado(s)${e.mil ? ' · pediu a luz de injeção' : ''}</td></tr>`).join('')}
    <tr><td>Adaptador</td><td>${escHtml(l.info?.versao || l.elm || '—')} · ${escHtml(l.info?.dispositivo || '')}</td></tr>
    <tr><td>Protocolo</td><td>${escHtml(l.protocolo || '—')}</td></tr>
    <tr><td>Conexão</td><td>${escHtml(l.transporte || '—')}</td></tr></table>`;
  const t06 = l.modo06 || [];
  const secModo06 = t06.length ? `<h2>Testes internos dos monitores (modo 06)</h2>
    <p class="s">Resultados dos últimos testes que a central fez em cada sistema. “Aprovado perto do limite” indica um componente que está passando, mas com pouca folga.</p>
    <table><tr><th>Sistema / teste</th><th>Valor</th><th>Limites</th><th>Resultado</th></tr>
    ${t06.map((t) => `<tr><td>${escHtml(t.monitor)}<div class="s">${escHtml(t.teste)} · ECU ${escHtml(t.ecu)}</div></td><td class="num">${escHtml(fmt06(t.valor))} ${escHtml(t.unidade)}</td><td class="num s">${escHtml(fmt06(t.min))} a ${escHtml(fmt06(t.max))}</td><td class="${t.passou ? (t.pertoDoLimite ? '' : 'ok') : 'ruim'}">${t.passou ? (t.pertoDoLimite ? '<b>Aprovado perto do limite</b>' : 'Aprovado') : 'REPROVADO'}</td></tr>`).join('')}</table>` : '';
  const ids = (l.dtcs?.modulos || []).filter((m) => m.identificacao?.length);
  const secIds = ids.length ? `<h2>Identificação dos módulos</h2><table>${ids.map((m) => `<tr><td>${escHtml(m.modulo.nome)} <span class="s mono">(${escHtml(m.modulo.tx)})</span></td><td class="s">${m.identificacao.map((c) => `${escHtml(c.campo)}: <span class="mono">${escHtml(c.valor)}</span>`).join('<br>')}</td></tr>`).join('')}</table>` : '';
  const pids = l.pidsSuportados ? `<h2>PIDs suportados pelas centrais (modo 01)</h2><table>${Object.entries(l.pidsSuportados).map(([ecu, ps]) => `<tr><td>ECU ${escHtml(ecu)} (${ps.length})</td><td class="mono s">${escHtml(ps.join(' '))}</td></tr>`).join('')}</table>` : '';
  const hist = leituras.filter((x) => x.tipo === 'leitura' || x.tipo === 'apagamento').slice(0, 30);
  const secHist = hist.length ? `<h2>Histórico (últimos ${hist.length} registros)</h2><table><tr><th>Data</th><th>Km</th><th>Evento</th><th>Códigos</th></tr>
    ${hist.map((x) => { const cods = [...new Set(todosCodigos(x.tipo === 'apagamento' ? { dtcs: x.apagados || {} } : x).map((c) => c.codigo))]; return `<tr><td>${escHtml(dataHora(x.data))}</td><td>${x.km ? escHtml(Number(x.km).toLocaleString('pt-BR')) : '—'}</td><td>${x.tipo === 'apagamento' ? 'Códigos apagados' : 'Leitura' + (x.demo ? ' (demo)' : '')}</td><td class="mono s">${escHtml(cods.join(' ') || 'nenhum')}</td></tr>`; }).join('')}</table>` : '';
  return cabecalho('Relatório completo do carro — OBD2', l) + resumo(l) + ident + secaoComparacao(comparacao) + secaoCodigos(l) + secaoFreeze(l) + secaoMonitores(l) + secModo06 + secValores + secIds + pids + secHist + RODAPE;
}

function gerar(l, leituras, comparacao) {
  return l.completo ? gerarRelatorioCompletoHtml(l, leituras, comparacao) : gerarRelatorioHtml(l, comparacao);
}

export function abrirHtml(html, nomeArquivo) {
  const w = window.open('', '_blank');
  if (w) { w.document.open(); w.document.write(html); w.document.close(); } else baixarArquivo(nomeArquivo, html, 'text/html;charset=utf-8');
}

export function abrirRelatorio(l, comparacao, leituras = []) {
  abrirHtml(gerar(l, leituras, comparacao), `relatorio-obd-${carimbo()}.html`);
}

export function baixarRelatorio(l, comparacao, leituras = []) {
  baixarArquivo(`relatorio-obd-${carimbo()}.html`, gerar(l, leituras, comparacao), 'text/html;charset=utf-8');
}
