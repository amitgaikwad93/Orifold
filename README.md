# Orifold

An experimental project to train small neural models from scratch for mechanical origami inverse design: given a sheet and a target packing box, propose a folding structure and ultimately export a `.fold` file.

## Current stage

Phases 1–2: forward geometry, a conventional inverse-design solver, and a completed 100-request CPU pilot. The four-panel evaluator computes rigid-panel motion, final-box fit, and sampled contacts. The optimizer proposes crease positions and hinge angles for a target box. No trained neural model exists yet.

- [Project plan, capability contract, milestones, and budget](docs/PLAN.md)
- [Geometry equations, contact policy, and limitations](docs/GEOMETRY.md)
- [Validation results and user-reported paper comparison](docs/VALIDATION.md)
- [Optimizer design and contact-policy review](docs/OPTIMIZATION.md)
- [Measured pilot results and compute estimate](docs/PILOT_RESULTS.md)
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

The user-reported closed paper footprint matches the 5 × 10 cm prediction. The contact-policy review and numerical pilot are recorded; next is a small training dataset with independent splits and strict-validated labels. Broader physical validation remains pending. The original Gemini discussion is preserved in `Initial idea conversation.md` as historical context; the project plan records the corrected engineering scope.

