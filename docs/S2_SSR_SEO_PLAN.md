# S2 — SSR/SEO VIN & Catalog: Sprint Plan

**Sprint:** S2 — SSR/SEO VIN & Catalog
**Date:** 2025-10-16
**Prerequisites:** S1B ETL complete (automated ingestion, taxonomies, core upsert)
**Status:** 📋 PLANNING

---

## Executive Summary

**Goal:** Restore public-facing site with SSR pages (VIN cards, catalog), complete SEO infrastructure (robots/sitemaps/VIN shards), security headers, and verified API v1 contract.

**Key Deliverables:**
- SSR VIN pages: `/{lang}/vin/{VIN}` with canonical/hreflang/JSON-LD
- SSR catalog: `/{lang}/cars` with filters and pagination
- Metadata routes: `/robots.txt`, `/sitemap.xml`, VIN shards ≤50k
- Security headers: HSTS, CSP (report-only), X-CTO, Referrer-Policy, frame-ancestors
- `/health` endpoint with version/timestamp
- API v1 audit and restoration (if missing)

**Out of Scope:**
- Images module (R2/derivatives/watermarks) → S3
- Sales finalizer (PENDING_RESULT → SOLD/NO_SALE) → S4

---

## Mini-Sprints Breakdown

### MS-S2-01: Restore Metadata Routes (robots/sitemap + VIN shards scaffold)

**Objective:** Implement Next.js metadata routes for robots.txt, sitemap.xml, and VIN shard infrastructure

**Inputs:**
- SSOT Index path structure
- SEO rules: VIN shards ≤50k per file, `Cache-Control: no-store`
- Existing `docs/SEO.md` (currently shows static-only sitemaps)

**Outputs:**
- `frontend/src/app/robots.ts` — Does not block `/vin/`, contains `Sitemap:` line
- `frontend/src/app/sitemap.ts` — Index pointing to `/sitemaps/vin.xml`
- `frontend/src/app/sitemaps/vin.xml/route.ts` — VIN shard index (lists en-0, ru-0, etc.)
- Shard examples: `frontend/src/app/sitemaps/vin/en-0.xml/route.ts`
- `docs/SEO.md` update — VIN shard generation rules, lastmod computation

**Tasks:**
1. Create `robots.ts`:
   ```typescript
   export default function robots() {
     return {
       rules: {
         userAgent: '*',
         allow: '/',
         disallow: ['/api/', '/admin/'],
       },
       sitemap: 'https://vinops.online/sitemap.xml',
     };
   }
   ```

2. Create `sitemap.ts`:
   ```typescript
   export default function sitemap() {
     return [
       { url: 'https://vinops.online/en', lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
       { url: 'https://vinops.online/ru', lastModified: new Date(), changeFrequency: 'daily', priority: 1.0 },
       { url: 'https://vinops.online/en/cars', lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
       { url: 'https://vinops.online/ru/cars', lastModified: new Date(), changeFrequency: 'hourly', priority: 0.9 },
       // Link to VIN shard index
       { url: 'https://vinops.online/sitemaps/vin.xml', lastModified: new Date() },
     ];
   }
   ```

3. Create VIN shard index (`sitemaps/vin.xml/route.ts`):
   ```typescript
   export async function GET() {
     // Query DB for total VIN count
     const vinCount = await db.query('SELECT COUNT(*) FROM vehicles');
     const shardsPerLang = Math.ceil(vinCount / 50000);

     const shards = [];
     for (const lang of ['en', 'ru']) {
       for (let i = 0; i < shardsPerLang; i++) {
         shards.push(`https://vinops.online/sitemaps/vin/${lang}-${i}.xml`);
       }
     }

     const xml = `<?xml version="1.0" encoding="UTF-8"?>
     <sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
       ${shards.map(url => `<sitemap><loc>${url}</loc></sitemap>`).join('\n')}
     </sitemapindex>`;

     return new Response(xml, {
       headers: { 'Content-Type': 'application/xml' },
     });
   }
   ```

4. Create shard route (`sitemaps/vin/[shard].xml/route.ts`):
   ```typescript
   export async function GET(req: Request, { params }: { params: { shard: string } }) {
     const [lang, indexStr] = params.shard.split('-');
     const index = parseInt(indexStr);
     const offset = index * 50000;

     const vins = await db.query(`
       SELECT vin, updated_at
       FROM vehicles
       ORDER BY vin
       LIMIT 50000 OFFSET $1
     `, [offset]);

     const xml = `<?xml version="1.0" encoding="UTF-8"?>
     <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"
             xmlns:xhtml="http://www.w3.org/1999/xhtml">
       ${vins.map(v => `
         <url>
           <loc>https://vinops.online/${lang}/vin/${v.vin}</loc>
           <lastmod>${v.updated_at.toISOString()}</lastmod>
           <changefreq>daily</changefreq>
           <priority>0.8</priority>
           <xhtml:link rel="alternate" hreflang="en" href="https://vinops.online/en/vin/${v.vin}" />
           <xhtml:link rel="alternate" hreflang="ru" href="https://vinops.online/ru/vin/${v.vin}" />
           <xhtml:link rel="alternate" hreflang="x-default" href="https://vinops.online/en/vin/${v.vin}" />
         </url>
       `).join('\n')}
     </urlset>`;

     return new Response(xml, {
       headers: {
         'Content-Type': 'application/xml',
         'Cache-Control': 'no-store',  // VIN shards always fresh
       },
     });
   }
   ```

5. Update `docs/SEO.md`:
   - VIN shard rules: ≤50k per file
   - lastmod: from `vehicles.updated_at` OR `lots.source_updated_at` (whichever is newer)
   - Cache policy: `no-store` for shards

**Acceptance Criteria:**
- [ ] `GET /robots.txt` → 200, contains `Sitemap:`
- [ ] `GET /sitemap.xml` → 200, contains VIN index link
- [ ] `GET /sitemaps/vin.xml` → 200, lists ≥1 shard per language
- [ ] `GET /sitemaps/vin/en-0.xml` → 200, contains ≤50k VINs
- [ ] `Cache-Control: no-store` header present on shards
- [ ] Alternate hreflang links present for each VIN

**Risks:**
- No VIN source → Use seed VINs for testing; document procedure for switching to DB source
- Performance: Large DB query → Add index on `vehicles.vin`, paginate efficiently

---

### MS-S2-02: Security Headers and /health

**Objective:** Enable security headers (HSTS, CSP, X-CTO, etc.) and create health endpoint

**Inputs:**
- DL-012 security header requirements
- Next.js middleware/config patterns

**Outputs:**
- `frontend/src/middleware.ts` or `next.config.js` headers config
- `frontend/src/app/health/route.ts` — Health check endpoint
- `docs/SECURITY_HEADERS.md` — Header policies and rationale

**Tasks:**
1. Create security headers in `next.config.js`:
   ```javascript
   module.exports = {
     async headers() {
       return [
         {
           source: '/:path*',
           headers: [
             { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains' },
             { key: 'X-Content-Type-Options', value: 'nosniff' },
             { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
             { key: 'X-Frame-Options', value: 'DENY' },
             { key: 'Content-Security-Policy', value: "default-src 'self'; script-src 'self' 'unsafe-inline'; report-uri /api/csp-report" },
             { key: 'Permissions-Policy', value: 'geolocation=(), microphone=(), camera=()' },
           ],
         },
       ];
     },
   };
   ```

2. Create `/health` endpoint:
   ```typescript
   // frontend/src/app/health/route.ts
   export async function GET() {
     const health = {
       status: 'ok',
       version: process.env.APP_VERSION || 'unknown',
       timestamp: new Date().toISOString(),
       uptime: process.uptime(),
     };

     return Response.json(health);
   }
   ```

3. Create `docs/SECURITY_HEADERS.md`:
   - HSTS: Force HTTPS for 1 year
   - CSP: Report-only mode initially (log violations, don't block)
   - X-CTO: Prevent MIME sniffing attacks
   - Referrer-Policy: Protect user privacy
   - X-Frame-Options: Prevent clickjacking

**Acceptance Criteria:**
- [ ] All pages return HSTS, X-CTO, Referrer-Policy, X-Frame-Options headers
- [ ] CSP header present (report-only mode)
- [ ] `GET /health` → 200 with JSON `{status, version, timestamp, uptime}`
- [ ] CSP violations logged to `/api/csp-report` (if any)

**Risks:**
- CSP too strict → blocks legitimate inline scripts
- Mitigation: Start with report-only, monitor violations, refine policy

---

### MS-S2-03: API v1 Audit and Contract Restoration

**Objective:** Verify API v1 existence; if missing, define OpenAPI v1 from scratch per SSOT

**Inputs:**
- `contracts/api/v1.mapping.md` (existing DTO mappings)
- `contracts/api/vin.read.md` (VIN read contract)
- `contracts/api/catalog.read.md` (catalog contract)

**Outputs:**
- `docs/API_v1_AUDIT.md` — Audit results and discrepancies
- `contracts/openapi.yaml` (v1) — Formal OpenAPI specification
- `docs/API_DTO.md` — DTO definitions (Vehicle, Lot, SaleEvent, ImageItem, SearchResponse)
- `docs/API_ERRORS.md` — Error codes and handling

**Tasks:**
1. Audit existing implementation:
   - Check if `frontend/src/app/api/v1/vehicles/[vin]/route.ts` exists
   - Check if `frontend/src/app/api/v1/search/route.ts` exists
   - Compare responses with SSOT contracts

2. If missing: Create OpenAPI v1 spec:
   ```yaml
   openapi: 3.0.3
   info:
     title: Vinops API
     version: 1.0.0
   paths:
     /api/v1/vehicles/{vin}:
       get:
         summary: Get vehicle by VIN
         parameters:
           - name: vin
             in: path
             required: true
             schema:
               type: string
               pattern: '^[A-HJ-NPR-Z0-9]{11,17}$'
         responses:
           '200':
             description: Vehicle found
             content:
               application/json:
                 schema:
                   $ref: '#/components/schemas/VehicleAggregate'
           '404':
             description: VIN not found
           '422':
             description: Invalid VIN format
     /api/v1/search:
       get:
         summary: Search vehicles/lots
         parameters:
           - name: make
             in: query
             schema:
               type: string
           - name: year
             in: query
             schema:
               type: integer
           - name: cursor
             in: query
             schema:
               type: string
         responses:
           '200':
             description: Search results
             content:
               application/json:
                 schema:
                   $ref: '#/components/schemas/SearchResponse'
   components:
     schemas:
       VehicleAggregate:
         type: object
         required: [vehicle, currentLot]
         properties:
           vehicle:
             $ref: '#/components/schemas/Vehicle'
           currentLot:
             $ref: '#/components/schemas/Lot'
           images:
             type: array
             items:
               $ref: '#/components/schemas/ImageItem'
           saleEvents:
             type: array
             items:
               $ref: '#/components/schemas/SaleEvent'
       Vehicle:
         type: object
         required: [vin]
         properties:
           vin:
             type: string
           year:
             type: integer
           make:
             type: string
           model:
             type: string
           # ... (full schema from v1.mapping.md)
   ```

3. Document decision: DL-010 — API v1 = SSOT; incompatible changes → /api/v2

**Acceptance Criteria:**
- [ ] OpenAPI v1 spec complete and validated (SwaggerHub or similar)
- [ ] If implementation exists → documented as conforming or non-conforming
- [ ] If implementation missing → OpenAPI adopted as SSOT
- [ ] DTOs documented with field types, nullability, constraints
- [ ] Error codes documented (200/400/404/410/422/429/500)

**Risks:**
- Implementation diverged from contract → breaking changes needed
- Mitigation: Version breaking changes as v2

---

### MS-S2-04: SSR VIN Pages (canonical/hreflang/JSON-LD + 404)

**Objective:** Implement server-side rendered VIN pages with full SEO metadata

**Inputs:**
- Route: `/{lang}/vin/{VIN}`
- SEO requirements: canonical, hreflang, JSON-LD (Vehicle + BreadcrumbList)
- VIN-404 behavior: SSR 200 with useful content (not 404) until data arrives

**Outputs:**
- `frontend/src/app/[lang]/vin/[vin]/page.tsx` — SSR VIN page
- `frontend/src/app/[lang]/vin/[vin]/opengraph-image.tsx` (optional, for OG images later)
- VIN decoder utility: `lib/vin-decoder.ts` (extract WMI, year from VIN)

**Tasks:**
1. Create SSR page:
   ```tsx
   // frontend/src/app/[lang]/vin/[vin]/page.tsx
   import { Metadata } from 'next';

   export async function generateMetadata({ params }: { params: { lang: string, vin: string } }): Promise<Metadata> {
     const { lang, vin } = params;
     const vehicle = await fetchVehicle(vin);

     const title = vehicle
       ? `${vehicle.year} ${vehicle.make} ${vehicle.model} ${vehicle.trim || ''} — VIN ${vin}`
       : `VIN ${vin} — Auction Vehicle Lookup`;

     const description = vehicle
       ? `View auction details for ${vehicle.year} ${vehicle.make} ${vehicle.model}. VIN: ${vin}.`
       : `VIN ${vin} lookup. Data pending or vehicle not yet available.`;

     return {
       title,
       description,
       alternates: {
         canonical: `https://vinops.online/${lang}/vin/${vin}`,
         languages: {
           en: `https://vinops.online/en/vin/${vin}`,
           ru: `https://vinops.online/ru/vin/${vin}`,
           'x-default': `https://vinops.online/en/vin/${vin}`,
         },
       },
     };
   }

   export default async function VINPage({ params }: { params: { lang: string, vin: string } }) {
     const { lang, vin } = params;
     const vehicle = await fetchVehicle(vin);

     if (!vehicle) {
       // Return 200 with useful content (not 404)
       return <VINPendingPage vin={vin} lang={lang} />;
     }

     return (
       <>
         <script
           type="application/ld+json"
           dangerouslySetInnerHTML={{
             __html: JSON.stringify({
               '@context': 'https://schema.org',
               '@type': 'Vehicle',
               vehicleIdentificationNumber: vehicle.vin,
               manufacturer: vehicle.make,
               model: vehicle.model,
               vehicleModelDate: vehicle.year,
             }),
           }}
         />
         <h1>{vehicle.year} {vehicle.make} {vehicle.model} {vehicle.trim}</h1>
         <div className="vin-chip">{vehicle.vin}</div>
         {/* Specifications section */}
       </>
     );
   }
   ```

2. Create VIN-pending page (200, not 404):
   ```tsx
   function VINPendingPage({ vin, lang }: { vin: string, lang: string }) {
     const decoded = decodeVIN(vin);  // Extract WMI, year, country

     return (
       <>
         <h1>{lang === 'ru' ? 'VIN' : 'VIN'} {vin}</h1>
         <p>{lang === 'ru'
           ? 'Данные по этому VIN ещё не получены или обновляются.'
           : 'Data for this VIN is pending or being updated.'
         }</p>
         <section>
           <h2>{lang === 'ru' ? 'Что мы знаем о VIN' : 'What we know from the VIN'}</h2>
           <ul>
             <li>{lang === 'ru' ? 'Производитель' : 'Manufacturer'}: {decoded.wmi}</li>
             <li>{lang === 'ru' ? 'Год модели' : 'Model Year'}: {decoded.year}</li>
             <li>{lang === 'ru' ? 'Страна' : 'Country'}: {decoded.country}</li>
           </ul>
         </section>
         {/* Internal links to similar VINs */}
       </>
     );
   }
   ```

3. JSON-LD:
   - Vehicle schema when data available
   - WebPage schema when data pending (avoid empty Vehicle)

**Acceptance Criteria:**
- [ ] `GET /{lang}/vin/{VIN}` → 200 (even if data not yet available)
- [ ] `<head>` contains canonical + hreflang (en/ru/x-default)
- [ ] JSON-LD present and valid (schema.org validator)
- [ ] VIN chip with copy button
- [ ] Specifications section with taxonomies (EN/RU labels)
- [ ] VIN-pending page shows decoded VIN info (WMI, year, country)

**Risks:**
- Soft-404 penalty → Mitigate with unique content per VIN (WMI decoder, internal links)

---

### MS-S2-05: SSR Catalog and Indexing Rules

**Objective:** Implement catalog page with filters, pagination, and noindex rules for complex queries

**Inputs:**
- Route: `/{lang}/cars`
- Filter parameters: make, year, status, auction_date, etc.
- Pagination: Keyset-based (cursor) for performance

**Outputs:**
- `frontend/src/app/[lang]/cars/page.tsx` — SSR catalog
- Noindex meta tag for complex queries (>2 filters or cursor present)

**Tasks:**
1. Create catalog page:
   ```tsx
   export async function generateMetadata({ searchParams }: { searchParams: Record<string, string> }): Promise<Metadata> {
     const hasComplexQuery = Object.keys(searchParams).filter(k => k !== 'lang').length > 2 || searchParams.cursor;

     return {
       title: 'Auction Vehicles Catalog',
       description: 'Browse salvage and auction vehicles.',
       robots: hasComplexQuery ? 'noindex,follow' : 'index,follow',
     };
   }

   export default async function CatalogPage({ params, searchParams }: { params: { lang: string }, searchParams: Record<string, string> }) {
     const { lang } = params;
     const results = await searchVehicles(searchParams);

     return (
       <>
         <h1>{lang === 'ru' ? 'Каталог авто' : 'Vehicles Catalog'}</h1>
         <FilterPanel lang={lang} />
         <LotGrid lots={results.items} lang={lang} />
         <Pagination cursor={results.nextCursor} />
       </>
     );
   }
   ```

2. Indexing rules:
   - Basic catalog (no filters): `index,follow`
   - 1-2 filters: `index,follow`
   - >2 filters OR cursor: `noindex,follow`

**Acceptance Criteria:**
- [ ] `GET /{lang}/cars` → 200 with lot grid
- [ ] Filters work (make, year, status)
- [ ] Pagination via cursor (keyset-based)
- [ ] Complex queries marked `noindex,follow`
- [ ] SSR rendering (not client-side)

---

### MS-S2-06: VIN Shards — lastmod and Data Binding

**Objective:** Compute `lastmod` for VIN shards and bind to database source

**Inputs:**
- `vehicles.updated_at` OR `lots.source_updated_at` (whichever is newer)
- Shard route from MS-S2-01

**Outputs:**
- Updated shard route with `lastmod` query
- `docs/SEO.md` update — lastmod computation rules

**Tasks:**
1. Update shard route query:
   ```typescript
   const vins = await db.query(`
     SELECT
       v.vin,
       GREATEST(v.updated_at, COALESCE(l.source_updated_at, v.updated_at)) AS lastmod
     FROM vehicles v
     LEFT JOIN lots l ON v.vin = l.vin
     ORDER BY v.vin
     LIMIT 50000 OFFSET $1
   `, [offset]);
   ```

2. Document in `docs/SEO.md`:
   - lastmod = MAX(vehicles.updated_at, lots.source_updated_at)
   - Rationale: Any change to vehicle or lot → update lastmod

**Acceptance Criteria:**
- [ ] VIN shards include `lastmod` for each URL
- [ ] lastmod reflects most recent update (vehicle OR lot)
- [ ] Rule documented in SEO.md

---

## Dependencies & Sequencing

**Critical Path:**
1. MS-S2-03 (API v1 Audit) → Enables data fetching for SSR
2. MS-S2-04 (SSR VIN Pages) → Requires API v1
3. MS-S2-01 (Metadata Routes) → Can run in parallel with S2-03
4. MS-S2-06 (VIN Shards lastmod) → Depends on S2-01

**Parallel Execution:**
- MS-S2-01 + MS-S2-02 (no dependencies)
- MS-S2-03 + MS-S2-05 (catalog independent of VIN pages)

---

## Acceptance Criteria — Sprint DoD

- [ ] SSR VIN pages: canonical/hreflang/JSON-LD present and valid
- [ ] VIN-404 behavior: 200 with decoded VIN info (not 404)
- [ ] Robots/sitemaps: All routes 200, VIN shards ≤50k, no-store header
- [ ] Security headers: HSTS, CSP, X-CTO, Referrer-Policy, XFO
- [ ] /health endpoint: 200 with JSON
- [ ] API v1: Contract verified or restored; OpenAPI v1 adopted
- [ ] Catalog: Filters work, noindex for complex queries
- [ ] VIN shards: lastmod computed from vehicles/lots

---

**Status:** 📋 PLANNING COMPLETE — Ready for implementation after S1B
