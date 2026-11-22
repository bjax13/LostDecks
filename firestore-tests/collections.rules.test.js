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
  updateDoc,
  where,
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

test("owner can create a quantity 0 entry with an ISO flag", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertSucceeds(
    setDoc(doc(db, "collections/entry-iso"), validEntry({ quantity: 0, tradeFlag: "iso" })),
  );
});

test("owner can create an entry with a UFT flag", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertSucceeds(setDoc(doc(db, "collections/entry-uft"), validEntry({ tradeFlag: "uft" })));
});

test("create with an unknown tradeFlag is rejected", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(setDoc(doc(db, "collections/entry-1"), validEntry({ tradeFlag: "keep" })));
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

test("owner can set and clear tradeFlag", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "collections/entry-1"), validEntry());
  });

  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertSucceeds(
    updateDoc(doc(db, "collections/entry-1"), {
      tradeFlag: "iso",
      updatedAt: serverTimestamp(),
    }),
  );
  await assertSucceeds(
    updateDoc(doc(db, "collections/entry-1"), {
      tradeFlag: "uft",
      updatedAt: serverTimestamp(),
    }),
  );
});

test("update with an unknown tradeFlag is rejected", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "collections/entry-1"), validEntry());
  });

  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertFails(
    updateDoc(doc(db, "collections/entry-1"), {
      tradeFlag: "nft",
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

test("owner can read their own collection doc and query", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "collections/entry-1"), validEntry());
  });

  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertSucceeds(getDoc(doc(db, "collections/entry-1")));
  await assertSucceeds(
    getDocs(query(collection(db, "collections"), where("ownerUid", "==", OWNER))),
  );
});

test("non-admin cannot list every collection or query another owner", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "collections/entry-1"), validEntry());
  });

  const db = testEnv.authenticatedContext(OTHER, { admin: false }).firestore();
  await assertFails(getDocs(collection(db, "collections")));
  await assertFails(getDocs(query(collection(db, "collections"), where("ownerUid", "==", OWNER))));
});

test("admin claim can read and query another user's collection", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "collections/entry-1"), validEntry());
  });

  const db = testEnv.authenticatedContext("admin-uid", { admin: true }).firestore();
  await assertSucceeds(getDoc(doc(db, "collections/entry-1")));
  await assertSucceeds(getDocs(collection(db, "collections")));
  await assertSucceeds(
    getDocs(query(collection(db, "collections"), where("ownerUid", "==", OWNER))),
  );
});

test("admin claim cannot write or delete another user's collection", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), "collections/entry-1"), validEntry());
  });

  const db = testEnv.authenticatedContext("admin-uid", { admin: true }).firestore();
  await assertFails(setDoc(doc(db, "collections/entry-admin"), validEntry()));
  await assertFails(
    updateDoc(doc(db, "collections/entry-1"), {
      quantity: 4,
      updatedAt: serverTimestamp(),
    }),
  );
  await assertFails(deleteDoc(doc(db, "collections/entry-1")));
});

test("admin claim can still create their own collection entry", async () => {
  const db = testEnv.authenticatedContext("admin-uid", { admin: true }).firestore();
  await assertSucceeds(
    setDoc(doc(db, "collections/entry-admin"), validEntry({ ownerUid: "admin-uid" })),
  );
});

test("two owners can create the same SKU at owner-scoped doc ids", async () => {
  const skuId = "PIN-CF-02";
  const ownerDocId = `${OWNER}_${skuId}`;
  const otherDocId = `${OTHER}_${skuId}`;

  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();
  const otherDb = testEnv.authenticatedContext(OTHER).firestore();

  await assertSucceeds(
    setDoc(doc(ownerDb, "collections", ownerDocId), validEntry({ ownerUid: OWNER, skuId })),
  );
  await assertSucceeds(
    setDoc(doc(otherDb, "collections", otherDocId), validEntry({ ownerUid: OTHER, skuId })),
  );
  await assertFails(
    setDoc(doc(otherDb, "collections", ownerDocId), validEntry({ ownerUid: OTHER, skuId })),
  );
});

test("cannot squat another user's owner-scoped doc id on create", async () => {
  const skuId = "PIN-CF-02";
  const victimScopedId = `${OWNER}_${skuId}`;
  const otherDb = testEnv.authenticatedContext(OTHER).firestore();

  await assertFails(
    setDoc(doc(otherDb, "collections", victimScopedId), validEntry({ ownerUid: OTHER, skuId })),
  );
});

test("owner-scoped and auto-id collection creates still work", async () => {
  const ownerDb = testEnv.authenticatedContext(OWNER).firestore();

  await assertSucceeds(
    setDoc(
      doc(ownerDb, "collections", `${OWNER}_PIN-CF-02`),
      validEntry({ ownerUid: OWNER, skuId: "PIN-CF-02" }),
    ),
  );
  await assertSucceeds(setDoc(doc(ownerDb, "collections/entry-1"), validEntry()));
  await assertSucceeds(
    setDoc(
      doc(ownerDb, "collections", "PIN-CF-01"),
      validEntry({ ownerUid: OWNER, skuId: "PIN-CF-01" }),
    ),
  );
});

test("admin claim cannot read another user's preferences", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `userPreferences/${OWNER}`), {
      matchingOptOut: false,
    });
  });

  const db = testEnv.authenticatedContext("admin-uid", { admin: true }).firestore();
  await assertFails(getDoc(doc(db, `userPreferences/${OWNER}`)));
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

test("owner can store and clear a country and state code", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  const ref = doc(db, `userPreferences/${OWNER}`);
  await assertSucceeds(
    setDoc(ref, {
      matchCountry: "US",
      matchRegion: "US-UT",
    }),
  );
  await assertSucceeds(
    updateDoc(ref, {
      matchCountry: "",
      matchRegion: "",
    }),
  );
});

test("owner can store a country without a state", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  await assertSucceeds(
    setDoc(doc(db, `userPreferences/${OWNER}`), {
      matchCountry: "FR",
      matchRegion: "",
    }),
  );
});

test("location free text and a region from another country are rejected", async () => {
  const db = testEnv.authenticatedContext(OWNER).firestore();
  const ref = doc(db, `userPreferences/${OWNER}`);
  await assertFails(setDoc(ref, { matchCountry: "California" }));
  await assertFails(setDoc(ref, { matchCountry: "us" }));
  await assertFails(setDoc(ref, { matchCountry: "USA" }));
  await assertFails(setDoc(ref, { matchCountry: "US", matchRegion: "Utah" }));
  await assertFails(setDoc(ref, { matchCountry: "US", matchRegion: "CA-ON" }));
  await assertFails(setDoc(ref, { matchRegion: "US-UT" }));
  await assertFails(setDoc(ref, { matchCountry: "US", matchRegion: "US-CALIFORNIA" }));
});

test("another signed-in user cannot read or write location on preferences", async () => {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    await setDoc(doc(context.firestore(), `userPreferences/${OWNER}`), {
      matchCountry: "US",
      matchRegion: "US-CA",
    });
  });

  const other = testEnv.authenticatedContext(OTHER).firestore();
  await assertFails(getDoc(doc(other, `userPreferences/${OWNER}`)));
  await assertFails(
    updateDoc(doc(other, `userPreferences/${OWNER}`), {
      matchCountry: "CA",
      matchRegion: "CA-ON",
    }),
  );
});
