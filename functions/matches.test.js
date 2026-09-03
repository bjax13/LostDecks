"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildLanePrefsByUserId,
  buildMatchesForCaller,
  buildUserMatchProfile,
  buildUserSkuTotals,
  DEFAULT_DISCORD_CHANNEL,
  DEFAULT_MATCH_LANES,
  DEFAULT_MATCH_PAGE_SIZE,
  laneForSkuId,
  MAX_MATCH_PAGE_SIZE,
  normalizeMatchCursor,
  normalizeMatchLanes,
  normalizeMatchPageSize,
  normalizeQuantity,
  paginateMatches,
  resolveMatchContact,
  resolvePublicDisplayName,
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

test("laneForSkuId maps pin prefix and card finish tokens", () => {
  assert.equal(laneForSkuId("PIN-CF-01"), "pins");
  assert.equal(laneForSkuId("LT24-ELS-01-DUN"), "dun");
  assert.equal(laneForSkuId("LT24-ELS-01-FOIL"), "foil");
  assert.equal(laneForSkuId("LT24-NS-ELS-24-DUN-DANCE"), "dun");
  assert.equal(laneForSkuId("UNKNOWN"), null);
});

test("buildMatchesForCaller builds reciprocal lanes with two piles", () => {
  const userSkuTotals = new Map([
    ["me", new Map([["LT24-ELS-01-DUN", 2]])],
    ["other", new Map([["LT24-HLD-01-DUN", 2]])],
  ]);

  const result = buildMatchesForCaller({
    callerUid: "me",
    userSkuTotals,
    optedOutUserIds: new Set(),
  });

  assert.equal(result.isCallerOptedOut, false);
  assert.equal(result.matches.length, 1);
  assert.deepEqual(result.matches[0], {
    userId: "other",
    lanes: [
      {
        id: "dun",
        theyCanSend: [{ skuId: "LT24-HLD-01-DUN", owned: 2, extras: 1 }],
        youCanSend: [{ skuId: "LT24-ELS-01-DUN", owned: 2, extras: 1 }],
      },
    ],
  });
});

test("buildMatchesForCaller fences lanes and hides empty ones for tester1 vs tester2", () => {
  const userSkuTotals = new Map([
    [
      "tester1",
      new Map([
        ["LT24-ELS-01-DUN", 3],
        ["LT24-CHM-01-DUN", 2],
        ["PIN-CF-01", 2],
      ]),
    ],
    [
      "tester2",
      new Map([
        ["LT24-HLD-01-DUN", 2],
        ["PIN-CF-02", 2],
      ]),
    ],
  ]);

  const result = buildMatchesForCaller({
    callerUid: "tester1",
    userSkuTotals,
    optedOutUserIds: new Set(),
  });

  assert.equal(result.matches.length, 1);
  assert.deepEqual(result.matches[0].lanes, [
    {
      id: "dun",
      theyCanSend: [{ skuId: "LT24-HLD-01-DUN", owned: 2, extras: 1 }],
      youCanSend: [
        { skuId: "LT24-CHM-01-DUN", owned: 2, extras: 1 },
        { skuId: "LT24-ELS-01-DUN", owned: 3, extras: 2 },
      ],
    },
    {
      id: "pins",
      theyCanSend: [{ skuId: "PIN-CF-02", owned: 2, extras: 1 }],
      youCanSend: [{ skuId: "PIN-CF-01", owned: 2, extras: 1 }],
    },
  ]);
});

test("buildMatchesForCaller caps each pile to the item limit", () => {
  const otherTotals = new Map();
  for (let index = 1; index <= 12; index += 1) {
    otherTotals.set(`LT24-ELS-${String(index).padStart(2, "0")}-DUN`, 2);
  }
  const userSkuTotals = new Map([
    ["me", new Map([["LT24-HLD-01-DUN", 2]])],
    ["other", otherTotals],
  ]);

  const result = buildMatchesForCaller({
    callerUid: "me",
    userSkuTotals,
    optedOutUserIds: new Set(),
    itemLimit: 5,
  });

  assert.equal(result.matches[0].lanes[0].theyCanSend.length, 5);
  assert.equal(result.matches[0].lanes[0].youCanSend.length, 1);
});

test("buildMatchesForCaller does not match across lanes", () => {
  const userSkuTotals = new Map([
    ["me", new Map([["PIN-CF-01", 2]])],
    ["other", new Map([["LT24-HLD-01-DUN", 2]])],
  ]);

  const result = buildMatchesForCaller({
    callerUid: "me",
    userSkuTotals,
    optedOutUserIds: new Set(),
  });

  assert.deepEqual(result.matches, []);
});

test("buildMatchesForCaller treats qty 1 as neither extra nor need", () => {
  const userSkuTotals = new Map([
    [
      "me",
      new Map([
        ["LT24-ELS-01-DUN", 2],
        ["LT24-HLD-01-DUN", 1],
      ]),
    ],
    [
      "other",
      new Map([
        ["LT24-HLD-01-DUN", 2],
        ["LT24-ELS-01-DUN", 1],
      ]),
    ],
  ]);

  const result = buildMatchesForCaller({
    callerUid: "me",
    userSkuTotals,
    optedOutUserIds: new Set(),
  });

  assert.deepEqual(result.matches, []);
});

test("buildMatchesForCaller omits a lane that is only one-way", () => {
  const userSkuTotals = new Map([
    [
      "me",
      new Map([
        ["LT24-ELS-01-DUN", 2],
        ["PIN-CF-01", 2],
      ]),
    ],
    [
      "other",
      new Map([
        ["LT24-HLD-01-DUN", 2],
        ["LT24-ELS-02-FOIL", 2],
      ]),
    ],
  ]);

  const result = buildMatchesForCaller({
    callerUid: "me",
    userSkuTotals,
    optedOutUserIds: new Set(),
  });

  assert.equal(result.matches.length, 1);
  assert.deepEqual(
    result.matches[0].lanes.map((lane) => lane.id),
    ["dun"],
  );
});

test("buildMatchesForCaller sorts counterparties by userId for stable pagination", () => {
  const userSkuTotals = new Map([
    ["me", new Map([["LT24-ELS-01-DUN", 2]])],
    ["zeta", new Map([["LT24-HLD-01-DUN", 2]])],
    ["alpha", new Map([["LT24-CHM-01-DUN", 2]])],
  ]);

  const result = buildMatchesForCaller({
    callerUid: "me",
    userSkuTotals,
    optedOutUserIds: new Set(),
  });

  assert.deepEqual(
    result.matches.map((match) => match.userId),
    ["alpha", "zeta"],
  );
});

test("paginateMatches returns first page and next cursor", () => {
  const matches = [
    { userId: "a", lanes: [{ id: "dun", theyCanSend: [], youCanSend: [] }] },
    { userId: "b", lanes: [{ id: "dun", theyCanSend: [], youCanSend: [] }] },
    { userId: "c", lanes: [{ id: "dun", theyCanSend: [], youCanSend: [] }] },
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
    { userId: "a", lanes: [{ id: "dun", theyCanSend: [], youCanSend: [] }] },
    { userId: "b", lanes: [{ id: "dun", theyCanSend: [], youCanSend: [] }] },
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
    ["me", new Map([["LT24-ELS-01-DUN", 2]])],
    ["other", new Map([["LT24-HLD-01-DUN", 2]])],
  ]);

  const callerOptedOut = buildMatchesForCaller({
    callerUid: "me",
    userSkuTotals,
    optedOutUserIds: new Set(["me"]),
  });
  assert.equal(callerOptedOut.isCallerOptedOut, true);
  assert.deepEqual(callerOptedOut.matches, []);

  const counterpartyOptedOut = buildMatchesForCaller({
    callerUid: "me",
    userSkuTotals,
    optedOutUserIds: new Set(["other"]),
  });
  assert.equal(counterpartyOptedOut.isCallerOptedOut, false);
  assert.deepEqual(counterpartyOptedOut.matches, []);
});

test("normalizeMatchLanes defaults missing prefs to all lanes enabled", () => {
  assert.deepEqual(normalizeMatchLanes(undefined), { ...DEFAULT_MATCH_LANES });
  assert.deepEqual(normalizeMatchLanes({ dun: false }), {
    dun: false,
    foil: true,
    pins: true,
  });
  assert.deepEqual(
    buildLanePrefsByUserId(
      new Map([
        ["me", {}],
        ["other", { matchLanes: { pins: false } }],
      ]),
    ).get("me"),
    { dun: true, foil: true, pins: true },
  );
});

test("buildMatchesForCaller omits lanes neither collector has enabled", () => {
  const userSkuTotals = new Map([
    [
      "me",
      new Map([
        ["LT24-ELS-01-DUN", 2],
        ["LT24-ELS-01-FOIL", 2],
        ["PIN-CF-01", 2],
      ]),
    ],
    [
      "other",
      new Map([
        ["LT24-HLD-01-DUN", 2],
        ["LT24-HLD-01-FOIL", 2],
        ["PIN-CF-02", 2],
      ]),
    ],
  ]);

  const pinsOnlyCaller = buildMatchesForCaller({
    callerUid: "me",
    userSkuTotals,
    optedOutUserIds: new Set(),
    lanePrefsByUserId: new Map([
      ["me", { dun: false, foil: false, pins: true }],
      ["other", { dun: true, foil: true, pins: true }],
    ]),
  });

  assert.equal(pinsOnlyCaller.matches.length, 1);
  assert.deepEqual(
    pinsOnlyCaller.matches[0].lanes.map((lane) => lane.id),
    ["pins"],
  );
  assert.deepEqual(pinsOnlyCaller.matches[0].lanes[0].theyCanSend, [
    { skuId: "PIN-CF-02", owned: 2, extras: 1 },
  ]);
  assert.deepEqual(pinsOnlyCaller.matches[0].lanes[0].youCanSend, [
    { skuId: "PIN-CF-01", owned: 2, extras: 1 },
  ]);

  const pinsOnlyOther = buildMatchesForCaller({
    callerUid: "me",
    userSkuTotals,
    optedOutUserIds: new Set(),
    lanePrefsByUserId: new Map([
      ["me", { dun: true, foil: true, pins: true }],
      ["other", { dun: false, foil: false, pins: true }],
    ]),
  });

  assert.deepEqual(
    pinsOnlyOther.matches[0].lanes.map((lane) => lane.id),
    ["pins"],
  );

  const noSharedLane = buildMatchesForCaller({
    callerUid: "me",
    userSkuTotals,
    optedOutUserIds: new Set(),
    lanePrefsByUserId: new Map([
      ["me", { dun: false, foil: false, pins: true }],
      ["other", { dun: true, foil: true, pins: false }],
    ]),
  });
  assert.deepEqual(noSharedLane.matches, []);
});

test("buildMatchesForCaller ignores lane prefs when the caller is fully opted out", () => {
  const userSkuTotals = new Map([
    ["me", new Map([["PIN-CF-01", 2]])],
    ["other", new Map([["PIN-CF-02", 2]])],
  ]);

  const result = buildMatchesForCaller({
    callerUid: "me",
    userSkuTotals,
    optedOutUserIds: new Set(["me"]),
    lanePrefsByUserId: new Map([["me", { dun: true, foil: true, pins: true }]]),
  });

  assert.equal(result.isCallerOptedOut, true);
  assert.deepEqual(result.matches, []);
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

test("resolveMatchContact omits the account email when trading email is missing", () => {
  assert.deepEqual(
    resolveMatchContact({
      preferences: {
        matchContactSharing: "tradingEmail",
        tradingEmail: "   ",
      },
      trueEmail: "true@example.com",
    }),
    {
      method: "tradingEmail",
      usedFallback: false,
      fallbackReason: "Trading email is not set, so no contact details were shared.",
    },
  );
});

test("resolveMatchContact uses discord details and omits email when incomplete", () => {
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
      method: "discord",
      usedFallback: false,
      fallbackReason: "Discord information is incomplete, so no contact details were shared.",
    },
  );
});

test("resolvePublicDisplayName never uses the Auth email", () => {
  assert.equal(
    resolvePublicDisplayName({
      uid: "uid-1",
      displayName: " Collector Two ",
      email: "two@example.com",
    }),
    "Collector Two",
  );
  assert.equal(
    resolvePublicDisplayName({
      uid: "uid-2",
      displayName: "   ",
      email: "hidden@example.com",
    }),
    "uid-2",
  );
  assert.equal(resolvePublicDisplayName({ email: "hidden@example.com" }), "Collector");
});
