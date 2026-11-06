# Independent-output diagnostic v1 — frozen protocol

Authorized 2026-11-06: run only the independent-output experiment on the same 32 training examples as memorization-v1. A family-specific decoder is not part of this experiment.

Question: can gradient optimization recover the reference answers with the existing output representation and imitation losses, when each request owns independent adjustable values? This is supervised fitting to known answers, not solving unknown boxes or learning a predictor.

## What stays fixed

Use the exact memorization-v1 manifest, pinned by SHA-256; do not load validation/test examples or resample. Use the same two losses from `learning/v2.py`, including fold-count cross-entropy and position weight 10. Preserve the generic 12 fold logits plus 22 sigmoid-controlled shape outputs, stick-breaking lengths, angle decoder, true fold count in shape loss, and predicted count at evaluation. No symmetry constraints, fit penalty, tighter-fold penalty, shape repair, or changed fit tolerance.

Initialization is **exactly the outputs of the prior experiment's untrained initial network**, including its raw shape logits. Copy those into independent parameter rows. The checkpoint and manifest hashes are in config. The network is then discarded; box features do not influence the optimized outputs. The two loss arms start identically. This initialization uses no reference answer values.

## Stages, declared before running

1. **Matched schedule:** optimize independent logits with float32 Adam for 4,000 steps, learning rate 0.001 through step 2,000 then 0.0001. Same schedule, initial outputs, losses and decoder as the network diagnostic. The mean batch loss is separable across examples; Adam has coordinate-specific moments and there is no gradient clipping, weight decay, batch normalization, or shared parameter. Tests compare full-batch losses/gradients with individual examples. Identical learning rates do not imply identical output movement when the optimized variables differ from network weights.
2. **Optimizer/precision control:** from each arm's final Adam logits, optimize each request separately with float64 L-BFGS (an optimizer that uses curvature estimates and a line search). Each request has a fresh optimizer and freshly float64-encoded labels. Maximum 1,000 iterations / 1,250 evaluations per request, gradient tolerance 1e-12, change tolerance 1e-16, history 50, strong-Wolfe line search. Record actual counts, final gradients and losses. This stage changes both optimizer and precision; improvement cannot be attributed to either alone. It tests attainability with the existing format, not a matched-speed comparison with the network.
3. **Rounding control:** cast refined logits to float32, then apply sigmoid and decode. Evaluate without optimization. This isolates how much the refined result changes when represented in training precision.

Both losses complete every stage regardless of observed fit. Keep the final Adam step and final L-BFGS iterate, with no selection by validity, retry, or best-case checkpoint. Run on one CPU thread. Save each checkpoint, Adam histories, per-request refinement diagnostics, every predicted design and all outcomes. Failure at this finite budget does not prove impossibility.

## Measurements and interpretation

Retain the earlier copying gate: all 32 must have unrotated real-vertex RMS error ≤0.1% sheet length **and** angle MAE ≤0.1°. Separately evaluate panel/angle rules, fold count/budget, box fit with the 2% margin, 721-state contacts, floating creases, opening error, material crease-position error, and validity plus zero floating creases plus ≥90% reference opening. Keep Node reference and independent overall validity decisions side by side.

Primary validity uses the existing placement search. Also evaluate the saved reference placement and offset. Report raw returned-pose overflow separately from the best found in a 0.01° rotation sweep (18,000 angles, translated to the minimum). A sweep is an upper bound on minimum possible overflow, not proof of infeasibility. It does not replace primary decisions or optimize wall contact.

Known baseline from memorization-v1: reference encode/decode succeeds for all 32 with placement search, including float32. The format can express valid answers. The question is whether optimization reaches them. Success supports investigating shared-network learning next; it does not identify capacity, training schedule or interference as the unique cause. Failure requires inspecting loss, optimizer, precision and boundary behavior before blaming the format. Close imitation and strict validity remain separate outcomes.

No held-out evaluation, ranking-optimality claim, continuous-motion proof, physical certification, or family-specific model is included.

```sh
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
.venv/bin/python -m learning.independent_outputs experiments/independent-outputs-v1
```

The runner refuses to overwrite `results/`. Reproduction requires a new directory with the same config. Historical evidence stays unchanged.
