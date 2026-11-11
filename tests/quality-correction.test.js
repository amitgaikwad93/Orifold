const { test } = require('node:test');
const assert = require('node:assert/strict');
const { qualityCorrect, minOvershoot } = require('../scripts/quality-correction');
const P = require('../src/packing');
const request = { length: 100, width: 10, targetBox: [37, 12, 92] };

test('quality correction: a poking-out start ends valid, wide open, with creases on walls', () => {
  const start = { panelLengths: [50, 50], width: 10, angles: [10] };
  assert.ok(minOvershoot(start, request) > 0);
  const o = qualityCorrect(start, request, [25, 400]);
  const [a, b] = o.results;
  assert.ok(b.passes); assert.equal(b.floating, 0);
  // A longer run may give up a little opening to put creases on walls, but never ends with more floating creases.
  assert.ok(!a.passes || b.floating <= a.floating);
  assert.ok(b.spread > 100, `opening ${b.spread}`);
  assert.ok(o.evaluations <= 400);
});

test('quality correction: improves a start that already fits, and keeps the fold count', () => {
  const start = { panelLengths: [50, 50], width: 10, angles: [170] };   // fits, but folded far tighter than needed
  const before = structuredClone(start); P.wallPlacement(before, request);
  assert.ok(P.assess(before, request).passes);
  const r = qualityCorrect(start, request, [800]).results[0];
  assert.ok(r.passes); assert.equal(r.folds, 1);
  assert.ok(r.spread > 100, `opening ${r.spread}`);
});

test('quality correction: snapshots equal capped runs; zero-fold designs pass through', () => {
  const start = { panelLengths: [30, 40, 30], width: 10, angles: [120, 120] };
  const snap = qualityCorrect(start, request, [50, 400]).results[0], capped = qualityCorrect(start, request, [50]).results[0];
  assert.deepEqual(snap.design.angles, capped.design.angles);
  const flat = qualityCorrect({ panelLengths: [100], width: 10, angles: [] }, { length: 100, width: 10, targetBox: [110, 12, 5] }, [100]);
  assert.equal(flat.evaluations, 0); assert.ok(flat.results[0].passes);
});
