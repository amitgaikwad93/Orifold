const byId = id => document.getElementById(id);
const colors = ['#419b84', '#e8b360', '#5c91b0', '#c894aa'];
const formatBox = values => values.map(n => n.toFixed(2)).join(' × ') + ' cm';
let design, evaluation, animation = null, previousTime = null, motionPhase = 50;

function svgElement(tag, attributes, text) {
  const el = document.createElementNS('http://www.w3.org/2000/svg', tag);
  Object.entries(attributes).forEach(([key, value]) => el.setAttribute(key, value));
  if (text !== undefined) el.textContent = text;
  return el;
}

function projections() {
  // Use the entire sampled motion envelope, so the view does not zoom while playing.
  const { min, max } = evaluation.sampledSweptBox;
  const raw = ([x, y, z]) => [x - .65 * y, .35 * y - z];
  const corners = [min[0], max[0]].flatMap(x => [min[1], max[1]].flatMap(y =>
    [min[2], max[2]].map(z => raw([x, y, z]))));
  const lo = [0, 1].map(i => Math.min(...corners.map(p => p[i])));
  const hi = [0, 1].map(i => Math.max(...corners.map(p => p[i])));
  const scale = Math.min(650 / (hi[0] - lo[0] || 1), 310 / (hi[1] - lo[1] || 1));
  const sideScale = Math.min(650 / (max[0] - min[0] || 1), 130 / (max[2] - min[2] || 1));
  return {
    oblique: point => raw(point).map((v, i) => [380, 205][i] + scale * (v - (lo[i] + hi[i]) / 2)),
    side: ([x, y, z]) => [380 + sideScale * (x - (min[0] + max[0]) / 2),
      95 - sideScale * (z - (min[2] + max[2]) / 2)],
  };
}

function drawGeometry() {
  if (!evaluation) return;
  const progress = Number(byId('motion').value) / 100;
  const geometry = OrifoldAccordion.foldAccordion(design, progress);
  const contacts = OrifoldAccordion.checkContacts(geometry);
  const blockedPanels = new Set(contacts.blocked.flatMap(contact => contact.panels));
  const { oblique, side } = projections();
  const view = byId('accordion-view'), profile = byId('accordion-profile');
  view.replaceChildren(); profile.replaceChildren();
  const points = geometry.vertices.map(oblique), sidePoints = geometry.vertices.map(side);
  geometry.faces.forEach((face, i) => {
    const stroke = blockedPanels.has(i) ? '#ad3028' : '#244b43';
    view.append(svgElement('polygon', { points: face.map(index => points[index].join(',')).join(' '),
      fill: colors[i], 'fill-opacity': .76, stroke, 'stroke-width': blockedPanels.has(i) ? 4 : 1.5 }));
    profile.append(svgElement('line', { x1: sidePoints[2 * i][0], y1: sidePoints[2 * i][1],
      x2: sidePoints[2 * i + 2][0], y2: sidePoints[2 * i + 2][1], stroke: blockedPanels.has(i) ? stroke : colors[i],
      'stroke-width': 6, 'stroke-linecap': 'round' }));
  });
  for (let i = 1; i < design.panelLengths.length; i++) {
    view.append(svgElement('line', { x1: points[2 * i][0], y1: points[2 * i][1],
      x2: points[2 * i + 1][0], y2: points[2 * i + 1][1], stroke: '#183c3b', 'stroke-width': 2, 'stroke-dasharray': '5 4' }));
  }
  for (let i = 0; i <= design.panelLengths.length; i++) {
    const [cx, cy] = sidePoints[2 * i];
    profile.append(svgElement('circle', { cx, cy, r: 3, fill: '#183c3b' }));
  }
  byId('motion-value').textContent = `${Math.round(progress * 100)}%`;
  byId('current-box').textContent = formatBox(geometry.dimensions);
  byId('material-area').textContent = `${geometry.area.toFixed(1)} cm²`;
}

function rebuild() {
  stopAnimation();
  try {
    const inputs = [...document.querySelectorAll('input[type=number]')];
    if (inputs.some(input => !input.validity.valid)) throw Error('Enter dimensions from 0.1 to 1000 cm in increments of 0.1.');
    design = {
      panelLengths: [0, 1, 2, 3].map(i => Number(byId(`panel-${i}`).value)),
      width: Number(byId('sheet-width').value),
      angles: [0, 1, 2].map(i => Number(byId(`hinge-${i}`).value)),
    };
    const target = [0, 1, 2].map(i => Number(byId(`target-${i}`).value));
    evaluation = OrifoldAccordion.evaluateAccordion(design, target);
    byId('error').textContent = '';
    design.angles.forEach((angle, i) => { byId(`hinge-value-${i}`).textContent = `${angle}°`; });
    byId('sheet-summary').textContent = `${evaluation.final.length.toFixed(1)} × ${design.width.toFixed(1)} cm sheet`;
    byId('final-box').textContent = formatBox(evaluation.final.dimensions);
    const fit = byId('fit-result'), path = byId('path-result');
    fit.dataset.state = evaluation.endpointFits ? 'pass' : 'blocked';
    fit.textContent = evaluation.endpointFits ? 'Final configuration fits the target box.' :
      `Final configuration exceeds the target. Overflow (L × W × H): ${formatBox(evaluation.overflow)}.`;
    path.dataset.state = evaluation.noBlockedContactsAtSamples ? 'pass' : 'blocked';
    path.textContent = evaluation.noBlockedContactsAtSamples ?
      `No blocked contacts detected at ${evaluation.sampleCount} sampled configurations.` :
      `Blocked contacts at ${evaluation.blockedSamples.length} of ${evaluation.sampleCount} sampled configurations.`;
    const first = evaluation.blockedSamples[0];
    byId('contact-detail').textContent = first ?
      `First detected at ${(first.progress * 100).toFixed(1)}% motion: ${first.contacts.map(c => `panels ${c.panels[0] + 1} and ${c.panels[1] + 1} (${c.kind})`).join('; ')}.` :
      evaluation.finalContacts.allowedStackContacts.length ? 'The endpoint includes ideal flat-stack contact. Layer order and thickness are not validated.' :
      'Ordinary contact at a shared hinge is allowed; other contacts are checked conservatively.';
    byId('play').disabled = false; byId('endpoint').disabled = false;
    drawGeometry();
  } catch (error) {
    evaluation = null;
    byId('error').textContent = error.message;
    ['current-box', 'material-area', 'final-box', 'sheet-summary', 'fit-result', 'path-result', 'contact-detail'].forEach(id => { byId(id).textContent = ''; });
    ['accordion-view', 'accordion-profile'].forEach(id => byId(id).replaceChildren());
    byId('play').disabled = true; byId('endpoint').disabled = true;
  }
}

function stopAnimation() {
  if (animation !== null) cancelAnimationFrame(animation);
  animation = null; previousTime = null;
  byId('play').textContent = 'Play motion'; byId('play').setAttribute('aria-pressed', 'false');
}
function animate(time) {
  if (previousTime !== null) motionPhase = (motionPhase + (time - previousTime) * .025) % 200;
  previousTime = time;
  byId('motion').value = Math.round(motionPhase <= 100 ? motionPhase : 200 - motionPhase);
  drawGeometry(); animation = requestAnimationFrame(animate);
}
byId('play').addEventListener('click', () => {
  if (animation !== null) { stopAnimation(); return; }
  if (!evaluation) return;
  motionPhase = Number(byId('motion').value); previousTime = null;
  byId('play').textContent = 'Pause motion'; byId('play').setAttribute('aria-pressed', 'true');
  animation = requestAnimationFrame(animate);
});
byId('motion').addEventListener('input', () => { stopAnimation(); drawGeometry(); });
byId('endpoint').addEventListener('click', () => { stopAnimation(); byId('motion').value = 100; drawGeometry(); });
document.querySelectorAll('input:not(#motion)').forEach(input => input.addEventListener('input', rebuild));
document.querySelectorAll('[data-example]').forEach(button => button.addEventListener('click', () => {
  const example = button.dataset.example;
  const lengths = example === 'crossing' ? [6, 4, 4, 8] : [5, 5, 5, 5];
  const angles = example === 'crossing' ? [127, 35, 159] : Array(3).fill(example === 'stairs' ? 90 : 180);
  const box = example === 'stack' ? [6, 10, 1] : [20, 10, 20];
  lengths.forEach((value, i) => { byId(`panel-${i}`).value = value; });
  angles.forEach((value, i) => { byId(`hinge-${i}`).value = value; });
  box.forEach((value, i) => { byId(`target-${i}`).value = value; });
  byId('sheet-width').value = 10; byId('motion').value = 100;
  rebuild();
}));
rebuild();
