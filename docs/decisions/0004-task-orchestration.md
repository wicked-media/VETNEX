# ADR 0004 — pnpm recursive scripts instead of Turborepo (for now)

**Date:** 2026-11-08
**Status:** Accepted, revisit when build times justify it

## Context

The brief specifies pnpm + Turborepo. The current task graph is five packages and two apps with
independent `typecheck`/`test` scripts and one build (web). Turborepo adds a dependency, a cache
directory and configuration for remote-cache benefits that do not exist yet.

## Decision

Use pnpm workspace scripts (`pnpm -r --parallel --filter "./apps/*" dev`, `pnpm -r typecheck`,
`pnpm -r test`) plus explicit per-package scripts. No Turborepo in Phase 1.

## Consequences

- One less dependency; `pnpm typecheck` and `pnpm test` behave exactly as documented.
- No task caching: `apps/web` build and repeated typechecks are re-run every time. Acceptable while
  the web build is small.
- Introducing Turborepo later is additive: add `turbo.json` and change the root scripts; no package
  restructuring required. The trigger is either build time over ~90s or adding a third deployable.

## Alternatives considered

- **Turborepo now** — small immediate benefit, extra surface to maintain.
- **Nx** — more capability than needed at this stage.
