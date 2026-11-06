import gzip
import hashlib
import json
from pathlib import Path


def sha256(path):
    return hashlib.sha256(Path(path).read_bytes()).hexdigest()


def load_dataset(directory):
    directory = Path(directory)
    config = json.loads((directory/'config.json').read_text())
    summary = json.loads((directory/'dataset-summary.json').read_text())
    manifest = json.loads((directory/'manifest.json').read_text())
    if sha256(directory/'config.json') != summary['configSha256']:
        raise ValueError('Configuration changed after dataset generation; create a new experiment.')
    raw = gzip.decompress((directory/'dataset.jsonl.gz').read_bytes())
    if hashlib.sha256(raw).hexdigest() != summary['uncompressedSha256']:
        raise ValueError('Dataset integrity check failed')
    rows = [json.loads(line) for line in raw.splitlines()]
    assignments = {row['id']: row for row in manifest['assignments']}
    if len(assignments) != len(rows) or len({row['id'] for row in rows}) != len(rows):
        raise ValueError('Duplicate or missing request identifiers')
    seen = {}
    for row in rows:
        assignment = assignments.get(row['id'], {})
        if any(row[key] != assignment.get(key) for key in ('split', 'group', 'groupId')):
            raise ValueError('Dataset split differs from frozen manifest')
        if row['groupId'] in seen:
            raise ValueError('Duplicate normalized request group')
        seen[row['groupId']] = row['split']
        if row['label'] and not row['label']['quality']['strictPass']:
            raise ValueError('Non-strict label encountered')
    return config, rows, summary
