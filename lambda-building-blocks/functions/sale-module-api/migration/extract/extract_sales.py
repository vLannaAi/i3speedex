"""
Extract sales data from S9 MySQL database
"""

import json
import pymysql
import pymysql.cursors
from pathlib import Path


def extract(config, progress):
    """
    Extract sales + lines from S9 database (msg and msg_line tables)

    Args:
        config: Migration configuration
        progress: Progress tracker instance

    Returns:
        Number of sales extracted
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

    sales = []
    include_lines = config['extraction']['sales'].get('includeLines', True)

    try:
        conn = pymysql.connect(**conn_params)

        with conn.cursor() as cursor:
            # Count for progress bar
            cursor.execute("SELECT COUNT(*) AS cnt FROM msg WHERE enabled = 1")
            total = cursor.fetchone()['cnt']
            bar = progress.create_bar('sales', total, 'Extracting sales')

            # Main query from config
            query = config['extraction']['sales']['query']
            limit = config['extraction']['sales'].get('limit')
            offset = config['extraction']['sales'].get('offset', 0)
            if limit:
                query += f" LIMIT {limit} OFFSET {offset}"

            cursor.execute(query)
            sale_rows = cursor.fetchall()

        # Process each sale, fetching lines separately to avoid large joins
        with conn.cursor() as cursor:
            for row in sale_rows:
                sale_id = row.get('first_id') or row.get('id')

                sale = {
                    'first_id': sale_id,
                    'sale_number': row.get('sale_number') or row.get('numero') or row.get('num'),
                    'reg_number': row.get('reg_number') or row.get('numero_reg'),
                    'doc_type': row.get('doc_type') or row.get('tipo_doc') or 'invoice',
                    'sale_date': row['sale_date'].isoformat() if row.get('sale_date') else (
                        row['data'].isoformat() if row.get('data') else None
                    ),
                    'buyer_id': row.get('buyer_id') or row.get('cliente_id') or row.get('anag_id'),
                    'buyer_name': row.get('buyer_name') or row.get('cliente') or row.get('ragione_sociale_cliente') or '',
                    'producer_id': row.get('producer_id') or row.get('fornitore_id'),
                    'producer_name': row.get('producer_name') or row.get('fornitore') or '',
                    'subtotal': float(row.get('subtotal') or row.get('imponibile') or 0),
                    'tax_amount': float(row.get('tax_amount') or row.get('iva') or 0),
                    'total': float(row.get('total') or row.get('totale') or 0),
                    'payment_method': row.get('payment_method') or row.get('pagamento'),
                    'payment_terms': row.get('payment_terms') or row.get('condizioni_pagamento'),
                    'delivery_method': row.get('delivery_method') or row.get('spedizione'),
                    'delivery_date': row['delivery_date'].isoformat() if row.get('delivery_date') else None,
                    'notes': row.get('notes') or row.get('note'),
                    'internal_notes': row.get('internal_notes') or row.get('note_interne'),
                    'reference_number': row.get('reference_number') or row.get('riferimento'),
                    'po_number': row.get('po_number') or row.get('numero_ordine'),
                    'po_date': row['po_date'].isoformat() if row.get('po_date') else None,
                    'printed_note': row.get('printed_note') or row.get('nota_stampa'),
                    'package': row.get('package') or row.get('imballo'),
                    'delivery_note': row.get('delivery_note') or row.get('note_consegna'),
                    'dn_number': row.get('dn_number') or row.get('ddt_numero'),
                    'dn_date': row['dn_date'].isoformat() if row.get('dn_date') else None,
                    'dn_number2': row.get('dn_number2') or row.get('ddt_numero2'),
                    'dn_date2': row['dn_date2'].isoformat() if row.get('dn_date2') else None,
                    'dn_number3': row.get('dn_number3') or row.get('ddt_numero3'),
                    'dn_date3': row['dn_date3'].isoformat() if row.get('dn_date3') else None,
                    'pa_cup_number': row.get('pa_cup_number') or row.get('cup'),
                    'pa_cig_number': row.get('pa_cig_number') or row.get('cig'),
                    'payment_date': row['payment_date'].isoformat() if row.get('payment_date') else None,
                    'payment_note': row.get('payment_note') or row.get('nota_pagamento'),
                    'bank': row.get('bank') or row.get('banca'),
                    'co_bank_description': row.get('co_bank_description') or row.get('banca_co'),
                    'co_bank_iban': row.get('co_bank_iban') or row.get('iban_co'),
                    'iva_percentage': float(row.get('iva_percentage') or row.get('aliquota_iva') or 22),
                    'vat_off': row.get('vat_off') or row.get('esente_iva'),
                    'currency': row.get('currency') or row.get('valuta') or 'EUR',
                    'status': row.get('status') or row.get('stato') or 'confirmed',
                    'invoice_generated': bool(row.get('invoice_generated') or row.get('fattura_generata') or False),
                    'invoice_number': row.get('invoice_number') or row.get('numero_fattura'),
                    'number_t': row.get('number_t') or row.get('numero_t'),
                    'year': row.get('year') or row.get('anno'),
                    'enabled': bool(row.get('enabled', 1)),
                    'created_at': row['created_at'].isoformat() if row.get('created_at') else None,
                    'updated_at': row['updated_at'].isoformat() if row.get('updated_at') else None,
                    'lines': [],
                }

                # Extract sale lines
                if include_lines and sale_id:
                    cursor.execute(
                        "SELECT * FROM msg_line WHERE msg_id = %s ORDER BY line_number, id",
                        (sale_id,)
                    )
                    line_rows = cursor.fetchall()

                    for i, lrow in enumerate(line_rows, 1):
                        line = {
                            'line_id': lrow.get('first_id') or lrow.get('id'),
                            'line_number': lrow.get('line_number') or lrow.get('riga') or i,
                            'product_code': lrow.get('product_code') or lrow.get('codice'),
                            'product_description': lrow.get('product_description') or lrow.get('descrizione') or '',
                            'quantity': float(lrow.get('quantity') or lrow.get('quantita') or 1),
                            'unit_price': float(lrow.get('unit_price') or lrow.get('prezzo') or 0),
                            'discount': float(lrow.get('discount') or lrow.get('sconto') or 0),
                            'discount_amount': float(lrow.get('discount_amount') or lrow.get('importo_sconto') or 0),
                            'net_amount': float(lrow.get('net_amount') or lrow.get('imponibile') or 0),
                            'tax_rate': float(lrow.get('tax_rate') or lrow.get('aliquota_iva') or 22),
                            'tax_amount': float(lrow.get('tax_amount') or lrow.get('iva') or 0),
                            'total_amount': float(lrow.get('total_amount') or lrow.get('totale') or 0),
                            'unit_of_measure': lrow.get('unit_of_measure') or lrow.get('um'),
                            'notes': lrow.get('notes') or lrow.get('note'),
                            'created_at': lrow['created_at'].isoformat() if lrow.get('created_at') else None,
                            'updated_at': lrow['updated_at'].isoformat() if lrow.get('updated_at') else None,
                        }
                        sale['lines'].append(line)

                sales.append(sale)
                progress.update('sales')

        progress.close('sales')

        output_file = 'data/extracted/sales.json'
        Path(output_file).parent.mkdir(parents=True, exist_ok=True)
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(sales, f, indent=2, ensure_ascii=False, default=str)

        conn.close()
        return len(sales)

    except Exception as e:
        raise Exception(f"Failed to extract sales: {str(e)}")


if __name__ == '__main__':
    import sys
    import os
    sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))
    from utils.progress import ProgressTracker

    with open('config.json') as f:
        config = json.load(f)

    progress = ProgressTracker()
    count = extract(config, progress)
    print(f"Extracted {count} sales")
