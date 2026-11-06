import copy
import tempfile
import unittest
from pathlib import Path
import torch
from learning import v2
from learning.network_optimization import load_start, optimize


class NetworkOptimization(unittest.TestCase):
    def test_start_preserves_weights_and_normalization_in_both_precisions(self):
        torch.manual_seed(12); model=v2.Model((8,)); model.mean.copy_(torch.tensor([.1,.2,.3]))
        with tempfile.TemporaryDirectory() as tmp:
            path=Path(tmp)/'checkpoint.pt'; torch.save({'state':model.state_dict(),'hidden':[8]},path)
            for dtype in [torch.float32,torch.float64]:
                start=load_start(path,dtype)
                for name,t in start.state_dict().items():
                    self.assertEqual(t.dtype,dtype)
                    torch.testing.assert_close(t,model.state_dict()[name].to(dtype),rtol=0,atol=0)

    def test_training_arms_are_separate_and_count_evaluations(self):
        torch.manual_seed(12); original=v2.Model((8,)).double()
        frozen=copy.deepcopy(original.state_dict())
        batch=(torch.tensor([[.2,.4,.18],[.3,.5,.18]],dtype=torch.float64),torch.tensor([2,2]),
               torch.full((2,11),.3,dtype=torch.float64),torch.full((2,11),.6,dtype=torch.float64),
               torch.tensor([[1,1]+[0]*9]*2,dtype=torch.float64))
        c={'adam':{'learningRate':.001,'steps':8},'lbfgs':{'lr':1.,'max_iter':8,'max_eval':12,
             'tolerance_grad':1e-12,'tolerance_change':1e-16,'history_size':5,'line_search_fn':'strong_wolfe'}}
        for mode in ['parameters','positions']:
            for algorithm in ['adam','lbfgs']:
                model=copy.deepcopy(original); info,history=optimize(model,batch,mode,algorithm,c,log_every=1)
                self.assertLess(info['finalLoss'],info['beforeLoss'])
                self.assertEqual(len(history),info['objectiveEvaluations'])
                if algorithm=='adam': self.assertEqual(info['objectiveEvaluations'],8)
                for name,t in original.state_dict().items(): torch.testing.assert_close(t,frozen[name],rtol=0,atol=0)


class MatchedInputAudit(unittest.TestCase):
    def test_preprocessed_forward_matches_original_without_second_normalization(self):
        from learning.network_precision_audit import NormalizedInputNetwork
        torch.manual_seed(3)
        original=v2.Model((8,)).double()
        original.mean.copy_(torch.tensor([.2,.3,.1818181872367859],dtype=torch.float64))
        original.std.copy_(torch.tensor([.1,.2,1e-6],dtype=torch.float64))
        matched=NormalizedInputNetwork((8,)).double();matched.load_state_dict(original.state_dict())
        x=torch.tensor([[.25,.35,2/11]],dtype=torch.float64)
        z=(x-original.mean)/original.std
        self.assertGreater(abs(float(z[0,2])),.005)
        for a,b in zip(original(x),matched(z)):torch.testing.assert_close(a,b,rtol=0,atol=0)


if __name__=='__main__': unittest.main()
