import { getSkuRecord } from "../../data/collectibles.js";

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
  const iso = Array.isArray(share?.iso) ? share.iso.map(formatIsoLine) : [];
  const uft = Array.isArray(share?.uft) ? share.uft.map(formatUftLine) : [];
  return { iso, uft };
}
