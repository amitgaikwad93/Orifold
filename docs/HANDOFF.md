# Orifold handoff

Snapshot: 2026-11-06. Same-network optimizer/precision experiment completed: best sampled validity improves from 10/32 to 29/32. Constant-feature preprocessing instability and one assessment-bridge tolerance mismatch are documented. No jobs remain active.

## Current state

- Repository https://github.com/amitgaikwad93/Orifold, branch `ccr-d2215757-ddp9pm`; no merge. Earlier draft PR #1 covers prior phases.
- Rules: EXPERIMENT_SPEC.md and DECISIONS.md D26–D37. Zero thickness, alternating folds, placement/offset allowed, 2% margin, wall ranking before spread. No geometric rule changes.
- Authoritative v2b dataset: 6,004 independently checked answers with corrected offsets; review round 2 accepted 48/48. Historical datasets and full-data runs 1–4 unchanged.
- `memorization-v1`: original shared-network 32-request diagnostic passed 12/32 parameter-loss and 10/32 position-loss designs; padded-vertex loss bug corrected before those runs.
- `independent-outputs-v1`: both losses optimized independent answer values to 32/32 precision and sampled-validity passes after float64 L-BFGS refinement, retained after casting output logits to float32.
- New [network-optimization-v1 report](../experiments/network-optimization-v1/REPORT.md): unchanged shared network, same examples, optimizer × precision control. Best observed validity **29/32**, no all-32 copying/validity success. No validation/test data used. The v2b test split remains unevaluated.

## Last session

- Pulled branch (already at `2a21f40`); froze code/protocol in `520ba26` before running.
- Eight runs: two losses × Adam/L-BFGS × float32/float64, starting at each loss's saved 4,000-epoch network. Same 75,554 parameters; fresh optimizer state, maximum nominal 4,000 further objective evaluations. All final iterates saved; no selection/retry by validity.
- Parameters: Adam32/64 passes **19/24**, L-BFGS32/64 **26/26** (baseline 12). Positions: independent Adam32/64 **19/19**, L-BFGS32/64 **27/29** (baseline 10). Strongest mean shape error reduced **41.5×**. All outputs pass count/rule/contact checks; failures are fit.
- Copying gates: parameter arms 30,31,30,30; position arms 23,22,29,29. No all-example success. L-BFGS float32 returns early; float64 uses 4,001 evaluations to finish line search. None meets requested gradient tolerance; do not call numerical optimum established.
- Four float64-model cast controls initially lose fit: strongest goes 29→19. Post-hoc inference-only diagnosis: constant budget coordinate uses std≈1e−6, amplifying encoding difference into normalized input 0 (float32) versus −0.0054186 (float64). Supplying matched normalized inputs recovers all native pass counts with float32 weights/arithmetic, including **29/32**. No training or rule change in this control.
- One independent/bridge disagreement among 384 primary/cast predictions: position Adam32, `v2-short-0297-b2`, overflow 6.73e−10 L. Bridge rejects positive overflow before assessment; direct underlying assessment agrees with independent tolerance. Bridge reports 18, independent 19. Zero further disagreements in 128 matched-input controls. Evidence preserved; source of `src/packing.js` not read.
- Validation: **19 Python tests** pass, including optimizer isolation/checkpoint preservation and matched-input forward parity; existing geometry/gradient parity checks included. No solver/geometry implementation changed, so Node tests not rerun. Plot inspected; historical input/dataset hashes and report links checked.

## In discussion / open

Additional training and better optimization help this architecture substantially; old failures did not establish a capacity limit. Precision comparisons are complicated by the discovered preprocessing instability. Passing copying thresholds does not imply strict fit. One seed/32 examples cannot establish generalization or the unique cause of remaining errors.

Family-specific output construction, larger models, changed ranking/fit rules and held-out evaluation were not performed. See DECISIONS.md Open questions. No original prediction counts were silently replaced with post-hoc control outcomes.

## Next concrete task

Recommended, not run: fix constant-feature preprocessing and align the bridge's numerical fit prefilter with the underlying evaluator, with regression tests; repeat affected controls as a new recorded version before choosing/scaling a training recipe. Keep the generic architecture and geometric rules unchanged. This correction has not yet been adopted.

## Runtime

No active jobs. CPU `.venv`: Python 3.12.14, PyTorch 2.9.1+cpu, NumPy 2.3.5, Matplotlib 3.10.8. No paid compute. All prior evidence preserved.

## Commands

```sh
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
npm test
node scripts/independent-check.js --self-test
```

Reproduction needs a new directory with the frozen config; outputs refuse overwriting:

```sh
.venv/bin/python -m learning.network_optimization <new-experiment-directory>
MPLCONFIGDIR=/tmp/orifold-mpl .venv/bin/python scripts/report-network-optimization.py <new-experiment-directory>
.venv/bin/python -m learning.network_precision_audit <new-experiment-directory>
```

The precision audit is separately labeled post-hoc and uses `NormalizedInputNetwork`: its saved weights require pre-standardized inputs for that diagnostic, unlike ordinary `v2.Model`. Do not present this as an unchanged fully-float32 deployment pipeline. These are zero-thickness sampled checks, not proof of continuous collision freedom, ranking optimality, generalization or physical performance.
