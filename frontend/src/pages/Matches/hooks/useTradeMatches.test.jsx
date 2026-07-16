import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockHttpsCallable = vi.hoisted(() => vi.fn());
const mockFunctions = vi.hoisted(() => ({}));

vi.mock("firebase/functions", () => ({
  httpsCallable: mockHttpsCallable,
}));

vi.mock("../../../lib/firebase", () => ({
  functions: mockFunctions,
}));

import {
  getMatchesCacheKey,
  MATCHES_CACHE_TTL_MS,
  readMatchesCache,
  useTradeMatches,
  writeMatchesCache,
} from "./useTradeMatches.js";

const MATCH_PAYLOAD = {
  callerOptedOut: false,
  matches: [
    {
      userId: "user-2",
      displayName: "Collector Two",
      pairs: [{ theirSkuId: "SKU-2", yourSkuId: "SKU-1" }],
    },
  ],
};

describe("useTradeMatches cache + cooldown", () => {
  let fetchMock;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    fetchMock = vi.fn().mockResolvedValue({ data: MATCH_PAYLOAD });
    mockHttpsCallable.mockReturnValue(fetchMock);
  });

  afterEach(() => {
    window.localStorage.clear();
  });

  it("reads and writes user-keyed localStorage cache", () => {
    writeMatchesCache("uid-1", {
      cachedAtMs: 1_000,
      callerOptedOut: false,
      matches: MATCH_PAYLOAD.matches,
    });

    expect(window.localStorage.getItem(getMatchesCacheKey("uid-1"))).toBeTruthy();
    expect(readMatchesCache("uid-1")).toEqual({
      cachedAtMs: 1_000,
      callerOptedOut: false,
      matches: MATCH_PAYLOAD.matches,
    });
    expect(readMatchesCache("uid-2")).toBeNull();
  });

  it("fetches from the callable on a cache miss", async () => {
    const { result } = renderHook(() => useTradeMatches("uid-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.matches).toHaveLength(1);
    expect(result.current.isUsingCachedResult).toBe(false);
    expect(result.current.showRefreshCountdown).toBe(false);
    expect(result.current.refreshAvailableInSeconds).toBeGreaterThan(0);
    expect(readMatchesCache("uid-1")?.matches).toHaveLength(1);
  });

  it("uses cached data and skips the callable inside the TTL", async () => {
    const cachedAtMs = Date.now() - 5_000;
    writeMatchesCache("uid-1", {
      cachedAtMs,
      callerOptedOut: false,
      matches: MATCH_PAYLOAD.matches,
    });

    const { result } = renderHook(() => useTradeMatches("uid-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(result.current.isUsingCachedResult).toBe(true);
    expect(result.current.showRefreshCountdown).toBe(true);
    expect(result.current.cacheAgeSeconds).toBeGreaterThanOrEqual(5);
    expect(result.current.refreshAvailableInSeconds).toBeGreaterThan(0);
    expect(result.current.matches[0].displayName).toBe("Collector Two");
  });

  it("refetches after the TTL expires", async () => {
    writeMatchesCache("uid-1", {
      cachedAtMs: Date.now() - MATCHES_CACHE_TTL_MS - 1_000,
      callerOptedOut: false,
      matches: MATCH_PAYLOAD.matches,
    });

    const { result } = renderHook(() => useTradeMatches("uid-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(result.current.isUsingCachedResult).toBe(false);
    expect(result.current.showRefreshCountdown).toBe(false);
  });

  it("allows a fresh fetch after remount when the cache TTL has expired", async () => {
    writeMatchesCache("uid-1", {
      cachedAtMs: Date.now() - 1_000,
      callerOptedOut: false,
      matches: MATCH_PAYLOAD.matches,
    });

    const first = renderHook(() => useTradeMatches("uid-1"));
    await waitFor(() => {
      expect(first.result.current.loading).toBe(false);
    });
    expect(fetchMock).not.toHaveBeenCalled();

    act(() => {
      first.result.current.reload();
    });
    expect(fetchMock).not.toHaveBeenCalled();

    first.unmount();

    writeMatchesCache("uid-1", {
      cachedAtMs: Date.now() - MATCHES_CACHE_TTL_MS - 500,
      callerOptedOut: false,
      matches: MATCH_PAYLOAD.matches,
    });

    const second = renderHook(() => useTradeMatches("uid-1"));
    await waitFor(() => {
      expect(second.result.current.loading).toBe(false);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("reload is a no-op while cooldown remains based on cachedAt state", async () => {
    const { result } = renderHook(() => useTradeMatches("uid-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const callsBefore = fetchMock.mock.calls.length;
    act(() => {
      result.current.reload();
      result.current.reload();
    });
    expect(fetchMock.mock.calls.length).toBe(callsBefore);
  });

  it("treats malformed cache as a miss", async () => {
    window.localStorage.setItem(getMatchesCacheKey("uid-1"), "{not-json");
    const { result } = renderHook(() => useTradeMatches("uid-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("does not write cache on fetch errors", async () => {
    fetchMock.mockRejectedValue(new Error("boom"));
    const { result } = renderHook(() => useTradeMatches("uid-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeTruthy();
    expect(readMatchesCache("uid-1")).toBeNull();
  });

  it("syncs fresh cache updates from other tabs via storage events", async () => {
    const { result } = renderHook(() => useTradeMatches("uid-1"));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });
    expect(result.current.showRefreshCountdown).toBe(false);

    const cachedAtMs = Date.now() - 3_000;
    const payload = {
      cachedAtMs,
      callerOptedOut: false,
      matches: [
        {
          userId: "user-9",
          displayName: "Other Tab Collector",
          pairs: [{ theirSkuId: "SKU-9", yourSkuId: "SKU-1" }],
        },
      ],
    };

    act(() => {
      window.localStorage.setItem(getMatchesCacheKey("uid-1"), JSON.stringify(payload));
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: getMatchesCacheKey("uid-1"),
          newValue: JSON.stringify(payload),
        }),
      );
    });

    await waitFor(() => {
      expect(result.current.matches[0]?.displayName).toBe("Other Tab Collector");
    });
    expect(result.current.isUsingCachedResult).toBe(true);
    expect(result.current.showRefreshCountdown).toBe(true);
    expect(result.current.refreshAvailableInSeconds).toBeGreaterThan(0);
  });
});
