"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  MAX_EXTRACTION_ITEMS,
  MAX_STRING_LENGTH,
  normalizeExtractionItems,
} = require("./geminiCollectionVision");

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

test("normalizeExtractionItems caps item count and string lengths", () => {
  const longName = "x".repeat(MAX_STRING_LENGTH.name + 50);
  const items = Array.from({ length: MAX_EXTRACTION_ITEMS + 10 }, (_, index) => ({
    name: `${longName}-${index}`,
    kind: "card",
    confidence: 0.5,
  }));
  const normalized = normalizeExtractionItems({ items });
  assert.equal(normalized.length, MAX_EXTRACTION_ITEMS);
  assert.equal(normalized[0].name.length, MAX_STRING_LENGTH.name);
});
