const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), zlib = require('node:zlib');
const { decode, assess } = require('../src/optimizer');
const root = path.join(__dirname, '../experiments/learning-v1');
const read = name => JSON.parse(fs.readFileSync(path.join(root, name)));
const sha = data => crypto.createHash('sha256').update(data).digest('hex');

test('frozen predictions, dataset and checkpoint have matching provenance and disjoint splits', () => {
  const config = read('config.json'), manifest = read('manifest.json'), predictions = read('run/test-predictions.json');
  const bytes = zlib.gunzipSync(fs.readFileSync(path.join(root, 'dataset.jsonl.gz')));
  const rows = bytes.toString().trim().split('\n').map(line => JSON.parse(line));
  assert.equal(sha(bytes), predictions.datasetSha256);
  assert.equal(sha(fs.readFileSync(path.join(root, 'config.json'))), predictions.configSha256);
  assert.equal(sha(fs.readFileSync(path.join(root, 'run/checkpoint.pt'))), predictions.checkpointSha256);
  assert.equal(new Set(manifest.assignments.map(row => row.groupId)).size, 1100);
  for (const [split, count] of Object.entries(config.splitCounts)) assert.equal(rows.filter(row => row.split === split).length, count);
  const assignments = new Map(manifest.assignments.map(row => [row.id, row]));
  for (const row of predictions.rows) {
    assert.ok(['test', 'diagnostic-impossible'].includes(row.split));
    assert.equal(assignments.get(row.id).split, row.split);
  }
  assert.equal(read('run/training-summary.json').testUsedDuringTraining, false);
});

test('saved network outcomes reproduce with the original geometry evaluator', () => {
  const predictions = read('run/test-predictions.json'), summary = read('run/evaluation-summary.json');
  let strict = 0, relaxed = 0, collisions = 0;
  for (const row of predictions.rows.filter(row => row.split === 'test')) {
    const quality = assess(decode(row.parameters, row.request), row.request.targetBox);
    strict += quality.strictPass; relaxed += quality.accepted; collisions += quality.blockedSampleCount > 0;
  }
  assert.equal(strict, summary.summary.network.strictPasses);
  assert.equal(relaxed, summary.summary.network.passesWithin1Pct);
  assert.equal(collisions, summary.summary.network.collisionFailures);
  const raw = zlib.gunzipSync(fs.readFileSync(path.join(root, 'run/test-evaluation.jsonl.gz')));
  assert.equal(sha(raw), summary.rawEvaluationSha256);
});
