#!/usr/bin/env node
/**
 * ETL Script: Ingest Copart CSV → RAW → Staging
 * Sprint: S1 ETL A (CSV→PG)
 * Usage: node scripts/ingest-copart-csv.js <csv_path>
 */

import fs from 'fs';
import crypto from 'crypto';
import pg from 'pg';
import csvParser from 'csv-parser';
import path from 'path';

const { Client } = pg;

const DB_URL = process.env.DATABASE_URL;

async function main() {
  const csvPath = process.argv[2];

  if (!csvPath) {
    console.error('Usage: node ingest-copart-csv.js <csv_path>');
    process.exit(1);
  }

  if (!fs.existsSync(csvPath)) {
    console.error(`Error: File not found: ${csvPath}`);
    process.exit(1);
  }

  console.log(`\n${'='.repeat(60)}`);
  console.log(`  Copart CSV Ingestion — S1 ETL`);
  console.log(`${'='.repeat(60)}\n`);
  console.log(`Source: ${csvPath}`);

  const client = new Client({ connectionString: DB_URL });
  await client.connect();
  console.log('✓ Connected to database\n');

  try {
    // Step 1: Compute SHA256
    const fileBuffer = fs.readFileSync(csvPath);
    const sha256 = crypto.createHash('sha256').update(fileBuffer).digest('hex');
    const bytes = fileBuffer.length;
    console.log(`SHA256: ${sha256}`);
    console.log(`Bytes: ${bytes.toLocaleString()}\n`);

    // Step 2: Check if already ingested
    const checkResult = await client.query(
      'SELECT file_id FROM raw.csv_files WHERE sha256 = $1',
      [sha256]
    );

    if (checkResult.rows.length > 0) {
      console.log(`⚠️  File already ingested (file_id: ${checkResult.rows[0].file_id})`);
      console.log('Skipping ingestion (idempotent).\n');
      process.exit(0);
    }

    // Step 3: Parse CSV headers
    const rows = [];
    let headers = null;

    await new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csvParser())
        .on('headers', (h) => { headers = h; })
        .on('data', (row) => rows.push(row))
        .on('end', resolve)
        .on('error', reject);
    });

    console.log(`Parsed ${rows.length.toLocaleString()} rows`);
    console.log(`Headers: ${headers.length} columns\n`);

    // Step 4: Insert into raw.csv_files
    const fileResult = await client.query(`
      INSERT INTO raw.csv_files (path, sha256, bytes, row_count, headers_jsonb, window_start_utc)
      VALUES ($1, $2, $3, $4, $5, now())
      RETURNING file_id
    `, [csvPath, sha256, bytes, rows.length, JSON.stringify(headers)]);

    const fileId = fileResult.rows[0].file_id;
    console.log(`✓ Inserted into raw.csv_files (file_id: ${fileId})\n`);

    // Step 5: Insert into raw.rows (batch)
    console.log('Inserting rows into raw.rows...');
    const batchSize = 1000;
    let inserted = 0;

    for (let i = 0; i < rows.length; i += batchSize) {
      const batch = rows.slice(i, i + batchSize);
      const values = batch.map((row, idx) =>
        `('${fileId}', ${i + idx + 1}, '${JSON.stringify(row).replace(/'/g, "''")}'::jsonb)`
      ).join(',');

      await client.query(`
        INSERT INTO raw.rows (file_id, row_no, payload_jsonb)
        VALUES ${values}
      `);

      inserted += batch.length;
      process.stdout.write(`\r  Inserted: ${inserted.toLocaleString()} / ${rows.length.toLocaleString()}`);
    }

    console.log('\n✓ All rows inserted into raw.rows\n');

    // Step 6: Extract keys into staging.copart_raw
    console.log('Extracting keys into staging.copart_raw...');
    const stagingResult = await client.query(`
      INSERT INTO staging.copart_raw (file_id, window_start_utc, lot_external_id, vin_raw, payload_jsonb)
      SELECT
        file_id,
        now() as window_start_utc,
        payload_jsonb->>'Lot number' as lot_external_id,
        payload_jsonb->>'VIN' as vin_raw,
        payload_jsonb
      FROM raw.rows
      WHERE file_id = $1
      RETURNING id
    `, [fileId]);

    console.log(`✓ Inserted ${stagingResult.rowCount.toLocaleString()} rows into staging.copart_raw\n`);

    // Step 7: Summary metrics
    const metricsResult = await client.query(`
      SELECT
        COUNT(*) as total_rows,
        COUNT(*) FILTER (WHERE lot_external_id IS NULL) as null_lot_count,
        COUNT(*) FILTER (WHERE vin_raw IS NULL OR vin_raw = '') as null_vin_count
      FROM staging.copart_raw
      WHERE file_id = $1
    `, [fileId]);

    const metrics = metricsResult.rows[0];
    console.log(`${'='.repeat(60)}`);
    console.log(`  Ingestion Summary`);
    console.log(`${'='.repeat(60)}`);
    console.log(`Total rows: ${parseInt(metrics.total_rows).toLocaleString()}`);
    console.log(`Missing Lot ID: ${metrics.null_lot_count} (${(100 * metrics.null_lot_count / metrics.total_rows).toFixed(2)}%)`);
    console.log(`Missing VIN: ${metrics.null_vin_count} (${(100 * metrics.null_vin_count / metrics.total_rows).toFixed(2)}%)`);
    console.log(`\n✅ Ingestion complete!\n`);

  } catch (error) {
    console.error('\n❌ Error during ingestion:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
