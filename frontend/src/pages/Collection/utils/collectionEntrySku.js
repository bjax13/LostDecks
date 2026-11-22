import { getSkuRecord, toSkuId } from "../../../data/collectibles";

export function normalizeQuantityValue(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Math.max(0, Math.floor(value));
  }
  if (typeof value === "string" && value.trim().length > 0) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) {
      return Math.max(0, Math.floor(parsed));
    }
  }
  return 0;
}

const OWNED_QUANTITY_FIELDS = ["quantity", "count", "copies", "total"];

/**
 * Owned quantity from a Firestore collection doc.
 * Matches collectionPresentation: missing quantity fields imply 1; explicit zero stays zero.
 */
export function ownedQuantityFromEntry(entry) {
  if (!entry) {
    return 0;
  }
  for (const key of OWNED_QUANTITY_FIELDS) {
    if (!Object.hasOwn(entry, key)) {
      continue;
    }
    const raw = entry[key];
    if (raw == null) {
      continue;
    }
    if (typeof raw === "string" && raw.trim().length === 0) {
      continue;
    }
    return normalizeQuantityValue(raw);
  }
  return 1;
}

/**
 * Match Firestore collection docs: skuId field, cardId + finish (cards), pin cardId,
 * or a catalog SKU stored only in the document id (legacy rows).
 */
function rawLegacySkuField(entry) {
  for (const key of ["skuId", "sku", "skuid"]) {
    const raw = entry?.[key];
    if (typeof raw === "string" && raw.trim().length > 0) {
      return raw.trim();
    }
  }
  return "";
}

export function resolveCollectionEntrySkuId(entry) {
  const rawSku = rawLegacySkuField(entry);
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
