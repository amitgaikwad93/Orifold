/* Experiment v2 rules (docs/EXPERIMENT_SPEC.md): validity, 2% fit margin, ranking measures,
 * hand-rule baseline and a deterministic reference solver over ordered design families.
 * Ranking (D26-D28): fold budget is an input; within it, most spread (smallest opening angle)
 * with a 10% tie band, then symmetry, fewer folds, order score, spread, gap, sweep, compactness.
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
  spreadTieBand: 0.10,     // designs within 10% of the best opening angle count as equally spread
  extraBudgets: 2,         // reference answers for minimum folds .. minimum + 2 (D26)
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

// Symmetry (D28): palindromic panel lengths AND palindromic fold angles. Even panel counts then
// give mirror symmetry, odd counts point symmetry (scripts/symmetry-check.js).
function isSymmetric(design) {
  const p = design.panelLengths, a = design.angles, L = p.reduce((s, x) => s + x, 0);
  return p.every((x, i) => Math.abs(x - p[p.length - 1 - i]) <= RULES.lengthTolerance * L) &&
    a.every((x, i) => Math.abs(x - a[a.length - 1 - i]) <= RULES.angleTolerance);
}

// Geometric order (D14, spec section 5): lower is more ordered.
function orderScore(design) {
  const p = design.panelLengths, L = p.reduce((s, x) => s + x, 0);
  return distinctCount(p, RULES.lengthTolerance * L) + distinctCount(design.angles, RULES.angleTolerance) + (isSymmetric(design) ? 0 : 1);
}

// Spread (D27): smallest opening angle between neighbouring panels, 180 - fold angle. No fold: 180.
const spreadOf = design => design.angles.length ? 180 - Math.max(...design.angles) : 180;

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
  const dimensions = placedDimensions(design);   // final shape turned by its placement angle (D30)
  const fits = fitsWithMargin(dimensions, request.targetBox, Math.max(request.length, ...request.targetBox));
  const motion = motionMetrics(design, steps);
  const official = steps === RULES.validationSteps ? evaluateAccordion(design, request.targetBox, { steps }) : null;
  const contactFree = official ? official.noBlockedContactsAtSamples : motion.blockedSamples === 0;
  return {
    valid: violations.length === 0 && contactFree, fits, passes: violations.length === 0 && contactFree && fits,
    violations, contactFree, folds: design.angles.length, order: orderScore(design), symmetric: isSymmetric(design),
    spread: spreadOf(design), minGap: motion.minGap, sweptArea: motion.sweptArea, dimensions, placement: design.placement ?? 0,
    sampleCount: steps + 1,
  };
}

// Keys after the spread band. Negative means a is better.
function compareWithinBand(a, b) {
  const eps = 1e-6;
  if (a.symmetric !== b.symmetric) return a.symmetric ? -1 : 1;
  if (a.folds !== b.folds) return a.folds - b.folds;
  if (a.order !== b.order) return a.order - b.order;
  if (Math.abs(a.spread - b.spread) > 1e-6) return b.spread - a.spread;
  const gapA = Math.min(a.minGap, 1e3), gapB = Math.min(b.minGap, 1e3);
  if (Math.abs(gapA - gapB) > eps) return gapB - gapA;
  if (Math.abs(a.sweptArea - b.sweptArea) > RULES.sweepTieTolerance) return a.sweptArea - b.sweptArea;
  if (Math.abs(a.dimensions[0] - b.dimensions[0]) > eps * a.dimensions[0] + 1e-12) return a.dimensions[0] - b.dimensions[0];
  return a.dimensions[2] - b.dimensions[2];
}

// Rank a set of valid, fitting designs (metrics objects). The band is relative to the best in the set,
// so ranking is transitive. Returns the metrics sorted best first.
function rankDesigns(list) {
  if (!list.length) return [];
  const best = Math.max(...list.map(m => m.spread));
  const cut = (1 - RULES.spreadTieBand) * best - 1e-9;
  const inBand = list.filter(m => m.spread >= cut).sort(compareWithinBand);
  const rest = list.filter(m => m.spread < cut).sort((a, b) => b.spread - a.spread || compareWithinBand(a, b));
  return [...inBand, ...rest];
}

function analyticallyInfeasible(request) {
  const Y = usable(request.targetBox)[1];
  if (request.width > Y * (1 + 1e-9)) return 'width-cannot-contract';
  return null;
}

const equalDesign = (n, request, angles) => ({
  panelLengths: Array(n).fill(request.length / n), width: request.width, angles });

// Baseline: fold flat into the fewest equal panels that fit the box's longer side (length or,
// turned upright, height; D30).
function handRule(request) {
  if (analyticallyInfeasible(request)) return null;
  const u = usable(request.targetBox), upright = u[2] > u[0];
  const n = Math.max(1, Math.ceil(request.length / Math.max(u[0], u[2]) - 1e-9));
  if (n > RULES.maxPanels) return null;
  return { ...equalDesign(n, request, Array(n - 1).fill(180)), placement: upright ? 90 : 0 };
}

const range = (from, to, step) => { const out = []; for (let x = from; x <= to + 1e-9; x += step) out.push(+x.toFixed(6)); return out; };
// Near-right and near-closed angles get extra resolution: tall serpentines live there.
const NEAR = [88, 89, 91, 92, 165, 170, 172, 174, 175, 176, 177, 178, 179, 179.5];
const merge = (...lists) => [...new Set(lists.flat())].sort((a, b) => a - b);
const FINE = merge(range(1, 180, 1), [179.5]), MEDIUM = merge([1], range(5, 180, 5), NEAR), COARSE = merge([1], range(10, 180, 10), NEAR);

/* Design families with at most three parameters. Lengths are fractions of sheet length.
 * Length patterns: equal; different first panel; symmetric ends (palindromic); geometric taper.
 * Angle patterns: one angle; first different; palindromic (first and last different). */
function families(n, request) {
  const L = request.length, min = RULES.minPanelFraction, W = request.width;
  if (n === 1) return [{ name: 'flat', grid: [[]], bounds: [], build: () => equalDesign(1, request, []) }];
  const k = n - 1, hiFirst = 1 - min * (n - 1), tight = usable(request.targetBox)[0] / L * (1 - 1e-9);
  const firsts = steps => { const v = range(min, hiFirst, (hiFirst - min) / steps); if (tight >= min && tight <= hiFirst) v.push(tight); return v; };
  const hiEnd = (1 - min * (n - 2)) / 2, ends = steps => range(min, hiEnd, (hiEnd - min) / steps);
  const product = (...axes) => axes.reduce((acc, axis) => acc.flatMap(p => axis.map(x => [...p, x])), [[]]);
  const len = {
    equal: () => Array(n).fill(L / n),
    first: l0 => [l0 * L, ...Array(n - 1).fill((1 - l0) * L / (n - 1))],
    ends: e => [e * L, ...Array(n - 2).fill((1 - 2 * e) * L / (n - 2)), e * L],
    taper: r => { const w = Array.from({ length: n }, (_, i) => r ** i), s = w.reduce((a, b) => a + b, 0); return w.map(x => x / s * L); },
  };
  const ang = { one: t => Array(k).fill(t), firstDiff: (a, b) => [a, ...Array(k - 1).fill(b)],
    palin: (a, b) => [a, ...Array(k - 2).fill(b), a] };
  const D = (lengths, angles) => ({ panelLengths: lengths, width: W, angles });
  const tapers = range(0.5, 1.5, 0.05).filter(r => Math.abs(r - 1) > 1e-9);
  const out = [{ name: 'equal-one-angle', grid: product(FINE), bounds: [[1, 180]], build: ([t]) => D(len.equal(), ang.one(t)) }];
  if (k >= 2) out.push({ name: 'equal-first-angle-different', grid: product(MEDIUM, MEDIUM), bounds: [[1, 180], [1, 180]], build: ([a, b]) => D(len.equal(), ang.firstDiff(a, b)) });
  if (k >= 3) out.push({ name: 'equal-palindromic-angles', grid: product(MEDIUM, MEDIUM), bounds: [[1, 180], [1, 180]], build: ([a, b]) => D(len.equal(), ang.palin(a, b)) });
  out.push({ name: 'first-panel-one-angle', grid: product(firsts(24), MEDIUM), bounds: [[min, hiFirst], [1, 180]], build: ([l0, t]) => D(len.first(l0), ang.one(t)) });
  if (k >= 2) out.push({ name: 'first-panel-first-angle-different', grid: product(firsts(12), COARSE, COARSE), bounds: [[min, hiFirst], [1, 180], [1, 180]], build: ([l0, a, b]) => D(len.first(l0), ang.firstDiff(a, b)) });
  if (n >= 3) {
    out.push({ name: 'symmetric-ends-one-angle', grid: product(ends(16), MEDIUM), bounds: [[min, hiEnd], [1, 180]], build: ([e, t]) => D(len.ends(e), ang.one(t)) });
    if (k >= 3) out.push({ name: 'symmetric-ends-palindromic-angles', grid: product(ends(8), COARSE, COARSE), bounds: [[min, hiEnd], [1, 180], [1, 180]], build: ([e, a, b]) => D(len.ends(e), ang.palin(a, b)) });
    out.push({ name: 'taper-one-angle', grid: product(tapers, MEDIUM), bounds: [[0.5, 1.5], [1, 180]], build: ([r, t]) => D(len.taper(r), ang.one(t)) });
    out.push({ name: 'taper-first-angle-different', grid: product(tapers.filter((_, i) => i % 2 === 0), COARSE, COARSE), bounds: [[0.5, 1.5], [1, 180], [1, 180]], build: ([r, a, b]) => D(len.taper(r), ang.firstDiff(a, b)) });
  }
  return out;
}

// Final x and z extents of the folded cross-section, without building the full geometry.
function quickExtents(design) {
  let x = 0, z = 0, lx = 0, hx = 0, lz = 0, hz = 0, o = 0;
  const p = design.panelLengths, a = design.angles;
  for (let i = 0; i < p.length; i++) {
    if (i > 0) o += (i % 2 ? 1 : -1) * a[i - 1];
    const r = o * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
    x += p[i] * (Math.abs(c) < 1e-14 ? 0 : c); z += p[i] * (Math.abs(s) < 1e-14 ? 0 : s);
    lx = Math.min(lx, x); hx = Math.max(hx, x); lz = Math.min(lz, z); hz = Math.max(hz, z);
  }
  return [hx - lx, hz - lz];
}

// Final cross-section vertices (x, z), first panel along +x.
function finalSection(design) {
  const pts = [[0, 0]]; let o = 0;
  const p = design.panelLengths, a = design.angles;
  for (let i = 0; i < p.length; i++) {
    if (i > 0) o += (i % 2 ? 1 : -1) * a[i - 1];
    const r = o * Math.PI / 180, c = Math.cos(r), s = Math.sin(r), q = pts[i];
    pts.push([q[0] + p[i] * (Math.abs(c) < 1e-14 ? 0 : c), q[1] + p[i] * (Math.abs(s) < 1e-14 ? 0 : s)]);
  }
  return pts;
}

// Extents after turning the final shape by psi degrees about the hinge (y) axis (D30).
function turnedExtents(pts, psi) {
  if (!psi) {
    let lx = Infinity, hx = -Infinity, lz = Infinity, hz = -Infinity;
    for (const [x, z] of pts) { lx = Math.min(lx, x); hx = Math.max(hx, x); lz = Math.min(lz, z); hz = Math.max(hz, z); }
    return [hx - lx, hz - lz];
  }
  const r = psi * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  let lx = Infinity, hx = -Infinity, lz = Infinity, hz = -Infinity;
  for (const [x, z] of pts) {
    const X = x * c - z * s, Z = x * s + z * c;
    lx = Math.min(lx, X); hx = Math.max(hx, X); lz = Math.min(lz, Z); hz = Math.max(hz, Z);
  }
  return [hx - lx, hz - lz];
}

const placedDimensions = design => {
  const [dx, dz] = turnedExtents(finalSection(design), design.placement ?? 0);
  return [dx, design.width, dz];
};

/* Best placement angle in [0, 180) for fitting the usable box (extents repeat every 180 degrees).
 * Prefers 0, then 90, then the best of: panel and vertex-pair alignments with either box axis,
 * a 5-degree grid, and a local refinement. Returns { psi, overflow } (overflow <= 0 fits). */
function bestPlacement(design, request) {
  const pts = finalSection(design), u = usable(request.targetBox), L = request.length;
  const over = psi => { const [dx, dz] = turnedExtents(pts, psi); return Math.max((dx - u[0]) / L, (dz - u[2]) / L); };
  let diameter = 0;
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++)
    diameter = Math.max(diameter, Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]));
  const diagonal = Math.hypot(u[0], u[2]);
  if (diameter > diagonal * (1 + 1e-9)) return { psi: 0, overflow: (diameter - diagonal) / L };
  for (const psi of [0, 90]) { const o = over(psi); if (o <= 1e-12) return { psi, overflow: o }; }
  const tries = new Set();
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const ang = Math.atan2(pts[j][1] - pts[i][1], pts[j][0] - pts[i][0]) * 180 / Math.PI;
    for (const t of [-ang, 90 - ang]) tries.add(((t % 180) + 180) % 180);
  }
  for (let t = 0; t < 180; t += 5) tries.add(t);
  let best = { psi: 0, overflow: Infinity };
  for (const t of tries) { const o = over(t); if (o < best.overflow) best = { psi: t, overflow: o }; }
  for (let step = 2.5; step > 1e-4 && best.overflow > 0; step /= 2) {
    for (const t of [best.psi - step, best.psi + step]) { const o = over(t); if (o < best.overflow) best = { psi: ((t % 180) + 180) % 180, overflow: o }; }
  }
  return best;
}

// Largest final-shape overflow beyond the usable box, as a fraction of sheet length (<= 0 fits),
// at the best placement angle; records that angle on the design as `placement`.
function overflowOf(design, request) {
  const widthOver = (request.width - usable(request.targetBox)[1]) / request.length;
  const { psi, overflow } = bestPlacement(design, request);
  design.placement = +psi.toFixed(6);
  const turned = placedDimensions(design);
  const u = usable(request.targetBox);
  return Math.max(widthOver, (turned[0] - u[0]) / request.length, (turned[2] - u[2]) / request.length, overflow > 0 ? overflow : -Infinity);
}

// Deterministic pattern search (no randomness). Lower score is better; stops at `goal` or when steps are tiny.
function patternSearch(family, start, score, goal = -Infinity, budget = 400) {
  const minStep = family.bounds.map(([lo, hi]) => (hi - lo) / 2000);
  const clamp = p => p.map((x, i) => Math.min(family.bounds[i][1], Math.max(family.bounds[i][0], x)));
  let point = start, best = score(point), step = family.bounds.map(([lo, hi]) => (hi - lo) / 20), used = 0;
  while (best > goal && step.some((s, i) => s >= minStep[i]) && used < budget) {
    let moved = false;
    for (let i = 0; i < point.length && !moved; i++) for (const sign of [1, -1]) {
      const trial = clamp(point.map((x, k) => k === i ? x + sign * step[i] : x)), value = score(trial);
      used++;
      if (value < best) { point = trial; best = value; moved = true; break; }
    }
    if (!moved) step = step.map(s => s / 2);
  }
  return { point, score: best };
}

// Fit first; a fitting design that collides scores just above zero so the search keeps moving.
function fitScore(family, request) {
  return p => {
    const d = family.build(p);
    if (ruleViolations(d, request).length) return Infinity;
    const over = overflowOf(d, request);
    if (over > 0) return over;
    return motionMetrics(d, 30).blockedSamples ? 1e-6 : 0;
  };
}

// Valid fitting designs score -spread/180, so minimizing widens the smallest opening angle.
function spreadScore(family, request) {
  return p => {
    const d = family.build(p);
    if (ruleViolations(d, request).length) return Infinity;
    const over = overflowOf(d, request);
    if (over > 0) return 1 + over;
    if (motionMetrics(d, 30).blockedSamples) return 0.5;
    return -spreadOf(d) / 180;
  };
}

/* All fitting candidates for n panels: grid points, plus fit-refined near-misses. Each carries
 * cheap measures (spread, symmetry, order); contacts are screened later and lazily. */
function fittingCandidates(n, request, { refineStarts = 24 } = {}) {
  const out = [];
  for (const family of families(n, request)) {
    const near = [];
    for (const params of family.grid) {
      const design = family.build(params);
      if (ruleViolations(design, request).length) continue;
      const over = overflowOf(design, request);
      if (over <= 0) out.push({ family: family.name, familyRef: family, params, design });
      else near.push([over, params]);
    }
    if (!family.bounds.length) continue;
    near.sort((a, b) => a[0] - b[0]);
    for (const [, params] of near.slice(0, refineStarts)) {
      const r = patternSearch(family, params, fitScore(family, request), 0);
      if (r.score <= 0) {
        const design = family.build(r.point);
        if (overflowOf(design, request) <= 0) out.push({ family: family.name + '+fit-refined', familyRef: family, params: r.point, design });
      }
    }
  }
  for (const c of out) Object.assign(c, { folds: n - 1, spread: spreadOf(c.design), symmetric: isSymmetric(c.design), order: orderScore(c.design) });
  return out;
}

/* Reference answers for fold budgets minimum .. minimum + extraBudgets (D26).
 * For each budget: find the widest valid opening angle (grid, then spread refinement), take the
 * 10% band, rank it, and revalidate the winner at 720 samples. Deterministic; "not-found" is not proof. */
function referenceSolveBudgets(request, { maxPanels = RULES.maxPanels, extraBudgets = RULES.extraBudgets } = {}) {
  const started = Date.now();
  const reason = analyticallyInfeasible(request);
  if (reason) return { status: 'analytically-infeasible', reason, answers: [], elapsedMs: Date.now() - started };
  const pool = [], screened = new Map();
  const keyOf = d => d.panelLengths.map(x => x.toFixed(6)).join(',') + '|' + d.angles.map(x => x.toFixed(6)).join(',');
  const metricsOf = c => {
    const key = keyOf(c.design);
    if (!screened.has(key)) {
      const m = motionMetrics(c.design, RULES.screeningSteps);
      screened.set(key, m.blockedSamples ? null : { folds: c.folds, spread: c.spread, symmetric: c.symmetric, order: c.order,
        minGap: m.minGap, sweptArea: m.sweptArea, dimensions: placedDimensions(c.design), candidate: c });
    }
    return screened.get(key);
  };
  const validIn = (list, limit) => { const out = []; for (const c of list) { const m = metricsOf(c); if (m) { out.push(m); if (out.length >= limit) break; } } return out; };
  // Minimum feasible fold count: smallest n with a valid fitting candidate.
  let minPanels = null;
  for (let n = 1; n <= maxPanels && minPanels === null; n++) {
    const cands = fittingCandidates(n, request).sort((a, b) => b.spread - a.spread);
    pool.push(...cands);
    if (validIn(cands, 1).length) minPanels = n;
  }
  if (minPanels === null) return { status: 'not-found', answers: [], elapsedMs: Date.now() - started };
  const lastPanels = Math.min(maxPanels, minPanels + extraBudgets);
  for (let n = minPanels + 1; n <= lastPanels; n++) pool.push(...fittingCandidates(n, request));
  const answers = [];
  for (let budget = minPanels - 1; budget <= lastPanels - 1; budget++) {
    const allowed = pool.filter(c => c.folds <= budget).sort((a, b) => b.spread - a.spread);
    // Widest valid openings, then spread refinement from the best few of each family.
    const seeds = validIn(allowed, 400);
    const perFamily = new Map();
    for (const m of seeds) { const f = m.candidate.familyRef; if (!f.bounds.length) continue; const list = perFamily.get(f) || []; if (list.length < 3) { list.push(m); perFamily.set(f, list); } }
    for (const [family, list] of perFamily) for (const m of list) {
      const r = patternSearch(family, m.candidate.params, spreadScore(family, request), -1, 300);
      if (r.score < 0) {
        const design = family.build(r.point);
        if (overflowOf(design, request) > 0) continue;   // also records the placement angle
        const c = { family: family.name + '+spread-refined', familyRef: family, params: r.point, design,
          folds: design.angles.length, spread: spreadOf(design), symmetric: isSymmetric(design), order: orderScore(design) };
        pool.push(c); allowed.push(c);
      }
    }
    allowed.sort((a, b) => b.spread - a.spread);
    const top = validIn(allowed, 1)[0];
    if (!top) continue;
    const cut = (1 - RULES.spreadTieBand) * top.spread - 1e-9;
    // Screen the band in ranking order; stop after enough valid designs in the leading class.
    const band = allowed.filter(c => c.spread >= cut)
      .sort((a, b) => (a.symmetric === b.symmetric ? 0 : a.symmetric ? -1 : 1) || a.folds - b.folds || a.order - b.order || b.spread - a.spread);
    const valid = []; let leadClass = null;
    for (const c of band) {
      const cls = `${c.symmetric}|${c.folds}|${c.order}`;
      if (leadClass && cls !== leadClass) break;
      const m = metricsOf(c);
      if (m) { valid.push(m); leadClass = leadClass || cls; if (valid.length >= 150) break; }
    }
    for (const m of rankDesigns(valid.length ? valid : [top])) {
      const quality = assess(m.candidate.design, request);
      if (quality.passes) { answers.push({ budget, family: m.candidate.family, design: m.candidate.design, quality }); break; }
    }
  }
  return { status: answers.length ? 'found' : 'not-found', minFolds: minPanels - 1, answers, elapsedMs: Date.now() - started };
}

// Single answer at the minimum budget (or a given budget), for callers that need one design.
function referenceSolve(request, options = {}) {
  const r = referenceSolveBudgets(request, options);
  const pick = options.budget === undefined ? r.answers[0] : r.answers.find(a => a.budget === options.budget);
  return { ...r, family: pick?.family, design: pick?.design, quality: pick?.quality, status: pick ? 'found' : r.status };
}

module.exports = { RULES, usable, fitsWithMargin, ruleViolations, orderScore, isSymmetric, spreadOf, segmentDistance,
  motionMetrics, assess, compareWithinBand, rankDesigns, analyticallyInfeasible, handRule, families, quickExtents, finalSection, turnedExtents, placedDimensions, bestPlacement, overflowOf,
  fittingCandidates, referenceSolveBudgets, referenceSolve };
