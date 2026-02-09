import { useCallback, useState } from 'react';
import {
  addDoc,
  collection,
  doc,
  getDocs,
  increment,
  limit,
  query,
  serverTimestamp,
  updateDoc,
  where,
} from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';
import { datasetSkus } from '../../../data/cards';

const COLLECTIONS_PATH = 'collections';

function resolveSkuId({ cardId, finish }) {
  if (!cardId || !finish) {
    return null;
  }

  const normalizedCardId = String(cardId).toUpperCase();
  const normalizedFinish = String(finish).toUpperCase();

  const match = (datasetSkus ?? []).find(
    (sku) =>
      String(sku.cardId).toUpperCase() === normalizedCardId &&
      String(sku.finish).toUpperCase() === normalizedFinish,
  );

  return match?.skuId ? String(match.skuId).toUpperCase() : null;
}

export function useAddToCollection() {
  const { user } = useAuth();
  const [status, setStatus] = useState('idle');
  const [error, setError] = useState(null);

  const addToCollection = useCallback(
    async ({ card, finish = null, quantity = 1 }) => {
      if (!card || !card.id) {
        throw new Error('A valid card is required to add to the collection.');
      }

      if (!user) {
        const authError = new Error('Authentication required');
        authError.code = 'auth-required';
        throw authError;
      }

      setStatus('loading');
      setError(null);

      try {
        const normalizedFinish = finish ? String(finish).toUpperCase() : null;
        const skuId = resolveSkuId({ cardId: card.id, finish: normalizedFinish });

        const payload = {
          ownerUid: user.uid,
          cardId: card.id,
          quantity,
          updatedAt: serverTimestamp(),
        };

        if (skuId) {
          payload.skuId = skuId;
        }

        // Only include finish if it has a value (matching bulkImport.js pattern)
        if (normalizedFinish) {
          payload.finish = normalizedFinish;
        }

        if (card.displayName) {
          payload.displayName = card.displayName;
        }
        if (card.storyTitle) {
          payload.storyTitle = card.storyTitle;
        }
        if (card.category) {
          payload.category = card.category;
        }

        const collectionsRef = collection(db, COLLECTIONS_PATH);

        // If the entry already exists, increment its quantity instead of creating duplicates.
        const existingQuery = skuId
          ? query(
              collectionsRef,
              where('ownerUid', '==', user.uid),
              where('skuId', '==', skuId),
              limit(1),
            )
          : normalizedFinish
            ? query(
                collectionsRef,
                where('ownerUid', '==', user.uid),
                where('cardId', '==', card.id),
                where('finish', '==', normalizedFinish),
                limit(1),
              )
            : query(
                collectionsRef,
                where('ownerUid', '==', user.uid),
                where('cardId', '==', card.id),
                limit(1),
              );

        const existingSnapshot = await getDocs(existingQuery);
        const existingDoc = existingSnapshot.docs[0] ?? null;

        if (existingDoc) {
          const ref = doc(collectionsRef, existingDoc.id);
          await updateDoc(ref, {
            quantity: increment(quantity),
            updatedAt: serverTimestamp(),
            ...(payload.finish ? { finish: payload.finish } : {}),
            ...(payload.skuId ? { skuId: payload.skuId } : {}),
            ...(payload.displayName ? { displayName: payload.displayName } : {}),
            ...(payload.storyTitle ? { storyTitle: payload.storyTitle } : {}),
            ...(payload.category ? { category: payload.category } : {}),
          });

          setStatus('success');
          return { id: existingDoc.id, ...payload };
        }

        await addDoc(collectionsRef, payload);
        setStatus('success');
        return payload;
      } catch (err) {
        console.error('Failed to add card to collection', err);
        setError(err);
        setStatus('error');
        throw err;
      }
    },
    [user],
  );

  const reset = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  return {
    addToCollection,
    status,
    error,
    user,
    reset,
  };
}
