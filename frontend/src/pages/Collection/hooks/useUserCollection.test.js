import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockDb = { _tag: "mock-firestore" };
vi.mock("../../../lib/firebase", () => ({ db: mockDb }));

const mockCollection = vi.fn();
const mockWhere = vi.fn();
const mockQuery = vi.fn();
const mockOnSnapshot = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: (...args) => mockCollection(...args),
  where: (...args) => mockWhere(...args),
  query: (...args) => mockQuery(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
}));

let useUserCollection;

beforeEach(async () => {
  vi.clearAllMocks();

  mockCollection.mockReturnValue("collections-ref");
  mockWhere.mockReturnValue("where-constraint");
  mockQuery.mockReturnValue("query-ref");
  mockOnSnapshot.mockReturnValue(vi.fn());

  const mod = await import("./useUserCollection.js");
  useUserCollection = mod.useUserCollection;
});

afterEach(() => {
  vi.restoreAllMocks();
});

function createFakeDoc(id, data) {
  return {
    id,
    data: () => data,
  };
}

function createFakeSnapshot(docs, { fromCache = false } = {}) {
  return {
    docs,
    metadata: { fromCache, hasPendingWrites: false },
  };
}

function getOnNext(callIndex = 0) {
  return mockOnSnapshot.mock.calls[callIndex][2];
}

function getOnError(callIndex = 0) {
  return mockOnSnapshot.mock.calls[callIndex][3];
}

describe("useUserCollection", () => {
  describe("when ownerUid is falsy", () => {
    it("returns idle with empty entries", async () => {
      const { result } = renderHook(() => useUserCollection(null));

      await waitFor(() => {
        expect(result.current.status).toBe("idle");
      });

      expect(result.current.entries).toEqual([]);
      expect(result.current.error).toBe(null);
    });

    it("does not subscribe to Firestore for undefined ownerUid", async () => {
      renderHook(() => useUserCollection(undefined));

      await waitFor(() => {
        expect(mockOnSnapshot).not.toHaveBeenCalled();
      });
    });

    it("does not subscribe for empty string ownerUid", async () => {
      const { result } = renderHook(() => useUserCollection(""));

      await waitFor(() => {
        expect(mockOnSnapshot).not.toHaveBeenCalled();
        expect(result.current.status).toBe("idle");
      });

      expect(result.current.entries).toEqual([]);
      expect(result.current.error).toBe(null);
    });
  });

  describe("when ownerUid is set", () => {
    it("builds collection, query, and where for ownerUid", () => {
      renderHook(() => useUserCollection("user-abc"));

      expect(mockCollection).toHaveBeenCalledWith(mockDb, "collections");
      expect(mockWhere).toHaveBeenCalledWith("ownerUid", "==", "user-abc");
      expect(mockQuery).toHaveBeenCalledWith("collections-ref", "where-constraint");
    });

    it("sets status loading while waiting for snapshot", () => {
      const { result } = renderHook(() => useUserCollection("user-abc"));

      expect(result.current.status).toBe("loading");
      expect(result.current.error).toBe(null);
    });

    it("subscribes to onSnapshot with the query and callbacks", () => {
      renderHook(() => useUserCollection("user-abc"));

      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
      expect(mockOnSnapshot).toHaveBeenCalledWith(
        "query-ref",
        { includeMetadataChanges: true },
        expect.any(Function),
        expect.any(Function),
      );
    });

    it("keeps the Firestore document id when stored fields also include an id property", () => {
      const { result } = renderHook(() => useUserCollection("user-abc"));

      const onNext = getOnNext();
      act(() =>
        onNext(
          createFakeSnapshot([
            createFakeDoc("PIN-CF-01", {
              ownerUid: "user-abc",
              quantity: 1,
              id: "stale-body-id",
            }),
          ]),
        ),
      );

      expect(result.current.entries[0].id).toBe("PIN-CF-01");
    });

    it("on success: maps prod-shaped id-only docs to entries and marks ready", () => {
      const { result } = renderHook(() => useUserCollection("user-abc"));

      const onNext = getOnNext();
      act(() =>
        onNext(
          createFakeSnapshot([
            createFakeDoc("LT24-CHM-01-DUN", { ownerUid: "user-abc", quantity: 2 }),
            createFakeDoc("LT24-WOK-01-DUN", { ownerUid: "user-abc", quantity: 1 }),
          ]),
        ),
      );

      expect(result.current.entries).toEqual([
        { id: "LT24-CHM-01-DUN", ownerUid: "user-abc", quantity: 2 },
        { id: "LT24-WOK-01-DUN", ownerUid: "user-abc", quantity: 1 },
      ]);
      expect(result.current.status).toBe("ready");
      expect(result.current.error).toBe(null);
    });

    it("on success: empty snapshot still means ready (not idle)", () => {
      const { result } = renderHook(() => useUserCollection("user-abc"));

      const onNext = getOnNext();
      act(() => onNext(createFakeSnapshot([])));

      expect(result.current.entries).toEqual([]);
      expect(result.current.status).toBe("ready");
      expect(result.current.error).toBe(null);
    });

    it("on error before ready: marks error with empty entries", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { result } = renderHook(() => useUserCollection("user-abc"));

      const onError = getOnError();
      const fakeError = new Error("permission-denied");

      act(() => onError(fakeError));

      expect(result.current.error).toBe(fakeError);
      expect(result.current.status).toBe("error");
      expect(result.current.entries).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load collection entries", fakeError);

      consoleSpy.mockRestore();
    });

    it("on error after ready: keeps the last loaded entries", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { result } = renderHook(() => useUserCollection("user-abc"));

      const onNext = getOnNext();
      act(() =>
        onNext(
          createFakeSnapshot([
            createFakeDoc("LT24-CHM-01-DUN", { ownerUid: "user-abc", quantity: 1 }),
          ]),
        ),
      );

      const onError = getOnError();
      const fakeError = new Error("transient-read-failure");
      act(() => onError(fakeError));

      expect(result.current.status).toBe("error");
      expect(result.current.error).toBe(fakeError);
      expect(result.current.entries).toEqual([
        { id: "LT24-CHM-01-DUN", ownerUid: "user-abc", quantity: 1 },
      ]);

      consoleSpy.mockRestore();
    });

    it("calls unsubscribe on unmount", () => {
      const unsubscribe = vi.fn();
      mockOnSnapshot.mockReturnValue(unsubscribe);

      const { unmount } = renderHook(() => useUserCollection("user-abc"));

      expect(unsubscribe).not.toHaveBeenCalled();

      unmount();
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe("cleanup and resubscription", () => {
    it("resubscribes when ownerUid changes", () => {
      const unsub1 = vi.fn();
      const unsub2 = vi.fn();
      mockOnSnapshot.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);

      const { rerender } = renderHook(({ ownerUid }) => useUserCollection(ownerUid), {
        initialProps: { ownerUid: "user-A" },
      });

      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);

      rerender({ ownerUid: "user-B" });

      expect(unsub1).toHaveBeenCalledTimes(1);
      expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
      expect(mockWhere).toHaveBeenLastCalledWith("ownerUid", "==", "user-B");
    });

    it("unsubscribes and clears state when ownerUid becomes falsy", async () => {
      const unsubscribe = vi.fn();
      mockOnSnapshot.mockReturnValue(unsubscribe);

      const { result, rerender } = renderHook(({ ownerUid }) => useUserCollection(ownerUid), {
        initialProps: { ownerUid: "user-A" },
      });

      const onNext = getOnNext();
      act(() =>
        onNext(
          createFakeSnapshot([
            createFakeDoc("LT24-CHM-01-DUN", {
              ownerUid: "user-A",
              quantity: 1,
            }),
          ]),
        ),
      );
      expect(result.current.entries).toHaveLength(1);

      rerender({ ownerUid: null });

      expect(unsubscribe).toHaveBeenCalled();

      await waitFor(() => {
        expect(result.current.entries).toEqual([]);
        expect(result.current.status).toBe("idle");
        expect(result.current.error).toBe(null);
      });
    });

    it("sets loading again when ownerUid changes after a completed load", () => {
      const unsub1 = vi.fn();
      const unsub2 = vi.fn();
      mockOnSnapshot.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);

      const { rerender, result } = renderHook(({ ownerUid }) => useUserCollection(ownerUid), {
        initialProps: { ownerUid: "user-A" },
      });

      const onNextA = getOnNext();
      act(() =>
        onNextA(
          createFakeSnapshot([
            createFakeDoc("LT24-CHM-01-DUN", { ownerUid: "user-A", quantity: 1 }),
          ]),
        ),
      );
      expect(result.current.status).toBe("ready");

      rerender({ ownerUid: "user-B" });

      expect(result.current.status).toBe("loading");
    });

    it("does not return to loading when ownerUid is unchanged after ready", () => {
      const { rerender, result } = renderHook(({ ownerUid }) => useUserCollection(ownerUid), {
        initialProps: { ownerUid: "user-A" },
      });

      const onNext = getOnNext();
      act(() => onNext(createFakeSnapshot([createFakeDoc("LT24-CHM-01-DUN", { quantity: 1 })])));
      expect(result.current.status).toBe("ready");

      rerender({ ownerUid: "user-A" });

      expect(result.current.status).toBe("ready");
      expect(result.current.entries).toHaveLength(1);
    });

    it("stays cache-ready for offline UI but serverConfirmed latches on a server snapshot", () => {
      const { result } = renderHook(() => useUserCollection("user-abc"));
      const onNext = getOnNext();

      act(() => onNext(createFakeSnapshot([], { fromCache: true })));
      expect(result.current.status).toBe("ready");
      expect(result.current.serverConfirmed).toBe(false);
      expect(result.current.entries).toEqual([]);

      act(() =>
        onNext(
          createFakeSnapshot([createFakeDoc("PIN-CF-01", { ownerUid: "user-abc", quantity: 1 })], {
            fromCache: false,
          }),
        ),
      );
      expect(result.current.status).toBe("ready");
      expect(result.current.serverConfirmed).toBe(true);
      expect(result.current.entries).toHaveLength(1);

      act(() =>
        onNext(
          createFakeSnapshot([createFakeDoc("PIN-CF-01", { ownerUid: "user-abc", quantity: 1 })], {
            fromCache: true,
          }),
        ),
      );
      expect(result.current.status).toBe("ready");
      expect(result.current.serverConfirmed).toBe(true);
    });

    it("unmount with falsy ownerUid does not throw", async () => {
      const { unmount } = renderHook(() => useUserCollection(null));

      await waitFor(() => {
        expect(mockOnSnapshot).not.toHaveBeenCalled();
      });

      expect(() => unmount()).not.toThrow();
    });
  });
});
