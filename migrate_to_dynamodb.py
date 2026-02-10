#!/usr/bin/env python3
"""
Migration script: MySQL (i2_speedex) → DynamoDB dev tables
Source: rdss2.speedex.it / i2_speedex
Target: eu-west-1, profile speedexroot
  - i2speedex-sales-dev     (sales + sale lines, single-table design)
  - i2speedex-buyers-dev
  - i2speedex-producers-dev
"""

import sys
import decimal
from datetime import datetime, timezone

try:
    import pymysql
except ImportError:
    print("ERROR: pymysql not installed. Run: pip3 install pymysql")
    sys.exit(1)

try:
    import boto3
except ImportError:
    print("ERROR: boto3 not installed. Run: pip3 install boto3")
    sys.exit(1)


# ---------------------------------------------------------------------------
# Configuration
# ---------------------------------------------------------------------------

MYSQL_CONFIG = {
    "host": "rdss2.speedex.it",
    "user": "i2",
    "password": "gMIagisJQ0oTxTHB",
    "database": "i2_speedex",
    "charset": "utf8mb4",
    "cursorclass": pymysql.cursors.DictCursor,
}

AWS_REGION = "eu-west-1"
AWS_PROFILE = "speedexroot"

TABLE_SALES = "i2speedex-sales-dev"
TABLE_BUYERS = "i2speedex-buyers-dev"
TABLE_PRODUCERS = "i2speedex-producers-dev"

STATUS_MAP = {
    "new": "draft",
    "to verify": "draft",
    "proforma": "draft",
    "ready": "confirmed",
    "sent": "invoiced",
    "paid": "paid",
    "deleted": "cancelled",
}

NOW_ISO = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%S.000Z")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def safe_str(val, default=""):
    """Return string or default for None."""
    if val is None:
        return default
    return str(val).strip()


def safe_float(val, default=0.0):
    """Convert Decimal/int/str to float."""
    if val is None:
        return default
    if isinstance(val, decimal.Decimal):
        return float(val)
    return float(val)


def convert_reg_date(reg_date):
    """Convert YYYYMMDD int to YYYY-MM-DD string."""
    if reg_date is None:
        return NOW_ISO[:10]
    s = str(int(reg_date))
    if len(s) == 8:
        return f"{s[:4]}-{s[4:6]}-{s[6:8]}"
    return NOW_ISO[:10]


def map_sale_status(raw):
    """Map MySQL sale status to DynamoDB status."""
    if raw is None:
        return "draft"
    return STATUS_MAP.get(str(raw).lower().strip(), "draft")


def map_buyer_status(raw):
    """Map MySQL buyer/producer status to active/inactive."""
    if raw is None:
        return "active"
    return "active" if str(raw).lower().strip() == "online" else "inactive"


# ---------------------------------------------------------------------------
# Step 1: Extract from MySQL
# ---------------------------------------------------------------------------

def extract(conn):
    """Extract all data from MySQL."""
    cur = conn.cursor()

    cur.execute("SELECT * FROM sales")
    sales = cur.fetchall()
    print(f"  Extracted {len(sales)} sales")

    cur.execute("SELECT * FROM sale_lines")
    sale_lines = cur.fetchall()
    print(f"  Extracted {len(sale_lines)} sale_lines")

    # Collect referenced buyer/producer IDs
    buyer_ids = set()
    producer_ids = set()
    for s in sales:
        if s.get("buyer_id"):
            buyer_ids.add(int(s["buyer_id"]))
        if s.get("producer_id"):
            producer_ids.add(int(s["producer_id"]))

    # Fetch only referenced buyers
    buyers = []
    if buyer_ids:
        placeholders = ",".join(["%s"] * len(buyer_ids))
        cur.execute(f"SELECT * FROM buyers WHERE id IN ({placeholders})", tuple(buyer_ids))
        buyers = cur.fetchall()
    print(f"  Extracted {len(buyers)} buyers (referenced by sales)")

    # Fetch only referenced producers
    producers = []
    if producer_ids:
        placeholders = ",".join(["%s"] * len(producer_ids))
        cur.execute(f"SELECT * FROM producers WHERE id IN ({placeholders})", tuple(producer_ids))
        producers = cur.fetchall()
    print(f"  Extracted {len(producers)} producers (referenced by sales)")

    cur.close()
    return sales, sale_lines, buyers, producers


# ---------------------------------------------------------------------------
# Step 2: Transform
# ---------------------------------------------------------------------------

def transform_buyers(buyers_rows):
    """Transform MySQL buyers to DynamoDB items."""
    buyers_dict = {}  # id → DynamoDB item (for denormalization lookups)
    items = []

    for b in buyers_rows:
        bid = f"BUYER{b['id']}"
        country = safe_str(b.get("country"), "IT")
        status = map_buyer_status(b.get("status"))
        company_name = safe_str(b.get("name"), "Unknown")

        item = {
            "PK": f"BUYER#{bid}",
            "SK": "METADATA",
            "buyerId": bid,
            "companyName": company_name,
            "vatNumber": safe_str(b.get("vat")),
            "fiscalCode": safe_str(b.get("taxid")),
            "address": safe_str(b.get("address")),
            "city": safe_str(b.get("city")),
            "province": safe_str(b.get("prov")),
            "postalCode": safe_str(b.get("zip")),
            "country": country,
            "email": safe_str(b.get("email")),
            "phone": safe_str(b.get("tel")),
            "pec": safe_str(b.get("pec")),
            "sdi": safe_str(b.get("sdi_code")),
            "defaultPaymentTerms": safe_str(b.get("payment")),
            "currency": safe_str(b.get("currency"), "EUR"),
            "status": status,
            "totalSales": 0,
            "totalRevenue": 0,
            "createdAt": NOW_ISO,
            "updatedAt": NOW_ISO,
            "createdBy": "migration",
            "updatedBy": "migration",
            # GSI keys
            "GSI1PK": f"STATUS#{status}",
            "GSI1SK": company_name,
            "GSI2PK": f"COUNTRY#{country}",
            "GSI2SK": company_name,
        }

        # Remove empty-string optional fields to keep items clean
        item = {k: v for k, v in item.items() if v != ""}

        # Ensure required fields are present even if empty
        for req in ("PK", "SK", "buyerId", "companyName", "status", "createdAt",
                     "updatedAt", "createdBy", "updatedBy", "GSI1PK", "GSI1SK",
                     "GSI2PK", "GSI2SK"):
            if req not in item:
                item[req] = "" if req not in ("totalSales", "totalRevenue") else 0

        items.append(item)
        buyers_dict[b["id"]] = item

    return items, buyers_dict


def transform_producers(producers_rows):
    """Transform MySQL producers to DynamoDB items."""
    producers_dict = {}
    items = []

    for p in producers_rows:
        pid = f"PROD{p['id']}"
        country = safe_str(p.get("country"), "IT")
        status = map_buyer_status(p.get("status"))
        company_name = safe_str(p.get("name"), "Unknown")

        item = {
            "PK": f"PRODUCER#{pid}",
            "SK": "METADATA",
            "producerId": pid,
            "companyName": company_name,
            "vatNumber": safe_str(p.get("vat")),
            "fiscalCode": safe_str(p.get("taxid")),
            "address": safe_str(p.get("address")),
            "city": safe_str(p.get("city")),
            "province": safe_str(p.get("prov")),
            "postalCode": safe_str(p.get("zip")),
            "country": country,
            "email": safe_str(p.get("email")),
            "phone": safe_str(p.get("tel")),
            "status": status,
            "totalSales": 0,
            "createdAt": NOW_ISO,
            "updatedAt": NOW_ISO,
            "createdBy": "migration",
            "updatedBy": "migration",
            # GSI keys
            "GSI1PK": f"STATUS#{status}",
            "GSI1SK": company_name,
            "GSI2PK": f"COUNTRY#{country}",
            "GSI2SK": company_name,
        }

        item = {k: v for k, v in item.items() if v != ""}
        for req in ("PK", "SK", "producerId", "companyName", "status", "createdAt",
                     "updatedAt", "createdBy", "updatedBy", "GSI1PK", "GSI1SK",
                     "GSI2PK", "GSI2SK"):
            if req not in item:
                item[req] = "" if req != "totalSales" else 0

        items.append(item)
        producers_dict[p["id"]] = item

    return items, producers_dict


def transform_sales(sales_rows, sale_lines_rows, buyers_dict, producers_dict):
    """Transform MySQL sales + sale_lines to DynamoDB items."""
    # Group sale_lines by sale_id
    lines_by_sale = {}
    for sl in sale_lines_rows:
        sid = sl["sale_id"]
        lines_by_sale.setdefault(sid, []).append(sl)

    sale_items = []
    line_items = []

    for s in sales_rows:
        sale_id_num = s["id"]
        sale_id = f"SALE{sale_id_num}"
        pk = f"SALE#{sale_id}"

        raw_status = safe_str(s.get("status"), "new")
        status = map_sale_status(raw_status)
        sale_date = convert_reg_date(s.get("reg_date"))

        buyer_id_num = s.get("buyer_id")
        producer_id_num = s.get("producer_id")
        buyer_id = f"BUYER{buyer_id_num}" if buyer_id_num else ""
        producer_id = f"PROD{producer_id_num}" if producer_id_num else ""

        # Denormalize buyer info
        buyer = buyers_dict.get(buyer_id_num, {})
        producer = producers_dict.get(producer_id_num, {})

        lines_for_sale = lines_by_sale.get(sale_id_num, [])
        invoiced = raw_status.lower().strip() in ("sent", "paid")

        sale_item = {
            "PK": pk,
            "SK": "METADATA",
            "saleId": sale_id,
            "saleNumber": s.get("number", 0) or 0,
            "saleDate": sale_date,
            # Buyer denormalized
            "buyerId": buyer_id,
            "buyerName": buyer.get("companyName", ""),
            "buyerVatNumber": buyer.get("vatNumber", ""),
            "buyerFiscalCode": buyer.get("fiscalCode", ""),
            "buyerAddress": buyer.get("address", ""),
            "buyerCity": buyer.get("city", ""),
            "buyerProvince": buyer.get("province", ""),
            "buyerPostalCode": buyer.get("postalCode", ""),
            "buyerCountry": buyer.get("country", "IT"),
            # Producer denormalized
            "producerId": producer_id,
            "producerName": producer.get("companyName", ""),
            "producerVatNumber": producer.get("vatNumber", ""),
            "producerFiscalCode": producer.get("fiscalCode", ""),
            "producerAddress": producer.get("address", ""),
            "producerCity": producer.get("city", ""),
            "producerProvince": producer.get("province", ""),
            "producerPostalCode": producer.get("postalCode", ""),
            "producerCountry": producer.get("country", "IT"),
            # Totals
            "subtotal": safe_float(s.get("amount")),
            "taxAmount": safe_float(s.get("vat")),
            "total": safe_float(s.get("total")),
            # Payment
            "paymentMethod": safe_str(s.get("payment")),
            "currency": safe_str(s.get("currency"), "EUR"),
            # Notes
            "notes": safe_str(s.get("sale_note")),
            "internalNotes": safe_str(s.get("note")),
            "referenceNumber": safe_str(s.get("po_number")),
            # Status
            "status": status,
            "invoiceGenerated": invoiced,
            "linesCount": len(lines_for_sale),
            # Timestamps
            "createdAt": NOW_ISO,
            "updatedAt": NOW_ISO,
            "createdBy": "migration",
            "updatedBy": "migration",
            # GSI keys
            "GSI1PK": f"STATUS#{status}",
            "GSI1SK": sale_date,
            "GSI2PK": f"BUYER#{buyer_id}",
            "GSI2SK": sale_date,
            "GSI3PK": f"PRODUCER#{producer_id}",
            "GSI3SK": sale_date,
            "GSI4PK": "SALE",
            "GSI4SK": sale_date,
        }

        # Remove empty-string optional fields
        optional_keys = (
            "buyerVatNumber", "buyerFiscalCode", "buyerAddress", "buyerCity",
            "buyerProvince", "buyerPostalCode", "producerVatNumber",
            "producerFiscalCode", "producerAddress", "producerCity",
            "producerProvince", "producerPostalCode", "paymentMethod",
            "notes", "internalNotes", "referenceNumber",
        )
        for k in optional_keys:
            if sale_item.get(k) == "":
                del sale_item[k]

        sale_items.append(sale_item)

        # Transform sale lines
        for sl in lines_for_sale:
            pos = sl.get("pos", 0) or 0
            line_id = f"LINE{sl['id']}"

            qty = safe_float(sl.get("qty"), 1)
            price = safe_float(sl.get("price"), 0)
            discount_pct = safe_float(sl.get("discount"), 0)

            discount_amount = round(qty * price * discount_pct / 100, 2)
            net_amount = round(qty * price - discount_amount, 2)
            # Default 22% VAT for Italy
            tax_rate = 22.0
            tax_amount = round(net_amount * tax_rate / 100, 2)
            total_amount = round(net_amount + tax_amount, 2)

            line_item = {
                "PK": pk,
                "SK": f"LINE#{pos:03d}",
                "saleId": sale_id,
                "lineId": line_id,
                "lineNumber": pos,
                "productCode": safe_str(sl.get("code")),
                "productDescription": safe_str(sl.get("description"), "—"),
                "quantity": qty,
                "unitPrice": price,
                "discount": discount_pct,
                "discountAmount": discount_amount,
                "netAmount": net_amount,
                "taxRate": tax_rate,
                "taxAmount": tax_amount,
                "totalAmount": total_amount,
                "createdAt": NOW_ISO,
                "updatedAt": NOW_ISO,
                "createdBy": "migration",
                "updatedBy": "migration",
            }

            # Remove empty optional fields
            if line_item.get("productCode") == "":
                del line_item["productCode"]

            line_items.append(line_item)

    return sale_items, line_items


# ---------------------------------------------------------------------------
# Step 3: Clear existing DynamoDB data
# ---------------------------------------------------------------------------

def clear_table(dynamodb, table_name):
    """Delete all items from a DynamoDB table."""
    table = dynamodb.Table(table_name)
    scan_kwargs = {"ProjectionExpression": "PK, SK"}
    deleted = 0

    while True:
        resp = table.scan(**scan_kwargs)
        items = resp.get("Items", [])
        if not items:
            break

        with table.batch_writer() as batch:
            for item in items:
                batch.delete_item(Key={"PK": item["PK"], "SK": item["SK"]})
                deleted += 1

        if "LastEvaluatedKey" not in resp:
            break
        scan_kwargs["ExclusiveStartKey"] = resp["LastEvaluatedKey"]

    print(f"  Cleared {deleted} items from {table_name}")


# ---------------------------------------------------------------------------
# Step 4: Load into DynamoDB
# ---------------------------------------------------------------------------

def load_items(dynamodb, table_name, items, label):
    """Write items to DynamoDB using batch_writer."""
    if not items:
        print(f"  No {label} to load")
        return

    table = dynamodb.Table(table_name)
    with table.batch_writer() as batch:
        for item in items:
            # Convert Python floats to Decimal for DynamoDB
            cleaned = convert_floats_to_decimal(item)
            batch.put_item(Item=cleaned)

    print(f"  Loaded {len(items)} {label} → {table_name}")


def convert_floats_to_decimal(obj):
    """Recursively convert floats to Decimal (required by boto3 DynamoDB)."""
    if isinstance(obj, float):
        return decimal.Decimal(str(obj))
    if isinstance(obj, dict):
        return {k: convert_floats_to_decimal(v) for k, v in obj.items()}
    if isinstance(obj, list):
        return [convert_floats_to_decimal(i) for i in obj]
    return obj


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main():
    print("=" * 60)
    print("MySQL → DynamoDB Migration (dev)")
    print("=" * 60)

    # Connect to MySQL
    print("\n[1/5] Connecting to MySQL...")
    conn = pymysql.connect(**MYSQL_CONFIG)
    print(f"  Connected to {MYSQL_CONFIG['host']}/{MYSQL_CONFIG['database']}")

    # Extract
    print("\n[2/5] Extracting data from MySQL...")
    sales, sale_lines, buyers, producers = extract(conn)
    conn.close()

    # Transform
    print("\n[3/5] Transforming data...")
    buyer_items, buyers_dict = transform_buyers(buyers)
    producer_items, producers_dict = transform_producers(producers)
    sale_items, line_items = transform_sales(sales, sale_lines, buyers_dict, producers_dict)
    print(f"  Transformed {len(buyer_items)} buyers")
    print(f"  Transformed {len(producer_items)} producers")
    print(f"  Transformed {len(sale_items)} sales")
    print(f"  Transformed {len(line_items)} sale lines")

    # Connect to DynamoDB
    print("\n[4/5] Clearing existing DynamoDB data...")
    session = boto3.Session(profile_name=AWS_PROFILE, region_name=AWS_REGION)
    dynamodb = session.resource("dynamodb")
    clear_table(dynamodb, TABLE_SALES)
    clear_table(dynamodb, TABLE_BUYERS)
    clear_table(dynamodb, TABLE_PRODUCERS)

    # Load
    print("\n[5/5] Loading data into DynamoDB...")
    load_items(dynamodb, TABLE_BUYERS, buyer_items, "buyers")
    load_items(dynamodb, TABLE_PRODUCERS, producer_items, "producers")
    load_items(dynamodb, TABLE_SALES, sale_items, "sales (metadata)")
    load_items(dynamodb, TABLE_SALES, line_items, "sale lines")

    # Summary
    print("\n" + "=" * 60)
    print("Migration complete!")
    print("=" * 60)
    print(f"  Sales:      {len(sale_items)}")
    print(f"  Sale Lines: {len(line_items)}")
    print(f"  Buyers:     {len(buyer_items)}")
    print(f"  Producers:  {len(producer_items)}")
    print(f"  Total DynamoDB items written: {len(sale_items) + len(line_items) + len(buyer_items) + len(producer_items)}")
    print(f"\nVerify with:")
    print(f"  aws dynamodb scan --table-name {TABLE_SALES} --select COUNT --region {AWS_REGION} --profile {AWS_PROFILE}")
    print(f"  aws dynamodb scan --table-name {TABLE_BUYERS} --select COUNT --region {AWS_REGION} --profile {AWS_PROFILE}")
    print(f"  aws dynamodb scan --table-name {TABLE_PRODUCERS} --select COUNT --region {AWS_REGION} --profile {AWS_PROFILE}")


if __name__ == "__main__":
    main()
