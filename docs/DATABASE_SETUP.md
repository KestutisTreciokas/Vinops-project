# Database Configuration Guide

## Overview
This document describes how to configure a stable connection from the VPS to the PostgreSQL database on the private network (192.168.0.5).

## Current Configuration

### Connection Details
- **Host**: 192.168.0.5 (private network)
- **Port**: 5432
- **Database**: vinops_db
- **Username**: gen_user
- **Password**: J4nm7NGq^Rn5pH

### Connection String
```
postgresql://gen_user:J4nm7NGq%5ERn5pH@192.168.0.5:5432/vinops_db
```

Note: The `^` character is URL-encoded as `%5E` in the connection string.

## Configuration Files

### Environment Variables
The database connection is configured in `/root/Vinops-project/deploy/.env.runtime`:

```bash
DATABASE_URL=postgresql://gen_user:J4nm7NGq%5ERn5pH@192.168.0.5:5432/vinops_db
PGPOOL_MAX=10
PGPOOL_IDLE_MS=10000
PG_STMT_MS=30000
PG_IDLE_TX_MS=3000
PGSSL_DISABLE=1
```

### Connection Pool Settings

The application uses `pg` (node-postgres) with connection pooling configured in `frontend/src/app/api/_lib/db.ts`:

- **Max connections**: 10 (configurable via `PGPOOL_MAX`)
- **Idle timeout**: 10 seconds (configurable via `PGPOOL_IDLE_MS`)
- **Statement timeout**: 30 seconds (configurable via `PG_STMT_MS`)
- **Idle transaction timeout**: 3 seconds (configurable via `PG_IDLE_TX_MS`)
- **SSL**: Disabled for private network connections

## Required Database Permissions

**IMPORTANT**: The `gen_user` must have the following privileges:

```sql
-- Grant CONNECT privilege
GRANT CONNECT ON DATABASE vinops_db TO gen_user;

-- Grant schema usage
GRANT USAGE ON SCHEMA public TO gen_user;

-- Grant table privileges (adjust as needed)
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gen_user;

-- Grant sequence privileges (for auto-increment columns)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gen_user;

-- Set default privileges for future tables
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gen_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO gen_user;
```

### Contact Hosting Provider
If you're getting "permission denied for database" errors, contact your hosting provider to:
1. Grant CONNECT privilege to `gen_user` on `vinops_db`
2. Verify that `gen_user` has the necessary table/schema permissions

## Testing the Connection

### From Command Line
```bash
psql 'postgresql://gen_user:J4nm7NGq%5ERn5pH@192.168.0.5:5432/vinops_db' -c '\conninfo'
```

### From Application
The application will automatically use the `DATABASE_URL` from the environment file when you run:
```bash
cd /root/Vinops-project
docker-compose -f docker-compose.yml -f deploy/docker-compose.override.yml up
```

## Troubleshooting

### Connection Refused
- Verify the database server is running
- Check that 192.168.0.5 is accessible from your VPS
- Verify port 5432 is open on the database server

### Permission Denied
- Contact hosting provider to grant CONNECT privilege
- Verify username and password are correct

### Connection Timeouts
- Check network connectivity between VPS and database
- Verify firewall rules allow traffic on port 5432
- Adjust `PGPOOL_IDLE_MS` and `PG_STMT_MS` if needed

## Connection Stability Features

The configuration includes several features for stable connections:

1. **Connection Pooling**: Reuses connections instead of creating new ones
2. **Idle Timeout**: Automatically closes idle connections after 10 seconds
3. **Statement Timeout**: Prevents long-running queries from hanging
4. **Idle Transaction Timeout**: Automatically closes idle transactions
5. **Error Handling**: Pool error events are logged for debugging
6. **Application Name**: Sets `application_name` to 'vinops.api.v1' for easier monitoring

## Security Notes

- Connection uses private network (192.168.0.5) - not exposed to internet
- SSL disabled since it's on a trusted private network
- Consider using SSL if the network is not fully trusted
- Store credentials securely - never commit .env.runtime to git
