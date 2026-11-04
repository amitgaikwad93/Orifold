# Orifold handoff — read this first

Snapshot: 2026-11-04, after the first small CPU learning experiment. **The model is trained, but the standalone performance target was missed.** Read LEARNING.md before interpreting the checkpoint as a working design generator.

## Repository and branch

- Repository: https://github.com/amitgaikwad93/Orifold
- Working branch: `codex/phase-1-accordion` (historical name now includes phases 1–3).
- Draft PR: https://github.com/amitgaikwad93/Orifold/pull/1
- Prior handoff commit: `47753468ca46173584859a4fd1a1dcbe207237db`; the learning changes are subsequent. Inspect the current remote head rather than resetting to this historical commit.
- At this snapshot, the PR is open and unmerged. `main` does not contain the implementation. Check remote state before choosing the next working branch.

The prior environment held files in `/workspace/Orifold` without a normal git clone; GitHub tools published the changes because shell git networking failed. CPU PyTorch was installed in a project venv. Do not assume a fresh environment has these files, dependencies, git metadata, or processes. Prefer a normal clone when available and preserve unrelated remote/local changes.

## Scope and user expectations

Read AGENTS.md, DECISIONS.md and PLAN.md. Generate **zero-thickness rigid flat-panel designs only**, currently a fixed four-panel accordion. Target box dimensions are separate upper bounds for packing; this is not exact shape synthesis or scalar volume minimization. Thickness adaptation, hardware, trimming and axis offsets remain excluded until the user explicitly reopens them.

The user wants actual progress within agreed scope, not repeated offers to continue. There is no pending user answer. Additional physical measurements are not required to proceed with idealized learning experiments. Explain outcomes candidly, including failed models.

## Completed work

| Component | Location | Status |
| --- | --- | --- |
| Node geometry and sampled contacts | `src/accordion.js` | Reference evaluator |
| Numerical optimizer | `src/optimizer.js` | Strict default; optional neural initialization added |
| Original numerical pilot | `results/pilot-2026-11-04-*.json` | Immutable 100-request reports |
| Python geometry port | `learning/geometry.py` | Parity checked against Node |
| Learning data generation | `scripts/generate-learning-data.js` | 1,000 labeled requests plus 100 impossible diagnostics |
| MLP and training | `learning/model.py`, `learning/train.py` | 17,926 parameters; CPU trained from scratch |
| Prediction and held-out evaluation | `learning/predict.py`, `scripts/evaluate-learning.js` | Frozen test comparison complete |
| Dataset, checkpoint, metrics and curves | `experiments/learning-v1/` | Versioned, checksummed evidence |
| Tests | `tests/` | 31 Node cases; 5 Python test methods |
| FOLD export | Not implemented | Still planned, not claimed complete |

## Measured result — preserve without spin

Dataset: 700 training, 150 validation, 150 test requests, balanced wide versus narrow/tall boxes. Independent seeds and normalized fingerprints prevent overlap with the earlier pilot and across splits. All optimizer labels passed strict fit and 721 sampled states. Impossible-width examples have no design labels.

The network uses two 128-unit tanh hidden layers, six sigmoid outputs, a bounded length-preserving decoder, and supervised imitation MSE over normalized panels/angles. Selected epoch 68 by validation loss only; stopped at epoch 148. No test tuning occurred. CPU data generation took 133.52 s, training loop 1.62 s, and six-method test comparison 55.63 s. No GPU or additional paid compute was provisioned.

| Method | Strict success / 150 | <=1% overflow success / 150 |
| --- | --- | --- |
| Network only | **0** | **3** |
| Equal-panel stack | 75 | 75 |
| Random search, 984 candidates | 134 | 134 |
| Full optimizer, 984 candidates | 150 | 150 |
| Short optimizer, 264 candidates | 138 | 138 |
| Network-initialized short optimizer, 264 candidates | 140 | 142 |

Raw network inference median was about 0.030 ms, but fast invalid output is not a useful speedup. All network failures were fit failures; no sampled contacts were blocked. Median worst-axis overflow was 33.84%. The paired hybrid improvement is 6 wins versus 4 losses: insufficient to establish a reliable benefit from learning. Do not claim the 95% learned-model target was met or compare these 150 requests directly to the different original 100-request pilot.

Likely issue to investigate: averaging valid optimizer choices under imitation loss does not preserve nonlinear box-fit constraints. This is a hypothesis, not a proved sole cause. The first loss has no direct box-fit term and its checkpoint selection does not measure geometric acceptance.

## First actions in a fresh session

1. Inspect remote PR/branch and local worktree. Read AGENTS.md, DECISIONS.md, LEARNING.md, and the relevant code. Preserve v1 artifacts.
2. Restore a Python environment using the CPU installation commands in LEARNING.md. Recorded versions: Python 3.12.14, PyTorch 2.9.1+cpu, NumPy 2.3.5. Inspect actual availability rather than assuming it.
3. Run `npm test` and `.venv/bin/python -m unittest discover -s tests -p 'test_*.py' -v`. Do not rerun completed dataset generation/training merely to establish current state; saved evidence is available.
4. Continue the next experiment below within the zero-thickness scope. No GPU or user approval is required for routine CPU work; billable provisioning still requires explicit approval.

## Next executable milestone — improve the objective, not model size

This is a proposed v2 experiment, not implemented or already running:

1. Add a differentiable PyTorch endpoint geometry/bounding-box function for this fixed hinge family. Test it against Node/Python geometry over fixed fixtures, random configurations, and gradients away from max/min kinks. Keep the existing non-differentiable contact validator independent.
2. Predeclare a v2 configuration in a new directory. Keep the small architecture initially. Add a normalized endpoint-overflow loss alongside imitation; develop loss weights and checkpoint selection using **training and validation only**. Report both loss and geometric acceptance on validation. Investigate label ambiguity using training data rather than attributing all failure to architecture size.
3. Preserve the v1 dataset/checkpoint/results. Its test outcomes are now known, so do not present repeated tuning against them as an untouched test. Freeze a fresh, independent test cohort and seeds for the next final comparison; group scaled/related requests to avoid leakage.
4. Select a final checkpoint without looking at the new test results, then compare network-only, cold optimizer, and paired network-initialized optimizer with matched budgets and the same reference checks. Record strict and 1% fit separately, collisions, failures, latency, and paired wins/losses.
5. If performance still misses the target, preserve that result and diagnose. Do not silently loosen geometry, add thickness, enlarge the model, or jump to arbitrary crease graphs. Update this handoff and the PR with the actual outcome.

The longer-term path remains Miura-ori or other zero-thickness rigid-foldable families after the learning/evaluation pipeline is understood. FOLD export is still outstanding.

## Commands and artifacts

See LEARNING.md for clean setup and full reproduction into a fresh directory. Useful commands from the repository root:

```sh
npm test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py' -v
npm run solve -- examples/narrow-box.json
.venv/bin/python -m learning.predict --request examples/narrow-box.json
python3 -m http.server 8000
```

The last prediction command returns a proposal, not certified fit. The demo at `/demo/accordion.html` is still a geometry viewer, not a trained-model UI.

`experiments/learning-v1/config.json` and `manifest.json` freeze settings/splits. `dataset.jsonl.gz` contains standard compressed JSON Lines; `run/checkpoint.pt` contains the selected model; `run/history.csv`, training/evaluation summaries, frozen predictions, and compressed per-request evaluations preserve evidence. Load the checkpoint with `weights_only=True`. Source commands refuse to overwrite completed artifacts; use new directories for deliberate repetitions. `artifacts/` is ignored exploratory output.

## Limits, live jobs, blockers

No persisted dataset, training, evaluation, server or automation job is running at this handoff; all experiment processes finished. Verify current runtime state when resuming. There is no pending user decision.

The original sampled geometry limitations still apply: zero thickness, no continuous collision proof or layer-order validation, no enclosure-motion or single-actuator proof. Width cannot contract in the accordion family. The exact flat-stack endpoint exception is not a general origami guarantee. A loss decrease is not geometric success; a solver failure is not proven infeasibility.

Before ending the next substantive session, update this document, decisions and roadmap. A final chat reply alone is not durable project memory.
