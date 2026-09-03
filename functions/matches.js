"use strict";

const MATCH_CONTACT_SHARING = Object.freeze({
  TRUE_EMAIL: "trueEmail",
  TRADING_EMAIL: "tradingEmail",
  DISCORD: "discord",
});

const DEFAULT_DISCORD_CHANNEL = "Sanderson Collectors Guild";
const DEFAULT_MATCH_PAGE_SIZE = 20;
const MAX_MATCH_PAGE_SIZE = 50;

const MATCH_LANE_IDS = Object.freeze(["dun", "foil", "pins"]);
const DEFAULT_MATCH_LANES = Object.freeze({
  dun: true,
  foil: true,
  pins: true,
});
const DEFAULT_PILE_ITEM_LIMIT = 100;

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

function laneForSkuId(skuId) {
  if (typeof skuId !== "string" || !skuId) {
    return null;
  }

  const tokens = skuId.split("-");
  if (tokens[0] === "PIN") {
    return "pins";
  }
  if (tokens.includes("FOIL")) {
    return "foil";
  }
  if (tokens.includes("DUN")) {
    return "dun";
  }
  return null;
}

function buildPileItems(extras, ownerTotals, recipientTotals, lane, itemLimit) {
  const items = [];
  const limit =
    typeof itemLimit === "number" && Number.isFinite(itemLimit) && itemLimit > 0
      ? Math.floor(itemLimit)
      : DEFAULT_PILE_ITEM_LIMIT;

  for (const skuId of extras) {
    if (laneForSkuId(skuId) !== lane) {
      continue;
    }

    const owned = ownerTotals.get(skuId) || 0;
    const recipientOwned = recipientTotals.get(skuId) || 0;
    if (owned <= 1 || recipientOwned > 0) {
      continue;
    }

    items.push({
      skuId,
      owned,
      extras: owned - 1,
    });
  }

  items.sort((a, b) => a.skuId.localeCompare(b.skuId));
  return items.slice(0, limit);
}

function normalizeMatchLanes(value) {
  const source = value && typeof value === "object" ? value : {};
  return {
    dun: typeof source.dun === "boolean" ? source.dun : DEFAULT_MATCH_LANES.dun,
    foil: typeof source.foil === "boolean" ? source.foil : DEFAULT_MATCH_LANES.foil,
    pins: typeof source.pins === "boolean" ? source.pins : DEFAULT_MATCH_LANES.pins,
  };
}

function isMatchLaneEnabled(lanePrefs, lane) {
  return Boolean(normalizeMatchLanes(lanePrefs)[lane]);
}

function buildLanePrefsByUserId(preferencesByUserId) {
  const lanePrefsByUserId = new Map();
  if (!preferencesByUserId) {
    return lanePrefsByUserId;
  }

  for (const [userId, preferences] of preferencesByUserId.entries()) {
    if (!userId) {
      continue;
    }
    lanePrefsByUserId.set(userId, normalizeMatchLanes(preferences?.matchLanes));
  }

  return lanePrefsByUserId;
}

function buildLanesForCounterparty({
  callerTotals,
  callerExtras,
  otherTotals,
  otherExtras,
  callerLanePrefs,
  otherLanePrefs,
  itemLimit = DEFAULT_PILE_ITEM_LIMIT,
}) {
  const lanes = [];

  for (const lane of MATCH_LANE_IDS) {
    if (!isMatchLaneEnabled(callerLanePrefs, lane) || !isMatchLaneEnabled(otherLanePrefs, lane)) {
      continue;
    }

    const theyCanSend = buildPileItems(otherExtras, otherTotals, callerTotals, lane, itemLimit);
    const youCanSend = buildPileItems(callerExtras, callerTotals, otherTotals, lane, itemLimit);
    if (!theyCanSend.length || !youCanSend.length) {
      continue;
    }

    lanes.push({
      id: lane,
      theyCanSend,
      youCanSend,
    });
  }

  return lanes;
}

function buildMatchesForCaller({
  callerUid,
  userSkuTotals,
  optedOutUserIds = new Set(),
  lanePrefsByUserId = new Map(),
  itemLimit = DEFAULT_PILE_ITEM_LIMIT,
}) {
  if (optedOutUserIds.has(callerUid)) {
    return { isCallerOptedOut: true, matches: [] };
  }

  const callerTotals = userSkuTotals.get(callerUid) || new Map();
  const callerProfile = buildUserMatchProfile(callerTotals);
  const callerLanePrefs = lanePrefsByUserId.get(callerUid);
  const matches = [];

  for (const [otherUid, otherTotals] of userSkuTotals.entries()) {
    if (otherUid === callerUid || optedOutUserIds.has(otherUid)) {
      continue;
    }

    const otherProfile = buildUserMatchProfile(otherTotals);
    const lanes = buildLanesForCounterparty({
      callerTotals,
      callerExtras: callerProfile.extras,
      otherTotals,
      otherExtras: otherProfile.extras,
      callerLanePrefs,
      otherLanePrefs: lanePrefsByUserId.get(otherUid),
      itemLimit,
    });

    if (lanes.length > 0) {
      matches.push({ userId: otherUid, lanes });
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
  DEFAULT_MATCH_LANES,
  DEFAULT_MATCH_PAGE_SIZE,
  DEFAULT_PILE_ITEM_LIMIT,
  MATCH_CONTACT_SHARING,
  MATCH_LANE_IDS,
  MAX_MATCH_PAGE_SIZE,
  buildLanePrefsByUserId,
  buildLanesForCounterparty,
  buildMatchesForCaller,
  buildUserMatchProfile,
  buildUserSkuTotals,
  isMatchLaneEnabled,
  laneForSkuId,
  normalizeMatchContactSharing,
  normalizeMatchCursor,
  normalizeMatchLanes,
  normalizeMatchPageSize,
  normalizeQuantity,
  paginateMatches,
  resolveMatchContact,
  resolvePublicDisplayName,
};
