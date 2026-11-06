"""Post-hoc inference-only audit. No retraining or replacement of primary experiment outcomes."""
import json
import subprocess
import sys
from pathlib import Path
import numpy as np
import torch
from learning import v2
from learning.independent_outputs import tensors, record
from learning.memorization import write


class NormalizedInputNetwork(v2.Model):
    """Same weights and layers, takes already-standardized input coordinates for this control."""
    def forward(self,z):
        h=self.body(z);s=torch.sigmoid(self.shape(h))
        return self.folds(h),s[:,:v2.MAX_FOLDS],s[:,v2.MAX_FOLDS:]


def main(directory):
    root=Path(directory);config=json.loads((root/'config.json').read_text())
    ex=json.loads((v2.ROOT/config['manifest']).read_text())
    b32=tensors(ex,torch.float32);b64=tensors(ex,torch.float64)
    torch.set_num_threads(1)
    out=root/'precision-audit';out.mkdir(exist_ok=False)
    result={};disagreements=[]
    for mode in config['losses']:
        for algorithm in ['adam','lbfgs']:
            arm=f'{mode}-{algorithm}-float64'
            original=v2.Model(tuple(config['hidden'])).double()
            original.load_state_dict(torch.load(root/'results'/f'{arm}.pt',weights_only=True))
            z64=(b64[0]-original.mean)/original.std
            matched=NormalizedInputNetwork(tuple(config['hidden']))
            matched.load_state_dict(original.state_dict()) # copies/casts weights and buffers to float32
            z32=(b32[0]-matched.mean)/matched.std
            with torch.no_grad():
                orig=original(b64[0]); samevalues=original(b32[0].double()); fixed=matched(z64.float())
                def max_shape_difference(a,b):
                    return {'stickFraction':float((a[1].double()-b[1].double()).abs().max()),
                            'foldAngleDegrees':float((179*(a[2].double()-b[2].double())).abs()[:,:2].max())}
                differences={'float64NetworkWithFloat32EncodedInputs':max_shape_difference(orig,samevalues),
                             'float32NetworkWithMatchedNormalizedInputs':max_shape_difference(orig,fixed)}
            metrics=record(out,arm+'-matched-input32',matched,ex,(z64.float(),*b32[1:]))
            result[arm]={'normalizedBudget64':float(z64[0,2]),'normalizedBudget32':float(z32[0,2]),
                         'input64':float(b64[0][0,2]),'input32':float(b32[0][0,2]),
                         'meanBudget':float(original.mean[2]),'stdBudget':float(original.std[2]),
                         'maxNormalizedInputDifferenceByAxis':(z64-z32.double()).abs().max(0).values.tolist(),
                         'outputDifferences':differences,'matchedInputResult':metrics}
    # Inspect all raw mismatches without altering those files or their summary.
    for directory_name in ['results','precision-audit']:
        for f in sorted((root/directory_name).glob('*-predictions.json')):
            for row in json.loads(f.read_text()):
                if row['checkerDisagreement']:
                    request=next(e['request'] for e in ex if e['id']==row['id'])
                    script="const fs=require('fs'),{assess}=require('./src/packing');const x=JSON.parse(fs.readFileSync(0,'utf8'));console.log(JSON.stringify(assess(x.design,x.request)));"
                    direct=subprocess.run(['node','-e',script],cwd=v2.ROOT,input=json.dumps({'design':row['design'],'request':request}),capture_output=True,text=True,check=True)
                    disagreements.append({'file':str(f),'id':row['id'],'independent':row['metrics'],
                        'bridge':row['referenceChecker'],'directAssessment':json.loads(direct.stdout)})
    write(out/'summary.json',result);write(out/'decision-disagreements.json',disagreements)
    print(json.dumps({k:{'matchedInputPasses':r['matchedInputResult']['passes'],
                        'outputDifferences':r['outputDifferences']} for k,r in result.items()},indent=2))


if __name__=='__main__':main(sys.argv[1])
