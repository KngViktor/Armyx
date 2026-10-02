# Armyx — Nigerian Army website & online recruitment portal

A production-oriented monorepo for the official Nigerian Army website and its
high-traffic online recruitment portal. It is built to absorb the spike when a
recruitment exercise opens: about **5 million requests a day** (≈60 rps average) with
bursts of **3,000+ rps**.

| Part | What it is | Tech |
|---|---|---|
| `apps/web` | Public website (statically generated, CDN-served), applicant portal UI, admin console UI | Next.js 16 (App Router), TypeScript, Tailwind CSS 4 |
| `apps/cms` | Content management for the website (news, events, pages, downloads, tenders…) | Payload CMS 3 (PostgreSQL) |
| `apps/api` | Stateless recruitment API (applicant + admin) | NestJS 11, PostgreSQL (primary + replicas via PgBouncer), Redis, BullMQ, S3 |
| `apps/workers` | Background jobs: submissions, draft persistence, email/SMS, PDF slips, exports, document checks | BullMQ workers |
| `packages/shared` | Zod schemas, eligibility engine, 37 states / 774 LGAs, queue contracts, field encryption, seed content | TypeScript |
| `infra/` | Docker, Kubernetes (Kustomize + KEDA + CloudNativePG), Cloudflare (Terraform + waiting-room Worker), monitoring | |
| `loadtest/` | k6 recruitment-opening spike test and results | k6 |

> **Status of content.** All names, contacts, figures, photographs and news in the
> seed data are **samples**. The Directorate of Army Public Relations must replace
> them with officially cleared content (through the CMS) before go-live. The crest
> and photos in `apps/web/public/images` came from the project brief. They are
> placeholders and must be swapped for officially licensed assets.

## Documentation

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md): system design, request flows, data model
- [docs/SCALING.md](docs/SCALING.md): capacity plan for 5M requests/day and 3,000 rps bursts
- [docs/LOAD-TESTING.md](docs/LOAD-TESTING.md): k6 scenarios, how to run them, **measured results**
- [docs/SECURITY.md](docs/SECURITY.md): security controls and Nigeria Data Protection Act 2023 compliance
- [docs/DEPLOYMENT.md](docs/DEPLOYMENT.md): Kubernetes, Cloudflare, backups/PITR, secrets, CI/CD
- [docs/RUNBOOK.md](docs/RUNBOOK.md): operating a recruitment opening, alerts, incident steps

## Quick start (local, without Docker)

Requirements: Node 22, pnpm 10, PostgreSQL 16, Redis 7, and any S3-compatible store
(SeaweedFS/MinIO). An SMTP sink such as Mailpit is optional.

```bash
pnpm install
cp .env.example .env          # then fill in the keys below
openssl rand -base64 32       # -> DATA_ENCRYPTION_KEYS="1:<value>"
openssl rand -base64 32       # -> BLIND_INDEX_KEY
openssl rand -hex 24          # -> IP_HASH_SALT
# For local dev also set OTP_FIXED_CODE=123456 and S3_SSE= (empty) if your S3 store lacks SSE.

createdb armyx && createdb armyx_cms
pnpm build:shared
pnpm db:migrate               # API schema (apps/api/db/migrations)
pnpm db:seed                  # admins, open exercise, screening centres, 2,000 sample applicants
node apps/api/scripts/create-bucket.mjs   # documents bucket + CORS (dev stores only)
pnpm cms:seed                 # CMS content from packages/shared/src/content/seed.ts

pnpm dev:api        # http://localhost:4000/api/v1
pnpm dev:workers
pnpm dev:cms        # http://localhost:3001/admin
API_INTERNAL_URL=http://localhost:4000 pnpm dev:web   # http://localhost:3000
```

Seeded logins (development only; change them immediately anywhere else):

| Who | Login | Password |
|---|---|---|
| Admin console `/admin` | `superadmin@army.mil.ng`, `officer@…`, `reviewer@…`, `viewer@…` | `SEED_ADMIN_PASSWORD` (default `ChangeMe!Army2026`). 2FA enrolment is forced at first sign-in |
| Applicant portal `/portal` | `loadtest+<n>@example.ng` (n < `SEED_APPLICANTS`) | `SEED_APPLICANT_PASSWORD` (default `Applicant#2026`) |
| CMS `/admin` on :3001 | `cms-admin@army.mil.ng` | `CMS_ADMIN_PASSWORD` (default `ChangeMe!Cms2026`) |

The end-to-end smoke test runs the whole applicant and admin journey against a running stack:

```bash
cd apps/api && npx tsx --env-file=../../.env scripts/smoke.ts
```

## Quick start (Docker Compose)

```bash
cp .env.example .env   # fill in keys as above
docker compose up -d --build
docker compose run --rm migrate && docker compose run --rm seed
open http://localhost:8080        # website + portal + admin (Caddy edge, same-origin routing)
open http://localhost:3001/admin  # CMS
open http://localhost:8025        # Mailpit: OTP and notification emails
```

Compose runs a PostgreSQL primary with a streaming read replica behind PgBouncer,
plus Redis, SeaweedFS (S3), Mailpit, the CMS, API, workers, web, and a Caddy edge
that mimics production path routing.

## Environment variables

All variables are documented inline in [`.env.example`](.env.example). The important ones:

| Variable | Used by | Purpose |
|---|---|---|
| `DATABASE_URL` / `DATABASE_REPLICA_URL` | api, workers | Primary (writes) and replica (reads) **through PgBouncer** |
| `MIGRATION_DATABASE_URL` | migrate job | Direct primary connection (session-level advisory lock) |
| `REDIS_URL` or `REDIS_CLUSTER_NODES` | api, workers | Sessions, OTPs, caches, rate limits, BullMQ |
| `DATA_ENCRYPTION_KEYS`, `DATA_ENCRYPTION_KEY_VERSION` | api, workers | AES-256-GCM field encryption keys (`ver:base64`, rotation supported) |
| `BLIND_INDEX_KEY` | api, workers | HMAC key for searchable hashes of email/phone and slip signatures |
| `S3_*` | api, workers | Document storage; `S3_PUBLIC_ENDPOINT` is the host browsers upload to |
| `TURNSTILE_SECRET` / `NEXT_PUBLIC_TURNSTILE_SITE_KEY` | api / web | Bot protection on registration, login and contact (required in production) |
| `COOKIE_SECURE`, `CORS_ORIGINS`, `TRUST_PROXY_HOPS` | api | Cookie and origin security behind Cloudflare |
| `MAX_INFLIGHT` | api | Per-pod admission control (load shedding with 503 + Retry-After) |
| `SMTP_URL`, `SMS_PROVIDER`, `SMS_API_*` | workers | Email and SMS delivery |
| `CMS_URL`, `REVALIDATE_SECRET` | web | Build-time content source; on-demand revalidation webhook |
| `PAYLOAD_SECRET`, `CMS_DATABASE_URL`, `WEB_REVALIDATE_URL`, `CLOUDFLARE_*` | cms | CMS runtime and the publish → revalidate → CDN purge pipeline |
| `OTP_FIXED_CODE` | api | **Test/staging only.** The API refuses to start in production if it is set |

## How it scales (summary)

1. **Public pages never touch a database.** Every public route is prerendered at
   build time and cached at Cloudflare's edge. When an editor publishes, the CMS calls
   `/api/revalidate` and purges the CDN.
2. **Edge first.** Cloudflare WAF, bot management, per-IP rate limits and a
   **virtual waiting room** (managed product, or the sharded Durable Object Worker in
   `infra/cloudflare/waiting-room-worker`) admit users at a controlled rate.
3. **Stateless API pods** autoscale with KEDA on CPU **and** request rate. Every pod also
   sheds load with `503 Retry-After` beyond `MAX_INFLIGHT`, which the portal turns into a
   "you are in the queue" banner with automatic retries.
4. **Writes are queued.** Autosaves land in Redis and persist through a debounced job.
   Submissions are validated synchronously, reserved atomically in Redis, then returned as
   **202 with the application number**. Workers insert them, generate the PDF slip and send
   email/SMS.
5. **Reads go to replicas and caches.** Dashboards, searches and status checks use read
   replicas through PgBouncer and Redis caches, with keyset pagination on indexed columns.

See [docs/SCALING.md](docs/SCALING.md) for the numbers and [docs/LOAD-TESTING.md](docs/LOAD-TESTING.md) for measured results.

## Repository scripts

| Command | Description |
|---|---|
| `pnpm build` | Build every package |
| `pnpm typecheck` | Type-check every package |
| `pnpm test` | Unit tests (eligibility engine, application IDs, encryption, TOTP, file sniffing) |
| `pnpm db:migrate` / `pnpm db:seed` | API database migrations / sample data |
| `pnpm cms:seed` | Load sample website content into the CMS |
| `k6 run loadtest/recruitment-spike.js` | Spike test (see docs/LOAD-TESTING.md) |
