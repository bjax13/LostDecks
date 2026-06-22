const { spawn, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const path = require("node:path");

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

const emulatorsOnly = process.argv.includes("--emulators-only");
const frontendOnly = process.argv.includes("--frontend-only");

const children = [];
let frontendChild = null;

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

if (frontendOnly) {
  console.log("Starting frontend only...");
  const child = startFrontend();
  children.push(child);
} else if (emulatorsOnly) {
  console.log("Starting emulators only...");
  const child = startEmulators();
  children.push(child);
} else {
  console.log(`Starting Firebase emulators for project ${projectId}...`);
  const emulatorChild = startEmulators({ pipeOutput: true });
  children.push(emulatorChild);

  emulatorChild.stdout?.on?.("data", (chunk) => {
    const text = chunk.toString();
    if (!frontendChild && text.includes("All emulators ready")) {
      console.log("Starting frontend dev server...");
      frontendChild = startFrontend();
      children.push(frontendChild);
    }
  });

  emulatorChild.on("exit", (code) => {
    if (!frontendChild) {
      process.exit(code ?? 1);
    }
  });
}
