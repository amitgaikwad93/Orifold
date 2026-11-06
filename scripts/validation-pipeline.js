#!/usr/bin/env node
// Timed pipelines. Diagnostic tolerance search is deliberately outside these timings.
const readline=require('node:readline'),{performance}=require('node:perf_hooks');
const P=require('../src/packing'),{repair}=require('./repair-designs');
function placed(design,request,move=true){
 const d=structuredClone(design);if(move)P.wallPlacement(d,request);const q=P.assess(d,request);
 return{design:d,passes:q.passes,quality:q,floating:P.floatingAt(d,request),spread:q.spread,evaluations:0};
}
function multi(request,budget,cap){
 const starts=[{panelLengths:[request.length],width:request.width,angles:[]}];
 for(let k=1;k<=budget;k++)for(const angle of [150,180])starts.push({panelLengths:Array(k+1).fill(request.length/(k+1)),width:request.width,angles:Array(k).fill(angle)});
 let remaining=cap;const candidates=[];
 starts.forEach((d,i)=>{const allocation=Math.floor(remaining/(starts.length-i));const r=repair(d,request,allocation);remaining-=r.evaluations;candidates.push(r);});
 const good=candidates.filter(r=>r.passes);
 good.sort((a,b)=>a.floating-b.floating||b.spread-a.spread||a.design.angles.length-b.design.angles.length);
 const chosen=good[0]||candidates[0];
 return{...chosen,evaluations:cap-remaining,candidates:candidates.length};
}
module.exports={multi,placed};
if(require.main===module){
 const mode=process.argv[2],cap=Number(process.argv[3]||400);
 readline.createInterface({input:process.stdin}).on('line',line=>{
  if(!line.trim())return;const x=JSON.parse(line);const t=performance.now();let r;
  if(mode==='reference'){
   const solved=P.referenceSolveBudgets(x.request);
   const answers=x.budgets.map(b=>{const a=solved.answers?.find(a=>a.budget===b);return{budget:b,result:a?placed(a.design,x.request,false):null};});
   r={id:x.id,status:solved.status,answers,pipelineMs:performance.now()-t};
  }else{
   const y=mode==='repair'?repair(x.design,x.request,cap):mode==='multistart'?multi(x.request,x.budget,cap):placed(x.design,x.request,mode!=='cached');
   r={...x,...y,budgetSatisfied:y.design.angles.length<=x.budget,pipelineMs:performance.now()-t};
  }
  console.log(JSON.stringify(r));
 });
}
