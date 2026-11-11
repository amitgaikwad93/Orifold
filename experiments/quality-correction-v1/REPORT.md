# Quality correction v1: report

Plan frozen in [PLAN.md](PLAN.md) at commit `84da33d` before the run. 768 validation answers per start; saved starts from validation-v1; no training, no new model inference, final test untouched. Runner `scripts/run-quality-correction.js`, summary `scripts/report-quality-correction.js`, evidence in `results/` (`summary.json`, one `*.jsonl.gz` per start). Chart: https://claude.ai/artifact/L5NfP5iaYGtvLmSptkGUi8 (copy in `results/`).

Quality = valid + 0 floating creases + opening ≥ 90% of the reference opening. Strict quality uses ≥ 99%.

## Results (valid % / quality %, mean ms per answer)

| Start | 100 steps | 400 steps | 1,600 steps | 3,200 steps |
| --- | --- | --- | --- | --- |
| Model + nearest (half the steps each; mean of 3 seeds) | 97 / 60, 21 ms | 100 / 74, 48 ms | 100 / 85, 131 ms | **100 / 92, 207 ms** |
| Nearest training answer | 94 / 55, 15 ms | 97 / 67, 41 ms | 98 / 86, 110 ms | 98 / 88, 162 ms |
| Model (mean of 3 seeds) | 93 / 46, 14 ms | 99 / 61, 35 ms | 100 / 78, 97 ms | 100 / 84, 145 ms |
| Simple start (no model, no data) | 76 / 18, 18 ms | 90 / 28, 51 ms | 97 / 37, 182 ms | 98 / 39, 303 ms |

Alongside (validation-v1, measured in an earlier session):
- **model alone:** 39.1% valid / 21.7% quality (D45: unchanged by this experiment);
- **old correction, 400 steps:** model 91.5 / 37.2 (8.6 ms); nearest 87.8 / 46.4 (8.5 ms);
- **multistart:** 100 / 14.8 (36.6 ms);
- **reference solver:** 100 / 100 (about 870 ms per answer).

Other measurements at 3,200 steps:
- **Per seed (model start):** quality 82.3 / 85.3 / 83.1%; combined 91.4 / 92.7 / 91.0%.
- **Strict quality (≥ 99% opening):** model 66–67%, nearest 65%, combined 74–75%.
- **Valid with no floating creases:** model 98%, nearest 96%, simple 90%.
- **Median opening ÷ reference among valid:** 1.00 (model, nearest), 0.83 (simple).
- **Mean score calls actually used:** about 1,100 (most searches finish before the cap).
- **Quality by reference fold count** (combined, seed 17): 0 folds 100%, 1 fold 97%, 2 folds 94%, 3 folds 93%, 4 folds 37%. Model start alone: 2 folds 69%, 4 folds 69%. Nearest alone: 2 folds 87%, 4 folds 60%.

## Reading (measured unless marked)

1. **H1–H3 supported.** Following the answer key's priorities after fit, with a long-step pass and pair moves, raises quality from 37–46% to 84–88% for single starts, and validity to 98–100%.
2. **H4 supported.** Two starts chosen by the answer key's own ranking on checker measures reach 92%, better than either start with the same total steps.
3. **The start matters.** The simple start stays at 39% quality even at 3,200 steps and takes longer, so data-derived starts carry real information.
4. **The model start does not beat retrieval.** The nearest-answer start is ahead at every cap from 25 to 3,200 steps on quality. The model start is ahead on validity (100% vs 98%) and adds answers retrieval misses.
5. **Quality is still rising at the largest cap,** and four-fold answers are the weak spot for the combined method. *Hypothesis:* splitting steps in half starves four-fold searches, which have more numbers to adjust.
6. **Timing caveat.** Times were measured with four processes in parallel on a shared machine; the earlier methods and the reference solver were timed in another session. Treat cross-method time comparisons as approximate. At about 210 ms the combined method is roughly 4× faster than the reference solver's 870 ms for 92% rather than 100% quality.

## Not established

- Generalization beyond validation: these records were used in development; the final test is untouched.
- That learning is needed: retrieval is as good or better here.
- Any continuous-motion or physical claim (LIMITATIONS.md).

## Suggested next steps (not run)

- Give four- and five-fold answers more steps, or allocate steps by fold count; extend caps to see where quality levels off.
- Let the correction also try one fold fewer or more than the start, since the fold count is fixed today.
- For the model: train it to give starts that the correction finishes faster (roadmap step 4), judged against retrieval at equal time.
