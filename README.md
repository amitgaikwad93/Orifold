# Orifold

An experimental project to train small neural models from scratch for mechanical origami inverse design: given a sheet and a target packing box, propose a folding structure and ultimately export a `.fold` file.

## Continuing in a new chat

Start with [AGENTS.md](AGENTS.md), then [STATUS.md](docs/STATUS.md) (plain-language status), [the handoff](docs/HANDOFF.md) and [project decisions](docs/DECISIONS.md) (index at the top).

The accordion baseline is merged into `main` (tag `accordion-baseline-v1`). Ongoing research is on `research/learning-assisted-optimization`.

Scope: **zero-thickness rigid flat-panel designs only**. No thickness adaptation or hardware until the user explicitly reopens that scope. Target-box dimensions are separate upper bounds for packing, with a fold budget; scalar volume minimization is not the objective.

## Current stage

The parallel-crease accordion family is fully specified. It has:
- a deterministic answer key (reference solver);
- an accepted, independently checked dataset (v2b);
- a validation benchmark of trained models against conventional baselines.

The model alone is valid on 39% of validation answers. Model + correction reaches 91% but with lower design quality than retrieval or the reference. Current direction: learning-assisted optimization. See [STATUS.md](docs/STATUS.md).

- [Status in plain language](docs/STATUS.md)
- [Learning-assisted optimization: direction and roadmap](docs/LEARNING_ASSISTED_OPTIMIZATION.md)
- [Experiment specification and results](docs/EXPERIMENT_SPEC.md)
- [What a passing result means: limitations](docs/LIMITATIONS.md)
- [Plain-language glossary](docs/GLOSSARY.md)
- [Project plan and milestones](docs/PLAN.md)
- [Geometry equations and contact policy](docs/GEOMETRY.md)
- [Validation record](docs/VALIDATION.md)
- [Optimizer design](docs/OPTIMIZATION.md) and [first pilot results](docs/PILOT_RESULTS.md)
- [First (v1) trained model](docs/LEARNING.md)
- Experiments with reports: `experiments/*/REPORT.md` (latest: [validation-v1](experiments/validation-v1/REPORT.md))
- Example FOLD files: [examples/fold](examples/fold/README.md)
- Interactive demos: [accordion](demo/accordion.html), [one hinge](demo/index.html)

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

Passing means the final shape fits the box and no prohibited contacts were found at sampled motion states, for rigid zero-thickness panels. It is not a physical or manufacturing guarantee; see [LIMITATIONS.md](docs/LIMITATIONS.md). The original Gemini discussion is preserved in `Initial idea conversation.md` as historical context only.
