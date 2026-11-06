"""Read-only analysis of saved designs; unchanged legacy correction, no new model inference."""
import gzip,hashlib,json,subprocess,sys,time
from pathlib import Path
import numpy as np
from learning import v2
from learning.full_training import training_examples
from learning.memorization import write


def invoke(script,items,args=()):
    payload=''.join(json.dumps(r)+'\n' for r in items)
    started=time.perf_counter()
    p=subprocess.run(['node',str(v2.ROOT/script),*map(str,args)],input=payload,capture_output=True,text=True,check=True,cwd=v2.ROOT)
    rows=[json.loads(l) for l in p.stdout.splitlines() if l.strip()]
    assert [r['id'] for r in rows]==[r['id'] for r in items]
    return rows,time.perf_counter()-started


def summarize(items,raw,checks):
    records=[]
    for item,r,q in zip(items,raw,checks):
        reference=item['reference']
        records.append({'id':item['id'],'rawCorrection':r,'assessment':q,
            'valid':bool(q['passes'] and q['budgetSatisfied']),
            'validWallsOpening':bool(q['passes'] and q['budgetSatisfied'] and q['floatingCreases']==0 and q['spread']>=.9*reference),
            'flagDisagreement':bool(r['passes']!=q['passes'])})
    n=len(records);passes=sum(r['valid'] for r in records)
    return records,{'examples':n,'passes':passes,'passRate':passes/n,'legacyPasses':sum(r['passes'] for r in raw),
        'validWallsOpening':sum(r['validWallsOpening'] for r in records),
        'passingWithZeroFloating':sum(r['valid'] and r['assessment']['floatingCreases']==0 for r in records),
        'flagDisagreements':sum(r['flagDisagreement'] for r in records),
        'medianOpeningAmongPassing':float(np.median([r['assessment']['spread'] for r in records if r['valid']])) if passes else None,
        'meanCorrectionMs':float(np.mean([r.get('ms',0) for r in raw])),
        'p90CorrectionMs':float(np.percentile([r.get('ms',0) for r in raw],90)),
        'meanEvaluations':float(np.mean([r.get('evaluations',0) for r in raw])),
        'maxEvaluations':max(r.get('evaluations',0) for r in raw),
        'overNominal400':sum(r.get('evaluations',0)>400 for r in raw)}


def save_records(path,rows):
    with gzip.open(path,'xt') as f:
        for r in rows:f.write(json.dumps(r,allow_nan=False)+'\n')


def run(directory):
    root=Path(directory);c=json.loads((root/'config.json').read_text());out=root/'results';out.mkdir(exist_ok=False)
    for path,sha in c['sourceHashes'].items():assert hashlib.sha256((v2.ROOT/path).read_bytes()).hexdigest()==sha
    ex=training_examples(v2.ROOT/c['dataset']);lookup={e['id']:e for e in ex};summaries={};controls={};groups={}
    for seed in c['seeds']:
        for stage in ['adam','lbfgs']:
            path=v2.ROOT/f'experiments/full-training-v1/results/seed-{seed}/{stage}/training-predictions.jsonl.gz'
            with gzip.open(path,'rt') as f:saved=[json.loads(l) for l in f]
            items=[];control_keys=[]
            for row in saved:
                e=lookup[row['id']];request=e['row']['request'];d=row['assessment']['design']
                reference=180-max(e['answer']['design']['angles'],default=0)
                items.append({'id':row['id'],'request':request,'design':d,'budget':e['budget'],'reference':reference})
                key=f"{row['id']}|k{len(d['angles'])}";control_keys.append(key)
                n=len(d['panelLengths'])
                controls[key]={'id':key,'request':request,'budget':e['budget'],'reference':reference,
                    'design':{'panelLengths':[request['length']/n]*n,'width':request['width'],'angles':[150.]*(n-1)}}
            name=f'seed-{seed}-{stage}'
            raw,seconds=invoke('scripts/repair-designs.js',items,[400])
            check_items=[{**item,'design':r['design']} for item,r in zip(items,raw)]
            checks,checkseconds=invoke('scripts/assess-saved-designs.js',check_items)
            records,summary=summarize(items,raw,checks)
            summary.update({'originalPasses':sum(r['assessment']['passes'] for r in saved),'correctionProcessSeconds':seconds,'reassessmentSeconds':checkseconds})
            summaries[name]=summary;groups[name]=control_keys
            save_records(out/f'{name}.jsonl.gz',records)
            print(name,summary,flush=True)
    # Unlearned continuous values, matched model fold count. Deduplicate identical controls across recipes/seeds.
    control_items=list(controls.values());raw,seconds=invoke('scripts/repair-designs.js',control_items,[400])
    checks,_=invoke('scripts/assess-saved-designs.js',[{**item,'design':r['design']} for item,r in zip(control_items,raw)])
    records,summary=summarize(control_items,raw,checks);save_records(out/'matched-count-controls.jsonl.gz',records)
    by={r['id']:r for r in records};matched={}
    for name,keys in groups.items():
        rs=[by[k] for k in keys]
        matched[name]={'examples':len(rs),'passes':sum(r['valid'] for r in rs),
            'validWallsOpening':sum(r['validWallsOpening'] for r in rs),
            'meanCorrectionMs':float(np.mean([r['rawCorrection']['ms'] for r in rs]))}
    write(out/'matched-count-control-summary.json',{'uniqueControls':summary,'processSeconds':seconds,'byModelGroup':matched})
    # Audit Claude's already-saved validation correction results only: no model prediction or selection.
    with gzip.open(v2.ROOT/c['dataset'],'rt') as f:allrows={r['id']:r for l in f if (r:=json.loads(l))}
    historic={}
    for kind in ['model','dumb-start']:
        path=v2.ROOT/f'experiments/learning-v2b/run-1/validation-{kind}-plus-correction.jsonl'
        raw=[json.loads(l) for l in path.read_text().splitlines()]
        items=[]
        for r in raw:
            rid,b=r['id'].rsplit('-b',1);row=allrows[rid];answer=next(a for a in row['answers'] if a['budget']==int(b))
            items.append({'id':r['id'],'request':row['request'],'budget':int(b),'design':r['design'],
                          'reference':180-max(answer['design']['angles'],default=0)})
        checks,_=invoke('scripts/assess-saved-designs.js',items);records,summary=summarize(items,raw,checks)
        save_records(out/f'historical-run1-{kind}.jsonl.gz',records);historic[kind]=summary
    write(out/'historical-run1-summary.json',historic);write(out/'summary.json',summaries)
    write(out/'environment.json',{'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),
        'newModelInference':False,'newValidationPredictions':False,'sourceHashes':c['sourceHashes']})


if __name__=='__main__':run(sys.argv[1])
