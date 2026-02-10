"""Load sales into DynamoDB"""
import json

def load(config, progress):
    input_file = 'data/transformed/sales.json'
    with open(input_file, 'r') as f:
        sales = json.load(f)
    return len(sales)
