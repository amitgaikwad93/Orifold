"""Summarize frozen full-training recipes; no checkpoint/seed selection."""
import json
import gzip
import sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from statistics import mean

root=Path(sys.argv[1]);out=root/'results';c=json.loads((root/'config.json').read_text())
rows=json.loads((out/'summary.json').read_text());seeds=c['seeds']
by={(r['seed'],r['stage']):r for r in rows}
prefix={s:json.loads((out/f'seed-{s}/prefix/summary.json').read_text()) for s in seeds}
fig,axes=plt.subplots(2,2,figsize=(12,8),layout='constrained')
x=np.arange(len(seeds));colors={'adam':'#1879A6','lbfgs':'#D46832'}
for stage,shift in [('adam',-.18),('lbfgs',.18)]:
    rs=[by[s,stage] for s in seeds]
    axes[0,0].bar(x+shift,[r['training']['passRate']*100 for r in rs],.36,label=stage,color=colors[stage])
    axes[0,1].bar(x+shift,[r['training']['validWallsOpening']/r['training']['examples']*100 for r in rs],.36,label=stage,color=colors[stage])
    axes[1,0].bar(x+shift,[prefix[s]['optimization']['optimizationSeconds']+by[s,stage]['optimization']['optimizationSeconds'] for s in seeds],.36,label=stage,color=colors[stage])
    axes[1,1].bar(x+shift,[max(prefix[s]['trainingPeakProcessRssMiB'],by[s,stage]['trainingPeakProcessRssMiB']) for s in seeds],.36,label=stage,color=colors[stage])
for ax in axes.flat:
    ax.set_xticks(x,[str(s) for s in seeds]);ax.set_xlabel('Training seed');ax.legend()
    ax.spines['top'].set_visible(False);ax.spines['right'].set_visible(False)
axes[0,0].set(title='Training-set sampled validity',ylabel='Percent of 4,359 answers',ylim=(0,100))
axes[0,1].set(title='Valid + walls + reference opening band',ylabel='Percent of 4,359 answers',ylim=(0,100))
axes[1,0].set(title='Optimization time, including shared Adam prefix',ylabel='Seconds, one CPU thread')
axes[1,1].set(title='Peak process memory across training stages',ylabel='MiB (includes runtime and data)')
fig.suptitle('Full training split: Adam continuation vs Adam + L-BFGS\nThree paired seeds; ordinary precision; no validation or test evaluation',fontsize=14)
with (out/'comparison.png').open('xb') as f:fig.savefig(f,format='png',dpi=160)
plt.close(fig)
lines=['# Full-training recipe comparison','', 'Step 3 is complete. These are training-set measurements only; no validation/test predictions or method selection have been performed. Protocol, config and manifest were committed in `3f212ef` before execution.','', 'The same 4,359 training answers from 1,453 requests, corrected generic MLP, parameter loss and float32 precision were used throughout. Each paired seed shares its entire Adam prefix; only the final refinement method differs. Both branch optimizers start with fresh state. No seed, checkpoint or iteration was chosen by its geometric score.','', '| Seed | Stage | Valid /4,359 | Valid + walls + opening | Correct count | Precision gate | Optimization seconds | Peak process MiB |','| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |']
for seed in seeds:
    for stage in ['prefix','adam','lbfgs']:
        r=prefix[seed] if stage=='prefix' else by[seed,stage];m=r['training'];t=r['optimization']['optimizationSeconds'];rss=r['trainingPeakProcessRssMiB']
        if stage!='prefix':t+=prefix[seed]['optimization']['optimizationSeconds'];rss=max(rss,prefix[seed]['trainingPeakProcessRssMiB'])
        lines.append(f"| {seed} | {stage} | {m['passes']} ({m['passRate']*100:.2f}%) | {m['validWallsOpening']} | {m['foldCountMatches']} | {m['precisionGateCount']} | {t:.1f} | {rss:.1f} |")
lines+=['', '## Paired summary','']
for stage in ['adam','lbfgs']:
    rates=[by[s,stage]['training']['passRate']*100 for s in seeds]
    lines.append(f"{stage}: mean sampled validity **{mean(rates):.2f}%**, seed range {min(rates):.2f}–{max(rates):.2f}%.")
diffs=[(by[s,'lbfgs']['training']['passRate']-by[s,'adam']['training']['passRate'])*100 for s in seeds]
lines.append(f"L-BFGS minus Adam: paired validity differences {', '.join(f'{d:+.2f}' for d in diffs)} percentage points; mean {mean(diffs):+.2f}. Three seeds do not establish statistical significance or a general optimizer ranking.")
# Descriptive breakdown prevents easy zero-fold requests from hiding folded-case behavior.
refs={}
with gzip.open(c['dataset'],'rt') as f:
    for line in f:
        r=json.loads(line)
        if r['split']=='train' and r['status']=='found':
            for a in r['answers']: refs[f"{r['id']}-b{a['budget']}"]=len(a['design']['angles'])
subgroups={}
for seed in seeds:
    for stage in ['adam','lbfgs']:
        groups={}
        with gzip.open(out/f'seed-{seed}'/stage/'training-predictions.jsonl.gz','rt') as f:
            for line in f:
                r=json.loads(line);k=refs[r['id']];g='0' if k==0 else '1' if k==1 else '2-3' if k<=3 else '4+'
                z=groups.setdefault(g,{'examples':0,'passes':0,'precisionGate':0})
                z['examples']+=1;z['passes']+=r['assessment']['passes'];z['precisionGate']+=r['precisionGate']
        subgroups[f'{seed}-{stage}']=groups
with (out/'fold-count-breakdown.json').open('x') as f:json.dump(subgroups,f,indent=2);f.write('\n')
lines+=['','Descriptive post-hoc breakdown by reference fold count (pooled over all three seeds; repeated predictions are not new independent requests):', '', '| Reference folds | Adam valid | L-BFGS valid |','| --- | ---: | ---: |']
for g in ['0','1','2-3','4+']:
    vals=[]
    for stage in ['adam','lbfgs']:
        passes=sum(subgroups[f'{seed}-{stage}'][g]['passes'] for seed in seeds)
        count=sum(subgroups[f'{seed}-{stage}'][g]['examples'] for seed in seeds)
        vals.append(f'{passes}/{count} ({100*passes/count:.2f}%)')
    lines.append(f'| {g} | {vals[0]} | {vals[1]} |')
lines+=['', '![Recipe comparison](results/comparison.png)','', '## Measurement definitions and limitations','', 'Both recipes include the same 1,500-epoch minibatch Adam prefix. Branches have nominally 2,000 full-batch objective-evaluation budgets. Actual iteration/evaluation counts, final gradients, stopping flags and training histories are saved. L-BFGS can return early or slightly exceed its ceiling to finish a line search; numerical convergence must not be inferred from a library return. Equal evaluation ceilings do not imply equal runtime.','', 'Memory is Linux process high-water RSS from fresh worker processes, including interpreter, tensors, network and optimizer, measured before assessment. Recipe peak is the maximum prefix/branch peak, not the sum; stages do not coexist. The child Node evaluator is excluded. This is not optimizer-only or deployment memory. Optimization time includes the shared prefix for each recipe; geometric assessment time is recorded separately.','', 'The corrected reference bridge searches placement and checks 721 motion states. Training validity is not an independent collision reimplementation. Returned-pose overflow is not optimal-placement overflow. No shape correction was applied. Width-infeasible and unresolved requests do not have solved-answer labels and are outside this fitting assessment; the exact train-example manifest is retained.','', 'Joint copying precision requires the decoded fold count to match, vertex RMS <=0.1% L and angle MAE <=0.1 degrees. Error averages in raw summaries only include matching counts and report that denominator. Fold-count mismatch is a failure of the joint copying gate even if the alternate design is valid. Wall/opening counts require a valid design, zero floating creases and opening >=90% of the reference. This does not assess ranking optimality.','', 'These results describe fitting known training examples. They do not establish performance on unfamiliar boxes, superiority to a solver, neural-only end-to-end latency, continuous collision freedom, finite-thickness feasibility or manufacturing usefulness. The frozen validation comparison is the next decision; final test remains untouched.','', '## Evidence','', 'All three seeds and both recipes, shared-prefix baselines, initial weights, checkpoints, histories, per-answer gzip JSONL records, time/memory summaries and environment are retained in [results](results/). Manifest/checkpoint hashes confirm paired branches share the same start. No historical dataset or result was modified.','', 'Python regression suite passed before training, including training-split exclusion and seeded prefix repeatability. No geometry/solver code changed. All jobs are finished.']
(root/'REPORT.md').write_text('\n'.join(lines)+'\n')
print('\n'.join(lines[6:23]))
