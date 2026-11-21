import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { getSkuIdsForCollectible } from "../../../data/collectibles";
import { db } from "../../../lib/firebase";

const initialState = {
  entry: null,
  entries: [],
  loading: true,
  error: null,
};

function queryForSkuIds(collectionRef, ownerUid, skuIds) {
  if (skuIds.length === 1) {
    return query(collectionRef, where("ownerUid", "==", ownerUid), where("skuId", "==", skuIds[0]));
  }
  return query(collectionRef, where("ownerUid", "==", ownerUid), where("skuId", "in", skuIds));
}

export function useCollectibleCollectionEntry(ownerUid, collectibleId, skuId) {
  const [entry, setEntry] = useState(initialState.entry);
  const [entries, setEntries] = useState(initialState.entries);
  const [loading, setLoading] = useState(initialState.loading);
  const [error, setError] = useState(initialState.error);

  useEffect(() => {
    if (!ownerUid || (!collectibleId && !skuId)) {
      setEntry(null);
      setEntries([]);
      setLoading(false);
      setError(null);
      return undefined;
    }

    setLoading(true);
    setError(null);

    const collectionRef = collection(db, "collections");

    let collectionQuery;
    const finishSkuIds = collectibleId ? getSkuIdsForCollectible(collectibleId) : [];

    if (collectibleId && finishSkuIds.length > 0) {
      collectionQuery = queryForSkuIds(collectionRef, ownerUid, finishSkuIds);
    } else if (skuId) {
      collectionQuery = query(
        collectionRef,
        where("ownerUid", "==", ownerUid),
        where("skuId", "==", skuId),
      );
    } else if (collectibleId) {
      setEntry(null);
      setEntries([]);
      setLoading(false);
      return undefined;
    } else {
      setEntry(null);
      setEntries([]);
      setLoading(false);
      return undefined;
    }

    const unsubscribe = onSnapshot(
      collectionQuery,
      (snapshot) => {
        const docs = snapshot.docs.map((d) => ({ id: d.id, ...d.data() }));
        const matchedEntry = skuId
          ? (docs.find((e) => e.skuId === skuId) ?? docs[0] ?? null)
          : (docs[0] ?? null);

        setEntries(docs);
        setEntry(matchedEntry);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load collection entry", err);
        setError(err);
        setEntries([]);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [ownerUid, collectibleId, skuId]);

  return { entry, entries, loading, error };
}
