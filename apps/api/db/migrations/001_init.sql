-- =============================================================================
-- Recruitment portal schema.
-- Personal data columns ending in _enc are AES-256-GCM ciphertext produced by
-- the application (see packages/shared/src/server/crypto.ts). *_hash columns
-- are HMAC blind indexes used for exact-match lookups.
-- Plaintext columns on `applications` are the minimum needed for filtering,
-- sorting and reporting (state, LGA, qualification, entry type, status...).
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;   -- gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pg_trgm;    -- fuzzy name search for officers

CREATE TYPE application_status AS ENUM ('submitted', 'under_review', 'shortlisted', 'invited_for_screening', 'rejected');
CREATE TYPE entry_type        AS ENUM ('regular', 'short_service', 'specialist');
CREATE TYPE admin_role        AS ENUM ('super_admin', 'recruitment_officer', 'reviewer', 'viewer');
CREATE TYPE exercise_state    AS ENUM ('draft', 'open', 'closed');
CREATE TYPE document_status   AS ENUM ('pending', 'verified', 'rejected');
CREATE TYPE export_status     AS ENUM ('queued', 'running', 'done', 'failed');

-- ----------------------------------------------------------------- applicants
CREATE TABLE users (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash         bytea NOT NULL UNIQUE,
  phone_hash         bytea NOT NULL UNIQUE,
  email_enc          bytea NOT NULL,
  phone_enc          bytea NOT NULL,
  surname            text  NOT NULL,
  first_name         text  NOT NULL,
  password_hash      text  NOT NULL,
  email_verified_at  timestamptz,
  phone_verified_at  timestamptz,
  totp_secret_enc    bytea,
  totp_enabled       boolean NOT NULL DEFAULT false,
  failed_logins      int NOT NULL DEFAULT 0,
  locked_until       timestamptz,
  consent_version    text NOT NULL,
  consent_at         timestamptz NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  -- NDPA right to erasure: PII is wiped and the row tombstoned.
  erased_at          timestamptz
);

-- ----------------------------------------------------------------- admins
CREATE TABLE admin_users (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email            text NOT NULL UNIQUE,
  full_name        text NOT NULL,
  role             admin_role NOT NULL,
  password_hash    text,               -- null until invite is accepted
  totp_secret_enc  bytea,
  totp_enabled     boolean NOT NULL DEFAULT false,
  active           boolean NOT NULL DEFAULT true,
  failed_logins    int NOT NULL DEFAULT 0,
  locked_until     timestamptz,
  last_login_at    timestamptz,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------- exercises
CREATE TABLE exercises (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code        text NOT NULL UNIQUE,
  title       text NOT NULL,
  state       exercise_state NOT NULL DEFAULT 'draft',
  opens_at    timestamptz NOT NULL,
  closes_at   timestamptz NOT NULL,
  rules       jsonb NOT NULL,
  quotas      jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by  uuid REFERENCES admin_users(id),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CHECK (closes_at > opens_at)
);
-- At most one exercise can be open at a time.
CREATE UNIQUE INDEX exercises_one_open ON exercises ((state)) WHERE state = 'open';

-- ----------------------------------------------------------------- drafts
-- Autosaved form data. Hot path writes go to Redis; a debounced worker job
-- persists them here so nothing is lost if Redis is flushed.
CREATE TABLE drafts (
  user_id      uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id  uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  data_enc     bytea NOT NULL,
  steps_done   text[] NOT NULL DEFAULT '{}',
  updated_at   timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, exercise_id)
);

-- ----------------------------------------------------------------- screening centres
CREATE TABLE screening_centres (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  exercise_id       uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  name              text NOT NULL,
  state_code        char(2) NOT NULL,
  address           text NOT NULL,
  capacity_per_day  int NOT NULL,
  created_at        timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX screening_centres_exercise_state ON screening_centres (exercise_id, state_code);

-- ----------------------------------------------------------------- applications
CREATE TABLE applications (
  id                         uuid PRIMARY KEY,
  application_no             text NOT NULL UNIQUE,
  exercise_id                uuid NOT NULL REFERENCES exercises(id),
  user_id                    uuid NOT NULL REFERENCES users(id),
  status                     application_status NOT NULL DEFAULT 'submitted',
  entry_type                 entry_type NOT NULL,
  trade                      text,
  surname                    text NOT NULL,
  first_name                 text NOT NULL,
  gender                     text NOT NULL,
  age                        smallint NOT NULL,
  state_code                 char(2) NOT NULL,
  lga                        text NOT NULL,
  qualification              text NOT NULL,
  height_cm                  numeric(5,1) NOT NULL,
  preferred_screening_state  char(2) NOT NULL,
  email_hash                 bytea NOT NULL,
  phone_hash                 bytea NOT NULL,
  pii_enc                    bytea NOT NULL,
  screening_centre_id        uuid REFERENCES screening_centres(id),
  screening_date             timestamptz,
  slip_key                   text,
  review_note                text,
  reviewed_by                uuid REFERENCES admin_users(id),
  submitted_at               timestamptz NOT NULL,
  updated_at                 timestamptz NOT NULL DEFAULT now(),
  UNIQUE (exercise_id, user_id)
);

-- Indexes for the queries the portal and admin actually run.
-- (application_no and (exercise_id,user_id) are covered by their UNIQUE constraints.)
CREATE INDEX applications_list      ON applications (exercise_id, submitted_at DESC, id DESC);
CREATE INDEX applications_status    ON applications (exercise_id, status, submitted_at DESC, id DESC);
CREATE INDEX applications_state     ON applications (exercise_id, state_code, status);
CREATE INDEX applications_lga       ON applications (exercise_id, state_code, lga);
CREATE INDEX applications_entry     ON applications (exercise_id, entry_type, status);
CREATE INDEX applications_qual      ON applications (exercise_id, qualification);
CREATE INDEX applications_email     ON applications (email_hash);
CREATE INDEX applications_phone     ON applications (phone_hash);
CREATE INDEX applications_user      ON applications (user_id);
CREATE INDEX applications_name_trgm ON applications USING gin ((lower(surname || ' ' || first_name)) gin_trgm_ops);

CREATE TABLE application_status_history (
  id              bigserial PRIMARY KEY,
  application_id  uuid NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
  from_status     application_status,
  to_status       application_status NOT NULL,
  actor_id        uuid REFERENCES admin_users(id),
  note            text,
  created_at      timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX status_history_app ON application_status_history (application_id, created_at);

-- ----------------------------------------------------------------- documents
CREATE TABLE documents (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id       uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  exercise_id   uuid NOT NULL REFERENCES exercises(id) ON DELETE CASCADE,
  type          text NOT NULL,
  s3_key        text NOT NULL,
  content_type  text NOT NULL,
  size_bytes    int NOT NULL,
  sha256        text,
  status        document_status NOT NULL DEFAULT 'pending',
  reject_reason text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, exercise_id, type)
);

-- ----------------------------------------------------------------- exports
CREATE TABLE exports (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by  uuid NOT NULL REFERENCES admin_users(id),
  format        text NOT NULL CHECK (format IN ('csv', 'xlsx')),
  filter        jsonb NOT NULL,
  status        export_status NOT NULL DEFAULT 'queued',
  s3_key        text,
  row_count     int,
  error         text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  completed_at  timestamptz
);
CREATE INDEX exports_requested_by ON exports (requested_by, created_at DESC);

-- ----------------------------------------------------------------- contact
CREATE TABLE contact_messages (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email_enc   bytea NOT NULL,
  phone_enc   bytea,
  subject     text NOT NULL,
  message     text NOT NULL,
  ip_hash     text NOT NULL,
  handled     boolean NOT NULL DEFAULT false,
  created_at  timestamptz NOT NULL DEFAULT now()
);

-- ----------------------------------------------------------------- audit log
-- Append-only: UPDATE/DELETE are rejected by trigger, and the app role is
-- granted INSERT/SELECT only (see 002_roles.sql).
CREATE TABLE audit_logs (
  id           bigserial PRIMARY KEY,
  actor_id     uuid,
  actor_email  text,
  actor_role   text,
  action       text NOT NULL,
  entity_type  text,
  entity_id    text,
  details      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip           inet,
  user_agent   text,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX audit_logs_created ON audit_logs (created_at DESC);
CREATE INDEX audit_logs_actor   ON audit_logs (actor_id, created_at DESC);
CREATE INDEX audit_logs_entity  ON audit_logs (entity_type, entity_id);

CREATE FUNCTION audit_logs_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'audit_logs is append-only';
END $$;
CREATE TRIGGER audit_logs_no_update BEFORE UPDATE OR DELETE ON audit_logs
  FOR EACH ROW EXECUTE FUNCTION audit_logs_immutable();
