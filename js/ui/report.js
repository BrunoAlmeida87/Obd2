/* Relatório imprimível (HTML) para levar ao mecânico. Pode ser salvo como PDF pela impressão do Chrome. */
import { buscarDtc, problemasConhecidos } from '../dtcdb.js';
import { escHtml, dataHora, baixarArquivo, carimbo } from '../util.js';
import { config } from '../settings.js';

const CATS = [['armazenados', 'Armazenados (modo 03)'], ['pendentes', 'Pendentes (modo 07)'], ['permanentes', 'Permanentes (modo 0A)']];

export function gerarRelatorioHtml(leitura, comparacao = null) {
  const d = leitura.dtcs || {};
  const linhasDtc = (lista) => lista.map((x) => {
    const i = buscarDtc(x.codigo);
    const probs = problemasConhecidos(x.codigo);
    return `<tr class="sev-${i.severidade}"><td class="cod">${escHtml(x.codigo)}${x.ftb && x.ftb !== '00' ? '-' + escHtml(x.ftb) : ''}</td>
      <td><b>${escHtml(i.descricao)}</b><div class="s">${escHtml(i.sistema)} · ECU ${escHtml(x.ecu || '?')} · severidade ${escHtml(i.severidade)}</div>
      ${i.causas_comuns?.length ? `<div class="s"><b>Causas comuns:</b> ${escHtml(i.causas_comuns.join('; '))}</div>` : ''}
      ${i.verificacoes?.length ? `<div class="s"><b>Verificações:</b> ${escHtml(i.verificacoes.join('; '))}</div>` : ''}
      ${i.notas_cerato ? `<div class="s"><b>Cerato:</b> ${escHtml(i.notas_cerato)}</div>` : ''}
      ${probs.map((p) => `<div class="s"><b>Problema conhecido:</b> ${escHtml(p.titulo)}</div>`).join('')}
      ${x.statusTexto ? `<div class="s">Status: ${escHtml(x.statusTexto)}</div>` : ''}</td></tr>`;
  }).join('');

  const secoes = CATS.map(([k, nome]) => `<h2>${nome}</h2>${(d[k] || []).length ? `<table>${linhasDtc(d[k])}</table>` : '<p class="ok">Nenhum código.</p>'}`).join('');
  const mods = (d.modulos || []).map((m) => `<h3>${escHtml(m.modulo?.nome || '')} (${escHtml(m.modulo?.tx || '')}→${escHtml(m.modulo?.rx || '')})${m.protocolo ? ' · ' + escHtml(m.protocolo) : ''}</h3>
    ${m.erro ? `<p>${escHtml(m.erro)}</p>` : m.dtcs.length ? `<table>${linhasDtc(m.dtcs.map((x) => ({ ...x, ecu: m.modulo?.rx })))}</table>` : '<p class="ok">Nenhum código.</p>'}`).join('');
  const freeze = leitura.freeze ? `<h2>Freeze frame — ${escHtml(leitura.freeze.dtc)}</h2><table>${leitura.freeze.valores.map((v) => `<tr><td>${escHtml(v.nome)}</td><td><b>${escHtml(v.texto)}</b> ${escHtml(v.unidade || '')}</td></tr>`).join('')}</table>` : '';
  const mon = leitura.status?.monitores?.length ? `<h2>Monitores de prontidão</h2><table>${leitura.status.monitores.filter((m) => m.suportado).map((m) => `<tr><td>${escHtml(m.nome)}</td><td><b>${m.completo ? 'Completo' : 'INCOMPLETO'}</b></td></tr>`).join('')}</table>` : '';
  const comp = comparacao ? `<h2>Comparação com a leitura anterior (${escHtml(dataHora(comparacao.anterior.data))})</h2>
    <p><b>Novos:</b> ${escHtml(comparacao.novos.join(', ') || '—')}<br><b>Sumiram:</b> ${escHtml(comparacao.sumiram.join(', ') || '—')}<br><b>Voltaram depois de apagados:</b> ${escHtml(comparacao.voltaram.join(', ') || '—')}</p>` : '';

  return `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Relatório OBD2 — ${escHtml(dataHora(leitura.data))}</title>
<style>
body{font:14px/1.45 system-ui,sans-serif;color:#111;margin:24px;max-width:900px}
h1{font-size:20px;margin:0 0 4px}h2{font-size:16px;margin:20px 0 6px;border-bottom:2px solid #222;padding-bottom:2px}h3{font-size:14px;margin:12px 0 4px}
table{width:100%;border-collapse:collapse}td{border-bottom:1px solid #ccc;padding:6px;vertical-align:top}
td.cod{font:700 16px monospace;width:100px}.s{font-size:12px;color:#333;margin-top:2px}
tr.sev-alta td.cod{color:#b00}tr.sev-media td.cod{color:#8a5a00}tr.sev-baixa td.cod{color:#0a4fa0}
.meta td{border:0;padding:2px 8px 2px 0}.ok{color:#0a6b2f}.aviso{font-size:12px;color:#444;margin-top:24px;border-top:1px solid #ccc;padding-top:8px}
@media print{body{margin:10mm}.noprint{display:none}}
</style></head><body>
<button class="noprint" onclick="print()" style="float:right;padding:10px 16px;font-size:15px">Imprimir / salvar PDF</button>
<h1>Relatório de diagnóstico OBD2</h1>
<table class="meta"><tr><td>Veículo:</td><td><b>Kia Cerato 2014${config.motor ? ' ' + escHtml(config.motor) : ''}${config.cambio ? ' · câmbio ' + escHtml(config.cambio) : ''}</b></td></tr>
<tr><td>VIN:</td><td><b>${escHtml(leitura.vin || 'não lido')}</b></td></tr>
<tr><td>Data:</td><td>${escHtml(dataHora(leitura.data))}</td></tr>
<tr><td>Quilometragem:</td><td>${leitura.km ? escHtml(leitura.km.toLocaleString('pt-BR')) + ' km' : 'não informada'}</td></tr>
<tr><td>Luz de injeção:</td><td>${leitura.status ? (leitura.status.mil ? '<b>ACESA</b>' : 'apagada') : '—'}${leitura.status ? ` · ${leitura.status.incompletos} monitor(es) incompleto(s)` : ''}</td></tr>
<tr><td>Adaptador:</td><td>${escHtml(leitura.elm || '—')} · ${escHtml(leitura.protocolo || '—')}${leitura.demo ? ' · <b>MODO DEMONSTRAÇÃO (dados simulados)</b>' : ''}</td></tr></table>
${comp}${secoes}${mods ? '<h2>Módulos Kia (experimental)</h2>' + mods : ''}${freeze}${mon}
<p class="aviso">Gerado pelo app Cerato OBD2. As descrições são orientativas; confirme o diagnóstico com testes e com o manual de serviço do veículo.</p>
</body></html>`;
}

export function abrirRelatorio(leitura, comparacao) {
  const html = gerarRelatorioHtml(leitura, comparacao);
  const w = window.open('', '_blank');
  if (w) {
    w.document.open();
    w.document.write(html);
    w.document.close();
  } else {
    baixarRelatorio(leitura, comparacao);
  }
}

export function baixarRelatorio(leitura, comparacao) {
  baixarArquivo(`relatorio-obd-${carimbo()}.html`, gerarRelatorioHtml(leitura, comparacao), 'text/html;charset=utf-8');
}
