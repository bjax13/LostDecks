"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  escapeHtml,
  escapeHtmlAttr,
  injectShareMeta,
  parseShareIdFromPath,
  buildShareDescription,
  buildShareTitle,
  renderShareMetaHtml,
  isShareActive,
  __test,
} = require("./shareMeta");

const SAMPLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
  <title>ShardStash</title>
  <meta name="description" content="Track your Lost Tales Story Deck cards and ChasmFriends pins, and find collectors to trade with.">
  <meta property="og:title" content="ShardStash">
  <meta property="og:description" content="Track your Lost Tales Story Deck cards and ChasmFriends pins, and find collectors to trade with.">
  <meta property="og:url" content="https://shardstash.web.app/">
  <meta property="og:image" content="https://shardstash.web.app/og-image.png">
  <meta name="twitter:title" content="ShardStash">
  <meta name="twitter:description" content="Track your Lost Tales Story Deck cards and ChasmFriends pins, and find collectors to trade with.">
  <meta name="twitter:image" content="https://shardstash.web.app/og-image.png">
  <link rel="canonical" href="https://shardstash.web.app/">
</head>
<body><div id="root"></div></body>
</html>`;

const HOSTED_SHELL = `<!DOCTYPE html>
<html><head>
  <title>ShardStash</title>
  <meta name="description" content="x">
  <meta property="og:title" content="x">
  <meta property="og:description" content="x">
  <meta property="og:url" content="https://shardstash.web.app/">
  <meta property="og:image" content="https://shardstash.web.app/og-image.png">
  <meta name="twitter:title" content="x">
  <meta name="twitter:description" content="x">
  <meta name="twitter:image" content="https://shardstash.web.app/og-image.png">
  <link rel="canonical" href="https://shardstash.web.app/">
  <script type="module" crossorigin src="/assets/index-FRESH.js"></script>
</head><body></body></html>`;

test.beforeEach(() => {
  __test.setBaseHtmlForTests(SAMPLE_HTML);
});

test.after(() => {
  __test.resetBaseHtmlCache();
});

test("escapeHtml escapes script-breaking characters", () => {
  assert.equal(escapeHtml(`<script>"'&</script>`), "&lt;script&gt;&quot;&#39;&amp;&lt;/script&gt;");
  assert.equal(escapeHtmlAttr("a`b"), "a&#96;b");
});

test("parseShareIdFromPath extracts id from /t paths", () => {
  assert.deepEqual(parseShareIdFromPath("/t/abc12345"), { shareId: "abc12345", invalid: false });
  assert.deepEqual(parseShareIdFromPath("/t/abc%20123"), { shareId: "abc 123", invalid: true });
  assert.deepEqual(parseShareIdFromPath("/collections"), { shareId: "", invalid: false });
  assert.deepEqual(parseShareIdFromPath("/t/%E0%A4%A"), { shareId: "", invalid: true });
  assert.deepEqual(parseShareIdFromPath("/t/short"), { shareId: "short", invalid: true });
});

test("buildShareDescription summarizes ISO and UFT counts", () => {
  assert.equal(
    buildShareDescription({ iso: ["a"], uft: [] }),
    "ISO: 1 item — public trade list on ShardStash.",
  );
  assert.equal(buildShareDescription({ iso: [], uft: [] }), "Public trade list on ShardStash.");
});

test("buildShareTitle uses display name", () => {
  assert.equal(buildShareTitle({ displayName: "Bryan" }), "Bryan's trade list on ShardStash");
});

test("injectShareMeta replaces tags without interpreting $ in user data", () => {
  const dollarPayload = `Pat$' $& $1 $$`;
  const html = injectShareMeta(SAMPLE_HTML, {
    title: dollarPayload,
    description: dollarPayload,
    url: `https://shardstash.web.app/t/${encodeURIComponent("shareId12ab")}`,
    image: dollarPayload,
  });

  assert.match(
    html,
    new RegExp(`<title>${escapeHtml(dollarPayload).replaceAll("$", "\\$")}</title>`),
  );
  assert.doesNotMatch(html, /<title>Pat' /);
  assert.match(html, /Pat\$&#39; \$&amp; \$1 \$\$/);
});

test("injectShareMeta replaces tags and escapes XSS in metadata", () => {
  const evil = `"><script>alert(1)</script>`;
  const html = injectShareMeta(SAMPLE_HTML, {
    title: evil,
    description: evil,
    url: `https://shardstash.web.app/t/x`,
    image: evil,
  });

  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
});

test("isShareActive rejects revoked snapshots", () => {
  assert.equal(isShareActive({ displayName: "Pat", revokedAt: {} }), false);
  assert.equal(isShareActive({ displayName: "Pat" }), true);
});

test("renderShareMetaHtml falls back when share is missing", async () => {
  const html = await renderShareMetaHtml("gone-id12", null);
  assert.match(html, /Trade list unavailable/);
});

test("renderShareMetaHtml injects share-specific meta", async () => {
  const share = {
    displayName: "Alex",
    iso: ["LT24-ELS-01-DUN"],
    uft: [{ skuId: "LT24-LOP-02-FOIL", quantity: 2 }],
  };
  const html = await renderShareMetaHtml("shareId12ab", share);
  assert.match(html, /Alex&#39;s trade list on ShardStash/);
});

test("loadBaseHtmlAsync prefers freshly fetched hosted index.html", async () => {
  __test.resetBaseHtmlCache();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    assert.match(url, /index\.html$/);
    return { ok: true, text: async () => HOSTED_SHELL };
  };

  try {
    const html = await __test.loadBaseHtmlAsync();
    assert.match(html, /index-FRESH\.js/);
    const cached = await __test.loadBaseHtmlAsync();
    assert.equal(cached, html);
  } finally {
    globalThis.fetch = originalFetch;
    __test.setBaseHtmlForTests(SAMPLE_HTML);
  }
});
