const fs = require('node:fs'), path = require('node:path'), os = require('node:os');
const { search } = require('../src/optimizer');
const { generateRequests } = require('../src/pilot-requests');

const methods = ['equal-panels', 'random-search', 'differential-evolution'];
const config = { seed: 20261104, population: 24, generations: 40,
  searchSteps: 30, validationSteps: 720, fitTolerance: Number(process.argv[3] ?? 0) };
const quantile = (values, p) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.ceil(p * sorted.length) - 1];
};
const mean = values => values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;

function summarize(rows) {
  const summary = {};
  for (const method of methods) {
    const feasibleRows = rows.filter(row => row.witness);
    const results = feasibleRows.map(row => row.results[method]);
    const accepted = results.filter(result => result.status === 'solved-sampled');
    summary[method] = {
      feasibleRequests: results.length, solved: accepted.length,
      strictPasses: accepted.filter(result => result.quality.strictPass).length,
      budgetExhausted: results.filter(result => result.status === 'budget-exhausted').length,
      medianMs: quantile(results.map(result => result.elapsedMs), .5),
      p95Ms: quantile(results.map(result => result.elapsedMs), .95),
      meanMs: mean(results.map(result => result.elapsedMs)),
      meanNormalizedRotationForSolved: mean(accepted.map(result => result.quality.normalizedRotation)),
      meanEvaluations: mean(results.map(result => result.evaluations)),
      returnedCandidatesWithBlockedSamples: results.filter(result => result.quality?.blockedSampleCount > 0).length,
      rejectedImpossibleWidth: rows.filter(row => row.group === 'impossible-width' && row.results[method].status === 'analytically-infeasible').length,
      byGroup: Object.fromEntries(['wide-box', 'narrow-tall-box'].map(group => {
        const subset = rows.filter(row => row.group === group).map(row => row.results[method]);
        return [group, { total: subset.length, solved: subset.filter(result => result.status === 'solved-sampled').length,
          strictPasses: subset.filter(result => result.quality?.strictPass).length }];
      })),
    };
  }
  return summary;
}

try {
  const started = performance.now(), generatedAt = new Date().toISOString();
  const requests = generateRequests(config.seed);
  const generationMs = performance.now() - started;
  // Discard explicit warm-ups; rotate method order per request to reduce ordering bias.
  for (const method of methods) search(requests[0].request, config, method);
  const rows = [];
  for (let i = 0; i < requests.length; i++) {
    const row = { ...requests[i], searchSeed: config.seed + i + 1, results: {} };
    for (let k = 0; k < methods.length; k++) {
      const method = methods[(i + k) % methods.length];
      // Witness data and labels are deliberately not passed to the solver.
      row.results[method] = search(row.request, { ...config, seed: row.searchSeed }, method);
    }
    rows.push(row);
    if ((i + 1) % 10 === 0) console.log(`Completed ${i + 1}/100 requests (${((performance.now() - started) / 1000).toFixed(1)}s).`);
  }
  const summary = summarize(rows);
  const report = { version: 1, generatedAt, datasetSeed: config.seed, config,
    hardware: { cpu: os.cpus()[0]?.model, logicalCpusVisible: os.cpus().length, availableParallelism: os.availableParallelism?.(),
      platform: os.platform(), architecture: os.arch(), node: process.version, execution: 'single Node process, sequential requests; visible CPU count is not a resource allocation guarantee' },
    generationMs, totalElapsedMs: performance.now() - started,
    caveats: ['Zero thickness; 721 sampled configurations are not continuous collision certification.',
      '80 requests are feasible under this evaluator via withheld witnesses; 20 violate the invariant width.',
      `${config.fitTolerance * 100}% per-axis fit tolerance; strict numerical pass reported separately.`,
      'Equal-panels baseline is a fully closed equal-panel stack, not an optimized equal-panel family.',
      'Both search methods share three canonical seeds and the same 984-evaluation budget.',
      'Squared hinge rotation is a secondary mathematical preference, not an energy or stress model.',
      'This is one fixed-seed pilot, not a training/test split or proof of optimizer optimality.'],
    summary, requests: rows };
  const destination = process.argv[2] || 'artifacts/pilot.json';
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.writeFileSync(destination, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ destination, totalElapsedSeconds: report.totalElapsedMs / 1000, summary }, null, 2));
} catch (error) { console.error(error.stack); process.exitCode = 1; }
