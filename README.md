# Orifold

An experimental project to train small neural models from scratch for mechanical origami inverse design: given a sheet and a target packing box, propose a folding structure and ultimately export a `.fold` file.

## Continuing in a new chat

Start with [AGENTS.md](AGENTS.md), then [the current handoff](docs/HANDOFF.md) and [project decisions](docs/DECISIONS.md). The handoff records completed work, verification, runtime status, and concrete next steps. Update it after each substantive session.

At the last handoff, the implementation is on `codex/phase-1-accordion` in [draft PR #1](https://github.com/amitgaikwad93/Orifold/pull/1), not yet on `main`. Check current PR status before choosing a branch.

Scope: **zero-thickness rigid flat-panel designs only**. No thickness adaptation or hardware until the user explicitly reopens that scope. Target-box dimensions are separate upper bounds for packing, with a limited panel budget; scalar volume minimization is not the objective.

## Current stage

Phases 1–3: geometry, numerical optimization, and the first CPU-trained neural model are implemented. The first network is not yet a usable standalone generator: it passed 0/150 strict-fit test requests and 3/150 with a 1% allowance. The full optimizer passed 150/150 on the same held-out requests. The failed learning baseline, dataset, checkpoint, and comparisons are preserved for the next experiment.

- [Project plan, capability contract, milestones, and budget](docs/PLAN.md)
- [Geometry equations, contact policy, and limitations](docs/GEOMETRY.md)
- [Validation results and user-reported paper comparison](docs/VALIDATION.md)
- [Optimizer design and contact-policy review](docs/OPTIMIZATION.md)
- [Measured pilot results and compute estimate](docs/PILOT_RESULTS.md)
- [First trained model: results, failure analysis, and reproduction](docs/LEARNING.md)
- [Four-panel accordion experiment](demo/accordion.html)
- [Original one-hinge experiment](demo/index.html)

## Run locally

The Node geometry/solver needs no npm dependencies or build step. Python training dependencies are documented in [LEARNING.md](docs/LEARNING.md). With Python 3 installed, run from the repository root:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000/demo/accordion.html. The HTML also works directly in browsers that allow local scripts.

Run geometry tests using Node 18 or newer:

```sh
npm test
```

Solve a 20 × 10 cm sheet into a 3 × 10 × 18 cm target box:

```sh
npm run solve -- examples/narrow-box.json
```

Reproduce the strict 100-request comparison (about 23 seconds on the recorded environment):

```sh
npm run pilot -- artifacts/pilot-strict.json 0
```

The numerical optimizer solved 80/80 witness-validated pilot requests with strict fit; random search solved 72/80 and an equal-panel stack 40/80. All methods rejected 20 impossible-width requests. These are restricted numerical results, not neural-network or manufacturing results.

## What a passing result means

The evaluator uses rigid, zero-thickness panels and a prescribed simultaneous hinge motion. Passing means the final configuration fits and no prohibited contacts were detected at the sampled states. It does not certify continuous collision-free motion, layer order, material strength, thickness, or single-actuator deployment. The target box constrains the endpoint, not the whole motion.

The user-reported closed paper footprint matches the 5 × 10 cm prediction. The contact-policy review and numerical pilot are recorded; the first supervised model is trained and evaluated. Next is a constraint-aware learning experiment guided by training/validation results, with a fresh frozen test cohort. Broader physical validation remains pending. The original Gemini discussion is preserved in `Initial idea conversation.md` as historical context; the project plan records the corrected engineering scope.

