#!/usr/bin/env node
// "Model + correction" (development experiment): start from a proposed design and run a short deterministic
// search (free-form pattern search over all panel lengths and angles, same fold count) until it fits and is
// contact-free; then place it on the walls and assess. Reads/writes JSON lines like assess-designs.js.
// Reports the search effort so the correction can be compared with solving from scratch.
const readline = require('readline');
const P = require('../src/packing');
const rl = readline.createInterface({ input: process.stdin });
const budgetArg = Number(process.argv[2] || 400);
rl.on('line', line => {
  if (!line.trim()) return;
  const { id, request, design } = JSON.parse(line);
  const t = Date.now(); let d = design, evaluations = 0, repaired = false;
  const n = design.panelLengths.length;
  if (n >= 2 && P.overflowOf({ ...design }, request) > 0) {
    const fam = P.freeFamily(n, request, false);
    const score = (s => p => { evaluations++; return s(p); })(((family) => p => {
      const x = family.build(p); if (P.ruleViolations(x, request).length) return Infinity;
      const o = P.overflowOf(x, request); if (o > 0) return o; return P.motionMetrics(x, 30).blockedSamples ? 1e-6 : 0; })(fam));
    const start = fam.encode(design).map(v => Math.min(1, Math.max(0, v)));
    // patternSearch expects a family with bounds; reuse the free family.
    const r = (function search() { const minStep = fam.bounds.map(() => 1 / 2000);
      let point = start, best = score(point), step = fam.bounds.map(() => 0.02), used = 0;
      while (best > 0 && step.some((s, i) => s >= minStep[i]) && used < budgetArg) { let moved = false;
        for (let i = 0; i < point.length && !moved; i++) for (const sg of [1, -1]) { const tr = point.map((x, k) => k === i ? Math.min(1, Math.max(0, x + sg * step[i])) : x);
          const v = score(tr); used++; if (v < best) { point = tr; best = v; moved = true; break; } }
        if (!moved) step = step.map(s => s / 2); }
      return { point, best }; })();
    d = fam.build(r.point); repaired = true;
  }
  const w = P.wallPlacement(d, request);
  const q = w.overflow > 0 ? null : P.assess(d, request);
  process.stdout.write(JSON.stringify({ id, passes: !!q && q.passes, repaired, evaluations, ms: Date.now() - t,
    floating: q ? P.floatingAt(d, request) : null, spread: q ? q.spread : null, design: d }) + '\n');
});
