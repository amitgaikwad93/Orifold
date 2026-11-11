# Orifold handoff

Snapshot: 2026-11-11. Accordion baseline merged to `main` (PR #2, tag `accordion-baseline-v1`); active branch `research/learning-assisted-optimization`. Validation benchmark done, no overall winner; final test untouched. Documentation pass completed; the next scientific task is the correction diagnosis. Plain-language summary: [STATUS.md](STATUS.md).

## Current state

- **Repository:** https://github.com/amitgaikwad93/Orifold. Work happens on `research/learning-assisted-optimization` (branched from main merge `6bcd36a`, D44). Old topic branches `ccr-d2215757-ddp9pm` and `codex/phase-1-accordion` are retired; their history is in `main`.
- **Rules:** EXPERIMENT_SPEC.md sections 2–6 with D26–D34. Zero-thickness, alternating folds, 2% gap, fold budget as input, spread band, symmetry, creases on walls, turned placement with recorded `placement` and `offset`. No geometry rule changes since D34.
- **Answer key and dataset:** `src/packing.js`; `experiments/learning-v2b/` (accepted; independent checker 6,004/6,004).
- **Latest evidence:** [validation-v1 report](../experiments/validation-v1/REPORT.md), frozen at `17b0822`: 768 reference-found validation answers, three seeds. Summary table in STATUS.md. Leading neural recipe: Adam + bounded correction (D42); L-BFGS retired from current recipe development.
- **Code paths:** `learning/v2.py` (model and losses), `learning/validation_benchmark.py`, `scripts/repair-designs.js` (correction, exact score cap), `scripts/independent-check.js` (Codex checker).
- **Final test split:** never evaluated.

## Last session (2026-11-11)

- **D47:** quality-seeking correction experiment. Plan frozen at `84da33d`; [report](../experiments/quality-correction-v1/REPORT.md).
- **Code:** `scripts/quality-correction.js` (two-stage pattern search: fit and open wide, then walls; 0.4 long-step pass; pair moves), `scripts/run-quality-correction.js`, `scripts/report-quality-correction.js`, `tests/quality-correction.test.js`.
- **Measured** on 768 validation answers at 3,200 score calls (valid / quality):
  - model + nearest: 100 / 92% (about 207 ms);
  - nearest: 98 / 88%;
  - model: 100 / 84%;
  - simple start: 98 / 39%;
  - old correction: 91 / 37% (model), 88 / 46% (nearest);
  - model alone unchanged: 39 / 22%.
- **Start bias check:** model starts are about 3° too closed on average (about 230 too closed vs 55 too open of 768); nearest starts have no lean.
- **Pages:** chart https://claude.ai/artifact/GgDYBis95voobDyo6CMDHq; diagnosis https://claude.ai/artifact/1SJ2m8NZVwz9s9Skv2YfEp
- **Checks:** `npm test` 62/62.

Earlier on this branch: correction-diagnosis-v1 (2026-11-07), docs pass, D45, D46; experiments D35–D44 with reports in `experiments/*/REPORT.md`.

## In discussion / open

The user should choose the next step (agent recommendation first):
1. **Push the pipeline toward 100% quality:** allocate steps by fold count (four-fold answers are at 37% in the combined method), let correction change the fold count by ±1, extend caps to find the plateau.
2. **Train for repairability** (roadmap step 4): judge the model start against the nearest start at equal time.
3. **Move to a richer fold family.**

Also open: freezing a pipeline and using the final test (roadmap step 5).

## Next concrete task

Await the user's choice above. If option 1: predeclare quality-correction-v2 with step allocation by fold count and fold-count changes, on the same saved starts.

## Runtime

No active jobs. CPU `.venv` with PyTorch 2.9.1+cpu and NumPy 2.3.5; the Python version varies by container (3.12 or 3.13). The cloud environment "Clean" has a setup script that installs these; the earlier session also used Matplotlib 3.10.8 for report figures. No paid resources.

## Commands

```sh
npm test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
.venv/bin/python -m learning.validation_benchmark <new-experiment-directory>     # refuses to overwrite
node scripts/independent-check.js <map-or-adapted.json[.gz]>
```

Older experiments pin historical scripts by hash; reproduce them at their recorded source commits. All validity is zero-thickness and sampled (LIMITATIONS.md).
