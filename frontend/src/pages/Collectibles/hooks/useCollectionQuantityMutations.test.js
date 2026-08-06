import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAddDoc = vi.fn();
const mockCollection = vi.fn();
const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockDoc = vi.fn((...args) => ({ path: args.join("/") }));
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockServerTimestamp = vi.fn(() => ({ _type: "serverTimestamp" }));

vi.mock("firebase/firestore", () => ({
  addDoc: (...args) => mockAddDoc(...args),
  collection: (...args) => mockCollection(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
  doc: (...args) => mockDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  query: (...args) => mockQuery(...args),
  serverTimestamp: () => mockServerTimestamp(),
  updateDoc: (...args) => mockUpdateDoc(...args),
  where: (...args) => mockWhere(...args),
}));

vi.mock("../../../lib/firebase", () => ({
  db: { type: "mock-firestore" },
}));

const mockUseAuth = vi.fn();
vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockResolveSkuId = vi.fn((card, finish) => {
  if (!card?.id) return null;
  if (card.collectibleType === "pin" || card.category === "pin") return card.id;
  if (!finish) return null;
  return `${card.id}-${finish.toUpperCase()}`;
});
vi.mock("../../../data/collectibles", () => ({
  resolveSkuId: (...args) => mockResolveSkuId(...args),
}));

const { useCollectionQuantityMutations } = await import("./useCollectionQuantityMutations.js");

function makeExistingDocs(docs) {
  return {
    docs: docs.map((docSnap) => ({
      id: docSnap.id,
      ref: { id: docSnap.id },
      data: () => docSnap.data,
    })),
  };
}

describe("useCollectionQuantityMutations", () => {
  const fakeUser = { uid: "user-123" };
  const card = { id: "LT24-ELS-01" };

  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: fakeUser });
    mockAddDoc.mockResolvedValue({ id: "doc-1" });
    mockUpdateDoc.mockResolvedValue(undefined);
    mockDeleteDoc.mockResolvedValue(undefined);
    mockCollection.mockReturnValue("collections-ref");
    mockQuery.mockReturnValue("query-ref");
    mockWhere.mockImplementation((field, op, value) => ({ field, op, value }));
    mockGetDocs.mockResolvedValue(makeExistingDocs([]));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("exposes add, decrement, and remove helpers", () => {
    const { result } = renderHook(() => useCollectionQuantityMutations());
    expect(typeof result.current.addToCollection).toBe("function");
    expect(typeof result.current.decrementFromCollection).toBe("function");
    expect(typeof result.current.removeFromCollection).toBe("function");
    expect(typeof result.current.purgeZeroQuantityEntries).toBe("function");
  });

  describe("decrementFromCollection", () => {
    it("decrements quantity on an existing SKU", async () => {
      mockGetDocs.mockResolvedValueOnce(
        makeExistingDocs([{ id: "existing-1", data: { quantity: 3 } }]),
      );
      const { result } = renderHook(() => useCollectionQuantityMutations());

      let payload;
      await act(async () => {
        payload = await result.current.decrementFromCollection({
          card,
          finish: "DUN",
          quantity: 1,
        });
      });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        { id: "existing-1" },
        expect.objectContaining({ quantity: 2 }),
      );
      expect(mockDeleteDoc).not.toHaveBeenCalled();
      expect(payload).toEqual(
        expect.objectContaining({
          skuId: "LT24-ELS-01-DUN",
          quantity: 2,
          deleted: false,
        }),
      );
    });

    it("hard-deletes when reaching zero and deleteWhenZero is true", async () => {
      mockGetDocs.mockResolvedValueOnce(
        makeExistingDocs([{ id: "existing-1", data: { quantity: 1 } }]),
      );
      const { result } = renderHook(() => useCollectionQuantityMutations());

      let payload;
      await act(async () => {
        payload = await result.current.decrementFromCollection({
          card,
          finish: "DUN",
          quantity: 1,
          deleteWhenZero: true,
        });
      });

      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(mockDeleteDoc).toHaveBeenCalledWith({ id: "existing-1" });
      expect(payload).toEqual(
        expect.objectContaining({
          quantity: 0,
          deleted: true,
        }),
      );
    });

    it("writes quantity 0 when deleteWhenZero is false (soft zero)", async () => {
      mockGetDocs.mockResolvedValueOnce(
        makeExistingDocs([{ id: "existing-1", data: { quantity: 1 } }]),
      );
      const { result } = renderHook(() => useCollectionQuantityMutations());

      let payload;
      await act(async () => {
        payload = await result.current.decrementFromCollection({
          card,
          finish: "DUN",
          quantity: 1,
          deleteWhenZero: false,
        });
      });

      expect(mockDeleteDoc).not.toHaveBeenCalled();
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        { id: "existing-1" },
        expect.objectContaining({ quantity: 0 }),
      );
      expect(payload).toEqual(
        expect.objectContaining({
          quantity: 0,
          deleted: false,
        }),
      );
    });

    it("consolidates duplicates while decrementing", async () => {
      mockGetDocs.mockResolvedValueOnce(
        makeExistingDocs([
          { id: "keep", data: { quantity: 2 } },
          { id: "dup", data: { quantity: 1 } },
        ]),
      );
      const { result } = renderHook(() => useCollectionQuantityMutations());

      let payload;
      await act(async () => {
        payload = await result.current.decrementFromCollection({
          card,
          finish: "FOIL",
          quantity: 1,
        });
      });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        { id: "keep" },
        expect.objectContaining({ quantity: 2 }),
      );
      expect(mockDeleteDoc).toHaveBeenCalledWith({ id: "dup" });
      expect(payload.quantity).toBe(2);
    });

    it("throws auth-required when signed out", async () => {
      mockUseAuth.mockReturnValue({ user: null });
      const { result } = renderHook(() => useCollectionQuantityMutations());

      let caught;
      try {
        await act(() =>
          result.current.decrementFromCollection({ card, finish: "DUN", quantity: 1 }),
        );
      } catch (err) {
        caught = err;
      }

      expect(caught.code).toBe("auth-required");
    });
  });

  describe("removeFromCollection", () => {
    it("deletes all matching docs for a SKU", async () => {
      mockGetDocs.mockResolvedValueOnce(
        makeExistingDocs([
          { id: "a", data: { quantity: 2 } },
          { id: "b", data: { quantity: 1 } },
        ]),
      );
      const { result } = renderHook(() => useCollectionQuantityMutations());

      let payload;
      await act(async () => {
        payload = await result.current.removeFromCollection({
          card,
          finish: "DUN",
        });
      });

      expect(mockDeleteDoc).toHaveBeenCalledTimes(2);
      expect(payload).toEqual(
        expect.objectContaining({
          skuId: "LT24-ELS-01-DUN",
          quantity: 0,
          deleted: true,
        }),
      );
    });

    it("returns deleted false when no docs exist", async () => {
      const { result } = renderHook(() => useCollectionQuantityMutations());

      let payload;
      await act(async () => {
        payload = await result.current.removeFromCollection({
          card,
          finish: "DUN",
        });
      });

      expect(mockDeleteDoc).not.toHaveBeenCalled();
      expect(payload.deleted).toBe(false);
    });
  });

  describe("purgeZeroQuantityEntries", () => {
    it("deletes only zero-quantity entries owned by the user", async () => {
      const { result } = renderHook(() => useCollectionQuantityMutations());

      let payload;
      await act(async () => {
        payload = await result.current.purgeZeroQuantityEntries([
          { id: "zero-1", ownerUid: "user-123", quantity: 0, skuId: "LT24-ELS-01-DUN" },
          { id: "keep-1", ownerUid: "user-123", quantity: 2, skuId: "LT24-ELS-01-FOIL" },
          { id: "other-user", ownerUid: "someone-else", quantity: 0, skuId: "PIN-1" },
        ]);
      });

      expect(mockDoc).toHaveBeenCalledWith({ type: "mock-firestore" }, "collections", "zero-1");
      expect(mockDeleteDoc).toHaveBeenCalledTimes(1);
      expect(payload.deleted).toBe(1);
    });
  });

  describe("error handling", () => {
    it("sets error status when decrement fails", async () => {
      const firestoreError = new Error("Permission denied");
      mockGetDocs.mockRejectedValueOnce(firestoreError);
      const { result } = renderHook(() => useCollectionQuantityMutations());

      await act(async () => {
        await expect(
          result.current.decrementFromCollection({ card, finish: "DUN" }),
        ).rejects.toThrow("Permission denied");
      });

      await waitFor(() => {
        expect(result.current.status).toBe("error");
        expect(result.current.error).toBe(firestoreError);
      });
    });
  });
});
