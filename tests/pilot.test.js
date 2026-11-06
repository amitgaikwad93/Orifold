const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { assess } = require('../src/optimizer');
const report = JSON.parse(fs.readFileSync(path.join(__dirname, '../results/pilot-2026-11-04-strict.json'), 'utf8'));

test('recorded pilot has the stated cohort sizes and no hidden-witness result substitution', () => {
  assert.equal(report.requests.length, 100);
  assert.equal(new Set(report.requests.map(row => row.id)).size, 100);
  for (const [group, count] of [['wide-box', 40], ['narrow-tall-box', 40], ['impossible-width', 20]]) {
    assert.equal(report.requests.filter(row => row.group === group).length, count);
  }
  for (const row of report.requests.filter(row => row.witness)) {
    assert.equal(row.results['random-search'].evaluations, 984);
    assert.equal(row.results['differential-evolution'].evaluations, 984);
    assert.notDeepEqual(row.results['differential-evolution'].design, row.witness);
  }
});

test('all strict-pilot optimizer results revalidate from the stored designs', () => {
  for (const row of report.requests) {
    const result = row.results['differential-evolution'];
    if (row.group === 'impossible-width') {
      assert.ok(row.request.width > row.request.targetBox[1]);
      assert.equal(result.status, 'analytically-infeasible');
      continue;
    }
    assert.equal(assess(row.witness, row.request.targetBox, { fitTolerance: 0 }).strictPass, true);
    const audited = assess(result.design, row.request.targetBox, { fitTolerance: 0 });
    assert.equal(audited.strictPass, true, row.id);
    assert.equal(audited.blockedSampleCount, 0, row.id);
  }
});
