const test = require("node:test");
const assert = require("node:assert/strict");
const {
  SITE_CANDIDATES,
  authorizedDomainConsoleFallback,
  authorizedDomainsForSite,
  extractSiteIds,
  isCreateConflict,
  mergeAuthorizedDomains,
  pickExistingSite,
  publicUrlForSite,
} = require("./prepare-hosting-deploy");

test("publicUrlForSite uses the web.app host", () => {
  assert.equal(publicUrlForSite("shardstash"), "https://shardstash.web.app");
});

test("authorizedDomainsForSite includes web.app and firebaseapp.com", () => {
  assert.deepEqual(authorizedDomainsForSite("shardstash"), [
    "shardstash.web.app",
    "shardstash.firebaseapp.com",
  ]);
});

test("extractSiteIds reads CLI result arrays and resource names", () => {
  assert.deepEqual(
    extractSiteIds({
      result: [{ name: "projects/storydeck-16/sites/storydeck-16" }, { siteId: "shardstash" }],
    }),
    ["storydeck-16", "shardstash"],
  );
  assert.deepEqual(extractSiteIds({ sites: ["shard-stash"] }), ["shard-stash"]);
});

test("pickExistingSite prefers shardstash over fallbacks", () => {
  assert.equal(
    pickExistingSite(["storydeck-16", "shardstash-app", "shardstash"], SITE_CANDIDATES),
    "shardstash",
  );
  assert.equal(pickExistingSite(["storydeck-16", "shard-stash"], SITE_CANDIDATES), "shard-stash");
  assert.equal(pickExistingSite(["storydeck-16"], SITE_CANDIDATES), null);
});

test("mergeAuthorizedDomains keeps existing entries and reports additions", () => {
  const merged = mergeAuthorizedDomains(
    ["localhost", "storydeck-16.web.app"],
    ["shardstash.web.app", "localhost"],
  );
  assert.deepEqual(merged.domains, ["localhost", "storydeck-16.web.app", "shardstash.web.app"]);
  assert.deepEqual(merged.added, ["shardstash.web.app"]);
});

test("isCreateConflict detects already-exists and globally taken site ids", () => {
  assert.equal(isCreateConflict(1, "", "HTTP Error: 409, site id is taken"), true);
  assert.equal(isCreateConflict(1, '{"error":"already exists"}', ""), true);
  assert.equal(isCreateConflict(1, "", "permission denied"), false);
  assert.equal(isCreateConflict(0, "", "HTTP Error: 409"), false);
});

test("authorizedDomainConsoleFallback includes the console click-path", () => {
  const text = authorizedDomainConsoleFallback("storydeck-16", [
    "shardstash.web.app",
    "shardstash.firebaseapp.com",
  ]);
  assert.match(
    text,
    /https:\/\/console\.firebase\.google\.com\/project\/storydeck-16\/authentication\/settings/,
  );
  assert.match(text, /Enter shardstash\.web\.app and save/);
  assert.match(text, /Enter shardstash\.firebaseapp\.com and save/);
});
