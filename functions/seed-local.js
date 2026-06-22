"use strict";

const fs = require("node:fs");
const path = require("node:path");
const admin = require("firebase-admin");

const DEFAULT_CONFIG_PATH = path.join(__dirname, "seed.local.json");
const EXAMPLE_CONFIG_PATH = path.join(__dirname, "seed.local.example.json");
const COLLECTION_NAME = "collections";
const PREFERENCES_NAME = "userPreferences";
const DEFAULT_PROJECT_ID = process.env.FIREBASE_PROJECT_ID || "storydeck-16";

const args = process.argv.slice(2);
const shouldWipeExisting = args.includes("--wipe");

// Safety rail: always point Admin SDK at local emulators for this script.
process.env.FIRESTORE_EMULATOR_HOST = process.env.FIRESTORE_EMULATOR_HOST || "127.0.0.1:8080";
process.env.FIREBASE_AUTH_EMULATOR_HOST =
  process.env.FIREBASE_AUTH_EMULATOR_HOST || "127.0.0.1:9099";
process.env.GCLOUD_PROJECT = process.env.GCLOUD_PROJECT || DEFAULT_PROJECT_ID;
process.env.GOOGLE_CLOUD_PROJECT = process.env.GOOGLE_CLOUD_PROJECT || DEFAULT_PROJECT_ID;

if (!admin.apps.length) {
  admin.initializeApp({ projectId: DEFAULT_PROJECT_ID });
}

function readSeedConfig() {
  const sourcePath = fs.existsSync(DEFAULT_CONFIG_PATH) ? DEFAULT_CONFIG_PATH : EXAMPLE_CONFIG_PATH;
  const raw = fs.readFileSync(sourcePath, "utf8");
  const parsed = JSON.parse(raw);

  if (!Array.isArray(parsed.users) || parsed.users.length === 0) {
    throw new Error(`Seed config at ${sourcePath} must contain a non-empty "users" array.`);
  }

  return { sourcePath, config: parsed };
}

function sanitizeDocId(input) {
  return input.replace(/[^a-zA-Z0-9_-]/g, "_");
}

async function upsertAuthUser(userConfig) {
  const auth = admin.auth();
  const email = String(userConfig.email || "")
    .trim()
    .toLowerCase();
  const password = String(userConfig.password || "");
  const displayName = String(userConfig.displayName || "").trim();

  if (!email || !password) {
    throw new Error("Each seed user must include email and password.");
  }

  let userRecord;
  try {
    userRecord = await auth.getUserByEmail(email);
    await auth.updateUser(userRecord.uid, {
      password,
      displayName: displayName || undefined,
    });
    userRecord = await auth.getUser(userRecord.uid);
  } catch (err) {
    if (err && err.code === "auth/user-not-found") {
      userRecord = await auth.createUser({
        email,
        password,
        displayName: displayName || undefined,
      });
    } else {
      throw err;
    }
  }

  return userRecord;
}

async function wipeCollectionsForUser(db, uid) {
  const snapshot = await db.collection(COLLECTION_NAME).where("ownerUid", "==", uid).get();
  const batch = db.batch();
  snapshot.docs.forEach((doc) => {
    batch.delete(doc.ref);
  });
  await batch.commit();
  return snapshot.size;
}

async function seedUserData(db, uid, userConfig) {
  const matchingOptOut = Boolean(userConfig.matchingOptOut);
  await db.collection(PREFERENCES_NAME).doc(uid).set({ matchingOptOut }, { merge: true });

  const entries = Array.isArray(userConfig.collection) ? userConfig.collection : [];
  let createdEntries = 0;

  for (const entry of entries) {
    const skuId = String(entry?.skuId || "").trim();
    const quantity = Number(entry?.quantity);
    if (!skuId || !Number.isFinite(quantity) || quantity <= 0) {
      continue;
    }

    const docId = sanitizeDocId(`seed_${uid}_${skuId}`);
    await db
      .collection(COLLECTION_NAME)
      .doc(docId)
      .set({
        ownerUid: uid,
        skuId,
        quantity: Math.floor(quantity),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    createdEntries += 1;
  }

  return { createdEntries, matchingOptOut };
}

async function main() {
  const { sourcePath, config } = readSeedConfig();
  const db = admin.firestore();

  console.log(`Using seed config: ${sourcePath}`);
  console.log(`Project id: ${DEFAULT_PROJECT_ID}`);
  console.log(`Auth emulator host: ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  console.log(`Firestore emulator host: ${process.env.FIRESTORE_EMULATOR_HOST}`);

  for (const userConfig of config.users) {
    const userRecord = await upsertAuthUser(userConfig);
    const userLabel = `${userRecord.email} (${userRecord.uid})`;

    if (shouldWipeExisting) {
      const deleted = await wipeCollectionsForUser(db, userRecord.uid);
      console.log(`Wiped ${deleted} collection docs for ${userLabel}`);
    }

    const { createdEntries, matchingOptOut } = await seedUserData(db, userRecord.uid, userConfig);
    console.log(
      `Seeded ${createdEntries} collection docs for ${userLabel}; matchingOptOut=${matchingOptOut}`,
    );
  }

  console.log("Local seed complete.");
}

main().catch((err) => {
  console.error("Failed to seed local emulator data.");
  console.error(err);
  process.exitCode = 1;
});
