# Working on Orifold

Read this file at the start of every session. It is short on purpose: scope and rules here, current state in [docs/HANDOFF.md](docs/HANDOFF.md), durable decisions in [docs/DECISIONS.md](docs/DECISIONS.md).

## Who you are working with

The user is the project owner and knows what they want to build (useful mechanical origami), but is **not an ML engineer**. They are using this project to learn how model training works. The project is about understanding and designing the experiment, not just producing code. See [Communicating with the user](#communicating-with-the-user).

## Project boundaries

- Purpose: learn model training from scratch through a useful mechanical origami experiment, and be candid about whether learning adds value over conventional methods.
- **Zero-thickness, rigid flat-panel designs only.** Do not implement thickness adaptation, axis offsets, panel trimming, hinge hardware, or material mechanics until the user explicitly reopens that scope. This is not an automatic future milestone.
- Current task: pack a fixed sheet into a target envelope with a limited panel/crease budget. Target length, width and height are separate upper bounds, not a scalar volume objective. Flat-folded height zero is allowed.
- The current stage is about **designing the experimental setup** (task, what "valid" means, how data is generated, what success looks like), independent of model or dataset scale. See DECISIONS.md D11.
- The evaluator checks sampled configurations; never describe that as proof of continuous collision-free motion, layer ordering, manufacturability, or one-actuator deployment. Full list: [docs/LIMITATIONS.md](docs/LIMITATIONS.md).
- Keep solver failures distinct from proven infeasibility, and numerical-solver results distinct from neural-model results.

## Communicating with the user

1. **Plain language first, then the technical term.** For example: "the model copies the optimizer's answers (this is called *supervised imitation*)". Link or add new terms to [docs/GLOSSARY.md](docs/GLOSSARY.md) rather than assuming knowledge.
2. **Say what you are doing and why** before long-running or multi-step work, in one or two sentences. Afterwards, say what happened, what it means for the project, and what is still unknown.
3. **Present choices as trade-offs.** When there is a real decision, give 2–3 options, what each costs (time, money, complexity, what it lets us learn), your recommendation and why. Do not bury a decision inside an implementation.
4. **Separate the kinds of claim.** Clearly label what was measured, what is estimated, what is a hypothesis, and what is a decision. Say "this failed" plainly; failures are useful evidence.
5. **Prefer visuals** for datasets and outcomes (plots, rendered folds, side-by-side comparisons) over tables of numbers when the user needs to judge something. State what a picture shows and what it does not.
6. **Connect to the user's intent**, not only to ML metrics: does this bring us closer to folds that are valid, useful, and good-looking?
7. Do not repeat the full limitations list in every reply; link to LIMITATIONS.md and mention only the caveats that change the interpretation.
8. If the user says a discussion is unfinished, record its current state as *open*, not as decided.

## Work and verification

- Proceed with necessary, reversible work within the agreed scope; do not stop at proposing the next step or repeatedly seek permission for routine choices. Ask for genuinely missing decisions, not approvals already given.
- No background work survives a final reply unless a durable task was actually started. State whether a run is active, finished, or blocked.
- Use local CPU first. The discussed $50 is a planning envelope, not authorization to provision billable resources.
- Run `npm test` for geometry/solver changes, and the Python tests for learning-code changes. Add parity checks before relying on a Python/PyTorch geometry implementation. For documentation-only changes, check links and consistency instead of rerunning experiments.
- Retain immutable evidence in `results/` and `experiments/<name>/`. Put exploratory output in ignored `artifacts/`. Never overwrite historical reports to rerun a command; use a new file or directory.
- Keep pilot requests separate from held-out evaluation. Save seeds, split manifests, settings, checkpoints and failure analysis. Group related/scaled examples to prevent leakage.
- Push reviewable changes to the working branch. Do not merge or change scope on the basis of these instructions.

## Handoff procedure (SOP)

Chats end; the repository is the project's memory. Follow this every session.

### At the start

1. Read this file, then `docs/HANDOFF.md`, then `docs/DECISIONS.md` (including **Open questions**). Read `docs/PLAN.md` and the topic docs relevant to the task.
2. Check the real state: `git status`, `git log --oneline -5`, current branch, and open PRs. HANDOFF.md is a dated snapshot; where it disagrees with the checkout, trust the checkout and fix the handoff.
3. Restore the environment only if the task needs it (`npm test` needs only Node; Python setup is in docs/LEARNING.md). Do not rerun finished experiments just to confirm state.
4. If the user's request conflicts with a recorded decision, point out the conflict and ask; do not silently pick one.

### Before ending a substantive session

1. Rewrite `docs/HANDOFF.md` to the template below. Replace stale state; do not append a second status summary.
2. Add or amend entries in `docs/DECISIONS.md` for anything the user decided, and move unresolved topics to **Open questions**. Mark agent recommendations as recommendations.
3. Update `docs/PLAN.md` if a milestone changed.
4. Run the relevant checks (tests, or link/consistency check for docs-only work) and report the result.
5. Commit with a descriptive message and push to the working branch. Note the branch/PR in the handoff.
6. Do not record credentials, temporary attachment paths, or claims about jobs that are not actually running.

### HANDOFF.md template

```
# Orifold handoff
Snapshot: <date>, <one-line summary of where the project stands>

## Current state         — branch, PR, what works, what does not
## Last session          — what changed, with commands and measured results
## In discussion / open  — topics the user has not finished deciding (link to DECISIONS open questions)
## Next concrete task    — the single next step, and why
## Runtime               — active jobs (or "none"), environment notes
## Commands              — the few commands needed to continue
```
