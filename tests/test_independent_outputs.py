import unittest
import torch
from learning import v2
from learning.independent_outputs import IndependentOutputs, objective, refine_one, sweep_overflow


class IndependentControl(unittest.TestCase):
    def setUp(self):
        torch.manual_seed(99)
        self.model=IndependentOutputs(torch.randn(3,12,dtype=torch.float64),torch.randn(3,22,dtype=torch.float64))
        self.batch=(torch.zeros(3,3,dtype=torch.float64),torch.tensor([2,2,2]),
                    torch.full((3,11),.3,dtype=torch.float64),torch.full((3,11),.6,dtype=torch.float64),
                    torch.tensor([[1,1]+[0]*9]*3,dtype=torch.float64))

    def test_loss_and_gradients_separable_across_examples(self):
        for mode in ['parameters','positions']:
            self.model.zero_grad(); full=objective(self.model,self.batch,mode); full.backward()
            fullgrad=[p.grad.clone() for p in self.model.parameters()]; singles=[]
            for i in range(3):
                one=IndependentOutputs(self.model.folds[i:i+1],self.model.shape[i:i+1])
                loss=objective(one,tuple(t[i:i+1] for t in self.batch),mode); loss.backward(); singles.append(loss.detach())
                for j,p in enumerate(one.parameters()): torch.testing.assert_close(p.grad/3,fullgrad[j][i:i+1])
            torch.testing.assert_close(full.detach(),torch.stack(singles).mean())

    def test_output_matches_original_head(self):
        net=v2.Model().double(); x=torch.randn(3,3,dtype=torch.float64)
        h=net.body((x-net.mean)/net.std)
        independent=IndependentOutputs(net.folds(h),net.shape(h))
        for a,b in zip(net(x),independent(x)): torch.testing.assert_close(a,b,rtol=0,atol=0)

    def test_refinement_recovers_interior_targets(self):
        settings={'lr':1.,'max_iter':300,'max_eval':400,'tolerance_grad':1e-10,
                  'tolerance_change':1e-15,'history_size':30,'line_search_fn':'strong_wolfe'}
        for mode in ['parameters','positions']:
            one=IndependentOutputs(self.model.folds[:1],self.model.shape[:1])
            stats=refine_one(one,tuple(t[:1] for t in self.batch),mode,settings)
            self.assertEqual(stats['precisionGateCount'],1)
            self.assertLess(stats['finalLoss'],stats['beforeLoss'])

    def test_rotation_sweep_does_not_use_unturned_overflow(self):
        d={'panelLengths':[100.],'width':10,'angles':[]}
        r={'length':100.,'width':10,'targetBox':[10,12,103]}
        self.assertEqual(sweep_overflow(d,r)['overflowOverL'],0)


if __name__=='__main__': unittest.main()
