/**
 * Fail a production Hosting deploy before upload when PostHog is not configured.
 *
 * Default: resolve VITE_POSTHOG_KEY / VITE_POSTHOG_SURVEY_ID from the shell and
 * frontend env files (same precedence as Vite) and exit 1 if either is missing.
 * `--bundle` also requires those values to appear in frontend/dist.
 */

const path = require("node:path");
const { maskPostHogKey } = require("./check-production-posthog");
const {
  assertBuiltBundleContainsPostHog,
  assertProductionPostHogConfig,
  resolveProductionPostHogConfig,
} = require("./production-posthog-env");

const repoRoot = path.resolve(__dirname, "..");
const frontendDir = path.join(repoRoot, "frontend");
const checkBundle = process.argv.includes("--bundle");

try {
  const config = assertProductionPostHogConfig(
    resolveProductionPostHogConfig({ env: process.env, frontendDir }),
  );
  if (checkBundle) {
    assertBuiltBundleContainsPostHog({
      distDir: path.join(frontendDir, "dist"),
      key: config.key,
      surveyId: config.surveyId,
    });
    console.log(`PostHog present in frontend/dist (${maskPostHogKey(config.key)}; survey id set).`);
  } else {
    console.log(`PostHog required for this deploy (${maskPostHogKey(config.key)}; survey id set).`);
  }
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
