# Runbook

## Before a recruitment exercise opens (T-7 days → T-0)
1. **Freeze** non-essential deployments 48h before opening.
2. Create the exercise in **Admin → Exercises**: rules, per-state quotas, opening and closing
   dates. Add screening centres. Leave it in *draft*.
3. Run the **k6 spike test** in staging at 1.5× the expected peak and confirm the thresholds pass.
4. **Pre-scale** at T-1h. Raising `minReplicaCount` is cheaper than waiting for autoscaling:
   - `kubectl -n armyx patch scaledobject api --type merge -p '{"spec":{"minReplicaCount":40}}'`
   - workers-submissions 10, workers-notifications 6
   - Confirm SMS/email provider throughput, and pre-warm the SMS sender ID.
5. Set the **waiting room** `total_active_users` (or the Worker's `ADMIT_PER_MINUTE`) from the
   load-test capacity and enable it.
6. Publish the announcement in the CMS. It is static, so publishing costs nothing at peak.
7. At T-0 click **Open exercise**. The cache refreshes within 60s.

## During the window: what to watch (Grafana "Armyx — Recruitment Portal")
| Signal | Healthy | Action if not |
|---|---|---|
| API p95 | < 500 ms | Check pod count vs the KEDA max, PgBouncer waits, Redis CPU |
| 5xx rate | < 0.5% | Look at logs by route; roll back the last change if correlated |
| Load shed /s | ≈ 0 | Lower the waiting-room admission rate, or raise the API max replicas |
| Submission backlog | drains within minutes | Scale `workers-submissions`; check primary DB write latency |
| Replication lag | < 5 s | Status pages may lag slightly. If > 30s, point `armyx_ro` at the primary temporarily |
| Notification failures | ≈ 0 | SMS provider quota or credit; jobs retry with backoff for ~8 attempts |

## Incidents
- **API errors:** `kubectl -n armyx logs deploy/api --since=10m | grep '"level":50'`. Requests
  carry `requestId` (= Cloudflare `cf-ray`) for correlation.
- **Database failover:** CNPG promotes a replica automatically. PgBouncer reconnects
  through `armyx-pg-rw`. Writes queued in BullMQ are retried, so no submission is lost.
- **Redis loss:** applicants are signed out (sessions), and autosaves from the last ≤30s may
  be lost (the UI re-saves on the next change). Queued submissions not yet persisted are
  lost **only** if Redis data is lost. Run Redis with replicas and AOF. The maintenance job
  rebuilds dashboard counters within 5 minutes.
- **Suspected data breach:** preserve evidence (audit log, Loki, Cloudflare logs), rotate
  credentials and encryption keys (new key version), and notify the DPO immediately. The
  NDPC must be notified within 72 hours (NDPA s.40).
- **Fraud ("pay for a slot") reports:** publish a notice in the CMS. It appears site-wide
  within a minute.

## After the window
1. Close the exercise. Officers review, shortlist (quotas enforced), assign screening centres
   in bulk (applicants get email + SMS), and export lists.
2. Return the KEDA minimums to normal.
3. Retention: drafts are deleted automatically 90 days after closing. Unsuccessful
   applications are deleted or anonymised after 24 months (scheduled DPO task).
