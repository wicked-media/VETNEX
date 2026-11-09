#!/usr/bin/env node
/**
 * Writes `docs/openapi.json` from the API's own description and validates it.
 *
 *   pnpm openapi:generate   # rewrite the committed document
 *   pnpm openapi:check      # fail if the committed document is stale or invalid
 *
 * The check runs in CI, so the published contract cannot drift from the routes.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import SwaggerParser from "@apidevtools/swagger-parser";
import { buildOpenApiDocument } from "../apps/api/src/openapi/document";

const root = path.resolve(import.meta.dirname, "..");
const target = path.join(root, "docs", "openapi.json");
const relative = path.relative(root, target);

async function main(): Promise<void> {
  const check = process.argv.includes("--check");
  const document = buildOpenApiDocument();
  const serialised = `${JSON.stringify(document, null, 2)}\n`;

  // Validates structure, references and schemas. Cloned because the validator
  // may annotate the object it is given.
  await SwaggerParser.validate(structuredClone(document) as never);

  if (!check) {
    mkdirSync(path.dirname(target), { recursive: true });
    writeFileSync(target, serialised, "utf8");
    console.log(`[openapi] wrote ${relative} and validated it`);
    return;
  }

  let committed = "";
  try {
    committed = readFileSync(target, "utf8");
  } catch {
    console.error(`[openapi] ${relative} is missing. Run \`pnpm openapi:generate\`.`);
    process.exitCode = 1;
    return;
  }

  if (committed !== serialised) {
    console.error(
      `[openapi] ${relative} is out of date. Run \`pnpm openapi:generate\` and commit the result.`,
    );
    process.exitCode = 1;
    return;
  }

  console.log(`[openapi] ${relative} matches the API and validates`);
}

main().catch((error: unknown) => {
  console.error("[openapi] failed:", error);
  process.exitCode = 1;
});
