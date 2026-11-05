# Orifold handoff

Snapshot: 2026-11-05. The 32-request training-only precision diagnostic is complete; neither pure-imitation arm copied all examples accurately enough. All jobs are finished.

## Current state

- Repository: https://github.com/amitgaikwad93/Orifold, working branch `ccr-d2215757-ddp9pm`. This work stays on that branch; no merge. Earlier draft PR #1 covers prior phases.
- Rules: EXPERIMENT_SPEC.md and DECISIONS.md D26–D35. Zero-thickness, 0–11 alternating folds, final rotation/offset allowed, 2% box margin, wall-contact ranking before spread.
- Authoritative training dataset: `experiments/learning-v2b/dataset.jsonl.gz`, 6,004 independently checked answers with corrected full-precision offsets. Earlier v2 and label shards are historical. Review round 2 accepted 48/48.
- Full-data runs 1–4 are preserved in `experiments/learning-v2b/run-*`. Run 2 improved fit by folding much tighter; run 4's one-sided penalty allowed over-opening/collisions. Run 4a additionally used a position loss that counted padded endpoints repeatedly. Its recorded results have not been rewritten.
- New evidence: [memorization-v1 report](../experiments/memorization-v1/REPORT.md), with frozen setup/manifest, checkpoints, histories, all predictions and a plot. No held-out examples used in this diagnostic. The v2b test split remains unevaluated.
- Independent checker and FOLD export remain available; FOLD import into Origami Simulator was confirmed by the user previously. No certification is implied.

## Last session

- Pulled through `f2d4330`, then froze the diagnostic/code in `33da2b3` before training.
- Corrected real-vertex masking in `learning/v2.py`, made differentiable kinematics preserve dtype/device, and made extent calculations share that implementation. Did not read `src/packing.js`, change solver source, modify datasets or overwrite historical results.
- Trained identical 75,554-parameter models from the same initialization on 32 unique training requests, exact family `symmetric-ends-one-angle+spread-refined`, budget/count 2. Fixed 4,000 epochs; no fit/tighter penalties or early checkpoint selection.
- Parameters / positions: sampled validity **12/32 / 10/32**; correct folds **32/32 each**; no sampled collisions; all failures are box fit. Mean per-example vertex RMS **0.530% / 0.353% L**; angle MAE **0.891° / 1.311°**. Copying gate met by **1/32 / 5/32**, so both fail the all-32 gate.
- Float32 reference round trips pass 29/32 at saved placement, 32/32 after placement search. All 160 independent/reference overall comparisons agree.
- Discovered returned overflow on failed placement search can use a 0° fallback pose. Separate post-hoc 0.01° sweep gives mean best-found overflow 0.228% / 0.223% L; it does not alter primary pass counts or prove infeasibility.
- Validation: 12 Python unit tests passed; `npm test` passed all 7 test files. Plot inspected. Source/gradient/round-trip tests are in `tests/test_v2_learning.py`; diagnostic placement/contact tests in `tests/test_memorization.py`.

## In discussion / open

See DECISIONS.md Open questions. The user authorized this small diagnostic (D35), not a generalization winner or a larger model. The earlier full-data run-5 2×2 proposal remains unrun. Pure position loss does not control angle precision equally across short/long panels. No decision to weaken fit, add material thickness, or change ranking.

## Next concrete task

Recommended, not run: optimize independent output parameters per request to isolate loss/representation optimization from learning a shared request-to-design mapping. Then compare a two-parameter symmetric-family head with the generic head on the same 32 examples, under a newly frozen budget. Investigate this before scaling; neither 4,000 epochs nor one seed establishes a capacity limit.

## Runtime

No active jobs. CPU-only `.venv`: Python 3.12.14, PyTorch 2.9.1+cpu, NumPy 2.3.5, Matplotlib 3.10.8. No paid compute provisioned. Original datasets and prior results unchanged.

## Commands

```sh
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
npm test
node scripts/independent-check.js --self-test
node scripts/dataset-as-map.js <dataset.jsonl.gz> <new-map.json.gz>
node scripts/independent-check.js <new-map.json.gz>
```

Diagnostic reproduction requires a **new experiment directory** with the frozen config/manifest; the runner refuses existing results:

```sh
.venv/bin/python -m learning.memorization <new-experiment-directory>
MPLCONFIGDIR=/tmp/orifold-mpl .venv/bin/python scripts/report-memorization.py <new-experiment-directory>
```

Do not rerun into `experiments/memorization-v1/results/` or overwrite historical evidence. These checks establish sampled zero-thickness validity only, not continuous collision freedom, ranking optimality, or physical performance.
