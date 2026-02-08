import { useEffect, useMemo, useState } from 'react';
import { subscribeOpenListings } from '../../../lib/marketplace/listings';

export default function useOpenListings({ cardId } = {}) {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const params = useMemo(() => ({ cardId: cardId || undefined }), [cardId]);

  useEffect(() => {
    setLoading(true);
    setError(null);

    const unsubscribe = subscribeOpenListings(
      params,
      (snapshot) => {
        const next = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        setListings(next);
        setLoading(false);
      },
      (err) => {
        console.error('Failed to load open listings', err);
        setError(err);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [params]);

  return { listings, loading, error };
}
