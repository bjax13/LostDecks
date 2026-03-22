import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../../../lib/firebase", () => ({ db: { _tag: "mock-firestore" } }));

const mockCollection = vi.fn();
const mockWhere = vi.fn();
const mockOrderBy = vi.fn();
const mockQuery = vi.fn();
const mockOnSnapshot = vi.fn();

vi.mock("firebase/firestore", () => ({
  collection: (...args) => mockCollection(...args),
  where: (...args) => mockWhere(...args),
  orderBy: (...args) => mockOrderBy(...args),
  query: (...args) => mockQuery(...args),
  onSnapshot: (...args) => mockOnSnapshot(...args),
}));

let useMyTrades;

beforeEach(async () => {
  vi.clearAllMocks();

  mockCollection.mockReturnValue("trades-collection-ref");
  mockWhere.mockReturnValue("where-constraint");
  mockOrderBy.mockReturnValue("orderBy-constraint");
  mockQuery.mockReturnValue("query-ref");
  mockOnSnapshot.mockReturnValue(vi.fn());

  const mod = await import("./useMyTrades.js");
  useMyTrades = mod.default;
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe("useMyTrades", () => {
  describe("when uid is falsy", () => {
    it("returns empty trades, loading=false, error=null for undefined uid", () => {
      const { result } = renderHook(() => useMyTrades(undefined));

      expect(result.current.trades).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("returns empty trades, loading=false, error=null for null uid", () => {
      const { result } = renderHook(() => useMyTrades(null));

      expect(result.current.trades).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("returns empty trades, loading=false, error=null for empty string uid", () => {
      const { result } = renderHook(() => useMyTrades(""));

      expect(result.current.trades).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("returns empty trades, loading=false, error=null for numeric 0 uid", () => {
      const { result } = renderHook(() => useMyTrades(0));

      expect(result.current.trades).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("does not subscribe to Firestore", () => {
      renderHook(() => useMyTrades(null));
      expect(mockOnSnapshot).not.toHaveBeenCalled();
    });

    it("does not build a query", () => {
      renderHook(() => useMyTrades(null));
      expect(mockQuery).not.toHaveBeenCalled();
    });
  });

  describe("when uid is provided", () => {
    it("builds the correct Firestore query", () => {
      renderHook(() => useMyTrades("user-123"));

      expect(mockCollection).toHaveBeenCalledWith(
        expect.objectContaining({ _tag: "mock-firestore" }),
        "trades",
      );
      expect(mockWhere).toHaveBeenCalledWith("participants", "array-contains", "user-123");
      expect(mockOrderBy).toHaveBeenCalledWith("createdAt", "desc");
      expect(mockQuery).toHaveBeenCalledWith(
        "trades-collection-ref",
        "where-constraint",
        "orderBy-constraint",
      );
    });

    it("sets loading=true while waiting for snapshot", () => {
      const { result } = renderHook(() => useMyTrades("user-123"));

      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBe(null);
    });

    it("subscribes to onSnapshot with the query", () => {
      renderHook(() => useMyTrades("user-123"));

      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
      expect(mockOnSnapshot).toHaveBeenCalledWith(
        "query-ref",
        expect.any(Function),
        expect.any(Function),
      );
    });

    it("treats string '0' as valid uid and subscribes", () => {
      renderHook(() => useMyTrades("0"));
      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
      expect(mockWhere).toHaveBeenCalledWith("participants", "array-contains", "0");
    });
  });

  describe("snapshot success callback", () => {
    it("maps docs to trade objects with id and data", () => {
      const { result } = renderHook(() => useMyTrades("user-123"));

      const onNext = mockOnSnapshot.mock.calls[0][1];
      const fakeSnap = {
        docs: [
          {
            id: "trade-1",
            data: () => ({ status: "pending", participants: ["user-123", "user-456"] }),
          },
          {
            id: "trade-2",
            data: () => ({ status: "complete", participants: ["user-123", "user-789"] }),
          },
        ],
      };

      act(() => onNext(fakeSnap));

      expect(result.current.trades).toEqual([
        { id: "trade-1", status: "pending", participants: ["user-123", "user-456"] },
        { id: "trade-2", status: "complete", participants: ["user-123", "user-789"] },
      ]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("handles an empty snapshot", () => {
      const { result } = renderHook(() => useMyTrades("user-123"));

      const onNext = mockOnSnapshot.mock.calls[0][1];
      act(() => onNext({ docs: [] }));

      expect(result.current.trades).toEqual([]);
      expect(result.current.loading).toBe(false);
    });

    it("updates trades when snapshot fires again (real-time updates)", () => {
      const { result } = renderHook(() => useMyTrades("user-123"));

      const onNext = mockOnSnapshot.mock.calls[0][1];
      act(() =>
        onNext({
          docs: [{ id: "trade-1", data: () => ({ status: "pending" }) }],
        }),
      );
      expect(result.current.trades).toHaveLength(1);
      expect(result.current.trades[0].status).toBe("pending");

      act(() =>
        onNext({
          docs: [
            { id: "trade-1", data: () => ({ status: "complete" }) },
            { id: "trade-2", data: () => ({ status: "open" }) },
          ],
        }),
      );
      expect(result.current.trades).toHaveLength(2);
      expect(result.current.trades[0].status).toBe("complete");
      expect(result.current.trades[1].status).toBe("open");
    });

    it("merges doc id with data() correctly", () => {
      const { result } = renderHook(() => useMyTrades("user-123"));

      const onNext = mockOnSnapshot.mock.calls[0][1];
      act(() =>
        onNext({
          docs: [
            {
              id: "doc-id-from-ref",
              data: () => ({ customField: "value", participants: ["u1"] }),
            },
          ],
        }),
      );
      expect(result.current.trades[0]).toEqual({
        id: "doc-id-from-ref",
        customField: "value",
        participants: ["u1"],
      });
    });
  });

  describe("snapshot error callback", () => {
    it("sets error and stops loading", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { result } = renderHook(() => useMyTrades("user-123"));

      const onError = mockOnSnapshot.mock.calls[0][2];
      const fakeError = new Error("permission-denied");

      act(() => onError(fakeError));

      expect(result.current.error).toBe(fakeError);
      expect(result.current.loading).toBe(false);
      expect(result.current.trades).toEqual([]);
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load trades", fakeError);

      consoleSpy.mockRestore();
    });
  });

  describe("cleanup and resubscription", () => {
    it("calls unsubscribe on unmount", () => {
      const unsubscribe = vi.fn();
      mockOnSnapshot.mockReturnValue(unsubscribe);

      const { unmount } = renderHook(() => useMyTrades("user-123"));
      expect(unsubscribe).not.toHaveBeenCalled();

      unmount();
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it("resubscribes when uid changes", () => {
      const unsub1 = vi.fn();
      const unsub2 = vi.fn();
      mockOnSnapshot.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);

      mockQuery.mockReturnValueOnce("query-ref-1").mockReturnValueOnce("query-ref-2");

      const { rerender } = renderHook(({ uid }) => useMyTrades(uid), {
        initialProps: { uid: "user-A" },
      });

      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);

      rerender({ uid: "user-B" });

      expect(unsub1).toHaveBeenCalledTimes(1);
      expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
    });

    it("unsubscribes and resets state when uid changes to null", () => {
      const unsubscribe = vi.fn();
      mockOnSnapshot.mockReturnValue(unsubscribe);

      const { result, rerender } = renderHook(({ uid }) => useMyTrades(uid), {
        initialProps: { uid: "user-A" },
      });

      const onNext = mockOnSnapshot.mock.calls[0][1];
      act(() =>
        onNext({
          docs: [{ id: "t1", data: () => ({ status: "open" }) }],
        }),
      );
      expect(result.current.trades).toHaveLength(1);

      rerender({ uid: null });

      expect(unsubscribe).toHaveBeenCalled();
      expect(result.current.trades).toEqual([]);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("does not return cleanup when uid is falsy", () => {
      const { unmount } = renderHook(() => useMyTrades(null));
      expect(mockOnSnapshot).not.toHaveBeenCalled();
      expect(() => unmount()).not.toThrow();
    });
  });

  describe("memoization", () => {
    it("does not rebuild the query when uid stays the same across rerenders", () => {
      const { rerender } = renderHook(({ uid }) => useMyTrades(uid), {
        initialProps: { uid: "user-X" },
      });

      rerender({ uid: "user-X" });
      rerender({ uid: "user-X" });

      expect(mockQuery).toHaveBeenCalledTimes(1);
      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
    });
  });
});
