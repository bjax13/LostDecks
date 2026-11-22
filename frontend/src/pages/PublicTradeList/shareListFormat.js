import { getSkuRecord } from "../../data/collectibles.js";
import { parseIsoSkuField, parseUftSkuField } from "../../lib/shareListEncoding.js";

function formatUftLine({ skuId, quantity }) {
  const sku = getSkuRecord(skuId);
  const label = sku?.card?.displayName || sku?.card?.title || skuId;
  if (quantity > 1) {
    return `${label} (×${quantity})`;
  }
  return label;
}

function formatIsoLine(skuId) {
  const sku = getSkuRecord(skuId);
  return sku?.card?.displayName || sku?.card?.title || skuId;
}

export function formatPublicShareLists(share) {
  const isoIds = parseIsoSkuField(share?.iso);
  const uftRows = parseUftSkuField(share?.uft);
  const iso = isoIds.map(formatIsoLine);
  const uft = uftRows.map(formatUftLine);
  return { iso, uft };
}
