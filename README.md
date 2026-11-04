# Orifold

An experimental project to train small neural models from scratch for mechanical origami inverse design: given a sheet and a target packing box, propose a folding structure and ultimately export a `.fold` file.

## Current stage

Phase 1: forward geometry and validation. The four-panel accordion evaluator computes rigid-panel motion, final bounding-box fit, and contacts at sampled configurations. No optimizer or trained model exists yet.

- [Project plan, capability contract, milestones, and budget](docs/PLAN.md)
- [Geometry equations, contact policy, and limitations](docs/GEOMETRY.md)
- [Validation results and pending paper comparison](docs/VALIDATION.md)
- [Four-panel accordion experiment](demo/accordion.html)
- [Original one-hinge experiment](demo/index.html)

## Run locally

No npm dependencies or build step are required. With Python 3 installed, run from the repository root:

```sh
python3 -m http.server 8000
```

Open http://localhost:8000/demo/accordion.html. The HTML also works directly in browsers that allow local scripts.

Run geometry tests using Node 18 or newer:

```sh
npm test
```

## What a passing result means

The evaluator uses rigid, zero-thickness panels and a prescribed simultaneous hinge motion. Passing means the final configuration fits and no prohibited contacts were detected at the sampled states. It does not certify continuous collision-free motion, layer order, material strength, thickness, or single-actuator deployment. The target box constrains the endpoint, not the whole motion.

Next: review the evaluator, physically check a paper accordion, and run a 100-request numerical-optimization pilot before generating training data. The original Gemini discussion is preserved in `Initial idea conversation.md` as historical context; the project plan records the corrected engineering scope.

