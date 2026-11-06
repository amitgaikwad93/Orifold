# Step 4 validation benchmark — frozen before prediction

User authorized step 4 after the saved-training correction audit. Primary set: **768 reference-found validation answers from 256 requests**, using the original grouped split. The manifest saves exact IDs and excluded request-status counts. Width-impossible and solver-unresolved requests do not have solved-answer targets and are outside the primary benchmark; solver failure is not infeasibility. Final test rows are not retained or evaluated.

## Methods

- All six fixed final networks from full-training-v1: Adam and Adam+L-BFGS, seeds 17/29/43. Float32, CPU one thread, no retraining or checkpoint/seed selection. Report each seed and recipe mean/range.
- Each neural proposal evaluated alone and with the corrected search, maximum **400 objective score calls including initial score**. Both methods charge the measured same batch inference/decoding time. Count stays fixed during correction. Valid input designs skip correction by canonical evaluator acceptance; invalid fit/contact designs may be searched. Final assessment uses the original 2% margin and 721 motion states. Search contact screening uses 31 states and the legacy overflow heuristic, so it is not globally optimal.
- Nearest training answer with the same budget, canonical sorted box-ratio distance, deterministic first tie. Scale lengths to target L, copy angles, replace width, re-place. Resident training index preprocessing excluded, like model loading; retrieval/scaling time included. Evaluate alone and with identical correction. No validation labels used for retrieval.
- Simple budget-count initialization: equal panels, all 150-degree angles, corrected with cap 400. No learned count.
- Non-neural multistart: try every count 0..budget, equal panels at 150 and 180 degrees (single flat candidate for count zero). **One shared 400-score cap**, allocate remaining calls across remaining starts deterministically, carry unused allocation forward. Score-call count includes initial family scores, not all final assessment/placement operations. Among passing candidates prefer fewer floating creases, then larger opening, then fewer folds. This is a heuristic baseline, not a claim of full reference-ranking optimization. All candidates and checks are charged in pipeline time. Flat stacks can be valid but have zero opening, so quality is reported separately.
- Reference target: re-assess all 768 saved reference poses as a quality/feasibility context only. Its cached-assessment time is not solver time. Fresh `referenceSolveBudgets` calls on **24 fixed random validation requests** (seed 20261106, IDs frozen in manifest), generating all three requested budgets in each call. Report timed subset separately and compare other methods on exactly that subset, aggregating their three answer times per request. Live reference cost is not matched to the 400-score search budget. Do not extrapolate subset timing to all validation shapes or treat reference labels as proof of optimality.

## Reporting

Primary: original strict sampled validity, plus validity with zero floating creases and opening >=90% of reference. Report fold count, reference-copying precision (matching count, vertex RMS <=0.1% L, angle MAE <=0.1 degrees), edits caused by correction, failure reasons and timing. Alternate valid geometry need not match the chosen reference. Related budgets are not independent requests, and three seeds do not prove general superiority.

Timing: network/index resident, model batch inference and decode/retrieval time divided over answers; native Node per-answer pipeline time includes initialization/search, placement and final checking. Mean/median/p90 total = measured initialization share + measured native query time. Also retain batch process wall time including serialization, launch and IPC separately. Diagnostic metric computation and audit rechecks are excluded from pipeline latency. These are batch-amortized model timings, not interactive single-query latency. Fresh Node process per method; no cold-start claim or GPU.

Tolerance curves are **diagnostics only**: extra allowance beyond 98% usable box, separately minimized for sheet-relative and usable-box-relative metrics, all axes including width. Finite 0.05-degree sweep + local refinement gives upper bounds; failures are not infeasibility proofs. Motion contacts stay unrotated at 721 states. Rule and fold-budget constraints remain required. Zero-allowance curve uses its own 1e-12 threshold and placement search; it can differ from the canonical numerical-tolerance primary pass. It never replaces primary validity.

The corrected correction/tolerance code is a new version. Historical audit outputs remain unchanged and must be reproduced from their source commit. Exact score cap, width-infeasible fixture, own-objective placement and canonical-boundary behavior have regression coverage. Freeze settings before validation inference. No adaptive retry/tuning after results, no best seed, no dropping failed outputs. Save all predictions/assessments, nearest IDs, diagnostics, hashes, checkpoints referenced and environment. A failure within the fixed budget is not proof of infeasibility or capacity limit.

```sh
npm test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
.venv/bin/python -m learning.validation_benchmark experiments/validation-v1
```

Result directories refuse overwrite. Step 5 remains a decision after this development benchmark; final test must follow a frozen chosen method. Sampling/zero thickness do not certify continuous collision freedom, ranking optimality, layer order or physical performance.
