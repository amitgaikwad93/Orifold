import unittest
from learning.memorization import geometric_metrics


class DiagnosticMetrics(unittest.TestCase):
    def test_offset_rotation_and_floaters(self):
        request={'length':100,'width':10,'targetBox':[60,12,60]}
        d={'panelLengths':[50,50],'width':10,'angles':[90],'placement':0,'offset':[0,0]}
        m=geometric_metrics(d,d,request,1)
        self.assertTrue(m['passes']); self.assertEqual(m['floatingCreases'],0)
        slid={**d,'offset':[2,2]}
        m=geometric_metrics(slid,d,request,1)
        self.assertTrue(m['passes']); self.assertEqual(m['floatingCreases'],1)
        self.assertEqual(m['vertexRmsOverL'],0) # placement does not affect imitation error
        bad={**d,'offset':[10,0]}
        m=geometric_metrics(bad,d,request,1)
        self.assertFalse(m['fits']); self.assertAlmostEqual(m['maxOverflowOverL'],.012)
        single={'panelLengths':[100],'width':10,'angles':[],'placement':90}
        request['targetBox']=[10,12,103]
        self.assertTrue(geometric_metrics(single,single,request,0)['passes'])

    def test_contacts_even_when_box_fit_fails(self):
        d={'panelLengths':[25]*4,'width':10,'angles':[180,90,90]}
        request={'length':100,'width':10,'targetBox':[1,12,1]}
        m=geometric_metrics(d,d,request,3)
        self.assertFalse(m['fits']); self.assertFalse(m['contactFree'])
        self.assertGreater(m['blockedStateCount'],0)


if __name__=='__main__': unittest.main()
