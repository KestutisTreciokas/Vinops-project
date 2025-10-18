# Upgrade Path: Adding Third-Party API (PoC 4)

**When:** After CSV-only is deployed and users request exact sale prices
**Cost:** Additional $199/mo
**Timeline:** 1 week to add
**Risk:** Low (legal, reliable)

---

## Why Upgrade?

### Users Want Exact Final Bids

If users are asking:
- "What was the actual sale price?"
- "Is this the final bid or just the last bid before auction?"
- "Why do some sites show higher prices?"

**Then it's time to add PoC 4** (third-party API for final bid data)

---

## What Changes

### Before (CSV-only):
```
Lot Status: SOLD ✓
Last Known Bid: $7,200
(Final price may vary)
```

### After (CSV + API):
```
Lot Status: SOLD ✓
Final Sale Price: $7,344
Last Bid: $7,200
```

**Improvement:** Exact final bid amounts instead of approximate

---

## Implementation Steps

### Step 1: Sign Up for API (15 min)

1. Go to https://auction-api.app
2. Create account
3. Start free trial (100 requests)
4. Test with 50-100 real lot IDs
5. Verify accuracy (>95%)
6. Subscribe to Tier 2 ($199/mo for 10k requests)

### Step 2: Install Dependencies (5 min)

```bash
npm install axios  # If not already installed
```

### Step 3: Create API Fetch Script (1 hour)

**File:** `scripts/fetch-final-bids-api.js`

```javascript
#!/usr/bin/env node

import pg from 'pg'
import axios from 'axios'

const { Pool } = pg

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
})

const API_KEY = process.env.AUCTION_API_KEY
const API_BASE = 'https://api.auction-api.app/v1'

async function fetchFinalBid(lotExternalId) {
  const url = `${API_BASE}/copart/lot/${lotExternalId}`

  const response = await axios.get(url, {
    headers: { 'X-API-Key': API_KEY }
  })

  return {
    finalBid: response.data.lot.finalBid,
    status: response.data.lot.status,
    auctionDate: response.data.lot.auctionDate
  }
}

async function updateLot(lotId, finalBid, status) {
  await pool.query(`
    UPDATE lots
    SET
      final_bid_usd = $1,
      detection_method = CASE
        WHEN detection_method IS NULL THEN 'api_only'
        ELSE detection_method || '+api'
      END,
      updated_at = NOW()
    WHERE id = $2
  `, [finalBid, lotId])
}

async function processLots(limit = 500) {
  // Get lots needing final bids (recent, with outcome)
  const { rows: lots } = await pool.query(`
    SELECT id, lot_external_id, auction_datetime_utc, outcome
    FROM lots
    WHERE auction_datetime_utc IS NOT NULL
      AND auction_datetime_utc < NOW() - INTERVAL '2 hours'
      AND auction_datetime_utc > NOW() - INTERVAL '7 days'
      AND final_bid_usd IS NULL
      AND outcome IN ('sold', 'on_approval')  -- Only fetch for sold/approval
      AND NOT is_removed
    ORDER BY auction_datetime_utc DESC
    LIMIT $1
  `, [limit])

  console.log(`Processing ${lots.length} lots...`)

  let success = 0
  let failed = 0

  for (const lot of lots) {
    try {
      const { finalBid, status } = await fetchFinalBid(lot.lot_external_id)

      if (finalBid) {
        await updateLot(lot.id, finalBid, status)
        success++
        console.log(`✓ ${lot.lot_external_id}: $${finalBid}`)
      }

      // Rate limit: 3 req/sec
      await new Promise(resolve => setTimeout(resolve, 333))

    } catch (err) {
      console.error(`✗ ${lot.lot_external_id}: ${err.message}`)
      failed++
    }
  }

  console.log(`\nCompleted: ${success} success, ${failed} failed`)
  await pool.end()
}

const LIMIT = parseInt(process.argv[2] || '500')
processLots(LIMIT)
```

**Make executable:**
```bash
chmod +x scripts/fetch-final-bids-api.js
```

### Step 4: Test Script (30 min)

```bash
# Test with 10 lots
AUCTION_API_KEY=xxx node scripts/fetch-final-bids-api.js 10

# Expected output:
# Processing 10 lots...
# ✓ 12345678: $7344
# ✓ 12345679: $5200
# ...
# Completed: 10 success, 0 failed
```

**Verify:**
```sql
SELECT
  lot_external_id,
  outcome,
  current_bid_usd as last_known_bid,
  final_bid_usd as final_sale_price,
  detection_method
FROM lots
WHERE final_bid_usd IS NOT NULL
ORDER BY updated_at DESC
LIMIT 10;
```

### Step 5: Create Systemd Service (30 min)

**File:** `/etc/systemd/system/copart-final-bid-api.service`

```ini
[Unit]
Description=Copart Final Bid API Fetcher
After=network.target

[Service]
Type=oneshot
WorkingDirectory=/root/Vinops-project
Environment="NODE_ENV=production"
Environment="DATABASE_URL=postgresql://etl_rw:PASSWORD@192.168.0.5:5432/vinops_db?sslmode=disable"
Environment="AUCTION_API_KEY=your_api_key_here"
ExecStart=/usr/bin/node scripts/fetch-final-bids-api.js 500
StandardOutput=append:/var/log/vinops/final-bid-api.log
StandardError=append:/var/log/vinops/final-bid-api-error.log
MemoryMax=1G
CPUQuota=50%

[Install]
WantedBy=multi-user.target
```

**Timer:** `/etc/systemd/system/copart-final-bid-api.timer`

```ini
[Unit]
Description=Copart Final Bid API Timer

[Timer]
OnCalendar=*:15,45  # Every hour at :15 and :45
Persistent=true

[Install]
WantedBy=timers.target
```

**Deploy:**
```bash
sudo cp deploy/systemd/copart-final-bid-api.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable copart-final-bid-api.timer
sudo systemctl start copart-final-bid-api.timer
```

### Step 6: Update UI (2-3 hours)

**File:** `frontend/src/components/catalog/PriceDisplay.tsx`

```tsx
interface PriceDisplayProps {
  currentBidUsd?: number  // Last known bid from CSV
  finalBidUsd?: number    // Final sale price from API
  outcome?: string
}

export function PriceDisplay({ currentBidUsd, finalBidUsd, outcome }: PriceDisplayProps) {
  if (outcome === 'sold' && finalBidUsd) {
    return (
      <div className="space-y-1">
        <div className="text-lg font-semibold text-green-700">
          Final Sale Price: ${finalBidUsd.toLocaleString()}
        </div>
        {currentBidUsd && currentBidUsd !== finalBidUsd && (
          <div className="text-sm text-fg-muted">
            Last Bid: ${currentBidUsd.toLocaleString()}
          </div>
        )}
      </div>
    )
  }

  if (currentBidUsd) {
    return (
      <div className="space-y-1">
        <div className="text-base">
          Last Known Bid: ${currentBidUsd.toLocaleString()}
        </div>
        {outcome === 'sold' && (
          <div className="text-xs text-fg-muted">
            Final price pending
          </div>
        )}
      </div>
    )
  }

  return null
}
```

**Update Catalog Card:**
```tsx
<VehicleCard
  vehicle={vehicle}
  renderPrice={() => (
    <PriceDisplay
      currentBidUsd={vehicle.currentBidUsd}
      finalBidUsd={vehicle.finalBidUsd}
      outcome={vehicle.outcome}
    />
  )}
/>
```

---

## Cost Analysis

### API Usage Projection

**Scenario: 10,000 lots/month need final bids**

- Recent lots (last 7 days): ~2,000 lots
- API calls needed: 2,000/month
- Tier required: Tier 1 ($99/mo for 1k) OR Tier 2 ($199/mo for 10k)

**Recommended:** Tier 2 ($199/mo) for headroom

### ROI Calculation

**Value to users:**
- Exact sale prices → better market research
- Competitive advantage vs CSV-only sites
- Higher user trust (accurate data)

**Willingness to pay:**
- If users willing to pay $5-10/mo for premium data
- Break-even: 20-40 paying users

---

## Monitoring

### Track API Usage

```sql
-- Lots with final bids added
SELECT
  DATE(updated_at) as date,
  COUNT(*) as lots_with_final_bid
FROM lots
WHERE final_bid_usd IS NOT NULL
  AND detection_method LIKE '%api%'
  AND updated_at > NOW() - INTERVAL '30 days'
GROUP BY DATE(updated_at);

-- API accuracy (compare current_bid vs final_bid)
SELECT
  AVG(ABS(final_bid_usd - current_bid_usd)) as avg_difference,
  AVG(final_bid_usd / NULLIF(current_bid_usd, 0)) as avg_ratio
FROM lots
WHERE final_bid_usd IS NOT NULL
  AND current_bid_usd IS NOT NULL
  AND final_bid_usd > 0
  AND current_bid_usd > 0;
-- Expect: avg_ratio ~1.02 (final bid typically 2% higher than last bid)
```

### Alert on API Failures

```bash
# Check if API service ran in last 2 hours
journalctl -u copart-final-bid-api.service --since "2 hours ago" | wc -l
# Alert if = 0
```

---

## Success Metrics (Week 1 After Upgrade)

✅ **Coverage:**
- [ ] >90% of sold lots (last 7 days) have final_bid_usd

✅ **Accuracy:**
- [ ] Spot-check 20 lots: >95% accuracy vs known sales

✅ **Performance:**
- [ ] API latency: <500ms average
- [ ] Zero API rate limit errors

✅ **Cost:**
- [ ] Usage <10k requests/month (within tier 2)

---

## Rollback

If API not working or too expensive:

```sql
-- Keep outcome data, just remove final_bid_usd
UPDATE lots
SET final_bid_usd = NULL
WHERE detection_method LIKE '%api%';
```

```bash
# Stop API service
sudo systemctl stop copart-final-bid-api.timer
sudo systemctl disable copart-final-bid-api.timer
```

**CSV-only system continues working** — no disruption

---

## Files to Create

1. `scripts/fetch-final-bids-api.js`
2. `deploy/systemd/copart-final-bid-api.service`
3. `deploy/systemd/copart-final-bid-api.timer`
4. `frontend/src/components/catalog/PriceDisplay.tsx`

---

**Total Time:** 1 week
**Total Cost:** $199/mo
**Complexity:** Low
**Risk:** Low

**Recommended:** Yes, if users request exact sale prices
