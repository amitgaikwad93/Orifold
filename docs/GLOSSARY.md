# Plain-language glossary

For the project owner and any agent explaining the work. Each entry: what it is, then what it means in Orifold. Add terms when they first come up.

## The origami side

- **Design family** — the template a design must follow. Ours: a strip of 4 panels joined by 3 parallel hinges. The *parameters* are the 3 crease positions and 3 fold angles.
- **Request** — the question asked: "this sheet, this box; find a fold." Inputs are sheet length/width and box length/width/height.
- **Evaluator** — the program that judges a design: does the folded shape fit the box, and do panels collide while folding? It is the referee, not the player. See LIMITATIONS.md for what it does not check.
- **Valid / passing** — accepted by the evaluator. Valid is not the same as good-looking or useful.
- **Witness** — a design we already know works, used to build a request that is guaranteed solvable.
- **Quality objective (tie-break)** — when many designs pass, the rule for which one is "best". v1 used "least total folding". If this rule does not pick one clear winner, labels become inconsistent.

- **Fit margin** — the required gap inside the box. We use 2%: the fold may use at most 98% of each box dimension.
- **Strict priority order (lexicographic ranking)** — compare designs on the first measure; only if tied, look at the next one. Avoids arbitrary weights and gives one clear answer per request.
- **Order score** — our proposed measure of geometric aesthetics: fewer distinct panel lengths and angles, and mirror symmetry, mean a more ordered design.

## The conventional side

- **Optimizer (differential evolution)** — a search method that tries many designs, keeps the better ones and mixes them, over ~1,000 tries. No learning: it starts from scratch on each request. It is our reliable baseline.
- **Baseline** — a simple or conventional method any learned model must beat to be worth having. Ours: equal-panel flat stack, random search, the optimizer, and (proposed) nearest-neighbour lookup.
- **Seed** — the number that fixes the "random" choices so a run can be repeated exactly. A different seed can give a different, equally valid answer.

## The learning side

- **Model / neural network** — a function with adjustable numbers (*parameters* or *weights*) that maps a request to a design. Ours, the MLP, has ~18,000 of them.
- **MLP (multi-layer perceptron)** — the simplest kind of neural network: layers of weighted sums with a bend (activation) between them.
- **Training** — repeatedly nudging the weights so the model's outputs score better on the *loss*.
- **Loss** — the single number training tries to make small. The choice of loss defines what the model is actually taught.
- **Supervised imitation** — training the model to copy answers (*labels*) produced by something else, here the optimizer. It only works if the labels are consistent.
- **Label** — the answer attached to a training example. Here: the optimizer's design for a request.
- **Label noise / ambiguity** — when the same kind of question has many different labelled answers. The model learns an average, and the average of two valid folds is often invalid. This was found in v1 (DECISIONS.md D10).
- **Geometric (label-free) loss** — teaching the model directly with the evaluator's rules, e.g. "penalise how far the fold sticks out of the box", instead of copying labels. Requires a version of the geometry that training can differentiate (compute slopes through).
- **Differentiable** — you can compute how the output changes when an input changes slightly. Training needs this to know which direction to nudge the weights.
- **Training / validation / test split** — data divided three ways. *Training*: the model learns from it. *Validation*: used to choose settings and when to stop. *Test*: looked at once, at the end, as the honest exam. Reusing the test set for tuning spoils it.
- **Leakage** — when test questions are secretly near-copies of training questions, making results look better than they are.
- **Overfitting** — doing well on training data but badly on new data: memorising instead of generalising.
- **Epoch** — one pass through all the training data.
- **Checkpoint** — a saved copy of the model's weights at some point in training.
- **Hybrid / warm start** — using the model's guess as a starting point for the optimizer, hoping it finds a valid design faster.
- **Nearest-neighbour baseline** — answer a new request by copying the solution of the most similar known request. If this beats the network, the network is not adding much.
- **Amortized optimization** — spending effort once in training so that each later request is answered instantly, instead of running a search every time. This is the main practical reason to use learning here.

- **Reference solver** — our deterministic (no randomness) search that produces one best answer per request, following the agreed ranking. It produces the answers a model would learn from or be compared with.
- **Request-space map** — a picture of every box shape on a grid, showing which are solvable and how many folds each needs. It shows where the problem is easy, hard or impossible before any training.
- **Completeness check / search power** — testing the reference with an independent search. If the independent search finds a better answer, the reference missed it. *Search power* is how good that independent search is at finding answers that we know exist; weak search power makes "nothing better found" weak evidence.

- **Specification gaming (Goodhart's law)** — an optimizer or model satisfies the rules exactly as written but not as intended, because the rules left a loophole. "Reward hacking" is the same thing when a learning agent does it. Example here: the ranking never asked for space between panels, so packed near-parallel panels scored best. A trained model would exploit the same loophole, so we fix the rules before training.

- **Mountain / valley fold** — the two directions a crease can fold. Our current family alternates them strictly.
- **Direction-switch crease** — a near-flat crease (around 1°) that the solver adds so that the next real fold can turn the same way as the previous one. It is a workaround for the alternating-direction rule, not a useless fold.
- **Fold budget** — part of the question given to the model: "at most k folds". Each budget has its own single best answer, so every question still has exactly one answer.

## Experiment practice

- **Predeclared** — targets, settings and the test set are fixed *before* seeing results, so we cannot fool ourselves after the fact.
- **Experiment specification** — the written contract for one experiment: task, validity rules, quality objective, how requests are sampled, how labels are made and checked, metrics, success target, baselines, and what a failure would mean. See [EXPERIMENT_SPEC.md](EXPERIMENT_SPEC.md).
