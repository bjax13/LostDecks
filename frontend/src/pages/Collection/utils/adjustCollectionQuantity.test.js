import { beforeEach, describe, expect, it, vi } from "vitest";

const mockDeleteDoc = vi.fn();
const mockUpdateDoc = vi.fn();
const mockGetDocs = vi.fn();
const mockDoc = vi.fn((_, id) => ({ id }));
const mockCollection = vi.fn(() => ({ _type: "collections-ref" }));
const mockQuery = vi.fn((...args) => ({ _type: "query", args }));
const mockWhere = vi.fn((...args) => ({ _type: "where", args }));
const mockServerTimestamp = vi.fn(() => ({ _type: "serverTimestamp" }));
const mockRunTransaction = vi.fn();

const firestoreDocs = new Map();

vi.mock("firebase/firestore", () => ({
  collection: (...args) => mockCollection(...args),
  doc: (...args) => mockDoc(...args),
  getDocs: (...args) => mockGetDocs(...args),
  query: (...args) => mockQuery(...args),
  runTransaction: (...args) => mockRunTransaction(...args),
  serverTimestamp: () => mockServerTimestamp(),
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

function seedDoc(id, data) {
  firestoreDocs.set(id, { ...data });
}

describe("adjustCollectionEntryQuantity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    firestoreDocs.clear();
    mockRunTransaction.mockImplementation(async (_db, updater) => {
      const transaction = {
        get: async (ref) => {
          const data = firestoreDocs.get(ref.id);
          return {
            exists: () => data !== undefined,
            id: ref.id,
            data: () => data,
          };
        },
        update: (ref, patch) => {
          mockUpdateDoc(ref, patch);
          const current = firestoreDocs.get(ref.id) ?? {};
          firestoreDocs.set(ref.id, { ...current, ...patch });
        },
        delete: (ref) => {
          mockDeleteDoc(ref);
          firestoreDocs.delete(ref.id);
        },
      };
      return updater(transaction);
    });
  });

  it("throws when the entry has no id", async () => {
    await expect(adjustCollectionEntryQuantity({ entry: {}, delta: -1 })).rejects.toThrow(
      "A collection entry is required to update quantity.",
    );
    expect(mockRunTransaction).not.toHaveBeenCalled();
  });

  it("deletes the document when decrementing the last copy", async () => {
    seedDoc("doc-1", { quantity: 1 });
    const result = await adjustCollectionEntryQuantity({
      entry: { id: "doc-1", quantity: 1 },
      delta: -1,
    });

    expect(mockDeleteDoc).toHaveBeenCalledWith({ id: "doc-1" });
    expect(mockUpdateDoc).not.toHaveBeenCalled();
    expect(result).toEqual({ deleted: true, quantity: 0, entryId: "doc-1" });
  });

  it("deletes when the current quantity is already 0", async () => {
    seedDoc("doc-0", { quantity: 0 });
    const result = await adjustCollectionEntryQuantity({
      entry: { id: "doc-0", quantity: 0 },
      delta: -1,
    });

    expect(mockDeleteDoc).toHaveBeenCalledWith({ id: "doc-0" });
    expect(result.deleted).toBe(true);
  });

  it("updates quantity when copies remain", async () => {
    seedDoc("doc-2", { quantity: 3 });
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

  it("uses the live document quantity instead of a stale client value", async () => {
    seedDoc("doc-stale", { quantity: 5 });
    const result = await adjustCollectionEntryQuantity({
      entry: { id: "doc-stale", quantity: 2 },
      delta: -1,
    });

    expect(mockUpdateDoc).toHaveBeenCalledWith(
      { id: "doc-stale" },
      expect.objectContaining({ quantity: 4 }),
    );
    expect(result).toEqual({ deleted: false, quantity: 4, entryId: "doc-stale" });
  });

  it("returns deleted when the document no longer exists", async () => {
    const result = await adjustCollectionEntryQuantity({
      entry: { id: "gone", quantity: 2 },
      delta: -1,
    });

    expect(result).toEqual({ deleted: true, quantity: 0, entryId: "gone" });
    expect(mockDeleteDoc).not.toHaveBeenCalled();
    expect(mockUpdateDoc).not.toHaveBeenCalled();
  });

  it("uses count fallback when quantity is absent", async () => {
    seedDoc("doc-count", { count: 4 });
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
    firestoreDocs.clear();
    mockRunTransaction.mockImplementation(async (_db, updater) => {
      const transaction = {
        get: async (ref) => {
          const data = firestoreDocs.get(ref.id);
          return {
            exists: () => data !== undefined,
            id: ref.id,
            data: () => data,
          };
        },
        update: (ref, patch) => {
          mockUpdateDoc(ref, patch);
          const current = firestoreDocs.get(ref.id) ?? {};
          firestoreDocs.set(ref.id, { ...current, ...patch });
        },
        delete: (ref) => {
          mockDeleteDoc(ref);
          firestoreDocs.delete(ref.id);
        },
      };
      return updater(transaction);
    });
    mockGetDocs.mockImplementation(async () => ({
      docs: [...firestoreDocs.entries()].map(([id, data]) => fakeDoc(id, data)),
    }));
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
    seedDoc("low", { skuId: "LT24-ELS-01-DUN", quantity: 1 });
    seedDoc("high", { skuId: "LT24-ELS-01-DUN", quantity: 4 });

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
    seedDoc("only", { skuId: "LT24-ELS-01-DUN", quantity: 1 });

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
