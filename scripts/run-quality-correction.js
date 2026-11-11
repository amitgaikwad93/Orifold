#!/usr/bin/env node
// Runner for experiments/quality-correction-v1. Usage: node scripts/run-quality-correction.js <start> <shard> <of>
// start: seed-17-adam | seed-29-adam | seed-43-adam | nearest | simple
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const { qualityCorrect } = require('./quality-correction');
const [start, shardArg, ofArg] = process.argv.slice(2), shard = Number(shardArg), of = Number(ofArg);
const CAPS = [25, 50, 100, 200, 400, 800, 1600, 3200];
const V = 'experiments/validation-v1/results', OUT = 'experiments/quality-correction-v1/results';
const out = path.join(OUT, `${start}-${shard}-of-${of}.jsonl`);
if (fs.existsSync(out)) { console.error(`Refusing to overwrite ${out}`); process.exit(1); }
fs.mkdirSync(OUT, { recursive: true });
const src = start === 'simple' ? 'nearest-raw' : `${start}-raw`;
const rows = zlib.gunzipSync(fs.readFileSync(path.join(V, `${src}.jsonl.gz`))).toString().trim().split('\n').map(JSON.parse)
  .sort((a, b) => a.id < b.id ? -1 : 1).filter((_, i) => i % of === shard);
const lines = [];
for (const r of rows) {
  const L = r.request.length, n = r.budget + 1;
  const d = start === 'simple'
    ? { panelLengths: Array(n).fill(L / n), width: r.request.width, angles: Array(r.budget).fill(150) }
    : { panelLengths: r.design.panelLengths, width: r.design.width, angles: r.design.angles };
  const o = qualityCorrect(d, r.request, CAPS);
  lines.push(JSON.stringify({ id: r.id, budget: r.budget, start, evaluations: o.evaluations,
    results: o.results.map(x => ({ cap: x.cap, evaluations: x.evaluations, searchMs: x.searchMs, finishMs: x.finishMs, passes: x.passes,
      floating: x.floating, spread: x.spread, folds: x.folds, design: x.design,
      rank: { folds: x.quality.folds, order: x.quality.order, symmetric: x.quality.symmetric, minGap: x.quality.minGap, sweptArea: x.quality.sweptArea, dimensions: x.quality.dimensions } })) }));
}
fs.writeFileSync(out, lines.join('\n') + '\n');
console.log(`${start} shard ${shard}/${of}: ${rows.length} answers`);
