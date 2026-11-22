const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const RULES_PATH = path.join(ROOT, "firestore.rules");
const STORY_CATALOG_PATH = path.join(ROOT, "frontend/src/storyData/storydeck-lt24-with-skus.json");
const PINS_CATALOG_PATH = path.join(ROOT, "frontend/src/storyData/pins-catalog.json");

function extractValidSkuIdRegex(rulesSource) {
  const match = rulesSource.match(/function validSkuId\(v\)\s*\{[\s\S]*?v\.matches\('([^']+)'\)/);
  assert.ok(match, "validSkuId regex not found in firestore.rules");
  return new RegExp(match[1]);
}

function loadCatalogSkuIds() {
  const story = JSON.parse(fs.readFileSync(STORY_CATALOG_PATH, "utf8"));
  const pins = JSON.parse(fs.readFileSync(PINS_CATALOG_PATH, "utf8"));
  const skuIds = [...(story.skus ?? []), ...(pins.skus ?? [])]
    .map((sku) => sku?.skuId)
    .filter((skuId) => typeof skuId === "string" && skuId.length > 0);
  return [...new Set(skuIds)];
}

test("firestore validSkuId regex matches every catalog SKU", () => {
  const rulesSource = fs.readFileSync(RULES_PATH, "utf8");
  const skuPattern = extractValidSkuIdRegex(rulesSource);
  const skuIds = loadCatalogSkuIds();

  assert.ok(skuIds.length > 0, "expected catalog SKUs");

  const mismatches = skuIds.filter((skuId) => !skuPattern.test(skuId));
  assert.deepEqual(mismatches, [], `catalog SKUs rejected by rules: ${mismatches.join(", ")}`);
});

function extractShareSkuAlt(rulesSource) {
  const match = rulesSource.match(/function shareSkuRegexAlt\(\)[\s\S]*?return '([^']+)'/);
  assert.ok(match, "shareSkuRegexAlt not found in firestore.rules");
  return match[1];
}

test("full catalog fits share iso and uft csv limits and regexes", () => {
  const rulesSource = fs.readFileSync(RULES_PATH, "utf8");
  const skuAlt = extractShareSkuAlt(rulesSource);
  const skuIds = loadCatalogSkuIds();
  const isoCsv = skuIds.join(",");
  const uftCsv = skuIds.map((skuId) => `${skuId}:1`).join(",");
  const isoRegex = new RegExp(`^(${skuAlt})(,(${skuAlt}))*$`);
  const uftRegex = new RegExp(`^(${skuAlt}):[1-9][0-9]{0,2}(,(${skuAlt}):[1-9][0-9]{0,2})*$`);

  assert.ok(skuIds.length > 0);
  assert.ok(isoCsv.length <= 16384, `iso csv length ${isoCsv.length}`);
  assert.ok(uftCsv.length <= 20000, `uft csv length ${uftCsv.length}`);
  assert.equal(isoRegex.test(isoCsv), true);
  assert.equal(uftRegex.test(uftCsv), true);
});

test("firestore validSkuId regex rejects malformed SKUs", () => {
  const rulesSource = fs.readFileSync(RULES_PATH, "utf8");
  const skuPattern = extractValidSkuIdRegex(rulesSource);

  assert.equal(skuPattern.test("LT24-ELS-01"), false);
  assert.equal(skuPattern.test("pin-cf-01"), false);
  assert.equal(skuPattern.test("PIN-TOOLONGCODE-01"), false);
  assert.equal(skuPattern.test("X".repeat(65)), false);
  assert.equal(skuPattern.test("PIN-CF-01"), true);
  assert.equal(skuPattern.test("PIN-CPS1-00"), true);
  assert.equal(skuPattern.test("PIN-WHBALL-01"), true);
});
