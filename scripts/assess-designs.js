#!/usr/bin/env node
// Geometry bridge for the Python learning code: judge proposed designs with the reference checker.
// Reads JSON lines on stdin: {id, request, design}. Places each design with the reference's wall placement
// search (D30, D34), then assesses it at 721 motion states. Writes one JSON line per input.
const readline = require('readline');
const { wallPlacement, assess, ruleViolations, floatingAt } = require('../src/packing');
const rl = readline.createInterface({ input: process.stdin });
rl.on('line', line => {
  if (!line.trim()) return;
  const { id, request, design } = JSON.parse(line);
  let out;
  try {
    const violations = ruleViolations(design, request);
    if (violations.length) out = { id, passes: false, reason: 'rules:' + violations.join(',') };
    else {
      const w = wallPlacement(design, request);
      if (w.overflow > 0) out = { id, passes: false, reason: 'does-not-fit', overflow: w.overflow, design };
      else {
        const q = assess(design, request);
        out = { id, passes: q.passes, reason: q.passes ? null : (q.contactFree ? 'fit' : 'collision'),
          floating: floatingAt(design, request), spread: q.spread, symmetric: q.symmetric, folds: q.folds, design };
      }
    }
  } catch (e) { out = { id, passes: false, reason: 'error:' + e.message }; }
  process.stdout.write(JSON.stringify(out) + '\n');
});
