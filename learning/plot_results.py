"""Generate portable, standalone experiment figures from saved records."""
import csv
import json
import os
from pathlib import Path
os.environ.setdefault('MPLCONFIGDIR', '/tmp/orifold-matplotlib')
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt


def main():
    directory = Path('experiments/learning-v1/run')
    history = list(csv.DictReader((directory/'history.csv').open()))
    training = json.loads((directory/'training-summary.json').read_text())
    evaluation = json.loads((directory/'evaluation-summary.json').read_text())
    plt.rcParams.update({'svg.fonttype': 'none', 'font.size': 10})
    fig, ax = plt.subplots(figsize=(8, 4), layout='constrained')
    epochs = [int(row['epoch']) for row in history]
    ax.plot(epochs, [float(row['train_mse']) for row in history], label='Training', color='#167b64')
    ax.plot(epochs, [float(row['validation_mse']) for row in history], label='Validation', color='#b97722')
    ax.axvline(training['bestEpoch'], color='#64748b', linestyle='--', label=f"Selected epoch {training['bestEpoch']}")
    ax.set(xlabel='Epoch', ylabel='Imitation MSE', title='Orifold v1: training loss is not geometric validity')
    ax.legend(); ax.grid(alpha=.2)
    fig.savefig(directory/'learning-curves.svg'); plt.close(fig)
    names = ['network', 'equal-panels', 'random-search', 'optimizer-full', 'optimizer-short', 'network-initialized-short']
    labels = ['Network', 'Equal panels', 'Random search', 'Full optimizer', 'Short optimizer', 'Network + short']
    fig, ax = plt.subplots(figsize=(10, 4.8), layout='constrained')
    x = list(range(len(names)))
    strict = [evaluation['summary'][name]['strictPasses'] for name in names]
    relaxed = [evaluation['summary'][name]['passesWithin1Pct'] for name in names]
    first = ax.bar([i-.18 for i in x], strict, .36, label='Strict numerical fit', color='#167b64')
    second = ax.bar([i+.18 for i in x], relaxed, .36, label='Up to 1% overflow per axis', color='#d3a151')
    ax.bar_label(first, padding=3); ax.bar_label(second, padding=3)
    ax.set(xticks=x, xticklabels=labels, ylim=(0, 178), ylabel='Passing requests out of 150',
           title='Frozen test set: box fit and no blocked contacts at 721 samples')
    ax.legend(loc='upper left', ncols=2); ax.grid(axis='y', alpha=.2); ax.set_axisbelow(True)
    fig.savefig(directory/'test-comparison.svg')
    Path('artifacts').mkdir(exist_ok=True)
    fig.savefig('artifacts/learning-comparison.png', dpi=140); plt.close(fig)
    print('Saved learning curves and frozen-test comparison figures.')


if __name__ == '__main__':
    main()
