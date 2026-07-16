import { describe, expect, it } from "vitest";
import {
  getCollectibleRecord,
  getFinishesForCard,
  getSkuIdsForCollectible,
  getSkuRecord,
  getStoryTitle,
  resolveSkuId,
  toSkuId,
} from "./collectibles.js";

describe("collectibles (unit)", () => {
  describe("toSkuId", () => {
    it("returns null when cardId is missing", () => {
      expect(toSkuId(null, "DUN")).toBeNull();
      expect(toSkuId("", "DUN")).toBeNull();
    });

    it("returns null when finish is missing", () => {
      expect(toSkuId("LT24-ELS-01", null)).toBeNull();
      expect(toSkuId("LT24-ELS-01", "")).toBeNull();
    });

    it("builds hyphen-only SKU for story card", () => {
      expect(toSkuId("LT24-ELS-01", "DUN")).toBe("LT24-ELS-01-DUN");
    });

    it("uppercases finish", () => {
      expect(toSkuId("LT24-ELS-01", "dun")).toBe("LT24-ELS-01-DUN");
    });

    it("builds nonsense SKU with variant (NS card, 5+ parts, last part is alpha)", () => {
      expect(toSkuId("LT24-NS-ELS-24-DANCE", "DUN")).toBe("LT24-NS-ELS-24-DUN-DANCE");
    });
  });

  describe("resolveSkuId", () => {
    it("builds card SKUs from finish", () => {
      expect(resolveSkuId({ id: "LT24-ELS-01", collectibleType: "card" }, "DUN")).toBe(
        "LT24-ELS-01-DUN",
      );
    });

    it("returns pin SKU without finish", () => {
      expect(resolveSkuId({ id: "PIN-CF-01", collectibleType: "pin", category: "pin" })).toBe(
        "PIN-CF-01",
      );
    });

    it("returns null when collectible id is missing", () => {
      expect(resolveSkuId(null, "DUN")).toBeNull();
      expect(resolveSkuId({}, "DUN")).toBeNull();
    });
  });

  describe("getCollectibleRecord", () => {
    it("returns record for known card id", () => {
      const rec = getCollectibleRecord("LT24-ELS-01");
      expect(rec).not.toBeNull();
      expect(rec?.id).toBe("LT24-ELS-01");
      expect(rec?.collectibleType).toBe("card");
      expect(rec?.displayName).toBeDefined();
    });

    it("returns pin record with collectibleType pin", () => {
      const rec = getCollectibleRecord("PIN-CF-01");
      expect(rec).not.toBeNull();
      expect(rec?.collectibleType).toBe("pin");
      expect(rec?.category).toBe("pin");
      expect(rec?.displayName).toBe("Shreadad");
      expect(rec?.finishes).toEqual([]);
    });

    it("returns null for unknown card id", () => {
      expect(getCollectibleRecord("UNKNOWN-CARD-99")).toBeNull();
    });
  });

  describe("getSkuRecord", () => {
    it("returns sku record with card for known sku", () => {
      const rec = getSkuRecord("LT24-ELS-01-DUN");
      expect(rec).not.toBeNull();
      expect(rec?.skuId).toBeDefined();
      expect(rec?.cardId).toBeDefined();
      expect(rec?.finish).toBeDefined();
      expect(rec?.card).toBeDefined();
    });

    it("returns pin sku with null finish", () => {
      const rec = getSkuRecord("PIN-CF-01");
      expect(rec).not.toBeNull();
      expect(rec?.finish).toBeNull();
      expect(rec?.card?.collectibleType).toBe("pin");
      expect(rec?.card?.displayName).toBe("Shreadad");
    });

    it("returns null for unknown sku", () => {
      expect(getSkuRecord("UNKNOWN-SKU")).toBeNull();
    });
  });

  describe("getSkuIdsForCollectible", () => {
    it("returns card finish SKUs", () => {
      const skuIds = getSkuIdsForCollectible("LT24-ELS-01");
      expect(skuIds).toEqual(expect.arrayContaining(["LT24-ELS-01-DUN", "LT24-ELS-01-FOIL"]));
    });

    it("returns the single pin SKU", () => {
      expect(getSkuIdsForCollectible("PIN-CF-01")).toEqual(["PIN-CF-01"]);
    });

    it("returns empty array for unknown collectible", () => {
      expect(getSkuIdsForCollectible("UNKNOWN")).toEqual([]);
    });
  });

  describe("getStoryTitle", () => {
    it("returns title for known story code", () => {
      const title = getStoryTitle("ELS");
      expect(title).toBeDefined();
      expect(typeof title).toBe("string");
    });

    it("returns story code or null for unknown", () => {
      expect(getStoryTitle("UNKNOWN")).toBe("UNKNOWN");
    });
  });

  describe("getFinishesForCard", () => {
    it("returns array of finishes for known card", () => {
      const finishes = getFinishesForCard("LT24-ELS-01");
      expect(Array.isArray(finishes)).toBe(true);
    });

    it("returns empty array for pins", () => {
      expect(getFinishesForCard("PIN-CF-01")).toEqual([]);
    });

    it("returns empty array for unknown card", () => {
      expect(getFinishesForCard("UNKNOWN-CARD")).toEqual([]);
    });
  });
});
