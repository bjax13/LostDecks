import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const m = vi.hoisted(() => {
  const mockApp = { name: "mock-app" };
  const mockAuth = { _auth: true };
  const mockDb = { _db: true };
  const mockFunctions = { _fn: true };

  return {
    mockApp,
    mockAuth,
    mockDb,
    mockFunctions,
    initializeApp: vi.fn(() => mockApp),
    getApps: vi.fn(() => []),
    getApp: vi.fn(() => mockApp),
    connectAuthEmulator: vi.fn(),
    connectFirestoreEmulator: vi.fn(),
    connectFunctionsEmulator: vi.fn(),
    getAuth: vi.fn(() => mockAuth),
    getFirestore: vi.fn(() => mockDb),
    getFunctions: vi.fn(() => mockFunctions),
    setPersistence: vi.fn(() => Promise.resolve()),
    browserLocalPersistence: "LOCAL",
    GoogleAuthProvider: vi.fn(function GoogleAuthProvider() {
      this.setCustomParameters = vi.fn();
    }),
    GithubAuthProvider: vi.fn(function GithubAuthProvider() {
      this.setCustomParameters = vi.fn();
    }),
  };
});

vi.mock("firebase/app", () => ({
  getApp: m.getApp,
  getApps: m.getApps,
  initializeApp: m.initializeApp,
}));

vi.mock("firebase/auth", () => ({
  GithubAuthProvider: m.GithubAuthProvider,
  GoogleAuthProvider: m.GoogleAuthProvider,
  browserLocalPersistence: m.browserLocalPersistence,
  connectAuthEmulator: m.connectAuthEmulator,
  getAuth: m.getAuth,
  setPersistence: m.setPersistence,
}));

vi.mock("firebase/firestore", () => ({
  connectFirestoreEmulator: m.connectFirestoreEmulator,
  getFirestore: m.getFirestore,
}));

vi.mock("firebase/functions", () => ({
  connectFunctionsEmulator: m.connectFunctionsEmulator,
  getFunctions: m.getFunctions,
}));

function stubValidFirebaseEnv() {
  vi.stubEnv("VITE_FIREBASE_API_KEY", "key");
  vi.stubEnv("VITE_FIREBASE_AUTH_DOMAIN", "example.test");
  vi.stubEnv("VITE_FIREBASE_PROJECT_ID", "proj");
  vi.stubEnv("VITE_FIREBASE_STORAGE_BUCKET", "bucket");
  vi.stubEnv("VITE_FIREBASE_MESSAGING_SENDER_ID", "sender");
  vi.stubEnv("VITE_FIREBASE_APP_ID", "app-id");
  vi.stubEnv("VITE_FIREBASE_MEASUREMENT_ID", "G-XXXX");
}

function clearFirebaseEnv() {
  for (const key of [
    "VITE_FIREBASE_API_KEY",
    "VITE_FIREBASE_AUTH_DOMAIN",
    "VITE_FIREBASE_PROJECT_ID",
    "VITE_FIREBASE_STORAGE_BUCKET",
    "VITE_FIREBASE_MESSAGING_SENDER_ID",
    "VITE_FIREBASE_APP_ID",
    "VITE_FIREBASE_MEASUREMENT_ID",
    "VITE_USE_EMULATORS",
    "VITE_FIREBASE_AUTH_EMULATOR_URL",
    "VITE_FIRESTORE_EMULATOR_HOST",
    "VITE_FIRESTORE_EMULATOR_PORT",
    "VITE_FUNCTIONS_EMULATOR_HOST",
    "VITE_FUNCTIONS_EMULATOR_PORT",
  ]) {
    vi.stubEnv(key, "");
  }
}

async function flushMicrotasks() {
  await Promise.resolve();
  await Promise.resolve();
}

describe("firebase module", () => {
  let warnSpy;
  let debugSpy;
  let errorSpy;

  beforeEach(() => {
    vi.resetModules();
    vi.unstubAllEnvs();
    warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    debugSpy = vi.spyOn(console, "debug").mockImplementation(() => {});
    errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    m.initializeApp.mockClear().mockImplementation(() => m.mockApp);
    m.getApps.mockClear().mockReturnValue([]);
    m.getApp.mockClear().mockImplementation(() => m.mockApp);
    m.connectAuthEmulator.mockClear().mockImplementation(() => {});
    m.connectFirestoreEmulator.mockClear().mockImplementation(() => {});
    m.connectFunctionsEmulator.mockClear().mockImplementation(() => {});
    m.getAuth.mockClear().mockImplementation(() => m.mockAuth);
    m.getFirestore.mockClear().mockImplementation(() => m.mockDb);
    m.getFunctions.mockClear().mockImplementation(() => m.mockFunctions);
    m.setPersistence.mockClear().mockImplementation(() => Promise.resolve());
    m.GoogleAuthProvider.mockClear();
    m.GithubAuthProvider.mockClear();
  });

  afterEach(() => {
    warnSpy.mockRestore();
    debugSpy.mockRestore();
    errorSpy.mockRestore();
    vi.unstubAllEnvs();
  });

  it("warns and exports null services when config is incomplete", async () => {
    clearFirebaseEnv();
    const mod = await import("./firebase.js");

    expect(mod.hasFirebaseConfig).toBe(false);
    expect(mod.app).toBeNull();
    expect(mod.auth).toBeNull();
    expect(mod.db).toBeNull();
    expect(mod.functions).toBeNull();
    expect(mod.googleProvider).toBeNull();
    expect(mod.githubProvider).toBeNull();
    expect(m.initializeApp).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("Firebase is not configured"));
    expect(m.connectAuthEmulator).not.toHaveBeenCalled();
  });

  it("treats whitespace-only env values as missing config", async () => {
    stubValidFirebaseEnv();
    vi.stubEnv("VITE_FIREBASE_API_KEY", "   ");
    const mod = await import("./firebase.js");

    expect(mod.hasFirebaseConfig).toBe(false);
    expect(mod.app).toBeNull();
    expect(m.initializeApp).not.toHaveBeenCalled();
  });

  it("initializes the app when config is valid and no app exists yet", async () => {
    stubValidFirebaseEnv();
    vi.stubEnv("VITE_USE_EMULATORS", "false");
    m.getApps.mockReturnValue([]);

    const mod = await import("./firebase.js");

    expect(mod.hasFirebaseConfig).toBe(true);
    expect(m.initializeApp).toHaveBeenCalledTimes(1);
    expect(m.initializeApp).toHaveBeenCalledWith(
      expect.objectContaining({
        apiKey: "key",
        projectId: "proj",
        appId: "app-id",
      }),
    );
    expect(m.getApp).not.toHaveBeenCalled();
    expect(mod.app).toBe(m.mockApp);
    expect(m.getAuth).toHaveBeenCalledWith(m.mockApp);
    expect(m.GoogleAuthProvider).toHaveBeenCalled();
    expect(m.GithubAuthProvider).toHaveBeenCalled();
  });

  it("reuses an existing app via getApp when getApps is non-empty", async () => {
    stubValidFirebaseEnv();
    vi.stubEnv("VITE_USE_EMULATORS", "false");
    m.getApps.mockReturnValue([m.mockApp]);

    const mod = await import("./firebase.js");

    expect(mod.hasFirebaseConfig).toBe(true);
    expect(m.getApp).toHaveBeenCalledTimes(1);
    expect(m.initializeApp).not.toHaveBeenCalled();
  });

  it("connects emulators with defaults when VITE_USE_EMULATORS is true (case-insensitive)", async () => {
    stubValidFirebaseEnv();
    vi.stubEnv("VITE_USE_EMULATORS", "TRUE");

    await import("./firebase.js");

    expect(m.connectAuthEmulator).toHaveBeenCalledWith(m.mockAuth, "http://127.0.0.1:9099", {
      disableWarnings: true,
    });
    expect(m.connectFirestoreEmulator).toHaveBeenCalledWith(m.mockDb, "127.0.0.1", 8080);
    expect(m.connectFunctionsEmulator).toHaveBeenCalledWith(m.mockFunctions, "127.0.0.1", 5001);
  });

  it("uses custom emulator host and port env overrides", async () => {
    stubValidFirebaseEnv();
    vi.stubEnv("VITE_USE_EMULATORS", "true");
    vi.stubEnv("VITE_FIREBASE_AUTH_EMULATOR_URL", "http://custom:9099");
    vi.stubEnv("VITE_FIRESTORE_EMULATOR_HOST", "10.0.0.1");
    vi.stubEnv("VITE_FIRESTORE_EMULATOR_PORT", "18080");
    vi.stubEnv("VITE_FUNCTIONS_EMULATOR_HOST", "10.0.0.2");
    vi.stubEnv("VITE_FUNCTIONS_EMULATOR_PORT", "15001");

    await import("./firebase.js");

    expect(m.connectAuthEmulator).toHaveBeenCalledWith(m.mockAuth, "http://custom:9099", {
      disableWarnings: true,
    });
    expect(m.connectFirestoreEmulator).toHaveBeenCalledWith(m.mockDb, "10.0.0.1", 18080);
    expect(m.connectFunctionsEmulator).toHaveBeenCalledWith(m.mockFunctions, "10.0.0.2", 15001);
  });

  it("logs debug when Auth emulator connection throws", async () => {
    stubValidFirebaseEnv();
    vi.stubEnv("VITE_USE_EMULATORS", "true");
    const err = new Error("auth already connected");
    m.connectAuthEmulator.mockImplementation(() => {
      throw err;
    });

    await import("./firebase.js");

    expect(debugSpy).toHaveBeenCalledWith("Auth emulator connection skipped", err);
    expect(m.connectFirestoreEmulator).toHaveBeenCalled();
    expect(m.connectFunctionsEmulator).toHaveBeenCalled();
  });

  it("logs debug when Firestore emulator connection throws", async () => {
    stubValidFirebaseEnv();
    vi.stubEnv("VITE_USE_EMULATORS", "true");
    const err = new Error("firestore already connected");
    m.connectFirestoreEmulator.mockImplementation(() => {
      throw err;
    });

    await import("./firebase.js");

    expect(debugSpy).toHaveBeenCalledWith("Firestore emulator connection skipped", err);
  });

  it("logs debug when Functions emulator connection throws", async () => {
    stubValidFirebaseEnv();
    vi.stubEnv("VITE_USE_EMULATORS", "true");
    const err = new Error("functions already connected");
    m.connectFunctionsEmulator.mockImplementation(() => {
      throw err;
    });

    await import("./firebase.js");

    expect(debugSpy).toHaveBeenCalledWith("Functions emulator connection skipped", err);
  });

  it("logs error when setPersistence rejects", async () => {
    stubValidFirebaseEnv();
    vi.stubEnv("VITE_USE_EMULATORS", "false");
    const persistErr = new Error("persistence blocked");
    m.setPersistence.mockImplementation(() => Promise.reject(persistErr));

    await import("./firebase.js");
    await flushMicrotasks();

    expect(errorSpy).toHaveBeenCalledWith("Failed to set Firebase auth persistence", persistErr);
  });

  it("does not connect emulators when app services are missing", async () => {
    clearFirebaseEnv();
    vi.stubEnv("VITE_USE_EMULATORS", "true");

    await import("./firebase.js");

    expect(m.connectAuthEmulator).not.toHaveBeenCalled();
    expect(m.connectFirestoreEmulator).not.toHaveBeenCalled();
    expect(m.connectFunctionsEmulator).not.toHaveBeenCalled();
  });

  it("sets OAuth provider custom parameters when auth exists", async () => {
    stubValidFirebaseEnv();
    vi.stubEnv("VITE_USE_EMULATORS", "false");

    await import("./firebase.js");

    const googleInstance = m.GoogleAuthProvider.mock.results[0]?.value;
    const githubInstance = m.GithubAuthProvider.mock.results[0]?.value;
    expect(googleInstance?.setCustomParameters).toHaveBeenCalledWith({ prompt: "select_account" });
    expect(githubInstance?.setCustomParameters).toHaveBeenCalledWith({ allow_signup: "false" });
  });
});
