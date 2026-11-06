"""Plot saved training-only optimizer/precision comparisons; does not select checkpoints."""
import json
import sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root=Path(sys.argv[1]);out=root/'results'
summary=json.loads((out/'summary.json').read_text())
baseline=json.loads(Path('experiments/memorization-v1/results/summary.json').read_text())
arms=['adam-float32','adam-float64','lbfgs-float32','lbfgs-float64']
labels=['Adam 32','Adam 64','L-BFGS 32','L-BFGS 64']
colors=['#1879A6','#64A6BD','#D46832','#B13C52']
plt.rcParams.update({'axes.spines.top':False,'axes.spines.right':False,'font.size':10})
fig,axes=plt.subplots(2,2,figsize=(13,9),layout='constrained')
for col,mode in enumerate(['parameters','positions']):
    for arm,label,color in zip(arms,labels,colors):
        history=json.loads((out/f'{mode}-{arm}-history.json').read_text())
        result=summary[f'{mode}-{arm}']
        xs=[h['objectiveEvaluation'] for h in history]+[result['optimization']['objectiveEvaluations']]
        ys=[h['meanVertexRmsOverL']*100 for h in history]+[result['vertexRmsOverL']['mean']*100]
        axes[0,col].plot(xs,ys,color=color,label=label)
    axes[0,col].set(title=f'{mode.capitalize()} loss: shape accuracy during training',xlabel='Additional objective/gradient evaluations',ylabel='Mean vertex RMS (% sheet length)',yscale='log')
    axes[0,col].axhline(.1,color='gray',ls='--',label='Per-example copying threshold')
    axes[0,col].legend(fontsize=8)
    rows=[baseline[mode]]+[summary[f'{mode}-{a}'] for a in arms]
    xs=np.arange(5)
    axes[1,col].bar(xs-.18,[r['precisionGateCount'] for r in rows],.36,color='#86AD9E',label='Meets both copying thresholds')
    axes[1,col].bar(xs+.18,[r['passes'] for r in rows],.36,color='#466779',label='Strict fit + sampled validity')
    axes[1,col].set(title=f'{mode.capitalize()} loss: final outcomes',xticks=xs,xticklabels=['Earlier\nnetwork']+[s.replace(' ','\n',1) for s in labels],ylim=(0,36),ylabel='Count of 32 training examples')
    axes[1,col].axhline(32,color='gray',ls=':')
    axes[1,col].legend(fontsize=8)
    for i,r in enumerate(rows):
        axes[1,col].text(i-.18,r['precisionGateCount']+.4,str(r['precisionGateCount']),ha='center',fontsize=8)
        axes[1,col].text(i+.18,r['passes']+.4,str(r['passes']),ha='center',fontsize=8)
fig.suptitle('Same network, same 32 examples: changing optimizer and numerical precision\n32/64 indicate float32/float64. Curves include L-BFGS trial evaluations; no held-out evaluation.',fontsize=14)
with (out/'diagnostic.png').open('xb') as f: fig.savefig(f,format='png',dpi=160)
plt.close(fig)
