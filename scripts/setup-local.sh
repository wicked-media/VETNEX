#!/usr/bin/env bash
# VETNEX local bootstrap. Safe to re-run.
# Requires Node.js >= 20.11 (pnpm is installed automatically if missing).
set -euo pipefail

cd "$(dirname "$0")/.."

if ! command -v pnpm >/dev/null 2>&1; then
  echo "[setup] installing pnpm 10 locally"
  npm install -g pnpm@10
fi

if [ ! -f .env ]; then
  echo "[setup] creating .env from .env.example"
  cp .env.example .env
fi

if [ ! -f apps/web/.env.local ]; then
  echo "[setup] creating apps/web/.env.local (Next.js only reads env files inside the app directory)"
  cp apps/web/.env.example apps/web/.env.local
fi

echo "[setup] installing dependencies"
pnpm install

echo "[setup] starting local PostgreSQL"
pnpm db:start

echo "[setup] applying migrations"
pnpm db:migrate

echo "[setup] generating Prisma client"
pnpm db:generate

echo "[setup] seeding synthetic development data"
pnpm db:seed

echo "[setup] complete — run 'pnpm dev' and open http://localhost:3000"
