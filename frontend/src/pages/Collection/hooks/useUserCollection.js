import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useState } from "react";
import { db } from "../../../lib/firebase";

const initialState = {
  entries: [],
  loading: true,
  error: null,
  snapshotUid: null,
};

export function useUserCollection(ownerUid) {
  const [entries, setEntries] = useState(initialState.entries);
  const [loading, setLoading] = useState(initialState.loading);
  const [error, setError] = useState(initialState.error);
  const [snapshotUid, setSnapshotUid] = useState(initialState.snapshotUid);

  useEffect(() => {
    if (!ownerUid) {
      setEntries([]);
      setLoading(false);
      setError(null);
      setSnapshotUid(null);
      return undefined;
    }

    setLoading(true);
    setError(null);
    setSnapshotUid(null);

    const collectionRef = collection(db, "collections");
    const collectionQuery = query(collectionRef, where("ownerUid", "==", ownerUid));

    const unsubscribe = onSnapshot(
      collectionQuery,
      (snapshot) => {
        const nextEntries = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data(),
        }));
        setEntries(nextEntries);
        setSnapshotUid(ownerUid);
        setLoading(false);
      },
      (err) => {
        console.error("Failed to load collection entries", err);
        setError(err);
        setSnapshotUid(ownerUid);
        setLoading(false);
      },
    );

    return () => unsubscribe();
  }, [ownerUid]);

  const ready = !ownerUid || (snapshotUid === ownerUid && !loading);

  return { entries, loading, error, ready };
}
