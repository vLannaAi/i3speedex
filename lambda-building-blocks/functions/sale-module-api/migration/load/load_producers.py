"""Load producers into DynamoDB"""
import json

def load(config, progress):
    input_file = 'data/transformed/producers.json'
    with open(input_file, 'r') as f:
        producers = json.load(f)
    return len(producers)
