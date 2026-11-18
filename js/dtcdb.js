/* Consulta ao banco de códigos (data/dtc-db.json).
 * Nenhuma descrição de código fica no código-fonte: tudo vem do arquivo de dados. */

let db = null;
let mapa = null;

export async function carregarDtcDb() {
  if (db) return db;
  const resp = await fetch('data/dtc-db.json');
  if (!resp.ok) throw new Error('Não foi possível carregar o banco de códigos.');
  db = await resp.json();
  mapa = new Map(db.codigos.map((c) => [c.codigo, c]));
  return db;
}

export function dtcDbCarregado() { return !!db; }

/**
 * Busca um código. Aceita "P0301", "C1201-00" (UDS com byte de tipo de falha) etc.
 * Se não houver entrada exata, devolve a descrição da faixa (também do arquivo de dados).
 */
export function buscarDtc(codigoBruto) {
  if (!db) return { codigo: codigoBruto, encontrado: false, descricao: '', sistema: '', severidade: 'baixa' };
  const codigo = String(codigoBruto).toUpperCase().split('-')[0].trim();
  const exato = mapa.get(codigo);
  if (exato) return { ...exato, encontrado: true };
  const faixa = (db.faixas || [])
    .filter((f) => codigo.startsWith(f.prefixo) || (f.de && codigo >= f.de && codigo <= f.ate && codigo[0] === f.de[0]))
    .sort((a, b) => (b.prefixo || b.de).length - (a.prefixo || a.de).length)[0];
  return {
    codigo,
    encontrado: false,
    sistema: faixa?.sistema || db.textos?.sistema_desconhecido || '',
    descricao: faixa?.descricao || db.textos?.nao_encontrado || '',
    severidade: faixa?.severidade || 'media',
    pode_rodar: db.textos?.pode_rodar_desconhecido || '',
    causas_comuns: [],
    verificacoes: faixa?.verificacoes || [],
    notas_cerato: '',
    fabricante: faixa?.fabricante || 'desconhecido',
    confianca: 'baixa'
  };
}

/** Problemas conhecidos do Cerato que envolvem este código. */
export function problemasConhecidos(codigo) {
  if (!db) return [];
  const c = String(codigo).toUpperCase().split('-')[0];
  return (db.problemas_conhecidos || []).filter((p) => (p.codigos || []).includes(c));
}

export function todosProblemas() { return db?.problemas_conhecidos || []; }
export function textosDb() { return db?.textos || {}; }
export function infoDb() {
  return db ? { versao: db.versao, total: db.codigos.length, fontes: db.fontes, gerado_em: db.gerado_em } : null;
}

/** Pesquisa livre por código ou palavra (para a ajuda). */
export function pesquisar(termo, limite = 50) {
  if (!db) return [];
  const t = termo.trim().toUpperCase();
  if (!t) return [];
  const norm = (s) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  const tn = norm(t);
  const res = [];
  for (const c of db.codigos) {
    if (c.codigo.startsWith(t) || norm(c.descricao).includes(tn) || norm(c.sistema).includes(tn)) {
      res.push(c);
      if (res.length >= limite) break;
    }
  }
  return res;
}
