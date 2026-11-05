# Orifold handoff

Snapshot: 2026-11-05. Tooling works end to end; the first learning experiment failed and a later audit showed its dataset could not fairly test the approach. The project is now **designing the experimental setup** before any new training. Procedure for updating this file: AGENTS.md, "Handoff procedure".

## Current state

- Repository: https://github.com/amitgaikwad93/Orifold. Nothing is on `main` yet.
- Draft PR #1 (`codex/phase-1-accordion`, open, unmerged) holds phases 1–3 up to commit `8d10889`.
- Current working branch: `ccr-d2215757-ddp9pm`, branched from `8d10889`. It adds this session's docs and audit commits, which are **not** in PR #1. No PR exists for it yet; one would stack on PR #1.
- Works: the Node geometry evaluator (`src/accordion.js`), the optimizer (`src/optimizer.js`, solves 150/150 held-out requests), the Python geometry port (parity tested), and the training/evaluation pipeline with frozen splits.
- Does not work: the v1 network (0/150 strict, 3/150 within 1%). See docs/LEARNING.md.
- Not implemented: FOLD export, a visualisation of datasets and outcomes, function/aesthetic metrics.

## Last session (2026-11-04)

- Reviewed the project direction with the user. Findings: in the 4-panel accordion the optimizer already solves requests in ~130 ms, so learning cannot add practical value at this size. The v1 labels sit on the box boundary.
- **Audited the v1 dataset** (`node scripts/audit-label-consistency.js experiments/learning-v1 results/label-consistency-audit-2026-11-04.json 40 12345`). Re-solving with another seed changed the design in 90% of 40 requests, and found lower rotation than the stored label in 24. Target boxes were derived from random folds. Recorded as DECISIONS.md D10.
- The user set the current-stage focus: design the setup (experiment targets, objective dataset criteria, definition of valid origami) independent of scale (D11). The user also asked for plain-language communication and visuals (D12).
- Documentation housekeeping:
  - AGENTS.md rewritten, with the handoff SOP and communication rules;
  - new docs/LIMITATIONS.md, the single source for evaluator caveats;
  - new docs/GLOSSARY.md;
  - audit notes added to LEARNING.md; README and PLAN updated.
- Checks: `npm test` passed; the docs link check passed.

## In discussion / open

The setup discussion is concluded for experiment v2. Decisions D13–D21 (2026-11-05) are written up in [EXPERIMENT_SPEC.md](EXPERIMENT_SPEC.md):

- parallel creases, 0–11 folds, alternating directions;
- a 2% fit margin;
- a strict ranking: fewest folds, then most ordered, then gap, sweep, compactness;
- a general systematic request grid;
- success = the model outputs valid fold patterns, judged by the user on a visual review page.

Still open: the agent-proposed sub-definitions marked *proposed* in the spec (DECISIONS.md open question 1). They can be adjusted before the experiment is frozen.

## Next concrete task

Implement EXPERIMENT_SPEC.md "Next work items" 1–3:

1. Allow 1-panel designs in `src/accordion.js`.
2. Add the 2% margin, active-crease rule and ranking measures, with tests.
3. Build the seed-independent reference solver and a request-space map report page showing feasible, infeasible and unknown regions and where the hand rule works.

Show the map to the user before generating any training data.

## Runtime

No jobs are running. The Python/PyTorch venv is not installed in this container; the setup steps are in docs/LEARNING.md and are only needed for learning-code work. `npm test` needs only Node 18 or later.

## Commands

```sh
npm test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py' -v   # after venv setup
npm run solve -- examples/narrow-box.json
python3 -m http.server 8000   # then open /demo/accordion.html
```
