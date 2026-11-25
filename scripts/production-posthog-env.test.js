const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  assertBuiltBundleContainsPostHog,
  assertProductionPostHogConfig,
  parseEnvFile,
  resolveProductionPostHogConfig,
} = require("./production-posthog-env");

const SAMPLE_KEY = "phc_AbCdEfGhIjKlMnOpQrStUvWxYz";
const SAMPLE_SURVEY = "019abcde-1234-5678-9abc-def012345678";

function tempFrontend(files) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "posthog-env-"));
  for (const [name, contents] of Object.entries(files)) {
    fs.writeFileSync(path.join(dir, name), contents);
  }
  return dir;
}

test("parseEnvFile reads quoted values and skips comments", () => {
  const parsed = parseEnvFile(`
# comment
VITE_POSTHOG_KEY="${SAMPLE_KEY}"
export VITE_POSTHOG_SURVEY_ID='${SAMPLE_SURVEY}'
`);
  assert.equal(parsed.VITE_POSTHOG_KEY, SAMPLE_KEY);
  assert.equal(parsed.VITE_POSTHOG_SURVEY_ID, SAMPLE_SURVEY);
});

test("resolveProductionPostHogConfig reads frontend env files when the shell is empty", () => {
  const frontendDir = tempFrontend({
    ".env": `VITE_POSTHOG_KEY=${SAMPLE_KEY}\nVITE_POSTHOG_SURVEY_ID=${SAMPLE_SURVEY}\n`,
  });
  const config = resolveProductionPostHogConfig({ env: {}, frontendDir });
  assert.equal(config.key, SAMPLE_KEY);
  assert.equal(config.surveyId, SAMPLE_SURVEY);
  assert.equal(config.host, "https://us.i.posthog.com");
});

test("an empty shell variable wins over a populated env file, matching Vite", () => {
  const frontendDir = tempFrontend({
    ".env.production": `VITE_POSTHOG_KEY=${SAMPLE_KEY}\nVITE_POSTHOG_SURVEY_ID=${SAMPLE_SURVEY}\n`,
  });
  const config = resolveProductionPostHogConfig({
    env: { VITE_POSTHOG_KEY: "", VITE_POSTHOG_SURVEY_ID: SAMPLE_SURVEY },
    frontendDir,
  });
  assert.equal(config.key, "");
  assert.throws(() => assertProductionPostHogConfig(config), /VITE_POSTHOG_KEY/);
});

test("assertProductionPostHogConfig rejects a missing survey id", () => {
  assert.throws(
    () => assertProductionPostHogConfig({ key: SAMPLE_KEY, surveyId: "", host: "" }),
    /VITE_POSTHOG_SURVEY_ID/,
  );
});

test("assertProductionPostHogConfig rejects a key that is not phc_", () => {
  assert.throws(
    () => assertProductionPostHogConfig({ key: "not-a-key", surveyId: SAMPLE_SURVEY, host: "" }),
    /VITE_POSTHOG_KEY/,
  );
});

test("assertBuiltBundleContainsPostHog fails when dist omits the survey id", () => {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), "posthog-dist-"));
  fs.mkdirSync(path.join(distDir, "assets"));
  fs.writeFileSync(path.join(distDir, "assets", "index.js"), `posthog.init("${SAMPLE_KEY}",{})`);
  assert.throws(
    () => assertBuiltBundleContainsPostHog({ distDir, key: SAMPLE_KEY, surveyId: SAMPLE_SURVEY }),
    /VITE_POSTHOG_SURVEY_ID/,
  );
});

test("assertBuiltBundleContainsPostHog passes when key and survey id are in the bundle", () => {
  const distDir = fs.mkdtempSync(path.join(os.tmpdir(), "posthog-dist-"));
  fs.writeFileSync(path.join(distDir, "index.html"), `<script src="/assets/index.js"></script>`);
  fs.mkdirSync(path.join(distDir, "assets"));
  fs.writeFileSync(
    path.join(distDir, "assets", "index.js"),
    `posthog.init("${SAMPLE_KEY}");survey("${SAMPLE_SURVEY}")`,
  );
  assert.doesNotThrow(() =>
    assertBuiltBundleContainsPostHog({ distDir, key: SAMPLE_KEY, surveyId: SAMPLE_SURVEY }),
  );
});
