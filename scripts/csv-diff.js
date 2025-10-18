#!/usr/bin/env node

/**
 * CSV Diff Engine — Detect lot changes between CSV snapshots
 *
 * Purpose:
 *   Compare two consecutive CSV files from raw.csv_files and emit events to audit.auction_events
 *
 * Events Emitted:
 *   - lot.appeared: New lot in current CSV (not in previous)
 *   - lot.disappeared: Lot removed from current CSV (was in previous)
 *   - lot.relist: Same VIN appeared with different lot_external_id
 *   - lot.updated: Lot exists in both but fields changed
 *   - lot.price_change: current_bid_usd changed
 *   - lot.date_change: auction_datetime_utc changed
 *   - lot.status_change: status field changed
 *
 * Usage:
 *   node scripts/csv-diff.js --previous <file_id> --current <file_id>
 *   node scripts/csv-diff.js --auto  # Auto-detect last 2 files
 *   node scripts/csv-diff.js --dry-run --auto  # Preview changes only
 *
 * Sprint: P0 — Copart Final Bid Implementation (PoC 1)
 * Date: 2025-10-18
 */

import pg from 'pg'
import { parseArgs } from 'node:util'

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

// Set session to read-write mode (database has default_transaction_read_only = on)
pool.on('connect', (client) => {
  client.query('SET SESSION CHARACTERISTICS AS TRANSACTION READ WRITE')
    .catch(err => console.error('Failed to set read-write mode:', err))
})

const DEBUG = process.env.DEBUG === '1'

// ============================================================================
// CLI Argument Parsing
// ============================================================================

const { values: args } = parseArgs({
  options: {
    previous: { type: 'string', short: 'p' },
    current: { type: 'string', short: 'c' },
    auto: { type: 'boolean', short: 'a', default: false },
    'dry-run': { type: 'boolean', default: false },
    help: { type: 'boolean', short: 'h', default: false }
  }
})

if (args.help) {
  console.log(`
Usage: node scripts/csv-diff.js [options]

Options:
  -p, --previous <file_id>   UUID of previous CSV file
  -c, --current <file_id>    UUID of current CSV file
  -a, --auto                 Auto-detect last 2 CSV files
  --dry-run                  Preview changes without writing events
  -h, --help                 Show this help message

Examples:
  # Auto-detect last 2 files and emit events
  node scripts/csv-diff.js --auto

  # Dry run (preview only)
  node scripts/csv-diff.js --auto --dry-run

  # Explicit file IDs
  node scripts/csv-diff.js -p abc123... -c def456...
`)
  process.exit(0)
}

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Get last 2 CSV file IDs from raw.csv_files
 */
async function getLastTwoFiles() {
  const result = await pool.query(`
    SELECT file_id, path, ingested_at
    FROM raw.csv_files
    ORDER BY ingested_at DESC
    LIMIT 2
  `)

  if (result.rows.length < 2) {
    throw new Error(`Need at least 2 CSV files ingested. Found: ${result.rows.length}`)
  }

  return {
    current: result.rows[0],
    previous: result.rows[1]
  }
}

/**
 * Load lots from staging.copart_raw for a given file_id
 * Returns Map<lot_external_id, lot_data>
 */
async function loadLotsForFile(fileId) {
  const result = await pool.query(`
    SELECT DISTINCT ON (lot_external_id)
      lot_external_id,
      vin_raw,
      window_start_utc,
      payload_jsonb
    FROM staging.copart_raw
    WHERE file_id = $1
    ORDER BY lot_external_id, window_start_utc DESC
  `, [fileId])

  const lotsMap = new Map()
  for (const row of result.rows) {
    lotsMap.set(row.lot_external_id, {
      lot_external_id: row.lot_external_id,
      vin: row.vin_raw,
      window_start_utc: row.window_start_utc,
      data: row.payload_jsonb
    })
  }

  if (DEBUG) {
    console.log(`[DEBUG] Loaded ${lotsMap.size} lots for file ${fileId}`)
  }

  return lotsMap
}

/**
 * Detect field changes between two lot snapshots
 */
function detectChanges(prevLot, currLot) {
  const changes = []
  const prevData = prevLot.data
  const currData = currLot.data

  // Check current_bid change
  const prevBid = parseFloat(prevData['Current Bid'])
  const currBid = parseFloat(currData['Current Bid'])
  if (!isNaN(prevBid) && !isNaN(currBid) && prevBid !== currBid) {
    changes.push({
      type: 'lot.price_change',
      field: 'current_bid_usd',
      before: prevBid,
      after: currBid
    })
  }

  // Check auction date change
  if (prevData['Sale Date'] !== currData['Sale Date']) {
    changes.push({
      type: 'lot.date_change',
      field: 'auction_datetime_utc',
      before: prevData['Sale Date'],
      after: currData['Sale Date']
    })
  }

  // Check status change
  if (prevData['Sale Status'] !== currData['Sale Status']) {
    changes.push({
      type: 'lot.status_change',
      field: 'status',
      before: prevData['Sale Status'],
      after: currData['Sale Status']
    })
  }

  // Generic updated event if any field changed
  if (changes.length > 0) {
    changes.push({
      type: 'lot.updated',
      changes: changes.length
    })
  }

  return changes
}

/**
 * Emit event to audit.auction_events
 */
async function emitEvent(eventType, lotExternalId, vin, eventData, csvFileId, prevCsvFileId = null, client = null) {
  // Store csv_file_id info in event_data
  const enrichedEventData = {
    ...eventData,
    csv_file_id: csvFileId,
    previous_csv_file_id: prevCsvFileId
  }

  const query = `
    INSERT INTO audit.auction_events (
      event_type,
      lot_external_id,
      vin,
      event_data
    ) VALUES ($1, $2, $3, $4)
    RETURNING id
  `

  const values = [
    eventType,
    lotExternalId,
    vin || null,
    JSON.stringify(enrichedEventData)
  ]

  const db = client || pool
  const result = await db.query(query, values)
  return result.rows[0].id
}

/**
 * Detect relist events (same VIN, different lot_external_id)
 */
async function detectRelists(previousLots, currentLots) {
  const relists = []

  // Build VIN -> lot_external_id map for current CSV
  const currentVinMap = new Map()
  for (const [lotId, lot] of currentLots.entries()) {
    if (lot.vin) {
      if (!currentVinMap.has(lot.vin)) {
        currentVinMap.set(lot.vin, [])
      }
      currentVinMap.get(lot.vin).push(lotId)
    }
  }

  // Check if any VIN from previous CSV appears with new lot_external_id
  for (const [lotId, lot] of previousLots.entries()) {
    if (!lot.vin) continue

    const currentLotIds = currentVinMap.get(lot.vin)
    if (currentLotIds && !currentLotIds.includes(lotId)) {
      // Same VIN, different lot_external_id = relist
      relists.push({
        vin: lot.vin,
        previous_lot_external_id: lotId,
        current_lot_external_ids: currentLotIds,
        previous_lot: lot,
        current_lots: currentLotIds.map(id => currentLots.get(id))
      })
    }
  }

  return relists
}

// ============================================================================
// Main Diff Engine
// ============================================================================

async function runDiff(previousFileId, currentFileId, dryRun = false) {
  console.log('\n========================================')
  console.log('CSV Diff Engine — Starting')
  console.log('========================================\n')
  console.log(`Previous CSV: ${previousFileId}`)
  console.log(`Current CSV:  ${currentFileId}`)
  console.log(`Mode:         ${dryRun ? 'DRY RUN (no events written)' : 'LIVE (events will be written)'}`)
  console.log('')

  const startTime = Date.now()
  let eventCount = 0

  // Load lots from both files
  console.log('[1/5] Loading previous CSV lots...')
  const previousLots = await loadLotsForFile(previousFileId)

  console.log('[2/5] Loading current CSV lots...')
  const currentLots = await loadLotsForFile(currentFileId)

  console.log(`\nLoaded: ${previousLots.size} previous, ${currentLots.size} current`)

  // Detect appeared lots (in current, not in previous)
  console.log('\n[3/5] Detecting appeared lots...')
  const appeared = []
  for (const [lotId, lot] of currentLots.entries()) {
    if (!previousLots.has(lotId)) {
      appeared.push(lot)
    }
  }
  console.log(`  Found ${appeared.length} new lots`)

  // Detect disappeared lots (in previous, not in current)
  console.log('[4/5] Detecting disappeared lots...')
  const disappeared = []
  for (const [lotId, lot] of previousLots.entries()) {
    if (!currentLots.has(lotId)) {
      disappeared.push(lot)
    }
  }
  console.log(`  Found ${disappeared.length} disappeared lots`)

  // Detect updated lots (in both, but changed)
  console.log('[5/5] Detecting updated lots...')
  const updated = []
  for (const [lotId, currLot] of currentLots.entries()) {
    if (previousLots.has(lotId)) {
      const prevLot = previousLots.get(lotId)
      const changes = detectChanges(prevLot, currLot)
      if (changes.length > 0) {
        updated.push({ lotId, changes, currLot, prevLot })
      }
    }
  }
  console.log(`  Found ${updated.length} updated lots`)

  // Detect relists
  console.log('[BONUS] Detecting relists (same VIN, new lot_external_id)...')
  const relists = await detectRelists(previousLots, currentLots)
  console.log(`  Found ${relists.length} relist candidates`)

  // Emit events (unless dry run)
  if (!dryRun) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      // Emit lot.appeared events
      console.log('\nEmitting lot.appeared events...')
      for (const lot of appeared) {
        await emitEvent(
          'lot.appeared',
          lot.lot_external_id,
          lot.vin,
          { lot_data: lot.data },
          currentFileId,
          previousFileId,
          client
        )
        eventCount++
      }

      // Emit lot.disappeared events
      console.log('Emitting lot.disappeared events...')
      for (const lot of disappeared) {
        await emitEvent(
          'lot.disappeared',
          lot.lot_external_id,
          lot.vin,
          { lot_data: lot.data },
          currentFileId,
          previousFileId,
          client
        )
        eventCount++
      }

      // Emit lot.relist events
      console.log('Emitting lot.relist events...')
      for (const relist of relists) {
        await emitEvent(
          'lot.relist',
          relist.current_lot_external_ids[0], // Use first new lot_external_id
          relist.vin,
          {
            previous_lot_external_id: relist.previous_lot_external_id,
            current_lot_external_ids: relist.current_lot_external_ids,
            relist_count: relist.current_lot_external_ids.length
          },
          currentFileId,
          previousFileId,
          client
        )
        eventCount++
      }

      // Emit lot.updated events
      console.log('Emitting lot.updated/price_change/date_change/status_change events...')
      for (const update of updated) {
        for (const change of update.changes) {
          await emitEvent(
            change.type,
            update.lotId,
            update.currLot.vin,
            {
              field: change.field,
              before: change.before,
              after: change.after,
              all_changes: update.changes.length
            },
            currentFileId,
            previousFileId,
            client
          )
          eventCount++
        }
      }

      await client.query('COMMIT')
      console.log(`\n✅ Committed ${eventCount} events to audit.auction_events`)
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('❌ Error emitting events, rolled back:', err.message)
      throw err
    } finally {
      client.release()
    }
  } else {
    console.log('\n🔍 DRY RUN: Would emit the following events:')
    console.log(`  - lot.appeared: ${appeared.length}`)
    console.log(`  - lot.disappeared: ${disappeared.length}`)
    console.log(`  - lot.relist: ${relists.length}`)
    console.log(`  - lot.updated: ${updated.length}`)
    console.log(`  - Total: ${appeared.length + disappeared.length + relists.length + updated.length}`)
  }

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)
  console.log(`\n⏱️  Completed in ${elapsed}s`)

  return {
    appeared: appeared.length,
    disappeared: disappeared.length,
    relists: relists.length,
    updated: updated.length,
    eventCount
  }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  let previousFileId = args.previous
  let currentFileId = args.current

  // Auto-detect if requested
  if (args.auto) {
    console.log('Auto-detecting last 2 CSV files...')
    const files = await getLastTwoFiles()
    previousFileId = files.previous.file_id
    currentFileId = files.current.file_id

    console.log(`Previous: ${files.previous.path} (${files.previous.ingested_at})`)
    console.log(`Current:  ${files.current.path} (${files.current.ingested_at})`)
  }

  // Validate file IDs provided
  if (!previousFileId || !currentFileId) {
    console.error('❌ Error: Must provide --previous and --current, or use --auto')
    process.exit(1)
  }

  // Run diff
  const stats = await runDiff(previousFileId, currentFileId, args['dry-run'])

  console.log('\n========================================')
  console.log('Summary')
  console.log('========================================')
  console.log(`Appeared:     ${stats.appeared}`)
  console.log(`Disappeared:  ${stats.disappeared}`)
  console.log(`Relists:      ${stats.relists}`)
  console.log(`Updated:      ${stats.updated}`)
  console.log(`Total Events: ${stats.eventCount}`)
  console.log('========================================\n')

  await pool.end()
}

main().catch((err) => {
  console.error('❌ Fatal error:', err)
  pool.end()
  process.exit(1)
})
