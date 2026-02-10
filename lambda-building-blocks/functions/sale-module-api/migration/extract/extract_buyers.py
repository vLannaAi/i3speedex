"""
Extract buyers data from S9 database
"""

import json
import psycopg2
from psycopg2.extras import RealDictCursor
from pathlib import Path


def extract(config, progress):
    """
    Extract buyers from S9 database

    Args:
        config: Migration configuration
        progress: Progress tracker instance

    Returns:
        Number of buyers extracted
    """
    # Database connection
    conn_params = {
        'host': config['source']['host'],
        'port': config['source']['port'],
        'database': config['source']['database'],
        'user': config['source']['username'],
        'password': config['source']['password'],
    }

    if config['source'].get('ssl'):
        conn_params['sslmode'] = 'require'

    buyers = []

    try:
        # Connect to database
        conn = psycopg2.connect(**conn_params, cursor_factory=RealDictCursor)
        cursor = conn.cursor()

        # Get buyers query from config
        query = config['extraction']['buyers']['query']
        limit = config['extraction']['buyers'].get('limit')
        offset = config['extraction']['buyers'].get('offset', 0)

        if limit:
            query += f" LIMIT {limit} OFFSET {offset}"

        # Execute query
        cursor.execute(query)

        # Create progress bar
        cursor.execute("SELECT COUNT(*) FROM msg_anag WHERE kind IN (2, 3) AND enabled = true")
        total = cursor.fetchone()['count']
        bar = progress.create_bar('buyers', total, 'Extracting buyers')

        # Fetch all results
        for row in cursor:
            buyer = {
                'first_id': row['first_id'],
                'name': row['name'],
                'vat_number': row.get('vat_number'),
                'fiscal_code': row.get('fiscal_code'),
                'sdi_code': row.get('sdi_code'),
                'address': row.get('address'),
                'city': row.get('city'),
                'province': row.get('province'),
                'postal_code': row.get('postal_code'),
                'country': row.get('country', 'IT'),
                'email': row.get('email'),
                'phone': row.get('phone'),
                'pec': row.get('pec'),
                'enabled': row.get('enabled', True),
                'created_at': row.get('created_at').isoformat() if row.get('created_at') else None,
                'updated_at': row.get('updated_at').isoformat() if row.get('updated_at') else None,
            }

            buyers.append(buyer)
            progress.update('buyers')

        progress.close('buyers')

        # Save to file
        output_file = 'data/extracted/buyers.json'
        Path(output_file).parent.mkdir(parents=True, exist_ok=True)

        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(buyers, f, indent=2, ensure_ascii=False)

        cursor.close()
        conn.close()

        return len(buyers)

    except Exception as e:
        raise Exception(f"Failed to extract buyers: {str(e)}")


if __name__ == '__main__':
    # For testing standalone
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

    from utils.progress import ProgressTracker
    import json

    with open('config.json') as f:
        config = json.load(f)

    progress = ProgressTracker()
    count = extract(config, progress)
    print(f"Extracted {count} buyers")
