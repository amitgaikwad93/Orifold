# Orifold handoff

Snapshot: 2026-11-05. Map r6 passes the independent checker with placement support. A standalone FOLD 1.1 exporter and tests are implemented. The user reports v2 dataset generation is happening separately; this session leaves its files alone.

## Current state

- Repository: https://github.com/amitgaikwad93/Orifold; working branch `ccr-d2215757-ddp9pm`.
- Draft PR #1 (`codex/phase-1-accordion`) contains the earlier phases; this working branch has the subsequent v2 work. Nothing was merged in this session.
- Current decisions: D26–D33. Fold-budget answers, opening-angle spread, palindromic lengths and angles, a 10% spread band, and final placement about the hinge axis. Alternating directions and 1° direction-switch creases remain allowed.
- Map r6 baseline: 778/784 solved; fewest-fold search beaten 0/174, spread beaten beyond the band 8/180, mirror mismatches 2/1,126. These searches do not establish ranking optimality.
- `scripts/independent-check.js` now rotates only the final cross-section for placement and checks all budget answers. It imports no project geometry or solver code; `src/packing.js` was not read for this work.
- `scripts/export-fold.js` exports flat crease-pattern topology and a second, placed folded-form frame. Input can be inline design JSON, a JSON file, or a JSON/JSONL file (optionally gzip) selected by cell index or request id and budget/answer.
- The v1 learning experiment remains a failed baseline. V2 dataset generation and training were not started or changed by this session.

## Last session

- Added placement self-tests: a 100-long panel at 90° fits a 10 × 12 × 103 box; the same panel at 0° fails. Contact tests stay in the unrotated motion frame.
- Saved `results/independent-check-2026-11-05-r6-codex-v3.json`: 2,330/2,330 answers in 778 cells pass, across 1,679,930 sampled states. All 16 per-check disagreement counts are zero.
- Added `tests/export-fold.test.js`: standard FOLD metadata/topology/signs, the 0°/90°/180° fixtures from GEOMETRY.md, placed bounds, rectangular-panel edge/diagonal preservation, input selection, gzip JSON/JSONL, and output overwrite protection. Every r6 answer exports with the saved placed dimensions and preserved panel distances.
- Exported `upright-panel.fold`, `symmetric-five-panel.fold`, and `direction-switch.fold` into ignored `artifacts/fold-examples/`. Source map cell/budget pairs: 728/0, 146/5, 96/3.
- Checks: checker self-tests and `npm test` passed. No files in `src/` or `experiments/learning-v2/`, and no existing script other than the checker, were modified.
- These are zero-thickness sampled checks, not continuous collision or ranking proofs. No layer order or manufacturing claim is made. The FOLD files certify nothing; actual Origami Simulator import was not exercised.

## In discussion / open

None in DECISIONS.md at this snapshot. Reference search limitations above remain measured limitations.

## Next concrete task

Continue the separately managed v2 dataset generation and acceptance checks, then use the review page for the user's visual verdict before training. Import the exported examples at https://origamisimulator.org via File → Import for an external visual check.

## Runtime

No jobs from this checker/export session remain active. The user reports dataset generation is happening separately; its process was not inspected, stopped, or modified here. `artifacts/fold-examples/` is git-ignored.

## Commands

```sh
node scripts/independent-check.js --self-test
node scripts/independent-check.js results/request-map-2026-11-05-r6.json.gz
npm test
node scripts/export-fold.js --help
node scripts/export-fold.js --input results/request-map-2026-11-05-r6.json.gz --cell 96 --budget 3 --output artifacts/fold-examples/direction-switch-new.fold
node scripts/export-fold.js --input experiments/learning-v2/dataset.jsonl.gz --request-id v2-short-0000 --answer 0 --output artifacts/example.fold
```

Export outputs must not already exist. Historical result reports must not be overwritten. Examples are workspace artifacts; regenerate them after a fresh checkout.
