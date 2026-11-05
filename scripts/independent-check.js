#!/usr/bin/env node
'use strict';

// Independent implementation of EXPERIMENT_SPEC.md, Part 2, sections 2–5,
// and the motion/contact policy in GEOMETRY.md. No project code is imported.
// Usage: node scripts/independent-check.js [map.json.gz | map.json]
//        node scripts/independent-check.js --self-test
// Prints JSON; exits 1 for disagreements, 2 for input/usage errors.
const fs = require('node:fs');
const path = require('node:path');
const zlib = require('node:zlib');
const { isDeepStrictEqual } = require('node:util');

const INTERVALS = 720; // 721 configurations, including t = 0 and t = 1.
const DEFAULT_INPUT = path.resolve(__dirname, '../results/request-map-2026-11-05-r4.json.gz');
const finite = Number.isFinite;
const positive = x => finite(x) && x > 0;
const sub = (a, b) => [a[0] - b[0], a[1] - b[1]];
const dot = (a, b) => a[0] * b[0] + a[1] * b[1];
const cross = (a, b) => a[0] * b[1] - a[1] * b[0];
const norm = a => Math.hypot(...a);

// Sorted, minimum-anchored bins: a group spans at most the stated tolerance.
// This avoids chaining many small differences into an arbitrarily wide group.
// The spec does not define clustering for such chains; this convention is
// explicit so this audit is reproducible. Mirror comparisons use the same
// 1%-of-sheet-length tolerance for lengths and 1 degree for angles (D28).
// Zero creases have zero distinct angles.
function distinctCount(values, tolerance) {
  let count = 0, anchor;
  for (const value of [...values].sort((a, b) => a - b)) {
    if (count === 0 || value - anchor > tolerance) {
      anchor = value;
      count++;
    }
  }
  return count;
}

function orderScore(lengths, angles, sheetLength) {
  const tolerance = 0.01 * sheetLength;
  const symmetric = lengths.every((x, i) => Math.abs(x - lengths[lengths.length - 1 - i]) <= tolerance) &&
    angles.every((x, i) => Math.abs(x - angles[angles.length - 1 - i]) <= 1);
  const distinctLengths = distinctCount(lengths, tolerance);
  const distinctAngles = distinctCount(angles, 1);
  return { score: distinctLengths + distinctAngles + Number(!symmetric), distinctLengths, distinctAngles, symmetric };
}

function spread(angles) {
  return angles.length === 0 ? 180 : 180 - Math.max(...angles);
}

function ruleViolations(request, design) {
  const problems = [];
  if (!request || !positive(request.length) || !positive(request.width) ||
      !Array.isArray(request.targetBox) || request.targetBox.length !== 3 ||
      !request.targetBox.every(x => finite(x) && x >= 0)) {
    return ['malformed request: positive sheet dimensions and three nonnegative box dimensions required'];
  }
  if (!design || !Array.isArray(design.panelLengths) || !Array.isArray(design.angles)) {
    return ['malformed design: panelLengths and angles arrays required'];
  }
  const lengths = design.panelLengths, angles = design.angles;
  const eps = 1e-9 * request.length;
  if (lengths.length < 1 || lengths.length > 12) problems.push('panel count outside 1–12');
  if (angles.length !== lengths.length - 1) problems.push('angle count must equal panel count minus one');
  if (!positive(design.width) || Math.abs(design.width - request.width) > eps) problems.push('design width differs from sheet width');
  lengths.forEach((x, i) => {
    if (!positive(x)) problems.push(`panel ${i} is not a positive finite length`);
    else if (x < 0.05 * request.length - eps) problems.push(`panel ${i} is shorter than 5% of sheet length`);
  });
  const sum = lengths.reduce((a, b) => a + b, 0);
  if (!finite(sum) || Math.abs(sum - request.length) > eps) problems.push('panel lengths do not sum to sheet length');
  angles.forEach((x, i) => {
    if (!finite(x) || x < 0 || x > 180) problems.push(`angle ${i} is outside [0, 180] degrees`);
    else if (x < 1) problems.push(`crease ${i} is inactive (angle below 1 degree)`);
  });
  return problems;
}

// First panel fixed on +x. Alternating signed hinge rotations, all scaled by
// the same t; panels span the same y interval, so segment contact in x-z is
// equivalent to contact of the zero-thickness rectangular panels.
function pointsAt(design, t) {
  const points = [[0, 0]];
  let heading = 0;
  for (let i = 0; i < design.panelLengths.length; i++) {
    if (i > 0) heading += (i % 2 ? 1 : -1) * design.angles[i - 1] * t * Math.PI / 180;
    const previous = points[i], length = design.panelLengths[i];
    points.push([previous[0] + length * Math.cos(heading), previous[1] + length * Math.sin(heading)]);
  }
  return points;
}

function dimensions(points, width) {
  return [
    Math.max(...points.map(p => p[0])) - Math.min(...points.map(p => p[0])),
    width,
    Math.max(...points.map(p => p[1])) - Math.min(...points.map(p => p[1]))
  ];
}

function pointSegmentDistance(p, a, b) {
  const v = sub(b, a), w = sub(p, a);
  const t = Math.max(0, Math.min(1, dot(w, v) / dot(v, v)));
  return Math.hypot(w[0] - t * v[0], w[1] - t * v[1]);
}

function segmentContact(a, b, c, d, eps) {
  const ab = sub(b, a), cd = sub(d, c);
  const abLength = norm(ab), cdLength = norm(cd);
  // Signed distances to supporting lines, in length units (not area units).
  const cSide = cross(ab, sub(c, a)) / abLength;
  const dSide = cross(ab, sub(d, a)) / abLength;
  const aSide = cross(cd, sub(a, c)) / cdLength;
  const bSide = cross(cd, sub(b, c)) / cdLength;
  const collinear = [cSide, dSide, aSide, bSide].every(x => Math.abs(x) <= eps);
  if (collinear) {
    const cProjection = dot(sub(c, a), ab) / abLength;
    const dProjection = dot(sub(d, a), ab) / abLength;
    const overlap = Math.min(abLength, Math.max(cProjection, dProjection)) -
      Math.max(0, Math.min(cProjection, dProjection));
    if (overlap > eps) return 'overlap';
    if (overlap >= -eps) return 'touch';
    return null;
  }
  if (((cSide > eps && dSide < -eps) || (cSide < -eps && dSide > eps)) &&
      ((aSide > eps && bSide < -eps) || (aSide < -eps && bSide > eps))) return 'crossing';
  // Also catch shallow-angle crossings below the signed-distance tolerance.
  if (cSide * dSide < 0 && aSide * bSide < 0) return 'crossing';
  if (Math.min(pointSegmentDistance(a, c, d), pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b), pointSegmentDistance(d, a, b)) <= eps) return 'touch';
  return null;
}

function blockedContacts(points, eps, flatEndpoint) {
  const contacts = [];
  for (let i = 0; i < points.length - 1; i++) {
    for (let j = i + 1; j < points.length - 1; j++) {
      const kind = segmentContact(points[i], points[i + 1], points[j], points[j + 1], eps);
      if (!kind) continue;
      // Adjacent straight segments can only meet away from their shared hinge
      // if they overlap. Do not silently exempt adjacent partial flat stacks.
      if (j === i + 1 && kind === 'touch') continue;
      if (flatEndpoint && (kind === 'overlap' || kind === 'touch')) continue;
      contacts.push({ panels: [i, j], kind });
    }
  }
  return contacts;
}

function auditAnswer(request, answer) {
  const design = answer?.design, saved = answer?.quality || {}, budget = answer?.budget;
  const problems = ruleViolations(request, design);
  const disagreements = [];
  const add = (check, detail) => disagreements.push({ check, ...detail });
  if (!Number.isInteger(budget) || budget < 0 || budget > 11) {
    add('fold-budget', { budget: budget ?? null, reason: 'budget must be an integer from 0 to 11' });
  }
  if (problems.length) add('panel-and-angle-rules', { violations: problems });
  // Invalid scalar values cannot be used for geometry, but other finite rule
  // failures (short panels, inactive creases, wrong total) are still evaluated.
  const canCompute = request && positive(request.length) && positive(request.width) && design &&
    Array.isArray(design.panelLengths) && design.panelLengths.length > 0 &&
    design.panelLengths.every(positive) && positive(design.width) &&
    Array.isArray(design.angles) && design.angles.length === design.panelLengths.length - 1 &&
    design.angles.every(finite) && Array.isArray(request.targetBox) &&
    request.targetBox.length === 3 && request.targetBox.every(x => finite(x) && x >= 0);
  if (!canCompute) {
    add('geometry-and-score', { reason: 'cannot evaluate malformed geometry or request' });
    return { disagreements, sampledStates: 0 };
  }

  const folds = design.panelLengths.length - 1;
  const order = orderScore(design.panelLengths, design.angles, request.length);
  const opening = spread(design.angles);
  if (Number.isInteger(budget) && folds > budget) add('fold-budget', { budget, computedFolds: folds });
  if (saved.folds !== folds) add('fold-count', { saved: saved.folds ?? null, computed: folds });
  if (saved.order !== order.score) add('order-score', { saved: saved.order ?? null, computed: order });
  if (saved.symmetric !== order.symmetric) add('symmetry', { saved: saved.symmetric ?? null, computed: order.symmetric });
  if (!finite(saved.spread) || Math.abs(saved.spread - opening) > 1e-9) {
    add('spread', { saved: saved.spread ?? null, computed: opening, numericalTolerance: 1e-9 });
  }

  const finalDimensions = dimensions(pointsAt(design, 1), design.width);
  const limits = request.targetBox.map(x => 0.98 * x);
  const fitEps = 1e-9 * Math.max(request.length, request.width, ...request.targetBox);
  const fits = finalDimensions.every((x, i) => x <= limits[i] + fitEps);
  if (!fits || saved.fits !== fits) add('box-fit', {
    saved: saved.fits ?? null, computed: fits, dimensions: finalDimensions, limits, numericalTolerance: fitEps
  });
  if (!Array.isArray(saved.dimensions) || saved.dimensions.length !== 3 ||
      saved.dimensions.some((x, i) => !finite(x) || Math.abs(x - finalDimensions[i]) > fitEps)) {
    add('saved-dimensions', { saved: saved.dimensions ?? null, computed: finalDimensions });
  }

  const eps = 1e-9 * request.length;
  const allFlat = design.angles.length > 0 && design.angles.every(a => a === 180);
  let blockedSamples = 0, blockedPairs = 0, firstBlocked = null;
  for (let step = 0; step <= INTERVALS; step++) {
    const contacts = blockedContacts(pointsAt(design, step / INTERVALS), eps, step === INTERVALS && allFlat);
    if (contacts.length) {
      blockedSamples++;
      blockedPairs += contacts.length;
      if (!firstBlocked) firstBlocked = { step, progress: step / INTERVALS, contacts };
    }
  }
  const contactFree = blockedSamples === 0;
  if (!contactFree || saved.contactFree !== contactFree) add('motion-contacts', {
    saved: saved.contactFree ?? null, computed: contactFree, blockedSamples, blockedPairs, firstBlocked
  });
  const valid = problems.length === 0 && contactFree;
  if (saved.valid !== valid) add('valid', { saved: saved.valid ?? null, computed: valid });
  if (saved.passes !== (valid && fits)) add('passes', { saved: saved.passes ?? null, computed: valid && fits });
  if (saved.sampleCount !== INTERVALS + 1) add('sample-count', { saved: saved.sampleCount ?? null, computed: INTERVALS + 1 });
  return { disagreements, sampledStates: INTERVALS + 1, folds, order: order.score };
}

function auditCell(cell) {
  const disagreements = [];
  const minFolds = cell.minFolds;
  const validMinimum = Number.isInteger(minFolds) && minFolds >= 0 && minFolds <= 11;
  if (!validMinimum) disagreements.push({ check: 'min-folds', saved: minFolds ?? null,
    reason: 'minFolds must be an integer from 0 to 11' });
  const answers = Array.isArray(cell.answers) ? cell.answers : [];
  const expectedBudgets = validMinimum ? Array.from({ length: Math.min(11, minFolds + 2) - minFolds + 1 }, (_, i) => minFolds + i) : null;
  const budgets = answers.map(answer => answer?.budget ?? null);
  if (!Array.isArray(cell.answers) || answers.length === 0 ||
      (validMinimum && !isDeepStrictEqual(budgets, expectedBudgets))) {
    disagreements.push({ check: 'budget-sequence', saved: budgets, expected: expectedBudgets,
      reason: 'answers must cover consecutive budgets minFolds through minFolds + 2, capped at 11' });
  }
  if (answers.length === 0 || !cell.design || !isDeepStrictEqual(cell.design, answers[0]?.design)) {
    disagreements.push({ check: 'top-level-design', reason: 'top-level design must equal the first answer design' });
  }
  let sampledStates = 0, passingAnswers = 0;
  const checkedAnswers = answers.map((answer, answerIndex) => {
    const checked = auditAnswer(cell.request, answer);
    sampledStates += checked.sampledStates;
    if (checked.disagreements.length === 0) passingAnswers++;
    disagreements.push(...checked.disagreements.map(issue => ({ answerIndex, budget: answer?.budget ?? null, ...issue })));
    return checked;
  });
  return { disagreements, sampledStates, checkedAnswers, passingAnswers };
}

function auditMap(map, input) {
  if (!Array.isArray(map.cells) || map.cells.length === 0) throw new Error('input must contain a nonempty cells array');
  const result = {
    input,
    policy: {
      source: 'EXPERIMENT_SPEC.md sections 2–5; DECISIONS.md D26–D29; GEOMETRY.md contact policy',
      motionStates: INTERVALS + 1,
      boxFraction: 0.98,
      contactTolerance: '1e-9 * requested sheet length',
      fitTolerance: '1e-9 * max(sheet dimensions, box dimensions)',
      orderGrouping: 'sorted bins spanning at most 1% of sheet length / 1 degree',
      symmetry: 'palindromic lengths within 1% of sheet length AND angles within 1 degree',
      spread: '180 degrees minus largest fold angle; 180 degrees with no folds; numerical tolerance 1e-9 degree',
      budgets: 'every answer checked; consecutive minFolds through minFolds + 2, capped at 11; folds <= budget',
      scoreHistograms: 'computed over all answers',
      scope: 'checks saved designs and scores; does not establish global ranking optimality or continuous collision freedom'
    },
    totalCells: map.cells.length,
    solvedCells: 0, skippedCells: 0, sampledStates: 0,
    checkedAnswers: 0, passingAnswers: 0, disagreementAnswers: 0,
    passingCells: 0, disagreementCells: 0, disagreementsByCheck: {},
    foldCounts: {}, orderScores: {}, disagreements: []
  };
  map.cells.forEach((cell, index) => {
    if (cell.status !== 'found') { result.skippedCells++; return; }
    result.solvedCells++;
    const checked = auditCell(cell);
    result.sampledStates += checked.sampledStates;
    result.checkedAnswers += checked.checkedAnswers.length;
    result.passingAnswers += checked.passingAnswers;
    result.disagreementAnswers += checked.checkedAnswers.length - checked.passingAnswers;
    for (const answer of checked.checkedAnswers) {
      if (answer.folds !== undefined) result.foldCounts[answer.folds] = (result.foldCounts[answer.folds] || 0) + 1;
      if (answer.order !== undefined) result.orderScores[answer.order] = (result.orderScores[answer.order] || 0) + 1;
    }
    if (checked.disagreements.length === 0) { result.passingCells++; return; }
    result.disagreementCells++;
    for (const issue of checked.disagreements) result.disagreementsByCheck[issue.check] = (result.disagreementsByCheck[issue.check] || 0) + 1;
    result.disagreements.push({ index, boxLength: cell.boxLength, boxHeight: cell.boxHeight,
      targetBox: cell.request?.targetBox, issues: checked.disagreements });
  });
  if (result.solvedCells === 0) throw new Error('input has no solved cells (status "found")');
  return result;
}

function selfTest() {
  const assert = require('node:assert/strict');
  const eps = 1e-7;
  assert.equal(segmentContact([0, 0], [2, 2], [0, 2], [2, 0], eps), 'crossing');
  assert.equal(segmentContact([0, 0], [2, 0], [1, 0], [3, 0], eps), 'overlap');
  assert.equal(segmentContact([0, 0], [1, 0], [1, 0], [2, 1], eps), 'touch');
  assert.equal(segmentContact([0, 0], [1, 0], [2, 0], [3, 0], eps), null);
  assert.equal(segmentContact([0, 0], [1, 0], [0, 2 * eps], [1, 2 * eps], eps), null);
  assert.equal(segmentContact([0, 0], [1, 0], [0, eps / 2], [1, eps / 2], eps), 'overlap');
  assert.equal(blockedContacts([[0, 0], [1, 0], [1, 1]], eps, false).length, 0);
  assert.equal(blockedContacts([[0, 0], [2, 0], [1, 0]], eps, false).length, 1);
  assert.equal(blockedContacts([[0, 0], [2, 0], [1, 0]], eps, true).length, 0);
  assert(blockedContacts([[0, 0], [1, 0], [1, 1], [0, 0]], eps, false)
    .some(c => c.panels[0] === 0 && c.panels[1] === 2 && c.kind === 'touch'));
  assert(blockedContacts([[0, 0], [2, 2], [0, 2], [2, 0]], eps, true)
    .some(c => c.kind === 'crossing')); // Flat-end permission never permits crossings.

  const request = { length: 100, width: 10, targetBox: [110, 12, 110] };
  const design = { panelLengths: [25, 25, 25, 25], width: 10, angles: [90, 90, 90] };
  const dims = dimensions(pointsAt(design, 1), 10);
  assert(Math.abs(dims[0] - 50) < eps && Math.abs(dims[2] - 50) < eps);
  assert.deepEqual(ruleViolations(request, design), []);
  assert(ruleViolations(request, { ...design, angles: [0.999, 90, 90] }).some(x => x.includes('inactive')));
  assert(ruleViolations(request, { ...design, angles: [181, 90, 90] }).some(x => x.includes('outside')));
  assert(ruleViolations(request, { ...design, panelLengths: [4, 32, 32, 32] }).some(x => x.includes('5%')));
  assert(ruleViolations(request, { ...design, panelLengths: [25, 25, 25, 26] }).some(x => x.includes('sum')));
  assert(ruleViolations(request, { ...design, angles: [90] }).some(x => x.includes('angle count')));
  assert.equal(orderScore([100], [], 100).score, 1);
  assert.equal(orderScore([25, 25, 25, 25], [90, 90, 90], 100).score, 2);
  assert.equal(orderScore([30, 35, 35], [150, 178], 100).score, 5);
  assert.equal(orderScore([49.5, 50.5], [180], 100).score, 2); // Inclusive threshold.
  assert.equal(distinctCount([10, 10.75, 11.5], 1), 2); // No transitive chaining.
  const differentFirstAngle = orderScore([25, 25, 25, 25], [60, 90, 90], 100);
  assert.equal(differentFirstAngle.symmetric, false);
  assert.equal(differentFirstAngle.score, 4); // Equal panels alone are insufficient (D28).
  const palindromicFivePanels = orderScore([10, 20, 40, 20, 10], [60, 90, 90, 60], 100);
  assert.equal(palindromicFivePanels.symmetric, true);
  assert.equal(palindromicFivePanels.score, 5); // Odd-panel point symmetry counts.
  assert.equal(orderScore([25, 25, 25, 25], [91, 90, 90], 100).symmetric, true);
  assert.equal(orderScore([25, 25, 25, 25], [91.01, 90, 90], 100).symmetric, false);
  assert.equal(orderScore([49.49, 50.51], [90], 100).symmetric, false);
  assert.equal(spread([]), 180);
  assert.equal(spread([180]), 0);
  assert.equal(spread([10, 170, 50]), 10); // Largest angle, not first or mean angle.

  function cell(d, box, order) {
    const minFolds = d.angles.length;
    const quality = { folds: minFolds, order, symmetric: orderScore(d.panelLengths, d.angles, 100).symmetric,
      spread: spread(d.angles), fits: true, valid: true, passes: true,
      contactFree: true, dimensions: dimensions(pointsAt(d, 1), 10), sampleCount: 721 };
    const answers = Array.from({ length: Math.min(11, minFolds + 2) - minFolds + 1 }, (_, i) => ({
      budget: minFolds + i, design: structuredClone(d), quality: i === 0 ? quality : structuredClone(quality)
    }));
    return { status: 'found', minFolds, answers, request: { ...request, targetBox: box }, design: d, quality };
  }
  const flat = { panelLengths: [50, 50], width: 10, angles: [180] };
  assert.deepEqual(auditCell(cell(flat, [52, 12, 0], 2)).disagreements, []);
  const partial = { panelLengths: [30, 35, 35], width: 10, angles: [180, 90] };
  assert(auditCell(cell(partial, [110, 12, 110], 5)).disagreements.some(x => x.check === 'motion-contacts'));
  const unfolded = { panelLengths: [100], width: 10, angles: [] };
  assert(auditCell(cell(unfolded, [101, 12, 1], 1)).disagreements.some(x => x.check === 'box-fit'));
  assert.deepEqual(auditCell(cell(unfolded, [100 / 0.98, 10 / 0.98, 0], 1)).disagreements, []);
  const wrong = cell(flat, [52, 12, 0], 2);
  wrong.quality.order = 3;
  wrong.quality.folds = 2;
  assert.deepEqual(auditCell(wrong).disagreements.map(x => x.check), ['fold-count', 'order-score']);
  const report = auditMap({ cells: [cell(flat, [52, 12, 0], 2), wrong, { status: 'not-found' }] }, 'fixture');
  assert.equal(report.solvedCells, 2);
  assert.equal(report.skippedCells, 1);
  assert.equal(report.disagreementCells, 1);
  assert.equal(report.sampledStates, 4326);
  assert.equal(report.checkedAnswers, 6);
  assert.equal(report.passingAnswers, 5);
  assert.equal(report.disagreementAnswers, 1);

  const changedScore = cell(flat, [52, 12, 0], 2);
  changedScore.answers[1].quality.symmetric = false;
  changedScore.answers[1].quality.spread = 10;
  const scoreIssues = auditCell(changedScore).disagreements;
  assert.deepEqual(scoreIssues.map(x => x.check), ['symmetry', 'spread']);
  assert(scoreIssues.every(x => x.answerIndex === 1 && x.budget === 2));
  const changedGeometry = cell(flat, [52, 12, 0], 2);
  changedGeometry.answers[2].design.angles = [0.5];
  const geometryIssues = auditCell(changedGeometry).disagreements;
  assert(geometryIssues.some(x => x.check === 'panel-and-angle-rules' && x.answerIndex === 2));
  assert(geometryIssues.some(x => x.check === 'box-fit' && x.answerIndex === 2));
  const changedContact = cell(flat, [110, 12, 110], 2);
  changedContact.answers[2] = { budget: 3, design: partial, quality: cell(partial, [110, 12, 110], 5).quality };
  assert(auditCell(changedContact).disagreements.some(x => x.check === 'motion-contacts' && x.answerIndex === 2));

  const missingAnswer = cell(flat, [52, 12, 0], 2);
  missingAnswer.answers.pop();
  assert(auditCell(missingAnswer).disagreements.some(x => x.check === 'budget-sequence'));
  const duplicateBudget = cell(flat, [52, 12, 0], 2);
  duplicateBudget.answers[1].budget = 1;
  assert(auditCell(duplicateBudget).disagreements.some(x => x.check === 'budget-sequence'));
  const exceededBudget = cell(flat, [52, 12, 0], 2);
  exceededBudget.answers[1].budget = 0;
  assert(auditCell(exceededBudget).disagreements.some(x => x.check === 'fold-budget' && x.answerIndex === 1));
  const invalidBudget = cell(flat, [52, 12, 0], 2);
  invalidBudget.answers[1].budget = 2.5;
  assert(auditCell(invalidBudget).disagreements.some(x => x.check === 'fold-budget'));
  const differentTop = cell(flat, [52, 12, 0], 2);
  differentTop.design = { ...flat, angles: [179] };
  assert.deepEqual(auditCell(differentTop).disagreements.map(x => x.check), ['top-level-design']);
  const noAnswers = cell(flat, [52, 12, 0], 2);
  delete noAnswers.answers;
  assert(auditCell(noAnswers).disagreements.some(x => x.check === 'budget-sequence'));
  const invalidMinimum = cell(flat, [52, 12, 0], 2);
  invalidMinimum.minFolds = -1;
  assert(auditCell(invalidMinimum).disagreements.some(x => x.check === 'min-folds'));
  for (const folds of [10, 11]) {
    const stack = { panelLengths: Array(folds + 1).fill(100 / (folds + 1)), width: 10, angles: Array(folds).fill(180) };
    const capped = cell(stack, [110, 12, 0], 2);
    assert.deepEqual(capped.answers.map(a => a.budget), folds === 10 ? [10, 11] : [11]);
    assert.deepEqual(auditCell(capped).disagreements, []);
  }
  assert.throws(() => auditMap({ cells: [{ status: 'not-found' }] }, 'fixture'), /no solved cells/);
  process.stdout.write('Independent checker self-tests passed.\n');
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 1 && args[0] === '--self-test') return selfTest();
  if (args.length > 1 || args.some(a => a.startsWith('-'))) throw new Error('usage: node scripts/independent-check.js [map.json.gz | map.json] or --self-test');
  const input = args.length ? path.resolve(args[0]) : DEFAULT_INPUT;
  const bytes = fs.readFileSync(input);
  const json = bytes[0] === 0x1f && bytes[1] === 0x8b ? zlib.gunzipSync(bytes) : bytes;
  const report = auditMap(JSON.parse(json.toString('utf8')), input);
  process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  process.exitCode = report.disagreementCells ? 1 : 0;
}

if (require.main === module) {
  try { main(); } catch (error) {
    process.stderr.write(`Independent checker failed: ${error.message}\n`);
    process.exitCode = 2;
  }
}
