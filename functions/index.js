const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');

const {
  assertListingType,
  assertPriceCents,
  assertUsdCurrency,
  assertQuantity,
  assertCardId,
} = require('./lib/marketplaceValidation');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function getDisplayNameFromAuth(auth) {
  return (auth.token && (auth.token.name || auth.token.email)) || auth.uid;
}

exports.createListing = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in to create a listing');
  }

  const { type, cardId, priceCents, currency = 'USD', quantity = 1 } = request.data || {};

  assertListingType(type);
  assertCardId(cardId);
  assertUsdCurrency(currency);
  assertPriceCents(priceCents);
  assertQuantity(quantity);

  const now = admin.firestore.FieldValue.serverTimestamp();

  const docRef = await db.collection('listings').add({
    type,
    status: 'OPEN',
    cardId,
    priceCents,
    currency: 'USD',
    quantity: 1,
    createdByUid: auth.uid,
    createdByDisplayName: getDisplayNameFromAuth(auth),
    createdAt: now,
    updatedAt: now,
  });

  return { ok: true, listingId: docRef.id };
});

exports.cancelListing = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in to cancel a listing');
  }

  const { listingId } = request.data || {};
  if (typeof listingId !== 'string' || listingId.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'listingId is required');
  }

  const listingRef = db.collection('listings').doc(listingId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(listingRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Listing not found');
    }

    const listing = snap.data();
    if (listing.status !== 'OPEN') {
      throw new HttpsError('failed-precondition', 'Listing is not open');
    }

    if (listing.createdByUid !== auth.uid) {
      throw new HttpsError('permission-denied', 'Only the creator can cancel this listing');
    }

    tx.update(listingRef, {
      status: 'CANCELLED',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});

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
  const acceptedByDisplayName = getDisplayNameFromAuth(auth);

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

    assertUsdCurrency(listing.currency);
    assertPriceCents(listing.priceCents);
    assertListingType(listing.type);

    const creatorUid = listing.createdByUid;
    const creatorName = listing.createdByDisplayName || 'Anonymous';

    const buyerUid = listing.type === 'ASK' ? acceptedByUid : creatorUid;
    const buyerDisplayName = listing.type === 'ASK' ? acceptedByDisplayName : creatorName;
    const sellerUid = listing.type === 'ASK' ? creatorUid : acceptedByUid;
    const sellerDisplayName = listing.type === 'ASK' ? creatorName : acceptedByDisplayName;

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
      type: listing.type,
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
      updatedAt: now,
    });

    return { tradeId: tradeRef.id };
  });

  return { ok: true, ...result };
});

exports.updateTradeStatus = onCall(async (request) => {
  const auth = request.auth;
  if (!auth) {
    throw new HttpsError('unauthenticated', 'Must be signed in');
  }

  const { tradeId, status } = request.data || {};
  if (typeof tradeId !== 'string' || tradeId.trim().length === 0) {
    throw new HttpsError('invalid-argument', 'tradeId is required');
  }

  const allowed = new Set(['COMPLETED', 'CANCELLED']);
  if (typeof status !== 'string' || !allowed.has(status)) {
    throw new HttpsError('invalid-argument', 'status must be COMPLETED or CANCELLED');
  }

  const tradeRef = db.collection('trades').doc(tradeId);

  await db.runTransaction(async (tx) => {
    const snap = await tx.get(tradeRef);
    if (!snap.exists) {
      throw new HttpsError('not-found', 'Trade not found');
    }

    const trade = snap.data();

    const participants = Array.isArray(trade.participants) ? trade.participants : [];
    if (!participants.includes(auth.uid)) {
      throw new HttpsError('permission-denied', 'Only trade participants can update status');
    }

    if (trade.status !== 'PENDING') {
      throw new HttpsError('failed-precondition', 'Trade is not pending');
    }

    tx.update(tradeRef, {
      status,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});
