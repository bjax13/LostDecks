import { httpsCallable } from "firebase/functions";
import { useCallback, useEffect, useMemo, useState } from "react";
import { functions } from "../../../lib/firebase";

function normalizeMatchRows(rawMatches) {
  if (!Array.isArray(rawMatches)) {
    return [];
  }

  return rawMatches
    .map((entry) => ({
      userId: typeof entry?.userId === "string" ? entry.userId : "",
      displayName:
        typeof entry?.displayName === "string" && entry.displayName.trim()
          ? entry.displayName.trim()
          : "Unknown collector",
      pairs: Array.isArray(entry?.pairs)
        ? entry.pairs
            .map((pair) => ({
              theirSkuId: typeof pair?.theirSkuId === "string" ? pair.theirSkuId : "",
              yourSkuId: typeof pair?.yourSkuId === "string" ? pair.yourSkuId : "",
            }))
            .filter((pair) => pair.theirSkuId && pair.yourSkuId)
        : [],
    }))
    .filter((entry) => entry.userId && entry.pairs.length > 0);
}

export function useTradeMatches(enabled) {
  const [loading, setLoading] = useState(Boolean(enabled));
  const [error, setError] = useState(null);
  const [callerOptedOut, setCallerOptedOut] = useState(false);
  const [matches, setMatches] = useState([]);
  const [refreshToken, setRefreshToken] = useState(0);

  const fetchMatches = useMemo(() => {
    if (!functions) {
      return null;
    }
    return httpsCallable(functions, "getTradeMatches");
  }, []);

  const reload = useCallback(() => {
    setRefreshToken((value) => value + 1);
  }, []);

  useEffect(() => {
    if (!enabled) {
      setMatches([]);
      setCallerOptedOut(false);
      setLoading(false);
      setError(null);
      return;
    }

    if (!fetchMatches) {
      setMatches([]);
      setCallerOptedOut(false);
      setLoading(false);
      setError(new Error("Cloud Functions is not configured."));
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchMatches({ refreshToken })
      .then((response) => {
        if (cancelled) {
          return;
        }
        const data = response?.data ?? {};
        setCallerOptedOut(Boolean(data.callerOptedOut));
        setMatches(normalizeMatchRows(data.matches));
        setLoading(false);
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        console.error("Failed to load trade matches", err);
        setCallerOptedOut(false);
        setMatches([]);
        setError(err);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, fetchMatches, refreshToken]);

  return {
    callerOptedOut,
    error,
    loading,
    matches,
    reload,
  };
}
