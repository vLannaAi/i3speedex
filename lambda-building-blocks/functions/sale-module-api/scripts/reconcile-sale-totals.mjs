#!/usr/bin/env node

/**
 * Reconcile Sale Totals
 *
 * Scans all sales in DynamoDB and recalculates totals from sale lines.
 * Fixes sales where the stored total doesn't match the computed total.
 *
 * Usage:
 *   node scripts/reconcile-sale-totals.mjs --env dev              # dry-run (default)
 *   node scripts/reconcile-sale-totals.mjs --env dev --fix        # apply fixes
 *   node scripts/reconcile-sale-totals.mjs --table my-table-name  # explicit table name
 *
 * Requires AWS credentials configured (via env vars, profile, or SSO).
 * Region defaults to eu-west-1.
 */

import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, ScanCommand, QueryCommand, UpdateCommand } from '@aws-sdk/lib-dynamodb';

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------
const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(`--${name}`);
  if (idx === -1) return undefined;
  return args[idx + 1];
}

const hasFlag = (name) => args.includes(`--${name}`);

const env = getArg('env');           // dev | staging | prod
const explicitTable = getArg('table');
const fix = hasFlag('fix');
const region = getArg('region') || 'eu-west-1';

const tableName = explicitTable || (env ? `i2speedex-sales-${env}` : null);

if (!tableName) {
  console.error('Error: Provide --env <dev|staging|prod> or --table <table-name>');
  process.exit(1);
}

console.log(`Table:    ${tableName}`);
console.log(`Region:   ${region}`);
console.log(`Mode:     ${fix ? 'FIX (will write updates)' : 'DRY-RUN (read-only)'}`);
console.log('');

// ---------------------------------------------------------------------------
// DynamoDB client
// ---------------------------------------------------------------------------
const client = new DynamoDBClient({ region });
const ddb = DynamoDBDocumentClient.from(client, {
  marshallOptions: { removeUndefinedValues: true },
  unmarshallOptions: { wrapNumbers: false },
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const round2 = (n) => Math.round(n * 100) / 100;

async function scanAllSales() {
  const sales = [];
  let lastKey = undefined;

  do {
    const res = await ddb.send(new ScanCommand({
      TableName: tableName,
      FilterExpression: 'SK = :sk AND attribute_not_exists(deletedAt)',
      ExpressionAttributeValues: { ':sk': 'METADATA' },
      ExclusiveStartKey: lastKey,
    }));
    sales.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  return sales;
}

async function queryLines(saleId) {
  const lines = [];
  let lastKey = undefined;

  do {
    const res = await ddb.send(new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: 'PK = :pk AND begins_with(SK, :prefix)',
      FilterExpression: 'attribute_not_exists(deletedAt)',
      ExpressionAttributeValues: {
        ':pk': `SALE#${saleId}`,
        ':prefix': 'LINE#',
      },
      ExclusiveStartKey: lastKey,
    }));
    lines.push(...(res.Items || []));
    lastKey = res.LastEvaluatedKey;
  } while (lastKey);

  return lines;
}

async function updateSaleTotals(saleId, subtotal, taxAmount, total, linesCount) {
  await ddb.send(new UpdateCommand({
    TableName: tableName,
    Key: { PK: `SALE#${saleId}`, SK: 'METADATA' },
    UpdateExpression: 'SET subtotal = :subtotal, taxAmount = :taxAmount, #total = :total, linesCount = :linesCount, updatedAt = :updatedAt, updatedBy = :updatedBy',
    ExpressionAttributeNames: { '#total': 'total' },
    ExpressionAttributeValues: {
      ':subtotal': subtotal,
      ':taxAmount': taxAmount,
      ':total': total,
      ':linesCount': linesCount,
      ':updatedAt': new Date().toISOString(),
      ':updatedBy': 'reconciliation-script',
    },
  }));
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log('Scanning sales...');
  const sales = await scanAllSales();
  console.log(`Found ${sales.length} sales.\n`);

  let correct = 0;
  let mismatched = 0;
  let fixed = 0;
  let noLines = 0;
  const errors = [];

  for (const sale of sales) {
    const saleId = sale.saleId || sale.PK?.replace('SALE#', '');
    const saleNumber = sale.saleNumber || '?';

    try {
      const lines = await queryLines(saleId);

      if (lines.length === 0) {
        noLines++;
        continue;
      }

      const calcSubtotal = round2(lines.reduce((sum, l) => sum + (l.netAmount || 0), 0));
      const calcTaxAmount = round2(lines.reduce((sum, l) => sum + (l.taxAmount || 0), 0));
      const calcTotal = round2(lines.reduce((sum, l) => sum + (l.totalAmount || 0), 0));
      const calcLinesCount = lines.length;

      const storedSubtotal = sale.subtotal || 0;
      const storedTaxAmount = sale.taxAmount || 0;
      const storedTotal = sale.total || 0;
      const storedLinesCount = sale.linesCount || 0;

      const subtotalOk = Math.abs(storedSubtotal - calcSubtotal) < 0.01;
      const taxOk = Math.abs(storedTaxAmount - calcTaxAmount) < 0.01;
      const totalOk = Math.abs(storedTotal - calcTotal) < 0.01;
      const countOk = storedLinesCount === calcLinesCount;

      if (subtotalOk && taxOk && totalOk && countOk) {
        correct++;
        continue;
      }

      mismatched++;
      console.log(`MISMATCH  Sale #${saleNumber} (${saleId})`);
      console.log(`  stored:     subtotal=${storedSubtotal}  tax=${storedTaxAmount}  total=${storedTotal}  lines=${storedLinesCount}`);
      console.log(`  calculated: subtotal=${calcSubtotal}  tax=${calcTaxAmount}  total=${calcTotal}  lines=${calcLinesCount}`);

      if (fix) {
        await updateSaleTotals(saleId, calcSubtotal, calcTaxAmount, calcTotal, calcLinesCount);
        fixed++;
        console.log(`  -> FIXED`);
      }
      console.log('');
    } catch (err) {
      errors.push({ saleId, saleNumber, error: err.message });
      console.error(`ERROR  Sale #${saleNumber} (${saleId}): ${err.message}`);
    }
  }

  console.log('========================================');
  console.log('Summary');
  console.log('========================================');
  console.log(`Total sales scanned: ${sales.length}`);
  console.log(`  Correct:           ${correct}`);
  console.log(`  No lines (skip):   ${noLines}`);
  console.log(`  Mismatched:        ${mismatched}`);
  if (fix) {
    console.log(`  Fixed:             ${fixed}`);
  }
  if (errors.length > 0) {
    console.log(`  Errors:            ${errors.length}`);
  }

  if (mismatched > 0 && !fix) {
    console.log('\nRun with --fix to apply corrections.');
  }
}

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
