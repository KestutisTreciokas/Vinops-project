#!/usr/bin/env node
/**
 * Upsert Script: Staging → Public Lots
 * Sprint: S2 ETL (Staging→Public)
 *
 * Takes data from staging.copart_raw and upserts into public.lots table
 * Handles:
 * - New lots (INSERT)
 * - Updated lots (UPDATE)
 * - VIN conflicts with audit logging
 * - Vehicle table sync
 *
 * Usage: node scripts/upsert-lots.js [--file-id <id>] [--limit <n>]
 */

import pg from 'pg';

const { Client } = pg;
const DB_URL = process.env.DATABASE_URL;

// Parse command line arguments
const args = process.argv.slice(2);
const fileIdIndex = args.indexOf('--file-id');
const limitIndex = args.indexOf('--limit');

const fileId = fileIdIndex !== -1 ? parseInt(args[fileIdIndex + 1]) : null;
const limit = limitIndex !== -1 ? parseInt(args[limitIndex + 1]) : null;

async function main() {
  console.log(`\n${'='.repeat(70)}`);
  console.log(`  Upsert: Staging → Public Lots`);
  console.log(`${'='.repeat(70)}\n`);

  if (fileId) {
    console.log(`File ID filter: ${fileId}`);
  }
  if (limit) {
    console.log(`Limit: ${limit} rows`);
  }
  console.log();

  const client = new Client({
    connectionString: DB_URL,
    // Override read-only mode for ETL operations
    options: '-c default_transaction_read_only=off',
  });
  await client.connect();
  console.log('✓ Connected to database\n');

  try {
    await client.query('BEGIN');

    // Step 1: Get unprocessed staging records OR records with changes
    // Strategy: Include records where:
    //   - Never processed (processed_at IS NULL), OR
    //   - Staging source_updated_at is newer than lot's source_updated_at
    let query = `
      SELECT DISTINCT ON (cr.lot_external_id)
        cr.id,
        cr.lot_external_id,
        cr.vin_raw,
        cr.payload_jsonb,
        CASE
          WHEN cr.processed_at IS NULL THEN 'new'
          WHEN l.id IS NULL THEN 'new'
          WHEN (cr.payload_jsonb->>'Last Updated Time')::timestamptz > l.source_updated_at THEN 'updated'
          ELSE 'unchanged'
        END as record_type
      FROM staging.copart_raw cr
      LEFT JOIN lots l ON cr.lot_external_id = l.lot_external_id
      WHERE cr.lot_external_id IS NOT NULL
        AND cr.vin_raw IS NOT NULL
        AND cr.vin_raw != ''
        AND (
          cr.processed_at IS NULL
          OR (l.id IS NOT NULL AND (cr.payload_jsonb->>'Last Updated Time')::timestamptz > l.source_updated_at)
        )
    `;

    const params = [];
    let paramIndex = 1;

    if (fileId) {
      query += ` AND file_id = $${paramIndex++}`;
      params.push(fileId);
    }

    query += ` ORDER BY cr.lot_external_id, cr.id DESC`;

    if (limit) {
      query += ` LIMIT $${paramIndex++}`;
      params.push(limit);
    }

    const stagingResult = await client.query(query, params);
    const stagingRecords = stagingResult.rows;

    const newRecords = stagingRecords.filter(r => r.record_type === 'new').length;
    const updatedRecords = stagingRecords.filter(r => r.record_type === 'updated').length;

    console.log(`Found ${stagingRecords.length} records to process:`);
    console.log(`  - New lots: ${newRecords}`);
    console.log(`  - Updated lots: ${updatedRecords}\n`);

    if (stagingRecords.length === 0) {
      console.log('No records to process. Exiting.\n');
      await client.query('COMMIT');
      return;
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;
    let errors = 0;
    const errorDetails = [];

    // VIN validation regex (11-17 chars, excludes I/O/Q)
    const VIN_REGEX = /^[A-HJ-NPR-Z0-9]{11,17}$/;

    // Step 2: Process each record
    for (const record of stagingRecords) {
      // Use savepoint for individual record processing
      const savepointName = `sp_${record.id}`;

      try {
        await client.query(`SAVEPOINT ${savepointName}`);

        const { id: stagingId, lot_external_id, vin_raw, payload_jsonb, record_type } = record;
        const p = payload_jsonb; // shorthand

        // Validate VIN format before processing
        const normalizedVin = vin_raw.trim().toUpperCase();
        if (!VIN_REGEX.test(normalizedVin)) {
          // Skip invalid VINs and mark processing error
          await client.query(`
            UPDATE staging.copart_raw
            SET processing_error = 'Invalid VIN format: ' || $1
            WHERE id = $2
          `, [vin_raw, stagingId]);

          skipped++;
          errorDetails.push({
            stagingId,
            lotExternalId: lot_external_id,
            vin: vin_raw,
            error: 'INVALID_VIN_FORMAT',
            message: `VIN must be 11-17 uppercase chars, excluding I/O/Q (got: ${vin_raw})`
          });

          // Release savepoint and continue to next record
          await client.query(`RELEASE SAVEPOINT ${savepointName}`);
          continue;
        }

        // Parse numeric values safely
        const parseNum = (val) => {
          if (!val || val === '' || val === '0' || val === '0.0') return null;
          const num = parseFloat(val);
          return isNaN(num) ? null : num;
        };

        // Parse datetime
        const parseDatetime = (saleDate, saleTime, timezone) => {
          if (!saleDate || saleDate === '0') return null;
          try {
            // Sale date format: MDYY or MDDYY or MMDYY or MMDDYY
            // Examples: "12025" = Jan 20, 2025; "102025" = Oct 20, 2025
            const dateStr = String(saleDate);

            // Determine format based on length
            let month, day, year;

            if (dateStr.length === 5) {
              // Format: MDDYY (e.g., "12025" = Jan 20, 2025)
              month = dateStr.substring(0, 1).padStart(2, '0');
              day = dateStr.substring(1, 3);
              year = '20' + dateStr.substring(3, 5);
            } else if (dateStr.length === 6) {
              // Format: MMDDYY (e.g., "102025" = Oct 20, 2025)
              month = dateStr.substring(0, 2);
              day = dateStr.substring(2, 4);
              year = '20' + dateStr.substring(4, 6);
            } else {
              return null;
            }

            // Validate month and day
            const monthNum = parseInt(month);
            const dayNum = parseInt(day);
            if (monthNum < 1 || monthNum > 12 || dayNum < 1 || dayNum > 31) {
              return null;
            }

            const time = saleTime ? String(saleTime).padStart(4, '0') : '0900';
            const hour = time.substring(0, 2);
            const minute = time.substring(2, 4);

            return `${year}-${month}-${day} ${hour}:${minute}:00`;
          } catch (e) {
            return null;
          }
        };

        // Ensure vehicle exists first (use normalized VIN)
        await client.query(`
          INSERT INTO vehicles (vin)
          VALUES ($1)
          ON CONFLICT (vin) DO NOTHING
        `, [normalizedVin]);

        // Upsert into lots
        const upsertResult = await client.query(`
          INSERT INTO lots (
            vin,
            source,
            lot_external_id,
            site_code,
            yard_name,
            city,
            region,
            country,
            location_zip,
            auction_datetime_utc,
            sale_date_raw,
            sale_day_of_week,
            sale_time_hhmm,
            tz,
            item_number,
            vehicle_type,
            damage_code,
            damage_raw,
            damage_description,
            secondary_damage,
            title_code,
            title_raw,
            title_type,
            loss_code,
            loss_raw,
            lot_condition_code,
            odometer,
            odometer_brand_code,
            odometer_brand_raw,
            odometer_brand,
            retail_value_usd,
            repair_cost_usd,
            current_bid_usd,
            buy_it_now_usd,
            final_bid_usd,
            runs_drives,
            has_keys,
            special_note,
            currency_code,
            status,
            created_at_raw,
            grid_row,
            make_offer_eligible,
            source_updated_at,
            detection_method,
            detection_notes
          ) VALUES (
            $1, $2, $3, $4, $5, $6, $7, $8, $9, $10,
            $11, $12, $13, $14, $15, $16, $17, $18, $19, $20,
            $21, $22, $23, $24, $25, $26, $27, $28, $29, $30,
            $31, $32, $33, $34, $35, $36, $37, $38, $39, $40,
            $41, $42, $43, $44, $45, $46
          )
          ON CONFLICT (lot_external_id)
          DO UPDATE SET
            vin = EXCLUDED.vin,
            yard_name = EXCLUDED.yard_name,
            city = EXCLUDED.city,
            region = EXCLUDED.region,
            country = EXCLUDED.country,
            location_zip = EXCLUDED.location_zip,
            auction_datetime_utc = EXCLUDED.auction_datetime_utc,
            sale_date_raw = EXCLUDED.sale_date_raw,
            sale_day_of_week = EXCLUDED.sale_day_of_week,
            sale_time_hhmm = EXCLUDED.sale_time_hhmm,
            item_number = EXCLUDED.item_number,
            damage_code = EXCLUDED.damage_code,
            damage_raw = EXCLUDED.damage_raw,
            damage_description = EXCLUDED.damage_description,
            secondary_damage = EXCLUDED.secondary_damage,
            title_code = EXCLUDED.title_code,
            title_raw = EXCLUDED.title_raw,
            lot_condition_code = EXCLUDED.lot_condition_code,
            odometer = EXCLUDED.odometer,
            odometer_brand_code = EXCLUDED.odometer_brand_code,
            odometer_brand_raw = EXCLUDED.odometer_brand_raw,
            odometer_brand = EXCLUDED.odometer_brand,
            retail_value_usd = EXCLUDED.retail_value_usd,
            repair_cost_usd = EXCLUDED.repair_cost_usd,
            current_bid_usd = EXCLUDED.current_bid_usd,
            buy_it_now_usd = EXCLUDED.buy_it_now_usd,
            final_bid_usd = EXCLUDED.final_bid_usd,
            runs_drives = EXCLUDED.runs_drives,
            has_keys = EXCLUDED.has_keys,
            special_note = EXCLUDED.special_note,
            status = EXCLUDED.status,
            grid_row = EXCLUDED.grid_row,
            make_offer_eligible = EXCLUDED.make_offer_eligible,
            source_updated_at = EXCLUDED.source_updated_at,
            updated_at = NOW()
          RETURNING (xmax = 0) AS inserted
        `, [
          normalizedVin,                              // $1 vin (normalized and validated)
          'copart',                                   // $2 source
          lot_external_id,                            // $3 lot_external_id
          p['Yard number'],                           // $4 site_code
          p['Yard name'],                             // $5 yard_name
          p['Location city'],                         // $6 city
          p['Location state'],                        // $7 region
          p['Location country'],                      // $8 country
          p['Location ZIP'],                          // $9 location_zip
          parseDatetime(p['Sale Date M/D/CY'], p['Sale time (HHMM)'], p['Time Zone']), // $10 auction_datetime_utc
          parseNum(p['Sale Date M/D/CY']),           // $11 sale_date_raw
          p['Day of Week'],                           // $12 sale_day_of_week
          p['Sale time (HHMM)'],                      // $13 sale_time_hhmm
          p['Time Zone'],                             // $14 tz
          parseNum(p['Item#']),                       // $15 item_number
          p['Vehicle Type'],                          // $16 vehicle_type
          null,                                       // $17 damage_code (normalize later)
          p['Damage Description'],                    // $18 damage_raw
          p['Damage Description'],                    // $19 damage_description
          p['Secondary Damage'],                      // $20 secondary_damage
          null,                                       // $21 title_code (normalize later)
          p['Sale Title Type'],                       // $22 title_raw
          p['Sale Title Type'],                       // $23 title_type
          null,                                       // $24 loss_code (normalize later)
          null,                                       // $25 loss_raw
          p['Lot Cond. Code'],                        // $26 lot_condition_code
          parseNum(p['Odometer']),                    // $27 odometer
          p['Odometer Brand'],                        // $28 odometer_brand_code
          p['Odometer Brand'],                        // $29 odometer_brand_raw
          p['Odometer Brand'],                        // $30 odometer_brand
          parseNum(p['Est. Retail Value']),           // $31 retail_value_usd
          parseNum(p['Repair cost']),                 // $32 repair_cost_usd
          parseNum(p['High Bid =non-vix,Sealed=Vix']), // $33 current_bid_usd
          parseNum(p['Buy-It-Now Price']),            // $34 buy_it_now_usd
          null,                                       // $35 final_bid_usd
          p['Runs/Drives'],                           // $36 runs_drives
          p['Has Keys-Yes or No'] === 'YES',          // $37 has_keys
          p['Special Note'],                          // $38 special_note
          p['Currency Code'],                         // $39 currency_code
          p['Sale Status'] === 'Pure Sale' ? 'active' : 'upcoming', // $40 status
          p['Create Date/Time'],                      // $41 created_at_raw
          p['Grid/Row'],                              // $42 grid_row
          p['Make-an-Offer Eligible'] === 'Y',        // $43 make_offer_eligible
          p['Last Updated Time'],                     // $44 source_updated_at
          'csv_etl',                                  // $45 detection_method
          `Ingested from staging.copart_raw id=${stagingId}` // $46 detection_notes
        ]);

        const wasInserted = upsertResult.rows[0].inserted;
        if (wasInserted) {
          inserted++;
        } else {
          updated++;
        }

        // Mark staging record as processed (update timestamp even for re-processing)
        await client.query(`
          UPDATE staging.copart_raw
          SET processed_at = NOW()
          WHERE id = $1
        `, [stagingId]);

        // Release savepoint on success
        await client.query(`RELEASE SAVEPOINT ${savepointName}`);

        // Progress indicator
        if ((inserted + updated) % 100 === 0) {
          process.stdout.write(`\r  Processed: ${inserted + updated} (${inserted} new, ${updated} updated)`);
        }

      } catch (err) {
        errors++;

        // Rollback to savepoint to continue processing
        await client.query(`ROLLBACK TO SAVEPOINT ${savepointName}`);

        // Extract constraint name if available
        const constraintMatch = err.message.match(/constraint "([^"]+)"/);
        const constraintName = constraintMatch ? constraintMatch[1] : 'unknown';

        // Log error details
        const errorMsg = `Staging ID ${record.id}: ${constraintName} - ${err.message}`;
        errorDetails.push({ stagingId: record.id, vin: record.vin_raw, error: errorMsg });

        if (errors <= 10) { // Only print first 10 to avoid log spam
          console.error(`\n  [ERROR] ${errorMsg}`);
        }

        // Mark as error in staging (outside savepoint)
        await client.query(`
          UPDATE staging.copart_raw
          SET processing_error = $1
          WHERE id = $2
        `, [err.message, record.id]);
      }
    }

    await client.query('COMMIT');

    console.log(`\n\n${'='.repeat(70)}`);
    console.log(`  Summary`);
    console.log(`${'='.repeat(70)}`);
    console.log(`Total processed: ${inserted + updated + errors}`);
    console.log(`Inserted: ${inserted}`);
    console.log(`Updated: ${updated}`);
    console.log(`Errors (skipped): ${errors}`);

    if (errors > 0) {
      console.log(`\nError Breakdown:`);
      const errorsByType = {};
      errorDetails.forEach(e => {
        const type = e.error.split(':')[1]?.split('-')[0]?.trim() || 'unknown';
        errorsByType[type] = (errorsByType[type] || 0) + 1;
      });
      Object.entries(errorsByType).forEach(([type, count]) => {
        console.log(`  ${type}: ${count}`);
      });

      if (errors > 10) {
        console.log(`\n  (Showing first 10 errors, ${errors - 10} more suppressed)`);
      }
    }

    console.log(`\n✅ Upsert complete!\n`);

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('\n❌ Error during upsert:');
    console.error(error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
