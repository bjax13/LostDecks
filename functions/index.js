const admin = require("firebase-admin");
const { HttpsError, onCall } = require("firebase-functions/v2/https");
const {
  buildMatchesForCaller,
  buildUserSkuTotals,
  DEFAULT_MATCH_PAGE_SIZE,
  normalizeMatchCursor,
  normalizeMatchPageSize,
  paginateMatches,
  resolveMatchContact,
} = require("./matches");

const MATCH_PAIR_LIMIT = 100;

if (!admin.apps.length) {
  admin.initializeApp();
}

async function resolveAuthProfiles(userIds) {
  if (!userIds.length) {
    return new Map();
  }

  const auth = admin.auth();
  const profilesByUserId = new Map();

  for (let index = 0; index < userIds.length; index += 100) {
    const batchIds = userIds.slice(index, index + 100);
    const result = await auth.getUsers(batchIds.map((uid) => ({ uid })));
    for (const user of result.users) {
      const uid = uidOrEmpty(user.uid);
      profilesByUserId.set(uid, {
        displayName: user.displayName || user.email || user.uid,
        email: typeof user.email === "string" ? user.email : "",
      });
    }
  }

  return profilesByUserId;
}

async function loadPreferencesByUserId(db, userIds) {
  const preferencesByUserId = new Map();
  if (!userIds.length) {
    return preferencesByUserId;
  }

  const refs = userIds.map((userId) => db.collection("userPreferences").doc(userId));
  const snapshots = await db.getAll(...refs);
  for (const snapshot of snapshots) {
    preferencesByUserId.set(snapshot.id, snapshot.exists ? snapshot.data() : {});
  }

  return preferencesByUserId;
}

function uidOrEmpty(value) {
  return typeof value === "string" ? value : "";
}

exports.getTradeMatches = onCall(async (request) => {
  const callerUid = uidOrEmpty(request.auth?.uid);
  if (!callerUid) {
    throw new HttpsError("unauthenticated", "You must be signed in to view trade matches.");
  }

  const pageSize = normalizeMatchPageSize(request.data?.pageSize, {
    defaultSize: DEFAULT_MATCH_PAGE_SIZE,
  });
  const cursor = normalizeMatchCursor(request.data?.cursor);

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
      pageSize,
      nextCursor: null,
      hasMore: false,
      totalOnPage: 0,
    };
  }

  const page = paginateMatches(matches, { pageSize, cursor });
  const counterpartyIds = page.matches.map((match) => match.userId);
  const [profilesByUserId, preferencesByUserId] = await Promise.all([
    resolveAuthProfiles(counterpartyIds),
    loadPreferencesByUserId(db, counterpartyIds),
  ]);

  const payload = page.matches.map((match) => {
    const profile = profilesByUserId.get(match.userId) || {
      displayName: match.userId,
      email: "",
    };
    const contact = resolveMatchContact({
      preferences: preferencesByUserId.get(match.userId) || {},
      trueEmail: profile.email,
    });

    return {
      userId: match.userId,
      displayName: profile.displayName,
      pairs: match.pairs,
      contact,
    };
  });

  return {
    callerOptedOut: false,
    matches: payload,
    pageSize: page.pageSize,
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
    totalOnPage: page.totalOnPage,
  };
});

exports.__test = {
  MATCH_PAIR_LIMIT,
  loadPreferencesByUserId,
  resolveAuthProfiles,
  resolveMatchContact,
};
