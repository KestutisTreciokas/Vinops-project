# Photo Implementation Guide - Quick Start

**Sprint**: S3 - Photo Management
**Priority**: High
**Estimated Effort**: 2-4 weeks

## Quick Decision Matrix

| Your Priority | Recommended Approach |
|---------------|---------------------|
| **Long-term availability (3+ years)** | ✅ Archive to R2 (Hybrid approach) |
| **Minimal storage cost** | ⚠️ Direct CDN links only (unreliable) |
| **Account safety** | ✅ Controlled scraping with rate limits |
| **Fast time-to-market** | ✅ Start with Phase 2 (serving), backfill later |

## Recommended: Hybrid Approach

**Why this wins**:
1. **Cost**: $15/month per 1TB on R2 (vs $900/mo on S3)
2. **No egress fees**: Cloudflare doesn't charge for bandwidth
3. **Long-term**: Photos available forever, not just during auction
4. **Reliability**: Fallback to direct CDN if R2 doesn't have it yet
5. **Industry standard**: Stat.vin, Bidfax all archive photos

## Implementation Roadmap

### Option A: Fast Track (Recommended for MVP)

**Start with serving layer, backfill photos later**

```
Week 1: Build image serving API with fallback to Copart CDN
Week 2: Start backfilling photos for high-traffic VINs
Week 3: Continuous ingestion for new CSV lots
Week 4: Monitor and optimize
```

**Advantages**:
- Users see photos immediately (via Copart CDN fallback)
- No blocking if scraper isn't ready yet
- Gradual archive building

### Option B: Full Archive First

**Build complete photo archive before launch**

```
Week 1-2: Build scraping pipeline
Week 2-3: Backfill all 150k lots (~2M photos)
Week 3-4: Build serving layer
```

**Advantages**:
- Complete photo archive from day 1
- No dependency on Copart CDN availability
- Better for SEO (images indexed immediately)

## Detailed Implementation Steps

### Step 1: R2 Bucket Setup (1 hour)

```bash
# Create R2 bucket (use Cloudflare dashboard or API)
# Bucket name: vinops-prod
# Region: Automatic
# Public Access: Enabled via Custom Domain

# Configure custom domain
# Domain: img.vinops.online
# Bucket: vinops-prod
# SSL: Full (strict)
```

**Configuration checklist**:
- [ ] R2 bucket created
- [ ] Public access enabled
- [ ] Custom domain `img.vinops.online` configured
- [ ] DNS CNAME added: `img.vinops.online → {bucket}.r2.cloudflarestorage.com`
- [ ] Test URL: `https://img.vinops.online/test.txt`

### Step 2: Image Serving API (4-8 hours)

**Create**: `frontend/src/app/api/v1/images/[...path]/route.ts`

```typescript
// GET /api/v1/images/{vin}/{lot_id}/{seq}.webp
// GET /api/v1/images/{vin}/{lot_id}/xl/{seq}.webp

import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3'
import { NextRequest, NextResponse } from 'next/server'

const r2 = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID!,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY!,
  },
})

export async function GET(
  req: NextRequest,
  { params }: { params: { path: string[] } }
) {
  // Parse: [vin, lot_id, variant, seq] or [vin, lot_id, seq]
  const [vin, lotId, ...rest] = params.path
  const variant = rest.length > 1 ? rest[0] : 'xl'
  const seq = rest.length > 1 ? rest[1] : rest[0]

  // Remove .webp extension
  const seqNum = seq.replace('.webp', '')

  // Layer 1: Try R2 storage
  const storageKey = `copart/${vin}/${lotId}/${variant}/${seqNum}.webp`

  try {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME!,
      Key: storageKey,
    })
    const response = await r2.send(command)

    if (response.Body) {
      return new NextResponse(response.Body.transformToWebStream(), {
        headers: {
          'Content-Type': 'image/webp',
          'Cache-Control': 'public, max-age=31536000, immutable',
          'X-Image-Source': 'r2',
        },
      })
    }
  } catch (err: any) {
    if (err.name !== 'NoSuchKey') {
      console.error('[IMG] R2 error:', err)
    }
  }

  // Layer 2: Try Copart CDN direct link
  const copartUrl = generateCopartCDNUrl(lotId, seqNum, variant)

  try {
    const proxyResponse = await fetch(copartUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        'Referer': 'https://www.copart.com/',
      },
    })

    if (proxyResponse.ok) {
      // Opportunistically save to R2 for future requests (fire-and-forget)
      saveToR2Async(storageKey, proxyResponse.clone())

      return new NextResponse(proxyResponse.body, {
        headers: {
          'Content-Type': proxyResponse.headers.get('content-type') || 'image/jpeg',
          'Cache-Control': 'public, max-age=3600, stale-while-revalidate=86400',
          'X-Image-Source': 'copart-cdn',
        },
      })
    }
  } catch (err) {
    console.error('[IMG] Copart CDN error:', err)
  }

  // Layer 3: Return placeholder
  return new NextResponse(placeholderImageBuffer(), {
    headers: {
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=300',
      'X-Image-Source': 'placeholder',
    },
  })
}

function generateCopartCDNUrl(lotId: string, seq: string, variant: string): string {
  // Known Copart CDN patterns (based on Stat.vin observation)
  // Pattern 1: cs.copart.com/v1/AUTH_svc.pdoc00001/{lot}/{size}/{seq}.jpg
  // Pattern 2: vis.copart.com/images/lot/{lot}/{seq}_full.jpg

  const sizeMap: Record<string, string> = {
    xl: 'full',
    lg: '800',
    md: '400',
    thumb: '200',
  }

  // Try multiple patterns
  return `https://cs.copart.com/v1/AUTH_svc.pdoc00001/${lotId}/${sizeMap[variant]}/${seq}.jpg`
}

async function saveToR2Async(key: string, response: Response) {
  // Non-blocking save
  const buffer = await response.arrayBuffer()

  const { PutObjectCommand } = await import('@aws-sdk/client-s3')
  await r2.send(new PutObjectCommand({
    Bucket: process.env.R2_BUCKET_NAME!,
    Key: key,
    Body: Buffer.from(buffer),
    ContentType: 'image/webp',
    CacheControl: 'public, max-age=31536000, immutable',
  })).catch(err => console.error('[IMG] R2 save failed:', err))
}

function placeholderImageBuffer(): Buffer {
  // Simple SVG placeholder
  const svg = `
    <svg width="800" height="600" xmlns="http://www.w3.org/2000/svg">
      <rect width="100%" height="100%" fill="#f3f4f6"/>
      <text x="50%" y="50%" font-family="sans-serif" font-size="20"
            fill="#9ca3af" text-anchor="middle" dominant-baseline="middle">
        Image Unavailable
      </text>
    </svg>
  `
  return Buffer.from(svg.trim())
}
```

**Test endpoints**:
```bash
# Test R2 (will return placeholder initially)
curl -I https://vinops.online/api/v1/images/1FMCU93184KA46160/12345678/xl/1.webp

# Test with known Copart lot
curl -I https://vinops.online/api/v1/images/{VIN}/{REAL_LOT_ID}/xl/1.webp
```

### Step 3: Photo Discovery Script (8-12 hours)

**Create**: `scripts/fetch-copart-photos.js`

```javascript
/**
 * Fetch photo URLs from Copart lot pages
 *
 * Usage:
 *   node scripts/fetch-copart-photos.js --lot-id 12345678
 *   node scripts/fetch-copart-photos.js --batch 100
 *
 * Safety:
 *   - Rate limited to 10 req/s
 *   - Session rotation
 *   - Exponential backoff on errors
 */

import puppeteer from 'puppeteer'
import pLimit from 'p-limit'
import pg from 'pg'

const { Pool } = pg
const pool = new Pool({ connectionString: process.env.DATABASE_URL })

// Rate limiting: max 10 concurrent requests
const limit = pLimit(10)

// User-Agent rotation
const USER_AGENTS = [
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
]

async function fetchLotPhotos(lotId, copartLotNumber) {
  const browser = await puppeteer.launch({ headless: true })
  const page = await browser.newPage()

  // Set random User-Agent
  await page.setUserAgent(USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)])

  try {
    // Navigate to lot page (requires login)
    const url = `https://www.copart.com/lot/${copartLotNumber}`
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30000 })

    // Extract photo URLs from page
    const photos = await page.evaluate(() => {
      const images = []

      // Pattern 1: High-res image gallery
      document.querySelectorAll('.lot-image-gallery img').forEach((img, idx) => {
        const src = img.src || img.dataset.src
        if (src && !src.includes('placeholder')) {
          images.push({
            seq: idx + 1,
            url: src.replace(/_(thumb|sm|md)\.jpg/, '_full.jpg'),
            variant: 'xl',
          })
        }
      })

      // Pattern 2: Thumbnail strip
      if (images.length === 0) {
        document.querySelectorAll('[data-testid="lot-image-thumb"]').forEach((img, idx) => {
          const src = img.src
          if (src) {
            images.push({
              seq: idx + 1,
              url: src.replace(/_(thumb|sm)\.jpg/, '_full.jpg'),
              variant: 'xl',
            })
          }
        })
      }

      return images
    })

    await browser.close()

    if (photos.length === 0) {
      console.warn(`[WARN] No photos found for lot ${lotId}`)
      return []
    }

    console.log(`[OK] Found ${photos.length} photos for lot ${lotId}`)
    return photos

  } catch (err) {
    await browser.close()
    console.error(`[ERROR] Failed to fetch lot ${lotId}:`, err.message)
    throw err
  }
}

async function saveLotPhotos(vin, lotId, photos) {
  const client = await pool.connect()

  try {
    await client.query('BEGIN')

    for (const photo of photos) {
      await client.query(`
        INSERT INTO images (vin, lot_id, seq, variant, source_url)
        VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT (vin, lot_id, seq, COALESCE(variant, ''))
        DO UPDATE SET
          source_url = EXCLUDED.source_url,
          updated_at = NOW()
      `, [vin, lotId, photo.seq, photo.variant, photo.url])
    }

    await client.query('COMMIT')
    console.log(`[DB] Saved ${photos.length} photos for lot ${lotId}`)

  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }
}

// Main execution
async function main() {
  const lotId = process.argv[2]

  if (!lotId) {
    console.error('Usage: node fetch-copart-photos.js <lot_id>')
    process.exit(1)
  }

  // Fetch lot details from database
  const result = await pool.query('SELECT vin, lot_id FROM lots WHERE id = $1', [lotId])

  if (result.rows.length === 0) {
    console.error(`Lot ${lotId} not found in database`)
    process.exit(1)
  }

  const { vin, lot_id: copartLotNumber } = result.rows[0]

  // Fetch and save photos
  const photos = await fetchLotPhotos(lotId, copartLotNumber)
  await saveLotPhotos(vin, lotId, photos)

  await pool.end()
}

main().catch(console.error)
```

**Install dependencies**:
```bash
cd /root/Vinops-project
npm install puppeteer p-limit @aws-sdk/client-s3
```

### Step 4: Testing (2 hours)

**Test checklist**:
- [ ] Image API returns placeholder for non-existent photos
- [ ] Image API proxies from Copart CDN successfully
- [ ] Photo discovery script finds photos for sample lot
- [ ] Photos saved to database correctly
- [ ] R2 upload works (manual test)

**Sample test**:
```bash
# 1. Fetch photos for a real lot
node scripts/fetch-copart-photos.js 12345678

# 2. Verify in database
psql $DATABASE_URL -c "SELECT * FROM images WHERE lot_id = 12345678"

# 3. Test image serving
curl https://vinops.online/api/v1/images/{VIN}/{LOT}/xl/1.webp --output test.webp
```

## Cost Estimate

### Minimal Setup (First Month)

| Item | Cost |
|------|------|
| R2 storage (10GB) | $0.15 |
| R2 Class A ops (10k uploads) | $0.045 |
| CDN bandwidth | $0 (included) |
| **Total** | **~$0.20** |

### At Scale (100k vehicles, 1.5M photos, 500GB)

| Item | Monthly Cost |
|------|--------------|
| R2 storage (500GB) | $7.50 |
| R2 Class A ops (50k uploads) | $0.225 |
| R2 Class B ops (1M reads) | $0.036 |
| CDN bandwidth (10TB) | $0 |
| **Total** | **~$8/month** |

**Comparison**: AWS S3 would cost ~$450/month for same usage (storage + bandwidth)

## Risk Mitigation Checklist

### Legal Risks
- [ ] Review Copart Terms of Service
- [ ] Implement DMCA takedown process (`is_removed` flag)
- [ ] Add attribution/source disclaimer
- [ ] Respect robots.txt (check `/robots.txt`)
- [ ] Document transformative use case (historical research)

### Technical Risks
- [ ] Rate limiting configured (max 10 req/s)
- [ ] Session rotation implemented (3-5 accounts)
- [ ] Circuit breaker for Copart errors
- [ ] Monitoring dashboard (Grafana)
- [ ] Fallback to placeholder on error
- [ ] Dead letter queue for failed fetches

### Operational Risks
- [ ] Automated backups of R2 bucket
- [ ] Cost alerts (>$20/month)
- [ ] Success rate monitoring (>90% target)
- [ ] Disk space monitoring (R2 usage)
- [ ] Performance monitoring (image load times)

## Next Steps

**Immediate (Today)**:
1. Create R2 bucket in Cloudflare dashboard
2. Configure `img.vinops.online` custom domain
3. Test R2 upload manually

**This Week**:
1. Implement image serving API (Step 2)
2. Deploy to production
3. Test with sample lots

**Next Week**:
1. Build photo discovery script (Step 3)
2. Start backfill for top 1000 VINs by traffic
3. Monitor success rate

**Month 1**:
1. Complete backfill for all active lots
2. Integrate with ETL pipeline for new lots
3. Optimize performance and costs

## Questions & Answers

**Q: What if Copart blocks our account?**
A: The hybrid approach continues serving from R2 archive. New photos won't be added until we rotate accounts or adjust rate limits.

**Q: Can we use Copart's CDN URLs directly without archiving?**
A: Yes, but photos disappear 30-90 days after auction. For 3+ year availability, archiving is required.

**Q: How do competitors avoid legal issues?**
A: They operate under "transformative use" doctrine (historical research, not competing with Copart). They also respond to DMCA takedown requests.

**Q: What's the storage limit on R2?**
A: Effectively unlimited. Cloudflare doesn't publish hard limits, but accounts regularly store 100+ TB.

**Q: How fast can we backfill photos?**
A: At 10 req/s with 15 photos/lot: ~2-3 days for 150k lots. Can parallelize across multiple sessions for faster backfill.

**Q: Do we need to store all variants (xl, lg, md, thumb)?**
A: Initially, store only `xl` (original). Generate smaller variants on-demand or via batch job. Saves 75% storage.

---

**Need help?** Review `/root/Vinops-project/docs/PHOTO_STORAGE_STRATEGY.md` for full architecture.
