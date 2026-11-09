import { defineConfig, devices } from "@playwright/test";
import { e2eDatabaseUrl, e2ePorts } from "./tests/e2e/env";

/**
 * Browser end-to-end tests run against a real API, a real Next.js server and a real
 * PostgreSQL database — the same code paths a practice uses. Nothing is mocked.
 *
 * The suite owns ports 4100 (API) and 3100 (web) so it never collides with a
 * developer's `pnpm dev` on 4000/3000, and its own database (see E2E_DATABASE_URL).
 *
 * The preparation step runs before this config is used:
 *   pnpm test:e2e  →  tsx tests/e2e/prepare.ts && playwright test
 */
const { web, api } = e2ePorts();
const webUrl = `http://127.0.0.1:${web}`;
const apiUrl = `http://127.0.0.1:${api}`;

export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /.*\.spec\.ts/,
  // One worker: the suite mutates shared practice state (invitations, roles, audit
  // history) and deterministic assertions are worth more than parallel speed here.
  fullyParallel: false,
  workers: 1,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  // The HTML report is retained as a CI artifact; the list reporter keeps the log readable.
  reporter: [["list"], ["html", { outputFolder: "playwright-report", open: "never" }]],
  use: {
    baseURL: webUrl,
    locale: "en-AU",
    timezoneId: "Australia/Sydney",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "pnpm --filter @vetnex/api start",
      url: `${apiUrl}/health`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        NODE_ENV: "development",
        API_PORT: String(api),
        DATABASE_URL: e2eDatabaseUrl(),
        API_CORS_ORIGINS: "",
        SESSION_COOKIE_SECURE: "false",
        AUTH_DEV_TOKEN_DELIVERY: "true",
      },
    },
    {
      command: `pnpm exec next dev --port ${web} --hostname 127.0.0.1`,
      cwd: "apps/web",
      url: `${webUrl}/login`,
      reuseExistingServer: false,
      timeout: 120_000,
      env: {
        API_INTERNAL_URL: apiUrl,
        NEXT_PUBLIC_SHOW_DEMO_LOGINS: "true",
        NEXT_ALLOWED_DEV_ORIGINS: "",
      },
    },
  ],
});
