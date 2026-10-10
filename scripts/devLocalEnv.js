const fs = require("node:fs");
const path = require("node:path");

/** All seven SDK keys must be non-empty strings (including MEASUREMENT_ID). */
const REQUIRED_FIREBASE_KEYS = [
  "VITE_FIREBASE_API_KEY",
  "VITE_FIREBASE_AUTH_DOMAIN",
  "VITE_FIREBASE_PROJECT_ID",
  "VITE_FIREBASE_STORAGE_BUCKET",
  "VITE_FIREBASE_MESSAGING_SENDER_ID",
  "VITE_FIREBASE_APP_ID",
  "VITE_FIREBASE_MEASUREMENT_ID",
];

const EMULATOR_FLAG = "VITE_USE_EMULATORS";

/**
 * Parse a dotenv-style file into a flat string map.
 * Comments and blank lines are ignored; unquoted values are trimmed.
 */
function parseEnvFile(contents) {
  const env = {};
  for (const line of String(contents).split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      continue;
    }
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

/**
 * @returns {{ ok: boolean, missingKeys: string[], useEmulators: boolean, emptyKeys: string[] }}
 */
function validateEmulatorEnv(env) {
  const missingKeys = [];
  const emptyKeys = [];
  for (const key of REQUIRED_FIREBASE_KEYS) {
    if (!(key in env)) {
      missingKeys.push(key);
    } else if (typeof env[key] !== "string" || env[key].trim().length === 0) {
      emptyKeys.push(key);
    }
  }
  const flag = String(env[EMULATOR_FLAG] ?? "").toLowerCase();
  const useEmulators = flag === "true";
  if (!useEmulators) {
    missingKeys.push(`${EMULATOR_FLAG}=true`);
  }
  return {
    ok: missingKeys.length === 0 && emptyKeys.length === 0,
    missingKeys,
    emptyKeys,
    useEmulators,
  };
}

function nodeModulesReady(packageDir) {
  return fs.existsSync(path.join(packageDir, "node_modules"));
}

function packagesNeedingInstall(repoRoot, packageDirs = [".", "frontend", "functions"]) {
  return packageDirs.filter((rel) => !nodeModulesReady(path.join(repoRoot, rel)));
}

function frontendEnvPaths(repoRoot) {
  const frontendDir = path.join(repoRoot, "frontend");
  return {
    frontendDir,
    envPath: path.join(frontendDir, ".env"),
    examplePath: path.join(frontendDir, ".env.emulator.example"),
  };
}

/**
 * Ensure frontend/.env exists and is complete for emulator auth.
 * Missing file → copy example. Incomplete file → merge missing/empty required keys from example.
 * @returns {{ action: 'ok'|'created'|'repaired', envPath: string, validation: ReturnType<typeof validateEmulatorEnv> }}
 */
function ensureFrontendEmulatorEnv(
  repoRoot,
  {
    readFileSync = fs.readFileSync,
    writeFileSync = fs.writeFileSync,
    existsSync = fs.existsSync,
  } = {},
) {
  const { envPath, examplePath } = frontendEnvPaths(repoRoot);
  if (!existsSync(examplePath)) {
    throw new Error(`Missing ${examplePath}. Cannot bootstrap frontend/.env for emulators.`);
  }

  const exampleContents = readFileSync(examplePath, "utf8");
  const exampleEnv = parseEnvFile(exampleContents);

  if (!existsSync(envPath)) {
    writeFileSync(envPath, exampleContents, "utf8");
    return {
      action: "created",
      envPath,
      validation: validateEmulatorEnv(parseEnvFile(exampleContents)),
    };
  }

  const existingContents = readFileSync(envPath, "utf8");
  const existingEnv = parseEnvFile(existingContents);
  const validation = validateEmulatorEnv(existingEnv);
  if (validation.ok) {
    return { action: "ok", envPath, validation };
  }

  const repaired = { ...existingEnv };
  for (const key of REQUIRED_FIREBASE_KEYS) {
    if (!repaired[key] || String(repaired[key]).trim().length === 0) {
      repaired[key] = exampleEnv[key] || `demo-${key.toLowerCase()}`;
    }
  }
  if (String(repaired[EMULATOR_FLAG] || "").toLowerCase() !== "true") {
    repaired[EMULATOR_FLAG] = "true";
  }

  const lines = existingContents.split(/\r?\n/);
  const keysWritten = new Set();
  const nextLines = lines.map((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) {
      return line;
    }
    const eq = trimmed.indexOf("=");
    if (eq <= 0) {
      return line;
    }
    const key = trimmed.slice(0, eq).trim();
    if (REQUIRED_FIREBASE_KEYS.includes(key) || key === EMULATOR_FLAG) {
      keysWritten.add(key);
      return `${key}=${repaired[key]}`;
    }
    return line;
  });

  for (const key of [...REQUIRED_FIREBASE_KEYS, EMULATOR_FLAG]) {
    if (!keysWritten.has(key)) {
      nextLines.push(`${key}=${repaired[key]}`);
    }
  }

  const nextContents = `${nextLines.join("\n").replace(/\n*$/, "\n")}`;
  writeFileSync(envPath, nextContents, "utf8");
  return {
    action: "repaired",
    envPath,
    validation: validateEmulatorEnv(parseEnvFile(nextContents)),
  };
}

function formatStartupBanner({
  repoRoot,
  projectId,
  viteUrl = "http://localhost:5173/",
  emulatorUiUrl = "http://127.0.0.1:4000/",
}) {
  return [
    "",
    "── Local emulator + Vite ──────────────────────────────",
    `Worktree / repo root: ${repoRoot}`,
    `Firebase project:     ${projectId}`,
    `App (Vite):           ${viteUrl}`,
    `Emulator UI:          ${emulatorUiUrl}`,
    "",
    "Seed Matches users (emulators must be up):",
    "  npm run seed:local:wipe",
    "  Credentials: functions/seed.local.json (or seed.local.example.json)",
    "  Example: collector.one@example.com / replace-me-local-only",
    "",
    "Cooldown smoke: sign in, open /matches, then refresh Matches —",
    "  not the login page. Expect a friendly rate-limit message if <3s.",
    "───────────────────────────────────────────────────────",
    "",
  ].join("\n");
}

module.exports = {
  REQUIRED_FIREBASE_KEYS,
  EMULATOR_FLAG,
  parseEnvFile,
  validateEmulatorEnv,
  nodeModulesReady,
  packagesNeedingInstall,
  frontendEnvPaths,
  ensureFrontendEmulatorEnv,
  formatStartupBanner,
};
