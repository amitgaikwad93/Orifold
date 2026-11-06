"""Factorial optimizer/precision control on the unchanged shared network and frozen 32 examples."""
import copy
import hashlib
import json
import platform
import subprocess
import sys
import time
from pathlib import Path
import numpy as np
import torch
from learning import v2
from learning.independent_outputs import tensors, objective, progress, record
from learning.memorization import write


def load_start(checkpoint, dtype):
    ck=torch.load(checkpoint,weights_only=True,map_location='cpu')
    model=v2.Model(tuple(ck['hidden']))
    model.load_state_dict(ck['state']); return model.to(dtype=dtype)


def optimize(model, batch, mode, algorithm, config, log_every=100):
    """Fresh optimizer state in every arm; final iterate, never a geometry-selected checkpoint."""
    if algorithm=='adam':
        opt=torch.optim.Adam(model.parameters(),lr=config['adam']['learningRate'])
    elif algorithm=='lbfgs':
        opt=torch.optim.LBFGS(model.parameters(),**config['lbfgs'])
    else: raise ValueError(algorithm)
    evaluations=0; history=[]
    def closure():
        nonlocal evaluations
        opt.zero_grad(); loss=objective(model,batch,mode)
        if not torch.isfinite(loss): raise ValueError('Non-finite loss')
        loss.backward(); evaluations+=1
        if evaluations==1 or evaluations%log_every==0:
            history.append({'objectiveEvaluation':evaluations,'evaluatedLoss':float(loss.detach()),
                            'maxAbsGradient':max(float(p.grad.abs().max()) for p in model.parameters()),
                            **progress(model,batch)})
        if evaluations%1000==0:
            print(mode,algorithm,str(batch[0].dtype),evaluations,'loss',float(loss.detach()),flush=True)
        return loss
    before=float(objective(model,batch,mode).detach()); started=time.perf_counter()
    if algorithm=='adam':
        for _ in range(config['adam']['steps']): closure(); opt.step()
        iterations=config['adam']['steps']
    else:
        opt.step(closure)
        iterations=opt.state[next(model.parameters())]['n_iter']
    seconds=time.perf_counter()-started
    # This diagnostic evaluation does not update parameters or count against the training budget.
    opt.zero_grad(); final=objective(model,batch,mode); final.backward()
    grad=max(float(p.grad.abs().max()) for p in model.parameters())
    budget=config['adam']['steps'] if algorithm=='adam' else config['lbfgs']['max_eval']
    return {'beforeLoss':before,'finalLoss':float(final.detach()),'maxAbsGradient':grad,
            'objectiveEvaluations':evaluations,'iterations':iterations,'optimizationSeconds':seconds,
            'hitEvaluationBudget':evaluations>=budget,
            'hitIterationLimit':algorithm=='lbfgs' and iterations>=config['lbfgs']['max_iter'],
            'gradientToleranceMet':grad<=config['lbfgs']['tolerance_grad'] if algorithm=='lbfgs' else None,
            'finalPrecision':progress(model,batch)},history


def main(directory):
    directory=Path(directory); c=json.loads((directory/'config.json').read_text())
    manifest=(v2.ROOT/c['manifest']).read_bytes()
    assert hashlib.sha256(manifest).hexdigest()==c['manifestSha256']
    ex=json.loads(manifest)
    assert len(ex)==32 and len({e['requestId'] for e in ex})==32 and all(e['split']=='train' for e in ex)
    for spec in c['starts'].values():
        assert hashlib.sha256((v2.ROOT/spec['path']).read_bytes()).hexdigest()==spec['sha256']
    torch.set_num_threads(1); torch.use_deterministic_algorithms(True)
    out=directory/'results'; out.mkdir(exist_ok=False)
    summary={}
    for mode in c['losses']:
        start=v2.ROOT/c['starts'][mode]['path']
        for algorithm in ['adam','lbfgs']:
            for name,dtype in [('float32',torch.float32),('float64',torch.float64)]:
                arm=f'{mode}-{algorithm}-{name}'
                model=load_start(start,dtype); batch=tensors(ex,dtype)
                info,history=optimize(model,batch,mode,algorithm,c)
                write(out/f'{arm}-optimization.json',info); write(out/f'{arm}-history.json',history)
                summary[arm]={**record(out,arm,model,ex,batch),'optimization':info}
                if dtype==torch.float64:
                    # Cast every weight/buffer, then do a fresh float32 forward pass: deployment control.
                    cast=copy.deepcopy(model).float()
                    summary[arm+'-cast32']=record(out,arm+'-cast32',cast,ex,tensors(ex,torch.float32))
    write(out/'summary.json',summary)
    write(out/'environment.json',{'python':platform.python_version(),'torch':torch.__version__,'numpy':np.__version__,
          'platform':platform.platform(),'threads':torch.get_num_threads(),
          'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),
          'configSha256':hashlib.sha256((directory/'config.json').read_bytes()).hexdigest(),
          'manifestSha256':c['manifestSha256'],'starts':c['starts']})


if __name__=='__main__': main(sys.argv[1])
