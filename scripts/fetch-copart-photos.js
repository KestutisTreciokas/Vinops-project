#!/usr/bin/env node
/**
 * Copart Photo Scraper
 *
 * Fetches photos from Copart lot pages and saves them to R2 storage.
 *
 * Features:
 * - Rate limiting (10 req/s to avoid blocking)
 * - Multiple URL pattern attempts
 * - R2 archival storage
 * - Database metadata tracking
 * - Graceful error handling
 *
 * Usage:
 *   node scripts/fetch-copart-photos.js --lot-id 12345678
 *   node scripts/fetch-copart-photos.js --batch 100
 *   node scripts/fetch-copart-photos.js --vin 1FMCU93184KA46160
 *
 * Environment:
 *   DATABASE_URL - PostgreSQL connection string
 *   R2_ENDPOINT - Cloudflare R2 endpoint
 *   R2_ACCESS_KEY_ID - R2 access key
 *   R2_SECRET_ACCESS_KEY - R2 secret key
 *   R2_BUCKET_NAME - R2 bucket name
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import pg from 'pg'
import pLimit from 'p-limit'
import { parseArgs } from 'node:util'

const { Pool } = pg

// ============================================================
// Configuration
// ============================================================

const CONFIG = {
  // Rate limiting
  CONCURRENCY: 5, // Process 5 lots in parallel
  REQUESTS_PER_SECOND: 10, // Max 10 image downloads per second

  // Retry configuration
  MAX_RETRIES: 3,
  RETRY_DELAY_MS: 2000,

  // Image variants to fetch
  VARIANTS: ['xl'], // Start with xl only (can add 'lg', 'md', 'thumb' later)

  // Copart CDN URL patterns
  CDN_PATTERNS: [
    // Pattern 1: cs.copart.com with auth
    (lotId, seq, size) => `https://cs.copart.com/v1/AUTH_svc.pdoc00001/${lotId}/${size}/${seq}.jpg`,

    // Pattern 2: vis.copart.com direct
    (lotId, seq, size) => `https://vis.copart.com/images/lot/${lotId}/${seq}_${size}.jpg`,

    // Pattern 3: legacy format
    (lotId, seq) => `https://cs.copart.com/images/${lotId}/${seq}.jpg`,

    // Pattern 4: another observed format
    (lotId, seq) => `https://lotsearch.copart.com/image/${lotId}/${seq}`,
  ],

  SIZE_MAP: {
    'xl': 'full',
    'lg': '800',
    'md': '400',
    'thumb': '200',
  },
}

// ============================================================
// Initialize Clients
// ============================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,
  idleTimeoutMillis: 30000,
})

const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
})

const R2_BUCKET = process.env.R2_BUCKET_NAME || 'vinops-prod'

// Rate limiters
const lotLimiter = pLimit(CONFIG.CONCURRENCY)
const imageLimiter = pLimit(CONFIG.REQUESTS_PER_SECOND)

// ============================================================
// Helper Functions
// ============================================================

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * Fetch image from Copart CDN with multiple pattern attempts
 */
async function fetchImageFromCopart(lotExternalId, seq, variant) {
  const size = CONFIG.SIZE_MAP[variant] || 'full'

  for (const patternFn of CONFIG.CDN_PATTERNS) {
    const url = patternFn(lotExternalId, seq, size)

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.copart.com/',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(10000), // 10 second timeout
      })

      if (response.ok && response.status === 200) {
        const contentType = response.headers.get('content-type') || ''

        // Verify it's actually an image
        if (contentType.startsWith('image/')) {
          const arrayBuffer = await response.arrayBuffer()
          const buffer = Buffer.from(arrayBuffer)

          return {
            buffer,
            contentType,
            sourceUrl: url,
            width: null, // Could extract from image later if needed
            height: null,
            bytes: buffer.length,
          }
        }
      }
    } catch (err) {
      // Try next pattern
      if (err.name !== 'AbortError') {
        console.error(`  [WARN] Pattern failed (${url}):`, err.message)
      }
    }
  }

  return null
}

/**
 * Check if image already exists in R2
 */
async function imageExistsInR2(storageKey) {
  try {
    await r2Client.send(new HeadObjectCommand({
      Bucket: R2_BUCKET,
      Key: storageKey,
    }))
    return true
  } catch (err) {
    if (err.name === 'NotFound') {
      return false
    }
    throw err
  }
}

/**
 * Upload image to R2 storage
 */
async function uploadToR2(storageKey, buffer, contentType, metadata) {
  await r2Client.send(new PutObjectCommand({
    Bucket: R2_BUCKET,
    Key: storageKey,
    Body: buffer,
    ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
    Metadata: {
      ...metadata,
      archived_at: new Date().toISOString(),
    },
  }))
}

/**
 * Save image metadata to database
 */
async function saveImageMetadata(client, { vin, lotId, seq, variant, storageKey, sourceUrl, width, height, bytes }) {
  await client.query(`
    INSERT INTO images (vin, lot_id, seq, variant, storage_key, source_url, width, height, bytes, content_hash)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL)
    ON CONFLICT (vin, lot_id, seq, COALESCE(variant, ''))
    DO UPDATE SET
      storage_key = EXCLUDED.storage_key,
      source_url = EXCLUDED.source_url,
      width = EXCLUDED.width,
      height = EXCLUDED.height,
      bytes = EXCLUDED.bytes,
      updated_at = NOW()
  `, [vin, lotId, seq, variant, storageKey, sourceUrl, width, height, bytes])
}

/**
 * Fetch and archive photos for a single lot
 */
async function processLot(lot) {
  const { id: lotId, vin, lot_external_id: lotExternalId } = lot

  if (!lotExternalId) {
    console.log(`[SKIP] Lot ${lotId} has no external ID`)
    return { success: false, reason: 'no_external_id' }
  }

  console.log(`[START] Processing lot ${lotId} (VIN: ${vin}, Copart: ${lotExternalId})`)

  let foundCount = 0
  let skippedCount = 0
  let uploadedCount = 0

  // Try to fetch up to 20 images (typical max for Copart)
  for (let seq = 1; seq <= 20; seq++) {
    for (const variant of CONFIG.VARIANTS) {
      const storageKey = `copart/${vin}/${lotId}/${variant}/${seq}.webp`

      // Check if already in R2
      if (await imageExistsInR2(storageKey)) {
        console.log(`  [SKIP] Image ${seq} already exists in R2`)
        skippedCount++
        continue
      }

      // Fetch from Copart with rate limiting
      const imageData = await imageLimiter(async () => {
        return await fetchImageFromCopart(lotExternalId, seq, variant)
      })

      if (!imageData) {
        // No more images for this lot
        if (seq === 1) {
          console.log(`  [WARN] No images found for lot ${lotId}`)
        }
        break
      }

      foundCount++

      // Upload to R2
      await uploadToR2(storageKey, imageData.buffer, imageData.contentType, {
        vin,
        lot_id: String(lotId),
        seq: String(seq),
        variant,
        source_url: imageData.sourceUrl,
      })

      uploadedCount++

      // Save metadata to database
      const client = await pool.connect()
      try {
        await saveImageMetadata(client, {
          vin,
          lotId,
          seq,
          variant,
          storageKey,
          sourceUrl: imageData.sourceUrl,
          width: imageData.width,
          height: imageData.height,
          bytes: imageData.bytes,
        })
      } finally {
        client.release()
      }

      console.log(`  [OK] Uploaded image ${seq}/${variant} (${(imageData.bytes / 1024).toFixed(1)} KB)`)
    }

    // If we didn't find this sequence number, stop looking
    if (foundCount === 0 || (foundCount > 0 && foundCount < seq)) {
      break
    }
  }

  console.log(`[DONE] Lot ${lotId}: ${uploadedCount} uploaded, ${skippedCount} skipped, ${foundCount} total`)

  return {
    success: foundCount > 0,
    foundCount,
    uploadedCount,
    skippedCount,
  }
}

/**
 * Fetch lots to process from database
 */
async function fetchLotsToProcess(options) {
  const { lotId, vin, batch, status } = options

  let query = `
    SELECT id, vin, lot_external_id, status
    FROM lots
    WHERE 1=1
  `
  const params = []
  let paramIndex = 1

  if (lotId) {
    query += ` AND id = $${paramIndex++}`
    params.push(lotId)
  }

  if (vin) {
    query += ` AND vin = $${paramIndex++}`
    params.push(vin)
  }

  if (status) {
    query += ` AND status = $${paramIndex++}`
    params.push(status)
  }

  // Exclude lots that already have images
  query += `
    AND id NOT IN (
      SELECT DISTINCT lot_id
      FROM images
      WHERE lot_id IS NOT NULL
    )
  `

  // Order by most recent first
  query += ` ORDER BY created_at DESC`

  if (batch) {
    query += ` LIMIT $${paramIndex++}`
    params.push(batch)
  }

  const result = await pool.query(query, params)
  return result.rows
}

/**
 * Main execution
 */
async function main() {
  console.log('='.repeat(60))
  console.log('Copart Photo Scraper')
  console.log('='.repeat(60))

  // Parse command-line arguments
  const { values } = parseArgs({
    options: {
      'lot-id': { type: 'string' },
      'vin': { type: 'string' },
      'batch': { type: 'string' },
      'status': { type: 'string', default: 'active' },
    },
  })

  const options = {
    lotId: values['lot-id'] ? parseInt(values['lot-id']) : null,
    vin: values['vin'] || null,
    batch: values['batch'] ? parseInt(values['batch']) : null,
    status: values['status'],
  }

  console.log('Options:', options)
  console.log()

  // Fetch lots to process
  const lots = await fetchLotsToProcess(options)
  console.log(`Found ${lots.length} lots to process\n`)

  if (lots.length === 0) {
    console.log('No lots to process. Exiting.')
    await pool.end()
    return
  }

  // Process lots with concurrency limit
  const startTime = Date.now()
  let successCount = 0
  let failCount = 0
  let totalUploaded = 0

  const results = await Promise.all(
    lots.map(lot =>
      lotLimiter(async () => {
        try {
          const result = await processLot(lot)
          if (result.success) {
            successCount++
            totalUploaded += result.uploadedCount
          } else {
            failCount++
          }
          return result
        } catch (err) {
          console.error(`[ERROR] Failed to process lot ${lot.id}:`, err.message)
          failCount++
          return { success: false, error: err.message }
        }
      })
    )
  )

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log()
  console.log('='.repeat(60))
  console.log('Summary')
  console.log('='.repeat(60))
  console.log(`Total lots processed: ${lots.length}`)
  console.log(`Successful: ${successCount}`)
  console.log(`Failed: ${failCount}`)
  console.log(`Total images uploaded: ${totalUploaded}`)
  console.log(`Duration: ${duration}s`)
  console.log(`Rate: ${(lots.length / duration).toFixed(1)} lots/sec`)
  console.log('='.repeat(60))

  await pool.end()
}

// Run main and handle errors
main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
