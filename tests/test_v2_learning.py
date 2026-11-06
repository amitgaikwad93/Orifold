"""Geometry, gradients and padding regression checks for the v2 imitation loss."""
import json
import math
import random
import subprocess
import unittest
import torch
from learning.v2 import ROOT, decode, fold_vertices, fold_extents, label_targets, vertex_mse


def encode(design, dtype=torch.float64):
    request = {'length': sum(design['panelLengths']), 'width': design['width']}
    k, v, a, _ = label_targets({'design': design}, request)
    return (torch.tensor([v], dtype=dtype), torch.tensor([a], dtype=dtype),
            torch.tensor([k]), torch.tensor([design.get('placement', 0)], dtype=dtype))


class V2Geometry(unittest.TestCase):
    def test_analytic_fixtures_and_rigid_lengths(self):
        for angle, expected in [(0, (20, 0)), (90, (10, 10)), (180, (5, 0))]:
            d = {'panelLengths': [5]*4, 'angles': [angle]*3, 'width': 10}
            args = encode(d)
            x, z = fold_vertices(*args)
            dx, dz = fold_extents(*args)
            self.assertAlmostEqual(float(dx)*20, expected[0], places=12)
            self.assertAlmostEqual(float(dz)*20, expected[1], places=12)
            for i in range(4):
                self.assertAlmostEqual(math.hypot(float(x[0,i+1]-x[0,i]), float(z[0,i+1]-z[0,i]))*20, 5, places=12)

    def test_all_fold_counts_against_independent_fold_export(self):
        rng = random.Random(1701)
        designs = []
        for k in range(12):
            weights = [rng.random() for _ in range(k+1)]
            lengths = [(0.05+(1-0.05*(k+1))*w/sum(weights))*100 for w in weights]
            designs.append({'panelLengths': lengths, 'angles': [rng.uniform(1,180) for _ in range(k)],
                            'width': 10, 'placement': rng.uniform(-180,180)})
        script = "const fs=require('fs'),{toFold}=require('./scripts/export-fold'); console.log(JSON.stringify(JSON.parse(fs.readFileSync(0,'utf8')).map(d=>toFold(d).file_frames[0].vertices_coords.filter((_,i)=>i%2===0))));"
        out = subprocess.run(['node','-e',script], cwd=ROOT, input=json.dumps(designs), text=True, capture_output=True, check=True)
        for d, points in zip(designs,json.loads(out.stdout)):
            x,z = fold_vertices(*encode(d))
            for i,p in enumerate(points):
                self.assertAlmostEqual(float(x[0,i])*100,p[0],places=11)
                self.assertAlmostEqual(float(z[0,i])*100,p[2],places=11)

    def test_padding_has_no_loss_or_gradient(self):
        k = torch.tensor([1, 4])
        px = torch.zeros(2,13,dtype=torch.float64,requires_grad=True)
        pz = torch.zeros_like(px)
        target = torch.ones_like(px)*100
        target[0,:3] = 0; target[1,:6] = 0
        loss = vertex_mse(px,pz,target,pz,k)
        self.assertEqual(float(loss.detach()),0)
        loss.backward(); self.assertEqual(float(px.grad.abs().sum()),0)
        target[0,2] = 1; target[1,5] = 2
        self.assertAlmostEqual(float(vertex_mse(px,pz,target,pz,k).detach()), (1/3+4/6)/2)

    def test_autograd_matches_finite_differences(self):
        v = torch.full((2,11),.3,dtype=torch.float64,requires_grad=True)
        a = torch.full((2,11),.4,dtype=torch.float64,requires_grad=True)
        psi = torch.tensor([13.,-21.],dtype=torch.float64,requires_grad=True)
        k = torch.tensor([2,5])
        self.assertTrue(torch.autograd.gradcheck(lambda v,a,p: fold_vertices(v,a,k,p), (v,a,psi)))
        self.assertTrue(torch.autograd.gradcheck(lambda v,a,p: vertex_mse(*fold_vertices(v,a,k,p),
                          torch.zeros(2,13),torch.zeros(2,13),k), (v,a,psi)))

    def test_parameter_round_trip_boundaries(self):
        for d in [{'panelLengths':[5,5,90],'width':10,'angles':[1,180]},
                  {'panelLengths':[100],'width':10,'angles':[]},
                  {'panelLengths':[100/12]*12,'width':10,'angles':[90]*11}]:
            v,a,k,_ = encode(d)
            logits = torch.full((12,),-100.); logits[int(k[0])] = 100
            actual = decode(logits,v[0],a[0],{'length':100,'width':10},int(k[0]))
            for key in ['panelLengths','angles']:
                for x,y in zip(actual[key],d[key]): self.assertAlmostEqual(x,y,places=12)


if __name__ == '__main__': unittest.main()
