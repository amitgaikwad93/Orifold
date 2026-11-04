const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto'), zlib = require('node:zlib');
const { generateRequests } = require('../src/pilot-requests');
const { randomGenerator, search, assess } = require('../src/optimizer');
const root = path.resolve(__dirname, '..');
const destination = path.resolve(process.argv[2] || path.join(root, 'experiments/learning-v1'));
const configPath = path.resolve(process.argv[3] || path.join(root, 'experiments/learning-v1/config.json'));
const configBytes = fs.readFileSync(configPath), config = JSON.parse(configBytes);
const hash = bytes => crypto.createHash('sha256').update(bytes).digest('hex');
const fingerprint = request => [request.width, ...request.targetBox].map(x => (x / request.length).toFixed(10)).join(',');
function shuffle(items, rng) {
  for (let i = items.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [items[i], items[j]] = [items[j], items[i]]; }
  return items;
}

try {
  fs.mkdirSync(destination, { recursive: true });
  for (const file of ['dataset.jsonl.gz', 'dataset.partial.jsonl', 'manifest.json']) {
    if (fs.existsSync(path.join(destination, file))) throw Error(`Refusing to overwrite ${file}; use a fresh output directory.`);
  }
  const started = performance.now(), pools = { 'wide-box': [], 'narrow-tall-box': [] }, impossible = [];
  const total = Object.values(config.splitCounts).reduce((a, b) => a + b);
  if (Object.values(config.splitCounts).some(count => count % 2)) throw Error('Split counts must be even for balanced cohorts.');
  const fingerprints = new Set();
  const pilot = JSON.parse(fs.readFileSync(path.join(root, 'results/pilot-2026-11-04-strict.json')));
  const pilotFingerprints = new Set(pilot.requests.map(row => fingerprint(row.request)));
  for (let batch = 0; Object.values(pools).some(pool => pool.length < total / 2) || impossible.length < config.diagnosticImpossibleCount; batch++) {
    for (const row of generateRequests(config.datasetSeed + batch * 1009)) {
      const key = fingerprint(row.request);
      if (fingerprints.has(key) || pilotFingerprints.has(key)) continue;
      const pool = row.group === 'impossible-width' ? impossible : pools[row.group];
      const limit = row.group === 'impossible-width' ? config.diagnosticImpossibleCount : total / 2;
      if (pool.length >= limit) continue;
      fingerprints.add(key);
      pool.push({ ...row, id: `learning-${batch}-${row.id}`, groupId: key, sourceSeed: config.datasetSeed + batch * 1009 });
    }
  }
  const splitRng = randomGenerator(config.splitSeed), assigned = [];
  for (const pool of Object.values(pools)) {
    shuffle(pool, splitRng);
    let offset = 0;
    for (const [split, count] of Object.entries(config.splitCounts)) {
      assigned.push(...pool.slice(offset, offset + count / 2).map(row => ({ ...row, split })));
      offset += count / 2;
    }
  }
  assigned.push(...impossible.map(row => ({ ...row, split: 'diagnostic-impossible' })));
  const manifest = { version: 1, configSha256: hash(configBytes), generatedAt: new Date().toISOString(),
    splitPolicy: 'Balanced independent normalized requests; no augmented/scaled variants; rounded dimensionless fingerprint prevents duplicates across splits and the pilot.',
    selectionPolicy: 'Splits frozen before label search; solver failures retained, never replaced; only strict-validated successes become imitation labels.',
    assignments: assigned.map(({ id, split, group, groupId, sourceSeed }) => ({ id, split, group, groupId, sourceSeed })) };
  fs.writeFileSync(path.join(destination, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n');
  const partial = path.join(destination, 'dataset.partial.jsonl');
  const counts = {};
  for (let i = 0; i < assigned.length; i++) {
    const row = assigned[i], solverSeed = config.solverSeedBase + i;
    const result = search(row.request, { ...config.solver, seed: solverSeed });
    let label = null;
    if (result.status === 'solved-sampled') {
      const quality = assess(result.design, row.request.targetBox, { fitTolerance: 0, steps: 720 });
      if (!quality.strictPass) throw Error(`Non-strict label at ${row.id}`);
      label = { parameters: result.parameters, design: result.design, quality };
    }
    counts[row.split] ||= { requests: 0, labels: 0, budgetExhausted: 0, analyticallyInfeasible: 0 };
    const count = counts[row.split]; count.requests++; if (label) count.labels++;
    if (result.status === 'budget-exhausted') count.budgetExhausted++;
    if (result.status === 'analytically-infeasible') count.analyticallyInfeasible++;
    fs.appendFileSync(partial, JSON.stringify({ id: row.id, split: row.split, group: row.group, groupId: row.groupId,
      request: row.request, witness: row.witness, label,
      solver: { seed: solverSeed, status: result.status, evaluations: result.evaluations, elapsedMs: result.elapsedMs } }) + '\n');
    if ((i + 1) % 50 === 0) console.log(`Labeled ${i + 1}/${assigned.length} requests in ${((performance.now() - started) / 1000).toFixed(1)}s.`);
  }
  const bytes = fs.readFileSync(partial), compressed = zlib.gzipSync(bytes);
  fs.writeFileSync(path.join(destination, 'dataset.jsonl.gz'), compressed); fs.unlinkSync(partial);
  const summary = { counts, elapsedSeconds: (performance.now() - started) / 1000,
    uncompressedSha256: hash(bytes), compressedSha256: hash(compressed), configSha256: hash(configBytes),
    node: process.version, totalRequests: assigned.length, overlapWithPilot: 0 };
  fs.writeFileSync(path.join(destination, 'dataset-summary.json'), JSON.stringify(summary, null, 2) + '\n');
  console.log(JSON.stringify(summary, null, 2));
} catch (error) { console.error(error.stack); process.exitCode = 1; }
