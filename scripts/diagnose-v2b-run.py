# Diagnose a v2b model run on train and validation only (never test): train vs validation pass, fold-count
# effect, oracle fold count, nearest-neighbour copy baseline, label jumpiness. Usage: .venv/bin/python scripts/diagnose-v2b-run.py <run-dir>
import sys, json, math, collections, torch
sys.path.insert(0, str(__import__('pathlib').Path(__file__).resolve().parent.parent))
from learning import v2
rows = v2.load_rows(str(__import__('pathlib').Path(__file__).resolve().parent.parent / 'experiments/learning-v2b/dataset.jsonl.gz'))
tr, va = v2.examples(rows, 'train'), v2.examples(rows, 'validation')
model = v2.load_model(sys.argv[1] if len(sys.argv) > 1 else 'experiments/learning-v2b/run-1')
def evaluate(ex, designs):
    res = v2.assess([(e['id'], e['row']['request'], d) for e, d in zip(ex, designs)])
    return [res[e['id']] for e in ex]
# 1. train vs validation pass
pt = evaluate(tr, v2.predict(model, tr)); pv = evaluate(va, v2.predict(model, va))
print('model pass: train %.3f  validation %.3f' % (sum(r['passes'] for r in pt)/len(pt), sum(r['passes'] for r in pv)/len(pv)))
# 2. fold-count right vs wrong
for name, ex, res in [('train', tr, pt), ('validation', va, pv)]:
    preds = v2.predict(model, ex)
    right = [r['passes'] for e, d, r in zip(ex, preds, res) if len(d['angles']) == e['k']]
    wrong = [r['passes'] for e, d, r in zip(ex, preds, res) if len(d['angles']) != e['k']]
    print(f'{name}: fold count right {len(right)} -> pass {sum(right)/max(1,len(right)):.3f}; wrong {len(wrong)} -> pass {sum(wrong)/max(1,len(wrong)):.3f}')
# 2b. oracle fold count: give the model the true fold count, keep its shape
model.eval()
with torch.no_grad():
    fl, pvv, paa = model(torch.tensor([e['x'] for e in va], dtype=torch.float32))
oracle = []
for i, e in enumerate(va):
    f = torch.full((12,), -1e9); f[e['k']] = 0
    oracle.append(v2.decode(f, pvv[i], paa[i], e['row']['request'], e['budget']))
po = evaluate(va, oracle); print('validation with true fold count given: pass %.3f' % (sum(r['passes'] for r in po)/len(po)))
# 3. nearest-neighbour copy: closest training box (canonical sides) with the same budget, scaled to the sheet
by_b = collections.defaultdict(list)
for e in tr: by_b[e['budget']].append(e)
nn = []
for e in va:
    cands = by_b.get(e['budget']) or tr
    best = min(cands, key=lambda c: (c['x'][0]-e['x'][0])**2 + (c['x'][1]-e['x'][1])**2)
    d = best['answer']['design']; s = e['row']['request']['length'] / best['row']['request']['length']
    nn.append({'panelLengths': [p*s for p in d['panelLengths']], 'width': e['row']['request']['width'], 'angles': list(d['angles'])})
pn = evaluate(va, nn); print('nearest-neighbour copy: validation pass %.3f' % (sum(r['passes'] for r in pn)/len(pn)))
# 4. label jumpiness: for each train example, its nearest train neighbour (same budget): same fold count? similar shape?
same_k = 0; dist = []
for e in tr:
    others = [c for c in by_b[e['budget']] if c is not e]
    c = min(others, key=lambda c: (c['x'][0]-e['x'][0])**2 + (c['x'][1]-e['x'][1])**2)
    dist.append(math.dist(e['x'][:2], c['x'][:2]))
    if c['k'] == e['k']: same_k += 1
dist.sort()
print('train: nearest neighbour has the same fold count in %.3f; median neighbour distance %.4f (box ratio units)' % (same_k/len(tr), dist[len(dist)//2]))
