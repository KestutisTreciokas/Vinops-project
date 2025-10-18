/**
 * Redis Client for Catalog Caching
 * SEO-SAFE: Only caches DB query results, not HTML
 */

import { createClient } from 'redis'

let redisClient: ReturnType<typeof createClient> | null = null

export async function getRedisClient() {
  if (redisClient) {
    return redisClient
  }

  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'

  redisClient = createClient({ url: redisUrl })

  redisClient.on('error', (err) => {
    console.error('[Redis] Client error:', err)
  })

  await redisClient.connect()
  console.log('[Redis] Connected successfully')

  return redisClient
}

/**
 * Get cached data or execute function and cache result
 * @param key Cache key
 * @param fn Function to execute if cache miss
 * @param ttl TTL in seconds (default: 300 = 5 minutes)
 */
export async function cacheGet<T>(
  key: string,
  fn: () => Promise<T>,
  ttl: number = 300
): Promise<T> {
  try {
    const client = await getRedisClient()

    // Try to get from cache
    const cached = await client.get(key)
    if (cached) {
      console.log(`[Redis] Cache HIT: ${key}`)
      return JSON.parse(cached)
    }

    console.log(`[Redis] Cache MISS: ${key}`)

    // Cache miss - execute function
    const result = await fn()

    // Store in cache with TTL
    await client.setEx(key, ttl, JSON.stringify(result))

    return result
  } catch (error) {
    console.error(`[Redis] Cache error for key ${key}:`, error)
    // On Redis error, fall back to executing function directly
    return await fn()
  }
}

/**
 * Invalidate cache by key pattern
 */
export async function cacheInvalidate(pattern: string) {
  try {
    const client = await getRedisClient()
    const keys = await client.keys(pattern)
    if (keys.length > 0) {
      await client.del(keys)
      console.log(`[Redis] Invalidated ${keys.length} keys matching: ${pattern}`)
    }
  } catch (error) {
    console.error(`[Redis] Invalidation error for pattern ${pattern}:`, error)
  }
}
