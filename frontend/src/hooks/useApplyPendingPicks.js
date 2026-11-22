import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { clearPendingPicks, loadPendingPicks, mergePickRows } from "../lib/pendingPicks.js";
import { useUserCollection } from "../pages/Collection/hooks/useUserCollection";
import { applyBulkCollectionUpdate } from "../pages/Collection/utils/bulkImport";

/**
 * After sign-in/sign-up, apply any QR pending pin picks exactly once and land on Matches.
 */
export function useApplyPendingPicks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { entries, ready } = useUserCollection(user?.uid ?? null);
  const appliedRef = useRef(false);
  const [retryToken, setRetryToken] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: retryToken retriggers apply after failure
  useEffect(() => {
    if (!user?.uid || !ready || appliedRef.current) {
      return undefined;
    }

    const pending = loadPendingPicks();
    if (!pending) {
      return undefined;
    }

    appliedRef.current = true;
    let cancelled = false;

    (async () => {
      try {
        const rows = mergePickRows(pending.quantities, entries);
        if (rows.length > 0) {
          await applyBulkCollectionUpdate({
            ownerUid: user.uid,
            rows,
            existingEntries: entries,
            allowPins: true,
          });
        }
        if (cancelled) return;
        clearPendingPicks();
        navigate("/matches?welcome=1", { replace: true });
      } catch (error) {
        console.error("Failed to apply pending pin picks", error);
        appliedRef.current = false;
        setRetryToken((token) => token + 1);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [user?.uid, ready, entries, navigate, retryToken]);
}

export function PendingPicksApplier() {
  useApplyPendingPicks();
  return null;
}
