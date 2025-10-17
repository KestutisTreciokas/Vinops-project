# Vinops Automation Deployment

This directory contains systemd services for automated Vinops operations.

## Services

### 1. Photo Scraper (`vinops-photo-scraper`)

**Purpose**: Automatically download photos from Copart for lots in the database.

**Schedule**: Every 8 hours (00:00, 08:00, 16:00)

**Batch Size**: 500 lots per run

**Configuration**:
- Uses ultra-conservative rate limiting (2.5 lots/min)
- 3 second pause between lots
- 500ms pause between images
- Session rotation every 25 lots
- Stealth mode enabled

**Performance**:
- ~150 lots/hour
- ~1,200 lots per 8-hour run
- Full backfill (153k lots): ~43 days of 24/7 operation

### 2. ETL Service (`vinops-etl`)

**Purpose**: Automatically fetch and ingest Copart CSV data.

**Schedule**: Every 15 minutes

**Actions**:
1. Downloads latest Copart CSV from `https://inventory.copart.io/FTPLSTDM/salesdata.cgi?authKey=YPYU91EI`
2. Saves to `/var/data/vinops/raw/copart/YYYY/MM/DD/HHMM.csv`
3. Ingests data into staging tables
4. Validates with audit metrics

**Expected Data**:
- ~150k rows per CSV
- ~15 minute update frequency
- ~250 KB compressed, ~90 MB uncompressed

## Deployment

### Initial Deployment

```bash
cd /root/Vinops-project
./deploy/deploy-automation.sh
```

This will:
1. Create log directories
2. Create data directories
3. Install systemd services
4. Enable and start timers

### Manual Operations

**Start services immediately (without waiting for timer)**:
```bash
systemctl start vinops-photo-scraper.service
systemctl start vinops-etl.service
```

**View logs**:
```bash
# Real-time logs
tail -f /var/log/vinops/photo-scraper.log
tail -f /var/log/vinops/etl.log

# Recent logs
journalctl -u vinops-photo-scraper.service -f
journalctl -u vinops-etl.service -f
```

**Check service status**:
```bash
systemctl status vinops-photo-scraper.timer
systemctl status vinops-etl.timer
systemctl list-timers vinops-*
```

**Stop services**:
```bash
systemctl stop vinops-photo-scraper.timer
systemctl stop vinops-etl.timer
```

**Disable services** (prevent from starting on boot):
```bash
systemctl disable vinops-photo-scraper.timer
systemctl disable vinops-etl.timer
```

## Monitoring

### Photo Scraper Metrics

**Database queries**:
```sql
-- Total lots with photos
SELECT COUNT(DISTINCT lot_id) as lots_with_photos FROM images WHERE lot_id IS NOT NULL;

-- Total images archived
SELECT COUNT(*) as total_images FROM images;

-- Photos per lot
SELECT lot_id, COUNT(*) as photo_count
FROM images
GROUP BY lot_id
ORDER BY photo_count DESC
LIMIT 20;

-- Lots without photos
SELECT COUNT(*) as lots_without_photos
FROM lots
WHERE status = 'active'
  AND id NOT IN (SELECT DISTINCT lot_id FROM images WHERE lot_id IS NOT NULL);

-- Recent uploads
SELECT vin, lot_id, seq, bytes, created_at
FROM images
ORDER BY created_at DESC
LIMIT 20;
```

### ETL Metrics

**Database queries**:
```sql
-- Recent ingestion stats
SELECT * FROM audit.v_ingest_count ORDER BY last_ingest DESC LIMIT 10;

-- Unknown rate (should be < 1%)
SELECT * FROM audit.v_unknown_rate;

-- Parse errors (should be 0)
SELECT * FROM audit.v_parse_errors;

-- Latest CSV ingestion
SELECT MAX(ingested_at) as last_ingest, COUNT(*) as total_rows
FROM staging.copart_raw;
```

### Log Monitoring

**Watch for errors**:
```bash
# Photo scraper errors
grep -i error /var/log/vinops/photo-scraper.log

# ETL errors
grep -i error /var/log/vinops/etl.log

# Authentication failures
grep "Login failed" /var/log/vinops/photo-scraper.log

# Rate limiting issues
grep "429\|blocked\|captcha" /var/log/vinops/photo-scraper.log
```

## Troubleshooting

### Photo Scraper Issues

**Problem**: Authentication failures
```bash
# Check credentials are set correctly
grep COPART /etc/systemd/system/vinops-photo-scraper.service

# View login screenshots
ls -lh /tmp/login-*.png
```

**Problem**: No photos found
```bash
# Check lot has external ID
psql -d vinops_db -c "SELECT id, vin, lot_external_id FROM lots WHERE id = 123456;"

# View page screenshot
ls -lh /tmp/lot-*.png
```

**Problem**: Service not running
```bash
# Check service status
systemctl status vinops-photo-scraper.service

# View recent errors
journalctl -u vinops-photo-scraper.service -n 50
```

### ETL Issues

**Problem**: CSV download fails
```bash
# Test CSV URL manually
curl -L -o /tmp/test.csv "https://inventory.copart.io/FTPLSTDM/salesdata.cgi?authKey=YPYU91EI"

# Check if URL has changed
grep CSV_URL /var/log/vinops/etl.log
```

**Problem**: Ingestion fails
```bash
# Check database connection
psql -d vinops_db -c "SELECT version();"

# Verify CSV file exists
ls -lh /var/data/vinops/raw/copart/$(date +%Y/%m/%d)/
```

## Timeline & Estimates

### Photo Scraper Backfill

- **Total lots**: 153,972
- **Lots completed**: 107
- **Remaining**: 153,865

**With current schedule (3 runs per day, 8 hours each)**:
- 500 lots × 3 runs = 1,500 lots/day
- 153,865 ÷ 1,500 = **103 days (~3.4 months)**

**Accelerated schedule (24/7 continuous)**:
- 150 lots/hour × 24 hours = 3,600 lots/day
- 153,865 ÷ 3,600 = **43 days (~1.5 months)**

### ETL Updates

- **Frequency**: Every 15 minutes
- **Updates per day**: 96
- **Data freshness**: Max 15 minutes old

## Security Notes

**Credentials in systemd services**:
- Copart credentials are stored in plaintext in systemd unit files
- Files are readable only by root
- Consider using systemd credential encryption for enhanced security

**R2 access keys**:
- R2 credentials provide write access to production bucket
- Rotate keys periodically
- Monitor for unauthorized access

## Cost Estimates

### Photo Storage (R2)

**Assumptions**:
- 153,000 lots × 12 photos/lot = 1,836,000 images
- Average size: 250 KB per image
- Total storage: ~440 GB

**Costs**:
- Storage: 440 GB × $0.015/GB/month = **$6.60/month**
- Upload operations: 1.8M × $4.50/million = **$8.10 one-time**
- **Total first month**: ~$15

### CSV Storage

**Assumptions**:
- 96 CSVs per day × 90 MB = 8.6 GB/day
- Retention: 30 days = 260 GB

**Costs**:
- Storage: 260 GB × $0.015/GB/month = **$3.90/month**
- Download operations: negligible

**Total monthly cost**: ~$10/month after initial upload

## Files

- `vinops-photo-scraper.service` - Systemd service for photo scraper
- `vinops-photo-scraper.timer` - Timer for photo scraper (every 8 hours)
- `vinops-etl.service` - Systemd service for ETL
- `vinops-etl.timer` - Timer for ETL (every 15 minutes)
- `deploy-automation.sh` - Deployment script
- `README.md` - This file

## Related Documentation

- `../docs/PHOTO_SCRAPER_READY.md` - Photo scraper implementation guide
- `../docs/PHOTO_SCRAPER_SAFE_CONFIG.md` - Safety configuration details
- `../docs/PRODUCTION_HANDOFF.md` - Production deployment guide
- `../docs/ETL_RAW_STAGING.md` - ETL pipeline documentation
