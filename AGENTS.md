# AGENTS.md — rules for AI coding agents

Read this before changing anything. It describes how VETNEX is built and what must not break.

## Non-negotiables

1. **Tenant isolation is a code-path property.** Every tenant-owned query takes
   `organisationId` from `AuthContext` (resolved by `AuthGuard`), never from a request body,
   query string or client-supplied header. A new endpoint that accepts an organisation id from the
   caller is a defect.
2. **Never silently overwrite clinical or financial records.** When those modules land, amendments
   are append-only with a reason and an author. Soft-delete and version; do not `DELETE`.
3. **The audit trail is append-only.** `AuditEvent` has no `updatedAt`, and the API exposes no
   update or delete route. Do not add one.
4. **No fake data in production builds.** Development data comes from `packages/database/prisma/seed.ts`
   and is labelled synthetic. Never present a stub as a working feature.
5. **No placeholder buttons.** If a control does not call a real endpoint, do not render it.
6. **Permissions must be enforced server-side.** UI checks (`can(...)`) are affordances only. Every
   mutating route needs `@RequirePermission(...)` and a matching test.
7. **Planned permissions cannot be granted.** `validateGrantablePermissions` rejects codes whose
   catalogue entry is `status: "planned"`. Move a permission to `active` only in the same change
   that implements and tests its enforcement.
8. **AI must never be a dependency for core function**, never finalise clinical records, never
   diagnose or prescribe, and always record model, prompt version and reviewer.
9. **No secrets in the repository.** `.env` is gitignored; `.env.example` documents names only.
   Never log tokens, cookies, patient data or credentials.
10. **Do not claim compliance.** Configurable retention or GST settings are not certification.

## Repository map

| Path | Contents |
| --- | --- |
| `apps/web` | Next.js App Router UI. Server components read data; client components mutate via `/api/vetnex/*` |
| `apps/api` | NestJS API. Global `AuthGuard` → `PermissionsGuard` → controller → service → Prisma |
| `packages/database` | Prisma schema (`prisma/schema.prisma`), migrations, seed, generated client |
| `packages/permissions` | Permission catalogue, role defaults, matcher |
| `packages/authentication` | scrypt hashing, token helpers, password policy |
| `packages/shared` | Zod contracts shared by API and web |
| `packages/ui` | Presentational components (no hooks, no "use client") |

## Conventions

- **Language:** Australian English in UI copy and docs (`organisation`, `authorise`, `program`).
  Dates `en-AU`, currency `AUD`, time zones IANA (`Australia/Sydney`).
- **TypeScript:** strict, `noUncheckedIndexedAccess`, no `any` in new code. Validate all external
  input with the shared Zod schema via `parseInput()`.
- **Nest DI:** constructor parameters use explicit `@Inject(Token)` because the API runs through
  `tsx` (esbuild) and does not emit decorator metadata. Omitting `@Inject` breaks DI at runtime.
- **API errors:** throw `HttpException` subclasses with `{ code, message, fieldErrors? }`.
  `ApiExceptionFilter` produces the single `{ error: { ... } }` envelope and never leaks internals.
- **Money and tax:** `Decimal` in PostgreSQL, integer cents in application code, deterministic
  rounding, GST calculated per line. Never use floating point for currency.
- **Database:** UUID keys, `organisationId` on every tenant table, explicit indexes, migrations via
  `prisma migrate` (never `db push` against shared environments).

## Commands

```bash
pnpm install                 # dependencies
pnpm db:start                # local PostgreSQL (user space, no Docker)
pnpm db:migrate              # apply migrations
pnpm db:seed                 # synthetic data
pnpm dev                     # web :3000 + api :4000
pnpm typecheck               # all workspaces
pnpm test                    # docs checks + unit + integration + end-to-end
pnpm test:e2e                # Playwright only (rebuilds the dedicated E2E database first)
pnpm --filter @vetnex/api test        # API integration tests (needs database)
pnpm openapi:generate        # rewrite docs/openapi.json after changing a route or contract
pnpm openapi:check           # validate the document; CI fails if it is stale
pnpm --filter @vetnex/database migrate:dev --name <name>   # new migration
```

## Definition of done for a feature

1. Acceptance criteria written down (issue or `docs/`).
2. Schema change + migration committed together with the code that uses it.
3. Request contract in `packages/shared`.
4. Service code scoped to the caller's organisation.
5. Permission added to the catalogue (as `active`) and enforced on the route.
6. Audit events recorded for security-relevant or record-changing actions.
7. Tests: permission boundary, tenant isolation where relevant, happy path, validation failure.
8. `pnpm typecheck` and `pnpm test` pass.
9. Documentation updated (`API_DOCUMENTATION.md`, `CHANGELOG.md`).
10. Report known limitations rather than hiding them.

## Review checklist

- Does any query omit `organisationId`?
- Can a caller escalate by supplying an id from another tenant?
- Does a new mutation record an audit event?
- Are new permissions actually enforced, or only displayed?
- Does the UI tell the truth about what is implemented?
- Are tokens, patient data or credentials absent from logs and responses?
