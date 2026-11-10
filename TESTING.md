# Testing

## Contents

- [Current state](#current-state)
- [What the integration suite proves](#what-the-integration-suite-proves)
- [Browser end-to-end tests](#browser-end-to-end-tests)
- [Continuous integration](#continuous-integration)
- [Not yet automated](#not-yet-automated)
- [Conventions for new tests](#conventions-for-new-tests)

## Current state

| Layer | Tool | Files | Notes |
| --- | --- | --- | --- |
| Permission catalogue and role semantics | Vitest | `packages/permissions/src/__tests__/permissions.test.ts` (14) | Wildcards, planned-permission rejection, default role invariants |
| Password and token primitives | Vitest | `packages/authentication/src/__tests__/authentication.test.ts` (12) | Hashing, policy, constant-time comparison, hostile parameters |
| Shared request contracts | Vitest | `packages/shared/src/__tests__/schemas.test.ts` (10) | Regional defaults, password length, address validation |
| Web navigation/authorisation affordances | Vitest | `apps/web/src/lib/navigation.test.ts` (4) | Hidden destinations match permission grants |
| API integration | Vitest + Supertest + PostgreSQL | `apps/api/test/*.spec.ts` (49) | Real database, real guards, real cookies |
| Browser end-to-end | Playwright (Chromium) | `tests/e2e/*.spec.ts` (8) | Real browser, real Next.js server, real API, real PostgreSQL |

Last verified run: 40 unit tests, 49 integration tests and 8 end-to-end tests passing, via a
single `pnpm test`, plus a clean `pnpm --filter @vetnex/web build` covering all 13 routes. The
four contract tests in `apps/api/test/openapi.spec.ts` are part of the integration count.

The API suite runs against a **separate database** (`TEST_DATABASE_URL`) and truncates tables before
each file. It never touches development data.

```bash
pnpm db:start
pnpm test                                # everything
pnpm --filter @vetnex/api test           # integration only
```

`pnpm test` starts with the documentation checks. They need no database, no browser and no
compiled output, so a broken link or anchor stops the run in a second instead of after the slower
suites.

`apps/api`'s `test` script runs `scripts/prepare-test-db.mjs` first, which applies migrations to the
test database with `prisma migrate deploy`.

## What the integration suite proves

- Signup creates organisation, clinic, departments, five system roles and an owner session.
- Session reads, sign-out revocation, session listing and revocation.
- Wrong password, unknown email and account lockout behave correctly and indistinguishably.
- Password reset revokes existing sessions and rejects the old password.
- Invitations: create, preview, accept, reuse rejection, revocation, expired links.
- The last active owner cannot be suspended.
- Untrusted browser origins are rejected on state-changing requests.
- Cross-tenant isolation for clinics, staff, roles, invitations, audit and dashboard.
- Permission boundaries for veterinarian, receptionist and observer roles.
- Planned permissions cannot be granted; custom roles grant exactly what they declare.
- Audit entries record actor and before/after metadata, paginate newest first, and cannot be
  modified or deleted through the API.
- Health endpoint reports database connectivity.

## Browser end-to-end tests

`tests/e2e` drives a real Chromium against a real Next.js server, a real NestJS API and a real
PostgreSQL database. Nothing is mocked, stubbed or intercepted.

```bash
pnpm exec playwright install --with-deps chromium   # once per machine (needs sudo for system libs)
pnpm db:start
pnpm test:e2e                                       # rebuild the E2E database, then run the suite
pnpm test                                           # docs checks, unit + integration + end-to-end
```

`pnpm test:e2e` runs `tests/e2e/prepare.ts` first. It drops and rebuilds the **dedicated**
`E2E_DATABASE_URL` database (default `postgresql://vetnex:vetnex@127.0.0.1:55432/vetnex_e2e`),
applies migrations, loads the synthetic Riverbend practice, and inserts 80 synthetic audit events
so pagination is exercised against real rows. Development and test databases are never touched.
Because it drops a schema, it refuses any host other than `localhost`/`127.0.0.1` unless
`E2E_ALLOW_REMOTE_DATABASE=true` is set explicitly.

Playwright starts its own servers on **3100** (web) and **4100** (API), so the suite can run while
`pnpm dev` is using 3000 and 4000. `reuseExistingServer` is off: a stale server fails the run
instead of silently testing old code.

### What the suite covers

| Spec | Proves |
| --- | --- |
| `sign-in.spec.ts` | Anonymous redirect, wrong-password handling with no field disclosure, successful sign-in against seeded data, sign-out ending the session |
| `team-invitation.spec.ts` | Invitation created through the dialog, development-only link surfaced honestly, token accepted in a clean browser context, invitation consumed and not reusable |
| `role-editing.spec.ts` | Custom role created, permissions edited, change survives a reload; planned permissions are disabled; the Owner role cannot be edited |
| `audit-paging.spec.ts` | Server-rendered first page, cursor pagination 25 → 50 → 75, event detail toggle, no edit/delete controls, permission denial for a role without `audit:read` |

The suite runs with `workers: 1` because it mutates shared practice state (invitations, roles,
audit history); deterministic assertions are worth more than parallel speed at this size.

### Container note

On a machine without root and without the standard Chromium system libraries or fonts, Playwright
cannot launch: it fails in `SkFontMgr_FontConfigInterface` when fontconfig has no config. Install the
dependencies (`playwright install --with-deps`) or provide `LD_LIBRARY_PATH` and `FONTCONFIG_FILE`
pointing at locally extracted packages. This is an environment limitation, not a project defect.

## Continuous integration

`.github/workflows/ci.yml` runs on every push and pull request:

1. `pnpm install --frozen-lockfile` and `prisma generate`.
2. `pnpm typecheck`.
3. `pnpm -r test` — unit and API integration tests against a `postgres:18-alpine` service on
   port 55432, using the throwaway `vetnex_test` database the service creates.
4. `pnpm openapi:check` — validates `docs/openapi.json` and fails if it no longer matches the API.
5. Uploads the validated document as the `openapi` build artifact.

A second job, `Browser end-to-end`, installs Chromium and runs `pnpm test:e2e` against its own
`postgres:18-alpine` service and a disposable `vetnex_e2e` database. It starts the real API and
Next.js servers on ports 4100 and 3100, exactly as on a developer machine, so the suite exercises
the same code paths. The HTML report and failure traces are uploaded as the `playwright-report`
artifact on every run, including when the job fails.

That job is skipped when a pull request changes nothing but Markdown or the documentation checker,
since neither can affect the browser suite. A `changes` job compares the pull request against its
base and decides; a job skipped by a condition still reports success, so the required check stays
satisfied. Filtering the workflow itself (`paths-ignore`) would instead leave the required check
pending and block the merge. Pushes to `main` and manual runs always execute the suite, so a merged
commit is still verified in the browser.

A third job, `Documentation links`, runs `node scripts/check-doc-links.mjs` without installing any
dependencies. It fails when a tracked Markdown file links to a repository path that does not exist —
the usual cause of a link that works in an editor but 404s on the host — or to a `#heading` that the
target document does not contain. Anchors are matched the way GitHub builds them, including the
`-1`, `-2` suffixes on repeated headings, setext headings underlined with `===` or `---`, and
explicit `<a id="...">` targets. External URLs are not fetched, so anchors pointing at other sites
are not verified. The same job first runs `pnpm docs:test`, a set of `node:test` cases that pin the
slug rules — punctuation, repeated-heading suffixes, setext headings, fenced blocks and HTML
anchors — so a change to the checker cannot quietly invalidate existing links. A plain `pnpm test`
runs both documentation checks locally, before the workspace suites and Playwright, so the same
failures surface before a push rather than in CI.

## Not yet automated

- Accessibility audits (axe) and visual regression.
- Load/performance tests and p95 budgets.
- Backup/restore verification.
- Migration rehearsal against a production-sized dataset.

## Conventions for new tests

- One test file per domain (`auth`, `tenancy`, `rbac`, `audit`, …) in `apps/api/test`.
- Assert the error `code`, not just the status, so contract changes are visible.
- Every permission boundary gets a positive and negative case.
- Every tenancy rule gets a cross-tenant attempt.
- Never widen a test to make it pass; fix the code or correct a wrong expectation deliberately.
- Tests use synthetic fixtures only — no real client, patient or staff data.
