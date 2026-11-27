"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const { normalizeExtractionItems } = require("./geminiCollectionVision");

test("normalizeExtractionItems clamps confidence and uppercases printed id", () => {
  const items = normalizeExtractionItems({
    items: [
      {
        name: "Shredhead",
        printedId: "pin-cf-01",
        kind: "pin",
        confidence: 1.5,
      },
    ],
  });
  assert.equal(items[0].printedId, "PIN-CF-01");
  assert.equal(items[0].confidence, 1);
});
