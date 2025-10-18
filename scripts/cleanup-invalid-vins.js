#!/usr/bin/env node
/**
 * VIN Cleanup Script
 *
 * Identifies and optionally removes/marks invalid VINs from the database.
 *
 * Invalid VIN criteria:
 * - Length < 11 characters (too short for any valid VIN format)
 * - Contains I, O, or Q characters (forbidden in standard VINs)
 * - Empty or whitespace-only
 *
 * Usage:
 *   node scripts/cleanup-invalid-vins.js --dry-run     # Preview what would be cleaned
 *   node scripts/cleanup-invalid-vins.js --mark        # Mark invalid lots as is_removed=true
 *   node scripts/cleanup-invalid-vins.js --delete      # DANGEROUS: Permanently delete invalid records
 *   node scripts/cleanup-invalid-vins.js --export      # Export invalid VINs to CSV
 *
 * Safety:
 * - Always runs in dry-run mode by default
 * - Requires explicit --mark or --delete flag
 * - Creates backup of affected records before deletion
 */

import pg from 'pg'
const { Pool } = pg

// VIN validation regex (allows 11-17 chars, excludes I/O/Q)
const VALID_VIN_REGEX = /^[A-HJ-NPR-Z0-9]{11,17}$/

// Database configuration
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://gen_user:J4nm7NGq^Rn5pH@192.168.0.5:5432/vinops_db?sslmode=disable',
  max: 5,
})

async function analyzeInvalidVins() {
  const client = await pool.connect()
  try {
    console.log('\n📊 Analyzing VIN data quality...\n')

    const result = await client.query(`
      WITH vin_analysis AS (
        SELECT
          v.vin,
          LENGTH(v.vin) as vin_length,
          CASE
            WHEN v.vin IS NULL THEN 'null'
            WHEN TRIM(v.vin) = '' THEN 'empty'
            WHEN LENGTH(v.vin) < 11 THEN 'too_short'
            WHEN v.vin ~ '[IOQ]' THEN 'forbidden_chars'
            WHEN LENGTH(v.vin) > 17 THEN 'too_long'
            ELSE 'valid'
          END as issue_type,
          COUNT(DISTINCT l.id) as lot_count,
          STRING_AGG(DISTINCT l.id::text, ', ') as lot_ids,
          MIN(l.created_at) as oldest_lot,
          MAX(l.created_at) as newest_lot
        FROM vehicles v
        LEFT JOIN lots l ON l.vin = v.vin AND NOT l.is_removed
        WHERE NOT v.is_removed
        GROUP BY v.vin
      )
      SELECT
        issue_type,
        COUNT(*) as vin_count,
        SUM(lot_count) as total_lots,
        (SELECT STRING_AGG(vin, ', ') FROM (SELECT vin FROM vin_analysis va2 WHERE va2.issue_type = va.issue_type LIMIT 5) sub) as sample_vins,
        MIN(vin_length) as min_length,
        MAX(vin_length) as max_length,
        MIN(oldest_lot) as oldest_lot_date,
        MAX(newest_lot) as newest_lot_date
      FROM vin_analysis va
      GROUP BY issue_type
      ORDER BY
        CASE issue_type
          WHEN 'null' THEN 1
          WHEN 'empty' THEN 2
          WHEN 'too_short' THEN 3
          WHEN 'forbidden_chars' THEN 4
          WHEN 'too_long' THEN 5
          WHEN 'valid' THEN 6
        END
    `)

    console.log('Issue Type       │ VINs  │ Lots  │ Length Range │ Sample VINs')
    console.log('─────────────────┼───────┼───────┼──────────────┼─────────────────────────────────')

    let totalInvalidVins = 0
    let totalInvalidLots = 0

    for (const row of result.rows) {
      const lengthRange = row.min_length && row.max_length
        ? `${row.min_length}-${row.max_length}`
        : 'N/A'
      const samples = row.sample_vins
        ? row.sample_vins.substring(0, 40) + (row.sample_vins.length > 40 ? '...' : '')
        : 'N/A'

      console.log(
        `${row.issue_type.padEnd(16)} │ ${String(row.vin_count).padStart(5)} │ ${String(row.total_lots).padStart(5)} │ ${lengthRange.padEnd(12)} │ ${samples}`
      )

      if (row.issue_type !== 'valid') {
        totalInvalidVins += parseInt(row.vin_count)
        totalInvalidLots += parseInt(row.total_lots)
      }
    }

    console.log('─────────────────┴───────┴───────┴──────────────┴─────────────────────────────────')
    console.log(`\n⚠️  Total Invalid: ${totalInvalidVins} VINs affecting ${totalInvalidLots} lots\n`)

    return { totalInvalidVins, totalInvalidLots }
  } finally {
    client.release()
  }
}

async function getInvalidVins() {
  const client = await pool.connect()
  try {
    const result = await client.query(`
      SELECT
        v.vin,
        LENGTH(v.vin) as vin_length,
        CASE
          WHEN v.vin IS NULL THEN 'null'
          WHEN TRIM(v.vin) = '' THEN 'empty'
          WHEN LENGTH(v.vin) < 11 THEN 'too_short'
          WHEN v.vin ~ '[IOQ]' THEN 'forbidden_chars'
          WHEN LENGTH(v.vin) > 17 THEN 'too_long'
        END as issue_type,
        COUNT(DISTINCT l.id) as lot_count,
        ARRAY_AGG(DISTINCT l.id) as lot_ids
      FROM vehicles v
      LEFT JOIN lots l ON l.vin = v.vin AND NOT l.is_removed
      WHERE NOT v.is_removed
        AND (
          v.vin IS NULL
          OR TRIM(v.vin) = ''
          OR LENGTH(v.vin) < 11
          OR v.vin ~ '[IOQ]'
          OR LENGTH(v.vin) > 17
        )
      GROUP BY v.vin
      ORDER BY lot_count DESC, v.vin
    `)

    return result.rows
  } finally {
    client.release()
  }
}

async function exportInvalidVins(invalidVins) {
  const fs = await import('fs')
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').substring(0, 19)
  const filename = `invalid-vins-${timestamp}.csv`

  const csvHeader = 'VIN,Length,Issue Type,Lot Count,Lot IDs\n'
  const csvRows = invalidVins.map(row => {
    const lotIds = row.lot_ids ? row.lot_ids.join(';') : ''
    return `"${row.vin || ''}",${row.vin_length},"${row.issue_type}",${row.lot_count},"${lotIds}"`
  }).join('\n')

  fs.writeFileSync(filename, csvHeader + csvRows)
  console.log(`✅ Exported ${invalidVins.length} invalid VINs to ${filename}\n`)
}

async function markInvalidVins(invalidVins, dryRun = true) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    let markedLots = 0
    let markedVehicles = 0

    for (const row of invalidVins) {
      if (dryRun) {
        console.log(`[DRY RUN] Would mark VIN: ${row.vin} (${row.lot_count} lots)`)
        markedLots += row.lot_count
        markedVehicles++
      } else {
        // Mark lots as removed
        if (row.lot_ids && row.lot_ids.length > 0) {
          await client.query(
            `UPDATE lots SET is_removed = true, updated_at = NOW() WHERE id = ANY($1::bigint[])`,
            [row.lot_ids]
          )
          markedLots += row.lot_count
        }

        // Mark vehicle as removed
        await client.query(
          `UPDATE vehicles SET is_removed = true, updated_at = NOW() WHERE vin = $1`,
          [row.vin]
        )
        markedVehicles++

        console.log(`✓ Marked VIN: ${row.vin} (${row.lot_count} lots)`)
      }
    }

    if (dryRun) {
      await client.query('ROLLBACK')
      console.log(`\n[DRY RUN] Would mark ${markedVehicles} vehicles and ${markedLots} lots as removed`)
      console.log('Run with --mark flag to apply changes\n')
    } else {
      await client.query('COMMIT')
      console.log(`\n✅ Marked ${markedVehicles} vehicles and ${markedLots} lots as is_removed=true\n`)
    }

    return { markedVehicles, markedLots }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function deleteInvalidVins(invalidVins, dryRun = true) {
  const client = await pool.connect()
  try {
    await client.query('BEGIN')

    // Create backup table if it doesn't exist
    if (!dryRun) {
      await client.query(`
        CREATE TABLE IF NOT EXISTS backup_deleted_vins (
          backup_id SERIAL PRIMARY KEY,
          backup_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
          vin TEXT,
          lot_data JSONB,
          vehicle_data JSONB
        )
      `)
    }

    let deletedLots = 0
    let deletedVehicles = 0

    for (const row of invalidVins) {
      if (dryRun) {
        console.log(`[DRY RUN] Would DELETE VIN: ${row.vin} (${row.lot_count} lots)`)
        deletedLots += row.lot_count
        deletedVehicles++
      } else {
        // Backup before deletion
        const vehicleBackup = await client.query(
          `SELECT row_to_json(v.*) as data FROM vehicles v WHERE vin = $1`,
          [row.vin]
        )

        if (row.lot_ids && row.lot_ids.length > 0) {
          const lotBackup = await client.query(
            `SELECT json_agg(l.*) as data FROM lots l WHERE id = ANY($1::bigint[])`,
            [row.lot_ids]
          )

          await client.query(
            `INSERT INTO backup_deleted_vins (vin, lot_data, vehicle_data)
             VALUES ($1, $2, $3)`,
            [row.vin, lotBackup.rows[0]?.data, vehicleBackup.rows[0]?.data]
          )

          // Delete lots
          await client.query(
            `DELETE FROM lots WHERE id = ANY($1::bigint[])`,
            [row.lot_ids]
          )
          deletedLots += row.lot_count
        }

        // Delete vehicle
        await client.query(`DELETE FROM vehicles WHERE vin = $1`, [row.vin])
        deletedVehicles++

        console.log(`✓ DELETED VIN: ${row.vin} (${row.lot_count} lots) - backup created`)
      }
    }

    if (dryRun) {
      await client.query('ROLLBACK')
      console.log(`\n[DRY RUN] Would DELETE ${deletedVehicles} vehicles and ${deletedLots} lots`)
      console.log('⚠️  WARNING: This is IRREVERSIBLE (except from backup table)')
      console.log('Run with --delete flag to permanently delete\n')
    } else {
      await client.query('COMMIT')
      console.log(`\n✅ DELETED ${deletedVehicles} vehicles and ${deletedLots} lots`)
      console.log('Backup stored in backup_deleted_vins table\n')
    }

    return { deletedVehicles, deletedLots }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function main() {
  const args = process.argv.slice(2)
  const dryRun = !args.includes('--mark') && !args.includes('--delete')
  const shouldExport = args.includes('--export')
  const shouldMark = args.includes('--mark')
  const shouldDelete = args.includes('--delete')

  console.log('\n🔍 VIN Cleanup Script\n')

  if (dryRun && !shouldExport) {
    console.log('Running in DRY RUN mode (no changes will be made)')
    console.log('Use --mark to mark invalid lots as removed')
    console.log('Use --delete to permanently delete invalid records (DANGEROUS)')
    console.log('Use --export to export invalid VINs to CSV\n')
  }

  try {
    // Step 1: Analyze
    const stats = await analyzeInvalidVins()

    if (stats.totalInvalidVins === 0) {
      console.log('✅ No invalid VINs found! Database is clean.\n')
      await pool.end()
      return
    }

    // Step 2: Get details
    const invalidVins = await getInvalidVins()

    // Step 3: Export if requested
    if (shouldExport) {
      await exportInvalidVins(invalidVins)
    }

    // Step 4: Mark or delete if requested
    if (shouldMark) {
      await markInvalidVins(invalidVins, false)
    } else if (shouldDelete) {
      console.log('⚠️  WARNING: You are about to PERMANENTLY DELETE invalid VINs!')
      console.log('This will delete vehicles and lots from the database.')
      console.log('A backup will be created in backup_deleted_vins table.\n')

      // Require confirmation for delete
      const readline = await import('readline')
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
      })

      const answer = await new Promise(resolve => {
        rl.question('Type "DELETE" to confirm: ', resolve)
      })
      rl.close()

      if (answer === 'DELETE') {
        await deleteInvalidVins(invalidVins, false)
      } else {
        console.log('\n❌ Delete cancelled\n')
      }
    } else if (!shouldExport) {
      // Show what would happen in dry run
      await markInvalidVins(invalidVins, true)
    }

  } catch (error) {
    console.error('\n❌ Error:', error.message)
    console.error(error.stack)
    process.exit(1)
  } finally {
    await pool.end()
  }
}

main()
