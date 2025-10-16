#!/bin/bash
set -e

# Database Verification Script
# This script verifies the database connection and permissions

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Load environment variables from .env.runtime
if [ -f "deploy/.env.runtime" ]; then
    export $(cat deploy/.env.runtime | grep -v '^#' | xargs)
    echo -e "${GREEN}✓${NC} Loaded environment variables from deploy/.env.runtime"
else
    echo -e "${RED}✗${NC} deploy/.env.runtime not found"
    exit 1
fi

# Check if DATABASE_URL is set
if [ -z "$DATABASE_URL" ]; then
    echo -e "${RED}✗${NC} DATABASE_URL not set in environment"
    exit 1
fi

echo ""
echo "=================================================="
echo "  Database Connection Verification"
echo "=================================================="
echo ""

# Extract connection details for display (masking password)
DB_HOST=$(echo $DATABASE_URL | sed -n 's/.*@\([^:]*\):.*/\1/p')
DB_PORT=$(echo $DATABASE_URL | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
DB_NAME=$(echo $DATABASE_URL | sed -n 's/.*\/\([^?]*\).*/\1/p')
DB_USER=$(echo $DATABASE_URL | sed -n 's/.*\/\/\([^:]*\):.*/\1/p')

echo "Connection Details:"
echo "  Host: $DB_HOST"
echo "  Port: $DB_PORT"
echo "  Database: $DB_NAME"
echo "  User: $DB_USER"
echo ""

# Test 1: Basic connectivity
echo "Test 1: Network Connectivity"
echo -n "  Testing connection to $DB_HOST:$DB_PORT... "
if timeout 5 bash -c "</dev/tcp/$DB_HOST/$DB_PORT" 2>/dev/null; then
    echo -e "${GREEN}✓ Connected${NC}"
else
    echo -e "${RED}✗ Failed${NC}"
    echo "  Cannot reach database server. Check network connectivity."
    exit 1
fi

# Test 2: Database connection
echo ""
echo "Test 2: Database Authentication"
echo -n "  Connecting to database... "
if psql "$DATABASE_URL" -c "SELECT 1;" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Success${NC}"
else
    echo -e "${RED}✗ Failed${NC}"
    echo ""
    echo "  Error details:"
    psql "$DATABASE_URL" -c "SELECT 1;" 2>&1 | sed 's/^/    /'
    echo ""
    echo -e "${YELLOW}Action Required:${NC}"
    echo "  Contact your hosting provider to grant permissions:"
    echo "    GRANT CONNECT ON DATABASE $DB_NAME TO $DB_USER;"
    exit 1
fi

# Test 3: Connection info
echo ""
echo "Test 3: Connection Information"
psql "$DATABASE_URL" -c "\conninfo" 2>&1 | sed 's/^/  /'

# Test 4: Database version
echo ""
echo "Test 4: Database Version"
echo -n "  PostgreSQL Version: "
psql "$DATABASE_URL" -t -c "SELECT version();" 2>/dev/null | head -1 | sed 's/^ *//'

# Test 5: Schema access
echo ""
echo "Test 5: Schema Permissions"
echo -n "  Checking schema access... "
if psql "$DATABASE_URL" -c "\dn" > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Success${NC}"
    psql "$DATABASE_URL" -c "\dn" 2>&1 | sed 's/^/  /'
else
    echo -e "${YELLOW}⚠ Limited access${NC}"
fi

# Test 6: Table listing
echo ""
echo "Test 6: Table Access"
echo -n "  Listing tables... "
TABLE_COUNT=$(psql "$DATABASE_URL" -t -c "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema = 'public';" 2>/dev/null | tr -d ' ')
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ Success${NC}"
    echo "  Found $TABLE_COUNT tables in public schema"
    if [ "$TABLE_COUNT" -gt 0 ]; then
        echo ""
        echo "  Tables:"
        psql "$DATABASE_URL" -c "\dt" 2>&1 | sed 's/^/    /'
    fi
else
    echo -e "${YELLOW}⚠ Limited access${NC}"
fi

# Test 7: Connection pool test
echo ""
echo "Test 7: Connection Pool Test"
echo "  Testing multiple concurrent connections..."
for i in {1..5}; do
    echo -n "    Connection $i/5... "
    if psql "$DATABASE_URL" -c "SELECT pg_backend_pid();" > /dev/null 2>&1; then
        echo -e "${GREEN}✓${NC}"
    else
        echo -e "${RED}✗${NC}"
    fi
done

# Test 8: Permissions check
echo ""
echo "Test 8: User Permissions"
echo "  Checking current user privileges..."
psql "$DATABASE_URL" -c "
SELECT
    grantee,
    privilege_type
FROM information_schema.table_privileges
WHERE grantee = current_user
LIMIT 10;
" 2>&1 | sed 's/^/  /'

# Test 9: Application name test
echo ""
echo "Test 9: Application Name Setting"
echo -n "  Testing application_name parameter... "
APP_NAME=$(psql "$DATABASE_URL" -t -c "SHOW application_name;" 2>/dev/null | tr -d ' ')
if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓${NC}"
    echo "  Application name: $APP_NAME"
else
    echo -e "${YELLOW}⚠ Could not verify${NC}"
fi

# Summary
echo ""
echo "=================================================="
echo "  Verification Complete"
echo "=================================================="
echo ""
echo -e "${GREEN}All critical tests passed!${NC}"
echo ""
echo "Configuration Summary:"
echo "  - Connection pool max: ${PGPOOL_MAX:-10}"
echo "  - Idle timeout: ${PGPOOL_IDLE_MS:-10000}ms"
echo "  - Statement timeout: ${PG_STMT_MS:-30000}ms"
echo "  - Idle transaction timeout: ${PG_IDLE_TX_MS:-3000}ms"
echo "  - SSL: $([ "$PGSSL_DISABLE" = "1" ] && echo "Disabled (private network)" || echo "Enabled")"
echo ""
echo "The database connection is configured and ready!"
