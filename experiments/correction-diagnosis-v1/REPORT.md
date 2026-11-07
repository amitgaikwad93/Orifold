# Correction diagnosis v1: report

Plan predeclared in [PLAN.md](PLAN.md) (commit `f7fd9b7`) before analysis. Saved validation-v1 records only: no training, inference or new correction runs; the final test is untouched. Script: `scripts/diagnose-correction.py`. Results: `results/diagnosis.json`, `results/attribution.json`, `results/examples.json`. Visual page: https://claude.ai/artifact/1SJ2m8NZVwz9s9Skv2YfEp (copy in `results/`).

Quality = valid + 0 floating creases + opening ≥ 90% of the answer key's. 768 validation answers per method.

## Where answers end up

| Method | Quality | Valid, low opening | Valid, floating | Valid, both | Invalid |
| --- | ---: | ---: | ---: | ---: | ---: |
| Model seed 17 + correction | 289 | 228 | 103 | 80 | 68 |
| Model seed 29 + correction | 290 | 230 | 89 | 97 | 62 |
| Model seed 43 + correction | 278 | 249 | 105 | 69 | 67 |
| Nearest answer + correction | 356 | 181 | 94 | 43 | 94 |

Model alone (D45): 37.6–40.2% valid, and 161–172 of 768 answers already have quality before correction. Correction never loses a raw success.

## Findings (measured)

1. **Correction only targets fit.** Designs that already fit pass through unchanged. 128–141 model answers and 154 retrieval answers are valid but below quality and are never improved.
2. **Correction closes folds to fit.** Among corrected, valid, low-opening answers:
   - model starts: "start fine, correction closed folds" 97–106; "start already too closed, correction did not close" 104–125; both 21–37;
   - nearest-answer starts: 118 of 145 are "start fine, correction closed folds".
3. **Model starts are often too closed.** That is the model's own bias, not caused by correction.
4. **Correction ignores walls.** 109–116 corrected model answers and 55 corrected retrieval answers are valid with floating creases.
5. **Remaining invalid answers are stalled, not out of budget.** 58–93 per method stopped below the 400-evaluation cap (at most 4 hit it). Their best-turn overshoot has a median of 1.0–1.5% of the sheet; 23–47 are within 1%. The coordinate pattern search stalls near the box edge.
6. **Two-fold answers are the weak spot.** 303 answers; quality 12.5–14.2% from model starts, 24.1% from retrieval. Four folds: 0–3.8% (model), 13.5% (retrieval). Three folds: 23–32% (model) vs 65.2% (retrieval).
7. **Starts are complementary.** Per seed, model-only quality 78–84 answers, retrieval-only 144–159, both 197–212, neither 328–334. The union is about 57%.

## Hypotheses for the next correction design (not tested)

- **H1:** make correction pursue the answer key's own ranking (creases on walls, then widest opening within the band) rather than stopping at fit, and also run it on starts that already fit. *Targets findings 1, 2 and 4.*
- **H2:** forbid or penalize closing folds below the start's opening while fitting, balanced in both directions (lesson from runs 2–4). *Targets finding 2.*
- **H3:** use a search that moves several numbers at once, or a final wall-snapping step, to escape near-edge stalls. *Targets finding 5.*
- **H4:** correct several starts (model, retrieval) and select by checker measures that need no answer key (validity, floating count, opening). *Targets finding 7.* The reference opening must not be used as a selector.
- Any test of these must use frozen settings, report model-alone results alongside (D45), and measure quality against time (D46).
