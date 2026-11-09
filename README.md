# VETNEX

[![CI](https://github.com/wicked-media/VETNEX/actions/workflows/ci.yml/badge.svg)](https://github.com/wicked-media/VETNEX/actions/workflows/ci.yml)
[![OpenAPI 3.0.3](https://img.shields.io/badge/OpenAPI-3.0.3-6BA539?logo=openapiinitiative&logoColor=white)](docs/openapi.json)

The veterinary practice platform: one system for clinical records, scheduling, billing, team
administration and — later — client-facing experiences.

**Current status: Phase 0 (architecture) and Phase 1 (foundation) implemented.** Clients, patients,
scheduling, clinical records, billing and AI assistance are **not** built yet. Nothing in this
repository is production-ready, and no compliance certification is claimed.

---

## What works today

| Area | Implemented |
| --- | --- |
| Multi-tenant foundation | Organisation → clinic → department hierarchy, staff memberships, per-membership clinic access |
| Authentication | Email + password sign-in, scrypt hashing, HttpOnly session cookies, session expiry, device/session revocation, account lockout, origin checks, in-process rate limiting |
| Staff lifecycle | Invitations with 72-hour tokens, acceptance, password reset with session revocation |
| Roles and permissions | 28-code permission catalogue, 6 default roles, custom roles, "planned" permissions cannot be granted until enforced |
| Audit trail | Append-only event log with actor, request id, IP, metadata diffs; no update or delete path |
| Regional defaults | Australian time zones, AUD, GST rate, configurable clinical retention |
| Web application | Authenticated shell, command palette (⌘K), light/dark themes, dashboard, team, clinics, roles, audit, organisation settings |
| Tests | Unit tests for permission/authentication/validation logic; PostgreSQL-backed integration tests for auth, tenancy, RBAC and audit; a Playwright browser suite — all run in CI |
| API contract | OpenAPI 3 document generated from the shared Zod contracts (`docs/openapi.json`), served at `GET /openapi.json`, validated and drift-checked in CI |

## Quick start

Requires Node.js ≥ 20.11. No Docker, no root, no system PostgreSQL needed — the project runs a real
PostgreSQL cluster in user space.

```bash
pnpm setup        # or: ./scripts/setup-local.sh
pnpm dev          # web on :3000, API on :4000
```

Then open http://localhost:3000.

`pnpm setup` performs:

```bash
pnpm install                 # pnpm workspace dependencies
pnpm db:start                # starts PostgreSQL 18 on 127.0.0.1:55432, creates vetnex + vetnex_test
pnpm db:migrate              # applies prisma/migrations to the development database
pnpm db:generate             # generates the Prisma client
pnpm db:seed                 # loads synthetic development data
```

### Synthetic development accounts

Seeded by `pnpm db:seed` — **not real people, not real patients**. Password for every account:
`Vetnex-Demo-2026`.

| Email | Role |
| --- | --- |
| `alex.morgan@riverbend.vet` | Owner (full access) |
| `priya.raman@riverbend.vet` | Practice manager |
| `tom.becker@riverbend.vet` | Veterinarian |
| `sara.lee@riverbend.vet` | Veterinary nurse |
| `jess.kelly@riverbend.vet` | Receptionist |
| `locum@riverbend.vet` | Observer (read-only) |

## Scripts

| Command | Purpose |
| --- | --- |
| `pnpm dev` | Run web and API together |
| `pnpm build` | Build all workspaces |
| `pnpm typecheck` | Typecheck every workspace |
| `pnpm test` | Unit, integration and browser end-to-end tests |
| `pnpm test:e2e` | Browser end-to-end tests only (run `pnpm exec playwright install chromium` once) |
| `pnpm openapi:generate` | Rewrite `docs/openapi.json` from the API |
| `pnpm openapi:check` | Validate the document; fail if the committed copy is stale |
| `pnpm db:start` / `db:stop` / `db:status` / `db:reset` | Local PostgreSQL lifecycle |
| `pnpm db:migrate` | Apply migrations (`prisma migrate deploy`) |
| `pnpm db:seed` | Load synthetic data |
| `pnpm --filter @vetnex/database studio` | Prisma Studio |

## Repository layout

```
apps/
  web/                    Next.js 15 App Router application
  api/                    NestJS API (REST, session auth, RBAC)
packages/
  database/               Prisma schema, migrations, synthetic seed
  permissions/            Permission catalogue + default roles (shared by API and UI)
  authentication/         Password hashing, token generation, policy
  shared/                 Zod request contracts and API types
  ui/                     Presentational design system
docs/                     Architecture, product, security and delivery documents
scripts/                  Local database and setup scripts
```

Turborepo is not installed: pnpm recursive scripts cover the current task graph (see
`docs/decisions/0004-task-orchestration.md`).

## Contributing

`main` is protected by a repository ruleset: every change arrives through a pull request, and a pull
request cannot merge until both required checks pass. The rules bind the repository owner too — there
are no bypass actors — and force pushes and branch deletion are refused.

| Required check | Job | What it proves |
| --- | --- | --- |
| `Typecheck, tests and API contract` | `verify` | Typecheck, unit and PostgreSQL-backed integration tests, and `pnpm openapi:check` |
| `Browser end-to-end` | `e2e` | The Playwright suite against a disposable database, driving the real API and Next.js servers |

Both checks are strict, so a pull request must also be up to date with `main` before it can merge.
Every run publishes two artifacts: `openapi` (the validated contract) and `playwright-report` (the
HTML report plus failure traces).

Before opening a pull request, run the same commands CI runs:

```bash
pnpm typecheck
pnpm test             # unit, integration and browser end-to-end
pnpm openapi:check    # use openapi:generate if you changed a route or contract
```

New behaviour needs a test that fails without it — [TESTING.md](TESTING.md) covers the conventions,
and [AGENTS.md](AGENTS.md) lists the non-negotiables this project is held to.

## Documentation

- [ARCHITECTURE.md](ARCHITECTURE.md) — system design, tenancy, request lifecycle
- [PRODUCT_REQUIREMENTS.md](PRODUCT_REQUIREMENTS.md) — scope, personas, acceptance criteria
- [DATABASE_SCHEMA.md](DATABASE_SCHEMA.md) — entities, relationships, conventions
- [API_DOCUMENTATION.md](API_DOCUMENTATION.md) — endpoints and error envelope
- [SECURITY.md](SECURITY.md) — controls implemented and gaps
- [COMPLIANCE_ASSUMPTIONS.md](COMPLIANCE_ASSUMPTIONS.md) — Australian regulatory assumptions
- [DEVELOPMENT.md](DEVELOPMENT.md) — local workflow and conventions
- [TESTING.md](TESTING.md) — test strategy and how to run it
- [DEPLOYMENT.md](DEPLOYMENT.md) — environments and production gaps
- [ROADMAP.md](ROADMAP.md) — phases and priorities
- [CHANGELOG.md](CHANGELOG.md) — what changed, per increment
- [AGENTS.md](AGENTS.md) — rules for AI coding agents working here

## Honest limitations

- No transactional email provider: invitation and password-reset tokens are written to the API log
  and returned to the requesting client **in development only** (`AUTH_DEV_TOKEN_DELIVERY`). This
  must be replaced before any real deployment.
- MFA, passkeys and SSO are designed for but not implemented (`mfaEnabled` exists; no enrolment).
- No offline support yet — it is a later milestone, after clinical workflows stabilise.
- No AI features. No clinical, billing or inventory data model yet beyond the roadmap.
- Compatibility and compliance statements describe design intent only.
