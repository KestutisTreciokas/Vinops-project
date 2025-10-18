-- Migration: 0016_vehicles_filter_indexes.sql
-- Purpose: Add indexes on vehicles table columns used for catalog filtering
-- Author: Claude Code
-- Date: 2025-10-18
-- Sprint: S3 Performance Optimization

-- ============================================================
-- PROBLEM:
-- Filter dropdowns (make, model, model_detail, year) are extremely slow
-- because queries on vehicles table do full table scans with GROUP BY.
--
-- SOLUTION:
-- Add B-tree indexes on frequently queried columns to speed up:
-- 1. /api/v1/makes-models endpoint (GROUP BY make, model, model_detail, year)
-- 2. JOIN filters in /api/v1/search endpoint
-- 3. Catalog SSR queries with vehicle type filtering
-- ============================================================

BEGIN;

-- Index for filtering by make (used in ALL filter queries)
CREATE INDEX IF NOT EXISTS idx_vehicles_make
ON vehicles(make)
WHERE make IS NOT NULL AND make <> '';

-- Index for filtering by model (used when make is selected)
CREATE INDEX IF NOT EXISTS idx_vehicles_model
ON vehicles(model)
WHERE model IS NOT NULL AND model <> '' AND model <> 'ALL MODELS';

-- Index for filtering by model_detail (used when make+model are selected)
CREATE INDEX IF NOT EXISTS idx_vehicles_model_detail
ON vehicles(model_detail)
WHERE model_detail IS NOT NULL AND model_detail <> '';

-- Index for filtering by year (used for year dropdowns and range queries)
CREATE INDEX IF NOT EXISTS idx_vehicles_year
ON vehicles(year)
WHERE year IS NOT NULL;

-- Index for filtering by body type (used for vehicle type filtering: auto, moto, atv, etc.)
CREATE INDEX IF NOT EXISTS idx_vehicles_body
ON vehicles(body)
WHERE body IS NOT NULL;

-- Composite index for make+model queries (most common filter combination)
CREATE INDEX IF NOT EXISTS idx_vehicles_make_model
ON vehicles(make, model)
WHERE make IS NOT NULL AND make <> ''
  AND model IS NOT NULL AND model <> '' AND model <> 'ALL MODELS';

-- Composite index for make+model+model_detail queries
CREATE INDEX IF NOT EXISTS idx_vehicles_make_model_detail
ON vehicles(make, model, model_detail)
WHERE make IS NOT NULL AND make <> ''
  AND model IS NOT NULL AND model <> '' AND model <> 'ALL MODELS'
  AND model_detail IS NOT NULL AND model_detail <> '';

-- Composite index for body+make (vehicle type + make filtering)
CREATE INDEX IF NOT EXISTS idx_vehicles_body_make
ON vehicles(body, make)
WHERE body IS NOT NULL
  AND make IS NOT NULL AND make <> '';

-- Verify indexes were created
SELECT
  schemaname,
  tablename,
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'vehicles'
  AND indexname LIKE 'idx_vehicles_%'
ORDER BY indexname;

COMMIT;

-- ============================================================
-- EXPECTED PERFORMANCE IMPROVEMENT:
--
-- BEFORE: Filter queries scan 150k+ rows → 2-5 seconds
-- AFTER:  Index scans → <100ms
--
-- Affected endpoints:
-- - GET /api/v1/makes-models (all filter dropdowns)
-- - GET /api/v1/search (catalog pagination)
-- - SSR catalog page queries
-- ============================================================
