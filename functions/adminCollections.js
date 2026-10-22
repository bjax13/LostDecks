"use strict";

const admin = require("firebase-admin");
const { HttpsError } = require("firebase-functions/v2/https");
const { callerIsSiteAdmin } = require("./admins");
const { buildUserSkuTotals, laneForSkuId, resolvePublicDisplayName } = require("./matches");

function assertSiteAdmin(request) {
  const uid = typeof request?.auth?.uid === "string" ? request.auth.uid : "";
  if (!uid) {
    throw new HttpsError("unauthenticated", "You must be signed in.");
  }
  if (!callerIsSiteAdmin(request)) {
    throw new HttpsError("permission-denied", "Admin access is required.");
  }
}

function summarizeSkuTotals(skuTotals) {
  let totalQuantity = 0;
  let dunCount = 0;
  let foilCount = 0;

  for (const [skuId, quantity] of skuTotals) {
    totalQuantity += quantity;
    const lane = laneForSkuId(skuId);
    if (lane === "dun") {
      dunCount += 1;
    } else if (lane === "foil") {
      foilCount += 1;
    }
  }

  return {
    distinctItems: skuTotals.size,
    totalQuantity,
    dunCount,
    foilCount,
  };
}

function compareAdminUsers(a, b) {
  const byName = a.displayName.localeCompare(b.displayName, undefined, { sensitivity: "base" });
  if (byName !== 0) {
    return byName;
  }
  const byEmail = a.email.localeCompare(b.email, undefined, { sensitivity: "base" });
  if (byEmail !== 0) {
    return byEmail;
  }
  return a.uid.localeCompare(b.uid);
}

function buildAdminUserRows(authUsers, collectionDocs) {
  const totalsByOwner = buildUserSkuTotals(collectionDocs);
  const rows = [];

  for (const user of authUsers) {
    const uid = typeof user?.uid === "string" ? user.uid.trim() : "";
    if (!uid) {
      continue;
    }

    const skuTotals = totalsByOwner.get(uid) || new Map();
    rows.push({
      uid,
      displayName: resolvePublicDisplayName(user),
      email: typeof user.email === "string" ? user.email : "",
      ...summarizeSkuTotals(skuTotals),
    });
  }

  rows.sort(compareAdminUsers);
  return rows;
}

async function listAuthUsers() {
  const auth = admin.auth();
  const users = [];
  let pageToken;
  do {
    const page = await auth.listUsers(1000, pageToken);
    for (const user of page.users) {
      users.push({
        uid: user.uid,
        email: typeof user.email === "string" ? user.email : "",
        displayName: typeof user.displayName === "string" ? user.displayName : "",
      });
    }
    pageToken = page.pageToken;
  } while (pageToken);
  return users;
}

async function listCollectionDocs() {
  const snapshot = await admin
    .firestore()
    .collection("collections")
    .select("ownerUid", "skuId", "quantity")
    .get();
  return snapshot.docs.map((snapshotDoc) => snapshotDoc.data());
}

async function listAdminCollectorsHandler(request, deps = {}) {
  assertSiteAdmin(request);
  const loadUsers = deps.listAuthUsers || listAuthUsers;
  const loadCollections = deps.listCollectionDocs || listCollectionDocs;
  const [authUsers, collectionDocs] = await Promise.all([loadUsers(), loadCollections()]);
  return { users: buildAdminUserRows(authUsers, collectionDocs) };
}

module.exports = {
  assertSiteAdmin,
  buildAdminUserRows,
  listAdminCollectorsHandler,
  summarizeSkuTotals,
};
