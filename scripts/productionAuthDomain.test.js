const test = require("node:test");
const assert = require("node:assert/strict");
const {
  DEFAULT_PUBLIC_AUTH_DOMAIN,
  hostFromPublicUrl,
  resolveProductionAuthDomain,
} = require("./productionAuthDomain");

test("hostFromPublicUrl reads the hostname", () => {
  assert.equal(hostFromPublicUrl("https://shardstash.web.app"), "shardstash.web.app");
  assert.equal(hostFromPublicUrl("https://shard-stash.web.app/"), "shard-stash.web.app");
  assert.equal(hostFromPublicUrl(""), "");
  assert.equal(hostFromPublicUrl("not a url"), "");
});

test("resolveProductionAuthDomain prefers FIREBASE_AUTH_DOMAIN override", () => {
  assert.equal(
    resolveProductionAuthDomain({
      publicHost: "shardstash.web.app",
      env: { FIREBASE_AUTH_DOMAIN: "custom.example" },
    }),
    "custom.example",
  );
});

test("resolveProductionAuthDomain uses the public Hosting host, not sdkconfig", () => {
  assert.equal(
    resolveProductionAuthDomain({
      publicHost: "shardstash.web.app",
      env: {},
    }),
    "shardstash.web.app",
  );
  assert.equal(resolveProductionAuthDomain({ env: {} }), DEFAULT_PUBLIC_AUTH_DOMAIN);
  assert.notEqual(resolveProductionAuthDomain({ env: {} }), "storydeck-16.firebaseapp.com");
});
