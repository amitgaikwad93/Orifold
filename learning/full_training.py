"""Frozen step-3 training experiment; only training rows enter any fitting or evaluation."""
import argparse
import copy
import gzip
import hashlib
import json
import platform
import resource
import subprocess
import sys
import time
from pathlib import Path
import numpy as np
import torch
from learning import v2
from learning.network_optimization import optimize, load_start
from learning.memorization import section, write


def training_examples(path):
    # Filter before keeping answer content; no held-out answers enter model fitting/evaluation.
    with gzip.open(path,'rt') as f:
        rows=[r for line in f if line.strip() and (r:=json.loads(line)).get('split')=='train']
    return v2.examples(rows,'train')


def prefix(model,batch,c):
    opt=torch.optim.Adam(model.parameters(),lr=c['schedule'][0]['learningRate'])
    history=[];updates=0;started=time.perf_counter()
    for epoch in range(1,c['epochs']+1):
        for stage in c['schedule']:
            if epoch==stage['fromEpoch']:
                for group in opt.param_groups:group['lr']=stage['learningRate']
        indices=torch.randperm(len(batch[0]))
        for i in range(0,len(indices),c['batchSize']):
            ix=indices[i:i+c['batchSize']];opt.zero_grad()
            loss=v2.loss_fn(model,*[t[ix] for t in batch]);loss.backward();opt.step();updates+=1
        if epoch==1 or epoch%100==0:
            with torch.no_grad():value=float(v2.loss_fn(model,*batch))
            history.append({'epoch':epoch,'updates':updates,'trainLoss':value})
            print('prefix',epoch,'loss',value,flush=True)
    with torch.no_grad(): final=float(v2.loss_fn(model,*batch))
    return {'updates':updates,'optimizationSeconds':time.perf_counter()-started,'finalLoss':final},history


def measure(model,ex):
    ds=v2.predict(model,ex)
    started=time.perf_counter()
    checked=v2.assess([(e['id'],e['row']['request'],d) for e,d in zip(ex,ds)])
    records=[]
    for e,d in zip(ex,ds):
        q=checked[e['id']];d=q.get('design',d);ref=e['answer']['design'];L=e['row']['request']['length']
        same=len(d['angles'])==len(ref['angles'])
        rms=float(np.sqrt(np.mean(np.sum(((section(d)-section(ref))/L)**2,axis=1)))) if same else None
        mae=float(np.mean(np.abs(np.asarray(d['angles'])-np.asarray(ref['angles'])))) if same and d['angles'] else 0. if same else None
        spread=180-max(ref['angles'],default=0)
        records.append({'id':e['id'],'requestId':e['row']['id'],'budget':e['budget'],'assessment':q,
                        'foldCountMatches':same,'vertexRmsOverL':rms,'angleMaeDegrees':mae,
                        'precisionGate':bool(same and rms<=.001 and mae<=.1),
                        'validWallsOpening':bool(q['passes'] and q.get('floating')==0 and q.get('spread',0)>=.9*spread)})
    n=len(records);passing=sum(r['assessment']['passes'] for r in records)
    reasons={}
    for r in records:
        if not r['assessment']['passes']:
            reason=r['assessment'].get('reason','unknown');reasons[reason]=reasons.get(reason,0)+1
    comparable=[r for r in records if r['foldCountMatches']]
    return records,{'examples':n,'passes':passing,'passRate':passing/n,'foldCountMatches':len(comparable),
        'precisionGateCount':sum(r['precisionGate'] for r in records),'validWallsOpening':sum(r['validWallsOpening'] for r in records),
        'zeroFloating':sum(r['assessment'].get('floating')==0 for r in records),
        'meanVertexRmsOverLAmongMatchingCounts':float(np.mean([r['vertexRmsOverL'] for r in comparable])) if comparable else None,
        'meanAngleMaeDegreesAmongMatchingCounts':float(np.mean([r['angleMaeDegrees'] for r in comparable])) if comparable else None,
        'failureReasons':reasons,'assessmentSeconds':time.perf_counter()-started}


def worker(directory,seed,stage):
    directory=Path(directory);c=json.loads((directory/'config.json').read_text());dataset=v2.ROOT/c['dataset']
    assert hashlib.sha256(dataset.read_bytes()).hexdigest()==c['datasetSha256']
    torch.set_num_threads(1);torch.use_deterministic_algorithms(True);torch.manual_seed(seed)
    ex=training_examples(dataset)
    manifest=json.loads((directory/'manifest.json').read_text());assert [e['id'] for e in ex]==manifest['exampleIds']
    out=directory/'results'/f'seed-{seed}'/stage;out.mkdir(parents=True,exist_ok=False)
    batch=v2.batch_tensors(ex)
    if stage=='prefix':
        model=v2.Model(tuple(c['hidden']));model.mean.copy_(batch[0].mean(0));model.std.copy_(batch[0].std(0).clamp(min=1e-6))
        torch.save({'state':copy.deepcopy(model.state_dict()),'hidden':c['hidden']},out/'initial.pt')
        info,history=prefix(model,batch,c['prefix'])
    else:
        start=directory/'results'/f'seed-{seed}'/'prefix'/'checkpoint.pt'
        model=load_start(start,torch.float32)
        info,history=optimize(model,batch,'parameters',stage,c,log_every=100)
        info['startCheckpointSha256']=hashlib.sha256(start.read_bytes()).hexdigest()
    training_rss=resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024
    torch.save({'state':model.state_dict(),'hidden':c['hidden']},out/'checkpoint.pt')
    write(out/'history.json',history)
    records,measurements=measure(model,ex)
    with gzip.open(out/'training-predictions.jsonl.gz','wt') as f:
        for r in records:f.write(json.dumps(r,allow_nan=False)+'\n')
    write(out/'summary.json',{'seed':seed,'stage':stage,'optimization':info,'training':measurements,
          'trainingPeakProcessRssMiB':training_rss,'endPeakProcessRssMiB':resource.getrusage(resource.RUSAGE_SELF).ru_maxrss/1024,
          'memoryDefinition':'Linux process high-water RSS, includes imports, data, model, optimizer; child Node assessor memory excluded',
          'parameters':sum(p.numel() for p in model.parameters()),'trainingRequests':len({e['row']['id'] for e in ex})})


def main(directory):
    directory=Path(directory);c=json.loads((directory/'config.json').read_text())
    out=directory/'results';out.mkdir(exist_ok=False)
    for seed in c['seeds']:
        for stage in ['prefix','adam','lbfgs']:
            subprocess.run([sys.executable,'-m','learning.full_training',str(directory),'--seed',str(seed),'--stage',stage],cwd=v2.ROOT,check=True)
    summaries=[json.loads((out/f'seed-{seed}'/stage/'summary.json').read_text()) for seed in c['seeds'] for stage in ['adam','lbfgs']]
    write(out/'summary.json',summaries)
    write(out/'environment.json',{'python':platform.python_version(),'torch':torch.__version__,'numpy':np.__version__,
          'platform':platform.platform(),'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),
          'configSha256':hashlib.sha256((directory/'config.json').read_bytes()).hexdigest(),
          'manifestSha256':hashlib.sha256((directory/'manifest.json').read_bytes()).hexdigest(),
          'validationAndTestEvaluated':False,'cpuOnly':True,'workerThreads':1})


if __name__=='__main__':
    p=argparse.ArgumentParser();p.add_argument('directory');p.add_argument('--seed',type=int);p.add_argument('--stage',choices=['prefix','adam','lbfgs']);a=p.parse_args()
    if a.stage:worker(a.directory,a.seed,a.stage)
    else:main(a.directory)
