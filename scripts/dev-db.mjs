#!/usr/bin/env node
/**
 * Local PostgreSQL for VETNEX development.
 *
 * Runs a real PostgreSQL server in user space using published PostgreSQL binaries,
 * so the project does not need Docker, root access or a system PostgreSQL install.
 * Data lives in .data/postgres (gitignored).
 *
 * Usage: node scripts/dev-db.mjs <start|stop|status|ensure|reset>
 */
import { existsSync, rmSync } from 'node:fs';
import path from 'node:path';
import EmbeddedPostgres from 'embedded-postgres';
import pg from 'pg';

const root = path.resolve(import.meta.dirname, '..');
const databaseDir = path.join(root, '.data', 'postgres');
const port = Number(process.env.VETNEX_DB_PORT ?? 55432);
const user = process.env.VETNEX_DB_USER ?? 'vetnex';
const password = process.env.VETNEX_DB_PASSWORD ?? 'vetnex';
const databases = ['vetnex', 'vetnex_test'];

const instance = new EmbeddedPostgres({
  databaseDir,
  user,
  password,
  port,
  persistent: true,
});

function log(message) {
  process.stdout.write(`[dev-db] ${message}\n`);
}

async function withClient(database, fn) {
  const client = new pg.Client({ host: '127.0.0.1', port, user, password, database });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

async function isRunning() {
  try {
    await withClient('postgres', async (c) => c.query('select 1'));
    return true;
  } catch {
    return false;
  }
}

async function ensureDatabases() {
  for (const name of databases) {
    const exists = await withClient('postgres', async (c) => {
      const res = await c.query('select 1 from pg_database where datname = $1', [name]);
      return res.rowCount > 0;
    });
    if (!exists) {
      await instance.createDatabase(name);
      log(`created database ${name}`);
    }
  }
}

async function start() {
  if (!existsSync(path.join(databaseDir, 'PG_VERSION'))) {
    log(`initialising cluster at ${databaseDir}`);
    await instance.initialise();
  }
  if (await isRunning()) {
    log(`already running on 127.0.0.1:${port}`);
  } else {
    log('starting PostgreSQL');
    await instance.start();
  }
  await ensureDatabases();
  const version = await withClient('vetnex', async (c) => (await c.query('show server_version')).rows[0]);
  log(`ready — PostgreSQL ${version ? version.server_version : '?'} on 127.0.0.1:${port}`);
  log(`DATABASE_URL=postgresql://${user}:${password}@127.0.0.1:${port}/vetnex`);
}

async function stop() {
  if (!(await isRunning())) {
    log('not running');
    return;
  }
  await instance.stop();
  log('stopped');
}

async function status() {
  if (await isRunning()) {
    const v = await withClient('vetnex', async (c) => (await c.query('show server_version')).rows[0]);
    log(`running on 127.0.0.1:${port} (PostgreSQL ${v ? v.server_version : '?'})`);
  } else {
    log('not running');
    process.exitCode = 1;
  }
}

async function reset() {
  await stop().catch(() => {});
  rmSync(databaseDir, { recursive: true, force: true });
  log('cluster removed');
}

const command = process.argv[2] ?? 'start';
const actions = { start, stop, status, reset, ensure: ensureDatabases };

if (!actions[command]) {
  log(`unknown command "${command}" — use start, stop, status, ensure or reset`);
  process.exit(2);
}

actions[command]()
  .then(() => {
    // The PostgreSQL daemon keeps file handles open, which would otherwise keep this
    // script alive. Give stdout a moment to flush, then exit explicitly.
    setTimeout(() => process.exit(0), 50);
  })
  .catch((error) => {
    log(`error: ${error instanceof Error ? error.message : String(error)}`);
    process.exit(1);
  });
