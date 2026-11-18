// Teste de ponta a ponta no modo demonstração (Playwright + Chromium).
// Uso: sirva a raiz do repositório (ex.: python3 -m http.server 8765) e rode:
//   node tools/test/e2e-demo.cjs http://127.0.0.1:8765/ [pasta-para-screenshots]
const { chromium } = require('playwright');

const URL_APP = process.argv[2] || 'http://127.0.0.1:8765/';
const SHOTS = process.argv[3] || null;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true, acceptDownloads: true });
  const page = await ctx.newPage();
  const erros = [];
  page.on('pageerror', (e) => erros.push('pageerror: ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') erros.push('console: ' + m.text()); });
  const passo = async (nome, fn) => {
    try { await fn(); console.log('  ✔', nome); } catch (e) { const m = e.message.split('\n').filter((l) => l.trim()).slice(0, 3).join(' | '); console.log('  ✘', nome, '-', m); erros.push(nome + ': ' + m); }
  };
  const shot = async (n) => { if (SHOTS) await page.screenshot({ path: `${SHOTS}/${n}.png` }); };

  await page.goto(URL_APP);
  await page.waitForSelector('#btnDemo');
  await shot('01-inicio');

  await passo('Conectar no modo demo', async () => {
    await page.click('#btnDemo');
    await page.waitForSelector('#btnLer', { timeout: 20000 });
    const txt = await page.textContent('#view');
    if (!/ELM327 v1\.5/.test(txt)) throw new Error('versão não exibida');
    if (!/15765/.test(txt)) throw new Error('protocolo não exibido');
    if (!/KNAFX411BE5000000/.test(txt)) throw new Error('VIN não exibido');
    if (!/ACESA/.test(txt)) throw new Error('MIL não exibida');
  });
  await shot('02-conectado');

  await passo('Ler erros e salvar com km', async () => {
    await page.click('#btnLer');
    await page.waitForSelector('#pergunta', { timeout: 20000 });
    await page.fill('#pergunta', '85432');
    await page.click('.modal .btn.primary');
    await page.waitForSelector('.dtc[data-codigo="P0301"]', { timeout: 10000 });
    const cods = await page.$$eval('.dtc', (els) => els.map((e) => e.dataset.codigo));
    for (const c of ['P0301', 'P0171', 'P0420', 'P0715']) if (!cods.includes(c)) throw new Error('faltou ' + c);
  });
  await shot('03-erros');

  await passo('Detalhe do código com freeze frame', async () => {
    await page.click('.dtc[data-codigo="P0301"]');
    await page.waitForSelector('.modal');
    const t = await page.textContent('.modal');
    if (!/Freeze frame/.test(t)) throw new Error('sem freeze frame');
    if (!/Causas comuns/.test(t)) throw new Error('sem causas');
    if (!/Problema conhecido/.test(t)) throw new Error('sem problema conhecido');
    await shot('04-detalhe');
    await page.click('.modal .actions .btn');
  });

  await passo('Abas pendentes e permanentes', async () => {
    await page.click('[data-aba="pendentes"]');
    await page.waitForSelector('.dtc[data-codigo="P0128"]');
    await page.click('[data-aba="permanentes"]');
    await page.waitForSelector('.dtc[data-codigo="P0420"]');
  });

  await passo('Módulos Kia: ler todos', async () => {
    await page.click('[data-aba="modulos"]');
    await page.click('#btnLerModulos');
    await page.waitForSelector('.dtc[data-codigo="C1201"]', { timeout: 30000 });
    await page.waitForSelector('.dtc[data-codigo="B1102"]', { timeout: 30000 });
    const bloqueado = await page.$eval('[data-apagar="abs"]', (b) => b.disabled);
    if (!bloqueado) throw new Error('apagar ABS deveria estar bloqueado');
  });
  await shot('05-modulos');

  await passo('Apagar com motor ligado é recusado', async () => {
    await page.click('[data-aba="armazenados"]');
    await page.click('#btnApagar');
    await page.waitForSelector('.modal .btn.danger');
    await page.click('.modal .btn.danger');
    await page.waitForSelector('.toast.err', { timeout: 10000 });
    const t = await page.textContent('.toast.err');
    if (!/motor/i.test(t)) throw new Error('mensagem inesperada: ' + t);
  });

  await passo('Ao vivo: medidores atualizam e gravação', async () => {
    await page.click('[data-tab="live"]');
    await page.click('#btnPlay');
    await page.waitForFunction(() => [...document.querySelectorAll('.g-val')].some((e) => /\d/.test(e.textContent)), null, { timeout: 15000 });
    await page.click('#btnRec');
    await page.waitForTimeout(3500);
    const rate = await page.textContent('#taxa');
    if (!/leituras\/s/.test(rate)) throw new Error('taxa não exibida');
    await shot('06-ao-vivo');
    await page.click('[data-vis="lista"]');
    await page.waitForTimeout(800);
    await page.click('[data-vis="grafico"]');
    await page.waitForTimeout(1500);
    await shot('07-grafico');
    await page.click('#btnRec');
    await page.waitForSelector('.modal', { timeout: 5000 });
    const [down] = await Promise.all([page.waitForEvent('download'), page.click('.modal .btn.primary')]);
    if (!/\.csv$/.test(down.suggestedFilename())) throw new Error('CSV não baixado');
    await page.click('#btnPlay');
  });

  await passo('Histórico: leitura e sessão', async () => {
    await page.click('[data-tab="history"]');
    await page.waitForSelector('.tl-item');
    const n = await page.$$eval('.tl-item', (e) => e.length);
    if (n < 2) throw new Error('itens: ' + n);
    const [down] = await Promise.all([page.waitForEvent('download'), page.click('#btnBackup')]);
    if (!/\.json$/.test(down.suggestedFilename())) throw new Error('backup não baixado');
    const [csv] = await Promise.all([page.waitForEvent('download'), page.click('#btnCsv')]);
    if (!/\.csv$/.test(csv.suggestedFilename())) throw new Error('CSV não baixado');
  });
  await shot('08-historico');

  await passo('Apagar códigos com motor desligado (demo) e comparação', async () => {
    await page.click('[data-tab="more"]');
    await page.click('[data-sub="demo"]');
    await page.click('#dMotor');
    await page.click('[data-tab="dtc"]');
    await page.click('[data-aba="armazenados"]');
    await page.click('#btnApagar');
    await page.click('.modal .btn.danger');
    await page.waitForSelector('.modal h2:text("Confirmação final")', { timeout: 10000 });
    await page.click('.modal .btn.danger');
    await page.waitForSelector('#pergunta', { timeout: 15000 });
    await page.click('.modal .btn.ghost');
    await page.waitForFunction(() => !document.querySelector('.dtc[data-codigo="P0301"]'), null, { timeout: 10000 });
    await page.click('[data-tab="history"]');
    await page.waitForSelector('.tl-item.clear');
    const t = await page.textContent('#tl');
    if (!/−P0301/.test(t)) throw new Error('comparação não mostra P0301 sumindo');
  });

  await passo('Relatório imprimível', async () => {
    const [popup] = await Promise.all([page.waitForEvent('popup'), page.click('#btnRelatorio')]);
    await popup.waitForLoadState();
    const t = await popup.textContent('body');
    if (!/Relatório de diagnóstico OBD2/.test(t)) throw new Error('relatório vazio');
    await popup.close();
  });

  await passo('Mais: prontidão, veículo, terminal, varredura, configurações, ajuda', async () => {
    await page.click('[data-tab="more"]');
    await page.click('[data-sub="prontidao"]');
    await page.click('#btnAt');
    await page.waitForSelector('.mon');
    await shot('09-prontidao');
    await page.goBack();
    await page.click('[data-sub="veiculo"]');
    await page.click('#btnLerInfo');
    await page.waitForFunction(() => /DEMO-CAL-GAMMA16/.test(document.querySelector('#view').textContent), null, { timeout: 15000 });
    await page.goBack();
    await page.click('[data-sub="terminal"]');
    await page.fill('#cmd', 'atrv');
    await page.press('#cmd', 'Enter');
    await page.waitForFunction(() => /\d+\.\dV/.test(document.querySelector('#log').textContent), null, { timeout: 5000 });
    await shot('10-terminal');
    await page.goBack();
    await page.click('[data-sub="varredura"]');
    await page.click('#btnRapida');
    await page.waitForFunction(() => /Módulos que responderam \((\d+)\)/.test(document.body.textContent) && !document.querySelector('#btnCancelar'), null, { timeout: 60000 });
    const txt = await page.textContent('#view');
    const n = Number((txt.match(/responderam \((\d+)\)/) || [])[1]);
    if (n !== 6) throw new Error('varredura achou ' + n);
    await shot('11-varredura');
    await page.goBack();
    await page.click('[data-sub="config"]');
    await page.click('#cfgClaro');
    await page.waitForTimeout(300);
    await shot('12-config-claro');
    await page.click('#cfgClaro');
    await page.goBack();
    await page.click('[data-sub="ajuda"]');
    await page.fill('#busca', 'P0420');
    await page.waitForSelector('#resBusca .dtc');
    await page.fill('#busca', 'bobina');
    await page.waitForSelector('#resBusca .dtc');
    await page.fill('#busca', 'P1999');
    await page.waitForSelector('#resBusca .dtc');
  });

  await passo('Persistência após recarregar', async () => {
    await page.reload();
    await page.click('[data-tab="history"]');
    await page.waitForSelector('.tl-item');
  });

  await passo('Offline após primeira carga (service worker)', async () => {
    await page.evaluate(() => navigator.serviceWorker.ready);
    await page.waitForTimeout(1500);
    await ctx.setOffline(true);
    await page.evaluate(() => { location.hash = '#home'; });
    await page.reload();
    await page.waitForSelector('#btnDemo', { timeout: 10000 });
    await page.click('#btnDemo');
    await page.waitForSelector('#btnLer', { timeout: 20000 });
    await ctx.setOffline(false);
  });

  await browser.close();
  const reais = erros.filter((e) => !/favicon/.test(e));
  console.log(reais.length ? `\nFALHAS/ERROS (${reais.length}):\n` + reais.join('\n') : '\nTudo certo, nenhum erro no console.');
  process.exit(reais.length ? 1 : 0);
})();
