"""Bias (accuracy) and scatter (precision) of a run's predictions against the reference answers, for answers where
the predicted fold count equals the reference. Usage: python3 scripts/precision-report.py <predictions.jsonl>"""
import json, gzip, statistics as st, sys
from pathlib import Path
root = Path(__file__).resolve().parent.parent
rows = {json.loads(l)['id']: json.loads(l) for l in gzip.open(root / 'experiments/learning-v2b/dataset.jsonl.gz', 'rt')}
ang, pan, opening, n, same = [], [], [], 0, 0
for l in open(sys.argv[1]):
    p = json.loads(l); n += 1
    r = rows[p['request']]; ref = [a for a in r['answers'] if a['budget'] == p['budget']][0]['design']; d = p['proposed']
    if len(d['angles']) != len(ref['angles']): continue
    same += 1
    if not ref['angles']: continue
    L = r['request']['length']
    ang += [a - b for a, b in zip(d['angles'], ref['angles'])]
    pan += [(a - b) / L * 100 for a, b in zip(d['panelLengths'], ref['panelLengths'])]
    opening.append((180 - max(d['angles'])) - (180 - max(ref['angles'])))
f = lambda xs: {'bias': round(st.mean(xs), 2), 'scatter': round(st.pstdev(xs), 2)}
print(json.dumps({'answers': n, 'sameFoldCount': same, 'foldAngleDeg': f(ang), 'panelLengthPctSheet': f(pan), 'openingAngleDeg': f(opening)}))
