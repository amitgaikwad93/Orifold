#!/usr/bin/env node
// Summarize experiments/quality-correction-v1 (see PLAN.md). Writes results/summary.json and gzips merged records.
const fs = require('fs'), zlib = require('zlib'), path = require('path');
const P = require('../src/packing');
const DIR = 'experiments/quality-correction-v1/results', V = 'experiments/validation-v1/results';
const gz = f => zlib.gunzipSync(fs.readFileSync(f)).toString().trim().split('\n').map(JSON.parse);
const ref = new Map(gz(path.join(V, 'reference-cached.jsonl.gz')).map(r => [r.id, r]));
const opening = d => d.angles.length ? 180 - Math.max(...d.angles) : 180;
const STARTS = ['seed-17-adam', 'seed-29-adam', 'seed-43-adam', 'nearest', 'simple'], CAPS = [25, 50, 100, 200, 400, 800, 1600, 3200];
const data = {};
for (const s of STARTS) {
  const merged = path.join(DIR, `${s}.jsonl.gz`);
  if (!fs.existsSync(merged)) {
    const parts = fs.readdirSync(DIR).filter(f => f.startsWith(s + '-') && f.endsWith('.jsonl')).sort();
    const text = parts.map(f => fs.readFileSync(path.join(DIR, f), 'utf8')).join('');
    fs.writeFileSync(merged, zlib.gzipSync(text)); parts.forEach(f => fs.unlinkSync(path.join(DIR, f)));
  }
  data[s] = new Map(gz(merged).map(r => [r.id, r]));
  if (data[s].size !== ref.size) throw Error(`${s}: ${data[s].size} records`);
}
const median = xs => { const a = [...xs].sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
const mean = xs => xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
const pct = (n, d) => +(n / d * 100).toFixed(2);
function measure(list) {   // list of {id, r (result at cap) or null, ms, evals}
  const n = list.length; let valid = 0, quality = 0, strict = 0, nofloat = 0; const ratio = [], byFolds = {};
  for (const { id, r } of list) {
    const ro = opening(ref.get(id).design), k = ref.get(id).quality.folds; byFolds[k] ||= [0, 0]; byFolds[k][0]++;
    if (!r || !r.passes) continue;
    valid++; const o = opening(r.design); if (ro > 0) ratio.push(o / ro);
    if (r.floating === 0) { nofloat++; if (o >= 0.9 * ro - 1e-9) { quality++; byFolds[k][1]++; } if (o >= 0.99 * ro - 1e-9) strict++; }
  }
  return { valid: pct(valid, n), quality: pct(quality, n), strictQuality: pct(strict, n), validNoFloating: pct(nofloat, n),
    medianOpeningRatio: ratio.length ? +median(ratio).toFixed(3) : null,
    meanMs: +mean(list.map(x => x.ms)).toFixed(2), medianMs: +median(list.map(x => x.ms)).toFixed(2), meanScoreCalls: +mean(list.map(x => x.evals)).toFixed(1),
    qualityByReferenceFolds: Object.fromEntries(Object.entries(byFolds).map(([k, [a, b]]) => [k, [a, pct(b, a)]])) };
}
const at = (rec, cap) => rec.results.find(x => x.cap === cap);
const summary = { answers: ref.size, caps: CAPS, starts: {}, combined: {} };
for (const s of STARTS) summary.starts[s] = Object.fromEntries(CAPS.map(cap => [cap, measure([...data[s].values()].map(rec => {
  const r = at(rec, cap); return { id: rec.id, r, ms: r.searchMs + r.finishMs, evals: r.evaluations }; }))]));
// Combined: model seed + nearest, half the cap each; choose with the answer key's ranking on checker measures.
const metric = r => ({ floating: r.floating, spread: r.spread, ...r.rank, _r: r });
for (const s of STARTS.slice(0, 3)) summary.combined[s + '+nearest'] = Object.fromEntries(CAPS.slice(1).map(cap => [cap, measure([...ref.keys()].map(id => {
  const a = at(data[s].get(id), cap / 2), b = at(data.nearest.get(id), cap / 2), good = [a, b].filter(x => x.passes);
  const r = good.length ? P.rankDesigns(good.map(metric))[0]._r : a;
  return { id, r, ms: a.searchMs + a.finishMs + b.searchMs + b.finishMs, evals: a.evaluations + b.evaluations }; }))]));
const avg = (keys, src) => Object.fromEntries(CAPS.filter(c => src[keys[0]][c]).map(cap => [cap, Object.fromEntries(['valid', 'quality', 'strictQuality', 'validNoFloating', 'meanMs', 'meanScoreCalls'].map(f => [f, +mean(keys.map(k => src[k][cap][f])).toFixed(2)]))]));
summary.modelMeanOverSeeds = avg(STARTS.slice(0, 3), summary.starts);
summary.combinedMeanOverSeeds = avg(Object.keys(summary.combined), summary.combined);
fs.writeFileSync(path.join(DIR, 'summary.json'), JSON.stringify(summary, null, 1) + '\n');
const row = (name, src) => console.log(name.padEnd(26), CAPS.filter(c => src[c]).map(c => `${c}: ${src[c].valid.toFixed(0)}/${src[c].quality.toFixed(0)} ${src[c].meanMs.toFixed(0)}ms`).join(' | '));
console.log('valid% / quality% and mean ms per answer, by score-call cap');
row('model (mean of 3 seeds)', summary.modelMeanOverSeeds); row('nearest', summary.starts.nearest); row('simple', summary.starts.simple); row('model+nearest (mean)', summary.combinedMeanOverSeeds);
