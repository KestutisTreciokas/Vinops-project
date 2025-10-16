# Photo Storage Strategy for Vinops

**Status**: Planning
**Created**: 2025-10-16
**Sprint**: S3 - Photo Management

## Executive Summary

This document outlines the strategy for acquiring, storing, and serving vehicle auction photos to provide long-term access (3+ years) while minimizing storage costs and legal/technical risks.

## Background

### Business Requirements

1. **Long-term availability**: Users search for vehicles 3+ years after auction
2. **Cost efficiency**: Minimize storage costs for millions of photos
3. **Risk mitigation**: Avoid Copart account blocking
4. **Legal compliance**: Operate within acceptable industry norms
5. **Performance**: Fast image delivery to users

### Current State

- **Database**: `images` table exists with proper structure (vin, lot_id, seq, variant, source_url, storage_key, content_hash)
- **Storage**: Cloudflare R2 bucket configured (`vinops-prod`)
- **CDN**: Cloudflare CDN available via `img.vinops.online`
- **Data Source**: Copart CSV provides lot metadata but NO photo URLs

### Industry Analysis

Competitors (Stat.vin, Bidfax, AutoAstat) use two approaches:

1. **Archive copies**: Download and store photos on own infrastructure
2. **Direct CDN links**: Generate URLs to Copart CDN (cs.copart.com)

**Observation**: Most successful services use archival storage due to:
- Copart deletes photos after auction ends (~30-90 days)
- Unreliable direct CDN access for sold lots
- Long-term availability requirement

## Recommended Architecture

### Hybrid Multi-Layer Strategy

```
┌─────────────────────────────────────────────────────────┐
│                    User Request                          │
│                 GET /img/{vin}/{lot}/{seq}              │
└──────────────────────┬──────────────────────────────────┘
                       │
                       ▼
          ┌────────────────────────┐
          │   CDN Edge (Cloudflare) │
          │    img.vinops.online    │
          └────────┬───────────────┘
                   │
                   ▼
          ┌────────────────────────┐
          │  Layer 1: R2 Storage    │  ← Primary (archived)
          │  Check storage_key      │
          └────────┬───────────────┘
                   │ miss
                   ▼
          ┌────────────────────────┐
          │ Layer 2: Copart CDN     │  ← Fallback (direct link)
          │  cs.copart.com          │
          └────────┬───────────────┘
                   │ miss
                   ▼
          ┌────────────────────────┐
          │ Layer 3: Placeholder    │  ← Graceful degradation
          │  "Image unavailable"    │
          └────────────────────────┘
```

### Storage Structure

**R2 Bucket Organization**:
```
vinops-prod/
├── copart/
│   ├── {vin}/
│   │   ├── {lot_id}/
│   │   │   ├── xl/           # Extra large (1600px)
│   │   │   │   ├── 1.webp
│   │   │   │   ├── 2.webp
│   │   │   │   └── ...
│   │   │   ├── lg/           # Large (800px)
│   │   │   ├── md/           # Medium (400px)
│   │   │   └── thumb/        # Thumbnail (200px)
│   │   └── {lot_id_2}/
│   └── ...
└── iaai/                     # Future: IAAI support
```

**Database Schema** (already exists):
```sql
images (
  id BIGSERIAL PRIMARY KEY,
  vin TEXT NOT NULL,
  lot_id BIGINT REFERENCES lots(id),
  seq INTEGER NOT NULL,                    -- Photo sequence (1-20)
  variant TEXT,                            -- 'xl', 'lg', 'md', 'thumb'
  storage_key TEXT,                        -- R2 key: copart/{vin}/{lot}/xl/1.webp
  source_url TEXT,                         -- Original Copart URL
  width INTEGER,
  height INTEGER,
  bytes BIGINT,
  content_hash TEXT,                       -- SHA256 for deduplication
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  is_removed BOOLEAN DEFAULT FALSE,        -- Soft delete for DMCA/removal requests

  UNIQUE (vin, lot_id, seq, COALESCE(variant, ''))
)
```

## Implementation Phases

### Phase 1: Photo Discovery & Download Pipeline (Week 1)

**Goal**: Discover photo URLs from Copart and download to R2

**Components**:

1. **Photo URL Discovery**
   - Source: Copart lot detail pages
   - Method: Authenticated scraper with rate limiting
   - Input: lot_id from CSV ingestion
   - Output: Array of photo URLs

2. **Download & Processing Worker**
   - Download original images from Copart
   - Generate multiple variants (xl, lg, md, thumb)
   - Calculate content_hash for deduplication
   - Upload to R2 with proper keys
   - Record metadata in `images` table

3. **Rate Limiting & Safety**
   - Max 10 requests/second to Copart
   - Rotate User-Agent strings
   - Use session pooling (3-5 active sessions)
   - Exponential backoff on errors
   - Circuit breaker pattern

**Deliverables**:
- `scripts/fetch-copart-photos.js` - Photo discovery script
- `scripts/workers/photo-processor.js` - Download & resize worker
- `docs/PHOTO_SCRAPING_PROTOCOL.md` - Safety guidelines

### Phase 2: Image Serving API (Week 1-2)

**Goal**: Serve photos via CDN with fallback layers

**Components**:

1. **Image Proxy Endpoint**
   ```
   GET /api/v1/images/{vin}/{lot_id}/{seq}?variant=xl
   GET /img/{vin}/{lot_id}/{seq}.webp  # CDN-friendly
   ```

2. **Serving Logic**:
   ```javascript
   async function serveImage(vin, lotId, seq, variant = 'xl') {
     // Layer 1: Check R2 storage
     const storageKey = `copart/${vin}/${lotId}/${variant}/${seq}.webp`
     const r2Object = await r2.get(storageKey)
     if (r2Object) {
       return r2Object.body // Cache-Control: max-age=31536000
     }

     // Layer 2: Try Copart CDN direct link
     const copartUrl = await generateCopartCDNUrl(lotId, seq)
     const proxyResponse = await fetch(copartUrl)
     if (proxyResponse.ok) {
       // Opportunistically save to R2 for future requests
       await saveToR2(storageKey, proxyResponse.body)
       return proxyResponse.body // Cache-Control: max-age=3600
     }

     // Layer 3: Return placeholder
     return placeholderImage() // Cache-Control: max-age=300
   }
   ```

3. **CDN Configuration**:
   - Cloudflare R2 Public Access Domain: `img.vinops.online`
   - Cache-Control headers:
     - R2 images: `max-age=31536000, immutable`
     - Proxied: `max-age=3600, stale-while-revalidate=86400`
     - Placeholder: `max-age=300`

**Deliverables**:
- `frontend/src/app/api/v1/images/[...path]/route.ts` - Image API
- Cloudflare R2 public bucket configuration
- CDN domain setup

### Phase 3: Backfill Existing Data (Week 2)

**Goal**: Download photos for all existing lots in database

**Process**:
1. Query all lots without images: `SELECT lot_id FROM lots WHERE id NOT IN (SELECT DISTINCT lot_id FROM images)`
2. Prioritize by:
   - Active lots (status='active')
   - Recently updated lots (updated_at DESC)
   - Lots with recent user views
3. Process in batches of 100 lots/hour
4. Monitor success rate and adjust

**Deliverables**:
- `scripts/backfill-photos.js` - Backfill orchestrator
- Database migration to track backfill status

### Phase 4: Incremental Updates (Week 3)

**Goal**: Automatically fetch photos for new lots from CSV

**Integration Point**: Modify existing ETL pipeline

```javascript
// In scripts/ingest-copart-csv.js
async function processLot(lotData) {
  // Existing: Insert into lots table
  const lot = await insertLot(lotData)

  // NEW: Queue photo fetch job
  await queuePhotoFetch({
    lot_id: lot.id,
    vin: lot.vin,
    priority: 'normal'
  })
}
```

**Deliverables**:
- ETL pipeline modification
- Job queue integration

## Risk Mitigation

### Legal Risks

**Risk**: Copyright/ToS violation for scraping photos

**Mitigation**:
1. **Transformative Use Defense**: Archive for historical research, not competition with Copart auctions
2. **Industry Norm**: Stat.vin, Bidfax, Carfax all archive photos
3. **DMCA Compliance**: `is_removed` flag for takedown requests
4. **Robots.txt Respect**: Only scrape pages allowed by robots.txt
5. **Terms of Service**: Review Copart ToS (acknowledge Image License Agreement applies)

**Precedent**: No known legal action against Stat.vin/Bidfax (operating 5+ years)

### Technical Risks

**Risk**: Copart account blocking

**Mitigation**:
1. **Rate Limiting**: Max 10 req/s per session, 30 req/min per IP
2. **Session Rotation**: 3-5 member accounts with distributed scraping
3. **User-Agent Rotation**: Mimic real browsers
4. **Headers**: Include Referer, Accept-Language, Cookie
5. **Timing Jitter**: Random delays between requests (500ms-2000ms)
6. **Fallback**: Continue serving from R2 archive if blocked

**Risk**: Storage costs spiral

**Mitigation**:
1. **R2 Pricing**: ~$15/month per 1TB (extremely cheap)
2. **Compression**: WebP format (50-80% smaller than JPEG)
3. **Variants**: Store only xl (original) + thumb initially
4. **Lifecycle**: Archive old photos to Glacier-equivalent after 2 years
5. **Deduplication**: Use content_hash to avoid duplicate storage

**Estimate**: 150k lots × 15 photos × 300KB/photo ≈ 675GB ≈ $10/month

### Operational Risks

**Risk**: Photo pipeline fails silently

**Mitigation**:
1. **Monitoring**: Track photo_fetch_success_rate metric
2. **Alerts**: Slack notification if success rate <80%
3. **Dead Letter Queue**: Retry failed fetches 3x with exponential backoff
4. **Dashboard**: Grafana panel showing:
   - Photos ingested per hour
   - R2 storage usage
   - Copart response codes
   - Backfill progress

## Cost Analysis

### Storage Costs (R2)

| Metric | Volume | Cost |
|--------|--------|------|
| Storage | 1 TB | $15/month |
| Class A operations (PUT) | 1M requests | $4.50 |
| Class B operations (GET) | 10M requests | $0.36 |
| **Egress** | Unlimited | **$0** (R2 advantage) |

**Annual estimate**: ~$250/year for 1TB

### Processing Costs

| Task | Volume | Time | Cost |
|------|--------|------|------|
| Photo download | 2M photos | 200 hours | CPU time only |
| Image resizing | 2M photos | 50 hours | CPU time only |
| R2 uploads | 8M files (4 variants) | N/A | $36 Class A ops |

**One-time backfill**: ~$100 in cloud compute

### Comparison with Alternatives

| Provider | 1TB Storage | Egress (10TB/mo) | Total/mo |
|----------|-------------|------------------|----------|
| **Cloudflare R2** | **$15** | **$0** | **$15** |
| AWS S3 | $23 | $900 | $923 |
| GCS | $20 | $800 | $820 |
| Azure Blob | $18 | $830 | $848 |

**Winner**: R2 by massive margin due to zero egress fees

## Success Metrics

### Key Performance Indicators

1. **Photo Coverage Rate**: `(lots_with_photos / total_lots) * 100`
   - Target: >95% for active lots
   - Target: >80% for all lots

2. **Image Availability**: `(successful_image_serves / total_image_requests) * 100`
   - Target: >99.5% (with fallbacks)

3. **Fetch Success Rate**: `(successful_photo_fetches / attempted_fetches) * 100`
   - Target: >90% (Copart blocking will happen occasionally)

4. **Storage Efficiency**: Average MB per vehicle
   - Target: <5MB per VIN (compressed WebP)

5. **User Engagement**: Click-through rate on photo galleries
   - Baseline: TBD after launch

### Monitoring Dashboard

**Grafana panels**:
- Photos ingested (last 24h, 7d, 30d)
- R2 storage used (GB) with trend
- Fetch success rate by hour
- Image CDN hit rate (R2 vs fallback)
- Top 10 VINs by photo views

## Timeline

| Phase | Duration | Deliverables |
|-------|----------|--------------|
| **Phase 1** | Week 1 | Photo discovery pipeline, download worker |
| **Phase 2** | Week 1-2 | Image serving API, CDN setup |
| **Phase 3** | Week 2 | Backfill existing lots (background job) |
| **Phase 4** | Week 3 | ETL integration for new lots |
| **Testing** | Week 3-4 | Load testing, monitoring setup |
| **Launch** | Week 4 | Production rollout |

**Total**: 4 weeks for MVP

## Next Steps

1. **Decision Approval**: Review and approve this strategy
2. **Environment Setup**: Create R2 bucket, configure CDN domain
3. **Proof of Concept**: Fetch photos for 100 sample lots
4. **Development**: Implement Phase 1-4 in order
5. **Monitoring**: Set up Grafana dashboards
6. **Documentation**: Update runbooks with photo operations

## Appendix

### Alternative Approaches Considered

**Approach A: Direct CDN Links Only** (Not Recommended)
- ❌ Photos disappear after auction ends
- ❌ No long-term availability (3+ years)
- ✅ Zero storage cost

**Approach B: On-Demand Fetch** (Not Recommended)
- ❌ Slow first-load experience
- ❌ Higher Copart request rate (more blocking risk)
- ✅ Lower storage cost
- ✅ Only store viewed photos

**Approach C: Hybrid Archive (Recommended)**
- ✅ Long-term availability
- ✅ Fast serving via CDN
- ✅ Fallback layers for resilience
- ⚠️ Moderate storage cost (~$15/TB/mo)

### References

- Cloudflare R2 Pricing: https://www.cloudflare.com/products/r2/
- Stat.vin Architecture Analysis: Based on frontend inspection
- Copart Image License Agreement: https://www.copart.com/
- Database Schema: `/root/Vinops-project/db/migrations/0005_images_table.sql`

---

**Document Owner**: Vinops Engineering
**Review Date**: 2025-10-16
**Next Review**: After Phase 1 completion
