"""Training-only controlled diagnostic. Reads a frozen manifest; never loads held-out examples.
Run: python -m learning.memorization experiments/memorization-v1
"""
import copy
import hashlib
import json
import math
import platform
import subprocess
import sys
import time
from pathlib import Path
import numpy as np
import torch
from learning import v2
from learning.geometry import fold, contacts


def write(path, value):
    with path.open('x') as f:
        json.dump(value, f, indent=2, allow_nan=False); f.write('\n')


def section(design):
    return (np.asarray([[0.,0.],[design['panelLengths'][0],0.]]) if len(design['panelLengths'])==1
            else np.asarray(fold(design)['section']))


def geometric_metrics(design, reference, request, budget):
    """Independent final placement and contact measurements, including non-fitting designs."""
    length = request['length']
    raw = section(design)
    psi = math.radians(design.get('placement', 0))
    turned = raw @ np.array([[math.cos(psi),math.sin(psi)],[-math.sin(psi),math.cos(psi)]])
    placed = turned - turned.min(axis=0) + np.asarray(design.get('offset',[0,0]))
    usable = .98*np.asarray(request['targetBox'])[[0,2]]
    overshoot = np.maximum(0, np.maximum(-placed.min(axis=0),placed.max(axis=0)-usable))
    width_overshoot = max(0,design['width']-.98*request['targetBox'][1])
    eps = 1e-9*max(length,request['width'],*request['targetBox'])
    fits = max(*overshoot,width_overshoot) <= eps
    distances = np.minimum(np.abs(placed[1:-1]),np.abs(usable-placed[1:-1]))
    floating = int(np.sum(distances.min(axis=1) > .005*length)) if len(distances) else 0
    blocked = ([i for i in range(721) if contacts(fold(design,i/720))['blocked']]
               if len(design['panelLengths'])>1 else [])
    k = len(design['angles'])
    rules = (k<=budget and all(p >= .05*length-1e-9*length for p in design['panelLengths'])
             and abs(sum(design['panelLengths'])-length)<=1e-9*length
             and all(1<=a<=180 for a in design['angles']) and design['width']==request['width'])
    same = k==len(reference['angles'])
    delta = (raw-section(reference))/length if same else None
    crease = (np.cumsum(design['panelLengths'])[:-1]-np.cumsum(reference['panelLengths'])[:-1])/length if same else None
    angle_error = np.asarray(design['angles'])-np.asarray(reference['angles']) if same else None
    spread = 180-max(design['angles'],default=0)
    ref_spread = 180-max(reference['angles'],default=0)
    return {'fits': bool(fits), 'rules': bool(rules), 'contactFree': not blocked,
            'passes': bool(fits and rules and not blocked), 'firstBlockedStep': blocked[0] if blocked else None,
            'blockedStateCount': len(blocked), 'folds': k, 'floatingCreases': floating,
            'overflowByAxisOverL': [float(overshoot[0]/length),width_overshoot/length,float(overshoot[1]/length)],
            'maxOverflowOverL': float(max(*overshoot,width_overshoot)/length),
            'vertexRmsOverL': float(np.sqrt(np.mean(np.sum(delta**2,axis=1)))) if same else None,
            'creasePositionRmsOverL': float(np.sqrt(np.mean(crease**2))) if same and k else 0 if same else None,
            'angleMaeDegrees': float(np.mean(np.abs(angle_error))) if same and k else 0 if same else None,
            'openingErrorDegrees': spread-ref_spread, 'spread': spread,
            'withinReferenceSpreadBand': spread>=.9*ref_spread}


def evaluate(examples, designs, search):
    judged = v2.assess([(e['id'],e['request'],copy.deepcopy(d)) for e,d in zip(examples,designs)]) if search else {}
    rows=[]
    for e,d in zip(examples,designs):
        node = judged.get(e['id'])
        placed = node.get('design',d) if node else d
        metric = geometric_metrics(placed,e['answer']['design'],e['request'],e['budget'])
        rows.append({'id':e['id'],'design':placed,'metrics':metric,'referenceChecker':node,
                     'checkerDisagreement': bool(node and node['passes']!=metric['passes'])})
    return rows


def summarize(rows):
    m=[r['metrics'] for r in rows]
    out={'examples':len(rows), 'passes':sum(r['passes'] for r in m), 'fits':sum(r['fits'] for r in m),
         'contactFree':sum(r['contactFree'] for r in m), 'zeroFloating':sum(r['floatingCreases']==0 for r in m),
         'validZeroFloatingInSpreadBand':sum(r['passes'] and r['floatingCreases']==0 and r['withinReferenceSpreadBand'] for r in m),
         'checkerDisagreements':sum(r['checkerDisagreement'] for r in rows)}
    for key in ['vertexRmsOverL','creasePositionRmsOverL','angleMaeDegrees','maxOverflowOverL','openingErrorDegrees']:
        values=[r[key] for r in m if r[key] is not None]
        out[key]={'mean':float(np.mean(values)), 'median':float(np.median(values)),
                  'maxAbs':float(np.max(np.abs(values)))} if values else None
    out['precisionGateCount']=sum(r['vertexRmsOverL'] is not None and r['vertexRmsOverL']<=.001 and r['angleMaeDegrees']<=.1 for r in m)
    return out


def main(directory):
    directory=Path(directory)
    config=json.loads((directory/'config.json').read_text())
    manifest_bytes=(directory/'manifest.json').read_bytes()
    if hashlib.sha256(manifest_bytes).hexdigest()!=config['manifestSha256']:
        raise ValueError('Frozen manifest changed')
    ex=json.loads(manifest_bytes)
    assert len(ex)==32 and len({e['requestId'] for e in ex})==32
    assert all(e['split']=='train' and e['budget']==config['budget'] and
               e['answer']['family']==config['family'] and len(e['answer']['design']['angles'])==config['folds'] for e in ex)
    out=directory/'results'; out.mkdir(exist_ok=False)
    torch.set_num_threads(config['threads']); torch.manual_seed(config['modelSeed'])
    torch.use_deterministic_algorithms(True)
    converted=[]
    for e in ex:
        k,v,a,mask=v2.label_targets(e['answer'],e['request'])
        converted.append({'x':v2.features(e['request'],e['budget']),'k':k,'v':v,'ang':a,'mask':mask})
    x,k,v,a,mask=v2.batch_tensors(converted)
    base=v2.Model(tuple(config['hidden']))
    base.mean.copy_(x.mean(0)); base.std.copy_(x.std(0).clamp(min=1e-6))
    torch.save({'state':base.state_dict(),'hidden':config['hidden']},out/'initial-state.pt')
    summary={}
    originals=[e['answer']['design'] for e in ex]
    for name,ds,search in [('original',originals,False),('original-searched',originals,True)]:
        rows=evaluate(ex,ds,search); write(out/f'{name}.json',rows); summary[name]=summarize(rows)
    if summary['original']['passes']!=32: raise ValueError('Reference validity baseline failed')
    for dtype in [torch.float64,torch.float32]:
        ds=[]
        for e,c in zip(ex,converted):
            logits=torch.full((12,),-100.,dtype=dtype); logits[c['k']]=100
            d=v2.decode(logits,torch.tensor(c['v'],dtype=dtype),torch.tensor(c['ang'],dtype=dtype),e['request'],e['budget'])
            d.update({key:e['answer']['design'].get(key,default) for key,default in [('placement',0),('offset',[0,0])]})
            ds.append(d)
        for search in [False,True]:
            name=f'roundtrip-{str(dtype).split(".")[-1]}'+('-searched' if search else '')
            rows=evaluate(ex,ds,search); write(out/f'{name}.json',rows); summary[name]=summarize(rows)
    for mode in ['parameters','positions']:
        model=copy.deepcopy(base); opt=torch.optim.Adam(model.parameters(),lr=config['schedule'][0]['learningRate'])
        history=[]; start=time.perf_counter()
        for epoch in range(1,config['epochs']+1):
            for stage in config['schedule']:
                if epoch==stage['fromEpoch']:
                    for group in opt.param_groups: group['lr']=stage['learningRate']
            opt.zero_grad()
            loss=(v2.loss_fn(model,x,k,v,a,mask) if mode=='parameters' else v2.position_loss(model,x,k,v,a,config['positionWeight']))
            loss.backward(); opt.step()
            if epoch==1 or epoch%100==0:
                with torch.no_grad():
                    fl,pv,pa=model(x); zero=x.new_zeros(len(x))
                    mse=v2.vertex_mse(*v2.fold_vertices(pv,pa,k,zero),*v2.fold_vertices(v,a,k,zero),k)
                    history.append({'epoch':epoch,'lossBeforeStep':float(loss.detach()),'vertexMseAfterStep':float(mse),
                                    'foldAccuracy':float((fl.argmax(1)==k).float().mean()),'learningRate':opt.param_groups[0]['lr']})
                if epoch%1000==0: print(mode,history[-1],flush=True)
        seconds=time.perf_counter()-start
        torch.save({'state':model.state_dict(),'hidden':config['hidden']},out/f'{mode}.pt')
        write(out/f'{mode}-history.json',history)
        with torch.no_grad(): fl,pv,pa=model(x)
        designs=[v2.decode(fl[i],pv[i],pa[i],e['request'],e['budget']) for i,e in enumerate(ex)]
        rows=evaluate(ex,designs,True); write(out/f'{mode}-predictions.json',rows)
        summary[mode]={**summarize(rows),'seconds':seconds,'finalFoldAccuracy':history[-1]['foldAccuracy']}
        print(mode,json.dumps(summary[mode]),flush=True)
    write(out/'summary.json',summary)
    write(out/'environment.json',{'python':platform.python_version(),'torch':torch.__version__,'numpy':np.__version__,
          'platform':platform.platform(),'cpu':platform.processor(),'sourceCommit':subprocess.check_output(['git','rev-parse','HEAD'],text=True).strip(),
          'workingTree':subprocess.check_output(['git','status','--short'],text=True).strip(),
          'configSha256':hashlib.sha256((directory/'config.json').read_bytes()).hexdigest(),
          'manifestSha256':config['manifestSha256'],'threads':torch.get_num_threads(),
          'parameters':sum(p.numel() for p in base.parameters())})


if __name__=='__main__': main(sys.argv[1])
