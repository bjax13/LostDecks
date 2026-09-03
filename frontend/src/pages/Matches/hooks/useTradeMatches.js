import { httpsCallable } from "firebase/functions";
import { useCallback, useEffect, useMemo, useState } from "react";
import { functions } from "../../../lib/firebase";
import {
  DEFAULT_DISCORD_CHANNEL,
  MATCH_CONTACT_SHARING,
  normalizeMatchContactSharing,
} from "../../../lib/userPreferences";
import { DEFAULT_MATCH_PAGE_SIZE } from "../constants";

export const MATCHES_CACHE_TTL_MS = 30_000;
export { DEFAULT_MATCH_PAGE_SIZE };

function normalizeOptionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

export function normalizeMatchContact(rawContact) {
  if (!rawContact || typeof rawContact !== "object") {
    return {
      method: MATCH_CONTACT_SHARING.TRUE_EMAIL,
      email: "",
      discordHandle: "",
      discordChannel: DEFAULT_DISCORD_CHANNEL,
      usedFallback: false,
      fallbackReason: null,
    };
  }

  const method = normalizeMatchContactSharing(rawContact.method);
  const email = normalizeOptionalString(rawContact.email);
  const discordHandle = normalizeOptionalString(rawContact.discordHandle);
  const discordChannel =
    normalizeOptionalString(rawContact.discordChannel) || DEFAULT_DISCORD_CHANNEL;
  const usedFallback = Boolean(rawContact.usedFallback);
  const fallbackReason = normalizeOptionalString(rawContact.fallbackReason) || null;

  if (method === MATCH_CONTACT_SHARING.DISCORD) {
    return {
      method,
      email: "",
      discordHandle,
      discordChannel,
      usedFallback,
      fallbackReason,
    };
  }

  return {
    method,
    email,
    discordHandle: "",
    discordChannel: DEFAULT_DISCORD_CHANNEL,
    usedFallback,
    fallbackReason,
  };
}

const MATCH_LANE_IDS = new Set(["dun", "foil", "pins"]);

function normalizePileItem(item) {
  const skuId = typeof item?.skuId === "string" ? item.skuId.trim() : "";
  if (!skuId) {
    return null;
  }

  const owned = Number.isFinite(item?.owned) ? Math.max(0, Math.floor(item.owned)) : 0;
  if (owned < 2) {
    return null;
  }

  const extras = Number.isFinite(item?.extras) ? Math.max(0, Math.floor(item.extras)) : owned - 1;
  return { skuId, owned, extras };
}

function normalizeLane(lane) {
  const id = typeof lane?.id === "string" ? lane.id : "";
  if (!MATCH_LANE_IDS.has(id)) {
    return null;
  }

  const theyCanSend = Array.isArray(lane.theyCanSend)
    ? lane.theyCanSend.map(normalizePileItem).filter(Boolean)
    : [];
  const youCanSend = Array.isArray(lane.youCanSend)
    ? lane.youCanSend.map(normalizePileItem).filter(Boolean)
    : [];
  if (!theyCanSend.length || !youCanSend.length) {
    return null;
  }

  return { id, theyCanSend, youCanSend };
}

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
      contact: normalizeMatchContact(entry?.contact),
      lanes: Array.isArray(entry?.lanes) ? entry.lanes.map(normalizeLane).filter(Boolean) : [],
    }))
    .filter((entry) => entry.userId && entry.lanes.length > 0);
}

function normalizePageSize(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return DEFAULT_MATCH_PAGE_SIZE;
  }
  return Math.min(50, Math.max(1, Math.floor(value)));
}

function normalizeCursor(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function getMatchesCacheKey(
  userId,
  { pageSize = DEFAULT_MATCH_PAGE_SIZE, cursor = null } = {},
) {
  const normalizedPageSize = normalizePageSize(pageSize);
  const normalizedCursor = normalizeCursor(cursor) || "start";
  return `matches-cache:${userId}:p${normalizedPageSize}:${normalizedCursor}`;
}

export function readMatchesCache(userId, options = {}) {
  if (!userId || typeof window === "undefined" || !window.localStorage) {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(getMatchesCacheKey(userId, options));
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
      pageSize: normalizePageSize(parsed.pageSize ?? options.pageSize),
      nextCursor: normalizeCursor(parsed.nextCursor),
      hasMore: Boolean(parsed.hasMore),
      totalOnPage:
        typeof parsed.totalOnPage === "number" && Number.isFinite(parsed.totalOnPage)
          ? Math.max(0, Math.floor(parsed.totalOnPage))
          : normalizeMatchRows(parsed.matches).length,
    };
  } catch {
    return null;
  }
}

export function writeMatchesCache(userId, payload, options = {}) {
  if (!userId || typeof window === "undefined" || !window.localStorage) {
    return;
  }

  try {
    window.localStorage.setItem(
      getMatchesCacheKey(userId, {
        pageSize: payload.pageSize ?? options.pageSize,
        cursor: options.cursor,
      }),
      JSON.stringify({
        cachedAtMs: payload.cachedAtMs,
        callerOptedOut: Boolean(payload.callerOptedOut),
        matches: normalizeMatchRows(payload.matches),
        pageSize: normalizePageSize(payload.pageSize ?? options.pageSize),
        nextCursor: normalizeCursor(payload.nextCursor),
        hasMore: Boolean(payload.hasMore),
        totalOnPage:
          typeof payload.totalOnPage === "number" && Number.isFinite(payload.totalOnPage)
            ? Math.max(0, Math.floor(payload.totalOnPage))
            : normalizeMatchRows(payload.matches).length,
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
 * @param {{ pageSize?: number }} [options]
 */
export function useTradeMatches(
  userId,
  { pageSize: requestedPageSize = DEFAULT_MATCH_PAGE_SIZE } = {},
) {
  const enabled = Boolean(userId);
  const pageSize = normalizePageSize(requestedPageSize);
  const [loading, setLoading] = useState(enabled);
  const [error, setError] = useState(null);
  const [callerOptedOut, setCallerOptedOut] = useState(false);
  const [matches, setMatches] = useState([]);
  const [cachedAtMs, setCachedAtMs] = useState(null);
  const [isUsingCachedResult, setIsUsingCachedResult] = useState(false);
  const [showRefreshCountdown, setShowRefreshCountdown] = useState(false);
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [refreshToken, setRefreshToken] = useState(0);
  const [cursor, setCursor] = useState(null);
  const [cursorStack, setCursorStack] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [totalOnPage, setTotalOnPage] = useState(0);

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
  const pageIndex = cursorStack.length + 1;
  const canGoPrevious = cursorStack.length > 0;
  const canGoNext = hasMore && Boolean(nextCursor);

  const applyPayload = useCallback((payload, { showCountdown, isCached }) => {
    setCallerOptedOut(payload.callerOptedOut);
    setMatches(payload.matches);
    setCachedAtMs(payload.cachedAtMs);
    setNextCursor(payload.nextCursor);
    setHasMore(payload.hasMore);
    setTotalOnPage(payload.totalOnPage);
    setIsUsingCachedResult(isCached);
    setShowRefreshCountdown(showCountdown);
    setNowMs(Date.now());
    setLoading(false);
    setError(null);
  }, []);

  const reload = useCallback(() => {
    if (getRefreshAvailableInSeconds(cachedAtMs, Date.now()) > 0) {
      return;
    }
    setRefreshToken((value) => value + 1);
  }, [cachedAtMs]);

  const goToNextPage = useCallback(() => {
    if (!hasMore || !nextCursor) {
      return;
    }
    setCursorStack((stack) => [...stack, cursor]);
    setCursor(nextCursor);
  }, [cursor, hasMore, nextCursor]);

  const goToPreviousPage = useCallback(() => {
    if (cursorStack.length === 0) {
      return;
    }
    const previousCursor = cursorStack[cursorStack.length - 1];
    setCursorStack((stack) => stack.slice(0, -1));
    setCursor(previousCursor);
  }, [cursorStack]);

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
      return undefined;
    }

    const cacheKey = getMatchesCacheKey(userId, { pageSize, cursor });

    const onStorage = (event) => {
      if (event.key !== cacheKey) {
        return;
      }
      if (event.storageArea && event.storageArea !== window.localStorage) {
        return;
      }

      const cached = readMatchesCache(userId, { pageSize, cursor });
      if (!cached) {
        return;
      }

      const now = Date.now();
      const cacheIsFresh = now - cached.cachedAtMs < MATCHES_CACHE_TTL_MS;
      if (!cacheIsFresh) {
        return;
      }

      applyPayload(cached, { showCountdown: true, isCached: true });
    };

    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener("storage", onStorage);
    };
  }, [applyPayload, cursor, enabled, pageSize, userId]);

  useEffect(() => {
    if (!enabled || !userId) {
      setMatches([]);
      setCallerOptedOut(false);
      setCachedAtMs(null);
      setIsUsingCachedResult(false);
      setShowRefreshCountdown(false);
      setNextCursor(null);
      setHasMore(false);
      setTotalOnPage(0);
      setCursor(null);
      setCursorStack([]);
      setLoading(false);
      setError(null);
      return;
    }

    // Intentionally read so reload() can re-run this effect after cooldown.
    const fetchGeneration = refreshToken;
    const now = Date.now();
    const cached = readMatchesCache(userId, { pageSize, cursor });
    const cacheIsFresh =
      cached &&
      typeof cached.cachedAtMs === "number" &&
      now - cached.cachedAtMs < MATCHES_CACHE_TTL_MS;

    // Prefer a fresh cache hit and skip the network call (covers remount and page revisits).
    // reload() bumps refreshToken after cooldown so an expired cache still refetches in-place.
    if (cacheIsFresh && fetchGeneration === refreshToken) {
      applyPayload(cached, { showCountdown: true, isCached: true });
      return;
    }

    if (!fetchMatches) {
      setMatches([]);
      setCallerOptedOut(false);
      setCachedAtMs(null);
      setIsUsingCachedResult(false);
      setShowRefreshCountdown(false);
      setNextCursor(null);
      setHasMore(false);
      setTotalOnPage(0);
      setLoading(false);
      setError(new Error("Cloud Functions is not configured."));
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setIsUsingCachedResult(false);
    setShowRefreshCountdown(false);

    fetchMatches({
      pageSize,
      cursor,
    })
      .then((response) => {
        if (cancelled) {
          return;
        }
        const data = response?.data ?? {};
        const nextCallerOptedOut = Boolean(data.callerOptedOut);
        const nextMatches = normalizeMatchRows(data.matches);
        const resolvedPageSize = normalizePageSize(data.pageSize ?? pageSize);
        const resolvedNextCursor = normalizeCursor(data.nextCursor);
        const resolvedHasMore = Boolean(data.hasMore);
        const resolvedTotalOnPage =
          typeof data.totalOnPage === "number" && Number.isFinite(data.totalOnPage)
            ? Math.max(0, Math.floor(data.totalOnPage))
            : nextMatches.length;
        const fetchedAt = Date.now();

        const payload = {
          cachedAtMs: fetchedAt,
          callerOptedOut: nextCallerOptedOut,
          matches: nextMatches,
          pageSize: resolvedPageSize,
          nextCursor: resolvedNextCursor,
          hasMore: resolvedHasMore,
          totalOnPage: resolvedTotalOnPage,
        };

        applyPayload(payload, { showCountdown: false, isCached: false });
        writeMatchesCache(userId, payload, { pageSize, cursor });
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
        setShowRefreshCountdown(false);
        setNextCursor(null);
        setHasMore(false);
        setTotalOnPage(0);
        setError(err);
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [applyPayload, cursor, enabled, fetchMatches, pageSize, refreshToken, userId]);

  return {
    cacheAgeSeconds,
    callerOptedOut,
    canGoNext,
    canGoPrevious,
    error,
    goToNextPage,
    goToPreviousPage,
    hasMore,
    isUsingCachedResult,
    loading,
    matches,
    nextCursor,
    pageIndex,
    pageSize,
    refreshAvailableInSeconds,
    reload,
    showRefreshCountdown,
    totalOnPage,
  };
}
