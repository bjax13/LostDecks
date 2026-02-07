import { useEffect, useMemo, useState } from 'react';
import { collection, onSnapshot, orderBy, query, where } from 'firebase/firestore';
import { db } from '../../../firebaseClient';

export default function useMyTrades(uid) {
  const [trades, setTrades] = useState([]);
  const [loading, setLoading] = useState(Boolean(uid));
  const [error, setError] = useState(null);

  const q = useMemo(() => {
    if (!uid) return null;
    return query(
      collection(db, 'trades'),
      where('participants', 'array-contains', uid),
      orderBy('createdAt', 'desc'),
    );
  }, [uid]);

  useEffect(() => {
    if (!q) {
      setTrades([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const unsub = onSnapshot(
      q,
      (snap) => {
        setTrades(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load trades', err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsub();
  }, [q]);

  return { trades, loading, error };
}
