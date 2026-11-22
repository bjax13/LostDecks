import { useCallback, useMemo, useState } from "react";
import {
  buildShareDocument,
  enablePublicShare,
  generateShareId,
  refreshPublicShare,
  revokePublicShare,
} from "../lib/tradeShares.js";

export function useTradeShare({
  userId,
  entries,
  matchKeep,
  displayName,
  discordHandle,
  region,
  publicShareId,
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(null);

  const payload = useMemo(
    () =>
      buildShareDocument({
        ownerUid: userId,
        displayName,
        entries,
        matchKeep,
        discordHandle,
        region,
      }),
    [userId, displayName, entries, matchKeep, discordHandle, region],
  );

  const enableShare = useCallback(async () => {
    if (!userId) {
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      const shareId = publicShareId || generateShareId();
      if (publicShareId) {
        await refreshPublicShare({ userId, shareId, payload });
      } else {
        await enablePublicShare({ userId, shareId, payload });
      }
      return shareId;
    } catch (err) {
      console.error("Failed to enable public share", err);
      setError(err);
      throw err;
    } finally {
      setBusy(false);
    }
  }, [userId, publicShareId, payload]);

  const refreshShare = useCallback(async () => {
    if (!userId || !publicShareId) {
      return null;
    }
    setBusy(true);
    setError(null);
    try {
      await refreshPublicShare({ userId, shareId: publicShareId, payload });
      return publicShareId;
    } catch (err) {
      console.error("Failed to refresh public share", err);
      setError(err);
      throw err;
    } finally {
      setBusy(false);
    }
  }, [userId, publicShareId, payload]);

  const revokeShare = useCallback(async () => {
    if (!userId || !publicShareId) {
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await revokePublicShare({ userId, shareId: publicShareId });
    } catch (err) {
      console.error("Failed to revoke public share", err);
      setError(err);
      throw err;
    } finally {
      setBusy(false);
    }
  }, [userId, publicShareId]);

  return {
    busy,
    error,
    enableShare,
    refreshShare,
    revokeShare,
  };
}
