const { test } = require('node:test');
const assert = require('node:assert/strict');
const { foldAccordion, checkContacts, evaluateAccordion } = require('../src/accordion');
const { foldSheet } = require('../demo/geometry');
const base = { panelLengths: [5, 5, 5, 5], width: 10, angles: [180, 180, 180] };
const crossing = { panelLengths: [6, 4, 4, 8], width: 10, angles: [127, 35, 159] };
const near = (actual, expected, tolerance = 1e-8) => assert.ok(Math.abs(actual - expected) <= tolerance, `${actual} != ${expected}`);
const distance = (a, b) => Math.hypot(...a.map((x, i) => x - b[i]));

test('four-panel analytical configurations use cumulative alternating rotations', () => {
  for (const [angle, section, box] of [
    [0, [[0, 0], [5, 0], [10, 0], [15, 0], [20, 0]], [20, 10, 0]],
    [90, [[0, 0], [5, 0], [5, 5], [10, 5], [10, 10]], [10, 10, 10]],
    [180, [[0, 0], [5, 0], [0, 0], [5, 0], [0, 0]], [5, 10, 0]],
  ]) {
    const g = foldAccordion({ ...base, angles: [angle, angle, angle] });
    g.section.forEach((p, i) => p.forEach((x, j) => near(x, section[i][j])));
    g.dimensions.forEach((x, i) => near(x, box[i]));
    near(g.area, 200);
  }
});

test('two-panel chain reproduces the existing independent one-hinge reference', () => {
  for (const crease of [3, 10, 17]) for (const angle of [0, 37, 90, 143, 180]) {
    const old = foldSheet({ length: 20, width: 10, crease, angle });
    const chain = foldAccordion({ panelLengths: [crease, 20 - crease], width: 10, angles: [angle] });
    chain.dimensions.forEach((x, i) => near(x, old.dimensions[i]));
    const oldOrder = [0, 3, 1, 4, 2, 5];
    chain.vertices.forEach((v, i) => v.forEach((x, j) => near(x, old.vertices[oldOrder[i]][j])));
  }
});

test('unequal panels preserve all face distances and shared hinge endpoints during motion', () => {
  const design = { panelLengths: [3, 8, 2, 7], width: 6, angles: [140, 85, 170] };
  const flat = foldAccordion(design, 0);
  for (let step = 0; step <= 180; step++) {
    const g = foldAccordion(design, step / 180);
    for (const face of g.faces) for (const a of face) for (const b of face) {
      near(distance(g.vertices[a], g.vertices[b]), distance(flat.vertices[a], flat.vertices[b]));
    }
    assert.deepEqual(g.vertices.slice(0, 4), flat.vertices.slice(0, 4)); // entire first panel fixed
    for (let i = 0; i < g.faces.length - 1; i++) {
      assert.deepEqual(g.faces[i].filter(v => g.faces[i + 1].includes(v)).sort(), [2 * i + 2, 2 * i + 3]);
    }
    near(g.area, 120);
    g.vertices.forEach(v => v.forEach((x, i) => assert.ok(x >= g.min[i] && x <= g.max[i])));
  }
});

test('unequal flat stack may extend behind the starting edge', () => {
  const g = foldAccordion({ ...base, panelLengths: [2, 8, 3, 7] });
  assert.deepEqual(g.section, [[0, 0], [2, 0], [-6, 0], [-3, 0], [-10, 0]]);
  assert.deepEqual(g.dimensions, [12, 10, 0]);
});

test('ordinary shared hinges are allowed; fully closed stacks report their idealized contacts', () => {
  assert.deepEqual(checkContacts(foldAccordion(base, 0)).blocked, []);
  const report = evaluateAccordion(base, [5, 10, 1]);
  assert.equal(report.passesSampledChecks, true);
  assert.equal(report.sampleCount, 181);
  assert.equal(report.finalContacts.allowedStackContacts.length, 6);
  assert.equal(report.assumptions.layerOrderValidated, false);
  assert.equal(report.assumptions.continuousCollisionGuarantee, false);
});

test('proper nonadjacent crossings are rejected even when final box fits', () => {
  const contacts = checkContacts(foldAccordion(crossing));
  assert.deepEqual(contacts.blocked, [{ panels: [0, 3], kind: 'crossing' }]);
  const report = evaluateAccordion(crossing, [30, 10, 30]);
  assert.equal(report.endpointFits, true);
  assert.equal(report.passesSampledChecks, false);
  assert.ok(report.blockedSamples[0].progress > 0 && report.blockedSamples[0].progress < 1);
  assert.equal(report.blockedSamples.at(-1).progress, 1);
});

test('partial-stack overlaps and nonadjacent touches are conservatively blocked', () => {
  const contacts = checkContacts(foldAccordion({ ...base, angles: [180, 0, 180] }));
  assert.ok(contacts.blocked.some(c => c.kind === 'overlap'));
  assert.ok(contacts.blocked.some(c => c.kind === 'touch' && c.panels[1] - c.panels[0] > 1));
  assert.deepEqual(contacts.allowedStackContacts, []);
});

test('box fit is independent of contacts and width cannot contract', () => {
  const report = evaluateAccordion(base, [4, 9, 1]);
  assert.equal(report.noBlockedContactsAtSamples, true);
  assert.equal(report.endpointFits, false);
  assert.equal(report.passesSampledChecks, false);
  assert.deepEqual(report.overflow, [1, 1, 0]);
});

test('sampled swept envelope is distinct from the final storage box', () => {
  const report = evaluateAccordion(base, [5, 10, 1]);
  assert.equal(report.endpointFits, true);
  near(report.sampledSweptBox.dimensions[0], 20);
  near(report.sampledSweptBox.dimensions[2], 10);
  assert.equal(report.assumptions.enclosureMotionChecked, false);
  assert.equal(report.assumptions.singleActuatorValidated, false);
});

test('scaling preserves fit/contact results and scales length and area correctly', () => {
  for (const scale of [0.001, 3, 1000]) {
    const scaled = { panelLengths: crossing.panelLengths.map(v => v * scale), width: crossing.width * scale, angles: crossing.angles };
    const a = foldAccordion(crossing), b = foldAccordion(scaled);
    b.dimensions.forEach((x, i) => near(x, a.dimensions[i] * scale));
    near(b.area, a.area * scale * scale);
    assert.deepEqual(checkContacts(b).blocked, checkContacts(a).blocked);
  }
});

test('rejects malformed designs, targets, progress and sample counts', () => {
  for (const patch of [{ panelLengths: [] }, { panelLengths: [0, 5] }, { panelLengths: [5, Infinity] },
    { panelLengths: [1e-12, 5, 5, 5] }, { width: 0 }, { width: NaN }, { angles: [90] },
    { angles: [0, -1, 0] }, { angles: [180, 181, 180] }, { angles: [NaN, 0, 0] }]) {
    assert.throws(() => foldAccordion({ ...base, ...patch }));
  }
  for (const progress of [-1, 1.01, Infinity, NaN]) assert.throws(() => foldAccordion(base, progress));
  for (const box of [[], [1, 2], [1, 0, 3], [1, 2, NaN]]) assert.throws(() => evaluateAccordion(base, box));
  for (const steps of [0, -1, 1.5, 10001]) assert.throws(() => evaluateAccordion(base, [5, 10, 1], { steps }));
});
