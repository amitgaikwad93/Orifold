# Orifold handoff

Snapshot: 2026-11-06. Independent-output optimization succeeds on all 32 training requests after refinement, for both imitation losses. All jobs are finished.

## Current state

- Repository https://github.com/amitgaikwad93/Orifold, branch `ccr-d2215757-ddp9pm`. No merge. Earlier draft PR #1 covers prior phases.
- Rules: EXPERIMENT_SPEC.md and DECISIONS.md D26–D36. Zero thickness, 0–11 alternating folds, placement/offset allowed, 2% box margin, wall-contact ranking before spread. No rule changes in this diagnostic.
- Authoritative dataset: `experiments/learning-v2b/dataset.jsonl.gz`, 6,004 independently checked answers with corrected offsets, review round 2 accepted 48/48. Historical datasets and runs remain unchanged.
- Full-data runs 1–4 remain preserved. Run 2 traded opening for fit; run 4 used a one-sided penalty that allowed over-opening. Run 4a also counted padded endpoint copies in its position loss, fixed in `33da2b3`.
- The 32-request shared-network diagnostic in `experiments/memorization-v1/` reached only 12/32 and 10/32 sampled-valid designs. Its two losses failed the all-example precision gate.
- New [independent-output report](../experiments/independent-outputs-v1/REPORT.md): each of those same requests has independent generic output logits. Both losses reach **32/32** precision and sampled validity after float64 L-BFGS refinement, retained after casting logits to float32. No built-in family shape was used.
- No held-out examples were used in either diagnostic; the v2b test split remains unevaluated. Independent checker/FOLD export remain available; FOLD is serialization, not certification.

## Last session

- Pulled latest `68c11fa` first. It confirms the padding/overflow findings and corrects historical tolerance curves with a rotation sweep. Preserved those updates.
- User approved only the independent-output experiment (D36). Setup, code and tests frozen in `5c17779` before execution. Same manifest and initial checkpoint pinned by hashes.
- Same-schedule float32 Adam on independent logits: parameters **1/32**, positions **3/32** sampled-valid; neither reaches the copying gate. Then separate float64 L-BFGS optimizers per request: **32/32** passes for both losses, all zero floating, all within the reference opening band. Cast-to-float32 control retains **32/32** for both.
- All 192 new outputs pass panel/angle rules, correct fold count and 721-state contact checks. Independent/reference overall validity disagreements: **0/192**.
- Placement matters: refined saved-reference poses pass 29/32 and 31/32; re-searching placement gives all 32 without altering shape. The 0.01° rotation grid misses one known-fitting orientation; grid failure is not infeasibility.
- Refinement changes optimizer and precision together. Seven request/loss runs reached evaluation limits; four finished their line search at 1,251 evaluations against a 1,250 setting. Final results retained; do not claim all gradient tolerances converged.
- Optimization CPU time excluding evaluation: 1.53 + 10.11 s parameter arm; 10.50 + 37.49 s position arm. No paid compute.
- Validation: all **16 Python tests** passed, including independent gradient equivalence, exact initial-output parity, synthetic optimization recovery and existing geometry parity. No solver/geometry implementation changed, so Node tests were not rerun. Plot inspected; report links and frozen input hashes checked. `src/packing.js` source was not read.

## In discussion / open

The generic format and losses can reach suitable answers on this subset. The original Adam schedule still fails even without a network, so optimization settings are part of the investigation. Success does not establish capacity/interference as the unique cause of shared-network failure. Casting successful results to float32 does not test float32 optimization trajectories.

The family-specific decoder is outside the approved experiment. Larger models, full-data run 5, changed rules and held-out testing remain unapproved next steps. See DECISIONS.md Open questions.

## Next concrete task

Recommended, not run: predeclare an optimizer/precision comparison on the **same generic shared network and same 32 examples**, with convergence measurements, before scaling or altering architecture. This tests whether output-level optimization success transfers to learning the shared request-to-design mapping.

## Runtime

No active jobs. CPU-only `.venv`: Python 3.12.14, PyTorch 2.9.1+cpu, NumPy 2.3.5, Matplotlib 3.10.8. No paid resources provisioned. All historical evidence preserved.

## Commands

```sh
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
npm test
node scripts/independent-check.js --self-test
```

To reproduce the independent-output diagnostic, use a **new directory** containing the frozen config; results refuse overwrite:

```sh
.venv/bin/python -m learning.independent_outputs <new-experiment-directory>
MPLCONFIGDIR=/tmp/orifold-mpl .venv/bin/python scripts/report-independent-outputs.py <new-experiment-directory>
```

The config references the frozen memorization-v1 manifest and initial checkpoint. These checks establish sampled zero-thickness validity only, not continuous collision freedom, ranking optimality, generalization, or physical performance.
