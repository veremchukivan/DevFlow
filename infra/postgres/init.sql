-- This script is idempotent and is run by the db-bootstrap Compose service.
-- It is intended for the default local database names devflow and devflow_test.

\getenv migrator_password POSTGRES_MIGRATOR_PASSWORD
\getenv runtime_password POSTGRES_RUNTIME_PASSWORD

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'devflow_migrator') THEN
    CREATE ROLE devflow_migrator LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'devflow_runtime') THEN
    CREATE ROLE devflow_runtime LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT;
  END IF;
END
$$;

ALTER ROLE devflow_migrator PASSWORD :'migrator_password';
ALTER ROLE devflow_runtime PASSWORD :'runtime_password';

SELECT 'CREATE DATABASE devflow_test'
WHERE NOT EXISTS (SELECT FROM pg_database WHERE datname = 'devflow_test')\gexec

\connect postgres
ALTER DATABASE devflow OWNER TO devflow_migrator;
ALTER DATABASE devflow_test OWNER TO devflow_migrator;
GRANT CONNECT ON DATABASE devflow TO devflow_runtime;
GRANT CONNECT ON DATABASE devflow_test TO devflow_runtime;

\connect devflow;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
DO $$
DECLARE
  relation record;
  type_record record;
BEGIN
  FOR relation IN
    SELECT c.relkind, c.relname, n.nspname
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'drizzle') AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I OWNER TO devflow_migrator', relation.nspname, relation.relname);
  END LOOP;

  FOR type_record IN
    SELECT t.typname
    FROM pg_type t
    INNER JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype IN ('e', 'd')
  LOOP
    EXECUTE format('ALTER TYPE public.%I OWNER TO devflow_migrator', type_record.typname);
  END LOOP;
END
$$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'drizzle') THEN
    ALTER SCHEMA drizzle OWNER TO devflow_migrator;
  END IF;
END
$$;
GRANT USAGE ON SCHEMA public TO devflow_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO devflow_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO devflow_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE devflow_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO devflow_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE devflow_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO devflow_runtime;

\connect devflow_test;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
DO $$
DECLARE
  relation record;
  type_record record;
BEGIN
  FOR relation IN
    SELECT c.relkind, c.relname, n.nspname
    FROM pg_class c
    INNER JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname IN ('public', 'drizzle') AND c.relkind IN ('r', 'p')
  LOOP
    EXECUTE format('ALTER TABLE %I.%I OWNER TO devflow_migrator', relation.nspname, relation.relname);
  END LOOP;

  FOR type_record IN
    SELECT t.typname
    FROM pg_type t
    INNER JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public' AND t.typtype IN ('e', 'd')
  LOOP
    EXECUTE format('ALTER TYPE public.%I OWNER TO devflow_migrator', type_record.typname);
  END LOOP;
END
$$;
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'drizzle') THEN
    ALTER SCHEMA drizzle OWNER TO devflow_migrator;
  END IF;
END
$$;
GRANT USAGE ON SCHEMA public TO devflow_runtime;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO devflow_runtime;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO devflow_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE devflow_migrator IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO devflow_runtime;
ALTER DEFAULT PRIVILEGES FOR ROLE devflow_migrator IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO devflow_runtime;
