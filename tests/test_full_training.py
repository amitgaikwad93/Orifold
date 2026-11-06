import gzip
import json
import tempfile
import unittest
from pathlib import Path
import torch
from learning.full_training import training_examples,prefix
from learning.v2 import Model, loss_fn


class FullTrainingControls(unittest.TestCase):
    def test_held_out_answers_cannot_enter_training(self):
        train={'id':'one','split':'train','status':'found','request':{'length':100,'width':10,'targetBox':[60,12,60]},
               'answers':[{'budget':1,'design':{'panelLengths':[50,50],'width':10,'angles':[90]}}]}
        rows=[train,{'split':'validation','status':'found','answers':'poison'}, {'split':'test','status':'found','answers':None}]
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'dataset.gz'
            with gzip.open(p,'wt') as f:
                for row in rows:f.write(json.dumps(row)+'\n')
            ex=training_examples(p)
            self.assertEqual([e['id'] for e in ex],['one-b1'])
            self.assertTrue(all(e['row']['split']=='train' for e in ex))

    def test_seeded_prefix_is_repeatable(self):
        torch.set_num_threads(1)
        b=(torch.tensor([[.2,.3,.1],[.3,.4,.2]]),torch.tensor([1,2]),torch.full((2,11),.3),torch.full((2,11),.4),
           torch.tensor([[1.]+[0.]*10,[1.,1.]+[0.]*9]))
        states=[]
        for _ in range(2):
            torch.manual_seed(17);m=Model((8,));initial=float(loss_fn(m,*b).detach())
            info,_=prefix(m,b,{'epochs':3,'batchSize':1,'schedule':[{'fromEpoch':1,'learningRate':.01}]})
            states.append({k:t.clone() for k,t in m.state_dict().items()})
            self.assertEqual(info['updates'],6)
            self.assertLess(float(loss_fn(m,*b).detach()),initial)
        for k in states[0]:torch.testing.assert_close(states[0][k],states[1][k],rtol=0,atol=0)
