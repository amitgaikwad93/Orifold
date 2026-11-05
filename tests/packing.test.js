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

test('order score counts distinct lengths and angles, plus asymmetry of lengths AND angles', () => {
  assert.equal(P.orderScore({ panelLengths: [25, 25, 25, 25], angles: [180, 180, 180] }), 2);
  assert.equal(P.orderScore({ panelLengths: [10, 40, 40, 10], angles: [90, 90, 90] }), 3);
  assert.equal(P.orderScore({ panelLengths: [10, 30, 30, 30], angles: [90, 170, 170] }), 5);
  assert.equal(P.orderScore({ panelLengths: [100], angles: [] }), 1);
  assert.equal(P.orderScore({ panelLengths: [25, 25.5, 25, 24.5], angles: [90, 90.5, 90] }), 2);
  // Equal panels but a different first angle: not symmetric (D28).
  assert.equal(P.orderScore({ panelLengths: [25, 25, 25, 25], angles: [120, 160, 160] }), 4);
  assert.ok(P.isSymmetric({ panelLengths: [10, 40, 40, 10], angles: [120, 160, 120] }));
  assert.ok(!P.isSymmetric({ panelLengths: [25, 25, 25, 25], angles: [120, 160, 160] }));
});

test('spread is the smallest opening angle between neighbouring panels', () => {
  assert.equal(P.spreadOf({ angles: [] }), 180);
  assert.equal(P.spreadOf({ angles: [150, 170, 120] }), 10);
  assert.equal(P.spreadOf({ angles: [180, 180] }), 0);
});

test('segment distance handles separation, touching and crossing', () => {
  assert.equal(P.segmentDistance([0, 0], [1, 0], [0, 2], [1, 2]), 2);
  assert.equal(P.segmentDistance([0, 0], [2, 2], [0, 2], [2, 0]), 0);
  assert.ok(Math.abs(P.segmentDistance([0, 0], [1, 0], [2, 0], [3, 0]) - 1) < 1e-12);
});

test('hand rule folds flat into ceil(L / 0.98 x longer box side) equal panels', () => {
  const h = P.handRule(request([25, 12, 1]));
  assert.equal(P.handRule(request([10, 12, 30])).placement, 90);   // stands the stack upright when height is longer
  assert.equal(h.panelLengths.length, 5);
  assert.ok(P.assess(h, request([25, 12, 1])).passes);
  assert.equal(P.handRule(request([100 / 0.98 + 1, 12, 1])).angles.length, 0);
  assert.equal(P.handRule(request([5, 12, 90])).angles.length, 1);   // stands upright: 2 panels of 50
  assert.equal(P.handRule(request([5, 12, 5])), null);               // would need more than 12 panels
});

test('ranking: 10% spread band, then symmetry, fewer folds, order, spread', () => {
  const m = o => ({ folds: 3, order: 4, symmetric: false, spread: 20, minGap: 0.1, sweptArea: 0.5, dimensions: [10, 10, 5], ...o });
  const a = m({ spread: 20 }), b = m({ spread: 19, symmetric: true });
  assert.equal(P.rankDesigns([a, b])[0], b);                       // within 10%: symmetric wins
  const c = m({ spread: 15, symmetric: true });
  assert.equal(P.rankDesigns([a, c])[0], a);                       // outside the band: spread wins
  const d = m({ spread: 18.5, folds: 2 });
  assert.equal(P.rankDesigns([a, d])[0], d);                       // in band, both asymmetric: fewer folds
  const e = m({ spread: 18.5, order: 3 });
  assert.equal(P.rankDesigns([a, e])[0], e);                       // then order score
  assert.equal(P.rankDesigns([a, m({ spread: 19 })])[0], a);       // then wider spread
});

test('reference solver: analytic infeasibility, zero folds and determinism', () => {
  assert.equal(P.referenceSolve({ length: 100, width: 12, targetBox: [50, 12, 50] }).status, 'analytically-infeasible');
  // A box shorter than any panel is solvable once the shape may be turned upright (D30).
  const tall = P.referenceSolve(request([4, 12, 90]));
  assert.equal(tall.status, 'found'); assert.ok(tall.quality.passes);
  const flat = P.referenceSolve(request([110, 12, 3]));
  assert.equal(flat.quality.folds, 0);
  const budgets = P.referenceSolveBudgets(request([20, 12, 30]));
  assert.deepEqual(budgets.answers.map(x => x.budget), [budgets.minFolds, budgets.minFolds + 1, budgets.minFolds + 2]);
  for (const x of budgets.answers) assert.ok(x.quality.passes && x.quality.folds <= x.budget);
  // A larger budget never gives a narrower smallest opening angle.
  for (let i = 1; i < budgets.answers.length; i++) assert.ok(budgets.answers[i].quality.spread >= budgets.answers[i - 1].quality.spread * 0.9 - 1e-9);
  const a = P.referenceSolve(request([30, 12, 30])), b = P.referenceSolve(request([30, 12, 30]));
  assert.deepEqual(a.design, b.design);
  assert.ok(a.quality.passes);
});

test('reference solver beats the flat-stack hand rule by using both box dimensions', () => {
  const r = request([20, 12, 30]);   // hand rule (upright allowed): 3 folds
  const ref = P.referenceSolve(r);
  assert.equal(ref.status, 'found');
  assert.ok(ref.quality.passes && ref.quality.sampleCount === 721);
  assert.ok(ref.quality.folds < P.handRule(r).angles.length);
});

test('placement: the final shape may turn about the hinge axis to fit (D30)', () => {
  const design = { panelLengths: [100], width: 10, angles: [] };
  assert.ok(P.overflowOf(design, request([10, 12, 103])) <= 0);
  assert.equal(design.placement, 90);
  assert.ok(P.assess(design, request([10, 12, 103])).passes);
  assert.ok(!P.assess({ ...design, placement: 0 }, request([10, 12, 103])).fits);
});

test('swapping box length and height gives the same fold count and similar spread (D30)', () => {
  const a = P.referenceSolveBudgets(request([12, 12, 42])), b = P.referenceSolveBudgets(request([42, 12, 12]));
  assert.equal(a.minFolds, b.minFolds);
  a.answers.forEach((x, i) => assert.ok(Math.abs(x.quality.spread - b.answers[i].quality.spread) <= 0.1 * Math.max(x.quality.spread, b.answers[i].quality.spread)));
});

test('creases on walls (D34): wall placement puts a V-shape crease on a wall', () => {
  const r = request([37, 12, 92]);
  const d = { panelLengths: [50, 50], width: 10, angles: [37] };
  const w = P.wallPlacement(d, r);
  assert.ok(w.overflow <= 0);
  assert.equal(w.floating, 0);
  assert.equal(P.floatingAt(d, r), 0);
  assert.ok(P.assess(d, r).passes);
  const mid = { panelLengths: [50, 50], width: 10, angles: [37], placement: 0, offset: [0, 0] };
  assert.equal(P.floatingAt({ ...mid, angles: [90] }, request([60, 12, 60])), 0);   // L in a corner: crease on the wall
});
