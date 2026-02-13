import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { getFinishesForCard, toSkuId } from '../../../data/collectibles';

const initialState = {
  entry: null,
  loading: true,
  error: null,
};

export function useCollectibleCollectionEntry(ownerUid, collectibleId, skuId) {
  const [entry, setEntry] = useState(initialState.entry);
  const [loading, setLoading] = useState(initialState.loading);
  const [error, setError] = useState(initialState.error);

  useEffect(() => {
    if (!ownerUid || (!collectibleId && !skuId)) {
      setEntry(null);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const collectionRef = collection(db, 'collections');

    let collectionQuery;

    if (skuId) {
      collectionQuery = query(
        collectionRef,
        where('ownerUid', '==', ownerUid),
        where('skuId', '==', skuId),
      );
    } else if (collectibleId) {
      const finishes = getFinishesForCard(collectibleId);
      const skuIds = finishes.map((f) => toSkuId(collectibleId, f));
      if (skuIds.length === 0) {
        setEntry(null);
        setLoading(false);
        return undefined;
      }
      if (skuIds.length === 1) {
        collectionQuery = query(
          collectionRef,
          where('ownerUid', '==', ownerUid),
          where('skuId', '==', skuIds[0]),
        );
      } else {
        collectionQuery = query(
          collectionRef,
          where('ownerUid', '==', ownerUid),
          where('skuId', 'in', skuIds),
        );
      }
    } else {
      setEntry(null);
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collectionQuery,
      (snapshot) => {
        let matchedEntry = null;
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));

        if (skuId) {
          matchedEntry = docs.find((e) => e.skuId === skuId) ?? docs[0] ?? null;
        } else {
          matchedEntry = docs[0] ?? null;
        }

        setEntry(matchedEntry);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load collection entry', err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [ownerUid, collectibleId, skuId]);

  return { entry, loading, error };
}
