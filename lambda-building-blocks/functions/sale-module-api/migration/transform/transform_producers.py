"""Transform producers data to DynamoDB schema"""

import json
import uuid
from datetime import datetime, timezone
from pathlib import Path


def _now_iso():
    return datetime.now(timezone.utc).isoformat()


def transform(config, progress):
    """Transform producers from S9 to DynamoDB Producer format"""
    input_file = 'data/extracted/producers.json'
    output_file = 'data/transformed/producers.json'
    Path(output_file).parent.mkdir(parents=True, exist_ok=True)

    with open(input_file, 'r', encoding='utf-8') as f:
        producers = json.load(f)

    migration_user = 'migration'
    now = _now_iso()
    transformed = []

    for p in producers:
        producer_id = str(uuid.uuid4())
        created_at = p.get('created_at') or now
        updated_at = p.get('updated_at') or now

        item = {
            'PK': f'PRODUCER#{producer_id}',
            'SK': 'METADATA',
            'producerId': producer_id,
            'code': str(p.get('code') or p.get('first_id') or ''),
            'companyName': p.get('name') or '',
            'subName': p.get('sub_name') or None,
            'vatNumber': p.get('vat_number') or None,
            'fiscalCode': p.get('fiscal_code') or None,
            'sdi': p.get('sdi_code') or None,
            'pec': p.get('pec') or None,
            'preferredLanguage': p.get('preferred_language') or 'it',
            'address': p.get('address') or '',
            'poBox': p.get('po_box') or None,
            'city': p.get('city') or '',
            'province': p.get('province') or None,
            'postalCode': p.get('postal_code') or '',
            'country': p.get('country') or 'IT',
            'mainContact': p.get('main_contact') or None,
            'email': p.get('email') or None,
            'phone': p.get('phone') or None,
            'fax': p.get('fax') or None,
            'website': p.get('website') or None,
            'defaultOperator': p.get('default_operator') or None,
            'revenuePercentage': p.get('revenue_percentage') or None,
            'bankDetails': p.get('bank_details') or None,
            'qualityAssurance': p.get('quality_assurance') or None,
            'productionArea': p.get('production_area') or None,
            'markets': p.get('markets') or None,
            'materials': p.get('materials') or None,
            'products': p.get('products') or None,
            'standardProducts': p.get('standard_products') or None,
            'diameterRange': p.get('diameter_range') or None,
            'maxLength': p.get('max_length') or None,
            'quantity': p.get('quantity') or None,
            'notes': p.get('notes') or None,
            'status': 'active' if p.get('enabled', True) else 'inactive',
            'createdAt': created_at,
            'updatedAt': updated_at,
            'createdBy': migration_user,
            'updatedBy': migration_user,
            '_s9Id': str(p.get('first_id') or ''),
        }

        item = {k: v for k, v in item.items() if v is not None}
        transformed.append(item)
        progress.update('producers')

    with open(output_file, 'w', encoding='utf-8') as f:
        json.dump(transformed, f, indent=2, ensure_ascii=False)

    return len(transformed)
