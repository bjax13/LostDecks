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
  serverTimestamp,
  Timestamp,
  updateDoc,
  where,
} = require("firebase/firestore");

const RULES_PATH = path.join(__dirname, "..", "firestore.rules");
const ROOT = path.join(__dirname, "..");
const STORY_CATALOG_PATH = path.join(ROOT, "frontend/src/storyData/storydeck-lt24-with-skus.json");
const PINS_CATALOG_PATH = path.join(ROOT, "frontend/src/storyData/pins-catalog.json");

/** @type {import("@firebase/rules-unit-testing").RulesTestEnvironment} */
let testEnv;

const OWNER = "owner-uid";
const OTHER = "other-uid";
const SHARE_ID = "shareId12ab";
const SHARE_SCHEMA_VERSION = 2;

function loadCatalogSkuIds() {
  const story = JSON.parse(fs.readFileSync(STORY_CATALOG_PATH, "utf8"));
  const pins = JSON.parse(fs.readFileSync(PINS_CATALOG_PATH, "utf8"));
  return [
    ...new Set(
      [...(story.skus ?? []), ...(pins.skus ?? [])].map((row) => row.skuId).filter(Boolean),
    ),
  ];
}

function encodeIso(skus) {
  return skus.join(",");
}

function encodeUft(rows) {
  return rows.map((row) => `${row.skuId}:${row.quantity}`).join(",");
}

function validShare(overrides = {}) {
  return {
    ownerUid: OWNER,
    displayName: "Pat",
    iso: "LT24-ELS-01-DUN",
    uft: "LT24-LOP-02-FOIL:2",
    updatedAt: serverTimestamp(),
    version: SHARE_SCHEMA_VERSION,
    ...overrides,
  };
}

function ownerTombstone(overrides = {}) {
  return {
    ownerUid: OWNER,
    revokedAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    version: SHARE_SCHEMA_VERSION,
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

test("anonymous users can read an individual active share snapshot", async () => {
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

test("allows share with empty iso and uft strings", async () => {
  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
  await assertSucceeds(
    setDoc(doc(ownerDb, `shares/${SHARE_ID}`), validShare({ iso: "", uft: "" })),
  );
});

test("allows full catalog iso csv round trip", async () => {
  const skuIds = loadCatalogSkuIds();
  const isoCsv = encodeIso(skuIds);
  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
  await assertSucceeds(
    setDoc(doc(ownerDb, `shares/${SHARE_ID}`), validShare({ iso: isoCsv, uft: "" })),
  );
});

test("allows full catalog uft csv round trip", async () => {
  const skuIds = loadCatalogSkuIds();
  const uftCsv = encodeUft(skuIds.map((skuId) => ({ skuId, quantity: 1 })));
  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
  await assertSucceeds(
    setDoc(doc(ownerDb, `shares/${SHARE_ID}-uft`), validShare({ iso: "", uft: uftCsv })),
  );
});

test("rejects iso csv with a bad token", async () => {
  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(
    setDoc(doc(ownerDb, `shares/${SHARE_ID}`), validShare({ iso: "LT24-ELS-01-DUN,not-a-sku" })),
  );
});

test("rejects uft csv with bad quantity", async () => {
  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(
    setDoc(doc(ownerDb, `shares/${SHARE_ID}`), validShare({ uft: "LT24-LOP-02-FOIL:0" })),
  );
  await assertFails(
    setDoc(doc(ownerDb, `shares/${SHARE_ID}`), validShare({ uft: "LT24-LOP-02-FOIL:1000" })),
  );
  await assertFails(
    setDoc(doc(ownerDb, `shares/${SHARE_ID}`), validShare({ uft: "LT24-LOP-02-FOIL:qty" })),
  );
});

test("rejects oversize iso and uft strings", async () => {
  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
  const longIso = "LT24-ELS-01-DUN,".repeat(1100);
  const longUft = "LT24-LOP-02-FOIL:1,".repeat(1300);
  await assertFails(setDoc(doc(ownerDb, `shares/${SHARE_ID}`), validShare({ iso: longIso })));
  await assertFails(setDoc(doc(ownerDb, `shares/${SHARE_ID}`), validShare({ uft: longUft })));
});

test("rejects share writes when updatedAt is not request time", async () => {
  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(
    setDoc(doc(ownerDb, `shares/${SHARE_ID}`), validShare({ updatedAt: Timestamp.fromMillis(0) })),
  );
});

test("owner cannot tombstone with a different ownerUid", async () => {
  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
  await setDoc(doc(ownerDb, `shares/${SHARE_ID}`), validShare());
  await assertFails(
    setDoc(doc(ownerDb, `shares/${SHARE_ID}`), ownerTombstone({ ownerUid: OTHER })),
  );
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
      iso: "",
      uft: "",
      updatedAt: serverTimestamp(),
      version: SHARE_SCHEMA_VERSION,
    }),
  );
});

test("owner can revoke a share to an owner tombstone", async () => {
  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
  await setDoc(doc(ownerDb, `shares/${SHARE_ID}`), validShare());
  await assertSucceeds(setDoc(doc(ownerDb, `shares/${SHARE_ID}`), ownerTombstone()));
  const snapshot = await assertSucceeds(getDoc(doc(ownerDb, `shares/${SHARE_ID}`)));
  const data = snapshot.data();
  if (data.displayName) {
    throw new Error("tombstone must not retain displayName");
  }
});

test("strangers cannot read a revoked share", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, `shares/${SHARE_ID}`), ownerTombstone());
  });

  const anonDb = testEnv.unauthenticatedContext().firestore();
  const otherDb = testEnv.authenticatedContext(OTHER).firestore();
  await assertFails(getDoc(doc(anonDb, `shares/${SHARE_ID}`)));
  await assertFails(getDoc(doc(otherDb, `shares/${SHARE_ID}`)));
});

test("owner can read their revoked share tombstone", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, `shares/${SHARE_ID}`), ownerTombstone());
  });

  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
  await assertSucceeds(getDoc(doc(ownerDb, `shares/${SHARE_ID}`)));
});

test("revoked share cannot retain profile fields", async () => {
  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
  await setDoc(doc(ownerDb, `shares/${SHARE_ID}`), validShare());
  await assertFails(
    setDoc(doc(ownerDb, `shares/${SHARE_ID}`), {
      ...ownerTombstone(),
      displayName: "Still visible",
    }),
  );
  await assertFails(
    updateDoc(doc(ownerDb, `shares/${SHARE_ID}`), {
      iso: "",
      uft: "",
      revokedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    }),
  );
});

test("owners cannot delete share documents", async () => {
  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
  await setDoc(doc(ownerDb, `shares/${SHARE_ID}`), validShare());
  await assertFails(deleteDoc(doc(ownerDb, `shares/${SHARE_ID}`)));
});

test("another user cannot claim a revoked share id", async () => {
  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
  const otherDb = testEnv.authenticatedContext(OTHER).firestore();
  await setDoc(doc(ownerDb, `shares/${SHARE_ID}`), validShare());
  await assertSucceeds(setDoc(doc(ownerDb, `shares/${SHARE_ID}`), ownerTombstone()));

  await assertFails(setDoc(doc(otherDb, `shares/${SHARE_ID}`), validShare({ ownerUid: OTHER })));
});
