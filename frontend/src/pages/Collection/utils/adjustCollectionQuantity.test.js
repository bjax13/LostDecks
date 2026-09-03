import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDeleteDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockDoc = vi.fn((_, id) => ({ id }));
const mockCollection = vi.fn(() => ({ _type: "collections-ref" }));
const mockQuery = vi.fn((...args) => ({ _type: "query", args }));
const mockWhere = vi.fn((...args) => ({ _type: "where", args }));
const mockServerTimestamp = vi.fn(() => ({ _type: "serverTimestamp" }));

vi.mock("firebase/firestore", () => ({
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

const { adjustCollectionEntryQuantity, decrementCollectionBySku } = await import(
  "./adjustCollectionQuantity.js"
);

function fakeDoc(id, data) {
  return {
    id,
    data: () => data,
  };
}

describe("adjustCollectionEntryQuantity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteDoc.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
  });

  it("throws when the entry has no id", async () => {
    await expect(adjustCollectionEntryQuantity({ entry: {}, delta: -1 })).rejects.toThrow(
      "A collection entry is required to update quantity.",
    );
  });

  it("deletes the document when decrementing the last copy", async () => {
    const result = await adjustCollectionEntryQuantity({
      entry: { id: "doc-1", quantity: 1 },
      delta: -1,
    });

    expect(mockDeleteDoc).toHaveBeenCalledWith({ id: "doc-1" });
    expect(mockUpdateDoc).not.toHaveBeenCalled();
    expect(result).toEqual({ deleted: true, quantity: 0, entryId: "doc-1" });
  });

  it("deletes when the current quantity is already 0", async () => {
    const result = await adjustCollectionEntryQuantity({
      entry: { id: "doc-0", quantity: 0 },
      delta: -1,
    });

    expect(mockDeleteDoc).toHaveBeenCalledWith({ id: "doc-0" });
    expect(result.deleted).toBe(true);
  });

  it("updates quantity when copies remain", async () => {
    const result = await adjustCollectionEntryQuantity({
      entry: { id: "doc-2", quantity: 3 },
      delta: -1,
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { id: "doc-2" },
      { quantity: 2, updatedAt: { _type: "serverTimestamp" } },
    );
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(result).toEqual({ deleted: false, quantity: 2, entryId: "doc-2" });
  });

  it("uses count fallback when quantity is absent", async () => {
    await adjustCollectionEntryQuantity({
      entry: { id: "doc-count", count: 4 },
      delta: -1,
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { id: "doc-count" },
      expect.objectContaining({ quantity: 3 }),
    );
  });
});

describe("decrementCollectionBySku", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDeleteDoc.mockResolvedValue(undefined);
    mockUpdateDoc.mockResolvedValue(undefined);
    mockGetDocs.mockResolvedValue({ docs: [] });
  });

  it("throws auth-required when ownerUid is missing", async () => {
    await expect(decrementCollectionBySku({ skuId: "LT24-ELS-01-DUN" })).rejects.toMatchObject({
      message: "Authentication required",
      code: "auth-required",
    });
    expect(mockGetDocs).not.toHaveBeenCalled();
  });

  it("throws when skuId is missing", async () => {
    await expect(decrementCollectionBySku({ ownerUid: "user-1" })).rejects.toThrow(
      "A SKU is required to update the collection.",
    );
  });

  it("returns quantity 0 when no matching documents exist", async () => {
    const result = await decrementCollectionBySku({
      ownerUid: "user-1",
      skuId: "LT24-ELS-01-DUN",
    });

    expect(result).toEqual({ deleted: false, quantity: 0, entryId: null });
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it("decrements the highest-quantity document when several exist", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [
        fakeDoc("low", { skuId: "LT24-ELS-01-DUN", quantity: 1 }),
        fakeDoc("high", { skuId: "LT24-ELS-01-DUN", quantity: 4 }),
      ],
    });

    const result = await decrementCollectionBySku({
      ownerUid: "user-1",
      skuId: "LT24-ELS-01-DUN",
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { id: "high" },
      expect.objectContaining({ quantity: 3 }),
    );
    expect(result).toEqual({ deleted: false, quantity: 3, entryId: "high" });
  });

  it("deletes a single remaining copy", async () => {
    mockGetDocs.mockResolvedValue({
      docs: [fakeDoc("only", { skuId: "LT24-ELS-01-DUN", quantity: 1 })],
    });

    const result = await decrementCollectionBySku({
      ownerUid: "user-1",
      skuId: "LT24-ELS-01-DUN",
    });

    expect(mockDeleteDoc).toHaveBeenCalledWith({ id: "only" });
    expect(result).toEqual({ deleted: true, quantity: 0, entryId: "only" });
  });

  it("queries Firestore by owner and sku", async () => {
    await decrementCollectionBySku({
      ownerUid: "user-1",
      skuId: "LT24-CHM-01-DUN",
    });

    expect(mockCollection).toHaveBeenCalledWith({ type: "mock-firestore" }, "collections");
    expect(mockWhere).toHaveBeenCalledWith("ownerUid", "==", "user-1");
    expect(mockWhere).toHaveBeenCalledWith("skuId", "==", "LT24-CHM-01-DUN");
    expect(mockGetDocs).toHaveBeenCalled();
  });
});
