/* Reproducible, CPU-only numerical baseline. No learned weights or dependencies. */
const { foldAccordion, checkContacts, evaluateAccordion } = require('./accordion');

function randomGenerator(seed) {
  let state = seed >>> 0;
  return () => ((state = (Math.imul(1664525, state) + 1013904223) >>> 0) / 4294967296);
}

function validateRequest(request) {
  if (!request || ![request.length, request.width].every(x => Number.isFinite(x) && x > 0) ||
      !Array.isArray(request.targetBox) || request.targetBox.length !== 3 ||
      !request.targetBox.every(x => Number.isFinite(x) && x > 0)) {
    throw Error('Specify positive finite length, width and three target-box dimensions.');
  }
}

// Six bounded variables: three stick-breaking fractions, then three hinge angles.
// Reserve 5% of the sheet for each panel before allocating the remaining 80%.
function decode(parameters, request) {
  validateRequest(request);
  if (!Array.isArray(parameters) || parameters.length !== 6 ||
      !parameters.every(x => Number.isFinite(x) && x >= 0 && x <= 1)) {
    throw Error('Expected six parameters between 0 and 1.');
  }
  let remaining = .8;
  const fractions = parameters.slice(0, 3).map(x => {
    const allocated = remaining * x;
    remaining -= allocated;
    return .05 + allocated;
  });
  fractions.push(.05 + remaining);
  return { panelLengths: fractions.map(x => x * request.length), width: request.width,
    angles: parameters.slice(3).map(x => 180 * x) };
}

const canonicalParameters = [
  [.25, 1 / 3, .5, 1, 1, 1], // equal fully folded panels
  [.25, 1 / 3, .5, 0, 0, 0],
  [.25, 1 / 3, .5, .5, .5, .5],
];

function relativeOverflow(dimensions, targetBox) {
  return dimensions.map((value, i) => Math.max(0, value / targetBox[i] - 1));
}

function assess(design, targetBox, { fitTolerance = .01, steps = 720 } = {}) {
  const report = evaluateAccordion(design, targetBox, { steps });
  const overflow = relativeOverflow(report.final.dimensions, targetBox);
  return {
    accepted: overflow.every(x => x <= fitTolerance + 1e-9) && report.noBlockedContactsAtSamples,
    strictPass: report.passesSampledChecks,
    dimensions: report.final.dimensions, relativeOverflow: overflow,
    blockedSampleCount: report.blockedSamples.length,
    firstBlockedProgress: report.blockedSamples[0]?.progress ?? null,
    sampleCount: report.sampleCount,
    normalizedRotation: design.angles.reduce((sum, angle) => sum + (angle / 180) ** 2, 0) / 3,
    idealStackContact: report.finalContacts.allowedStackContacts.length > 0,
  };
}

function settings(options) {
  const config = { seed: 20261104, population: 24, generations: 40,
    searchSteps: 30, validationSteps: 720, fitTolerance: 0, ...options };
  if (!Number.isInteger(config.population) || config.population < 4 || config.population > 1000 ||
      !Number.isInteger(config.generations) || config.generations < 0 || config.generations > 10000 ||
      !Number.isInteger(config.searchSteps) || config.searchSteps < 1 || config.searchSteps > 10000 ||
      !Number.isInteger(config.validationSteps) || config.validationSteps < config.searchSteps || config.validationSteps > 10000 ||
      !Number.isFinite(config.fitTolerance) || config.fitTolerance < 0 || config.fitTolerance > .01 ||
      !Number.isInteger(config.seed)) throw Error('Invalid optimizer settings.');
  if (config.initialParameters !== undefined && (!Array.isArray(config.initialParameters) || config.initialParameters.length !== 6 ||
      !config.initialParameters.every(x => Number.isFinite(x) && x >= 0 && x <= 1))) throw Error('Invalid initial parameters.');
  return config;
}

function analyticRejection(request, fitTolerance) {
  if (request.width > request.targetBox[1] * (1 + fitTolerance) + 1e-9 * request.width) {
    return 'Sheet width cannot contract with parallel creases.';
  }
  if (.05 * request.length > request.targetBox[0] * (1 + fitTolerance) + 1e-9 * request.length) {
    return 'The fixed first panel must occupy at least 5% of sheet length along x.';
  }
  return null;
}

function search(request, options = {}, method = 'differential-evolution') {
  validateRequest(request);
  const config = settings(options), rng = randomGenerator(config.seed);
  const started = performance.now();
  const reason = analyticRejection(request, config.fitTolerance);
  if (reason) return { method, status: 'analytically-infeasible', reason, design: null, quality: null,
    evaluations: 0, generations: 0, validationCandidates: 0, elapsedMs: performance.now() - started, config };

  // Normalize length to one to keep geometry tolerances independent of units.
  const normalized = { length: 1, width: request.width / request.length,
    targetBox: request.targetBox.map(x => x / request.length) };
  let evaluations = 0;
  const archive = [];
  const compare = (a, b) => a.rank[0] - b.rank[0] || a.rank[1] - b.rank[1];
  function score(parameters) {
    const design = decode(parameters, normalized);
    const final = foldAccordion(design);
    const overflow = relativeOverflow(final.dimensions, normalized.targetBox);
    const fitViolation = overflow.reduce((sum, x) => sum + Math.max(0, x - config.fitTolerance - 1e-9) ** 2, 0);
    let collision = false;
    // Check every proposed candidate, including those that do not yet fit.
    for (let step = 0; step <= config.searchSteps; step++) {
      const geometry = step === config.searchSteps ? final : foldAccordion(design, step / config.searchSteps);
      if (checkContacts(geometry).blocked.length) { collision = true; break; }
    }
    const violation = fitViolation + (collision ? 1 : 0);
    const rotation = design.angles.reduce((sum, a) => sum + (a / 180) ** 2, 0) / 3;
    const candidate = { parameters: [...parameters], rank: [violation > 0 ? 1 : 0, violation > 0 ? violation : rotation] };
    evaluations++;
    // Keep distinct promising candidates for a denser, independent acceptance pass.
    if (!archive.some(item => item.parameters.every((v, i) => v === parameters[i]))) {
      archive.push(candidate); archive.sort(compare); if (archive.length > 8) archive.pop();
    }
    return candidate;
  }
  const initial = index => {
    if (index < canonicalParameters.length) return [...canonicalParameters[index]];
    const random = Array.from({ length: 6 }, rng);
    // Consume the same random draws and replace only the fourth population member.
    // Canonical seeds and candidate budget stay identical for paired comparisons.
    return index === canonicalParameters.length && config.initialParameters !== undefined ? [...config.initialParameters] : random;
  };
  if (method === 'equal-panels') {
    score(canonicalParameters[0]);
  } else if (method === 'random-search') {
    const budget = config.population * (config.generations + 1);
    for (let i = 0; i < budget; i++) score(initial(i));
  } else if (method === 'differential-evolution') {
    const population = Array.from({ length: config.population }, (_, i) => score(initial(i)));
    for (let generation = 0; generation < config.generations; generation++) {
      for (let i = 0; i < population.length; i++) {
        const indices = [];
        while (indices.length < 3) {
          const index = Math.floor(rng() * population.length);
          if (index !== i && !indices.includes(index)) indices.push(index);
        }
        const [a, b, c] = indices.map(index => population[index].parameters);
        const forced = Math.floor(rng() * 6);
        const trial = population[i].parameters.map((value, j) => {
          if (j !== forced && rng() >= .8) return value;
          return Math.max(0, Math.min(1, a[j] + .7 * (b[j] - c[j])));
        });
        const candidate = score(trial);
        if (compare(candidate, population[i]) < 0) population[i] = candidate;
      }
    }
  } else throw Error('Unknown search method.');

  const verified = archive.map(candidate => {
    const design = decode(candidate.parameters, request);
    return { design, parameters: candidate.parameters,
      quality: assess(design, request.targetBox, { fitTolerance: config.fitTolerance, steps: config.validationSteps }) };
  });
  const accepted = verified.filter(candidate => candidate.quality.accepted)
    .sort((a, b) => a.quality.normalizedRotation - b.quality.normalizedRotation);
  const chosen = accepted[0] || verified[0];
  return { method, status: accepted.length ? 'solved-sampled' : 'budget-exhausted',
    reason: accepted.length ? null : 'No candidate passed the denser checks within this search budget; infeasibility is not established.',
    ...chosen, evaluations, generations: method === 'differential-evolution' ? config.generations : 0,
    validationCandidates: verified.length, elapsedMs: performance.now() - started, config };
}

module.exports = { search, decode, assess, randomGenerator, relativeOverflow };
