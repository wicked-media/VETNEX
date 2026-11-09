import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

/**
 * The end-to-end suite needs the repository-root .env, which Node does not load on
 * its own. Parsing it here keeps the suite free of runtime dependencies and ensures
 * the Playwright config, the preparation script and the app servers all resolve the
 * same database URL.
 *
 * Playwright loads this file from the repository root, so `process.cwd()` is stable.
 */
const ROOT = process.cwd();

export const DEFAULT_E2E_DATABASE_URL = "postgresql://vetnex:vetnex@127.0.0.1:55432/vetnex_e2e";

function loadEnvFile(): Record<string, string> {
  const file = path.join(ROOT, ".env");
  if (!existsSync(file)) return {};
  const values: Record<string, string> = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    const [, key, raw] = match;
    if (!key) continue;
    values[key] = (raw ?? "").replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
  return values;
}

/**
 * The E2E suite owns its own database. It is dropped and rebuilt on every run, so it
 * must never point at development or production data.
 */
export function e2eDatabaseUrl(): string {
  if (process.env.E2E_DATABASE_URL) return process.env.E2E_DATABASE_URL;
  const file = loadEnvFile();
  return file.E2E_DATABASE_URL || DEFAULT_E2E_DATABASE_URL;
}

export function e2ePorts(): { web: number; api: number } {
  return {
    web: Number(process.env.E2E_WEB_PORT ?? 3100),
    api: Number(process.env.E2E_API_PORT ?? 4100),
  };
}
