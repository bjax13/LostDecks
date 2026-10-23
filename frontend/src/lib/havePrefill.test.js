import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { decodeHavePrefill, emptyHavePrefill, HAVE_QTY_MAX } from "./havePrefill.js";

const catalogPath = join(dirname(fileURLToPath(import.meta.url)), "../storyData/pins-catalog.json");
const catalogSkuIds = JSON.parse(readFileSync(catalogPath, "utf8")).pins.map((pin) => pin.id);

const seriesList = [
  {
    id: "pins:ChasmFriends",
    skuIds: ["PIN-CF-01", "PIN-CF-02", "PIN-CF-03", "PIN-CF-04", "PIN-CF-05"],
  },
  { id: "pins:CPS1", skuIds: ["PIN-CPS1-00", "PIN-CPS1-01"] },
  { id: "pins:KROG", skuIds: ["PIN-KROG-05", "PIN-KROG-02"] },
  { id: "pins:OTHER", skuIds: ["PIN-OTHER-01"] },
];

const ctx = { catalogSkuIds, seriesList };

describe("decodeHavePrefill", () => {
  it("returns emptyHavePrefill for null, undefined, and blank", () => {
    expect(decodeHavePrefill(null, ctx)).toMatchObject({
      status: "empty",
      quantities: {},
      expandedSeriesIds: [],
    });
    expect(decodeHavePrefill(undefined, ctx).status).toBe("empty");
    expect(decodeHavePrefill("   ", ctx).status).toBe("empty");
    expect(emptyHavePrefill.raiseMerge).toBeTypeOf("function");
  });

  it("decodes SKU CSV with bare qty 1, :qty clamp, last-wins, and skips unknowns", () => {
    const seed = decodeHavePrefill(
      "PIN-CF-01,PIN-KROG-05:2,PIN-NOPE-99,PIN-CF-01:3,PIN-KROG-05:99,PIN-CF-04:0,bad",
      ctx,
    );
    expect(seed.status).toBe("applied");
    expect(seed.quantities).toEqual({
      "PIN-CF-01": 3,
      "PIN-KROG-05": HAVE_QTY_MAX,
    });
    expect(seed.expandedSeriesIds).toEqual(["pins:ChasmFriends", "pins:KROG"]);
  });

  it("decodes toy o1 ordinal payload against live catalog hash", () => {
    const seed = decodeHavePrefill("o1.51b124c5.0,3,5,2c:2,4h", ctx);
    expect(seed.status).toBe("applied");
    expect(seed.quantities).toEqual({
      "PIN-CF-01": 1,
      "PIN-CF-04": 1,
      "PIN-CPS1-00": 1,
      "PIN-KROG-05": 2,
      "PIN-OTHER-01": 1,
    });
    // OTHER is a single seeded SKU → fully Have → stays collapsed.
    expect(seed.expandedSeriesIds).toEqual(["pins:ChasmFriends", "pins:CPS1", "pins:KROG"]);
  });

  it("keeps fully Have series collapsed and expands only partial series", () => {
    const fullChasm = decodeHavePrefill(
      "PIN-CF-01,PIN-CF-02,PIN-CF-03,PIN-CF-04,PIN-CF-05",
      ctx,
    );
    expect(fullChasm.status).toBe("applied");
    expect(fullChasm.expandedSeriesIds).toEqual([]);

    const partial = decodeHavePrefill("PIN-CF-01,PIN-CF-02", ctx);
    expect(partial.expandedSeriesIds).toEqual(["pins:ChasmFriends"]);
  });

  it("soft-fails the whole o1 payload on catalog hash mismatch", () => {
    const seed = decodeHavePrefill("o1.deadbeef.0,3,5,2c:2,4h", ctx);
    expect(seed.status).toBe("soft-failed");
    expect(seed.quantities).toEqual({});
    expect(seed.expandedSeriesIds).toEqual([]);
  });

  it("skips out-of-bounds ordinal indices without inventing skus", () => {
    const seed = decodeHavePrefill("o1.51b124c5.0,zzzz,3", ctx);
    expect(seed.status).toBe("applied");
    expect(seed.quantities).toEqual({
      "PIN-CF-01": 1,
      "PIN-CF-04": 1,
    });
  });

  it("raiseMerge keeps the max qty and clamps 0..20, idempotent on repeat", () => {
    const seed = decodeHavePrefill("PIN-CF-01:2,PIN-KROG-05:1", ctx);
    const once = seed.raiseMerge(
      { "PIN-CF-01": 2, "PIN-KROG-05": 1, "PIN-CF-02": 0 },
      { "PIN-CF-01": 5, "PIN-KROG-05": 0, "PIN-CF-02": 3, "PIN-CF-03": 99 },
    );
    expect(once).toEqual({
      "PIN-CF-01": 5,
      "PIN-KROG-05": 1,
      "PIN-CF-02": 3,
      "PIN-CF-03": HAVE_QTY_MAX,
    });
    expect(seed.raiseMerge(once, once)).toEqual(once);
  });
});
