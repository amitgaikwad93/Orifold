# Training-only memorization diagnostic v1

Predeclared before training on 2026-11-05. User authorized the small controlled diagnostic after the training audit. This is not run 5 or a held-out evaluation.

Question: can the existing 256×256 MLP copy 32 examples from one two-fold family, without competing geometric penalties? The corrected position loss masks all repeated padding vertices. Both arms start from identical weights and use identical full batches, Adam, CPU float32, seed 17, and a fixed 4,000-epoch schedule (0.001 for 2,000, then 0.0001). The final epoch is reported; no best-case checkpoint selection or restarts. Parameter imitation uses the existing masked parameter loss plus fold-count cross-entropy. Position imitation uses cross-entropy plus 10 times the mean squared distance over real side-view vertices, normalized by sheet length. These are the existing loss weights, not a claim of equal gradient scale.

The 32 unique requests are sampled with seed 20261105 from the 253 **training** answers with budget 2, two folds, and exact family `symmetric-ends-one-angle+spread-refined`. The manifest retains their requests and reference answers; config records the dataset hash. No validation or test answers enter selection, training, normalization, or evaluation. The runner reads only this manifest. Family selection intentionally makes this an easier, restricted diagnostic; it cannot establish full-dataset learnability.

Count prediction is retained and measured; it is not forced to two at evaluation. Geometry loss uses the true fold count, as in the existing model. Placement and offset are not predicted. All model outputs receive the same reference wall-placement search; this changes placement only, not panel lengths or angles. Report independent 721-state contact and box checks alongside the Node reference's overall decision. References are checked at their saved placements and after the same search. Encode/decode round trips in float64 and float32 are measured at both placements to distinguish numerical sensitivity from learning error.

Report every outcome: fold accuracy; unrotated vertex RMS distance / sheet length; material crease-position RMS error / sheet length; angle MAE in degrees; signed smallest-opening error; maximum box overshoot / sheet length; floating creases; sampled validity; and validity plus zero floating creases plus at least 90% of reference opening. Overshoot and floating counts are reported even when a design fails. Predeclared copying gate: **all 32** have vertex RMS ≤ 0.1% of sheet length and angle MAE ≤ 0.1°. Report sampled validity separately; close imitation does not guarantee fit against a wall.

If neither arm copies these examples accurately, investigate optimization/representation before scaling. If copying improves while fit fails, inspect wall sensitivity and numerical baselines before changing capacity. This single-seed experiment does not choose a generalization winner, prove ranking optimality, certify continuous collision-free motion, or validate real materials.

Run from the repository root:

```sh
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
.venv/bin/python -m learning.memorization experiments/memorization-v1
```

The runner refuses to overwrite `results/`. Historical runs and the dataset remain unchanged.
