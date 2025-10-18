# Upgrade Path: Adding JSON Scraper (PoC 2)

**Status:** ⚠️ **NOT RECOMMENDED** — Requires legal approval
**When:** Only if budget <$200/mo AND legal approves
**Cost:** $100-200/mo (proxies)
**Risk:** High (ToS violation, blocking)

---

## ⚠️ CRITICAL WARNING

**DO NOT IMPLEMENT WITHOUT:**
1. ✅ Written legal opinion from IP lawyer
2. ✅ Documented acceptable use policy
3. ✅ Plan to immediately stop if contacted by Copart

**This method likely violates Copart Terms of Service.**

---

## Why This Exists

This upgrade path is documented for completeness, but **we strongly recommend PoC 4 (third-party API) instead** because:

- ✅ PoC 4 is 100% legal
- ✅ PoC 4 costs similar ($199/mo vs $100-200/mo)
- ✅ PoC 4 has zero blocking risk
- ✅ PoC 4 requires less maintenance

**Only use PoC 2 if:**
- Budget absolutely cannot support $199/mo
- Legal review explicitly approves use
- You accept blocking/ToS violation risks

---

## Legal Review Checklist

Before proceeding, you MUST:

- [ ] Consult IP lawyer specializing in web scraping
- [ ] Get written legal opinion on Copart ToS compliance
- [ ] Document rate limits to avoid "abusive" scraping
- [ ] Set up monitoring for cease & desist notices
- [ ] Have immediate shutdown plan if contacted

**Estimated legal review cost:** $500-2000 (one-time)

---

## Implementation Steps

### Step 1: Legal Approval (1-2 weeks)

**DO NOT SKIP THIS STEP**

Provide lawyer with:
1. Copart Terms of Service (current version)
2. Target endpoint: `https://www.copart.com/public/data/lotdetails/solr/{lotId}`
3. Planned usage: 500-1000 requests/day
4. Rate limit: 1 request per 3-5 seconds
5. Use case: Market research / price transparency

**Lawyer will advise:**
- Is this legally risky? (likely: YES)
- What rate limits are acceptable?
- What disclaimers to add to your site?
- When to stop if challenged?

### Step 2: Set Up Proxies (1 day)

**Only after legal approval**

**Option A: Residential Proxies (Recommended)**

Providers:
- **SmartProxy:** $75/mo for 5GB (~10k requests)
- **Bright Data:** $500/mo for 20GB (overkill)
- **Oxylabs:** $300/mo for 10GB

**Sign up for SmartProxy:**
1. Go to https://smartproxy.com
2. Subscribe to $75/mo plan
3. Get proxy credentials
4. Set environment variable:
   ```bash
   export PROXY_URL="http://user:pass@rotating.smartproxy.com:7000"
   ```

**Option B: Proxy Pool (DIY)**

Buy 10-20 datacenter proxies from:
- MyPrivateProxy: $50/mo for 10 proxies
- SquidProxies: $80/mo for 20 proxies

Set environment variable:
```bash
export PROXY_LIST="http://proxy1:port,http://proxy2:port,..."
```

### Step 3: Install Dependencies

```bash
npm install https-proxy-agent
```

### Step 4: Deploy Script

**Script already created:** `scripts/fetch-final-bids-json-proxy.js`

**Test (dry run):**
```bash
PROXY_URL=http://user:pass@proxy.com:8080 \
  node scripts/fetch-final-bids-json-proxy.js \
  --lot-id 12345678 \
  --dry-run
```

**Expected:**
```
Using proxy: http://*****@proxy.com:8080
✓ Final Bid: $7344.00, Status: SOLD
🔍 DRY RUN: Would update final_bid_usd = $7344.00
```

### Step 5: Create Systemd Service

**File:** `/etc/systemd/system/copart-final-bid-scraper.service`

```ini
[Unit]
Description=Copart Final Bid JSON Scraper (LEGAL REVIEW REQUIRED)
After=network.target

[Service]
Type=oneshot
WorkingDirectory=/root/Vinops-project
Environment="NODE_ENV=production"
Environment="DATABASE_URL=postgresql://etl_rw:PASSWORD@192.168.0.5:5432/vinops_db?sslmode=disable"
Environment="PROXY_URL=http://user:pass@rotating.smartproxy.com:7000"
ExecStart=/usr/bin/node scripts/fetch-final-bids-json-proxy.js --auto --limit 500 --rate-limit 5
StandardOutput=append:/var/log/vinops/final-bid-scraper.log
StandardError=append:/var/log/vinops/final-bid-scraper-error.log
MemoryMax=1G
CPUQuota=50%

[Install]
WantedBy=multi-user.target
```

**Timer:** `/etc/systemd/system/copart-final-bid-scraper.timer`

```ini
[Unit]
Description=Copart Final Bid Scraper Timer

[Timer]
# Every 2 hours (less frequent than API to reduce blocking risk)
OnCalendar=*:00/2
Persistent=true

[Install]
WantedBy=timers.target
```

**Deploy:**
```bash
sudo cp deploy/systemd/copart-final-bid-scraper.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable copart-final-bid-scraper.timer
sudo systemctl start copart-final-bid-scraper.timer
```

### Step 6: Monitor for Blocking (Daily)

**Critical metrics:**

```bash
# Check block rate from logs
grep "Blocked (403)" /var/log/vinops/final-bid-scraper.log | wc -l

# Total requests
grep "Processing lot" /var/log/vinops/final-bid-scraper.log | wc -l

# Calculate block rate
# Block rate = blocked / total
# Acceptable: <5%
# WARNING: >10%
# STOP: >20%
```

**If block rate >10%:**
1. Increase rate limit to 10 sec/req
2. Switch proxy provider
3. Reduce batch size to 100 lots/run

**If block rate >20%:**
1. **STOP IMMEDIATELY**
2. Disable systemd timer
3. Consult legal counsel
4. Consider switching to PoC 4 (third-party API)

---

## Cost Analysis

### Monthly Costs

**Proxies:** $75-200/mo
- SmartProxy (cheapest): $75/mo
- SquidProxies (mid): $80/mo
- Bright Data (premium): $500/mo

**Total:** $75-200/mo

**Comparison with PoC 4:**
- PoC 2 (scraper): $75-200/mo + legal risk + maintenance
- PoC 4 (API): $199/mo + zero legal risk + zero maintenance

**Verdict:** PoC 4 is better value unless budget <$75/mo

---

## Risks

### Legal Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **ToS Violation** | High | Critical | Legal review, acceptable use policy |
| **Cease & Desist** | Medium | High | Immediate shutdown plan |
| **Lawsuit** | Low | Critical | Liability insurance, legal counsel |
| **Account Ban** | Medium | Medium | Not using member account for scraping |

### Technical Risks

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| **IP Blocking** | High | High | Residential proxies, rate limiting |
| **Endpoint Removed** | Low | High | Maintain CSV-only fallback |
| **CAPTCHA Required** | Low | Medium | Not implemented (would need headless browser) |
| **Proxy Ban** | Medium | Medium | Rotate proxies, use residential |

---

## Monitoring & Alerts

### Daily Checks

```sql
-- Lots with final bids from scraper
SELECT COUNT(*)
FROM lots
WHERE final_bid_usd IS NOT NULL
  AND detection_method = 'json_api_proxy'
  AND updated_at > NOW() - INTERVAL '24 hours';
-- Alert if = 0 (scraper may have failed)

-- Block rate trend
SELECT
  DATE(created_at) as date,
  COUNT(*) FILTER (WHERE detection_notes::jsonb->>'api_status' = '403') as blocked,
  COUNT(*) as total,
  (COUNT(*) FILTER (WHERE detection_notes::jsonb->>'api_status' = '403')::FLOAT / COUNT(*)) as block_rate
FROM lots
WHERE detection_method = 'json_api_proxy'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at);
-- Alert if block_rate > 0.10
```

### Weekly Review

1. Check legal landscape (any ToS changes?)
2. Review proxy costs vs. usage
3. Evaluate switching to PoC 4 (third-party API)
4. Monitor for cease & desist notices

---

## Shutdown Plan

**If contacted by Copart legal:**

1. **Immediate (within 1 hour):**
   ```bash
   sudo systemctl stop copart-final-bid-scraper.timer
   sudo systemctl disable copart-final-bid-scraper.timer
   ```

2. **Document (within 24 hours):**
   - Save copy of cease & desist notice
   - Contact your legal counsel
   - Prepare response acknowledging shutdown

3. **Respond (within 48 hours):**
   - Send written confirmation of shutdown
   - Explain it was market research
   - Offer to delete collected data if requested

4. **Alternative (within 1 week):**
   - Switch to PoC 4 (third-party API)
   - OR remain CSV-only

**CSV-only system continues working** — no disruption to core functionality

---

## Success Metrics (Week 1)

Only proceed if ALL metrics pass:

✅ **Technical:**
- [ ] Success rate: >90%
- [ ] Block rate: <5%
- [ ] No CAPTCHA challenges

✅ **Legal:**
- [ ] Legal approval received in writing
- [ ] Acceptable use policy documented
- [ ] No contact from Copart

✅ **Cost:**
- [ ] Proxy costs <$200/mo
- [ ] No unexpected charges

**If any metric fails:** STOP and switch to PoC 4 (third-party API)

---

## Why We Don't Recommend This

### Comparison: PoC 2 vs PoC 4

| Factor | PoC 2 (Scraper) | PoC 4 (API) |
|--------|----------------|-------------|
| **Legal Risk** | 🔴 High | 🟢 None |
| **Block Risk** | 🟡 5-20% | 🟢 None |
| **Maintenance** | 🔴 High | 🟢 Low |
| **Cost** | $75-200/mo | $199/mo |
| **Reliability** | 🟡 80-90% | 🟢 99%+ |
| **Setup Time** | 2-3 days | 1 day |
| **Legal Review** | Required ($500-2000) | Not required |
| **Shutdown Risk** | 🔴 High | 🟢 None |

**Total Cost (Year 1):**
- PoC 2: $75-200/mo × 12 + $500-2000 legal = **$1,400-4,400**
- PoC 4: $199/mo × 12 = **$2,388**

**Verdict:** PoC 4 is better value and lower risk

---

## Recommended Alternative

**Instead of PoC 2, we recommend:**

### Option 1: PoC 4 (Third-Party API) ⭐
- Cost: $199/mo
- Risk: None
- See: `docs/UPGRADE-PATH-THIRD-PARTY-API.md`

### Option 2: CSV-Only (Stay as-is)
- Cost: $0/mo
- Risk: None
- Show "Last Known Bid" instead of final price

### Option 3: Hybrid (CSV + API)
- Cost: $199/mo
- Risk: None
- Best of both worlds

---

## Files Reference

**Scripts (already created):**
- `scripts/fetch-final-bids-json.js` — Basic scraper
- `scripts/fetch-final-bids-json-proxy.js` — With proxy support

**Documentation:**
- `docs/POC-2-JSON-API-SCRAPER.md` — Complete PoC guide
- `docs/UPGRADE-PATH-JSON-SCRAPER.md` — This document

**NOT created (you would need to create if proceeding):**
- `deploy/systemd/copart-final-bid-scraper.service`
- `deploy/systemd/copart-final-bid-scraper.timer`
- Legal opinion document
- Acceptable use policy document

---

**Status:** ⚠️ NOT RECOMMENDED
**Reason:** Legal risk + cost similar to legal alternative (PoC 4)
**Recommendation:** Use PoC 4 instead

---

**Last Updated:** 2025-10-18
**Legal Review:** REQUIRED before deployment
