#!/usr/bin/env python3
"""
Migration Validation Script
Validates transformed data against schema and business rules
"""

import json
import sys
from pathlib import Path
from datetime import datetime
from typing import Dict, List, Any

class MigrationValidator:
    def __init__(self):
        self.errors = []
        self.warnings = []
        self.stats = {
            'sales': {'count': 0, 'valid': 0, 'invalid': 0},
            'buyers': {'count': 0, 'valid': 0, 'invalid': 0},
            'producers': {'count': 0, 'valid': 0, 'invalid': 0}
        }

    def validate_sale(self, sale: Dict[str, Any]) -> bool:
        """Validate a sale record"""
        valid = True

        # Check required fields
        required_fields = ['PK', 'SK', 'EntityType', 'SaleId', 'BuyerId', 'ProducerId',
                          'SaleDate', 'Status', 'Total']
        for field in required_fields:
            if field not in sale or not sale[field]:
                self.errors.append(f"Sale {sale.get('SaleId', 'UNKNOWN')}: Missing required field '{field}'")
                valid = False

        # Validate PK format
        if 'PK' in sale and not sale['PK'].startswith('SALE#'):
            self.errors.append(f"Sale {sale.get('SaleId')}: Invalid PK format: {sale['PK']}")
            valid = False

        # Validate SK
        if 'SK' in sale and sale['SK'] != '#METADATA#sale':
            self.errors.append(f"Sale {sale.get('SaleId')}: Invalid SK: {sale['SK']}")
            valid = False

        # Validate Status
        valid_statuses = ['DRAFT', 'CONFIRMED', 'INVOICED', 'SHIPPED', 'DELIVERED', 'CANCELLED']
        if 'Status' in sale and sale['Status'] not in valid_statuses:
            self.errors.append(f"Sale {sale.get('SaleId')}: Invalid status: {sale['Status']}")
            valid = False

        # Validate numeric fields
        numeric_fields = ['Total', 'Subtotal', 'Discount', 'Tax']
        for field in numeric_fields:
            if field in sale:
                if not isinstance(sale[field], (int, float)):
                    self.errors.append(f"Sale {sale.get('SaleId')}: {field} must be numeric")
                    valid = False
                elif sale[field] < 0:
                    self.errors.append(f"Sale {sale.get('SaleId')}: {field} cannot be negative")
                    valid = False

        # Validate dates
        date_fields = ['SaleDate', 'CreatedAt', 'UpdatedAt']
        for field in date_fields:
            if field in sale and sale[field]:
                try:
                    datetime.fromisoformat(sale[field].replace('Z', '+00:00'))
                except (ValueError, AttributeError):
                    self.errors.append(f"Sale {sale.get('SaleId')}: Invalid date format for {field}")
                    valid = False

        # Validate GSI keys
        if 'GSI1PK' in sale and not sale['GSI1PK'].startswith('BUYER#'):
            self.errors.append(f"Sale {sale.get('SaleId')}: Invalid GSI1PK format")
            valid = False

        if 'GSI2PK' in sale and not sale['GSI2PK'].startswith('PRODUCER#'):
            self.errors.append(f"Sale {sale.get('SaleId')}: Invalid GSI2PK format")
            valid = False

        if 'GSI3PK' in sale and not sale['GSI3PK'].startswith('STATUS#'):
            self.errors.append(f"Sale {sale.get('SaleId')}: Invalid GSI3PK format")
            valid = False

        # Business rule: Total should equal Subtotal - Discount + Tax
        if all(f in sale for f in ['Total', 'Subtotal', 'Discount', 'Tax']):
            expected_total = sale['Subtotal'] - sale['Discount'] + sale['Tax']
            if abs(sale['Total'] - expected_total) > 0.01:  # Allow for rounding
                self.warnings.append(
                    f"Sale {sale.get('SaleId')}: Total mismatch. "
                    f"Expected {expected_total}, got {sale['Total']}"
                )

        return valid

    def validate_buyer(self, buyer: Dict[str, Any]) -> bool:
        """Validate a buyer record"""
        valid = True

        # Check required fields
        required_fields = ['PK', 'SK', 'EntityType', 'BuyerId', 'Name', 'Document', 'Status']
        for field in required_fields:
            if field not in buyer or not buyer[field]:
                self.errors.append(f"Buyer {buyer.get('BuyerId', 'UNKNOWN')}: Missing required field '{field}'")
                valid = False

        # Validate PK format
        if 'PK' in buyer and not buyer['PK'].startswith('BUYER#'):
            self.errors.append(f"Buyer {buyer.get('BuyerId')}: Invalid PK format: {buyer['PK']}")
            valid = False

        # Validate SK
        if 'SK' in buyer and buyer['SK'] != '#METADATA#buyer':
            self.errors.append(f"Buyer {buyer.get('BuyerId')}: Invalid SK: {buyer['SK']}")
            valid = False

        # Validate Status
        valid_statuses = ['ACTIVE', 'INACTIVE', 'BLOCKED', 'SUSPENDED']
        if 'Status' in buyer and buyer['Status'] not in valid_statuses:
            self.errors.append(f"Buyer {buyer.get('BuyerId')}: Invalid status: {buyer['Status']}")
            valid = False

        # Validate GSI keys
        if 'GSI1PK' in buyer and buyer['GSI1PK'] != 'BUYERS':
            self.errors.append(f"Buyer {buyer.get('BuyerId')}: Invalid GSI1PK: {buyer['GSI1PK']}")
            valid = False

        if 'GSI1SK' in buyer and not buyer['GSI1SK'].startswith('BUYER#'):
            self.errors.append(f"Buyer {buyer.get('BuyerId')}: Invalid GSI1SK format")
            valid = False

        return valid

    def validate_producer(self, producer: Dict[str, Any]) -> bool:
        """Validate a producer record"""
        valid = True

        # Check required fields
        required_fields = ['PK', 'SK', 'EntityType', 'ProducerId', 'Name', 'Document', 'Status']
        for field in required_fields:
            if field not in producer or not producer[field]:
                self.errors.append(f"Producer {producer.get('ProducerId', 'UNKNOWN')}: Missing required field '{field}'")
                valid = False

        # Validate PK format
        if 'PK' in producer and not producer['PK'].startswith('PRODUCER#'):
            self.errors.append(f"Producer {producer.get('ProducerId')}: Invalid PK format: {producer['PK']}")
            valid = False

        # Validate SK
        if 'SK' in producer and producer['SK'] != '#METADATA#producer':
            self.errors.append(f"Producer {producer.get('ProducerId')}: Invalid SK: {producer['SK']}")
            valid = False

        # Validate Status
        valid_statuses = ['ACTIVE', 'INACTIVE', 'SUSPENDED']
        if 'Status' in producer and producer['Status'] not in valid_statuses:
            self.errors.append(f"Producer {producer.get('ProducerId')}: Invalid status: {producer['Status']}")
            valid = False

        # Validate GSI keys
        if 'GSI1PK' in producer and producer['GSI1PK'] != 'PRODUCERS':
            self.errors.append(f"Producer {producer.get('ProducerId')}: Invalid GSI1PK: {producer['GSI1PK']}")
            valid = False

        if 'GSI1SK' in producer and not producer['GSI1SK'].startswith('PRODUCER#'):
            self.errors.append(f"Producer {producer.get('ProducerId')}: Invalid GSI1SK format")
            valid = False

        return valid

    def validate_file(self, file_path: Path, entity_type: str) -> None:
        """Validate all records in a file"""
        print(f"Validating {entity_type}: {file_path.name}")

        try:
            with open(file_path, 'r') as f:
                records = json.load(f)

            if not isinstance(records, list):
                self.errors.append(f"{file_path.name}: Expected array of records")
                return

            for record in records:
                self.stats[entity_type]['count'] += 1

                if entity_type == 'sales':
                    valid = self.validate_sale(record)
                elif entity_type == 'buyers':
                    valid = self.validate_buyer(record)
                elif entity_type == 'producers':
                    valid = self.validate_producer(record)
                else:
                    valid = False

                if valid:
                    self.stats[entity_type]['valid'] += 1
                else:
                    self.stats[entity_type]['invalid'] += 1

            print(f"  Total: {self.stats[entity_type]['count']}")
            print(f"  Valid: {self.stats[entity_type]['valid']}")
            print(f"  Invalid: {self.stats[entity_type]['invalid']}")

        except FileNotFoundError:
            self.warnings.append(f"File not found: {file_path}")
        except json.JSONDecodeError as e:
            self.errors.append(f"Invalid JSON in {file_path}: {str(e)}")

    def generate_report(self) -> Dict[str, Any]:
        """Generate validation report"""
        total_count = sum(s['count'] for s in self.stats.values())
        total_valid = sum(s['valid'] for s in self.stats.values())
        total_invalid = sum(s['invalid'] for s in self.stats.values())

        return {
            'timestamp': datetime.utcnow().isoformat() + 'Z',
            'summary': {
                'totalRecords': total_count,
                'validRecords': total_valid,
                'invalidRecords': total_invalid,
                'errorCount': len(self.errors),
                'warningCount': len(self.warnings)
            },
            'statistics': self.stats,
            'errors': self.errors,
            'warnings': self.warnings
        }

def main():
    if len(sys.argv) < 2:
        print("Usage: python3 validate-migration.py <transformed_data_dir>")
        sys.exit(1)

    data_dir = Path(sys.argv[1])
    if not data_dir.exists():
        print(f"Error: Directory not found: {data_dir}")
        sys.exit(1)

    validator = MigrationValidator()

    print("========================================")
    print("Migration Data Validation")
    print("========================================")
    print(f"Data Directory: {data_dir}")
    print()

    # Validate each entity type
    validator.validate_file(data_dir / 'buyers.json', 'buyers')
    print()

    validator.validate_file(data_dir / 'producers.json', 'producers')
    print()

    validator.validate_file(data_dir / 'sales.json', 'sales')
    print()

    # Generate and save report
    report = validator.generate_report()
    report_file = data_dir / 'validation-report.json'

    with open(report_file, 'w') as f:
        json.dump(report, f, indent=2)

    # Print summary
    print("========================================")
    if report['summary']['invalidRecords'] == 0 and report['summary']['errorCount'] == 0:
        print("✓ Validation PASSED")
    else:
        print("✗ Validation FAILED")
    print("========================================")
    print()

    print("Summary:")
    print(f"  Total Records: {report['summary']['totalRecords']}")
    print(f"  Valid: {report['summary']['validRecords']}")
    print(f"  Invalid: {report['summary']['invalidRecords']}")
    print(f"  Errors: {report['summary']['errorCount']}")
    print(f"  Warnings: {report['summary']['warningCount']}")
    print()

    if validator.errors:
        print("Errors:")
        for error in validator.errors[:10]:  # Show first 10
            print(f"  - {error}")
        if len(validator.errors) > 10:
            print(f"  ... and {len(validator.errors) - 10} more")
        print()

    if validator.warnings:
        print("Warnings:")
        for warning in validator.warnings[:5]:  # Show first 5
            print(f"  - {warning}")
        if len(validator.warnings) > 5:
            print(f"  ... and {len(validator.warnings) - 5} more")
        print()

    print(f"Full report: {report_file}")
    print()

    # Exit with appropriate code
    if report['summary']['invalidRecords'] > 0 or report['summary']['errorCount'] > 0:
        sys.exit(1)
    else:
        sys.exit(0)

if __name__ == '__main__':
    main()
