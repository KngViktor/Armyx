# Scaling plan: 5 million requests/day, 3,000 rps bursts

## Traffic model
| | Value |
|---|---|
| Daily volume | 5,000,000 requests ≈ **58 rps average** |
| Recruitment-opening burst | **≥ 3,000 rps** at the edge, for minutes to hours |
| Assumed edge split at peak | ≈ 60% static website and assets (CDN hit, never reaches origin) / ≈ 40% portal API |
| Worst case planned for | **3,000 rps reaching the API** (for example after a cache purge, or if most traffic is portal traffic) |

## Layer by layer

### 1. Edge (Cloudflare): absorbs most traffic
- Every public page and asset is static and cached at the edge (`infra/cloudflare/main.tf`
  cache rules). `/api/v1/reference/*` responses are cacheable (`s-maxage` 30s–24h).
- **Waiting room** on `/portal`, `/api/v1/auth`, `/api/v1/applications`:
  `total_active_users` and `new_users_per_minute` are set from load-test capacity
  (defaults 60,000 active / 8,000 new per minute). Above that, visitors wait in a FIFO queue
  on a branded page instead of overloading the origin. A self-hosted alternative is the
  sharded Durable Object Worker in `infra/cloudflare/waiting-room-worker`.
- WAF, bot management and per-IP rate limits drop abusive traffic before it costs origin CPU.

### 2. API pods: stateless and horizontally scaled
- Measured **≈ 400 rps per 1-vCPU API process** at p95 ≈ 120 ms for the portal mix
  (docs/LOAD-TESTING.md).
- KEDA scales on **request rate** (target 150 rps/pod, ≈ 60% headroom for argon2 login bursts)
  **and** CPU (60%), scaling up by 100% or +10 pods every 15s.

| Load at API | Pods (1 vCPU each) at target | Notes |
|---|---|---|
| 60 rps (average day) | 6 (minimum, spread across 3 zones) | |
| 1,000 rps | 7 | |
| 3,000 rps | **20** | Pre-scale to 40 at T-1h (RUNBOOK) so no scale-up lag at opening |
| 6,000 rps (2× target) | 40 | Max is 80 |

- **Admission control** in every pod (`MAX_INFLIGHT`) answers `503 Retry-After` instead of
  queueing work it cannot finish. The portal client retries with jittered backoff behind a
  queue banner.

### 3. Queued writes
- Autosave → Redis (encrypted) + one debounced DB write per user per 30s.
- Submit → validated, reserved atomically and enqueued → **202** in ≈ 100–300 ms. Workers
  insert at their own pace. KEDA scales `workers-submissions` on backlog (threshold 500
  jobs per pod, 2–30 pods).
- Email/SMS/PDF are background jobs, rate limited to provider quotas, with retries and
  exponential backoff.

### 4. Database
- **PgBouncer** (transaction pooling, 3 replicas): thousands of client connections → ~60
  server connections per pool. API pods use small pools (`DB_POOL_MAX=15`).
- **Primary**: writes only (submissions via workers, autosave flushes, admin actions).
  Peak write rate is bounded by worker concurrency, not by visitor traffic.
- **Replicas** (2): status lookups that miss Redis, admin searches, dashboards, exports.
- **Indexes** on application number, email/phone hash, (exercise, status), (exercise, state,
  status), LGA, entry type, qualification, user, and a trigram index on name. Admin lists use
  **keyset pagination**, so they never do deep OFFSET scans. Counts are cached for 30s.
- Measured PostgreSQL CPU < 0.3 core at 800 rps of portal traffic.

### 5. Redis Cluster
Sessions (sliding TTL), OTPs, rate-limit counters, draft cache, status cache, the active
exercise and rules (5s in-process + 60s Redis), dashboard counters, and BullMQ. Run 3 shards
× (1 primary + 1 replica) with AOF. Queue keys share the `{bull}` hash slot, so size that
shard for queue throughput (a few thousand ops/s at peak).

### 6. Caching summary
| Data | Where | TTL / invalidation |
|---|---|---|
| Public pages | Cloudflare + Next static output | Until the CMS publishes (revalidate + purge) |
| States/LGAs/form options | CDN + browser | 24h |
| Active exercise + eligibility rules | CDN (30s), Redis (60s), in-process (5s) | Invalidated on admin edit/open/close |
| Applicant status | Redis | 15s–5min; deleted on every status change |
| Draft | Redis (encrypted) | 60 days; persisted to DB within 30s |
| Admin search counts | Redis | 30s |
| Dashboard | Redis counters (real time) | Reconciled from the replica every 5 min |

## Failure behaviour
| Failure | Effect | Mitigation |
|---|---|---|
| Traffic above capacity | Edge waiting room queues users; pods shed with 503 | Raise KEDA max / waiting-room limits |
| API pod loss | None (stateless) | PDB min 70%, zone spread |
| Primary DB failover | Writes pause for seconds; queued jobs retry | CNPG automatic promotion |
| Replica lag | Status may lag by seconds | Alert at 30s; route `armyx_ro` to the primary |
| Redis shard failover | Some sessions and rate counters lost | Replicas + AOF; drafts already persisted |
| SMS provider outage | Notifications delayed | Retries with backoff; email still sent |
