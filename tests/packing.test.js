const { test } = require('node:test');
const assert = require('node:assert/strict');
const { foldAccordion } = require('../src/accordion');
const P = require('../src/packing');
const request = box => ({ length: 100, width: 10, targetBox: box });

test('a single panel (zero folds) is a valid design', () => {
  const design = { panelLengths: [100], width: 10, angles: [] };
  assert.deepEqual(foldAccordion(design).dimensions, [100, 10, 0]);
  const q = P.assess(design, request([110, 12, 5]));
  assert.ok(q.passes); assert.equal(q.folds, 0);
});

test('fit requires a 2% gap on every axis', () => {
  const design = { panelLengths: [50, 50], width: 10, angles: [180] };
  assert.ok(P.assess(design, request([50 / 0.98, 10 / 0.98, 1])).fits);
  assert.ok(!P.assess(design, request([50 / 0.99, 12, 1])).fits);
  assert.ok(!P.assess(design, request([60, 10 / 0.99, 1])).fits);
});

test('rules reject unused creases, short panels and changed length', () => {
  const r = request([60, 12, 60]);
  assert.ok(P.ruleViolations({ panelLengths: [50, 50], width: 10, angles: [0.5] }, r).includes('inactive-or-invalid-crease'));
  assert.ok(P.ruleViolations({ panelLengths: [4, 96], width: 10, angles: [90] }, r).includes('panel-too-short'));
  assert.ok(P.ruleViolations({ panelLengths: [50, 40], width: 10, angles: [90] }, r).includes('length-not-preserved'));
  assert.equal(P.ruleViolations({ panelLengths: Array(13).fill(100 / 13), width: 10, angles: Array(12).fill(180) }, r)[0], 'panel-count');
});

test('order score counts distinct lengths and angles, plus asymmetry', () => {
  assert.equal(P.orderScore({ panelLengths: [25, 25, 25, 25], angles: [180, 180, 180] }), 2);
  assert.equal(P.orderScore({ panelLengths: [10, 40, 40, 10], angles: [90, 90, 90] }), 3);
  assert.equal(P.orderScore({ panelLengths: [10, 30, 30, 30], angles: [90, 170, 170] }), 5);
  assert.equal(P.orderScore({ panelLengths: [100], angles: [] }), 1);
  assert.equal(P.orderScore({ panelLengths: [25, 25.5, 25, 24.5], angles: [90, 90.5, 90] }), 2);
});

test('segment distance handles separation, touching and crossing', () => {
  assert.equal(P.segmentDistance([0, 0], [1, 0], [0, 2], [1, 2]), 2);
  assert.equal(P.segmentDistance([0, 0], [2, 2], [0, 2], [2, 0]), 0);
  assert.ok(Math.abs(P.segmentDistance([0, 0], [1, 0], [2, 0], [3, 0]) - 1) < 1e-12);
});

test('hand rule folds flat into ceil(L / 0.98X) equal panels', () => {
  const h = P.handRule(request([25, 12, 1]));
  assert.equal(h.panelLengths.length, 5);
  assert.ok(P.assess(h, request([25, 12, 1])).passes);
  assert.equal(P.handRule(request([100 / 0.98 + 1, 12, 1])).angles.length, 0);
  assert.equal(P.handRule(request([5, 12, 90])), null);   // would need more than 12 panels
});

test('ranking is a strict priority order', () => {
  const base = { folds: 2, order: 3, minGap: 0.1, sweptArea: 0.5, dimensions: [10, 10, 5] };
  assert.ok(P.compareRanked({ ...base, folds: 1, order: 9 }, base) < 0);
  assert.ok(P.compareRanked({ ...base, order: 2, minGap: 0 }, base) < 0);
  assert.ok(P.compareRanked({ ...base, minGap: 0.2, sweptArea: 9 }, base) < 0);
  assert.ok(P.compareRanked({ ...base, sweptArea: 0.4, dimensions: [20, 10, 5] }, base) < 0);
  assert.ok(P.compareRanked({ ...base, dimensions: [9, 10, 9] }, base) < 0);
});

test('reference solver: analytic infeasibility, zero folds and determinism', () => {
  assert.equal(P.referenceSolve({ length: 100, width: 12, targetBox: [50, 12, 50] }).status, 'analytically-infeasible');
  assert.equal(P.referenceSolve(request([4, 12, 90])).reason, 'first-panel-cannot-fit');
  const flat = P.referenceSolve(request([110, 12, 3]));
  assert.equal(flat.quality.folds, 0);
  const a = P.referenceSolve(request([30, 12, 30])), b = P.referenceSolve(request([30, 12, 30]));
  assert.deepEqual(a.design, b.design);
  assert.ok(a.quality.passes);
});

test('reference solver uses box height to beat the hand rule on a tall box', () => {
  const r = request([12, 12, 40]);
  const ref = P.referenceSolve(r);
  assert.equal(ref.status, 'found');
  assert.ok(ref.quality.passes && ref.quality.sampleCount === 721);
  assert.ok(ref.quality.folds < P.handRule(r).angles.length);
});
