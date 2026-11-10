# Deployment

**No production environment exists.** This document describes the intended target and the gaps that
must be closed before anything is deployed. Nothing here has been executed.

## Contents

- [Intended topology (AWS Sydney)](#intended-topology-aws-sydney)
- [Local Docker (optional, untested here)](#local-docker-optional-untested-here)
- [Build and run (single host)](#build-and-run-single-host)
- [Migration policy](#migration-policy)
- [Environment variables](#environment-variables)
- [Pre-production checklist](#pre-production-checklist)

## Intended topology (AWS Sydney)

```
Route 53 → CloudFront/WAF → ALB
                             ├── ECS service: web (Next.js, 2+ tasks)
                             └── ECS service: api (NestJS, 2+ tasks)
                                   ├── RDS PostgreSQL (Multi-AZ, encrypted, PITR)
                                   ├── ElastiCache Redis (sessions/limits/jobs)
                                   └── S3 (documents, encrypted, versioned)
CloudWatch + OpenTelemetry → dashboards and alerts
Secrets Manager → runtime configuration
```

Requirements before this topology is viable:

1. Replace the in-process rate limiter with a shared store (Redis/edge).
2. Add a transactional email provider for invitations and password resets
   (`AUTH_DEV_TOKEN_DELIVERY` must be `false`).
3. Object-level storage and malware scanning once documents ship.
4. Centralised logging with PII scrubbing; no tokens or patient data in logs.
5. Backup and restore rehearsal with a measured RTO/RPO.
6. CI/CD: typecheck, tests, dependency scanning, container build, migration stage.
7. WAF rules, TLS termination, HSTS.
8. Load test at representative concurrency before pilot.

## Local Docker (optional, untested here)

`docker/docker-compose.yml` describes PostgreSQL 18 + Redis for environments that have a Docker
daemon. The development workflow in this repository does **not** use it — the sandbox this was built
in has no Docker access, so `scripts/dev-db.mjs` runs PostgreSQL directly. Treat the compose file as
a convenience for other machines and verify it before relying on it.

## Build and run (single host)

```bash
pnpm install --frozen-lockfile
pnpm --filter @vetnex/database generate
pnpm --filter @vetnex/web build
DATABASE_URL=... pnpm --filter @vetnex/api start     # tsx runtime
DATABASE_URL=... pnpm --filter @vetnex/web start
```

The API runs TypeScript directly through `tsx` and is gated by `tsc --noEmit`
(`docs/decisions/0005-api-runtime.md`). A pre-compiled image is a deployment-phase task.

## Migration policy

- Migrations are forward-only and committed with the code that needs them.
- Apply with `prisma migrate deploy` as a distinct stage before starting new tasks.
- Never edit an applied migration; add a new one.
- Destructive changes require a two-step deploy (add column → backfill → remove old column).
- Take a snapshot before migrating production.

## Environment variables

| Name | Required | Notes |
| --- | --- | --- |
| `DATABASE_URL` | yes | PostgreSQL connection string |
| `NODE_ENV` | yes | `production` in production |
| `API_PORT` | no | default 4000 |
| `SESSION_COOKIE_NAME` | no | default `vetnex_session` |
| `SESSION_TTL_HOURS` | no | default 12 |
| `SESSION_COOKIE_SECURE` | no | must be `true` behind TLS |
| `API_CORS_ORIGINS` | no | only for direct API access; the web proxy is same-origin |
| `AUTH_DEV_TOKEN_DELIVERY` | no | must be `false`/unset in production |
| `API_INTERNAL_URL` | web | internal API origin for server components and the proxy |
| `NEXT_ALLOWED_DEV_ORIGINS` | dev only | comma-separated exact dev hosts |
| `NEXT_PUBLIC_SHOW_DEMO_LOGINS` | no | must be unset in production |

## Pre-production checklist

- [ ] Email provider configured and tested end to end
- [ ] `AUTH_DEV_TOKEN_DELIVERY` unset; no token in any API response or log
- [ ] MFA available for owner and manager accounts
- [ ] Backups enabled, restore rehearsed
- [ ] Error monitoring (Sentry or equivalent) wired with PII scrubbing
- [ ] Dependency and container scanning in CI
- [ ] Privacy policy, terms and support process published
- [ ] Penetration test or external security review completed
- [ ] Clinical validation of documentation workflows by a veterinarian
