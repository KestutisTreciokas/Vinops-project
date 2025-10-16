-- Database Permissions Setup Script
-- This script should be executed by your hosting provider's database administrator
-- to grant the necessary permissions to the gen_user account

-- ============================================================
-- STEP 1: Grant database connection privilege
-- ============================================================
-- This is the minimum required permission to connect to the database
GRANT CONNECT ON DATABASE vinops_db TO gen_user;

-- ============================================================
-- STEP 2: Grant schema usage
-- ============================================================
-- Allow the user to access objects in the public schema
GRANT USAGE ON SCHEMA public TO gen_user;

-- ============================================================
-- STEP 3: Grant table privileges
-- ============================================================
-- Grant full CRUD permissions on all existing tables
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gen_user;

-- ============================================================
-- STEP 4: Grant sequence privileges
-- ============================================================
-- Required for auto-increment columns (serial, bigserial)
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gen_user;

-- ============================================================
-- STEP 5: Set default privileges for future objects
-- ============================================================
-- Ensure new tables created in the future will have these permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gen_user;

-- Ensure new sequences created in the future will have these permissions
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO gen_user;

-- ============================================================
-- STEP 6: Grant function execution (optional)
-- ============================================================
-- If your application uses stored procedures or functions
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA public TO gen_user;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT EXECUTE ON FUNCTIONS TO gen_user;

-- ============================================================
-- VERIFICATION QUERIES
-- ============================================================
-- Run these queries to verify the permissions were granted correctly

-- Check database-level permissions
SELECT datname, array_agg(privilege_type) as privileges
FROM (
    SELECT
        d.datname,
        (aclexplode(datacl)).privilege_type
    FROM pg_database d
    WHERE d.datname = 'vinops_db'
) sub
GROUP BY datname;

-- Check schema-level permissions
SELECT
    nspname as schema_name,
    array_agg(privilege_type) as privileges
FROM pg_namespace n
CROSS JOIN LATERAL aclexplode(nspacl) acl
WHERE n.nspname = 'public'
  AND acl.grantee = (SELECT oid FROM pg_roles WHERE rolname = 'gen_user')
GROUP BY nspname;

-- Check table permissions
SELECT
    schemaname,
    tablename,
    array_agg(privilege_type) as privileges
FROM pg_tables t
CROSS JOIN LATERAL (
    SELECT privilege_type
    FROM information_schema.table_privileges
    WHERE table_schema = t.schemaname
      AND table_name = t.tablename
      AND grantee = 'gen_user'
) priv
WHERE schemaname = 'public'
GROUP BY schemaname, tablename
ORDER BY tablename;

-- ============================================================
-- NOTES
-- ============================================================
-- 1. This script should be executed by a user with GRANT privileges
--    (typically the database owner or a superuser)
-- 2. If you need more restrictive permissions, adjust the GRANT statements
-- 3. The default privileges ensure future objects inherit permissions
-- 4. For production, consider creating specific roles with limited permissions
