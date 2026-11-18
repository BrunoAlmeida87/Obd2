/* Gráfico temporal em canvas (sem bibliotecas externas).
 * Cada série é normalizada pela sua própria faixa (min/max da tabela de PIDs),
 * assim várias grandezas cabem no mesmo gráfico. */
export const CORES = ['#36b3ff', '#ffc23d', '#2fd27a', '#ff6b6b', '#c38bff', '#ff9f43', '#4dd9d9', '#f78fb3'];

export class GraficoTempo {
  constructor(canvas, janelaSeg = 60) {
    this.c = canvas;
    this.ctx = canvas.getContext('2d');
    this.janela = janelaSeg * 1000;
    this.series = new Map(); // pid -> { nome, cor, min, max, pontos: [[t, v]] }
    this._raf = null;
  }

  definirSeries(defs) {
    const antigas = this.series;
    this.series = new Map();
    defs.forEach((d, i) => {
      this.series.set(d.pid, { ...d, cor: CORES[i % CORES.length], pontos: antigas.get(d.pid)?.pontos || [] });
    });
  }

  adicionar(pid, valor, t = Date.now()) {
    const s = this.series.get(pid);
    if (!s || typeof valor !== 'number' || Number.isNaN(valor)) return;
    s.pontos.push([t, valor]);
    const limite = t - this.janela - 2000;
    while (s.pontos.length && s.pontos[0][0] < limite) s.pontos.shift();
    this._agendar();
  }

  limpar() { this.series.forEach((s) => { s.pontos = []; }); this._agendar(); }

  _agendar() {
    if (this._raf) return;
    this._raf = requestAnimationFrame(() => { this._raf = null; this.desenhar(); });
  }

  desenhar() {
    const c = this.c;
    const dpr = window.devicePixelRatio || 1;
    const w = c.clientWidth;
    const h = c.clientHeight;
    if (!w || !h) return;
    if (c.width !== Math.round(w * dpr) || c.height !== Math.round(h * dpr)) {
      c.width = Math.round(w * dpr);
      c.height = Math.round(h * dpr);
    }
    const ctx = this.ctx;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    const css = getComputedStyle(document.documentElement);
    const linha = css.getPropertyValue('--line').trim() || '#333';
    const muted = css.getPropertyValue('--muted').trim() || '#888';
    const pad = { l: 8, r: 8, t: 8, b: 18 };
    const pw = w - pad.l - pad.r;
    const ph = h - pad.t - pad.b;

    // grade
    ctx.strokeStyle = linha;
    ctx.lineWidth = 1;
    ctx.beginPath();
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (ph * i) / 4;
      ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + pw, y);
    }
    ctx.stroke();
    ctx.fillStyle = muted;
    ctx.font = '11px system-ui, sans-serif';
    const agora = Date.now();
    for (let s = 0; s <= this.janela / 1000; s += 15) {
      const x = pad.l + pw - (s * 1000 / this.janela) * pw;
      ctx.textAlign = s === 0 ? 'right' : s * 1000 >= this.janela ? 'left' : 'center';
      ctx.fillText(s === 0 ? 'agora' : `-${s}s`, x, h - 4);
    }
    ctx.textAlign = 'left';

    // séries
    for (const s of this.series.values()) {
      if (s.pontos.length < 2) continue;
      ctx.strokeStyle = s.cor;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      let primeiro = true;
      for (const [t, v] of s.pontos) {
        const x = pad.l + pw - ((agora - t) / this.janela) * pw;
        if (x < pad.l - 2) continue;
        const f = Math.max(0, Math.min(1, (v - s.min) / ((s.max - s.min) || 1)));
        const y = pad.t + ph - f * ph;
        if (primeiro) { ctx.moveTo(x, y); primeiro = false; } else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
  }
}
