const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  Timestamp,
  updateDoc,
  where,
} = require("firebase/firestore");

const RULES_PATH = path.join(__dirname, "..", "firestore.rules");

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let testEnv;

const OWNER = "owner-uid";
const OTHER = "other-uid";
const SHARE_ID = "shareId12ab";

function validShare(overrides = {}) {
  return {
    ownerUid: OWNER,
    displayName: "Pat",
    iso: ["LT24-ELS-01-DUN"],
    uft: [{ skuId: "LT24-LOP-02-FOIL", quantity: 2 }],
    updatedAt: Timestamp.now(),
    version: 1,
    ...overrides,
  };
}

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

test("anonymous users cannot list or query shares", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, `shares/${SHARE_ID}`), validShare());
  });

  const anonDb = testEnv.unauthenticatedContext().firestore();
  await assertFails(getDocs(collection(anonDb, "shares")));
  await assertFails(getDocs(query(collection(anonDb, "shares"), where("ownerUid", "==", OWNER))));
});

test("anonymous users can read an individual share snapshot", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, `shares/${SHARE_ID}`), validShare());
  });

  const anonDb = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(anonDb, `shares/${SHARE_ID}`)));
});

test("owner can create a share snapshot", async () => {
  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
  await assertSucceeds(setDoc(doc(ownerDb, `shares/${SHARE_ID}`), validShare()));
});

test("non-owner cannot create or update a share", async () => {
  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
  const otherDb = testEnv.authenticatedContext(OTHER).firestore();

  await assertFails(setDoc(doc(otherDb, `shares/${SHARE_ID}`), validShare()));
  await assertSucceeds(setDoc(doc(ownerDb, `shares/${SHARE_ID}`), validShare()));

  await assertFails(setDoc(doc(otherDb, `shares/${SHARE_ID}`), validShare({ ownerUid: OTHER })));

  await assertFails(
    updateDoc(doc(otherDb, `shares/${SHARE_ID}`), {
      displayName: "Hacked",
      iso: [],
      uft: [],
      updatedAt: Timestamp.now(),
      version: 1,
    }),
  );
});

test("owner can delete their share", async () => {
  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
  await setDoc(doc(ownerDb, `shares/${SHARE_ID}`), validShare());
  await assertSucceeds(deleteDoc(doc(ownerDb, `shares/${SHARE_ID}`)));
});
