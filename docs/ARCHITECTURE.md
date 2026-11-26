# Architecture

## Shape

```
apps/api          Fastify REST API (/v1), Prisma, background jobs
apps/web          Next.js: public site (SSR, SEO), dashboards, /admin
apps/mobile       Expo (React Native) for Android and iOS
packages/domain   Enums, listing state machine, permissions, money and area helpers
packages/validation  Zod schemas shared by API, web and mobile
packages/api-client  Typed fetch client used by web and mobile
docs              Assumptions, acceptance checklist, status, runbooks
infra             Docker compose and deployment notes
```

Packages are consumed as TypeScript source (no build step); each app compiles them.

## Why one Fastify API

Web, admin and mobile all need identical rules (who may edit a listing, which states are public, who can read a conversation). Putting every rule in one versioned API means the clients cannot drift, and the Next.js app never talks to the database directly. Fastify is small, fast, typed, and has mature plugins for rate limiting, CORS, security headers and multipart uploads.

## Key rules enforced in the API

- **Listing lifecycle** is a single transition table in `packages/domain/src/listing-state.ts`; the API refuses any transition not in the table and writes an audit-log row for each one.
- **Public visibility:** only `PUBLISHED` listings with `expiresAt` in the future are returned by public endpoints, and public serializers never include exact coordinates, private documents, contact details or moderation notes.
- **Record-level authorization:** every write checks ownership (or organization membership) or a staff role on the server.
- **Moderation of material changes:** editing price, category, location or photos of a published listing moves it back to `PENDING_REVIEW`.
- **Idempotency:** enquiries accept an `Idempotency-Key` header; repeating the request returns the original enquiry.

## Data model (summary)

Users, roles (many per user), organizations, OTP challenges, refresh sessions, cities, localities, listings (with category-specific attributes as validated JSON plus indexed common columns), media, private documents, moderation reviews, favourites, saved searches, enquiries, conversations, messages, visit requests, reports, notifications, consents, audit logs. Plans, orders, payments and entitlements are added in Phase 4.

See `apps/api/prisma/schema.prisma` for the authoritative schema.
