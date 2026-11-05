#!/usr/bin/env node
/* Experiment v2 dataset (docs/EXPERIMENT_SPEC.md section 6, D24, D26, D30).
 * Three steps, each refusing to overwrite finished output:
 *   node scripts/generate-v2-dataset.js requests <dir>            freeze config, requests and grouped splits
 *   node scripts/generate-v2-dataset.js label <dir> <shard> <of>  label one shard with the reference solver
 *   node scripts/generate-v2-dataset.js merge <dir>               combine shards into dataset.jsonl.gz + summary
 * Requests are drawn from the distribution only, never from solutions (D10). */
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { referenceSolveBudgets, handRule, assess, RULES } = require('../src/packing');
const { randomGenerator } = require('../src/optimizer');

const [step, dir, a3, a4] = process.argv.slice(2);
if (!step || !dir) { console.error('Usage: requests|label|merge <dir> [shard of]'); process.exit(2); }
const file = name => path.join(dir, name);
const refuse = p => { if (fs.existsSync(p)) { console.error(`Refusing to overwrite ${p}`); process.exit(1); } };

const CONFIG = {
  experiment: 'learning-v2', created: null, seed: 20261105, splitSeed: 20261106,
  counts: { short: 1500, long: 500, widthImpossible: 100, tiny: 100 },
  distribution: {
    short: { boxLength: [0.05, 0.50], boxHeight: [0.02, 1.06] },
    long: { boxLength: [0.50, 1.08], boxHeight: [0.02, 1.06] },
    widthImpossible: { boxLength: [0.05, 1.08], boxHeight: [0.02, 1.06], boxWidthOverSheetWidth: [0.60, 0.97] },
    tiny: { boxLength: [0.01, 0.08], boxHeight: [0.01, 0.08] },
    sheetLength: [10, 100], sheetWidthOverLength: [0.05, 0.5], boxWidthOverSheetWidth: [1.03, 1.30],
  },
  splits: { train: 0.70, validation: 0.15, test: 0.15 },
  groupCell: 0.04,
  groupingRule: 'box length and height ratios, sorted (D30: a box and its swapped partner are one problem), floored to 0.04 cells',
  rules: RULES,
  notes: 'Ratios are relative to sheet length. Tiny boxes are diagnostics expected to be unsolved; that is not proof of impossibility. Width-impossible boxes are proven impossible.',
};

if (step === 'requests') {
  refuse(file('manifest.json'));
  fs.mkdirSync(dir, { recursive: true });
  const rng = randomGenerator(CONFIG.seed), U = ([lo, hi]) => lo + (hi - lo) * rng(), D = CONFIG.distribution;
  const requests = [];
  for (const [kind, count] of Object.entries(CONFIG.counts)) for (let i = 0; i < count; i++) {
    const spec = D[kind], length = U(D.sheetLength), width = U(D.sheetWidthOverLength) * length;
    const bx = U(spec.boxLength), bz = U(spec.boxHeight);
    const boxWidth = width * U(spec.boxWidthOverSheetWidth || D.boxWidthOverSheetWidth);
    requests.push({ id: `v2-${kind}-${String(i).padStart(4, '0')}`, kind,
      request: { length, width, targetBox: [bx * length, boxWidth, bz * length] } });
  }
  // Group: sorted (length, height) ratios floored to cells, so swapped and near-duplicate boxes share a group.
  const groupOf = r => { const [x, , z] = r.request.targetBox.map(v => v / r.request.length);
    const [lo, hi] = [x, z].sort((p, q) => p - q); return `${Math.floor(lo / CONFIG.groupCell)},${Math.floor(hi / CONFIG.groupCell)}`; };
  for (const r of requests) r.group = groupOf(r);
  const groups = [...new Set(requests.map(r => r.group))].sort();
  const srng = randomGenerator(CONFIG.splitSeed);
  for (let i = groups.length - 1; i > 0; i--) { const j = Math.floor(srng() * (i + 1)); [groups[i], groups[j]] = [groups[j], groups[i]]; }
  const total = requests.length, split = new Map(); let assigned = 0;
  for (const g of groups) {
    const size = requests.filter(r => r.group === g).length, frac = assigned / total;
    split.set(g, frac < CONFIG.splits.train ? 'train' : frac < CONFIG.splits.train + CONFIG.splits.validation ? 'validation' : 'test');
    assigned += size;
  }
  for (const r of requests) r.split = split.get(r.group);
  CONFIG.created = new Date().toISOString();
  fs.writeFileSync(file('config.json'), JSON.stringify(CONFIG, null, 2) + '\n');
  fs.writeFileSync(file('manifest.json'), JSON.stringify({ config: 'config.json', requests }, null, 2) + '\n');
  const bySplit = {}; for (const r of requests) bySplit[r.split] = (bySplit[r.split] || 0) + 1;
  console.log(`requests ${requests.length}, groups ${groups.length}, splits ${JSON.stringify(bySplit)}`);
} else if (step === 'label') {
  const shard = Number(a3), of = Number(a4);
  if (!(of >= 1 && shard >= 0 && shard < of)) { console.error('label <dir> <shard> <of>'); process.exit(2); }
  const out = file(`labels-${shard}-of-${of}.jsonl`); refuse(out);
  const partial = out + '.partial';
  const { requests } = JSON.parse(fs.readFileSync(file('manifest.json'), 'utf8'));
  const mine = requests.filter((_, i) => i % of === shard);
  const done = new Set(fs.existsSync(partial) ? fs.readFileSync(partial, 'utf8').trim().split('\n').filter(Boolean).map(l => JSON.parse(l).id) : []);
  const started = Date.now();
  for (const r of mine) {
    if (done.has(r.id)) continue;   // resumable
    const ref = referenceSolveBudgets(r.request), hand = handRule(r.request);
    fs.appendFileSync(partial, JSON.stringify({ id: r.id, status: ref.status, reason: ref.reason ?? null, minFolds: ref.minFolds ?? null,
      answers: ref.answers, elapsedMs: ref.elapsedMs,
      handRule: hand ? { design: hand, folds: hand.angles.length, passes: assess(hand, r.request).passes } : null }) + '\n');
  }
  fs.renameSync(partial, out);
  console.log(`shard ${shard}/${of}: ${mine.length} requests in ${((Date.now() - started) / 1000).toFixed(0)} s`);
} else if (step === 'merge') {
  refuse(file('dataset.jsonl.gz'));
  const { requests } = JSON.parse(fs.readFileSync(file('manifest.json'), 'utf8'));
  const shards = fs.readdirSync(dir).filter(f => /^labels-\d+-of-\d+\.jsonl$/.test(f));
  const labels = new Map();
  for (const f of shards) for (const l of fs.readFileSync(file(f), 'utf8').trim().split('\n')) { const x = JSON.parse(l); labels.set(x.id, x); }
  const missing = requests.filter(r => !labels.has(r.id));
  if (missing.length) { console.error(`${missing.length} requests unlabeled`); process.exit(1); }
  const rows = requests.map(r => ({ ...r, ...labels.get(r.id) }));
  fs.writeFileSync(file('dataset.jsonl.gz'), zlib.gzipSync(rows.map(r => JSON.stringify(r)).join('\n') + '\n'));
  const summary = {};
  for (const r of rows) {
    const k = `${r.split}/${r.kind}`, s = summary[k] ||= { requests: 0, found: 0, notFound: 0, infeasible: 0, answers: 0, symmetricAnswers: 0, minFolds: {} };
    s.requests++; s[r.status === 'found' ? 'found' : r.status === 'analytically-infeasible' ? 'infeasible' : 'notFound']++;
    s.answers += r.answers.length; s.symmetricAnswers += r.answers.filter(a => a.quality.symmetric).length;
    if (r.minFolds !== null) s.minFolds[r.minFolds] = (s.minFolds[r.minFolds] || 0) + 1;
  }
  const labelMs = rows.reduce((t, r) => t + r.elapsedMs, 0);
  fs.writeFileSync(file('dataset-summary.json'), JSON.stringify({ rows: rows.length, labelCpuSeconds: Math.round(labelMs / 1000), summary }, null, 2) + '\n');
  console.log(`merged ${rows.length} rows from ${shards.length} shards; label CPU ${Math.round(labelMs / 1000)} s`);
} else { console.error('Unknown step'); process.exit(2); }
