#!/usr/bin/env node
// Re-solve dataset requests with a different optimizer seed and compare against the stored labels.
// Purpose: check whether each request has one consistent label, or whether labels depend on the seed.
// Usage: node scripts/audit-label-consistency.js <experiment-dir> <output.json> [count=40] [seed=12345]
const fs = require('fs'), path = require('path'), zlib = require('zlib');
const { search } = require('../src/optimizer');

const [experiment, output, countArg = '40', seedArg = '12345'] = process.argv.slice(2);
if (!experiment || !output) {
  console.error('Usage: node scripts/audit-label-consistency.js <experiment-dir> <output.json> [count] [seed]');
  process.exit(2);
}
if (fs.existsSync(output)) { console.error(`Refusing to overwrite ${output}`); process.exit(1); }
const count = Number(countArg), seed = Number(seedArg);
const rows = zlib.gunzipSync(fs.readFileSync(path.join(experiment, 'dataset.jsonl.gz'))).toString()
  .trim().split('\n').map(JSON.parse).filter(r => r.label && r.split === 'train').slice(0, count);

const records = rows.map(row => {
  const result = search(row.request, { seed });
  if (result.status !== 'solved-sampled') return { id: row.id, group: row.group, status: result.status };
  const a = row.label.parameters, b = result.parameters;
  const rmsParameterDifference = Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0) / a.length);
  return { id: row.id, group: row.group, status: result.status, rmsParameterDifference,
    original: { angles: row.label.design.angles, normalizedRotation: row.label.quality.normalizedRotation },
    reseeded: { angles: result.design.angles, normalizedRotation: result.quality.normalizedRotation } };
});
const solved = records.filter(r => r.rmsParameterDifference !== undefined);
const diffs = solved.map(r => r.rmsParameterDifference).sort((x, y) => x - y);
const summary = {
  requests: records.length, reseededSolved: solved.length,
  medianRmsParameterDifference: diffs[Math.floor(diffs.length / 2)],
  fractionRmsAbove0_1: diffs.filter(d => d > 0.1).length / diffs.length,
  reseedLowerRotation: solved.filter(r => r.reseeded.normalizedRotation < r.original.normalizedRotation - 1e-3).length,
  reseedHigherRotation: solved.filter(r => r.reseeded.normalizedRotation > r.original.normalizedRotation + 1e-3).length,
};
fs.writeFileSync(output, JSON.stringify({ experiment, auditSeed: seed, split: 'train', summary, records }, null, 2) + '\n');
console.log(JSON.stringify(summary, null, 2));
