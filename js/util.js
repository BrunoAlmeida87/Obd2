/* Utilidades gerais: datas, arquivos, CSV. */

export const espera = (ms) => new Promise((r) => setTimeout(r, ms));

export function dataHora(iso) {
  const d = iso instanceof Date ? iso : new Date(iso);
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function horaMs(d = new Date()) {
  return d.toLocaleTimeString('pt-BR', { hour12: false }) + '.' + String(d.getMilliseconds()).padStart(3, '0');
}

export function duracao(ms) {
  const s = Math.round(ms / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  if (h) return `${h} h ${m % 60} min`;
  if (m) return `${m} min ${s % 60} s`;
  return `${s} s`;
}

/** Faz o navegador baixar um arquivo gerado no app. */
export function baixarArquivo(nome, conteudo, tipo = 'text/plain;charset=utf-8') {
  const blob = conteudo instanceof Blob ? conteudo : new Blob([conteudo], { type: tipo });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = nome;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

/** Lê um arquivo escolhido pelo usuário como texto. */
export function escolherArquivo(accept = '.json') {
  return new Promise((resolve, reject) => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = accept;
    input.onchange = () => {
      const f = input.files?.[0];
      if (!f) return reject(new Error('Nenhum arquivo escolhido.'));
      const leitor = new FileReader();
      leitor.onload = () => resolve({ nome: f.name, texto: String(leitor.result) });
      leitor.onerror = () => reject(new Error('Não foi possível ler o arquivo.'));
      leitor.readAsText(f);
    };
    input.click();
  });
}

/** Monta CSV com ';' (padrão do Excel em pt-BR) e BOM UTF-8. */
export function gerarCsv(linhas) {
  const esc = (v) => {
    if (v === null || v === undefined) return '';
    let s = typeof v === 'number' ? String(v).replace('.', ',') : String(v);
    if (/[";\n\r]/.test(s)) s = '"' + s.replace(/"/g, '""') + '"';
    return s;
  };
  return '﻿' + linhas.map((l) => l.map(esc).join(';')).join('\r\n');
}

export function carimbo() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}`;
}

export function escHtml(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export async function copiarTexto(texto) {
  try {
    await navigator.clipboard.writeText(texto);
    return true;
  } catch {
    const ta = document.createElement('textarea');
    ta.value = texto;
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    return ok;
  }
}
