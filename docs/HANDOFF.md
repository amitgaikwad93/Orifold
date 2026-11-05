# Orifold handoff

Snapshot: 2026-11-05 (later). The experiment v2 setup is agreed, the request distribution is frozen, and the deterministic reference solver is verified: no misses found by free-form search, and Codex's independent checker agrees on all 701 map designs. No v2 dataset or training yet. Procedure for updating this file: AGENTS.md, "Handoff procedure".

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
  - the independent free-form search beat the first version in 3/218 checked cells (grid-resolution misses, fixed in r2 below);
  - the free-form search is reliable up to about 5 folds.
- **Evidence (first version):** `results/request-map-2026-11-05.json.gz`, `results/request-map-completeness-2026-11-05.json`. Current results are r2.
- **Report** (private to the user): https://claude.ai/artifact/DG4P4RTYrbJixzZAbPjwWj
- **Checks:** `npm test` passed, 40/40.

## Since the previous snapshot

- **User decisions:** D23 (tiny swept-area differences are ties, so clean 180° folds win) and D24 (weight requests toward short boxes).
- **Codex** added `scripts/independent-check.js` (commit `f521f23`): an independent spec-based checker importing no project code. Recorded as D25.
- **Solver fix** in `src/packing.js`: finer near-closed angles, contact-aware refinement, 24 refinement starts.
- **Map rerun (r2):** 701/729 solved; free-form search beat it 0/218; the independent checker passes 701/701 (`results/*-r2.json*`).
- **Report republished** at the same link: https://claude.ai/artifact/DG4P4RTYrbJixzZAbPjwWj
- **Checks:** `npm test` passed, 40/40.

## In discussion / open

Near-parallel-panel ranking issue (DECISIONS.md open question 1): mostly decided as D26 (fold budget input), D27 (spread by smallest opening angle, before order) and D28 (mirror or point symmetry). Only the tie-band size remains open; the agent suggested 10%.

## Next concrete task

After the user sets the tie band: implement D26–D28 in `src/packing.js` (budget input, opening-angle spread, tapered and palindromic families, corrected symmetry check), update `scripts/independent-check.js` to match the spec (Codex could do this independently), update EXPERIMENT_SPEC.md sections 2 and 5, rerun the map, independent check and completeness check, then do EXPERIMENT_SPEC.md "Next work items" 2: generate and label the v2 request set from the frozen distribution in `experiments/learning-v2/`, run the acceptance checks (independent checker, completeness check, coverage plot, grouped splits), then build the visual review page. No training before both are done.

## Runtime

No jobs are running. Python venv not installed in this container (only needed for learning code). `artifacts/request-map/` holds this session's exploratory copies; it is ignored by git.

## Commands

```sh
npm test
npm run map -- artifacts/<dir>/map.json                       # ~1 min CPU
npm run map:check -- artifacts/<dir>/map.json artifacts/<dir>/check.json 40 3
npm run map:report -- artifacts/<dir>/map.json artifacts/<dir>/report.html artifacts/<dir>/check.json
node scripts/independent-check.js <map.json.gz>                 # Codex's independent checker
```
