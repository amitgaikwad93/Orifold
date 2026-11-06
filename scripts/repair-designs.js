#!/usr/bin/env node
// Version 2: exact score-call budget, canonical final acceptance, and reusable search.
// Final fit/contact assessment remains the evaluator's original 2% / 721-state policy.
const P = require('../src/packing');
const { performance } = require('node:perf_hooks');

function repair(design, request, budget = 400) {
  if (!Number.isInteger(budget) || budget < 0) throw Error('budget must be a nonnegative integer');
  const started = performance.now();
  let d = structuredClone(design), evaluations = 0, repaired = false;
  P.wallPlacement(d, request);
  let q = P.assess(d, request);
  if (!q.passes && d.panelLengths.length >= 2 && budget > 0 && !P.ruleViolations(d, request).length) {
    const fam = P.freeFamily(d.panelLengths.length, request, false);
    const score = point => {
      if (evaluations >= budget) throw Error('score budget exhausted');
      evaluations++;
      const x = fam.build(point);
      if (P.ruleViolations(x, request).length) return Infinity;
      const over = P.overflowOf(x, request);
      return over > 0 ? over : (P.motionMetrics(x, 30).blockedSamples ? 1e-6 : 0);
    };
    let point = fam.encode(d).map(x => Math.min(1, Math.max(0, x)));
    let best = score(point), step = fam.bounds.map(() => .02);
    const minimum = 1 / 2000;
    while (best > 0 && step.some(x => x >= minimum) && evaluations < budget) {
      let moved = false;
      for (let i = 0; i < point.length && !moved && evaluations < budget; i++) {
        for (const sign of [1, -1]) {
          if (evaluations >= budget) break;
          const trial = point.map((x, j) => j === i ? Math.min(1, Math.max(0, x + sign * step[i])) : x);
          const value = score(trial);
          if (value < best) { point = trial; best = value; moved = true; break; }
        }
      }
      if (!moved) step = step.map(x => x / 2);
    }
    d = fam.build(point); repaired = true;
    P.wallPlacement(d, request); q = P.assess(d, request);
  }
  return { passes: q.passes, repaired, evaluations, ms: performance.now() - started,
    floating: P.floatingAt(d, request), spread: q.spread, folds: q.folds, quality: q, design: d };
}

module.exports = { repair };
if (require.main === module) {
  const readline = require('node:readline');
  const budget = process.argv[2] === undefined ? 400 : Number(process.argv[2]);
  readline.createInterface({ input: process.stdin }).on('line', line => {
    if (!line.trim()) return;
    const { id, request, design } = JSON.parse(line);
    process.stdout.write(JSON.stringify({ id, ...repair(design, request, budget) }) + '\n');
  });
}
