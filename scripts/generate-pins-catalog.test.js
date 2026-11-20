const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const {
  applyDragonsteelStoreMap,
  applyPinArchiveMap,
  applyPinImages,
  ARCHIVE_URL_RE,
  STORE_URL_RE,
} = require("./generate-pins-catalog.js");

const ROOT = path.resolve(__dirname, "..");
const CATALOG_PATH = path.join(ROOT, "frontend/src/storyData/pins-catalog.json");
const SCRIPT_PATH = path.join(ROOT, "scripts/generate-pins-catalog.js");
const STORE_MAP_PATH = path.join(ROOT, "scripts/data/pin-dragonsteel-store-map.json");
const ARCHIVE_MAP_PATH = path.join(ROOT, "scripts/data/pin-archive-map.json");
const IMAGE_MAP_PATH = path.join(ROOT, "scripts/data/pin-images.json");
const SKU_RE = /^PIN-[A-Z0-9]{2,6}-[0-9]{2,3}$/;
const BUNDLE_IDS = [
  "PIN-CPS3-10",
  "PIN-CPS3-11",
  "PIN-MBWA-01",
  "PIN-MBWA-02",
  "PIN-MBWA-03",
  "PIN-CAMP-01",
];
const ARCHIVE_BUNDLE_IDS = [
  "PIN-CYTDS-01",
  "PIN-CYTDS-02",
  "PIN-CYTDS-03",
  "PIN-CYTDS-04",
  "PIN-CYTDS-05",
];
const PIN_KEYS = [
  "id",
  "name",
  "series",
  "catalog",
  "catalogName",
  "number",
  "detail",
  "country",
  "release",
  "notes",
  "sourceName",
];
const RETIRED_IDS = [
  "PIN-CPS4-03",
  "PIN-CPS4-04",
  "PIN-CPS4-06",
  "PIN-CPS4-08",
  "PIN-CPS4-09",
  "PIN-CPS4-10",
  "PIN-CPS4-11",
  "PIN-CPS4-12",
  "PIN-CPS4-13",
  "PIN-CYTO-01",
];
const RENAMED = {
  "PIN-CPS4-05": "Captain Tress",
  "PIN-CYTO-02": "DDF Two-Tone (US)",
  "PIN-CYTO-03": "DDF Two-Tone (UK)",
  "PIN-CONV-09": "Dragonsteel Nexus 2025 - Premium",
  "PIN-LOGO-03": "Dragonsteel Logo - Red",
  "PIN-OTHER-02": "Aviar - Emberdark",
  "PIN-SHELF-01": "Tress",
  "PIN-SHELF-02": "Way of Kings",
  "PIN-SHELF-03": "Elantris",
  "PIN-SHELF-04": "Yumi",
  "PIN-SHELF-05": "Mistborn Era 1",
  "PIN-SHELF-06": "Emberdark",
  "PIN-SHELF-07": "Skyward",
  "PIN-SHELF-08": "Warbreaker",
  "PIN-SHELF-09": "Sunlit Man",
  "PIN-OTHER-10": "Words of Radiance Backer Pin",
  "PIN-WHOP-03": "Dragonsteel Nexus Worldhopper",
};
const PREVIOUS_PIN_IDS = [
  "PIN-CF-01",
  "PIN-CF-02",
  "PIN-CF-03",
  "PIN-CF-04",
  "PIN-CF-05",
  "PIN-CPS1-00",
  "PIN-CPS1-01",
  "PIN-CPS1-02",
  "PIN-CPS1-03",
  "PIN-CPS1-04",
  "PIN-CPS1-05",
  "PIN-CPS1-06",
  "PIN-CPS1-07",
  "PIN-CPS1-08",
  "PIN-CPS1-09",
  "PIN-CPS1-10",
  "PIN-CPS1-11",
  "PIN-CPS1-12",
  "PIN-CPS2-00",
  "PIN-CPS2-01",
  "PIN-CPS2-02",
  "PIN-CPS2-03",
  "PIN-CPS2-04",
  "PIN-CPS2-05",
  "PIN-CPS2-06",
  "PIN-CPS2-07",
  "PIN-CPS2-08",
  "PIN-CPS2-09",
  "PIN-CPS2-10",
  "PIN-CPS2-11",
  "PIN-CPS2-12",
  "PIN-CPS2-13",
  "PIN-CPS2-14",
  "PIN-CPS2-15",
  "PIN-CPS2-16",
  "PIN-CPS2-17",
  "PIN-CPS2-18",
  "PIN-CPS2-19",
  "PIN-CPS2-20",
  "PIN-CPS2-21",
  "PIN-CPS2-22",
  "PIN-CPS2-23",
  "PIN-CPS2-24",
  "PIN-CPS2-25",
  "PIN-CPS3-00",
  "PIN-CPS3-01",
  "PIN-CPS3-02",
  "PIN-CPS3-03",
  "PIN-CPS3-04",
  "PIN-CPS3-05",
  "PIN-CPS3-06",
  "PIN-CPS3-07",
  "PIN-CPS3-08",
  "PIN-CPS3-09",
  "PIN-CPS3-10",
  "PIN-CPS3-11",
  "PIN-CPS3-12",
  "PIN-CPS4-01",
  "PIN-CPS4-02",
  "PIN-CPS4-03",
  "PIN-CPS4-04",
  "PIN-CPS4-05",
  "PIN-CPS4-06",
  "PIN-CPS4-07",
  "PIN-CPS4-08",
  "PIN-CPS4-09",
  "PIN-CPS4-10",
  "PIN-CPS4-11",
  "PIN-CPS4-12",
  "PIN-CPS4-13",
  "PIN-KRO-01",
  "PIN-KRO-02",
  "PIN-KRO-03",
  "PIN-KRO-04",
  "PIN-KRO-05",
  "PIN-KRO-06",
  "PIN-KRO-07",
  "PIN-KRO-08",
  "PIN-KRO-09",
  "PIN-KRO-10",
  "PIN-KROG-01",
  "PIN-KROG-02",
  "PIN-KROG-03",
  "PIN-KROG-04",
  "PIN-KROG-05",
  "PIN-CONV-01",
  "PIN-CONV-02",
  "PIN-CONV-03",
  "PIN-CONV-04",
  "PIN-CONV-05",
  "PIN-CONV-06",
  "PIN-CONV-07",
  "PIN-CONV-08",
  "PIN-CONV-09",
  "PIN-COSM-01",
  "PIN-COSM-02",
  "PIN-CYTO-01",
  "PIN-CYTO-02",
  "PIN-CYTO-03",
  "PIN-CYTO-04",
  "PIN-CYTO-05",
  "PIN-CYTO-06",
  "PIN-CYTO-07",
  "PIN-CYTO-08",
  "PIN-CYTO-09",
  "PIN-CYTSS-01",
  "PIN-CYTSS-02",
  "PIN-CYTSS-03",
  "PIN-CYTSS-04",
  "PIN-CYTSS-05",
  "PIN-CYTSS-06",
  "PIN-CYTDS-01",
  "PIN-CYTDS-02",
  "PIN-CYTDS-03",
  "PIN-CYTDS-04",
  "PIN-CYTDS-05",
  "PIN-SHELF-01",
  "PIN-SHELF-02",
  "PIN-SHELF-03",
  "PIN-SHELF-04",
  "PIN-SHELF-05",
  "PIN-SHELF-06",
  "PIN-SHELF-07",
  "PIN-SHELF-08",
  "PIN-SHELF-09",
  "PIN-ROSH-01",
  "PIN-ROSH-02",
  "PIN-ROSH-03",
  "PIN-ROSH-04",
  "PIN-ROSH-05",
  "PIN-ROSH-06",
  "PIN-ROSH-07",
  "PIN-ROSH-08",
  "PIN-LOGO-01",
  "PIN-LOGO-02",
  "PIN-LOGO-03",
  "PIN-LOGO-04",
  "PIN-LOGO-05",
  "PIN-LOGO-06",
  "PIN-LOGO-07",
  "PIN-WHOP-01",
  "PIN-WHOP-02",
  "PIN-WHOP-03",
  "PIN-WHOP-04",
  "PIN-MBWA-01",
  "PIN-MBWA-02",
  "PIN-MBWA-03",
  "PIN-COSP-01",
  "PIN-COSP-02",
  "PIN-SCAD-01",
  "PIN-SCAD-02",
  "PIN-SCENE-01",
  "PIN-SCENE-02",
  "PIN-RECK-01",
  "PIN-WHBALL-01",
  "PIN-CAMP-01",
  "PIN-EVENT-01",
  "PIN-EVENT-02",
  "PIN-EVENT-03",
  "PIN-EVENT-04",
  "PIN-EVENT-05",
  "PIN-OTHER-01",
  "PIN-OTHER-02",
  "PIN-OTHER-03",
  "PIN-OTHER-04",
  "PIN-OTHER-05",
  "PIN-OTHER-06",
  "PIN-OTHER-07",
  "PIN-OTHER-08",
  "PIN-OTHER-09",
  "PIN-OTHER-10",
];

test("pins catalog includes ChasmFriends and blue-book series groupings", () => {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));

  assert.equal(catalog.meta.setName, "Pins");
  assert.equal(catalog.meta.totalUniquePins, 161);
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

test("listed pins omit retired ids, keep every previous id, and use the cleaned names", () => {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  const listedIds = catalog.pins.map((pin) => pin.id);
  const retiredIds = catalog.retired.map((pin) => pin.id);
  const skuIds = catalog.skus.map((sku) => sku.skuId);

  assert.deepEqual(retiredIds, RETIRED_IDS);
  assert.equal(catalog.meta.totalUniquePins, listedIds.length);
  assert.equal(catalog.meta.totalSkus, skuIds.length);
  assert.deepEqual(skuIds, listedIds);

  for (const id of RETIRED_IDS) {
    assert.equal(listedIds.includes(id), false);
    assert.equal(skuIds.includes(id), false);
  }

  const combined = [...listedIds, ...retiredIds].sort();
  assert.deepEqual(combined, [...PREVIOUS_PIN_IDS].sort());

  const byId = new Map([...catalog.pins, ...catalog.retired].map((pin) => [pin.id, pin]));
  for (const [id, name] of Object.entries(RENAMED)) {
    assert.equal(byId.get(id)?.name, name);
  }

  assert.equal(byId.get("PIN-CPS4-01").name, "Sazed");
  assert.equal(byId.get("PIN-CPS4-01").number, 1);
  assert.equal(byId.get("PIN-CPS4-07").name, "Maya");
  assert.equal(byId.get("PIN-CPS4-07").number, 7);
  assert.equal(byId.get("PIN-CPS4-13").name, "Series 4 - Pin 0 -");
  assert.equal(byId.get("PIN-CPS4-13").number, 13);
  assert.equal(byId.get("PIN-CAMP-01").name, "Fires of December");
  assert.equal(byId.get("PIN-CYTO-01").name, "DDF Two-Tone");
  assert.equal(byId.get("PIN-CYTO-04").name, "Doom Slug");
  assert.equal(byId.get("PIN-CYTO-04").number, 4);
  assert.equal(byId.get("PIN-CF-01").name, "Shredhead");

  for (const pin of [...catalog.pins, ...catalog.retired]) {
    const keys = Object.keys(pin);
    const expected = [...PIN_KEYS];
    if (pin.image != null) expected.push("image");
    if (pin.storeUrl != null || pin.storeMatch != null) {
      assert.equal(listedIds.includes(pin.id), true, pin.id);
      expected.push("storeUrl", "storeMatch");
    }
    if (pin.archiveUrl != null || pin.archiveMatch != null) {
      assert.equal(listedIds.includes(pin.id), true, pin.id);
      expected.push("archiveUrl", "archiveMatch");
    }
    assert.deepEqual(keys, expected);
    assert.equal(
      /^Series\s+\d+\s*-\s*Pin\s+\d+\s*-\s*$/.test(pin.name) && listedIds.includes(pin.id),
      false,
    );
  }
  assert.equal(
    catalog.pins.some((pin) => pin.name.startsWith("Sandershelf - Pin")),
    false,
  );
});

test("regenerating the pins catalog reproduces the committed catalog", () => {
  const before = fs.readFileSync(CATALOG_PATH, "utf8");
  const result = spawnSync(process.execPath, [SCRIPT_PATH], {
    cwd: ROOT,
    encoding: "utf8",
  });
  assert.equal(result.status, 0, result.stderr || result.stdout);
  const after = fs.readFileSync(CATALOG_PATH, "utf8");
  assert.equal(after, before);
  assert.match(result.stdout, /Applied pin image versions to 0 pins/);
  assert.match(result.stdout, /73 exact, 6 bundle/);
  assert.match(result.stdout, /Applied archived store links to 24 pins \(19 exact, 5 bundle\)/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /Skipped Dragonsteel store mapping/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /Skipped archived store mapping/);
  assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /Skipped pin image/);
});

test("every storeUrl is https on www.dragonsteelbooks.com and every id exists in the catalog", () => {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  const map = JSON.parse(fs.readFileSync(STORE_MAP_PATH, "utf8"));
  const entries = Object.entries(map.pins);
  assert.equal(entries.length, 79);

  const listed = new Map(catalog.pins.map((pin) => [pin.id, pin]));
  const retired = new Map(catalog.retired.map((pin) => [pin.id, pin]));
  const catalogIds = new Set([...listed.keys(), ...retired.keys()]);
  let exact = 0;
  let bundle = 0;

  for (const [id, entry] of entries) {
    assert.equal(catalogIds.has(id), true, `${id} is not in the catalog`);
    assert.match(entry.storeUrl, STORE_URL_RE);
    const url = new URL(entry.storeUrl);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "www.dragonsteelbooks.com");
    assert.equal(url.pathname.startsWith("/products/"), true);

    const pin = listed.get(id);
    assert.ok(pin, `${id} is not a listed pin`);
    assert.equal(retired.has(id), false);
    assert.equal(pin.storeUrl, entry.storeUrl);
    assert.equal(pin.storeMatch, entry.storeMatch);
    if (entry.storeMatch === "exact") exact += 1;
    else if (entry.storeMatch === "bundle") bundle += 1;
    else assert.fail(entry.storeMatch);
  }

  assert.equal(exact, 73);
  assert.equal(bundle, 6);
  assert.deepEqual(
    catalog.pins
      .filter((pin) => pin.storeMatch === "bundle")
      .map((pin) => pin.id)
      .sort(),
    [...BUNDLE_IDS].sort(),
  );
  assert.equal(
    listed.get("PIN-LOGO-03").storeUrl,
    "https://www.dragonsteelbooks.com/products/dragonsteel-pin",
  );
  assert.equal(listed.get("PIN-LOGO-03").storeMatch, "exact");
  assert.equal(
    listed.get("PIN-MBWA-01").storeUrl,
    "https://www.dragonsteelbooks.com/products/mistborn-word-art-pin-set",
  );
  assert.equal(listed.get("PIN-MBWA-02").storeUrl, listed.get("PIN-MBWA-01").storeUrl);
  assert.equal(listed.get("PIN-MBWA-03").storeUrl, listed.get("PIN-MBWA-01").storeUrl);
  assert.equal(listed.get("PIN-CPS3-10").storeUrl, listed.get("PIN-CPS3-11").storeUrl);
  assert.equal(
    listed.get("PIN-CAMP-01").storeUrl,
    "https://www.dragonsteelbooks.com/products/the-fires-of-december-tor-edition-numbered-bundle",
  );

  const mapped = catalog.pins.filter((pin) => pin.storeUrl != null || pin.storeMatch != null);
  assert.equal(mapped.length, 79);
  for (const pin of catalog.pins) {
    if (pin.storeUrl == null && pin.storeMatch == null) {
      assert.equal(map.pins[pin.id], undefined);
      continue;
    }
    assert.match(pin.storeUrl, STORE_URL_RE);
    assert.equal(map.pins[pin.id].storeUrl, pin.storeUrl);
    assert.equal(map.pins[pin.id].storeMatch, pin.storeMatch);
  }
  for (const pin of catalog.retired) {
    assert.equal(pin.storeUrl, undefined);
    assert.equal(pin.storeMatch, undefined);
    assert.equal(map.pins[pin.id], undefined);
  }
  assert.equal(listed.get("PIN-CF-01").storeUrl, undefined);
});

test("an empty pin image map leaves every pin without an image field", () => {
  const map = JSON.parse(fs.readFileSync(IMAGE_MAP_PATH, "utf8"));
  assert.deepEqual(map.pins, {});
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  for (const pin of [...catalog.pins, ...catalog.retired]) {
    assert.equal(pin.image, undefined, pin.id);
  }
});

test("applyPinImages copies positive versions and leaves 0 or unknown ids without a photo", () => {
  const listed = [{ id: "PIN-CPS2-01", name: "Kaladin" }];
  const retired = [{ id: "PIN-CYTO-01", name: "DDF Two-Tone" }];
  const warnings = [];
  const result = applyPinImages(
    [...listed, ...retired],
    {
      "PIN-CPS2-01": 2,
      "PIN-CYTO-01": 1,
      "PIN-CF-01": 0,
      "PIN-NOPE-01": 4,
    },
    { warn: (message) => warnings.push(message) },
  );

  assert.equal(listed[0].image, 2);
  assert.equal(retired[0].image, 1);
  assert.equal(result.applied, 2);
  assert.deepEqual(result.skipped, [{ id: "PIN-NOPE-01", reason: "not in catalog" }]);
  assert.match(warnings.join("\n"), /PIN-NOPE-01: not in catalog/);
  assert.equal(Object.hasOwn(listed[0], "image"), true);
});

test("applyPinImages rejects a version that is not a non-negative integer", () => {
  const listed = [{ id: "PIN-CPS2-01" }];
  assert.throws(
    () => applyPinImages(listed, { "PIN-CPS2-01": 1.5 }),
    /Invalid pin image version for PIN-CPS2-01/,
  );
  assert.equal(listed[0].image, undefined);
  assert.throws(
    () => applyPinImages([{ id: "PIN-CF-01" }], { "PIN-CF-01": -1 }),
    /Invalid pin image version/,
  );
});

test("applyDragonsteelStoreMap skips unknown and retired ids and reports them", () => {
  const listed = [{ id: "PIN-CPS1-00", name: "Brandon" }];
  const retired = [{ id: "PIN-CPS4-03", name: "Series 4 - Pin 3 -" }];
  const retiredBefore = structuredClone(retired);
  const warnings = [];
  const result = applyDragonsteelStoreMap(
    listed,
    retired,
    {
      "PIN-CPS1-00": {
        storeUrl: "https://www.dragonsteelbooks.com/products/brandon-character-pin-series-1-000",
        storeMatch: "exact",
      },
      "PIN-CPS4-03": {
        storeUrl: "https://www.dragonsteelbooks.com/products/not-used",
        storeMatch: "exact",
      },
      "PIN-NOPE-01": {
        storeUrl: "https://www.dragonsteelbooks.com/products/not-used",
        storeMatch: "bundle",
      },
    },
    { warn: (message) => warnings.push(message) },
  );

  assert.equal(
    listed[0].storeUrl,
    "https://www.dragonsteelbooks.com/products/brandon-character-pin-series-1-000",
  );
  assert.equal(listed[0].storeMatch, "exact");
  assert.deepEqual(retired, retiredBefore);
  assert.equal(retired[0].storeUrl, undefined);
  assert.deepEqual(result.skipped, [
    { id: "PIN-CPS4-03", reason: "retired" },
    { id: "PIN-NOPE-01", reason: "not in catalog" },
  ]);
  assert.equal(result.exact, 1);
  assert.equal(result.bundle, 0);
  assert.match(warnings.join("\n"), /PIN-CPS4-03: retired/);
  assert.match(warnings.join("\n"), /PIN-NOPE-01: not in catalog/);
});

test("applyDragonsteelStoreMap rejects a URL that is not https on www.dragonsteelbooks.com", () => {
  const listed = [{ id: "PIN-CPS1-00" }];
  assert.throws(
    () =>
      applyDragonsteelStoreMap(listed, [], {
        "PIN-CPS1-00": {
          storeUrl: "http://www.dragonsteelbooks.com/products/brandon-character-pin-series-1-000",
          storeMatch: "exact",
        },
      }),
    /Invalid Dragonsteel store URL/,
  );
  assert.equal(listed[0].storeUrl, undefined);

  assert.throws(
    () =>
      applyDragonsteelStoreMap([{ id: "PIN-CPS1-00" }], [], {
        "PIN-CPS1-00": {
          storeUrl: "https://dragonsteelbooks.com/products/brandon-character-pin-series-1-000",
          storeMatch: "exact",
        },
      }),
    /Invalid Dragonsteel store URL/,
  );
});

test("every archiveUrl is a Wayback capture of an official store page and every id exists", () => {
  const catalog = JSON.parse(fs.readFileSync(CATALOG_PATH, "utf8"));
  const map = JSON.parse(fs.readFileSync(ARCHIVE_MAP_PATH, "utf8"));
  const storeMap = JSON.parse(fs.readFileSync(STORE_MAP_PATH, "utf8"));
  const entries = Object.entries(map.pins);
  assert.equal(entries.length, 24);

  const listed = new Map(catalog.pins.map((pin) => [pin.id, pin]));
  const retired = new Map(catalog.retired.map((pin) => [pin.id, pin]));
  const catalogIds = new Set([...listed.keys(), ...retired.keys()]);
  let exact = 0;
  let bundle = 0;

  for (const [id, entry] of entries) {
    assert.equal(catalogIds.has(id), true, `${id} is not in the catalog`);
    assert.equal(storeMap.pins[id], undefined, `${id} already has a live store link`);
    assert.match(entry.archiveUrl, ARCHIVE_URL_RE);
    const url = new URL(entry.archiveUrl);
    assert.equal(url.protocol, "https:");
    assert.equal(url.hostname, "web.archive.org");
    const stamp = url.pathname.split("/")[2];
    assert.match(stamp, /^\d{14}$/);
    const month = Number(stamp.slice(4, 6));
    assert.equal(month >= 1 && month <= 12, true, stamp);
    const archived = new URL(entry.archiveUrl.slice(entry.archiveUrl.indexOf("https://", 8)));
    assert.equal(
      archived.hostname === "www.dragonsteelbooks.com" ||
        archived.hostname === "store.brandonsanderson.com",
      true,
      archived.hostname,
    );
    assert.equal(archived.pathname.startsWith("/products/"), true);

    const pin = listed.get(id);
    assert.ok(pin, `${id} is not a listed pin`);
    assert.equal(retired.has(id), false);
    assert.equal(pin.storeUrl, undefined, id);
    assert.equal(pin.archiveUrl, entry.archiveUrl);
    assert.equal(pin.archiveMatch, entry.archiveMatch);
    if (entry.archiveMatch === "exact") exact += 1;
    else if (entry.archiveMatch === "bundle") bundle += 1;
    else assert.fail(entry.archiveMatch);
  }

  assert.equal(exact, 19);
  assert.equal(bundle, 5);
  assert.deepEqual(
    catalog.pins
      .filter((pin) => pin.archiveMatch === "bundle")
      .map((pin) => pin.id)
      .sort(),
    [...ARCHIVE_BUNDLE_IDS].sort(),
  );

  const mBot =
    "https://web.archive.org/web/20220520175820/https://www.dragonsteelbooks.com/products/m-bot-pin";
  const bundlePage =
    "https://web.archive.org/web/20231124201557/https://www.dragonsteelbooks.com/products/cytoverse-defiant-ships-pin-bundle";
  const knightPage =
    "https://web.archive.org/web/20211023074544/https://www.dragonsteelbooks.com/products/individual-knights-radiant-order-pins";
  assert.equal(listed.get("PIN-CYTO-06").archiveUrl, mBot);
  assert.equal(listed.get("PIN-CYTO-06").archiveMatch, "exact");
  assert.equal(listed.get("PIN-CYTDS-01").archiveUrl, bundlePage);
  assert.equal(listed.get("PIN-CYTDS-01").archiveMatch, "bundle");
  for (const id of ARCHIVE_BUNDLE_IDS) {
    assert.equal(listed.get(id).archiveUrl, bundlePage);
    assert.equal(listed.get(id).archiveMatch, "bundle");
  }
  for (let n = 1; n <= 10; n += 1) {
    const id = `PIN-KRO-${String(n).padStart(2, "0")}`;
    assert.equal(listed.get(id).archiveUrl, knightPage);
    assert.equal(listed.get(id).archiveMatch, "exact");
  }

  for (const id of ["PIN-CONV-04", "PIN-SHELF-03", "PIN-SCAD-01", "PIN-CPS4-01", "PIN-CF-01"]) {
    assert.equal(listed.get(id).archiveUrl, undefined, id);
    assert.equal(listed.get(id).archiveMatch, undefined, id);
    assert.equal(map.pins[id], undefined, id);
  }

  const mapped = catalog.pins.filter((pin) => pin.archiveUrl != null || pin.archiveMatch != null);
  assert.equal(mapped.length, 24);
  for (const pin of catalog.pins) {
    if (pin.archiveUrl == null && pin.archiveMatch == null) {
      assert.equal(map.pins[pin.id], undefined);
      continue;
    }
    assert.match(pin.archiveUrl, ARCHIVE_URL_RE);
    assert.equal(map.pins[pin.id].archiveUrl, pin.archiveUrl);
    assert.equal(map.pins[pin.id].archiveMatch, pin.archiveMatch);
  }
  for (const pin of catalog.retired) {
    assert.equal(pin.archiveUrl, undefined);
    assert.equal(pin.archiveMatch, undefined);
    assert.equal(map.pins[pin.id], undefined);
  }
});

test("applyPinArchiveMap copies exact and bundle captures and leaves store fields alone", () => {
  const listed = [
    {
      id: "PIN-CYTO-06",
      storeUrl: "https://www.dragonsteelbooks.com/products/m-bot-pin",
      storeMatch: "exact",
    },
    { id: "PIN-CYTDS-01" },
  ];
  const retired = [{ id: "PIN-CYTO-01", name: "DDF Two-Tone" }];
  const warnings = [];
  const mBot =
    "https://web.archive.org/web/20220520175820/https://www.dragonsteelbooks.com/products/m-bot-pin";
  const bundlePage =
    "https://web.archive.org/web/20231124201557/https://www.dragonsteelbooks.com/products/cytoverse-defiant-ships-pin-bundle";
  const result = applyPinArchiveMap(
    listed,
    retired,
    {
      "PIN-CYTO-06": { archiveUrl: mBot, archiveMatch: "exact" },
      "PIN-CYTDS-01": { archiveUrl: bundlePage, archiveMatch: "bundle" },
      "PIN-CYTO-01": { archiveUrl: mBot, archiveMatch: "exact" },
      "PIN-NOPE-01": { archiveUrl: mBot, archiveMatch: "exact" },
    },
    { warn: (message) => warnings.push(message) },
  );

  assert.equal(listed[0].archiveUrl, mBot);
  assert.equal(listed[0].archiveMatch, "exact");
  assert.equal(listed[0].storeUrl, "https://www.dragonsteelbooks.com/products/m-bot-pin");
  assert.equal(listed[0].storeMatch, "exact");
  assert.equal(listed[1].archiveUrl, bundlePage);
  assert.equal(listed[1].archiveMatch, "bundle");
  assert.equal(retired[0].archiveUrl, undefined);
  assert.equal(result.applied, 2);
  assert.equal(result.exact, 1);
  assert.equal(result.bundle, 1);
  assert.deepEqual(result.skipped, [
    { id: "PIN-CYTO-01", reason: "retired" },
    { id: "PIN-NOPE-01", reason: "not in catalog" },
  ]);
  assert.match(warnings.join("\n"), /PIN-CYTO-01: retired/);
  assert.match(warnings.join("\n"), /PIN-NOPE-01: not in catalog/);
});

test("applyPinArchiveMap rejects live URLs, resellers, bad timestamps, and bad match values", () => {
  const listed = [{ id: "PIN-CYTO-06" }];
  const live = "https://www.dragonsteelbooks.com/products/m-bot-pin";
  const reseller = "https://web.archive.org/web/20220520175820/https://www.ebay.com/itm/m-bot-pin";
  const badMonth =
    "https://web.archive.org/web/20241320175820/https://www.dragonsteelbooks.com/products/m-bot-pin";
  const mBot =
    "https://web.archive.org/web/20220520175820/https://www.dragonsteelbooks.com/products/m-bot-pin";

  assert.throws(
    () =>
      applyPinArchiveMap(listed, [], {
        "PIN-CYTO-06": { archiveUrl: live, archiveMatch: "exact" },
      }),
    /Invalid Wayback archive URL/,
  );
  assert.equal(listed[0].archiveUrl, undefined);
  assert.throws(
    () =>
      applyPinArchiveMap(listed, [], {
        "PIN-CYTO-06": { archiveUrl: reseller, archiveMatch: "exact" },
      }),
    /Invalid Wayback archive URL/,
  );
  assert.throws(
    () =>
      applyPinArchiveMap(listed, [], {
        "PIN-CYTO-06": { archiveUrl: badMonth, archiveMatch: "exact" },
      }),
    /Invalid Wayback archive URL/,
  );
  assert.throws(
    () =>
      applyPinArchiveMap(listed, [], { "PIN-CYTO-06": { archiveUrl: mBot, archiveMatch: "set" } }),
    /Invalid archiveMatch/,
  );
  assert.equal(listed[0].archiveUrl, undefined);
  assert.equal(listed[0].archiveMatch, undefined);
});
