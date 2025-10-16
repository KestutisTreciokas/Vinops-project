#!/usr/bin/env node

/**
 * Automated Copart CSV Fetcher
 * Sprint: S1B — MS-S1B-01
 *
 * Purpose: Automatically download Copart CSV every ~15 minutes with cookie auth
 * Features:
 *   - Cookie-based authentication (member session)
 *   - User-Agent and Referer headers (required by Copart)
 *   - Timestamped storage: /var/data/vinops/raw/copart/YYYY/MM/DD/HHmm.csv
 *   - Lock file to prevent concurrent runs
 *   - Automatic ingestion trigger on success
 *   - Retry logic with exponential backoff (3 attempts)
 *
 * Usage:
 *   node scripts/fetch-copart-csv.js
 *   node scripts/fetch-copart-csv.js --dry-run  (test without triggering ingestion)
 */

require('dotenv').config({ path: './deploy/.env.runtime' });
const fs = require('fs');
const https = require('https');
const { spawn } = require('child_process');
const path = require('path');

// Parse command line arguments
const args = process.argv.slice(2).reduce((acc, arg) => {
  const [key, value] = arg.split('=');
  acc[key.replace('--', '')] = value || true;
  return acc;
}, {});

const DRY_RUN = args['dry-run'] === true;
const LOCK_FILE = '/var/run/copart-etl.lock';

// Configuration
const CSV_URL = process.env.COPART_CSV_URL || 'https://inventory.copart.io/FTPLSTDM/salesdata.cgi?authKey=YPYU91EI';
const SESSION_COOKIE = process.env.COPART_SESSION_COOKIE; // From environment or vault
const OUTPUT_BASE = process.env.COPART_RAW_DIR || '/var/data/vinops/raw/copart';
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36';
const REFERER = 'https://www.copart.com/downloadSalesData';

console.log('\n============================================================');
console.log('  Automated Copart CSV Fetcher — S1B MS-01');
console.log('============================================================\n');

if (DRY_RUN) {
  console.log('⚠️  DRY RUN MODE - Will not trigger ingestion\n');
}

/**
 * Check and create lock file to prevent concurrent runs
 */
function acquireLock() {
  if (fs.existsSync(LOCK_FILE)) {
    const lockData = fs.readFileSync(LOCK_FILE, 'utf8');
    console.error(`❌ Lock file exists: ${LOCK_FILE}`);
    console.error(`   Lock data: ${lockData}`);
    console.error('   Another fetch process may be running.');
    console.error('   If stuck, remove the lock file manually.\n');
    process.exit(1);
  }

  const lockData = JSON.stringify({
    pid: process.pid,
    timestamp: new Date().toISOString(),
  });

  fs.writeFileSync(LOCK_FILE, lockData);
  console.log(`✓ Lock acquired (PID: ${process.pid})\n`);
}

/**
 * Release lock file
 */
function releaseLock() {
  if (fs.existsSync(LOCK_FILE)) {
    fs.unlinkSync(LOCK_FILE);
    console.log('\n✓ Lock released\n');
  }
}

/**
 * Generate timestamped output path: /var/data/vinops/raw/copart/YYYY/MM/DD/HHmm.csv
 */
function generateOutputPath() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const hour = String(now.getHours()).padStart(2, '0');
  const minute = String(now.getMinutes()).padStart(2, '0');

  const dir = path.join(OUTPUT_BASE, String(year), month, day);
  const filename = `${hour}${minute}.csv`;

  return { dir, filename, fullPath: path.join(dir, filename) };
}

/**
 * Download CSV with retry logic
 */
async function downloadCSV(outputPath, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      console.log(`Attempt ${attempt}/${retries}: Downloading CSV...`);
      await downloadCSVOnce(outputPath);
      return true;
    } catch (error) {
      console.error(`  ❌ Attempt ${attempt} failed: ${error.message}`);

      if (attempt < retries) {
        const backoffMs = Math.pow(2, attempt) * 1000; // 2s, 4s, 8s
        console.log(`  Retrying in ${backoffMs / 1000}s...\n`);
        await sleep(backoffMs);
      } else {
        throw new Error(`Failed after ${retries} attempts: ${error.message}`);
      }
    }
  }
}

/**
 * Single download attempt
 */
function downloadCSVOnce(outputPath) {
  return new Promise((resolve, reject) => {
    const startTime = Date.now();

    const options = {
      headers: {
        'User-Agent': USER_AGENT,
        'Referer': REFERER,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
      },
    };

    // Add cookie if available
    if (SESSION_COOKIE) {
      options.headers['Cookie'] = SESSION_COOKIE;
    } else {
      console.warn('⚠️  WARNING: No session cookie provided (COPART_SESSION_COOKIE env var)');
      console.warn('   Download may fail if authentication is required.\n');
    }

    const file = fs.createWriteStream(outputPath);
    let receivedBytes = 0;

    https.get(CSV_URL, options, (response) => {
      if (response.statusCode !== 200) {
        reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
        return;
      }

      console.log(`  Status: ${response.statusCode}`);
      console.log(`  Content-Type: ${response.headers['content-type']}`);
      console.log(`  Content-Length: ${response.headers['content-length']} bytes`);
      console.log(`  Last-Modified: ${response.headers['last-modified']}\n`);

      response.on('data', (chunk) => {
        receivedBytes += chunk.length;
      });

      response.pipe(file);

      file.on('finish', () => {
        file.close();
        const duration = Date.now() - startTime;
        console.log(`✓ Downloaded ${receivedBytes} bytes in ${duration}ms`);
        console.log(`  Saved to: ${outputPath}\n`);
        resolve();
      });
    }).on('error', (error) => {
      fs.unlinkSync(outputPath);
      reject(error);
    });
  });
}

/**
 * Trigger ingestion script
 */
async function triggerIngestion(csvPath) {
  if (DRY_RUN) {
    console.log('DRY RUN: Skipping ingestion trigger\n');
    return;
  }

  console.log('Triggering ingestion...');

  return new Promise((resolve, reject) => {
    const ingest = spawn('node', ['scripts/ingest-copart-csv.js', csvPath], {
      stdio: 'inherit',
    });

    ingest.on('close', (code) => {
      if (code === 0) {
        console.log('✓ Ingestion completed successfully\n');
        resolve();
      } else {
        reject(new Error(`Ingestion failed with exit code ${code}`));
      }
    });

    ingest.on('error', (error) => {
      reject(error);
    });
  });
}

/**
 * Sleep utility
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Main execution
 */
async function main() {
  try {
    // Acquire lock
    acquireLock();

    // Generate output path
    const { dir, fullPath } = generateOutputPath();
    console.log(`Output directory: ${dir}`);
    console.log(`Output file: ${fullPath}\n`);

    // Create output directory if it doesn't exist
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`✓ Created directory: ${dir}\n`);
    }

    // Check if file already exists (idempotency)
    if (fs.existsSync(fullPath)) {
      console.log(`⚠️  File already exists: ${fullPath}`);
      console.log('   Skipping download (idempotent behavior)\n');
      return;
    }

    // Download CSV
    await downloadCSV(fullPath);

    // Verify file size
    const stats = fs.statSync(fullPath);
    console.log(`File size: ${stats.size} bytes (${(stats.size / 1024 / 1024).toFixed(2)} MB)\n`);

    if (stats.size < 1000) {
      throw new Error('Downloaded file is suspiciously small (<1KB). May be an error page.');
    }

    // Trigger ingestion
    await triggerIngestion(fullPath);

    console.log('============================================================');
    console.log('  ✅ Fetch and ingestion complete!');
    console.log('============================================================\n');

  } catch (error) {
    console.error('\n❌ Error during CSV fetch:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    releaseLock();
  }
}

// Handle graceful shutdown
process.on('SIGINT', () => {
  console.log('\n\nReceived SIGINT, shutting down gracefully...');
  releaseLock();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\n\nReceived SIGTERM, shutting down gracefully...');
  releaseLock();
  process.exit(0);
});

// Run the script
main();
