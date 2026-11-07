# Correction diagnosis v1: plan (predeclared 2026-11-07, before any analysis)

Roadmap step 2 (D43), quality emphasis (D46). **Analysis of saved records only**: no training, no new inference, no new correction runs, no final-test use.

## Inputs (immutable, from validation-v1)

- `experiments/validation-v1/results/seed-{17,29,43}-adam-{raw,repair}.jsonl.gz` (the leading neural recipe, D42)
- `experiments/validation-v1/results/nearest-{raw,repair}.jsonl.gz` (retrieval baseline)
- `experiments/validation-v1/results/reference-cached.jsonl.gz` (answer key)

These are validation records already used in development. Conclusions from this diagnosis may shape the next correction design, which means further development use of validation; the final test split stays untouched.

## Definitions (as validation-v1)

- **valid** = the canonical checker passes (rules, 2% fit, contacts at 721 states).
- **quality** = valid + 0 floating creases + opening ≥ 90% of the reference opening for that answer.
- Reported **model-alone** (raw) and **model + correction** (repair) side by side (D45).

## Questions

1. **Where does each answer end up?** Classify every (method, answer) by raw valid/quality and repaired valid/quality. Also check whether correction ever loses a raw success.
2. **Why do repaired answers fail validity?** Score-cap exhaustion vs stopping early (stuck); collision vs poking out; overshoot size at the best turn.
3. **Why do valid repaired answers miss quality?** Floating creases only, opening below 90% only, or both. Does correction itself cause the loss? Compare raw vs repaired opening and floating counts on the same answer, and how often the raw start already lacked quality.
4. **How large are the edits?** Panel and angle edits for answers that end with vs without quality.
5. **Where do problems concentrate?** By reference fold count, box kind (short/long), and budget step (fewest, +1, +2).
6. **Retrieval vs neural start.** On the same answers, which start gives quality after correction more often, and in which categories.
7. **Visual examples.** For each main category, show 3 answers as raw → corrected → reference side views (deterministic choice: the first 3 by answer id after sorting).

## Outputs

- `results/diagnosis.json` (all counts)
- `REPORT.md` (findings in plain language, measured vs hypothesis labelled)
- A visual page of paired examples

## Not in scope

- Changing correction, retraining, choosing seeds, or new thresholds. The quality aim is 100% with no fixed threshold yet (D46).
