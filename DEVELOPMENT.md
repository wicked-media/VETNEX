# Development

## Contents

- [Prerequisites](#prerequisites)
- [First run](#first-run)
- [Everyday commands](#everyday-commands)
- [Environment](#environment)
- [Database workflow](#database-workflow)
- [Adding an endpoint](#adding-an-endpoint)
- [Adding a screen](#adding-a-screen)
- [Code style](#code-style)
- [Common issues](#common-issues)

## Prerequisites

Node.js ≥ 20.11 (developed on Node 26) and pnpm 10. The local database needs no Docker and no root:
`scripts/dev-db.mjs` runs real PostgreSQL 18 binaries from the `embedded-postgres` package.

## First run

```bash
pnpm setup     # install, start database, migrate, generate client, seed
pnpm dev       # api :4000, web :3000
```

`pnpm setup` is safe to re-run. It copies `.env.example` to `.env` if missing.

## Everyday commands

```bash
pnpm dev                     # both apps
pnpm --filter @vetnex/api dev
pnpm --filter @vetnex/web dev

pnpm typecheck               # every workspace
pnpm openapi:generate        # rewrite docs/openapi.json from the API
pnpm openapi:check           # fail if the committed OpenAPI document is stale
pnpm test                    # unit + integration + browser end-to-end
pnpm test:e2e                # browser suite only (needs `pnpm exec playwright install chromium`)
pnpm --filter @vetnex/api test

pnpm db:status               # is PostgreSQL running?
pnpm db:start                # start it (data in .data/postgres)
pnpm db:stop
pnpm db:reset                # deletes the local cluster (destructive, local only)
```

## Environment

Copy `.env.example` to `.env`. Local defaults point at `postgresql://vetnex:vetnex@127.0.0.1:55432/vetnex`.
Never commit `.env`. `AUTH_DEV_TOKEN_DELIVERY=true` returns invitation and reset tokens to the client
and logs them; it is forced off in production.

## Database workflow

```bash
# 1. edit packages/database/prisma/schema.prisma
# 2. create a migration against the local database
pnpm --filter @vetnex/database migrate:dev --name add_appointments
# 3. regenerate the client (also runs on `pnpm db:generate`)
pnpm --filter @vetnex/database generate
# 4. commit schema + migration together
```

`migrate deploy` is used everywhere else; `db push` is not used at all.

## Adding an endpoint

1. Add the request schema to `packages/shared/src/schemas.ts`.
2. Add the permission code to `packages/permissions/src/catalogue.ts` with `status: "active"` **only
   if** enforcement ships in the same change.
3. Implement the service, taking `AuthContext` and using `auth.organisation.id`.
4. Add the controller method with `@RequirePermission(...)` and `parseInput(schema, body)`.
5. Record an audit event for anything that changes state or grants access.
6. Add integration tests: happy path, validation failure, permission boundary, cross-tenant denial.
7. Update `API_DOCUMENTATION.md` and `CHANGELOG.md`.

## Adding a screen

- Server component fetches with `apiFetch` (cookie forwarded) and passes plain data down.
- Mutations live in client components using `apiRequest` from `lib/client-api.ts`, followed by
  `router.refresh()`.
- Gate visibility with `can(permissions, "code")` from `lib/navigation.ts` **and** rely on the API
  guard for the real decision.
- Use primitives from `@vetnex/ui`; keep presentational components free of hooks.
- Show loading, empty, error and success states — all four exist in the design system.

## Code style

- Strict TypeScript. No `any`. Prefer explicit types at module boundaries.
- Australian English in user-facing strings.
- Comments explain *why*, not *what*. Do not leave commented-out code.
- Keep service methods small; put invariants in the service, not the controller.

## Common issues

| Symptom | Cause | Fix |
| --- | --- | --- |
| `P1001: Can't reach database server` | PostgreSQL not running | `pnpm db:start` |
| `Missing symlink native/lib/libecpg.so` | pnpm blocked the binary package's install script | `pnpm rebuild @embedded-postgres/linux-x64` (or `pnpm setup`) |
| `Cannot access 'ACTIVE_PERMISSION_CODES' before initialization` | Circular module initialisation | Keep `catalogue.ts` free of imports from `roles.ts` |
| Next.js host blocked on a preview domain | Dev origin not allowlisted | `NEXT_ALLOWED_DEV_ORIGINS=<host> pnpm dev` |
| `Nest can't resolve dependencies` | Missing `@Inject(...)` on a constructor parameter | The API runs through `tsx`; decorator metadata is not emitted |
