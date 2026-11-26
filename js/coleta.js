/* Coletas para relatórios:
 *  - coletarCompleto(): tudo o que o app sabe ler do carro (VIN, calibração, status, monitores,
 *    códigos 03/07/0A, freeze frame, todos os PIDs suportados com valor atual e módulos Kia).
 *  - coletarTecnico(): respostas BRUTAS do adaptador e das centrais, para descobrir o que mais
 *    o carro suporta e melhorar o app (PIDs, modo 06, modo 09, identificação dos módulos).
 * Só são enviados comandos de LEITURA. Nada é apagado ou gravado no carro. */
import { estado, exigirConexao, notificar } from './app.js';
import { config } from './settings.js';
import { salvarLeitura } from './storage.js';
import { parsearMensagens } from './elm327.js';
import { horaMs } from './util.js';

export const VERSAO_APP = '1.4.0';
const hex2 = (n) => n.toString(16).toUpperCase().padStart(2, '0');

async function tentar(fn, padrao = null) {
  try { return await fn(); } catch (e) { console.warn(e); return padrao; }
}

// ===================================================================== completo
export async function coletarCompleto(progresso = () => {}) {
  exigirConexao();
  const { obd, kia, tabela } = estado;
  const r = {
    tipo: 'leitura',
    completo: true,
    data: new Date().toISOString(),
    km: config.ultimoKm ? Number(config.ultimoKm) : null,
    demo: estado.demo,
    protocolo: estado.info.protocolo,
    elm: estado.info.versao,
    info: { ...estado.info },
    veiculo: { motor: config.motor, cambio: config.cambio },
    transporte: estado.transporte?.nome || ''
  };

  progresso('Identificação: VIN, calibração e CVN…', 5);
  r.vin = (await tentar(() => obd.lerVin())) || estado.vin;
  if (r.vin) estado.vin = r.vin;
  r.calid = await tentar(() => obd.lerCalibracao(), []);
  r.cvn = await tentar(() => obd.lerCvn(), []);

  r.nomesEcu = await tentar(() => obd.lerNomesEcu(), []);

  progresso('Luz de injeção e monitores de prontidão…', 15);
  const st = await tentar(() => obd.lerStatus());
  if (st) estado.status = st;
  r.status = st ? {
    mil: st.mil, qtdDtc: st.qtdDtc, incompletos: st.incompletos,
    monitores: st.monitores.map(({ id, nome, explicacao, tipo, suportado, completo }) => ({ id, nome, explicacao, tipo, suportado, completo })),
    porEcu: st.porEcu.map((e) => ({ ecu: e.ecu, mil: e.mil, qtdDtc: e.qtdDtc }))
  } : null;

  progresso('Códigos armazenados, pendentes e permanentes…', 25);
  const armazenados = await tentar(() => obd.lerDtcs('03'), []);
  const pendentes = await tentar(() => obd.lerDtcs('07'), []);
  const permanentes = await tentar(() => obd.lerDtcs('0A'), []);

  progresso('Freeze frame…', 35);
  r.freeze = await tentar(() => obd.lerFreezeFrame());

  progresso('PIDs suportados…', 45);
  if (!obd.suportadosUniao.size) await tentar(() => obd.descobrirPids());
  r.pidsSuportados = Object.fromEntries([...obd.suportados].map(([ecu, set]) => [ecu, [...set].sort()]));

  progresso('Valores atuais de todos os sensores suportados…', 55);
  const lista = tabela.todos.filter((p) => p.listavel !== false && obd.suporta(p.pid)).map((p) => p.pid);
  const valores = await tentar(() => obd.lerPids(lista), new Map());
  r.valores = [...valores].map(([pid, v]) => {
    const d = tabela.get(pid);
    return { pid, nome: d?.nome || pid, grupo: d?.grupo || 'Outros', unidade: d?.unidade || '', texto: v.texto, valor: typeof v.valor === 'number' ? v.valor : null, extra: v.extra?.texto ? `${v.extra.nome}: ${v.extra.texto}` : '', ecu: v.ecu };
  });

  progresso('Testes internos dos monitores (modo 06)…', 60);
  r.modo06 = estado.tab06 ? await tentar(() => obd.lerModo06(estado.tab06), []) : [];

  const modulos = [];
  for (let i = 0; i < config.modulos.length; i++) {
    const m = config.modulos[i];
    progresso(`Módulo ${m.nome} (${m.tx})…`, 65 + Math.round((i / config.modulos.length) * 30));
    let item;
    try {
      const res = await kia.lerModulo(m);
      item = { modulo: { ...m }, protocolo: res.protocolo, dtcs: res.dtcs, log: res.log };
    } catch (e) {
      item = { modulo: { ...m }, erro: e.message, dtcs: [] };
    }
    item.identificacao = await tentar(() => kia.identificarModulo(m), []);
    modulos.push(item);
  }
  r.dtcs = { armazenados, pendentes, permanentes, modulos };

  progresso('Salvando no histórico…', 98);
  r.id = await salvarLeitura(r);
  estado.ultimaLeitura = r;
  notificar();
  progresso('Pronto.', 100);
  return r;
}

// ===================================================================== técnico
const DIDS_UDS = ['F187', 'F18A', 'F18C', 'F190', 'F191', 'F193', 'F195', 'F197'];
const ID_KWP = ['1A80', '1A87', '1A90'];
const LOCAIS_KWP = ['2101', '2102', '2103', '2104', '2105', '2106', '2107', '2108'];

/** Lê a máscara de "suportados" (bases 00, 20, 40...) de um modo e devolve os IDs. */
async function mascaraSuportados(modo, cmd, sufixo = '') {
  const ids = [];
  for (let base = 0; base <= 0xe0; base += 0x20) {
    const r = await cmd(modo + hex2(base) + sufixo);
    const msgs = parsearMensagens(r.linhas, estado.info.protocoloNum ?? 6);
    const resp = msgs.filter((m) => m.dados[0] === parseInt(modo, 16) + 0x40 && m.dados[1] === base);
    if (!resp.length) break;
    let continua = false;
    for (const m of resp) {
      const mask = m.dados.slice(2, 6);
      for (let i = 0; i < 32; i++) {
        if (mask[i >> 3] & (0x80 >> (i & 7))) {
          const id = hex2(base + i + 1);
          if (!ids.includes(id)) ids.push(id);
          if (base + i + 1 === base + 0x20) continua = true;
        }
      }
    }
    if (!continua) break;
  }
  return ids.filter((x) => parseInt(x, 16) % 0x20 !== 0);
}

/**
 * opcoes.profundo = true: além do básico, procura blocos de dados que o carro tenha:
 *  - módulos KWP2000: 10 81 e todos os identificadores locais 21 00–FF;
 *  - módulos UDS (exceto airbag): identificadores 22 B000–B0FF e F100–F1FF;
 *  - variantes de leitura de códigos (UDS 19 e KWP 18). Tudo somente leitura.
 */
export async function coletarTecnico(progresso = () => {}, opcoes = {}) {
  exigirConexao();
  const { elm } = estado;
  const registros = [];
  let grupo = '';
  let alvo = { tx: '7DF' };
  const cmd = async (c, timeout = 3000) => {
    const t0 = performance.now();
    const r = await elm.comando(c, { tentativas: 0, timeout, alvo });
    registros.push({ grupo, cmd: c, resposta: r.linhas, erro: r.erro?.codigo || null, ms: Math.round(performance.now() - t0) });
    return r;
  };

  await elm.restaurarPadrao();
  grupo = 'adaptador';
  progresso('Adaptador (ATI, AT@1, ATDP, ATRV)…', 3);
  for (const c of ['ATI', 'AT@1', 'AT@2', 'ATDP', 'ATDPN', 'ATRV', 'ATCS']) await cmd(c);

  grupo = 'modo01';
  progresso('Modo 01: PIDs suportados e valores brutos…', 10);
  const pids01 = await mascaraSuportados('01', cmd);
  for (let i = 0; i < pids01.length; i++) {
    if (i % 5 === 0) progresso(`Modo 01: PID ${pids01[i]} (${i + 1}/${pids01.length})…`, 10 + Math.round((i / pids01.length) * 25));
    await cmd('01' + pids01[i]);
  }

  grupo = 'modo06';
  progresso('Modo 06: resultados dos testes dos monitores…', 38);
  const mids = await mascaraSuportados('06', cmd);
  for (const mid of mids) await cmd('06' + mid);

  grupo = 'modo09';
  progresso('Modo 09: informações do veículo…', 50);
  const infos09 = await mascaraSuportados('09', cmd);
  for (const id of infos09) await cmd('09' + id, 5000);

  grupo = 'modo02';
  await cmd('020200');

  // módulos: tabela configurada + o que a varredura encontrou
  const alvos = new Map();
  config.modulos.forEach((m) => alvos.set(m.tx.toUpperCase(), { tx: m.tx.toUpperCase(), rx: m.rx.toUpperCase(), nome: m.nome }));
  (window.__ultimaVarredura || []).forEach((a) => { if (!alvos.has(a.tx)) alvos.set(a.tx, { tx: a.tx, rx: a.rx, nome: 'Encontrado na varredura' }); });
  const lista = [...alvos.values()];
  try {
    for (let i = 0; i < lista.length; i++) {
      const a = lista[i];
      grupo = `modulo ${a.tx}->${a.rx} (${a.nome})`;
      progresso(`Módulo ${a.nome} ${a.tx}: identificação e dados…`, 55 + Math.round((i / lista.length) * 40));
      alvo = { tx: a.tx, rx: a.rx };
      const sessao = await cmd('1001');
      if (!sessao.linhas.length || sessao.erro === 'NO_DATA') {
        await cmd('3E00');
        if (!registros[registros.length - 1].resposta.length) continue; // módulo não responde: pula
      }
      for (const d of DIDS_UDS) await cmd('22' + d);
      for (const c of ID_KWP) await cmd(c);
      for (const c of LOCAIS_KWP) await cmd(c);
      await cmd('1902FF', 4000);
      await cmd('1802FF00', 4000);
      if (!opcoes.profundo) continue;

      const base = 55 + Math.round((i / lista.length) * 40);
      const resp = (c) => registros.filter((r) => r.grupo === grupo && r.cmd === c).pop();
      const positivo = (c, sid) => { const r = resp(c); return r && r.resposta.some((l) => l.replace(/\s/g, '').toUpperCase().slice(3).match(new RegExp('^(0[0-9A-F]|1[0-9A-F]{3})' + sid))); };
      const nrc = (c) => { const r = resp(c); const l = r?.resposta?.[0]?.replace(/\s/g, '').toUpperCase() || ''; const m = l.slice(3).match(/^037F([0-9A-F]{2})([0-9A-F]{2})/); return m ? m[2] : null; };
      // variantes de leitura de códigos
      for (const c of ['190209', '190208', '19020D', '1901FF', '1800FF00', '18020000', '18000000', '1300', '17FF00']) await cmd(c, 4000);
      // KWP2000: sessão 10 81 e varredura de identificadores locais
      const ehKwp = nrc('1001') === '12' || positivo('1A80', '5A') || positivo('2101', '61') || ['12', '31'].includes(nrc('2101'));
      if (ehKwp) {
        await cmd('1081');
        for (let id = 0; id <= 0xff; id++) {
          if (id % 16 === 0) progresso(`Módulo ${a.nome}: blocos 21 ${hex2(id)}…`, base);
          await cmd('21' + hex2(id), 1500);
        }
      }
      // UDS: identificadores mais usados pela Hyundai/Kia (não aplica ao airbag)
      const ehUds = (positivo('22F187', '62') || positivo('22F193', '62')) && a.tx !== '7D2';
      if (ehUds) {
        for (const faixa of [0xb000, 0xf100]) {
          for (let did = faixa; did <= faixa + 0xff; did++) {
            if (did % 32 === 0) progresso(`Módulo ${a.nome}: identificadores 22 ${did.toString(16).toUpperCase()}…`, base);
            await cmd('22' + did.toString(16).toUpperCase().padStart(4, '0'), 1200);
          }
        }
      }
    }
  } finally {
    alvo = { tx: '7DF' };
    await elm.restaurarPadrao();
  }

  progresso('Montando o arquivo…', 98);
  const rel = {
    app: 'cerato-obd',
    tipo: 'relatorio-tecnico',
    profundo: !!opcoes.profundo,
    versao_app: VERSAO_APP,
    data: new Date().toISOString(),
    navegador: navigator.userAgent,
    transporte: estado.transporte?.nome || '',
    demo: estado.demo,
    config: { motor: config.motor, cambio: config.cambio, compat: config.compat, timeout: config.timeout, tentativas: config.tentativas, protocoloPreferido: config.protocoloPreferido, modulos: config.modulos },
    adaptador: { ...estado.info },
    vin: estado.vin,
    resumo: {
      pids_modo01: pids01,
      mids_modo06: mids,
      infos_modo09: infos09,
      modulos_testados: lista.map((a) => a.tx),
      modulos_que_responderam: [...new Set(registros.filter((r) => r.grupo.startsWith('modulo') && r.resposta.length && !r.erro).map((r) => r.grupo.split(' ')[1]))],
      total_comandos: registros.length
    },
    varredura: window.__ultimaVarredura || null,
    comandos: registros,
    log: estado.log.slice(-1500).map((l) => `${horaMs(l.ts)} ${l.dir.toUpperCase()} ${l.texto}`)
  };
  progresso('Pronto.', 100);
  return rel;
}

// ===================================================================== correlação
/**
 * Grava, em ciclo, PIDs OBD conhecidos (rotação, velocidade, temperaturas...) junto com
 * todos os blocos de dados dos módulos. Cruzando as duas séries dá para descobrir o que
 * cada byte dos blocos significa. Somente leitura.
 */
export async function coletarCorrelacao(progresso = () => {}, { minutos = 3, deveParar = () => false } = {}) {
  exigirConexao();
  const { elm, obd } = estado;
  const { BLOCOS_CONHECIDOS } = await import('./kia.js');
  const pidsObd = ['0C', '0D', '05', '0F', '11', '04', '0B', '0E', '42', '2F', '46', '14', '15'].filter((p) => obd.suporta(p));
  const hexs = (b) => b.map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join('');
  // módulos KWP2000 aceitam a sessão 10 81 (não é obrigatória, mas mantém o módulo atento)
  for (const b of BLOCOS_CONHECIDOS) {
    if (b.cmds[0].startsWith('21')) await elm.comando('1081', { alvo: { tx: b.tx, rx: b.rx }, tentativas: 0, timeout: 1500 });
  }
  const inicio = Date.now();
  const fim = inicio + minutos * 60000;
  const amostras = [];
  // mantém a tela ligada: com a tela apagada o Chrome pausa o Bluetooth
  let trava = null;
  try { trava = await navigator.wakeLock?.request('screen'); } catch { /* sem wake lock */ }
  try {
    while (Date.now() < fim && !deveParar()) {
      const a = { t: Date.now() - inicio, obd: {}, blocos: {} };
      const r = await tentar(() => obd.lerPids(pidsObd), new Map());
      r.forEach((v, pid) => { if (typeof v.valor === 'number') a.obd[pid] = Math.round(v.valor * 1000) / 1000; });
      for (const b of BLOCOS_CONHECIDOS) {
        for (const c of b.cmds) {
          if (deveParar()) break;
          const resp = await elm.pedir(c, { alvo: { tx: b.tx, rx: b.rx }, tentativas: 0, timeout: 1500 });
          const m = resp.msgs.find((x) => x.dados[0] !== 0x7f);
          a.blocos[`${b.tx}:${c}`] = m ? hexs(m.dados) : null;
        }
      }
      amostras.push(a);
      const seg = Math.round((Date.now() - inicio) / 1000);
      progresso(`Gravando: amostra ${amostras.length} · ${seg} s de ${minutos * 60} s`, Math.min(99, Math.round((seg / (minutos * 60)) * 100)));
    }
  } finally {
    try { await trava?.release(); } catch { /* ignora */ }
    await elm.restaurarPadrao();
  }
  return {
    app: 'cerato-obd',
    tipo: 'gravacao-correlacao',
    versao_app: VERSAO_APP,
    data: new Date(inicio).toISOString(),
    vin: estado.vin,
    minutos,
    pidsObd,
    blocos: BLOCOS_CONHECIDOS,
    amostras
  };
}

// ===================================================================== gravação guiada
/** Abre a sessão 10 81 nos módulos KWP2000 da gravação guiada. */
export async function prepararGuiada(cfg) {
  exigirConexao();
  for (const b of cfg.blocos) {
    if (b.cmds[0].startsWith('21')) await estado.elm.comando('1081', { alvo: { tx: b.tx, rx: b.rx }, tentativas: 0, timeout: 1500 });
  }
}

/**
 * Grava uma etapa: repete a leitura dos blocos por `segundos`, marcando cada amostra com a etapa.
 * onAmostra(n, restanteMs) é chamado a cada ciclo. Somente leitura.
 */
export async function gravarEtapa(cfg, etapa, segundos, { onAmostra = () => {}, deveParar = () => false, inicioSessao = Date.now() } = {}) {
  exigirConexao();
  const { elm, obd } = estado;
  const hexs = (b) => b.map((x) => x.toString(16).toUpperCase().padStart(2, '0')).join('');
  const pidsObd = ['0C', '0D', '05', '11', '42'].filter((p) => obd.suporta(p));
  const fim = Date.now() + segundos * 1000;
  const amostras = [];
  while (Date.now() < fim && !deveParar()) {
    const a = { t: Date.now() - inicioSessao, etapa: etapa.id, obd: {}, blocos: {} };
    const r = await tentar(() => obd.lerPids(pidsObd), new Map());
    r.forEach((v, pid) => { if (typeof v.valor === 'number') a.obd[pid] = Math.round(v.valor * 1000) / 1000; });
    for (const b of cfg.blocos) {
      for (const c of b.cmds) {
        if (deveParar()) break;
        const resp = await elm.pedir(c, { alvo: { tx: b.tx, rx: b.rx }, tentativas: 0, timeout: 1500 });
        const m = resp.msgs.find((x) => x.dados[0] !== 0x7f);
        a.blocos[`${b.tx}:${c}`] = m ? hexs(m.dados) : null;
      }
    }
    amostras.push(a);
    onAmostra(amostras.length, Math.max(0, fim - Date.now()));
  }
  return amostras;
}

export function montarArquivoGuiado(cfg, etapasFeitas, amostras, inicio) {
  return {
    app: 'cerato-obd',
    tipo: 'gravacao-guiada',
    versao_app: VERSAO_APP,
    data: new Date(inicio).toISOString(),
    vin: estado.vin,
    blocos: cfg.blocos,
    etapas: etapasFeitas,
    amostras
  };
}
