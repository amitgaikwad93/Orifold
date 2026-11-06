#!/usr/bin/env node
// D30 consistency check: with turning allowed, box (length a, height b) and (b, a) are the same problem.
// Compares fewest folds and, per budget, the smallest opening angle for every swapped pair.
// Usage: node scripts/check-map-mirror.js <map.json>
const fs = require('fs');
const map = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
const at = new Map(map.cells.map(c => [`${c.boxLength},${c.boxHeight}`, c]));
let pairs = 0, statusDiff = 0, foldDiff = 0, spreadOutsideBand = 0, budgetsCompared = 0;
const examples = [];
for (const c of map.cells) {
  if (c.boxLength >= c.boxHeight) continue;
  const m = at.get(`${c.boxHeight},${c.boxLength}`); if (!m) continue;
  pairs++;
  if (c.status !== m.status) { statusDiff++; examples.push({ a: [c.boxLength, c.boxHeight], issue: 'status', s: [c.status, m.status] }); continue; }
  if (c.status !== 'found') continue;
  if (c.minFolds !== m.minFolds) { foldDiff++; examples.push({ a: [c.boxLength, c.boxHeight], issue: 'minFolds', v: [c.minFolds, m.minFolds] }); }
  c.answers.forEach((x, i) => { const y = m.answers[i]; if (!y) return; budgetsCompared++;
    const hi = Math.max(x.quality.spread, y.quality.spread), lo = Math.min(x.quality.spread, y.quality.spread);
    if (lo < 0.9 * hi - 1e-9) { spreadOutsideBand++; if (examples.length < 15) examples.push({ a: [c.boxLength, c.boxHeight], budget: x.budget, issue: 'spread', v: [x.quality.spread, y.quality.spread] }); } });
}
console.log(JSON.stringify({ pairs, statusDiff, foldDiff, budgetsCompared, spreadOutsideBand, examples }, null, 2));
