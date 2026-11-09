#!/usr/bin/env node
/**
 * Applies Prisma migrations to the dedicated test database before integration
 * tests run. Never points at the development database.
 *
 * Reads .env with a tiny local parser so the script has no dependencies of its own
 * (pnpm keeps workspace dependencies isolated per package).
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const root = path.resolve(import.meta.dirname, "..");

function loadEnvFile(file) {
  if (!existsSync(file)) return {};
  const values = {};
  for (const line of readFileSync(file, "utf8").split("\n")) {
    const match = /^\s*([A-Za-z0-9_]+)\s*=\s*(.*?)\s*$/.exec(line);
    if (!match) continue;
    const [, key, rawValue] = match;
    if (!key) continue;
    values[key] = (rawValue ?? "").replace(/^"(.*)"$/, "$1").replace(/^'(.*)'$/, "$1");
  }
  return values;
}

const env = { ...loadEnvFile(path.join(root, ".env")), ...process.env };
const testUrl = env.TEST_DATABASE_URL;

if (!testUrl) {
  console.error(
    "[test-db] TEST_DATABASE_URL is not set. Copy .env.example to .env and run `pnpm db:start`.",
  );
  process.exit(1);
}

const databaseDir = path.join(root, "packages", "database");
const require = createRequire(path.join(databaseDir, "package.json"));
const prismaCli = require.resolve("prisma/build/index.js");

execFileSync(
  process.execPath,
  [
    prismaCli,
    "migrate",
    "deploy",
    "--schema",
    path.join(databaseDir, "prisma", "schema.prisma"),
  ],
  {
    cwd: databaseDir,
    stdio: "inherit",
    env: { ...env, DATABASE_URL: testUrl },
  },
);
