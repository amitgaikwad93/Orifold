#!/usr/bin/env node
// Analysis only: extra allowance beyond 98% usable dimensions. Not strict evaluator validity.
// V3: each denominator has its own placement objective, and every axis includes width.
const fs = require('node:fs'), zlib = require('node:zlib');
const P = require('../src/packing');
const { evaluateAccordion } = require('../src/accordion');
const { toleranceMetrics } = require('./tolerance-metrics');
if (require.main === module) {
  const bytes=fs.readFileSync(process.argv[2]);
  const text=(bytes[0]===31&&bytes[1]===139?zlib.gunzipSync(bytes):bytes).toString();
  const preds=text.trim().split('\n').filter(Boolean).map(JSON.parse);
  const rows=new Map(zlib.gunzipSync(fs.readFileSync('experiments/learning-v2b/dataset.jsonl.gz')).toString().trim().split('\n').map(l=>{const r=JSON.parse(l);return[r.id,r];}));
  const recs=preds.map(p=>{
    const req=p.request&&typeof p.request==='object'?p.request:rows.get(p.request).request;
    const d=p.proposed||p.design;
    const rulesOk=P.ruleViolations(d,req).length===0&&(p.budget===undefined||d.angles.length<=p.budget);
    const metrics=toleranceMetrics(d,req);
    const contactFree=evaluateAccordion(d,req.targetBox.map(x=>x*10),{steps:720}).noBlockedContactsAtSamples;
    return{rulesOk,contactFree,over:metrics.sheet.overflow,overBox:metrics.box.overflow};
  });
  const ok=r=>r.rulesOk&&r.contactFree;
  console.log('answers',recs.length,'| rules + collision-free',recs.filter(ok).length);
  for(const t of [0,.0025,.005,.01,.02,.03,.05,.1])console.log(`tolerance ${(100*t).toFixed(2)}% of sheet: pass ${(100*recs.filter(r=>ok(r)&&r.over<=t+1e-12).length/recs.length).toFixed(1)}% | of usable box side: pass ${(100*recs.filter(r=>ok(r)&&r.overBox<=t+1e-12).length/recs.length).toFixed(1)}%`);
}
