#!/usr/bin/env node

/**
 * Outcome Resolver — Apply heuristics to determine lot outcomes
 *
 * Purpose:
 *   Analyze auction_events and apply heuristic rules to determine lot outcomes:
 *   - sold: Lot disappeared after auction date, no relist detected
 *   - not_sold: VIN reappeared with new lot_external_id (relist)
 *   - on_approval: Lot disappeared, reserve present, no relist yet (requires waiting period)
 *   - unknown: Insufficient data
 *
 * Heuristic Rules:
 *   1. Disappearance Rule: lot.disappeared + auction_date < NOW - 24h → sold (confidence: 0.85)
 *   2. Relist Rule: lot.relist detected → previous lot = not_sold (confidence: 0.95)
 *   3. On Approval Rule: disappeared + has_reserve + no relist for 7 days → on_approval (confidence: 0.60)
 *
 * Usage:
 *   node scripts/outcome-resolver.js --grace-hours 24
 *   node scripts/outcome-resolver.js --dry-run
 *   node scripts/outcome-resolver.js --lot-id 12345678
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
    'grace-hours': { type: 'string', default: '24' },
    'on-approval-days': { type: 'string', default: '7' },
    'dry-run': { type: 'boolean', default: false },
    'lot-id': { type: 'string' },
    help: { type: 'boolean', short: 'h', default: false }
  }
})

if (args.help) {
  console.log(`
Usage: node scripts/outcome-resolver.js [options]

Options:
  --grace-hours <hours>        Hours after auction before considering disappeared = sold (default: 24)
  --on-approval-days <days>    Days to wait before marking as on_approval (default: 7)
  --dry-run                    Preview changes without updating database
  --lot-id <external_id>       Process single lot only (for testing)
  -h, --help                   Show this help message

Examples:
  # Process all lots with 24h grace period
  node scripts/outcome-resolver.js

  # Dry run with 48h grace period
  node scripts/outcome-resolver.js --grace-hours 48 --dry-run

  # Process single lot
  node scripts/outcome-resolver.js --lot-id 12345678
`)
  process.exit(0)
}

const GRACE_HOURS = parseFloat(args['grace-hours'])
const ON_APPROVAL_DAYS = parseFloat(args['on-approval-days'])
const DRY_RUN = args['dry-run']
const SINGLE_LOT_ID = args['lot-id']

// ============================================================================
// Helper Functions
// ============================================================================

/**
 * Find lots that disappeared from CSV after auction date
 */
async function findDisappearedLots() {
  const query = `
    SELECT DISTINCT
      ae.lot_external_id,
      ae.vin,
      ae.created_at as disappeared_at,
      ae.event_data,
      l.id as lot_id,
      l.auction_datetime_utc,
      l.current_bid_usd,
      l.buy_it_now_usd,
      l.outcome as current_outcome
    FROM audit.auction_events ae
    INNER JOIN lots l ON ae.lot_external_id = l.lot_external_id
    WHERE ae.event_type = 'lot.disappeared'
      AND l.auction_datetime_utc IS NOT NULL
      AND l.auction_datetime_utc < NOW() - INTERVAL '${GRACE_HOURS} hours'
      AND (l.outcome IS NULL OR l.outcome = 'unknown')
      AND NOT l.is_removed
      ${SINGLE_LOT_ID ? `AND ae.lot_external_id = '${SINGLE_LOT_ID}'` : ''}
    ORDER BY ae.created_at DESC
  `

  const result = await pool.query(query)
  return result.rows
}

/**
 * Find relists (same VIN, different lot_external_id)
 */
async function findRelists() {
  const query = `
    SELECT
      ae.vin,
      ae.event_data->>'previous_lot_external_id' as previous_lot_external_id,
      ae.lot_external_id as current_lot_external_id,
      ae.created_at as relist_detected_at,
      l_prev.id as previous_lot_id,
      l_curr.id as current_lot_id
    FROM audit.auction_events ae
    LEFT JOIN lots l_prev ON ae.event_data->>'previous_lot_external_id' = l_prev.lot_external_id
    LEFT JOIN lots l_curr ON ae.lot_external_id = l_curr.lot_external_id
    WHERE ae.event_type = 'lot.relist'
      AND ae.vin IS NOT NULL
      AND l_prev.id IS NOT NULL
      AND (l_prev.outcome IS NULL OR l_prev.outcome = 'unknown')
      ${SINGLE_LOT_ID ? `AND (ae.lot_external_id = '${SINGLE_LOT_ID}' OR ae.event_data->>'previous_lot_external_id' = '${SINGLE_LOT_ID}')` : ''}
    ORDER BY ae.created_at DESC
  `

  const result = await pool.query(query)
  return result.rows
}

/**
 * Check if lot has reserve price (buy_it_now indicates reserve)
 */
function hasReserve(lot) {
  return lot.buy_it_now_usd != null && lot.buy_it_now_usd > 0
}

/**
 * Update lot outcome
 */
async function updateOutcome(lotId, outcome, confidence, method, notes = null, client = null) {
  const query = `
    UPDATE lots
    SET
      outcome = $1,
      outcome_confidence = $2,
      outcome_date = NOW(),
      detection_method = $3,
      detection_notes = $4,
      updated_at = NOW()
    WHERE id = $5
    RETURNING lot_external_id, outcome
  `

  const db = client || pool
  const result = await db.query(query, [outcome, confidence, method, notes, lotId])
  return result.rows[0]
}

/**
 * Update relist_count and previous_lot_id for relist chains
 */
async function updateRelistChain(currentLotId, previousLotId, client = null) {
  // Get relist_count from previous lot
  const prevQuery = `
    SELECT relist_count FROM lots WHERE id = $1
  `
  const db = client || pool
  const prevResult = await db.query(prevQuery, [previousLotId])
  const prevRelistCount = prevResult.rows[0]?.relist_count || 0

  // Update current lot
  const updateQuery = `
    UPDATE lots
    SET
      relist_count = $1,
      previous_lot_id = $2,
      updated_at = NOW()
    WHERE id = $3
  `
  await db.query(updateQuery, [prevRelistCount + 1, previousLotId, currentLotId])
}

// ============================================================================
// Heuristic Rules
// ============================================================================

async function applyDisappearanceRule(dryRun = false) {
  console.log('\n[Rule 1] Disappearance Rule: disappeared + auction_date past → sold (confidence: 0.85)')
  console.log(`         Grace period: ${GRACE_HOURS} hours`)

  const disappeared = await findDisappearedLots()
  console.log(`         Found ${disappeared.length} disappeared lots past grace period`)

  if (disappeared.length === 0) {
    console.log('         ✓ No lots to process')
    return { processed: 0, marked_sold: 0 }
  }

  let markedSold = 0

  if (!dryRun) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      for (const lot of disappeared) {
        // Check if VIN has reappeared (if so, skip - will be handled by relist rule)
        const relistCheck = await client.query(`
          SELECT 1 FROM audit.auction_events
          WHERE vin = $1
            AND event_type IN ('lot.appeared', 'lot.relist')
            AND lot_external_id != $2
            AND created_at > $3
          LIMIT 1
        `, [lot.vin, lot.lot_external_id, lot.disappeared_at])

        if (relistCheck.rows.length > 0) {
          if (DEBUG) console.log(`         [SKIP] ${lot.lot_external_id} — VIN reappeared, handled by relist rule`)
          continue
        }

        // Apply sold outcome
        await updateOutcome(
          lot.lot_id,
          'sold',
          0.85,
          'csv_disappearance',
          `Disappeared at ${lot.disappeared_at}, grace period ${GRACE_HOURS}h`,
          client
        )
        markedSold++

        if (DEBUG) console.log(`         [SOLD] ${lot.lot_external_id} (confidence: 0.85)`)
      }

      await client.query('COMMIT')
      console.log(`         ✓ Marked ${markedSold} lots as SOLD`)
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('         ❌ Error applying disappearance rule:', err.message)
      throw err
    } finally {
      client.release()
    }
  } else {
    console.log(`         🔍 DRY RUN: Would mark ${disappeared.length} lots as SOLD`)
  }

  return { processed: disappeared.length, marked_sold: markedSold }
}

async function applyRelistRule(dryRun = false) {
  console.log('\n[Rule 2] Relist Rule: VIN reappeared → previous = not_sold (confidence: 0.95)')

  const relists = await findRelists()
  console.log(`         Found ${relists.length} relist events`)

  if (relists.length === 0) {
    console.log('         ✓ No relists to process')
    return { processed: 0, marked_not_sold: 0 }
  }

  let markedNotSold = 0

  if (!dryRun) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      for (const relist of relists) {
        // Update previous lot as not_sold
        await updateOutcome(
          relist.previous_lot_id,
          'not_sold',
          0.95,
          'vin_reappearance',
          `VIN reappeared as ${relist.current_lot_external_id} at ${relist.relist_detected_at}`,
          client
        )

        // Update relist chain
        await updateRelistChain(relist.current_lot_id, relist.previous_lot_id, client)

        markedNotSold++

        if (DEBUG) console.log(`         [NOT_SOLD] ${relist.previous_lot_external_id} → relist as ${relist.current_lot_external_id}`)
      }

      await client.query('COMMIT')
      console.log(`         ✓ Marked ${markedNotSold} lots as NOT_SOLD`)
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('         ❌ Error applying relist rule:', err.message)
      throw err
    } finally {
      client.release()
    }
  } else {
    console.log(`         🔍 DRY RUN: Would mark ${relists.length} lots as NOT_SOLD`)
  }

  return { processed: relists.length, marked_not_sold: markedNotSold }
}

async function applyOnApprovalRule(dryRun = false) {
  console.log('\n[Rule 3] On Approval Rule: disappeared + reserve + no relist for ${ON_APPROVAL_DAYS}d → on_approval (confidence: 0.60)')
  console.log(`         Waiting period: ${ON_APPROVAL_DAYS} days`)

  const query = `
    SELECT DISTINCT
      ae.lot_external_id,
      ae.vin,
      ae.created_at as disappeared_at,
      l.id as lot_id,
      l.buy_it_now_usd,
      l.current_bid_usd
    FROM audit.auction_events ae
    INNER JOIN lots l ON ae.lot_external_id = l.lot_external_id
    WHERE ae.event_type = 'lot.disappeared'
      AND l.auction_datetime_utc IS NOT NULL
      AND l.auction_datetime_utc < NOW() - INTERVAL '${GRACE_HOURS} hours'
      AND ae.created_at < NOW() - INTERVAL '${ON_APPROVAL_DAYS} days'
      AND (l.outcome IS NULL OR l.outcome = 'unknown')
      AND l.buy_it_now_usd IS NOT NULL
      AND l.buy_it_now_usd > 0
      AND NOT l.is_removed
      ${SINGLE_LOT_ID ? `AND ae.lot_external_id = '${SINGLE_LOT_ID}'` : ''}
      AND NOT EXISTS (
        SELECT 1 FROM audit.auction_events ae2
        WHERE ae2.vin = ae.vin
          AND ae2.event_type IN ('lot.appeared', 'lot.relist')
          AND ae2.lot_external_id != ae.lot_external_id
          AND ae2.created_at > ae.created_at
      )
    ORDER BY ae.created_at DESC
  `

  const result = await pool.query(query)
  const candidates = result.rows

  console.log(`         Found ${candidates.length} on_approval candidates`)

  if (candidates.length === 0) {
    console.log('         ✓ No lots to process')
    return { processed: 0, marked_on_approval: 0 }
  }

  let markedOnApproval = 0

  if (!dryRun) {
    const client = await pool.connect()
    try {
      await client.query('BEGIN')

      for (const lot of candidates) {
        await updateOutcome(
          lot.lot_id,
          'on_approval',
          0.60,
          'reserve_no_relist',
          `Reserve price $${lot.buy_it_now_usd}, no relist for ${ON_APPROVAL_DAYS} days`,
          client
        )
        markedOnApproval++

        if (DEBUG) console.log(`         [ON_APPROVAL] ${lot.lot_external_id} (reserve: $${lot.buy_it_now_usd})`)
      }

      await client.query('COMMIT')
      console.log(`         ✓ Marked ${markedOnApproval} lots as ON_APPROVAL`)
    } catch (err) {
      await client.query('ROLLBACK')
      console.error('         ❌ Error applying on_approval rule:', err.message)
      throw err
    } finally {
      client.release()
    }
  } else {
    console.log(`         🔍 DRY RUN: Would mark ${candidates.length} lots as ON_APPROVAL`)
  }

  return { processed: candidates.length, marked_on_approval: markedOnApproval }
}

// ============================================================================
// Main Entry Point
// ============================================================================

async function main() {
  console.log('\n========================================')
  console.log('Outcome Resolver — Starting')
  console.log('========================================')
  console.log(`Mode:                ${DRY_RUN ? 'DRY RUN (no updates)' : 'LIVE (database will be updated)'}`)
  console.log(`Grace period:        ${GRACE_HOURS} hours`)
  console.log(`On-approval period:  ${ON_APPROVAL_DAYS} days`)
  if (SINGLE_LOT_ID) {
    console.log(`Single lot filter:   ${SINGLE_LOT_ID}`)
  }
  console.log('')

  const startTime = Date.now()

  // Apply heuristic rules
  const rule1 = await applyDisappearanceRule(DRY_RUN)
  const rule2 = await applyRelistRule(DRY_RUN)
  const rule3 = await applyOnApprovalRule(DRY_RUN)

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(2)

  console.log('\n========================================')
  console.log('Summary')
  console.log('========================================')
  console.log(`Rule 1 (Sold):        ${rule1.marked_sold} / ${rule1.processed}`)
  console.log(`Rule 2 (Not Sold):    ${rule2.marked_not_sold} / ${rule2.processed}`)
  console.log(`Rule 3 (On Approval): ${rule3.marked_on_approval} / ${rule3.processed}`)
  console.log(`Total Processed:      ${rule1.processed + rule2.processed + rule3.processed}`)
  console.log(`Total Updated:        ${rule1.marked_sold + rule2.marked_not_sold + rule3.marked_on_approval}`)
  console.log(`Time Elapsed:         ${elapsed}s`)
  console.log('========================================\n')

  await pool.end()
}

main().catch((err) => {
  console.error('❌ Fatal error:', err)
  pool.end()
  process.exit(1)
})
