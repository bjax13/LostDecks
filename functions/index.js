const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function asInt(value, field) {
  if (typeof value !== 'number' || !Number.isFinite(value) || Math.floor(value) !== value) {
    throw new HttpsError('invalid-argument', `${field} must be an integer`);
  }
  return value;
}

exports.acceptListing = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in to accept a listing');
  }

  const { listingId } = request.data || {};
  if (typeof listingId !== 'string' || listingId.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'listingId is required');
  }

  const acceptedByUid = auth.uid;
  const acceptedByDisplayName =
    (auth.token && (auth.token.name || auth.token.email)) || request.data?.acceptedByDisplayName || 'Anonymous';

  const listingRef = db.collection('listings').doc(listingId);
  const tradeRef = db.collection('trades').doc();

  const result = await db.runTransaction(async (tx) => {
    const snap = await tx.get(listingRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Listing not found');
    }

    const listing = snap.data();
    if (listing.status !== 'OPEN') {
      throw new HttpsError('failed-precondition', 'Listing is not open');
    }
    if (listing.createdByUid === acceptedByUid) {
      throw new HttpsError('failed-precondition', 'Cannot accept your own listing');
    }

    if (listing.currency !== 'USD') {
      throw new HttpsError('failed-precondition', 'Unsupported currency');
    }

    // MVP constraints (keep things simple + consistent)
    asInt(listing.priceCents, 'priceCents');

    const listingType = listing.type;
    if (listingType !== 'BID' && listingType !== 'ASK') {
      throw new HttpsError('failed-precondition', 'Invalid listing type');
    }

    const creatorUid = listing.createdByUid;
    const creatorName = listing.createdByDisplayName || 'Anonymous';

    const buyerUid = listingType === 'ASK' ? acceptedByUid : creatorUid;
    const buyerDisplayName = listingType === 'ASK' ? acceptedByDisplayName : creatorName;
    const sellerUid = listingType === 'ASK' ? creatorUid : acceptedByUid;
    const sellerDisplayName = listingType === 'ASK' ? creatorName : acceptedByDisplayName;

    const now = admin.firestore.FieldValue.serverTimestamp();

    tx.update(listingRef, {
      status: 'ACCEPTED',
      acceptedByUid,
      acceptedByDisplayName,
      acceptedAt: now,
      updatedAt: now,
    });

    tx.set(tradeRef, {
      listingId,
      cardId: listing.cardId,
      cardDisplayName: listing.cardDisplayName || null,
      type: listingType,
      priceCents: listing.priceCents,
      currency: 'USD',
      quantity: 1,
      buyerUid,
      buyerDisplayName,
      sellerUid,
      sellerDisplayName,
      participants: [buyerUid, sellerUid],
      status: 'PENDING',
      createdAt: now,
    });

    return { tradeId: tradeRef.id };
  });

  return { ok: true, ...result };
});
