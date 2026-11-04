# Project decisions

Current as of 2026-11-04. Later explicit user decisions supersede this record; keep the record synchronized when that happens. Distinguish agreed scope from implementation recommendations.

## D01 — purpose and problem (agreed)

Orifold is a personal learning/research project: train a small model from scratch to propose useful mechanical folding designs, and measure its contribution against conventional methods. The user explicitly moved away from artistic text-to-animal generation. The scientific question is whether learning can propose good designs or initialize optimization faster, not whether any AI output automatically constitutes progress.

## D02 — zero-thickness rigid panels only (explicit user restriction)

The user stated: "We will not add thickness adoption until I decide to do it. We will only do 0 thickness designs until then."

All current and planned design/evaluation work uses zero-thickness rigid flat panels connected by ideal hinges. No continuously bending panels, thickness compensation, shifted hinge axes, trimming for thickness, hinge hardware, or material mechanics. Do not start a thickness adapter or keep one as an automatic roadmap step. The user must explicitly reopen it. Faceted overall shapes are compatible with flat panels, but general tubular or closed-loop structures are not current capabilities.

Rationale: the folding geometry is already complex enough. Focus effort on compatibility, motion, intersections, and inverse design.

## D03 — target envelope, not minimum scalar volume (current formulation)

Given fixed sheet dimensions and a limited panel/crease budget, find crease positions and a prescribed motion whose final configuration fits maximum length/width/height bounds. This is packing, not exact shape matching. Translation is permitted for final fit; box orientation is fixed. Motion need not stay inside the storage box unless a future task explicitly adds that requirement.

Material volume is zero by assumption. A 3D configuration can still have a nonzero enclosing box; a fully flat-folded configuration can have zero height. Do not minimize the product of box dimensions as the sole objective: zero height would make many designs trivially tie. Preserve the finite panel budget to avoid arbitrarily many tiny folds.

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

The v1 dataset, checkpoint, curves, and test results remain immutable evidence. Next recommendation: develop a differentiable endpoint-fit term and geometry-based validation metrics before enlarging the network, with a fresh predeclared test cohort. The existing hard contact evaluator remains independent. This is a proposed next experiment, not an already implemented fix.
