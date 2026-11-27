const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const { doc, setDoc } = require("firebase/firestore");

const RULES_PATH = path.join(__dirname, "..", "firestore.rules");

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let testEnv;

const OWNER = "owner-uid";

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "storydeck-16",
    firestore: {
      rules: fs.readFileSync(RULES_PATH, "utf8"),
    },
  });
});

test.after(async () => {
  if (testEnv) {
    await testEnv.cleanup();
  }
});

test.beforeEach(async () => {
  await testEnv.clearFirestore();
});

test("clients cannot read or write aiPhotoImportUsage", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(setDoc(doc(db, "aiPhotoImportUsage/owner-uid"), { dailyCount: 1 }));
  const deniedDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(setDoc(doc(db, "aiPhotoImportUsage/owner-uid"), { dailyCount: 99 }));
  await assertFails(setDoc(doc(deniedDb, "aiPhotoImportGlobal/counters"), { dailyCount: 1 }));
});

test("clients cannot write config/aiPhotoImport", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(
    setDoc(doc(db, "config/aiPhotoImport"), {
      perUserDailyCap: 999,
    }),
  );
});

test("admin context still denied without rules bypass", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(setDoc(doc(db, "aiPhotoImportGlobal/counters"), { dailyCount: 0 }));
  await assertSucceeds(
    testEnv.withSecurityRulesDisabled(async (ctx) => {
      const adminDb = ctx.firestore();
      await setDoc(doc(adminDb, "config/aiPhotoImport"), { perUserDailyCap: 25 });
    }),
  );
});
