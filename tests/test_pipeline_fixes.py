import json
import subprocess
import unittest
from pathlib import Path
import torch
from learning.v2 import Model, ROOT

class PipelineFixes(unittest.TestCase):
    def test_constant_feature_precision(self):
        torch.manual_seed(8)
        a=Model((8,)); a.mean[2]=torch.tensor(2/11);a.std[2]=1e-6
        b=Model((8,)).double();b.load_state_dict(a.state_dict())
        for x,y in zip(a(torch.tensor([[.2,.3,2/11]])),b(torch.tensor([[.2,.3,2/11]],dtype=torch.float64))):
            torch.testing.assert_close(x.double(),y,atol=1e-7,rtol=1e-6)
        a.std.fill_(.2);x=torch.tensor([[.2,.3,.4]])
        expected=a.folds(a.body((x-a.mean)/a.std));torch.testing.assert_close(a(x)[0],expected)

    def test_bridge_boundary_and_real_overflow(self):
        rows=json.loads((ROOT/'experiments/network-optimization-v1/results/positions-adam-float32-predictions.json').read_text())
        row=next(r for r in rows if r['checkerDisagreement'])
        ex=json.loads((ROOT/'experiments/memorization-v1/manifest.json').read_text())
        request=next(e['request'] for e in ex if e['id']==row['id'])
        payload=[{'id':'boundary','request':request,'design':row['design']},
                 {'id':'outside','request':{**request,'targetBox':[.01,.01,.01]},'design':row['design']}]
        result=subprocess.run(['node','scripts/assess-designs.js'],cwd=ROOT,input=''.join(json.dumps(r)+'\n' for r in payload),text=True,capture_output=True,check=True)
        out=[json.loads(l) for l in result.stdout.splitlines()]
        self.assertTrue(out[0]['passes']);self.assertFalse(out[1]['passes'])
