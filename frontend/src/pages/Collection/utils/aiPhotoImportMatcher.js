import { datasetSkus, getSkuRecord, toSkuId } from "../../../data/collectibles";
import { isPinSkuId } from "./bulkImport.js";

const SKU_PATTERN = /^[A-Z0-9]+(?:-[A-Z0-9]+)+$/;

function normalizeText(value) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function scoreLabelOverlap(a, b) {
  if (!a || !b) {
    return 0;
  }
  const left = new Set(normalizeText(a).split(/\s+/).filter(Boolean));
  const right = new Set(normalizeText(b).split(/\s+/).filter(Boolean));
  if (!left.size || !right.size) {
    return 0;
  }
  let overlap = 0;
  for (const token of left) {
    if (right.has(token)) {
      overlap += 1;
    }
  }
  return overlap / Math.max(left.size, right.size);
}

function catalogSearchRows() {
  return datasetSkus.map((sku) => {
    const record = getSkuRecord(sku.skuId);
    const card = record?.card;
    const label = [card?.displayName, card?.storyTitle, card?.title, sku.skuId, sku.cardId]
      .filter(Boolean)
      .join(" ");
    return {
      skuId: sku.skuId,
      cardId: sku.cardId,
      finish: sku.finish ?? null,
      isPin: isPinSkuId(sku.skuId),
      label,
    };
  });
}

const searchIndex = catalogSearchRows();

/**
 * @param {string | null | undefined} printedId
 */
function lookupByPrintedId(printedId) {
  if (!printedId || !SKU_PATTERN.test(printedId)) {
    return null;
  }
  const upper = printedId.toUpperCase();
  const direct = getSkuRecord(upper);
  if (direct) {
    return { skuId: upper, confidence: 0.95, matchReason: "printed-id" };
  }
  const parts = upper.split("-");
  if (parts.length >= 3) {
    const maybeFinish = parts[parts.length - 1];
    const maybeCardId = parts.slice(0, -1).join("-");
    if (/^(DUN|FOIL|GOLD)$/i.test(maybeFinish)) {
      const derived = toSkuId(maybeCardId, maybeFinish);
      if (derived && getSkuRecord(derived)) {
        return { skuId: derived, confidence: 0.9, matchReason: "printed-id-derived" };
      }
    }
  }
  return null;
}

/**
 * @param {Record<string, unknown>} extraction
 */
export function rankCatalogMatchesForExtraction(extraction) {
  const printedMatch = lookupByPrintedId(extraction.printedId);
  if (printedMatch) {
    return [
      {
        skuId: printedMatch.skuId,
        score: printedMatch.confidence,
        reason: printedMatch.matchReason,
      },
    ];
  }

  const storyLine = [extraction.name, extraction.variant, extraction.number]
    .filter(Boolean)
    .join(" ");
  const finish =
    typeof extraction.finish === "string" ? extraction.finish.trim().toUpperCase() : null;
  const kind = extraction.kind === "pin" ? "pin" : "card";

  const ranked = searchIndex
    .filter((row) => (kind === "pin" ? row.isPin : !row.isPin))
    .map((row) => {
      let score = scoreLabelOverlap(storyLine, row.label) * 0.75;
      if (finish && row.finish === finish) {
        score += 0.2;
      }
      if (typeof extraction.number === "string" && row.label.includes(extraction.number)) {
        score += 0.05;
      }
      const visionConfidence =
        typeof extraction.confidence === "number" ? extraction.confidence * 0.15 : 0;
      return {
        skuId: row.skuId,
        score: Math.min(0.99, score + visionConfidence),
        reason: "catalog-search",
      };
    })
    .filter((row) => row.score >= 0.2)
    .sort((a, b) => b.score - a.score);

  return ranked.slice(0, 8);
}

/**
 * @param {Record<string, unknown>} extraction
 */
export function matchExtractionToCatalog(extraction) {
  const candidates = rankCatalogMatchesForExtraction(extraction);
  const top = candidates[0] ?? null;
  const visionConfidence = typeof extraction.confidence === "number" ? extraction.confidence : 0;
  const matchConfidence = top ? Math.min(0.99, top.score * 0.7 + visionConfidence * 0.3) : 0;
  return {
    skuId: top?.skuId ?? null,
    matchConfidence,
    candidates,
    extraction,
  };
}

/**
 * @param {Record<string, unknown>[]} extractions
 */
export function matchExtractionsToCatalog(extractions) {
  return (extractions ?? []).map((item) => matchExtractionToCatalog(item));
}
