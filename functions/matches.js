"use strict";

const MATCH_CONTACT_SHARING = Object.freeze({
  TRUE_EMAIL: "trueEmail",
  TRADING_EMAIL: "tradingEmail",
  DISCORD: "discord",
});

const DEFAULT_DISCORD_CHANNEL = "Sanderson Collectors Guild";

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

  return { isCallerOptedOut: false, matches };
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
      method: MATCH_CONTACT_SHARING.TRUE_EMAIL,
      email,
      usedFallback: true,
      fallbackReason: "Trading email was not set, so their account email was shared instead.",
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
      method: MATCH_CONTACT_SHARING.TRUE_EMAIL,
      email,
      usedFallback: true,
      fallbackReason:
        "Discord information was incomplete, so their account email was shared instead.",
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
  MATCH_CONTACT_SHARING,
  buildMatchesForCaller,
  buildPairRows,
  buildUserMatchProfile,
  buildUserSkuTotals,
  normalizeMatchContactSharing,
  normalizeQuantity,
  resolveMatchContact,
};
