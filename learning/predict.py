"""CPU inference and frozen-test prediction export. Geometry is evaluated separately."""
import argparse
import json
import statistics
import time
from pathlib import Path
import torch
from .data import load_dataset, sha256
from .model import load_checkpoint, features, decode


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--experiment', default='experiments/learning-v1')
    parser.add_argument('--checkpoint', default=None)
    parser.add_argument('--request', default=None, help='JSON request path for one prediction')
    parser.add_argument('--output', default=None)
    args = parser.parse_args()
    directory = Path(args.experiment)
    checkpoint_path = Path(args.checkpoint) if args.checkpoint else directory/'run/checkpoint.pt'
    torch.set_num_threads(1)
    started = time.perf_counter()
    model, checkpoint = load_checkpoint(checkpoint_path)
    load_ms = (time.perf_counter()-started)*1000
    if args.request:
        request = json.loads(Path(args.request).read_text())
        with torch.inference_mode():
            parameters = model(torch.tensor([features(request)], dtype=torch.float32))[0].tolist()
        print(json.dumps({'request': request, 'parameters': parameters, 'design': decode(parameters, request),
                          'note': 'Proposal only; geometry must be checked before accepting.'}, indent=2))
        return
    config, rows, summary = load_dataset(directory)
    if checkpoint['dataset_sha256'] != summary['uncompressedSha256'] or checkpoint['config'] != config:
        raise ValueError('Checkpoint does not belong to this frozen experiment')
    destination = Path(args.output) if args.output else directory/'run/test-predictions.json'
    if destination.exists():
        raise SystemExit('Predictions already exist; use a fresh output path for an explicitly documented rerun.')
    selected = [row for row in rows if row['split'] in ('test', 'diagnostic-impossible')]
    output_rows = []
    with torch.inference_mode():
        warm = torch.tensor([features(selected[0]['request'])], dtype=torch.float32)
        for _ in range(20):
            model(warm)
        for row in selected:
            timings = []
            for _ in range(config['evaluation']['singleQueryTimingRepeats']):
                before = time.perf_counter_ns()
                x = torch.tensor([features(row['request'])], dtype=torch.float32)
                parameters = model(x)[0].tolist()
                design = decode(parameters, row['request'])
                timings.append((time.perf_counter_ns()-before)/1e6)
            output_rows.append({'id': row['id'], 'split': row['split'], 'group': row['group'], 'request': row['request'],
                                'parameters': parameters, 'design': design, 'medianInferenceMs': statistics.median(timings),
                                'invariantWidthRejection': row['request']['width'] > row['request']['targetBox'][1]})
    report = {'checkpointSha256': sha256(checkpoint_path), 'datasetSha256': summary['uncompressedSha256'],
              'configSha256': sha256(directory/'config.json'), 'checkpointLoadMs': load_ms,
              'timingDefinition': 'Warm single-query CPU features + tensor conversion + forward + design decode; excludes checkpoint load and geometric validation.',
              'predictionCount': len(output_rows), 'rows': output_rows}
    destination.write_text(json.dumps(report, indent=2)+'\n')
    print(f'Saved frozen predictions for {len(output_rows)} requests to {destination}.')


if __name__ == '__main__':
    main()
