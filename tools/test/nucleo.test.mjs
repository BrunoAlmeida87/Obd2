// Testes do núcleo (sem navegador): simulador -> ELM327 -> ISO-TP -> OBD -> módulos Kia.
// Uso: node tools/test/nucleo.test.mjs
import { readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { SimulatorTransport } from '../../js/transport/simulator.js';
import { Elm327, parsearMensagens } from '../../js/elm327.js';
import { Obd, TabelaPids, decodificarDtc, decodificarModo06 } from '../../js/obd.js';
import { Kia, MODULOS_PADRAO, textoAscii } from '../../js/kia.js';

const raiz = new URL('../../', import.meta.url);
const tabela = new TabelaPids(JSON.parse(readFileSync(new URL('data/pids.json', raiz))));
const db = JSON.parse(readFileSync(new URL('data/dtc-db.json', raiz)));
const tab06 = JSON.parse(readFileSync(new URL('data/modo06.json', raiz)));
let ok = 0;
const teste = async (nome, fn) => {
  try { await fn(); ok++; console.log('  ✔', nome); } catch (e) { console.error('  ✘', nome, '\n', e); process.exitCode = 1; }
};

console.log('Decodificação');
await teste('DTC P0301 / C1201 / B1346 / U0100', () => {
  assert.equal(decodificarDtc(0x03, 0x01), 'P0301');
  assert.equal(decodificarDtc(0x52, 0x01), 'C1201');
  assert.equal(decodificarDtc(0x93, 0x46), 'B1346');
  assert.equal(decodificarDtc(0xc1, 0x00), 'U0100');
  assert.equal(decodificarDtc(0x21, 0x35), 'P2135');
});
await teste('ISO-TP multi-frame de duas ECUs com cabeçalhos', () => {
  const linhas = ['7E8100A43040301017104', '7E9044301071555555555', '7E82120002200AAAAAAAA'];
  const msgs = parsearMensagens(linhas, 6);
  const m8 = msgs.find((m) => m.ecu === '7E8');
  const m9 = msgs.find((m) => m.ecu === '7E9');
  assert.deepEqual(m8.dados, [0x43, 0x04, 0x03, 0x01, 0x01, 0x71, 0x04, 0x20, 0x00, 0x22]);
  assert.deepEqual(m9.dados, [0x43, 0x01, 0x07, 0x15]);
});
await teste('Formato sem cabeçalho (014 / 0: / 1:)', () => {
  const msgs = parsearMensagens(['014', '0: 49 02 01 4B 4E 41', '1: 46 58 34 31 31 42 45', '2: 35 30 30 30 30 30 30'], 6);
  assert.equal(msgs.length, 1);
  assert.equal(msgs[0].dados.length, 20);
  assert.equal(msgs[0].dados[0], 0x49);
});
await teste('K-line com cabeçalho e checksum', () => {
  const msgs = parsearMensagens(['48 6B 10 43 01 33 00 00 00 00 E4'], 3);
  assert.equal(msgs[0].ecu, '10');
  assert.deepEqual(msgs[0].dados, [0x43, 0x01, 0x33, 0x00, 0x00, 0x00, 0x00]);
});
console.log('\nRespostas reais do Cerato 2014 (relatório técnico)');
await teste('Modo 06 real: catalisador aprovado perto do limite', () => {
  const [m] = parsearMensagens(['7E8100A462180053680', '7E82100004000000000'], 6);
  const [t] = decodificarModo06(m.dados, tab06);
  assert.equal(t.monitor, 'Catalisador banco 1');
  assert.ok(Math.abs(t.valor - 0.4255) < 0.001 && Math.abs(t.max - 0.4997) < 0.001);
  assert.equal(t.passou, true);
  assert.equal(t.pertoDoLimite, true);
});
await teste('Modo 06 real: sonda B1S1 (7 testes) e VVT com sinal', () => {
  const [m] = parsearMensagens(['7E810404601010A0E67', '7E8210E670E6701020A', '7E8220E670E670E6701', '7E823070A000000000E', '7E8246701080A1DED0E', '7E8256724CF01091100', '7E826020000000A010A', '7E827100000000006D6', '7E8280189850200FC68', '7E82903980000000000'], 6);
  const ts = decodificarModo06(m.dados, tab06);
  assert.equal(ts.length, 7);
  assert.ok(ts.every((t) => t.passou));
  assert.ok(Math.abs(ts.find((t) => t.tid === '08').valor - 934.6) < 0.5); // tensão máxima em mV
  const [v] = parsearMensagens(['7E8101346358A9DFFEF', '7E821FFDE0006358B9D', '7E822FFEFFFDE000600'], 6);
  const vvt = decodificarModo06(v.dados, tab06);
  assert.equal(vvt[0].valor, -8.5);
  assert.equal(vvt[0].min, -17);
});
await teste('Identificação real dos módulos (ABS, BCM, ECM)', () => {
  const [abs] = parsearMensagens(['7D9101D5A8059442041', '7D921425320FF203131', '7D92220120705203538', '7D9233932302D413731', '7D92430300000000000'], 6);
  assert.ok(textoAscii(abs.dados.slice(2)).includes('58920-A7100'));
  const [bcm] = parsearMensagens(['7A8100D62F187393534', '7A82130304137313430'], 6);
  assert.deepEqual(textoAscii(bcm.dados.slice(3)), ['95400A7140']);
  const [vin] = parsearMensagens(['7E810144902014B4E41', '7E821465A3431344245', '7E82235303631373638'], 6);
  assert.equal(String.fromCharCode(...vin.dados.slice(3)), 'KNAFZ414BE5061768');
});
await teste('PID 56 de 1 byte (como o Cerato responde)', () => {
  const r = new Map();
  new Obd({ ehCan: true }, tabela)._decodificarMulti([0x56, 0xc8], '7E8', r);
  assert.ok(Math.abs(r.get('56').valor - 56.25) < 0.01);
});

await teste('Banco de códigos: estrutura e cobertura', () => {
  const m = new Map(db.codigos.map((c) => [c.codigo, c]));
  for (const c of ['P0301', 'P0011', 'P0016', 'P0128', 'P0420', 'P0441', 'P0455', 'P0456', 'P2135', 'P2101', 'P0715', 'P0720', 'P0741', 'P0750', 'P0770', 'P0325', 'P0326', 'P0171', 'P0172']) {
    assert.ok(m.get(c), 'faltou ' + c);
    assert.ok(m.get(c).notas_cerato, 'sem nota Cerato ' + c);
  }
  const p0 = db.codigos.filter((c) => /^P0\d{3}$/.test(c.codigo)).length;
  assert.ok(p0 >= 990, 'P0 incompleto: ' + p0);
  for (const c of db.codigos) {
    for (const k of ['codigo', 'sistema', 'descricao', 'severidade', 'pode_rodar', 'causas_comuns', 'verificacoes', 'notas_cerato', 'fabricante', 'confianca']) assert.ok(k in c, c.codigo + ' sem ' + k);
  }
});

for (const ruidoso of [false, true]) {
  console.log(`\nFluxo completo no simulador${ruidoso ? ' (clone ruidoso)' : ''}`);
  const sim = new SimulatorTransport({ cloneRuidoso: ruidoso });
  await sim.open();
  const log = [];
  const elm = new Elm327(sim, { timeout: 3000, compat: ruidoso });
  elm.on('log', (l) => log.push(l));
  const obd = new Obd(elm, tabela);
  const kia = new Kia(elm, () => ({ permitirApagarCriticos: false, compat: ruidoso }));

  await teste('Inicialização: versão, protocolo e tensão', async () => {
    const info = await elm.inicializar(() => {}, { protocolo: 6 });
    assert.match(info.versao, /ELM327/);
    assert.equal(info.protocoloNum, 6);
    assert.match(info.protocolo, /15765/);
    assert.ok(info.tensao > 11 && info.tensao < 15);
    const txs = log.filter((l) => l.dir === 'tx').map((l) => l.texto);
    for (const c of ['ATZ', 'ATE0', 'ATL0', 'ATS0', 'ATH1', 'ATAT1', 'ATI', 'AT@1', 'ATRV', 'ATSP6', 'ATDP']) assert.ok(txs.includes(c), 'não enviou ' + c);
    assert.ok(!txs.includes('ATAT2'));
  });
  await teste('Descoberta de PIDs (00/20/40)', async () => {
    const s = await obd.descobrirPids();
    for (const p of ['0C', '0D', '05', '52', '2F', '3C', '31']) assert.ok(s.has(p), 'sem ' + p);
    assert.ok(!s.has('5C'));
  });
  await teste('Status: MIL, DTCs e monitores', async () => {
    const st = await obd.lerStatus();
    assert.equal(st.mil, true);
    assert.equal(st.qtdDtc, 4);
    assert.ok(st.monitores.find((m) => m.id === 'evap' && m.suportado && !m.completo));
    assert.ok(st.monitores.find((m) => m.id === 'cat' && m.completo));
  });
  await teste('Modo 03 multi-frame de duas ECUs', async () => {
    const d = await obd.lerDtcs('03');
    assert.deepEqual(d.map((x) => x.codigo + '@' + x.ecu).sort(), ['P0171@7E8', 'P0301@7E8', 'P0420@7E8', 'P0715@7E9']);
  });
  await teste('Modos 07 e 0A', async () => {
    assert.deepEqual((await obd.lerDtcs('07')).map((x) => x.codigo), ['P0128']);
    assert.deepEqual((await obd.lerDtcs('0A')).map((x) => x.codigo), ['P0420']);
  });
  await teste('Freeze frame (modo 02)', async () => {
    const f = await obd.lerFreezeFrame();
    assert.equal(f.dtc, 'P0301');
    const rpm = f.valores.find((v) => v.pid === '0C');
    assert.equal(rpm.valor, 0x1a90 / 4);
  });
  await teste('Modo 09: VIN, CALID, CVN', async () => {
    assert.equal(await obd.lerVin(), 'KNAFX411BE5000000');
    assert.equal((await obd.lerCalibracao())[0].calid, 'DEMO-CAL-GAMMA16');
    assert.equal((await obd.lerCvn())[0].cvn, '3A5C910E');
  });
  await teste('Leitura multi-PID ao vivo', async () => {
    const r = await obd.lerPids(['0C', '0D', '05', '0F', '0B', '11', '04', '0E', '14', '52', 'RV']);
    assert.ok(r.get('0C').valor >= 600);
    assert.ok(r.has('14') && r.get('14').extra);
    assert.ok(r.has('RV'));
    assert.equal(r.size, 11);
  });
  await teste('Fila sequencial com comandos concorrentes', async () => {
    const [a, b, c] = await Promise.all([obd.lerPids(['0C']), elm.lerTensao(), obd.lerPids(['0D', '05'])]);
    assert.ok(a.has('0C') && typeof b === 'number' && c.has('05'));
  });
  await teste('Módulo ABS via UDS', async () => {
    const r = await kia.lerModulo(MODULOS_PADRAO.find((m) => m.id === 'abs'));
    assert.equal(r.protocolo, 'UDS');
    assert.equal(r.dtcs[0].codigo, 'C1201');
  });
  await teste('Modo 06 e nomes das centrais', async () => {
    const t = await obd.lerModo06(tab06);
    assert.equal(t.length, 7 + 6 + 1 + 2 + 1 + 1 + 1);
    assert.ok(t.find((x) => x.mid === '21').pertoDoLimite);
    const nomes = await obd.lerNomesEcu();
    assert.deepEqual(nomes.map((n) => n.nome).sort(), ['ECM-Engine Control', 'TCM-TransmisCtrl']);
  });
  await teste('Identificação de módulos (KWP 1A 80 e UDS 22 F187)', async () => {
    const ecm = await kia.identificarModulo(MODULOS_PADRAO.find((m) => m.id === 'ecm'));
    assert.ok(ecm.some((c) => /DEMO-CAL-GAMMA16/.test(c.valor)));
    const bcm = await kia.identificarModulo(MODULOS_PADRAO.find((m) => m.id === 'bcm'));
    assert.deepEqual(bcm[0], { campo: 'Número da peça', valor: '95400DEMO01' });
  });
  await teste('Módulo SRS via KWP2000 (18 02 recusado, 18 00 aceito)', async () => {
    const r = await kia.lerModulo(MODULOS_PADRAO.find((m) => m.id === 'srs'));
    assert.equal(r.protocolo, 'KWP2000');
    assert.equal(r.comando, '1800FF00');
    assert.equal(r.dtcs[0].codigo, 'B1102');
    assert.ok(r.log.some((l) => /Serviço não suportado/.test(l)));
  });
  await teste('Módulo TCM com resposta pendente (NRC 78)', async () => {
    const r = await kia.lerModulo(MODULOS_PADRAO.find((m) => m.id === 'tcm'));
    assert.equal(r.dtcs[0].codigo, 'P0715');
  });
  await teste('Apagar ABS bloqueado por padrão', async () => {
    await assert.rejects(() => kia.apagarModulo(MODULOS_PADRAO.find((m) => m.id === 'abs'), 'UDS'), /DESATIVADO/);
  });
  await teste('Varredura rápida encontra os módulos', async () => {
    const achados = await kia.varrer({ lista: [0x7e0, 0x7e1, 0x7d1, 0x7d2, 0x7a0, 0x7c6, 0x7b0, 0x750] });
    assert.deepEqual(achados.map((a) => a.tx).sort(), ['7A0', '7C6', '7D1', '7D2', '7E0', '7E1']);
  });
  await teste('Leitura OBD simultânea à leitura de módulos (sem trocar endereço no meio)', async () => {
    const mods = MODULOS_PADRAO.map((m) => kia.lerModulo(m).catch(() => null));
    const rpms = [];
    for (let i = 0; i < 6; i++) rpms.push(await obd.lerPids(['0C', '05']));
    await Promise.all(mods);
    assert.ok(rpms.every((r) => r.has('0C') && r.has('05')), 'alguma leitura OBD saiu com o endereço do módulo');
  });
  await teste('OBD volta a funcionar depois dos módulos', async () => {
    assert.equal((await obd.lerDtcs('03')).length, 4);
  });
  await teste('Modo 04 recusado com motor ligado; aceito com motor desligado', async () => {
    assert.equal(await obd.motorDesligado(), false);
    sim.motorLigado = false;
    assert.equal(await obd.motorDesligado(), true);
    const ecus = await obd.apagarDtcs();
    assert.ok(ecus.includes('7E8'));
    assert.equal((await obd.lerDtcs('03')).length, 0);
    assert.equal((await obd.lerDtcs('0A')).length, 1, 'permanente não apaga');
    const st = await obd.lerStatus();
    assert.ok(st.incompletos >= 3, 'monitores zerados');
  });
  await sim.close();
}

console.log(`\n${ok} teste(s) passaram${process.exitCode ? ', com falhas' : ''}.`);
