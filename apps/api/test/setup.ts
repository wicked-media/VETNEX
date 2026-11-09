import { afterAll, beforeAll } from "vitest";
import { PrismaClient } from "@vetnex/database";
import { requireDatabaseUrl } from "../src/env";

/**
 * Integration tests run against a real PostgreSQL database (TEST_DATABASE_URL).
 * Every test file starts from an empty schema so tests cannot depend on each
 * other's data. `prepare-test-db.mjs` applies migrations first.
 */
const prisma = new PrismaClient({ datasourceUrl: requireDatabaseUrl() });

const TABLES = [
  "Configuration",
  "AuditEvent",
  "Invitation",
  "MembershipClinic",
  "Membership",
  "Session",
  "PasswordResetToken",
  "User",
  "Department",
  "Clinic",
  "Role",
  "Organisation",
];

beforeAll(async () => {
  await prisma.$executeRawUnsafe(
    `TRUNCATE TABLE ${TABLES.map((table) => `"${table}"`).join(", ")} RESTART IDENTITY CASCADE`,
  );
});

afterAll(async () => {
  await prisma.$disconnect();
});
