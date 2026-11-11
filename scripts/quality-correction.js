#!/usr/bin/env node
// Quality-seeking correction (experiments/quality-correction-v1/PLAN.md). Unlike repair-designs.js, which stops
// at "fits", this search follows the answer key's priorities from any start, including starts that already fit:
//   rules -> fit (2% gap) -> no collisions -> every crease on a wall -> widest smallest opening angle.
// Deterministic two-stage pattern search over all panel lengths and angles (fold count unchanged): stage 1 fits
// and opens wide, stage 2 adds the wall term. Pair moves when single-coordinate moves stall; restarts at larger steps. Snapshots at given score-call caps equal what a
// run capped there would return. Final acceptance is the canonical placement + 721-state assessment.
const P = require('../src/packing');
const { performance } = require('node:perf_hooks');

// Smallest overshoot (fraction of sheet length) over turning angles; unlike P.overflowOf it has no shortcut
// for shapes that cannot fit, so the search gets a usable signal while a design still pokes out.
function minOvershoot(d, request) {
  const pts = P.finalSection(d), u = P.usable(request.targetBox), L = request.length;
  const over = t => { const [dx, dz] = P.turnedExtents(pts, t); return Math.max((dx - u[0]) / L, (dz - u[2]) / L); };
  const tries = new Set();
  for (let t = 0; t < 180; t += 5) tries.add(t);
  for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
    const a = Math.atan2(pts[j][1] - pts[i][1], pts[j][0] - pts[i][0]) * 180 / Math.PI;
    for (const t of [-a, 90 - a]) tries.add(((t % 180) + 180) % 180);
  }
  let bt = 0, bo = Infinity;
  for (const t of tries) { const o = over(t); if (o < bo) { bo = o; bt = t; } }
  for (let s = 2.5; s > 1e-3; s /= 2) for (const t of [bt - s, bt + s]) { const o = over(t); if (o < bo) { bo = o; bt = t; } }
  return Math.max(bo, (request.width - u[1]) / L);
}

// walls = false: stage 1 (fit, no collisions, widest opening). walls = true: stage 2 (also every crease on a wall).
function qualityScore(d, request, walls = true) {
  if (P.ruleViolations(d, request).length) return Infinity;
  const over = minOvershoot(d, request);
  if (over > 1e-9) return 100 + over;
  if (P.motionMetrics(d, 30).blockedSamples) return 50;
  if (!walls) return -P.spreadOf(d) / 180;
  const w = P.wallPlacement(d, request);
  if (w.overflow > 0) return 100 + Math.max(w.overflow, 1e-9);
  if (w.floating > 0) return w.floating + Math.min(0.9, 10 * w.distance);
  return -P.spreadOf(d) / 180;
}

function finish(d, request) {
  const x = structuredClone(d); P.wallPlacement(x, request); const q = P.assess(x, request);
  return { design: x, passes: q.passes, floating: P.floatingAt(x, request), spread: q.spread, folds: q.folds, quality: q };
}

function qualityCorrect(design, request, caps = [400]) {
  caps = [...caps].sort((a, b) => a - b);
  const maxCap = caps[caps.length - 1], started = performance.now();
  const d0 = { panelLengths: [...design.panelLengths], width: design.width, angles: [...design.angles] };
  const n = d0.panelLengths.length, snaps = new Map();
  let evaluations = 0, point = null, fam = null;
  const current = () => point ? fam.build(point) : d0;
  if (n >= 2 && !P.ruleViolations(d0, request).length) {
    fam = P.freeFamily(n, request, false);
    let walls = false;
    const score = p => {
      if (evaluations >= maxCap) throw Object.assign(Error('cap'), { cap: true });
      if (caps.includes(evaluations) && !snaps.has(evaluations)) snaps.set(evaluations, { point: point && [...point], ms: performance.now() - started });
      evaluations++;
      return qualityScore(fam.build(p), request, walls);
    };
    const clamp = x => Math.min(1, Math.max(0, x));
    try {
      point = fam.encode(d0).map(clamp);
      // Stage 1 opens the design as wide as fits; stage 2 then brings creases onto walls and widens within that.
      // One stage alone stalls: with the wall term active, opening wider means a crease must leave its wall first.
      for (const [useWalls, steps] of [[false, [0.02, 0.4]], [true, [0.02, 0.1]]]) {
        walls = useWalls;
        let best = score(point);
        for (const startStep of steps) {
          let step = startStep;
          while (step >= 1 / 2000) {
            let moved = false;
            for (let i = 0; i < point.length && !moved; i++) for (const s of [1, -1]) {
              const t = point.map((x, j) => j === i ? clamp(x + s * step) : x), v = score(t);
              if (v < best) { point = t; best = v; moved = true; break; }
            }
            for (let i = 0; i < point.length && !moved; i++) for (let j = i + 1; j < point.length && !moved; j++)
              for (const [a, b] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
                const t = point.map((x, k) => k === i ? clamp(x + a * step) : k === j ? clamp(x + b * step) : x), v = score(t);
                if (v < best) { point = t; best = v; moved = true; break; }
              }
            if (!moved) step /= 2;
          }
        }
      }
    } catch (e) { if (!e.cap) throw e; }
  }
  const searchMs = performance.now() - started, final = { point: point && [...point], ms: searchMs };
  const results = caps.map(cap => {
    const s = snaps.get(cap) || final, t = performance.now();
    const r = finish(s.point ? fam.build(s.point) : d0, request);
    return { cap, evaluations: Math.min(evaluations, cap), searchMs: s.ms, finishMs: performance.now() - t, ...r };
  });
  return { evaluations, searchMs, results };
}

module.exports = { qualityCorrect, qualityScore, minOvershoot };
