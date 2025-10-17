#!/usr/bin/env node
/**
 * CSV-Based Image Ingestion (Unauthenticated)
 *
 * Replaces legacy Puppeteer-based photo scraper with fast, unauthenticated image fetching
 * from Copart CSV Image URLs. Runs every 15 minutes as part of ETL pipeline.
 *
 * Key Features:
 * - No authentication required (uses public CDN URLs)
 * - Only downloads images for lots in DB (DB-only guard)
 * - Idempotent writes (SHA256 dedup)
 * - Parallel downloads with rate limiting
 * - Exponential backoff on failures
 * - Immediate processing on new lot inserts
 *
 * Usage:
 *   node scripts/ingest-images-from-staging.js [--limit N] [--batch-size N] [--concurrency N]
 */

import pg from 'pg';
import crypto from 'crypto';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.PGSSL_DISABLE === '1' ? false : { rejectUnauthorized: false },
  max: 20,
});

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

// CLI arguments
const args = {
  limit: parseInt(process.argv.find(a => a.startsWith('--limit='))?.split('=')[1] || '1000'),
  batchSize: parseInt(process.argv.find(a => a.startsWith('--batch-size='))?.split('=')[1] || '50'),
  concurrency: parseInt(process.argv.find(a => a.startsWith('--concurrency='))?.split('=')[1] || '10'),
};

// Rate limiter
class TokenBucket {
  constructor(refillRate, capacity) {
    this.tokens = capacity;
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.lastRefill = Date.now();
  }

  async take(count = 1) {
    while (true) {
      const now = Date.now();
      const elapsed = (now - this.lastRefill) / 1000;
      this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRate);
      this.lastRefill = now;

      if (this.tokens >= count) {
        this.tokens -= count;
        return;
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }
  }
}

const rateLimiter = new TokenBucket(10, 50); // 10 req/sec, burst 50

// Exponential backoff retry
async function retry(fn, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i === maxRetries - 1) throw err;
      const delay = Math.min(1000 * Math.pow(2, i), 8000);
      console.warn(`Retry ${i + 1}/${maxRetries} after ${delay}ms:`, err.message);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

// Fetch image metadata from API (returns all image URLs)
async function fetchImageMetadata(imageUrl) {
  await rateLimiter.take();

  const response = await fetch(imageUrl, {
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error(`API returned ${response.status}: ${imageUrl}`);
  }

  const data = await response.json();
  return data.lotImages || [];
}

// Download single image variant
async function downloadImage(url) {
  await rateLimiter.take();

  const response = await fetch(url, {
    signal: AbortSignal.timeout(30000),
  });

  if (!response.ok) {
    throw new Error(`Image download failed ${response.status}: ${url}`);
  }

  const buffer = await response.arrayBuffer();
  const sha256 = crypto.createHash('sha256').update(Buffer.from(buffer)).digest('hex');

  return {
    buffer: Buffer.from(buffer),
    sha256,
    sizeBytes: buffer.byteLength,
  };
}

// Upload to R2
async function uploadToR2(key, buffer, contentType = 'image/jpeg') {
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  }));

  return key;
}

// Process single lot
async function processLot(client, lot) {
  const { id: lotId, vin, image_url: imageUrl } = lot;

  try {
    // 1. Check if lot exists in public.lots (DB-only guard)
    const lotExists = await client.query(
      'SELECT 1 FROM lots WHERE id = $1',
      [lotId]
    );

    if (lotExists.rows.length === 0) {
      console.log(`Skipping lot ${lotId} (not in DB)`);
      return { skipped: 1, downloaded: 0, failed: 0 };
    }

    // 2. Fetch image metadata from API
    let images;
    try {
      images = await retry(() => fetchImageMetadata(imageUrl));
    } catch (err) {
      // If lot images are unavailable (404), skip gracefully (e.g., old/expired lots)
      if (err.message.includes('404')) {
        console.log(`Lot ${lotId} images unavailable (404) - skipping`);
        return { skipped: 1, downloaded: 0, failed: 0 };
      }
      throw err; // Re-throw other errors
    }

    if (!images || images.length === 0) {
      console.log(`No images found for lot ${lotId}`);
      return { skipped: 1, downloaded: 0, failed: 0 };
    }

    let downloaded = 0;
    let failed = 0;

    // 3. Download images (only _ful and _thb variants for speed)
    for (const img of images) {
      const { sequence, link } = img;

      for (const variant of link) {
        const { url, isThumbNail } = variant;

        // Skip HD variant (_hrs) to save bandwidth
        if (variant.isHdImage) continue;

        // Only download _ful and _thb
        const variantType = isThumbNail ? 'thb' : 'ful';

        try {
          // Check if already exists
          const existing = await client.query(
            'SELECT 1 FROM images WHERE lot_id = $1 AND seq = $2 AND variant = $3',
            [lotId, sequence, variantType]
          );

          if (existing.rows.length > 0) {
            continue; // Already downloaded
          }

          // Download image
          const { buffer, sha256, sizeBytes } = await retry(() => downloadImage(url.trim()));

          // Upload to R2
          const r2Key = `images/${lotId}/${sequence}_${variantType}.jpg`;
          await retry(() => uploadToR2(r2Key, buffer));

          // Insert into DB (idempotent)
          await client.query(`
            INSERT INTO images (lot_id, vin, seq, variant, url, sha256, size_bytes, r2_key)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
            ON CONFLICT (lot_id, seq, variant) DO UPDATE SET
              url = EXCLUDED.url,
              sha256 = EXCLUDED.sha256,
              size_bytes = EXCLUDED.size_bytes,
              r2_key = EXCLUDED.r2_key,
              updated_at = NOW()
          `, [lotId, vin, sequence, variantType, url.trim(), sha256, sizeBytes, r2Key]);

          downloaded++;
        } catch (err) {
          console.error(`Failed to download ${url}:`, err.message);
          failed++;
        }
      }
    }

    return { skipped: 0, downloaded, failed };
  } catch (err) {
    console.error(`Failed to process lot ${lotId}:`, err.message);
    return { skipped: 0, downloaded: 0, failed: 1 };
  }
}

// Main ingestion loop
async function ingestImages() {
  const client = await pool.connect();

  try {
    console.log('=== IMAGE INGESTION START ===');
    console.log(`Limit: ${args.limit} | Batch size: ${args.batchSize} | Concurrency: ${args.concurrency}`);

    // Get lots from staging that need images (DB-only: only lots present in public.lots)
    // Prioritize recent lots (created in last 7 days) to avoid 404s on old API endpoints
    const query = `
      SELECT
        l.id,
        l.vin,
        s.payload_jsonb->>'Image URL' as image_url
      FROM lots l
      INNER JOIN staging.copart_raw s ON s.vin_raw = l.vin
      WHERE s.payload_jsonb->>'Image URL' IS NOT NULL
        AND s.payload_jsonb->>'Image URL' != ''
        AND l.created_at > NOW() - INTERVAL '7 days'
        AND NOT EXISTS (
          SELECT 1 FROM images i WHERE i.lot_id = l.id LIMIT 1
        )
      ORDER BY l.created_at DESC
      LIMIT $1
    `;

    const result = await client.query(query, [args.limit]);
    console.log(`Found ${result.rows.length} lots needing images`);

    if (result.rows.length === 0) {
      console.log('No lots to process');
      return;
    }

    let stats = { skipped: 0, downloaded: 0, failed: 0 };

    // Process in batches with concurrency control
    for (let i = 0; i < result.rows.length; i += args.batchSize) {
      const batch = result.rows.slice(i, i + args.batchSize);
      console.log(`\nProcessing batch ${Math.floor(i / args.batchSize) + 1} (${batch.length} lots)...`);

      // Process lots in parallel (limited concurrency)
      const promises = [];
      for (let j = 0; j < batch.length; j += args.concurrency) {
        const chunk = batch.slice(j, j + args.concurrency);
        const results = await Promise.all(
          chunk.map(lot => processLot(client, lot))
        );

        results.forEach(r => {
          stats.skipped += r.skipped;
          stats.downloaded += r.downloaded;
          stats.failed += r.failed;
        });
      }

      console.log(`Batch complete: +${stats.downloaded} images`);
    }

    console.log('\n=== IMAGE INGESTION COMPLETE ===');
    console.log(`Skipped: ${stats.skipped} | Downloaded: ${stats.downloaded} | Failed: ${stats.failed}`);
  } finally {
    client.release();
    await pool.end();
  }
}

// Run
ingestImages().catch(err => {
  console.error('FATAL:', err);
  process.exit(1);
});
