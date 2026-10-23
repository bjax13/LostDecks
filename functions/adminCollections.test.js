"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { buildAdminUserRows, listAdminCollectorsHandler } = require("./adminCollections");

test("buildAdminUserRows totals owned, dun, and foil counts per Auth user", () => {
  const rows = buildAdminUserRows(
    [
      { uid: "user-b", email: "b@example.com", displayName: "Bee" },
      { uid: "user-a", email: "a@example.com", displayName: "Ada" },
      { uid: "  ", email: "blank@example.com", displayName: "Blank" },
      { uid: "nameless", email: "hidden@example.com", displayName: "   " },
    ],
    [
      { ownerUid: "user-a", skuId: "LT24-ELS-01-DUN", quantity: 2 },
      { ownerUid: "user-a", skuId: "LT24-ELS-01-DUN", quantity: 1 },
      { ownerUid: "user-a", skuId: "LT24-ELS-01-FOIL", quantity: 1 },
      { ownerUid: "user-a", skuId: "PIN-CF-01", quantity: 4 },
      { ownerUid: "user-a", skuId: "LT24-ELS-02-DUN", quantity: 0 },
      { ownerUid: "stranger", skuId: "LT24-ELS-01-DUN", quantity: 5 },
    ],
  );

  assert.deepEqual(rows, [
    {
      uid: "user-a",
      displayName: "Ada",
      email: "a@example.com",
      distinctItems: 3,
      totalQuantity: 8,
      dunCount: 1,
      foilCount: 1,
    },
    {
      uid: "user-b",
      displayName: "Bee",
      email: "b@example.com",
      distinctItems: 0,
      totalQuantity: 0,
      dunCount: 0,
      foilCount: 0,
    },
    {
      uid: "nameless",
      displayName: "nameless",
      email: "hidden@example.com",
      distinctItems: 0,
      totalQuantity: 0,
      dunCount: 0,
      foilCount: 0,
    },
  ]);
});

test("listAdminCollectorsHandler rejects signed-out and non-admin callers before reading data", async () => {
  let reads = 0;
  const deps = {
    listAuthUsers: async () => {
      reads += 1;
      return [];
    },
    listCollectionDocs: async () => {
      reads += 1;
      return [];
    },
  };

  await assert.rejects(
    () => listAdminCollectorsHandler({ auth: null }, deps),
    (err) => err.code === "unauthenticated",
  );
  await assert.rejects(
    () => listAdminCollectorsHandler({ auth: { uid: "user", token: {} } }, deps),
    (err) => err.code === "permission-denied",
  );
  await assert.rejects(
    () => listAdminCollectorsHandler({ auth: { uid: "user", token: { admin: "true" } } }, deps),
    (err) => err.code === "permission-denied",
  );
  assert.equal(reads, 0);
});

test("listAdminCollectorsHandler returns sorted collector rows for an admin", async () => {
  const result = await listAdminCollectorsHandler(
    { auth: { uid: "admin", token: { admin: true } } },
    {
      listAuthUsers: async () => [
        { uid: "user-b", email: "b@example.com", displayName: "Bee" },
        { uid: "user-a", email: "a@example.com", displayName: "Ada" },
      ],
      listCollectionDocs: async () => [
        { ownerUid: "user-a", skuId: "LT24-HLD-01-FOIL", quantity: 2 },
      ],
    },
  );

  assert.deepEqual(result, {
    users: [
      {
        uid: "user-a",
        displayName: "Ada",
        email: "a@example.com",
        distinctItems: 1,
        totalQuantity: 2,
        dunCount: 0,
        foilCount: 1,
      },
      {
        uid: "user-b",
        displayName: "Bee",
        email: "b@example.com",
        distinctItems: 0,
        totalQuantity: 0,
        dunCount: 0,
        foilCount: 0,
      },
    ],
  });
});
