#!/usr/bin/env node
const readline=require('node:readline');const {toleranceMetrics}=require('./tolerance-metrics');
readline.createInterface({input:process.stdin}).on('line',line=>{if(!line.trim())return;const x=JSON.parse(line);console.log(JSON.stringify({id:x.id,...toleranceMetrics(x.design,x.request)}));});
