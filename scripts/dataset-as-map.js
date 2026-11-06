#!/usr/bin/env node
// Present a v2 dataset in the request-map format so the map checks (independent checker, completeness,
// spread) can audit it unchanged. Usage: node scripts/dataset-as-map.js <dataset.jsonl.gz> <out.json[.gz]> [split]
const fs = require('fs'), zlib = require('zlib');
const [input, output, split] = process.argv.slice(2);
if (!input || !output) { console.error('Usage: <dataset.jsonl.gz> <out.json[.gz]> [split]'); process.exit(2); }
if (fs.existsSync(output)) { console.error(`Refusing to overwrite ${output}`); process.exit(1); }
const rows = zlib.gunzipSync(fs.readFileSync(input)).toString().trim().split('\n').map(JSON.parse)
  .filter(r => !split || r.split === split);
const cells = rows.map(r => {
  const L = r.request.length, first = r.answers[0];
  return { id: r.id, split: r.split, kind: r.kind, boxLength: r.request.targetBox[0] / L, boxHeight: r.request.targetBox[2] / L,
    request: r.request, status: r.status, reason: r.reason, minFolds: r.minFolds, answers: r.answers,
    family: first?.family ?? null, design: first?.design ?? null, quality: first?.quality ?? null, handRule: r.handRule };
});
const body = JSON.stringify({ source: input, split: split || 'all', cells }) + '\n';
fs.writeFileSync(output, output.endsWith('.gz') ? zlib.gzipSync(body) : body);
console.log(`${cells.length} rows -> ${output}`);
