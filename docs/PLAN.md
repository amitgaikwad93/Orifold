# Orifold project plan

Recorded 2026-11-04. This is the working plan agreed in discussion; estimates are planning assumptions, not measured runtimes or guarantees.

## Goal

Train a small model from scratch that proposes mechanical folding designs given a sheet and packing requirements. Ultimately export useful designs as `.fold` files. Preserve this goal while testing progressively more capable geometry. The original Gemini conversation is historical context, not an authoritative specification: a fixed mathematical evaluator is not a GAN discriminator, local flat-foldability rules do not prove global rigid foldability, and low training loss does not certify a physical design.

Current scope is zero-thickness rigid flat panels only. Thickness adaptation, hinge hardware, axis shifts, panel trimming for thickness, and continuously bending panels are excluded until the user explicitly changes that decision. See DECISIONS.md for rationale and HANDOFF.md for the next executable task.

## First AI capability contract

| Item | Initial scope |
| --- | --- |
| Sheet | Rectangle; zero thickness; four rigid panels with three parallel hinges |
| Design family | Accordion with alternating signed hinge rotations |
| Inputs | Sheet length/width and target-box length/width/height |
| Outputs | Three ordered interior crease positions and three final angle magnitudes in [0°, 180°] |
| Constraints | Positive panel widths, preserved geometry, final box fit, and no prohibited intersections at sampled configurations |
| Prescribed motion | All hinges advance linearly from 0 to their final angles using one normalized progress variable |
| Generalization | Held-out requests within a declared dimension and aspect-ratio range; out-of-range cases reported separately |
| Exclusions | Thickness, stress/fatigue, arbitrary crease graphs, continuous collision proof, layer-order proof, and guaranteed one-actuator deployment |

The progress variable prescribes a coordinated trajectory; it does not establish a one-degree-of-freedom mechanism. Target boxes have fixed axes and permit translation of the final configuration, but no search over rotations. Final fit does not require the motion to remain inside that box. Accordion width cannot contract.

Target length, width, and height are separate upper bounds for packing, not a scalar volume objective or an exact target shape. Material volume is zero; enclosing-box volume may be positive. Fully flat-folded height zero is allowed. Maintain a fixed panel/crease budget so unlimited subdivision cannot trivialize the task.

## Milestones and completion criteria

### Phase 1 — forward geometry implemented; broader physical validation open

- [x] One-hinge reference demo and rigid-distance tests.
- [x] Compose a chain of parallel hinges and evaluate four-panel designs.
- [x] Return vertices, panel faces, material area, and axis-aligned bounds.
- [x] Detect crossings, overlap, and non-adjacent contact in the x-z cross-section.
- [x] Evaluate a prescribed motion at configurable sample resolution; report final fit separately.
- [x] Document terminal flat-stack contact and numerical tolerances explicitly.
- [x] Add automated analytic examples and an interactive accordion view.
- [x] Compare a paper accordion’s closed footprint: user reports 5 × 10 cm, matching the prediction; evidence and limits are recorded in VALIDATION.md.
- Optional: compare intermediate configurations as a geometric sanity check. Additional physical measurements are not a prerequisite for the zero-thickness learning experiment; material/thickness modeling is excluded.
- [x] Review contact policy for the restricted numerical pilot; decision and limits recorded in OPTIMIZATION.md. No broader physical certification is implied.

Contact is conservative: ordinary adjacent hinge contact is allowed; other touch/overlap is blocked, except contact at the exactly fully folded, ideal flat-stack endpoint. That exception does not validate layer order or finite-thickness packing. Sampling may miss events between samples. Passing these checks means passing this evaluator, not a manufacturing guarantee.

### Phase 2 — inverse-design baseline and budgeting pilot (complete for this scope)

- [x] Define a 5% minimum panel length, target generation ranges, strict default fit, and secondary squared-rotation objective.
- [x] Search crease positions and hinge angles using bounded differential evolution. Preserve total sheet length by construction.
- [x] Run 100 reproducible requests on recorded hardware; retain settings, designs, timings, quality, and failures.
- [x] Include 80 witness-validated requests and 20 analytically impossible width requests. Optimizer failure alone is not proof of infeasibility.
- [x] Compare against an equal-panel flat stack and random search with a matched search budget.
- [x] Run both 1% and strict-fit comparisons; use strict-validated labels for future training. No bulk dataset or model training has run yet.

Results: strict differential evolution solved 80/80 feasible pilot requests; random search 72/80; equal-panel stack 40/80. All methods rejected 20 impossible-width requests. Solver mean was 142.50 ms and median 133.89 ms per feasible request on the recorded CPU. See PILOT_RESULTS.md for distributions, limitations, and raw reports.

### Phase 3 — first trained neural model

- Start with a small MLP, approximately 10k–100k parameters, initialized from scratch. Architecture size is a hypothesis, not the definition of capability.
- Use Python/PyTorch for training. Port the geometry with shared analytic fixtures and parity checks before relying on a Python evaluator. The current JavaScript reference keeps the geometry and browser preview identical.
- Normalize dimensions; encode positive panel widths summing to the given length and bounded angles.
- Begin with optimizer-produced supervised examples. Judge predictions by geometry, since multiple designs may solve one request.
- Save dataset generation settings, seeds, split definitions, model settings, checkpoints, and training curves.
- Keep families of related/scaled examples together when splitting data to avoid leakage. Include boundary and out-of-range evaluation separately.

### Phase 4 — measure contribution and export

- Compare network-only proposals, direct optimization, and network-initialized optimization on the same held-out requests and hardware.
- Measure evaluator pass rate, per-axis overflow, latency distributions, solver refinement time, and failure categories.
- Proposed acceptance target: >=95% evaluator pass rate on held-out known-feasible requests, using an explicitly reported fit tolerance no greater than 1% per target dimension. These are experiment targets, not promised outcomes.
- Report strict numerical fit as well as tolerance-based success; the current evaluator uses only numerical tolerance (not the 1% learning target).
- Export meaningful designs as `.fold`, with validation results and motion metadata kept alongside the file. FOLD serialization alone is not certification.

### Later research

Investigate Miura-ori or another zero-thickness rigid-foldable family that contracts in two directions, then geometric deployment constraints, compatible unit combinations, variable panel counts, and eventually variable crease connectivity. Re-budget each capability separately. Arbitrary crease generation is not included in the initial estimate. Thickness adaptation is excluded until the user explicitly reopens it.

## Time and compute budget

Original planning envelope: 2–4 weeks part-time at roughly 5–10 hours/week, with a proposed maximum of $50 for compute experiments. These were initial estimates, not commitments or authorization to spend. The software geometry and optimizer pilot are now implemented and the CPU solver is benchmarked; training effort and runtime remain uncertain.

Use local CPU first. A small MLP may train in minutes to tens of minutes, but this is unmeasured. Paid GPU time is not necessary to begin. No additional paid compute resource has been provisioned.

The original unmeasured scenarios were 14–167 CPU-hours for 10,000 solves. The completed restricted pilot measured 142.50 ms/solve: approximately 24 sequential CPU-minutes for 10,000 comparable solves, or 2.4 minutes for 1,000, before other dataset work. This is an extrapolation and does not cover richer geometry. Training runtime remains unmeasured. Reserve paid compute for measured bottlenecks, with explicit approval before provisioning billable resources.

## Decision gate

Proceed to a larger design family only after the first experiment shows reproducible geometry, usable baseline designs, and measured model behavior. If the network does not improve inference or optimization, record that result and revise the approach rather than increase model size blindly.
