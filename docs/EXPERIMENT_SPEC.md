# Experiment specification

Every experiment fills in this specification **before** data is generated or a model is trained. Part 1 is the reusable template. Part 2 is the agreed instance for the next experiment. Changing a filled-in specification after results are seen must be recorded as a new version, not edited silently.

Status labels: **decided** = the user agreed (DECISIONS.md reference). The user accepted all agent-proposed sub-definitions on 2026-11-05 (D22); text still saying *proposed* below is decided unless listed in DECISIONS.md open questions.

## Part 1 — template

| Section | What it must state |
| --- | --- |
| 1. Question | The single question the experiment answers, in plain language |
| 2. Fold family | Crease layout, allowed fold count, fold directions, motion, minimum panel size |
| 3. Validity | Hard rules a design must pass; how they are checked; what is out of scope |
| 4. Task satisfaction | What "fits the box" means, including margin |
| 5. Ranking | How valid, fitting designs are ordered, so each request has one reference answer |
| 6. Requests | How sheet and box sizes are chosen; never derived from solutions |
| 7. Reference answers | How labels or reference designs are produced |
| 8. Dataset acceptance | Checks the dataset must pass before training: consistency, coverage, independence, revalidation, leakage grouping |
| 9. Success criterion | What result counts as success, who judges, predeclared before results |
| 10. Reported context | Baselines and secondary metrics, reported but not success gates |
| 11. What a failure would and would not mean | Interpretation agreed in advance |

## Part 2 — experiment v2: parallel creases, variable fold count

### 1. Question (decided, D20)

For a given sheet size and box size, does a model trained from scratch output a **valid fold pattern**?

### 2. Fold family (decided, D19 and D21)

- Zero-thickness rigid panels, all creases parallel to the sheet width.
- **0 to 11 folds (1 to 12 panels).** Zero folds is the correct answer when the flat sheet already fits.
- Each panel is at least 5% of sheet length.
- Fold directions alternate mountain/valley. All folds move together on the existing simultaneous linear schedule.
- The first panel is the fixed reference frame for the motion. For the final fit, the folded shape may turn about the hinge axis (side-view rotation) and is placed at its recorded `placement` angle (D30).
- Free fold directions, non-parallel creases and Miura-type patterns come only after this pipeline is proven.

### 3. Validity (decided layers, D11)

A design is valid when:

- panel lengths are positive, each at least 5% of sheet length, and sum to the sheet length;
- fold angles lie in [0°, 180°];
- **every crease actually folds.** *Proposed:* an angle below 1° counts as no fold. Such creases are not allowed; merge the two panels and count one fold fewer;
- no prohibited contact occurs at 721 sampled motion states, under the existing contact policy (GEOMETRY.md).

Out of scope, as in LIMITATIONS.md: continuous collision proof, layer order, thickness, actuation.

### 4. Task satisfaction (decided, D18)

The final folded shape, turned by its placement angle, must fit inside the target box with a **2% gap on every axis**: each final dimension ≤ 0.98 × the box dimension. Height zero (flat folded) satisfies any height. Width cannot shrink in this family, so a box narrower than sheet width ÷ 0.98 is analytically infeasible.

### 5. Ranking (decided: D26–D29, replacing the D16 order)

Each request carries a **fold budget** (maximum folds, D26). Reference answers are produced for budgets from the minimum feasible fold count up to the minimum + 2 (capped at 11).

Within a budget, among valid designs that fit:

1. **Most spread (D27):** the widest *smallest opening angle* between neighbouring panels (180° − largest fold angle; 180° with no fold). Every design within **10%** of the widest counts as equally spread (D29). The band is measured against the best design for that request and budget, so the ranking stays consistent.
2. Within the band, in strict order:
   1. **symmetric** first: palindromic panel lengths and fold angles; mirror for even panel counts, rotational for odd, both accepted (D28);
   2. **fewer folds**;
   3. **lower order score:** distinct lengths (1% of L) + distinct angles (1°) + 1 if not symmetric. "Distinct" is counted by chaining: sort the values, and start a new group only where a gap between neighbours exceeds the tolerance. So 25.0, 25.8 and 26.6 (L = 100) form one group. Clarified 2026-11-05 after the independent checker, which used fixed-span bins, disagreed on 8/6,004 dataset answers;
   4. **wider opening angle;**
   5. **larger smallest gap** between non-adjacent panels during the motion;
   6. **smaller swept area** (differences under 1% of L² are ties, D23);
   7. **more compact:** shorter final length, then lower height.
3. Designs outside the band rank by opening angle.

"Fewer folds" ranks inside the band; it is an agent implementation choice. It means a design with fewer folds wins when it is nearly as spread. The ranking defines the reference answers; the success criterion (section 9) needs validity only.

**Watch item:** the smallest opening angle only measures *neighbouring* panels. Designs can use short "spacer" panels to open wide angles while two long non-adjacent panels stay parallel (seen at box 60 × 10 with 3 folds). This is valid, but the user should judge it visually.

### 6. Requests (decided, D17)

The goal is a general model of origami geometry, not one application. Requests therefore come from a **systematic grid** over shape ratios:

- box length ÷ sheet length;
- box height ÷ sheet length;
- sheet width ÷ sheet length;
- box width relative to sheet width.

Random jitter within each grid cell keeps the model from memorising grid points. Requests are never derived from random folds (D10).

**Frozen distribution for v2 (D24).** All ratios are relative to sheet length L.

| Share | Box length | Box height | Purpose |
| --- | --- | --- | --- |
| 75% | uniform in [0.05, 0.50] | uniform in [0.02, 1.06] | Short boxes: 2+ folds, varied designs |
| 15% | uniform in [0.50, 1.08] | uniform in [0.02, 1.06] | Easy cases: 0–1 folds |
| 10% | half below 0.05 (first panel cannot fit), half with box width under sheet width ÷ 0.98 | as above | Impossible diagnostics, reported separately |

Other settings:
- Sheet width ÷ L is uniform in [0.05, 0.5].
- For feasible requests, box width = sheet width × uniform [1.03, 1.30].
- Sheet length is uniform in [10, 100]. Geometry is scale-free, so this only tests units.
- Splits are grouped by (box length, box height) cells of 0.04 × 0.04, so near-duplicates never cross train/validation/test. Since D30, a box and its length/height-swapped partner are the same problem and must share a group.

Section 8's "three seeds" consistency check applies to stochastic solvers. The reference solver is deterministic, so its consistency evidence is instead: identical re-runs, the free-form completeness check, and the independent Codex checker (D25).

Known feasibility: an equal-panel flat stack with N panels has final length L/N and height 0. So a request is feasible by construction whenever the width fits and box length ≥ L / (12 × 0.98). Other requests may still be feasible using height; the reference solver decides those, and a solver failure is not proof of impossibility.

### 7. Reference answers (proposed)

The ranking puts discrete properties first (fold count, order score). So the reference solver should:

1. search fold counts from 0 upward;
2. for each count, try the most ordered designs first (equal panels with one angle, then mirror-symmetric designs), using exact one- or two-parameter searches;
3. fall back to a general search only when no ordered design fits.

The result must not depend on the random seed.

### 8. Dataset acceptance (proposed thresholds)

Before any training:

- **Consistency:** re-solving with three seeds gives the same fold count and order score for ≥ 99% of requests. (v1 failed this check; D10.)
- **Revalidation:** every reference design passes the evaluator independently.
- **Coverage:** a request-space map shows feasible, infeasible and unknown regions, with no unexplained gaps.
- **Independence:** requests are generated before and without reference to any solution.
- **Leakage:** splits are grouped by grid cell, so neighbouring near-duplicates are not split across train and test.

### 9. Success criterion (decided, D20)

On a frozen held-out set of feasible requests, the model's output is checked two ways:

1. **Mathematically:** the evaluator's pass rate under sections 3–4, reported exactly.
2. **Visually:** the user reviews outputs on a review page built for this experiment and decides whether they are valid fold patterns.

**The user's verdict decides success.** *Proposed reference point:* ≥ 95% evaluator pass rate. Infeasible requests are reported separately.

### 10. Reported context (not success gates)

Reported for honesty about whether learning added value (AGENTS.md):

- how often the model matches the reference answer's fold count and order score;
- the hand rule "folds = sheet length ÷ box length, rounded up, flat stack";
- nearest-neighbour lookup;
- the reference solver;
- timings.

### 11. Interpretation, agreed in advance

- **Success** means the model learned to produce valid patterns for this family. It does not mean learning beats the hand rule or the solver.
- **Failure** with a dataset that passed section 8 is real evidence about the model or training. Failure before section 8 passes says nothing about the approach.

## Evidence so far: request-space map (2026-11-05)

Report: https://claude.ai/artifact/DG4P4RTYrbJixzZAbPjwWj (private to the user). Data: `results/request-map-2026-11-05.json.gz` and `results/request-map-completeness-2026-11-05.json`. Rebuild with `npm run map -- <out.json>`, `npm run map:check -- <map.json> <out.json> 40 3`, and `npm run map:report -- <map.json> <out.html> <check.json>`.

The grid has 729 requests: a 100 × 10 sheet, box length 0.04–1.08 and box height 0.02–1.06 (as fractions of sheet length) in steps of 0.04, box width 12. Measured:

- **Solved:** 701. **Proven impossible:** 27 (first panel cannot fit). **Not found within 11 folds:** 1 (box 8 × 2).
- **Fold counts:** 0: 54, 1: 469, 2: 118, 3: 31, 4: 13, 5: 6, 6: 5, 7: 1, 8: 3, 11: 1. A uniform grid is dominated by easy one-fold answers; interesting designs live in short boxes.
- **Against the hand rule:** the reference never needs more folds. It needs fewer in 209 requests by using the box height, and solves 26 where the hand rule would need over 11 folds.
- **Order scores:** 1: 54, 2: 412, 4: 118, 5: 117.
- **Completeness check:** independent free-form search, with 3 seeds and one fold fewer than the reference, beat the reference in 3 of 218 cells. All three are designs from the reference's own family (different first panel, two angles) that its grid resolution missed.
- **Search power:** at the reference's own fold count, the free-form search found designs in 168/168 cells needing 2–5 folds, but only 2/10 needing 6 or more. So "no fewer folds found" is good evidence up to about 5 folds and weak above.
- **Runtime:** map 61 s, check 9 s on CPU.

Observation for the ranking: several one-fold answers stopped at 177–179° rather than a clean 180°. Fixed by D23.

**Revision r2 (same day)** fixed the reference's grid misses: finer near-closed angles, more refinement starts, and contact-aware refinement. Results: `results/request-map-2026-11-05-r2.json.gz`, `...-completeness-2026-11-05-r2.json`, `results/independent-check-2026-11-05-r2.json`.

- The free-form check now beats the reference in **0/218** cells (was 3).
- Eight cells dropped one fold.
- The Codex independent checker passes all 701 solved designs.
- The report linked above shows r2.

**Revision r4 (D26–D29 ranking, 2026-11-05):**
- **Feasibility:** unchanged; 701/729 solved, and fewest-fold counts match r2 (free-form beat 0/218).
- **Symmetric answers:** 297/701 at the minimum budget, 650 at +1, 684 at +2.
- **Spread check:** the free-form search beat the reference's spread beyond the 10% band in 46/180 cell-budgets, 35 of them using near-flat creases under 10°. Open question in DECISIONS.md.
- **Runtime:** map 9.7 min on CPU.

**Revision r5 (D30 turning allowed, 2026-11-05):** the grid is now 784 cells with identical length and height values (0.02, 0.04–1.08). Results: `results/*-r5.json*`.
- **Feasibility:** 778 solved, 0 proven impossible, 6 not found (all boxes at most 0.08 × 0.08 of sheet length).
- **Mirror check:** 378 swapped pairs; status and fewest folds agree in all; the opening angle differs by more than 10% in 28 of 1,126 pair-budgets, from search resolution.
- **Fewest folds:** the free-form search beat it 0/174. **Spread:** the free-form search beat it beyond the band in 23/180, down from 46.
- **Artefacts:** 5% "foot" first panels fell from 492 to 14 of 1,595 folded answers.
- **Flat sheets:** 245 boxes need no fold; 95 of them place the flat sheet diagonally in the box.
- **Symmetry:** 545/778 at the minimum budget, 765 at +1, 776/776 at +2.
- **Dead creases remain** at budget +2: 260/776 answers contain a fold under 10°. Typical: `[45, 5, 5, 45]` with angles `[89.4°, 1°, 89.4°]`, a U-shape with a fake middle crease. Open question in DECISIONS.md.
- **Runtime:** map 15.7 min on CPU.

**Revision r6 (stronger spread search, D33 alternation kept, 2026-11-05):** results in `results/*-r6.json*`.
- **Feasibility:** 778/784 solved, 6 not found.
- **Fewest folds:** the free-form search beat it 0/174.
- **Spread:** the free-form search beat it beyond the 10% band in **8/180** (was 23).
- **Mirror pairs:** fewest folds agree 378/378; the opening angle differs beyond 10% in **2/1,126** (was 28).
- **Symmetry:** 537/778 at the minimum budget, 776/776 at +1 and +2.
- **Runtime:** map 21 min on CPU.
- **Independent check:** Codex's checker has not yet been updated for D30 placement, so it fails turned designs (1,808/2,330); the update is requested.

This is the answer-key baseline for the v2 dataset.

## v2 dataset (2026-11-05)

`experiments/learning-v2/`: `config.json` and `manifest.json` (frozen before labelling), `labels-*-of-3.jsonl`, `dataset.jsonl.gz`, `dataset-summary.json` and `acceptance/`. Built with `scripts/generate-v2-dataset.js` (steps: requests, label shards, merge).

- **Size:** 2,200 requests: 1,500 short, 500 long, 100 width-impossible, 100 tiny. 6,004 reference answers across the three budgets. Label CPU 4,218 s.
- **Splits** (366 groups, swapped boxes grouped): train 1,548, validation 324, test 328.
- **Solved:** all train/long, train/short, validation/long and test/long requests. 198/201 validation/short and 203/204 test/short; the unsolved 4 are not proven impossible. Width-impossible requests are rejected analytically. Tiny boxes: 15/29 solved in test (9–11 folds), 0/71 in train and validation.
- **Known split imbalance (not corrected; splits were frozen first):** the tiny-box groups and a few 9–11-fold short boxes fell mostly into test. Train short boxes need at most 9 folds; test includes 4 short boxes needing 11. Report test results for cases beyond the training range separately.

**Acceptance checks (section 8):**
- **Validity:** the independent checker passes all 6,004 answers on rules, placed fit, contacts at 721 states, budgets, symmetry and spread (4.3 M motion states). Order score: 8 disagreements, traced to an ambiguity in "distinct within 1%"; resolved in section 5 (chaining). The checker update is requested.
- **Fewest folds** (train): the free-form search beat it 0/474.
- **Spread** (train): beaten beyond the 10% band in 5/180.
- **Consistency:** the reference solver is deterministic (identical re-runs).
- **Coverage:** the request-space map (r6) covers the box-shape space; the dataset follows the frozen distribution.
- **Independence:** requests were generated before labelling, from the distribution only.
- **Visual review:** round `answer-key-1`, 48 training answers at https://claude.ai/artifact/4Qr8nQDonaJSsWnYCG5FdA. **Awaiting the user's verdicts.**

## v2b dataset: creases on walls (D34, 2026-11-05)

`experiments/learning-v2b/` keeps v2's requests and splits (`manifest.json` copied) and relabels them under D34. Label CPU 7,667 s.
- **Walls:** 6,004/6,004 answers have every crease on a wall (0 floating).
- **Unchanged from v2:** solved/unsolved status and fewest-fold counts.
- **Spread cost versus v2:** median 0°, 90th percentile 8.7°, maximum 57.6°. The largest costs are all v2 "spacer panel" designs (`[45, 5, 5, 45]`), now 3-panel zigzags with creases on walls. 396 answers widened.
- **Validity:** Codex's updated checker (offset containment and floating-crease count added, order-score counting aligned with section 5) passes **6,004/6,004** with 0 disagreements; all 6,004 have 0 floating creases.
- **Correction:** it first flagged 801 answers whose stored slide offset had been rounded to 6 decimals, placing shapes up to 5e-7 units past a wall. Fixed in `src/packing.js` (the offset is computed at the stored, rounded angle and not rounded), and the offsets in `dataset.jsonl.gz` were recomputed with `scripts/fix-v2b-offsets.js`. Designs, angles and floating counts are unchanged; the original file is in git history (commit 1ee9503). `labels-*-of-3.jsonl` keep the original offsets; `dataset.jsonl.gz` is authoritative.
- **Fewest folds** (train): free-form search beat it 0/474.
- **Spread with walls required on both sides** (train): beaten beyond the band in 13/180 (v2: 5/180 without the wall constraint).
- **Evidence:** `experiments/learning-v2b/acceptance/`.
- **Visual review:** round `answer-key-2`, 48 new training answers: **48 valid, 0 unsure, 0 not valid** (`experiments/learning-v2b/acceptance/review-answer-key-2.json`). The answer key is accepted; all section 8 checks have passed.

The v2 dataset is kept as a record but superseded for training by v2b.

## v2b model runs (validation only; the test split is untouched)

Configs are in `experiments/learning-v2b/train-config*.json` and evidence is in `run-*/`. All runs use the same data, inputs, outputs and network (MLP 256×256, 75,554 parameters, trained from scratch on CPU in about 2–3 minutes).

| Run | Loss | Model-alone pass (validation / train) | Opening bias / scatter | Pass at 1% / 5% / 10% sheet tolerance | Model + correction |
| --- | --- | --- | --- | --- | --- |
| 1 | imitation | 45.3% / 46.6% | −3.9° / 6.2° | 53.8 / 74.5 / 82.3% | 93.8%, opening 76° |
| 2 (w100) | + fit penalty | 78.5% / 86.0% | −36.3° / 32.9° | 84.0 / 90.8 / 95.2% | 96.7%, opening 17° |
| 3 (t100, selected by bias rule) | + do-not-fold-tighter | 48.6% / 48.2% | −5.1° / 6.5° | 59.4 / 71.7 / 82.8% | 89.2%, opening 76° |

| 4a | run 3 + crease-position imitation | 38.3% / 49.2% | −4.3° / 5.4° (fold angles −19° / 54°) | 48.8 / 62.6 / 68.6% | 79.0%, opening 89° |
| 4b | run 3 + 512×3 network | 39.6% / 44.0% | −5.6° / 6.1° (fold angles −33° / 64°) | 46.7 / 59.5 / 68.5% | 68.1%, opening 93° |

Nearest-neighbour copy: 51.3%. Imitation ceiling: 99.6%.

**Correction (2026-11-06, found by Codex in memorization-v1).** The tolerance columns above used `P.overflowOf`, which can report overshoot at an arbitrary turn for shapes that cannot fit, overstating misses. Recomputed with a dense best-turn sweep (`scripts/tolerance-curve.js`, revised; `run-*/validation-tolerance-curve-sweep.txt`), pass at 1% / 5% / 10% of sheet:
- run 1: 57.4 / 87.4 / 94.5%
- run 2: 87.1 / 95.1 / 98.2%
- run 3: 62.0 / 82.7 / 95.6%
- run 4a: 51.7 / 70.6 / 81.8%
- run 4b: 47.7 / 67.2 / 81.9%

The conclusion at small tolerances holds: run 1 is not precise enough. But most of run 1's misses are within 3–5% of the sheet, not far off. Also, Codex found that the run-4a position loss counted padded vertices (fixed in `33da2b3`), a second confound for 4a.

**Run 4 lesson (agent design error).** The run-3 "do-not-fold-tighter" penalty is one-sided: over-opening folds costs nothing. Runs 4a and 4b exploited this: fold angles drift 19–33° open with very large scatter, and 61 and 68 validation designs collide. The opening-angle measure looks only at the most-closed fold and hid it. So run 4 does not fairly test shape imitation or capacity. From now on, bias and scatter are reported over all fold angles, and precision is tested first without aim-adjusting penalties (proposed run 5).

Reading:
- Run 2's validity came from aiming away from the walls (folding tighter), not from precision.
- With the aim held near the reference (run 3), validity returns to about 48%, and the model fits its own training data no better.
- Precision is the bottleneck. Next: shape-based (crease-position) imitation and/or more capacity, judged first on training-set fit and scatter.

## Next work items for this instance

1. ~~Answer key, map, checks~~ (r6) and ~~v2 dataset with acceptance checks~~ (done 2026-11-05).
2. ~~Review round answer-key-1~~ (42 valid, 6 unsure; led to D34 and v2b). Review round answer-key-2 on v2b.
3. Codex aligns the checker's order-score counting with section 5 and reruns on the dataset.
4. Define the v2 model and training (new experiment config): inputs are sheet, box and fold budget; outputs are a design. Predeclare the loss, model and checkpoint selection on validation only, then train on CPU.
5. Evaluate on test once, with the review page round for model outputs.


## Training-only memorization diagnostic (D35, 2026-11-05)

The user authorized the small diagnostic before further scaling. Frozen setup and manifest: `experiments/memorization-v1/` (commit `33da2b3`, made before training). The position loss now ignores padded endpoint copies; dtype/device-preserving differentiable geometry has analytical, independent-export parity and gradient checks. Historical run 4a used the old padded loss and competing penalties; it is preserved unchanged.

Two identical 256×256 models trained on 32 training requests, two folds and one exact family, for 4,000 fixed full-batch epochs without fit/tighter penalties. Neither met the all-32 copying gate. Parameter/position imitation respectively: 12/32 and 10/32 sampled-valid, 0 sampled collisions, mean per-example vertex RMS 0.530%/0.353% L, angle MAE 0.891°/1.311°. Float32 reference round trips pass 29/32 at saved placement and 32/32 after placement search. Failed-search overflow can describe an unturned fallback pose; the separate placement sweep is labeled post-hoc. No validation or test examples were used.

[Complete results, limitations and next recommendation](../experiments/memorization-v1/REPORT.md). This diagnostic does not choose a generalization winner or authorize the proposed full-data run 5.


## Independent-output control (D36, 2026-11-06)

Protocol/code frozen in `5c17779`, before optimization; evidence in `experiments/independent-outputs-v1/`. Same 32 training examples, same initial outputs and generic decoder, each request owns separate logits. No family-specific shape, fit penalty, geometric repair or rule change. Both existing imitation losses are reused.

Same-schedule float32 Adam: parameter/position losses pass 1/32 and 3/32; neither reaches the copying gate. Per-request float64 L-BFGS refinement: both reach **32/32** copying, sampled validity, zero floating creases and opening within the reference band. Casting refined logits to float32 retains all passes. All 192 independent/reference overall decisions agree. Saved reference poses are more sensitive: refined passes 29/32 and 31/32 before re-placement. The finite 0.01° sweep misses one known-fitting pose and must not be used to infer infeasibility.

This establishes that both losses can optimize the existing format to suitable answers individually. Refinement changes optimizer and precision together; it does not prove a specific cause of network failure. Recommended next, not yet adopted: optimizer/precision controls on the unchanged shared network. [Complete results and limitations](../experiments/independent-outputs-v1/REPORT.md). No held-out examples used; no active run remains.
