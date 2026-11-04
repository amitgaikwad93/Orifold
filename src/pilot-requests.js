const { foldAccordion } = require('./accordion');
const { decode, assess, randomGenerator } = require('./optimizer');

function generateRequests(seed = 20261104) {
  const rng = randomGenerator(seed), requests = [];
  for (let i = 0; i < 80; i++) {
    const group = i < 40 ? 'wide-box' : 'narrow-tall-box';
    let entry;
    for (let attempt = 0; attempt < 1000 && !entry; attempt++) {
      const length = 10 + 90 * rng(), width = 5 + 25 * rng();
      let witness;
      if (group === 'wide-box') {
        const angle = 80 + 90 * rng();
        witness = decode([rng(), rng(), rng(), angle / 180, angle / 180, angle / 180], { length, width, targetBox: [length, width, length] });
      } else {
        const first = .055 + .065 * rng(), angle = 85 + 10 * rng(), difference = 5 + 15 * rng();
        witness = { panelLengths: [first, (1 - first) / 3, (1 - first) / 3, (1 - first) / 3].map(x => x * length),
          width, angles: [angle, difference, difference] };
      }
      const geometry = foldAccordion(witness);
      const targetBox = [Math.max(group === 'wide-box' ? .28 * length : 0, geometry.dimensions[0] * (1.01 + .03 * rng())),
        width * (1.01 + .02 * rng()), Math.max(.02 * length, geometry.dimensions[2] * (1.01 + .03 * rng()))];
      if (group === 'narrow-tall-box' && targetBox[0] >= .24 * length) continue;
      const witnessQuality = assess(witness, targetBox, { fitTolerance: 0, steps: 720 });
      if (!witnessQuality.accepted) continue;
      entry = { id: `request-${String(i + 1).padStart(3, '0')}`, group,
        knownStatus: 'witness-passes-721-samples', request: { length, width, targetBox }, witness, witnessQuality };
    }
    if (!entry) throw Error(`Could not generate a validated request for ${group}.`);
    requests.push(entry);
  }
  for (let i = 80; i < 100; i++) {
    const length = 10 + 90 * rng(), width = 5 + 25 * rng();
    requests.push({ id: `request-${String(i + 1).padStart(3, '0')}`, group: 'impossible-width', knownStatus: 'analytically-infeasible',
      request: { length, width, targetBox: [.5 * length, width * (.5 + .4 * rng()), .5 * length] }, witness: null });
  }
  return requests;
}
module.exports = { generateRequests };
