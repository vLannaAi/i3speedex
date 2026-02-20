"""Transform sales data to DynamoDB schema"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def _map_status(raw_status):
    """Map S9 status to DynamoDB status"""
    mapping = {
        'confirmed': 'confirmed', 'confermato': 'confirmed', 'conf': 'confirmed',
        'invoiced': 'invoiced', 'fatturato': 'invoiced',
        'paid': 'paid', 'pagato': 'paid',
        'cancelled': 'cancelled', 'annullato': 'cancelled', 'annullata': 'cancelled',
        'draft': 'draft', 'bozza': 'draft',
    }
    if raw_status:
        return mapping.get(str(raw_status).lower(), 'confirmed')
    return 'confirmed'


def transform(config, progress):
    """Transform sales from S9 to DynamoDB Sale + SaleLine format"""
    input_file = 'data/extracted/sales.json'
    output_file = 'data/transformed/sales.json'
    Path(output_file).parent.mkdir(parents=True, exist_ok=True)

    with open(input_file, 'r', encoding='utf-8') as f:
        sales = json.load(f)

    migration_user = 'migration'
    now = _now_iso()
    transformed = []  # List of dicts, each with 'sale' and 'lines' keys

    for s in sales:
        sale_id = str(uuid.uuid4())
        created_at = s.get('created_at') or now
        updated_at = s.get('updated_at') or now

        # Build sale item
        sale_item = {
            'PK': f'SALE#{sale_id}',
            'SK': 'METADATA',
            'saleId': sale_id,
            'saleNumber': int(s.get('sale_number') or 0),
            'regNumber': s.get('reg_number') or None,
            'docType': s.get('doc_type') or 'invoice',
            'saleDate': s.get('sale_date') or now[:10],
            'buyerId': s.get('buyer_id') or '',
            'buyerName': s.get('buyer_name') or '',
            'producerId': s.get('producer_id') or '',
            'producerName': s.get('producer_name') or '',
            'subtotal': float(s.get('subtotal') or 0),
            'taxAmount': float(s.get('tax_amount') or 0),
            'total': float(s.get('total') or 0),
            'paymentMethod': s.get('payment_method') or None,
            'paymentTerms': s.get('payment_terms') or None,
            'deliveryMethod': s.get('delivery_method') or None,
            'deliveryDate': s.get('delivery_date') or None,
            'notes': s.get('notes') or None,
            'internalNotes': s.get('internal_notes') or None,
            'referenceNumber': s.get('reference_number') or None,
            'poNumber': s.get('po_number') or None,
            'poDate': s.get('po_date') or None,
            'printedNote': s.get('printed_note') or None,
            'package': s.get('package') or None,
            'deliveryNote': s.get('delivery_note') or None,
            'dnNumber': s.get('dn_number') or None,
            'dnDate': s.get('dn_date') or None,
            'dnNumber2': s.get('dn_number2') or None,
            'dnDate2': s.get('dn_date2') or None,
            'dnNumber3': s.get('dn_number3') or None,
            'dnDate3': s.get('dn_date3') or None,
            'paCupNumber': s.get('pa_cup_number') or None,
            'paCigNumber': s.get('pa_cig_number') or None,
            'paymentDate': s.get('payment_date') or None,
            'paymentNote': s.get('payment_note') or None,
            'bank': s.get('bank') or None,
            'coBankDescription': s.get('co_bank_description') or None,
            'coBankIban': s.get('co_bank_iban') or None,
            'ivaPercentage': float(s.get('iva_percentage') or 22),
            'vatOff': s.get('vat_off') or None,
            'currency': s.get('currency') or 'EUR',
            'status': _map_status(s.get('status')),
            'invoiceGenerated': bool(s.get('invoice_generated') or False),
            'invoiceNumber': s.get('invoice_number') or None,
            'numberT': s.get('number_t') or None,
            'year': s.get('year') or None,
            'linesCount': len(s.get('lines') or []),
            'createdAt': created_at,
            'updatedAt': updated_at,
            'createdBy': migration_user,
            'updatedBy': migration_user,
            '_s9Id': str(s.get('first_id') or ''),
        }

        sale_item = {k: v for k, v in sale_item.items() if v is not None}

        # Build line items
        line_items = []
        for i, l in enumerate(s.get('lines') or [], 1):
            line_id = str(uuid.uuid4())
            quantity = float(l.get('quantity') or 1)
            unit_price = float(l.get('unit_price') or 0)
            discount = float(l.get('discount') or 0)
            discount_amount = float(l.get('discount_amount') or round(quantity * unit_price * discount / 100, 4))
            net_amount = float(l.get('net_amount') or round(quantity * unit_price - discount_amount, 4))
            tax_rate = float(l.get('tax_rate') or 22)
            tax_amount = float(l.get('tax_amount') or round(net_amount * tax_rate / 100, 4))
            total_amount = float(l.get('total_amount') or round(net_amount + tax_amount, 4))

            line_item = {
                'PK': f'SALE#{sale_id}',
                'SK': f'LINE#{line_id}',
                'saleId': sale_id,
                'lineId': line_id,
                'lineNumber': int(l.get('line_number') or i),
                'productCode': l.get('product_code') or None,
                'productDescription': l.get('product_description') or '',
                'quantity': quantity,
                'unitPrice': unit_price,
                'discount': discount,
                'discountAmount': discount_amount,
                'netAmount': net_amount,
                'taxRate': tax_rate,
                'taxAmount': tax_amount,
                'totalAmount': total_amount,
                'unitOfMeasure': l.get('unit_of_measure') or None,
                'notes': l.get('notes') or None,
                'createdAt': l.get('created_at') or created_at,
                'updatedAt': l.get('updated_at') or updated_at,
                'createdBy': migration_user,
                'updatedBy': migration_user,
            }
            line_item = {k: v for k, v in line_item.items() if v is not None}
            line_items.append(line_item)

        transformed.append({'sale': sale_item, 'lines': line_items})
        progress.update('sales')

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(transformed, f, indent=2, ensure_ascii=False)

    return len(transformed)
