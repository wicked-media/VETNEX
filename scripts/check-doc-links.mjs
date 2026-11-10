#!/usr/bin/env node
/**
 * Fails when a tracked Markdown file links to a repository file that does not exist, or
 * to a heading that the target document does not contain.
 *
 * Only local links are checked. Accepts:
 *   - inline links and images: [text](path), ![alt](path)
 *   - reference definitions: [label]: path
 *   - anchors, both same-document [text](#heading) and [text](other.md#heading)
 * and skips anything that is not a file in this repository: absolute URLs, mailto:,
 * tel:, protocol-relative links and root-absolute site paths.
 *
 * Heading anchors are matched the way GitHub builds them: lower-cased, punctuation
 * dropped, spaces replaced with hyphens, and a suffix (-1, -2, ...) for repeated
 * headings. Both ATX (`## Heading`) and setext (`Heading` underlined with === or ---)
 * headings count, as do explicit HTML targets (<a id="...">, <a name="...">), while
 * headings inside fenced code blocks do not. Anchors on external URLs are not checked,
 * because the target document is never fetched.
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
const ATX_HEADING = /^ {0,3}#{1,6}[ \t]+(.*?)[ \t]*#*[ \t]*$/;
const SETEXT_UNDERLINE = /^ {0,3}(?:=+|-+)[ \t]*$/;
const HTML_ANCHOR = /\b(?:id|name)\s*=\s*["']([^"']+)["']/gi;
const FENCE = /^\s{0,3}(`{3,}|~{3,})/;

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

function decode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    // A malformed escape cannot name a real file or heading; compare it as written.
    return value;
  }
}

/** The anchor GitHub generates for a heading, before duplicate suffixes. */
function slugify(heading) {
  return heading
    .replace(/<[^>]*>/g, "") // inline HTML
    .replace(/!\[[^\]]*\]\([^)]*\)/g, "") // images contribute nothing
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1") // links keep their text
    .replace(/[`*~]/g, "") // emphasis and code markers
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s_-]/gu, "") // GitHub keeps letters, digits, spaces, - and _
    .trim()
    .replace(/\s+/g, "-");
}

const anchorCache = new Map();

/** Every anchor a reader can jump to in this document. */
function anchorsIn(file) {
  const cached = anchorCache.get(file);
  if (cached) return cached;

  const anchors = new Set();
  const seen = new Map();
  const lines = readFileSync(path.join(root, file), "utf8").split(/\r?\n/);
  let fence = null;

  function addHeading(text) {
    const slug = slugify(text);
    if (!slug) return;
    // GitHub disambiguates repeated headings with -1, -2, and so on.
    const count = seen.get(slug) ?? 0;
    anchors.add(count === 0 ? slug : `${slug}-${count}`);
    seen.set(slug, count + 1);
  }

  lines.forEach((line, index) => {
    const fenceMatch = FENCE.exec(line);
    if (fenceMatch?.[1]) {
      const marker = fenceMatch[1][0] ?? "`";
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      return;
    }
    if (fence !== null) return;

    const heading = ATX_HEADING.exec(line);
    if (heading?.[1]) {
      addHeading(heading[1]);
      return;
    }

    // Setext headings: this line underlines the text above it. A blank line above
    // breaks the pair, and an ATX heading above makes this a horizontal rule instead.
    if (SETEXT_UNDERLINE.test(line)) {
      const previous = lines[index - 1] ?? "";
      if (
        previous.trim() !== "" &&
        !ATX_HEADING.test(previous) &&
        !SETEXT_UNDERLINE.test(previous)
      ) {
        addHeading(previous);
      }
      return;
    }

    for (const match of line.matchAll(HTML_ANCHOR)) {
      if (!match[1]) continue;
      anchors.add(match[1]);
      anchors.add(match[1].toLowerCase());
    }
  });

  anchorCache.set(file, anchors);
  return anchors;
}

const failures = [];
let links = 0;
let anchorsChecked = 0;

for (const file of files) {
  const lines = readFileSync(path.join(root, file), "utf8").split(/\r?\n/);
  let fence = null;
  lines.forEach((line, index) => {
    // Fenced code blocks can contain anything, including link-like text.
    const fenceMatch = FENCE.exec(line);
    if (fenceMatch?.[1]) {
      const marker = fenceMatch[1][0] ?? "`";
      if (fence === null) fence = marker;
      else if (fence === marker) fence = null;
      return;
    }
    if (fence !== null) return;

    for (const target of targetsIn(line)) {
      const hash = target.indexOf("#");
      const rawPath = (hash === -1 ? target : target.slice(0, hash)).split("?")[0] ?? "";
      const rawAnchor = hash === -1 ? "" : target.slice(hash + 1);

      // A link to another site is not a link to this repository, and fetching it to
      // look up a heading would make CI slow and flaky.
      if (EXTERNAL.test(rawPath)) continue;

      const targetFile = rawPath ? path.relative(root, resolveTarget(file, rawPath)) : file;
      links += rawPath ? 1 : 0;

      if (rawPath && !existsSync(path.join(root, targetFile))) {
        failures.push({ file, line: index + 1, target, reason: "no such file" });
        continue;
      }

      if (!rawAnchor) continue;
      anchorsChecked += 1;
      const wanted = decode(rawAnchor).toLowerCase();
      const available = anchorsIn(targetFile);
      if (!available.has(wanted) && !available.has(decode(rawAnchor))) {
        failures.push({
          file,
          line: index + 1,
          target,
          reason: targetFile === file ? "no such heading here" : `no such heading in ${targetFile}`,
        });
      }
    }
  });
}

function resolveTarget(fromFile, rawTarget) {
  return path.resolve(path.dirname(path.join(root, fromFile)), decode(rawTarget));
}

if (failures.length > 0) {
  const word = failures.length === 1 ? "link or anchor" : "links or anchors";
  console.error(`✗ ${failures.length} broken documentation ${word} in ${files.length} files:\n`);
  for (const failure of failures) {
    console.error(`  ${failure.file}:${failure.line}  ->  ${failure.target}  (${failure.reason})`);
  }
  console.error("\nFix the path or heading, or use an absolute URL if the target lives elsewhere.");
  process.exit(1);
}

const anchorNote = anchorsChecked > 0 ? ` and ${anchorsChecked} heading anchor(s)` : "";
console.log(
  `✓ ${links} local link(s)${anchorNote} across ${files.length} Markdown files all resolve.`,
);
