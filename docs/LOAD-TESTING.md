# Load testing (k6)

## Scripts
| File | Purpose |
|---|---|
| `loadtest/recruitment-spike.js` | The recruitment-opening spike: baseline 60 rps (5M/day) for 1 min → ramp to `TARGET_RPS` in 30s → hold `HOLD` → decay. A submission wave runs at the same time. |
| `loadtest/smoke.js` | 30s sanity check before a big run |
| `loadtest/lib.js` | Helpers: login, CSRF, cookie sharing across pods, per-VU client IPs |

**`portal_mix`** (ramping arrival rate) is signed-in applicants:

| Request | Share | Notes |
|---|---|---|
| `GET /applications/me` (status) | 30% | Redis → replica |
| `GET /reference/exercise` | 20% | CDN-cacheable in production; hits the origin in this test |
| `GET /reference/states/:code/lgas` | 12% | CDN-cacheable in production |
| `GET /applications/draft` | 18% | Redis + documents query |
| `PUT /applications/draft` (autosave) | 15% | Full Zod validation + encrypted Redis write + debounced job |
| `POST /auth/login` | 3% | argon2id verify (the most expensive request) |
| `POST /auth/register` | 2% | argon2id hash + 2 OTP jobs + DB insert |

**`submissions`** (per-VU): `SUBMITTERS` applicants each log in, save all 6 sections
(`THINK` seconds per section, default a compressed 2s), then submit. Like the real portal
client, they retry `503` responses after `Retry-After`.

Public website pages are **not** included because they are static files served from the CDN
and never reach the origin.

```bash
# staging / production-like (same origin behind Cloudflare; whitelist the k6 runners or use k6 Cloud)
k6 run -e TARGET_RPS=3000 -e HOLD=5m -e SUBMITTERS=3000 -e API_BASES=https://staging.army.mil.ng loadtest/recruitment-spike.js
# local (two API processes, seeded with SEED_APPLICANTS=20000)
k6 run -e TARGET_RPS=800 -e HOLD=3m -e SUBMITTERS=600 -e API_BASES=http://localhost:4000,http://localhost:4001 loadtest/recruitment-spike.js
```
Seed with `SEED_APPLICANTS=20000`: 14,000 accounts have submitted (status checks) and 6,000
have documents and are ready to submit. Each run consumes `SUBMITTERS` of those. Use
`SUBMIT_OFFSET` to pick fresh ones, or delete the `LOAD` applications between runs.

Thresholds: unexpected failures < 1% (`409` and `429` count as expected), portal p95 < 500 ms,
submit p95 < 1 s, and per-endpoint p95 targets.

## Results (measured, 2 October 2026)

**Environment, and why the absolute numbers are small.** Everything ran on **one 4-vCPU /
15 GB VM**: k6 itself (0.5–1.5 cores), **2 API processes** (each is single-threaded Node,
equivalent to two 1-vCPU pods), 1 worker process with all queues, the PostgreSQL primary,
a streaming replica, Redis and SeaweedFS. This measures **per-pod capacity and behaviour
under overload**. It does not show the 3,000 rps target directly; that comes from scaling
out pods (see SCALING.md) and should be confirmed with the same script against staging.

### Run 1: 800 rps peak + 600 submissions, 3 min hold ✅
```
requests            203,583  (566/s averaged over the whole 6.5-min run)
failed (unexpected) 0.12%                      ← 29 requests shed with 503 during the login burst
latency all         p50 6.7ms   p95 121ms
submissions         600 / 600 accepted (202), submit p95 279.5ms
                    600 / 600 persisted by workers, 600 / 600 PDF slips generated
  lgas           p50   2.2ms  p95   23.4ms
  exercise       p50   2.1ms  p95   22.5ms
  status         p50   7.3ms  p95   94.3ms
  draft_save     p50  11.1ms  p95  165.6ms
  draft_get      p50  12.0ms  p95  144.3ms
  submit         p50 114.9ms  p95  279.5ms
  register       p50  57.5ms  p95  266.6ms
  login          p50  53.1ms  p95 1872.9ms   ✗ (threshold 1s): 600 submitters sign in within seconds
```
CPU during the hold: Node (2 API + workers) ≈ 2.0–3.0 cores, PostgreSQL ≈ 0.1–0.3 cores,
Redis ≈ 0.1 cores. **The database was not the bottleneck**, because writes are queued and
reads hit Redis and the replica.

### Run 2: 1,000 rps peak + 600 submissions (the knee for this VM) ⚠️
p50 84ms, p95 1.2s, 1.8% of requests shed (503), 600/600 submissions accepted. Two
single-threaded API processes plus k6, the database and workers saturated the 4 vCPUs.
(`results/run-1000rps.txt`)

### Run 3: 1,500 rps peak + 1,500 submissions (deliberate overload) 🛑
The pods **shed load instead of failing**: 48,618 requests got `503 + Retry-After` (counted
as failures because `portal_mix` does not retry), and latency rose to p95 1.9s. The API
processes stayed up and served the following test runs without a restart. In production the edge waiting room keeps traffic below this point, and the portal
client turns 503s into a queue banner with automatic retries.
(`results/run-1500rps.txt`)

### What the numbers mean for production
| Measured here | Planning value |
|---|---|
| ≈ 400 rps per API process (≈ 1 vCPU) for the portal mix at p95 ≈ 120 ms | **150 rps per 1-vCPU pod** as the KEDA target (≈ 60% headroom) |
| argon2id verify ≈ 50 ms CPU, so ≈ 20–30 logins/s per vCPU before queueing | Logins and registrations drive pod count at opening; the waiting room admits ≤ 8,000 new users/min |
| Submit path p95 < 300 ms; workers persisted 600 submissions plus slips within seconds | 2–30 submission workers (KEDA on backlog) |
| PostgreSQL < 0.3 core at 800 rps | A 4–8 vCPU primary plus 2 replicas has ample headroom for 3,000 rps |

## Issues found and fixed by load testing
- **Per-request logging** cost CPU and produced ~800 MB of logs per process per run. Successful
  requests now log at `debug` (metrics already count them); 4xx log at warn and 5xx at error.
- **BullMQ job ids** cannot contain `:`, so slip jobs failed and retries skipped follow-ups. Fixed,
  and follow-ups are now idempotent (`counted:{id}` marker, deterministic notification job ids).
- Test-harness fixes so results reflect real browsers: persistent cookie jars, per-VU client
  IPs, retrying 503s like the portal client, and unique submission accounts.
