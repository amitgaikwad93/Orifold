"""Frozen validation-only comparison; final test rows never retained or evaluated."""
import gzip,hashlib,json,platform,subprocess,sys,time
from pathlib import Path
from statistics import mean
import numpy as np
import torch
from learning import v2
from learning.memorization import section,write


def selected_rows(path):
    with gzip.open(path,'rt') as f:return [r for line in f if line.strip() and (r:=json.loads(line)).get('split') in ['train','validation']]


def invoke(script,items,*args):
    payload=''.join(json.dumps(x)+'\n' for x in items);start=time.perf_counter()
    p=subprocess.run(['node',script,*map(str,args)],input=payload,text=True,capture_output=True,check=True,cwd=v2.ROOT)
    out=[json.loads(l) for l in p.stdout.splitlines() if l.strip()]
    assert [x['id'] for x in items]==[x['id'] for x in out]
    return out,time.perf_counter()-start


def save(path,rows):
    with gzip.open(path,'xt') as f:
        for row in rows:f.write(json.dumps(row,allow_nan=False)+'\n')


def summarize(records):
    n=len(records);valid=[r for r in records if r['valid']];quality=[r for r in records if r['validWallsOpening']]
    return {'answers':n,'passes':len(valid),'passRate':len(valid)/n,'validWallsOpening':len(quality),'qualityRate':len(quality)/n,
      'passingZeroFloating':sum(r['floating']==0 for r in valid),
      'meanPipelineMs':mean(r['totalPipelineMs'] for r in records),'medianPipelineMs':float(np.median([r['totalPipelineMs'] for r in records])),
      'p90PipelineMs':float(np.percentile([r['totalPipelineMs'] for r in records],90)),
      'meanScoreCalls':mean(r['evaluations'] for r in records),'maxScoreCalls':max(r['evaluations'] for r in records),
      'foldCountMatches':sum(r['foldCountMatches'] for r in records),'precisionGateCount':sum(r['precisionGate'] for r in records),
      'medianOpeningAmongPassing':float(np.median([r['spread'] for r in valid])) if valid else None,
      'failureReasons':{'budget':sum(not r['budgetSatisfied'] for r in records),'rules':sum(bool(r['quality'].get('violations')) for r in records),
                        'contacts':sum(not r['quality']['contactFree'] for r in records),'fit':sum(not r['quality']['fits'] for r in records)}}


def score(name,ex,items,mode,prepms,out,c):
    records,wall=invoke('scripts/validation-pipeline.js',items,mode,c['correctionBudget'])
    for r,e,original in zip(records,ex,items):
        d=r['design'];ref=e['answer']['design'];L=e['row']['request']['length'];same=len(d['angles'])==len(ref['angles'])
        rms=float(np.sqrt(np.mean(np.sum(((section(d)-section(ref))/L)**2,axis=1)))) if same else None
        mae=float(np.mean(np.abs(np.asarray(d['angles'])-np.asarray(ref['angles'])))) if same and d['angles'] else 0. if same else None
        r.update({'valid':bool(r['passes'] and r['budgetSatisfied']),
          'validWallsOpening':bool(r['passes'] and r['budgetSatisfied'] and r['floating']==0 and r['spread']>=.9*(180-max(ref['angles'],default=0))),
          'foldCountMatches':same,'vertexRmsOverL':rms,'angleMaeDegrees':mae,'precisionGate':bool(same and rms<=.001 and mae<=.1),
          'initializationMsCharged':prepms,'totalPipelineMs':r['pipelineMs']+prepms,
          'maxPanelEditOverL':max(abs(x-y) for x,y in zip(d['panelLengths'],original['design']['panelLengths']))/L if len(d['panelLengths'])==len(original['design']['panelLengths']) else None,
          'maxAngleEditDegrees':max((abs(x-y) for x,y in zip(d['angles'],original['design']['angles'])),default=0) if len(d['angles'])==len(original['design']['angles']) else None})
    save(out/f'{name}.jsonl.gz',records)
    summary=summarize(records);summary['nodeBatchWallSecondsIncludingIpc']=wall
    # Separate diagnostic computation is never charged as deployment work.
    metrics,_=invoke('scripts/validation-diagnostics.js',[{'id':r['id'],'request':r['request'],'design':r['design']} for r in records])
    curves=[]
    for tol in c['tolerances']:
        eligible=[(r,m) for r,m in zip(records,metrics) if r['budgetSatisfied'] and not r['quality']['violations'] and r['quality']['contactFree']]
        curves.append({'tolerance':tol,'sheet':sum(m['sheet']['overflow']<=tol+1e-12 for r,m in eligible),
                      'usableBox':sum(m['box']['overflow']<=tol+1e-12 for r,m in eligible)})
    save(out/f'{name}-tolerance.jsonl.gz',metrics);summary['toleranceCurves']=curves
    write(out/f'{name}-summary.json',summary);print(name,summary['passes'],summary['validWallsOpening'],round(summary['meanPipelineMs'],3),flush=True)
    return summary,records


def main(directory):
    directory=Path(directory);c=json.loads((directory/'config.json').read_text())
    for path,sha in c['sourceHashes'].items():assert hashlib.sha256((v2.ROOT/path).read_bytes()).hexdigest()==sha
    rows=selected_rows(v2.ROOT/c['dataset']);tr=v2.examples(rows,'train');va=v2.examples(rows,'validation')
    manifest=json.loads((directory/'manifest.json').read_text());assert [e['id'] for e in va]==manifest['exampleIds']
    torch.set_num_threads(1);torch.use_deterministic_algorithms(True)
    out=directory/'results';out.mkdir(exist_ok=False);summaries={};subset_records={}
    def items(designs):return [{'id':e['id'],'request':e['row']['request'],'budget':e['budget'],'design':d} for e,d in zip(va,designs)]
    for seed in c['seeds']:
        for stage in ['adam','lbfgs']:
            checkpoint=v2.ROOT/f'experiments/full-training-v1/results/seed-{seed}/{stage}/checkpoint.pt'
            model=v2.load_model(checkpoint.parent);start=time.perf_counter();designs=v2.predict(model,va);prep=(time.perf_counter()-start)*1000/len(va)
            for mode in ['raw','repair']:
                name=f'seed-{seed}-{stage}-{mode}';s,records=score(name,va,items(designs),mode,prep,out,c)
                summaries[name]=s;subset_records[name]=[r for r in records if r['id'].rsplit('-b',1)[0] in manifest['liveSolverRequestIds']]
    # Resident nearest-neighbour index built using training labels only. Same-budget canonical box-ratio distance.
    bybudget={b:[e for e in tr if e['budget']==b] for b in {e['budget'] for e in va}}
    assert all(bybudget.values());coordinates={b:np.array([a['x'][:2] for a in candidates]) for b,candidates in bybudget.items()};start=time.perf_counter();designs=[];neighbors=[]
    for e in va:
        candidates=bybudget[e['budget']];point=np.array(e['x'][:2]);xs=coordinates[e['budget']];ix=int(np.sum((xs-point)**2,axis=1).argmin());chosen=candidates[ix]
        d=chosen['answer']['design'];ratio=e['row']['request']['length']/chosen['row']['request']['length']
        designs.append({'panelLengths':[x*ratio for x in d['panelLengths']],'width':e['row']['request']['width'],'angles':d['angles'][:]});neighbors.append({'id':e['id'],'trainingExampleId':chosen['id']})
    prep=(time.perf_counter()-start)*1000/len(va);save(out/'nearest-neighbors.jsonl.gz',neighbors)
    for mode in ['raw','repair']:
        name='nearest-'+mode;s,rs=score(name,va,items(designs),mode,prep,out,c);summaries[name]=s;subset_records[name]=[r for r in rs if r['id'].rsplit('-b',1)[0] in manifest['liveSolverRequestIds']]
    start=time.perf_counter();designs=[{'panelLengths':[e['row']['request']['length']/(e['budget']+1)]*(e['budget']+1),
       'width':e['row']['request']['width'],'angles':[150.]*e['budget']} for e in va];prep=(time.perf_counter()-start)*1000/len(va)
    for mode in ['repair','multistart']:
        name='simple-'+mode;s,rs=score(name,va,items(designs),mode,prep if mode=='repair' else 0,out,c);summaries[name]=s;subset_records[name]=[r for r in rs if r['id'].rsplit('-b',1)[0] in manifest['liveSolverRequestIds']]
    s,_=score('reference-cached',va,items([e['answer']['design'] for e in va]),'cached',0,out,c);summaries['reference-cached']=s
    lookup={r['id']:r for r in rows if r['split']=='validation'}
    liveitems=[{'id':rid,'request':lookup[rid]['request'],'budgets':[a['budget'] for a in lookup[rid]['answers']]} for rid in manifest['liveSolverRequestIds']]
    live,wall=invoke('scripts/validation-pipeline.js',liveitems,'reference',c['correctionBudget']);save(out/'reference-live.jsonl.gz',live)
    write(out/'live-subset-comparisons.json',{'reference':{'requests':len(live),'meanMsPerRequestAllBudgets':mean(r['pipelineMs'] for r in live),
        'passes':sum(a['result'] is not None and a['result']['passes'] for r in live for a in r['answers']),
        'answers':sum(len(r['answers']) for r in live),'batchWallSeconds':wall},
        'methods':{name:{'answers':len(rs),'passes':sum(r['valid'] for r in rs),
                        'meanMsPerRequestAllBudgets':sum(r['totalPipelineMs'] for r in rs)/len(live)} for name,rs in subset_records.items()}})
    write(out/'summary.json',summaries)
    write(out/'environment.json',{'python':sys.version,'torch':torch.__version__,'numpy':np.__version__,'node':subprocess.check_output(['node','--version'],text=True).strip(),
        'platform':platform.platform(),'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),'testEvaluated':False,
        'configSha256':hashlib.sha256((directory/'config.json').read_bytes()).hexdigest()})


if __name__=='__main__':main(sys.argv[1])
