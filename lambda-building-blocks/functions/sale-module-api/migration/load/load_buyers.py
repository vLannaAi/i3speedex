"""Load buyers into DynamoDB"""

import json
import boto3
from boto3.dynamodb.types import TypeSerializer


def load(config, progress):
    """Batch-write transformed buyers to DynamoDB"""
    input_file = 'data/transformed/buyers.json'
    with open(input_file, 'r', encoding='utf-8') as f:
        buyers = json.load(f)

    if not buyers:
        return 0

    table_name = config['target']['buyersTable']
    region = config['target']['region']
    endpoint = config['target'].get('endpoint')
    batch_size = config['migration'].get('batchSize', 25)
    dry_run = config['migration'].get('dryRun', False)

    if dry_run:
        print(f"[DRY RUN] Would load {len(buyers)} buyers to {table_name}")
        return len(buyers)

    kwargs = {'region_name': region}
    if endpoint:
        kwargs['endpoint_url'] = endpoint

    dynamodb = boto3.resource('dynamodb', **kwargs)
    table = dynamodb.Table(table_name)

    bar = progress.create_bar('load_buyers', len(buyers), 'Loading buyers')
    loaded = 0

    # Batch write in chunks of batch_size (max 25 for DynamoDB)
    chunk_size = min(batch_size, 25)
    for i in range(0, len(buyers), chunk_size):
        chunk = buyers[i:i + chunk_size]
        with table.batch_writer() as batch:
            for item in chunk:
                batch.put_item(Item=item)
                progress.update('load_buyers')
                loaded += 1

    progress.close('load_buyers')
    return loaded
