import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const STORY_DATA = path.resolve(__dirname, "../../frontend/src/storyData");

function loadJson(fileName) {
  const fullPath = path.join(STORY_DATA, fileName);
  return JSON.parse(fs.readFileSync(fullPath, "utf8"));
}

function finishesByCardId(skus) {
  const map = new Map();
  for (const sku of skus) {
    if (!sku.finish) continue;
    const finish = String(sku.finish).toUpperCase();
    if (!map.has(sku.cardId)) map.set(sku.cardId, new Set());
    map.get(sku.cardId).add(finish);
  }
  return map;
}

function skuIdsByCardId(skus) {
  const map = new Map();
  for (const sku of skus) {
    if (!map.has(sku.cardId)) map.set(sku.cardId, []);
    map.get(sku.cardId).push(sku.skuId);
  }
  return map;
}

function finishList(finishMap, cardId) {
  const set = finishMap.get(cardId);
  return set ? [...set].sort() : [];
}

function buildIndex() {
  const dataset = loadJson("storydeck-lt24-with-skus.json");
  const pinDataset = loadJson("chasmfriends-pins.json");
  const allSkus = [...dataset.skus, ...pinDataset.skus];
  const finishMap = finishesByCardId(allSkus);
  const skuMap = skuIdsByCardId(allSkus);

  const storyTitleByCode = Object.fromEntries(
    (dataset.stories || []).map((story) => [story.code, story.title]),
  );

  const collectibles = [];

  for (const card of dataset.storyCards || []) {
    const storyTitle = storyTitleByCode[card.story] ?? card.story;
    const displayName = `${storyTitle} #${String(card.number).padStart(2, "0")}`;
    collectibles.push({
      id: card.id,
      category: card.category,
      displayName,
      storyTitle,
      skuIds: skuMap.get(card.id) || [],
      finishes: finishList(finishMap, card.id),
      searchTokens: [card.id, card.story, storyTitle, displayName].join(" ").toLowerCase(),
    });
  }

  for (const card of dataset.heralds || []) {
    const displayName = card.heraldName;
    collectibles.push({
      id: card.id,
      category: card.category,
      displayName,
      storyTitle: "Heraldic Order",
      skuIds: skuMap.get(card.id) || [],
      finishes: finishList(finishMap, card.id),
      searchTokens: [card.id, displayName, "Herald", card.rarityTier ?? ""].join(" ").toLowerCase(),
    });
  }

  for (const card of dataset.nonsense?.knownCards || []) {
    const storyTitle = storyTitleByCode[card.story] ?? card.story;
    const variantLabel = card.variantName ? `Variant: ${card.variantName}` : "Standard Variant";
    const displayName = `${storyTitle} Nonsense #${String(card.baseNumber).padStart(2, "0")}`;
    collectibles.push({
      id: card.id,
      category: card.category,
      displayName,
      storyTitle,
      skuIds: skuMap.get(card.id) || [],
      finishes: finishList(finishMap, card.id),
      searchTokens: [card.id, card.story, storyTitle, variantLabel, displayName]
        .join(" ")
        .toLowerCase(),
    });
  }

  for (const pin of pinDataset.pins || []) {
    const displayName = pin.name;
    const storyTitle = pin.series ?? "Pins";
    collectibles.push({
      id: pin.id,
      category: "pin",
      displayName,
      storyTitle,
      skuIds: skuMap.get(pin.id) || [pin.id],
      finishes: finishList(finishMap, pin.id),
      searchTokens: [pin.id, displayName, storyTitle, pin.detail ?? ""].join(" ").toLowerCase(),
    });
  }

  const validSkuIds = new Set(allSkus.map((sku) => sku.skuId));
  return { collectibles, validSkuIds };
}

const index = buildIndex();

/**
 * Substring search over catalog searchTokens (mirrors SPA explorer behavior).
 */
export function searchCatalog({ query, category, limit = 10 }) {
  const term = String(query || "")
    .trim()
    .toLowerCase();
  const max = Math.min(Math.max(Number(limit) || 10, 1), 25);
  if (!term) {
    return { results: [], totalMatched: 0 };
  }

  const matched = [];
  for (const item of index.collectibles) {
    if (category && item.category !== category) continue;
    if (!item.searchTokens.includes(term)) continue;
    matched.push(item);
  }

  return {
    results: matched.slice(0, max).map((item) => ({
      id: item.id,
      displayName: item.displayName,
      category: item.category,
      storyTitle: item.storyTitle,
      skuIds: item.skuIds,
      finishes: item.finishes,
    })),
    totalMatched: matched.length,
  };
}

export function isValidSkuId(skuId) {
  return index.validSkuIds.has(skuId);
}

export function catalogStats() {
  return {
    collectibleCount: index.collectibles.length,
    skuCount: index.validSkuIds.size,
  };
}
