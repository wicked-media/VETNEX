# Security

This document states what is implemented, what is deliberately deferred, and how to report a
vulnerability. It is not a claim of certification.

## Implemented controls

**Authentication**
- scrypt password hashing (N=2^15, r=8, p=1) with per-password salt; parameters stored per hash so
  cost can be raised and hashes upgraded on next sign-in.
- Password policy: minimum 12 characters, maximum 200, no leading/trailing whitespace, small list of
  obvious passwords rejected. Composition rules intentionally not enforced (NIST SP 800-63B).
- 256-bit session tokens; only SHA-256 hashes are stored. Cookie: `HttpOnly`, `SameSite=Lax`,
  `Secure` when configured or in production, 12-hour lifetime.
- Account lockout after 5 failed attempts for 15 minutes; constant-cost verification for unknown
  emails to prevent user enumeration by timing.
- Password reset revokes all sessions. Sessions can be listed and revoked per device.
- Rate limiting on signup, login, password reset and invitation acceptance.

**Authorisation**
- Every tenant-owned query is scoped by the session's `organisationId`; the tenant id is never read
  from the request.
- Object-level checks: role/clinic ids supplied in requests are verified to belong to the caller's
  organisation.
- `PermissionsGuard` enforces `@RequirePermission` metadata on every mutating route; tested per role.
- The owner role is immutable and the last active owner cannot be removed or suspended.

**Web**
- The browser only talks to the web origin; the API is reached through a same-origin rewrite. No
  token is stored in `localStorage`.
- `Origin` validation on state-changing requests (defence in depth alongside SameSite cookies).
- Security headers: `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `X-Frame-Options`,
  `Permissions-Policy`. `poweredByHeader` disabled.
- React escapes output by default; no `dangerouslySetInnerHTML` except a static theme bootstrap
  script containing no user input.

**Data and audit**
- Audit trail is append-only with no update/delete route; actor, IP, user agent and request id
  recorded.
- Errors never include stack traces in production; request bodies are never logged.
- Secrets live in `.env` (gitignored). `.env.example` documents names only.

## Known gaps (must be closed before production)

| Gap | Impact | Planned |
| --- | --- | --- |
| No MFA/passkey enrolment | Single factor for all users | Phase 5 security milestone |
| No email provider | Invitation/reset tokens are returned to the caller in development only | Before any pilot |
| No malware scanning on uploads | No uploads exist yet | With document module |
| No database RLS | Relies on application scoping + tests | Phase 5 hardening (`docs/decisions/0003`) |
| Rate limiting is in-process | Not distributed across replicas | Edge/Redis limiter in deployment phase |
| No dependency/static analysis in CI | No CI pipeline yet | Phase 1 remainder (GitHub Actions) |
| No backup/restore drill | Recovery untested | Before pilot |
| Session cookie not bound to device fingerprint | Stolen cookie replay until expiry | Rotation on privilege change in Phase 2 |

## AI-specific rules (when AI ships)

- AI never diagnoses, prescribes, selects dosages, finalises records or advises owners directly.
- Every model output is a draft requiring explicit clinician review; model, prompt version and
  reviewer are stored.
- Patient context is restricted to records the requesting user can already read; cross-tenant
  leakage is tested.
- Recording requires documented consent; external processing is disclosed.

## Reporting a vulnerability

Do not open a public issue. Email the maintainers with reproduction steps and impact. Do not include
real patient data. Targets: acknowledgement within 2 business days, assessment within 5.

## Development hygiene

- Use synthetic data only (`pnpm db:seed`). Never load real client or patient data into a dev
  environment.
- Never paste production credentials into issues, chats or commits.
- Review `AGENTS.md` review checklist before merging anything touching tenancy or auth.
