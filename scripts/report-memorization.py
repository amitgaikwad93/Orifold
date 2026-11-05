"""Post-run descriptive report; no training or checkpoint changes.
Supplementary pose sweep is a sampled placement diagnostic, not the primary evaluator.
"""
import json
import math
import sys
from pathlib import Path
import numpy as np
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from learning.memorization import section, write


def main(directory):
    root=Path(directory); out=root/'results'
    manifest={e['id']:e for e in json.loads((root/'manifest.json').read_text())}
    summary=json.loads((out/'summary.json').read_text())
    supplemental={}; models={}
    for mode in ['parameters','positions']:
        models[mode]=json.loads((out/f'{mode}-predictions.json').read_text())
        values=[]
        for row in models[mode]:
            e=manifest[row['id']]; L=e['request']['length']; d=row['design']
            xy=section(d)/L; usable=.98*np.asarray(e['request']['targetBox'])[[0,2]]/L
            # 18,000 orientations at 0.01 degree spacing. Translation to the bounding-box minimum.
            angles=np.arange(18000)*np.pi/18000
            xx=xy[:,0,None]*np.cos(angles)-xy[:,1,None]*np.sin(angles)
            zz=xy[:,0,None]*np.sin(angles)+xy[:,1,None]*np.cos(angles)
            excess=np.maximum(np.ptp(xx,axis=0)-usable[0],np.ptp(zz,axis=0)-usable[1])
            best=int(np.argmin(excess)); width=max(0,(d['width']-.98*e['request']['targetBox'][1])/L)
            psi=math.radians(e['answer']['design'].get('placement',0))
            ref_rot=xy@np.array([[math.cos(psi),math.sin(psi)],[-math.sin(psi),math.cos(psi)]])
            pose_overflow=max(0,float(np.max(np.ptp(ref_rot,axis=0)-usable)),width)
            values.append({'id':row['id'],'rawReturnedPoseOverflowOverL':row['metrics']['maxOverflowOverL'],
                           'referenceAngleZeroOffsetOverflowOverL':pose_overflow,
                           'sweepBestAngleDegrees':best*.01,'sweepBestOverflowOverL':max(0,float(excess[best]),width)})
        supplemental[mode]={'description':'Post-hoc 0.01-degree sweep, translation to minimum, no shape correction. Best found overflow is an upper bound on minimum possible overflow; not a feasibility proof. Primary pass counts are unchanged.',
                            'meanSweepBestOverflowOverL':float(np.mean([v['sweepBestOverflowOverL'] for v in values])),
                            'maxSweepBestOverflowOverL':max(v['sweepBestOverflowOverL'] for v in values),
                            'rows':values}
    write(out/'placement-diagnostic.json',supplemental)
    plt.rcParams.update({'font.size':10,'axes.spines.top':False,'axes.spines.right':False})
    fig,axes=plt.subplots(2,2,figsize=(12,8),layout='constrained')
    colors={'parameters':'#1879A6','positions':'#DE713B'}
    for mode in models:
        color=colors[mode]; history=json.loads((out/f'{mode}-history.json').read_text())
        axes[0,0].plot([v['epoch'] for v in history],[math.sqrt(v['vertexMseAfterStep'])*100 for v in history],label=mode,color=color)
        vals=sorted(r['metrics']['vertexRmsOverL']*100 for r in models[mode])
        axes[0,1].plot(range(1,33),vals,label=mode,color=color)
        angles=sorted(r['metrics']['angleMaeDegrees'] for r in models[mode])
        axes[1,0].plot(range(1,33),angles,label=mode,color=color)
    axes[0,0].set(title='Training shape error (all real vertices)',xlabel='Epoch',ylabel='RMS distance (% sheet length)',yscale='log')
    axes[0,0].legend()
    axes[0,1].set(title='Final shape errors, each arm sorted',xlabel='Training example rank',ylabel='Vertex RMS (% sheet length)')
    axes[0,1].axhline(.1,color='gray',ls='--',label='Copying gate'); axes[0,1].legend()
    axes[1,0].set(title='Final angle errors, each arm sorted',xlabel='Training example rank',ylabel='Mean absolute error (degrees)')
    axes[1,0].axhline(.1,color='gray',ls='--')
    labels=['Parameters','Positions']; xpos=np.arange(2)
    axes[1,1].bar(xpos-.18,[summary[m]['passes'] for m in models],.36,label='Sampled validity',color='#466779')
    axes[1,1].bar(xpos+.18,[summary[m]['validZeroFloatingInSpreadBand'] for m in models],.36,label='Also walls + opening band',color='#93B6A3')
    axes[1,1].set(title='Strict final outcomes: 32 training examples',xticks=xpos,xticklabels=labels,ylim=(0,34),ylabel='Designs')
    axes[1,1].legend()
    fig.suptitle('Small imitation diagnostic: closer shapes still fail tight box fits\nSame 32 training requests and initial weights; no held-out evaluation',fontsize=14)
    fig.savefig(out/'diagnostic.png',dpi=160)
    plt.close(fig)


if __name__=='__main__': main(sys.argv[1])
