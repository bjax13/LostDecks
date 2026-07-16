import { describe, expect, it, vi } from "vitest";
import { buildOwnedQuantityBySkuId, getOwnedQuantity } from "./ownedQuantities.js";

vi.mock("../../../data/collectibles", () => ({
  resolveSkuId: (collectible, finish) => {
    if (!collectible?.id) return null;
    if (collectible.collectibleType === "pin" || collectible.category === "pin") {
      return collectible.id;
    }
    if (!finish) return null;
    return `${collectible.id}-${String(finish).toUpperCase()}`;
  },
}));

vi.mock("../../Collection/collectionPresentation.jsx", () => ({
  normalizeQuantity: (entry) => {
    if (typeof entry.quantity === "number") return entry.quantity;
    if (typeof entry.count === "number") return entry.count;
    return 1;
  },
}));

describe("buildOwnedQuantityBySkuId", () => {
  it("returns empty object for non-arrays", () => {
    expect(buildOwnedQuantityBySkuId(null)).toEqual({});
    expect(buildOwnedQuantityBySkuId(undefined)).toEqual({});
  });

  it("sums quantities for the same skuId and skips invalid entries", () => {
    expect(
      buildOwnedQuantityBySkuId([
        { skuId: "LT24-ELS-01-DUN", quantity: 2 },
        { skuId: "LT24-ELS-01-DUN", quantity: 1 },
        { skuId: "LT24-ELS-01-FOIL", count: 3 },
        { skuId: null, quantity: 5 },
        { skuId: "LT24-ELS-01-DUN", quantity: 0 },
      ]),
    ).toEqual({
      "LT24-ELS-01-DUN": 3,
      "LT24-ELS-01-FOIL": 3,
    });
  });
});

describe("getOwnedQuantity", () => {
  it("returns 0 when map or collectible is missing", () => {
    expect(getOwnedQuantity(null, { id: "x" }, "DUN")).toBe(0);
    expect(getOwnedQuantity({}, null, "DUN")).toBe(0);
  });

  it("resolves finish and pin quantities from the map", () => {
    const owned = {
      "LT24-ELS-01-DUN": 2,
      "PIN-CF-01": 4,
    };
    expect(getOwnedQuantity(owned, { id: "LT24-ELS-01" }, "DUN")).toBe(2);
    expect(getOwnedQuantity(owned, { id: "LT24-ELS-01" }, "FOIL")).toBe(0);
    expect(getOwnedQuantity(owned, { id: "PIN-CF-01", collectibleType: "pin" }, null)).toBe(4);
  });
});
