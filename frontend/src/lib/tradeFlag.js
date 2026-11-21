export const TRADE_FLAG_ISO = "iso";
export const TRADE_FLAG_UFT = "uft";

export const TRADE_STATUS_HELP =
  "ISO: you're looking for this one. UFT: you'll trade this one. Matches use these on top of your keep count.";

export const TRADE_STATUS_UFT_HINT = "own at least 1 to mark up for trade.";

export const TRADE_STATUS_SAVE_ERROR = "couldn't save, try again";

export const CLEARED_UFT_TOAST = "removed from up for trade.";

const TRADE_STATUS_EMPTY = {
  iso: "nothing marked ISO yet. open an item and set its trade status.",
  uft: "nothing marked UFT yet. open an item and set its trade status.",
  flagged: "nothing marked Flagged yet. open an item and set its trade status.",
};

export function normalizeTradeFlag(value) {
  return value === TRADE_FLAG_ISO || value === TRADE_FLAG_UFT ? value : null;
}

export function tradeFlagLabel(flag) {
  if (flag === TRADE_FLAG_ISO) return "ISO";
  if (flag === TRADE_FLAG_UFT) return "UFT";
  return "";
}

export function tradeStatusEmptyMessage(filter) {
  return TRADE_STATUS_EMPTY[filter] ?? null;
}

export function entryMatchesTradeStatus(flag, filter) {
  const normalized = normalizeTradeFlag(flag);
  if (!filter || filter === "all") return true;
  if (filter === "iso") return normalized === TRADE_FLAG_ISO;
  if (filter === "uft") return normalized === TRADE_FLAG_UFT;
  if (filter === "flagged") return normalized != null;
  return true;
}

export function buildTradeFlagBySkuId(entries) {
  const flags = {};
  if (!Array.isArray(entries)) return flags;
  for (const entry of entries) {
    const skuId = typeof entry?.skuId === "string" ? entry.skuId.trim() : "";
    const flag = normalizeTradeFlag(entry?.tradeFlag);
    if (!skuId || !flag) continue;
    flags[skuId] = flag;
  }
  return flags;
}

/** Keep a quantity key for flagged zeros so read-only tags can render. */
export function withFlaggedZeroQuantities(ownedBySkuId, entries) {
  const next = { ...(ownedBySkuId ?? {}) };
  if (!Array.isArray(entries)) return next;
  for (const entry of entries) {
    const skuId = typeof entry?.skuId === "string" ? entry.skuId.trim() : "";
    const flag = normalizeTradeFlag(entry?.tradeFlag);
    if (!skuId || !flag) continue;
    if (!Object.hasOwn(next, skuId)) next[skuId] = 0;
  }
  return next;
}

export function pileTradeFlagTag(side, flags) {
  const list = Array.isArray(flags) ? flags : [flags];
  const labels = [];
  if (list.includes(TRADE_FLAG_ISO)) labels.push("ISO");
  if (list.includes(TRADE_FLAG_UFT)) labels.push("UFT");
  if (labels.length === 0) return "";
  const prefix = side === "they" ? "They can send you" : "You can send them";
  return `${prefix} · ${labels.join(" · ")}`;
}
