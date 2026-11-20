#!/usr/bin/env node
/**
 * Build frontend/src/storyData/pins-catalog.json from:
 * - Hard-coded ChasmFriends pins (extended, not replaced)
 * - Sanderson Collectors Guild blue-book CSV (scripts/data/pin-bluebook-gid788070872.csv)
 *
 * Usage: node scripts/generate-pins-catalog.js
 */
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "..");
const CSV_PATH = path.join(ROOT, "scripts/data/pin-bluebook-gid788070872.csv");
const OUT_PATH = path.join(ROOT, "frontend/src/storyData/pins-catalog.json");

/** Stable set-code map for SKU ids: PIN-{CODE}-{NN|NNN} */
const SET_CODES = [
  ["Character Pin Series 1", "CPS1"],
  ["Character Pin Series 2", "CPS2"],
  ["Character Pin Series 3", "CPS3"],
  ["Character Pin Series 4", "CPS4"],
  ["Knight Radiant Order", "KRO"],
  ["Knight Radiant Order Glitter", "KROG"],
  ["Convention", "CONV"],
  ["Cosmere", "COSM"],
  ["Cytoverse", "CYTO"],
  ["Cytoverse Spanish Slugs", "CYTSS"],
  ["Cytoverse Defiant Ships", "CYTDS"],
  ["Sandershelf", "SHELF"],
  ["Roshar", "ROSH"],
  ["Logo Pins", "LOGO"],
  ["Worldhopper Pins", "WHOP"],
  ["Mistborn Word Art", "MBWA"],
  ["Cosplay", "COSP"],
  ["Scadrial", "SCAD"],
  ["Scene Pin", "SCENE"],
  ["Reckoners", "RECK"],
  ["Worldhopper Ball", "WHBALL"],
  ["Campaign Pin", "CAMP"],
  ["Event Pins", "EVENT"],
  ["Other", "OTHER"],
];

const SERIES_PIN_RE = /^Series\s+(\d+)\s*-\s*Pin\s+(\d+)\s*-\s*(.+)$/i;
const SHELF_PIN_RE = /^Sandershelf\s*-\s*Pin\s+(\d+)\s*-\s*(.+)$/i;
const BLANK_SERIES_PIN_RE = /^Series\s+\d+\s*-\s*Pin\s+\d+\s*-\s*$/i;
const SKU_RE = /^PIN-[A-Z0-9]{2,6}-[0-9]{2,3}$/;

/**
 * Display names applied after id assignment. Ids stay on the CSV row order.
 * Sandershelf titles are stripped by SHELF_PIN_RE; this map covers the rest.
 */
const DISPLAY_NAME_BY_ID = {
  "PIN-CPS4-05": "Captain Tress",
  "PIN-CYTO-02": "DDF Two-Tone (US)",
  "PIN-CYTO-03": "DDF Two-Tone (UK)",
  "PIN-CONV-09": "Dragonsteel Nexus 2025 - Premium",
  "PIN-LOGO-03": "Dragonsteel Logo - Red",
  "PIN-OTHER-02": "Aviar - Emberdark",
  "PIN-SHELF-06": "Emberdark",
  "PIN-OTHER-10": "Words of Radiance Backer Pin",
  "PIN-WHOP-03": "Dragonsteel Nexus Worldhopper",
};

/**
 * Stop listing these ids. Blank Series rows stay in the snapshot CSV so
 * assignNumbers does not move later ids (Series 4 Pin 0 is PIN-CPS4-13
 * because SERIES_PIN_RE requires a name). PIN-CYTO-01 stays in the CSV so
 * PIN-CYTO-02 and later keep their numbers.
 */
const RETIRED_PIN_IDS = new Set([
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
]);

const CHASM_FRIENDS = [
  { id: "PIN-CF-01", name: "Shredhead", number: 1 },
  { id: "PIN-CF-02", name: "Howlerina", number: 2 },
  { id: "PIN-CF-03", name: "Burpslurper", number: 3 },
  { id: "PIN-CF-04", name: "Darren", number: 4 },
  { id: "PIN-CF-05", name: "Cleverclaws", number: 5 },
];

function padNum(n) {
  return n < 100 ? String(n).padStart(2, "0") : String(n).padStart(3, "0");
}

function parseCsv(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i += 1;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
      continue;
    }
    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      row.push(field);
      field = "";
    } else if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (ch === "\r") {
      // ignore
    } else {
      field += ch;
    }
  }
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function displayName(raw) {
  const trimmed = raw.trim();
  const seriesMatch = SERIES_PIN_RE.exec(trimmed);
  if (seriesMatch) return seriesMatch[3].trim();
  const shelfMatch = SHELF_PIN_RE.exec(trimmed);
  return shelfMatch ? shelfMatch[2].trim() : trimmed;
}

function parseNumber(raw) {
  const trimmed = raw.trim();
  const seriesMatch = SERIES_PIN_RE.exec(trimmed);
  if (seriesMatch) return Number.parseInt(seriesMatch[2], 10);
  const shelfMatch = SHELF_PIN_RE.exec(trimmed);
  return shelfMatch ? Number.parseInt(shelfMatch[1], 10) : null;
}

function isRetiredPin(id, raw) {
  return RETIRED_PIN_IDS.has(id) || BLANK_SERIES_PIN_RE.test(raw.trim());
}

function buildChasmFriendsPins() {
  return CHASM_FRIENDS.map((pin) => ({
    id: pin.id,
    name: pin.name,
    series: "ChasmFriends",
    catalog: "ChasmFriends",
    catalogName: "ChasmFriends Pins",
    number: pin.number,
    detail: "ChasmFriends enamel pin",
    country: "US",
    release: null,
    notes: null,
    sourceName: null,
  }));
}

function assignNumbers(entries) {
  const used = new Set();
  const withPreferred = entries.map((entry) => {
    const preferred = entry.number;
    if (preferred != null && !used.has(preferred)) {
      used.add(preferred);
      return { ...entry, number: preferred };
    }
    return { ...entry, number: null };
  });

  let next = 1;
  for (const entry of withPreferred) {
    if (entry.number != null) continue;
    while (used.has(next)) next += 1;
    entry.number = next;
    used.add(next);
    next += 1;
  }

  return withPreferred.sort((a, b) => a.number - b.number || a.name.localeCompare(b.name));
}

function main() {
  const csvText = fs.readFileSync(CSV_PATH, "utf8");
  const rows = parseCsv(csvText);
  if (!rows.length || rows[0][0] !== "Pin") {
    throw new Error(`Unexpected CSV header in ${CSV_PATH}`);
  }

  const setCodeMap = new Map(SET_CODES);
  const bySet = new Map();
  for (const row of rows.slice(1)) {
    const raw = (row[0] ?? "").trim();
    if (!raw) continue;
    const series = (row[2] ?? "").trim();
    if (!setCodeMap.has(series)) {
      throw new Error(`Unknown Set column value: ${JSON.stringify(series)}`);
    }
    if (!bySet.has(series)) bySet.set(series, []);
    bySet.get(series).push({
      raw,
      name: displayName(raw),
      number: parseNumber(raw),
      release: (row[3] ?? "").trim() || null,
      notes: (row[4] ?? "").trim() || null,
      country: (row[5] ?? "").trim() || null,
    });
  }

  const pins = buildChasmFriendsPins();
  const retired = [];
  const usedIds = new Set(pins.map((pin) => pin.id));
  let scgCount = 0;

  for (const [series, code] of SET_CODES) {
    const entries = assignNumbers(bySet.get(series) ?? []);
    for (const entry of entries) {
      const id = `PIN-${code}-${padNum(entry.number)}`;
      if (usedIds.has(id)) {
        throw new Error(`Duplicate pin id ${id}`);
      }
      if (!SKU_RE.test(id)) {
        throw new Error(`Pin id fails SKU pattern: ${id}`);
      }
      usedIds.add(id);
      const name = DISPLAY_NAME_BY_ID[id] ?? entry.name;
      const detailBits = [series];
      if (entry.country) detailBits.push(entry.country);
      const pin = {
        id,
        name,
        series,
        catalog: "SCG",
        catalogName: "Sanderson Collectors Guild Pins",
        number: entry.number,
        detail: detailBits.join(" · "),
        country: entry.country,
        release: entry.release,
        notes: entry.notes,
        sourceName: entry.raw !== name ? entry.raw : null,
      };
      if (isRetiredPin(id, entry.raw)) {
        retired.push(pin);
        continue;
      }
      pins.push(pin);
      scgCount += 1;
    }
  }

  const series = ["ChasmFriends", ...SET_CODES.map(([name]) => name)].filter((name, index, all) => {
    return pins.some((pin) => pin.series === name) && all.indexOf(name) === index;
  });

  const skus = pins.map((pin) => ({
    skuId: pin.id,
    cardId: pin.id,
    finish: null,
  }));

  const doc = {
    meta: {
      setId: "PINS",
      setName: "Pins",
      totalUniquePins: pins.length,
      totalSkus: skus.length,
      sources: [
        { id: "ChasmFriends", name: "ChasmFriends Pins", pinCount: 5 },
        {
          id: "SCG",
          name: "Sanderson Collectors Guild Pins",
          pinCount: scgCount,
          sheetTitle: "Sanderson Collectors Guild Pin List",
          sheetGid: "788070872",
          dataAsOf: "2026-09-28",
        },
      ],
      series,
      groupings: {
        series: "Primary browse/onboarding group (sheet Set column / ChasmFriends).",
        catalog: "Source catalog: ChasmFriends vs Sanderson Collectors Guild.",
        country: "Availability region from the blue book.",
      },
      notes: [
        "Extends ChasmFriends pins; does not replace them.",
        "Blue-book rows imported from Sanderson Collectors Guild Pin List (gid=788070872).",
        "SKU scheme: PIN-CF-## for ChasmFriends; PIN-{SETCODE}-{##|###} for guild sets.",
        "Each pin has a single SKU with no DUN/FOIL finish variants.",
        "Image URLs from the sheet are omitted until a product decision on asset hosting.",
        "Retired pins are omitted from pins and skus. Saved collection rows can still resolve them.",
      ],
    },
    pins,
    retired,
    skus,
  };

  fs.writeFileSync(OUT_PATH, `${JSON.stringify(doc, null, 2)}\n`, "utf8");
  console.log(
    `Wrote ${pins.length} listed pins, ${retired.length} retired (${scgCount} listed SCG) → ${path.relative(ROOT, OUT_PATH)}`,
  );
}

main();
