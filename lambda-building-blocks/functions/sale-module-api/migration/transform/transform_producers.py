"""Transform producers data to DynamoDB schema"""
import json
from pathlib import Path

def transform(config, progress):
    input_file = 'data/extracted/producers.json'
    output_file = 'data/transformed/producers.json'
    Path(output_file).parent.mkdir(parents=True, exist_ok=True)
    with open(input_file, 'r') as f:
        producers = json.load(f)
    transformed = []
    with open(output_file, 'w') as f:
        json.dump(transformed, f, indent=2)
    return len(transformed)
