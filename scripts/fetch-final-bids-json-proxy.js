#!/usr/bin/env node

/**
 * PoC 2 (Enhanced): Hidden JSON API Scraper with Proxy Support
 *
 * Purpose:
 *   Production-ready version with residential proxy rotation
 *   to avoid IP blocking by Cloudflare/Imperva
 *
 * Proxy Setup:
 *   Set environment variable: PROXY_LIST=http://user:pass@host1:port,http://user:pass@host2:port,...
 *   Or use: PROXY_URL=http://user:pass@rotating-proxy.example.com:port (single rotating proxy)
 *
 * Example Proxy Providers:
 *   - Bright Data (luminati.io): $500/mo for 20GB residential
 *   - SmartProxy: $75/mo for 5GB residential
 *   - Oxylabs: $300/mo for 10GB residential
 *
 * Usage:
 *   PROXY_URL=http://user:pass@proxy.com:8080 node scripts/fetch-final-bids-json-proxy.js --limit 100
 *   PROXY_LIST=http://p1:8080,http://p2:8080 node scripts/fetch-final-bids-json-proxy.js --auto
 *
 * Sprint: P0 — Copart Final Bid Implementation (PoC 2 Enhanced)
 * Date: 2025-10-18
 */

import pg from 'pg'
import { parseArgs } from 'node:util'
import { HttpsProxyAgent } from 'https-proxy-agent'
import https from 'https'

const { Pool } = pg

// ============================================================================
// Configuration
// ============================================================================

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 5,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000
})

const DEBUG = process.env.DEBUG === '1'

// Proxy configuration
const PROXY_URL = process.env.PROXY_URL
const PROXY_LIST = process.env.PROXY_LIST ? process.env.PROXY_LIST.split(',') : []
const USE_PROXY = PROXY_URL || PROXY_LIST.length > 0

let proxyIndex = 0

function getNextProxy() {
  if (PROXY_URL) return PROXY_URL

  if (PROXY_LIST.length > 0) {
    const proxy = PROXY_LIST[proxyIndex]
    proxyIndex = (proxyIndex + 1) % PROXY_LIST.length
    return proxy
  }

  return null
}

// User-Agent pool
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.1 Safari/605.1.15'
]

// ============================================================================
// CLI Argument Parsing
// ============================================================================

const { values: args } = parseArgs({
  options: {
    limit: { type: 'string', default: '100' },
    'rate-limit': { type: 'string', default: '3' },
    'lot-id': { type: 'string' },
    auto: { type: 'boolean', default: false },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false }
  }
})

if (args.help) {
  console.log(`
Usage: node scripts/fetch-final-bids-json-proxy.js [options]

Options:
  --limit <n>            Max lots to process (default: 100)
  --rate-limit <sec>     Seconds between requests (default: 3)
  --lot-id <id>          Process single lot only (testing)
  --auto                 Auto-detect lots needing final bids
  --dry-run              Preview requests without updating database
  -h, --help             Show this help message

Environment Variables:
  PROXY_URL              Single rotating proxy URL (e.g., http://user:pass@proxy.com:8080)
  PROXY_LIST             Comma-separated proxy URLs for rotation
  DATABASE_URL           PostgreSQL connection string

Examples:
  # With single rotating proxy
  PROXY_URL=http://user:pass@proxy.com:8080 node scripts/fetch-final-bids-json-proxy.js --auto --limit 100

  # With proxy pool
  PROXY_LIST=http://p1:8080,http://p2:8080,http://p3:8080 node scripts/fetch-final-bids-json-proxy.js --auto

  # Test single lot (dry run, no proxy)
  node scripts/fetch-final-bids-json-proxy.js --lot-id 12345678 --dry-run
`)
  process.exit(0)
}

const LIMIT = parseInt(args.limit)
const RATE_LIMIT_SEC = parseFloat(args['rate-limit'])
const SINGLE_LOT_ID = args['lot-id']
const AUTO = args.auto
const DRY_RUN = args['dry-run']

// ============================================================================
// Helper Functions
// ============================================================================

function getRandomUA() {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)]
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function fetchLotDetails(lotExternalId, retries = 3) {
  const url = `https://www.copart.com/public/data/lotdetails/solr/${lotExternalId}`

  const headers = {
    'User-Agent': getRandomUA(),
    'Accept': 'application/json, text/plain, */*',
    'Accept-Language': 'en-US,en;q=0.9',
    'Accept-Encoding': 'gzip, deflate, br',
    'Referer': `https://www.copart.com/lot/${lotExternalId}`,
    'Origin': 'https://www.copart.com',
    'DNT': '1',
    'Connection': 'keep-alive',
    'Sec-Fetch-Dest': 'empty',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'same-origin'
  }

  // Setup proxy if configured
  let agent = null
  if (USE_PROXY) {
    const proxyUrl = getNextProxy()
    if (proxyUrl) {
      agent = new HttpsProxyAgent(proxyUrl)
      if (DEBUG) console.log(`    Using proxy: ${proxyUrl.replace(/\/\/.*@/, '//*****@')}`)
    }
  }

  const options = {
    headers,
    agent
  }

  return new Promise((resolve, reject) => {
    https.get(url, options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        if (res.statusCode === 200) {
          try {
            const json = JSON.parse(data)
            resolve({ success: true, data: json, statusCode: 200 })
          } catch (err) {
            resolve({ success: false, error: 'Invalid JSON', statusCode: 200, body: data })
          }
        } else if (res.statusCode === 429 && retries > 0) {
          const backoffMs = (4 - retries) * 5000
          if (DEBUG) console.log(`    [RETRY] Rate limited, backing off ${backoffMs}ms...`)
          setTimeout(() => {
            fetchLotDetails(lotExternalId, retries - 1).then(resolve).catch(reject)
          }, backoffMs)
        } else if (res.statusCode === 403 && retries > 0) {
          const backoffMs = (4 - retries) * 30000
          if (DEBUG) console.log(`    [RETRY] Blocked (403), backing off ${backoffMs}ms...`)
          setTimeout(() => {
            fetchLotDetails(lotExternalId, retries - 1).then(resolve).catch(reject)
          }, backoffMs)
        } else {
          resolve({ success: false, error: `HTTP ${res.statusCode}`, statusCode: res.statusCode, body: data })
        }
      })
    }).on('error', (err) => {
      reject(err)
    })
  })
}

async function getLotsNeedingFinalBid(limit) {
  const query = `
    SELECT
      l.id,
      l.lot_external_id,
      l.vin,
      l.auction_datetime_utc,
      l.current_bid_usd,
      l.outcome
    FROM lots l
    WHERE l.auction_datetime_utc IS NOT NULL
      AND l.auction_datetime_utc < NOW() - INTERVAL '2 hours'
      AND l.final_bid_usd IS NULL
      AND NOT l.is_removed
      ${SINGLE_LOT_ID ? `AND l.lot_external_id = '${SINGLE_LOT_ID}'` : ''}
    ORDER BY l.auction_datetime_utc DESC
    LIMIT $1
  `

  const result = await pool.query(query, [limit])
  return result.rows
}

async function updateFinalBid(lotId, finalBidUsd, statusFromApi, apiData, client = null) {
  const query = `
    UPDATE lots
    SET
      final_bid_usd = $1,
      detection_method = 'json_api_proxy',
      detection_notes = $2,
      updated_at = NOW()
    WHERE id = $3
    RETURNING lot_external_id, final_bid_usd
  `

  const notes = JSON.stringify({
    api_status: statusFromApi,
    fetched_at: new Date().toISOString(),
    api_source: 'copart_solr_json',
    used_proxy: USE_PROXY
  })

  const db = client || pool
  const result = await db.query(query, [finalBidUsd, notes, lotId])
  return result.rows[0]
}

async function processLots(lots, dryRun = false) {
  console.log(`\nProcessing ${lots.length} lots...`)
  console.log(`Rate limit: ${RATE_LIMIT_SEC}s between requests`)
  console.log(`Proxy: ${USE_PROXY ? 'ENABLED' : 'DISABLED'}`)
  console.log(`Mode: ${dryRun ? 'DRY RUN (no updates)' : 'LIVE (will update database)'}\n`)

  const stats = {
    total: lots.length,
    success: 0,
    failed: 0,
    ratelimited: 0,
    blocked: 0,
    nodata: 0,
    updated: 0
  }

  for (let i = 0; i < lots.length; i++) {
    const lot = lots[i]

    console.log(`[${i + 1}/${lots.length}] Processing lot ${lot.lot_external_id}...`)

    try {
      const result = await fetchLotDetails(lot.lot_external_id)

      if (result.success) {
        const lotDetails = result.data?.lotDetails

        if (!lotDetails) {
          console.log(`  ❌ No lotDetails in response`)
          stats.nodata++
          continue
        }

        const finalBid = parseFloat(lotDetails.la) || null
        const status = lotDetails.cs || 'UNKNOWN'

        console.log(`  ✓ Final Bid: $${finalBid || 'N/A'}, Status: ${status}`)
        stats.success++

        if (!dryRun && finalBid !== null) {
          await updateFinalBid(lot.id, finalBid, status, lotDetails)
          stats.updated++
          console.log(`  ✓ Database updated`)
        } else if (dryRun && finalBid !== null) {
          console.log(`  🔍 DRY RUN: Would update final_bid_usd = $${finalBid}`)
        }
      } else {
        console.log(`  ❌ ${result.error}`)

        if (result.statusCode === 429) {
          stats.ratelimited++
        } else if (result.statusCode === 403) {
          stats.blocked++
        } else {
          stats.failed++
        }
      }

      if (i < lots.length - 1) {
        const sleepMs = RATE_LIMIT_SEC * 1000
        await sleep(sleepMs)
      }

    } catch (err) {
      console.log(`  ❌ Error: ${err.message}`)
      stats.failed++
    }
  }

  return stats
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  console.log('\n========================================')
  console.log('PoC 2 (Enhanced): JSON API Scraper with Proxy')
  console.log('========================================')
  console.log(`Endpoint: https://www.copart.com/public/data/lotdetails/solr/{lotId}`)
  console.log(`Limit: ${LIMIT} lots`)
  console.log(`Rate limit: ${RATE_LIMIT_SEC}s between requests`)
  console.log(`Proxy: ${USE_PROXY ? 'ENABLED' : 'DISABLED'}`)
  if (USE_PROXY) {
    console.log(`  Proxy mode: ${PROXY_URL ? 'Single rotating' : `Pool of ${PROXY_LIST.length}`}`)
  }
  console.log('')

  const startTime = Date.now()

  console.log('[1/2] Querying lots needing final bid data...')
  const lots = await getLotsNeedingFinalBid(LIMIT)

  if (lots.length === 0) {
    console.log('✓ No lots need processing')
    await pool.end()
    return
  }

  console.log(`Found ${lots.length} lots needing final bids`)

  console.log(`\n[2/2] Processing ${lots.length} lots...`)
  const stats = await processLots(lots, DRY_RUN)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

  console.log('\n========================================')
  console.log('Summary')
  console.log('========================================')
  console.log(`Total:          ${stats.total}`)
  console.log(`Success:        ${stats.success} (${((stats.success / stats.total) * 100).toFixed(1)}%)`)
  console.log(`Failed:         ${stats.failed}`)
  console.log(`Rate Limited:   ${stats.ratelimited}`)
  console.log(`Blocked (403):  ${stats.blocked}`)
  console.log(`No Data:        ${stats.nodata}`)
  console.log(`DB Updated:     ${stats.updated}`)
  console.log(`Time Elapsed:   ${elapsed}s`)
  console.log(`Avg Time/Lot:   ${(parseFloat(elapsed) / stats.total).toFixed(2)}s`)
  console.log('========================================\n')

  if (stats.blocked > stats.total * 0.1) {
    console.log('⚠️  WARNING: High block rate (>10%)')
    if (!USE_PROXY) {
      console.log('   Recommendation: Enable proxy support with PROXY_URL or PROXY_LIST')
    } else {
      console.log('   Recommendation: Try different proxy provider or increase rate limit')
    }
    console.log('')
  }

  if (stats.ratelimited > stats.total * 0.2) {
    console.log('⚠️  WARNING: High rate-limit rate (>20%) - increase --rate-limit')
    console.log('')
  }

  await pool.end()
}

main().catch((err) => {
  console.error('❌ Fatal error:', err)
  pool.end()
  process.exit(1)
})
