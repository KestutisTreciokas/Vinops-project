# Systemd Service Configuration

**Sprint:** S1B — MS-S1B-01
**Purpose:** Automated Copart CSV fetching every 15 minutes

---

## Files

- `copart-etl.service` — Systemd service unit (runs fetch-copart-csv.js once)
- `copart-etl.timer` — Systemd timer unit (schedules service every 15 minutes)

---

## Installation

### 1. Copy systemd units to system directory

```bash
sudo cp deploy/systemd/copart-etl.service /etc/systemd/system/
sudo cp deploy/systemd/copart-etl.timer /etc/systemd/system/
```

### 2. Reload systemd daemon

```bash
sudo systemctl daemon-reload
```

### 3. Enable and start timer

```bash
# Enable timer to start on boot
sudo systemctl enable copart-etl.timer

# Start timer immediately
sudo systemctl start copart-etl.timer
```

### 4. Verify timer is active

```bash
# Check timer status
sudo systemctl status copart-etl.timer

# List all timers (copart-etl.timer should appear)
sudo systemctl list-timers

# Expected output:
# NEXT                        LEFT          LAST  PASSED  UNIT              ACTIVATES
# Thu 2025-10-16 19:00:00 MSK 3min 15s left n/a   n/a     copart-etl.timer  copart-etl.service
```

---

## Testing

### Manual trigger (test without waiting for timer)

```bash
# Trigger service manually
sudo systemctl start copart-etl.service

# Check service status
sudo systemctl status copart-etl.service

# View logs
sudo journalctl -u copart-etl.service -f
```

### Dry-run test (no ingestion)

```bash
# Run fetch script manually with dry-run flag
cd /root/Vinops-project
node scripts/fetch-copart-csv.js --dry-run
```

---

## Monitoring

### View logs

```bash
# Real-time logs
sudo journalctl -u copart-etl.service -f

# Last 50 lines
sudo journalctl -u copart-etl.service -n 50

# Logs from last hour
sudo journalctl -u copart-etl.service --since "1 hour ago"

# Logs with timestamps
sudo journalctl -u copart-etl.service -o short-iso
```

### Check timer schedule

```bash
# List next scheduled runs
sudo systemctl list-timers copart-etl.timer

# Detailed timer status
sudo systemctl status copart-etl.timer
```

---

## Maintenance

### Stop timer (disable auto-fetching)

```bash
# Stop timer (no new runs will be scheduled)
sudo systemctl stop copart-etl.timer

# Disable timer (won't start on boot)
sudo systemctl disable copart-etl.timer
```

### Restart timer (after configuration changes)

```bash
# Reload systemd configuration
sudo systemctl daemon-reload

# Restart timer
sudo systemctl restart copart-etl.timer
```

### Update cookie (when expired)

```bash
# 1. Extract fresh cookie from browser (see COPART_AUTH_FLOW.md)
# 2. Update /root/Vinops-project/deploy/.env.runtime
nano /root/Vinops-project/deploy/.env.runtime

# Add or update:
# COPART_SESSION_COOKIE="<new-cookie-value>"

# 3. No restart needed (env file is read on each run)
```

---

## Troubleshooting

### Timer not running

**Symptom**: No new CSV files appearing in `/var/data/vinops/raw/copart/`

**Diagnosis**:
```bash
# Check if timer is active
sudo systemctl is-active copart-etl.timer

# Check if timer is enabled
sudo systemctl is-enabled copart-etl.timer

# Check for errors
sudo journalctl -u copart-etl.timer -p err
```

**Fix**:
```bash
# Enable and start timer
sudo systemctl enable copart-etl.timer
sudo systemctl start copart-etl.timer
```

### Service failing immediately

**Symptom**: `sudo systemctl status copart-etl.service` shows "failed"

**Diagnosis**:
```bash
# Check service logs
sudo journalctl -u copart-etl.service -n 100

# Common errors:
# - "Lock file exists" → Previous run did not clean up
# - "HTTP 401" → Cookie expired
# - "ENOENT: no such file or directory" → Output directory not created
```

**Fix**:
```bash
# Remove stale lock file
sudo rm -f /var/run/copart-etl.lock

# Update cookie in .env.runtime
# Create output directory
sudo mkdir -p /var/data/vinops/raw/copart

# Retry
sudo systemctl start copart-etl.service
```

### Lock file stuck

**Symptom**: Service fails with "Lock file exists" error

**Diagnosis**:
```bash
cat /var/run/copart-etl.lock
# Shows PID and timestamp of stuck process
```

**Fix**:
```bash
# Check if process is still running
ps aux | grep <PID>

# If process is dead, remove lock
sudo rm /var/run/copart-etl.lock

# If process is alive, investigate why it's stuck, then kill if necessary
sudo kill <PID>
sudo rm /var/run/copart-etl.lock
```

---

## Uninstallation

```bash
# Stop and disable timer
sudo systemctl stop copart-etl.timer
sudo systemctl disable copart-etl.timer

# Remove systemd units
sudo rm /etc/systemd/system/copart-etl.service
sudo rm /etc/systemd/system/copart-etl.timer

# Reload systemd
sudo systemctl daemon-reload
```

---

## Security Notes

- Service runs as `root` (required for writing to `/var/data/vinops/raw`)
- Cookie stored in `.env.runtime` (ensure file permissions are 600)
- Logs may contain cookie fragments (systemd journal is root-only)
- Production: Consider using dedicated service account with limited permissions

---

## References

- Systemd Timer Docs: https://www.freedesktop.org/software/systemd/man/systemd.timer.html
- Copart Auth Flow: `docs/COPART_AUTH_FLOW.md`
- Fetch Script: `scripts/fetch-copart-csv.js`
