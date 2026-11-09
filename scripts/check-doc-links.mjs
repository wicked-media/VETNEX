#!/usr/bin/env node
/**
 * Fails when a tracked Markdown file links to a repository path that does not exist.
 *
 * Only local links are checked. Accepts:
 *   - inline links and images: [text](path), ![alt](path)
 *   - reference definitions: [label]: path
 * and skips anything that is not a file in this repository: absolute URLs, mailto:,
 * tel:, protocol-relative links, root-absolute site paths and bare #anchors.
 *
 * Anchors inside a checked link (`path#heading`) are ignored: this checks that the
 * document exists, not that its headings are spelled the way the link expects.
 *
 * Plain Node with no dependencies, like the other scripts in this directory, so the
 * CI job needs no install step.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

const root = execFileSync("git", ["rev-parse", "--show-toplevel"], { encoding: "utf8" }).trim();
const files = execFileSync("git", ["ls-files", "-z", "--", "*.md"], {
  cwd: root,
  encoding: "utf8",
})
  .split("\u0000")
  .filter(Boolean)
  .sort();

const INLINE_LINK = /!?\[[^\]]*\]\(([^)\s]+)(?:\s+"[^"]*")?\)/g;
const REFERENCE_DEFINITION = /^\s{0,3}\[[^\]]+\]:\s*(\S+)/;
const EXTERNAL = /^(?:[a-z][a-z0-9+.-]*:|\/\/|\/)/i;

function targetsIn(line) {
  // Inline code is documentation about syntax, not a link.
  const withoutCode = line.replace(/`[^`]*`/g, "");
  const targets = [];
  for (const match of withoutCode.matchAll(INLINE_LINK)) {
    if (match[1]) targets.push(match[1]);
  }
  const definition = REFERENCE_DEFINITION.exec(withoutCode);
  if (definition?.[1]) targets.push(definition[1]);
  return targets;
}

function resolveTarget(fromFile, rawTarget) {
  const withoutAnchorAndQuery = rawTarget.split("#")[0]?.split("?")[0] ?? "";
  if (!withoutAnchorAndQuery) return null; // pure #anchor
  if (EXTERNAL.test(withoutAnchorAndQuery)) return null;
  let decoded = withoutAnchorAndQuery;
  try {
    decoded = decodeURIComponent(withoutAnchorAndQuery);
  } catch {
    // A malformed escape cannot name a real file; compare it as written.
  }
  return path.resolve(path.dirname(path.join(root, fromFile)), decoded);
}

const failures = [];
let checked = 0;

for (const file of files) {
  const lines = readFileSync(path.join(root, file), "utf8").split(/\r?\n/);
  let fence = null;
  lines.forEach((line, index) => {
    // Fenced code blocks can contain anything, including link-like text.
    const fenceMatch = /^\s{0,3}(`{3,}|~{3,})/.exec(line);
    if (fenceMatch?.[1]) {
      const marker = fenceMatch[1][0] ?? "`";
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      return;
    }
    if (fence !== null) return;

    for (const target of targetsIn(line)) {
      const resolved = resolveTarget(file, target);
      if (resolved === null) continue;
      checked += 1;
      if (!existsSync(resolved)) {
        failures.push({ file, line: index + 1, target });
      }
    }
  });
}

if (failures.length > 0) {
  console.error(`✗ ${failures.length} broken documentation link(s) in ${files.length} files:\n`);
  for (const failure of failures) {
    console.error(`  ${failure.file}:${failure.line}  ->  ${failure.target}`);
  }
  console.error("\nFix the path, or use an absolute URL if the target lives elsewhere.");
  process.exit(1);
}

console.log(`✓ ${checked} local link(s) across ${files.length} Markdown files all resolve.`);
