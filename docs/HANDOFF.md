# Orifold handoff

Snapshot: 2026-11-05. The experiment v2 setup is agreed (EXPERIMENT_SPEC.md) and its first evidence exists: a deterministic reference solver and a request-space map of 729 box shapes. No v2 dataset or training yet. Procedure for updating this file: AGENTS.md, "Handoff procedure".

## Current state

- Repository: https://github.com/amitgaikwad93/Orifold. Nothing is on `main` yet.
- Draft PR #1 (`codex/phase-1-accordion`, open, unmerged) holds phases 1–3 up to commit `8d10889`.
- Working branch: `ccr-d2215757-ddp9pm`, branched from `8d10889`. It holds all docs, audit and v2 work since then, which is **not** in PR #1. No PR exists for it.
- Works:
  - the Node geometry evaluator (`src/accordion.js`, now including 1-panel designs);
  - the v2 rules and reference solver (`src/packing.js`);
  - the map, check and report scripts;
  - the v1 optimizer, Python port and learning pipeline.
- Does not work: the v1 network (0/150; LEARNING.md). The v1 dataset is unsuitable for reuse (D10).
- Not implemented: the visual review page for the user's verdict, FOLD export, the v2 dataset and training.

## Last session (2026-11-04 to 05)

- **v1 audit:** labels were inconsistent across seeds (D10).
- **Docs restructured:** handoff SOP and communication rules in AGENTS.md; new LIMITATIONS.md and GLOSSARY.md.
- **User decisions:**
  - setup first (D11);
  - geometric aesthetics and function measures (D14);
  - variable fold count, fewest preferred, 0–11 folds (D13, D21);
  - strict ranking order (D16);
  - general request grid with no application tailoring (D17);
  - 2% margin (D18);
  - complexity only after the pipeline is proven (D19);
  - success = the model outputs valid fold patterns, judged by the user visually (D20);
  - all proposed sub-definitions accepted (D22).
- **Built:** `src/packing.js` (rules, order score, minimum gap, swept area, ranking, hand rule, deterministic reference solver over ordered families with pattern-search refinement), `tests/packing.test.js` (9 tests), and the scripts `request-map.js`, `check-reference-completeness.js` and `render-map-report.js` (`npm run map`, `map:check`, `map:report`).
- **Measured** (EXPERIMENT_SPEC.md, "Evidence so far"):
  - 701/729 solved, 27 proven impossible, 1 not found;
  - fewer folds than the hand rule in 209 requests;
  - the independent free-form search beat the reference in 3/218 checked cells, all grid-resolution misses;
  - the free-form search is reliable up to about 5 folds.
- **Evidence:** `results/request-map-2026-11-05.json.gz`, `results/request-map-completeness-2026-11-05.json`.
- **Report** (private to the user): https://claude.ai/artifact/DG4P4RTYrbJixzZAbPjwWj
- **Checks:** `npm test` passed, 40/40.

## In discussion / open

DECISIONS.md open questions:

1. Near-flat versus flat: should tiny swept-area differences count as ties so a clean 180° fold wins?
2. Weighting requests toward short boxes, since a uniform grid is 64% one-fold.

The user also offered Codex for independent work or verification. A suggested brief is in the latest chat reply; nothing has been sent.

## Next concrete task

Fix the reference solver's three resolution misses: refine using contact feasibility as well as overflow, then rerun the map and check into new files. Then get the user's answers to the two open questions, freeze the v2 request distribution, and run the dataset-acceptance checks (spec section 8).

## Runtime

No jobs are running. Python venv not installed in this container (only needed for learning code). `artifacts/request-map/` holds this session's exploratory copies; it is ignored by git.

## Commands

```sh
npm test
npm run map -- artifacts/<dir>/map.json                       # ~1 min CPU
npm run map:check -- artifacts/<dir>/map.json artifacts/<dir>/check.json 40 3
npm run map:report -- artifacts/<dir>/map.json artifacts/<dir>/report.html artifacts/<dir>/check.json
```
