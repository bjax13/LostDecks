const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertPostHogKeyInAssets,
  findPostHogProjectKey,
  maskPostHogKey,
  parseModuleScriptSrcs,
  resolveOrigins,
} = require("./check-production-posthog");

const SAMPLE_KEY = "phc_AbCdEfGhIjKlMnOpQrStUvWxYz";

test("findPostHogProjectKey detects a baked phc_ key", () => {
  const bundle = `posthog.init("${SAMPLE_KEY}",{api_host:"https://us.i.posthog.com"});`;
  assert.equal(findPostHogProjectKey(bundle), SAMPLE_KEY);
});

test("findPostHogProjectKey returns null when key is missing", () => {
  assert.equal(findPostHogProjectKey('const key = "";'), null);
  assert.equal(findPostHogProjectKey("posthog disabled"), null);
});

test("maskPostHogKey does not echo the full project key", () => {
  const masked = maskPostHogKey(SAMPLE_KEY);
  assert.match(masked, /^phc_AbCd/);
  assert.doesNotMatch(masked, /QrStUvWxYz/);
});

test("parseModuleScriptSrcs resolves root-relative module URLs", () => {
  const html = `<script type="module" crossorigin src="/assets/index-abc123.js"></script>`;
  assert.deepEqual(parseModuleScriptSrcs(html, "https://shardstash.web.app"), [
    "https://shardstash.web.app/assets/index-abc123.js",
  ]);
});

test("assertPostHogKeyInAssets passes when the module bundle contains phc_", () => {
  const html = `<script type="module" src="/assets/index.js"></script>`;
  const scriptsByUrl = {
    "https://shardstash.web.app/assets/index.js": `init("${SAMPLE_KEY}")`,
  };
  const result = assertPostHogKeyInAssets({
    html,
    scriptsByUrl,
    origin: "https://shardstash.web.app",
  });
  assert.equal(result.key, SAMPLE_KEY);
});

test("assertPostHogKeyInAssets fails with an actionable error when phc_ is absent", () => {
  const html = `<script type="module" src="/assets/index.js"></script>`;
  const scriptsByUrl = {
    "https://shardstash.web.app/assets/index.js": "const key = undefined;",
  };
  assert.throws(
    () =>
      assertPostHogKeyInAssets({
        html,
        scriptsByUrl,
        origin: "https://shardstash.web.app",
      }),
    (err) => {
      assert.match(err.message, /phc_…/);
      assert.match(err.message, /VITE_POSTHOG_KEY/);
      return true;
    },
  );
});

test("resolveOrigins defaults to shardstash production Hosting", () => {
  const saved = process.env.POSTHOG_CHECK_ORIGINS;
  delete process.env.POSTHOG_CHECK_ORIGINS;
  try {
    assert.deepEqual(resolveOrigins(), ["https://shardstash.web.app"]);
  } finally {
    if (saved === undefined) {
      delete process.env.POSTHOG_CHECK_ORIGINS;
    } else {
      process.env.POSTHOG_CHECK_ORIGINS = saved;
    }
  }
});
