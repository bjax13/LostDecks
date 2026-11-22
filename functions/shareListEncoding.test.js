"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {
  buildShareIsoRegex,
  buildShareUftRegex,
  isValidShareIsoField,
  isValidShareUftField,
  sanitizeIsoUftForMeta,
  SHARE_ISO_MAX_LEN,
  SHARE_UFT_MAX_LEN,
} = require("./shareListEncoding");

const ROOT = path.join(__dirname, "..");
const STORY_CATALOG_PATH = path.join(ROOT, "frontend/src/storyData/storydeck-lt24-with-skus.json");
const PINS_CATALOG_PATH = path.join(ROOT, "frontend/src/storyData/pins-catalog.json");

function loadCatalogSkuIds() {
  const story = JSON.parse(fs.readFileSync(STORY_CATALOG_PATH, "utf8"));
  const pins = JSON.parse(fs.readFileSync(PINS_CATALOG_PATH, "utf8"));
  return [
    ...new Set(
      [...(story.skus ?? []), ...(pins.skus ?? [])].map((row) => row.skuId).filter(Boolean),
    ),
  ];
}

test("full catalog csv matches share list regex validators", () => {
  const skuIds = loadCatalogSkuIds();
  const isoCsv = skuIds.join(",");
  const uftCsv = skuIds.map((skuId) => `${skuId}:1`).join(",");

  assert.ok(skuIds.length > 0);
  assert.ok(isoCsv.length < SHARE_ISO_MAX_LEN);
  assert.ok(uftCsv.length < SHARE_UFT_MAX_LEN);
  assert.equal(buildShareIsoRegex().test(isoCsv), true);
  assert.equal(buildShareUftRegex().test(uftCsv), true);
  assert.equal(isValidShareIsoField(isoCsv), true);
  assert.equal(isValidShareUftField(uftCsv), true);
});

test("sanitizeIsoUftForMeta parses csv for OG counts", () => {
  const skuIds = loadCatalogSkuIds();
  const share = sanitizeIsoUftForMeta({
    displayName: "Pat",
    iso: skuIds.join(","),
    uft: "",
  });
  assert.equal(share.iso.length, skuIds.length);
  assert.equal(share.uft.length, 0);
});
