#!/usr/bin/env node
/**
 * Lost Tales Marketplace verification harness.
 *
 *   node .cursor/skills/verify-lost-tales-marketplace/scripts/verify-lost-tales.mjs launch
 *   node .cursor/skills/verify-lost-tales-marketplace/scripts/verify-lost-tales.mjs doctor
 *   node .cursor/skills/verify-lost-tales-marketplace/scripts/verify-lost-tales.mjs drive goto --path /collectibles
 *   node .cursor/skills/verify-lost-tales-marketplace/scripts/verify-lost-tales.mjs cleanup
 */
import { execFileSync, spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));

function findRepoRoot(startDir) {
  let dir = startDir;
  while (true) {
    const pkgPath = path.join(dir, "package.json");
    if (fs.existsSync(pkgPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
        if (pkg.name === "lost-tales-marketplace-repo") {
          return dir;
        }
      } catch {
        // keep walking
      }
    }
    const parent = path.dirname(dir);
    if (parent === dir) {
      throw new Error("Could not find Lost Tales repo root");
    }
    dir = parent;
  }
}

const repoRoot = findRepoRoot(here);
const skillDir = path.resolve(here, "..");
const runDir = process.env.VERIFY_RUN_DIR || "/tmp/lost-tales-verify";
const statePath = path.join(runDir, "run.json");
const artifactsDir = process.env.VERIFY_ARTIFACTS_DIR || path.join(runDir, "artifacts");

const PORTS = {
  frontend: 5173,
  auth: 9099,
  firestore: 8080,
  functions: 5001,
  emulatorUi: 4000,
  driver: 17331,
};

const BASE_URL = `http://127.0.0.1:${PORTS.frontend}`;
const DRIVER_URL = `http://127.0.0.1:${PORTS.driver}`;

const VITE_ENV = {
  VITE_USE_EMULATORS: "true",
  VITE_FIREBASE_API_KEY: "verify-placeholder",
  VITE_FIREBASE_AUTH_DOMAIN: "localhost",
  VITE_FIREBASE_PROJECT_ID: "storydeck-16",
  VITE_FIREBASE_STORAGE_BUCKET: "storydeck-16.appspot.com",
  VITE_FIREBASE_MESSAGING_SENDER_ID: "0",
  VITE_FIREBASE_APP_ID: "1:0:web:verify",
  VITE_FIREBASE_MEASUREMENT_ID: "G-VERIFY",
  VITE_FIREBASE_AUTH_EMULATOR_URL: `http://127.0.0.1:${PORTS.auth}`,
  VITE_FIRESTORE_EMULATOR_HOST: "127.0.0.1",
  VITE_FIRESTORE_EMULATOR_PORT: String(PORTS.firestore),
  VITE_FUNCTIONS_EMULATOR_HOST: "127.0.0.1",
  VITE_FUNCTIONS_EMULATOR_PORT: String(PORTS.functions),
  VITE_POSTHOG_KEY: "",
};

const SEED_EMAIL = "collector.one@example.com";
const SEED_PASSWORD = "replace-me-local-only";

function usage() {
  return `Lost Tales Marketplace verification harness

Commands:
  launch     Start Firebase emulators, Vite, seed data, and the Playwright driver
  doctor     Read-only health check of the instance this run started
  seed       Re-run functions/seed-local.js --wipe against the emulators
  drive      Send one user-facing action to the Playwright driver
  cleanup    Stop processes this run started; keep ${artifactsDir}

Drive actions:
  goto --path /collectibles
  click --role link --name Collectibles [--scope nav] [--nth 0] [--exact]
  fill --label Search --value Elsecaller
  select --label Category --value "Story cards"
  press --key Escape
  expect --role heading --name Collectibles
  expect-url --path /collectibles
  count --role heading --name "Elsecaller #01"
  text [--role heading --name Collectibles]
  screenshot --path ${artifactsDir}/example.png [--full-page]
  snapshot --path ${artifactsDir}/example.aria.txt
  login --email ${SEED_EMAIL} --password ${SEED_PASSWORD}
  logout

Isolation:
  Emulator ports ${PORTS.auth}/${PORTS.firestore}/${PORTS.functions}/${PORTS.emulatorUi}
  and Vite ${PORTS.frontend} are shared defaults. Refuse to attach if they are
  already owned by a process this run did not start.
`;
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

function readState() {
  if (!fs.existsSync(statePath)) {
    return null;
  }
  return JSON.parse(fs.readFileSync(statePath, "utf8"));
}

function writeState(state) {
  ensureDir(runDir);
  fs.writeFileSync(statePath, `${JSON.stringify(state, null, 2)}\n`);
}

function pidAlive(pid) {
  if (!pid) {
    return false;
  }
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function listeningPid(port) {
  try {
    const out = execFileSync("ss", ["-ltnp", `sport = :${port}`], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    const match = out.match(/pid=(\d+)/);
    return match ? Number(match[1]) : null;
  } catch {
    try {
      const out = execFileSync("lsof", [`-iTCP:${port}`, "-sTCP:LISTEN", "-t"], {
        encoding: "utf8",
        stdio: ["ignore", "pipe", "ignore"],
      });
      const first = out.trim().split("\n")[0];
      return first ? Number(first) : null;
    } catch {
      return null;
    }
  }
}

function portOpen(port) {
  const pid = listeningPid(port);
  if (pid) {
    return true;
  }
  try {
    execFileSync("bash", ["-lc", `echo >/dev/tcp/127.0.0.1/${port}`], {
      stdio: "ignore",
      timeout: 1000,
    });
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForHttp(url, { timeoutMs = 60_000, okWhen } = {}) {
  const start = Date.now();
  let lastError = null;
  while (Date.now() - start < timeoutMs) {
    try {
      const result = await httpGet(url);
      if (!okWhen || okWhen(result)) {
        return result;
      }
      lastError = new Error(`Unexpected response from ${url}: ${result.status}`);
    } catch (error) {
      lastError = error;
    }
    await sleep(400);
  }
  throw new Error(`Timed out waiting for ${url}${lastError ? `: ${lastError.message}` : ""}`);
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    const req = http.get(url, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        resolve({
          status: res.statusCode || 0,
          body: Buffer.concat(chunks).toString("utf8"),
        });
      });
    });
    req.on("error", reject);
    req.setTimeout(3000, () => {
      req.destroy(new Error("timeout"));
    });
  });
}

function httpPostJson(url, body) {
  const payload = JSON.stringify(body);
  return new Promise((resolve, reject) => {
    const target = new URL(url);
    const req = http.request(
      {
        hostname: target.hostname,
        port: target.port,
        path: target.pathname,
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": Buffer.byteLength(payload),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const text = Buffer.concat(chunks).toString("utf8");
          let parsed = {};
          try {
            parsed = JSON.parse(text || "{}");
          } catch {
            parsed = { ok: false, error: text };
          }
          parsed.status = res.statusCode;
          resolve(parsed);
        });
      },
    );
    req.on("error", reject);
    req.setTimeout(30_000, () => {
      req.destroy(new Error("timeout"));
    });
    req.write(payload);
    req.end();
  });
}

function npmCmd() {
  return process.platform === "win32" ? "npm.cmd" : "npm";
}

function ensureNpmInstall(dir) {
  if (fs.existsSync(path.join(dir, "node_modules"))) {
    return;
  }
  const result = spawnSync(npmCmd(), ["install"], {
    cwd: dir,
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error(`npm install failed in ${dir}`);
  }
}

function ensurePlaywrightBrowser() {
  const result = spawnSync(npmCmd(), ["exec", "playwright", "install", "chromium"], {
    cwd: path.join(repoRoot, "frontend"),
    stdio: "inherit",
    env: process.env,
  });
  if (result.status !== 0) {
    throw new Error("playwright install chromium failed");
  }
}

function spawnLogged(command, args, logFile, extraEnv = {}) {
  ensureDir(path.dirname(logFile));
  const logFd = fs.openSync(logFile, "a");
  const child = spawn(command, args, {
    cwd: repoRoot,
    detached: true,
    stdio: ["ignore", logFd, logFd],
    env: { ...process.env, ...extraEnv },
  });
  child.unref();
  fs.closeSync(logFd);
  return child;
}

function assertPortsFreeOrOurs(state) {
  const owned = new Set([state?.emulatorPid, state?.frontendPid, state?.driverPid].filter(Boolean));
  for (const [name, port] of Object.entries(PORTS)) {
    if (name === "driver") {
      continue;
    }
    if (!portOpen(port)) {
      continue;
    }
    const pid = listeningPid(port);
    if (pid && owned.has(pid)) {
      continue;
    }
    if (
      state &&
      pidAlive(state.emulatorPid) &&
      (name === "auth" || name === "firestore" || name === "functions" || name === "emulatorUi")
    ) {
      continue;
    }
    if (state && pidAlive(state.frontendPid) && name === "frontend") {
      continue;
    }
    throw new Error(
      `Port ${port} (${name}) is already in use by pid ${pid ?? "unknown"}. ` +
        "This stack cannot share Firebase emulator or Vite ports with another session. " +
        "Stop that instance, or run cleanup if it is a leftover verification run.",
    );
  }
}

function printReport(report) {
  for (const [key, value] of Object.entries(report)) {
    process.stdout.write(`${key}=${value}\n`);
  }
}

async function cmdLaunch() {
  ensureDir(runDir);
  ensureDir(artifactsDir);
  const existing = readState();
  if (existing && pidAlive(existing.frontendPid) && pidAlive(existing.emulatorPid)) {
    await waitForHttp(BASE_URL, { timeoutMs: 10_000, okWhen: (r) => r.status === 200 });
    if (!pidAlive(existing.driverPid) || !portOpen(PORTS.driver)) {
      const driver = startDriver();
      existing.driverPid = driver.pid;
      existing.updatedAt = new Date().toISOString();
      writeState(existing);
    }
    await waitForHttp(`${DRIVER_URL}/health`, {
      timeoutMs: 20_000,
      okWhen: (r) => r.status === 200,
    });
    printReport({
      ok: true,
      reused: true,
      url: BASE_URL,
      artifacts: artifactsDir,
      state: statePath,
    });
    return;
  }

  assertPortsFreeOrOurs(existing);

  ensureNpmInstall(path.join(repoRoot, "frontend"));
  ensureNpmInstall(path.join(repoRoot, "functions"));
  ensurePlaywrightBrowser();

  const emulatorLog = path.join(runDir, "emulators.log");
  const frontendLog = path.join(runDir, "frontend.log");
  fs.writeFileSync(emulatorLog, "");
  fs.writeFileSync(frontendLog, "");

  const emulator = spawnLogged(
    "firebase",
    ["emulators:start", "--project", "storydeck-16"],
    emulatorLog,
  );

  const startedAt = new Date().toISOString();
  writeState({
    startedAt,
    emulatorPid: emulator.pid,
    frontendPid: null,
    driverPid: null,
    url: BASE_URL,
    artifactsDir,
    projectId: "storydeck-16",
    useEmulators: true,
  });

  await waitForHttp(`http://127.0.0.1:${PORTS.emulatorUi}`, { timeoutMs: 90_000 });
  await waitForHttp(`http://127.0.0.1:${PORTS.auth}`, { timeoutMs: 20_000 });

  runSeed();

  const frontend = spawnLogged(
    npmCmd(),
    [
      "run",
      "dev",
      "--prefix",
      "frontend",
      "--",
      "--host",
      "127.0.0.1",
      "--port",
      String(PORTS.frontend),
      "--strictPort",
    ],
    frontendLog,
    VITE_ENV,
  );

  const state = readState() || {};
  state.frontendPid = frontend.pid;
  writeState(state);

  await waitForHttp(BASE_URL, {
    timeoutMs: 60_000,
    okWhen: (r) => r.status === 200 && r.body.includes("Lost Tales Marketplace"),
  });

  const driver = startDriver();
  state.driverPid = driver.pid;
  state.updatedAt = new Date().toISOString();
  writeState(state);

  await waitForHttp(`${DRIVER_URL}/health`, {
    timeoutMs: 30_000,
    okWhen: (r) => r.status === 200,
  });

  printReport({
    ok: true,
    reused: false,
    url: BASE_URL,
    emulatorPid: emulator.pid,
    frontendPid: frontend.pid,
    driverPid: driver.pid,
    artifacts: artifactsDir,
    state: statePath,
    seedEmail: SEED_EMAIL,
  });
}

function startDriver() {
  const driverLog = path.join(runDir, "driver.log");
  fs.writeFileSync(driverLog, "");
  return spawnLogged(process.execPath, [path.join(here, "driver-server.mjs")], driverLog, {
    VERIFY_BASE_URL: BASE_URL,
    VERIFY_DRIVER_PORT: String(PORTS.driver),
  });
}

function runSeed() {
  const result = spawnSync(process.execPath, ["seed-local.js", "--wipe"], {
    cwd: path.join(repoRoot, "functions"),
    stdio: "inherit",
    env: {
      ...process.env,
      FIRESTORE_EMULATOR_HOST: `127.0.0.1:${PORTS.firestore}`,
      FIREBASE_AUTH_EMULATOR_HOST: `127.0.0.1:${PORTS.auth}`,
      GCLOUD_PROJECT: "storydeck-16",
      GOOGLE_CLOUD_PROJECT: "storydeck-16",
      FIREBASE_PROJECT_ID: "storydeck-16",
    },
  });
  if (result.status !== 0) {
    throw new Error("seed-local.js --wipe failed");
  }
}

async function cmdDoctor() {
  const state = readState();
  const problems = [];
  if (!state) {
    problems.push(`No run state at ${statePath}. Run launch first.`);
  }

  const emulatorAlive = Boolean(state && pidAlive(state.emulatorPid));
  const frontendAlive = Boolean(state && pidAlive(state.frontendPid));
  const driverAlive = Boolean(state && pidAlive(state.driverPid));

  if (state && !emulatorAlive) {
    problems.push(`Emulator pid ${state.emulatorPid} is not running`);
  }
  if (state && !frontendAlive) {
    problems.push(`Frontend pid ${state.frontendPid} is not running`);
  }
  if (state && !driverAlive) {
    problems.push(`Driver pid ${state.driverPid} is not running`);
  }

  let frontendStatus = 0;
  let frontendTitle = "";
  try {
    const page = await httpGet(BASE_URL);
    frontendStatus = page.status;
    frontendTitle = page.body.includes("Lost Tales Marketplace")
      ? "Lost Tales Marketplace"
      : "missing-title";
    if (page.status !== 200) {
      problems.push(`Frontend HTTP ${page.status} at ${BASE_URL}`);
    }
    if (!page.body.includes("Lost Tales Marketplace")) {
      problems.push("Frontend HTML does not include title Lost Tales Marketplace");
    }
  } catch (error) {
    problems.push(`Frontend not reachable at ${BASE_URL}: ${error.message}`);
  }

  let authStatus = 0;
  try {
    const auth = await httpGet(`http://127.0.0.1:${PORTS.auth}`);
    authStatus = auth.status;
  } catch (error) {
    problems.push(`Auth emulator not reachable: ${error.message}`);
  }

  let driverHealth = null;
  try {
    const health = await httpGet(`${DRIVER_URL}/health`);
    driverHealth = JSON.parse(health.body);
    if (!driverHealth.ok) {
      problems.push("Driver health returned not ok");
    }
  } catch (error) {
    problems.push(`Driver not reachable at ${DRIVER_URL}/health: ${error.message}`);
  }

  const report = {
    ok: problems.length === 0,
    url: BASE_URL,
    title: frontendTitle || (driverHealth?.title ?? ""),
    frontendStatus,
    authStatus,
    emulatorPid: state?.emulatorPid ?? "",
    frontendPid: state?.frontendPid ?? "",
    driverPid: state?.driverPid ?? "",
    emulatorAlive,
    frontendAlive,
    driverAlive,
    useEmulators: true,
    projectId: "storydeck-16",
    artifacts: artifactsDir,
    skill: skillDir,
    problems: problems.join(" | ") || "none",
  };
  printReport(report);
  if (problems.length > 0) {
    process.exitCode = 1;
  }
}

async function cmdSeed() {
  const state = readState();
  if (!state || !pidAlive(state.emulatorPid)) {
    throw new Error("Emulators are not running. Run launch first.");
  }
  runSeed();
  printReport({ ok: true, seeded: true, seedEmail: SEED_EMAIL });
}

function parseFlags(args) {
  const flags = {};
  for (let i = 0; i < args.length; i += 1) {
    const token = args[i];
    if (!token.startsWith("--")) {
      throw new Error(`Unexpected argument: ${token}`);
    }
    const key = token.slice(2);
    const camel = key.replace(/-([a-z])/g, (_, ch) => ch.toUpperCase());
    const next = args[i + 1];
    if (next == null || next.startsWith("--")) {
      flags[camel] = true;
      continue;
    }
    flags[camel] = next;
    i += 1;
  }
  return flags;
}

async function cmdDrive(argv) {
  const action = argv[0];
  if (!action || action === "--help" || action === "help") {
    process.stdout.write(usage());
    return;
  }
  const flags = parseFlags(argv.slice(1));
  const state = readState();
  if (!state || !pidAlive(state.frontendPid)) {
    throw new Error("No healthy launched instance. Run launch, then doctor.");
  }
  if (!pidAlive(state.driverPid) || !portOpen(PORTS.driver)) {
    const driver = startDriver();
    state.driverPid = driver.pid;
    writeState(state);
    await waitForHttp(`${DRIVER_URL}/health`, {
      timeoutMs: 20_000,
      okWhen: (r) => r.status === 200,
    });
  }

  const cmd = { action, ...flags };
  const result = await httpPostJson(`${DRIVER_URL}/command`, cmd);
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  if (!result.ok) {
    process.exitCode = 1;
  }
}

function stopPid(pid) {
  if (!pid || !pidAlive(pid)) {
    return;
  }
  try {
    process.kill(-pid, "SIGTERM");
  } catch {
    try {
      process.kill(pid, "SIGTERM");
    } catch {
      return;
    }
  }
}

function forcePid(pid) {
  if (!pid || !pidAlive(pid)) {
    return;
  }
  try {
    process.kill(-pid, "SIGKILL");
  } catch {
    try {
      process.kill(pid, "SIGKILL");
    } catch {
      // already gone
    }
  }
}

async function cmdCleanup() {
  const state = readState();
  if (!state) {
    printReport({ ok: true, cleaned: false, reason: "no-run-state", artifacts: artifactsDir });
    return;
  }
  const pids = [state.driverPid, state.frontendPid, state.emulatorPid];
  for (const pid of pids) {
    stopPid(pid);
  }
  const deadline = Date.now() + 5000;
  while (Date.now() < deadline && pids.some((pid) => pidAlive(pid))) {
    await sleep(200);
  }
  for (const pid of pids) {
    forcePid(pid);
  }
  if (fs.existsSync(statePath)) {
    fs.unlinkSync(statePath);
  }
  printReport({
    ok: true,
    cleaned: true,
    artifacts: artifactsDir,
    artifactsExist: fs.existsSync(artifactsDir),
  });
}

const command = process.argv[2];
const rest = process.argv.slice(3);

try {
  if (command === "launch") {
    await cmdLaunch();
  } else if (command === "doctor") {
    await cmdDoctor();
  } else if (command === "seed") {
    await cmdSeed();
  } else if (command === "drive") {
    await cmdDrive(rest);
  } else if (command === "cleanup") {
    await cmdCleanup();
  } else {
    process.stdout.write(usage());
    if (command && command !== "--help" && command !== "help") {
      process.exitCode = 1;
    }
  }
} catch (error) {
  process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
  process.exitCode = 1;
}
