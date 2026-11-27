import { describe, expect, it } from "vitest";
import { mapImportIssuesToRowIds, mergeDraftRowsForImport } from "./aiPhotoImportDraft.js";

describe("mergeDraftRowsForImport", () => {
  it("sums quantity for duplicate SKUs", () => {
    const merged = mergeDraftRowsForImport([
      { id: "a", skuId: "LT24-ELS-01-DUN", quantity: 1, notes: "" },
      { id: "b", skuId: "lt24-els-01-dun", quantity: 2, notes: "foil shot" },
    ]);
    expect(merged).toHaveLength(1);
    expect(merged[0]).toMatchObject({
      skuId: "LT24-ELS-01-DUN",
      quantity: "3",
      notes: "foil shot",
      sourceRowIds: ["a", "b"],
    });
  });

  it("clamps merged quantity to the collection maximum", () => {
    const merged = mergeDraftRowsForImport([
      { id: "a", skuId: "LT24-ELS-01-DUN", quantity: 600, notes: "" },
      { id: "b", skuId: "LT24-ELS-01-DUN", quantity: 500, notes: "" },
    ]);
    expect(merged[0].quantity).toBe("999");
  });
});

describe("mapImportIssuesToRowIds", () => {
  it("maps bulk import issue lines back to source draft rows", () => {
    const merged = mergeDraftRowsForImport([
      { id: "a", skuId: "LT24-ELS-01-DUN", quantity: 1 },
      { id: "b", skuId: "PIN-CF-01", quantity: 1 },
    ]);
    const byRowId = mapImportIssuesToRowIds(
      [{ line: 2, message: "Quantity 1000 exceeds the maximum of 999." }],
      merged,
    );
    expect(byRowId.get("b")).toMatch(/exceeds the maximum/);
    expect(byRowId.has("a")).toBe(false);
  });
});
