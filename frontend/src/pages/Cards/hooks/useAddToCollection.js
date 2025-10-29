import { useCallback, useState } from 'react';
import { addDoc, collection, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAuth } from '../../../contexts/AuthContext';

const COLLECTIONS_PATH = 'collections';

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
        const payload = {
          ownerUid: user.uid,
          cardId: card.id,
          quantity,
          finish: finish ?? null,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
          source: 'cards-page',
        };

        if (card.displayName) {
          payload.displayName = card.displayName;
        }
        if (card.storyTitle) {
          payload.storyTitle = card.storyTitle;
        }
        if (card.category) {
          payload.category = card.category;
        }

        await addDoc(collection(db, COLLECTIONS_PATH), payload);
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
