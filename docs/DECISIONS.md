# Project decisions

Current as of 2026-11-04. Later explicit user decisions supersede this record; keep the record synchronized when that happens. Distinguish agreed scope from implementation recommendations.

## D01 — purpose and problem (agreed)

Orifold is a personal learning/research project: train a small model from scratch to propose useful mechanical folding designs, and measure its contribution against conventional methods. The user explicitly moved away from artistic text-to-animal generation. The scientific question is whether learning can propose good designs or initialize optimization faster, not whether any AI output automatically constitutes progress.

## D02 — zero-thickness rigid panels only (explicit user restriction)

The user stated: "We will not add thickness adoption until I decide to do it. We will only do 0 thickness designs until then."

All current and planned design/evaluation work uses zero-thickness rigid flat panels connected by ideal hinges. No continuously bending panels, thickness compensation, shifted hinge axes, trimming for thickness, hinge hardware, or material mechanics. Do not start a thickness adapter or keep one as an automatic roadmap step. The user must explicitly reopen it. Faceted overall shapes are compatible with flat panels, but general tubular or closed-loop structures are not current capabilities.

Rationale: the folding geometry is already complex enough. Focus effort on compatibility, motion, intersections, and inverse design.

## D03 — target envelope, not minimum scalar volume (current formulation)

Given fixed sheet dimensions and a limited panel/crease budget, find crease positions and a prescribed motion whose final configuration fits maximum length/width/height bounds. This is packing, not exact shape matching. Translation is permitted for final fit; box orientation is fixed. *Amended by D30 (2026-11-05): the final shape may also turn about the hinge axis.* Motion need not stay inside the storage box unless a future task explicitly adds that requirement.

Material volume is zero by assumption. A 3D configuration can still have a nonzero enclosing box; a fully flat-folded configuration can have zero height. Do not minimize the product of box dimensions as the sole objective: zero height would make many designs trivially tie. Preserve the finite panel budget to avoid arbitrarily many tiny folds. *Amended by D13 (2026-11-05): the fixed budget is replaced by a variable fold count with fewest folds preferred.*

## D04 — current representation and evaluator (implemented)

Four panels, three parallel hinges, alternating signed rotations. A prescribed simultaneous linear hinge schedule is not proof of a single mechanical degree of freedom. Solver panel lengths are at least 5% of sheet length. The geometry reference is `src/accordion.js`; detailed rules are in GEOMETRY.md and OPTIMIZATION.md.

Non-adjacent touch/overlap is conservatively blocked except at the exactly fully closed ideal flat-stack endpoint. This policy may reject workable partial stacks and does not validate layer order. Numerical experiment results must carry those limitations. Width cannot contract in this family.

## D05 — strict labels and transparent metrics (implemented)

Use strict numerical box fit for optimizer-produced training labels. The first 1%-tolerance pilot showed the optimizer using slack to reduce rotation; the strict rerun solved all 80 evaluator-feasible pilot requests. Keep both reports. A future learned-model target of >=95% success with at most 1% per-axis overflow is provisional, not an achieved result; always report strict success separately.

The secondary optimizer objective is normalized squared hinge rotation. It is a mathematical preference, not physical energy or strain. Inactive hinges are allowed and common in current solutions.

## D06 — incremental learning approach (working technical plan)

Complete a small supervised accordion experiment before broadening the geometry. Recommended first architecture: approximately 10k–100k parameter MLP, initialized from scratch, using Python/PyTorch. These are reasonable starting choices, not permanently fixed user requirements. Verify geometry parity before using a Python evaluator. Compare network-only and network-initialized search with existing equal-panel, random-search, and numerical-optimizer baselines.

Later scope can include Miura-ori or other zero-thickness rigid-foldable families, then compatible unit combinations and eventually variable crease connectivity. Arbitrary crease generation is a research ambition, not a demonstrated capability. A fixed mathematical loss is not automatically a GAN discriminator.

## D07 — evidence and budget (measured versus estimated)

The user supplied an accordion photo and reported a 5 × 10 cm closed footprint, agreeing with the reference example. Dimensions are user-reported, not measured from the photo. The photo is in the earlier chat, not the repository; VALIDATION.md contains the sufficient observation record. This is a limited check, not general physical validation. Further material/thickness measurements are not required to continue the agreed project.

The original $50 and 2–4 part-time weeks were planning estimates, not a spending authorization or a runtime measurement. The strict pilot measured 142.50 ms mean per feasible optimizer request; 10,000 comparable solves extrapolate to about 24 sequential CPU-minutes. The first training loop subsequently measured 1.62 seconds; see LEARNING.md. Use local CPU first; no additional paid compute resource has been provisioned.

## D08 — collaboration and persistence (explicit preference)

The user wants the agent to carry out agreed next steps rather than repeatedly end with offers to continue. They asked for repository-based continuity across chats. Record current state and next actions, distinguish completed jobs from planned work, and do not require the user to repeat already settled goals or scope. Nothing is currently waiting on a user answer.

## D09 — preserve the failed first learning baseline (measured outcome)

The first 17,926-parameter supervised MLP was trained from scratch on 700 requests, selected on 150 validation requests, then evaluated once on 150 test requests. It passed 0 strictly and 3 within 1%. The full optimizer passed 150; short optimization passed 138, versus 140 when initialized with the network. Do not present this as a successful standalone generator or a reliable demonstrated neural advantage.

The v1 dataset, checkpoint, curves, and test results remain immutable evidence. A later audit (D10) found the training labels inconsistent, so this result says little about whether learning can work; it mainly validated the tooling. The earlier "add a differentiable fit term" recommendation is superseded by D11.

## D10 — v1 dataset is not a valid test of the approach (measured, 2026-11-04)

Raised by the user ("it looks like 3 random folds on a rectangular surface") and confirmed by audit:

- Target boxes were derived from random witness folds plus 1–4% slack, not from packing needs. The narrow/tall half uses a fixed template (bend one end ~90°); its boxes are ~93% of sheet length tall, and most labels are a single fold.
- Labels hug the box boundary (median tightest-axis slack 1.25%) because the tie-break minimises rotation until a limit is hit. Only 13/1,000 labels are compact flat stacks; about 70% leave a hinge unused.
- Re-solving 40 training requests with another seed gave a substantially different design 90% of the time (median RMS parameter difference 0.345) and found lower rotation than the stored label in 24/40. Evidence: `results/label-consistency-audit-2026-11-04.json`, script `scripts/audit-label-consistency.js`.

Conclusion: every label passes the evaluator, but the labels are close to arbitrary picks from a large set of valid designs, so supervised imitation had no consistent target. v1 validated the pipeline (geometry parity, splits, evaluation, reproducibility), not the approach. Keep v1 as a record; do not reuse its dataset for the next experiment.

## D11 — current stage: design the experimental setup first (user direction; discussion ongoing)

The user's view, agreed by the agent: at this early stage the project is about designing the overall setup, independent of training or dataset scale. That covers the target result of each experiment, objective criteria for creating datasets, and a definition of what a valid origami design is.

Agent recommendations recorded for discussion (not yet decided):

- Define validity in layers, independent of the fold family: hard validity (rigid, connected, no self-intersection); task satisfaction (fits the box, with an explicit margin); quality ranking (a tie-break that picks a clear winner); explicitly out of scope (LIMITATIONS.md).
- Add dataset acceptance checks that work at any scale: label consistency across seeds, coverage of the request space, requests sampled independently of solutions, validity checked independently of the label producer.
- Write one experiment-specification template that every experiment fills in.
- First evidence for the accordion: map the whole request space (box length and height relative to sheet length; width only decides feasibility) on a grid.
- Candidate next learning approaches: a nearest-neighbour baseline, and training on a geometric loss without labels.

The user said this discussion is not finished. Do not start v2 training before the specification is agreed.

## D12 — communication and visuals (explicit user preference)

The user is not an ML engineer and is learning through this project. Explain what the agent is doing in plain language, introduce concepts as they arise (docs/GLOSSARY.md), and present trade-offs between choices. Visual presentation of datasets and outcomes is strongly preferred. Rules are in AGENTS.md, "Communicating with the user".

## D13 — variable fold count, fewest folds preferred (user decision, 2026-11-05)

Replace the fixed four-panel budget with a variable number of folds, preferring the fewest that achieve the task. Removing the limit outright was rejected because with zero thickness extra folds are free, which makes packing trivial. A minimum panel size (currently 5% of sheet length, so at most 20 panels) still prevents arbitrarily tiny panels. Whether to add an explicit lower cap is open.

## D14 — quality measures (user decision, 2026-11-05)

Among valid designs that fit, designs are judged on:

- **Geometric aesthetics** (order built into the design, not visual style): proportion (simple panel ratios), angle consistency (few distinct angles), symmetry (crease pattern and folded shape), economy (no unused creases), repetition (for larger patterns), with description length as a summary.
- **Function:** compactness, how well the design fits the box, smallest gap between non-adjacent panels during folding, fewer folds, and the motion's swept envelope.

v1 context: of 1,000 v1 labels, 13 have equal panels, 13 a uniform angle, 21 mirror-symmetric panels, and 192 use every crease. How these measures are ordered or weighted into a single ranking is still open.

## D15 — visualisation built on demand (user decision, 2026-11-05)

Use the recommended routes, built only when a task needs them:

- **Main:** a generated report page per experiment (request-space map, fold thumbnails, method comparisons), opened in a browser.
- **Single designs:** the existing interactive viewer, extended as needed.
- **Independent 3D check:** FOLD export to an external origami simulator, once export exists.

Notebooks are not planned.

## D16 — ranking by strict priority order (user decision, 2026-11-05)

Valid designs that fit are ranked by a strict priority order, not a weighted score: valid and fits → fewest folds → most ordered → largest smallest gap → smallest swept envelope → most compact. Each step only breaks ties left by the previous one. Compactness therefore acts as a tie-break, not a goal. Detailed sub-definitions are in EXPERIMENT_SPEC.md section 5.

## D17 — general geometry model; no application-specific requests (user decision, 2026-11-05)

The long-term aim is a general AI model of mechanical (non-artistic) origami geometry; foldable solar panels are an example of the kind of object, not a target application. Do not tailor requests to one use. Requests come from a systematic grid over sheet and box shape ratios, including tight, zero-fold and impossible cases, and are never derived from random folds.

## D18 — 2% fit margin (user decision, 2026-11-05)

A design fits only if every final dimension is at most 98% of the box dimension. Strict boundary fit is no longer the acceptance rule for new experiments; v1 results remain as recorded.

## D19 — complexity only after the pipeline is proven (user decision, 2026-11-05)

Next family: parallel creases with a variable count and alternating fold directions. Free fold directions, non-parallel creases and Miura-type patterns come only after this pipeline is proven end to end.

## D20 — success criterion: the model outputs valid fold patterns (user decision, 2026-11-05)

For a given sheet and box size, success means the trained model outputs a valid fold pattern. Validity is checked mathematically by the evaluator and visually by the user on a review page built for the experiment. **The user's verdict decides success.** Baselines (hand rule, nearest neighbour, solver) are still reported for context, so the project stays candid about whether learning added value, but they are not success gates.

## D21 — fold count 0 to 11 (agent decision delegated by the user, 2026-11-05)

Allow 0 to 11 folds (1 to 12 panels), with each panel at least 5% of sheet length.

- **Why allow 0:** "no fold needed" is the correct fewest-fold answer when the flat sheet fits, and tests that the model does not fold unnecessarily.
- **Why cap at 12 panels:** enough for repetition and rhythm, small enough for a fixed-size model output and a tractable reference search, and below the 20 implied by the minimum panel size.

Revisit if the request-space map shows many requests that need more than 11 folds.

## D22 — proposed sub-definitions accepted (user decision, 2026-11-05)

The user accepted the agent's proposed details in EXPERIMENT_SPEC.md: the 1° active-crease threshold, the order-score formula, the dataset-acceptance thresholds, and the 95% evaluator pass rate as a reference point (the user's visual verdict still decides success). The grid ranges were fixed for the first map (EXPERIMENT_SPEC.md, "Evidence so far").

## D23 — swept-area ties (user decision, 2026-11-05)

In the ranking, swept-area differences below 1% of sheet length² count as ties, so compactness decides and a clean 180° flat fold beats a near-flat one. Effect on the map: 203 of 469 one-fold answers are now exact 180° folds (previously 0).

## D24 — weight requests toward short boxes (user decision, 2026-11-05)

Training and test requests are weighted toward boxes shorter than about half the sheet, where 2+ folds and varied designs occur. Some easy and impossible cases are kept. The concrete distribution is in EXPERIMENT_SPEC.md section 6.

## D25 — independent verification by Codex (practice, 2026-11-05)

Codex wrote `scripts/independent-check.js` from the spec alone, without reading `src/packing.js`; it imports no project code. It agreed with all 701 solved map designs on rules, 2% fit, contacts at 721 states (505,421 sampled states) and fold/order scores, both before and after the solver fix. Use it on every reference dataset before training. This is sampled validity, not continuous collision proof or ranking optimality.

## D25b — record: near-parallel panels diagnosis and symmetry test (2026-11-05; resolved by D26–D29)

**Near-parallel panels (raised by the user 2026-11-05, "looks like reward hacking").** Designs with 3+ folds pack long, nearly parallel panels with small gaps. Diagnosis, measured on 59 map cells and 6 sample boxes (comparison page https://claude.ai/artifact/5sBcZPDnPoHRH3Cn3TySYK):
- **This is specification gaming, not a solver bug.** The solver follows the D16 ranking exactly; the ranking does not ask for spread.
- **Fewest folds (rank 1) forces long panels.** In a short box, long panels can only fit nearly parallel.
- **The order score (rank 3) favours equal panels**, which excludes tapered designs. Free-form search with tapered lengths found 1.1–2.8× larger gaps at the same fold count, at order scores 8–9 instead of 5.
- **Moving gap ahead of order within the current families changed nothing** (59/59 cells identical): the families themselves are the limit.
- **Zero thickness makes near-touching panels cost nothing.** The gap is the only thing resisting it, and it ranks fourth.

Options:
- **(a)** A minimum-clearance validity rule. Note its interaction with the flat-stack exception and with D02: it is not thickness modelling, but it is close in spirit.
- **(b)** Rank spread (gap or opening angle) before order, and widen the families to include tapered panels.
- **(c)** Accept more folds in exchange for spread.

Awaiting user decision.

**Update 2026-11-05, user direction:** no clearance rule. Consider B (spread) and C (trade folds for spread), defined carefully enough to scale to the north star. Symmetry is not always preferred; different shapes have different needs.

**User hypothesis tested** ("equal panels matter when their number is even; that gives symmetry"); measured with `scripts/symmetry-check.js` for 2–8 panels:
- A folded shape is symmetric when panel lengths **and** fold angles are both palindromic (read the same from either end). Equal panels are just one case of this.
- Panel count decides the kind: **even → mirror symmetry, odd → point (180° rotational) symmetry.**
- Breaking angle symmetry (first fold different, as most current reference designs do) removes symmetry entirely for 3+ panels, even with equal panels.
- Tapered panels are never symmetric.
- Consequence: the current order score treats palindromic lengths alone as symmetric, which is wrong; it must also check angles.

Decided since: D26 (fold budget), D27 (spread), D28 (any symmetry). Still open: the **tie band**, i.e. how much spread to give up for symmetry. Designs within X% of the best smallest opening angle count as tied, then the symmetric one wins. Agent suggests X = 10%; awaiting the user.

Original agent proposals:
- **Fold budget as a request input** (handles C without an exchange rate). Reference answers for budgets from the minimum up to minimum + 2 folds; the user or application picks the budget.
- **Within a budget: spread before order** (B), measured as the smallest opening angle between neighbouring panels (180° − fold angle), with gap as a secondary measure.
- **Symmetry as a preference band:** designs within about 10% of the best spread count as tied, then prefer symmetric designs. Later, symmetry preference could become a request input, since it is not always wanted.
- **Weighted averages:** only among continuous quality measures inside the hard rules, with stated weights. Never for validity or fit.

## D26 — fold budget is a request input (user decision, 2026-11-05)

Each request states a maximum number of folds. The reference answer is the best design within that budget. Reference answers are produced for budgets from the minimum feasible fold count up to the minimum + 2. This replaces "fewest folds" as rank 1 and avoids an exchange rate between folds and spread.

## D27 — spread before order (user decision, 2026-11-05)

Within the fold budget, prefer the most spread design, measured as the smallest opening angle between neighbouring panels (180° minus fold angle). The smallest non-adjacent gap is the secondary spread measure. Spread ranks before the order score. Reference families must include unequal (e.g. tapered) and symmetric non-equal panel patterns.

## D28 — any symmetry counts (user decision, 2026-11-05)

Mirror symmetry (even panel counts) and point symmetry (odd panel counts) are both acceptable. Symmetry means palindromic panel lengths **and** palindromic fold angles (measured in `scripts/symmetry-check.js`). The order score must be corrected to check angles too. Symmetry is not universally preferred for future shapes; it may later become a request input.

## D29 — 10% spread tie band (user decision, 2026-11-05)

Designs whose smallest opening angle is within 10% of the widest valid design (same request, same budget) count as equally spread. Among those, symmetric designs win, then fewer folds, then order score. The full ranking is in EXPERIMENT_SPEC.md section 5 and supersedes the D16 order and D21's "fewest folds first".

## D30 — the final shape may turn about the hinge axis to fit the box (user decision, 2026-11-05)

Panel 1 stays fixed as the reference frame for the folding motion. When fitting the box, the final folded shape may be turned by any angle about the hinge (y) axis, which is the side-view rotation, and translated. Each design records its `placement` angle, and fit is checked at that angle. The motion is still not required to stay inside the box.

Motivation (measured on map r4): the old rule produced 27 artificial "impossible" boxes, 492 of 1,940 folded answers with a 5% "foot" first panel, and symmetry broken by the forced-flat first panel.

Consequences:
- Box (length a, height b) and (b, a) are the same problem: the map is checked for mirror consistency (`scripts/check-map-mirror.js`).
- Dataset splits must group each box with its swapped partner.
- The hand rule may stand its flat stack upright.
- Option C (standing the sheet width upright) was not adopted; with parallel creases it adds little.

## D31 — roomy boxes keep "most spread" (user decision, 2026-11-05)

Where a box has room, the most spread design wins (a gentle fold that uses the space), not the most compact one. Compactness stays a late tie-break.

## D32 — no minimum fold angle rule (user decision, 2026-11-05)

No rule against small fold angles. Evidence supporting this (`scripts/check-switch-creases.js`): merging away any fold under 10° breaks 287/287 such answers in map r5. Under strict alternating fold directions (D19), a near-flat crease is a **direction switch**: it lets two consecutive real folds turn the same way (e.g. a U-shape `[45, 5, 5, 45]` with angles `[89°, 1°, 89°]`). These creases are workarounds for the alternation rule, not fake folds.

## D33 — keep alternating fold directions for v2 (user decision, 2026-11-05)

Fold directions stay strictly alternating for experiment v2; 1° direction-switch creases are accepted (D32). Free mountain/valley assignment is the first candidate upgrade once v2 has trained successfully.

## Open questions (unresolved; do not treat as decided)

None at this snapshot. Resolved and kept for the record: free fold directions (D33), dead creases (D32), first panel horizontal (D30).
