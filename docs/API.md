# API reference

Base URL: `http://localhost:4000` in development (`PUBLIC_API_URL` elsewhere). All bodies are JSON unless noted. Money is in **paise** (integers); dates are ISO 8601 UTC.

**Auth.** `POST /v1/auth/otp/request` then `/v1/auth/otp/verify` returns `{ accessToken, refreshToken, user }`. Send `Authorization: Bearer <accessToken>`. Refresh with `/v1/auth/refresh` (rotates the refresh token). The website never exposes tokens to JavaScript; it calls `/api/proxy/v1/...`, which adds them from httpOnly cookies.

**Errors.** `{ "error": { "code": "VALIDATION", "message": "...", "details": [{ "path": "title", "message": "..." }] } }` with a matching HTTP status (400 validation, 401 signed out, 403 forbidden, 404 not found or not visible to you, 409 state conflict, 410 listing closed, 422 listing incomplete for submit, 429 rate limited).

**Typed client.** `packages/api-client` wraps every endpoint below with TypeScript types and is used by both the website and the mobile app.

Legend: 🌐 public · 👤 signed in · 🛡 moderator · 🎧 support · 🔑 admin

## Auth and account
| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | /v1/auth/otp/request | 🌐 | Send a code to `{ phone }` (5 per phone per 10 min) |
| POST | /v1/auth/otp/verify | 🌐 | `{ phone, code, name? }` → tokens; creates the account on first login |
| POST | /v1/auth/refresh | 🌐 | `{ refreshToken }` → new tokens |
| POST | /v1/auth/logout | 👤 | Revoke the refresh token |
| GET / PATCH | /v1/me | 👤 | Profile; PATCH `{ name, email? }` |
| DELETE | /v1/me | 👤 | `{ "confirm": "DELETE" }` deletes the account (closes listings, signs out everywhere) |
| POST | /v1/me/push-tokens | 👤 | Register an Expo push token |

## Discovery
| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | /v1/cities, /v1/cities/:slug/localities | 🌐 | Geography |
| GET | /v1/search | 🌐 | Filters: `city, locality, postcode, transaction, category[], minPrice, maxPrice` (rupees), `minArea, maxArea` (sq ft), `bedrooms[], furnishing, advertiserType, amenities[], bbox, q`; `sort=relevance|newest|price_asc|price_desc`, `page, pageSize`. Up to 3 sponsored results lead page 1 of relevance sort. |
| GET | /v1/properties/:id | 🌐 | Public detail (approximate location only). 410 for closed listings |
| GET | /v1/properties/:id/similar | 🌐 | Similar listings |
| GET | /v1/properties/:id/contact | 👤 | Advertiser phone, only if they opted in and you enquired |
| GET | /v1/compare?ids=a,b | 🌐 | Up to 4 listings side by side; hidden ones listed as `unavailable` |
| GET | /v1/media/:id | 🌐 | Listing photo (only when the listing is visible, or to its owner and staff) |

## Listings (owner)
| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | /v1/listings | 👤 | Create a draft |
| GET / PATCH / DELETE | /v1/listings/:id | 👤 owner | Read, autosave, delete draft. Material edits to a live listing send it back to review |
| POST | /v1/listings/:id/submit | 👤 owner | Submit for review (422 with field errors if incomplete) |
| POST | /v1/listings/:id/actions | 👤 owner | `PAUSE, RESUME, MARK_SOLD, MARK_RENTED, ARCHIVE, RENEW` |
| POST / DELETE | /v1/listings/:id/media[/:mediaId] | 👤 owner | Photo upload (multipart, JPEG/PNG/WebP, 10 MB) |
| POST | /v1/listings/:id/documents | 👤 owner | Private document upload (PDF or image) |
| GET | /v1/documents/:id/url | 👤 owner, 🛡 | 5-minute signed link; moderator access is audit-logged |
| GET | /v1/files/private | signed link | Serves the document |
| GET | /v1/me/listings | 👤 | My listings with enquiry counts |

## Enquiries, messages, visits
| Method | Path | Who | Purpose |
|---|---|---|---|
| POST | /v1/properties/:id/enquiries | 👤 | Header `Idempotency-Key`; one enquiry per buyer per listing |
| GET | /v1/me/inbox, /v1/me/enquiries | 👤 | Advertiser leads; buyer's sent enquiries |
| PATCH | /v1/leads/:id | 👤 advertiser | `{ stage?, note? }` |
| GET / POST | /v1/conversations/:id[/messages] | 👤 participant | Read and send messages |
| POST | /v1/conversations/:id/block | 👤 participant | Block the other person |
| POST | /v1/leads/:id/visits, /v1/visits/:id/action | 👤 participant | Request a visit; `ACCEPT, DECLINE, RESCHEDULE, CANCEL, COMPLETE` |
| GET / PUT / DELETE | /v1/me/favourites[/:listingId] | 👤 | Saved properties |
| GET | /v1/me/notifications; POST /v1/me/notifications/read | 👤 | In-app notifications |
| GET / POST / PATCH / DELETE | /v1/me/saved-searches[/:id] | 👤 | Saved searches (max 20) with alerts |
| POST | /v1/properties/:id/report | 👤 | `{ reason: FRAUD|WRONG_INFO|ALREADY_SOLD|DUPLICATE|OFFENSIVE|OTHER, details? }` |

## Payments
| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | /v1/plans | 🌐 | Active plans with GST and totals |
| POST | /v1/orders | 👤 | `{ planCode, listingId? }` → `{ order, checkoutUrl, clientParams }`. Nothing is granted yet |
| GET | /v1/orders, /v1/orders/:id | 👤 | Order status as confirmed by the provider |
| GET | /v1/orders/:id/receipt | 👤 | Printable HTML receipt (paid orders only) |
| GET | /v1/me/entitlements | 👤 | Active paid benefits |
| POST | /v1/payments/webhook/:provider | provider | Signed webhook (`x-razorpay-signature` or sandbox signature). The only place benefits are granted |
| GET / POST | /v1/payments/sandbox/checkout/:ref[/succeed\|fail] | dev only | Simulated checkout; absent in production |

## Staff
| Method | Path | Who | Purpose |
|---|---|---|---|
| GET | /v1/admin/listings, /v1/admin/listings/:id | 🛡 | Queue and review detail (automatic checks, documents, history, reports) |
| POST | /v1/admin/listings/:id/decision | 🛡 | `{ decision: APPROVE|REQUEST_CHANGES|REJECT, note? }` |
| GET | /v1/admin/reports | 🛡 🎧 | Reports queue |
| POST | /v1/admin/reports/:id/action | 🛡 | `{ action: START_REVIEW|DISMISS|TAKE_DOWN, note }` |
| GET | /v1/admin/users | 🔑 🎧 | Search users (support sees masked phones) |
| PUT | /v1/admin/users/:id/roles | 🔑 | `{ roles: [...] }`; signs the user out |
| POST | /v1/admin/users/:id/block | 🔑 | `{ blocked, reason }` |
| GET | /v1/admin/audit | 🔑 | Filter by `entityType, entityId, actorId, action, before` |
| GET | /v1/admin/metrics | 🔑 | Launch KPIs (demo data excluded) |
| GET / POST | /v1/admin/orders, /v1/admin/orders/:id/refund | 🔑 | Orders; sandbox refunds (Razorpay refunds are issued in its dashboard) |
| GET / PUT | /v1/admin/flags[/:key] | 🔑 | Feature flags, e.g. `manual_photoshoot` |
| GET | /health | 🌐 | Liveness and configured providers |
