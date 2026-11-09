# ADR 0002 — Real PostgreSQL in user space for local development

**Date:** 2026-11-08
**Status:** Accepted

## Context

The build environment provides no Docker daemon, no root and no system PostgreSQL. The database must
still be real PostgreSQL: SQLite or an in-memory stand-in would hide features the schema depends on
(`text[]`, `jsonb`, `timestamptz`, enums, `Decimal`, partial indexes, `TRUNCATE … CASCADE`).

## Decision

Use the `embedded-postgres` package to run published PostgreSQL 18 binaries in user space:

- Cluster at `.data/postgres` (gitignored), port 55432, databases `vetnex` and `vetnex_test`.
- Lifecycle via `scripts/dev-db.mjs` (`pnpm db:start|stop|status|reset`).
- A `docker/docker-compose.yml` is included for machines that do have Docker, as an alternative, not
  as the documented default.

## Consequences

- Local development exercises the same engine and features as production.
- No elevated privileges required; `pnpm setup` is a single command.
- The cluster does not survive an archived workspace: `pnpm db:start` restarts it and `.data` may be
  recreated. Data is disposable by design.
- pnpm blocks install scripts by default; the binary package's symlink hydration must be allowed and,
  if it is skipped, recovered with `pnpm rebuild @embedded-postgres/linux-x64` (documented in
  DEVELOPMENT.md and handled by `scripts/setup-local.sh`).

## Alternatives considered

- **Docker Compose only** — unavailable in this environment.
- **PGlite (WASM PostgreSQL)** — attractive, but the wire protocol shim is immature and Prisma's
  expectations around it were not worth the risk.
- **SQLite** — rejected: would silently diverge from production behaviour on the exact column types
  the schema needs.
