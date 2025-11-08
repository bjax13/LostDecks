import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where, or } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

const initialState = {
  entry: null,
  loading: true,
  error: null
};

export function useCardCollectionEntry(ownerUid, cardId, skuId) {
  const [entry, setEntry] = useState(initialState.entry);
  const [loading, setLoading] = useState(initialState.loading);
  const [error, setError] = useState(initialState.error);

  useEffect(() => {
    if (!ownerUid || (!cardId && !skuId)) {
      setEntry(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const collectionRef = collection(db, 'collections');
    
    // Build query conditions: match ownerUid AND (cardId OR skuId)
    let collectionQuery;
    
    if (cardId && skuId) {
      // If both are provided, query for entries matching ownerUid AND (cardId OR skuId)
      collectionQuery = query(
        collectionRef,
        where('ownerUid', '==', ownerUid),
        or(
          where('cardId', '==', cardId),
          where('skuId', '==', skuId)
        )
      );
    } else if (cardId) {
      collectionQuery = query(
        collectionRef,
        where('ownerUid', '==', ownerUid),
        where('cardId', '==', cardId)
      );
    } else {
      collectionQuery = query(
        collectionRef,
        where('ownerUid', '==', ownerUid),
        where('skuId', '==', skuId)
      );
    }

    const unsubscribe = onSnapshot(
      collectionQuery,
      (snapshot) => {
        // Find the most specific match: prefer skuId match if skuId was provided, otherwise use first match
        let matchedEntry = null;
        
        if (skuId) {
          // Prefer exact skuId match
          matchedEntry = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .find((entry) => entry.skuId === skuId) || null;
        }
        
        // If no skuId match or no skuId provided, use first cardId match
        if (!matchedEntry && cardId) {
          matchedEntry = snapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .find((entry) => entry.cardId === cardId) || null;
        }
        
        // Fallback to first entry if no specific match
        if (!matchedEntry && snapshot.docs.length > 0) {
          matchedEntry = { id: snapshot.docs[0].id, ...snapshot.docs[0].data() };
        }

        setEntry(matchedEntry);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load collection entry', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [ownerUid, cardId, skuId]);

  return { entry, loading, error };
}

