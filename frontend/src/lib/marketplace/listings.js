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

import { db } from '../../firebaseClient';

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

export async function acceptListing({ listingId, acceptedByUid, acceptedByDisplayName }) {
  if (!listingId || !acceptedByUid) {
    throw new Error('Missing required accept fields');
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
    if (listing.createdByUid === acceptedByUid) {
      throw new Error('Cannot accept your own listing');
    }

    tx.update(listingRef, {
      status: 'ACCEPTED',
      acceptedByUid,
      acceptedByDisplayName: acceptedByDisplayName || 'Anonymous',
      acceptedAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    return { id: snap.id, ...listing };
  });
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
