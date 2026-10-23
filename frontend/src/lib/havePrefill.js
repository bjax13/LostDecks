/** @typedef {string} SkuId */
/** @typedef {string} SeriesId */

/**
 * @typedef {Readonly<Record<SkuId, number>>} HaveQuantityMap
 */

/**
 * @typedef {{
 *   catalogSkuIds: readonly SkuId[],
 *   seriesList: readonly { id: SeriesId, skuIds: readonly SkuId[] }[],
 * }} HavePrefillContext
 */

/**
 * @typedef {{
 *   quantities: HaveQuantityMap,
 *   expandedSeriesIds: readonly SeriesId[],
 *   status: "empty" | "applied" | "soft-failed",
 *   raiseMerge: (
 *     base: Readonly<Record<SkuId, number>>,
 *     overlay: Readonly<Record<SkuId, number>>,
 *   ) => Record<SkuId, number>,
 * }} HavePrefillSeed
 */

export const HAVE_QTY_MAX = 20;

function raiseMergeQuantities(base, overlay) {
  const next = { ...base };
  for (const [skuId, raw] of Object.entries(overlay ?? {})) {
    if (typeof skuId !== "string" || !skuId) continue;
    const overlayQty =
      typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : Number.NaN;
    if (!Number.isFinite(overlayQty)) continue;
    const baseQty =
      typeof next[skuId] === "number" && Number.isFinite(next[skuId]) ? Math.floor(next[skuId]) : 0;
    next[skuId] = Math.max(0, Math.min(HAVE_QTY_MAX, Math.max(baseQty, overlayQty)));
  }
  for (const [skuId, raw] of Object.entries(next)) {
    const qty = typeof raw === "number" && Number.isFinite(raw) ? Math.floor(raw) : 0;
    next[skuId] = Math.max(0, Math.min(HAVE_QTY_MAX, qty));
  }
  return next;
}

/** @type {HavePrefillSeed} */
export const emptyHavePrefill = Object.freeze({
  quantities: Object.freeze({}),
  expandedSeriesIds: Object.freeze([]),
  status: "empty",
  raiseMerge: raiseMergeQuantities,
});

function makeSeed(status, quantities, expandedSeriesIds) {
  return {
    quantities: Object.freeze({ ...quantities }),
    expandedSeriesIds: Object.freeze([...expandedSeriesIds]),
    status,
    raiseMerge: raiseMergeQuantities,
  };
}

function sha256Hex(text) {
  const bytes = utf8Bytes(text);
  const hash = sha256Bytes(bytes);
  let out = "";
  for (const byte of hash) {
    out += byte.toString(16).padStart(2, "0");
  }
  return out;
}

function utf8Bytes(text) {
  if (typeof TextEncoder !== "undefined") {
    return new TextEncoder().encode(text);
  }
  const encoded = unescape(encodeURIComponent(text));
  const bytes = new Uint8Array(encoded.length);
  for (let i = 0; i < encoded.length; i += 1) {
    bytes[i] = encoded.charCodeAt(i);
  }
  return bytes;
}

function sha256Bytes(message) {
  const K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
  ]);

  const bitLen = message.length * 8;
  const withPadLen = ((message.length + 9 + 63) & ~63) >>> 0;
  const padded = new Uint8Array(withPadLen);
  padded.set(message);
  padded[message.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(withPadLen - 4, bitLen >>> 0, false);

  let h0 = 0x6a09e667;
  let h1 = 0xbb67ae85;
  let h2 = 0x3c6ef372;
  let h3 = 0xa54ff53a;
  let h4 = 0x510e527f;
  let h5 = 0x9b05688c;
  let h6 = 0x1f83d9ab;
  let h7 = 0x5be0cd19;

  const w = new Uint32Array(64);

  for (let offset = 0; offset < withPadLen; offset += 64) {
    for (let i = 0; i < 16; i += 1) {
      w[i] = view.getUint32(offset + i * 4, false);
    }
    for (let i = 16; i < 64; i += 1) {
      const v15 = w[i - 15];
      const v2 = w[i - 2];
      const s0 = ((v15 >>> 7) | (v15 << 25)) ^ ((v15 >>> 18) | (v15 << 14)) ^ (v15 >>> 3);
      const s1 = ((v2 >>> 17) | (v2 << 15)) ^ ((v2 >>> 19) | (v2 << 13)) ^ (v2 >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let a = h0;
    let b = h1;
    let c = h2;
    let d = h3;
    let e = h4;
    let f = h5;
    let g = h6;
    let h = h7;

    for (let i = 0; i < 64; i += 1) {
      const S1 = ((e >>> 6) | (e << 26)) ^ ((e >>> 11) | (e << 21)) ^ ((e >>> 25) | (e << 7));
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = ((a >>> 2) | (a << 30)) ^ ((a >>> 13) | (a << 19)) ^ ((a >>> 22) | (a << 10));
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      h = g;
      g = f;
      f = e;
      e = (d + temp1) >>> 0;
      d = c;
      c = b;
      b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h0 = (h0 + a) >>> 0;
    h1 = (h1 + b) >>> 0;
    h2 = (h2 + c) >>> 0;
    h3 = (h3 + d) >>> 0;
    h4 = (h4 + e) >>> 0;
    h5 = (h5 + f) >>> 0;
    h6 = (h6 + g) >>> 0;
    h7 = (h7 + h) >>> 0;
  }

  const digest = new Uint8Array(32);
  const digestView = new DataView(digest.buffer);
  digestView.setUint32(0, h0, false);
  digestView.setUint32(4, h1, false);
  digestView.setUint32(8, h2, false);
  digestView.setUint32(12, h3, false);
  digestView.setUint32(16, h4, false);
  digestView.setUint32(20, h5, false);
  digestView.setUint32(24, h6, false);
  digestView.setUint32(28, h7, false);
  return digest;
}

function catalogHash(catalogSkuIds) {
  return sha256Hex(catalogSkuIds.join("\n")).slice(0, 8);
}

function parseQtySuffix(suffix) {
  if (suffix === undefined || suffix === "") return 1;
  if (!/^\d{1,2}$/.test(suffix)) return null;
  const qty = Number.parseInt(suffix, 10);
  if (!Number.isFinite(qty) || qty < 1) return null;
  return Math.min(HAVE_QTY_MAX, qty);
}

/**
 * Expand only partially filled series (some Have, some Need).
 * Fully Have / Have spares and fully Need stay collapsed — the header + bulk
 * buttons convey those states.
 */
function expandSeriesIds(quantities, seriesList) {
  const expanded = [];
  for (const series of seriesList ?? []) {
    if (!series?.id || !Array.isArray(series.skuIds) || series.skuIds.length === 0) continue;
    let haveCount = 0;
    let needCount = 0;
    for (const skuId of series.skuIds) {
      const raw = quantities?.[skuId];
      const qty = typeof raw === "number" && Number.isFinite(raw) ? raw : 0;
      if (qty >= 1) haveCount += 1;
      else needCount += 1;
    }
    if (haveCount > 0 && needCount > 0) {
      expanded.push(series.id);
    }
  }
  return expanded;
}

function decodeSkuCsv(raw, knownSkuIds) {
  const quantities = {};
  for (const token of raw.split(",")) {
    const trimmed = token.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    const idPart = (colon === -1 ? trimmed : trimmed.slice(0, colon)).trim().toUpperCase();
    const qtyPart = colon === -1 ? "" : trimmed.slice(colon + 1).trim();
    if (!idPart || !knownSkuIds.has(idPart)) continue;
    const qty = parseQtySuffix(qtyPart);
    if (qty === null) continue;
    quantities[idPart] = qty;
  }
  return quantities;
}

function decodeOrdinalO1(raw, catalogSkuIds) {
  const body = raw.slice(3);
  const firstDot = body.indexOf(".");
  if (firstDot <= 0) {
    return { ok: false, softFailed: true };
  }
  const hash = body.slice(0, firstDot).toLowerCase();
  const itemsPart = body.slice(firstDot + 1);
  if (!/^[0-9a-f]{8}$/.test(hash)) {
    return { ok: false, softFailed: true };
  }
  const expected = catalogHash(catalogSkuIds);
  if (hash !== expected) {
    return { ok: false, softFailed: true };
  }

  const quantities = {};
  if (!itemsPart.trim()) {
    return { ok: true, quantities };
  }

  for (const token of itemsPart.split(",")) {
    const trimmed = token.trim().toLowerCase();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(":");
    const indexPart = colon === -1 ? trimmed : trimmed.slice(0, colon);
    const qtyPart = colon === -1 ? "" : trimmed.slice(colon + 1);
    if (!/^[0-9a-z]+$/.test(indexPart)) continue;
    const index = Number.parseInt(indexPart, 36);
    if (!Number.isFinite(index) || index < 0 || index >= catalogSkuIds.length) continue;
    const qty = parseQtySuffix(qtyPart);
    if (qty === null) continue;
    const skuId = catalogSkuIds[index];
    if (typeof skuId !== "string" || !skuId) continue;
    quantities[skuId] = qty;
  }
  return { ok: true, quantities };
}

/**
 * @param {string | null | undefined} haveRaw
 * @param {HavePrefillContext} context
 * @returns {HavePrefillSeed}
 */
export function decodeHavePrefill(haveRaw, context) {
  const catalogSkuIds = Array.isArray(context?.catalogSkuIds) ? context.catalogSkuIds : [];
  const seriesList = Array.isArray(context?.seriesList) ? context.seriesList : [];

  if (haveRaw == null) {
    return emptyHavePrefill;
  }
  const trimmed = String(haveRaw).trim();
  if (!trimmed) {
    return emptyHavePrefill;
  }

  let quantities;
  if (trimmed.toLowerCase().startsWith("o1.")) {
    const result = decodeOrdinalO1(trimmed, catalogSkuIds);
    if (!result.ok) {
      return makeSeed("soft-failed", {}, []);
    }
    quantities = result.quantities;
  } else {
    const knownSkuIds = new Set(catalogSkuIds);
    quantities = decodeSkuCsv(trimmed, knownSkuIds);
  }

  const expandedSeriesIds = expandSeriesIds(quantities, seriesList);
  return makeSeed("applied", quantities, expandedSeriesIds);
}
