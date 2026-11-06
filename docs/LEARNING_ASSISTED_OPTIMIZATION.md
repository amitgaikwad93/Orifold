# Next research iteration: learning-assisted optimization

Discussion recorded 2026-11-06, after the step-4 validation benchmark and D42. This records the user's proposed direction and the agent's recommended next steps; no new experiment has started.

## Naming and actual completion state

Call this the **learning-assisted optimization iteration**. It is a new research iteration containing several experiments, not a single run. Avoid the bare name “experiment 2”: learning-v2, learning-v2b and network-optimization-v2 already exist and retain their historical meanings. Future experiments should have descriptive versioned names and frozen protocols.

The earlier step 4 is complete. Earlier step 5 (freeze a quality/speed policy, then final test) is still open; it was discussed, not performed. The numbered next steps below are a new roadmap, not claims that those tasks have finished. Final test remains untouched.

## North star and current position

The goal remains a model trained from scratch that proposes useful mechanical origami geometry, eventually across richer patterns. Packing an accordion into a box is the first controlled exercise. Current scope remains zero-thickness rigid panels with parallel, alternating folds. Thickness, materials and hinge hardware require an explicit scope change.

We have reproducible geometry, reference search, independently checked datasets, FOLD export and measured learning behavior. We have a promising model-plus-search system, not yet a general origami model or a successful standalone precision generator. The user's visual verdict remains part of success; beating conventional baselines is informative rather than the sole success gate.

## What the current model actually learns

Training uses 4,359 answer examples from 1,453 training requests in learning-v2b. Each request supplies sheet length/width and box length/width/height, with one answer per recorded fold budget. Only reference-found training answers enter imitation training; the model is not trained to establish infeasibility.

The neural input is exactly three values: smaller box length/height divided by sheet length; larger box length/height divided by sheet length; fold budget divided by 11. Sorting reflects permission to turn the final cross-section. Relative dimensions let the same pattern scale to different sheet lengths. Width does not enter the network: this folding family cannot contract it, so width fit is checked separately.

The supervised targets are actual fold count, encoded panel proportions and fold angles. The current Adam recipe penalizes errors in those targets. Decoding enforces total sheet length, minimum panel length, angle bounds and the requested fold cap. Placement and offset are found by separate software, not predicted by the network.

Stored quality fields, wall contact, opening, symmetry and motion checks influenced the reference answer selection but are not direct terms in this recipe's training loss. Consequently, being numerically close to a reference does not guarantee fit or quality. On an unseen request, no reference answer is supplied to the model: it predicts a proposal, software places/checks it, and bounded correction may adjust its geometry.

## Evidence motivating this iteration

See the immutable [validation report](../experiments/validation-v1/REPORT.md). Network figures are means over three seeds; primary evaluation covers 768 reference-found answers from 256 validation requests.

| Method | Sampled validity | Valid + wall/opening quality | Mean pipeline ms/answer |
| --- | ---: | ---: | ---: |
| Adam alone | 39.11% | 21.74% | 4.83 |
| Adam + correction | 91.45% | 37.20% | 8.59 |
| Adam/L-BFGS + correction | 89.84% | 38.24% | 9.85 |
| Nearest training answer + correction | 87.76% | 46.35% | 8.50 |
| Conventional multistart | 100% | 14.84% | 36.60 |

Quality here means valid, zero floating creases and opening at least 90% of the reference opening. It is not a complete aesthetic or ranking assessment. Reference opening is unavailable for a new request and must not become a selection oracle. Timings are resident batch-amortized pipeline measurements, not cold interactive latency.

Fresh reference search achieved 72/72 valid and quality-qualified answers on a smaller, fixed 24-request subset, averaging 2.60 seconds per request for three budgets together. This is not a full-set timing comparison or proof of optimality. Existing evidence supports investigating learned starting points but does not establish that learning is necessary or always superior to retrieval/search.

D42 retires L-BFGS from current training-recipe development; historical code, checkpoints and results remain. Adam plus correction is the leading neural candidate. Correction performs real geometric changes, sometimes substantial ones; its success rate must not be attributed to neural precision alone.

## Proposed division of responsibility

The user proposed pairing an ML surrogate with a deterministic physics solver: learning gets close and the solver makes the pattern satisfy the requirements. The agent recommends investigating this as **learning-assisted optimization**. More precisely, our model supplies a starting design; it does not currently replace an expensive forward physics simulation, another common meaning of “surrogate.”

1. ML proposes promising fold positions and angles quickly.
2. Numerical search repairs constraints and improves quality.
3. A verifier checks the finished design independently against the declared requirements.
4. If verification fails, try another proposal, spend a bounded extra search allowance, or return no verified answer.

The user's concern about “100% accuracy” is recorded as a need for dependable accepted designs. Distinguish **all returned successes passing verification** from **finding a solution for every request**. A failed search does not prove a request impossible. Deterministic computation means repeatability, not guaranteed convergence, perfect physics or a mathematical certificate.

Present checks are zero-thickness and sampled at 721 motion positions. They cannot prove continuous collision-free motion, physical manufacturability or layer ordering. FOLD export certifies nothing. Stronger assurance requires stronger verification; no physics-perfect claim or scope expansion was agreed.

The proposed training question becomes: “Does this proposal help the solver reach a verified, useful answer quickly?” This is a research objective, not an implemented loss. Copying the reference more closely is not necessarily the same as making correction easier.

## Recommended next steps (not yet executed)

1. **Specify acceptance.** Retain panel/angle rules, fold budget, 2% box margin and sampled contact checks. Report wall/opening quality separately. Define explicit operational quality requirements and failure handling before final testing; thresholds beyond current rules remain open.
2. **Diagnose existing correction.** Analyze saved training/validation designs before and after repair. Categorize remaining failures and quality shortfalls: inadequate search allowance, stopping at validity, difficult starting geometry, wall/opening trade-offs, or other causes. Use paired visual examples. These are hypotheses to test, not established causes. This is the recommended immediate task; no retraining is needed to begin.
3. **Improve and compare correction.** Choose changes based on diagnosis. Compare neural, nearest-training-answer and simple starts under the same solver and declared work limits. Measure verified success, wall/opening quality, edit sizes, score calls and elapsed-time distributions as allowances increase. Include verification and proposal cost; do not equate equal score counts with equal runtime. Freeze protocol before new runs and preserve failures.
4. **Investigate training for useful starts.** With correction fixed, test learning from successful repairs against current imitation. Prevent training on validation/test repairs, preserve repeated seeds and baselines, and measure downstream solver work and final quality. Exact training objective and data construction remain to be designed.
5. **Freeze and evaluate the full procedure.** Select model policy, search allowance, quality requirements and fallback using development data; avoid best-seed cherry-picking. Evaluate once on untouched final-test cases, then provide visual review. Do not repeatedly tune against that test.
6. **Consider richer geometry afterward.** Free mountain/valley assignment remains the recorded first candidate expansion. Do not assume more freedom solves current precision problems. Investigate stronger motion verification before making stronger validity claims. Neither expansion nor a new architecture is authorized by this discussion alone.

## Open decisions

- Operational quality threshold and time/search allowance; when to return failure or invoke a slower fallback.
- Exact correction changes, after failure analysis.
- Whether and how to train specifically for repairability, including labels and objective.
- Stronger verification method and its cost, before any continuous-motion guarantee.

This session authorizes recording the discussion. It does not launch these experiments, select a final deployment recipe or consume the final test set.
