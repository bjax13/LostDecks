"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildMatchesForCaller,
  buildUserMatchProfile,
  buildUserSkuTotals,
  DEFAULT_DISCORD_CHANNEL,
  DEFAULT_MATCH_PAGE_SIZE,
  MAX_MATCH_PAGE_SIZE,
  normalizeMatchCursor,
  normalizeMatchPageSize,
  normalizeQuantity,
  paginateMatches,
  resolveMatchContact,
} = require("./matches");

test("normalizeQuantity clamps invalid values to zero", () => {
  assert.equal(normalizeQuantity(undefined), 0);
  assert.equal(normalizeQuantity(-2), 0);
  assert.equal(normalizeQuantity(1.9), 1);
});

test("buildUserSkuTotals aggregates duplicate sku documents", () => {
  const totals = buildUserSkuTotals([
    { ownerUid: "user-a", skuId: "SKU-1", quantity: 1 },
    { ownerUid: "user-a", skuId: "SKU-1", quantity: 2 },
    { ownerUid: "user-a", skuId: "SKU-2", quantity: 0 },
    { ownerUid: "user-b", skuId: "SKU-2", quantity: 3 },
  ]);

  assert.equal(totals.get("user-a").get("SKU-1"), 3);
  assert.equal(totals.get("user-a").has("SKU-2"), false);
  assert.equal(totals.get("user-b").get("SKU-2"), 3);
});

test("buildUserMatchProfile tracks only extras", () => {
  const profile = buildUserMatchProfile(
    new Map([
      ["SKU-1", 1],
      ["SKU-2", 2],
    ]),
  );

  assert.deepEqual(Array.from(profile.extras).sort(), ["SKU-2"]);
});

test("buildMatchesForCaller builds reciprocal pairs with pair limit", () => {
  const userSkuTotals = new Map([
    ["me", new Map([["A", 2]])],
    ["other", new Map([["B", 2]])],
  ]);

  const result = buildMatchesForCaller({
    callerUid: "me",
    userSkuTotals,
    optedOutUserIds: new Set(),
    pairLimit: 10,
  });

  assert.equal(result.isCallerOptedOut, false);
  assert.equal(result.matches.length, 1);
  assert.deepEqual(result.matches[0], {
    userId: "other",
    pairs: [{ theirSkuId: "B", yourSkuId: "A" }],
  });
});

test("buildMatchesForCaller sorts counterparties by userId for stable pagination", () => {
  const userSkuTotals = new Map([
    ["me", new Map([["A", 2]])],
    ["zeta", new Map([["B", 2]])],
    ["alpha", new Map([["C", 2]])],
  ]);

  const result = buildMatchesForCaller({
    callerUid: "me",
    userSkuTotals,
    optedOutUserIds: new Set(),
    pairLimit: 10,
  });

  assert.deepEqual(
    result.matches.map((match) => match.userId),
    ["alpha", "zeta"],
  );
});

test("paginateMatches returns first page and next cursor", () => {
  const matches = [
    { userId: "a", pairs: [{ theirSkuId: "1", yourSkuId: "2" }] },
    { userId: "b", pairs: [{ theirSkuId: "1", yourSkuId: "2" }] },
    { userId: "c", pairs: [{ theirSkuId: "1", yourSkuId: "2" }] },
  ];

  const firstPage = paginateMatches(matches, { pageSize: 2, cursor: null });
  assert.deepEqual(
    firstPage.matches.map((match) => match.userId),
    ["a", "b"],
  );
  assert.equal(firstPage.pageSize, 2);
  assert.equal(firstPage.nextCursor, "b");
  assert.equal(firstPage.hasMore, true);
  assert.equal(firstPage.totalOnPage, 2);

  const secondPage = paginateMatches(matches, { pageSize: 2, cursor: "b" });
  assert.deepEqual(
    secondPage.matches.map((match) => match.userId),
    ["c"],
  );
  assert.equal(secondPage.nextCursor, null);
  assert.equal(secondPage.hasMore, false);
  assert.equal(secondPage.totalOnPage, 1);
});

test("paginateMatches clamps page size and ignores unknown cursors", () => {
  const matches = [
    { userId: "a", pairs: [{ theirSkuId: "1", yourSkuId: "2" }] },
    { userId: "b", pairs: [{ theirSkuId: "1", yourSkuId: "2" }] },
  ];

  assert.equal(normalizeMatchPageSize(0), 1);
  assert.equal(normalizeMatchPageSize(999), MAX_MATCH_PAGE_SIZE);
  assert.equal(normalizeMatchPageSize(undefined), DEFAULT_MATCH_PAGE_SIZE);
  assert.equal(normalizeMatchCursor("  uid-1  "), "uid-1");
  assert.equal(normalizeMatchCursor(""), null);

  const page = paginateMatches(matches, { pageSize: 20, cursor: "missing" });
  assert.deepEqual(page.matches, []);
  assert.equal(page.hasMore, false);
  assert.equal(page.nextCursor, null);
  assert.equal(page.totalOnPage, 0);
});

test("buildMatchesForCaller excludes opted-out counterparties and caller", () => {
  const userSkuTotals = new Map([
    ["me", new Map([["A", 2]])],
    ["other", new Map([["B", 2]])],
  ]);

  const callerOptedOut = buildMatchesForCaller({
    callerUid: "me",
    userSkuTotals,
    optedOutUserIds: new Set(["me"]),
    pairLimit: 10,
  });
  assert.equal(callerOptedOut.isCallerOptedOut, true);
  assert.deepEqual(callerOptedOut.matches, []);

  const counterpartyOptedOut = buildMatchesForCaller({
    callerUid: "me",
    userSkuTotals,
    optedOutUserIds: new Set(["other"]),
    pairLimit: 10,
  });
  assert.equal(counterpartyOptedOut.isCallerOptedOut, false);
  assert.deepEqual(counterpartyOptedOut.matches, []);
});

test("resolveMatchContact shares true email by default", () => {
  assert.deepEqual(
    resolveMatchContact({
      preferences: {},
      trueEmail: "true@example.com",
    }),
    {
      method: "trueEmail",
      email: "true@example.com",
      usedFallback: false,
      fallbackReason: null,
    },
  );
});

test("resolveMatchContact uses trading email when configured", () => {
  assert.deepEqual(
    resolveMatchContact({
      preferences: {
        matchContactSharing: "tradingEmail",
        tradingEmail: " trade@example.com ",
      },
      trueEmail: "true@example.com",
    }),
    {
      method: "tradingEmail",
      email: "trade@example.com",
      usedFallback: false,
      fallbackReason: null,
    },
  );
});

test("resolveMatchContact falls back to true email when trading email is missing", () => {
  assert.deepEqual(
    resolveMatchContact({
      preferences: {
        matchContactSharing: "tradingEmail",
        tradingEmail: "   ",
      },
      trueEmail: "true@example.com",
    }),
    {
      method: "trueEmail",
      email: "true@example.com",
      usedFallback: true,
      fallbackReason: "Trading email was not set, so their account email was shared instead.",
    },
  );
});

test("resolveMatchContact uses discord details and falls back when incomplete", () => {
  assert.deepEqual(
    resolveMatchContact({
      preferences: {
        matchContactSharing: "discord",
        discordHandle: "kaladin",
        discordChannel: "",
      },
      trueEmail: "true@example.com",
    }),
    {
      method: "discord",
      discordHandle: "kaladin",
      discordChannel: DEFAULT_DISCORD_CHANNEL,
      usedFallback: false,
      fallbackReason: null,
    },
  );

  assert.deepEqual(
    resolveMatchContact({
      preferences: {
        matchContactSharing: "discord",
        discordHandle: "",
      },
      trueEmail: "true@example.com",
    }),
    {
      method: "trueEmail",
      email: "true@example.com",
      usedFallback: true,
      fallbackReason:
        "Discord information was incomplete, so their account email was shared instead.",
    },
  );
});
