"""Independent side-view tolerance metric audit on already-saved run-1 predictions."""
import gzip,json,math,subprocess,sys
from pathlib import Path
import numpy as np
sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from learning.memorization import section,write

root=Path(sys.argv[1]);out=root/'tolerance-audit';out.mkdir(exist_ok=False)
rows={r['id']:r for l in gzip.open('experiments/learning-v2b/dataset.jsonl.gz','rt') if (r:=json.loads(l))}
preds=[json.loads(l) for l in Path('experiments/learning-v2b/run-1/predictions-validation.jsonl').read_text().splitlines()]
records=[];psi=np.arange(3600)*np.pi/3600
for p in preds:
    req=rows[p['request']]['request'];d=p['proposed'];xy=section(d);u=.98*np.array(req['targetBox']);L=req['length']
    def extents(t):
        x=xy[:,0,None]*np.cos(t)-xy[:,1,None]*np.sin(t)
        z=xy[:,0,None]*np.sin(t)+xy[:,1,None]*np.cos(t)
        return np.ptp(x,axis=0),np.ptp(z,axis=0)
    def objective(t,relative):
        x,z=extents(np.atleast_1d(t))
        return np.maximum((x-u[0])/(u[0] if relative else L),(z-u[2])/(u[2] if relative else L))
    def best(relative):
        scores=objective(psi,relative);i=int(scores.argmin());t=float(psi[i]);v=float(scores[i]);step=math.radians(.025)
        while step>math.radians(1e-6):
            for trial in [t-step,t+step]:
                score=float(objective(trial,relative)[0])
                if score<v:t,v=trial,score
            step/=2
        return t,v
    a,absolute=best(False);b,relative=best(True)
    x,z=extents(np.array([a]));relative_at_absolute=max(0,float((x[0]-u[0])/u[0]),float((z[0]-u[2])/u[2]),(d['width']-u[1])/u[1])
    records.append({'id':p['id'],'sheetBestOverflow':max(0,absolute,(d['width']-u[1])/L),
                    'boxRelativeAtSheetBest':relative_at_absolute,
                    'boxRelativeBestOverflow':max(0,relative,(d['width']-u[1])/u[1]),
                    'sheetBestAngle':math.degrees(a),'boxBestAngle':math.degrees(b)})
# Historical file reports all run-1 designs rule-valid and contact-free; here isolate metric objective changes only.
thresholds=[0,.0025,.005,.01,.02,.03,.05,.1]
summary=[]
for t in thresholds:
    summary.append({'tolerance':t, 'sheet':sum(r['sheetBestOverflow']<=t+1e-12 for r in records),
        'boxAtSheetOptimum':sum(r['boxRelativeAtSheetBest']<=t+1e-12 for r in records),
        'boxAtOwnOptimum':sum(r['boxRelativeBestOverflow']<=t+1e-12 for r in records)})
write(out/'run1-metric-objectives.json',{'answers':len(records),'curves':summary,'records':records,
    'limits':'Finite 0.05-degree grid with local refinement, upper bounds on true minimum. Metrics-only recomputation; existing rule/contact evidence not independently rerun. No fit-rule changes.'})
p=subprocess.run(['node','scripts/tolerance-curve.js',str(root/'tolerance-width-fixture.jsonl')],capture_output=True,text=True,check=True)
(out/'width-fixture-output.txt').write_text(p.stdout)
print(json.dumps(summary,indent=2))
