# Quality correction v1: plan (frozen 2026-11-11, before the run)

Roadmap step 3 (D43), authorized by the user on 2026-11-11 (D47). Tests hypotheses H1–H4 from [correction-diagnosis-v1](../correction-diagnosis-v1/REPORT.md). No training, no new model inference, no final-test use. Geometry rules unchanged.

Before freezing, the search was smoke-tested for timing on five validation answers (indices 3, 100, 250, 400, 700 of seed 17); no aggregate result was seen.

## What is tested

`scripts/quality-correction.js`: a deterministic search from a starting design that follows the answer key's priorities, in this order: panel rules → fits with the 2% gap → no collisions (30 motion states during search) → every crease on a wall → widest smallest opening angle. Differences from the current correction (`scripts/repair-designs.js`):

- **H1:** it keeps improving after a design fits and also runs on starts that already fit. It works in two stages: stage 1 fits the design and opens it as wide as possible; stage 2 brings every crease onto a wall and widens within that. A synthetic unit test, not validation data, showed a single stage stalls: with the wall term active, opening wider requires a crease to leave its wall first.
- **H2:** it has no incentive to close folds: once a design fits with creases on walls, only a wider opening scores better.
- **H3:** it uses the true smallest overshoot over turning angles as its signal; tries pair moves when single moves stall; restarts at larger steps (stage 1: 0.02, then 0.4; stage 2: 0.02, then 0.1). The 0.4 pass (about 72° on an angle) exists because fitting designs can form separate islands: in the unit-test box, an equal-panel V fits when folded tighter than about 132° or wider than about 60°, but not between.
- **H4:** two starts are corrected and the better result chosen by the answer key's own ranking function (`P.rankDesigns`) applied to checker measures. The reference answer is never used for selection.

Fold count is not changed by the search. Final acceptance is the canonical wall placement and 721-state assessment.

## Starts (saved records, validation-v1; 768 answers each)

1. Model alone, seeds 17, 29, 43 (`seed-*-adam-raw`).
2. Nearest training answer (`nearest-raw`).
3. Simple start: equal panels, all folds 150°, fold count = fold budget (no model, no data).
4. Combined: model seed + nearest, each given half the score-call cap, best by `P.rankDesigns` among valid results.

## Effort levels

Score-call caps: 25, 50, 100, 200, 400, 800, 1600, 3200. One run to the largest cap with snapshots; a snapshot equals a run capped at that level (deterministic search). Time per answer = search time to the snapshot + final placement and assessment. Model inference and retrieval time are not included (both well under 0.1 ms per answer in validation-v1).

## Measures (per start and cap)

- valid (canonical checker);
- quality = valid + 0 floating creases + opening ≥ 90% of the reference opening (as validation-v1);
- strict quality: same with opening ≥ 99%;
- median opening ÷ reference opening among valid;
- mean and median time per answer, mean score calls used;
- quality by reference fold count.

Reported alongside (D45, D46):
- model alone with no correction (validation-v1);
- current correction at cap 400 (validation-v1: model 91.45% valid / 37.20% quality; nearest 87.76% / 46.35%);
- non-neural multistart (100% / 14.84%, 36.6 ms);
- reference solver (100% / 100%, about 870 ms per answer).

No pass threshold is set (D46). The question for the model is whether its start reaches a given quality in less search than the nearest-answer and simple starts.

## Rules of the run

- Settings above are fixed; all starts, caps and seeds are reported; no seed selection.
- Validation records were already used in development, and this is further development use. The final test split stays untouched.
- Outputs: `results/*.jsonl.gz`, `results/summary.json`, `REPORT.md`. Existing artifacts are not modified.
