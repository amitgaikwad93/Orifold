"""Report saved-prediction correction audit without choosing a model or altering past evidence."""
import json,sys
from pathlib import Path
from statistics import mean
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

p=Path(sys.argv[1]);out=p/'results';s=json.loads((out/'summary.json').read_text())
controls=json.loads((out/'matched-count-control-summary.json').read_text())['byModelGroup']
history=json.loads((out/'historical-run1-summary.json').read_text())
tol=json.loads((p/'tolerance-audit/run1-metric-objectives.json').read_text())
base=json.loads(Path('experiments/full-training-v1/results/summary.json').read_text())
before={f"seed-{r['seed']}-{r['stage']}":r['training'] for r in base}
keys=list(s);xs=np.arange(len(keys))
fig,axes=plt.subplots(2,2,figsize=(14,9),layout='constrained')
for shift,name,color in [(-.25,'Network','#466779'),(0,'Network + correction','#DE713B'),(.25,'Equal panels, matched count + correction','#93B6A3')]:
    valid=[];quality=[]
    for k in keys:
        n=s[k]['examples']
        r=before[k] if name=='Network' else s[k] if name=='Network + correction' else controls[k]
        valid.append(r['passes']/n*100);quality.append(r['validWallsOpening']/n*100)
    axes[0,0].bar(xs+shift,valid,.25,label=name,color=color)
    axes[0,1].bar(xs+shift,quality,.25,label=name,color=color)
for ax in axes[0]:
    ax.set_xticks(xs,[k.replace('seed-','').replace('-','\n') for k in keys],fontsize=9);ax.set_ylim(0,105);ax.set_ylabel('Percent of 4,359 training answers');ax.legend(fontsize=8)
axes[0,0].set_title('Strict fit + 721-state sampled validity')
axes[0,1].set_title('Also zero floating creases + reference opening band')
for metric,label in [('sheet','Sheet-length allowance'),('boxAtSheetOptimum','Box-relative allowance at legacy angle'),('boxAtOwnOptimum','Box-relative allowance at own best angle')]:
    axes[1,0].plot([r['tolerance']*100 for r in tol['curves']],[r[metric]/tol['answers']*100 for r in tol['curves']],marker='o',label=label)
axes[1,0].set(title='Historical run 1: tolerance is a different metric',xlabel='Additional allowance (% of stated denominator)',ylabel='Percent of 768 saved validation predictions')
axes[1,0].legend(fontsize=8)
axes[1,1].bar(xs,[s[k]['meanCorrectionMs'] for k in keys],color='#DE713B')
axes[1,1].set(xticks=xs,xticklabels=[k.replace('seed-','').replace('-','\n') for k in keys],title='Reported mean correction time (includes final check)',ylabel='Milliseconds per answer')
for ax in axes.flat:ax.spines['top'].set_visible(False);ax.spines['right'].set_visible(False)
fig.suptitle('Saved-prediction audit: numerical correction improves fit; quality still matters\nTraining comparisons and historical validation tolerance analysis are different datasets.',fontsize=14)
with (out/'comparison.png').open('xb') as f:fig.savefig(f,format='png',dpi=160)
plt.close(fig)
lines=['# Claude tolerance and correction audit','', 'Protocol/code frozen in `60d1b9e` before applying the unchanged legacy correction to new saved training predictions. No retraining, new validation model inference, or final-test evaluation. All original results remain unchanged.','', '## New training predictions, all three seeds and both recipes','', '| Model | Original valid | Legacy corrected flag | Evaluator-confirmed corrected | Also walls + opening | Matched-count equal-panel control valid | Control walls + opening |','| --- | ---: | ---: | ---: | ---: | ---: | ---: |']
for k,r in s.items():
    n=r['examples'];ctrl=controls[k]
    lines.append(f"| {k} | {r['originalPasses']}/{n} | {r['legacyPasses']}/{n} | {r['passes']}/{n} ({100*r['passRate']:.2f}%) | {r['validWallsOpening']}/{n} | {ctrl['passes']}/{n} | {ctrl['validWallsOpening']}/{n} |")
lines+=['','Counts use unchanged 2% box margin and 721 motion states, plus fold-budget checks. The raw legacy flags and canonical final-pose assessments are both retained. The evaluator rechecks the saved pose without another placement search.','', '## Means over three training seeds','']
for stage in ['adam','lbfgs']:
    rs=[r for k,r in s.items() if k.endswith('-'+stage)]
    lines.append(f"{stage}: corrected mean validity {100*mean(r['passRate'] for r in rs):.2f}%, valid+walls+opening {100*mean(r['validWallsOpening']/r['examples'] for r in rs):.2f}%, correction {mean(r['meanCorrectionMs'] for r in rs):.2f} ms/answer, mean {mean(r['meanEvaluations'] for r in rs):.2f} score calls.")
lines+=['','The matched-count control uses the model-provided fold count but replaces continuous values with equal panels and 150-degree angles. It isolates the usefulness of those continuous values, not a fully model-free pipeline. Identical controls are computed once across models/seeds; report denominators still refer to each model group. This is descriptive development evidence, not held-out proof that learning beats conventional search.','', '## Historical Claude run-1 correction, existing validation records only','']
for k,r in history.items():lines.append(f"{k}: original saved flags {r['legacyPasses']}/{r['examples']}; final-pose evaluator confirms {r['passes']}/{r['examples']}; zero floating among passing {r['passingWithZeroFloating']}; valid+walls+reference-opening-band {r['validWallsOpening']}; maximum evaluations {r['maxEvaluations']}, over nominal 400: {r['overNominal400']}.")
lines+=['','![Audit comparison](results/comparison.png)','', 'Canonical reassessment invokes the same underlying evaluator; it is not an independent collision proof. Correction process wall time and reported per-answer times include numerical placement/final checking, exclude neural inference. Separate audit reassessment time is not part of deployment correction. Timing is environment-specific.','', 'Raw corrected designs, evaluation calls, timing, flags and full final assessments are retained in [results](results/). Source and input hashes are recorded; original scripts/data were not modified. No run or seed was dropped.']
(p/'REPORT.md').write_text('\n'.join(lines)+'\n')
print('\n'.join(lines[6:25]))
