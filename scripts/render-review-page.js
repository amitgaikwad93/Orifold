#!/usr/bin/env node
/* Visual review page (EXPERIMENT_SPEC.md section 9). The user judges each fold; verdicts are stored in the
 * page's database (collection "verdicts", one document per item) so Claude can read them back.
 * Round 1 reviews a sample of the reference answers (answer key) from the TRAINING split only, so the
 * held-out test answers stay unseen. Later rounds will review model outputs with the same page.
 * Usage: node scripts/render-review-page.js <dataset.jsonl.gz> <output.html> [count=48] [seed=7] [round=answer-key-1] */
const fs = require('fs'), zlib = require('zlib');
const { randomGenerator } = require('../src/optimizer');
const [datasetPath, output, countArg = '48', seedArg = '7', round = 'answer-key-1'] = process.argv.slice(2);
if (!datasetPath || !output) { console.error('Usage: <dataset.jsonl.gz> <output.html> [count] [seed] [round]'); process.exit(2); }
const rows = zlib.gunzipSync(fs.readFileSync(datasetPath)).toString().trim().split('\n').map(JSON.parse)
  .filter(r => r.split === 'train' && r.status === 'found');
const rng = randomGenerator(Number(seedArg));
const shuffled = rows.map(r => [rng(), r]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
// Stratify: each budget step (fewest, +1, +2) equally, preferring a spread of fold counts.
const items = [], perStep = Math.ceil(Number(countArg) / 3), r4 = x => +x.toFixed(4);
for (let step = 0; step < 3; step++) {
  const seen = new Map();
  for (const r of shuffled) {
    const a = r.answers[step]; if (!a) continue;
    const k = a.quality.folds; if ((seen.get(k) || 0) >= Math.max(2, perStep / 4)) continue;
    if (items.some(it => it.request === r.id)) continue;
    seen.set(k, (seen.get(k) || 0) + 1);
    const L = r.request.length;
    items.push({ id: `${r.id}-b${a.budget}`, request: r.id, kind: r.kind, budgetStep: step, budget: a.budget,
      box: [r4(r.request.targetBox[0] / L), r4(r.request.targetBox[2] / L)], sheetLength: r4(L),
      panels: a.design.panelLengths.map(p => r4(p / L)), angles: a.design.angles.map(x => +x.toFixed(2)), psi: +(a.design.placement ?? 0).toFixed(3),
      folds: a.quality.folds, spread: +a.quality.spread.toFixed(1), symmetric: a.quality.symmetric, order: a.quality.order });
    if (items.filter(it => it.budgetStep === step).length >= perStep) break;
  }
}
const data = JSON.stringify({ round, items });

const html = String.raw`<title>Fold Review</title>
<meta name="claude:viewport-fit-sides" content="cover">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wdth,wght@75..100,400..700&family=IBM+Plex+Mono:wght@400;500&display=swap">
<style>
/* Layout: one fold at a time, large side view on the left, verdict controls on the right; item strip below. */
:root {
  --paper: #f6f7f4; --sheet: #ffffff; --ink: #15181a; --ink-2: #545a5f; --rule: #d8dbd5; --accent: #2a78d6;
  --panel-a: #2a78d6; --panel-b: #86b6ef; --box: #15181a;
  --good: #1a7f4b; --bad: #c93a39; --unsure: #a66a00; --good-bg: #e3f3ea; --bad-bg: #f8e4e3; --unsure-bg: #f7eedb;
  --display: "Archivo", "Helvetica Neue", Arial, sans-serif; --mono: "IBM Plex Mono", ui-monospace, Menlo, monospace;
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --paper: #131517; --sheet: #1b1e21; --ink: #eceeeb; --ink-2: #a9aeaa; --rule: #33383b; --accent: #3987e5;
  --panel-a: #6da7ec; --panel-b: #256abf; --box: #eceeeb;
  --good: #4cc38a; --bad: #e66767; --unsure: #e0a63a; --good-bg: #173326; --bad-bg: #3a1d1d; --unsure-bg: #3a2e16; color-scheme: dark; } }
:root[data-theme="dark"] {
  --paper: #131517; --sheet: #1b1e21; --ink: #eceeeb; --ink-2: #a9aeaa; --rule: #33383b; --accent: #3987e5;
  --panel-a: #6da7ec; --panel-b: #256abf; --box: #eceeeb;
  --good: #4cc38a; --bad: #e66767; --unsure: #e0a63a; --good-bg: #173326; --bad-bg: #3a1d1d; --unsure-bg: #3a2e16; color-scheme: dark; }
* { box-sizing: border-box; }
body { background: var(--paper); color: var(--ink); font-family: var(--display); font-size: 15px; line-height: 1.5; }
.wrap { max-width: 1120px; margin: 0 auto; padding-block: 24px 40px; padding-left: max(16px, env(safe-area-inset-left, 0px)); padding-right: max(16px, env(safe-area-inset-right, 0px)); display: grid; gap: 18px; }
.eyebrow { font-family: var(--mono); font-size: 12px; letter-spacing: .06em; text-transform: uppercase; color: var(--ink-2); }
h1 { font-stretch: 80%; font-weight: 700; font-size: clamp(28px, 5vw, 40px); line-height: 1.05; margin: 0; }
h2 { font-stretch: 85%; font-weight: 650; font-size: 19px; margin: 0; }
p { margin: 0; }
.lede { color: var(--ink-2); max-width: 70ch; }
.bar { display: flex; flex-wrap: wrap; gap: 8px 20px; align-items: center; font-family: var(--mono); font-size: 13px; color: var(--ink-2); font-variant-numeric: tabular-nums; }
.bar b { color: var(--ink); font-weight: 500; }
.progress { flex: 1 1 200px; height: 6px; background: var(--rule); border-radius: 3px; overflow: hidden; display: flex; min-width: 0; }
.progress i { display: block; height: 100%; }
.main { display: grid; grid-template-columns: minmax(0, 1.3fr) minmax(0, 1fr); gap: 18px; align-items: start; }
@media (max-width: 820px) { .main { grid-template-columns: minmax(0, 1fr); } }
.card { background: var(--sheet); border: 1px solid var(--rule); border-radius: 6px; padding: 16px; display: grid; gap: 12px; min-width: 0; }
svg.side { overflow: hidden; width: 100%; height: auto; aspect-ratio: 1 / 1; background: var(--paper); border-radius: 4px; display: block; }
.cap { font-size: 12.5px; color: var(--ink-2); }
.motion { display: flex; gap: 12px; align-items: center; }
.motion input { flex: 1; min-width: 0; accent-color: var(--accent); }
button { font: inherit; cursor: pointer; }
.btn { font-size: 14px; padding: 8px 14px; border-radius: 6px; border: 1px solid var(--rule); background: var(--paper); color: var(--ink); }
.btn:disabled { opacity: .5; cursor: not-allowed; }
button:focus-visible, textarea:focus-visible, input:focus-visible { outline: 2px solid var(--accent); outline-offset: 2px; }
.verdicts { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 8px; }
.verdicts button { padding: 12px 8px; border-radius: 6px; border: 1.5px solid var(--rule); background: var(--paper); color: var(--ink); font-weight: 600; display: grid; gap: 2px; }
.verdicts button small { font-family: var(--mono); font-weight: 400; font-size: 11px; color: var(--ink-2); }
.verdicts button[data-v="valid"][aria-pressed="true"] { border-color: var(--good); background: var(--good-bg); color: var(--good); }
.verdicts button[data-v="invalid"][aria-pressed="true"] { border-color: var(--bad); background: var(--bad-bg); color: var(--bad); }
.verdicts button[data-v="unsure"][aria-pressed="true"] { border-color: var(--unsure); background: var(--unsure-bg); color: var(--unsure); }
textarea { width: 100%; min-height: 76px; font: inherit; font-size: 14px; padding: 8px 10px; border-radius: 6px; border: 1px solid var(--rule); background: var(--paper); color: var(--ink); resize: vertical; }
.nav { display: flex; gap: 8px; justify-content: space-between; flex-wrap: wrap; align-items: center; }
.status { font-size: 13px; color: var(--ink-2); min-height: 1.4em; }
dl { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 4px 16px; margin: 0; font-size: 13.5px; }
dt { color: var(--ink-2); }
dd { margin: 0; font-family: var(--mono); font-size: 13px; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
.strip { display: flex; flex-wrap: wrap; gap: 6px; }
.strip button { width: 34px; height: 30px; border-radius: 5px; border: 1.5px solid var(--rule); background: var(--sheet); color: var(--ink-2); font-family: var(--mono); font-size: 11px; }
.strip button.cur { border-color: var(--ink); color: var(--ink); }
.strip button[data-v="valid"] { background: var(--good-bg); border-color: var(--good); color: var(--good); }
.strip button[data-v="invalid"] { background: var(--bad-bg); border-color: var(--bad); color: var(--bad); }
.strip button[data-v="unsure"] { background: var(--unsure-bg); border-color: var(--unsure); color: var(--unsure); }
.strip button.cur { box-shadow: 0 0 0 2px var(--ink); }
.notice { font-size: 13.5px; padding: 10px 12px; border-radius: 6px; background: var(--unsure-bg); color: var(--ink); }
kbd { font-family: var(--mono); font-size: 11px; border: 1px solid var(--rule); border-radius: 3px; padding: 0 4px; }
</style>

<div class="wrap">
  <header style="display:grid;gap:8px">
    <div class="eyebrow">Orifold · experiment v2 · <span id="round"></span></div>
    <h1>Fold Review</h1>
    <p class="lede">Each item is one answer from the answer key: a sheet folded to fit a box, within a fold budget. Judge whether it is a valid fold pattern you would accept. Play the motion to see it fold. Your verdicts are saved as you go and Claude reads them back. These items come from the training split only.</p>
  </header>
  <section class="card" aria-label="How to review" style="gap:8px">
    <h2>How to review</h2>
    <p class="lede">The computer has already checked the hard rules: it fits the box, no panels collide, and every panel is valid. Your job is the judgment it cannot make: <b>would you accept this as an answer for this box and this fold budget?</b></p>
    <dl>
      <dt>Valid fold</dt><dd style="font-family:inherit">You would be happy for the model to learn to produce this.</dd>
      <dt>Not valid</dt><dd style="font-family:inherit">Something looks wrong: panels crossing or overlapping, poking out of the box, or physically implausible.</dd>
      <dt>Unsure</dt><dd style="font-family:inherit">Technically fine but odd: a pointless-looking crease, a strangely tiny panel, a shape you would not call good origami.</dd>
    </dl>
    <p class="cap">Press Play to watch it fold. The open dot is the end that stays still. The sheet starts flat and turns into its place in the box as it folds. Designs with one fold have one moving panel. A short note on any "Not valid" or "Unsure" helps most.</p>
  </section>
  <div class="bar" id="bar"></div>
  <div id="notice" class="notice" hidden></div>
  <div class="main">
    <section class="card" aria-label="Fold">
      <h2 id="title"></h2>
      <svg class="side" id="side" viewBox="0 0 100 100" role="img" aria-label="Side view of the fold inside the box"></svg>
      <p class="cap">Side view. Solid outline: box. Dashed: 98% limit. Open dot: the end that stays still. Panels alternate two shades. The frame fits the box, so mid-motion poses can run past it.</p>
      <div class="motion"><button class="btn" id="play">Play</button><input id="prog" type="range" min="0" max="1" step="0.005" value="1" aria-label="Folding progress"><span id="pval" class="eyebrow">100%</span></div>
    </section>
    <section class="card" aria-label="Verdict">
      <h2>Your verdict</h2>
      <div class="verdicts" role="group" aria-label="Verdict">
        <button data-v="valid" aria-pressed="false">Valid fold<small>key 1</small></button>
        <button data-v="invalid" aria-pressed="false">Not valid<small>key 2</small></button>
        <button data-v="unsure" aria-pressed="false">Unsure<small>key 3</small></button>
      </div>
      <label for="note" class="cap">Note (optional): what looks wrong or interesting</label>
      <textarea id="note" placeholder="e.g. panels nearly touch; odd tiny panel; looks good"></textarea>
      <div class="nav">
        <button class="btn" id="prev">← Previous</button>
        <span class="status" id="status" aria-live="polite"></span>
        <button class="btn" id="next">Next →</button>
      </div>
      <dl id="facts"></dl>
      <p class="cap">Keys: <kbd>1</kbd> <kbd>2</kbd> <kbd>3</kbd> verdict, <kbd>←</kbd> <kbd>→</kbd> move, <kbd>space</kbd> play.</p>
    </section>
  </div>
  <section class="card" aria-label="All items">
    <h2>All items</h2>
    <div class="strip" id="strip"></div>
  </section>
</div>

<script>
const DATA = ${data};
const $ = id => document.getElementById(id);
const NS = 'http://www.w3.org/2000/svg', el = (t, a, p) => { const e = document.createElementNS(NS, t); for (const k in a) e.setAttribute(k, a[k]); p && p.appendChild(e); return e; };
const items = DATA.items, verdicts = new Map();
let idx = 0, progress = 1, playing = null, db = null, writable = false;
$('round').textContent = DATA.round;

function section(P, A, t, psi) {
  const q = [[0, 0]]; let o = 0;
  P.forEach((l, i) => { if (i > 0) o += (i % 2 ? 1 : -1) * A[i - 1] * t; const r = o * Math.PI / 180, p = q[i]; q.push([p[0] + l * Math.cos(r), p[1] + l * Math.sin(r)]); });
  const r = psi * Math.PI / 180, c = Math.cos(r), s = Math.sin(r);
  return q.map(([x, z]) => [x * c - z * s, x * s + z * c]);
}
function draw() {
  const it = items[idx], s = $('side'); s.innerHTML = '';
  const fin = section(it.panels, it.angles, 1, it.psi), mx = Math.min(...fin.map(p => p[0])), mz = Math.min(...fin.map(p => p[1]));
  // Frame the box and the final shape; mid-motion poses may run past the frame.
  let lo = [0, 0], hi = [it.box[0], it.box[1]];
  for (const [x, z] of fin) { lo = [Math.min(lo[0], x - mx), Math.min(lo[1], z - mz)]; hi = [Math.max(hi[0], x - mx), Math.max(hi[1], z - mz)]; }
  const span = Math.max(hi[0] - lo[0], hi[1] - lo[1]) * 1.1, sc = 92 / span, cx = (lo[0] + hi[0]) / 2, cz = (lo[1] + hi[1]) / 2;
  const X = x => 50 + (x - cx) * sc, Z = z => 50 - (z - cz) * sc;
  el('rect', { x: X(0), y: Z(it.box[1]), width: it.box[0] * sc, height: it.box[1] * sc, fill: 'none', stroke: 'var(--box)', 'stroke-width': .6 }, s);
  el('rect', { x: X(0), y: Z(it.box[1] * .98), width: it.box[0] * .98 * sc, height: it.box[1] * .98 * sc, fill: 'none', stroke: 'var(--box)', 'stroke-width': .35, 'stroke-dasharray': '1.2 1' }, s);
  // The sheet starts flat and turns into its box placement as it folds (fold angles and turn both scale with progress).
  const q = section(it.panels, it.angles, progress, it.psi * progress).map(([x, z]) => [X(x - mx), Z(z - mz)]);
  for (let i = 0; i < q.length - 1; i++) el('line', { x1: q[i][0], y1: q[i][1], x2: q[i + 1][0], y2: q[i + 1][1], stroke: i % 2 ? 'var(--panel-b)' : 'var(--panel-a)', 'stroke-width': 1.3, 'stroke-linecap': 'round' }, s);
  q.slice(1, -1).forEach(([x, z]) => el('circle', { cx: x, cy: z, r: .8, fill: 'var(--ink)' }, s));
  el('circle', { cx: q[0][0], cy: q[0][1], r: 1.1, fill: 'var(--sheet)', stroke: 'var(--ink)', 'stroke-width': .4 }, s);
  $('pval').textContent = Math.round(progress * 100) + '%'; $('prog').value = progress;
}
function render() {
  const it = items[idx], v = verdicts.get(it.id);
  $('title').textContent = 'Item ' + (idx + 1) + ' of ' + items.length + ' · box ' + Math.round(it.box[0] * 100) + ' × ' + Math.round(it.box[1] * 100);
  document.querySelectorAll('.verdicts button').forEach(b => { b.setAttribute('aria-pressed', String(v?.verdict === b.dataset.v)); b.disabled = !writable; });
  if (document.activeElement !== $('note')) $('note').value = v?.note ?? '';
  $('note').disabled = !writable;
  const step = ['fewest folds', 'fewest + 1', 'fewest + 2'][it.budgetStep];
  $('facts').innerHTML = [
    ['Fold budget', it.budget + ' (' + step + ')'], ['Folds used', it.folds],
    ['Smallest opening', it.spread.toFixed(1) + '°'], ['Symmetric', it.symmetric ? (it.panels.length % 2 ? 'yes, rotational' : 'yes, mirror') : 'no'],
    ['Panel lengths', it.panels.map(p => (p * 100).toFixed(1)).join(' · ')], ['Fold angles', it.angles.length ? it.angles.map(a => a.toFixed(1) + '°').join(' · ') : 'none'],
    ['Turned in box', it.psi.toFixed(1) + '°'], ['Box (sheet = 100)', Math.round(it.box[0] * 100) + ' × ' + Math.round(it.box[1] * 100)],
  ].map(([k, x]) => '<dt>' + k + '</dt><dd>' + x + '</dd>').join('');
  const strip = $('strip'); strip.innerHTML = '';
  items.forEach((x, i) => { const b = document.createElement('button'); b.textContent = i + 1; b.className = i === idx ? 'cur' : '';
    const vv = verdicts.get(x.id); if (vv) b.dataset.v = vv.verdict; b.setAttribute('aria-label', 'Item ' + (i + 1) + (vv ? ', ' + vv.verdict : ''));
    b.onclick = () => go(i); strip.appendChild(b); });
  const counts = { valid: 0, invalid: 0, unsure: 0 }; for (const x of verdicts.values()) counts[x.verdict]++;
  const done = counts.valid + counts.invalid + counts.unsure, pct = k => (counts[k] / items.length * 100) + '%';
  $('bar').innerHTML = '<span>Reviewed <b>' + done + '</b> of ' + items.length + '</span><div class="progress" aria-hidden="true"><i style="width:' + pct('valid') + ';background:var(--good)"></i><i style="width:' + pct('invalid') + ';background:var(--bad)"></i><i style="width:' + pct('unsure') + ';background:var(--unsure)"></i></div>' +
    '<span>Valid <b>' + counts.valid + '</b></span><span>Not valid <b>' + counts.invalid + '</b></span><span>Unsure <b>' + counts.unsure + '</b></span>';
  draw();
}
function go(i) { stop(); progress = 1; idx = (i + items.length) % items.length; render(); }
async function save(verdict) {
  const it = items[idx]; if (!db || !writable) return;
  const body = { item: it.id, request: it.request, budget: it.budget, round: DATA.round, verdict, note: $('note').value.trim(), reviewedAt: new Date().toISOString() };
  verdicts.set(it.id, body); render(); $('status').textContent = 'Saving…';
  try { await db.collection('verdicts').doc(it.id).set(body); $('status').textContent = 'Saved'; }
  catch (e) { $('status').textContent = e?.code === 'invalid_argument' ? 'This view cannot save verdicts.' : 'Not saved: ' + (e?.message || 'try again'); if (e?.code === 'invalid_argument') { writable = false; render(); } }
}
document.querySelectorAll('.verdicts button').forEach(b => b.onclick = () => save(b.dataset.v));
let noteTimer = null;
$('note').addEventListener('input', () => { clearTimeout(noteTimer); noteTimer = setTimeout(() => { const v = verdicts.get(items[idx].id); if (v) save(v.verdict); else $('status').textContent = 'Pick a verdict to save the note'; }, 900); });
$('prev').onclick = () => go(idx - 1); $('next').onclick = () => go(idx + 1);
$('prog').oninput = e => { stop(); progress = +e.target.value; draw(); };
$('play').onclick = () => playing ? stop() : play();
function play() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { progress = 1; draw(); return; }
  if (progress >= 1) progress = 0; $('play').textContent = 'Pause';
  let last = performance.now();
  const tick = now => { progress = Math.min(1, progress + (now - last) / 2500); last = now; draw(); if (progress < 1) playing = requestAnimationFrame(tick); else stop(); };
  playing = requestAnimationFrame(tick);
}
function stop() { if (playing) cancelAnimationFrame(playing); playing = null; $('play').textContent = 'Play'; }
document.addEventListener('keydown', e => {
  if (e.target.tagName === 'TEXTAREA') return;
  if (e.key === '1') save('valid'); else if (e.key === '2') save('invalid'); else if (e.key === '3') save('unsure');
  else if (e.key === 'ArrowRight') go(idx + 1); else if (e.key === 'ArrowLeft') go(idx - 1);
  else if (e.key === ' ') { e.preventDefault(); playing ? stop() : play(); }
});
render();
$('status').textContent = 'Connecting to saved verdicts…';
(async () => {
  db = await window.claude?.use?.('db').catch(() => null) ?? null;
  if (!db) { $('notice').hidden = false; $('notice').textContent = 'Verdicts cannot be saved in this view. Open the page in Claude, signed in, to review.'; $('status').textContent = ''; return; }
  writable = true; render();
  const timer = setTimeout(() => { $('status').textContent = 'Saved verdicts are taking a while to load; new ones still save.'; }, 10000);
  db.collection('verdicts').onSnapshot(snap => {
    if (!snap.metadata.fromCache) { clearTimeout(timer); if ($('status').textContent.startsWith('Connecting') || $('status').textContent.startsWith('Saved verdicts are')) $('status').textContent = ''; }
    for (const d of snap.docs) { const x = d.data(); if (x && x.round === DATA.round) verdicts.set(d.id, x); }
    render();
  }, err => { clearTimeout(timer); $('status').textContent = 'Saved verdicts could not be loaded (' + err.code + ').'; });
})();
</script>
`;
fs.writeFileSync(output, html);
console.log(`wrote ${output}: ${items.length} items (${[0, 1, 2].map(s => items.filter(i => i.budgetStep === s).length).join('/')} per budget step)`);
