import { existsSync } from "node:fs";
import path from "node:path";
import dotenv from "dotenv";

/**
 * Environment loading and typed access.
 *
 * Loads the repository-root .env for local development (searches upwards so the
 * API works whether it is started from the repo root or its own workspace) and
 * never overrides variables already provided by the process — that is what lets
 * the test runner point the same code at the test database.
 */
const candidates = [
  process.env.VETNEX_ENV_FILE,
  path.resolve(process.cwd(), ".env"),
  path.resolve(process.cwd(), "../../.env"),
  path.resolve(process.cwd(), "../.env"),
].filter((candidate): candidate is string => Boolean(candidate));

for (const candidate of candidates) {
  if (existsSync(candidate)) {
    dotenv.config({ path: candidate });
    break;
  }
}

function readNumber(name: string, fallback: number): number {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

const nodeEnv = process.env.NODE_ENV ?? "development";
const isProduction = nodeEnv === "production";

export const env = {
  nodeEnv,
  isProduction,
  port: readNumber("API_PORT", 4000),
  sessionCookieName: process.env.SESSION_COOKIE_NAME ?? "vetnex_session",
  sessionTtlHours: readNumber("SESSION_TTL_HOURS", 12),
  cookieSecure: process.env.SESSION_COOKIE_SECURE === "true" || isProduction,
  corsOrigins: (process.env.API_CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
  /**
   * Security tokens for invitations and password resets are delivered to the
   * requesting client in development because no email provider is wired up yet.
   * This is hard-disabled in production.
   */
  devTokenDelivery: process.env.AUTH_DEV_TOKEN_DELIVERY === "true" && !isProduction,
  rateLimitsEnabled: nodeEnv !== "test",
} as const;

export function requireDatabaseUrl(): string {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set. Run `pnpm db:start`, then copy .env.example to .env.",
    );
  }
  return url;
}
