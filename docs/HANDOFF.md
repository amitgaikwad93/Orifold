# Orifold handoff

Snapshot: 2026-11-05 (evening). The experiment v2 setup is agreed, the request distribution is frozen, and the deterministic reference solver is verified: no misses found by free-form search, and Codex's independent checker agrees on all 701 map designs. No v2 dataset or training yet. Procedure for updating this file: AGENTS.md, "Handoff procedure".

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

## Latest (2026-11-05, map r5)

- **D26–D29 implemented** (fold budget, spread ranking with a 10% band, lengths-and-angles symmetry). **D30 implemented** (the final shape may turn about the hinge axis; each design stores `placement`). Commits through `7361a6b`.
- **Codex** updated `scripts/independent-check.js` (commit `1b5be58`): on r4 it agrees with 2,102/2,102 answers. It does **not** yet apply `placement`; the user has a prompt to have Codex add it and run on `results/request-map-2026-11-05-r5.json.gz`.
- **Map r5 measured** (EXPERIMENT_SPEC.md "Evidence so far"):
  - 778/784 solved, 0 impossible;
  - mirror pairs agree on fewest folds 378/378;
  - fewest folds confirmed 0/174;
  - spread beaten beyond the band 23/180;
  - foot panels 14 (was 492);
  - dead creases common at budget +2 (260/776).
- **Report:** https://claude.ai/artifact/DG4P4RTYrbJixzZAbPjwWj (version 4).
- **Checks:** `npm test` passed, 43/43.

## In discussion / open

DECISIONS.md open question 1: keep alternating fold directions for v2 (accepting 1° direction-switch creases; agent recommendation) or allow free mountain/valley directions now. D31 (roomy boxes keep most spread) and D32 (no fold-angle rule) are decided.

## Next concrete task

After the user decides fold directions: implement if changed, strengthen the spread search (23/180 beaten; deterministic free-form refinement from family winners), rerun r6 with all checks (including Codex's checker with placement), then generate the v2 dataset.

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
