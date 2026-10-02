# Architecture

```
                        ┌────────────────────────── Cloudflare edge ───────────────────────────┐
 Browser ── HTTPS ──▶   │ DDoS · WAF (managed + custom) · Bot Mgmt · Rate limits · Waiting Room │
                        │ CDN cache: all public HTML/JS/CSS/images, /api/v1/reference/*         │
                        └───────────────┬──────────────────────────────┬────────────────────────┘
                     cache miss / portal│                              │ /api/v1/*  (same origin)
                                        ▼                              ▼
                              ┌──────────────────┐          ┌─────────────────────┐   Prometheus
                              │ web (Next.js)    │          │ api (NestJS) × N    │──▶ /metrics
                              │ static + ISR     │          │ stateless, KEDA     │
                              └───────┬──────────┘          └──┬──────┬──────┬────┘
                      build/revalidate│                         │      │      │ presigned POST/GET
                                      ▼                         │      │      ▼
                              ┌──────────────────┐   writes ┌───▼──┐ ┌─▼────────────┐   ┌──────────────┐
          editors ── Access ─▶│ cms (Payload)    │          │PgBou-│ │ Redis Cluster│   │ S3 (private, │
                              │ publish → revali-│          │ncer  │ │ sessions,OTP,│   │ SSE-KMS)     │◀── browser uploads
                              │ date + CDN purge │          └─┬──┬─┘ │ cache, RL,   │   └──────▲───────┘    directly
                              └───────┬──────────┘   primary  │  │ replicas│ BullMQ queues│          │
                                      ▼                       ▼  ▼         └─────┬────────┘          │
                              PostgreSQL (CMS DB)     PostgreSQL primary ──▶ replicas           │
                                                       (CNPG, WAL → S3, PITR)  ▲                │
                                                                 ▲             │ reads          │
                                                                 │ writes      │                │
                                                          ┌──────┴─────────────┴───┐            │
                                                          │ workers (BullMQ) × M    │────────────┘
                                                          │ submissions · drafts ·  │  PDF slips, exports
                                                          │ email/SMS · pdf · export│──▶ SMTP / SMS gateway
                                                          └─────────────────────────┘
```

## Components

### Public website (`apps/web`, route group `(site)`)
- Every public page uses `dynamic = 'force-static'` or `generateStaticParams`, so `next build`
  renders HTML once. Visitors get files from Cloudflare's cache. **No public request
  reaches PostgreSQL.**
- Content comes from the CMS at build time (`/api/site-content`, one aggregated JSON
  document) and falls back to the bundled seed content if the CMS is down, so a deploy
  never ships empty pages.
- Publishing in the CMS runs debounced hooks: `POST /api/revalidate` on the web app
  (re-renders the static pages once), then a Cloudflare cache purge.
- The interactive parts (news search, FAQ search, institution filter, events calendar,
  gallery lightbox, org chart) are client components that work over the static data.
- The "recruitment status" widget reads `/api/v1/reference/exercise`, which is CDN-cacheable
  for 30s.

### Portal and admin UIs (`apps/web` routes `/portal/*`, `/admin/*`)
- These are static app shells. All data comes from the API at runtime on the **same origin**
  (`/api/v1`), so session cookies are first-party and `SameSite` applies.
- `lib/api.ts` adds the CSRF header and retries `503/502/504` with jittered exponential
  backoff while showing a "you are in the queue" banner. That covers both the edge waiting
  room and pod-level load shedding.

### API (`apps/api`)
| Module | Responsibility |
|---|---|
| `auth` | Registration with email + phone OTP, login (argon2id, lockout, optional TOTP), password reset, 2FA |
| `applications` | Draft autosave, eligibility check, presigned uploads, queued submission, status, slip URL |
| `reference` | States/LGAs, form options, active exercise (CDN-cacheable), slip verification |
| `admin` | Admin auth (mandatory TOTP), exercises/rules/quotas, centres, applicant search, bulk status and screening, exports, dashboard, audit log, admin users |
| `contact` | Public contact form (Turnstile, honeypot, rate limits) → queue |
| `common` | Sessions (Redis), CSRF guard, auth/RBAC guard, Redis rate limiter, load shedding, metrics, error filter |

Global guard order: **CSRF → authentication/RBAC → rate limits**. The rate limiter can key
on the authenticated user as well as the IP and request body fields (for example the
account email on login).

### Workers (`apps/workers`)
One image, deployed as several Deployments selected with `WORKER_QUEUES`, so each queue
scales on its own backlog.

| Queue | Job |
|---|---|
| `submissions` | Insert application (idempotent), status history, delete draft, Redis status and counters, enqueue PDF and notifications |
| `drafts` | Debounced write-behind of Redis drafts to PostgreSQL (BullMQ deduplication, 30s) |
| `notifications` | Email (SMTP pool) and SMS (Termii or a generic gateway), rate limited to 200/s |
| `pdf` | A4 acknowledgement slip with passport photo and a signed verification QR code |
| `exports` | CSV/XLSX streamed from the replica with keyset batches; formula-injection safe |
| `documents` | Magic-byte verification and SHA-256 of uploads; AV-scan hook |
| `contact` | Store message (encrypted contact details), forward to the desk |
| `maintenance` | Reconcile dashboard counters every 5 min; daily retention clean-up |

## Key flows

### Submission (the hot write path)
1. `POST /applications/submit`: every step is re-validated with the shared Zod schemas,
   required documents are checked, and the eligibility engine runs against the exercise's
   closing date.
2. `SET appst:{exercise}:{user} … NX` atomically reserves the submission, so a double
   click or two pods cannot both submit.
3. The application ID `NA-26-RRI-XXXXXXXX-C` (Crockford base32 + check character) is
   generated without a database round-trip.
4. The application snapshot is enqueued **encrypted** (no plaintext PII in Redis). The API
   returns **202** with the application number.
5. A worker inserts the row (`ON CONFLICT DO NOTHING`, job id = application id, so it is
   idempotent and a retry converges), then updates counters and enqueues the PDF slip and
   email + SMS.
6. The dashboard polls `/applications/me`, which reads Redis and then a replica, and shows
   "Download PDF slip" when ready.

### Document upload
The browser asks the API for a **presigned POST**. Its policy pins content type, maximum
size and server-side encryption. The browser uploads **directly to S3**, then the API
confirms (HEAD check) and a worker verifies the magic bytes. Reads always use presigned
GET URLs that expire in 2–5 minutes.

### Status change and screening (admin)
Bulk actions run in one transaction with `SELECT … FOR UPDATE`, allowed-transition checks,
per-state quota checks (on shortlisting), status history rows and an audit log entry. The
applicants' cached status is invalidated, and email + SMS jobs are enqueued in bulk.

## Data model (PostgreSQL)
- `users`: applicants. Email and phone are stored as **ciphertext + HMAC blind index**
  (unique). The password is argon2id; there are an optional TOTP secret (encrypted), a
  lockout counter and a consent record.
- `applications`: plaintext columns only where they are needed to filter, sort or report
  (state, LGA, qualification, entry type, status, gender, age, height, names). The full form
  is in `pii_enc`. Indexes cover application number, (exercise, status), (exercise, state,
  status), LGA, entry type, qualification, email/phone hashes, the user, and a trigram index
  for name search.
- `drafts`, `documents`, `screening_centres`, `application_status_history`, `exports`,
  `contact_messages`.
- `audit_logs`: **append-only**. A trigger rejects UPDATE/DELETE, and the app role has no
  UPDATE/DELETE grant.
- `exercises`: rules (JSON, validated by `ruleSetSchema`) and per-state quotas. A partial
  unique index ensures at most one open exercise.
