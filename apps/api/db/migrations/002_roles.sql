-- Least-privilege database roles. Passwords are set out-of-band by the DBA /
-- secret manager; these statements are idempotent.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'armyx_app') THEN
    CREATE ROLE armyx_app NOLOGIN;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'armyx_readonly') THEN
    CREATE ROLE armyx_readonly NOLOGIN;
  END IF;
END $$;

GRANT USAGE ON SCHEMA public TO armyx_app, armyx_readonly;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO armyx_app;
REVOKE UPDATE, DELETE ON audit_logs FROM armyx_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO armyx_app;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO armyx_readonly;
