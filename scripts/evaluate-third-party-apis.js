#!/usr/bin/env node

/**
 * PoC 4: Third-Party API Evaluation
 *
 * Purpose:
 *   Evaluate commercial APIs that provide Copart auction data legally
 *
 * APIs Evaluated:
 *   1. auction-api.app - $199/mo for 10k requests
 *   2. auctionsapi.com - $149/mo for 5k requests
 *   3. datafiniti.co - Variable pricing, enterprise
 *
 * Usage:
 *   node scripts/evaluate-third-party-apis.js --api auction-api --lot-id 12345678
 *   node scripts/evaluate-third-party-apis.js --api auctionsapi --test-batch
 *
 * Sprint: P0 — Copart Final Bid Implementation (PoC 4)
 * Date: 2025-10-18
 */

import https from 'https'
import http from 'http'
import { parseArgs } from 'node:util'

// ============================================================================
// Configuration
// ============================================================================

const DEBUG = process.env.DEBUG === '1'

// API Configurations
const APIS = {
  'auction-api': {
    name: 'Auction-API.app',
    baseUrl: 'https://api.auction-api.app/v1',
    authType: 'apikey',
    authHeader: 'X-API-Key',
    endpoints: {
      lot: '/copart/lot/{lotId}',
      search: '/copart/search',
      batch: '/copart/batch'
    },
    pricing: {
      tier1: { price: 99, requests: 1000 },
      tier2: { price: 199, requests: 10000 },
      tier3: { price: 499, requests: 50000 }
    },
    coverage: ['Copart', 'IAAI', 'Manheim'],
    trial: true,
    trialRequests: 100
  },
  'auctionsapi': {
    name: 'AuctionsAPI.com',
    baseUrl: 'https://api.auctionsapi.com/v2',
    authType: 'bearer',
    authHeader: 'Authorization',
    endpoints: {
      lot: '/lot/{lotId}',
      search: '/search',
      recent: '/recent'
    },
    pricing: {
      tier1: { price: 149, requests: 5000 },
      tier2: { price: 299, requests: 15000 },
      tier3: { price: 599, requests: 50000 }
    },
    coverage: ['Copart', 'IAAI'],
    trial: true,
    trialRequests: 50
  },
  'datafiniti': {
    name: 'Datafiniti',
    baseUrl: 'https://api.datafiniti.co/v4',
    authType: 'bearer',
    authHeader: 'Authorization',
    endpoints: {
      search: '/data/search',
      download: '/data/download'
    },
    pricing: {
      tier1: { price: 500, requests: 'custom' },
      tier2: { price: 1500, requests: 'custom' },
      tier3: { price: 5000, requests: 'custom' }
    },
    coverage: ['Copart', 'IAAI', 'AutoAuction', 'Manheim', 'etc.'],
    trial: false,
    trialRequests: 0,
    enterprise: true
  }
}

// ============================================================================
// CLI Argument Parsing
// ============================================================================

const { values: args } = parseArgs({
  options: {
    api: { type: 'string', short: 'a' },
    'lot-id': { type: 'string' },
    'test-batch': { type: 'boolean', default: false },
    'api-key': { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false }
  }
})

if (args.help) {
  console.log(`
Usage: node scripts/evaluate-third-party-apis.js [options]

Options:
  -a, --api <name>       API to test (auction-api, auctionsapi, datafiniti)
  --lot-id <id>          Test single lot lookup
  --test-batch           Test batch endpoint (if available)
  --api-key <key>        API key for authentication
  -h, --help             Show this help message

Environment Variables:
  AUCTION_API_KEY        API key for auction-api.app
  AUCTIONSAPI_KEY        API key for auctionsapi.com
  DATAFINITI_KEY         API key for datafiniti.co

Examples:
  # Test auction-api.app with single lot
  AUCTION_API_KEY=xxx node scripts/evaluate-third-party-apis.js --api auction-api --lot-id 12345678

  # Test auctionsapi.com batch endpoint
  AUCTIONSAPI_KEY=xxx node scripts/evaluate-third-party-apis.js --api auctionsapi --test-batch

  # List all APIs and pricing
  node scripts/evaluate-third-party-apis.js
`)
  process.exit(0)
}

const API_NAME = args.api
const LOT_ID = args['lot-id']
const TEST_BATCH = args['test-batch']
const API_KEY = args['api-key'] || process.env[`${API_NAME?.toUpperCase().replace(/-/g, '_')}_KEY`]

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Make HTTP request
 */
function makeRequest(url, options) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith('https') ? https : http

    const req = protocol.get(url, options, (res) => {
      let data = ''

      res.on('data', (chunk) => {
        data += chunk
      })

      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve({ success: true, data: json, statusCode: res.statusCode, headers: res.headers })
        } catch (err) {
          resolve({ success: false, error: 'Invalid JSON', statusCode: res.statusCode, body: data })
        }
      })
    })

    req.on('error', (err) => {
      reject(err)
    })

    req.end()
  })
}

/**
 * Test API with single lot
 */
async function testSingleLot(apiConfig, lotId, apiKey) {
  console.log(`\nTesting ${apiConfig.name} - Single Lot Lookup`)
  console.log(`Lot ID: ${lotId}`)
  console.log(`Endpoint: ${apiConfig.endpoints.lot}`)
  console.log('')

  if (!apiKey) {
    console.log('❌ API key not provided. Set via --api-key or environment variable.')
    return null
  }

  const url = `${apiConfig.baseUrl}${apiConfig.endpoints.lot.replace('{lotId}', lotId)}`

  const headers = {}
  if (apiConfig.authType === 'apikey') {
    headers[apiConfig.authHeader] = apiKey
  } else if (apiConfig.authType === 'bearer') {
    headers[apiConfig.authHeader] = `Bearer ${apiKey}`
  }

  console.log(`Requesting: ${url}`)

  try {
    const startTime = Date.now()
    const result = await makeRequest(url, { headers })
    const elapsed = Date.now() - startTime

    if (result.success) {
      console.log(`✓ Success (${elapsed}ms)`)
      console.log(`Status Code: ${result.statusCode}`)
      console.log(`\nResponse:`)
      console.log(JSON.stringify(result.data, null, 2))

      // Extract final bid if available
      const finalBid = extractFinalBid(result.data, API_NAME)
      if (finalBid) {
        console.log(`\n✓ Final Bid Extracted: $${finalBid}`)
      }

      return {
        success: true,
        latency: elapsed,
        finalBid,
        data: result.data
      }
    } else {
      console.log(`❌ Failed: ${result.error}`)
      console.log(`Status Code: ${result.statusCode}`)
      console.log(`Body: ${result.body?.substring(0, 500)}`)
      return { success: false, error: result.error }
    }
  } catch (err) {
    console.log(`❌ Error: ${err.message}`)
    return { success: false, error: err.message }
  }
}

/**
 * Extract final bid from API response (varies by provider)
 */
function extractFinalBid(data, apiName) {
  // Auction-API.app format
  if (apiName === 'auction-api') {
    return data?.lot?.finalBid || data?.finalBid || data?.salePrice || null
  }

  // AuctionsAPI.com format
  if (apiName === 'auctionsapi') {
    return data?.final_bid || data?.sale_price || data?.winning_bid || null
  }

  // Datafiniti format
  if (apiName === 'datafiniti') {
    return data?.records?.[0]?.salePrice || null
  }

  return null
}

/**
 * Test batch endpoint
 */
async function testBatchLookup(apiConfig, apiKey) {
  console.log(`\nTesting ${apiConfig.name} - Batch Lookup`)
  console.log('')

  if (!apiConfig.endpoints.batch && !apiConfig.endpoints.search) {
    console.log('❌ Batch endpoint not available for this API')
    return null
  }

  console.log('ℹ️  Batch endpoint testing requires sample lot IDs.')
  console.log('   This is a placeholder for actual batch testing.')
  console.log('')
  console.log('To implement:')
  console.log('  1. Provide array of lot IDs')
  console.log('  2. Make batch request to API')
  console.log('  3. Measure throughput (lots/sec)')
  console.log('  4. Calculate cost per lot')

  return null
}

/**
 * Print API comparison table
 */
function printComparisonTable() {
  console.log('\n========================================')
  console.log('Third-Party API Comparison')
  console.log('========================================\n')

  console.log('API                    | Tier 1        | Tier 2         | Tier 3         | Trial | Coverage')
  console.log('-----------------------|---------------|----------------|----------------|-------|----------')

  for (const [key, api] of Object.entries(APIS)) {
    const tier1 = `$${api.pricing.tier1.price}/${api.pricing.tier1.requests}`
    const tier2 = `$${api.pricing.tier2.price}/${api.pricing.tier2.requests}`
    const tier3 = `$${api.pricing.tier3.price}/${api.pricing.tier3.requests}`
    const trial = api.trial ? `${api.trialRequests}` : 'No'
    const coverage = api.coverage.join(', ')

    console.log(`${api.name.padEnd(22)} | ${tier1.padEnd(13)} | ${tier2.padEnd(14)} | ${tier3.padEnd(14)} | ${trial.padEnd(5)} | ${coverage}`)
  }

  console.log('')
  console.log('Recommendation:')
  console.log('  - Best Value: auction-api.app ($199/mo for 10k requests = $0.02/lot)')
  console.log('  - Budget Option: auctionsapi.com ($149/mo for 5k requests = $0.03/lot)')
  console.log('  - Enterprise: datafiniti.co (custom pricing, most comprehensive)')
  console.log('')
  console.log('Next Steps:')
  console.log('  1. Sign up for free trial (auction-api or auctionsapi)')
  console.log('  2. Test with 50-100 real lot IDs')
  console.log('  3. Measure accuracy (compare with known sales)')
  console.log('  4. Measure coverage (% of lots found)')
  console.log('  5. Select provider based on results')
  console.log('')
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  console.log('\n========================================')
  console.log('PoC 4: Third-Party API Evaluation')
  console.log('========================================')

  // If no API specified, show comparison table
  if (!API_NAME) {
    printComparisonTable()
    return
  }

  // Validate API name
  const apiConfig = APIS[API_NAME]
  if (!apiConfig) {
    console.log(`\n❌ Unknown API: ${API_NAME}`)
    console.log(`Available: ${Object.keys(APIS).join(', ')}`)
    process.exit(1)
  }

  console.log(`\nAPI: ${apiConfig.name}`)
  console.log(`Base URL: ${apiConfig.baseUrl}`)
  console.log(`Auth: ${apiConfig.authType}`)
  console.log(`Trial: ${apiConfig.trial ? `Yes (${apiConfig.trialRequests} requests)` : 'No'}`)
  console.log('')

  // Test single lot
  if (LOT_ID) {
    const result = await testSingleLot(apiConfig, LOT_ID, API_KEY)
    if (result?.success) {
      console.log('\n✅ Single lot test passed')
    } else {
      console.log('\n❌ Single lot test failed')
    }
  }

  // Test batch
  if (TEST_BATCH) {
    await testBatchLookup(apiConfig, API_KEY)
  }

  console.log('\n========================================')
  console.log('Evaluation Complete')
  console.log('========================================\n')
}

main().catch((err) => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
