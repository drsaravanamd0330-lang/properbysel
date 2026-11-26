# Implementation status

Updated 2026-11-26. Key: **Tested** = covered by an automated test that passed · **Implemented** = built and used manually, no dedicated test · **Simulated** = development substitute only · **Not started** · **Blocked** = needs an external account or decision.

## Phase 1–2: first workflow (account → draft → submit → moderate → publish → search → enquire → inbox)

| Area | Status | Notes |
|---|---|---|
| Phone OTP login, sessions, refresh rotation | Tested | OTP delivery is **Simulated** (dev provider). Real SMS needs MSG91 or Twilio plus DLT template registration. |
| Production guard against dev OTP / weak secret / local storage | Tested | `apps/api/src/config.ts` |
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

## Not started yet

saved searches and comparison; admin user/role/report/ticket management and metrics; Tamil/Hindi localisation; email/SMS/push/WhatsApp providers; S3 storage adapter; admin MFA; CI pipeline; deployment runbooks; business launch package.

## Known limitations

- Web session tokens live in httpOnly cookies via a Next.js proxy route; CSRF relies on SameSite=Lax. A CSRF token should be added before launch.
- Search uses PostgreSQL `ILIKE`; fine for a city launch, will need full-text or a search index at scale.
- Nothing has been load-tested or security-audited. This is **not production-ready**.
