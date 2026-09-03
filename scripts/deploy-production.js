const { spawnSync } = require("node:child_process");
const path = require("node:path");

const repoRoot = path.resolve(__dirname, "..");
const isWindows = process.platform === "win32";
const npxCmd = isWindows ? "npx.cmd" : "npx";
const npmCmd = isWindows ? "npm.cmd" : "npm";

const projectId = process.env.FIREBASE_PROJECT_ID || "storydeck-16";
const requestedAppId = process.env.FIREBASE_WEB_APP_ID?.trim() || "";

function runCapture(command, args, options = {}) {
  // On Windows, `.cmd` shims need a shell or stdout from npx/firebase-tools can be empty.
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    shell: isWindows,
    ...options,
  });

  return {
    status: result.status ?? 1,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function runInherit(command, args, env) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env,
    stdio: "inherit",
    shell: isWindows,
  });

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

function parseJsonFromOutput(output, context) {
  const firstBrace = output.indexOf("{");
  const lastBrace = output.lastIndexOf("}");
  if (firstBrace < 0 || lastBrace < firstBrace) {
    throw new Error(`Could not parse JSON from ${context} output.`);
  }

  const rawJson = output.slice(firstBrace, lastBrace + 1);
  return JSON.parse(rawJson);
}

function getWebAppId() {
  if (requestedAppId) {
    return requestedAppId;
  }

  const result = runCapture(npxCmd, [
    "--yes",
    "firebase-tools@15",
    "apps:list",
    "WEB",
    "--project",
    projectId,
    "--json",
  ]);

  if (result.status !== 0) {
    process.stderr.write(result.stderr || result.stdout);
    throw new Error("Failed to list Firebase WEB apps.");
  }

  const payload = parseJsonFromOutput(result.stdout, "apps:list");
  const apps = Array.isArray(payload.result) ? payload.result : [];

  if (apps.length === 0) {
    throw new Error(`No Firebase WEB apps found in project ${projectId}.`);
  }

  if (apps.length > 1) {
    const appList = apps.map((app) => `${app.displayName} (${app.appId})`).join(", ");
    throw new Error(
      `Multiple Firebase WEB apps found: ${appList}. Set FIREBASE_WEB_APP_ID to choose one.`,
    );
  }

  return apps[0].appId;
}

function getSdkConfig(appId) {
  const result = runCapture(npxCmd, [
    "--yes",
    "firebase-tools@15",
    "apps:sdkconfig",
    "WEB",
    appId,
    "--project",
    projectId,
    "--json",
  ]);

  // firebase-tools can emit JSON and still exit non-zero on some Node versions.
  const payload = parseJsonFromOutput(result.stdout, "apps:sdkconfig");
  const sdkConfig = payload.result?.sdkConfig || payload.sdkConfig || payload;

  if (result.status !== 0) {
    console.warn("firebase-tools exited non-zero after returning SDK config; continuing.");
  }

  return sdkConfig;
}

function getDeployMode() {
  const onlyArg = process.argv.find((arg) => arg.startsWith("--only="));
  const only = onlyArg ? onlyArg.slice("--only=".length) : "hosting,firestore,functions";

  if (only !== "hosting" && only !== "hosting,firestore,functions") {
    throw new Error(`Unsupported --only value: ${only}`);
  }

  return only === "hosting" ? "deploy:hosting:raw" : "deploy:firebase:raw";
}

function main() {
  const deployScript = getDeployMode();
  const appId = getWebAppId();
  const sdk = getSdkConfig(appId);

  const required = {
    VITE_FIREBASE_API_KEY: sdk.apiKey,
    VITE_FIREBASE_AUTH_DOMAIN: sdk.authDomain,
    VITE_FIREBASE_PROJECT_ID: sdk.projectId,
    VITE_FIREBASE_STORAGE_BUCKET: sdk.storageBucket,
    VITE_FIREBASE_MESSAGING_SENDER_ID: sdk.messagingSenderId,
    VITE_FIREBASE_APP_ID: sdk.appId,
    VITE_FIREBASE_MEASUREMENT_ID: sdk.measurementId,
  };

  const missing = Object.entries(required)
    .filter(([, value]) => typeof value !== "string" || value.trim().length === 0)
    .map(([key]) => key);

  if (missing.length > 0) {
    throw new Error(`Firebase SDK config missing required fields: ${missing.join(", ")}`);
  }

  const deployEnv = {
    ...process.env,
    VITE_USE_EMULATORS: "false",
    ...required,
  };

  console.log(`Deploying project ${projectId} using Firebase WEB app ${appId}...`);
  runInherit(npmCmd, ["run", deployScript], deployEnv);
}

try {
  main();
} catch (error) {
  console.error(error.message);
  process.exit(1);
}
