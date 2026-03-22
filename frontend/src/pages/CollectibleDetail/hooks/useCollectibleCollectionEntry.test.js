import { act, renderHook } from "@testing-library/react";
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

const mockGetFinishesForCard = vi.fn();
const mockToSkuId = vi.fn();
vi.mock("../../../data/collectibles", () => ({
  getFinishesForCard: (...args) => mockGetFinishesForCard(...args),
  toSkuId: (...args) => mockToSkuId(...args),
}));

let useCollectibleCollectionEntry;

beforeEach(async () => {
  vi.clearAllMocks();

  mockCollection.mockReturnValue("collections-ref");
  mockWhere.mockReturnValue("where-constraint");
  mockQuery.mockReturnValue("query-ref");
  mockOnSnapshot.mockReturnValue(vi.fn());

  const mod = await import("./useCollectibleCollectionEntry.js");
  useCollectibleCollectionEntry = mod.useCollectibleCollectionEntry;
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

describe("useCollectibleCollectionEntry", () => {
  describe("when ownerUid is falsy", () => {
    it("returns entry=null, loading=false, error=null for undefined ownerUid", () => {
      const { result } = renderHook(() =>
        useCollectibleCollectionEntry(undefined, "LT24-ELS-01", null),
      );

      expect(result.current.entry).toBe(null);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("returns entry=null, loading=false, error=null for null ownerUid", () => {
      const { result } = renderHook(() =>
        useCollectibleCollectionEntry(null, "LT24-ELS-01", null),
      );

      expect(result.current.entry).toBe(null);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("returns entry=null, loading=false, error=null for empty string ownerUid", () => {
      const { result } = renderHook(() =>
        useCollectibleCollectionEntry("", "LT24-ELS-01", null),
      );

      expect(result.current.entry).toBe(null);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("does not subscribe to Firestore when ownerUid is falsy", () => {
      renderHook(() => useCollectibleCollectionEntry(null, "LT24-ELS-01", null));
      expect(mockOnSnapshot).not.toHaveBeenCalled();
    });
  });

  describe("when neither collectibleId nor skuId is provided", () => {
    it("returns entry=null, loading=false when both are null/undefined", () => {
      const { result } = renderHook(() =>
        useCollectibleCollectionEntry("user-123", null, null),
      );

      expect(result.current.entry).toBe(null);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("does not subscribe when both collectibleId and skuId are missing", () => {
      renderHook(() => useCollectibleCollectionEntry("user-123", null, null));
      expect(mockOnSnapshot).not.toHaveBeenCalled();
    });
  });

  describe("when skuId is provided", () => {
    it("builds the correct Firestore query with ownerUid and skuId", () => {
      renderHook(() => useCollectibleCollectionEntry("user-123", null, "LT24-ELS-01-DUN"));

      expect(mockCollection).toHaveBeenCalledWith(mockDb, "collections");
      expect(mockWhere).toHaveBeenCalledWith("ownerUid", "==", "user-123");
      expect(mockWhere).toHaveBeenCalledWith("skuId", "==", "LT24-ELS-01-DUN");
      expect(mockQuery).toHaveBeenCalledWith(
        "collections-ref",
        "where-constraint",
        "where-constraint",
      );
    });

    it("sets loading=true while waiting for snapshot", () => {
      const { result } = renderHook(() =>
        useCollectibleCollectionEntry("user-123", null, "LT24-ELS-01-DUN"),
      );

      expect(result.current.loading).toBe(true);
      expect(result.current.error).toBe(null);
    });

    it("subscribes to onSnapshot with the query", () => {
      renderHook(() => useCollectibleCollectionEntry("user-123", null, "LT24-ELS-01-DUN"));

      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);
      expect(mockOnSnapshot).toHaveBeenCalledWith(
        "query-ref",
        expect.any(Function),
        expect.any(Function),
      );
    });

    it("on success: uses doc that matches skuId when present", () => {
      const { result } = renderHook(() =>
        useCollectibleCollectionEntry("user-123", null, "LT24-ELS-01-FOIL"),
      );

      const onNext = mockOnSnapshot.mock.calls[0][1];
      const fakeSnap = {
        docs: [
          createFakeDoc("doc-1", {
            skuId: "LT24-ELS-01-DUN",
            ownerUid: "user-123",
            quantity: 1,
          }),
          createFakeDoc("doc-2", {
            skuId: "LT24-ELS-01-FOIL",
            ownerUid: "user-123",
            quantity: 1,
          }),
        ],
      };

      act(() => onNext(fakeSnap));

      expect(result.current.entry).toEqual({
        id: "doc-2",
        skuId: "LT24-ELS-01-FOIL",
        ownerUid: "user-123",
        quantity: 1,
      });
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("on success: falls back to first doc when no skuId match", () => {
      const { result } = renderHook(() =>
        useCollectibleCollectionEntry("user-123", null, "LT24-ELS-01-FOIL"),
      );

      const onNext = mockOnSnapshot.mock.calls[0][1];
      const fakeSnap = {
        docs: [
          createFakeDoc("doc-1", {
            skuId: "LT24-ELS-01-DUN",
            ownerUid: "user-123",
            quantity: 1,
          }),
        ],
      };

      act(() => onNext(fakeSnap));

      expect(result.current.entry).toEqual({
        id: "doc-1",
        skuId: "LT24-ELS-01-DUN",
        ownerUid: "user-123",
        quantity: 1,
      });
      expect(result.current.loading).toBe(false);
    });

    it("on success: returns null when docs are empty", () => {
      const { result } = renderHook(() =>
        useCollectibleCollectionEntry("user-123", null, "LT24-ELS-01-DUN"),
      );

      const onNext = mockOnSnapshot.mock.calls[0][1];
      act(() => onNext({ docs: [] }));

      expect(result.current.entry).toBe(null);
      expect(result.current.loading).toBe(false);
    });
  });

  describe("when collectibleId is provided (no skuId)", () => {
    describe("collectible has zero finishes", () => {
      it("sets entry=null, loading=false and does not subscribe", () => {
        mockGetFinishesForCard.mockReturnValue([]);

        const { result } = renderHook(() =>
          useCollectibleCollectionEntry("user-123", "LT24-UNKNOWN", null),
        );

        expect(mockGetFinishesForCard).toHaveBeenCalledWith("LT24-UNKNOWN");
        expect(mockOnSnapshot).not.toHaveBeenCalled();
        expect(result.current.entry).toBe(null);
        expect(result.current.loading).toBe(false);
      });
    });

    describe("collectible has one finish", () => {
      it("builds query with single skuId (== operator)", () => {
        mockGetFinishesForCard.mockReturnValue(["DUN"]);
        mockToSkuId.mockReturnValue("LT24-ELS-01-DUN");

        renderHook(() =>
          useCollectibleCollectionEntry("user-123", "LT24-ELS-01", null),
        );

        expect(mockGetFinishesForCard).toHaveBeenCalledWith("LT24-ELS-01");
        expect(mockToSkuId).toHaveBeenCalledWith("LT24-ELS-01", "DUN");
        expect(mockWhere).toHaveBeenCalledWith("skuId", "==", "LT24-ELS-01-DUN");
      });

      it("on success: sets entry from first doc", () => {
        mockGetFinishesForCard.mockReturnValue(["DUN"]);
        mockToSkuId.mockReturnValue("LT24-ELS-01-DUN");

        const { result } = renderHook(() =>
          useCollectibleCollectionEntry("user-123", "LT24-ELS-01", null),
        );

        const onNext = mockOnSnapshot.mock.calls[0][1];
        act(() =>
          onNext({
            docs: [
              createFakeDoc("doc-1", {
                skuId: "LT24-ELS-01-DUN",
                ownerUid: "user-123",
                quantity: 1,
              }),
            ],
          }),
        );

        expect(result.current.entry).toEqual({
          id: "doc-1",
          skuId: "LT24-ELS-01-DUN",
          ownerUid: "user-123",
          quantity: 1,
        });
        expect(result.current.loading).toBe(false);
      });
    });

    describe("collectible has multiple finishes", () => {
      it("builds query with skuId 'in' array", () => {
        mockGetFinishesForCard.mockReturnValue(["DUN", "FOIL"]);
        mockToSkuId
          .mockReturnValueOnce("LT24-ELS-01-DUN")
          .mockReturnValueOnce("LT24-ELS-01-FOIL");

        renderHook(() =>
          useCollectibleCollectionEntry("user-123", "LT24-ELS-01", null),
        );

        expect(mockToSkuId).toHaveBeenCalledWith("LT24-ELS-01", "DUN");
        expect(mockToSkuId).toHaveBeenCalledWith("LT24-ELS-01", "FOIL");
        expect(mockWhere).toHaveBeenCalledWith("skuId", "in", [
          "LT24-ELS-01-DUN",
          "LT24-ELS-01-FOIL",
        ]);
      });

      it("on success: sets entry from first doc", () => {
        mockGetFinishesForCard.mockReturnValue(["DUN", "FOIL"]);
        mockToSkuId
          .mockReturnValueOnce("LT24-ELS-01-DUN")
          .mockReturnValueOnce("LT24-ELS-01-FOIL");

        const { result } = renderHook(() =>
          useCollectibleCollectionEntry("user-123", "LT24-ELS-01", null),
        );

        const onNext = mockOnSnapshot.mock.calls[0][1];
        act(() =>
          onNext({
            docs: [
              createFakeDoc("doc-1", {
                skuId: "LT24-ELS-01-DUN",
                ownerUid: "user-123",
                quantity: 1,
              }),
            ],
          }),
        );

        expect(result.current.entry).toEqual({
          id: "doc-1",
          skuId: "LT24-ELS-01-DUN",
          ownerUid: "user-123",
          quantity: 1,
        });
        expect(result.current.loading).toBe(false);
      });
    });
  });

  describe("snapshot error callback", () => {
    it("sets error and stops loading", () => {
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
      const { result } = renderHook(() =>
        useCollectibleCollectionEntry("user-123", null, "LT24-ELS-01-DUN"),
      );

      const onError = mockOnSnapshot.mock.calls[0][2];
      const fakeError = new Error("permission-denied");

      act(() => onError(fakeError));

      expect(result.current.error).toBe(fakeError);
      expect(result.current.loading).toBe(false);
      expect(result.current.entry).toBe(null);
      expect(consoleSpy).toHaveBeenCalledWith("Failed to load collection entry", fakeError);

      consoleSpy.mockRestore();
    });
  });

  describe("cleanup and resubscription", () => {
    it("calls unsubscribe on unmount", () => {
      const unsubscribe = vi.fn();
      mockOnSnapshot.mockReturnValue(unsubscribe);

      const { unmount } = renderHook(() =>
        useCollectibleCollectionEntry("user-123", null, "LT24-ELS-01-DUN"),
      );
      expect(unsubscribe).not.toHaveBeenCalled();

      unmount();
      expect(unsubscribe).toHaveBeenCalledTimes(1);
    });

    it("resubscribes when ownerUid changes", () => {
      const unsub1 = vi.fn();
      const unsub2 = vi.fn();
      mockOnSnapshot.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);

      const { rerender } = renderHook(
        ({ ownerUid }) => useCollectibleCollectionEntry(ownerUid, null, "LT24-ELS-01-DUN"),
        { initialProps: { ownerUid: "user-A" } },
      );

      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);

      rerender({ ownerUid: "user-B" });

      expect(unsub1).toHaveBeenCalledTimes(1);
      expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
    });

    it("resubscribes when skuId changes", () => {
      const unsub1 = vi.fn();
      const unsub2 = vi.fn();
      mockOnSnapshot.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);

      const { rerender } = renderHook(
        ({ skuId }) => useCollectibleCollectionEntry("user-123", null, skuId),
        { initialProps: { skuId: "LT24-ELS-01-DUN" } },
      );

      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);

      rerender({ skuId: "LT24-ELS-01-FOIL" });

      expect(unsub1).toHaveBeenCalledTimes(1);
      expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
    });

    it("resubscribes when collectibleId changes", () => {
      const unsub1 = vi.fn();
      const unsub2 = vi.fn();
      mockOnSnapshot.mockReturnValueOnce(unsub1).mockReturnValueOnce(unsub2);

      mockGetFinishesForCard.mockReturnValueOnce(["DUN"]).mockReturnValueOnce(["FOIL"]);
      mockToSkuId.mockReturnValueOnce("LT24-ELS-01-DUN").mockReturnValueOnce("LT24-WOK-01-FOIL");

      const { rerender } = renderHook(
        ({ collectibleId }) =>
          useCollectibleCollectionEntry("user-123", collectibleId, null),
        { initialProps: { collectibleId: "LT24-ELS-01" } },
      );

      expect(mockOnSnapshot).toHaveBeenCalledTimes(1);

      rerender({ collectibleId: "LT24-WOK-01" });

      expect(unsub1).toHaveBeenCalledTimes(1);
      expect(mockOnSnapshot).toHaveBeenCalledTimes(2);
    });

    it("unsubscribes and resets state when ownerUid changes to null", () => {
      const unsubscribe = vi.fn();
      mockOnSnapshot.mockReturnValue(unsubscribe);

      const { result, rerender } = renderHook(
        ({ ownerUid }) => useCollectibleCollectionEntry(ownerUid, null, "LT24-ELS-01-DUN"),
        { initialProps: { ownerUid: "user-A" } },
      );

      const onNext = mockOnSnapshot.mock.calls[0][1];
      act(() =>
        onNext({
          docs: [
            createFakeDoc("doc-1", {
              skuId: "LT24-ELS-01-DUN",
              ownerUid: "user-A",
              quantity: 1,
            }),
          ],
        }),
      );
      expect(result.current.entry).not.toBe(null);

      rerender({ ownerUid: null });

      expect(unsubscribe).toHaveBeenCalled();
      expect(result.current.entry).toBe(null);
      expect(result.current.loading).toBe(false);
      expect(result.current.error).toBe(null);
    });

    it("does not return cleanup when params are invalid", () => {
      const { unmount } = renderHook(() =>
        useCollectibleCollectionEntry(null, "LT24-ELS-01", null),
      );
      expect(mockOnSnapshot).not.toHaveBeenCalled();
      expect(() => unmount()).not.toThrow();
    });
  });

  describe("skuId takes precedence over collectibleId", () => {
    it("when both skuId and collectibleId are provided, uses skuId path", () => {
      renderHook(() =>
        useCollectibleCollectionEntry("user-123", "LT24-ELS-01", "LT24-ELS-01-DUN"),
      );

      expect(mockGetFinishesForCard).not.toHaveBeenCalled();
      expect(mockWhere).toHaveBeenCalledWith("skuId", "==", "LT24-ELS-01-DUN");
    });
  });
});
