# SSR VIN Pages Documentation

**Sprint:** S2 — SSR/SEO VIN & Catalog
**Milestone:** MS-S2-04 — SSR VIN Pages
**Route:** `/{lang}/vin/{VIN}`
**Date:** 2025-10-16
**Status:** ✅ **Implemented**

---

## Overview

Server-Side Rendered (SSR) VIN pages provide SEO-optimized vehicle detail pages with rich metadata, structured data, and bilingual support. Pages are pre-rendered on the server with data fetched from the API v1 endpoint.

**Key Features:**
- ✅ Server-Side Rendering (SSR) with Next.js App Router
- ✅ Rich metadata (title, description, canonical, hreflang, Open Graph)
- ✅ JSON-LD structured data (Vehicle, Product, BreadcrumbList schemas)
- ✅ Bilingual support (EN/RU) with taxonomies integration
- ✅ 404 handling for non-existent VINs
- ✅ Open Graph images from primary lot photo
- ✅ ISR (Incremental Static Regeneration) with 60s revalidation

---

## URL Structure

**Pattern:** `/{lang}/vin/{VIN}`

**Examples:**
- English: `https://vinops.online/en/vin/1HGBH41JXMN109186`
- Russian: `https://vinops.online/ru/vin/1HGBH41JXMN109186`

**VIN Format:**
- 11-17 alphanumeric characters
- Automatically uppercased
- Invalid VINs return 404

---

## Implementation

### File Structure

```
frontend/src/app/[lang]/vin/[vin]/
├── page.tsx              # Main VIN page component (SSR)
├── _api.ts               # Server-side API fetching utilities
├── _SeoVinJsonLd.tsx     # JSON-LD structured data component
├── layout.tsx            # Layout wrapper
├── error.tsx             # Error boundary
├── loading.tsx           # Loading skeleton
└── seo.ts                # SEO utilities (legacy)
```

### Core Components

**1. `page.tsx`** — Main VIN page component
- Fetches vehicle data from API v1 endpoint
- Generates rich metadata (title, description, Open Graph)
- Returns 404 for non-existent VINs
- Renders vehicle details, gallery, specs, lot info, history

**2. `_api.ts`** — Server-side API utilities
- `fetchVehicleDetails()` — Fetches from `/api/v1/vehicles/{vin}`
- `transformVehicleData()` — Transforms API response to component format
- 60s ISR revalidation

**3. `_SeoVinJsonLd.tsx`** — JSON-LD component
- Vehicle schema with full specifications
- Product schema for auction listings
- BreadcrumbList schema for navigation
- Server-rendered (no client-side JS)

---

## Metadata Generation

### Dynamic Metadata (`generateMetadata`)

**Rich Title:**
```
2015 Toyota Camry — VIN 1HGBH41JXMN109186
```

**Rich Description:**
```
2015 Toyota Camry with VIN 1HGBH41JXMN109186. View photos, specifications, auction details and sale history.
```

**Canonical URL:**
```
https://vinops.online/en/vin/1HGBH41JXMN109186
```

**Alternate Languages (hreflang):**
```html
<link rel="alternate" href="https://vinops.online/en/vin/1HGBH41JXMN109186" hreflang="en" />
<link rel="alternate" href="https://vinops.online/ru/vin/1HGBH41JXMN109186" hreflang="ru" />
<link rel="alternate" href="https://vinops.online/en/vin/1HGBH41JXMN109186" hreflang="x-default" />
```

**Open Graph:**
```html
<meta property="og:url" content="https://vinops.online/en/vin/1HGBH41JXMN109186" />
<meta property="og:title" content="2015 Toyota Camry — VIN 1HGBH41JXMN109186 — vinops" />
<meta property="og:description" content="..." />
<meta property="og:type" content="website" />
<meta property="og:image" content="https://img.vinops.online/copart/1HGBH41JXMN109186/12345678/xl/1.webp" />
```

**Robots:**
```html
<meta name="robots" content="index, follow" />
```

---

## JSON-LD Structured Data

### Vehicle Schema

```json
{
  "@context": "https://schema.org",
  "@type": "Vehicle",
  "name": "2015 Toyota Camry",
  "vehicleIdentificationNumber": "1HGBH41JXMN109186",
  "url": "https://vinops.online/en/vin/1HGBH41JXMN109186",
  "inLanguage": "en",
  "vehicleModelDate": "2015",
  "manufacturer": {
    "@type": "Organization",
    "name": "Toyota"
  },
  "model": "Camry",
  "bodyType": "Sedan",
  "fuelType": "Gasoline",
  "driveWheelConfiguration": "Front-Wheel Drive (FWD)",
  "vehicleEngine": {
    "@type": "EngineSpecification",
    "name": "2.5L I4"
  },
  "mileageFromOdometer": {
    "@type": "QuantitativeValue",
    "value": 85000,
    "unitCode": "SMI"
  },
  "color": "Black"
}
```

### Product Schema

```json
{
  "@context": "https://schema.org",
  "@type": "Product",
  "name": "2015 Toyota Camry",
  "description": "2015 Toyota Camry with VIN 1HGBH41JXMN109186. Front End Damage vehicle. Active for Sale.",
  "sku": "1HGBH41JXMN109186",
  "image": "https://img.vinops.online/copart/1HGBH41JXMN109186/12345678/xl/1.webp",
  "offers": {
    "@type": "Offer",
    "price": 8500,
    "priceCurrency": "USD",
    "availability": "https://schema.org/InStock",
    "url": "https://vinops.online/en/vin/1HGBH41JXMN109186"
  }
}
```

### BreadcrumbList Schema

```json
{
  "@context": "https://schema.org",
  "@type": "BreadcrumbList",
  "itemListElement": [
    {
      "@type": "ListItem",
      "position": 1,
      "name": "Home",
      "item": "https://vinops.online/en"
    },
    {
      "@type": "ListItem",
      "position": 2,
      "name": "VIN Search",
      "item": "https://vinops.online/en/cars"
    },
    {
      "@type": "ListItem",
      "position": 3,
      "name": "2015 Toyota Camry",
      "item": "https://vinops.online/en/vin/1HGBH41JXMN109186"
    }
  ]
}
```

---

## Data Flow

### 1. Request Flow

```
User → /{lang}/vin/{VIN}
  ↓
Next.js SSR (page.tsx)
  ↓
fetchVehicleDetails(VIN, lang)
  ↓
GET /api/v1/vehicles/{VIN}
  ↓
PostgreSQL (vehicles + lots + images + sale_events)
  ↓
API Response (VehicleDetailsResponse)
  ↓
transformVehicleData()
  ↓
Component Props (specs, lot, photos, history)
  ↓
Rendered HTML + JSON-LD + Metadata
```

### 2. Caching Strategy

**ISR (Incremental Static Regeneration):**
- Revalidate every 60 seconds
- Stale-while-revalidate pattern
- Background regeneration

**API Caching:**
```typescript
fetch(url, {
  next: { revalidate: 60 },
})
```

**Benefits:**
- Fast page loads (served from cache)
- Fresh data (regenerated every 60s)
- SEO-friendly (pre-rendered HTML)

---

## Error Handling

### VIN Not Found (404)

When VIN doesn't exist in database:

```typescript
if (!vehicleData) {
  notFound()  // Returns Next.js 404 page
}
```

**Behavior:**
- Returns 404 HTTP status
- Shows default Next.js 404 page
- No error logged (expected behavior)

### API Errors (500)

When API is unavailable:

```typescript
catch (error) {
  console.error(`[SSR] Failed to fetch VIN ${vin}:`, error)
  return null  // Treated as 404
}
```

**Behavior:**
- Logged to console
- Treated as VIN not found
- Returns 404 to user

---

## Bilingual Support

### Language Detection

Language is determined by URL parameter `{lang}`:

```
/en/vin/1HGBH41JXMN109186  →  lang = 'en'
/ru/vin/1HGBH41JXMN109186  →  lang = 'ru'
```

### Taxonomy Labels

API automatically returns labels in requested language:

**English:**
```json
{
  "body": "SEDAN",
  "bodyLabel": "Sedan",
  "status": "active",
  "statusLabel": "Active for Sale"
}
```

**Russian:**
```json
{
  "body": "SEDAN",
  "bodyLabel": "Седан",
  "status": "active",
  "statusLabel": "Активный лот"
}
```

### UI Text

Translation helper function:

```typescript
const t = (en: string, ru: string) => (lang === 'ru' ? ru : en)

t('Up-to-date lot info', 'Актуальная информация по лоту')
```

---

## SEO Optimization

### Page Speed

- ✅ Server-Side Rendering (no client-side data fetching)
- ✅ ISR caching (60s revalidation)
- ✅ Optimized images (WebP format, lazy loading)
- ✅ Minimal JavaScript (hydration only)

### Crawlability

- ✅ Pre-rendered HTML (visible to search engines)
- ✅ Canonical URLs (no duplicate content)
- ✅ hreflang tags (language alternates)
- ✅ robots meta (index, follow)

### Rich Snippets

- ✅ Vehicle schema → Rich results in Google
- ✅ Product schema → Price, availability in SERPs
- ✅ BreadcrumbList → Breadcrumbs in SERPs
- ✅ Open Graph → Social media previews

### Core Web Vitals

**Expected Performance:**
- LCP (Largest Contentful Paint): <2.5s
- FID (First Input Delay): <100ms
- CLS (Cumulative Layout Shift): <0.1

---

## Testing

### Manual Testing

**Test 1: Valid VIN (English)**
```bash
curl -I "http://localhost:3000/en/vin/1HGBH41JXMN109186"
# Expected: 200 OK
```

**Test 2: Valid VIN (Russian)**
```bash
curl "http://localhost:3000/ru/vin/1HGBH41JXMN109186" | grep "Седан"
# Expected: Contains Russian labels
```

**Test 3: Invalid VIN (404)**
```bash
curl -I "http://localhost:3000/en/vin/INVALIDVIN123"
# Expected: 404 Not Found
```

**Test 4: JSON-LD Validation**
```bash
curl "http://localhost:3000/en/vin/1HGBH41JXMN109186" | grep "application/ld+json"
# Expected: Contains structured data
```

### SEO Testing

**Google Rich Results Test:**
```
https://search.google.com/test/rich-results?url=https://vinops.online/en/vin/1HGBH41JXMN109186
```

**Validator Tools:**
- Schema.org Validator: https://validator.schema.org/
- Google Search Console: Rich Results report
- Lighthouse SEO audit

---

## Known Limitations

1. **Mock Components** — Gallery, Specs, LotInfo, History components use mock data structure
   - **Impact:** API data transformed to match component format
   - **Fix:** Update components to use API response directly

2. **Incomplete Taxonomies** — Most CSV values don't have taxonomy matches
   - **Impact:** Labels often equal raw values (e.g., "REAR END" instead of "Rear End Damage")
   - **Fix:** Complete CSV→Taxonomy mapping in future sprint

3. **No Image Optimization** — Images served from external CDN without Next.js optimization
   - **Impact:** Larger image sizes, slower loading
   - **Fix:** Proxy images through Next.js Image component

4. **No Revalidation on Demand** — Pages revalidate every 60s, not on data updates
   - **Impact:** Data may be up to 60s stale
   - **Fix:** Implement on-demand revalidation with webhooks

---

## Future Enhancements

1. **Dynamic Sitemap** — Generate sitemap dynamically from database
2. **Image Optimization** — Serve images through Next.js Image component
3. **Social Share Cards** — Custom Open Graph images with vehicle info overlay
4. **AMP Pages** — Accelerated Mobile Pages for faster mobile loading
5. **Related Listings** — "Similar vehicles" section with API search
6. **User Reviews** — Allow users to add notes/reviews to VINs

---

## References

- **Implementation:** `frontend/src/app/[lang]/vin/[vin]/page.tsx`
- **API Utilities:** `frontend/src/app/[lang]/vin/[vin]/_api.ts`
- **JSON-LD:** `frontend/src/app/[lang]/vin/[vin]/_SeoVinJsonLd.tsx`
- **API Types:** `contracts/types/api-v1.ts`
- **API Documentation:** `docs/API_v1_AUDIT.md`
- **Next.js Metadata:** https://nextjs.org/docs/app/api-reference/functions/generate-metadata
- **Schema.org Vehicle:** https://schema.org/Vehicle
- **Schema.org Product:** https://schema.org/Product
