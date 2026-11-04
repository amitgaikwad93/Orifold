# Parallel-hinge geometry reference

The module `src/accordion.js` is the dependency-free reference for phase 1. It runs in Node and in the browser. The demo uses centimetres; the evaluator is unit-consistent and accepts any common length unit.

## Parameterization and kinematics

For four panels, supply lengths `[l0, l1, l2, l3]`, width `W`, and final hinge-angle magnitudes `[a0, a1, a2]`. All panel lengths and W are positive; their sum is the unfolded length. Interior creases are the prefix sums of panel lengths. Angles lie in [0,180] degrees.

The first panel is fixed along +x. The hinge axes are parallel to y. At motion progress t ∈ [0,1], accumulate orientations:

    phi[0] = 0
    phi[i] = phi[i-1] + (-1)^(i-1) * a[i-1] * t
    q[0] = (0, 0)
    q[i+1] = q[i] + li * (cos(phi[i]), sin(phi[i]))

Here q is the x-z cross-section and trigonometry uses radians after angle conversion. Extrude each q along y ∈ [0,W] to obtain panel corners. The same hinge endpoints are shared by neighboring panels. This preserves all within-panel distances by construction. It models coordinated rotations, not actuator coupling or a one-DOF linkage.

## Contact policy

For this restricted family, every panel spans the same y interval. Panel intersection reduces to intersection of line segments in the x-z cross-section. This simplification does not apply to arbitrary origami.

- Proper crossings are blocked.
- Ordinary contact at the shared hinge of two adjacent panels is allowed.
- Non-adjacent touches and collinear overlap are conservatively blocked.
- When **all** hinge angles are exactly 180°, collinear stack contact is reported separately and allowed as an ideal zero-thickness endpoint. Layer ordering and thickness remain unvalidated. Partial stacks, where only some hinges close, are conservatively blocked if panels overlap.

The segment classifier uses signed distances with epsilon = 1e-9 × total sheet length. Panel lengths must exceed 1e-8 × total length to avoid degenerate segments at that precision. These are numerical restrictions, not manufacturing constraints. Features smaller than the tolerance are not resolved.

## Fit and motion results

`foldAccordion(design, progress)` returns vertices, faces, cross-section, bounds, dimensions, and material area. `checkContacts(geometry)` classifies contacts at that configuration.

`evaluateAccordion(design, targetBox, {steps: 180})` samples 181 states including both endpoints under the simultaneous linear schedule. Returned fields include:

- `endpointFits`: final axis-aligned dimensions fit within the target, using numerical tolerance 1e-9 × max(sheet dimensions, target dimensions).
- `overflow`: positive oversize per target axis in the input units.
- `blockedSamples`: offending progress values and panel pairs (zero-based indices), including the final state if blocked.
- `passesSampledChecks`: endpoint fits and no blocked contacts at the tested samples.
- `sampledSweptBox`: bounding box of all sampled vertices in the fixed coordinate frame. It is an estimate of the swept envelope, not an exact continuous-motion bound.
- `assumptions`: explicit flags for unverified continuous collisions, layer order, enclosure motion, thickness, and actuator behavior.

Fit permits final translation but no reorientation search. The target is a storage requirement; motion inside an enclosing box is not checked. Sampled collision tests may miss events between samples. Increase sampling for investigation, but do not present finite sampling as a proof of continuous validity.

## Analytical fixtures

For `[5,5,5,5]`, W=10:

| Hinge angles | Cross-section endpoints (x,z) | Bounding box |
| --- | --- | --- |
| [0,0,0] | (0,0), (5,0), (10,0), (15,0), (20,0) | 20 × 10 × 0 |
| [90,90,90] | (0,0), (5,0), (5,5), (10,5), (10,10) | 10 × 10 × 10 |
| [180,180,180] | (0,0), (5,0), (0,0), (5,0), (0,0) | 5 × 10 × 0 |

The folded material still has area 200 in all cases. The fully folded endpoint's zero height is an idealization, not a usable finite-thickness packing prediction.
