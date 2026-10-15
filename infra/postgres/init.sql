-- This initialization script is intended for the default local database name:
-- POSTGRES_DB=devflow. Docker runs it only when creating a new database volume.

SELECT 'CREATE DATABASE devflow_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'devflow_test')\gexec

\connect devflow;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";

\connect devflow_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
