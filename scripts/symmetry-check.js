#!/usr/bin/env node
// Hypothesis check (2026-11-05): which folded-shape symmetry do panel/angle patterns produce? Usage: node scripts/symmetry-check.js
// Which symmetry does a folded cross-section have? Mirror (reflection) or point (180-degree rotation).
const { foldAccordion } = require('../src/accordion');
const tol = 1e-6;
function symmetry(q) {
  const n = q.length - 1, P0 = q[0], PN = q[n];
  const point = q.every((p, i) => Math.hypot(p[0] + q[n - i][0] - P0[0] - PN[0], p[1] + q[n - i][1] - P0[1] - PN[1]) < tol);
  // Mirror maps P_i to P_{n-i}; axis = perpendicular bisector of P0-PN (or, if they coincide, try the axis through P0 and the middle vertex).
  const reflect = (p, a, u) => { const d = [p[0] - a[0], p[1] - a[1]], t = d[0] * u[0] + d[1] * u[1]; return [a[0] + 2 * t * u[0] - d[0], a[1] + 2 * t * u[1] - d[1]]; };
  let mirror = false;
  const dx = PN[0] - P0[0], dz = PN[1] - P0[1], len = Math.hypot(dx, dz);
  const axes = len > tol ? [[[(P0[0] + PN[0]) / 2, (P0[1] + PN[1]) / 2], [-dz / len, dx / len]]] : [];
  if (len <= tol && n % 2 === 0) { const m = q[n / 2], ml = Math.hypot(m[0] - P0[0], m[1] - P0[1]); if (ml > tol) axes.push([P0, [(m[0] - P0[0]) / ml, (m[1] - P0[1]) / ml]]); }
  for (const [a, u] of axes) if (q.every((p, i) => { const r = reflect(p, a, u); return Math.hypot(r[0] - q[n - i][0], r[1] - q[n - i][1]) < tol; })) mirror = true;
  return mirror && point ? 'both' : mirror ? 'mirror' : point ? 'point' : 'none';
}
const rows = [];
for (let N = 2; N <= 8; N++) {
  const eq = Array(N).fill(100 / N), pal = Array.from({ length: N }, (_, i) => 10 + 5 * Math.min(i, N - 1 - i));
  const s = pal.reduce((a, b) => a + b, 0), palN = pal.map(x => x * 100 / s);
  const tap = Array.from({ length: N }, (_, i) => 30 - 3 * i), ts = tap.reduce((a, b) => a + b, 0), tapN = tap.map(x => x * 100 / ts);
  const pats = {
    'uniform angle t': Array(N - 1).fill(150),
    'palindromic angles a,b,..,b,a': Array.from({ length: N - 1 }, (_, i) => (i === 0 || i === N - 2) ? 120 : 160),
    'first different a,b,b..': Array.from({ length: N - 1 }, (_, i) => i === 0 ? 120 : 160),
  };
  for (const [lname, L] of [['equal', eq], ['palindromic lengths', palN], ['tapered', tapN]])
    for (const [aname, A] of Object.entries(pats)) {
      const q = foldAccordion({ panelLengths: L, width: 10, angles: A }).section;
      rows.push([N, lname, aname, symmetry(q)]);
    }
}
const by = {}; for (const [N, l, a, s] of rows) { const k = l + ' | ' + a; (by[k] = by[k] || []).push(N + ':' + s); }
for (const k in by) console.log(k.padEnd(52), by[k].join('  '));
