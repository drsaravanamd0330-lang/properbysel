# ProperBySel

**RENT | BUY | SELL · LAND • HOMES • PROPERTIES**
India's Smart Property Marketplace. A Product of AAROVIN SOFTWARE SOLUTIONS.

Monorepo with a Fastify API, a Next.js website (public site, dashboards, admin moderation) and, next, an Expo mobile app. See `docs/` for assumptions, architecture, acceptance checklist and status.

## Run locally

Requirements: Node.js 22+, pnpm 10, PostgreSQL 16 (or Docker).

```bash
pnpm install
cp .env.example .env                      # then set JWT_SECRET to a long random string
docker compose -f infra/docker-compose.yml up -d   # or use your own PostgreSQL 16
pnpm db:migrate                           # creates tables
pnpm db:seed                              # synthetic demo data (refuses to run in production)
pnpm dev:api                              # API on http://localhost:4000
pnpm dev:web                              # website on http://localhost:3000
```

### Demo logins (development only)

Log in at `/login` with one of these numbers. In development no SMS is sent: the 6-digit code is printed in the API terminal (`[DEV OTP] ... code 123456`). The API refuses to start with the dev OTP provider when `APP_ENV=production`.

| Role | Mobile |
|---|---|
| Admin + moderator | 90000 00001 |
| Moderator | 90000 00002 |
| Owner (has demo listings) | 90000 00003 |
| Agent | 90000 00004 |
| Buyer | 90000 00005 |
| Builder | 90000 00006 |

Any other valid Indian mobile number creates a new account.

## Tests

```bash
pnpm --filter @pbs/domain --filter @pbs/validation test   # unit tests
pnpm --filter @pbs/api test       # API integration tests (needs properbysel_test database)
pnpm typecheck
pnpm --filter @pbs/web build
node e2e/flow.e2e.mjs             # browser test of the full first workflow (API + web running, Playwright installed)
```

The integration tests only run against a database whose name ends in `_test`.
