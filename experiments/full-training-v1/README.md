# Step 3: full-training recipe comparison, frozen before execution

User authorized step 3 on the corrected pipeline. Question: is Adam followed by L-BFGS an effective, repeatable and affordable way to fit the complete training split? Step 4 (unfamiliar-box evaluation) is separate. No validation/test predictions or metrics in this experiment, and no checkpoint selection using those splits.

The frozen manifest contains all **4,359 training answers from 1,453 requests** in the authoritative v2b dataset. Multiple budgets per request remain related examples, not independent requests. Dataset hash and exact ordered example IDs are saved. The loader retains training rows only; no held-out labels enter fitting, normalization or assessment. Width feasibility is still handled analytically, as in the existing model.

Use the original 256×256 tanh MLP, 75,554 parameters, corrected input normalization, generic outputs/decoder, float32, CPU one thread and deterministic algorithms. Use existing parameter-imitation/count loss without geometric penalties or family-specific outputs. This choice keeps this a comparison of training recipes rather than adding a loss grid; it does not establish that this loss is superior to position imitation.

Three fixed seeds **17, 29, 43** provide limited repeatability evidence. Each seed starts from scratch, fits normalization on training inputs only, and trains a shared Adam prefix: **1,500 epochs, minibatches of 128**, rate 0.001 for 1,000 epochs then 0.0001 for 500. The last minibatch is retained. Save initial weights, the final prefix checkpoint, history, and training metrics.

From that exact prefix checkpoint, two fresh workers train:

- **Adam-only continuation:** 2,000 full-batch updates at 0.0001 with fresh moments. Prefix moments are not transferred to either branch. This is a defined optimizer restart, not uninterrupted Adam.
- **Adam + L-BFGS:** up to 2,000 full-batch objective/gradient evaluations and iterations, history 50, strong-Wolfe line search, rate 1, gradient tolerance 1e-12 and change tolerance 1e-16. A line search may finish slightly beyond its nominal budget; report actual counts. Returning early does not establish convergence.

Thus both recipes have identical weights and training exposure before the branch. The shared prefix cost belongs to both recipes and must be included in end-to-end training time. Equal evaluation ceilings do not imply equal runtime or number of accepted updates. Branch optimizer state is fresh in both cases. No adaptive tuning, retries, seed selection or best-checkpoint selection. Keep every final iterate even if it fails. A finite budget cannot establish a capacity limit.

Each stage is a separate Python process. Record peak Linux process RSS in MiB before geometric assessment; this includes interpreter, data, model and optimizer and is not a measurement of optimizer memory alone. Node child-assessor memory is excluded. Record final process high-water RSS too. No paid resources.

Assessment: all training answers, corrected existing bridge, panel/angle rules, budget-restricted predicted fold count, 2% box gap after normal placement and 721-state contacts. Record per-answer failure reason, floating creases, reference opening band, count accuracy and physical geometry errors. Joint precision gate requires **predicted fold count match**, unrotated real-vertex RMS <=0.1% sheet length and angle MAE <=0.1°. Geometry-error means only include matching counts; report that denominator. Report validity plus zero floating plus at least 90% of reference opening separately from validity. Node reference checks are not an independent collision reimplementation. Returned-pose overflow is not minimum achievable overflow; no claim based on it.

Save training predictions as gzip JSONL, final checkpoints, optimization diagnostics, actual time and memory, initial/checkpoint hashes, seeds, exact manifest and environment. Summarize paired seed differences and ranges, not a formal significance claim from three seeds. Do not call better training fit better generalization. Inference includes placement search, so this does not isolate neural-only end-to-end latency or compare solver speed.

Commands:

```sh
.venv/bin/python -m unittest discover -s tests -p 'test_*.py'
.venv/bin/python -m learning.full_training experiments/full-training-v1
```

The runner refuses existing results. Historical evidence remains unchanged. Zero-thickness sampled validity is not proof of continuous collision freedom, ranking optimality, generalization or physical performance.
