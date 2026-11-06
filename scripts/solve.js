const fs = require('node:fs');
const { search } = require('../src/optimizer');
try {
  if (!process.argv[2]) throw Error('Usage: node scripts/solve.js request.json');
  const request = JSON.parse(fs.readFileSync(process.argv[2], 'utf8'));
  console.log(JSON.stringify(search(request), null, 2));
} catch (error) { console.error(error.message); process.exitCode = 1; }
