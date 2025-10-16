# Vinops ETL Scripts

This directory contains ETL scripts for CSV ingestion, automated fetching, and database testing.

## ETL Scripts

### 1. `fetch-copart-csv.js` - Automated CSV Fetcher (S1B MS-01)

Automatically downloads Copart CSV every ~15 minutes with cookie authentication.

**Usage:**
```bash
node scripts/fetch-copart-csv.js
node scripts/fetch-copart-csv.js --dry-run  # Test without triggering ingestion
```

**Features:**
- Cookie-based authentication
- User-Agent and Referer headers (required by Copart)
- Timestamped storage: `/var/data/vinops/raw/copart/YYYY/MM/DD/HHmm.csv`
- Lock file to prevent concurrent runs
- Automatic ingestion trigger on success
- Retry logic with exponential backoff (3 attempts)

**Requirements:**
- Node.js v20+
- `COPART_SESSION_COOKIE` environment variable (see `docs/COPART_AUTH_FLOW.md`)
- Write access to `/var/data/vinops/raw/copart/`

**Scheduling:**
- See `deploy/systemd/README.md` for systemd timer setup (15-minute intervals)

---

### 2. `ingest-copart-csv.js` - CSV Ingestion Script

Ingests Copart CSV file into RAW and Staging tables.

**Usage:**
```bash
node scripts/ingest-copart-csv.js /path/to/file.csv
```

**Features:**
- SHA256 idempotency (duplicate CSVs skipped)
- Batch insert (1000 rows per batch)
- Staging extraction with VIN/lot normalization
- Audit metrics (ingest_count, unknown_rate, parse_errors)

**Requirements:**
- Node.js v20+
- PostgreSQL connection (`DATABASE_URL` in `.env.runtime`)
- CSV file path

---

### 3. `detect-completions.js` - Auction Completion Detector (S1C Phase 1)

Detects auction completions by comparing consecutive CSV snapshots.

**Usage:**
```bash
node scripts/detect-completions.js
node scripts/detect-completions.js --grace-period=2  # Custom grace period (hours)
node scripts/detect-completions.js --dry-run  # Preview without updating
```

**Features:**
- CSV disappearance detection (~80% accuracy)
- VIN reappearance detection (~95% accuracy for "not sold")
- Marks disappeared lots as `pending_result`
- Marks reappeared VINs as `not_sold`
- Audit logging to `audit.completion_detections`

**Requirements:**
- Node.js v20+
- At least 2 CSV files ingested (for comparison)
- PostgreSQL connection

**See also:** `docs/COMPLETION_DETECTOR_ANALYSIS.md`

---

## Database Testing Scripts

### 1. `verify-db.sh` - Shell-based Database Verification

A comprehensive bash script that tests database connectivity and permissions.

**Usage:**
```bash
./scripts/verify-db.sh
```

**What it tests:**
- Network connectivity to database server
- Database authentication
- Connection information
- Database version
- Schema permissions
- Table access
- Connection pool simulation
- User permissions
- Application name setting

**Requirements:**
- `psql` command-line tool
- `deploy/.env.runtime` file with DATABASE_URL

---

### 2. `test-db-connection.js` - Node.js Connection Test

A Node.js script that tests the database connection using the same `pg` Pool configuration as the application.

**Usage:**
```bash
node scripts/test-db-connection.js
```

**What it tests:**
- Environment variable loading
- Database connection with pg Pool
- Simple queries
- Application name setting
- Session timeout configuration
- Schema and table access
- Connection pool functionality

**Requirements:**
- Node.js v20+
- `pg` and `dotenv` packages (installed via `npm install`)
- `deploy/.env.runtime` file with DATABASE_URL

---

### 3. `grant-permissions.sql` - Permission Grant Script

SQL script to be executed by your database administrator to grant necessary permissions.

**Usage:**

Send this file to your hosting provider and ask them to execute it, or run it yourself if you have admin access:

```bash
psql 'postgresql://admin_user:password@192.168.0.5:5432/vinops_db' -f scripts/grant-permissions.sql
```

**What it does:**
- Grants CONNECT privilege on the database
- Grants USAGE on the public schema
- Grants SELECT, INSERT, UPDATE, DELETE on all tables
- Grants USAGE on all sequences (for auto-increment)
- Sets default privileges for future objects
- Includes verification queries

---

## Quick Start Guide

### Step 1: Verify Environment Configuration

Make sure `deploy/.env.runtime` exists and contains your database connection string:

```bash
cat deploy/.env.runtime
```

### Step 2: Run Shell Verification

```bash
./scripts/verify-db.sh
```

If you see "permission denied", proceed to Step 3.

### Step 3: Request Permissions

Send `scripts/grant-permissions.sql` to your hosting provider with this message:

> Hi, I need to grant database permissions to the gen_user account.
> Please execute the attached SQL script on the vinops_db database.
> This will grant the necessary CONNECT and table access privileges.

### Step 4: Test with Node.js

Once permissions are granted, test the connection with:

```bash
node scripts/test-db-connection.js
```

### Step 5: Verify Application

If both tests pass, your application should be able to connect to the database.

---

## Troubleshooting

### Error: "permission denied for database"

**Solution:** The user doesn't have CONNECT privilege. Send `grant-permissions.sql` to your hosting provider.

### Error: "connection refused"

**Possible causes:**
- Database server is not running
- Firewall is blocking port 5432
- IP address is incorrect

**Solution:** Verify network connectivity with:
```bash
nc -zv 192.168.0.5 5432
```

### Error: "password authentication failed"

**Possible causes:**
- Incorrect password
- Password contains special characters that need URL encoding

**Solution:** Verify the connection string in `.env.runtime`. Special characters in passwords should be URL-encoded:
- `@` → `%40`
- `^` → `%5E`
- `#` → `%23`
- etc.

### Error: "database does not exist"

**Solution:** Verify the database name is correct. Contact your hosting provider to confirm the database name.

---

## Connection String Format

```
postgresql://username:password@host:port/database
```

Example:
```
postgresql://gen_user:J4nm7NGq%5ERn5pH@192.168.0.5:5432/vinops_db
```

Note: The `^` character is URL-encoded as `%5E`.

---

## Environment Variables Reference

| Variable | Default | Description |
|----------|---------|-------------|
| `DATABASE_URL` | - | PostgreSQL connection string (required) |
| `PGPOOL_MAX` | 10 | Maximum number of clients in the pool |
| `PGPOOL_IDLE_MS` | 10000 | Idle client timeout in milliseconds |
| `PG_STMT_MS` | 30000 | Statement timeout in milliseconds |
| `PG_IDLE_TX_MS` | 3000 | Idle transaction timeout in milliseconds |
| `PGSSL_DISABLE` | 0 | Set to 1 to disable SSL (for private networks) |

---

## Production Checklist

Before deploying to production:

- [ ] Database connection tested with `verify-db.sh`
- [ ] Node.js connection tested with `test-db-connection.js`
- [ ] Permissions granted via `grant-permissions.sql`
- [ ] `.env.runtime` file exists and is not committed to git
- [ ] Connection pool settings optimized for your workload
- [ ] SSL enabled if database is not on a trusted private network
- [ ] Database backups configured
- [ ] Monitoring and alerting set up for database errors

---

## Support

For more information, see:
- [Database Setup Guide](../docs/DATABASE_SETUP.md)
- [PostgreSQL Connection Pooling Docs](https://node-postgres.com/features/pooling)
