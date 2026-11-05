#!/usr/bin/env node
// Independent check of the reference's spread (D27): for sampled cells and each fold budget, a free-form
// randomized search (any panel lengths and angles, exactly budget+1 panels) maximizes the smallest
// opening angle (since D34, among designs with every crease on a wall). If it finds a valid design wider than the reference's band (10%), the reference
// missed a meaningfully more spread design.
// Usage: node scripts/check-reference-spread.js <map.json> <output.json> [cells=60] [seeds=3]
const fs = require('fs');
const { assess, ruleViolations, motionMetrics, overflowOf, wallPlacement, floatingAt, spreadOf, RULES } = require('../src/packing');
const { randomGenerator } = require('../src/optimizer');
const [mapPath, output, cellsArg = '60', seedsArg = '3'] = process.argv.slice(2);
if (!mapPath || !output) { console.error('Usage: <map.json> <output.json> [cells] [seeds]'); process.exit(2); }
if (fs.existsSync(output)) { console.error(`Refusing to overwrite ${output}`); process.exit(1); }
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
function decode(v, n, request) {
  const min = RULES.minPanelFraction; let remaining = 1 - min * n; const lengths = [];
  for (let i = 0; i < n - 1; i++) { const a = remaining * v[i]; remaining -= a; lengths.push((min + a) * request.length); }
  lengths.push((min + remaining) * request.length);
  return { panelLengths: lengths, width: request.width, angles: v.slice(n - 1).map(x => 1 + 179 * x) };
}
function score(design, request) {          // higher is better; >= 0 means valid at 31 samples
  if (ruleViolations(design, request).length) return -1e9;
  const over = Math.max(0, overflowOf(design, request));   // best placement angle (D30), recorded on the design
  if (over > 0) return -2 - over;
  if (motionMetrics(design, 30).blockedSamples) return -1;
  if (RULES.creasesOnWalls) {   // D34: only designs with every crease on a wall compete
    const w = wallPlacement(design, request);
    if (w.overflow > 0) return -1;
    if (w.floating > 0) return -0.5 - Math.min(0.4, 10 * w.distance);
  }
  return spreadOf(design) / 180;
}
function search(n, request, seed, population = 40, generations = 200) {
  const rng = randomGenerator(seed), dims = 2 * n - 2;
  let pop = Array.from({ length: population }, () => Array.from({ length: dims }, rng));
  let fit = pop.map(v => score(decode(v, n, request), request));
  for (let g = 0; g < generations; g++) for (let i = 0; i < population; i++) {
    const [a, b, c] = [0, 0, 0].map(() => pop[Math.floor(rng() * population)]), j = Math.floor(rng() * dims);
    const trial = pop[i].map((x, k) => (k === j || rng() < 0.8) ? Math.min(1, Math.max(0, a[k] + 0.7 * (b[k] - c[k]))) : x);
    const s = score(decode(trial, n, request), request);
    if (s >= fit[i]) { pop[i] = trial; fit[i] = s; }
  }
  const order = fit.map((f, i) => [f, i]).sort((x, y) => y[0] - x[0]);
  for (const [f, i] of order.slice(0, 5)) {       // best few, confirmed at 721 samples
    if (f < 0) break;
    const design = decode(pop[i], n, request); overflowOf(design, request);
    if (RULES.creasesOnWalls) wallPlacement(design, request);
    const q = assess(design, request);
    if (q.passes && (!RULES.creasesOnWalls || q.floatingCreases === 0)) return { design, spread: q.spread };
  }
  return null;
}
const found = map.cells.filter(c => c.status === 'found' && c.minFolds >= 1);
const step = Math.max(1, Math.floor(found.length / Number(cellsArg)));
const sample = found.filter((_, i) => i % step === 0).slice(0, Number(cellsArg));
const started = Date.now(), records = [];
for (const cell of sample) for (const ans of cell.answers) {
  let best = null;
  for (let s = 0; s < Number(seedsArg); s++) { const r = search(ans.budget + 1, cell.request, 5000 + s); if (r && (!best || r.spread > best.spread)) best = r; }
  const ref = ans.quality.spread;
  records.push({ boxLength: cell.boxLength, boxHeight: cell.boxHeight, budget: ans.budget, referenceSpread: ref,
    freeSpread: best?.spread ?? null, beyondBand: !!best && best.spread > ref / (1 - RULES.spreadTieBand) + 1e-6,
    example: best?.design ?? null });
}
const withFree = records.filter(r => r.freeSpread !== null);
const summary = { cellBudgetsChecked: records.length, freeFoundValid: withFree.length,
  referenceWiderOrEqual: withFree.filter(r => r.referenceSpread >= r.freeSpread - 1e-6).length,
  freeWiderWithinBand: withFree.filter(r => r.freeSpread > r.referenceSpread + 1e-6 && !r.beyondBand).length,
  freeWiderBeyondBand: withFree.filter(r => r.beyondBand).length, seeds: Number(seedsArg), elapsedMs: Date.now() - started };
fs.writeFileSync(output, JSON.stringify({ map: mapPath, summary, records }, null, 2) + '\n');
console.log(JSON.stringify(summary));
