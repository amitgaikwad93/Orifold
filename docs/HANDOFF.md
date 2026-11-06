# Orifold handoff

Snapshot: 2026-11-06. Step 3 full-training comparison completed across three paired seeds. Adam + L-BFGS improves training validity modestly (43.13%→45.46%); the recipe remains unreliable. All jobs finished.

## Current state

- Repository https://github.com/amitgaikwad93/Orifold, branch `ccr-d2215757-ddp9pm`; no merge. Earlier draft PR #1 covers earlier phases.
- Rules in EXPERIMENT_SPEC.md / DECISIONS.md D26–D39: zero thickness, alternating folds, 2% box margin, recorded placement/offset, wall-contact ranking. No geometric rule changes.
- Corrected normalization and assessment bridge from steps 1–2 remain in use. Historical v1/preprocessing experiments must be reproduced with their recorded source commits. Their reports/datasets remain unchanged.
- Authoritative dataset `experiments/learning-v2b/dataset.jsonl.gz`: 6,004 answers, preserved. Full training uses 4,359 found-answer examples from 1,453 requests. Related budgets remain related examples, not independent requests. Width-impossible/unresolved requests are outside this solved-answer fitting assessment.
- Latest [full-training report](../experiments/full-training-v1/REPORT.md). All checkpoints, initial weights, histories, per-answer gzip records, hashes, resource metrics and plot are saved. No validation/test prediction or method/seed selection in step 3; final v2b test still unevaluated.

## Last session

- User authorized step 3. Pulled branch (already current); froze protocol/code/manifest in `3f212ef` before training.
- Seeds 17,29,43; same generic 75,554-parameter MLP in float32 and parameter-imitation/count loss. Per seed, shared 1,500-epoch minibatch Adam prefix (52,500 updates), then two fresh optimizer branches: 2,000 full-batch Adam or L-BFGS evaluations. Final checkpoints retained without selection/retry.
- Adam valid counts: **1,884 / 1,895 / 1,861** out of 4,359 (mean **43.13%**). Adam + L-BFGS: **1,959 / 2,010 / 1,976** (mean **45.46%**). Paired gains +1.72/+2.64/+2.64 percentage points; three seeds do not establish a general optimizer ranking.
- Valid + zero floating + reference opening band means **28.15% / 31.67%**. All final predictions pass rules and 721-state contact checks; failures are fit. L-BFGS gets every reference fold count correct, but strict copying mostly passes only on zero-fold examples: 2/0/2 folded cases pass under L-BFGS. Geometry remains the bottleneck.
- Mean optimization time including shared prefix **207.1 / 221.6 seconds**, and mean peak process RSS **324.1 / 367.6 MiB** for Adam / Adam+L-BFGS. RSS includes interpreter/data/model/optimizer, excludes Node assessor. Separate fresh workers prevent cross-arm high-water contamination. Assessment time is separate; no end-to-end inference-speed claim.
- Every branch used 2,000 objective evaluations. No L-BFGS run meets 1e-12 gradient tolerance; fixed-budget results are not established optima. Full dataset is much harder than the restricted 32-example task.
- Validation: **23 Python tests passed**, including split exclusion and seeded repeatability, plus existing geometry/gradient checks. No geometry/solver code changed, so Node tests not rerun. All **39,231** prefix/final predictions match manifest order; paired start-checkpoint hashes and source dataset hash verified. Plot inspected. `src/packing.js` source not read.

## In discussion / open

Optimizer refinement gives a small consistent training gain at about 7% extra optimization time and 13% extra process memory for this model. Absolute training validity remains poor. Generalization, useful speed versus solver, and model-plus-correction benefit remain unmeasured in this comparison. No best seed or final recipe selected.

Scope remains the existing generic model/geometry. Larger architecture, family-specific output construction, held-out evaluation and changed rules were not performed. See DECISIONS.md Open questions.

## Next concrete task

Predeclare step 4: validation benchmark of both recipes against conventional baselines and bounded model-plus-correction, reporting validity, quality and time. Use validation to make method decisions; keep final test untouched until the method is frozen. No such run has started.

## Runtime

No active jobs. CPU-only `.venv`: Python 3.12.14, PyTorch 2.9.1+cpu, NumPy 2.3.5, Matplotlib 3.10.8. No paid resources provisioned. All historical evidence intact.

## Commands

```sh
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
npm test
```

To reproduce step 3, use a new directory with frozen config/manifest; existing output paths refuse overwrite:

```sh
.venv/bin/python -m learning.full_training <new-experiment-directory>
MPLCONFIGDIR=/tmp/orifold-mpl .venv/bin/python scripts/report-full-training.py <new-experiment-directory>
```

This is training-set sampled zero-thickness validity, not continuous collision freedom, ranking optimality, generalization or physical performance.
