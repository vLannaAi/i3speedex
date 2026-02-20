"""Transform buyers data to DynamoDB schema"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def transform(config, progress):
    """Transform buyers from S9 to DynamoDB Buyer format"""
    input_file = 'data/extracted/buyers.json'
    output_file = 'data/transformed/buyers.json'
    Path(output_file).parent.mkdir(parents=True, exist_ok=True)

    with open(input_file, 'r', encoding='utf-8') as f:
        buyers = json.load(f)

    migration_user = 'migration'
    now = _now_iso()
    transformed = []

    for b in buyers:
        buyer_id = str(uuid.uuid4())
        created_at = b.get('created_at') or now
        updated_at = b.get('updated_at') or now

        item = {
            'PK': f'BUYER#{buyer_id}',
            'SK': 'METADATA',
            'buyerId': buyer_id,
            'code': str(b.get('code') or b.get('first_id') or ''),
            'companyName': b.get('name') or '',
            'subName': b.get('sub_name') or None,
            'industrialGroup': b.get('industrial_group') or None,
            'sector': b.get('sector') or None,
            'vatNumber': b.get('vat_number') or None,
            'fiscalCode': b.get('fiscal_code') or None,
            'vatExempt': b.get('vat_exempt') or None,
            'currency': b.get('currency') or 'EUR',
            'preferredLanguage': b.get('preferred_language') or 'it',
            'address': b.get('address') or '',
            'poBox': b.get('po_box') or None,
            'city': b.get('city') or '',
            'province': b.get('province') or None,
            'postalCode': b.get('postal_code') or '',
            'country': b.get('country') or 'IT',
            'mainContact': b.get('main_contact') or None,
            'email': b.get('email') or None,
            'phone': b.get('phone') or None,
            'fax': b.get('fax') or None,
            'website': b.get('website') or None,
            'pec': b.get('pec') or None,
            'sdi': b.get('sdi_code') or None,
            'defaultPaymentMethod': b.get('payment_method') or None,
            'defaultPaymentTerms': b.get('payment_terms') or None,
            'defaultOperator': b.get('default_operator') or None,
            'bankDetails': b.get('bank_details') or None,
            'notes': b.get('notes') or None,
            'status': 'active' if b.get('enabled', True) else 'inactive',
            'createdAt': created_at,
            'updatedAt': updated_at,
            'createdBy': migration_user,
            'updatedBy': migration_user,
            # Store original S9 ID for reference/deduplication
            '_s9Id': str(b.get('first_id') or ''),
        }

        # Remove None values for cleaner DynamoDB items
        item = {k: v for k, v in item.items() if v is not None}
        transformed.append(item)
        progress.update('buyers')

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(transformed, f, indent=2, ensure_ascii=False)

    return len(transformed)
