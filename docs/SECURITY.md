# Security & data protection

## Controls implemented in code

| Requirement | Implementation | Where |
|---|---|---|
| HTTPS only | Cloudflare "Full (strict)", Always-HTTPS, HSTS preload; Authenticated Origin Pulls (mTLS) + Cloudflare-only IP allow-list on the ingress | `infra/cloudflare/main.tf`, `infra/k8s/base/ingress.yaml` |
| Security headers | CSP, HSTS, X-Frame-Options/`frame-ancestors`, nosniff, Referrer-Policy, Permissions-Policy, COOP (web); Helmet with deny-all CSP and `no-store` (API) | `apps/web/next.config.ts`, `apps/api/src/main.ts` |
| CSRF | HttpOnly `SameSite` session cookie + double-submit `csrf` cookie/`X-CSRF-Token` header + Origin allow-list on every state-changing request | `apps/api/src/common/csrf.ts` |
| Passwords | argon2id (m=19 MiB, t=2, p=1), password policy (10+ chars with complexity, or a 16+ char passphrase), constant-time dummy verify for unknown accounts, lockout after 5 failures | `common/passwords.ts`, `auth/auth.service.ts`, `packages/shared/src/schemas.ts` |
| Two-factor auth | RFC 6238 TOTP with replay protection; optional for applicants, **mandatory for admins** (enrolment forced at first login) | `common/totp.ts`, `admin/admin-auth.service.ts` |
| Account verification | Email **and** phone OTP: 6 digits, 10 min, 5 attempts, stored as SHA-256 only, 60s resend cooldown, daily cap (anti SMS-pumping) | `auth/otp.service.ts` |
| Sessions | Opaque 256-bit IDs in HttpOnly cookies; Redis stores the SHA-256 of the ID; sliding expiry (applicant 2h, admin 30 min); revoked on password reset | `common/session.service.ts` |
| Encryption in transit | TLS 1.2+ at the edge, TLS to origin; `sslmode=require`/TLS for Postgres and Redis in production | infra |
| Encryption at rest | Encrypted volumes (Postgres, Redis), S3 SSE-KMS, encrypted backups **plus** application-level AES-256-GCM for PII (NIN, DOB, contact details, the full application, next of kin) with versioned keys for rotation; HMAC blind indexes for lookups | `packages/shared/src/server/crypto.ts` |
| Signed, expiring URLs | Uploads: presigned POST (5 min) with type/size/SSE policy. Downloads: presigned GET (2–5 min). Every admin document view is audited | `infra/storage.service.ts` |
| Upload validation | Allow-listed MIME types and sizes (client, API, S3 policy) + server-side magic-byte check, SHA-256, AV hook | `processors/documents.ts` |
| Bot protection | Cloudflare Bot Management + managed challenge on auth routes; Turnstile on register/login/reset/contact/submit (fails closed); honeypot on the contact form | `infra/captcha.service.ts`, `main.tf` |
| Rate limiting | Edge (per IP) and app (Redis, per IP **and** per account/user) on login, OTP send/verify, registration, submission, uploads, exports, contact | `common/rate-limit.ts`, controllers |
| Authorisation | Role-based access: Super Admin, Recruitment Officer, Reviewer, Viewer. Viewers cannot see PII or documents. Admin routes are also IP-restricted at the edge | `common/auth.guard.ts`, `admin.controller.ts` |
| Audit | Append-only `audit_logs` (DB trigger + revoked grants): logins and failures, PII views, document views, every status change, screening, export, rule change, admin-user change | `infra/audit.service.ts` |
| Logging hygiene | pino with cookies, auth headers, CSRF tokens and request bodies redacted; IPs hashed where stored | `app.module.ts` |
| Forged slips | QR code carries an HMAC signature; `/verify` confirms genuineness without exposing PII | `reference/verify.controller.ts` |
| Spreadsheet safety | CSV/XLSX exports neutralise formula injection | `processors/exports.ts` |
| Least privilege | Pods run non-root with a read-only root FS, all capabilities dropped and seccomp; default-deny NetworkPolicies; DB roles without DELETE on the audit log | `infra/k8s` |
| Unsafe configuration | The API refuses to start in production without Secure cookies or Turnstile, or with `OTP_FIXED_CODE` set | `apps/api/src/main.ts` |

## Nigeria Data Protection Act 2023 (NDPA) mapping

| NDPA principle / duty | How the platform supports it |
|---|---|
| Lawful basis and consent (s.25–26) | Explicit, recorded consent at registration (`consent_version`, `consent_at`); the privacy notice is linked at the point of collection |
| Purpose limitation and data minimisation (s.24) | Only recruitment-relevant fields; plaintext kept only where needed for filtering; IPs hashed |
| Storage limitation (s.24) | Retention job deletes drafts 90 days after an exercise closes and export files after 30 days; documented retention schedule in `/privacy` |
| Integrity and confidentiality (s.39) | Encryption at rest and in transit, field-level encryption, RBAC, MFA, audit log, network isolation |
| Data subject rights (s.34–38) | Access: the applicant dashboard. Rectification: before submission, then via the DPO. Erasure: the schema has a `users.erased_at` tombstone that the API and workers already honour; **a DPO erasure tool (wipe PII + delete documents) is still to be built** |
| Data Protection Officer (s.32) | DPO contact in the privacy notice |
| Breach notification within 72h (s.40) | Centralised logs, alerts and immutable audit trail support investigation; see RUNBOOK |
| Cross-border transfer (s.41–43) | Choose an in-country or NDPC-adequate hosting region (`S3_REGION`, cluster region); the CDN caches only public content |
| DPIA (s.28) | High-volume processing of sensitive data requires a DPIA before launch. This document and ARCHITECTURE.md are inputs |

## Operational requirements before go-live
- Generate keys in a KMS/HSM. Inject `DATA_ENCRYPTION_KEYS` and `BLIND_INDEX_KEY` with External Secrets. Rotate yearly (add `2:<key>`, set the version, then re-encrypt in the background).
- Complete an independent penetration test and a DPIA. Register with the NDPC as a data controller of major importance.
- Populate the Cloudflare `armyx_admin_ips` list with HQ/VPN egress ranges. Put the CMS behind Cloudflare Access.
- Replace all seed passwords. Disable or remove the seeded test accounts.
