"""Load sales and sale lines into DynamoDB"""

import json
import boto3
from decimal import Decimal


def _convert_floats(obj):
    """DynamoDB doesn't accept float — convert to Decimal"""
    if isinstance(obj, float):
        return Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: _convert_floats(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [_convert_floats(v) for v in obj]
    return obj


def load(config, progress):
    """Batch-write transformed sales + lines to DynamoDB"""
    input_file = 'data/transformed/sales.json'
    with open(input_file, 'r', encoding='utf-8') as f:
        sale_records = json.load(f)

    if not sale_records:
        return 0

    table_name = config['target']['salesTable']
    region = config['target']['region']
    endpoint = config['target'].get('endpoint')
    batch_size = config['migration'].get('batchSize', 25)
    dry_run = config['migration'].get('dryRun', False)

    if dry_run:
        total_lines = sum(len(r.get('lines', [])) for r in sale_records)
        print(f"[DRY RUN] Would load {len(sale_records)} sales + {total_lines} lines to {table_name}")
        return len(sale_records)

    kwargs = {'region_name': region}
    if endpoint:
        kwargs['endpoint_url'] = endpoint

    dynamodb = boto3.resource('dynamodb', **kwargs)
    table = dynamodb.Table(table_name)

    # Flatten sales and lines into a single list of items
    all_items = []
    for record in sale_records:
        all_items.append(_convert_floats(record['sale']))
        for line in record.get('lines', []):
            all_items.append(_convert_floats(line))

    bar = progress.create_bar('load_sales', len(sale_records), 'Loading sales')
    loaded_sales = 0

    chunk_size = min(batch_size, 25)
    for i in range(0, len(all_items), chunk_size):
        chunk = all_items[i:i + chunk_size]
        with table.batch_writer() as batch:
            for item in chunk:
                batch.put_item(Item=item)

        # Update progress once per sale (not per line)
        sales_in_chunk = sum(1 for item in chunk if item.get('SK') == 'METADATA')
        for _ in range(sales_in_chunk):
            progress.update('load_sales')
            loaded_sales += 1

    progress.close('load_sales')
    return loaded_sales
