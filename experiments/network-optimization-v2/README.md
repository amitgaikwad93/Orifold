# Corrected confirmation experiment

Frozen before execution: repeat all eight optimizer/precision arms and four casts from network-optimization-v1 with exactly the same checkpoints, manifest, budgets and final-iterate selection. Correct Model normalization: stored scales at or below the old 1e-6 floor use effective scale 1; other scales are preserved. This removes amplification without discarding feature changes. Historical checkpoint outputs may consequently change and historical reports remain untouched. The assessment bridge always delegates acceptance to assess after placement, using its numerical tolerance. No geometric rule change, new data or held-out evaluation. This is a new version, not a rewrite of prior outcomes.

Run: `.venv/bin/python -m learning.network_optimization experiments/network-optimization-v2`.
