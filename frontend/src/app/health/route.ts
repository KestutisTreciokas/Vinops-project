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

export async function GET() {
  const timestamp = new Date().toISOString()
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
      activeLots: 0,
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
      const [vehicles, lots, active, images] = await Promise.all([
        client.query('SELECT COUNT(*) as c FROM vehicles WHERE NOT is_removed'),
        client.query('SELECT COUNT(*) as c FROM lots'),
        client.query("SELECT COUNT(*) as c FROM lots WHERE status = 'active'"),
        client.query('SELECT COUNT(DISTINCT vin) as c FROM images WHERE NOT is_removed'),
      ])

      health.services.database = { status: 'up', message: 'Connected' }
      health.metrics.totalVehicles = parseInt(vehicles.rows[0].c)
      health.metrics.totalLots = parseInt(lots.rows[0].c)
      health.metrics.activeLots = parseInt(active.rows[0].c)
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

  const status = health.status === 'healthy' ? 200 : health.status === 'degraded' ? 200 : 503
  return NextResponse.json(health, {
    status,
    headers: { 'Cache-Control': 'no-store' },
  })
}

export async function HEAD() {
  return new Response(null, { status: 200 })
}
