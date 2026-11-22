import { createElement, useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { clearPendingPicks, loadPendingPicks, mergePickRows } from "../lib/pendingPicks.js";
import { useUserCollection } from "../pages/Collection/hooks/useUserCollection";
import { applyBulkCollectionUpdate } from "../pages/Collection/utils/bulkImport";

/** @internal Visible to tests */
export const PENDING_PICKS_APPLY_MAX_ATTEMPTS = 3;
/** @internal Visible to tests */
export const PENDING_PICKS_RETRY_BACKOFF_MS = [400, 1200];

const APPLY_FAILURE_MESSAGE =
  "We couldn't save your QR pin picks after a few tries. They're still saved on this device—open Collection to import them.";

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * After sign-in/sign-up, apply any QR pending pin picks exactly once and land on Matches.
 * @returns {{ applyFailure: string | null }}
 */
export function useApplyPendingPicks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { entries, status } = useUserCollection(user?.uid ?? null);
  const collectionReady = status === "ready";
  const appliedRef = useRef(false);
  const [applyFailure, setApplyFailure] = useState(null);

  useEffect(() => {
    if (!user?.uid || !collectionReady || appliedRef.current) {
      return undefined;
    }

    const pending = loadPendingPicks();
    if (!pending) {
      return undefined;
    }

    appliedRef.current = true;
    setApplyFailure(null);
    let cancelled = false;

    (async () => {
      for (let attempt = 0; attempt < PENDING_PICKS_APPLY_MAX_ATTEMPTS; attempt += 1) {
        if (cancelled) {
          return;
        }
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
          if (cancelled) {
            return;
          }
          clearPendingPicks();
          navigate("/matches?welcome=1", { replace: true });
          return;
        } catch (error) {
          console.error("Failed to apply pending pin picks", error);
          const isLastAttempt = attempt >= PENDING_PICKS_APPLY_MAX_ATTEMPTS - 1;
          if (isLastAttempt) {
            setApplyFailure(APPLY_FAILURE_MESSAGE);
            return;
          }
          const backoffMs =
            PENDING_PICKS_RETRY_BACKOFF_MS[attempt] ??
            PENDING_PICKS_RETRY_BACKOFF_MS[PENDING_PICKS_RETRY_BACKOFF_MS.length - 1];
          await sleep(backoffMs);
        }
      }
    })();

    return () => {
      cancelled = true;
      appliedRef.current = false;
    };
  }, [user?.uid, collectionReady, entries, navigate]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: reset apply latch when signed-in user changes
  useEffect(() => {
    appliedRef.current = false;
    setApplyFailure(null);
  }, [user?.uid]);

  return { applyFailure };
}

export function PendingPicksApplier() {
  const { applyFailure } = useApplyPendingPicks();
  if (!applyFailure) {
    return null;
  }
  return createElement(
    "p",
    { className: "pending-picks-applier__alert", role: "alert" },
    applyFailure,
  );
}