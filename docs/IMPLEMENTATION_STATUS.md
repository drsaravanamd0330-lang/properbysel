# Implementation status

Updated 2026-11-26. Key: **Tested** = covered by an automated test that passed · **Implemented** = built and used manually, no dedicated test · **Simulated** = development substitute only · **Not started** · **Blocked** = needs an external account or decision.

## Phase 1–2: first workflow (account → draft → submit → moderate → publish → search → enquire → inbox)

| Area | Status | Notes |
|---|---|---|
| Phone OTP login, sessions, refresh rotation | Tested | OTP delivery is **Simulated** (dev provider). Real SMS needs MSG91 or Twilio plus DLT template registration. |
| Production guard against dev OTP / weak secret / local storage / sandbox payments | Tested | `apps/api/src/config.ts` |
| Listing wizard (8 steps, autosave, resume) | Tested | API tests + browser E2E. Category-specific fields for residential, land, commercial. |
| Listing lifecycle and audit log | Tested | Single transition table in `packages/domain`. Material edits return to review. |
| Photo upload (type/size checks, EXIF/GPS stripped, resized) | Tested | |
| Private documents with 5-minute signed links | Tested | Owner and moderators only; moderator access is audit-logged. |
| Moderation queue: approve / request changes / reject | Tested | Owner notified in-app. |
| Public search: filters, sort, pagination, shareable URLs | Tested | Bounding-box map filter implemented, not separately tested. |
| Map view with approximate locations | Implemented | OpenStreetMap tiles; production needs a tile provider agreement for volume. |
| Property page (SSR, metadata, JSON-LD, 410 for closed listings) | Implemented | Demo listings are noindex. |
| Enquiries (idempotent), messaging, advertiser inbox, lead stages | Tested | |
| Visit requests (accept/decline/reschedule/cancel/complete) | Tested | |
| Favourites, notifications (in-app), reporting a listing | Implemented | Email/SMS/push/WhatsApp adapters not started. |
| Listing expiry job | Tested | Runs every 15 minutes in the API process. |
| Draft policy pages | Implemented | Marked "Draft for professional review". |
| Rate limits | Implemented | Global and per-route; OTP limited per phone. |

## Phase 3: mobile app

| Area | Status | Notes |
|---|---|---|
| Expo app: search, details, login, post listing with photos, inbox, chat, visits, favourites, account | Tested | Exported web build driven at phone size against the real API (`e2e/mobile.e2e.mjs`). Android and iOS JS bundles compile. |
| Native Android/iOS builds, device testing | Blocked | Needs Expo/EAS account; iOS also needs an Apple Developer account. See docs/MOBILE.md. |
| Push notifications | Implemented (client + token storage) | Sending from the server not built; needs EAS project + FCM/APNs credentials. |
| Deep links | Implemented | `properbysel://` scheme. Universal links need the production domain. |

## Phase 4a: monetization

| Area | Status | Notes |
|---|---|---|
| Plans (featured 7/30 days, Agent Pro monthly, photoshoot behind a feature flag) | Tested | Prices are assumptions (docs/ASSUMPTIONS.md, launch prices), exclusive of 18% GST. |
| Orders, GST calculation, receipt numbering per financial year | Tested | Receipt says "not a tax invoice" until `BUSINESS_GSTIN` is set. Tax treatment needs a CA's review. |
| Sandbox payment provider and checkout page | Tested (**Simulated**) | Refused when `APP_ENV=production`. No real money moves. |
| Signed webhooks, exactly-once fulfilment, amount check | Tested | Benefits are only granted from a verified webhook, never from the browser return URL. |
| Featured placement (stacking, expiry, refunds revoke) | Tested | Max 3 sponsored results, labelled "Sponsored". |
| Razorpay adapter | Implemented, **not run** | Needs a Razorpay merchant account and keys. Refunds are issued in the Razorpay dashboard; the webhook syncs them. |
| Web: pricing, feature a listing, orders, receipt, admin orders/refunds/flags | Tested | Browser E2E buys a featured placement through the sandbox. |
| Mobile: feature a listing, order status | Implemented | Opens checkout in the browser and returns via `properbysel://order/<id>`. Type-checked; not driven by E2E. |
| Agent Pro listing quota enforcement | Not started | Entitlement is recorded; quota is not yet enforced at publish time. |

## Phase 4b: admin tools, saved searches, comparison

| Area | Status | Notes |
|---|---|---|
| Reports queue: start review, dismiss, take down (owner must fix and resubmit) | Tested | Support can view; only moderators and admins act. Owner gets an in-app notice. |
| Users and roles: search, grant/remove roles, block/unblock with a reason | Tested | Role changes and blocks revoke all sessions. Support sees masked phone numbers. Admins cannot remove their own admin role. |
| Audit log viewer with filters and paging | Tested | Every listing transition, moderation decision, payment, refund, role change and block is recorded. |
| Launch metrics (live listings, enquiries, review time, reports, revenue) | Tested | Demo data excluded. |
| Saved searches with in-app alerts every 15 minutes | Tested | One notification per search per run; atomic claim prevents duplicates. Email/SMS alerts not started. Web only; not yet in the mobile app. |
| Compare up to 4 properties | Tested | Web only. Hidden or closed listings are reported as unavailable. |
| Admin MFA | Not started | Strongly recommended before launch; `mfaSecret` column exists. |

## Phase 4c: delivery and operations

| Area | Status | Notes |
|---|---|---|
| CI workflow (typecheck, tests, web build, mobile bundle export, browser E2E) | Implemented, **not yet run on GitHub** | `.github/workflows/ci.yml`. Each step was run locally with the same commands. |
| S3-compatible storage adapter | Tested against a fake client | Needs a real bucket to verify. |
| MSG91 OTP adapter | Tested against a fake HTTP client | Needs an MSG91 account and a DLT-approved template. Twilio is not implemented. |
| Account deletion (web, mobile, API) | Tested (API) | Required by both app stores. |
| Backup, restore and restore drill scripts | Tested locally | Acceptance #15. |
| Dockerfiles and production compose example | Written, **not built** | No Docker daemon was available. |
| Deployment guide, runbooks, threat model, legal matrix | Written | docs/DEPLOYMENT.md, RUNBOOKS.md, THREAT_MODEL.md, LEGAL_MATRIX.md. The legal matrix needs a lawyer's review. |

## Not started yet

Admin MFA; CSRF token on the web proxy; CAPTCHA before OTP; RERA number field; support tickets; Tamil/Hindi localisation; email/WhatsApp notifications and server-side push sending; Agent Pro quota enforcement; saved searches and compare in the mobile app.

## Known limitations

- Web session tokens live in httpOnly cookies via a Next.js proxy route; CSRF relies on SameSite=Lax. A CSRF token should be added before launch.
- Search uses PostgreSQL `ILIKE`; fine for a city launch, will need full-text or a search index at scale.
- Nothing has been load-tested or security-audited. This is **not production-ready**.
