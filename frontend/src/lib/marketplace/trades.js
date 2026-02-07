import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../firebaseClient';

export const TRADES_PATH = 'trades';

export async function createTrade({
  listingId,
  cardId,
  cardDisplayName,
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
    cardDisplayName: cardDisplayName || null,
    type,
    priceCents,
    currency,
    quantity,
    buyerUid,
    buyerDisplayName: buyerDisplayName || 'Anonymous',
    sellerUid,
    sellerDisplayName: sellerDisplayName || 'Anonymous',
    participants: [buyerUid, sellerUid],
    status: 'PENDING',
    createdAt: serverTimestamp(),
  };

  return addDoc(collection(db, TRADES_PATH), payload);
}
