# Orifold handoff

Snapshot: 2026-11-06. Baseline consolidated into main through PR #2, tagged accordion-baseline-v1; active branch research/learning-assisted-optimization. No new experiment. Step 4 validation benchmark finished. No overall winner: neural correction maximizes fast-method validity, nearest retrieval preserves more quality, multistart fits all known-solvable cases but opens poorly. Final test untouched. D42 retires L-BFGS from current neural recipe development.

## Current state

- Repository https://github.com/amitgaikwad93/Orifold, active branch `research/learning-assisted-optimization`, created from main merge `6bcd36a`. [PR #2](https://github.com/amitgaikwad93/Orifold/pull/2) merged with full source history; annotated tag `accordion-baseline-v1` marks that merge. GitHub also marked ancestor PR #1 merged. The two merged source branches were retired at the user’s request; all their commits remain in main and the baseline tag.
- Rules: EXPERIMENT_SPEC.md / DECISIONS.md D26–D41. Zero-thickness alternating folds, 2% gap, recorded placement/offset and wall-contact ranking. No geometric rule changes.
- Latest [validation report](../experiments/validation-v1/REPORT.md). Frozen code/protocol `17b0822` before inference, all six step-3 final networks plus conventional baselines. No retraining or best-seed selection.
- Primary set: 768 reference-found validation answers from 256 requests. Excluded statuses: 10 analytically infeasible, 58 solver-not-found; the latter is not proven infeasibility. Final test rows never retained/evaluated.
- Corrected normalization remains. Correction now enforces an exact score-call cap including initial score and delegates acceptance to the canonical evaluator. Tolerance metrics include width and use separate placement objectives for sheet vs usable-box denominators. Historical artifacts unchanged; reproduce older search policies at recorded source commits.

## Last session

- Completed the user-authorized consolidation (D44): PR #2 merged, annotated baseline tag pushed, new research branch created and pushed. PR #1 was automatically marked merged when its descendant branch merged; no separate merge or branch deletion was needed. Python 26/26 and Node 8/8 test files pass. Subsequently retired the two merged remote source branches after ancestor checks, and removed the old local working branch. No scientific experiment was rerun.

- Recorded the post-validation discussion, exact current training inputs/targets, proposed hybrid responsibilities, verification limits and six-step roadmap in [LEARNING_ASSISTED_OPTIMIZATION.md](LEARNING_ASSISTED_OPTIMIZATION.md). Documentation only; no experiments or test-set use. Earlier step 5 remains open. “Learning-assisted optimization iteration” avoids conflict with existing v2 experiment names.

### Previous measured experiment

- User authorized step 4. Pulled latest, fixed policy/accounting issues with regression tests, froze settings and then ran validation.
- Methods: Adam and Adam/L-BFGS raw/corrected for seeds 17/29/43; nearest training answer raw/corrected; simple budget-count correction; non-neural count-enumerating multistart sharing cap 400; cached target recheck and fresh solver on 24 frozen random requests. All final records retained.
- Mean raw validity: **Adam 39.11%, Adam/L-BFGS 33.16%**, versus training 43.13%/45.46%. Extra fitting did not transfer under this recipe; consistent with overfitting/poorer generalization, not a universal optimizer conclusion.
- Mean corrected validity / quality (valid+zero-floating+reference opening band): **Adam 91.45% / 37.20%**, **Adam/L-BFGS 89.84% / 38.24%**, **nearest 87.76% / 46.35%**. Nearest raw 51.30% / 31.25% exceeds either raw model.
- Simple budget-count correction 77.21% validity / 6.12% quality. Shared-budget multistart **100% / 14.84%**, illustrating flat-stack feasibility versus opening quality. This is 100% only on known-solvable primary cases, not every box.
- Mean resident batch-amortized pipeline times per answer: Adam+correction **8.59 ms**, Adam/L-BFGS+correction **9.85 ms**, nearest+correction **8.50 ms**, multistart **36.60 ms**. Includes inference/decoding or retrieval share, search, placement/checking; excludes loading, IPC and diagnostics. Batch wall times also retained. No production single-query latency claim.
- Fresh reference subset: 24 requests, **72/72 valid and quality-qualified**, mean **2,601.85 ms/request for all three budget answers together**. Same-subset Adam+correction mean 24.46 ms/request with mean 68.67/72 valid across seeds. Cached reference 768/768 quality is a target recheck, not solver timing. Live subset is not a full runtime distribution.
- All 13,056 primary records match manifest IDs, caps <=400 and requested budgets. Every accepted result has canonical 721-state fit/contact checks; correction preserves all raw neural successes. Source/data/checkpoint hashes unchanged; nearest provenance verified training-only. No solver source read or modified.
- Tests: **26 Python tests passed**; Node suite all **8 files** passed, including exact cap, canonical-boundary, width, relative-objective and multistart-sharing regressions. Plot inspected. All jobs finished.

## In discussion / open

D42: Adam plus bounded correction is the leading neural candidate; L-BFGS is retired from current recipe development. Historical code/checkpoints/results stay intact. No best seed or final deployment policy selected. L-BFGS training benefit did not generalize in raw validation validity. Neural correction gives a modest fast-method validity advantage over retrieval, while retrieval gives better opening/wall quality. Neither dominates the reference solver on reliability/quality or proves learning necessary.

Training hybrid audit used a legacy correction policy, so its 95.35% versus current corrected validation 89.84% is not a controlled generalization comparison by itself. The raw-network train/validation comparison is consistent-policy. Validation informed earlier development too; final-test evidence must come later.

## Next concrete task

Recommended next task: diagnose saved Adam-plus-correction failures and before/after wall/opening quality, with paired visual examples, before designing further correction or training experiments. See D43 and the new iteration roadmap. Earlier step 5 (freeze quality/speed policy before final test) remains open; final test is untouched and no next experiment has started.

## Runtime

No active jobs. CPU `.venv`: Python 3.12.14, PyTorch 2.9.1+cpu, NumPy 2.3.5, Matplotlib 3.10.8. No paid resources provisioned. Historical artifacts intact.

## Commands

```sh
npm test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
```

Reproduction requires a new directory containing frozen config/manifest; result paths refuse overwrite:

```sh
.venv/bin/python -m learning.validation_benchmark <new-experiment-directory>
MPLCONFIGDIR=/tmp/orifold-mpl .venv/bin/python scripts/report-validation.py <new-experiment-directory>
```

The old correction audit pins historical scripts by hash, so reproduce it at its source commit rather than bypassing hash checks. All validity is sampled and zero-thickness; no continuous collision proof, ranking optimality, layer-order or manufacturing certification.
