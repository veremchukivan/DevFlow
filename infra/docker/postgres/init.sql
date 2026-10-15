-- =============================================================================
-- DevFlow PostgreSQL Initialization Script
-- Automatically executed on container first-run via /docker-entrypoint-initdb.d
-- =============================================================================

-- 1. Create the dedicated integration test database if it does not already exist
SELECT 'CREATE DATABASE devflow_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'devflow_test')\gexec

-- 2. Setup extensions on the primary database (devflow)
\connect devflow;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

-- 3. Setup extensions on the test database (devflow_test)
\connect devflow_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
