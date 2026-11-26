# -*- coding: utf-8 -*-
"""Análise da "Gravação guiada" (carro parado, uma mudança por etapa).

Uso: python3 tools/analise/etapas.py gravacao-guiada-XXXX.json [etapa_base=base]

Para cada etapa, compara o valor mais comum de cada byte dos blocos com a etapa base e
mostra os bytes que mudaram de forma estável (mesmo valor na maioria das amostras da etapa),
com os bits que viraram. Bytes que mudam em TODAS as etapas (contadores, ruído) são ignorados.
Índices contam a partir do SID positivo (b[0] = 0x61/0x62), como no pids.json.
"""
import json
import sys
from collections import Counter, defaultdict


def moda(valores):
    c = Counter(valores)
    v, n = c.most_common(1)[0]
    return v, n / len(valores)


def main():
    d = json.load(open(sys.argv[1]))
    base_id = sys.argv[2] if len(sys.argv) > 2 else 'base'
    por_etapa = defaultdict(list)
    for a in d['amostras']:
        por_etapa[a['etapa']].append(a)
    if base_id not in por_etapa:
        raise SystemExit(f'Etapa base "{base_id}" não encontrada. Etapas: {list(por_etapa)}')
    ordem = [e['id'] for e in d['etapas']]

    def perfil(amostras):
        """bloco -> lista de (moda, estabilidade) por posição de byte."""
        out = {}
        for k in amostras[0]['blocos']:
            linhas = [bytes.fromhex(a['blocos'][k]) for a in amostras if a['blocos'].get(k)]
            if not linhas:
                continue
            L = min(len(x) for x in linhas)
            out[k] = [moda([x[i] for x in linhas]) for i in range(L)]
        return out

    perfis = {e: perfil(por_etapa[e]) for e in ordem if e in por_etapa}
    base = perfis[base_id]

    # bytes que mudam em quase todas as etapas = contador/ruído
    mudancas = Counter()
    for e, p in perfis.items():
        for k, pos in p.items():
            for i, (v, _) in enumerate(pos):
                if k in base and i < len(base[k]) and v != base[k][i][0]:
                    mudancas[(k, i)] += 1
    ruido = {kp for kp, n in mudancas.items() if n >= 0.7 * len(perfis)}

    for e in ordem:
        if e not in perfis or e == base_id:
            continue
        titulo = next(x['titulo'] for x in d['etapas'] if x['id'] == e)
        achados = []
        for k, pos in perfis[e].items():
            if k not in base:
                continue
            for i, (v, estab) in enumerate(pos):
                if i >= len(base[k]) or (k, i) in ruido:
                    continue
                bv, best = base[k][i]
                if v != bv and estab >= 0.6 and best >= 0.6:
                    bits = v ^ bv
                    achados.append(f'{k} b[{i}]: {bv:3d} (0x{bv:02X}) -> {v:3d} (0x{v:02X})  bits 0x{bits:02X}')
        print(f'\n== {titulo} ({e}): {len(por_etapa[e])} amostras')
        for x in achados or ['  (nenhuma mudança estável)']:
            print('  ' + x)
    print(f'\nIgnorados como contador/ruído: {sorted(ruido)}')


if __name__ == '__main__':
    main()
