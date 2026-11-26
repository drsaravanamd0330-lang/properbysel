# Handoff

Where things stand on 2026-11-26 and what comes next. See IMPLEMENTATION_STATUS.md for detail.

- Done: Phases 1–2 (first workflow on API + web), verified by 22 unit tests, 19 API integration tests, a production web build, and a browser E2E run (`e2e/flow.e2e.mjs`).
- Next: Phase 3 Expo app (`apps/mobile`) using `@pbs/api-client`; then Phase 4 payments (sandbox adapter first), admin tools, saved searches/compare, CI, deployment docs, business launch package.
- Open decision: where the repository should live (GitHub repo recommended, or the owner's F:\2. ChatGpt\ProperBySel folder).
- Never run `prisma migrate reset`; tests use `migrate deploy` + truncate on a `_test` database only.
