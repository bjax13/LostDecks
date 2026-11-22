/** Must stay aligned with `validSkuId` / share CSV validators in `firestore.rules`. */
export const SHARE_SKU_BODY =
  "(?:LT[0-9]{2}-(?:ELS|LOP|CHM|HLD)-[0-9]{2}-(?:DUN|FOIL)|LT[0-9]{2}-NS-(?:ELS|LOP|CHM)-[0-9]{2}-(?:DUN|FOIL)(?:-[A-Z]+)?|PIN-[A-Z0-9]{2,6}-[0-9]{2,3})";

export const SHARE_SKU_PATTERN = new RegExp(`^${SHARE_SKU_BODY}$`);

export const SHARE_ISO_MAX_LEN = 16384;
export const SHARE_UFT_MAX_LEN = 20000;

const UFT_PAIR_BODY = `${SHARE_SKU_BODY}:[1-9][0-9]{0,2}`;

export function encodeIsoSkuList(skus) {
  const list = Array.isArray(skus)
    ? skus.filter((id) => typeof id === "string" && id.length > 0)
    : [];
  return list.join(",");
}

export function parseIsoSkuField(value) {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  return value.split(",");
}

export function encodeUftSkuList(rows) {
  if (!Array.isArray(rows) || rows.length === 0) {
    return "";
  }
  return rows
    .filter(
      (row) =>
        row &&
        typeof row.skuId === "string" &&
        Number.isInteger(row.quantity) &&
        row.quantity >= 1 &&
        row.quantity <= 999,
    )
    .map((row) => `${row.skuId}:${row.quantity}`)
    .join(",");
}

export function parseUftSkuField(value) {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  return value.split(",").map((part) => {
    const colon = part.lastIndexOf(":");
    if (colon <= 0) {
      return { skuId: part, quantity: NaN };
    }
    return {
      skuId: part.slice(0, colon),
      quantity: Number(part.slice(colon + 1)),
    };
  });
}

export function buildShareIsoRegex() {
  return new RegExp(`^(?:${SHARE_SKU_BODY})(?:,(?:${SHARE_SKU_BODY}))*$`);
}

export function buildShareUftRegex() {
  return new RegExp(`^(?:${UFT_PAIR_BODY})(?:,(?:${UFT_PAIR_BODY}))*$`);
}

export function isValidShareIsoField(value) {
  return (
    typeof value === "string" &&
    value.length <= SHARE_ISO_MAX_LEN &&
    (value.length === 0 || buildShareIsoRegex().test(value))
  );
}

export function isValidShareUftField(value) {
  return (
    typeof value === "string" &&
    value.length <= SHARE_UFT_MAX_LEN &&
    (value.length === 0 || buildShareUftRegex().test(value))
  );
}
