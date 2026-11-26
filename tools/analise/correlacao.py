# -*- coding: utf-8 -*-
"""Correlação entre PIDs OBD e bytes dos blocos dos módulos (arquivo da "Gravação para decodificar dados").

Uso: python3 tools/analise/correlacao.py gravacao-correlacao-XXXX.json [r_minimo=0.93] [max_linhas=200]
Para cada byte (B), palavra big/little-endian (W..be/W..le) e palavra com sinal (S..be) dos blocos,
calcula a correlação de Pearson com cada PID e a reta física = a*bruto + b. Índices contam a partir
do SID positivo (b[0] = 0x61 ou 0x62), igual às fórmulas "fonte: modulo" do pids.json."""
import json, sys, math
d = json.load(open(sys.argv[1])); A = d['amostras']
def pear(x, y):
    n = len(x); mx = sum(x)/n; my = sum(y)/n
    sx = math.sqrt(sum((a-mx)**2 for a in x)); sy = math.sqrt(sum((b-my)**2 for b in y))
    if sx == 0 or sy == 0: return 0
    return sum((a-mx)*(b-my) for a, b in zip(x, y)) / (sx*sy)
def fit(x, y):  # y ≈ a*x + b, x = bruto, y = físico
    n = len(x); mx = sum(x)/n; my = sum(y)/n
    sxx = sum((a-mx)**2 for a in x)
    a = sum((p-mx)*(q-my) for p, q in zip(x, y))/sxx; return a, my - a*mx
pids = [p for p in d['pidsObd'] if p not in ('46',)]
obd = {p: [s['obd'].get(p) for s in A] for p in pids}
res = []
for k in A[0]['blocos']:
    linhas = [bytes.fromhex(s['blocos'][k]) if s['blocos'][k] else None for s in A]
    if any(l is None for l in linhas): continue
    L = min(len(l) for l in linhas)
    cands = []
    for i in range(L):
        cands.append((f'B{i}', [l[i] for l in linhas]))
        if i+1 < L:
            cands.append((f'W{i}be', [l[i]*256+l[i+1] for l in linhas]))
            cands.append((f'W{i}le', [l[i]+l[i+1]*256 for l in linhas]))
            cands.append((f'S{i}be', [(l[i]*256+l[i+1]) - (65536 if l[i] >= 128 else 0) for l in linhas]))
    for nome, xs in cands:
        if len(set(xs)) < 4: continue
        for p in pids:
            ys = obd[p]
            if None in ys or len(set(ys)) < 4: continue
            r = pear(xs, ys)
            if abs(r) >= float(sys.argv[2]):
                a, b = fit(xs, ys); res.append((abs(r), k, nome, p, r, a, b, min(xs), max(xs)))
res.sort(reverse=True)
melhor = {}
for t in res:
    chave = (t[1], t[2].lstrip('BWS').rstrip('belg'))
    if (t[1], t[2], t[3]) in melhor: continue
    melhor[(t[1], t[2], t[3])] = t
for t in sorted(melhor.values(), key=lambda t: (t[3], -t[0]))[:int(sys.argv[3])]:
    print(f'{t[3]:3} r={t[4]:+.3f} {t[1]:13} {t[2]:7} fis = {t[5]:.5g}*bruto + {t[6]:.4g}  (bruto {t[7]}..{t[8]})')
