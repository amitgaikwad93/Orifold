const { test } = require('node:test');
const assert = require('node:assert/strict');
const { search, decode, assess, randomGenerator } = require('../src/optimizer');
const compact = { length: 20, width: 10, targetBox: [5, 10, 1] };
const quick = { population: 8, generations: 3, searchSteps: 12, validationSteps: 180, seed: 42 };

test('bounded encoding preserves length and minimum panel widths at corners and random points', () => {
  const rng = randomGenerator(8);
  const vectors = [Array(6).fill(0), Array(6).fill(1), ...Array.from({ length: 100 }, () => Array.from({ length: 6 }, rng))];
  for (const vector of vectors) {
    const design = decode(vector, compact);
    assert.ok(Math.abs(design.panelLengths.reduce((a, b) => a + b) - 20) < 1e-10);
    assert.ok(design.panelLengths.every(x => x >= 1 - 1e-10));
    assert.ok(design.angles.every(x => x >= 0 && x <= 180));
  }
});

test('simple compact request retains a known valid seed and validates motion densely', () => {
  const result = search(compact, quick);
  assert.equal(result.status, 'solved-sampled');
  assert.equal(result.quality.accepted, true);
  assert.equal(result.quality.sampleCount, 181);
  assert.equal(result.evaluations, 32);
});

test('width impossibility is analytically rejected before search', () => {
  const result = search({ ...compact, targetBox: [5, 9, 1] }, quick);
  assert.equal(result.status, 'analytically-infeasible');
  assert.equal(result.evaluations, 0);
  assert.equal(result.design, null);
});

test('unsolved within a small budget is not called impossible', () => {
  const result = search({ length: 20, width: 10, targetBox: [1.1, 10, .1] }, { ...quick, generations: 0 });
  assert.equal(result.status, 'budget-exhausted');
  assert.match(result.reason, /infeasibility is not established/);
});

test('same seed reproduces designs and outcomes independent of timing', () => {
  const a = search(compact, quick), b = search(compact, quick);
  assert.deepEqual(a.design, b.design);
  assert.deepEqual(a.quality, b.quality);
  assert.equal(a.evaluations, b.evaluations);
});

test('optimizer solves a narrow box that cannot contain equal panels', () => {
  const request = { length: 20, width: 10, targetBox: [3, 10, 18] };
  const equal = search(request, {}, 'equal-panels');
  const optimized = search(request);
  assert.equal(equal.status, 'budget-exhausted');
  assert.equal(optimized.status, 'solved-sampled');
  assert.equal(optimized.quality.strictPass, true);
  assert.ok(optimized.design.panelLengths[0] <= 3 + 1e-8);
});

test('random-search comparison receives the same evaluation budget', () => {
  const a = search(compact, quick), b = search(compact, quick, 'random-search');
  assert.equal(a.evaluations, b.evaluations);
  assert.equal(b.quality.accepted, true);
});

test('optional neural initialization preserves candidate budget and records its parameters', () => {
  const initialParameters = [.25, 1/3, .5, 1, 1, 1];
  const cold = search(compact, quick), warm = search(compact, { ...quick, initialParameters });
  assert.equal(warm.evaluations, cold.evaluations);
  assert.deepEqual(warm.config.initialParameters, initialParameters);
  assert.equal(warm.quality.strictPass, true);
  assert.throws(() => search(compact, { ...quick, initialParameters: [1, 2] }));
});

test('1% acceptance is reported separately from strict numerical fit', () => {
  const design = { panelLengths: [5, 5, 5, 5], width: 10, angles: [180, 180, 180] };
  const result = assess(design, [4.98, 10, 1], { steps: 180 });
  assert.equal(result.accepted, true);
  assert.equal(result.strictPass, false);
  assert.ok(result.relativeOverflow[0] > 0);
});

test('collision penalty cannot be hidden by a fitting final box', () => {
  const result = assess({ panelLengths: [6, 4, 4, 8], width: 10, angles: [127, 35, 159] }, [30, 10, 30]);
  assert.equal(result.accepted, false);
  assert.ok(result.blockedSampleCount > 0);
});

test('reject invalid requests, parameters and settings', () => {
  for (const request of [{}, { ...compact, width: 0 }, { ...compact, targetBox: [1, 2] }]) assert.throws(() => search(request, quick));
  assert.throws(() => decode([0, 0], compact));
  assert.throws(() => decode([0, 0, 0, 0, 0, NaN], compact));
  for (const options of [{ population: 3 }, { generations: -1 }, { validationSteps: 1 }, { fitTolerance: .1 }]) {
    assert.throws(() => search(compact, { ...quick, ...options }));
  }
});
