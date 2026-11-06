# Phase 2: numerical baseline and contact-policy review

## Capability and objective

The solver accepts sheet length/width and a fixed-axis target box, and searches four panel lengths and three alternating hinge-angle magnitudes. It is a conventional numerical optimizer, not a neural model. Minimum panel length is 5% of the sheet length. A stick-breaking parameterization allocates the remaining 80%, so every candidate preserves sheet length and has valid positive panels. Angles range from 0° to 180°; a zero angle means a nominal hinge can remain inactive.

Primary objective: fit inside the target box and avoid blocked contacts under the existing prescribed motion. Among candidates that pass the search checks, minimize the mean squared hinge-angle magnitude normalized by 180°. This secondary preference discourages unnecessary rotation. It is **not** a strain, torque, energy, or fatigue calculation. A found candidate is not a certified global optimum.

By default, the solver requires numerical box fit, without a 1% engineering allowance. It reports strict fit separately from tolerance-based acceptance. The initial pilot used the planned 1% learning tolerance and exposed the optimizer's tendency to consume that allowance; a strict rerun was therefore performed before selecting training labels.

## Algorithm

`src/optimizer.js` implements bounded differential evolution with six parameters, a population of 24, and 40 generations (984 scored candidates). Mutation scale is 0.7 and crossover probability 0.8, with values clipped to [0,1]. A fixed seeded PRNG makes designs reproducible; runtime is not deterministic.

Three canonical seeds are shared with the random-search comparison: equal panels fully folded, flat, and at 90°. All other initial candidates are random. Search candidates are compared lexicographically: any feasible candidate is preferred to an infeasible one; infeasible candidates minimize squared relative fit violation plus a binary contact penalty; feasible candidates minimize the secondary rotation objective. Geometry is normalized by sheet length during search.

Contacts are checked at 31 states during search. The best eight distinct candidates are rechecked at 721 states; only a passing candidate may be returned as `solved-sampled`. If none passes, the result is `budget-exhausted`, not a claim of impossibility. If width is too large or the fixed first panel cannot fit even at its minimum permitted length, return `analytically-infeasible` before searching. Those are necessary conditions for this restricted model, not a complete infeasibility test.

## Contact review: decision for the pilot

The existing cross-section classifier is suitable for a **restricted numerical experiment**, with the following limits preserved in every interpretation of the results:

1. Parallel hinges and identical y extents justify reducing these panels to x-z segments. This is not a general origami collision detector.
2. Adjacent shared-hinge contact is allowed. Other touches/overlaps are conservatively blocked except at the exact fully closed flat-stack endpoint. Some physically workable partial stacks will be rejected; label failures as evaluator failures, not physical impossibility.
3. The exactly-180° contact exception is discontinuous and has no layer-order proof. Keep an explicit flat-stack seed so the optimizer can compare this idealized endpoint without relying on accidental floating-point sampling of it. The user's paper footprint supports the equal-panel example only.
4. Use derivative-free search for this initial discontinuous objective. Do not claim it is a differentiable physics loss for network training. Supervised imitation can use the validated solver outputs first.
5. Dense sampling is a guard against coarse-search artifacts, not a continuous collision guarantee. Layer order, finite thickness, enclosure motion, and one-actuator deployment remain unverified.

Decision: proceed with the pilot and small-model experiments under this explicit idealized contract. Keep broader physical validation open. No manufacturing-readiness claim is made.

## Run a request

```sh
npm run solve -- examples/narrow-box.json
```

The JSON output includes the proposed design, per-axis overflow, final dimensions, sampled collision result, search settings, evaluated-candidate count, and elapsed time. It does not require a GPU or external packages.

## Reproduce the pilot

```sh
npm run pilot -- artifacts/pilot-strict.json 0
npm run pilot -- artifacts/pilot-1pct.json 0.01
```

The dataset seed is 20261104; request i uses search seed 20261104+i+1. Sheet length is sampled in [10,100) cm and width in [5,30) cm. There are 40 wide-box cases, 40 narrow/tall cases with target length below 24% of sheet length, and 20 analytically impossible width cases. Feasible targets come from withheld witness designs checked at 721 states. They are feasible under this evaluator, not independently certified physical designs. The solver receives only the sheet/target dimensions, not the witness or group label.

The equal-panel baseline is one fully closed equal-panel design. Random search and differential evolution share seeds and a 984-candidate budget. Explicit warm-up runs are discarded and method order rotates by request. Raw records include all requests, witnesses, settings, chosen designs, failures, and timing; see [PILOT_RESULTS.md](PILOT_RESULTS.md).

The 100 requests are a budgeting/algorithm pilot, not training data or a held-out model benchmark. Freeze future training/validation/test splits separately and group scaled variants together.
