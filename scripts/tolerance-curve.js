#!/usr/bin/env node
// Analysis only (the rules are unchanged): how would a run's pass rate change if a design could poke out of the
// usable box by a tolerance? For each predicted design: best-placement overshoot (fraction of sheet length and of
// the box side), collisions at 721 motion states, and panel rules. Usage: node scripts/tolerance-curve.js <predictions.jsonl>
const fs = require('fs'), zlib = require('zlib');
const P = require('../src/packing');
const { evaluateAccordion } = require('../src/accordion');
const preds = fs.readFileSync(process.argv[2], 'utf8').trim().split('\n').map(JSON.parse);
const rows = new Map(zlib.gunzipSync(fs.readFileSync('experiments/learning-v2b/dataset.jsonl.gz')).toString().trim().split('\n').map(l => { const r = JSON.parse(l); return [r.id, r]; }));
const recs = preds.map(p => {
  const r = rows.get(p.request), req = r.request, d = { ...p.proposed }; delete d.placement; delete d.offset;
  const rulesOk = P.ruleViolations(d, req).length === 0;
  const over = Math.max(0, P.overflowOf(d, req));                    // fraction of sheet length, best placement
  const dims = P.placedDimensions(d), u = P.usable(req.targetBox);
  const overBox = Math.max(0, (dims[0] - u[0]) / u[0], (dims[2] - u[2]) / u[2]);   // fraction of the box side
  const contactFree = evaluateAccordion(d, req.targetBox.map(x => x * 10), { steps: 720 }).noBlockedContactsAtSamples;
  return { rulesOk, contactFree, over, overBox };
});
const tol = [0, 0.0025, 0.005, 0.01, 0.02, 0.03, 0.05, 0.10];
const ok = r => r.rulesOk && r.contactFree;
console.log('answers', recs.length, '| rules + collision-free', recs.filter(ok).length);
for (const t of tol) console.log(`tolerance ${(t * 100).toFixed(2).padStart(6)}%  of sheet: pass ${(recs.filter(r => ok(r) && r.over <= t + 1e-12).length / recs.length * 100).toFixed(1)}%   | of box side: pass ${(recs.filter(r => ok(r) && r.overBox <= t + 1e-12).length / recs.length * 100).toFixed(1)}%`);
