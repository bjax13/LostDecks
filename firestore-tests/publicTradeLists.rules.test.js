const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  assertFails,
  assertSucceeds,
  initializeTestEnvironment,
} = require("@firebase/rules-unit-testing");
const { doc, getDoc, setDoc, updateDoc, deleteDoc, Timestamp } = require("firebase/firestore");

const RULES_PATH = path.join(__dirname, "..", "firestore.rules");

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let testEnv;

const OWNER = "owner-uid";
const OTHER = "other-uid";

function validPublicList(overrides = {}) {
  return {
    ownerUid: OWNER,
    displayName: "Ada",
    discordHandle: "ada#1",
    iso: ["LT24-ELS-01-DUN"],
    uft: [{ skuId: "LT24-ELS-02-FOIL", quantity: 2 }],
    updatedAt: Timestamp.now(),
    version: 1,
    ...overrides,
  };
}

test.before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: "storydeck-16-public-lists",
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

test("anyone can read a public trade list", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "publicTradeLists/shareAbc123XYZ"), validPublicList());
  });

  const anon = testEnv.unauthenticatedContext().firestore();
  await assertSucceeds(getDoc(doc(anon, "publicTradeLists/shareAbc123XYZ")));
});

test("owner can create a valid public trade list", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertSucceeds(setDoc(doc(db, "publicTradeLists/shareAbc123XYZ"), validPublicList()));
});

test("create with email field is rejected", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(
    setDoc(
      doc(db, "publicTradeLists/shareAbc123XYZ"),
      validPublicList({ email: "secret@example.com" }),
    ),
  );
});

test("non-owner cannot create for another uid", async () => {
  const db = testEnv.authenticatedContext(OTHER).firestore();
  await assertFails(setDoc(doc(db, "publicTradeLists/shareAbc123XYZ"), validPublicList()));
});

test("owner can update without changing ownerUid", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "publicTradeLists/shareAbc123XYZ"), validPublicList());
  });
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertSucceeds(
    updateDoc(doc(db, "publicTradeLists/shareAbc123XYZ"), {
      displayName: "Ada Lovelace",
      updatedAt: Timestamp.now(),
    }),
  );
});

test("owner cannot reassign ownerUid on update", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "publicTradeLists/shareAbc123XYZ"), validPublicList());
  });
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(
    setDoc(
      doc(db, "publicTradeLists/shareAbc123XYZ"),
      validPublicList({ ownerUid: OTHER, displayName: "Stolen" }),
    ),
  );
});

test("owner can delete their public trade list", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "publicTradeLists/shareAbc123XYZ"), validPublicList());
  });
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertSucceeds(deleteDoc(doc(db, "publicTradeLists/shareAbc123XYZ")));
});

test("non-owner cannot delete", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "publicTradeLists/shareAbc123XYZ"), validPublicList());
  });
  const db = testEnv.authenticatedContext(OTHER).firestore();
  await assertFails(deleteDoc(doc(db, "publicTradeLists/shareAbc123XYZ")));
});

test("userPreferences may include publicShareId", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertSucceeds(
    setDoc(doc(db, `userPreferences/${OWNER}`), {
      matchingOptOut: false,
      publicShareId: "shareAbc123XYZ",
    }),
  );
});

test("publicShareId longer than 32 is rejected", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(
    setDoc(doc(db, `userPreferences/${OWNER}`), {
      publicShareId: "x".repeat(33),
    }),
  );
});

test("sanity: rules file mentions publicTradeLists", () => {
  const rules = fs.readFileSync(RULES_PATH, "utf8");
  assert.match(rules, /publicTradeLists/);
  assert.match(rules, /publicShareId/);
});
