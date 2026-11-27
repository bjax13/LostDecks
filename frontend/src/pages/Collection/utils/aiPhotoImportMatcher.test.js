import { describe, expect, it } from "vitest";
import {
  matchExtractionsToCatalog,
  matchExtractionToCatalog,
  rankCatalogMatchesForExtraction,
} from "./aiPhotoImportMatcher.js";

describe("aiPhotoImportMatcher", () => {
  it("matches a known printed SKU id", () => {
    const match = matchExtractionToCatalog({
      name: "Elsecaller",
      printedId: "LT24-ELS-01-DUN",
      kind: "card",
      confidence: 0.9,
    });
    expect(match.skuId).toBe("LT24-ELS-01-DUN");
    expect(match.matchConfidence).toBeGreaterThan(0.8);
  });

  it("matches a pin id", () => {
    const match = matchExtractionToCatalog({
      name: "Chasmfriends pin",
      printedId: "PIN-CF-01",
      kind: "pin",
      confidence: 0.85,
    });
    expect(match.skuId).toBe("PIN-CF-01");
  });

  it("finds fuzzy card candidates from title text", () => {
    const candidates = rankCatalogMatchesForExtraction({
      name: "Elsecaller #01",
      finish: "DUN",
      kind: "card",
      confidence: 0.6,
    });
    expect(candidates.length).toBeGreaterThan(0);
    expect(candidates[0].skuId).toMatch(/LT24-ELS-01/);
  });

  it("maps multiple extractions", () => {
    const rows = matchExtractionsToCatalog([
      { name: "Pin 1", printedId: "PIN-CF-01", kind: "pin", confidence: 0.7 },
      { name: "Card", printedId: "LT24-ELS-02-DUN", kind: "card", confidence: 0.8 },
    ]);
    expect(rows).toHaveLength(2);
    expect(rows[1].skuId).toBe("LT24-ELS-02-DUN");
  });
});
