# Working on Orifold

## Start here in every new session

1. Read [docs/HANDOFF.md](docs/HANDOFF.md) for current state, branch/PR, commands, known limitations, and the next executable task.
2. Read [docs/DECISIONS.md](docs/DECISIONS.md) for scope and rationale, then [docs/PLAN.md](docs/PLAN.md) for milestones.
3. Inspect the actual checkout, worktree changes, and remote PR state. The handoff is a dated snapshot; do not assume its branch status or runtime state is still current. Preserve unrelated work.
4. Read the relevant implementation and validation documents before changing geometry or training behavior. The Gemini transcript is historical context, not an implementation specification.

## Project boundaries

- The user wants to learn model training from scratch through a useful mechanical origami experiment. Be candid about whether learning adds value over conventional methods.
- Generate and evaluate **zero-thickness, rigid flat-panel designs only**. Do not implement thickness adaptation, axis offsets, panel trimming, hinge hardware, or material mechanics until the user explicitly reopens that scope. This is not an automatic future milestone.
- Current task: packing a fixed sheet into a target envelope with a limited panel/crease budget. Treat target length, width and height as separate upper bounds, not a scalar volume objective. Flat-folded height zero is allowed.
- Current evaluator checks sampled configurations; never describe that as proof of continuous collision-free motion, layer ordering, physical manufacturability, or one-actuator deployment.
- Keep solver failures distinct from proven infeasibility, and numerical solver results distinct from neural-model results.

## Work and verification

- Proceed with necessary, reversible work within the agreed scope; do not stop at proposing the next step or repeatedly seek permission for routine implementation choices. Ask for genuinely missing decisions, not approvals already given.
- No background work survives a final reply unless an actual durable task has been started. State whether a run is active, finished, or blocked; do not imply a future job is running.
- Use local CPU first. The discussed $50 is a planning envelope, not authorization to provision billable resources.
- Run `npm test` for geometry/solver changes. Add meaningful parity checks before relying on a Python/PyTorch geometry implementation. For documentation-only changes, check links and consistency instead of rerunning expensive experiments.
- Retain immutable benchmark evidence in `results/`. Put exploratory output in ignored `artifacts/`; do not overwrite historical reports merely to rerun a command.
- Keep pilot requests separate from future held-out model evaluation. Save seeds, split manifests, settings, checkpoints, and failure analysis for experiments. Group related/scaled examples to prevent leakage.
- Push reviewable changes to the working branch and update the draft PR as appropriate. Do not treat these instructions as permission to merge or to change scope.

## Maintain continuity before ending a substantive task

Update `docs/HANDOFF.md` with what changed, commands/results, current branch/PR, unfinished work, active jobs (or none), and the next concrete task. Update `docs/DECISIONS.md` for durable decisions and `docs/PLAN.md` for milestone changes. Keep one clear current state rather than accumulating conflicting status summaries. Do not record credentials or depend on temporary attachment paths.
