"""Transform buyers data to DynamoDB schema"""
import json
from pathlib import Path

def transform(config, progress):
    """Transform buyers from S9 to DynamoDB format"""
    input_file = 'data/extracted/buyers.json'
    output_file = 'data/transformed/buyers.json'
    Path(output_file).parent.mkdir(parents=True, exist_ok=True)
    
    with open(input_file, 'r') as f:
        buyers = json.load(f)
    
    # Transform logic here
    transformed = []
    
    with open(output_file, 'w') as f:
        json.dump(transformed, f, indent=2)
    
    return len(transformed)
