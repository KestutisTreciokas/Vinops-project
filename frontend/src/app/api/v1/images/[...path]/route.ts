/**
 * Image Serving API with Multi-Layer Fallback
 *
 * Architecture:
 *   Layer 1 (Primary): R2 Storage - Archived photos
 *   Layer 2 (Fallback): Copart CDN - Direct proxy
 *   Layer 3 (Emergency): Placeholder - Graceful degradation
 *
 * URL Patterns:
 *   /api/v1/images/{vin}/{lot_id}/{seq}.webp
 *   /api/v1/images/{vin}/{lot_id}/xl/{seq}.webp
 *
 * Examples:
 *   /api/v1/images/1FMCU93184KA46160/12345678/1.webp
 *   /api/v1/images/1FMCU93184KA46160/12345678/xl/1.webp
 */

import { S3Client, GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Initialize R2 client (S3-compatible)
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

const R2_BUCKET = process.env.R2_BUCKET_NAME || 'vinops-prod'

// Known Copart CDN URL patterns (observed from Stat.vin and similar services)
const COPART_CDN_PATTERNS = [
  // Pattern 1: cs.copart.com with size variants
  (lotId: string, seq: string, size: string) =>
    `https://cs.copart.com/v1/AUTH_svc.pdoc00001/${lotId}/${size}/${seq}.jpg`,

  // Pattern 2: vis.copart.com direct format
  (lotId: string, seq: string, size: string) =>
    `https://vis.copart.com/images/lot/${lotId}/${seq}_${size}.jpg`,

  // Pattern 3: legacy format
  (lotId: string, seq: string) =>
    `https://cs.copart.com/images/${lotId}/${seq}.jpg`,
]

const COPART_SIZE_MAP: Record<string, string> = {
  'xl': 'full',
  'lg': '800',
  'md': '400',
  'thumb': '200',
}

/**
 * GET /api/v1/images/[...path]
 *
 * Path segments: [vin, lot_id, variant?, seq]
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  const startTime = Date.now()

  // Parse path segments
  const pathSegments = params.path
  if (pathSegments.length < 3) {
    return new NextResponse('Invalid path', { status: 400 })
  }

  const [vin, lotId, ...rest] = pathSegments

  // Determine variant and sequence number
  let variant = 'xl'
  let seqWithExt = rest[0]

  if (rest.length > 1) {
    // Format: /vin/lot/xl/1.webp
    variant = rest[0]
    seqWithExt = rest[1]
  }

  // Remove file extension (.webp, .jpg, etc.)
  const seq = seqWithExt?.replace(/\.(webp|jpg|jpeg|png)$/i, '') || '1'

  // Validate inputs
  if (!vin || !lotId || !seq || isNaN(Number(seq))) {
    return new NextResponse('Invalid parameters', { status: 400 })
  }

  // Layer 1: Try R2 Storage (Primary)
  const r2Result = await tryR2Storage(vin, lotId, variant, seq)
  if (r2Result) {
    console.log(`[IMG] Served from R2: ${vin}/${lotId}/${variant}/${seq} (${Date.now() - startTime}ms)`)
    return r2Result
  }

  // Layer 2: Try Copart CDN (Fallback)
  const copartResult = await tryCopartCDN(vin, lotId, variant, seq)
  if (copartResult) {
    console.log(`[IMG] Served from Copart CDN: ${vin}/${lotId}/${variant}/${seq} (${Date.now() - startTime}ms)`)

    // Opportunistically save to R2 for future requests (fire-and-forget)
    saveToR2Async(vin, lotId, variant, seq, copartResult.clone()).catch(err =>
      console.error('[IMG] Background R2 save failed:', err.message)
    )

    return copartResult
  }

  // Layer 3: Return Placeholder (Graceful Degradation)
  console.log(`[IMG] Served placeholder: ${vin}/${lotId}/${variant}/${seq} (${Date.now() - startTime}ms)`)
  return servePlaceholder()
}

/**
 * Layer 1: Try fetching from R2 storage
 */
async function tryR2Storage(
  vin: string,
  lotId: string,
  variant: string,
  seq: string
): Promise<NextResponse | null> {
  const storageKey = `copart/${vin}/${lotId}/${variant}/${seq}.webp`

  try {
    const command = new GetObjectCommand({
      Bucket: R2_BUCKET,
      Key: storageKey,
    })

    const response = await r2Client.send(command)

    if (response.Body) {
      // Stream the body directly
      const stream = response.Body.transformToWebStream()

      return new NextResponse(stream, {
        status: 200,
        headers: {
          'Content-Type': response.ContentType || 'image/webp',
          'Content-Length': String(response.ContentLength || ''),
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Image-Source': 'r2',
          'X-Storage-Key': storageKey,
        },
      })
    }
  } catch (err: any) {
    // NoSuchKey is expected for images not yet archived
    if (err.name !== 'NoSuchKey') {
      console.error('[IMG] R2 error:', err.message)
    }
  }

  return null
}

/**
 * Layer 2: Try fetching from Copart CDN
 */
async function tryCopartCDN(
  vin: string,
  lotId: string,
  variant: string,
  seq: string
): Promise<NextResponse | null> {
  const copartSize = COPART_SIZE_MAP[variant] || 'full'

  // Try multiple URL patterns
  for (const patternFn of COPART_CDN_PATTERNS) {
    const url = patternFn(lotId, seq, copartSize)

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Referer': 'https://www.copart.com/',
          'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        },
        signal: AbortSignal.timeout(5000), // 5 second timeout
      })

      if (response.ok && response.status === 200) {
        const contentType = response.headers.get('content-type') || 'image/jpeg'

        // Verify it's actually an image
        if (!contentType.startsWith('image/')) {
          continue // Try next pattern
        }

        return new NextResponse(response.body, {
          status: 200,
          headers: {
            'Content-Type': contentType,
            'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
            'X-Image-Source': 'copart-cdn',
            'X-Source-URL': url,
          },
        })
      }
    } catch (err: any) {
      // Timeout or network error - try next pattern
      if (err.name !== 'AbortError') {
        console.error(`[IMG] Copart CDN error (${url}):`, err.message)
      }
    }
  }

  return null
}

/**
 * Layer 3: Serve placeholder image
 */
function servePlaceholder(): NextResponse {
  const svg = `
    <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="50%"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="24"
            fill="#9ca3af"
            text-anchor="middle"
            dominant-baseline="middle">
        Image Unavailable
      </text>
      <text x="50%" y="55%"
            font-family="system-ui, -apple-system, sans-serif"
            font-size="14"
            fill="#d1d5db"
            text-anchor="middle"
            dominant-baseline="middle">
        Photo not found in archive
      </text>
    </svg>
  `.trim()

  return new NextResponse(svg, {
    status: 200,
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300',
      'X-Image-Source': 'placeholder',
    },
  })
}

/**
 * Background task: Save proxied image to R2 for future requests
 */
async function saveToR2Async(
  vin: string,
  lotId: string,
  variant: string,
  seq: string,
  response: Response
): Promise<void> {
  const storageKey = `copart/${vin}/${lotId}/${variant}/${seq}.webp`

  try {
    // Read response body
    const arrayBuffer = await response.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to R2
    const command = new PutObjectCommand({
      Bucket: R2_BUCKET,
      Key: storageKey,
      Body: buffer,
      ContentType: 'image/webp',
      CacheControl: 'public, max-age=31536000, immutable',
      Metadata: {
        vin,
        lot_id: lotId,
        variant,
        seq,
        source: 'copart-cdn',
        archived_at: new Date().toISOString(),
      },
    })

    await r2Client.send(command)
    console.log(`[IMG] Saved to R2: ${storageKey} (${buffer.length} bytes)`)
  } catch (err: any) {
    console.error(`[IMG] Failed to save to R2 (${storageKey}):`, err.message)
    throw err
  }
}
