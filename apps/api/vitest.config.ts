import dotenv from "dotenv";
import { defineConfig } from "vitest/config";

dotenv.config({ path: "../../.env" });

process.env.NODE_ENV = "test";
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? process.env.DATABASE_URL;

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.spec.ts"],
    setupFiles: ["test/setup.ts"],
    testTimeout: 30_000,
    hookTimeout: 120_000,
    fileParallelism: false,
    pool: "forks",
    poolOptions: { forks: { singleFork: true } },
  },
});
