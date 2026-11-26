# Operations runbooks

For the pilot team. Each runbook says when to use it, what to do, and how to confirm it worked. Times are IST.

## 1. Monitoring (set up before launch)

Nothing is connected yet. Minimum for the pilot:

| Signal | Tool (suggested) | Alert when |
|---|---|---|
| API and site up | Uptime check on `/health` and `/` every minute | 2 consecutive failures |
| Server errors | Sentry (or similar) on API and web | Any new error type; more than 1% of requests failing over 5 minutes |
| Logs | Platform log drain; API logs are JSON (pino) and redact auth headers, OTP codes and phone numbers in request bodies | Search by `reqId` |
| Database | Provider dashboard | CPU above 80% for 10 minutes, storage above 80%, failed backup |
| Moderation backlog | Admin → Metrics | Oldest pending listing older than 24 hours |
| Payments | Admin → Orders filtered by Pending | Any order pending for more than 1 hour |
| Reports | Admin → Reports | Any fraud report open for more than 4 hours |

## 2. Backup and restore

What is backed up:
- **Database**: the managed provider's daily snapshots and point-in-time recovery, plus our own logical dump before every release (`infra/scripts/backup.sh`). Keep 30 daily and 12 monthly dumps in a separate account or bucket.
- **Files**: the S3 bucket with versioning on. Deleted or overwritten photos and documents can be recovered from previous versions.

Restore drill (run monthly on staging, and once before launch):

```bash
DATABASE_URL=postgresql://.../properbysel \
ADMIN_URL=postgresql://.../postgres \
infra/scripts/verify-restore.sh
```

It dumps the database, restores into a scratch database, compares the row counts of every table and drops the scratch copy. Last run: 26 Nov 2026 on the local development database, 33 tables, row counts identical. It has not yet been run against a managed database.

Restoring for real (data loss or corruption):
1. Stop writes: scale the API to zero or put the site in maintenance mode.
2. Prefer the provider's point-in-time recovery to a new instance, set to just before the incident.
3. Otherwise restore the latest good dump into a new, empty database: `TARGET_DATABASE_URL=... infra/scripts/restore.sh <file>.dump`.
4. Point `DATABASE_URL` at the restored database, start the API, run the smoke test from `DEPLOYMENT.md`.
5. Reconcile payments: compare paid orders with the Razorpay dashboard for the lost window. Re-sending webhooks from Razorpay is safe because fulfilment is idempotent.
6. Write an incident note (section 5).

## 3. Rollback

Use when a release causes errors and a fix will take longer than 15 minutes.
1. Redeploy the previous image tag (keep the last 3 tags).
2. Migrations are additive by policy, so the previous image runs on the newer schema. If a migration was destructive, restore from the pre-release backup instead (section 2), which loses data written since the release.
3. Confirm with the smoke test and error rates.

## 4. Common incidents

**OTP not arriving.** Check the MSG91 dashboard for delivery failures and DLT template status. Users are limited to 5 codes per 10 minutes per phone, so repeated tries return "Too many codes". Do not switch production to the dev provider; the config refuses it.

**Payment taken but no placement.** Find the order in Admin → Orders. If it is Pending, check the Razorpay dashboard for the payment and webhook delivery log, and resend the webhook from Razorpay. Do not mark orders paid by hand in the database.

**Duplicate or fraudulent listing reported.** Follow `docs/business/SOPS.md` (fraud escalation). Use Take down in Admin → Reports; block the account in Admin → Users if there is evidence of fraud. Both actions are audit-logged.

**Personal data exposed or suspected breach.** Treat as severity 1. Contain (revoke keys, block accounts, take down content), preserve logs, inform the founder immediately. Indian law (CERT-In directions and the DPDP Act) sets short reporting deadlines; the lawyer must confirm the exact obligations in `LEGAL_MATRIX.md` before launch.

## 5. Incident notes

After any severity 1 or 2 incident, write within 2 working days: what happened, impact (users, money, data), timeline, root cause, what we changed. Keep notes in the team drive, not in the public repository.

## 6. Access

- Staff roles: Moderator (listings and reports), Support (read-only lookups, masked phone numbers), Admin (users, orders, refunds, flags, audit log, metrics).
- Grant the smallest role that works. Review staff access monthly in Admin → Users. Changing roles signs the person out everywhere.
- Production database and cloud console access: founder plus one engineer, with MFA on the cloud account.
