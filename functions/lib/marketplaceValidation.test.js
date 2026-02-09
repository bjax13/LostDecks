'use strict';

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  assertListingType,
  assertPriceCents,
  assertUsdCurrency,
} = require('./marketplaceValidation');

test('assertUsdCurrency allows USD', () => {
  assert.doesNotThrow(() => assertUsdCurrency('USD'));
});

test('assertUsdCurrency throws for non-USD', () => {
  assert.throws(() => assertUsdCurrency('EUR'), (err) => {
    assert.equal(err?.code, 'failed-precondition');
    assert.match(String(err?.message ?? ''), /Unsupported currency/);
    return true;
  });
});

test('assertListingType allows BID/ASK', () => {
  assert.doesNotThrow(() => assertListingType('BID'));
  assert.doesNotThrow(() => assertListingType('ASK'));
});

test('assertListingType throws for invalid values', () => {
  for (const value of ['BUY', 'SELL', '', null, undefined]) {
    assert.throws(() => assertListingType(value), (err) => {
      assert.equal(err?.code, 'failed-precondition');
      assert.match(String(err?.message ?? ''), /Invalid listing type/);
      return true;
    });
  }
});

test('assertPriceCents allows integer numbers', () => {
  assert.doesNotThrow(() => assertPriceCents(0));
  assert.doesNotThrow(() => assertPriceCents(1));
  assert.doesNotThrow(() => assertPriceCents(9999));
});

test('assertPriceCents throws for non-integers', () => {
  for (const value of [1.25, NaN, Infinity, '1', null, undefined]) {
    assert.throws(() => assertPriceCents(value), (err) => {
      assert.equal(err?.code, 'invalid-argument');
      return true;
    });
  }
});
