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

describe("useUserCollection", () => {
  describe("when ownerUid is falsy", () => {
    it("returns empty entries, loading=false, error=null", async () => {
      const { result } = renderHook(() => useUserCollection(null));

      await waitFor(() => {
        expect(result.current.loading).toBe(false);
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
        expect(result.current.loading).toBe(false);
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

    it("sets loading=true while waiting for snapshot", () => {
      const { result } = renderHook(() => useUserCollection("user-abc"));

      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBe(null);
    });

    it("subscribes to onSnapshot with the query and callbacks", () => {
      renderHook(() => useUserCollection("user-abc"));

      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
      expect(mockOnSnapshot).toHaveBeenCalledWith(
        "query-ref",
        expect.any(Function),
        expect.any(Function),
      );
    });

    it("on success: maps snapshot docs to entries and clears loading", () => {
      const { result } = renderHook(() => useUserCollection("user-abc"));

      const onNext = mockOnSnapshot.mock.calls[0][1];
      const fakeSnap = {
        docs: [
          createFakeDoc("doc-1", { ownerUid: "user-abc", skuId: "LT24-ELS-01-DUN", quantity: 2 }),
          createFakeDoc("doc-2", { ownerUid: "user-abc", skuId: "LT24-WOK-01-DUN", quantity: 1 }),
        ],
      };

      act(() => onNext(fakeSnap));

      expect(result.current.entries).toEqual([
        { id: "doc-1", ownerUid: "user-abc", skuId: "LT24-ELS-01-DUN", quantity: 2 },
        { id: "doc-2", ownerUid: "user-abc", skuId: "LT24-WOK-01-DUN", quantity: 1 },
      ]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("on success: empty snapshot docs maps to entries []", () => {
      const { result } = renderHook(() => useUserCollection("user-abc"));

      const onNext = mockOnSnapshot.mock.calls[0][1];
      act(() => onNext({ docs: [] }));

      expect(result.current.entries).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("on error: sets error, stops loading, and logs", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { result } = renderHook(() => useUserCollection("user-abc"));

      const onError = mockOnSnapshot.mock.calls[0][2];
      const fakeError = new Error("permission-denied");

      act(() => onError(fakeError));

      expect(result.current.error).toBe(fakeError);
      expect(result.current.loading).toBe(false);
      expect(result.current.entries).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load collection entries", fakeError);

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

      const onNext = mockOnSnapshot.mock.calls[0][1];
      act(() =>
        onNext({
          docs: [
            createFakeDoc("doc-1", {
              ownerUid: "user-A",
              skuId: "LT24-ELS-01-DUN",
              quantity: 1,
            }),
          ],
        }),
      );
      expect(result.current.entries).toHaveLength(1);

      rerender({ ownerUid: null });

      expect(unsubscribe).toHaveBeenCalled();

      await waitFor(() => {
        expect(result.current.entries).toEqual([]);
        expect(result.current.loading).toBe(false);
        expect(result.current.error).toBe(null);
      });
    });

    it("sets loading true again when ownerUid changes after a completed load", () => {
      const unsub1 = vi.fn();
      const unsub2 = vi.fn();
      mockOnSnapshot.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);

      const { rerender, result } = renderHook(({ ownerUid }) => useUserCollection(ownerUid), {
        initialProps: { ownerUid: "user-A" },
      });

      const onNextA = mockOnSnapshot.mock.calls[0][1];
      act(() =>
        onNextA({
          docs: [createFakeDoc("doc-1", { ownerUid: "user-A", skuId: "x", quantity: 1 })],
        }),
      );
      expect(result.current.loading).toBe(false);

      rerender({ ownerUid: "user-B" });

      expect(result.current.loading).toBe(true);
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
