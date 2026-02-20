"""
Extract buyers data from S9 MySQL database
"""

import json
import pymysql
import pymysql.cursors
from pathlib import Path


def extract(config, progress):
    """
    Extract buyers from S9 database (kind IN (2, 3) = buyers/clients)

    Args:
        config: Migration configuration
        progress: Progress tracker instance

    Returns:
        Number of buyers extracted
    """
    src = config['source']
    conn_params = {
        'host': src['host'],
        'port': src.get('port', 3306),
        'db': src['database'],
        'user': src['username'],
        'password': src['password'],
        'charset': src.get('charset', 'utf8mb4'),
        'cursorclass': pymysql.cursors.DictCursor,
        'connect_timeout': src.get('connectionTimeout', 30000) // 1000,
    }

    if src.get('ssl'):
        conn_params['ssl'] = {'ssl_disabled': False}

    buyers = []

    try:
        conn = pymysql.connect(**conn_params)

        with conn.cursor() as cursor:
            # Count for progress bar
            cursor.execute("SELECT COUNT(*) AS cnt FROM msg_anag WHERE kind IN (2, 3) AND enabled = 1")
            total = cursor.fetchone()['cnt']
            bar = progress.create_bar('buyers', total, 'Extracting buyers')

            # Main query from config
            query = config['extraction']['buyers']['query']
            limit = config['extraction']['buyers'].get('limit')
            offset = config['extraction']['buyers'].get('offset', 0)
            if limit:
                query += f" LIMIT {limit} OFFSET {offset}"

            cursor.execute(query)

            for row in cursor.fetchall():
                buyer = {
                    'first_id': row.get('first_id'),
                    'code': row.get('code') or row.get('first_id'),
                    'name': row.get('name') or row.get('ragione_sociale') or '',
                    'sub_name': row.get('sub_name') or row.get('indirizzo2'),
                    'vat_number': row.get('vat_number') or row.get('piva'),
                    'fiscal_code': row.get('fiscal_code') or row.get('cod_fiscale'),
                    'sdi_code': row.get('sdi_code') or row.get('sdi') or row.get('codice_sdi'),
                    'pec': row.get('pec'),
                    'address': row.get('address') or row.get('indirizzo') or '',
                    'po_box': row.get('po_box') or row.get('casella_postale'),
                    'city': row.get('city') or row.get('citta') or '',
                    'province': row.get('province') or row.get('provincia'),
                    'postal_code': row.get('postal_code') or row.get('cap') or '',
                    'country': row.get('country') or row.get('nazione') or 'IT',
                    'email': row.get('email'),
                    'phone': row.get('phone') or row.get('telefono'),
                    'fax': row.get('fax'),
                    'website': row.get('website') or row.get('sito_web'),
                    'main_contact': row.get('main_contact') or row.get('referente'),
                    'notes': row.get('notes') or row.get('note'),
                    'payment_method': row.get('payment_method') or row.get('pagamento'),
                    'payment_terms': row.get('payment_terms') or row.get('condizioni_pagamento'),
                    'bank_details': row.get('bank_details') or row.get('banca'),
                    'currency': row.get('currency') or row.get('valuta') or 'EUR',
                    'preferred_language': row.get('preferred_language') or row.get('lingua') or 'it',
                    'vat_exempt': row.get('vat_exempt') or row.get('esenzione_iva'),
                    'industrial_group': row.get('industrial_group') or row.get('gruppo'),
                    'sector': row.get('sector') or row.get('settore'),
                    'default_operator': row.get('default_operator') or row.get('operatore'),
                    'enabled': bool(row.get('enabled', 1)),
                    'created_at': row['created_at'].isoformat() if row.get('created_at') else None,
                    'updated_at': row['updated_at'].isoformat() if row.get('updated_at') else None,
                    'kind': row.get('kind'),
                }

                buyers.append(buyer)
                progress.update('buyers')

        progress.close('buyers')

        output_file = 'data/extracted/buyers.json'
        Path(output_file).parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(buyers, f, indent=2, ensure_ascii=False, default=str)

        conn.close()
        return len(buyers)

    except Exception as e:
        raise Exception(f"Failed to extract buyers: {str(e)}")


if __name__ == '__main__':
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    from utils.progress import ProgressTracker

    with open('config.json') as f:
        config = json.load(f)

    progress = ProgressTracker()
    count = extract(config, progress)
    print(f"Extracted {count} buyers")
