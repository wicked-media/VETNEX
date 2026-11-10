# Changelog

All notable changes. Format loosely follows Keep a Changelog; dates are ISO.

## [0.1.0] — 2026-11-08 — Phase 0 + Phase 1 foundation

### Added

**Workspace**
- pnpm monorepo: `apps/web` (Next.js 15), `apps/api` (NestJS 11), `packages/{database,permissions,authentication,shared,ui}`.
- Local PostgreSQL 18 lifecycle in user space (`scripts/dev-db.mjs`) with no Docker or root requirement.
- Initial Prisma migration `0001_init` and a synthetic multi-clinic seed.

**Authentication**
- Signup (organisation + first clinic + five system roles + owner), login, logout.
- Session cookies (HttpOnly, SameSite=Lax, 12h), session listing and per-device revocation.
- scrypt hashing with per-hash parameters and upgrade-on-login.
- Password policy, account lockout (5 attempts / 15 min), timing-safe unknown-email handling.
- Password reset with full session revocation.
- Staff invitations with 72-hour tokens, acceptance, revocation, expiry handling.
- Origin checks on state-changing requests; in-process rate limiting.

**Authorisation**
- 28-permission catalogue with `active`/`planned` status; planned permissions cannot be granted.
- Five default roles plus a protected owner role; custom role creation and editing.
- `PermissionsGuard` on every mutating route; last-owner protection.

**Data**
- Organisation, clinic, department, user, membership, membership-clinic, role, session,
  password-reset token, invitation, audit event, configuration tables.
- Tenant scoping on every read and write; cross-tenant ids return 404.

**Audit**
- Append-only audit trail with actor, action, entity, summary, metadata, IP, user agent, request id.
- No update or delete path; tested.

**Web**
- Design system (buttons, inputs, fields, cards, stats, badges, alerts, tables, empty states).
- Application shell: permission-aware navigation, command palette (⌘K), light/dark themes, mobile drawer.
- Screens: sign-in, sign-up, invitation acceptance, forgot/reset password, dashboard, team, clinics,
  roles, audit trail, organisation settings, 404.
- Typed form hook sharing Zod contracts with the API; server components for reads, client mutations.

**Tests**
- 40 unit tests (permissions, authentication, contracts, navigation) and 49 PostgreSQL-backed
  integration tests covering auth, tenancy, RBAC, audit and the OpenAPI contract — all passing.
- Eight Playwright browser end-to-end tests (`tests/e2e`) against a real Chromium, Next.js server,
  API and database: sign-in and sign-out, invitation creation plus acceptance through the emailed
  link, custom role creation and permission editing, and audit-trail pagination and permission
  denial. `pnpm test:e2e` rebuilds a dedicated E2E database first; `pnpm test` now runs all three
  layers.
- GitHub Actions CI (`.github/workflows/ci.yml`): frozen-lockfile install, Prisma client generation,
  typecheck, unit tests and PostgreSQL-backed integration tests against a Postgres service, plus an
  OpenAPI drift check, on every push and pull request.
- A generated OpenAPI 3.0 document ([`docs/openapi.json`](docs/openapi.json)) with request bodies
  derived from the shared Zod contracts, served publicly at `GET /openapi.json`, validated by
  `pnpm openapi:check`, and kept in step with the routes by `apps/api/test/openapi.spec.ts`.
- A `Browser end-to-end` CI job runs the Playwright suite against its own disposable PostgreSQL
  service and uploads the HTML report and failure traces as the `playwright-report` artifact.
- That job caches the Playwright browser download, keyed on the Playwright version, so Chromium is
  not re-fetched on every run.
- A `Documentation links` CI job runs `pnpm docs:check`, which fails when a tracked Markdown file
  links to a repository path or a `#heading` that does not exist.
- Cross-tenant tests in `apps/api/test/tenancy.spec.ts` prove that one organisation cannot list
  another's staff, suspend its members or revoke its invitations, read or rename its clinics, or
  page through its audit trail with one of its event ids — and that no route amends or deletes an
  audit record at all.
- `.github/dependabot.yml` asks Dependabot for weekly version updates: one grouped pull request for
  the workflow actions, one for patch and minor workspace dependencies, and separate pull requests
  for majors of the Next.js/React and Prisma toolchains, which need planned migrations.

**Documentation**
- README, ARCHITECTURE, PRODUCT_REQUIREMENTS, DATABASE_SCHEMA, API_DOCUMENTATION, SECURITY,
  COMPLIANCE_ASSUMPTIONS, DEVELOPMENT, DEPLOYMENT, TESTING, ROADMAP, AGENTS and six ADRs.
- Contents lists at the top of the longer documents, with every entry checked by `pnpm docs:check`.
- Unit tests for the documentation checker (`pnpm docs:test`) pin the heading rules GitHub uses —
  punctuation, repeated-heading suffixes, setext headings, fenced blocks and HTML anchors — so
  anchor matching cannot drift silently.

### Known limitations
- No email provider: invitation/reset tokens are returned in development only.
- No MFA, passkeys or SSO enrolment.
- No load or performance testing.
- Clients, patients, scheduling, clinical, billing and inventory are not implemented and are not
  stubbed in the UI.
