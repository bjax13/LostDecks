"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  buildMatchesForCaller,
  buildUserMatchProfile,
  buildUserSkuTotals,
  normalizeQuantity,
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
