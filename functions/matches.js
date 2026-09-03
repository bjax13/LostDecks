"use strict";

const MATCH_CONTACT_SHARING = Object.freeze({
  TRUE_EMAIL: "trueEmail",
  TRADING_EMAIL: "tradingEmail",
  DISCORD: "discord",
});

const DEFAULT_DISCORD_CHANNEL = "Sanderson Collectors Guild";
const DEFAULT_MATCH_PAGE_SIZE = 20;
const MAX_MATCH_PAGE_SIZE = 50;

function normalizeQuantity(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return 0;
  }
  return Math.max(0, Math.floor(value));
}

function buildUserSkuTotals(collectionDocs) {
  const userSkuTotals = new Map();

  for (const entry of collectionDocs) {
    const ownerUid = typeof entry?.ownerUid === "string" ? entry.ownerUid.trim() : "";
    const skuId = typeof entry?.skuId === "string" ? entry.skuId.trim() : "";
    if (!ownerUid || !skuId) {
      continue;
    }

    const quantity = normalizeQuantity(entry.quantity);
    if (quantity <= 0) {
      continue;
    }

    let skuTotals = userSkuTotals.get(ownerUid);
    if (!skuTotals) {
      skuTotals = new Map();
      userSkuTotals.set(ownerUid, skuTotals);
    }
    skuTotals.set(skuId, (skuTotals.get(skuId) || 0) + quantity);
  }

  return userSkuTotals;
}

function buildUserMatchProfile(skuTotals) {
  const extras = new Set();

  for (const [skuId, owned] of skuTotals.entries()) {
    if (owned > 1) {
      extras.add(skuId);
    }
  }

  return { extras };
}

function buildPairRows({ callerTotals, callerExtras, otherTotals, otherExtras, pairLimit = 100 }) {
  const offeredByOther = [];
  for (const skuId of otherExtras) {
    const callerOwned = callerTotals.get(skuId) || 0;
    if (callerOwned <= 0) {
      offeredByOther.push(skuId);
    }
  }

  const neededFromCaller = [];
  for (const skuId of callerExtras) {
    const otherOwned = otherTotals.get(skuId) || 0;
    if (otherOwned <= 0) {
      neededFromCaller.push(skuId);
    }
  }

  if (!offeredByOther.length || !neededFromCaller.length) {
    return [];
  }

  const pairs = [];
  for (const theirSkuId of offeredByOther) {
    for (const yourSkuId of neededFromCaller) {
      pairs.push({ theirSkuId, yourSkuId });
      if (pairs.length >= pairLimit) {
        return pairs;
      }
    }
  }

  return pairs;
}

function buildMatchesForCaller({
  callerUid,
  userSkuTotals,
  optedOutUserIds = new Set(),
  pairLimit = 100,
}) {
  if (optedOutUserIds.has(callerUid)) {
    return { isCallerOptedOut: true, matches: [] };
  }

  const callerTotals = userSkuTotals.get(callerUid) || new Map();
  const callerProfile = buildUserMatchProfile(callerTotals);
  const matches = [];

  for (const [otherUid, otherTotals] of userSkuTotals.entries()) {
    if (otherUid === callerUid || optedOutUserIds.has(otherUid)) {
      continue;
    }

    const otherProfile = buildUserMatchProfile(otherTotals);
    const pairs = buildPairRows({
      callerTotals,
      callerExtras: callerProfile.extras,
      otherTotals,
      otherExtras: otherProfile.extras,
      pairLimit,
    });

    if (pairs.length > 0) {
      matches.push({ userId: otherUid, pairs });
    }
  }

  matches.sort((a, b) => a.userId.localeCompare(b.userId));
  return { isCallerOptedOut: false, matches };
}

function normalizeMatchPageSize(value, { defaultSize = DEFAULT_MATCH_PAGE_SIZE } = {}) {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    return defaultSize;
  }
  return Math.min(MAX_MATCH_PAGE_SIZE, Math.max(1, Math.floor(value)));
}

function normalizeMatchCursor(value) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

/**
 * Cursor-based pagination over counterparty match rows sorted by userId.
 * `cursor` is the last userId from the previous page (exclusive start).
 */
function paginateMatches(matches, { pageSize, cursor } = {}) {
  const normalizedPageSize = normalizeMatchPageSize(pageSize);
  const normalizedCursor = normalizeMatchCursor(cursor);
  const ordered = Array.isArray(matches) ? matches : [];

  let startIndex = 0;
  if (normalizedCursor) {
    const cursorIndex = ordered.findIndex((match) => match.userId === normalizedCursor);
    startIndex = cursorIndex >= 0 ? cursorIndex + 1 : ordered.length;
  }

  const page = ordered.slice(startIndex, startIndex + normalizedPageSize);
  const hasMore = startIndex + normalizedPageSize < ordered.length;
  const nextCursor = hasMore && page.length > 0 ? page[page.length - 1].userId : null;

  return {
    matches: page,
    pageSize: normalizedPageSize,
    nextCursor,
    hasMore,
    totalOnPage: page.length,
  };
}

function normalizeMatchContactSharing(value) {
  if (
    value === MATCH_CONTACT_SHARING.TRUE_EMAIL ||
    value === MATCH_CONTACT_SHARING.TRADING_EMAIL ||
    value === MATCH_CONTACT_SHARING.DISCORD
  ) {
    return value;
  }
  return MATCH_CONTACT_SHARING.TRUE_EMAIL;
}

function trimOptionalString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function resolvePublicDisplayName(user) {
  const displayName = typeof user?.displayName === "string" ? user.displayName.trim() : "";
  if (displayName) {
    return displayName;
  }
  const uid = typeof user?.uid === "string" ? user.uid.trim() : "";
  return uid || "Collector";
}

function resolveMatchContact({ preferences, trueEmail }) {
  const sharing = normalizeMatchContactSharing(preferences?.matchContactSharing);
  const tradingEmail = trimOptionalString(preferences?.tradingEmail);
  const discordHandle = trimOptionalString(preferences?.discordHandle);
  const discordChannel = trimOptionalString(preferences?.discordChannel) || DEFAULT_DISCORD_CHANNEL;
  const email = trimOptionalString(trueEmail);

  if (sharing === MATCH_CONTACT_SHARING.TRADING_EMAIL) {
    if (tradingEmail) {
      return {
        method: MATCH_CONTACT_SHARING.TRADING_EMAIL,
        email: tradingEmail,
        usedFallback: false,
        fallbackReason: null,
      };
    }

    return {
      method: MATCH_CONTACT_SHARING.TRADING_EMAIL,
      usedFallback: false,
      fallbackReason: "Trading email is not set, so no contact details were shared.",
    };
  }

  if (sharing === MATCH_CONTACT_SHARING.DISCORD) {
    if (discordHandle) {
      return {
        method: MATCH_CONTACT_SHARING.DISCORD,
        discordHandle,
        discordChannel,
        usedFallback: false,
        fallbackReason: null,
      };
    }

    return {
      method: MATCH_CONTACT_SHARING.DISCORD,
      usedFallback: false,
      fallbackReason: "Discord information is incomplete, so no contact details were shared.",
    };
  }

  return {
    method: MATCH_CONTACT_SHARING.TRUE_EMAIL,
    email,
    usedFallback: false,
    fallbackReason: null,
  };
}

module.exports = {
  DEFAULT_DISCORD_CHANNEL,
  DEFAULT_MATCH_PAGE_SIZE,
  MATCH_CONTACT_SHARING,
  MAX_MATCH_PAGE_SIZE,
  buildMatchesForCaller,
  buildPairRows,
  buildUserMatchProfile,
  buildUserSkuTotals,
  normalizeMatchContactSharing,
  normalizeMatchCursor,
  normalizeMatchPageSize,
  normalizeQuantity,
  paginateMatches,
  resolveMatchContact,
  resolvePublicDisplayName,
};
