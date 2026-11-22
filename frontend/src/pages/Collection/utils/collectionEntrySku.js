import { getSkuRecord, toSkuId } from "../../../data/collectibles";

export function ownedQuantityFromEntry(entry) {
  const candidates = [entry?.quantity, entry?.count, entry?.copies, entry?.total];
  for (const candidate of candidates) {
    if (typeof candidate === "number" && Number.isFinite(candidate)) {
      return Math.max(0, Math.floor(candidate));
    }
  }
  return 0;
}

/**
 * Match Firestore collection docs: skuId field, cardId + finish (cards), pin cardId,
 * or a catalog SKU stored only in the document id (legacy rows).
 */
export function resolveCollectionEntrySkuId(entry) {
  const rawSku = typeof entry?.skuId === "string" ? entry.skuId.trim() : "";
  if (rawSku) {
    return rawSku.toUpperCase();
  }

  const cardId = typeof entry?.cardId === "string" ? entry.cardId.trim() : "";
  if (cardId) {
    const finish = entry?.finish;
    if (finish) {
      const resolved = toSkuId(cardId, finish);
      return resolved ? resolved.toUpperCase() : null;
    }
    return cardId.toUpperCase();
  }

  const docId = typeof entry?.id === "string" ? entry.id.trim() : "";
  if (docId) {
    const normalized = docId.toUpperCase();
    if (getSkuRecord(normalized)) {
      return normalized;
    }
  }

  return null;
}

/** Stable signature for re-hydrating Getting Started when Firestore snapshot changes. */
export function collectionEntriesHydrationKey(entries = []) {
  return [...entries]
    .map((entry) => {
      const sku = resolveCollectionEntrySkuId(entry) ?? "";
      return `${entry.id ?? ""}:${sku}:${ownedQuantityFromEntry(entry)}`;
    })
    .sort()
    .join("|");
}
