"""Train on train rows; select checkpoints with validation rows only."""
import argparse
import copy
import csv
import json
import platform
import time
from pathlib import Path
import numpy as np
import torch
from .data import load_dataset, sha256
from .model import DesignMLP, decoded_targets, features


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--experiment', default='experiments/learning-v1')
    parser.add_argument('--output', default=None)
    args = parser.parse_args()
    directory = Path(args.experiment)
    output = Path(args.output) if args.output else directory/'run'
    if output.exists():
        raise SystemExit('Output directory already exists; use a new --output directory.')
    config, rows, dataset_summary = load_dataset(directory)
    settings = config['training']
    torch.set_num_threads(settings['threads'])
    torch.use_deterministic_algorithms(True)
    torch.manual_seed(config['trainingSeed'])
    np.random.seed(config['trainingSeed'])
    train = [r for r in rows if r['split'] == 'train' and r['label']]
    validation = [r for r in rows if r['split'] == 'validation' and r['label']]
    if not train or not validation:
        raise ValueError('Empty labeled training or validation split')
    def tensors(selected):
        x = torch.tensor([features(row['request']) for row in selected], dtype=torch.float32)
        y = torch.tensor([[p/row['request']['length'] for p in row['label']['design']['panelLengths']] +
                          [a/180 for a in row['label']['design']['angles']] for row in selected], dtype=torch.float32)
        return x, y
    x_train, y_train = tensors(train)
    x_val, y_val = tensors(validation)
    model = DesignMLP(config['model']['hiddenSizes'])
    model.input_mean.copy_(x_train.mean(0))
    model.input_std.copy_(x_train.std(0, unbiased=False).clamp_min(1e-6))
    optimizer = torch.optim.AdamW(model.parameters(), lr=settings['learningRate'], weight_decay=settings['weightDecay'])
    generator = torch.Generator().manual_seed(config['trainingSeed'])
    history, best_state, best_loss, best_epoch = [], None, float('inf'), 0
    output.mkdir(parents=True)
    started = time.perf_counter()
    for epoch in range(1, settings['maxEpochs']+1):
        model.train()
        order = torch.randperm(len(train), generator=generator)
        total = 0.0
        for indices in order.split(settings['batchSize']):
            optimizer.zero_grad(set_to_none=True)
            loss = (decoded_targets(model(x_train[indices]))-y_train[indices]).square().mean()
            loss.backward()
            optimizer.step()
            total += loss.item()*len(indices)
        model.eval()
        with torch.inference_mode():
            validation_loss = (decoded_targets(model(x_val))-y_val).square().mean().item()
        history.append({'epoch': epoch, 'train_mse': total/len(train), 'validation_mse': validation_loss})
        if validation_loss < best_loss:
            best_loss, best_epoch = validation_loss, epoch
            best_state = copy.deepcopy(model.state_dict())
        if epoch == 1 or epoch % 25 == 0:
            print(f'Epoch {epoch}: train MSE {total/len(train):.6f}, validation MSE {validation_loss:.6f}', flush=True)
        if epoch-best_epoch >= settings['patience']:
            break
    elapsed = time.perf_counter()-started
    model.load_state_dict(best_state)
    checkpoint = {'state_dict': best_state, 'config': config, 'best_epoch': best_epoch,
                  'dataset_sha256': dataset_summary['uncompressedSha256']}
    torch.save(checkpoint, output/'checkpoint.pt')
    with (output/'history.csv').open('w') as handle:
        writer = csv.DictWriter(handle, fieldnames=['epoch', 'train_mse', 'validation_mse'])
        writer.writeheader(); writer.writerows(history)
    summary = {'state': 'completed', 'parameters': sum(p.numel() for p in model.parameters()),
               'trainingRows': len(train), 'validationRows': len(validation), 'testUsedDuringTraining': False,
               'epochsRun': len(history), 'bestEpoch': best_epoch, 'bestValidationMSE': best_loss,
               'trainingSeconds': elapsed, 'checkpointSha256': sha256(output/'checkpoint.pt'),
               'datasetSha256': dataset_summary['uncompressedSha256'], 'configSha256': sha256(directory/'config.json'),
               'torchVersion': str(torch.__version__), 'numpyVersion': np.__version__, 'pythonVersion': platform.python_version(),
               'device': 'cpu', 'threads': settings['threads'], 'seed': config['trainingSeed'],
               'selectionRule': settings['selection'], 'geometryAcceptanceNotMeasuredYet': True}
    (output/'training-summary.json').write_text(json.dumps(summary, indent=2)+'\n')
    print(json.dumps(summary, indent=2))


if __name__ == '__main__':
    main()
