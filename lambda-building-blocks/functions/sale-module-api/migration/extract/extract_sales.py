"""
Extract sales data from S9 database
"""

import json
from pathlib import Path


def extract(config, progress):
    """
    Extract sales from S9 database

    Extracts from msg table and related sale_line tables
    """
    output_file = 'data/extracted/sales.json'
    Path(output_file).parent.mkdir(parents=True, exist_ok=True)

    # Stub implementation
    sales = []

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(sales, f, indent=2, ensure_ascii=False)

    return len(sales)
