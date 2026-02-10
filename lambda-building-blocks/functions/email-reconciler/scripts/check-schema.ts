/**
 * Check msg_emails table schema
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as mysql from 'mysql2/promise';

async function main() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  try {
    console.log('msg_emails table schema:\n');
    const [columns] = await connection.query<mysql.RowDataPacket[]>(
      'SHOW COLUMNS FROM msg_emails'
    );

    columns.forEach((col: any) => {
      console.log(`  ${col.Field.padEnd(25)} ${col.Type.padEnd(30)} ${col.Null === 'YES' ? 'NULL' : 'NOT NULL'}`);
    });

    console.log('\n\nSample records (first 5):');
    const [rows] = await connection.query<mysql.RowDataPacket[]>(
      'SELECT * FROM msg_emails LIMIT 5'
    );

    rows.forEach((row: any, i: number) => {
      console.log(`\n--- Record ${i + 1} ---`);
      Object.keys(row).forEach(key => {
        const val = row[key];
        const displayVal = val === null ? 'NULL' : (typeof val === 'string' && val.length > 50 ? val.substring(0, 50) + '...' : val);
        console.log(`  ${key}: ${displayVal}`);
      });
    });

  } finally {
    await connection.end();
  }
}

main().catch(console.error);
