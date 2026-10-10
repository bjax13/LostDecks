const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");
const {
  ensureFrontendEmulatorEnv,
  formatStartupBanner,
  packagesNeedingInstall,
} = require("./devLocalEnv");

const repoRoot = path.resolve(__dirname, "..");
const projectId = process.env.FIREBASE_PROJECT_ID || "storydeck-16";

const isWindows = process.platform === "win32";
const javaExecutable = isWindows ? "java.exe" : "java";
const bundledJavaCandidates = isWindows
  ? [
      "C:\\Program Files\\Eclipse Adoptium\\jdk-21.0.11.10-hotspot",
      "C:\\Program Files\\Eclipse Adoptium\\jdk-21",
      "C:\\Program Files\\Java\\jdk-21",
      "C:\\Program Files\\Java\\jdk-17",
    ]
  : [];

function hasJavaInPath(env) {
  const check = spawnSync(javaExecutable, ["-version"], {
    env,
    stdio: "ignore",
  });
  return check.status === 0;
}

function resolveJavaHome() {
  if (process.env.JAVA_HOME && hasJavaInPath(process.env)) {
    return process.env.JAVA_HOME;
  }

  for (const candidate of bundledJavaCandidates) {
    const candidateExe = path.join(candidate, "bin", javaExecutable);
    if (fs.existsSync(candidateExe)) {
      return candidate;
    }
  }

  return null;
}

function withJavaEnv(baseEnv) {
  const nextEnv = { ...baseEnv };
  if (hasJavaInPath(nextEnv)) {
    return nextEnv;
  }

  const javaHome = resolveJavaHome();
  if (!javaHome) {
    return nextEnv;
  }

  const delimiter = isWindows ? ";" : ":";
  nextEnv.JAVA_HOME = javaHome;
  nextEnv.PATH = `${path.join(javaHome, "bin")}${delimiter}${nextEnv.PATH || ""}`;
  return nextEnv;
}

function spawnCommand(command, args, options = {}) {
  const { pipeOutput = false, ...restOptions } = options;

  const child = spawn(command, args, {
    cwd: repoRoot,
    stdio: pipeOutput ? ["inherit", "pipe", "pipe"] : "inherit",
    shell: false,
    ...restOptions,
  });

  if (pipeOutput) {
    child.stdout?.on("data", (chunk) => process.stdout.write(chunk));
    child.stderr?.on("data", (chunk) => process.stderr.write(chunk));
  }

  return child;
}

function runNpmInstall(packageRel) {
  const npmCmd = isWindows ? "npm.cmd" : "npm";
  const cwd = path.join(repoRoot, packageRel);
  console.log(`Installing dependencies in ${packageRel === "." ? "repo root" : packageRel}...`);
  const result = spawnSync(npmCmd, ["install"], {
    cwd,
    env: process.env,
    stdio: "inherit",
    shell: false,
  });
  if (result.status !== 0) {
    console.error(`npm install failed in ${cwd} (exit ${result.status ?? 1}).`);
    process.exit(result.status ?? 1);
  }
}

function ensureDependencies() {
  const missing = packagesNeedingInstall(repoRoot);
  if (missing.length === 0) {
    return;
  }
  console.log(`Fresh worktree detected — missing node_modules in: ${missing.join(", ")}`);
  for (const rel of missing) {
    runNpmInstall(rel);
  }
}

function ensureEnv() {
  const result = ensureFrontendEmulatorEnv(repoRoot);
  if (result.action === "created") {
    console.log(`Created ${path.relative(repoRoot, result.envPath)} from .env.emulator.example`);
  } else if (result.action === "repaired") {
    console.log(
      `Repaired ${path.relative(repoRoot, result.envPath)} — filled missing/empty VITE_FIREBASE_* (and set VITE_USE_EMULATORS=true).`,
    );
    console.log("Vite only reads .env at process start; this run starts Vite after the repair.");
  }
  if (!result.validation.ok) {
    console.error(
      [
        "frontend/.env is still incomplete for emulator auth.",
        "Copy the FULL frontend/.env.emulator.example → frontend/.env",
        "(all seven VITE_FIREBASE_* placeholders must be non-empty, including MEASUREMENT_ID,",
        "plus VITE_USE_EMULATORS=true), then restart Vite.",
        `Missing: ${result.validation.missingKeys.join(", ") || "(none)"}`,
        `Empty: ${result.validation.emptyKeys.join(", ") || "(none)"}`,
      ].join("\n"),
    );
    process.exit(1);
  }
}

function startEmulators(options = {}) {
  const env = withJavaEnv(process.env);
  if (!hasJavaInPath(env)) {
    console.error(
      "Java was not found. Install Java 17+ or set JAVA_HOME before running dev:local.",
    );
    process.exit(1);
  }

  const npxCmd = isWindows ? "npx.cmd" : "npx";
  return spawnCommand(npxCmd, ["firebase-tools", "emulators:start", "--project", projectId], {
    env,
    ...options,
  });
}

function startFrontend() {
  const npmCmd = isWindows ? "npm.cmd" : "npm";
  return spawnCommand(npmCmd, ["run", "dev", "--prefix", "frontend", "--", "--host", "0.0.0.0"]);
}

function printBanner() {
  process.stdout.write(
    formatStartupBanner({
      repoRoot,
      projectId,
    }),
  );
}

const emulatorsOnly = process.argv.includes("--emulators-only");
const frontendOnly = process.argv.includes("--frontend-only");
const skipInstall = process.argv.includes("--skip-install");

const children = [];
let frontendChild = null;
let bannerPrinted = false;

function stopAllChildren() {
  for (const child of children) {
    if (child && !child.killed) {
      child.kill("SIGINT");
    }
  }
}

process.on("SIGINT", () => {
  stopAllChildren();
  process.exit(0);
});

process.on("SIGTERM", () => {
  stopAllChildren();
  process.exit(0);
});

printBanner();
if (!skipInstall) {
  ensureDependencies();
}
ensureEnv();

if (frontendOnly) {
  console.log("Starting frontend only (emulators must already be running)...");
  const child = startFrontend();
  children.push(child);
} else if (emulatorsOnly) {
  console.log("Starting emulators only...");
  console.log('Wait for the "All emulators ready" banner before seeding or opening the app.');
  const child = startEmulators();
  children.push(child);
} else {
  console.log(`Starting Firebase emulators for project ${projectId}...`);
  console.log('Vite starts automatically after "All emulators ready" (~10–15s).');
  const emulatorChild = startEmulators({ pipeOutput: true });
  children.push(emulatorChild);

  const onChunk = (chunk) => {
    const text = chunk.toString();
    if (!frontendChild && text.includes("All emulators ready")) {
      if (!bannerPrinted) {
        bannerPrinted = true;
        console.log("Emulators ready. Starting frontend (http://localhost:5173/)...");
        console.log(
          "Seed when ready: npm run seed:local:wipe  (see banner above for credentials).",
        );
      }
      frontendChild = startFrontend();
      children.push(frontendChild);
    }
  };

  emulatorChild.stdout?.on?.("data", onChunk);
  // firebase-tools may print the ready banner on stderr depending on version/TTY
  emulatorChild.stderr?.on?.("data", onChunk);

  emulatorChild.on("exit", (code) => {
    if (!frontendChild) {
      process.exit(code ?? 1);
    }
  });
}
