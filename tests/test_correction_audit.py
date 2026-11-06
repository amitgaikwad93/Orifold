import unittest
from learning.correction_audit import summarize

class AuditScoring(unittest.TestCase):
    def test_quality_budget_and_flags_remain_separate(self):
        items=[{'id':'a','reference':100},{'id':'b','reference':100}]
        raw=[{'passes':False,'evaluations':401,'ms':3},{'passes':True,'evaluations':10,'ms':1}]
        checks=[{'passes':True,'budgetSatisfied':True,'floatingCreases':0,'spread':95},
                {'passes':True,'budgetSatisfied':False,'floatingCreases':0,'spread':100}]
        rows,s=summarize(items,raw,checks)
        self.assertEqual(s['passes'],1);self.assertEqual(s['validWallsOpening'],1)
        self.assertEqual(s['flagDisagreements'],1);self.assertEqual(s['overNominal400'],1)
        self.assertFalse(rows[1]['valid'])

    def test_no_passes_do_not_produce_a_misleading_opening_average(self):
        _,s=summarize([{'id':'x','reference':100}],[{'passes':False}],
                      [{'passes':False,'budgetSatisfied':True,'floatingCreases':0,'spread':180}])
        self.assertEqual(s['passes'],0);self.assertIsNone(s['medianOpeningAmongPassing'])
