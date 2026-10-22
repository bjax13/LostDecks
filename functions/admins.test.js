"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { ADMIN_EMAILS, callerIsSiteAdmin, planAdminClaimUpdates } = require("./admins");

test("admin list is exactly the site creators", () => {
  assert.deepEqual([...ADMIN_EMAILS], ["corbyagain@gmail.com", "bjax13@gmail.com"]);
});

test("planAdminClaimUpdates grants the claim only to creator emails", () => {
  const { updates, missing } = planAdminClaimUpdates([
    {
      uid: "corby",
      email: " CorbyAgain@gmail.com ",
      customClaims: { beta: true },
    },
    {
      uid: "bryan",
      email: "bjax13@gmail.com",
      customClaims: { admin: true, keep: 1 },
    },
    {
      uid: "collector",
      email: "collector.one@example.com",
      customClaims: { admin: true, keep: 2 },
    },
    {
      uid: "plain",
      email: "plain@example.com",
    },
    {
      uid: "",
      email: "corbyagain@gmail.com",
    },
  ]);

  assert.deepEqual(missing, []);
  assert.deepEqual(updates, [
    { uid: "corby", email: "corbyagain@gmail.com", claims: { beta: true, admin: true } },
    { uid: "collector", email: "collector.one@example.com", claims: { keep: 2 } },
  ]);
});

test("planAdminClaimUpdates reports creator emails that have no Auth user", () => {
  const { updates, missing } = planAdminClaimUpdates([
    { uid: "other", email: "not-corbyagain@gmail.com", customClaims: { admin: true } },
  ]);

  assert.deepEqual(updates, [{ uid: "other", email: "not-corbyagain@gmail.com", claims: {} }]);
  assert.deepEqual(missing, ["corbyagain@gmail.com", "bjax13@gmail.com"]);
});

test("planAdminClaimUpdates leaves matching claims untouched", () => {
  const { updates, missing } = planAdminClaimUpdates([
    { uid: "corby", email: "corbyagain@gmail.com", customClaims: { admin: true } },
    { uid: "bryan", email: "bjax13@gmail.com", customClaims: { admin: true } },
    { uid: "plain", email: "plain@example.com", customClaims: {} },
  ]);

  assert.deepEqual(updates, []);
  assert.deepEqual(missing, []);
});

test("callerIsSiteAdmin requires the boolean admin claim", () => {
  assert.equal(callerIsSiteAdmin({ auth: { uid: "admin", token: { admin: true } } }), true);
  assert.equal(callerIsSiteAdmin({ auth: { uid: "user", token: { admin: false } } }), false);
  assert.equal(callerIsSiteAdmin({ auth: { uid: "user", token: { admin: "true" } } }), false);
  assert.equal(callerIsSiteAdmin({ auth: { uid: "user", token: {} } }), false);
  assert.equal(callerIsSiteAdmin({ auth: { uid: "", token: { admin: true } } }), false);
  assert.equal(callerIsSiteAdmin({ auth: null }), false);
});
