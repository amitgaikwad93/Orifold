"""Independent Python reference port. Match src/accordion.js, including its limits.

Uses double-precision Python math, not differentiable tensors. Official experiment
acceptance still uses the original Node evaluator after cross-language parity tests.
"""
import math


def fold(design, progress=1.0):
    panels, width, angles = design['panelLengths'], design['width'], design['angles']
    if len(panels) < 2 or any(not math.isfinite(x) or x <= 0 for x in panels):
        raise ValueError('Invalid panel lengths')
    length = sum(panels)
    if not math.isfinite(length) or any(x <= length * 1e-8 for x in panels):
        raise ValueError('Degenerate panel lengths')
    if not math.isfinite(width) or width <= 0 or not math.isfinite(width * length):
        raise ValueError('Invalid width')
    if len(angles) != len(panels) - 1 or any(not math.isfinite(x) or not 0 <= x <= 180 for x in angles):
        raise ValueError('Invalid angles')
    if not math.isfinite(progress) or not 0 <= progress <= 1:
        raise ValueError('Invalid progress')
    section, orientation = [[0.0, 0.0]], 0.0
    for i, panel in enumerate(panels):
        if i:
            orientation += (1 if i % 2 else -1) * angles[i - 1] * progress
        c, s = math.cos(orientation * math.pi / 180), math.sin(orientation * math.pi / 180)
        c = 0.0 if abs(c) < 1e-14 else c
        s = 0.0 if abs(s) < 1e-14 else s
        section.append([section[-1][0] + panel * c, section[-1][1] + panel * s])
    vertices = [v for x, z in section for v in [[x, 0, z], [x, width, z]]]
    minimum = [min(v[i] for v in vertices) for i in range(3)]
    maximum = [max(v[i] for v in vertices) for i in range(3)]
    return {'section': section, 'vertices': vertices,
            'faces': [[2*i, 2*i+2, 2*i+3, 2*i+1] for i in range(len(panels))],
            'min': minimum, 'max': maximum, 'dimensions': [b-a for a, b in zip(minimum, maximum)],
            'length': length, 'width': width, 'area': length * width,
            'angles': [a * progress for a in angles]}


def _contact(a, b, c, d, epsilon):
    def signed_distance(p, q, r):
        return ((q[0]-p[0])*(r[1]-p[1]) - (q[1]-p[1])*(r[0]-p[0])) / math.dist(p, q)
    def side(x):
        return 0 if abs(x) <= epsilon else (1 if x > 0 else -1)
    s1, s2 = side(signed_distance(a, b, c)), side(signed_distance(a, b, d))
    s3, s4 = side(signed_distance(c, d, a)), side(signed_distance(c, d, b))
    if s1*s2 < 0 and s3*s4 < 0:
        return 'crossing'
    if all(s == 0 for s in (s1, s2, s3, s4)):
        norm = math.dist(a, b)
        ux, uz = (b[0]-a[0])/norm, (b[1]-a[1])/norm
        pc, pd = [(p[0]-a[0])*ux + (p[1]-a[1])*uz for p in (c, d)]
        overlap = min(norm, max(pc, pd)) - max(0, min(pc, pd))
        return 'overlap' if overlap > epsilon else ('touch' if overlap >= -epsilon else None)
    def inside(p, q, r):
        return all(min(p[i], q[i])-epsilon <= r[i] <= max(p[i], q[i])+epsilon for i in range(2))
    if ((s1 == 0 and inside(a, b, c)) or (s2 == 0 and inside(a, b, d)) or
            (s3 == 0 and inside(c, d, a)) or (s4 == 0 and inside(c, d, b))):
        return 'touch'
    return None


def contacts(geometry):
    section = geometry['section']
    epsilon = geometry['length'] * 1e-9
    full = all(a == 180 for a in geometry['angles'])
    blocked, allowed = [], []
    for i in range(len(section)-1):
        for j in range(i+1, len(section)-1):
            kind = _contact(section[i], section[i+1], section[j], section[j+1], epsilon)
            if kind is None or (j == i+1 and kind == 'touch'):
                continue
            item = {'panels': [i, j], 'kind': kind}
            (allowed if full and kind != 'crossing' else blocked).append(item)
    return {'blocked': blocked, 'allowedStackContacts': allowed, 'fullFlatStack': full}


def evaluate(design, target, steps=180):
    if len(target) != 3 or any(not math.isfinite(x) or x <= 0 for x in target):
        raise ValueError('Invalid target')
    if not isinstance(steps, int) or not 1 <= steps <= 10000:
        raise ValueError('Invalid motion step count')
    final = fold(design)
    overflow = [max(0, x-y) for x, y in zip(final['dimensions'], target)]
    tolerance = max(final['length'], final['width'], *target) * 1e-9
    endpoint = all(x <= tolerance for x in overflow)
    blocked = []
    minimum, maximum = [math.inf]*3, [-math.inf]*3
    for step in range(steps+1):
        progress = step/steps
        g = final if step == steps else fold(design, progress)
        contact = contacts(g)
        if contact['blocked']:
            blocked.append({'step': step, 'progress': progress, 'contacts': contact['blocked']})
        minimum = [min(a, b) for a, b in zip(minimum, g['min'])]
        maximum = [max(a, b) for a, b in zip(maximum, g['max'])]
    return {'final': final, 'targetBox': target, 'overflow': overflow, 'endpointFits': endpoint,
            'sampleCount': steps+1, 'blockedSamples': blocked, 'noBlockedContactsAtSamples': not blocked,
            'passesSampledChecks': endpoint and not blocked, 'finalContacts': contacts(final),
            'sampledSweptBox': {'min': minimum, 'max': maximum, 'dimensions': [b-a for a, b in zip(minimum, maximum)]}}
