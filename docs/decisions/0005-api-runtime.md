# ADR 0005 — API runs TypeScript through tsx, gated by tsc

**Date:** 2026-11-08
**Status:** Accepted for Phase 1

## Context

The monorepo shares TypeScript source between the API and five workspace packages. Compiling with
`tsc` requires either project references for every package (and a build step before every dev start)
or publishing compiled output, both of which slow the inner loop. NestJS conventionally relies on
`emitDecoratorMetadata`, which esbuild-based runners do not emit.

## Decision

- Execute the API with `tsx` in development and in this phase's `start` script.
- Type safety is enforced by `tsc --noEmit` in `pnpm typecheck`, which resolves workspace packages
  through their `exports` fields.
- Every constructor parameter uses an explicit `@Inject(Token)` decorator, so Nest's DI works without
  emitted metadata. This is a documented convention in AGENTS.md.
- Runtime behaviour is verified by starting the API and exercising it (health, auth, integration
  suite), not assumed from compilation.

## Consequences

- No build step between editing a shared package and running the API.
- Startup cost of on-the-fly transpilation (acceptable at this size).
- The `@Inject` convention is easy to forget; a missing decorator fails at runtime with a Nest DI
  error, and DEVELOPMENT.md lists the symptom.
- A compiled image (esbuild bundle or `nest build` with prebuilt packages) is a Phase 5 deployment
  task, so production startup does not depend on this decision.

## Alternatives considered

- **tsc project references** — correct but adds a mandatory build layer for every workspace change.
- **esbuild with `emitDecoratorMetadata` plugin** — brittle third-party plugins; avoided.
- **SWC/Nest CLI watch** — works, but the same shared-source compilation problem remains for
  workspace packages.
