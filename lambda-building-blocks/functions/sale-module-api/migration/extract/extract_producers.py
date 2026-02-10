"""
Extract producers data from S9 database
"""

import json
import psycopg2
from psycopg2.extras import RealDictCursor
from pathlib import Path


def extract(config, progress):
    """
    Extract producers from S9 database

    Similar to extract_buyers.py but for producers (kind = 1)
    """
    # Implementation similar to buyers extraction
    # Query: SELECT * FROM msg_anag WHERE kind = 1 AND enabled = true

    # For now, return stub implementation
    output_file = 'data/extracted/producers.json'
    Path(output_file).parent.mkdir(parents=True, exist_ok=True)

    # Stub data for testing
    producers = []

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(producers, f, indent=2, ensure_ascii=False)

    return len(producers)
