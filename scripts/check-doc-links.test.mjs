import assert from "node:assert/strict";
import { test } from "node:test";

import { headingAnchors, slugify } from "./check-doc-links.mjs";

// The rules here are GitHub's, not ours: if one of these changes, existing links in
// published documentation stop scrolling, so each case names the shape it protects.

test("lower-cases and hyphenates spaces", () => {
  assert.equal(slugify("Shape of the system"), "shape-of-the-system");
});

test("drops punctuation but keeps digits and words", () => {
  assert.equal(
    slugify("Phase 1 scope (this increment) — implemented"),
    "phase-1-scope-this-increment-implemented",
  );
  assert.equal(slugify("Audit trail: who, what, when."), "audit-trail-who-what-when");
  assert.equal(slugify("Don't panic"), "dont-panic");
});

test("keeps underscores and existing hyphens", () => {
  assert.equal(slugify("organisationId"), "organisationid");
  assert.equal(slugify("VETNEX_API_KEY"), "vetnex_api_key");
  assert.equal(slugify("end-to-end"), "end-to-end");
});

test("strips inline code and emphasis markers", () => {
  assert.equal(slugify("`foo` and bar"), "foo-and-bar");
  assert.equal(slugify("**Bold** and *italic*"), "bold-and-italic");
});

test("keeps link text and drops images", () => {
  assert.equal(slugify("See [TESTING.md](TESTING.md)"), "see-testingmd");
  assert.equal(slugify("![logo](logo.png) Title"), "title");
});

test("drops inline HTML tags", () => {
  assert.equal(slugify("Tenancy <em>model</em>"), "tenancy-model");
});

test("keeps letters outside ASCII and drops emoji", () => {
  assert.equal(slugify("Café résumé"), "café-résumé");
  assert.equal(slugify("Phase 0 — Discovery and architecture ✅"), "phase-0-discovery-and-architecture");
});

test("collapses runs of whitespace and trims", () => {
  assert.equal(slugify("  A   B  "), "a-b");
});

test("constructs nothing from punctuation-only text", () => {
  assert.equal(slugify("!!!"), "");
  assert.equal(slugify("—"), "");
});

test("numbers repeated headings like GitHub", () => {
  const anchors = headingAnchors("# Title\n\n## Repeated\n\n## Repeated\n\n## Repeated\n");
  assert.ok(anchors.has("repeated"));
  assert.ok(anchors.has("repeated-1"));
  assert.ok(anchors.has("repeated-2"));
  assert.ok(!anchors.has("repeated-3"));
});

test("numbers repeats across heading styles together", () => {
  const anchors = headingAnchors("## Same\n\nSame\n----\n");
  assert.ok(anchors.has("same"));
  assert.ok(anchors.has("same-1"));
});

test("reads ATX headings with closing hashes", () => {
  assert.ok(headingAnchors("## Contents ##\n").has("contents"));
  assert.ok(headingAnchors("### Deep section\n").has("deep-section"));
});

test("reads setext headings underlined with = and -", () => {
  const anchors = headingAnchors("Main Title\n==========\n\nSub Heading\n-----------\n");
  assert.ok(anchors.has("main-title"));
  assert.ok(anchors.has("sub-heading"));
});

test("does not read a rule after a blank line as a heading", () => {
  const anchors = headingAnchors("Some text\n\n---\n");
  assert.ok(!anchors.has("some-text"));
});

test("ignores headings inside fenced code blocks", () => {
  const anchors = headingAnchors("```md\n## Fake Heading\n```\n\n## Real Heading\n");
  assert.ok(!anchors.has("fake-heading"));
  assert.ok(anchors.has("real-heading"));
});

test("ignores setext underlines inside fenced code blocks", () => {
  const anchors = headingAnchors("```\nRaw\n===\n```\n");
  assert.equal(anchors.size, 0);
});

test("accepts explicit HTML anchors, including lower-cased ids", () => {
  const anchors = headingAnchors('<a id="Custom-Target"></a>\n<span name="legacy"></span>\n');
  assert.ok(anchors.has("Custom-Target"));
  assert.ok(anchors.has("custom-target"));
  assert.ok(anchors.has("legacy"));
});
