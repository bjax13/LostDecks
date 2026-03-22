import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  acceptListing,
  cancelListing,
  createListing,
  LISTINGS_PATH,
  subscribeOpenListings,
} from "./listings.js";

const mockOnSnapshot = vi.fn();
const mockRunTransaction = vi.fn();
const mockAddDoc = vi.fn();
const mockHttpsCallable = vi.fn();

vi.mock("firebase/firestore", () => ({
  addDoc: (...args) => mockAddDoc(...args),
  collection: (_db, path) => ({ _type: "collection", path }),
  doc: (_db, path, id) => ({ _type: "doc", path, id }),
  onSnapshot: (...args) => mockOnSnapshot(...args),
  orderBy: (field, dir) => ({ _type: "orderBy", field, dir }),
  query: (...args) => args,
  runTransaction: (_db, fn) => mockRunTransaction(fn),
  serverTimestamp: () => ({ _type: "serverTimestamp" }),
  where: (field, op, val) => ({ _type: "where", field, op, val }),
}));

vi.mock("firebase/functions", () => ({
  httpsCallable: (...args) => mockHttpsCallable(...args),
}));

vi.mock("../firebase", () => ({
  db: {},
  functions: {},
}));

describe("listings (unit)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("LISTINGS_PATH", () => {
    it("exports listings path", () => {
      expect(LISTINGS_PATH).toBe("listings");
    });
  });

  describe("subscribeOpenListings", () => {
    it("subscribes with status OPEN and orderBy createdAt", () => {
      const onNext = vi.fn();
      const onError = vi.fn();
      subscribeOpenListings({}, onNext, onError);
      expect(mockOnSnapshot).toHaveBeenCalled();
      const [q] = mockOnSnapshot.mock.calls[0];
      expect(q.some((c) => c._type === "where" && c.field === "status")).toBe(true);
    });

    it("adds cardId filter when cardId provided", () => {
      const onNext = vi.fn();
      subscribeOpenListings({ cardId: "LT24-ELS-01" }, onNext);
      expect(mockOnSnapshot).toHaveBeenCalled();
      const [q] = mockOnSnapshot.mock.calls[0];
      expect(
        q.some((c) => c._type === "where" && c.field === "cardId" && c.val === "LT24-ELS-01"),
      ).toBe(true);
    });
  });

  describe("cancelListing", () => {
    it("throws when listingId missing", async () => {
      await expect(cancelListing({ cancelledByUid: "u1" })).rejects.toThrow(
        "Missing required cancel fields",
      );
    });

    it("throws when cancelledByUid missing", async () => {
      await expect(cancelListing({ listingId: "l1" })).rejects.toThrow(
        "Missing required cancel fields",
      );
    });

    it("throws when listing not found", async () => {
      mockRunTransaction.mockImplementation(async (fn) => {
        const tx = {
          get: vi.fn().mockResolvedValue({ exists: () => false }),
        };
        return fn(tx);
      });
      await expect(cancelListing({ listingId: "l1", cancelledByUid: "u1" })).rejects.toThrow(
        "Listing not found",
      );
    });

    it("throws when listing is not open", async () => {
      mockRunTransaction.mockImplementation(async (fn) => {
        const tx = {
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            id: "l1",
            data: () => ({ status: "CANCELLED", createdByUid: "u1" }),
          }),
          update: vi.fn(),
        };
        return fn(tx);
      });
      await expect(cancelListing({ listingId: "l1", cancelledByUid: "u1" })).rejects.toThrow(
        "Listing is not open",
      );
    });

    it("throws when user is not creator", async () => {
      mockRunTransaction.mockImplementation(async (fn) => {
        const tx = {
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            id: "l1",
            data: () => ({ status: "OPEN", createdByUid: "other" }),
          }),
          update: vi.fn(),
        };
        return fn(tx);
      });
      await expect(cancelListing({ listingId: "l1", cancelledByUid: "u1" })).rejects.toThrow(
        "Only the creator can cancel this listing",
      );
    });

    it("updates and returns listing when valid", async () => {
      const listingData = { status: "OPEN", createdByUid: "u1" };
      let capturedTx;
      mockRunTransaction.mockImplementation(async (fn) => {
        const tx = {
          get: vi.fn().mockResolvedValue({
            exists: () => true,
            id: "l1",
            data: () => listingData,
          }),
          update: vi.fn(),
        };
        capturedTx = tx;
        return fn(tx);
      });
      const result = await cancelListing({ listingId: "l1", cancelledByUid: "u1" });
      expect(result).toEqual({ id: "l1", ...listingData });
      expect(capturedTx.update).toHaveBeenCalled();
    });
  });

  describe("acceptListing", () => {
    it("throws when listingId missing", async () => {
      await expect(acceptListing({})).rejects.toThrow("listingId is required");
    });

    it("calls Cloud Function and returns data", async () => {
      const mockCall = vi.fn().mockResolvedValue({ data: { tradeId: "t1" } });
      mockHttpsCallable.mockReturnValue(mockCall);
      const result = await acceptListing({ listingId: "l1" });
      expect(result).toEqual({ tradeId: "t1" });
      expect(mockCall).toHaveBeenCalledWith({ listingId: "l1" });
    });
  });

  describe("createListing", () => {
    it("throws when required fields missing", async () => {
      await expect(createListing({ type: "SELL", cardId: "c1" })).rejects.toThrow(
        "Missing required listing fields",
      );
    });

    it("writes to Firestore with payload", async () => {
      mockAddDoc.mockResolvedValue({ id: "new-id" });
      await createListing({
        type: "SELL",
        cardId: "c1",
        createdByUid: "u1",
        priceCents: 100,
      });
      expect(mockAddDoc).toHaveBeenCalled();
      const [, payload] = mockAddDoc.mock.calls[0];
      expect(payload).toMatchObject({
        type: "SELL",
        status: "OPEN",
        cardId: "c1",
        createdByUid: "u1",
        priceCents: 100,
        currency: "USD",
        quantity: 1,
        createdByDisplayName: "Anonymous",
      });
    });

    it("uses createdByDisplayName when provided", async () => {
      mockAddDoc.mockResolvedValue({ id: "new-id" });
      await createListing({
        type: "SELL",
        cardId: "c1",
        createdByUid: "u1",
        createdByDisplayName: "Test User",
      });
      const [, payload] = mockAddDoc.mock.calls[0];
      expect(payload.createdByDisplayName).toBe("Test User");
    });
  });
});
