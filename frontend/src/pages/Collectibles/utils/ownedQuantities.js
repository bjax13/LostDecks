import { resolveSkuId } from "../../../data/collectibles";
import {
  ownedQuantityFromEntry,
  resolveCollectionEntrySkuId,
} from "../../Collection/utils/collectionEntrySku.js";

/**
 * Aggregate owned quantities by skuId from the user's collection entries.
 * Multiple docs for the same SKU are summed.
 */
export function buildOwnedQuantityBySkuId(entries) {
  const ownedBySkuId = {};
  if (!Array.isArray(entries)) {
    return ownedBySkuId;
  }

  for (const entry of entries) {
    const skuId = resolveCollectionEntrySkuId(entry);
    if (!skuId) continue;
    const quantity = Math.max(0, ownedQuantityFromEntry(entry));
    if (quantity <= 0) continue;
    ownedBySkuId[skuId] = (ownedBySkuId[skuId] ?? 0) + quantity;
  }

  return ownedBySkuId;
}

/**
 * Look up owned quantity for a collectible + optional finish.
 */
export function getOwnedQuantity(ownedBySkuId, collectible, finish = null) {
  if (!ownedBySkuId || !collectible?.id) return 0;
  const skuId = resolveSkuId(collectible, finish);
  if (!skuId) return 0;
  return ownedBySkuId[skuId] ?? 0;
}
