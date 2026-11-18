# -*- coding: utf-8 -*-
"""Gera data/dtc-db.json a partir das definições desta pasta.

Uso (na raiz do repositório):
    python3 tools/dtc/gerar.py
"""
import json
import os
import sys
from datetime import date

AQUI = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, AQUI)

from base import montar, S  # noqa: E402
import p0_a, p0_b, p0_c, p2, p3_cbu, fabricante  # noqa: E402
from detalhados import D  # noqa: E402
from problemas import PROBLEMAS, FAIXAS, TEXTOS  # noqa: E402

RAIZ = os.path.dirname(os.path.dirname(AQUI))
SAIDA = os.path.join(RAIZ, "data", "dtc-db.json")


def main():
    entradas = {}
    duplicados = []

    def incluir(e):
        if e["codigo"] in entradas:
            duplicados.append(e["codigo"])
        entradas[e["codigo"]] = e

    for mod in (p0_a, p0_b, p0_c, p2, p3_cbu):
        for cod, chave, desc in mod.L:
            incluir(montar(cod, chave, desc))
    for cod, chave, desc in p3_cbu.L_MEDIA:
        incluir(montar(cod, chave, desc, {
            "confianca": "media",
            "fonte": "Código genérico SAE; a numeração de C0/B0 varia entre fabricantes",
        }))
    for cod, chave, desc in p2.L_MEDIA:
        incluir(montar(cod, chave, desc, {"confianca": "media", "fonte": "SAE J2012 (revisão recente) — descrição a confirmar"}))
    for cod, chave, desc, conf, fonte, nota in fabricante.L:
        e = montar(cod, chave, desc, {"fabricante": "Hyundai/Kia", "confianca": conf, "fonte": fonte})
        if nota:
            e["notas_cerato"] = nota
        incluir(e)

    # sobrescreve com as entradas detalhadas
    for cod, campos in D.items():
        if cod not in entradas:
            raise SystemExit(f"Entrada detalhada para código inexistente: {cod}")
        entradas[cod].update(campos)

    # validações
    erros = []
    for cod, e in entradas.items():
        if len(cod) != 5 or cod[0] not in "PCBU":
            erros.append(f"código mal formado: {cod}")
        for campo in ("codigo", "sistema", "descricao", "severidade", "pode_rodar", "causas_comuns", "verificacoes", "notas_cerato", "fabricante", "confianca"):
            if campo not in e:
                erros.append(f"{cod}: falta {campo}")
        if e["severidade"] not in ("alta", "media", "baixa"):
            erros.append(f"{cod}: severidade inválida")
        if e["confianca"] not in ("alta", "media", "baixa"):
            erros.append(f"{cod}: confiança inválida")
    for p in PROBLEMAS:
        for c in p["codigos"]:
            if c not in entradas:
                erros.append(f"problema {p['id']} cita código ausente {c}")
    if duplicados:
        erros.append("duplicados: " + ", ".join(sorted(set(duplicados))))
    if erros:
        print("\n".join(erros))
        raise SystemExit(1)

    def ordem(c):
        return ("PCBU".index(c[0]), c[1:])

    codigos = [entradas[c] for c in sorted(entradas, key=ordem)]

    # estatísticas de cobertura
    def cobertura(ini, fim):
        total = fim - ini + 1
        n = sum(1 for i in range(ini, fim + 1) if ("P%04d" % i) in entradas)
        return n, total

    stats = {
        "P0000-P0999": cobertura(0, 999),
        "P2000-P2999": cobertura(2000, 2999),
        "P3400-P3499": cobertura(3400, 3499),
    }

    db = {
        "versao": "1.0.0",
        "gerado_em": date.today().isoformat(),
        "idioma": "pt-BR",
        "fontes": {
            "resumo": ("Códigos genéricos conforme a numeração SAE J2012 / ISO 15031-6, com descrições traduzidas e adaptadas para o português do Brasil. "
                       "Causas e verificações são orientações gerais de diagnóstico. Códigos de fabricante Hyundai/Kia vêm de descrições recorrentes "
                       "em literatura de serviço e têm o campo 'confianca'. Faixas reservadas pela norma não têm entrada própria e são explicadas pela tabela de faixas."),
            "generico": "SAE J2012 / ISO 15031-6",
            "fabricante": "Literatura de serviço Hyundai/Kia (confiança indicada por código)"
        },
        "estatisticas": {k: {"com_entrada": v[0], "numeros_na_faixa": v[1]} for k, v in stats.items()},
        "textos": TEXTOS,
        "faixas": FAIXAS,
        "problemas_conhecidos": PROBLEMAS,
        "codigos": codigos,
    }
    with open(SAIDA, "w", encoding="utf-8") as f:
        json.dump(db, f, ensure_ascii=False, indent=0, separators=(",", ":"))
        f.write("\n")

    por_letra = {}
    for c in codigos:
        por_letra[c["codigo"][:2]] = por_letra.get(c["codigo"][:2], 0) + 1
    print(f"Gerado {SAIDA}: {len(codigos)} códigos")
    print("Por prefixo:", dict(sorted(por_letra.items())))
    for k, (n, t) in stats.items():
        print(f"  {k}: {n} entradas (de {t} números na faixa)")
    print("Tamanho:", os.path.getsize(SAIDA) // 1024, "KB")


if __name__ == "__main__":
    main()
