/**
 * Health Check Endpoint - Auto-detects environment
 * Monitors: Web, ETL, Images, Redis, Database
 */
import { NextResponse } from 'next/server'
import { getPool } from '../api/_lib/db'
import { getRedisClient } from '@/lib/redis'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const startTime = Date.now()

export async function GET(request: Request) {
  const timestamp = new Date().toISOString()
  const acceptHeader = request.headers.get('accept') || ''
  const wantsHtml = acceptHeader.includes('text/html')

  const health: any = {
    status: 'healthy',
    timestamp,
    services: {
      web: { status: 'up', message: 'Next.js operational' },
      database: { status: 'down' },
      redis: { status: 'down' },
      etl: { status: 'down' },
      imageBackfill: { status: 'down' },
      images: { status: 'down' },
    },
    metrics: {
      totalVehicles: 0,
      totalLots: 0,
      lotsByStatus: {
        active: 0,
        upcoming: 0,
        sold: 0,
        live: 0,
        pending_result: 0,
        no_bids: 0,
        unknown: 0,
      },
      vehiclesWithImages: 0,
      lotsNeedingImages: 0,
      imagesAddedLast30Min: 0,
      uptimeSeconds: Math.floor((Date.now() - startTime) / 1000),
    },
  }

  // Database
  try {
    const pool = await getPool()
    const client = await pool.connect()
    try {
      await client.query('SELECT 1')

      // Query status breakdown using SAME logic as computeDisplayStatus() to match catalog
      const [vehicles, lots, statusBreakdown, images] = await Promise.all([
        client.query('SELECT COUNT(*) as c FROM vehicles WHERE NOT is_removed'),
        client.query('SELECT COUNT(*) as c FROM lots WHERE NOT is_removed'),
        client.query(`
          SELECT
            CASE
              -- Sold (has final bid - will be separate once final_bid column exists)
              WHEN auction_datetime_utc < NOW() - INTERVAL '24 hours'
                   AND current_bid_usd > 0 THEN 'pending_result'
              -- No bids
              WHEN auction_datetime_utc < NOW() - INTERVAL '24 hours'
                   AND (current_bid_usd IS NULL OR current_bid_usd = 0) THEN 'no_bids'
              -- Live (within 24h of auction)
              WHEN auction_datetime_utc BETWEEN NOW() - INTERVAL '24 hours'
                   AND NOW() + INTERVAL '24 hours' THEN 'live'
              -- Upcoming (>24h future)
              WHEN auction_datetime_utc > NOW() + INTERVAL '24 hours' THEN 'upcoming'
              -- NULL auction date - fallback to db status
              ELSE COALESCE(status, 'unknown')
            END as display_status,
            COUNT(*) as count
          FROM lots
          WHERE NOT is_removed
          GROUP BY display_status
        `),
        client.query('SELECT COUNT(DISTINCT vin) as c FROM images WHERE NOT is_removed'),
      ])

      // Build status counts object
      const statusCounts: Record<string, number> = {
        active: 0,
        upcoming: 0,
        sold: 0,
        live: 0,
        pending_result: 0,
        no_bids: 0,
        unknown: 0,
      }
      statusBreakdown.rows.forEach((row: any) => {
        statusCounts[row.display_status] = parseInt(row.count)
      })

      health.services.database = { status: 'up', message: 'Connected' }
      health.metrics.totalVehicles = parseInt(vehicles.rows[0].c)
      health.metrics.totalLots = parseInt(lots.rows[0].c)
      health.metrics.lotsByStatus = statusCounts
      health.metrics.vehiclesWithImages = parseInt(images.rows[0].c)
    } finally {
      client.release()
    }
  } catch (e: any) {
    health.services.database = { status: 'down', message: e.message }
    health.status = 'unhealthy'
  }

  // Redis
  try {
    const redis = await getRedisClient()
    await redis.ping()
    health.services.redis = { status: 'up', message: 'Connected' }
  } catch (e: any) {
    health.services.redis = { status: 'down', message: e.message }
    health.status = 'degraded'
  }

  // ETL
  try {
    const pool = await getPool()
    const client = await pool.connect()
    try {
      const result = await client.query(`
        SELECT window_start_utc FROM raw.csv_files
        ORDER BY window_start_utc DESC LIMIT 1
      `)
      if (result.rows.length > 0) {
        const lastRun = new Date(result.rows[0].window_start_utc)
        const hoursAgo = (Date.now() - lastRun.getTime()) / 3600000
        health.services.etl = {
          status: hoursAgo < 2 ? 'up' : 'degraded',
          message: hoursAgo < 2 ? 'On schedule' : `${hoursAgo.toFixed(1)}h ago`,
          lastRun: result.rows[0].window_start_utc,
        }
        if (hoursAgo >= 2) health.status = 'degraded'
      } else {
        health.services.etl = { status: 'down', message: 'No runs found' }
        health.status = 'degraded'
      }
    } finally {
      client.release()
    }
  } catch (e: any) {
    health.services.etl = { status: 'down', message: e.message }
    health.status = 'degraded'
  }

  // Images & Backfill Status
  try {
    const pool = await getPool()
    const client = await pool.connect()
    try {
      const [imageStats, backfillStats, recentImages] = await Promise.all([
        client.query(`
          SELECT COUNT(*) as total, MAX(created_at) as last_added
          FROM images WHERE NOT is_removed
        `),
        client.query(`
          SELECT COUNT(*) as lots_needing_images
          FROM lots l
          WHERE NOT EXISTS (
            SELECT 1 FROM images i
            WHERE i.lot_id = l.id AND NOT i.is_removed
          )
          AND l.created_at > NOW() - INTERVAL '7 days'
        `),
        client.query(`
          SELECT COUNT(*) as recent_count
          FROM images
          WHERE created_at > NOW() - INTERVAL '30 minutes'
          AND NOT is_removed
        `),
      ])

      const total = parseInt(imageStats.rows[0].total)
      const coverage = health.metrics.totalVehicles > 0
        ? ((health.metrics.vehiclesWithImages / health.metrics.totalVehicles) * 100).toFixed(1)
        : '0.0'
      const lotsNeedingImages = parseInt(backfillStats.rows[0].lots_needing_images)
      const imagesAddedLast30Min = parseInt(recentImages.rows[0].recent_count)

      health.metrics.lotsNeedingImages = lotsNeedingImages
      health.metrics.imagesAddedLast30Min = imagesAddedLast30Min

      health.services.images = {
        status: total > 0 ? 'up' : 'degraded',
        message: `${coverage}% coverage`,
        total,
        lastAdded: imageStats.rows[0].last_added,
      }

      // Image Backfill Service (inferred from recent activity)
      const lastImageAdded = new Date(imageStats.rows[0].last_added)
      const minutesSinceLastImage = (Date.now() - lastImageAdded.getTime()) / 60000

      health.services.imageBackfill = {
        status: minutesSinceLastImage < 35 ? 'up' : 'degraded',
        message: imagesAddedLast30Min > 0
          ? `Active: ${imagesAddedLast30Min} images last 30min`
          : `Idle: ${minutesSinceLastImage.toFixed(0)}min since last image`,
        lotsRemaining: lotsNeedingImages,
        lastActivity: imageStats.rows[0].last_added,
      }

      if (minutesSinceLastImage >= 35) {
        health.status = 'degraded'
      }
    } finally {
      client.release()
    }
  } catch (e: any) {
    health.services.images = { status: 'down', message: e.message }
    health.services.imageBackfill = { status: 'down', message: e.message }
  }

  // Copart Outcome Detection
  try {
    const pool = await getPool()
    const client = await pool.connect()
    try {
      const [eventStats, outcomeStats] = await Promise.all([
        client.query(`
          SELECT
            COUNT(*) as total_events,
            MAX(created_at) as last_event,
            COUNT(*) FILTER (WHERE event_type = 'lot.appeared') as appeared,
            COUNT(*) FILTER (WHERE event_type = 'lot.disappeared') as disappeared,
            COUNT(*) FILTER (WHERE event_type = 'lot.updated') as updated,
            COUNT(*) FILTER (WHERE event_type = 'lot.status_change') as status_change
          FROM audit.auction_events
        `),
        client.query(`
          SELECT
            COUNT(*) FILTER (WHERE outcome IS NOT NULL) as total_outcomes,
            COUNT(*) FILTER (WHERE outcome = 'sold') as sold,
            COUNT(*) FILTER (WHERE outcome = 'not_sold') as not_sold,
            COUNT(*) FILTER (WHERE outcome = 'on_approval') as on_approval,
            ROUND(AVG(outcome_confidence) * 100) as avg_confidence,
            MAX(outcome_date) as last_outcome_date
          FROM lots
        `),
      ])

      const totalEvents = parseInt(eventStats.rows[0].total_events)
      const lastEvent = eventStats.rows[0].last_event
      const totalOutcomes = parseInt(outcomeStats.rows[0].total_outcomes)
      const avgConfidence = outcomeStats.rows[0].avg_confidence
      const lastOutcomeDate = outcomeStats.rows[0].last_outcome_date

      const hoursSinceLastEvent = lastEvent
        ? (Date.now() - new Date(lastEvent).getTime()) / 3600000
        : 999

      health.services.copartOutcomes = {
        status: hoursSinceLastEvent < 2 ? 'up' : 'degraded',
        message: totalOutcomes > 0
          ? `${totalOutcomes} outcomes detected (${avgConfidence}% avg confidence)`
          : totalEvents > 0
          ? `${totalEvents} events tracked, 0 outcomes resolved`
          : 'No events tracked yet',
        totalEvents,
        eventBreakdown: {
          appeared: parseInt(eventStats.rows[0].appeared),
          disappeared: parseInt(eventStats.rows[0].disappeared),
          updated: parseInt(eventStats.rows[0].updated),
          statusChange: parseInt(eventStats.rows[0].status_change),
        },
        totalOutcomes,
        outcomeBreakdown: {
          sold: parseInt(outcomeStats.rows[0].sold) || 0,
          notSold: parseInt(outcomeStats.rows[0].not_sold) || 0,
          onApproval: parseInt(outcomeStats.rows[0].on_approval) || 0,
        },
        avgConfidence,
        lastEvent,
        lastOutcomeDate,
      }

      if (hoursSinceLastEvent >= 2) {
        health.status = 'degraded'
      }
    } finally {
      client.release()
    }
  } catch (e: any) {
    health.services.copartOutcomes = { status: 'down', message: e.message }
  }

  const status = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503

  // Return HTML UI for browsers, JSON for API clients
  if (wantsHtml) {
    const html = generateHealthHTML(health)
    return new Response(html, {
      status,
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store',
      },
    })
  }

  return NextResponse.json(health, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

function generateHealthHTML(health: any): string {
  const statusColor = health.status === 'healthy' ? '#10b981' : health.status === 'degraded' ? '#f59e0b' : '#ef4444'
  const statusBg = health.status === 'healthy' ? '#d1fae5' : health.status === 'degraded' ? '#fef3c7' : '#fee2e2'

  const serviceCards = Object.entries(health.services).map(([name, service]: [string, any]) => {
    const sColor = service.status === 'up' ? '#10b981' : service.status === 'degraded' ? '#f59e0b' : '#ef4444'
    const sBg = service.status === 'up' ? '#d1fae5' : service.status === 'degraded' ? '#fef3c7' : '#fee2e2'

    // Special rendering for Copart Outcomes service
    let extraDetails = ''
    if (name === 'copartOutcomes' && service.eventBreakdown) {
      extraDetails = `
        <div style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #e5e7eb;">
          <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #374151;">Event Breakdown:</p>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 4px; font-size: 11px; color: #6b7280;">
            <div>Appeared: ${service.eventBreakdown.appeared}</div>
            <div>Disappeared: ${service.eventBreakdown.disappeared}</div>
            <div>Updated: ${service.eventBreakdown.updated}</div>
            <div>Status Change: ${service.eventBreakdown.statusChange}</div>
          </div>
        </div>
        ${service.totalOutcomes > 0 ? `
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid #e5e7eb;">
            <p style="margin: 0 0 6px 0; font-size: 12px; font-weight: 600; color: #374151;">Outcomes Resolved:</p>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 4px; font-size: 11px; color: #6b7280;">
              <div>Sold: ${service.outcomeBreakdown.sold}</div>
              <div>Not Sold: ${service.outcomeBreakdown.notSold}</div>
              <div>On Approval: ${service.outcomeBreakdown.onApproval}</div>
            </div>
          </div>
        ` : ''}
      `
    }

    return `
      <div style="background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h3 style="margin: 0; font-size: 18px; font-weight: 600; color: #111827;">${formatServiceName(name)}</h3>
          <span style="background: ${sBg}; color: ${sColor}; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;">
            ${service.status.toUpperCase()}
          </span>
        </div>
        <p style="margin: 8px 0 0 0; font-size: 14px; color: #6b7280;">${service.message || 'Operational'}</p>
        ${service.lastRun ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">Last run: ${new Date(service.lastRun).toLocaleString()}</p>` : ''}
        ${service.lastEvent ? `<p style="margin: 8px 0 0 0; font-size: 12px; color: #9ca3af;">Last event: ${new Date(service.lastEvent).toLocaleString()}</p>` : ''}
        ${service.lastActivity ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #9ca3af;">Last activity: ${new Date(service.lastActivity).toLocaleString()}</p>` : ''}
        ${service.lotsRemaining ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #9ca3af;">Lots remaining: ${service.lotsRemaining.toLocaleString()}</p>` : ''}
        ${service.total ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #9ca3af;">Total: ${service.total.toLocaleString()}</p>` : ''}
        ${extraDetails}
      </div>
    `
  }).join('')

  const metrics = health.metrics
  const coverage = metrics.totalVehicles > 0 ? ((metrics.vehiclesWithImages / metrics.totalVehicles) * 100).toFixed(1) : '0.0'

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta http-equiv="refresh" content="30">
  <title>System Health - Vinops</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #f9fafb; padding: 20px; }
    .container { max-width: 1400px; margin: 0 auto; }
    .header { margin-bottom: 32px; }
    .header-top { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; flex-wrap: wrap; gap: 16px; }
    .status-badge { background: ${statusBg}; color: ${statusColor}; padding: 8px 16px; border-radius: 9999px; font-size: 14px; font-weight: 600; }
    .timestamp { color: #6b7280; font-size: 14px; }
    .metrics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .metric-card { background: #dbeafe; border: 1px solid #bfdbfe; border-radius: 8px; padding: 16px; }
    .metric-label { color: #1e40af; font-size: 14px; font-weight: 500; margin-bottom: 8px; }
    .metric-value { color: #1e3a8a; font-size: 28px; font-weight: 700; }
    .status-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .services-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 16px; margin-bottom: 32px; }
    .info-box { background: white; border: 1px solid #e5e7eb; border-radius: 8px; padding: 16px; }
    .info-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 16px; font-size: 14px; }
    .info-label { color: #6b7280; margin-bottom: 4px; }
    .info-value { color: #111827; font-weight: 500; }
    .refresh-note { text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px; }
    @media (max-width: 640px) {
      .header-top { flex-direction: column; align-items: flex-start; }
      .services-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="header-top">
        <h1 style="font-size: 32px; font-weight: 700; color: #111827;">System Health Monitor</h1>
        <span class="status-badge">${health.status.toUpperCase()}</span>
      </div>
      <p class="timestamp">Last updated: ${new Date(health.timestamp).toLocaleString()} • Auto-refresh every 30s</p>
    </div>

    <div class="metrics-grid">
      <div class="metric-card">
        <div class="metric-label">Total Vehicles</div>
        <div class="metric-value">${metrics.totalVehicles.toLocaleString()}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Total Lots</div>
        <div class="metric-value">${metrics.totalLots.toLocaleString()}</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Image Coverage</div>
        <div class="metric-value">${coverage}%</div>
      </div>
    </div>

    <h2 style="font-size: 20px; font-weight: 600; color: #111827; margin-bottom: 16px;">Lot Status Breakdown</h2>
    <div class="status-grid">
      ${generateStatusCards(metrics.lotsByStatus, metrics.totalLots)}
    </div>

    <h2 style="font-size: 20px; font-weight: 600; color: #111827; margin-bottom: 16px;">Services</h2>
    <div class="services-grid">
      ${serviceCards}
    </div>

    <div class="info-box">
      <h3 style="font-size: 14px; font-weight: 600; color: #374151; margin-bottom: 12px;">Additional Information</h3>
      <div class="info-grid">
        <div>
          <div class="info-label">Uptime</div>
          <div class="info-value">${Math.floor(metrics.uptimeSeconds / 60)} min</div>
        </div>
        <div>
          <div class="info-label">Images with Vehicles</div>
          <div class="info-value">${metrics.vehiclesWithImages.toLocaleString()}</div>
        </div>
        <div>
          <div class="info-label">Lots Needing Images</div>
          <div class="info-value">${metrics.lotsNeedingImages.toLocaleString()}</div>
        </div>
        <div>
          <div class="info-label">Images Last 30min</div>
          <div class="info-value">${metrics.imagesAddedLast30Min.toLocaleString()}</div>
        </div>
      </div>
    </div>

    <div class="refresh-note">
      API Endpoint: <code>/health</code> • For JSON, use <code>Accept: application/json</code> header
    </div>
  </div>
</body>
</html>`
}

function formatServiceName(name: string): string {
  const names: Record<string, string> = {
    web: 'Web Server',
    database: 'Database',
    redis: 'Redis Cache',
    etl: 'ETL Pipeline',
    imageBackfill: 'Image Backfill',
    images: 'Images',
    copartOutcomes: 'Copart Outcome Detection',
  }
  return names[name] || name
}

function generateStatusCards(statusCounts: Record<string, number>, totalLots: number): string {
  const statusConfig: Record<string, { label: string; color: string; bgColor: string }> = {
    active: { label: 'Active', color: '#2563eb', bgColor: '#dbeafe' },
    upcoming: { label: 'Upcoming', color: '#7c3aed', bgColor: '#ede9fe' },
    sold: { label: 'Sold', color: '#16a34a', bgColor: '#dcfce7' },
    live: { label: 'Live', color: '#dc2626', bgColor: '#fee2e2' },
    pending_result: { label: 'Pending Result', color: '#ea580c', bgColor: '#ffedd5' },
    no_bids: { label: 'No Bids', color: '#6b7280', bgColor: '#f3f4f6' },
    unknown: { label: 'Unknown', color: '#4b5563', bgColor: '#f9fafb' },
  }

  return Object.entries(statusConfig).map(([key, config]) => {
    const count = statusCounts[key] || 0
    const percentage = totalLots > 0 ? ((count / totalLots) * 100).toFixed(2) : '0.00'

    return `
      <div class="status-card" style="background: white; border-left: 4px solid ${config.color}; border-radius: 8px; padding: 16px; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <h3 style="margin: 0; font-size: 16px; font-weight: 600; color: #111827;">${config.label}</h3>
          <span style="background: ${config.bgColor}; color: ${config.color}; padding: 4px 12px; border-radius: 9999px; font-size: 12px; font-weight: 600;">
            ${percentage}%
          </span>
        </div>
        <div style="font-size: 28px; font-weight: 700; color: ${config.color};">${count.toLocaleString()}</div>
      </div>
    `
  }).join('')
}

export async function HEAD() {
  return new Response(null, { status: 200 })
}
