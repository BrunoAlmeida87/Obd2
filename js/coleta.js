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

export const VERSAO_APP = '1.1.0';
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

  const modulos = [];
  for (let i = 0; i < config.modulos.length; i++) {
    const m = config.modulos[i];
    progresso(`Módulo ${m.nome} (${m.tx})…`, 65 + Math.round((i / config.modulos.length) * 30));
    try {
      const res = await kia.lerModulo(m);
      modulos.push({ modulo: { ...m }, protocolo: res.protocolo, dtcs: res.dtcs, log: res.log });
    } catch (e) {
      modulos.push({ modulo: { ...m }, erro: e.message, dtcs: [] });
    }
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

export async function coletarTecnico(progresso = () => {}) {
  exigirConexao();
  const { elm } = estado;
  const registros = [];
  let grupo = '';
  const cmd = async (c, timeout = 3000) => {
    const t0 = performance.now();
    const r = await elm.comando(c, { tentativas: 0, timeout });
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
      await elm.definirAlvo(a.tx, a.rx);
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
    }
  } finally {
    await elm.restaurarPadrao();
  }

  progresso('Montando o arquivo…', 98);
  const rel = {
    app: 'cerato-obd',
    tipo: 'relatorio-tecnico',
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
