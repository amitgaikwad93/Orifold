#!/usr/bin/env node
// Finding 2026-11-05: are near-flat creases removable? Merges each fold under 10 degrees and re-assesses.
// Result on r5: 0/287 merged designs pass, because removing a crease flips the alternating fold directions.
// Usage: node scripts/check-switch-creases.js [map.json.gz]
// For answers containing a fold under 10 degrees: merge each such crease (join its two panels) and re-assess.
const zlib=require('zlib'),fs=require('fs');
const P=require('../src/packing');
const map=JSON.parse(zlib.gunzipSync(fs.readFileSync(process.argv[2] || 'results/request-map-2026-11-05-r5.json.gz')));
let total=0, mergedPasses=0, mergedBetter=0, sameSpread=0;
for (const c of map.cells) for (const a of (c.answers||[])) {
  const d=a.design; if (!d.angles.length || Math.min(...d.angles)>=10) continue; total++;
  // Merge every near-flat crease.
  const p=[d.panelLengths[0]], ang=[];
  d.angles.forEach((t,i)=>{ if (t<10) { p[p.length-1]+=d.panelLengths[i+1]; } else { ang.push(t); p.push(d.panelLengths[i+1]); } });
  // Merging removes an alternating sign; keep alternation valid only when an even number of creases is dropped between kept ones.
  const m={panelLengths:p,width:d.width,angles:ang};
  P.overflowOf(m,c.request); const q=P.assess(m,c.request);
  if (q.passes){ mergedPasses++; if (Math.abs(q.spread-a.quality.spread)<1) sameSpread++; const r=P.rankDesigns([{...a.quality},{...q}]); if (r[0]===undefined) continue; if (r[0].folds===q.folds && r[0].panelsKey===undefined && r[0]!==a.quality && r[0].spread===q.spread) mergedBetter++; }
}
console.log({answersWithFoldUnder10:total, mergedVersionPasses:mergedPasses, mergedSameSpread:sameSpread, mergedRanksHigher:mergedBetter});
