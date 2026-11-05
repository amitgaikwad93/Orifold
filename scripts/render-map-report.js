#!/usr/bin/env node
// Render the request-space map (and optional completeness check) as one self-contained HTML page.
// Usage: node scripts/render-map-report.js <map.json> <output.html> [completeness.json]
const fs = require('fs');
const [mapPath, output, completenessPath, spreadPath] = process.argv.slice(2);
if (!mapPath || !output) { console.error('Usage: <map.json> <output.html> [completeness.json] [spread-check.json]'); process.exit(2); }
const map = JSON.parse(fs.readFileSync(mapPath, 'utf8'));
const load = p => p && fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, 'utf8')) : null;
const check = load(completenessPath), spreadCheck = load(spreadPath);
const L = map.sheet.length, r = (x, d) => +x.toFixed(d);
const key = (x, z) => `${x},${z}`;
const checked = new Map((check?.records ?? []).map(x => [key(x.boxLength, x.boxHeight), x]));
const spreadChecked = new Map((spreadCheck?.records ?? []).map(x => [key(x.boxLength, x.boxHeight) + '|' + x.budget, x]));
const familyName = f => (f || '').replace(/\+.*$/, '');
const cells = map.cells.map(c => {
  const k = checked.get(key(c.boxLength, c.boxHeight));
  const answers = (c.answers ?? []).map(a => {
    const sc = spreadChecked.get(key(c.boxLength, c.boxHeight) + '|' + a.budget);
    return { budget: a.budget, family: familyName(a.family), folds: a.quality.folds, order: a.quality.order,
      sym: a.quality.symmetric, spread: r(a.quality.spread, 1),
      gap: Number.isFinite(a.quality.minGap) ? r(a.quality.minGap, 4) : null, sweep: r(a.quality.sweptArea, 4),
      dims: [r(a.quality.dimensions[0] / L, 4), r(a.quality.dimensions[2] / L, 4)],
      panels: a.design.panelLengths.map(p => r(p / L, 4)), angles: a.design.angles.map(x => r(x, 2)),
      spreadCheck: sc ? (sc.beyondBand ? 'beaten' : 'confirmed') : null, freeSpread: sc?.freeSpread ?? null };
  });
  return { x: c.boxLength, z: c.boxHeight,
    s: c.status === 'found' ? 'found' : c.status === 'analytically-infeasible' ? 'infeasible' : 'unknown',
    minFolds: c.minFolds ?? null, hand: c.handRule ? c.handRule.folds : null, answers,
    check: k ? (k.fewerFoldsFound ? 'beaten' : 'confirmed') : null };
});
const found = cells.filter(c => c.s === 'found');
const allAnswers = found.flatMap(c => c.answers);
const stats = {
  total: cells.length, found: found.length,
  infeasible: cells.filter(c => c.s === 'infeasible').length, unknown: cells.filter(c => c.s === 'unknown').length,
  fewer: found.filter(c => c.hand !== null && c.hand > c.minFolds).length,
  symmetric: allAnswers.filter(a => a.sym).length, answers: allAnswers.length,
  checked: check?.summary.sampled ?? 0, beaten: check?.summary.referenceBeaten ?? 0,
  spreadChecked: spreadCheck?.summary.cellBudgetsChecked ?? 0, spreadBeaten: spreadCheck?.summary.freeWiderBeyondBand ?? 0,
};
const data = JSON.stringify({ lengths: map.lengths, heights: map.heights, cells, stats });

const html = String.raw`<title>Fold Count Map</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..100,400..700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: drafting-table tool. Map on the left, the selected fold's side view on the right; stacks on phones. */
:root {
  --paper: #f6f7f4; --sheet: #ffffff; --ink: #15181a; --ink-2: #545a5f; --rule: #d8dbd5;
  --accent: #2a78d6; --critical: #c93a39; --panel-a: #2a78d6; --panel-b: #86b6ef; --box: #15181a;
  --f0: #b7d3f6; --f1: #86b6ef; --f2: #5598e7; --f3: #2a78d6; --f4: #256abf; --f5: #1c5cab; --f6: #184f95; --f7: #104281; --f8: #0d366b;
  --t-light: #15181a; --t-dark: #ffffff;
  --display: "Archivo", "Helvetica Neue", Arial, sans-serif; --body: "Archivo", "Helvetica Neue", Arial, sans-serif;
  --mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --paper: #131517; --sheet: #1b1e21; --ink: #eceeeb; --ink-2: #a9aeaa; --rule: #33383b;
  --accent: #3987e5; --critical: #e66767; --panel-a: #6da7ec; --panel-b: #256abf; --box: #eceeeb;
  --f0: #184f95; --f1: #1c5cab; --f2: #256abf; --f3: #2a78d6; --f4: #3987e5; --f5: #5598e7; --f6: #6da7ec; --f7: #86b6ef; --f8: #b7d3f6;
  --t-light: #ffffff; --t-dark: #15181a; color-scheme: dark; } }
:root[data-theme="dark"] {
  --paper: #131517; --sheet: #1b1e21; --ink: #eceeeb; --ink-2: #a9aeaa; --rule: #33383b;
  --accent: #3987e5; --critical: #e66767; --panel-a: #6da7ec; --panel-b: #256abf; --box: #eceeeb;
  --f0: #184f95; --f1: #1c5cab; --f2: #256abf; --f3: #2a78d6; --f4: #3987e5; --f5: #5598e7; --f6: #6da7ec; --f7: #86b6ef; --f8: #b7d3f6;
  --t-light: #ffffff; --t-dark: #15181a; color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--paper); color: var(--ink); font-family: var(--body); font-size: 15px; line-height: 1.5; }
.wrap { max-width: 1180px; margin: 0 auto; padding-block: 28px 48px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 24px; }
header { display: grid; gap: 8px; max-width: 72ch; }
.eyebrow { font-family: var(--mono); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-2); }
h1 { font-family: var(--display); font-stretch: 80%; font-weight: 700; font-size: clamp(30px, 5vw, 44px); line-height: 1.05; margin: 0; text-wrap: balance; }
h2 { font-family: var(--display); font-stretch: 85%; font-weight: 650; font-size: 19px; margin: 0; }
p { margin: 0; }
.lede { color: var(--ink-2); max-width: 68ch; }
.facts { display: grid; grid-template-columns: repeat(auto-fill, minmax(210px, 1fr)); gap: 10px 24px; margin-top: 6px; max-width: 900px; }
.facts div { display: grid; gap: 0; border-top: 1px solid var(--rule); padding-top: 6px; }
.facts span { font-size: 12.5px; color: var(--ink-2); }
.facts b { font-family: var(--mono); font-size: 20px; font-weight: 500; font-variant-numeric: tabular-nums; }
header { max-width: none; }
.cap { font-size: 12.5px; color: var(--ink-2); }
.main { display: grid; grid-template-columns: minmax(0, 1.25fr) minmax(0, 1fr); gap: 24px; align-items: start; }
@media (max-width: 860px) { .main { grid-template-columns: minmax(0, 1fr); } }
.card { background: var(--sheet); border: 1px solid var(--rule); border-radius: 6px; padding: 16px; display: grid; gap: 12px; min-width: 0; }
.controls { display: flex; flex-wrap: wrap; gap: 10px 16px; align-items: center; justify-content: space-between; }
.seg { display: inline-flex; border: 1px solid var(--rule); border-radius: 6px; overflow: hidden; }
.seg button { font: inherit; font-size: 13px; padding: 6px 12px; border: 0; background: transparent; color: var(--ink-2); cursor: pointer; }
.seg button[aria-pressed="true"] { background: var(--ink); color: var(--sheet); }
button:focus-visible, .cell:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.chart { overflow-x: auto; position: relative; }
svg text { font-family: var(--mono); }
.cell { cursor: pointer; }
.cell rect.bg { stroke: var(--sheet); stroke-width: 1.5; }
.cell.sel rect.bg { stroke: var(--ink); stroke-width: 2.5; }
.legend { display: flex; flex-wrap: wrap; gap: 6px 16px; font-size: 12.5px; color: var(--ink-2); align-items: center; }
.sw { display: inline-block; width: 14px; height: 14px; border-radius: 3px; vertical-align: -3px; margin-right: 6px; }
.tip { position: absolute; pointer-events: none; background: var(--ink); color: var(--sheet); font-size: 12.5px; padding: 6px 9px; border-radius: 4px; white-space: nowrap; font-variant-numeric: tabular-nums; }
.detail h2 { display: flex; justify-content: space-between; gap: 12px; flex-wrap: wrap; align-items: baseline; }
.detail h2 small { font-family: var(--mono); font-weight: 400; font-size: 13px; color: var(--ink-2); }
.pill { font-family: var(--mono); font-size: 12px; padding: 2px 8px; border-radius: 999px; border: 1px solid var(--rule); color: var(--ink-2); }
.side { width: 100%; height: auto; max-width: 100%; aspect-ratio: 1 / 1; background: var(--paper); border-radius: 4px; }
.motion { display: flex; gap: 12px; align-items: center; }
.motion input { flex: 1; min-width: 0; accent-color: var(--accent); }
.motion button { font: inherit; font-size: 13px; padding: 6px 12px; border-radius: 6px; border: 1px solid var(--rule); background: var(--paper); color: var(--ink); cursor: pointer; min-width: 64px; }
dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 4px 16px; margin: 0; font-size: 13.5px; }
dt { color: var(--ink-2); }
dd { margin: 0; font-family: var(--mono); font-size: 13px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.note { font-size: 13.5px; color: var(--ink-2); max-width: 75ch; display: grid; gap: 8px; }
.note h2 { color: var(--ink); }
.warn { color: var(--critical); }
@media (prefers-reduced-motion: reduce) { * { transition: none !important; } }
</style>

<div class="wrap">
  <header>
    <div class="eyebrow">Orifold · experiment v2 · request-space map</div>
    <h1>Fold Count Map</h1>
    <p class="lede" style="max-width:68ch">Each square is one packing request: a 100 × 10 sheet into a box of the given length and height, with a 2% gap. Each request also has a fold budget: the fewest folds that work, or one or two more. Within the budget the solver picks the most spread design (widest smallest opening angle between neighbouring panels), preferring symmetric designs within 10% of the widest. Select a square to see the design and play its motion.</p>
    <div class="facts" id="facts"></div>
  </header>
  <div class="main">
    <section class="card" aria-labelledby="map-title">
      <div class="controls">
        <h2 id="map-title">Box shapes</h2>
        <div class="seg" role="group" aria-label="Map view">
          <button id="view-folds" aria-pressed="true">Fewest folds</button>
          <button id="view-spread" aria-pressed="false">Opening angle</button>
          <button id="view-saved" aria-pressed="false">Saved vs hand rule</button>
        </div>
        <div class="seg" role="group" aria-label="Fold budget">
          <button id="b0" aria-pressed="true">Fewest</button>
          <button id="b1" aria-pressed="false">+1 fold</button>
          <button id="b2" aria-pressed="false">+2 folds</button>
        </div>
      </div>
      <div class="chart" id="chart"><div class="tip" id="tip" hidden></div></div>
      <div class="legend" id="legend"></div>
    </section>
    <section class="card detail" aria-live="polite" id="detail"></section>
  </div>
  <section class="note">
    <h2>How to read this</h2>
    <p><b>Hand rule:</b> fold flat into the fewest equal panels whose length fits the box, ignoring height. "Folds saved" counts how many fewer folds the solver needed by also using the box's height.</p>
    <p><b>Fold budget and spread:</b> the budget buttons choose how many folds are allowed: the fewest that work, or one or two more. The opening-angle view shows the smallest angle between neighbouring panels for that budget; bigger means more spread. A small dot marks symmetric designs (mirror for even panel counts, rotational for odd).</p>
    <p><b>Reference solver:</b> searches design families (equal, different-first, symmetric-ends and tapered panels; one, first-different or palindromic angles) on a fixed grid, refined deterministically for fit and for spread. It has no randomness. A square marked "?" means it found nothing within 11 folds, which is not proof that no design exists. Squares marked × are proven impossible: even the shortest allowed first panel (5% of the sheet) is longer than the box.</p>
    <p><b>Solver checks:</b> ringed squares were re-checked by independent free-form random searches. In the fold views: a search for one fold fewer. In the opening-angle view: a search for a wider opening at the same budget. A red ring means the search beat the reference (for spread, by more than the 10% band).</p>
    <p><b>Limits:</b> zero-thickness rigid panels, contacts checked at 721 sampled motion states, motion not required to stay inside the box. Full list in docs/LIMITATIONS.md. Box width is fixed at 12 and does not change the fold.</p>
  </section>
</div>

<script>
const DATA = ${data};
const $ = id => document.getElementById(id);
const S = DATA.stats;
$('facts').innerHTML = [
  ['Requests', S.total], ['Solved', S.found], ['Proven impossible', S.infeasible], ['Not found', S.unknown],
  ['Fewer folds than hand rule', S.fewer], ['Symmetric answers', S.symmetric + ' / ' + S.answers],
  ...(S.checked ? [['Fold re-checks beaten', S.beaten + ' / ' + S.checked]] : []),
  ...(S.spreadChecked ? [['Spread re-checks beaten', S.spreadBeaten + ' / ' + S.spreadChecked]] : []),
].map(([k, v]) => '<div><b>' + v + '</b><span>' + k + '</span></div>').join('');

const NS = 'http://www.w3.org/2000/svg';
const el = (tag, attrs = {}, parent) => { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; };
const CS = 21, ML = 50, MB = 46, MT = 8, MR = 8;
const cols = DATA.lengths.length, rows = DATA.heights.length;
const W = ML + cols * CS + MR, H = MT + rows * CS + MB;
const svg = el('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, role: 'img', 'aria-label': 'Fewest folds by box length and box height' });
$('chart').prepend(svg);
const defs = el('defs', {}, svg);
const hatch = el('pattern', { id: 'hatch', width: 5, height: 5, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
el('rect', { width: 5, height: 5, fill: 'var(--paper)' }, hatch);
el('line', { x1: 0, y1: 0, x2: 0, y2: 5, stroke: 'var(--rule)', 'stroke-width': 2 }, hatch);
const colX = i => ML + i * CS, rowY = j => MT + (rows - 1 - j) * CS;
// Axes: ticks only at values the grid actually contains.
DATA.lengths.forEach((v, i) => { if (Math.abs(v * 5 - Math.round(v * 5)) < 1e-6) {
  const t = el('text', { x: colX(i) + CS / 2, y: MT + rows * CS + 16, 'text-anchor': 'middle', 'font-size': 11, fill: 'var(--ink-2)' }, svg); t.textContent = v.toFixed(1); } });
DATA.heights.forEach((v, j) => { if (j % 5 === 0) {
  const t = el('text', { x: ML - 6, y: rowY(j) + CS / 2 + 4, 'text-anchor': 'end', 'font-size': 11, fill: 'var(--ink-2)' }, svg); t.textContent = v.toFixed(2); } });
el('text', { x: ML + cols * CS / 2, y: H - 6, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--ink)' }, svg).textContent = 'Box length ÷ sheet length →';
const yl = el('text', { x: 12, y: MT + rows * CS / 2, 'text-anchor': 'middle', 'font-size': 12, fill: 'var(--ink)', transform: 'rotate(-90 12 ' + (MT + rows * CS / 2) + ')' }, svg);
yl.textContent = 'Box height ÷ sheet length →';

let view = 'folds', budget = 0, selected = null;
const shade = n => { const k = Math.min(8, Math.max(0, n)); return ['var(--f' + k + ')', k <= 2 ? 'var(--t-light)' : 'var(--t-dark)']; };
const ANGLE_BINS = [5, 10, 20, 30, 45, 60, 90, 179.9];   // upper edges; above = no fold (180)
const angleBin = a => { const i = ANGLE_BINS.findIndex(e => a < e); return i === -1 ? 8 : i; };
const answerOf = c => c.answers[Math.min(budget, c.answers.length - 1)];
const nodes = DATA.cells.map(c => {
  const i = DATA.lengths.findIndex(v => Math.abs(v - c.x) < 1e-9), j = DATA.heights.findIndex(v => Math.abs(v - c.z) < 1e-9);
  const g = el('g', { class: 'cell', tabindex: 0, role: 'button' }, svg);
  const bg = el('rect', { class: 'bg', x: colX(i), y: rowY(j), width: CS, height: CS, rx: 2 }, g);
  const ring = el('rect', { x: colX(i) + 2.5, y: rowY(j) + 2.5, width: CS - 5, height: CS - 5, rx: 2, fill: 'none', 'stroke-width': 1.6 }, g);
  const label = el('text', { x: colX(i) + CS / 2, y: rowY(j) + CS / 2 + 4, 'text-anchor': 'middle', 'font-size': 10.5 }, g);
  const dot = el('circle', { cx: colX(i) + CS - 4, cy: rowY(j) + 4, r: 1.8 }, g);
  g.addEventListener('click', () => select(c));
  g.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); select(c); } });
  g.addEventListener('mouseenter', () => showTip(c, i, j));
  g.addEventListener('mouseleave', () => { $('tip').hidden = true; });
  return { c, g, bg, ring, label, dot };
});
function paint() {
  for (const { c, g, bg, ring, label, dot } of nodes) {
    g.classList.toggle('sel', c === selected);
    dot.setAttribute('fill', 'none'); label.setAttribute('font-size', 10.5);
    let check = null;
    if (c.s !== 'found') {
      bg.setAttribute('fill', c.s === 'infeasible' ? 'url(#hatch)' : 'var(--paper)');
      label.setAttribute('fill', 'var(--ink-2)'); label.textContent = c.s === 'infeasible' ? '×' : '?';
    } else if (view === 'spread') {
      const a = answerOf(c), k = angleBin(a.spread), [f, t] = shade(k);
      bg.setAttribute('fill', f); label.setAttribute('fill', t);
      label.textContent = Math.round(a.spread); if (a.spread >= 99.5) label.setAttribute('font-size', 8.5);
      if (a.sym) dot.setAttribute('fill', t);
      check = a.spreadCheck;
    } else {
      const v = view === 'folds' ? c.minFolds : (c.hand === null ? null : c.hand - c.minFolds);
      if (v === null) { bg.setAttribute('fill', 'var(--paper)'); label.setAttribute('fill', 'var(--ink)'); label.textContent = '∞'; }
      else { const [f, t] = shade(v); bg.setAttribute('fill', f); label.setAttribute('fill', t); label.textContent = v; }
      check = c.check;
    }
    ring.setAttribute('stroke', check === 'beaten' ? 'var(--critical)' : check === 'confirmed' ? 'var(--ink)' : 'none');
    ring.setAttribute('stroke-opacity', check === 'confirmed' ? 0.45 : 1);
    ring.setAttribute('stroke-width', check === 'beaten' ? 2.2 : 1.2);
  }
  const names = view === 'spread' ? ['<5°', '5–10', '10–20', '20–30', '30–45', '45–60', '60–90', '90+', 'no fold'] : [0, 1, 2, 3, 4, 5, 6, 7, '8+'];
  const steps = names.map((n, k) => '<span><i class="sw" style="background:var(--f' + k + ')"></i>' + n + '</span>').join('');
  $('legend').innerHTML = '<span>' + (view === 'folds' ? 'Fewest folds:' : view === 'saved' ? 'Folds saved:' : 'Smallest opening angle:') + '</span>' + steps +
    '<span><i class="sw" style="background:url(#hatch);border:1px solid var(--rule)"></i>× impossible</span><span>? not found</span>' +
    (view === 'saved' ? '<span>∞ hand rule needs over 11 folds</span>' : '') + (view === 'spread' ? '<span>• symmetric</span>' : '') +
    '<span><i class="sw" style="border:1.5px solid var(--ink);opacity:.6"></i>re-checked</span><span><i class="sw" style="border:2px solid var(--critical)"></i>re-check beat the solver</span>';
  ['b0', 'b1', 'b2'].forEach((id, k) => $(id).setAttribute('aria-pressed', String(k === budget)));
  ['folds', 'spread', 'saved'].forEach(v => $('view-' + v).setAttribute('aria-pressed', String(v === view)));
}
function showTip(c, i, j) {
  const t = $('tip');
  let desc;
  if (c.s === 'found') { const a = answerOf(c); desc = 'fewest ' + c.minFolds + ' · budget ' + a.budget + ': ' + a.folds + ' folds, opening ' + a.spread.toFixed(0) + '°' + (a.sym ? ', symmetric' : ''); }
  else desc = c.s === 'infeasible' ? 'proven impossible' : 'none found within 11 folds';
  t.textContent = 'Box ' + (c.x * 100).toFixed(0) + ' × ' + (c.z * 100).toFixed(0) + ' — ' + desc;
  t.hidden = false;
  const chart = $('chart'), left = colX(i) + CS + 6 - chart.scrollLeft, top = rowY(j) - 6;
  t.style.left = Math.min(left, chart.clientWidth - t.offsetWidth - 4) + 'px'; t.style.top = Math.max(0, top) + 'px';
}
['folds', 'spread', 'saved'].forEach(v => { $('view-' + v).onclick = () => { view = v; paint(); }; });
['b0', 'b1', 'b2'].forEach((id, k) => { $(id).onclick = () => { budget = k; paint(); if (selected) { stop(); progress = 1; renderDetail(); } }; });

// Same kinematics as src/accordion.js: alternating signed rotations, scaled by motion progress.
function section(panels, angles, t) {
  const pts = [[0, 0]]; let o = 0;
  panels.forEach((len, i) => { if (i > 0) o += (i % 2 ? 1 : -1) * angles[i - 1] * t; const a = o * Math.PI / 180, p = pts[i]; pts.push([p[0] + len * Math.cos(a), p[1] + len * Math.sin(a)]); });
  return pts;
}
const FAMILY = { 'flat': 'No fold', 'equal-one-angle': 'Equal panels, one angle', 'equal-first-angle-different': 'Equal panels, first angle different',
  'equal-palindromic-angles': 'Equal panels, symmetric angles', 'first-panel-one-angle': 'Different first panel, one angle',
  'first-panel-first-angle-different': 'Different first panel, first angle different', 'symmetric-ends-one-angle': 'Symmetric end panels, one angle',
  'symmetric-ends-palindromic-angles': 'Symmetric end panels, symmetric angles', 'taper-one-angle': 'Tapered panels, one angle',
  'taper-first-angle-different': 'Tapered panels, first angle different' };
let progress = 1, playing = null;
function select(c) { selected = c; stop(); progress = 1; paint(); renderDetail(); }
function renderDetail() {
  const c = selected, d = $('detail');
  const head = '<h2>Box ' + (c.x * 100).toFixed(0) + ' × ' + (c.z * 100).toFixed(0) + ' <small>sheet 100 long</small></h2>';
  if (c.s !== 'found') {
    d.innerHTML = head + '<p class="lede">' + (c.s === 'infeasible' ? 'Proven impossible: the first panel must be at least 5 long and stays flat, but the box allows only ' + (c.x * 98).toFixed(1) + ' after the 2% gap.' : 'The reference solver found no valid design within 11 folds. This is not proof that none exists.') + '</p>';
    return;
  }
  const a = answerOf(c), fmt = (v, n = 1) => (v * 100).toFixed(n);
  d.innerHTML = head +
    '<div class="legend"><span class="pill">budget ' + a.budget + ' folds</span><span class="pill">uses ' + a.folds + '</span><span class="pill">opening ' + a.spread.toFixed(1) + '°</span>' +
    '<span class="pill">' + (a.sym ? (a.panels.length % 2 ? 'rotational symmetry' : 'mirror symmetry') : 'not symmetric') + '</span><span class="pill">order score ' + a.order + '</span>' +
    (a.spreadCheck === 'beaten' ? '<span class="pill warn">re-check found ' + a.freeSpread.toFixed(1) + '° opening</span>' : a.spreadCheck === 'confirmed' ? '<span class="pill">spread re-check: not beaten</span>' : '') + '</div>' +
    '<svg class="side" id="side" viewBox="0 0 100 100" role="img" aria-label="Side view of the fold inside the box"></svg>' +
    '<p class="cap">Side view, final shape placed in the box. Solid outline: box. Dashed: 98% limit. Open dot: fixed end. The frame covers the whole motion.</p>' +
    '<div class="motion"><button id="play">Play</button><input id="prog" type="range" min="0" max="1" step="0.005" value="' + progress + '" aria-label="Folding progress"><span id="pval" class="eyebrow">100%</span></div>' +
    '<dl>' +
    '<dt>Design family</dt><dd>' + (FAMILY[a.family] || a.family) + '</dd>' +
    '<dt>Hand rule</dt><dd>' + (c.hand === null ? 'impossible (needs over 11 folds)' : c.hand + ' fold' + (c.hand === 1 ? '' : 's') + ' (fewest found: ' + c.minFolds + ')') + '</dd>' +
    '<dt>Panel lengths</dt><dd>' + a.panels.map(p => fmt(p)).join(' · ') + '</dd>' +
    '<dt>Fold angles</dt><dd>' + (a.angles.length ? a.angles.map(x => x.toFixed(1) + '°').join(' · ') : 'none') + '</dd>' +
    '<dt>Folded size</dt><dd>' + fmt(a.dims[0]) + ' × ' + fmt(a.dims[1]) + ' in a box of ' + (c.x * 100).toFixed(0) + ' × ' + (c.z * 100).toFixed(0) + '</dd>' +
    '<dt>Smallest gap</dt><dd>' + (a.gap === null ? 'no non-adjacent panels' : fmt(a.gap, 2) + ' (during motion)') + '</dd>' +
    '<dt>Motion sweep</dt><dd>' + (a.sweep * 100).toFixed(1) + '% of sheet length²</dd>' +
    '</dl>';
  $('prog').oninput = e => { stop(); progress = +e.target.value; drawSide(); };
  $('play').onclick = () => playing ? stop() : play();
  drawSide();
}
function drawSide() {
  const c = answerOf(selected), svgS = $('side'); if (!svgS) return; c.x = selected.x; c.z = selected.z;
  svgS.innerHTML = '';
  const fin = section(c.panels, c.angles, 1);
  const minX = Math.min(...fin.map(p => p[0])), minZ = Math.min(...fin.map(p => p[1]));
  const bx = c.x, bz = c.z;
  // Place the final shape at the bottom-left of the box; motion uses the same offset.
  let lo = [0, 0], hi = [bx, bz];
  for (let k = 0; k <= 40; k++) for (const [x, z] of section(c.panels, c.angles, k / 40)) {
    lo = [Math.min(lo[0], x - minX), Math.min(lo[1], z - minZ)]; hi = [Math.max(hi[0], x - minX), Math.max(hi[1], z - minZ)];
  }
  const span = Math.max(hi[0] - lo[0], hi[1] - lo[1]) * 1.12, pad = 4, s = (100 - 2 * pad) / span;
  const cx = (lo[0] + hi[0]) / 2, cz = (lo[1] + hi[1]) / 2;
  const X = x => 50 + (x - cx) * s, Z = z => 50 - (z - cz) * s;
  el('rect', { x: X(0), y: Z(bz), width: bx * s, height: bz * s, fill: 'none', stroke: 'var(--box)', 'stroke-width': 0.6 }, svgS);
  el('rect', { x: X(0), y: Z(bz * 0.98), width: bx * 0.98 * s, height: bz * 0.98 * s, fill: 'none', stroke: 'var(--box)', 'stroke-width': 0.35, 'stroke-dasharray': '1.2 1' }, svgS);
  const pts = section(c.panels, c.angles, progress).map(([x, z]) => [X(x - minX), Z(z - minZ)]);
  for (let i = 0; i < pts.length - 1; i++) el('line', { x1: pts[i][0], y1: pts[i][1], x2: pts[i + 1][0], y2: pts[i + 1][1], stroke: i % 2 ? 'var(--panel-b)' : 'var(--panel-a)', 'stroke-width': 1.4, 'stroke-linecap': 'round' }, svgS);
  pts.slice(1, -1).forEach(([x, z]) => el('circle', { cx: x, cy: z, r: 0.9, fill: 'var(--ink)' }, svgS));
  el('circle', { cx: pts[0][0], cy: pts[0][1], r: 1.2, fill: 'var(--sheet)', stroke: 'var(--ink)', 'stroke-width': 0.4 }, svgS);
  const pv = $('pval'); if (pv) pv.textContent = Math.round(progress * 100) + '%';
  const pr = $('prog'); if (pr) pr.value = progress;
}
function play() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { progress = 1; drawSide(); return; }
  if (progress >= 1) progress = 0;
  $('play').textContent = 'Pause';
  let last = performance.now();
  const tick = now => { progress = Math.min(1, progress + (now - last) / 2500); last = now; drawSide(); if (progress < 1) playing = requestAnimationFrame(tick); else stop(); };
  playing = requestAnimationFrame(tick);
}
function stop() { if (playing) cancelAnimationFrame(playing); playing = null; const b = $('play'); if (b) b.textContent = 'Play'; }
const start = DATA.cells.find(c => c.s === 'found' && Math.abs(c.x - 0.2) < 1e-6 && Math.abs(c.z - 0.3) < 1e-6) || DATA.cells.find(c => c.s === 'found');
paint(); select(start);
</script>
`;
fs.writeFileSync(output, html);
console.log(`wrote ${output} (${(html.length / 1024).toFixed(0)} KB)`);
