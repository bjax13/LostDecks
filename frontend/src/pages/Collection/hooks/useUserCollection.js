import { collection, onSnapshot, query, where } from "firebase/firestore";
import { useEffect, useRef, useState } from "react";
import { db } from "../../../lib/firebase";

/** @typedef {'idle' | 'loading' | 'ready' | 'error'} UserCollectionStatus */

/**
 * @param {string | null | undefined} ownerUid
 * @returns {{ entries: object[]; status: UserCollectionStatus; error: Error | null; serverConfirmed: boolean }}
 */
function createInitialState(ownerUid) {
  if (!ownerUid) {
    return { entries: [], status: "idle", error: null, serverConfirmed: false };
  }
  return { entries: [], status: "loading", error: null, serverConfirmed: false };
}

export function useUserCollection(ownerUid) {
  const subscribedOwnerUidRef = useRef(/** @type {string | null} */ (null));
  const [{ entries, status, error, serverConfirmed }, setState] = useState(() =>
    createInitialState(ownerUid),
  );

  useEffect(() => {
    if (!ownerUid) {
      subscribedOwnerUidRef.current = null;
      setState({ entries: [], status: "idle", error: null, serverConfirmed: false });
      return undefined;
    }

    const ownerChanged = subscribedOwnerUidRef.current !== ownerUid;
    subscribedOwnerUidRef.current = ownerUid;

    if (ownerChanged) {
      setState({ entries: [], status: "loading", error: null, serverConfirmed: false });
    }

    const collectionRef = collection(db, "collections");
    const collectionQuery = query(collectionRef, where("ownerUid", "==", ownerUid));

    const unsubscribe = onSnapshot(
      collectionQuery,
      { includeMetadataChanges: true },
      (snapshot) => {
        const nextEntries = snapshot.docs.map((doc) => ({
          ...doc.data(),
          id: doc.id,
        }));
        const fromServer = snapshot.metadata?.fromCache === false;
        setState((previous) => ({
          entries: nextEntries,
          status: "ready",
          error: null,
          serverConfirmed: fromServer ? true : previous.serverConfirmed,
        }));
      },
      (err) => {
        console.error("Failed to load collection entries", err);
        setState((previous) => ({
          entries: previous.entries,
          status: "error",
          error: err,
          serverConfirmed: previous.serverConfirmed,
        }));
      },
    );

    return () => unsubscribe();
  }, [ownerUid]);

  return { entries, status, error, serverConfirmed };
}
