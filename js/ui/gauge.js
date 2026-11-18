/* Medidor circular em SVG (arco de 270°). */
import { escHtml } from '../util.js';

const R = 42;
const CIRC = 2 * Math.PI * R;
const ARCO = CIRC * 0.75; // 270°

export function criarMedidor({ id, nome, unidade, min = 0, max = 100 }) {
  const div = document.createElement('div');
  div.className = 'gauge';
  div.dataset.pid = id;
  div.innerHTML = `
    <div class="g-box">
    <svg viewBox="0 0 100 86" role="img" aria-label="${escHtml(nome)}">
      <circle cx="50" cy="50" r="${R}" fill="none" stroke="var(--line)" stroke-width="9"
        stroke-dasharray="${ARCO} ${CIRC}" transform="rotate(135 50 50)" stroke-linecap="round"/>
      <circle class="g-arc" cx="50" cy="50" r="${R}" fill="none" stroke="var(--accent)" stroke-width="9"
        stroke-dasharray="0 ${CIRC}" transform="rotate(135 50 50)" stroke-linecap="round"/>
      <text x="8" y="84" font-size="7" fill="var(--muted)">${escHtml(String(min))}</text>
      <text x="92" y="84" font-size="7" fill="var(--muted)" text-anchor="end">${escHtml(String(max))}</text>
    </svg>
    <div class="g-center"><div class="g-val">—</div><div class="g-unit">${escHtml(unidade || '')}</div></div>
    </div>
    <div class="g-name" title="${escHtml(nome)}">${escHtml(nome)}</div>`;
  const arco = div.querySelector('.g-arc');
  const val = div.querySelector('.g-val');
  return {
    el: div,
    atualizar(valor, texto, alarme = false) {
      val.textContent = texto ?? '—';
      if (typeof valor === 'number' && !Number.isNaN(valor)) {
        const f = Math.max(0, Math.min(1, (valor - min) / (max - min || 1)));
        arco.setAttribute('stroke-dasharray', `${(ARCO * f).toFixed(1)} ${CIRC}`);
        arco.setAttribute('stroke', alarme ? 'var(--bad)' : f > 0.85 ? 'var(--warn)' : 'var(--accent)');
      }
      div.classList.toggle('alarm', !!alarme);
    }
  };
}
