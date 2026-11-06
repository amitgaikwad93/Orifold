"""Report every frozen validation method; do not select or evaluate final-test models."""
import gzip,json,sys
from pathlib import Path
from statistics import mean
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

p=Path(sys.argv[1]);out=p/'results';s=json.loads((out/'summary.json').read_text());live=json.loads((out/'live-subset-comparisons.json').read_text())
c=json.loads((p/'config.json').read_text());manifest=json.loads((p/'manifest.json').read_text())
groups={}
for stage in ['adam','lbfgs']:
 for mode in ['raw','repair']:groups[f'{stage}-{mode}']=[f'seed-{seed}-{stage}-{mode}' for seed in c['seeds']]
for name in ['nearest-raw','nearest-repair','simple-repair','simple-multistart','reference-cached']:groups[name]=[name]
labels={'adam-raw':'Adam network','adam-repair':'Adam + correction','lbfgs-raw':'Adam/L-BFGS network','lbfgs-repair':'Adam/L-BFGS + correction',
        'nearest-raw':'Nearest training answer','nearest-repair':'Nearest + correction','simple-repair':'Budget-count simple + correction','simple-multistart':'Non-neural multistart','reference-cached':'Cached reference targets'}
aggregates={}
for name,keys in groups.items():
 rs=[s[k] for k in keys];aggregates[name]={'methods':keys,'meanPassRate':mean(r['passRate'] for r in rs),
   'minPassRate':min(r['passRate'] for r in rs),'maxPassRate':max(r['passRate'] for r in rs),
   'meanQualityRate':mean(r['qualityRate'] for r in rs),'meanPipelineMs':mean(r['meanPipelineMs'] for r in rs),
   'meanScoreCalls':mean(r['meanScoreCalls'] for r in rs),'maxScoreCalls':max(r['maxScoreCalls'] for r in rs)}
if not (out/'aggregates.json').exists():
 with (out/'aggregates.json').open('x') as f:json.dump(aggregates,f,indent=2);f.write('\n')
fig,axes=plt.subplots(1,3,figsize=(17,7),layout='constrained')
names=list(groups);y=np.arange(len(names));colors=['#466779' if 'raw' in n else '#DE713B' if 'repair' in n else '#93B6A3' for n in names]
for col,key,title in [(0,'meanPassRate','Strict sampled validity'),(1,'meanQualityRate','Also walls + reference opening band')]:
 vals=[aggregates[n][key]*100 for n in names];axes[col].barh(y,vals,color=colors)
 axes[col].set(yticks=y,yticklabels=[labels[n] for n in names],xlim=(0,110),xlabel='Percent of 768 validation answers',title=title);axes[col].invert_yaxis()
 for i,v in enumerate(vals):axes[col].text(v+.7,i,f'{v:.1f}%',va='center',fontsize=8)
subset_names=names[:-1]+['reference-live'];times=[]
for n in subset_names:
 times.append(live['reference']['meanMsPerRequestAllBudgets'] if n=='reference-live' else mean(live['methods'][k]['meanMsPerRequestAllBudgets'] for k in groups[n]))
axes[2].barh(y,times,color=colors);axes[2].set(yticks=y,yticklabels=[labels[n] for n in names[:-1]]+['Live reference solver'],xscale='log',xlabel='Milliseconds per request, all three budgets',title='Same 24-request subset: pipeline cost');axes[2].invert_yaxis()
axes[1].set_yticklabels([]);axes[2].set_yticklabels(['']*(len(names)-1)+['Live solver'])
axes[2].set_title('Pipeline cost on the 24-request subset')
for ax in axes:ax.spines['top'].set_visible(False);ax.spines['right'].set_visible(False)
fig.suptitle('Frozen validation benchmark: strict validity, useful geometry and pipeline cost\nCached reference quality is a target check; live solver timing is a separate 24-request measurement.',fontsize=14)
with (out/'comparison-final.png').open('xb') as f:fig.savefig(f,format='png',dpi=160)
plt.close(fig)
lines=['# Step 4 validation benchmark','', 'Frozen before inference; no retraining, seed selection, adaptive search or final-test evaluation. Protocol and source commit are recorded in results/environment.json. Primary set: 768 answers from 256 reference-found validation requests. Related budgets and repeated seed predictions are not independent requests.','', '## Every method and seed','', '| Method | Valid /768 | Valid + walls + opening /768 | Correct count | Precision gate | Mean pipeline ms/answer | Mean / max score calls |','| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
for name,r in s.items():
 cost='cached assessment only' if name=='reference-cached' else f"{r['meanPipelineMs']:.3f}"
 lines.append(f"| {name} | {r['passes']} ({r['passRate']*100:.2f}%) | {r['validWallsOpening']} ({r['qualityRate']*100:.2f}%) | {r['foldCountMatches']} | {r['precisionGateCount']} | {cost} | {r['meanScoreCalls']:.2f} / {r['maxScoreCalls']} |")
lines+=['','## Recipe means and deterministic baselines','', '| Method | Mean validity | Seed range | Mean quality | Mean pipeline ms/answer |','| --- | ---: | ---: | ---: | ---: |']
for name,r in aggregates.items():
 cost='not solver latency' if name=='reference-cached' else f"{r['meanPipelineMs']:.3f}"
 lines.append(f"| {labels[name]} | {r['meanPassRate']*100:.2f}% | {r['minPassRate']*100:.2f}–{r['maxPassRate']*100:.2f}% | {r['meanQualityRate']*100:.2f}% | {cost} |")
lines+=['','![Validation comparison](results/comparison-final.png)','', '## Live reference subset','',f"Fresh solver calls on {live['reference']['requests']} preselected requests generated {live['reference']['answers']} budget answers, with {live['reference']['passes']} passing. Mean cost: **{live['reference']['meanMsPerRequestAllBudgets']:.2f} ms per request for all requested budgets together**. Cached reference rechecking above is not solver cost. This is an unrestricted solver, unlike the limited 400-score methods. It does not prove ranking optimality.",'', '| Method | Subset valid answers | Mean ms/request, all budgets |','| --- | ---: | ---: |']
for name,keys in groups.items():
 if name=='reference-cached':continue
 rows=[live['methods'][k] for k in keys];lines.append(f"| {labels[name]} | {mean(r['passes'] for r in rows):.2f}/{rows[0]['answers']} | {mean(r['meanMsPerRequestAllBudgets'] for r in rows):.3f} |")
lines+=['','## Interpretation boundaries','', 'Quality means valid, zero floating creases and smallest opening at least 90% of the saved reference. This is a proxy based on the chosen reference, not a proof of optimal ranking or aesthetic usefulness. Alternate good designs may differ from reference panels, angles or count. The strict copying gate is diagnostic only.','', 'Neural inference/decoding and nearest lookup are resident, batch-amortized preparation costs. Native query pipeline time includes search, placement and final checking. Means and percentiles exclude model/index loading, Node process startup, IPC and diagnostic tolerance sweeps. Batch wall times including IPC are retained separately. Cold single-query or production deployment latency has not been measured. The random 24-request solver subset is not a complete solver runtime distribution; no cross-machine comparison is made.','', 'Multistart tries every count with equal panels at 150/180 degrees under one shared score budget. These initial assessments and all placements count toward measured pipeline time even when they use no objective score calls. Score counts alone do not equal computation. Neural correction keeps predicted count fixed; nearest lookup uses only training labels with the same budget. A valid flat stack may have zero opening, so validity by itself is insufficient.','', 'All tolerance diagnostics are separate, use both width-inclusive placement objectives, and do not alter strict acceptance. Finite search gives upper bounds, not infeasibility proofs. Correction uses coarse 31-state contact screening and final 721-state assessment, with exact score-call cap. No continuous collision guarantee, finite-thickness, actuation, layer-order or manufacturing claim.','', 'Validation has informed earlier development too; this is a development benchmark rather than a pristine final test. Results cannot be converted into a final-test claim. All seeds/methods and failures are retained, with no selected winner or newly trained checkpoint.','', '## Evidence','', 'Checkpoints are the original step-3 final checkpoints, pinned by hash in config. Inputs and source hashes, manifests, per-answer predictions/assessments/edits/times, tolerance curves, nearest training IDs, fresh solver records and software environment are in [results](results/). The final test split is not retained or evaluated. No jobs remain active.']
(p/'REPORT.md').write_text('\n'.join(lines)+'\n');print(json.dumps(aggregates,indent=2));print('Live subset',live['reference'])
