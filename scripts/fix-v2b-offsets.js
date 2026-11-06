#!/usr/bin/env node
// One-off correction (2026-11-05): v2b labels stored each design's slide offset rounded to 6 decimals,
// which can place the shape up to ~5e-7 units past a wall (flagged by the independent checker).
// Recompute the offset at the stored placement angle with the corrected wallFit; designs are unchanged.
// Usage: node scripts/fix-v2b-offsets.js <dataset.jsonl.gz>   (rewrites the file in place; git keeps the original)
const fs = require('fs'), zlib = require('zlib');
const { finalSection, wallFit, floatingAt, assess } = require('../src/packing');
const file = process.argv[2];
const rows = zlib.gunzipSync(fs.readFileSync(file)).toString().trim().split('\n').map(JSON.parse);
let changed = 0, floatingChanged = 0, failing = 0;
for (const r of rows) for (const a of r.answers) {
  const d = a.design; if (!d.angles.length) continue;
  const before = a.quality.floatingCreases;
  d.offset = wallFit(finalSection(d), d.placement ?? 0, r.request).offset;
  a.quality.offset = d.offset; changed++;
  const f = floatingAt(d, r.request); if (f !== before) floatingChanged++;
  a.quality.floatingCreases = f;
  if (!assess(d, r.request, { steps: 30 }).fits) failing++;
}
fs.writeFileSync(file, zlib.gzipSync(rows.map(x => JSON.stringify(x)).join('\n') + '\n'));
console.log(JSON.stringify({ offsetsRecomputed: changed, floatingCountChanged: floatingChanged, notFitting: failing }));
