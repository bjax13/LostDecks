import { httpsCallable } from "firebase/functions";
import { useCallback, useEffect, useMemo, useState } from "react";
import { functions } from "../../../lib/firebase";

export const MATCHES_CACHE_TTL_MS = 30_000;

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

export function getMatchesCacheKey(userId) {
  return `matches-cache:${userId}`;
}

export function readMatchesCache(userId) {
  if (!userId || typeof window === "undefined" || !window.sessionStorage) {
    return null;
  }

  try {
    const raw = window.sessionStorage.getItem(getMatchesCacheKey(userId));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (
      !parsed ||
      typeof parsed !== "object" ||
      typeof parsed.cachedAtMs !== "number" ||
      !Number.isFinite(parsed.cachedAtMs)
    ) {
      return null;
    }

    return {
      cachedAtMs: parsed.cachedAtMs,
      callerOptedOut: Boolean(parsed.callerOptedOut),
      matches: normalizeMatchRows(parsed.matches),
    };
  } catch {
    return null;
  }
}

export function writeMatchesCache(userId, payload) {
  if (!userId || typeof window === "undefined" || !window.sessionStorage) {
    return;
  }

  try {
    window.sessionStorage.setItem(
      getMatchesCacheKey(userId),
      JSON.stringify({
        cachedAtMs: payload.cachedAtMs,
        callerOptedOut: Boolean(payload.callerOptedOut),
        matches: normalizeMatchRows(payload.matches),
      }),
    );
  } catch {
    // Ignore storage write failures (quota / private mode).
  }
}

function getCacheAgeSeconds(cachedAtMs, nowMs) {
  if (typeof cachedAtMs !== "number" || !Number.isFinite(cachedAtMs)) {
    return null;
  }
  return Math.max(0, Math.floor((nowMs - cachedAtMs) / 1000));
}

function getRefreshAvailableInSeconds(cachedAtMs, nowMs) {
  if (typeof cachedAtMs !== "number" || !Number.isFinite(cachedAtMs)) {
    return 0;
  }
  const remainingMs = MATCHES_CACHE_TTL_MS - (nowMs - cachedAtMs);
  return Math.max(0, Math.ceil(remainingMs / 1000));
}

/**
 * @param {string | null | undefined} userId Firebase uid when signed in; falsy disables fetching.
 */
export function useTradeMatches(userId) {
  const enabled = Boolean(userId);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [callerOptedOut, setCallerOptedOut] = useState(false);
  const [matches, setMatches] = useState([]);
  const [cachedAtMs, setCachedAtMs] = useState(null);
  const [isUsingCachedResult, setIsUsingCachedResult] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [refreshToken, setRefreshToken] = useState(0);

  const fetchMatches = useMemo(() => {
    if (!functions) {
      return null;
    }
    return httpsCallable(functions, "getTradeMatches");
  }, []);

  const refreshAvailableInSeconds = useMemo(
    () => getRefreshAvailableInSeconds(cachedAtMs, nowMs),
    [cachedAtMs, nowMs],
  );
  const cacheAgeSeconds = useMemo(() => getCacheAgeSeconds(cachedAtMs, nowMs), [cachedAtMs, nowMs]);

  const reload = useCallback(() => {
    if (getRefreshAvailableInSeconds(cachedAtMs, Date.now()) > 0) {
      return;
    }
    setRefreshToken((value) => value + 1);
  }, [cachedAtMs]);

  useEffect(() => {
    if (!enabled || cachedAtMs == null) {
      return undefined;
    }

    const intervalId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [enabled, cachedAtMs]);

  useEffect(() => {
    if (!enabled || !userId) {
      setMatches([]);
      setCallerOptedOut(false);
      setCachedAtMs(null);
      setIsUsingCachedResult(false);
      setLoading(false);
      setError(null);
      return;
    }

    const now = Date.now();
    const cached = readMatchesCache(userId);
    const cacheIsFresh =
      cached &&
      typeof cached.cachedAtMs === "number" &&
      now - cached.cachedAtMs < MATCHES_CACHE_TTL_MS;

    // Prefer a fresh cache hit and skip the network call (covers remount/reload-spam).
    // reload() only bumps refreshToken after cooldown, so expired caches still refetch.
    const forceNetworkRefresh = refreshToken > 0;

    if (cacheIsFresh && !forceNetworkRefresh) {
      setCallerOptedOut(cached.callerOptedOut);
      setMatches(cached.matches);
      setCachedAtMs(cached.cachedAtMs);
      setIsUsingCachedResult(true);
      setNowMs(now);
      setLoading(false);
      setError(null);
      return;
    }

    if (!fetchMatches) {
      setMatches([]);
      setCallerOptedOut(false);
      setCachedAtMs(null);
      setIsUsingCachedResult(false);
      setLoading(false);
      setError(new Error("Cloud Functions is not configured."));
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setIsUsingCachedResult(false);

    fetchMatches({})
      .then((response) => {
        if (cancelled) {
          return;
        }
        const data = response?.data ?? {};
        const nextCallerOptedOut = Boolean(data.callerOptedOut);
        const nextMatches = normalizeMatchRows(data.matches);
        const fetchedAt = Date.now();

        setCallerOptedOut(nextCallerOptedOut);
        setMatches(nextMatches);
        setCachedAtMs(fetchedAt);
        setIsUsingCachedResult(false);
        setNowMs(fetchedAt);
        setLoading(false);

        writeMatchesCache(userId, {
          cachedAtMs: fetchedAt,
          callerOptedOut: nextCallerOptedOut,
          matches: nextMatches,
        });
      })
      .catch((err) => {
        if (cancelled) {
          return;
        }
        console.error("Failed to load trade matches", err);
        setCallerOptedOut(false);
        setMatches([]);
        setCachedAtMs(null);
        setIsUsingCachedResult(false);
        setError(err);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, fetchMatches, refreshToken, userId]);

  return {
    cacheAgeSeconds,
    callerOptedOut,
    error,
    isUsingCachedResult,
    loading,
    matches,
    refreshAvailableInSeconds,
    reload,
  };
}
