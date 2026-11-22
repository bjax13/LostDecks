"use strict";

/** Must stay aligned with `validSkuId` / share CSV validators in `firestore.rules`. */
const SHARE_SKU_BODY =
  "(?:LT[0-9]{2}-(?:ELS|LOP|CHM|HLD)-[0-9]{2}-(?:DUN|FOIL)|LT[0-9]{2}-NS-(?:ELS|LOP|CHM)-[0-9]{2}-(?:DUN|FOIL)(?:-[A-Z]+)?|PIN-[A-Z0-9]{2,6}-[0-9]{2,3})";

const SHARE_SKU_PATTERN = new RegExp(`^${SHARE_SKU_BODY}$`);

const SHARE_ISO_MAX_LEN = 16384;
const SHARE_UFT_MAX_LEN = 20000;

const UFT_PAIR_BODY = `${SHARE_SKU_BODY}:[1-9][0-9]{0,2}`;

function parseIsoSkuField(value) {
  if (typeof value !== "string" || value.length === 0) {
    return [];
  }
  return value.split(",");
}

function parseUftSkuField(value) {
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

function buildShareIsoRegex() {
  return new RegExp(`^(?:${SHARE_SKU_BODY})(?:,(?:${SHARE_SKU_BODY}))*$`);
}

function buildShareUftRegex() {
  return new RegExp(`^(?:${UFT_PAIR_BODY})(?:,(?:${UFT_PAIR_BODY}))*$`);
}

function isValidShareIsoField(value) {
  return (
    typeof value === "string" &&
    value.length <= SHARE_ISO_MAX_LEN &&
    (value.length === 0 || buildShareIsoRegex().test(value))
  );
}

function isValidShareUftField(value) {
  return (
    typeof value === "string" &&
    value.length <= SHARE_UFT_MAX_LEN &&
    (value.length === 0 || buildShareUftRegex().test(value))
  );
}

function isSanitizedUftRow(row) {
  return (
    row &&
    typeof row.skuId === "string" &&
    Number.isInteger(row.quantity) &&
    row.quantity >= 1 &&
    row.quantity <= 999 &&
    SHARE_SKU_PATTERN.test(row.skuId)
  );
}

function sanitizeIsoUftForMeta(share) {
  const isoRaw = share?.iso;
  const iso = Array.isArray(isoRaw)
    ? isoRaw.filter((id) => typeof id === "string" && SHARE_SKU_PATTERN.test(id))
    : parseIsoSkuField(isoRaw).filter((id) => SHARE_SKU_PATTERN.test(id));
  const uftRaw = share?.uft;
  const uft = Array.isArray(uftRaw)
    ? uftRaw.filter(isSanitizedUftRow)
    : parseUftSkuField(uftRaw).filter(isSanitizedUftRow);
  return { ...share, iso, uft };
}

module.exports = {
  SHARE_ISO_MAX_LEN,
  SHARE_UFT_MAX_LEN,
  SHARE_SKU_PATTERN,
  parseIsoSkuField,
  parseUftSkuField,
  buildShareIsoRegex,
  buildShareUftRegex,
  isValidShareIsoField,
  isValidShareUftField,
  sanitizeIsoUftForMeta,
};
