# Orifold: where we are

Plain-language status for the project owner. Updated 2026-11-07. For agent-level detail see [HANDOFF.md](HANDOFF.md); for every decision see [DECISIONS.md](DECISIONS.md) (index at the top).

## What we are building

A small AI model, trained from scratch, that designs mechanical folds: give it a sheet and a space, and it proposes a fold pattern. The long-term aim is a general model for mechanical origami, such as foldable solar panels. Today we work with one simple family: a strip of rigid, zero-thickness panels with parallel creases that fold in alternating directions. The task is to pack the strip into a box within a fold budget.

## What exists and works

- **Geometry checker.** It folds a design, checks that it fits the box with a 2% gap, and checks for panel collisions at 721 points along the motion. It is checked independently by a second checker that Codex wrote without seeing our code.
- **Answer key (reference solver).** For any box and fold budget it finds one best design by our agreed rules (most spread, symmetric preferred, every crease on a box wall). It is deterministic, so the same box always gets the same answer. It takes about 2.6 s per box.
- **Dataset v2b.** 2,200 box requests with 6,004 answers, split into training, validation and a final test set that has never been used. You reviewed 96 answers: 90 valid, 6 unsure, 0 not valid.
- **Pages to look at results.** [Fold Count Map](https://claude.ai/artifact/DG4P4RTYrbJixzZAbPjwWj), [Fold Review](https://claude.ai/artifact/4Qr8nQDonaJSsWnYCG5FdA), [Training Runs](https://claude.ai/artifact/XSiQ7WdyeAYu6wD7t21BSE). Designs export to FOLD files and import into Origami Simulator.

## What we have learned about the model

Validation numbers (768 answers). Quality = valid, every crease on a wall, and opening at least 90% of the answer key's.

| Method | Valid | Quality | Time per answer |
| --- | ---: | ---: | ---: |
| Model alone | 39% | 22% | 5 ms |
| Model + short correction search | 91% | 37% | 9 ms |
| Copy nearest training answer + correction | 88% | **46%** | 8.5 ms |
| Simple search with no model | 100% | 15% | 37 ms |
| Answer key (reference solver) | 100% | 100% | about 870 ms |

1. **The model alone is not precise enough.** It gets the right number of folds and roughly the right shape, but our rules make answers tight against the box walls, so small errors make the shape poke out. Most misses are within 3–5% of the sheet length.
2. **It is not the output format.** Optimizing each answer on its own reaches 32/32 precise answers, so precise answers can be represented. The difficulty is learning one network that is precise for every box.
3. **Training harder overfits.** A more precise optimizer fits the training data slightly better and new boxes worse.
4. **Model + correction is fast and usually valid, but loses quality.** The correction makes designs fit; it does not try to keep creases on walls or folds wide open.
5. **Learning adds little in this simple family.** Copying the nearest training answer is about as valid and gives better designs. The question is only three numbers (two box sides and a fold budget), so the training boxes cover it densely. Learning should matter more in larger design spaces.
6. **Every one-sided training penalty became a loophole** (folding tighter, or swinging folds open). Scores must reward the right thing in both directions.

## Current direction

Two questions are tracked separately (D45):
- **Can the model alone produce valid folds?** Your original question (D20). Still open; today's answer is not yet (39%).
- **Can learning make a fast, verified design pipeline better?** The learning-assisted goal below.


**Learning-assisted optimization** ([details](LEARNING_ASSISTED_OPTIMIZATION.md)): the model proposes a starting design, a search repairs and improves it, and a checker verifies the result. If no verified answer is found, the system says so.

## Open decisions for you

1. **Speed vs quality policy.** Aim for 100% quality (D46); the fallback and time policy will be decided after measuring quality against time.
2. **When to move to a richer fold family** (free mountain/valley folds first), where learning should beat lookup.

## Latest finding: why fast answers lose quality

[Correction diagnosis](../experiments/correction-diagnosis-v1/REPORT.md) ([visual page](https://claude.ai/artifact/1SJ2m8NZVwz9s9Skv2YfEp)), from saved validation records:
- **The correction step only makes designs fit.** It never tries to put creases on walls or open folds wide, and it skips designs that already fit.
- **To make designs fit, it often closes folds,** the same shortcut training run 2 found.
- **The model's starts are often too closed** to begin with.
- **Failed corrections get stuck near the box edge;** they are not out of time.
- **Two-fold boxes are the weak spot:** 13–24% quality.
- **Model and nearest-answer starts succeed on different boxes.**

## Next step

Design a quality-seeking correction, tested on saved starts with frozen settings, measuring quality against time. It would pursue the answer key's ranking (walls, then opening) instead of stopping at fit, avoid closing folds, and try both model and nearest-answer starts. No retraining yet; the final test stays untouched. Hypotheses H1–H4 are in the diagnosis report.

## Limits that always apply

Zero thickness; motion checked at sampled points (not a continuous proof); no layer order, materials or manufacturability. See [LIMITATIONS.md](LIMITATIONS.md).
