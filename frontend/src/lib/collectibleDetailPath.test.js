import { describe, expect, it } from "vitest";
import { collectibleDetailPath, isDoubledCollectibleDetailPath } from "./collectibleDetailPath";

describe("collectibleDetailPath", () => {
  it("builds a single-segment path from a collectible id", () => {
    expect(collectibleDetailPath("LT24-ELS-01")).toBe("/collectibles/LT24-ELS-01");
    expect(collectibleDetailPath("PIN-CF-02", null)).toBe("/collectibles/PIN-CF-02");
  });

  it("keeps a distinct finish SKU as the second segment", () => {
    expect(collectibleDetailPath("LT24-ELS-01", "LT24-ELS-01-DUN")).toBe(
      "/collectibles/LT24-ELS-01/LT24-ELS-01-DUN",
    );
  });

  it("does not repeat an id when the SKU matches the collectible", () => {
    expect(collectibleDetailPath("PIN-CF-02", "PIN-CF-02")).toBe("/collectibles/PIN-CF-02");
    expect(collectibleDetailPath(" PIN-CF-02 ", "PIN-CF-02")).toBe("/collectibles/PIN-CF-02");
  });

  it("returns null when there is no collectible id", () => {
    expect(collectibleDetailPath(null, "PIN-CF-02")).toBeNull();
    expect(collectibleDetailPath("", "PIN-CF-02")).toBeNull();
    expect(collectibleDetailPath("   ", "PIN-CF-02")).toBeNull();
  });
});

describe("isDoubledCollectibleDetailPath", () => {
  it("flags only a repeated id segment", () => {
    expect(isDoubledCollectibleDetailPath("/collectibles/PIN-CF-02/PIN-CF-02")).toBe(true);
    expect(isDoubledCollectibleDetailPath("/collectibles/PIN-CF-02")).toBe(false);
    expect(isDoubledCollectibleDetailPath("/collectibles/LT24-ELS-01/LT24-ELS-01-DUN")).toBe(false);
    expect(isDoubledCollectibleDetailPath("/collectibles")).toBe(false);
  });
});
