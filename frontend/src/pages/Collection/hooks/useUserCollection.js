import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { db } from "../../../lib/firebase";

/** @typedef {'idle' | 'loading' | 'ready' | 'error'} UserCollectionStatus */

/**
 * @param {string | null | undefined} ownerUid
 * @returns {{ entries: object[]; status: UserCollectionStatus; error: Error | null }}
 */
function createInitialState(ownerUid) {
  if (!ownerUid) {
    return { entries: [], status: "idle", error: null };
  }
  return { entries: [], status: "loading", error: null };
}

export function useUserCollection(ownerUid) {
  const subscribedOwnerUidRef = useRef(/** @type {string | null} */ (null));
  const [{ entries, status, error }, setState] = useState(() => createInitialState(ownerUid));

  useEffect(() => {
    if (!ownerUid) {
      subscribedOwnerUidRef.current = null;
      setState({ entries: [], status: "idle", error: null });
      return undefined;
    }

    const ownerChanged = subscribedOwnerUidRef.current !== ownerUid;
    subscribedOwnerUidRef.current = ownerUid;

    if (ownerChanged) {
      setState({ entries: [], status: "loading", error: null });
    }

    const collectionRef = collection(db, "collections");
    const collectionQuery = query(collectionRef, where("ownerUid", "==", ownerUid));

    const unsubscribe = onSnapshot(
      collectionQuery,
      (snapshot) => {
        const nextEntries = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));
        setState({ entries: nextEntries, status: "ready", error: null });
      },
      (err) => {
        console.error("Failed to load collection entries", err);
        setState((previous) => ({
          entries: previous.entries,
          status: "error",
          error: err,
        }));
      },
    );

    return () => unsubscribe();
  }, [ownerUid]);

  return { entries, status, error };
}
