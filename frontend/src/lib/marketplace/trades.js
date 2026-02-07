import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseClient';

export const TRADES_PATH = 'trades';

export async function createTrade({
  listingId,
  cardId,
  type,
  priceCents,
  currency = 'USD',
  quantity = 1,
  buyerUid,
  buyerDisplayName,
  sellerUid,
  sellerDisplayName,
}) {
  if (!listingId || !cardId || !type) throw new Error('Missing trade fields');
  if (!buyerUid || !sellerUid) throw new Error('Missing buyer/seller');

  const payload = {
    listingId,
    cardId,
    type,
    priceCents,
    currency,
    quantity,
    buyerUid,
    buyerDisplayName: buyerDisplayName || 'Anonymous',
    sellerUid,
    sellerDisplayName: sellerDisplayName || 'Anonymous',
    status: 'PENDING',
    createdAt: serverTimestamp(),
  };

  return addDoc(collection(db, TRADES_PATH), payload);
}
