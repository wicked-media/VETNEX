# API documentation

Base URL: `http://localhost:4000` (direct) or `/api/vetnex` (through the web proxy).
Content type: `application/json`. Auth: session cookie `vetnex_session` (HttpOnly, SameSite=Lax) or
`Authorization: Bearer <token>` for server clients.

The machine-readable contract is generated from the implementation and committed as
[`docs/openapi.json`](docs/openapi.json). The API also serves it at `GET /openapi.json`, publicly,
because clients need the contract before they can authenticate.

Request bodies are derived from the same Zod schemas in `packages/shared` that the server validates
with, so field names, formats and bounds cannot drift. `apps/api/test/openapi.spec.ts` fails if a
registered route is undocumented, or if a route's documented permission or security requirement
disagrees with the decorators the guards enforce. CI runs `pnpm openapi:check`, which validates the
document and fails when the committed copy is stale.

```bash
pnpm openapi:generate   # rewrite docs/openapi.json from the API
pnpm openapi:check      # validate, and fail if the committed document is out of date
```

## Contents

- [Error envelope](#error-envelope)
- [Health](#health)
- [Authentication](#authentication)
- [Organisation](#organisation)
- [Clinics](#clinics)
- [Staff](#staff)
- [Roles](#roles)
- [Audit](#audit)
- [Dashboard](#dashboard)
- [Conventions](#conventions)

## Error envelope

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Some fields need attention.",
    "fieldErrors": { "email": ["Enter a valid email address."] }
  }
}
```

Codes: `UNAUTHENTICATED`, `SESSION_EXPIRED`, `FORBIDDEN`, `UNTRUSTED_ORIGIN`, `VALIDATION_FAILED`,
`NOT_FOUND`, `DUPLICATE`, `CONFLICT`, `RATE_LIMITED`, `ACCOUNT_LOCKED`, `INVALID_CREDENTIALS`,
`ACCOUNT_DISABLED`, `NO_ACTIVE_MEMBERSHIP`, `ORGANISATION_SELECTION_REQUIRED`, `ROLE_PROTECTED`,
`ROLE_IN_USE`, `INVALID_PERMISSION`, `INVALID_CLINIC`, `LAST_OWNER`, `INVITATION_ACCEPTED`,
`INVITATION_UNAVAILABLE`, `ACCOUNT_EXISTS`, `CURSOR_NOT_FOUND`, `INTERNAL_ERROR`.

## Health

`GET /health` — public. `200 { status: "ok", database: "ok", service: "vetnex-api", time }`, or
`503 DATABASE_UNAVAILABLE`.

## Authentication

| Method | Path | Auth | Description |
| --- | --- | --- | --- |
| POST | `/auth/signup` | public | Create organisation + first clinic + owner. Sets session cookie. `201` |
| POST | `/auth/login` | public | `{ email, password, organisationId? }`. `409 ORGANISATION_SELECTION_REQUIRED` with `practices[]` when the user belongs to several practices |
| GET | `/auth/session` | optional | `SessionPayload` or `null` |
| POST | `/auth/logout` | optional | Revokes the current session and clears the cookie |
| GET | `/auth/sessions` | session | Devices/sessions for the signed-in user |
| DELETE | `/auth/sessions/:id` | session | Revoke one of the caller's sessions |
| POST | `/auth/password/forgot` | public | `202` always; never discloses account existence |
| POST | `/auth/password/reset` | public | `{ token, password }`; revokes all sessions |
| GET | `/auth/invitation/:token` | public | Invitation preview (organisation, role, expiry state) |
| POST | `/auth/invitation/:token/accept` | public | `{ fullName, password }`; creates the account and signs in |

`SessionPayload`:

```json
{
  "user": { "id": "…", "email": "…", "fullName": "…", "status": "ACTIVE", "mfaEnabled": false },
  "organisation": { "id": "…", "name": "…", "slug": "…", "timezone": "Australia/Sydney",
                    "currency": "AUD", "gstRate": 0.1, "retentionYearsClinical": 7 },
  "membership": { "id": "…", "title": "Owner", "roleId": "…", "roleName": "Owner",
                  "roleKey": "org_admin", "clinicIds": ["…"] },
  "permissions": ["organisation:read", "…"],
  "clinics": [{ "id": "…", "name": "…", "code": "RBMH" }],
  "session": { "id": "…", "expiresAt": "2026-11-08T14:00:00.000Z" }
}
```

## Organisation

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| GET | `/organisation` | `organisation:read` | Profile, regional settings, counts |
| PATCH | `/organisation` | `organisation:manage` | `name`, `timezone`, `gstRate`, `retentionYearsClinical`. Records before/after in audit. No-op patches write no audit entry |

## Clinics

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| GET | `/clinics` | `clinic:read` | Clinics with departments and staff counts |
| POST | `/clinics` | `clinic:manage` | `name`, `code` (2–8 alphanumeric, unique per organisation), address, contact, time zone. Creates default Consulting/Reception departments |
| PATCH | `/clinics/:id` | `clinic:manage` | Partial update; `status` toggles ACTIVE/INACTIVE. Other tenants' ids return `404` |

## Staff

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| GET | `/staff` | `staff:read` | Memberships with user, role, clinic ids, last sign-in |
| GET | `/staff/invitations` | `staff:read` | Pending invitations (unaccepted, unrevoked, unexpired) |
| POST | `/staff/invitations` | `staff:invite` | `{ email, roleId, fullName?, title?, clinicIds? }`. Revokes earlier pending invitations for the same email. Promoting to owner requires `organisation:manage` |
| POST | `/staff/invitations/:id/revoke` | `staff:invite` | Revoke a pending invitation |
| PATCH | `/staff/:membershipId` | `staff:manage` | `{ roleId?, status?, title?, clinicIds? }`. Rejects removal of the last active owner |

In development (`AUTH_DEV_TOKEN_DELIVERY=true`) responses include `devToken` so the invitation link
can be used without an email provider. Production must never set that flag.

## Roles

| Method | Path | Permission | Description |
| --- | --- | --- | --- |
| GET | `/roles` | `role:read` | Roles with permission codes and member counts |
| POST | `/roles` | `role:manage` | `{ name, description?, permissions[] }`. Unknown or `planned` permissions → `400 INVALID_PERMISSION` |
| PATCH | `/roles/:id` | `role:manage` | Owner role → `403 ROLE_PROTECTED` |
| DELETE | `/roles/:id` | `role:manage` | System roles → `409`; roles with members → `409 ROLE_IN_USE` |

## Audit

`GET /audit?limit=25&cursor=<uuid>` — requires `audit:read`. Returns
`{ events: AuditEvent[], nextCursor: string | null }`, newest first. An unknown cursor returns `404`
rather than silently returning page one. There is no create/update/delete route.

## Dashboard

`GET /dashboard` — any authenticated member. Returns organisation identity, metrics (clinics, active
staff, suspended staff, pending invitations, custom roles), clinics summary, setup checklist and the
six most recent audit events.

## Conventions

- All ids are UUIDs. Cross-tenant ids return `404`.
- State-changing requests from a browser must carry an `Origin` equal to the serving host or an
  allowlisted origin, otherwise `403 UNTRUSTED_ORIGIN`.
- Every response carries `x-request-id` (echoing the request header when supplied) which matches the
  audit event's `requestId`.
