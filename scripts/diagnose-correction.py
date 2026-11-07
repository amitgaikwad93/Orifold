"""Correction diagnosis v1 (experiments/correction-diagnosis-v1/PLAN.md). Reads saved validation-v1 records only.
Usage: python3 scripts/diagnose-correction.py   (writes experiments/correction-diagnosis-v1/results/)"""
import gzip, json, math, collections, statistics as st
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
V = ROOT / 'experiments/validation-v1/results'
OUT = ROOT / 'experiments/correction-diagnosis-v1/results'
load = lambda name: {r['id']: r for r in map(json.loads, gzip.open(V / f'{name}.jsonl.gz', 'rt'))}
rows = {r['id']: r for r in map(json.loads, gzip.open(ROOT / 'experiments/learning-v2b/dataset.jsonl.gz', 'rt'))}
ref = load('reference-cached')
methods = {f'adam-{s}': (load(f'seed-{s}-adam-raw'), load(f'seed-{s}-adam-repair')) for s in (17, 29, 43)}
methods['nearest'] = (load('nearest-raw'), load('nearest-repair'))

def opening(d): return 180 - max(d['angles']) if d['angles'] else 180.0
def section(d):
    pts, o = [(0.0, 0.0)], 0.0
    for i, l in enumerate(d['panelLengths']):
        if i: o += (1 if i % 2 else -1) * d['angles'][i - 1]
        r = math.radians(o); x, z = pts[-1]; pts.append((x + l * math.cos(r), z + l * math.sin(r)))
    return pts
def best_overshoot(d, req):
    """Smallest overshoot (fraction of sheet length) over turns 0..180 in 0.1 degree steps."""
    pts, L = section(d), req['length']; u = [0.98 * req['targetBox'][0], 0.98 * req['targetBox'][2]]
    best = math.inf
    for k in range(1800):
        r = math.radians(k / 10); c, s = math.cos(r), math.sin(r)
        xs = [x * c - z * s for x, z in pts]; zs = [x * s + z * c for x, z in pts]
        best = min(best, max((max(xs) - min(xs) - u[0]) / L, (max(zs) - min(zs) - u[1]) / L))
    return max(0.0, best)
def state(rec, ref_open):
    if not rec['valid']: return 'invalid'
    ok = rec['floating'] == 0 and opening(rec['design']) >= 0.9 * ref_open - 1e-9
    return 'quality' if ok else 'valid-no-quality'
def kind(i): return 'short' if '-short-' in i else 'long' if '-long-' in i else 'other'
def step(i):
    r = rows[i.rsplit('-b', 1)[0]]; return int(i.rsplit('-b', 1)[1]) - r['minFolds']

ids = sorted(ref)
report = {'answers': len(ids), 'methods': {}}
examples = {}
for m, (raw, rep) in methods.items():
    T = collections.Counter(); why_invalid = collections.Counter(); why_quality = collections.Counter()
    caused = collections.Counter(); edits = {'quality': [], 'not': []}; over = []
    by = {k: collections.defaultdict(lambda: [0, 0]) for k in ('folds', 'kind', 'step')}
    cats = collections.defaultdict(list)
    for i in ids:
        ro = opening(ref[i]['design']); a, b = raw[i], rep[i]
        sa, sb = state(a, ro), state(b, ro); T[(sa, sb)] += 1
        for key, val in (('folds', ref[i]['quality']['folds']), ('kind', kind(i)), ('step', step(i))):
            by[key][val][0] += 1; by[key][val][1] += sb == 'quality'
        if sb == 'invalid':
            q = b['quality']; why_invalid['collision' if not q.get('contactFree', True) else 'pokes out' if not q.get('fits', True) else 'rules' if q.get('violations') else 'other'] += 1
            why_invalid['stopped early (< cap)' if b['evaluations'] < 400 else 'hit cap'] += 1
            over.append(best_overshoot(b['design'], b['request'])); cats['invalid'].append(i)
        elif sb == 'valid-no-quality':
            fl, lo = b['floating'] > 0, opening(b['design']) < 0.9 * ro
            why_quality['floating + low opening' if fl and lo else 'floating creases' if fl else 'low opening'] += 1
            cats['floating' if fl else 'low-opening'].append(i)
            if b.get('repaired'):
                caused['opening reduced by correction' if opening(b['design']) < opening(a['design']) - 0.5 else 'opening not reduced'] += 1
                if a['valid'] or True:
                    caused['raw start already below 90% opening' if opening(a['design']) < 0.9 * ro else 'raw start had enough opening'] += 1
            else: caused['not corrected (raw already valid)'] += 1
        else: cats['quality'].append(i)
        if b.get('repaired'):
            (edits['quality'] if sb == 'quality' else edits['not']).append((b['maxPanelEditOverL'] * 100, b['maxAngleEditDegrees']))
    med = lambda xs: round(st.median(xs), 2) if xs else None
    report['methods'][m] = {
        'transitions': {f'{a} -> {b}': n for (a, b), n in sorted(T.items())},
        'rawSuccessesLost': sum(n for (a, b), n in T.items() if a == 'quality' and b != 'quality'),
        'invalidAfterCorrection': dict(why_invalid),
        'invalidBestTurnOvershootPctL': {'median': med([o * 100 for o in over]), 'max': round(max(over) * 100, 2) if over else None,
                                          'within1pct': sum(o <= 0.01 for o in over), 'n': len(over)},
        'validButNoQuality': dict(why_quality), 'lowOpeningAttribution': dict(caused),
        'editsMedian': {'endedWithQuality': {'panelPctL': med([e[0] for e in edits['quality']]), 'angleDeg': med([e[1] for e in edits['quality']])},
                        'endedWithout': {'panelPctL': med([e[0] for e in edits['not']]), 'angleDeg': med([e[1] for e in edits['not']])}},
        'qualityRateBy': {k: {str(v): [n, round(q / n * 100, 1)] for v, (n, q) in sorted(d.items())} for k, d in by.items()},
    }
    if m in ('adam-17', 'nearest'): examples[m] = {c: cats[c][:3] for c in ('invalid', 'floating', 'low-opening', 'quality')}
# Q6: retrieval vs neural start, same answers (per seed)
pair = {}
for s in (17, 29, 43):
    rn, ra = methods['nearest'][1], methods[f'adam-{s}'][1]; P = collections.Counter()
    for i in ids:
        ro = opening(ref[i]['design']); P[(state(ra[i], ro) == 'quality', state(rn[i], ro) == 'quality')] += 1
    pair[f'adam-{s}'] = {'both': P[(True, True)], 'onlyAdam': P[(True, False)], 'onlyNearest': P[(False, True)], 'neither': P[(False, False)]}
report['qualityAfterCorrection_adamVsNearest'] = pair
OUT.mkdir(parents=True, exist_ok=True)
json.dump(report, open(OUT / 'diagnosis.json', 'w'), indent=2)
# examples for the visual page
ex = []
for m, cs in examples.items():
    raw, rep = methods[m]
    for c, lst in cs.items():
        for i in lst:
            ex.append({'method': m, 'category': c, 'id': i, 'request': ref[i]['request'], 'raw': raw[i]['design'], 'rawValid': raw[i]['valid'],
                       'repaired': rep[i]['design'], 'repairedValid': rep[i]['valid'], 'floating': rep[i]['floating'],
                       'reference': ref[i]['design'], 'openings': [opening(raw[i]['design']), opening(rep[i]['design']), opening(ref[i]['design'])]})
json.dump(ex, open(OUT / 'examples.json', 'w'))
print(json.dumps(report, indent=1))
