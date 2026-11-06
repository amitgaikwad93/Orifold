const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), zlib = require('node:zlib');
const { search, decode, assess } = require('../src/optimizer');
const directory = path.resolve(process.argv[2] || 'experiments/learning-v1');
const runDirectory = path.resolve(process.argv[3] || path.join(directory, 'run'));
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const median = values => [...values].sort((a, b) => a-b)[Math.floor(values.length/2)];
const p95 = values => [...values].sort((a, b) => a-b)[Math.ceil(values.length*.95)-1];
const within1pct = result => result.quality.blockedSampleCount === 0 && result.quality.relativeOverflow.every(x => x <= .01+1e-9);
const methods = ['equal-panels', 'random-search', 'optimizer-full', 'optimizer-short', 'network-initialized-short'];

try {
  if (fs.existsSync(path.join(runDirectory, 'evaluation-summary.json'))) throw Error('Evaluation exists; do not overwrite a frozen test result.');
  const config = JSON.parse(fs.readFileSync(path.join(directory, 'config.json')));
  const predictions = JSON.parse(fs.readFileSync(path.join(runDirectory, 'test-predictions.json')));
  const dataBytes = zlib.gunzipSync(fs.readFileSync(path.join(directory, 'dataset.jsonl.gz')));
  const dataset = dataBytes.toString().trim().split('\n').map(line => JSON.parse(line));
  if (hash(dataBytes) !== predictions.datasetSha256 || hash(fs.readFileSync(path.join(runDirectory, 'checkpoint.pt'))) !== predictions.checkpointSha256 ||
      hash(fs.readFileSync(path.join(directory, 'config.json'))) !== predictions.configSha256) throw Error('Experiment provenance mismatch.');
  const heldOut = dataset.filter(row => row.split === 'test');
  const predicted = new Map(predictions.rows.map(row => [row.id, row]));
  if (heldOut.length !== config.splitCounts.test || new Set(predictions.rows.map(row => row.id)).size !== predictions.rows.length) throw Error('Invalid held-out cohort.');
  const started = performance.now(), rows = [];
  // Explicit warm-up on a training request, not a test row.
  search(dataset.find(row => row.split === 'train').request, config.solver);
  for (let i = 0; i < heldOut.length; i++) {
    const source = heldOut[i], prediction = predicted.get(source.id);
    if (!prediction || prediction.split !== 'test' || JSON.stringify(prediction.request) !== JSON.stringify(source.request)) throw Error('Prediction/request mismatch.');
    const row = { id: source.id, group: source.group, request: source.request, results: {} };
    let before = performance.now();
    const design = decode(prediction.parameters, source.request);
    const quality = assess(design, source.request.targetBox, { fitTolerance: .01, steps: config.evaluation.validationSteps });
    const validationMs = performance.now()-before;
    row.results.network = { design, parameters: prediction.parameters, quality,
      inferenceMs: prediction.medianInferenceMs, validationMs, elapsedMs: prediction.medianInferenceMs+validationMs };
    for (let k = 0; k < methods.length; k++) {
      const name = methods[(i+k) % methods.length];
      const settings = { ...config.solver, seed: config.evaluation.seedBase+i };
      if (name.includes('short')) settings.generations = config.evaluation.shortSearchGenerations;
      if (name === 'network-initialized-short') settings.initialParameters = prediction.parameters;
      const result = search(source.request, settings, name === 'equal-panels' || name === 'random-search' ? name : 'differential-evolution');
      if (!result.quality) throw Error('An evaluator-feasible test request was analytically rejected.');
      row.results[name] = { status: result.status, design: result.design, quality: result.quality, evaluations: result.evaluations,
        optimizerMs: result.elapsedMs, elapsedMs: result.elapsedMs+(name === 'network-initialized-short' ? prediction.medianInferenceMs : 0) };
    }
    rows.push(row);
    if ((i+1) % 15 === 0) console.log(`Evaluated ${i+1}/${heldOut.length} frozen test requests in ${((performance.now()-started)/1000).toFixed(1)}s.`);
  }
  const summary = {};
  for (const method of ['network', ...methods]) {
    const results = rows.map(row => row.results[method]);
    const strict = results.filter(r => r.quality.strictPass);
    summary[method] = { requests: results.length, strictPasses: strict.length,
      passesWithin1Pct: results.filter(within1pct).length,
      collisionFailures: results.filter(r => r.quality.blockedSampleCount > 0).length,
      fitFailuresAt1Pct: results.filter(r => r.quality.relativeOverflow.some(x => x > .01+1e-9)).length,
      medianElapsedMs: median(results.map(r => r.elapsedMs)), p95ElapsedMs: p95(results.map(r => r.elapsedMs)),
      medianMaxRelativeOverflow: median(results.map(r => Math.max(...r.quality.relativeOverflow))),
      meanRotationOnStrictSuccesses: strict.length ? strict.reduce((sum, r) => sum+r.quality.normalizedRotation, 0)/strict.length : null,
      byGroup: Object.fromEntries(['wide-box', 'narrow-tall-box'].map(group => {
        const subset = rows.filter(row => row.group === group).map(row => row.results[method]);
        return [group, { count: subset.length, strictPasses: subset.filter(r => r.quality.strictPass).length, passesWithin1Pct: subset.filter(within1pct).length }];
      })) };
  }
  const impossible = predictions.rows.filter(row => row.split === 'diagnostic-impossible');
  const diagnostic = { count: impossible.length, rejectedByWidthInvariant: impossible.filter(row => row.request.width > row.request.targetBox[1]).length,
    note: 'These rejections follow a geometric invariant, not a learned feasibility classifier.' };
  const failures = rows.filter(row => !within1pct(row.results.network)).sort((a, b) =>
    Math.max(...b.results.network.quality.relativeOverflow)-Math.max(...a.results.network.quality.relativeOverflow))
    .slice(0, 10).map(row => ({ id: row.id, group: row.group, request: row.request, network: row.results.network }));
  const raw = Buffer.from(rows.map(row => JSON.stringify(row)).join('\n')+'\n');
  fs.writeFileSync(path.join(runDirectory, 'test-evaluation.jsonl.gz'), zlib.gzipSync(raw));
  const report = { checkpointSha256: predictions.checkpointSha256, datasetSha256: predictions.datasetSha256,
    configSha256: predictions.configSha256, rawEvaluationSha256: hash(raw), generatedAt: new Date().toISOString(),
    node: process.version, elapsedSeconds: (performance.now()-started)/1000, summary, diagnostic,
    networkMedianInferenceMs: median(rows.map(row => row.results.network.inferenceMs)),
    failureExamples: failures,
    notes: ['Test set first evaluated after validation-selected checkpoint was frozen; no post-test tuning in this experiment.',
      'Raw network latency and checked network latency are separate. Model load excluded; hybrid latency includes network inference.',
      'Full searches score 984 candidates; paired short searches score 264. The neural seed replaces one random population member with equal random draws and budgets.',
      'All acceptance metrics use the original Node geometry reference at 721 states. Sampling is not continuous collision proof.',
      'Timing varies with hardware and runtime; these are within-distribution synthetic test requests.'] };
  fs.writeFileSync(path.join(runDirectory, 'evaluation-summary.json'), JSON.stringify(report, null, 2)+'\n');
  console.log(JSON.stringify({ elapsedSeconds: report.elapsedSeconds, networkMedianInferenceMs: report.networkMedianInferenceMs, summary, diagnostic }, null, 2));
} catch (error) { console.error(error.stack); process.exitCode = 1; }
