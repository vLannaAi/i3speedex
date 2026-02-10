"""Load buyers into DynamoDB"""
import json

def load(config, progress):
    input_file = 'data/transformed/buyers.json'
    with open(input_file, 'r') as f:
        buyers = json.load(f)
    # Load to DynamoDB logic here
    return len(buyers)
