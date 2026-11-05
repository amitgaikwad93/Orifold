#!/usr/bin/env node
// D34 prototype check: compare dataset answers with the current solver (creases on walls) for given requests.
// Usage: OUT=out.json node scripts/compare-wall-rule.js <request-id>:<budget> ...
// Compare dataset answers (spread-first) with the D34 creases-on-walls solver on the reviewed boxes and a few more.
const zlib=require('zlib'),fs=require('fs');const P=require('../src/packing');
const rows=new Map(zlib.gunzipSync(fs.readFileSync('experiments/learning-v2/dataset.jsonl.gz')).toString().trim().split('\n').map(l=>{const r=JSON.parse(l);return [r.id,r]}));
const ids=process.argv.slice(2);const out=[];
for(const spec of ids){const [id,b]=spec.split(':');const r=rows.get(id);const t=Date.now();const s=P.referenceSolveBudgets(r.request);
 const old=r.answers.find(a=>a.budget===+b), neu=s.answers.find(a=>a.budget===+b);
 const f=a=>a?`${a.quality.folds}f spread ${a.quality.spread.toFixed(0)} floating ${a.quality.floatingCreases??P.floatingAt(a.design,r.request)} sym ${a.quality.symmetric} panels ${a.design.panelLengths.map(p=>(p/r.request.length*100).toFixed(0))} angles ${a.design.angles.map(x=>x.toFixed(0))}`:'none';
 console.log(id,'b'+b,`(${((Date.now()-t)/1000).toFixed(1)}s)\n   old: ${f(old)}\n   new: ${f(neu)}`);
 out.push({id,budget:+b,request:r.request,old:old&&{design:old.design,quality:old.quality},new:neu&&{design:neu.design,quality:neu.quality}});}
if (process.env.OUT) fs.writeFileSync(process.env.OUT, JSON.stringify(out));
