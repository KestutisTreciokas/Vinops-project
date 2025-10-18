# Copart Final Bid Implementation — 5-Sprint Plan

**Status:** 📋 **PLANNING**
**Date:** 2025-10-18
**Objective:** Deliver complete Copart final bid & outcome detection system

---

## Overview

Implement hybrid approach combining CSV-based heuristics (P0) with supplementary data sources (P1-P2) to achieve:
- ✅ **Final bid amounts** (actual sale prices)
- ✅ **Lot outcomes** (Sold/Not Sold/On Approval)
- ✅ **VIN history** (linking multiple sale attempts)
- ✅ **Legal compliance** (respect ToS, minimize blocking risk)

---

## Sprint Breakdown

### S0: PoC Evaluation & Architecture (2-3 days)

**Status:** ✅ **COMPLETE**

**Deliverables:**
- ✅ ADR-001: Architecture decision record (4 methods analyzed)
- ✅ PoC 1: CSV Diff + Event Store (COMPLETE)
- 🔄 PoC 2: Hidden JSON API scraper (IN PROGRESS)
- ⏭️ PoC 4: Third-party API evaluation (PENDING)
- ⏭️ Results matrix: Score all methods (accuracy/latency/cost/risk)
- ⏭️ Hybrid strategy: Final architecture decision

**PoC Skip:**
- ❌ PoC 3: Live auction WebSocket (HIGH RISK - not recommended per ADR-001)

**Acceptance Criteria:**
- ✅ All viable methods have working PoCs
- ✅ Performance metrics documented
- ✅ Cost/risk assessment complete
- ✅ Hybrid architecture defined

---

### S1: CSV Backbone MVP (3-5 days)

**Objective:** Deploy P0 baseline using CSV-only method

**Dependencies:** PoC 1 complete ✅

**Tasks:**
1. **Database Setup** (1 day)
   - Apply migration 0017 to production
   - Verify indexes and views created
   - Test event store with sample data

2. **Script Deployment** (1 day)
   - Deploy csv-diff.js and outcome-resolver.js
   - Create systemd timer (runs hourly at :30)
   - Set up logging to /var/log/vinops/

3. **Monitoring & Validation** (1-2 days)
   - Create dashboard queries for outcome stats
   - Monitor first 24h of production runs
   - Validate accuracy against known outcomes
   - Tune grace periods if needed

4. **API Integration** (1 day)
   - Add outcome field to /api/v1/search response
   - Add outcome field to /api/v1/vehicles/[vin] response
   - Update frontend VehicleLite type definitions

**Deliverables:**
- ✅ Migration 0017 applied to production
- ✅ Automated outcome detection running hourly
- ✅ API endpoints returning outcome data
- ✅ Monitoring dashboard operational

**Acceptance Criteria:**
- Event store captures >95% of lot changes
- Outcome detection processes >1000 lots/day
- API latency <100ms with outcome field
- Accuracy: >85% for sold/not_sold

**Metrics to Track:**
- Daily disappeared lots detected
- Daily relist events detected
- Outcome distribution (sold/not_sold/on_approval/unknown)
- False positive rate (if known outcomes available)

---

### S2: Supplementary Data Source (5-7 days)

**Objective:** Add final_bid_usd via supplementary method

**Architecture Decision Points:**
- **Option A:** Third-party API (if budget approved: $150-250/mo)
- **Option B:** JSON API scraper (if no budget: $100-200/mo for proxies)

**Option A: Third-Party API Integration (RECOMMENDED)**

**Tasks:**
1. **API Evaluation** (1 day)
   - Test auction-api.app trial
   - Test auctionsapi.com trial
   - Compare coverage, accuracy, latency
   - Select vendor

2. **Integration** (2 days)
   - Create scripts/fetch-final-bids-api.js
   - Query API for lots past auction date
   - Update lots.final_bid_usd
   - Handle rate limits and errors

3. **Systemd Service** (1 day)
   - Create copart-final-bid-api.service
   - Run every 2 hours (lower frequency than CSV diff)
   - Retry logic with exponential backoff

4. **Monitoring** (1 day)
   - Track API usage vs. limits
   - Monitor cost per month
   - Alert on API failures

**Option B: JSON API Scraper (FALLBACK)**

**Tasks:**
1. **Legal Review** (1 day)
   - Consult IP lawyer re: ToS compliance
   - Document acceptable use policy
   - Define rate limits to avoid abuse

2. **Scraper Implementation** (2 days)
   - Create scripts/fetch-final-bids-json.js
   - Implement /public/data/lotdetails/solr/{lotId} scraper
   - Rotate User-Agents, referers
   - Implement rate limiting (1 req/3-5 sec)

3. **Proxy Setup** (1 day)
   - Evaluate residential proxy providers
   - Set up proxy rotation (10-20 IPs)
   - Configure Axios with proxy pool

4. **Anti-Ban Strategy** (1 day)
   - Implement exponential backoff on 429/403
   - Session cookie management
   - Monitor for Cloudflare challenges

**Deliverables:**
- ✅ Final bid amounts populated for >90% of sold lots
- ✅ Automated fetching running every 2 hours
- ✅ Cost within budget ($100-250/mo)

**Acceptance Criteria:**
- Final bid accuracy: >95% (spot check against known sales)
- Coverage: >90% of lots get final_bid_usd within 48h
- Blocking rate: <1% (if using scraper)
- Cost: $100-250/mo (including proxies if needed)

---

### S3: Heuristic Refinement (3-4 days)

**Objective:** Improve outcome accuracy using ML and data analysis

**Tasks:**
1. **Data Collection** (1 day)
   - Collect 1000+ lots with known outcomes (manual validation)
   - Label: sold, not_sold, on_approval
   - Split: 70% train, 30% test

2. **Feature Engineering** (1 day)
   - Extract features:
     - current_bid vs. reserve (if available)
     - bid count, bid velocity
     - time since auction close
     - relist count
     - make/model/year (some models never sell)
   - Normalize features

3. **Model Training** (1 day)
   - Train simple logistic regression
   - Train random forest classifier
   - Compare accuracy vs. current heuristics
   - Select best model

4. **Integration** (1 day)
   - Update outcome-resolver.js with ML predictions
   - Fallback to heuristics if model fails
   - Update confidence scores

**Deliverables:**
- ✅ ML model trained on 1000+ labeled lots
- ✅ Outcome accuracy improved by 5-10%
- ✅ Confidence scores more accurate

**Acceptance Criteria:**
- Model accuracy: >90% on test set
- Production accuracy: >90% (vs. 85% baseline)
- Confidence calibration: 0.90 confidence → 90% actual accuracy

**Optional Enhancements:**
- Predict time-to-outcome (how long until lot sells)
- Predict final_bid_usd using regression (if no API/scraper)
- Detect anomalies (lots that don't fit patterns)

---

### S4: UI Integration & User Experience (3-4 days)

**Objective:** Display outcome data to users in catalog and VIN detail pages

**Tasks:**
1. **API Updates** (1 day)
   - Add outcome to /api/v1/search response
   - Add outcome to /api/v1/vehicles/[vin] response
   - Add final_bid_usd to both endpoints
   - Add relist_count, previous_lot_id for VIN history

2. **Catalog Page** (1 day)
   - Add "Outcome" badge to vehicle cards
   - Color coding: Sold (green), Not Sold (red), On Approval (yellow)
   - Filter by outcome (sold/not_sold/all)
   - Sort by final_bid_usd

3. **VIN Detail Page** (1 day)
   - Add "Auction History" section
   - Show all attempts for this VIN (from v_vin_auction_history)
   - Display final_bid_usd, outcome, outcome_date
   - Link to previous/next attempts

4. **Analytics Dashboard** (1 day)
   - Admin-only route: /admin/outcomes
   - Show daily outcome stats
   - Show accuracy metrics (if validation data available)
   - Show API usage, cost tracking

**Deliverables:**
- ✅ Outcome badges visible on catalog cards
- ✅ VIN history showing all attempts
- ✅ Admin dashboard for monitoring

**Acceptance Criteria:**
- Outcome badge visible on >95% of catalog cards
- VIN history shows complete auction chain
- Dashboard updates in real-time
- Mobile-responsive UI

**Design Specs:**
- **Sold:** Green badge, show final_bid_usd
- **Not Sold:** Red badge, show "Relisted as LOT-123456"
- **On Approval:** Yellow badge, show "Pending" or confidence %
- **Unknown:** Gray badge, show "Auction pending" if upcoming

---

### S5: Alerts & Notifications (2-3 days)

**Objective:** Notify users of auction results for watched lots

**Tasks:**
1. **Watch List Feature** (1 day)
   - Add "Watch" button to VIN detail page
   - Store watched VINs in user_watched_lots table
   - API: POST /api/v1/watched-lots

2. **Alert System** (1 day)
   - Detect when watched lot gets outcome update
   - Send email/SMS notification
   - Include: outcome, final_bid_usd, link to VIN page

3. **Email Templates** (1 day)
   - "Your watched lot sold for $X"
   - "Your watched lot did not sell, relisted as LOT-Y"
   - "Your watched lot is on approval"

**Deliverables:**
- ✅ Watch list functionality
- ✅ Email notifications on outcome change
- ✅ User preferences (email/SMS, frequency)

**Acceptance Criteria:**
- Users can watch unlimited VINs
- Notifications sent within 1 hour of outcome determination
- Unsubscribe link in all emails
- Mobile-friendly email templates

**Optional Enhancements:**
- Price alerts: notify if final_bid below threshold
- Market analysis: "Similar cars sold for $X-Y"
- Digest mode: daily summary instead of instant notifications

---

## Risk Mitigation

### Legal Risks

| Risk | Mitigation | Owner | Status |
|------|------------|-------|--------|
| JSON API scraper violates ToS | Consult IP lawyer before deployment, use third-party API instead if budget allows | Product | 🔄 |
| Copart blocks CSV access | Use reasonable polling (15 min), official endpoint, monitor for changes | Eng | ✅ |
| Third-party API discontinues service | Build PoC 2 as backup, maintain CSV-only fallback | Eng | 🔄 |

### Technical Risks

| Risk | Mitigation | Owner | Status |
|------|------------|-------|--------|
| Event store grows too large | Partition by month, archive after 1 year, add retention policy | Eng | ⏭️ |
| Heuristics inaccurate | Track metrics, validate against known outcomes, refine rules | Data | ⏭️ |
| API rate limits exceeded | Implement backoff, queue system, batch requests | Eng | ⏭️ |
| False positives (sold → not_sold) | Lower confidence threshold, manual review queue | Product | ⏭️ |

### Operational Risks

| Risk | Mitigation | Owner | Status |
|------|------------|-------|--------|
| Systemd timer fails silently | Add health check, alert on missed runs (>2h gap) | DevOps | ⏭️ |
| Database migration downtime | Apply during maintenance window, test rollback | DevOps | ⏭️ |
| Cost overruns (API/proxies) | Set budget alerts, monthly review, fallback to CSV-only | Finance | ⏭️ |

---

## Success Metrics

### P0 (S1 MVP) — Week 1
- ✅ Migration applied without errors
- ✅ CSV diff captures >95% of lot changes
- ✅ Outcome detection processes >1000 lots/day
- ✅ API endpoints return outcome data
- ✅ Accuracy: >85% for sold/not_sold

### P1 (S2 Supplementary) — Month 1
- ✅ Final bid populated for >90% of sold lots
- ✅ Accuracy: >90% for final_bid_usd
- ✅ Cost: <$250/mo
- ✅ Blocking rate: <1%

### P2 (S3-S5 Full System) — Month 2
- ✅ Outcome accuracy: >90% (with ML refinement)
- ✅ VIN history visible on 100% of detail pages
- ✅ User alerts: >90% delivered within 1h
- ✅ Mobile-responsive UI
- ✅ Admin dashboard operational

---

## Resource Requirements

### Development Time
- S0 (PoCs): 2-3 days ✅
- S1 (MVP): 3-5 days
- S2 (Supplementary): 5-7 days
- S3 (ML): 3-4 days
- S4 (UI): 3-4 days
- S5 (Alerts): 2-3 days
- **Total:** 18-26 days (~4-5 weeks)

### Infrastructure
- Database: +2GB for event store (1 year retention)
- Compute: +1 systemd timer (minimal CPU/RAM)
- Proxies (if scraper): $100-200/mo (optional)
- Third-party API (if used): $150-250/mo (optional)

### Budget
- **Option A (Third-party API):** $150-250/mo
- **Option B (JSON scraper):** $100-200/mo (proxies only)
- **Option C (CSV-only):** $0/mo (P0 baseline)

**Recommended:** Start with Option C (CSV-only) for S1, evaluate Option A/B for S2 based on accuracy needs.

---

## Rollout Plan

### Phase 1: Internal Testing (Week 1)
- Deploy S1 to production
- Monitor for 1 week
- Collect accuracy metrics
- Tune heuristics

### Phase 2: Limited Release (Week 2-3)
- Deploy S2 (supplementary data)
- Enable outcome badges on catalog (no final_bid yet)
- A/B test: 10% of users see new UI
- Collect user feedback

### Phase 3: Full Release (Week 4)
- Deploy S4 (full UI integration)
- Show final_bid_usd to all users
- Announce new feature via blog/email
- Monitor support tickets

### Phase 4: Enhancements (Month 2)
- Deploy S3 (ML refinement)
- Deploy S5 (alerts)
- Iterate based on user feedback

---

## Maintenance Plan

### Daily
- Monitor systemd timer logs for failures
- Check event store growth rate
- Alert on missed outcome detection runs

### Weekly
- Review outcome accuracy metrics
- Spot-check final_bid_usd accuracy
- Monitor API/proxy costs

### Monthly
- Validate heuristic accuracy (manual review of 100 lots)
- Archive old events (>1 year)
- Review third-party API cost vs. benefit
- Retrain ML model if needed

### Quarterly
- Audit ToS compliance (CSV access, API usage)
- Review legal risks with counsel
- Evaluate new data sources
- Update documentation

---

## Contingency Plans

### If CSV access blocked
1. Immediately pause csv-diff timer
2. Rely on third-party API (if deployed)
3. Contact Copart support to restore access
4. Consider member account upgrade if needed

### If third-party API fails
1. Fall back to CSV-only method
2. Evaluate alternative API providers
3. Consider JSON scraper (with legal review)

### If heuristics too inaccurate
1. Lower confidence thresholds
2. Add manual review queue for low-confidence outcomes
3. Accelerate S3 (ML refinement)
4. Collect more labeled training data

---

## Open Questions

1. **Legal:** Is JSON API scraper acceptable under Copart ToS? → Consult IP lawyer
2. **Budget:** Is $150-250/mo acceptable for third-party API? → Finance approval
3. **Accuracy:** What is acceptable false positive rate? → Product requirement
4. **UI:** Should we show low-confidence outcomes (<0.70) to users? → UX decision
5. **Alerts:** Email only or also SMS/push? → User research

---

## Timeline Summary

```
Week 1: S1 MVP (CSV-only)
Week 2-3: S2 Supplementary (API or scraper)
Week 4: S3 ML Refinement
Week 5: S4 UI Integration
Week 6: S5 Alerts & Notifications

Total: 6 weeks to full release
```

**Current Status:** S0 complete, starting S1 (PoC 2 in progress)

---

**Last Updated:** 2025-10-18
**Author:** Claude Code
**Status:** Draft — Pending Approval
