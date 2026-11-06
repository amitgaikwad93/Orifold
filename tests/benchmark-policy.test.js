const test=require('node:test'),assert=require('node:assert/strict');
const {repair}=require('../scripts/repair-designs');
const {toleranceMetrics}=require('../scripts/tolerance-metrics');
test('score budget includes initial score and never overruns inner coordinate loop',()=>{
 const d={panelLengths:[25,25,25,25],width:10,angles:[90,90,90]};
 const req={length:100,width:10,targetBox:[1,12,1]};
 for(const n of [0,1,2,17]){const r=repair(d,req,n);assert.equal(r.evaluations,n);assert.equal(r.passes,false);}
 assert.throws(()=>repair(d,req,-1));
});
test('canonical boundary acceptance and caller design is not mutated',()=>{
 const fs=require('node:fs');const preds=JSON.parse(fs.readFileSync('experiments/network-optimization-v1/results/positions-adam-float32-predictions.json'));
 const row=preds.find(r=>r.checkerDisagreement);const manifest=JSON.parse(fs.readFileSync('experiments/memorization-v1/manifest.json'));
 const req=manifest.find(e=>e.id===row.id).request;const before=structuredClone(row.design);
 const r=repair(row.design,req,400);assert.equal(r.passes,true);assert.equal(r.evaluations,0);assert.deepEqual(row.design,before);
});
test('both tolerance objectives include width and box objective uses its own minimum',()=>{
 const d={panelLengths:[50,50],width:10,angles:[90]};
 const r=toleranceMetrics(d,{length:100,width:10,targetBox:[120,5,120]});
 assert.ok(r.box.overflow>1);assert.ok(r.sheet.overflow>.05);
 const req={length:100,width:10,targetBox:[37,12,92]};
 const a=toleranceMetrics({...d,angles:[37]},req);
 const P=require('../src/packing');const pts=P.finalSection({...d,angles:[37]});const u=P.usable(req.targetBox);
 const [x,z]=P.turnedExtents(pts,a.sheet.angle);const atSheet=Math.max(0,(x-u[0])/u[0],(z-u[2])/u[2],(10-u[1])/u[1]);
 assert.ok(a.box.overflow<=atSheet+1e-6);
});
test('relative-box optimization materially improves a known asymmetric fixture',()=>{
 const P=require('../src/packing'),d={panelLengths:[80,20],width:10,angles:[60]},req={length:100,width:10,targetBox:[25,12,55]};
 const r=toleranceMetrics(d,req),u=P.usable(req.targetBox),[x,z]=P.turnedExtents(P.finalSection(d),r.sheet.angle);
 const old=Math.max(0,(x-u[0])/u[0],(z-u[2])/u[2]);assert.ok(r.box.overflow<old-.1);
});
test('non-neural multistart shares one budget across all counts',()=>{
 const {multi}=require('../scripts/validation-pipeline');
 const r=multi({length:100,width:10,targetBox:[1,12,1]},3,17);
 assert.ok(r.evaluations<=17);assert.equal(r.candidates,7);assert.equal(r.passes,false);
 const good=multi({length:100,width:10,targetBox:[60,12,60]},1,17);
 assert.ok(good.passes);assert.ok(good.design.angles.length<=1);assert.ok(good.evaluations<=17);
});
