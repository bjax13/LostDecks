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
  buildMetaFromShare,
  renderShareMetaHtml,
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
  assert.equal(parseShareIdFromPath("/t/abc123"), "abc123");
  assert.equal(parseShareIdFromPath("/t/abc%20123"), "abc 123");
  assert.equal(parseShareIdFromPath("/collections"), "");
});

test("buildShareDescription summarizes ISO and UFT counts", () => {
  assert.equal(
    buildShareDescription({ iso: ["a"], uft: [] }),
    "ISO: 1 item — public trade list on ShardStash.",
  );
  assert.equal(
    buildShareDescription({ iso: ["a", "b"], uft: [{ skuId: "x", quantity: 2 }] }),
    "ISO: 2 items · UFT: 1 item — public trade list on ShardStash.",
  );
  assert.equal(buildShareDescription({ iso: [], uft: [] }), "Public trade list on ShardStash.");
});

test("buildShareTitle uses display name", () => {
  assert.equal(buildShareTitle({ displayName: "Bryan" }), "Bryan's trade list on ShardStash");
  assert.equal(buildShareTitle({}), "Trade list on ShardStash");
});

test("injectShareMeta replaces tags and escapes XSS in metadata", () => {
  const evil = `"><script>alert(1)</script>`;
  const html = injectShareMeta(SAMPLE_HTML, {
    title: evil,
    description: evil,
    url: `https://shardstash.web.app/t/${encodeURIComponent(evil)}`,
    image: evil,
  });

  assert.doesNotMatch(html, /<script>alert\(1\)<\/script>/);
  assert.match(html, /&lt;script&gt;alert\(1\)&lt;\/script&gt;/);
  assert.match(
    html,
    /<meta property="og:title" content="&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;">/,
  );
  assert.match(html, /<title>&quot;&gt;&lt;script&gt;alert\(1\)&lt;\/script&gt;<\/title>/);
});

test("renderShareMetaHtml falls back when share is missing", () => {
  const html = renderShareMetaHtml("gone-id", null);
  assert.match(html, /Trade list unavailable/);
  assert.match(html, /og:url" content="https:\/\/shardstash\.web\.app\/t\/gone-id"/);
});

test("renderShareMetaHtml injects share-specific meta", () => {
  const share = {
    displayName: "Alex",
    iso: ["LT24-ELS-01-DUN"],
    uft: [{ skuId: "LT24-LOP-02-FOIL", quantity: 2 }],
  };
  const meta = buildMetaFromShare(share, "share9");
  assert.equal(meta.title, "Alex's trade list on ShardStash");

  const html = renderShareMetaHtml("share9", share);
  assert.match(html, /Alex&#39;s trade list on ShardStash/);
  assert.match(html, /ISO: 1 item/);
});
