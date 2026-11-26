# Threat model

Scope: website, mobile app, API, database, file storage and payment flow as built on 26 Nov 2026. Method: list what we protect, who might attack it, and for each threat the control in the code and what is still open. This is a design review, **not** a penetration test.

## Assets

1. Personal data: phone numbers, names, emails, exact property addresses and coordinates, private documents (sale deeds, tax receipts), chat messages.
2. Accounts and staff powers: moderator, support and admin roles.
3. Money: payment orders, entitlements (featured placements), refunds.
4. Marketplace trust: listings that are real, correctly priced and not scams.
5. Availability of search and posting.

## Actors

Curious users, scammers posting fake listings or demanding advance payments, competitors scraping listings or phone numbers, spammers, account takeover attempts via OTP, malicious insiders with staff roles, and automated bots.

## Threats and controls

| # | Threat | Control in place | Open items |
|---|---|---|---|
| T1 | OTP brute force or SMS pumping | 6-digit codes hashed at rest, expiry, max attempts per code, 5 codes per phone per 10 minutes, per-IP route limits | CAPTCHA or device check before sending SMS; alerting on SMS spend |
| T2 | Session theft | Short-lived access JWT; refresh tokens hashed and rotated; web keeps tokens in httpOnly cookies behind a same-origin proxy | CSRF token on the proxy (relies on SameSite=Lax today); refresh-token reuse detection |
| T3 | Editing someone else's listing (IDOR) | Ownership checked on every owner route; tested (acceptance #4) | |
| T4 | Reading private documents or chats | Documents only via 5-minute HMAC-signed links for owner and moderators; moderator access audit-logged; conversations restricted to participants; tested (#5) | |
| T5 | Leaking exact address or phone through public pages or APIs | Single public serializer; coordinates rounded to about 1 km; phone shown only if the owner opted in and only after an enquiry; tested | Rate limiting on phone reveals per buyer |
| T6 | Scraping listings and contacts | Global rate limit; phones never in public payloads | Bot detection; per-account reveal caps |
| T7 | Fake or fraudulent listings | Every listing moderated before publishing; material edits go back to review; user reports; takedown and account blocking with audit trail; safety tips; no "verified" badge without a recorded check | Duplicate-photo detection; phone reputation; manual SOP in `business/SOPS.md` |
| T8 | Malicious file upload | Type and size checks, images re-encoded with EXIF/GPS stripped, storage keys generated server-side, path traversal guarded | Malware scanning for PDFs |
| T9 | Payment fraud: fake success, replayed or forged webhooks | Benefits granted only from verified provider webhooks (HMAC over raw body); each event stored once; guarded status updates; amount checked against the order; sandbox refused in production; tested (#9, #10) | Live Razorpay verification on staging |
| T10 | Staff abuse | Role checks on every admin route; support sees masked phones; admin cannot remove own admin role; role changes and blocks audit-logged and revoke sessions | **Admin MFA not built**; audit log is append-only by convention, not enforced |
| T11 | Development shortcuts reaching production | `loadConfig()` rejects dev OTP, sandbox payments, local storage and weak secrets when `APP_ENV=production`; demo seed refuses production; tested (#13) | |
| T12 | Secrets leakage | Secrets only from environment; `.env` git-ignored; `.env.example` has no values | Secret scanning in CI |
| T13 | Injection (SQL, XSS) | Prisma parameterised queries; React escaping; receipt and sandbox HTML escape all values; zod validation on inputs; security headers on site and API | Content Security Policy for the website |
| T14 | Open redirect after checkout | Return URL restricted to configured web origins and the app scheme; tested | |
| T15 | Denial of service | Body size limits, upload limits, rate limits, paginated queries | CDN or WAF in front; load test |
| T16 | Data loss | Backups and a tested restore script (#15) | Drill on managed database |

## Top risks to fix before launch

1. Admin MFA (T10).
2. CSRF token on the web proxy (T2).
3. CAPTCHA or device attestation before sending OTP SMS (T1), because SMS pumping costs money directly.
4. Content Security Policy on the website (T13).
5. Independent penetration test.
