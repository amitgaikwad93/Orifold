# Orifold handoff

Snapshot: 2026-11-04. Tooling works end to end; the first learning experiment failed and a later audit showed its dataset could not fairly test the approach. The project is now **designing the experimental setup** before any new training. Procedure for updating this file: AGENTS.md, "Handoff procedure".

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

The user said the setup discussion is **not finished**. Open items are listed in DECISIONS.md, "Open questions":

1. How to measure function and **geometric** aesthetics (order built into the design, not visual style; clarified 2026-11-05). The proposal is to use it as the quality tie-break.
2. Which visualisation route to use on the user's PC.
3. The content of the experiment specification: validity layers, quality objective, request distribution, success target.

Do not treat the agent's proposals there as decisions.

## Next concrete task

Continue the setup discussion with the user. Then draft `docs/EXPERIMENT_SPEC.md` (the template plus the accordion instance) from what they decide. The most useful first evidence for that discussion is a visual map of the accordion request space: a grid over box length and height relative to sheet length, showing feasibility and representative folds. It fits whichever visualisation route is chosen. Do not build a v2 dataset or train before the spec is agreed.

## Runtime

No jobs are running. The Python/PyTorch venv is not installed in this container; the setup steps are in docs/LEARNING.md and are only needed for learning-code work. `npm test` needs only Node 18 or later.

## Commands

```sh
npm test
.venv/bin/python -m unittest discover -s tests -p 'test_*.py' -v   # after venv setup
npm run solve -- examples/narrow-box.json
python3 -m http.server 8000   # then open /demo/accordion.html
```
