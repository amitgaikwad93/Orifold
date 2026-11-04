# 100-request numerical-optimization pilot

Run on 2026-11-04 using the existing CPU environment. No GPU, external model API, or additional paid compute resource was provisioned. These are numerical results under the model's explicit assumptions, not physical certification or neural-network results.

## Strict-fit comparison

The 100 requests comprise 80 evaluator-feasible requests with withheld witness designs and 20 impossible-width requests. Each search method receives only the sheet and box dimensions. Of the 80 feasible requests, 40 have wider boxes and 40 have narrow/tall boxes that cannot fit the equal-panel baseline.

| Method | Solved feasible requests | Wide boxes | Narrow/tall boxes | Correctly rejected impossible width | Median time per feasible request | P95 time |
| --- | --- | --- | --- | --- | --- | --- |
| Equal panels, fully closed | 40/80 | 40/40 | 0/40 | 20/20 | 2.62 ms | 4.47 ms |
| Seeded random search | 72/80 | 40/40 | 32/40 | 20/20 | 136.73 ms | 173.26 ms |
| Differential evolution | 80/80 | 40/40 | 40/40 | 20/20 | 133.89 ms | 190.01 ms |

All 80 accepted differential-evolution designs passed strict numerical box fit and had no prohibited contacts at 721 sampled configurations. None used the special ideal flat-stack endpoint contact exception. Eight random-search requests exhausted their budget; they are known feasible from their witnesses, not physically impossible.

Random search and differential evolution each scored 984 candidates per feasible request, including the same three canonical seeds. The eight best distinct candidates were rechecked at the denser motion resolution. The equal-panel baseline evaluates one candidate and is intentionally cheap. This is a single fixed-seed comparison, not a statistical guarantee of 100% performance or proof of global optimality.

Mean solver time was 142.50 ms per feasible request. The complete strict comparison, including generation, warm-ups and all three methods, took 23.43 seconds. Raw input generation and witness checking took 0.33 seconds.

Hardware: AMD EPYC 9V74 CPU, Linux x64, Node v24.22.1, one sequential Node process. The environment exposed 3 logical CPUs and reported available parallelism 2; these values do not guarantee a dedicated allocation. Timings will vary on other machines and with load.

## Why there are two reports

The first run used the proposed 1% per-axis acceptance tolerance. Differential evolution solved 80/80 within that allowance, but only 43 outputs passed strict numerical fit. Since the secondary objective minimizes hinge rotation, the solver used the allowed slack. This was consistent with that objective, but unsuitable as an implicit guarantee that a requested box will contain every output exactly.

The solver default was changed to strict fit and the same 100 requests were rerun. It solved 80/80 strictly. Retain both reports to show this decision rather than hide the tolerance effect:

- [Strict-fit raw report](../results/pilot-2026-11-04-strict.json)
- [Initial 1% tolerance raw report](../results/pilot-2026-11-04-tolerance-1pct.json)

Each record contains requests, withheld witnesses, solver seeds/settings, returned designs, sampled validation summaries, timings, and failures. The current code reproduces the designs with the corresponding tolerance argument; runtime measurements are not expected to reproduce exactly.

## What this means for learning and cost

At the measured mean, 10,000 comparable differential-evolution solves would take approximately 24 sequential CPU-minutes. This is an extrapolation, not a completed dataset or a budget for arbitrary origami. Witness generation, serialization, larger search budgets, harder distributions, and future geometry increase that cost. A 1,000-example pilot training set would require approximately 2.4 minutes of solver work at this rate.

The simple equal-panel rule already solves half this deliberately balanced test set. In 60 of the 80 optimized outputs, at least one nominal hinge remains inactive (angle zero), which is permitted by the current capability contract. Success here does not mean the solver has generated complex new origami. A learned model must beat or usefully initialize a fast conventional solver and simple geometric baselines; valid output alone will not demonstrate a benefit.

Proceed with a small CPU training experiment using strict-validated labels, independent request seeds, and frozen train/validation/test splits. Do not use these 100 pilot requests as a held-out model benchmark after tuning against them. The 95% target applies to the future learned model and has not yet been achieved by a trained network.

## Reproduction and limits

See [OPTIMIZATION.md](OPTIMIZATION.md) for the objective, parameterization, contact review and commands. The algorithm's source is `src/optimizer.js`; request generation is `src/pilot-requests.js`; `scripts/pilot.js` records the comparison. `npm test` also re-evaluates the stored strict designs.

Remaining limits: zero thickness, no layer-order verification, no continuous collision guarantee, no forces/material model, no proof of a single-actuator mechanism, and no requirement that the motion remain inside the storage box. Broader physical validation stays open.
