import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mockAddDoc = vi.fn();
const mockCollection = vi.fn();
const mockServerTimestamp = vi.fn(() => ({ _type: "serverTimestamp" }));

vi.mock("firebase/firestore", () => ({
  addDoc: (...args) => mockAddDoc(...args),
  collection: (...args) => mockCollection(...args),
  serverTimestamp: () => mockServerTimestamp(),
}));

vi.mock("../../../lib/firebase", () => ({
  db: { type: "mock-firestore" },
}));

const mockUseAuth = vi.fn();
vi.mock("../../../contexts/AuthContext", () => ({
  useAuth: () => mockUseAuth(),
}));

const mockToSkuId = vi.fn((cardId, finish) => {
  if (!cardId || !finish) return null;
  return `${cardId}-${finish.toUpperCase()}`;
});
vi.mock("../../../data/collectibles", () => ({
  toSkuId: (...args) => mockToSkuId(...args),
}));

const { useAddToCollection } = await import("./useAddToCollection.js");

describe("useAddToCollection", () => {
  const fakeUser = { uid: "user-123" };

  beforeEach(() => {
    mockUseAuth.mockReturnValue({ user: fakeUser });
    mockAddDoc.mockResolvedValue({ id: "doc-1" });
    mockCollection.mockReturnValue("collections-ref");
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

    it("throws when finish is missing", async () => {
      const { result } = renderHook(() => useAddToCollection());

      await expect(
        act(() => result.current.addToCollection({ card: { id: "LT24-ELS-01" } })),
      ).rejects.toThrow("A finish is required");
    });

    it("throws when finish is explicitly null", async () => {
      const { result } = renderHook(() => useAddToCollection());

      await expect(
        act(() =>
          result.current.addToCollection({ card: { id: "LT24-ELS-01" }, finish: null }),
        ),
      ).rejects.toThrow("A finish is required");
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

  describe("successful add", () => {
    it("adds a document to Firestore and sets status to success", async () => {
      const { result } = renderHook(() => useAddToCollection());

      let payload;
      await act(async () => {
        payload = await result.current.addToCollection({
          card: { id: "LT24-ELS-01" },
          finish: "DUN",
        });
      });

      expect(result.current.status).toBe("success");
      expect(result.current.error).toBeNull();

      expect(mockCollection).toHaveBeenCalledWith({ type: "mock-firestore" }, "collections");
      expect(mockAddDoc).toHaveBeenCalledWith("collections-ref", expect.objectContaining({
        ownerUid: "user-123",
        skuId: "LT24-ELS-01-DUN",
        quantity: 1,
      }));

      expect(payload.ownerUid).toBe("user-123");
      expect(payload.skuId).toBe("LT24-ELS-01-DUN");
      expect(payload.quantity).toBe(1);
    });

    it("uses the provided quantity", async () => {
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

    it("omits notes when empty string", async () => {
      const { result } = renderHook(() => useAddToCollection());

      await act(async () => {
        await result.current.addToCollection({
          card: { id: "LT24-ELS-01" },
          finish: "DUN",
          notes: "   ",
        });
      });

      const payload = mockAddDoc.mock.calls[0][1];
      expect(payload).not.toHaveProperty("notes");
    });

    it("omits notes when not a string", async () => {
      const { result } = renderHook(() => useAddToCollection());

      await act(async () => {
        await result.current.addToCollection({
          card: { id: "LT24-ELS-01" },
          finish: "DUN",
          notes: undefined,
        });
      });

      const payload = mockAddDoc.mock.calls[0][1];
      expect(payload).not.toHaveProperty("notes");
    });

    it("includes serverTimestamp in updatedAt", async () => {
      const { result } = renderHook(() => useAddToCollection());

      await act(async () => {
        await result.current.addToCollection({
          card: { id: "LT24-ELS-01" },
          finish: "DUN",
        });
      });

      expect(mockAddDoc).toHaveBeenCalledWith(
        "collections-ref",
        expect.objectContaining({ updatedAt: { _type: "serverTimestamp" } }),
      );
    });
  });

  describe("Firestore error handling", () => {
    it("sets error status when addDoc fails", async () => {
      const firestoreError = new Error("Permission denied");
      mockAddDoc.mockRejectedValueOnce(firestoreError);

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

    it("sets status to loading before the Firestore call", async () => {
      let statusDuringCall;
      mockAddDoc.mockImplementationOnce(() => {
        return new Promise(() => {});
      });

      const { result } = renderHook(() => useAddToCollection());

      act(() => {
        result.current.addToCollection({
          card: { id: "LT24-ELS-01" },
          finish: "DUN",
        });
      });

      statusDuringCall = result.current.status;
      expect(statusDuringCall).toBe("loading");
    });
  });

  describe("invalid SKU", () => {
    it("throws when toSkuId returns null", async () => {
      mockToSkuId.mockReturnValueOnce(null);
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
      mockAddDoc.mockRejectedValueOnce(firestoreError);

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
        expect(result.current.error).toBe(firestoreError);
      });

      act(() => result.current.reset());

      expect(result.current.status).toBe("idle");
      expect(result.current.error).toBeNull();
    });

    it("resets after a successful add", async () => {
      const { result } = renderHook(() => useAddToCollection());

      await act(async () => {
        await result.current.addToCollection({
          card: { id: "LT24-ELS-01" },
          finish: "DUN",
        });
      });

      expect(result.current.status).toBe("success");

      act(() => result.current.reset());

      expect(result.current.status).toBe("idle");
      expect(result.current.error).toBeNull();
    });
  });
});
