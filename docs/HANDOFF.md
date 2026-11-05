# Orifold handoff

Snapshot: 2026-11-05 (late). The v2 answer key (reference solver) and v2 dataset are built and verified by independent checks. The user's visual review of the answer key is pending. No v2 model trained yet. Procedure: AGENTS.md, "Handoff procedure".

## Current state

- Repository https://github.com/amitgaikwad93/Orifold, working branch `ccr-d2215757-ddp9pm`. Draft PR #1 (`codex/phase-1-accordion`) holds the earlier phases only. Nothing merged; no PR for this branch.
- **Rules:** EXPERIMENT_SPEC.md sections 2–5; decisions D11–D33.
  - Fold budget is an input.
  - Most spread (smallest opening angle) within a 10% band, then symmetric, fewer folds, order, etc.
  - 2% margin; the final shape may turn about the hinge axis.
  - Alternating fold directions; no fold-angle rule.
- **Reference solver:** `src/packing.js` (deterministic). Map r6 and checks are in `results/*-r6*`; map report https://claude.ai/artifact/DG4P4RTYrbJixzZAbPjwWj
- **Independent checker:** `scripts/independent-check.js` (written by Codex, imports no project code). It passes r6 (2,330/2,330) and the dataset (5,996/6,004; 8 order-score cases from a spec ambiguity, now defined in section 5).
- **FOLD export:** `scripts/export-fold.js` (written by Codex, tested). The user confirmed (2026-11-05) that the example files in `examples/fold/` import into Origami Simulator.
- **Dataset:** `experiments/learning-v2/`; see EXPERIMENT_SPEC.md "v2 dataset" for size, splits, acceptance results and the known split imbalance.
- **Review page:** https://claude.ai/artifact/4Qr8nQDonaJSsWnYCG5FdA (db collection `verdicts`, owner-only writes), round `answer-key-1`, 48 training answers, currently empty. Read it back with ArtifactData `list` on `verdicts`.
- v1 remains a failed baseline (LEARNING.md, D10).

## In discussion / open

Runs overview page (validation only): https://claude.ai/artifact/XSiQ7WdyeAYu6wD7t21BSE (built from `experiments/learning-v2b/run-*/`).

v2b model runs 1–3 are done on validation (EXPERIMENT_SPEC.md, "v2b model runs"). The user's framing, adopted: aim for precision (low scatter) as well as validity, and track bias, scatter and the tolerance curve per run (`scripts/precision-report.py`, `scripts/tolerance-curve.js`). Run 4 (4a crease-position imitation, 4b 512×3) is done. Both are worse (38–40%) because the run-3 one-sided penalty let folds over-open and collide (agent design error; see EXPERIMENT_SPEC.md). Proposed run 5, awaiting the user: pure imitation in a 2×2 design (parameters/positions × 256×2/512×3), judged on training-set precision first. The test split is untouched.

## Next concrete task

Act on the user's choice. Before any test run, add "model + correction" to `train-config.json` as a predeclared reported method.

## Runtime

No jobs running. The Python venv is not installed in this container. Exploratory copies are in ignored `artifacts/`.

## Commands

```sh
npm test                                                         # 53 tests
node scripts/generate-v2-dataset.js requests|label|merge <dir>   # dataset steps (refuse to overwrite)
node scripts/dataset-as-map.js <dataset.jsonl.gz> <out.json[.gz]> [split]
node scripts/independent-check.js <map-or-adapted.json[.gz]>
node scripts/check-reference-completeness.js <map.json> <out.json> 40 3
node scripts/check-reference-spread.js <map.json> <out.json> 60 3
node scripts/render-review-page.js <dataset.jsonl.gz> <out.html> 48 7 <round>
node scripts/export-fold.js --help
```
