const STORAGE_KEY = "pendingPinPicks";
const VERSION = 1;
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function isPlainObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function normalizeQuantities(raw) {
  if (!isPlainObject(raw)) {
    return null;
  }
  const quantities = {};
  for (const [skuId, value] of Object.entries(raw)) {
    if (typeof skuId !== "string" || !skuId.trim()) {
      continue;
    }
    const qty =
      typeof value === "number" && Number.isFinite(value)
        ? Math.max(0, Math.floor(value))
        : Number.NaN;
    if (!Number.isFinite(qty)) {
      continue;
    }
    quantities[skuId.trim().toUpperCase()] = qty;
  }
  return quantities;
}

function readStorage() {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }
}

function writeStorage(value) {
  try {
    window.localStorage.setItem(STORAGE_KEY, value);
    return true;
  } catch {
    return false;
  }
}

function removeStorage() {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch {
    return false;
  }
}

/**
 * @param {Record<string, number>} quantities
 * @param {{ utm_source?: string | null, utm_campaign?: string | null }} [source]
 * @returns {boolean}
 */
export function savePendingPicks(quantities, source = {}) {
  const normalized = normalizeQuantities(quantities);
  if (!normalized) {
    return false;
  }
  const payload = {
    version: VERSION,
    savedAt: Date.now(),
    source: {
      utm_source: typeof source.utm_source === "string" ? source.utm_source : null,
      utm_campaign: typeof source.utm_campaign === "string" ? source.utm_campaign : null,
    },
    quantities: normalized,
  };
  return writeStorage(JSON.stringify(payload));
}

/**
 * @param {{ now?: number }} [options]
 * @returns {{ version: number, savedAt: number, source: object, quantities: Record<string, number> } | null}
 */
export function loadPendingPicks({ now = Date.now() } = {}) {
  const raw = readStorage();
  if (!raw) {
    return null;
  }

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch {
    removeStorage();
    return null;
  }

  if (!isPlainObject(parsed) || parsed.version !== VERSION) {
    removeStorage();
    return null;
  }

  const savedAt = typeof parsed.savedAt === "number" ? parsed.savedAt : Number.NaN;
  if (!Number.isFinite(savedAt) || now - savedAt > MAX_AGE_MS) {
    removeStorage();
    return null;
  }

  const quantities = normalizeQuantities(parsed.quantities);
  if (!quantities) {
    removeStorage();
    return null;
  }

  return {
    version: VERSION,
    savedAt,
    source: isPlainObject(parsed.source) ? parsed.source : {},
    quantities,
  };
}

/** @returns {boolean} */
export function clearPendingPicks() {
  return removeStorage();
}

/**
 * Build bulk-import rows only where the pick raises quantity above existing.
 * Never emits 0 and never lowers a quantity.
 *
 * @param {Record<string, number>} picks
 * @param {Array<{ skuId?: string, quantity?: number, count?: number, copies?: number, total?: number }>} existingEntries
 * @returns {Array<{ skuId: string, quantity: number }>}
 */
export function mergePickRows(picks, existingEntries = []) {
  const existingBySku = new Map();
  for (const entry of existingEntries ?? []) {
    const skuId = typeof entry?.skuId === "string" ? entry.skuId.trim().toUpperCase() : "";
    if (!skuId) continue;
    const raw = entry.quantity ?? entry.count ?? entry.copies ?? entry.total;
    const qty = typeof raw === "number" && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : 0;
    existingBySku.set(skuId, (existingBySku.get(skuId) ?? 0) + qty);
  }

  const rows = [];
  for (const [skuId, rawPick] of Object.entries(picks ?? {})) {
    const key = typeof skuId === "string" ? skuId.trim().toUpperCase() : "";
    if (!key) continue;
    const picked =
      typeof rawPick === "number" && Number.isFinite(rawPick)
        ? Math.max(0, Math.floor(rawPick))
        : 0;
    if (picked <= 0) continue;
    const existingQty = existingBySku.get(key) ?? 0;
    if (picked > existingQty) {
      rows.push({ skuId: key, quantity: picked });
    }
  }
  return rows;
}
