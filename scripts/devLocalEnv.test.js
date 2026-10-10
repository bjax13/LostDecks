const test = require("node:test");
const assert = require("node:assert/strict");
const os = require("node:os");
const path = require("node:path");
const fs = require("node:fs");
const {
  REQUIRED_FIREBASE_KEYS,
  parseEnvFile,
  validateEmulatorEnv,
  packagesNeedingInstall,
  ensureFrontendEmulatorEnv,
  formatStartupBanner,
} = require("./devLocalEnv");

const COMPLETE_EXAMPLE = `# emulator env
VITE_USE_EMULATORS=true
VITE_FIREBASE_API_KEY=demo-api-key
VITE_FIREBASE_AUTH_DOMAIN=demo-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=demo-project
VITE_FIREBASE_STORAGE_BUCKET=demo-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012
VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef
VITE_FIREBASE_MEASUREMENT_ID=G-DEMO000000
VITE_FIREBASE_AUTH_EMULATOR_URL=http://127.0.0.1:9099
`;

test("parseEnvFile ignores comments and supports quotes", () => {
  const env = parseEnvFile(`
# comment
VITE_USE_EMULATORS=true
VITE_FIREBASE_API_KEY="quoted-key"
EMPTY=
`);
  assert.equal(env.VITE_USE_EMULATORS, "true");
  assert.equal(env.VITE_FIREBASE_API_KEY, "quoted-key");
  assert.equal(env.EMPTY, "");
});

test("validateEmulatorEnv requires all seven non-empty SDK keys and USE_EMULATORS", () => {
  const ok = validateEmulatorEnv(parseEnvFile(COMPLETE_EXAMPLE));
  assert.equal(ok.ok, true);

  const emptyMeasurement = validateEmulatorEnv(
    parseEnvFile(COMPLETE_EXAMPLE.replace("G-DEMO000000", "")),
  );
  assert.equal(emptyMeasurement.ok, false);
  assert.deepEqual(emptyMeasurement.emptyKeys, ["VITE_FIREBASE_MEASUREMENT_ID"]);

  const noFlag = validateEmulatorEnv(
    parseEnvFile(COMPLETE_EXAMPLE.replace("VITE_USE_EMULATORS=true", "VITE_USE_EMULATORS=false")),
  );
  assert.equal(noFlag.ok, false);
  assert.ok(noFlag.missingKeys.includes("VITE_USE_EMULATORS=true"));
});

test("packagesNeedingInstall lists dirs without node_modules", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dev-local-pkgs-"));
  fs.mkdirSync(path.join(tmp, "frontend"));
  fs.mkdirSync(path.join(tmp, "frontend", "node_modules"));
  fs.mkdirSync(path.join(tmp, "functions"));
  const missing = packagesNeedingInstall(tmp, [".", "frontend", "functions"]);
  assert.deepEqual(missing, [".", "functions"]);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("ensureFrontendEmulatorEnv creates .env from example when missing", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dev-local-env-"));
  const frontendDir = path.join(tmp, "frontend");
  fs.mkdirSync(frontendDir);
  fs.writeFileSync(path.join(frontendDir, ".env.emulator.example"), COMPLETE_EXAMPLE, "utf8");

  const result = ensureFrontendEmulatorEnv(tmp);
  assert.equal(result.action, "created");
  assert.equal(result.validation.ok, true);
  assert.ok(fs.existsSync(path.join(frontendDir, ".env")));
  assert.match(fs.readFileSync(path.join(frontendDir, ".env"), "utf8"), /G-DEMO000000/);
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("ensureFrontendEmulatorEnv repairs empty MEASUREMENT_ID and missing flag", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "dev-local-env-"));
  const frontendDir = path.join(tmp, "frontend");
  fs.mkdirSync(frontendDir);
  fs.writeFileSync(path.join(frontendDir, ".env.emulator.example"), COMPLETE_EXAMPLE, "utf8");
  fs.writeFileSync(
    path.join(frontendDir, ".env"),
    [
      "VITE_USE_EMULATORS=false",
      "VITE_FIREBASE_API_KEY=keep-me",
      "VITE_FIREBASE_AUTH_DOMAIN=demo-project.firebaseapp.com",
      "VITE_FIREBASE_PROJECT_ID=demo-project",
      "VITE_FIREBASE_STORAGE_BUCKET=demo-project.appspot.com",
      "VITE_FIREBASE_MESSAGING_SENDER_ID=123456789012",
      "VITE_FIREBASE_APP_ID=1:123456789012:web:abcdef",
      "VITE_FIREBASE_MEASUREMENT_ID=",
    ].join("\n"),
    "utf8",
  );

  const result = ensureFrontendEmulatorEnv(tmp);
  assert.equal(result.action, "repaired");
  assert.equal(result.validation.ok, true);
  const repaired = parseEnvFile(fs.readFileSync(path.join(frontendDir, ".env"), "utf8"));
  assert.equal(repaired.VITE_FIREBASE_API_KEY, "keep-me");
  assert.equal(repaired.VITE_FIREBASE_MEASUREMENT_ID, "G-DEMO000000");
  assert.equal(repaired.VITE_USE_EMULATORS, "true");
  fs.rmSync(tmp, { recursive: true, force: true });
});

test("formatStartupBanner includes worktree path and seed + Matches hints", () => {
  const banner = formatStartupBanner({
    repoRoot: "/Users/bryan/.cursor/worktrees/LostDecks/protect-bill",
    projectId: "storydeck-16",
  });
  assert.match(
    banner,
    /Worktree \/ repo root: \/Users\/bryan\/\.cursor\/worktrees\/LostDecks\/protect-bill/,
  );
  assert.match(banner, /seed:local:wipe/);
  assert.match(banner, /collector\.one@example\.com/);
  assert.match(banner, /\/matches/);
  assert.match(banner, /not the login page/i);
  assert.ok(REQUIRED_FIREBASE_KEYS.length === 7);
});

test("checked-in .env.emulator.example is a complete emulator .env template", () => {
  const examplePath = path.join(__dirname, "..", "frontend", ".env.emulator.example");
  const contents = fs.readFileSync(examplePath, "utf8");
  const validation = validateEmulatorEnv(parseEnvFile(contents));
  assert.equal(
    validation.ok,
    true,
    `example incomplete: missing=${validation.missingKeys} empty=${validation.emptyKeys}`,
  );
  assert.match(contents, /VITE_FIREBASE_MEASUREMENT_ID=\S+/);
  assert.match(contents, /restart Vite/i);
});
