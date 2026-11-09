# ADR 0001 — Application stack

**Date:** 2026-11-08
**Status:** Accepted

## Context

VETNEX needs a strongly typed, server-rendered web application, a REST API with clear domain
boundaries, a relational database with strong integrity guarantees, and a path to background jobs and
integrations. The team is small; operational complexity is a real cost.

## Decision

- **Web:** Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4, a small in-repo design
  system (shadcn/ui-style API, hand-written components), TanStack Query for cacheful client reads.
- **API:** NestJS 11 on Express, REST, session-cookie auth, Zod contracts shared with the web app.
- **Data:** PostgreSQL 18 + Prisma 6.
- **Runtime:** Node 20+; API executed with `tsx` (see ADR 0005).

Pinned majors rather than floating `latest`: this project was started when the registry's `latest`
tags pointed at Next 16, Prisma 8-rc and TypeScript 7. Those majors are adopted deliberately, after
review, not implicitly on the next install.

## Consequences

- One language across the stack; request contracts cannot drift because both sides import the same
  Zod schema.
- Modular monolith: one schema, one transaction boundary, one deploy. Services are split by domain so
  extraction remains possible.
- Prisma gives typed queries and migrations but no row-level security; tenant isolation is an
  application-layer concern (ADR 0003).
- NestJS decorators require legacy `experimentalDecorators`; combined with `tsx` this means no
  emitted decorator metadata (ADR 0005).

## Alternatives considered

- **Single Next.js app with route handlers** — fastest to start, but blurs API/domain boundaries and
  makes future background workers and non-web clients harder.
- **tRPC** — excellent type safety, weaker story for external/partner integrations and documented
  REST contracts, which veterinary labs and accounting systems expect.
- **Drizzle instead of Prisma** — closer to SQL, but migrations and generated types are less
  turnkey for a small team.
