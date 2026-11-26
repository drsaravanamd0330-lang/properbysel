# Assumptions and reversible defaults

Recorded 2026-11-26. Each item is a default chosen so work can continue; change any of them and the code is built to follow.

| # | Assumption | Why | How to change |
|---|---|---|---|
| A1 | Chennai is the launch city; the data model supports any Indian city. | Stated in the brief as a planning assumption. | Add cities/localities in the admin or seed data. |
| A2 | English first; strings go through a message catalogue so Tamil and Hindi can be added. Machine translations will be labelled "needs review". | Brief. | `apps/web/src/i18n`. |
| A3 | One backend: a Fastify (Node.js, TypeScript) REST API under `/v1`, used by web, admin and mobile. | Avoids duplicate business logic; the brief asks for one clear approach. | — |
| A4 | Public website, customer/advertiser dashboards and admin live in one Next.js app (`/admin` is role-gated on the server and by the API). | Less to deploy; admin access is enforced by the API, not by hiding UI. | Split into `apps/admin` later if needed. |
| A5 | PostgreSQL 16 with Prisma ORM and migrations. PostGIS is not required for v1: locations are stored as decimal lat/lng with a bounding-box index; public coordinates are rounded (about 1 km). | PostGIS is not available in every managed tier; bounding-box search is enough for city-scale browsing. | Enable PostGIS and add a geography column in a later migration. |
| A6 | Money is stored as integer paise (`BigInt`), area as `Decimal(14,4)` plus the original unit. | Brief. | — |
| A7 | Login is phone number + OTP. Development uses a "dev" OTP provider that logs codes; the API refuses to start with it when `APP_ENV=production`. | Brief requires dev-only simulators that cannot be enabled by accident. | Set `OTP_PROVIDER=msg91` or `twilio` with credentials. |
| A8 | Access tokens are short-lived JWTs; refresh tokens are random, stored hashed, and rotated. | Works for both web and mobile. | — |
| A9 | File storage: local disk in development, S3-compatible in staging/production; private documents always in a separate private bucket/folder and served only by short-lived signed URLs. | Brief. | `STORAGE_PROVIDER`. |
| A10 | Payments use a provider adapter; development uses a deterministic sandbox. Razorpay is the planned production adapter (popular in India) but needs a merchant account. | Brief. Not yet confirmed by the owner. | `PAYMENT_PROVIDER`. |
| A11 | Area conversions: 1 cent = 435.6 sq ft; 1 ground = 2,400 sq ft (Tamil Nadu convention); 1 acre = 43,560 sq ft; 1 hectare = 107,639.104 sq ft; 1 sq m = 10.7639 sq ft. Ground and cent are regional; the original unit is always stored and shown. | Chennai launch. | `packages/domain/src/area.ts`. |
| A12 | Listings expire 90 days after publishing unless renewed. | Common marketplace practice; keeps stale inventory out of search. | `LISTING_TTL_DAYS` in domain config. |
| A13 | All demo data is synthetic and labelled "Demo". No competitor content is used. | Brief. | — |
| A14 | Deliverable location is pending the owner's choice (GitHub repo, Windows folder, or project files). | Asked 2026-11-26. | — |
