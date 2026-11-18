/* Componentes de interface: diálogos, avisos (toast), confirmação e botões com carregamento. */
import { icone } from './icons.js';
import { escHtml } from '../util.js';

export const $ = (sel, raiz = document) => raiz.querySelector(sel);
export const $$ = (sel, raiz = document) => [...raiz.querySelectorAll(sel)];
export { escHtml, icone };

/** Cria elemento a partir de HTML. */
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}

// ------------------------------------------------------------ toast
export function toast(msg, tipo = '', ms = 3000) {
  const raiz = $('#toastRoot');
  while (raiz.childElementCount >= 2) raiz.firstElementChild.remove();
  const t = el(`<div class="toast ${tipo}" role="status">${escHtml(msg)}</div>`);
  raiz.appendChild(t);
  setTimeout(() => t.remove(), ms);
}

// ------------------------------------------------------------ modal
/**
 * Abre um diálogo. conteudo = HTML. Retorna { fechar, raiz, promessa }.
 * botoes: [{ texto, classe, valor, aoClicar }]
 */
export function modal({ titulo, conteudo, botoes = [{ texto: 'Fechar', valor: null }], aoAbrir } = {}) {
  const fundo = el(`<div class="modal-backdrop"><div class="modal" role="dialog" aria-modal="true" aria-label="${escHtml(titulo || '')}">
    ${titulo ? `<h2>${escHtml(titulo)}</h2>` : ''}
    <div class="modal-body"></div>
    <div class="actions"></div>
  </div></div>`);
  const corpo = $('.modal-body', fundo);
  if (typeof conteudo === 'string') corpo.innerHTML = conteudo;
  else if (conteudo) corpo.appendChild(conteudo);
  const acoes = $('.actions', fundo);
  let resolver;
  const promessa = new Promise((r) => { resolver = r; });
  const fechar = (valor) => { fundo.remove(); resolver(valor); document.removeEventListener('keydown', onEsc); };
  const onEsc = (e) => { if (e.key === 'Escape') fechar(null); };
  document.addEventListener('keydown', onEsc);
  botoes.forEach((b) => {
    const btn = el(`<button class="btn ${b.classe || ''}">${b.icone ? icone(b.icone) : ''}${escHtml(b.texto)}</button>`);
    btn.addEventListener('click', async () => {
      if (b.aoClicar) {
        const r = await b.aoClicar(fundo);
        if (r === false) return; // mantém aberto
      }
      fechar(b.valor);
    });
    acoes.appendChild(btn);
  });
  if (!botoes.length) acoes.remove();
  fundo.addEventListener('click', (e) => { if (e.target === fundo) fechar(null); });
  $('#modalRoot').appendChild(fundo);
  aoAbrir?.(fundo);
  return { fechar, raiz: fundo, promessa };
}

/** Confirmação simples. Retorna true/false. */
export function confirmar(titulo, html, { textoOk = 'Confirmar', perigo = false } = {}) {
  return modal({
    titulo,
    conteudo: html,
    botoes: [
      { texto: 'Cancelar', valor: false, classe: 'ghost' },
      { texto: textoOk, valor: true, classe: perigo ? 'danger' : 'primary' }
    ]
  }).promessa.then((v) => v === true);
}

/** Pergunta um texto/número ao usuário. */
export function perguntar(titulo, rotulo, valorInicial = '', tipo = 'text') {
  let valor = null;
  const m = modal({
    titulo,
    conteudo: `<label class="field"><span>${escHtml(rotulo)}</span><input class="input" id="pergunta" type="${tipo}" inputmode="${tipo === 'number' ? 'numeric' : 'text'}" value="${escHtml(valorInicial)}"></label>`,
    botoes: [
      { texto: 'Pular', valor: null, classe: 'ghost' },
      { texto: 'OK', classe: 'primary', valor: '__ok', aoClicar: (r) => { valor = $('#pergunta', r).value; } }
    ],
    aoAbrir: (r) => setTimeout(() => $('#pergunta', r)?.focus(), 50)
  });
  return m.promessa.then((v) => (v === '__ok' ? valor : null));
}

/** Executa uma tarefa mostrando spinner no botão e trata erros com mensagem clara. */
export async function comCarregamento(botao, tarefa, textoCarregando) {
  const original = botao?.innerHTML;
  if (botao) {
    botao.disabled = true;
    botao.innerHTML = `<span class="spin"></span>${escHtml(textoCarregando || 'Aguarde…')}`;
  }
  try {
    return await tarefa();
  } catch (e) {
    console.warn(e);
    toast(e?.message || 'Ocorreu um erro.', 'err', 6000);
    return undefined;
  } finally {
    if (botao && botao.isConnected) {
      botao.disabled = false;
      botao.innerHTML = original;
    }
  }
}

export function vazio(iconeNome, texto) {
  return `<div class="empty">${icone(iconeNome)}<div>${escHtml(texto)}</div></div>`;
}
