#!/usr/bin/env node
// Experiment v2 request-space map: reference solver and hand rule over a grid of box shapes.
// Usage: node scripts/request-map.js <output.json>
// Box width is set wider than the sheet (width never contracts and does not affect the fold).
const fs = require('fs'), path = require('path');
const { referenceSolve, handRule, assess, RULES } = require('../src/packing');
const output = process.argv[2];
if (!output) { console.error('Usage: node scripts/request-map.js <output.json>'); process.exit(2); }
if (fs.existsSync(output)) { console.error(`Refusing to overwrite ${output}`); process.exit(1); }
const L = 100, W = 10, boxWidth = 12;
const lengths = [], heights = [];
for (let x = 0.04; x <= 1.08 + 1e-9; x += 0.04) lengths.push(+x.toFixed(2));
for (let z = 0.02; z <= 1.06 + 1e-9; z += 0.04) heights.push(+z.toFixed(2));
const cells = [], started = Date.now();
for (const bz of heights) for (const bx of lengths) {
  const request = { length: L, width: W, targetBox: [bx * L, boxWidth, bz * L] };
  const ref = referenceSolve(request), hand = handRule(request);
  const handQuality = hand ? assess(hand, request) : null;
  cells.push({ boxLength: bx, boxHeight: bz, request, status: ref.status, reason: ref.reason ?? null,
    family: ref.family ?? null, design: ref.design ?? null, quality: ref.quality ?? null, elapsedMs: ref.elapsedMs,
    handRule: hand ? { design: hand, folds: hand.angles.length, passes: handQuality.passes } : null });
}
fs.mkdirSync(path.dirname(output), { recursive: true });
fs.writeFileSync(output, JSON.stringify({ created: new Date().toISOString(), rules: RULES,
  sheet: { length: L, width: W }, boxWidth, lengths, heights, elapsedMs: Date.now() - started, cells }) + '\n');
const count = s => cells.filter(c => c.status === s).length;
console.log(`cells ${cells.length}: found ${count('found')}, not-found ${count('not-found')}, infeasible ${count('analytically-infeasible')}, ${((Date.now() - started) / 1000).toFixed(1)} s`);
