# ADR-001: Copart Final Bid & Outcome Detection Methods

**Status:** ✅ PROPOSED
**Date:** 2025-10-18
**Decision:** Hybrid approach (CSV backbone + JSON API for final bids)

---

## Context

Currently, our platform displays lot information from Copart CSV (updated every 15 min), but lacks:
- **Final sale prices** (CSV has no `final_bid` or `sale_price` field)
- **Lot outcomes** (Sold/Not Sold/On Approval status)
- **VIN history** (linking multiple sale attempts for same vehicle)

Users expect to see auction results to make informed purchasing decisions.

---

## Requirements

| Requirement | Priority | Details |
|------------|----------|---------|
| Final Bid Amount | P0 | Must capture actual sale price (not just current bid) |
| Lot Outcome Status | P0 | Sold / Not Sold / On Approval detection |
| VIN History | P1 | Link multiple attempts (relists) for same VIN |
| Backfill Historical Data | P1 | Retroactively process existing 124k+ lots |
| Data Freshness | P1 | Updates within 24h of auction close (real-time nice-to-have) |
| Legal Compliance | P0 | Respect Copart ToS, avoid abusive scraping |
| IP Safety | P0 | Minimize blocking risk (Cloudflare/Imperva) |
| Cost Efficiency | P1 | Minimize third-party API costs |

**Data Scale:**
- 124,886 active lots
- 72,626 upcoming lots
- ~55 MB CSV refreshed every 15 min
- Estimated 10k-20k auctions close daily (need verification)

---

## Method 1: CSV Diff + Event Store (Disappearance Heuristic)

### How It Works

1. Poll CSV every 15 min, compute SHA256 hash
2. Diff against previous version to detect:
   - **New lots** (appeared)
   - **Updated lots** (auction date changed, price updated)
   - **Removed lots** (disappeared)
3. Apply heuristics:
   - `auction_datetime_utc < NOW` AND lot disappeared → **likely Sold**
   - Lot reappears (same VIN, new lot ID, new date) → previous attempt was **Not Sold**
   - Lot disappeared, reserve present, reappears later → **On Approval → Not Sold**

### Architecture

```
┌─────────────────────────────────────────────────┐
│ CSV Poller (systemd timer, every 15 min)       │
│ ├─ Download from Copart                         │
│ ├─ Compute SHA256 hash                          │
│ ├─ If changed: store to /var/data/vinops/raw/  │
│ └─ Trigger: csv-diff.js                         │
└─────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│ CSV Diff Engine (csv-diff.js)                  │
│ ├─ Parse current + previous CSV                 │
│ ├─ Compute set difference (added/removed/changed)│
│ ├─ Emit events:                                 │
│ │  ├─ lot.appeared (new VIN + lot_id)          │
│ │  ├─ lot.disappeared (candidate for sold)     │
│ │  ├─ lot.relist (same VIN, new lot_id)        │
│ │  └─ lot.updated (price/date change)          │
│ └─ Write to: auction_events table               │
└─────────────────────────────────────────────────┘
              │
              ▼
┌─────────────────────────────────────────────────┐
│ Heuristic Engine (outcome-resolver.js)         │
│ ├─ Query: lots with auction_datetime < NOW-24h │
│ ├─ Check if lot disappeared from CSV            │
│ ├─ Check if VIN reappeared (relist detection)   │
│ ├─ Apply rules:                                 │
│ │  ├─ Disappeared + no relist → status=sold    │
│ │  ├─ VIN relist detected → prev status=not_sold│
│ │  └─ Reserve + disappeared → status=on_approval│
│ └─ Update: lots.outcome, lots.outcome_date      │
└─────────────────────────────────────────────────┘
```

### Data Model

```sql
-- Track all CSV changes as immutable events
CREATE TABLE auction_events (
  id SERIAL PRIMARY KEY,
  event_type VARCHAR(50) NOT NULL, -- 'lot.appeared', 'lot.disappeared', 'lot.relist', 'lot.updated'
  lot_external_id VARCHAR(50) NOT NULL,
  vin VARCHAR(17),
  event_timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  event_data JSONB NOT NULL, -- snapshot of lot data at event time
  csv_file_id INTEGER REFERENCES raw.csv_files(id)
);

-- Augment existing lots table
ALTER TABLE lots ADD COLUMN outcome VARCHAR(20); -- 'sold', 'not_sold', 'on_approval', 'unknown'
ALTER TABLE lots ADD COLUMN outcome_date TIMESTAMPTZ;
ALTER TABLE lots ADD COLUMN outcome_confidence DECIMAL(3,2); -- 0.00-1.00 (heuristic confidence)
ALTER TABLE lots ADD COLUMN final_bid_usd DECIMAL(12,2); -- NULL for this method
ALTER TABLE lots ADD COLUMN relist_count INTEGER DEFAULT 0;
ALTER TABLE lots ADD COLUMN previous_lot_id INTEGER REFERENCES lots(id); -- link to previous attempt

-- VIN history view
CREATE VIEW vin_auction_history AS
SELECT
  v.vin,
  l.id as lot_id,
  l.auction_datetime_utc,
  l.outcome,
  l.final_bid_usd,
  l.current_bid_usd,
  l.relist_count,
  ROW_NUMBER() OVER (PARTITION BY v.vin ORDER BY l.auction_datetime_utc) as attempt_number
FROM vehicles v
LEFT JOIN lots l ON l.vin = v.vin
ORDER BY v.vin, l.auction_datetime_utc;
```

### Pros

✅ **Fully Legal** - Uses official Copart CSV feed
✅ **Zero Blocking Risk** - No scraping, no API calls
✅ **Scales to 100k+ lots** - Diff algorithm is O(n log n)
✅ **Free** - No third-party costs
✅ **Reliable for Sold/Not Sold** - Disappearance is strong signal
✅ **Detects Relists** - VIN matching is deterministic

### Cons

❌ **No Final Bid** - CSV lacks sale price (only current_bid_usd)
❌ **Delayed Detection** - 15-min CSV refresh means 15-45 min lag
❌ **Heuristic Uncertainty** - "On Approval" requires waiting (1-7 days)
❌ **Edge Cases:**
   - Lot withdrawn by seller (not sold, but disappears forever)
   - CSV corruption/missing data (false positives)
   - VIN with multiple simultaneous lots (rare, but possible)

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| CSV format change | Low | High | Monitor schema changes, alert on parsing errors |
| False positives (disappeared = sold) | Medium | Medium | Confidence score, manual review queue |
| Copart blocks CSV access | Very Low | Critical | Use reasonable polling (15 min), official endpoint |

### Cost & Performance

- **Development:** 3-5 days (PoC exists, need event store + heuristics)
- **Infrastructure:** $0 (uses existing CSV pipeline)
- **Latency:** 15-45 min after auction close
- **Accuracy:** 85-90% for Sold/Not Sold, 60% for On Approval (requires validation)

---

## Method 2: Hidden JSON API (`/public/data/lotdetails/solr/{lotId}`)

### How It Works

1. Extract lot IDs from CSV
2. For each lot past auction date, make HTTP request:
   ```bash
   curl 'https://www.copart.com/public/data/lotdetails/solr/12345678' \
     -H 'User-Agent: Mozilla/5.0...' \
     -H 'Referer: https://www.copart.com/lot/12345678'
   ```
3. Parse JSON response:
   ```json
   {
     "lotDetails": {
       "ln": 12345678,
       "mkn": "TOYOTA",
       "la": 7344.0,  // LAST AMOUNT (final bid!)
       "cs": "SOLD",  // Current Status
       ...
     }
   }
   ```
4. Update `lots.final_bid_usd` and `lots.outcome`

### Architecture

```
┌─────────────────────────────────────────────────┐
│ Lot Scraper Service (systemd timer, hourly)    │
│ ├─ Query: SELECT id FROM lots WHERE            │
│ │    auction_datetime_utc < NOW() - INTERVAL '1h'│
│ │    AND final_bid_usd IS NULL                 │
│ │    ORDER BY auction_datetime_utc DESC        │
│ │    LIMIT 1000                                │
│ ├─ For each lot:                                │
│ │  ├─ Sleep random(2-5 sec) -- rate limiting   │
│ │  ├─ HTTP GET /public/data/lotdetails/solr/{id}│
│ │  ├─ If 200: parse JSON → extract la, cs      │
│ │  ├─ If 403/429: backoff exponential          │
│ │  └─ UPDATE lots SET final_bid=la, outcome=cs │
│ └─ Log success/failure rates                    │
└─────────────────────────────────────────────────┘
```

### Cloudflare/Imperva Bypass Strategy

**Level 1: Simple (works for occasional requests):**
- Correct User-Agent (Chrome/Firefox latest)
- Referer header: `https://www.copart.com/lot/{lotId}`
- Accept headers matching browser

**Level 2: Moderate (if Level 1 blocked):**
- Rotate User-Agents (pool of 10-20)
- Rotate IPs via residential proxies (cost: $50-150/mo for 10k requests/day)
- Session cookies: load main page first, extract cookies, reuse

**Level 3: Advanced (last resort):**
- Headless browser (Puppeteer/Playwright)
- Stealth plugins to hide automation
- CAPTCHA solving service (2Captcha, AntiCaptcha) - $2-3 per 1000 solves

### Pros

✅ **Final Bid Available** - `la` field is the actual sale price
✅ **Status Included** - `cs` field may have "SOLD", "NO SALE"
✅ **Faster than CSV** - Can query immediately after auction
✅ **Selective** - Only query lots we care about (past auction date)

### Cons

❌ **Gray Area Legally** - Unofficial endpoint, may violate ToS
❌ **Blocking Risk** - Cloudflare/Imperva will detect high volume
❌ **Fragile** - Endpoint can change/disappear at any time
❌ **Rate Limits** - Unknown, but likely <1000 req/day per IP
❌ **Cost** - Proxies required for scale ($50-300/mo)
❌ **Maintenance** - Requires monitoring for endpoint changes

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| IP blocking | High | High | Residential proxies, rate limiting (1 req/3-5 sec) |
| Endpoint removal | Medium | Critical | Fallback to Method 1, alert system |
| CAPTCHA introduced | Medium | High | CAPTCHA solver service, headless browser |
| Legal action from Copart | Low | Critical | Consult lawyer, ToS review |

### Cost & Performance

- **Development:** 5-7 days (HTTP client, retry logic, proxy rotation)
- **Infrastructure:**
  - Proxies: $100-200/mo (residential, 10k req/day)
  - CAPTCHA solver: $50/mo (if needed)
- **Latency:** 1-6 hours after auction close (depends on batch size)
- **Accuracy:** 95-98% (direct from Copart backend)
- **Throughput:** 1,000-5,000 lots/day (limited by rate limits)

---

## Method 3: Live Auction WebSocket/VB3 Monitoring

### How It Works

1. Authenticate to Copart as member (requires account)
2. Join live auction room via WebSocket
3. Listen for bid updates in real-time
4. Capture final bid when lot closes

### Architecture

```
┌─────────────────────────────────────────────────┐
│ Auction Monitor (24/7 process)                 │
│ ├─ Authenticate: Copart member login           │
│ ├─ Query: upcoming auctions today (from CSV)    │
│ ├─ For each auction location:                   │
│ │  ├─ Connect WebSocket to VB3 platform         │
│ │  ├─ Subscribe to all lots at this location    │
│ │  ├─ Listen for:                               │
│ │  │  ├─ bid.update (new current bid)          │
│ │  │  ├─ lot.sold (final event)                │
│ │  │  ├─ lot.no_sale (reserve not met)         │
│ │  │  └─ lot.on_approval (pending)             │
│ │  └─ Write to: lots table (real-time update)   │
│ └─ Reconnect on disconnect                      │
└─────────────────────────────────────────────────┘
```

### Technical Challenges

1. **Account Requirement:** Need active Copart member account
2. **Multi-Location:** ~50-100 auction locations in US, many simultaneous
3. **WebSocket Protocol:** Reverse-engineer VB3 message format
4. **Connection Limits:** Copart may limit concurrent connections per account
5. **Detection Risk:** Abnormal usage patterns (joining all auctions)

### Pros

✅ **Real-Time** - Final bid within seconds of lot close
✅ **100% Accurate** - Direct from auction system
✅ **Immediate Status** - Sold/Not Sold/On Approval known instantly
✅ **No CSV Lag** - No 15-min wait

### Cons

❌ **High Complexity** - WebSocket protocol, authentication, multi-connection
❌ **Account Risk** - Copart may ban account for suspicious activity
❌ **Scale Limits** - Cannot monitor 100+ simultaneous auctions (physical limit)
❌ **Fragile** - Protocol changes, session timeouts
❌ **Cost** - Need multiple accounts + proxies to scale ($200-500/mo)
❌ **Legal Risk** - Clearly violates "no automated bidding/monitoring" in ToS

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Account ban | Very High | Critical | Use disposable accounts, rotate |
| Protocol change | Medium | Critical | Reverse-engineer regularly, alert on failures |
| Detection of automation | High | Critical | Human-like behavior, delays, mouse movements |
| Legal action | Medium | Critical | **DO NOT IMPLEMENT** without legal clearance |

### Cost & Performance

- **Development:** 10-14 days (complex, reverse engineering required)
- **Infrastructure:**
  - Multiple Copart accounts: $0-50/mo (member registration)
  - Proxies for account isolation: $150-300/mo
- **Latency:** Real-time (0-60 seconds)
- **Accuracy:** 99%+
- **Coverage:** Limited to ~20-30% of lots (cannot cover all locations simultaneously)

### **Recommendation:** ⛔ **DO NOT IMPLEMENT** (too risky, violates ToS explicitly)

---

## Method 4: Third-Party APIs (auctionsapi.com, auction-api.app, etc.)

### How It Works

1. Subscribe to commercial API service
2. Query by VIN or lot ID
3. Receive pre-aggregated data (final bid, status, history)

### Example: auction-api.app

**Pricing:**
- Basic: $150/mo (10,000 requests)
- Pro: $250/mo (50,000 requests)
- Enterprise: Custom

**API Example:**
```bash
curl -X GET 'https://auction-api.app/api/v1/lot/12345678' \
  -H 'Authorization: Bearer YOUR_API_KEY'
```

**Response:**
```json
{
  "lotNumber": 12345678,
  "vin": "1HGCM82633A004352",
  "finalBid": 7344.00,
  "status": "SOLD",
  "auctionDate": "2025-10-15T14:30:00Z",
  "location": "Chicago, IL",
  "saleHistory": [
    {
      "lotNumber": 12340000,
      "auctionDate": "2025-10-01T14:00:00Z",
      "finalBid": 6500.00,
      "status": "NOT_SOLD"
    }
  ]
}
```

### Pros

✅ **Zero Development** - API is ready, just integrate
✅ **Legal** - They handle ToS risk
✅ **Reliable** - Professional maintenance
✅ **Complete Data** - Final bid + history + status
✅ **Backfill Included** - Historical data available
✅ **No Blocking** - They manage IP rotation

### Cons

❌ **Cost** - $150-250/mo ongoing (vs one-time dev cost)
❌ **Dependency** - Vendor lock-in, service may shut down
❌ **Data Staleness** - Update frequency varies (hourly to daily)
❌ **Coverage** - May miss some lots (depends on vendor scraping success)
❌ **No Control** - Cannot customize data fields

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Vendor shutdown | Low | High | Maintain fallback method (CSV diff) |
| Price increase | Medium | Medium | Budget for 2x cost increase |
| Data gaps | Low | Medium | Cross-check with CSV for completeness |
| Vendor legal issues | Low | Medium | Review vendor's ToS compliance |

### Cost & Performance

- **Development:** 1-2 days (API integration)
- **Infrastructure:** $150-250/mo (subscription)
- **Latency:** 1-24 hours (vendor-dependent)
- **Accuracy:** 90-95% (depends on vendor scraping success)
- **Coverage:** 95-98% of lots

---

## Decision Matrix

| Method | Final Bid | Accuracy | Latency | Cost/mo | Legal Risk | Dev Time | Recommended |
|--------|-----------|----------|---------|---------|------------|----------|-------------|
| **CSV Diff** | ❌ | 85% | 15-45 min | $0 | ✅ None | 3-5 days | ✅ **YES** (backbone) |
| **JSON API** | ✅ | 95% | 1-6 hrs | $100-200 | ⚠️ Medium | 5-7 days | ⚠️ **MAYBE** (supplement) |
| **WebSocket** | ✅ | 99% | Real-time | $200-500 | ❌ High | 10-14 days | ❌ **NO** (too risky) |
| **Third-Party** | ✅ | 90% | 1-24 hrs | $150-250 | ✅ None | 1-2 days | ✅ **YES** (if budget allows) |

---

## Recommended Hybrid Approach

### Phase 1: CSV Backbone (P0 - Immediate)
- Implement CSV diff + event store
- Detect Sold/Not Sold via disappearance heuristic
- Build VIN history linking (relists)
- **Result:** 85% coverage, $0 cost, fully legal

### Phase 2A: Third-Party API (P1 - If Budget Allows)
- Subscribe to auction-api.app or auctionsapi.com
- Backfill final_bid for historical lots
- Ongoing: query API for lots closed in last 24h
- **Result:** 95% coverage, $150-250/mo, legal, fast integration

### Phase 2B: JSON API Scraper (P1 - If No Budget)
- Implement headless scraper for `/public/data/lotdetails/solr/{lotId}`
- Use residential proxies (start with 1, scale to 5-10)
- Rate limit: 1 request per 5 seconds (conservative)
- Target: 500-1000 lots/day (recent auctions only)
- **Result:** 90% coverage, $50-100/mo, medium risk

### Phase 3: Heuristic Refinement (P2)
- Machine learning on CSV patterns:
  - Current bid patterns before disappearance
  - Time delta between auction date and disappearance
  - VIN relist probability scoring
- Improve "On Approval" detection accuracy
- **Result:** 90-95% accuracy without external APIs

---

## Legal & Risk Mitigation

### ToS Compliance Review

**Copart Terms of Service (https://www.copart.com/termsConditions):**
> "You agree not to... use any robot, spider, scraper, or other automated means to access the Site..."

**Analysis:**
- ✅ **CSV Polling:** Official feed, likely acceptable if reasonable frequency
- ⚠️ **JSON API:** Gray area - public endpoint but not documented
- ❌ **WebSocket:** Clear violation ("automated means to access")

**Recommendation:**
1. Consult IP lawyer before implementing Method 2 or 3
2. Start with Method 1 (CSV) only - fully defensible
3. If legal clearance obtained, proceed with Method 2 (JSON API)
4. **NEVER implement Method 3 (WebSocket)** - too risky

### Operational Risk Mitigation

1. **IP Rotation:** Use residential proxies (Bright Data, Oxylabs) if scraping
2. **Rate Limiting:** Never exceed 1 request per 5 seconds per IP
3. **Monitoring:** Alert on 403/429 status codes, auto-pause scraper
4. **Graceful Degradation:** If API blocked, fall back to CSV-only mode
5. **User-Agent Rotation:** Maintain pool of 20+ realistic UAs
6. **Session Management:** Rotate cookies every 100 requests

---

## Next Steps

1. **Immediate:** Implement Phase 1 (CSV Diff) - 3-5 days
2. **Week 2:** Legal review of JSON API scraping
3. **Week 3:** Decision point:
   - If budget approved → integrate Third-Party API
   - If legal approved → build JSON API scraper
   - If neither → refine CSV heuristics with ML
4. **Month 2:** Backfill historical data (existing 124k lots)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Coverage | >90% of lots | % of lots with final_bid populated |
| Accuracy | >85% correct | Manual validation sample (n=100) |
| Latency | <24h from auction close | Median time to outcome determination |
| Uptime | >99.5% | Scraper/poller service availability |
| Cost | <$200/mo | Infrastructure + third-party fees |

---

## Appendix: Data Sources Comparison

| Source | Update Freq | Final Bid | Status | History | Cost | Legal |
|--------|-------------|-----------|--------|---------|------|-------|
| **Copart CSV** | 15 min | ❌ | ❌ | ❌ | Free | ✅ |
| **JSON API** | On-demand | ✅ | ✅ | ❌ | $0* | ⚠️ |
| **WebSocket** | Real-time | ✅ | ✅ | ❌ | $0* | ❌ |
| **auctionsapi.com** | Hourly | ✅ | ✅ | ✅ | $150/mo | ✅ |
| **auction-api.app** | Hourly | ✅ | ✅ | ✅ | $250/mo | ✅ |

*Proxies/infrastructure not included in cost

---

**Decision Owner:** @KestutisTreciokas
**Review Date:** 2025-11-18 (30 days)
**Status:** Awaiting approval for Phase 1 implementation
