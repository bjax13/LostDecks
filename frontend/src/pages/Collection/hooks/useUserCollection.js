import { useEffect, useState } from 'react';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

const initialState = {
  entries: [],
  loading: true,
  error: null
};

export function useUserCollection(ownerUid) {
  const [entries, setEntries] = useState(initialState.entries);
  const [loading, setLoading] = useState(initialState.loading);
  const [error, setError] = useState(initialState.error);

  useEffect(() => {
    if (!ownerUid) {
      setEntries([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const collectionRef = collection(db, 'collections');
    const collectionQuery = query(collectionRef, where('ownerUid', '==', ownerUid));

    const unsubscribe = onSnapshot(
      collectionQuery,
      (snapshot) => {
        const nextEntries = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }));
        setEntries(nextEntries);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load collection entries', err);
        setError(err);
        setLoading(false);
      }
    );

    return () => unsubscribe();
  }, [ownerUid]);

  return { entries, loading, error };
}
