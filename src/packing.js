/* Experiment v2 rules (docs/EXPERIMENT_SPEC.md): validity, 2% fit margin, ranking measures,
 * hand-rule baseline and a deterministic reference solver over ordered design families.
 * Zero-thickness rigid panels, parallel creases, alternating fold directions.
 */
const { foldAccordion, checkContacts, evaluateAccordion } = require('./accordion');

const RULES = Object.freeze({
  margin: 0.02,            // final dimensions must be <= 98% of the box (D18)
  minPanelFraction: 0.05,  // each panel >= 5% of sheet length
  maxPanels: 12,           // 0..11 folds (D21)
  activeAngle: 1,          // a crease folding less than 1 degree is not a fold
  lengthTolerance: 0.01,   // panel lengths within 1% of sheet length count as equal
  angleTolerance: 1,       // angles within 1 degree count as equal
  validationSteps: 720,    // authoritative contact sampling
  screeningSteps: 60,      // cheaper sampling while searching and ranking
  sweepTieTolerance: 0.01, // swept-area differences below 1% of L^2 are ties (D23)
});

const usable = box => box.map(x => (1 - RULES.margin) * x);

function fitsWithMargin(dimensions, box, scale) {
  const tolerance = 1e-9 * scale;
  return dimensions.every((value, i) => value <= usable(box)[i] + tolerance);
}

function ruleViolations(design, request) {
  const { panelLengths, angles } = design, L = request.length, out = [];
  if (panelLengths.length < 1 || panelLengths.length > RULES.maxPanels) out.push('panel-count');
  const total = panelLengths.reduce((s, x) => s + x, 0);
  if (Math.abs(total - L) > 1e-9 * L) out.push('length-not-preserved');
  if (panelLengths.some(x => x < RULES.minPanelFraction * L * (1 - 1e-9))) out.push('panel-too-short');
  if (angles.length !== panelLengths.length - 1) out.push('angle-count');
  if (angles.some(a => !(a >= RULES.activeAngle && a <= 180))) out.push('inactive-or-invalid-crease');
  if (Math.abs(design.width - request.width) > 1e-9 * request.width) out.push('width-changed');
  return out;
}

function distinctCount(values, tolerance) {
  if (!values.length) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  let count = 1;
  for (let i = 1; i < sorted.length; i++) if (sorted[i] - sorted[i - 1] > tolerance) count++;
  return count;
}

// Geometric order (D14, spec section 5): lower is more ordered.
function orderScore(design) {
  const p = design.panelLengths, L = p.reduce((s, x) => s + x, 0), tol = RULES.lengthTolerance * L;
  const symmetric = p.every((x, i) => Math.abs(x - p[p.length - 1 - i]) <= tol);
  return distinctCount(p, tol) + distinctCount(design.angles, RULES.angleTolerance) + (symmetric ? 0 : 1);
}

function segmentDistance(a, b, c, d) {
  const pointSegment = (p, q, r) => {
    const dx = r[0] - q[0], dz = r[1] - q[1], len2 = dx * dx + dz * dz;
    const t = len2 ? Math.max(0, Math.min(1, ((p[0] - q[0]) * dx + (p[1] - q[1]) * dz) / len2)) : 0;
    return Math.hypot(p[0] - q[0] - t * dx, p[1] - q[1] - t * dz);
  };
  const cross = (o, p, q) => (p[0] - o[0]) * (q[1] - o[1]) - (p[1] - o[1]) * (q[0] - o[0]);
  const d1 = cross(a, b, c), d2 = cross(a, b, d), d3 = cross(c, d, a), d4 = cross(c, d, b);
  if (d1 * d2 < 0 && d3 * d4 < 0) return 0;
  return Math.min(pointSegment(a, c, d), pointSegment(b, c, d), pointSegment(c, a, b), pointSegment(d, a, b));
}

const isFullFlatStack = design => design.angles.length > 0 && design.angles.every(a => a === 180);

// One pass over sampled states: prohibited contacts, smallest non-adjacent gap, swept x-z area.
function motionMetrics(design, steps) {
  const L = design.panelLengths.reduce((s, x) => s + x, 0);
  let blocked = 0, minGap = Infinity;
  const lo = [Infinity, Infinity], hi = [-Infinity, -Infinity];
  const stack = isFullFlatStack(design);
  for (let s = 0; s <= steps; s++) {
    const g = foldAccordion(design, s / steps);
    if (checkContacts(g).blocked.length) blocked++;
    for (const [x, z] of g.section) {
      lo[0] = Math.min(lo[0], x); hi[0] = Math.max(hi[0], x);
      lo[1] = Math.min(lo[1], z); hi[1] = Math.max(hi[1], z);
    }
    // The intended terminal contact of a full flat stack is not counted as a gap.
    if (stack && s === steps) continue;
    const q = g.section;
    for (let i = 0; i < q.length - 1; i++) for (let j = i + 2; j < q.length - 1; j++) {
      minGap = Math.min(minGap, segmentDistance(q[i], q[i + 1], q[j], q[j + 1]));
    }
  }
  return { blockedSamples: blocked, minGap: minGap / L, sweptArea: (hi[0] - lo[0]) * (hi[1] - lo[1]) / (L * L) };
}

function assess(design, request, { steps = RULES.validationSteps } = {}) {
  const violations = ruleViolations(design, request);
  const final = foldAccordion(design);
  const fits = fitsWithMargin(final.dimensions, request.targetBox, Math.max(request.length, ...request.targetBox));
  const motion = motionMetrics(design, steps);
  const official = steps === RULES.validationSteps ? evaluateAccordion(design, request.targetBox, { steps }) : null;
  const contactFree = official ? official.noBlockedContactsAtSamples : motion.blockedSamples === 0;
  return {
    valid: violations.length === 0 && contactFree, fits, passes: violations.length === 0 && contactFree && fits,
    violations, contactFree, folds: design.angles.length, order: orderScore(design),
    minGap: motion.minGap, sweptArea: motion.sweptArea, dimensions: final.dimensions, sampleCount: steps + 1,
  };
}

// Strict priority order (D16). Negative means a is better.
function compareRanked(a, b) {
  const eps = 1e-6;
  if (a.folds !== b.folds) return a.folds - b.folds;
  if (a.order !== b.order) return a.order - b.order;
  const gapA = Math.min(a.minGap, 1e3), gapB = Math.min(b.minGap, 1e3);
  if (Math.abs(gapA - gapB) > eps) return gapB - gapA;
  // D23: swept-area differences under 1% of sheet length squared count as ties.
  if (Math.abs(a.sweptArea - b.sweptArea) > RULES.sweepTieTolerance) return a.sweptArea - b.sweptArea;
  if (Math.abs(a.dimensions[0] - b.dimensions[0]) > eps * a.dimensions[0] + 1e-12) return a.dimensions[0] - b.dimensions[0];
  return a.dimensions[2] - b.dimensions[2];
}

function analyticallyInfeasible(request) {
  const [X, Y] = usable(request.targetBox);
  if (request.width > Y * (1 + 1e-9)) return 'width-cannot-contract';
  if (RULES.minPanelFraction * request.length > X * (1 + 1e-9)) return 'first-panel-cannot-fit';
  return null;
}

const equalDesign = (n, request, angles) => ({
  panelLengths: Array(n).fill(request.length / n), width: request.width, angles });

// Baseline: fold flat into the fewest equal panels that fit the box length.
function handRule(request) {
  if (analyticallyInfeasible(request)) return null;
  const n = Math.max(1, Math.ceil(request.length / usable(request.targetBox)[0] - 1e-9));
  if (n > RULES.maxPanels) return null;
  return equalDesign(n, request, Array(n - 1).fill(180));
}

const range = (from, to, step) => { const out = []; for (let x = from; x <= to + 1e-9; x += step) out.push(+x.toFixed(6)); return out; };
// Near-right and near-closed angles get extra resolution: tall serpentines live there.
const NEAR = [88, 89, 91, 92, 165, 170, 172, 174, 175, 176, 177, 178, 179, 179.5];
const merge = (...lists) => [...new Set(lists.flat())].sort((a, b) => a - b);
const FINE = merge(range(1, 180, 1), [179.5]), MEDIUM = merge([1], range(5, 180, 5), NEAR), COARSE = merge([1], range(10, 180, 10), NEAR);

/* Ordered design families with at most three parameters, cheapest description first.
 * Each family: parameter grid, bounds, and a builder. Lengths are fractions of sheet length. */
function families(n, request) {
  const L = request.length, min = RULES.minPanelFraction, W = request.width;
  if (n === 1) return [{ name: 'flat', grid: [[]], bounds: [], build: () => equalDesign(1, request, []) }];
  const hi = 1 - min * (n - 1), tight = usable(request.targetBox)[0] / L * (1 - 1e-9);
  const firsts = k => { const v = range(min, hi, (hi - min) / k); if (tight >= min && tight <= hi) v.push(tight); return v; };
  const split = (l0, angles) => ({ panelLengths: [l0 * L, ...Array(n - 1).fill((1 - l0) * L / (n - 1))], width: W, angles });
  const product = (...axes) => axes.reduce((acc, axis) => acc.flatMap(p => axis.map(x => [...p, x])), [[]]);
  const out = [{ name: 'equal-uniform', grid: product(FINE), bounds: [[1, 180]],
    build: ([t]) => equalDesign(n, request, Array(n - 1).fill(t)) }];
  if (n >= 3) out.push({ name: 'equal-two-angle', grid: product(MEDIUM, MEDIUM), bounds: [[1, 180], [1, 180]],
    build: ([a, b]) => equalDesign(n, request, [a, ...Array(n - 2).fill(b)]) });
  out.push({ name: 'first-panel-uniform', grid: product(firsts(24), MEDIUM), bounds: [[min, hi], [1, 180]],
    build: ([l0, t]) => split(l0, Array(n - 1).fill(t)) });
  if (n >= 3) out.push({ name: 'first-panel-two-angle', grid: product(firsts(12), COARSE, COARSE), bounds: [[min, hi], [1, 180], [1, 180]],
    build: ([l0, a, b]) => split(l0, [a, ...Array(n - 2).fill(b)]) });
  return out;
}

// Largest final-shape overflow beyond the usable box, as a fraction of sheet length (<= 0 fits).
function overflowOf(design, request) {
  const d = foldAccordion(design).dimensions, u = usable(request.targetBox);
  return Math.max(...d.map((x, i) => (x - u[i]) / request.length));
}

// Deterministic pattern search from a near-miss toward a fitting design (no randomness).
function refine(family, start, request) {
  const scale = family.bounds.map(([lo, hi]) => (hi - lo) / 20);
  const minStep = family.bounds.map(([lo, hi]) => (hi - lo) / 2000);
  const clamp = p => p.map((x, i) => Math.min(family.bounds[i][1], Math.max(family.bounds[i][0], x)));
  // Fit first; a fitting design that collides scores just above zero so the search keeps moving.
  const score = p => {
    const d = family.build(p);
    if (ruleViolations(d, request).length) return Infinity;
    const over = overflowOf(d, request);
    if (over > 0) return over;
    return motionMetrics(d, 30).blockedSamples ? 1e-6 : 0;
  };
  let point = start, best = score(point), step = scale, evaluations = 0;
  while (best > 0 && step.some((s, i) => s >= minStep[i]) && evaluations < 400) {
    let moved = false;
    for (let i = 0; i < point.length && !moved; i++) for (const sign of [1, -1]) {
      const trial = clamp(point.map((x, k) => k === i ? x + sign * step[i] : x)), value = score(trial);
      evaluations++;
      if (value < best) { point = trial; best = value; moved = true; break; }
    }
    if (!moved) step = step.map(s => s / 2);
  }
  return best <= 0 ? point : null;
}

function* candidates(n, request, { refineStarts = 24 } = {}) {
  for (const family of families(n, request)) {
    const scored = [];
    for (const params of family.grid) {
      const design = family.build(params);
      if (ruleViolations(design, request).length) continue;
      const overflow = overflowOf(design, request);
      if (overflow <= 0) yield { family: family.name, design };
      else scored.push([overflow, params]);
    }
    if (!family.bounds.length) continue;
    scored.sort((a, b) => a[0] - b[0]);
    for (const [, params] of scored.slice(0, refineStarts)) {
      const point = refine(family, params, request);
      if (point) yield { family: family.name + '+refined', design: family.build(point) };
    }
  }
}

/* Fewest folds first; within a fold count, the most ordered fitting designs are screened for
 * contacts, ranked, and the winner is revalidated at 720 samples. Grid search plus deterministic
 * refinement: no randomness, so the answer cannot depend on a seed. "not-found" is not proof. */
function referenceSolve(request, { maxPanels = RULES.maxPanels } = {}) {
  const started = Date.now();
  const reason = analyticallyInfeasible(request);
  if (reason) return { status: 'analytically-infeasible', reason, elapsedMs: Date.now() - started };
  const scale = Math.max(request.length, ...request.targetBox);
  let examined = 0;
  for (let n = 1; n <= maxPanels; n++) {
    const fitting = [];
    for (const c of candidates(n, request)) {
      examined++;
      if (!fitsWithMargin(foldAccordion(c.design).dimensions, request.targetBox, scale)) continue;
      fitting.push({ ...c, order: orderScore(c.design) });
    }
    const orders = [...new Set(fitting.map(c => c.order))].sort((a, b) => a - b);
    for (const order of orders) {
      const screened = fitting.filter(c => c.order === order)
        .map(c => ({ ...c, metrics: { folds: n - 1, order, dimensions: foldAccordion(c.design).dimensions,
          ...motionMetrics(c.design, RULES.screeningSteps) } }))
        .filter(c => c.metrics.blockedSamples === 0)
        .sort((a, b) => compareRanked(a.metrics, b.metrics));
      for (const c of screened) {
        const quality = assess(c.design, request);
        if (quality.passes) return { status: 'found', family: c.family, design: c.design, quality,
          examined, elapsedMs: Date.now() - started };
      }
    }
  }
  return { status: 'not-found', examined, elapsedMs: Date.now() - started };
}

module.exports = { RULES, usable, fitsWithMargin, ruleViolations, orderScore, segmentDistance,
  motionMetrics, assess, compareRanked, analyticallyInfeasible, handRule, families, candidates, referenceSolve };
