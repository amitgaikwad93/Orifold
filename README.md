# Orifold

An experimental project to train small neural models from scratch for mechanical origami inverse design: given a sheet and a target packing box, propose a folding structure and ultimately export a `.fold` file.

## Continuing in a new chat

Start with [AGENTS.md](AGENTS.md), then [the current handoff](docs/HANDOFF.md) and [project decisions](docs/DECISIONS.md). The handoff records completed work, verification, runtime status, and concrete next steps. Update it after each substantive session.

Implementation is not yet on `main`; see the handoff for the current branch and PR.

Scope: **zero-thickness rigid flat-panel designs only**. No thickness adaptation or hardware until the user explicitly reopens that scope. Target-box dimensions are separate upper bounds for packing, with a limited panel budget; scalar volume minimization is not the objective.

## Current stage

Phases 1–3: geometry, numerical optimization, and the first CPU-trained neural model are implemented. The first network is not a usable generator (0/150 strict, 3/150 within 1%; the optimizer passed 150/150). A later audit showed its training labels were inconsistent, so that experiment tested the pipeline rather than the approach. The current stage is designing the experimental setup: validity, objectives, dataset criteria and success targets (DECISIONS.md D10–D11).

- [What a passing result means: limitations](docs/LIMITATIONS.md)
- [Plain-language glossary](docs/GLOSSARY.md)
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

Passing means the final shape fits the box and no prohibited contacts were found at sampled motion states, for rigid zero-thickness panels. It is not a physical or manufacturing guarantee; see [LIMITATIONS.md](docs/LIMITATIONS.md). The original Gemini discussion is preserved in `Initial idea conversation.md` as historical context only.
