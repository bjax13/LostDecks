"use strict";

const admin = require("firebase-admin");
const { HttpsError, onCall } = require("firebase-functions/v2/https");

function uidOrEmpty(value) {
  return typeof value === "string" ? value : "";
}

/**
 * Delete all documents matching a Firestore query in batches.
 * @param {FirebaseFirestore.Query} query
 * @param {number} [size=400]
 */
async function deleteQueryInBatches(query, size = 400) {
  const batchSize = Number.isInteger(size) && size > 0 ? size : 400;
  // Loop until a page returns empty — each page is limited so we stay under batch limits.
  for (;;) {
    const snapshot = await query.limit(batchSize).get();
    if (snapshot.empty) {
      return;
    }

    const db = query.firestore;
    const batch = db.batch();
    for (const doc of snapshot.docs) {
      batch.delete(doc.ref);
    }
    await batch.commit();

    if (snapshot.size < batchSize) {
      return;
    }
  }
}

async function deleteMyAccountHandler(request) {
  const uid = uidOrEmpty(request.auth?.uid);
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  if (request.data?.confirm !== "DELETE") {
    throw new HttpsError("invalid-argument", "Confirmation required.");
  }

  const db = admin.firestore();
  await deleteQueryInBatches(db.collection("collections").where("ownerUid", "==", uid));
  // after plan 08 lands: await deleteQueryInBatches(db.collection("publicTradeLists").where("ownerUid", "==", uid));
  await db.collection("userPreferences").doc(uid).delete();
  await db.collection("rateLimits").doc(uid).delete(); // harmless if missing
  await admin.auth().deleteUser(uid);
  return { deleted: true };
}

const deleteMyAccount = onCall({ maxInstances: 2 }, deleteMyAccountHandler);

module.exports = {
  deleteMyAccount,
  deleteQueryInBatches,
  deleteMyAccountHandler,
  __test: {
    deleteQueryInBatches,
    deleteMyAccountHandler,
    uidOrEmpty,
  },
};
