# What a passing result does and does not mean

Single reference for the evaluator's limits. Other documents link here rather than repeating the list. Mention only the items that change the interpretation of a specific result.

## The model of the world

- **Zero thickness, rigid flat panels, ideal hinges.** Material volume is zero; no bending, stretching, strain, fatigue, or material behaviour. This is a deliberate scope decision (DECISIONS.md D02), not an oversight.
- **One fold family so far:** parallel creases, 1–12 panels (v1 used exactly four), alternating fold directions. Width can never shrink in this family. Results do not transfer to other crease patterns automatically.
- **Prescribed motion.** All hinges rotate together on a linear schedule. This is a chosen path, not proof that the mechanism has one degree of freedom or can be driven by one actuator.

## What "pass" checks

A design passes when (a) its **final** shape fits inside the target box (translation allowed, and turning about the hinge axis by its recorded placement angle) and (b) no prohibited contact is found at the **sampled** motion states (721 for acceptance).

It does **not** check:

- collisions between samples (no continuous collision proof);
- the order in which stacked layers lie on top of each other;
- whether the motion stays inside the box (only the endpoint must fit);
- thickness, manufacturability, strength, or actuation;
- function or aesthetics. These are *ranking preferences* among passing designs (EXPERIMENT_SPEC.md section 5), not pass/fail checks.

## Contact policy caveats

- Contact is checked in the 2D side cross-section. That is only valid because all hinges are parallel and all panels have the same width; it is not a general origami collision detector.
- Non-adjacent touching is conservatively blocked, which rejects some workable partial stacks. The one exception is the ideal fully closed flat stack (all hinges exactly 180°).

## How to describe results

- "Solver did not find a design" is not "no design exists". Only the explicit width check proves impossibility.
- Numerical-optimizer results and neural-network results are different claims; keep them apart.
- Lower training loss is not geometric success; only the evaluator's acceptance counts.
- The user's paper-accordion check (5 × 10 cm footprint, VALIDATION.md) supports one example only.
