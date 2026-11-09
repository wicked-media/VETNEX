/**
 * Prepares the dedicated end-to-end database before Playwright starts.
 *
 * The database is dropped and rebuilt on every run so the suite never depends on
 * leftover state from a previous attempt, and never touches development data.
 *
 * Steps: create the database if absent → reset the schema → migrate → seed the
 * synthetic Riverbend practice → insert synthetic audit history so pagination has
 * something real to page through.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { e2eDatabaseUrl } from "./env";

const ROOT = process.cwd();
const DATABASE_DIR = path.join(ROOT, "packages", "database");

interface QueryResult {
  rowCount: number | null;
  rows: Record<string, unknown>[];
}

interface PgClient {
  connect(): Promise<void>;
  query(sql: string, values?: unknown[]): Promise<QueryResult>;
  end(): Promise<void>;
}

const require = createRequire(path.join(ROOT, "package.json"));
const { Client } = require("pg") as { Client: new (config: Record<string, unknown>) => PgClient };

const PAGINATION_FIXTURES = 80;

function connectionParts(url: string) {
  const parsed = new URL(url);
  const database = decodeURIComponent(parsed.pathname.replace(/^\//, ""));
  if (!/^[A-Za-z0-9_]+$/.test(database)) {
    throw new Error(`Refusing to use unsafe database name "${database}".`);
  }
  return {
    host: parsed.hostname,
    port: Number(parsed.port || 5432),
    user: decodeURIComponent(parsed.username),
    password: decodeURIComponent(parsed.password),
    database,
  };
}

async function withClient(
  url: string,
  database: string,
  action: (client: PgClient) => Promise<void>,
): Promise<void> {
  const parts = connectionParts(url);
  const client = new Client({ ...parts, database });
  try {
    await client.connect();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(
      `Could not connect to PostgreSQL at ${parts.host}:${parts.port} (${message}). Start it with \`pnpm db:start\`.`,
    );
  }
  try {
    await action(client);
  } finally {
    await client.end();
  }
}

async function ensureDatabase(url: string): Promise<string> {
  const { database } = connectionParts(url);
  await withClient(url, "postgres", async (client) => {
    const existing = await client.query("select 1 from pg_database where datname = $1", [database]);
    if (!existing.rowCount) {
      await client.query(`CREATE DATABASE "${database}"`);
      process.stdout.write(`[e2e] created database ${database}\n`);
    }
  });
  return database;
}

async function resetSchema(url: string, database: string): Promise<void> {
  await withClient(url, database, async (client) => {
    await client.query("DROP SCHEMA IF EXISTS public CASCADE");
    await client.query("CREATE SCHEMA public");
  });
  process.stdout.write("[e2e] schema reset\n");
}

function migrate(url: string): void {
  const databaseRequire = createRequire(path.join(DATABASE_DIR, "package.json"));
  const prismaCli = databaseRequire.resolve("prisma/build/index.js");
  execFileSync(
    process.execPath,
    [prismaCli, "migrate", "deploy", "--schema", path.join("prisma", "schema.prisma")],
    {
      cwd: DATABASE_DIR,
      stdio: "inherit",
      env: { ...process.env, DATABASE_URL: url },
    },
  );
}

function seed(url: string): void {
  const tsx = path.join(DATABASE_DIR, "node_modules", ".bin", "tsx");
  if (!existsSync(tsx)) {
    throw new Error(
      "tsx is not installed for @vetnex/database. Run `pnpm install` before the end-to-end suite.",
    );
  }
  execFileSync(tsx, [path.join("prisma", "seed.ts")], {
    cwd: DATABASE_DIR,
    stdio: "inherit",
    env: { ...process.env, DATABASE_URL: url },
  });
}

async function seedPaginationFixtures(url: string, database: string): Promise<void> {
  await withClient(url, database, async (client) => {
    const organisation = await client.query("select id from \"Organisation\" where slug = $1", [
      "riverbend",
    ]);
    const organisationId = organisation.rows[0]?.id as string | undefined;
    if (!organisationId) throw new Error("Seeded organisation not found; the seed did not run.");

    const clinic = await client.query(
      'select id from "Clinic" where "organisationId" = $1 order by code limit 1',
      [organisationId],
    );
    const clinicId = (clinic.rows[0]?.id as string | undefined) ?? null;

    const owner = await client.query('select id, "fullName", email from "User" where email = $1', [
      "alex.morgan@riverbend.vet",
    ]);
    const ownerId = (owner.rows[0]?.id as string | undefined) ?? null;
    const ownerLabel = owner.rows[0] ? `${owner.rows[0].fullName} (${owner.rows[0].email})` : "System";

    await client.query('delete from "AuditEvent" where "requestId" like $1', ["e2e-%"]);
    await client.query(
      `insert into "AuditEvent" (
         "id", "organisationId", "clinicId", "actorUserId", "actorLabel", "action",
         "entityType", "entityId", "summary", "metadata", "requestId", "createdAt"
       )
       select gen_random_uuid(), $1, $2, $3, $4, 'e2e.pagination_fixture', 'Fixture', null,
              'Synthetic pagination fixture event ' || g,
              '{"synthetic": true}'::jsonb, 'e2e-' || g,
              now() - (g || ' minutes')::interval
       from generate_series(1, $5) as g`,
      [organisationId, clinicId, ownerId, ownerLabel, PAGINATION_FIXTURES],
    );

    const total = await client.query(
      'select count(*)::int as count from "AuditEvent" where "organisationId" = $1',
      [organisationId],
    );
    process.stdout.write(`[e2e] audit history contains ${String(total.rows[0]?.count)} events\n`);
  });
}

async function main(): Promise<void> {
  const url = e2eDatabaseUrl();
  const { host } = connectionParts(url);

  // This script drops the schema it is pointed at. Refuse anything that is not a
  // local database so a misconfigured E2E_DATABASE_URL cannot wipe real data.
  const localHosts = new Set(["127.0.0.1", "localhost", "::1", "[::1]"]);
  if (!localHosts.has(host) && process.env.E2E_ALLOW_REMOTE_DATABASE !== "true") {
    throw new Error(
      `Refusing to reset a non-local database (${host}). Set E2E_ALLOW_REMOTE_DATABASE=true only if you are certain it is disposable.`,
    );
  }

  const database = await ensureDatabase(url);
  await resetSchema(url, database);
  migrate(url);
  seed(url);
  await seedPaginationFixtures(url, database);
  process.stdout.write("[e2e] database ready\n");
}

main().catch((error) => {
  process.stderr.write(`[e2e] preparation failed: ${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
});
