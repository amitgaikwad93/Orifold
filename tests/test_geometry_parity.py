import json
import math
import random
import subprocess
import unittest
from pathlib import Path
from learning.geometry import evaluate, fold

ROOT = Path(__file__).resolve().parents[1]


class GeometryParity(unittest.TestCase):
    def compare(self, actual, expected):
        if isinstance(expected, dict):
            for key in actual:
                self.compare(actual[key], expected[key])
        elif isinstance(expected, list):
            self.assertEqual(len(actual), len(expected))
            for a, b in zip(actual, expected):
                self.compare(a, b)
        elif isinstance(expected, bool) or expected is None or isinstance(expected, str):
            self.assertEqual(actual, expected)
        else:
            self.assertTrue(math.isclose(actual, expected, rel_tol=1e-10, abs_tol=1e-9), (actual, expected))

    def test_reference_fixtures_and_random_designs(self):
        rows = json.loads((ROOT/'tests/fixtures/geometry-parity.json').read_text())
        rng = random.Random(8675309)
        for i in range(32):
            scale = [0.001, 1, 1000][i % 3]
            rows.append({'design': {'panelLengths': [rng.uniform(1, 10)*scale for _ in range(4)],
                                    'width': 10*scale, 'angles': [rng.uniform(0, 180) for _ in range(3)]},
                         'targetBox': [10*scale, 10*scale, 10*scale], 'steps': 60})
        result = subprocess.run(['node', 'scripts/geometry-reference.js'], cwd=ROOT,
                                input=json.dumps(rows), text=True, capture_output=True, check=True)
        for row, reference in zip(rows, json.loads(result.stdout)):
            with self.subTest(name=row.get('name', 'random')):
                self.compare(evaluate(row['design'], row['targetBox'], row.get('steps', 180)), reference)

    def test_invalid_values(self):
        design = {'panelLengths': [5, 5, 5, 5], 'width': 10, 'angles': [90, 90, 90]}
        for patch in ({'width': 0}, {'angles': [90]}, {'panelLengths': [1e-12, 5, 5, 5]}):
            with self.assertRaises(ValueError):
                fold({**design, **patch})


if __name__ == '__main__':
    unittest.main()
