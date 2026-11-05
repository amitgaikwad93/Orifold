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
- The first panel stays fixed along the length axis; there is no reorientation search.
- Free fold directions, non-parallel creases and Miura-type patterns come only after this pipeline is proven.

### 3. Validity (decided layers, D11)

A design is valid when:

- panel lengths are positive, each at least 5% of sheet length, and sum to the sheet length;
- fold angles lie in [0°, 180°];
- **every crease actually folds.** *Proposed:* an angle below 1° counts as no fold. Such creases are not allowed; merge the two panels and count one fold fewer;
- no prohibited contact occurs at 721 sampled motion states, under the existing contact policy (GEOMETRY.md).

Out of scope, as in LIMITATIONS.md: continuous collision proof, layer order, thickness, actuation.

### 4. Task satisfaction (decided, D18)

The final folded shape must fit inside the target box with a **2% gap on every axis**: each final dimension ≤ 0.98 × the box dimension. Height zero (flat folded) satisfies any height. Width cannot shrink in this family, so a box narrower than sheet width ÷ 0.98 is analytically infeasible.

### 5. Ranking (decided order, D16; sub-definitions proposed)

A strict priority order. Each step only breaks ties left by the previous one:

1. **Valid and fits** (sections 3–4).
2. **Fewest folds.**
3. **Most ordered (geometric aesthetics, D14).** *Proposed score, lower is better:* number of distinct panel lengths (within 1% of sheet length) + number of distinct fold angles (within 1°) + 1 if the panel sequence is not mirror-symmetric.
4. **Largest smallest gap** between non-adjacent panels during the motion.
5. **Smallest swept envelope** of the motion.
6. **Most compact** final shape: smaller final length, then smaller height.

The ranking defines the reference answer. The success criterion below needs validity only.

### 6. Requests (decided, D17)

The goal is a general model of origami geometry, not one application. Requests therefore come from a **systematic grid** over shape ratios:

- box length ÷ sheet length;
- box height ÷ sheet length;
- sheet width ÷ sheet length;
- box width relative to sheet width.

Random jitter within each grid cell keeps the model from memorising grid points. The grid includes tight cases, zero-fold cases and impossible cases. Requests are never derived from random folds (D10). Proposed ranges are to be fixed when the request-space map is produced.

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

Observation for the ranking: several one-fold answers stop at 177–179° rather than a clean 180° flat fold. The swept-envelope tie-break (rank 5) prefers them by tiny margins before compactness is considered. See DECISIONS.md open questions.

## Next work items for this instance

1. ~~Allow 1-panel designs~~; ~~margin, active-crease rule and ranking measures~~; ~~reference solver and map report~~ (done 2026-11-05: `src/packing.js`, `tests/packing.test.js`, scripts above).
2. Fix the reference solver's resolution misses: refine near-miss designs using the contact check, not only overflow, and recheck the three beaten cells.
3. Decide the open ranking and request-weighting questions, then define the frozen request distribution and run the dataset-acceptance checks (section 8).
4. Build the visual review page needed for section 9.
