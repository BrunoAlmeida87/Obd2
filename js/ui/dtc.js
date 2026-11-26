/* Aba Erros: armazenados (03), pendentes (07), permanentes (0A) e módulos Kia (experimental). */
import { estado, aoMudar, exigirConexao, conectado, notificar } from '../app.js';
import { config, salvarConfig } from '../settings.js';
import { buscarDtc, problemasConhecidos, textosDb } from '../dtcdb.js';
import { salvarLeitura } from '../storage.js';
import { el, $, $$, icone, escHtml, modal, confirmar, perguntar, comCarregamento, toast, vazio } from './dom.js';
import { dataHora } from '../util.js';

const ABAS = [
  { id: 'armazenados', nome: 'Armazenados' },
  { id: 'pendentes', nome: 'Pendentes' },
  { id: 'permanentes', nome: 'Permanentes' },
  { id: 'modulos', nome: 'Módulos Kia' }
];
let abaAtual = 'armazenados';

// ------------------------------------------------------------------ leitura
/** Lê todos os códigos OBD (03/07/0A), status, freeze frame e salva no histórico. */
export async function lerErros() {
  exigirConexao();
  const obd = estado.obd;
  const armazenados = await obd.lerDtcs('03');
  const pendentes = await obd.lerDtcs('07');
  let permanentes = [];
  try { permanentes = await obd.lerDtcs('0A'); } catch (e) { console.warn('0A', e); }
  let status = null;
  try { status = await obd.lerStatus(); estado.status = status; } catch (e) { console.warn('status', e); }
  let freeze = null;
  try { freeze = await obd.lerFreezeFrame(); } catch (e) { console.warn('freeze', e); }
  if (!estado.vin) { try { estado.vin = await obd.lerVin(); } catch { /* ignora */ } }

  // Só pergunta o km se o usuário ativou isso em Configurações; senão usa o último km salvo (se houver)
  let km = config.ultimoKm || null;
  if (config.perguntarKm) {
    km = await perguntar('Quilometragem', 'Km atual do painel (opcional, ajuda a comparar leituras)', config.ultimoKm, 'number');
    if (km) salvarConfig({ ultimoKm: km });
  }

  const leitura = {
    tipo: 'leitura',
    data: new Date().toISOString(),
    km: km ? Number(km) : null,
    vin: estado.vin,
    demo: estado.demo,
    protocolo: estado.info.protocolo,
    elm: estado.info.versao,
    status: status ? { mil: status.mil, qtdDtc: status.qtdDtc, incompletos: status.incompletos, monitores: status.monitores.map(({ id, nome, suportado, completo }) => ({ id, nome, suportado, completo })) } : null,
    dtcs: { armazenados, pendentes, permanentes, modulos: [] },
    freeze
  };
  leitura.id = await salvarLeitura(leitura);
  estado.ultimaLeitura = leitura;
  notificar();
  const total = armazenados.length + pendentes.length + permanentes.length;
  toast(total ? `${total} código(s) encontrado(s).` : 'Nenhum código de erro encontrado.', total ? 'warn' : 'ok');
  return true;
}

// ------------------------------------------------------------------ render
export function render(view) {
  const raiz = el('<div></div>');
  view.appendChild(raiz);
  const desenhar = () => { raiz.innerHTML = html(); ligar(raiz); };
  desenhar();
  return aoMudar(desenhar);
}

function contagem(id) {
  const d = estado.ultimaLeitura?.dtcs;
  if (!d) return 0;
  if (id === 'modulos') return (d.modulos || []).reduce((s, m) => s + (m.dtcs?.length || 0), 0);
  return d[id]?.length || 0;
}

function html() {
  const l = estado.ultimaLeitura;
  const seg = `<div class="segmented" role="tablist">${ABAS.map((a) => `<button role="tab" data-aba="${a.id}" class="${a.id === abaAtual ? 'active' : ''}">${a.nome}<span class="count">${contagem(a.id)}</span></button>`).join('')}</div>`;
  const topo = `<div class="row between" style="margin-bottom:10px">
    <div class="muted small">${l ? 'Leitura de ' + dataHora(l.data) + (l.km ? ` · ${l.km.toLocaleString('pt-BR')} km` : '') : 'Nenhuma leitura ainda'}</div>
    <div class="row"><button class="btn sm" id="btnRelErros" ${l ? '' : 'disabled'}>${icone('printer')} Relatório</button>
    <button class="btn sm" id="btnReler" ${conectado() ? '' : 'disabled'}>${icone('refresh')} Ler</button></div></div>`;

  if (abaAtual === 'modulos') return seg + topo + htmlModulos();

  const lista = l?.dtcs?.[abaAtual] || [];
  const explic = {
    armazenados: 'Códigos confirmados (modo 03). Normalmente acendem a luz de injeção.',
    pendentes: 'Falhas detectadas uma vez, ainda não confirmadas (modo 07). Podem virar armazenadas.',
    permanentes: 'Códigos permanentes (modo 0A): não apagam pelo scanner, somem sozinhos quando o carro confirma o reparo.'
  }[abaAtual];
  let corpo;
  if (!l) corpo = vazio('search', conectado() ? 'Toque em “Ler” para buscar códigos.' : 'Conecte ao carro (ou ative o modo demo) e toque em “Ler erros”.');
  else if (!lista.length) corpo = vazio('check', 'Nenhum código nesta categoria.');
  else corpo = lista.map((d) => cardDtc(d, l.freeze)).join('');
  const rodape = abaAtual !== 'permanentes' ? `<div class="sticky-footer"><button class="btn danger block" id="btnApagar" ${conectado() ? '' : 'disabled'}>${icone('trash')} Apagar códigos</button></div>` : '';
  return seg + topo + `<p class="muted small">${explic}</p>` + corpo + rodape;
}

function cardDtc(d, freeze) {
  const info = buscarDtc(d.codigo);
  const sev = info.severidade || 'media';
  const temFreeze = freeze && freeze.dtc === d.codigo;
  const codigoTxt = d.ftb && d.ftb !== '00' ? `${d.codigo}-${d.ftb}` : d.codigo;
  return `<button class="dtc sev-${sev}" data-codigo="${escHtml(d.codigo)}" data-ecu="${escHtml(d.ecu || '')}" data-ftb="${escHtml(d.ftb || '')}" data-status="${escHtml(d.statusTexto || '')}">
    <div class="code">${escHtml(codigoTxt)}</div>
    <div class="desc"><b>${escHtml(info.descricao || '')}</b>
      <div class="meta">${escHtml(info.sistema || '')}${d.ecu ? ' · ECU ' + escHtml(d.ecu) : ''}</div>
      <div><span class="tag ${sev}">${escHtml(rotuloSev(sev))}</span>${info.fabricante && info.fabricante !== 'generico' ? `<span class="tag">${escHtml(info.fabricante)}</span><span class="tag">confiança ${escHtml(info.confianca || '?')}</span>` : ''}${temFreeze ? '<span class="tag">freeze frame</span>' : ''}${!info.encontrado ? '<span class="tag">sem descrição exata</span>' : ''}</div>
    </div></button>`;
}

function rotuloSev(s) {
  return textosDb().severidades?.[s]?.rotulo || s;
}

function htmlModulos() {
  const res = estado.ultimaLeitura?.dtcs?.modulos || [];
  const linhas = config.modulos.map((m) => {
    const r = res.find((x) => x.modulo?.id === m.id);
    let conteudo = '<div class="muted small">Ainda não lido.</div>';
    if (r?.erro) conteudo = `<div class="small" style="color:var(--bad)">${escHtml(r.erro)}</div>`;
    else if (r) {
      conteudo = `<div class="muted small">Protocolo ${escHtml(r.protocolo)} · ${r.dtcs.length} código(s)</div>` +
        (r.dtcs.length ? r.dtcs.map((d) => cardDtc({ ...d, ecu: m.rx })).join('') : '');
    }
    const bloqueado = m.critico && !config.permitirApagarCriticos;
    return `<div class="card" data-mod="${escHtml(m.id)}">
      <div class="row between"><div><b>${escHtml(m.nome)}</b> <span class="muted small mono">${escHtml(m.tx)}→${escHtml(m.rx)}</span>${m.nota ? `<div class="muted small">${escHtml(m.nota)}</div>` : ''}</div>
      ${m.critico ? '<span class="tag alta">crítico</span>' : ''}</div>
      <div style="margin:8px 0">${conteudo}</div>
      <div class="btn-grid">
        <button class="btn sm" data-ler="${escHtml(m.id)}" ${conectado() ? '' : 'disabled'}>${icone('search')} Ler</button>
        <button class="btn sm ${bloqueado ? '' : 'danger'}" data-apagar="${escHtml(m.id)}" ${conectado() && r && !r.erro && r.dtcs.length && !bloqueado ? '' : 'disabled'} title="${bloqueado ? 'Desativado por segurança — habilite em Configurações' : ''}">${icone('trash')} ${bloqueado ? 'Apagar (bloqueado)' : 'Apagar'}</button>
      </div></div>`;
  }).join('');
  return `<div class="card" style="border-color:#7a3cff"><span class="tag exp">EXPERIMENTAL</span>
    <p class="small" style="margin:6px 0 0">Leitura direta de módulos por CAN (UDS 19 02 FF / KWP2000 18 02 FF 00). Os endereços são <b>prováveis</b> para Hyundai/Kia e devem ser confirmados pela <a href="#more/varredura">varredura de módulos</a>. A tabela é editável em Configurações. Apagar ABS/airbag fica bloqueado por padrão.</p></div>
    <button class="btn primary block" id="btnLerModulos" style="margin:12px 0" ${conectado() ? '' : 'disabled'}>${icone('scan')} Ler todos os módulos</button>
    ${linhas}`;
}

// ------------------------------------------------------------------ eventos
function ligar(raiz) {
  $$('[data-aba]', raiz).forEach((b) => b.addEventListener('click', () => { abaAtual = b.dataset.aba; raiz.innerHTML = html(); ligar(raiz); }));
  $('#btnReler', raiz)?.addEventListener('click', (e) => comCarregamento(e.currentTarget, lerErros, 'Lendo…'));
  $('#btnRelErros', raiz)?.addEventListener('click', () => { location.hash = '#more/relatorios'; });
  $$('.dtc', raiz).forEach((b) => b.addEventListener('click', () => abrirDetalhe(b.dataset.codigo, b.dataset)));
  $('#btnApagar', raiz)?.addEventListener('click', (e) => comCarregamento(e.currentTarget, apagarComConfirmacao, 'Apagando…'));
  $('#btnLerModulos', raiz)?.addEventListener('click', (e) => comCarregamento(e.currentTarget, () => lerModulos(config.modulos), 'Lendo módulos…'));
  $$('[data-ler]', raiz).forEach((b) => b.addEventListener('click', (e) => {
    const m = config.modulos.find((x) => x.id === b.dataset.ler);
    comCarregamento(e.currentTarget, () => lerModulos([m]), 'Lendo…');
  }));
  $$('[data-apagar]', raiz).forEach((b) => b.addEventListener('click', (e) => {
    const m = config.modulos.find((x) => x.id === b.dataset.apagar);
    comCarregamento(e.currentTarget, () => apagarModulo(m), 'Apagando…');
  }));
}

export function abrirDetalhe(codigo, extra = {}) {
  const info = buscarDtc(codigo);
  const l = estado.ultimaLeitura;
  const freeze = l?.freeze && l.freeze.dtc === codigo ? l.freeze : null;
  const probs = problemasConhecidos(codigo);
  const lista = (arr) => (arr?.length ? `<ul class="clean">${arr.map((x) => `<li>${escHtml(x)}</li>`).join('')}</ul>` : '<span class="muted">—</span>');
  const sev = info.severidade || 'media';
  const htmlDet = `
    <div class="row wrap" style="margin-bottom:8px"><span class="tag ${sev}">${escHtml(rotuloSev(sev))}</span><span class="tag">${escHtml(info.sistema || '')}</span>
      ${extra.ecu ? `<span class="tag mono">ECU ${escHtml(extra.ecu)}</span>` : ''}${extra.ftb && extra.ftb !== '00' ? `<span class="tag mono">tipo de falha ${escHtml(extra.ftb)}</span>` : ''}</div>
    <p style="font-size:1.1rem;font-weight:700;margin:6px 0 12px">${escHtml(info.descricao || '')}</p>
    ${!info.encontrado ? `<div class="warn-box small">${escHtml(textosDb().aviso_sem_entrada || '')}</div>` : ''}
    ${extra.status ? `<p class="small"><b>Status no módulo:</b> ${escHtml(extra.status)}</p>` : ''}
    <h3>Posso rodar?</h3><p>${escHtml(info.pode_rodar || '—')}</p>
    <h3>Causas comuns</h3>${lista(info.causas_comuns)}
    <h3 style="margin-top:12px">O que verificar</h3>${lista(info.verificacoes)}
    ${info.notas_cerato ? `<h3 style="margin-top:12px">No Cerato 2014</h3><p>${escHtml(info.notas_cerato)}</p>` : ''}
    ${probs.map((p) => `<div class="card" style="margin-top:12px"><b>${icone('wrench')} Problema conhecido: ${escHtml(p.titulo)}</b><p class="small">${escHtml(p.explicacao)}</p>${p.sintomas?.length ? `<div class="small"><b>Sintomas:</b> ${escHtml(p.sintomas.join('; '))}</div>` : ''}</div>`).join('')}
    ${freeze ? htmlFreeze(freeze) : ''}
    <p class="muted small" style="margin-top:14px">Origem: ${escHtml(info.fabricante === 'generico' ? 'código genérico SAE J2012 / ISO 15031-6' : info.fabricante || '')}${info.confianca ? ' · confiança ' + escHtml(info.confianca) : ''}${info.fonte ? ' · fonte: ' + escHtml(info.fonte) : ''}</p>`;
  modal({ titulo: codigo, conteudo: htmlDet });
}

function htmlFreeze(f) {
  return `<h3 style="margin-top:14px">${icone('info')} Freeze frame (condições no momento da falha)</h3>
    <div class="table-wrap"><table class="t"><tbody>
    ${f.valores.map((v) => `<tr><td>${escHtml(v.nome)}</td><td class="num"><b>${escHtml(v.texto)}</b> ${escHtml(v.unidade || '')}</td></tr>`).join('')}
    </tbody></table></div>`;
}

// ------------------------------------------------------------------ apagar (modo 04)
async function apagarComConfirmacao() {
  exigirConexao();
  const ok1 = await confirmar('Apagar códigos?', `
    <p>Isto envia o <b>modo 04</b> para a central do motor e câmbio.</p>
    <div class="warn-box"><b>Atenção:</b><ul class="clean small">
      <li>Apaga os códigos armazenados, pendentes e o freeze frame.</li>
      <li><b>Zera todos os monitores de prontidão</b>. O carro pode ser <b>reprovado na vistoria/inspeção</b> até rodar alguns dias e completar os monitores.</li>
      <li>Não conserta nada: se o defeito continuar, o código volta.</li>
    </ul></div>
    <p class="small">Exigência: <b>motor desligado e ignição ligada</b>.</p>`, { textoOk: 'Continuar', perigo: true });
  if (!ok1) return;

  const desligado = await estado.obd.motorDesligado();
  if (!desligado) {
    throw new Error(estado.demo
      ? 'O motor está ligado (rotação > 0). No modo demo, desligue o motor simulado em Mais › Modo demonstração.'
      : 'O motor está ligado. Desligue o motor, deixe só a ignição ligada e tente de novo.');
  }
  const ok2 = await confirmar('Confirmação final', '<p>Tem certeza? Esta ação <b>não pode ser desfeita</b>. Anote ou exporte os códigos antes, se quiser mostrar ao mecânico.</p>', { textoOk: 'Sim, apagar agora', perigo: true });
  if (!ok2) return;

  const anteriores = estado.ultimaLeitura?.dtcs || null;
  const ecus = await estado.obd.apagarDtcs();
  await salvarLeitura({ tipo: 'apagamento', data: new Date().toISOString(), km: config.ultimoKm ? Number(config.ultimoKm) : null, vin: estado.vin, demo: estado.demo, ecus, apagados: anteriores });
  toast(`Códigos apagados (${ecus.join(', ')}). Lendo de novo…`, 'ok');
  await lerErros();
}

// ------------------------------------------------------------------ módulos Kia
async function lerModulos(lista) {
  exigirConexao();
  if (!estado.ultimaLeitura) {
    estado.ultimaLeitura = { tipo: 'leitura', data: new Date().toISOString(), km: null, vin: estado.vin, demo: estado.demo, dtcs: { armazenados: [], pendentes: [], permanentes: [], modulos: [] }, freeze: null };
  }
  const d = estado.ultimaLeitura.dtcs;
  d.modulos ||= [];
  for (const m of lista) {
    let resultado;
    try {
      const r = await estado.kia.lerModulo(m);
      resultado = { modulo: { ...m }, protocolo: r.protocolo, dtcs: r.dtcs, log: r.log };
    } catch (e) {
      resultado = { modulo: { ...m }, erro: e.message, dtcs: [] };
    }
    d.modulos = d.modulos.filter((x) => x.modulo?.id !== m.id);
    d.modulos.push(resultado);
    notificar();
  }
  estado.ultimaLeitura.id = await salvarLeitura(estado.ultimaLeitura);
  const total = d.modulos.reduce((s, x) => s + x.dtcs.length, 0);
  toast(`Módulos lidos: ${total} código(s).`, total ? 'warn' : 'ok');
}

async function apagarModulo(m) {
  exigirConexao();
  const r = estado.ultimaLeitura?.dtcs?.modulos?.find((x) => x.modulo?.id === m.id);
  if (!r) return;
  const ok = await confirmar(`Apagar códigos do ${m.nome}?`, `<div class="warn-box small">Função <b>experimental</b>. ${m.critico ? '<b>Módulo de segurança</b>: se a falha for real, o sistema pode ficar desativado sem aviso. Só apague depois do reparo.' : ''} Motor desligado, ignição ligada.</div>`, { textoOk: 'Apagar', perigo: true });
  if (!ok) return;
  await estado.kia.apagarModulo(m, r.protocolo);
  toast('Comando aceito pelo módulo. Lendo de novo…', 'ok');
  await lerModulos([m]);
}
