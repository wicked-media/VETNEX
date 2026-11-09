# ADR 0003 — Tenant isolation at the application layer

**Date:** 2026-11-08
**Status:** Accepted (revisit in Phase 5)

## Context

Every request must be unable to read or write another organisation's data. Two layers are available:
application scoping and PostgreSQL row-level security (RLS). RLS is stronger but requires a
connection-scoped identity per transaction, which interacts awkwardly with Prisma's connection pool.

## Decision

For this phase, isolation is a property of the code path:

1. The session stores the `organisationId` it was issued for.
2. `AuthGuard` resolves user → membership → role → clinics and attaches `AuthContext`.
3. Services read `auth.organisation.id`; **no endpoint accepts a tenant id from the client**.
4. Every query filters by that id. Cross-tenant object ids raise `404`, not `403`.
5. Request-supplied role and clinic ids are validated against the caller's organisation.
6. Integration tests assert cross-tenant denial for clinics, staff, roles, invitations, audit and
   dashboard, including attempts using another tenant's raw ids.

## Consequences

- Simple to reason about and to test; no connection-affinity problem.
- A future service that forgets the `organisationId` filter is a real risk. Mitigations: the review
  checklist in AGENTS.md, the tenancy test suite, and keeping `organisationId` mandatory on models.
- RLS remains the goal for defence in depth: `SET LOCAL app.organisation_id` inside an interactive
  transaction, with policies on every tenant table. That work is scheduled for the Phase 5 security
  milestone, together with connection-pool review.

## Alternatives considered

- **RLS now** — stronger, but the transaction-per-request cost and Prisma interaction need careful
  benchmarking; it would delay the foundation without changing the API surface.
- **Schema-per-tenant** — strong isolation, heavy migrations and poor fit for practices that share
  staff across organisations.
