# Orifold handoff

Snapshot: 2026-11-06. Steps 1 and 2 complete: corrected normalization and assessment bridge, repeated the frozen 32-example comparisons. Current best sampled validity is 27/32, stable through float32 conversion. No active jobs.

## Current state

- Repository https://github.com/amitgaikwad93/Orifold, branch `ccr-d2215757-ddp9pm`; no merge. Earlier draft PR #1 covers earlier phases.
- Rules: EXPERIMENT_SPEC.md and DECISIONS.md D26–D38. Zero thickness, alternating folds, final turning/offset allowed, 2% box margin and wall-contact ranking. Geometry rules unchanged.
- Authoritative dataset: `experiments/learning-v2b/dataset.jsonl.gz`, 6,004 independently checked answers with corrected offsets. Historical datasets/results unchanged. No validation/test examples used in these diagnostics; v2b test remains unevaluated.
- `learning/v2.py`: stored normalization std <=1e-6 now uses effective scale 1. Other scales preserved. This removes constant-feature rounding amplification and also conservatively handles genuinely tiny scales. Old checkpoints load without new keys, but inference behavior changes for floor-scaled features; reproduce historical runs at their recorded source commits.
- `scripts/assess-designs.js`: after placement, fit acceptance always comes from the existing underlying assessment. Its numerical tolerance is unchanged. The contradictory positive-overflow prefilter is removed. Solver source was neither read nor modified.
- Latest [confirmation report](../experiments/network-optimization-v2/REPORT.md): corrected best sampled validity **27/32**, not the old preprocessing version's 29/32. Both float64 L-BFGS networks retain all 27 passes after conversion to float32.

## Last session

- User authorized steps 1 and 2. Pulled latest (already current), committed fixes, regression tests and protocol before execution in `5f3ba27`.
- Repeated the same eight optimizer/precision arms and four casts on the same 32 training requests with original checkpoint hashes, budgets and final-iterate reporting. No new data, architecture changes, fit penalties or geometric repair.
- Parameter loss: Adam32/64 **19/22**, L-BFGS32/64 **26/27** sampled-valid. Float64 casts: **23/27** respectively.
- Position loss: Adam32/64 **19/18**, L-BFGS32/64 **27/27** sampled-valid. Float64 casts: **18/27** respectively.
- All **384/384** independent/bridge decisions agree. Every design passes rule, two-fold count and 721-state contact checks; all failures are box fit. Every valid answer also has zero floating creases and opening within the reference band.
- Copying targets still not met on all examples: parameter arms 30/32, position Adam 23/32 and position L-BFGS 29/32. No L-BFGS run reaches the requested gradient tolerance; do not claim a proven optimum.
- Maximum float64-to-float32 cast vertex RMS difference is below 4e-7 sheet lengths in each arm. A single tight Adam fit flips to passing; L-BFGS validity is stable. Numerical sensitivity at walls is not eliminated.
- Validation: **21 Python tests pass**, `npm test` passes all seven files. New regressions check constant-feature precision, ordinary-scale preservation, the exact prior bridge mismatch, and genuine oversize rejection. A historical normalization parity test initially failed and was updated to assert the new behavior; no training code changed during execution.
- Dataset, manifest and initial checkpoint hashes unchanged. All histories, checkpoints, predictions, convergence diagnostics, report and plot retained in the new experiment directory. Nothing overwrote historical evidence.

## In discussion / open

We have a more trustworthy comparison. L-BFGS helps on this subset; higher precision has no clear validity advantage here. The same network can learn substantially more than the first experiment suggested, but no method meets all-example goals and generalization is unknown.

No full-data training, held-out evaluation, family-specific representation or larger architecture was performed under this authorization. DECISIONS.md Open questions records the next discussion.

## Next concrete task

Choose and predeclare a bounded full-training/validation comparison with the corrected pipeline, conventional baselines and network-plus-limited-correction reporting. Keep final test untouched until method selection is frozen. The next experiment has not started.

## Runtime

No active jobs. CPU-only `.venv`: Python 3.12.14, PyTorch 2.9.1+cpu, NumPy 2.3.5, Matplotlib 3.10.8. No paid compute provisioned.

## Commands

```sh
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
npm test
node scripts/independent-check.js --self-test
```

Reproducing confirmation requires a new directory with the frozen config, since results refuse overwrite:

```sh
.venv/bin/python -m learning.network_optimization <new-experiment-directory>
MPLCONFIGDIR=/tmp/orifold-mpl .venv/bin/python scripts/report-network-optimization.py <new-experiment-directory>
```

The previous `network_precision_audit` script describes the old normalization experiment; do not rerun its old-normalization assumptions against the corrected Model and treat that as historical reproduction. These are sampled zero-thickness checks, not proof of continuous collision freedom, ranking optimality or physical performance.
