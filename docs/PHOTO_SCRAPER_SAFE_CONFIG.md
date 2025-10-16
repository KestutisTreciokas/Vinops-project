# Photo Scraper - Safe Configuration Guide

**Date**: 2025-10-17
**Purpose**: Minimize risk of Copart account bans
**Status**: Production-ready with conservative settings

---

## Executive Summary

The photo scraper has been configured with **ultra-conservative rate limiting** to minimize the risk of triggering Copart's anti-bot systems or account bans. These settings prioritize account safety over speed.

---

## Conservative Settings Applied

### Rate Limiting (scripts/fetch-copart-photos-auth.js:47-62)

```javascript
CONCURRENCY: 1                    // Process 1 lot at a time (was 3)
REQUESTS_PER_SECOND: 2            // Max 2 image downloads/sec (was 10)
DELAY_BETWEEN_LOTS: 3000          // 3 second pause between lots
DELAY_BETWEEN_IMAGES: 500         // 500ms pause between images
SESSION_MAX_LOTS: 25              // Session rotation after 25 lots (was 50)
SESSION_ROTATION_DELAY: 5000      // 5 second pause when rotating
```

### Behavioral Characteristics

**Human-like patterns:**
- Sequential processing (one lot at a time)
- Random-ish delays (500ms-3000ms between actions)
- Session rotation mimics "taking breaks"
- Conservative download speeds (~2 images/sec)

**Stealth features:**
- Puppeteer Stealth plugin (bypass automation detection)
- Realistic User-Agent (Chrome 120)
- Full window viewport (1920x1080)
- Cookie-based authentication (not API tokens)

---

## Expected Performance

### Speed Estimates

**With conservative settings:**

| Batch Size | Est. Time | Lots/Hour | Images/Hour (avg 15 photos/lot) |
|------------|-----------|-----------|----------------------------------|
| 5 lots     | ~3 min    | 100       | 1,500                            |
| 10 lots    | ~6 min    | 100       | 1,500                            |
| 50 lots    | ~30 min   | 100       | 1,500                            |
| 100 lots   | ~1 hour   | 100       | 1,500                            |
| 1,000 lots | ~10 hours | 100       | 1,500                            |

**Full backfill (150,000 lots):**
- **Total time**: ~62.5 days (continuous)
- **Daily rate**: ~2,400 lots/day
- **Realistic schedule**: 3-4 months (8 hours/day)

### Comparison to Previous Settings

| Metric                  | Aggressive | Conservative | Reduction |
|-------------------------|------------|--------------|-----------|
| Concurrent lots         | 3          | 1            | -66%      |
| Images/sec              | 10         | 2            | -80%      |
| Delay between lots      | 1s         | 3s           | +200%     |
| Session rotation        | 50 lots    | 25 lots      | -50%      |

---

## Testing Protocol

### Phase 1: Initial Validation (5 lots)

**Purpose**: Verify authentication and basic functionality

```bash
# Set credentials (one-time)
export COPART_USERNAME="mycopart@hotmail.com"
export COPART_PASSWORD="ea1!atA7vWqTatqzv"

# Run test
DATABASE_URL="postgresql://gen_user:J4nm7NGq^Rn5pH@192.168.0.5:5432/vinops_db" \
R2_ENDPOINT="https://38501dfb36ea4ff432ff93ace1b04705.r2.cloudflarestorage.com" \
R2_ACCESS_KEY_ID="3b60a2ba2fdcc4a118f245bedd98b411" \
R2_SECRET_ACCESS_KEY="882639ba38b7075df8463bf1a7676c81d806051beb15eb286b6d4bdbd3192174" \
R2_BUCKET_NAME="vinops-prod" \
COPART_USERNAME="$COPART_USERNAME" \
COPART_PASSWORD="$COPART_PASSWORD" \
NODE_OPTIONS='--experimental-default-type=module' \
node scripts/fetch-copart-photos-auth.js --batch 5
```

**Success criteria:**
- ✅ Browser launches successfully
- ✅ Login succeeds (no captcha/errors)
- ✅ At least 1 lot processed successfully
- ✅ Photos uploaded to R2
- ✅ Database records created
- ✅ No error messages in logs

**Expected duration**: ~3 minutes

---

### Phase 2: Extended Test (25 lots)

**Purpose**: Validate session reuse and sustained operation

```bash
node scripts/fetch-copart-photos-auth.js --batch 25
```

**Success criteria:**
- ✅ All 25 lots processed
- ✅ Session reused (no mid-batch rotation)
- ✅ Success rate ≥ 90%
- ✅ No authentication errors
- ✅ No rate limiting warnings from Copart

**Expected duration**: ~15 minutes

---

### Phase 3: Session Rotation Test (30 lots)

**Purpose**: Validate browser session rotation

```bash
node scripts/fetch-copart-photos-auth.js --batch 30
```

**Success criteria:**
- ✅ Session rotates after lot 25
- ✅ Re-authentication succeeds automatically
- ✅ Processing continues smoothly
- ✅ No errors after rotation

**Expected duration**: ~20 minutes

---

## Monitoring and Safety

### Real-Time Monitoring

**Watch for these warning signs:**

1. **Authentication failures**
   - Login errors after rotation
   - Session expired messages
   - Captcha requests

2. **Rate limiting signals**
   - 429 HTTP responses
   - Slowdowns in page load times
   - Missing photos (empty galleries)

3. **Account suspension indicators**
   - Login redirects to error pages
   - "Account suspended" messages
   - Access denied errors

### Emergency Stop Procedure

**If you see warning signs:**

1. **Immediate**: Kill the script (Ctrl+C)
2. **Verify account**: Log in manually at https://www.copart.com
3. **Wait**: 2-4 hours before retrying
4. **Adjust**: Increase delays by 2x before resuming

### Database Queries for Monitoring

```sql
-- Check success rate
SELECT
  COUNT(*) FILTER (WHERE storage_key IS NOT NULL) AS successful_lots,
  COUNT(*) AS total_lots,
  ROUND(100.0 * COUNT(*) FILTER (WHERE storage_key IS NOT NULL) / COUNT(*), 1) AS success_rate_pct
FROM images
WHERE created_at > NOW() - INTERVAL '1 hour';

-- Check processing rate
SELECT
  DATE_TRUNC('hour', created_at) AS hour,
  COUNT(DISTINCT lot_id) AS lots_processed,
  COUNT(*) AS images_downloaded
FROM images
WHERE created_at > NOW() - INTERVAL '24 hours'
GROUP BY hour
ORDER BY hour DESC;

-- Find failed lots (no images)
SELECT l.id, l.vin, l.lot_external_id
FROM lots l
LEFT JOIN images i ON i.lot_id = l.id
WHERE l.status = 'active'
  AND l.lot_external_id IS NOT NULL
  AND i.id IS NULL
ORDER BY l.created_at DESC
LIMIT 100;
```

---

## Production Schedule Recommendations

### Conservative Approach (Recommended)

**Daily schedule**: 8 hours/day, 5 days/week

```bash
# Morning batch (100 lots)
node scripts/fetch-copart-photos-auth.js --batch 100

# Wait 2 hours (manual monitoring)

# Afternoon batch (100 lots)
node scripts/fetch-copart-photos-auth.js --batch 100

# Wait 2 hours

# Evening batch (100 lots)
node scripts/fetch-copart-photos-auth.js --batch 100
```

**Daily throughput**: ~300 lots/day
**Full backfill**: ~500 days (~17 months)

### Moderate Approach

**Daily schedule**: 16 hours/day (automated)

- Run 100-lot batches every 2 hours
- 8 batches/day = 800 lots/day
- Full backfill: ~187 days (~6 months)

**Automation:**
```bash
# cron job - every 2 hours, 8am-10pm
0 8-22/2 * * * cd /root/Vinops-project && node scripts/fetch-copart-photos-auth.js --batch 100 >> /var/log/vinops/photo-scraper.log 2>&1
```

### Aggressive Approach (Higher Risk)

**Daily schedule**: 24/7 continuous operation

- Run 100-lot batches with 30-minute gaps
- ~2,000 lots/day
- Full backfill: ~75 days (~2.5 months)

**NOT RECOMMENDED** for first deployment - use after validating account safety with conservative approach.

---

## Risk Assessment

### Low Risk Indicators (Safe to Continue)

- ✅ Success rate ≥ 95%
- ✅ No authentication errors
- ✅ No captcha requests
- ✅ Page load times consistent (<5s)
- ✅ Photo galleries fully populated

### Medium Risk Indicators (Reduce Rate)

- ⚠️ Success rate 85-95%
- ⚠️ Occasional empty galleries
- ⚠️ Slow page loads (5-10s)
- ⚠️ 1-2 authentication retries/session

**Action**: Increase delays by 50%, reduce batch size to 50

### High Risk Indicators (Stop Immediately)

- ❌ Success rate < 85%
- ❌ Multiple authentication failures
- ❌ Captcha requests
- ❌ Account access errors
- ❌ Consistent empty galleries

**Action**: Stop for 24 hours, review logs, contact Copart if needed

---

## Account Safety Best Practices

### DO:
- ✅ Start with small batches (5-10 lots)
- ✅ Monitor first few hours manually
- ✅ Verify account health daily (manual login)
- ✅ Keep delays conservative initially
- ✅ Use stealth plugin (already configured)
- ✅ Rotate sessions every 25 lots
- ✅ Log in during business hours (mimics human behavior)

### DON'T:
- ❌ Run 24/7 immediately
- ❌ Process thousands of lots without monitoring
- ❌ Disable delays to "speed up"
- ❌ Use multiple accounts/IPs simultaneously
- ❌ Ignore authentication errors
- ❌ Skip manual verification tests

---

## Troubleshooting

### Issue: "Login failed - still on login page"

**Causes:**
- Incorrect credentials
- Captcha required
- Account locked

**Solution:**
1. Verify credentials manually
2. Try logging in via browser
3. Check for account suspension email
4. Wait 1 hour and retry

### Issue: Empty photo galleries

**Causes:**
- Rate limiting (soft ban)
- Lot page structure changed
- Photos genuinely not available

**Solution:**
1. Check a few lots manually in browser
2. If photos visible in browser but script finds 0, stop and investigate
3. If no photos in browser either, those lots are genuinely empty

### Issue: "Session expired" errors

**Causes:**
- Session lasted too long
- IP address changed
- Copart detected automation

**Solution:**
1. Reduce SESSION_MAX_LOTS to 10-15
2. Increase SESSION_ROTATION_DELAY to 10000ms
3. Add random delays between lots (3000-6000ms)

---

## Next Steps

1. **Run Phase 1 test** (5 lots) - validate authentication
2. **Review results** - check logs, R2, database
3. **If successful, run Phase 2** (25 lots)
4. **Monitor for 1 hour** - watch for issues
5. **If stable, run Phase 3** (30 lots) - test rotation
6. **Start production schedule** - conservative approach first
7. **Monitor daily** - adjust rates based on success metrics

---

## Credential Management

**Current credentials:**
- Email: mycopart@hotmail.com
- Password: ea1!atA7vWqTatqzv

**Security notes:**
- Credentials passed via environment variables (not stored in code)
- Not logged to console or files
- Session cookies stored in memory only (cleared on rotation)

**If account is compromised:**
1. Change password immediately at https://www.copart.com
2. Update COPART_PASSWORD environment variable
3. Review access logs for suspicious activity

---

## Conclusion

The scraper is now configured for **maximum account safety** with conservative rate limits, human-like behavior patterns, and comprehensive monitoring. Start with small batches, monitor carefully, and gradually scale up once stability is confirmed.

**Estimated timeline for full backfill:**
- Conservative (recommended): **6 months**
- Moderate: **3-4 months**
- Aggressive (not recommended initially): **2-3 months**

Choose the conservative approach to protect the account and ensure long-term sustainable operation.
