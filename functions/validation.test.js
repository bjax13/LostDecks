"use strict";

const assert = require("node:assert");
const { describe, test } = require("node:test");
const { HttpsError } = require("firebase-functions/v2/https");
const { asInt } = require("./validation");

describe("asInt", () => {
  test("returns integer for finite integers", () => {
    assert.strictEqual(asInt(0, "priceCents"), 0);
    assert.strictEqual(asInt(-1, "qty"), -1);
    assert.strictEqual(asInt(42, "n"), 42);
  });

  test("throws HttpsError invalid-argument for non-integers", () => {
    assert.throws(
      () => asInt(1.5, "priceCents"),
      (err) => err instanceof HttpsError && err.code === "invalid-argument",
    );
    assert.throws(
      () => asInt(Number.NaN, "x"),
      (err) => err instanceof HttpsError && err.message.includes("x must be an integer"),
    );
    assert.throws(
      () => asInt(Number.POSITIVE_INFINITY, "x"),
      (err) => err instanceof HttpsError,
    );
    assert.throws(
      () => asInt("1", "x"),
      (err) => err instanceof HttpsError,
    );
  });
});
