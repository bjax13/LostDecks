import { describe, expect, it, vi } from "vitest";
import {
  collectionEntriesHydrationKey,
  ownedQuantityFromEntry,
  resolveCollectionEntrySkuId,
} from "./collectionEntrySku.js";

vi.mock("../../../data/collectibles", () => ({
  getSkuRecord: (skuId) =>
    ["LT24-CHM-01-DUN", "PIN-CF-01"].includes(String(skuId).toUpperCase()) ? { skuId } : null,
  toSkuId: (cardId, finish) => `${cardId}-${finish}`,
}));

describe("collectionEntrySku", () => {
  it("resolves skuId-only, cardId+finish, and catalog id-only Firestore docs", () => {
    expect(resolveCollectionEntrySkuId({ skuId: "LT24-CHM-01-DUN", quantity: 1 })).toBe(
      "LT24-CHM-01-DUN",
    );
    expect(resolveCollectionEntrySkuId({ cardId: "LT24-CHM-01", finish: "DUN", count: 1 })).toBe(
      "LT24-CHM-01-DUN",
    );
    expect(resolveCollectionEntrySkuId({ id: "PIN-CF-01", quantity: 1 })).toBe("PIN-CF-01");
  });

  it("reads quantity from legacy count/copies fields", () => {
    expect(ownedQuantityFromEntry({ quantity: 2 })).toBe(2);
    expect(ownedQuantityFromEntry({ count: 3 })).toBe(3);
    expect(ownedQuantityFromEntry({ copies: 1 })).toBe(1);
  });

  it("parses numeric strings like the legacy bulk import grouper", () => {
    expect(ownedQuantityFromEntry({ id: "PIN-CF-01", quantity: "2" })).toBe(2);
    expect(ownedQuantityFromEntry({ id: "LT24-CHM-01-DUN", count: "3" })).toBe(3);
  });

  it("builds a hydration signature that changes when resolved SKUs change", () => {
    const before = collectionEntriesHydrationKey([{ id: "PIN-CF-01", quantity: 1 }]);
    const after = collectionEntriesHydrationKey([
      { id: "PIN-CF-01", quantity: 1 },
      { id: "LT24-CHM-01-DUN", quantity: 1 },
    ]);
    expect(before).not.toBe(after);
  });
});
