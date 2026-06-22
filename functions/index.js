const admin = require("firebase-admin");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const { buildMatchesForCaller, buildUserSkuTotals } = require("./matches");

const MATCH_PAIR_LIMIT = 100;

if (!admin.apps.length) {
  admin.initializeApp();
}

async function resolveDisplayNames(userIds) {
  if (!userIds.length) {
    return new Map();
  }

  const auth = admin.auth();
  const namesByUserId = new Map();

  for (let index = 0; index < userIds.length; index += 100) {
    const batchIds = userIds.slice(index, index + 100);
    const result = await auth.getUsers(batchIds.map((uid) => ({ uid })));
    for (const user of result.users) {
      namesByUserId.set(uidOrEmpty(user.uid), user.displayName || user.email || user.uid);
    }
  }

  return namesByUserId;
}

function uidOrEmpty(value) {
  return typeof value === "string" ? value : "";
}

exports.getTradeMatches = onCall(async (request) => {
  const callerUid = uidOrEmpty(request.auth?.uid);
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in to view trade matches.");
  }

  const db = admin.firestore();
  const [collectionsSnapshot, optedOutSnapshot] = await Promise.all([
    db.collection("collections").get(),
    db.collection("userPreferences").where("matchingOptOut", "==", true).get(),
  ]);

  const collectionDocs = collectionsSnapshot.docs.map((snapshot) => snapshot.data());
  const userSkuTotals = buildUserSkuTotals(collectionDocs);
  const optedOutUserIds = new Set(
    optedOutSnapshot.docs.map((snapshot) => uidOrEmpty(snapshot.id)).filter(Boolean),
  );

  const { isCallerOptedOut, matches } = buildMatchesForCaller({
    callerUid,
    userSkuTotals,
    optedOutUserIds,
    pairLimit: MATCH_PAIR_LIMIT,
  });

  if (isCallerOptedOut) {
    return {
      callerOptedOut: true,
      matches: [],
    };
  }

  const counterpartyIds = matches.map((match) => match.userId);
  const namesByUserId = await resolveDisplayNames(counterpartyIds);

  const payload = matches
    .map((match) => ({
      userId: match.userId,
      displayName: namesByUserId.get(match.userId) || match.userId,
      pairs: match.pairs,
    }))
    .sort((a, b) => a.displayName.localeCompare(b.displayName));

  return {
    callerOptedOut: false,
    matches: payload,
  };
});

exports.__test = {
  MATCH_PAIR_LIMIT,
};
