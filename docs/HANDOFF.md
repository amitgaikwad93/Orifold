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

Documentation only, no experiments:
- added `docs/STATUS.md` (plain-language status for the owner);
- trimmed this handoff;
- added a decision index to DECISIONS.md;
- extended GLOSSARY.md;
- updated README.md and AGENTS.md;
- recorded the open D20 question.

Checks: link check and tests (see commit).

Earlier work since the merge is summarized in DECISIONS.md D35–D44 and each experiment's `REPORT.md` (memorization-v1, independent-outputs-v1, network-optimization-v1/v2, full-training-v1, correction-audit-v1, validation-v1).

## In discussion / open

See DECISIONS.md "Open questions". Most important:
- **D20 status:** is "model alone" still the success question?
- the quality and speed policy and fallback before the final test;
- when to move to a richer fold family.

Roadmap: [LEARNING_ASSISTED_OPTIMIZATION.md](LEARNING_ASSISTED_OPTIMIZATION.md).

## Next concrete task

**Correction diagnosis** (roadmap step 2, D43): analyze saved Adam + correction and nearest + correction designs from validation-v1 before and after repair. Categorize failures and quality losses (walls, opening), with paired visual examples. Emphasize quality, since all fast methods reach at most 46% quality against the reference's 100%. Predeclare the analysis. No retraining and no final-test use.

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
