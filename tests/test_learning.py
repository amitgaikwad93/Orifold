import json
import subprocess
import tempfile
import unittest
from pathlib import Path
import torch
from learning.data import load_dataset
from learning.model import DesignMLP, decoded_targets, decode, features, load_checkpoint

ROOT = Path(__file__).resolve().parents[1]


class LearningChecks(unittest.TestCase):
    def test_decoder_parity_and_gradients(self):
        torch.manual_seed(19)
        values = torch.rand(12, 6, dtype=torch.float64, requires_grad=True)
        self.assertTrue(torch.autograd.gradcheck(decoded_targets, (values,)))
        parameters = values.detach().tolist()
        script = "const {decode}=require('./src/optimizer');let s='';process.stdin.on('data',c=>s+=c);process.stdin.on('end',()=>console.log(JSON.stringify(JSON.parse(s).map(p=>decode(p,{length:20,width:10,targetBox:[5,10,1]})))));"
        result = subprocess.run(['node', '-e', script], cwd=ROOT, input=json.dumps(parameters), text=True, capture_output=True, check=True)
        reference = json.loads(result.stdout)
        decoded = decoded_targets(values).detach().tolist()
        for p, norm, ref in zip(parameters, decoded, reference):
            design = decode(p, {'length': 20, 'width': 10})
            for actual, expected in zip(design['panelLengths'], ref['panelLengths']):
                self.assertAlmostEqual(actual, expected, places=10)
            self.assertAlmostEqual(sum(norm[:4]), 1)
            self.assertTrue(all(x >= .05 for x in norm[:4]))
            for actual, expected in zip(norm[:4], ref['panelLengths']):
                self.assertAlmostEqual(actual*20, expected, places=10)

    def test_checkpoint_round_trip(self):
        torch.manual_seed(12)
        model = DesignMLP()
        values = torch.randn(3, 4)
        with tempfile.TemporaryDirectory() as directory:
            file = Path(directory)/'checkpoint.pt'
            torch.save({'state_dict': model.state_dict(), 'config': {'model': {'hiddenSizes': [128, 128]}}}, file)
            restored, _ = load_checkpoint(file)
            self.assertTrue(torch.equal(model(values), restored(values)))

    def test_frozen_splits_and_labels(self):
        config, rows, summary = load_dataset(ROOT/'experiments/learning-v1')
        for split, count in config['splitCounts'].items():
            self.assertEqual(sum(row['split'] == split for row in rows), count)
        self.assertEqual(len({row['groupId'] for row in rows}), len(rows))
        pilot = json.loads((ROOT/'results/pilot-2026-11-04-strict.json').read_text())
        def key(request):
            return tuple(round(x, 9) for x in features(request))
        self.assertFalse({key(row['request']) for row in rows} & {key(row['request']) for row in pilot['requests']})
        for row in rows:
            if row['split'] == 'diagnostic-impossible':
                self.assertIsNone(row['label'])
                self.assertGreater(row['request']['width'], row['request']['targetBox'][1])
            elif row['label']:
                self.assertTrue(row['label']['quality']['strictPass'])


if __name__ == '__main__':
    unittest.main()
