import {
  collection,
  addDoc,
  doc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
  runTransaction,
} from 'firebase/firestore';
import { httpsCallable } from 'firebase/functions';

import { db, functions } from '../firebase';

export const LISTINGS_PATH = 'listings';

export function subscribeOpenListings({ cardId } = {}, onNext, onError) {
  const base = collection(db, LISTINGS_PATH);
  const constraints = [where('status', '==', 'OPEN'), orderBy('createdAt', 'desc')];
  if (cardId) {
    constraints.unshift(where('cardId', '==', cardId));
  }
  const q = query(base, ...constraints);
  return onSnapshot(q, onNext, onError);
}

export async function cancelListing({ listingId, cancelledByUid }) {
  if (!listingId || !cancelledByUid) {
    throw new Error('Missing required cancel fields');
  }

  const listingRef = doc(db, LISTINGS_PATH, listingId);

  return runTransaction(db, async (tx) => {
    const snap = await tx.get(listingRef);
    if (!snap.exists()) {
      throw new Error('Listing not found');
    }
    const listing = snap.data();
    if (listing.status !== 'OPEN') {
      throw new Error('Listing is not open');
    }
    if (listing.createdByUid !== cancelledByUid) {
      throw new Error('Only the creator can cancel this listing');
    }

    tx.update(listingRef, {
      status: 'CANCELLED',
      updatedAt: serverTimestamp(),
    });

    return { id: snap.id, ...listing };
  });
}

export async function acceptListing({ listingId }) {
  if (!listingId) {
    throw new Error('listingId is required');
  }

  const call = httpsCallable(functions, 'acceptListing');
  const res = await call({ listingId });
  return res.data;
}

export async function updateListing({ listingId, type, cardId, priceCents }) {
  if (!listingId) {
    throw new Error('listingId is required');
  }
  if (type !== 'BID' && type !== 'ASK') {
    throw new Error('type must be BID or ASK');
  }
  if (!cardId) {
    throw new Error('cardId is required');
  }
  if (typeof priceCents !== 'number' || !Number.isFinite(priceCents) || priceCents <= 0) {
    throw new Error('priceCents must be a positive number');
  }

  const call = httpsCallable(functions, 'updateListing');
  const res = await call({ listingId, type, cardId, priceCents });
  return res.data;
}

export async function createListing({
  type,
  cardId,
  priceCents,
  currency = 'USD',
  quantity = 1,
  createdByUid,
  createdByDisplayName,
}) {
  if (!type || !cardId || !createdByUid) {
    throw new Error('Missing required listing fields');
  }

  const payload = {
    type,
    status: 'OPEN',
    cardId,
    priceCents,
    currency,
    quantity,
    createdByUid,
    createdByDisplayName: createdByDisplayName || 'Anonymous',
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };

  return addDoc(collection(db, LISTINGS_PATH), payload);
}
