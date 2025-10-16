#!/usr/bin/env node

/**
 * Completion Detector Script
 * Sprint: S1C — Phase 1 (Safe, Passive Detection)
 *
 * Purpose: Detect auction completions by comparing consecutive CSV snapshots
 * Methods:
 *   1. CSV Disappearance - Mark lots as pending_result when they disappear after auction
 *   2. VIN Reappearance - Mark previous lots as not_sold when VIN reappears
 *
 * Risk Level: MINIMAL (no external requests, internal DB analysis only)
 *
 * Usage:
 *   node scripts/detect-completions.js
 *   node scripts/detect-completions.js --grace-period=2  (custom grace period in hours)
 *   node scripts/detect-completions.js --dry-run  (preview without updating)
 */

require('dotenv').config({ path: './deploy/.env.runtime' });
const { Pool } = require('pg');

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  acc[key.replace('--', '')] = value || true;
  return acc;
}, {});

const GRACE_PERIOD_HOURS = parseFloat(args['grace-period'] || '1');
const DRY_RUN = args['dry-run'] === true;

// Database connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL_DISABLE === '1' ? false : undefined,
  max: parseInt(process.env.PGPOOL_MAX || '10'),
  idleTimeoutMillis: parseInt(process.env.PGPOOL_IDLE_MS || '10000'),
  statement_timeout: parseInt(process.env.PG_STMT_MS || '30000'),
});

console.log('\n============================================================');
console.log('  Completion Detector — Phase 1 (Safe, Passive)');
console.log('============================================================\n');

if (DRY_RUN) {
  console.log('⚠️  DRY RUN MODE - No database updates will be performed\n');
}

async function getLatestTwoFiles() {
  const result = await pool.query(`
    SELECT file_id, path, ingested_at
    FROM raw.csv_files
    ORDER BY ingested_at DESC
    LIMIT 2
  `);

  if (result.rows.length < 2) {
    throw new Error('Need at least 2 CSV files ingested to compare');
  }

  return {
    current: result.rows[0],
    previous: result.rows[1]
  };
}

async function analyzeDisappearances(prevFileId, currFileId) {
  const result = await pool.query(`
    SELECT *
    FROM detect_disappeared_lots($1, $2, $3)
  `, [prevFileId, currFileId, GRACE_PERIOD_HOURS]);

  return result.rows;
}

async function analyzeReappearances(currFileId) {
  const result = await pool.query(`
    SELECT *
    FROM detect_vin_reappearances($1)
  `, [currFileId]);

  return result.rows;
}

async function runDetection(prevFileId, currFileId) {
  const result = await pool.query(`
    SELECT *
    FROM run_completion_detection($1, $2, $3)
  `, [prevFileId, currFileId, GRACE_PERIOD_HOURS]);

  return result.rows[0];
}

async function getCompletionStats() {
  const result = await pool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status = 'pending_result') as pending_count,
      COUNT(*) FILTER (WHERE status = 'not_sold') as not_sold_count,
      COUNT(*) FILTER (WHERE status = 'sold') as sold_count,
      COUNT(*) FILTER (WHERE status = 'on_approval') as on_approval_count
    FROM lots
    WHERE sale_confirmed_at >= now() - INTERVAL '24 hours'
  `);

  return result.rows[0];
}

async function main() {
  try {
    console.log('Connecting to database...');
    // Test connection
    await pool.query('SELECT 1');
    console.log('✓ Connected\n');

    // Get latest two CSV files
    console.log('Fetching latest CSV files...');
    const files = await getLatestTwoFiles();

    console.log(`Previous CSV: ${files.previous.path}`);
    console.log(`  File ID: ${files.previous.file_id}`);
    console.log(`  Ingested: ${files.previous.ingested_at}`);
    console.log();
    console.log(`Current CSV: ${files.current.path}`);
    console.log(`  File ID: ${files.current.file_id}`);
    console.log(`  Ingested: ${files.current.ingested_at}`);
    console.log();

    // Analyze disappearances (preview)
    console.log('Analyzing disappeared lots...');
    const disappeared = await analyzeDisappearances(
      files.previous.file_id,
      files.current.file_id
    );

    console.log(`  Found ${disappeared.length} lots that disappeared from CSV`);
    if (disappeared.length > 0 && disappeared.length <= 10) {
      console.log('\n  Sample disappeared lots:');
      disappeared.slice(0, 5).forEach(lot => {
        console.log(`    - Lot ${lot.lot_external_id} (VIN: ${lot.vin || 'N/A'})`);
        console.log(`      Auction: ${lot.auction_datetime_utc}`);
        console.log(`      Hours since: ${parseFloat(lot.hours_since_auction).toFixed(1)}h`);
        console.log(`      Current status: ${lot.current_status}`);
      });
    }
    console.log();

    // Analyze reappearances (preview)
    console.log('Analyzing VIN reappearances...');
    const reappeared = await analyzeReappearances(files.current.file_id);

    console.log(`  Found ${reappeared.length} VINs that reappeared (indicating previous not_sold)`);
    if (reappeared.length > 0 && reappeared.length <= 10) {
      console.log('\n  Sample reappearances:');
      reappeared.slice(0, 5).forEach(reapp => {
        console.log(`    - VIN: ${reapp.vin}`);
        console.log(`      Previous lot: ${reapp.prev_lot_id} (${reapp.prev_auction_date})`);
        console.log(`      New lot: ${reapp.new_lot_id} (${reapp.new_auction_date})`);
      });
    }
    console.log();

    if (DRY_RUN) {
      console.log('============================================================');
      console.log('  DRY RUN COMPLETE - No changes made to database');
      console.log('============================================================\n');
      return;
    }

    // Run actual detection (updates database)
    console.log('Running completion detection...');
    const startTime = Date.now();

    const results = await runDetection(
      files.previous.file_id,
      files.current.file_id
    );

    const endTime = Date.now();
    const totalTime = endTime - startTime;

    console.log('✓ Detection complete!\n');

    // Display results
    console.log('============================================================');
    console.log('  Detection Results');
    console.log('============================================================');
    console.log();
    console.log(`Disappeared lots: ${results.disappeared_count}`);
    console.log(`Marked as pending_result: ${results.marked_pending_count}`);
    console.log(`Marked as not_sold (via reappearance): ${results.marked_not_sold_count}`);
    console.log();
    console.log(`Execution time: ${results.execution_time_ms}ms (DB) + ${totalTime}ms (total)`);
    console.log();

    // Get overall stats
    const stats = await getCompletionStats();
    console.log('============================================================');
    console.log('  24-Hour Summary');
    console.log('============================================================');
    console.log();
    console.log(`Pending result: ${stats.pending_count}`);
    console.log(`Not sold: ${stats.not_sold_count}`);
    console.log(`Sold: ${stats.sold_count}`);
    console.log(`On approval: ${stats.on_approval_count}`);
    console.log();

    console.log('✅ Completion detection finished successfully!');
    console.log();

  } catch (error) {
    console.error('\n❌ Error during completion detection:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

// Handle graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n\nReceived SIGINT, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n\nReceived SIGTERM, shutting down gracefully...');
  await pool.end();
  process.exit(0);
});

// Run the script
main();
