# Copart Authentication Flow

**Sprint:** S1B — MS-S1B-01
**Date:** 2025-10-16
**Purpose:** Document Copart member authentication and CSV download flow

---

## Overview

Copart CSV downloads require authenticated member session cookies. The CSV is accessed via a tokenized URL after logging in through the web interface.

**CSV Endpoint:**
```
https://inventory.copart.io/FTPLSTDM/salesdata.cgi?authKey=YPYU91EI
```

**Access Method:** Cookie-based authentication (no API keys)

---

## Authentication Requirements

### Required Headers

1. **User-Agent** (REQUIRED):
   ```
   Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36
   ```
   - Fixed UA prevents bot detection
   - Chrome desktop user agent required

2. **Referer** (REQUIRED):
   ```
   https://www.copart.com/downloadSalesData
   ```
   - Must reference the download page
   - Copart validates referer header

3. **Cookie** (REQUIRED for authenticated access):
   ```
   <session-cookie-value>
   ```
   - Obtained after member login
   - Typically expires after 24 hours
   - Must be refreshed before expiration

4. **Accept** (RECOMMENDED):
   ```
   text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8
   ```

5. **Accept-Language** (RECOMMENDED):
   ```
   en-US,en;q=0.9
   ```

---

## Manual Cookie Extraction (Initial Setup)

### Method 1: Browser Developer Tools

1. **Log in to Copart**:
   - Navigate to `https://www.copart.com/`
   - Click "Log In" → "Member"
   - Enter credentials and submit

2. **Navigate to CSV download page**:
   - Go to `https://www.copart.com/downloadSalesData`
   - Open browser Developer Tools (F12)
   - Go to Network tab

3. **Trigger CSV download**:
   - Click "Download CSV file" button
   - Find the request to `salesdata.cgi` in Network tab
   - Right-click → Copy → Copy as cURL

4. **Extract cookie**:
   ```bash
   # From cURL command, extract Cookie header value
   # Example:
   Cookie: _ga=GA1.2.xxx; _gid=GA1.2.yyy; copart_session=zzz; ...
   ```

5. **Store in environment**:
   ```bash
   export COPART_SESSION_COOKIE="<full-cookie-string>"
   ```

### Method 2: Browser Extension (Cookie Editor)

1. Install Cookie Editor extension (Chrome/Firefox)
2. Log in to Copart
3. Open Cookie Editor → Export cookies for copart.com
4. Copy cookie string
5. Store in `.env.runtime`:
   ```bash
   COPART_SESSION_COOKIE="copart_session=xxx; _ga=yyy; ..."
   ```

---

## Cookie Lifecycle

### Expiration

- **Typical lifespan**: 24 hours
- **Behavior after expiration**: HTTP 401/403 or redirect to login
- **Refresh strategy**: Extract new cookie before 24h expires

### Refresh Procedure

**Manual refresh** (required every 24 hours):

1. Log in to Copart via browser (as member)
2. Extract new cookie using Developer Tools
3. Update `COPART_SESSION_COOKIE` in environment
4. Restart `fetch-copart-csv.js` script

**Automated refresh** (future enhancement - NOT IMPLEMENTED):

- Selenium/Puppeteer bot to automate login flow
- Risk: Bot detection / CAPTCHA challenges
- Recommendation: Manual refresh preferred for stability

---

## Security Considerations

### DO NOT

- ❌ Commit cookies to git
- ❌ Log full cookie values (mask in logs)
- ❌ Share cookies between environments (dev/prod)
- ❌ Store cookies in plain text files

### DO

- ✅ Store cookie in `.env.runtime` (git-ignored)
- ✅ Use secrets manager (AWS Secrets Manager, Vault) for production
- ✅ Rotate cookie every 24 hours
- ✅ Monitor for authentication failures
- ✅ Alert on 3 consecutive auth failures

### Production Storage

**Recommended: AWS Secrets Manager / HashiCorp Vault**

```bash
# Store cookie securely
aws secretsmanager create-secret \
  --name vinops/copart/session-cookie \
  --secret-string "copart_session=xxx; ..."

# Retrieve in script
COPART_SESSION_COOKIE=$(aws secretsmanager get-secret-value \
  --secret-id vinops/copart/session-cookie \
  --query SecretString \
  --output text)
```

---

## Error Handling

### HTTP 401 Unauthorized

**Cause**: Cookie expired or invalid

**Action**:
1. Extract fresh cookie from browser
2. Update `COPART_SESSION_COOKIE`
3. Retry fetch

**Alert**: After 3 consecutive 401s → manual intervention required

### HTTP 403 Forbidden

**Cause**: IP blocked or rate limit exceeded

**Action**:
1. Wait 15 minutes before retry
2. Check if IP is blocked (test via browser)
3. Consider using residential proxy

**Alert**: Immediate notification (potential account suspension)

### HTTP 302 Redirect

**Cause**: Session expired, redirected to login page

**Action**: Same as 401 (cookie refresh required)

### HTTP 503 Service Unavailable

**Cause**: Copart maintenance or downtime

**Action**:
1. Retry after 5 minutes
2. Check Copart status page
3. If persistent >1 hour → alert

---

## Rate Limiting

**Copart Policy**: Undocumented, but observed limits suggest:

- **Max frequency**: ~1 request per 15 minutes (safe)
- **Burst tolerance**: Unknown (avoid rapid requests)
- **IP blocking**: Possible after repeated violations

**Our Strategy**:
- Fixed 15-minute interval (systemd timer)
- No burst requests
- Random jitter ±2 minutes (future enhancement)

---

## Testing Cookie Validity

**Test script**:

```bash
#!/bin/bash
# test-copart-cookie.sh

COOKIE="$COPART_SESSION_COOKIE"
CSV_URL="https://inventory.copart.io/FTPLSTDM/salesdata.cgi?authKey=YPYU91EI"

curl -I "$CSV_URL" \
  -H "User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/140.0.0.0 Safari/537.36" \
  -H "Referer: https://www.copart.com/downloadSalesData" \
  -H "Cookie: $COOKIE"

# Expected: HTTP/2 200
# If 401/403 → cookie invalid
```

---

## Monitoring & Alerts

### Metrics

- `copart_fetch_auth_failures_total` — Counter of 401/403 responses
- `copart_session_age_hours` — Gauge of cookie age (alert at 23 hours)

### Alert Rules

**Critical**:
- 3 consecutive auth failures → PagerDuty + disable auto-fetch

**Warning**:
- Session age >23 hours → Slack notification (preemptive refresh needed)

---

## Troubleshooting

### Symptom: "HTTP 401" every request

**Diagnosis**: Cookie expired or never set

**Fix**:
1. Verify `COPART_SESSION_COOKIE` env var is set
2. Log in to Copart via browser
3. Extract fresh cookie
4. Update environment

### Symptom: "HTTP 403" or "Access Denied"

**Diagnosis**: IP blocked or bot detected

**Fix**:
1. Test same URL via browser (same IP)
2. If browser works but script fails → UA/Referer mismatch
3. If browser also blocked → IP banned (contact Copart support or use proxy)

### Symptom: Downloaded file <1KB (error page)

**Diagnosis**: Authentication succeeded, but no data returned

**Fix**:
1. Check if CSV is genuinely empty (unlikely)
2. Verify authKey parameter in URL
3. Check Copart maintenance window

---

## Future Enhancements

### Automated Cookie Refresh

**Approach**: Headless browser (Puppeteer) to automate login flow

**Pros**:
- No manual intervention
- Seamless 24h refresh

**Cons**:
- Bot detection risk
- CAPTCHA challenges
- Increased complexity

**Decision**: Deferred to future sprint (manual refresh acceptable for now)

### Session Monitoring Dashboard

**Features**:
- Real-time cookie age display
- Last successful fetch timestamp
- Auth failure rate graph
- Preemptive refresh alerts

**Status**: Planned for S4 (observability sprint)

---

## References

- **Copart Diagnostic Report**: `docs/COPART_CSV_ACCESS_REPORT.md`
- **CSV URL Evolution**: `docs/CSV_URL_EVOLUTION.md`
- **UA Requirements**: `docs/UA_REQUIREMENTS.md`

---

**Status:** ✅ DOCUMENTED — Manual cookie refresh procedure operational
**Next Step:** Implement systemd timer for 15-minute scheduled fetching
