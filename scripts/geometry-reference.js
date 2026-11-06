const fs = require('node:fs');
const { evaluateAccordion } = require('../src/accordion');
const requests = JSON.parse(fs.readFileSync(0, 'utf8'));
process.stdout.write(JSON.stringify(requests.map(row => evaluateAccordion(row.design, row.targetBox, { steps: row.steps ?? 180 }))));
