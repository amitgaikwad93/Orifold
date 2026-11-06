# Shared-network optimizer × precision diagnostic v1

Authorized 2026-11-06: test optimization and precision on the unchanged generic shared network and the same 32 training examples, then explain the findings in plain language. Freeze this protocol and config before running. No architecture, family-specific representation, geometric rule or dataset change is included.

## Question and design

The independent-output experiment established attainability with both losses, but changed optimizer and precision together. This experiment separates those factors in a **2×2 comparison for each of the two existing losses**:

| | float32 | float64 |
| --- | --- | --- |
| Adam | continued training | continued training |
| L-BFGS | continued training | continued training |

All four arms **within each loss** start from that loss's saved final 4,000-epoch memorization-v1 network. These are common starting weights, not outputs copied from the successful independent optimization. The two losses have different starting checkpoints; cross-loss differences are not a controlled loss-only comparison. Hashes pin both checkpoints and the same 32-example manifest. No new initialization, resampling or held-out data.

Keep the original 256×256 tanh MLP (75,554 parameters), generic 12 count logits and 22 sigmoid shape outputs, stick-breaking decoder, count cross-entropy and shape-loss weights. Parameter/position loss functions are reused unchanged. No fit/opening penalties, symmetry constraints, shape correction or relaxed validity. Preserve the saved normalization mean/std; float64 converts the same values rather than recomputing them. Encode inputs and reference labels directly at each arm's dtype.

## Optimization budgets

- Adam: 4,000 additional full-batch steps at **0.0001**, continuing the earlier final learning rate. Fresh moments because the prior checkpoints did not save optimizer state; therefore this is a defined restart from saved weights, not an exact continuation of the previous optimizer.
- L-BFGS: one optimizer over the **shared network weights**, learning rate 1, strong-Wolfe line search, history 50, at most 4,000 iterations and nominally 4,000 training objective/gradient evaluations. Gradient tolerance 1e−12 and change tolerance 1e−16 are identical for both precisions. A completing line search may slightly exceed the evaluation limit; record actual counts. The library may return before the limit, which does not by itself prove numerical convergence.
- Same full batch, CPU, one thread, deterministic algorithms. Record elapsed optimization time and actual objective evaluations; equal evaluation ceilings do not guarantee equal runtime or work per update.
- Keep every final iterate; no checkpoint choice by fit, copying gate or validation. No adaptive retry, optimizer tuning or restart after results. All eight training arms run regardless of outcomes.

Save objective-evaluation history (including trial points evaluated during L-BFGS line search), final loss, maximum absolute gradient, iterations/evaluations, budget flags, copying errors and checkpoint. History points are explicitly evaluations, not necessarily accepted iterates. Diagnostics perform additional no-update evaluations outside the training budget.

## Evaluation and interpretation

Reuse the earlier copying gate: **all 32** must have real-vertex RMS ≤0.1% sheet length and angle MAE ≤0.1°. Separately report final 2%-margin box fit, panel/angle rules, fold budget/count, 721-state contacts, floating creases, opening error and validity plus zero floating plus ≥90% reference opening. Primary validity uses the same placement search, with independent/reference agreement reported. Evaluate saved reference poses separately. Preserve raw returned-pose overflow and finite-grid sweep overflow as different diagnostics; neither is a proof of minimum possible overflow.

For **each float64 training arm**, also cast the complete final network—weights and normalization buffers—to float32 and rerun inference on float32 inputs. This is a deployment-precision control, not another training run. It differs from the earlier direct-output control, which cast output logits rather than network weights. Keep all four cast outcomes, including failures.

Compare each arm with its own saved starting network, and compare optimizers at fixed precision and precision at fixed optimizer. Improvement over the baseline under restarted Adam can reflect extra training. Improvement from L-BFGS at a given precision supports an optimization-method explanation for this setting; it does not establish superiority across tasks or equal wall-clock budgets. A float64 benefit can reflect more accurate gradients and a different trajectory. Success only demonstrates fitting these known training examples, not generalization. Failure at this budget does not prove a capacity limit.

Read-only baseline evidence is in `experiments/memorization-v1/results/`; no completed baseline is rerun. No test/validation set is loaded. No physical certification, ranking-optimality or continuous-collision claim.

```sh
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
.venv/bin/python -m learning.network_optimization experiments/network-optimization-v1
```

The runner refuses to overwrite `results/`. Preserve all historical results. Reproduction requires a new directory with the frozen config.
