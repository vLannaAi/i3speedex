#!/usr/bin/env python3
import sys

try:
    import pymysql
    connection_lib = 'pymysql'
except ImportError:
    try:
        import mysql.connector
        connection_lib = 'mysql.connector'
    except ImportError:
        print("ERROR: No MySQL library available. Please install pymysql or mysql-connector-python")
        sys.exit(1)

def get_table_structure(cursor, table_name):
    cursor.execute(f"DESCRIBE {table_name}")
    columns = cursor.fetchall()

    print(f"\n{'='*80}")
    print(f"TABLE: {table_name}")
    print(f"{'='*80}")
    print(f"{'Field':<30} {'Type':<20} {'Null':<5} {'Key':<5} {'Default':<15} {'Extra':<15}")
    print(f"{'-'*80}")

    for col in columns:
        if connection_lib == 'pymysql':
            field, type_, null, key, default, extra = col
        else:
            field, type_, null, key, default, extra = col

        default = str(default) if default is not None else 'NULL'
        print(f"{field:<30} {type_:<20} {null:<5} {key:<5} {default:<15} {extra:<15}")

    return columns

def get_sample_data(cursor, table_name, limit=3):
    cursor.execute(f"SELECT * FROM {table_name} LIMIT {limit}")
    rows = cursor.fetchall()

    cursor.execute(f"DESCRIBE {table_name}")
    columns = [col[0] for col in cursor.fetchall()]

    print(f"\nSample data (first {limit} rows):")
    print(f"{'-'*80}")

    for row in rows:
        print("\nRow:")
        for i, col_name in enumerate(columns):
            value = row[i] if i < len(row) else 'N/A'
            print(f"  {col_name}: {value}")

def get_indexes(cursor, table_name):
    cursor.execute(f"SHOW INDEXES FROM {table_name}")
    indexes = cursor.fetchall()

    if indexes:
        print(f"\nIndexes:")
        print(f"{'-'*80}")
        for idx in indexes:
            print(f"  {idx}")

def main():
    if connection_lib == 'pymysql':
        conn = pymysql.connect(
            host='rdss2.speedex.it',
            user='i2',
            password='gMIagisJQ0oTxTHB',
            database='i2_speedex'
        )
    else:
        conn = mysql.connector.connect(
            host='rdss2.speedex.it',
            user='i2',
            password='gMIagisJQ0oTxTHB',
            database='i2_speedex'
        )

    cursor = conn.cursor()

    tables = ['sales', 'sale_lines', 'buyers', 'producers']

    print(f"Using connection library: {connection_lib}")
    print(f"Connected to database: i2_speedex")

    for table in tables:
        try:
            get_table_structure(cursor, table)
            get_indexes(cursor, table)
            get_sample_data(cursor, table, limit=2)
        except Exception as e:
            print(f"Error analyzing table {table}: {e}")

    # Get foreign key relationships
    print(f"\n{'='*80}")
    print("FOREIGN KEY RELATIONSHIPS")
    print(f"{'='*80}")

    for table in tables:
        cursor.execute(f"""
            SELECT
                CONSTRAINT_NAME,
                TABLE_NAME,
                COLUMN_NAME,
                REFERENCED_TABLE_NAME,
                REFERENCED_COLUMN_NAME
            FROM
                INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE
                TABLE_SCHEMA = 'i2_speedex'
                AND TABLE_NAME = '{table}'
                AND REFERENCED_TABLE_NAME IS NOT NULL
        """)

        fks = cursor.fetchall()
        if fks:
            print(f"\nTable: {table}")
            for fk in fks:
                print(f"  {fk[2]} -> {fk[3]}.{fk[4]}")

    conn.close()

if __name__ == '__main__':
    main()
