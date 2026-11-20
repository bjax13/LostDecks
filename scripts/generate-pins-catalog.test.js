const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const ROOT = path.resolve(__dirname, "..");
const CATALOG_PATH = path.join(ROOT, "frontend/src/storyData/pins-catalog.json");
const SCRIPT_PATH = path.join(ROOT, "scripts/generate-pins-catalog.js");
const SKU_RE = /^PIN-[A-Z0-9]{2,6}-[0-9]{2,3}$/;

test("pins catalog includes ChasmFriends and blue-book series groupings", () => {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));

  assert.equal(catalog.meta.setName, "Pins");
  assert.ok(catalog.meta.totalUniquePins >= 171);
  assert.ok(catalog.meta.series.includes("ChasmFriends"));
  assert.ok(catalog.meta.series.includes("Character Pin Series 1"));
  assert.equal(catalog.meta.series[0], "ChasmFriends");

  const cf = catalog.pins.filter((pin) => pin.catalog === "ChasmFriends");
  assert.equal(cf.length, 5);
  assert.equal(cf[0].id, "PIN-CF-01");

  const brandon = catalog.pins.find((pin) => pin.id === "PIN-CPS1-00");
  assert.ok(brandon);
  assert.equal(brandon.name, "Brandon");
  assert.equal(brandon.series, "Character Pin Series 1");

  for (const pin of catalog.pins) {
    assert.match(pin.id, SKU_RE);
  }
  for (const sku of catalog.skus) {
    assert.match(sku.skuId, SKU_RE);
    assert.equal(sku.finish, null);
  }
});

test("generate-pins-catalog.js is idempotent", () => {
  const before = fs.readFileSync(CATALOG_PATH, "utf8");
  const result = spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const after = fs.readFileSync(CATALOG_PATH, "utf8");
  assert.equal(after, before);
});
