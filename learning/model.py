"""A small MLP initialized from scratch; no pretrained parameters."""
import torch
from torch import nn


class DesignMLP(nn.Module):
    def __init__(self, hidden_sizes=(128, 128)):
        super().__init__()
        sizes = [4, *hidden_sizes, 6]
        layers = []
        for i in range(len(sizes)-1):
            layers.append(nn.Linear(sizes[i], sizes[i+1]))
            layers.append(nn.Tanh() if i < len(sizes)-2 else nn.Sigmoid())
        self.layers = nn.Sequential(*layers)
        self.register_buffer('input_mean', torch.zeros(4))
        self.register_buffer('input_std', torch.ones(4))

    def forward(self, features):
        return self.layers((features-self.input_mean)/self.input_std)


def decoded_targets(parameters):
    """Differentiable equivalent of the Node bounded decoder, normalized by length."""
    remaining = torch.full_like(parameters[:, 0], 0.8)
    panels = []
    for i in range(3):
        allocated = remaining * parameters[:, i]
        remaining = remaining - allocated
        panels.append(0.05 + allocated)
    panels.append(0.05 + remaining)
    return torch.cat([torch.stack(panels, dim=1), parameters[:, 3:]], dim=1)


def features(request):
    return [request['width']/request['length'], *[x/request['length'] for x in request['targetBox']]]


def decode(parameters, request):
    remaining, panels = 0.8, []
    for value in parameters[:3]:
        allocated = remaining * value
        remaining -= allocated
        panels.append((0.05 + allocated)*request['length'])
    panels.append((0.05+remaining)*request['length'])
    return {'panelLengths': panels, 'width': request['width'], 'angles': [x*180 for x in parameters[3:]]}


def load_checkpoint(path):
    checkpoint = torch.load(path, map_location='cpu', weights_only=True)
    model = DesignMLP(checkpoint['config']['model']['hiddenSizes'])
    model.load_state_dict(checkpoint['state_dict'])
    model.eval()
    return model, checkpoint
