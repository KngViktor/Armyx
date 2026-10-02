# Deployment

## Target topology
- **Kubernetes** (EKS, GKE, AKS or an in-country provider) across ≥ 3 availability zones,
  with ingress-nginx, KEDA, kube-prometheus-stack, Loki (logs), External Secrets Operator
  and the CloudNativePG operator. A managed autoscaling platform also works, as long as it
  provides the same primitives (min/max replicas, request-based scaling, private
  networking).
- **PostgreSQL 16**: CloudNativePG `armyx-pg` (1 primary + 2 replicas) *or* a managed
  service (e.g. RDS/Aurora PostgreSQL with 2 read replicas and PITR). Either way the apps
  connect only through **PgBouncer** (`armyx` → primary, `armyx_ro` → replicas).
- **Redis**: a 3-shard Redis/Valkey Cluster with replicas (managed ElastiCache/Memorystore,
  or the Bitnami/Valkey cluster Helm chart). Set `REDIS_CLUSTER_NODES`. BullMQ keys use the
  `{bull}` hash tag, so queue operations stay in a single slot. Use `maxmemory-policy
  noeviction` for the queue cluster.
- **Object storage**: a private S3 bucket with versioning, SSE-KMS, a deny-non-TLS bucket
  policy, Block Public Access, and CORS for the site origin (`POST`, `GET`). Lifecycle: move
  exports to expiry after 30 days.
- **Cloudflare** in front of everything (`infra/cloudflare`).

## Step by step
1. **Provision**: cluster, Postgres (or install CNPG and apply `postgres-cnpg.yaml`), Redis
   Cluster, S3 buckets (`armyx-recruitment-documents`, `armyx-db-backups`), KMS keys, SMTP
   and SMS provider accounts.
2. **Secrets**: create `armyx-secrets` (keys listed in `infra/k8s/base/config.yaml`) and the
   `pgbouncer-userlist` secret from your secret manager with External Secrets. Generate the
   encryption keys in KMS.
3. **Images**: CI (`.github/workflows/ci.yml`) builds and pushes `api`, `workers`, `web` and
   `cms` images tagged with the git SHA. The web image takes `NEXT_PUBLIC_*` build args.
4. **Deploy**: set the image tags in `infra/k8s/overlays/production/kustomization.yaml`, then
   `kubectl apply -k infra/k8s/overlays/production` (or let Argo CD sync it). The
   `db-migrate` Job runs first as a PreSync hook.
5. **Edge**: `cd infra/cloudflare && terraform apply`. Then put the Turnstile site key into
   the web build and the secret into `armyx-secrets`. Fill `armyx_admin_ips`. Protect
   `cms.army.mil.ng` with Cloudflare Access.
6. **Content**: run the CMS seed once in staging only, then let DAPR editors publish the real
   content. Each publish triggers revalidation and a CDN purge automatically.
7. **Verify**: run `scripts/smoke.ts` against staging (with `OTP_FIXED_CODE` set in staging
   only), then the k6 spike test (docs/LOAD-TESTING.md).

## Backups and recovery
| What | How | RPO / RTO |
|---|---|---|
| PostgreSQL | Continuous WAL archiving to S3 (encrypted) + **daily** base backup (`ScheduledBackup` 01:00), 35-day retention → **point-in-time recovery** to any second in that window | RPO ≈ seconds (WAL); RTO < 1h |
| Documents | S3 versioning + cross-region replication (optional) | RPO 0 |
| Redis | Sessions, caches and in-flight queue jobs. AOF on; losing Redis loses only short-lived data. Drafts are persisted to Postgres within 30s, and submissions keep their idempotent job id | — |
| CMS | Same Postgres cluster (`armyx_cms` DB) → covered by PITR. Media: S3 |  |

Restore drill (quarterly): create a CNPG `Cluster` with `bootstrap.recovery.source` pointing
at the barman object store and `recoveryTarget.targetTime`, run smoke tests against it, then
switch PgBouncer's `armyx` host.

## Monitoring and alerting
- Metrics: the API exposes `:9464/metrics` (latency histogram, request counter per route
  template, in-flight, shed counter, Node runtime). Workers expose `:9465/metrics` (job
  counters and durations, `armyx_queue_depth`). Also scraped: PgBouncer exporter and CNPG
  metrics.
- Dashboards: import `infra/monitoring/grafana-dashboard.json`.
- Alerts: `infra/k8s/base/monitoring.yaml` covers API 5xx rate, p95 latency, load shedding,
  submission backlog, job failures, replication lag, stale backups and PgBouncer waits.
  Route them to on-call (PagerDuty/Opsgenie/email/SMS) through Alertmanager.
- Uptime: external probes (e.g. Grafana Synthetic Monitoring or UptimeRobot) on `/`,
  `/portal/login` and `/api/v1/health/ready` from several regions.
- Logs: structured JSON on stdout → Loki, with PII redacted at source. Retain 90 days, and
  the audit log indefinitely in the database.
