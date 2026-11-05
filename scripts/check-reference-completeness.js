#!/usr/bin/env node
// Independent check of the reference solver: for sampled map cells, run a free-form randomized
// search (any panel lengths, any angles) with ONE FEWER fold than the reference found.
// A pass there means the reference's ordered families missed a design with fewer folds.
// Usage: node scripts/check-reference-completeness.js <map.json> <output.json> [oneFoldSamples=40] [seeds=3]
const fs = require('fs');
const { foldAccordion } = require('../src/accordion');
const { assess, ruleViolations, motionMetrics, usable, RULES } = require('../src/packing');
const { randomGenerator } = require('../src/optimizer');
const [mapPath, output, samplesArg = '60', seedsArg = '3'] = process.argv.slice(2);
if (!mapPath || !output) { console.error('Usage: <map.json> <output.json> [samples] [seeds]'); process.exit(2); }
if (fs.existsSync(output)) { console.error(`Refusing to overwrite ${output}`); process.exit(1); }
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));

function decode(v, n, request) {
  const min = RULES.minPanelFraction; let remaining = 1 - min * n; const lengths = [];
  for (let i = 0; i < n - 1; i++) { const a = remaining * v[i]; remaining -= a; lengths.push((min + a) * request.length); }
  lengths.push((min + remaining) * request.length);
  return { panelLengths: lengths, width: request.width, angles: v.slice(n - 1).map(x => 1 + 179 * x) };
}
function score(design, request) {
  if (ruleViolations(design, request).length) return 1e9;
  const d = foldAccordion(design).dimensions, u = usable(request.targetBox);
  const over = d.reduce((s, x, i) => s + Math.max(0, (x - u[i]) / request.length) ** 2, 0);
  if (over > 0) return 1 + over;
  return motionMetrics(design, 30).blockedSamples ? 0.5 : 0;   // 0 = fits and contact-free at 31 samples
}
function freeSearch(n, request, seed, population = 40, generations = 120) {
  if (n === 1) { const design = decode([], 1, request), quality = assess(design, request); return quality.passes ? { design, quality } : null; }
  const rng = randomGenerator(seed), dims = 2 * n - 2;
  let pop = Array.from({ length: population }, () => Array.from({ length: dims }, rng));
  let fit = pop.map(v => score(decode(v, n, request), request));
  for (let g = 0; g < generations; g++) {
    for (let i = 0; i < population; i++) {
      const [a, b, c] = [0, 0, 0].map(() => pop[Math.floor(rng() * population)]), j = Math.floor(rng() * dims);
      const trial = pop[i].map((x, k) => (k === j || rng() < 0.8) ? Math.min(1, Math.max(0, a[k] + 0.7 * (b[k] - c[k]))) : x);
      const s = score(decode(trial, n, request), request);
      if (s <= fit[i]) { pop[i] = trial; fit[i] = s; }
      if (fit[i] === 0) {
        const design = decode(pop[i], n, request), quality = assess(design, request);
        if (quality.passes) return { design, quality };
        fit[i] = 0.5;  // failed the dense check; keep searching
      }
    }
  }
  return null;
}
// Every cell needing 2+ folds, plus an evenly spaced sample of one-fold cells.
const multi = map.cells.filter(c => c.status === 'found' && c.quality.folds >= 2);
const single = map.cells.filter(c => c.status === 'found' && c.quality.folds === 1);
const step = Math.max(1, Math.floor(single.length / Number(samplesArg)));
const sample = [...multi, ...single.filter((_, i) => i % step === 0).slice(0, Number(samplesArg))];
const started = Date.now(), records = [];
for (const cell of sample) {
  const n = cell.quality.folds;   // panels = folds + 1, so n panels means one fewer fold
  const found = [];
  for (let s = 0; s < Number(seedsArg); s++) { const r = freeSearch(n, cell.request, 9000 + s); if (r) found.push({ seed: 9000 + s, ...r }); }
  records.push({ boxLength: cell.boxLength, boxHeight: cell.boxHeight, referenceFolds: cell.quality.folds,
    fewerFoldsFound: found.length > 0, seedsFinding: found.map(f => f.seed), example: found[0]?.design ?? null });
}
const summary = { sampled: records.length, seedsPerCell: Number(seedsArg),
  referenceBeaten: records.filter(r => r.fewerFoldsFound).length, elapsedMs: Date.now() - started };
fs.writeFileSync(output, JSON.stringify({ map: mapPath, summary, records }, null, 2) + '\n');
console.log(JSON.stringify(summary));
