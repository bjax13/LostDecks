"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { deleteQueryInBatches, deleteMyAccountHandler } = require("./deleteAccount");

function createFakeQuery(docsByPage) {
  let pageIndex = 0;
  const query = {
    firestore: {
      batch() {
        const ops = [];
        return {
          delete(ref) {
            ops.push(ref);
          },
          async commit() {
            query._committed.push([...ops]);
          },
        };
      },
    },
    _committed: [],
    limit(size) {
      assert.ok(size > 0);
      return {
        async get() {
          const page = docsByPage[pageIndex] || [];
          pageIndex += 1;
          return {
            empty: page.length === 0,
            size: page.length,
            docs: page,
          };
        },
      };
    },
  };
  return query;
}

test("deleteQueryInBatches no-ops when the first page is empty", async () => {
  const query = createFakeQuery([[]]);
  await deleteQueryInBatches(query, 2);
  assert.deepEqual(query._committed, []);
});

test("deleteQueryInBatches deletes pages until empty", async () => {
  const query = createFakeQuery([
    [{ ref: { id: "a" } }, { ref: { id: "b" } }],
    [{ ref: { id: "c" } }],
    [],
  ]);
  await deleteQueryInBatches(query, 2);
  assert.equal(query._committed.length, 2);
  assert.deepEqual(
    query._committed[0].map((ref) => ref.id),
    ["a", "b"],
  );
  assert.deepEqual(
    query._committed[1].map((ref) => ref.id),
    ["c"],
  );
});

test("deleteQueryInBatches stops after a short final page without an extra empty fetch", async () => {
  const query = createFakeQuery([[{ ref: { id: "only" } }]]);
  await deleteQueryInBatches(query, 10);
  assert.equal(query._committed.length, 1);
});

test("deleteMyAccountHandler requires auth", async () => {
  await assert.rejects(
    () => deleteMyAccountHandler({ auth: null, data: { confirm: "DELETE" } }),
    (err) => err.code === "unauthenticated",
  );
});

test("deleteMyAccountHandler requires DELETE confirmation", async () => {
  await assert.rejects(
    () => deleteMyAccountHandler({ auth: { uid: "user-1" }, data: { confirm: "nope" } }),
    (err) => err.code === "invalid-argument",
  );
});
