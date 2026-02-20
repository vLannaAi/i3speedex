"""Load producers into DynamoDB"""

import json
import boto3


def load(config, progress):
    """Batch-write transformed producers to DynamoDB"""
    input_file = 'data/transformed/producers.json'
    with open(input_file, 'r', encoding='utf-8') as f:
        producers = json.load(f)

    if not producers:
        return 0

    table_name = config['target']['producersTable']
    region = config['target']['region']
    endpoint = config['target'].get('endpoint')
    batch_size = config['migration'].get('batchSize', 25)
    dry_run = config['migration'].get('dryRun', False)

    if dry_run:
        print(f"[DRY RUN] Would load {len(producers)} producers to {table_name}")
        return len(producers)

    kwargs = {'region_name': region}
    if endpoint:
        kwargs['endpoint_url'] = endpoint

    dynamodb = boto3.resource('dynamodb', **kwargs)
    table = dynamodb.Table(table_name)

    bar = progress.create_bar('load_producers', len(producers), 'Loading producers')
    loaded = 0

    chunk_size = min(batch_size, 25)
    for i in range(0, len(producers), chunk_size):
        chunk = producers[i:i + chunk_size]
        with table.batch_writer() as batch:
            for item in chunk:
                batch.put_item(Item=item)
                progress.update('load_producers')
                loaded += 1

    progress.close('load_producers')
    return loaded
