import { isValidSkuId } from "./catalog.js";

const mode = (process.env.SHARDSTASH_MCP_MODE || "stub").toLowerCase();
const defaultUid = process.env.SHARDSTASH_MCP_UID || "poc-collector-one";

/** In-memory stub collection for PoC demos without Firebase. */
const stubCollections = new Map([
  [
    "poc-collector-one",
    new Map([
      ["LT24-ELS-01-DUN", 2],
      ["LT24-ELS-03-DUN", 1],
    ]),
  ],
  [
    "poc-collector-two",
    new Map([
      ["LT24-ELS-02-DUN", 2],
      ["LT24-ELS-04-DUN", 1],
    ]),
  ],
]);

function actingUid(uid) {
  return typeof uid === "string" && uid.trim() ? uid.trim() : defaultUid;
}

function stubGetCollection(uid) {
  const owner = actingUid(uid);
  const bag = stubCollections.get(owner) || new Map();
  const bySkuId = Object.fromEntries(bag);
  const entries = Object.entries(bySkuId).map(([skuId, quantity]) => ({ skuId, quantity }));
  return {
    mode: "stub",
    ownerUid: owner,
    entries,
    bySkuId,
    totalSkus: entries.length,
  };
}

function stubSetQuantity({ uid, skuId, quantity }) {
  const owner = actingUid(uid);
  if (!isValidSkuId(skuId)) {
    throw new Error(`Unknown skuId: ${skuId}`);
  }
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 0) {
    throw new Error("quantity must be a non-negative integer");
  }

  if (!stubCollections.has(owner)) {
    stubCollections.set(owner, new Map());
  }
  const bag = stubCollections.get(owner);

  if (qty === 0) {
    bag.delete(skuId);
    return { mode: "stub", ownerUid: owner, skuId, quantity: 0, deleted: true };
  }

  bag.set(skuId, qty);
  return { mode: "stub", ownerUid: owner, skuId, quantity: qty, deleted: false };
}

function stubGetMatches({ uid, pageSize = 20 }) {
  const owner = actingUid(uid);
  const size = Math.min(Math.max(Number(pageSize) || 20, 1), 50);

  // Synthetic mutual extras so agents can exercise the tool without emulators.
  const counterpartUid = owner === "poc-collector-one" ? "poc-collector-two" : "poc-collector-one";
  const match = {
    userId: counterpartUid,
    displayName: counterpartUid === "poc-collector-two" ? "Collector Two" : "Collector One",
    lanes: [
      {
        id: "dun",
        theyCanSend: [{ skuId: "LT24-ELS-02-DUN", owned: 2, extras: 1 }],
        youCanSend: [{ skuId: "LT24-ELS-01-DUN", owned: 2, extras: 1 }],
      },
    ],
    contact: {
      method: "trueEmail",
      email: "stub@example.com",
      usedFallback: true,
      fallbackReason: "stub_mode",
    },
  };

  return {
    mode: "stub",
    // TODO(emulator): call getTradeMatches callable or import functions/matches.js + Admin reads
    callerOptedOut: false,
    matches: [match].slice(0, size),
    pageSize: size,
    nextCursor: null,
    hasMore: false,
    totalOnPage: 1,
    note: "Stub matches. Set SHARDSTASH_MCP_MODE=emulator and wire Admin/callable for real data.",
  };
}

let adminDb = null;

async function ensureAdmin() {
  if (adminDb) return adminDb;
  if (mode !== "emulator") {
    throw new Error("Admin Firestore only available when SHARDSTASH_MCP_MODE=emulator");
  }

  process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
  process.env.FIREBASE_AUTH_EMULATOR_HOST =
    process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
  const projectId =
    process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "storydeck-16";
  process.env.GCLOUD_PROJECT = projectId;
  process.env.GOOGLE_CLOUD_PROJECT = projectId;

  const admin = (await import("firebase-admin")).default;
  if (!admin.apps.length) {
    admin.initializeApp({ projectId });
  }
  adminDb = admin.firestore();
  return adminDb;
}

async function emulatorGetCollection(uid) {
  const db = await ensureAdmin();
  const owner = actingUid(uid);
  const snapshot = await db.collection("collections").where("ownerUid", "==", owner).get();
  const bySkuId = {};
  for (const doc of snapshot.docs) {
    const data = doc.data();
    const skuId = data.skuId;
    const quantity = Number(data.quantity) || 0;
    if (!skuId || quantity <= 0) continue;
    bySkuId[skuId] = (bySkuId[skuId] || 0) + quantity;
  }
  const entries = Object.entries(bySkuId).map(([skuId, quantity]) => ({ skuId, quantity }));
  return {
    mode: "emulator",
    ownerUid: owner,
    entries,
    bySkuId,
    totalSkus: entries.length,
  };
}

async function emulatorSetQuantity({ uid, skuId, quantity }) {
  const db = await ensureAdmin();
  const owner = actingUid(uid);
  if (!isValidSkuId(skuId)) {
    throw new Error(`Unknown skuId: ${skuId}`);
  }
  const qty = Number(quantity);
  if (!Number.isInteger(qty) || qty < 0) {
    throw new Error("quantity must be a non-negative integer");
  }

  const snapshot = await db
    .collection("collections")
    .where("ownerUid", "==", owner)
    .where("skuId", "==", skuId)
    .get();

  if (qty === 0) {
    const batch = db.batch();
    for (const doc of snapshot.docs) batch.delete(doc.ref);
    if (snapshot.size) await batch.commit();
    return { mode: "emulator", ownerUid: owner, skuId, quantity: 0, deleted: true };
  }

  if (snapshot.empty) {
    await db.collection("collections").add({
      ownerUid: owner,
      skuId,
      quantity: qty,
      updatedAt: new Date(),
    });
  } else {
    const [keeper, ...dupes] = snapshot.docs;
    const batch = db.batch();
    batch.set(
      keeper.ref,
      { ownerUid: owner, skuId, quantity: qty, updatedAt: new Date() },
      {
        merge: true,
      },
    );
    for (const doc of dupes) batch.delete(doc.ref);
    await batch.commit();
  }

  return { mode: "emulator", ownerUid: owner, skuId, quantity: qty, deleted: false };
}

async function emulatorGetMatches(args) {
  // TODO: Invoke Functions emulator callable getTradeMatches with a user ID token,
  // or import ../functions/matches.js and reuse buildMatchesForCaller with Admin reads.
  // Until wired, fall back to stub shape so the tool remains callable in demos.
  const stub = stubGetMatches(args);
  return {
    ...stub,
    mode: "emulator",
    note: "Emulator matches not fully wired yet; returning stub payload. See TODO in store.js.",
  };
}

export function getMode() {
  return mode === "emulator" ? "emulator" : "stub";
}

export async function getCollection(args = {}) {
  return getMode() === "emulator" ? emulatorGetCollection(args.uid) : stubGetCollection(args.uid);
}

export async function setQuantity(args) {
  return getMode() === "emulator" ? emulatorSetQuantity(args) : stubSetQuantity(args);
}

export async function getMatches(args = {}) {
  return getMode() === "emulator" ? emulatorGetMatches(args) : stubGetMatches(args);
}
