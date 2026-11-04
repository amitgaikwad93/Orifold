# Orifold handoff — read this first

Snapshot: 2026-11-04, after the 100-request pilot and the user's zero-thickness scope clarification. This handoff update changes documentation only. Its next implementation task is phase 3 below.

## Repository and branch

- Repository: https://github.com/amitgaikwad93/Orifold
- Working branch: `codex/phase-1-accordion` (name predates the phase-2 work).
- Draft PR: https://github.com/amitgaikwad93/Orifold/pull/1
- Last implementation commit before this handoff: `317feaea6715808a85e3945767aba01e70b18e24`. This is a reference, not a ref to reset to.
- At this snapshot, the PR is open and unmerged; `main` does **not** contain this implementation. Inspect current remote state before resuming. If unmerged, work from the PR branch. If merged, use the current default branch and normal development workflow.

The previous environment held source under `/workspace/Orifold`, retrieved and published through the GitHub connector because shell git networking failed. That directory was not a normal git clone. Do not assume a new environment has those files, git metadata, dependencies, or processes. Prefer a normal clone when available; otherwise use the connected GitHub tools. Do not overwrite remote changes based only on this snapshot.

## What is settled

Read [DECISIONS.md](DECISIONS.md). Core scope: learn inverse design of **zero-thickness rigid-panel origami**, starting with a finite four-panel accordion. Target box dimensions are upper bounds; this is packing, not exact shape synthesis. Thickness adaptation and hardware are excluded until the user explicitly reopens them.

The user wants autonomous progress within that scope and an explanation of what each implementation contributes to the learning objective. No user answer or extra paper measurement is currently required.

## What exists

| Component | Location | Status |
| --- | --- | --- |
| Geometry reference and sampled contact checking | `src/accordion.js` | Implemented |
| Bounded differential-evolution optimizer | `src/optimizer.js` | Implemented; strict fit by default |
| Pilot request generation | `src/pilot-requests.js` | Implemented; witness designs withheld from solvers |
| Solve and benchmark commands | `scripts/solve.js`, `scripts/pilot.js` | Working |
| Interactive examples | `demo/index.html`, `demo/accordion.html` | Browser checked |
| Tests | `tests/` | 28 cases passed locally; implementation commit's GitHub CI passed |
| Frozen benchmark evidence | `results/pilot-2026-11-04-*.json` | Strict and 1% runs retained |
| Python geometry/training code | Not yet present | Next phase |
| Training dataset/splits/checkpoints | Not yet present | No network has been trained |
| FOLD export | Not yet present | Planned after meaningful model evaluation |

Strict pilot: 80/80 evaluator-feasible requests solved by the optimizer, 72/80 by random search, 40/80 by an equal-panel flat stack. All methods rejected 20 impossible-width requests. Optimizer median 133.89 ms, mean 142.50 ms, P95 190.01 ms. Entire strict comparison took 23.43 seconds on the recorded CPU. This is not model performance or a guarantee on new requests. See [PILOT_RESULTS.md](PILOT_RESULTS.md).

## First actions in a new chat

1. Inspect current branch/PR and working changes, then read AGENTS.md, DECISIONS.md, PLAN.md and OPTIMIZATION.md. Do not reread the large Gemini transcript unless needed for historical context.
2. Run `npm test` to verify the restored implementation. Run the single-request example if checking the command interface; reproducing the entire pilot is optional unless something changed.
3. Inspect Python and dependencies. In the last environment Python 3.12, NumPy and SciPy existed, but PyTorch was absent. This is an observation, not a reproducible dependency specification. Create an isolated environment and record dependencies for phase 3.
4. Start the next phase below. Do not ask the user to approve the already agreed move to a small CPU learning experiment. Report a concrete access or dependency blocker if one exists.

## Next executable milestone — first small learning experiment

The following is an implementation recommendation consistent with the agreed plan; record any justified adjustment.

1. **Create a reproducible Python training scaffold.** Keep the Node evaluator as the reference. Add shared analytical and difficult fixtures and a parity harness before trusting any Python geometry/validation port. Compare coordinates, bounds, contact classification and strict fit, including full stacks, partial stacks and crossing cases. Do not weaken rules just to improve scores.
2. **Freeze a small dataset specification.** A reasonable first budget is about 1,000 new feasible requests, with a fixed train/validation/test split such as 700/150/150 and recorded independent seeds. Group related/scaled requests together. Keep the 100 pilot cases out of the held-out test set. Record generation ranges, solver budgets and failures. Include impossible-width cases in a separate evaluation set; do not assign them fabricated design labels.
3. **Generate strict-validated labels using the existing solver.** Save request IDs, dimensions, designs, solver settings, success/failure status and provenance. Recheck labels with the reference evaluator. Preserve multiple-solution ambiguity in interpretation: coordinate imitation error alone does not measure geometric quality.
4. **Train a small MLP from random initialization on CPU.** Normalize dimensions, preserve panel length sums/positivity by construction, and bound angle magnitudes. Start within approximately 10k–100k parameters; record actual architecture, seeds, optimizer settings, stopping criteria and wall time. Use validation only for choices; evaluate the frozen test split once the experiment is fixed.
5. **Measure utility.** Report strict and <=1% per-axis fit, sampled-contact failures, runtime, and failure examples for network-only predictions. Compare against the numerical optimizer and simple baselines on the same test requests. Add network-initialized optimization if useful, recording how that initialization is encoded and the search budget. Target >=95% is an aspiration, not permission to hide failures or adjust test data.
6. **Save a reviewable result.** Checkpoint, configuration, split manifest, curves, evaluation summary and reproduction commands. Update this handoff and the PR. If the learned model underperforms, report it and diagnose rather than silently moving to a larger model or a new folding family.

## Commands

From the repository root, Node 18+ is sufficient for the current implementation; no npm package installation is required:

```sh
npm test
npm run solve -- examples/narrow-box.json
npm run pilot -- artifacts/pilot-strict.json 0
python3 -m http.server 8000
```

Open `http://localhost:8000/demo/accordion.html` for the four-panel viewer. `artifacts/` is ignored; frozen reports in `results/` are versioned. These commands do not start model training.

## Known limits and traps

- Search checks 31 motion states, then up to eight candidates at 721 states. Sampling is not a continuous-motion proof. The prescribed schedule is not a one-actuator mechanism.
- The endpoint box need not enclose the trajectory. Width cannot contract in the accordion family. Do not call packing a target-shape match.
- The exact 180° stack-contact exception is idealized and discontinuous. No layer-order proof exists. The contact review permits only a restricted numerical experiment.
- Equal-panel folding already solves half the deliberately balanced pilot. 60/80 optimized designs have at least one inactive hinge. Do not equate this task with discovery of complex crease networks.
- The original 1% pilot solved 80/80 within tolerance but only 43 outputs fit strictly. The strict rerun solved 80/80 strictly. Do not mix the reports or their metrics.
- The $50 figure is not permission to spend. CPU suffices to begin; training runtime remains unmeasured.

## Running work and blockers

No persisted training, solver, server, or automation job is running at this handoff; previous benchmark processes finished. Verify actual runtime state when resuming. There is no pending user decision. Broader physical observations are optional and are not a prerequisite for zero-thickness model training. Thickness adaptation is excluded, not a backlog item.

Before ending the next substantive session, update this document with the new state and next task. A final message alone is not durable project memory.
