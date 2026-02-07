import {
  collection,
  addDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
  onSnapshot,
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
