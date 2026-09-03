import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAddDoc = vi.fn();
const mockCollection = vi.fn();
const mockGetDocs = vi.fn();
const mockUpdateDoc = vi.fn();
const mockDeleteDoc = vi.fn();
const mockQuery = vi.fn();
const mockWhere = vi.fn();
const mockServerTimestamp = vi.fn(() => ({ _type: "serverTimestamp" }));

vi.mock("firebase/firestore", () => ({
  addDoc: (...args) => mockAddDoc(...args),
  collection: (...args) => mockCollection(...args),
  deleteDoc: (...args) => mockDeleteDoc(...args),
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

const { useAddToCollection } = await import("./useAddToCollection.js");

function makeExistingDocs(docs) {
  return {
    docs: docs.map((doc) => ({
      id: doc.id,
      ref: { id: doc.id },
      data: () => doc.data,
    })),
  };
}

describe("useAddToCollection", () => {
  const fakeUser = { uid: "user-123" };

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

  it("returns initial idle state", () => {
    const { result } = renderHook(() => useAddToCollection());

    expect(result.current.status).toBe("idle");
    expect(result.current.error).toBeNull();
    expect(result.current.user).toBe(fakeUser);
    expect(typeof result.current.addToCollection).toBe("function");
    expect(typeof result.current.reset).toBe("function");
  });

  describe("validation errors", () => {
    it("throws when card is missing", async () => {
      const { result } = renderHook(() => useAddToCollection());

      await expect(
        act(() => result.current.addToCollection({ card: null, finish: "DUN" })),
      ).rejects.toThrow("A valid collectible is required");
    });

    it("throws when card has no id", async () => {
      const { result } = renderHook(() => useAddToCollection());

      await expect(
        act(() => result.current.addToCollection({ card: {}, finish: "DUN" })),
      ).rejects.toThrow("A valid collectible is required");
    });

    it("throws when finish is missing for cards", async () => {
      const { result } = renderHook(() => useAddToCollection());

      await expect(
        act(() => result.current.addToCollection({ card: { id: "LT24-ELS-01" } })),
      ).rejects.toThrow("A finish is required");
    });

    it("allows pins to be added without a finish", async () => {
      const { result } = renderHook(() => useAddToCollection());

      let payload;
      await act(async () => {
        payload = await result.current.addToCollection({
          card: { id: "PIN-CF-01", collectibleType: "pin", category: "pin" },
        });
      });

      expect(result.current.status).toBe("success");
      expect(payload.skuId).toBe("PIN-CF-01");
      expect(mockAddDoc).toHaveBeenCalled();
    });

    it("throws with auth-required code when user is not logged in", async () => {
      mockUseAuth.mockReturnValue({ user: null });
      const { result } = renderHook(() => useAddToCollection());

      let caughtError;
      try {
        await act(() =>
          result.current.addToCollection({ card: { id: "LT24-ELS-01" }, finish: "DUN" }),
        );
      } catch (err) {
        caughtError = err;
      }

      expect(caughtError.message).toBe("Authentication required");
      expect(caughtError.code).toBe("auth-required");
    });
  });

  describe("create when missing", () => {
    it("creates a document when no matching SKU exists", async () => {
      const { result } = renderHook(() => useAddToCollection());

      let payload;
      await act(async () => {
        payload = await result.current.addToCollection({
          card: { id: "LT24-ELS-01" },
          finish: "DUN",
        });
      });

      expect(mockGetDocs).toHaveBeenCalled();
      expect(mockAddDoc).toHaveBeenCalledWith(
        "collections-ref",
        expect.objectContaining({
          ownerUid: "user-123",
          skuId: "LT24-ELS-01-DUN",
          quantity: 1,
        }),
      );
      expect(mockUpdateDoc).not.toHaveBeenCalled();
      expect(payload.quantity).toBe(1);
      expect(result.current.status).toBe("success");
    });

    it("uses the provided quantity on create", async () => {
      const { result } = renderHook(() => useAddToCollection());

      await act(async () => {
        await result.current.addToCollection({
          card: { id: "LT24-ELS-01" },
          finish: "FOIL",
          quantity: 3,
        });
      });

      expect(mockAddDoc).toHaveBeenCalledWith(
        "collections-ref",
        expect.objectContaining({ quantity: 3 }),
      );
    });

    it("includes trimmed notes when provided", async () => {
      const { result } = renderHook(() => useAddToCollection());

      await act(async () => {
        await result.current.addToCollection({
          card: { id: "LT24-ELS-01" },
          finish: "DUN",
          notes: "  My favorite card  ",
        });
      });

      expect(mockAddDoc).toHaveBeenCalledWith(
        "collections-ref",
        expect.objectContaining({ notes: "My favorite card" }),
      );
    });
  });

  describe("increment when present", () => {
    it("increments quantity on an existing matching SKU doc", async () => {
      mockGetDocs.mockResolvedValueOnce(
        makeExistingDocs([{ id: "existing-1", data: { quantity: 2 } }]),
      );
      const { result } = renderHook(() => useAddToCollection());

      let payload;
      await act(async () => {
        payload = await result.current.addToCollection({
          card: { id: "LT24-ELS-01" },
          finish: "DUN",
          quantity: 1,
        });
      });

      expect(mockAddDoc).not.toHaveBeenCalled();
      expect(mockUpdateDoc).toHaveBeenCalledWith(
        { id: "existing-1" },
        expect.objectContaining({ quantity: 3 }),
      );
      expect(payload.quantity).toBe(3);
      expect(result.current.status).toBe("success");
    });
  });

  describe("consolidate duplicates", () => {
    it("sums duplicates onto one keeper and deletes extras", async () => {
      mockGetDocs.mockResolvedValueOnce(
        makeExistingDocs([
          { id: "keep", data: { quantity: 1 } },
          { id: "dup-a", data: { quantity: 1 } },
          { id: "dup-b", data: { quantity: 2 } },
        ]),
      );
      const { result } = renderHook(() => useAddToCollection());

      let payload;
      await act(async () => {
        payload = await result.current.addToCollection({
          card: { id: "LT24-ELS-01" },
          finish: "DUN",
          quantity: 1,
        });
      });

      expect(mockUpdateDoc).toHaveBeenCalledWith(
        { id: "keep" },
        expect.objectContaining({ quantity: 5 }),
      );
      expect(mockDeleteDoc).toHaveBeenCalledTimes(2);
      expect(mockDeleteDoc).toHaveBeenCalledWith({ id: "dup-a" });
      expect(mockDeleteDoc).toHaveBeenCalledWith({ id: "dup-b" });
      expect(payload.quantity).toBe(5);
    });
  });

  describe("Firestore error handling", () => {
    it("sets error status when getDocs/add fails", async () => {
      const firestoreError = new Error("Permission denied");
      mockGetDocs.mockRejectedValueOnce(firestoreError);

      const { result } = renderHook(() => useAddToCollection());

      await act(async () => {
        await expect(
          result.current.addToCollection({
            card: { id: "LT24-ELS-01" },
            finish: "DUN",
          }),
        ).rejects.toThrow("Permission denied");
      });

      await waitFor(() => {
        expect(result.current.status).toBe("error");
        expect(result.current.error).toBe(firestoreError);
      });
    });
  });

  describe("invalid SKU", () => {
    it("throws when resolveSkuId returns null", async () => {
      mockResolveSkuId.mockReturnValueOnce(null);
      const { result } = renderHook(() => useAddToCollection());

      await expect(
        act(() =>
          result.current.addToCollection({
            card: { id: "UNKNOWN-CARD" },
            finish: "DUN",
          }),
        ),
      ).rejects.toThrow("Invalid card or finish.");
    });
  });

  describe("reset", () => {
    it("resets status and error back to idle/null", async () => {
      const firestoreError = new Error("fail");
      mockGetDocs.mockRejectedValueOnce(firestoreError);

      const { result } = renderHook(() => useAddToCollection());

      await act(async () => {
        await expect(
          result.current.addToCollection({
            card: { id: "LT24-ELS-01" },
            finish: "DUN",
          }),
        ).rejects.toThrow("fail");
      });

      await waitFor(() => {
        expect(result.current.status).toBe("error");
      });

      act(() => result.current.reset());

      expect(result.current.status).toBe("idle");
      expect(result.current.error).toBeNull();
    });
  });
});
