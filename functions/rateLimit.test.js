"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const {
  evaluateRateLimit,
  DEFAULT_MIN_INTERVAL_MS,
  DEFAULT_MAX_PER_WINDOW,
  DEFAULT_WINDOW_MS,
} = require("./rateLimit");

test("evaluateRateLimit allows the first call", () => {
  const now = 1_000_000;
  const result = evaluateRateLimit(null, now);

  assert.equal(result.allowed, true);
  assert.deepEqual(result.nextState, {
    lastCallAt: now,
    windowStart: now,
    windowCount: 1,
  });
});

test("evaluateRateLimit blocks a call within the min interval", () => {
  const now = 1_000_000;
  const first = evaluateRateLimit(null, now);
  const second = evaluateRateLimit(first.nextState, now + DEFAULT_MIN_INTERVAL_MS - 1);

  assert.equal(second.allowed, false);
  assert.equal(second.nextState.windowCount, 1);
  assert.equal(second.nextState.lastCallAt, now);
});

test("evaluateRateLimit allows a call after the min interval", () => {
  const now = 1_000_000;
  const first = evaluateRateLimit(null, now);
  const second = evaluateRateLimit(first.nextState, now + DEFAULT_MIN_INTERVAL_MS);

  assert.equal(second.allowed, true);
  assert.equal(second.nextState.windowCount, 2);
  assert.equal(second.nextState.lastCallAt, now + DEFAULT_MIN_INTERVAL_MS);
});

test("evaluateRateLimit resets the window after windowMs", () => {
  const now = 1_000_000;
  const prior = {
    lastCallAt: now,
    windowStart: now,
    windowCount: DEFAULT_MAX_PER_WINDOW,
  };
  const afterWindow = evaluateRateLimit(prior, now + DEFAULT_WINDOW_MS);

  assert.equal(afterWindow.allowed, true);
  assert.equal(afterWindow.nextState.windowCount, 1);
  assert.equal(afterWindow.nextState.windowStart, now + DEFAULT_WINDOW_MS);
});

test("evaluateRateLimit blocks when the window cap is reached", () => {
  const now = 1_000_000;
  const prior = {
    lastCallAt: now - DEFAULT_MIN_INTERVAL_MS,
    windowStart: now - 60_000,
    windowCount: DEFAULT_MAX_PER_WINDOW,
  };
  const result = evaluateRateLimit(prior, now);

  assert.equal(result.allowed, false);
  assert.equal(result.nextState.windowCount, DEFAULT_MAX_PER_WINDOW);
});
