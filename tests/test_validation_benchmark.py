import gzip,json,tempfile,unittest
from pathlib import Path
from learning.validation_benchmark import selected_rows

class ValidationPartition(unittest.TestCase):
    def test_test_rows_are_never_retained(self):
        with tempfile.TemporaryDirectory() as tmp:
            p=Path(tmp)/'x.gz'
            with gzip.open(p,'wt') as f:
                for s in ['train','validation','test']:f.write(json.dumps({'split':s,'answers':'unused'})+'\n')
            self.assertEqual([r['split'] for r in selected_rows(p)],['train','validation'])
