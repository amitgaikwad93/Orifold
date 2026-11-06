# Saved-prediction correction audit

Before running: apply the unchanged legacy 400-evaluation correction to every saved full-training prediction for all three seeds and both recipes. No retraining or new model inference. Retain raw correction flags and independently invoke the underlying evaluator at the saved corrected pose, including fold-budget checks. The method's existing loop can exceed 400 score calls slightly; report actual counts. This is an additional numerical search, not increased tolerance or neural-only capability.

Control: same predicted fold count per example, equal panels and 150-degree angles, same correction budget. Deduplicate identical controls but report per-model matched results. This controls continuous shape initialization while retaining model-provided count; it is not a fully model-free end-to-end baseline. Historical Claude budget-count control is audited separately from its saved validation records. Do not compare training and validation percentages as evidence that one model wins.

Report every seed/recipe, quality (valid + wall contact + 90% reference opening), correction effort/time and numerical-flag disagreements. Corrected fits use original 2% gap and 721 motion states. No method selection, rule change, final-test use, fresh validation predictions or altered search after seeing results. Original records remain untouched. Freeze source hashes before execution.

Run `.venv/bin/python -m learning.correction_audit experiments/correction-audit-v1`. Results refuse overwrite. This is sampled zero-thickness assessment, not continuous collision freedom or ranking optimality.
