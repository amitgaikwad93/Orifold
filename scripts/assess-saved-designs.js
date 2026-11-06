#!/usr/bin/env node
// Audit a recorded pose without re-placing it. Calls the evaluator; does not read its source.
const readline = require('readline');
const P = require('../src/packing');
readline.createInterface({input:process.stdin}).on('line', line => {
  if (!line.trim()) return;
  const {id,request,design,budget}=JSON.parse(line);
  const q=P.assess(design,request);
  console.log(JSON.stringify({id,...q,budgetSatisfied:design.angles.length<=budget,
    floatingCreases:P.floatingAt(design,request)}));
});
