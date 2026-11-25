const fs = require("node:fs");
const path = require("node:path");

/** PostHog browser project API keys begin with phc_ */
const POSTHOG_KEY_PATTERN = /^phc_[A-Za-z0-9_-]{10,}$/;

const POSTHOG_ENV_FILES = [".env", ".env.local", ".env.production", ".env.production.local"];

const REQUIRED_MESSAGE =
  "Refusing to deploy Hosting without PostHog. " +
  "VITE_POSTHOG_KEY must be a phc_ project key and VITE_POSTHOG_SURVEY_ID must be set " +
  "in the shell or in frontend/.env, .env.local, .env.production, or .env.production.local. " +
  "GitHub Actions deploys read these from repository secrets. " +
  "A missing key ships a build where PostHog never starts and the feedback button stays hidden.";

function parseEnvFile(text) {
  const values = {};
  if (!text) {
    return values;
  }
  for (const line of text.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const exportStripped = trimmed.startsWith("export ")
      ? trimmed.slice("export ".length)
      : trimmed;
    const eq = exportStripped.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = exportStripped.slice(0, eq).trim();
    let value = exportStripped.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

function readEnvFiles(frontendDir) {
  const merged = {};
  for (const name of POSTHOG_ENV_FILES) {
    const filePath = path.join(frontendDir, name);
    if (!fs.existsSync(filePath)) {
      continue;
    }
    Object.assign(merged, parseEnvFile(fs.readFileSync(filePath, "utf8")));
  }
  return merged;
}

/**
 * Vite production builds let an already-set process env var win over .env files,
 * including an empty string. Mirror that so this check matches what the bundle will contain.
 */
function viteValue(name, fileEnv, processEnv) {
  if (Object.hasOwn(processEnv, name)) {
    return typeof processEnv[name] === "string" ? processEnv[name].trim() : "";
  }
  return typeof fileEnv[name] === "string" ? fileEnv[name].trim() : "";
}

function resolveProductionPostHogConfig({ env = process.env, frontendDir } = {}) {
  const fileEnv = readEnvFiles(frontendDir);
  const key = viteValue("VITE_POSTHOG_KEY", fileEnv, env);
  const surveyId = viteValue("VITE_POSTHOG_SURVEY_ID", fileEnv, env);
  const host = viteValue("VITE_POSTHOG_HOST", fileEnv, env) || "https://us.i.posthog.com";
  return { key, surveyId, host };
}

function assertProductionPostHogConfig(config) {
  const keyOk = POSTHOG_KEY_PATTERN.test(config?.key ?? "");
  const surveyOk = typeof config?.surveyId === "string" && config.surveyId.length > 0;
  if (!keyOk || !surveyOk) {
    const missing = [];
    if (!keyOk) {
      missing.push("VITE_POSTHOG_KEY");
    }
    if (!surveyOk) {
      missing.push("VITE_POSTHOG_SURVEY_ID");
    }
    throw new Error(`${REQUIRED_MESSAGE} Missing or invalid: ${missing.join(", ")}.`);
  }
  return config;
}

function listBundleFiles(distDir) {
  if (!fs.existsSync(distDir)) {
    return [];
  }
  const files = [];
  const walk = (dir) => {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walk(full);
      } else if (entry.name.endsWith(".js") || entry.name.endsWith(".html")) {
        files.push(full);
      }
    }
  };
  walk(distDir);
  return files;
}

function assertBuiltBundleContainsPostHog({ distDir, key, surveyId }) {
  const files = listBundleFiles(distDir);
  if (files.length === 0) {
    throw new Error(
      `Refusing to upload Hosting: ${distDir} has no built JS. Run the production frontend build first.`,
    );
  }
  let keyFound = false;
  let surveyFound = false;
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    if (!keyFound && text.includes(key)) {
      keyFound = true;
    }
    if (!surveyFound && text.includes(surveyId)) {
      surveyFound = true;
    }
    if (keyFound && surveyFound) {
      break;
    }
  }
  if (!keyFound || !surveyFound) {
    const missing = [];
    if (!keyFound) {
      missing.push("VITE_POSTHOG_KEY");
    }
    if (!surveyFound) {
      missing.push("VITE_POSTHOG_SURVEY_ID");
    }
    throw new Error(
      `Refusing to upload frontend/dist. The production bundle is missing ${missing.join(" and ")}. ` +
        "PostHog would not start and the feedback button would stay hidden.",
    );
  }
}

module.exports = {
  POSTHOG_ENV_FILES,
  POSTHOG_KEY_PATTERN,
  parseEnvFile,
  resolveProductionPostHogConfig,
  assertProductionPostHogConfig,
  assertBuiltBundleContainsPostHog,
};
