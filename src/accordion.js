/* Parallel-crease accordion geometry. All lengths use the same unit (demo: cm).
 * Fold angles are magnitudes in degrees; hinge rotations alternate +, -, +.
 * This evaluator is intentionally independent of the DOM and external packages.
 */
const OrifoldAccordion = (() => {
  const RELATIVE_EPSILON = 1e-9;

  function validateDesign({ panelLengths, width, angles } = {}) {
    if (!Array.isArray(panelLengths) || panelLengths.length < 1 ||
        !panelLengths.every(x => Number.isFinite(x) && x > 0)) {
      throw new Error('Supply at least one positive, finite panel length.');
    }
    const length = panelLengths.reduce((sum, x) => sum + x, 0);
    if (!Number.isFinite(length) || panelLengths.some(x => x <= length * 1e-8)) {
      throw new Error('Panel lengths must be finite and exceed 1e-8 of total sheet length.');
    }
    if (!Number.isFinite(width) || width <= 0 || !Number.isFinite(width * length)) {
      throw new Error('Sheet width and material area must be positive and finite.');
    }
    if (!Array.isArray(angles) || angles.length !== panelLengths.length - 1 ||
        !angles.every(x => Number.isFinite(x) && x >= 0 && x <= 180)) {
      throw new Error('Supply one angle per hinge, each between 0 and 180 degrees.');
    }
    return length;
  }

  function bounds(vertices) {
    const min = [0, 1, 2].map(axis => Math.min(...vertices.map(v => v[axis])));
    const max = [0, 1, 2].map(axis => Math.max(...vertices.map(v => v[axis])));
    return { min, max, dimensions: max.map((v, i) => v - min[i]) };
  }

  function foldAccordion(design, progress = 1) {
    const length = validateDesign(design);
    if (!Number.isFinite(progress) || progress < 0 || progress > 1) {
      throw new Error('Motion progress must be between 0 and 1.');
    }
    const { panelLengths, width, angles } = design;
    const section = [[0, 0]];
    let orientation = 0;
    panelLengths.forEach((panelLength, i) => {
      if (i > 0) orientation += (i % 2 ? 1 : -1) * angles[i - 1] * progress;
      const radians = orientation * Math.PI / 180;
      const clean = x => Math.abs(x) < 1e-14 ? 0 : x;
      const previous = section[i];
      section.push([previous[0] + panelLength * clean(Math.cos(radians)),
        previous[1] + panelLength * clean(Math.sin(radians))]);
    });
    const vertices = section.flatMap(([x, z]) => [[x, 0, z], [x, width, z]]);
    const faces = panelLengths.map((_, i) => [2 * i, 2 * i + 2, 2 * i + 3, 2 * i + 1]);
    return { section, vertices, faces, ...bounds(vertices), length, width,
      area: length * width, angles: angles.map(angle => angle * progress) };
  }

  // Because all panels span the same y interval, intersections of their x-z
  // segments are sufficient to identify intersections of these special panels.
  function segmentContact(a, b, c, d, epsilon) {
    const distance = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
    const signedDistance = (p, q, r) =>
      ((q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0])) / distance(p, q);
    const side = value => Math.abs(value) <= epsilon ? 0 : Math.sign(value);
    const s1 = side(signedDistance(a, b, c)), s2 = side(signedDistance(a, b, d));
    const s3 = side(signedDistance(c, d, a)), s4 = side(signedDistance(c, d, b));
    if (s1 * s2 < 0 && s3 * s4 < 0) return 'crossing';
    if ([s1, s2, s3, s4].every(x => x === 0)) {
      const norm = distance(a, b), ux = (b[0] - a[0]) / norm, uz = (b[1] - a[1]) / norm;
      const projection = p => (p[0] - a[0]) * ux + (p[1] - a[1]) * uz;
      const pc = projection(c), pd = projection(d);
      const overlap = Math.min(norm, Math.max(pc, pd)) - Math.max(0, Math.min(pc, pd));
      return overlap > epsilon ? 'overlap' : overlap >= -epsilon ? 'touch' : null;
    }
    const inside = (p, q, r) => [0, 1].every(i =>
      r[i] >= Math.min(p[i], q[i]) - epsilon && r[i] <= Math.max(p[i], q[i]) + epsilon);
    if ((s1 === 0 && inside(a, b, c)) || (s2 === 0 && inside(a, b, d)) ||
        (s3 === 0 && inside(c, d, a)) || (s4 === 0 && inside(c, d, b))) return 'touch';
    return null;
  }

  function checkContacts(geometry) {
    const { section, angles, length } = geometry;
    const epsilon = length * RELATIVE_EPSILON;
    const fullFlatStack = angles.every(angle => angle === 180);
    const blocked = [], allowedStackContacts = [];
    for (let i = 0; i < section.length - 1; i++) {
      for (let j = i + 1; j < section.length - 1; j++) {
        const kind = segmentContact(section[i], section[i + 1], section[j], section[j + 1], epsilon);
        if (!kind || (j === i + 1 && kind === 'touch')) continue; // shared hinge
        const contact = { panels: [i, j], kind };
        if (fullFlatStack && kind !== 'crossing') allowedStackContacts.push(contact);
        else blocked.push(contact);
      }
    }
    return { blocked, allowedStackContacts, fullFlatStack };
  }

  function evaluateAccordion(design, targetBox, { steps = 180 } = {}) {
    validateDesign(design);
    if (!Array.isArray(targetBox) || targetBox.length !== 3 ||
        !targetBox.every(x => Number.isFinite(x) && x > 0)) {
      throw new Error('Target box must contain three positive, finite dimensions.');
    }
    if (!Number.isInteger(steps) || steps < 1 || steps > 10000) {
      throw new Error('Motion steps must be an integer between 1 and 10000.');
    }
    const final = foldAccordion(design);
    const overflow = final.dimensions.map((value, i) => Math.max(0, value - targetBox[i]));
    const numericalTolerance = Math.max(final.length, final.width, ...targetBox) * RELATIVE_EPSILON;
    const endpointFits = overflow.every(value => value <= numericalTolerance);
    const blockedSamples = [];
    const sweptMin = [Infinity, Infinity, Infinity], sweptMax = [-Infinity, -Infinity, -Infinity];
    for (let step = 0; step <= steps; step++) {
      const progress = step / steps;
      const geometry = step === steps ? final : foldAccordion(design, progress);
      const contacts = checkContacts(geometry);
      if (contacts.blocked.length) blockedSamples.push({ step, progress, contacts: contacts.blocked });
      [0, 1, 2].forEach(axis => {
        sweptMin[axis] = Math.min(sweptMin[axis], geometry.min[axis]);
        sweptMax[axis] = Math.max(sweptMax[axis], geometry.max[axis]);
      });
    }
    return {
      final, targetBox: [...targetBox], overflow, endpointFits,
      sampleCount: steps + 1, blockedSamples,
      noBlockedContactsAtSamples: blockedSamples.length === 0,
      passesSampledChecks: endpointFits && blockedSamples.length === 0,
      finalContacts: checkContacts(final),
      sampledSweptBox: { min: sweptMin, max: sweptMax,
        dimensions: sweptMax.map((value, axis) => value - sweptMin[axis]) },
      assumptions: {
        thickness: 0, motion: 'simultaneous-linear-hinge-angles',
        terminalFlatStackContactAllowed: true,
        continuousCollisionGuarantee: false, layerOrderValidated: false,
        enclosureMotionChecked: false, singleActuatorValidated: false,
      },
    };
  }

  return { foldAccordion, checkContacts, evaluateAccordion };
})();
if (typeof module !== 'undefined') module.exports = OrifoldAccordion;
