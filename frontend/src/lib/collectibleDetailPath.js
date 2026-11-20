/**
 * Canonical detail URL for a collectible.
 * Pins use a SKU id equal to the collectible id. Repeating it
 * (`/collectibles/PIN-CF-02/PIN-CF-02`) still loads, but the link should be
 * `/collectibles/PIN-CF-02`. A distinct finish SKU keeps both segments.
 */
export function collectibleDetailPath(collectibleId, skuId) {
  const id = typeof collectibleId === "string" ? collectibleId.trim() : "";
  if (!id) {
    return null;
  }
  const sku = typeof skuId === "string" ? skuId.trim() : "";
  if (!sku || sku === id) {
    return `/collectibles/${id}`;
  }
  return `/collectibles/${id}/${sku}`;
}

const doubledDetailPath = /\/collectibles\/([^/]+)\/\1$/;

export function isDoubledCollectibleDetailPath(path) {
  return typeof path === "string" && doubledDetailPath.test(path.split("?")[0]);
}
