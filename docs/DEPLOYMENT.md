# Deployment guide

Status: **written, not yet executed.** No server, domain, or cloud account exists for ProperBySel yet, and the Docker images have not been built (no Docker daemon was available during development). Everything below is the intended path for a Chennai pilot. Nothing here should be run against real users until the launch checklist at the end is complete.

## Target shape for the pilot

| Piece | Recommendation | Why |
|---|---|---|
| API (`apps/api`) | One container on a small VM or a container service in an Indian region (e.g. AWS Mumbai `ap-south-1`) | Keeps personal data in India, simple to operate |
| Website (`apps/web`) | Same VM behind the reverse proxy, or Vercel with `API_INTERNAL_URL` pointing at the API | Server-rendered pages need the API |
| Database | Managed PostgreSQL 16 with automated daily backups and point-in-time recovery | Restores are the riskiest operation; let the provider own them |
| Object storage | S3-compatible private bucket with versioning (`STORAGE_PROVIDER=s3`) | Photos and documents; the API serves all files and enforces access |
| TLS and proxy | Caddy or Nginx in front of both, HTTPS only, HSTS | |
| Mobile | EAS Build and Submit (needs an Expo account; iOS also needs an Apple Developer account) | See `docs/MOBILE.md` |

## Environments

| Name | `APP_ENV` | OTP | Payments | Data |
|---|---|---|---|---|
| Local | `development` | `dev` (code in API log) | `sandbox` | Demo seed |
| CI | `test` / `development` | `dev` | `sandbox` | Throwaway database |
| Staging | `staging` | real provider, test numbers only | `sandbox` or Razorpay test mode | Demo seed, no real users |
| Production | `production` | `msg91` (or Twilio) | `razorpay` live | Real data, never seeded |

`loadConfig()` refuses to start with `APP_ENV=production` if the OTP provider is `dev`, the payment provider is `sandbox`, storage is `local`, or `JWT_SECRET` is short. The demo seed refuses to run in production.

## Required production settings

Set these as secrets in the hosting platform. Never commit them. `.env.example` lists every key without values.

- `DATABASE_URL`, `JWT_SECRET` (at least 32 random bytes), `WEB_ORIGIN` (the real site origin), `PUBLIC_API_URL`
- `OTP_PROVIDER=msg91`, `MSG91_AUTH_KEY`, `MSG91_OTP_TEMPLATE_ID` (template must be DLT-registered)
- `STORAGE_PROVIDER=s3`, `S3_REGION`, `S3_BUCKET_PRIVATE`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, optional `S3_ENDPOINT` for non-AWS providers
- `PAYMENT_PROVIDER=razorpay`, `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`
- `BUSINESS_LEGAL_NAME`, `BUSINESS_GSTIN` (once registered), `BUSINESS_ADDRESS`

## Release procedure

1. CI must be green on the commit (`.github/workflows/ci.yml`: typecheck, unit and API tests, web build, mobile bundle export, browser E2E).
2. Take a database backup: `DATABASE_URL=... infra/scripts/backup.sh /secure/backups`.
3. Apply migrations as a one-off job before switching traffic: `pnpm --filter @pbs/api exec prisma migrate deploy`. Never run `prisma migrate reset` or `migrate dev` against staging or production.
4. Build and start the new images: `docker compose -f infra/docker-compose.prod.example.yml up -d --build`.
5. Smoke test: `/health` returns `ok`, home page loads, search returns results, log in with a staff test number, open the moderation queue.
6. Watch error rates and logs for 30 minutes (see `docs/RUNBOOKS.md`).

Migrations should be additive (add columns or tables first, backfill, then remove old ones in a later release) so that the previous image still works if you roll back.

## Razorpay webhook

Point the Razorpay dashboard webhook at `https://<api-domain>/v1/payments/webhook/razorpay` for `payment.captured`, `payment.failed` and `refund.processed`, using `RAZORPAY_WEBHOOK_SECRET`. Benefits are granted only when this webhook is verified; the browser return page never grants anything. Test the full cycle in Razorpay test mode on staging before going live.

## Launch checklist (blocking items)

- [ ] Domain bought and DNS configured; HTTPS working on site and API
- [ ] Managed PostgreSQL with PITR, plus a completed restore drill on staging (`infra/scripts/verify-restore.sh`)
- [ ] S3 bucket private, versioned, encrypted; adapter verified against the real bucket
- [ ] MSG91 account, DLT entity and OTP template approved; adapter verified on staging
- [ ] Razorpay account approved; test-mode purchase, failure and refund verified on staging
- [ ] Admin MFA implemented (not built yet) and staff accounts created with least privilege
- [ ] CSRF token added to the web proxy (see Known limitations in `IMPLEMENTATION_STATUS.md`)
- [ ] Privacy policy, terms, refund policy and grievance officer details reviewed by a lawyer (`docs/LEGAL_MATRIX.md`)
- [ ] Error monitoring and uptime checks connected (`docs/RUNBOOKS.md`)
- [ ] Load test of search and listing pages at expected pilot traffic
- [ ] Independent security review or penetration test
