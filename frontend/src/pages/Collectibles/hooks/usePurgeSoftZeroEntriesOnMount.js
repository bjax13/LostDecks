import { useEffect, useRef } from "react";
import { useCollectionQuantityMutations } from "./useCollectionQuantityMutations";

function isZeroQuantityEntry(entry) {
  const quantity =
    typeof entry?.quantity === "number" && Number.isFinite(entry.quantity)
      ? Math.max(0, Math.floor(entry.quantity))
      : 0;
  return quantity <= 0;
}

/**
 * Hard-delete soft-zero (quantity 0) collection docs once when a page mounts/reloads.
 * In-session decrements to 0 keep the docs so the UI can linger until navigation/refresh.
 */
export function usePurgeSoftZeroEntriesOnMount(ownerUid, entries, loading) {
  const { purgeZeroQuantityEntries } = useCollectionQuantityMutations();
  const hasPurgedZerosRef = useRef(false);

  useEffect(() => {
    if (!ownerUid || loading || hasPurgedZerosRef.current) {
      return undefined;
    }
    hasPurgedZerosRef.current = true;

    const zeroEntries = (Array.isArray(entries) ? entries : []).filter(isZeroQuantityEntry);
    if (zeroEntries.length === 0) {
      return undefined;
    }

    let cancelled = false;
    (async () => {
      try {
        await purgeZeroQuantityEntries(zeroEntries);
      } catch (err) {
        if (!cancelled) {
          console.error("Failed to purge zero-quantity collection entries", err);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [entries, loading, ownerUid, purgeZeroQuantityEntries]);
}
