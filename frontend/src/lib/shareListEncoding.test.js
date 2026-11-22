import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  encodeIsoSkuList,
  encodeUftSkuList,
  isValidShareIsoField,
  isValidShareUftField,
  parseIsoSkuField,
  parseUftSkuField,
  SHARE_ISO_MAX_LEN,
  SHARE_UFT_MAX_LEN,
} from "./shareListEncoding.js";

const here = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(here, "..", "..");

function loadCatalogSkuIds() {
  const story = JSON.parse(
    fs.readFileSync(path.join(root, "src/storyData/storydeck-lt24-with-skus.json"), "utf8"),
  );
  const pins = JSON.parse(
    fs.readFileSync(path.join(root, "src/storyData/pins-catalog.json"), "utf8"),
  );
  return [
    ...new Set(
      [...(story.skus ?? []), ...(pins.skus ?? [])].map((row) => row.skuId).filter(Boolean),
    ),
  ];
}

describe("shareListEncoding", () => {
  it("round-trips the full catalog through iso and uft csv fields", () => {
    const skuIds = loadCatalogSkuIds();
    expect(skuIds.length).toBeGreaterThan(0);

    const isoCsv = encodeIsoSkuList(skuIds);
    expect(isValidShareIsoField(isoCsv)).toBe(true);
    expect(parseIsoSkuField(isoCsv)).toEqual(skuIds);

    const uftCsv = encodeUftSkuList(skuIds.map((skuId) => ({ skuId, quantity: 2 })));
    expect(isValidShareUftField(uftCsv)).toBe(true);
    expect(parseUftSkuField(uftCsv)).toEqual(skuIds.map((skuId) => ({ skuId, quantity: 2 })));
  });

  it("accepts empty strings and rejects malformed values", () => {
    expect(isValidShareIsoField("")).toBe(true);
    expect(isValidShareUftField("")).toBe(true);
    expect(isValidShareIsoField("LT24-ELS-01-DUN,bad")).toBe(false);
    expect(isValidShareUftField("LT24-LOP-02-FOIL:0")).toBe(false);
    expect(isValidShareIsoField("x".repeat(SHARE_ISO_MAX_LEN + 1))).toBe(false);
    expect(isValidShareUftField("x".repeat(SHARE_UFT_MAX_LEN + 1))).toBe(false);
  });
});
