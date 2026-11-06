'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const zlib = require('node:zlib');
const { toFold, readInput, selectDesign, parseArguments, main } = require('../scripts/export-fold.js');

const fixture = angle => ({ panelLengths: [5, 5, 5, 5], width: 10, angles: [angle, angle, angle] });
function close(a, b, eps = 1e-9) { assert(Math.abs(a - b) <= eps, `${a} != ${b}`); }
function bounds(vertices) {
  return [0, 1, 2].map(axis => Math.max(...vertices.map(v => v[axis] ?? 0)) - Math.min(...vertices.map(v => v[axis] ?? 0)));
}
function distance(a, b) { return Math.hypot(...[0, 1, 2].map(i => (a[i] ?? 0) - (b[i] ?? 0))); }
function assertRigid(fold, eps = 1e-9) {
  const flat = fold.vertices_coords, folded = fold.file_frames[0].vertices_coords;
  for (const face of fold.faces_vertices) {
    // All six distances, including both diagonals, constrain each rectangle.
    for (let i = 0; i < face.length; i++) for (let j = i + 1; j < face.length; j++) {
      close(distance(flat[face[i]], flat[face[j]]), distance(folded[face[i]], folded[face[j]]), eps);
    }
  }
}

test('FOLD 1.1 metadata, flat coordinates, shared topology and counterclockwise faces', () => {
  const fold = toFold(fixture(90));
  assert.equal(fold.file_spec, 1.1);
  assert.equal(fold.file_creator, 'Orifold');
  assert.deepEqual(fold.file_classes, ['singleModel']);
  assert.deepEqual(fold.frame_classes, ['creasePattern']);
  assert.equal(fold.vertices_coords.length, 10);
  assert.equal(fold.edges_vertices.length, 13);
  assert.equal(fold.faces_vertices.length, 4);
  assert.equal(fold.edges_vertices.length, fold.edges_assignment.length);
  assert.equal(fold.edges_vertices.length, fold.edges_foldAngle.length);
  assert(fold.vertices_coords.every(v => v.length === 2));
  assert.deepEqual(bounds(fold.vertices_coords), [20, 10, 0]);
  const edgeKey = (a, b) => [a, b].sort((x, y) => x - y).join(',');
  const incidence = new Map();
  for (const face of fold.faces_vertices) {
    let twiceArea = 0;
    face.forEach((v, i) => {
      const w = face[(i + 1) % face.length], a = fold.vertices_coords[v], b = fold.vertices_coords[w];
      twiceArea += a[0] * b[1] - b[0] * a[1];
      const key = edgeKey(v, w);
      incidence.set(key, (incidence.get(key) ?? 0) + 1);
    });
    close(twiceArea, 100);
  }
  const keys = fold.edges_vertices.map(([a, b]) => edgeKey(a, b));
  assert.equal(new Set(keys).size, keys.length);
  assert.equal(incidence.size, keys.length);
  keys.forEach((key, i) => assert.equal(incidence.get(key), fold.edges_assignment[i] === 'B' ? 1 : 2));
  const frame = fold.file_frames[0];
  assert.equal(fold.file_frames.length, 1); // Root is frame 0; this is frame 1.
  assert.equal(frame.frame_parent, 0);
  assert.equal(frame.frame_inherit, true);
  assert.deepEqual(frame.frame_classes, ['foldedForm']);
  assert.equal(frame.vertices_coords.length, fold.vertices_coords.length);
  assert(frame.vertices_coords.every(v => v.length === 3));
});

test('positive first hinge is V, then M/V alternate with signed degree magnitudes', () => {
  const fold = toFold({ ...fixture(90), angles: [30, 60, 90] });
  assert.deepEqual(fold.edges_assignment.filter(a => a !== 'B'), ['V', 'M', 'V']);
  assert.deepEqual(fold.edges_foldAngle.filter((_, i) => fold.edges_assignment[i] !== 'B'), [30, -60, 90]);
  fold.edges_assignment.forEach((a, i) => { if (a === 'B') assert.equal(fold.edges_foldAngle[i], 0); });
  const points = toFold(fixture(90)).file_frames[0].vertices_coords.filter((_, i) => i % 2 === 0);
  [[0, 0, 0], [5, 0, 0], [5, 0, 5], [10, 0, 5], [10, 0, 10]].forEach((p, i) => p.forEach((x, j) => close(points[i][j], x)));
});

for (const [angle, expected] of [[0, [20, 10, 0]], [90, [10, 10, 10]], [180, [5, 10, 0]]]) {
  test(`GEOMETRY.md ${angle}-degree fixture: dimensions and rigid panels`, () => {
    const fold = toFold(fixture(angle));
    bounds(fold.file_frames[0].vertices_coords).forEach((x, i) => close(x, expected[i]));
    assertRigid(fold);
  });
}

test('placement rotates the folded frame only, preserving all panel distances', () => {
  const design = { panelLengths: [10, 20, 40, 20, 10], width: 7, angles: [60, 90, 90, 60] };
  const unturned = toFold(design), turned = toFold({ ...design, placement: 37 });
  assert.deepEqual(turned.vertices_coords, unturned.vertices_coords);
  assert.deepEqual(turned.edges_foldAngle, unturned.edges_foldAngle);
  const psi = 37 * Math.PI / 180;
  unturned.file_frames[0].vertices_coords.forEach(([x, y, z], i) => {
    const p = turned.file_frames[0].vertices_coords[i];
    close(p[0], x * Math.cos(psi) - z * Math.sin(psi));
    close(p[1], y);
    close(p[2], x * Math.sin(psi) + z * Math.cos(psi));
  });
  assertRigid(turned);
  const upright = toFold({ panelLengths: [100], width: 10, angles: [], placement: 90 });
  bounds(upright.file_frames[0].vertices_coords).forEach((x, i) => close(x, [0, 10, 100][i]));
});

test('rejects malformed geometry while accepting zero-angle kinematic fixtures', () => {
  for (const bad of [null, { ...fixture(90), panelLengths: [] }, { ...fixture(90), panelLengths: [0, 5, 5, 5] },
    { ...fixture(90), width: -1 }, { ...fixture(90), angles: [90] }, { ...fixture(90), angles: [90, NaN, 90] },
    { ...fixture(90), angles: [90, 181, 90] }, { ...fixture(90), placement: Infinity }]) assert.throws(() => toFold(bad));
  assert.doesNotThrow(() => toFold(fixture(0)));
});

test('selects map cells and dataset ids, budgets or answer indices without silently falling back', () => {
  const a = fixture(90), b = fixture(180);
  const row = { id: 'v2-short-0000', answers: [{ budget: 3, design: a }, { budget: 4, design: b }] };
  assert.equal(selectDesign({ cells: [row] }, { cell: 0 }), a);
  assert.equal(selectDesign({ cells: [row] }, { cell: 0, budget: 4 }), b);
  assert.equal(selectDesign([row], { requestId: row.id, answer: 1 }), b);
  assert.equal(selectDesign({ rows: [row] }, { requestId: row.id }), a);
  assert.equal(selectDesign({ design: a }), a);
  assert.equal(selectDesign(a), a);
  assert.throws(() => selectDesign({ cells: [row] }), /select/);
  assert.throws(() => selectDesign([row], { requestId: 'missing' }), /found 0/);
  assert.throws(() => selectDesign([row, row], { requestId: row.id }), /found 2/);
  assert.throws(() => selectDesign({ cells: [row] }, { cell: 0, budget: 5 }), /not found/);
  assert.throws(() => selectDesign({ cells: [row] }, { cell: 0, answer: 2 }), /not found/);
  assert.throws(() => selectDesign({ cells: [row] }, { cell: 2 }), /not found/);
  assert.throws(() => selectDesign({ cells: [row] }, { cell: 0, requestId: row.id }), /either/);
  assert.throws(() => selectDesign(row, { budget: 3, answer: 0 }), /either/);
  assert.throws(() => selectDesign({ status: 'not-found', answers: [] }), /not found/);
});

test('JSON, gzip JSON/JSONL and command-line output work without overwriting input or existing output', () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'orifold-fold-test-'));
  try {
    const design = fixture(90), row = { id: 'example', answers: [{ budget: 3, design }] };
    assert.deepEqual(readInput(JSON.stringify(design)), design);
    const input = path.join(dir, 'dataset.jsonl.gz');
    const data = zlib.gzipSync(JSON.stringify(row) + '\n' + JSON.stringify({ id: 'other', answers: [] }) + '\n');
    fs.writeFileSync(input, data);
    assert.deepEqual(selectDesign(readInput(input), { requestId: 'example' }), design);
    const output = path.join(dir, 'models', 'example.fold');
    main(['--input', input, '--request-id', 'example', '--budget', '3', '-o', output]);
    assert.deepEqual(JSON.parse(fs.readFileSync(output)), toFold(design));
    assert.throws(() => main(['--design', JSON.stringify(design), '-o', output]), /EEXIST/);
    assert.deepEqual(fs.readFileSync(input), data);
    const plain = path.join(dir, 'design.json');
    fs.writeFileSync(plain, JSON.stringify(design));
    assert.deepEqual(readInput(plain), design);
    const single = path.join(dir, 'single.json.gz');
    fs.writeFileSync(single, zlib.gzipSync(JSON.stringify(row)));
    assert.deepEqual(selectDesign(readInput(single), { requestId: 'example' }), design);
    assert.deepEqual(parseArguments([JSON.stringify(design), '-o', 'a.fold']), { input: JSON.stringify(design), output: 'a.fold' });
    assert.throws(() => parseArguments(['--cell', '-1']), /integer/);
    assert.throws(() => parseArguments(['--input']), /missing value/);
    assert.throws(() => parseArguments(['--input', 'a', '--design', '{}']), /duplicate/);
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
});

test('all r6 answers export with the saved placed bounds and preserved panel dimensions', () => {
  const map = readInput(path.resolve(__dirname, '../results/request-map-2026-11-05-r6.json.gz'));
  let count = 0;
  for (const cell of map.cells.filter(c => c.status === 'found')) for (const answer of cell.answers) {
    const fold = toFold(answer.design);
    bounds(fold.file_frames[0].vertices_coords).forEach((x, i) => close(x, answer.quality.dimensions[i], 1e-7));
    assertRigid(fold, 1e-7);
    count++;
  }
  assert.equal(count, 2330);
});
