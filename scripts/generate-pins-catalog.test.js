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

  const series4 = Object.fromEntries(
    catalog.pins
      .filter((pin) => pin.series === "Character Pin Series 4")
      .map((pin) => [pin.id, pin]),
  );
  assert.equal(series4["PIN-CPS4-01"].name, "Sazed");
  assert.equal(series4["PIN-CPS4-02"].name, "Sarene");
  assert.equal(series4["PIN-CPS4-07"].name, "Maya");
  assert.equal(series4["PIN-CPS4-03"].name, "Series 4 - Pin 3");
  assert.equal(series4["PIN-CPS4-03"].sourceName, "Series 4 - Pin 3 -");
  assert.equal(series4["PIN-CPS4-03"].id, "PIN-CPS4-03");
  assert.equal(series4["PIN-CPS4-13"].name, "Series 4 - Pin 0");
  assert.equal(series4["PIN-CPS4-13"].id, "PIN-CPS4-13");

  const shelf = catalog.pins.find((pin) => pin.id === "PIN-SHELF-01");
  assert.equal(shelf.name, "Sandershelf - Pin 1 - Tress");

  const twoTone = catalog.pins.filter((pin) => pin.name === "DDF Two-Tone");
  assert.deepEqual(
    twoTone.map((pin) => pin.id),
    ["PIN-CYTO-01", "PIN-CYTO-02"],
  );

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
