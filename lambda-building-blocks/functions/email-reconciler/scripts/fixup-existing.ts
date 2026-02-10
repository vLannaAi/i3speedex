/**
 * Fixup Script for Existing Records
 *
 * Retroactively applies three improvements to already-processed records
 * WITHOUT re-calling the LLM:
 *
 * Pass 1: Apply capitalizeProper() to ai_name1/ai_name2, compute initials
 * Pass 2: Fill missing genre via getGenreByName1() (works because Pass 1 normalized names)
 *
 * Usage:
 *   npx ts-node scripts/fixup-existing.ts
 *
 * Environment variables required:
 *   DB_HOST, DB_USER, DB_PASSWORD, DB_NAME (or DB_URL)
 */

import * as dotenv from 'dotenv';
dotenv.config();

import * as mysql from 'mysql2/promise';
import { capitalizeProper } from '../src/parser';
import { computeInitial, computeName3, AI_EXTRACTION_VERSION } from '../src/extraction-validator';

async function main() {
  console.log(`
========================================
Fixup Existing Records
========================================
Pass 1: Capitalize names + compute initials
Pass 2: Fill missing genre from majority vote
Pass 3: Compute ai_name3 for non-personal addresses
========================================
`);

  if (!process.env.DB_HOST && !process.env.DB_URL) {
    console.error('Error: Database connection environment variables are required');
    process.exit(1);
  }

  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    port: parseInt(process.env.DB_PORT || '3306', 10),
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
  });

  console.log('Connected to database.\n');

  try {
    // ================================================================
    // Pass 1: Capitalize names + compute initials
    // ================================================================
    console.log('--- Pass 1: Capitalize + Initials ---\n');

    const [rows] = await connection.query<mysql.RowDataPacket[]>(`
      SELECT id, ai_name1, ai_name2, ai_email
      FROM msg_emails
      WHERE ai_status IS NOT NULL
        AND ai_status != 'unprocessed'
    `);

    console.log(`Found ${rows.length} processed records to fix up.\n`);

    let capitalizedCount = 0;
    let initialsCount = 0;

    for (const row of rows) {
      const id = row.id as number;
      const origName1 = row.ai_name1 as string | null;
      const origName2 = row.ai_name2 as string | null;
      const email = (row.ai_email as string | null) || '';

      // Capitalize
      const newName1 = origName1 ? capitalizeProper(origName1) : null;
      const newName2 = origName2 ? capitalizeProper(origName2) : null;

      // Parse email local part for initial derivation
      const localPart = email.split('@')[0] || '';
      const localSegments = localPart.split(/[._-]/).filter((p: string) => p.length > 0);
      const firstSeg = localSegments[0] || null;
      const secondSeg = localSegments[1] || null;

      // Compute initials
      const name1pre = computeInitial(newName1, firstSeg);
      const name2pre = computeInitial(newName2, secondSeg);

      const nameChanged = newName1 !== origName1 || newName2 !== origName2;
      const hasInitials = name1pre !== null || name2pre !== null;

      if (nameChanged || hasInitials) {
        await connection.execute(`
          UPDATE msg_emails
          SET ai_name1 = ?,
              ai_name2 = ?,
              ai_name1pre = ?,
              ai_name2pre = ?,
              ai_version = ?
          WHERE id = ?
        `, [newName1, newName2, name1pre, name2pre, AI_EXTRACTION_VERSION, id]);

        if (nameChanged) capitalizedCount++;
        if (hasInitials) initialsCount++;
      }
    }

    console.log(`Pass 1 complete:`);
    console.log(`  Names re-capitalized: ${capitalizedCount}`);
    console.log(`  Initials computed:    ${initialsCount}\n`);

    // ================================================================
    // Pass 2: Fill missing genre via majority vote
    // ================================================================
    console.log('--- Pass 2: Genre Fallback ---\n');

    const [missingGenreRows] = await connection.query<mysql.RowDataPacket[]>(`
      SELECT id, ai_name1
      FROM msg_emails
      WHERE ai_genre IS NULL
        AND ai_name1 IS NOT NULL
        AND ai_status IS NOT NULL
        AND ai_status != 'unprocessed'
        AND ai_status != 'not_applicable'
    `);

    console.log(`Found ${missingGenreRows.length} records with missing genre.\n`);

    // Build a cache of name1 -> genre lookups to avoid repeated queries
    const genreCache = new Map<string, 'Mr.' | 'Ms.' | null>();
    let genreFilledCount = 0;

    for (const row of missingGenreRows) {
      const id = row.id as number;
      const name1 = row.ai_name1 as string;
      const cacheKey = name1.toLowerCase();

      let genre: 'Mr.' | 'Ms.' | null;

      if (genreCache.has(cacheKey)) {
        genre = genreCache.get(cacheKey)!;
      } else {
        // Query for majority genre
        const [genreRows] = await connection.query<mysql.RowDataPacket[]>(`
          SELECT ai_genre, COUNT(*) as cnt
          FROM msg_emails
          WHERE LOWER(ai_name1) = LOWER(?)
            AND ai_genre IS NOT NULL
          GROUP BY ai_genre
          ORDER BY cnt DESC
          LIMIT 1
        `, [name1]);

        if (genreRows.length > 0 && (genreRows[0].cnt as number) >= 2) {
          genre = genreRows[0].ai_genre as 'Mr.' | 'Ms.';
        } else {
          genre = null;
        }

        genreCache.set(cacheKey, genre);
      }

      if (genre) {
        await connection.execute(`
          UPDATE msg_emails
          SET ai_genre = ?,
              ai_version = ?
          WHERE id = ?
        `, [genre, AI_EXTRACTION_VERSION, id]);
        genreFilledCount++;
      }
    }

    console.log(`Pass 2 complete:`);
    console.log(`  Genre filled: ${genreFilledCount} / ${missingGenreRows.length}\n`);

    // ================================================================
    // Pass 3: Compute ai_name3 for non-personal addresses
    // ================================================================
    console.log('--- Pass 3: Compute ai_name3 ---\n');

    const [name3Rows] = await connection.query<mysql.RowDataPacket[]>(`
      SELECT id, ai_email, ai_is_personal
      FROM msg_emails
      WHERE ai_name3 IS NULL
        AND ai_status IS NOT NULL
        AND ai_status != 'unprocessed'
    `);

    console.log(`Found ${name3Rows.length} records to compute name3 for.\n`);

    let name3Count = 0;

    for (const row of name3Rows) {
      const id = row.id as number;
      const email = (row.ai_email as string | null) || '';
      const isPersonal = row.ai_is_personal === 1;

      const localPart = email.split('@')[0] || '';
      const name3 = computeName3(localPart, isPersonal);

      if (name3 !== null) {
        await connection.execute(`
          UPDATE msg_emails
          SET ai_name3 = ?,
              ai_version = ?
          WHERE id = ?
        `, [name3, AI_EXTRACTION_VERSION, id]);
        name3Count++;
      }
    }

    console.log(`Pass 3 complete:`);
    console.log(`  name3 computed: ${name3Count} / ${name3Rows.length}\n`);

    // ================================================================
    // Summary
    // ================================================================
    console.log(`
========================================
Fixup Complete!
========================================
Total records processed: ${rows.length}
Names re-capitalized:   ${capitalizedCount}
Initials computed:       ${initialsCount}
Genre filled:            ${genreFilledCount}
name3 computed:          ${name3Count}
========================================
`);

  } catch (error) {
    console.error('Fixup error:', error);
    throw error;
  } finally {
    await connection.end();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
