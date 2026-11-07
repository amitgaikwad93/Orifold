# Orifold handoff

Snapshot: 2026-11-07. Accordion baseline merged to `main` (PR #2, tag `accordion-baseline-v1`); active branch `research/learning-assisted-optimization`. Validation benchmark done, no overall winner; final test untouched. Documentation pass completed; the next scientific task is the correction diagnosis. Plain-language summary: [STATUS.md](STATUS.md).

## Current state

- **Repository:** https://github.com/amitgaikwad93/Orifold. Work happens on `research/learning-assisted-optimization` (branched from main merge `6bcd36a`, D44). Old topic branches `ccr-d2215757-ddp9pm` and `codex/phase-1-accordion` are retired; their history is in `main`.
- **Rules:** EXPERIMENT_SPEC.md sections 2–6 with D26–D34. Zero-thickness, alternating folds, 2% gap, fold budget as input, spread band, symmetry, creases on walls, turned placement with recorded `placement` and `offset`. No geometry rule changes since D34.
- **Answer key and dataset:** `src/packing.js`; `experiments/learning-v2b/` (accepted; independent checker 6,004/6,004).
- **Latest evidence:** [validation-v1 report](../experiments/validation-v1/REPORT.md), frozen at `17b0822`: 768 reference-found validation answers, three seeds. Summary table in STATUS.md. Leading neural recipe: Adam + bounded correction (D42); L-BFGS retired from current recipe development.
- **Code paths:** `learning/v2.py` (model and losses), `learning/validation_benchmark.py`, `scripts/repair-designs.js` (correction, exact score cap), `scripts/independent-check.js` (Codex checker).
- **Final test split:** never evaluated.

## Last session (2026-11-07)

- **Docs pass:** STATUS.md, decision index, glossary, README and AGENTS. Decisions D45 (keep D20 separate and open) and D46 (aim for 100% quality, measure quality vs time).
- **Correction diagnosis v1:** plan predeclared in `f7fd9b7`; [report](../experiments/correction-diagnosis-v1/REPORT.md); `scripts/diagnose-correction.py`; saved validation-v1 records only. Measured:
  - correction only targets fit and skips designs that already fit;
  - it closes folds to fit (about 100 model answers; 118/145 retrieval low-opening answers);
  - model starts are often too closed;
  - floating creases are left after correction;
  - invalid results are stalls (median 1.0–1.5% L overshoot), not cap exhaustion;
  - two-fold answers reach 13–24% quality;
  - model and retrieval starts are complementary (union about 57%).
  - Visual page: https://claude.ai/artifact/1SJ2m8NZVwz9s9Skv2YfEp

## In discussion / open

See DECISIONS.md "Open questions". Most important (D20 is kept as a separate open question per D45; report model-alone results alongside model + search):
- the quality and speed policy and fallback before the final test;
- when to move to a richer fold family.

Roadmap: [LEARNING_ASSISTED_OPTIMIZATION.md](LEARNING_ASSISTED_OPTIMIZATION.md).

## Next concrete task

Roadmap step 3: design and predeclare a **quality-seeking correction** (hypotheses H1–H4 in the diagnosis report):
- pursue walls, then opening;
- run on starts that already fit;
- do not close folds;
- multi-coordinate moves or a wall-snapping step;
- multiple starts with an answer-key-free selector.

Compare on saved validation starts against current correction, measuring quality against time. Report model-alone results alongside (D45). No retraining or final-test use.

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
