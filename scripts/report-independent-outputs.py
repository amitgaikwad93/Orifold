"""Plot frozen independent-output results alongside the earlier shared-network diagnostic."""
import json
import sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt

root=Path(sys.argv[1]); out=root/'results'
old=Path('experiments/memorization-v1/results')
summary=json.loads((out/'summary.json').read_text()); baseline=json.loads((old/'summary.json').read_text())
stages=['network','adam','lbfgs64','cast32']
labels=['Shared network\nAdam','Independent\nAdam','Independent\nL-BFGS float64','Refined logits\ncast to float32']
colors={'parameters':'#1879A6','positions':'#DE713B'}
fig,axes=plt.subplots(2,2,figsize=(13,9),layout='constrained')
for mode,color in colors.items():
    rows=[baseline[mode]]+[summary[f'{mode}-{s}'] for s in stages[1:]]
    axes[0,0].plot(range(4),[r['vertexRmsOverL']['mean']*100 for r in rows],marker='o',label=mode,color=color)
    axes[0,1].plot(range(4),[r['angleMaeDegrees']['mean'] for r in rows],marker='o',label=mode,color=color)
    shift=-.18 if mode=='parameters' else .18
    axes[1,0].bar(np.arange(4)+shift,[r['precisionGateCount'] for r in rows],.36,label=mode,color=color)
    axes[1,1].bar(np.arange(4)+shift,[r['passes'] for r in rows],.36,label=mode,color=color)
for ax in axes.flat:
    ax.set_xticks(range(4),labels,fontsize=9)
    ax.spines['top'].set_visible(False); ax.spines['right'].set_visible(False)
axes[0,0].set(title='Average shape error',ylabel='Mean vertex RMS (% sheet length)',yscale='log')
axes[0,0].axhline(.1,ls='--',color='gray',label='Per-example precision threshold');axes[0,0].legend(fontsize=8)
axes[0,1].set(title='Average angle error',ylabel='Mean absolute error (degrees)',yscale='log')
axes[0,1].axhline(.1,ls='--',color='gray');axes[0,1].legend(fontsize=8)
axes[1,0].set(title='Examples meeting both precision thresholds',ylabel='Count of 32',ylim=(0,35))
axes[1,1].set(title='Strict fit + sampled validity after placement search',ylabel='Count of 32',ylim=(0,35))
for ax in axes[1]: ax.axhline(32,ls=':',color='gray');ax.legend(fontsize=8)
fig.suptitle('Independent outputs can reproduce valid answers; optimization settings matter\nSame 32 training examples and generic decoder. L-BFGS changes optimizer AND precision.',fontsize=14)
with (out/'diagnostic.png').open('xb') as f: fig.savefig(f,format='png',dpi=160)
plt.close(fig)
