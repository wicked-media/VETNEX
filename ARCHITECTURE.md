# Architecture

## Contents

- [Shape of the system](#shape-of-the-system)
- [Why the browser only talks to the web origin](#why-the-browser-only-talks-to-the-web-origin)
- [Tenancy model](#tenancy-model)
- [Authentication and sessions](#authentication-and-sessions)
- [Authorisation](#authorisation)
- [Audit trail](#audit-trail)
- [Configuration and regional defaults](#configuration-and-regional-defaults)
- [Error envelope](#error-envelope)
- [Frontend approach](#frontend-approach)
- [Data model conventions](#data-model-conventions)
- [Deliberate deferrals](#deliberate-deferrals)

## Shape of the system

```
Browser
  │  HTTPS, first-party cookies only
  ▼
Next.js 15 (apps/web)
  │  server components → internal HTTP (cookie forwarded server-side)
  │  client mutations  → /api/vetnex/* (rewrite proxy)
  ▼
NestJS API (apps/api)
  │  AuthGuard → PermissionsGuard → controller → service
  ▼
Prisma (packages/database) → PostgreSQL 18
```

Two deployable processes and one database. The modular monolith is deliberate: a single schema,
single transaction boundary and one deploy for the whole practice workflow. Services are split by
domain (`auth`, `organisation`, `clinics`, `staff`, `roles`, `audit`, `dashboard`) so that a service
can be extracted later without changing callers.

## Why the browser only talks to the web origin

The session cookie is `HttpOnly`, `SameSite=Lax` and first-party. `next.config.ts` rewrites
`/api/vetnex/*` to the API. This keeps:

- No CORS credential handling in the browser.
- No token in `localStorage`, so XSS cannot exfiltrate a session.
- One origin to secure with headers (`X-Frame-Options`, `nosniff`, `Referrer-Policy`).

Server components call the API directly over loopback and forward only the session cookie.

## Tenancy model

```
Organisation (tenant)
├── Clinic (1..n)          code unique per organisation
│   └── Department
├── Role (1..n)            permissions string[]
├── Membership (1..n)      user ↔ organisation ↔ role
│   └── MembershipClinic   explicit clinic access; none = all clinics
├── Invitation
├── Session                bound to one organisation
└── AuditEvent
```

Rules that make isolation hold:

1. A session stores the `organisationId` it was created for. The API never accepts a tenant id from
   the client.
2. `AuthGuard` resolves the session → user → membership → role → clinics and attaches `AuthContext`.
   Services destructure `organisationId` from it.
3. Every read and write is filtered by that id; cross-tenant ids produce `404`, not `403`, so
   existence is not leaked.
4. Invitations validate that the role and clinic ids belong to the inviting organisation.
5. Role changes validate the role belongs to the same organisation and protect the last owner.

Multi-practice users are supported by the model: one user, many memberships. Sign-in with more than
one membership requires an explicit practice selection, which becomes the session's tenant.

`docs/decisions/0003-tenant-isolation.md` records why row-level security is deferred and what would
need to change to add it.

## Authentication and sessions

- Passwords: scrypt, N=2^15, per-password salt, parameters stored in the hash so cost can be raised
  and old hashes upgraded on next sign-in (`passwordHashNeedsRehash`).
- Sessions: 256-bit random token, only its SHA-256 hash is stored. Cookies are `HttpOnly`,
  `SameSite=Lax`, `Secure` when configured/PROD, 12-hour lifetime, touched at most every 5 minutes.
- Lockout: five failed attempts locks the account for 15 minutes. Unknown emails still pay the
  hashing cost so timing does not reveal account existence.
- Password reset revokes every session for that user.
- CSRF: `SameSite=Lax` plus an origin check on every state-changing request (`AuthGuard`). An
  `Origin` matching the forwarded host or an allowlisted origin is accepted.
- Rate limiting: fixed-window in-process limiter on signup, login, reset and invitation acceptance.
  Disabled under `NODE_ENV=test`.

Gaps (documented, not hidden): no MFA enrolment, no passkeys, no SSO, no breach-password check.

## Authorisation

`packages/permissions` is the single source of truth:

- 28 permissions with `status: "active" | "planned"`.
- Six seeded roles; `org_admin` is protected from edits and deletion.
- `hasPermission` supports exact codes, `resource:*` and `*`.
- `validateGrantablePermissions` rejects unknown codes **and** planned codes, so a role can never
  claim access to a module that does not exist.

`PermissionsGuard` reads `@RequirePermission(...)` metadata and requires **all** listed codes. The
UI filters navigation and actions with the same catalogue, but the UI check is only an affordance.

## Audit trail

`AuditService.record()` writes actor, action, entity, summary, metadata, IP, user agent and request
id. `AuditEvent` has no `updatedAt`; there is no update or delete route. Events written in this
increment: `organisation.created`, `organisation.updated`, `clinic.created/updated`,
`staff.invited/invitation_revoked/invitation_accepted/updated`, `role.created/updated/deleted`,
`auth.signed_in/signed_out/session_revoked/password_reset`.

## Configuration and regional defaults

Organisation holds `timezone`, `currency`, `locale`, `gstRate` and `retentionYearsClinical`.
`Configuration` provides a scoped key/value store for future per-clinic overrides (seeded, not yet
exposed in the UI). Australian defaults are `Australia/Sydney`, `AUD`, `en-AU`, 10% GST, 7 years.

## Error envelope

```json
{ "error": { "code": "VALIDATION_FAILED", "message": "Some fields need attention.",
             "fieldErrors": { "email": ["Enter a valid email address."] } } }
```

`ApiExceptionFilter` maps Prisma `P2002` → 409 `DUPLICATE`, `P2025` → 404 `NOT_FOUND`, and never
returns stack traces outside development.

## Frontend approach

- Server components own reads (`apiFetch`), pass plain data to client components.
- Client components own mutations (`apiRequest`) and call `router.refresh()` after success.
- `useForm` binds a shared Zod schema to state, merges server field errors, and mirrors the API's
  validation exactly.
- TanStack Query is used where cache identity matters (cursor-paginated audit log).
- Presentational primitives live in `packages/ui` with no hooks so they work in both server and
  client trees.

## Data model conventions

UUID primary keys; `organisationId` on every tenant table; `createdAt`/`updatedAt` (except audit);
`deletedAt` soft delete on foundation entities; explicit indexes for tenant and lookup paths;
compound uniques for natural keys (`organisationId + code`, `organisationId + userId`).

## Deliberate deferrals

| Decision | Reason | Record |
| --- | --- | --- |
| PostgreSQL in user space for dev instead of Docker | Sandbox has no Docker daemon or root; runs identical PostgreSQL 18 binaries | `docs/decisions/0002-local-database.md` |
| No Turborepo yet | pnpm recursive scripts cover the task graph; adds a dependency with no current benefit | `docs/decisions/0004-task-orchestration.md` |
| Row-level security deferred | Application-layer scoping plus tests covers this milestone; RLS needs a connection-scoped `SET LOCAL` transaction strategy | `docs/decisions/0003-tenant-isolation.md` |
| No transactional email | No provider selected/funded yet; tokens are returned in development only | `docs/decisions/0006-token-delivery.md` |
| Notifications outbox, jobs, Redis | No long-running work exists yet; BullMQ arrives with reports/imports | `ROADMAP.md` |
