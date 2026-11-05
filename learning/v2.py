"""Experiment v2b model: an MLP trained from scratch to propose fold designs (docs/EXPERIMENT_SPEC.md,
experiments/learning-v2b/train-config.json). Geometry is judged by the Node reference checker
(scripts/assess-designs.js), never by this file.

  .venv/bin/python -m learning.v2 train  --output experiments/learning-v2b/run-1
  .venv/bin/python -m learning.v2 predict --run experiments/learning-v2b/run-1 --split test
"""
import argparse, copy, gzip, json, math, subprocess, sys, time
from pathlib import Path
import numpy as np
import torch
from torch import nn

ROOT = Path(__file__).resolve().parent.parent
MAX_FOLDS, MIN_PANEL = 11, 0.05


def load_rows(path):
    with gzip.open(path, 'rt') as f:
        return [json.loads(l) for l in f if l.strip()]


def features(request, budget):
    L = request['length']; x, z = request['targetBox'][0] / L, request['targetBox'][2] / L
    lo, hi = sorted([x, z])
    return [lo, hi, budget / MAX_FOLDS]


def label_targets(answer, request):
    """Fold count, 11 stick-breaking fractions and 11 angle values in [0, 1] (zero-padded) plus masks."""
    d = answer['design']; L = request['length']; n = len(d['panelLengths']); k = n - 1
    rem, v = 1 - MIN_PANEL * n, []
    for i in range(n - 1):
        a = d['panelLengths'][i] / L - MIN_PANEL
        v.append(min(1.0, max(0.0, a / rem)) if rem > 1e-12 else 0.0); rem -= a
    ang = [(a - 1) / 179 for a in d['angles']]
    pad = lambda xs: xs + [0.0] * (MAX_FOLDS - len(xs))
    mask = [1.0] * k + [0.0] * (MAX_FOLDS - k)
    return k, pad(v), pad(ang), mask


def examples(rows, split):
    out = []
    for r in rows:
        if r['split'] != split or r['status'] != 'found':
            continue
        for a in r['answers']:
            k, v, ang, mask = label_targets(a, r['request'])
            out.append({'id': f"{r['id']}-b{a['budget']}", 'row': r, 'budget': a['budget'], 'answer': a,
                        'x': features(r['request'], a['budget']), 'k': k, 'v': v, 'ang': ang, 'mask': mask})
    return out


class Model(nn.Module):
    def __init__(self, hidden=(256, 256)):
        super().__init__()
        sizes, layers = [3, *hidden], []
        for i in range(len(sizes) - 1):
            layers += [nn.Linear(sizes[i], sizes[i + 1]), nn.Tanh()]
        self.body = nn.Sequential(*layers)
        self.folds = nn.Linear(sizes[-1], MAX_FOLDS + 1)
        self.shape = nn.Linear(sizes[-1], 2 * MAX_FOLDS)
        self.register_buffer('mean', torch.zeros(3)); self.register_buffer('std', torch.ones(3))

    def forward(self, x):
        h = self.body((x - self.mean) / self.std)
        s = torch.sigmoid(self.shape(h))
        return self.folds(h), s[:, :MAX_FOLDS], s[:, MAX_FOLDS:]


def decode(fold_logits, v, ang, request, budget):
    """Most likely fold count within the budget, then panel lengths and angles."""
    logits = fold_logits.clone(); logits[budget + 1:] = -1e9
    k = int(torch.argmax(logits)); n = k + 1; L = request['length']
    rem, lengths = 1 - MIN_PANEL * n, []
    for i in range(n - 1):
        a = rem * float(v[i]); rem -= a; lengths.append((MIN_PANEL + a) * L)
    lengths.append((MIN_PANEL + rem) * L)
    return {'panelLengths': lengths, 'width': request['width'], 'angles': [1 + 179 * float(t) for t in ang[:k]]}


def assess(items):
    """items: list of (id, request, design) -> dict id -> checker result (Node reference checker)."""
    payload = ''.join(json.dumps({'id': i, 'request': r, 'design': d}) + '\n' for i, r, d in items)
    p = subprocess.run(['node', str(ROOT / 'scripts/assess-designs.js')], input=payload, capture_output=True, text=True, check=True)
    return {o['id']: o for o in map(json.loads, p.stdout.strip().split('\n')) if o}


def batch_tensors(ex):
    t = lambda key: torch.tensor([e[key] for e in ex], dtype=torch.float32)
    return t('x'), torch.tensor([e['k'] for e in ex]), t('v'), t('ang'), t('mask')


def loss_fn(model, x, k, v, ang, mask):
    fl, pv, pa = model(x)
    ce = nn.functional.cross_entropy(fl, k)
    denom = mask.sum().clamp(min=1)
    return ce + ((pv - v) ** 2 * mask).sum() / denom + ((pa - ang) ** 2 * mask).sum() / denom


def position_loss(model, x, k, v, ang, weight=10.0):
    """Fold-count cross-entropy + weight x mean squared vertex distance to the reference shape (true fold count)."""
    fl, pv, pa = model(x)
    ce = nn.functional.cross_entropy(fl, k)
    zero = torch.zeros(x.shape[0])
    px, pz = fold_vertices(pv, pa, k, zero); rx, rz = fold_vertices(v, ang, k, zero)
    return ce + weight * (((px - rx) ** 2 + (pz - rz) ** 2).sum(1) / (k + 2).float()).mean()


def predict(model, ex):
    model.eval()
    with torch.no_grad():
        x = torch.tensor([e['x'] for e in ex], dtype=torch.float32)
        fl, pv, pa = model(x)
    return [decode(fl[i], pv[i], pa[i], e['row']['request'], e['budget']) for i, e in enumerate(ex)]


def fold_vertices(v, ang, k, psi):
    """Differentiable side-view vertices xs, zs [B, 13] (sheet-length units) of the shape with k folds; unused
    trailing vertices repeat the end point. Matches src/accordion.js."""
    B = v.shape[0]; n = (k + 1).float()
    rem = 1 - MIN_PANEL * n; lengths = []
    for i in range(MAX_FOLDS + 1):
        if i < MAX_FOLDS:
            active = (k > i).float()
            a = rem * v[:, i] * active; rem = rem - a
        is_last = (k == i).float(); exists = (k >= i).float()
        li = (MIN_PANEL + (a if i < MAX_FOLDS else 0)) * (exists - is_last) + (MIN_PANEL + rem) * is_last
        lengths.append(li * exists)
    lengths = torch.stack(lengths, 1)
    deg = 1 + 179 * ang
    fold_mask = (torch.arange(MAX_FOLDS).unsqueeze(0) < k.unsqueeze(1)).float()
    sign = torch.tensor([1.0 if i % 2 == 0 else -1.0 for i in range(MAX_FOLDS)])
    turn = torch.cumsum(deg * fold_mask * sign, 1)
    orient = torch.cat([torch.zeros(B, 1), turn], 1) + psi.unsqueeze(1)
    r = orient * math.pi / 180
    xs = torch.cat([torch.zeros(B, 1), torch.cumsum(lengths * torch.cos(r), 1)], 1)
    zs = torch.cat([torch.zeros(B, 1), torch.cumsum(lengths * torch.sin(r), 1)], 1)
    return xs, zs


def fold_extents_v(v, ang, k, psi):
    xs, zs = fold_vertices(v, ang, k, psi)
    return xs.max(1).values - xs.min(1).values, zs.max(1).values - zs.min(1).values


def fold_extents(v, ang, k, psi):
    """Differentiable side-view extents (dx, dz) in sheet-length units of the shape with k folds, panels from the
    stick-breaking fractions v and angles from ang (both [B, 11]), turned by psi degrees. Matches src/accordion.js."""
    B = v.shape[0]; n = (k + 1).float()
    rem = 1 - MIN_PANEL * n; lengths = []
    for i in range(MAX_FOLDS + 1):
        if i < MAX_FOLDS:
            active = (k > i).float()                      # panel i is a non-last panel
            a = rem * v[:, i] * active; rem = rem - a
        is_last = (k == i).float()
        exists = (k >= i).float()
        li = (MIN_PANEL + (a if i < MAX_FOLDS else 0)) * (exists - is_last) + (MIN_PANEL + rem) * is_last
        lengths.append(li * exists)
    lengths = torch.stack(lengths, 1)                     # [B, 12]
    deg = 1 + 179 * ang                                  # [B, 11]
    fold_mask = (torch.arange(MAX_FOLDS).unsqueeze(0) < k.unsqueeze(1)).float()
    sign = torch.tensor([1.0 if i % 2 == 0 else -1.0 for i in range(MAX_FOLDS)])
    turn = torch.cumsum(deg * fold_mask * sign, 1)        # orientation of panels 1..11
    orient = torch.cat([torch.zeros(B, 1), turn], 1) + psi.unsqueeze(1)
    r = orient * math.pi / 180
    xs = torch.cat([torch.zeros(B, 1), torch.cumsum(lengths * torch.cos(r), 1)], 1)
    zs = torch.cat([torch.zeros(B, 1), torch.cumsum(lengths * torch.sin(r), 1)], 1)
    return xs.max(1).values - xs.min(1).values, zs.max(1).values - zs.min(1).values


def fit_penalty(model, x, k, psi, ux, uz, margin):
    _, pv, pa = model(x)
    dx, dz = fold_extents(pv, pa, k, psi)
    return (torch.relu(dx - (1 - margin) * ux) ** 2 + torch.relu(dz - (1 - margin) * uz) ** 2).mean()


def train(args):
    config = json.loads((ROOT / args.config).read_text())
    out = Path(args.output)
    if out.exists():
        raise SystemExit(f'{out} exists; use a new output directory')
    out.mkdir(parents=True)
    t = config['training']; torch.manual_seed(t['seed']); np.random.seed(t['seed']); torch.set_num_threads(t['threads'])
    rows = load_rows(ROOT / config['dataset'])
    tr, va = examples(rows, 'train'), examples(rows, 'validation')
    hidden = tuple(args.hidden) if args.hidden else tuple(config['model']['hidden'])
    model = Model(hidden)
    xs = torch.tensor([e['x'] for e in tr], dtype=torch.float32)
    model.mean.copy_(xs.mean(0)); model.std.copy_(xs.std(0).clamp(min=1e-6))
    opt = torch.optim.Adam(model.parameters(), lr=t['learningRate'])
    Xt, Kt, Vt, At, Mt = batch_tensors(tr); Xv, Kv, Vv, Av, Mv = batch_tensors(va)
    fit = config.get('fitLoss'); weight = args.fit_weight if fit else 0.0
    def geo(ex):
        u = [[0.98 * e['row']['request']['targetBox'][0] / e['row']['request']['length'], 0.98 * e['row']['request']['targetBox'][2] / e['row']['request']['length']] for e in ex]
        return (torch.tensor([e['answer']['design'].get('placement', 0.0) for e in ex], dtype=torch.float32),
                torch.tensor([a for a, _ in u], dtype=torch.float32), torch.tensor([b for _, b in u], dtype=torch.float32))
    Pt, UXt, UZt = geo(tr); Pv, UXv, UZv = geo(va)
    margin = fit['margin'] if fit else 0.0
    tight = args.tighter_weight if config.get('tighterPenalty') else 0.0
    def tighter_penalty(X, A, M):
        _, _, pa = model(X)
        return ((torch.relu(pa - A) ** 2) * M).sum() / M.sum().clamp(min=1)
    imitation = (lambda X, K, V, A, M: position_loss(model, X, K, V, A)) if args.imitation == 'positions' else (lambda X, K, V, A, M: loss_fn(model, X, K, V, A, M))
    total = lambda X, K, V, A, M, P, UX, UZ: (imitation(X, K, V, A, M)
        + (weight * fit_penalty(model, X, K, P, UX, UZ, margin) if weight else 0)
        + (tight * tighter_penalty(X, A, M) if tight else 0))
    params = sum(p.numel() for p in model.parameters())
    print(f'train examples {len(tr)}, validation {len(va)}, parameters {params}', flush=True)
    history, best, since, started = [], None, 0, time.time()
    for epoch in range(1, t['maxEpochs'] + 1):
        model.train(); perm = torch.randperm(len(tr))
        for i in range(0, len(tr), t['batchSize']):
            idx = perm[i:i + t['batchSize']]
            opt.zero_grad(); loss = total(Xt[idx], Kt[idx], Vt[idx], At[idx], Mt[idx], Pt[idx], UXt[idx], UZt[idx]); loss.backward(); opt.step()
        if epoch % 50 == 0:
            model.eval()
            with torch.no_grad():
                tl = float(total(Xt, Kt, Vt, At, Mt, Pt, UXt, UZt)); vl = float(total(Xv, Kv, Vv, Av, Mv, Pv, UXv, UZv))
            res = assess([(e['id'], e['row']['request'], d) for e, d in zip(va, predict(model, va))])
            rate = sum(r['passes'] for r in res.values()) / len(va)
            history.append({'epoch': epoch, 'trainLoss': tl, 'validationLoss': vl, 'validationPassRate': rate})
            better = best is None or rate > best['rate'] + 1e-12 or (abs(rate - best['rate']) <= 1e-12 and vl < best['loss'])
            if better:
                best = {'epoch': epoch, 'rate': rate, 'loss': vl, 'state': copy.deepcopy(model.state_dict())}; since = 0
            else:
                since += 50
            print(f'epoch {epoch}: train {tl:.4f} val {vl:.4f} val pass {rate:.3f}{" *" if better else ""}', flush=True)
            if since >= 600:
                break
    torch.save({'state': best['state'], 'hidden': list(hidden)}, out / 'checkpoint.pt')
    (out / 'history.json').write_text(json.dumps(history, indent=1) + '\n')
    (out / 'training-summary.json').write_text(json.dumps({'config': args.config, 'fitWeight': weight, 'tighterWeight': tight, 'imitation': args.imitation, 'hidden': list(hidden),
        'parameters': params, 'trainExamples': len(tr), 'validationExamples': len(va), 'selectedEpoch': best['epoch'],
        'validationPassRate': best['rate'], 'validationLoss': best['loss'], 'stoppedAtEpoch': history[-1]['epoch'],
        'trainingSeconds': round(time.time() - started, 1), 'torch': torch.__version__, 'python': sys.version.split()[0]}, indent=2) + '\n')
    print(f'selected epoch {best["epoch"]}: validation pass {best["rate"]:.3f}', flush=True)


def load_model(run):
    ck = torch.load(Path(run) / 'checkpoint.pt', map_location='cpu', weights_only=True)
    m = Model(tuple(ck['hidden'])); m.load_state_dict(ck['state']); m.eval(); return m


def predict_cmd(args):
    config = json.loads((ROOT / 'experiments/learning-v2b/train-config.json').read_text())
    out = Path(args.run) / f'predictions-{args.split}.jsonl'
    if out.exists():
        raise SystemExit(f'{out} exists; predictions are frozen')
    rows = load_rows(ROOT / config['dataset']); ex = examples(rows, args.split); model = load_model(args.run)
    started = time.time(); designs = predict(model, ex); ms = (time.time() - started) * 1000 / max(1, len(ex))
    res = assess([(e['id'], e['row']['request'], d) for e, d in zip(ex, designs)])
    with out.open('w') as f:
        for e, d in zip(ex, designs):
            r = res[e['id']]
            f.write(json.dumps({'id': e['id'], 'request': e['row']['id'], 'kind': e['row']['kind'], 'budget': e['budget'],
                'proposed': r.get('design', d), 'check': {k: v for k, v in r.items() if k != 'design'},
                'reference': {'folds': e['answer']['quality']['folds'], 'spread': e['answer']['quality']['spread']}}) + '\n')
    rate = sum(r['passes'] for r in res.values()) / len(ex)
    print(json.dumps({'split': args.split, 'answers': len(ex), 'passRate': round(rate, 4), 'inferenceMsPerAnswer': round(ms, 4)}))


if __name__ == '__main__':
    ap = argparse.ArgumentParser(); sub = ap.add_subparsers(dest='cmd', required=True)
    a = sub.add_parser('train'); a.add_argument('--output', required=True)
    a.add_argument('--config', default='experiments/learning-v2b/train-config.json'); a.add_argument('--fit-weight', type=float, default=0.0)
    a.add_argument('--tighter-weight', type=float, default=0.0)
    a.add_argument('--imitation', choices=['parameters', 'positions'], default='parameters'); a.add_argument('--hidden', type=int, nargs='*')
    b = sub.add_parser('predict'); b.add_argument('--run', required=True); b.add_argument('--split', required=True)
    args = ap.parse_args(); train(args) if args.cmd == 'train' else predict_cmd(args)
