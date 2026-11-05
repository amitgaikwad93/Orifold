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

## Next work items for this instance

1. ~~Answer key, map, checks~~ (r6) and ~~v2 dataset with acceptance checks~~ (done 2026-11-05).
2. User reviews round `answer-key-1`; fix the answer key if answers are rejected.
3. Codex aligns the checker's order-score counting with section 5 and reruns on the dataset.
4. Define the v2 model and training (new experiment config): inputs are sheet, box and fold budget; outputs are a design. Predeclare the loss, model and checkpoint selection on validation only, then train on CPU.
5. Evaluate on test once, with the review page round for model outputs.
