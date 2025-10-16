#!/usr/bin/env node
/**
 * Copart Photo Scraper with Authentication
 *
 * Uses Puppeteer to authenticate with Copart and download photos from lot pages.
 *
 * Features:
 * - Puppeteer browser automation with stealth plugin
 * - Copart member authentication
 * - Session reuse across multiple lots
 * - Rate limiting (configurable)
 * - R2 archival storage
 * - Database metadata tracking
 * - Comprehensive error handling
 *
 * Usage:
 *   node scripts/fetch-copart-photos-auth.js --batch 10
 *   node scripts/fetch-copart-photos-auth.js --lot-id 655886
 *   node scripts/fetch-copart-photos-auth.js --vin 1FMCU93184KA46160
 *
 * Environment Variables:
 *   COPART_USERNAME - Copart member email
 *   COPART_PASSWORD - Copart member password
 *   DATABASE_URL - PostgreSQL connection string
 *   R2_ENDPOINT - Cloudflare R2 endpoint
 *   R2_ACCESS_KEY_ID - R2 access key
 *   R2_SECRET_ACCESS_KEY - R2 secret key
 *   R2_BUCKET_NAME - R2 bucket name (default: vinops-prod)
 */

import { S3Client, PutObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3'
import pg from 'pg'
import pLimit from 'p-limit'
import { parseArgs } from 'node:util'
import puppeteer from 'puppeteer-extra'
import StealthPlugin from 'puppeteer-extra-plugin-stealth'

// Use stealth plugin to avoid detection
puppeteer.use(StealthPlugin())

const { Pool } = pg

// ============================================================
// Configuration
// ============================================================

const CONFIG = {
  // Rate limiting - CONSERVATIVE for account safety
  CONCURRENCY: 1, // Process 1 lot at a time (sequential processing)
  REQUESTS_PER_SECOND: 2, // Max 2 image downloads per second (very conservative)
  DELAY_BETWEEN_LOTS: 3000, // 3 second pause between lots (ms)
  DELAY_BETWEEN_IMAGES: 500, // 500ms pause between image downloads

  // Browser configuration
  BROWSER_HEADLESS: true, // Set to false for debugging
  BROWSER_TIMEOUT: 90000, // 90 seconds (increased for slow networks)
  PAGE_WAIT_TIMEOUT: 60000, // 60 seconds (increased for slow page loads)

  // Session management - CONSERVATIVE
  SESSION_MAX_LOTS: 25, // Reuse browser session for max 25 lots (reduced from 50)
  SESSION_ROTATION_DELAY: 5000, // 5 second pause when rotating sessions (ms)
  LOGIN_RETRY_MAX: 3,

  // Image variants to fetch
  VARIANTS: ['xl'], // Start with xl only

  // Copart URLs
  COPART_LOGIN_URL: 'https://www.copart.com/login',
  COPART_LOT_URL_TEMPLATE: 'https://www.copart.com/lot/{lot_id}',
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
// Browser Session Management
// ============================================================

class CopartSession {
  constructor() {
    this.browser = null
    this.page = null
    this.isAuthenticated = false
    this.lotsProcessed = 0
  }

  async init() {
    console.log('[SESSION] Launching browser...')

    this.browser = await puppeteer.launch({
      headless: CONFIG.BROWSER_HEADLESS,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--no-first-run',
        '--no-zygote',
        '--disable-gpu',
      ],
    })

    this.page = await this.browser.newPage()

    // Set realistic viewport
    await this.page.setViewport({ width: 1920, height: 1080 })

    // Set user agent
    await this.page.setUserAgent(
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
    )

    console.log('[SESSION] Browser launched')
  }

  async login() {
    // Support both email and member ID for login
    const username = process.env.COPART_MEMBER_ID || process.env.COPART_USERNAME
    const password = process.env.COPART_PASSWORD

    if (!username || !password) {
      throw new Error('COPART_USERNAME (or COPART_MEMBER_ID) and COPART_PASSWORD environment variables are required')
    }

    console.log('[AUTH] Logging into Copart...')

    try {
      // Navigate to login page with longer timeout
      await this.page.goto(CONFIG.COPART_LOGIN_URL, {
        waitUntil: 'domcontentloaded',
        timeout: CONFIG.PAGE_WAIT_TIMEOUT
      })

      console.log('[AUTH] Login page loaded, waiting for form...')

      // Dismiss cookie consent banner first if present
      try {
        console.log('[AUTH] Checking for cookie consent banner...')
        await sleep(1000)

        const cookieAccepted = await this.page.evaluate(() => {
          const buttons = Array.from(document.querySelectorAll('button'))
          const acceptBtn = buttons.find(b =>
            b.textContent?.includes('Accept All Cookies') ||
            b.textContent?.includes('Accept Cookies') ||
            b.textContent?.includes('Accept all')
          )
          if (acceptBtn && acceptBtn.offsetParent !== null) {
            acceptBtn.click()
            return true
          }
          return false
        })

        if (cookieAccepted) {
          console.log('[AUTH] Cookie consent accepted')
          await sleep(1000)
        }
      } catch (err) {
        console.log('[AUTH] No cookie banner or already dismissed')
      }

      // Wait for login form with longer timeout
      await this.page.waitForSelector('input[name="username"], input[type="email"], #username', { timeout: 20000 })

      console.log('[AUTH] Form found, filling credentials...')

      // Try different selector patterns for username
      const usernameSelector = await this.page.$('input[name="username"]') ? 'input[name="username"]' :
                               await this.page.$('input[type="email"]') ? 'input[type="email"]' :
                               '#username'

      const passwordSelector = await this.page.$('input[name="password"]') ? 'input[name="password"]' :
                               await this.page.$('input[type="password"]') ? 'input[type="password"]' :
                               '#password'

      // Fill in credentials with human-like delays
      console.log(`[AUTH] Using username: ${username}`)

      await this.page.type(usernameSelector, username, { delay: 100 })
      await this.page.type(passwordSelector, password, { delay: 100 })

      console.log('[AUTH] Credentials filled, submitting...')

      // Find and click login button
      const submitButton = await this.page.$('button[type="submit"]') ||
                          await this.page.$('input[type="submit"]') ||
                          await this.page.$('button[data-testid="login-button"]')

      // Before submitting, check if GDPR consent popup is already visible
      console.log('[AUTH] Checking for pre-login consent popup...')
      await sleep(1000)

      const preLoginConsentHandled = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const consentBtn = buttons.find(b =>
          b.textContent?.trim() === 'Consent' &&
          b.offsetParent !== null
        )
        if (consentBtn) {
          consentBtn.click()
          return true
        }
        return false
      })

      if (preLoginConsentHandled) {
        console.log('[AUTH] Pre-login consent popup dismissed')
        await sleep(2000) // Wait for popup to close
      } else {
        console.log('[AUTH] No pre-login consent popup found')
      }

      // Now submit the login form
      console.log('[AUTH] Submitting login form...')

      // Set up navigation promise before clicking
      const navigationPromise = this.page.waitForNavigation({
        waitUntil: 'domcontentloaded',
        timeout: 30000
      })

      if (submitButton) {
        await submitButton.click()
      } else {
        // Fallback: press Enter on password field
        await this.page.keyboard.press('Enter')
      }

      // Wait for navigation to complete
      console.log('[AUTH] Waiting for login to complete...')
      try {
        await navigationPromise
        console.log('[AUTH] Navigation completed')
      } catch (err) {
        console.log('[AUTH] Navigation timeout, checking if login succeeded anyway...')
      }

      // Check if post-login consent popup appeared
      await sleep(1000)
      const postLoginConsentHandled = await this.page.evaluate(() => {
        const buttons = Array.from(document.querySelectorAll('button'))
        const consentBtn = buttons.find(b =>
          b.textContent?.trim() === 'Consent' &&
          b.offsetParent !== null
        )
        if (consentBtn) {
          consentBtn.click()
          return true
        }
        return false
      })

      if (postLoginConsentHandled) {
        console.log('[AUTH] Post-login consent popup dismissed, waiting for redirect...')
        await sleep(3000)
      }

      // Check if login was successful
      const currentUrl = this.page.url()
      console.log(`[AUTH] Redirected to: ${currentUrl}`)

      if (currentUrl.includes('/login') || currentUrl.includes('/error')) {
        // Take screenshot for debugging
        const screenshotPath = `/tmp/login-failed-${Date.now()}.png`
        await this.page.screenshot({ path: screenshotPath, fullPage: true })
        console.log(`[DEBUG] Screenshot saved to ${screenshotPath}`)
        throw new Error('Login failed - still on login page or error page')
      }

      console.log('[AUTH] ✅ Successfully logged in')
      this.isAuthenticated = true

    } catch (err) {
      console.error('[AUTH] ❌ Login failed:', err.message)

      // Take screenshot for debugging
      try {
        const screenshotPath = `/tmp/login-error-${Date.now()}.png`
        await this.page.screenshot({ path: screenshotPath, fullPage: true })
        console.log(`[DEBUG] Error screenshot saved to ${screenshotPath}`)
      } catch (screenshotErr) {
        // Ignore screenshot errors
      }

      throw err
    }
  }

  async fetchLotPhotos(lotExternalId) {
    if (!this.isAuthenticated) {
      await this.login()
    }

    const lotUrl = CONFIG.COPART_LOT_URL_TEMPLATE.replace('{lot_id}', lotExternalId)

    console.log(`[FETCH] Navigating to lot ${lotExternalId}...`)

    try {
      await this.page.goto(lotUrl, {
        waitUntil: 'networkidle2',
        timeout: CONFIG.PAGE_WAIT_TIMEOUT
      })

      // Wait for page to load
      await this.page.waitForSelector('body', { timeout: 10000 })
      await sleep(2000) // Extra wait for images to load

      // Take debug screenshot
      const debugScreenshot = `/tmp/lot-${lotExternalId}-page.png`
      await this.page.screenshot({ path: debugScreenshot, fullPage: true })
      console.log(`[DEBUG] Page screenshot saved to ${debugScreenshot}`)

      // Extract photo URLs from the page
      const photos = await this.page.evaluate(() => {
        const photoData = []

        // Method 1: Look for thumbnail navigation images (the small thumbnails at bottom)
        const thumbnails = document.querySelectorAll('img[src*="copart"]')
        thumbnails.forEach((img, idx) => {
          let src = img.src

          // Skip tiny icons, logos, etc
          if (!src || src.includes('logo') || src.includes('icon') || img.width < 50 || img.height < 50) {
            return
          }

          // Convert thumbnail URLs to full-size
          // Copart typically uses patterns like: .../PIX123_thumb.jpg -> .../PIX123_full.jpg
          if (src.includes('vinmobisol.com') || src.includes('copart.com')) {
            // Try to get highest quality version
            let fullSrc = src
              .replace(/_thumb\.jpg/i, '_full.jpg')
              .replace(/_sm\.jpg/i, '_full.jpg')
              .replace(/_md\.jpg/i, '_full.jpg')
              .replace(/_tn\.jpg/i, '_full.jpg')
              .replace(/\/tn\//i, '/full/')
              .replace(/\/sm\//i, '/full/')
              .replace(/\/thumb\//i, '/full/')

            photoData.push({
              seq: idx + 1,
              url: fullSrc,
            })
          }
        })

        // Method 2: Check for data attributes or API endpoints
        if (photoData.length === 0) {
          // Look for lot data in page scripts or JSON
          const scripts = Array.from(document.querySelectorAll('script'))
          for (const script of scripts) {
            const content = script.textContent || ''
            // Look for image URLs in embedded data
            const imageMatches = content.match(/https?:\/\/[^"'\s]+\.(jpg|jpeg|png|webp)/gi)
            if (imageMatches) {
              imageMatches.forEach((url, idx) => {
                if (url.includes('copart') || url.includes('vinmobisol')) {
                  photoData.push({
                    seq: idx + 1,
                    url: url.replace(/_thumb\.jpg/i, '_full.jpg'),
                  })
                }
              })
              if (photoData.length > 0) break
            }
          }
        }

        // Method 3: Look for "See all XX Photos" link data
        const seeAllLink = document.querySelector('[data-uname="lotsearchLotimage"]')
        if (seeAllLink && photoData.length === 0) {
          const match = seeAllLink.textContent.match(/(\d+)\s+Photos?/i)
          if (match) {
            console.log(`Found indicator of ${match[1]} photos, but couldn't extract URLs`)
          }
        }

        // Remove duplicates and filter invalid
        const seen = new Set()
        return photoData.filter(photo => {
          if (!photo.url || seen.has(photo.url)) return false
          if (photo.url.includes('placeholder') || photo.url.includes('noimage')) return false
          seen.add(photo.url)
          return true
        })
      })

      console.log(`[FETCH] Found ${photos.length} photos for lot ${lotExternalId}`)
      this.lotsProcessed++

      return photos

    } catch (err) {
      console.error(`[FETCH] Failed to fetch lot ${lotExternalId}:`, err.message)

      // Take screenshot for debugging
      if (!CONFIG.BROWSER_HEADLESS) {
        const screenshotPath = `/tmp/lot-${lotExternalId}-error.png`
        await this.page.screenshot({ path: screenshotPath })
        console.log(`[DEBUG] Screenshot saved to ${screenshotPath}`)
      }

      return []
    }
  }

  async downloadImage(url) {
    try {
      const response = await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: 15000
      })

      const buffer = await response.buffer()
      const contentType = response.headers()['content-type'] || 'image/jpeg'

      return {
        buffer,
        contentType,
        bytes: buffer.length,
      }
    } catch (err) {
      console.error(`[DOWNLOAD] Failed to download ${url}:`, err.message)
      return null
    }
  }

  async close() {
    if (this.browser) {
      await this.browser.close()
      console.log('[SESSION] Browser closed')
    }
  }

  shouldRotate() {
    return this.lotsProcessed >= CONFIG.SESSION_MAX_LOTS
  }
}

// ============================================================
// Helper Functions
// ============================================================

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

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

async function saveImageMetadata(client, data) {
  await client.query(`
    INSERT INTO images (vin, lot_id, seq, variant, storage_key, source_url, width, height, bytes, content_hash)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, NULL)
    ON CONFLICT (vin, lot_id, seq, COALESCE(variant, ''))
    DO UPDATE SET
      storage_key = EXCLUDED.storage_key,
      source_url = EXCLUDED.source_url,
      bytes = EXCLUDED.bytes,
      updated_at = NOW()
  `, [data.vin, data.lotId, data.seq, data.variant, data.storageKey, data.sourceUrl, data.width, data.height, data.bytes])
}

// ============================================================
// Main Processing Logic
// ============================================================

async function processLot(session, lot) {
  const { id: lotId, vin, lot_external_id: lotExternalId } = lot

  if (!lotExternalId) {
    console.log(`[SKIP] Lot ${lotId} has no external ID`)
    return { success: false, reason: 'no_external_id' }
  }

  console.log(`[START] Processing lot ${lotId} (VIN: ${vin}, Copart: ${lotExternalId})`)

  let uploadedCount = 0
  let skippedCount = 0

  try {
    // Fetch photos from Copart
    const photos = await session.fetchLotPhotos(lotExternalId)

    if (photos.length === 0) {
      console.log(`[WARN] No photos found for lot ${lotId}`)
      return { success: false, reason: 'no_photos' }
    }

    // Download and upload each photo
    for (const photo of photos) {
      const { seq, url } = photo

      for (const variant of CONFIG.VARIANTS) {
        const storageKey = `copart/${vin}/${lotId}/${variant}/${seq}.webp`

        // Check if already exists
        if (await imageExistsInR2(storageKey)) {
          console.log(`  [SKIP] Image ${seq} already in R2`)
          skippedCount++
          continue
        }

        // Download image with delay
        const imageData = await imageLimiter(async () => {
          return await session.downloadImage(url)
        })

        if (!imageData) {
          console.log(`  [WARN] Failed to download image ${seq}`)
          continue
        }

        // Brief pause between images for safety
        await sleep(CONFIG.DELAY_BETWEEN_IMAGES)

        // Upload to R2
        await uploadToR2(storageKey, imageData.buffer, imageData.contentType, {
          vin,
          lot_id: String(lotId),
          seq: String(seq),
          variant,
          source_url: url,
        })

        // Save to database
        const client = await pool.connect()
        try {
          await saveImageMetadata(client, {
            vin,
            lotId,
            seq,
            variant,
            storageKey,
            sourceUrl: url,
            width: null,
            height: null,
            bytes: imageData.bytes,
          })
        } finally {
          client.release()
        }

        uploadedCount++
        console.log(`  [OK] Uploaded image ${seq} (${(imageData.bytes / 1024).toFixed(1)} KB)`)
      }
    }

    console.log(`[DONE] Lot ${lotId}: ${uploadedCount} uploaded, ${skippedCount} skipped`)

    return {
      success: uploadedCount > 0,
      uploadedCount,
      skippedCount,
      totalFound: photos.length,
    }

  } catch (err) {
    console.error(`[ERROR] Failed to process lot ${lotId}:`, err.message)
    return { success: false, error: err.message }
  }
}

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

  query += ` ORDER BY created_at DESC`

  if (batch) {
    query += ` LIMIT $${paramIndex++}`
    params.push(batch)
  }

  const result = await pool.query(query, params)
  return result.rows
}

// ============================================================
// Main Execution
// ============================================================

async function main() {
  console.log('='.repeat(70))
  console.log('Copart Photo Scraper with Authentication')
  console.log('='.repeat(70))

  // Parse arguments
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

  // Fetch lots
  const lots = await fetchLotsToProcess(options)
  console.log(`Found ${lots.length} lots to process\n`)

  if (lots.length === 0) {
    console.log('No lots to process. Exiting.')
    await pool.end()
    return
  }

  // Initialize session
  const session = new CopartSession()
  await session.init()

  const startTime = Date.now()
  let successCount = 0
  let failCount = 0
  let totalUploaded = 0

  try {
    // Process lots sequentially (to reuse browser session)
    for (const lot of lots) {
      // Rotate session if needed (with longer delay for account safety)
      if (session.shouldRotate()) {
        console.log('[SESSION] Rotating browser session...')
        await session.close()
        await sleep(CONFIG.SESSION_ROTATION_DELAY)
        await session.init()
      }

      const result = await processLot(session, lot)

      if (result.success) {
        successCount++
        totalUploaded += result.uploadedCount || 0
      } else {
        failCount++
      }

      // Conservative pause between lots for account safety
      await sleep(CONFIG.DELAY_BETWEEN_LOTS)
    }
  } finally {
    await session.close()
  }

  // Summary
  const duration = ((Date.now() - startTime) / 1000).toFixed(1)
  console.log()
  console.log('='.repeat(70))
  console.log('Summary')
  console.log('='.repeat(70))
  console.log(`Total lots processed: ${lots.length}`)
  console.log(`Successful: ${successCount}`)
  console.log(`Failed: ${failCount}`)
  console.log(`Total images uploaded: ${totalUploaded}`)
  console.log(`Duration: ${duration}s`)
  console.log(`Rate: ${(lots.length / duration * 60).toFixed(1)} lots/min`)
  console.log('='.repeat(70))

  await pool.end()
}

// Run
main().catch(err => {
  console.error('Fatal error:', err)
  process.exit(1)
})
