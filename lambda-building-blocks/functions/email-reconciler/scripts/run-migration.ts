/**
 * Migration Script - Add AI extraction columns to msg_emails
 *
 * Usage: npx ts-node scripts/run-migration.ts
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as mysql from 'mysql2/promise';

async function main() {
  console.log('Connecting to database...');

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log('Connected!\n');

  try {
    // Check if columns already exist
    console.log('Checking existing columns...');
    const [columns] = await connection.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM msg_emails LIKE 'ai_%'"
    );

    if (columns.length > 0) {
      console.log(`Found ${columns.length} existing ai_ columns:`);
      columns.forEach((col: any) => console.log(`  - ${col.Field}`));
      console.log('\nMigration may have already been applied.');

      // Check if all columns exist
      const expectedColumns = [
        'ai_name1', 'ai_name2', 'ai_genre', 'ai_email', 'ai_confidence',
        'ai_status', 'ai_notes', 'ai_processed_at', 'ai_model',
        'ai_is_personal', 'ai_domain_convention',
        'ai_name1pre', 'ai_name2pre', 'ai_name3', 'ai_version'
      ];

      const existingColumns = columns.map((c: any) => c.Field);
      const missingColumns = expectedColumns.filter(c => !existingColumns.includes(c));

      if (missingColumns.length === 0) {
        console.log('All columns present. Nothing to do.');
        await connection.end();
        return;
      }

      console.log(`Missing columns: ${missingColumns.join(', ')}`);
    }

    console.log('\nApplying migration...\n');

    // Add columns one by one to handle partial migrations
    const alterStatements = [
      {
        column: 'ai_name1',
        sql: "ALTER TABLE msg_emails ADD COLUMN ai_name1 VARCHAR(100) DEFAULT NULL COMMENT 'AI extracted given name + middle names'"
      },
      {
        column: 'ai_name2',
        sql: "ALTER TABLE msg_emails ADD COLUMN ai_name2 VARCHAR(100) DEFAULT NULL COMMENT 'AI extracted family/surname'"
      },
      {
        column: 'ai_genre',
        sql: "ALTER TABLE msg_emails ADD COLUMN ai_genre ENUM('Mr.', 'Ms.') DEFAULT NULL COMMENT 'AI inferred gender from honorifics'"
      },
      {
        column: 'ai_email',
        sql: "ALTER TABLE msg_emails ADD COLUMN ai_email VARCHAR(255) DEFAULT NULL COMMENT 'AI normalized email address'"
      },
      {
        column: 'ai_confidence',
        sql: "ALTER TABLE msg_emails ADD COLUMN ai_confidence DECIMAL(3,2) DEFAULT NULL COMMENT 'AI extraction confidence 0.00-1.00'"
      },
      {
        column: 'ai_status',
        sql: "ALTER TABLE msg_emails ADD COLUMN ai_status ENUM('unprocessed', 'extracted_high', 'extracted_medium', 'extracted_low', 'reviewed', 'not_applicable') DEFAULT 'unprocessed' COMMENT 'AI extraction status'"
      },
      {
        column: 'ai_notes',
        sql: "ALTER TABLE msg_emails ADD COLUMN ai_notes TEXT DEFAULT NULL COMMENT 'AI reasoning and processing notes'"
      },
      {
        column: 'ai_processed_at',
        sql: "ALTER TABLE msg_emails ADD COLUMN ai_processed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'When AI extraction was performed'"
      },
      {
        column: 'ai_model',
        sql: "ALTER TABLE msg_emails ADD COLUMN ai_model VARCHAR(50) DEFAULT NULL COMMENT 'Model used for extraction'"
      },
      {
        column: 'ai_is_personal',
        sql: "ALTER TABLE msg_emails ADD COLUMN ai_is_personal BOOLEAN DEFAULT NULL COMMENT 'AI determined if personal vs service address'"
      },
      {
        column: 'ai_domain_convention',
        sql: "ALTER TABLE msg_emails ADD COLUMN ai_domain_convention VARCHAR(50) DEFAULT NULL COMMENT 'Detected email pattern for domain'"
      },
      {
        column: 'ai_name1pre',
        sql: "ALTER TABLE msg_emails ADD COLUMN ai_name1pre VARCHAR(10) DEFAULT NULL COMMENT 'Initial of ai_name1 (e.g., M.)'"
      },
      {
        column: 'ai_name2pre',
        sql: "ALTER TABLE msg_emails ADD COLUMN ai_name2pre VARCHAR(10) DEFAULT NULL COMMENT 'Initial of ai_name2 (e.g., R.)'"
      },
      {
        column: 'ai_name3',
        sql: "ALTER TABLE msg_emails ADD COLUMN ai_name3 VARCHAR(100) DEFAULT NULL COMMENT 'Functional/role label for non-personal addresses'"
      },
      {
        column: 'ai_version',
        sql: "ALTER TABLE msg_emails ADD COLUMN ai_version SMALLINT UNSIGNED DEFAULT NULL COMMENT 'Extraction pipeline version'"
      },
    ];

    for (const { column, sql } of alterStatements) {
      try {
        // Check if column exists
        const [existing] = await connection.query<mysql.RowDataPacket[]>(
          `SHOW COLUMNS FROM msg_emails LIKE '${column}'`
        );

        if (existing.length > 0) {
          console.log(`  ✓ Column ${column} already exists, skipping`);
          continue;
        }

        await connection.query(sql);
        console.log(`  ✓ Added column: ${column}`);
      } catch (error: any) {
        if (error.code === 'ER_DUP_FIELDNAME') {
          console.log(`  ✓ Column ${column} already exists`);
        } else {
          console.error(`  ✗ Error adding ${column}:`, error.message);
        }
      }
    }

    // Add indexes
    console.log('\nAdding indexes...');

    const indexes = [
      { name: 'idx_ai_status', sql: 'CREATE INDEX idx_ai_status ON msg_emails (ai_status)' },
      { name: 'idx_ai_confidence', sql: 'CREATE INDEX idx_ai_confidence ON msg_emails (ai_confidence)' },
      { name: 'idx_ai_processed_at', sql: 'CREATE INDEX idx_ai_processed_at ON msg_emails (ai_processed_at)' },
      { name: 'idx_ai_name1pre', sql: 'CREATE INDEX idx_ai_name1pre ON msg_emails (ai_name1pre)' },
      { name: 'idx_ai_name2pre', sql: 'CREATE INDEX idx_ai_name2pre ON msg_emails (ai_name2pre)' },
      { name: 'idx_ai_name3', sql: 'CREATE INDEX idx_ai_name3 ON msg_emails (ai_name3)' },
      { name: 'idx_ai_version', sql: 'CREATE INDEX idx_ai_version ON msg_emails (ai_version)' },
    ];

    for (const { name, sql } of indexes) {
      try {
        await connection.query(sql);
        console.log(`  ✓ Created index: ${name}`);
      } catch (error: any) {
        if (error.code === 'ER_DUP_KEYNAME') {
          console.log(`  ✓ Index ${name} already exists`);
        } else {
          console.error(`  ✗ Error creating ${name}:`, error.message);
        }
      }
    }

    // Verify final state
    console.log('\nVerifying migration...');
    const [finalColumns] = await connection.query<mysql.RowDataPacket[]>(
      "SHOW COLUMNS FROM msg_emails LIKE 'ai_%'"
    );

    console.log(`\nFinal state: ${finalColumns.length} ai_ columns in msg_emails:`);
    finalColumns.forEach((col: any) => {
      console.log(`  - ${col.Field} (${col.Type})`);
    });

    // Get record count
    const [countResult] = await connection.query<mysql.RowDataPacket[]>(
      'SELECT COUNT(*) as total, SUM(CASE WHEN user_ud IS NULL THEN 1 ELSE 0 END) as unlinked FROM msg_emails'
    );

    console.log(`\nTable statistics:`);
    console.log(`  Total records: ${countResult[0].total}`);
    console.log(`  Unlinked (user_ud IS NULL): ${countResult[0].unlinked}`);

    console.log('\n✓ Migration completed successfully!');

  } catch (error) {
    console.error('Migration error:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
