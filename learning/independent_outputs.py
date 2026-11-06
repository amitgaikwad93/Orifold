"""Independent-output control: same decoder/losses, no learned mapping across requests."""
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
from torch import nn
from learning import v2
from learning.memorization import evaluate, summarize, section, write


class IndependentOutputs(nn.Module):
    """Each row belongs to exactly one request; no parameters or optimizer moments are shared."""
    def __init__(self, fold_logits, shape_logits):
        super().__init__()
        self.folds = nn.Parameter(fold_logits.detach().clone())
        self.shape = nn.Parameter(shape_logits.detach().clone())

    def forward(self, x):
        if len(x) != len(self.shape):
            raise ValueError('One independent output row is required per example')
        shape = torch.sigmoid(self.shape)
        return self.folds, shape[:, :v2.MAX_FOLDS], shape[:, v2.MAX_FOLDS:]


def tensors(ex, dtype):
    targets = [v2.label_targets(e['answer'], e['request']) for e in ex]
    return (torch.tensor([v2.features(e['request'], e['budget']) for e in ex], dtype=dtype),
            torch.tensor([t[0] for t in targets]),
            *[torch.tensor([t[i] for t in targets], dtype=dtype) for i in [1,2,3]])


def objective(model, batch, mode):
    x,k,v,a,mask = batch
    return (v2.loss_fn(model,x,k,v,a,mask) if mode == 'parameters'
            else v2.position_loss(model,x,k,v,a,weight=10.0))


def progress(model, batch):
    x,k,v,a,mask = batch
    with torch.no_grad():
        fl,pv,pa = model(x); zero = x.new_zeros(len(x))
        px,pz = v2.fold_vertices(pv,pa,k,zero); rx,rz = v2.fold_vertices(v,a,k,zero)
        valid = torch.arange(px.shape[1])[None,:] < (k+2)[:,None]
        rms = torch.sqrt((((px-rx)**2+(pz-rz)**2)*valid).sum(1)/(k+2))
        mae = (179*(pa-a).abs()*mask).sum(1)/mask.sum(1).clamp(min=1)
        return {'foldAccuracy':float((fl.argmax(1)==k).double().mean()),
                'meanVertexRmsOverL':float(rms.mean()), 'maxVertexRmsOverL':float(rms.max()),
                'meanAngleMaeDegrees':float(mae.mean()),'maxAngleMaeDegrees':float(mae.max()),
                'precisionGateCount':int(((rms<=.001)&(mae<=.1)).sum())}


def sweep_overflow(design, request):
    """Best found over 18,000 rotations, not a proof of minimum possible overflow."""
    xy=section(design)/request['length']; u=.98*np.asarray(request['targetBox'])[[0,2]]/request['length']
    psi=np.arange(18000)*np.pi/18000
    x=xy[:,0,None]*np.cos(psi)-xy[:,1,None]*np.sin(psi)
    z=xy[:,0,None]*np.sin(psi)+xy[:,1,None]*np.cos(psi)
    over=np.maximum(np.ptp(x,axis=0)-u[0], np.ptp(z,axis=0)-u[1]); i=int(over.argmin())
    width=max(0,(design['width']-.98*request['targetBox'][1])/request['length'])
    return {'angleDegrees':i*.01, 'overflowOverL':max(0,float(over[i]),width)}


def record(out, name, model, ex, batch):
    with torch.no_grad(): fl,v,a = model(batch[0])
    designs=[v2.decode(fl[i],v[i],a[i],e['request'],e['budget']) for i,e in enumerate(ex)]
    rows=evaluate(ex,designs,True)
    for row,e in zip(rows,ex): row['rotationSweep']=sweep_overflow(row['design'],e['request'])
    write(out/f'{name}-predictions.json',rows)
    saved=[{**d, 'placement':e['answer']['design'].get('placement',0),
            'offset':e['answer']['design'].get('offset',[0,0])} for d,e in zip(designs,ex)]
    fixed=evaluate(ex,saved,False); write(out/f'{name}-saved-placement.json',fixed)
    torch.save(model.state_dict(),out/f'{name}.pt')
    summary={**summarize(rows), 'savedPlacement':summarize(fixed), 'precision':progress(model,batch),
             'meanSweepOverflowOverL':float(np.mean([r['rotationSweep']['overflowOverL'] for r in rows])),
             'maxSweepOverflowOverL':max(r['rotationSweep']['overflowOverL'] for r in rows)}
    print(name,json.dumps({k:summary[k] for k in ['passes','precisionGateCount','contactFree','checkerDisagreements']}),flush=True)
    return summary


def refine_one(model, batch, mode, settings):
    opt=torch.optim.LBFGS(model.parameters(),**settings)
    evaluations=0
    def closure():
        nonlocal evaluations
        opt.zero_grad(); loss=objective(model,batch,mode)
        if not torch.isfinite(loss): raise ValueError('Non-finite objective')
        loss.backward(); evaluations+=1
        return loss
    before=float(objective(model,batch,mode).detach()); opt.step(closure)
    # Record final gradients separately; this is not an optimizer evaluation.
    opt.zero_grad(); final=objective(model,batch,mode); final.backward()
    state=opt.state[model.folds]
    return {'beforeLoss':before,'finalLoss':float(final.detach()),'closureEvaluations':evaluations,
            'iterations':state['n_iter'],'maxAbsGradient':max(float(p.grad.abs().max()) for p in model.parameters()),
            'hitIterationLimit':state['n_iter']>=settings['max_iter'],
            'hitEvaluationLimit':evaluations>=settings['max_eval'], **progress(model,batch)}


def main(directory):
    directory=Path(directory); c=json.loads((directory/'config.json').read_text())
    manifest=(v2.ROOT/c['manifest']).read_bytes()
    assert hashlib.sha256(manifest).hexdigest()==c['manifestSha256']
    initial=v2.ROOT/c['initialCheckpoint']
    assert hashlib.sha256(initial.read_bytes()).hexdigest()==c['initialCheckpointSha256']
    ex=json.loads(manifest)
    assert len(ex)==32 and len({e['requestId'] for e in ex})==32 and all(e['split']=='train' for e in ex)
    out=directory/'results'; out.mkdir(exist_ok=False)
    torch.set_num_threads(1); torch.use_deterministic_algorithms(True)
    b32=tensors(ex,torch.float32)
    ck=torch.load(initial,weights_only=True,map_location='cpu')
    network=v2.Model(tuple(ck['hidden'])); network.load_state_dict(ck['state']); network.eval()
    with torch.no_grad():
        h=network.body((b32[0]-network.mean)/network.std)
        base=IndependentOutputs(network.folds(h),network.shape(h))
        assert all(torch.equal(a,b) for a,b in zip(network(b32[0]),base(b32[0])))
    torch.save(base.state_dict(),out/'initial-independent.pt')
    summary={}
    for mode in ['parameters','positions']:
        model=copy.deepcopy(base); adam=c['adam']; opt=torch.optim.Adam(model.parameters(),lr=adam['schedule'][0]['learningRate'])
        history=[]; start=time.perf_counter()
        for step in range(1,adam['steps']+1):
            for stage in adam['schedule']:
                if step==stage['fromStep']:
                    for group in opt.param_groups: group['lr']=stage['learningRate']
            opt.zero_grad(); loss=objective(model,b32,mode); loss.backward(); opt.step()
            if step==1 or step%100==0:
                history.append({'step':step,'lossBeforeStep':float(loss.detach()),**progress(model,b32)})
        seconds=time.perf_counter()-start
        write(out/f'{mode}-adam-history.json',history)
        summary[f'{mode}-adam']={**record(out,f'{mode}-adam',model,ex,b32),'optimizationSeconds':seconds}
        refined=copy.deepcopy(model).double(); diagnostics=[]; start=time.perf_counter()
        # Separate optimizer and line search per request: no cross-request coupling in L-BFGS.
        for i,e in enumerate(ex):
            one=IndependentOutputs(refined.folds[i:i+1],refined.shape[i:i+1])
            info=refine_one(one,tensors([e],torch.float64),mode,c['lbfgs'])
            diagnostics.append({'id':e['id'],**info})
            with torch.no_grad(): refined.folds[i].copy_(one.folds[0]); refined.shape[i].copy_(one.shape[0])
            if (i+1)%8==0: print(mode,'refined',i+1,'/32',flush=True)
        seconds=time.perf_counter()-start
        write(out/f'{mode}-lbfgs-optimization.json',diagnostics)
        summary[f'{mode}-lbfgs64']={**record(out,f'{mode}-lbfgs64',refined,ex,tensors(ex,torch.float64)),
                                     'optimizationSeconds':seconds}
        cast=copy.deepcopy(refined).float()
        summary[f'{mode}-cast32']=record(out,f'{mode}-cast32',cast,ex,b32)
    write(out/'summary.json',summary)
    write(out/'environment.json',{'python':platform.python_version(),'torch':torch.__version__,'numpy':np.__version__,
          'platform':platform.platform(),'threads':torch.get_num_threads(),
          'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),
          'configSha256':hashlib.sha256((directory/'config.json').read_bytes()).hexdigest(),
          'manifestSha256':c['manifestSha256'],'initialCheckpointSha256':c['initialCheckpointSha256']})


if __name__=='__main__': main(sys.argv[1])
