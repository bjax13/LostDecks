const test = require("node:test");
const fs = require("node:fs");
const path = require("node:path");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  Timestamp,
  serverTimestamp,
} = require("firebase/firestore");

const RULES_PATH = path.join(__dirname, "..", "firestore.rules");

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let testEnv;

const OWNER = "owner-uid";
const OTHER = "other-uid";

function validEntry(overrides = {}) {
  return {
    ownerUid: OWNER,
    skuId: "LT24-ELS-01-DUN",
    quantity: 1,
    updatedAt: Timestamp.now(),
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

test("owner can create a valid collection entry", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertSucceeds(setDoc(doc(db, "collections/entry-1"), validEntry()));
});

test("create with an extra field is rejected", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(setDoc(doc(db, "collections/entry-1"), validEntry({ extra: "nope" })));
});

test("create with negative quantity is rejected", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(setDoc(doc(db, "collections/entry-1"), validEntry({ quantity: -1 })));
});

test("create with float quantity is rejected", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(setDoc(doc(db, "collections/entry-1"), validEntry({ quantity: 1.5 })));
});

test("create with string quantity is rejected", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(setDoc(doc(db, "collections/entry-1"), validEntry({ quantity: "1" })));
});

test("create with quantity 1000 is rejected", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(setDoc(doc(db, "collections/entry-1"), validEntry({ quantity: 1000 })));
});

test("create with bad skuId is rejected", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(setDoc(doc(db, "collections/entry-1"), validEntry({ skuId: "LT24-ELS-01" })));
});

test("create with notes longer than 500 chars is rejected", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(setDoc(doc(db, "collections/entry-1"), validEntry({ notes: "n".repeat(501) })));
});

test("create for another uid is rejected", async () => {
  const db = testEnv.authenticatedContext(OTHER).firestore();
  await assertFails(setDoc(doc(db, "collections/entry-1"), validEntry()));
});

test("owner can update quantity", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "collections/entry-1"), validEntry());
  });

  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertSucceeds(
    updateDoc(doc(db, "collections/entry-1"), {
      quantity: 3,
      updatedAt: serverTimestamp(),
    }),
  );
});

test("update changing ownerUid is rejected", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "collections/entry-1"), validEntry());
  });

  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(
    updateDoc(doc(db, "collections/entry-1"), {
      ownerUid: OTHER,
      quantity: 2,
      updatedAt: serverTimestamp(),
    }),
  );
});

test("update changing skuId is rejected", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "collections/entry-1"), validEntry());
  });

  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(
    updateDoc(doc(db, "collections/entry-1"), {
      skuId: "LT24-ELS-01-FOIL",
      quantity: 2,
      updatedAt: serverTimestamp(),
    }),
  );
});

test("update adding an unknown key is rejected", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "collections/entry-1"), validEntry());
  });

  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(
    updateDoc(doc(db, "collections/entry-1"), {
      quantity: 2,
      updatedAt: serverTimestamp(),
      sneaky: true,
    }),
  );
});

test("reading another user's collection doc is rejected", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "collections/entry-1"), validEntry());
  });

  const db = testEnv.authenticatedContext(OTHER).firestore();
  await assertFails(getDoc(doc(db, "collections/entry-1")));
});

test("userPreferences create still works (smoke)", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertSucceeds(
    setDoc(doc(db, `userPreferences/${OWNER}`), {
      matchingOptOut: false,
      matchLanes: { dun: true, foil: true, pins: false },
      matchKeep: { dun: 1, foil: 1, pins: 1 },
      matchContactSharing: "trueEmail",
    }),
  );
});
