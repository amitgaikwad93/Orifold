# Orifold handoff

Snapshot: 2026-11-06. Historical tolerance/correction audit complete; applying the same correction to saved new training designs produces ~95.35% hybrid validity for Adam+L-BFGS, but only 53.21% also meet wall/opening criteria. All jobs finished.

## Current state

- Repository https://github.com/amitgaikwad93/Orifold, branch `ccr-d2215757-ddp9pm`; no merge. Earlier draft PR #1 covers earlier phases.
- Rules: EXPERIMENT_SPEC.md / DECISIONS.md D26–D40. Zero thickness, alternating folds, 2% margin, recorded placement/offset and wall-contact ranking. No rule changes in the audit.
- Corrected learning normalization and standard assessment bridge remain in use. Historical scripts/results preserved. Solver source was neither read nor modified.
- Full-training step 3: 4,359 training answers from 1,453 requests; three seeds. Adam mean validity 43.13%, Adam+L-BFGS 45.46%. See [full-training report](../experiments/full-training-v1/REPORT.md). No unfamiliar-box predictions were made for these models.
- Latest [correction/tolerance audit](../experiments/correction-audit-v1/REPORT.md), frozen code/protocol `60d1b9e`. Historical run-1 correction and new saved training designs assessed without retraining, changing search or relaxing tolerances. Final test untouched.

## Last session

- User asked to inspect Claude’s tolerance and run-1 correction and check applicability to new results. Pulled branch, reviewed scripts and historical artifacts; never read `src/packing.js`.
- Revised run-1 sheet-relative tolerance counts reproduce with independent side-view calculations. Remaining box-relative issues: width omitted (confirmed on an existing width-impossible fixture), and orientation optimized for sheet-relative rather than relative-box overshoot. 5% L gives 87.4%, legacy 5% box-relative gives 57.7%, own relative-box objective gives 62.9%. All relative-box denominators are usable dimensions (98% of physical box). These are diagnostics, not strict pass rates or angle/panel precision.
- All 720/768 Claude run-1 model-correction successes confirm at their saved poses. Historical budget-count control canonical result 593/768 versus saved 591. Only 311/768 run-1 model corrections are valid+walls+opening band.
- Applied unchanged `scripts/repair-designs.js 400` to all six saved full-training model outputs: canonical mean validity **92.85% Adam / 95.35% Adam+L-BFGS**. Valid+walls+opening **47.61% / 53.21%**. Correction about 5 ms/answer here, mean score calls 25/18, excludes neural inference and separate audit recheck.
- Matched-count control uses each model’s predicted count with equal panels and 150-degree angles: ~80.5% validity / 21.7% quality. Deduplicated to 4,365 unique controls. Supports useful continuous geometry initialization on training data; not a fully model-free or held-out comparison.
- Correction can make substantial edits: L-BFGS p90 max panel edit ~5.4% L, p90 max angle edit 7.16° across all attempts. Do not call corrected success neural precision. Final 721-state assessment retains the original contact policy; search itself screens only 31 states.
- Legacy search budget is not strict: observed up to 441 score calls on new models. Its final positive-overflow prefilter rejects 31 new-model cases accepted by canonical assessment; all raw flags and rechecks retained. Existing correction/tolerance scripts remain unchanged for this historical-method audit.
- Validation: 25 Python tests passed, including audit scoring and existing geometry checks. No geometry implementation changed, so Node tests not rerun. Saved inputs/source hashes verified; report plot inspected; raw results and timing preserved. Historical validation work was a recheck of existing saved correction records, not new inference or seed selection.

## In discussion / open

Hybrid validity is promising but training-only, and wall/opening quality is substantially lower. The 95.35% new training result cannot be compared directly with Claude’s 93.75% historical validation result to claim improvement in generalization. A competitive model-free solver baseline is still needed.

Tolerance allowances should be stated with denominator and kept separate from strict task satisfaction. Neither correction nor tolerance curves establish ranking optimality or precision of the original neural answer.

## Next concrete task

Recommended: correct tolerance width/orientation metrics and correction budget accounting, align legacy correction final acceptance with the evaluator, and freeze step 4 validation comparison of neural-only, neural-plus-correction and competitive non-neural baselines. Retain final test for the frozen method. No such new validation run has started.

## Runtime

No active jobs. CPU `.venv`: Python 3.12.14, PyTorch 2.9.1+cpu, NumPy 2.3.5, Matplotlib 3.10.8. No paid resources. All original artifacts preserved.

## Commands

```sh
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
npm test
```

Reproduction requires new directories/config copies; result directories refuse overwrite:

```sh
.venv/bin/python -m learning.correction_audit <new-audit-directory>
.venv/bin/python scripts/audit-tolerance-metrics.py <new-audit-directory>
MPLCONFIGDIR=/tmp/orifold-mpl .venv/bin/python scripts/report-correction-audit.py <new-audit-directory>
```

The tolerance audit expects the saved width-fixture input alongside config; source/input hashes pin the historical algorithm. These are sampled zero-thickness checks, not continuous collision proof, ranking optimality or physical certification.
